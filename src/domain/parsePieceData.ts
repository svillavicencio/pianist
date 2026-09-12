import type { Chord, NoteEvent } from './types';

/**
 * Parses touchpianist.com's flat pieceData format: a flat array grouped in
 * 4-value tuples `[originalTimeMs, screenDurationMs, midiNote, velocity]`.
 * Consecutive tuples sharing the same `originalTimeMs` sound together and
 * collapse into one `Chord`.
 */
export function parsePieceData(flat: readonly number[]): Chord[] {
  if (flat.length % 4 !== 0) {
    throw new Error(
      `parsePieceData: flat array length must be a multiple of 4, got ${flat.length}`,
    );
  }

  const groups: { originalTimeMs: number; screenDurationMs: number; notes: NoteEvent[] }[] = [];

  for (let i = 0; i < flat.length; i += 4) {
    const originalTimeMs = flat[i]!;
    const screenDurationMs = flat[i + 1]!;
    const note: NoteEvent = { midi: flat[i + 2]!, velocity: flat[i + 3]! };

    const last = groups[groups.length - 1];
    if (last !== undefined && last.originalTimeMs === originalTimeMs) {
      last.notes.push(note);
    } else {
      groups.push({ originalTimeMs, screenDurationMs, notes: [note] });
    }
  }

  return groups;
}
