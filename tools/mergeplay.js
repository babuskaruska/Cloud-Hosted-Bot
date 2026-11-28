// Saarepagar end-to-end playthrough (phase C): a fresh start on phone profiles, played with REAL taps and drags where
// a person would tap (title, story, tutorial, orders, tasks, tabs, Seiklus, windows) and with the test hook for the long
// grind in between. It fails on page errors, stuck states (no progress for a long time), windows that do not close,
// tap targets under 44 px, and leaving a level without losing a life.
//   node tools/mergeplay.js [android|phone|promax|desktop ...]      (default: android, phone, promax)
// Shots: tools/shots/mergeplay-<profile>-*.png
const { chromium, devices } = require('playwright');
const path = require('path');
const ROOT = path.dirname(__dirname), UA = devices['iPhone 13'].userAgent;
const PROFILES = {
  android: { viewport: { width: 360, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['Pixel 5'].userAgent },
  phone: { ...devices['iPhone 13'] },
  promax: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA },
  desktop: { viewport: { width: 1280, height: 800 } },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(name) {
  const b = await chromium.launch({ args: require('./chrome.js').gl });
  const ctx = await b.newContext(PROFILES[name]), p = await ctx.newPage(), errs = [], notes = [];
  p.on('pageerror', e => errs.push('PAGE: ' + String(e.stack || e).slice(0, 400)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  const touch = name !== 'desktop', cdp = touch ? await ctx.newCDPSession(p) : null;
  let shotN = 0;
  const shot = n => p.screenshot({ path: path.join(__dirname, 'shots', `mergeplay-${name}-${String(++shotN).padStart(2, '0')}-${n}.png`) });
  const down = async (x, y) => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }) : (await p.mouse.move(x, y), await p.mouse.down());
  const move = async (x, y) => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }) : p.mouse.move(x, y);
  const up = async () => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : p.mouse.up();
  const tap = async (x, y) => { await down(x, y); await sleep(90); await up(); await sleep(220); };
  const tapR = r => tap(r.x + r.w / 2, r.y + r.h / 2);
  const drag = async (a, c) => { await down(a[0], a[1]); await sleep(70); for (let i = 1; i <= 8; i++) { await move(a[0] + (c[0] - a[0]) * i / 8, a[1] + (c[1] - a[1]) * i / 8); await sleep(25); } await sleep(60); await up(); await sleep(260); };
  const ev = (f, a) => p.evaluate(f, a);
  const modal = () => ev(() => { const m = window.__mg.UI.modal; return m ? m.kind : null; });
  const fail = s => errs.push(s);
  // every hit area on screen must be at least 44 x 44 CSS px
  const checkTargets = async where => {
    const small = await ev(() => { const U = window.__mg.UI; return (U.modal ? U.mhits : U.hits).filter(h => h.fn && (h.w < 44 || h.h < 44)).map(h => Math.round(h.w) + '×' + Math.round(h.h) + '@' + Math.round(h.x) + ',' + Math.round(h.y)); });
    if (small.length) fail('TAP TARGET under 44 px on ' + where + ': ' + small.slice(0, 6).join(' '));
  };
  // close the open window like a person: its X, else a tap outside, else its lowest button; fail if it stays
  const closeByTap = async kind => {
    for (let k = 0; k < 3 && await modal() === kind; k++) {
      if (k === 0) await sleep(kind === 'levelup' ? 1600 : 350); // let the window finish its entrance
      const r = await ev(k => { const U = window.__mg.UI, m = U.modal, P = m && m.panel; if (!P || k === 2) { const h = U.mhits.filter(h => h.fn).sort((a, b) => b.y - a.y)[0]; return h || null; } if (k === 0) return { x: P.x + P.w - 52, y: P.y + 4, w: 48, h: 48 }; if (k === 1) return { x: 4, y: 4, w: 8, h: 8 }; const h = U.mhits.filter(h => h.fn).sort((a, b) => b.y - a.y)[0]; return h || null; }, k);
      if (!r) break; await tapR(r); await sleep(250);
    }
    if (await modal() === kind) { fail('STUCK: window "' + kind + '" does not close by tapping'); await shot('stuck-' + kind); await ev(() => { const U = window.__mg.UI; while (U.modal) U.closeModal(true); }); }
  };
  // tap through story dialogs (each tap shows the full line, then the next one)
  const readDialogs = async (max = 120) => { let n = 0; while (await modal() === 'dialog' && n++ < max) await tap(200, 300); if (await modal() === 'dialog') fail('STUCK: dialog did not end after ' + max + ' taps'); };

  try {
    await p.goto('file://' + ROOT + '/merge/index.html#fresh=1');
    await p.waitForFunction(() => window.__mg, null, { timeout: 30000 }); await sleep(1200);
    if (await ev(() => location.hash)) fail('HASH: #fresh=1 still in the address bar (a reload would wipe the save)');
    await shot('title'); await checkTargets('title');
    // 1. title -> "Alusta!" -> grandma's letter
    await tapR(await ev(() => window.__mg.UI.mhits[0]));
    await readDialogs(); await sleep(600); await shot('board-start');
    // 2. the tutorial with real taps: oven, merge, "Anna!", Remont, the first task
    for (let k = 0; k < 60 && await ev(() => window.__mg.S.tut) < 5; k++) {
      const st = await ev(() => { const M = window.__mg, S = M.S, U = M.UI; const ready = S.orders.findIndex(o => M.Game.orderStatus(o).ready); const find = (key, l) => S.board.findIndex(c => c && c.k === key && c.l === l && !c.b); return { tut: S.tut, modal: U.modal && U.modal.kind, ready, card: ready >= 0 ? U.cards[ready] : null, oven: find('oven', 1), b1: S.board.map((c, i) => c && c.k === 'bread' && c.l === 1 ? i : -1).filter(i => i >= 0), tasks: U.L.btn.tasks, next: U.modal && U.modal.nextBtn, stars: S.stars }; });
      if (st.modal === 'dialog') { await readDialogs(); continue; }
      if (st.modal === 'tasks' && st.next) { await tapR(st.next); await sleep(500); continue; }
      if (st.modal) { await closeByTap(st.modal); continue; }
      if (st.ready >= 0 && st.card) { await tapR(st.card); await sleep(700); continue; }
      if (st.tut === 4 || (st.stars > 0 && st.tut >= 3)) { await tapR(st.tasks); await sleep(500); continue; }
      if (st.b1.length >= 2) { const a = await ev(i => window.__mg.cell(i), st.b1[0]), c = await ev(i => window.__mg.cell(i), st.b1[1]); await drag([a.x, a.y], [c.x, c.y]); continue; }
      if (st.oven >= 0) { const o = await ev(i => window.__mg.cell(i), st.oven); await tap(o.x, o.y); continue; }
      await sleep(400);
    }
    if (await ev(() => window.__mg.S.tut) < 5) fail('STUCK: tutorial not finished with real taps (tut ' + await ev(() => window.__mg.S.tut) + ')');
    await shot('tutorial-done'); await checkTargets('board');
    // 3. the story: grind with the hook (generators, merges, orders, tasks) until the garden opens; never stuck
    // The long grind: the hook stands in for the merging (it puts each order's items on the board, as a player would
    // have made them; a full board is tidied by selling), but orders are handed over and tasks are done with REAL taps
    // on the order card and on the task list. Stuck = no order or task for many rounds.
    const grind = async (until, label, maxRounds = 160) => {
      let last = -1, still = 0;
      for (let r = 0; r < maxRounds; r++) {
        if (await ev(until)) return true;
        const st = await ev(() => {
          const M = window.__mg, S = M.S, G = M.Game, U = M.UI;
          if (U.modal) return { modal: U.modal.kind, next: U.modal.nextBtn || null };
          G.tick();
          const t = G.nextTask();
          if (t && S.stars >= t.cost) return { task: true, tasks: U.L.btn.tasks };
          const oi = S.orders.findIndex(o => G.orderStatus(o).ready);
          if (oi >= 0) return { card: U.cards[oi] };
          const o = S.orders[0]; if (!o) return { wait: true };
          const st = G.orderStatus(o);
          o.items.forEach(([k, l], j) => {
            if (st.have[j]) return;
            let e = G.nearestEmpty(-1);
            if (e < 0) { const need = G.orderNeeds(); e = S.board.findIndex(c => c && M.CHAINS[c.k].kind === 'item' && !need.has(c.k + ':' + c.l)); if (e >= 0) M.act.sell(e); e = G.nearestEmpty(-1); }
            if (e >= 0) S.board[e] = { k, l };
          });
          return { placed: true };
        });
        if (st.modal === 'dialog') await readDialogs();
        else if (st.modal === 'tasks' && st.next) { await tapR(st.next); await sleep(500); }
        else if (st.modal) await closeByTap(st.modal);
        else if (st.task) { await tapR(st.tasks); await sleep(450); }
        else if (st.card) { await tapR(st.card); await sleep(500); }
        else await sleep(st.wait ? 1100 : 150);
        const s = await ev(() => { const S = window.__mg.S; return { done: Object.keys(S.done).length, orders: S.ordersDone }; });
        const prog = s.done * 1000 + s.orders;
        if (prog === last) { if (++still > 30) { fail('STUCK: no order or task for a long time during ' + label + ' ' + await ev(() => { const S = window.__mg.S; return JSON.stringify({ modal: window.__mg.UI.modal && window.__mg.UI.modal.kind, scr: window.__mg.UI.scr, stars: S.stars, next: (window.__mg.Game.nextTask() || {}).id, orders: S.orders.map(o => o.items.join('+')), free: window.__mg.Game.emptyCells(-1).length }); })); return false; } } else { still = 0; last = prog; }
      }
      fail('STUCK: ' + label + ' not reached in time'); return false;
    };
    await grind(() => window.__mg.S.area >= 1, 'the garden');
    await sleep(500); await shot('garden');
    // 4. every window on the café opens and closes by tapping, with big enough buttons
    const kinds = ['tasks', 'shop', 'bag', 'daily', 'settings', 'energy', 'album', 'xPass', 'xWeek', 'xLook', 'xRest'];
    for (const k of kinds) {
      await ev(k => { const U = window.__mg.UI; while (U.modal) U.closeModal(true); if (k === 'album') U.openAlbum(); else U.openModal({ kind: k }); }, k);
      await sleep(450); await checkTargets(k); await closeByTap(k);
    }
    await ev(() => { const U = window.__mg.UI; while (U.modal) U.closeModal(true); });
    // a chain window from a long press on an item
    const it = await ev(() => { const S = window.__mg.S; const i = S.board.findIndex(c => c && window.__mg.CHAINS[c.k].kind === 'item' && !c.b); return i >= 0 ? window.__mg.cell(i) : null; });
    if (it) { await down(it.x, it.y); await sleep(650); await up(); await sleep(400); if (await modal() !== 'chain') fail('FLOW: long press did not open the chain window'); else { await checkTargets('chain'); await closeByTap('chain'); } }
    // 5. Seiklus by tapping the HUD button, then a level with real drags
    for (let k = 0; k < 6 && await modal(); k++) { if (await modal() === 'dialog') await readDialogs(); else await closeByTap(await modal()); }
    await tapR(await ev(() => window.__mg.UI.L.hud.adv)); await sleep(800);
    if (await ev(() => window.__mg.UI.scr) !== 'map') fail('FLOW: the Seiklus button did not open the map');
    await shot('map'); await checkTargets('map');
    const playLevel = async () => {
      await tapR(await ev(() => window.__mg.UI.hits.slice().sort((a, b) => b.y - a.y)[0])); await sleep(500);
      if (await modal() !== 'advStart') { fail('FLOW: play button did not open the start window'); return null; }
      await checkTargets('advStart');
      await tapR(await ev(() => window.__mg.UI.mhits.slice().sort((a, b) => b.y - a.y)[0])); await sleep(600);
      for (let k = 0; k < 5 && await modal() === 'advTip'; k++) { await tapR(await ev(() => window.__mg.UI.mhits.slice().sort((a, b) => b.y - a.y)[0])); await sleep(350); }
      if (await ev(() => window.__mg.UI.scr) !== 'level') { fail('FLOW: did not enter the level'); return null; }
      await checkTargets('level');
      let n = 0;
      for (; n < 60; n++) {
        const plan = await ev(() => { const L = window.__mg.levels, r = L.state; if (!r || r.over) return null; const c = L.LV.candidates(r); if (!c.length) return null; c.sort((a, b) => b.s - a.s); return { a: L.cell(c[0].a), b: L.cell(c[0].b) }; });
        if (!plan) break; await drag([plan.a.x, plan.a.y], [plan.b.x, plan.b.y]);
      }
      return await ev(() => { const r = window.__mg.levels.state; return r && { won: r.won, over: r.over, used: r.used }; });
    };
    const r1 = await playLevel();
    if (!r1 || !r1.won) fail('FLOW: level 1 not won with real drags ' + JSON.stringify(r1));
    for (let k = 0; k < 30 && await modal() !== 'advWin'; k++) await sleep(250);
    await shot('level-win'); await checkTargets('advWin');
    if (await modal() !== 'advWin') fail('FLOW: no win window');
    else await tapR(await ev(() => window.__mg.UI.mhits.slice().sort((a, b) => (b.y - a.y) || (b.x - a.x))[0]));
    await sleep(900);
    for (let k = 0; k < 4 && await modal(); k++) { if (await modal() === 'advStart') { await closeByTap('advStart'); } else await closeByTap(await modal()); }
    // 6. leaving a level after a move: a kind confirm, and it costs a life; closing the app mid-level costs one too
    const h0 = await ev(() => window.__mg.S.adv.hearts);
    await playLevelStartOnly();
    async function playLevelStartOnly() {
      await tapR(await ev(() => window.__mg.UI.hits.slice().sort((a, b) => b.y - a.y)[0])); await sleep(500);
      await tapR(await ev(() => window.__mg.UI.mhits.slice().sort((a, b) => b.y - a.y)[0])); await sleep(600);
      for (let k = 0; k < 5 && await modal() === 'advTip'; k++) { await tapR(await ev(() => window.__mg.UI.mhits.slice().sort((a, b) => b.y - a.y)[0])); await sleep(350); }
      const plan = await ev(() => { const L = window.__mg.levels, r = L.state; const c = L.LV.candidates(r); c.sort((a, b) => b.s - a.s); return { a: L.cell(c[0].a), b: L.cell(c[0].b) }; });
      await drag([plan.a.x, plan.a.y], [plan.b.x, plan.b.y]);
    }
    const pauseBtn = await ev(() => window.__mg.UI.hits.find(h => h.w === 56 && h.h === 52));
    if (!pauseBtn) fail('FLOW: no pause button on the level');
    else {
      await tapR(pauseBtn); await sleep(400);
      if (await modal() !== 'advPause') fail('FLOW: pause did not open');
      await shot('pause'); await checkTargets('advPause');
      await tapR(await ev(() => window.__mg.UI.mhits.filter(h => h.fn).sort((a, b) => b.y - a.y)[0])); await sleep(400);
      if (await modal() !== 'advLeave') fail('FLOW: leaving after a move did not ask first'); else { await shot('leave-confirm'); await checkTargets('advLeave'); }
      await tapR(await ev(() => window.__mg.UI.mhits.filter(h => h.fn).sort((a, b) => b.y - a.y)[0])); await sleep(500);
      const h1 = await ev(() => window.__mg.S.adv.hearts);
      if (h1 !== h0 - 1) fail('LIVES: leaving after a move should cost one life ' + h0 + ' -> ' + h1);
    }
    await playLevelStartOnly(); await ev(() => window.__mg.act.save());
    const h2 = await ev(() => window.__mg.S.adv.hearts);
    await p.reload(); await p.waitForFunction(() => window.__mg, null, { timeout: 30000 }); await sleep(900);
    const h3 = await ev(() => window.__mg.S.adv.hearts);
    if (h3 !== h2 - 1) fail('LIVES: closing the app mid-level should cost one life ' + h2 + ' -> ' + h3);
    if (await ev(() => window.__mg.S.tut) < 5) fail('SAVE: the reload lost the game (tut back to ' + await ev(() => window.__mg.S.tut) + ')');
    await shot('reloaded');
    // 7. the rest of the story to the island tour (hook), then one island
    await ev(() => window.__mg.UI.start());
    await grind(() => window.__mg.S.area >= 2, 'the harbour');
    await ev(() => { const M = window.__mg; M.extra.endStory(); while (M.UI.modal) M.UI.closeModal(true); M.UI.goScreen('board'); });
    await readDialogs(); await sleep(300);
    await grind(() => window.__mg.S.tour >= 1, 'the first island', 200);
    await ev(() => { const U = window.__mg.UI; while (U.modal) U.closeModal(true); }); await sleep(500);
    await shot('tour'); await checkTargets('tour board');
    // 8. pass, weekly event, wardrobe and photo by tapping the tabs and tiles
    await ev(() => { const S = window.__mg.S; S.lvl = Math.max(S.lvl, 4); S.pass.pts = Math.max(S.pass.pts, window.__mg.extra.PASS.CUM[2]); });
    await tapR(await ev(() => window.__mg.UI.L.btn.pass)); await sleep(500);
    if (await modal() !== 'xPass') fail('FLOW: the Rada tab did not open the pass');
    const tile = await ev(() => window.__mg.UI.mhits.filter(h => h.w < 100 && h.h > 50 && h.h < 100).sort((a, b) => a.y - b.y || a.x - b.x)[0]);
    if (tile) { await tapR(tile); await sleep(400); }
    if (!(await ev(() => window.__mg.S.pass.got[1]))) fail('PASS: step 1 not claimed by a tap');
    await shot('pass'); await closeByTap('xPass');
    await tapR(await ev(() => window.__mg.UI.L.btn.week)); await sleep(500);
    if (await modal() !== 'xWeek') fail('FLOW: the week tab did not open the event'); else { await shot('week'); await closeByTap('xWeek'); }
    await ev(() => { window.__mg.S.done.h6 = true; window.__mg.extra.LOOK.check(true); });
    await tapR(await ev(() => window.__mg.UI.L.hud.look)); await sleep(500);
    if (await modal() !== 'xLook') fail('FLOW: the wardrobe button did not open the wardrobe');
    else {
      const tabs = await ev(() => window.__mg.UI.mhits.filter(h => h.h === 48 && h.w > 60).sort((a, b) => a.x - b.x));
      if (tabs.length >= 4) { await tapR(tabs[3]); await sleep(300); const cards = await ev(() => window.__mg.UI.mhits.filter(h => h.h > 60 && h.w < 140).sort((a, b) => a.y - b.y || a.x - b.x)); if (cards[1]) { await tapR(cards[1]); await sleep(300); } }
      if (await ev(() => window.__mg.S.petOn) !== 'kutsu') fail('LOOK: tapping Kutsu did not pick the puppy');
      await shot('wardrobe');
      await tapR(await ev(() => window.__mg.UI.mhits.filter(h => h.fn).sort((a, b) => b.y - a.y)[0])); await sleep(700);
      if (await modal() !== 'xPhoto') fail('FLOW: "Tee foto" did not open the photo'); else { await shot('photo'); await tap(30, 30); await sleep(400); await tap(30, 30); await sleep(400); if (await modal() === 'xPhoto') fail('STUCK: the photo does not close'); }
    }
    await ev(() => { const U = window.__mg.UI; while (U.modal) U.closeModal(true); }); await sleep(300); await shot('end');
    notes.push(JSON.stringify(await ev(() => { const S = window.__mg.S; return { lvl: S.lvl, area: S.area, tour: S.tour, orders: S.ordersDone, top: S.adv.top, hearts: S.adv.hearts, pass: window.__mg.extra.PASS.reached() }; })));
  } catch (e) { fail('FLOW: ' + (e.stack || e.message).slice(0, 300)); }
  await b.close();
  console.log(`[${name}] ${notes.join(' ')}`);
  if (errs.length) { console.log(`[${name}] FAIL\n  ` + [...new Set(errs)].join('\n  ')); return false; }
  console.log(`[${name}] ok`); return true;
}
(async () => {
  const list = process.argv.slice(2).length ? process.argv.slice(2) : ['android', 'phone', 'promax'];
  let ok = true; for (const n of list) ok = (await run(n)) && ok;
  console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1);
})();
