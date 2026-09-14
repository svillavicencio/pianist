import type { MidiNote, Velocity } from '../domain/types';

/** A single sounding voice started by `noteOn` — release it to stop that exact voice, and only that one. */
export interface NoteHandle {
  release(): void;
}

/**
 * Plays and stops sampled piano notes. Implementations own how a MIDI note
 * number becomes an actual sound (recorded sample + pitch-shift, synthesis,
 * native audio, etc). The domain only ever calls this by MIDI note + velocity —
 * it never knows whether the sound comes from Web Audio, native audio, or
 * anything else.
 */
export interface AudioEngine {
  /** Load/prepare whatever samples the engine needs before notes can play. */
  init(): Promise<void>;
  /**
   * Start sounding a note. Calling noteOn for an already-sounding note
   * retriggers it. Returns a handle to release this exact voice — release it
   * to stop the note early; leave it alone to let the sample decay naturally.
   */
  noteOn(midi: MidiNote, velocity: Velocity): NoteHandle;
}
