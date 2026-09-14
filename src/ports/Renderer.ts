import type { ColorTheme, MidiNote } from '../domain/types';
import type { UpcomingChordPreview } from '../domain/upcomingNotesPreview';

/**
 * Draws the visual feedback for triggered notes. Implementations own the
 * actual rendering technology (canvas, WebGL, native Skia, etc) — the domain
 * only describes WHAT happened (a note fired), never HOW to draw it.
 */
export interface Renderer {
  /** Spawn whatever visual represents a newly triggered note (e.g. a glowing circle). */
  spawnNoteVisual(midi: MidiNote, colorTheme: ColorTheme): void;
  /**
   * Replaces the "upcoming notes" preview lane with `chords`, touchpianist's falling-dots rhythm
   * cue. Chords stay grouped (not flattened) so an implementation can render "these notes are one
   * chord" (e.g. same color, connected) distinctly from "these are separate consecutive taps"
   * (e.g. alternating colors). Each chord's `distanceMs` is a snapshot taken now — an implementation
   * is expected to animate it ticking down in real time (via `tick`) so the notes visibly fall at
   * the piece's authored pace, not just jump between static positions. Call again after every
   * cursor move (trigger, seek, restart) to re-snapshot from the new position.
   *
   * `continuedFromPreviousTap` says whether this snapshot follows a normal single-chord advance
   * (the player tapped) — pass `true` there so the fall keeps flowing uninterrupted from wherever
   * it visually was, rather than snapping whatever's now next straight to its resting position.
   * Pass `false` for a genuinely discontinuous cursor move (seek, restart, or the very first
   * snapshot of a piece), where jumping straight to the new position is exactly what should happen.
   */
  showUpcoming(chords: readonly UpcomingChordPreview[], colorTheme: ColorTheme, continuedFromPreviousTap: boolean): void;
  /** Advance any running animations (hit particles, and the upcoming-notes fall) by `deltaMs`. Called once per frame regardless of input. */
  tick(deltaMs: number): void;
  /** React to a viewport size change. */
  resize(width: number, height: number): void;
}
