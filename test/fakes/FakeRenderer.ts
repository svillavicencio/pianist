import type { Renderer } from '../../src/ports/Renderer';
import type { ColorTheme, MidiNote } from '../../src/domain/types';

export interface RecordedNoteVisual {
  readonly midi: MidiNote;
  readonly colorTheme: ColorTheme;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

/** A `Renderer` double that draws nothing but records what it was told to do. */
export class FakeRenderer implements Renderer {
  readonly spawnedVisuals: RecordedNoteVisual[] = [];
  totalTickedMs = 0;
  lastResize: Size | undefined;

  spawnNoteVisual(midi: MidiNote, colorTheme: ColorTheme): void {
    this.spawnedVisuals.push({ midi, colorTheme });
  }

  tick(deltaMs: number): void {
    this.totalTickedMs += deltaMs;
  }

  resize(width: number, height: number): void {
    this.lastResize = { width, height };
  }
}
