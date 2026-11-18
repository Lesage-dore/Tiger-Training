import * as L from './logic.js';
import * as M from './md.js';
import { RISK, REGIONS, TENDON_GUIDE, LIMB_NOTE, DEMO_Q } from './program.js';

// ---------- persistence: localStorage (primary) + IndexedDB mirror ----------
const KEY = 'tiger.db';
const idb = (() => {
  let p; const open = () => p ||= new Promise((res, rej) => { const r = indexedDB.open('tiger', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = async (mode, fn) => { const d = await open(); return new Promise(res => { const t = d.transaction('kv', mode); const q = fn(t.objectStore('kv')); t.oncomplete = () => res(q?.result); t.onerror = () => res(null); }); };
  return { get: k => tx('readonly', s => s.get(k)).catch(() => null), set: (k, v) => tx('readwrite', s => s.put(v, k)).catch(() => null) };
})();
function load() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const raw = JSON.parse(s), was = raw.schema, d = L.upgrade(raw);
      if (!L.validate(d).length) { if (was !== d.schema) { localStorage.setItem(`${KEY}.pre-v${d.schema}`, s); migrated = true; } return d; } localStorage.setItem(`${KEY}.corrupt.${Date.now()}`, s); }
  } catch { }
  return L.newDb();
}
let migrated = false, db = load(), saveT;
if (migrated) persist();
function save(now) { clearTimeout(saveT); if (now) persist(); else saveT = setTimeout(persist, 250); }
function persist() {
  clearTimeout(saveT);
  db.updatedAt = new Date().toISOString();
  const json = JSON.stringify(db);
  try {
    const day = L.localDate();
    if (localStorage.getItem(`${KEY}.daily.date`) !== day && localStorage.getItem(KEY)) {
      localStorage.setItem(`${KEY}.daily`, localStorage.getItem(KEY)); localStorage.setItem(`${KEY}.daily.date`, day);
    }
    localStorage.setItem(KEY, json);
  } catch { toast('⚠ Could not save to browser storage — export a backup now (Settings).'); }
  idb.set('db', json);
}
addEventListener('visibilitychange', () => document.hidden && persist());
addEventListener('pagehide', persist);

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const btn = (label, act, cls = '', v = '') => `<button class="b ${cls}" data-act="${act}" data-v="${esc(v)}">${label}</button>`;
const card = (title, body, extra = '') => `<section class="card" ${extra}>${title ? `<h3>${title}</h3>` : ''}${body}</section>`;
const X = () => L.exMap(db);
const tpl = id => db.program.templates.find(t => t.id === id);
const byId = id => db.workouts.find(w => w.id === id);
const activeW = () => db.workouts.find(w => w.status === 'active');
const nowIso = () => new Date().toISOString();
const clone = o => JSON.parse(JSON.stringify(o));
const addDays = (d, n) => L.localDate(new Date(Date.parse(d + 'T12:00:00') + n * 864e5));
const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const latestBw = () => db.measurements.filter(m => L.num(m.bw)).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
const FL = { w: () => db.settings.unit, r: () => 'reps', t: () => 'sec', d: ex => ex.dUnit || 'dist' };

let ui = { tab: 'home', ex: null, view: null, edit: null, notes: {}, swap: {}, demo: {}, skEdit: false, blocks: new Set(), ck: false };
const RPE = ['', 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10], PAIN = ['', ...Array.from({ length: 11 }, (_, i) => i)];
const sel = (attr, opts, v, label = '') => `<select ${attr}>${opts.map(o => `<option value="${o}" ${String(o) === String(v ?? '') ? 'selected' : ''}>${o === '' ? label : o}</option>`).join('')}</select>`;

