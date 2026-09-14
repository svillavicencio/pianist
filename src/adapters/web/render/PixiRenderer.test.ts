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

      const nearY = container.children[0]!.y;
      const farY = container.children[1]!.y;
      expect(nearY - farY).toBeCloseTo(1000 * 0.5 * (0.85 - 0.15));
    });
  });

  describe('continuous real-time fall', () => {
    it('positions a freshly-shown dot exactly at its distanceMs-implied position at t=0', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

      renderer.showUpcoming([{ distanceMs: LOOKAHEAD_MS / 2, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);

      const hitLineY = 1000 * 0.85;
      const topY = 1000 * 0.15;
      expect(container.children[0]!.y).toBeCloseTo(hitLineY - 0.5 * (hitLineY - topY));
    });

    it('pins a due chord (distanceMs 0) at the hit line', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);

      expect(container.children[0]!.y).toBeCloseTo(1000 * 0.85);
    });

    it('moves a dot continuously toward the hit line as tick() advances, with no tap at all', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: LOOKAHEAD_MS, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);
      const startY = container.children[0]!.y;

      renderer.tick(LOOKAHEAD_MS / 4);
      const quarterY = container.children[0]!.y;
      renderer.tick(LOOKAHEAD_MS / 4);
      const halfY = container.children[0]!.y;

      // Strictly, continuously closer to the hit line each tick — never static between ticks,
      // never jumping in one shot.
      expect(quarterY).toBeGreaterThan(startY);
      expect(halfY).toBeGreaterThan(quarterY);
      const hitLineY = 1000 * 0.85;
      const topY = 1000 * 0.15;
      expect(halfY).toBeCloseTo(hitLineY - 0.5 * (hitLineY - topY));
    });

    it('does not create or destroy graphics on tick() — same dots throughout, only repositioned', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: LOOKAHEAD_MS, notes: [21, 108].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);
      const graphicsAfterShow = [...container.children];

      renderer.tick(LOOKAHEAD_MS / 2);

      expect(container.children).toHaveLength(graphicsAfterShow.length);
      container.children.forEach((graphic, index) => expect(graphic).toBe(graphicsAfterShow[index]));
    });

    it('pins an overdue chord at the hit line instead of overshooting past it while the player is slow', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: 100, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);

      renderer.tick(100_000); // player waits far longer than this chord's own distance

      expect(container.children[0]!.y).toBeCloseTo(1000 * 0.85);
    });

    it("keeps two notes' relative spacing constant while waiting — the second never creeps toward the first", () => {
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
      const initialGap = container.children[1]!.y - container.children[0]!.y;

      renderer.tick(150); // player waits, well before the second note is due

      const laterGap = container.children[1]!.y - container.children[0]!.y;
      // Both dots move down by the same real-time amount, so the gap between them is preserved —
      // this is the exact "second note creeps toward the first" bug this model rules out by
      // construction, not by a compression/anti-stacking hack.
      expect(laterGap).toBeCloseTo(initialGap);
    });

    it("carries a chord's due moment across a tap-advanced showUpcoming call — no jump", () => {
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

      renderer.tick(150); // player taps partway to the second note's due moment
      const secondDotYBeforeTap = container.children[1]!.y;

      // The tap consumes chord 0; chord 1 becomes the new chord 0, now 250ms from due
      // (400 - 150). advancedByTap=true must carry its due moment forward untouched.
      renderer.showUpcoming([{ distanceMs: 250, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', ADVANCED_BY_TAP);

      expect(container.children[0]!.y).toBeCloseTo(secondDotYBeforeTap);
    });

    it('does NOT carry a due moment forward when advancedByTap is false (a genuine reset)', () => {
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

      // A restart/seek (advancedByTap=false), not a tap — even though the content lines up the
      // same way, this must NOT carry the old due moment forward; it re-derives fresh from now.
      renderer.showUpcoming([{ distanceMs: 250, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', FRESH);

      const hitLineY = 1000 * 0.85;
      const topY = 1000 * 0.15;
      const freshY = hitLineY - (250 / LOOKAHEAD_MS) * (hitLineY - topY);
      expect(container.children[0]!.y).toBeCloseTo(freshY);
      expect(container.children[0]!.y).not.toBeCloseTo(secondDotYBeforeReset, 0);
    });
  });
});
