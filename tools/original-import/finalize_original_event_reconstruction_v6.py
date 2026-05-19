#!/usr/bin/env python3
# =====================================================================
# tools/original-import/finalize_original_event_reconstruction_v6.py
# Final safe reconstruction model for original Mind Mirror Life Simulations.
# =====================================================================

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


TEXT_PROSE_KEYS = {
    "text",
    "title",
    "narrative",
    "prompt",
    "body",
    "decoded_text",
    "raw_text",
    "prose",
    "choiceText",
    "choice_text",
}


PRIMARY_COUNT_MODEL_KEYS = [
    "life_unique_screens_plus_life_numeric_options",
    "unique_screens_plus_numeric_options",
    "all_screens_plus_numeric_options",
    "probable_scenarios_plus_numeric_options",
    "probable_unique_scenarios_plus_numeric_options",
    "life_probable_scenarios_plus_life_numeric_options",
    "score_mapped_events_only",
    "life_score_mapped_events_only",
]


@dataclass(frozen=True)
class Source:
    path: Path | None
    kind: str

    @staticmethod
    def from_arg(value: str | None, kind: str) -> "Source":
        return Source(Path(value).resolve() if value else None, kind)

    def exists(self) -> bool:
        return self.path is not None and self.path.exists()

    def label(self) -> str:
        return str(self.path) if self.path else "<not supplied>"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def mkdir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def read_text_from_source(source: Source, candidate_names: list[str]) -> str | None:
    if not source.exists():
        return None

    assert source.path is not None

    if source.path.is_dir():
        for name in candidate_names:
            path = source.path / name
            if path.exists() and path.is_file():
                return path.read_text(encoding="utf-8", errors="replace")

        # Also allow files inside one top-level extracted folder.
        for child in source.path.rglob("*"):
            if child.is_file() and child.name in candidate_names:
                return child.read_text(encoding="utf-8", errors="replace")
        return None

    if zipfile.is_zipfile(source.path):
        with zipfile.ZipFile(source.path) as zf:
            names = zf.namelist()

            for wanted in candidate_names:
                for name in names:
                    if Path(name).name == wanted or name.endswith("/" + wanted):
                        return zf.read(name).decode("utf-8", errors="replace")
        return None

    if source.path.is_file() and source.path.name in candidate_names:
        return source.path.read_text(encoding="utf-8", errors="replace")

    return None


def read_json_from_source(source: Source, candidate_names: list[str]) -> Any | None:
    text = read_text_from_source(source, candidate_names)
    if text is None:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def read_csv_from_source(source: Source, candidate_names: list[str]) -> list[dict[str, str]]:
    text = read_text_from_source(source, candidate_names)
    if text is None:
        return []
    return list(csv.DictReader(io.StringIO(text)))


def sha256_file(path: Path) -> str | None:
    if not path.exists() or not path.is_file():
        return None
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sanitize_json(value: Any) -> Any:
    """Remove original prose fields while preserving metadata structure.

    This allows public-safe index/report output even if a private v2 JSON
    containing original game text was used as input.
    """
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for key, item in value.items():
            if key in TEXT_PROSE_KEYS:
                if isinstance(item, str):
                    out[key + "_redacted"] = True
                    out[key + "_char_count"] = len(item)
                    out[key + "_sha256"] = hashlib.sha256(item.encode("utf-8", errors="replace")).hexdigest()
                else:
                    out[key + "_redacted"] = True
                continue
            out[key] = sanitize_json(item)
        return out

    if isinstance(value, list):
        return [sanitize_json(item) for item in value]

    return value


