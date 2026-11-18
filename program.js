// Seed data only. Once the app has run, the live copy lives in the db (editable in Settings).
// kind → which fields a set logs:  w=weight r=reps t=seconds d=distance
export const KINDS = {
  load: ['w', 'r'], reps: ['r'], time: ['t'], jump: ['d'],
  sprint: ['d', 't'], carry: ['w', 'd'], practice: ['r'],
};

// Per-category rest (sec, 0 = as needed → no auto timer) and progression model.
// models: double = double progression (load), time = hold progression, tendon = pain-monitored load,
//         performance = sprint/jump (no load suggestions), practice = skill quality only
export const CATEGORIES = {
  power:        { label: 'Power',        rest: 150, model: 'double', inc: 20,  rpeCap: 8 },
  strength:     { label: 'Strength',     rest: 180, model: 'double', inc: 5,   rpeCap: 9 },
  hypertrophy:  { label: 'Hypertrophy',  rest: 90,  model: 'double', inc: 5,   rpeCap: 9.5 },
  isolation:    { label: 'Isolation',    rest: 60,  model: 'double', inc: 5,   rpeCap: 9.5 },
  calisthenics: { label: 'Calisthenics', rest: 120, model: 'double', inc: 2.5, rpeCap: 9 },
  tendon:       { label: 'Tendon',       rest: 60,  model: 'tendon', inc: 5,   rpeCap: 8 },
  isometric:    { label: 'Isometric',    rest: 90,  model: 'time',   inc: 5 },
  sprint:       { label: 'Sprint',       rest: 150, model: 'performance' },
  jump:         { label: 'Jump',         rest: 120, model: 'performance' },
  conditioning: { label: 'Conditioning', rest: 90,  model: 'double', inc: 10, rpeCap: 9 },
  mobility:     { label: 'Mobility',     rest: 0,   model: 'practice' },
  animal:       { label: 'Animal',       rest: 45,  model: 'practice' },
  acrobatics:   { label: 'Acrobatics',   rest: 0,   model: 'practice' },
  coordination: { label: 'Coordination', rest: 60,  model: 'practice' },
};

// Body regions for pain monitoring. Exercises list the regions they load (rg).
export const REGIONS = {
  achilles: 'Achilles', knee: 'Patellar / quad tendon', hamstring: 'Hamstring tendon', ankle: 'Foot / ankle',
  elbow: 'Elbow', shoulder: 'Shoulder / cuff', wrist: 'Wrist / forearm',
};

export const RISK = {
  caution: 'Mats + spotter recommended.',
  coach: 'Requires coaching, mats and a suitable training environment. Do not self-train.',
};

export const TENDON_GUIDE = [
  'Muscle fatigue: diffuse burn or soreness in the muscle belly, peaks 24–48 h, eases as you warm up.',
  'Tendon irritation: pinpoint pain at the tendon (below kneecap, Achilles, elbow bony point), stiff first thing in the morning or at the start of loading.',
  'Acceptable: pain ≤ 3/10 during, settled within 24 h, not worse the next morning.',
  'Above that: hold or reduce load, switch to isometrics. Pain rising across sessions → stop progressing and see a physio. Never train through worsening tendon pain.',
];

