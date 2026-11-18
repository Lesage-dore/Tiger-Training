# PROJECT_CONTEXT — Tiger Training OS

Read this first. Then open only the files the task touches.

## Purpose
A long-term athletic training system: FBEOD (full body every other day) A/B/C rotation, with
low-fatigue off-days in between. Six qualities: strength, relative strength, tendon capacity, power,
mobility, coordination. Tracks lifts, progression, PRs, tendon pain, skill trees, benchmarks and body
measurements. Performance is the main measure; bodyweight is secondary. Obsidian is the permanent record. Priorities: logging → progress → FBEOD →
skills → Obsidian → PRs → mobile → performance → charts → cosmetics.

## Architecture
A plain HTML/CSS/JavaScript web app that works offline. No framework, no build step, no dependencies.
Served from `` (any static server). ES modules, so it needs http(s) or localhost, not file://.

| File | Role |
|---|---|
| `program.js` | Seed data: KINDS, CATEGORIES, REGIONS, TENDON_GUIDE, EXERCISES (rg = regions loaded, vars = variations, tree), TEMPLATES (A/B/C), BLOCKS (off-day), SKILL_TREES (crit per level), TESTS |
| `logic.js` | Pure logic: db create/`upgrade`/validate/merge, history (per variation), bests, PRs, e1RM, pain gating (`regionFlags`, `nextDayPain`), `suggest()`, skill evidence/`autoUnlock`, `weekly`, schedule, off-day builder |
| `md.js` | Obsidian Markdown builders, `buildFiles()`, zip writer, `syncWith(io)` (shared by browser + Node), `dirIO()` |
| `app.js` | UI (template strings + event delegation via `data-act`), persistence, rest timer, import/export |
| `sync.mjs` | Laptop: `node sync.mjs <vault>` merges `Fitness/_data/tiger-backup*.json` and writes the notes |
| `sw.js` | Offline cache (network-first). Bump `VERSION` on release |

## Data model (one JSON doc, `schema: 2`; `upgrade()` migrates older versions)
`settings{unit, goal, rotation, categories, _u}` · `program{exercises, templates, _u}` · `skills{trees, status{"tree/step":{state,date}}, _u}`
· `tests{defs, _u}` · `workouts[]` · `measurements[]` · `results[]` · `checkins[]` · `photos[]` · `revisions[]` · `trash[]` · `archive[]`.
- Program blob also has `blocks` (off-day). `settings.painCap` (default 3).
- Workout: `{id, type, name, title, date, startedAt, finishedAt, updatedAt, editedAt?, status: active|done, entries[], notes, prs[], bw, mdPath}`
- Workout also: `levelUps[]`. Entry: `{id, ex, tgt{sets, setsMax?, min, max, note?}, sets[{id, w?, r?, t?, d?, rpe?, done, at}], variant?, pain? (0–10), form? good|off, subFor?, skipped?, notes}`
- Check-in: `{id, date, soreness, regions{achilles|knee|hamstring|ankle|elbow|shoulder|wrist: 0–10}, notes}` (one per date). Photo: `{id, date}`; the image blob is in IndexedDB `photo:<id>`.
- Exercise: `{id, name, cat, kind: load|reps|time|jump|sprint|carry|practice, added? (weight added to BW; 0 = BW, negative = assistance), side?, inc?, rest?, dUnit?, risk?, rg?, vars?, tree?, note?}`
- Saved in localStorage `tiger.db`, mirrored to IndexedDB, plus snapshots `tiger.db.daily`, `tiger.db.preimport` and `tiger.db.pre-v2` (taken before a migration).
- Immutability: editing a finished workout first saves a full copy to `revisions`. Deleting moves it to `trash`. Import/merge is a union by id (later `updatedAt` wins) and never drops records.

## Progression rules (configurable per category in Settings; per exercise via `inc`/`rest`)
- **Pain gate first:** worst of pain during the last session, the next-day check-in, and any region above the cap in the last 3 days. Above the cap (3) → hold; above 5 → about −25% or switch to isometrics, see a physio if it keeps rising. Form ✗ → hold.
- **Never progress just for finishing:** the top of the range on every set also needs confirmation: RPE logged ≤ cap or form ✓ (tendon work: pain logged).
- **double** (power/strength/hypertrophy/isolation/calisthenics/conditioning): confirmed top of range at one weight → +inc. All sets in range → same weight, add reps. Below range twice → −10%.
- **time** (isometric) / bodyweight reps: top of range → next variation (`vars`), or +5 s / load. **tendon**: double/time with pain logging required. **performance** (sprint/jump): bests only. **practice**: quality plus risk flags.
- e1RM (Epley) only for plain loaded strength/hypertrophy/isolation lifts at 1–12 reps. Never for added-load bodyweight lifts, jumps, sprints, holds or skills.
- PRs: heaviest, rep PR at a weight already used, e1RM, max reps, longest hold, best jump, fastest sprint per distance, carry. A first log is a baseline, not a PR.

