import { describe, expect, it } from "vitest";
import type { Chord, NoteEvent } from "../../domain/types";
import { chopinNocturneOp9No2Piece } from "./chopinNocturneOp9No2";

describe("chopinNocturneOp9No2Piece", () => {
  it("contains the complete verified performance", () => {
    expect(chopinNocturneOp9No2Piece.chords).toHaveLength(627);
    expect(chopinNocturneOp9No2Piece.numScreens).toBe(627);
  });

  it("preserves the verified opening attack", () => {
    const first = chopinNocturneOp9No2Piece.chords[0]!;
    expect(first.originalTimeMs).toBe(2750);
    expect(
      first.notes.map((note: NoteEvent) => [note.midi, note.velocity]),
    ).toEqual([[70, 42]]);
  });

  it("preserves the verified final event", () => {
    const finalChord = chopinNocturneOp9No2Piece.chords.at(-1)!;
    expect(finalChord.originalTimeMs).toBe(233810);
    expect(finalChord.screenDurationMs).toBe(0);
    expect(
      finalChord.notes.map((note: NoteEvent) => [note.midi, note.velocity]),
    ).toEqual([
      [39, 16],
      [46, 18],
      [55, 20],
      [63, 26],
    ]);
  });

  it("pins the verified source profile", () => {
    const notes = chopinNocturneOp9No2Piece.chords.flatMap(
      (chord: Chord) => chord.notes,
    );
    expect(notes).toHaveLength(1298);
    expect(new Set(notes.map((note: NoteEvent) => note.velocity)).size).toBe(
      69,
    );
    expect(
      Math.max(
        ...chopinNocturneOp9No2Piece.chords.map(
          (chord: Chord) => chord.notes.length,
        ),
      ),
    ).toBe(6);
  });

  it("never contains duplicate MIDI notes within a chord", () => {
    for (const chord of chopinNocturneOp9No2Piece.chords) {
      const midis = chord.notes.map((note: NoteEvent) => note.midi);
      expect(new Set(midis).size).toBe(midis.length);
    }
  });
});
