const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const filePath = path.resolve(__dirname, "../public/midi/chpn_op66.mid");
const OUTPUT_PATH = path.resolve(
  __dirname,
  "../src/content/pieces/chopinFantaisieImpromptu.ts",
);
const buf = fs.readFileSync(filePath);
const expectedSha256 =
  "4f88281bca1917af6519a842d216308646d67845212e296760764ba0cb3947af";
const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
if (sha256 !== expectedSha256) {
  throw new Error(
    `SHA-256 mismatch for ${path.basename(filePath)}: expected ${expectedSha256}, got ${sha256}`,
  );
}
console.log("verified SHA-256:", sha256);

let pos = 0;

function readUInt32() {
  const v = buf.readUInt32BE(pos);
  pos += 4;
  return v;
}
function readUInt16() {
  const v = buf.readUInt16BE(pos);
  pos += 2;
  return v;
}
function readBytes(n) {
  const v = buf.subarray(pos, pos + n);
  pos += n;
  return v;
}
function readVLQ() {
  let value = 0;
  let byte;
  do {
    byte = buf[pos++];
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);
  return value;
}

// Header chunk
const headerId = readBytes(4).toString("ascii");
if (headerId !== "MThd") throw new Error("not a MIDI file: " + headerId);
const headerLen = readUInt32();
const format = readUInt16();
const numTracks = readUInt16();
const division = readUInt16();
console.log({ headerId, headerLen, format, numTracks, division });

const tracks = [];

for (let t = 0; t < numTracks; t++) {
  const trackId = readBytes(4).toString("ascii");
  if (trackId !== "MTrk")
    throw new Error("expected MTrk, got " + trackId + " at track " + t);
  const trackLen = readUInt32();
  const trackEnd = pos + trackLen;

  let tick = 0;
  let runningStatus = null;
  const events = []; // { tick, type: 'noteOn'|'noteOff'|'setTempo'|'other', ... }

  while (pos < trackEnd) {
    const delta = readVLQ();
    tick += delta;

    let statusByte = buf[pos];
    if (statusByte & 0x80) {
      // new status byte
      pos++;
      runningStatus = statusByte;
    } else {
      // running status - reuse previous
      statusByte = runningStatus;
    }

    if (statusByte === 0xff) {
      // meta event
      const metaType = buf[pos++];
      const len = readVLQ();
      const data = readBytes(len);
      if (metaType === 0x51 && len === 3) {
        const usPerQuarter = (data[0] << 16) | (data[1] << 8) | data[2];
        events.push({ tick, type: "setTempo", usPerQuarter });
      } else if (metaType === 0x2f) {
        events.push({ tick, type: "endOfTrack" });
      }
      // other meta events ignored
    } else if (statusByte === 0xf0 || statusByte === 0xf7) {
      // sysex
      const len = readVLQ();
      readBytes(len);
    } else {
      const type = statusByte & 0xf0;
      const channel = statusByte & 0x0f;
      if (type === 0x80) {
        // note off, 2 data bytes
        const note = buf[pos++];
        const velocity = buf[pos++];
        events.push({ tick, type: "noteOff", note, velocity, channel });
      } else if (type === 0x90) {
        const note = buf[pos++];
        const velocity = buf[pos++];
        if (velocity === 0) {
          events.push({ tick, type: "noteOff", note, velocity, channel });
        } else {
          events.push({ tick, type: "noteOn", note, velocity, channel });
        }
      } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
        // poly aftertouch, controller, pitch bend: 2 data bytes
        pos += 2;
      } else if (type === 0xc0 || type === 0xd0) {
        // program change, channel aftertouch: 1 data byte
        pos += 1;
      } else {
        throw new Error(
          "unknown status byte 0x" +
            statusByte.toString(16) +
            " at track " +
            t +
            " pos " +
            pos,
        );
      }
    }
  }

  if (pos !== trackEnd) {
    console.warn("track", t, "pos mismatch", pos, trackEnd);
    pos = trackEnd;
  }

  tracks.push(events);
}

// Summarize
tracks.forEach((events, i) => {
  const noteOns = events.filter((e) => e.type === "noteOn").length;
  const noteOffs = events.filter((e) => e.type === "noteOff").length;
  const tempos = events.filter((e) => e.type === "setTempo").length;
  console.log(
    `Track ${i}: total=${events.length} noteOn=${noteOns} noteOff=${noteOffs} setTempo=${tempos}`,
  );
});

// Build tempo map from track 0
const tempoEvents = tracks[0]
  .filter((e) => e.type === "setTempo")
  .sort((a, b) => a.tick - b.tick);
console.log("first tempo events:", tempoEvents.slice(0, 5));
console.log("num tempo events:", tempoEvents.length);

