// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DomInputSource } from './DomInputSource';

describe('DomInputSource', () => {
  it('notifies a registered listener on keydown', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    let calls = 0;
    input.onTrigger(() => {
      calls++;
    });

    target.dispatchEvent(new KeyboardEvent('keydown'));
    expect(calls).toBe(1);
  });

  it('notifies a registered listener on pointerdown', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    let calls = 0;
    input.onTrigger(() => {
      calls++;
    });

    target.dispatchEvent(new PointerEvent('pointerdown'));
    expect(calls).toBe(1);
  });

  it('notifies multiple listeners on a single event', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    let a = 0;
    let b = 0;
    input.onTrigger(() => {
      a++;
    });
    input.onTrigger(() => {
      b++;
    });

    target.dispatchEvent(new KeyboardEvent('keydown'));
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    let calls = 0;
    const unsubscribe = input.onTrigger(() => {
      calls++;
    });

    unsubscribe();
    target.dispatchEvent(new KeyboardEvent('keydown'));
    expect(calls).toBe(0);
  });

  it('stops all listeners after destroy()', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    let calls = 0;
    input.onTrigger(() => {
      calls++;
    });

    input.destroy();
    target.dispatchEvent(new KeyboardEvent('keydown'));
    target.dispatchEvent(new PointerEvent('pointerdown'));
    expect(calls).toBe(0);
  });

  it('works against window as the target', () => {
    const input = new DomInputSource(window);
    let calls = 0;
    input.onTrigger(() => {
      calls++;
    });

    window.dispatchEvent(new KeyboardEvent('keydown'));
    expect(calls).toBe(1);

    input.destroy();
  });
});
