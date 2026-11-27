// The Long Night: land mutators and boss affixes that pile up with depth (and Heat).
// G.mods = keys active on the current land. modMul(stat) is the product of every active mutator's multiplier
// for that stat; game code reads it at a few hook points (wave budget, elite chance, tower range, monster speed,
// damage monsters take, bounty). Campaign lands (level < 6) roll none unless Heat asks for some (G.heatMods).
const MUTATORS = {
  bloodmoon: { name: 'Verikuu', tip: 'Eliitkoletisi tuleb kaks korda sagedamini.', icon: 'moon', curse: 1, m: { elite: 2.2 } },
  swarm: { name: 'Parv', tip: 'Igas laines on kolmandiku võrra rohkem koletisi.', icon: 'swarm', curse: 1, m: { budget: 1.35 } },
  ironhide: { name: 'Raudnahk', tip: 'Koletised saavad viiendiku võrra vähem kahju.', icon: 'shield', curse: 1, m: { dmgIn: .8 } },
  fog: { name: 'Õõnesudu', tip: 'Tornid ei näe nii kaugele.', icon: 'fog', curse: 1, m: { range: .86 } },
  haste: { name: 'Kiirus', tip: 'Koletised liiguvad kiiremini.', icon: 'boot', curse: 1, m: { spd: 1.15 } },
  volatile: { name: 'Plahvatus', tip: 'Mõned koletised lõhkevad surres ja teevad lähedal olijatele haiget.', icon: 'bomb', curse: 1, m: {} },
  famine: { name: 'Nälg', tip: 'Koletistelt saab vähem kulda.', icon: 'coin', curse: 1, m: { bounty: .72 } },
  plague: { name: 'Katk', tip: 'Koletised paranevad, kui keegi neid ei löö.', icon: 'skull', curse: 1, m: {} },
  titan: { name: 'Titaan', tip: 'Pealik on suurem, tugevam ja tal on üks lisavõime.', icon: 'crown', curse: 1, m: {} },
  eclipse: { name: 'Varjutus', tip: 'Maa läheb pimedaks: tornid ei näe nii kaugele ja nende tuled kahanevad.', icon: 'moon', curse: 1, m: { range: .92 } },
  siege: { name: 'Piiramine', tip: 'Igas laines on müürilõhkujaid.', icon: 'shield', curse: 1, m: {} },
  echoes: { name: 'Kajad', tip: 'Langenud eliitkoletis tõuseb veel korra kummitusena.', icon: 'skull', curse: 1, m: {} },
  gilded: { name: 'Kuldne', tip: 'Õnnistus: koletistelt saab rohkem kulda.', icon: 'coin', boon: 1, m: { bounty: 1.3 } },
  kindled: { name: 'Süüdatud', tip: 'Õnnistus: koletised saavad rohkem kahju.', icon: 'flame', boon: 1, m: { dmgIn: 1.15 } },
};
const BOSS_AFFIX = {
  warded: { name: 'Kaitstud', tip: 'Kaitsekilp neelab kahju ja tuleb iga 20 s tagasi.' },
  swift: { name: 'Väle', tip: 'Liigub kiiremini.' },
  regen: { name: 'Surematu', tip: 'Paraneb, kui keegi teda ei löö.' },
};
G.mods = []; G.modM = {}; G.modLevel = -1; G.heatMods = G.heatMods || 0;
function modOn(k) { return G.mods.indexOf(k) >= 0; }
function modMul(stat) { const v = G.modM[stat]; return v === undefined ? 1 : v; }
function modCount(level) { level = typeof nightLv === 'function' ? nightLv(level) : level; const deep = level < 6 ? 0 : Math.min(5, 1 + Math.floor((level - 6) / 3)); return deep + (G.heatMods | 0); }
function setMods(keys) {
  G.mods = keys.slice(); G.modM = {};
  G.eclipse = G.mods.indexOf('eclipse') >= 0;
  for (const k of G.mods) { const M = MUTATORS[k]; if (!M) continue; for (const s in M.m) G.modM[s] = (G.modM[s] === undefined ? 1 : G.modM[s]) * M.m[s]; }
}
// Rolls this land's mutators from the gameplay random stream (deterministic per run). Returns the keys.
function rollMods(level) {
  const n = modCount(level), curses = Object.keys(MUTATORS).filter(k => MUTATORS[k].curse), boons = Object.keys(MUTATORS).filter(k => MUTATORS[k].boon), out = [];
  for (let i = 0; i < n && curses.length; i++) { const j = Math.floor(rnd() * curses.length); out.push(curses[j]); curses.splice(j, 1); }
  if (n > 0 && level >= 6 && rnd() < .35) out.push(boons[Math.floor(rnd() * boons.length)]);
  setMods(out);
  return out;
}
// Heat 7 (Crowned Dread, 66-meta.js) gives every boss one more affix, campaign lands included (G.heatAffix).
function bossAffixes(level) { level = typeof nightLv === 'function' ? nightLv(level) : level; return (level < 6 ? 0 : Math.min(3, 1 + Math.floor((level - 6) / 6))) + (modOn('titan') ? 1 : 0) + (G.heatAffix | 0); }

