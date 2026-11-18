// Pure logic: no DOM. Shared by the app (browser) and sync.mjs (Node).
import { KINDS, CATEGORIES, EXERCISES, TEMPLATES, BLOCKS, SKILL_TREES, TESTS, DEFAULT_SETTINGS, REGIONS } from './program.js';

export const SCHEMA = 2;
const ARRAYS = ['workouts', 'measurements', 'results', 'checkins', 'photos', 'revisions', 'trash', 'archive'];
export const uid = p => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const localDate = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
export const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
export const num = v => (v === '' || v == null || isNaN(+v) ? null : +v);
const clone = o => JSON.parse(JSON.stringify(o));
const now = () => new Date().toISOString();

// ---------- db ----------
export function newDb() {
  const t = now();
  return {
    schema: SCHEMA, createdAt: t, updatedAt: t,
    settings: { ...clone(DEFAULT_SETTINGS), categories: clone(CATEGORIES), _u: t },
    program: { exercises: clone(EXERCISES), templates: clone(TEMPLATES), blocks: clone(BLOCKS), _u: t },
    skills: { trees: clone(SKILL_TREES), status: {}, _u: t },
    tests: { defs: clone(TESTS), _u: t },
    ...Object.fromEntries(ARRAYS.map(k => [k, []])),
  };
}

// Schema migrations. Never touches logged records; the old program/skills are archived first.
export function upgrade(db) {
  if (!db || db.schema === SCHEMA) return db;
  if (db.schema === 1) {
    const t = now();
    db.archive = db.archive || [];
    db.archive.push({ id: uid('a'), at: t, updatedAt: t, reason: 'schema 1 → 2 program update', program: db.program, skills: db.skills, tests: db.tests });
    const seedIds = new Set(EXERCISES.map(e => e.id));
    db.program = { exercises: [...clone(EXERCISES), ...db.program.exercises.filter(e => !seedIds.has(e.id))], templates: clone(TEMPLATES), blocks: clone(BLOCKS), _u: t };
    db.skills = { trees: clone(SKILL_TREES), status: db.skills?.status || {}, _u: t };
    const tIds = new Set(db.tests.defs.map(d => d.id));
    db.tests = { defs: [...db.tests.defs, ...clone(TESTS).filter(d => !tIds.has(d.id))], _u: t };
    db.settings.categories = { ...clone(CATEGORIES), ...db.settings.categories };
    db.settings.painCap ??= 3; db.settings._u = t;
    for (const k of ARRAYS) db[k] ||= [];
    db.schema = 2;
  }
  return db;
}

export function validate(db) {
  const errs = [];
  if (!db || typeof db !== 'object') return ['not an object'];
  if (db.schema !== SCHEMA) errs.push(`schema ${db.schema} ≠ ${SCHEMA}`);
  for (const k of ARRAYS)
    if (!Array.isArray(db[k])) errs.push(`${k} missing`);
  for (const k of ['settings', 'program', 'skills', 'tests']) if (!db[k] || typeof db[k] !== 'object') errs.push(`${k} missing`);
  for (const w of db.workouts || []) {
    if (!w.id || !/^\d{4}-\d\d-\d\d$/.test(w.date) || !Array.isArray(w.entries)) { errs.push(`bad workout ${w.id}`); continue; }
    for (const e of w.entries) if (!e.id || !e.ex || !Array.isArray(e.sets)) errs.push(`bad entry in ${w.id}`);
  }
  return errs;
}

// Union by id; the copy with the later updatedAt wins. Config blobs: later _u wins. Never drops records.
export function merge(a, b) {
  const out = clone(a); b = upgrade(clone(b));
  for (const k of ARRAYS) {
    const m = new Map(out[k].map(x => [x.id, x]));
    for (const x of b[k] || []) {
      const cur = m.get(x.id);
      if (!cur || (x.updatedAt || '') > (cur.updatedAt || '')) m.set(x.id, clone(x));
    }
    out[k] = [...m.values()];
  }
  // a record trashed on either side stays trashed
  const trashed = new Set(out.trash.map(t => t.id));
  for (const k of ['workouts', 'measurements', 'results', 'checkins', 'photos']) out[k] = out[k].filter(x => !trashed.has(x.id));
  const status = { ...(b.skills?.status || {}) };
  for (const [k, v] of Object.entries(out.skills.status || {})) if (!status[k] || v.state === 'done' || (v.date || '') > (status[k].date || '')) status[k] = v;
  for (const k of ['settings', 'program', 'skills', 'tests'])
    if (b[k] && (b[k]._u || '') > (out[k]._u || '')) out[k] = clone(b[k]);
  out.skills.status = status; // per-level union: progress on either device is never lost
  out.updatedAt = now();
  return out;
}

