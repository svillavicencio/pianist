import { describe, expect, it } from "vitest";
import { audioPathFor, resumeAudioContext, guardedTrigger } from "./main";

describe("composition-root audio path", () => {
  it("allows the sampler only through the DEV query override", () => {
    expect(audioPathFor(true, "?audio=sampler")).toBe("sampler");
    expect(audioPathFor(false, "?audio=sampler")).toBe("legacy");
    expect(audioPathFor(true, "?audio=unknown")).toBe("legacy");
  });
});

describe("audio context recovery", () => {
  it("publishes blocked state then recovers on a later gesture", async () => {
    let attempts = 0;
    const states: string[] = [];
    const context = {
      state: "suspended" as AudioContextState,
      resume: async () => {
        attempts++;
        if (attempts === 1) throw new Error("blocked");
      },
    };
    expect(
      await resumeAudioContext(context, (state) => states.push(state)),
    ).toBe(false);
    expect(states).toEqual(["audio-context-blocked"]);
    expect(
      await resumeAudioContext(context, (state) => states.push(state)),
    ).toBe(true);
    expect(states).toEqual(["audio-context-blocked", "ready"]);
  });
});

describe("gesture-gated note triggering", () => {
  it("blocks the trigger while the context is suspended instead of letting noteOn no-op", async () => {
    let attempts = 0;
    let triggered = 0;
    const states: string[] = [];
    const context = {
      state: "suspended" as AudioContextState,
      resume: async () => {
        attempts++;
        if (attempts === 1) throw new Error("blocked");
      },
    };

    guardedTrigger(
      context,
      (state) => states.push(state),
      () => {
        triggered++;
      },
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(triggered).toBe(0);
    expect(states).toEqual(["audio-context-blocked"]);
  });

  it("runs the trigger once the context is ready, without attempting resume", () => {
    let triggered = 0;
    const states: string[] = [];
    const context = {
      state: "running" as AudioContextState,
      resume: async () => {
        throw new Error("resume must not be called while already running");
      },
    };

    guardedTrigger(
      context,
      (state) => states.push(state),
      () => {
        triggered++;
      },
    );

    expect(triggered).toBe(1);
    expect(states).toEqual([]);
  });
});
