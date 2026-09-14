// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { LocalStorageRepository } from './LocalStorageRepository';

describe('LocalStorageRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a saved position through save/load', () => {
    const repo = new LocalStorageRepository(localStorage);
    repo.save({ pieceDataName: 'fur-elise', chordIndex: 42 });

    expect(repo.load('fur-elise')).toEqual({ pieceDataName: 'fur-elise', chordIndex: 42 });
  });

  it('returns undefined when nothing is saved', () => {
    const repo = new LocalStorageRepository(localStorage);

    expect(repo.load('nonexistent')).toBeUndefined();
  });

  it('returns undefined without throwing when the stored value is corrupt JSON', () => {
    const repo = new LocalStorageRepository(localStorage);
    localStorage.setItem('pianist:saved-position:broken', 'not valid json {{{');

    expect(() => repo.load('broken')).not.toThrow();
    expect(repo.load('broken')).toBeUndefined();
  });

  it('removes the entry on clear', () => {
    const repo = new LocalStorageRepository(localStorage);
    repo.save({ pieceDataName: 'fur-elise', chordIndex: 42 });

    repo.clear('fur-elise');
    expect(repo.load('fur-elise')).toBeUndefined();
  });

  it('does not let two different pieces collide', () => {
    const repo = new LocalStorageRepository(localStorage);
    repo.save({ pieceDataName: 'piece-a', chordIndex: 1 });
    repo.save({ pieceDataName: 'piece-b', chordIndex: 2 });

    expect(repo.load('piece-a')).toEqual({ pieceDataName: 'piece-a', chordIndex: 1 });
    expect(repo.load('piece-b')).toEqual({ pieceDataName: 'piece-b', chordIndex: 2 });
  });
});
