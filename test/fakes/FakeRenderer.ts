import type { Renderer } from '../../src/ports/Renderer';
import type { ColorTheme, MidiNote, Velocity } from '../../src/domain/types';
import type { UpcomingChordPreview } from '../../src/domain/upcomingNotesPreview';

export interface RecordedNoteVisual {
  readonly midi: MidiNote;
  readonly velocity: Velocity;
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
  lastUpcoming: readonly UpcomingChordPreview[] = [];
  lastUpcomingColorTheme: ColorTheme | undefined;
  lastUpcomingContinuedFromPreviousTap: boolean | undefined;

  spawnNoteVisual(midi: MidiNote, velocity: Velocity, colorTheme: ColorTheme): void {
    this.spawnedVisuals.push({ midi, velocity, colorTheme });
  }

  showUpcoming(chords: readonly UpcomingChordPreview[], colorTheme: ColorTheme, continuedFromPreviousTap: boolean): void {
    this.lastUpcoming = chords;
    this.lastUpcomingColorTheme = colorTheme;
    this.lastUpcomingContinuedFromPreviousTap = continuedFromPreviousTap;
  }

  tick(deltaMs: number): void {
    this.totalTickedMs += deltaMs;
  }

  resize(width: number, height: number): void {
    this.lastResize = { width, height };
  }
}
