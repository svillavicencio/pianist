# Liszt Hungarian Rhapsody No. 2 Integration Design

## Goal

Add Franz Liszt's complete Hungarian Rhapsody No. 2 in C-sharp minor, S.244/2, to the existing Liszt composer pack using a verified human-performance MIDI and the project's offline deterministic mapping architecture.

## Source

Use Bernd Krueger's current piano-midi.de performance `liz_rhap02.mid`, licensed CC BY-SA 3.0 DE.

- Canonical page: `http://piano-midi.de/liszt.htm`
- Direct MIDI: `http://piano-midi.de/midis/liszt/liz_rhap02.mid`
- Performer/sequencer: Bernd Krueger
- Site duration: 8:46
- Verified SHA-256: `19f62d62836e8df9d760de8cb645e6020a05c444651ad974be62ddef9ef1d654`

The file's embedded metadata identifies Hungarian Rhapsody No. 2, Franz Liszt, Bernd Krueger, 8:46 duration, and a 2014 update. A differing older Wikimedia copy must not be substituted.

## Verified performance profile

The current source is MIDI format 1 with 17 tracks and 480 PPQ. Track 0 carries the tempo map; tracks 1 and 2 are the only note tracks, both on piano channel 0:

- Track 1: 3,892 note-ons, first tick 840, last tick 442,800
- Track 2: 2,868 note-ons, first tick 1,320, last tick 442,800
- Total note-ons: 6,760
- Tempo events: 2,849
- Exact-tick attack groups: 3,261
- Distinct velocities: 84
- Same-pitch collisions at one tick: 0
- Maximum simultaneity: 8
- Opening: `[1134, [[61, 77]]]`
- Ending: `[525750, [[30, 74], [42, 88], [54, 91], [66, 107]]]`

The high tempo-event count and broad velocity distribution demonstrate expressive performance data rather than a flat score export.

## Mapping architecture

Preserve the source in `public/midi/`, add attribution to the shared MIDI attribution document, and create a repository-local Node mapper. The mapper must validate the exact SHA/header/profile, select only tracks 1 and 2 on channel 0, apply the piecewise tempo map, group note-ons by exact tick, deduplicate same-pitch attacks by maximum velocity, sort pitches, and emit repository-formatted byte-stable TypeScript.

Generate one immutable `Piece` module and register it in the existing Liszt pack and content map. Reuse an existing visual theme; do not create a second Liszt pack or change the runtime engine.

## Verification

Use strict TDD: focused piece and catalog tests must fail before implementation and pass afterward. Pin source profile, opening, ending, duration, velocity diversity, maximum simultaneity, and duplicate-pitch absence. Require generated-module SHA equality before mapper execution and after two consecutive runs, then run the full test suite, typecheck, build, and `git diff --check`.

The user performs an audible checkpoint before final whole-candidate verification and Receipt-driven review preflight.

## Non-goals

No Wikimedia substitute, mechanical engraving MIDI, manual note correction, runtime MIDI parser, invented dynamics, duplicate Liszt pack, unrelated edits, commit, push, or release.