// ---------- lookups ----------
export const exMap = db => Object.fromEntries(db.program.exercises.map(e => [e.id, e]));
export const catCfg = (db, ex) => ({ ...(db.settings.categories[ex.cat] || {}), ...(ex.inc != null ? { inc: ex.inc } : {}) });
export const fields = ex => KINDS[ex.kind] || ['r'];
export const doneSets = en => (en.skipped ? [] : en.sets.filter(s => s.done));
export const doneWorkouts = db => db.workouts.filter(w => w.status === 'done')
  .sort((a, b) => (b.date + (b.startedAt || '')).localeCompare(a.date + (a.startedAt || '')));

// entries for an exercise, newest first, excluding a workout and anything dated after `before`
export function history(db, exId, { exclude, before, variant } = {}) {
  const out = [];
  for (const w of doneWorkouts(db)) {
    if (w.id === exclude || (before && w.date > before)) continue;
    for (const e of w.entries) if (e.ex === exId && doneSets(e).length && (!variant || e.variant === variant)) out.push({ ...e, date: w.date, wid: w.id });
  }
  return out;
}

// ---------- formatting ----------
export function fmtW(ex, w) {
  w = +w || 0;
  return ex.added ? (w > 0 ? `+${w}` : w < 0 ? `assist ${-w}` : 'BW') : `${w}`;
}
export function fmtSet(ex, s) {
  const d = `${s.d ?? ''}${ex.dUnit || ''}`;
  const main = {
    load: () => `${fmtW(ex, s.w)} × ${s.r ?? '?'}`, reps: () => `${s.r ?? '?'}`, practice: () => `${s.r ?? '?'}`,
    time: () => `${s.t ?? '?'}s`, jump: () => d, sprint: () => `${s.d ?? '?'}m ${s.t ?? '?'}s`,
    carry: () => `${s.w ?? '?'} × ${s.d ?? '?'}m`,
  }[ex.kind] || (() => JSON.stringify(s));
  return main() + (s.rpe ? ` @${s.rpe}` : '');
}
export function fmtTarget(ex, t) {
  const sets = t.setsMax ? `${t.sets}–${t.setsMax}` : `${t.sets}`;
  const unit = { time: ' s', sprint: ' m', carry: ' m', jump: '' }[ex.kind] ?? '';
  return `${sets} × ${t.min}${t.max !== t.min ? '–' + t.max : ''}${unit}${ex.side ? ' / side' : ''}`;
}

// ---------- records ----------
const E1RM_CATS = new Set(['strength', 'hypertrophy', 'isolation']);
// Epley. Only for plain loaded lifts, 1–12 reps. Never for added-load BW, jumps, sprints, holds, skills.
export function e1rm(ex, w, r) {
  if (ex.kind !== 'load' || ex.added || !E1RM_CATS.has(ex.cat) || !(w > 0) || !(r >= 1 && r <= 12)) return 0;
  return Math.round(r === 1 ? w : w * (1 + r / 30));
}

