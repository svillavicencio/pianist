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

function makeCallbacks() {
  return { onSelectPiece: vi.fn(), onPreviewPiece: vi.fn() };
}

describe('renderMainMenu', () => {
  it('renders a title, one heading per pack, and one row per piece', () => {
    const container = document.createElement('div');
    renderMainMenu(container, makeCatalog(), makeCallbacks());

    expect(container.querySelector('.main-menu__title')!.textContent).toBe('π-anist');
    expect(container.querySelectorAll('.main-menu__pack').length).toBe(2);
    expect(container.querySelectorAll('.main-menu__piece-row').length).toBe(3);
    expect(container.textContent).toContain('Bach Essentials');
    expect(container.textContent).toContain('J.S. Bach');
    expect(container.textContent).toContain('Chopin Nocturnes');
    expect(container.textContent).toContain('BWV 772');
  });

  it('calls onSelectPiece with exactly that piece dataName on Perform click', () => {
    const container = document.createElement('div');
    const callbacks = makeCallbacks();
    renderMainMenu(container, makeCatalog(), callbacks);

    const buttons = container.querySelectorAll<HTMLButtonElement>('.main-menu__perform-button');
    expect(buttons.length).toBe(3);
    buttons[2]!.click();

    expect(callbacks.onSelectPiece).toHaveBeenCalledTimes(1);
    expect(callbacks.onSelectPiece).toHaveBeenCalledWith('chopin-op9no2');
    expect(callbacks.onPreviewPiece).not.toHaveBeenCalled();
  });

  it('calls onPreviewPiece with exactly that piece dataName on Preview click', () => {
    const container = document.createElement('div');
    const callbacks = makeCallbacks();
    renderMainMenu(container, makeCatalog(), callbacks);

    const buttons = container.querySelectorAll<HTMLButtonElement>('.main-menu__preview-button');
    expect(buttons.length).toBe(3);
    buttons[0]!.click();

    expect(callbacks.onPreviewPiece).toHaveBeenCalledTimes(1);
    expect(callbacks.onPreviewPiece).toHaveBeenCalledWith('bach-minuet');
    expect(callbacks.onSelectPiece).not.toHaveBeenCalled();
  });

  it('setPreviewing() flips the matching row to Stop and every other row back to Preview', () => {
    const container = document.createElement('div');
    const handle = renderMainMenu(container, makeCatalog(), makeCallbacks());

    handle.setPreviewing('bach-invention');

    const buttons = container.querySelectorAll<HTMLButtonElement>('.main-menu__preview-button');
    expect(buttons[0]!.textContent).toBe('▶ Preview');
    expect(buttons[1]!.textContent).toBe('■ Stop');
    expect(buttons[2]!.textContent).toBe('▶ Preview');
    expect(
      buttons[1]!.closest('.main-menu__piece-row')!.classList.contains('main-menu__piece-row--previewing'),
    ).toBe(true);

    handle.setPreviewing(null);
    expect(buttons[1]!.textContent).toBe('▶ Preview');
    expect(
      buttons[1]!.closest('.main-menu__piece-row')!.classList.contains('main-menu__piece-row--previewing'),
    ).toBe(false);
  });

  it('renders an empty state without throwing for an empty catalog', () => {
    const container = document.createElement('div');

    expect(() => renderMainMenu(container, makeCatalog([]), makeCallbacks())).not.toThrow();
    expect(container.querySelectorAll('.main-menu__pack').length).toBe(0);
    expect(container.querySelector('.main-menu__empty')).not.toBeNull();
  });

  it('destroy() empties only what it added and detaches listeners on old buttons', () => {
    const container = document.createElement('div');
    const preexisting = document.createElement('p');
    preexisting.className = 'unrelated-sibling';
    container.appendChild(preexisting);

    const callbacks = makeCallbacks();
    const handle = renderMainMenu(container, makeCatalog(), callbacks);
    const performButton = container.querySelector<HTMLButtonElement>('.main-menu__perform-button')!;
    const previewButton = container.querySelector<HTMLButtonElement>('.main-menu__preview-button')!;

    handle.destroy();

    expect(container.children.length).toBe(1);
    expect(container.querySelector('.unrelated-sibling')).toBe(preexisting);
    performButton.click();
    previewButton.click();
    expect(callbacks.onSelectPiece).not.toHaveBeenCalled();
    expect(callbacks.onPreviewPiece).not.toHaveBeenCalled();
  });
});
