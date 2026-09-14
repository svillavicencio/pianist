import { describe, expect, it } from 'vitest';
import { upcomingChordsPreview } from './upcomingNotesPreview';
import type { Chord } from './types';

function chord(originalTimeMs: number, screenDurationMs: number, midis: readonly number[]): Chord {
  return {
    originalTimeMs,
    screenDurationMs,
    notes: midis.map((midi) => ({ midi, velocity: 60 })),
  };
}

describe('upcomingChordsPreview', () => {
  it('returns an empty list for an empty chord slice', () => {
    expect(upcomingChordsPreview([], 3000)).toEqual([]);
  });

  it('puts the very next chord at distanceMs 0', () => {
    const chords = [chord(0, 500, [60])];

    const result = upcomingChordsPreview(chords, 3000);

    expect(result).toEqual([{ distanceMs: 0, notes: [{ midi: 60, velocity: 60 }] }]);
  });

  it('keeps every note of a chord grouped together, not flattened', () => {
    const chords = [chord(0, 500, [60, 64, 67])];

    const result = upcomingChordsPreview(chords, 3000);

    expect(result).toEqual([
      {
        distanceMs: 0,
        notes: [
          { midi: 60, velocity: 60 },
          { midi: 64, velocity: 60 },
          { midi: 67, velocity: 60 },
        ],
      },
    ]);
  });

  it('accumulates raw screenDurationMs across chords, unnormalized', () => {
    const chords = [chord(0, 1000, [60]), chord(1000, 1000, [62]), chord(2000, 0, [64])];

    const result = upcomingChordsPreview(chords, 2000);

    expect(result).toEqual([
      { distanceMs: 0, notes: [{ midi: 60, velocity: 60 }] },
      { distanceMs: 1000, notes: [{ midi: 62, velocity: 60 }] },
      { distanceMs: 2000, notes: [{ midi: 64, velocity: 60 }] },
    ]);
  });

  it('stops including chords once cumulative duration exceeds the window', () => {
    const chords = [chord(0, 1000, [60]), chord(1000, 1000, [62]), chord(2000, 1000, [64])];

    const result = upcomingChordsPreview(chords, 1500);

    expect(result).toEqual([
      { distanceMs: 0, notes: [{ midi: 60, velocity: 60 }] },
      { distanceMs: 1000, notes: [{ midi: 62, velocity: 60 }] },
    ]);
  });

  it('trims the leading notes of the chord that would cross the note cap, then stops', () => {
    const chords = [chord(0, 100, [60, 61, 62, 63]), chord(100, 100, [64, 65])];

    const result = upcomingChordsPreview(chords, 5000, 3);

    expect(result).toEqual([
      {
        distanceMs: 0,
        notes: [
          { midi: 60, velocity: 60 },
          { midi: 61, velocity: 60 },
          { midi: 62, velocity: 60 },
        ],
      },
    ]);
  });

  it('includes a chord that lands exactly on the window edge', () => {
    const chords = [chord(0, 1000, [60]), chord(1000, 900, [62])];

    const result = upcomingChordsPreview(chords, 1000);

    expect(result).toEqual([
      { distanceMs: 0, notes: [{ midi: 60, velocity: 60 }] },
      { distanceMs: 1000, notes: [{ midi: 62, velocity: 60 }] },
    ]);
  });

  it('carries velocity and holdDurationMs through per note', () => {
    const chords: readonly Chord[] = [
      { originalTimeMs: 0, screenDurationMs: 100, notes: [{ midi: 60, velocity: 80, holdDurationMs: 400 }] },
    ];

    const result = upcomingChordsPreview(chords, 1000);

    expect(result[0]?.notes).toEqual([{ midi: 60, velocity: 80, holdDurationMs: 400 }]);
  });

  it('carries an undefined holdDurationMs through unchanged (not yet regenerated content)', () => {
    const chords: readonly Chord[] = [
      { originalTimeMs: 0, screenDurationMs: 100, notes: [{ midi: 60, velocity: 80 }] },
    ];

    const result = upcomingChordsPreview(chords, 1000);

    expect(result[0]?.notes[0]?.holdDurationMs).toBeUndefined();
  });
});