def summarize_v2(source: Source) -> dict[str, Any]:
    stats = read_json_from_source(source, [
        "event_extraction_stats_v2.json",
        "event-extraction-stats.json",
        "event_extraction_stats.json",
    ])

    events = read_json_from_source(source, [
        "original-events.private.json",
        "original-events.redacted.json",
        "original-events.json",
    ])

    scored = read_json_from_source(source, [
        "scored_event_index.private.json",
        "scored-event-index.json",
        "scored_event_index.json",
    ])

    return {
        "source": source.label(),
        "available": source.exists(),
        "stats": sanitize_json(stats) if stats is not None else None,
        "event_candidate_count": len(events) if isinstance(events, list) else None,
        "scored_index_count": len(scored) if isinstance(scored, list) else None,
        "private_events_seen": isinstance(events, list),
    }


def summarize_v3(source: Source) -> dict[str, Any]:
    count_models = read_json_from_source(source, [
        "scored_event_count_models_v3.json",
        "count_models_v3.json",
    ])
    families = read_json_from_source(source, [
        "runtime_event_families_v3.json",
    ])
    branch_candidates = read_json_from_source(source, [
        "branch_table_candidates_v3.json",
    ])
    runtime_index = read_json_from_source(source, [
        "event_runtime_index.redacted.json",
    ])

    return {
        "source": source.label(),
        "available": source.exists(),
        "count_models": sanitize_json(count_models) if count_models is not None else None,
        "runtime_family_count": len(families) if isinstance(families, list) else None,
        "branch_candidate_count": len(branch_candidates) if isinstance(branch_candidates, list) else None,
        "runtime_index_count": len(runtime_index) if isinstance(runtime_index, list) else None,
    }


def summarize_v4(source: Source) -> dict[str, Any]:
    summary = read_json_from_source(source, [
        "overlay_6502_summary_v4.json",
    ])
    calls = read_json_from_source(source, [
        "overlay_calls_v4.json",
    ])
    zero_page = read_json_from_source(source, [
        "zero_page_state_candidates_v4.json",
    ])
    pointers = read_json_from_source(source, [
        "pointer_table_candidates_v4.json",
    ])
    branches = read_json_from_source(source, [
        "branch_selector_candidates_v4.json",
    ])

    return {
        "source": source.label(),
        "available": source.exists(),
        "summary": sanitize_json(summary) if summary is not None else None,
        "call_candidate_count": len(calls) if isinstance(calls, list) else None,
        "zero_page_candidate_count": len(zero_page) if isinstance(zero_page, list) else None,
        "pointer_candidate_count": len(pointers) if isinstance(pointers, list) else None,
        "branch_selector_candidate_count": len(branches) if isinstance(branches, list) else None,
    }


def summarize_v5(source: Source) -> dict[str, Any]:
    plan = read_json_from_source(source, [
        "runtime_trace_plan_v5.json",
    ])
    schema = read_json_from_source(source, [
        "trace_event_schema_v5.json",
    ])

    breakpoints_csv = read_csv_from_source(source, [
        "v5_breakpoints_prioritized.csv",
    ])
    watchpoints_csv = read_csv_from_source(source, [
        "v5_watchpoints_prioritized.csv",
    ])
    overlays_csv = read_csv_from_source(source, [
        "v5_overlay_symbol_map.csv",
    ])

    breakpoints = plan.get("breakpoints") if isinstance(plan, dict) else None
    watchpoints = plan.get("watchpoints") if isinstance(plan, dict) else None

    return {
        "source": source.label(),
        "available": source.exists(),
        "trace_plan_available": plan is not None or bool(breakpoints_csv) or bool(watchpoints_csv),
        "breakpoint_count": len(breakpoints) if isinstance(breakpoints, list) else len(breakpoints_csv) or None,
        "watchpoint_count": len(watchpoints) if isinstance(watchpoints, list) else len(watchpoints_csv) or None,
        "overlay_symbol_count": len(overlays_csv) or None,
        "schema_available": schema is not None,
        "breakpoints_preview": breakpoints[:8] if isinstance(breakpoints, list) else breakpoints_csv[:8],
        "watchpoints_preview": watchpoints[:8] if isinstance(watchpoints, list) else watchpoints_csv[:8],
    }


