// Saarepagar cheap-Android budget: runs merge/index.html in a phone profile (390x844 at DPR 3 and DPR 2) with the CPU
// slowed down through CDP (4x and 6x, like a Poco M7 Pro class phone) and reports, per scene:
//   js   = JS ms per frame (UI.update + UI.draw called back to back, synchronous; p50 / p95)
//   rast = canvas raster flush after the frame (one pixel read back). Chrome records 2D canvas calls and plays them back
//          later; here (software canvas) that playback runs on the throttled main thread, on a phone it is mostly GPU
//          fill work. Without the flush the playback lands in random later frames as 1-3 s spikes.
//   loop = the real rAF loop for a few seconds: frames drawn per second and the p50 / p95 gap between drawn frames
//          (the board redraws at 20 fps on purpose when only the scene animates, so loop fps there is capped by design)
// Scenes: board (story area, night + rain), tour island (night + snow), level map scrolling, a level with obstacles and
// boosters (bot moves + booster use), big merge chains with effects, wardrobe and photo screens.
//   node tools/mergeperf.js                    DPR 3 and 2, throttle 4x and 6x (about 3 minutes)
//   DPR=3 THROTTLE=4 node tools/mergeperf.js   one combination
//   ONLY=board,map node tools/mergeperf.js     some scenes
//   The page reports 8 cores and 8 GB like a Poco M7 Pro (so the core/memory checks do not fire; the measured-frame
//   governor in FX.perf does). NATIVE=1 keeps this machine's values; WEAK=1 reports 4 cores / 4 GB instead.
//   AUTO=0                                     pin the game's adaptive quality governor off (pure cost of the top path)
//   NOFLUSH=1                                  skip the per-frame read-back (rast column then reads 0)
//   FILE=x.html                                page under merge/ to measure (default index.html; e.g. an older build)
//   JSON=path                                  also write the rows as JSON
// Software GL and headless raster here make absolute numbers pessimistic; compare before and after on this machine.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.dirname(__dirname);
const DPRS = (process.env.DPR || '3,2').split(',').map(Number), RATES = (process.env.THROTTLE || '4,6').split(',').map(Number);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, FLUSH = !process.env.NOFLUSH, NATIVE = !!process.env.NATIVE, WEAK = !!process.env.WEAK, AUTO = process.env.AUTO !== '0';
const N = +(process.env.FRAMES || 60), LOOPMS = +(process.env.LOOPMS || 2500);
const UA = 'Mozilla/5.0 (Linux; Android 14; 24117RK2CG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Each scene: url hash flags, a setup run once (unthrottled), and a per-frame step run before every measured frame.
const SCENES = {
  board: { hash: 'tod=0.03&weather=rain', label: 'board story, night rain', setup: 'story', step: 'none' },
  tour: { hash: 'tod=0.03&weather=snow', label: 'board tour island, night snow', setup: 'tour', step: 'none' },
  map: { hash: 'tod=0.5&weather=clear', label: 'level map scrolling', setup: 'map', step: 'scroll' },
  level: { hash: 'tod=0.5&weather=clear', label: 'level 47, obstacles + boosters', setup: 'level', step: 'levelBot' },
  merges: { hash: 'tod=0.85&weather=petals', label: 'merge chains + effects, dusk petals', setup: 'merges', step: 'merge' },
  look: { hash: 'tod=0.5&weather=clear', label: 'wardrobe screen', setup: 'look', step: 'none' },
  photo: { hash: 'tod=0.03&weather=snow', label: 'photo screen, night snow', setup: 'photo', step: 'none' },
};

