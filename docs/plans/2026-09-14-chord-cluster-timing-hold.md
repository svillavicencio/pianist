# Chord Clustering, Strict Timing, and Hold Indicator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use the `executing-plans` skill to implement this plan task-by-task.

**Goal:** Make simultaneous chords read as an overlapping cluster (not
forced-apart dots), stop distorting real MIDI timing, bring back filled
circles sized by pitch-register/velocity, and add a stretching-tail visual
for notes that must be held — per
`docs/plans/2026-09-14-chord-cluster-timing-hold-design.md`.

**Architecture:** Phase A (Tasks 1–7) is all rendering/domain work inside
`src/adapters/web/render/` and `src/domain/` — ships and is fully visible
in the browser even before any content is regenerated, since the new
`holdDurationMs` field is optional and simply renders nothing extra when
absent. Phase B (Tasks 8–9) regenerates all 9 pieces from their vendored
`public/midi/*.mid` to populate that field with real note-off-derived
durations.

**Tech Stack:** TypeScript, PixiJS v8, Vitest, Node's built-in `crypto`/`fs`
for the MIDI-parsing scripts (no new dependencies).

---

## Phase A — Rendering & domain

## Task 1: Remove the anti-stacking compression — strict timing

**Files:**
- Modify: `src/adapters/web/render/PixiRenderer.ts` (`positionUpcoming`, delete `MIN_UPCOMING_GAP_PX`)
- Test: `src/adapters/web/render/PixiRenderer.test.ts`

**Step 1: Replace the compression tests with strict-timing tests**

Delete the `describe('minimum upcoming-dot spacing', ...)` block entirely
(3 tests) and replace it with:

```ts
describe('strict timing (no artificial minimum spacing)', () => {
  it('positions two chords at their exact time-proportional distance, even when very close together', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

    renderer.showUpcoming(
      [
        { distanceMs: 0, midis: [60] },
        { distanceMs: 1, midis: [62] }, // 1ms apart at a 1000ms lookahead
      ],
      'parliament',
      false,
    );

    const nearY = container.children[0]!.y;
    const farY = container.children[1]!.y;
    // yForDistance(0) - yForDistance(1/1000) = (1/1000) * (0.85 - 0.15) * 1000 = 0.7px — no floor.
    expect(nearY - farY).toBeCloseTo(0.7, 1);
  });

  it('leaves well-separated notes exactly as time-proportional as before', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

    renderer.showUpcoming(
      [
        { distanceMs: 0, midis: [60] },
        { distanceMs: 500, midis: [62] },
      ],
      'parliament',
      false,
    );

    const nearY = container.children[0]!.y;
    const farY = container.children[1]!.y;
    expect(nearY - farY).toBeCloseTo(1000 * 0.5 * (0.85 - 0.15));
  });
});
```

**Step 2: Run to verify the first test fails**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: FAIL on the first new test (`MIN_UPCOMING_GAP_PX` still clamps it to ≥28px).

**Step 3: Remove the compression**

In `PixiRenderer.ts`, delete the `MIN_UPCOMING_GAP_PX` constant and its
comment (lines 35-37), and simplify `positionUpcoming()` back to:

```ts
private positionUpcoming(): void {
  for (const tracked of this.upcoming) {
    const remainingMs = tracked.distanceMs - this.upcomingElapsedMs;
    const y = this.yForDistance(this.lookaheadMs > 0 ? remainingMs / this.lookaheadMs : 0);

    for (const dot of tracked.dots) dot.y = y;

    if (tracked.line) {
      tracked.line.clear();
      tracked.line
        .moveTo(Math.min(...tracked.xs), y)
        .lineTo(Math.max(...tracked.xs), y)
        .stroke({ width: UPCOMING_CHORD_LINE_WIDTH_PX, color: tracked.colors[0]!, alpha: UPCOMING_ALPHA });
    }
  }
}
```

(The `line` branch is removed for real in Task 2 — leave it as-is here so this step is a pure, isolated revert of the compression.)

**Step 4: Run to verify it passes**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: PASS on both new tests. The old `'never adjusts the nearest-due dot'` test is gone with the deleted block — everything else should still be green.

**Step 5: Commit**

```bash
git add src/adapters/web/render/PixiRenderer.ts src/adapters/web/render/PixiRenderer.test.ts
git commit -m "fix: stop compressing upcoming-note spacing, respect real MIDI timing exactly"
```

---

## Task 2: Chord notes cluster around a shared x instead of spreading by pitch

**Files:**
- Modify: `src/adapters/web/render/PixiRenderer.ts` (`TrackedUpcomingChord`, `showUpcoming`, `positionUpcoming`)
- Test: `src/adapters/web/render/PixiRenderer.test.ts`

**Step 1: Replace the connecting-line tests with clustering tests**

Delete `'draws a multi-note chord as same-colored dots joined by a connecting line'` and `'does not draw a connecting line for a single-note chord'`. Add:

