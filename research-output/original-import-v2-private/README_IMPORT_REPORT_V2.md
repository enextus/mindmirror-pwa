# Mind Mirror Apple II original import v2 report

Input ZIP: `C:\Users\174297724\Downloads\MindMirror4amCrack.zip`
Unique disk images processed: 3
DOS 3.3 files extracted: 89
Decoded files: 89
Decoded blocks/screens: 1622
Unique block text hashes: 1375
Probable scenario/quote events: 375
Unique probable scenario/quote events: 374
Probable scenarios with at least one score-mapped numeric choice: 141
Choice markers total: 1413
Scored numeric choices total: 595

## Interpretation

V2 decodes the Mind Mirror dictionary/token compression before splitting blocks. This is much better than 7-bit text scanning, but it is still not a full runtime reconstruction of the advertised 2,000/2,400 simulations.

The output separates likely scenario/quote events from menus, directions, passkey screens and scoreboards. Axis-row mapping is conservative: only rows supported by previous reverse-engineering evidence are filled; unknown rows remain null.

## Copyright handling

Do not commit private outputs containing original prose. Commit only scripts, schemas, counts, hashes and redacted metadata.