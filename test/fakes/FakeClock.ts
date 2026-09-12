import type { Clock } from '../../src/ports/Clock';

interface ScheduledCall {
  readonly handle: number;
  readonly dueAt: number;
  readonly callback: () => void;
}

/** A `Clock` double with manually-advanceable time — no real waiting in tests. */
export class FakeClock implements Clock {
  private currentTime = 0;
  private nextHandle = 1;
  private scheduled: ScheduledCall[] = [];

  now(): number {
    return this.currentTime;
  }

  schedule(callback: () => void, delayMs: number): number {
    const handle = this.nextHandle++;
    this.scheduled.push({ handle, dueAt: this.currentTime + delayMs, callback });
    return handle;
  }

  cancel(handle: number): void {
    this.scheduled = this.scheduled.filter((call) => call.handle !== handle);
  }

  /** Move time forward by `ms`, running (in due-time order) any callback whose time has come. */
  advance(ms: number): void {
    this.currentTime += ms;
    const due = this.scheduled
      .filter((call) => call.dueAt <= this.currentTime)
      .sort((a, b) => a.dueAt - b.dueAt);
    for (const call of due) {
      this.cancel(call.handle);
      call.callback();
    }
  }
}
