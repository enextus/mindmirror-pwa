# Mind Mirror original import tools

These tools are for private reverse-engineering validation of user-owned/archive disk images.
They are **not** part of the public product runtime.

## Why this exists

The original Mind Mirror manual and archival descriptions claim roughly `2,000` Life Simulations / `over 2400 scored events`.
The public web does not currently provide a clean, complete event corpus. The known path is to extract event candidates from Apple II / DOS disk images.

## Main tool

```bash
python tools/original-import/extract_apple2_original_events.py \
  /path/to/MindMirror4amCrack.zip \
  --output research-output/original-import
```

Default output is metadata only:

```text
research-output/original-import/
  README_IMPORT_REPORT.md
  disk_manifest.json
  file_manifest.json
  event_candidates.metadata.json
  event_extraction_stats.json
  apple2-extracted-files/
```

## Private prose extraction

To create a local-only draft JSON containing original text:

```bash
python tools/original-import/extract_apple2_original_events.py \
  /path/to/MindMirror4amCrack.zip \
  --output research-output/original-import-private \
  --include-prose
```

This writes:

```text
research-output/original-import-private/original-events.private.json
```

Do **not** commit or publish this file. Original game prose is copyrighted.

## Current limitation

The extractor is static and conservative. It parses Apple DOS 3.3 catalogs and extracts candidate screen/event blocks, but it does not yet fully emulate the original runtime loader. The count of candidates is therefore not the same thing as the historical `2,000/2,400` claim.

Next research steps:

1. Reconstruct the original runtime text decoder more completely.
2. Identify exact event table boundaries.
3. Bind event candidates to `realm`, `axisRow`, and answer score semantics.
4. Validate marker `1/2/3` coordinates against the original game in an emulator.
