import { describe, expect, it } from "vitest";
import type { Chord, NoteEvent } from "../../domain/types";
import { chopinMinuteWaltzPiece } from "./chopinMinuteWaltz";

describe("chopinMinuteWaltzPiece", () => {
  it("contains the complete verified performance", () => {
    expect(chopinMinuteWaltzPiece.chords).toHaveLength(1217);
    expect(chopinMinuteWaltzPiece.numScreens).toBe(1217);
  });

  it("preserves the verified opening attack", () => {
    const first = chopinMinuteWaltzPiece.chords[0]!;
    expect(first.originalTimeMs).toBe(2087);
    expect(
      first.notes.map((note: NoteEvent) => [note.midi, note.velocity]),
    ).toEqual([[68, 32]]);
  });

  it("preserves the verified final event", () => {
    const finalChord = chopinMinuteWaltzPiece.chords.at(-1)!;
    expect(finalChord.originalTimeMs).toBe(105226);
    expect(finalChord.screenDurationMs).toBe(0);
    expect(
      finalChord.notes.map((note: NoteEvent) => [note.midi, note.velocity]),
    ).toEqual([[85, 52]]);
  });

  it("pins the verified source profile", () => {
    const notes = chopinMinuteWaltzPiece.chords.flatMap(
      (chord: Chord) => chord.notes,
    );
    expect(notes).toHaveLength(1465);
    expect(new Set(notes.map((note: NoteEvent) => note.velocity)).size).toBe(
      44,
    );
    expect(
      Math.max(
        ...chopinMinuteWaltzPiece.chords.map(
          (chord: Chord) => chord.notes.length,
        ),
      ),
    ).toBe(4);
  });

  it("never contains duplicate MIDI notes within a chord", () => {
    for (const chord of chopinMinuteWaltzPiece.chords) {
      const midis = chord.notes.map((note: NoteEvent) => note.midi);
      expect(new Set(midis).size).toBe(midis.length);
    }
  });
});
