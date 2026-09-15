# Design: Upgrade piano audio realism

## Decision summary

Replace the all-or-nothing eight-file loader with a manifest-backed progressive sampler while preserving `AudioEngine` and the legacy composition-root path. The new sampler is locally packaged, feature-selectable, and never becomes the production default in this change. Assets are accepted only from the pinned browser adaptation commit and are provenance-checked independently from runtime behavior.

## Source, provenance, and asset boundary

The asset intake tool downloads/verifies only:

- Browser adaptation: `https://github.com/tambien/Piano` at commit `0cd2c034f820c53e83ab22f5c13bd490b9e4de85`.
- Original source and attribution authority: `https://github.com/sfzinstruments/SalamanderGrandPiano`.
- Adaptation code license: MIT, recorded separately from audio rights.
- Derived Salamander audio license: CC BY 3.0, with Alexander Holm/Yamaha C5 attribution retained.

The checked-in manifest records both URLs, exact commit, license text/URLs, derivation/conversion notice, canonical relative path, role, MIDI/anchor/layer identity, format, byte count, and SHA-256. Validation computes hashes from the committed bytes and fails closed on any mismatch. It asserts exactly 641 MP3 files and `90,413,373` bytes: 480 attacks (`30 anchors x 16 layers`), 88 `rel*.mp3` keybed releases, 69 `harm*.mp3` harmonics, and 4 `pedal*.mp3` files. Ancillary files are role-counted, never mistaken for attacks. `ATTRIBUTION.md` states the MIT adaptation attribution and CC BY 3.0 audio attribution as distinct obligations.

The manifest generator, rather than handwritten filename assumptions, imports the exact filenames from the pinned tree and emits stable lexical/role/MIDI/layer ordering. It rejects duplicate identities, unknown roles, missing expected attacks, path traversal, non-MP3 files in the accepted set, and unverified source provenance. A package validation command is run against both `public/piano-samples/` and the Vite output.

## Modules and interfaces

Keep domain types and `src/ports/AudioEngine.ts` unchanged: current `NoteEvent` has only `midi` and `velocity`; `Piece` contains no note-off or CC64/pedal events. Add adapter-owned modules:

- `src/adapters/web/audio/pianoAssetManifest.ts`: `PianoAsset`, `AttackAsset`, `AncillaryAsset`, `PianoManifest`, `PIANO_MANIFEST`, `PIANO_MANIFEST_SHA256`, and deterministic `assetUrl(baseUrl, relativePath)`.
- `src/adapters/web/audio/progressivePianoLoader.ts`: `PianoLoader`, `PianoLoadState`, `PianoReadiness`, `PianoLoadFailure`, and `createProgressivePianoLoader(context, manifest, options)`. `request(assetId, priority): Promise<AudioBuffer>` deduplicates by manifest identity; `subscribe(listener): unsubscribe`; `prewarm(plan, generation): Promise<void>`; `cancel(generation): void`; `dispose(): void`.
- `src/adapters/web/audio/sampleSelection.ts`: pure `selectAttack({ midi, velocity, available, manifest })` returning `{ assetId, anchorMidi, layer, playbackRate, residualGain, degraded, reason }`; retain `playbackRateFor` as a pure helper.
- `src/adapters/web/audio/WebAudioEngine.ts`: constructor accepts a `PianoSampleProvider`, `AudioContext`, and `WebAudioEngineOptions`; provider exposes `getAttack`, `getRelease`, and optional supported ancillary lookup. `noteOn` still returns the existing independent `NoteHandle`. Add adapter-only `dispose()` and diagnostics; do not add pedal to the public port.
- `src/adapters/web/audio/legacyPianoAudio.ts` (or the existing loader/engine path): preserve the current eight-file baseline for A/B and rollback.

`PianoLoadState` is a discriminated union: `idle`, `loading` (generation, completed, successful, failed, pending, bootstrapReady), `ready` (same counters), `degraded` (bootstrap failure or missing requested coverage), `superseded`, and `disposed`. Failure entries carry asset ID, phase (`fetch` or `decode`), and normalized error. A listener receives immutable snapshots; stale generations cannot publish snapshots.

## Data flow

```text
manifest + BASE_URL
        |
        v
 priority scheduler --(<=2 fetch/decode jobs)--> fetch local MP3
        |                                             |
        |                                        decodeAudioData
        v                                             v
 state/progress/failures <---- dedupe promises ---- decoded LRU cache
        |
        v
sample provider -> selectAttack -> voice graph -> master headroom -> compressor -> destination
```

