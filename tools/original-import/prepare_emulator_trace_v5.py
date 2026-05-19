#!/usr/bin/env python3
"""
Mind Mirror original-event research: v5 emulator trace preparation.

This tool does not publish original game prose. It consumes the metadata-only
v4 6502 overlay analysis and produces a reproducible emulator/debug trace plan:

  - breakpoints for overlay entry and common service routines
  - watchpoints for zero-page selector/counter candidates
  - MAME/AppleWin-style command drafts
  - a JSON trace schema
  - optional normalization of simple emulator trace logs

Input may be either:
  - a directory containing v4 JSON files, or
  - a ZIP containing those files.

Typical use:
  python tools/original-import/prepare_emulator_trace_v5.py \
    research-output/original-import-v4-6502 \
    --output research-output/original-import-v5-trace-plan

Optional trace parsing:
  python tools/original-import/prepare_emulator_trace_v5.py \
    research-output/original-import-v4-6502 \
    --output research-output/original-import-v5-trace-run \
    --trace-log /path/to/emulator-trace.log
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import textwrap
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable

V5_VERSION = "v5.0"

DEFAULT_BREAKPOINTS = [
    {"address": "$D000", "reason": "overlay entry/load base; CNTRL/R overlays load near $D000"},
    {"address": "$7E52", "reason": "common service routine candidate from v4 call frequency"},
    {"address": "$D4B4", "reason": "realm-local helper/dispatcher candidate, especially R2/R3"},
]

REQUESTED_WATCHPOINTS = [
    "$8C", "$A0", "$A8", "$5E", "$D4", "$DC", "$B3", "$05", "$A2", "$FB", "$F9", "$AC",
]

TRACE_LINE_PATTERNS = {
    # Examples:
    # PC=D000 A=00 X=12 Y=34 SP=F0
    # 00:D000 A:00 X:12 Y:34 SP:F0
    "cpu_state": re.compile(
        r"(?:PC\s*[=:]\s*\$?(?P<pc1>[0-9A-Fa-f]{4})|(?P<pc2>[0-9A-Fa-f]{2}:[0-9A-Fa-f]{4}|[0-9A-Fa-f]{4}))"
        r".*?(?:A\s*[=:]\s*\$?(?P<a>[0-9A-Fa-f]{2}))?"
        r".*?(?:X\s*[=:]\s*\$?(?P<x>[0-9A-Fa-f]{2}))?"
        r".*?(?:Y\s*[=:]\s*\$?(?P<y>[0-9A-Fa-f]{2}))?"
        r".*?(?:SP\s*[=:]\s*\$?(?P<sp>[0-9A-Fa-f]{2}))?"
    ),
    # Examples:
    # W 008C <- 12
    # WRITE $008C=$12
    # watch write 8C 12
    "mem_write": re.compile(
        r"(?i)(?:\bW\b|WRITE|WATCH\s+WRITE|MEMW).*?\$?(?P<addr>[0-9A-Fa-f]{2,4}).*?(?:<-|=|\s)\s*\$?(?P<value>[0-9A-Fa-f]{2})"
    ),
    # Examples:
    # LOAD FILE11A
    # BLOAD R1.OVR
    # loaded FILE22B
    "file_load": re.compile(r"(?i)\b(?:LOAD|BLOAD|LOADED|OPEN)\b.*?\b(?P<file>(?:FILE[0-9A-Z]{3}|R[1-4]\.OVR|CNTRL\.OVR))\b"),
    # Examples:
    # KEY 1
    # ANSWER #4
    # input=8
    "answer": re.compile(r"(?i)\b(?:KEY|ANSWER|CHOICE|INPUT)\b\s*#?\s*(?P<answer>[1-8])\b"),
    # Examples:
    # BREAK D000
    # BP $7E52
    "break": re.compile(r"(?i)\b(?:BREAK|BP|BREAKPOINT)\b.*?\$?(?P<addr>[0-9A-Fa-f]{4})\b"),
}


def read_json_from_source(source: Path, filename: str) -> Any | None:
    if source.is_dir():
        path = source / filename
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return None
    if source.is_file() and source.suffix.lower() == ".zip":
        with zipfile.ZipFile(source) as zf:
            matches = [name for name in zf.namelist() if name.endswith(filename)]
            if not matches:
                return None
            with zf.open(matches[0]) as fp:
                return json.loads(fp.read().decode("utf-8"))
    raise FileNotFoundError(f"Unsupported v4 source: {source}")


def load_v4_bundle(source: Path) -> dict[str, Any]:
    files = {
        "overlay_summary": "overlay_6502_summary_v4.json",
        "overlay_calls": "overlay_calls_v4.json",
        "zero_page": "zero_page_state_candidates_v4.json",
        "pointer_tables": "pointer_table_candidates_v4.json",
        "file_refs": "file_load_reference_candidates_v4.json",
        "branch_selectors": "branch_selector_candidates_v4.json",
        "hypotheses": "runtime_trace_hypotheses_v4.json",
        "validation": "validation_status_v4.json",
    }
    bundle: dict[str, Any] = {}
    missing = []
    for key, filename in files.items():
        data = read_json_from_source(source, filename)
        if data is None:
            missing.append(filename)
        else:
            bundle[key] = data
    if missing:
        raise FileNotFoundError("Missing required v4 files: " + ", ".join(missing))
    return bundle


def parse_hex_address(value: str) -> int:
    value = value.strip().upper().replace("$", "")
    if ":" in value:
        value = value.split(":", 1)[1]
    return int(value, 16)


def hex4(value: int) -> str:
    return f"${value & 0xFFFF:04X}"


def hex2(value: int) -> str:
    return f"${value & 0xFF:02X}"


def normalize_zp(value: str) -> str:
    return f"${parse_hex_address(value) & 0xFF:02X}"


def top_call_targets(overlay_calls: list[dict[str, Any]], limit: int = 16) -> list[dict[str, Any]]:
    counter = Counter(call.get("target") for call in overlay_calls if call.get("target"))
    out = []
    for target, count in counter.most_common(limit):
        overlays = sorted({call.get("overlay", "") for call in overlay_calls if call.get("target") == target})
        disk_roles = sorted({call.get("disk_role", "") for call in overlay_calls if call.get("target") == target})
        out.append({
            "address": target,
            "call_count": count,
            "overlay_count": len(overlays),
            "disk_roles": disk_roles,
            "reason": "high-frequency JSR/JMP target from v4 overlay_calls",
        })
    return out


def ranked_watchpoints(zero_page: list[dict[str, Any]], limit: int = 24) -> list[dict[str, Any]]:
    aggregate: dict[str, dict[str, Any]] = {}
    for item in zero_page:
        zp_raw = item.get("zp")
        if not zp_raw:
            continue
        zp = normalize_zp(str(zp_raw))
        rec = aggregate.setdefault(zp, {
            "address": zp,
            "total_refs": 0,
            "max_confidence": 0.0,
            "ops": Counter(),
            "overlays": set(),
            "disk_roles": set(),
            "requested": zp in REQUESTED_WATCHPOINTS,
        })
        rec["total_refs"] += int(item.get("total_refs", 0))
        try:
            rec["max_confidence"] = max(rec["max_confidence"], float(item.get("state_confidence", 0)))
        except Exception:
            pass
        for op, count in dict(item.get("ops", {})).items():
            rec["ops"][op] += int(count)
        if item.get("overlay"):
            rec["overlays"].add(item["overlay"])
        if item.get("disk_role"):
            rec["disk_roles"].add(item["disk_role"])

    rows = []
    for rec in aggregate.values():
        score = (1000 if rec["requested"] else 0) + rec["total_refs"] + rec["max_confidence"] * 100
        rows.append({
            "address": rec["address"],
            "watch_type": "write",
            "requested": rec["requested"],
            "total_refs": rec["total_refs"],
            "max_confidence": round(rec["max_confidence"], 3),
            "ops": dict(rec["ops"]),
            "overlay_count": len(rec["overlays"]),
            "disk_roles": sorted(rec["disk_roles"]),
            "priority_score": round(score, 3),
            "hypothesis": "zero-page runtime state / selector / counter candidate",
        })
    return sorted(rows, key=lambda r: (-r["priority_score"], r["address"]))[:limit]


def overlay_symbol_map(overlay_summary: dict[str, Any]) -> list[dict[str, Any]]:
    overlays = overlay_summary.get("overlays", [])
    out = []
    for item in overlays:
        name = item.get("name")
        role = item.get("overlay_role")
        out.append({
            "overlay_id": item.get("overlay_id"),
            "name": name,
            "disk_role": item.get("disk_role"),
            "overlay_role": role,
            "sha256": item.get("sha256"),
            "load_address": item.get("load_address_hex") or hex4(int(item.get("load_address", 0))),
            "declared_length": item.get("declared_length"),
            "code_length": item.get("code_length"),
            "trace_label": f"{item.get('disk_role','unknown')}::{name}",
        })
    return out


def build_trace_plan(bundle: dict[str, Any]) -> dict[str, Any]:
    calls = bundle["overlay_calls"]
    zps = bundle["zero_page"]
    top_targets = top_call_targets(calls)
    call_breaks = []
    seen = {bp["address"] for bp in DEFAULT_BREAKPOINTS}
    for target in top_targets:
        if target["address"] in seen:
            continue
        call_breaks.append({
            "address": target["address"],
            "reason": target["reason"],
            "call_count": target["call_count"],
            "disk_roles": target["disk_roles"],
        })
        seen.add(target["address"])
    breakpoints = DEFAULT_BREAKPOINTS + call_breaks[:10]
    watchpoints = ranked_watchpoints(zps, 24)
    return {
        "tool": "prepare_emulator_trace_v5.py",
        "version": V5_VERSION,
        "purpose": "Generate emulator/debug trace plan to validate Mind Mirror Life Simulation runtime event selection.",
        "breakpoints": breakpoints,
        "watchpoints": watchpoints,
        "top_call_targets": top_targets,
        "overlay_symbol_map": overlay_symbol_map(bundle["overlay_summary"]),
        "trace_questions": [
            "Which overlay is entered when Life Simulation starts?",
            "Which Rn.OVR is loaded for each realm?",
            "Which FILEnxy is loaded for each displayed event?",
            "Which zero-page variable changes at event selection time?",
            "Which zero-page variable changes after answer #1..#8?",
            "Where are marker 2/recent and marker 3/overall accumulated?",
            "Can axisRow be inferred from loaded FILE family or selector state?",
        ],
        "manual_test_vectors": [
            {
                "id": "realm_1_bio_energy_always_1",
                "intent": "Force strong positive/negative table edge for R1/Bio-Energy event path.",
                "actions": ["enter Life Simulation", "select or reach Bio-Energy", "answer #1 repeatedly for first 8 numeric prompts"],
                "expected_trace": ["R1.OVR entered", "FILE1xy loaded", "$8C/$A0-like selector changes", "answer=1 logged"],
            },
            {
                "id": "realm_2_emotional_alternating_1_8",
                "intent": "Observe branch selector reversal and overall/recent marker accumulation.",
                "actions": ["enter Emotional Insight path", "answer #1 then #8 alternating"],
                "expected_trace": ["R2.OVR entered", "FILE2xy loaded", "watchpoint changes around answer commit"],
            },
            {
                "id": "space_or_map_view_marker_check",
                "intent": "Correlate score commit with map marker 2/3 display update.",
                "actions": ["after several Life Simulation answers", "open Mind Map / F9-equivalent map view"],
                "expected_trace": ["marker-related state read", "recent/overall counters used for plotting"],
            },
        ],
    }


def make_mame_commands(plan: dict[str, Any]) -> str:
    lines = [
        "# Mind Mirror v5 MAME debugger command draft",
        "# Verify exact command syntax for your MAME build.",
        "# Goal: break on overlay/service routines and watch zero-page selector/counter writes.",
        "",
        "# Breakpoints",
    ]
    for bp in plan["breakpoints"]:
        addr = bp["address"].replace("$", "")
        lines.append(f"bpset {addr}  # {bp.get('reason','')}")
    lines += ["", "# Watchpoints: one byte, write", "# Some MAME versions use: wpset <addr>,<length>,<type>"]
    for wp in plan["watchpoints"]:
        addr = wp["address"].replace("$", "")
        lines.append(f"wpset {addr},1,w  # {wp.get('hypothesis','')} refs={wp.get('total_refs')}")
    lines += [
        "",
        "# Suggested session flow",
        "# 1. Start emulator with debugger enabled.",
        "# 2. Load Mind Mirror disk 1 and reach Life Simulations.",
        "# 3. Swap/attach Life Simulation disks A/B as required.",
        "# 4. Start trace logging before entering Life Simulations.",
        "# 5. Use fixed answer patterns (#1 only, #8 only, alternating #1/#8).",
        "# 6. Save the debugger log and feed it to prepare_emulator_trace_v5.py --trace-log.",
    ]
    return "\n".join(lines) + "\n"


def make_applewin_commands(plan: dict[str, Any]) -> str:
    lines = [
        "# Mind Mirror v5 AppleWin debugger checklist / command draft",
        "# AppleWin debugger command syntax differs by build; treat this as a target list.",
        "# Add breakpoints:",
    ]
    for bp in plan["breakpoints"]:
        lines.append(f"#   BP {bp['address']}    ; {bp.get('reason','')}")
    lines += ["", "# Add write watchpoints or memory watch expressions:"]
    for wp in plan["watchpoints"]:
        lines.append(f"#   WATCH WRITE {wp['address']}    ; refs={wp.get('total_refs')} {wp.get('hypothesis','')}")
    lines += [
        "",
        "# Log these fields for every breakpoint/watchpoint hit:",
        "#   cycle/frame, PC, A, X, Y, SP, flags, memory address/value, current disk, current screen text if visible",
        "# Manual run protocol:",
        "#   A. Boot program disk.",
        "#   B. Enter Life Simulations.",
        "#   C. Record which disk side is requested/loaded.",
        "#   D. Record every loaded FILEnxy / Rn.OVR / CNTRL.OVR when visible in debugger or DOS hooks.",
        "#   E. Answer deterministic patterns: all #1, all #8, alternating #1/#8.",
        "#   F. Open Mind Map and record marker 2/3 coordinates for comparison.",
    ]
    return "\n".join(lines) + "\n"


def make_trace_schema() -> dict[str, Any]:
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Mind Mirror Runtime Trace Event v5",
        "type": "object",
        "required": ["kind", "sourceLine"],
        "properties": {
            "kind": {"type": "string", "enum": ["cpu_state", "breakpoint", "watch_write", "file_load", "answer", "note"]},
            "sourceLine": {"type": "string"},
            "lineNumber": {"type": "integer"},
            "pc": {"type": ["string", "null"], "pattern": "^\\$[0-9A-F]{4}$"},
            "registers": {"type": "object"},
            "address": {"type": ["string", "null"], "pattern": "^\\$[0-9A-F]{2,4}$"},
            "value": {"type": ["string", "null"], "pattern": "^\\$[0-9A-F]{2}$"},
            "file": {"type": ["string", "null"]},
            "answer": {"type": ["integer", "null"], "minimum": 1, "maximum": 8},
            "classification": {"type": ["string", "null"]},
        },
    }


def parse_trace_log(path: Path) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for idx, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
        stripped = line.strip()
        if not stripped:
            continue
        matched = False

        m = TRACE_LINE_PATTERNS["file_load"].search(stripped)
        if m:
            events.append({"kind": "file_load", "lineNumber": idx, "sourceLine": stripped, "file": m.group("file").upper()})
            matched = True

        m = TRACE_LINE_PATTERNS["answer"].search(stripped)
        if m:
            events.append({"kind": "answer", "lineNumber": idx, "sourceLine": stripped, "answer": int(m.group("answer"))})
            matched = True

        m = TRACE_LINE_PATTERNS["mem_write"].search(stripped)
        if m:
            addr = parse_hex_address(m.group("addr"))
            value = parse_hex_address(m.group("value")) & 0xFF
            events.append({
                "kind": "watch_write",
                "lineNumber": idx,
                "sourceLine": stripped,
                "address": hex4(addr) if addr > 0xFF else hex2(addr),
                "value": hex2(value),
            })
            matched = True

        m = TRACE_LINE_PATTERNS["break"].search(stripped)
        if m:
            events.append({"kind": "breakpoint", "lineNumber": idx, "sourceLine": stripped, "pc": hex4(parse_hex_address(m.group("addr")))})
            matched = True

        m = TRACE_LINE_PATTERNS["cpu_state"].search(stripped)
        if m and (m.group("pc1") or m.group("pc2")):
            pc_raw = m.group("pc1") or m.group("pc2")
            regs = {}
            for reg in ["a", "x", "y", "sp"]:
                if m.group(reg):
                    regs[reg.upper()] = hex2(parse_hex_address(m.group(reg)))
            events.append({"kind": "cpu_state", "lineNumber": idx, "sourceLine": stripped, "pc": hex4(parse_hex_address(pc_raw)), "registers": regs})
            matched = True

        if not matched and any(tok in stripped.upper() for tok in ["D000", "7E52", "D4B4", "FILE", "OVR", "8C", "A0"]):
            events.append({"kind": "note", "lineNumber": idx, "sourceLine": stripped, "classification": "unparsed_but_interesting"})
    return events


def build_trace_summary(events: list[dict[str, Any]]) -> dict[str, Any]:
    kind_counter = Counter(e["kind"] for e in events)
    files = Counter(e.get("file") for e in events if e.get("file"))
    breakpoints = Counter(e.get("pc") for e in events if e["kind"] in {"breakpoint", "cpu_state"} and e.get("pc") in {"$D000", "$7E52", "$D4B4"})
    watches = Counter(e.get("address") for e in events if e["kind"] == "watch_write")
    answers = Counter(e.get("answer") for e in events if e["kind"] == "answer")
    return {
        "event_count": len(events),
        "by_kind": dict(kind_counter),
        "loaded_files": dict(files),
        "key_breakpoints_seen": dict(breakpoints),
        "watch_writes_by_address": dict(watches),
        "answers_seen": {str(k): v for k, v in sorted(answers.items())},
        "status": "trace_log_parsed" if events else "no_trace_events_parsed",
    }


def make_runtime_link_candidates(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates = []
    current_file = None
    recent_writes = []
    recent_pc = None
    for e in events:
        if e["kind"] == "cpu_state" and e.get("pc"):
            recent_pc = e["pc"]
        elif e["kind"] == "breakpoint" and e.get("pc"):
            recent_pc = e["pc"]
        elif e["kind"] == "file_load":
            current_file = e.get("file")
            recent_writes = []
            candidates.append({
                "kind": "file_context_started",
                "lineNumber": e["lineNumber"],
                "file": current_file,
                "pc": recent_pc,
            })
        elif e["kind"] == "watch_write":
            recent_writes.append(e)
            recent_writes = recent_writes[-10:]
        elif e["kind"] == "answer":
            candidates.append({
                "kind": "answer_context",
                "lineNumber": e["lineNumber"],
                "answer": e.get("answer"),
                "current_file": current_file,
                "recent_pc": recent_pc,
                "recent_watch_writes": [
                    {"address": w.get("address"), "value": w.get("value"), "lineNumber": w.get("lineNumber")}
                    for w in recent_writes[-5:]
                ],
                "hypothesis": "If current_file is FILEnxy and recent writes include selector addresses, this links answer -> branch state.",
            })
    return candidates


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_readme(output: Path, source: Path, plan: dict[str, Any], trace_summary: dict[str, Any] | None) -> None:
    text = f"""# Mind Mirror Original Import v5 — Emulator / Debug Trace Plan

