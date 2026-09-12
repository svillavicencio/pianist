import { describe, expect, it } from 'vitest';
import { FakeClock } from './FakeClock';

describe('FakeClock', () => {
  it('starts at time zero', () => {
    expect(new FakeClock().now()).toBe(0);
  });

  it('advances now() by the given amount', () => {
    const clock = new FakeClock();
    clock.advance(500);
    expect(clock.now()).toBe(500);
  });

  it('runs a scheduled callback once its delay has elapsed', () => {
    const clock = new FakeClock();
    let fired = false;
    clock.schedule(() => {
      fired = true;
    }, 100);

    clock.advance(99);
    expect(fired).toBe(false);

    clock.advance(1);
    expect(fired).toBe(true);
  });

  it('does not run a cancelled callback', () => {
    const clock = new FakeClock();
    let fired = false;
    const handle = clock.schedule(() => {
      fired = true;
    }, 100);
    clock.cancel(handle);

    clock.advance(200);
    expect(fired).toBe(false);
  });

  it('cancelling an unknown or already-cancelled handle is a no-op', () => {
    const clock = new FakeClock();
    expect(() => clock.cancel(999)).not.toThrow();
  });

  it('runs due callbacks in the order they become due', () => {
    const clock = new FakeClock();
    const order: string[] = [];
    clock.schedule(() => order.push('second'), 200);
    clock.schedule(() => order.push('first'), 100);

    clock.advance(200);
    expect(order).toEqual(['first', 'second']);
  });
});
