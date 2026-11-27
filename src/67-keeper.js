// Round 14 (Mira): rewards and progress beside the Keeper's Tree, all kept in META (66-meta.js) and only ever read in a
// real run (the demo behind the menu and every test session play exactly as before).
//
// - Keeper level (Hoidja tase): XP from every banked run (keeperXpFor), a level from the total (keeperLevel), and a
//   perk every few levels (KEEPER_PERKS): tower banner colours (BANNERS, picked on the 'keeper' screen; G.bannerCol is
//   read by blueprint() in 60-towers.js), a starting-gold purse, a free first spell each land (G.freeSpell, read by
//   spellMana in 62-game.js) and two more beacon lives.
// - Daily gift (Päeva kingitus): embers once per LOCAL calendar day; days in a row grow it (META.gift = { date, streak }).
// - Weekly challenge (Nädala katse): one land with special rules (WEEK_RULES), the same for a whole ISO week
//   (weekNow()). Played as a one-land campaign run (G.weekly = rule key); clearing it pays a reward once per week
//   (META.week = { id, done, runs }) and ends the run on the victory results.

// ---- Keeper level ----
const KEEPER_MAX = 30;
// XP needed to go from level L to L + 1.
const keeperNeed = L => 50 + 30 * (L - 1);
function keeperLevel(xp) {
  xp = xp === undefined ? META.xp : xp; let L = 1, need = keeperNeed(1);
  while (L < KEEPER_MAX && xp >= need) { xp -= need; L++; need = keeperNeed(L); }
  return { lv: L, into: xp, need, frac: L >= KEEPER_MAX ? 1 : xp / need };
}
// XP for a run: waves and lands count, the difficulty does not (the youngest keepers on Kerge level up as fast).
function keeperXpFor(waves, lands) { return 10 + 3 * Math.max(0, waves | 0) + 15 * Math.max(0, lands | 0); }
// Tower banner colours: index 0 keeps the usual red and blue cloth.
const BANNERS = [
  { name: 'Punane', col: null, sw: '#7c2c24' },
  { name: 'Roheline', col: 0x2f7a38, sw: '#2f7a38' },
  { name: 'Lilla', col: 0x6a2c8c, sw: '#6a2c8c' },
  { name: 'Kuld', col: 0xc0942a, sw: '#c0942a' },
  { name: 'Öine', col: 0x1c2c5a, sw: '#3a4c8a' },
];
const KEEPER_PERKS = [
  { lv: 2, key: 'ban1', short: 'lipp', name: 'Roheline lipp', tip: 'Uus lipuvärv tornidele.', icon: 'banner', ban: 1 },
  { lv: 3, key: 'purse', short: '+30 kulda', name: 'Hoidja kukkur', tip: '+30 kulda iga maa alguses.', icon: 'coin' },
  { lv: 5, key: 'ban2', short: 'lipp', name: 'Lilla lipp', tip: 'Uus lipuvärv tornidele.', icon: 'banner', ban: 2 },
  { lv: 6, key: 'spell', short: 'tasuta loits', name: 'Lisaloits', tip: 'Esimene loits igal maal on tasuta.', icon: 'meteor' },
  { lv: 8, key: 'heart', short: '+2 elu', name: 'Tugev süda', tip: 'Majakal on 2 elu rohkem.', icon: 'flame' },
  { lv: 10, key: 'ban3', short: 'lipp', name: 'Kuldne lipp', tip: 'Uus lipuvärv tornidele.', icon: 'banner', ban: 3 },
  { lv: 12, key: 'purse2', short: '+40 kulda', name: 'Rikas kukkur', tip: 'Veel +40 kulda iga maa alguses.', icon: 'coin' },
  { lv: 15, key: 'ban4', short: 'lipp', name: 'Öine lipp', tip: 'Uus lipuvärv tornidele.', icon: 'banner', ban: 4 },
];
const perkOwned = key => { const p = KEEPER_PERKS.find(q => q.key === key); return !!p && keeperLevel().lv >= p.lv; };
// A perk in force: owned, and this is a real run.
const perkOn = key => inRun() && perkOwned(key);
const bannerOpen = i => i === 0 || KEEPER_PERKS.some(p => p.ban === i && keeperLevel().lv >= p.lv);
function nextPerk() { const L = keeperLevel().lv; return KEEPER_PERKS.find(p => p.lv > L) || null; }
// Add XP; returns the perks newly reached (the results screen rings them).
function keeperGain(n) {
  n = Math.max(0, Math.round(n)); if (!n) return [];
  const before = keeperLevel().lv; META.xp = Math.min(1e9, (META.xp || 0) + n); const after = keeperLevel().lv;
  const out = [];
  if (after > before) { out.push('Hoidja tase ' + after + '!'); for (const p of KEEPER_PERKS) if (p.lv > before && p.lv <= after) out.push('Uus: ' + p.name); }
  return out;
}
// The colour for tower banners in this run (blueprint() reads G.bannerCol), else null.
function keeperBanner() {
  const i = META.banner | 0; if (!inRun() || !i || !bannerOpen(i) || !BANNERS[i]) return null;
  return C(BANNERS[i].col);
}