Generated by `prepare_emulator_trace_v5.py`.

## Input

```text
{source}
```

## Purpose

v4 gave us a static 6502 overlay map. v5 turns that map into a debugger trace plan.
The goal is to validate the runtime chain:

```text
CNTRL.OVR / Rn.OVR
  → loaded FILEnxy
  → event/branch selector state
  → displayed prompt/options
  → selected answer #1..#8
  → score delta / marker 2-3 state update
```

## Primary breakpoints

"""
    for bp in plan["breakpoints"][:12]:
        text += f"- `{bp['address']}` — {bp.get('reason','')}\n"
    text += "\n## Primary zero-page watchpoints\n\n"
    for wp in plan["watchpoints"][:16]:
        text += f"- `{wp['address']}` — refs={wp.get('total_refs')} confidence={wp.get('max_confidence')} requested={wp.get('requested')}\n"
    if trace_summary:
        text += "\n## Parsed trace summary\n\n```json\n"
        text += json.dumps(trace_summary, ensure_ascii=False, indent=2)
        text += "\n```\n"
    else:
        text += "\n## Trace status\n\nNo emulator log was supplied. This output is a trace plan, not a completed runtime validation.\n"
    text += """
## Files generated

```text
runtime_trace_plan_v5.json
mame_debug_commands_v5.txt
applewin_debug_checklist_v5.txt
trace_event_schema_v5.json
```

