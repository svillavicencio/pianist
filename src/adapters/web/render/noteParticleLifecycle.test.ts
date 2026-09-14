import { describe, expect, it } from 'vitest';
import { colorThemeToHex, darkenHex, particleStateAt } from './noteParticleLifecycle';

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

describe('colorThemeToHex', () => {
  it('maps a known theme to its documented hex color', () => {
    expect(colorThemeToHex('parliament')).toBe(0xffd700);
  });

  it('falls back to white for an unknown theme instead of throwing', () => {
    expect(colorThemeToHex('some-made-up-theme')).toBe(0xffffff);
  });
});

describe('darkenHex', () => {
  it('returns the same color unchanged at amount 0', () => {
    expect(darkenHex(0x1e90ff, 0)).toBe(0x1e90ff);
  });

  it('returns pure black at amount 1, regardless of the input color', () => {
    expect(darkenHex(0x1e90ff, 1)).toBe(0x000000);
    expect(darkenHex(0xffffff, 1)).toBe(0x000000);
  });

  it('mixes each channel proportionally toward black', () => {
    // 0x808080 (128,128,128) halfway to black (0,0,0) -> 64 per channel
    expect(darkenHex(0x808080, 0.5)).toBe(0x404040);
  });

  it('clamps an out-of-range amount instead of over/under-mixing', () => {
    expect(darkenHex(0x123456, 2)).toBe(0x000000);
    expect(darkenHex(0x123456, -1)).toBe(0x123456);
  });

  it('darkens even a fully desaturated (grayscale) color, unlike a hue shift', () => {
    expect(darkenHex(0xc0c0c0, 0.5)).toBe(0x606060);
  });
});
