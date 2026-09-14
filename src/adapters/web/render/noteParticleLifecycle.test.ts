import { describe, expect, it } from 'vitest';
import { contentPieces } from '../../../content/catalog';
import { colorForNote, easeInOutQuad, MAX_MIDI, MIN_MIDI, particleStateAt, radiusForVelocity, shiftLightness } from './noteParticleLifecycle';

describe('particleStateAt', () => {
  it('starts small, fully opaque, and alive at t=0', () => {
    const state = particleStateAt(0, 1000);
    expect(state.scale).toBeCloseTo(0.3);
    expect(state.alpha).toBe(1);
    expect(state.isDead).toBe(false);
  });

  it('grows and fades halfway through the lifetime', () => {
    const state = particleStateAt(500, 1000);
    expect(state.scale).toBeCloseTo(0.9);
    expect(state.alpha).toBeCloseTo(0.5);
    expect(state.isDead).toBe(false);
  });

  it('is dead at exactly the lifetime, fully grown and transparent', () => {
    const state = particleStateAt(1000, 1000);
    expect(state.scale).toBeCloseTo(1.5);
    expect(state.alpha).toBe(0);
    expect(state.isDead).toBe(true);
  });

  it('clamps scale/alpha and stays dead well past the lifetime', () => {
    const state = particleStateAt(50_000, 1000);
    expect(state.scale).toBeCloseTo(1.5);
    expect(state.alpha).toBe(0);
    expect(state.isDead).toBe(true);
  });

  it('clamps to the starting state for a negative elapsed time', () => {
    const state = particleStateAt(-100, 1000);
    expect(state.scale).toBeCloseTo(0.3);
    expect(state.alpha).toBe(1);
    expect(state.isDead).toBe(false);
  });

  it('never divides by zero or goes negative for a non-positive lifetime', () => {
    const state = particleStateAt(0, 0);
    expect(state.scale).toBeCloseTo(1.5);
    expect(state.alpha).toBe(0);
    expect(state.isDead).toBe(true);
  });
});

describe('colorForNote', () => {
  it('produces different colors for different pitches within the same theme', () => {
    const low = colorForNote('parliament', 30);
    const mid = colorForNote('parliament', 64);
    const high = colorForNote('parliament', 100);
    expect(low).not.toBe(mid);
    expect(mid).not.toBe(high);
    expect(low).not.toBe(high);
  });

  it('is deterministic: the same theme and pitch always produce the same color', () => {
    expect(colorForNote('ocean', 60)).toBe(colorForNote('ocean', 60));
  });

  it('falls back to a neutral color for an unknown theme instead of throwing', () => {
    expect(() => colorForNote('some-made-up-theme', 60)).not.toThrow();
  });

  it('clamps a below-range MIDI value to the same color as the lowest key', () => {
    expect(colorForNote('ocean', 0)).toBe(colorForNote('ocean', MIN_MIDI));
  });

  it('clamps an above-range MIDI value to the same color as the highest key', () => {
    expect(colorForNote('ocean', 200)).toBe(colorForNote('ocean', MAX_MIDI));
  });

  it('every color theme actually used by real piece content has a defined gradient, not the flat white fallback', () => {
    // Regression guard: "amethyst" (used by 4 real pieces, e.g. Chopin's Fantaisie-Impromptu) was
    // missing from THEME_GRADIENTS after the original THEME_COLORS map was ported over, silently
    // falling back to plain white with zero pitch variation — caught only by manual browser
    // verification, not by any test. This asserts every theme actually in use produces visible
    // hue variation across the pitch range, so a future missing theme fails loudly instead.
    const themesInUse = new Set([...contentPieces.values()].map((piece) => piece.colorTheme));
    for (const theme of themesInUse) {
      const low = colorForNote(theme, MIN_MIDI);
      const high = colorForNote(theme, MAX_MIDI);
      expect(low, `theme "${theme}" produced no color variation across the pitch range`).not.toBe(high);
    }
  });
});