// ---- Daily gift (the keeper's own calendar day) ----
function localDate(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const giftReady = () => META.on && META.gift.date !== localDate();
function giftAmount(streak) { return 10 + 5 * (clamp(streak | 0, 1, 7) - 1); }
// The streak the gift would have if claimed now (yesterday's claim grows it, else it starts again at 1).
function giftStreak() { const y = new Date(); y.setDate(y.getDate() - 1); return META.gift.date === localDate(y) ? Math.min(7, (META.gift.streak | 0) + 1) : 1; }
function claimGift() {
  if (!giftReady()) return 0;
  const st = giftStreak(), n = giftAmount(st);
  META.gift = { date: localDate(), streak: st }; META.embers += n; META.earned += n;
  const notes = keeperGain(5); saveMeta();
  sfx('emberGain', CAM.x, CAM.z, 1, 1); sfx('unlock', CAM.x, CAM.z, 1, .5);
  if (notes.length) UI.banner(notes[0], 3, true);
  achKeeper();
  return n;
}

// ---- The weekly challenge ----
// ISO week (Monday first; the week of the year's first Thursday is week 1), as 'YYYY-Www'.
function isoWeek(d) {
  d = d || new Date(); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)), w = Math.ceil(((t - y0) / 864e5 + 1) / 7);
  return t.getUTCFullYear() + '-W' + String(w).padStart(2, '0');
}
// mods: mutators added to every land of the challenge (64-endless.js); kinds: the towers allowed (else all);
// sacks: treasure carriers in every ordinary wave (69-economy.js).
const WEEK_RULES = {
  archers: { name: 'Vibukütide nädal', tip: 'Ehitada saab ainult vibutorne ja kullakaevandusi.', icon: 'archer', kinds: ['archer', 'mine'] },
  goblins: { name: 'Kullagoblinite nädal', tip: 'Igas laines jookseb kullakott, vahel kaks. Püüa nad kinni!', icon: 'coin', sacks: 1 },
  eclipse: { name: 'Igavene varjutus', tip: 'Maa on pime: tornid näevad vähem ja nende tuled kahanevad.', icon: 'moon', mods: ['eclipse'] },
  swarm: { name: 'Parvede nädal', tip: 'Koletisi on kolmandiku võrra rohkem, aga nad maksavad rohkem kulda.', icon: 'swarm', mods: ['swarm', 'gilded'] },
  haste: { name: 'Kiire nädal', tip: 'Koletised jooksevad kiiremini, aga saavad rohkem kahju.', icon: 'boot', mods: ['haste', 'kindled'] },
};
const WEEK_KEYS = Object.keys(WEEK_RULES), WEEK_EMBERS = 50, WEEK_XP = 40;
function weekNow() {
  const id = isoWeek(), seed = dailySeed(id), rule = WEEK_KEYS[seed % WEEK_KEYS.length];
  // The land: one of the first act's six from the week's seed, if this keeper has opened it; else the first.
  const want = Math.floor(seed / 7) % ACT_LANDS, land = landOpen(want) ? want : 0;
  return { id, rule, R: WEEK_RULES[rule], land, done: META.week.done === id };
}
const weekRule = () => (G.weekly && WEEK_RULES[G.weekly]) || null;
// Tower kinds the run allows (the build menu, buildTower and the commander all ask).
const kindAllowed = k => { const R = weekRule(); return !R || !R.kinds || R.kinds.indexOf(k) >= 0; };
const buildKinds = () => BUILD_KINDS.filter(kindAllowed);
// The challenge's own mutators on top of the land's (only those the build knows).
function weekMods(keys) { const R = weekRule(); if (!R || !R.mods || typeof MUTATORS !== 'object') return keys; for (const k of R.mods) if (MUTATORS[k] && keys.indexOf(k) < 0) keys.push(k); return keys; }
// The challenge's land cleared: the reward once a week, then the run ends on the results (MENU.victory, act 'week').
function weekClear() {
  const W = weekNow(), first = META.week.done !== W.id;
  if (first) {
    META.week.done = W.id; META.embers += WEEK_EMBERS; META.earned += WEEK_EMBERS;
    metaUnlock('Nädala auhind: +' + WEEK_EMBERS + ' sütt');
    for (const n of keeperGain(WEEK_XP)) metaUnlock(n);
    achUnlock('weekly');
  }
  G.holdClear = true; MENU.victory = { stage: 'pending', act: 'week' };
}
window.__cwKeeper = { keeperLevel, keeperXpFor, keeperGain, KEEPER_PERKS, BANNERS, claimGift, giftReady, giftStreak, giftAmount, localDate, isoWeek, weekNow, WEEK_RULES, start: (mode, heat, o) => { MENU.close(); startRun(mode, heat, o); } };