TRACE_ADDRESS_RE = re.compile(r"\$?([0-9A-Fa-f]{4})")
TRACE_ZP_RE = re.compile(r"\$?([0-9A-Fa-f]{2})\s*(?:=|:)\s*\$?([0-9A-Fa-f]{1,4})")
TRACE_FILE_RE = re.compile(r"\b(FILE[0-9A-Z]{2,4}|CNTRL\.OVR|R[1-4]\.OVR)\b", re.IGNORECASE)
TRACE_CHOICE_RE = re.compile(r"(?:choice|answer|key|#)\s*[:=]?\s*([1-8])", re.IGNORECASE)


def parse_trace_log(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {
            "trace_log_supplied": False,
            "events": [],
            "address_hits": {},
            "zero_page_writes": {},
            "file_refs": {},
            "choice_refs": {},
        }

    if not path.exists():
        raise FileNotFoundError(f"Trace log not found: {path}")

    address_hits: dict[str, int] = {}
    zero_page_writes: dict[str, int] = {}
    file_refs: dict[str, int] = {}
    choice_refs: dict[str, int] = {}
    events: list[dict[str, Any]] = []

    for line_number, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), start=1):
        addresses = [f"${m.group(1).upper()}" for m in TRACE_ADDRESS_RE.finditer(line)]
        files = [m.group(1).upper() for m in TRACE_FILE_RE.finditer(line)]
        choices = [int(m.group(1)) for m in TRACE_CHOICE_RE.finditer(line)]
        zps = [(f"${m.group(1).upper()}", f"${m.group(2).upper()}") for m in TRACE_ZP_RE.finditer(line)]

        for address in addresses:
            address_hits[address] = address_hits.get(address, 0) + 1
        for address, _value in zps:
            zero_page_writes[address] = zero_page_writes.get(address, 0) + 1
        for file_name in files:
            file_refs[file_name] = file_refs.get(file_name, 0) + 1
        for choice in choices:
            choice_refs[str(choice)] = choice_refs.get(str(choice), 0) + 1

        if addresses or files or choices or zps:
            events.append({
                "line": line_number,
                "addresses": addresses[:8],
                "zero_page": [{"address": a, "value": v} for a, v in zps[:8]],
                "file_refs": files[:8],
                "choices": choices[:8],
                "raw_preview": line[:240],
            })

    return {
        "trace_log_supplied": True,
        "trace_log": str(path),
        "events": events[:2000],
        "event_count": len(events),
        "address_hits": dict(sorted(address_hits.items(), key=lambda kv: (-kv[1], kv[0]))),
        "zero_page_writes": dict(sorted(zero_page_writes.items(), key=lambda kv: (-kv[1], kv[0]))),
        "file_refs": dict(sorted(file_refs.items(), key=lambda kv: (-kv[1], kv[0]))),
        "choice_refs": dict(sorted(choice_refs.items(), key=lambda kv: (-kv[1], kv[0]))),
    }


