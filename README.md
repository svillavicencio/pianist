# π-anist

A browser-based piano practice game: pieces play back note-by-note, driven by
real Disklavier-performed MIDI, and you advance the next note with any
keypress or tap.

Built with TypeScript, Vite, and PixiJS following a hexagonal architecture —
domain logic in `src/domain`, adapters (audio, rendering, input, storage) in
`src/adapters`.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build       # production build to dist/
```

## Deployment

Pushes to `master` build and deploy automatically to GitHub Pages via
`.github/workflows/deploy.yml`. Day-to-day work happens on `develop`;
merge to `master` when it's ready to ship.
