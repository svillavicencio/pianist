# Key-hold Note Sustain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: use the `executing-plans` skill to implement this plan task-by-task.

**Goal:** Holding a key sustains its note for as long as it's held (natural sample decay); releasing early cuts it with a short fade — simulating a piano damper — and OS key auto-repeat no longer spams retriggers.

**Architecture:** `InputSource` gains id-correlated `onPress`/`onRelease` (id = key code or `pointer:<id>`); `AudioEngine.noteOn` returns a per-voice `NoteHandle` instead of exposing `noteOff(midi)`, so a key's release always stops the exact voice it started, never a same-pitch voice from a different, later press. `main.ts` keeps a `Map<string, NoteHandle[]>` from press id to the handles it started.

**Tech Stack:** TypeScript, Vite, Vitest (jsdom for DOM adapter tests, hand-rolled Web Audio fakes for `WebAudioEngine`).

Full design rationale: `docs/plans/2026-09-14-key-hold-note-sustain-design.md`.

---

### Task 0: Branch

**Step 1:** Create the feature branch (design doc commit `9899c9a` is already on `master` and will be included).

```bash
git checkout -b feature/key-hold-note-sustain
```

---

### Task 1: `InputSource` — split `onTrigger` into `onPress`/`onRelease`

**Files:**
- Modify: `src/ports/InputSource.ts`
- Modify: `test/fakes/FakeInputSource.ts`
- Modify: `test/fakes/FakeInputSource.test.ts`
- Modify: `src/adapters/web/input/DomInputSource.ts`
- Modify: `src/adapters/web/input/DomInputSource.test.ts`

**Step 1: Update the port**

Replace the full content of `src/ports/InputSource.ts`:

```ts
/** A press or release of one physical input (a specific key or pointer) — identified by `id` so a later release can be matched to its press. */
export type InputListener = (id: string) => void;

/**
 * Normalizes "the user pressed/released a thing" (any key, any tap) into two
 * abstract signals. The domain never touches KeyboardEvent/PointerEvent/etc —
 * only this. `id` is opaque to callers: it exists only to correlate a later
 * `onRelease` call back to the `onPress` that started it.
 */
export interface InputSource {
  /** Register a listener invoked once per press. Returns an unsubscribe function. */
  onPress(listener: InputListener): () => void;
  /** Register a listener invoked once per release of a previously-pressed id. Returns an unsubscribe function. */
  onRelease(listener: InputListener): () => void;
}
```

**Step 2: Rewrite `FakeInputSource` tests to the new shape (will fail — old API is gone)**

Replace `test/fakes/FakeInputSource.test.ts`:

```ts
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
```

**Step 3: Run the test to verify it fails**

Run: `npx vitest run test/fakes/FakeInputSource.test.ts`
Expected: FAIL — `FakeInputSource` has no `press`/`release`/`onRelease` methods yet.

**Step 4: Implement `FakeInputSource`**

Replace `test/fakes/FakeInputSource.ts`:

```ts
import type { InputListener, InputSource } from '../../src/ports/InputSource';

/** An `InputSource` double that lets a test simulate press/release manually. */
export class FakeInputSource implements InputSource {
  private pressListeners: InputListener[] = [];
  private releaseListeners: InputListener[] = [];

  onPress(listener: InputListener): () => void {
    this.pressListeners.push(listener);
    return () => {
      this.pressListeners = this.pressListeners.filter((registered) => registered !== listener);
    };
  }

  onRelease(listener: InputListener): () => void {
    this.releaseListeners.push(listener);
    return () => {
      this.releaseListeners = this.releaseListeners.filter((registered) => registered !== listener);
    };
  }

  /** Simulate pressing `id` — notifies every currently-registered press listener. */
  press(id: string): void {
    for (const listener of this.pressListeners) {
      listener(id);
    }
  }

  /** Simulate releasing `id` — notifies every currently-registered release listener. */
  release(id: string): void {
    for (const listener of this.releaseListeners) {
      listener(id);
    }
  }
}
```