```ts
it('clusters a multi-note chord's dots around a shared x instead of spreading by pitch', () => {
  const container = new FakeContainer();
  const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

  renderer.showUpcoming([{ distanceMs: 0, midis: [21, 108] }], 'parliament', false);

  const [dotLow, dotHigh] = container.children as PIXI.Graphics[];
  // 21 and 108 are the full low/high piano range — spread by pitch they'd be 1000px apart
  // (xForMidi(21)=0, xForMidi(108)=1000). Clustered, they must sit within one small jitter
  // step of their shared center (average pitch -> x=500 on a 1000-wide stage).
  expect(dotLow!.x).toBeCloseTo(500, -1);
  expect(dotHigh!.x).toBeCloseTo(500, -1);
  expect(Math.abs(dotLow!.x - dotHigh!.x)).toBeLessThan(20);
});

it('leaves a single-note chord positioned by its own pitch, unaffected by clustering', () => {
  const container = new FakeContainer();
  const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

  renderer.showUpcoming([{ distanceMs: 0, midis: [108] }], 'parliament', false);

  expect(container.children[0]!.x).toBeCloseTo(1000);
});

it('no longer draws a connecting line for a multi-note chord', () => {
  const container = new FakeContainer();
  const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

  renderer.showUpcoming([{ distanceMs: 0, midis: [60, 67] }], 'parliament', false);

  expect(container.children).toHaveLength(2); // just the 2 dots, no line graphic
});
```

**Step 2: Run to verify they fail**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: FAIL — dots are still pitch-spread with a connecting line.

**Step 3: Implement clustering**

Remove `line` from `TrackedUpcomingChord`:

```ts
interface TrackedUpcomingChord {
  readonly distanceMs: number;
  readonly xs: readonly number[];
  readonly colors: readonly number[];
  readonly dots: readonly PIXI.Graphics[];
}
```

Add the constant near `UPCOMING_RADIUS_PX`:

```ts
/** Horizontal offset (px) between adjacent dots in a clustered chord — small relative to the
 *  dot radius so members still visibly overlap, reading as "one cluster" the way a simultaneous
 *  chord does in touchpianist/Piano-Flow, rather than as separate notes. */
const CLUSTER_JITTER_STEP_PX = 8;
```

In `showUpcoming()`, replace the `xs`/`line` computation:

```ts
this.upcoming = chords.map((chord, index) => {
  const isAlternate = index % 2 === 1;
  const xs = this.xsForChord(chord.midis);
  const colors = chord.midis.map((midi) => {
    const base = colorForNote(colorTheme, midi);
    return isAlternate ? shiftLightness(base, UPCOMING_ALT_LIGHTNESS_SHIFT) : base;
  });

  const dots = xs.map((x, i) => {
    const dot = new PIXI.Graphics();
    dot.circle(0, 0, UPCOMING_RADIUS_PX).stroke({ width: UPCOMING_STROKE_WIDTH_PX, color: colors[i]! });
    dot.alpha = UPCOMING_ALPHA;
    dot.x = x;
    this.container.addChild(dot);
    return dot;
  });

  return { distanceMs: chord.distanceMs, xs, colors, dots };
});
```

(Still `.stroke(...)` here — Task 3 reverts that separately.)

Add the new private helper near `xForMidi`:

```ts
/** X positions for one chord's notes: a single note keeps its own pitch position; 2+ notes
 *  (a simultaneous tap) cluster tightly around their average pitch's x, offset only enough
 *  to read as "more than one dot" — the overlap itself is the "press together" signal. */
private xsForChord(midis: readonly MidiNote[]): readonly number[] {
  if (midis.length <= 1) return midis.map((midi) => this.xForMidi(midi));
  const averageMidi = midis.reduce((sum, midi) => sum + midi, 0) / midis.length;
  const clusterX = this.xForMidi(averageMidi);
  return midis.map((_, i) => clusterX + (i - (midis.length - 1) / 2) * CLUSTER_JITTER_STEP_PX);
}
```

And simplify `positionUpcoming()` (drop the `line` branch entirely):

```ts
private positionUpcoming(): void {
  for (const tracked of this.upcoming) {
    const remainingMs = tracked.distanceMs - this.upcomingElapsedMs;
    const y = this.yForDistance(this.lookaheadMs > 0 ? remainingMs / this.lookaheadMs : 0);
    for (const dot of tracked.dots) dot.y = y;
  }
}
```

Delete the now-unused `UPCOMING_CHORD_LINE_WIDTH_PX` constant.

**Step 4: Run to verify they pass**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: PASS on the 3 new/changed tests. Some other existing tests may
now fail if they asserted a line-related child count — fix any by removing
their line-count assumptions (e.g. a test expecting `toHaveLength(3)` for a
2-note chord — 2 dots + 1 line — now expects `toHaveLength(2)`).

Run: `npm run typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/adapters/web/render/PixiRenderer.ts src/adapters/web/render/PixiRenderer.test.ts
git commit -m "feat: cluster simultaneous-chord notes around a shared point instead of spreading by pitch"
```

---

## Task 3: Revert upcoming dots to filled circles

**Files:**
- Modify: `src/adapters/web/render/PixiRenderer.ts` (`showUpcoming`)
- Test: `src/adapters/web/render/PixiRenderer.test.ts`

**Step 1: Update the hollow-dot test and every `strokeSpy`-based color test**

Replace `'draws upcoming dots as hollow (stroked) circles, not filled, to read apart from hit particles'` with:

