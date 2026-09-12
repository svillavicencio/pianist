import { describe, expect, it } from 'vitest';
import { PieceCatalog } from './PieceCatalog';
import type { ComposerPack } from './types';

const samplePacks: readonly ComposerPack[] = [
  {
    composer: 'beethoven',
    composerDisplay: 'Ludwig van Beethoven',
    packDisplay: 'Piano Sonatas',
    pieces: [
      { dataName: 'beethoven_moonlight_1', displayName: 'Moonlight Sonata', colorTheme: 'parliament' },
    ],
  },
  {
    composer: 'bach',
    composerDisplay: 'Johann Sebastian Bach',
    packDisplay: 'Minuets',
    pieces: [
      { dataName: 'bach_minuet_g', displayName: 'Minuet in G', colorTheme: 'ocean' },
      { dataName: 'bach_minuet_g_minor', displayName: 'Minuet in G minor', colorTheme: 'ocean' },
    ],
  },
];

describe('PieceCatalog', () => {
  it('exposes the packs it was built with', () => {
    const catalog = new PieceCatalog(samplePacks);
    expect(catalog.packs).toBe(samplePacks);
  });

  it('finds a piece by dataName across packs', () => {
    const catalog = new PieceCatalog(samplePacks);
    expect(catalog.findPiece('bach_minuet_g_minor')).toEqual({
      dataName: 'bach_minuet_g_minor',
      displayName: 'Minuet in G minor',
      colorTheme: 'ocean',
    });
  });

  it('returns undefined for an unknown dataName', () => {
    const catalog = new PieceCatalog(samplePacks);
    expect(catalog.findPiece('does_not_exist')).toBeUndefined();
  });

  it('handles an empty catalog', () => {
    const catalog = new PieceCatalog([]);
    expect(catalog.packs).toEqual([]);
    expect(catalog.findPiece('anything')).toBeUndefined();
  });
});
