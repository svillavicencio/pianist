import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Vitest's default excludes don't know about our worktrees living under
    // .claude/worktrees/ (see docs/plans — parallel tracks run in isolated
    // git worktrees nested inside the repo) — without this, a test run from
    // the main checkout also picks up every other worktree's test files.
    exclude: ['**/node_modules/**', '**/.claude/**'],
  },
});