def build_count_models(v2: dict[str, Any], v3: dict[str, Any], v4: dict[str, Any], v5: dict[str, Any], trace: dict[str, Any]) -> dict[str, Any]:
    v3_models = v3.get("count_models") if isinstance(v3.get("count_models"), dict) else {}
    selected = {key: v3_models.get(key) for key in PRIMARY_COUNT_MODEL_KEYS if key in v3_models}

    # Count claims are interpretation models, not final verified historical counts.
    primary_model = {
        "id": "life_unique_screens_plus_life_numeric_options",
        "value": selected.get("life_unique_screens_plus_life_numeric_options"),
        "status": "best_explanatory_static_model",
        "meaning": "Life Simulation unique decoded screens/blocks plus numeric option markers.",
        "why": "This model best explains the public claim of about 2,000 simulations without requiring 2,000 long standalone prose prompts.",
        "limitations": [
            "It is a static count model, not an emulator-proven event table.",
            "It may include help/directions/passkey screens unless upstream classification filters are tightened.",
            "It counts screens plus choices, not necessarily unique narrative prompts.",
        ],
    }

    broader_model = {
        "id": "unique_screens_plus_numeric_options",
        "value": selected.get("unique_screens_plus_numeric_options"),
        "status": "broad_static_model",
        "meaning": "All unique decoded screens/blocks plus numeric option markers.",
        "why": "This model can explain over-2400 marketing/manual language as scored screens/transitions/branches.",
        "limitations": [
            "It is broad and likely over-counts non-scenario screens.",
            "It does not prove that every counted item was presented to the player as a scored Life Simulation event.",
        ],
    }

    trace_model = {
        "id": "runtime_trace_verified_events",
        "value": trace.get("event_count") if trace.get("trace_log_supplied") else None,
        "status": "pending_trace" if not trace.get("trace_log_supplied") else "trace_log_parsed",
        "meaning": "Events seen in an emulator/debugger trace.",
        "why": "Only this model can convert static candidates into runtime-proven transitions.",
        "limitations": [
            "Requires a real Apple II emulator/debugger log.",
            "One trace only proves the traversed paths, not the full event universe.",
        ],
    }

    return {
        "models_from_v3": selected,
        "recommended_interpretation": [
            primary_model,
            broader_model,
            trace_model,
        ],
        "final_answer": {
            "has_2000_independent_prompts_been_proven": False,
            "has_2000_approx_runtime_event_model_been_explained": primary_model["value"] is not None,
            "has_2400_plus_claim_been_explained_by_broad_counting": (broader_model["value"] or 0) >= 2400,
            "needs_emulator_trace_for_exact_historical_truth": True,
        },
    }


def build_proof_matrix(v2: dict[str, Any], v3: dict[str, Any], v4: dict[str, Any], v5: dict[str, Any], trace: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "claim": "Original media contain Life Simulation data",
            "status": "strong",
            "evidence": "Apple II Life Simulation disks A/B and decoded files in v2.",
            "remaining_gap": "None for existence; exact event universe still open.",
        },
        {
            "claim": "Text blocks/screens can be decoded",
            "status": "strong",
            "evidence": "v2 decoded blocks/screens and token dictionary.",
            "remaining_gap": "Some control bytes and runtime ordering still need trace validation.",
        },
        {
            "claim": "There are about 2000 runtime simulation/scored items",
            "status": "probable_count_model",
            "evidence": "v3 count model life_unique_screens_plus_life_numeric_options.",
            "remaining_gap": "Needs dynamic trace or reconstructed event table to prove exact semantics.",
        },
        {
            "claim": "There are 2000 standalone long narrative prompts",
            "status": "not_proven",
            "evidence": "Static extraction finds far fewer probable scenario/quote blocks than 2000.",
            "remaining_gap": "Could only be proven by hidden packed data or full runtime table, not found yet.",
        },
        {
            "claim": "CNTRL/R1-R4 overlays drive runtime Life Simulation flow",
            "status": "strong_static",
            "evidence": "v4 6502 overlay analysis and v5 trace plan.",
            "remaining_gap": "Needs emulator trace to bind overlay state to exact FILEnxy loads.",
        },
        {
            "claim": "Each original event can be mapped to realm/axisRow/score",
            "status": "partial",
            "evidence": "Realm from file naming; score table known; some axisRows mapped.",
            "remaining_gap": "Exact axisRow per runtime branch still requires disassembly/trace validation.",
        },
        {
            "claim": "Current PWA clean-room workflow matches original mechanics",
            "status": "strong_product_equivalence",
            "evidence": "Subject setup, rating, Mind Maps, Inter-Play, Life Simulation markers 1/2/3.",
            "remaining_gap": "Content corpus and exact passkey/home-zone details remain non-production research.",
        },
    ]