The loader does not transfer audio on mere page load. After the first user audio gesture, it fetches the 30 `v8` attack files in the bootstrap group, but decodes only eight seed anchors (the existing C2/A2/C3/A3/C4/A4/C5/A5 coverage) before publishing `bootstrapReady`. The other bootstrap files are fetch/cache-ready and decode on demand. Full-bank fetching is priority-driven by the selected piece and preview; idle background prefetch is allowed only while the page is visible and `navigator.connection.saveData` is not enabled. All fetching, prewarming, and decoding are nonblocking to playback.

There is one scheduler per context/manifest identity shared by preview and performance. Fetch/decode jobs are capped at two simultaneously, with separate counters so tests prove the cap. A failed job is terminal for that asset but does not reject the bank. Browser HTTP caching may retain compressed bytes; the loader does not retain all `ArrayBuffer`s after decode. A selected piece prewarms the nearest anchors for its distinct MIDI notes (up to eight concurrent priorities), then requested layers; preview prewarms its first four chords. Prewarming is advisory and never blocks playback or full loading.

The decoded cache is an LRU bounded by 12 buffers and 96 MiB estimated decoded bytes, whichever is reached first. `AudioBuffer.length * numberOfChannels * 4` is the estimate. Bootstrap seed buffers and voices currently using a buffer are pinned; piece prewarm pins only until its short grace period expires. Eviction removes unpinned least-recently-used buffers and causes deterministic re-decode later. No implementation eagerly decodes 641 assets.

## Selection policy

The generated attack anchors are the 30 minor-third recorded pitches from A0 (MIDI 21) through C8 (108), as verified by the manifest. Eligible selection first filters loaded assets, then prefers an anchor within two semitones; an exact distance tie chooses the lower MIDI anchor. At endpoints it chooses A0/C8 and never fabricates or references an out-of-range anchor. If no loaded anchor is within two semitones, it chooses the globally nearest loaded anchor, lower-anchor tie-break, and marks `degraded` with the actual distance. If no new-bank attack is loaded, the engine reports `no-compatible-asset` and the composition root uses the legacy engine; it never emits silence while claiming success.

For clamped velocity `v` in 1..127, layer index is `min(15, floor((v - 1) * 16 / 127))`; velocity zero is treated as non-sounding. Thus boundaries are stable: layer 0 covers velocities 1–8, layer 1 covers 9–16, continuing in 8-value bands through layer 14 covering 113–120, and layer 15 covering 121–127. If the requested layer is unavailable, choose the loaded layer with minimum absolute layer distance, then lower layer on ties. The residual gain is deterministic and requires no audio decoding: `velocityGain = 0.78 * (v / 127)^1.6`, multiplied by a fixed layer-bound correction `layerResidualGain = 0.92 + (layer / 15) * 0.16` (0.92 for layer 0 through 1.08 for layer 15). This conservative fixed curve is the only calibration in this change and is covered by pure tests. A future calibration table is permitted only when checked in with outputs from separately verified, CI-portable tooling; neither runtime nor manifest validation decodes MP3.

## Voice lifecycle and output

Every `noteOn` creates a `Voice` object with a unique ID, attack source, attack gain, optional release source/gain, selected asset identity, and lifecycle state `active -> released -> scheduled-stop -> ended`. Same-pitch retriggers do not replace one another. `NoteHandle.release()` is idempotent and closes only its voice. Release fades the attack over 35 ms and starts the matching `rel` asset at release time when present; if unavailable, it uses the existing 0.9-second gain fade. `source.onended` removes resources only when the voice identity still exists.

The voice cap is 64 active voices. On pressure, steal in this order: already-releasing voice with earliest end, then quietest active voice, then oldest active voice; ties use voice ID. The new voice is still attempted, and a `voice-steal` diagnostic records the victim. This bounds nodes without global muting or mutating unrelated voices.

Each attack/release voice routes through its gain to a per-engine `masterGain` set to `0.70`, then `DynamicsCompressorNode`: threshold `-18 dB`, knee `24 dB`, ratio `4:1`, attack `0.003 s`, release `0.25 s`, then destination. These are conservative defaults, exposed only as constructor options for tests/A-B tooling. Tests render fake peak envelopes for dense chords and assert the pre-compressor headroom and bounded post-graph output; listening evidence rejects clipping or pumping even when numeric peaks pass.

The 69 harmonic assets are routed only through manifest-declared `harmonic` identity and triggered with an attack at bounded gain when the corresponding attack contract says they are usable. The 88 releases are key-specific and only used on `NoteHandle.release()`. The four pedal assets are packaged, hashed, attributed, and validated but **not audibly activated**: neither `InputSource` nor `NoteEvent` provides a valid pedal event. Existing held-press behavior remains the current simulated sustain/release grouping. No public pedal control or invented CC64 data is added. A future explicit adapter operation may activate pedal assets after a real event source is approved; this change’s safe fallback is “unsupported pedal sample behavior.” Round robins are unavailable and are not fabricated.

