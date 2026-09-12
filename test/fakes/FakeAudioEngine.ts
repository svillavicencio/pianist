import type { AudioEngine } from '../../src/ports/AudioEngine';
import type { MidiNote, Velocity } from '../../src/domain/types';

export interface RecordedNoteOn {
  readonly midi: MidiNote;
  readonly velocity: Velocity;
}

/** An `AudioEngine` double that plays nothing but records what it was told to do. */
export class FakeAudioEngine implements AudioEngine {
  readonly notesOn: RecordedNoteOn[] = [];
  readonly notesOff: MidiNote[] = [];
  initCalled = false;

  async init(): Promise<void> {
    this.initCalled = true;
  }

  noteOn(midi: MidiNote, velocity: Velocity): void {
    this.notesOn.push({ midi, velocity });
  }

  noteOff(midi: MidiNote): void {
    this.notesOff.push(midi);
  }
}
