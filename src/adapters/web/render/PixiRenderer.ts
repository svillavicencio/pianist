import * as PIXI from 'pixi.js';
import type { Renderer } from '../../../ports/Renderer';
import type { ColorTheme, MidiNote } from '../../../domain/types';
import type { UpcomingChordPreview } from '../../../domain/upcomingNotesPreview';
import { MAX_MIDI, MIN_MIDI, colorForNote, particleStateAt, shiftLightness } from './noteParticleLifecycle';

/** How long (ms) a spawned note visual lives before it's removed; matches PARTICLE lifecycle tuning. */
const PARTICLE_LIFETIME_MS = 800;

/** Radius (px) of the circle drawn for each note visual, before `particleStateAt`'s scale is applied. */
const BASE_RADIUS_PX = 24;

/** Fraction of the viewport height a spawned particle sits at; near the bottom, like keys on a keyboard. */
const SPAWN_HEIGHT_FRACTION = 0.85;

/** Radius (px) of an "upcoming note" preview dot — smaller than a hit particle so the two read as distinct. */
const UPCOMING_RADIUS_PX = 10;

/** Stroke width (px) of an upcoming-note dot's outline — hollow, unlike a filled hit particle. */
const UPCOMING_STROKE_WIDTH_PX = 2;

/** Alpha of an "upcoming note" preview dot — dimmer than a hit particle so it reads as "not yet played". */
const UPCOMING_ALPHA = 0.55;

/** Fraction of the viewport height the preview lane's top edge sits at; dots fall from here down to the hit line. */
const UPCOMING_TOP_FRACTION = 0.15;

/** How far (-1..1, negative = darker, positive = lighter) every other upcoming chord's dots are
 *  lightness-shifted from their pitch-based color, so consecutive taps alternate shade. Positive
 *  (toward white) rather than the old toward-black shift — darkening further on an already-dark
 *  background loses contrast instead of gaining it. */
const UPCOMING_ALT_LIGHTNESS_SHIFT = 0.3;

/** Width (px) of the line connecting a multi-note chord's dots — "these notes fire on the same tap". */
const UPCOMING_CHORD_LINE_WIDTH_PX = 3;

/** Minimum vertical gap (px) enforced between two consecutive upcoming dots — without this, a
 *  fast passage's notes (close together in authored time) render close enough to visually merge. */
const MIN_UPCOMING_GAP_PX = 28;

/** One tracked particle: the PIXI display object plus how long it's been alive. */
interface TrackedParticle {
  readonly graphic: PIXI.Graphics;
  readonly midi: MidiNote;
  elapsedMs: number;
}

/**
 * One tracked "upcoming chord" preview: its snapshot distance (ms, taken when `showUpcoming` was
 * last called) plus the graphics drawn for it, repositioned every `tick()` as real time passes —
 * this is what makes the dots fall smoothly at the piece's authored pace instead of jumping
 * between static positions only when the cursor moves.
 */
interface TrackedUpcomingChord {
  readonly distanceMs: number;
  readonly xs: readonly number[];
  readonly colors: readonly number[]; // one per dot, same order as `xs`/`dots`
  readonly dots: readonly PIXI.Graphics[];
  readonly line: PIXI.Graphics | undefined;
}

/**
 * The minimal slice of `PIXI.Container` this class needs. A real `PIXI.Container`
 * satisfies this structurally, but tests can inject a lightweight fake instead of
 * spinning up real PixiJS scene-graph objects for the container itself.
 */
export interface NoteVisualContainer {
  addChild(child: PIXI.Graphics): void;
  removeChild(child: PIXI.Graphics): void;
}

/**
 * Implements the `Renderer` port with PixiJS, drawing note visuals as procedurally
 * generated circles (no external image assets — see the track's legal/scope note).
 *
 * Constructed with the container to draw into (typically a `PIXI.Application`'s
 * `.stage`) rather than the `Application` itself, so this class never needs a real
 * canvas/WebGL context to be constructed and unit-tested — the caller owns creating
 * (and resizing) the `PIXI.Application`. Because this class only has a container,
 * `resize()` just records the new dimensions for its own positioning math; it does
 * NOT call `app.renderer.resize()` — the caller must do that separately.
 *
 * `lookaheadMs` is the same window the caller passed to `upcomingChordsPreview` — it's
 * needed again here to keep converting each chord's ever-decreasing `distanceMs` into
 * a 0..1 vertical position as `tick()` advances real time.
 */
export class PixiRenderer implements Renderer {
  private readonly particles: TrackedParticle[] = [];
  private upcoming: TrackedUpcomingChord[] = [];
  private upcomingElapsedMs = 0;

  constructor(
    private readonly container: NoteVisualContainer,
    private width: number,
    private height: number,
    private readonly lookaheadMs: number,
  ) {}