export function bests(ex, entries) {
  const b = { n: 0, maxW: null, maxWR: 0, repsAt: {}, e1rm: 0, maxR: 0, maxT: 0, maxD: 0, sprint: {}, carry: null };
  for (const en of entries) for (const s of doneSets(en)) {
    b.n++;
    const w = num(s.w) ?? 0, r = num(s.r) ?? 0, t = num(s.t) ?? 0, d = num(s.d) ?? 0;
    if (ex.kind === 'load') {
      if (b.maxW === null || w > b.maxW || (w === b.maxW && r > b.maxWR)) { b.maxW = w; b.maxWR = r; }
      b.repsAt[w] = Math.max(b.repsAt[w] || 0, r);
      b.e1rm = Math.max(b.e1rm, e1rm(ex, w, r));
    } else if (ex.kind === 'carry') {
      if (!b.carry || w > b.carry.w || (w === b.carry.w && d > b.carry.d)) b.carry = { w, d };
    } else if (ex.kind === 'sprint') {
      if (t > 0 && (!b.sprint[d] || t < b.sprint[d])) b.sprint[d] = t;
    }
    b.maxR = Math.max(b.maxR, r); b.maxT = Math.max(b.maxT, t); b.maxD = Math.max(b.maxD, d);
  }
  return b;
}

// PRs of one entry against prior bests. First-ever log is a baseline, not a PR.
export function prsFor(ex, entry, prior) {
  if (!prior.n) return [];
  const cur = bests(ex, [entry]); const out = [];
  if (!cur.n) return out;
  if (ex.kind === 'load') {
    if (cur.maxW > prior.maxW) out.push(`Heaviest: ${fmtW(ex, cur.maxW)} × ${cur.maxWR}`);
    for (const [w, r] of Object.entries(cur.repsAt))
      if (prior.repsAt[w] != null && r > prior.repsAt[w]) out.push(`Rep PR: ${fmtW(ex, +w)} × ${r} (was ${prior.repsAt[w]})`);
    if (cur.e1rm > prior.e1rm && prior.e1rm) out.push(`e1RM: ${cur.e1rm}`);
  } else if (ex.kind === 'reps' && cur.maxR > prior.maxR) out.push(`Max reps: ${cur.maxR}`);
  else if (ex.kind === 'time' && cur.maxT > prior.maxT) out.push(`Longest hold: ${cur.maxT}s`);
  else if (ex.kind === 'jump' && cur.maxD > prior.maxD) out.push(`Best jump: ${cur.maxD}${ex.dUnit || ''}`);
  else if (ex.kind === 'sprint') {
    for (const [d, t] of Object.entries(cur.sprint))
      if (prior.sprint[d] && t < prior.sprint[d]) out.push(`Fastest ${d}m: ${t}s (was ${prior.sprint[d]}s)`);
  } else if (ex.kind === 'carry' && prior.carry &&
    (cur.carry.w > prior.carry.w || (cur.carry.w === prior.carry.w && cur.carry.d > prior.carry.d)))
    out.push(`Carry: ${cur.carry.w} × ${cur.carry.d}m`);
  return out;
}

export function workoutPRs(db, w) {
  const X = exMap(db), out = [];
  for (const en of w.entries) {
    const ex = X[en.ex]; if (!ex) continue;
    const prior = bests(ex, history(db, ex.id, { exclude: w.id, before: w.date, variant: en.variant }));
    for (const text of prsFor(ex, en, prior)) out.push({ ex: ex.id, name: ex.name + (en.variant ? ` (${varName(ex, en.variant)})` : ''), text, date: w.date });
  }
  return out;
}

// One number per session for charts.
export function metricOf(ex, entry, { dist, metric } = {}) {
  const b = bests(ex, [entry]);
  if (!b.n) return null;
  if (metric === 'bwReps') return b.repsAt[0] ?? null;
  if (metric === 'topW') return b.maxW;
  switch (ex.kind) {
    case 'load': return b.e1rm || (b.maxW > 0 ? b.maxW : b.maxR);
    case 'reps': case 'practice': return b.maxR;
    case 'time': return b.maxT;
    case 'jump': return b.maxD;
    case 'carry': return b.carry.w;
    case 'sprint': return dist != null ? b.sprint[dist] ?? null : Math.min(...Object.values(b.sprint));
  }
  return null;
}
export const metricLabel = ex => ex.kind === 'load'
  ? (e1rm(ex, 100, 5) ? 'e1RM' : 'top weight / BW reps')
  : { reps: 'max reps', practice: 'max reps', time: 'longest hold (s)', jump: `best (${ex.dUnit || ''})`, carry: 'top weight', sprint: 'fastest (s)' }[ex.kind];

