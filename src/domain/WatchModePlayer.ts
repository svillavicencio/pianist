import type { Clock } from '../ports/Clock';
import type { NoteEvent, Piece } from './types';

/**
 * Plays back a `Piece` on its original timeline (Watch mode), via the
 * injected `Clock` port so playback is deterministic in tests and never
 * touches `setTimeout` directly.
 */
export class WatchModePlayer {
  private handles: number[] = [];

  constructor(
    private readonly piece: Piece,
    private readonly clock: Clock,
    private readonly onChord: (notes: readonly NoteEvent[]) => void,
  ) {}

  /** Fires the first chord synchronously, then schedules the rest relative to that moment. */
  start(): void {
    const chords = this.piece.chords;
    if (chords.length === 0) {
      return;
    }
    const startTimeMs = chords[0]!.originalTimeMs;
    this.onChord(chords[0]!.notes);

    for (const chord of chords.slice(1)) {
      const delayMs = chord.originalTimeMs - startTimeMs;
      const handle = this.clock.schedule(() => this.onChord(chord.notes), delayMs);
      this.handles.push(handle);
    }
  }

  /** Cancels any chords not yet fired; safe to call at any time. */
  stop(): void {
    for (const handle of this.handles) {
      this.clock.cancel(handle);
    }
    this.handles = [];
  }
}
