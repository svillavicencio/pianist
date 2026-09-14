# Chord clustering, strict timing, and hold indicator

## Problem

The visual overhaul shipped in `2026-09-14-visual-ux-overhaul.md` solved the
literal "dots overlap and merge" complaint, but at a cost the user flagged
after using it: they could no longer reliably tell "these 3 notes are one
chord, press together" apart from "these notes are just close together in
time" — exactly the distinction they relied on in the tools this project is
benchmarked against. Root-caused to two of that change's own decisions:

1. **`MIN_UPCOMING_GAP_PX`** (`PixiRenderer.ts`'s `positionUpcoming()`)
   actively compresses/distorts real MIDI timing whenever two chords are
   authored closer together than 28px would represent — which, per the
   exploration below, is constant in real content (Chopin's Fantaisie-
   Impromptu alone ranges ~100ms fast-passage gaps to >1800ms held-note
   gaps). The user wants the real timing respected exactly, not smoothed.
2. **Same-chord notes render pitch-separated with a connecting line**
   instead of overlapping. Hands-on analysis of touchpianist.com and
   Piano-Flow (sunebear.github.io/Piano-Flow) shows both use the opposite
   convention: a simultaneous chord's dots visually *overlap* into one
   cluster — the overlap itself is the "press together" signal — while
   sequential notes get their own visually distinct position. Our
   pitch-separated-with-line approach never produces that overlap, so it
   never reads as "cluster" the way the reference tools do.

Additional user requests folded into this same redesign, all confirmed via
`AskUserQuestion` during brainstorming:

- Dots go back to **filled solid circles** (matching both reference tools;
  the hollow-stroke look from the previous change reads as a step backward).
- Dots get **bigger** overall, and additionally **scale by `velocity`**
  (louder notes render bigger) — `NoteEvent.velocity` already exists, no
  domain change needed for this part.
- Add a visual signal for **"this note must be held"** — no equivalent
  exists in the domain today (confirmed by exploration below): `NoteEvent`
  is `{midi, velocity}` only, `PieceEngine.trigger()` returns no duration,
  and actual note-off is driven entirely by the player's physical key
  release. This needs new domain data, not just new rendering.

## Exploration findings (grounding the design below)

- `Chord.screenDurationMs` is generated as `next.originalTimeMs -
  this.originalTimeMs` — literal MIDI-derived time, not a uniform per-beat
  slot. Real variance is large within a single piece. Removing the
  compression is a meaningful, visible change, not a no-op.
- Simultaneity is already correctly modeled at the domain level: every note
  in one tap shares one `Chord.notes` array and gets one identical
  `distanceMs` from `upcomingChordsPreview`. The "separate dots + line"
  look is entirely a rendering choice in `PixiRenderer.showUpcoming()` —
  achievable to change with no `types.ts` or `upcomingNotesPreview.ts`
  changes for the clustering part specifically.
- No "hold" concept exists anywhere: `NoteEvent`/`Chord`/`Piece` carry no
  duration field, `PieceEngine.trigger()` returns bare `NoteEvent[]`, and
  `WebAudioEngine` note-off is 100% driven by `DomInputSource`'s physical
  key-up. This is genuinely new domain data.
- All 9 pieces' source MIDI files are vendored at `public/midi/*.mid` — no
  external re-download needed to re-derive hold duration.
- 3 of 9 parse scripts (`parse-beethoven-fur-elise.cjs`,
  `parse-beethoven-moonlight-sonata-mov3.cjs`,
  `parse-chopin-minute-waltz.cjs`) currently **discard `noteOff` events
  entirely** — only `noteOn` is captured. The other 6 already capture
  `noteOff` in some form (confirmed for `parse-chopin-heroic-polonaise.cjs`;
  the remaining 5 need the same check during implementation).

## Design

### 1. Remove the anti-stacking compression — strict timing

Delete `MIN_UPCOMING_GAP_PX` and its enforcement loop in
`PixiRenderer.ts`'s `positionUpcoming()` (added by the previous change's
Task 5). Revert to the plain `yForDistance(remainingMs / lookaheadMs)`
mapping with no post-hoc clamping. Two chords authored close together now
render close together — that closeness becomes informative ("this is a fast
passage") instead of something to hide, and is exactly what strict MIDI
fidelity means.

### 2. Chords render as an overlapping cluster, not pitch-separated dots + line

For a chord with 2+ notes:

- Compute one shared `clusterX = xForMidi(average(chord.midis))` — keeps
  some register information (a bass chord and a treble chord still land in
  different horizontal areas) while no longer spreading individual chord
  members across the keyboard's full width.
- Each note in the chord gets a small deterministic **x-only** offset
  around `clusterX`, evenly spread: for note index `i` of `N` in the chord,
  `offsetX = (i - (N - 1) / 2) * CLUSTER_JITTER_STEP_PX`. Two notes land
  left/right of center; three spread a bit wider; etc.
- **Y is never jittered** — every note in the chord keeps the exact same
  `yForDistance(...)` result. Timing fidelity (point 1) applies to the
  whole chord as a unit; only the within-chord X gets a small nudge purely
  for "more than one circle" legibility.
- `CLUSTER_JITTER_STEP_PX` should be small relative to the (now bigger,
  see §3) dot radius, so members still visibly overlap — e.g. a 16px-radius
  dot with an 8px step still overlaps roughly half its area with its
  neighbor, matching the reference tools' "flower" look.
- The connecting `line` mechanic is removed entirely — the overlap itself
  is the "press together" signal, no line needed.
- A single-note chord (sequential tap) is unaffected: `N === 1` still uses
  `xForMidi(midi)` directly, no offset, exactly as today.

### 3. Filled circles, bigger, scaled by velocity

- `showUpcoming()`'s dots go back to `.fill(color)` instead of
  `.stroke({...})` — drop `UPCOMING_STROKE_WIDTH_PX`.
- Raise the base sizes: `BASE_RADIUS_PX` (hit particle) roughly 24 → 32,
  `UPCOMING_RADIUS_PX` roughly 10 → 16 (exact values tuned visually during
  implementation, per the previous change's own precedent of tuning
  constants after a manual pass).
- New pure helper (alongside `colorForNote`/`shiftLightness` in
  `noteParticleLifecycle.ts`): `radiusForVelocity(baseRadius, velocity)`,
  linearly scaling `baseRadius` by a factor between `MIN_VELOCITY_SCALE`
  (~0.7) and `MAX_VELOCITY_SCALE` (~1.3) as `velocity` ranges 0–127.
  Applied to both the hit particle's radius and each upcoming dot's radius.
- Upcoming vs. hit distinction no longer comes from shape (both filled
  now) — it stays coming from the existing, already-tested `particleStateAt`
  pop/fade animation (hit particles grow/brighten on impact) plus
  `UPCOMING_ALPHA` making upcoming dots read as dimmer/not-yet-played.

### 4. Hold indicator — a stretching tail, driven by real note duration

New optional field on `NoteEvent` (`src/domain/types.ts`):

```ts
export interface NoteEvent {
  readonly midi: MidiNote;
  readonly velocity: Velocity;
  /** How long (ms) this note was actually held in the source performance —
   *  undefined for content not yet regenerated with real noteOff data. */
  readonly holdDurationMs?: number;
}
```

`UpcomingChordPreview` (`src/domain/upcomingNotesPreview.ts`) currently
exposes `midis: readonly MidiNote[]`; it needs to carry `holdDurationMs`
through per note too — rename to `notes: readonly { midi: MidiNote;
holdDurationMs?: number }[]`, updating `upcomingChordsPreview()`'s mapping
and every call site (`PixiRenderer.showUpcoming()`'s `chord.midis` usages,
its tests, and `main.ts` if it touches this shape directly).

Rendering, following the Guitar-Hero convention the user picked: a note's
dot is the *leading* (closer to the hit line) edge of its duration. The
*trailing* edge sits at `yForDistance((remainingMs + holdDurationMs) /
lookaheadMs)` — further from the hit line, since it hasn't arrived yet.
Given `yForDistance` is linear, the tail's pixel length reduces to a
constant per note: `holdDurationMs / lookaheadMs * (hitLineY - topY)`,
independent of the note's current position — draw it as a capsule (a line
the width of the dot's own diameter, with rounded caps) from the dot
extending upward (away from the hit line) by that length.

- Only draw a tail when `holdDurationMs` exceeds `HOLD_INDICATOR_MIN_MS`
  (e.g. ~180ms) — normal short notes shouldn't grow a visible nub.
- Cap the rendered tail length (e.g. at the full fall-lane height) so an
  unusually long held note can't stretch off the top of the screen.
- Applies to both upcoming dots and (more subtly, shorter-lived given the
  particle lifetime) hit particles, so a held note still shows its tail
  briefly after being played.

### 5. Content regeneration

All 9 pieces need regenerating from their vendored `public/midi/*.mid` to
populate `holdDurationMs`:

- For the 3 scripts that discard `noteOff`
  (`parse-beethoven-fur-elise.cjs`, `parse-beethoven-moonlight-sonata-
  mov3.cjs`, `parse-chopin-minute-waltz.cjs`), add `noteOff` event capture
  (mirroring the pattern already in `parse-chopin-heroic-polonaise.cjs`:
  `events.push({ tick, type: "noteOff", channel, note })` on a `0x80`
  status byte, or a `0x90` with velocity `0` per the MIDI spec's running-
  status convention already handled for `noteOn`).
- For the other 5 scripts, verify (don't assume) they already capture
  `noteOff` correctly before reusing that logic — check each individually
  during implementation rather than batch-assuming from the one script
  inspected so far.
- Compute each note's `holdDurationMs` as the matched `noteOff.tick` minus
  its `noteOn.tick`, converted to ms via the same tempo/tick-to-ms
  conversion each script already does for `originalTimeMs`.
- **Safety check per regenerated piece**: the new output's
  `originalTimeMs`, `notes[].midi`, and `notes[].velocity` for every chord
  must byte-for-byte match the current committed file — this is additive
  data only. Diff the regenerated file against the current one, and the
  only expected changes should be the new `holdDurationMs` fields (plus
  whatever the raw-events formatting needs to carry it). Several of these
  pieces have a paired `*-verified-*` doc in `docs/plans/` recording that
  their performance data was manually checked — regeneration must not
  silently drift that already-verified data.

## Non-goals

- No change to gameplay mechanics (trigger/seek/pedal-hold logic).
- No change to actual audio playback duration — `holdDurationMs` is a
  visual cue only in this pass; wiring it into `WebAudioEngine` so playback
  itself enforces/suggests hold length is a separate, later decision.
- No background/menu changes — those shipped already and aren't revisited
  here.

## Rejected alternatives

- **Keep `MIN_UPCOMING_GAP_PX` but tune it smaller**: rejected — any
  nonzero forced-minimum-gap still distorts real timing whenever a passage
  is fast enough to trigger it, which is often, per the exploration's
  sampled duration data. The user wants zero distortion, not less.
- **Cluster jitter in both X and Y**: rejected — jittering Y would blur the
  one signal (exact fall position) that must stay perfectly time-accurate
  per the "respect MIDI timing" requirement; X-only jitter is enough for
  "more than one dot" legibility without touching timing.
- **Ring/cooldown or plain glow for the hold indicator**: rejected by the
  user in favor of the stretching bar — more visually obvious at a glance,
  even though it's the larger rendering change of the three options
  presented.
- **Approximate hold duration from `screenDurationMs`** (time until the
  next chord, no MIDI re-parsing needed): rejected by the user in favor of
  real `noteOff`-derived duration, despite the extra script/regeneration
  work — accuracy over convenience.

## Open follow-ups for implementation

- Exact `CLUSTER_JITTER_STEP_PX`, updated `BASE_RADIUS_PX`/
  `UPCOMING_RADIUS_PX`, `MIN_VELOCITY_SCALE`/`MAX_VELOCITY_SCALE`, and
  `HOLD_INDICATOR_MIN_MS` are all empirical — tune visually per piece,
  same as the previous change's own precedent.
- Need to individually verify `noteOff` handling in all 9 parse scripts
  (only 1 of 9 was inspected so far) before assuming which need new
  parsing logic versus already having it.
- `PixiRenderer.test.ts` and `noteParticleLifecycle.test.ts` both need
  substantial rework again (fill vs. stroke reverts, cluster-x tests
  replacing the connecting-line tests, new radius/velocity tests, new
  tail-rendering tests) — expect most of the previous change's tests in
  these two files to be replaced, not just extended.
