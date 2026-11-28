// Saarepagar QA: loads merge/index.html fresh on desktop and an iPhone 13 profile, plays the opening with REAL input
// (taps on the oven, finger/mouse drags held for several frames, order and task buttons), plays on with the test
// hook, reloads to check the save, and fails on page errors or a stuck flow. Shots: tools/shots/mergeqa-<profile>-*.png
//   node tools/mergeqa.js [desktop|phone|promax]
const { chromium, devices } = require('playwright');
const path = require('path');
const ROOT = path.dirname(__dirname), only = process.argv[2];
const PROFILES = { desktop: { viewport: { width: 1280, height: 800 } }, phone: { ...devices['iPhone 13'] }, promax: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(name) {
  const b = await chromium.launch({ args: require('./chrome.js').gl });
  const ctx = await b.newContext(PROFILES[name]), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 400)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  const touch = name !== 'desktop', cdp = touch ? await ctx.newCDPSession(p) : null;
  const shot = n => p.screenshot({ path: path.join(__dirname, 'shots', `mergeqa-${name}-${n}.png`) });
  const down = async (x, y) => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }) : (p.mouse.move(x, y), p.mouse.down());
  const move = async (x, y) => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }) : p.mouse.move(x, y);
  const up = async () => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : p.mouse.up();
  const tap = async (x, y) => { await down(x, y); await sleep(120); await up(); await sleep(250); };
  const drag = async (a, c) => { await down(a[0], a[1]); await sleep(80); for (let i = 1; i <= 8; i++) { await move(a[0] + (c[0] - a[0]) * i / 8, a[1] + (c[1] - a[1]) * i / 8); await sleep(30); } await sleep(80); await up(); await sleep(300); };
  const centre = i => p.evaluate(i => { const r = window.__mg.cellRect(i); return r && [r.x + r.s / 2, r.y + r.s / 2]; }, i);
  const S = () => p.evaluate(() => { const s = window.__mg.S; return { coins: s.coins, xp: s.xp, energy: s.energy, done: Object.keys(s.done || {}).length, orders: s.ordersDone || 0 }; }).catch(() => null);
  let ok = true;
  try {
    await p.goto('file://' + ROOT + '/merge/index.html#fresh=1');
    await p.waitForFunction(() => window.__mg, null, { timeout: 30000 }); await sleep(1500); await shot('1-start');
    // Real input: find the oven and two equal items, tap, drag-merge.
    let merges = 0;
    for (let k = 0; k < 12; k++) {
      const plan = await p.evaluate(() => {
        const m = window.__mg, cells = m.S.board;
        let gen = -1; const seen = {};
        for (let i = 0; i < cells.length; i++) { const c = cells[i]; if (!c) continue; if (m.GENERATORS[c.k]) { if (gen < 0) gen = i; continue; } if (c.b || !m.Game.canMerge || !m.CHAINS[c.k]) continue; const key = c.k + ':' + c.l; if (seen[key] !== undefined) return { a: seen[key], b: i }; seen[key] = i; }
        return { gen };
      });
      if (plan.a !== undefined) { const before = await p.evaluate(() => window.__mg.S.board.filter(Boolean).length); await drag(await centre(plan.a), await centre(plan.b)); const after = await p.evaluate(() => window.__mg.S.board.filter(Boolean).length); if (after < before) merges++; }
      else if (plan.gen >= 0) await tap(...(await centre(plan.gen)));
      if (await p.evaluate(() => { const m = window.__mg; return !!(m.UI && (m.UI.dialog || m.UI.modal)); })) await p.evaluate(() => { const a = window.__mg.act; a.skipDialog && a.skipDialog(); a.closeModal && a.closeModal(); });
    }
    if (!merges) { errs.push('FLOW: no merge happened from real drags'); }
    await shot('2-merged');
    // Play on with the hook for a while (orders, tasks), then reload and check the save.
    await p.evaluate(async () => { const a = window.__mg.act; for (let i = 0; i < 300; i++) { try { a.skipDialog && a.skipDialog(); a.closeModal && a.closeModal(); a.autoMerge && a.autoMerge(); const M = window.__mg; (M.S.orders || []).forEach((o, oi) => a.fulfill(oi)); const ar = M.AREAS[M.S.area]; const t = ar && ar.tasks.find(t => !M.S.done[t.id]); if (t) a.doTask(t.id); const g = M.S.board.findIndex(c => c && M.GENERATORS[c.k]); if (g >= 0) a.tapGen(g); } catch (e) {} await new Promise(r => setTimeout(r, 5)); } a.save && a.save(); });
    const s1 = await S(); await shot('3-played');
    await p.reload(); await p.waitForFunction(() => window.__mg, null, { timeout: 30000 }); await sleep(1200);
    const s2 = await S(); await shot('4-reloaded');
    if (!s1 || !s2 || s2.coins !== s1.coins || s2.xp !== s1.xp) errs.push('SAVE: state changed after reload ' + JSON.stringify([s1, s2]));
    console.log(`[${name}] real merges ${merges}; after play ${JSON.stringify(s1)}`);
    // Phase B: the new screens open without errors, a pass step is claimed, the island tour runs after the story,
    // a style is picked by a real tap, and an old version 2 save migrates to version 3.
    const pb = await p.evaluate(() => { const M = window.__mg, X = M.extra; M.act.start(); X.endStory(); M.S.pass.pts += 120; M.S.lvl = Math.max(M.S.lvl, 3); const c = X.PASS.claim(1); const n = X.doIsland(); return { claim: c, done: n, tour: M.S.tour, id: X.TOUR.cur().tasks[0].id }; });
    if (!pb.claim || pb.tour !== 1 || pb.id !== 't1_0') errs.push('PHASE B: pass or tour wrong ' + JSON.stringify(pb));
    for (const k of ['xPass', 'xWeek', 'xLook', 'xRest', 'tasks', 'xPhoto']) { await p.evaluate(k => window.__mg.extra.open(k), k); await sleep(450); await shot('5-' + k); }
    const st = await p.evaluate(() => { const M = window.__mg, t = M.extra.TOUR.island(0).tasks.find(x => x.choices); M.extra.open('xStyle', { id: t.id }); return t.id; });
    await sleep(500);
    const card = await p.evaluate(() => { const h = window.__mg.UI.mhits.filter(x => x.w > 200 && x.h > 80 && x.h < 140); return h.length >= 3 ? [h[1].x + h[1].w / 2, h[1].y + h[1].h / 2] : null; });
    if (card) await tap(...card); else errs.push('PHASE B: no style cards ' + await p.evaluate(() => { const U = window.__mg.UI; return (U.modal && U.modal.kind) + ' ' + JSON.stringify(U.mhits.map(x => [x.w | 0, x.h | 0])); }));
    const picked = await p.evaluate(id => window.__mg.S.style[id], st);
    if (picked !== 'minimal') errs.push('PHASE B: style tap did not pick minimal (' + picked + ')');
    await p.evaluate(() => { const M = window.__mg; while (M.UI.modal) M.UI.closeModal(true); M.act.save(); });
    const old = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('saarepagar.save')); d.v = 2; for (const k of ['tour', 'style', 'pass', 'week', 'look', 'pets', 'petOn', 'owned', 'lookKnown', 'lookSeen']) delete d[k]; delete d.set.rest; localStorage.setItem('saarepagar.save', JSON.stringify(d)); Storage.prototype.setItem = () => {}; return d.coins; });
    await p.goto('file://' + ROOT + '/merge/index.html?nosave=1'); await p.waitForFunction(() => window.__mg, null, { timeout: 30000 }); await sleep(900);
    const mig = await p.evaluate(() => { const S = window.__mg.S; return { v: S.v, tour: S.tour, pass: !!S.pass && !!S.pass.got, week: !!S.week, look: S.look && S.look.outfit, rest: S.set.rest, coins: S.coins }; });
    if (mig.v !== 3 || mig.tour !== 0 || !mig.pass || !mig.week || mig.look !== 'casual' || mig.rest !== true || mig.coins !== old) errs.push('SAVE v2->v3: ' + JSON.stringify(mig));
    console.log(`[${name}] phase B ${JSON.stringify(pb)} style ${picked} migrated ${JSON.stringify(mig)}`);
  } catch (e) { errs.push('FLOW: ' + e.message); }
  await b.close();
  if (errs.length) { ok = false; console.log(`[${name}] FAIL\n  ` + errs.join('\n  ')); } else console.log(`[${name}] ok`);
  return ok;
}
(async () => { let ok = true; for (const n of only ? [only] : Object.keys(PROFILES)) ok = (await run(n)) && ok; console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1); })();