async function scene(b, dpr, rate, key) {
  const sc = SCENES[key];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, userAgent: UA });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await p.addInitScript(([native, weak, auto]) => {
    if (!native) try { const n = weak ? 4 : 8; Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => n }); Object.defineProperty(navigator, 'deviceMemory', { get: () => n }); } catch (e) { }
    if (!auto) window.__mgPerfNoAuto = 1;
  }, [NATIVE, WEAK, AUTO]);
  await p.goto('file://' + ROOT + '/merge/' + (process.env.FILE || 'index.html') + '?nosave=1&seed=7#fresh=1&' + sc.hash);
  await p.waitForFunction(() => window.__mg, null, { timeout: 30000 });
  await sleep(600);
  await p.evaluate(setup => {
    const M = window.__mg, a = M.act, U = M.UI;
    const clear = () => { a.skipDialog(); while (U.modal) U.closeModal(true); };
    a.start(); clear(); M.S.tut = 9; M.S.energy = 999;
    for (const t of M.AREAS[0].tasks.slice(0, 3)) { M.S.done[t.id] = true; } // part-restored scene
    if (setup === 'tour') { M.extra.endStory(); M.S.tour = 3; clear(); }
    if (setup === 'map') { M.S.adv.top = 64; M.levels.map(); clear(); }
    if (setup === 'level') { M.S.adv.boost = { wand: 5, scissors: 5, shuffle: 5, moves: 5 }; M.S.adv.lives = 5; M.levels.start(47); clear(); }
    if (setup === 'look') M.extra.open('xLook');
    if (setup === 'photo') M.extra.open('xPhoto');
    if (setup === 'merges') { // a full board of mergeable pairs
      const ks = ['bread', 'berry', 'flower', 'tea', 'fish'];
      for (let i = 0; i < M.S.board.length; i++) { const it = M.S.board[i]; if (!it || !M.GENERATORS[it.k]) M.S.board[i] = { k: ks[(i >> 1) % ks.length], l: 1 + ((i >> 3) % 3) }; }
    }
    U.markDirty();
    window.__perf = { fi: 0 };
  }, sc.setup);
  // warm caches unthrottled (first-draw cost is reported separately below)
  const first = await p.evaluate(() => { const U = window.__mg.UI, a = performance.now(); U.update(1 / 30); U.draw(performance.now()); document.getElementById('cv').getContext('2d').getImageData(0, 0, 1, 1); return performance.now() - a; });
  await p.evaluate(() => { const U = window.__mg.UI; for (let i = 0; i < 12; i++) { U.update(1 / 30); U.draw(performance.now() + i * 33); document.getElementById('cv').getContext('2d').getImageData(0, 0, 1, 1); } });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const res = await p.evaluate(([n, step, flush]) => {
    const M = window.__mg, U = M.UI, a = M.act, cv = document.getElementById('cv'), cx = cv.getContext('2d');
    const P = window.__perf, js = [], ras = [];
    const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true }));
    let dir = 1, y = 300;
    for (let i = 0; i < n; i++) {
      P.fi++;
      if (step === 'scroll') { if (i === 0) ev('pointerdown', 195, y); y += dir * 9; if (y > 700 || y < 150) { dir = -dir; } ev('pointermove', 195, y); }
      if (step === 'merge' && i % 4 === 0) { // merge a pair (with its burst) and refill so chains keep coming
        const B = M.S.board; let done = false;
        for (let x = 0; x < B.length && !done; x++) for (let z = x + 1; z < B.length && !done; z++) if (M.Game.canMerge(B[x], B[z])) { a.merge(x, z); done = true; }
        if (!done || i % 16 === 0) for (let q = 0; q < B.length; q++) if (!B[q]) B[q] = { k: ['bread', 'berry', 'flower'][q % 3], l: 1 + (q % 2) };
      }
      if (step === 'levelBot' && i % 6 === 0) { const r = M.levels.state; if (r && !r.over) { if (i % 24 === 12) { const c = r.it.findIndex(x => x && x.k); if (c >= 0) M.levels.boost('wand', c); } else M.levels.botStep(); } }
      const t0 = performance.now();
      U.update(1 / 30); U.draw(performance.now());
      const t1 = performance.now();
      if (flush) cx.getImageData(0, 0, 1, 1);
      js.push(t1 - t0); ras.push(performance.now() - t1);
    }
    if (step === 'scroll') ev('pointerup', 195, y);
    return { js, ras };
  }, [N, sc.step, FLUSH]);
  // the real loop: wrap UI.draw to log when it runs (and keep the per-frame step going on a timer)
  const loop = await p.evaluate(([ms, step]) => new Promise(done => {
    const M = window.__mg, U = M.UI, cv = document.getElementById('cv'), stamps = [], durs = [];
    const orig = U.draw; U.draw = function (t) { const a = performance.now(); orig.call(U, t); const d = performance.now(); stamps.push(d); durs.push(d - a); };
    const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true }));
    let y = 300, dir = 1, k = 0;
    if (step === 'scroll') ev('pointerdown', 195, y);
    const iv = setInterval(() => {
      k++;
      if (step === 'scroll') { y += dir * 14; if (y > 700 || y < 150) dir = -dir; ev('pointermove', 195, y); }
      if (step === 'merge' && k % 3 === 0) { const B = M.S.board; outer: for (let x = 0; x < B.length; x++) for (let z = x + 1; z < B.length; z++) if (M.Game.canMerge(B[x], B[z])) { M.act.merge(x, z); break outer; } for (let q = 0; q < B.length; q++) if (!B[q]) B[q] = { k: 'berry', l: 1 + (q % 2) }; }
      if (step === 'levelBot' && k % 4 === 0) { const r = M.levels.state; if (r && !r.over) M.levels.botStep(); }
    }, 33);
    setTimeout(() => { clearInterval(iv); if (step === 'scroll') ev('pointerup', 195, y); U.draw = orig; const gaps = []; for (let i = 1; i < stamps.length; i++) gaps.push(stamps[i] - stamps[i - 1]); done({ gaps, durs, fps: stamps.length / (ms / 1000) }); }, ms);
  }), [LOOPMS, sc.step]);
  const info = await p.evaluate(() => ({ dpr: window.__mg.UI.H.DPR, q: window.__mgArt ? window.__mgArt.FX.quality : '?', perf: window.__mgArt && window.__mgArt.ART.perf ? window.__mgArt.ART.perf.level : '-', cv: document.getElementById('cv').width + 'x' + document.getElementById('cv').height }));
  await ctx.close();
  const q = (a, f) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * f))].toFixed(1); };
  return { scene: key, label: sc.label, dpr, rate, first: +first.toFixed(1), js50: q(res.js, .5), js95: q(res.js, .95), r50: q(res.ras, .5), r95: q(res.ras, .95), t50: q(res.js.map((v, i) => v + res.ras[i]), .5), t95: q(res.js.map((v, i) => v + res.ras[i]), .95), fps: +loop.fps.toFixed(1), gap50: q(loop.gaps, .5), gap95: q(loop.gaps, .95), loop50: q(loop.durs, .5), info, errs, spikes: res.js.map((v, i) => [i, v]).filter(x => x[1] > 30).map(x => x[0] + ':' + x[1].toFixed(0)) };
}

