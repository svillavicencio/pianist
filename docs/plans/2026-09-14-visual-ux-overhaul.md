# Visual & UX Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use the `executing-plans` skill to implement this plan task-by-task.

**Goal:** Make individual notes visually distinguishable by pitch, fix the
visual stacking of falling notes in fast passages, and give the background
and menus real visual identity — per
`docs/plans/2026-09-14-visual-ux-overhaul-design.md`.

**Architecture:** All rendering logic stays inside
`src/adapters/web/render/` (hexagonal adapter, PixiJS-specific). Color math
(`colorForNote`, `shiftLightness`) is pure and unit-tested with no PixiJS
dependency, same pattern as the existing `particleStateAt`. The background
gradient + hit-line live in a new standalone module so `PixiRenderer`'s
`tick()`/`showUpcoming()` never touch them (avoids reshuffling the existing
particle/upcoming-dot index-based test assertions). Menu changes stay in
`src/ui/` (`pauseMenu.ts` for the new scrim element, `styles.ts` for CSS).

**Tech Stack:** TypeScript, PixiJS v8, Vitest (+ jsdom for DOM-based UI
tests), no new dependencies.

---

## Task 1: Piano-range constants + pitch-to-hue gradient math

**Files:**
- Modify: `src/adapters/web/render/noteParticleLifecycle.ts`
- Modify: `src/adapters/web/render/PixiRenderer.ts:7-11` (remove local `MIN_MIDI`/`MAX_MIDI`, import instead)
- Test: `src/adapters/web/render/noteParticleLifecycle.test.ts`

Moves the piano-range constants here (single source of truth — `PixiRenderer`
also needs them for `xForMidi`) and replaces the flat per-theme hex with an
HSL gradient definition, so pitch drives hue within each theme's range.

**Step 1: Write the failing tests**

Replace the existing `colorThemeToHex` describe block in
`noteParticleLifecycle.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { colorForNote, MAX_MIDI, MIN_MIDI, particleStateAt, shiftLightness } from './noteParticleLifecycle';

// ... keep the existing particleStateAt describe block unchanged ...

describe('colorForNote', () => {
  it('produces different colors for different pitches within the same theme', () => {
    const low = colorForNote('parliament', 30);
    const mid = colorForNote('parliament', 64);
    const high = colorForNote('parliament', 100);
    expect(low).not.toBe(mid);
    expect(mid).not.toBe(high);
    expect(low).not.toBe(high);
  });

  it('is deterministic: the same theme and pitch always produce the same color', () => {
    expect(colorForNote('ocean', 60)).toBe(colorForNote('ocean', 60));
  });

  it('falls back to a neutral color for an unknown theme instead of throwing', () => {
    expect(() => colorForNote('some-made-up-theme', 60)).not.toThrow();
  });

  it('clamps a below-range MIDI value to the same color as the lowest key', () => {
    expect(colorForNote('ocean', 0)).toBe(colorForNote('ocean', MIN_MIDI));
  });

  it('clamps an above-range MIDI value to the same color as the highest key', () => {
    expect(colorForNote('ocean', 200)).toBe(colorForNote('ocean', MAX_MIDI));
  });
});

describe('shiftLightness', () => {
  it('returns the same color unchanged at amount 0', () => {
    expect(shiftLightness(0x1e90ff, 0)).toBe(0x1e90ff);
  });

  it('returns pure white at amount 1, regardless of the input color', () => {
    expect(shiftLightness(0x1e90ff, 1)).toBe(0xffffff);
  });

  it('returns pure black at amount -1, regardless of the input color', () => {
    expect(shiftLightness(0x1e90ff, -1)).toBe(0x000000);
  });

  it('mixes each channel proportionally toward white for a positive amount', () => {
    // 0x808080 (128,128,128) halfway to white -> 128 + (255-128)*0.5 = 191.5 -> 192
    expect(shiftLightness(0x808080, 0.5)).toBe(0xc0c0c0);
  });

  it('mixes each channel proportionally toward black for a negative amount', () => {
    // 0x808080 halfway to black -> 128 * 0.5 = 64
    expect(shiftLightness(0x808080, -0.5)).toBe(0x404040);
  });

  it('clamps an out-of-range amount instead of over/under-mixing', () => {
    expect(shiftLightness(0x123456, 2)).toBe(0xffffff);
    expect(shiftLightness(0x123456, -2)).toBe(0x000000);
  });
});
```

Delete the old `colorThemeToHex` and `darkenHex` describe blocks — those
functions are being replaced, not kept alongside the new ones.

**Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/adapters/web/render/noteParticleLifecycle.test.ts`
Expected: FAIL — `colorForNote`, `shiftLightness`, `MIN_MIDI`, `MAX_MIDI` are not exported yet.

**Step 3: Write the implementation**

In `noteParticleLifecycle.ts`, replace `THEME_COLORS`/`colorThemeToHex`/`darkenHex` with:

```ts
/** Lowest/highest MIDI notes on a standard 88-key piano — used to map a note to a horizontal position and a hue. */
export const MIN_MIDI = 21;
export const MAX_MIDI = 108;

/** One theme's color range: hue sweeps from `hueStart` (lowest key) to `hueEnd` (highest key). */
interface ThemeGradient {
  readonly hueStart: number; // degrees, 0-360
  readonly hueEnd: number;
  readonly saturation: number; // 0..1
  readonly lightness: number; // 0..1
}

/** Fallback gradient (white, no hue variation) for any `ColorTheme` string not in the map below. */
const DEFAULT_GRADIENT: ThemeGradient = { hueStart: 0, hueEnd: 0, saturation: 0, lightness: 1 };

/** Known piece color themes, now expressed as a hue range instead of one flat color. */
const THEME_GRADIENTS: Readonly<Record<string, ThemeGradient>> = {
  parliament: { hueStart: 40, hueEnd: 55, saturation: 0.9, lightness: 0.55 },
  ocean: { hueStart: 190, hueEnd: 225, saturation: 0.75, lightness: 0.55 },
  sunset: { hueStart: 5, hueEnd: 40, saturation: 0.85, lightness: 0.58 },
  forest: { hueStart: 95, hueEnd: 150, saturation: 0.55, lightness: 0.48 },
  midnight: { hueStart: 255, hueEnd: 290, saturation: 0.6, lightness: 0.58 },
  silver: { hueStart: 205, hueEnd: 215, saturation: 0.1, lightness: 0.68 },
  crimson: { hueStart: 335, hueEnd: 355, saturation: 0.7, lightness: 0.55 },
};

/** Maps a piece's `ColorTheme` and a note's pitch to a PIXI-friendly hex color. */
export function colorForNote(theme: ColorTheme, midi: MidiNote): number {
  const gradient = THEME_GRADIENTS[theme] ?? DEFAULT_GRADIENT;
  const t = clamp((midi - MIN_MIDI) / (MAX_MIDI - MIN_MIDI), 0, 1);
  const hue = gradient.hueStart + (gradient.hueEnd - gradient.hueStart) * t;
  return hslToHex(hue, gradient.saturation, gradient.lightness);
}

function hslToHex(hue: number, saturation: number, lightness: number): number {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 1);
  const l = clamp(lightness, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  const toByte = (channel: number): number => Math.round((channel + m) * 255);
  return (toByte(r!) << 16) | (toByte(g!) << 8) | toByte(b!);
}

/**
 * Shifts `hex`'s lightness by `amount` (-1..1): negative mixes toward black, positive toward
 * white, 0 leaves it unchanged. Replaces the old darken-only `darkenHex` — used to derive a
 * second, visually-distinct shade for alternating consecutive chords in the upcoming-notes
 * preview. A luminosity shift (rather than a hue shift) reads reliably even for a near-grayscale
 * theme like `silver`, where rotating hue would do nothing.
 */
export function shiftLightness(hex: number, amount: number): number {
  const clamped = clamp(amount, -1, 1);
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const shift = (channel: number): number =>
    clamped >= 0
      ? Math.round(channel + (255 - channel) * clamped)
      : Math.round(channel * (1 + clamped));
  return (shift(r) << 16) | (shift(g) << 8) | shift(b);
}
```

Keep `particleStateAt`/`ParticleState`/`clamp` as they are (the existing
`clamp` helper is reused by the new functions above it).

Then in `PixiRenderer.ts`, delete the local `MIN_MIDI`/`MAX_MIDI` constants
(lines 7-11) and import them instead:

```ts
import { MAX_MIDI, MIN_MIDI, colorForNote, shiftLightness } from './noteParticleLifecycle';
```

(`colorThemeToHex`/`darkenHex` imports are removed here — Task 3 wires in
`colorForNote`/`shiftLightness` instead, so this file won't compile again
until that task is done. That's expected — see Step 4.)

**Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/adapters/web/render/noteParticleLifecycle.test.ts`
Expected: PASS for every `colorForNote`/`shiftLightness` test.

