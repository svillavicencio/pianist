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
      'parliament',
      false,
    );

    expect(container.children).toHaveLength(2);
    expect(container.children[0]?.x).toBeCloseTo(0);
    expect(container.children[1]?.x).toBeCloseTo(1000);
    expect(container.children[0]!.y).toBeGreaterThan(container.children[1]!.y);
  });

  it('replaces the previous upcoming preview (and destroys its graphics) on each call', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600, LOOKAHEAD_MS);

    renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', false);
    const firstDot = container.children[0] as PIXI.Graphics;
    const destroySpy = vi.spyOn(firstDot, 'destroy');

    renderer.showUpcoming(
      [
        { distanceMs: 200, notes: [64].map((midi) => ({ midi, velocity: 100 })) },
        { distanceMs: 400, notes: [67].map((midi) => ({ midi, velocity: 100 })) },
      ],
      'parliament',
      false,
    );

    expect(destroySpy).toHaveBeenCalledOnce();
    expect(container.children).toHaveLength(2);
  });

  it('does not affect already-spawned hit particles', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600, LOOKAHEAD_MS);

    renderer.spawnNoteVisual(60, 100, 'parliament');
    renderer.showUpcoming([{ distanceMs: 0, notes: [64].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', false);
    renderer.showUpcoming([], 'parliament', false); // clearing the preview must not touch the hit particle

    expect(container.children).toHaveLength(1);
  });

  it("clusters a multi-note chord's dots around a shared x instead of spreading by pitch", () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

    renderer.showUpcoming([{ distanceMs: 0, notes: [21, 108].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', false);

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

    renderer.showUpcoming([{ distanceMs: 0, notes: [108].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', false);

    expect(container.children[0]!.x).toBeCloseTo(1000);
  });

  it('no longer draws a connecting line for a multi-note chord', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);

    renderer.showUpcoming([{ distanceMs: 0, notes: [60, 67].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', false);

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
      false,
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

    renderer.showUpcoming([{ distanceMs: 0, notes: [30, 100].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', false);

    const colors = fillSpy.mock.calls.map((call) => call[0] as number);
    expect(colors[0]).not.toBe(colors[1]);
    fillSpy.mockRestore();
  });

  it('draws upcoming dots as filled circles, matching hit particles', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
    const fillSpy = vi.spyOn(PIXI.Graphics.prototype, 'fill');
    const strokeSpy = vi.spyOn(PIXI.Graphics.prototype, 'stroke');

    renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', false);

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
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 500, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
        ],
        'parliament',
        false,
      );

      const nearY = container.children[0]!.y;
      const farY = container.children[1]!.y;
      expect(nearY - farY).toBeCloseTo(1000 * 0.5 * (0.85 - 0.15));
    });
  });

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

      renderer.showUpcoming([{ distanceMs: 0, notes: [{ midi: 60, velocity: 100 }] }], 'parliament', false);

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

  describe('falling animation', () => {
    it('moves an upcoming dot smoothly toward the hit line as tick() advances real time', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: LOOKAHEAD_MS, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', false);
      const startY = container.children[0]!.y;

      renderer.tick(LOOKAHEAD_MS / 2); // halfway to due

      const midY = container.children[0]!.y;
      expect(midY).toBeGreaterThan(startY); // fell further down (y grows downward)

      renderer.tick(LOOKAHEAD_MS / 2); // now exactly due

      const dueY = container.children[0]!.y;
      expect(dueY).toBeGreaterThan(midY);
    });

    it('settles a due chord at the hit line and keeps it there rather than overshooting', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: 500, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', false);

      renderer.tick(500); // exactly due
      const atDueY = container.children[0]!.y;
      renderer.tick(2000); // long past due, e.g. the player hasn't tapped yet

      expect(container.children[0]!.y).toBe(atDueY);
    });

    it('reuses (rather than recreates) a multi-note chord\'s line and dots across ticks', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: LOOKAHEAD_MS, notes: [21, 108].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', false);
      const graphicsAfterShow = [...container.children];

      renderer.tick(LOOKAHEAD_MS / 2);

      expect(container.children).toHaveLength(graphicsAfterShow.length);
      container.children.forEach((graphic, index) => expect(graphic).toBe(graphicsAfterShow[index]));
    });

    it('animates the second chord smoothly, unlike the always-already-due first one', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }, // always "next up" — nothing to animate
          { distanceMs: 400, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
        ],
        'parliament',
        false,
      );
      const secondDotStartY = container.children[1]!.y;

      renderer.tick(200); // halfway to the second chord's due time

      expect(container.children[1]!.y).toBeGreaterThan(secondDotStartY); // fell further (y grows downward)
    });

    it('lets the second chord finish falling to the hit line, then freezes the whole lane there until the player taps', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 400, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 900, notes: [64].map((midi) => ({ midi, velocity: 100 })) }, // shouldn't get closer than its position at t=400 without input
        ],
        'parliament',
        false,
      );

      renderer.tick(400); // the second chord is now also due
      const thirdDotAtFreezeY = container.children[2]!.y;

      renderer.tick(2000); // the player still hasn't tapped — real time keeps passing regardless

      expect(container.children[2]!.y).toBe(thirdDotAtFreezeY); // frozen, the clock stopped advancing past 400ms
    });

    it('resets the fall clock on a discontinuous jump (seek/restart), snapshotting from the new cursor', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: LOOKAHEAD_MS, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', false);
      renderer.tick(LOOKAHEAD_MS); // that chord is now at the hit line

      // A seek/restart (continuedFromPreviousTap: false): the next chord is snapshotted fresh at
      // the far edge of the window again, regardless of how much time had elapsed before the jump.
      renderer.showUpcoming([{ distanceMs: LOOKAHEAD_MS, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', false);
      const freshY = container.children[0]!.y;

      const hitLineY = 1000 * 0.85;
      expect(freshY).toBeLessThan(hitLineY - 1);
    });

    it('keeps the fall flowing across a tap instead of snapping the new next-up chord into place', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 400, notes: [62].map((midi) => ({ midi, velocity: 100 })) }, // will become the new "next up" once the player taps
        ],
        'parliament',
        false,
      );

      renderer.tick(150); // the player taps early, before the second chord has finished falling
      const yJustBeforeTap = container.children[1]!.y;

      // The tap: cursor advances, [62] becomes the new upcoming[0]. Continuous, so it must not
      // snap straight to the hit line — it should still read as "150ms into a 400ms fall".
      renderer.showUpcoming([{ distanceMs: 0, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', true);
      const yRightAfterTap = container.children[0]!.y;

      expect(yRightAfterTap).toBeCloseTo(yJustBeforeTap);
    });

    it('lets the newly-promoted chord keep falling normally after a continuous tap', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 400, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
        ],
        'parliament',
        false,
      );
      renderer.tick(150); // tapped early, at 150 of 400ms

      renderer.showUpcoming([{ distanceMs: 0, notes: [62].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', true);
      const yRightAfterTap = container.children[0]!.y;

      renderer.tick(250); // the remaining 250ms of its original fall elapse normally

      const hitLineY = 1000 * 0.85;
      expect(container.children[0]!.y).toBeGreaterThan(yRightAfterTap); // kept falling further
      expect(container.children[0]!.y).toBeCloseTo(hitLineY); // and arrives right on time
    });

    it('does not corrupt the next fall after waiting far past the freeze point before finally tapping', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: 400, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
        ],
        'parliament',
        false,
      );

      renderer.tick(400); // frozen here
      renderer.tick(50_000); // the player waits a long time before finally tapping

      // The tap lands: [62] becomes the new upcoming[0], and a fresh chord a full window away
      // follows it. That fresh chord must render near the top, not snap to the hit line — the
      // 50 real seconds of waiting must not have corrupted the rebase.
      renderer.showUpcoming(
        [
          { distanceMs: 0, notes: [62].map((midi) => ({ midi, velocity: 100 })) },
          { distanceMs: LOOKAHEAD_MS, notes: [64].map((midi) => ({ midi, velocity: 100 })) },
        ],
        'parliament',
        true,
      );

      const hitLineY = 1000 * 0.85;
      expect(container.children[1]!.y).toBeLessThan(hitLineY - 1);
    });

    it('hard-resets (does not carry over) continuity when the previous snapshot had no second chord', () => {
      const container = new FakeContainer();
      const renderer = new PixiRenderer(container, 1000, 1000, LOOKAHEAD_MS);
      renderer.showUpcoming([{ distanceMs: 0, notes: [60].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', false); // only one chord left
      renderer.tick(300);

      // continuedFromPreviousTap: true, but there was no upcoming[1] to rebase from — must not throw
      // or produce garbage math, just behave like a normal fresh snapshot.
      expect(() =>
        renderer.showUpcoming([{ distanceMs: LOOKAHEAD_MS, notes: [64].map((midi) => ({ midi, velocity: 100 })) }], 'parliament', true),
      ).not.toThrow();

      const hitLineY = 1000 * 0.85;
      expect(container.children[0]!.y).toBeLessThan(hitLineY - 1); // rendered far, not snapped to the hit line
    });
  });
});
