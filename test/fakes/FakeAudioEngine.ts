import type { AudioEngine, NoteHandle } from '../../src/ports/AudioEngine';
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

  noteOn(midi: MidiNote, velocity: Velocity): NoteHandle {
    this.notesOn.push({ midi, velocity });
    return {
      release: () => {
        this.notesOff.push(midi);
      },
    };
  }
}