// ---------- pain / regions ----------
export const varName = (ex, v) => ex?.vars?.find(x => x.id === v)?.name || v;
// Next-day check-in after `date` (within 2 days): worst pain over the exercise's regions.
export function nextDayPain(db, ex, date) {
  const c = (db.checkins || []).filter(c => c.date > date && days(date, c.date) <= 2).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!c || !ex.rg?.length) return null;
  const v = ex.rg.map(r => num(c.regions?.[r])).filter(x => x != null);
  return v.length ? Math.max(...v) : null;
}
// Regions above the pain cap in the last 3 days (check-ins + pain logged during sets).
export function regionFlags(db, today = localDate()) {
  const cap = db.settings.painCap ?? 3, X = exMap(db), worst = {};
  const bump = (r, v, src) => { if (v != null && v > (worst[r]?.pain ?? -1)) worst[r] = { id: r, name: REGIONS[r] || r, pain: v, src }; };
  for (const c of db.checkins || []) if (days(c.date, today) <= 3 && days(c.date, today) >= 0) for (const [r, v] of Object.entries(c.regions || {})) bump(r, num(v), 'check-in');
  for (const w of doneWorkouts(db)) {
    if (days(w.date, today) > 3) break;
    for (const e of w.entries) if (num(e.pain) != null) for (const r of X[e.ex]?.rg || []) bump(r, +e.pain, X[e.ex].name);
  }
  return Object.values(worst).filter(r => r.pain > cap);
}

// ---------- progression ----------
const roundTo = (v, step) => Math.round(v / step) * step;

