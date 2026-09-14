import { describe, expect, it } from "vitest";
import { chopinFantaisieImpromptuPiece } from "./chopinFantaisieImpromptu";

describe("chopinFantaisieImpromptuPiece", () => {
  it("has the complete piece: 2561 chords extracted from the real MIDI performance", () => {
    expect(chopinFantaisieImpromptuPiece.chords).toHaveLength(2561);
    expect(chopinFantaisieImpromptuPiece.numScreens).toBe(2561);
  });

  it("opens with the left-hand dyad and the second event at the tempo-mapped entrance", () => {
    const first = chopinFantaisieImpromptuPiece.chords[0]!;
    const second = chopinFantaisieImpromptuPiece.chords[1]!;
    expect(first.originalTimeMs).toBe(0);
    expect(first.notes.map((note) => [note.midi, note.velocity])).toEqual([
      [44, 79],
      [56, 79],
    ]);
    expect(second.originalTimeMs).toBe(2730);
    expect(first.screenDurationMs).toBe(2730);
  });

  it("ends on the final event from the mapper summary", () => {
    const finalChord = chopinFantaisieImpromptuPiece.chords.at(-1)!;
    expect(finalChord.originalTimeMs).toBe(267314);
    expect(finalChord.screenDurationMs).toBe(0);
    expect(finalChord.notes.map((note) => [note.midi, note.velocity])).toEqual([
      [61, 42],
    ]);
  });

  it("preserves piecewise timing and varying MIDI velocities", () => {
    expect(chopinFantaisieImpromptuPiece.chords[2]!.originalTimeMs).toBe(2904);
    const velocities = new Set(
      chopinFantaisieImpromptuPiece.chords.flatMap((chord) =>
        chord.notes.map((note) => note.velocity),
      ),
    );
    expect(velocities.size).toBe(76);
  });

  it("preserves the five-note maximum simultaneity", () => {
    const maxSize = Math.max(
      ...chopinFantaisieImpromptuPiece.chords.map(
        (chord) => chord.notes.length,
      ),
    );
    expect(maxSize).toBe(5);
    expect(
      chopinFantaisieImpromptuPiece.chords.filter(
        (chord) => chord.notes.length === maxSize,
      ),
    ).toHaveLength(4);
  });

  it("never contains duplicate MIDI notes within a chord", () => {
    for (const chord of chopinFantaisieImpromptuPiece.chords) {
      const midis = chord.notes.map((note) => note.midi);
      expect(new Set(midis).size).toBe(midis.length);
    }
  });
});
