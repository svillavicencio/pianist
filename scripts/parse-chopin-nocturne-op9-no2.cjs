const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MIDI_PATH = path.resolve(
  __dirname,
  "../public/midi/chopin_nocturne_op9_no2.mid",
);
const OUTPUT_PATH = path.resolve(
  __dirname,
  "../src/content/pieces/chopinNocturneOp9No2.ts",
);
const EXPECTED_SHA256 =
  "2c4adfd66324487ad4a1667c0f7a79c9fe4091477c11da6863e3d7314caf35d3";
const SELECTED_TRACKS = [1, 2];
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
if (headerLength !== 6 || format !== 1 || trackCount !== 5 || division !== 48)
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
      } else if (kind === 0xa0 || kind === 0xb0 || kind === 0xe0) {
        bytes(2);
      } else if (kind === 0xc0 || kind === 0xd0) bytes(1);
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
const segments = [];
let tempo = 500000;
let startTick = 0;
let startMs = 0;
for (const event of tempoEvents) {
  if (event.tick === 0 && segments.length === 0) {
    tempo = event.usPerQuarter;
    continue;
  }
  const msPerTick = tempo / division / 1000;
  segments.push({ startTick, endTick: event.tick, startMs, msPerTick });
  startMs += (event.tick - startTick) * msPerTick;
  startTick = event.tick;
  tempo = event.usPerQuarter;
}
segments.push({
  startTick,
  endTick: Infinity,
  startMs,
  msPerTick: tempo / division / 1000,
});
function tickToMs(tick) {
  let low = 0;
  let high = segments.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (segments[middle].startTick <= tick) low = middle;
    else high = middle - 1;
  }
  const segment = segments[low];
  return segment.startMs + (tick - segment.startTick) * segment.msPerTick;
}

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
  [527, [0], 264, 10362],
  [771, [0], 288, 10362],
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
if (tempoEvents.length !== 536)
  throw new Error(`tempo event count mismatch: ${tempoEvents.length}`);

const selectedEvents = tracks.flatMap((events, trackIndex) =>
  events
    .filter(
      (event) =>
        (event.type === "noteOn" || event.type === "noteOff") &&
        SELECTED_TRACKS.includes(trackIndex) &&
        SELECTED_CHANNELS.includes(event.channel),
    )
    .map((event) => ({ ...event })),
);
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
const noteOns = selectedEvents.filter((event) => event.type === "noteOn");
if (noteOns.length !== 1298)
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
const maxSimultaneous = Math.max(...rawEvents.map(([, notes]) => notes.length));
if (
  rawEvents.length !== 627 ||
  collisions !== 0 ||
  velocities.size !== 69 ||
  maxSimultaneous !== 6 ||
  JSON.stringify(rawEvents[0]) !== JSON.stringify([2750, [[70, 42, 743]]]) ||
  JSON.stringify(rawEvents.at(-1)) !==
    JSON.stringify([
      233810,
      [
        [39, 16, 6827],
        [46, 18, 6827],
        [55, 20, 6827],
        [63, 26, 6827],
      ],
    ])
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
  `Selected: tracks=${SELECTED_TRACKS.join(",")} channels=${SELECTED_CHANNELS.join(",")} noteOns=${noteOns.length} chords=${rawEvents.length} collisions=${collisions} velocities=${velocities.size} maxSimultaneity=${maxSimultaneous}`,
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

const generatedModule = `import type { Chord, Piece } from "../../domain/types";

/** Frédéric Chopin: Nocturne in E-flat major, Op. 9 No. 2, from Daisuke Inoue's performance MIDI published by Kunst der Fuge. The source is personal/non-commercial only and not redistributable. */
${formatRawEvents(rawEvents)}
const chords: readonly Chord[] = RAW_EVENTS.map(
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

export const chopinNocturneOp9No2Piece: Piece = {
  dataName: "chopin_nocturne_op9_no2",
  displayName: "Nocturne Op. 9 No. 2",
  colorTheme: "amethyst",
  numScreens: chords.length,
  chords,
};
`;
fs.writeFileSync(OUTPUT_PATH, generatedModule);
