#!/usr/bin/env python3
# =====================================================================
# tools/original-import/analyze_runtime_tables_v3.py
# Runtime / branch table analysis for private Mind Mirror Apple II import
# =====================================================================
"""
Mind Mirror original import v3.

This tool intentionally does NOT publish original Life Simulation prose.

Input:
  - a v2 private output directory, or
  - a ZIP containing a v2 private output directory.

Expected v2 files:
  event_blocks.metadata.json
  event_extraction_stats_v2.json
  file_manifest.json
  disk_manifest.json
  apple2-extracted-files/**

Output:
  README_RUNTIME_TABLES_V3.md
  runtime_table_analysis_v3.json
  runtime_event_families_v3.json
  branch_table_candidates_v3.json
  event_runtime_index.redacted.json
  scored_event_count_models_v3.json

The purpose of v3 is not to "find more text" but to infer how runtime
event families, branch families, option markers and file groups might
combine into the advertised 2,000/2,400 scored events.

Copyright note:
  The output is metadata-only. Do not add original prose to this script.
"""

from __future__ import annotations

import argparse
import collections
import contextlib
import hashlib
import json
import math
import os
import re
import shutil
import statistics
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Any


REALM_BY_NUMBER = {
    "1": "bio_energy",
    "2": "emotional_insight",
    "3": "mental_abilities",
    "4": "social_interaction",
}

LIFE_DISK_NAME_MARKERS = (
    "life_simulation_A",
    "life_simulation_B",
    "life_simulation_A".lower(),
    "life_simulation_B".lower(),
)

CONTROL_MARKERS = {
    0x04: "EOT/page-option separator",
    0x10: "screen/text marker",
    0x14: "title/scenario marker",
    0x15: "paragraph/control marker",
    0x1D: "heading/control marker",
    0x7F: "rubout/control marker",
    0x91: "dictionary token ending in option marker",
    0x98: "dictionary token option marker",
    0x9A: "dictionary/title-like token",
}

OPTION_MARKER_BYTES = (0x91, 0x98)
NUMERIC_CHOICE_BYTES = set(range(ord("1"), ord("9")))

FILE_FAMILY_RE = re.compile(r"^FILE(?P<realm>[1-4])(?P<zone>[0-9])(?P<suffix>[A-Z]?)$")
FILE_INTRO_RE = re.compile(r"^FILE(?P<realm>[1-4])00$")
REALM_OVERLAY_RE = re.compile(r"^R(?P<realm>[1-4])\.OVR$")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


@contextlib.contextmanager
def materialize_input(input_path: Path):
    """
    Yield a directory containing v2 output.

    The input may be:
      - a directory with event_blocks.metadata.json;
      - a directory containing one child with event_blocks.metadata.json;
      - a ZIP containing such a directory.
    """
    input_path = input_path.resolve()

    if input_path.is_dir():
        yield find_v2_root(input_path)
        return

    if not input_path.is_file():
        raise FileNotFoundError(f"Input path does not exist: {input_path}")

    tmp_dir = Path(tempfile.mkdtemp(prefix="mindmirror-v3-input-"))
    try:
        with zipfile.ZipFile(input_path) as zf:
            zf.extractall(tmp_dir)
        yield find_v2_root(tmp_dir)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def find_v2_root(base: Path) -> Path:
    direct = base / "event_blocks.metadata.json"
    if direct.is_file():
        return base

    candidates = list(base.rglob("event_blocks.metadata.json"))
    if not candidates:
        raise FileNotFoundError(
            "Could not find event_blocks.metadata.json. "
            "Run extract_apple2_original_events_v2.py first."
        )

    # Prefer shortest path: root of the extracted package.
    candidates.sort(key=lambda p: len(p.parts))
    return candidates[0].parent


def normalized_path(path_value: str) -> str:
    return path_value.replace("\\", "/").strip("/")


def is_life_disk(disk_name: str) -> bool:
    lowered = disk_name.lower()
    return "life_simulation_a" in lowered or "life_simulation_b" in lowered or "life simulation" in lowered


