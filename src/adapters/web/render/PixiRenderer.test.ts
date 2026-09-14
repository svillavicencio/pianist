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
      'parliament'
    );

    expect(container.children).toHaveLength(2);
    expect(container.children[0]?.x).toBeCloseTo(0);
    expect(container.children[1]?.x).toBeCloseTo(1000);
    expect(container.children[0]!.y).toBeGreaterThan(container.children[1]!.y);
  });

  it('replaces the previous upcoming preview (and destroys its graphics) on each call', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600, LOOKAHEAD_MS);

    renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');
    const firstDot = container.children[0] as PIXI.Graphics;
    const destroySpy = vi.spyOn(firstDot, 'destroy');

    renderer.showUpcoming(
      [
        { distanceMs: 200, notes: [64].map((midi) => ({ midi, velocity: 100 })) },
        { distanceMs: 400, notes: [67].map((midi) => ({ midi, velocity: 100 })) },
      ],
      'parliament'
    );

    expect(destroySpy).toHaveBeenCalledOnce();
    expect(container.children).toHaveLength(2);
  });

  it('does not affect already-spawned hit particles', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600, LOOKAHEAD_MS);

    renderer.spawnNoteVisual(60, 100, 'parliament');
    renderer.showUpcoming([{ distanceMs: 0, notes: [64].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');
    renderer.showUpcoming([], 'parliament'); // clearing the preview must not touch the hit particle

    expect(container.children).toHaveLength(1);
  });

  it("clusters a multi-note chord's dots around a shared x instead of spreading by pitch", () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

    renderer.showUpcoming([{ distanceMs: 0, notes: [21, 108].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');

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

    renderer.showUpcoming([{ distanceMs: 0, notes: [108].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');

    expect(container.children[0]!.x).toBeCloseTo(1000);
  });

  it('no longer draws a connecting line for a multi-note chord', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

    renderer.showUpcoming([{ distanceMs: 0, notes: [60, 67].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');

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
      'parliament'
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

    renderer.showUpcoming([{ distanceMs: 0, notes: [30, 100].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');

    const colors = fillSpy.mock.calls.map((call) => call[0] as number);
    expect(colors[0]).not.toBe(colors[1]);
    fillSpy.mockRestore();
  });

  it('draws upcoming dots as filled circles, matching hit particles', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
    const fillSpy = vi.spyOn(PIXI.Graphics.prototype, 'fill');
    const strokeSpy = vi.spyOn(PIXI.Graphics.prototype, 'stroke');

    renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');

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
        'parliament'
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
        'parliament'
      );
      renderer.tick(900); // let both entrances (bounded up to 900ms) fully settle first

      const nearY = container.children[0]!.y;
      const farY = container.children[1]!.y;
      expect(nearY - farY).toBeCloseTo(1000 * 0.5 * (0.85 - 0.15));
    });
  });

  describe('resting position (static once settled — see "entrance transition" below)', () => {
    const ENTRANCE_MAX_MS = 900; // must outlast any bounded entrance to reach the true resting position

    it('settles an upcoming dot at its distanceMs-implied position', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: LOOKAHEAD_MS / 2, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');
      renderer.tick(ENTRANCE_MAX_MS);

      const hitLineY = 1000 * 0.85;
      const topY = 1000 * 0.15;
      expect(container.children[0]!.y).toBeCloseTo(hitLineY - 0.5 * (hitLineY - topY));
    });

    it('pins a due chord (distanceMs 0) at the hit line', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');
      renderer.tick(ENTRANCE_MAX_MS);

      expect(container.children[0]!.y).toBeCloseTo(1000 * 0.85);
    });

    it('does not move a settled dot as tick() keeps advancing — only a new showUpcoming repositions it', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: LOOKAHEAD_MS, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');
      renderer.tick(ENTRANCE_MAX_MS); // let it fully settle first
      const settledY = container.children[0]!.y;

      renderer.tick(50_000); // however long the player waits after that, nothing here should move

      expect(container.children[0]!.y).toBe(settledY);
    });

    it('leaves upcoming dots undestroyed/uncreated by tick() — same graphics throughout, only repositioned', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: LOOKAHEAD_MS, notes: [21, 108].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');
      const graphicsAfterShow = [...container.children];

      renderer.tick(LOOKAHEAD_MS / 2);

      expect(container.children).toHaveLength(graphicsAfterShow.length);
      container.children.forEach((graphic, index) => expect(graphic).toBe(graphicsAfterShow[index]));
    });

    it('keeps every note beyond the first exactly where its own distanceMs puts it, once settled — no approach toward the hit line', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 400, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
        ],
        'parliament',
      );
      renderer.tick(ENTRANCE_MAX_MS);
      const secondDotY = container.children[1]!.y;

      renderer.tick(400); // right up to (and past) when the second note becomes due

      const hitLineY = 1000 * 0.85;
      expect(container.children[1]!.y).toBe(secondDotY); // did not creep toward the hit line
      expect(container.children[1]!.y).toBeLessThan(hitLineY - 1); // stayed clearly separated from the first
    });

    it('recomputes every dot fresh (a jump, never a continuation) on the next showUpcoming call', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: 400, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');
      renderer.tick(1_000_000); // waiting changes nothing now — position is static until the next call

      renderer.showUpcoming([{ distanceMs: 0, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');
      renderer.tick(ENTRANCE_MAX_MS);

      expect(container.children[0]!.y).toBeCloseTo(1000 * 0.85); // settles at its new position
    });
  });

  describe('entrance transition', () => {
    it('starts a freshly-shown dot above its resting position, not already there', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

      renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');

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
      );
      const slowContainer = new FakeContainer();
      new PixiRenderer(slowContainer, 1000, 1000, LOOKAHEAD_MS).showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 2000, notes: [62].map((midi) => ({ midi, velocity: 100 })) }, // slow, held-note gap
        ],
        'parliament',
      );

      const hitLineY = 1000 * 0.85;
      const topY = 1000 * 0.15;
      const fastRestY = hitLineY - (50 / LOOKAHEAD_MS) * (hitLineY - topY);
      const slowRestY = topY; // distanceMs 2000 > LOOKAHEAD_MS, clamped to the very top of the lane

      const fastStartRise = fastRestY - fastContainer.children[1]!.y;
      const slowStartRise = slowRestY - slowContainer.children[1]!.y;
      expect(slowStartRise).toBeGreaterThan(fastStartRise);
    });

    it('eases down to exactly the resting position by the time its entrance duration elapses', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');

      renderer.tick(320); // the widest possible entrance bound

      expect(container.children[0]!.y).toBeCloseTo(1000 * 0.85);
    });

    it('never overshoots past the resting position even long after the entrance would have finished', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');

      renderer.tick(320);
      const atSettleY = container.children[0]!.y;
      renderer.tick(100_000);

      expect(container.children[0]!.y).toBe(atSettleY);
    });

    it('moves partway toward its resting position mid-entrance, not all at once', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      // distanceMs of 250 clamps the entrance duration into the middle of its bounds (80-320ms).
      renderer.showUpcoming([{ distanceMs: 250, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament');
      const startY = container.children[0]!.y;

      renderer.tick(50); // partway through a ~250ms entrance

      const midY = container.children[0]!.y;
      const hitLineY = 1000 * 0.85;
      expect(midY).toBeGreaterThan(startY); // moved down some...
      expect(midY).toBeLessThan(hitLineY - 5); // ...but nowhere near fully settled yet
    });

    it('gives a fast passage (small gap since the previous chord) a shorter entrance than a slow one', () => {
      const fastContainer = new FakeContainer();
      const fastRenderer = new PixiRenderer(fastContainer, 1000, 1000, LOOKAHEAD_MS);
      fastRenderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 50, notes: [62].map((midi) => ({ midi, velocity: 100 })) }, // fast trill gap
        ],
        'parliament',
      );

      const slowContainer = new FakeContainer();
      const slowRenderer = new PixiRenderer(slowContainer, 1000, 1000, LOOKAHEAD_MS);
      slowRenderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 2000, notes: [62].map((midi) => ({ midi, velocity: 100 })) }, // slow, held-note gap
        ],
        'parliament',
      );

      // Same real elapsed time into both entrances: the fast one's duration clamps to the 80ms
      // floor (50ms gap), so 100ms in it's already fully settled; the slow one's clamps to the
      // 320ms ceiling (2000ms gap), so 100ms in it's still well into its transition.
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
});
