#!/usr/bin/env python3
"""
extract_apple2_original_events.py

Private research tool for Timothy Leary's Mind Mirror Apple II disk images.

Purpose:
  - Recursively scan an uploaded/archive ZIP for Apple II DOS 3.3 .dsk images.
  - Parse DOS 3.3 catalogs.
  - Extract files from the program and Life Simulation disks.
  - Produce safe metadata by default.
  - Optionally produce a private JSON draft with original prose when the user runs
    with --include-prose in a private, gitignored research-output folder.

Important:
  Original Mind Mirror prose is copyrighted. Do not commit or publish generated
  original-events.private.json. Keep it local for reverse-engineering validation only.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import tempfile
import zipfile
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable, Iterator

DSK_SIZE = 35 * 16 * 256
PRINTABLE = set(range(32, 127)) | {9, 10, 13}


@dataclass(frozen=True)
class DiskImage:
    source_archive: str
    inner_path: str
    sha256: str
    size: int
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
class EventCandidate:
    id: str
    disk_name: str
    file_name: str
    realm_hint: str | None
    title_hint: str | None
    option_marker_count: int
    choice_digits: list[int]
    text_sha256: str
    byte_offset_hint: int | None
    prose: str | None = None


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sector(data: bytes, track: int, sector_number: int) -> bytes:
    offset = (track * 16 + sector_number) * 256
    return data[offset:offset + 256]


def strip_apple_highbit(raw: bytes) -> str:
    chars: list[str] = []
    for b in raw:
        c = b & 0x7F
        if c == 13:
            chars.append("\n")
        elif c == 10:
            chars.append("\n")
        elif c == 9:
            chars.append("\t")
        elif 32 <= c < 127:
            chars.append(chr(c))
        elif c in (4, 5, 6, 7, 8, 12, 14, 15):
            # Keep lightweight control markers visible but compact.
            chars.append(f"<{c:02X}>")
        else:
            chars.append(" ")
    text = "".join(chars)
    # Normalize whitespace without destroying screen-ish line breaks.
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def dos33_file_type(type_byte: int) -> str:
    locked = bool(type_byte & 0x80)
    t = type_byte & 0x7F
    labels = []
    mapping = [
        (0x01, "I"),
        (0x02, "A"),
        (0x04, "B"),
        (0x08, "S"),
        (0x10, "R"),
        (0x20, "a"),
        (0x40, "b"),
    ]
    for bit, label in mapping:
        if t & bit:
            labels.append(label)
    if not labels:
        labels.append("T" if t == 0 else "?")
    return ("*" if locked else "") + "+".join(labels)


def apple_filename(raw: bytes) -> str:
    return "".join(chr(b & 0x7F) for b in raw).rstrip()


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
    """Yield all files from zip, recursively entering nested zip files."""
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


def collect_dsk_images(zip_path: Path) -> list[DiskImage]:
    images: list[DiskImage] = []
    for inner_path, data in iter_zip_payloads(zip_path):
        if inner_path.lower().endswith(".dsk") and len(data) == DSK_SIZE:
            images.append(DiskImage(
                source_archive=str(zip_path),
                inner_path=inner_path,
                sha256=sha256_bytes(data),
                size=len(data),
                data=data,
            ))
    return images


def safe_name(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_.!-]+", "_", value).strip("_")
    return value or "unnamed"


def infer_realm_hint(file_name: str, text: str) -> str | None:
    t = f"{file_name}\n{text}".upper()
    if "BIO-ENERGY" in t or "FILE1" in file_name.upper():
        return "bio_energy"
    if "EMOTIONAL INSIGHT" in t or "FILE2" in file_name.upper():
        return "emotional_insight"
    if "MENTAL ABILITIES" in t or "FILE3" in file_name.upper():
        return "mental_abilities"
    if "SOCIAL INTERACTION" in t or "FILE4" in file_name.upper():
        return "social_interaction"
    return None


def extract_title_hint(text: str) -> str | None:
    lines = [line.strip(" .\t") for line in text.splitlines()]
    for line in lines:
        if 6 <= len(line) <= 80 and sum(ch.isalpha() for ch in line) >= 5:
            if line.upper() == line or line.startswith("THE REALM") or line.startswith("LIFE"):
                return line
    return None


def option_digits(text: str) -> list[int]:
    return sorted({int(x) for x in re.findall(r"#\s*([1-8])", text)})


def split_event_candidates(disk_name: str, file_name: str, raw: bytes, include_prose: bool) -> list[EventCandidate]:
    text = strip_apple_highbit(raw)
    # Many screens are separated by @ or visible control markers. This is a draft splitter;
    # exact event recovery requires reverse-engineering the original runtime loader.
    chunks = re.split(r"(?:\n\s*@\s*\n|\n\s*@\s*|<04>|<05>)", text)
    candidates: list[EventCandidate] = []
    for idx, chunk in enumerate(chunks):
        chunk = chunk.strip()
        digits = option_digits(chunk)
        if not digits:
            continue
        if len(chunk) < 20:
            continue
        candidate_id = f"{safe_name(Path(disk_name).stem)}__{safe_name(file_name)}__{idx:04d}"
        candidates.append(EventCandidate(
            id=candidate_id,
            disk_name=disk_name,
            file_name=file_name,
            realm_hint=infer_realm_hint(file_name, chunk),
            title_hint=extract_title_hint(chunk),
            option_marker_count=len(re.findall(r"#\s*[1-8]", chunk)),
            choice_digits=digits,
            text_sha256=sha256_bytes(chunk.encode("utf-8", errors="replace")),
            byte_offset_hint=None,
            prose=chunk if include_prose else None,
        ))
    return candidates


def run(zip_path: Path, output_dir: Path, include_prose: bool) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    extracted_dir = output_dir / "apple2-extracted-files"
    extracted_dir.mkdir(parents=True, exist_ok=True)

    images = collect_dsk_images(zip_path)
    if not images:
        raise SystemExit(f"No 143,360 byte .dsk images found in {zip_path}")

    disk_manifest = []
    file_manifest: list[Dos33FileEntry] = []
    all_candidates: list[EventCandidate] = []

    for image in images:
        disk_name = safe_name(Path(image.inner_path).stem)
        disk_dir = extracted_dir / disk_name
        disk_dir.mkdir(parents=True, exist_ok=True)
        disk_manifest.append({
            "inner_path": image.inner_path,
            "sha256": image.sha256,
            "size": image.size,
            "disk_name": disk_name,
        })
        for file_name, ts_track, ts_sector, type_byte, catalog_length in read_catalog(image.data):
            content = extract_dos33_file(image.data, ts_track, ts_sector)
            out_name = safe_name(file_name)
            out_path = disk_dir / out_name
            out_path.write_bytes(content)
            file_record = Dos33FileEntry(
                disk_name=disk_name,
                file_name=file_name,
                file_type_raw=type_byte,
                file_type=dos33_file_type(type_byte),
                ts_track=ts_track,
                ts_sector=ts_sector,
                catalog_length_sectors=catalog_length,
                byte_length_extracted=len(content),
                sha256=sha256_bytes(content),
                extracted_path=str(out_path.relative_to(output_dir)),
            )
            file_manifest.append(file_record)
            all_candidates.extend(split_event_candidates(disk_name, file_name, content, include_prose))

    stats = {
        "input_zip": str(zip_path),
        "include_prose": include_prose,
        "disk_count": len(images),
        "dos33_file_count": len(file_manifest),
        "event_candidate_count": len(all_candidates),
        "event_candidates_with_realm_hint": sum(1 for c in all_candidates if c.realm_hint),
        "option_marker_total": sum(c.option_marker_count for c in all_candidates),
        "choice_digits_seen": sorted({d for c in all_candidates for d in c.choice_digits}),
        "by_realm_hint": {},
        "by_disk": {},
    }
    for candidate in all_candidates:
        stats["by_disk"][candidate.disk_name] = stats["by_disk"].get(candidate.disk_name, 0) + 1
        key = candidate.realm_hint or "unknown"
        stats["by_realm_hint"][key] = stats["by_realm_hint"].get(key, 0) + 1

    (output_dir / "disk_manifest.json").write_text(json.dumps(disk_manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    (output_dir / "file_manifest.json").write_text(json.dumps([asdict(x) for x in file_manifest], indent=2, ensure_ascii=False), encoding="utf-8")
    (output_dir / "event_candidates.metadata.json").write_text(json.dumps([asdict(x) | {"prose": None} for x in all_candidates], indent=2, ensure_ascii=False), encoding="utf-8")
    (output_dir / "event_extraction_stats.json").write_text(json.dumps(stats, indent=2, ensure_ascii=False), encoding="utf-8")

    if include_prose:
        private_path = output_dir / "original-events.private.json"
        private_path.write_text(json.dumps([asdict(x) for x in all_candidates], indent=2, ensure_ascii=False), encoding="utf-8")

    report = [
        "# Mind Mirror Apple II original import report",
        "",
        f"Input ZIP: `{zip_path}`",
        f"Disk images found: {len(images)}",
        f"DOS 3.3 files extracted: {len(file_manifest)}",
        f"Event candidates found by draft parser: {len(all_candidates)}",
        f"Option markers total: {stats['option_marker_total']}",
        f"Choice digits seen: {stats['choice_digits_seen']}",
        "",
        "## Important limitation",
        "",
        "This is a static, draft extractor. It does not yet prove that candidates equal the original marketing/manual counts of 2,000/2,400 events.",
        "The exact original runtime may combine compact text fragments, random branches, passkey/home-zone logic, and scored outcomes.",
        "",
        "## Copyright handling",
        "",
        "Default output is metadata only. Use `--include-prose` only in a private local research-output folder and never commit generated original prose.",
    ]
    (output_dir / "README_IMPORT_REPORT.md").write_text("\n".join(report), encoding="utf-8")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Extract Mind Mirror Apple II DOS 3.3 disk metadata and event candidates.")
    parser.add_argument("archive", type=Path, help="Path to MindMirror4amCrack.zip or similar archive.")
    parser.add_argument("--output", type=Path, default=Path("research-output/original-import"), help="Output directory, preferably gitignored.")
    parser.add_argument("--include-prose", action="store_true", help="Write original-events.private.json with copyrighted original prose. Do not publish.")
    args = parser.parse_args(argv)

    run(args.archive, args.output, args.include_prose)
    print(f"Wrote extraction outputs to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