const V = (...pairs) => pairs.map(([id, name]) => ({ id, name }));
const X = (id, name, cat, kind, o = {}) => ({ id, name, cat, kind, ...o });
export const EXERCISES = [
  // A
  X('wpu', 'Weighted Pull-Up', 'strength', 'load', { added: true, inc: 2.5, rg: ['elbow', 'shoulder'] }),
  X('squat', 'Back Squat', 'strength', 'load', { rg: ['knee'] }),
  X('spanish_squat', 'Spanish Squat Isometric', 'tendon', 'time', { rg: ['knee'], note: 'Band behind knees, shins vertical, sit to ~90°. Heavy band = progression.' }),
  X('incline_db', 'Incline Dumbbell Press', 'hypertrophy', 'load', { rg: ['shoulder'] }),
  X('rdl', 'Romanian Deadlift', 'strength', 'load', { rg: ['hamstring'] }),
  X('ohp', 'Overhead Press', 'strength', 'load', { inc: 2.5, rg: ['shoulder'] }),
  X('bss', 'Bulgarian Split Squat', 'hypertrophy', 'load', { side: true, rg: ['knee'] }),
  X('hlr', 'Hanging Leg Raise', 'calisthenics', 'reps'),
  X('lsit', 'L-Sit', 'isometric', 'time', { rg: ['wrist'], tree: 'lsit', vars: V(['tuck', 'Tuck support'], ['one_leg', 'One-leg extension'], ['full', 'Full L-sit'], ['v', 'V-sit progression']) }),
  X('ext_rot', 'Cable External Rotation', 'tendon', 'load', { side: true, inc: 2.5, rg: ['shoulder'], note: 'Slow 3 s lowering.' }),
  // B — explosive first
  X('broad_jump', 'Broad Jump', 'jump', 'jump', { dUnit: 'in', rg: ['achilles', 'knee'] }),
  X('lat_bounds', 'Lateral Bounds', 'jump', 'reps', { side: true, rg: ['achilles', 'ankle'] }),
  X('sprint', 'Sprint', 'sprint', 'sprint', { dUnit: 'm', rg: ['achilles', 'hamstring'] }),
  X('sled', 'Sled Push', 'power', 'carry', { dUnit: 'm', rg: ['knee'], note: 'Load where you can still drive fast. Speed drops → stop adding.' }),
  X('front_squat', 'Front Squat', 'strength', 'load', { rg: ['knee'] }),
  X('wcu', 'Weighted Chin-Up', 'strength', 'load', { added: true, inc: 2.5, rg: ['elbow'] }),
  X('dips', 'Dips', 'calisthenics', 'load', { added: true, rg: ['shoulder', 'elbow'] }),
  X('sl_rdl', 'Single-Leg RDL', 'hypertrophy', 'load', { side: true, rg: ['hamstring'] }),
  X('farmer', 'Farmer Carry', 'conditioning', 'carry', { dUnit: 'm', rg: ['wrist'] }),
  X('hollow', 'Hollow-Body Hold', 'isometric', 'time'),
  X('wrist_curl', 'Wrist Flexion + Extension', 'tendon', 'load', { inc: 2.5, rg: ['wrist'], note: 'One set each direction counts as one set. Slow.' }),
  X('hammer_curl', 'Hammer Curl', 'tendon', 'load', { rg: ['elbow'], note: '3 s lowering.' }),
  // C
  X('pullup', 'Pull-Up', 'calisthenics', 'load', { added: true, rg: ['elbow', 'shoulder'] }),
  X('db_bench', 'Dumbbell Bench Press', 'hypertrophy', 'load', { rg: ['shoulder'] }),
  X('hip_thrust', 'Hip Thrust', 'hypertrophy', 'load', { inc: 10 }),
  X('cs_row', 'Chest-Supported Row', 'hypertrophy', 'load', { rg: ['elbow'] }),
  X('pike_pu', 'Pike Push-Up', 'calisthenics', 'reps', { rg: ['shoulder', 'wrist'] }),
  X('calf_slow', 'Standing Calf Raise (3 s up / 3 s down)', 'tendon', 'load', { inc: 10, rg: ['achilles'], note: 'Heavy slow resistance. Full range, pause at bottom.' }),
  X('bent_calf', 'Bent-Knee Calf Raise', 'tendon', 'load', { rg: ['achilles'], note: 'Soleus. Knee bent ~45°, slow.' }),
  X('tib', 'Tibialis Raise', 'tendon', 'load', { inc: 2.5, rg: ['ankle'] }),
  X('reverse_nordic', 'Reverse Nordic', 'tendon', 'reps', { rg: ['knee'], note: 'Partial range first; extend range before adding reps.' }),
  X('pushup_plus', 'Push-Up Plus', 'tendon', 'reps', { rg: ['shoulder'] }),
  X('ab_wheel', 'Ab-Wheel Rollout', 'calisthenics', 'reps'),
  // off-day: tendon (light) + grip
  X('dead_hang', 'Dead Hang', 'tendon', 'time', { rg: ['wrist', 'elbow'] }),
  X('scap_pull', 'Scapular Pull-Up', 'tendon', 'reps', { rg: ['shoulder'] }),
  // off-day: mobility
  X('deep_squat', 'Deep Squat Hold', 'mobility', 'time'),
  X('cossack', 'Cossack Squat', 'mobility', 'reps', { side: true }),
  X('9090', '90/90 Hip Transitions', 'mobility', 'reps'),
  X('pancake', 'Pancake', 'mobility', 'time'),
  X('pike_stretch', 'Pike Compression Stretch', 'mobility', 'time'),
  X('hip_flexor', 'Hip-Flexor Stretch', 'mobility', 'time', { side: true }),
  X('shoulder_flex', 'Shoulder Flexion', 'mobility', 'time'),
  X('wrist_mob', 'Wrist Preparation', 'mobility', 'reps'),
  X('ankle_mob', 'Ankle Dorsiflexion', 'mobility', 'reps', { side: true }),
  X('tspine', 'Thoracic Mobility', 'mobility', 'reps'),
  // off-day: skills
  X('handstand', 'Handstand', 'isometric', 'time', { rg: ['wrist', 'shoulder'], tree: 'hs', vars: V(['wall', 'Wall-facing'], ['free', 'Freestanding']) }),
  X('hs_shifts', 'Handstand Weight Shifts', 'acrobatics', 'practice', { rg: ['wrist'], tree: 'hs' }),
  X('sh_taps', 'Handstand Shoulder Taps', 'acrobatics', 'practice', { rg: ['wrist', 'shoulder'], tree: 'hs' }),
  X('hs_walk', 'Handstand Walk (steps)', 'acrobatics', 'practice', { rg: ['wrist'], tree: 'hs' }),
  X('compression', 'Seated Compression Lifts', 'calisthenics', 'reps', { tree: 'lsit' }),
  X('muscle_up', 'Muscle-Up Progression', 'calisthenics', 'reps', { rg: ['elbow', 'shoulder'], tree: 'mu',
    vars: V(['c2b', 'Chest-to-bar pull-up'], ['sbdip', 'Straight-bar dip'], ['negative', 'Slow negative'], ['band', 'Banded muscle-up'], ['strict', 'Strict muscle-up']) }),
  X('planche', 'Planche Progression', 'isometric', 'time', { rg: ['wrist', 'elbow'], tree: 'planche', vars: V(['lean', 'Planche lean'], ['tuck', 'Tuck'], ['adv_tuck', 'Advanced tuck'], ['straddle', 'Straddle']) }),
  X('front_lever', 'Front Lever Progression', 'isometric', 'time', { rg: ['shoulder', 'elbow'], tree: 'fl', vars: V(['tuck', 'Tuck'], ['adv_tuck', 'Advanced tuck'], ['one_leg', 'One-leg'], ['straddle', 'Straddle'], ['full', 'Full']) }),
  X('back_lever', 'Back Lever Progression', 'isometric', 'time', { rg: ['shoulder', 'elbow'], tree: 'bl', vars: V(['german', 'German hang'], ['tuck', 'Tuck'], ['adv_tuck', 'Advanced tuck'], ['one_leg', 'One-leg'], ['straddle', 'Straddle'], ['full', 'Full']) }),
  X('skin_cat', 'Skin the Cat', 'calisthenics', 'reps', { rg: ['shoulder'], tree: 'bl' }),
  X('pistol', 'Pistol Squat', 'calisthenics', 'reps', { side: true, rg: ['knee'], tree: 'pistol', vars: V(['assisted', 'Assisted (TRX/post)'], ['box', 'To box'], ['full', 'Full']) }),
  // off-day: animal
  X('bear', 'Bear Crawl', 'animal', 'time'),
  X('lat_bear', 'Lateral Bear Crawl', 'animal', 'time'),
  X('beast', 'Beast Crawl', 'animal', 'time'),
  X('crab', 'Crab Walk', 'animal', 'time'),
  X('kick_through', 'Kick-Through', 'animal', 'reps'),
  X('ape', 'Ape Movement', 'animal', 'time'),
  X('low_crawl', 'Low Crawl', 'animal', 'time'),
  X('crawl_stand', 'Crawl → Squat → Stand', 'animal', 'reps'),
  // off-day: acrobatics (reps = clean reps)
  X('fwd_roll', 'Forward Roll', 'acrobatics', 'practice', { tree: 'rolls' }),
  X('back_roll', 'Backward Roll', 'acrobatics', 'practice', { tree: 'rolls' }),
  X('landing', 'Safe Landing Drills', 'acrobatics', 'practice'),
  X('cartwheel', 'Cartwheel', 'acrobatics', 'practice', { rg: ['wrist'], tree: 'cart', vars: V(['line', 'On a line'], ['both', 'Both sides'], ['near', 'One-arm, near hand'], ['far', 'One-arm, far hand']) }),
  X('roundoff', 'Roundoff', 'acrobatics', 'practice', { risk: 'caution' }),
  // off-day: boxing + climbing
  X('shadowbox', 'Shadowboxing Round', 'coordination', 'time'),
  X('footwork', 'Boxing Footwork Drill', 'coordination', 'time'),
  X('climb', 'Climbing / Bouldering (problems)', 'coordination', 'practice', { rg: ['wrist', 'elbow'] }),
];