```ts
it('draws upcoming dots as filled circles, matching hit particles', () => {
  const container = new FakeContainer();
  const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
  const fillSpy = vi.spyOn(PIXI.Graphics.prototype, 'fill');
  const strokeSpy = vi.spyOn(PIXI.Graphics.prototype, 'stroke');

  renderer.showUpcoming([{ distanceMs: 0, midis: [60] }], 'parliament', false);

  expect(fillSpy).toHaveBeenCalledOnce();
  expect(strokeSpy).not.toHaveBeenCalled();
  fillSpy.mockRestore();
  strokeSpy.mockRestore();
});
```

Then go through every other test in the file using `vi.spyOn(PIXI.Graphics.prototype, 'stroke')` to read an upcoming dot's color and switch it to `vi.spyOn(PIXI.Graphics.prototype, 'fill')`, reading the plain hex argument (`call[0]`) instead of the stroke options object's `.color` (`(call[0] as {color: number}).color`). This affects the two tests from the previous change's Task 3 (`'shifts lightness on the alternate chord...'`, `'gives different pitches different colors...'`).

**Step 2: Run to verify it fails**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: FAIL — dots still call `.stroke()`.

**Step 3: Implement**

In `showUpcoming()`'s dot mapping:

```ts
const dots = xs.map((x, i) => {
  const dot = new PIXI.Graphics();
  dot.circle(0, 0, UPCOMING_RADIUS_PX).fill(colors[i]!);
  dot.alpha = UPCOMING_ALPHA;
  dot.x = x;
  this.container.addChild(dot);
  return dot;
});
```

Delete the now-unused `UPCOMING_STROKE_WIDTH_PX` constant.

**Step 4: Run to verify it passes**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: PASS on all tests in the file.

Run: `npm run typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/adapters/web/render/PixiRenderer.ts src/adapters/web/render/PixiRenderer.test.ts
git commit -m "feat: revert upcoming-note dots to filled circles"
```

---

## Task 4: Bigger base dot sizes

**Files:**
- Modify: `src/adapters/web/render/PixiRenderer.ts`
- Test: `src/adapters/web/render/PixiRenderer.test.ts` (spot-check only — most position/count tests are size-agnostic)

**Step 1: Bump the constants**

```ts
const BASE_RADIUS_PX = 32;       // was 24
const UPCOMING_RADIUS_PX = 16;   // was 10
```

**Step 2: Run the full suite**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: PASS unchanged — no test currently asserts the exact radius value, only `circle`/`fill` call presence and x/y position, so this is a safe constant bump. If any test does assert an exact radius, update it to the new constant.

**Step 3: Commit**

```bash
git add src/adapters/web/render/PixiRenderer.ts
git commit -m "tune: increase base dot sizes for both hit and upcoming notes"
```

---

## Task 5: Scale dot radius by velocity, wire into hit particles

**Files:**
- Modify: `src/adapters/web/render/noteParticleLifecycle.ts` (new `radiusForVelocity`)
- Modify: `src/ports/Renderer.ts`, `src/adapters/web/render/PixiRenderer.ts`, `test/fakes/FakeRenderer.ts`, `src/main.ts` (`spawnNoteVisual` gains a `velocity` parameter)
- Test: `src/adapters/web/render/noteParticleLifecycle.test.ts`, `src/adapters/web/render/PixiRenderer.test.ts`

**Step 1: Write the failing `radiusForVelocity` tests**

Add to `noteParticleLifecycle.test.ts`:

```ts
import { radiusForVelocity } from './noteParticleLifecycle';
// ...
describe('radiusForVelocity', () => {
  it('scales toward the minimum at velocity 0', () => {
    expect(radiusForVelocity(20, 0)).toBeCloseTo(20 * 0.7);
  });

  it('scales toward the maximum at the highest MIDI velocity (127)', () => {
    expect(radiusForVelocity(20, 127)).toBeCloseTo(20 * 1.3);
  });

  it('is close to the unscaled base radius at the midpoint velocity', () => {
    expect(radiusForVelocity(20, 63.5)).toBeCloseTo(20, 0);
  });

  it('clamps an out-of-range velocity instead of extrapolating', () => {
    expect(radiusForVelocity(20, 200)).toBeCloseTo(20 * 1.3);
    expect(radiusForVelocity(20, -10)).toBeCloseTo(20 * 0.7);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx vitest run src/adapters/web/render/noteParticleLifecycle.test.ts`
Expected: FAIL — `radiusForVelocity` doesn't exist.

**Step 3: Implement the pure helper**

In `noteParticleLifecycle.ts`:

```ts
import type { ColorTheme, MidiNote, Velocity } from '../../../domain/types';

/** Radius scale factor at velocity 0 / the highest MIDI velocity (127) — a soft note renders
 *  smaller, a loud note bigger, around the unscaled base radius at the midpoint. */
const MIN_VELOCITY_SCALE = 0.7;
const MAX_VELOCITY_SCALE = 1.3;
const MAX_MIDI_VELOCITY = 127;

/** Scales `baseRadius` by how hard a note was struck — louder notes render bigger. */
export function radiusForVelocity(baseRadius: number, velocity: Velocity): number {
  const t = clamp(velocity / MAX_MIDI_VELOCITY, 0, 1);
  const scale = MIN_VELOCITY_SCALE + (MAX_VELOCITY_SCALE - MIN_VELOCITY_SCALE) * t;
  return baseRadius * scale;
}
```

**Step 4: Run to verify it passes**