def classify_file_family(file_name: str) -> dict[str, Any]:
    file_name = file_name.upper()

    m_intro = FILE_INTRO_RE.match(file_name)
    if m_intro:
        realm_number = m_intro.group("realm")
        return {
            "file_role": "realm_intro_or_control",
            "realm_number": int(realm_number),
            "realm": REALM_BY_NUMBER[realm_number],
            "zone_number": 0,
            "suffix": "",
            "family_id": f"realm_{realm_number}_intro",
        }

    m = FILE_FAMILY_RE.match(file_name)
    if m:
        realm_number = m.group("realm")
        zone_number = int(m.group("zone"))
        suffix = m.group("suffix")
        return {
            "file_role": "realm_event_or_branch_file",
            "realm_number": int(realm_number),
            "realm": REALM_BY_NUMBER[realm_number],
            "zone_number": zone_number,
            "suffix": suffix,
            "family_id": f"realm_{realm_number}_zone_{zone_number}",
        }

    m_ovr = REALM_OVERLAY_RE.match(file_name)
    if m_ovr:
        realm_number = m_ovr.group("realm")
        return {
            "file_role": "realm_runtime_overlay",
            "realm_number": int(realm_number),
            "realm": REALM_BY_NUMBER[realm_number],
            "zone_number": None,
            "suffix": ".OVR",
            "family_id": f"realm_{realm_number}_overlay",
        }

    if file_name == "CNTRL.OVR":
        return {
            "file_role": "life_simulation_control_overlay",
            "realm_number": None,
            "realm": None,
            "zone_number": None,
            "suffix": ".OVR",
            "family_id": "control_overlay",
        }

    if file_name.endswith(".OVR"):
        return {
            "file_role": "generic_runtime_overlay",
            "realm_number": None,
            "realm": None,
            "zone_number": None,
            "suffix": ".OVR",
            "family_id": "generic_overlay",
        }

    return {
        "file_role": "support_or_unknown",
        "realm_number": None,
        "realm": None,
        "zone_number": None,
        "suffix": "",
        "family_id": "support_or_unknown",
    }


def raw_path_for_manifest_record(v2_root: Path, rec: dict[str, Any]) -> Path:
    rel = normalized_path(rec.get("extracted_path", ""))
    return v2_root / rel


def byte_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counts = collections.Counter(data)
    total = len(data)
    return -sum((count / total) * math.log2(count / total) for count in counts.values())


def scan_control_markers(data: bytes) -> dict[str, Any]:
    counts = {f"0x{byte:02X}": data.count(byte) for byte in CONTROL_MARKERS}

    numeric_option_offsets: list[dict[str, Any]] = []
    choice_counter: collections.Counter[str] = collections.Counter()

    for i in range(len(data) - 1):
        if data[i] in OPTION_MARKER_BYTES and data[i + 1] in NUMERIC_CHOICE_BYTES:
            choice = chr(data[i + 1])
            choice_counter[choice] += 1
            numeric_option_offsets.append({
                "offset": i,
                "marker_byte": f"0x{data[i]:02X}",
                "choice": choice,
            })

    return {
        "control_marker_counts": counts,
        "numeric_option_marker_count": len(numeric_option_offsets),
        "numeric_choice_distribution": dict(sorted(choice_counter.items())),
        # Safe: offsets and digits only, no prose.
        "numeric_option_offsets_sample": numeric_option_offsets[:32],
    }


def possible_event_start_offsets(data: bytes) -> set[int]:
    starts: set[int] = set()

    for i, b in enumerate(data):
        if b in CONTROL_MARKERS:
            starts.add(i)

    # Raw dictionary-token option marker followed by 1..8.
    for i in range(len(data) - 1):
        if data[i] in OPTION_MARKER_BYTES and data[i + 1] in NUMERIC_CHOICE_BYTES:
            starts.add(i)

    return starts


