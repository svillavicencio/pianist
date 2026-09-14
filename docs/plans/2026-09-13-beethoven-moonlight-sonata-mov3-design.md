# Beethoven Moonlight Sonata Movement 3 Integration Design

## Goal

Add the complete third movement, Presto agitato, from Ludwig van Beethoven's Piano Sonata No. 14 in C-sharp minor, Op. 27 No. 2 ("Moonlight"), as a distinct piece in the existing Beethoven catalog pack.

## Source

Use Bernd Krueger's current piano-midi.de human-performance MIDI `mond_3.mid`, licensed CC BY-SA 3.0 DE.

- Canonical page: `http://piano-midi.de/beeth.htm`
- Direct MIDI: `http://piano-midi.de/midis/beethoven/mond_3.mid`
- Performer/sequencer: Bernd Krueger
- Site duration: 6:50
- Verified SHA-256: `6f01e20c125731b984ab831c48afa4efbc191e0e70b19dcbeb3b01daaea795a9`

Embedded metadata identifies Sonata No. 14 in C-sharp minor, Op. 27/2, third movement; Ludwig van Beethoven; Bernd Krueger; Presto agitato; 6:50 duration; and the 2012 performance update.

## Verified performance profile

The source is MIDI format 1 with eight tracks and 480 PPQ. Track 0 carries the tempo map; tracks 1 and 2 are the only note tracks, both on piano channel 0:

- Track 1: 3,466 note-ons, first tick 120, last tick 509,760
- Track 2: 3,072 note-ons, first tick 1, last tick 509,760
- Total note-ons: 6,538
- Tempo events: 1,223
- Exact-tick attack groups: 3,781
- Distinct velocities: 86
- Same-pitch collisions: 0
- Maximum simultaneity: 8
- Opening: `[1, [[37, 42]]]`
- Ending: `[410021, [[37,67],[40,67],[44,79],[49,79],[61,83],[64,83],[68,97],[73,97]]]`

The tempo and velocity distributions demonstrate expressive performance data rather than a mechanical score export.

## Mapping architecture

Preserve the source in `public/midi/` and add accurate Bernd Krueger/CC BY-SA attribution. Create a repository-local Node mapper that validates the exact SHA/header/profile, selects only tracks 1 and 2 on channel 0, applies the piecewise tempo map, groups note-on attacks strictly by exact tick, deduplicates same-pitch attacks by maximum velocity, sorts pitches, and emits repository-formatted byte-stable TypeScript.

Generate a distinct immutable `Piece` module and register it in the existing Beethoven pack and content map. Use a distinct id such as `beethoven_moonlight_sonata_mov3` and display name `Moonlight Sonata — 3rd Movement`. Preserve the existing Moonlight entry unchanged and reuse an existing visual theme.

## Verification

Use strict TDD. Focused and catalog tests must fail before implementation and pass afterward. Pin source statistics, opening, ending, duration, velocity diversity, simultaneity, timing order, and duplicate-pitch absence. Require the generated-module SHA to remain identical before and after two mapper runs, then run the full test suite, typecheck, build, and `git diff --check`.

The user performs an audible checkpoint before final whole-candidate verification and Receipt-driven review preflight.

## Non-goals

No replacement of the existing Moonlight piece, mechanical engraving source, manual note correction, runtime MIDI parser, invented dynamics, duplicate Beethoven pack, unrelated edit, commit, push, or release.