If `--trace-log` was provided, also:

```text
parsed_trace_events_v5.json
trace_summary_v5.json
runtime_link_candidates_v5.json
```

## Safety

This tool intentionally does not publish original Life Simulation prose. Runtime logs may still
contain screen text if your emulator captures it; keep those logs under `research-output/` and do
not commit them.
"""
    (output / "README_EMULATOR_TRACE_V5.md").write_text(text, encoding="utf-8")


def run(source: Path, output: Path, trace_log: Path | None) -> None:
    output.mkdir(parents=True, exist_ok=True)
    bundle = load_v4_bundle(source)
    plan = build_trace_plan(bundle)

    write_json(output / "runtime_trace_plan_v5.json", plan)
    write_json(output / "trace_event_schema_v5.json", make_trace_schema())
    (output / "mame_debug_commands_v5.txt").write_text(make_mame_commands(plan), encoding="utf-8")
    (output / "applewin_debug_checklist_v5.txt").write_text(make_applewin_commands(plan), encoding="utf-8")

    trace_summary = None
    if trace_log:
        events = parse_trace_log(trace_log)
        trace_summary = build_trace_summary(events)
        write_json(output / "parsed_trace_events_v5.json", events)
        write_json(output / "trace_summary_v5.json", trace_summary)
        write_json(output / "runtime_link_candidates_v5.json", make_runtime_link_candidates(events))

    write_readme(output, source, plan, trace_summary)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Prepare Mind Mirror v5 emulator/debug trace plan from v4 6502 metadata.")
    parser.add_argument("v4_source", type=Path, help="Path to v4 output directory or ZIP.")
    parser.add_argument("--output", type=Path, required=True, help="Output directory for v5 trace plan.")
    parser.add_argument("--trace-log", type=Path, default=None, help="Optional emulator/debug trace log to normalize.")
    args = parser.parse_args(argv)

    run(args.v4_source, args.output, args.trace_log)
    print(f"Wrote v5 emulator trace outputs to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
