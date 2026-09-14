// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DomInputSource } from './DomInputSource';

describe('DomInputSource', () => {
  it('notifies a registered press listener with the key code on keydown', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    const pressed: string[] = [];
    input.onPress((id) => pressed.push(id));

    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    expect(pressed).toEqual(['KeyA']);
  });

  it('notifies a registered release listener with the key code on keyup', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    const released: string[] = [];
    input.onRelease((id) => released.push(id));

    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    target.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    expect(released).toEqual(['KeyA']);
  });

  it('notifies press/release with a pointer-prefixed id on pointerdown/pointerup', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    const pressed: string[] = [];
    const released: string[] = [];
    input.onPress((id) => pressed.push(id));
    input.onRelease((id) => released.push(id));

    target.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7 }));
    target.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 }));
    expect(pressed).toEqual(['pointer:7']);
    expect(released).toEqual(['pointer:7']);
  });

  it('notifies multiple listeners on a single event', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    let a = 0;
    let b = 0;
    input.onPress(() => {
      a++;
    });
    input.onPress(() => {
      b++;
    });

    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    let calls = 0;
    const unsubscribe = input.onPress(() => {
      calls++;
    });

    unsubscribe();
    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    expect(calls).toBe(0);
  });

  it('stops all listeners after destroy()', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    let calls = 0;
    input.onPress(() => {
      calls++;
    });

    input.destroy();
    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    target.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1 }));
    expect(calls).toBe(0);
  });

  it('works against window as the target', () => {
    const input = new DomInputSource(window);
    let calls = 0;
    input.onPress(() => {
      calls++;
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    expect(calls).toBe(1);

    input.destroy();
  });
});
