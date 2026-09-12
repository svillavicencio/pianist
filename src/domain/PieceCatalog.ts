import type { ComposerPack, PieceSummary } from './types';

/** Browsable listing of available pieces, grouped by composer pack — the data behind the main menu. */
export class PieceCatalog {
  constructor(readonly packs: readonly ComposerPack[]) {}

  /** Finds a piece's summary by its `dataName` across every pack, or `undefined` if none matches. */
  findPiece(dataName: string): PieceSummary | undefined {
    for (const pack of this.packs) {
      const found = pack.pieces.find((piece) => piece.dataName === dataName);
      if (found) return found;
    }
    return undefined;
  }
}