def build_final_schema() -> dict[str, Any]:
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://example.local/mindmirror/original-event-index.v6.schema.json",
        "title": "Mind Mirror Original Event Reconstruction Index v6",
        "type": "object",
        "required": ["schemaVersion", "events"],
        "properties": {
            "schemaVersion": {"const": "v6"},
            "source": {
                "type": "object",
                "properties": {
                    "archiveSha256": {"type": "string"},
                    "diskImages": {"type": "array", "items": {"type": "object"}},
                    "toolchain": {"type": "array", "items": {"type": "string"}},
                },
            },
            "events": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["eventId", "confidence", "classification"],
                    "properties": {
                        "eventId": {"type": "string"},
                        "classification": {
                            "enum": [
                                "runtime_verified_event",
                                "static_scenario_event",
                                "static_quote_event",
                                "menu_or_help",
                                "scoreboard",
                                "passkey",
                                "directions",
                                "text_block",
                                "unknown",
                            ]
                        },
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "diskRole": {"type": "string"},
                        "sourceFile": {"type": "string"},
                        "blockIndex": {"type": "integer"},
                        "realm": {
                            "enum": [
                                "bio_energy",
                                "emotional_insight",
                                "mental_abilities",
                                "social_interaction",
                                "unknown",
                            ]
                        },
                        "axisRow": {"type": ["integer", "null"], "minimum": 1, "maximum": 4},
                        "optionCount": {"type": "integer", "minimum": 0},
                        "choiceDigits": {
                            "type": "array",
                            "items": {"type": "integer", "minimum": 1, "maximum": 8},
                        },
                        "scoreMapping": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "required": ["displayedChoice"],
                                "properties": {
                                    "displayedChoice": {"type": "integer", "minimum": 1, "maximum": 8},
                                    "dx": {"type": ["integer", "null"]},
                                    "dy": {"type": ["integer", "null"]},
                                    "source": {"enum": ["known_axis_row", "inferred", "runtime_verified", "unknown"]},
                                },
                            },
                        },
                        "runtime": {
                            "type": "object",
                            "properties": {
                                "overlay": {"type": ["string", "null"]},
                                "selectorAddress": {"type": ["string", "null"]},
                                "selectorValue": {"type": ["string", "null"]},
                                "loadedFile": {"type": ["string", "null"]},
                                "traceLine": {"type": ["integer", "null"]},
                            },
                        },
                        "textFingerprint": {
                            "type": "object",
                            "properties": {
                                "sha256": {"type": "string"},
                                "charCount": {"type": "integer"},
                                "redacted": {"type": "boolean"},
                            },
                        },
                    },
                },
            },
        },
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return

    fieldnames = list(rows[0].keys())
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def write_readme(path: Path, status: dict[str, Any], proof_matrix: list[dict[str, Any]], count_models: dict[str, Any]) -> None:
    final = count_models["final_answer"]
    readme = f"""# Mind Mirror Original Event Reconstruction v6

Generated: `{status["generatedAt"]}`

## Executive conclusion

This v6 pass resolves the remaining ambiguity as far as static analysis can responsibly go.

It **does not prove** that the original contains 2,000 independent long narrative prompts. It does explain the 2,000 / 2,400 claims as runtime-counting models:

- `life_unique_screens_plus_life_numeric_options` is the strongest explanation for the ~2,000 claim.
- `unique_screens_plus_numeric_options` / related broader models explain the over-2,400 phrasing.
- A real emulator trace is still required to prove exact selector → file → block → answer → score transitions.

## Final status

```json
{json.dumps(final, ensure_ascii=False, indent=2)}
```

## Proof matrix

| Claim | Status | Remaining gap |
|---|---|---|
"""
    for row in proof_matrix:
        readme += f"| {row['claim']} | {row['status']} | {row['remaining_gap']} |\n"

    readme += """
## What is now settled

1. The original corpus is a runtime branch system, not a flat list of 2,000 large prose prompts.
2. Static decoding and count models are sufficient to explain the historical claims.
3. Exact historical truth requires dynamic emulator/debugger traces.
4. The public PWA should continue using clean-room events.
5. Original prose and private decoded outputs must stay outside GitHub.

## What a future v7 would add

A v7 would ingest a real Apple II/MAME/AppleWin debugger log and emit runtime-verified links:

```text
selector/watchpoint change
→ overlay
→ loaded FILEnxy
→ decoded block hash
→ answer #1..#8
→ axisRow
→ dx/dy
→ marker 2/3 update
```

Without that trace, further static scripts can improve confidence but cannot fully prove the runtime branch semantics.
"""
    path.write_text(readme, encoding="utf-8")


