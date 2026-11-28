// Saarepagar v3 adventure QA: the level map, a level played with REAL touch drags, win and fail screens, the lucky
// wheel, piggy bank and calendar, then the sampler-bot win rates over levels 1..N. Fails on page errors.
//   node tools/mergelevels.js [promax|phone|desktop] [N=200]
const { chromium, devices } = require('playwright');
const path = require('path');
const ROOT = path.dirname(__dirname), prof = process.argv[2] || 'promax', NLEV = +process.argv[3] || 200;
const PROFILES = { desktop: { viewport: { width: 1280, height: 800 } }, phone: { ...devices['iPhone 13'] }, promax: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ args: require('./chrome.js').gl });
  const ctx = await b.newContext(PROFILES[prof]), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 400)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  const touch = prof !== 'desktop', cdp = touch ? await ctx.newCDPSession(p) : null;
  const shot = n => p.screenshot({ path: path.join(__dirname, 'shots', `levels-${prof}-${n}.png`) });
  const down = async (x, y) => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }) : (await p.mouse.move(x, y), await p.mouse.down());
  const move = async (x, y) => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }) : p.mouse.move(x, y);
  const up = async () => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : p.mouse.up();
  const tap = async (x, y) => { await down(x, y); await sleep(90); await up(); await sleep(260); };
  const drag = async (a, c) => { await down(a[0], a[1]); await sleep(70); for (let i = 1; i <= 8; i++) { await move(a[0] + (c[0] - a[0]) * i / 8, a[1] + (c[1] - a[1]) * i / 8); await sleep(25); } await sleep(60); await up(); await sleep(220); };
  const ev = (f, a) => p.evaluate(f, a);
  // find a hit button by its label text through the modal hit list is not possible (canvas); use known geometry via evaluate
  const btn = async (pred) => ev(pred);
  let ok = true;
  try {
    await p.goto('file://' + ROOT + '/merge/index.html#fresh=1');
    await p.waitForFunction(() => window.__mg, null, { timeout: 30000 }); await sleep(1200);
    // old-style save keys exist and the new ones too
    const keys = await ev(() => ['adv', 'wheel', 'piggy'].every(k => window.__mg.S[k]));
    if (!keys) errs.push('STATE: missing adv/wheel/piggy');
    await shot('0-title');
    // tap the "Seiklus" title button (second button under "Alusta")
    const tb = await ev(() => { const h = window.__mg.UI.mhits; return h.map(x => [x.x + x.w / 2, x.y + x.h / 2]); });
    await tap(...tb[1]); await sleep(700);
    if ((await ev(() => window.__mg.UI.scr)) !== 'map') errs.push('FLOW: Seiklus button did not open the map');
    await shot('1-map');
    // scroll the map with a real drag, then press the play button (biggest bottom button)
    await drag([220, 500], [220, 700]); await sleep(500); await shot('1b-map-scrolled');
    const play = await ev(() => { const h = window.__mg.UI.hits.slice().sort((a, b) => b.y - a.y)[0]; return [h.x + h.w / 2, h.y + h.h / 2]; });
    await tap(...play); await sleep(500);
    if ((await ev(() => (window.__mg.UI.modal || {}).kind)) !== 'advStart') errs.push('FLOW: play button did not open the start screen');
    await shot('2-start');
    const go = await ev(() => { const h = window.__mg.UI.mhits.slice().sort((a, b) => b.y - a.y)[0]; return [h.x + h.w / 2, h.y + h.h / 2]; });
    await tap(...go); await sleep(600);
    await shot('3-tip');
    // close tips
    for (let k = 0; k < 4 && await ev(() => (window.__mg.UI.modal || {}).kind === 'advTip'); k++) { const s = await ev(() => { const h = window.__mg.UI.mhits.slice().sort((a, b) => b.y - a.y)[0]; return [h.x + h.w / 2, h.y + h.h / 2]; }); await tap(...s); await sleep(400); }
    if ((await ev(() => window.__mg.UI.scr)) !== 'level') errs.push('FLOW: did not enter the level');
    await shot('4-level');
    // play level 1 with real drags following the careful bot's choice
    let drags = 0;
    for (let k = 0; k < 40; k++) {
      const plan = await ev(() => { const L = window.__mg.levels, r = L.state; if (!r || r.over) return null; const c = L.LV.candidates(r); if (!c.length) return null; c.sort((a, b) => b.s - a.s); return { a: L.cell(c[0].a), b: L.cell(c[0].b) }; });
      if (!plan) break;
      await drag([plan.a.x, plan.a.y], [plan.b.x, plan.b.y]); drags++;
      if (k === 2) await shot('5-playing');
    }
    const st = await ev(() => { const r = window.__mg.levels.state; return r && { won: r.won, used: r.used, moves: r.moves }; });
    console.log('level 1 by real drags:', drags, 'drags', JSON.stringify(st));
    if (!st || !st.won) errs.push('FLOW: level 1 not won by real drags ' + JSON.stringify(st));
    await sleep(4200); await shot('6-win');
    if ((await ev(() => (window.__mg.UI.modal || {}).kind)) !== 'advWin') errs.push('FLOW: no win screen');
    const top = await ev(() => window.__mg.S.adv.top);
    if (top !== 2) errs.push('FLOW: top level is ' + top + ', expected 2');
    // "Edasi" (right button at the bottom of the win panel)
    const next = await ev(() => { const h = window.__mg.UI.mhits.slice().sort((a, b) => (b.y - a.y) || (b.x - a.x))[0]; return [h.x + h.w / 2, h.y + h.h / 2]; });
    await tap(...next); await sleep(800); await shot('7-next-start');
    // level 2: fail it to see the fail screen
    await ev(() => window.__mg.levels.start(2)); await sleep(300);
    await ev(() => { while (window.__mg.UI.modal) window.__mg.UI.closeModal(true); });
    await sleep(300); await shot('8-level2');
    await ev(() => window.__mg.levels.lose()); await sleep(1500); await shot('9-fail');
    if ((await ev(() => (window.__mg.UI.modal || {}).kind)) !== 'advFail') errs.push('FLOW: no fail screen');
    const hearts0 = await ev(() => window.__mg.S.adv.hearts);
    // press "Loobu" (lowest button)
    const giveUp = await ev(() => { const h = window.__mg.UI.mhits.slice().sort((a, b) => b.y - a.y)[0]; return [h.x + h.w / 2, h.y + h.h / 2]; });
    await tap(...giveUp); await sleep(600);
    const hearts1 = await ev(() => window.__mg.S.adv.hearts);
    if (hearts1 !== hearts0 - 1) errs.push('FLOW: life not lost on giving up ' + hearts0 + ' -> ' + hearts1);
    // boss and late levels look right
    await ev(() => { window.__mg.S.adv.top = 120; window.__mg.levels.start(120); while (window.__mg.UI.modal) window.__mg.UI.closeModal(true); }); await sleep(500); await shot('10-level120-boss');
    await ev(() => { window.__mg.levels.start(57); while (window.__mg.UI.modal) window.__mg.UI.closeModal(true); }); await sleep(500); await shot('11-level57');
    // booster: wand on a cell with a real tap
    const wand = await ev(() => { const H = window.__mg.UI.hits.filter(h => h.by !== undefined).sort((a, b) => b.y - a.y || a.x - b.x); const hb = H.slice(0, 4).sort((a, b) => a.x - b.x)[0]; const r = window.__mg.levels.state; const i = r.it.findIndex((x, j) => x && !r.web[j] && x.l < 5); return { b: [hb.x + hb.w / 2, hb.y + hb.h / 2], c: window.__mg.levels.cell(i), i, l: r.it[i].l, n: window.__mg.S.adv.boost.wand }; });
    await tap(...wand.b); await sleep(300); await shot('12-wand-mode'); await tap(wand.c.x, wand.c.y); await sleep(500);
    const wand2 = await ev(i => ({ n: window.__mg.S.adv.boost.wand, it: window.__mg.levels.state.it[i] }), wand.i);
    if (wand2.n !== wand.n - 1) errs.push('BOOST: wand not used ' + JSON.stringify([wand, wand2]));
    await shot('13-after-wand');
    await ev(() => { window.__mg.levels.LV.quit(); window.__mg.UI.goScreen('map'); }); await sleep(600);
    // the wheel: spin with a real tap
    await ev(() => window.__mg.levels.spinWheel()); await sleep(500); await shot('14-wheel');
    const spinBtn = await ev(() => { const h = window.__mg.UI.mhits.slice().sort((a, b) => b.y - a.y)[0]; return [h.x + h.w / 2, h.y + h.h / 2]; });
    const c0 = await ev(() => window.__mg.S.wheel.n);
    await tap(...spinBtn); await sleep(1500); await shot('15-wheel-spinning'); await sleep(3500); await shot('16-wheel-won');
    if ((await ev(() => window.__mg.S.wheel.n)) !== c0 + 1) errs.push('WHEEL: no spin');
    await ev(() => window.__mg.UI.closeModal()); await sleep(300);
    // piggy bank and calendar
    await ev(() => { window.__mg.S.piggy.coins = 140; window.__mg.UI.openModal({ kind: 'advPiggy' }); }); await sleep(500); await shot('17-piggy');
    const pig = await ev(() => { const h = window.__mg.UI.mhits.slice().sort((a, b) => b.y - a.y)[0]; return [h.x + h.w / 2, h.y + h.h / 2]; });
    const coins0 = await ev(() => window.__mg.S.coins); await tap(...pig); await sleep(800);
    if ((await ev(() => window.__mg.S.coins)) < coins0 + 140) errs.push('PIGGY: not opened');
    await shot('18-piggy-opened'); await ev(() => window.__mg.UI.closeModal()); await sleep(200);
    await ev(() => window.__mg.UI.openModal({ kind: 'daily' })); await sleep(500); await shot('19-calendar');
    await ev(() => window.__mg.act.claimGift()); await sleep(800); await shot('20-calendar-claimed');
    await ev(() => { window.__mg.UI.closeModal(); window.__mg.UI.goScreen('board'); window.__mg.act.skipDialog(); }); await sleep(600); await shot('21-board');
    // save survives a reload
    await ev(() => window.__mg.act.save());
    const a1 = await ev(() => JSON.stringify(window.__mg.S.adv));
    await p.reload(); await p.waitForFunction(() => window.__mg, null, { timeout: 30000 }); await sleep(800);
    const a2 = await ev(() => JSON.stringify(window.__mg.S.adv));
    if (JSON.parse(a1).top !== JSON.parse(a2).top) errs.push('SAVE: adv state lost');
    // solvability: sampler-bot win rates
    const res = await ev(n => { const t0 = performance.now(); const r = window.__mg.levels.botTest(1, n, 12); r.ms = performance.now() - t0; delete r.rows; return r; }, NLEV);
    console.log('sampler win rates 1..' + NLEV + ':', JSON.stringify(res));
  } catch (e) { errs.push('FLOW: ' + e.message); }
  await b.close();
  if (errs.length) { ok = false; console.log(`[${prof}] FAIL\n  ` + errs.join('\n  ')); } else console.log(`[${prof}] ok`);
  process.exit(ok ? 0 : 1);
})();
