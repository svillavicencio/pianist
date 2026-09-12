import { describe, expect, it } from 'vitest';
import { contentCatalog, contentPieces } from './catalog';

describe('contentCatalog', () => {
  it('finds the twinkle twinkle piece summary by dataName', () => {
    expect(contentCatalog.findPiece('traditional_twinkle_twinkle')).toEqual({
      dataName: 'traditional_twinkle_twinkle',
      displayName: 'Twinkle, Twinkle, Little Star',
      colorTheme: 'sunset',
    });
  });
});

describe('contentPieces', () => {
  it('has the full twinkle twinkle piece with 42 chords', () => {
    const piece = contentPieces.get('traditional_twinkle_twinkle');
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(42);
  });
});
