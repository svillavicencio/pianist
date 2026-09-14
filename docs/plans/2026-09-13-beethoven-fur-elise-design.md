# Beethoven Für Elise Integration Design

## Goal

Add Ludwig van Beethoven's complete Bagatelle No. 25 in A minor, WoO 59 ("Für Elise"), to the existing Beethoven catalog pack using a verified expressive performance MIDI.

## Source

Use Bernd Krueger's current piano-midi.de performance `elise.mid`, licensed CC BY-SA 3.0 DE.

- Canonical page: `http://piano-midi.de/beeth.htm`
- Direct MIDI: `http://piano-midi.de/midis/beethoven/elise.mid`
- Performer/sequencer: Bernd Krueger
- Verified SHA-256: `a1481bdafe94d33e0de8934c97aec45534c908bc797bae7293f626074aec2e07`

Embedded metadata identifies Für Elise, Ludwig van Beethoven, Bernd Krueger, Poco moto, and the 2012 update.

## Duration discrepancy

The piano-midi.de catalog currently lists 3:48, while the MIDI's embedded metadata says 2:48 and the final mapped attack occurs at 164,981 ms. Treat the verified MIDI bytes as authoritative. Preserve and test the measured performance rather than changing timestamps to match the page label.

## Verified performance profile

The source is MIDI format 1 with eight tracks and 480 PPQ. Track 0 carries the tempo map; tracks 1 and 2 are the only note tracks, both on piano channel 0:

- Track 1: 601 note-ons, first tick 480, last tick 90,000
- Track 2: 440 note-ons, first tick 1,440, last tick 90,000
- Total note-ons: 1,041
- Tempo events: 923
- Exact-tick attack groups: 785
- Distinct velocities: 52
- Same-pitch collisions: 0
- Maximum simultaneity: 6
- Opening: `[867, [[76, 36]]]`
- Ending: `[164981, [[33,17],[45,25],[69,36]]]`

The dense tempo map and broad velocity distribution demonstrate expressive human performance data rather than a mechanical score export.

## Mapping architecture

Preserve the MIDI in `public/midi/` and append accurate Bernd Krueger/CC BY-SA attribution. Create a repository-local Node mapper that validates the exact SHA, header, track/channel profile, tempo count, note totals, attacks, collision count, velocity diversity, simultaneity, opening, and ending.

Select tracks 1 and 2 on channel 0, build the piecewise tempo map, group note-ons strictly by exact tick, deduplicate same-pitch attacks by maximum velocity, sort pitches, and emit repository-formatted byte-stable TypeScript.

Generate a distinct immutable `Piece` module with id `beethoven_fur_elise`, display name `Für Elise`, and composer `Ludwig van Beethoven`. Register it in the existing Beethoven pack and content map without replacing any current work. Reuse an existing visual theme.

## Verification

Use strict TDD: focused piece and catalog tests fail before implementation and pass afterward. Pin source/profile evidence, opening, ending, duration, velocity diversity, simultaneity, chronological timing, and duplicate-pitch absence. Require current-before/run-1/run-2 generated-module SHA equality. Then run the complete test suite, typecheck, build, and `git diff --check`.

Require an audible user checkpoint before reporting completion.

## Non-goals

No fabricated 3:48 timing, mechanical score source, manual note correction, runtime MIDI parser, invented dynamics, duplicate Beethoven pack, replacement of existing pieces, unrelated edit, commit, push, or release.