## Integration, generations, and A/B boundary

`main.ts` creates one loader and provider for the shared `AudioContext`. Preview and performance receive the same provider and readiness snapshots. `startPreview` and `startPiece` capture a generation; supersession increments it, aborts only unshared queued work, stops old voices, and ignores all late promises. Loader commits are guarded by generation and manifest identity. `WebAudioEngine.dispose()` releases all voices and disconnects graph nodes. Autoplay resume remains user-gesture initiated; failure publishes `audio-context-blocked` and leaves readiness false until a later gesture succeeds.

The composition root has an injected `AudioPath = 'legacy' | 'sampler'` option (default `legacy`) supplied by the app bootstrap/test seam; tests can construct either path without changing domain APIs. For local development only, `import.meta.env.DEV` permits `?audio=legacy|sampler` to override that injected default. Production builds ignore the query and always default to `legacy` until an explicit, separately authorized cutover changes the default. A/B uses fixed passages (opening chords, fast retriggers, loud dense chord, release-focused passage), normalized loudness, browser/device/date/build/manifest identity, and explicit observations for timbre, pitch coverage, layers, overlap, release, clipping, loading silence, and pumping. Missing or failing evidence blocks cutover and deployment.

## Error handling and observability

Normalize fetch non-2xx, decode, abort, cache-eviction, context-resume, unsupported ancillary, degraded-anchor/layer, and voice-steal errors into diagnostics without throwing from a playable note path. Expose counters for bootstrap readiness, fetched/decoded/evicted assets, bytes, active voices, fallback selections, failures by role, max concurrency, and stale-generation drops. Log only summarized identifiers/hashes, never external URLs beyond local manifest paths. If the new provider cannot serve a note, the root routes that request to the retained legacy engine and records `legacy-fallback`.

## TDD and evidence slices

Each slice is RED (new focused test fails), GREEN (minimum implementation passes), TRIANGULATE (run focused test plus a boundary/error scenario and, where applicable, real manifest validation), then REFACTOR (remove duplication while retaining the evidence). Keep tests with the behavior they prove.

1. **Provenance/manifest:** manifest cardinality, exact inventory/bytes, hash mismatch, attribution/license distinction, deterministic ordering, URL/base path, build-path validation. Separate binary/provenance review workload; do not count binaries as ordinary code review lines.
2. **Loader/fallback:** fake fetch/decode scheduler proves max two jobs, shared pending promise, bootstrap readiness with only eight decoded seeds, LRU eviction, partial failures, generation supersession, progress, and legacy fallback.
3. **Selection/engine:** pure layer/anchor boundaries and residual correction; fake graph proves independent same-pitch voices, release routing/fallback, harmonic routing, cap/steal, headroom/compressor defaults, and idempotent cleanup.
4. **Integration/gate:** preview/performance share loader, cancellation cannot win, autoplay recovery, A/B path selection, packaged asset presence, measured sizes. Finish with `npm test`, `npm run typecheck`, `npm run build`, asset validation, and documented manual A/B evidence.

## Work units, migration, and rollback

Keep authored code in four reviewable work units, each preferably below 400 changed lines: (1) provenance/manifest tooling and attribution, (2) loader/provider/fallback, (3) selection/engine graph, and (4) composition-root integration and gate evidence. The 641 binary files and their provenance manifest are a separately reviewable asset workload; do not hide it inside a code-sized PR. Tests stay in their corresponding unit. No deployment occurs here.

Rollback is a single composition-root switch back to `legacy`, followed by provider disposal; it does not delete verified assets or alter gameplay. Quarantine/remove assets only after provenance failure and a separate authorization. Production replacement, publishing, and GitHub Pages deployment remain explicit human gates.

## Alternatives rejected

- Eager `Promise.all` decoding: violates decoded-memory and partial-failure requirements.
- Runtime CDN/source URLs: violates offline/local packaging and provenance guarantees.
- Synthesis or fabricated round robin: would not use the verified source behavior.
- Domain pedal/CC64 additions: input and piece schemas have no valid pedal events and the scope does not approve a public control.
- Engine-first asset assumptions: risks incorrect adaptation filenames, roles, and rights.
- Immediate cutover: removes the legacy A/B and rollback boundary before listening evidence.

## Unresolved decisions and next phase

No genuine product decision blocks task decomposition or implementation. The remaining values are design defaults explicitly defined above and can be tuned by tests/A-B without changing public contracts. Human approval is still required at provenance acceptance, A/B acceptance, review-budget exception, cutover, and deployment. Route to `sdd-tasks`.
