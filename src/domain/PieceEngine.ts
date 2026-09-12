import type { NoteEvent, Piece } from './types';

/**
 * Drives a `Piece` by cursor rather than by real time: any key press just
 * asks for "the next authored chord", which is how touchpianist.com actually
 * plays back pieces (Play mode ignores the original recording's timing).
 */
export class PieceEngine {
  private cursor = 0;

  constructor(private readonly piece: Piece) {}

  /** Index of the next chord to be played; equals `chords.length` once finished. */
  get currentChordIndex(): number {
    return this.cursor;
  }

  /** Advances to the next chord and returns its notes; `[]` forever once finished. */
  trigger(): readonly NoteEvent[] {
    if (this.isFinished()) {
      return [];
    }
    const chord = this.piece.chords[this.cursor]!;
    this.cursor += 1;
    return chord.notes;
  }

  isFinished(): boolean {
    return this.cursor >= this.piece.chords.length;
  }

  reset(): void {
    this.cursor = 0;
  }

  /** Jumps the cursor to `chordIndex`, silently clamped to `[0, chords.length]`. */
  seekTo(chordIndex: number): void {
    this.cursor = Math.min(Math.max(chordIndex, 0), this.piece.chords.length);
  }
}
