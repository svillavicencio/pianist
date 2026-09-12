# Touch Pianist Revival — High-Level Design

Status: **Approved draft v1** — main plan of record for this project. LLD (ports/contracts, method signatures) is intentionally deferred to a follow-up pass per component.

## 1. Context

Rebuild of [touchpianist.com](https://touchpianist.com) (by Batuhan Bozkurt / earslap) as a learning/personal project, driven by hexagonal architecture principles. The rebuild is based on a verified reverse-engineering pass against the live site (not assumptions):

- Original stack: PIXI.js (canvas/WebGL render), Ractive.js (UI templating), jQuery + Bootstrap 3, FastClick, Web Audio API with runtime mp3/ogg detection.
- Core mechanic, confirmed from the site's own JSON data (`offerings2.json` catalog, `pieces/<name>.json` per-piece data):
  - Each piece is stored as a flat array grouped in 4-value tuples: `[originalTimeMs, screenDurationMs, midiNote, velocity]`. Consecutive tuples sharing `originalTimeMs` form a chord.
  - **Perform mode**: any user input (key or tap) advances a cursor to the *next* chord and plays it — real elapsed time is ignored. The user supplies rhythm/tempo; correct pitches are guaranteed by construction.
  - **Watch mode**: the same data auto-plays using the real `originalTimeMs` deltas.
  - Visual signature: glowing circle sprites per triggered note, tinted by a per-piece `colorTheme`.
  - Position can be saved/resumed client-side (pin/resume).

## 2. Goals & Scope

- **In scope (v1)**: web-only MVP, faithful to the original mechanic (perform + watch modes, piece catalog, save/resume).
- **Deferred, not blocked**: mobile/Expo port. The architecture is chosen specifically so this is an adapter addition later, not a rewrite.
- **Out of scope (v1, YAGNI)**: scoring/multiplayer (original doesn't have it either), analytics, legacy-browser WebGL fallback.
- **Open item (not yet resolved)**: the original's specific piece arrangements + audio samples are Batuhan Bozkurt's own work, not public domain — even though the underlying classical pieces are. We will need our own transcription(s) in the same data shape, plus an openly-licensed piano sample set (e.g. Salamander Grand Piano, CC0). This blocks the *data/content* layer, not the architecture.

## 3. Architecture: Hexagonal (Ports & Adapters), lightweight

Chosen because the explicit goal is "same game logic, swappable delivery mechanisms" (web today, Expo/mobile later) — the textbook hexagonal use case. Rejected alternatives:
- **Clean Architecture**: same idea, more ceremony (four rings) than this project's size justifies.
- **MVC/MVP**: simpler, but doesn't cleanly express "swap the entire audio/render backend without touching game logic."
- **ECS**: solves a problem we don't have (many heterogeneous entities); this domain is one piece + one cursor + N simultaneous notes.

```
                 ┌─────────────────────────────┐
                 │        UI Shell (web)        │
                 │  menus / pause / overlays    │
                 └───────────────┬──────────────┘
                                 │ wires together
      ┌──────────────────────────┼──────────────────────────┐
      │                          │                           │
┌─────▼─────┐            ┌───────▼────────┐           ┌──────▼──────┐
│ InputSource│            │     Domain      │           │  Renderer   │
│ (port)     │──trigger──▶│  (PieceEngine,  │──events──▶│   (port)    │
│            │            │  WatchPlayer,   │           │             │
└─────▲──────┘            │  PieceCatalog)  │           └──────▲──────┘
      │                   └────────┬────────┘                  │
┌─────┴──────┐                     │ note events          ┌────┴────────┐
│ DomInput   │                     ▼                       │ PixiRenderer│
│ Source     │              ┌─────────────┐                │ (adapter)   │
│ (adapter)  │              │ AudioEngine │                └─────────────┘
└────────────┘              │   (port)    │
                             └──────┬──────┘
                                    ▼
                            ┌───────────────┐
                            │ WebAudioEngine │
                            │   (adapter)    │
                            └───────────────┘
```

Dependency rule: arrows into the Domain box never reverse — Domain defines the ports, adapters implement them, nothing in Domain imports PixiJS, the DOM, or Web Audio directly.

## 4. Tech stack (verified against npm registry, 2026-09-11)

| Concern | Choice | Verified status |
|---|---|---|
| Language | TypeScript 7.0.2 | active |
| Build | Vite 8.3.0 | active |
| Tests | Vitest 5.0.0 | active |
| 2D render | pixi.js 8.20.1 | active, ~743k weekly downloads |
| Audio | Web Audio API (native), `AudioBufferSourceNode` + `playbackRate` for pitch-shift | no dependency — matches the original's own custom sampler approach |
| UI shell | Plain TS + DOM, no framework | matches user's choice (no React) |

`smplr` (v1.0.0, danigb, 321★, 1 open issue, 12k weekly downloads) was evaluated as an audio-sampler shortcut and is viable, but the raw Web Audio adapter was chosen to keep the `AudioEngine` port trivial to re-implement natively later (`react-native-audio-api` is Web-Audio-API-compatible, which makes a future adapter closer to a port than a rewrite).

## 5. Data flow (Perform mode, the core loop)

1. `DomInputSource` normalizes a keydown/pointerdown into a `trigger` event.
2. `PieceEngine.trigger()` advances its internal cursor and returns the next `NoteEvent[]` (chord).
3. For each `NoteEvent`: `AudioEngine.noteOn(midi, velocity)` and `Renderer.spawnNoteVisual(midi, colorTheme)`.
4. `Renderer.tick(dt)` runs every animation frame regardless of input, to animate/fade existing visuals.

Watch mode replaces step 1-2 with `WatchModePlayer`, which self-schedules triggers using `Clock` and the piece's real `originalTimeMs` deltas — steps 3-4 are identical, which is why both modes can share the same audio/render adapters untouched.

## 6. Components Inventory

| Component | Layer | Responsibility | Contract status |
|---|---|---|---|
| `PieceEngine` | Domain | Cursor-based chord advancement (Perform mode core loop) | **TBD — next LLD** |
| `WatchModePlayer` | Domain | Real-time chord playback using original timestamps | TBD |
| `PieceCatalog` | Domain | Parse/expose composer packs + piece metadata | TBD |
| `SavedPosition` | Domain | Value object for pin/resume state | TBD |
| `AudioEngine` (port) | Port | `noteOn` / `noteOff` contract, implementation-agnostic | TBD |
| `Renderer` (port) | Port | `spawnNoteVisual` / `tick` contract | TBD |
| `InputSource` (port) | Port | Normalized `trigger` event contract | TBD |
| `Clock` (port) | Port | Injectable time source for testable scheduling | TBD |
| `WebAudioEngine` | Adapter (web) | `AudioEngine` via `AudioBufferSourceNode` + `playbackRate` | TBD |
| `PixiRenderer` | Adapter (web) | `Renderer` via PixiJS scene + glow-sprite pool | TBD |
| `DomInputSource` | Adapter (web) | `InputSource` via `keydown` + `pointerdown` | TBD |
| `LocalStorageRepository` | Adapter (web) | Persists `SavedPosition` | TBD |
| Main Menu / Pause / Game Overlay / About views | UI Shell | Plain TS+DOM screens, wire adapters + domain together | TBD |

## 7. Next Steps (LLD phase)

1. Define the exact **contracts** (TypeScript interfaces, method signatures, error/edge-case semantics) for each port and domain component listed above — this is explicitly not done yet, per user request.
2. Suggested LLD order: `PieceEngine` first (it's the core loop everything else hangs off of), then the three ports (`AudioEngine`, `Renderer`, `InputSource`), then their web adapters, then the UI shell.
3. Resolve the data/licensing open item (own piece transcription + sample license) before building the content pipeline.
