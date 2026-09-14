import * as PIXI from 'pixi.js';
import type { Renderer } from '../../../ports/Renderer';
import type { ColorTheme, MidiNote, Velocity } from '../../../domain/types';
import type { UpcomingChordPreview } from '../../../domain/upcomingNotesPreview';
import { MAX_MIDI, MIN_MIDI, colorForNote, easeOutQuad, particleStateAt, radiusForVelocity, shiftLightness } from './noteParticleLifecycle';
import { SPAWN_HEIGHT_FRACTION } from './backdrop';

/** How long (ms) a spawned note visual lives before it's removed; matches PARTICLE lifecycle tuning. */
const PARTICLE_LIFETIME_MS = 800;

/** Radius (px) of the circle drawn for each note visual, before `particleStateAt`'s scale is applied. */
const BASE_RADIUS_PX = 32;

/** Radius (px) of an "upcoming note" preview dot — smaller than a hit particle so the two read as distinct. */
const UPCOMING_RADIUS_PX = 16;

/** Alpha of an "upcoming note" preview dot — dimmer than a hit particle so it reads as "not yet played". */
const UPCOMING_ALPHA = 0.55;

/** Fraction of the viewport height the preview lane's top edge sits at; dots fall from here down to the hit line. */
const UPCOMING_TOP_FRACTION = 0.15;

/** How far (-1..1, negative = darker, positive = lighter) every other upcoming chord's dots are
 *  lightness-shifted from their pitch-based color, so consecutive taps alternate shade. Positive
 *  (toward white) rather than the old toward-black shift — darkening further on an already-dark
 *  background loses contrast instead of gaining it. */
const UPCOMING_ALT_LIGHTNESS_SHIFT = 0.3;

/** Horizontal offset (px) between adjacent dots in a clustered chord — small relative to the
 *  dot radius so members still visibly overlap, reading as "one cluster" the way a simultaneous
 *  chord does in touchpianist/Piano-Flow, rather than as separate notes. */
const CLUSTER_JITTER_STEP_PX = 8;

/** Bounds (ms) for the "falling into place" entrance transition an upcoming dot plays once, right
 *  when it (re)appears — bounded and self-terminating, unlike the old continuous real-time fall.
 *  Its duration is drawn from the chord's own gap since the previous one in the passage (clamped
 *  to these bounds), so a fast trill settles almost instantly while a slow passage eases in more
 *  visibly — the transition reads as "how the piece should be played" without ever letting a
 *  waiting player see a note creep toward the hit line: once elapsed reaches the duration, the
 *  dot is pinned at its resting position and `tick()` stops touching it. */
const ENTRANCE_MIN_MS = 80;
const ENTRANCE_MAX_MS = 320;
/** How far (px) above its resting position a dot starts its entrance, easing down into place. */
const ENTRANCE_RISE_PX = 26;

/** One tracked particle: the PIXI display object plus how long it's been alive. */
interface TrackedParticle {
  readonly graphic: PIXI.Graphics;
  readonly midi: MidiNote;
  elapsedMs: number;
}

/**
 * One tracked "upcoming chord" preview: its resting position (computed once from the `distanceMs`
 * snapshot taken when `showUpcoming` was last called — never recomputed afterward) plus a bounded
 * entrance transition that eases each dot into that resting position when it first appears.
 * `entranceElapsedMs` is the only thing `tick()` ever advances here, and only until it reaches
 * `entranceDurationMs` — once it does, the chord is fully settled and `tick()` leaves it alone.
 */
interface TrackedUpcomingChord {
  readonly distanceMs: number;
  readonly xs: readonly number[];
  readonly colors: readonly number[]; // one per dot, same order as `xs`/`dots`
  readonly dots: readonly PIXI.Graphics[];
  readonly restY: number;
  readonly entranceDurationMs: number;
  entranceElapsedMs: number;
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

  constructor(
    private readonly container: NoteVisualContainer,
    private width: number,
    private height: number,
    private readonly lookaheadMs: number,
  ) {}

  spawnNoteVisual(midi: MidiNote, velocity: Velocity, colorTheme: ColorTheme): void {
    const graphic = new PIXI.Graphics();
    graphic.circle(0, 0, radiusForVelocity(BASE_RADIUS_PX, velocity)).fill(colorForNote(colorTheme, midi));
    graphic.x = this.xForMidi(midi);
    graphic.y = this.height * SPAWN_HEIGHT_FRACTION;
    this.container.addChild(graphic);
    this.particles.push({ graphic, midi, elapsedMs: 0 });
  }