// target: sets (setsMax), min–max of the kind's main field (reps, sec, m)
const T = (ex, sets, min, max = min, o = {}) => ({ ex, sets, min, max, ...o });
export const TEMPLATES = [
  { id: 'A', name: 'FBEOD A', title: 'Strength + Calisthenics', fbeod: true,
    purpose: 'Foundational strength and relative strength. Tendon: patellar (Spanish squat), rotator cuff.',
    items: [T('wpu', 4, 4, 8), T('squat', 4, 5, 8), T('spanish_squat', 3, 30, 45, { note: 'Right after squats.' }), T('incline_db', 3, 6, 10),
      T('rdl', 3, 6, 10), T('ohp', 3, 6, 10), T('bss', 2, 8, 10), T('hlr', 3, 8, 12), T('lsit', 3, 10, 20, { setsMax: 4 }), T('ext_rot', 2, 12, 15)] },
  { id: 'B', name: 'FBEOD B', title: 'Power + Athleticism', fbeod: true,
    purpose: 'Explosive work first, fresh, full rest. Jumps and sprints already load Achilles/patellar — tendon work here is upper body only.',
    items: [T('broad_jump', 3, 3, 3, { note: '3 jumps per set — log best' }), T('lat_bounds', 3, 4), T('sprint', 4, 10, 20),
      T('sled', 4, 15, 20), T('front_squat', 3, 5, 8), T('wcu', 3, 5, 8), T('dips', 3, 6, 10), T('sl_rdl', 2, 8, 8, { setsMax: 3 }),
      T('farmer', 3, 20, 30), T('hollow', 3, 20, 40), T('wrist_curl', 2, 15, 20), T('hammer_curl', 2, 10, 12)] },
  { id: 'C', name: 'FBEOD C', title: 'Muscle + Athletic Strength', fbeod: true,
    purpose: 'Muscle plus the main lower-leg and knee tendon block (slow heavy calves, reverse Nordics).',
    items: [T('pullup', 3, 6, 10), T('bss', 3, 8, 12), T('db_bench', 3, 8, 12), T('hip_thrust', 3, 8, 12), T('cs_row', 3, 8, 12),
      T('pike_pu', 3, 6, 12), T('calf_slow', 3, 8, 12), T('bent_calf', 2, 10, 15), T('tib', 2, 15, 20), T('reverse_nordic', 2, 6, 10),
      T('pushup_plus', 2, 10, 15), T('ab_wheel', 2, 6, 12)] },
];

