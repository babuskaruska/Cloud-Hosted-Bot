// Saarepagar audio mix table: loads merge/index.html in headless Chrome, plays a scene and measures the master output
// with AU.meter (merge/src/80-audio.js): integrated loudness (approx. LUFS), loudest 400 ms block, true peak, and the
// share of energy in five bands (sub < 150 Hz, low, mid, presence, air > 6 kHz). Also the Web Audio nodes made per
// second (n/s, a CPU proxy for weak phones), dropped sounds and the music's section. Scene 'combo' plays a merge combo
// climbing over the harbour music (merge, merge5, combo, lucky). v3: 'map', the six level chapters, 'tense' (few moves
// left), 'sfx3' (the level-mode sounds), 'wheel' (lucky wheel spin) and 'level' (a level session over its music).
// v3 phase B: the eight island tour themes (t_flower ... t_orchard), the four weekly events (ev_garden ... ev_beach),
// one board song in each season (s_winter ... s_autumn), 'sfx4' (the phase B sounds) and 'soak' (scene, season and
// sound changes every 2.5 s; then the music stops and every started source must have ended: live <= 2).
// Scenes without their own season play SEASON (default: autumn, so runs on different dates compare).
//   node tools/mergeaudio.js                 every scene (SECS each, default 20)
//   node tools/mergeaudio.js sfx mix aed     only these scenes
//   SECS=10 / LITE=1 / PHONE=1               shorter, the lite mode, a phone page (steeper low cut)
//   SEASON=winter                            the season layered on scenes that set none
// Fails (exit 1) on a page error, an audio error in AU.stats().err, a NaN written to an AudioParam, or a true peak above
// -1 dBFS; 'soak' also fails when sources are still live after the music stops.
const { chromium } = require('playwright');
const path = require('path');
const chrome = require('./chrome.js');
const ROOT = path.dirname(__dirname);
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const SECS = +(process.env.SECS || 20);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------- v3 phase C modes (Echo): offline mix analysis, cheap-Android timing, a long soak, lifecycle ----------------
//   node tools/mergeaudio.js --mix [scene ...]     every music scene rendered offline (AU.render, faster than real time) for
//        MIXSECS (default 150) in full and lite: integrated loudness, loudness through a phone-speaker model (300 Hz high-pass),
//        loudness range, true peak, bands, harshness (presence vs mid, dB) and mud (low vs mid, dB). Fails when a scene is more
//        than 1.5 LU from the median (full or phone), lite differs from full by more than 1 LU, or the peak is above -1 dBFS.
//   node tools/mergeaudio.js --sfxmix              every sound alone: its loudest 400 ms against the music's median loudness,
//        and for the sounds heard most (merge, tap, pick, drop, spawn, order, coins) how alike 10 slow repeats are (spectral
//        similarity 0..1; 1 = identical). Fails when a frequent sound repeats with similarity above 0.97.
//   node tools/mergeaudio.js --throttle            the real game in a phone profile with the CPU throttled (THROTTLE, default
//        "4,6"): board (with merges), map, level (bot moves) and event, SECS each. Notes written late, bars skipped, the worst
//        scheduler gap, the look-ahead, audio JS ms per second and per update, Chrome's underruns. Fails on > 0.5 % late notes,
//        any skipped bar or underrun, or a page or audio error.
//   node tools/mergeaudio.js --soak10              SOAKMIN minutes (default 10) of scene changes and sounds in the real game
//        (phone profile, CPU 4x): live sources, nodes made and the JS heap (after GC) every minute. Fails when sources are
//        still live after the music stops, the heap grows by more than 3 MB, or there is any page or audio error.
//   node tools/mergeaudio.js --life                lifecycle: hidden page, idle sleep and wake on a touch, mute, both volumes at
//        0, music volume 0 (nothing written, the bus at exactly 0), a quiet sleep woken by a sound, an outside suspend (an
//        iPhone interruption) resumed by a touch, fast scene switches (one song left), no loud start after any wake.
const PHASEC = ['--mix', '--sfxmix', '--throttle', '--soak10', '--life'].find(f => process.argv.includes(f));
// Runs in the page: loudness (BS.1770 K-weighting, gated), phone loudness, LRA, peak, bands, harshness and mud of a render.
function analyse(R) {
  const fs = R.rate, L = R.L, Rr = R.R, n = L.length;
  function bq(type, f, q, gain) { // RBJ biquad coefficients
    const w = 2 * Math.PI * f / fs, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q), A = Math.pow(10, (gain || 0) / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; } // peak
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  function run(x, c) { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = x[i], o = c[0] * v + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2; x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o; } return y; }
  const chain = (x, cs) => cs.reduce((a, c) => run(a, c), x);
  const K = [[1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585], [1, -2, 1, -1.99004745483398, 0.99007225036621]];
  const PH = [bq('hp', 300, 0.707), bq('hp', 300, 0.707), bq('peak', 2800, 1, 3), bq('lp', 11000, 0.707)];
  const sub = Math.round(fs * 0.1), skip = Math.round(fs * (R.skip !== undefined ? R.skip : 3)); // skip the first 3 s (fade in) unless told
  function blocks(cs) { // 100 ms mean squares (sum of channels) after the filters
    const a = chain(L, cs), b = chain(Rr, cs), out = [];
    for (let s = skip; s + sub <= n; s += sub) { let acc = 0; for (let i = s; i < s + sub; i++) acc += a[i] * a[i] + b[i] * b[i]; out.push(acc / sub); }
    return out;
  }
  const lu = (ms) => (ms > 1e-12 ? -0.691 + 10 * Math.log10(ms) : -120);
  function gated(sb, win) { // integrated (400 ms) or short-term (3 s) values
    const w = win / 0.1, bl = []; for (let i = 0; i + w <= sb.length; i++) { let s = 0; for (let j = 0; j < w; j++) s += sb[i + j]; bl.push(s / w); }
    return bl;
  }
  function integ(sb) {
    const bl = gated(sb, 0.4); let s = 0, c = 0, mx = 0; for (const x of bl) { if (x > mx) mx = x; if (lu(x) > -70) { s += x; c++; } }
    if (!c) return { I: -120, M: -120 };
    const rel = lu(s / c) - 10; s = 0; c = 0; for (const x of bl) if (lu(x) > -70 && lu(x) > rel) { s += x; c++; }
    return { I: lu(s / c), M: lu(mx), bl };
  }
  const kb = blocks(K), I = integ(kb), P = integ(blocks(PH.concat(K)));
  const st = gated(kb, 3).map(lu).filter(v => v > -70), relS = I.I - 20, sv = st.filter(v => v > relS).sort((a, b) => a - b);
  const pct = (p) => (sv.length ? sv[Math.min(sv.length - 1, Math.floor(p * sv.length))] : 0);
  let pk = 0; for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (a > pk) pk = a; }
  const mono = new Float32Array(n - skip); for (let i = skip; i < n; i++) mono[i - skip] = (L[i] + Rr[i]) * 0.5;
  const E = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return s; };
  const bands = [[0, 150], [150, 500], [500, 2500], [2500, 6000], [6000, 0]].map(([lo, hi]) => { let cs = []; if (lo) cs.push(bq('hp', lo, 0.707), bq('hp', lo, 0.707)); if (hi) cs.push(bq('lp', hi, 0.707), bq('lp', hi, 0.707)); return E(chain(mono, cs)); });
  const tot = bands.reduce((a, b) => a + b, 0) || 1, dB = (a, b) => +(10 * Math.log10((a + 1e-12) / (b + 1e-12))).toFixed(1);
  return { lufs: +I.I.toFixed(1), mMax: +I.M.toFixed(1), phone: +P.I.toFixed(1), lra: +(pct(0.95) - pct(0.1)).toFixed(1), tp: +(20 * Math.log10(pk || 1e-9)).toFixed(1),
    bands: bands.map(b => Math.round(100 * b / tot)), harsh: dB(bands[3], bands[2]), mud: dB(bands[1], bands[2]) };
}
// Runs in the page: magnitude spectra of each repeat (21 ms frames, 47 Hz bins up to 13 kHz, over 0.5 s) and their mean
// pairwise cosine similarity (pitch, timing and timbre changes all lower it; noise alone barely does).
function similarity(R, starts, len) {
  const fs = R.rate, N = 1024, hop = 512;
  function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let s = 2; s <= n; s <<= 1) { const a = -2 * Math.PI / s; for (let i = 0; i < n; i += s) for (let k = 0; k < s / 2; k++) { const c = Math.cos(a * k), d = Math.sin(a * k), xr = re[i + k + s / 2] * c - im[i + k + s / 2] * d, xi = re[i + k + s / 2] * d + im[i + k + s / 2] * c; re[i + k + s / 2] = re[i + k] - xr; im[i + k + s / 2] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi; } } }
  const vecs = starts.map((t) => {
    const s0 = Math.round(t * fs), v = [];
    for (let s = s0; s + N <= s0 + len * fs; s += hop) { const re = new Float32Array(N), im = new Float32Array(N); for (let i = 0; i < N; i++) re[i] = (R.L[s + i] + R.R[s + i]) * 0.5 * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); fft(re, im); for (let k = 1; k < 280; k++) v.push(Math.hypot(re[k], im[k])); }
    return v;
  });
  let s = 0, c = 0;
  for (let i = 0; i < vecs.length; i++) for (let j = i + 1; j < vecs.length; j++) { let d = 0, a = 0, b = 0; const x = vecs[i], y = vecs[j]; for (let k = 0; k < x.length; k++) { d += x[k] * y[k]; a += x[k] * x[k]; b += y[k] * y[k]; } s += d / Math.sqrt(a * b); c++; }
  return +(s / c).toFixed(4);
}
const MIXSC = { title: ['title'], story: ['story'], map: ['map'], pagariari: ['board', { area: 'pagariari' }], aed: ['board', { area: 'aed' }], sadam: ['board', { area: 'sadam' }],
  tuuleveski: ['board', { area: 'tuuleveski' }], majakas: ['board', { area: 'majakas' }], saladus: ['board', { area: 'saladus' }],
  candy: ['level', { chapter: 1 }], meadow: ['level', { chapter: 2 }], berry: ['level', { chapter: 3 }], cliffs: ['level', { chapter: 4 }], winter: ['level', { chapter: 5 }], lavender: ['level', { chapter: 6 }],
  t_flower: ['board', { tour: 'flower' }], t_spa: ['board', { tour: 'spa' }], t_icecream: ['board', { tour: 'icecream' }], t_fashion: ['board', { tour: 'fashion' }], t_wedding: ['board', { tour: 'wedding' }],
  t_beach: ['board', { tour: 'beach' }], t_xmas: ['board', { tour: 'xmas' }], t_orchard: ['board', { tour: 'orchard' }],
  ev_garden: ['event', { week: 'garden' }], ev_fashion: ['event', { week: 'fashion' }], ev_wedding: ['event', { week: 'wedding' }], ev_beach: ['event', { week: 'beach' }] };
