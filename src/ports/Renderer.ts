import type { ColorTheme, MidiNote, Velocity } from '../domain/types';
import type { UpcomingChordPreview } from '../domain/upcomingNotesPreview';

/**
 * Draws the visual feedback for triggered notes. Implementations own the
 * actual rendering technology (canvas, WebGL, native Skia, etc) — the domain
 * only describes WHAT happened (a note fired), never HOW to draw it.
 */
export interface Renderer {
  /** Spawn whatever visual represents a newly triggered note (e.g. a glowing circle). `velocity`
   *  scales how big it renders — a harder-struck note should read as visually louder. */
  spawnNoteVisual(midi: MidiNote, velocity: Velocity, colorTheme: ColorTheme): void;
  /**
   * Replaces the "upcoming notes" preview lane with `chords`, touchpianist's falling-dots rhythm
   * cue. Chords stay grouped (not flattened) so an implementation can render "these notes are one
   * chord" (e.g. clustered together) distinctly from "these are separate consecutive taps" (e.g.
   * alternating colors). Each chord's `distanceMs` places it directly — a static step-ladder, not
   * a real-time animation: only the very next chord (`distanceMs === 0`) sits at the hit line,
   * every other one sits motionless at its own implied position until this is called again. Call
   * again after every cursor move (trigger, seek, restart) to re-snapshot from the new position.
   */
  showUpcoming(chords: readonly UpcomingChordPreview[], colorTheme: ColorTheme): void;
  /** Advance any running animations (currently just hit particles — the upcoming lane is static)
   *  by `deltaMs`. Called once per frame regardless of input. */
  tick(deltaMs: number): void;
  /** React to a viewport size change. */
  resize(width: number, height: number): void;
}