// Off-day building blocks — pick any combination on the day.
export const BLOCKS = [
  { id: 'mobility', name: 'Mobility', items: [T('deep_squat', 2, 60), T('cossack', 2, 6), T('9090', 2, 10), T('pancake', 2, 45), T('pike_stretch', 2, 45),
    T('hip_flexor', 2, 30), T('shoulder_flex', 2, 30), T('tspine', 2, 10), T('ankle_mob', 2, 10), T('wrist_mob', 1, 15)] },
  { id: 'handstand', name: 'Handstand', items: [T('wrist_mob', 1, 15), T('handstand', 5, 20, 40), T('hs_shifts', 3, 10), T('sh_taps', 3, 10)] },
  { id: 'compression', name: 'L-sit + compression', items: [T('compression', 3, 10), T('lsit', 4, 10, 20)] },
  { id: 'mu', name: 'Muscle-up', items: [T('muscle_up', 4, 3, 5)] },
  { id: 'planche', name: 'Planche', items: [T('wrist_mob', 1, 15), T('planche', 4, 8, 15)] },
  { id: 'levers', name: 'Front + back lever', items: [T('front_lever', 4, 8, 12), T('back_lever', 3, 8, 12)] },
  { id: 'pistol', name: 'Pistol', items: [T('pistol', 3, 5, 8)] },
  { id: 'animal', name: 'Animal movement', items: [T('bear', 2, 30), T('lat_bear', 2, 30), T('beast', 2, 30), T('crab', 2, 30),
    T('kick_through', 2, 10), T('ape', 2, 30), T('low_crawl', 2, 30), T('crawl_stand', 2, 5)] },
  { id: 'acro', name: 'Acrobatics', items: [T('landing', 1, 5), T('fwd_roll', 2, 5), T('back_roll', 2, 5), T('cartwheel', 3, 5), T('roundoff', 2, 3)] },
  { id: 'tendon', name: 'Light tendon + grip', items: [T('dead_hang', 3, 30, 45), T('scap_pull', 2, 10), T('wrist_mob', 1, 15)] },
  { id: 'boxing', name: 'Boxing', items: [T('footwork', 3, 60), T('shadowbox', 4, 120, 180)] },
  { id: 'climb', name: 'Climbing / grip', items: [T('climb', 1, 8, 15), T('dead_hang', 2, 30, 45)] },
];

