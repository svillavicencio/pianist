import type { MidiNote, Velocity } from "../../../domain/types";
import type {
  AttackAsset,
  PianoAsset,
  PianoManifest,
} from "./pianoAssetManifest";

export interface AttackSelection {
  assetId: string;
  anchorMidi: MidiNote;
  layer: number;
  playbackRate: number;
  residualGain: number;
  degraded: boolean;
  reason?: string;
}

export function findNearestSample(
  targetMidi: MidiNote,
  availableSampleMidis: readonly MidiNote[],
): MidiNote {
  if (!availableSampleMidis.length)
    throw new Error("findNearestSample requires at least one available sample");
  return [...availableSampleMidis].sort(
    (a, b) => Math.abs(targetMidi - a) - Math.abs(targetMidi - b) || a - b,
  )[0]!;
}
export function playbackRateFor(
  targetMidi: MidiNote,
  sampleMidi: MidiNote,
): number {
  return 2 ** ((targetMidi - sampleMidi) / 12);
}
export function gainFor(velocity: Velocity): number {
  return Math.min(127, Math.max(0, velocity)) / 127;
}
export function layerFor(velocity: Velocity): number {
  const v = Math.min(127, Math.max(0, velocity));
  return v === 0 ? 0 : Math.min(15, Math.floor(((v - 1) * 16) / 127));
}
export function residualGainFor(velocity: Velocity, layer: number): number {
  const v = Math.min(127, Math.max(0, velocity));
  return 0.78 * (v / 127) ** 1.6 * (0.92 + (layer / 15) * 0.16);
}

export function selectAttack(input: {
  midi: MidiNote;
  velocity: Velocity;
  available: readonly PianoAsset[];
  manifest: PianoManifest;
}): AttackSelection | undefined {
  if (input.velocity <= 0) return undefined;
  const attacks = input.available.filter(
    (a): a is AttackAsset => a.role === "attack",
  );
  if (!attacks.length) return undefined;
  const targetLayer = layerFor(input.velocity);
  const byAnchor = new Map<number, AttackAsset[]>();
  for (const asset of attacks) {
    const list = byAnchor.get(asset.anchorMidi) ?? [];
    list.push(asset);
    byAnchor.set(asset.anchorMidi, list);
  }
  const anchors = [...byAnchor.keys()].sort(
    (a, b) => Math.abs(input.midi - a) - Math.abs(input.midi - b) || a - b,
  );
  const near = anchors.filter((a) => Math.abs(input.midi - a) <= 2);
  const anchor = (near.length ? near : anchors)[0]!;
  const candidates = byAnchor.get(anchor)!;
  const chosen = [...candidates].sort(
    (a, b) =>
      Math.abs((a.layer ?? 0) - targetLayer) -
        Math.abs((b.layer ?? 0) - targetLayer) ||
      (a.layer ?? 0) - (b.layer ?? 0),
  )[0]!;
  const distance = Math.abs(input.midi - anchor);
  return {
    assetId: chosen.id,
    anchorMidi: anchor,
    layer: chosen.layer,
    playbackRate: playbackRateFor(input.midi, anchor),
    residualGain: residualGainFor(input.velocity, chosen.layer),
    degraded: distance > 2,
    reason: distance > 2 ? `anchor-distance-${distance}` : undefined,
  };
}
