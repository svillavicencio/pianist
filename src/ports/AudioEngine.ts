import type { MidiNote, Velocity } from '../domain/types';

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
  /** Start sounding a note. Calling noteOn for an already-sounding note retriggers it. */
  noteOn(midi: MidiNote, velocity: Velocity): void;
  /** Stop sounding a note. Calling noteOff for a note that isn't sounding is a no-op. */
  noteOff(midi: MidiNote): void;
}