// Skill trees. A step unlocks only when a logged session meets its criterion:
// crit { ex, v (variant), f: 'r'|'t'|'d', min, sets, w (min load) }. No crit = manual check-off.
const st = (id, name, crit, o = {}) => ({ id, name, ...(crit ? { crit } : {}), ...o });
const c = (ex, v, f, min, sets = 3, o = {}) => ({ ex, v, f, min, sets, ...o });
export const LIMB_NOTE = 'Long limbs = long levers: L-sit, planche and levers load the shoulders far more than on shorter athletes. Expect weeks to months per level; criteria are quality holds, never session counts.';
export const SKILL_TREES = [
  { id: 'hs', name: 'Handstand', steps: [st('wrist', 'Wrist preparation'), st('wall', 'Wall-facing handstand', c('handstand', 'wall', 't', 45)),
    st('kickup', 'Freestanding kick-up', c('handstand', 'free', 't', 5)), st('free', 'Consistent freestanding hold', c('handstand', 'free', 't', 20)),
    st('shifts', 'Controlled weight shifts', c('hs_shifts', null, 'r', 10)), st('taps', 'Shoulder taps', c('sh_taps', null, 'r', 10)),
    st('walk', 'Handstand walking', c('hs_walk', null, 'r', 10))] },
  { id: 'lsit', name: 'L-sit → V-sit', steps: [st('compress', 'Seated compression', c('compression', null, 'r', 10)),
    st('tuck', 'Tuck support', c('lsit', 'tuck', 't', 15)), st('one_leg', 'One-leg extension', c('lsit', 'one_leg', 't', 10)),
    st('full', 'Full L-sit', c('lsit', 'full', 't', 10)), st('long', 'Longer holds', c('lsit', 'full', 't', 20)), st('v', 'V-sit progression', c('lsit', 'v', 't', 5))] },
  { id: 'mu', name: 'Muscle-up', steps: [st('pu10', '10 strict pull-ups', c('pullup', null, 'r', 10, 1)), st('c2b', 'Chest-to-bar pull-ups', c('muscle_up', 'c2b', 'r', 5)),
    st('sbdip', 'Straight-bar dips', c('muscle_up', 'sbdip', 'r', 8)), st('neg', 'Slow negatives', c('muscle_up', 'negative', 'r', 3)),
    st('band', 'Banded muscle-up', c('muscle_up', 'band', 'r', 3)), st('strict1', 'First strict muscle-up', c('muscle_up', 'strict', 'r', 1, 1)),
    st('strict3', 'Strict muscle-ups 3×3', c('muscle_up', 'strict', 'r', 3))] },
  { id: 'planche', name: 'Planche', steps: [st('lean', 'Planche lean', c('planche', 'lean', 't', 20)), st('tuck', 'Tuck planche', c('planche', 'tuck', 't', 10)),
    st('adv', 'Advanced tuck planche', c('planche', 'adv_tuck', 't', 10)), st('straddle', 'Straddle planche', c('planche', 'straddle', 't', 5))] },
  { id: 'fl', name: 'Front lever', steps: [st('hollow', 'Hollow body 30 s', c('hollow', null, 't', 30)), st('tuck', 'Tuck front lever', c('front_lever', 'tuck', 't', 10)),
    st('adv', 'Advanced tuck', c('front_lever', 'adv_tuck', 't', 10)), st('one_leg', 'One-leg', c('front_lever', 'one_leg', 't', 8)),
    st('straddle', 'Straddle', c('front_lever', 'straddle', 't', 5)), st('full', 'Full front lever', c('front_lever', 'full', 't', 5, 1))] },
  { id: 'bl', name: 'Back lever', steps: [st('skin', 'Skin the cat', c('skin_cat', null, 'r', 3)), st('german', 'German hang', c('back_lever', 'german', 't', 20), { risk: 'caution' }),
    st('tuck', 'Tuck back lever', c('back_lever', 'tuck', 't', 10)), st('adv', 'Advanced tuck', c('back_lever', 'adv_tuck', 't', 10)),
    st('one_leg', 'One-leg', c('back_lever', 'one_leg', 't', 8)), st('straddle', 'Straddle', c('back_lever', 'straddle', 't', 5)), st('full', 'Full back lever', c('back_lever', 'full', 't', 5, 1))] },
  { id: 'pistol', name: 'Pistol squat', steps: [st('assisted', 'Assisted pistol', c('pistol', 'assisted', 'r', 8)), st('box', 'Pistol to box', c('pistol', 'box', 'r', 6)),
    st('full', 'Full pistol', c('pistol', 'full', 'r', 5)), st('full8', 'Pistol 3×8 / leg', c('pistol', 'full', 'r', 8))] },
  { id: 'pull', name: 'Pull strength', steps: [st('hang', 'Dead hang 60 s', c('dead_hang', null, 't', 60, 1)), st('scap', 'Scapular pull-ups 3×10', c('scap_pull', null, 'r', 10)),
    st('pu', 'Pull-ups 3×5', c('pullup', null, 'r', 5)), st('pu10', '10 pull-ups', c('pullup', null, 'r', 10, 1)),
    st('w25', 'Weighted pull-up +25 × 5', c('wpu', null, 'r', 5, 1, { w: 25 })), st('w45', 'Weighted pull-up +45 × 5', c('wpu', null, 'r', 5, 1, { w: 45 })),
    st('archer', 'Archer pull-ups'), st('oap', 'One-arm pull-up progression')] },
  { id: 'push', name: 'Push strength', steps: [st('dips', 'Dips 3×10', c('dips', null, 'r', 10)), st('pike', 'Pike push-ups 3×10', c('pike_pu', null, 'r', 10)),
    st('hspu', 'Handstand push-up progression'), st('ppp', 'Pseudo-planche push-ups 3×10')] },
  { id: 'rolls', name: 'Rolls', steps: [st('fwd', 'Forward roll', c('fwd_roll', null, 'r', 5)), st('back', 'Backward roll', c('back_roll', null, 'r', 5)),
    st('dive', 'Dive roll', null, { risk: 'caution' })] },
  { id: 'cart', name: 'Cartwheel', steps: [st('line', 'Cartwheel on a line', c('cartwheel', 'line', 'r', 5)), st('both', 'Clean both sides', c('cartwheel', 'both', 'r', 5)),
    st('roundoff', 'Roundoff', null, { risk: 'caution' })] },
  { id: 'oac', name: 'One-arm cartwheel', steps: [st('near', 'Near-hand cartwheel', c('cartwheel', 'near', 'r', 5)), st('far', 'Far-hand cartwheel', c('cartwheel', 'far', 'r', 5)),
    st('aerial', 'Aerial progression', null, { risk: 'coach' })] },
  { id: 'tumble', name: 'Advanced tumbling', steps: ['Handspring progression', 'Back handspring', 'Vaulting', 'Beginner tricking', 'Flips']
    .map(n => st(n.toLowerCase().replace(/\W+/g, '_'), n, null, { risk: 'coach' })) },
];

