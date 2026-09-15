# gordopianist Project Context

## Outcome

OpenSpec is initialized for the gordopianist browser piano project. This
context records the project's architecture, validation, deployment, and audio
constraints for future specification-driven development.

## Repository profile

| Area | Current context |
| --- | --- |
| Product | Browser piano practice game with note-by-note playback and tap/key progression |
| Stack | TypeScript, Vite, Vitest, PixiJS, Web Audio APIs |
| Architecture | Hexagonal: domain logic under `src/domain`; web adapters under `src/adapters` |
| Tests | Vitest, invoked with `npm test` |
| Deployment | GitHub Pages with Vite base `/pianist/` |
| Artifacts | English repository-facing SDD artifacts |

## Validation contract

Strict TDD is required. Implementations should add or update a failing test
before production code and finish with:

```text
npm test
npm run typecheck
npm run build
```

## Audio and data constraints

Public audio must have verified redistributable licensing and a deterministic
manifest. The repository currently documents Salamander Grand Piano V3 samples
under CC-BY 3.0 in `public/piano-samples/ATTRIBUTION.md`; the current sample
selection is a limited eight-file, single-velocity subset. The implementation
target is the complete 16-layer Salamander Yamaha C5 with progressive loading.
Any expansion must preserve attribution, verify redistribution rights, and make
selection and loading reproducible.

## Delivery and review gates

The session defaults are execution `auto`, artifact store `openspec`, delivery
strategy `ask-on-risk`, review budget 400 changed lines, and deferred chain
strategy. Human consent remains required for authorization, security, destructive,
publishing, ambiguous-scope, and review-budget exception decisions.

## SDD layout

- `openspec/config.yaml` — phase, testing, and project configuration.
- `openspec/specs/` — approved durable behavior specifications.
- `openspec/changes/` — proposed changes and their implementation plans.
- `openspec/archive/` — completed change records retained for history.
