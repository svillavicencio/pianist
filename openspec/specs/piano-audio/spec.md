# Piano Audio Realism Specification

## Purpose

Define the externally observable behavior for replacing the current sparse piano subset with a verified, locally hosted Salamander Yamaha C5 sampler while preserving playable fallback, `/pianist/` deployment behavior, and a human listening gate before production cutover.

The confirmed product decisions are fixed: Salamander Yamaha C5 is the target timbre; the attack bank has exactly 30 pitch anchors and 16 velocity layers; loading is progressive; assets are local; runtime CDN audio is prohibited; and production playback/deployment remains unchanged until the required evidence and approval exist. Exact source/adaptation rights, ancillary-file availability, thresholds, scheduling parameters, and limiter parameters remain design/implementation choices subject to these requirements.

## Requirements

### Requirement: Verified deterministic asset manifest and attribution

The repository MUST contain a deterministic manifest for the accepted piano assets. The manifest MUST identify source/adaptation provenance, redistribution evidence, attribution obligations, canonical relative paths, asset role, anchor/layer identity, format, byte size, content hash, and bootstrap/full-bank grouping. The accepted attack inventory MUST contain exactly 30 anchors × 16 velocity layers (480 attack assets); source-supported ancillary assets MAY be included in addition to those 480 attacks and MUST be identified by role rather than counted as attacks. The repository MUST include the required CC BY 3.0 attribution and any applicable adaptation/conversion notice, and MUST reject assets whose redistribution rights cannot be verified.

#### Scenario: Valid bank is reproducibly accepted

- GIVEN the committed assets, manifest, provenance evidence, and attribution are present
- WHEN deterministic asset validation runs
- THEN it passes only when all 480 attack entries are present exactly once, every entry has matching path/metadata/hash, ordering and grouping are stable, and the rights and attribution evidence is complete

#### Scenario: Unproven or changed asset is rejected

- GIVEN an asset has an unverified redistribution status, missing attribution, a mismatched hash, or metadata inconsistent with its file
- WHEN manifest validation runs
- THEN validation fails and the asset cannot be treated as an accepted playback asset

### Requirement: Exact local packaging and URL behavior

All runtime piano audio URLs MUST resolve to packaged repository content below the configured `/pianist/` base path. Runtime playback MUST NOT request audio from a CDN, source repository, or other external origin. URL construction MUST preserve the configured base path without doubled or missing path segments.

#### Scenario: Pages-base URL is correct

- GIVEN the application is served with base URL `/pianist/`
- WHEN a manifest entry is requested
- THEN its request URL is a local `/pianist/` URL corresponding exactly to the manifest path

#### Scenario: External runtime dependency is unavailable

- GIVEN external network access is blocked
- WHEN the application loads and plays piano audio
- THEN it remains able to use packaged local assets or deterministic fallback and makes no runtime CDN audio request

### Requirement: Progressive bootstrap readiness and bounded loading

The loader MUST expose observable loading state including bootstrap readiness, overall progress, successful and failed assets, and terminal or superseded status. It MUST make the approved approximately 5.4 MiB v8 bootstrap usable before full-bank completion when those assets are valid. Full-bank loading MUST proceed progressively with bounded fetch/decode concurrency and MUST deduplicate requests for the same manifest identity, including concurrent consumers. Cancellation or supersession MUST prevent stale loading work from corrupting current readiness or playback state.

#### Scenario: Bootstrap becomes playable before completion

- GIVEN valid bootstrap assets are available and full-bank assets remain pending
- WHEN bootstrap loading completes
- THEN readiness reports usable bootstrap audio, preview and performance may play it, and full-bank progress continues independently

#### Scenario: Duplicate consumers share one load

- GIVEN preview and performance request the same asset while it is pending
- WHEN the loader schedules requests
- THEN it performs one fetch/decode operation for that manifest entry and exposes the result to both consumers

#### Scenario: Loading concurrency is bounded

- GIVEN more assets are queued than the configured loading limit
- WHEN progressive loading runs
- THEN the number of simultaneous fetch/decode operations never exceeds the declared bound

#### Scenario: Superseded loading cannot win

- GIVEN a loading generation is superseded by a newer generation
- WHEN an old request completes afterward
- THEN its result cannot replace the current generation's state or make stale audio appear ready

### Requirement: Progress, errors, partial failure, and deterministic fallback

The loader MUST report progress and failures at asset granularity, including enough information to distinguish bootstrap failure, non-bootstrap failure, cancellation, and terminal completion. A failure of one asset MUST NOT reject otherwise usable audio. For every playable note request, selection MUST deterministically choose the best compatible loaded asset according to the documented policy; if the preferred layer or anchor is unavailable, it MUST fall back to a loaded compatible asset rather than becoming silent solely because the full bank is incomplete. If no compatible asset exists, the application MUST expose a visible/observable audio error and retain the old path or another approved safe fallback where available.

