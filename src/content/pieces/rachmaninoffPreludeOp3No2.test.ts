import { describe, expect, it } from 'vitest';
import { rachmaninoffPreludeOp3No2Piece } from './rachmaninoffPreludeOp3No2';

describe('rachmaninoffPreludeOp3No2Piece', () => {
  it('has the complete piece: 550 chords extracted from the real MIDI performance', () => {
    expect(rachmaninoffPreludeOp3No2Piece.chords).toHaveLength(550);
    expect(rachmaninoffPreludeOp3No2Piece.numScreens).toBe(550);
  });

  it('opens with the famous three-octave "bell" motif: A in three octaves', () => {
    const opening = rachmaninoffPreludeOp3No2Piece.chords[0]!;
    expect(opening.notes.map((n) => n.midi)).toEqual([33, 45, 57]);
    expect(opening.notes.map((n) => n.velocity)).toEqual([66, 78, 94]);
  });

  it('tolls the motif down to G# then C#, one chord per beat', () => {
    const second = rachmaninoffPreludeOp3No2Piece.chords[1]!;
    const third = rachmaninoffPreludeOp3No2Piece.chords[2]!;
    expect(second.notes.map((n) => n.midi)).toEqual([32, 44, 56]);
    expect(second.notes.map((n) => n.velocity)).toEqual([66, 78, 94]);
    expect(third.notes.map((n) => n.midi)).toEqual([25, 37, 49]);
    expect(third.notes.map((n) => n.velocity)).toEqual([70, 82, 98]);
  });

  it('ends on the final chord of the piece', () => {
    const finalChord = rachmaninoffPreludeOp3No2Piece.chords.at(-1)!;
    expect(finalChord.notes.map((n) => n.midi)).toEqual([52, 56, 61, 64, 68, 73, 76, 80]);
    expect(finalChord.notes.map((n) => n.velocity)).toEqual([12, 12, 12, 14, 14, 14, 14, 17]);
  });

  it('uses the real, tempo-map-aware MIDI timing for originalTimeMs', () => {
    expect(rachmaninoffPreludeOp3No2Piece.chords[0]!.originalTimeMs).toBe(1096);
    expect(rachmaninoffPreludeOp3No2Piece.chords[1]!.originalTimeMs).toBe(3096);
    expect(rachmaninoffPreludeOp3No2Piece.chords[2]!.originalTimeMs).toBe(5096);
    expect(rachmaninoffPreludeOp3No2Piece.chords.at(-1)!.originalTimeMs).toBe(236554);
  });

  it('sets screenDurationMs to the real gap until the next event, and 0 for the last event', () => {
    expect(rachmaninoffPreludeOp3No2Piece.chords[0]!.screenDurationMs).toBe(2000);
    expect(rachmaninoffPreludeOp3No2Piece.chords.at(-1)!.screenDurationMs).toBe(0);
  });

  it('preserves the real, varying MIDI velocities instead of a flat constant', () => {
    const velocities = new Set(
      rachmaninoffPreludeOp3No2Piece.chords.flatMap((chord) => chord.notes.map((n) => n.velocity)),
    );
    expect(velocities.size).toBeGreaterThan(10);
  });

  it('reaches the densest simultaneous chord of the piece (8 notes, no duplicate pitches to dedupe)', () => {
    const maxSize = Math.max(
      ...rachmaninoffPreludeOp3No2Piece.chords.map((chord) => chord.notes.length),
    );
    expect(maxSize).toBe(8);
  });

  it('never contains a duplicate MIDI note within the same chord', () => {
    for (const chord of rachmaninoffPreludeOp3No2Piece.chords) {
      const midis = chord.notes.map((n) => n.midi);
      expect(new Set(midis).size).toBe(midis.length);
    }
  });
});