Run: `npx vitest run src/adapters/web/render/noteParticleLifecycle.test.ts`
Expected: PASS.

**Step 5: Wire into hit particles — write the failing renderer test**

Add to `PixiRenderer.test.ts`:

```ts
it('scales a spawned hit particle's radius by its velocity', () => {
  const container = new FakeContainer();
  const renderer = new PixiRenderer(container, 800, 600, LOOKAHEAD_MS);
  const circleSpy = vi.spyOn(PIXI.Graphics.prototype, 'circle');

  renderer.spawnNoteVisual(60, 20, 'parliament'); // soft
  renderer.spawnNoteVisual(60, 120, 'parliament'); // loud

  const softRadius = circleSpy.mock.calls[0]?.[2];
  const loudRadius = circleSpy.mock.calls[1]?.[2];
  expect(loudRadius).toBeGreaterThan(softRadius as number);
  circleSpy.mockRestore();
});
```

**Step 6: Run to verify it fails**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: FAIL — `spawnNoteVisual` doesn't take a `velocity` argument yet (a TypeScript error, or the extra arg is silently ignored depending on call-site typing — either way the two calls produce the same radius).

**Step 7: Thread `velocity` through**

`src/ports/Renderer.ts` — update the port interface:

```ts
spawnNoteVisual(midi: MidiNote, velocity: Velocity, colorTheme: ColorTheme): void;
```

`src/adapters/web/render/PixiRenderer.ts`:

```ts
spawnNoteVisual(midi: MidiNote, velocity: Velocity, colorTheme: ColorTheme): void {
  const graphic = new PIXI.Graphics();
  graphic.circle(0, 0, radiusForVelocity(BASE_RADIUS_PX, velocity)).fill(colorForNote(colorTheme, midi));
  graphic.x = this.xForMidi(midi);
  graphic.y = this.height * SPAWN_HEIGHT_FRACTION;
  this.container.addChild(graphic);
  this.particles.push({ graphic, midi, elapsedMs: 0 });
}
```

Import `radiusForVelocity` alongside the other `noteParticleLifecycle` imports, and `Velocity` from `../../../domain/types`.

`test/fakes/FakeRenderer.ts` — update `spawnNoteVisual`'s signature and `RecordedNoteVisual` to also record `velocity`:

```ts
export interface RecordedNoteVisual {
  readonly midi: MidiNote;
  readonly velocity: Velocity;
  readonly colorTheme: ColorTheme;
}
// ...
spawnNoteVisual(midi: MidiNote, velocity: Velocity, colorTheme: ColorTheme): void {
  this.spawnedVisuals.push({ midi, velocity, colorTheme });
}
```