// Build function tick -> ms using piecewise segments
function buildTickToMs(tempoEvents, division) {
  // segments: [{startTick, usPerQuarter, startMs}]
  const segments = [];
  let usPerQuarter = 500000; // default
  let startTick = 0;
  let startMs = 0;

  // Ensure sorted unique by tick; if multiple tempo events at tick 0, use last (or accumulate — should just take effect at that tick)
  for (const ev of tempoEvents) {
    if (ev.tick === startTick && segments.length === 0) {
      // tempo change exactly at 0 tick, before any note - just override initial tempo
      usPerQuarter = ev.usPerQuarter;
      continue;
    }
    // close out previous segment up to ev.tick
    const msPerTick = usPerQuarter / division / 1000;
    const deltaTicks = ev.tick - startTick;
    const segMs = deltaTicks * msPerTick;
    segments.push({
      startTick,
      endTick: ev.tick,
      usPerQuarter,
      startMs,
      msPerTick,
    });
    startMs += segMs;
    startTick = ev.tick;
    usPerQuarter = ev.usPerQuarter;
  }
  // final segment to infinity
  segments.push({
    startTick,
    endTick: Infinity,
    usPerQuarter,
    startMs,
    msPerTick: usPerQuarter / division / 1000,
  });

  return function tickToMs(tick) {
    // find segment containing tick
    // linear scan is fine given the way we'll call it (mostly monotonic) but let's binary search for safety
    let lo = 0,
      hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segments[mid].startTick <= tick) lo = mid;
      else hi = mid - 1;
    }
    const seg = segments[lo];
    return seg.startMs + (tick - seg.startTick) * seg.msPerTick;
  };
}

const tickToMs = buildTickToMs(tempoEvents, division);

// Merge note-on/note-off events from tracks 1 and 2, matching each noteOn with its noteOff
// (FIFO per channel:note key) to compute how long the note was actually held.
const selectedEvents = [];
for (const tIdx of [1, 2]) {
  for (const ev of tracks[tIdx]) {
    if (ev.type === "noteOn" || ev.type === "noteOff") selectedEvents.push(ev);
  }
}
const openByKey = new Map();
const holdDurationMsByNoteOn = new Map();
for (const event of selectedEvents) {
  const key = `${event.channel}:${event.note}`;
  if (event.type === "noteOn") {
    if (!openByKey.has(key)) openByKey.set(key, []);
    openByKey.get(key).push(event);
  } else {
    const queue = openByKey.get(key);
    const openEvent = queue?.shift();
    if (openEvent)
      holdDurationMsByNoteOn.set(
        openEvent,
        Math.round(tickToMs(event.tick) - tickToMs(openEvent.tick)),
      );
  }
}

// Merge note-on events from tracks 1 and 2
const allNoteOns = selectedEvents
  .filter((ev) => ev.type === "noteOn")
  .map((ev) => ({
    tick: ev.tick,
    midi: ev.note,
    velocity: ev.velocity,
    holdDurationMs: holdDurationMsByNoteOn.get(ev),
  }));
console.log("total note-on events tracks 1+2:", allNoteOns.length);

// Group by exact tick
const byTick = new Map();
let dedupCount = 0;
for (const n of allNoteOns) {
  if (!byTick.has(n.tick)) byTick.set(n.tick, new Map());
  const pitchMap = byTick.get(n.tick);
  if (pitchMap.has(n.midi)) {
    dedupCount++;
    pitchMap.set(n.midi, {
      velocity: Math.max(pitchMap.get(n.midi).velocity, n.velocity),
      holdDurationMs: n.holdDurationMs,
    });
  } else {
    pitchMap.set(n.midi, { velocity: n.velocity, holdDurationMs: n.holdDurationMs });
  }
}

console.log("unique ticks (chords):", byTick.size);
console.log("dedup collisions (same pitch same tick):", dedupCount);

const sortedTicks = Array.from(byTick.keys()).sort((a, b) => a - b);

const chords = sortedTicks.map((tick) => {
  const pitchMap = byTick.get(tick);
  const notes = Array.from(pitchMap.entries())
    .map(([midi, { velocity, holdDurationMs }]) => ({ midi, velocity, holdDurationMs }))
    .sort((a, b) => a.midi - b.midi);
  return { tick, ms: Math.round(tickToMs(tick)), notes };
});

console.log("total chords:", chords.length);

// densest chord
let maxSize = 0;
for (const c of chords) maxSize = Math.max(maxSize, c.notes.length);
const denseChords = chords.filter((c) => c.notes.length === maxSize);
console.log(
  "max simultaneous notes:",
  maxSize,
  "count of chords with that size:",
  denseChords.length,
);
console.log("sample dense chord:", denseChords[0]);

