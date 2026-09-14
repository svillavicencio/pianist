import { describe, expect, it } from "vitest";
import { chopinHeroicPolonaisePiece } from "./chopinHeroicPolonaise";

describe("chopinHeroicPolonaisePiece", () => {
  it("contains the complete verified performance", () => {
    expect(chopinHeroicPolonaisePiece.chords).toHaveLength(2214);
    expect(chopinHeroicPolonaisePiece.numScreens).toBe(2214);
  });

  it("opens with the source's eight-note attack", () => {
    const first = chopinHeroicPolonaisePiece.chords[0]!;
    expect(first.originalTimeMs).toBe(0);
    expect(first.notes.map((note) => [note.midi, note.velocity])).toEqual([
      [27, 63],
      [39, 75],
      [51, 74],
      [63, 88],
    ]);
  });

  it("ends with the final source event", () => {
    const finalChord = chopinHeroicPolonaisePiece.chords.at(-1)!;
    expect(finalChord.originalTimeMs).toBe(351703);
    expect(finalChord.screenDurationMs).toBe(0);
    expect(finalChord.notes.map((note) => [note.midi, note.velocity])).toEqual([
      [32, 67],
      [44, 79],
      [56, 86],
      [60, 86],
      [68, 102],
    ]);
  });

  it("preserves the audited velocity and simultaneity profiles", () => {
    const velocities = new Set(
      chopinHeroicPolonaisePiece.chords.flatMap((chord) =>
        chord.notes.map((note) => note.velocity),
      ),
    );
    expect(velocities.size).toBe(83);
    expect(
      Math.max(
        ...chopinHeroicPolonaisePiece.chords.map((chord) => chord.notes.length),
      ),
    ).toBe(8);
  });

  it("never contains duplicate MIDI notes within a chord", () => {
    for (const chord of chopinHeroicPolonaisePiece.chords) {
      const midis = chord.notes.map((note) => note.midi);
      expect(new Set(midis).size).toBe(midis.length);
    }
  });
});
