// Laptop sync: merges every Fitness/_data/tiger-backup*.json in the vault and (re)writes the Markdown notes.
// Usage:  node sync.mjs <vaultPath>   (the folder that contains Fitness/)
import fs from 'node:fs/promises';
import path from 'node:path';
import { merge, newDb, validate, upgrade } from './logic.js';
import { syncWith, ROOT } from './md.js';

if (!process.argv[2]) { console.error('Usage: node sync.mjs <path to your Obsidian vault>'); process.exit(1); }
const vault = path.resolve(process.argv[2]);
const io = {
  read: p => fs.readFile(path.join(vault, p), 'utf8').catch(() => null),
  write: async (p, c) => { await fs.mkdir(path.dirname(path.join(vault, p)), { recursive: true }); await fs.writeFile(path.join(vault, p), c); },
  list: d => fs.readdir(path.join(vault, d)).catch(() => []),
  remove: p => fs.rm(path.join(vault, p), { force: true }),
};
let base = upgrade(JSON.parse(await io.read(`${ROOT}/_data/tiger-backup.json`) || 'null'));
if (!base) { base = newDb(); for (const k of ['settings', 'program', 'skills', 'tests']) base[k]._u = ''; } // fresh defaults never override real data
const errs = validate(base); if (errs.length) { console.error('Backup invalid:', errs); process.exit(1); }
const { report } = await syncWith(io, base, (a, b) => validate(b).length ? a : merge(a, b));
console.log(`Vault: ${vault}\nwritten ${report.written}, unchanged ${report.same}, new workouts merged ${report.merged}`);
if (report.kept.length) console.log('Kept your Obsidian edits (not overwritten):\n  ' + report.kept.join('\n  '));
