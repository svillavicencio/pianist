import { describe, expect, it } from 'vitest';
import { maryHadALittleLambPiece } from './maryHadALittleLamb';

describe('maryHadALittleLambPiece', () => {
  it('has exactly 26 single-note chords', () => {
    expect(maryHadALittleLambPiece.chords).toHaveLength(26);
    expect(maryHadALittleLambPiece.numScreens).toBe(26);
  });

  it('matches the given note sequence at the start', () => {
    const firstFour = maryHadALittleLambPiece.chords.slice(0, 4).map((chord) => chord.notes[0]!.midi);
    expect(firstFour).toEqual([64, 62, 60, 62]);
  });

  it('matches the given note sequence at the end', () => {
    const lastThree = maryHadALittleLambPiece.chords.slice(-3).map((chord) => chord.notes[0]!.midi);
    expect(lastThree).toEqual([64, 62, 60]);
  });

  it('increments originalTimeMs by 400ms per note, starting at 0', () => {
    maryHadALittleLambPiece.chords.forEach((chord, index) => {
      expect(chord.originalTimeMs).toBe(400 * index);
      expect(chord.screenDurationMs).toBe(400);
      expect(chord.notes).toHaveLength(1);
      expect(chord.notes[0]!.velocity).toBe(90);
    });
  });
});