  spawnNoteVisual(midi: MidiNote, colorTheme: ColorTheme): void {
    const graphic = new PIXI.Graphics();
    graphic.circle(0, 0, BASE_RADIUS_PX).fill(colorForNote(colorTheme, midi));
    graphic.x = this.xForMidi(midi);
    graphic.y = this.height * SPAWN_HEIGHT_FRACTION;
    this.container.addChild(graphic);
    this.particles.push({ graphic, midi, elapsedMs: 0 });
  }

  showUpcoming(chords: readonly UpcomingChordPreview[], colorTheme: ColorTheme, continuedFromPreviousTap: boolean): void {
    // Rebase the fall clock instead of resetting it: what's about to become the new `upcoming[0]`
    // was `upcoming[1]` a moment ago, already falling toward its own due time. Resetting elapsed to
    // 0 unconditionally would snap it straight to its resting position — a visible jump — instead of
    // letting it continue from wherever it actually was. `continuedFromPreviousTap` is false for a
    // genuinely discontinuous jump (seek, restart, or the very first snapshot), where a hard reset
    // to 0 is exactly right.
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
        dot.circle(0, 0, UPCOMING_RADIUS_PX).stroke({ width: UPCOMING_STROKE_WIDTH_PX, color: colors[i]! });
        dot.alpha = UPCOMING_ALPHA;
        dot.x = x;
        this.container.addChild(dot);
        return dot;
      });

      return { distanceMs: chord.distanceMs, xs, colors, dots, line };
    });

    this.positionUpcoming();
  }

  tick(deltaMs: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      if (!particle) continue;
      particle.elapsedMs += deltaMs;
      const state = particleStateAt(particle.elapsedMs, PARTICLE_LIFETIME_MS);
      particle.graphic.scale.set(state.scale);
      particle.graphic.alpha = state.alpha;
      if (state.isDead) {
        this.container.removeChild(particle.graphic);
        particle.graphic.destroy();
        this.particles.splice(i, 1);
      }
    }

    // `upcoming[1]` (the chord after the immediate next one) is what the freeze anchors on, not
    // `upcoming[0]` — that one is always already at `distanceMs === 0` by construction (it's the
    // next tap's target), so anchoring on it would freeze on the very first frame and kill the
    // animation outright. This game advances by tap, not by clock, so once `upcoming[1]` finishes
    // falling to the hit line, further real time must not keep dragging the chords behind it
    // forward too — the clock freezes there, holding the whole lane in place.
    //
    // Clamped HERE, at the source, rather than only where it's read for positioning: if the raw
    // value kept growing unbounded while frozen, a long wait before the next tap would leave it
    // holding a huge stale number. `showUpcoming()`'s continuity rebase (see there) subtracts
    // `upcoming[1]`'s distance from whatever this holds — fed that huge stale number instead of the
    // true frozen one, it would corrupt the next batch of chords' distances, snapping them straight
    // to the hit line instead of letting them fall in from the top.
    const freezeAtMs = this.upcoming[1]?.distanceMs;
    this.upcomingElapsedMs =
      freezeAtMs === undefined
        ? this.upcomingElapsedMs + deltaMs
        : Math.min(this.upcomingElapsedMs + deltaMs, freezeAtMs);
    this.positionUpcoming();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /** Maps a MIDI note linearly across the 88-key range to an x coordinate spanning the current width. */
  private xForMidi(midi: MidiNote): number {
    const t = (midi - MIN_MIDI) / (MAX_MIDI - MIN_MIDI);
    const clampedT = Math.min(Math.max(t, 0), 1);
    return clampedT * this.width;
  }

  /** Maps a 0..1 "how far out" ratio to a y coordinate: it falls from near the top down to the hit line. */
  private yForDistance(distance: number): number {
    const hitLineY = this.height * SPAWN_HEIGHT_FRACTION;
    const topY = this.height * UPCOMING_TOP_FRACTION;
    const clampedDistance = Math.min(Math.max(distance, 0), 1);
    return hitLineY - clampedDistance * (hitLineY - topY);
  }

  /**
   * Repositions every tracked upcoming chord from its snapshot `distanceMs` minus how much real
   * time has elapsed since that snapshot (`upcomingElapsedMs`, already frozen by `tick()` once it
   * hits the lane's freeze point — see there) — this is the smooth fall: a chord due in 2000ms
   * visibly glides down over the next 2 real seconds, landing on the hit line exactly when it's due.
   *
   * `upcoming[0]` is always the chord the *next* tap will fire, so it's always already at
   * `distanceMs === 0` — pinned at the hit line, nothing to animate there. `upcoming[1]` is the one
   * after that: the interesting one, since it's what the falling motion is actually illustrating
   * ("this is how long you'd wait before the tap after next").
   */
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
}
