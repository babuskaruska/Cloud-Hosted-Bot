// Saarepagar economy and pacing sim: a bot plays the café board (and some Seiklus levels) on a fake clock, with a time
// cost for every action, and reports how fast energy, coins, stars, tasks, XP level, the season pass and the weekly
// event move. Two runs:
//   "first 2 h": one new player, 120 minutes in four 30-minute sessions with 20-minute breaks
//   "days":     a normal player, 25 minutes a day in two sessions (morning and evening), for 30 days
// Walls are reported: minutes spent with no energy and nothing to merge (waiting), and the longest gap between tasks.
//   node tools/mergeecon.js [days=30] [minPerDay=25]
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.dirname(__dirname), DAYS = +process.argv[2] || 30, PER_DAY = +process.argv[3] || 25;

const SIM = (DAYS, PER_DAY) => {
  const M = window.__mg, A = M.act, G = M.Game, S0 = () => M.S;
  const T = { t: window.__fakeT };
  const adv = ms => { T.t += ms; window.__fakeT = T.t; };
  // Seconds a casual player takes: a generator tap 1.5 s, a merge drag 2.2 s, an order 3 s, a task with its story 15 s, a Seiklus level 2.5 min.
  const COST = { tap: 1500, merge: 2200, order: 3000, task: 15000, collect: 1300, chest: 1800, sell: 2000, claim: 2500, level: 150000 };
  const src = {}, esrc = {}; let cat = '';
  const log = { cnt: {}, src, esrc, wait: 0, gaps: [], lastTask: 0, rows: [], tasks: 0, levels: 0, wins: 0, boughtEn: 0, enCapHits: 0, maxEn: 0, maxCoins: 0 };
  const close = () => { let n = 0; while (M.UI.modal && n++ < 50) { A.skipDialog(); M.UI.closeModal(true); } };
  const S = () => M.S;
  function mergeOne() {
    const b = S().board, need = G.orderNeeds(), needN = {}, have = {};
    for (const o of S().orders) for (const [k, l] of o.items) needN[k + ':' + l] = (needN[k + ':' + l] || 0) + 1;
    for (const it of b) if (it && !it.b) have[it.k + ':' + it.l] = (have[it.k + ':' + it.l] || 0) + 1;
    let best = null, bs = -1e9; const seen = {};
    for (let i = 0; i < b.length; i++) {
      const it = b[i]; if (!it || it.b || !G.isOpen(i)) continue;
      const key = it.k + ':' + it.l;
      if (seen[key] !== undefined && G.canMerge(b[seen[key]], it)) {
        // keep items an order wants; prefer merging toward an order, generators, low levels
        const wantL = Math.max(0, ...[...need].filter(x => x.startsWith(it.k + ':')).map(x => +x.split(':')[1]));
        const sc = (M.CHAINS[it.k].kind === 'item' && !M.CHAINS[it.k].ev && it.l + 1 > wantL && freeN() > 10 ? -100 : 0) + (need.has(it.k + ':' + (it.l + 1)) ? 50 : 0) - ((needN[key] || 0) > (have[key] || 0) - 2 ? 40 : 0) + (M.CHAINS[it.k].kind === 'gen' ? 30 : 0) - it.l;
        if (sc > bs) { bs = sc; best = [seen[key], i]; }
      } else if (seen[key] === undefined) seen[key] = i;
    }
    if (best && bs > -30) { cat = 'merge'; A.drop(best[0], best[1]); adv(COST.merge); return true; }
    return false;
  }
  function freeCell() { return G.nearestEmpty(-1) >= 0; }
  // Sell what no order is near: items of chains no order wants first, the highest level first (a tidy player).
  function sellJunk() {
    const b = S().board, need = G.orderNeeds(), chainsWanted = new Set([...need].map(x => x.split(':')[0])); let pick = -1, hi = -1e9;
    for (let i = 0; i < b.length; i++) {
      const it = b[i]; if (!it || it.b || M.CHAINS[it.k].kind !== 'item' || need.has(it.k + ':' + it.l)) continue;
      const cnt = b.filter(x => x && x.k === it.k && x.l === it.l).length;
      const v = (chainsWanted.has(it.k) ? -40 : 0) + it.l + (cnt > 1 ? -30 : 0) + (it.l >= G.maxL(it.k) ? 20 : 0);
      if (v > hi) { hi = v; pick = i; }
    }
    if (pick >= 0) { cat = 'sell'; A.sell(pick); adv(COST.sell); return true; } return false;
  }
  const freeN = () => G.emptyCells(-1).length;
  function claims() {
    const s = S(), c0 = s.coins, e0 = s.en; claims2(); src.claims = (src.claims || 0) + s.coins - c0; esrc.claims = (esrc.claims || 0) + s.en - e0;
  }
  function claims2() {
    const s = S();
    const w = (name, f) => { const c0 = s.coins; f(); src['c:' + name] = (src['c:' + name] || 0) + s.coins - c0; };
    w('gift', () => { if (!s.daily.gift) { A.claimGift(); adv(COST.claim); } });
    w('daily', () => { s.daily.tasks.forEach((t, j) => { if (t.n >= t.goal && !t.claimed) { A.claimDaily(j); adv(COST.claim); } }); if (!s.daily.bonus) A.claimBonus(); });
    if (G.freeEnIn() <= 0) G.claimFreeEnergy();
    w('album', () => { for (const k of Object.keys(M.CHAINS)) for (let l = 1; l <= (s.disc[k] || 0); l++) if (!G.albumHas(k, l) && M.CHAINS[k].kind === 'item' && !M.CHAINS[k].ev) G.claimAlbum(k, l); for (const k of Object.keys(M.CHAINS)) G.claimChain(k); });
    let r;
    w('pass', () => { while ((r = M.extra.PASS.ready())) M.extra.PASS.claim(r); });
    w('week', () => { while ((r = M.extra.WEEK.readyIdx()) >= 0) M.extra.WEEK.claim(r); });
    w('wheel', () => { if (G.wheelSpins()) G.spinWheel(); });
    w('piggy', () => { if (G.piggyReady()) G.openPiggy(); });
  }
  function step() {
    const s = S(); G.tick(); close();
    // orders, then tasks
    for (let oi = 0; oi < s.orders.length; oi++) if (G.orderStatus(s.orders[oi]).ready) { cat = 'order'; A.fulfill(oi); adv(COST.order); close(); return; }
    const t = G.nextTask(); if (t && s.stars >= t.cost) { cat = 'task'; A.doTask(t.id); adv(COST.task); close(); log.tasks++; const now = T.t; if (log.lastTask) log.gaps.push((now - log.lastTask) / 60000); log.lastTask = now; return; }
    if (mergeOne()) { close(); return; }
    // a player with coins to spare buys coffee before the tank is empty
    if (s.en < 15 && s.coins >= 400) { cat = 'shop'; if (A.buy('en25')) { log.boughtEn++; adv(COST.claim); return; } }
    // tap things: chests, mystery boxes, coins, event tops; coffee only when energy is low
    for (let i = 0; i < s.board.length; i++) {
      const it = s.board[i]; if (!it || it.b) continue; const k = M.CHAINS[it.k].kind;
      if ((k === 'coin') || (k === 'energy' && s.en < 30) || ((k === 'chest' || k === 'mystery') && G.emptyCells(i).length >= 5) || (M.CHAINS[it.k].ev && it.l >= G.maxL(it.k))) { cat = 'tap:' + k; if (A.tap(i)) { adv(COST.collect); close(); return; } }
    }
    if (freeN() < 6 && sellJunk()) return;
    if (s.en >= 1 && freeCell()) {
      const gens = []; s.board.forEach((it, i) => { if (it && M.CHAINS[it.k].kind === 'gen' && !it.b) { G.refreshGen(it); if (it.ch > 0) gens.push(i); } });
      if (gens.length) { cat = 'gen'; const need = G.orderNeeds(); gens.sort((a, b) => { const sa = M.GENERATORS[s.board[a].k].spawn.some(x => [...need].some(n => n.startsWith(x[0] + ':'))) ? 1 : 0, sb = M.GENERATORS[s.board[b].k].spawn.some(x => [...need].some(n => n.startsWith(x[0] + ':'))) ? 1 : 0; return sb - sa; }); A.tapGen(gens[0]); adv(COST.tap); close(); return; }
    }
    // out of energy: a coffee item, or the shop if rich, else wait
    for (let i = 0; i < s.board.length; i++) { const it = s.board[i]; if (it && !it.b && M.CHAINS[it.k].kind === 'energy') { if (A.tap(i)) { adv(COST.collect); return; } } }
    if (s.en < 1 && s.coins >= 120) { cat = 'shop'; if (A.buy('en25')) { log.boughtEn++; adv(COST.claim); return; } }
    if (!freeCell()) { if (sellJunk()) return; }
    log.wait += 20000; adv(20000);
  }
  function level() {
    const L = M.levels, s = S(); L.LV.tickHearts(); if (s.adv.hearts <= 0) return false;
    const r = L.LV.start(s.adv.top); if (!r) return false;
    const R = (() => { let x = (T.t ^ 0x9e3779b9) >>> 0; return () => { x = x + 0x6D2B79F5 | 0; let t = Math.imul(x ^ x >>> 15, 1 | x); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
    L.LV.play(r, 'sampler', R); log.levels++;
    if (r.won) { L.LV.win(); log.wins++; } else L.LV.lose();
    L.LV.cur = null; adv(COST.level); return true;
  }
  function session(min, lvShare) {
    const end = T.t + min * 60000, lvEnd = T.t + min * 60000 * lvShare;
    claims();
    const lc = S().coins; while (T.t < lvEnd && S().adv.top <= 400) { if (!level()) break; } src.levels = (src.levels || 0) + S().coins - lc;
    let n = 0;
    while (T.t < end && n++ < 20000) { const c0 = S().coins, e0 = S().en, t0 = T.t; cat = 'other'; step(); if (T.t === t0) { log.cnt['stuck:' + cat] = (log.cnt['stuck:' + cat] || 0) + 1; adv(1000); } src[cat] = (src[cat] || 0) + S().coins - c0; log.cnt[cat] = (log.cnt[cat] || 0) + 1; if (S().en > e0) esrc[cat] = (esrc[cat] || 0) + S().en - e0; log.maxEn = Math.max(log.maxEn, S().en); log.maxCoins = Math.max(log.maxCoins, S().coins); if (n % 40 === 0) claims(); }
    claims();
  }
  function row(label) {
    const s = S();
    log.rows.push({ at: label, lvl: s.lvl, area: s.ended ? 'tour ' + s.tour : M.AREAS[Math.min(s.area, 5)].key, tasks: Object.keys(s.done).length, orders: s.ordersDone, coins: s.coins, stars: s.stars, en: s.en, pass: M.extra.PASS.reached(), passPts: s.pass.pts, week: s.week.cur, advTop: s.adv.top, waitMin: Math.round(log.wait / 60000), shopEn: log.boughtEn, maxEn: log.maxEn });
  }
  return { session, row, log, adv, T, S, claims };
};

(async () => {
  const b = await chromium.launch({ args: require('./chrome.js').gl });
  const out = {};
  for (const mode of ['first', 'days']) {
    const ctx = await b.newContext({ viewport: { width: 400, height: 860 } }), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    // Monday 3 Nov 2026 09:00 local: the first week starts fresh.
    await p.addInitScript(() => { window.__fakeT = new Date(2026, 10, 2, 9, 0, 0).getTime(); const D = Date; Date.now = () => window.__fakeT; });
    await p.goto('file://' + ROOT + '/merge/index.html?fresh=1&nosave=1&seed=7');
    await p.waitForFunction(() => window.__mg, null, { timeout: 30000 });
    const res = await p.evaluate(([mode, DAYS, PER_DAY, src]) => {
      const sim = eval('(' + src + ')')(DAYS, PER_DAY);
      const M = window.__mg; M.act.start(); M.act.skipDialog(); M.UI.closeModal(true);
      if (mode === 'first') {
        for (let k = 0; k < 4; k++) { sim.session(30, k === 0 ? 0 : 0.2); sim.row((k + 1) * 30 + ' min'); sim.adv(20 * 60000); }
      } else {
        for (let d = 1; d <= DAYS; d++) {
          // morning and evening; the day starts at 08:00 local
          const day0 = new Date(2026, 10, 2 + d - 1, 8, 0, 0).getTime(); if (sim.T.t < day0) sim.adv(day0 - sim.T.t);
          sim.session(PER_DAY / 2, 0.3); sim.adv(10 * 3600000); sim.session(PER_DAY / 2, 0.3);
          if ([1, 2, 3, 5, 7, 10, 14, 20, 25, 30].includes(d)) sim.row('day ' + d);
        }
      }
      const s = M.S; window.__dbg = { orders: s.orders.map(o => o.who + ':' + o.items.map(x => x.join('/')).join('+')), board: s.board.map(x => x ? x.k + x.l + (x.b ? 'b' : '') : '.').join(' '), bag: s.bag.map(x => x.k + x.l).join(' '), next: (M.Game.nextTask() || {}).name, unl: s.unl, avail: M.Game.availChains().join(',') };
      const g = sim.log.gaps.slice().sort((a, b) => a - b);
      return { cnt: sim.log.cnt, src: sim.log.src, esrc: sim.log.esrc, rows: sim.log.rows, tasks: sim.log.tasks, levels: sim.log.levels, wins: sim.log.wins, gapMedian: g.length ? +g[g.length >> 1].toFixed(1) : null, gapMax: g.length ? +g[g.length - 1].toFixed(1) : null };
    }, [mode, DAYS, PER_DAY, SIM.toString()]);
    out[mode] = res;
    console.log('== ' + (mode === 'first' ? 'first 2 hours (4 × 30 min)' : DAYS + ' days × ' + PER_DAY + ' min'));
    console.table(res.rows);
    console.log('actions', JSON.stringify(res.cnt)); console.log('coins by source', JSON.stringify(res.src)); console.log('energy gained by source', JSON.stringify(res.esrc));
    console.log('tasks', res.tasks, 'levels', res.levels, 'won', res.wins, 'minutes between tasks: median', res.gapMedian, 'max', res.gapMax);
    if (process.env.DBG) console.log(await p.evaluate(() => window.__dbg));
    if (errs.length) console.log('ERRORS', errs);
    await ctx.close();
  }
  await b.close();
})();