## Tendon distribution
A: Spanish squat isometric (patellar), cable external rotation. B: none for the lower body (plyos already load Achilles/patellar); wrist curls, hammer curls. C: slow standing calf raises plus bent-knee calf raises (Achilles), tibialis, reverse Nordic, push-up plus. Off-day block: dead hang, scapular pull-ups. Approved 2026-11-18: B order jumps → sprints → sled; C trimmed (pull-ups 3 sets, ab wheel 2).

## Skill trees
Each level has a `crit` (exercise, variation, min reps/sec, sets, min load). `autoUnlock` marks a level done only from logged evidence. Manual done asks for confirmation. Hold targets are set modestly for long-limbed (tall) athletes.

## Obsidian structure (`Fitness/`)
`Dashboard.md` (Dataview only, hand-written) · `Training Program.md`* · `Workouts/YYYY-MM-DD - <name>.md` (sets/RPE/rest, tendon, skill, pain, next-session sections) ·
`Exercises/<Name>.md`* · `Personal Records/PR Log.md`* · `Skills/Skill Trees.md`* · `Tendon Training/Tendon Log.md`* · `Measurements/YYYY-MM-DD.md` (+ `Photos/`, git-ignored) ·
`Benchmarks/YYYY-MM-DD.md` · `Templates/` · `_data/tiger-backup.json`, `sync-state.json`, `backups/` (daily snapshot, last 30; `overwritten/` copies of hand-edited generated notes).
\* = fully regenerated on every sync. Workout and measurement notes are **protected**: if they were edited in Obsidian, they are not overwritten.

## Sync paths
- Chrome/Edge (laptop, Android): Settings → Sync to vault. Pick the vault root (or `Fitness/`). Syncs automatically after each workout.
- iPhone: "Share backup → vault": save the JSON into `Fitness/_data/`, then the laptop (app or `sync.mjs`) merges it and writes the notes.

## Daily guidance
Home "Today" spells out the day: FBEOD session with each exercise's target + suggestion, or an off-day plan from `OFF_PLANS` (cycled; `avoidBefore` skips plans that clash with tomorrow's FBEOD; recovery-only when soreness ≥ 7 or a region is flagged). "Mark … done" / Train → "Log a session done without the app" records `quick: true` workouts (no sets) so the rotation stays right. ▶ on every exercise opens a YouTube/Google Images search (`DEMO_Q` refines ambiguous names) or the user's saved `ex.video` link.

## Visual design (2026-11-18)
Tiger theme: each tab sets `body[data-tab]` → its own hero photo (`img/*.webp`, original AI-generated, ~60 KB each), background, accent and card tint
(Home black/amber, Train teal/orange, Progress gold, Skills green/gold, Body sand, Settings neutral). Each view starts with `hero()`; Home adds a summary tile grid, a weekly ring and a 3-month dot calendar.
Glass cards, floating pill nav with SVG icons, gentle parallax, and an entrance animation that runs only on tab switch (off with reduced motion).
Users can set their own photo per tab (Settings → Backgrounds), stored on the device in IndexedDB `bg:<tab>` and never committed: third-party photos must not enter this public repo.
**Gotcha:** `body` carries `data-tab`, so tab clicks match only `button[data-tab]`.

## UI decisions
Dark theme, mobile-first, 5 tabs (Home/Train/Progress/Skills/Body) plus Settings. Suggested values appear as dimmed placeholders;
tapping ✓ accepts them, so a set needs no typing. Quick buttons: Prev wt, +2.5, +5, BW, ±Set, Skip, Note. The rest timer starts
on ✓ using the category's rest time and keeps time by timestamp, so it survives backgrounding.

## Known limitations
- Hosting: GitHub Pages from this repo's `main` branch (root). Pushing to `main` deploys. Keep personal data out of this public repo: the user's goal, stats and logs live only in their browser and their Obsidian vault.
- iOS can't write folders directly → backup-file route. Photos reach the vault only through a Chrome/Edge sync from the same device that took them (they aren't in the JSON backup).
- A workout note's "Next session" section is a snapshot taken at sync time; later check-ins update the app and Tendon Log, not that note.
- Notes created by hand in Obsidian (`Templates/`) are not read back into the app.
- Editing the program is JSON-based (Settings → Advanced). It refuses to remove exercises that have logged history.

## Status (2026-11-18)
Live on GitHub Pages and installed on the user's phone. App code moved here from the user's notes vault (this repo is now the only copy);
the vault keeps only the `Fitness/` notes. **Next:** link the vault in Chrome/Edge on the laptop, first real sync, Dataview check.
