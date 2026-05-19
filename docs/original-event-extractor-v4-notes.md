# Mind Mirror original event extraction — v4 6502 overlay validation notes

v4 changes the research target from text extraction/counting to runtime validation.

The files of interest are Apple II binary overlays:

- `CNTRL.OVR`
- `R1.OVR`
- `R2.OVR`
- `R3.OVR`
- `R4.OVR`

These files appear on the Life Simulation disks and load around `$D000`. The first bytes follow an Apple II binary-style header: load address and declared length, followed by 6502 code.

## What v4 does

`tools/original-import/analyze_6502_overlays_v4.py`:

1. Accepts a v2 private output directory or ZIP.
2. Locates `apple2-extracted-files/`.
3. Collects `CNTRL.OVR` and `R1`–`R4` overlays.
4. Parses the Apple II binary-style header.
5. Performs linear 6502 disassembly using official NMOS 6502 opcode metadata.
6. Extracts JSR/JMP/branch sites.
7. Ranks zero-page state/counter candidates.
8. Scans for likely pointer tables.
9. Scans masked ASCII for file/load references.
10. Emits metadata-only reports without original Life Simulation prose.

## What v4 can validate

- The Life Simulation runtime is overlay-driven.
- `CNTRL.OVR` is a control overlay shared by both Life Simulation disks.
- `R1/R4` are on Life Simulation A, while `R2/R3` are on Life Simulation B.
- Zero-page variables can be ranked as possible counters, branch selectors, or event indexes.
- Static pointer-table candidates can be identified for follow-up.

## What v4 cannot prove alone

- Exact event offset tables.
- Exact random selection routine.
- Exact branch selector semantics.
- Exact `FILEnxy` load sequence.

Those require emulator/debug tracing or deeper loader disassembly.

## Recommended v5 direction

Use AppleWin/MAME/AppleWin debugger or another Apple II debug emulator with:

- breakpoints around overlay load address `$D000`,
- watchpoints on top zero-page candidates from `zero_page_state_candidates_v4.json`,
- breakpoints on high-frequency `JSR` targets from `overlay_calls_v4.json`,
- logging of DOS file-load commands or RWTS calls.

The goal is to capture:

```text
current realm
current zone
selected event index
loaded FILEnxy
selected answer
score delta / marker update
```

Keep any raw captured original prose out of the public repository.
