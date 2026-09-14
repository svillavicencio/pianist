const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const filePath = path.resolve(__dirname, "../public/midi/chpn_op23.mid");
const outputPath = path.resolve(
  __dirname,
  "../src/content/pieces/chopinBalladeNo1.ts",
);
const expectedSha256 =
  "8edb6532d13512ea156439d8b07cf8e8292be38a8706617a2bf50165b1a7df03";
const buf = fs.readFileSync(filePath);
const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
if (sha256 !== expectedSha256)
  throw new Error(
    `SHA-256 mismatch: expected ${expectedSha256}, got ${sha256}`,
  );
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

if (bytes(4).toString("ascii") !== "MThd" || u32() !== 6)
  throw new Error("invalid MIDI header");
const format = u16();
const trackCount = u16();
const division = u16();
if (format !== 1 || trackCount !== 8 || division !== 480)
  throw new Error(
    `unexpected MIDI header: format=${format} tracks=${trackCount} division=${division}`,
  );
const tracks = [];
for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
  if (bytes(4).toString("ascii") !== "MTrk")
    throw new Error(`missing track ${trackIndex}`);
  const trackLength = u32();
  const end = pos + trackLength;
  let tick = 0;
  let running = null;
  const events = [];
  while (pos < end) {
    tick += vlq();
    let status = buf[pos];
    if (status & 0x80) {
      pos++;
      running = status;
    } else status = running;
    if (status === 0xff) {
      const type = u8();
      const data = bytes(vlq());
      if (type === 0x51 && data.length === 3)
        events.push({
          tick,
          type: "tempo",
          us: (data[0] << 16) | (data[1] << 8) | data[2],
        });
    } else if (status === 0xf0 || status === 0xf7) bytes(vlq());
    else {
      const type = status & 0xf0;
      const channel = status & 0x0f;
      if (type === 0x90 || type === 0x80) {
        const note = u8();
        const velocity = u8();
        if (type === 0x90 && velocity)
          events.push({ tick, type: "noteOn", note, velocity, channel });
      } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) bytes(2);
      else if (type === 0xc0 || type === 0xd0) bytes(1);
      else throw new Error(`unknown status ${status} in track ${trackIndex}`);
    }
  }
  if (pos !== end)
    throw new Error(`track ${trackIndex} length mismatch: ${pos} !== ${end}`);
  console.log(`parsed track ${trackIndex}: end=${end} pos=${pos}`);
  tracks.push(events);
}
const diagnostics = tracks.map((events, index) => ({
  index,
  noteOns: events.filter((e) => e.type === "noteOn").length,
  channels: [
    ...new Set(events.filter((e) => e.type === "noteOn").map((e) => e.channel)),
  ].sort((a, b) => a - b),
}));
console.log("verified SHA-256:", sha256);
console.log(
  `header: format=${format} tracks=${trackCount} division=${division}`,
);
for (const d of diagnostics)
  console.log(
    `track ${d.index}: noteOns=${d.noteOns} channels=${d.channels.join(",") || "none"}`,
  );
const selectedTracks = [1, 2];
if (selectedTracks.some((index) => !tracks[index]))
  throw new Error("selected track missing");
const tempoEvents = tracks[0]
  .filter((e) => e.type === "tempo")
  .sort((a, b) => a.tick - b.tick);
if (tempoEvents.length !== 2961)
  throw new Error(`unexpected tempo event count: ${tempoEvents.length}`);
const segments = [];
let startTick = 0;
let startMs = 0;
let us = 500000;
for (const event of tempoEvents) {
  if (event.tick === 0 && !segments.length) {
    us = event.us;
    continue;
  }
  const msPerTick = us / division / 1000;
  segments.push({ startTick, endTick: event.tick, startMs, msPerTick });
  startMs += (event.tick - startTick) * msPerTick;
  startTick = event.tick;
  us = event.us;
}
segments.push({
  startTick,
  endTick: Infinity,
  startMs,
  msPerTick: us / division / 1000,
});
function tickToMs(tick) {
  let lo = 0;
  let hi = segments.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segments[mid].startTick <= tick) lo = mid;
    else hi = mid - 1;
  }
  const s = segments[lo];
  return s.startMs + (tick - s.startTick) * s.msPerTick;
}
const byTick = new Map();
for (const trackIndex of selectedTracks)
  for (const event of tracks[trackIndex]) {
    if (!byTick.has(event.tick)) byTick.set(event.tick, new Map());
    const pitches = byTick.get(event.tick);
    pitches.set(
      event.note,
      Math.max(pitches.get(event.note) || 0, event.velocity),
    );
  }
const ticks = [...byTick.keys()].sort((a, b) => a - b);
const raw = ticks.map((tick) => [
  Math.round(tickToMs(tick)),
  [...byTick.get(tick).entries()].sort((a, b) => a[0] - b[0]),
]);
const noteCount = raw.reduce((sum, [, notes]) => sum + notes.length, 0);
const velocities = new Set(
  raw.flatMap(([, notes]) => notes.map(([, velocity]) => velocity)),
);
if (
  noteCount !== 5028 ||
  raw.length !== 2571 ||
  velocities.size !== 99 ||
  Math.max(...raw.map(([, notes]) => notes.length)) !== 7
)
  throw new Error("unexpected Ballade source profile");
console.log(
  `selected tracks: ${selectedTracks.join(", ")}; noteOns=${noteCount}; chords=${raw.length}; velocities=${velocities.size}`,
);
console.log("first event:", JSON.stringify(raw[0]));
console.log("final event:", JSON.stringify(raw.at(-1)));
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
const output = `import type { Chord, Piece } from "../../domain/types";\n\n// Generated deterministically by scripts/parse-chopin-ballade-no1.cjs from the verified source MIDI.\n${formatRawEvents(raw)}\nconst chords: readonly Chord[] = RAW_EVENTS.map(\n  ([originalTimeMs, notes], index) => {\n    const next = RAW_EVENTS[index + 1];\n    return {\n      originalTimeMs,\n      screenDurationMs: next ? next[0] - originalTimeMs : 0,\n      notes: notes.map(([midi, velocity]) => ({ midi, velocity })),\n    };\n  },\n);\n\nexport const chopinBalladeNo1Piece: Piece = {\n  dataName: "chopin_ballade_no1_op23",\n  displayName: "Ballade No. 1 in G minor, Op. 23",\n  colorTheme: "amethyst",\n  numScreens: chords.length,\n  chords,\n};\n`;
fs.writeFileSync(outputPath, output);
