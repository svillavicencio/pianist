import * as PIXI from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { createBackdrop, drawBackdrop, SPAWN_HEIGHT_FRACTION } from './backdrop';

describe('backdrop', () => {
  it('creates exactly two graphics: the background and the hit line', () => {
    const backdrop = createBackdrop();
    expect(backdrop.background).toBeInstanceOf(PIXI.Graphics);
    expect(backdrop.hitLine).toBeInstanceOf(PIXI.Graphics);
  });

  it('draws the hit line at SPAWN_HEIGHT_FRACTION of the given height', () => {
    const backdrop = createBackdrop();
    const strokeSpy = vi.spyOn(backdrop.hitLine, 'stroke');
    const moveToSpy = vi.spyOn(backdrop.hitLine, 'moveTo');

    drawBackdrop(backdrop, 1000, 800);

    expect(moveToSpy).toHaveBeenCalledWith(0, 800 * SPAWN_HEIGHT_FRACTION);
    expect(strokeSpy).toHaveBeenCalledOnce();
  });

  it('fills the background across the full given size', () => {
    const backdrop = createBackdrop();
    const rectSpy = vi.spyOn(backdrop.background, 'rect');

    drawBackdrop(backdrop, 1000, 800);

    expect(rectSpy).toHaveBeenCalledWith(0, 0, 1000, 800);
  });

  it('clears both graphics before redrawing, so repeated resizes do not layer draws', () => {
    const backdrop = createBackdrop();
    drawBackdrop(backdrop, 1000, 800);
    const clearBackgroundSpy = vi.spyOn(backdrop.background, 'clear');
    const clearHitLineSpy = vi.spyOn(backdrop.hitLine, 'clear');

    drawBackdrop(backdrop, 500, 400); // simulates a resize

    expect(clearBackgroundSpy).toHaveBeenCalledOnce();
    expect(clearHitLineSpy).toHaveBeenCalledOnce();
  });
});
