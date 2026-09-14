import type { SavedPosition } from '../../../domain/types';
import type { SavedPositionRepository } from '../../../domain/SavedPositionRepository';

/** Namespaces a piece's storage key so it can't collide with unrelated app data. */
const keyFor = (pieceDataName: string): string => `pianist:saved-position:${pieceDataName}`;

/** A `SavedPositionRepository` backed by a `localStorage`-shaped `Storage`, one entry per piece. */
export class LocalStorageRepository implements SavedPositionRepository {
  constructor(private readonly storage: Storage) {}

  save(position: SavedPosition): void {
    this.storage.setItem(keyFor(position.pieceDataName), JSON.stringify(position));
  }

  load(pieceDataName: string): SavedPosition | undefined {
    const raw = this.storage.getItem(keyFor(pieceDataName));
    if (raw === null) {
      return undefined;
    }
    try {
      return JSON.parse(raw) as SavedPosition;
    } catch {
      // Corrupt entry behaves like "nothing saved" rather than crashing the app.
      return undefined;
    }
  }

  clear(pieceDataName: string): void {
    this.storage.removeItem(keyFor(pieceDataName));
  }
}
