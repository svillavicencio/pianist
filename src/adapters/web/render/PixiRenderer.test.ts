import * as PIXI from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { PixiRenderer, type NoteVisualContainer } from './PixiRenderer';

/**
 * A minimal fake of the `NoteVisualContainer` seam — no real PixiJS scene graph
 * needed, just enough to observe what `PixiRenderer` adds/removes. The graphics
 * it holds are real `PIXI.Graphics` instances (constructible in plain Node,
 * since drawing geometry needs no canvas/WebGL context), so scale/alpha/destroy
 * assertions exercise the real PixiJS objects `PixiRenderer` actually creates.
 */
class FakeContainer implements NoteVisualContainer {
  readonly children: PIXI.Graphics[] = [];

  addChild(child: PIXI.Graphics): void {
    this.children.push(child);
  }

  removeChild(child: PIXI.Graphics): void {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
  }
}

describe('PixiRenderer', () => {
  it('adds a graphic to the container when a note is spawned', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600);

    renderer.spawnNoteVisual(60, 'parliament');

    expect(container.children).toHaveLength(1);
  });

  it('positions spawned notes across the width by their MIDI pitch (21-108 range)', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 1000, 500);

    renderer.spawnNoteVisual(21, 'parliament'); // lowest piano key -> left edge
    renderer.spawnNoteVisual(108, 'parliament'); // highest piano key -> right edge

    expect(container.children[0]?.x).toBeCloseTo(0);
    expect(container.children[1]?.x).toBeCloseTo(1000);
  });

  it('applies particleStateAt scale/alpha on tick and keeps a mid-lifetime particle alive', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600);
    renderer.spawnNoteVisual(60, 'parliament');

    renderer.tick(400); // half of the 800ms particle lifetime

    const graphic = container.children[0];
    expect(graphic?.scale.x).toBeCloseTo(0.9);
    expect(graphic?.alpha).toBeCloseTo(0.5);
    expect(container.children).toHaveLength(1);
  });

  it('removes and destroys a particle once its lifetime elapses', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600);
    renderer.spawnNoteVisual(60, 'parliament');
    const graphic = container.children[0];
    const destroySpy = vi.spyOn(graphic as PIXI.Graphics, 'destroy');

    renderer.tick(800); // exactly the particle lifetime

    expect(container.children).toHaveLength(0);
    expect(destroySpy).toHaveBeenCalledOnce();
  });

  it('records new dimensions on resize for subsequent positioning', () => {
    const container = new FakeContainer();
    const renderer = new PixiRenderer(container, 800, 600);

    renderer.resize(400, 300);
    renderer.spawnNoteVisual(108, 'parliament'); // highest note -> full (new) width

    expect(container.children[0]?.x).toBeCloseTo(400);
  });
});
