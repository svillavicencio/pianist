/** MIDI note number (0-127), per the General MIDI note-number convention. */
export type MidiNote = number;

/** MIDI velocity (0-127), as authored in the piece's source data. */
export type Velocity = number;

/** One note to sound, as part of a chord triggered by a single user action. */
export interface NoteEvent {
  readonly midi: MidiNote;
  readonly velocity: Velocity;
}

/** A group of notes meant to sound together, as authored in the original piece's timeline. */
export interface Chord {
  /** Timestamp (ms) this chord occurs at in the original recording — used by Watch mode only. */
  readonly originalTimeMs: number;
  /** Duration (ms) of the "screen" (timing block) this chord belongs to — drives visual spacing. */
  readonly screenDurationMs: number;
  readonly notes: readonly NoteEvent[];
}

/** A color palette identifier used to tint a piece's note visuals (e.g. "parliament"). */
export type ColorTheme = string;

/** A full performable piece: an ordered sequence of chords plus display metadata. */
export interface Piece {
  readonly dataName: string;
  readonly displayName: string;
  readonly colorTheme: ColorTheme;
  readonly numScreens: number;
  readonly chords: readonly Chord[];
}

/** Saved cursor position within a piece, for pin/resume. */
export interface SavedPosition {
  readonly pieceDataName: string;
  readonly chordIndex: number;
}
