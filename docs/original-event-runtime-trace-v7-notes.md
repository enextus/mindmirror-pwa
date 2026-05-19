# Mind Mirror original event reconstruction v7 — runtime trace notes

## Purpose

v7 is the first operational layer that moves from static reconstruction to a
real Apple II runtime/debugger trace. It is designed to verify the chain:

```text
runtime selector
→ overlay
→ loaded FILEnxy
→ decoded block hash
→ selected answer #1..#8
→ axisRow
→ dx/dy
→ marker 2/3 update
```

## Inputs

Preferred input is a v5/v6 output folder or ZIP, for example:

```bash
python tools/original-import/run_emulator_trace_v7.py \
  research-output/original-import-v5-trace-plan \
  --output research-output/original-import-v7-trace-kit
```

The tool can also run without a source and will use the core v5 address plan.

## Outputs

- `runtime_trace_breakpoints_v7.csv`
- `runtime_trace_watchpoints_v7.csv`
- `mame_debug_script_v7.txt`
- `applewin_trace_checklist_v7.md`
- `trace_capture_protocol_v7.md`
- `trace_log_schema_v7.json`
- `trace_session_manifest_v7.json`

With `--trace-log`, it also writes:

- `parsed_trace_events_v7.json`
- `trace_summary_v7.json`
- `runtime_link_candidates_v7.json`

## Copyright boundary

Do not commit raw emulator logs if they include original screen text. Keep all
such outputs under `research-output/`.

## What v7 can prove

With a real debugger log, v7 can confirm whether the runtime actually hits the
predicted overlay and selector addresses during Life Simulations.

## What v7 still cannot prove alone

If the emulator log lacks file-load traces or user answer markers, v7 can only
rank selector/counter changes. A strong trace must include manual markers for
selected realm and answer numbers, or an emulator log with enough DOS/file I/O
information to identify loaded `FILEnxy` resources.
