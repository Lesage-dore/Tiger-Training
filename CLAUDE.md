# CLAUDE.md — Tiger Training OS

- Read `PROJECT_CONTEXT.md` first; then open only the files the task touches. Don't reread the repo.
- Make targeted edits, not rewrites. Keep it dependency-free (plain HTML/CSS/JS, ES modules, no build step).
- Test before pushing: `node --check` on changed files, plus a quick headless-Chromium run of the flow you changed.
- Bump `VERSION` in `sw.js` on every user-facing release. Pushing to `main` deploys to GitHub Pages.
- **This repo is public.** Never commit personal data (names, body stats, goals, workout logs, vault paths). Those live in the user's browser and Obsidian vault.
- **Never lose training data.** Schema changes go through `upgrade()` in `logic.js`; merges are union-by-id; deletes go to `trash`. Generated Obsidian notes the user edited are never silently overwritten.
- Update `PROJECT_CONTEXT.md` when architecture, decisions or status change. Keep replies and summaries short.
