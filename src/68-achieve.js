// Achievements: feats a keeper earns once, kept in META.ach[id] (saved with the rest of the meta in 66-meta.js).
// achUnlock(id) is idempotent: the first time it shows a toast and plays sfx('achievement'). Only real runs earn them
// (never the AI demo behind the menu or a test session's run), except the Keeper's Tree ones, which are bought.
// The Codex lists them in its Achievements tab; the results screen names the ones earned in the run.
//
// Hooks: achLandStart() / achLandClear() from metaLandStart / metaLandClear, achTree() after a purchase,
// achBanked(res) from bankRun, achTick(dt) from MENU.update (polls the rest twice a second), achToastTick(dt) and achDraw() for the toast.
const ACH = [
  { id: 'light', name: 'Esimene valgus', tip: 'Kaitse oma esimene maa.', icon: 'flame' },
  { id: 'six', name: 'Kuus tuld', tip: 'Läbi kogu seiklus.', icon: 'lantern' },
  { id: 'flawless', name: 'Puutumatu', tip: 'Kaitse maa nii, et ükski koletis läbi ei pääse.', icon: 'shield' },
  { id: 'lastember', name: 'Viimane süsi', tip: 'Kaitse maa, kui sul on alles 3 elu või vähem.', icon: 'ember' },
  { id: 'horde', name: 'Tulemüür', tip: 'Võida hordilaine nii, et keegi läbi ei pääse.', icon: 'swarm' },
  { id: 'giants', name: 'Hiiutapja', tip: 'Võida 10 pealikku.', icon: 'crown' },
  { id: 'slay1k', name: 'Hauakaevaja', tip: 'Võida 1000 koletist.', icon: 'skull' },
  { id: 'slay10k', name: 'Luuaed', tip: 'Võida 10 000 koletist.', icon: 'skull' },
  { id: 'elites', name: 'Eliidikütt', tip: 'Võida 100 eliitkoletist.', icon: 'star' },
  { id: 'night3', name: 'Pimedusse', tip: 'Jõua Pika Öö kolmandale maale.', icon: 'moon' },
  { id: 'night10', name: 'Latern sügavuses', tip: 'Jõua Pika Öö kümnendale maale.', icon: 'moon' },
  { id: 'heat3', name: 'Süütepuud', tip: 'Kaitse maa Kuumusel 3 või kõrgemal.', icon: 'heat' },
  { id: 'heat5', name: 'Metsatulekahju', tip: 'Kaitse maa Kuumusel 5 või kõrgemal.', icon: 'heat' },
  { id: 'heat10', name: 'Lõputu öö', tip: 'Kaitse maa Kuumusel 10.', icon: 'heat' },
  { id: 'cursed', name: 'Kõigutamatu', tip: 'Kaitse maa, millel on 3 või rohkem needust.', icon: 'fog' },
  { id: 'oc', name: 'Valgeks kuumutatud', tip: 'Lae torn täiesti üle.', icon: 'upgrade' },
  { id: 'branches', name: 'Meisterehitaja', tip: 'Hoia ühel maal püsti 4 haruga torni.', icon: 'guard' },
  { id: 'spells', name: 'Tormikutsuja', tip: 'Kasuta ühel maal 12 loitsu.', icon: 'meteor' },
  { id: 'hoard', name: 'Draakoni aare', tip: 'Kogu korraga 3000 kulda.', icon: 'coin' },
  { id: 'codex', name: 'Loodusuurija', tip: 'Kohta 20 eri koletist.', icon: 'banner' },
  { id: 'daily', name: 'Koidik', tip: 'Lõpeta üks päeva väljakutse.', icon: 'hourglass' },
  { id: 'tree10', name: 'Juurdunud', tip: 'Õpi Hoidja puus 10 taset.', icon: 'ember' },
  { id: 'treemax', name: 'Täiskasvanud', tip: 'Õpi Hoidja puus kõik oskused lõpuni.', icon: 'star' },
  // Round 13: stars, Act II, difficulty and gold.
  { id: 'star3', name: 'Kolm tähte', tip: 'Saa ühel maal kolm tähte.', icon: 'star' },
  { id: 'stars18', name: 'Tähistaevas', tip: 'Saa esimese vaatuse kõigil maadel kolm tähte.', icon: 'star' },
  { id: 'act2', name: 'Öö algab', tip: 'Jõua teise vaatusse.', icon: 'moon' },
  { id: 'act2win', name: 'Koit', tip: 'Läbi teine vaatus.', icon: 'lantern' },
  { id: 'stars36', name: 'Kõik tähed', tip: 'Saa mõlema vaatuse kõigil maadel kolm tähte.', icon: 'crown' },
  { id: 'brave', name: 'Vapper', tip: 'Kaitse maa raskusel Raske või Õudne.', icon: 'shield' },
  { id: 'dread', name: 'Õudusteta', tip: 'Kaitse maa raskusel Õudne.', icon: 'skull' },
  { id: 'combo50', name: 'Kuldne kombo', tip: 'Saa kombo 50.', icon: 'coin' },
  { id: 'sacks', name: 'Kotipüüdja', tip: 'Püüa kinni 10 kullakotti.', icon: 'coin' },
  { id: 'miner', name: 'Kullakaevur', tip: 'Teeni kaevandustega ühel maal 400 kulda.', icon: 'coin' },
];
const ACH_BY = {}; for (const a of ACH) ACH_BY[a.id] = a;
const ACHQ = []; // toasts waiting: { a, t }
const achCount = () => ACH.filter(a => META.ach[a.id]).length;

