# Original Event Reconstruction v6 — final static closure

This note defines the final static reconstruction layer for the original
Timothy Leary's Mind Mirror Life Simulation corpus.

## Why v6 exists

Earlier passes established:

- v2 decodes Apple II disk files into blocks/screens and probable events.
- v3 models runtime branches and count interpretations.
- v4 statically analyzes 6502 overlays.
- v5 prepares emulator/debugger breakpoints and watchpoints.

v6 does not pretend to solve what only a live emulator trace can solve.
Instead, it formalizes the evidence and produces a public-safe final status:

```text
What is proven?
What is only a count model?
What remains trace-dependent?
What schema should a verified private corpus use?
```

## Core conclusion

The 2,000 / 2,400 claims are best understood as runtime-counted screens,
numeric choices, scored transitions and branch variants. Static extraction does
not support the claim that there are 2,000 independent long narrative prompt
texts.

The strongest model from the v3 analysis was:

```text
life_unique_screens_plus_life_numeric_options ≈ 2018
```

The broader static models exceed 2,400 when all unique blocks and numeric
options are counted. This makes the historical claims plausible without
requiring a flat database of 2,000 prose prompts.

## Usage

```bash
python tools/original-import/finalize_original_event_reconstruction_v6.py \
  --v2 research-output/original-import-v2-private \
  --v3 research-output/original-import-v3-runtime \
  --v4 research-output/original-import-v4-6502 \
  --v5 research-output/original-import-v5-trace-plan \
  --output research-output/original-import-v6-final
```

With ZIPs:

```bash
python tools/original-import/finalize_original_event_reconstruction_v6.py \
  --v2 research-output/original-import-v2-private.zip \
  --v3 research-output/original-import-v3-runtime.zip \
  --v4 research-output/original-import-v4-6502.zip \
  --v5 research-output/original-import-v5-trace-plan.zip \
  --output research-output/original-import-v6-final
```

With an emulator trace:

```bash
python tools/original-import/finalize_original_event_reconstruction_v6.py \
  --v2 research-output/original-import-v2-private \
  --v3 research-output/original-import-v3-runtime \
  --v4 research-output/original-import-v4-6502 \
  --v5 research-output/original-import-v5-trace-plan \
  --trace-log research-output/emulator-trace.log \
  --output research-output/original-import-v6-final
```

## Outputs

```text
README_RECONSTRUCTION_V6.md
reconstruction_status_v6.json
count_models_v6.json
proof_matrix_v6.csv
final_original_event_schema_v6.json
trace_link_candidates_v6.json
```

## Public/private boundary

Safe to commit:

```text
tools/original-import/finalize_original_event_reconstruction_v6.py
docs/original-event-reconstruction-v6-final-notes.md
```

Do not commit:

```text
research-output/
*.private.json
decoded-files.private/
emulator logs containing original text
```

## What a v7 would require

A v7 is only meaningful after a real Apple II emulator/debugger trace. The goal
would be to verify:

```text
runtime selector
→ overlay
→ loaded FILEnxy
→ decoded block hash
→ answer #1..#8
→ axisRow
→ dx/dy
→ marker 2/3 update
```

Without this trace, the exact event table remains a high-confidence static
model, not a byte-perfect historical reconstruction.