**Step 5: Run the test to verify it passes**

Run: `npx vitest run test/fakes/FakeInputSource.test.ts`
Expected: PASS (6 tests)

**Step 6: Rewrite `DomInputSource` tests to the new shape (will fail)**

Replace `src/adapters/web/input/DomInputSource.test.ts`:

```ts
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
```

**Step 7: Run the test to verify it fails**

Run: `npx vitest run src/adapters/web/input/DomInputSource.test.ts`
Expected: FAIL — `onPress`/`onRelease` don't exist yet.

**Step 8: Implement `DomInputSource`**

Replace `src/adapters/web/input/DomInputSource.ts`:

```ts
import type { InputListener, InputSource } from '../../../ports/InputSource';

/** The subset of `EventTarget`'s listener API this adapter needs — lets tests inject `window`, `document`, or a fake. */
export interface EventListenerTarget {
  addEventListener: typeof window.addEventListener;
  removeEventListener: typeof window.removeEventListener;
}

/**
 * An `InputSource` backed by real DOM events. Any key or pointer press/release
 * counts as a press/release, identified by `event.code` (keyboard) or
 * `pointer:<pointerId>` (pointer).
 */
export class DomInputSource implements InputSource {
  private pressListeners: InputListener[] = [];
  private releaseListeners: InputListener[] = [];
  private readonly target: EventListenerTarget;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.press(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.release(event.code);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.press(`pointer:${event.pointerId}`);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.release(`pointer:${event.pointerId}`);
  };

  constructor(target: EventListenerTarget) {
    this.target = target;
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('pointerdown', this.handlePointerDown);
    this.target.addEventListener('pointerup', this.handlePointerUp);
  }

  onPress(listener: InputListener): () => void {
    this.pressListeners.push(listener);
    return () => {
      this.pressListeners = this.pressListeners.filter((registered) => registered !== listener);
    };
  }

  onRelease(listener: InputListener): () => void {
    this.releaseListeners.push(listener);
    return () => {
      this.releaseListeners = this.releaseListeners.filter((registered) => registered !== listener);
    };
  }

  /** Beyond the bare `InputSource` port: detaches the underlying DOM listeners entirely (e.g. when leaving the game screen). */
  destroy(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('pointerdown', this.handlePointerDown);
    this.target.removeEventListener('pointerup', this.handlePointerUp);
  }

  private press(id: string): void {
    for (const listener of this.pressListeners) {
      listener(id);
    }
  }

  private release(id: string): void {
    for (const listener of this.releaseListeners) {
      listener(id);
    }
  }
}
```

**Step 9: Run the test to verify it passes**

Run: `npx vitest run src/adapters/web/input/DomInputSource.test.ts`
Expected: PASS (7 tests)

**Step 10: Commit**

```bash
git add src/ports/InputSource.ts test/fakes/FakeInputSource.ts test/fakes/FakeInputSource.test.ts src/adapters/web/input/DomInputSource.ts src/adapters/web/input/DomInputSource.test.ts
git commit -m "refactor: split InputSource onTrigger into onPress/onRelease"
```

---

### Task 2: Fix the reported bug — ignore OS key auto-repeat

**Files:**
- Modify: `src/adapters/web/input/DomInputSource.ts`
- Modify: `src/adapters/web/input/DomInputSource.test.ts`

**Step 1: Write the failing test**

Add to the `describe('DomInputSource', ...)` block in `DomInputSource.test.ts`:

```ts
  it('ignores OS auto-repeat keydown events — a held key presses once, not repeatedly', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    const pressed: string[] = [];
    input.onPress((id) => pressed.push(id));

    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', repeat: true }));
    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', repeat: true }));
    expect(pressed).toEqual(['KeyA']);
  });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/adapters/web/input/DomInputSource.test.ts`
Expected: FAIL — currently fires 3 presses.

**Step 3: Implement the fix**

In `DomInputSource.ts`, change `handleKeyDown`:

