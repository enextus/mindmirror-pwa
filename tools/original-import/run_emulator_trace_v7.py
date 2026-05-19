#!/usr/bin/env python3
"""
Mind Mirror original event reconstruction v7.

Purpose
-------
Prepare and validate a real Apple II emulator/debugger trace session for
Timothy Leary's Mind Mirror Life Simulations. This tool does not ship or
reproduce original game prose. It consumes the prior v4/v5/v6 metadata and
optionally a debugger trace log created with MAME/AppleWin/other Apple II
emulator debuggers.

Outputs
-------
Without --trace-log:
  - README_RUNTIME_TRACE_V7.md
  - runtime_trace_breakpoints_v7.csv
  - runtime_trace_watchpoints_v7.csv
  - mame_debug_script_v7.txt
  - applewin_trace_checklist_v7.md
  - trace_capture_protocol_v7.md
  - trace_log_schema_v7.json
  - trace_session_manifest_v7.json

With --trace-log:
  - all of the above
  - parsed_trace_events_v7.json
  - trace_summary_v7.json
  - runtime_link_candidates_v7.json
  - validation_status_v7.json

This script is intentionally conservative: it records addresses, counters,
and hashes/labels, but it avoids embedding original scene prose in outputs.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import zipfile
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable

CORE_BREAKPOINTS = [
    {"addr": 0xD000, "label": "overlay_entry_or_load_base", "priority": 1, "reason": "All observed Life Simulation overlays load near $D000."},
    {"addr": 0x7E52, "label": "common_service_routine_candidate", "priority": 1, "reason": "High-frequency cross-overlay call target from v4/v5."},
    {"addr": 0xD4B4, "label": "realm_helper_dispatcher_candidate", "priority": 1, "reason": "Frequent realm-local helper/dispatcher candidate, especially R2/R3."},
]

CORE_WATCHPOINTS = [
    {"addr": 0x8C, "label": "main_selector_index_candidate", "priority": 1, "reason": "Highest-ranked cross-overlay zero-page candidate."},
    {"addr": 0xA0, "label": "realm_state_counter_candidate", "priority": 1, "reason": "R1/R3 state/counter candidate."},
    {"addr": 0xA8, "label": "r1_state_candidate", "priority": 1, "reason": "R1 state candidate."},
    {"addr": 0x5E, "label": "r4_decrement_counter_candidate", "priority": 1, "reason": "R4 decrement/counter candidate."},
    {"addr": 0xD4, "label": "r2_r4_state_candidate", "priority": 1, "reason": "R2/R4 state candidate."},
    {"addr": 0xDC, "label": "r2_state_candidate", "priority": 1, "reason": "R2 state candidate."},
    {"addr": 0xB3, "label": "r2_comparison_selector_candidate", "priority": 1, "reason": "R2 comparison selector candidate."},
    {"addr": 0x05, "label": "r2_index_state_candidate", "priority": 1, "reason": "R2 state/index candidate."},
    {"addr": 0xA2, "label": "r2_r3_comparison_selector_candidate", "priority": 1, "reason": "R2/R3 comparison selector candidate."},
    {"addr": 0xFB, "label": "r2_r3_stored_state_candidate", "priority": 1, "reason": "R2/R3 stored state candidate."},
    {"addr": 0xF9, "label": "r3_stored_state_candidate", "priority": 1, "reason": "R3 stored state candidate."},
    {"addr": 0xAC, "label": "r3_counter_comparison_candidate", "priority": 1, "reason": "R3 mixed counter/comparison candidate."},
]

REALM_OVERLAY_HINTS = {
    "R1.OVR": "bio_energy",
    "R2.OVR": "emotional_insight",
    "R3.OVR": "mental_abilities",
    "R4.OVR": "social_interaction",
    "CNTRL.OVR": "control",
}

TRACE_LINE_PATTERNS = [
    # MAME-like: PC=1234 A=.. X=.. Y=.. ...
    re.compile(r"\bPC[:=]\s*\$?([0-9A-Fa-f]{4})\b.*?(?:A[:=]\s*\$?([0-9A-Fa-f]{2}))?.*?(?:X[:=]\s*\$?([0-9A-Fa-f]{2}))?.*?(?:Y[:=]\s*\$?([0-9A-Fa-f]{2}))?"),
    # Disassembly-like: D000: A9 00 LDA #$00
    re.compile(r"^\s*\$?([0-9A-Fa-f]{4})\s*[: ]"),
    # Watch-like: WP 008C old=00 new=04
    re.compile(r"\b(?:WP|WATCH|W)\b.*?\$?([0-9A-Fa-f]{2,4}).*?(?:old|from)[:=]\s*\$?([0-9A-Fa-f]{2}).*?(?:new|to)[:=]\s*\$?([0-9A-Fa-f]{2})", re.I),
]

@dataclass(frozen=True)
class TraceEvent:
    line_no: int
    raw_kind: str
    pc: str | None = None
    address: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    register_a: str | None = None
    register_x: str | None = None
    register_y: str | None = None
    raw_line_hash: str | None = None


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()


def read_json_path(path: Path) -> Any | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def read_json_from_dir_or_zip(source: Path, filename: str) -> Any | None:
    if source.is_dir():
        return read_json_path(source / filename)
    if source.is_file() and source.suffix.lower() == ".zip":
        with zipfile.ZipFile(source) as zf:
            names = zf.namelist()
            exact = filename
            candidates = [name for name in names if name.endswith("/" + filename) or name == exact]
            if not candidates:
                return None
            with zf.open(candidates[0]) as fp:
                return json.loads(fp.read().decode("utf-8"))
    return None


def load_optional_bundle(source: Path | None) -> dict[str, Any]:
    if source is None:
        return {}
    files = [
        "runtime_trace_plan_v5.json",
        "overlay_6502_summary_v4.json",
        "overlay_calls_v4.json",
        "zero_page_state_candidates_v4.json",
        "reconstruction_status_v6.json",
        "count_models_v6.json",
        "trace_link_candidates_v6.json",
    ]
    out: dict[str, Any] = {}
    for filename in files:
        data = read_json_from_dir_or_zip(source, filename)
        if data is not None:
            out[filename] = data
    return out


def unique_by_addr(items: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[int] = set()
    result: list[dict[str, Any]] = []
    for item in items:
        addr = int(item["addr"])
        if addr in seen:
            continue
        seen.add(addr)
        result.append(item)
    return result


def load_breakpoints(bundle: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = list(CORE_BREAKPOINTS)
    plan = bundle.get("runtime_trace_plan_v5.json")
    if isinstance(plan, dict):
        for key in ("breakpoints", "breakpoint_plan", "recommended_breakpoints"):
            values = plan.get(key)
            if isinstance(values, list):
                for entry in values:
                    addr = parse_addr(entry.get("addr") or entry.get("address") or entry.get("pc")) if isinstance(entry, dict) else None
                    if addr is not None:
                        candidates.append({
                            "addr": addr,
                            "label": str(entry.get("label", f"bp_{addr:04X}")),
                            "priority": int(entry.get("priority", 2)) if str(entry.get("priority", "")).isdigit() else 2,
                            "reason": str(entry.get("reason", "from v5 runtime_trace_plan")),
                        })
    calls = bundle.get("overlay_calls_v4.json")
    if isinstance(calls, list):
        for entry in calls[:32]:
            if not isinstance(entry, dict):
                continue
            addr = parse_addr(entry.get("target") or entry.get("addr") or entry.get("address"))
            count = int(entry.get("count", entry.get("refs", 0)) or 0)
            if addr is not None and count >= 3:
                candidates.append({"addr": addr, "label": f"overlay_call_target_{addr:04X}", "priority": 2, "reason": f"v4 call target count={count}"})
    return sorted(unique_by_addr(candidates), key=lambda x: (int(x.get("priority", 9)), int(x["addr"])))


def load_watchpoints(bundle: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = list(CORE_WATCHPOINTS)
    plan = bundle.get("runtime_trace_plan_v5.json")
    if isinstance(plan, dict):
        for key in ("watchpoints", "watchpoint_plan", "recommended_watchpoints"):
            values = plan.get(key)
            if isinstance(values, list):
                for entry in values:
                    addr = parse_addr(entry.get("addr") or entry.get("address")) if isinstance(entry, dict) else None
                    if addr is not None:
                        candidates.append({
                            "addr": addr,
                            "label": str(entry.get("label", f"watch_{addr:02X}")),
                            "priority": int(entry.get("priority", 2)) if str(entry.get("priority", "")).isdigit() else 2,
                            "reason": str(entry.get("reason", "from v5 runtime_trace_plan")),
                        })
    zps = bundle.get("zero_page_state_candidates_v4.json")
    if isinstance(zps, list):
        for entry in zps[:32]:
            if not isinstance(entry, dict):
                continue
            addr = parse_addr(entry.get("addr") or entry.get("address") or entry.get("zero_page"))
            refs = int(entry.get("refs", entry.get("count", 0)) or 0)
            if addr is not None:
                candidates.append({"addr": addr, "label": f"zp_candidate_{addr:02X}", "priority": 2, "reason": f"v4 zero-page refs={refs}"})
    return sorted(unique_by_addr(candidates), key=lambda x: (int(x.get("priority", 9)), int(x["addr"])))


def parse_addr(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    s = str(value).strip().upper().replace("$", "")
    if s.startswith("0X"):
        s = s[2:]
    if not re.fullmatch(r"[0-9A-F]{1,4}", s):
        return None
    return int(s, 16)


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})


def mame_debug_script(breakpoints: list[dict[str, Any]], watchpoints: list[dict[str, Any]]) -> str:
    lines = [
        "# Mind Mirror Apple II Life Simulation trace script - MAME debugger draft",
        "# Load with: mame apple2e -flop1 <program.dsk> -flop2 <life_sim.dsk> -debug -debugscript mame_debug_script_v7.txt",
        "# MAME debugger syntax varies by version; if a command is rejected, enter the equivalent manually.",
        "",
        "# Start CPU instruction trace only when entering Life Simulations to avoid huge logs.",
        "# trace mindmirror_cpu_trace.log",
        "",
        "# Breakpoints",
    ]
    for bp in breakpoints:
        addr = int(bp["addr"])
        lines.append(f"bpset ${addr:04X} # {bp.get('label','')} - {bp.get('reason','')}")
    lines += ["", "# Watchpoints / memory writes", "# Syntax may need adjustment: wpset <addr>,<length>,w"]
    for wp in watchpoints:
        addr = int(wp["addr"])
        lines.append(f"wpset ${addr:04X},1,w # {wp.get('label','')} - {wp.get('reason','')}")
    lines += [
        "",
        "# Manual trace markers to write in your notes/log:",
        "# TRACE_MARK enter_life_simulations",
        "# TRACE_MARK select_realm_bio_energy",
        "# TRACE_MARK answer_1",
        "# TRACE_MARK open_mind_map",
        "# TRACE_MARK marker_update_visible",
    ]
    return "\n".join(lines) + "\n"


def applewin_checklist(breakpoints: list[dict[str, Any]], watchpoints: list[dict[str, Any]]) -> str:
    bp_text = "\n".join([f"- ${int(bp['addr']):04X}: {bp.get('label')} — {bp.get('reason')}" for bp in breakpoints])
    wp_text = "\n".join([f"- ${int(wp['addr']):04X}: {wp.get('label')} — {wp.get('reason')}" for wp in watchpoints])
    return f"""# AppleWin / Apple II debugger checklist - Mind Mirror v7

