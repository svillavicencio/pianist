# Verified Debussy and Heroic Polonaise Integration Design

## Goal

Correct the existing *Clair de lune* mapping and then add Chopin's *Polonaise in A-flat major, Op. 53* without repeating the source-selection and track-mapping errors that made Debussy sound wrong.

## Root-cause classification

The Debussy report is a real bug in the MIDI-source suitability cluster, not evidence that the binary parser changed pitches. The initial Pianovera/Mutopia source choice is superseded. SHA-256 `4eee9a1546ffde1ff74cb9824ba0e57cbc821185a15185bfea9faed97820bf8c` (`4eee9a...`) belonged to that superseded source. The verified current piano-midi.de performance source has SHA-256 `4dee23...`. It has one tempo, one velocity, and omits performance rearticulations. That is valid notation data but is poorly suited to an attack-driven game that does not reproduce the score's full sustain semantics.

The systemic correction is to validate every source before generation: provenance, musical version, track roles, percussion channels, tempo profile, velocity profile, opening motif, final event, and event counts. Generated tests must pin those facts rather than merely pinning whatever output the mapper produced.

## Sequential delivery

Implement and verify one piece at a time. After each generated mapping passes automated checks, pause for an audible user check before continuing. This isolates musical defects and protects reviewability despite the large generated modules.

### Stage 1: Correct Debussy

Replace the Pianovera/Mutopia engraving with Bernd Krueger's real-performance MIDI from piano-midi.de (`deb_clai.mid`, CC BY-SA 3.0 DE). Expected source characteristics are MIDI format 1, seven tracks, 480 ticks per quarter, 733 tempo events, 1,491 note-ons, 815 exact-tick attack groups, 58 distinct velocities, one duplicate-pitch collision resolved by maximum velocity, and seven-note maximum simultaneity.

The opening pitch sequence must match the score-derived MIDI through the independently compared opening passage. Later rearticulations in the performance are preserved rather than removed as apparent duplicates. Update attribution, regenerate the piece, and replace tests that incorrectly legitimize the flat engraving profile.

### Stage 2: Add Chopin's Heroic Polonaise

Use piano-midi.de's complete `chpn_op53.mid` real-performance capture (CC BY-SA 3.0 DE). Preliminary inspection reports MIDI format 1, eight tracks, 480 ticks per quarter, 1,946 tempo events, 6,052 note-ons, 2,214 exact-tick groups, 83 velocities, zero duplicate-pitch collisions, and eight-note maximum simultaneity. Register it inside the existing Chopin pack, not a second composer pack.

Validate its opening A-flat-major/octave material and final chord against the source and pin the source statistics in focused tests.

## Mapper and tests

Keep parsing offline. Reuse the established piecewise tempo conversion and exact-tick attack grouping. Each mapper must report per-track note counts and selected track/channel roles. Each piece test must assert source identity/statistics, opening and ending events, tempo-derived timing, velocity behavior, maximum simultaneity, and duplicate-pitch absence.

Do not add runtime MIDI parsing, manually alter individual notes, reinterpret dynamics, or change the audio/game engine in this work.

## Verification

For each stage, run the mapper, focused piece tests, catalog tests, full Vitest suite, TypeScript checking, and a production build. Remove generated cache/build artifacts, inspect the final scope, and execute the Receipt-driven review preflight after the full candidate is normalized.
