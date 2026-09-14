# Debussy Clair de lune MIDI Integration Design

## Goal

Add Claude Debussy's *Clair de lune* from *Suite bergamasque* as a playable catalog piece using the project's real-MIDI content pattern.

## Source and mapping

The initial Pianovera/Mutopia public-domain source choice is superseded. Use the verified Bernd Krueger piano-midi.de performance MIDI (`deb_clai.mid`, CC BY-SA 3.0 DE) for *Clair de lune*. Preserve the verified source and attribution in `public/midi/`. Reuse the repository's offline mapper approach: parse MIDI tracks, build a piecewise tempo map, merge note-ons from the musical tracks, group attacks by exact MIDI tick, deduplicate same-pitch collisions by maximum velocity, sort pitches, and emit static TypeScript data.

## Integration

- Add the verified source MIDI and attribution; the initial Pianovera/Mutopia source choice is superseded.
- Add `src/content/pieces/debussyClairDeLune.ts` with generated immutable chord data and focused regression tests.
- Add a `Claude Debussy` catalog pack and register the piece in `src/content/catalog.ts` and its tests.
- Reuse an existing visual theme; do not modify the engine or add runtime MIDI parsing.

## Verification

Run the mapper summary, focused piece/catalog tests, full Vitest, typechecking, and production build. Inspect the final diff and execute the required Receipt-driven review preflight before reporting completion.

## Non-goals

No manual reinterpretation of the composition, runtime parser, unrelated refactors, or engine changes.