const SFXLIST = [['pick'], ['drop'], ['swap'], ['merge', { level: 1 }], ['merge', { level: 6 }], ['merge5', { level: 3 }], ['mergeMax'], ['combo', { n: 3 }], ['combo', { n: 5 }], ['lucky'], ['discover'], ['spawn'], ['noEnergy'], ['bubble'], ['bubblePop'], ['chest'], ['mystery'],
  ['order'], ['orderDone'], ['coins', { n: 4 }], ['stars', { n: 5 }], ['taskDone'], ['levelUp'], ['daily'], ['event'], ['hint'], ['album'], ['claim'], ['tap'], ['open'], ['close'], ['sell'], ['deny'], ['talk', { who: 'maali', ch: 'a' }],
  ['iceCrack'], ['boxBreak'], ['cobweb'], ['booster', { kind: 'wand' }], ['booster', { kind: 'scissors' }], ['wheelTick', { speed: 0.5 }], ['wheelWin'], ['wheelWin', { big: true }], ['levelWin', { stars: 3 }], ['levelFail'], ['star', { n: 1 }], ['star', { n: 3 }], ['piggy'], ['calendar'], ['heart'], ['movesLow'],
  ['passStep', { n: 2 }], ['passStep', { n: 30 }], ['styleSwap', { style: 'boho' }], ['wardrobe'], ['pet', { kind: 'muri' }], ['pet', { kind: 'kutsu' }], ['eventCur', { n: 4, week: 'beach' }], ['photo'], ['islandNew']];
// Rough role of each sound: 'ui' (taps; at or under the music), 'act' (board actions; a little over it), 'big' (rewards and jingles; music ducks).
const SFXROLE = (n) => /^(tap|open|close|sell|hint|talk|wheelTick|movesLow|deny|pick)$/.test(n) ? 'ui' : /^(mergeMax|lucky|discover|chest|mystery|orderDone|taskDone|levelUp|daily|event|album|claim|wheelWin|levelWin|levelFail|piggy|islandNew|passStep30|heart|boxBreak|star3|combo5)$/.test(n) ? 'big' : 'act';
const ROLE_RANGE = { ui: [-17, 3], act: [-5, 8], big: [3, 11.5] }; // LU over the music's median (400 ms max; short clicks read low)
const REPEAT = [['merge', { level: 1 }], ['merge', { level: 3 }], ['tap'], ['pick'], ['drop'], ['spawn', { level: 1 }], ['order'], ['coins', { n: 4 }], ['bubblePop'], ['orderDone']];