This checklist is intentionally emulator-neutral. AppleWin debugger command syntax
varies between builds, so the core requirement is to capture a log with the PC,
registers, and writes to the zero-page addresses below.

## Breakpoints

{bp_text}

## Watchpoints

{wp_text}

## Manual test vectors

1. Start program disk, enter Life Simulations.
2. Bio-Energy run: answer `#1` for the first 8 numeric prompts.
3. Bio-Energy opposite run: answer `#8` for the first 8 numeric prompts.
4. Emotional Insight run: alternate `#1`, `#8`, `#1`, `#8`.
5. At each visible event, write down:
   - disk side / realm if visible
   - displayed title or first short phrase as private note only
   - answer number selected
   - whether marker 2/3 changes on Mind Map

Do not commit logs if they contain original screen prose.
"""


def trace_capture_protocol() -> str:
    return """# Mind Mirror v7 runtime trace capture protocol

Goal: prove or falsify the exact chain:

```text
runtime selector -> overlay -> loaded FILEnxy -> decoded block hash
-> answer #1..#8 -> axisRow -> dx/dy -> marker 2/3 update
```

## Minimal capture

- Emulator: MAME Apple II, AppleWin, or another debugger-capable Apple II emulator.
- Disks: 4am crack/preservation Apple II disks.
- Start capture only when entering Life Simulations.
- Capture breakpoints at `$D000`, `$7E52`, `$D4B4`.
- Capture writes to the prioritized zero-page watchpoints.
- Record manual markers for realm selection and answer numbers.

