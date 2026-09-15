#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public/piano-samples");
const COMMIT = "0cd2c034f820c53e83ab22f5c13bd490b9e4de85";
const SOURCE = `https://github.com/tambien/Piano/archive/${COMMIT}.tar.gz`;
const note = {
  C: 0,
  Cs: 1,
  D: 2,
  Ds: 3,
  E: 4,
  F: 5,
  Fs: 6,
  G: 7,
  Gs: 8,
  A: 9,
  As: 10,
  B: 11,
};
function midi(name) {
  const m = name.match(/^([A-G]s?)(\d)/);
  return m ? 12 * (Number(m[2]) + 1) + note[m[1]] : undefined;
}
function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}
function verifySourceCheckout(sourceDir) {
  let head;
  try {
    head = execFileSync("git", ["-C", sourceDir, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    throw new Error(`source must be a git checkout: ${error.message}`);
  }
  if (head !== COMMIT)
    throw new Error(
      `source HEAD ${head} does not match pinned commit ${COMMIT}`,
    );
  const readme = fs.readFileSync(path.join(sourceDir, "README.md"), "utf8");
  const license = fs.readFileSync(path.join(sourceDir, "LICENSE.md"), "utf8");
  if (!readme.includes("Salamander") || !license.includes("MIT"))
    throw new Error("source README/license evidence is incomplete");
  const sourceAudio = path.join(sourceDir, "audio");
  for (const file of fs
    .readdirSync(sourceAudio)
    .filter((name) => name.endsWith(".mp3")))
    fs.copyFileSync(path.join(sourceAudio, file), path.join(OUT, file));
  return {
    head,
    readme: path.join(sourceDir, "README.md"),
    license: path.join(sourceDir, "LICENSE.md"),
  };
}
function inventory() {
  const files = fs
    .readdirSync(OUT)
    .filter((f) => f.endsWith(".mp3"))
    .sort();
  if (files.length !== 641)
    throw new Error(`expected 641 mp3 files, found ${files.length}`);
  const assets = files.map((filename) => {
    const data = fs.readFileSync(path.join(OUT, filename));
    if (
      !(
        (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) ||
        (data[0] === 0xff && (data[1] & 0xe0) === 0xe0)
      )
    )
      throw new Error(`non-MP3 asset ${filename}`);
    const stat = fs.statSync(path.join(OUT, filename));
    let role = "attack",
      anchorMidi,
      layer;
    if (filename.startsWith("rel")) role = "release";
    else if (filename.startsWith("harm")) role = "harmonic";
    else if (filename.startsWith("pedal")) role = "pedal";
    if (role === "attack") {
      const match = filename.match(/^(.+)v(\d+)\.mp3$/);
      anchorMidi = midi(match[1]);
      layer = Number(match[2]);
      if (anchorMidi === undefined)
        throw new Error(`unknown attack ${filename}`);
    } else if (role === "release")
      anchorMidi = Number(filename.match(/^(?:rel)(\d+)/)[1]);
    return {
      id: filename.slice(0, -4),
      path: `piano-samples/${filename}`,
      role,
      anchorMidi,
      layer,
      format: "mp3",
      bytes: stat.size,
      sha256: sha256(path.join(OUT, filename)),
      group: role === "attack" && layer === 8 ? "bootstrap" : "full",
    };
  });
  const attacks = assets.filter((a) => a.role === "attack");
  if (
    attacks.length !== 480 ||
    new Set(attacks.map((a) => `${a.anchorMidi}:${a.layer}`)).size !== 480
  )
    throw new Error("attack inventory is not exactly 30 x 16");
  if (assets.reduce((n, a) => n + a.bytes, 0) !== 90413373)
    throw new Error("byte total mismatch");
  return assets.sort(
    (a, b) =>
      a.role.localeCompare(b.role) ||
      (a.anchorMidi ?? 999) - (b.anchorMidi ?? 999) ||
      (a.layer ?? 999) - (b.layer ?? 999) ||
      a.id.localeCompare(b.id),
  );
}
if (require.main === module) {
  if (
    COMMIT !== "0cd2c034f820c53e83ab22f5c13bd490b9e4de85" ||
    !SOURCE.includes(COMMIT)
  )
    throw new Error("pinned provenance mismatch");
  const sourceDir = process.env.PIANO_SOURCE_DIR;
  if (!sourceDir)
    throw new Error(
      "set PIANO_SOURCE_DIR to an exact pinned git checkout before intake",
    );
  verifySourceCheckout(sourceDir);
  const assets = inventory();
  fs.writeFileSync(
    path.join(OUT, "manifest.json"),
    JSON.stringify(
      {
        source: {
          adaptation: "tambien/Piano",
          commit: COMMIT,
          url: SOURCE,
          original: "https://github.com/sfzinstruments/SalamanderGrandPiano",
          adaptationLicense: "MIT",
          audioLicense: "CC-BY-3.0",
        },
        assets,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `accepted ${assets.length} files, ${assets.reduce((n, a) => n + a.bytes, 0)} bytes`,
  );
}
module.exports = { inventory, COMMIT, SOURCE };
