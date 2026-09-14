import { describe, expect, it, vi } from 'vitest';
import { SystemClock } from './SystemClock';

describe('SystemClock', () => {
  it('runs the callback after the requested delay', () => {
    vi.useFakeTimers();
    try {
      const clock = new SystemClock();
      const callback = vi.fn();

      clock.schedule(callback, 100);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(99);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancel() prevents a scheduled callback from running', () => {
    vi.useFakeTimers();
    try {
      const clock = new SystemClock();
      const callback = vi.fn();

      const handle = clock.schedule(callback, 100);
      clock.cancel(handle);
      vi.advanceTimersByTime(1000);

      expect(callback).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancel() is a no-op for an unknown or already-fired handle', () => {
    vi.useFakeTimers();
    try {
      const clock = new SystemClock();
      const callback = vi.fn();

      const handle = clock.schedule(callback, 10);
      vi.advanceTimersByTime(10);
      expect(callback).toHaveBeenCalledTimes(1);

      expect(() => clock.cancel(handle)).not.toThrow();
      expect(() => clock.cancel(999)).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it('now() advances with wall-clock time', () => {
    vi.useFakeTimers();
    try {
      const clock = new SystemClock();
      const first = clock.now();
      vi.advanceTimersByTime(50);
      expect(clock.now()).toBeGreaterThanOrEqual(first + 50);
    } finally {
      vi.useRealTimers();
    }
  });
});
