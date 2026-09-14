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

/** Bounds (ms) for how long a dot takes to glide to its resting position — whether it's a brand
 *  new chord entering the lane, or one that was already visible sliding to its updated spot after
 *  a tap. Drawn from the chord's own gap since the previous one in the passage (clamped to these
 *  bounds), so a fast trill settles almost instantly while a genuinely slow passage (a held whole
 *  note, a fermata) eases in visibly over most of a second. Once `elapsedMs` reaches this, `tick()`
 *  stops touching the dot — it holds its resting position indefinitely, no matter how long the
 *  player waits, until the next `showUpcoming` call gives it a new target. That's the piece this
 *  session's real-time-clock attempt got wrong: a chord the player hasn't reached yet must NEVER
 *  approach the hit line on its own just because time passes — only an actual tap (a fresh
 *  snapshot) may move its target. */
const TRANSITION_MIN_MS = 80;
const TRANSITION_MAX_MS = 900;

/** Bounds (px) for how far above its resting position a *brand-new* dot starts its transition —
 *  scaled by the same fast/slow gap the duration uses, so a slow entrance isn't just longer but
 *  visibly travels further too. A dot that was already on screen instead starts exactly where it
 *  already was (see `showUpcoming`) — these bounds only apply to a genuinely new arrival. */
const NEW_CHORD_MIN_RISE_PX = 18;
const NEW_CHORD_MAX_RISE_PX = 110;

/** One tracked particle: the PIXI display object plus how long it's been alive. */
interface TrackedParticle {
  readonly graphic: PIXI.Graphics;
  readonly midi: MidiNote;
  elapsedMs: number;
}

/**
 * One tracked "upcoming chord" preview dot-group. `toY` is this chord's resting position for the
 * *current* snapshot — fixed once, from its own `distanceMs`, and never itself a moving target:
 * waiting longer never nudges it toward the hit line, only a fresh `showUpcoming` snapshot can.
 * `fromY` is wherever this chord's transition started: either its actual on-screen position a
 * moment ago (a chord that was already visible, continuing its glide smoothly instead of jumping)
 * or a point above `toY` (a chord appearing for the first time — see `showUpcoming`). `elapsedMs`
 * is the only thing `tick()` ever advances here, and only until it reaches `durationMs` — once it
 * does, the chord is fully settled and `tick()` leaves it alone.
 */
interface TrackedUpcomingChord {
  readonly xs: readonly number[];
  readonly colors: readonly number[]; // one per dot, same order as `xs`/`dots`
  readonly dots: readonly PIXI.Graphics[];
  readonly fromY: number;
  readonly toY: number;
  readonly durationMs: number;
  elapsedMs: number;
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
 * needed again here to convert each chord's `distanceMs` into a 0..1 vertical position.
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
   * Rebuilds the upcoming lane from a fresh snapshot. Every dot's resting position (`toY`) comes
   * directly from its own `distanceMs` — a chord the player hasn't reached yet never approaches
   * the hit line just because real time passes; only a fresh snapshot (a tap, or a reset) ever
   * moves its target, which is what makes the game keep waiting for the player no matter how long
   * they take on the current note.
   *
   * What stays continuous is the glide itself: when `advancedByTap` is true, a chord that was
   * already being shown one slot further out (`this.upcoming[index + 1]` in the *previous* list)
   * starts its new glide from wherever it actually is right now — mid-transition or already
   * settled — instead of jumping straight to its new spot or popping back above it. That's what
   * turns "recompute everything on every tap" from a visible jump into one continuous motion. A
   * genuinely new chord (not previously shown, or any chord after a restart/seek, where
   * `advancedByTap` is false) still enters with the "falling into place" rise from above.
   */
  showUpcoming(chords: readonly UpcomingChordPreview[], colorTheme: ColorTheme, advancedByTap: boolean): void {
    const previous = this.upcoming;

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
      const toY = this.yForDistance(this.lookaheadMs > 0 ? chord.distanceMs / this.lookaheadMs : 0);

      // The gap (ms) since the previous chord in this snapshot — this chord's own authored pace —
      // clamped into the transition-duration bounds. `chords[index - 1]` is undefined for the
      // first chord, whose own `distanceMs` is always 0, so this correctly falls back to the
      // fastest bound.
      const previousDistanceMs = chords[index - 1]?.distanceMs ?? 0;
      const durationMs = Math.min(
        TRANSITION_MAX_MS,
        Math.max(TRANSITION_MIN_MS, chord.distanceMs - previousDistanceMs),
      );

      const carriedOver = advancedByTap ? previous[index + 1] : undefined;
      let fromY: number;
      if (carriedOver) {
        // Same chord, still falling (or already settled) from before this call — pick up exactly
        // where it visually is, so the tap that triggered this call produces no visible jump.
        fromY = carriedOver.dots[0]?.y ?? toY;
      } else {
        // How far into the duration's own range this chord sits (0 at the fastest bound, 1 at the
        // slowest) — reused to scale the rise distance the same way, so a slow entrance isn't just
        // longer, it visibly travels further too.
        const durationFraction = (durationMs - TRANSITION_MIN_MS) / (TRANSITION_MAX_MS - TRANSITION_MIN_MS);
        const risePx = NEW_CHORD_MIN_RISE_PX + (NEW_CHORD_MAX_RISE_PX - NEW_CHORD_MIN_RISE_PX) * durationFraction;
        fromY = toY - risePx;
      }

      const dots = xs.map((x, i) => {
        const dot = new PIXI.Graphics();
        dot.circle(0, 0, radii[i]!).fill(colors[i]!);
        dot.alpha = UPCOMING_ALPHA;
        dot.x = x;
        this.container.addChild(dot);
        return dot;
      });

      const tracked: TrackedUpcomingChord = { xs, colors, dots, fromY, toY, durationMs, elapsedMs: 0 };
      this.applyTransitionFrame(tracked);
      return tracked;
    });

    // Only destroy the previous dots once every carried-over chord above has had a chance to read
    // its current `y` from them.
    for (const tracked of previous) {
      for (const dot of tracked.dots) {
        this.container.removeChild(dot);
        dot.destroy();
      }
    }
  }

  /** Advances hit-particle animation, plus any upcoming dots still mid-transition (see
   *  `TRANSITION_MIN_MS`) — every other upcoming dot is already settled and untouched here;
   *  waiting never moves a note past its own resting position. */
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
      if (tracked.elapsedMs >= tracked.durationMs) continue; // already settled
      tracked.elapsedMs = Math.min(tracked.elapsedMs + deltaMs, tracked.durationMs);
      this.applyTransitionFrame(tracked);
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

  /** Sets every dot in `tracked` to its current transition frame: eased from `fromY` (at
   *  `elapsedMs === 0`) to exactly `toY` (once `elapsedMs` reaches `durationMs`) — never past it,
   *  in either direction. */
  private applyTransitionFrame(tracked: TrackedUpcomingChord): void {
    const t = tracked.durationMs > 0 ? tracked.elapsedMs / tracked.durationMs : 1;
    const y = tracked.fromY + (tracked.toY - tracked.fromY) * easeOutQuad(t);
    for (const dot of tracked.dots) dot.y = y;
  }
}