  /**
   * Rebuilds the upcoming lane from a fresh snapshot. Every dot's resting position comes directly
   * from its own `distanceMs` — a static step-ladder, not a continuous real-time fall. Only the
   * very next chord (`distanceMs === 0`) rests at the hit line; everything else rests exactly
   * where its own distance puts it, and nothing ever "creeps" toward the hit line while waiting —
   * that's what made an unplayed second note look like it had also become due.
   *
   * Each dot still plays a short, bounded "falling into place" entrance (see `ENTRANCE_MIN_MS`)
   * when it first appears here, so the transition itself reads as motion — it just never continues
   * past its own resting position, no matter how long the player waits afterward.
   */
  showUpcoming(chords: readonly UpcomingChordPreview[], colorTheme: ColorTheme): void {
    for (const tracked of this.upcoming) {
      for (const dot of tracked.dots) {
        this.container.removeChild(dot);
        dot.destroy();
      }
    }

    this.upcoming = chords.map((chord, index) => {
      // Odd chords (the "in-between" tap relative to the one before) get lightened, so
      // consecutive taps read apart even when they share a pitch.
      const isAlternate = index % 2 === 1;
      const midis = chord.notes.map((note) => note.midi);
      const xs = this.xsForChord(midis);
      const colors = midis.map((midi) => {
        const base = colorForNote(colorTheme, midi);
        return isAlternate ? shiftLightness(base, UPCOMING_ALT_LIGHTNESS_SHIFT) : base;
      });
      const radii = chord.notes.map((note) => radiusForVelocity(UPCOMING_RADIUS_PX, note.velocity));
      const restY = this.yForDistance(this.lookaheadMs > 0 ? chord.distanceMs / this.lookaheadMs : 0);
      // The gap (ms) since the previous chord in this snapshot — this chord's own authored pace —
      // clamped into the entrance-duration bounds. `chords[index - 1]` is undefined for the first
      // chord, whose own `distanceMs` is always 0, so this correctly falls back to the fastest bound.
      const previousDistanceMs = chords[index - 1]?.distanceMs ?? 0;
      const entranceDurationMs = Math.min(
        ENTRANCE_MAX_MS,
        Math.max(ENTRANCE_MIN_MS, chord.distanceMs - previousDistanceMs),
      );

      const dots = xs.map((x, i) => {
        const dot = new PIXI.Graphics();
        dot.circle(0, 0, radii[i]!).fill(colors[i]!);
        dot.alpha = UPCOMING_ALPHA;
        dot.x = x;
        this.container.addChild(dot);
        return dot;
      });

      const tracked: TrackedUpcomingChord = {
        distanceMs: chord.distanceMs,
        xs,
        colors,
        dots,
        restY,
        entranceDurationMs,
        entranceElapsedMs: 0,
      };
      this.applyEntranceFrame(tracked);
      return tracked;
    });
  }

  /** Advances hit-particle animation, plus any upcoming dots still mid-entrance (see
   *  `ENTRANCE_MIN_MS`) — every other upcoming dot is already settled and untouched here; waiting
   *  never moves a note past its own resting position. */
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

    for (const tracked of this.upcoming) {
      if (tracked.entranceElapsedMs >= tracked.entranceDurationMs) continue; // already settled
      tracked.entranceElapsedMs = Math.min(tracked.entranceElapsedMs + deltaMs, tracked.entranceDurationMs);
      this.applyEntranceFrame(tracked);
    }
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

  /** X positions for one chord's notes: a single note keeps its own pitch position; 2+ notes
   *  (a simultaneous tap) cluster tightly around their average pitch's x, offset only enough
   *  to read as "more than one dot" — the overlap itself is the "press together" signal. */
  private xsForChord(midis: readonly MidiNote[]): readonly number[] {
    if (midis.length <= 1) return midis.map((midi) => this.xForMidi(midi));
    const averageMidi = midis.reduce((sum, midi) => sum + midi, 0) / midis.length;
    const clusterX = this.xForMidi(averageMidi);
    return midis.map((_, i) => clusterX + (i - (midis.length - 1) / 2) * CLUSTER_JITTER_STEP_PX);
  }

  /** Maps a 0..1 "how far out" ratio to a y coordinate: it falls from near the top down to the hit line. */
  private yForDistance(distance: number): number {
    const hitLineY = this.height * SPAWN_HEIGHT_FRACTION;
    const topY = this.height * UPCOMING_TOP_FRACTION;
    const clampedDistance = Math.min(Math.max(distance, 0), 1);
    return hitLineY - clampedDistance * (hitLineY - topY);
  }

  /** Sets every dot in `tracked` to its current entrance-animation frame: eased from
   *  `ENTRANCE_RISE_PX` above `restY` (at `entranceElapsedMs === 0`) down to exactly `restY` (once
   *  `entranceElapsedMs` reaches `entranceDurationMs`) — never past it, in either direction. */
  private applyEntranceFrame(tracked: TrackedUpcomingChord): void {
    const t = tracked.entranceDurationMs > 0 ? tracked.entranceElapsedMs / tracked.entranceDurationMs : 1;
    const y = tracked.restY - ENTRANCE_RISE_PX * (1 - easeOutQuad(t));
    for (const dot of tracked.dots) dot.y = y;
  }
}
