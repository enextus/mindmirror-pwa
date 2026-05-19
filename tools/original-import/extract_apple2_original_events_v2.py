#!/usr/bin/env python3
"""
extract_apple2_original_events_v2.py

Private research extractor for Timothy Leary's Mind Mirror Apple II disks.

V2 goals:
  - recursively find Apple II .dsk images inside the 4am crack/preservation zip;
  - parse DOS 3.3 catalogs and extract files;
  - decode Mind Mirror high-bit dictionary tokens using mindmirror_token_map_full.json;
  - split decoded files into screen/event blocks using original control markers;
  - classify blocks as scenario/quote/menu/help/passkey/scoreboard/etc.;
  - infer realm and partial axisRow/score mapping where supported by recovered evidence;
  - write safe metadata by default and private prose only with --include-prose.

Important copyright rule:
  Generated private prose is original game text. Keep it in gitignored research-output.
  Do not commit or publish original-events.private.json or decoded text folders.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import zipfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterator

DSK_SIZE = 35 * 16 * 256
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_TOKEN_MAP_PATH = SCRIPT_DIR / "mindmirror_token_map_full.json"

REALMS = {
    "1": "bio_energy",
    "2": "emotional_insight",
    "3": "mental_abilities",
    "4": "social_interaction",
}

SCORE_X_TABLE = [
    [21, 15, 9, 3, -3, -9, -15, -21],
    [14, 10, 6, 2, -2, -6, -10, -14],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [-14, -10, -6, -2, 2, 6, 10, 14],
]
SCORE_Y_TABLE = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [-14, -10, -6, -2, 2, 6, 10, 14],
    [-21, -15, -9, -3, 3, 9, 15, 21],
    [-14, -10, -6, -2, 2, 6, 10, 14],
]

# Evidence recovered in the prior DOS/Apple II reverse-engineering pass.
# It is deliberately sparse: unknown axis rows stay unknown instead of being guessed.
KNOWN_AXIS_ROW_BY_FILE: dict[str, int | None] = {
    "FILE11B": 2,
    "FILE12A": 2,
    "FILE12B": 3,
    "FILE13A": 3,
    "FILE14A": 2,
    "FILE31A": 2,
    "FILE31B": 2,
    "FILE32A": 2,
    "FILE32B": 2,
    "FILE32C": 2,
    "FILE44B": 3,
    "FILE45A": 3,
    "FILE45B": 3,
    "FILE47B": 3,
    "FILEKG": 2,
    "FILEKH": 2,
    "FILEKZ": 2,
    "FILEM": 2,
    "FILEO": 2,
}

CONTROL_NAMES = {
    0x04: "PAGE",
    0x05: "BLOCK",
    0x06: "ACK",
    0x07: "BELL",
    0x08: "BACKSPACE",
    0x0C: "FORMFEED",
    0x0E: "CTRL0E",
    0x0F: "CTRL0F",
}

@dataclass(frozen=True)
class DiskImage:
    source_archive: str
    inner_path: str
    disk_name: str
    sha256: str
    size: int
    duplicate_of_sha256: str | None
    data: bytes

@dataclass(frozen=True)
class Dos33FileEntry:
    disk_name: str
    file_name: str
    file_type_raw: int
    file_type: str
    ts_track: int
    ts_sector: int
    catalog_length_sectors: int
    byte_length_extracted: int
    sha256: str
    extracted_path: str

@dataclass(frozen=True)
class ChoiceRecord:
    marker: str
    displayed_choice: int | None
    answer_code: int | None
    dx: int | None
    dy: int | None
    text_preview: str | None

@dataclass(frozen=True)
class EventBlock:
    id: str
    disk_name: str
    disk_sha256: str
    file_name: str
    block_index: int
    block_start_offset_decoded: int | None
    text_sha256: str
    block_type: str
    realm_hint: str | None
    realm_confidence: str
    axis_row: int | None
    axis_row_confidence: str
    title_hint: str | None
    option_marker_count: int
    numeric_choice_count: int
    letter_choice_count: int
    choice_markers: list[str]
    choices: list[ChoiceRecord]
    scored_choice_count: int
    is_probable_scenario: bool
    exclusion_reason: str | None
    prose: str | None = None


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_name(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_.!-]+", "_", value).strip("_")
    return value or "unnamed"


def sector(data: bytes, track: int, sector_number: int) -> bytes:
    offset = (track * 16 + sector_number) * 256
    return data[offset:offset + 256]


def apple_filename(raw: bytes) -> str:
    return "".join(chr(b & 0x7F) for b in raw).rstrip()


def dos33_file_type(type_byte: int) -> str:
    locked = bool(type_byte & 0x80)
    t = type_byte & 0x7F
    labels = []
    for bit, label in [(0x01, "I"), (0x02, "A"), (0x04, "B"), (0x08, "S"), (0x10, "R"), (0x20, "a"), (0x40, "b")]:
        if t & bit:
            labels.append(label)
    if not labels:
        labels.append("T" if t == 0 else "?")
    return ("*" if locked else "") + "+".join(labels)


def read_catalog(data: bytes) -> list[tuple[str, int, int, int, int]]:
    vtoc = sector(data, 17, 0)
    cat_track, cat_sector = vtoc[1], vtoc[2]
    entries: list[tuple[str, int, int, int, int]] = []
    seen: set[tuple[int, int]] = set()
    while cat_track and (cat_track, cat_sector) not in seen:
        seen.add((cat_track, cat_sector))
        cat = sector(data, cat_track, cat_sector)
        next_track, next_sector = cat[1], cat[2]
        for index in range(7):
            off = 0x0B + index * 35
            entry = cat[off:off + 35]
            ts_track, ts_sector, type_byte = entry[0], entry[1], entry[2]
            if type_byte == 0 and ts_track == 0 and ts_sector == 0:
                continue
            if ts_track == 0xFF:
                continue
            name = apple_filename(entry[3:33])
            length = entry[33] + 256 * entry[34]
            entries.append((name, ts_track, ts_sector, type_byte, length))
        cat_track, cat_sector = next_track, next_sector
    return entries


def extract_dos33_file(data: bytes, ts_track: int, ts_sector: int) -> bytes:
    blocks: list[bytes] = []
    seen: set[tuple[int, int]] = set()
    track, secnum = ts_track, ts_sector
    while track not in (0, 0xFF) and (track, secnum) not in seen:
        seen.add((track, secnum))
        ts = sector(data, track, secnum)
        next_track, next_sector = ts[1], ts[2]
        for off in range(0x0C, 256, 2):
            data_track, data_sector = ts[off], ts[off + 1]
            if data_track in (0, 0xFF):
                continue
            if data_track >= 35 or data_sector >= 16:
                continue
            blocks.append(sector(data, data_track, data_sector))
        track, secnum = next_track, next_sector
    return b"".join(blocks)


def iter_zip_payloads(zip_path: Path) -> Iterator[tuple[str, bytes]]:
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            data = zf.read(info.filename)
            yield info.filename, data
            if info.filename.lower().endswith(".zip"):
                try:
                    with zipfile.ZipFile(io.BytesIO(data)) as inner:
                        for inner_info in inner.infolist():
                            if inner_info.is_dir():
                                continue
                            inner_data = inner.read(inner_info.filename)
                            yield f"{info.filename}!/{inner_info.filename}", inner_data
                except zipfile.BadZipFile:
                    continue


def collect_dsk_images(zip_path: Path, include_duplicate_disks: bool) -> list[DiskImage]:
    images: list[DiskImage] = []
    seen_sha: dict[str, str] = {}
    for inner_path, data in iter_zip_payloads(zip_path):
        if not inner_path.lower().endswith(".dsk") or len(data) != DSK_SIZE:
            continue
        sha = sha256_bytes(data)
        duplicate_of = seen_sha.get(sha)
        if duplicate_of and not include_duplicate_disks:
            continue
        disk_name = safe_name(Path(inner_path).stem)
        images.append(DiskImage(
            source_archive=str(zip_path),
            inner_path=inner_path,
            disk_name=disk_name,
            sha256=sha,
            size=len(data),
            duplicate_of_sha256=duplicate_of,
            data=data,
        ))
        seen_sha.setdefault(sha, inner_path)
    return images


def load_token_map(path: Path) -> dict[int, str]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {int(k, 16) if isinstance(k, str) and k.startswith("0x") else int(k): str(v) for k, v in raw.items()}


def decode_mind_mirror_bytes(raw: bytes, token_map: dict[int, str]) -> str:
    out: list[str] = []
    for b in raw:
        if b in token_map:
            out.append(token_map[b])
            continue
        c = b & 0x7F
        if c in (10, 13):
            out.append("\n")
        elif 32 <= c < 127:
            out.append(chr(c))
        elif c in CONTROL_NAMES:
            out.append(f"\n<{CONTROL_NAMES[c]}>\n")
        else:
            out.append(" ")
    text = "".join(out)
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_blocks(decoded: str) -> list[str]:
    # PAGE and BLOCK are the strongest event/screen separators in the observed files.
    chunks = re.split(r"\n?<(?:PAGE|BLOCK)>\n?", decoded)
    out: list[str] = []
    for chunk in chunks:
        chunk = chunk.strip(" \n\t")
        if not chunk:
            continue
        # Some files contain dense screens separated by repeated @ markers.
        subchunks = re.split(r"\n\s*@\s*\n", chunk)
        for sub in subchunks:
            sub = sub.strip(" \n\t")
            if len(sub) >= 8:
                out.append(sub)
    return out


def extract_title_hint(text: str) -> str | None:
    lines = [line.strip(" .\t\"'") for line in text.splitlines() if line.strip()]
    ignore = {"RETURN TO CONTINUE", "PRESS RETURN", "PRESS F9 TO SEE MIND MAP"}
    for line in lines[:8]:
        alpha = sum(ch.isalpha() for ch in line)
        if alpha < 4 or len(line) > 90:
            continue
        upperish = line.upper() == line or line.startswith("The ") or line.startswith("THE ") or line.startswith("Life ") or line.startswith("LIFE ")
        if upperish and line.upper() not in ignore:
            return line
    # fallback: first meaningful line
    for line in lines[:5]:
        if 8 <= len(line) <= 90 and sum(ch.isalpha() for ch in line) >= 6:
            return line
    return None


def infer_realm_from_file(file_name: str) -> tuple[str | None, str]:
    upper = file_name.upper()
    m = re.match(r"FILE([1-4])", upper)
    if m:
        return REALMS[m.group(1)], "file_prefix"
    return None, "none"


def infer_realm_from_text(text: str) -> tuple[str | None, str]:
    t = text.upper()
    if "BIO-ENERGY" in t or "LIFE IN THE WOMB" in t or "BIRTH DECISIONS" in t:
        return "bio_energy", "text_hint"
    if "EMOTIONAL INSIGHT" in t or "BIRTHDAY PARTY" in t or "MOMMY DEAREST" in t:
        return "emotional_insight", "text_hint"
    if "MENTAL ABILITIES" in t or "T.F.Y.Q.A" in t or "PHILOSOPHY" in t:
        return "mental_abilities", "text_hint"
    if "SOCIAL INTERACTION" in t or "PASSKEY" in t or "HOME ZONE" in t:
        return "social_interaction", "text_hint"
    return None, "none"


def infer_realm(file_name: str, text: str) -> tuple[str | None, str]:
    realm, confidence = infer_realm_from_file(file_name)
    if realm:
        return realm, confidence
    return infer_realm_from_text(text)


def infer_axis_row(file_name: str) -> tuple[int | None, str]:
    upper = file_name.upper()
    if upper in KNOWN_AXIS_ROW_BY_FILE and KNOWN_AXIS_ROW_BY_FILE[upper] is not None:
        return KNOWN_AXIS_ROW_BY_FILE[upper], "known_from_prior_re"
    return None, "unknown"


def choice_markers(text: str) -> list[str]:
    markers = re.findall(r"#\s*([1-8AD:])", text, flags=re.IGNORECASE)
    return [m.upper() for m in markers]


def split_choice_texts(text: str) -> dict[str, str]:
    # Best-effort. Avoid publishing full prose in metadata output; this is for private mode only.
    parts = re.split(r"#\s*([1-8AD:])", text, flags=re.IGNORECASE)
    result: dict[str, str] = {}
    if len(parts) < 3:
        return result
    for i in range(1, len(parts), 2):
        marker = parts[i].upper()
        body = parts[i + 1] if i + 1 < len(parts) else ""
        body = body.strip()
        # stop before next obvious control line already handled by split; keep preview manageable
        result.setdefault(marker, body)
    return result


def score_choice(marker: str, axis_row: int | None) -> tuple[int | None, int | None, int | None, int | None]:
    if not marker.isdigit() or axis_row is None:
        return None, None, None, None
    displayed = int(marker)
    if displayed < 1 or displayed > 8 or axis_row < 1 or axis_row > 4:
        return displayed, None, None, None
    answer_code = displayed - 1
    return displayed, answer_code, SCORE_X_TABLE[axis_row - 1][answer_code], SCORE_Y_TABLE[axis_row - 1][answer_code]


def classify_block(text: str, markers: list[str], title: str | None) -> tuple[str, str | None, bool]:
    upper = text.upper()
    if "LIFE SIMULATION SCOREBOARD" in upper:
        return "scoreboard", "scoreboard/help screen", False
    if "PASSKEY" in upper or "HOME ZONE" in upper:
        # Passkeys can be part of gameplay but are not normal scenario prompts.
        return "passkey", "passkey/home-zone screen", False
    if "DIRECTIONS" in upper or "PRESS" in upper and len(markers) <= 1:
        return "directions", "directions/help screen", False
    if "RETURN TO CONTINUE" in upper or "SPACE BAR" in upper or "CURSOR" in upper:
        return "menu_or_help", "navigation/menu/help screen", False
    if any(m in ("A", "D") for m in markers):
        return "quote_event", None, True
    if len([m for m in markers if m.isdigit()]) >= 2:
        return "scenario_event", None, True
    if markers:
        return "single_choice_or_menu", "not enough choices for scenario", False
    return "text_block", "no option markers", False


def build_event_block(
    disk: DiskImage,
    file_name: str,
    block_index: int,
    text: str,
    include_prose: bool,
) -> EventBlock:
    markers = choice_markers(text)
    numeric = [m for m in markers if m.isdigit()]
    letters = [m for m in markers if not m.isdigit()]
    title = extract_title_hint(text)
    realm, realm_conf = infer_realm(file_name, text)
    axis_row, axis_conf = infer_axis_row(file_name)
    choice_texts = split_choice_texts(text)
    choices: list[ChoiceRecord] = []
    for marker in markers:
        displayed, answer_code, dx, dy = score_choice(marker, axis_row)
        preview = choice_texts.get(marker)
        if preview is not None:
            preview = re.sub(r"\s+", " ", preview).strip()[:180]
        choices.append(ChoiceRecord(marker, displayed, answer_code, dx, dy, preview if include_prose else None))
    block_type, exclusion_reason, probable = classify_block(text, markers, title)
    # A probable scenario with no axis row remains useful but not fully score-mapped.
    scored_count = sum(1 for c in choices if c.dx is not None and c.dy is not None)
    event_id = f"{safe_name(Path(disk.disk_name).stem)}__{safe_name(file_name)}__{block_index:04d}"
    return EventBlock(
        id=event_id,
        disk_name=disk.disk_name,
        disk_sha256=disk.sha256,
        file_name=file_name,
        block_index=block_index,
        block_start_offset_decoded=None,
        text_sha256=sha256_bytes(text.encode("utf-8", errors="replace")),
        block_type=block_type,
        realm_hint=realm,
        realm_confidence=realm_conf,
        axis_row=axis_row,
        axis_row_confidence=axis_conf,
        title_hint=title,
        option_marker_count=len(markers),
        numeric_choice_count=len(numeric),
        letter_choice_count=len(letters),
        choice_markers=markers,
        choices=choices,
        scored_choice_count=scored_count,
        is_probable_scenario=probable,
        exclusion_reason=exclusion_reason,
        prose=text if include_prose else None,
    )


def dataclass_without_prose(obj: Any) -> dict[str, Any]:
    d = asdict(obj)
    if "prose" in d:
        d["prose"] = None
    # redacts choice previews unless private output requested
    for choice in d.get("choices", []):
        choice["text_preview"] = None
    return d


def run(
    zip_path: Path,
    output_dir: Path,
    include_prose: bool,
    include_duplicate_disks: bool,
    token_map_path: Path,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    extracted_dir = output_dir / "apple2-extracted-files"
    decoded_dir = output_dir / "decoded-files.private" if include_prose else output_dir / "decoded-files.metadata"
    extracted_dir.mkdir(parents=True, exist_ok=True)
    decoded_dir.mkdir(parents=True, exist_ok=True)

    token_map = load_token_map(token_map_path)
    images = collect_dsk_images(zip_path, include_duplicate_disks=include_duplicate_disks)
    if not images:
        raise SystemExit(f"No unique 143,360 byte .dsk images found in {zip_path}")

    disk_manifest: list[dict[str, Any]] = []
    file_manifest: list[Dos33FileEntry] = []
    all_blocks: list[EventBlock] = []
    decoded_file_records: list[dict[str, Any]] = []

    for image in images:
        disk_dir = extracted_dir / image.disk_name
        disk_dir.mkdir(parents=True, exist_ok=True)
        decoded_disk_dir = decoded_dir / image.disk_name
        decoded_disk_dir.mkdir(parents=True, exist_ok=True)
        disk_manifest.append({
            "inner_path": image.inner_path,
            "disk_name": image.disk_name,
            "sha256": image.sha256,
            "size": image.size,
            "duplicate_of_sha256": image.duplicate_of_sha256,
        })
        for file_name, ts_track, ts_sector, type_byte, catalog_length in read_catalog(image.data):
            content = extract_dos33_file(image.data, ts_track, ts_sector)
            safe_file = safe_name(file_name)
            out_path = disk_dir / safe_file
            out_path.write_bytes(content)
            decoded = decode_mind_mirror_bytes(content, token_map)
            decoded_out = decoded_disk_dir / f"{safe_file}.decoded.txt"
            decoded_out.write_text(decoded if include_prose else f"[redacted original prose]\nsha256={sha256_bytes(decoded.encode('utf-8'))}\n", encoding="utf-8")
            decoded_file_records.append({
                "disk_name": image.disk_name,
                "file_name": file_name,
                "decoded_text_sha256": sha256_bytes(decoded.encode("utf-8", errors="replace")),
                "decoded_char_length": len(decoded),
                "decoded_path": str(decoded_out.relative_to(output_dir)),
            })
            file_manifest.append(Dos33FileEntry(
                disk_name=image.disk_name,
                file_name=file_name,
                file_type_raw=type_byte,
                file_type=dos33_file_type(type_byte),
                ts_track=ts_track,
                ts_sector=ts_sector,
                catalog_length_sectors=catalog_length,
                byte_length_extracted=len(content),
                sha256=sha256_bytes(content),
                extracted_path=str(out_path.relative_to(output_dir)),
            ))
            for idx, block in enumerate(split_blocks(decoded)):
                all_blocks.append(build_event_block(image, file_name, idx, block, include_prose))

    unique_text_hashes = sorted({b.text_sha256 for b in all_blocks})
    probable = [b for b in all_blocks if b.is_probable_scenario]
    probable_unique = sorted({b.text_sha256 for b in probable})
    score_mapped = [b for b in probable if b.scored_choice_count > 0]

    def count_by(items: list[EventBlock], field: str) -> dict[str, int]:
        out: dict[str, int] = {}
        for item in items:
            value = getattr(item, field)
            key = str(value) if value is not None else "unknown"
            out[key] = out.get(key, 0) + 1
        return dict(sorted(out.items()))

    stats = {
        "schema_version": "original-import-v2",
        "input_zip": str(zip_path),
        "include_prose": include_prose,
        "include_duplicate_disks": include_duplicate_disks,
        "token_map_path": str(token_map_path),
        "token_count": len(token_map),
        "disk_count": len(images),
        "dos33_file_count": len(file_manifest),
        "decoded_file_count": len(decoded_file_records),
        "block_count": len(all_blocks),
        "unique_block_text_count": len(unique_text_hashes),
        "probable_scenario_count": len(probable),
        "probable_scenario_unique_text_count": len(probable_unique),
        "score_mapped_probable_scenario_count": len(score_mapped),
        "option_marker_total": sum(b.option_marker_count for b in all_blocks),
        "numeric_option_marker_total": sum(b.numeric_choice_count for b in all_blocks),
        "letter_option_marker_total": sum(b.letter_choice_count for b in all_blocks),
        "scored_choice_total": sum(b.scored_choice_count for b in all_blocks),
        "choice_markers_seen": sorted({m for b in all_blocks for m in b.choice_markers}),
        "by_disk": count_by(all_blocks, "disk_name"),
        "by_file": count_by(all_blocks, "file_name"),
        "by_type": count_by(all_blocks, "block_type"),
        "by_realm_hint": count_by(all_blocks, "realm_hint"),
        "by_axis_row": count_by(all_blocks, "axis_row"),
        "probable_by_realm_hint": count_by(probable, "realm_hint"),
        "probable_by_axis_row": count_by(probable, "axis_row"),
    }

    (output_dir / "disk_manifest.json").write_text(json.dumps(disk_manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    (output_dir / "file_manifest.json").write_text(json.dumps([asdict(x) for x in file_manifest], indent=2, ensure_ascii=False), encoding="utf-8")
    (output_dir / "decoded_file_manifest.json").write_text(json.dumps(decoded_file_records, indent=2, ensure_ascii=False), encoding="utf-8")
    (output_dir / "event_blocks.metadata.json").write_text(json.dumps([dataclass_without_prose(x) for x in all_blocks], indent=2, ensure_ascii=False), encoding="utf-8")
    (output_dir / "event_extraction_stats_v2.json").write_text(json.dumps(stats, indent=2, ensure_ascii=False), encoding="utf-8")

    scored_index = []
    for b in probable:
        scored_index.append({
            "id": b.id,
            "disk_name": b.disk_name,
            "file_name": b.file_name,
            "block_index": b.block_index,
            "block_type": b.block_type,
            "realm_hint": b.realm_hint,
            "realm_confidence": b.realm_confidence,
            "axis_row": b.axis_row,
            "axis_row_confidence": b.axis_row_confidence,
            "title_hint": b.title_hint if include_prose else None,
            "choice_markers": b.choice_markers,
            "choices": [asdict(c) | ({"text_preview": c.text_preview} if include_prose else {"text_preview": None}) for c in b.choices],
        })
    (output_dir / "scored_event_index.private.json" if include_prose else output_dir / "scored_event_index.metadata.json").write_text(
        json.dumps(scored_index, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    if include_prose:
        (output_dir / "original-events.private.json").write_text(json.dumps([asdict(x) for x in all_blocks], indent=2, ensure_ascii=False), encoding="utf-8")

    report_lines = [
        "# Mind Mirror Apple II original import v2 report",
        "",
        f"Input ZIP: `{zip_path}`",
        f"Unique disk images processed: {len(images)}",
        f"DOS 3.3 files extracted: {len(file_manifest)}",
        f"Decoded files: {len(decoded_file_records)}",
        f"Decoded blocks/screens: {len(all_blocks)}",
        f"Unique block text hashes: {len(unique_text_hashes)}",
        f"Probable scenario/quote events: {len(probable)}",
        f"Unique probable scenario/quote events: {len(probable_unique)}",
        f"Probable scenarios with at least one score-mapped numeric choice: {len(score_mapped)}",
        f"Choice markers total: {stats['option_marker_total']}",
        f"Scored numeric choices total: {stats['scored_choice_total']}",
        "",
        "## Interpretation",
        "",
        "V2 decodes the Mind Mirror dictionary/token compression before splitting blocks. This is much better than 7-bit text scanning, but it is still not a full runtime reconstruction of the advertised 2,000/2,400 simulations.",
        "",
        "The output separates likely scenario/quote events from menus, directions, passkey screens and scoreboards. Axis-row mapping is conservative: only rows supported by previous reverse-engineering evidence are filled; unknown rows remain null.",
        "",
        "## Copyright handling",
        "",
        "Do not commit private outputs containing original prose. Commit only scripts, schemas, counts, hashes and redacted metadata.",
    ]
    (output_dir / "README_IMPORT_REPORT_V2.md").write_text("\n".join(report_lines), encoding="utf-8")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Decode and classify Mind Mirror Apple II original event blocks, v2.")
    parser.add_argument("archive", type=Path, help="Path to MindMirror4amCrack.zip or similar archive.")
    parser.add_argument("--output", type=Path, default=Path("research-output/original-import-v2"), help="Output directory, preferably gitignored.")
    parser.add_argument("--include-prose", action="store_true", help="Write private files with original prose. Do not publish or commit.")
    parser.add_argument("--include-duplicate-disks", action="store_true", help="Also process duplicate disk images such as 00playable and program disk copy.")
    parser.add_argument("--token-map", type=Path, default=DEFAULT_TOKEN_MAP_PATH, help="Path to mindmirror_token_map_full.json.")
    args = parser.parse_args(argv)
    if not args.archive.exists():
        raise SystemExit(f"Archive not found: {args.archive}")
    if not args.token_map.exists():
        raise SystemExit(f"Token map not found: {args.token_map}")
    run(args.archive, args.output, args.include_prose, args.include_duplicate_disks, args.token_map)
    print(f"Wrote v2 extraction outputs to {args.output}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