```ts
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    this.press(event.code);
  };
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/adapters/web/input/DomInputSource.test.ts`
Expected: PASS (8 tests)

**Step 5: Commit**

```bash
git add src/adapters/web/input/DomInputSource.ts src/adapters/web/input/DomInputSource.test.ts
git commit -m "fix: ignore OS key auto-repeat so holding a key doesn't spam-trigger notes"
```

---

### Task 3: Robustness — `pointercancel` and window `blur` also release

**Files:**
- Modify: `src/adapters/web/input/DomInputSource.ts`
- Modify: `src/adapters/web/input/DomInputSource.test.ts`

**Step 1: Write the failing tests**

Add to `DomInputSource.test.ts`:

```ts
  it('treats pointercancel as a release', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    const released: string[] = [];
    input.onRelease((id) => released.push(id));

    target.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3 }));
    target.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 3 }));
    expect(released).toEqual(['pointer:3']);
  });

  it('releases every still-pressed id on blur (focus lost while a key is held)', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    const released: string[] = [];
    input.onRelease((id) => released.push(id));

    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    target.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1 }));
    target.dispatchEvent(new Event('blur'));

    expect(released.slice().sort()).toEqual(['KeyA', 'pointer:1'].sort());
  });

  it('does not re-release an id that already released before blur', () => {
    const target = document.createElement('div');
    const input = new DomInputSource(target);
    const released: string[] = [];
    input.onRelease((id) => released.push(id));

    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    target.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    target.dispatchEvent(new Event('blur'));

    expect(released).toEqual(['KeyA']);
  });
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/adapters/web/input/DomInputSource.test.ts`
Expected: FAIL — no `pointercancel`/`blur` handling yet.

**Step 3: Implement**

Replace `DomInputSource.ts` with:

```ts
import type { InputListener, InputSource } from '../../../ports/InputSource';

/** The subset of `EventTarget`'s listener API this adapter needs — lets tests inject `window`, `document`, or a fake. */
export interface EventListenerTarget {
  addEventListener: typeof window.addEventListener;
  removeEventListener: typeof window.removeEventListener;
}

/**
 * An `InputSource` backed by real DOM events. Any key or pointer press/release
 * counts as a press/release, identified by `event.code` (keyboard) or
 * `pointer:<pointerId>` (pointer). OS key auto-repeat is filtered out — a held
 * key fires one press, not a stream of them. On window blur (e.g. alt-tab),
 * every id still tracked as pressed is force-released, since the browser
 * doesn't reliably send `keyup`/`pointerup` for something still physically
 * held when focus is lost.
 */
export class DomInputSource implements InputSource {
  private pressListeners: InputListener[] = [];
  private releaseListeners: InputListener[] = [];
  private readonly pressedIds = new Set<string>();
  private readonly target: EventListenerTarget;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    this.press(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.release(event.code);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.press(`pointer:${event.pointerId}`);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.release(`pointer:${event.pointerId}`);
  };

  private readonly handleBlur = (): void => {
    for (const id of Array.from(this.pressedIds)) {
      this.release(id);
    }
  };

  constructor(target: EventListenerTarget) {
    this.target = target;
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('pointerdown', this.handlePointerDown);
    this.target.addEventListener('pointerup', this.handlePointerUp);
    this.target.addEventListener('pointercancel', this.handlePointerUp);
    this.target.addEventListener('blur', this.handleBlur);
  }

  onPress(listener: InputListener): () => void {
    this.pressListeners.push(listener);
    return () => {
      this.pressListeners = this.pressListeners.filter((registered) => registered !== listener);
    };
  }

  onRelease(listener: InputListener): () => void {
    this.releaseListeners.push(listener);
    return () => {
      this.releaseListeners = this.releaseListeners.filter((registered) => registered !== listener);
    };
  }

  /** Beyond the bare `InputSource` port: detaches the underlying DOM listeners entirely (e.g. when leaving the game screen). */
  destroy(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('pointerdown', this.handlePointerDown);
    this.target.removeEventListener('pointerup', this.handlePointerUp);
    this.target.removeEventListener('pointercancel', this.handlePointerUp);
    this.target.removeEventListener('blur', this.handleBlur);
  }

  private press(id: string): void {
    this.pressedIds.add(id);
    for (const listener of this.pressListeners) {
      listener(id);
    }
  }

  private release(id: string): void {
    if (!this.pressedIds.delete(id)) return;
    for (const listener of this.releaseListeners) {
      listener(id);
    }
  }
}
```

