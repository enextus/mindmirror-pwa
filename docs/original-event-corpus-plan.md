# Original Mind Mirror event corpus plan

## Goal

Recover enough structure from the original Mind Mirror Life Simulation disks to validate the modern PWA implementation without publishing copyrighted original prose.

## Desired private outputs

```text
original-events.private.json
  event id
  disk/file source
  title
  narrative
  answer options
  realm
  axisRow
  score mapping
  hashes / offsets
```

## Safe public outputs

```text
event_candidates.metadata.json
  id
  source disk/file
  realm hint
  title hint
  option marker count
  choice digits
  text hash
  no prose
```

## Important distinction

The historical statements `2,000 simulations` and `over 2400 scored events` are confirmed by source descriptions, but they are not yet verified as 2,000 independent long-form prompts.
The original may count compact scenario fragments, answer options, scored outcomes, random branches, bonus events, and passkey/home-zone combinations.

## Integration rule

The public PWA should continue to use clean-room `sampleEvents.js` content. Original extracted prose should remain in `research-output/`, which must be gitignored.