#### Scenario: Non-bootstrap asset fails

- GIVEN bootstrap audio is ready and a full-bank asset fails to fetch or decode
- WHEN the failure is recorded
- THEN progress reports the failure, other assets continue loading, bootstrap playback remains usable, and selection excludes the failed asset deterministically

#### Scenario: Preferred layer is pending

- GIVEN a note requests a velocity layer that is not loaded
- WHEN the note is played
- THEN the engine selects the documented nearest compatible loaded layer with deterministic tie-breaking and applies its documented gain correction

#### Scenario: No new-bank asset is playable

- GIVEN no compatible new-bank asset is loaded for a requested note
- WHEN the note is played
- THEN the application reports the failure and uses the retained old path or safe fallback when available, rather than silently claiming successful new-bank playback

### Requirement: Full-range pitch-anchor selection

For every key in the full 88-key piano range, the selection policy MUST choose an anchor whose playback pitch distance is no more than two semitones whenever an eligible anchor exists. Selection MUST cover the complete 88-key range, MUST be deterministic for equidistant anchors, and MUST define endpoint behavior without selecting an out-of-range key. The policy MUST prefer a loaded eligible asset and then apply the documented fallback ordering when the preferred anchor is unavailable.

#### Scenario: Interior key uses a nearby anchor

- GIVEN a playable key in the 88-key range and loaded anchors within two semitones
- WHEN selection runs
- THEN it chooses an eligible anchor no more than two semitones away using the documented deterministic tie-break

#### Scenario: Lowest and highest keys remain valid

- GIVEN the lowest or highest piano key is requested
- WHEN selection runs
- THEN it returns an in-range anchor/sample and a valid playback ratio without endpoint silence or an out-of-range anchor reference

#### Scenario: No anchor is within two semitones

- GIVEN an eligible loaded set temporarily has no anchor within two semitones
- WHEN selection runs
- THEN it follows the documented degraded fallback ordering, reports degraded coverage, and never fabricates an asset or silently treats the distance as compliant

### Requirement: Documented velocity mapping and residual gain

The audio behavior MUST document the mapping from input velocity to the 16 discrete attack layers, including boundary and tie behavior, and MUST document any residual gain applied after layer selection. Velocity MUST affect timbre through layer selection as well as loudness through gain. The mapping MUST be deterministic and MUST remain defined when the selected target layer is unavailable.

#### Scenario: Velocity changes timbre and loudness

- GIVEN two otherwise identical notes with materially different velocities
- WHEN both are played with their selected layers available
- THEN they select according to the documented velocity mapping and produce corresponding documented residual gain differences

#### Scenario: Boundary velocity is stable

- GIVEN a velocity exactly on a layer boundary
- WHEN selection runs repeatedly
- THEN it selects the same layer and gain every time according to the documented boundary rule

### Requirement: Independent overlapping voices

Each note-on MUST create an independently controllable voice, including repeated note-ons at the same pitch. A new voice MUST NOT forcibly replace an active same-pitch voice. Cross-pitch voices MUST coexist, and each voice MUST retain its own release, gain, and cleanup lifecycle.

#### Scenario: Same-pitch retrigger overlaps

- GIVEN a note is held and the same pitch is triggered again
- WHEN the second note-on occurs
- THEN both voices remain active and independently receive their respective release events

#### Scenario: Chord voices coexist

- GIVEN multiple different pitches are triggered close together
- WHEN they sound concurrently
- THEN each eligible voice is audible and releasing one does not release or retune another

### Requirement: Bounded voice pressure and explicit degradation

The engine MUST enforce a documented upper bound or equivalent bounded resource policy for active voices and Web Audio resources. Under pressure, it MUST degrade deterministically and safely, preserving independent overlap for as many voices as resources allow. Degradation MUST not cause unbounded allocation, global silence, or mutation of unrelated voices, and MUST be observable for diagnostics/listening evidence.

#### Scenario: Voice limit is reached

- GIVEN active overlapping voices reach the declared pressure limit
- WHEN another note is requested
- THEN the documented deterministic degradation policy is applied, resource usage remains bounded, and existing voices are not unpredictably all terminated

### Requirement: Source-supported release, resonance, keybed, harmonic, and pedal behavior

The engine MUST use release, keybed, harmonic/resonance, and pedal assets or routing only when the verified manifest and source evidence support the behavior. Unsupported ancillary behavior MUST degrade safely, be documented as unsupported, and MUST NOT be simulated as verified source behavior. Pedal state and release scheduling MUST be independent per voice and compatible with the existing preview cancellation and performance lifecycle.

#### Scenario: Supported ancillary asset is available

- GIVEN the manifest verifies an ancillary asset and its routing contract
- WHEN the corresponding key release, resonance/harmonic, keybed, or pedal event occurs
- THEN the engine uses that supported behavior with bounded lifecycle cleanup

