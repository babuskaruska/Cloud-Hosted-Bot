// Meta progression: embers banked at the end of every run, the Keeper's Tree of upgrades bought with them, Heat tiers,
// lifetime records, story flags, achievements (META.ach, 68-achieve.js) and the Daily Long Night's local best (META.daily). Kept in localStorage 'lanternhold.meta' (every access in try/catch).
//
// Run modes (G.mode): 'demo' is the AI commander behind the main menu and every test session (URL flags): no upgrades,
// no Heat, no story, no embers, and the numbers play exactly as before. 'campaign' is the six hand-made lands in order
// (land 0 = Ashen Pass, BIOME.start = 0); 'night' is The Long Night, the endless lands from land 6 on (G.level >= 6).
// 'daily' is the Daily Long Night: the Long Night at Heat 0 on the seed of the UTC day (dailySeed()), with the day's
// mutators fixed by that seed (dailyMods), and the local best per day in META.daily = { date, best, runs }.
// A campaign run that beats the sixth land carries straight on into the Long Night.
//
// Everything a run reads from here is a plain number on G set by applyMeta(), each 1 (or 0) outside a run, so the
// demo and QA multiply by exactly 1: G.towerDmg, G.cdMul, G.spellPow, G.spellManaMul, G.hpMul, G.spdMul, G.goldMul,
// G.ocMul, G.mendMul, G.branchMul, G.budgetMul, G.bossHpMul, G.eliteShift, G.eliteMul, G.waveGold, G.heatMods.

// Test sessions: any of these URL flags sets up a run of its own (QA, record.js, screenshots). No menu, no writes.
const TEST_FLAGS = ['seed', 'manual', 'ff', 'biome', 'level', 'k', 'board', 'phase', 'nosave'];
const TEST_SESSION = TEST_FLAGS.some(f => HASH[f] !== undefined);
const CAMPAIGN_LANDS = 6;

// One-time move of the old Cinderwatch keys (best wave, mute, settings, help lines, saved run) to Lanternhold's.
(function migrateStorage() {
  try {
    for (const k of ['best', 'muted', 'settings', 'help', 'save']) {
      const o = 'cinderwatch.' + k, n = 'lanternhold.' + k, v = localStorage.getItem(o);
      if (v !== null && localStorage.getItem(n) === null) localStorage.setItem(n, v);
      if (v !== null) localStorage.removeItem(o);
    }
  } catch (e) {}
})();