function achUnlock(id, any) {
  const a = ACH_BY[id]; if (!a || META.ach[id] || !(any || inRun())) return false;
  META.ach[id] = 1; if (META.run && META.run.ach) META.run.ach.push(id); saveMeta();
  ACHQ.push({ a, t: 0 }); sfx('achievement', CAM.x, CAM.z, 1);
  return true;
}

const ACHL = { spells0: 0, t: 0 }; // the current land's starting counts
function achLandStart() { ACHL.spells0 = (G.stats && G.stats.spells) || 0; }
function achLandClear() {
  if (!inRun()) return;
  achUnlock('light');
  if (META.run && META.run.mode === 'campaign' && G.level === CAMPAIGN_LANDS - 1) achUnlock('six');
  if (!G.leaks) achUnlock('flawless');
  if (G.lives <= 3) achUnlock('lastember');
  if (G.heat >= 3) achUnlock('heat3'); if (G.heat >= 5) achUnlock('heat5'); if (G.heat >= 10) achUnlock('heat10');
  if (Array.isArray(G.mods) && typeof MUTATORS === 'object' && G.mods.filter(k => MUTATORS[k] && MUTATORS[k].curse).length >= 3) achUnlock('cursed');
  if (META.stats.bosses >= 10) achUnlock('giants');
  if (G.diff === 'raske' || G.diff === 'oudne') achUnlock('brave'); if (G.diff === 'oudne') achUnlock('dread');
  if (typeof ECON === 'object' && ECON.mined >= 400) achUnlock('miner');
  if (G.mode === 'campaign' && G.level === CAMPAIGN_LANDS * 2 - 1) achUnlock('act2win');
}
// After a campaign land's stars are set (metaLandClear).
function achStars() {
  let a1 = true, a2 = true;
  for (let i = 0; i < ACT_LANDS; i++) { if (landStars(i) < 3) a1 = false; if (landStars(i + CAMPAIGN_LANDS) < 3) a2 = false; }
  if (Object.keys(META.stars).some(k => META.stars[k] >= 3)) achUnlock('star3');
  if (a1) achUnlock('stars18'); if (a1 && a2) achUnlock('stars36');
}
function achTree() {
  let n = 0, all = true; for (const u of UPGRADES) { const l = META.up[u.key] || 0; n += l; if (l < u.max) all = false; }
  if (n >= 10) achUnlock('tree10', true); if (all) achUnlock('treemax', true);
}
function achBanked(res) { if (res && res.mode === 'daily') achUnlock('daily'); }
function achTick(dt) {
  if (!inRun() || G.phase !== 'play') return;
  ACHL.t -= dt; if (ACHL.t > 0) return; ACHL.t = .5;
  const S = META.stats, runSlain = G.runStats ? G.slain - G.runStats.slain0 : 0;
  if (S.slain + runSlain >= 1000) achUnlock('slay1k'); if (S.slain + runSlain >= 10000) achUnlock('slay10k');
  if (S.elites >= 100) achUnlock('elites');
  if (act2Land()) achUnlock('act2');
  if (nightMode(G.mode)) { const d = nightDepth(); if (d >= 3) achUnlock('night3'); if (d >= 10) achUnlock('night10'); }
  let br = 0; for (const t of G.towers) { if (!t.alive) continue; if (t.branch) br++; if ((t.oc || 0) >= OC_MAX) achUnlock('oc'); }
  if (br >= 4) achUnlock('branches');
  if (((G.stats && G.stats.spells) || 0) - ACHL.spells0 >= 12) achUnlock('spells');
  if (G.gold >= 3000) achUnlock('hoard');
  let seen = 0; for (const k in META.seen) if (META.seen[k]) seen++; if (seen >= 20) achUnlock('codex');
}

// The toast: a small plate sliding down under the top of the screen, one feat at a time.
const ACH_TOAST = 3.6;
function achToastTick(dt) { const q = ACHQ[0]; if (q) { q.t += dt; if (q.t > ACH_TOAST) ACHQ.shift(); } }
function achDraw(ctx, E) {
  const q = ACHQ[0]; if (!q) return; const D = ACH_TOAST;
  const c = UI.COLR, s = E.s, ps = Math.max(2, s - (E.tch ? 1 : 0)), p = 4 * ps, L = PX.LINE * ps, a = q.a;
  const head = 'Saavutus', ic = PX.iconSize(a.icon)[0] ? a.icon : 'star', [iw, ih] = PX.iconSize(ic), ik = ps * 2;
  const tw = Math.max(PX.measure(head) * ps, PX.measure(a.name) * ps), w = Math.min(E.Wr - E.iL - 8 * s, iw * ik + 3 * p + tw), h = Math.max(ih * ik, 2 * L) + 2 * p;
  const k = Math.min(sat(q.t * 4), sat((D - q.t) * 3)), e = 1 - (1 - k) * (1 - k);
  const x = Math.round((E.iL + E.Wr) / 2 - w / 2), y = Math.round(E.iT + 4 * s + (UI.scr ? 0 : 32 * s) - (1 - e) * (h + 10 * s));
  ctx.globalAlpha = e;
  ctx.save(); ctx.shadowColor = 'rgba(255,170,80,0.55)'; ctx.shadowBlur = 10 * s * (.6 + .4 * Math.sin(q.t * 5)); UI.plate(x, y, w, h, { bd: c.bdHi, bg: 'rgba(30,22,12,0.96)' }); ctx.restore();
  PX.icon(ctx, ic, x + p, y + Math.round((h - ih * ik) / 2), ik, 1);
  const tx0 = x + 2 * p + iw * ik, ty = y + Math.round((h - 2 * L) / 2) + ps;
  PX.text(ctx, head, tx0, ty, ps, c.dim); PX.text(ctx, a.name, tx0, ty + L, ps, c.amber);
  ctx.globalAlpha = 1;
}
