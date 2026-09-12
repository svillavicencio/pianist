// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { PieceCatalog } from '../domain/PieceCatalog';
import type { ComposerPack } from '../domain/types';
import { renderMainMenu } from './mainMenu';

const fixturePacks: readonly ComposerPack[] = [
  {
    composer: 'bach',
    composerDisplay: 'J.S. Bach',
    packDisplay: 'Bach Essentials',
    pieces: [
      { dataName: 'bach-minuet', displayName: 'Minuet in G', colorTheme: 'parliament' },
      {
        dataName: 'bach-invention',
        displayName: 'Invention No. 1',
        displayInfo: 'BWV 772',
        colorTheme: 'parliament',
      },
    ],
  },
  {
    composer: 'chopin',
    composerDisplay: 'Frédéric Chopin',
    packDisplay: 'Chopin Nocturnes',
    pieces: [{ dataName: 'chopin-op9no2', displayName: 'Nocturne Op. 9 No. 2', colorTheme: 'candy' }],
  },
];

function makeCatalog(packs: readonly ComposerPack[] = fixturePacks): PieceCatalog {
  return new PieceCatalog(packs);
}

describe('renderMainMenu', () => {
  it('renders one heading per pack and one row per piece', () => {
    const container = document.createElement('div');
    renderMainMenu(container, makeCatalog(), () => {});

    expect(container.querySelectorAll('.main-menu__pack').length).toBe(2);
    expect(container.querySelectorAll('.main-menu__piece-row').length).toBe(3);
    expect(container.textContent).toContain('Bach Essentials');
    expect(container.textContent).toContain('J.S. Bach');
    expect(container.textContent).toContain('Chopin Nocturnes');
    expect(container.textContent).toContain('BWV 772');
  });

  it('calls onSelectPiece with exactly that piece dataName on click', () => {
    const container = document.createElement('div');
    const onSelectPiece = vi.fn();
    renderMainMenu(container, makeCatalog(), onSelectPiece);

    const buttons = container.querySelectorAll<HTMLButtonElement>('.main-menu__perform-button');
    expect(buttons.length).toBe(3);
    buttons[2]!.click();

    expect(onSelectPiece).toHaveBeenCalledTimes(1);
    expect(onSelectPiece).toHaveBeenCalledWith('chopin-op9no2');
  });

  it('renders an empty state without throwing for an empty catalog', () => {
    const container = document.createElement('div');

    expect(() => renderMainMenu(container, makeCatalog([]), () => {})).not.toThrow();
    expect(container.querySelectorAll('.main-menu__pack').length).toBe(0);
    expect(container.querySelector('.main-menu__empty')).not.toBeNull();
  });

  it('destroy() empties only what it added and detaches listeners on old buttons', () => {
    const container = document.createElement('div');
    const preexisting = document.createElement('p');
    preexisting.className = 'unrelated-sibling';
    container.appendChild(preexisting);

    const onSelectPiece = vi.fn();
    const handle = renderMainMenu(container, makeCatalog(), onSelectPiece);
    const button = container.querySelector<HTMLButtonElement>('.main-menu__perform-button')!;

    handle.destroy();

    expect(container.children.length).toBe(1);
    expect(container.querySelector('.unrelated-sibling')).toBe(preexisting);
    button.click();
    expect(onSelectPiece).not.toHaveBeenCalled();
  });
});
