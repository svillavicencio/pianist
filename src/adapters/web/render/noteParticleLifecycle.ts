import type { ColorTheme } from '../../../domain/types';

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

/** Fallback tint (white) used for any `ColorTheme` string not in the known-themes map below. */
const DEFAULT_COLOR_HEX = 0xffffff;

/** Known piece color themes mapped to a `0xRRGGBB` tint for PIXI Graphics fill/tint. */
const THEME_COLORS: Readonly<Record<string, number>> = {
  parliament: 0xffd700,
  ocean: 0x1e90ff,
  sunset: 0xff6347,
  forest: 0x2ecc71,
  midnight: 0x9932cc,
  silver: 0xc0c0c0,
  crimson: 0xdc143c,
};

/** Maps a piece's `ColorTheme` to a PIXI-friendly hex color; unknown themes fall back to white, never throw. */
export function colorThemeToHex(theme: ColorTheme): number {
  return THEME_COLORS[theme] ?? DEFAULT_COLOR_HEX;
}

/**
 * Mixes `hex` toward black by `amount` (0 = unchanged, 1 = pure black) — used to derive a second,
 * visually-distinct shade of a piece's color for alternating consecutive chords in the upcoming-notes
 * preview, so "these notes are one chord" and "that's a different, separate chord" read apart at a
 * glance. A luminosity shift (rather than a hue shift) reads reliably even for a near-grayscale theme
 * like `silver`, where rotating hue would do nothing.
 */
export function darkenHex(hex: number, amount: number): number {
  const clampedAmount = Math.min(Math.max(amount, 0), 1);
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const darken = (channel: number): number => Math.round(channel * (1 - clampedAmount));
  return (darken(r) << 16) | (darken(g) << 8) | darken(b);
}