def find_pointer_run_candidates(data: bytes, *, min_run: int = 4, tolerance: int = 2) -> list[dict[str, Any]]:
    """
    Conservative scan for little-endian tables whose entries point near
    control/option markers in the same file.

    This does not prove a runtime table. It gives candidates to inspect in a
    debugger/disassembler.
    """
    targets = possible_event_start_offsets(data)

    def mapped_target(value: int) -> int | None:
        if value <= 0 or value >= len(data):
            return None
        for delta in range(-tolerance, tolerance + 1):
            target = value + delta
            if target in targets:
                return target
        return None

    hits_by_parity: dict[int, list[tuple[int, int, int]]] = {0: [], 1: []}

    for offset in range(0, max(0, len(data) - 1)):
        value = data[offset] | (data[offset + 1] << 8)
        target = mapped_target(value)
        if target is not None:
            hits_by_parity[offset % 2].append((offset, value, target))

    runs: list[dict[str, Any]] = []

    for parity, hits in hits_by_parity.items():
        hits.sort()
        current: list[tuple[int, int, int]] = []
        previous_offset: int | None = None
        previous_target: int | None = None

        for hit in hits:
            offset, value, target = hit
            continues = (
                previous_offset is not None
                and offset == previous_offset + 2
                and previous_target is not None
                and target > previous_target
            )

            if continues:
                current.append(hit)
            else:
                if len(current) >= min_run:
                    runs.append(pointer_run_to_json(parity, current))
                current = [hit]

            previous_offset = offset
            previous_target = target

        if len(current) >= min_run:
            runs.append(pointer_run_to_json(parity, current))

    runs.sort(key=lambda row: (-row["entry_count"], row["table_offset_start"]))
    return runs


def pointer_run_to_json(parity: int, run: list[tuple[int, int, int]]) -> dict[str, Any]:
    return {
        "endianness": "little",
        "alignment_parity": parity,
        "table_offset_start": run[0][0],
        "table_offset_end": run[-1][0] + 1,
        "entry_count": len(run),
        "first_target": run[0][2],
        "last_target": run[-1][2],
        "entries_sample": [
            {"table_offset": offset, "raw_value": value, "mapped_target": target}
            for offset, value, target in run[:16]
        ],
    }


