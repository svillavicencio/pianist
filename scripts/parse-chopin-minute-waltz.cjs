const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MIDI_PATH = path.resolve(
  __dirname,
  "../public/midi/chopin_minute_waltz_op64_no1.mid",
);
const OUTPUT_PATH = path.resolve(
  __dirname,
  "../src/content/pieces/chopinMinuteWaltz.ts",
);
const EXPECTED_SHA256 =
  "137882646e225b14a6f58328d3b6b380efec50322d2780a454a2138ebeafc4ce";
const SELECTED_TRACKS = [1];
const SELECTED_CHANNELS = [0];
const buf = fs.readFileSync(MIDI_PATH);
const hash = crypto.createHash("sha256").update(buf).digest("hex");
if (hash !== EXPECTED_SHA256) throw new Error(`source hash mismatch: ${hash}`);
let pos = 0;
const u8 = () => buf[pos++];
const u16 = () => {
  const value = buf.readUInt16BE(pos);
  pos += 2;
  return value;
};
const u32 = () => {
  const value = buf.readUInt32BE(pos);
  pos += 4;
  return value;
};
const bytes = (length) => {
  const value = buf.subarray(pos, pos + length);
  pos += length;
  return value;
};
function vlq() {
  let value = 0;
  let byte;
  do {
    byte = u8();
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);
  return value;
}
if (bytes(4).toString("ascii") !== "MThd") throw new Error("not a MIDI file");
const headerLength = u32();
const format = u16();
const trackCount = u16();
const division = u16();
if (headerLength !== 6 || format !== 1 || trackCount !== 8 || division !== 192)
  throw new Error(
    `source profile mismatch: format=${format} tracks=${trackCount} ppq=${division}`,
  );
const tracks = [];
for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
  if (bytes(4).toString("ascii") !== "MTrk")
    throw new Error(`expected MTrk at track ${trackIndex}`);
  const length = u32();
  const end = pos + length;
  let tick = 0;
  let running = null;
  const events = [];
  while (pos < end) {
    tick += vlq();
    let status = u8();
    if (status & 0x80) running = status;
    else {
      pos--;
      status = running;
    }
    if (status === 0xff) {
      const type = u8();
      const data = bytes(vlq());
      if (type === 0x51 && data.length === 3)
        events.push({
          tick,
          type: "tempo",
          usPerQuarter: data.readUIntBE(0, 3),
        });
    } else if (status === 0xf0 || status === 0xf7) bytes(vlq());
    else {
      const kind = status & 0xf0;
      const channel = status & 0x0f;
      if (kind === 0x90 || kind === 0x80) {
        const note = u8();
        const velocity = u8();
        if (kind === 0x90 && velocity)
          events.push({ tick, type: "noteOn", note, velocity, channel });
        else events.push({ tick, type: "noteOff", note, channel });
      } else if (kind === 0xa0 || kind === 0xb0 || kind === 0xe0) bytes(2);
      else if (kind === 0xc0 || kind === 0xd0) bytes(1);
      else throw new Error(`unknown MIDI status 0x${status.toString(16)}`);
    }
  }
  if (pos !== end) throw new Error(`track ${trackIndex} length mismatch`);
  tracks.push(events);
}
const tempoEvents = tracks
  .flat()
  .filter((event) => event.type === "tempo")
  .sort((a, b) => a.tick - b.tick);
if (
  tempoEvents.length !== 1 ||
  tempoEvents[0].tick !== 0 ||
  tempoEvents[0].usPerQuarter !== 521739
)
  throw new Error(`tempo profile mismatch: ${JSON.stringify(tempoEvents)}`);
const trackSummaries = tracks.map((events, trackIndex) => {
  const noteOns = events.filter((event) => event.type === "noteOn");
  return {
    trackIndex,
    noteOns: noteOns.length,
    channels: [...new Set(noteOns.map((event) => event.channel))].sort(
      (a, b) => a - b,
    ),
    firstTick: noteOns[0]?.tick ?? null,
    lastTick: noteOns.at(-1)?.tick ?? null,
  };
});
const expectedTrackSummaries = [
  [0, [], null, null],
  [1465, [0], 768, 38723],
  [0, [], null, null],
  [0, [], null, null],
  [0, [], null, null],
  [0, [], null, null],
  [0, [], null, null],
  [0, [], null, null],
];
if (
  trackSummaries.some(
    (summary, index) =>
      JSON.stringify([
        summary.noteOns,
        summary.channels,
        summary.firstTick,
        summary.lastTick,
      ]) !== JSON.stringify(expectedTrackSummaries[index]),
  )
)
  throw new Error(
    `per-track profile mismatch: ${JSON.stringify(trackSummaries)}`,
  );
