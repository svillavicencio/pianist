import { describe, expect, it } from 'vitest';
import { rachmaninoffPreludeOp3No2Piece } from './rachmaninoffPreludeOp3No2';

describe('rachmaninoffPreludeOp3No2Piece', () => {
  it('has the complete piece: 544 chords extracted from the real MIDI transcription', () => {
    expect(rachmaninoffPreludeOp3No2Piece.chords).toHaveLength(544);
    expect(rachmaninoffPreludeOp3No2Piece.numScreens).toBe(544);
  });

  it('opens with the famous three-octave "bell" motif: A in three octaves', () => {
    const opening = rachmaninoffPreludeOp3No2Piece.chords[0]!;
    expect(opening.notes.map((n) => n.midi)).toEqual([33, 45, 57]);
  });

  it('tolls the motif down to G# then C#, one chord per beat', () => {
    const second = rachmaninoffPreludeOp3No2Piece.chords[1]!;
    const third = rachmaninoffPreludeOp3No2Piece.chords[2]!;
    expect(second.notes.map((n) => n.midi)).toEqual([32, 44, 56]);
    expect(third.notes.map((n) => n.midi)).toEqual([25, 37, 49]);
  });

  it('ends on the final fortissimo low chord of the piece', () => {
    const finalChord = rachmaninoffPreludeOp3No2Piece.chords.at(-1)!;
    expect(finalChord.notes.map((n) => n.midi)).toEqual([52, 56, 61, 64, 68, 73, 76, 80]);
  });

  it('uses the real, tempo-map-aware MIDI timing for originalTimeMs, starting at 0', () => {
    expect(rachmaninoffPreludeOp3No2Piece.chords[0]!.originalTimeMs).toBe(0);
    expect(rachmaninoffPreludeOp3No2Piece.chords[1]!.originalTimeMs).toBe(1000);
    expect(rachmaninoffPreludeOp3No2Piece.chords[2]!.originalTimeMs).toBe(2000);
    expect(rachmaninoffPreludeOp3No2Piece.chords.at(-1)!.originalTimeMs).toBe(159927);
  });

  it('sets screenDurationMs to the real gap until the next event, and 0 for the last event', () => {
    expect(rachmaninoffPreludeOp3No2Piece.chords[0]!.screenDurationMs).toBe(1000);
    expect(rachmaninoffPreludeOp3No2Piece.chords.at(-1)!.screenDurationMs).toBe(0);
  });

  it('preserves the real, varying MIDI velocities instead of a flat constant', () => {
    const velocities = new Set(
      rachmaninoffPreludeOp3No2Piece.chords.flatMap((chord) => chord.notes.map((n) => n.velocity)),
    );
    expect(velocities.size).toBeGreaterThan(10);
  });

  it('reaches the dense climax chord in the Agitato quasi-four-staves section (11 simultaneous notes after deduping a doubled pitch)', () => {
    const climaxChord = rachmaninoffPreludeOp3No2Piece.chords.find((chord) => chord.notes.length === 11);
    expect(climaxChord).toBeDefined();
  });

  it('never contains a duplicate MIDI note within the same chord', () => {
    for (const chord of rachmaninoffPreludeOp3No2Piece.chords) {
      const midis = chord.notes.map((n) => n.midi);
      expect(new Set(midis).size).toBe(midis.length);
    }
  });
});
