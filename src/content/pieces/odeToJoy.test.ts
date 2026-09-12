import { describe, expect, it } from 'vitest';
import { odeToJoyPiece } from './odeToJoy';

describe('odeToJoyPiece', () => {
  it('has exactly 30 single-note chords', () => {
    expect(odeToJoyPiece.chords).toHaveLength(30);
    expect(odeToJoyPiece.numScreens).toBe(30);
  });

  it('matches the given note sequence at the start', () => {
    const firstFour = odeToJoyPiece.chords.slice(0, 4).map((chord) => chord.notes[0]!.midi);
    expect(firstFour).toEqual([64, 64, 65, 67]);
  });

  it('matches the given note sequence at the end', () => {
    const lastFour = odeToJoyPiece.chords.slice(-4).map((chord) => chord.notes[0]!.midi);
    expect(lastFour).toEqual([64, 62, 60, 60]);
  });

  it('increments originalTimeMs by 400ms per note, starting at 0', () => {
    odeToJoyPiece.chords.forEach((chord, index) => {
      expect(chord.originalTimeMs).toBe(400 * index);
      expect(chord.screenDurationMs).toBe(400);
      expect(chord.notes).toHaveLength(1);
      expect(chord.notes[0]!.velocity).toBe(90);
    });
  });
});