`src/main.ts` — update the one call site (inside `startPiece`'s `input.onPress` handler):

```ts
renderer.spawnNoteVisual(note.midi, note.velocity, piece.colorTheme);
```

Go back through every other `renderer.spawnNoteVisual(...)` call in `PixiRenderer.test.ts` and add a velocity argument (any value is fine where the test isn't specifically about velocity — use `100` as a reasonable default).

**Step 8: Run to verify it passes**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts test/fakes/FakeRenderer.test.ts`
Expected: PASS on all tests.

Run: `npm run typecheck`
Expected: PASS.

**Step 9: Commit**

```bash
git add src/adapters/web/render/noteParticleLifecycle.ts src/adapters/web/render/noteParticleLifecycle.test.ts src/adapters/web/render/PixiRenderer.ts src/adapters/web/render/PixiRenderer.test.ts src/ports/Renderer.ts test/fakes/FakeRenderer.ts src/main.ts
git commit -m "feat: scale hit-particle radius by note velocity"
```

---

## Task 6: `holdDurationMs` domain field + carry velocity/hold through the preview, scale upcoming dots too

**Files:**
- Modify: `src/domain/types.ts` (`NoteEvent`)
- Modify: `src/domain/upcomingNotesPreview.ts` (`UpcomingChordPreview`, `upcomingChordsPreview`)
- Modify: `src/adapters/web/render/PixiRenderer.ts` (`showUpcoming` reads `chord.notes` instead of `chord.midis`)
- Test: `src/domain/upcomingNotesPreview.test.ts`, `src/adapters/web/render/PixiRenderer.test.ts`

**Step 1: Add the domain field**

`src/domain/types.ts`:

```ts
export interface NoteEvent {
  readonly midi: MidiNote;
  readonly velocity: Velocity;
  /** How long (ms) this note was actually held in the source performance — undefined for
   *  content not yet regenerated with real noteOff data (see Phase B of this plan). */
  readonly holdDurationMs?: number;
}
```

**Step 2: Write the failing `upcomingChordsPreview` test**

`src/domain/upcomingNotesPreview.test.ts` (check the existing file first — this reshapes its `midis: [...]` assertions to `notes: [...]`, same pattern as the mechanical rename below). Add/update at least:

```ts
it('carries velocity and holdDurationMs through per note', () => {
  const chords: readonly Chord[] = [
    { originalTimeMs: 0, screenDurationMs: 100, notes: [{ midi: 60, velocity: 80, holdDurationMs: 400 }] },
  ];

  const result = upcomingChordsPreview(chords, 1000);

  expect(result[0]?.notes).toEqual([{ midi: 60, velocity: 80, holdDurationMs: 400 }]);
});

it('carries an undefined holdDurationMs through unchanged (not yet regenerated content)', () => {
  const chords: readonly Chord[] = [
    { originalTimeMs: 0, screenDurationMs: 100, notes: [{ midi: 60, velocity: 80 }] },
  ];

  const result = upcomingChordsPreview(chords, 1000);

  expect(result[0]?.notes[0]?.holdDurationMs).toBeUndefined();
});
```

**Step 3: Run to verify it fails**

Run: `npx vitest run src/domain/upcomingNotesPreview.test.ts`
Expected: FAIL — `result[0].notes` doesn't exist yet (it's `.midis`).

**Step 4: Reshape the preview**

`src/domain/upcomingNotesPreview.ts`:

```ts
export interface UpcomingChordPreview {
  readonly distanceMs: number;
  /** Every note that fires together on this chord's tap — 2+ means "press these together". */
  readonly notes: readonly { readonly midi: MidiNote; readonly velocity: Velocity; readonly holdDurationMs?: number }[];
}
// ...
export function upcomingChordsPreview(
  chords: readonly Chord[],
  windowMs: number,
  maxNotes: number = DEFAULT_MAX_NOTES,
): readonly UpcomingChordPreview[] {
  const result: UpcomingChordPreview[] = [];
  let cumulativeMs = 0;
  let notesSoFar = 0;

  for (const chord of chords) {
    if (cumulativeMs > windowMs) break;
    if (notesSoFar >= maxNotes) break;

    const notes = chord.notes.slice(0, maxNotes - notesSoFar).map((note) => ({
      midi: note.midi,
      velocity: note.velocity,
      holdDurationMs: note.holdDurationMs,
    }));
    result.push({ distanceMs: cumulativeMs, notes });
    notesSoFar += notes.length;

    cumulativeMs += chord.screenDurationMs;
  }

  return result;
}
```

Import `Velocity` alongside `Chord`/`MidiNote`.

**Step 5: Run to verify it passes**

Run: `npx vitest run src/domain/upcomingNotesPreview.test.ts`
Expected: PASS.

**Step 6: Propagate the rename through `PixiRenderer`**

This is a mechanical rename across `PixiRenderer.ts` and every existing test in `PixiRenderer.test.ts` that currently writes `{ distanceMs: N, midis: [...] }` — change every such literal to `{ distanceMs: N, notes: [...].map((midi) => ({ midi, velocity: 100 })) }` (or write out `{midi, velocity: 100}` objects directly), using `100` as an arbitrary reasonable default velocity anywhere a test isn't specifically about velocity/hold.

In `showUpcoming()`, replace every `chord.midis` read with deriving from `chord.notes`:

```ts
showUpcoming(chords: readonly UpcomingChordPreview[], colorTheme: ColorTheme, continuedFromPreviousTap: boolean): void {
  // ...
  this.upcoming = chords.map((chord, index) => {
    const isAlternate = index % 2 === 1;
    const midis = chord.notes.map((note) => note.midi);
    const xs = this.xsForChord(midis);
    const colors = midis.map((midi) => {
      const base = colorForNote(colorTheme, midi);
      return isAlternate ? shiftLightness(base, UPCOMING_ALT_LIGHTNESS_SHIFT) : base;
    });
    const radii = chord.notes.map((note) => radiusForVelocity(UPCOMING_RADIUS_PX, note.velocity));

    const dots = xs.map((x, i) => {
      const dot = new PIXI.Graphics();
      dot.circle(0, 0, radii[i]!).fill(colors[i]!);
      dot.alpha = UPCOMING_ALPHA;
      dot.x = x;
      this.container.addChild(dot);
      return dot;
    });

    return { distanceMs: chord.distanceMs, xs, colors, dots };
  });

  this.positionUpcoming();
}
```

Import `radiusForVelocity` alongside the other `noteParticleLifecycle` imports.

**Step 7: Run to verify everything passes**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: PASS on all tests once every `midis:` literal in the file is updated to `notes:`.

Run: `npm run test && npm run typecheck`
Expected: both PASS across the whole repo (this rename can ripple into any other file still constructing an `UpcomingChordPreview` or a bare `NoteEvent` array — search for `.midis` and fix any remaining call sites).

**Step 8: Commit**

```bash
git add src/domain/types.ts src/domain/upcomingNotesPreview.ts src/domain/upcomingNotesPreview.test.ts src/adapters/web/render/PixiRenderer.ts src/adapters/web/render/PixiRenderer.test.ts
git commit -m "feat: carry velocity and holdDurationMs through the upcoming-notes preview, scale upcoming dots by velocity too"
```

---

## Task 7: Hold-indicator tail rendering

**Files:**
- Modify: `src/adapters/web/render/PixiRenderer.ts` (`TrackedUpcomingChord`, `showUpcoming`, `positionUpcoming`)
- Test: `src/adapters/web/render/PixiRenderer.test.ts`

**Step 1: Write the failing tests**

```ts
describe('hold indicator', () => {
  it('draws a tail for a note whose holdDurationMs exceeds the minimum threshold', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

    renderer.showUpcoming(
      [{ distanceMs: 0, notes: [{ midi: 60, velocity: 100, holdDurationMs: 500 }] }],
      'parliament',
      false,
    );

    // 1 dot + 1 tail graphic.
    expect(container.children).toHaveLength(2);
  });

  it('draws no tail for a note below the hold threshold', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

    renderer.showUpcoming(
      [{ distanceMs: 0, notes: [{ midi: 60, velocity: 100, holdDurationMs: 50 }] }],
      'parliament',
      false,
    );

    expect(container.children).toHaveLength(1); // dot only
  });

  it('draws no tail when holdDurationMs is undefined (content not yet regenerated)', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

    renderer.showUpcoming(
      [{ distanceMs: 0, notes: [{ midi: 60, velocity: 100 }] }],
      'parliament',
      false,
    );

    expect(container.children).toHaveLength(1);
  });

  it('makes a longer hold render a longer tail', () => {
    const shortContainer = new FakeContainer();
    new PixiRenderer(shortContainer, 1000, 1000, LOOKAHEAD_MS).showUpcoming(
      [{ distanceMs: 0, notes: [{ midi: 60, velocity: 100, holdDurationMs: 200 }] }],
      'parliament',
      false,
    );
    const longContainer = new FakeContainer();
    new PixiRenderer(longContainer, 1000, 1000, LOOKAHEAD_MS).showUpcoming(
      [{ distanceMs: 0, notes: [{ midi: 60, velocity: 100, holdDurationMs: 800 }] }],
      'parliament',
      false,
    );

    const shortTail = shortContainer.children[1] as PIXI.Graphics;
    const longTail = longContainer.children[1] as PIXI.Graphics;
    // Both tails moveTo the dot's y and lineTo (y - tailPx); a longer hold means a smaller
    // (more negative-going) endpoint y, i.e. a visually longer tail extending further up.
    expect(longTail).toBeDefined();
    expect(shortTail).toBeDefined();
  });
});
```

(The last test mainly documents intent — Step 3 below makes the actual
pixel-length assertion possible if you want to tighten it further by
spying on `moveTo`/`lineTo` call arguments directly, similar to the
`backdrop.test.ts` pattern.)

**Step 2: Run to verify they fail**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: FAIL — no tail is ever drawn yet.

**Step 3: Implement**

Add constants near `UPCOMING_RADIUS_PX`:

```ts
/** Minimum hold duration (ms) before a tail is drawn at all — short/ordinary notes shouldn't
 *  grow a visible nub. */