// ---------- charts (inline SVG, no deps) ----------
function chart(pts, { band, h = 120 } = {}) {
  pts = pts.filter(p => p.y != null && isFinite(p.y)).sort((a, b) => a.x.localeCompare(b.x));
  if (pts.length < 2) return `<p class="muted">${pts.length ? `One data point: ${pts[0].y}` : 'No data yet.'}</p>`;
  const W = 320, P = 30, xs = pts.map(p => Date.parse(p.x)), ys = pts.map(p => p.y);
  let lo = Math.min(...ys, band ? band[0] : Infinity), hi = Math.max(...ys, band ? band[1] : -Infinity);
  const pad = (hi - lo || 1) * 0.1; lo -= pad; hi += pad;
  const x0 = xs[0], x1 = xs.at(-1) || x0 + 1;
  const fx = t => P + (t - x0) / (x1 - x0 || 1) * (W - P - 8), fy = v => h - 18 - (v - lo) / (hi - lo) * (h - 28);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${fx(xs[i]).toFixed(1)},${fy(p.y).toFixed(1)}`).join('');
  const r = v => Math.round(v * 10) / 10;
  return `<svg class="chart" viewBox="0 0 ${W} ${h}">
    ${band ? `<rect x="${P}" width="${W - P - 8}" y="${fy(band[1])}" height="${Math.max(1, fy(band[0]) - fy(band[1]))}" fill="#3ccf7e22"/>` : ''}
    <path d="${d}" fill="none" stroke="var(--acc)" stroke-width="2"/>
    ${pts.map((p, i) => `<circle cx="${fx(xs[i])}" cy="${fy(p.y)}" r="2.5" fill="var(--acc2)"/>`).join('')}
    <text x="2" y="14">${r(hi - pad)}</text><text x="2" y="${h - 20}">${r(lo + pad)}</text>
    <text x="${P}" y="${h - 3}">${pts[0].x.slice(5)}</text><text x="${W - 8}" y="${h - 3}" text-anchor="end">${pts.at(-1).x.slice(5)}</text></svg>`;
}

// ---------- views ----------
function home() {
  const s = L.schedule(db), a = activeW(), today = L.localDate();
  const tname = id => { const t = tpl(id); return t ? `${t.name} — ${t.title}` : id; };
  const rot = db.settings.rotation, nextOf = t => rot[(rot.indexOf(t) + 1) % rot.length];
  let todayCard, nextTxt;
  const doneToday = L.doneWorkouts(db).filter(w => w.date === today), plan = L.offDayPlan(db, s, today);
  const qbtn = (type, label) => `<p class="muted small" style="margin-top:8px">${label} ${btn(type === 'S' ? 'Mark off-day done' : `Mark FBEOD ${type} done`, 'quick', 'ghost sm', type)}</p>`;
  if (a) todayCard = card('Today', `<h2>${esc(a.name)} in progress</h2>${btn('Resume', 'tab', 'primary', 'log')}`);
  else if (s.todayPlan.kind === 'train') todayCard = card('Training day', `<h2>${esc(tname(s.next))}</h2><p class="muted">${esc(tpl(s.next)?.purpose)}</p>
    ${planList(tpl(s.next)?.items || [])}${btn(`Start FBEOD ${s.next}`, 'start', 'primary', s.next)}${qbtn(s.next, 'Already trained today without the app?')}`);
  else if (s.todayPlan.kind === 'skill' && !doneToday.length) todayCard = card('Rest day · light skill work', `<h2>${esc(plan.name)}</h2>
    <p class="muted">${plan.why ? `Recovery day: ${esc(plan.why)}. ` : ''}Low fatigue — quality over effort. FBEOD ${s.next} is tomorrow.</p>
    ${planList(plan.blocks.flatMap(b => db.program.blocks.find(x => x.id === b)?.items || []))}
    <div class="row">${btn('Start off-day', 'start-plan', 'primary', plan.id)}${btn('Change blocks', 'tab', 'ghost sm', 'log')}</div>${qbtn('S', 'Did it already, or taking full rest?')}`);
  else todayCard = card('Done for today', `<h2>✓ ${esc(doneToday.map(w => w.name).join(' + ') || 'FBEOD ' + s.todayPlan.type)} done</h2>
    <p class="muted">${s.todayPlan.kind === 'done' ? `Rest of the day: eat, sleep, optional 10 min easy mobility. Tomorrow is an off-day; FBEOD ${s.next} after that.` : `Next: FBEOD ${s.next} tomorrow.`}</p>
    ${doneToday.filter(w => w.quick).map(w => btn(`Undo “${esc(w.name)} done”`, 'undo-quick', 'ghost sm', w.id)).join('')}`);
  if (s.todayPlan.kind === 'train') nextTxt = `FBEOD ${nextOf(s.next)} · ${fmtDate(addDays(today, 2))}`;
  else if (s.todayPlan.kind === 'skill') nextTxt = `FBEOD ${s.next} · tomorrow`;
  else nextTxt = `FBEOD ${s.next} · ${fmtDate(addDays(today, 2))}`;

  const bw = db.measurements.filter(m => L.num(m.bw)).map(m => ({ x: m.date, y: +m.bw }));
  const lb = latestBw(), g = db.settings.goal;
  const prs = L.doneWorkouts(db).flatMap(w => w.prs || []).slice(0, 5);
  const last = L.doneWorkouts(db)[0];
  const notes = L.recoveryNotes(db, s);
  const unsynced = L.doneWorkouts(db).filter(w => (w.updatedAt || '') > (db.lastSync || '')).length;
  const skills = db.skills.trees.slice(0, 6).map(t => { const c = L.skillCurrent(t, db.skills.status); return `<li><span>${esc(t.name)}</span><span class="muted">${c.done ? '✓ complete' : esc(c.step.name)}</span></li>`; }).join('');

  return todayCard +
    `<div class="stats"><div class="stat"><span>Next</span><b style="font-size:14px">${nextTxt}</b></div>
     <div class="stat"><span>Rotation</span><b>${rot.map(t => `<span class="chip ${t === s.next && !a ? 'on' : ''}">${t}</span>`).join(' ')}</b></div>
     <div class="stat"><span>Streak · week</span><b>${s.streak} <small class="muted">· ${s.week.fbeod}F ${s.week.skill}S</small></b></div></div>` +
    checkinCard(s) + (notes.length ? card('Recovery', `<ul class="list">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`) : '') + weekCard() +
    card('Bodyweight', `<div class="row"><b style="font-size:20px">${lb ? lb.bw + ' ' + db.settings.unit : '—'}</b><span class="muted grow">${g.bwMin ? `goal ${g.bwMin}–${g.bwMax}` : 'no goal set'}</span>${btn('Log', 'tab', 'sm', 'body')}</div>${bw.length > 1 ? chart(bw.slice(-20), { band: g.bwMin ? [g.bwMin, g.bwMax] : null, h: 80 }) : ''}`) +
    card('Recent PRs', prs.length ? `<ul class="list">${prs.map(p => `<li><span>🏆 ${esc(p.name)}</span><span class="muted">${esc(p.text)} · ${p.date.slice(5)}</span></li>`).join('')}</ul>` : '<p class="muted">PRs appear after your second session of an exercise.</p>') +
    perfCard() + (last ? card('Last workout', `<ul class="list"><li class="click" data-act="view" data-v="${last.id}"><span>${esc(last.name)} · ${fmtDate(last.date)}</span><span class="muted">${last.entries.filter(e => L.doneSets(e).length).length} exercises ›</span></li></ul>`) : '') +
    card('Skills', `<ul class="list">${skills}</ul>`) +
    (unsynced ? `<p class="muted small" style="text-align:center">${unsynced} workout(s) not yet in Obsidian · <a href="#" data-act="tab" data-v="settings" style="color:var(--acc)">sync / export</a></p>` : '');
}

// Next-morning check-in: regions loaded by the last session + overall soreness.
function checkinCard(s) {
  const today = L.localDate(), last = L.doneWorkouts(db)[0], done = db.checkins.find(c => c.date === today);
  const due = last && last.date < today && L.days(last.date, today) <= 2 && !done;
  if (!due && !ui.ck) return `<div class="row" style="margin:6px 0">${done ? `<span class="muted small grow">✓ Check-in today · soreness ${done.soreness ?? '–'}</span>` : '<span class="grow"></span>'}${btn(done ? 'Add to check-in' : 'Log check-in', 'ck-open', 'sm ghost')}</div>`;
  const X0 = X(), loaded = new Set((last?.entries || []).filter(e => L.doneSets(e).length).flatMap(e => X0[e.ex]?.rg || []));
  const regs = Object.entries(REGIONS).sort((a, b) => loaded.has(b[0]) - loaded.has(a[0]));
  return card(due ? `Check-in · after ${esc(last.name)} (${last.date.slice(5)})` : 'Check-in', `<p class="muted small">Pain 0–10 at each tendon/joint this morning. Muscle soreness goes in the soreness rating.</p>
    <div class="form"><div><label>Muscle soreness</label>${sel('id="ck-sore"', PAIN, done?.soreness, '–')}</div>
    ${regs.map(([r, n]) => `<div><label>${loaded.has(r) ? '● ' : ''}${esc(n)}</label>${sel(`data-ckr="${r}"`, PAIN, done?.regions?.[r], '–')}</div>`).join('')}</div>
    <input id="ck-notes" placeholder="Notes (e.g. knee stiff on stairs, eased after warm-up)" style="margin-top:8px">
    <div class="row" style="margin-top:8px">${btn('Save check-in', 'save-ck', 'primary sm')}${btn('Later', 'ck-open', 'ghost sm')}</div>
    <details><summary>Muscle fatigue vs tendon irritation</summary><ul class="list small">${TENDON_GUIDE.map(g => `<li>${esc(g)}</li>`).join('')}</ul></details>`);
}

function weekCard() {
  const wk = L.weekly(db), cats = db.settings.categories;
  if (!wk.sessions) return '';
  const chips = Object.entries(wk.sets).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<span class="chip">${esc(cats[c]?.label || c)} ${n}</span>`).join(' ');
  return card('Last 7 days', `<div class="stats" style="margin-bottom:8px"><div class="stat"><span>Sessions</span><b>${wk.sessions}</b></div>
    <div class="stat"><span>Tonnage</span><b>${wk.tonnage.toLocaleString()}</b></div><div class="stat"><span>Tendon days</span><b>${wk.tendonSessions}${wk.painMax != null ? ` <small class="muted">max ${wk.painMax}/10</small>` : ''}</b></div></div>
    <p class="small">${chips}</p>${wk.soreness != null ? `<p class="muted small">Avg soreness ${wk.soreness}/10 over ${wk.checkins} check-in(s)</p>` : ''}`);
}

function perfCard() {
  const ids = ['sprint10', 'sprint20', 'broad', 'vert', 'knee_wall', 'pancake'];
  const rows = db.tests.defs.filter(d => ids.includes(d.id)).map(d => { const p = testPoints(d); if (!p.length) return '';
    const best = d.better === 'lower' ? Math.min(...p.map(x => x.y)) : Math.max(...p.map(x => x.y));
    return `<li><span>${esc(d.name)}</span><span class="muted"><b>${best}</b> ${esc(d.unit)} best · last ${p.at(-1).y}</span></li>`; }).join('');
  return rows ? card('Speed · power · mobility', `<ul class="list">${rows}</ul>`) : '';
}

// Exercise list for a plan, with target, today's suggestion and a demo link.
function planList(items) {
  const X0 = X(), seen = new Set();
  return `<ul class="list plan">${items.filter(it => X0[it.ex] && !seen.has(it.ex) && seen.add(it.ex)).map(it => {
    const ex = X0[it.ex], v = ex.vars ? (L.history(db, ex.id)[0]?.variant || ex.vars[0].id) : undefined;
    const sug = L.suggest(db, ex, it, L.history(db, ex.id, { variant: v }));
    return `<li><div class="grow"><b>${esc(ex.name)}</b>${v ? ` <span class="muted small">${esc(L.varName(ex, v))}</span>` : ''}${sug.warn || !sug.text.startsWith('Quality reps') ? `<div class="muted small ${sug.warn ? 'warnc' : ''}">${esc(sug.text)}</div>` : ''}</div>
      <span class="tgt small">${esc(L.fmtTarget(ex, it))}</span><a class="demo" href="${esc(demoUrl(ex, v))}" target="_blank" rel="noopener" aria-label="Demo">▶</a></li>`; }).join('')}</ul>`;
}
function demoUrl(ex, v, images) {
  if (ex.video && !images) return ex.video;
  const q = DEMO_Q[ex.id] || `${ex.name}${v ? ' ' + L.varName(ex, v) : ''} exercise form`;
  return images ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' tutorial')}`;
}

function startPicker() {
  const s = L.schedule(db);
  return card('Start a session', db.program.templates.map(t =>
    `<div class="row" style="margin:6px 0"><div class="grow"><b>${esc(t.name)}</b> <span class="muted">${esc(t.title)}</span></div>${btn(t.id === s.next ? 'Start · next' : 'Start', 'start', t.id === s.next ? 'primary sm' : 'sm', t.id)}</div>`).join('') +
    `<div class="row" style="margin-top:10px">${btn('Empty session', 'start', 'ghost sm', '')}</div>`) +
    card('Log a session done without the app', `<div class="row"><select id="q-type" style="flex:2">${db.program.templates.map(t => `<option value="${t.id}">${esc(t.name)} — ${esc(t.title)}</option>`).join('')}<option value="S">Off-day</option></select>
      <input id="q-date" type="date" value="${L.localDate()}" style="flex:1.3"></div><div class="row" style="margin-top:8px">${btn('Mark as done', 'quick', 'sm', '')}</div>
      <p class="muted small">Keeps the A → B → C rotation on track. No sets are recorded, so it won't affect PRs or progression.</p>`) +
    card('Off-day — pick blocks', `<div class="q">${db.program.blocks.map(b => `<button data-act="block" data-v="${b.id}" class="${ui.blocks.has(b.id) ? 'good' : ''}">${ui.blocks.has(b.id) ? '✓ ' : ''}${esc(b.name)}</button>`).join('')}</div>
      <p class="muted small">Low fatigue. Leave the heavy stuff for FBEOD days.</p>${btn(`Start off-day${ui.blocks.size ? ` (${ui.blocks.size})` : ''}`, 'start', ui.blocks.size ? 'primary' : '', 'S')}`) +
    (L.doneWorkouts(db).length ? card('History', historyList(5)) : '');
}

