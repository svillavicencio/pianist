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

  it('finds the mary had a little lamb piece summary by dataName', () => {
    expect(contentCatalog.findPiece('traditional_mary_had_a_little_lamb')).toEqual({
      dataName: 'traditional_mary_had_a_little_lamb',
      displayName: 'Mary Had a Little Lamb',
      colorTheme: 'forest',
    });
  });

  it('finds the ode to joy piece summary by dataName', () => {
    expect(contentCatalog.findPiece('beethoven_ode_to_joy')).toEqual({
      dataName: 'beethoven_ode_to_joy',
      displayName: 'Ode to Joy',
      colorTheme: 'ocean',
    });
  });

  it('finds the moonlight sonata piece summary by dataName', () => {
    expect(contentCatalog.findPiece('beethoven_moonlight_sonata')).toEqual({
      dataName: 'beethoven_moonlight_sonata',
      displayName: 'Moonlight Sonata (Complete 1st Movement)',
      colorTheme: 'parliament',
    });
  });

  it('finds the rachmaninoff prelude piece summary by dataName', () => {
    expect(contentCatalog.findPiece('rachmaninoff_prelude_op3_no2')).toEqual({
      dataName: 'rachmaninoff_prelude_op3_no2',
      displayName: 'Prelude in C-sharp minor, Op. 3 No. 2 ("Bells of Moscow")',
      colorTheme: 'midnight',
    });
  });

  it('groups pieces into a traditional pack, a beethoven pack, and a rachmaninoff pack', () => {
    expect(contentCatalog.packs).toHaveLength(3);
    expect(contentCatalog.packs[0]?.pieces).toHaveLength(2);
    expect(contentCatalog.packs[1]?.pieces).toHaveLength(2);
    expect(contentCatalog.packs[2]?.pieces).toHaveLength(1);
  });
});

describe('contentPieces', () => {
  it('has the full twinkle twinkle piece with 42 chords', () => {
    const piece = contentPieces.get('traditional_twinkle_twinkle');
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(42);
  });

  it('has the full mary had a little lamb piece with 26 chords', () => {
    const piece = contentPieces.get('traditional_mary_had_a_little_lamb');
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(26);
  });

  it('has the full ode to joy piece with 30 chords', () => {
    const piece = contentPieces.get('beethoven_ode_to_joy');
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(30);
  });

  it('has the full moonlight sonata piece with 821 chords, including multi-note chords', () => {
    const piece = contentPieces.get('beethoven_moonlight_sonata');
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(821);
    expect(piece?.chords[0]?.notes.length).toBeGreaterThan(1);
  });

  it('has the full rachmaninoff prelude piece with 544 chords, including multi-note chords', () => {
    const piece = contentPieces.get('rachmaninoff_prelude_op3_no2');
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(544);
    expect(piece?.chords[0]?.notes.length).toBeGreaterThan(1);
  });
});
