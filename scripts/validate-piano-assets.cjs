#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const dir = path.join(root, "public/piano-samples");
function fail(message) {
 throw new Error(`piano asset validation failed: ${message}`);
}

/**
 * Pure, filesystem-independent structural/identity/provenance-shape checks
 * over an in-memory manifest — exported so tests can prove each fail-closed
 * rule (exact 30 anchors, per-anchor 16 layers, bootstrap/full grouping,
 * ancillary filename identity/range) independently of the committed binary
 * asset set, by feeding deliberately corrupted synthetic manifests.
 */
function checkManifestProvenance(manifest) {
 if (
  !manifest.source ||
  manifest.source.adaptation !== "tambien/Piano" ||
  manifest.source.commit !== "0cd2c034f820c53e83ab22f5c13bd490b9e4de85" ||
  manifest.source.adaptationLicense !== "MIT" ||
  manifest.source.audioLicense !== "CC-BY-3.0"
 )
  fail("missing pinned provenance or distinct license evidence");
}

function checkManifestOrder(assets) {
 const roleRank = { attack: 0, harmonic: 1, pedal: 2, release: 3 };
 const expectedOrder = [...assets].sort(
  (a, b) =>
   roleRank[a.role] - roleRank[b.role] ||
   (a.anchorMidi ?? 999) - (b.anchorMidi ?? 999) ||
   (a.layer ?? 999) - (b.layer ?? 999) ||
   a.id.localeCompare(b.id),
 );
 if (
  JSON.stringify(expectedOrder.map((a) => a.id)) !==
  JSON.stringify(assets.map((a) => a.id))
 )
  fail("manifest order is unstable");
}

function checkAssetPathsAndIdentities(assets) {
 const paths = new Set();
 const identities = new Set();
 for (const a of assets) {
  if (
   !a.path ||
   a.path.includes("..") ||
   a.path.startsWith("/") ||
   a.path !== `piano-samples/${path.basename(a.path)}`
  )
   fail(`unsafe path ${a.path}`);
  const identity =
   a.role === "attack"
    ? `${a.role}:${a.anchorMidi ?? ""}:${a.layer ?? ""}`
    : `${a.role}:${a.id}`;
  if (paths.has(a.path) || identities.has(identity))
   fail(`duplicate path or identity ${a.id}`);
  paths.add(a.path);
  identities.add(identity);
  if (
   a.format !== "mp3" ||
   !["attack", "release", "harmonic", "pedal"].includes(a.role)
  )
   fail(`invalid format or role ${a.id}`);
  if (
   a.role === "attack" &&
   (!Number.isInteger(a.anchorMidi) ||
    !Number.isInteger(a.layer) ||
    a.layer < 1 ||
    a.layer > 16)
  )
   fail(`attack metadata mismatch ${a.id}`);
 }
}

/** Enforces exactly 30 distinct anchors at the minor-third spacing and exactly 16 velocity layers (1-16) for each of them. */
function checkAttackAnchorCoverage(assets) {
 const attackAnchors = [
  ...new Set(
   assets.filter((a) => a.role === "attack").map((a) => a.anchorMidi),
  ),
 ].sort((a, b) => a - b);
 const expectedAnchors = Array.from({ length: 30 }, (_, i) => 21 + i * 3);
 if (JSON.stringify(attackAnchors) !== JSON.stringify(expectedAnchors))
  fail("attack anchors are not the exact 30-anchor range");
 for (const anchor of expectedAnchors) {
  const layers = assets
   .filter((a) => a.role === "attack" && a.anchorMidi === anchor)
   .map((a) => a.layer)
   .sort((a, b) => a - b);
  if (
   JSON.stringify(layers) !==
   JSON.stringify(Array.from({ length: 16 }, (_, i) => i + 1))
  )
   fail(`missing velocity layers for anchor ${anchor}`);
 }
}

/** Enforces bootstrap/full grouping consistency and role-specific ancillary filename identity/range semantics. */
function checkGroupingAndAncillaryIdentity(assets) {
 for (const a of assets) {
  if (a.role === "attack" && a.group !== (a.layer === 8 ? "bootstrap" : "full"))
   fail(`attack grouping mismatch ${a.id}`);
  if (a.role !== "attack" && a.group !== "full")
   fail(`ancillary grouping mismatch ${a.id}`);
  if (
   a.role === "release" &&
   !/^rel(?:[1-9]|[1-8][0-9])\.mp3$/.test(path.basename(a.path))
  )
   fail(`release identity/range mismatch ${a.id}`);
  if (
   a.role === "harmonic" &&
   !/^harm(?:L|S|V3)(?:A|C|Ds|Fs)\d+\.mp3$/.test(path.basename(a.path))
  )
   fail(`harmonic identity mismatch ${a.id}`);
  if (
   a.role === "pedal" &&
   !/^pedal(?:D|U)[12]\.mp3$/.test(path.basename(a.path))
  )
   fail(`pedal identity mismatch ${a.id}`);
 }
}