## Important privacy/copyright rule

Debugger logs may contain original Electronic Arts/Futique text. Keep them under
`research-output/` and do not commit them. Public outputs should contain hashes,
counts, filenames, offsets, and redacted metadata only.

## Success criteria

A trace is strong if it contains:

1. Overlay load/entry at `$D000`.
2. A clear realm overlay in use (`R1.OVR`, `R2.OVR`, `R3.OVR`, `R4.OVR`) or equivalent PC range.
3. Zero-page selector changes before event display.
4. Answer number marker or correlated user input.
5. State changes after answer selection.
6. Mind Map marker update after the answer sequence.
"""


def trace_schema() -> dict[str, Any]:
    return {
        "schema": "mindmirror.runtimeTrace.v7",
        "fields": {
            "line_no": "1-based source log line number",
            "raw_kind": "pc | watch | note | unknown",
            "pc": "hex PC if known",
            "address": "hex memory address if this is a watchpoint/write",
            "old_value": "hex old value if known",
            "new_value": "hex new value if known",
            "register_a": "hex A register if known",
            "register_x": "hex X register if known",
            "register_y": "hex Y register if known",
            "raw_line_hash": "sha256 of source line, not source prose",
        },
        "public_safety": "Do not store original screen prose in public outputs.",
    }


def parse_trace_log(path: Path) -> list[TraceEvent]:
    events: list[TraceEvent] = []
    for idx, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), start=1):
        line_hash = sha256_text(line)
        watch = TRACE_LINE_PATTERNS[2].search(line)
        if watch:
            addr, old, new = watch.groups()
            events.append(TraceEvent(idx, "watch", address=f"${int(addr,16):04X}", old_value=f"${int(old,16):02X}", new_value=f"${int(new,16):02X}", raw_line_hash=line_hash))
            continue
        pc = TRACE_LINE_PATTERNS[0].search(line)
        if pc:
            p, a, x, y = pc.groups()
            events.append(TraceEvent(idx, "pc", pc=f"${int(p,16):04X}", register_a=f"${int(a,16):02X}" if a else None, register_x=f"${int(x,16):02X}" if x else None, register_y=f"${int(y,16):02X}" if y else None, raw_line_hash=line_hash))
            continue
        dis = TRACE_LINE_PATTERNS[1].search(line)
        if dis:
            p = dis.group(1)
            events.append(TraceEvent(idx, "pc", pc=f"${int(p,16):04X}", raw_line_hash=line_hash))
            continue
        if "TRACE_MARK" in line or "ANSWER" in line.upper() or "REALM" in line.upper():
            events.append(TraceEvent(idx, "note", raw_line_hash=line_hash))
    return events


def summarize_trace(events: list[TraceEvent], breakpoints: list[dict[str, Any]], watchpoints: list[dict[str, Any]]) -> dict[str, Any]:
    bp_set = {f"${int(bp['addr']):04X}" for bp in breakpoints}
    wp_set = {f"${int(wp['addr']):04X}" for wp in watchpoints} | {f"${int(wp['addr']):02X}" for wp in watchpoints}
    pc_hits: dict[str, int] = {}
    watch_hits: dict[str, int] = {}
    for ev in events:
        if ev.pc:
            pc_hits[ev.pc] = pc_hits.get(ev.pc, 0) + 1
        if ev.address:
            watch_hits[ev.address] = watch_hits.get(ev.address, 0) + 1
    covered_bps = sorted([addr for addr in bp_set if pc_hits.get(addr, 0) > 0])
    covered_wps = sorted([addr for addr in wp_set if watch_hits.get(addr, 0) > 0])
    return {
        "trace_events_total": len(events),
        "pc_events": sum(1 for ev in events if ev.raw_kind == "pc"),
        "watch_events": sum(1 for ev in events if ev.raw_kind == "watch"),
        "note_events": sum(1 for ev in events if ev.raw_kind == "note"),
        "breakpoint_hits": pc_hits,
        "watchpoint_hits": watch_hits,
        "covered_core_breakpoints": covered_bps,
        "covered_watchpoints": covered_wps,
        "has_overlay_entry_hit": "$D000" in pc_hits,
        "has_common_service_hit": "$7E52" in pc_hits,
        "has_realm_helper_hit": "$D4B4" in pc_hits,
        "has_main_selector_watch": "$008C" in watch_hits or "$8C" in watch_hits,
        "validation_level": "runtime_trace_supplied_partial" if events else "trace_plan_only",
    }


def runtime_link_candidates(events: list[TraceEvent]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    last_pc: str | None = None
    for ev in events:
        if ev.pc:
            last_pc = ev.pc
        if ev.raw_kind == "watch" and ev.address:
            candidates.append({
                "line_no": ev.line_no,
                "near_pc": last_pc,
                "watch_address": ev.address,
                "old_value": ev.old_value,
                "new_value": ev.new_value,
                "interpretation": "state_selector_or_counter_change_candidate",
                "confidence": "medium" if ev.address in {"$008C", "$00A0", "$00A8", "$005E", "$00D4", "$00DC"} else "low",
            })
    return candidates


def write_outputs(out: Path, bundle_source: Path | None, breakpoints: list[dict[str, Any]], watchpoints: list[dict[str, Any]], trace_log: Path | None) -> None:
    out.mkdir(parents=True, exist_ok=True)
    breakpoint_rows = [{**bp, "addr_hex": f"${int(bp["addr"]):04X}"} for bp in breakpoints]
    watchpoint_rows = [{**wp, "addr_hex": f"${int(wp["addr"]):04X}"} for wp in watchpoints]
    write_csv(out / "runtime_trace_breakpoints_v7.csv", breakpoint_rows, ["addr_hex", "addr", "label", "priority", "reason"])
    write_csv(out / "runtime_trace_watchpoints_v7.csv", watchpoint_rows, ["addr_hex", "addr", "label", "priority", "reason"])
    (out / "mame_debug_script_v7.txt").write_text(mame_debug_script(breakpoints, watchpoints), encoding="utf-8")
    (out / "applewin_trace_checklist_v7.md").write_text(applewin_checklist(breakpoints, watchpoints), encoding="utf-8")
    (out / "trace_capture_protocol_v7.md").write_text(trace_capture_protocol(), encoding="utf-8")
    write_json(out / "trace_log_schema_v7.json", trace_schema())

    manifest = {
        "tool": "run_emulator_trace_v7.py",
        "mode": "trace_plan" if trace_log is None else "trace_log_parse",
        "bundle_source": str(bundle_source) if bundle_source else None,
        "trace_log": str(trace_log) if trace_log else None,
        "breakpoints": len(breakpoints),
        "watchpoints": len(watchpoints),
        "core_goal": "runtime selector -> overlay -> FILEnxy -> block hash -> answer -> axisRow -> score delta",
    }
    write_json(out / "trace_session_manifest_v7.json", manifest)

    if trace_log:
        events = parse_trace_log(trace_log)
        write_json(out / "parsed_trace_events_v7.json", [asdict(ev) for ev in events])
        write_json(out / "trace_summary_v7.json", summarize_trace(events, breakpoints, watchpoints))
        write_json(out / "runtime_link_candidates_v7.json", runtime_link_candidates(events))

    readme = f"""# Mind Mirror original event reconstruction v7

