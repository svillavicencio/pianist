# Chopin Ballade, Nocturne, and Minute Waltz Integration Design

## Goal

Add three complete Chopin works to the existing composer pack using source-verified human-performance MIDI: Ballade No. 1 in G minor, Op. 23; Nocturne in E-flat major, Op. 9 No. 2; and Waltz in D-flat major, Op. 64 No. 1 ("Minute Waltz").

## Source policy

Do not use Pianovera's available Nocturne or Minute Waltz files: inspection found that each is a mechanical score export with one tempo and one velocity, repeating the source-suitability failure corrected for Debussy. Use real performance captures instead and pin each source by SHA-256 before parsing.

### Ballade No. 1

Use Bernd Krueger's piano-midi.de performance `chpn_op23.mid`, licensed CC BY-SA 3.0 DE. Verified SHA-256: `8edb6532d13512ea156439d8b07cf8e8292be38a8706617a2bf50165b1a7df03`. Preliminary inspection reports MIDI format 1, eight tracks, 480 PPQ, 2,961 tempo events, 5,028 note-ons, 2,571 exact-tick attack groups, 99 velocities, no same-pitch collisions, seven-note maximum simultaneity, and approximately 9:02 duration.

### Nocturne Op. 9 No. 2

Use Kunst der Fuge's real-performance sequence attributed on its Chopin page to Daisuke Inoue. This source is restricted to the user's personal, non-commercial use and must not be represented as redistributable. Verified SHA-256: `2c4adfd66324487ad4a1667c0f7a79c9fe4091477c11da6863e3d7314caf35d3`. Preliminary inspection reports MIDI format 1, five tracks, 48 PPQ, 536 tempo events, 1,298 note-ons, 627 attack groups, 69 velocities, no collisions, six-note maximum simultaneity, and approximately 3:54 duration.

### Minute Waltz

Use Kunst der Fuge's Duo-Art piano-roll-derived MIDI of Ignaz Friedman's performance. This source is restricted to personal, non-commercial use and must not be represented as redistributable. Verified SHA-256: `137882646e225b14a6f58328d3b6b380efec50322d2780a454a2138ebeafc4ce`. Preliminary inspection reports MIDI format 1, eight tracks, 192 PPQ, 1,465 note-ons, 1,217 attack groups, 44 velocities, no collisions, four-note maximum simultaneity, and approximately 1:45 duration. Its expressive timing is encoded in note placement even though it has one global tempo event.

## Mapping architecture

Keep ingestion offline and emit immutable TypeScript `Piece` data. Each repository-local mapper must:

- validate the source SHA-256 before parsing;
- report MIDI header, per-track note counts, channels, selected track roles, tempo events, collisions, velocity diversity, first event, and last event;
- include only evidenced piano-note tracks and exclude control/percussion tracks;
- build a piecewise tick-to-millisecond map;
- group note-on attacks strictly by exact tick;
- deduplicate same-pitch attacks at one tick by maximum velocity;
- sort pitches for stable output; and
- generate byte-stable, repository-formatted TypeScript without an external formatter dependency.

Register all three pieces inside the existing Chopin pack. Do not create duplicate composer packs or change the runtime engine.

## Sequential delivery and verification

Deliver one piece at a time in this order: Ballade, Nocturne, Minute Waltz. Each stage requires focused tests, catalog tests, full tests, typechecking, deterministic mapper verification, and an audible user checkpoint before the next stage begins. Tests pin source identity/statistics, opening and ending attacks, timing, velocities, simultaneity, and absence of duplicate pitches.

After all three audible checkpoints, run the production build, remove generated caches, inspect final scope, and execute Receipt-driven review preflight.

## Non-goals

No mechanical Pianovera substitutes, manual note correction, runtime MIDI parser, invented dynamics, new theme unless strictly required, commit, push, or redistribution claim for the Kunst der Fuge files.