#### Scenario: Ancillary behavior is unsupported

- GIVEN the verified bank does not provide a required ancillary asset or routing contract
- WHEN the event occurs
- THEN playback remains safe using the documented fallback, and the system reports/documentation distinguishes unsupported behavior from successful sampled behavior

### Requirement: Headroom and limiter/compressor safety

The output path MUST provide documented headroom before any limiter/compressor and MUST bound output under representative dense chords and overlapping retriggers. The limiter/compressor MUST NOT be used to conceal unacceptable source clipping, runaway gain, or audible pumping; these conditions MUST fail acceptance even if output peak values are bounded.

#### Scenario: Dense chord remains bounded

- GIVEN representative dense chords and overlapping retriggers at maximum supported input velocity
- WHEN output is rendered through the production graph
- THEN measured output remains within the documented safety ceiling without runaway clipping

#### Scenario: Pumping or source clipping is audible

- GIVEN listening evidence identifies unacceptable pumping or clipping
- WHEN the safety check is evaluated
- THEN the audio acceptance fails and production cutover remains blocked

### Requirement: Preview and performance integration

Preview and performance playback MUST share the coordinated loader/context state without duplicate asset loads. Both paths MUST remain playable during bootstrap-only readiness, partial failure, cancellation, and supersession, using the same deterministic fallback policy. Existing preview cancellation behavior MUST remain effective, and the integration MUST preserve the `/pianist/` base path.

#### Scenario: Preview is cancelled during loading

- GIVEN a preview starts while assets are loading and is then cancelled or superseded
- WHEN late asset or voice events arrive
- THEN no stale preview continues or corrupts current performance playback

### Requirement: Automated packaging, measured size, and build presence

Automated verification MUST validate manifest cardinality, determinism, hashes, attribution, URL paths, loader state/fallback, selection, voice lifecycle, supported ancillary routing, and output safety. The packaged build MUST contain the accepted local assets at their manifest paths. Verification MUST report measured compressed bytes for bootstrap and complete bank from the committed files, including the expected approximately 5.4 MiB bootstrap and approximately 86.2 MiB full-bank figures as measurements rather than assumptions. Unit tests MUST NOT be presented as proof of timbral realism.

#### Scenario: Build packages the accepted bank

- GIVEN the exact committed manifest and assets
- WHEN `npm test`, `npm run typecheck`, and `npm run build` plus asset validation run
- THEN all applicable checks pass only when packaged paths, measured sizes, and manifest identity agree

### Requirement: Mobile and autoplay failure visibility where in scope

Where mobile or autoplay behavior is part of the supported browser scope, the application MUST make inability to create/resume an audio context or play audio observable to the user or integration boundary, MUST preserve a user-gesture recovery path, and MUST NOT misreport audio as ready. If a platform is explicitly outside supported scope, that scope and the resulting limitation MUST be documented rather than hidden.

#### Scenario: Autoplay is blocked

- GIVEN the browser blocks audio context start or resume before a user gesture
- WHEN preview or performance requests playback
- THEN readiness/error state identifies the blocked condition and a subsequent supported user gesture can recover without a page reload

### Requirement: Human A/B listening gate before cutover

The old eight-sample path and new sampler path MUST remain selectable for comparison until production acceptance. Before production playback replacement or deployment, human listening evidence MUST record the target passages, loudness-normalization method, listener(s), date, browser/device conditions, build and manifest identity, observations, and an explicit pass/fail decision. The evidence MUST assess timbral naturalness, pitch coverage, velocity transitions, retrigger overlap, release/pedal behavior, clipping, loading silence, and limiter pumping. Automated tests MUST NOT substitute for this listening gate.

#### Scenario: A/B evidence passes

- GIVEN required provenance/build checks pass and documented listeners judge the new path acceptable on agreed passages without blocking defects
- WHEN the explicit production gate is reviewed
- THEN production replacement may be considered, but only with separate human authorization for cutover/deployment

#### Scenario: A/B evidence is missing or fails

- GIVEN evidence is absent, incomplete, or identifies a blocking quality defect
- WHEN production selection or deployment is requested
- THEN the request is blocked and the old path remains available

### Requirement: Safe rollback

The integration MUST provide a reversible production selection boundary so the old eight-sample path can be restored without deleting unrelated gameplay or the verified assets. Rollback MUST be documented and MUST disable the new production path when provenance, package size, browser resource behavior, build integrity, or listening acceptance fails.

#### Scenario: New path fails after selection

- GIVEN the new path has been selected and a blocking failure is discovered
- WHEN rollback is invoked at the composition root
- THEN the old path is restored, new-bank loading/playback no longer controls production output, and the failure state/evidence remains available for investigation

#### Scenario: Deployment is not approved

- GIVEN implementation or verification is complete but explicit production/deployment approval is absent
- WHEN the release workflow is considered
- THEN no production replacement or GitHub Pages deployment is performed
