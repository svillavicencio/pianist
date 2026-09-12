import { describe, expect, it } from 'vitest';
import { findNearestSample, gainFor, playbackRateFor } from './sampleSelection';

describe('findNearestSample', () => {
  it('picks the exact match when available', () => {
    expect(findNearestSample(60, [48, 60, 72])).toBe(60);
  });

  it('picks the closer neighbor when no exact match exists', () => {
    expect(findNearestSample(62, [48, 60, 72])).toBe(60);
    expect(findNearestSample(67, [48, 60, 72])).toBe(72);
  });

  it('breaks an exact tie toward the lower sample', () => {
    // 60 is equidistant (6 semitones) from both 54 and 66.
    expect(findNearestSample(60, [54, 66])).toBe(54);
  });

  it('clamps to the nearest end when the target is below the available range', () => {
    expect(findNearestSample(20, [48, 60, 72])).toBe(48);
  });

  it('clamps to the nearest end when the target is above the available range', () => {
    expect(findNearestSample(100, [48, 60, 72])).toBe(72);
  });

  it('works with unsorted input', () => {
    expect(findNearestSample(62, [72, 48, 60])).toBe(60);
  });

  it('returns the only sample when just one is available', () => {
    expect(findNearestSample(90, [60])).toBe(60);
  });

  it('throws when there are no available samples', () => {
    expect(() => findNearestSample(60, [])).toThrow();
  });
});

describe('playbackRateFor', () => {
  it('is 1 at unison (target === sample)', () => {
    expect(playbackRateFor(60, 60)).toBe(1);
  });

  it('is 2 one octave up (12 semitones above the sample)', () => {
    expect(playbackRateFor(72, 60)).toBe(2);
  });

  it('is 0.5 one octave down (12 semitones below the sample)', () => {
    expect(playbackRateFor(48, 60)).toBe(0.5);
  });

  it('applies the equal-temperament formula for an arbitrary interval', () => {
    expect(playbackRateFor(61, 60)).toBeCloseTo(2 ** (1 / 12), 10);
  });
});

describe('gainFor', () => {
  it('maps velocity 0 to gain 0', () => {
    expect(gainFor(0)).toBe(0);
  });

  it('maps velocity 127 to gain 1', () => {
    expect(gainFor(127)).toBe(1);
  });

  it('maps a mid-range velocity linearly', () => {
    expect(gainFor(64)).toBeCloseTo(64 / 127, 10);
  });

  it('clamps negative velocity to gain 0', () => {
    expect(gainFor(-10)).toBe(0);
  });

  it('clamps velocity above 127 to gain 1', () => {
    expect(gainFor(200)).toBe(1);
  });
});