// Returns { text, ph: [per-set placeholder objects], warn? }.
// Progression is never suggested just for finishing: it needs the range hit + RPE/form/pain confirmation + no pain flags.
export function suggest(db, ex, tgt, hist) {
  const cfg = catCfg(db, ex), last = hist[0], cap = db.settings.painCap ?? 3;
  const RISK = { caution: '⚠ Mats + spotter recommended.', coach: '⛔ Coached setting only.' };
  const flags = regionFlags(db).filter(r => ex.rg?.includes(r.id));
  const flagTxt = flags.map(r => `${r.name} ${r.pain}/10`).join(', ');
  if (cfg.model === 'practice') {
    return { text: `${flags.length ? `⚠ ${flagTxt} — keep it pain-free or skip. ` : ''}Quality reps, stop before form breaks.${ex.risk ? ' ' + RISK[ex.risk] : ''}`, ph: phFrom(last), warn: !!flags.length };
  }
  if (!last) {
    const t = { double: ex.kind === 'load' ? (ex.added ? `First log: bodyweight (or assisted) — add load only once you pass ${tgt.max} reps.` : `First log: pick a weight you could do ~${tgt.max + 2} times.`) : 'First log: baseline.',
      time: 'First log: baseline hold.', tendon: 'First log: start light — pain ≤ 3/10. Log pain 0–10.', performance: 'Baseline. Max intent, full rest.' }[cfg.model];
    return { text: (flags.length ? `⚠ ${flagTxt}. ` : '') + (t || 'First log.'), ph: [], warn: !!flags.length };
  }
  const sets = doneSets(last), ph = phFrom(last);
  // 1. pain gate: during-set pain, next-day response, any irritated region this exercise loads
  const lastPain = num(last.pain), nd = nextDayPain(db, ex, last.date);
  const worst = Math.max(lastPain ?? 0, nd ?? 0, ...flags.map(f => f.pain));
  const where = [lastPain > cap && `${lastPain}/10 during`, nd > cap && `${nd}/10 next day`, flags.length && flagTxt].filter(Boolean).join(', ');
  if (worst > 5) {
    const W = Math.max(...sets.map(s => num(s.w) ?? 0));
    return { text: `↓ Pain ${where} — cut load ~25% or switch to a pain-free isometric. Rising across sessions → stop and see a physio.`, warn: true,
      ph: W > 0 && fields(ex).includes('w') && !ex.added ? ph.map(p => ({ ...p, w: roundTo(W * 0.75, 2.5) })) : ph };
  }
  if (worst > cap) return { text: `Hold — pain ${where} (cap ${cap}/10). Repeat this load until it settles.`, ph, warn: true };
  if (cfg.model === 'performance') {
    const b = bests(ex, hist);
    const best = ex.kind === 'sprint' ? Object.entries(b.sprint).map(([d, t]) => `${d}m ${t}s`).join(', ') : `${b.maxD || b.maxR}${ex.dUnit || ''}`;
    return { text: `Best: ${best}. Full rest; stop when quality drops.`, ph };
  }
  const key = { time: 't', carry: 'd' }[ex.kind] || 'r';
  const vals = sets.map(s => num(s[key]) ?? 0);
  const complete = sets.length >= tgt.sets;
  const allMax = complete && vals.every(v => v >= tgt.max);
  const allMin = vals.every(v => v >= tgt.min);
  const rpes = sets.map(s => num(s.rpe)).filter(v => v != null);
  const rpeOk = !rpes.length || Math.max(...rpes) <= (cfg.rpeCap ?? 10);
  const confirmed = cfg.model === 'tendon' ? lastPain != null : (rpes.length > 0 || last.form === 'good');
  const lastTxt = vals.join(', ');
  const need = cfg.model === 'tendon' ? 'log pain 0–10' : 'log RPE or tap Form ✓';

  if (last.form === 'off') return { text: `Hold — form flagged last session. Same load, own the technique (last ${lastTxt}).`, ph };
  if (allMax && !confirmed) return { text: `Top of range hit — ${need} this session to confirm before progressing.`, ph };
  if (allMax && !rpeOk) return { text: `Hold — range hit but RPE above ${cfg.rpeCap}.`, ph };

  if (cfg.model === 'time' || (cfg.model === 'tendon' && ex.kind === 'time') || !fields(ex).includes('w')) {
    if (allMax) {
      const i = ex.vars?.findIndex(v => v.id === last.variant) ?? -1, nv = i >= 0 ? ex.vars[i + 1] : null;
      const step = nv ? `try ${nv.name} (keep ${ex.vars[i].name} as back-off)` : ex.kind === 'time' ? `+${cfg.inc || 5}s or add load/band` : 'harder variation, slower tempo or add load';
      return { text: `↑ Top of range on every set → ${step}.`, ph };
    }
    return { text: `Beat last: ${lastTxt}.`, ph };
  }
  // double progression on load (also tendon loaded work, which needed pain logged)
  const W = Math.max(...sets.map(s => num(s.w) ?? 0));
  const atTop = sets.every(s => (num(s.w) ?? 0) === W);
  const inc = cfg.inc || 5;
  if (allMax && atTop) {
    const nw = W + inc;
    return { text: `↑ ${fmtW(ex, nw)} — hit ${tgt.max} on all sets${cfg.model === 'tendon' ? ` with pain ${lastPain}/10` : ''}.`, ph: ph.map(p => ({ ...p, w: nw, [key]: tgt.min })) };
  }
  if (allMin) return { text: `Same weight, add reps (last ${lastTxt}).`, ph };
  const prev = hist[1] && doneSets(hist[1]);
  const prevBelow = prev && prev.length && prev.some(s => (num(s[key]) ?? 0) < tgt.min) && Math.max(...prev.map(s => num(s.w) ?? 0)) === W;
  if (prevBelow && W > 0) {
    const nw = roundTo(W * 0.9, ex.added ? 2.5 : 5);
    return { text: `↓ Below range twice at ${fmtW(ex, W)} → reset to ${fmtW(ex, nw)}.`, ph: ph.map(p => ({ ...p, w: nw })) };
  }
  return { text: `Same weight, consolidate (last ${lastTxt}).`, ph };
}
function phFrom(last) {
  return last ? doneSets(last).map(({ w, r, t, d }) => ({ w, r, t, d })) : [];
}

