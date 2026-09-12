import * as PIXI from 'pixi.js';
import type { Renderer } from '../../../ports/Renderer';
import type { ColorTheme, MidiNote } from '../../../domain/types';
import { colorThemeToHex, particleStateAt } from './noteParticleLifecycle';

/** Lowest/highest MIDI notes on a standard 88-key piano — used to map a note to a horizontal position. */
const MIN_MIDI = 21;
const MAX_MIDI = 108;

/** How long (ms) a spawned note visual lives before it's removed; matches PARTICLE lifecycle tuning. */
const PARTICLE_LIFETIME_MS = 800;

/** Radius (px) of the circle drawn for each note visual, before `particleStateAt`'s scale is applied. */
const BASE_RADIUS_PX = 24;

/** Fraction of the viewport height a spawned particle sits at; near the bottom, like keys on a keyboard. */
const SPAWN_HEIGHT_FRACTION = 0.85;

/** One tracked particle: the PIXI display object plus how long it's been alive. */
interface TrackedParticle {
  readonly graphic: PIXI.Graphics;
  readonly midi: MidiNote;
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
 */
export class PixiRenderer implements Renderer {
  private readonly particles: TrackedParticle[] = [];

  constructor(
    private readonly container: NoteVisualContainer,
    private width: number,
    private height: number,
  ) {}

  spawnNoteVisual(midi: MidiNote, colorTheme: ColorTheme): void {
    const graphic = new PIXI.Graphics();
    graphic.circle(0, 0, BASE_RADIUS_PX).fill(colorThemeToHex(colorTheme));
    graphic.x = this.xForMidi(midi);
    graphic.y = this.height * SPAWN_HEIGHT_FRACTION;
    this.container.addChild(graphic);
    this.particles.push({ graphic, midi, elapsedMs: 0 });
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
}