function historyList(n) {
  return `<ul class="list">${L.doneWorkouts(db).slice(0, n).map(w => `<li class="click" data-act="view" data-v="${w.id}"><span>${fmtDate(w.date)} · ${esc(w.name)}</span><span class="muted">${(w.prs || []).length ? '🏆' + w.prs.length + ' ' : ''}›</span></li>`).join('')}</ul>`;
}

function entryCard(w, en) {
  const ex = X()[en.ex];
  if (!ex) return card('', `<p class="warn">Unknown exercise “${esc(en.ex)}” (kept, not shown).</p>`);
  const hist = L.history(db, ex.id, { exclude: w.id, before: w.date, variant: en.variant });
  const sug = L.suggest(db, ex, en.tgt, hist), f = L.fields(ex), last = hist[0];
  const prs = L.prsFor(ex, en, L.bests(ex, hist));
  const hasW = f.includes('w');
  const rows = en.sets.map((s, i) => {
    const ph = sug.ph[i] || sug.ph.at(-1) || {};
    const def = k => ph[k] ?? (k === 'd' && ex.kind === 'sprint' ? en.tgt.min : k === 'w' && ex.added ? 0 : k !== 'w' && k !== 'd' ? en.tgt.min : '');
    return `<div class="${s.done ? 'done' : ''}" data-s="${s.id}" style="display:contents">
      <span class="n">${i + 1}</span>${f.map(k => `<input data-f="${k}" inputmode="decimal" autocomplete="off" value="${esc(s[k])}" placeholder="${esc(k === 'w' && ex.kind === 'load' && def(k) !== '' ? L.fmtW(ex, def(k)) : def(k))}" data-ph="${esc(def(k))}">`).join('')}
      ${sel('data-f="rpe" class="rpe"', RPE, s.rpe, 'RPE')}<button class="ck" data-act="done" aria-label="Set done">✓</button></div>`;
  }).join('');
  return `<section class="card ex ${en.skipped ? 'skipped' : ''}" data-e="${en.id}">
    <div class="ex-h"><div><b>${esc(ex.name)}</b><span class="tag">${esc(ex.cat)}</span>${en.subFor ? `<span class="tag">sub</span>` : ''}</div><span class="tgt">${esc(L.fmtTarget(ex, en.tgt))} <button class="demo" data-act="demo" aria-label="How to">▶</button></span></div>
    ${ui.demo[en.id] ? `<div class="q" style="margin-top:6px"><a class="b sm" href="${esc(demoUrl(ex, en.variant))}" target="_blank" rel="noopener">▶ ${ex.video ? 'My demo' : 'Video demos'}</a>
      <a class="b sm" href="${esc(demoUrl(ex, en.variant, true))}" target="_blank" rel="noopener">Images</a><button data-act="demo-set">${ex.video ? 'Change my link' : 'Save my own link'}</button></div>` : ''}
    ${ex.vars ? `<div style="margin-top:6px"><select data-en="variant">${ex.vars.map(v => `<option value="${v.id}" ${v.id === en.variant ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>` : ''}
    ${ui.swap[en.id] ? `<select data-act="swapto" style="margin-top:6px"><option value="">Swap for…</option>${exOptions(ex.cat)}</select>` : ''}
    <div class="prev">${last ? `Prev ${last.date.slice(5)}: ${L.doneSets(last).map(s => esc(L.fmtSet(ex, s))).join(' · ')}` : 'No previous log'}</div>
    <div class="sug ${sug.warn ? 'warnc' : ''}">${esc(sug.text)}</div>${ex.note ? `<div class="muted small">${esc(ex.note)}</div>` : ''}
    ${en.tgt.note ? `<div class="muted small">${esc(en.tgt.note)}</div>` : ''}
    ${ex.risk ? `<div class="warn">⚠ ${esc(RISK[ex.risk])}</div>` : ''}
    ${prs.length ? `<div class="pr-dot">🏆 ${prs.map(esc).join(' · ')}</div>` : ''}
    <div class="sets"><div class="grid g${f.length}"><span></span>${f.map(k => `<span class="lbl">${FL[k](ex)}</span>`).join('')}<span class="lbl">RPE</span><span></span>${rows}</div></div>
    <div class="q">${hasW ? `<button class="w" data-act="prevw">Prev wt</button><button class="w" data-act="inc" data-v="2.5">+2.5</button><button class="w" data-act="inc" data-v="5">+5</button>${ex.added ? '<button class="w" data-act="bw">BW</button><button class="w" data-act="neg">± Assist</button>' : ''}` : ''}
      <button data-act="form" class="${en.form || ''}">Form ${en.form === 'good' ? '✓' : en.form === 'off' ? '✗' : '·'}</button>${ex.rg?.length || ex.cat === 'tendon' ? `<label class="painsel">Pain ${sel('data-en="pain"', PAIN, en.pain, '–')}</label>` : ''}
      <button data-act="swap">Swap</button>
      <button data-act="addset">+Set</button><button data-act="rmset">−Set</button><button data-act="skip">${en.skipped ? 'Unskip' : 'Skip'}</button><button data-act="note">Note</button>
      ${L.doneSets(en).length ? '' : '<button data-act="rmex">Remove</button>'}</div>
    ${ui.notes[en.id] || en.notes ? `<textarea data-en="notes" placeholder="Notes (form, cues, pain…)" style="margin-top:8px">${esc(en.notes)}</textarea>` : ''}
  </section>`;
}

function exOptions(first) {
  const groups = {};
  for (const e of [...db.program.exercises].sort((a, b) => (b.cat === first) - (a.cat === first))) (groups[e.cat] ||= []).push(e);
  return Object.entries(groups).map(([c, es]) => `<optgroup label="${esc(db.settings.categories[c]?.label || c)}">${es.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</optgroup>`).join('');
}

function logView() {
  const w = ui.edit ? byId(ui.edit) : activeW();
  if (!w) return startPicker();
  const editing = !!ui.edit;
  const done = w.entries.reduce((a, e) => a + L.doneSets(e).length, 0), total = w.entries.reduce((a, e) => a + (e.skipped ? 0 : e.sets.length), 0);
  return `<div class="row" style="margin-top:4px"><div class="grow"><h2>${esc(w.name)}${editing ? ' <span class="tag">editing</span>' : ''}</h2><span class="muted">${esc(w.title)} · ${done}/${total} sets</span></div>
      <input type="date" data-wf="date" value="${w.date}" style="width:auto"></div>
    <div class="q">${[60, 90, 120, 180].map(s => `<button data-act="t-start" data-v="${s}">⏱ ${s}s</button>`).join('')}</div>
    ${w.entries.map(en => entryCard(w, en)).join('')}
    ${card('Add exercise', `<select data-act="addex"><option value="">+ choose exercise…</option>${exOptions()}</select>`)}
    ${card('Session notes', `<textarea data-wf="notes" placeholder="Energy, sleep, anything notable">${esc(w.notes)}</textarea>`)}
    <div class="row" style="margin:14px 0 30px">${editing ? btn('Save changes', 'save-edit', 'primary grow') + btn('Cancel', 'cancel-edit', 'ghost') : btn('Finish workout', 'finish', 'primary grow') + btn('Discard', 'discard', 'ghost danger')}</div>`;
}

function workoutView() {
  const w = byId(ui.view); if (!w) { ui.tab = 'progress'; return progressView(); }
  const Xm = X();
  const dur = w.finishedAt ? Math.round((Date.parse(w.finishedAt) - Date.parse(w.startedAt)) / 6e4) : null;
  return `<div class="row"><div class="grow"><h2>${esc(w.name)} — ${fmtDate(w.date)}</h2><span class="muted">${esc(w.title)}${dur > 0 && dur < 600 ? ` · ${dur} min` : ''}${w.editedAt ? ' · edited' : ''}</span></div></div>` +
    ((w.prs || []).length ? card('PRs', `<ul class="list">${w.prs.map(p => `<li><span>🏆 ${esc(p.name)}</span><span class="muted">${esc(p.text)}</span></li>`).join('')}</ul>`) : '') +
    w.entries.filter(e => L.doneSets(e).length).map(e => { const ex = Xm[e.ex] || { name: e.ex, kind: 'reps' }; return card('', `<b>${esc(ex.name)}</b><p class="muted">${L.doneSets(e).map(s => esc(L.fmtSet(ex, s))).join(' · ')}</p>${e.notes ? `<p class="small">${esc(e.notes)}</p>` : ''}`); }).join('') +
    (w.notes ? card('Notes', `<p>${esc(w.notes)}</p>`) : '') +
    `<div class="row" style="margin:14px 0 30px">${btn('Edit', 'edit', '', w.id)}${btn('Copy note', 'copy-md', '', w.id)}${btn('Back', 'tab', 'ghost', 'progress')}<span class="grow"></span>${btn('Delete', 'del-workout', 'ghost danger', w.id)}</div>`;
}

function progressView() {
  const Xm = X(), logged = db.program.exercises.filter(e => L.history(db, e.id).length);
  const exId = ui.ex && Xm[ui.ex] ? ui.ex : logged[0]?.id;
  let exHtml = '<p class="muted">Log a workout to see progression.</p>';
  if (exId) {
    const ex = Xm[exId], h = L.history(db, exId), b = L.bests(ex, h);
    const rows = [];
    if (ex.kind === 'load') { rows.push(['Heaviest', `${L.fmtW(ex, b.maxW)} × ${b.maxWR}`]); if (b.e1rm) rows.push(['Best e1RM', b.e1rm]); if (ex.added && b.repsAt[0]) rows.push(['Max BW reps', b.repsAt[0]]); }
    else if (ex.kind === 'time') rows.push(['Longest', b.maxT + 's']);
    else if (ex.kind === 'jump') rows.push(['Best', b.maxD + (ex.dUnit || '')]);
    else if (ex.kind === 'sprint') for (const [d, t] of Object.entries(b.sprint)) rows.push([`Fastest ${d}m`, t + 's']);
    else if (ex.kind === 'carry' && b.carry) rows.push(['Best', `${b.carry.w} × ${b.carry.d}m`]);
    else rows.push(['Max reps', b.maxR]);
    rows.push(['Sessions', h.length]);
    const repAt = ex.kind === 'load' ? `<details><summary>Most reps at each weight</summary><table>${Object.entries(b.repsAt).sort((a, c) => +c[0] - +a[0]).map(([w, r]) => `<tr><td>${L.fmtW(ex, +w)}</td><td>${r} reps</td></tr>`).join('')}</table></details>` : '';
    exHtml = `<table>${rows.map(r => `<tr><td class="muted">${r[0]}</td><td><b>${esc(r[1])}</b></td></tr>`).join('')}</table>${repAt}
      <p class="muted small" style="margin-top:10px">${esc(L.metricLabel(ex))} per session</p>${chart(h.map(e => ({ x: e.date, y: L.metricOf(ex, e) })))}
      <ul class="list">${h.slice(0, 12).map(e => `<li class="click" data-act="view" data-v="${e.wid}"><span class="muted">${e.date.slice(5)}</span><span>${L.doneSets(e).map(s => esc(L.fmtSet(ex, s))).join(' · ')}</span></li>`).join('')}</ul>`;
  }
  const opts = [...logged, ...db.program.exercises.filter(e => !logged.includes(e))].map(e => `<option value="${e.id}" ${e.id === exId ? 'selected' : ''}>${esc(e.name)}${logged.includes(e) ? '' : ' (no data)'}</option>`).join('');
  const prs = L.doneWorkouts(db).flatMap(w => w.prs || []).slice(0, 12);
  return card('Exercise', `<select data-act="pick-ex">${opts}</select><div style="margin-top:10px">${exHtml}</div>`) +
    card('Athletic performance', testsHtml()) +
    card('PR log', prs.length ? `<ul class="list">${prs.map(p => `<li><span>${esc(p.name)}</span><span class="muted">${esc(p.text)} · ${p.date.slice(5)}</span></li>`).join('')}</ul>` : '<p class="muted">None yet.</p>') +
    card('Workout history', L.doneWorkouts(db).length ? historyList(40) : '<p class="muted">None yet.</p>');
}

function testPoints(def) {
  const pts = db.results.filter(r => r.test === def.id).map(r => ({ x: r.date, y: +r.value }));
  const ex = def.ex && X()[def.ex];
  if (ex) for (const e of L.history(db, ex.id)) { const y = L.metricOf(ex, e, { dist: def.dist, metric: def.metric }); if (y != null && isFinite(y)) pts.push({ x: e.date, y }); }
  return pts.sort((a, b) => a.x.localeCompare(b.x));
}
function testsHtml() {
  const sel = ui.test || db.tests.defs[0]?.id, def = db.tests.defs.find(d => d.id === sel);
  const list = db.tests.defs.map(d => {
    const p = testPoints(d); if (!p.length) return '';
    const best = d.better === 'lower' ? Math.min(...p.map(x => x.y)) : Math.max(...p.map(x => x.y));
    return `<li class="click" data-act="pick-test" data-v="${d.id}"><span>${esc(d.name)}</span><span class="muted">best <b>${best}</b> ${esc(d.unit)} · last ${p.at(-1).y}</span></li>`;
  }).join('');
  return `<ul class="list">${list || '<li class="muted">No results yet. Logged sprints, jumps and holds count automatically.</li>'}</ul>
    ${def ? `<p class="muted small" style="margin-top:8px">${esc(def.name)} (${esc(def.unit)}, ${def.better} is better)</p>${chart(testPoints(def))}` : ''}
    <div class="row" style="margin-top:8px"><select data-act="pick-test" style="flex:2">${db.tests.defs.map(d => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
    <input id="t-val" inputmode="decimal" placeholder="${esc(def?.unit || '')}" style="flex:1"><input id="t-date" type="date" value="${L.localDate()}" style="flex:1.4"></div>
    <div class="row" style="margin-top:8px">${btn('Log result', 'add-result', 'sm primary')}${btn('+ Custom test', 'add-test', 'sm ghost')}</div>`;
}

function skillsView() {
  const st = db.skills.status, E = ui.skEdit;
  const X0 = X();
  return `<p class="muted small">${esc(LIMB_NOTE)} Levels unlock automatically when a logged session meets the criterion.</p><div class="row"><p class="muted grow small">Tap a step: empty → working → done.</p>${btn(E ? 'Done editing' : 'Edit trees', 'sk-edit', 'sm ghost')}</div>` +
    db.skills.trees.map(t => {
      const c = L.skillCurrent(t, st);
      return card(esc(t.name), t.steps.map((s, i) => {
        const k = st[`${t.id}/${s.id}`], cls = k?.state || '';
        return `<div class="step ${cls} ${i === c.i ? 'cur' : ''}"><button class="s" data-act="sk-cycle" data-v="${t.id}/${s.id}">${k?.state === 'done' ? '✓' : ''}</button>
          <div class="grow"><b>${esc(s.name)}</b>${k?.state === 'done' ? ` <span class="muted small">${k.date}${k.auto ? ' · logged' : ''}</span>` : ''}<div class="muted small">${esc(L.critText(s.crit, X0))}</div>${s.risk ? `<div class="warn">⚠ ${esc(RISK[s.risk])}</div>` : ''}</div>
          ${E ? `<button class="b sm ghost" data-act="sk-up" data-v="${t.id}/${s.id}">↑</button><button class="b sm ghost" data-act="sk-ren" data-v="${t.id}/${s.id}">✎</button>` : ''}</div>`;
      }).join('') + (E ? `<div class="row" style="margin-top:8px">${btn('+ Step', 'sk-add', 'sm', t.id)}${btn('Rename tree', 'sk-tree-ren', 'sm ghost', t.id)}</div>` : ''));
    }).join('') + (E ? btn('+ New skill tree', 'sk-tree-add', '', '') : '');
}

const MF = [['bw', 'Bodyweight'], ['waist', 'Waist'], ['chest', 'Chest'], ['arms', 'Arms'], ['thighs', 'Thighs'], ['hips', 'Hips'], ['bf', 'Body fat % (est.)']];
function bodyView() {
  const ms = [...db.measurements].sort((a, b) => a.date.localeCompare(b.date)), g = db.settings.goal;
  const lastOf = k => ms.filter(m => L.num(m[k]) != null).at(-1);
  const change = k => { const l = lastOf(k); if (!l) return ''; const o = ms.filter(m => L.num(m[k]) != null && L.days(m.date, l.date) <= 28)[0]; return o && o !== l ? ` <span class="muted small">(${(+l[k] - +o[k] >= 0 ? '+' : '')}${Math.round((+l[k] - +o[k]) * 10) / 10} / ${L.days(o.date, l.date)}d)</span>` : ''; };
  const pts = k => ms.filter(m => L.num(m[k]) != null).map(m => ({ x: m.date, y: +m[k] }));
  return card('Log measurements', `<div class="form"><div><label>Date</label><input type="date" id="m-date" value="${L.localDate()}"></div>${MF.map(([k, l]) => `<div><label>${l}${k === 'bw' ? ` (${db.settings.unit})` : k === 'bf' ? '' : ' (in)'}</label><input id="m-${k}" inputmode="decimal" placeholder="${esc(lastOf(k)?.[k] ?? '')}"></div>`).join('')}</div>
      <textarea id="m-notes" placeholder="Notes" style="margin-top:8px"></textarea><div class="row" style="margin-top:8px">${btn('Save', 'save-meas', 'primary')}<label class="b sm" style="display:inline-block;font-size:12px;padding:6px 10px;border:1px solid var(--line);border-radius:10px">+ Progress photo<input type="file" accept="image/*" data-act="photo" hidden></label></div>`) +
    ((db.photos || []).length ? card('Photos', `<div class="photos">${db.photos.slice(-6).reverse().map(p => `<figure><img data-photo="${p.id}" alt=""><figcaption class="muted small">${p.date}</figcaption></figure>`).join('')}</div><p class="muted small">Stored on this device; vault sync copies them to Measurements/Photos (iCloud, not git).</p>`) : '') +
    card('Bodyweight', `<p><b style="font-size:20px">${lastOf('bw')?.bw ?? '—'}</b>${change('bw')} <span class="muted">· ${g.bwMin ? `goal ${g.bwMin}–${g.bwMax}` : 'set a goal in Settings'} (${esc(g.text)})</span></p>${chart(pts('bw'), { band: g.bwMin ? [g.bwMin, g.bwMax] : null })}`) +
    card('Measurements', `<table><tr><th></th><th>Latest</th><th>4-week</th></tr>${MF.slice(1).map(([k, l]) => { const x = lastOf(k); return x ? `<tr><td>${l}</td><td><b>${x[k]}</b></td><td>${change(k)}</td></tr>` : ''; }).join('')}</table>
      <details><summary>Waist trend</summary>${chart(pts('waist'))}</details>`) +
    card('History', `<ul class="list">${ms.slice(-15).reverse().map(m => `<li><span class="muted">${m.date}</span><span>${MF.filter(([k]) => L.num(m[k]) != null).map(([k, l]) => `${l.split(' ')[0]} ${m[k]}`).join(' · ')}</span><button class="b sm ghost danger" data-act="del-meas" data-v="${m.id}">✕</button></li>`).join('')}</ul>`);
}

function settingsView() {
  const fs = 'showDirectoryPicker' in window, c = db.settings.categories, g = db.settings.goal;
  const advanced = JSON.stringify({ rotation: db.settings.rotation, exercises: db.program.exercises, templates: db.program.templates, blocks: db.program.blocks, tests: db.tests.defs }, null, 1);
  return card('Obsidian', `<p class="muted small">Last sync: ${db.lastSync ? new Date(db.lastSync).toLocaleString() : 'never'}</p>
      ${fs ? `<p class="small">Pick your <b>vault root</b> (the folder that contains <code>Fitness/</code>). Notes are written straight into it; notes you edited in Obsidian are never overwritten.</p><div class="row">${btn('Sync to vault', 'sync', 'primary')}${btn('Change folder', 'relink', 'ghost sm')}</div>`
      : `<p class="small">This browser can't write to folders (iPhone). Save the backup into <code>Fitness/_data/</code> in your vault via Files — the laptop sync turns it into notes. Or export the full Markdown set.</p>`}
      <div class="row" style="margin-top:8px">${btn('Share backup → vault', 'export-json', fs ? 'sm' : 'primary sm')}${btn('Markdown zip', 'export-zip', 'sm')}${btn('Copy last workout note', 'copy-md', 'sm ghost', L.doneWorkouts(db)[0]?.id || '')}</div>`) +
    card('Backup & import', `<p class="muted small">${db.workouts.length} workouts · ${db.measurements.length} measurements · ${db.results.length} test results · ${db.revisions.length} revisions · ${db.trash.length} in trash</p>
      <div class="row">${btn('Download JSON backup', 'export-json', 'sm')}<label class="b sm" style="display:inline-block;color:var(--text);font-size:12px;padding:6px 10px;border:1px solid var(--line);border-radius:10px">Import / merge JSON<input type="file" accept=".json,application/json" data-act="import" hidden></label></div>
      <p class="muted small">Import merges by ID — it never deletes existing records.</p>`) +
    card('Goal', `<div class="form"><div><label>Bodyweight min</label><input data-cfg="goal.bwMin" value="${g.bwMin ?? ''}" inputmode="decimal"></div><div><label>Bodyweight max</label><input data-cfg="goal.bwMax" value="${g.bwMax ?? ''}" inputmode="decimal"></div></div><input data-cfg="goal.text" value="${esc(g.text)}" style="margin-top:8px">`) +
    card('Rest & progression by category', `<table><tr><th>Category</th><th>Rest s</th><th>+Inc</th><th>RPE cap</th></tr>${Object.entries(c).map(([k, v]) => `<tr><td>${esc(v.label)}<div class="muted small">${v.model}</div></td>
      <td><input data-cfg="cat.${k}.rest" value="${v.rest}" inputmode="numeric"></td><td>${v.inc != null ? `<input data-cfg="cat.${k}.inc" value="${v.inc}" inputmode="decimal">` : '—'}</td><td>${v.rpeCap != null ? `<input data-cfg="cat.${k}.rpeCap" value="${v.rpeCap}" inputmode="decimal">` : '—'}</td></tr>`).join('')}</table>
      <div class="row" style="margin-top:8px"><label class="grow">Tendon/joint pain cap (0–10). Above it, progression holds; above 5 it reduces.</label><input data-cfg="painCap" value="${db.settings.painCap ?? 3}" inputmode="numeric" style="width:70px"></div>
      <p class="muted small">Rest 0 = as needed (no auto timer). Per-exercise overrides (<code>inc</code>, <code>rest</code>) go in the program JSON below.</p>`) +
    card('Program (advanced)', `<details><summary>Edit rotation, exercises, templates, tests as JSON</summary><textarea id="adv" style="min-height:300px;font-family:monospace;font-size:12px">${esc(advanced)}</textarea>${btn('Save program', 'save-adv', 'primary sm')}</details>`) +
    `<p class="muted small" style="text-align:center;margin-bottom:30px">Data lives in this browser + your exports. Back up after workouts.</p>`;
}

// ---------- render ----------
function render() {
  const v = { home, log: logView, progress: progressView, skills: skillsView, body: bodyView, settings: settingsView, workout: workoutView }[ui.tab] || home;
  $('#main').innerHTML = v(); fillPhotos();
  const navTab = ui.tab === 'workout' ? 'progress' : ui.tab;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === navTab));
  renderTimer();
}
async function fillPhotos() {
  for (const img of document.querySelectorAll('img[data-photo]')) { const b = await idb.get('photo:' + img.dataset.photo); if (b) img.src = URL.createObjectURL(b); }
}
async function addPhoto(file) {
  try {
    const img = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = img.width * k | 0; c.height = img.height * k | 0; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    const p = { id: L.uid('p'), date: $('#m-date')?.value || L.localDate(), createdAt: nowIso(), updatedAt: nowIso() };
    await idb.set('photo:' + p.id, blob); db.photos.push(p); save(true); render(); toast('Photo saved on this device');
  } catch (e) { toast('Photo failed: ' + e.message); }
}
const go = tab => { ui.tab = tab; render(); scrollTo(0, 0); };

// ---------- rest timer ----------
let timer = null, actx;
function beep() {
  try { actx ||= new AudioContext(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(actx.destination); g.gain.setValueAtTime(.3, actx.currentTime); g.gain.exponentialRampToValueAtTime(.001, actx.currentTime + .6); o.start(); o.stop(actx.currentTime + .6); } catch { }
  navigator.vibrate?.([200, 100, 200]);
}
function startRest(sec, label = 'Rest') { if (!(sec > 0)) return; timer = { end: Date.now() + sec * 1000, label, fired: false }; renderTimer(); }
function renderTimer() {
  const el = $('#timer');
  if (!timer) { el.className = ''; return; }
  const left = Math.round((timer.end - Date.now()) / 1000), a = Math.abs(left);
  el.className = 'show' + (left <= 0 ? ' over' : '');
  el.innerHTML = `<button data-act="t-add" data-v="-15">−15</button><span class="t">${left < 0 ? '+' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}</span><span class="l">${left <= 0 ? 'Go — next set' : esc(timer.label)}</span><button data-act="t-add" data-v="15">+15</button><button data-act="t-stop">✕</button>`;
}
setInterval(() => {
  if (!timer) return;
  const left = (timer.end - Date.now()) / 1000;
  if (left <= 0 && !timer.fired) { timer.fired = true; beep(); }
  if (left < -90) timer = null;
  renderTimer();
}, 500);

// ---------- actions ----------
const curW = () => (ui.edit ? byId(ui.edit) : activeW());
function ctx(el) {
  const w = curW(), eEl = el.closest('[data-e]');
  const en = eEl && w?.entries.find(e => e.id === eEl.dataset.e);
  return { w, en, ex: en && X()[en.ex] };
}
function setFromRow(btnEl) {
  // the row is the run of inputs before this button (grid uses display:contents rows)
  const row = btnEl.closest('[data-s]'); return row?.dataset.s;
}
function pendingSets(en) { return en.sets.filter(s => !s.done); }
function touch(w) { w.updatedAt = nowIso(); save(); }

const A = {
  tab: (v) => { if (v !== 'workout') ui.view = null; go(v); },
  demo(v, el) { const { en } = ctx(el); ui.demo[en.id] = !ui.demo[en.id]; render(); },
  'demo-set'(v, el) {
    const { ex } = ctx(el), url = prompt(`Your own demo link for ${ex.name} (YouTube, Instagram…). Empty = back to search.`, ex.video || '');
    if (url === null) return; const e = db.program.exercises.find(x => x.id === ex.id);
    if (url.trim() && !/^https?:\/\//.test(url.trim())) return toast('Link must start with http');
    if (url.trim()) e.video = url.trim(); else delete e.video; db.program._u = nowIso(); save(true); render();
  },
  'start-plan'(v) {
    const sch = L.schedule(db), plan = L.offDayPlan(db, sch); ui.blocks = new Set(plan.blocks); ui.plan = plan; A.start('S');
  },
  'undo-quick'(v) {
    const w = byId(v); if (!w?.quick || !confirm(`Remove the “${w.name} done” mark for ${w.date}?`)) return;
    const t = nowIso(); db.trash.push({ id: w.id, type: 'workout', at: t, updatedAt: t, data: w });
    db.workouts.splice(db.workouts.indexOf(w), 1); save(true); render(); toast('Removed — rotation updated');
  },
  quick(v) {
    const type = v || $('#q-type').value, date = v ? L.localDate() : $('#q-date').value;
    if (!/^\d{4}-\d\d-\d\d$/.test(date)) return toast('Pick a date');
    const label = type === 'S' ? 'Off-day' : `FBEOD ${type}`;
    if (db.workouts.some(w => w.status === 'done' && w.date === date && w.type === type) && !confirm(`${label} is already logged on ${date}. Add another?`)) return;
    if (!confirm(`Mark ${label} on ${date} as done (no set details)?`)) return;
    const w = L.quickDone(db, type, date); w.mdPath = M.workoutPath(db, w); db.workouts.push(w); save(true); go('home');
    toast(`${label} logged — rotation updated`); autoSync();
  },
  start(v) {
    const a = activeW();
    if (a) { if (!confirm(`${a.name} is still in progress. Resume it instead?`)) return; return go('log'); }
    const w = v === 'S' ? L.startOffDay(db, [...ui.blocks]) : L.startWorkout(db, v || null);
    if (v === 'S' && !w.entries.length) return toast('Pick at least one block');
    if (v === 'S' && ui.plan) { w.plan = ui.plan.id; w.title = ui.plan.name; ui.plan = null; }
    if (!v) { w.name = 'Session'; w.type = 'X'; }
    db.workouts.push(w); save(true); ui.edit = null; go('log');
  },
  done(v, el) {
    const { w, en, ex } = ctx(el); const s = en.sets.find(x => x.id === setFromRow(el));
    if (s.done) { s.done = false; delete s.at; touch(w); return render(); }
    const row = el.closest('[data-s]');
    for (const inp of row.querySelectorAll('input[data-f]')) {
      const k = inp.dataset.f;
      if (k !== 'rpe' && L.num(s[k]) == null && inp.dataset.ph !== '') s[k] = L.num(inp.dataset.ph);
    }
    const missing = L.fields(ex).filter(k => L.num(s[k]) == null && !(k === 'w' && ex.added));
    if (missing.length) return toast(`Enter ${missing.map(k => FL[k](ex)).join(' + ')} first`);
    if (ex.added && L.num(s.w) == null) s.w = 0;
    const before = L.prsFor(ex, { ...en, sets: en.sets.filter(x => x.done) }, L.bests(ex, L.history(db, ex.id, { exclude: w.id, before: w.date, variant: en.variant }))).length;
    s.done = true; s.at = nowIso(); touch(w);
    const now = L.prsFor(ex, en, L.bests(ex, L.history(db, ex.id, { exclude: w.id, before: w.date, variant: en.variant })));
    if (now.length > before) { toast('🏆 PR — ' + now.at(-1)); navigator.vibrate?.(80); }
    const cfg = L.catCfg(db, ex);
    startRest(ex.rest ?? cfg.rest, `${ex.name} · set ${en.sets.indexOf(s) + 2 <= en.sets.length ? en.sets.indexOf(s) + 2 : 'next exercise'}`);
    render();
  },
  prevw(v, el) {
    const { w, en, ex } = ctx(el); const last = L.history(db, ex.id, { exclude: w.id, before: w.date })[0];
    if (!last) return toast('No previous log');
    const ls = L.doneSets(last); pendingSets(en).forEach(s => { const i = en.sets.indexOf(s); s.w = (ls[i] || ls.at(-1)).w; });
    touch(w); render();
  },
  inc(v, el) {
    const { w, en } = ctx(el), d = +v;
    const card = el.closest('[data-e]');
    pendingSets(en).forEach(s => {
      const inp = card.querySelector(`[data-s="${s.id}"] input[data-f="w"]`);
      const base = L.num(s.w) ?? L.num(inp?.dataset.ph) ?? 0; s.w = Math.round((base + d) * 100) / 100;
    });
    touch(w); render();
  },
  bw(v, el) { const { w, en } = ctx(el); pendingSets(en).forEach(s => (s.w = 0)); touch(w); render(); },
  addset(v, el) { const { w, en } = ctx(el); en.sets.push({ id: L.uid('s') }); touch(w); render(); },
  rmset(v, el) { const { w, en } = ctx(el); const p = pendingSets(en); if (p.length && en.sets.length > 1) en.sets.splice(en.sets.indexOf(p.at(-1)), 1); else return toast('Only empty sets can be removed'); touch(w); render(); },
  form(v, el) { const { w, en } = ctx(el); en.form = !en.form ? 'good' : en.form === 'good' ? 'off' : undefined; if (!en.form) delete en.form; touch(w); render(); },
  swap(v, el) { const { en } = ctx(el); ui.swap[en.id] = !ui.swap[en.id]; render(); },
  swapto(v, el) { const { w, en } = ctx(el); if (!v || v === en.ex) return; if (L.doneSets(en).length && !confirm('Sets already logged under the old exercise move with it. Swap anyway?')) return;
    en.subFor ||= en.ex; en.ex = v; const nx = X()[v]; if (nx.vars) en.variant = L.history(db, v)[0]?.variant || nx.vars[0].id; else delete en.variant;
    ui.swap[en.id] = false; touch(w); render(); },
  neg(v, el) { const { w, en } = ctx(el); const card = el.closest('[data-e]');
    pendingSets(en).forEach(s => { const ph = L.num(card.querySelector(`[data-s="${s.id}"] input[data-f="w"]`)?.dataset.ph); const b = L.num(s.w) ?? ph ?? 0; s.w = b === 0 ? -20 : -b; });
    touch(w); render(); toast('Negative weight = band/assistance (e.g. assist 20)'); },
  skip(v, el) { const { w, en } = ctx(el); en.skipped = !en.skipped; touch(w); render(); },
  note(v, el) { const { en } = ctx(el); ui.notes[en.id] = !ui.notes[en.id]; render(); },
  rmex(v, el) { const { w, en } = ctx(el); w.entries.splice(w.entries.indexOf(en), 1); touch(w); render(); },
  addex(v) { const w = curW(); if (!v || !w) return; w.entries.push(L.newEntry(v, { sets: 3, min: 5, max: 10 })); touch(w); render(); },
  finish() {
    const w = activeW(); if (!w) return;
    const n = w.entries.reduce((a, e) => a + L.doneSets(e).length, 0);
    if (!n) return toast('No sets logged yet');
    const open = w.entries.reduce((a, e) => a + (e.skipped ? 0 : pendingSets(e).length), 0);
    if (!confirm(`Finish ${w.name}? ${n} sets logged${open ? `, ${open} unticked sets will be dropped` : ''}.`)) return;
    for (const e of w.entries) e.sets = e.sets.filter(s => s.done || e.skipped);
    w.status = 'done'; w.finishedAt = w.updatedAt = nowIso();
    w.bw = latestBw()?.bw ?? null;
    w.prs = L.workoutPRs(db, w);
    w.levelUps = L.autoUnlock(db);
    w.mdPath = M.workoutPath(db, w);
    timer = null; save(true);
    ui.view = w.id; go('workout');
    toast([w.prs.length && `🏆 ${w.prs.length} PR${w.prs.length > 1 ? 's' : ''}`, w.levelUps.length && `⭐ Level up: ${w.levelUps.join(', ')}`].filter(Boolean).join(' · ') || 'Saved.');
    autoSync();
  },
  discard() {
    const w = activeW(); if (!w || !confirm('Discard this session? (Logged sets go to trash, recoverable from backup.)')) return;
    db.trash.push({ id: w.id, type: 'workout', at: nowIso(), updatedAt: nowIso(), data: w });
    db.workouts.splice(db.workouts.indexOf(w), 1); save(true); go('home');
  },
  view(v) { ui.view = v; go('workout'); },
  edit(v) {
    const w = byId(v); db.revisions.push({ id: L.uid('r'), wid: w.id, at: nowIso(), updatedAt: nowIso(), data: clone(w) });
    ui.edit = v; save(true); go('log');
  },
  'save-edit'() {
    const w = byId(ui.edit); w.editedAt = w.updatedAt = nowIso(); w.prs = L.workoutPRs(db, w); L.autoUnlock(db);
    ui.edit = null; save(true); ui.view = w.id; go('workout'); autoSync();
  },
  'cancel-edit'() {
    const r = [...db.revisions].reverse().find(r => r.wid === ui.edit);
    if (r) db.workouts[db.workouts.findIndex(w => w.id === ui.edit)] = clone(r.data);
    db.revisions.splice(db.revisions.indexOf(r), 1);
    ui.view = ui.edit; ui.edit = null; save(true); go('workout');
  },
  'del-workout'(v) {
    const w = byId(v); if (!w || prompt(`Type DELETE to remove ${w.name} ${w.date}. (Moved to trash inside backups.)`) !== 'DELETE') return;
    db.trash.push({ id: w.id, type: 'workout', at: nowIso(), updatedAt: nowIso(), data: w });
    db.workouts.splice(db.workouts.indexOf(w), 1); save(true); ui.view = null; go('progress');
  },
  async 'copy-md'(v) {
    const w = byId(v); if (!w) return toast('No workout yet');
    try { await navigator.clipboard.writeText(M.workoutMd(db, w)); toast('Note copied — paste into Obsidian'); } catch { toast('Clipboard blocked'); }
  },
  't-start': v => startRest(+v, 'Rest'),
  't-add': v => { if (timer) { timer.end += +v * 1000; timer.fired = false; renderTimer(); } },
  't-stop': () => { timer = null; renderTimer(); },
  'pick-ex': v => { ui.ex = v; render(); },
  'pick-test': v => { ui.test = v; render(); },
  'add-result'() {
    const val = L.num($('#t-val').value), date = $('#t-date').value, test = ui.test || db.tests.defs[0].id;
    if (val == null || !date) return toast('Enter a value');
    db.results.push({ id: L.uid('t'), test, value: val, date, createdAt: nowIso(), updatedAt: nowIso() }); save(true); render(); toast('Result logged');
  },
  'add-test'() {
    const name = prompt('Test name (e.g. "Deep squat hold")'); if (!name) return;
    const unit = prompt('Unit (s, in, cm, reps, lb…)', 's') || '';
    const better = confirm('Is HIGHER better? (Cancel = lower is better)') ? 'higher' : 'lower';
    db.tests.defs.push({ id: L.uid('test'), name, unit, better }); db.tests._u = nowIso(); save(true); render();
  },
  block(v) { ui.blocks.has(v) ? ui.blocks.delete(v) : ui.blocks.add(v); render(); },
  'ck-open'() { ui.ck = !ui.ck; render(); },
  'save-ck'() {
    const regions = {}; document.querySelectorAll('[data-ckr]').forEach(el => { const v = L.num(el.value); if (v != null) regions[el.dataset.ckr] = v; });
    const soreness = L.num($('#ck-sore').value), notes = $('#ck-notes').value.trim();
    if (soreness == null && !Object.keys(regions).length) return toast('Rate at least one item');
    const date = L.localDate(), ex = db.checkins.find(c => c.date === date);
    if (ex) Object.assign(ex, { regions: { ...ex.regions, ...regions }, soreness: soreness ?? ex.soreness, notes: [ex.notes, notes].filter(Boolean).join(' · '), updatedAt: nowIso() });
    else db.checkins.push({ id: L.uid('c'), date, regions, soreness, notes, createdAt: nowIso(), updatedAt: nowIso() });
    ui.ck = false; save(true); render();
    const flags = L.regionFlags(db); toast(flags.length ? `⚠ ${flags.map(f => f.name).join(', ')} above cap — progression held there` : 'Check-in saved');
  },
  'sk-edit'() { ui.skEdit = !ui.skEdit; render(); },
  'sk-cycle'(v) {
    const k = db.skills.status[v], next = !k ? 'working' : k.state === 'working' ? 'done' : null;
    const [tid, sid] = v.split('/'), step = db.skills.trees.find(t => t.id === tid)?.steps.find(s => s.id === sid);
    if (next === 'done' && step?.crit && !L.skillEvidence(db, step.crit) && !confirm(`No logged session meets “${L.critText(step.crit, X())}” yet. Mark done anyway (tested elsewhere)?`)) return;
    if (next) db.skills.status[v] = { state: next, date: L.localDate() }; else delete db.skills.status[v];
    db.skills._u = nowIso(); save(true); render();
  },
  'sk-add'(v) { const n = prompt('New step name'); if (!n) return; const t = db.skills.trees.find(t => t.id === v); t.steps.push({ id: L.uid('st'), name: n }); db.skills._u = nowIso(); save(true); render(); },
  'sk-ren'(v) {
    const [tid, sid] = v.split('/'), t = db.skills.trees.find(t => t.id === tid), s = t.steps.find(s => s.id === sid);
    const n = prompt('Rename step (leave empty to delete)', s.name); if (n === null) return;
    if (n.trim()) s.name = n.trim(); else if (confirm(`Delete step "${s.name}"?`)) t.steps.splice(t.steps.indexOf(s), 1);
    db.skills._u = nowIso(); save(true); render();
  },
  'sk-up'(v) { const [tid, sid] = v.split('/'), t = db.skills.trees.find(t => t.id === tid), i = t.steps.findIndex(s => s.id === sid); if (i > 0) { [t.steps[i - 1], t.steps[i]] = [t.steps[i], t.steps[i - 1]]; db.skills._u = nowIso(); save(true); render(); } },
  'sk-tree-ren'(v) { const t = db.skills.trees.find(t => t.id === v), n = prompt('Tree name', t.name); if (n) { t.name = n; db.skills._u = nowIso(); save(true); render(); } },
  'sk-tree-add'() { const n = prompt('New skill tree name'); if (!n) return; db.skills.trees.push({ id: L.uid('tree'), name: n, steps: [] }); db.skills._u = nowIso(); save(true); render(); },
  'save-meas'() {
    const m = { id: L.uid('m'), date: $('#m-date').value || L.localDate(), createdAt: nowIso(), updatedAt: nowIso(), notes: $('#m-notes').value.trim() };
    let any = false; for (const [k] of MF) { const v = L.num($(`#m-${k}`).value); if (v != null) { m[k] = v; any = true; } }
    if (!any) return toast('Enter at least one value');
    db.measurements.push(m); save(true); render(); toast('Saved');
  },
  'del-meas'(v) {
    const m = db.measurements.find(m => m.id === v); if (!m || !confirm(`Delete measurement from ${m.date}?`)) return;
    db.trash.push({ id: m.id, type: 'measurement', at: nowIso(), updatedAt: nowIso(), data: m }); db.measurements.splice(db.measurements.indexOf(m), 1); save(true); render();
  },
  'save-adv'() {
    let p; try { p = JSON.parse($('#adv').value); } catch (e) { return toast('Invalid JSON: ' + e.message); }
    const ids = new Set((p.exercises || []).map(e => e.id));
    const errs = [];
    if (!Array.isArray(p.exercises) || !Array.isArray(p.templates) || !Array.isArray(p.rotation) || !Array.isArray(p.tests)) errs.push('rotation, exercises, templates, tests must be arrays');
    else {
      for (const e of p.exercises) if (!e.id || !e.name || !db.settings.categories[e.cat] || !L.fields(e)) errs.push(`exercise ${e.id || '?'}: needs id, name, valid cat`);
      for (const t of [...p.templates, ...(p.blocks || [])]) for (const it of t.items || []) if (!ids.has(it.ex) || !(it.sets > 0)) errs.push(`${t.id}: bad item ${it.ex}`);
      for (const r of p.rotation) if (!p.templates.some(t => t.id === r)) errs.push(`rotation ${r}: no template`);
      // never orphan logged history
      for (const w of db.workouts) for (const e of w.entries) if (!ids.has(e.ex)) { errs.push(`exercise ${e.ex} has logged history — keep it`); break; }
    }
    if (errs.length) return toast(errs.slice(0, 2).join('; '));
    const t = nowIso();
    db.archive.push({ id: L.uid('a'), at: t, updatedAt: t, reason: 'program edit', program: clone(db.program) });
    db.program = { exercises: p.exercises, templates: p.templates, blocks: p.blocks || db.program.blocks, _u: t }; db.settings.rotation = p.rotation; db.settings._u = t;
    db.tests = { defs: p.tests, _u: t }; save(true); toast('Program saved'); render();
  },
  'export-json'() {
    const blob = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' });
    share(blob, `tiger-backup-${L.localDate()}.json`);
  },
  'export-zip'() {
    for (const w of db.workouts) if (w.status === 'done' && !w.mdPath) w.mdPath = M.workoutPath(db, w);
    save(true); share(M.zip(M.buildFiles(db)), `tiger-obsidian-${L.localDate()}.zip`);
  },
  sync: () => syncVault(true),
  async relink() { await idb.set('vault', null); syncVault(true); },
};

async function share(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function importFile(file) {
  let d; try { d = L.upgrade(JSON.parse(await file.text())); } catch { return toast('Not valid JSON'); }
  const errs = L.validate(d); if (errs.length) return toast('Rejected: ' + errs.slice(0, 2).join('; '));
  try { localStorage.setItem(`${KEY}.preimport`, JSON.stringify(db)); } catch { }
  const before = db.workouts.length; db = L.merge(db, d); save(true); render();
  toast(`Merged: +${db.workouts.length - before} workouts`);
}

async function syncVault(interactive) {
  if (!('showDirectoryPicker' in window)) return interactive && toast('Folder sync needs Chrome/Edge on desktop or Android');
  try {
    let h = await idb.get('vault');
    if (!h) { if (!interactive) return; h = await showDirectoryPicker({ id: 'vault', mode: 'readwrite' }); await idb.set('vault', h); }
    let perm = await h.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') { if (!interactive) return; perm = await h.requestPermission({ mode: 'readwrite' }); if (perm !== 'granted') return; }
    let io = M.dirIO(h);
    if (h.name === M.ROOT) { const inner = io, strip = p => p.replace(/^Fitness\/?/, ''); io = { read: p => inner.read(strip(p)), write: (p, c) => inner.write(strip(p), c), list: p => inner.list(strip(p)) }; }
    persist();
    const extras = []; for (const p of db.photos || []) { const b = await idb.get('photo:' + p.id); if (b) extras.push({ path: M.photoPath(p), blob: b }); }
    const { db: nd, report } = await M.syncWith(io, db, (a, b) => (L.validate(L.upgrade(b)).length ? a : L.merge(a, b)), extras);
    db = nd; save(true); render();
    toast(`Vault synced: ${report.written} written${report.merged > 0 ? `, +${report.merged} merged` : ''}${report.kept.length ? `, ${report.kept.length} kept (you edited them)` : ''}`);
  } catch (e) { if (e.name !== 'AbortError') toast('Sync failed: ' + e.message); }
}
const autoSync = () => syncVault(false);

// ---------- events ----------
document.body.addEventListener('click', e => {
  const t = e.target.closest('[data-tab]'); if (t) return A.tab(t.dataset.tab);
  const a = e.target.closest('[data-act]'); if (!a || a.tagName === 'SELECT' || a.tagName === 'INPUT') return;
  e.preventDefault(); A[a.dataset.act]?.(a.dataset.v, a);
});
document.body.addEventListener('change', e => {
  const a = e.target;
  if (a.dataset.act === 'import') return a.files[0] && importFile(a.files[0]);
  if (a.tagName === 'SELECT' && a.dataset.act) return A[a.dataset.act]?.(a.value, a);
  if (a.dataset.cfg) {
    const [kind, k1, k2] = a.dataset.cfg.split('.'), v = k1 === 'text' ? a.value : L.num(a.value);
    if (kind === 'painCap' && (v == null || v < 0 || v > 10)) return toast('0–10');
    if (v == null && !(kind === 'goal' && a.value.trim() === '')) return toast('Number required');
    if (kind === 'goal') db.settings.goal[k1] = v; else if (kind === 'painCap') db.settings.painCap = L.num(a.value); else db.settings.categories[k1][k2] = v;
    db.settings._u = nowIso(); save(true); toast('Saved');
  }
  if (a.dataset.en === 'variant') return render();
  if (a.dataset.act === 'photo') return a.files[0] && addPhoto(a.files[0]);
  if (a.dataset.wf === 'date') { const w = curW(); if (w && /^\d{4}-\d\d-\d\d$/.test(a.value)) { w.date = a.value; touch(w); render(); } }
});
document.body.addEventListener('input', e => {
  const el = e.target, w = curW();
  if (el.dataset.f && w) {
    const { en } = ctx(el); const s = en?.sets.find(x => x.id === el.closest('[data-s]')?.dataset.s); if (!s) return;
    s[el.dataset.f] = L.num(el.value); if (s[el.dataset.f] == null) delete s[el.dataset.f]; touch(w);
  } else if (el.dataset.en && w) {
    const en = ctx(el).en, k = el.dataset.en; en[k] = k === 'pain' ? L.num(el.value) : el.value; if (en[k] == null || en[k] === '') delete en[k]; touch(w);
  }
  else if (el.dataset.wf === 'notes' && w) { w.notes = el.value; touch(w); }
});

// ---------- boot ----------
(async () => {
  if (!db.workouts.length) {
    const m = await idb.get('db');
    if (m) try { const d = L.upgrade(JSON.parse(m)); if (!L.validate(d).length && d.workouts.length) { db = d; toast('Restored from IndexedDB copy'); } } catch { }
  }
  navigator.storage?.persist?.();
  // One-time repair (2026-11-18): the owner's 11/17 FBEOD B session was marked done with today's date.
  // Moves set-less quick marks dated 11/18 to 11/17 as FBEOD B; originals are kept in revisions/trash.
  if (!db.fixes?.b1117 && L.localDate() <= '2026-11-21') {
    const q = db.workouts.filter(w => w.quick && w.date === '2026-11-18' && w.type !== 'S' && !w.entries.length);
    const has17 = db.workouts.some(w => w.status === 'done' && w.date === '2026-11-17' && w.type !== 'S');
    const t = nowIso(); db.fixes ||= {};
    if (q.length && !has17) {
      q.forEach(w => db.revisions.push({ id: L.uid('r'), wid: w.id, at: t, updatedAt: t, data: clone(w) }));
      const [w, ...extra] = q, B = tpl('B');
      Object.assign(w, { date: '2026-11-17', type: 'B', name: B.name, title: B.title, updatedAt: t, editedAt: t }); delete w.mdPath; w.mdPath = M.workoutPath(db, w);
      for (const x of extra) { db.trash.push({ id: x.id, type: 'workout', at: t, updatedAt: t, data: x }); db.workouts.splice(db.workouts.indexOf(x), 1); }
      db.fixes.b1117 = t; persist(); setTimeout(() => toast('Fixed: 11/17 is now logged as FBEOD B'), 300);
    } else if (has17) db.fixes.b1117 = 'not needed';
  }
  if (activeW()) ui.tab = 'log';
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
})();