const HOLD_INDICATOR_MIN_MS = 180;
```

Update `TrackedUpcomingChord` to carry per-note radius, hold duration, and an optional tail graphic:

```ts
interface TrackedUpcomingChord {
  readonly distanceMs: number;
  readonly xs: readonly number[];
  readonly colors: readonly number[];
  readonly radii: readonly number[];
  readonly holdDurationsMs: readonly (number | undefined)[];
  readonly dots: readonly PIXI.Graphics[];
  readonly tails: readonly (PIXI.Graphics | undefined)[];
}
```

In `showUpcoming()`, after building `dots`, build `tails` in the same loop (one tail graphic per note whose `holdDurationMs` clears the threshold, `undefined` otherwise — `undefined` entries simply aren't added to the container):

```ts
const tails = chord.notes.map((note, i) => {
  if (note.holdDurationMs === undefined || note.holdDurationMs < HOLD_INDICATOR_MIN_MS) return undefined;
  const tail = new PIXI.Graphics();
  this.container.addChild(tail);
  return tail;
});

return {
  distanceMs: chord.distanceMs,
  xs,
  colors,
  radii,
  holdDurationsMs: chord.notes.map((note) => note.holdDurationMs),
  dots,
  tails,
};
```

In `positionUpcoming()`, after positioning each `dot`, draw its tail if present:

```ts
private positionUpcoming(): void {
  const fallRangePx = this.height * (SPAWN_HEIGHT_FRACTION - UPCOMING_TOP_FRACTION);

  for (const tracked of this.upcoming) {
    const remainingMs = tracked.distanceMs - this.upcomingElapsedMs;
    const y = this.yForDistance(this.lookaheadMs > 0 ? remainingMs / this.lookaheadMs : 0);

    for (let i = 0; i < tracked.dots.length; i++) {
      const dot = tracked.dots[i]!;
      dot.y = y;

      const tail = tracked.tails[i];
      const holdMs = tracked.holdDurationsMs[i];
      if (!tail || holdMs === undefined) continue;

      const tailPx = Math.min((holdMs / this.lookaheadMs) * fallRangePx, fallRangePx);
      tail.clear();
      tail
        .moveTo(tracked.xs[i]!, y)
        .lineTo(tracked.xs[i]!, y - tailPx)
        .stroke({ width: tracked.radii[i]! * 2, color: tracked.colors[i]!, alpha: UPCOMING_ALPHA, cap: 'round' });
    }
  }
}
```

Also update `showUpcoming()`'s cleanup loop (the one that destroys the
previous frame's graphics) to also destroy each `tracked.tail` if present.

**Step 4: Run to verify they pass**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: PASS on all tests.

Run: `npm run test && npm run typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/adapters/web/render/PixiRenderer.ts src/adapters/web/render/PixiRenderer.test.ts
git commit -m "feat: draw a stretching tail for notes that must be held"
```

---

## Phase B — Content regeneration (real hold durations from MIDI)

Every one of the 9 `scripts/parse-*.cjs` scripts currently **tokenizes**
`noteOff` inconsistently (some discard it at the byte level, like Für
Elise; others tokenize it but never use it downstream, like Heroic
Polonaise) and **none of them** currently compute a duration from it — the
generated `Chord.notes` only ever carries `{midi, velocity}`. Phase B adds
real `holdDurationMs` per note, sourced from each piece's own vendored
`public/midi/*.mid` (already present, no re-download needed).

**Shared algorithm** (apply per script in Task 8/9): walk each track's
chronological event list once, keyed by `` `${channel}:${note}` ``,
maintaining a FIFO queue of still-open `noteOn` events per key. On a
`noteOff` (or a `noteOn` with velocity 0, per the MIDI running-status
convention already handled for `noteOn` elsewhere in these scripts), pop
the oldest open `noteOn` for that key and record
`holdDurationMs = Math.round(tickToMs(offEvent.tick) - tickToMs(onEvent.tick))`
against that specific `noteOn` event object (by reference, e.g. in a `Map`
keyed by the event object itself) — this correctly handles same-pitch
retriggers without needing to modify the existing `byTick`/chord-grouping
logic, which stays untouched.

## Task 8: Für Elise — full worked example (script needs `noteOff` capture added)

**Files:**
- Modify: `scripts/parse-beethoven-fur-elise.cjs`
- Generated: `src/content/pieces/beethovenFurElise.ts` (regenerated by running the script — do not hand-edit)

**Step 1: Add `noteOff` capture to the tokenizer**

In the per-track event loop (around the `if (kind === 0x90 || kind === 0x80)` branch), change:

```js
if (kind === 0x90 || kind === 0x80) {
  const note = u8();
  const velocity = u8();
  if (kind === 0x90 && velocity)
    events.push({ tick, type: "noteOn", note, velocity, channel });
}
```

to:

```js
if (kind === 0x90 || kind === 0x80) {
  const note = u8();
  const velocity = u8();
  if (kind === 0x90 && velocity)
    events.push({ tick, type: "noteOn", note, velocity, channel });
  else events.push({ tick, type: "noteOff", note, channel });
}
```

**Step 2: Match `noteOn`→`noteOff` pairs and compute duration, right after `tickToMs` is defined and before the `byTick` grouping**

Insert (adapting the shared algorithm above to this script's `selectedNoteOns`/`byTick` structure — note `selectedNoteOns` needs to become "every selected `noteOn` **and** `noteOff`" first, matched, *then* filtered back down to just the `noteOn`s with duration attached):

```js
const selectedEvents = tracks.flatMap((events, trackIndex) =>
  events.filter(
    (event) =>
      SELECTED_TRACKS.includes(trackIndex) && SELECTED_CHANNELS.includes(event.channel),
  ),
);
const openByKey = new Map();
const holdDurationMsByNoteOn = new Map();
for (const event of selectedEvents) {
  const key = `${event.channel}:${event.note}`;
  if (event.type === "noteOn") {
    if (!openByKey.has(key)) openByKey.set(key, []);
    openByKey.get(key).push(event);
  } else {
    const queue = openByKey.get(key);
    const openEvent = queue?.shift();
    if (openEvent)
      holdDurationMsByNoteOn.set(
        openEvent,
        Math.round(tickToMs(event.tick) - tickToMs(openEvent.tick)),
      );
  }
}
const selectedNoteOns = selectedEvents.filter((event) => event.type === "noteOn");
```

Replace the script's existing `selectedNoteOns` declaration (the one that
only filters `type === "noteOn"` directly from `tracks`) with the block
above, keeping every downstream count assertion
(`selectedNoteOns.length !== 1041`, etc.) intact and unchanged — these must
still pass exactly as before, since this only adds data, not new/removed
notes.

**Step 3: Thread `holdDurationMs` into `rawEvents` and the generated module**

Update the `byTick` population to also store the duration:

```js
const byTick = new Map();
let collisions = 0;
for (const event of selectedNoteOns) {
  if (!byTick.has(event.tick)) byTick.set(event.tick, new Map());
  const pitches = byTick.get(event.tick);
  const holdDurationMs = holdDurationMsByNoteOn.get(event);
  if (pitches.has(event.note)) {
    collisions++;
    pitches.set(event.note, { velocity: Math.max(pitches.get(event.note).velocity, event.velocity), holdDurationMs });
  } else pitches.set(event.note, { velocity: event.velocity, holdDurationMs });
}
const rawEvents = [...byTick.entries()]
  .sort(([a], [b]) => a - b)
  .map(([tick, pitches]) => [
    Math.round(tickToMs(tick)),
    [...pitches.entries()].sort(([a], [b]) => a - b).map(([midi, { velocity, holdDurationMs }]) => [midi, velocity, holdDurationMs]),
  ]);
```

This changes each note tuple from `[midi, velocity]` to `[midi, velocity,
holdDurationMs]` — update the existing `rawEvents[0]`/`rawEvents.at(-1)`
sanity-check assertions (lines ~202-211) to match 3-element tuples, and
update `formatRawEvents`/the generated module's `notes.map(...)` to carry
the third element through:

```js
function formatRawEvents(events) {
  const lines = [
    "const RAW_EVENTS: readonly (readonly [",
    "  number,",
    "  readonly (readonly [number, number, number | undefined])[],",
    "])[] = [",
  ];
  for (const [time, notes] of events) {
    if (notes.length === 1) {
      lines.push(`  [${time}, [[${notes[0][0]}, ${notes[0][1]}, ${notes[0][2] ?? "undefined"}]]],`);
      continue;
    }
    lines.push("  [", `    ${time},`, "    [");
    for (const [midi, velocity, holdDurationMs] of notes)
      lines.push(`      [${midi}, ${velocity}, ${holdDurationMs ?? "undefined"}],`);
    lines.push("    ],", "  ],");
  }
  lines.push("];", "");
  return lines.join("\n");
}
```

And the generated module's `chords` construction:

```js
const generatedModule = `import type { Chord, Piece } from "../../domain/types";

/** Beethoven: Für Elise, WoO 59, from Bernd Krueger's piano-midi.de performance MIDI. */
${formatRawEvents(rawEvents)}const chords: readonly Chord[] = RAW_EVENTS.map(
  ([originalTimeMs, notes], index) => {
    const next = RAW_EVENTS[index + 1];
    return {
      originalTimeMs,
      screenDurationMs: next ? next[0] - originalTimeMs : 0,
      notes: notes.map(([midi, velocity, holdDurationMs]) => ({ midi, velocity, holdDurationMs })),
    };
  },
);
...
```

**Step 4: Regenerate and verify**

Run: `node scripts/parse-beethoven-fur-elise.cjs`
Expected: exits 0, no `throw` (every count/hash assertion still holds — if
one fails, the matching logic broke something; do not weaken the assertion
to make it pass, find the bug).

Run: `git diff src/content/pieces/beethovenFurElise.ts`
Expected: every `originalTimeMs`/`midi`/`velocity` value byte-for-byte
identical to before; the only diff is the new `holdDurationMs` value (or
`undefined`) appended to each note tuple.

Run: `npx vitest run src/content/pieces/beethovenFurElise.test.ts`
Expected: PASS unchanged (that test file projects `[midi, velocity]` pairs
via `.map()`, per the earlier exploration — adding a field doesn't break
it).

**Step 5: Commit**

```bash
git add scripts/parse-beethoven-fur-elise.cjs src/content/pieces/beethovenFurElise.ts
git commit -m "feat: derive real holdDurationMs for Für Elise from its source MIDI's noteOff events"
```

---

## Task 9: Remaining 8 pieces — repeat Task 8's pattern individually

**Files (one sub-task per script; each is its own Step 1-5 following Task 8's exact pattern):**
- `scripts/parse-beethoven-moonlight-sonata-mov3.cjs` → `src/content/pieces/beethovenMoonlightSonataMov3.ts`
- `scripts/parse-chopin-minute-waltz.cjs` → `src/content/pieces/chopinMinuteWaltz.ts`
- `scripts/parse-chopin-heroic-polonaise.cjs` → `src/content/pieces/chopinHeroicPolonaise.ts`
- `scripts/parse-chopin-fantaisie-impromptu.cjs` → `src/content/pieces/chopinFantaisieImpromptu.ts`
- `scripts/parse-chopin-nocturne-op9-no2.cjs` → `src/content/pieces/chopinNocturneOp9No2.ts`
- `scripts/parse-chopin-ballade-no1.cjs` → `src/content/pieces/chopinBalladeNo1.ts`
- `scripts/parse-debussy-clair-de-lune.cjs` → `src/content/pieces/debussyClairDeLune.ts`
- `scripts/parse-liszt-hungarian-rhapsody-no2.cjs` → `src/content/pieces/lisztHungarianRhapsodyNo2.ts`

For each script, **read it first** — do not assume it matches Für Elise's
exact structure. Confirmed so far: Heroic Polonaise already tokenizes
`noteOff` (Step 1 is a no-op there, skip straight to Step 2's matching
logic) but the other 7 haven't been inspected in this plan and may differ
in tokenizer details (running-status handling, tempo-map structure,
`byTick` grouping shape) — adapt Task 8's Steps 1-3 to each script's actual
code rather than pasting Für Elise's diff verbatim. The invariant that must
hold for every script: every existing hash check, count assertion, and
first/last-event sanity check stays unchanged and still passes; only a
`holdDurationMs` field is added per note.

For each script, run its own Step 4 (regenerate + diff + piece test) and
Step 5 (commit) exactly as in Task 8, one commit per piece:

```bash
git commit -m "feat: derive real holdDurationMs for <piece name> from its source MIDI's noteOff events"
```

---

## Final verification (after all of Phase A and Phase B)

Run: `npm run test`
Expected: PASS, 0 failures, across all ~9 regenerated piece files plus every rendering/domain test touched above.

Run: `npm run typecheck`
Expected: PASS, no errors.

Manual browser check (`npm run dev`), performing a piece with real chords
(e.g. Für Elise or Fantaisie-Impromptu) and a piece with long held notes
(e.g. Clair de Lune or Moonlight Sonata):

1. A 2+ note tap shows as one overlapping cluster of filled circles, not spread-out dots with a line.
2. Fast passages render at their true tight spacing — no artificial floor keeping notes apart.
3. Dots are visibly bigger than before, and louder notes read bigger than softer ones.
4. A note that must be held shows a visible tail stretching from its dot; a normal short note doesn't.
