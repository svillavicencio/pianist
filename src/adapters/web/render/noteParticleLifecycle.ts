import type { ColorTheme, MidiNote } from '../../../domain/types';

/** Scale a freshly spawned particle starts at (small, so the "pop" reads as growth). */
const START_SCALE = 0.3;
/** Scale a particle reaches right before it dies (grown, so it reads as an expanding ripple). */
const END_SCALE = 1.5;

/** Pure snapshot of one note-visual's animation at a given point in its life. */
export interface ParticleState {
  readonly scale: number;
  readonly alpha: number;
  readonly isDead: boolean;
}

/**
 * Pure function of elapsed time: no PixiJS, no side effects, fully unit-testable.
 * Scale eases linearly from `START_SCALE` to `END_SCALE` and alpha fades linearly
 * from 1 to 0 over `totalLifetimeMs`; progress is clamped to [0, 1] so calling this
 * arbitrarily far past the lifetime (or with a negative `elapsedMs`) never produces
 * an out-of-range scale/alpha. `isDead` flips true once `elapsedMs >= totalLifetimeMs`.
 */
export function particleStateAt(elapsedMs: number, totalLifetimeMs: number): ParticleState {
  const isDead = elapsedMs >= totalLifetimeMs;
  const progress = totalLifetimeMs <= 0 ? 1 : clamp(elapsedMs / totalLifetimeMs, 0, 1);
  return {
    scale: START_SCALE + (END_SCALE - START_SCALE) * progress,
    alpha: 1 - progress,
    isDead,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

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
