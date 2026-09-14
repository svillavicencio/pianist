// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderGameOverlay } from './gameOverlay';

function makeCallbacks() {
  return { onPause: vi.fn(), onSeek: vi.fn() };
}

describe('renderGameOverlay', () => {
  it('renders a real <button> that calls onPause on click', () => {
    const container = document.createElement('div');
    const callbacks = makeCallbacks();
    renderGameOverlay(container, callbacks);

    const button = container.querySelector<HTMLButtonElement>('.game-overlay__menu-button')!;
    expect(button.tagName).toBe('BUTTON');
    button.click();

    expect(callbacks.onPause).toHaveBeenCalledTimes(1);
  });

  it('calls onPause exactly once per click', () => {
    const container = document.createElement('div');
    const callbacks = makeCallbacks();
    renderGameOverlay(container, callbacks);

    const button = container.querySelector<HTMLButtonElement>('.game-overlay__menu-button')!;
    button.click();
    button.click();

    expect(callbacks.onPause).toHaveBeenCalledTimes(2);
  });

  it('renders a "how to play" hint', () => {
    const container = document.createElement('div');
    renderGameOverlay(container, makeCallbacks());

    expect(container.querySelector('.game-overlay__hint')).not.toBeNull();
    expect(container.textContent).toContain('Tap, click, or press any key');
  });

  it('renders a progress bar starting at 0 / 0', () => {
    const container = document.createElement('div');
    renderGameOverlay(container, makeCallbacks());

    expect(container.querySelector('.game-overlay__progress-track')).not.toBeNull();
    expect(container.querySelector<HTMLElement>('.game-overlay__progress-fill')!.style.width).toBe('');
    expect(container.querySelector('.game-overlay__progress-label')!.textContent).toBe('0 / 0');
  });

  it('setProgress() updates the fill width and the label', () => {
    const container = document.createElement('div');
    const handle = renderGameOverlay(container, makeCallbacks());

    handle.setProgress(3, 10);

    expect(container.querySelector<HTMLElement>('.game-overlay__progress-fill')!.style.width).toBe('30%');
    expect(container.querySelector('.game-overlay__progress-label')!.textContent).toBe('3 / 10');
  });

  it('setProgress() with zero total renders 0% without dividing by zero', () => {
    const container = document.createElement('div');
    const handle = renderGameOverlay(container, makeCallbacks());

    expect(() => handle.setProgress(0, 0)).not.toThrow();
    expect(container.querySelector<HTMLElement>('.game-overlay__progress-fill')!.style.width).toBe('0%');
    expect(container.querySelector('.game-overlay__progress-label')!.textContent).toBe('0 / 0');
  });

  it('clicking the progress track calls onSeek with the clicked ratio', () => {
    const container = document.createElement('div');
    const callbacks = makeCallbacks();
    renderGameOverlay(container, callbacks);

    const track = container.querySelector<HTMLElement>('.game-overlay__progress-track')!;
    track.getBoundingClientRect = () =>
      ({ left: 100, width: 200 }) as DOMRect;

    track.dispatchEvent(new MouseEvent('click', { clientX: 150 }));

    expect(callbacks.onSeek).toHaveBeenCalledTimes(1);
    expect(callbacks.onSeek).toHaveBeenCalledWith(0.25);
  });

  it('clamps onSeek ratio to [0, 1] for clicks outside the track bounds', () => {
    const container = document.createElement('div');
    const callbacks = makeCallbacks();
    renderGameOverlay(container, callbacks);

    const track = container.querySelector<HTMLElement>('.game-overlay__progress-track')!;
    track.getBoundingClientRect = () =>
      ({ left: 100, width: 200 }) as DOMRect;

    track.dispatchEvent(new MouseEvent('click', { clientX: 0 }));
    expect(callbacks.onSeek).toHaveBeenLastCalledWith(0);

    track.dispatchEvent(new MouseEvent('click', { clientX: 1000 }));
    expect(callbacks.onSeek).toHaveBeenLastCalledWith(1);
  });

  it('destroy() empties only what it added and detaches the listeners on the old elements', () => {
    const container = document.createElement('div');
    const preexisting = document.createElement('p');
    preexisting.className = 'unrelated-sibling';
    container.appendChild(preexisting);

    const callbacks = makeCallbacks();
    const handle = renderGameOverlay(container, callbacks);
    const button = container.querySelector<HTMLButtonElement>('.game-overlay__menu-button')!;
    const track = container.querySelector<HTMLElement>('.game-overlay__progress-track')!;

    handle.destroy();

    expect(container.children.length).toBe(1);
    expect(container.querySelector('.unrelated-sibling')).toBe(preexisting);
    button.click();
    expect(callbacks.onPause).not.toHaveBeenCalled();
    track.dispatchEvent(new MouseEvent('click', { clientX: 50 }));
    expect(callbacks.onSeek).not.toHaveBeenCalled();
  });
});
