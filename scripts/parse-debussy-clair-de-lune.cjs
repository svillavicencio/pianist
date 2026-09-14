const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const midiPath = path.resolve(
  __dirname,
  "../public/midi/debussy_clair_de_lune.mid",
);
const outputPath = path.resolve(
  __dirname,
  "../src/content/pieces/debussyClairDeLune.ts",
);
const EXPECTED_SHA256 =
  "4dee23c00aed6742905a65f374f231d7a827010400146be7577b1df808a927d0";
const SELECTED_TRACKS = [1, 2];
const SELECTED_CHANNELS = [0];
const buf = fs.readFileSync(midiPath);
const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
if (sha256 !== EXPECTED_SHA256)
  throw new Error(`source hash mismatch: ${sha256}`);
let pos = 0;
const u8 = () => buf[pos++];
const u16 = () => {
  const v = buf.readUInt16BE(pos);
  pos += 2;
  return v;
};
const u32 = () => {
  const v = buf.readUInt32BE(pos);
  pos += 4;
  return v;
};
const bytes = (n) => {
  const v = buf.subarray(pos, pos + n);
  pos += n;
  return v;
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
if (headerLength !== 6 || format !== 1 || trackCount !== 7 || division !== 480)
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
          usPerQuarter: (data[0] << 16) | (data[1] << 8) | data[2],
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
      } else if (kind === 0xa0 || kind === 0xb0 || kind === 0xe0) {
        u8();
        u8();
      } else if (kind === 0xc0 || kind === 0xd0) u8();
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
  tempoEvents.length !== 733 ||
  tempoEvents[0]?.tick !== 0 ||
  tempoEvents[0]?.usPerQuarter !== 600000 ||
  tempoEvents.at(-1)?.tick !== 153360 ||
  tempoEvents.at(-1)?.usPerQuarter !== 1212121
)
  throw new Error(`tempo profile mismatch: ${JSON.stringify(tempoEvents)}`);
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
  let low = 0,
    high = segments.length - 1;
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
  [712, [0], 480, 153360],
  [779, [0], 240, 153320],
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
// Musical tracks are selected by note-on evidence; tempo/control-only tracks are excluded.
const selectedTrackIndexes = trackSummaries
  .filter((track) => track.noteOns > 0)
  .map((track) => track.trackIndex);
if (JSON.stringify(selectedTrackIndexes) !== JSON.stringify(SELECTED_TRACKS))
  throw new Error(`selected track profile mismatch: ${selectedTrackIndexes}`);
const selectedTracks = tracks.filter((_, trackIndex) =>
  selectedTrackIndexes.includes(trackIndex),
);
const noteOns = selectedTracks.flatMap((track) =>
  track.filter(
    (event) =>
      event.type === "noteOn" && SELECTED_CHANNELS.includes(event.channel),
  ),
);
const selectedChannels = [
  ...new Set(noteOns.map((event) => event.channel)),
].sort((a, b) => a - b);
if (JSON.stringify(selectedChannels) !== JSON.stringify(SELECTED_CHANNELS))
  throw new Error(`selected channel profile mismatch: ${selectedChannels}`);
const byTick = new Map();
let collisions = 0;
for (const event of noteOns) {
  if (!byTick.has(event.tick)) byTick.set(event.tick, new Map());
  const pitches = byTick.get(event.tick);
  if (pitches.has(event.note)) {
    collisions++;
    pitches.set(event.note, Math.max(pitches.get(event.note), event.velocity));
  } else pitches.set(event.note, event.velocity);
}
const rawEvents = [...byTick.entries()]
  .sort(([a], [b]) => a - b)
  .map(([tick, pitches]) => [
    Math.round(tickToMs(tick)),
    [...pitches.entries()].sort(([a], [b]) => a - b),
  ]);
const sourceNoteOns = noteOns.length;
const maxSimultaneous = Math.max(...rawEvents.map(([, notes]) => notes.length));
const velocities = new Set(noteOns.map((event) => event.velocity));
if (
  sourceNoteOns !== 1491 ||
  rawEvents.length !== 815 ||
  collisions !== 1 ||
  velocities.size !== 58 ||
  maxSimultaneous !== 7 ||
  JSON.stringify(rawEvents[0]) !==
    JSON.stringify([
      300,
      [
        [65, 36],
        [68, 43],
      ],
    ]) ||
  JSON.stringify(rawEvents.at(-1)) !== JSON.stringify([244040, [[92, 34]]])
)
  throw new Error("derived source profile mismatch");
function formatRawEvents(events) {
  const lines = [
    "const RAW_EVENTS: readonly (readonly [",
    "  number,",
    "  readonly (readonly [number, number])[],",
    "])[] = [",
  ];
  for (const [time, notes] of events) {
    if (notes.length === 1) {
      lines.push(`  [${time}, [[${notes[0][0]}, ${notes[0][1]}]]],`);
      continue;
    }
    lines.push("  [", `    ${time},`, "    [");
    for (const [midi, velocity] of notes)
      lines.push(`      [${midi}, ${velocity}],`);
    lines.push("    ],", "  ],");
  }
  lines.push("];", "");
  return lines.join("\n");
}
const generatedModule = `import type { Chord, Piece } from "../../domain/types";\n\n/** Claude Debussy: Clair de lune from Suite bergamasque, L. 75. Generated from Bernd Krueger's piano-midi.de performance MIDI by scripts/parse-debussy-clair-de-lune.cjs. */\n${formatRawEvents(rawEvents)}\nconst chords: readonly Chord[] = RAW_EVENTS.map(\n  ([originalTimeMs, notes], index) => {\n    const next = RAW_EVENTS[index + 1];\n    return {\n      originalTimeMs,\n      screenDurationMs: next ? next[0] - originalTimeMs : 0,\n      notes: notes.map(([midi, velocity]) => ({ midi, velocity })),\n    };\n  },\n);\n\nexport const debussyClairDeLunePiece: Piece = {\n  dataName: "debussy_clair_de_lune",\n  displayName: "Clair de lune",\n  colorTheme: "midnight",\n  numScreens: chords.length,\n  chords,\n};\n`;
fs.writeFileSync(outputPath, generatedModule);
const summary = {
  format,
  trackCount,
  division,
  tempoEvents: tempoEvents.length,
  sourceNoteOns,
  chords: rawEvents.length,
  collisions,
  distinctVelocities: velocities.size,
  maxSimultaneous,
  perTrack: trackSummaries,
  selectedTrackIndexes,
  selectedChannels: [...new Set(noteOns.map((event) => event.channel))].sort(
    (a, b) => a - b,
  ),
  firstEvent: rawEvents[0],
  lastEvent: rawEvents.at(-1),
};
console.log(JSON.stringify(summary, null, 2));