function updateEndless(dt) {
  if (G.phase !== 'play') { if (G.echoQ) G.echoQ.length = 0; return; }
  updateEchoes(dt);
  if (G.modLevel !== G.level) {
    G.modLevel = G.level;
    const keys = rollMods(G.level);
    if (keys.length) { G.bountyMul *= modMul('bounty'); if (UI.banner && !UI.mutCard) UI.banner(keys.map(k => MUTATORS[k].name).join(' · '), 3.2, false); }
  }
  if (G.spawning && G.siegeK !== G.k) { G.siegeK = G.k; if (modOn('siege')) addSiege(); }
  if (!G.spawning) G.siegeK = -1;
  const plague = modOn('plague');
  for (const m of G.mons) {
    if (m.dead || m.hp <= 0) continue;
    if (m.def.boss && !m.affixed && (G.level >= 6 || G.heatAffix)) bossEmpower(m);
    if (m.affix) {
      if (m.affix.regen && G.t - m.hitAt > 2) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * .012 * dt);
      if (m.affix.warded) { m.wardT = (m.wardT || 0) - dt; if (m.wardT <= 0 && !(m.ward > 0)) { m.wardT = 20; m.ward = m.wardMax = m.maxHp * .22; } }
    }
    if (plague && !m.def.boss && G.t - m.hitAt > 2.5 && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * .03 * dt);
  }
}
function bossEmpower(m) {
  m.affixed = true; const n = bossAffixes(G.level); if (!n) return;
  if (modOn('titan')) { m.hp *= 1.5; m.maxHp *= 1.5; m.scale *= 1.15; }
  const keys = Object.keys(BOSS_AFFIX), pick = [];
  for (let i = 0; i < n && keys.length; i++) { const j = Math.floor(rnd() * keys.length); pick.push(keys[j]); keys.splice(j, 1); }
  m.affix = {}; for (const k of pick) m.affix[k] = 1;
  if (m.affix.swift) m.spdMul = (m.spdMul || 1) * 1.25;
  if (m.affix.warded) { m.wardT = 20; m.ward = m.wardMax = m.maxHp * .22; }
  m.affixName = pick.map((k, i) => i ? BOSS_AFFIX[k].name.toLowerCase() : BOSS_AFFIX[k].name).join(' ') + ' ' + m.def.name.charAt(0).toLowerCase() + m.def.name.slice(1); // 'Surematu uppunud kuningas'
  if (UI.banner && typeof UI.bossCard !== 'function') UI.banner(m.affixName, 3, true); // the boss card already shows the affixed name
}
// Called from killMonster: Volatile bursts (they reuse the sapper chain, so they can set each other off).
function modOnKill(m) {
  if (m.elite && modOn('echoes')) echoRise(m);
  if (!modOn('volatile') || m.def.boss || m.small || rnd() >= .22) return;
  G.chain.push({ t: rr(.25, .45), x: m.x, y: m.y, z: m.z, ex: { r: 1.3, dmg: 22 * (1 + .25 * G.level), men: 18 * (1 + .2 * G.level) } });
}
// Siege: 1-3 rams spread through the wave's queue, as tough as the wave around them.
function addSiege() {
  const q = G.queue; if (!q.length) return;
  const n = 1 + Math.min(2, Math.floor(Math.max(0, G.level - 3) / 4)), end = q[q.length - 1].t;
  let hp = 0; for (const e of q) hp += e.hpMul || 1; hp /= q.length;
  for (let i = 0; i < n; i++) {
    const t = end * (i + .5) / n, e = { t, type: 'ram', hpMul: hp, bm: .8 };
    let j = 0; while (j < q.length && q[j].t <= t) j++;
    q.splice(j, 0, e);
  }
}
// Echoes: a slain ground elite rises once as a pale ghost where it fell (no elite power, half bounty).
function echoRise(m) {
  // (Mira, round 10 sims: at 0.6 of its health and with no crowd limit, Echoes alone cost about three times the lives of
  // a land without it at Long Night depth; at 0.45, and none rising into an already packed road, it sits with Eclipse.)
  if (m.fly || m.echo || m.def.boss || G.mons.length >= MAX_ALIVE * .8) return;
  G.echoQ = G.echoQ || [];
  G.echoQ.push({ t: .9, type: m.type, s: m.s, lat: m.lat, hp: m.maxHp * .45 / Math.max(1, m.def.hp) });
}
function updateEchoes(dt) {
  if (!G.echoQ || !G.echoQ.length) return;
  for (let i = G.echoQ.length - 1; i >= 0; i--) {
    const e = G.echoQ[i]; e.t -= dt; if (e.t > 0) continue;
    G.echoQ.splice(i, 1);
    if (G.phase !== 'play' || G.mons.length >= MAX_ALIVE) continue;
    const g = spawnMonster(e.type, { hpMul: e.hp, s: e.s, lat: e.lat });
    g.echo = true; g.bmul = .5; g.tint = [.62, .78, 1]; g.pop = .5;
    G.mix.echo = (G.mix.echo || 0) + 1; G.mix[e.type] = (G.mix[e.type] || 0) + 1; // the commander's tally (aiThink) counts the ghosts too
    if (G.spdMul !== 1) g.spdMul *= G.spdMul;
  }
}
window.__cwEndless = { MUTATORS, BOSS_AFFIX, rollMods, setMods, modOn, modMul };
