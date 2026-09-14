import * as PIXI from 'pixi.js';

/** Fraction of the viewport height the hit line sits at — must match `PixiRenderer`'s
 *  `SPAWN_HEIGHT_FRACTION`, which is where particles actually spawn/land. Re-exported from here
 *  since the backdrop needs it and must stay independent of `PixiRenderer`. */
export const SPAWN_HEIGHT_FRACTION = 0.85;

const HIT_LINE_ALPHA = 0.18;
const HIT_LINE_WIDTH_PX = 2;
const BACKGROUND_TOP_HEX = 0x1a1f2e;
const BACKGROUND_BOTTOM_HEX = 0x0a0b0d;

/**
 * Number of horizontal bands used to fake a smooth vertical gradient (see note on `drawBackdrop`
 * below for why this doesn't use `PIXI.FillGradient`). 32 bands is enough to read as a continuous
 * gradient at normal viewing distance.
 */
const BACKGROUND_GRADIENT_BANDS = 32;

export interface Backdrop {
  readonly background: PIXI.Graphics;
  readonly hitLine: PIXI.Graphics;
}

/** Creates the two backdrop graphics, undrawn — call `drawBackdrop` to size them, and add both
 *  to the stage *before* constructing `PixiRenderer` so they stay outside its tracked children. */
export function createBackdrop(): Backdrop {
  return { background: new PIXI.Graphics(), hitLine: new PIXI.Graphics() };
}

/**
 * (Re)draws both backdrop graphics for the given viewport size — call once at startup and again
 * on every resize.
 *
 * The background is a vertical gradient built from stacked, alpha-blended horizontal bands rather
 * than `PIXI.FillGradient`: that API builds its gradient by rendering into a real `<canvas>` 2D
 * context (`HTMLCanvasElement.getContext('2d')`) the moment `.fill()` runs, and this project's test
 * environment (Vitest, `node`/jsdom, no `canvas` npm package — see the plan's "no new dependencies"
 * constraint) has no such context, so a `FillGradient` fill throws there. Banding keeps the same
 * visual intent (a vertical gradient rect) using only plain flat-color fills, which work everywhere.
 */
export function drawBackdrop(backdrop: Backdrop, width: number, height: number): void {
  backdrop.background.clear();
  backdrop.background.rect(0, 0, width, height).fill(BACKGROUND_BOTTOM_HEX);

  const bandHeight = height / BACKGROUND_GRADIENT_BANDS;
  for (let i = 0; i < BACKGROUND_GRADIENT_BANDS; i++) {
    const alpha = 1 - i / (BACKGROUND_GRADIENT_BANDS - 1);
    backdrop.background
      .rect(0, i * bandHeight, width, bandHeight + 1) // +1 avoids hairline seams from rounding
      .fill({ color: BACKGROUND_TOP_HEX, alpha });
  }

  const hitLineY = height * SPAWN_HEIGHT_FRACTION;
  backdrop.hitLine.clear();
  backdrop.hitLine
    .moveTo(0, hitLineY)
    .lineTo(width, hitLineY)
    .stroke({ width: HIT_LINE_WIDTH_PX, color: 0xffffff, alpha: HIT_LINE_ALPHA });
}
