import type { Clock } from '../../../ports/Clock';

/**
 * `Clock` implementation backed by real wall-clock time (`setTimeout`/`performance.now`).
 * The only concrete `Clock` this app ships — `WatchModePlayer` otherwise only ever
 * saw `FakeClock` in tests until this adapter existed to drive it for real.
 */
export class SystemClock implements Clock {
  private readonly timeouts = new Map<number, ReturnType<typeof setTimeout>>();
  private nextHandle = 1;

  now(): number {
    return performance.now();
  }

  schedule(callback: () => void, delayMs: number): number {
    const handle = this.nextHandle++;
    const timeout = setTimeout(() => {
      this.timeouts.delete(handle);
      callback();
    }, delayMs);
    this.timeouts.set(handle, timeout);
    return handle;
  }

  cancel(handle: number): void {
    const timeout = this.timeouts.get(handle);
    if (timeout === undefined) return;
    clearTimeout(timeout);
    this.timeouts.delete(handle);
  }
}