// Benchmarks. ex/metric = also pull data from logged workouts.
export const TESTS = [
  { id: 'sprint10', name: '10 m sprint', unit: 's', better: 'lower', ex: 'sprint', dist: 10 },
  { id: 'sprint20', name: '20 m sprint', unit: 's', better: 'lower', ex: 'sprint', dist: 20 },
  { id: 'broad', name: 'Broad jump', unit: 'in', better: 'higher', ex: 'broad_jump' },
  { id: 'vert', name: 'Vertical jump', unit: 'in', better: 'higher' },
  { id: 'shuttle', name: '5-10-5 shuttle', unit: 's', better: 'lower' },
  { id: 'balance', name: 'Single-leg balance, eyes closed', unit: 's', better: 'higher' },
  { id: 'lsit', name: 'L-sit', unit: 's', better: 'higher', ex: 'lsit' },
  { id: 'hs', name: 'Handstand', unit: 's', better: 'higher', ex: 'handstand' },
  { id: 'pu_max', name: 'Pull-up max (BW)', unit: 'reps', better: 'higher', ex: 'pullup', metric: 'bwReps' },
  { id: 'wpu', name: 'Weighted pull-up (top +lb)', unit: 'lb', better: 'higher', ex: 'wpu', metric: 'topW' },
  { id: 'hang', name: 'Dead hang', unit: 's', better: 'higher', ex: 'dead_hang' },
  { id: 'knee_wall', name: 'Ankle knee-to-wall', unit: 'cm', better: 'higher' },
  { id: 'pancake', name: 'Pancake reach past feet', unit: 'cm', better: 'higher' },
  { id: 'pike', name: 'Pike reach past toes', unit: 'cm', better: 'higher' },
  { id: 'deep_squat', name: 'Deep squat hold (heels down)', unit: 's', better: 'higher', ex: 'deep_squat' },
];