Note this also changes `destroy()`'s test expectation slightly (it now also detaches `pointercancel`/`blur`) — the existing `destroy()` test only dispatches `keydown`/`pointerdown` so it's unaffected.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/adapters/web/input/DomInputSource.test.ts`
Expected: PASS (11 tests)

**Step 5: Commit**

```bash
git add src/adapters/web/input/DomInputSource.ts src/adapters/web/input/DomInputSource.test.ts
git commit -m "fix: release held keys/pointers on pointercancel and window blur"
```

---

### Task 4: `AudioEngine` — `noteOn` returns a `NoteHandle` instead of `noteOff(midi)`

**Files:**
- Modify: `src/ports/AudioEngine.ts`
- Modify: `test/fakes/FakeAudioEngine.ts`
- Modify: `test/fakes/FakeAudioEngine.test.ts`
- Modify: `src/adapters/web/audio/WebAudioEngine.ts`
- Modify: `src/adapters/web/audio/WebAudioEngine.test.ts`
- Modify: `src/main.ts:120` (preview loop — ignores the returned handle, no behavior change)

**Step 1: Update the port**

Replace `src/ports/AudioEngine.ts`:

```ts
import type { MidiNote, Velocity } from '../domain/types';

/** A single sounding voice started by `noteOn` — release it to stop that exact voice, and only that one. */
export interface NoteHandle {
  release(): void;
}

/**
 * Plays and stops sampled piano notes. Implementations own how a MIDI note
 * number becomes an actual sound (recorded sample + pitch-shift, synthesis,
 * native audio, etc). The domain only ever calls this by MIDI note + velocity —
 * it never knows whether the sound comes from Web Audio, native audio, or
 * anything else.
 */
export interface AudioEngine {
  /** Load/prepare whatever samples the engine needs before notes can play. */
  init(): Promise<void>;
  /**
   * Start sounding a note. Calling noteOn for an already-sounding note
   * retriggers it. Returns a handle to release this exact voice — release it
   * to stop the note early; leave it alone to let the sample decay naturally.
   */
  noteOn(midi: MidiNote, velocity: Velocity): NoteHandle;
}
```

**Step 2: Rewrite `FakeAudioEngine` tests (will fail — old API is gone)**

Replace `test/fakes/FakeAudioEngine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FakeAudioEngine } from './FakeAudioEngine';