(async () => {
  const b = await chromium.launch({ args: require('./chrome.js').gl });
  const rows = [], keys = Object.keys(SCENES).filter(k => !ONLY || ONLY.includes(k));
  let bad = 0;
  for (const dpr of DPRS) for (const rate of RATES) {
    console.log(`\n390x844 DPR ${dpr}, CPU ${rate}x${NATIVE ? ', native cores' : WEAK ? ', 4 cores 4 GB' : ', 8 cores 8 GB'}${AUTO ? '' : ', governor off'}${FLUSH ? ', flushed' : ''}`);
    console.log('  scene                                     js p50  p95 | rast p50  p95 | sum p50  p95 | loop fps gap p50  p95 | first  canvas');
    for (const k of keys) {
      let r;
      try { r = await scene(b, dpr, rate, k); } catch (e) { console.log('  ' + k + ' FAILED ' + e.message); bad++; continue; }
      rows.push(r);
      console.log(`  ${r.label.padEnd(40)} ${String(r.js50).padStart(6)} ${String(r.js95).padStart(5)} | ${String(r.r50).padStart(8)} ${String(r.r95).padStart(5)} | ${String(r.t50).padStart(7)} ${String(r.t95).padStart(5)} | ${String(r.fps).padStart(8)} ${String(r.gap50).padStart(7)} ${String(r.gap95).padStart(5)} | ${String(r.first).padStart(5)}  ${r.info.cv} q${r.info.q} L${r.info.perf}`);
      if (process.env.SPIKES) console.log('    spikes: ' + r.spikes.join(' '));
      if (r.errs.length) { bad++; console.log('    page errors:\n      ' + r.errs.join('\n      ')); }
    }
  }
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
  await b.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
