import { describe, expect, it } from 'vitest';
import { twinkleTwinklePiece } from './twinkleTwinkle';

describe('twinkleTwinklePiece', () => {
  it('has exactly 42 single-note chords', () => {
    expect(twinkleTwinklePiece.chords).toHaveLength(42);
    expect(twinkleTwinklePiece.numScreens).toBe(42);
  });

  it('matches the given note sequence at the start', () => {
    const firstThree = twinkleTwinklePiece.chords.slice(0, 3).map((chord) => chord.notes[0]!.midi);
    expect(firstThree).toEqual([60, 60, 67]);
  });

  it('matches the given note sequence at the end', () => {
    const lastThree = twinkleTwinklePiece.chords.slice(-3).map((chord) => chord.notes[0]!.midi);
    expect(lastThree).toEqual([62, 62, 60]);
  });

  it('increments originalTimeMs by 400ms per note, starting at 0', () => {
    twinkleTwinklePiece.chords.forEach((chord, index) => {
      expect(chord.originalTimeMs).toBe(400 * index);
      expect(chord.screenDurationMs).toBe(400);
      expect(chord.notes).toHaveLength(1);
      expect(chord.notes[0]!.velocity).toBe(90);
    });
  });
});