describe('FakeAudioEngine', () => {
  it('records each noteOn call in order', () => {
    const engine = new FakeAudioEngine();
    engine.noteOn(60, 100);
    engine.noteOn(64, 90);

    expect(engine.notesOn).toEqual([
      { midi: 60, velocity: 100 },
      { midi: 64, velocity: 90 },
    ]);
  });

  it('records a noteOff when the returned handle is released', () => {
    const engine = new FakeAudioEngine();
    const handle = engine.noteOn(60, 100);

    expect(engine.notesOff).toEqual([]);
    handle.release();
    expect(engine.notesOff).toEqual([60]);
  });

  it('records releases independently per handle', () => {
    const engine = new FakeAudioEngine();
    const a = engine.noteOn(60, 100);
    const b = engine.noteOn(64, 90);

    b.release();
    a.release();
    expect(engine.notesOff).toEqual([64, 60]);
  });

  it('marks itself initialized after init() resolves', async () => {
    const engine = new FakeAudioEngine();
    expect(engine.initCalled).toBe(false);

    await engine.init();
    expect(engine.initCalled).toBe(true);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run test/fakes/FakeAudioEngine.test.ts`
Expected: FAIL — `noteOn` still returns `void`, no `release()` handle.

**Step 4: Implement `FakeAudioEngine`**

Replace `test/fakes/FakeAudioEngine.ts`:

```ts
import type { AudioEngine, NoteHandle } from '../../src/ports/AudioEngine';
import type { MidiNote, Velocity } from '../../src/domain/types';

export interface RecordedNoteOn {
  readonly midi: MidiNote;
  readonly velocity: Velocity;
}

/** An `AudioEngine` double that plays nothing but records what it was told to do. */
export class FakeAudioEngine implements AudioEngine {
  readonly notesOn: RecordedNoteOn[] = [];
  readonly notesOff: MidiNote[] = [];
  initCalled = false;

  async init(): Promise<void> {
    this.initCalled = true;
  }

  noteOn(midi: MidiNote, velocity: Velocity): NoteHandle {
    this.notesOn.push({ midi, velocity });
    return {
      release: () => {
        this.notesOff.push(midi);
      },
    };
  }
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run test/fakes/FakeAudioEngine.test.ts`
Expected: PASS (4 tests)

**Step 6: Rewrite the `WebAudioEngine.noteOff` describe block (will fail)**

In `src/adapters/web/audio/WebAudioEngine.test.ts`, replace the whole `describe('WebAudioEngine.noteOff', ...)` block (lines 151-181) with:

```ts
describe('WebAudioEngine handle.release()', () => {
  it('ramps gain down and stops the tracked source', () => {
    const { context, engine } = buildEngine([60]);
    context.currentTime = 5;

    const handle = engine.noteOn(60, 100);
    const source = context.createdSources[0]!;
    const gainNode = context.createdGains[0]!;

    handle.release();

    expect(gainNode.gain.linearRampToValueAtTimeCalls).toEqual([{ value: 0, time: 5.03 }]);
    expect(source.stopCalls).toEqual([5.03]);
  });

  it('does not stop the source again on a second release() call', () => {
    const { context, engine } = buildEngine([60]);
    const handle = engine.noteOn(60, 100);
    const source = context.createdSources[0]!;

    handle.release();
    handle.release();

    expect(source.stopCalls).toHaveLength(1);
  });
});
```

**Step 7: Run test to verify it fails**

Run: `npx vitest run src/adapters/web/audio/WebAudioEngine.test.ts`
Expected: FAIL — `noteOn` returns `void`, `.release` doesn't exist on it.

**Step 8: Implement `WebAudioEngine`**

Replace `src/adapters/web/audio/WebAudioEngine.ts`:

```ts
import type { AudioEngine, NoteHandle } from '../../../ports/AudioEngine';
import type { MidiNote, Velocity } from '../../../domain/types';
import { findNearestSample, gainFor, playbackRateFor } from './sampleSelection';

/** Duration (seconds) of the linear gain fade-out applied before a source is stopped, to avoid a click. */
const RELEASE_SECONDS = 0.03;

interface ActiveNote {
  readonly source: AudioBufferSourceNode;
  readonly gainNode: GainNode;
}

/**
 * `AudioEngine` implementation using the raw Web Audio API: decoded samples are
 * pitch-shifted via playback rate to cover notes that have no recorded sample.
 * Takes the context and samples as constructor arguments (rather than building
 * them itself) so this class stays trivially testable with fakes.
 */
export class WebAudioEngine implements AudioEngine {
  private readonly active = new Map<MidiNote, ActiveNote>();

  constructor(
    private readonly context: BaseAudioContext,
    private readonly samples: ReadonlyMap<MidiNote, AudioBuffer>,
  ) {}

  /** Loading/decoding audio files is out of scope for this adapter — the caller populates `samples` up front. */
  async init(): Promise<void> {
    if (this.samples.size === 0) {
      throw new Error('WebAudioEngine requires at least one decoded sample to be provided');
    }
  }

  noteOn(midi: MidiNote, velocity: Velocity): NoteHandle {
    // Retrigger: stop anything already sounding for this note before starting the new one.
    this.stopActive(midi);

    const sampleMidi = findNearestSample(midi, Array.from(this.samples.keys()));
    const buffer = this.samples.get(sampleMidi)!;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRateFor(midi, sampleMidi);

    const gainNode = this.context.createGain();
    gainNode.gain.value = gainFor(velocity);

    source.connect(gainNode);
    gainNode.connect(this.context.destination);
    source.start();

    const voice: ActiveNote = { source, gainNode };
    this.active.set(midi, voice);

    return {
      release: () => this.stopActive(midi),
    };
  }

  private stopActive(midi: MidiNote): void {
    const note = this.active.get(midi);
    if (!note) return;

    const now = this.context.currentTime;
    note.gainNode.gain.cancelScheduledValues(now);
    note.gainNode.gain.setValueAtTime(note.gainNode.gain.value, now);
    note.gainNode.gain.linearRampToValueAtTime(0, now + RELEASE_SECONDS);
    note.source.stop(now + RELEASE_SECONDS);

    this.active.delete(midi);
  }
}
```

**Step 9: Run test to verify it passes**

Run: `npx vitest run src/adapters/web/audio/WebAudioEngine.test.ts`
Expected: PASS

**Step 10: Fix the one remaining call site that only used the return type implicitly**

`src/main.ts:120` (`previewAudio.noteOn(note.midi, note.velocity)`) needs no code change — ignoring a returned handle is valid — but run a typecheck to confirm nothing else references the removed `noteOff`:

Run: `npx tsc --noEmit`
Expected: no errors.

**Step 11: Commit**

```bash
git add src/ports/AudioEngine.ts test/fakes/FakeAudioEngine.ts test/fakes/FakeAudioEngine.test.ts src/adapters/web/audio/WebAudioEngine.ts src/adapters/web/audio/WebAudioEngine.test.ts
git commit -m "refactor: AudioEngine.noteOn returns a release handle instead of noteOff(midi)"
```

---

### Task 5: Fix the same-pitch overlap bug (a handle only releases its own voice)

**Files:**
- Modify: `src/adapters/web/audio/WebAudioEngine.ts`
- Modify: `src/adapters/web/audio/WebAudioEngine.test.ts`

This is the correctness fix the design calls out: if pitch 60 is held, then retriggered by another press before the first is released, the first press's later `release()` must not touch the second (current) voice.

**Step 1: Write the failing test**

Add to the `describe('WebAudioEngine handle.release()', ...)` block:

```ts
  it('is a no-op if the voice was already replaced by a retrigger of the same pitch', () => {
    const { context, engine } = buildEngine([60]);

    const firstHandle = engine.noteOn(60, 100);
    const firstSource = context.createdSources[0]!;
    engine.noteOn(60, 100); // retriggers — stops firstSource, starts a second voice
    const secondSource = context.createdSources[1]!;

    firstHandle.release();

    expect(firstSource.stopCalls).toHaveLength(1); // only the retrigger's stop — release() added nothing
    expect(secondSource.stopCalls).toEqual([]); // and definitely didn't touch the new voice
  });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/adapters/web/audio/WebAudioEngine.test.ts`
Expected: FAIL — today `release()` always calls `stopActive(midi)`, which would stop `secondSource` since it's now the tracked voice for pitch 60.

**Step 3: Implement the fix**

In `WebAudioEngine.ts`, change the `noteOn` return statement:

```ts
    return {
      release: () => {
        if (this.active.get(midi) !== voice) return; // already retriggered — nothing to release
        this.stopActive(midi);
      },
    };
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/adapters/web/audio/WebAudioEngine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/web/audio/WebAudioEngine.ts src/adapters/web/audio/WebAudioEngine.test.ts
git commit -m "fix: a note handle only releases its own voice, never a same-pitch retrigger"
```

---

### Task 6: Wire it up in `main.ts` — hold to sustain, release to fade

**Files:**
- Modify: `src/main.ts:185-196` (gameplay trigger handler) and the `onMainMenu` pause-menu handler around line 213.

No dedicated unit test exists for `main.ts` (it's the composition root) — verify with a full test run, a typecheck, and a manual playtest.

**Step 1: Replace the trigger wiring**

In `src/main.ts`, replace:

```ts
    const unsubscribe = input.onTrigger(() => {
      if (paused) return;
      if (audioCtx.state === 'suspended') void audioCtx.resume();

      const notes = pieceEngine.trigger();
      for (const note of notes) {
        audioEngine.noteOn(note.midi, note.velocity);
        renderer.spawnNoteVisual(note.midi, piece.colorTheme);
      }
      overlay.setProgress(pieceEngine.currentChordIndex, piece.chords.length);
      refreshUpcoming(true);
    });
```

with:

```ts
    // Notes currently sounding because a press hasn't released yet, keyed by the press id
    // (physical key code or `pointer:<id>`) that started them — see docs/plans/2026-09-14-key-hold-note-sustain-design.md.
    const heldNotes = new Map<string, NoteHandle[]>();

    function releaseAllHeldNotes(): void {
      for (const handles of heldNotes.values()) {
        for (const handle of handles) handle.release();
      }
      heldNotes.clear();
    }

    const unsubscribePress = input.onPress((id) => {
      if (paused) return;
      if (audioCtx.state === 'suspended') void audioCtx.resume();

      const notes = pieceEngine.trigger();
      const handles: NoteHandle[] = [];
      for (const note of notes) {
        handles.push(audioEngine.noteOn(note.midi, note.velocity));
        renderer.spawnNoteVisual(note.midi, piece.colorTheme);
      }
      heldNotes.set(id, handles);
      overlay.setProgress(pieceEngine.currentChordIndex, piece.chords.length);
      refreshUpcoming(true);
    });

    const unsubscribeRelease = input.onRelease((id) => {
      const handles = heldNotes.get(id);
      if (!handles) return;
      for (const handle of handles) handle.release();
      heldNotes.delete(id);
    });
```

Add the import at the top of the file, next to the other `WebAudioEngine` import:

```ts
import type { NoteHandle } from './ports/AudioEngine';
```

**Step 2: Release everything held when the game pauses, and unsubscribe both listeners on exit**

Replace:

```ts
    const overlay = renderGameOverlay(gameContainer, {
      onPause(): void {
        if (paused) return;
        paused = true;
        pauseHandle = renderPauseMenu(gameContainer, {
```

with:

```ts
    const overlay = renderGameOverlay(gameContainer, {
      onPause(): void {
        if (paused) return;
        paused = true;
        releaseAllHeldNotes();
        pauseHandle = renderPauseMenu(gameContainer, {
```

And replace the `onMainMenu` handler:

```ts
          onMainMenu(): void {
            pauseHandle?.destroy();
            unsubscribe();
            input.destroy();
            overlay.destroy();
            showMainMenu();
          },
```

with:

```ts
          onMainMenu(): void {
            pauseHandle?.destroy();
            unsubscribePress();
            unsubscribeRelease();
            input.destroy();
            overlay.destroy();
            showMainMenu();
          },
```

**Step 3: Typecheck and run the full test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: all tests PASS.

**Step 4: Manual playtest**

Run: `npm run dev`, open the app, start a piece, and check:
- Tapping a key quickly still plays a short note (fade, no click).
- Holding a key down lets the note ring out its natural sample decay instead of cutting off or spamming other notes.
- Holding a key no longer floods the piece forward via OS auto-repeat.
- Pausing mid-hold stops the sustained note instead of leaving it ringing behind the menu.

**Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat: hold a key to sustain a note, release to fade it out"
```

---

### Task 7: Update the design doc's blast-radius note (optional, if anything drifted)

If any of the above deviated from `docs/plans/2026-09-14-key-hold-note-sustain-design.md` while implementing, amend that file to match reality and commit:

```bash
git add docs/plans/2026-09-14-key-hold-note-sustain-design.md
git commit -m "docs: reconcile design doc with final implementation"
```
