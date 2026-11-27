// Audio under a slow phone CPU: runs the game in a phone profile (Pixel 7) with the CPU throttled (like a budget
// Android) and checks that the audio keeps up: chip music steps written after their time had passed (AU.stats().late),
// gaps between audio updates longer than the look-ahead (AU.look(); past it, notes land late), and Chrome's own
// output underrun counters when the browser has them (AudioContext.playbackStats).
//   node tools/audiothrottle.js               throttle 4x: menu, a calm land, a crowded wave, the campaign map
//   THROTTLE=6 node tools/audiothrottle.js    slower      STYLE=classic   the classic soundtrack      SECS=15
// Fails (exit 1) on a page error, an audio fault, more than 2% late steps, or any output underrun Chrome reports.
// gaps>look counts seconds with an update gap longer than the look-ahead (which grows after stalls: see lookAhead).
const { chromium, devices } = require('playwright');
const path = require('path');
const ROOT = path.dirname(__dirname), RATE = +(process.env.THROTTLE || 4), SECS = +(process.env.SECS || 20);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SCENES = [
  ['menu', ''],
  ['land', 'seed=4&biome=frost&ff=20'],
  ['crowd', 'seed=4&biome=ember&level=2&k=3&ff=3'],
  ['map', 'seed=4&biome=ashen&ff=5', 'G.paused=true;AU.setScene("map")'],
];
(async () => {
  const b = await chromium.launch({ executablePath: require('./chrome.js').path, args: [...require('./chrome.js').gl, '--autoplay-policy=no-user-gesture-required'] });
  let bad = 0;
  console.log('scene  CPU  steps  late  lateMax  updMax  look  gaps>look  underruns  alive | chip');
  for (const [name, hash, js] of SCENES) {
    const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 2 });
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    await p.goto('file://' + ROOT + '/index.html' + (hash ? '#' + hash : ''));
    await sleep(2500);
    await p.evaluate(() => window.__cwAudio.unlock());
    if (process.env.STYLE) await p.evaluate(s => window.__cwAudio.setStyle(s), process.env.STYLE);
    if (js) await p.evaluate('(()=>{const G=window.__cw.G,AU=window.__cwAudio;' + js + '})()');
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
    await sleep(3000);
    await p.evaluate(() => { // one sample a second: the steps, late steps and the worst update gap in that second
      const AU = window.__cwAudio, ac = AU.context, A = window.__at = { rows: [], ps0: null };
      try { if (ac && ac.playbackStats) A.ps0 = [ac.playbackStats.underrunEvents, ac.playbackStats.underrunDuration]; } catch (e) {}
      AU.resetTiming();
      A.iv = setInterval(() => { const s = AU.stats(); A.rows.push([s.steps, s.late, s.lateMax, s.updMax]); AU.resetTiming(); }, 1000);
    });
    await sleep(SECS * 1000);
    const r = await p.evaluate(() => {
      const AU = window.__cwAudio, s = AU.stats(), A = window.__at, ac = AU.context, look = AU.look(); clearInterval(A.iv);
      let steps = 0, late = 0, lateMax = 0, updMax = 0, gaps = 0;
      A.rows.forEach((x) => { steps += x[0]; late += x[1]; lateMax = Math.max(lateMax, x[2]); updMax = Math.max(updMax, x[3]); if (x[3] > look) gaps++; });
      let under = null; try { if (ac && ac.playbackStats && A.ps0) under = [ac.playbackStats.underrunEvents - A.ps0[0], +(ac.playbackStats.underrunDuration - A.ps0[1]).toFixed(3)]; } catch (e) {}
      const G = window.__cw.G;
      return { steps, late, lateMax, updMax, gaps, look, under, err: s.err, chip: s.chip, alive: G && G.mons ? G.mons.length : 0 };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const frac = r.steps ? r.late / r.steps : 0, fail = !!r.err || errs.length > 0 || frac > 0.02 || !!(r.under && r.under[0] > 0);
    if (fail) bad++;
    console.log(name.padEnd(6), (RATE + 'x').padStart(3), String(r.steps).padStart(6), String(r.late).padStart(5), ((r.lateMax * 1000).toFixed(0) + 'ms').padStart(8),
      ((r.updMax * 1000).toFixed(0) + 'ms').padStart(7), r.look.toFixed(2).padStart(5), String(r.gaps).padStart(10), (r.under ? r.under[0] + '/' + r.under[1] + 's' : 'n/a').padStart(10), String(r.alive).padStart(6), '|', r.chip,
      (r.err ? ' | AUDIO ERR ' + r.err : '') + (errs.length ? ' | PAGE ERR ' + errs.join('; ') : '') + (fail ? '  FAIL' : ''));
    await ctx.close();
  }
  await b.close();
  console.log(bad ? 'FAIL' : 'PASS');
  process.exit(bad ? 1 : 0);
})();
