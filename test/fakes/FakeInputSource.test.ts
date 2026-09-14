import { describe, expect, it } from 'vitest';
import { FakeInputSource } from './FakeInputSource';

describe('FakeInputSource', () => {
  it('notifies a registered press listener with the pressed id', () => {
    const input = new FakeInputSource();
    const pressed: string[] = [];
    input.onPress((id) => pressed.push(id));

    input.press('KeyA');
    expect(pressed).toEqual(['KeyA']);
  });

  it('notifies multiple press listeners on a single press()', () => {
    const input = new FakeInputSource();
    const a: string[] = [];
    const b: string[] = [];
    input.onPress((id) => a.push(id));
    input.onPress((id) => b.push(id));

    input.press('KeyA');
    expect(a).toEqual(['KeyA']);
    expect(b).toEqual(['KeyA']);
  });

  it('stops notifying a press listener after it unsubscribes', () => {
    const input = new FakeInputSource();
    let calls = 0;
    const unsubscribe = input.onPress(() => {
      calls++;
    });

    unsubscribe();
    input.press('KeyA');
    expect(calls).toBe(0);
  });

  it('notifies a registered release listener with the released id', () => {
    const input = new FakeInputSource();
    const released: string[] = [];
    input.onRelease((id) => released.push(id));

    input.release('KeyA');
    expect(released).toEqual(['KeyA']);
  });

  it('stops notifying a release listener after it unsubscribes', () => {
    const input = new FakeInputSource();
    let calls = 0;
    const unsubscribe = input.onRelease(() => {
      calls++;
    });

    unsubscribe();
    input.release('KeyA');
    expect(calls).toBe(0);
  });

  it('keeps press and release listeners independent', () => {
    const input = new FakeInputSource();
    let pressCalls = 0;
    input.onPress(() => {
      pressCalls++;
    });

    input.release('KeyA');
    expect(pressCalls).toBe(0);
  });
});