// ---------- skills: measurable unlocks ----------
export function critText(crit, X) {
  if (!crit) return 'manual check-off';
  const ex = X[crit.ex], u = { t: 's', r: ' reps', d: '' }[crit.f];
  return `${crit.sets > 1 ? `${crit.sets} × ` : ''}${crit.min}${u}${crit.w != null ? ` at ${fmtW(ex || {}, crit.w)}` : ''} — ${ex?.name || crit.ex}${crit.v ? ` (${varName(ex, crit.v)})` : ''}`;
}
// Earliest logged session that meets the criterion, or null.
export function skillEvidence(db, crit) {
  if (!crit) return null;
  for (const w of [...doneWorkouts(db)].reverse()) for (const e of w.entries) {
    if (e.ex !== crit.ex || (crit.v && e.variant !== crit.v)) continue;
    const ok = doneSets(e).filter(s => (num(s[crit.f]) ?? 0) >= crit.min && (num(s.w) ?? 0) >= (crit.w ?? 0)).length;
    if (ok >= (crit.sets || 1)) return { date: w.date, wid: w.id };
  }
  return null;
}
// Mark every step whose criterion is now met. Returns names of newly unlocked steps.
export function autoUnlock(db) {
  const out = [];
  for (const t of db.skills.trees) for (const s of t.steps) {
    const k = `${t.id}/${s.id}`; if (db.skills.status[k]?.state === 'done' || !s.crit) continue;
    const ev = skillEvidence(db, s.crit);
    if (ev) { db.skills.status[k] = { state: 'done', date: ev.date, wid: ev.wid, auto: true }; out.push(`${t.name}: ${s.name}`); }
  }
  if (out.length) db.skills._u = now();
  return out;
}

// ---------- volume / weekly ----------
export function volumeOf(db, w) {
  const X = exMap(db); let tonnage = 0, sets = 0;
  for (const e of w.entries) { const ex = X[e.ex]; if (!ex) continue;
    for (const s of doneSets(e)) { sets++; if (ex.kind === 'load' && !ex.added) tonnage += (num(s.w) || 0) * (num(s.r) || 0) * (ex.side ? 2 : 1); } }
  return { sets, tonnage: Math.round(tonnage) };
}
export function weekly(db, today = localDate(), n = 7) {
  const from = localDate(new Date(Date.parse(today) - (n - 1) * 864e5)), X = exMap(db);
  const ws = doneWorkouts(db).filter(w => w.date >= from && w.date <= today);
  const sets = {}, pains = []; let tonnage = 0, tendon = 0;
  for (const w of ws) {
    let t = false; tonnage += volumeOf(db, w).tonnage;
    for (const e of w.entries) { const ex = X[e.ex], n2 = doneSets(e).length; if (!ex || !n2) continue;
      sets[ex.cat] = (sets[ex.cat] || 0) + n2; if (ex.cat === 'tendon') t = true; if (num(e.pain) != null) pains.push(+e.pain); }
    if (t) tendon++;
  }
  const ck = (db.checkins || []).filter(c => c.date >= from && c.date <= today);
  const sore = ck.map(c => num(c.soreness)).filter(v => v != null);
  return { sessions: ws.length, sets, tonnage, tendonSessions: tendon, painMax: pains.length ? Math.max(...pains) : null,
    checkins: ck.length, soreness: sore.length ? Math.round(sore.reduce((a, b) => a + b, 0) / sore.length * 10) / 10 : null };
}

// ---------- rotation / schedule ----------
export function schedule(db, today = localDate()) {
  const rot = db.settings.rotation, fb = doneWorkouts(db).filter(w => rot.includes(w.type));
  const last = fb[0];
  const next = last ? rot[(rot.indexOf(last.type) + 1) % rot.length] : rot[0];
  const gap = last ? days(last.date, today) : null;
  let todayPlan;
  if (gap === 0) todayPlan = { kind: 'done', type: last.type };
  else if (gap === 1) todayPlan = { kind: 'skill', type: next };
  else todayPlan = { kind: 'train', type: next };
  // streak: consecutive FBEOD sessions with ≤3-day gaps, ending within 3 days of today
  let streak = 0;
  if (last && gap <= 3) { streak = 1; for (let i = 1; i < fb.length && days(fb[i].date, fb[i - 1].date) <= 3; i++) streak++; }
  const weekAgo = localDate(new Date(Date.parse(today) - 6 * 864e5));
  const week = doneWorkouts(db).filter(w => w.date >= weekAgo && w.date <= today);
  return { last, next, gap, todayPlan, streak,
    week: { fbeod: week.filter(w => rot.includes(w.type)).length, skill: week.filter(w => !rot.includes(w.type)).length } };
}

