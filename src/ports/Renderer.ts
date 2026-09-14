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
   * alternating colors).
   *
   * Positioning is continuous and real-time (matching reference implementations like Piano-Flow):
   * each chord's vertical position is a live function of real elapsed time since it was first
   * shown, ticking down toward the hit line every frame via `tick()` — never a static step-ladder,
   * never re-snapped on a later call.
   *
   * `advancedByTap` distinguishes the two reasons this gets called again:
   * - `true`: the cursor advanced because the player successfully tapped the due chord. Any chord
   *   in `chords` that was already being shown (i.e. was chord index `i + 1` in the previous call)
   *   keeps counting down from its original due moment, uninterrupted — this is what makes the
   *   fall read as one continuous motion across taps instead of jumping.
   * - `false`: a genuine reset (restart, seek, or the very first call) — nothing carries over;
   *   every chord gets a freshly computed due moment starting now.
   */
  showUpcoming(chords: readonly UpcomingChordPreview[], colorTheme: ColorTheme, advancedByTap: boolean): void;
  /** Advance any running animations (hit particles, and the continuous fall of the upcoming lane)
   *  by `deltaMs`. Called once per frame regardless of input. */
  tick(deltaMs: number): void;
  /** React to a viewport size change. */
  resize(width: number, height: number): void;
}
