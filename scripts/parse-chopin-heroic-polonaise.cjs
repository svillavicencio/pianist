const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MIDI_PATH = path.resolve(__dirname, "../public/midi/chpn_op53.mid");
const EXPECTED_SHA256 =
  "df060f39f82178c0ad8b66baa282a872c23c8be25d33129fe9a87d1b31b9be37";
const SELECTED_TRACKS = [1, 2];
const SELECTED_CHANNELS = [0];

const buf = fs.readFileSync(MIDI_PATH);
const hash = crypto.createHash("sha256").update(buf).digest("hex");
if (hash !== EXPECTED_SHA256) throw new Error(`source hash mismatch: ${hash}`);
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
  let value = 0,
    byte;
  do {
    byte = u8();
    value = (value << 7) | (byte & 127);
  } while (byte & 128);
  return value;
}

if (bytes(4).toString("ascii") !== "MThd") throw new Error("not a MIDI file");
const headerLength = u32();
const format = u16();
const trackCount = u16();
const ppq = u16();
if (headerLength !== 6 || format !== 1 || trackCount !== 8 || ppq !== 480)
  throw new Error("source profile mismatch");
const tracks = [];
for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
  if (bytes(4).toString("ascii") !== "MTrk")
    throw new Error(`missing track ${trackIndex}`);
  const trackLength = u32();
  const end = pos + trackLength;
  let tick = 0;
  let running = 0;
  const events = [];
  while (pos < end) {
    tick += vlq();
    let status = buf[pos];
    if (status & 128) {
      status = u8();
      running = status;
    } else status = running;
    if (status === 255) {
      const type = u8();
      const data = bytes(vlq());
      if (type === 81 && data.length === 3)
        events.push({
          tick,
          type: "tempo",
          usPerQuarter: data.readUIntBE(0, 3),
        });
    } else if (status === 240 || status === 247) bytes(vlq());
    else {
      const type = status & 240,
        channel = status & 15;
      const note = u8();
      const value = type === 192 || type === 208 ? undefined : u8();
      if (type === 144 && value)
        events.push({ tick, type: "noteOn", channel, note, velocity: value });
      else if (type === 128 || (type === 144 && value === 0))
        events.push({ tick, type: "noteOff", channel, note });
    }
  }
  pos = end;
  tracks.push(events);
}
const tempos = tracks[0]
  .filter((event) => event.type === "tempo")
  .sort((a, b) => a.tick - b.tick);
function tickToMs(tick) {
  let lastTick = 0,
    ms = 0,
    tempo = 500000;
  for (const event of tempos) {
    if (event.tick > tick) break;
    ms += ((event.tick - lastTick) * tempo) / ppq / 1000;
    lastTick = event.tick;
    tempo = event.usPerQuarter;
  }
  return Math.round(ms + ((tick - lastTick) * tempo) / ppq / 1000);
}

tracks.forEach((events, index) => {
  const notes = events.filter((event) => event.type === "noteOn");
  console.log(
    `Track ${index}: noteOns=${notes.length} channels=${[...new Set(notes.map((event) => event.channel))].join(",") || "-"} firstTick=${notes[0]?.tick ?? "-"} lastTick=${notes.at(-1)?.tick ?? "-"}`,
  );
});
console.log(
  `Profile: format=${format} tracks=${trackCount} ppq=${ppq} tempos=${tempos.length}`,
);
const selectedEvents = tracks.flatMap((events, track) =>
  events
    .filter(
      (event) =>
        (event.type === "noteOn" || event.type === "noteOff") &&
        SELECTED_TRACKS.includes(track) &&
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
if (noteOns.length !== 6052)
  throw new Error(`selected note count mismatch: ${noteOns.length}`);
const byTick = new Map();
let collisions = 0;
for (const event of noteOns) {
  let pitches = byTick.get(event.tick);
  if (!pitches) byTick.set(event.tick, (pitches = new Map()));
  const holdDurationMs = holdDurationMsByNoteOn.get(event);
  if (pitches.has(event.note)) {
    collisions++;
    pitches.set(event.note, {
      velocity: Math.max(pitches.get(event.note).velocity, event.velocity),
      holdDurationMs,
    });
  } else pitches.set(event.note, { velocity: event.velocity, holdDurationMs });
}
const chords = [...byTick.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([tick, pitches]) => ({
    originalTimeMs: tickToMs(tick),
    notes: [...pitches]
      .sort((a, b) => a[0] - b[0])
      .map(([midi, { velocity, holdDurationMs }]) => ({
        midi,
        velocity,
        holdDurationMs,
      })),
  }));
const velocities = new Set(
  chords.flatMap((chord) => chord.notes.map((note) => note.velocity)),
);
const maxSimultaneity = Math.max(...chords.map((chord) => chord.notes.length));
console.log(
  `Selected: tracks=${SELECTED_TRACKS.join(",")} channels=${SELECTED_CHANNELS.join(",")} noteOns=${noteOns.length} chords=${chords.length} collisions=${collisions} velocities=${velocities.size} maxSimultaneity=${maxSimultaneity}`,
);
console.log("Opening event:", JSON.stringify(chords[0]));
console.log("Final event:", JSON.stringify(chords.at(-1)));
if (
  chords.length !== 2214 ||
  collisions !== 0 ||
  velocities.size !== 83 ||
  maxSimultaneity !== 8
)
  throw new Error("derived source profile mismatch");
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
const rawEvents = chords.map((chord) => [
  chord.originalTimeMs,
  chord.notes.map((note) => [note.midi, note.velocity, note.holdDurationMs]),
]);
const output = `import type { Chord, Piece } from "../../domain/types";

/** Chopin: Polonaise in A-flat major, Op. 53 (Heroic Polonaise), from a verified piano-midi.de performance MIDI. */
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

export const chopinHeroicPolonaisePiece: Piece = {
  dataName: "chopin_heroic_polonaise_op53",
  displayName: "Polonaise in A-flat major, Op. 53 (Heroic Polonaise)",
  colorTheme: "crimson",
  numScreens: chords.length,
  chords,
};
`;
fs.writeFileSync(
  path.resolve(__dirname, "../src/content/pieces/chopinHeroicPolonaise.ts"),
  output,
);
