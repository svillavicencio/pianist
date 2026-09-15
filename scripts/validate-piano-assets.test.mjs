import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  checkManifestAssets,
  checkAttackAnchorCoverage,
  checkGroupingAndAncillaryIdentity,
  checkInventoryCounts,
} from "./validate-piano-assets.cjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Builds a structurally valid synthetic 30-anchor x 16-layer attack bank, in the exact deterministic order the validator expects. */
function validAttacks() {
  const anchors = Array.from({ length: 30 }, (_, i) => 21 + i * 3);
  const assets = [];
  for (const anchor of anchors) {
    for (let layer = 1; layer <= 16; layer++) {
      assets.push({
        id: `A${anchor}v${layer}`,
        path: `piano-samples/A${anchor}v${layer}.mp3`,
        role: "attack",
        anchorMidi: anchor,
        layer,
        format: "mp3",
        bytes: 1000,
        sha256: "a".repeat(64),
        group: layer === 8 ? "bootstrap" : "full",
      });
    }
  }
  return assets;
}

function validManifest() {
  return {
    source: {
      adaptation: "tambien/Piano",
      commit: "0cd2c034f820c53e83ab22f5c13bd490b9e4de85",
      url: "https://github.com/tambien/Piano",
      original: "https://github.com/sfzinstruments/SalamanderGrandPiano",
      adaptationLicense: "MIT",
      audioLicense: "CC-BY-3.0",
    },
    assets: validAttacks(),
    totalBytes: 480000,
  };
}

describe("validate-piano-assets fail-closed manifest checks", () => {
  it("accepts a fully valid synthetic 30x16 attack bank", () => {
    expect(() => checkManifestAssets(validManifest())).not.toThrow();
  });

  it("rejects a manifest missing one anchor from the exact 30-anchor range", () => {
    const manifest = validManifest();
    manifest.assets = manifest.assets.filter((a) => a.anchorMidi !== 21);
    expect(() => checkManifestAssets(manifest)).toThrow(/anchor/);
  });

  it("rejects an anchor that is missing one of its exact 16 velocity layers", () => {
    const manifest = validManifest();
    manifest.assets = manifest.assets.filter(
      (a) => !(a.anchorMidi === 21 && a.layer === 3),
    );
    expect(() => checkManifestAssets(manifest)).toThrow(/velocity layers/);
  });

  it("rejects an attack whose bootstrap/full group is inconsistent with its layer", () => {
    const manifest = validManifest();
    const anchorSeed = manifest.assets.find(
      (a) => a.anchorMidi === 21 && a.layer === 8,
    );
    anchorSeed.group = "full";
    expect(() => checkManifestAssets(manifest)).toThrow(/grouping/);
  });

  it("rejects an ancillary asset declared as bootstrap group", () => {
    const manifest = validManifest();
    manifest.assets.push({
      id: "rel21",
      path: "piano-samples/rel21.mp3",
      role: "release",
      format: "mp3",
      bytes: 1,
      sha256: "b".repeat(64),
      group: "bootstrap",
    });
    expect(() => checkManifestAssets(manifest)).toThrow(
      /ancillary grouping mismatch/,
    );
  });

  it("rejects a harmonic asset whose filename does not match the verified identity pattern", () => {
    const manifest = validManifest();
    manifest.assets.push({
      id: "harmBogus",
      path: "piano-samples/not-a-real-harmonic-name.mp3",
      role: "harmonic",
      format: "mp3",
      bytes: 1,
      sha256: "c".repeat(64),
      group: "full",
    });
    expect(() => checkManifestAssets(manifest)).toThrow(
      /harmonic identity mismatch/,
    );
  });

  it("rejects a release asset whose filename is outside the verified 1-88 range/identity pattern", () => {
    const manifest = validManifest();
    manifest.assets.push({
      id: "rel99",
      path: "piano-samples/rel99.mp3",
      role: "release",
      format: "mp3",
      bytes: 1,
      sha256: "d".repeat(64),
      group: "full",
    });
    expect(() => checkManifestAssets(manifest)).toThrow(
      /release identity\/range mismatch/,
    );
  });

  it("rejects a pedal asset whose filename does not match the verified identity pattern", () => {
    const manifest = validManifest();
    manifest.assets.push({
      id: "pedalX9",
      path: "piano-samples/pedalX9.mp3",
      role: "pedal",
      format: "mp3",
      bytes: 1,
      sha256: "e".repeat(64),
      group: "full",
    });
    expect(() => checkManifestAssets(manifest)).toThrow(
      /pedal identity mismatch/,
    );
  });

  it("rejects a duplicate attack identity (same anchor/layer twice)", () => {
    const manifest = validManifest();
    // Insert the exact duplicate right after the original so it stays in
    // stable sort position and the order check does not fire first — this
    // isolates the identity-duplication rule specifically.
    const dup = { ...manifest.assets[0] };
    manifest.assets.splice(1, 0, dup);
    expect(() => checkManifestAssets(manifest)).toThrow(
      /duplicate path or identity/,
    );
  });

  it("rejects a path-traversal asset path", () => {
    const manifest = validManifest();
    manifest.assets[0].path = "piano-samples/../../etc/passwd";
    expect(() => checkManifestAssets(manifest)).toThrow(/unsafe path/);
  });

  it("rejects an unpinned or licensing-inconsistent source block", () => {
    const manifest = validManifest();
    manifest.source.commit = "0000000000000000000000000000000000000000";
    expect(() => checkManifestAssets(manifest)).toThrow(/pinned provenance/);
  });
});

describe("validate-piano-assets inventory accounting", () => {
  it("rejects a byte total that does not match the exact measured full-bank size", () => {
    expect(() =>
      checkInventoryCounts(
        [
          ...Array.from({ length: 480 }, (_, i) => ({
            role: "attack",
            id: `a${i}`,
          })),
          ...Array.from({ length: 88 }, (_, i) => ({
            role: "release",
            id: `r${i}`,
          })),
          ...Array.from({ length: 69 }, (_, i) => ({
            role: "harmonic",
            id: `h${i}`,
          })),
          ...Array.from({ length: 4 }, (_, i) => ({
            role: "pedal",
            id: `p${i}`,
          })),
        ],
        90413372,
      ),
    ).toThrow(/inventory mismatch/);
  });

  it("accepts the exact measured inventory counts and byte total", () => {
    const counts = checkInventoryCounts(
      [
        ...Array.from({ length: 480 }, (_, i) => ({
          role: "attack",
          id: `a${i}`,
        })),
        ...Array.from({ length: 88 }, (_, i) => ({
          role: "release",
          id: `r${i}`,
        })),
        ...Array.from({ length: 69 }, (_, i) => ({
          role: "harmonic",
          id: `h${i}`,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          role: "pedal",
          id: `p${i}`,
        })),
      ],
      90413373,
    );
    expect(counts).toEqual({
      attack: 480,
      release: 88,
      harmonic: 69,
      pedal: 4,
    });
  });
});

describe("validate-piano-assets against the real committed manifest", () => {
  it("the checked-in manifest passes every pure structural/identity/grouping check", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(__dirname, "..", "public/piano-samples/manifest.json"),
        "utf8",
      ),
    );
    expect(() => checkManifestAssets(manifest)).not.toThrow();
    expect(() => checkAttackAnchorCoverage(manifest.assets)).not.toThrow();
    expect(() =>
      checkGroupingAndAncillaryIdentity(manifest.assets),
    ).not.toThrow();
  });
});