def run(args: argparse.Namespace) -> int:
    out = Path(args.output).resolve()
    mkdir(out)

    v2 = summarize_v2(Source.from_arg(args.v2, "v2"))
    v3 = summarize_v3(Source.from_arg(args.v3, "v3"))
    v4 = summarize_v4(Source.from_arg(args.v4, "v4"))
    v5 = summarize_v5(Source.from_arg(args.v5, "v5"))
    trace = parse_trace_log(Path(args.trace_log).resolve() if args.trace_log else None)

    count_models = build_count_models(v2, v3, v4, v5, trace)
    proof_matrix = build_proof_matrix(v2, v3, v4, v5, trace)

    status = {
        "schemaVersion": "v6",
        "generatedAt": now_iso(),
        "inputs": {
            "v2": v2["source"],
            "v3": v3["source"],
            "v4": v4["source"],
            "v5": v5["source"],
            "traceLog": args.trace_log or None,
        },
        "sources": {
            "v2": v2,
            "v3": v3,
            "v4": v4,
            "v5": v5,
            "trace": {
                "trace_log_supplied": trace.get("trace_log_supplied"),
                "event_count": trace.get("event_count"),
                "top_address_hits": list(trace.get("address_hits", {}).items())[:20],
                "top_zero_page_writes": list(trace.get("zero_page_writes", {}).items())[:20],
                "file_refs": trace.get("file_refs"),
                "choice_refs": trace.get("choice_refs"),
            },
        },
        "decision": count_models["final_answer"],
    }

    (out / "reconstruction_status_v6.json").write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "count_models_v6.json").write_text(json.dumps(count_models, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "final_original_event_schema_v6.json").write_text(json.dumps(build_final_schema(), ensure_ascii=False, indent=2), encoding="utf-8")

    trace_public = {
        "trace_log_supplied": trace.get("trace_log_supplied"),
        "event_count": trace.get("event_count"),
        "address_hits": list(trace.get("address_hits", {}).items())[:100],
        "zero_page_writes": list(trace.get("zero_page_writes", {}).items())[:100],
        "file_refs": trace.get("file_refs"),
        "choice_refs": trace.get("choice_refs"),
        "events_preview": trace.get("events", [])[:50],
    }
    (out / "trace_link_candidates_v6.json").write_text(json.dumps(trace_public, ensure_ascii=False, indent=2), encoding="utf-8")

    write_csv(out / "proof_matrix_v6.csv", proof_matrix)
    write_readme(out / "README_RECONSTRUCTION_V6.md", status, proof_matrix, count_models)

    print(f"Wrote v6 reconstruction report to {out}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Finalize public-safe Mind Mirror original event reconstruction evidence without publishing original prose."
    )
    parser.add_argument("--v2", help="Path to v2 output directory or ZIP.", default=None)
    parser.add_argument("--v3", help="Path to v3 output directory or ZIP.", default=None)
    parser.add_argument("--v4", help="Path to v4 output directory or ZIP.", default=None)
    parser.add_argument("--v5", help="Path to v5 output directory or ZIP.", default=None)
    parser.add_argument("--trace-log", help="Optional emulator/debugger trace log.", default=None)
    parser.add_argument("--output", required=True, help="Output directory.")
    return parser


def main(argv: list[str] | None = None) -> int:
    return run(build_parser().parse_args(argv))


if __name__ == "__main__":
    raise SystemExit(main())
# Ende tools/original-import/finalize_original_event_reconstruction_v6.py