describe('shiftLightness', () => {
  it('returns the same color unchanged at amount 0', () => {
    expect(shiftLightness(0x1e90ff, 0)).toBe(0x1e90ff);
  });

  it('returns pure white at amount 1, regardless of the input color', () => {
    expect(shiftLightness(0x1e90ff, 1)).toBe(0xffffff);
  });

  it('returns pure black at amount -1, regardless of the input color', () => {
    expect(shiftLightness(0x1e90ff, -1)).toBe(0x000000);
  });

  it('mixes each channel proportionally toward white for a positive amount', () => {
    // 0x808080 (128,128,128) halfway to white -> 128 + (255-128)*0.5 = 191.5 -> 192
    expect(shiftLightness(0x808080, 0.5)).toBe(0xc0c0c0);
  });

  it('mixes each channel proportionally toward black for a negative amount', () => {
    // 0x808080 halfway to black -> 128 * 0.5 = 64
    expect(shiftLightness(0x808080, -0.5)).toBe(0x404040);
  });

  it('clamps an out-of-range amount instead of over/under-mixing', () => {
    expect(shiftLightness(0x123456, 2)).toBe(0xffffff);
    expect(shiftLightness(0x123456, -2)).toBe(0x000000);
  });
});

describe('radiusForVelocity', () => {
  it('scales toward the minimum at velocity 0', () => {
    expect(radiusForVelocity(20, 0)).toBeCloseTo(20 * 0.55);
  });

  it('scales toward the maximum at the highest MIDI velocity (127)', () => {
    expect(radiusForVelocity(20, 127)).toBeCloseTo(20 * 1.6);
  });

  it('sits at the midpoint scale at the midpoint velocity', () => {
    expect(radiusForVelocity(20, 63.5)).toBeCloseTo(20 * ((0.55 + 1.6) / 2), 1);
  });

  it('clamps an out-of-range velocity instead of extrapolating', () => {
    expect(radiusForVelocity(20, 200)).toBeCloseTo(20 * 1.6);
    expect(radiusForVelocity(20, -10)).toBeCloseTo(20 * 0.55);
  });

  it('scales the loudest note noticeably larger than the softest (roughly 3x, not a subtle nudge)', () => {
    const softest = radiusForVelocity(20, 0);
    const loudest = radiusForVelocity(20, 127);
    expect(loudest / softest).toBeGreaterThan(2.5);
  });
});

describe('easeInOutQuad', () => {
  it('starts at 0', () => {
    expect(easeInOutQuad(0)).toBe(0);
  });

  it('ends at 1', () => {
    expect(easeInOutQuad(1)).toBe(1);
  });

  it('sits exactly at the midpoint at t=0.5 (continuous hand-off between its two halves)', () => {
    expect(easeInOutQuad(0.5)).toBeCloseTo(0.5);
  });

  it('starts slowly and speeds up through the first half — no abrupt jump to full velocity', () => {
    const firstQuarterDelta = easeInOutQuad(0.25) - easeInOutQuad(0);
    const secondQuarterDelta = easeInOutQuad(0.5) - easeInOutQuad(0.25);
    expect(firstQuarterDelta).toBeLessThan(secondQuarterDelta);
  });

  it('slows back down through the second half, mirroring the first (a soft landing too)', () => {
    const thirdQuarterDelta = easeInOutQuad(0.75) - easeInOutQuad(0.5);
    const fourthQuarterDelta = easeInOutQuad(1) - easeInOutQuad(0.75);
    expect(fourthQuarterDelta).toBeLessThan(thirdQuarterDelta);
    expect(fourthQuarterDelta).toBeCloseTo(easeInOutQuad(0.25) - easeInOutQuad(0));
  });

  it('clamps out-of-range input instead of extrapolating', () => {
    expect(easeInOutQuad(-1)).toBe(0);
    expect(easeInOutQuad(2)).toBe(1);
  });
});
