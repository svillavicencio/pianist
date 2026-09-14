// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderPauseMenu } from './pauseMenu';

function makeCallbacks() {
  return { onResume: vi.fn(), onRestart: vi.fn(), onMainMenu: vi.fn() };
}

describe('renderPauseMenu', () => {
  it('calls onResume exactly once per click, and no other callback', () => {
    const container = document.createElement('div');
    const callbacks = makeCallbacks();
    renderPauseMenu(container, callbacks);

    container.querySelector<HTMLButtonElement>('.pause-menu__resume-button')!.click();

    expect(callbacks.onResume).toHaveBeenCalledTimes(1);
    expect(callbacks.onRestart).not.toHaveBeenCalled();
    expect(callbacks.onMainMenu).not.toHaveBeenCalled();
  });

  it('calls onRestart exactly once per click, and no other callback', () => {
    const container = document.createElement('div');
    const callbacks = makeCallbacks();
    renderPauseMenu(container, callbacks);

    container.querySelector<HTMLButtonElement>('.pause-menu__restart-button')!.click();

    expect(callbacks.onRestart).toHaveBeenCalledTimes(1);
    expect(callbacks.onResume).not.toHaveBeenCalled();
    expect(callbacks.onMainMenu).not.toHaveBeenCalled();
  });

  it('calls onMainMenu exactly once per click, and no other callback', () => {
    const container = document.createElement('div');
    const callbacks = makeCallbacks();
    renderPauseMenu(container, callbacks);

    container.querySelector<HTMLButtonElement>('.pause-menu__main-menu-button')!.click();

    expect(callbacks.onMainMenu).toHaveBeenCalledTimes(1);
    expect(callbacks.onResume).not.toHaveBeenCalled();
    expect(callbacks.onRestart).not.toHaveBeenCalled();
  });

  it('every button is a real <button> element', () => {
    const container = document.createElement('div');
    renderPauseMenu(container, makeCallbacks());

    for (const selector of [
      '.pause-menu__resume-button',
      '.pause-menu__restart-button',
      '.pause-menu__main-menu-button',
    ]) {
      expect(container.querySelector(selector)!.tagName).toBe('BUTTON');
    }
  });

  it('destroy() empties only what it added and detaches listeners on old buttons', () => {
    const container = document.createElement('div');
    const preexisting = document.createElement('p');
    preexisting.className = 'unrelated-sibling';
    container.appendChild(preexisting);

    const callbacks = makeCallbacks();
    const handle = renderPauseMenu(container, callbacks);
    const resumeButton = container.querySelector<HTMLButtonElement>('.pause-menu__resume-button')!;

    handle.destroy();

    expect(container.children.length).toBe(1);
    expect(container.querySelector('.unrelated-sibling')).toBe(preexisting);
    resumeButton.click();
    expect(callbacks.onResume).not.toHaveBeenCalled();
  });

  it('renders a scrim behind the menu card to dim the paused game', () => {
    const container = document.createElement('div');
    renderPauseMenu(container, makeCallbacks());

    expect(container.querySelector('.pause-menu__scrim')).not.toBeNull();
  });

  it('destroy() removes the scrim along with the menu card', () => {
    const container = document.createElement('div');
    const handle = renderPauseMenu(container, makeCallbacks());

    handle.destroy();

    expect(container.querySelector('.pause-menu__scrim')).toBeNull();
    expect(container.querySelector('.pause-menu')).toBeNull();
  });
});