def load_records(v2_root: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    event_blocks = read_json(v2_root / "event_blocks.metadata.json")
    file_manifest = read_json(v2_root / "file_manifest.json")
    stats_v2 = read_json(v2_root / "event_extraction_stats_v2.json")
    disk_manifest = read_json(v2_root / "disk_manifest.json")
    return event_blocks, file_manifest, stats_v2, disk_manifest


def summarize_by_file(event_blocks: list[dict[str, Any]]) -> dict[tuple[str, str], dict[str, Any]]:
    result: dict[tuple[str, str], dict[str, Any]] = {}

    grouped: dict[tuple[str, str], list[dict[str, Any]]] = collections.defaultdict(list)
    for block in event_blocks:
        grouped[(block["disk_name"], block["file_name"])].append(block)

    for key, blocks in grouped.items():
        type_counter = collections.Counter(block.get("block_type") for block in blocks)
        realm_counter = collections.Counter(block.get("realm_hint") for block in blocks if block.get("realm_hint"))
        axis_counter = collections.Counter(str(block.get("axis_row")) for block in blocks if block.get("axis_row"))
        result[key] = {
            "block_count": len(blocks),
            "unique_text_hash_count": len({block.get("text_sha256") for block in blocks}),
            "probable_scenario_count": sum(1 for block in blocks if block.get("is_probable_scenario")),
            "option_marker_total": sum(int(block.get("option_marker_count") or 0) for block in blocks),
            "numeric_choice_total": sum(int(block.get("numeric_choice_count") or 0) for block in blocks),
            "scored_choice_total": sum(int(block.get("scored_choice_count") or 0) for block in blocks),
            "block_types": dict(type_counter),
            "realm_hints": dict(realm_counter),
            "axis_rows": dict(axis_counter),
        }

    return result


def build_runtime_family_index(event_blocks: list[dict[str, Any]], file_manifest: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_file_summary = summarize_by_file(event_blocks)

    family_rows: dict[tuple[str, str], dict[str, Any]] = {}

    for rec in file_manifest:
        disk_name = rec["disk_name"]
        file_name = rec["file_name"]
        family = classify_file_family(file_name)
        key = (disk_name, family["family_id"])

        row = family_rows.setdefault(key, {
            "disk_name": disk_name,
            "family_id": family["family_id"],
            "file_role": family["file_role"],
            "realm_number": family["realm_number"],
            "realm": family["realm"],
            "zone_number": family["zone_number"],
            "files": [],
            "totals": {
                "file_count": 0,
                "byte_length_extracted": 0,
                "block_count": 0,
                "probable_scenario_count": 0,
                "option_marker_total": 0,
                "numeric_choice_total": 0,
                "scored_choice_total": 0,
            },
            "axis_rows": {},
            "block_types": {},
        })

        summary = by_file_summary.get((disk_name, file_name), {})
        row["files"].append({
            "file_name": file_name,
            "suffix": family["suffix"],
            "byte_length_extracted": rec.get("byte_length_extracted"),
            "catalog_length_sectors": rec.get("catalog_length_sectors"),
            "sha256": rec.get("sha256"),
            "block_count": summary.get("block_count", 0),
            "probable_scenario_count": summary.get("probable_scenario_count", 0),
            "option_marker_total": summary.get("option_marker_total", 0),
            "numeric_choice_total": summary.get("numeric_choice_total", 0),
            "scored_choice_total": summary.get("scored_choice_total", 0),
            "axis_rows": summary.get("axis_rows", {}),
            "block_types": summary.get("block_types", {}),
        })

        row["totals"]["file_count"] += 1
        row["totals"]["byte_length_extracted"] += int(rec.get("byte_length_extracted") or 0)
        for metric in ["block_count", "probable_scenario_count", "option_marker_total", "numeric_choice_total", "scored_choice_total"]:
            row["totals"][metric] += int(summary.get(metric, 0))

        row["axis_rows"] = merge_counters(row["axis_rows"], summary.get("axis_rows", {}))
        row["block_types"] = merge_counters(row["block_types"], summary.get("block_types", {}))

    rows = list(family_rows.values())
    for row in rows:
        row["files"].sort(key=lambda item: item["file_name"])

    rows.sort(key=lambda row: (
        row["disk_name"],
        row["realm_number"] if row["realm_number"] is not None else 99,
        row["zone_number"] if row["zone_number"] is not None else 99,
        row["family_id"],
    ))
    return rows


def merge_counters(a: dict[str, int], b: dict[str, int]) -> dict[str, int]:
    c = collections.Counter(a)
    c.update({str(k): int(v) for k, v in b.items()})
    return dict(sorted(c.items()))


def analyze_raw_files(v2_root: Path, file_manifest: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for rec in file_manifest:
        path = raw_path_for_manifest_record(v2_root, rec)
        if not path.is_file():
            continue

        data = path.read_bytes()
        family = classify_file_family(rec["file_name"])
        control = scan_control_markers(data)
        pointer_runs = find_pointer_run_candidates(data)

        # A compact signal for binary/runtime code. Apple II binary files often
        # use a low two-byte load address followed by 6502 opcodes.
        load_address = None
        if len(data) >= 2 and rec.get("file_type") == "B":
            load_address = data[0] | (data[1] << 8)

        rows.append({
            "disk_name": rec["disk_name"],
            "file_name": rec["file_name"],
            "file_role": family["file_role"],
            "family_id": family["family_id"],
            "realm": family["realm"],
            "zone_number": family["zone_number"],
            "byte_length_extracted": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "load_address_guess": load_address,
            "entropy_bits_per_byte": round(byte_entropy(data), 4),
            "control_marker_counts": control["control_marker_counts"],
            "numeric_option_marker_count": control["numeric_option_marker_count"],
            "numeric_choice_distribution": control["numeric_choice_distribution"],
            "numeric_option_offsets_sample": control["numeric_option_offsets_sample"],
            "pointer_run_candidate_count": len(pointer_runs),
            "pointer_run_candidates": pointer_runs[:8],
        })

    rows.sort(key=lambda row: (
        row["disk_name"],
        row["family_id"],
        row["file_name"],
    ))
    return rows


def build_branch_table_candidates(raw_rows: list[dict[str, Any]], family_index: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []

    for row in family_index:
        if row["file_role"] in {"realm_event_or_branch_file", "realm_intro_or_control"} and (
            row["totals"]["probable_scenario_count"] > 0
            or row["totals"]["option_marker_total"] > 0
        ):
            confidence = "medium"
            reasons = [
                "FILEnxy naming pattern groups events by realm/zone",
                "contains probable scenario blocks or option markers",
            ]

            if row["totals"]["scored_choice_total"] > 0:
                confidence = "high"
                reasons.append("contains score-mapped numeric choices")

            candidates.append({
                "candidate_type": "file_family_branch_group",
                "confidence": confidence,
                "disk_name": row["disk_name"],
                "family_id": row["family_id"],
                "realm": row["realm"],
                "zone_number": row["zone_number"],
                "file_names": [file["file_name"] for file in row["files"]],
                "totals": row["totals"],
                "axis_rows_seen": row["axis_rows"],
                "reasons": reasons,
            })

    for row in raw_rows:
        if row["pointer_run_candidate_count"] > 0:
            candidates.append({
                "candidate_type": "intra_file_pointer_run",
                "confidence": "low",
                "disk_name": row["disk_name"],
                "file_name": row["file_name"],
                "family_id": row["family_id"],
                "realm": row["realm"],
                "pointer_run_candidate_count": row["pointer_run_candidate_count"],
                "pointer_run_candidates": row["pointer_run_candidates"],
                "reasons": [
                    "2-byte little-endian values point near control/option markers",
                    "requires emulator/disassembler validation",
                ],
            })

    # Overlay files are runtime-control candidates even when direct pointers
    # are not found by static metadata scan.
    for row in raw_rows:
        if row["file_role"] in {"realm_runtime_overlay", "life_simulation_control_overlay"}:
            candidates.append({
                "candidate_type": "runtime_overlay",
                "confidence": "medium",
                "disk_name": row["disk_name"],
                "file_name": row["file_name"],
                "family_id": row["family_id"],
                "realm": row["realm"],
                "load_address_guess": row["load_address_guess"],
                "byte_length_extracted": row["byte_length_extracted"],
                "entropy_bits_per_byte": row["entropy_bits_per_byte"],
                "reasons": [
                    "overlay file likely controls life-simulation flow for a realm or disk",
                    "static scan should be followed by 6502 disassembly",
                ],
            })

    candidates.sort(key=lambda item: (
        item["disk_name"],
        item.get("realm") or "",
        item.get("family_id") or "",
        item["candidate_type"],
    ))
    return candidates


def build_event_runtime_index(event_blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for block in event_blocks:
        family = classify_file_family(block["file_name"])

        rows.append({
            "id": block["id"],
            "disk_name": block["disk_name"],
            "file_name": block["file_name"],
            "family_id": family["family_id"],
            "file_role": family["file_role"],
            "realm_from_filename": family["realm"],
            "realm_hint": block.get("realm_hint"),
            "realm_confidence": block.get("realm_confidence"),
            "zone_number": family["zone_number"],
            "block_index": block.get("block_index"),
            "block_type": block.get("block_type"),
            "is_probable_scenario": block.get("is_probable_scenario"),
            "exclusion_reason": block.get("exclusion_reason"),
            "axis_row": block.get("axis_row"),
            "axis_row_confidence": block.get("axis_row_confidence"),
            "title_hint_sha256": sha_text(block.get("title_hint") or ""),
            "text_sha256": block.get("text_sha256"),
            "option_marker_count": block.get("option_marker_count"),
            "numeric_choice_count": block.get("numeric_choice_count"),
            "letter_choice_count": block.get("letter_choice_count"),
            "choice_markers": block.get("choice_markers"),
            "scored_choice_count": block.get("scored_choice_count"),
            "choices_redacted": [
                {
                    "displayedChoice": choice.get("displayedChoice"),
                    "dx": choice.get("dx"),
                    "dy": choice.get("dy"),
                    "text_sha256": sha_text(choice.get("text") or ""),
                    "text_length": len(choice.get("text") or ""),
                }
                for choice in (block.get("choices") or [])
            ],
        })

    rows.sort(key=lambda row: (row["disk_name"], row["file_name"], row["block_index"]))
    return rows


def sha_text(value: str) -> str | None:
    if not value:
        return None
    return hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()


def build_count_models(event_blocks: list[dict[str, Any]], stats_v2: dict[str, Any]) -> dict[str, Any]:
    unique_texts = {block.get("text_sha256") for block in event_blocks if block.get("text_sha256")}
    life_blocks = [block for block in event_blocks if is_life_disk(block["disk_name"])]
    life_unique = {block.get("text_sha256") for block in life_blocks if block.get("text_sha256")}

    probable = [block for block in event_blocks if block.get("is_probable_scenario")]
    probable_unique = {block.get("text_sha256") for block in probable if block.get("text_sha256")}
    life_probable = [block for block in probable if is_life_disk(block["disk_name"])]
    life_probable_unique = {block.get("text_sha256") for block in life_probable if block.get("text_sha256")}

    numeric_option_total = sum(int(block.get("numeric_choice_count") or 0) for block in event_blocks)
    option_total = sum(int(block.get("option_marker_count") or 0) for block in event_blocks)
    scored_choice_total = sum(int(block.get("scored_choice_count") or 0) for block in event_blocks)

    life_numeric_option_total = sum(int(block.get("numeric_choice_count") or 0) for block in life_blocks)
    life_option_total = sum(int(block.get("option_marker_count") or 0) for block in life_blocks)
    life_scored_choice_total = sum(int(block.get("scored_choice_count") or 0) for block in life_blocks)

    models = {
        "schema_version": "runtime-table-analysis-v3",
        "important_warning": (
            "These are counting models, not proof that the game has this exact "
            "number of unique prose prompts. Runtime/emulator validation is still required."
        ),
        "source_v2_stats": {
            "block_count": stats_v2.get("block_count"),
            "unique_block_text_count": stats_v2.get("unique_block_text_count"),
            "probable_scenario_count": stats_v2.get("probable_scenario_count"),
            "option_marker_total": stats_v2.get("option_marker_total"),
            "numeric_option_marker_total": stats_v2.get("numeric_option_marker_total"),
            "scored_choice_total": stats_v2.get("scored_choice_total"),
        },
        "observed_metadata_counts": {
            "all_blocks": len(event_blocks),
            "all_unique_block_texts": len(unique_texts),
            "life_disk_blocks": len(life_blocks),
            "life_disk_unique_block_texts": len(life_unique),
            "probable_scenario_blocks": len(probable),
            "probable_scenario_unique_texts": len(probable_unique),
            "life_disk_probable_scenario_blocks": len(life_probable),
            "life_disk_probable_scenario_unique_texts": len(life_probable_unique),
            "numeric_option_total": numeric_option_total,
            "option_total": option_total,
            "scored_choice_total": scored_choice_total,
            "life_disk_numeric_option_total": life_numeric_option_total,
            "life_disk_option_total": life_option_total,
            "life_disk_scored_choice_total": life_scored_choice_total,
        },
        "hypothesis_counting_models": {
            "unique_screens_plus_numeric_options": len(unique_texts) + numeric_option_total,
            "all_screens_plus_numeric_options": len(event_blocks) + numeric_option_total,
            "life_unique_screens_plus_life_numeric_options": len(life_unique) + life_numeric_option_total,
            "probable_scenarios_plus_numeric_options": len(probable) + numeric_option_total,
            "probable_unique_scenarios_plus_numeric_options": len(probable_unique) + numeric_option_total,
            "life_probable_scenarios_plus_life_numeric_options": len(life_probable) + life_numeric_option_total,
            "score_mapped_events_only": scored_choice_total,
            "life_score_mapped_events_only": life_scored_choice_total,
        },
        "interpretation": [
            "The advertised 2000/2400 number is not reproduced as 2000 unique long prose prompts.",
            "The closest metadata-scale models combine screen/block count with option/scored transition count.",
            "This supports the hypothesis that 'scored events' may include screens, choices, branches, and replay variants rather than standalone prompts only.",
        ],
    }

    return models


def write_readme(output_dir: Path, stats: dict[str, Any], count_models: dict[str, Any], branch_candidates: list[dict[str, Any]]) -> None:
    observed = count_models["observed_metadata_counts"]
    models = count_models["hypothesis_counting_models"]

    text = f"""# Mind Mirror original import v3 — runtime / branch table analysis

This report is metadata-only. It does not contain original Life Simulation prose.

## Input summary

- v2 decoded blocks/screens: {observed["all_blocks"]}
- v2 unique block texts: {observed["all_unique_block_texts"]}
- v2 probable scenario blocks: {observed["probable_scenario_blocks"]}
- v2 probable scenario unique texts: {observed["probable_scenario_unique_texts"]}
- numeric option markers: {observed["numeric_option_total"]}
- score-mapped choices: {observed["scored_choice_total"]}

## Runtime-family findings

V3 groups Apple II files by their likely runtime naming scheme:

```text
FILE100 / FILE200 / FILE300 / FILE400    realm intro/control files
FILE11A/B, FILE12A/B, ...                realm + zone event/branch files
R1.OVR, R2.OVR, R3.OVR, R4.OVR           realm runtime overlays
CNTRL.OVR                                life simulation control overlay
```

The strongest structural finding is that Life Simulation content is not one flat text file.
It is split into realm/zone families and controlled by overlay code. Therefore the claimed
2,000/2,400 value is likely produced by runtime traversal/branching/scored transitions,
not by a simple list of 2,000 standalone text prompts.

## Branch candidates

Branch/runtime candidates found: {len(branch_candidates)}

Main candidate types:

- `file_family_branch_group`: groups like `realm_1_zone_1`, `realm_4_zone_8`
- `runtime_overlay`: `R1.OVR`..`R4.OVR`, `CNTRL.OVR`
- `intra_file_pointer_run`: low-confidence little-endian pointer candidates

## Count models

These are hypotheses, not final proof:

```json
{json.dumps(models, ensure_ascii=False, indent=2)}
```

## Current answer to the 2000/2400 question

V3 still does **not** produce a verified list of 2,000 separate prompts. It does, however,
show why the number can be plausible as a runtime/scored-event count:

- decoded screens/blocks are numerous;
- option markers are numerous;
- files are organized into realm/zone branches;
- overlay files likely orchestrate branch selection and replay variation.

## Next v4 step

The next step is emulator/disassembler validation:

1. Disassemble `CNTRL.OVR` and `R1.OVR`..`R4.OVR` as Apple II/6502 binary overlays.
2. Identify file-load calls and branch selectors.
3. Trace which `FILEnxy` groups are loaded for each realm/zone.
4. Trace random/event index selection.
5. Compare runtime-selected screens with v3 metadata IDs.
6. Produce a verified `runtime_event_table.private.json`.
"""
    (output_dir / "README_RUNTIME_TABLES_V3.md").write_text(text, encoding="utf-8")


def run(input_path: Path, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    with materialize_input(input_path) as v2_root:
        event_blocks, file_manifest, stats_v2, disk_manifest = load_records(v2_root)

        family_index = build_runtime_family_index(event_blocks, file_manifest)
        raw_file_analysis = analyze_raw_files(v2_root, file_manifest)
        branch_candidates = build_branch_table_candidates(raw_file_analysis, family_index)
        runtime_event_index = build_event_runtime_index(event_blocks)
        count_models = build_count_models(event_blocks, stats_v2)

        analysis = {
            "schema_version": "runtime-table-analysis-v3",
            "input_path": str(input_path),
            "v2_root_detected": str(v2_root),
            "disk_count": len(disk_manifest),
            "file_count": len(file_manifest),
            "event_block_count": len(event_blocks),
            "runtime_family_count": len(family_index),
            "branch_candidate_count": len(branch_candidates),
            "raw_file_analysis_count": len(raw_file_analysis),
            "count_models_summary": count_models["hypothesis_counting_models"],
            "notes": [
                "Output is metadata-only and does not contain original prose.",
                "Pointer-run candidates are low-confidence static hints.",
                "File-family branch groups are stronger structural evidence.",
            ],
        }

        write_json(output_dir / "runtime_table_analysis_v3.json", analysis)
        write_json(output_dir / "runtime_event_families_v3.json", family_index)
        write_json(output_dir / "branch_table_candidates_v3.json", branch_candidates)
        write_json(output_dir / "raw_file_control_scan_v3.json", raw_file_analysis)
        write_json(output_dir / "event_runtime_index.redacted.json", runtime_event_index)
        write_json(output_dir / "scored_event_count_models_v3.json", count_models)
        write_readme(output_dir, stats_v2, count_models, branch_candidates)

    print(f"Wrote runtime / branch table analysis to {output_dir}")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Analyze Mind Mirror v2 private import output for runtime/branch-table structure.")
    parser.add_argument("input", type=Path, help="v2 private output directory or ZIP")
    parser.add_argument("--output", type=Path, required=True, help="output directory for metadata-only v3 analysis")
    args = parser.parse_args(argv)

    run(args.input, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