function checkManifestDirectoryEquality(assets, files) {
 const manifestNames = assets.map((a) => path.basename(a.path)).sort();
 if (JSON.stringify(files) !== JSON.stringify(manifestNames))
  fail("manifest-directory equality mismatch");
}

function checkInventoryCounts(assets, bytes) {
 const counts = { attack: 0, release: 0, harmonic: 0, pedal: 0 };
 for (const a of assets) counts[a.role]++;
 if (
  JSON.stringify(counts) !==
   JSON.stringify({ attack: 480, release: 88, harmonic: 69, pedal: 4 }) ||
  bytes !== 90413373
 )
  fail(`inventory mismatch ${JSON.stringify(counts)} ${bytes}`);
 return counts;
}

/** Runs every pure, filesystem-independent manifest check in the same order the CLI uses. */
function checkManifestAssets(manifest) {
 checkManifestProvenance(manifest);
 checkManifestOrder(manifest.assets);
 checkAssetPathsAndIdentities(manifest.assets);
 checkAttackAnchorCoverage(manifest.assets);
 checkGroupingAndAncillaryIdentity(manifest.assets);
}

function validatePianoAssets(options = {}) {
 const assetsDir = options.dir ?? dir;
 let manifest;
 try {
  manifest = JSON.parse(
   fs.readFileSync(path.join(assetsDir, "manifest.json"), "utf8"),
  );
 } catch (error) {
  fail(`invalid manifest: ${error.message}`);
 }
 checkManifestAssets(manifest);
 const files = fs
  .readdirSync(assetsDir)
  .filter((f) => f.endsWith(".mp3"))
  .sort();
 if (files.length !== 641) fail(`expected 641 MP3 files, found ${files.length}`);
 let bytes = 0;
 for (const a of manifest.assets) {
  const p = path.join(root, "public", a.path);
  if (!fs.existsSync(p)) fail(`missing ${a.path}`);
  const data = fs.readFileSync(p);
  const mpeg =
   (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) ||
   (data[0] === 0xff && (data[1] & 0xe0) === 0xe0);
  if (!mpeg) fail(`not an MP3 signature ${a.id}`);
  const size = data.length;
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  if (size !== a.bytes || hash !== a.sha256)
   fail(`metadata/hash mismatch ${a.id}`);
  bytes += size;
 }
 checkManifestDirectoryEquality(manifest.assets, files);
 const counts = checkInventoryCounts(manifest.assets, bytes);
 const attribution = fs.readFileSync(
  path.join(assetsDir, "ATTRIBUTION.md"),
  "utf8",
 );
 const provenance = fs.readFileSync(
  path.join(assetsDir, "PROVENANCE.md"),
  "utf8",
 );
 if (
  !attribution.includes("MIT") ||
  !attribution.includes("CC BY 3.0") ||
  !provenance.includes("0cd2c034f820c53e83ab22f5c13bd490b9e4de85") ||
  !provenance.includes("README.md") ||
  !provenance.includes("LICENSE.md")
 )
  fail("distinct attribution/provenance evidence missing");
 const distDir = path.join(root, "dist");
 if (fs.existsSync(distDir))
  for (const a of manifest.assets) {
   const p = path.join(distDir, a.path);
   if (!fs.existsSync(p) || fs.statSync(p).size !== a.bytes)
    fail(`packaged mismatch ${a.id}`);
  }
 console.log(
  `valid piano assets: ${files.length} files, ${bytes} bytes; attacks ${counts.attack}, releases ${counts.release}, harmonics ${counts.harmonic}, pedals ${counts.pedal}${fs.existsSync(distDir) ? "; dist package verified" : ""}`,
 );
}

if (require.main === module) {
 validatePianoAssets();
}

module.exports = {
 checkManifestProvenance,
 checkManifestOrder,
 checkAssetPathsAndIdentities,
 checkAttackAnchorCoverage,
 checkGroupingAndAncillaryIdentity,
 checkManifestDirectoryEquality,
 checkInventoryCounts,
 checkManifestAssets,
 validatePianoAssets,
};