const singleNoteCount = chords.filter((c) => c.notes.length === 1).length;
console.log(
  "single-note chord count:",
  singleNoteCount,
  "fraction:",
  (singleNoteCount / chords.length).toFixed(4),
);

// velocities set size
const velocities = new Set();
for (const c of chords) for (const n of c.notes) velocities.add(n.velocity);
console.log("distinct velocities:", velocities.size);

console.log("First 10 chords:");
console.log(JSON.stringify(chords.slice(0, 10), null, 0));

console.log("Last 5 chords:");
console.log(JSON.stringify(chords.slice(-5), null, 0));

console.log(
  "done; generated event data is kept in the checked-in piece module",
);

// Additional diagnostics: min tick per track for note-ons, and check for duplicate pitch across same-tick within same track only vs both.
const minTickTrack1 = Math.min(
  ...tracks[1].filter((e) => e.type === "noteOn").map((e) => e.tick),
);
const minTickTrack2 = Math.min(
  ...tracks[2].filter((e) => e.type === "noteOn").map((e) => e.tick),
);
console.log("min noteOn tick track1 (RH):", minTickTrack1);
console.log("min noteOn tick track2 (LH):", minTickTrack2);

const maxTickTrack1 = Math.max(
  ...tracks[1].filter((e) => e.type === "noteOn").map((e) => e.tick),
);
const maxTickTrack2 = Math.max(
  ...tracks[2].filter((e) => e.type === "noteOn").map((e) => e.tick),
);
console.log("max noteOn tick track1 (RH):", maxTickTrack1);
console.log("max noteOn tick track2 (LH):", maxTickTrack2);

// Find chord index around tick 7800 (right hand entrance)
const idx7800 = chords.findIndex((c) => c.tick === 7800);
console.log("chord index for tick 7800:", idx7800);
console.log("context chords around RH entrance:");
console.log(
  JSON.stringify(chords.slice(Math.max(0, idx7800 - 3), idx7800 + 3), null, 0),
);

console.log(
  JSON.stringify(
    {
      sourceSha256: sha256,
      format,
      trackCount: numTracks,
      division,
      tempoEvents: tempoEvents.length,
      sourceNoteOns: allNoteOns.length,
      chords: chords.length,
      collisions: dedupCount,
      distinctVelocities: velocities.size,
      maxSimultaneous: maxSize,
      firstEvent: chords[0],
      lastEvent: chords.at(-1),
    },
    null,
    2,
  ),
);

// Regenerate the checked-in piece module, now carrying real holdDurationMs per note.
const rawEvents = chords.map((c) => [
  c.ms,
  c.notes.map((n) => [n.midi, n.velocity, n.holdDurationMs]),
]);

function formatRawEvents(events) {
  const lines = [
    "const RAW_EVENTS: readonly (readonly [",
    "  number,",
    "  readonly (readonly [number, number, number | undefined])[],",
    "])[] = [",
  ];
  for (const [time, notes] of events) {
    if (notes.length === 1) {
      lines.push(
        `  [${time}, [[${notes[0][0]}, ${notes[0][1]}, ${notes[0][2] ?? "undefined"}]]],`,
      );
      continue;
    }
    lines.push("  [", `    ${time},`, "    [");
    for (const [midi, velocity, holdDurationMs] of notes)
      lines.push(`      [${midi}, ${velocity}, ${holdDurationMs ?? "undefined"}],`);
    lines.push("    ],", "  ],");
  }
  lines.push("];", "");
  return lines.join("\n");
}

const generatedModule = `import type { Chord, Piece } from "../../domain/types";

/** Chopin: Fantaisie-Impromptu in C-sharp minor, Op. 66, from Bernd Krueger's piano-midi.de performance MIDI, published under CC BY-SA 3.0 DE. */
${formatRawEvents(rawEvents)}const chords: readonly Chord[] = RAW_EVENTS.map(
  ([originalTimeMs, notes], index) => {
    const next = RAW_EVENTS[index + 1];
    return {
      originalTimeMs,
      screenDurationMs: next ? next[0] - originalTimeMs : 0,
      notes: notes.map(([midi, velocity, holdDurationMs]) => ({
        midi,
        velocity,
        holdDurationMs,
      })),
    };
  },
);

export const chopinFantaisieImpromptuPiece: Piece = {
  dataName: "chopin_fantaisie_impromptu",
  displayName: "Fantaisie-Impromptu, Op. 66",
  colorTheme: "amethyst",
  numScreens: chords.length,
  chords,
};
`;
fs.writeFileSync(OUTPUT_PATH, generatedModule);
