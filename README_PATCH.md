# Patch: original import research tools

Copy these files into the repository root:

```text
tools/original-import/README.md
tools/original-import/extract_apple2_original_events.py
docs/original-event-corpus-plan.md
```

Recommended `.gitignore` additions:

```gitignore
research-output/
tools/original-import/input/
*.private.json
```

Run locally:

```bash
python tools/original-import/extract_apple2_original_events.py \
  /c/path/to/MindMirror4amCrack.zip \
  --output research-output/original-import
```

Private prose mode:

```bash
python tools/original-import/extract_apple2_original_events.py \
  /c/path/to/MindMirror4amCrack.zip \
  --output research-output/original-import-private \
  --include-prose
```

Do not commit generated original prose.