export function recoveryNotes(db, sch, today = localDate()) {
  const n = [], X = exMap(db);
  for (const f of regionFlags(db, today)) n.push(`${f.name} at ${f.pain}/10 (${f.src}) — no progression on exercises loading it; pain-free variations only.`);
  if (sch.gap === 1) n.push(`Yesterday was FBEOD ${sch.last.type}: keep today low-fatigue — mobility, handstand, crawling. No max sprints or heavy jumps.`);
  const fb = doneWorkouts(db).filter(w => db.settings.rotation.includes(w.type));
  if (fb[1] && days(fb[1].date, fb[0].date) === 1) n.push('Back-to-back FBEOD days logged — take a skill day before the next one.');
  if (sch.todayPlan.kind === 'train' && sch.next === 'B') n.push('Power day: jumps and sprints first, fresh, full rest between reps.');
  if (sch.last && sch.gap <= 2) {
    const hard = sch.last.entries.some(e => X[e.ex]?.cat === 'strength' && doneSets(e).some(s => num(s.rpe) >= 9.5));
    if (hard) n.push('Last session had RPE 9.5+ sets — extra warm-up sets today.');
  }
  const ms = db.measurements.filter(m => num(m.bw)).sort((a, b) => a.date.localeCompare(b.date));
  const g = db.settings.goal;
  if (ms.length >= 2 && g?.bwMin) {
    const lastM = ms.at(-1), old = ms.find(m => days(m.date, lastM.date) <= 28);
    if (old && old !== lastM && days(old.date, lastM.date) >= 21 && +lastM.bw < g.bwMin && +lastM.bw - +old.bw <= 0)
      n.push(`Bodyweight flat for ~4 weeks at ${lastM.bw} (goal ${g.bwMin}–${g.bwMax}) — consider a small surplus.`);
  }
  return n;
}

// ---------- workout construction ----------
export function startWorkout(db, tplId, date = localDate()) {
  const tpl = db.program.templates.find(t => t.id === tplId);
  const t = now();
  return {
    id: uid('w'), type: tplId, name: tpl ? tpl.name : 'Session', title: tpl?.title || '', date,
    startedAt: t, updatedAt: t, status: 'active', notes: '',
    entries: (tpl?.items || []).map(it => newEntry(it.ex, it, db)),
  };
}
// Off-day session from chosen blocks (duplicates removed).
export function startOffDay(db, blockIds, date = localDate()) {
  const blocks = db.program.blocks.filter(b => blockIds.includes(b.id)), seen = new Set(), t = now();
  const items = blocks.flatMap(b => b.items).filter(it => !seen.has(it.ex) && seen.add(it.ex));
  return { id: uid('w'), type: 'S', name: 'Off-Day', title: blocks.map(b => b.name).join(' + '), date, startedAt: t, updatedAt: t,
    status: 'active', notes: '', entries: items.map(it => newEntry(it.ex, it, db)) };
}
export function newEntry(exId, tgt = { sets: 3, min: 5, max: 10 }, db) {
  const { ex, ...t } = tgt, e = { id: uid('e'), ex: exId, tgt: t, notes: '', sets: Array.from({ length: t.sets || 1 }, () => ({ id: uid('s') })) };
  const def = db && exMap(db)[exId];
  if (def?.vars) e.variant = history(db, exId)[0]?.variant || def.vars[0].id; // continue at the last variant used
  return e;
}

export function skillCurrent(tree, status) {
  const i = tree.steps.findIndex(s => status[`${tree.id}/${s.id}`]?.state !== 'done');
  return i < 0 ? { done: true, step: tree.steps.at(-1), i: tree.steps.length } : { step: tree.steps[i], i };
}