function tickToMs(tick) {
  return (tick * tempoEvents[0].usPerQuarter) / division / 1000;
}
const selectedEvents = tracks.flatMap((events, trackIndex) =>
  events.filter(
    (event) =>
      SELECTED_TRACKS.includes(trackIndex) &&
      SELECTED_CHANNELS.includes(event.channel),
  ),
);
const openByKey = new Map();
const holdDurationMsByNoteOn = new Map();
for (const event of selectedEvents) {
  const key = `${event.channel}:${event.note}`;
  if (event.type === "noteOn") {
    if (!openByKey.has(key)) openByKey.set(key, []);
    openByKey.get(key).push(event);
  } else if (event.type === "noteOff") {
    const queue = openByKey.get(key);
    const openEvent = queue?.shift();
    if (openEvent)
      holdDurationMsByNoteOn.set(
        openEvent,
        Math.round(tickToMs(event.tick) - tickToMs(openEvent.tick)),
      );
  }
}
const noteOns = selectedEvents.filter((event) => event.type === "noteOn");
if (noteOns.length !== 1465)
  throw new Error(`selected note count mismatch: ${noteOns.length}`);
const byTick = new Map();
let collisions = 0;
for (const event of noteOns) {
  if (!byTick.has(event.tick)) byTick.set(event.tick, new Map());
  const pitches = byTick.get(event.tick);
  const holdDurationMs = holdDurationMsByNoteOn.get(event);
  if (pitches.has(event.note)) {
    collisions++;
    pitches.set(event.note, {
      velocity: Math.max(pitches.get(event.note).velocity, event.velocity),
      holdDurationMs,
    });
  } else pitches.set(event.note, { velocity: event.velocity, holdDurationMs });
}
const rawEvents = [...byTick.entries()]
  .sort(([a], [b]) => a - b)
  .map(([tick, pitches]) => [
    Math.round(tickToMs(tick)),
    [...pitches.entries()]
      .sort(([a], [b]) => a - b)
      .map(([midi, { velocity, holdDurationMs }]) => [midi, velocity, holdDurationMs]),
  ]);
const velocities = new Set(noteOns.map((event) => event.velocity));
const maxSimultaneity = Math.max(...rawEvents.map(([, notes]) => notes.length));
if (
  rawEvents.length !== 1217 ||
  collisions !== 0 ||
  velocities.size !== 44 ||
  maxSimultaneity !== 4 ||
  JSON.stringify(rawEvents[0]) !== JSON.stringify([2087, [[68, 32, 310]]]) ||
  JSON.stringify(rawEvents.at(-1)) !== JSON.stringify([105226, [[85, 52, 125]]])
)
  throw new Error("derived source profile mismatch");
for (const summary of trackSummaries)
  console.log(
    `Track ${summary.trackIndex}: noteOns=${summary.noteOns} channels=${summary.channels.join(",") || "-"} firstTick=${summary.firstTick ?? "-"} lastTick=${summary.lastTick ?? "-"}`,
  );
console.log(
  `Profile: format=${format} tracks=${trackCount} ppq=${division} tempos=${tempoEvents.length}`,
);
console.log(
  `Selected: tracks=${SELECTED_TRACKS.join(",")} channels=${SELECTED_CHANNELS.join(",")} noteOns=${noteOns.length} chords=${rawEvents.length} collisions=${collisions} velocities=${velocities.size} maxSimultaneity=${maxSimultaneity}`,
);
console.log("Opening event:", JSON.stringify(rawEvents[0]));
console.log("Final event:", JSON.stringify(rawEvents.at(-1)));
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
const generatedModule = `import type { Chord, Piece } from "../../domain/types";\n\n/** Frédéric Chopin: Minute Waltz Op. 64 No. 1, from Ignaz Friedman's Duo-Art piano-roll-derived performance MIDI published by Kunst der Fuge. The source is personal/non-commercial only and not redistributable. */\n${formatRawEvents(rawEvents)}const chords: readonly Chord[] = RAW_EVENTS.map(\n  ([originalTimeMs, notes], index) => {\n    const next = RAW_EVENTS[index + 1];\n    return {\n      originalTimeMs,\n      screenDurationMs: next ? next[0] - originalTimeMs : 0,\n      notes: notes.map(([midi, velocity, holdDurationMs]) => ({\n        midi,\n        velocity,\n        holdDurationMs,\n      })),\n    };\n  },\n);\n\nexport const chopinMinuteWaltzPiece: Piece = {\n  dataName: "chopin_minute_waltz_op64_no1",\n  displayName: "Minute Waltz Op. 64 No. 1",\n  colorTheme: "amethyst",\n  numScreens: chords.length,\n  chords,\n};\n`;
fs.writeFileSync(OUTPUT_PATH, generatedModule);
