import type { ColorTheme, MidiNote } from '../domain/types';

/**
 * Draws the visual feedback for triggered notes. Implementations own the
 * actual rendering technology (canvas, WebGL, native Skia, etc) — the domain
 * only describes WHAT happened (a note fired), never HOW to draw it.
 */
export interface Renderer {
  /** Spawn whatever visual represents a newly triggered note (e.g. a glowing circle). */
  spawnNoteVisual(midi: MidiNote, colorTheme: ColorTheme): void;
  /** Advance any running animations by `deltaMs`. Called once per frame regardless of input. */
  tick(deltaMs: number): void;
  /** React to a viewport size change. */
  resize(width: number, height: number): void;
}