// Off-day plans, cycled in order. avoidBefore: skip this plan the day before that FBEOD session
// (keeps pulling/leg-heavy skill work away from A's weighted pulls/squats and B's jumps/sprints).
export const OFF_PLANS = [
  { id: 'p1', name: 'Handstand + L-sit', blocks: ['mobility', 'handstand', 'compression'] },
  { id: 'p2', name: 'Crawl + levers', blocks: ['mobility', 'animal', 'levers'], avoidBefore: ['A'] },
  { id: 'p3', name: 'Acrobatics + planche', blocks: ['mobility', 'acro', 'planche'], avoidBefore: ['B'] },
  { id: 'p4', name: 'Muscle-up + pistol', blocks: ['mobility', 'mu', 'pistol', 'tendon'], avoidBefore: ['A', 'B'] },
  { id: 'p5', name: 'Boxing + grip', blocks: ['mobility', 'boxing', 'climb'] },
];
// Recovery-only plan when soreness is high or a tendon is irritated.
export const RECOVERY_PLAN = { id: 'rec', name: 'Recovery (mobility only)', blocks: ['mobility'] };

// Better demo-search terms where the plain name is ambiguous.
export const DEMO_Q = {
  spanish_squat: 'spanish squat isometric patellar tendon', ext_rot: 'cable external rotation rotator cuff', wrist_curl: 'wrist flexion extension curls',
  calf_slow: 'heavy slow resistance calf raise achilles', bent_calf: 'bent knee calf raise soleus', reverse_nordic: 'reverse nordic curl knee',
  pushup_plus: 'push up plus serratus', scap_pull: 'scapular pull up', hs_shifts: 'handstand weight shifts drill', compression: 'seated pike compression lifts',
  ape: 'ape movement animal flow', beast: 'beast crawl animal flow', kick_through: 'kick through animal flow', crawl_stand: 'crawl to squat to stand drill',
  landing: 'safe landing drills tumbling', sled: 'sled push technique acceleration', lat_bounds: 'lateral bounds plyometric', hollow: 'hollow body hold',
  '9090': '90 90 hip transitions', pancake: 'pancake stretch progression', pike_stretch: 'pike compression stretch', skin_cat: 'skin the cat rings bar',
  footwork: 'boxing footwork drills beginner', shadowbox: 'shadowboxing beginner round', climb: 'bouldering technique beginner',
};

export const DEFAULT_SETTINGS = {
  unit: 'lb', painCap: 3,
  goal: { bwMin: null, bwMax: null, text: 'Lean and athletic. Performance first, scale second.' }, // set in Settings → Goal
  rotation: ['A', 'B', 'C'],
};
