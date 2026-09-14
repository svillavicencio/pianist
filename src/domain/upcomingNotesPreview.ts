import type { Chord, MidiNote } from './types';

/** One upcoming chord to preview: every note in it sounds on the same tap. */
export interface UpcomingChordPreview {
  /** Milliseconds from "next up" (0) until this chord is due, per the piece's authored rhythm. */
  readonly distanceMs: number;
  /** Every note that fires together on this chord's tap — 2+ means "press these together". */
  readonly midis: readonly MidiNote[];
}

/** Hard ceiling on notes returned, so a dense trill passage can never flood the preview lane. */
const DEFAULT_MAX_NOTES = 40;

/**
 * Groups the next few chords into a preview list for a "falling notes" visual —
 * touchpianist's rhythm cue, built from each chord's authored `screenDurationMs`
 * (not real time; this game's input is cursor-driven, not clock-driven).
 *
 * Chords stay grouped (rather than flattened to individual notes) so a renderer
 * can tell "these 3 notes are one chord, press together" apart from "these 3
 * notes are 3 separate fast taps" — both would otherwise look identical as a
 * flat list of same-ish distances.
 *
 * Returns raw `distanceMs` rather than a normalized 0..1 ratio deliberately:
 * this stays a pure snapshot of "how far out is each chord" at the moment it's
 * called, and it's the renderer's job (not the domain's) to animate that
 * distance ticking down toward 0 in real time as a smooth falling motion.
 *
 * `chords` should already start at the next chord to play (e.g. `piece.chords.slice(cursor)`).
 * Chords are included while their cumulative distance from the start stays within
 * `windowMs`, and the total note count (summed across chords) stays within `maxNotes` —
 * the chord that would cross that cap is included with only its leading notes trimmed.
 */
export function upcomingChordsPreview(
  chords: readonly Chord[],
  windowMs: number,
  maxNotes: number = DEFAULT_MAX_NOTES,
): readonly UpcomingChordPreview[] {
  const result: UpcomingChordPreview[] = [];
  let cumulativeMs = 0;
  let notesSoFar = 0;

  for (const chord of chords) {
    if (cumulativeMs > windowMs) break;
    if (notesSoFar >= maxNotes) break;

    const midis = chord.notes.slice(0, maxNotes - notesSoFar).map((note) => note.midi);
    result.push({ distanceMs: cumulativeMs, midis });
    notesSoFar += midis.length;

    cumulativeMs += chord.screenDurationMs;
  }

  return result;
}
