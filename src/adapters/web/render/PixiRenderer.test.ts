import * as PIXI from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { PixiRenderer, type NoteVisualContainer } from './PixiRenderer';

/**
 * A minimal fake of the `NoteVisualContainer` seam — no real PixiJS scene graph
 * needed, just enough to observe what `PixiRenderer` adds/removes. The graphics
 * it holds are real `PIXI.Graphics` instances (constructible in plain Node,
 * since drawing geometry needs no canvas/WebGL context), so scale/alpha/destroy
 * assertions exercise the real PixiJS objects `PixiRenderer` actually creates.
 */
class FakeContainer implements NoteVisualContainer {
  readonly children: PIXI.Graphics[] = [];

  addChild(child: PIXI.Graphics): void {
    this.children.push(child);
  }

  removeChild(child: PIXI.Graphics): void {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
  }
}

/** The upcoming-notes tests use a 1000ms lookahead throughout, so a chord's distanceMs doubles as its ratio * 1000. */
const LOOKAHEAD_MS = 1000;

/** Every `showUpcoming` call below that isn't specifically testing tap-driven continuity passes
 *  `false` (a fresh snapshot) — matching a restart/seek/first-call in the real port. */
const FRESH = false;
const ADVANCED_BY_TAP = true;

describe('PixiRenderer', () => {
  it('colors a spawned hit particle by its pitch, not a single flat theme color', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600, LOOKAHEAD_MS);
    const fillSpy = vi.spyOn(PIXI.Graphics.prototype, 'fill');

    renderer.spawnNoteVisual(30, 100, 'ocean');
    renderer.spawnNoteVisual(100, 100, 'ocean');

    expect(fillSpy.mock.calls[0]?.[0]).not.toBe(fillSpy.mock.calls[1]?.[0]);
    fillSpy.mockRestore();
  });

  it('adds a graphic to the container when a note is spawned', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600, LOOKAHEAD_MS);

    renderer.spawnNoteVisual(60, 100, 'parliament');

    expect(container.children).toHaveLength(1);
  });

  it('positions spawned notes across the width by their MIDI pitch (21-108 range)', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 500, LOOKAHEAD_MS);

    renderer.spawnNoteVisual(21, 100, 'parliament'); // lowest piano key -> left edge
    renderer.spawnNoteVisual(108, 100, 'parliament'); // highest piano key -> right edge

    expect(container.children[0]?.x).toBeCloseTo(0);
    expect(container.children[1]?.x).toBeCloseTo(1000);
  });

  it('applies particleStateAt scale/alpha on tick and keeps a mid-lifetime particle alive', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600, LOOKAHEAD_MS);
    renderer.spawnNoteVisual(60, 100, 'parliament');

    renderer.tick(400); // half of the 800ms particle lifetime

    const graphic = container.children[0];
    expect(graphic?.scale.x).toBeCloseTo(0.9);
    expect(graphic?.alpha).toBeCloseTo(0.5);
    expect(container.children).toHaveLength(1);
  });

  it('removes and destroys a particle once its lifetime elapses', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600, LOOKAHEAD_MS);
    renderer.spawnNoteVisual(60, 100, 'parliament');
    const graphic = container.children[0];
    const destroySpy = vi.spyOn(graphic as PIXI.Graphics, 'destroy');

    renderer.tick(800); // exactly the particle lifetime

    expect(container.children).toHaveLength(0);
    expect(destroySpy).toHaveBeenCalledOnce();
  });

  it('records new dimensions on resize for subsequent positioning', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600, LOOKAHEAD_MS);

    renderer.resize(400, 300);
    renderer.spawnNoteVisual(108, 100, 'parliament'); // highest note -> full (new) width

    expect(container.children[0]?.x).toBeCloseTo(400);
  });

  it('draws one dot per upcoming note, positioned by pitch and by distanceMs', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

    renderer.showUpcoming(
      [
        { distanceMs: 0, notes: [21].map((midi) => ({ midi, velocity: 100 })) }, // lowest pitch, next up -> near the hit line (bottom)
        { distanceMs: LOOKAHEAD_MS, notes: [108].map((midi) => ({ midi, velocity: 100 })) }, // highest pitch, furthest out -> near the top
      ],
      'parliament',
      FRESH,
    );

    expect(container.children).toHaveLength(2);
    expect(container.children[0]?.x).toBeCloseTo(0);
    expect(container.children[1]?.x).toBeCloseTo(1000);
    expect(container.children[0]!.y).toBeGreaterThan(container.children[1]!.y);
  });

  it('replaces the previous upcoming preview (and destroys its graphics) on each call', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600, LOOKAHEAD_MS);

    renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);
    const firstDot = container.children[0] as PIXI.Graphics;
    const destroySpy = vi.spyOn(firstDot, 'destroy');

    renderer.showUpcoming(
      [
        { distanceMs: 200, notes: [64].map((midi) => ({ midi, velocity: 100 })) },
        { distanceMs: 400, notes: [67].map((midi) => ({ midi, velocity: 100 })) },
      ],
      'parliament',
      FRESH,
    );

    expect(destroySpy).toHaveBeenCalledOnce();
    expect(container.children).toHaveLength(2);
  });

  it('does not affect already-spawned hit particles', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600, LOOKAHEAD_MS);

    renderer.spawnNoteVisual(60, 100, 'parliament');
    renderer.showUpcoming([{ distanceMs: 0, notes: [64].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);
    renderer.showUpcoming([], 'parliament', FRESH); // clearing the preview must not touch the hit particle

    expect(container.children).toHaveLength(1);
  });

  it("clusters a multi-note chord's dots around a shared x instead of spreading by pitch", () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

    renderer.showUpcoming([{ distanceMs: 0, notes: [21, 108].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);

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

    renderer.showUpcoming([{ distanceMs: 0, notes: [108].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);

    expect(container.children[0]!.x).toBeCloseTo(1000);
  });

  it('no longer draws a connecting line for a multi-note chord', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

    renderer.showUpcoming([{ distanceMs: 0, notes: [60, 67].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);

    expect(container.children).toHaveLength(2); // just the 2 dots, no line graphic
  });

  it('shifts lightness on the alternate chord while keeping the same pitch-based hue', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
    const fillSpy = vi.spyOn(PIXI.Graphics.prototype, 'fill');

    renderer.showUpcoming(
      [
        { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
        { distanceMs: 300, notes: [60].map((midi) => ({ midi, velocity: 100 })) }, // same pitch, next chord -> alternate parity
        { distanceMs: 600, notes: [60].map((midi) => ({ midi, velocity: 100 })) }, // same pitch, same parity as the first
      ],
      'parliament',
      FRESH,
    );

    const colors = fillSpy.mock.calls.map((call) => call[0] as number);
    expect(colors).toHaveLength(3);
    expect(colors[0]).toBe(colors[2]); // same pitch + same parity -> identical color
    expect(colors[1]).not.toBe(colors[0]); // same pitch, alternate parity -> shifted lightness
    fillSpy.mockRestore();
  });

  it('gives different pitches different colors even within the same chord', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
    const fillSpy = vi.spyOn(PIXI.Graphics.prototype, 'fill');

    renderer.showUpcoming([{ distanceMs: 0, notes: [30, 100].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);

    const colors = fillSpy.mock.calls.map((call) => call[0] as number);
    expect(colors[0]).not.toBe(colors[1]);
    fillSpy.mockRestore();
  });

  it('draws upcoming dots as filled circles, matching hit particles', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
    const fillSpy = vi.spyOn(PIXI.Graphics.prototype, 'fill');
    const strokeSpy = vi.spyOn(PIXI.Graphics.prototype, 'stroke');

    renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);

    expect(fillSpy).toHaveBeenCalledOnce();
    expect(strokeSpy).not.toHaveBeenCalled();
    fillSpy.mockRestore();
    strokeSpy.mockRestore();
  });

  it("scales a spawned hit particle's radius by its velocity", () => {
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

  describe('strict timing (no artificial minimum spacing)', () => {
    it('positions two chords at their exact time-proportional distance, even when very close together', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 1, notes: [62].map((midi) => ({ midi, velocity: 100 })) }, // 1ms apart at a 1000ms lookahead
        ],
        'parliament',
        FRESH,
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
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 500, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
        ],
        'parliament',
        FRESH,
      );
      renderer.tick(900); // let both transitions (bounded up to 900ms) fully settle first

      const nearY = container.children[0]!.y;
      const farY = container.children[1]!.y;
      expect(nearY - farY).toBeCloseTo(1000 * 0.5 * (0.85 - 0.15));
    });
  });

  describe('resting position (static once settled — never approaches the hit line just from waiting)', () => {
    const TRANSITION_MAX_MS = 900; // must outlast any bounded transition to reach the true resting position

    it('settles an upcoming dot at its distanceMs-implied position', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: LOOKAHEAD_MS / 2, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);
      renderer.tick(TRANSITION_MAX_MS);

      const hitLineY = 1000 * 0.85;
      const topY = 1000 * 0.15;
      expect(container.children[0]!.y).toBeCloseTo(hitLineY - 0.5 * (hitLineY - topY));
    });

    it('pins a due chord (distanceMs 0) at the hit line', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);
      renderer.tick(TRANSITION_MAX_MS);

      expect(container.children[0]!.y).toBeCloseTo(1000 * 0.85);
    });

    it('does not move a settled dot as tick() keeps advancing — only a new showUpcoming repositions it', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: LOOKAHEAD_MS, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);
      renderer.tick(TRANSITION_MAX_MS); // let it fully settle first
      const settledY = container.children[0]!.y;

      renderer.tick(50_000); // however long the player waits after that, nothing here should move

      expect(container.children[0]!.y).toBe(settledY);
    });

    it('leaves upcoming dots undestroyed/uncreated by tick() — same graphics throughout, only repositioned', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: LOOKAHEAD_MS, notes: [21, 108].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);
      const graphicsAfterShow = [...container.children];

      renderer.tick(LOOKAHEAD_MS / 2);

      expect(container.children).toHaveLength(graphicsAfterShow.length);
      container.children.forEach((graphic, index) => expect(graphic).toBe(graphicsAfterShow[index]));
    });

    it('keeps every note beyond the first exactly where its own distanceMs puts it, once settled — no approach toward the hit line no matter how long you wait', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 400, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
        ],
        'parliament',
        FRESH,
      );
      renderer.tick(TRANSITION_MAX_MS);
      const secondDotY = container.children[1]!.y;

      renderer.tick(1_000_000); // this is exactly the "doesn't wait for me" regression: no amount
      // of waiting on the first note may ever move the second one toward the hit line.

      const hitLineY = 1000 * 0.85;
      expect(container.children[1]!.y).toBe(secondDotY); // did not creep toward the hit line
      expect(container.children[1]!.y).toBeLessThan(hitLineY - 1); // stayed clearly separated from the first
    });

    it('starts fresh (no continuation) when the next showUpcoming call is not a tap (advancedByTap: false)', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: 400, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);
      renderer.tick(1_000_000); // waiting changes nothing now — position is static until the next call

      renderer.showUpcoming([{ distanceMs: 0, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);
      renderer.tick(TRANSITION_MAX_MS);

      expect(container.children[0]!.y).toBeCloseTo(1000 * 0.85); // settles at its new position
    });
  });

  describe('entrance transition (a brand-new chord — not carried over from a tap)', () => {
    it('starts a freshly-shown dot above its resting position, not already there', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

      renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);

      const hitLineY = 1000 * 0.85;
      expect(container.children[0]!.y).toBeLessThan(hitLineY); // y grows downward — starts above (smaller y)
    });

    it('starts a slow-passage dot further above rest than a fast-passage one — not just a longer duration, a longer glide', () => {
      const fastContainer = new FakeContainer();
      new PixiRenderer(fastContainer, 1000, 1000, LOOKAHEAD_MS).showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 50, notes: [62].map((midi) => ({ midi, velocity: 100 })) }, // fast trill gap
        ],
        'parliament',
        FRESH,
      );
      const slowContainer = new FakeContainer();
      new PixiRenderer(slowContainer, 1000, 1000, LOOKAHEAD_MS).showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 2000, notes: [62].map((midi) => ({ midi, velocity: 100 })) }, // slow, held-note gap
        ],
        'parliament',
        FRESH,
      );

      const hitLineY = 1000 * 0.85;
      const topY = 1000 * 0.15;
      const fastRestY = hitLineY - (50 / LOOKAHEAD_MS) * (hitLineY - topY);
      const slowRestY = topY; // distanceMs 2000 > LOOKAHEAD_MS, clamped to the very top of the lane

      const fastStartRise = fastRestY - fastContainer.children[1]!.y;
      const slowStartRise = slowRestY - slowContainer.children[1]!.y;
      expect(slowStartRise).toBeGreaterThan(fastStartRise);
    });

    it('eases down to exactly the resting position by the time its transition duration elapses', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);

      renderer.tick(900); // the widest possible transition bound

      expect(container.children[0]!.y).toBeCloseTo(1000 * 0.85);
    });

    it('never overshoots past the resting position even long after the transition would have finished', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);

      renderer.tick(900);
      const atSettleY = container.children[0]!.y;
      renderer.tick(100_000);

      expect(container.children[0]!.y).toBe(atSettleY);
    });

    it('moves partway toward its resting position mid-transition, not all at once', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      // distanceMs of 250, x2.5 slowdown = 625ms — inside the duration bounds (200-900ms).
      renderer.showUpcoming([{ distanceMs: 250, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);
      const startY = container.children[0]!.y;

      renderer.tick(50); // partway through a 250ms transition

      const midY = container.children[0]!.y;
      const hitLineY = 1000 * 0.85;
      expect(midY).toBeGreaterThan(startY); // moved down some...
      expect(midY).toBeLessThan(hitLineY - 5); // ...but nowhere near fully settled yet
    });

    it('gives a fast passage (small gap since the previous chord) a shorter transition than a slow one', () => {
      const fastContainer = new FakeContainer();
      const fastRenderer = new PixiRenderer(fastContainer, 1000, 1000, LOOKAHEAD_MS);
      fastRenderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 50, notes: [62].map((midi) => ({ midi, velocity: 100 })) }, // fast trill gap
        ],
        'parliament',
        FRESH,
      );

      const slowContainer = new FakeContainer();
      const slowRenderer = new PixiRenderer(slowContainer, 1000, 1000, LOOKAHEAD_MS);
      slowRenderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 2000, notes: [62].map((midi) => ({ midi, velocity: 100 })) }, // slow, held-note gap
        ],
        'parliament',
        FRESH,
      );

      // Same real elapsed time into both transitions: the fast one's duration clamps to the 200ms
      // floor (50ms gap x2.5 = 125ms, still under the floor), so 100ms in it's halfway there; the
      // slow one's clamps to the 900ms ceiling (2000ms gap x2.5), so 100ms in it's still near the
      // very start of its transition — much further from rest than the fast one.
      fastRenderer.tick(100);
      slowRenderer.tick(100);

      const hitLineY = 1000 * 0.85;
      const topY = 1000 * 0.15;
      const fastRestY = hitLineY - (50 / LOOKAHEAD_MS) * (hitLineY - topY);
      const slowRestY = topY; // distanceMs 2000 > LOOKAHEAD_MS, clamped to the very top of the lane

      const fastDistanceFromRest = Math.abs(fastContainer.children[1]!.y - fastRestY);
      const slowDistanceFromRest = Math.abs(slowContainer.children[1]!.y - slowRestY);
      expect(fastDistanceFromRest).toBeLessThan(slowDistanceFromRest);
    });
  });

  describe('continuity across a tap (advancedByTap) — this is the "jumps instead of flowing" fix', () => {
    it('continues a carried-over chord smoothly from its current on-screen position mid-transition — no jump', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 400, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
        ],
        'parliament',
        FRESH,
      );

      renderer.tick(150); // partway through the second chord's own transition (not yet settled)
      const secondDotYBeforeTap = container.children[1]!.y;

      // The tap consumes chord 0; chord 1 becomes the new chord 0, now 250ms from due
      // (400 - 150, assuming on-tempo play). advancedByTap=true must pick up exactly where the
      // dot visually was — not jump to its new position, and not pop back above it either.
      renderer.showUpcoming([{ distanceMs: 250, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', ADVANCED_BY_TAP);

      expect(container.children[0]!.y).toBeCloseTo(secondDotYBeforeTap);
    });

    it('continues smoothly even when the carried-over chord had already fully settled before the tap', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 100, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
        ],
        'parliament',
        FRESH,
      );
      renderer.tick(900); // both chords fully settled long before any tap
      const settledSecondDotY = container.children[1]!.y;

      renderer.showUpcoming([{ distanceMs: 50, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', ADVANCED_BY_TAP);

      // Starts exactly from its settled position — not from a fresh "rise from above" entrance.
      expect(container.children[0]!.y).toBeCloseTo(settledSecondDotY);
    });

    it('does NOT continue from the old position when advancedByTap is false (a genuine reset) — re-enters as a brand-new chord', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 400, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
        ],
        'parliament',
        FRESH,
      );

      renderer.tick(150);
      const secondDotYBeforeReset = container.children[1]!.y;

      // A restart/seek (advancedByTap=false), not a tap: even reusing similar content, this must
      // re-enter as a brand-new chord (rise-from-above entrance), never continue from the old y.
      renderer.showUpcoming([{ distanceMs: 250, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);

      const hitLineY = 1000 * 0.85;
      const topY = 1000 * 0.15;
      const toY = hitLineY - (250 / LOOKAHEAD_MS) * (hitLineY - topY);
      const durationMs = Math.min(900, Math.max(200, (250 - 0) * 2.5));
      const durationFraction = (durationMs - 200) / (900 - 200);
      const risePx = 18 + (110 - 18) * durationFraction;
      const expectedFreshFromY = toY - risePx;

      expect(container.children[0]!.y).toBeCloseTo(expectedFreshFromY);
      expect(container.children[0]!.y).not.toBeCloseTo(secondDotYBeforeReset, 0);
    });

    it("glides a carried-over chord over how long the player actually just took, not an unrelated authored gap (fixes the 'too aggressive' speed)", () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          // A tiny 50ms authored gap — under the old (buggy) formula this alone would have
          // clamped the *next* chord's carried-over glide to the 80ms floor, regardless of how
          // long the player actually took to tap.
          { distanceMs: 50, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
        ],
        'parliament',
        FRESH,
      );

      renderer.tick(500); // the player actually takes half a second before tapping
      renderer.showUpcoming([{ distanceMs: 0, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', ADVANCED_BY_TAP);
      // duration = 500ms real gap x2.5 slowdown = 1250ms, clamped to the 900ms ceiling.

      const hitLineY = 1000 * 0.85;
      renderer.tick(200); // well short of the 900ms ceiling
      // Under the old (buggy) formula (duration clamped from the unrelated 50ms authored gap to
      // the original 80ms floor), this would already be fully settled at the hit line by now —
      // that's the "rushed" bug. The fix keeps it visibly still gliding, well short of arrival.
      expect(container.children[0]!.y).toBeLessThan(hitLineY - 5);

      renderer.tick(700); // total 900ms since the tap — now the glide should be complete
      expect(container.children[0]!.y).toBeCloseTo(hitLineY);
    });

    it('stretches a carried-over glide beyond a literal 1:1 mapping to real elapsed time (the "still aggressive" fix)', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 50, notes: [62].map((midi) => ({ midi, velocity: 100 })) }, // its own ~200ms entrance settles well within the 250ms below
        ],
        'parliament',
        FRESH,
      );

      renderer.tick(250); // the player takes 250ms before tapping
      renderer.showUpcoming([{ distanceMs: 0, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', ADVANCED_BY_TAP);
      // duration = 250ms real gap x2.5 = 625ms, not a literal 250ms.

      const hitLineY = 1000 * 0.85;
      renderer.tick(250); // exactly the raw real gap has now elapsed since the tap — a literal
      // (unscaled) mapping would already be fully settled at exactly this point.
      expect(container.children[0]!.y).toBeLessThan(hitLineY - 5); // the x2.5 stretch means it's still mid-glide

      renderer.tick(375); // total 625ms since the tap — now the glide should be complete
      expect(container.children[0]!.y).toBeCloseTo(hitLineY);
    });

    it('raises even a near-instant tap to a comfortable minimum glide, never snapping', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 30, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
        ],
        'parliament',
        FRESH,
      );

      renderer.tick(10); // the player double-taps almost instantly — barely any real gap at all
      renderer.showUpcoming([{ distanceMs: 0, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', ADVANCED_BY_TAP);
      // raw duration = 10ms x2.5 = 25ms, clamped up to the 200ms floor — not the original 80ms one.

      const hitLineY = 1000 * 0.85;
      renderer.tick(100); // roughly halfway to the 200ms floor
      expect(container.children[0]!.y).toBeLessThan(hitLineY - 5); // not settled yet

      renderer.tick(100); // total 200ms since the tap
      expect(container.children[0]!.y).toBeCloseTo(hitLineY);
    });

    it('clamps a carried-over glide to the same maximum as any other transition, even after a very long pause', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 3000, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
        ],
        'parliament',
        FRESH,
      );

      renderer.tick(10_000); // the player takes 10 real seconds before tapping
      renderer.showUpcoming([{ distanceMs: 0, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', ADVANCED_BY_TAP);

      renderer.tick(900); // the shared transition ceiling — must be fully settled by exactly here
      expect(container.children[0]!.y).toBeCloseTo(1000 * 0.85);
    });
  });
});
