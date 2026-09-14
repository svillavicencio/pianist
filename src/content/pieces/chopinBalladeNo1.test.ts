import { describe, expect, it } from "vitest";
import type { Chord, NoteEvent } from "../../domain/types";
import { chopinBalladeNo1Piece } from "./chopinBalladeNo1";

describe("chopinBalladeNo1Piece", () => {
  it("contains the complete verified performance", () => {
    expect(chopinBalladeNo1Piece.chords).toHaveLength(2571);
    expect(chopinBalladeNo1Piece.numScreens).toBe(2571);
  });

  it("preserves the verified opening attacks", () => {
    const first = chopinBalladeNo1Piece.chords[0]!;
    expect(first.originalTimeMs).toBe(2);
    expect(
      first.notes.map((note: NoteEvent) => [note.midi, note.velocity]),
    ).toEqual([
      [36, 74],
      [48, 90],
    ]);
  });

  it("preserves the verified final event", () => {
    const finalChord = chopinBalladeNo1Piece.chords.at(-1)!;
    expect(finalChord.originalTimeMs).toBe(536483);
    expect(finalChord.screenDurationMs).toBe(0);
    expect(
      finalChord.notes.map((note: NoteEvent) => [note.midi, note.velocity]),
    ).toEqual([
      [31, 80],
      [43, 95],
      [55, 117],
    ]);
  });

  it("pins the verified source profile", () => {
    const notes = chopinBalladeNo1Piece.chords.flatMap(
      (chord: Chord) => chord.notes,
    );
    expect(notes).toHaveLength(5028);
    expect(new Set(notes.map((note: NoteEvent) => note.velocity)).size).toBe(
      99,
    );
    expect(
      Math.max(
        ...chopinBalladeNo1Piece.chords.map(
          (chord: Chord) => chord.notes.length,
        ),
      ),
    ).toBe(7);
  });

  it("never contains duplicate MIDI notes within a chord", () => {
    for (const chord of chopinBalladeNo1Piece.chords) {
      const midis = chord.notes.map((note: NoteEvent) => note.midi);
      expect(new Set(midis).size).toBe(midis.length);
    }
  });
});