Run: `npm run typecheck`
Expected: FAIL — `PixiRenderer.ts` still calls the now-removed
`colorThemeToHex`/`darkenHex`. This is expected; Task 3 fixes it. Do not
worry about `PixiRenderer.ts` type errors yet.

**Step 5: Commit**

```bash
git add src/adapters/web/render/noteParticleLifecycle.ts src/adapters/web/render/noteParticleLifecycle.test.ts src/adapters/web/render/PixiRenderer.ts
git commit -m "feat: replace flat per-theme color with pitch-mapped HSL gradient"
```

---

## Task 2: Wire `colorForNote` into hit particles

**Files:**
- Modify: `src/adapters/web/render/PixiRenderer.ts` (`spawnNoteVisual`)
- Test: `src/adapters/web/render/PixiRenderer.test.ts`

**Step 1: Write the failing test**

Add to the top-level `describe('PixiRenderer', ...)` block:

```ts
it('colors a spawned hit particle by its pitch, not a single flat theme color', () => {
  const container = new FakeContainer();
  const renderer = new PixiRenderer(container, 800, 600, LOOKAHEAD_MS);
  const fillSpy = vi.spyOn(PIXI.Graphics.prototype, 'fill');

  renderer.spawnNoteVisual(30, 'ocean');
  renderer.spawnNoteVisual(100, 'ocean');

  expect(fillSpy.mock.calls[0]?.[0]).not.toBe(fillSpy.mock.calls[1]?.[0]);
  fillSpy.mockRestore();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: FAIL (currently both calls use the same flat `colorThemeToHex('ocean')`) —
and the file still won't compile until this step's implementation lands, so
you may instead see a type/import error. Either failure is expected here.

**Step 3: Write minimal implementation**

In `spawnNoteVisual`:

```ts
spawnNoteVisual(midi: MidiNote, colorTheme: ColorTheme): void {
  const graphic = new PIXI.Graphics();
  graphic.circle(0, 0, BASE_RADIUS_PX).fill(colorForNote(colorTheme, midi));
  graphic.x = this.xForMidi(midi);
  graphic.y = this.height * SPAWN_HEIGHT_FRACTION;
  this.container.addChild(graphic);
  this.particles.push({ graphic, midi, elapsedMs: 0 });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: PASS on the new test. Other tests in this file still fail until
Task 3/4 land — that's expected (they exercise `showUpcoming`, not touched yet).

**Step 5: Commit**

```bash
git add src/adapters/web/render/PixiRenderer.ts src/adapters/web/render/PixiRenderer.test.ts
git commit -m "feat: color hit particles by pitch instead of one flat theme color"
```

---

## Task 3: Wire `colorForNote` + `shiftLightness` into the upcoming preview

**Files:**
- Modify: `src/adapters/web/render/PixiRenderer.ts` (`TrackedUpcomingChord`, `showUpcoming`, `positionUpcoming`)
- Test: `src/adapters/web/render/PixiRenderer.test.ts`

Each upcoming dot is now colored by its own pitch; the existing
even/odd-chord alternation becomes a lightness shift applied on top of that
per-note color (not a replacement for it), so both signals — "what pitch is
this" and "is this a separate tap from the previous one" — read at once. The
connecting line for a multi-note chord uses its first note's (shifted) color.

**Step 1: Update the existing alternation test, and add a same-pitch check**

Replace the existing `'alternates shade between consecutive chords...'` test
with:

```ts
it('shifts lightness on the alternate chord while keeping the same pitch-based hue', () => {
  const container = new FakeContainer();
  const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
  const fillSpy = vi.spyOn(PIXI.Graphics.prototype, 'fill');

  renderer.showUpcoming(
    [
      { distanceMs: 0, midis: [60] },
      { distanceMs: 300, midis: [60] }, // same pitch, next chord -> alternate parity
      { distanceMs: 600, midis: [60] }, // same pitch, same parity as the first
    ],
    'parliament',
    false,
  );

  const colors = fillSpy.mock.calls.map((call) => call[0]);
  expect(colors).toHaveLength(3);
  expect(colors[0]).toBe(colors[2]); // same pitch + same parity -> identical color
  expect(colors[1]).not.toBe(colors[0]); // same pitch, alternate parity -> shifted lightness
  fillSpy.mockRestore();
});

it('gives different pitches different colors even within the same chord', () => {
  const container = new FakeContainer();
  const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
  const fillSpy = vi.spyOn(PIXI.Graphics.prototype, 'fill');

  renderer.showUpcoming([{ distanceMs: 0, midis: [30, 100] }], 'parliament', false);

  const colors = fillSpy.mock.calls.map((call) => call[0]);
  expect(colors[0]).not.toBe(colors[1]);
  fillSpy.mockRestore();
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: FAIL on both new/updated tests (today every dot in a chord shares
one flat `color`).

**Step 3: Write the implementation**

Update `TrackedUpcomingChord` (near the `TrackedParticle` interface) to carry
per-dot colors instead of one:

```ts
interface TrackedUpcomingChord {
  readonly distanceMs: number;
  readonly xs: readonly number[];
  readonly colors: readonly number[]; // one per dot, same order as `xs`/`dots`
  readonly dots: PIXI.Graphics[];
  readonly line?: PIXI.Graphics;
}
```

Update `showUpcoming`:

```ts
showUpcoming(chords: readonly UpcomingChordPreview[], colorTheme: ColorTheme, continuedFromPreviousTap: boolean): void {
  const previousNextDistanceMs = this.upcoming[1]?.distanceMs;

  for (const tracked of this.upcoming) {
    for (const dot of tracked.dots) {
      this.container.removeChild(dot);
      dot.destroy();
    }
    if (tracked.line) {
      this.container.removeChild(tracked.line);
      tracked.line.destroy();
    }
  }

  this.upcomingElapsedMs =
    continuedFromPreviousTap && previousNextDistanceMs !== undefined
      ? this.upcomingElapsedMs - previousNextDistanceMs
      : 0;
  this.upcoming = chords.map((chord, index) => {
    // Odd chords (the "in-between" tap relative to the one before) get lightened, so
    // consecutive taps read apart even when they share a pitch.
    const isAlternate = index % 2 === 1;
    const xs = chord.midis.map((midi) => this.xForMidi(midi));
    const colors = chord.midis.map((midi) => {
      const base = colorForNote(colorTheme, midi);
      return isAlternate ? shiftLightness(base, UPCOMING_ALT_LIGHTNESS_SHIFT) : base;
    });

    const line = xs.length > 1 ? new PIXI.Graphics() : undefined;
    if (line) this.container.addChild(line);

    const dots = xs.map((x, i) => {
      const dot = new PIXI.Graphics();
      dot.circle(0, 0, UPCOMING_RADIUS_PX).fill(colors[i]!);
      dot.alpha = UPCOMING_ALPHA;
      dot.x = x;
      this.container.addChild(dot);
      return dot;
    });

    return { distanceMs: chord.distanceMs, xs, colors, dots, line };
  });

  this.positionUpcoming();
}
```

Add the new constant near `UPCOMING_ALT_SHADE_AMOUNT` (replacing it):

```ts
/** How far (-1..1, negative = darker, positive = lighter) every other upcoming chord's dots are
 *  lightness-shifted from their pitch-based color, so consecutive taps alternate shade. Positive
 *  (toward white) rather than the old toward-black shift — darkening further on an already-dark
 *  background loses contrast instead of gaining it. */
const UPCOMING_ALT_LIGHTNESS_SHIFT = 0.3;
```

Update the line-drawing in `positionUpcoming` to use `tracked.colors[0]` instead of `tracked.color`:

```ts
if (tracked.line) {
  tracked.line.clear();
  tracked.line
    .moveTo(Math.min(...tracked.xs), y)
    .lineTo(Math.max(...tracked.xs), y)
    .stroke({ width: UPCOMING_CHORD_LINE_WIDTH_PX, color: tracked.colors[0]!, alpha: UPCOMING_ALPHA });
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: PASS on all tests in the file.

Run: `npm run typecheck`
Expected: PASS (this is what un-breaks the type errors from Task 1's Step 4).

**Step 5: Commit**

```bash
git add src/adapters/web/render/PixiRenderer.ts src/adapters/web/render/PixiRenderer.test.ts
git commit -m "feat: color each upcoming note by pitch, shift lightness for alternate chords"
```

---

## Task 4: Shape distinguishes upcoming (hollow) from hit (filled) dots

**Files:**
- Modify: `src/adapters/web/render/PixiRenderer.ts` (`showUpcoming`)
- Test: `src/adapters/web/render/PixiRenderer.test.ts`

**Step 1: Write the failing test**

```ts
it('draws upcoming dots as hollow (stroked) circles, not filled, to read apart from hit particles', () => {
  const container = new FakeContainer();
  const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
  const fillSpy = vi.spyOn(PIXI.Graphics.prototype, 'fill');
  const strokeSpy = vi.spyOn(PIXI.Graphics.prototype, 'stroke');

  renderer.showUpcoming([{ distanceMs: 0, midis: [60] }], 'parliament', false);

  expect(fillSpy).not.toHaveBeenCalled();
  expect(strokeSpy).toHaveBeenCalledOnce();
  fillSpy.mockRestore();
  strokeSpy.mockRestore();
});
```

Note: this changes the meaning of `fillSpy` in the Task 3 tests above too —
run the whole suite after this step (Step 4) to confirm they were updated
correctly, not just this one test.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: FAIL — dots currently call `.fill()`.

**Step 3: Write the implementation**

In `showUpcoming`'s `dots` mapping, swap `.fill(...)` for `.stroke(...)`:

```ts
const dots = xs.map((x, i) => {
  const dot = new PIXI.Graphics();
  dot.circle(0, 0, UPCOMING_RADIUS_PX).stroke({ width: UPCOMING_STROKE_WIDTH_PX, color: colors[i]! });
  dot.alpha = UPCOMING_ALPHA;
  dot.x = x;
  this.container.addChild(dot);
  return dot;
});
```

Add the new constant near `UPCOMING_RADIUS_PX`:

```ts
/** Stroke width (px) of an upcoming-note dot's outline — hollow, unlike a filled hit particle. */
const UPCOMING_STROKE_WIDTH_PX = 2;
```

This means Task 3's `fillSpy`-based tests (`'shifts lightness on the
alternate chord...'` and `'gives different pitches different colors...'`)
must switch to `strokeSpy` and read `.color` off the stroke options object
instead of the raw hex argument:

```ts
const colors = strokeSpy.mock.calls.map((call) => (call[0] as { color: number }).color);
```

Go back and apply that change to both Task 3 tests now.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: PASS on every test in the file, including the two updated from Task 3.

**Step 5: Commit**

```bash
git add src/adapters/web/render/PixiRenderer.ts src/adapters/web/render/PixiRenderer.test.ts
git commit -m "feat: draw upcoming-note dots hollow, distinct from filled hit particles"
```

---

## Task 5: Minimum visual gap between upcoming dots (anti-stacking)

**Files:**
- Modify: `src/adapters/web/render/PixiRenderer.ts` (`positionUpcoming`)
- Test: `src/adapters/web/render/PixiRenderer.test.ts`

**Step 1: Write the failing tests**

```ts
describe('minimum upcoming-dot spacing', () => {
  it('enforces a minimum pixel gap between consecutive upcoming dots so a fast passage does not visually merge', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

    renderer.showUpcoming(
      [
        { distanceMs: 0, midis: [60] },
        { distanceMs: 1, midis: [62] }, // 1ms apart at a 1000ms lookahead -> ~1px apart, unadjusted
      ],
      'parliament',
      false,
    );

    const nearY = container.children[0]!.y;
    const farY = container.children[1]!.y;
    expect(nearY - farY).toBeGreaterThanOrEqual(28); // MIN_UPCOMING_GAP_PX
  });

  it('never adjusts the nearest-due dot — only farther ones absorb the compression', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
    const hitLineY = 1000 * 0.85; // SPAWN_HEIGHT_FRACTION

    renderer.showUpcoming(
      [
        { distanceMs: 0, midis: [60] },
        { distanceMs: 1, midis: [62] },
      ],
      'parliament',
      false,
    );

    expect(container.children[0]!.y).toBeCloseTo(hitLineY);
  });

  it('leaves well-separated notes untouched', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

    renderer.showUpcoming(
      [
        { distanceMs: 0, midis: [60] },
        { distanceMs: 500, midis: [62] }, // half the lookahead window apart -> already well spaced
      ],
      'parliament',
      false,
    );

    const nearY = container.children[0]!.y;
    const farY = container.children[1]!.y;
    expect(nearY - farY).toBeCloseTo(1000 * 0.5 * (0.85 - 0.15)); // unadjusted yForDistance delta
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: FAIL on the first test (dots land ~1px apart, not ≥28px). The
other two should already pass — they're here to guard against
over-compressing well-spaced notes.

**Step 3: Write the implementation**

Add the constant near `UPCOMING_RADIUS_PX`:

```ts
/** Minimum vertical gap (px) enforced between two consecutive upcoming dots — without this, a
 *  fast passage's notes (close together in authored time) render close enough to visually merge. */
const MIN_UPCOMING_GAP_PX = 28;
```

Update `positionUpcoming`:

```ts
private positionUpcoming(): void {
  let previousY: number | undefined;
  for (const tracked of this.upcoming) {
    const remainingMs = tracked.distanceMs - this.upcomingElapsedMs;
    let y = this.yForDistance(this.lookaheadMs > 0 ? remainingMs / this.lookaheadMs : 0);

    // Only farther-out notes get pushed — the nearest-due one (index 0, previousY still
    // undefined on the first iteration) always renders at its true position, since accuracy
    // matters most right at the hit line.
    if (previousY !== undefined && previousY - y < MIN_UPCOMING_GAP_PX) {
      y = previousY - MIN_UPCOMING_GAP_PX;
    }
    previousY = y;

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

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/adapters/web/render/PixiRenderer.test.ts`
Expected: PASS on all three new tests and everything else in the file.

**Step 5: Commit**

```bash
git add src/adapters/web/render/PixiRenderer.ts src/adapters/web/render/PixiRenderer.test.ts
git commit -m "fix: enforce minimum pixel gap between upcoming notes to stop visual stacking"
```

---

## Task 6: Background gradient + hit-line marker

**Files:**
- Create: `src/adapters/web/render/backdrop.ts`
- Create: `src/adapters/web/render/backdrop.test.ts`
- Modify: `src/main.ts` (wire it in, replace the flat Pixi `background` option)

Deliberately kept **outside** `PixiRenderer` — it's drawn once (and on
resize), never touched by `tick()`/`showUpcoming()`, so it must not become a
tracked particle or upcoming dot (that would shift every existing
`container.children[N]` index-based assertion in `PixiRenderer.test.ts`).

**Step 1: Write the failing test**

```ts
import * as PIXI from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { createBackdrop, drawBackdrop, SPAWN_HEIGHT_FRACTION } from './backdrop';

describe('backdrop', () => {
  it('creates exactly two graphics: the background and the hit line', () => {
    const backdrop = createBackdrop();
    expect(backdrop.background).toBeInstanceOf(PIXI.Graphics);
    expect(backdrop.hitLine).toBeInstanceOf(PIXI.Graphics);
  });

  it('draws the hit line at SPAWN_HEIGHT_FRACTION of the given height', () => {
    const backdrop = createBackdrop();
    const strokeSpy = vi.spyOn(backdrop.hitLine, 'stroke');
    const moveToSpy = vi.spyOn(backdrop.hitLine, 'moveTo');

    drawBackdrop(backdrop, 1000, 800);

    expect(moveToSpy).toHaveBeenCalledWith(0, 800 * SPAWN_HEIGHT_FRACTION);
    expect(strokeSpy).toHaveBeenCalledOnce();
  });

  it('fills the background across the full given size', () => {
    const backdrop = createBackdrop();
    const rectSpy = vi.spyOn(backdrop.background, 'rect');

    drawBackdrop(backdrop, 1000, 800);

    expect(rectSpy).toHaveBeenCalledWith(0, 0, 1000, 800);
  });

  it('clears both graphics before redrawing, so repeated resizes do not layer draws', () => {
    const backdrop = createBackdrop();
    drawBackdrop(backdrop, 1000, 800);
    const clearBackgroundSpy = vi.spyOn(backdrop.background, 'clear');
    const clearHitLineSpy = vi.spyOn(backdrop.hitLine, 'clear');

    drawBackdrop(backdrop, 500, 400); // simulates a resize

    expect(clearBackgroundSpy).toHaveBeenCalledOnce();
    expect(clearHitLineSpy).toHaveBeenCalledOnce();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/adapters/web/render/backdrop.test.ts`
Expected: FAIL — `./backdrop` doesn't exist yet.

**Step 3: Write the implementation**

Create `src/adapters/web/render/backdrop.ts`:

```ts
import * as PIXI from 'pixi.js';

/** Fraction of the viewport height the hit line sits at — must match `PixiRenderer`'s
 *  `SPAWN_HEIGHT_FRACTION`, which is where particles actually spawn/land. Re-exported from here
 *  since the backdrop needs it and must stay independent of `PixiRenderer`. */
export const SPAWN_HEIGHT_FRACTION = 0.85;

const HIT_LINE_ALPHA = 0.18;
const HIT_LINE_WIDTH_PX = 2;
const BACKGROUND_TOP_HEX = 0x1a1f2e;
const BACKGROUND_BOTTOM_HEX = 0x0a0b0d;

export interface Backdrop {
  readonly background: PIXI.Graphics;
  readonly hitLine: PIXI.Graphics;
}

/** Creates the two backdrop graphics, undrawn — call `drawBackdrop` to size them, and add both
 *  to the stage *before* constructing `PixiRenderer` so they stay outside its tracked children. */
export function createBackdrop(): Backdrop {
  return { background: new PIXI.Graphics(), hitLine: new PIXI.Graphics() };
}

/** (Re)draws both backdrop graphics for the given viewport size — call once at startup and again
 *  on every resize. */
export function drawBackdrop(backdrop: Backdrop, width: number, height: number): void {
  const gradient = new PIXI.FillGradient(0, 0, 0, height);
  gradient.addColorStop(0, BACKGROUND_TOP_HEX);
  gradient.addColorStop(1, BACKGROUND_BOTTOM_HEX);

  backdrop.background.clear();
  backdrop.background.rect(0, 0, width, height).fill(gradient);

  const hitLineY = height * SPAWN_HEIGHT_FRACTION;
  backdrop.hitLine.clear();
  backdrop.hitLine
    .moveTo(0, hitLineY)
    .lineTo(width, hitLineY)
    .stroke({ width: HIT_LINE_WIDTH_PX, color: 0xffffff, alpha: HIT_LINE_ALPHA });
}
```

In `PixiRenderer.ts`, replace the local `SPAWN_HEIGHT_FRACTION` constant with
an import from `./backdrop` (single source of truth — both files must agree
on where the hit line actually is):

```ts
import { SPAWN_HEIGHT_FRACTION } from './backdrop';
```

Delete `const SPAWN_HEIGHT_FRACTION = 0.85;` from `PixiRenderer.ts`.

In `main.ts`, wire it in around where `app`/`renderer` are constructed:

```ts
const app = new PIXI.Application();
await app.init({ resizeTo: window, background: BACKGROUND_BOTTOM_HEX_FALLBACK });
gameContainer.appendChild(app.canvas);

const backdrop = createBackdrop();
app.stage.addChild(backdrop.background, backdrop.hitLine);
drawBackdrop(backdrop, window.innerWidth, window.innerHeight);

const renderer = new PixiRenderer(app.stage, window.innerWidth, window.innerHeight, UPCOMING_LOOKAHEAD_MS);
window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth, window.innerHeight);
  drawBackdrop(backdrop, window.innerWidth, window.innerHeight);
});
```

Add the import and the fallback constant near the top of `main.ts`:

```ts
import { createBackdrop, drawBackdrop } from './adapters/web/render/backdrop';

/** Matches `backdrop.ts`'s gradient's darkest stop — avoids a flash of Pixi's default background
 *  before `drawBackdrop` paints the real gradient on the first frame. */
const BACKGROUND_BOTTOM_HEX_FALLBACK = '#0a0b0d';
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/adapters/web/render/backdrop.test.ts src/adapters/web/render/PixiRenderer.test.ts`
Expected: PASS on all of `backdrop.test.ts`, and `PixiRenderer.test.ts`
unaffected (background/hit-line are never added to the `NoteVisualContainer`
this file's tests observe).

Run: `npm run typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/adapters/web/render/backdrop.ts src/adapters/web/render/backdrop.test.ts src/adapters/web/render/PixiRenderer.ts src/main.ts
git commit -m "feat: draw a gradient background and a visible hit-line marker"
```

---

## Task 7: Pause-menu scrim

**Files:**
- Modify: `src/ui/pauseMenu.ts`
- Modify: `src/ui/styles.ts` (`.pause-menu` block)
- Test: `src/ui/pauseMenu.test.ts`

Today `.pause-menu` is `position: fixed; inset: 0;` but only the 240px-wide
card itself paints anything — the paused game canvas stays fully visible
behind it. Add a dedicated scrim element so `destroy()` can clean up both.

**Step 1: Write the failing tests**

Add to `pauseMenu.test.ts`:

```ts
it('renders a scrim behind the menu card to dim the paused game', () => {
  const container = document.createElement('div');
  renderPauseMenu(container, makeCallbacks());

  expect(container.querySelector('.pause-menu__scrim')).not.toBeNull();
});

it('destroy() removes the scrim along with the menu card', () => {
  const container = document.createElement('div');
  const handle = renderPauseMenu(container, makeCallbacks());

  handle.destroy();

  expect(container.querySelector('.pause-menu__scrim')).toBeNull();
  expect(container.querySelector('.pause-menu')).toBeNull();
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/pauseMenu.test.ts`
Expected: FAIL — no `.pause-menu__scrim` element exists yet.

**Step 3: Write the implementation**

In `renderPauseMenu`, add the scrim as a sibling appended before the card,
and tear it down in `destroy()`:

```ts
export function renderPauseMenu(container: HTMLElement, callbacks: PauseMenuCallbacks): PauseMenuHandle {
  const scrim = document.createElement('div');
  scrim.className = 'pause-menu__scrim';
  container.appendChild(scrim);

  const root = document.createElement('div');
  root.className = 'pause-menu';

  const cleanups: Array<() => void> = [];

  const addButton = (className: string, label: string, onClick: () => void): void => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    cleanups.push(() => button.removeEventListener('click', onClick));
    root.appendChild(button);
  };

  addButton('pause-menu__resume-button', 'Resume', () => callbacks.onResume());
  addButton('pause-menu__restart-button', 'Restart', () => callbacks.onRestart());
  addButton('pause-menu__main-menu-button', 'Main Menu', () => callbacks.onMainMenu());

  container.appendChild(root);

  return {
    destroy(): void {
      for (const cleanup of cleanups) cleanup();
      root.remove();
      scrim.remove();
    },
  };
}
```

In `styles.ts`, add a scrim rule right above `.pause-menu` and drop the
existing `.pause-menu`'s `position: fixed; inset: 0;` (the scrim now owns
full-viewport positioning; the card centers itself with margin auto same as
before, just re-parented conceptually — no layout change needed there
besides adding the new rule):

```css
.pause-menu__scrim {
  position: fixed;
  inset: 0;
  background: #05060766;
  backdrop-filter: blur(2px);
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/pauseMenu.test.ts`
Expected: PASS on all tests, including the two new ones and the existing
`'destroy() empties only what it added...'` test (still true — the scrim is
also something `renderPauseMenu` added, so removing it too is correct, not a
regression of that test's "only what it added" contract).

**Step 5: Commit**

```bash
git add src/ui/pauseMenu.ts src/ui/pauseMenu.test.ts src/ui/styles.ts
git commit -m "feat: dim the paused game behind a scrim so the pause menu reads as focused"
```

---

## Task 8: Main-menu visual restyle

**Files:**
- Modify: `src/ui/styles.ts` (`.main-menu__pack`, header, type scale)

Pure CSS — no new DOM elements, no new test (matches the existing project
convention: `styles.ts` has no test file, verified visually). Verified by
hand in Task 9.

**Step 1: Update the CSS**

In `styles.ts`, add a couple of new tokens to `:root` and give
`.main-menu__pack` more depth than the current flat `var(--surface)`:

```css
:root {
  --bg: #14161a;
  --surface: #1c1f26;
  --surface-hover: #262a33;
  --border: #33384344;
  --text: #e8e8e8;
  --text-dim: #a8adb8;
  --accent: #5b8dee;
  --accent-hover: #7aa2f2;
  --pack-gradient: linear-gradient(160deg, #20242d, #191c22);
}
```

```css
.main-menu__pack {
  background: var(--pack-gradient);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.25em 1.5em;
  margin-bottom: 1.25em;
  box-shadow: 0 8px 24px #00000040;
}
```

Sharpen the header's type scale so it reads as a title, not a form label:

```css
.main-menu__title { margin: 0 0 0.25em; font-size: 2.5em; font-weight: 700; letter-spacing: -0.03em; }
.main-menu__subtitle { margin: 0; color: var(--text-dim); font-size: 1.05em; }
```

**Step 2: Manual verification**

Run: `npm run dev` and open the printed local URL.
Expected: the main-menu pack cards show a subtle diagonal gradient and drop
shadow instead of flat `var(--surface)`; the title reads larger/bolder.

**Step 3: Commit**

```bash
git add src/ui/styles.ts
git commit -m "style: add depth and a stronger type scale to the main menu"
```

---

## Task 9: Full verification pass

**Files:** none (verification only)

**Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS, 0 failures.

**Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS, no errors.

**Step 3: Manual browser check against the original four complaints**

Run: `npm run dev`, open the printed local URL, click **Perform** on a piece
with a fast passage (e.g. the Liszt or Chopin pieces under
`docs/plans/`'s referenced content), and confirm, against the original
screenshots taken during exploration:

1. Individual notes in a chord/passage are visibly different colors (pitch-tinted), not one flat color.
2. Upcoming (hollow) dots and hit (filled) particles read apart at a glance.
3. Fast passages no longer show visually merged/overlapping dots.
4. The background has a visible gradient and a faint hit-line where notes land.
5. Pausing dims the game behind the pause card.
6. The main menu's pack cards show gradient/shadow depth.

**Step 4: Commit (if anything was tuned during manual verification)**

If `MIN_UPCOMING_GAP_PX`, the gradient hues, or the scrim opacity needed
tuning after visual inspection, commit those adjustments separately:

```bash
git add -A
git commit -m "tune: adjust visual overhaul constants after manual verification"
```
