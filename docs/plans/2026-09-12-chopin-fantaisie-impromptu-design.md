# Chopin Fantaisie-Impromptu MIDI Integration Design

## Goal

Add Frédéric Chopin's *Fantaisie-Impromptu* in C-sharp minor, Op. 66, as a playable catalog piece using the existing real-MIDI content pattern.

## Source and mapping

Use the recovered Pianovera/piano-midi.de MIDI (`chpn_op66.mid`) and the existing Claude Code mapper. The mapper parses MIDI format 1, builds a piecewise tick-to-millisecond tempo map from track 0, merges note-ons from tracks 1 and 2, groups them by exact tick, deduplicates same-pitch collisions using maximum velocity, sorts notes by MIDI pitch, and emits static TypeScript data. The source attribution and Creative Commons BY-SA 3.0 DE notice remain in the generated module documentation.

The recovered output contains 3,050 note-ons, 2,561 timestamped chord events, 76 distinct velocities, and no same-pitch collisions. The opening and closing data will be validated against the mapper summary rather than hand-authored.

## Integration

- Add `src/content/pieces/chopinFantaisieImpromptu.ts` from the generated output.
- Add focused tests covering complete event count, opening/ending notes, tempo-derived timing, velocity variation, simultaneous-note limits, and duplicate-pitch absence.
- Add a Chopin composer pack and register the piece in `src/content/catalog.ts` and its catalog tests.
- Reuse the existing `amethyst` theme; no engine or runtime parser changes are needed.

## Verification

Run the focused piece/catalog tests, the full Vitest suite, and TypeScript typechecking. Inspect the final diff and run the required Receipt-driven review preflight before reporting completion.

## Non-goals

No manual reinterpretation of dynamics, runtime MIDI parsing, engine changes, or unrelated cleanup.