Object.assign(G, {
  mode: 'demo', heat: 0, runSeed: 0, freeTowers: 0, rerolls: 0,
  towerDmg: 1, cdMul: 1, spellPow: 1, spellManaMul: 1, hpMul: 1, spdMul: 1, goldMul: 1, ocMul: 1, mendMul: 1, branchMul: 1,
  budgetMul: 1, bossHpMul: 1, eliteShift: 0, eliteMul: 1, waveGold: 0, heatMods: 0, heatAffix: 0,
});
const inRun = () => G.mode === 'campaign' || G.mode === 'night' || G.mode === 'daily';
// The Long Night's endless lands (the night itself, or the Daily Long Night, which is the night on a seed of the day).
const nightMode = m => m === 'night' || m === 'daily';
// ---- The Daily Long Night: the same lands and mutators for every keeper on a UTC day; the local best is kept. ----
function dailyDate(d) { d = d || new Date(); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
function dailySeed(date) { const s = date || dailyDate(); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return 1 + h % 999999937; }
// The day's mutators for a land, from the seed alone (not the gameplay stream), so every keeper meets the same ones.
function dailyMods(seed, level) {
  if (typeof MUTATORS !== 'object' || typeof modCount !== 'function') return [];
  const rng = makeRng((seed ^ Math.imul(level + 1, 0x9E3779B1)) >>> 0), n = modCount(level);
  const curses = Object.keys(MUTATORS).filter(k => MUTATORS[k].curse), boons = Object.keys(MUTATORS).filter(k => MUTATORS[k].boon), out = [];
  for (let i = 0; i < n && curses.length; i++) { const j = Math.floor(rng() * curses.length); out.push(curses[j]); curses.splice(j, 1); }
  if (n > 0 && rng() < .35) out.push(boons[Math.floor(rng() * boons.length)]);
  return out;
}
// The Daily Long Night replays the same for everyone: the gameplay stream is reseeded from the day's seed at each land
// start (k = 0) and at each wave start (before its queue is rolled), so the waves, elites and boss rolls depend only on
// the date, the land and the wave, and two runs with the same inputs replay identically.
function dailyReseed(level, k) {
  if (G.mode !== 'daily' || !Number.isFinite(G.runSeed)) return;
  rnd.reseed((G.runSeed ^ Math.imul(level + 1, 0x9E3779B1) ^ Math.imul(k + 7, 0x85EBCA6B)) >>> 0);
  // At a land start the game clock starts over too (flyer sway, regen and the commander's timers read G.t), so how long
  // the demo ran behind the menu, or how long earlier lands took, cannot change what happens on this one.
  if (k === 0) { G.t = 0; AIS.lost = G.menLost | 0; AIS.lostT = -99; AIS.lostN = 0; }
}
const dailyBest = () => META.daily && META.daily.date === dailyDate() ? META.daily.best : 0;
// The land number shown to the player (1-based), and the Long Night depth (1 on its first land).
const landNo = () => G.level + 1;
const nightDepth = () => Math.max(0, G.level - CAMPAIGN_LANDS + 1);

// The Keeper's Tree. v(l): the effect at level l (0 = not bought); fmt(x): how it reads.
const UPGRADES = [
  { key: 'gold', name: 'Hoard', icon: 'coin', max: 5, cost: [20, 45, 80, 130, 200], v: l => 40 * l, fmt: x => '+' + x + ' gold per land', desc: 'More gold to build with when a land begins.' },
  { key: 'dmg', name: 'Keen Steel', icon: 'archer', max: 5, cost: [30, 60, 110, 180, 280], v: l => 4 * l, fmt: x => '+' + x + '% tower damage', desc: 'Every tower and footman hits harder.' },
  { key: 'lives', name: 'Deep Hearth', icon: 'flame', max: 4, cost: [25, 55, 100, 170], v: l => 2 * l, fmt: x => '+' + x + ' beacon lives', desc: 'The beacon holds out longer.' },
  { key: 'mana', name: 'Wellspring', icon: 'mana', max: 3, cost: [25, 60, 120], v: l => 15 * l, fmt: x => '+' + x + ' mana, +' + Math.round(x * 2 / 3) + ' max', desc: 'Start each land with more mana, and hold more.' },
  { key: 'cool', name: 'Swift Rites', icon: 'hourglass', max: 4, cost: [30, 65, 120, 200], v: l => 8 * l, fmt: x => '-' + x + '% cooldowns', desc: 'Spells come back sooner.' },
  { key: 'spell', name: 'Kindled Rites', icon: 'meteor', max: 3, cost: [40, 90, 170], v: l => 12 * l, fmt: x => '+' + x + '% spell power', desc: 'Meteor and Frost hit harder; Rally militia are tougher.' },
  { key: 'free', name: 'Founding Stone', icon: 'guard', max: 2, cost: [60, 180], v: l => l, fmt: x => x === 1 ? 'First tower free' : 'First ' + x + ' towers free', desc: 'Your first towers on each land cost nothing.' },
  { key: 'bounty', name: 'Grave Tithe', icon: 'skull', max: 5, cost: [25, 55, 100, 160, 250], v: l => 5 * l, fmt: x => '+' + x + '% kill gold', desc: 'The fallen pay more.' },
  { key: 'chest', name: 'War Chest', icon: 'banner', max: 4, cost: [30, 60, 110, 180], v: l => 6 * l, fmt: x => '+' + x + ' gold per wave', desc: 'Extra gold each time a wave is beaten.' },
  { key: 'oc', name: 'Ember Forge', icon: 'upgrade', max: 3, cost: [40, 90, 170], v: l => 10 * l, fmt: x => '-' + x + '% overcharge', desc: 'Overcharging a branched tower costs less.' },
  { key: 'branch', name: 'Master Plans', icon: 'star', max: 3, cost: [35, 80, 150], v: l => 10 * l, fmt: x => '-' + x + '% branch cost', desc: 'Tower branches cost less.' },
  { key: 'mend', name: "Mender's Oil", icon: 'sell', max: 3, cost: [25, 60, 120], v: l => 12 * l, fmt: x => '-' + x + '% mend cost', desc: 'Mending the beacon costs less.' },
  { key: 'reroll', name: "Fate's Lantern", icon: 'lantern', max: 3, cost: [50, 110, 200], v: l => l, fmt: x => x + ' reroll' + (x > 1 ? 's' : '') + ' a run', desc: 'Reroll a land\'s mutators when it begins.' },
  { key: 'heart', name: 'Ember Heart', icon: 'ember', max: 3, cost: [50, 120, 240], v: l => l, fmt: x => '+' + x + ' heat-proof li' + (x > 1 ? 'ves' : 'fe'), desc: 'Lives on every land that no Heat can take away.' },
];
const UPG = {}; for (const u of UPGRADES) UPG[u.key] = u;

// Heat: each tier adds one rule on top of the ones below it, and pays more embers.
// Every tier also lifts the pressure ceiling by 0.1 (pressCap in 62-game.js): strong play meets more monsters.
const HEAT = [
  { name: 'No Heat', tip: 'The road as the old keepers knew it.' },
  { name: 'Thick Bones', tip: 'Monsters have 15% more health.' },
  { name: 'Restless Dead', tip: 'Monsters move 8% faster.' },
  { name: 'Hollow Tide', tip: 'One more mutator on every land.' },
  { name: 'Thin Fire', tip: 'The beacon has 3 fewer lives.' },
  { name: 'Early Elites', tip: 'Elites come a land sooner, and more often.' },
  { name: 'Lean Times', tip: '15% less gold from kills and waves.' },
  { name: 'Crowned Dread', tip: 'Bosses gain an affix and 20% more health.' },
  { name: 'Swarming Dark', tip: 'Waves carry 25% more monsters.' },
  { name: 'Brittle Beacon', tip: '3 fewer lives again; mending costs 50% more.' },
  { name: 'Endless Night', tip: 'Monsters have 30% more health; spells cost 20% more mana.' },
];
const HEAT_MAX = HEAT.length - 1;
const heatMul = h => Math.round((1 + .35 * h) * 100) / 100;
const HEAT_UNLOCK_LAND = 10; // reaching land 10 at Heat N unlocks Heat N+1

const META_KEY = 'lanternhold.meta', META_V = 1;
const META = {
  on: !TEST_SESSION, // writes allowed
  embers: 0, earned: 0, up: {}, heatMax: 0, tut: 0, story: {}, seen: {}, night: 0, ach: {}, daily: { date: '', best: 0, runs: 0 },
  stats: { runs: 0, slain: 0, bosses: 0, bestWave: 0, bestLand: 0, bestNight: 0, campaigns: 0, time: 0, abandons: 0, heatBest: 0, elites: 0, dailies: 0 },
  dirty: false, saveT: 0,
  run: null, // the live run: { mode, heat, level0, banked, endingSeen, t }
  last: null, // the last banked result, for the results screen
};
function loadMeta() {
  let o = null; try { o = JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch (e) { o = null; }
  if (!o || typeof o !== 'object' || o.v !== META_V) return;
  const n = (v, lo, hi) => typeof v === 'number' && isFinite(v) ? clamp(Math.floor(v), lo, hi) : 0;
  META.embers = n(o.embers, 0, 1e9); META.earned = n(o.earned, 0, 1e9); META.heatMax = n(o.heatMax, 0, HEAT_MAX); META.tut = o.tut ? 1 : 0; META.night = n(o.night, 0, 1e6);
  if (o.up && typeof o.up === 'object') for (const u of UPGRADES) META.up[u.key] = n(o.up[u.key], 0, u.max);
  for (const f of ['story', 'seen', 'ach']) if (o[f] && typeof o[f] === 'object') for (const k in o[f]) if (o[f][k]) META[f][k] = 1;
  if (o.stats && typeof o.stats === 'object') for (const k in META.stats) META.stats[k] = n(o.stats[k], 0, 1e12);
  const D = o.daily; if (D && typeof D === 'object' && typeof D.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(D.date)) META.daily = { date: D.date, best: n(D.best, 0, 1e6), runs: n(D.runs, 0, 1e6) };
}
function saveMeta() {
  META.dirty = false; if (!META.on) return false;
  const o = { v: META_V, embers: META.embers, earned: META.earned, up: META.up, heatMax: META.heatMax, tut: META.tut, story: META.story, seen: META.seen, night: META.night, stats: META.stats, ach: META.ach, daily: META.daily };
  try { localStorage.setItem(META_KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
}
// Throttled save for small changes (sightings, play time).
function metaTouch() { META.dirty = true; }
function metaTick(dt) {
  if (inRun() && G.phase === 'play' && !G.paused) { META.stats.time += dt * G.speed; if (META.run) META.run.t += dt * G.speed; }
  META.saveT -= dt; if (META.dirty && META.saveT <= 0) { META.saveT = 4; saveMeta(); }
}
loadMeta();

const upLv = key => (inRun() && META.up[key]) || 0;
const upVal = key => UPG[key].v(upLv(key));
function upCost(key) { const u = UPG[key], l = META.up[key] || 0; return l >= u.max ? 0 : u.cost[l]; }
function buyUpgrade(key) {
  const c = upCost(key); if (!c || META.embers < c) return false;
  META.embers -= c; META.up[key] = (META.up[key] || 0) + 1; saveMeta();
  sfx('upgradeBuy', CAM.x, CAM.z, 1, META.up[key] / UPG[key].max);
  achTree();
  return true;
}
// A full refund of the tree (the Codex offers it): every ember spent comes back.
function treeSpent() { let s = 0; for (const u of UPGRADES) for (let l = 0; l < (META.up[u.key] || 0); l++) s += u.cost[l]; return s; }
function refundTree() { META.embers += treeSpent(); META.up = {}; saveMeta(); }

// The rules of a Heat tier, all stacking (every tier at or below h applies).
function heatRules(h) {
  const r = { hp: 1, spd: 1, mods: 0, lives: 0, eliteShift: 0, eliteMul: 1, gold: 1, bossHp: 1, affix: 0, budget: 1, mend: 1, mana: 1 };
  const noMods = typeof MUTATORS === 'undefined' || typeof modCount !== 'function';
  if (h >= 1) r.hp *= 1.15;
  if (h >= 2) r.spd *= 1.08;
  if (h >= 3) { r.mods = 1; if (noMods) r.hp *= 1.1; } // without mutators in the build, the tier adds health instead
  if (h >= 4) r.lives -= 3;
  if (h >= 5) { r.eliteShift = 8; r.eliteMul = 1.3; }
  if (h >= 6) r.gold *= .85;
  if (h >= 7) { r.bossHp *= 1.2; r.affix = 1; }
  if (h >= 8) r.budget *= 1.25;
  if (h >= 9) { r.lives -= 3; r.mend *= 1.5; }
  if (h >= 10) { r.hp *= 1.3; r.mana *= 1.2; }
  return r;
}

// applyMeta(): the run-wide numbers from the tree and the Heat. Called when a run starts or is continued, and with
// G.mode 'demo' to put every number back to 1.
function applyMeta() {
  const h = inRun() ? clamp(G.heat | 0, 0, HEAT_MAX) : 0, H = heatRules(h); G.heat = h;
  G.towerDmg = 1 + upVal('dmg') / 100; G.cdMul = 1 - upVal('cool') / 100; G.spellPow = 1 + upVal('spell') / 100; G.spellManaMul = H.mana;
  G.hpMul = H.hp; G.spdMul = H.spd; G.goldMul = H.gold * (1 + upVal('bounty') / 100); G.waveGold = upVal('chest');
  G.ocMul = 1 - upVal('oc') / 100; G.mendMul = (1 - upVal('mend') / 100) * H.mend; G.branchMul = 1 - upVal('branch') / 100;
  G.budgetMul = H.budget; G.bossHpMul = H.bossHp; G.heatAffix = H.affix; G.eliteShift = H.eliteShift; G.eliteMul = H.eliteMul; G.heatMods = H.mods;
  G.maxLives = Math.max(5, 20 + upVal('lives') + H.lives) + upVal('heart');
  G.manaMax = 100 + Math.round(upVal('mana') * 2 / 3);
  G.mana = Math.min(G.mana, G.manaMax);
  UI.mutCard = inRun(); // the land arrival card shows the mutators in a run (Forge's banner stays for the demo)
}
// Per land, at the end of beginBattle (restoring: a saved wave keeps its own gold, lives and mana).
function metaLandStart(restoring) {
  G.bountyMul *= G.goldMul;
  G.freeTowers = upVal('free');
  if (!inRun()) return;
  // The Daily Long Night: the day's mutators, rolled from the seed instead of the gameplay stream (Forge's roll skips the land).
  if (G.mode === 'daily') { setMods(dailyMods(G.runSeed, G.level)); G.modLevel = G.level; G.bountyMul *= modMul('bounty'); }
  // A continued run keeps the land's saved mutators (before round 11 they rolled afresh, so reloading rerolled the curses).
  else if (restoring && G.restoreMods && G.restoreMods.level === G.level) { setMods(G.restoreMods.keys); G.modLevel = G.level; G.bountyMul *= modMul('bounty'); }
  G.restoreMods = null;
  achLandStart();
  if (!restoring) { G.gold += upVal('gold'); UI.goldShown = G.gold; G.mana = Math.min(G.manaMax, G.mana + upVal('mana')); }
  // Heat tier 3 asks for an extra mutator: Forge's modCount adds G.heatMods when the land's mutators roll.
  if (!restoring) {
    const S = META.stats; S.bestLand = Math.max(S.bestLand, landNo()); if (G.level >= CAMPAIGN_LANDS) S.bestNight = Math.max(S.bestNight, nightDepth());
    // Reaching land 10 at Heat N opens Heat N+1.
    if (landNo() >= HEAT_UNLOCK_LAND && G.heat >= META.heatMax && META.heatMax < HEAT_MAX) { META.heatMax = G.heat + 1; metaUnlock('Heat ' + META.heatMax + ' unlocked'); }
    metaTouch();
  }
  STORY.landStart(restoring);
}
const metaNotes = [];
function metaUnlock(text) { metaNotes.push(text); if (META.run) (META.run.notes = META.run.notes || []).push(text); UI.banner(text, 3.6, true); sfx('emberGain', CAM.x, CAM.z, 1, 1); saveMeta(); }
// A land cleared (setPhase 'clear').
function metaLandClear() {
  if (!inRun()) return;
  META.stats.bosses++;
  if (G.mode === 'campaign' && G.level === CAMPAIGN_LANDS - 1) {
    // The campaign is beaten: Heat 1 opens, the ending plays, and the run carries on into the Long Night.
    META.stats.campaigns++; META.stats.heatBest = Math.max(META.stats.heatBest, G.heat);
    if (META.heatMax < 1) { META.heatMax = 1; metaUnlock('Heat 1 unlocked'); }
    if (META.run) META.run.ending = true;
    // The victory: the land holds on its clear phase while the cinematic, the ending and the results screen play
    // (MENU.victory), then the run carries on into the Long Night.
    G.mode = 'night'; G.holdClear = true; MENU.victory = { stage: 'pending' };
  }
  achLandClear(); STORY.landClear();
  metaTouch();
}

// Embers for a run: a little per wave survived, more per boss (deeper bosses pay more), a bonus per Long Night land
// reached, and the story when the run finishes the campaign; all times the Heat multiplier.
function embersFor(r) {
  const waves = Math.max(0, r.waves | 0), bosses = Math.max(0, r.bosses | 0), l0 = r.level0 | 0;
  let boss = 0; for (let i = 0; i < bosses; i++) boss += 10 + 2 * (l0 + i);
  const depth = 3 * Math.max(0, (r.level | 0) - Math.max(CAMPAIGN_LANDS - 1, l0)),  story = r.ending ? 40 : 0, mul = heatMul(r.heat | 0);
  const base = waves + boss + depth + story;
  return { waves, boss, depth, story, mul, heat: r.heat | 0, total: Math.round(base * mul) };
}
// Bank the live run (defeat or abandon): embers, records. Returns the result for the results screen. Once per run.
function bankRun(how) {
  const run = META.run; if (!run || run.banked || !inRun()) return META.last;
  run.banked = true;
  const sm = runSummary() || { waves: 0, lands: 0, slain: 0 };
  const res = embersFor({ waves: sm.waves, bosses: sm.lands, level: G.level, level0: run.level0, heat: G.heat, ending: run.ending && !run.endingPaid });
  run.endingPaid = true;
  Object.assign(res, { how, sum: sm, mode: run.mode, land: landNo(), landName: G.B && G.phase !== 'crumble' ? G.B.bio.name : '', notes: (run.notes || []).slice() });
  META.embers += res.total; META.earned += res.total;
  const S = META.stats; S.runs++; S.slain += sm.slain || 0; S.bestWave = Math.max(S.bestWave, waveNumber()); if (how === 'abandon') S.abandons++;
  if (run.mode === 'daily') {
    // The day's best counts waves survived; a run continued past midnight still counts for the day it began.
    // (A day older than the stored record, say yesterday's daily continued today, must not wipe today's best: it is
    // counted on a throwaway record instead.)
    const day = run.day || dailyDate(), md = META.daily, D = md && md.date === day ? md : md && md.date > day ? { date: day, best: 0, runs: 0 } : (META.daily = { date: day, best: 0, runs: 0 });
    D.runs++; S.dailies++; res.daily = { day, waves: sm.waves || 0, best: Math.max(D.best, sm.waves || 0), newBest: (sm.waves || 0) > D.best };
    D.best = res.daily.best;
  }
  achBanked(res); res.ach = (run.ach || []).slice();
  res.before = META.embers - res.total; res.after = META.embers;
  META.last = res; saveMeta();
  sfx('emberGain', CAM.x, CAM.z, 1, clamp(res.total / 100, .2, 1));
  return res;
}
// Embers a saved run would bank if it were abandoned from the menu (starting a new run over a save).
function embersForSave(S) {
  if (!S || !S.mode || S.mode === 'demo') return null;
  const RS = S.runStats || {}, waves = Math.max(0, S.level * G.wavesPerLand + S.k - 1 - (RS.wave0 || 0));
  return embersFor({ waves, bosses: RS.lands || 0, level: S.level, level0: S.level0 === undefined ? (nightMode(S.mode) ? CAMPAIGN_LANDS : 0) : S.level0, heat: S.heat || 0, ending: false });
}
function bankSave(S) {
  const r = embersForSave(S); if (!r) return null;
  META.embers += r.total; META.earned += r.total; META.stats.runs++; META.stats.abandons++; saveMeta(); return r;
}

// ---- Starting and leaving runs ----
// startRun: from the menu (or Play again). The board behind crumbles and the run's first land rises in its place.
function startRun(mode, heat) {
  const S = continueOffer(); if (S) bankSave(S);
  clearSave(); STORY.clear(); SAVE.hold = false;
  G.mode = mode === 'night' || mode === 'daily' ? mode : 'campaign'; G.heat = G.mode === 'daily' ? 0 : clamp(heat | 0, 0, Math.min(HEAT_MAX, META.heatMax));
  G.level = nightMode(G.mode) ? CAMPAIGN_LANDS : 0; G.boardIndex = G.level; BIOME.start = 0; G.advance = false; G.newRun = true; G.evLevel = -1; G.run++; G.holdClear = false; MENU.victory = null;
  G.runSeed = G.mode === 'daily' ? dailySeed() : 1 + Math.floor(Math.random() * 1e9); G.boardSeed = G.mode === 'daily' ? 1 + G.runSeed % 9000 : 1 + Math.floor(Math.random() * 9000);
  G.press = 1; G.speed = 1; G.paused = false; G.modLevel = -1; setMods([]); MENU.arrivalLv = -99;
  // The run's tally starts now, not at its first battle: abandoned while the board still crumbles, it must not bank the demo's waves.
  G.k = 0; newRun();
  // A run starts with the lifetime sightings, so "New:" tips only show for monsters this keeper has not met in a run.
  G.seen = {}; for (const k in META.seen) G.seen[k] = 1;
  META.run = { mode: G.mode, heat: G.heat, level0: G.level, banked: false, ending: false, t: 0, notes: [], ach: [], day: G.mode === 'daily' ? dailyDate() : '' };
  // For Echo's daily sting: true only for a daily started fresh from the menu, never for one continued from a save.
  G.dailyFresh = G.mode === 'daily';
  applyMeta(); G.mana = 30; G.rerolls = upVal('reroll');
  TUT.maybeStart();
  if (TUT.active()) UI.everManual = true; // the tutorial replaces the first "You command" help line
  UI.setManual(true); UI.everManual = true; camReset();
  STORY.runStart();
  if (G.phase !== 'crumble') setPhase('crumble');
  sfx('uiClick', CAM.x, CAM.z, 1);
}
// Back to the AI demo behind the main menu: a fresh random land, the commander in charge, every number back to 1.
function startDemo() {
  STORY.clear(); TUT.stop(); SAVE.hold = false;
  G.mode = 'demo'; G.heat = 0; META.run = null; G.dailyFresh = false; G.holdClear = false; MENU.victory = null; applyMeta(); G.maxLives = 20;
  BIOME.start = Math.floor(Math.random() * BIOMES.length) - G.boardIndex;
  G.level = 0; G.advance = false; G.newRun = true; G.evLevel = -1; G.run++; G.press = 1; G.speed = 1; G.paused = false; G.modLevel = -1; setMods([]);
  UI.setManual(false); camReset();
  if (G.phase !== 'crumble') setPhase('crumble');
}
// The run leaves for the results screen: embers are banked and the save is gone.
function abandonRun(how) {
  if (!inRun()) return null;
  const res = bankRun(how || 'abandon'); G.holdClear = false; clearSave(); SAVE.hold = true; G.paused = true; // nothing saves behind the results screen
  return res;
}
// Continue: the saved run's mode and Heat come back with it (restoreRun calls this before rebuilding the board).
function metaRestore(S) {
  SAVE.hold = false; G.dailyFresh = false;
  G.mode = S.mode === 'night' || S.mode === 'daily' || S.mode === 'demo' ? S.mode : 'campaign'; G.holdClear = false; MENU.victory = null;
  G.heat = _int(S.heat, 0, HEAT_MAX) ? S.heat : 0; G.runSeed = _int(S.runSeed, 0, 2e9) ? S.runSeed : S.seed;
  G.rerolls = _int(S.rerolls, 0, 9) ? S.rerolls : upVal('reroll');
  META.run = { mode: G.mode, heat: G.heat, level0: _int(S.level0, 0, 999) ? S.level0 : (nightMode(G.mode) ? CAMPAIGN_LANDS : 0), banked: false, ending: !!S.ending, endingPaid: !!S.endingPaid, t: 0, notes: [], ach: [], day: typeof S.day === 'string' ? S.day : '' };
  if (G.mode !== 'demo') { G.seen = {}; for (const k in META.seen) G.seen[k] = 1; }
  G.restoreMods = Array.isArray(S.mods) && _int(S.modLevel, 0, 999) && typeof MUTATORS === 'object' ? { level: S.modLevel, keys: S.mods.filter(k => typeof k === 'string' && MUTATORS[k]).slice(0, 8) } : null;
  applyMeta();
}
function metaSnapshot(S) {
  S.mode = G.mode; S.heat = G.heat; S.runSeed = G.runSeed; S.rerolls = G.rerolls;
  if (G.modLevel === G.level && Array.isArray(G.mods)) { S.mods = G.mods.slice(); S.modLevel = G.level; }
  if (META.run) { S.level0 = META.run.level0; S.ending = !!META.run.ending; S.endingPaid = !!META.run.endingPaid; if (META.run.day) S.day = META.run.day; }
  return S;
}
// A sighting in a run counts for the Codex (and silences that monster's "New:" tip in later runs).
function metaSaw(key) { if (inRun() && !META.seen[key]) { META.seen[key] = 1; metaTouch(); } }

// Reroll the land's mutators (Fate's Lantern) with Forge's rollMods (a fresh roll from the run's random stream). The
// bounty part of the old roll comes off G.bountyMul and the new one goes on. A roll that comes back the same drops one.
function rerollMods() {
  if (!(G.rerolls > 0) || !Array.isArray(G.mods) || !G.mods.length || typeof rollMods !== 'function') return false;
  const old = G.mods.slice(), b0 = modMul('bounty'); G.rerolls--;
  let keys = old; try { keys = rollMods(G.level); } catch (e) { keys = old; }
  if (!Array.isArray(keys) || (keys.length === old.length && keys.every((k, i) => k === old[i]))) { keys = old.slice(); keys.splice(Math.floor(Math.random() * keys.length), 1); }
  setMods(keys); G.bountyMul *= modMul('bounty') / b0;
  sfx('upgradeBuy', CAM.x, CAM.z, .8, 0);
  return true;
}
// The active mutators, read defensively (Forge's 64-endless.js may not be in the build).
function activeMods() {
  const out = []; if (!Array.isArray(G.mods)) return out;
  const M = typeof MUTATORS === 'object' && MUTATORS ? MUTATORS : {};
  for (const k of G.mods) { const d = M[k] || {}; out.push({ key: k, name: typeof d.name === 'string' ? d.name : k.charAt(0).toUpperCase() + k.slice(1), tip: typeof d.tip === 'string' ? d.tip : '', icon: typeof d.icon === 'string' ? d.icon : '' }); }
  return out;
}
