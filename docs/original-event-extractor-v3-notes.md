# Original event extractor v3 notes

`analyze_runtime_tables_v3.py` is the next research step after v2.

It does not search for more prose. It analyzes the private v2 output and tries to infer the
runtime structure behind the advertised 2,000/2,400 Life Simulation count.

## Input

Use the private v2 output directory or ZIP:

```bash
python tools/original-import/analyze_runtime_tables_v3.py \
  research-output/original-import-v2-private \
  --output research-output/original-import-v3-runtime
```

or:

```bash
python tools/original-import/analyze_runtime_tables_v3.py \
  /c/path/to/original-import-v2-private.zip \
  --output research-output/original-import-v3-runtime
```

## Output

The output is metadata-only:

- `README_RUNTIME_TABLES_V3.md`
- `runtime_table_analysis_v3.json`
- `runtime_event_families_v3.json`
- `branch_table_candidates_v3.json`
- `raw_file_control_scan_v3.json`
- `event_runtime_index.redacted.json`
- `scored_event_count_models_v3.json`

No original scenario prose is written.

## What v3 tries to prove

V3 checks whether the original event corpus is organized as a runtime structure rather than a
flat list of thousands of long text prompts.

It groups files by patterns such as:

```text
FILE100 / FILE200 / FILE300 / FILE400
FILE11A/B, FILE12A/B, ...
FILE31A/B/C, FILE32A/B/C, ...
FILE41A/B ... FILE48A/B
R1.OVR, R2.OVR, R3.OVR, R4.OVR
CNTRL.OVR
```

The expected conclusion is that the game probably counts scored screens, branches,
choices, and replay variants rather than 2,000 standalone prompt paragraphs.

## What v3 does not yet do

It does not disassemble the 6502 overlay code. That is v4.

V4 should validate `CNTRL.OVR` and `R1.OVR`..`R4.OVR` with an Apple II/6502 disassembler or emulator trace.