async function phaseC(chromium, chrome, ROOT) {
    const browser = await chromium.launch({ executablePath: chrome.path, args: [...chrome.gl, '--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'] });
  const bad = [];
  const openPage = async (opts, url) => {
    const ctx = await browser.newContext(opts || { viewport: { width: 400, height: 700 } });
    await ctx.addInitScript(() => { window.__nan = 0; const P = AudioParam.prototype; for (const fn of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) { const o = P[fn]; P[fn] = function (v, t, c) { if (!isFinite(v) || !isFinite(t) || (c !== undefined && !isFinite(c))) window.__nan++; return o.apply(this, arguments); }; } });
    if (process.env.DBG) await ctx.addInitScript(() => { // DBG=1: track every started source (where it was made) to find ones that never end
      window.__L = new Map(); let id = 0; const P = AudioScheduledSourceNode.prototype, st = P.start, sp = P.stop, BP = AudioBufferSourceNode.prototype, bst = BP.start;
      BP.start = function (t, off, dur) { const k = ++id; this.__k = k; window.__L.set(k, { t0: t, dur: dur, s: new Error().stack.split('\n').slice(2, 7).map(x => x.trim().replace(/\(?file:.*index.html:/, '@')).join(' < '), c: this.context }); this.addEventListener('ended', () => window.__L.delete(k)); return bst.apply(this, arguments); };
      P.start = function (t) { const k = ++id; this.__k = k; window.__L.set(k, { t0: t, s: new Error().stack.split('\n').slice(2, 7).map(x => x.trim().replace(/\(?file:.*index.html:/, '@')).join(' < '), c: this.context }); this.addEventListener('ended', () => { window.__L.delete(k); if (!(this.context instanceof OfflineAudioContext)) window.__E = (window.__E || 0) + 1; }); if (!(this.context instanceof OfflineAudioContext)) window.__S = (window.__S || 0) + 1; return st.apply(this, arguments); };
      const D = Object.getOwnPropertyDescriptor(P, 'onended'); window.__H = 0; window.__HS = 0;
      Object.defineProperty(P, 'onended', { configurable: true, get() { return D.get.call(this); }, set(f) { window.__HS++; const k = window.__HS, ac = this.context; if (!(ac instanceof OfflineAudioContext)) window.__HL.set(k, new Error().stack.split('\n').slice(2, 6).map(x => x.trim().replace(/\(?file:.*index.html:/, '@')).join(' < ') + ' t=' + ac.currentTime.toFixed(2)); D.set.call(this, f ? function (ev) { window.__H++; window.__HL.delete(k); return f.call(this, ev); } : f); } });
      window.__HL = new Map();
      P.stop = function (t) { const e = window.__L.get(this.__k); if (e) e.t1 = t; return sp.apply(this, arguments); };
    });
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto('file://' + ROOT + '/merge/index.html' + (url || '?nosave=1'));
    await page.waitForFunction(() => window.__saAudio, null, { timeout: 30000 });
    await page.evaluate(() => window.__saAudio.unlock());
    return { ctx, page, errs };
  };
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (PHASEC === '--mix') {
    const secs = +(process.env.MIXSECS || 150), names = args.length ? args : Object.keys(MIXSC);
    const { ctx, page, errs } = await openPage();
    await page.evaluate('window.__an=' + analyse.toString());
    const rows = [];
    console.log(`offline mix, ${secs} s per scene, season ${process.env.SEASON || 'autumn'} (lite = no reverb, single-oscillator voices; phone = 300 Hz high-pass speaker model)`);
    console.log('scene        LUFS  phone   LRA    TP  sub low mid pres air harsh  mud |  lite  phone  dLite | nodes/s full lite');
    for (const nm of names) {
      const sc = MIXSC[nm]; if (!sc) { console.log('unknown', nm); continue; }
      const r = {};
      for (const lite of [false, true]) {
        r[lite ? 'lite' : 'full'] = await page.evaluate(async (a) => { const R = await window.__saAudio.render({ scene: a.sc, secs: a.secs, lite: a.lite, phone: true, season: a.season, restAt: 9999, seed: a.seed }); const o = window.__an(R); o.nps = Math.round(R.made / a.secs); return o; }, { sc, secs, lite, season: process.env.SEASON || 'autumn', seed: +(process.env.SEED || 1) });
      }
      const f = r.full, l = r.lite; rows.push({ nm, f, l });
      console.log(nm.padEnd(11), String(f.lufs).padStart(6), String(f.phone).padStart(6), String(f.lra).padStart(5), String(f.tp).padStart(5), f.bands.map((b, i) => String(b).padStart(i === 3 ? 4 : 3)).join(' '), String(f.harsh).padStart(5), String(f.mud).padStart(5), '|',
        String(l.lufs).padStart(5), String(l.phone).padStart(6), (l.lufs - f.lufs >= 0 ? '+' : '') + (l.lufs - f.lufs).toFixed(1).padStart(5), '|', String(f.nps).padStart(4), String(l.nps).padStart(4));
    }
    const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const mF = med(rows.map(r => r.f.lufs)), mP = med(rows.map(r => r.f.phone));
    const out = rows.filter(r => Math.abs(r.f.lufs - mF) > 1.5 || Math.abs(r.f.phone - mP) > 1.5 || Math.abs(r.l.lufs - r.f.lufs) > 1 || Math.abs(r.l.lufs - mF) > 1.5 || r.f.tp > -1 || r.l.tp > -1);
    console.log(`median ${mF} LUFS, phone ${mP}; spread full ${(Math.max(...rows.map(r => r.f.lufs)) - Math.min(...rows.map(r => r.f.lufs))).toFixed(1)} LU, phone ${(Math.max(...rows.map(r => r.f.phone)) - Math.min(...rows.map(r => r.f.phone))).toFixed(1)} LU, lite ${(Math.max(...rows.map(r => r.l.lufs)) - Math.min(...rows.map(r => r.l.lufs))).toFixed(1)} LU`);
    if (out.length) { console.log('outside +-1.5 LU / lite +-1 LU: ' + out.map(r => r.nm).join(', ')); if (names.length > 3) bad.push('mix'); }
    if (errs.length) { console.log('PAGE ERR ' + errs.join('; ')); bad.push('page'); }
    await ctx.close();
  } else if (PHASEC === '--sfxmix') {
    const { ctx, page, errs } = await openPage();
    await page.evaluate('window.__an=' + analyse.toString() + ';window.__sim=' + similarity.toString());
    const ref = await page.evaluate(async () => { const v = []; for (const sc of [['board', { area: 'aed' }], ['board', { tour: 'flower' }], ['map'], ['level', { chapter: 2 }]]) { const R = await window.__saAudio.render({ scene: sc, secs: 60, restAt: 9999, season: 'autumn', phone: true, seed: 1 }); v.push(window.__an(R).lufs); } return v.sort((a, b) => a - b)[1]; });
    console.log(`sounds alone: loudest 400 ms (M) against the music (${ref} LUFS). Roles: ui ${ROLE_RANGE.ui}, act ${ROLE_RANGE.act}, big ${ROLE_RANGE.big} LU`);
    const out = [];
    for (const lite of [false, true]) {
      const line = [];
      for (const [n, o] of SFXLIST) {
        const r = await page.evaluate(async (a) => { const R = await window.__saAudio.render({ secs: 4.5, lite: a.lite, phone: true, events: [[0.6, a.n, a.o]] }); R.skip = 0.55; return window.__an(R); }, { n, o: o || {}, lite });
        const key = n + (o && (o.n === 30 || o.n === 5 || o.n === 3) && /passStep|combo|star/.test(n) ? (o.n === 30 ? '30' : String(o.n)) : '');
        const role = SFXROLE(key), rel = +(r.mMax - ref).toFixed(1), rg = ROLE_RANGE[role], ok = rel >= rg[0] && rel <= rg[1] && r.tp <= -1;
        line.push(`${(n + (o && o.level ? o.level : o && o.kind ? ':' + o.kind : o && o.big ? '!' : key !== n ? key.slice(n.length) : '')).padEnd(12)}${(rel >= 0 ? '+' : '') + rel.toFixed(1)}${ok ? ' ' : '*'}`);
        if (!ok && !lite) out.push(n + ' ' + rel);
      }
      console.log((lite ? 'lite' : 'full') + ':');
      for (let i = 0; i < line.length; i += 5) console.log('  ' + line.slice(i, i + 5).map(s => s.padEnd(21)).join(''));
    }
    if (out.length) console.log('outside its role range (* above): ' + out.join(', '));
    console.log('repeats (10 slow repeats, spectral similarity; 1 = identical, aim < 0.97):');
    const sims = [];
    for (const [n, o] of REPEAT) {
      const s = await page.evaluate(async (a) => { const ev = [], st = []; for (let i = 0; i < 10; i++) { ev.push([0.3 + i * 3, a.n, a.o]); st.push(0.3 + i * 3); } const R = await window.__saAudio.render({ secs: 31, events: ev }); return window.__sim(R, st, 0.5); }, { n, o: o || {} });
      sims.push(`${(n + (o && o.level ? o.level : '')).padEnd(10)} ${s.toFixed(3)}${s > 0.97 ? '*' : ' '}`);
      if (s > 0.97) bad.push('repeat ' + n);
    }
    for (let i = 0; i < sims.length; i += 5) console.log('  ' + sims.slice(i, i + 5).map(s => s.padEnd(20)).join(''));
    if (errs.length) { console.log('PAGE ERR ' + errs.join('; ')); bad.push('page'); }
    await ctx.close();
  } else if (PHASEC === '--throttle') {
    const rates = (process.env.THROTTLE || '4,6').split(',').map(Number), secs = +(process.env.SECS || 15);
    const SC = {
      board: `M.act.start(); M.act.skipDialog(); while (M.UI.modal) M.UI.closeModal(true); window.__drv = setInterval(() => { try { M.act.skipDialog(); while (M.UI.modal) M.UI.closeModal(true); const g = M.S.board.findIndex(c => c && M.GENERATORS[c.k]); if (g >= 0) M.act.tapGen(g); const f = M.act.find; for (let a = 0; a < 63; a++) { const A = M.S.board[a]; if (!A || A.b) continue; const m = f(A.k, A.l).filter(x => x !== a); if (m.length && M.Game.canMerge(A, M.S.board[m[0]])) { M.act.merge(m[0], a); break; } } } catch (e) {} }, 700);`,
      map: `M.levels.map(); window.__drv = setInterval(() => AU.sfx('tap'), 2500);`,
      level: `M.levels.start(3); window.__drv = setInterval(() => { try { if (!M.levels.botStep()) { M.levels.start(3); } } catch (e) {} }, 800);`,
      event: `M.act.start(); M.extra.open('xWeek'); window.__drv = setInterval(() => AU.sfx('eventCur', { n: 3, week: 'beach' }), 3000);`,
    };
    console.log('scene  CPU  lite  notes  late  lateMax  skips  updMax  look  cpu ms/s  music max  sfx max  underruns  music');
    // Underruns: this machine renders the canvas in software on 4 shared cores, so a few come from the host, not the audio
    // graph (the CPU throttle slows the page's main thread, not the audio thread). UNDER (default 3) per scene is tolerated.
    const UNDER = +(process.env.UNDER || 3);
    const lites = process.env.LITE ? [process.env.LITE === '1'] : [false, true]; // the Poco M7 Pro has 8 cores (full mode); lite is for <= 4 cores
    for (const rate of rates) for (const lite of lites) for (const nm of Object.keys(SC)) {
      const { ctx, page, errs } = await openPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; 23113RKC6G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' }, '?nosave=1&fresh=1');
      await page.evaluate((l) => { const AU = window.__saAudio; AU.setIdle(3600e3); AU.setLite(l); }, lite);
      await page.evaluate('(()=>{const M=window.__mg,AU=window.__saAudio;' + SC[nm] + '})()');
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await sleep(3000);
      await page.evaluate(() => { const ac = window.__saAudio.context; window.__ps0 = null; try { if (ac.playbackStats) window.__ps0 = [ac.playbackStats.underrunEvents, ac.playbackStats.underrunDuration]; } catch (e) {} window.__saAudio.resetTiming(); });
      await sleep(secs * 1000);
      const r = await page.evaluate(() => { const AU = window.__saAudio, s = AU.stats(), ac = AU.context; let u = null; try { if (ac.playbackStats && window.__ps0) u = ac.playbackStats.underrunEvents - window.__ps0[0]; } catch (e) {} clearInterval(window.__drv); return { t: s.timing, u, err: s.err, music: s.music, lite: s.lite, nan: window.__nan }; });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const t = r.t, frac = t.notes ? t.late / t.notes : 0, fail = frac > 0.005 || t.skips > 0 || (r.u || 0) > UNDER || !!r.err || errs.length > 0 || r.nan > 0;
      if (fail) bad.push(nm + '@' + rate);
      console.log(nm.padEnd(6), (rate + 'x').padStart(3), (r.lite ? ' yes' : '  no'), String(t.notes).padStart(6), String(t.late).padStart(5), ((t.lateMax * 1000).toFixed(0) + 'ms').padStart(8), String(t.skips).padStart(6), ((t.updMax * 1000).toFixed(0) + 'ms').padStart(7),
        t.look.toFixed(2).padStart(5), String(t.cpuMs).padStart(9), String(t.cpuMax).padStart(10), String(t.sfxMax).padStart(8), String(r.u === null ? 'n/a' : r.u).padStart(10), ' ', r.music + (r.err ? ' AUDIO ERR ' + r.err : '') + (errs.length ? ' PAGE ERR ' + errs.join('; ') : '') + (fail ? '  FAIL' : ''));
      await ctx.close();
    }
  } else if (PHASEC === '--soak10') {
    const mins = +(process.env.SOAKMIN || 10), rate = +(process.env.THROTTLE || 4);
    const { ctx, page, errs } = await openPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, '?nosave=1&fresh=1');
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.evaluate(() => {
      const M = window.__mg, AU = window.__saAudio, MU = window.__saMusic; AU.setIdle(3600e3); M.act.start();
      // A player's day: the board with merges, the map, levels, the event, the story, a hidden tab, mute, the volume slider.
      const steps = [() => { M.levels.start(2); }, () => { M.levels.map(); }, () => { while (M.UI.modal) M.UI.closeModal(true); M.UI.goScreen('board'); }, () => { M.extra.open('xWeek'); },
        () => { while (M.UI.modal) M.UI.closeModal(true); MU.scene('story'); }, () => { AU.setHidden(true); setTimeout(() => AU.setHidden(false), 1500); }, () => { M.UI.goScreen('board'); MU.scene('board', { tour: ['spa', 'beach', 'xmas'][Math.random() * 3 | 0] }); },
        () => { AU.setMuted(true); setTimeout(() => AU.setMuted(false), 1200); }, () => { AU.setVolume('music', 0); setTimeout(() => AU.setVolume('music', 1), 2000); }, () => { M.levels.start(7); }, () => { MU.scene('title'); }, () => { MU.scene('event', { week: 'fashion' }); }];
      let k = 0; window.__soak = setInterval(() => { try { steps[k++ % steps.length](); } catch (e) {} }, 9000);
      window.__drv = setInterval(() => { try { if (M.levels.state && !M.levels.state.over && M.UI.scr === 'level') M.levels.botStep(); else { const g = M.S.board.findIndex(c => c && M.GENERATORS[c.k]); if (g >= 0) M.act.tapGen(g); M.act.autoMerge(); } AU.sfx(['tap', 'coins', 'pick', 'merge'][Math.random() * 4 | 0], { level: 1 + (Math.random() * 8 | 0) }); } catch (e) {} }, 700);
    });
    const heap = async () => { await page.evaluate(() => window.gc && window.gc()); await sleep(300); const h = await cdp.send('Runtime.getHeapUsage'); return +(h.usedSize / 1048576).toFixed(1); };
    const h0 = await heap(), rows = [];
    console.log(`soak ${mins} min, CPU ${rate}x: minute  live  made  heapMB  music`);
    for (let m = 1; m <= mins; m++) { await sleep(60000); const s = await page.evaluate(() => window.__saAudio.stats()); const h = await heap(); rows.push([m, s.live, s.made, h]); console.log(`  ${String(m).padStart(2)}  ${String(s.live).padStart(5)}  ${String(s.made).padStart(7)}  ${String(h).padStart(6)}  ${s.music} ${s.sleep ? '(asleep: ' + s.sleep + ')' : ''}${s.err ? ' AUDIO ERR ' + s.err : ''}`); }
    // Stop: back to the title (the game itself makes no more sounds there), the music off; then every source must end.
    await sleep(2000);
    await page.evaluate(() => { clearInterval(window.__soak); clearInterval(window.__drv); const M = window.__mg; while (M.UI.modal) M.UI.closeModal(true); M.levels.map(); window.__saAudio.setHidden(false); window.__saAudio.setMuted(false); window.__saAudio.setVolume('music', 1); window.__names0 = window.__saAudio.stats().names; setTimeout(() => window.__saMusic.stop(), 100); });
    // Every source must end: wait up to 20 s (the longest tail is a few seconds; a leak would never drain).
    let live8 = 0; for (let i = 0; i < 20; i++) { await sleep(1000); const l = await page.evaluate(() => window.__saAudio.stats().live); if (i === 7) live8 = l; if (i >= 7 && l <= 0) break; }
    // Fell asleep (15 s of quiet) with a tail still pending on the frozen clock: wake it (as a touch would) and let it end.
    if (await page.evaluate(() => window.__saAudio.stats().live > 0 && window.__saAudio.context.state === 'suspended')) { await page.evaluate(() => window.__saAudio.poke()); await sleep(5000); }
    const end = await page.evaluate(() => { const s = window.__saAudio.stats(), n0 = window.__names0, d = Object.keys(s.names).filter(k => s.names[k] !== n0[k]).map(k => k + ' x' + (s.names[k] - (n0[k] || 0))); return { live: s.live, err: s.err, nan: window.__nan, state: s.state, music: s.music, after: d.join(' ') }; }), h1 = await heap();
    if (process.env.DBG) console.log(await page.evaluate(() => { const ac = window.__saAudio.context; return 'now ' + ac.currentTime.toFixed(2) + ' started ' + window.__S + ' ended ' + window.__E + ' AU live ' + window.__saAudio.stats().live + ' handlers set ' + window.__HS + ' run ' + window.__H + '\n' + [...window.__HL.values()].slice(0, 12).join('\n') + '\n' + [...window.__L.values()].filter(e => e.c === ac).map(e => `  t0 ${e.t0 && e.t0.toFixed(2)} dur ${e.dur} t1 ${e.t1 && e.t1.toFixed(2)} ${e.s}`).join('\n'); }));
    const h1m = rows.length ? rows[0][3] : h0, grow = h1 - h1m;
    console.log(`after stop: live ${live8} after 8 s, ${end.live} at the end (${end.state}, music '${end.music}'${end.after ? ', game sounds since: ' + end.after : ''}), heap ${h0} at start, ${h1m} after 1 min -> ${h1} MB (${grow >= 0 ? '+' : ''}${grow.toFixed(1)})${end.err ? ' AUDIO ERR ' + end.err : ''}${end.nan ? ' NaN x' + end.nan : ''}${errs.length ? ' PAGE ERR ' + errs.join('; ') : ''}`);
    if (end.live > 2 || grow > 3 || end.err || end.nan || errs.length) bad.push('soak');
    await ctx.close();
  } else if (PHASEC === '--life') {
    const PH = process.env.PHONE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : null;
    const { ctx, page, errs } = await openPage(PH, '?nosave=1&fresh=1');
    const st = () => page.evaluate(() => { const s = window.__saAudio.stats(); return { state: s.state, sleep: s.sleep, ready: s.ready, music: s.music, page: s.page, mus: s.musicGain, notes: s.timing.notes, err: s.err }; });
    const checks = [];
    const ok = (name, cond, info) => { checks.push([name, !!cond, info]); if (!cond) bad.push(name); };
    await page.evaluate(() => { window.__saMusic.scene('board', { area: 'aed' }); window.__saAudio.meter(true); });
    await sleep(2500);
    let s = await st(); ok('starts running', s.state === 'running' && s.music === 'board:aed', JSON.stringify(s));
    // a loud start check: the loudest 400 ms in the 1.5 s after a wake against the next 6 s
    const wakeLoud = async () => { await page.evaluate(() => window.__saAudio.meter(true)); await sleep(1500); const a = await page.evaluate(() => window.__saAudio.stats().meter); await page.evaluate(() => window.__saAudio.meter(true)); await sleep(6000); const b = await page.evaluate(() => window.__saAudio.stats().meter); return { a: a && a.mMax, b: b && b.mMax }; };
    // hidden page
    await page.evaluate(() => window.__saAudio.setHidden(true)); await sleep(600); s = await st(); ok('hidden -> suspended', s.state === 'suspended', s.state);
    await page.evaluate(() => window.__saAudio.setHidden(false)); await sleep(150); s = await st(); ok('shown -> running, page gain fades in', s.state === 'running' && s.page < 0.6, `state ${s.state} page ${s.page}`);
    let w = await wakeLoud(); ok('no loud start after show', w.a <= w.b + 1, JSON.stringify(w));
    // idle
    await page.evaluate(() => window.__saAudio.setIdle(3000)); await sleep(3000 + 4600); s = await st(); ok('idle -> asleep (suspended)', s.state === 'suspended' && s.sleep === 'idle', `${s.state} ${s.sleep}`);
    const idleSfx = await page.evaluate(() => window.__saAudio.sfx('spawn')); await sleep(300); s = await st(); ok('a game sound while idle does not wake it', idleSfx === false && s.state === 'suspended', `sfx ${idleSfx} ${s.state}`);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown'))); await sleep(300); s = await st(); ok('touch wakes it', s.state === 'running' && s.sleep === '', `${s.state} ${s.sleep}`);
    await page.evaluate(() => window.__saAudio.setIdle(3600e3));
    w = await wakeLoud(); ok('no loud start after idle wake', w.a <= w.b + 1, JSON.stringify(w));
    // mute
    await page.evaluate(() => window.__saAudio.setMuted(true)); await sleep(800); s = await st();
    const mutedSfx = await page.evaluate(() => window.__saAudio.sfx('tap'));
    ok('mute -> suspended, sounds refused', s.state === 'suspended' && s.sleep === 'silent' && mutedSfx === false, `${s.state} ${s.sleep} sfx ${mutedSfx}`);
    await page.evaluate(() => window.__saAudio.setMuted(false)); await sleep(400); s = await st(); ok('unmute -> running', s.state === 'running' && !s.sleep, `${s.state} ${s.sleep}`);
    // both volumes 0
    await page.evaluate(() => { window.__saAudio.setVolume('music', 0); window.__saAudio.setVolume('sfx', 0); }); await sleep(800); s = await st(); ok('both volumes 0 -> suspended', s.state === 'suspended' && s.sleep === 'silent', `${s.state} ${s.sleep}`);
    await page.evaluate(() => { window.__saAudio.setVolume('sfx', 1); }); await sleep(400);
    await page.evaluate(() => window.__saAudio.resetTiming()); await sleep(5000); s = await st();
    ok('music volume 0: running for sounds, no notes written, bus exactly 0', s.state === 'running' && s.notes === 0 && s.mus === 0, `${s.state} notes ${s.notes} gain ${s.mus}`);
    await page.evaluate(() => window.__saAudio.setVolume('music', 1)); await sleep(3000); s = await st(); ok('music volume back -> notes again', s.notes > 0 && s.mus > 0.3, `notes ${s.notes} gain ${s.mus}`);
    // quiet (no music, no sounds)
    await page.evaluate(() => window.__saMusic.stop()); await sleep(16500); s = await st(); ok('no music, no sounds for 15 s -> asleep', s.state === 'suspended' && s.sleep === 'quiet', `${s.state} ${s.sleep}`);
    const q = await page.evaluate(() => window.__saAudio.sfx('tap')); await sleep(300); s = await st(); ok('a sound wakes it and plays', q === true && s.state === 'running', `sfx ${q} ${s.state}`);
    // an outside suspend (iPhone interruption: a call, Siri) -> the next touch resumes
    await page.evaluate(() => window.__saMusic.scene('map')); await sleep(1000);
    await page.evaluate(() => window.__saAudio.context.suspend()); await sleep(300); s = await st(); ok('interrupted -> suspended', s.state === 'suspended', s.state);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown'))); await sleep(400); s = await st(); ok('touch resumes after an interruption', s.state === 'running', s.state);
    // fast scene switches: one song left playing
    await page.evaluate(async () => { const M = window.__saMusic, L = [['board', { tour: 'spa' }], ['map'], ['event', { week: 'beach' }], ['level', { chapter: 2 }], ['title'], ['board', { tour: 'beach' }]]; for (let i = 0; i < 24; i++) { M.scene(...L[i % L.length]); await new Promise(r => setTimeout(r, 40)); } M.scene('board', { tour: 'xmas' }); });
    await sleep(4500); const eng = await page.evaluate(() => window.__saAudio.stats().engines); ok('fast switches: one song audible after 4.5 s', eng === 1, 'audible engines ' + eng);
    const nan = await page.evaluate(() => window.__nan); ok('no NaN in AudioParams, no errors', !nan && !errs.length && !(await st()).err, `NaN ${nan} ${errs.join('; ')}`);
    for (const [n, c, i] of checks) console.log((c ? 'ok   ' : 'FAIL ') + n.padEnd(64) + ' ' + (i || ''));
    await ctx.close();
  }
  await browser.close();
  console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'PASS');
  process.exit(bad.length ? 1 : 0);
}

if (PHASEC) phaseC(chromium, chrome, ROOT).catch(e => { console.error(e); process.exit(1); });
// Every sound in a loop (the sound bank alone), and a busy play session (rapid merges over the music).
const ALL = `const L=[['pick'],['drop'],['swap'],['merge',{level:1}],['merge',{level:4}],['merge',{level:8}],['mergeMax',{level:10}],['merge5',{level:3}],['combo',{n:3}],['combo',{n:5}],['lucky'],['discover'],['mystery'],['event'],['hint'],['album'],['claim'],['spawn'],['noEnergy'],['bubble'],['bubblePop'],['chest'],['order'],['orderDone'],['coins',{n:4}],['stars',{n:5}],['taskDone'],['levelUp'],['daily'],['tap'],['open'],['close'],['sell'],['deny'],['talk',{who:'maali',ch:'a'}],['talk',{who:'muri',ch:'i'}],['talk',{who:'ants',ch:'o'}]];let i=0;setInterval(()=>{const x=L[i++%L.length];AU.sfx(x[0],x[1])},700);`;
const PLAY = `let k=0;setInterval(()=>{k++;AU.sfx('pick');setTimeout(()=>AU.sfx(k%3?'merge':'drop',{level:1+k%9}),250);if(k%4==0)setTimeout(()=>AU.sfx('spawn'),500);if(k%9==0)setTimeout(()=>AU.sfx('orderDone'),600);if(k%13==0)setTimeout(()=>AU.sfx('coins',{n:5}),900)},900);`;
const RAPID = `setInterval(()=>{for(let j=0;j<12;j++)setTimeout(()=>AU.sfx('merge',{level:1+j}),j*25);AU.sfx('mergeMax');AU.sfx('levelUp');AU.sfx('coins',{n:6})},1500);`;
const COMBO = `let k=0;setInterval(()=>{k++;const n=k%14;if(!n)return;AU.sfx(n%6==5?'merge5':'merge',{level:1+n%5});if(n>2&&n%3==0)setTimeout(()=>AU.sfx('combo',{n}),120);if(n==13)setTimeout(()=>AU.sfx('lucky'),300)},380);`;
const TALK = `const s='Tere, kullake! Kas sa aitad mul pagariäri korda teha?';let i=0,w=['maali','ants','muri','liisa','peeter','mina'];setInterval(()=>{const c=s[i%s.length];AU.sfx('talk',{who:w[Math.floor(i/s.length)%6],ch:c});i++},45);`;
// v3 level mode: the new sounds in a loop; the wheel (ticks slowing down, then a prize); a level session over the
// level music (merges, obstacles, a booster, the last moves going tense, then win or fail with stars).
const ALL3 = `const L=[['iceCrack'],['boxBreak'],['cobweb'],['booster',{kind:'wand'}],['booster',{kind:'scissors'}],['booster',{kind:'shuffle'}],['booster',{kind:'moves5'}],['wheelWin'],['wheelWin',{big:true}],['levelWin',{stars:1}],['levelWin',{stars:3}],['levelFail'],['star',{n:1}],['star',{n:2}],['star',{n:3}],['piggy'],['calendar'],['heart'],['movesLow']];let i=0;const go=()=>{const x=L[i++%L.length];AU.sfx(x[0],x[1]);setTimeout(go,/level|wheelWin|piggy|levelFail/.test(x[0])?2600:900)};go();`;
const WHEEL = `const spin=()=>{let t=0,d=40;for(let k=0;k<40;k++){const s=1-k/40;setTimeout(()=>AU.sfx('wheelTick',{speed:s}),t);t+=d;d*=1.07}setTimeout(()=>AU.sfx('wheelWin',{big:Math.random()<0.3}),t+250);setTimeout(spin,t+3000)};spin();`;
const LEVEL = `let k=0;setInterval(()=>{k++;const n=k%40;AU.sfx('pick');setTimeout(()=>AU.sfx('merge',{level:1+k%7}),220);if(k%5==0)setTimeout(()=>AU.sfx(['iceCrack','boxBreak','cobweb'][k%3]),400);if(n==12)AU.sfx('booster',{kind:'wand'});if(n==28){M.mood('tense');AU.sfx('movesLow')}if(n==30||n==32)AU.sfx('movesLow');if(n==34){M.mood('normal');AU.sfx(k%80<40?'levelWin':'levelFail',{stars:1+k%3})}if(n==36)AU.sfx('star',{n:1});if(n==37)AU.sfx('star',{n:2});if(n==38)AU.sfx('star',{n:3})},800);`;
// v3 phase B sounds, and a soak that keeps changing everything.
const ALL4 = `const L=[['passStep',{n:1}],['passStep',{n:2}],['passStep',{n:5}],['passStep',{n:30}],['styleSwap',{style:'boho'}],['styleSwap',{style:'minimal'}],['styleSwap',{style:'romantic'}],['wardrobe'],['pet',{kind:'muri'}],['pet',{kind:'kutsu'}],['pet',{kind:'janku'}],['eventCur',{n:3,week:'garden'}],['eventCur',{n:4,week:'fashion'}],['eventCur',{n:5,week:'wedding'}],['eventCur',{n:3,week:'beach'}],['photo'],['islandNew']];let i=0;const go=()=>{const x=L[i++%L.length];AU.sfx(x[0],x[1]);setTimeout(go,/islandNew|passStep/.test(x[0])?2200:900)};go();`;
const SOAK = `const SC=[['board',{tour:'flower'}],['event',{week:'fashion'}],['board',{area:'aed',tour:'nope'}],['level',{chapter:3}],['board',{tour:'xmas'}],['event',{week:'zzz'}],['map'],['board',{tour:{theme:'beach'}}],['event',{week:'wedding'}],['story'],['board',{tour:7}],['title'],['bogus',{x:1}],['event',{week:'beach'}],['board',{tour:'spa'}]],SE=['winter','spring','summer','autumn','sügis','nonsense','auto'],SX=['passStep','styleSwap','wardrobe','pet','eventCur','photo','islandNew','merge','nosuchsound','orderDone'];
let k=0;window.__soak=setInterval(()=>{k++;M.scene(SC[k%SC.length][0],SC[k%SC.length][1]);M.season(SE[k%SE.length]);for(let j=0;j<4;j++)setTimeout(()=>AU.sfx(SX[(k*4+j)%SX.length],{n:j+1,kind:['muri','kutsu','janku','x'][j],style:['boho','minimal','romantic',null][j]}),j*400);AU.sfx('styleSwap','boho');AU.sfx('pet',null);AU.sfx();},2500);`;
const SCENES = {
  title: { music: ['title'] },
  pagariari: { music: ['board', { area: 'pagariari' }] },
  aed: { music: ['board', { area: 'aed' }] },
  sadam: { music: ['board', { area: 'sadam' }] },
  tuuleveski: { music: ['board', { area: 'tuuleveski' }] },
  majakas: { music: ['board', { area: 'majakas' }] },
  saladus: { music: ['board', { area: 'saladus' }] },
  story: { music: ['story'] },
  sfx: { music: [null], js: ALL },
  mix: { music: ['board', { area: 'pagariari' }], js: PLAY },
  rapid: { music: ['board', { area: 'aed' }], js: RAPID },
  talk: { music: ['story'], js: TALK },
  combo: { music: ['board', { area: 'sadam' }], js: COMBO },
  map: { music: ['map'] },
  candy: { music: ['level', { chapter: 1 }] },
  meadow: { music: ['level', { chapter: 2 }] },
  berry: { music: ['level', { chapter: 3 }] },
  cliffs: { music: ['level', { chapter: 4 }] },
  winter: { music: ['level', { chapter: 5 }] },
  lavender: { music: ['level', { chapter: 6 }] },
  tense: { music: ['level', { chapter: 2, tense: true }] },
  sfx3: { music: [null], js: ALL3 },
  wheel: { music: ['map'], js: WHEEL },
  level: { music: ['level', { chapter: 1 }], js: LEVEL },
  t_flower: { music: ['board', { area: 'aed', tour: 'flower' }] },
  t_spa: { music: ['board', { tour: 'spa' }] },
  t_icecream: { music: ['board', { tour: 'icecream' }] },
  t_fashion: { music: ['board', { tour: 'fashion' }] },
  t_wedding: { music: ['board', { tour: 'wedding' }] },
  t_beach: { music: ['board', { tour: 'beach' }] },
  t_xmas: { music: ['board', { tour: 'xmas' }] },
  t_orchard: { music: ['board', { tour: 'orchard' }] },
  ev_garden: { music: ['event', { week: 'garden' }] },
  ev_fashion: { music: ['event', { week: 'fashion' }] },
  ev_wedding: { music: ['event', { week: 'wedding' }] },
  ev_beach: { music: ['event', { week: 'beach' }] },
  s_winter: { music: ['board', { area: 'aed' }], season: 'winter' },
  s_spring: { music: ['board', { area: 'aed' }], season: 'spring' },
  s_summer: { music: ['board', { area: 'aed' }], season: 'summer' },
  s_autumn: { music: ['board', { area: 'aed' }], season: 'autumn' },
  sfx4: { music: [null], js: ALL4 },
  soak: { music: ['board', { tour: 'flower' }], js: SOAK, secs: 60, soak: true },
};
const f1 = v => v === undefined || v === null ? '    -' : (v >= 0 ? ' ' : '') + v.toFixed(1).padStart(5);
if (!PHASEC) (async () => {
  const browser = await chromium.launch({ executablePath: chrome.path, args: [...chrome.gl, '--autoplay-policy=no-user-gesture-required'] });
  const names = only.length ? only : Object.keys(SCENES), bad = [];
  console.log('scene         LUFS   mMax     TP  sub low mid pres air |  n/s drop | section / notes');
  for (const name of names) {
    const S = SCENES[name]; if (!S) { console.log('unknown scene', name); bad.push(name); continue; }
    const ctx = await browser.newContext(process.env.PHONE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 400, height: 700 } });
    await ctx.addInitScript(() => { // count NaN or Infinity written to any AudioParam
      window.__nan = 0; const P = AudioParam.prototype;
      for (const fn of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) { const o = P[fn]; P[fn] = function (v, t, c) { if (!isFinite(v) || !isFinite(t) || (c !== undefined && !isFinite(c))) window.__nan++; return o.apply(this, arguments); }; }
    });
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto('file://' + ROOT + '/merge/index.html');
    await sleep(500);
    await page.evaluate(l => { const AU = window.__saAudio; if (l) AU.setLite(l === '1'); AU.unlock(); }, process.env.LITE || '');
    await page.evaluate(s => window.__saMusic.season(s), S.season || process.env.SEASON || 'autumn');
    await page.evaluate(m => window.__saMusic.scene(m[0], m[1]), S.music);
    if (S.js) await page.evaluate('(()=>{const AU=window.__saAudio,M=window.__saMusic;' + S.js + '})()');
    await sleep(2500);
    await page.evaluate(() => window.__saAudio.meter(true));
    await sleep((S.secs || SECS) * 1000);
    const r = await page.evaluate(() => window.__saAudio.stats());
    const m = r.meter || {}, b = m.bands || {};
    const peakBad = m.tp > -1, nan = await page.evaluate(() => window.__nan);
    let soakNote = '';
    if (S.soak) { // stop everything, let the tails ring out, then nothing may still be playing
      const liveBefore = r.live;
      await page.evaluate(() => { clearInterval(window.__soak); window.__saMusic.stop(); });
      await sleep(8000);
      const after = await page.evaluate(() => window.__saAudio.stats());
      soakNote = ` | soak live ${liveBefore} -> ${after.live} after stop, made ${after.made}` + (after.err ? ' AUDIO ERR ' + after.err : '');
      if (after.live > 2 || after.err) bad.push(name);
    }
    if (r.err || errs.length || peakBad || !r.ready || nan) bad.push(name);
    console.log(name.padEnd(11), f1(m.lufs), f1(m.mMax), f1(m.tp), ['sub', 'low', 'mid', 'pres', 'air'].map(k => String(b[k] === undefined ? '-' : b[k]).padStart(k.length > 3 ? 4 : 3)).join(' '), '|',
      String(r.nodeRate).padStart(4), String(r.dropped).padStart(4), '|', (r.section || '-') + (r.lite ? ' [lite]' : '') + ' ' + r.season + (r.ready ? '' : ' NOT READY ' + r.state) + (nan ? ' NaN x' + nan : '') + soakNote + (peakBad ? ' PEAK > -1 dBFS' : '') + (r.err ? ' | AUDIO ERR ' + r.err : '') + (errs.length ? ' | PAGE ERR ' + errs.join('; ') : ''));
    await ctx.close();
  }
  await browser.close();
  console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'PASS');
  process.exit(bad.length ? 1 : 0);
})();
