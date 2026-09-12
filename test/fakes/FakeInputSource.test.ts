import { describe, expect, it } from 'vitest';
import { FakeInputSource } from './FakeInputSource';

describe('FakeInputSource', () => {
  it('notifies a registered listener when fire() is called', () => {
    const input = new FakeInputSource();
    let calls = 0;
    input.onTrigger(() => {
      calls++;
    });

    input.fire();
    expect(calls).toBe(1);
  });

  it('notifies multiple listeners on a single fire()', () => {
    const input = new FakeInputSource();
    let a = 0;
    let b = 0;
    input.onTrigger(() => {
      a++;
    });
    input.onTrigger(() => {
      b++;
    });

    input.fire();
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const input = new FakeInputSource();
    let calls = 0;
    const unsubscribe = input.onTrigger(() => {
      calls++;
    });

    unsubscribe();
    input.fire();
    expect(calls).toBe(0);
  });
});
