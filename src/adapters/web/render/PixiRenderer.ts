import * as PIXI from 'pixi.js';
import type { Renderer } from '../../../ports/Renderer';
import type { ColorTheme, MidiNote, Velocity } from '../../../domain/types';
import type { UpcomingChordPreview } from '../../../domain/upcomingNotesPreview';
import { MAX_MIDI, MIN_MIDI, colorForNote, particleStateAt, radiusForVelocity, shiftLightness } from './noteParticleLifecycle';
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
   * Rebuilds the upcoming lane from a fresh snapshot. Every dot is positioned directly from its
   * own `distanceMs` (see `positionUpcoming`) — a static step-ladder, not a continuous real-time
   * fall. Only the very next chord (`distanceMs === 0`) sits at the hit line; everything else
   * stays exactly where its own distance puts it until the player's next tap calls this again —
   * nothing "creeps" toward the hit line while waiting, which is what made an unplayed second
   * note look like it had also become due.
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

  /** Advances hit-particle animation only — the upcoming lane is static (see `showUpcoming`) and
   *  has nothing here to advance; waiting never moves an unplayed note. */
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

  /**
   * Positions every tracked upcoming chord directly from its own snapshot `distanceMs` — a static
   * step-ladder, not a real-time animation. `upcoming[0]` is always the chord the *next* tap will
   * fire, so it's always already at `distanceMs === 0`, pinned at the hit line; everything else
   * sits at whatever height its own distance implies and stays there — motionless — until the
   * player's next tap calls `showUpcoming` again with a fresh snapshot. Nothing here ever "creeps"
   * toward the hit line while the player is deciding when to tap.
   */
  private positionUpcoming(): void {
    for (const tracked of this.upcoming) {
      const y = this.yForDistance(this.lookaheadMs > 0 ? tracked.distanceMs / this.lookaheadMs : 0);
      for (const dot of tracked.dots) dot.y = y;
    }
  }
}