This output prepares the final runtime/debugger trace needed to validate the
historical event reconstruction.

## Status

- Breakpoints prepared: {len(breakpoints)}
- Watchpoints prepared: {len(watchpoints)}
- Trace log parsed: {'yes' if trace_log else 'no'}

## Key addresses

- `$D000` overlay entry/load base
- `$7E52` common service routine candidate
- `$D4B4` realm helper/dispatcher candidate
- `$008C` highest-priority selector/index watchpoint

## Next action

Run the Apple II program in an emulator debugger, use the generated MAME or
AppleWin checklist, capture a raw trace log, then run this tool again with
`--trace-log`.

The output remains metadata-only and should not contain original copyrighted
Life Simulation prose.
"""
    (out / "README_RUNTIME_TRACE_V7.md").write_text(readme, encoding="utf-8")


def run(args: argparse.Namespace) -> int:
    source = Path(args.source).resolve() if args.source else None
    bundle = load_optional_bundle(source) if source else {}
    breakpoints = load_breakpoints(bundle)
    watchpoints = load_watchpoints(bundle)
    trace_log = Path(args.trace_log).resolve() if args.trace_log else None
    if trace_log and not trace_log.exists():
        raise FileNotFoundError(trace_log)
    write_outputs(Path(args.output), source, breakpoints, watchpoints, trace_log)
    print(f"Wrote v7 trace outputs to {args.output}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare or parse Mind Mirror Apple II runtime trace v7.")
    parser.add_argument("source", nargs="?", help="Optional v4/v5/v6 output directory or zip. If omitted, core breakpoint/watchpoint defaults are used.")
    parser.add_argument("--output", required=True, help="Output directory under research-output/.")
    parser.add_argument("--trace-log", help="Optional emulator/debugger trace log to parse.")
    return parser


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
