# Mind Mirror Original Event Import — v5 Emulator / Debug Trace Plan

v5 is the first step that moves from static extraction to runtime validation.

The goal is not to publish original Life Simulation prose. The goal is to validate the runtime chain:

```text
CNTRL.OVR / Rn.OVR
  -> loaded FILEnxy
  -> event/branch selector state
  -> displayed prompt/options
  -> selected answer #1..#8
  -> score delta / marker 2-3 state update
```

## Inputs

Use the output of v4:

```text
research-output/original-import-v4-6502/
```

or the archived equivalent:

```text
original-import-v4-6502.zip
```

Required v4 files:

```text
overlay_6502_summary_v4.json
overlay_calls_v4.json
zero_page_state_candidates_v4.json
pointer_table_candidates_v4.json
file_load_reference_candidates_v4.json
branch_selector_candidates_v4.json
runtime_trace_hypotheses_v4.json
validation_status_v4.json
```

## Tool

```bash
python tools/original-import/prepare_emulator_trace_v5.py \
  research-output/original-import-v4-6502 \
  --output research-output/original-import-v5-trace-plan
```

Or from a ZIP:

```bash
python tools/original-import/prepare_emulator_trace_v5.py \
  /c/path/to/original-import-v4-6502.zip \
  --output research-output/original-import-v5-trace-plan
```

## Outputs

```text
README_EMULATOR_TRACE_V5.md
runtime_trace_plan_v5.json
mame_debug_commands_v5.txt
applewin_debug_checklist_v5.txt
trace_event_schema_v5.json
```

If a trace log is supplied:

```text
parsed_trace_events_v5.json
trace_summary_v5.json
runtime_link_candidates_v5.json
```

## Primary breakpoints

```text
$D000  overlay entry/load base
$7E52  common service routine candidate
$D4B4  R2/R3 realm helper candidate
```

The generated plan also includes high-frequency JSR/JMP targets from `overlay_calls_v4.json`.

## Primary watchpoints

```text
$8C, $A0, $A8, $5E, $D4, $DC, $B3, $05, $A2, $FB, $F9, $AC
```

The tool merges these manually selected watchpoints with ranked v4 zero-page candidates.

## Manual test vectors

1. Enter Life Simulations and force/reach Bio-Energy. Answer `#1` repeatedly.
2. Enter Emotional Insight and alternate `#1` / `#8`.
3. Open the Mind Map after several answers and record marker `2` and marker `3` positions.

## Why this matters

v3 showed that `2000/2400` likely comes from runtime-combined screens, choices, and scored transitions.
v4 identified overlays and likely state variables. v5 prepares the trace protocol needed to prove:

```text
runtime selector -> loaded FILEnxy -> decoded block -> answer #1..#8 -> score delta
```

## Safety

Do not commit emulator logs if they include original screen text. Keep all logs under:

```text
research-output/
```
