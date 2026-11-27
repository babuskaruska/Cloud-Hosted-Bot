// Lanternhold sound: every sound is synthesized here with Web Audio (no audio files).
// Layout: helpers and the one-shot sound library S, the voice manager play() (per-kind voice
// limits, stealing, density-aware gain, jittered timing), the ambient beds (wind, fire, drone),
// the crowd bed (a horde on the road), the land soundscapes and land-event swells, the reactive
// music (pads + a step sequencer whose layers follow the danger, with a sting and a theme per boss),
// pause and page-hide handling, and the master chain (glue, limiter, soft clipper).
const AU = (function () {
  const api = { ready: false, muted: false, intensity: 0, unlock: unlock, setMuted: setMuted, setPaused: setPaused, play: play, setAmbience: setAmbience, update: update, setVolume: setVolume, stats: stats, setScene: setScene, storyLine: storyLine, scene: () => SC.cur, describe: (bio) => { const lf = bio ? landFor(bio) : null; return describe(lf ? lf.L : LM.def); }, has: (n) => typeof n === 'string' && hasOwn(DEF, n) };

  let ctx = null, sr = 44100;
  let nMaster = null, nMute = null, nSfx = null, nAmb = null, nMusic = null, nRevIn = null;
  let nSting = null, nPad = null, nSeq = null, nMusDuck = null, nCrowd = null, nCrowdDuck = null, nPage = null, nUi = null, nLand = null, nEvt = null, nBeast = null;
  const PZ = { on: false, sfx: null, amb: null, crowd: null, pad: null, seq: null, rev: null, sting: null };
  let bufWhite = null, bufPink = null, bufBrown = null;
  let V = null;
  const shapeCurves = {};
  const tgt = { fire: 0, wind: 0, tension: 0 }, cur = { fire: 0, wind: 0, tension: 0 }, app = { fire: -1, wind: -1, tension: -1 };
  const bed = { windG: null, gustG: null, windLP: [], whG: null, whF: null, fireG: null, popBus: null, droneG: null, droneLP: null, timer: 0, popAcc: 0 };
  const mus = { nextChord: 0, chord: 0, lastNote: -1, playC: null, pendC: null, pendAt: 0 };
  // Phones get fewer simultaneous voices and a sparser crowd.
  const LOW = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const ST = { req: 0, played: 0, gap: 0, cap: 0, kind: 0, stolen: 0, peak: 0, seq: 0, crowd: 0, amb: 0, err: '', names: {} };

  const rnd = Math.random;
  const rr = (a, b) => a + (b - a) * rnd();
  const cl = (x, a, b) => (x < a ? a : x > b ? b : x);
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function gn(dest, v) { const g = ctx.createGain(); g.gain.value = v === undefined ? 0 : v; if (dest) g.connect(dest); return g; }
  function flt(dest, type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; if (dest) b.connect(dest); return b; }
  function panNode(pan, dest) {
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = cl(pan, -1, 1); if (dest) p.connect(dest); return p; }
    return gn(dest, 1);
  }
  function shape(dest, drive) {
    const ws = ctx.createWaveShaper();
    let c = shapeCurves[drive];
    if (!c) { c = new Float32Array(1024); const n = Math.tanh(drive); for (let i = 0; i < 1024; i++) c[i] = Math.tanh(drive * (i / 511.5 - 1)) / n; shapeCurves[drive] = c; }
    ws.curve = c; ws.oversample = 'none'; if (dest) ws.connect(dest); return ws; // inputs are already low-passed, so no oversampling
  }
  function keep(src, e) { if (V && e > V.lastT) { V.last = src; V.lastT = e; } }
  function osc(type, f, t, dur, dest) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (dest) o.connect(dest);
    const e = t + dur + 0.03; o.start(t); o.stop(e); keep(o, e); return o;
  }
  function noi(t, dur, dest, buf, rate) {
    const s = ctx.createBufferSource(); s.buffer = buf || bufWhite; s.loop = true; if (rate) s.playbackRate.value = rate; if (dest) s.connect(dest);
    const e = t + dur + 0.03; s.start(t, rnd() * (s.buffer.duration - 0.1)); s.stop(e); keep(s, e); return s;
  }
  function loopSrc(buf, dest, rate) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; if (rate) s.playbackRate.value = rate; s.connect(dest);
    s.start(ctx.currentTime, rnd() * (buf.duration - 0.1)); return s;
  }
  function loopOsc(type, f, dest) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (dest) o.connect(dest); o.start(); return o; }

  function ad(param, t, peak, a, d) { param.setValueAtTime(0.0001, t); param.linearRampToValueAtTime(Math.max(0.0002, peak), t + a); param.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function sw(param, t, f0, f1, dur) { param.setValueAtTime(Math.max(1, f0), t); param.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); }

  function grains(dest, t, n, span, peak, dMin, dMax, f0, f1, q, shp) {
    const g = gn(dest, 0), f = flt(g, 'bandpass', (f0 + f1) * 0.5, q || 4);
    const ts = [];
    for (let i = 0; i < n; i++) { let u = rnd(); if (shp === 1) u = u * u; else if (shp === 2) u = 1 - u * u; ts.push(u * span); }
    ts.sort((a, b) => a - b);
    let end = t + 0.01;
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < n; i++) {
      const ti = t + ts[i], room = i < n - 1 ? ts[i + 1] - ts[i] - 0.004 : 9;
      if (room < 0.004) continue;
      const d = Math.min(rr(dMin, dMax), room), a = peak * rr(0.35, 1) * (shp === 1 ? 1 - 0.6 * ts[i] / span : 1);
      f.frequency.setValueAtTime(rr(f0, f1), ti);
      g.gain.setValueAtTime(0.0001, ti);
      g.gain.linearRampToValueAtTime(Math.max(0.0002, a), ti + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.0001, ti + 0.0015 + d);
      end = ti + 0.0015 + d;
    }
    noi(t, end - t + 0.02, f);
    return end;
  }

  function voice(pan, gain, send, bus) {
    const out = gn(null, gain);
    const tail = panNode(pan, bus || nSfx); out.connect(tail);
    let wet = null;
    if (send > 0) { wet = gn((bus || nSfx).rv || nRevIn, send); tail.connect(wet); } // each bus's echo follows its volume
    return { out: out, tail: tail, wet: wet, last: null, lastT: 0 };
  }
  function finishVoice(v) {
    const done = () => { try { v.out.disconnect(); v.tail.disconnect(); if (v.wet) v.wet.disconnect(); } catch (e) {} };
    if (v.last) v.last.onended = done; else done();
    if (V === v) V = null;
  }

  function makeBuffers() {
    const mk = (secs, fill) => {
      const len = (sr * secs) | 0, fade = (sr * 0.06) | 0, x = new Float32Array(len + fade);
      fill(x);
      let pk = 0; for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
      const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0), k = 1 / (pk || 1);
      for (let i = 0; i < len; i++) d[i] = x[i] * k;
      for (let i = 0; i < fade; i++) { const u = i / fade; d[i] = (x[i] * u + x[len + i] * (1 - u)) * k; }
      return b;
    };
    bufWhite = mk(2, (x) => { for (let i = 0; i < x.length; i++) x[i] = rnd() * 2 - 1; });
    bufPink = mk(5, (x) => {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < x.length; i++) {
        const w = rnd() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        x[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
      }
    });
    bufBrown = mk(5, (x) => { let b = 0; for (let i = 0; i < x.length; i++) { b = (b + 0.02 * (rnd() * 2 - 1)) / 1.02; x[i] = b; } });
  }
  function makeImpulse() {
    const len = (sr * 2.4) | 0, b = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      const e1 = 0.17 + ch * 0.021, e2 = 0.31 - ch * 0.027;
      for (let i = 0; i < len; i++) {
        const t = i / sr, w = rnd() * 2 - 1;
        const a = cl(0.2 + t * 0.42, 0, 0.94);
        lp += (w - lp) * (1 - a);
        let env = Math.exp(-t * 2.5) * (t < 0.022 ? t / 0.022 : 1);
        if (t > e1 && t < e1 + 0.02) env += 0.5 * Math.exp(-(t - e1) * 160);
        if (t > e2 && t < e2 + 0.025) env += 0.32 * Math.exp(-(t - e2) * 130);
        d[i] = lp * env * (1 + a * 2.2);
      }
    }
    return b;
  }

  function ding(d, t, f, peak) {
    const g = gn(d); osc('sine', f, t, 0.3, g); ad(g.gain, t, peak, 0.002, 0.2);
    const g2 = gn(d); osc('sine', f * 2.42, t, 0.15, g2); ad(g2.gain, t, peak * 0.3, 0.001, 0.06);
  }
  function whoomp(d, t, peak, len) {
    const w = gn(d), wf = flt(w, 'lowpass', 300, 1.2); noi(t, len + 0.2, wf);
    wf.frequency.setValueAtTime(180, t); wf.frequency.exponentialRampToValueAtTime(1100, t + len * 0.25); wf.frequency.exponentialRampToValueAtTime(320, t + len);
    ad(w.gain, t, peak, len * 0.18, len * 0.9);
    const g = gn(d), o = osc('sine', 70, t, len * 0.7, g); sw(o.frequency, t, 62, 115, len * 0.5); ad(g.gain, t, peak * 0.6, len * 0.15, len * 0.5);
  }
  function hornNote(d, t, f, dur, peak, bright) {
    const env = gn(d), body = flt(env, 'peaking', 480, 1.0); body.gain.value = 5;
    const lp = flt(body, 'lowpass', 300, 0.8), cents = [-8, 0, 7], oscs = [], vib = gn(null, 0);
    for (let i = 0; i < 3; i++) { const o = osc('sawtooth', f, t, dur + 0.6, gn(lp, 0.33)); o.detune.value = cents[i]; vib.connect(o.detune); oscs.push([o, f]); }
    const sub = osc('triangle', f / 2, t, dur + 0.6, gn(lp, 0.25)); vib.connect(sub.detune); oscs.push([sub, f / 2]);
    osc('sine', 5.3, t, dur + 0.6, vib); vib.gain.setValueAtTime(0, t + dur * 0.35); vib.gain.linearRampToValueAtTime(9, t + dur * 0.8);
    const a = Math.min(0.28, dur * 0.25);
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(peak * 0.6, t + a); env.gain.linearRampToValueAtTime(peak, t + dur * 0.75); env.gain.setTargetAtTime(0.0001, t + dur, 0.11);
    lp.frequency.setValueAtTime(260, t); lp.frequency.linearRampToValueAtTime(900 * bright, t + a); lp.frequency.linearRampToValueAtTime(1700 * bright, t + dur * 0.75); lp.frequency.setTargetAtTime(350, t + dur, 0.14);
    const n = gn(env, 0.03), nf = flt(n, 'bandpass', 1300, 1); noi(t, dur + 0.5, nf);
    return oscs;
  }

  const S = {};
  S.bow = (d, t) => {
    const k = rr(0.92, 1.1);
    const g = gn(d), bp = flt(g, 'bandpass', 900 * k, 1.1);
    const o = osc('triangle', 210 * k, t, 0.2, bp); sw(o.frequency, t, 230 * k, 118 * k, 0.11);
    const o2 = osc('sawtooth', 425 * k, t, 0.12, gn(bp, 0.25)); sw(o2.frequency, t, 470 * k, 240 * k, 0.08);
    ad(g.gain, t, 0.9, 0.002, 0.14);
    const w = gn(d), wf = flt(w, 'bandpass', 1800, 1.3); noi(t, 0.22, wf); sw(wf.frequency, t, 2400, 700, 0.18); ad(w.gain, t + 0.005, 0.22, 0.02, 0.15);
  };
  S.arrowHit = (d, t) => {
    const k = rr(0.85, 1.2);
    const g = gn(d), o = osc('sine', 170 * k, t, 0.12, g); sw(o.frequency, t, 190 * k, 70 * k, 0.07); ad(g.gain, t, 0.55, 0.002, 0.08);
    const n = gn(d), nf = flt(n, 'bandpass', 520 * k, 5); noi(t, 0.08, nf); ad(n.gain, t, 0.5, 0.001, 0.05);
    const c = gn(d), cf = flt(c, 'highpass', 2600); noi(t, 0.04, cf); ad(c.gain, t, 0.16, 0.0005, 0.014);
  };
  S.cannon = (d, t, p) => {
    const k = rr(0.9, 1.08) * (1 - 0.18 * p), sh = shape(d, 2.2);
    const g = gn(sh), o = osc('sine', 120 * k, t, 0.9, g); sw(o.frequency, t, 125 * k, 33 * k, 0.4); ad(g.gain, t, 1.0, 0.003, 0.7);
    const g2 = gn(sh), o2 = osc('triangle', 64 * k, t, 0.6, g2); sw(o2.frequency, t, 70 * k, 28 * k, 0.5); ad(g2.gain, t, 0.5, 0.004, 0.5);
    const b = gn(sh), bf = flt(b, 'lowpass', 1200, 0.7); noi(t, 0.7, bf); sw(bf.frequency, t, 1600, 140, 0.45); ad(b.gain, t, 0.7, 0.002, 0.5);
    const c = gn(d), cf = flt(c, 'highpass', 1100); noi(t, 0.1, cf); ad(c.gain, t, 0.5, 0.0008, 0.05);
    const r = gn(d), rf = flt(r, 'lowpass', 230, 0.5); noi(t + 0.05, 1.5, rf, bufBrown); ad(r.gain, t + 0.05, 0.5, 0.12, 1.2);
    const m = gn(d), mf = flt(m, 'bandpass', 260 * k, 1.1); noi(t, 0.45, mf, bufPink); ad(m.gain, t, 0.55, 0.002, 0.28); // a body a phone speaker can play
  };
  S.explode = (d, t, p) => {
    const k = rr(0.88, 1.12) * (1 - 0.25 * p), L = 1 + 0.5 * p, sh = shape(d, 1.8);
    const g = gn(sh), o = osc('sine', 90 * k, t, 0.6 * L, g); sw(o.frequency, t, 95 * k, 30 * k, 0.32 * L); ad(g.gain, t, 0.95, 0.003, 0.45 * L);
    const b = gn(sh), bf = flt(b, 'lowpass', 2600, 0.8); noi(t, 0.7 * L, bf); sw(bf.frequency, t, 3000, 180, 0.4 * L); ad(b.gain, t, 0.75, 0.002, 0.45 * L);
    const m = gn(d), mf = flt(m, 'bandpass', 420 * k, 0.9); noi(t, 0.5, mf); ad(m.gain, t, 0.35, 0.004, 0.3 * L);
    grains(d, t + 0.12, 9 + ((p * 6) | 0), 0.8 * L, 0.2, 0.015, 0.05, 500, 2400, 5, 1);
    const r = gn(d), rf = flt(r, 'lowpass', 180); noi(t + 0.05, 1.1 * L, rf, bufBrown); ad(r.gain, t + 0.05, 0.4, 0.1, 0.9 * L);
  };
  S.charge = (d, t) => {
    const k = rr(0.94, 1.06), D = 0.55, lp = flt(d, 'lowpass', 3200), g = gn(lp);
    const o = osc('sine', 380 * k, t, D, g); sw(o.frequency, t, 380 * k, 1500 * k, D);
    const o2 = osc('triangle', 572 * k, t, D, gn(g, 0.35)); sw(o2.frequency, t, 572 * k, 2270 * k, D);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + D * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + D);
    const n = gn(d), nf = flt(n, 'bandpass', 2000, 3); noi(t, D, nf); sw(nf.frequency, t, 1500, 5200, D);
    n.gain.setValueAtTime(0.0001, t); n.gain.exponentialRampToValueAtTime(0.05, t + D * 0.9); n.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.02);
  };
  S.zap = (d, t, p) => {
    const k = rr(0.9, 1.1), lp = flt(d, 'lowpass', 7500);
    const c = gn(lp), cf = flt(c, 'highpass', 1700); noi(t, 0.1, cf); ad(c.gain, t, 0.8, 0.0005, 0.045);
    const t2 = t + rr(0.03, 0.07), c2 = gn(lp), cf2 = flt(c2, 'bandpass', 2600 * k, 0.8); noi(t2, 0.12, cf2); ad(c2.gain, t2, 0.5, 0.0005, 0.07);
    const z = gn(lp, 0), zf = flt(z, 'bandpass', 2100 * k, 2.2), zo = osc('sawtooth', 96 * k, t, 0.24, zf); sw(zo.frequency, t, 130 * k, 70 * k, 0.2);
    z.gain.setValueAtTime(0, t);
    for (let i = 0; i < 9; i++) z.gain.setValueAtTime(rnd() < 0.7 ? rr(0.15, 0.4) : 0.02, t + 0.002 + i * 0.022);
    z.gain.linearRampToValueAtTime(0, t + 0.23);
    grains(lp, t + 0.02, 10, 0.28, 0.3, 0.004, 0.014, 2800, 6000, 3, 1);
    const r = gn(d), rf = flt(r, 'lowpass', 170); noi(t, 1.0, rf, bufBrown); ad(r.gain, t + 0.01, 0.55 + 0.25 * p, 0.03, 0.8);
    const th = gn(d), to = osc('sine', 70, t, 0.3, th); sw(to.frequency, t, 80, 38, 0.2); ad(th.gain, t, 0.45, 0.003, 0.22);
  };
  S.clash = (d, t) => {
    const f0 = rr(1500, 2300), lp = flt(d, 'lowpass', 7000);
    const R = [1, 1.48, 2.08, 2.57, 3.31, 4.13], A = [0.3, 0.22, 0.2, 0.13, 0.09, 0.06];
    for (let i = 0; i < 6; i++) { const g = gn(lp); osc(i % 2 ? 'sine' : 'triangle', f0 * R[i] * rr(0.995, 1.005), t, 0.4, g); ad(g.gain, t, A[i], 0.001, rr(0.2, 0.32) / (1 + i * 0.45)); }
    const c = gn(lp), cf = flt(c, 'highpass', 3000); noi(t, 0.03, cf); ad(c.gain, t, 0.35, 0.0005, 0.012);
    const b = gn(lp), bf = flt(b, 'bandpass', 1200, 2.5); noi(t, 0.06, bf); ad(b.gain, t, 0.35, 0.001, 0.035);
  };
  S.slash = (d, t) => {
    const k = rr(0.85, 1.2);
    const s = gn(d), sf = flt(s, 'bandpass', 2600, 1.5); noi(t, 0.08, sf); sw(sf.frequency, t, 1500, 4200, 0.05); ad(s.gain, t, 0.12, 0.02, 0.035);
    const t1 = t + 0.04;
    const c = gn(d), cf = flt(c, 'bandpass', 800 * k, 1.4); noi(t1, 0.14, cf); sw(cf.frequency, t1, 900 * k, 280 * k, 0.08); ad(c.gain, t1, 0.7, 0.002, 0.08);
    const g = gn(d), o = osc('sine', 150 * k, t1, 0.1, g); sw(o.frequency, t1, 160 * k, 75 * k, 0.06); ad(g.gain, t1, 0.5, 0.002, 0.07);
    const b = gn(d), bf = flt(b, 'bandpass', 1700 * k, 9); noi(t1, 0.05, bf); ad(b.gain, t1, 0.25, 0.001, 0.03);
  };
  S.ratSqueal = (d, t) => {
    const k = rr(0.85, 1.2), lp = flt(d, 'lowpass', 4800), bp = flt(lp, 'bandpass', 2700 * k, 2.5);
    const n = rnd() < 0.4 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const ti = t + i * rr(0.12, 0.16), kk = k * (i ? 1.12 : 1), g = gn(bp), o = osc('sawtooth', 2100 * kk, ti, 0.16, g);
      o.frequency.setValueAtTime(2000 * kk, ti); o.frequency.exponentialRampToValueAtTime(3100 * kk, ti + 0.04); o.frequency.exponentialRampToValueAtTime(1700 * kk, ti + 0.13);
      osc('sine', rr(55, 85), ti, 0.16, gn(o.frequency, 220));
      ad(g.gain, ti, i ? 0.1 : 0.16, 0.008, 0.11);
    }
  };
  S.boneRattle = (d, t) => {
    grains(d, t, 8 + ((rnd() * 4) | 0), 0.38, 0.5, 0.012, 0.04, 600, 1900, 11, 1);
    grains(d, t + 0.02, 4, 0.3, 0.3, 0.02, 0.05, 250, 520, 8, 1);
    const g = gn(d), o = osc('sine', 210, t, 0.08, g); sw(o.frequency, t, 230, 130, 0.05); ad(g.gain, t, 0.3, 0.002, 0.05);
  };
  S.squelch = (d, t, p) => {
    const k = rr(0.8, 1.2) * (1 - 0.3 * p);
    const g = gn(d), f = flt(g, 'lowpass', 500, 7); noi(t, 0.35, f);
    f.frequency.setValueAtTime(320 * k, t); f.frequency.exponentialRampToValueAtTime(1500 * k, t + 0.07); f.frequency.exponentialRampToValueAtTime(260 * k, t + 0.26);
    ad(g.gain, t, 0.5, 0.008, 0.26);
    const b = gn(d), o = osc('sine', 170 * k, t, 0.3, b);
    o.frequency.setValueAtTime(190 * k, t); o.frequency.exponentialRampToValueAtTime(85 * k, t + 0.09); o.frequency.exponentialRampToValueAtTime(230 * k, t + 0.2);
    ad(b.gain, t, 0.4, 0.005, 0.2);
    for (let i = 0; i < 3; i++) {
      const ti = t + 0.1 + i * rr(0.05, 0.09), dg = gn(d), f0 = rr(420, 800) * k, q = osc('sine', f0, ti, 0.06, dg);
      sw(q.frequency, ti, f0, f0 * 1.9, 0.035); ad(dg.gain, ti, 0.12, 0.003, 0.035);
    }
  };
  S.batScreech = (d, t) => {
    const k = rr(0.88, 1.15), lp = flt(d, 'lowpass', 5200), bp = flt(lp, 'bandpass', 3300 * k, 3.5);
    for (let i = 0; i < 2; i++) {
      const ti = t + i * rr(0.06, 0.085), g = gn(bp), o = osc('square', 3600 * k, ti, 0.07, g);
      sw(o.frequency, ti, 3900 * k, 2500 * k, 0.055); ad(g.gain, ti, 0.07, 0.004, 0.05);
    }
    const n = gn(lp), nf = flt(n, 'bandpass', 2400, 1); noi(t, 0.16, nf); ad(n.gain, t, 0.05, 0.01, 0.12);
  };
  S.roar = (d, t, p) => {
    const k = rr(0.92, 1.06) * (1 - 0.15 * p), D = 1.25;
    const env = gn(d), am = gn(env, 0.65);
    osc('sawtooth', rr(22, 28), t, D + 0.3, gn(am.gain, 0.35));
    const f1 = flt(am, 'bandpass', 380, 4), f2 = flt(gn(am, 0.4), 'bandpass', 1050, 6), f3 = flt(gn(am, 0.9), 'lowpass', 170);
    const pre = shape(f1, 3); pre.connect(f2); pre.connect(f3);
    const src = gn(pre, 0.5), base = [80 * k, 81.3 * k, 40 * k];
    const os = [osc('sawtooth', base[0], t, D + 0.2, src), osc('sawtooth', base[1], t, D + 0.2, src), osc('square', base[2], t, D + 0.2, gn(src, 0.5))];
    for (let i = 0; i < 3; i++) {
      const b = base[i], fr = os[i].frequency;
      fr.setValueAtTime(b * 0.85, t); fr.linearRampToValueAtTime(b * 1.3, t + 0.3); fr.linearRampToValueAtTime(b * 1.1, t + 0.7); fr.linearRampToValueAtTime(b * 0.65, t + D);
    }
    f1.frequency.setValueAtTime(330, t); f1.frequency.linearRampToValueAtTime(640, t + 0.35); f1.frequency.linearRampToValueAtTime(420, t + D);
    f2.frequency.setValueAtTime(900, t); f2.frequency.linearRampToValueAtTime(1300, t + 0.35); f2.frequency.linearRampToValueAtTime(950, t + D);
    const n = gn(am, 0.12), nf = flt(n, 'bandpass', 700, 0.9); noi(t, D + 0.2, nf);
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(0.85, t + 0.12); env.gain.linearRampToValueAtTime(0.7, t + 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.15);
  };
  S.bossStep = (d, t, p) => {
    const k = rr(0.9, 1.1) * (1 - 0.2 * p), sh = shape(d, 1.6);
    const g = gn(sh), o = osc('sine', 60 * k, t, 0.5, g); sw(o.frequency, t, 66 * k, 29 * k, 0.26); ad(g.gain, t, 1.0, 0.004, 0.36);
    const n = gn(sh), nf = flt(n, 'lowpass', 150); noi(t, 0.4, nf, bufBrown); ad(n.gain, t, 0.9, 0.004, 0.25);
    // what a phone speaker can play: a woody body near 200 Hz and a dull crunch of earth
    const b = gn(d), bo = osc('triangle', 220 * k, t, 0.25, flt(b, 'lowpass', 800)); sw(bo.frequency, t, 250 * k, 120 * k, 0.12); ad(b.gain, t, 0.9, 0.002, 0.17);
    const m = gn(d), mf = flt(m, 'bandpass', 380 * k, 1.2); noi(t, 0.3, mf, bufPink); ad(m.gain, t, 1.6, 0.003, 0.2);
    const c = gn(d), cf = flt(c, 'bandpass', 900, 0.8); noi(t + 0.015, 0.2, cf); ad(c.gain, t + 0.015, 0.16, 0.004, 0.13);
    grains(d, t + 0.05, 5, 0.25, 0.12, 0.01, 0.03, 700, 2000, 4, 1);
  };
  S.bossDie = (d, t) => {
    const D = 1.5, k = rr(0.95, 1.05);
    const env = gn(d), am = gn(env, 0.7); osc('sawtooth', 19, t, D + 0.3, gn(am.gain, 0.3));
    const f1 = flt(am, 'bandpass', 420, 4), f3 = flt(gn(am, 0.8), 'lowpass', 170);
    const pre = shape(f1, 2.5); pre.connect(f3);
    const src = gn(pre, 0.5), a = osc('sawtooth', 92 * k, t, D + 0.2, src), b = osc('sawtooth', 93.5 * k, t, D + 0.2, src);
    sw(a.frequency, t, 100 * k, 36 * k, D); sw(b.frequency, t, 101.6 * k, 37 * k, D);
    f1.frequency.setValueAtTime(560, t); f1.frequency.exponentialRampToValueAtTime(230, t + D);
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(0.8, t + 0.1); env.gain.linearRampToValueAtTime(0.5, t + D * 0.8); env.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.2);
    const tc = t + 1.15, sh = shape(d, 2);
    const g = gn(sh), o = osc('sine', 75, tc, 0.9, g); sw(o.frequency, tc, 80, 24, 0.5); ad(g.gain, tc, 1.0, 0.004, 0.7);
    const n = gn(sh), nf = flt(n, 'lowpass', 1800, 0.7); noi(tc, 0.9, nf); sw(nf.frequency, tc, 2200, 120, 0.6); ad(n.gain, tc, 0.75, 0.003, 0.6);
    grains(d, tc + 0.1, 16, 1.1, 0.28, 0.02, 0.07, 300, 1800, 5, 1);
    const m = gn(d), mf = flt(m, 'bandpass', 340, 1); noi(tc, 0.8, mf, bufPink); ad(m.gain, tc, 0.6, 0.003, 0.55);
    const r = gn(d), rf = flt(r, 'lowpass', 140); noi(tc, 1.4, rf, bufBrown); ad(r.gain, tc, 0.6, 0.1, 1.2);
  };
  S.coin = (d, t, p) => {
    const f = 1560 * Math.pow(2, (p * 5 + rr(-0.4, 0.4)) / 12), lp = flt(d, 'lowpass', 6500);
    const g = gn(lp); osc('sine', f, t, 0.15, g); ad(g.gain, t, 0.2, 0.002, 0.09);
    const g2 = gn(lp); osc('sine', f * 2.42, t, 0.1, g2); ad(g2.gain, t, 0.06, 0.001, 0.05);
    ding(lp, t + 0.055, f * 1.498, 0.2);
    const c = gn(lp), cf = flt(c, 'highpass', 3500); noi(t, 0.02, cf); ad(c.gain, t, 0.06, 0.0005, 0.008);
  };
  S.hammer = (d, t, p) => {
    const k = rr(0.82, 1.22) * (1 + 0.3 * (p - 0.5));
    const n = gn(d), nf = flt(n, 'bandpass', 760 * k, 9); noi(t, 0.07, nf); ad(n.gain, t, 1.0, 0.001, 0.035);
    const g = gn(d), o = osc('sine', 200 * k, t, 0.08, g); sw(o.frequency, t, 215 * k, 140 * k, 0.05); ad(g.gain, t, 0.45, 0.001, 0.05);
    const m = gn(d); osc('sine', 2900 * k, t, 0.06, m); ad(m.gain, t, 0.045, 0.001, 0.035);
    const c = gn(d), cf = flt(c, 'highpass', 2200); noi(t, 0.02, cf); ad(c.gain, t, 0.12, 0.0005, 0.008);
  };
  S.buildDone = (d, t) => {
    const g = gn(d), o = osc('sine', 125, t, 0.25, g); sw(o.frequency, t, 130, 58, 0.14); ad(g.gain, t, 0.8, 0.003, 0.18);
    const n = gn(d), nf = flt(n, 'lowpass', 600); noi(t, 0.15, nf); ad(n.gain, t, 0.5, 0.002, 0.09);
    const kn = gn(d), kf = flt(kn, 'bandpass', 620, 3); noi(t, 0.08, kf, bufPink); ad(kn.gain, t, 1.5, 0.001, 0.05);
    whoomp(d, t + 0.1, 0.5, 0.5);
    grains(d, t + 0.2, 7, 0.5, 0.12, 0.004, 0.02, 1800, 5000, 3, 1);
  };
  S.sell = (d, t) => {
    grains(d, t, 9, 0.42, 0.7, 0.03, 0.07, 280, 900, 6, 1);
    const g = gn(d), o = osc('sine', 110, t + 0.08, 0.25, g); sw(o.frequency, t + 0.08, 120, 55, 0.15); ad(g.gain, t + 0.08, 0.6, 0.004, 0.18);
    const lp = flt(d, 'lowpass', 6500);
    for (let i = 0; i < 3; i++) ding(lp, t + 0.26 + i * 0.085, 1500 * Math.pow(2, (i * 2) / 12), 0.16);
  };
  S.horn = (d, t) => {
    const f = 146.83 * rr(0.985, 1.015);
    const os = hornNote(d, t, f, 1.5, 0.5, 1);
    for (let i = 0; i < os.length; i++) { const fr = os[i][0].frequency, b = os[i][1]; fr.setValueAtTime(b, t + 0.52); fr.exponentialRampToValueAtTime(b * 1.4983, t + 0.6); }
  };
  S.hornBoss = (d, t) => {
    const f = 73.42 * rr(0.99, 1.01);
    hornNote(d, t, f, 1.25, 0.55, 0.8);
    hornNote(d, t + 1.45, f * 0.7937, 1.9, 0.6, 0.85);
    const r = gn(d), rf = flt(r, 'lowpass', 110); noi(t + 1.45, 2.2, rf, bufBrown); ad(r.gain, t + 1.45, 0.35, 0.6, 1.5);
  };
  S.leak = (d, t) => {
    const f = 196 * rr(0.97, 1.03), lp = flt(d, 'lowpass', 1900);
    const R = [0.5, 1, 1.19, 1.56, 2, 2.51], A = [0.35, 0.5, 0.3, 0.2, 0.14, 0.08], D = [1.3, 1.1, 0.8, 0.6, 0.45, 0.3];
    for (let i = 0; i < 6; i++) { const g = gn(lp); osc('sine', f * R[i], t, D[i] + 0.1, g); ad(g.gain, t, A[i] * 0.6, 0.006, D[i]); }
    const th = gn(d), tf = flt(th, 'lowpass', 300); noi(t, 0.12, tf); ad(th.gain, t, 0.4, 0.003, 0.08);
    const fl = gn(d), am = gn(fl, 0.5), ff = flt(am, 'bandpass', 520, 0.8); noi(t, 0.75, ff); osc('sine', rr(15, 21), t, 0.75, gn(am.gain, 0.5));
    sw(ff.frequency, t, 900, 260, 0.6); ad(fl.gain, t + 0.02, 0.4, 0.06, 0.55);
  };
  S.footmanDie = (d, t) => {
    const k = rr(0.9, 1.1);
    const g = gn(d), o = osc('sine', 115 * k, t, 0.25, g); sw(o.frequency, t, 120 * k, 50 * k, 0.14); ad(g.gain, t, 0.75, 0.003, 0.17);
    const n = gn(d), nf = flt(n, 'lowpass', 420); noi(t, 0.2, nf); ad(n.gain, t, 0.5, 0.003, 0.12);
    const b = gn(d), bf = flt(b, 'bandpass', 360, 1.3); noi(t, 0.16, bf, bufPink); ad(b.gain, t, 1.4, 0.002, 0.11);
    const bb = gn(d), bo = osc('triangle', 240 * k, t, 0.16, bb); sw(bo.frequency, t, 260 * k, 140 * k, 0.1); ad(bb.gain, t, 0.3, 0.002, 0.11);
    grains(d, t + 0.04, 6, 0.36, 0.3, 0.02, 0.06, 1700, 3600, 10, 1);
  };
  S.uiHover = (d, t) => {
    const g = gn(d); osc('sine', rr(1250, 1400), t, 0.05, g); ad(g.gain, t, 0.07, 0.002, 0.03);
    const c = gn(d), cf = flt(c, 'bandpass', 3000, 2); noi(t, 0.02, cf); ad(c.gain, t, 0.05, 0.0005, 0.008);
  };
  S.uiClick = (d, t) => {
    const g = gn(d), o = osc('triangle', 900, t, 0.09, g); sw(o.frequency, t, 880, 1320, 0.035); ad(g.gain, t, 0.18, 0.002, 0.06);
    const w = gn(d); osc('sine', 300, t, 0.06, w); ad(w.gain, t, 0.15, 0.001, 0.035);
    const c = gn(d), cf = flt(c, 'bandpass', 2300, 1.5); noi(t, 0.03, cf); ad(c.gain, t, 0.2, 0.0005, 0.012);
  };
  S.uiDeny = (d, t) => { // a soft, low "uh-uh": two muted taps falling a third, no buzz (not enough gold or mana)
    const lp = flt(d, 'lowpass', 2200);
    for (let i = 0; i < 2; i++) {
      const ti = t + i * 0.1, f = i ? 330 : 415, g = gn(lp), o = osc('triangle', f, ti, 0.12, g); sw(o.frequency, ti, f * 1.05, f * 0.94, 0.08);
      osc('sine', f * 2, ti, 0.08, gn(g, 0.1)); ad(g.gain, ti, 0.24, 0.004, 0.09);
    }
    const n = gn(lp), nf = flt(n, 'bandpass', 900, 2); noi(t, 0.03, nf); ad(n.gain, t, 0.05, 0.001, 0.015);
  };
  S.crumble = (d, t) => {
    const D = 3.0;
    const r = gn(d), rf = flt(r, 'lowpass', 130, 0.6); noi(t, D + 0.4, rf, bufBrown); sw(rf.frequency, t, 170, 60, D);
    r.gain.setValueAtTime(0.0001, t); r.gain.linearRampToValueAtTime(1.0, t + 0.35); r.gain.linearRampToValueAtTime(0.7, t + D * 0.6); r.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.3);
    const s = gn(d), o = osc('sine', 44, t, D, s); sw(o.frequency, t, 48, 30, D); ad(s.gain, t, 0.5, 0.4, D - 0.4);
    grains(d, t + 0.1, 26, D - 0.3, 0.6, 0.05, 0.2, 220, 800, 3, 0);
    grains(d, t + 0.2, 16, D - 0.5, 0.2, 0.01, 0.04, 800, 2600, 5, 0);
    const m = gn(d), mf = flt(m, 'bandpass', 420, 0.9); noi(t, D + 0.3, mf, bufPink); sw(mf.frequency, t, 560, 260, D); // grinding stone, for small speakers
    m.gain.setValueAtTime(0.0001, t); m.gain.linearRampToValueAtTime(0.9, t + 0.3); m.gain.linearRampToValueAtTime(0.6, t + D * 0.6); m.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.3);
  };
  S.rise = (d, t) => {
    const D = 3.0;
    const r = gn(d), rf = flt(r, 'lowpass', 70, 0.7); noi(t, D + 0.5, rf, bufBrown); sw(rf.frequency, t, 55, 240, D * 0.9);
    r.gain.setValueAtTime(0.0001, t); r.gain.exponentialRampToValueAtTime(0.9, t + D * 0.85); r.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.35);
    const s = gn(d), o = osc('sine', 32, t, D + 0.2, s); sw(o.frequency, t, 30, 62, D * 0.9);
    s.gain.setValueAtTime(0.0001, t); s.gain.exponentialRampToValueAtTime(0.45, t + D * 0.85); s.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.2);
    grains(d, t + 0.5, 14, D - 0.5, 0.55, 0.05, 0.12, 240, 720, 8, 2);
    const tf = t + D - 0.05, g = gn(d), o2 = osc('sine', 90, tf, 0.5, g); sw(o2.frequency, tf, 95, 42, 0.25); ad(g.gain, tf, 0.9, 0.004, 0.4);
    const n = gn(d), nf = flt(n, 'lowpass', 500); noi(tf, 0.3, nf); ad(n.gain, tf, 0.5, 0.003, 0.2);
    const m = gn(d), mf = flt(m, 'bandpass', 300, 1); noi(t, D + 0.3, mf, bufPink); sw(mf.frequency, t, 260, 620, D * 0.9); // grinding stone, for small speakers
    m.gain.setValueAtTime(0.0001, t); m.gain.exponentialRampToValueAtTime(0.6, t + D * 0.85); m.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.3);
    const b = gn(d), bo = osc('triangle', 200, tf, 0.3, b); sw(bo.frequency, tf, 230, 110, 0.15); ad(b.gain, tf, 0.6, 0.003, 0.2);
  };
  S.beaconOut = (d, t) => {
    const w = gn(d), am = gn(w, 0.7), wf = flt(am, 'bandpass', 2400, 1.4); noi(t, 2.0, wf); sw(wf.frequency, t, 2600, 110, 1.7);
    osc('sine', 13, t, 2.0, gn(am.gain, 0.3));
    w.gain.setValueAtTime(0.0001, t); w.gain.linearRampToValueAtTime(0.7, t + 0.25); w.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    const lw = gn(d), lf = flt(lw, 'lowpass', 400); noi(t, 1.6, lf, bufBrown); sw(lf.frequency, t, 500, 70, 1.4); ad(lw.gain, t, 0.6, 0.2, 1.3);
    const td = t + 0.7, dr = gn(d), dl = flt(dr, 'lowpass', 500);
    osc('sine', 55, td, 2.8, gn(dl, 0.6)); osc('sine', 82.6, td, 2.8, gn(dl, 0.35)); osc('triangle', 110.7, td, 2.8, gn(dl, 0.18)); osc('sine', 164.2, td, 2.8, gn(dl, 0.1));
    dr.gain.setValueAtTime(0.0001, td); dr.gain.linearRampToValueAtTime(0.5, td + 1.0); dr.gain.exponentialRampToValueAtTime(0.0001, td + 2.7);
    const a = gn(d), af = flt(a, 'bandpass', 3200, 0.7); noi(td, 2.6, af, bufPink);
    a.gain.setValueAtTime(0.0001, td); a.gain.linearRampToValueAtTime(0.06, td + 1.0); a.gain.exponentialRampToValueAtTime(0.0001, td + 2.6);
  };
  S.ignite = (d, t, p) => {
    whoomp(d, t, 0.75, 0.7 + 0.3 * p);
    grains(d, t + 0.12, 12, 0.9, 0.16, 0.004, 0.02, 1800, 5200, 3, 1);
    const r = gn(d), rf = flt(r, 'bandpass', 420, 0.7); noi(t + 0.1, 1.1, rf); ad(r.gain, t + 0.1, 0.18, 0.15, 0.85);
  };
  S.splash = (d, t) => {
    const k = rr(0.85, 1.15);
    const g = gn(d), f = flt(g, 'bandpass', 1300 * k, 0.8); noi(t, 0.4, f); sw(f.frequency, t, 900 * k, 2200 * k, 0.12); ad(g.gain, t, 0.45, 0.012, 0.28);
    const b = gn(d), o = osc('sine', 300 * k, t, 0.1, b); sw(o.frequency, t, 320 * k, 110 * k, 0.07); ad(b.gain, t, 0.4, 0.003, 0.07);
    grains(d, t + 0.08, 5, 0.32, 0.12, 0.006, 0.02, 2000, 4200, 6, 1);
  };

  // A cheap horn: two detuned saws through an opening lowpass.
  function brassNote(d, t, f, dur, peak, bright) {
    const env = gn(d), lp = flt(env, 'lowpass', 400, 1.1);
    for (let i = 0; i < 2; i++) { const o = osc('sawtooth', f, t, dur + 0.5, gn(lp, 0.5)); o.detune.value = i ? 7 : -7; }
    const a = Math.min(0.09, dur * 0.3);
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(peak, t + a); env.gain.setTargetAtTime(peak * 0.7, t + a, dur * 0.4); env.gain.setTargetAtTime(0.0001, t + dur, 0.1);
    lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1800 * bright, t + a); lp.frequency.setTargetAtTime(650 * bright, t + a, dur * 0.5); lp.frequency.setTargetAtTime(250, t + dur, 0.1);
  }
  function drumHit(d, t, vel, f) {
    const g = gn(d), o = osc('sine', f, t, 0.7, g); sw(o.frequency, t, f * 1.6, f * 0.8, 0.12); ad(g.gain, t, vel, 0.003, 0.55);
    const n = gn(d), nf = flt(n, 'bandpass', 1500, 0.9); noi(t, 0.05, nf); ad(n.gain, t, vel * 0.35, 0.001, 0.03);
  }
  // New sounds for round 1 (anyone may call them through sfx()).
  S.horde = (d, t) => {
    const f = 73.42 * rr(0.985, 1.015);
    hornNote(d, t, f, 1.3, 0.5, 0.85);
    hornNote(d, t + 0.04, f * 1.0595, 1.2, 0.2, 0.7);
    const os = hornNote(d, t + 1.5, f * 1.4983, 1.6, 0.55, 1.1);
    for (let i = 0; i < os.length; i++) { const fr = os[i][0].frequency, b = os[i][1]; fr.setValueAtTime(b, t + 2.3); fr.exponentialRampToValueAtTime(b * 1.335, t + 2.55); }
    const dt = [0, 0.42, 0.84, 1.5];
    for (let i = 0; i < 4; i++) drumHit(d, t + dt[i], i === 3 ? 0.9 : 0.6, 56);
    const r = gn(d), rf = flt(r, 'bandpass', 260, 0.9); noi(t + 0.3, 3.2, rf, bufBrown); sw(rf.frequency, t + 0.3, 200, 650, 2.8);
    r.gain.setValueAtTime(0.0001, t + 0.3); r.gain.exponentialRampToValueAtTime(0.5, t + 2.6); r.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
  };
  S.elite = (d, t) => {
    const k = rr(0.94, 1.06);
    const s = gn(d), sf = flt(s, 'bandpass', 900, 1.2); noi(t, 0.42, sf); sw(sf.frequency, t, 500, 2600, 0.38);
    s.gain.setValueAtTime(0.0001, t); s.gain.exponentialRampToValueAtTime(0.25, t + 0.36); s.gain.linearRampToValueAtTime(0.0001, t + 0.4);
    const th = t + 0.38;
    const g = gn(d), o = osc('sine', 62 * k, th, 0.6, g); sw(o.frequency, th, 90 * k, 40 * k, 0.3); ad(g.gain, th, 0.8, 0.003, 0.45);
    const lp = flt(d, 'lowpass', 5000), R = [1, 2.76, 5.4];
    for (let j = 0; j < 2; j++) {
      const f = (j ? 622.3 : 587.3) * k, a = j ? 0.12 : 0.16;
      for (let i = 0; i < 3; i++) { const bg = gn(lp); osc('sine', f * R[i], th, 1.0, bg); ad(bg.gain, th, a / (1 + i * 1.5), 0.002, 0.9 / (1 + i)); }
    }
    const sh = gn(lp), shf = flt(sh, 'highpass', 5000); noi(th, 0.5, shf); ad(sh.gain, th, 0.06, 0.005, 0.4);
  };
  S.chainBoom = (d, t, p) => {
    const k = rr(0.85, 1.25) * (1 - 0.15 * p), sh = shape(d, 2);
    const c = gn(d), cf = flt(c, 'highpass', 1800); noi(t, 0.06, cf); ad(c.gain, t, 0.6, 0.0005, 0.03);
    const t1 = t + rr(0.015, 0.04);
    const g = gn(sh), o = osc('sine', 110 * k, t1, 0.45, g); sw(o.frequency, t1, 130 * k, 38 * k, 0.22); ad(g.gain, t1, 0.85, 0.002, 0.32);
    const b = gn(sh), bf = flt(b, 'lowpass', 3200, 0.8); noi(t1, 0.5, bf); sw(bf.frequency, t1, 3800, 260, 0.3); ad(b.gain, t1, 0.65, 0.002, 0.32);
    grains(d, t1 + 0.06, 6, 0.45, 0.18, 0.01, 0.035, 700, 3000, 5, 1);
  };
  S.burn = (d, t) => {
    const k = rr(0.85, 1.2);
    const w = gn(d), wf = flt(w, 'bandpass', 500 * k, 0.8); noi(t, 0.45, wf); sw(wf.frequency, t, 300 * k, 1400 * k, 0.12);
    w.gain.setValueAtTime(0.0001, t); w.gain.linearRampToValueAtTime(0.5, t + 0.05); w.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    const g = gn(d), o = osc('sine', 80 * k, t, 0.25, g); sw(o.frequency, t, 70 * k, 120 * k, 0.12); ad(g.gain, t, 0.3, 0.02, 0.18);
    grains(d, t + 0.05, 6, 0.35, 0.14, 0.004, 0.015, 1800, 5200, 3, 1);
  };
  S.buyout = (d, t) => {
    const lp = flt(d, 'lowpass', 7000), up = [0, 3, 5, 7, 10, 12];
    for (let i = 0; i < 6; i++) ding(lp, t + i * 0.055 + rr(0, 0.015), 1320 * Math.pow(2, up[i] / 12) * rr(0.995, 1.005), 0.12);
    const t2 = t + 0.05, ch = [46, 50, 53];
    for (let i = 0; i < 3; i++) brassNote(d, t2, mtof(ch[i]), 0.75, 0.14, 1.2);
    whoomp(d, t, 0.35, 0.5);
    grains(lp, t + 0.3, 8, 0.7, 0.1, 0.004, 0.02, 2500, 6000, 3, 1);
  };

  // ---- Round 2: tower branches, spells, land events and boss entrance stings. ----
  // A struck bell or crystal: inharmonic partials, the high ones dying first (skipped above 15 kHz).
  function belld(d, t, f, vel, len) {
    const R = [1, 2.76, 5.4, 8.93], D = [1, 0.5, 0.25, 0.12];
    for (let i = 0; i < 4; i++) { if (f * R[i] > 15000) break; const g = gn(d); osc('sine', f * R[i], t, len * D[i] + 0.05, g); ad(g.gain, t, vel / (1 + i * 1.4), 0.002, len * D[i]); }
  }
  function softChord(d, t, notes, dur, peak) { // slow sine-and-triangle swell, for resolutions
    const env = gn(d), lp = flt(env, 'lowpass', 1800);
    for (let i = 0; i < notes.length; i++) { const f = mtof(notes[i]); osc('triangle', f, t, dur + 0.3, gn(lp, 0.5)); osc('sine', f * 2, t, dur + 0.3, gn(lp, 0.15)); }
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(peak, t + dur * 0.3); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  S.branch = (d, t) => {
    // A heavy thump and a ringing metal clang, then a bright D major brass chord that rises out of the minor-key music.
    const sh = shape(d, 1.8);
    const g = gn(sh), o = osc('sine', 100, t, 0.7, g); sw(o.frequency, t, 150, 45, 0.3); ad(g.gain, t, 0.9, 0.003, 0.5);
    const m = gn(d), mf = flt(m, 'bandpass', 380, 1.2); noi(t, 0.3, mf); ad(m.gain, t, 0.5, 0.002, 0.2);
    const bb = gn(d), bo = osc('triangle', 230, t, 0.3, bb); sw(bo.frequency, t, 260, 130, 0.15); ad(bb.gain, t, 0.4, 0.002, 0.2);
    const lp = flt(d, 'lowpass', 7000), R = [1, 1.51, 2.27, 2.94, 3.76];
    for (let i = 0; i < 5; i++) { const cg = gn(lp); osc(i % 2 ? 'sine' : 'triangle', 620 * R[i] * rr(0.995, 1.005), t + 0.01, 1.4, cg); ad(cg.gain, t + 0.01, 0.14 / (1 + i * 0.4), 0.001, 1.1 / (1 + i * 0.5)); }
    const t2 = t + 0.2, ch = [50, 57, 62, 66];
    for (let i = 0; i < ch.length; i++) brassNote(d, t2, mtof(ch[i]), 1.0, 0.11, 1.15);
    brassNote(d, t2 + 0.5, mtof(69), 0.9, 0.11, 1.3);
    whoomp(d, t, 0.4, 0.6);
    grains(lp, t + 0.25, 14, 1.2, 0.09, 0.003, 0.015, 2600, 7000, 3, 1);
    belld(lp, t + 0.75, mtof(86), 0.05, 1.6);
  };
  // Seconds of whistle before the impact: the game's fall time (game seconds) at the current game speed,
  // so the blast lands with the picture at 2x and 3x too.
  function meteorFall() {
    const f = typeof METEOR_FALL === 'number' ? METEOR_FALL : 0.8, sp = typeof G !== 'undefined' && G && G.speed > 0 ? G.speed : 1;
    return cl(f / sp, 0.2, 1.2);
  }
  S.meteor = (d, t) => {
    const MF = meteorFall(), ti = t + MF;
    // the fall: a whistle that rises while a roar of torn air builds
    const wg = gn(d), wo = osc('sine', 520, t, MF + 0.05, wg); wo.frequency.setValueAtTime(520, t); wo.frequency.exponentialRampToValueAtTime(1900, ti);
    osc('sine', 7, t, MF, gn(wo.detune, 25));
    wg.gain.setValueAtTime(0.0001, t); wg.gain.exponentialRampToValueAtTime(0.12, ti - 0.05); wg.gain.linearRampToValueAtTime(0.0001, ti + 0.02);
    const rg = gn(d), rf = flt(rg, 'bandpass', 600, 1.2); noi(t, MF + 0.05, rf, bufPink); sw(rf.frequency, t, 300, 2600, MF);
    rg.gain.setValueAtTime(0.0001, t); rg.gain.exponentialRampToValueAtTime(0.45, ti - 0.03); rg.gain.linearRampToValueAtTime(0.0001, ti + 0.03);
    // the impact: a deep drop, a wide blast, a mid crunch for small speakers, then debris and a long rumble
    const sh = shape(d, 2.4);
    const g = gn(sh), o = osc('sine', 110, ti, 1.3, g); sw(o.frequency, ti, 125, 26, 0.7); ad(g.gain, ti, 1.0, 0.002, 1.1);
    const b = gn(sh), bf = flt(b, 'lowpass', 3500, 0.7); noi(ti, 1.2, bf); sw(bf.frequency, ti, 4200, 150, 0.8); ad(b.gain, ti, 0.9, 0.001, 0.85);
    const m = gn(d), mf = flt(m, 'bandpass', 320, 0.9); noi(ti, 0.9, mf); ad(m.gain, ti, 0.8, 0.002, 0.7);
    const k2 = gn(d), ko = osc('triangle', 210, ti, 0.4, k2); sw(ko.frequency, ti, 260, 120, 0.25); ad(k2.gain, ti, 0.35, 0.002, 0.3); // a body that small speakers can play
    const c = gn(d), cf = flt(c, 'highpass', 1500); noi(ti, 0.12, cf); ad(c.gain, ti, 0.5, 0.0005, 0.06);
    grains(d, ti + 0.1, 22, 1.6, 0.25, 0.015, 0.06, 300, 2200, 5, 1);
    const r = gn(d), rff = flt(r, 'lowpass', 200, 0.6); noi(ti + 0.05, 2.6, rff, bufBrown); ad(r.gain, ti + 0.05, 0.7, 0.15, 2.2);
    const s2 = gn(d), sf2 = flt(flt(s2, 'highpass', 2500), 'lowpass', 7000); noi(ti + 0.2, 1.6, sf2); ad(s2.gain, ti + 0.2, 0.07, 0.3, 1.2);
  };
  S.frostNova = (d, t) => {
    const lp = flt(d, 'lowpass', 9000);
    const c = gn(lp), cf = flt(c, 'highpass', 2500); noi(t, 0.08, cf); ad(c.gain, t, 0.55, 0.0005, 0.04); // the crack
    const th = gn(d), to = osc('sine', 180, t, 0.3, th); sw(to.frequency, t, 260, 90, 0.18); ad(th.gain, t, 0.45, 0.002, 0.2);
    const w = gn(d), wf = flt(w, 'bandpass', 3000, 1.1); noi(t, 0.9, wf); sw(wf.frequency, t, 5500, 900, 0.8); ad(w.gain, t, 0.3, 0.01, 0.75);
    for (let i = 0; i < 9; i++) belld(lp, t + 0.01 + Math.pow(rnd(), 1.6) * 0.5, rr(1900, 4200), rr(0.04, 0.08), rr(0.4, 0.9)); // shards
    grains(lp, t + 0.02, 18, 0.6, 0.16, 0.002, 0.01, 4500, 9000, 4, 1);
    // the cold that stays: a trembling cluster and an airy hiss
    const sg = gn(lp), tr = gn(sg, 0.5); osc('sine', 6.5, t, 2.7, gn(tr.gain, 0.5));
    [2349, 2794, 3520, 4186].forEach((f) => { const o = osc('sine', f, t + 0.15, 2.5, gn(tr, 0.25)); o.detune.value = rr(-12, 12); });
    sg.gain.setValueAtTime(0.0001, t + 0.15); sg.gain.linearRampToValueAtTime(0.1, t + 0.5); sg.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    const a = gn(lp), af = flt(a, 'highpass', 6000); noi(t + 0.1, 2.2, af, bufPink); ad(a.gain, t + 0.1, 0.05, 0.4, 1.7);
  };
  S.rally = (d, t) => {
    // A bugle call (G C E G, the last held, a second horn under it) over a squad of boots marching in.
    const N = [[0, 55, 0.15], [0.19, 60, 0.15], [0.38, 64, 0.15], [0.57, 67, 0.95]];
    for (let i = 0; i < N.length; i++) { brassNote(d, t + N[i][0], mtof(N[i][1]), N[i][2], 0.26, 1.25); brassNote(d, t + N[i][0], mtof(N[i][1] - 12), N[i][2], 0.08, 0.9); }
    brassNote(d, t + 0.6, mtof(64), 0.9, 0.11, 1.1);
    for (let i = 0; i < 10; i++) {
      const ti = t + 0.3 + i * 0.27 + rr(-0.01, 0.01), v = Math.min(1, 0.35 + i * 0.12) * (i > 7 ? 1 - (i - 7) * 0.28 : 1);
      const g = gn(d), o = osc('sine', rr(90, 110), ti, 0.14, g); sw(o.frequency, ti, 140, 62, 0.07); ad(g.gain, ti, 0.35 * v, 0.002, 0.09);
      grains(d, ti, 5, 0.05, 0.3 * v, 0.006, 0.02, 700, 2600, 3, 1); // gravel under several feet
      if (i % 2 === 0) { const s = gn(d), sf = flt(s, 'bandpass', 1900, 0.9); noi(ti, 0.1, sf); ad(s.gain, ti, 0.12 * v, 0.001, 0.07); } // side drum
    }
  };
  S.spellReady = (d, t) => {
    const lp = flt(d, 'lowpass', 8000);
    belld(lp, t, mtof(81), 0.07, 1.2); belld(lp, t + 0.12, mtof(88), 0.05, 1.4);
    const a = gn(lp), af = flt(a, 'highpass', 5000); noi(t, 0.8, af); ad(a.gain, t, 0.02, 0.1, 0.6);
  };
  S.rockslide = (d, t) => {
    const D = 3.6, sh = shape(d, 1.6);
    const r = gn(d), rf = flt(r, 'lowpass', 160, 0.7); noi(t, D + 0.5, rf, bufBrown); sw(rf.frequency, t, 90, 300, 1.2);
    r.gain.setValueAtTime(0.0001, t); r.gain.exponentialRampToValueAtTime(0.9, t + 0.8); r.gain.linearRampToValueAtTime(0.6, t + D * 0.7); r.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.4);
    const m = gn(d), mf = flt(m, 'bandpass', 380, 1); noi(t, D, mf, bufBrown); ad(m.gain, t + 0.2, 0.9, 0.6, D - 0.8);
    for (let i = 0; i < 6; i++) boulder(sh, t + 0.3 + Math.pow(i / 6, 1.2) * 2.6 + rr(0, 0.2), rr(0.5, 0.9));
    grains(d, t + 0.2, 30, D - 0.4, 0.3, 0.01, 0.06, 250, 1600, 4, 0);
    grains(d, t + 0.4, 18, D - 0.6, 0.14, 0.005, 0.02, 1500, 4000, 5, 0);
  };
  S.blizzard = (d, t) => {
    const D = 4.2, w = gn(d), b1 = flt(w, 'bandpass', 420, 7), b2 = flt(w, 'bandpass', 780, 10), hs = flt(gn(w, 0.25), 'highpass', 3500);
    const s = noi(t, D + 0.3, gn(b1, 3), bufPink); s.connect(gn(b2, 2.5)); s.connect(hs);
    sw(b1.frequency, t, 300, 900, D * 0.6); b1.frequency.exponentialRampToValueAtTime(500, t + D);
    sw(b2.frequency, t, 600, 1500, D * 0.5); b2.frequency.exponentialRampToValueAtTime(800, t + D);
    w.gain.setValueAtTime(0.0001, t); w.gain.exponentialRampToValueAtTime(0.7, t + D * 0.55); w.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.2);
    grains(d, t + 1, 20, D - 1.2, 0.06, 0.003, 0.012, 3500, 8000, 3, 0);
    const l = gn(d), lf = flt(l, 'lowpass', 220); noi(t, D, lf, bufBrown); ad(l.gain, t, 0.35, D * 0.5, D * 0.5);
  };
  S.bogfog = (d, t) => {
    const D = 4.5, env = gn(d), lp = flt(env, 'lowpass', 500, 2);
    [[55, -7], [55, 6], [82.4, 0], [116.5, 4], [164.8, -3]].forEach((a, i) => { const o = osc(i < 2 ? 'sawtooth' : 'triangle', a[0], t, D + 0.3, gn(lp, i < 2 ? 0.3 : 0.2)); o.detune.value = a[1]; });
    sw(lp.frequency, t, 200, 900, D * 0.6); lp.frequency.exponentialRampToValueAtTime(300, t + D);
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.45, t + D * 0.5); env.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.2);
    const t1 = t + 0.8, wg = gn(d), wo = osc('sine', 700, t1, D, wg); // a ghostly wail above the drone
    wo.frequency.setValueAtTime(700, t1); wo.frequency.linearRampToValueAtTime(820, t1 + 1.4); wo.frequency.linearRampToValueAtTime(620, t1 + D - 0.2);
    osc('sine', 5, t1, D, gn(wo.detune, 30));
    wg.gain.setValueAtTime(0.0001, t1); wg.gain.linearRampToValueAtTime(0.05, t1 + 1.2); wg.gain.exponentialRampToValueAtTime(0.0001, t1 + D - 0.1);
    for (let i = 0; i < 9; i++) bubble(d, t + 0.4 + rnd() * (D - 0.6), rr(0.12, 0.3));
  };
  S.lavaSurge = (d, t) => {
    const D = 3.8, sh = shape(d, 2.2);
    const r = gn(sh), rf = flt(r, 'lowpass', 200, 1); noi(t, D + 0.4, rf, bufBrown); sw(rf.frequency, t, 100, 420, D * 0.4); rf.frequency.exponentialRampToValueAtTime(140, t + D);
    r.gain.setValueAtTime(0.0001, t); r.gain.exponentialRampToValueAtTime(1.0, t + 1.0); r.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.3);
    const gr = gn(d), gl = flt(gr, 'lowpass', 380, 1.5), o = osc('sawtooth', 46, t, D, gl); sw(o.frequency, t, 38, 58, D * 0.4); ad(gr.gain, t, 0.3, 0.9, D - 1);
    const h = gn(d), hf = flt(h, 'highpass', 4500); noi(t + 0.3, D, hf); ad(h.gain, t + 0.3, 0.07, 1.0, D - 1.2);
    grains(d, t + 0.3, 40, D - 0.5, 0.12, 0.002, 0.008, 3000, 8000, 2, 0);
    for (let i = 0; i < 7; i++) blorp(d, t + 0.3 + rnd() * (D - 0.5), rr(0.2, 0.45));
  };
  S.sandstorm = (d, t) => {
    const D = 4.2, w = gn(d), b = flt(w, 'bandpass', 1200, 0.8), h = flt(gn(w, 0.6), 'highpass', 4000);
    noi(t, D + 0.3, gn(b, 1.4), bufPink); noi(t, D + 0.3, h);
    sw(b.frequency, t, 500, 2200, D * 0.55); b.frequency.exponentialRampToValueAtTime(900, t + D);
    w.gain.setValueAtTime(0.0001, t); w.gain.exponentialRampToValueAtTime(0.5, t + D * 0.5); w.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.2);
    grains(d, t + 0.5, 50, D - 0.7, 0.1, 0.002, 0.006, 2500, 7000, 2, 0);
    const l = gn(d), lf = flt(l, 'lowpass', 300); noi(t, D, lf, bufBrown); ad(l.gain, t, 0.3, D * 0.45, D * 0.5);
  };
  S.eventEnd = (d, t) => {
    const w = gn(d), wf = flt(w, 'bandpass', 1200, 1); noi(t, 1.6, wf, bufPink); sw(wf.frequency, t, 1800, 300, 1.4); ad(w.gain, t, 0.25, 0.15, 1.3);
    softChord(d, t + 0.1, [50, 57, 62, 66], 2.0, 0.12);
    const lp = flt(d, 'lowpass', 6000); belld(lp, t + 0.3, mtof(78), 0.04, 1.6); belld(lp, t + 0.55, mtof(81), 0.035, 1.8);
  };

  // ---- Round 6: Stormreach (thunder, the drowned king's wave, the thunderstorm event). ----
  // Thunder at a distance: near 1 is a strike right here (a tearing crack, a hard boom, then the roll); near 0 is far
  // off (no crack, dark, slow to swell and long). The roll is a few overlapping swells of low noise that flutter.
  function thunderV(d, t, near, vel) {
    const k = rr(0.85, 1.15), L = 3 + 2.4 * (1 - near) + rr(-0.3, 0.6), crack = near > 0.55;
    if (crack) {
      const c = gn(d), cf = flt(c, 'highpass', 1300); noi(t, 0.3, cf);
      c.gain.setValueAtTime(0, t); let ti = t;
      for (let i = 0; i < 14; i++) { c.gain.setValueAtTime(rnd() < 0.7 ? rr(0.25, 0.7) * vel * near : 0.02, ti); ti += rr(0.006, 0.02); }
      c.gain.linearRampToValueAtTime(0, ti + 0.04);
      grains(d, t, 16, 0.35, 0.4 * vel * near, 0.002, 0.01, 1800, 7000, 2, 1);
      const sh = shape(d, 2);
      const g = gn(sh), o = osc('sine', 72 * k, t + 0.02, 1.0, g); sw(o.frequency, t + 0.02, 95 * k, 30 * k, 0.6); ad(g.gain, t + 0.02, 0.85 * vel * near, 0.004, 0.85);
      const b = gn(sh), bf = flt(b, 'lowpass', 2500, 0.7); noi(t + 0.01, 1.1, bf); sw(bf.frequency, t + 0.01, 3600, 180, 0.75); ad(b.gain, t + 0.01, 0.65 * vel * near, 0.003, 0.85);
    }
    const t0 = t + (crack ? 0.12 : 0), roll = gn(d, 0.7), n = 3 + ((rnd() * 3) | 0);
    osc('sine', rr(2.5, 5), t0, L + 0.5, gn(roll.gain, 0.3)); // the roll flutters
    for (let i = 0; i < n; i++) {
      const ti = t0 + Math.pow(i / n, 1.3) * L * 0.65 + rr(0, 0.25), dur = rr(1.2, 2.3) * (1.35 - 0.35 * near), a = vel * (i ? rr(0.45, 0.85) : 1) * (0.5 + 0.5 * near) * (1 - i / (n + 2));
      const r = gn(roll), rf = flt(r, 'lowpass', (110 + 250 * near) * rr(0.8, 1.2), 0.8); noi(ti, dur + 0.3, rf, bufBrown);
      r.gain.setValueAtTime(0.0001, ti); r.gain.linearRampToValueAtTime(Math.max(0.0002, a), ti + rr(0.08, 0.3) * (1.6 - near)); r.gain.exponentialRampToValueAtTime(0.0001, ti + dur);
    }
    const m = gn(d), mf = flt(m, 'bandpass', 230 + 170 * near, 0.9); noi(t0, L + 0.2, mf, bufPink); // a body a phone speaker can play
    m.gain.setValueAtTime(0.0001, t0); m.gain.linearRampToValueAtTime(vel * (0.22 + 0.4 * near), t0 + 0.08 + 0.5 * (1 - near)); m.gain.exponentialRampToValueAtTime(0.0001, t0 + L);
  }
  // A low drowned choir singing "oh": detuned saws through two vowel bands and a chest band, a slow swell, late vibrato.
  function choirTone(d, t, m, dur, vel) {
    const f = mtof(m), env = gn(d), src = gn(null, 1), f1 = flt(env, 'bandpass', 420, 4), f2 = flt(gn(env, 0.5), 'bandpass', 780, 6);
    src.connect(f1); src.connect(f2); src.connect(flt(gn(env, 0.6), 'lowpass', 320));
    const vib = gn(null, 0); osc('sine', rr(4.6, 5.4), t, dur + 0.8, vib);
    for (let i = 0; i < 3; i++) { const o = osc('sawtooth', f, t, dur + 0.8, gn(src, 0.33)); o.detune.value = (i - 1) * rr(8, 14); vib.connect(o.detune); }
    vib.gain.setValueAtTime(0, t + 0.2); vib.gain.linearRampToValueAtTime(12, t + dur * 0.7);
    const a = Math.min(0.5, dur * 0.35);
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(vel, t + a); env.gain.setValueAtTime(vel, t + dur * 0.75); env.gain.setTargetAtTime(0.0001, t + dur * 0.75, dur * 0.15 + 0.1);
  }
  S.thunder = (d, t, p) => thunderV(d, t, 1 - 0.5 * p, 1); // a strike on the road: crack and roll, no delay
  // The drowned king sweeps the road (startTide in 62-game): the wall of water appears at full height at once and runs
  // down the road for 1.5 s of game time, fastest at first. So: a short heave, the crash right away, the roar running
  // for the wave's run (shorter at 2x and 3x), then the wash draining back.
  S.tidalWave = (d, t) => {
    const sp = typeof G !== 'undefined' && G && G.speed > 0 ? G.speed : 1, D = 0.12, tc = t + D, run = cl(1.5 / sp, 0.45, 1.5), te = tc + run, sh = shape(d, 2);
    const s = gn(d), sb = flt(s, 'bandpass', 400, 0.7); noi(t, D + run + 1.2, sb, bufPink); sw(sb.frequency, t, 500, 1500, D); sb.frequency.exponentialRampToValueAtTime(600, te);
    s.gain.setValueAtTime(0.0001, t); s.gain.exponentialRampToValueAtTime(0.6, tc); s.gain.linearRampToValueAtTime(0.35, te); s.gain.exponentialRampToValueAtTime(0.0001, te + 1.0);
    const r = gn(d), rf = flt(r, 'lowpass', 120, 0.8); noi(t, D + run + 2.0, rf, bufBrown); sw(rf.frequency, t, 160, 320, D); rf.frequency.exponentialRampToValueAtTime(140, te + 0.6);
    r.gain.setValueAtTime(0.0001, t); r.gain.exponentialRampToValueAtTime(0.9, tc); r.gain.linearRampToValueAtTime(0.6, te); r.gain.exponentialRampToValueAtTime(0.0001, te + 1.8);
    const hi = gn(d), hf = flt(hi, 'highpass', 2500); noi(t, D + run, hf); hi.gain.setValueAtTime(0.0001, t); hi.gain.exponentialRampToValueAtTime(0.12, tc); hi.gain.linearRampToValueAtTime(0.0001, te); // the crest hissing as it runs
    const g = gn(sh), o = osc('sine', 80, tc, 0.9, g); sw(o.frequency, tc, 105, 34, 0.5); ad(g.gain, tc, 0.9, 0.005, 0.7);
    const b = gn(sh), bf = flt(b, 'lowpass', 3000, 0.6); noi(tc, 1.7, bf); sw(bf.frequency, tc, 5500, 400, 1.4); ad(b.gain, tc, 0.85, 0.01, 1.4);
    const m = gn(d), mf = flt(m, 'bandpass', 330, 0.9); noi(tc, 1.1, mf, bufPink); ad(m.gain, tc, 0.9, 0.005, 0.9); // the crash, for small speakers
    const w = gn(d), wf = flt(w, 'bandpass', 3500, 0.6); noi(te - 0.2, 2.0, wf); sw(wf.frequency, te - 0.2, 4500, 1400, 1.8);
    w.gain.setValueAtTime(0.0001, te - 0.2); w.gain.linearRampToValueAtTime(0.18, te + 0.2); w.gain.exponentialRampToValueAtTime(0.0001, te + 1.7);
    grains(d, te, 30, 1.4, 0.12, 0.003, 0.012, 1500, 5000, 3, 1); // foam and pebbles as it drains
  };
  S.thunderstorm = (d, t) => { // the storm breaks: the rain thickens in a rush, a gust, and a strike overhead
    const D = 4.2, w = gn(d), wb = flt(w, 'bandpass', 2600, 0.5), wh = flt(gn(w, 0.6), 'highpass', 5500);
    noi(t, D + 0.3, wb); noi(t, D + 0.3, wh);
    w.gain.setValueAtTime(0.0001, t); w.gain.exponentialRampToValueAtTime(0.3, t + D * 0.6); w.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.2);
    grains(d, t + 0.3, 60, D - 0.6, 0.12, 0.002, 0.006, 2500, 8000, 3, 0); // the first heavy drops
    const g = gn(d), gf = flt(g, 'bandpass', 500, 1.2); noi(t, D, gf, bufPink); sw(gf.frequency, t, 300, 1300, D * 0.6); gf.frequency.exponentialRampToValueAtTime(500, t + D);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + D * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + D);
    thunderV(d, t + 0.3, TH.hook ? 0.3 : 1, 0.9); // with Ash's flashes the strikes bring the cracks: here only a far roll
  };

  // Boss entrance stings: short and different for each boss, played the first time one is seen.
  function stingHit(d, t, vel) { // a drum and a dull thud under each stab
    drumHit(d, t, vel, 50);
    const m = gn(d), mf = flt(m, 'bandpass', 300, 1); noi(t, 0.25, mf); ad(m.gain, t, vel * 0.6, 0.002, 0.18);
    const b = gn(d), bo = osc('triangle', 190, t, 0.3, b); sw(bo.frequency, t, 220, 110, 0.14); ad(b.gain, t, vel * 0.35, 0.002, 0.2);
  }
  const STING = {
    giant: (d, t) => { // DUN... DUN: two low brass stabs, the second a semitone down, bones rattling after
      [38, 45, 50].forEach((n) => brassNote(d, t, mtof(n), 0.32, 0.14, 0.9)); stingHit(d, t, 0.7);
      [37, 44, 49].forEach((n) => brassNote(d, t + 0.5, mtof(n), 1.1, 0.16, 0.95)); stingHit(d, t + 0.5, 0.95);
      grains(d, t + 0.6, 10, 0.8, 0.3, 0.012, 0.04, 600, 1900, 11, 1);
    },
    ogre: (d, t) => { // slow and heavy: two drum blows and a distorted brass chord sagging down
      stingHit(d, t, 0.7); stingHit(d, t + 0.55, 1);
      const sh = shape(d, 3), os = [];
      [36, 43].forEach((n) => os.push(hornNote(sh, t + 0.55, mtof(n), 1.3, 0.17, 0.8)));
      for (let j = 0; j < os.length; j++) for (let i = 0; i < os[j].length; i++) { const fr = os[j][i][0].frequency, b = os[j][i][1]; fr.setValueAtTime(b, t + 0.9); fr.exponentialRampToValueAtTime(b * 0.94, t + 1.8); }
    },
    jotun: (d, t) => { // cold: a cluster of high bells over a low brass swell, frost hissing
      const lp = flt(d, 'lowpass', 9000);
      [86, 89, 93, 98].forEach((n, i) => belld(lp, t + i * 0.07, mtof(n), 0.07, 1.6));
      [38, 45].forEach((n) => brassNote(d, t + 0.1, mtof(n), 1.3, 0.13, 0.85)); stingHit(d, t + 0.1, 0.8);
      const a = gn(lp), af = flt(a, 'highpass', 5500); noi(t, 1.8, af, bufPink); ad(a.gain, t, 0.06, 0.3, 1.4);
    },
    queen: (d, t) => { // skittering: a tremolo that climbs, then a screech and a hit
      const lp = flt(d, 'lowpass', 5000);
      for (let i = 0; i < 16; i++) { const ti = t + i * 0.055, f = mtof(62 + Math.floor(i / 3)), g = gn(lp), f2 = flt(g, 'lowpass', f * 5, 2); osc('sawtooth', f, ti, 0.08, f2); ad(g.gain, ti, 0.07 + i * 0.006, 0.003, 0.06); }
      const ts = t + 0.9, bp = flt(lp, 'bandpass', 3200, 3);
      for (let i = 0; i < 2; i++) { const ti = ts + i * 0.07, g = gn(bp), o = osc('square', 3600, ti, 0.1, g); sw(o.frequency, ti, 4000, 2400, 0.08); ad(g.gain, ti, 0.12, 0.004, 0.07); }
      stingHit(d, ts, 0.9); [37, 44].forEach((n) => brassNote(d, ts, mtof(n), 0.8, 0.1, 0.9));
    },
    colossus: (d, t) => { // the forge: three anvil strikes, then a distorted low brass blast
      const lp = flt(d, 'lowpass', 8000), R = [1, 2.71, 4.13];
      for (let k = 0; k < 3; k++) { const tk = t + k * 0.22; for (let i = 0; i < 3; i++) { const g = gn(lp); osc('sine', 880 * R[i] * rr(0.995, 1.005), tk, 0.6, g); ad(g.gain, tk, (0.14 + k * 0.03) / (1 + i), 0.001, 0.45 / (1 + i * 0.5)); } }
      const tb = t + 0.66, sh = shape(d, 3);
      [26, 33, 38].forEach((n) => brassNote(sh, tb, mtof(n + 12), 1.0, 0.09, 0.8)); stingHit(d, tb, 1);
    },
    king: (d, t) => { // a minor reed fanfare and a gong
      const notes = [[0, 62, 0.16], [0.18, 65, 0.16], [0.36, 69, 0.7], [1.08, 68, 0.6]];
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i], ti = t + n[0], f = mtof(n[1]), env = gn(d), pk = flt(flt(env, 'lowpass', 2800), 'peaking', 1150, 1.4); pk.gain.value = 8;
        osc('square', f, ti, n[2] + 0.2, gn(pk, 0.4)); env.gain.setValueAtTime(0.0001, ti); env.gain.linearRampToValueAtTime(0.18, ti + 0.03); env.gain.setTargetAtTime(0.0001, ti + n[2], 0.06);
      }
      const R = [1, 1.47, 2.09, 2.56], tg = t + 0.36;
      for (let i = 0; i < 4; i++) { const g = gn(d); osc('sine', 98 * R[i], tg, 2.4, g); g.gain.setValueAtTime(0.0001, tg); g.gain.linearRampToValueAtTime(0.2 / (1 + i), tg + 0.04 + i * 0.05); g.gain.exponentialRampToValueAtTime(0.0001, tg + 2.3 - i * 0.4); }
      stingHit(d, tg, 0.8);
    },
    leviathan: (d, t) => { // the drowned king rises: a sub drop under a breaking wave, a drowned choir on a Phrygian clash, a buoy bell
      const sh = shape(d, 2);
      const g = gn(sh), o = osc('sine', 55, t, 2.2, g); sw(o.frequency, t, 72, 27, 1.6); ad(g.gain, t, 0.8, 0.02, 1.9);
      const r = gn(d), rf = flt(r, 'lowpass', 300, 0.7); noi(t, 2.4, rf, bufBrown); sw(rf.frequency, t, 900, 150, 2); ad(r.gain, t, 0.7, 0.05, 2.1);
      stingHit(d, t, 0.8);
      [45, 52, 57, 58].forEach((n, i) => choirTone(d, t + 0.15 + i * 0.06, n, 2.0, 0.2)); // A E A Bb
      hornNote(d, t + 0.2, mtof(33), 1.8, 0.14, 0.7);
      const lp = flt(d, 'lowpass', 5000); belld(lp, t + 0.9, mtof(69), 0.06, 2.4); belld(lp, t + 1.9, mtof(69), 0.04, 2.2);
    },
  };
  let stingKey = 'giant';
  S.bossSting = (d, t) => { (STING[stingKey] || STING.giant)(d, t); };

  // ---- Round 3: music for each land, phase stingers and the menu sounds. ----
  // Each land's base music: a mode, its chords (bass + pad notes, calm-melody notes, which chords may follow),
  // a pad colour, a calm solo voice, a percussion kit, a lead for the motifs, and a tempo offset.
  // semi: the land's key against D (the drone, the choir and the stingers move with it).
  // The lantern motif, Lanternhold's musical signature: a figure rising from the fifth below to the third (A D E F in
  // D minor, sol do re mi in a major key), held, then falling home. The title theme is built on it; it is one of the
  // battle motifs in every land, the calm voice hums it now and then, and the wave-cleared and land-cleared stingers
  // rise through it. As scale degrees, and as a two-bar motif ([step, degree, length in steps]).
  const LANTERN = [-3, 0, 1, 2];
  const LANTERN_M = [[0, -3, 2], [2, 0, 2], [4, 1, 2], [6, 2, 10], [16, 1, 3], [19, 0, 3], [22, -1, 2], [24, 0, 8]];
  const DORIAN = [0, 2, 3, 5, 7, 9, 10], AEOLIAN = [0, 2, 3, 5, 7, 8, 10], HARMMIN = [0, 2, 3, 5, 7, 8, 11], PHRYGDOM = [0, 1, 4, 5, 7, 8, 10];
  const LANDMUS = {
    ashen: { semi: 0, tonic: 50, scale: DORIAN, pad: 'saw', calm: 'piano', kit: 'drums', lead: 'brass', bpm: 0, lvl: 1, // dark D Dorian, drums
      ch: [{ n: [38, 45, 50, 53, 57], m: [62, 65, 69, 72, 74, 76], to: [1, 2, 4, 3] }, // Dm
        { n: [31, 43, 47, 50, 55], m: [62, 67, 71, 74, 69], to: [0, 3, 4] }, // G: the Dorian major IV
        { n: [36, 43, 48, 52, 55], m: [64, 67, 72, 76, 69], to: [0, 1, 3] }, // C
        { n: [33, 40, 45, 48, 52], m: [64, 69, 72, 76, 67], to: [0, 1] }, // Am
        { n: [29, 41, 45, 48, 53], m: [60, 65, 69, 72, 77, 67], to: [2, 0, 1] }], // F
      arr: [[0, 0, 0.5], [0.45, 2, 0.5], [0.9, 4, 0.6], [1.5, 7, 1.6]] },
    frost: { semi: 2, tonic: 52, scale: AEOLIAN, pad: 'glass', calm: 'glass', kit: 'glass', lead: 'bell', bpm: -8, lvl: 0.75, sparse: 0.5, // sparse, glassy E minor
      ch: [{ n: [40, 47, 54, 55, 59], m: [71, 74, 76, 78, 79, 83], to: [1, 2, 3] }, // Em(add9)
        { n: [36, 43, 52, 55, 59], m: [71, 72, 76, 79, 83], to: [0, 3, 4] }, // Cmaj7
        { n: [43, 50, 57, 59, 62], m: [74, 79, 81, 83, 86], to: [0, 3] }, // G(add9)
        { n: [38, 45, 50, 52, 57], m: [74, 76, 78, 81], to: [0, 1, 4] }, // Dsus2
        { n: [35, 47, 50, 54, 57], m: [71, 74, 78, 81], to: [0, 1] }], // Bm7
      arr: [[0, 4, 0.8], [0.35, 7, 0.8], [0.7, 9, 0.8], [1.2, 11, 2.2]] },
    fen: { semi: 5, tonic: 55, scale: AEOLIAN, pad: 'murk', calm: 'reed', kit: 'frame', lead: 'reed', bpm: -4, lvl: 0.9, // murky G minor, woodwinds
      ch: [{ n: [31, 43, 46, 50, 55], m: [62, 65, 67, 70, 74], to: [1, 2, 3] }, // Gm
        { n: [39, 46, 50, 55, 58], m: [63, 67, 70, 74], to: [0, 2, 4] }, // Ebmaj7
        { n: [36, 43, 48, 51, 55], m: [60, 63, 67, 72], to: [0, 3, 1] }, // Cm
        { n: [32, 44, 48, 51, 56], m: [60, 63, 68, 72], to: [0, 4] }, // Ab: the dark flat II
        { n: [38, 45, 50, 53, 57], m: [62, 65, 69, 74], to: [0, 1] }], // Dm
      arr: [[0, 0, 0.7], [0.6, 2, 0.5], [1.05, 1, 0.5], [1.5, -1, 0.5], [2.0, 0, 1.6]] },
    ember: { semi: -2, tonic: 48, scale: HARMMIN, pad: 'brass', calm: 'lowbrass', kit: 'heavy', lead: 'lowbrass', bpm: -6, lvl: 1.5, // heavy C harmonic minor, low brass
      ch: [{ n: [36, 43, 48, 51, 55], m: [60, 63, 67, 72, 75], to: [1, 2, 3] }, // Cm
        { n: [32, 44, 48, 51, 56], m: [60, 63, 68, 72], to: [0, 4, 3] }, // Ab
        { n: [29, 41, 44, 48, 53], m: [60, 65, 68, 72], to: [3, 0, 4] }, // Fm
        { n: [31, 43, 47, 50, 55], m: [62, 67, 71, 74], to: [0, 1] }, // G: the harsh major V
        { n: [37, 44, 49, 53, 56], m: [61, 65, 68, 73], to: [3, 0] }], // Db: the Neapolitan
      arr: [[0, 0, 0.9], [0.9, -1, 0.5], [1.35, 0, 0.5], [1.8, 4, 1.8]] },
    dunes: { semi: 2, tonic: 52, scale: PHRYGDOM, pad: 'nasal', calm: 'oud', kit: 'hand', lead: 'ney', bpm: 4, lvl: 1, // E Phrygian dominant, hand drums
      ch: [{ n: [40, 47, 52, 56, 59], m: [64, 65, 68, 71, 76], to: [1, 2, 3] }, // E
        { n: [41, 48, 53, 57, 60], m: [65, 69, 72, 76, 77], to: [0, 2] }, // F
        { n: [38, 45, 50, 53, 57], m: [62, 65, 69, 74], to: [1, 0, 3] }, // Dm
        { n: [33, 45, 52, 57, 60], m: [64, 69, 72, 76], to: [0, 4, 2] }, // Am
        { n: [40, 47, 50, 56, 59], m: [64, 68, 71, 74, 76], to: [0, 1] }], // E7
      arr: [[0, 4, 0.3], [0.25, 5, 0.3], [0.5, 4, 0.3], [0.75, 2, 0.3], [1.0, 1, 0.4], [1.45, 0, 1.6]] },
    storm: { semi: -5, tonic: 45, scale: AEOLIAN, pad: 'strings', calm: 'cello', kit: 'storm', lead: 'concertina', bpm: -2, lvl: 0.85, // stormy A minor: low strings, timpani and taiko, a squeezebox shanty
      ch: [{ n: [33, 45, 48, 52, 57], m: [57, 60, 64, 69, 72], to: [1, 2, 3] }, // Am
        { n: [29, 41, 45, 48, 53], m: [57, 60, 65, 69], to: [0, 4, 2] }, // F
        { n: [31, 43, 47, 50, 55], m: [59, 62, 67, 71], to: [0, 3] }, // G
        { n: [28, 40, 47, 52, 55], m: [59, 64, 67, 71], to: [0, 1, 4] }, // Em: the minor v, no leading tone
        { n: [26, 38, 45, 50, 53], m: [57, 62, 65, 69], to: [0, 1] }], // Dm
      // Its own motifs, sea-shanty shapes in place of the shared ones: a falling lament, a hauling call and answer, a long descent.
      motifs: [[[0, 4, 4], [4, 4, 2], [6, 3, 2], [8, 2, 4], [12, 0, 4], [16, 1, 6], [22, 2, 2], [24, 0, 8]],
        [[0, 0, 2], [2, 0, 2], [4, 2, 4], [8, 4, 6], [14, 5, 2], [16, 4, 4], [20, 2, 4], [24, 1, 8]],
        [[0, 7, 6], [6, 6, 2], [8, 4, 4], [12, 3, 4], [16, 2, 6], [22, 1, 2], [24, 0, 8]], LANTERN_M],
      arr: [[0, 4, 0.45], [0.45, 3, 0.3], [0.8, 2, 0.35], [1.2, 0, 0.6], [1.9, 1, 0.35], [2.3, 0, 1.6]] },
  };
  const LM = { def: LANDMUS.ashen, key: 'ashen', bus: null, old: [] };
  const deg = (L, d) => { const n = L.scale.length, o = Math.floor(d / n); return L.tonic + 12 * o + L.scale[((d % n) + n) % n]; };
  function landNow() { // the land on screen right now (the stingers read it when they play); generated lands included
    const b = typeof G !== 'undefined' && G && G.B && G.B.bio, lf = b ? landFor(b) : null;
    return lf ? lf.L : LM.def || LANDMUS.ashen;
  }

  // Solo voices, each written to a destination node.
  function pianoTone(d, t, m, vel) {
    const f = mtof(m), lp = flt(d, 'lowpass', 2200, 0.4);
    lp.frequency.setValueAtTime(Math.min(3200, f * 5), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.3), t + 2.2);
    const dec = 3.6 * Math.pow(440 / f, 0.35), H = [[1, 1, 1], [2.002, 0.3, 0.55], [3.006, 0.1, 0.35], [4.012, 0.04, 0.22]];
    for (let i = 0; i < H.length; i++) { const h = H[i], g = gn(lp); osc('sine', f * h[0], t, dec * h[2] + 0.1, g); ad(g.gain, t, vel * 0.11 * h[1], 0.007, dec * h[2]); }
    const tg = gn(lp); osc('triangle', f, t, dec * 0.5, tg); ad(tg.gain, t, vel * 0.03, 0.006, dec * 0.4);
    const n = gn(d), nf = flt(n, 'lowpass', 900); noi(t, 0.05, nf); ad(n.gain, t, vel * 0.03, 0.002, 0.03);
  }
  function glassTone(d, t, m, vel) { // a struck wine glass: almost pure, a slow beat, a long ring
    const f = mtof(m), dec = 3.2 * Math.pow(880 / f, 0.3), H = [[1, 1, 1], [1.004, 0.5, 0.9], [2.0, 0.18, 0.5], [3.01, 0.05, 0.25]];
    for (let i = 0; i < H.length; i++) { const h = H[i], g = gn(d); osc('sine', f * h[0], t, dec * h[2] + 0.1, g); ad(g.gain, t, vel * 0.07 * h[1], 0.012, dec * h[2]); }
    const n = gn(d), nf = flt(n, 'highpass', 5000); noi(t, 0.03, nf); ad(n.gain, t, vel * 0.015, 0.001, 0.012);
  }
  function reedTone(d, t, m, dur, vel) { // a woodwind: odd harmonics, a breathy onset, vibrato that comes in late
    const f = mtof(m), env = gn(d), lp = flt(env, 'lowpass', Math.min(2600, f * 5), 0.7), pk = flt(lp, 'peaking', 1300, 1.2); pk.gain.value = 4;
    const o = osc('square', f, t, dur + 0.3, gn(pk, 0.32)), o2 = osc('triangle', f, t, dur + 0.3, gn(pk, 0.5));
    const vib = gn(null, 0); osc('sine', rr(4.6, 5.4), t, dur + 0.3, vib); vib.connect(o.detune); vib.connect(o2.detune);
    vib.gain.setValueAtTime(0, t + 0.25); vib.gain.linearRampToValueAtTime(10, t + Math.max(0.3, dur * 0.8));
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(vel * 0.13, t + 0.09); env.gain.setValueAtTime(vel * 0.13, t + dur * 0.6); env.gain.linearRampToValueAtTime(vel * 0.1, t + dur); env.gain.setTargetAtTime(0.0001, t + dur, 0.09);
    const b = gn(d), bf = flt(b, 'bandpass', Math.min(4000, f * 3), 1.2); noi(t, dur + 0.2, bf, bufPink);
    b.gain.setValueAtTime(0.0001, t); b.gain.linearRampToValueAtTime(vel * 0.03, t + 0.05); b.gain.linearRampToValueAtTime(vel * 0.008, t + 0.3); b.gain.setTargetAtTime(0.0001, t + dur, 0.08);
  }
  function oudTone(d, t, m, vel, orn) { // a plucked lute: a bright pluck that darkens fast, a body resonance, a grace note from above
    const pl = (tt, mm, v) => {
      const f = mtof(mm), g = gn(d), body = flt(g, 'peaking', 380, 1.5), lp = flt(body, 'lowpass', f * 8, 1.4); body.gain.value = 5;
      const o = osc('sawtooth', f, tt, 0.9, lp); o.detune.value = rr(-4, 4); sw(lp.frequency, tt, Math.min(7000, f * 9), f * 1.6, 0.35);
      ad(g.gain, tt, v * 0.12, 0.002, 0.75);
    };
    if (orn) pl(t - 0.07, m + 1, vel * 0.55);
    pl(t, m, vel);
    if (rnd() < 0.35) pl(t + 0.12, m, vel * 0.4);
  }
  function celloTone(d, t, m, dur, vel) { // a bowed low string: two saws, a wooden body, a slow bow, vibrato that comes in late, some rosin
    const f = mtof(m), env = gn(d), body = flt(env, 'peaking', 280, 1.2), lp = flt(body, 'lowpass', Math.min(3000, f * 6), 0.7), pk = flt(lp, 'peaking', 1100, 1.5);
    body.gain.value = 5; pk.gain.value = 3;
    const vib = gn(null, 0); osc('sine', rr(5, 5.8), t, dur + 0.6, vib);
    for (let i = 0; i < 2; i++) { const o = osc('sawtooth', f, t, dur + 0.6, gn(pk, 0.4)); o.detune.value = i ? 4 : -4; vib.connect(o.detune); }
    vib.gain.setValueAtTime(0, t + 0.2); vib.gain.linearRampToValueAtTime(14, t + Math.max(0.3, dur * 0.7));
    const a = Math.min(0.22, dur * 0.4);
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(vel * 0.12, t + a); env.gain.linearRampToValueAtTime(vel * 0.1, t + Math.max(a + 0.01, dur * 0.7)); env.gain.setTargetAtTime(0.0001, t + dur, 0.15);
    const b = gn(d), bf = flt(b, 'bandpass', Math.min(5000, f * 8), 1); noi(t, dur + 0.3, bf, bufPink);
    b.gain.setValueAtTime(0.0001, t); b.gain.linearRampToValueAtTime(vel * 0.02, t + a * 0.5); b.gain.linearRampToValueAtTime(vel * 0.006, t + a * 2); b.gain.setTargetAtTime(0.0001, t + dur, 0.1);
  }
  function concertina(d, t, m, dur, vel) { // a squeezebox: free reeds in pairs tuned a little apart so they beat, and the bellows swell
    const f = mtof(m), env = gn(d), lp = flt(env, 'lowpass', Math.min(4200, f * 7), 0.6), pk = flt(lp, 'peaking', 1400, 1.2); pk.gain.value = 5;
    [[-7, 'square', 0.22], [6, 'square', 0.22], [0, 'sawtooth', 0.16]].forEach((r) => { const o = osc(r[1], f, t, dur + 0.3, gn(pk, r[2])); o.detune.value = r[0]; });
    osc('sawtooth', f / 2, t, dur + 0.3, gn(pk, 0.08));
    const a = Math.min(0.05, dur * 0.3);
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(vel * 0.8, t + a); env.gain.linearRampToValueAtTime(vel, t + Math.max(a + 0.01, dur * 0.55)); env.gain.setTargetAtTime(0.0001, t + dur, 0.06);
  }
  function timpHit(d, t, vel, f) { // a kettle drum with partials a small speaker still plays
    const g = gn(d), o = osc('sine', f, t, 1.0, g); sw(o.frequency, t, f * 1.08, f, 0.06); ad(g.gain, t, vel, 0.004, 0.8);
    const g2 = gn(d); osc('sine', f * 1.5, t, 0.6, g2); ad(g2.gain, t, vel * 0.4, 0.004, 0.45);
    const g3 = gn(d); osc('sine', f * 2.02, t, 0.4, g3); ad(g3.gain, t, vel * 0.3, 0.003, 0.3);
    const g4 = gn(d); osc('triangle', f * 2.9, t, 0.25, g4); ad(g4.gain, t, vel * 0.18, 0.002, 0.16);
    const n = gn(d), nf = flt(n, 'bandpass', 520, 1); noi(t, 0.1, nf, bufPink); ad(n.gain, t, vel * 0.5, 0.002, 0.06);
  }
  function cymbal(d, t, vel, len) {
    const g = gn(d), f = flt(flt(g, 'highpass', 3200), 'lowpass', 11000); noi(t, len + 0.1, f);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  }
  function calmTone(d, t, m, vel, L) { // the land's solo voice for calm melodies and stingers
    const c = L.calm;
    if (c === 'glass') glassTone(d, t, m + 12, vel);
    else if (c === 'reed') reedTone(d, t, m, rr(1.3, 2.2), vel * 0.9);
    else if (c === 'lowbrass') brassNote(d, t, mtof(m - 12), rr(1.6, 2.3), 0.1 * vel, 0.75);
    else if (c === 'oud') oudTone(d, t, m - 12, vel, rnd() < 0.6);
    else if (c === 'cello') celloTone(d, t, m - 12, rr(1.8, 2.8), vel);
    else pianoTone(d, t, m, vel);
  }
  // A chord swell in the land's pad colour, for the arrival stinger.
  function landSwell(d, t, notes, dur, peak, L) {
    const P = PADV[L.pad] || PADV.saw, env = gn(d), lp = flt(env, 'lowpass', P.lp[0], P.q);
    lp.frequency.setValueAtTime(P.lp[0], t); lp.frequency.linearRampToValueAtTime(P.lp[2] * 1.4, t + dur * 0.6); lp.frequency.linearRampToValueAtTime(P.lp[3], t + dur);
    for (let i = 0; i < notes.length; i++) { const f = mtof(notes[i] + (i && P.up ? P.up : 0)); for (let s = 0; s < 2; s++) { const o = osc(P.w[0], f, t, dur + 0.3, gn(lp, 0.1)); o.detune.value = (s ? 1 : -1) * rr(P.det[0], P.det[1]); } }
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(peak, t + dur * 0.45); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  // The land is cleared (the boss falls): a timpani roll, a brass "ta-ta-ta TAAA" in the land's major key, bells and a cymbal.
  S.fanfare = (d, t) => {
    const T = 62 + landNow().semi, sh = shape(d, 1.2);
    for (let i = 0; i < 10; i++) timpHit(d, t + i * 0.055, 0.12 + 0.03 * i, mtof(T - 24));
    const cs = gn(d), cf = flt(cs, 'highpass', 4500); noi(t, 0.65, cf); cs.gain.setValueAtTime(0.0001, t); cs.gain.exponentialRampToValueAtTime(0.07, t + 0.6); cs.gain.linearRampToValueAtTime(0.0001, t + 0.66);
    const MEL = [[0.62, -5, 0.12], [0.77, 0, 0.12], [0.92, 2, 0.12], [1.1, 4, 0.48], [1.62, 2, 0.24], [1.9, 7, 1.5]]; // the lantern rising, in major
    for (let i = 0; i < MEL.length; i++) { const e = MEL[i]; brassNote(sh, t + e[0], mtof(T + e[1]), e[2], 0.2, 1.3); brassNote(sh, t + e[0], mtof(T + e[1] - 12), e[2], 0.08, 1); }
    [0, 7, 12, 16].forEach((n) => brassNote(sh, t + 1.1, mtof(T - 12 + n), 2.3, 0.075, 1.0));
    hornNote(d, t + 1.1, mtof(T - 24), 2.2, 0.16, 0.9);
    timpHit(d, t + 1.1, 0.55, mtof(T - 24)); timpHit(d, t + 1.9, 0.6, mtof(T - 24));
    const lp = flt(d, 'lowpass', 9000);
    [86, 90, 93, 98].forEach((n, i) => belld(lp, t + 1.9 + i * 0.06, mtof(n + landNow().semi), 0.045, 1.8));
    cymbal(d, t + 1.9, 0.09, 1.8);
  };
  // Defeat: after the beacon goes out, a slow horn lament falls to the land's minor tonic over a low swell and a far bell.
  S.lament = (d, t) => {
    const T = 62 + landNow().semi, t0 = t + 0.9;
    softChord(d, t0, [T - 24, T - 17, T - 12, T - 9], 5.4, 0.1);
    const MEL = [[0, 7, 0.75], [0.8, 8, 0.45], [1.3, 7, 0.95], [2.35, 3, 0.65], [3.05, 2, 0.6], [3.7, 0, 1.7]];
    for (let i = 0; i < MEL.length; i++) { const e = MEL[i]; hornNote(d, t0 + e[0], mtof(T + e[1] - 12), e[2], 0.24, 0.62); }
    const lp = flt(d, 'lowpass', 4000);
    belld(lp, t0 + 3.7, mtof(T - 5), 0.07, 3.2); belld(lp, t0 + 5.2, mtof(T - 5), 0.045, 3);
    const w = gn(d), wf = flt(w, 'bandpass', 700, 0.8); noi(t0, 5.5, wf, bufPink); ad(w.gain, t0, 0.04, 2, 3.3);
  };
  // A new land rises: its chord swells in its own pad colour and its solo voice plays a short figure in its mode.
  S.arrival = (d, t) => {
    const L = landNow(), c = L.ch[0], t1 = t + 0.9;
    landSwell(d, t + 0.2, c.n.slice(1), 4.2, 0.5, L);
    for (let i = 0; i < L.arr.length; i++) { const e = L.arr[i], m = deg(L, e[1]) + 12;
      if (L.calm === 'reed') reedTone(d, t1 + e[0], m, e[2], 0.9); else if (L.calm === 'lowbrass') brassNote(d, t1 + e[0], mtof(m - 12), e[2], 0.22, 0.9); else if (L.calm === 'oud') oudTone(d, t1 + e[0], m - 12, 1.5, i === 0); else if (L.calm === 'cello') celloTone(d, t1 + e[0], m - 12, e[2] + 0.25, 1.3); else calmTone(d, t1 + e[0], m, 0.9, L); }
    const te = t1 + L.arr[L.arr.length - 1][0];
    if (L.kit === 'hand') { dumD(d, te, 0.5); tekD(d, te + 0.18, 0.35); tekD(d, te + 0.3, 0.3); }
    else if (L.kit === 'glass') { const lp = flt(d, 'lowpass', 9000); for (let i = 0; i < 5; i++) belld(lp, te + i * 0.05, mtof(deg(L, 7 + i * 2) + 24), 0.03, 1.4); }
    else if (L.kit === 'frame') { frameD(d, te, 0.45); frameD(d, te + 0.36, 0.3); }
    else if (L.kit === 'storm') { for (let i = 0; i < 8; i++) timpHit(d, te + i * 0.06, 0.08 + 0.05 * i, mtof(L.tonic - 12)); }
    else timpHit(d, te, L.kit === 'heavy' ? 0.55 : 0.4, mtof(deg(L, 0) - 24));
  };
  // A wave is cleared: the land's voice plays the lantern figure, very soft.
  S.waveClear = (d, t) => {
    const L = landNow(), D = LANTERN;
    for (let i = 0; i < D.length; i++) { const m = deg(L, D[i]) + 12, tt = t + i * 0.13, v = i === 3 ? 0.7 : 0.5;
      if (L.calm === 'reed') reedTone(d, tt, m, i === 3 ? 0.7 : 0.14, v); else if (L.calm === 'lowbrass') brassNote(d, tt, mtof(m), i === 3 ? 0.7 : 0.14, 0.2 * v, 1); else if (L.calm === 'oud') oudTone(d, tt, m, v * 2.5, false); else if (L.calm === 'glass') glassTone(d, tt, m + 12, v * 1.4); else if (L.calm === 'cello') concertina(d, tt, m, i === 3 ? 0.7 : 0.14, v * 0.14); else pianoTone(d, tt, m + 12, v); }
    const a = gn(d), af = flt(a, 'bandpass', 2500, 0.7); noi(t, 0.9, af, bufPink); ad(a.gain, t, 0.025, 0.25, 0.6);
  };
  // Menus.
  S.menuOpen = (d, t, p) => { // a soft wooden "tock" and a short rising swish; the branch menu (p = 1) adds a glint
    const g = gn(d), o = osc('triangle', 520, t, 0.08, g); sw(o.frequency, t, 470, 700, 0.05); ad(g.gain, t, 0.16, 0.002, 0.06);
    const k = gn(d), kf = flt(k, 'bandpass', 1100, 4); noi(t, 0.04, kf); ad(k.gain, t, 0.14, 0.001, 0.02);
    const s = gn(d), sf = flt(s, 'bandpass', 1500, 1.2); noi(t, 0.14, sf, bufPink); sw(sf.frequency, t, 900, 3200, 0.1); ad(s.gain, t, 0.05, 0.03, 0.08);
    if (p > 0.5) { const lp = flt(d, 'lowpass', 9000); belld(lp, t + 0.05, mtof(86), 0.035, 0.8); belld(lp, t + 0.11, mtof(93), 0.025, 0.9); }
  };
  S.uiPreview = (d, t, p) => { // one soft pluck; the two branches sit a fourth apart
    const f = p > 0.5 ? 1046.5 : 784, g = gn(d), lp = flt(g, 'lowpass', 4000);
    osc('triangle', f, t, 0.18, lp); osc('sine', f * 2, t, 0.1, gn(lp, 0.15)); ad(g.gain, t, 0.13, 0.002, 0.14);
    const c = gn(d), cf = flt(c, 'bandpass', 2600, 2); noi(t, 0.02, cf); ad(c.gain, t, 0.04, 0.0005, 0.008);
  };
  S.spellArm = (d, t, p) => { // a short rising swish in the spell's colour: fire (0), frost (0.5), the bugle (1)
    const s = gn(d), sf = flt(s, 'bandpass', 800, 1.4); noi(t, 0.32, sf, bufPink); sw(sf.frequency, t, 500, 2600, 0.26);
    s.gain.setValueAtTime(0.0001, t); s.gain.exponentialRampToValueAtTime(0.12, t + 0.2); s.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    if (p < 0.25) { const g = gn(d), o = osc('triangle', 196, t, 0.4, flt(g, 'lowpass', 900)); sw(o.frequency, t, 160, 260, 0.3); ad(g.gain, t, 0.16, 0.05, 0.3); grains(d, t + 0.05, 7, 0.3, 0.1, 0.003, 0.01, 1800, 5000, 3, 1); }
    else if (p < 0.75) { const lp = flt(d, 'lowpass', 9000); belld(lp, t + 0.08, mtof(88), 0.05, 0.9); belld(lp, t + 0.16, mtof(95), 0.035, 1); }
    else { brassNote(d, t + 0.04, mtof(67), 0.1, 0.12, 1.2); brassNote(d, t + 0.16, mtof(72), 0.22, 0.12, 1.25); }
  };
  S.spellCancel = (d, t) => { // the same swish falling away, and a soft drop
    const s = gn(d), sf = flt(s, 'bandpass', 1800, 1.4); noi(t, 0.26, sf, bufPink); sw(sf.frequency, t, 2400, 500, 0.22); ad(s.gain, t, 0.08, 0.02, 0.2);
    const g = gn(d), o = osc('triangle', 660, t, 0.2, g); sw(o.frequency, t, 660, 400, 0.14); ad(g.gain, t, 0.1, 0.003, 0.15);
  };
  S.mend = (d, t) => { // the beacon mended: a warm rising major arpeggio over a soft swell
    const T = 74 + landNow().semi, lp = flt(d, 'lowpass', 7000);
    [0, 4, 7, 12].forEach((n, i) => { const g = gn(lp), f = mtof(T + n); osc('sine', f, t + i * 0.08, 1.2, g); osc('sine', f * 2.0, t + i * 0.08, 0.5, gn(g, 0.12)); ad(g.gain, t + i * 0.08, 0.1, 0.004, 1.0); });
    softChord(d, t, [T - 24, T - 17, T - 12, T - 8], 1.6, 0.09);
    const a = gn(d), af = flt(a, 'bandpass', 1800, 0.8); noi(t, 0.9, af, bufPink); ad(a.gain, t, 0.05, 0.2, 0.6);
  };
  S.overcharge = (d, t, p) => { // a surge rising through a resonance, crackle, then a ringing lock; higher with each stack
    const k = Math.pow(2, (p * 3 * 2) / 12), g = gn(d), bp = flt(g, 'bandpass', 700, 3), o = osc('sawtooth', 110 * k, t, 0.5, bp);
    sw(o.frequency, t, 100 * k, 220 * k, 0.4); sw(bp.frequency, t, 500, 2600 * k, 0.42);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.38); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
    grains(d, t + 0.1, 10, 0.35, 0.12, 0.003, 0.012, 2500, 6500, 3, 2);
    const lp = flt(d, 'lowpass', 8000), R = [1, 2.4, 3.9];
    for (let i = 0; i < 3; i++) { const cg = gn(lp); osc(i ? 'sine' : 'triangle', 660 * k * R[i], t + 0.42, 1.0, cg); ad(cg.gain, t + 0.42, 0.11 / (1 + i), 0.002, 0.8 / (1 + i * 0.6)); }
    const th = gn(d), to = osc('triangle', 180 * k, t + 0.42, 0.2, th); sw(to.frequency, t + 0.42, 220 * k, 120 * k, 0.1); ad(th.gain, t + 0.42, 0.25, 0.002, 0.12);
  };
  // ---- Round 4: the siege ram, goblin shaman, harpy and hell hound. The beast watcher (beastTick, below) plays these
  // on its own from G.mons; the game may also call ramHit, shamanWard, harpyScreech and houndHowl itself. ----
  function knock(d, t, vel, f) { // a hollow wooden knock: a short low tone and a dry bark of noise
    const g = gn(d), o = osc('sine', f, t, 0.12, g); sw(o.frequency, t, f * 1.15, f * 0.9, 0.04); ad(g.gain, t, vel, 0.001, 0.08);
    const n = gn(d), nf = flt(n, 'bandpass', f * 2.2, 3); noi(t, 0.05, nf); ad(n.gain, t, vel * 0.6, 0.0008, 0.03);
  }
  function ironRing(d, t, f, vel, len) { // a dull iron band: inharmonic, short
    const R = [1, 2.32, 3.86, 5.1];
    for (let i = 0; i < 4; i++) { const g = gn(d); osc('sine', f * R[i] * rr(0.996, 1.004), t, len / (1 + i * 0.5) + 0.05, g); ad(g.gain, t, vel / (1 + i * 0.8), 0.001, len / (1 + i * 0.5)); }
  }
  // A formant voice: a saw (and an optional growl an octave down) through two vowel bands and a chest band.
  // Returns { env, o, sub, f1, f2 }: the caller shapes the pitch, the vowels and the level.
  function throat(d, t, dur, f0, growl) {
    const env = gn(d), src = gn(null, 1), f1 = flt(env, 'bandpass', 500, 4), f2 = flt(gn(env, 0.55), 'bandpass', 1000, 6);
    src.connect(f1); src.connect(f2); src.connect(flt(gn(env, 0.5), 'lowpass', 280));
    const o = osc('sawtooth', f0, t, dur, src), sub = growl ? osc('square', f0 / 2, t, dur, gn(src, growl)) : null;
    return { env: env, o: o, sub: sub, f1: f1, f2: f2 };
  }
  S.ramHit = (d, t) => { // the iron-capped log slams a footman aside: a deep thud, a wooden boom, a crack and a dull clank
    const k = rr(0.9, 1.1), sh = shape(d, 2);
    const g = gn(sh), o = osc('sine', 85 * k, t, 0.5, g); sw(o.frequency, t, 115 * k, 40 * k, 0.22); ad(g.gain, t, 0.75, 0.003, 0.35);
    const b = gn(d), bo = osc('triangle', 190 * k, t, 0.3, flt(b, 'lowpass', 900)); sw(bo.frequency, t, 235 * k, 115 * k, 0.14); ad(b.gain, t, 0.75, 0.002, 0.2);
    const m = gn(d), mf = flt(m, 'bandpass', 340 * k, 1.1); noi(t, 0.3, mf, bufPink); ad(m.gain, t, 2.0, 0.002, 0.17);
    knock(d, t, 0.5, 300 * k);
    const c = gn(d), cf = flt(c, 'bandpass', 1500 * k, 1.2); noi(t, 0.06, cf); ad(c.gain, t, 0.45, 0.0008, 0.035);
    ironRing(flt(d, 'lowpass', 5000), t + 0.005, 410 * k, 0.07, 0.22);
    grains(d, t + 0.03, 5, 0.25, 0.15, 0.01, 0.03, 500, 1800, 5, 1);
  };
  S.ramCreak = (d, t) => { // the frame groaning on its axles, and a wheel knocking over a stone
    const D = rr(0.45, 1.0), g = gn(d), src = gn(null, 1), fb = rr(380, 620);
    src.connect(flt(g, 'bandpass', fb, 6)); src.connect(flt(gn(g, 0.4), 'bandpass', fb * 1.7, 8));
    const o = osc('sawtooth', 24, t, D + 0.05, src); o.frequency.setValueAtTime(rr(16, 22), t); o.frequency.linearRampToValueAtTime(rr(38, 60), t + D * 0.6); o.frequency.linearRampToValueAtTime(rr(20, 28), t + D);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.6, t + D * 0.3); g.gain.linearRampToValueAtTime(0.4, t + D * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + D);
    if (rnd() < 0.7) knock(d, t + rr(0.05, D), rr(0.25, 0.4), rr(170, 250));
  };
  S.ramDie = (d, t) => { // a splintering crash: the frame snaps, beams clatter down, an iron band rings, the dust settles
    const sh = shape(d, 2);
    const g = gn(sh), o = osc('sine', 78, t, 0.6, g); sw(o.frequency, t, 100, 30, 0.4); ad(g.gain, t, 0.9, 0.003, 0.5);
    const b = gn(d), bf = flt(b, 'bandpass', 260, 0.9); noi(t, 0.6, bf, bufPink); ad(b.gain, t, 1.1, 0.003, 0.45);
    for (let i = 0; i < 11; i++) { const ti = t + Math.pow(rnd(), 1.6) * 0.65, c = gn(d), cf = flt(c, 'bandpass', rr(700, 2600), rr(3, 8)); noi(ti, 0.08, cf); ad(c.gain, ti, rr(0.2, 0.45), 0.0008, rr(0.02, 0.06)); }
    const cr = gn(d), cb = flt(cr, 'bandpass', 560, 6), co = osc('sawtooth', 30, t, 0.55, cb); sw(co.frequency, t, 34, 12, 0.5); ad(cr.gain, t, 0.45, 0.02, 0.45);
    for (let i = 0; i < 9; i++) knock(d, t + 0.22 + i * rr(0.08, 0.14) + rr(0, 0.04), 0.4 * (1 - i * 0.08), rr(230, 650));
    ironRing(flt(d, 'lowpass', 6000), t + 0.33, rr(360, 420), 0.09, 0.6);
    const r = gn(d), rf = flt(r, 'lowpass', 170); noi(t + 0.05, 1.5, rf, bufBrown); ad(r.gain, t + 0.05, 0.5, 0.1, 1.2);
  };
  // Goblin shaman: a guttural chant on the land's tonic, and a shimmering ward on its scale.
  S.shamanChant = (d, t) => {
    const L = landNow(), base = L.tonic - 12, n = 4 + ((rnd() * 4) | 0), sd = rr(0.17, 0.23), hold = rnd() < 0.6 ? rr(0.35, 0.6) : 0;
    const D = n * sd + hold + 0.25, v = throat(d, t, D + 0.1, mtof(base), 0.4);
    osc('sine', rr(24, 32), t, D + 0.1, gn(v.o.frequency, mtof(base) * 0.035)); // rasp
    const F1 = [400, 550, 700, 330], F2 = [800, 1100, 1250, 700], step = [0, 0, 0, 2, -1, 0, 1];
    v.env.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < n; i++) {
      const ti = t + i * sd, last = i === n - 1, m = last && hold ? deg(L, -3) - 12 : deg(L, step[(rnd() * step.length) | 0]) - 12, vw = (rnd() * 4) | 0, a = rr(0.55, 1) * 0.3;
      v.o.frequency.setTargetAtTime(mtof(m), ti, 0.02); if (v.sub) v.sub.frequency.setTargetAtTime(mtof(m) / 2, ti, 0.02);
      v.f1.frequency.setTargetAtTime(F1[vw], ti, 0.02); v.f2.frequency.setTargetAtTime(F2[vw], ti, 0.02);
      v.env.gain.setTargetAtTime(a, ti, 0.012);
      if (last && hold) v.env.gain.setTargetAtTime(0.0001, ti + hold, 0.08); else v.env.gain.setTargetAtTime(a * 0.25, ti + sd * 0.7, 0.02);
      if (rnd() < 0.5) { const c = gn(d), cf = flt(c, 'bandpass', rr(1800, 3200), 2); noi(ti, 0.03, cf); ad(c.gain, ti, 0.05, 0.001, 0.015); } // a k or a t
    }
    if (!hold) v.env.gain.setTargetAtTime(0.0001, t + n * sd, 0.04);
  };
  S.shamanWard = (d, t) => {
    const L = landNow(), lp = flt(d, 'lowpass', 9000), up = [0, 2, 4, 7, 9, 11];
    for (let i = 0; i < up.length; i++) belld(lp, t + i * 0.055, mtof(deg(L, up[i]) + 24), 0.04, 0.9);
    const sg = gn(lp), tr = gn(sg, 0.5); osc('sine', 9, t, 1.5, gn(tr.gain, 0.5)); // a held chord that shimmers
    [0, 2, 4].forEach((dg) => { const f = mtof(deg(L, dg) + 24); for (let s = 0; s < 2; s++) { const o = osc('sine', f, t + 0.1, 1.4, gn(tr, 0.12)); o.detune.value = s ? 8 : -8; } });
    sg.gain.setValueAtTime(0.0001, t + 0.1); sg.gain.linearRampToValueAtTime(0.1, t + 0.35); sg.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    const w = gn(d), wf = flt(w, 'bandpass', 900, 2); noi(t, 0.8, wf, bufPink); sw(wf.frequency, t, 400, 2600, 0.6); ad(w.gain, t, 0.14, 0.3, 0.45);
    const h = gn(d), ho = osc('triangle', mtof(L.tonic), t, 0.9, flt(h, 'lowpass', 900)); sw(ho.frequency, t, mtof(L.tonic - 5), mtof(L.tonic), 0.3); ad(h.gain, t, 0.16, 0.08, 0.7); // a hum a phone plays
  };
  S.shamanDie = (d, t) => { // a choked croak, and its ward magic escaping in a falling shimmer
    const L = landNow(), v = throat(d, t, 0.5, mtof(L.tonic - 7), 0.5);
    v.f1.frequency.value = 600; v.f2.frequency.value = 1150; sw(v.o.frequency, t, mtof(L.tonic - 7), mtof(L.tonic - 19), 0.4);
    osc('sine', 30, t, 0.5, gn(v.o.frequency, 12)); ad(v.env.gain, t, 0.32, 0.02, 0.38);
    const lp = flt(d, 'lowpass', 9000), dn = [11, 9, 7, 4, 2];
    for (let i = 0; i < dn.length; i++) belld(lp, t + 0.08 + i * 0.05, mtof(deg(L, dn[i]) + 24), 0.03, 0.6);
    const w = gn(d), wf = flt(w, 'bandpass', 2000, 1.5); noi(t + 0.05, 0.6, wf, bufPink); sw(wf.frequency, t + 0.05, 2800, 600, 0.5); ad(w.gain, t + 0.05, 0.1, 0.05, 0.45);
  };
  // Harpy: a shrill screech as it dives, heavy wing beats, a falling cry.
  S.harpyScreech = (d, t) => {
    const k = rr(0.92, 1.08), lp = flt(d, 'lowpass', 6500), g = gn(lp), src = gn(null, 1);
    src.connect(flt(g, 'bandpass', 2300 * k, 3)); src.connect(flt(gn(g, 0.6), 'bandpass', 3600 * k, 5)); src.connect(flt(gn(g, 0.7), 'bandpass', 1100 * k, 2));
    for (let i = 0; i < 2; i++) {
      const o = osc('sawtooth', 1250 * k, t, 0.65, src), fr = o.frequency, b = (i ? 1.012 : 1) * k;
      fr.setValueAtTime(900 * b, t); fr.exponentialRampToValueAtTime(1500 * b, t + 0.08); fr.linearRampToValueAtTime(1350 * b, t + 0.3); fr.exponentialRampToValueAtTime(950 * b, t + 0.58);
      osc('sine', rr(34, 42), t, 0.65, gn(fr, 55 * k)); osc('sine', 7, t, 0.65, gn(o.detune, 30));
    }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13, t + 0.04); g.gain.linearRampToValueAtTime(0.1, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    const w = gn(d), wf = flt(w, 'bandpass', 700, 1.2); noi(t + 0.1, 0.7, wf, bufPink); sw(wf.frequency, t + 0.1, 500, 1900, 0.6); ad(w.gain, t + 0.1, 0.2, 0.4, 0.3); // the dive's rush of air
  };
  S.harpyWings = (d, t) => {
    const n = 3 + (rnd() < 0.5 ? 1 : 0), per = rr(0.16, 0.22), k = rr(0.85, 1.15);
    for (let i = 0; i < n; i++) {
      const ti = t + i * per + rr(-0.01, 0.01), v = i === n - 1 ? 0.6 : 1;
      const f = gn(d), ff = flt(f, 'bandpass', rr(450, 650) * k, 1.1); noi(ti, 0.18, ff, bufPink); ad(f.gain, ti, 0.8 * v, 0.03, 0.11);
      const g = gn(d), o = osc('sine', 120 * k, ti, 0.12, g); sw(o.frequency, ti + 0.02, 125 * k, 70 * k, 0.08); ad(g.gain, ti + 0.02, 0.22 * v, 0.01, 0.08);
    }
    grains(d, t, 6, n * per, 0.06, 0.004, 0.015, 2200, 4800, 3, 0); // feathers
  };
  S.harpyDie = (d, t) => {
    const k = rr(0.92, 1.08), lp = flt(d, 'lowpass', 6000), g = gn(lp), src = gn(null, 1);
    src.connect(flt(g, 'bandpass', 2000 * k, 2.5)); src.connect(flt(gn(g, 0.7), 'bandpass', 1000 * k, 2));
    const o = osc('sawtooth', 1800 * k, t, 0.85, src), fr = o.frequency;
    fr.setValueAtTime(1700 * k, t); fr.exponentialRampToValueAtTime(2050 * k, t + 0.05); fr.exponentialRampToValueAtTime(560 * k, t + 0.75);
    const vib = gn(o.detune, 0); osc('sine', 9, t, 0.85, vib); vib.gain.setValueAtTime(10, t); vib.gain.linearRampToValueAtTime(70, t + 0.7);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.17, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    grains(d, t + 0.05, 10, 0.6, 0.08, 0.004, 0.015, 1500, 4200, 3, 1);
    for (let i = 0; i < 2; i++) { const ti = t + 0.15 + i * 0.2, f = gn(d), ff = flt(f, 'bandpass', 480, 1.3); noi(ti, 0.15, ff, bufPink); ad(f.gain, ti, 0.3 / (1 + i), 0.03, 0.1); }
  };
  // Hell hound: snarls, panting, a pack howl on the land's chord, a lick of fire, a yelp and a burst of embers.
  S.houndSnarl = (d, t) => {
    const k = rr(0.85, 1.15), D = rr(0.35, 0.6), v = throat(d, t, D + 0.05, 110 * k, 0);
    v.f1.frequency.value = 650 * k; v.f2.frequency.value = 1400 * k;
    const fr = v.o.frequency; fr.setValueAtTime(95 * k, t); fr.linearRampToValueAtTime(140 * k, t + 0.1); fr.linearRampToValueAtTime(100 * k, t + D);
    osc('sine', rr(28, 38), t, D + 0.05, gn(fr, 45 * k)); // the rattle in its throat
    v.env.gain.setValueAtTime(0.0001, t); v.env.gain.linearRampToValueAtTime(0.42, t + 0.05); v.env.gain.linearRampToValueAtTime(0.32, t + D * 0.7); v.env.gain.exponentialRampToValueAtTime(0.0001, t + D);
    const b = gn(d), bf = flt(b, 'bandpass', 2200, 1.2); noi(t, D, bf, bufPink); ad(b.gain, t, 0.06, 0.04, D * 0.8);
    grains(d, t + 0.05, 4, D, 0.06, 0.003, 0.01, 2500, 6000, 3, 0); // embers in its maw
  };
  S.houndPant = (d, t) => {
    const k = rr(0.85, 1.15), n = 4 + ((rnd() * 3) | 0), per = rr(0.11, 0.14);
    for (let i = 0; i < n; i++) {
      const ti = t + i * per, out = i % 2 === 0, g = gn(d), f = flt(g, 'bandpass', (out ? 1700 : 1300) * k, 2); noi(ti, per, f, bufPink); ad(g.gain, ti, out ? 0.9 : 0.55, 0.015, per * 0.7);
      if (out) { const h = gn(d), ho = osc('sawtooth', 150 * k, ti, per, flt(h, 'bandpass', 700 * k, 3)); ho.detune.value = rr(-30, 30); ad(h.gain, ti, 0.2, 0.01, per * 0.6); }
    }
  };
  S.houndHowl = (d, t) => {
    const L = landNow(), parts = [[0, 0], [0.35, 4], [0.7, 2]];
    for (let j = 0; j < parts.length; j++) {
      const t0 = t + parts[j][0] + rr(-0.03, 0.03), m = deg(L, parts[j][1]) + 12, f = mtof(m), D = 1.9 - j * 0.25, env = gn(d), lp = flt(env, 'lowpass', 2600);
      const o = osc('sine', f, t0, D + 0.1, lp), e = osc('sawtooth', f, t0, D + 0.1, gn(flt(lp, 'bandpass', 950, 2), 0.25)), vib = gn(null, 0);
      osc('sine', rr(5, 6), t0, D + 0.1, vib); vib.connect(o.detune); vib.connect(e.detune); vib.gain.setValueAtTime(0, t0); vib.gain.linearRampToValueAtTime(18, t0 + D * 0.7);
      [o, e].forEach((x) => { x.frequency.setValueAtTime(f * 0.75, t0); x.frequency.exponentialRampToValueAtTime(f, t0 + 0.35); x.frequency.setValueAtTime(f, t0 + D * 0.7); x.frequency.exponentialRampToValueAtTime(f * 0.78, t0 + D); });
      env.gain.setValueAtTime(0.0001, t0); env.gain.linearRampToValueAtTime(0.085, t0 + 0.3); env.gain.linearRampToValueAtTime(0.07, t0 + D * 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t0 + D);
    }
    const r = gn(d), rf = flt(r, 'bandpass', 380, 0.8); noi(t, 2.2, rf, bufBrown); ad(r.gain, t, 0.25, 0.5, 1.6); // fire breathing under it
  };
  S.houndFire = (d, t) => { // the trail catching: a soft whoosh and a few sparks
    const k = rr(0.85, 1.2), w = gn(d), wf = flt(w, 'bandpass', 500 * k, 0.9); noi(t, 0.35, wf); sw(wf.frequency, t, 350 * k, 1500 * k, 0.12);
    w.gain.setValueAtTime(0.0001, t); w.gain.linearRampToValueAtTime(0.45, t + 0.05); w.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    const g = gn(d), o = osc('sine', 80 * k, t, 0.22, g); sw(o.frequency, t, 70 * k, 115 * k, 0.1); ad(g.gain, t, 0.2, 0.02, 0.15);
    grains(d, t + 0.04, 4, 0.25, 0.1, 0.003, 0.012, 2000, 5500, 3, 1);
  };
  S.houndDie = (d, t) => {
    const k = rr(0.9, 1.12), g = gn(d), bp = flt(g, 'bandpass', 1200 * k, 2), o = osc('sawtooth', 900 * k, t, 0.28, bp), s = osc('sine', 900 * k, t, 0.28, gn(g, 0.5));
    [o, s].forEach((x) => { x.frequency.setValueAtTime(950 * k, t); x.frequency.exponentialRampToValueAtTime(1350 * k, t + 0.03); x.frequency.exponentialRampToValueAtTime(480 * k, t + 0.24); });
    ad(g.gain, t, 0.26, 0.006, 0.22);
    whoomp(d, t + 0.05, 0.4, 0.45);
    grains(d, t + 0.1, 8, 0.5, 0.12, 0.004, 0.02, 1800, 5000, 3, 1);
  };
  // The first time each new monster shows up: a short cue in the land's key, its own colour per kind
  // (p: 0 ram, 1/3 shaman, 2/3 harpy, 1 hound).
  S.newFoe = (d, t, p) => {
    const L = landNow(), kind = Math.round(p * 3), T = L.tonic, lp = flt(d, 'lowpass', 9000);
    if (kind === 0) { // ram: two heavy knocks, then a low brass fifth that leans on the minor sixth
      timpHit(d, t, 0.4, mtof(T - 24)); knock(d, t, 0.4, 210); timpHit(d, t + 0.3, 0.5, mtof(T - 24)); knock(d, t + 0.3, 0.45, 190);
      [T - 12, T - 5].forEach((n) => brassNote(d, t + 0.3, mtof(n), 0.9, 0.12, 0.85)); brassNote(d, t + 0.75, mtof(deg(L, 5) - 12), 0.5, 0.08, 0.9);
    } else if (kind === 1) { // shaman: bells climbing the scale to a flat second that does not resolve, over a hum
      [0, 2, 4, 7].forEach((dg, i) => belld(lp, t + i * 0.09, mtof(deg(L, dg) + 24), 0.05, 1.1)); belld(lp, t + 0.45, mtof(T + 25), 0.05, 1.3);
      const h = gn(d), ho = osc('triangle', mtof(T - 12), t, 1.2, flt(h, 'lowpass', 800)); ad(h.gain, t, 0.14, 0.2, 0.9);
    } else if (kind === 2) { // harpy: a reed leaps a minor sixth and slides away, a glint above it
      reedTone(d, t, deg(L, 0) + 12, 0.22, 0.9); reedTone(d, t + 0.24, deg(L, 5) + 12, 0.6, 1);
      belld(lp, t + 0.24, mtof(deg(L, 5) + 36), 0.03, 0.9);
      const w = gn(d), wf = flt(w, 'bandpass', 1200, 1.2); noi(t + 0.2, 0.6, wf, bufPink); sw(wf.frequency, t + 0.2, 600, 2400, 0.5); ad(w.gain, t + 0.2, 0.06, 0.3, 0.3);
    } else { // hound: a low brass growl steps down, a frame drum, fire under it
      frameD(d, t, 0.45); frameD(d, t + 0.22, 0.3);
      brassNote(d, t, mtof(T - 12), 0.35, 0.12, 0.9); brassNote(d, t + 0.4, mtof(deg(L, -1) - 12), 0.7, 0.13, 0.95);
      const r = gn(d), rf = flt(r, 'bandpass', 420, 0.9); noi(t, 1.2, rf, bufBrown); ad(r.gain, t, 0.22, 0.25, 0.9);
    }
  };
  // ---- Round 8: Lanternhold. Voices for the lantern, the story panels and the meta screens (embers, the Keeper's tree,
  // Heat, the main menu). All of them play on the UI bus, so they sound while the game is paused. ----
  function lanternTone(d, t, m, vel) { // the lantern's own voice: a music-box tine, warm and glassy, with a soft halo
    const f = mtof(m), dec = 2.6 * Math.pow(660 / f, 0.3), H = [[1, 1, 1], [2.0, 0.22, 0.45], [3.0, 0.07, 0.25], [5.4, 0.03, 0.1]];
    for (let i = 0; i < H.length; i++) { const h = H[i]; if (f * h[0] > 14000) break; const g = gn(d); osc('sine', f * h[0], t, dec * h[2] + 0.1, g); ad(g.gain, t, vel * 0.1 * h[1], 0.003, dec * h[2]); }
    const hg = gn(d), o = osc('triangle', f, t, dec * 0.8 + 0.3, flt(hg, 'lowpass', Math.min(9000, f * 2)));
    o.detune.value = 7; hg.gain.setValueAtTime(0.0001, t); hg.gain.linearRampToValueAtTime(vel * 0.025, t + 0.25); hg.gain.exponentialRampToValueAtTime(0.0001, t + dec * 0.8);
  }
  function harpTone(d, t, m, vel) { // a soft harp pluck for the title's arpeggios
    const f = mtof(m), g = gn(d), lp = flt(g, 'lowpass', f * 6, 0.8);
    osc('triangle', f, t, 1.7, lp); osc('sine', f * 2, t, 0.6, gn(lp, 0.25)); sw(lp.frequency, t, Math.min(9000, f * 8), f * 2, 0.5); ad(g.gain, t, vel * 0.1, 0.004, 1.5);
  }
  // Story voices: a murmur rather than words, one per line, the number of syllables following the line's length.
  // The Keeper is warm and low, other living voices each get their own pitch, the Old Keeper's ghost is a whisper
  // with a hollow hum and echoes, and a boss is a deep growl.
  const VOW = [[730, 1090], [530, 1840], [570, 840], [300, 2250], [440, 1020], [660, 1700]], VDARK = [[570, 840], [440, 1020], [400, 800], [600, 950]];
  const SL = { n: 0 };
  function talk(d, t, n, f0, len, bright, growl, vow) {
    const lp = flt(d, 'lowpass', 1900 * bright, 0.6), V0 = vow || VOW;
    let ti = t;
    for (let i = 0; i < n; i++) {
      const dur = len * rr(0.75, 1.3), v = V0[(rnd() * V0.length) | 0], u = i / Math.max(1, n - 1);
      const p = f0 * (1 + 0.09 * Math.sin(u * Math.PI) - (i === n - 1 ? 0.08 : 0)) * rr(0.96, 1.04);
      const T = throat(lp, ti, dur + 0.08, p, growl);
      T.f1.frequency.value = v[0]; T.f2.frequency.value = v[1];
      T.o.frequency.setValueAtTime(p, ti); T.o.frequency.linearRampToValueAtTime(p * rr(0.94, 1.03), ti + dur);
      T.env.gain.setValueAtTime(0.0001, ti); T.env.gain.linearRampToValueAtTime(0.3, ti + 0.02); T.env.gain.setTargetAtTime(0.0001, ti + dur * 0.65, dur * 0.16);
      const g = gn(lp); osc('sine', p, ti, dur + 0.05, g); ad(g.gain, ti, 0.06, 0.015, dur);
      ti += dur + rr(0.02, 0.06) + (rnd() < 0.15 ? 0.1 : 0);
    }
    return ti;
  }
  function ghostTalk(d, t, n) {
    const lp = flt(d, 'lowpass', 4200, 0.5), dry = gn(lp, 1);
    // its echoes: three taps, each darker (no feedback loop, so nothing is left running)
    [[0.13, 0.45, 3000], [0.29, 0.3, 2200], [0.47, 0.18, 1500]].forEach((e) => { const dl = ctx.createDelay(1); dl.delayTime.value = e[0]; dry.connect(dl); dl.connect(flt(gn(lp, e[1]), 'lowpass', e[2])); });
    const f0 = rr(330, 370); let ti = t;
    for (let i = 0; i < n; i++) {
      const dur = rr(0.13, 0.22), v = VOW[(rnd() * VOW.length) | 0];
      const w = gn(dry), src = gn(null, 1); src.connect(flt(w, 'bandpass', v[0], 5)); src.connect(flt(gn(w, 0.7), 'bandpass', v[1], 7)); noi(ti, dur + 0.12, src, bufPink);
      w.gain.setValueAtTime(0.0001, ti); w.gain.linearRampToValueAtTime(0.9, ti + 0.05); w.gain.exponentialRampToValueAtTime(0.0001, ti + dur + 0.1);
      const g = gn(dry), o = osc('sine', f0 * (1 - 0.04 * i / n), ti, dur + 0.25, g); osc('sine', 5.5, ti, dur + 0.25, gn(o.frequency, 7)); ad(g.gain, ti, 0.04, 0.06, dur + 0.15);
      ti += dur + rr(0.03, 0.09);
    }
  }
  S.storyLine = (d, t, p) => { // p: 0 the Keeper, about 0.25-0.35 another living voice, 0.5 the Old Keeper's ghost, 1 a boss
    const n = SL.n > 0 ? SL.n : 4 + ((rnd() * 4) | 0); SL.n = 0;
    if (p >= 0.75) { // a boss: a deep, slow growl and a rumble under it
      const sh = shape(d, 1.6), f0 = rr(60, 72), te = talk(sh, t, n, f0, 0.17, 0.55, 0.6, VDARK);
      const g = gn(d), o = osc('sine', f0 / 2, t, te - t + 0.4, g); o.frequency.setValueAtTime(f0 / 2, t); o.frequency.linearRampToValueAtTime(f0 * 0.45, te);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + 0.1); g.gain.setValueAtTime(0.18, te - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, te + 0.3);
    } else if (p >= 0.4) ghostTalk(d, t, n);
    else if (p >= 0.2) talk(d, t, n, 200 + (p - 0.2) * 800, 0.08, 1.25, 0);
    else talk(d, t, n, rr(138, 150), 0.095, 1, 0);
  };
  S.storyOpen = (d, t) => { // a dialogue panel opens: a soft swish, a warm swell on the land's home chord, two far lantern notes
    const L = landNow(), c = L.ch[0].n, lp = flt(d, 'lowpass', 2400);
    const s = gn(d), sf = flt(s, 'bandpass', 900, 0.9); noi(t, 0.7, sf, bufPink); sw(sf.frequency, t, 500, 2600, 0.5);
    s.gain.setValueAtTime(0.0001, t); s.gain.exponentialRampToValueAtTime(0.05, t + 0.25); s.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    softChord(lp, t + 0.05, [c[2], c[3], c[4], c[2] + 12], 2.6, 0.09);
    lanternTone(d, t + 0.35, deg(L, -3) + 24, 0.45); lanternTone(d, t + 0.62, deg(L, 0) + 24, 0.55);
  };
  // Embers counting up on the results screen: p is how far the count has got (0..1); each tick climbs a D major
  // pentatonic, and p = 1 (the total) rings a small chord.
  const EMB = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86, 88];
  S.emberGain = (d, t, p) => {
    const m = EMB[Math.round(p * (EMB.length - 1))], lp = flt(d, 'lowpass', 9000);
    lanternTone(d, t, m, 0.55); belld(lp, t, mtof(m + 12), 0.025, 0.35);
    grains(lp, t, 3, 0.08, 0.05, 0.002, 0.008, 2500, 6000, 3, 0);
    if (p >= 0.999) {
      [74, 78, 81, 86].forEach((n, i) => { lanternTone(d, t + 0.08 + i * 0.07, n, 0.7); belld(lp, t + 0.08 + i * 0.07, mtof(n + 12), 0.03, 1.2); });
      softChord(d, t + 0.05, [50, 57, 62, 66], 2.0, 0.08);
      grains(lp, t + 0.1, 16, 1.2, 0.05, 0.003, 0.012, 3000, 8000, 3, 1);
    }
  };
  // A purchase in the Keeper's tree: a hammer on the anvil, then the lantern rising quickly in major (a step higher for
  // each level: p = level / max level), a warm swell and sparks.
  S.upgradeBuy = (d, t, p) => {
    const k = Math.round(p * 5), lp = flt(d, 'lowpass', 8000);
    const g = gn(d), o = osc('sine', 120, t, 0.35, g); sw(o.frequency, t, 160, 70, 0.2); ad(g.gain, t, 0.45, 0.003, 0.28);
    ironRing(lp, t, 1180, 0.06, 0.5);
    const c = gn(d), cf = flt(c, 'bandpass', 2400, 1.5); noi(t, 0.03, cf); ad(c.gain, t, 0.12, 0.0005, 0.015);
    [-5, 0, 2, 4].forEach((n, i) => lanternTone(d, t + 0.12 + i * 0.085, 74 + n + k, i === 3 ? 0.95 : 0.65));
    softChord(d, t + 0.12, [50 + k, 57 + k, 62 + k, 66 + k], 1.6, 0.07);
    grains(lp, t + 0.3, 12, 0.9, 0.06, 0.003, 0.012, 3000, 8000, 3, 1);
    const s = gn(d), sf = flt(s, 'bandpass', 1200, 1); noi(t + 0.05, 0.6, sf, bufPink); sw(sf.frequency, t + 0.05, 600, 3000, 0.45); ad(s.gain, t + 0.05, 0.05, 0.2, 0.35);
  };
  // Choosing a Heat: ominous, and heavier for each tier (p = tier / top tier): a deep blow that drops lower, a dark
  // brass cluster that grows (a minor second, then the tritone, then more), a low choir, then a cracked bell.
  S.heatSelect = (d, t, p) => {
    const k = p, sh = shape(d, 1.5 + 2 * k);
    const g = gn(sh), o = osc('sine', 60, t, 1.6 + k, g); sw(o.frequency, t, 70 - 10 * k, 30 - 6 * k, 1.0 + 0.6 * k); ad(g.gain, t, 0.5 + 0.25 * k, 0.01, 1.2 + 0.8 * k);
    drumHit(d, t, 0.45 + 0.3 * k, 48);
    const ns = [38, 39]; if (k > 0.2) ns.push(44); if (k > 0.45) ns.push(50, 51); if (k > 0.7) ns.push(32);
    ns.forEach((n) => brassNote(d, t + 0.05, mtof(n), 1.3 + k, 0.06 + 0.03 * k, 0.7 + 0.2 * k));
    if (k > 0.35) [45, 46, 51].forEach((n, i) => choirTone(d, t + 0.1 + i * 0.05, n, 1.8 + k, 0.1 + 0.1 * k));
    if (k > 0.6) belld(flt(d, 'lowpass', 4000), t + 0.25, mtof(44), 0.08 * k, 2.5);
    const a = gn(d), af = flt(a, 'highpass', 3000); noi(t, 1.6, af, bufPink); ad(a.gain, t, 0.025 + 0.035 * k, 0.4, 1.0);
  };
  // The main menu: a glass tick per move (p = position in the list, so the cursor plays the lantern's notes),
  // a warm fifth on select and the same falling back.
  const MMV = [69, 74, 76, 77, 81, 86];
  S.menuMove = (d, t, p) => {
    const f = mtof(MMV[Math.round(p * (MMV.length - 1))] + 12);
    const g = gn(d); osc('sine', f, t, 0.14, g); ad(g.gain, t, 0.07, 0.002, 0.11);
    const g2 = gn(d); osc('sine', f * 2.76, t, 0.05, g2); ad(g2.gain, t, 0.018, 0.001, 0.035);
    const c = gn(d), cf = flt(c, 'bandpass', 1800, 3); noi(t, 0.025, cf); ad(c.gain, t, 0.05, 0.0005, 0.012);
  };
  S.menuSelect = (d, t) => {
    const g = gn(d), o = osc('triangle', 300, t, 0.1, g); sw(o.frequency, t, 340, 220, 0.06); ad(g.gain, t, 0.2, 0.002, 0.07);
    const k = gn(d), kf = flt(k, 'bandpass', 1100, 4); noi(t, 0.04, kf); ad(k.gain, t, 0.12, 0.001, 0.02);
    lanternTone(d, t + 0.01, 74, 0.8); lanternTone(d, t + 0.1, 81, 0.9);
    const s = gn(d), sf = flt(s, 'bandpass', 1500, 1.2); noi(t, 0.3, sf, bufPink); sw(sf.frequency, t, 700, 3000, 0.25); ad(s.gain, t, 0.04, 0.08, 0.2);
  };
  S.menuBack = (d, t) => {
    lanternTone(d, t, 81, 0.6); lanternTone(d, t + 0.09, 74, 0.55);
    const s = gn(d), sf = flt(s, 'bandpass', 1500, 1.2); noi(t, 0.25, sf, bufPink); sw(sf.frequency, t, 2600, 700, 0.2); ad(s.gain, t, 0.035, 0.03, 0.18);
  };

  // Pad colours: oscillators, lowpass [start, open min, open max, end], Q, detune and vibrato ranges, levels [root, others], attack,
  // and extras: up (upper notes an octave higher), harm (extra sine partials), sub (an octave-down root), peak (a nasal formant),
  // trem (bowed tremolo depth, which grows with the danger when the chord starts).
  const PADV = {
    saw: { w: ['sawtooth'], lp: [380, 560, 700, 400], q: 0.5, det: [4, 8], vib: [2.5, 4], vhz: [4.4, 5.2], lv: [0.05, 0.036], att: 3.5 },
    glass: { w: ['triangle'], lp: [1100, 1700, 2300, 1100], q: 0.4, det: [2, 4], vib: [1, 2], vhz: [3.5, 4.5], lv: [0.045, 0.034], att: 4.5, up: 12, harm: [2, 0.2, 4.01, 0.05] },
    murk: { w: ['sawtooth'], lp: [240, 360, 440, 260], q: 1.6, det: [9, 15], vib: [5, 8], vhz: [2.2, 3.0], lv: [0.06, 0.042], att: 4 },
    brass: { w: ['sawtooth', 'square'], lp: [330, 560, 720, 350], q: 1.3, det: [3, 6], vib: [2, 3], vhz: [4.8, 5.4], lv: [0.04, 0.027], att: 2.8, sub: 0.045, peak: [520, 1.3, 6] },
    nasal: { w: ['sawtooth'], lp: [520, 800, 950, 560], q: 0.7, det: [5, 9], vib: [3, 5], vhz: [5.5, 6.5], lv: [0.04, 0.03], att: 3, peak: [1050, 1.6, 6] },
    strings: { w: ['sawtooth'], lp: [420, 760, 1000, 460], q: 0.7, det: [6, 11], vib: [5, 9], vhz: [4.8, 5.8], lv: [0.05, 0.034], att: 4.5, sub: 0.04, peak: [300, 1.0, 4], trem: 0.35 },
  };
  // Hand and frame percussion, written to a destination node.
  function dumD(d, t, vel) { // doumbek "dum": a round low tone with a skin slap
    const g = gn(d), o = osc('sine', 92, t, 0.4, g); sw(o.frequency, t, 118, 86, 0.06); ad(g.gain, t, vel, 0.003, 0.3);
    const b = gn(d), bo = osc('triangle', 185, t, 0.18, b); sw(bo.frequency, t, 230, 170, 0.05); ad(b.gain, t, vel * 0.45, 0.002, 0.12);
    const n = gn(d), nf = flt(n, 'bandpass', 420, 1.2); noi(t, 0.06, nf, bufPink); ad(n.gain, t, vel * 0.4, 0.001, 0.04);
  }
  function tekD(d, t, vel) { // doumbek "tek": a dry rim slap
    const n = gn(d), nf = flt(n, 'bandpass', 2800, 2.2); noi(t, 0.05, nf); ad(n.gain, t, vel * 0.7, 0.0008, 0.035);
    const g = gn(d); osc('sine', rr(780, 860), t, 0.05, g); ad(g.gain, t, vel * 0.3, 0.001, 0.03);
  }
  function riqD(d, t, vel) { grains(d, t, 4, 0.05, vel, 0.004, 0.02, 6000, 9500, 5, 0); }
  function frameD(d, t, vel) { // a muffled frame drum
    const g = gn(d), o = osc('sine', 66, t, 0.6, g); sw(o.frequency, t, 84, 62, 0.08); ad(g.gain, t, vel, 0.004, 0.45);
    const b = gn(d), bo = osc('triangle', 150, t, 0.2, b); sw(bo.frequency, t, 180, 130, 0.06); ad(b.gain, t, vel * 0.4, 0.003, 0.14);
    const n = gn(d), nf = flt(n, 'bandpass', 240, 1); noi(t, 0.08, nf, bufPink); ad(n.gain, t, vel * 0.5, 0.002, 0.06);
  }
  function heavyD(d, t, vel) { // the ember war drum's skin and stick: the part of a big drum a phone speaker plays
    const b = gn(d), bo = osc('triangle', 165, t, 0.22, flt(b, 'lowpass', 700)); sw(bo.frequency, t, 200, 112, 0.1); ad(b.gain, t, vel * 0.9, 0.002, 0.16);
    const n = gn(d), nf = flt(n, 'bandpass', 320, 1.1); noi(t, 0.14, nf, bufPink); ad(n.gain, t, vel * 1.6, 0.002, 0.09);
    const c = gn(d), cf = flt(c, 'bandpass', 1400, 1.4); noi(t, 0.04, cf); ad(c.gain, t, vel * 0.3, 0.0008, 0.02);
  }
  function woodD(d, t, vel) { // a hollow log tap
    const f = rr(560, 760), g = gn(d), o = osc('sine', f, t, 0.08, g); sw(o.frequency, t, f * 1.1, f, 0.02); ad(g.gain, t, vel, 0.001, 0.05);
    const n = gn(d), nf = flt(n, 'bandpass', f * 1.6, 6); noi(t, 0.03, nf); ad(n.gain, t, vel * 0.5, 0.0005, 0.015);
  }
  function glassTickD(d, t, vel) { const f = rr(4800, 7200), g = gn(d); osc('sine', f, t, 0.12, g); ad(g.gain, t, vel, 0.001, 0.09); const g2 = gn(d); osc('sine', f * 1.5, t, 0.06, g2); ad(g2.gain, t, vel * 0.3, 0.001, 0.04); }

  //  name: [fn, min gap s, reverb send, priority 0-3, duration s, gain, max voices of this kind]
  const DEF = Object.assign(Object.create(null), {
    bow: [S.bow, 0.05, 0.18, 1, 0.3, 0.55, 4],
    arrowHit: [S.arrowHit, 0.045, 0.12, 0, 0.15, 0.5, 4],
    cannon: [S.cannon, 0.09, 0.45, 2, 1.6, 0.9, 3],
    explode: [S.explode, 0.08, 0.5, 2, 1.5, 0.85, 3],
    charge: [S.charge, 0.12, 0.3, 0, 0.6, 0.6, 2],
    zap: [S.zap, 0.09, 0.45, 1, 1.1, 0.7, 3],
    clash: [S.clash, 0.06, 0.25, 1, 0.4, 0.55, 3],
    slash: [S.slash, 0.06, 0.15, 1, 0.2, 0.55, 3],
    ratSqueal: [S.ratSqueal, 0.09, 0.2, 0, 0.3, 0.5, 3],
    boneRattle: [S.boneRattle, 0.07, 0.2, 1, 0.45, 0.6, 3],
    squelch: [S.squelch, 0.08, 0.2, 1, 0.45, 0.6, 3],
    batScreech: [S.batScreech, 0.09, 0.3, 0, 0.2, 0.5, 2],
    roar: [S.roar, 0.6, 0.5, 3, 1.5, 0.85, 2],
    bossStep: [S.bossStep, 0.12, 0.35, 2, 0.6, 0.9, 2],
    bossDie: [S.bossDie, 1.0, 0.5, 3, 2.6, 0.9, 1],
    coin: [S.coin, 0.035, 0.15, 0, 0.35, 0.5, 4],
    hammer: [S.hammer, 0.05, 0.2, 0, 0.12, 0.5, 3],
    buildDone: [S.buildDone, 0.12, 0.3, 1, 0.8, 0.65, 2],
    sell: [S.sell, 0.15, 0.25, 1, 0.8, 0.6, 1],
    horn: [S.horn, 1.0, 0.6, 3, 2.2, 0.75, 1],
    hornBoss: [S.hornBoss, 1.5, 0.65, 3, 4.0, 0.8, 1],
    leak: [S.leak, 0.15, 0.45, 2, 1.4, 0.7, 2],
    footmanDie: [S.footmanDie, 0.09, 0.25, 1, 0.5, 0.6, 2],
    uiHover: [S.uiHover, 0.04, 0, 2, 0.06, 0.6, 2],
    uiClick: [S.uiClick, 0.04, 0.05, 3, 0.1, 0.7, 2],
    uiDeny: [S.uiDeny, 0.1, 0.05, 3, 0.25, 0.7, 1],
    crumble: [S.crumble, 1.0, 0.5, 3, 3.4, 0.9, 1],
    rise: [S.rise, 1.0, 0.5, 3, 3.5, 0.85, 1],
    beaconOut: [S.beaconOut, 1.5, 0.6, 3, 3.6, 0.85, 1],
    ignite: [S.ignite, 0.15, 0.35, 2, 1.2, 0.7, 2],
    splash: [S.splash, 0.09, 0.3, 0, 0.5, 0.5, 2],
    horde: [S.horde, 2.5, 0.6, 3, 3.6, 0.85, 1],
    elite: [S.elite, 0.35, 0.45, 2, 1.4, 0.7, 2],
    chainBoom: [S.chainBoom, 0.06, 0.4, 1, 1.0, 0.8, 3],
    burn: [S.burn, 0.1, 0.25, 0, 0.6, 0.55, 3],
    buyout: [S.buyout, 0.5, 0.5, 2, 1.6, 0.7, 1],
    branch: [S.branch, 0.4, 0.5, 3, 2.2, 0.8, 1],
    meteor: [S.meteor, 0.25, 0.5, 3, 3.9, 0.95, 2],
    frostNova: [S.frostNova, 0.25, 0.55, 3, 2.8, 0.75, 2],
    rally: [S.rally, 0.5, 0.45, 3, 3.4, 1.0, 1],
    spellReady: [S.spellReady, 2.0, 0.4, 2, 1.5, 0.6, 1],
    rockslide: [S.rockslide, 5, 0.5, 3, 4.1, 0.85, 1],
    blizzard: [S.blizzard, 5, 0.5, 3, 4.6, 0.9, 1],
    bogfog: [S.bogfog, 5, 0.6, 3, 5.0, 1.0, 1],
    lavaSurge: [S.lavaSurge, 5, 0.5, 3, 4.3, 0.85, 1],
    sandstorm: [S.sandstorm, 5, 0.45, 3, 4.6, 0.75, 1],
    eventEnd: [S.eventEnd, 4, 0.5, 2, 2.2, 0.6, 1],
    bossSting: [S.bossSting, 3, 0.55, 3, 2.6, 1.15, 1],
    fanfare: [S.fanfare, 3, 0.5, 3, 4.0, 1.5, 1],
    lament: [S.lament, 3, 0.55, 3, 7.0, 1.5, 1],
    arrival: [S.arrival, 3, 0.55, 3, 5.6, 1.4, 1],
    waveClear: [S.waveClear, 2, 0.5, 2, 1.6, 0.6, 1],
    menuOpen: [S.menuOpen, 0.06, 0.05, 3, 0.3, 0.75, 2],
    uiPreview: [S.uiPreview, 0.04, 0.05, 3, 0.2, 0.7, 2],
    spellArm: [S.spellArm, 0.08, 0.15, 3, 0.5, 0.75, 1],
    spellCancel: [S.spellCancel, 0.08, 0.1, 3, 0.3, 0.7, 1],
    mend: [S.mend, 0.5, 0.4, 2, 1.7, 0.7, 1],
    overcharge: [S.overcharge, 0.2, 0.35, 2, 1.4, 0.7, 2],
    ramHit: [S.ramHit, 0.14, 0.35, 2, 0.6, 0.85, 2],
    ramCreak: [S.ramCreak, 0.3, 0.25, 0, 1.1, 0.6, 2],
    ramDie: [S.ramDie, 0.08, 0.45, 2, 1.9, 0.85, 3],
    shamanChant: [S.shamanChant, 0.6, 0.35, 0, 2.6, 0.6, 2],
    shamanWard: [S.shamanWard, 0.3, 0.55, 2, 1.6, 0.7, 2],
    shamanDie: [S.shamanDie, 0.1, 0.4, 2, 0.8, 0.65, 3],
    harpyScreech: [S.harpyScreech, 0.2, 0.4, 2, 0.8, 0.6, 2],
    harpyWings: [S.harpyWings, 0.25, 0.2, 0, 0.9, 0.55, 2],
    harpyDie: [S.harpyDie, 0.1, 0.35, 2, 0.9, 0.6, 3],
    houndSnarl: [S.houndSnarl, 0.2, 0.25, 0, 0.65, 0.55, 2],
    houndPant: [S.houndPant, 0.3, 0.15, 0, 0.9, 0.5, 1],
    houndHowl: [S.houndHowl, 6, 0.6, 2, 2.6, 0.75, 1],
    houndFire: [S.houndFire, 0.18, 0.25, 0, 0.5, 0.5, 2],
    houndDie: [S.houndDie, 0.1, 0.3, 1, 0.8, 0.6, 2],
    newFoe: [S.newFoe, 1.5, 0.5, 3, 1.8, 1.0, 1],
    thunder: [S.thunder, 0.35, 0.45, 3, 5.6, 0.9, 3],
    tidalWave: [S.tidalWave, 1.0, 0.5, 3, 4.0, 0.8, 1],
    thunderstorm: [S.thunderstorm, 5, 0.5, 3, 5.6, 0.9, 1],
    storyOpen: [S.storyOpen, 0.8, 0.45, 3, 2.8, 0.8, 1],
    storyLine: [S.storyLine, 0.25, 0.35, 3, 2.0, 0.8, 2],
    emberGain: [S.emberGain, 0.03, 0.3, 3, 0.6, 0.6, 4],
    upgradeBuy: [S.upgradeBuy, 0.15, 0.4, 3, 1.8, 0.75, 2],
    heatSelect: [S.heatSelect, 0.25, 0.5, 3, 3.0, 0.85, 1],
    menuMove: [S.menuMove, 0.03, 0.1, 3, 0.15, 0.7, 2],
    menuSelect: [S.menuSelect, 0.08, 0.3, 3, 0.9, 0.75, 1],
    menuBack: [S.menuBack, 0.08, 0.2, 3, 0.5, 0.7, 1],
  });
  // Kinds that share a voice budget, and how hard a sound ducks the music and crowd.
  const FAM = { cannon: 'boom', explode: 'boom', chainBoom: 'boom', burn: 'fire', ignite: 'fire', houndFire: 'fire', ratSqueal: 'die', boneRattle: 'die', squelch: 'die', batScreech: 'die', harpyDie: 'die', houndDie: 'die', shamanDie: 'die',
    ramCreak: 'beast', shamanChant: 'beast', harpyWings: 'beast', houndSnarl: 'beast', houndPant: 'beast' };
  const FAMCAP = LOW ? { boom: 4, fire: 3, die: 5, beast: 3 } : { boom: 5, fire: 4, die: 7, beast: 5 };
  const DUCK = { cannon: 0.3, explode: 0.4, chainBoom: 0.3, zap: 0.2, roar: 0.5, bossStep: 0.35, bossDie: 0.8, horn: 0.35, hornBoss: 0.5, horde: 0.6, crumble: 0.7, beaconOut: 0.8, rise: 0.5,
    branch: 0.4, frostNova: 0.3, rally: 0.3, rockslide: 0.4, blizzard: 0.3, bogfog: 0.3, lavaSurge: 0.4, sandstorm: 0.3, bossSting: 0.6, ramHit: 0.15, ramDie: 0.3, houndHowl: 0.25,
    thunder: 0.35, tidalWave: 0.45, thunderstorm: 0.35 };
  // Ducks that land later than the call (the meteor hits after its whistle).
  const DUCK_LATE = { meteor: [meteorFall, 0.8] };
  // Exact gaps, no jitter: these are one per event, and the gap is what stops a double start.
  const NOJIT = { rockslide: 1, blizzard: 1, bogfog: 1, lavaSurge: 1, sandstorm: 1, eventEnd: 1, bossSting: 1, spellReady: 1, fanfare: 1, lament: 1, arrival: 1, waveClear: 1, houndHowl: 1, newFoe: 1, ramDie: 1, thunderstorm: 1, storyOpen: 1, storyLine: 1 };
  // UI sounds go to their own bus so they still play while the game is paused.
  const UIS = { uiHover: 1, uiClick: 1, uiDeny: 1, menuOpen: 1, uiPreview: 1, spellArm: 1, spellCancel: 1, storyOpen: 1, storyLine: 1, emberGain: 1, upgradeBuy: 1, heatSelect: 1, menuMove: 1, menuSelect: 1, menuBack: 1 };
  // Stingers are music: they go to their own bus (the music volume, not ducked), and they hold the music down while they play.
  const STB = { fanfare: 1, lament: 1, arrival: 1, waveClear: 1, newFoe: 1 };
  const HOLD = { fanfare: [3.6, 0.75], lament: [6.6, 0.8], arrival: [4.6, 0.55], waveClear: [1.3, 0.25], newFoe: [1.3, 0.3] }, holds = [];
  const lateDuck = [];
  // Total live voices allowed for each priority (a priority-3 sound may use all of them).
  // A sound that cuts off another (the horde alarm replaces the ordinary wave horn).
  const SUPER = { horde: ['horn'] };
  const CAP = LOW ? [12, 17, 22, 28] : [16, 22, 28, 34];
  const act = [], lastAt = Object.create(null), gapOf = Object.create(null);
  let duckE = 0;

  function steal(e, now) {
    try { e.v.out.gain.setTargetAtTime(0, now, 0.012); } catch (er) {}
    e.end = now; ST.stolen++;
  }
  function play(name, pan, gain, p) {
    if (!api.ready || api.muted || typeof name !== 'string' || !hasOwn(DEF, name)) return;
    // endEvent() also runs when a defeat or a land clear cuts an event short: its soft chime would clash with the stinger.
    if (name === 'eventEnd' && typeof G !== 'undefined' && G && G.phase !== 'play') return;
    // A hover tick waits for the next frame: if that frame's menu or spell change has its own sound, the tick is dropped.
    if (name === 'uiHover' && !W.flush && W.ui && ctx.currentTime - lastUpd < 0.1) { if (W.hover.length < 4) W.hover.push([pan, gain, p]); return; }
    const df = DEF[name];
    ST.req++;
    let g = gain === undefined ? 1 : +gain;
    if (g !== g) g = 1; // no usable position: play it centred
    if (!(g > 0.003)) return;
    pan = cl(+pan || 0, -1, 1);
    const now = ctx.currentTime;
    // Under the main menu the demo's stingers would talk over the title theme.
    if (STB[name] && SC.cur === 'menu') { ST.gap++; return; }
    if (now - (lastAt[name] === undefined ? -9 : lastAt[name]) < (gapOf[name] || df[1]) && !(name === 'emberGain' && +p >= 1)) { ST.gap++; return; }
    for (let i = act.length - 1; i >= 0; i--) if (act[i].end <= now) { act[i] = act[act.length - 1]; act.pop(); }
    const pri = df[3], fam = FAM[name];
    let nk = 0, ok = -1, nf = 0, of = -1, lo = -1;
    for (let i = 0; i < act.length; i++) {
      const e = act[i];
      if (e.name === name) { nk++; if (ok < 0 || e.t0 < act[ok].t0) ok = i; }
      if (fam && e.fam === fam) { nf++; if (of < 0 || e.t0 < act[of].t0) of = i; }
      if (e.pri < pri && (lo < 0 || e.pri < act[lo].pri || (e.pri === act[lo].pri && e.t0 < act[lo].t0))) lo = i;
    }
    // Same-kind limit: important sounds replace their oldest copy, small ones are skipped.
    if (nk >= (df[6] || 3)) { if (pri < 2) { ST.kind++; return; } steal(act[ok], now); nk--; }
    if (fam && nf >= FAMCAP[fam]) { if (pri < 2 && g < 0.9) { ST.kind++; return; } if (act[of].end > now) { steal(act[of], now); nf--; } }
    let live = 0; for (let i = 0; i < act.length; i++) if (act[i].end > now) live++;
    if (live >= CAP[pri]) { if (lo < 0 || act[lo].end <= now || pri < 2) { ST.cap++; return; } steal(act[lo], now); live--; }
    const busy = live / CAP[3];
    // Randomised spacing and density-aware level stop the "machine gun" effect.
    lastAt[name] = now; gapOf[name] = NOJIT[name] ? df[1] : df[1] * rr(0.75, 1.5) * (1 + 0.8 * busy);
    g *= 1 / Math.sqrt(1 + 0.45 * nk + 0.15 * nf);
    const t = now + 0.006 + rnd() * (0.014 + 0.035 * busy);
    const v = voice(pan, cl(g, 0, 1.5) * df[5], df[2], STB[name] ? nSting : UIS[name] ? nUi : nSfx);
    V = v;
    try { df[0](v.out, t, cl(+p || 0, 0, 1)); } catch (e) { if (!ST.err) ST.err = name + ': ' + e.message; }
    finishVoice(v);
    act.push({ end: t + df[4], v: v, name: name, fam: fam, pri: pri, t0: now });
    ST.played++; ST.names[name] = (ST.names[name] || 0) + 1; if (act.length > ST.peak) ST.peak = act.length;
    if (DUCK[name]) duckE = Math.max(duckE, DUCK[name] * cl(g, 0, 1));
    if (HOLD[name] && holds.length < 8) holds.push([t + HOLD[name][0], HOLD[name][1]]);
    if (DUCK_LATE[name] && lateDuck.length < 8) lateDuck.push([t + DUCK_LATE[name][0](), DUCK_LATE[name][1] * cl(g, 0, 1)]);
    if (name === 'thunder') TH.strikeAt = now; // a strike brings its own thunder: no second one for its flash (other flashes' thunder still rolls)
    const sup = SUPER[name];
    if (sup) for (let i = 0; i < act.length - 1; i++) if (act[i].end > now && sup.indexOf(act[i].name) >= 0) steal(act[i], now);
  }
  function startBeds() {
    bed.windG = gn(nAmb, 0); bed.windG.connect(gn(RV.amb, 0.12));
    bed.gustG = gn(bed.windG, 0.7);
    for (let i = 0; i < 2; i++) { const lf = flt(flt(panNode(i ? 0.55 : -0.55, bed.gustG), 'highpass', 110, 0.5), 'lowpass', 420, 0.4); loopSrc(bufPink, gn(lf, 2.6), 0.8 + i * 0.13); bed.windLP.push(lf); }
    bed.whG = gn(bed.gustG, 0); bed.whF = flt(bed.whG, 'bandpass', 800, 7); loopSrc(bufPink, gn(bed.whF, 3), 1.0);
    bed.fireG = gn(nAmb, 0);
    const hiss = flt(flt(gn(bed.fireG, 0.1), 'lowpass', 4500), 'highpass', 900); loopSrc(bufWhite, hiss, 1.0);
    const roarG = gn(bed.fireG, 0.32), roarF = flt(flt(roarG, 'highpass', 75, 0.5), 'lowpass', 280, 0.5); loopSrc(bufBrown, roarF, 1.0);
    loopOsc('sine', 6.7, gn(roarG.gain, 0.1)); loopOsc('sine', 2.3, gn(roarG.gain, 0.07));
    bed.popBus = gn(bed.fireG, 2.0); bed.popBus.connect(gn(RV.amb, 0.1));
    bed.droneG = gn(PZ.pad, 0); bed.droneG.connect(gn(SC.gameRv, 0.3));
    bed.droneLP = flt(bed.droneG, 'lowpass', 300, 0.6);
    const dv = gn(null, 4); loopOsc('sine', 4.9, dv);
    bed.droneOs = [];
    [[73.42, -5, 0.5], [73.42, 6, 0.5], [36.71, 0, 0.3], [110.0, 3, 0.12]].forEach((a) => { const o = loopOsc('sawtooth', a[0], gn(bed.droneLP, a[2])); o.detune.value = a[1]; dv.connect(o.detune); bed.droneOs.push([o, a[0]]); });
  }
  function pop() {
    const t = ctx.currentTime + rnd() * 0.08, big = rnd() < 0.12;
    const g = gn(null, 0), f = flt(g, 'bandpass', big ? rr(500, 1100) : rr(1400, 5200), rr(1.5, 6));
    const out = panNode(rr(-0.7, 0.7), bed.popBus); g.connect(out);
    const s = ctx.createBufferSource(); s.buffer = bufWhite; s.connect(f);
    const dur = big ? rr(0.025, 0.05) : rr(0.004, 0.018);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(big ? 0.5 : rr(0.12, 0.4), t + 0.0008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.start(t, rnd() * 1.8); s.stop(t + dur + 0.02);
    s.onended = () => { try { g.disconnect(); out.disconnect(); } catch (e) {} };
  }
  function setAmbience(fire, wind, tension) {
    tgt.fire = cl(+fire || 0, 0, 1); tgt.wind = cl(+wind || 0, 0, 1); tgt.tension = cl(+tension || 0, 0, 1);
  }

  // The land's music: its chords and colours (LANDMUS above). A land change fades the old pads on their own bus
  // while the new land's first chord comes in, and moves the drone and choir to the new key.
  function landMusic(L, id, now) {
    if (!L) L = LANDMUS.ashen; if (L === LM.def && LM.bus) return;
    LM.def = L; LM.key = id || 'ashen';
    if (LM.bus) { LM.bus.gain.setTargetAtTime(0, now, 1.1); LM.old.push([LM.bus, now + 12]); }
    LM.bus = landBus();
    mus.chord = 0; mus.nextChord = now + 0.4; mus.pendC = mus.playC = L.ch[0]; mus.pendAt = now; mus.lastNote = -1;
    const r = Math.pow(2, L.semi / 12);
    if (bed.droneOs) for (let i = 0; i < bed.droneOs.length; i++) bed.droneOs[i][0].frequency.setTargetAtTime(bed.droneOs[i][1] * r, now, 1.5);
  }
  // A land's pad bus, with its reverb send after the fade (a land change fades the old echo too).
  function landBus() { const b = gn(nPad, 1); b.connect(gn(SC.gameRv, 0.5)); b.rv = SC.gameRv; return b; }
  function padChord(t, c, dur) {
    const L = LM.def, P = PADV[L.pad] || PADV.saw, v = voice(0, 1, 0, LM.bus || nPad); V = v;
    const env = gn(v.out), sides = [], open = rr(P.lp[1], P.lp[2]), td = P.trem ? P.trem * cl((SEQ.I - 0.2) / 0.6, 0, 1) : 0;
    let tr = env; if (td > 0.02) { tr = gn(env, 1 - td); osc('sine', rr(6, 8), t, dur + 5.5, gn(tr.gain, td)); }
    const hp = flt(tr, 'highpass', 50);
    let pre = hp; if (P.peak) { pre = flt(hp, 'peaking', P.peak[0], P.peak[1]); pre.gain.value = P.peak[2]; }
    for (let s = 0; s < 2; s++) {
      const l = flt(panNode(s ? 0.4 : -0.4, pre), 'lowpass', P.lp[0], P.q);
      l.frequency.setValueAtTime(P.lp[0], t); l.frequency.linearRampToValueAtTime(open, t + dur * 0.5); l.frequency.linearRampToValueAtTime(P.lp[3], t + dur + 4);
      sides.push(l);
    }
    const vib = gn(null, rr(P.vib[0], P.vib[1])); osc('sine', rr(P.vhz[0], P.vhz[1]), t, dur + 5.5, vib);
    for (let i = 0; i < c.n.length; i++) {
      const f = mtof(c.n[i] + (i && P.up ? P.up : 0)), lv = (i === 0 ? P.lv[0] : P.lv[1]) * L.lvl;
      for (let s = 0; s < 2; s++) {
        for (let w = 0; w < P.w.length; w++) { const o = osc(P.w[w], f, t, dur + 5.5, gn(sides[s], lv / P.w.length * (w ? 0.8 : 1.2))); o.detune.value = (s ? 1 : -1) * rr(P.det[0], P.det[1]); vib.connect(o.detune); }
        if (P.harm && i >= 2 && s === (i & 1)) for (let h = 0; h < P.harm.length; h += 2) { const o = osc('sine', f * P.harm[h], t, dur + 5.5, gn(sides[s], lv * P.harm[h + 1])); o.detune.value = (s ? 1 : -1) * 3; }
      }
      if (P.sub && i === 0) osc('triangle', f / 2, t, dur + 5.5, gn(sides[0], P.sub * L.lvl));
    }
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(1, t + P.att); env.gain.setTargetAtTime(0.0001, t + dur, 1.3);
    finishVoice(v);
  }
  function calmNote(t, m, vel) {
    const v = voice(rr(-0.3, 0.3), 1, 0.3, LM.bus || nPad); V = v;
    calmTone(v.out, t, m, vel, LM.def);
    finishVoice(v);
  }
  function timp(t, vel) {
    const v = voice(rr(-0.15, 0.15), 1, 0.6, nSeq); V = v;
    const f = mtof(38 + LM.def.semi);
    const g = gn(v.out), o = osc('sine', f, t, 1.3, g); sw(o.frequency, t, f * 1.09, f * 0.99, 0.08); ad(g.gain, t, vel, 0.006, 1.1);
    const g2 = gn(v.out); osc('sine', f * 1.504, t, 0.7, g2); ad(g2.gain, t, vel * 0.35, 0.005, 0.5);
    const g3 = gn(v.out); osc('sine', f * 2.01, t, 0.4, g3); ad(g3.gain, t, vel * 0.15, 0.004, 0.3);
    const n = gn(v.out), nf = flt(n, 'lowpass', 200); noi(t, 0.1, nf); ad(n.gain, t, vel * 0.6, 0.003, 0.06);
    finishVoice(v);
  }
  function pickNote(c) {
    let m = c.m[(rnd() * c.m.length) | 0];
    if (m === mus.lastNote) m = c.m[(c.m.indexOf(m) + 1) % c.m.length];
    mus.lastNote = m; return m;
  }

  // ---- Calm layer: slow pad chords with a few notes from the land's solo voice. ----
  function musicTick(now) {
    if (now > mus.nextChord - 0.3) {
      const L = LM.def, t = Math.max(mus.nextChord, now + 0.05), c = L.ch[mus.chord] || L.ch[0], dur = rr(11, 15) * (L.sparse ? 1.2 : 1);
      padChord(t, c, dur);
      mus.pendC = c; mus.pendAt = t;
      if (rnd() < 0.75 * (1 - 0.6 * SEQ.I)) {
        const t1 = t + rr(3, 6.5);
        if (c === L.ch[0] && rnd() < 0.3) { for (let i = 0; i < 4; i++) calmNote(t1 + i * 0.55, deg(L, LANTERN[i]) + 12, i === 3 ? 0.75 : 0.55); } // the lantern, hummed
        else { calmNote(t1, pickNote(c), rr(0.6, 1)); if (rnd() < 0.35) calmNote(t1 + rr(2.4, 4.2), pickNote(c), rr(0.45, 0.8)); }
      }
      mus.nextChord = t + dur - 1.0;
      mus.chord = c.to[(rnd() * c.to.length) | 0];
    }
  }
  // Bass root of the chord sounding at time t, folded into C2..B2.
  function rootAt(t) {
    if (t >= mus.pendAt && mus.pendC) mus.playC = mus.pendC;
    let r = (mus.playC || LM.def.ch[0]).n[0]; while (r < 36) r += 12; return r;
  }

  // ---- Reactive layer: a 16-step sequencer whose layers follow the danger. ----
  const N = null;
  const PULSE = [
    [1, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0.5, 0, 0.8, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0.4, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0.5, 0],
  ];
  const WAR = [
    [1, 0, 0, 0.6, 0, 0, 0, 0, 0.9, 0, 0, 0.6, 0, 0, 0.5, 0],
    [1, 0, 0, 0, 0.7, 0, 0, 0, 1, 0, 0.5, 0, 0.7, 0, 0, 0],
    [1, 0, 0.5, 0, 0, 0, 0.8, 0, 1, 0, 0, 0, 0.6, 0, 0.6, 0.4],
  ];
  const OST = [
    [0, N, N, N, 0, N, 0, N, 0, N, N, N, 7, N, 0, N],
    [0, N, 0, N, 12, N, 0, N, 0, N, 7, N, 0, N, 12, N],
    [0, N, N, 0, N, N, 0, N, N, 0, N, N, 7, N, -5, N],
    [0, 0, N, 0, 0, N, 0, N, 0, 0, N, 0, 7, N, 7, N],
  ];
  // Motifs as [step, scale degree, length in steps], played in the land's mode; each spans two bars.
  const MOTIF = [
    [[0, 0, 6], [6, 2, 2], [8, 1, 4], [12, 0, 4], [16, -1, 8], [24, 0, 8]],
    [[0, -3, 4], [4, 0, 4], [8, 2, 6], [14, 1, 2], [16, 0, 8], [24, -3, 8]],
    [[0, 0, 3], [3, 0, 3], [6, -1, 2], [8, -3, 8], [16, -2, 6], [22, -3, 10]],
    LANTERN_M,
  ];
  // The dunes' hand drums: maqsum (dum tek - tek dum - tek -). Positive = dum, negative = tek.
  const MAQ = [1, 0, -0.6, 0, 0, 0, -0.7, 0, 0.9, 0, 0, 0, -0.7, 0, 0, 0];
  const MAQW = [1, 0, 0, -0.5, 0, 0, 0.7, 0, 1, 0, -0.5, 0, 0.8, 0, -0.5, -0.4];
  // One theme per boss: percussion colour, lead voice, motif and tempo offset.
  const BOSS = {
    giant: { perc: 'bone', lead: 'brass', bpm: 0, m: [[0, 38, 4], [4, 41, 4], [8, 40, 4], [12, 38, 4], [16, 37, 8], [24, 38, 8]] },
    ogre: { perc: 'heavy', lead: 'brass', bpm: -10, m: [[0, 38, 8], [8, 44, 8], [16, 38, 6], [22, 44, 2], [24, 43, 8]] },
    jotun: { perc: 'ice', lead: 'bell', bpm: -6, m: [[0, 74, 6], [6, 77, 2], [8, 76, 8], [16, 72, 4], [20, 69, 12]] },
    queen: { perc: 'skitter', lead: 'trem', bpm: 4, m: [[0, 62, 8], [8, 63, 8], [16, 62, 8], [24, 61, 8]] },
    colossus: { perc: 'anvil', lead: 'dist', bpm: 0, m: [[0, 26, 8], [8, 26, 4], [12, 29, 4], [16, 32, 8], [24, 31, 8]] },
    king: { perc: 'ritual', lead: 'reed', bpm: -4, m: [[0, 62, 4], [4, 63, 4], [8, 65, 6], [14, 63, 2], [16, 62, 6], [22, 60, 2], [24, 62, 8]] },
    leviathan: { perc: 'tide', lead: 'choir', bpm: -8, m: [[0, 57, 8], [8, 60, 8], [16, 59, 6], [22, 55, 2], [24, 57, 4], [28, 58, 4]] }, // A C B G A Bb: a drowned choir
  };
  const SEQ = { next: 0, step: 0, bar: 0, phrase: 0, bpm: 80, I: 0, tI: 0, lay: {}, pat: 0, ost: 0, motif: -1, rest: false, boss: null, bossKey: null, rage: false, horde: 0, hordeT: 0, hordeWas: false, seenBoss: typeof WeakSet === 'function' ? new WeakSet() : null, stingTill: 0, low: 0, lastNow: 0, scanAt: 0, choir: null };

  function sv(pan, send) { const v = voice(pan, 1, send, nSeq); V = v; ST.seq++; return v; }
  function drum(t, vel, f) {
    const v = sv(rr(-0.1, 0.1), 0.2);
    const g = gn(v.out), o = osc('sine', f, t, 0.5, g); sw(o.frequency, t, f * 1.5, f * 0.85, 0.09); ad(g.gain, t, vel, 0.004, 0.4);
    const k = gn(v.out); osc('triangle', f * 2.7, t, 0.12, k); ad(k.gain, t, vel * 0.35, 0.002, 0.07);
    const n = gn(v.out), nf = flt(n, 'bandpass', 420, 1.4); noi(t, 0.06, nf); ad(n.gain, t, vel * 0.5, 0.001, 0.045);
    finishVoice(v);
  }
  function taiko(t, vel, f) {
    const v = sv(rr(-0.25, 0.25), 0.45);
    const g = gn(v.out), o = osc('sine', f, t, 0.8, g); sw(o.frequency, t, f * 1.7, f * 0.9, 0.1); ad(g.gain, t, vel, 0.003, 0.65);
    const g2 = gn(v.out); osc('triangle', f * 2.3, t, 0.25, g2); ad(g2.gain, t, vel * 0.4, 0.002, 0.16);
    const n = gn(v.out), nf = flt(n, 'bandpass', 650, 0.8); noi(t, 0.09, nf); ad(n.gain, t, vel * 0.55, 0.001, 0.06);
    finishVoice(v);
  }
  function shaker(t, vel) {
    const v = sv(rr(-0.45, 0.45), 0.1), n = gn(v.out), nf = flt(n, 'highpass', 6500); noi(t, 0.06, nf); ad(n.gain, t, vel, 0.008, 0.035);
    finishVoice(v);
  }
  function click(t, vel, f, pan) {
    const v = sv(pan, 0.15), n = gn(v.out), nf = flt(n, 'bandpass', f, 7); noi(t, 0.03, nf); ad(n.gain, t, vel, 0.0005, 0.016);
    finishVoice(v);
  }
  function pluck(t, m, vel, dur, br) {
    const b = br || 6, f = mtof(m), v = sv(0, 0.12), g = gn(v.out), lp = flt(g, 'lowpass', f * b, 2);
    osc('sawtooth', f, t, dur + 0.1, lp); sw(lp.frequency, t, f * (b + 1), f * 1.4, dur * 0.8); ad(g.gain, t, vel, 0.004, dur);
    finishVoice(v);
  }
  function bell(t, m, vel, pan) {
    const f = mtof(m), v = sv(pan, 0.7), R = [1, 2.76, 5.4], D = [2.2, 1.1, 0.5];
    for (let i = 0; i < 3; i++) { const g = gn(v.out); osc('sine', f * R[i], t, D[i] + 0.1, g); ad(g.gain, t, vel / (1 + i * 1.6), 0.002, D[i]); }
    finishVoice(v);
  }
  function reed(t, m, dur, vel) {
    const f = mtof(m), v = sv(rr(-0.2, 0.2), 0.5), env = gn(v.out), lp = flt(env, 'lowpass', 2600), bp = flt(lp, 'peaking', 1150, 1.4); bp.gain.value = 9;
    const o = osc('square', f, t, dur + 0.3, gn(bp, 0.5)), vib = gn(o.detune, 0); osc('sine', 5.6, t, dur + 0.3, vib);
    vib.gain.setValueAtTime(0, t + 0.12); vib.gain.linearRampToValueAtTime(14, t + dur * 0.8);
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(vel, t + 0.05); env.gain.setTargetAtTime(0.0001, t + dur, 0.08);
    finishVoice(v);
  }
  function brassV(t, m, dur, vel, dist) {
    const v = sv(rr(-0.15, 0.15), 0.4), d = dist ? shape(v.out, 3) : v.out;
    brassNote(d, t, mtof(m), dur, vel, dist ? 0.8 : 0.9);
    finishVoice(v);
  }
  function anvil(t, vel) {
    const v = sv(rr(-0.3, 0.3), 0.4), R = [1, 2.71, 4.13];
    for (let i = 0; i < 3; i++) { const g = gn(v.out); osc('sine', 980 * R[i] * rr(0.995, 1.005), t, 0.5, g); ad(g.gain, t, vel / (1 + i), 0.001, 0.35 / (1 + i * 0.5)); }
    const n = gn(v.out), nf = flt(n, 'highpass', 2500); noi(t, 0.03, nf); ad(n.gain, t, vel * 0.6, 0.0005, 0.012);
    finishVoice(v);
  }
  function gong(t, vel) {
    const v = sv(0, 0.8), R = [1, 1.47, 2.09, 2.56];
    for (let i = 0; i < 4; i++) { const g = gn(v.out); osc('sine', 98 * R[i], t, 3.2, g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel / (1 + i), t + 0.04 + i * 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 3 - i * 0.5); }
    finishVoice(v);
  }
  function timpS(t, vel) { timp(t, vel); ST.seq++; }
  function kitHit(fn, t, vel, pan, send) { const v = sv(pan, send); fn(v.out, t, vel); finishVoice(v); }
  function leadNote(t, m, dur, vel) { // the motif lead in the land's colour
    const ln = LM.def.lead;
    if (ln === 'bell') bell(t, m + 24, vel * 0.8, rr(-0.5, 0.5));
    else if (ln === 'reed') reed(t, m + 12, dur, vel * 0.7);
    else if (ln === 'ney') { const v = sv(rr(-0.2, 0.2), 0.5); reedTone(v.out, t, m + 12, dur, vel * 6); finishVoice(v); }
    else if (ln === 'lowbrass') brassV(t, m, dur, vel * 1.2, false);
    else if (ln === 'concertina') { const v = sv(rr(-0.25, 0.25), 0.45); concertina(v.out, t, m + 12, dur, vel * 0.6); finishVoice(v); }
    else brassV(t, m, dur, vel, false);
  }

  // Horde choir: a sustained "ahh" built only while a horde is on.
  function choirOn() {
    if (SEQ.choir) return;
    const g = gn(nSeq, 0), f1 = flt(g, 'bandpass', 720, 5), f2 = flt(g, 'bandpass', 1150, 7), mix = gn(null, 1);
    mix.connect(f1); mix.connect(gn(f2, 0.6)); mix.connect(flt(gn(g, 0.4), 'lowpass', 300));
    const os = [], vib = gn(null, 6); os.push(loopOsc('sine', 5.1, vib));
    [[50, -6], [50, 7], [57, 3], [62, -3], [38, 0]].forEach((a) => { const o = loopOsc('sawtooth', mtof(a[0] + LM.def.semi), gn(mix, 0.2)); o.detune.value = a[1]; vib.connect(o.detune); os.push(o); });
    SEQ.choir = { g: g, os: os, off: 0 };
  }
  function choirOff(now) {
    const c = SEQ.choir; if (!c) return;
    SEQ.choir = null; c.g.gain.setTargetAtTime(0, now, 0.4);
    for (let i = 0; i < c.os.length; i++) c.os[i].stop(now + 2.5);
    c.os[c.os.length - 1].onended = () => { try { c.g.disconnect(); } catch (e) {} };
  }

  function decideBar() {
    const I = SEQ.I, L = SEQ.lay, hy = (on, up, dn) => (on ? I > dn : I > up);
    L.pulse = hy(L.pulse, 0.12, 0.06);
    L.tick = hy(L.tick, 0.3, 0.22);
    L.bass = hy(L.bass, 0.38, 0.28);
    L.war = hy(L.war, 0.6, 0.5);
    L.gong = I > 0.85;
    if (SEQ.bar === 0) {
      SEQ.phrase++; SEQ.pat = (rnd() * 3) | 0; SEQ.ost = I > 0.75 ? 1 + ((rnd() * 3) | 0) : (rnd() * 3) | 0;
      SEQ.rest = I < 0.7 && SEQ.phrase % 4 === 3;
      SEQ.motif = I > 0.45 && SEQ.phrase % 2 === 0 ? (rnd() * (LM.def.motifs || MOTIF).length) | 0 : -1;
    }
    SEQ.boss = SEQ.bossKey ? BOSS[SEQ.bossKey] || BOSS.giant : null;
    SEQ.bpm = 76 + 24 * I + LM.def.bpm + (SEQ.boss ? SEQ.boss.bpm + (SEQ.rage ? 14 : 0) : 0) + (SEQ.horde > 0.5 ? 8 : 0);
  }
  function lead(B, t, mi, len, sd) {
    const dur = len * sd, ln = B.lead;
    if (ln === 'brass') brassV(t, mi, dur * 0.9, 0.15, false);
    else if (ln === 'dist') brassV(t, mi + 12, dur * 0.9, 0.09, true);
    else if (ln === 'bell') bell(t, mi, 0.12, rr(-0.5, 0.5));
    else if (ln === 'reed') reed(t, mi, dur * 0.92, 0.09);
    else if (ln === 'choir') { // low voices, and the sea under them an octave and more below
      const v = sv(rr(-0.2, 0.2), 0.6); choirTone(v.out, t, mi, dur * 0.95, 0.5); choirTone(v.out, t, mi - 12, dur * 0.95, 0.35);
      const g = gn(v.out); osc('sine', mtof(mi - 24), t, dur + 0.3, g); ad(g.gain, t, 0.12, Math.min(0.4, dur * 0.3), dur);
      finishVoice(v);
    }
  }
  function swellS(t, len) { // a wave rising over two bars and breaking on the next downbeat
    const v = sv(rr(-0.3, 0.3), 0.5), g = gn(v.out), f = flt(g, 'lowpass', 200, 0.7), te = t + len; noi(t, len + 1.0, f, bufBrown);
    sw(f.frequency, t, 160, 1300, len); f.frequency.exponentialRampToValueAtTime(250, te + 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, te); g.gain.exponentialRampToValueAtTime(0.0001, te + 0.9);
    const h = gn(v.out), hf = flt(h, 'highpass', 2500); noi(te - 0.05, 1.0, hf); ad(h.gain, te - 0.05, 0.03, 0.06, 0.8);
    finishVoice(v);
  }
  function bossStepMusic(t, s, sd) {
    const B = SEQ.boss, b2 = (SEQ.bar & 1) * 16 + s, pc = B.perc, up = SEQ.bar & 2 ? 12 : 0;
    if (B.lead === 'trem') { for (let i = 0; i < B.m.length; i++) { const e = B.m[i]; if (b2 >= e[0] && b2 < e[0] + e[2]) { pluck(t, e[1] + up, 0.08 + 0.04 * ((b2 - e[0]) % 2 === 0), sd * 1.3); break; } } }
    else for (let i = 0; i < B.m.length; i++) if (B.m[i][0] === b2) lead(B, t, B.m[i][1] + (B.lead === 'bell' ? up : 0), B.m[i][2], sd);
    if (pc === 'bone') { if (rnd() < (s % 4 === 0 ? 0.9 : s % 2 ? 0.25 : 0.5)) click(t, s % 4 === 0 ? 0.35 : 0.18, rr(1300, 2100), rr(-0.4, 0.4)); }
    else if (pc === 'heavy') { if (s === 0 || s === 8) timpS(t, s ? 0.3 : 0.42); }
    else if (pc === 'ice') { if (s === 0 && (SEQ.bar & 1) === 0) bell(t, 86 + ((rnd() * 3) | 0) * 2, 0.04, rr(-0.7, 0.7)); if (rnd() < 0.08) click(t, 0.12, rr(4500, 7000), rr(-0.7, 0.7)); }
    else if (pc === 'skitter') { if (rnd() < 0.55) click(t + rr(0, sd * 0.5), rr(0.06, 0.15), rr(3500, 6000), rr(-0.6, 0.6)); }
    else if (pc === 'anvil') { if (s === 4 || s === 12) anvil(t, 0.13); }
    else if (pc === 'ritual') { if (s === 0 || s === 6 || s === 10) drum(t, s ? 0.25 : 0.38, 70); if (s === 8) bell(t, 93, 0.035, 0); }
    else if (pc === 'tide') { // deep timpani, a wave every two bars, a buoy bell now and then
      if (s === 0) timpS(t, SEQ.bar & 1 ? 0.3 : 0.42); else if (s === 10 && SEQ.bar & 1) timpS(t, 0.22);
      if (s === 0 && (SEQ.bar & 1) === 0) swellS(t, sd * 32);
      if (s === 8 && SEQ.bar % 4 === 2) bell(t, 69, 0.03, rr(-0.6, 0.6));
    }
  }
  function playStep(t) {
    const s = SEQ.step;
    if (s === 0) decideBar();
    const I = SEQ.I, L = SEQ.lay, LD = LM.def, kit = LD.kit, sp = LD.sparse || 1, sd = 60 / SEQ.bpm / 4, r = rootAt(t), hv = () => rr(0.88, 1.08);
    if (L.pulse) {
      if (SEQ.low > 0.45) { if (s === 0 || s === 8) { drum(t, (0.3 + 0.25 * SEQ.low) * hv(), 52); drum(t + 0.17, (0.2 + 0.15 * SEQ.low) * hv(), 47); } }
      else if (kit === 'hand') { const P = MAQ[s]; if (P) kitHit(P > 0 ? dumD : tekD, t, Math.abs(P) * (0.24 + 0.3 * I) * hv(), rr(-0.15, 0.15), 0.2); }
      else {
        const P = PULSE[SEQ.pat][s];
        if (P && (sp >= 1 || s % 8 === 0)) {
          const v = P * (0.22 + 0.3 * I) * hv();
          if (kit === 'frame') kitHit(frameD, t, v * 1.1, rr(-0.1, 0.1), 0.25);
          else if (kit === 'glass') drum(t, v * 0.6, 62);
          else if (kit === 'heavy') { drum(t, v * 0.85, 50); kitHit(frameD, t, v * 0.7, 0, 0.3); kitHit(heavyD, t, v, rr(-0.1, 0.1), 0.3); }
          else if (kit === 'storm') { const f = mtof(LD.tonic - 12 + (s === 8 ? 7 : 0)); kitHit((d, tt, vv) => timpHit(d, tt, vv, f), t, v * 0.9, rr(-0.15, 0.15), 0.4); } // timpani on the tonic and fifth
          else drum(t, v, 55);
        }
      }
    }
    if (L.tick && s % 2 === 1 && rnd() < 0.85 * sp) {
      const v = (s % 4 === 3 ? 0.07 : 0.045) * (0.5 + I) * hv();
      if (kit === 'glass') kitHit(glassTickD, t, v * 0.9, rr(-0.6, 0.6), 0.5);
      else if (kit === 'frame') kitHit(woodD, t, v * 2.2, rr(-0.4, 0.4), 0.2);
      else if (kit === 'hand') kitHit(riqD, t, v * 1.4, rr(-0.45, 0.45), 0.1);
      else shaker(t, v);
    }
    if (L.bass && !SEQ.rest && (sp >= 1 || s % 4 === 0)) { const o = OST[SEQ.ost][s]; if (o !== null) pluck(t, r + o, (0.09 + 0.07 * I) * hv() * (s % 4 === 0 ? 1.15 : 1) * (kit === 'glass' ? 0.8 : 1), sd * (kit === 'glass' ? 2.4 : 1.6), kit === 'frame' ? 3.5 : kit === 'glass' || kit === 'storm' ? 3 : 6); }
    if (L.war) {
      if (kit === 'hand') { const w = MAQW[s]; if (w) { if (w > 0) taiko(t, w * (0.25 + 0.3 * I) * hv(), 70); else kitHit(tekD, t, -w * (0.3 + 0.3 * I) * hv(), rr(-0.4, 0.4), 0.3); } }
      else { const w = WAR[SEQ.pat][s]; if (w && (sp >= 1 || s % 4 === 0)) { const tv = w * (0.25 + 0.3 * I) * hv() * (kit === 'glass' ? 0.7 : kit === 'heavy' ? 1.05 : 1); taiko(t, tv, kit === 'heavy' ? 50 : kit === 'storm' ? 52 : kit === 'frame' ? 54 : kit === 'glass' ? 68 : 60); if (kit === 'heavy' || kit === 'storm') kitHit(heavyD, t, tv * (kit === 'storm' ? 0.6 : 0.8), rr(-0.25, 0.25), 0.4); } }
      if (SEQ.bar === 7 && s >= 12) taiko(t + sd * 0.5, 0.18 * hv(), 78 + (s - 12) * 6);
      if (kit === 'heavy' && I > 0.7 && (s === 4 || s === 12) && !SEQ.boss) anvil(t, 0.06);
    }
    if (L.gong && SEQ.bar === 0 && s === 0 && SEQ.phrase % 2 === 1) { if (kit === 'glass') bell(t, 88, 0.06, 0); else gong(t, 0.09); }
    if (SEQ.motif >= 0 && !SEQ.boss) {
      const MM = LD.motifs || MOTIF, b2 = SEQ.bar * 16 + s, M = MM[SEQ.motif % MM.length], oct = SEQ.bar >= 4 ? 12 : 0, off = SEQ.bar >= 4 ? 64 : 0;
      if (SEQ.bar < 2 || (SEQ.bar >= 4 && SEQ.bar < 6 && I > 0.75)) for (let i = 0; i < M.length; i++) if (M[i][0] === b2 - off) leadNote(t, deg(LD, M[i][1]) + oct, M[i][2] * sd * 0.92, 0.1 + 0.05 * I);
    }
    if (SEQ.boss) bossStepMusic(t, s, sd);
    if (SEQ.horde > 0.5 && (s % 2 === 0 || SEQ.bar === 7)) drum(t, (s % 4 === 0 ? 0.26 : 0.14) * hv(), 118 + (s % 8 === 4 ? 22 : 0));
    SEQ.next = t + sd;
    if (++SEQ.step >= 16) { SEQ.step = 0; SEQ.bar = (SEQ.bar + 1) % 8; }
  }
  function seqTick(now) {
    if (SEQ.next < now - 0.1) SEQ.next = now + 0.05; // after a stall, rejoin rather than catch up
    let n = 0;
    while (SEQ.next < now + 0.2 && n++ < 8) playStep(Math.max(SEQ.next, now + 0.005));
  }

  // ---- Crowd bed: shuffling feet, murmur and skittering that follow the horde on the road. ----
  const CR = { pan: null, src: null, lvl: 0, tl: 0, p: 0, big: 0, swarm: 0, acc: 0, idle: 0, pick: [], ends: [] };
  function startCrowd() {
    nCrowd = gn(nCrowdDuck, 0); nCrowd.rv = RV.crowd; // the bed's own reverb send is taken after the pause gain, in build()
    CR.pan = panNode(0, nCrowd);
  }
  // The bed's sources only run while monsters are on the road.
  function crowdSrc(on, now) {
    if (on && !CR.src) {
      const sh = gn(CR.pan, 1), am = gn(sh, 0.75), mur = gn(sh, 0), rust = gn(sh, 0), ram = gn(rust, 0.6);
      const brown = loopSrc(bufBrown, flt(flt(am, 'bandpass', 330, 0.7), 'highpass', 90), 1.0);
      brown.connect(flt(gn(mur, 2.2), 'bandpass', 190, 1.3));
      const white = loopSrc(bufWhite, gn(flt(ram, 'bandpass', 3400, 1.1), 0.5), 1.0);
      const lf = [loopOsc('sine', 2.7, gn(am.gain, 0.16)), loopOsc('sine', 4.3, gn(am.gain, 0.1)), loopOsc('sine', 13, gn(ram.gain, 0.4))];
      CR.src = { sh: sh, mur: mur, rust: rust, nodes: [brown, white].concat(lf) };
      appM.mur = appM.rust = -1;
    } else if (!on && CR.src) {
      const c = CR.src; CR.src = null;
      c.sh.gain.setTargetAtTime(0, now, 0.02);
      for (let i = 0; i < c.nodes.length; i++) c.nodes[i].stop(now + 0.15);
      c.nodes[0].onended = () => { try { c.sh.disconnect(); } catch (e) {} };
    }
  }
  function crowdEvent(now) {
    const P = CR.pick; if (!P.length) return;
    for (let i = CR.ends.length - 1; i >= 0; i--) if (CR.ends[i] <= now) { CR.ends[i] = CR.ends[CR.ends.length - 1]; CR.ends.pop(); }
    if (CR.ends.length >= (LOW ? 3 : 5)) return;
    const m = P[(rnd() * P.length) | 0], t = now + rr(0.01, 0.12), v = voice(m.pan * 0.85, m.w, 0.25, nCrowd); V = v;
    let D = 0.4;
    if (m.c === 1) { // growl: big or fleshy
      const big = m.big, k = big ? rr(0.5, 0.7) : rr(0.85, 1.3); D = rr(0.35, 0.8) * (big ? 1.5 : 1);
      const g = gn(v.out), f = flt(g, 'bandpass', 520 * k, 3), o = osc('sawtooth', 72 * k, t, D, f);
      o.frequency.setValueAtTime(66 * k, t); o.frequency.linearRampToValueAtTime(92 * k, t + D * 0.3); o.frequency.linearRampToValueAtTime(58 * k, t + D);
      osc('sine', rr(18, 30), t, D, gn(o.frequency, 9 * k));
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(big ? 0.34 : 0.22, t + D * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + D);
    } else if (m.c === 2) { D = grains(v.out, t, 5 + ((rnd() * 5) | 0), 0.3, 0.13, 0.003, 0.01, 2800, 5600, 6, 0) - t; }
    else if (m.c === 3) { D = grains(v.out, t, 4 + ((rnd() * 4) | 0), 0.35, 0.2, 0.006, 0.02, 900, 1900, 9, 0) - t; }
    else { // wings
      D = rr(0.3, 0.5); const g = gn(v.out), am = gn(g, 0.5), f = flt(am, 'bandpass', rr(500, 800), 1.5); noi(t, D, f);
      osc('square', rr(14, 22), t, D, gn(am.gain, 0.5)); ad(g.gain, t, 0.22, 0.05, D);
    }
    finishVoice(v);
    CR.ends.push(t + D + 0.05); ST.crowd++;
  }

  // ---- Soundscapes: a looping bed plus sparse random details, faded in and out as one unit. ----
  // Each land has one under the music; each land event (Forge's G.event) has one that swells while it lasts.
  // def: { lvl, rev, bed(g) -> [sources], ev: [[fn(d, t), mean seconds between, gain, pan spread]] }
  function scapeOn(def, bus, tc) {
    const now = ctx.currentTime, g = gn(bus, 0);
    g.connect(gn(RV.amb, def.rev === undefined ? 0.3 : def.rev)); // send after the fade, so a fading scape fades its echo too
    g.gain.setValueAtTime(0, now); g.gain.setTargetAtTime(def.lvl, now, tc);
    let nodes = [];
    try { nodes = def.bed ? def.bed(g) || [] : []; } catch (e) { if (!ST.err) ST.err = 'scape: ' + e.message; }
    const ev = def.ev || [], next = [];
    for (let i = 0; i < ev.length; i++) next.push(now + rr(0.2, 1) * ev[i][1]);
    return { def: def, g: g, nodes: nodes, next: next };
  }
  function scapeOff(s, tc) {
    if (!s) return;
    const now = ctx.currentTime, g = s.g;
    g.gain.setTargetAtTime(0, now, tc);
    const end = now + tc * 7;
    for (let i = 0; i < s.nodes.length; i++) { try { s.nodes[i].stop(end); } catch (e) {} }
    if (s.nodes.length) s.nodes[0].onended = () => { try { g.disconnect(); } catch (e) {} };
    else setTimeout(() => { try { g.disconnect(); } catch (e) {} }, tc * 7000);
  }
  function scapeTick(s, now) {
    const E = s.def.ev; if (!E) return;
    for (let i = 0; i < E.length; i++) {
      if (now < s.next[i]) continue;
      s.next[i] = now + E[i][1] * rr(0.35, 1.65);
      if (LOW && E[i][1] < 2 && rnd() < 0.4) continue; // phones: thinner fast layers
      const sp = E[i][3] === undefined ? 0.8 : E[i][3], v = voice(rr(-sp, sp), E[i][2] || 1, 0, s.g); V = v;
      try { E[i][0](v.out, now + rr(0.01, 0.1)); } catch (e) { if (!ST.err) ST.err = 'scape ev: ' + e.message; }
      finishVoice(v); ST.amb++;
    }
  }

  // Small building blocks for the land details.
  function caw(d, t, k) { // one crow call: a nasal saw with two formants, pitch bends down
    const g = gn(d), f1 = flt(g, 'bandpass', 1300 * k, 3), f2 = flt(gn(g, 0.6), 'bandpass', 2300 * k, 4), src = gn(null, 1);
    src.connect(f1); src.connect(f2);
    const o = osc('sawtooth', 430 * k, t, 0.3, src); o.frequency.setValueAtTime(400 * k, t); o.frequency.linearRampToValueAtTime(470 * k, t + 0.05); o.frequency.exponentialRampToValueAtTime(330 * k, t + 0.26);
    osc('sine', rr(28, 40), t, 0.3, gn(o.frequency, 18 * k)); // throaty rasp
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3, t + 0.03); g.gain.setValueAtTime(0.3, t + 0.16); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  }
  function crows(d, t) { const n = 2 + ((rnd() * 3) | 0), k = rr(0.85, 1.15); for (let i = 0; i < n; i++) caw(d, t + i * rr(0.32, 0.48), k * rr(0.97, 1.03)); }
  function pebbles(d, t) { grains(d, t, 6 + ((rnd() * 6) | 0), rr(0.6, 1.4), 0.35, 0.006, 0.03, 500, 2200, 6, 1); }
  function ember(d, t) { grains(d, t, 3 + ((rnd() * 4) | 0), rr(0.2, 0.6), 0.4, 0.003, 0.012, 1500, 5000, 3, 0); }
  function creak(d, t) { // ice under strain: a slow click-train through a resonance
    const D = rr(0.5, 1.3), g = gn(d), bp = flt(g, 'bandpass', rr(500, 900), 5), lp = flt(bp, 'lowpass', 1800);
    const o = osc('sawtooth', rr(25, 40), t, D + 0.05, lp); o.frequency.setValueAtTime(rr(20, 35), t); o.frequency.linearRampToValueAtTime(rr(45, 90), t + D * 0.6); o.frequency.linearRampToValueAtTime(rr(25, 40), t + D);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.45, t + D * 0.3); g.gain.linearRampToValueAtTime(0.3, t + D * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + D);
  }
  function icePing(d, t) { // the "pew" a frozen lake makes when the ice shifts
    for (let i = 0; i < 2; i++) {
      const ti = t + i * rr(0.18, 0.3), g = gn(d), o = osc('sine', 3000, ti, 0.4, g), f0 = rr(2400, 3400);
      o.frequency.setValueAtTime(f0, ti); o.frequency.exponentialRampToValueAtTime(f0 * 0.14, ti + 0.3); ad(g.gain, ti, i ? 0.06 : 0.12, 0.002, 0.3);
    }
  }
  function tinkle(d, t) { for (let i = 0; i < 4; i++) belld(d, t + rnd() * 0.5, rr(2800, 4800), rr(0.02, 0.05), rr(0.3, 0.6)); }
  function frog(d, t) {
    const k = rr(0.8, 1.25), n = rnd() < 0.3 ? 1 : 2 + ((rnd() * 2) | 0), trill = rnd() < 0.25;
    for (let i = 0; i < n; i++) {
      const ti = t + i * rr(0.15, 0.2), D = trill ? rr(0.4, 0.7) : rr(0.07, 0.12), g = gn(d), am = gn(g, 0.5);
      const b1 = flt(am, 'bandpass', 700 * k, 4), b2 = flt(gn(am, 0.5), 'bandpass', 1500 * k, 6), src = gn(null, 1); src.connect(b1); src.connect(b2);
      osc('sawtooth', rr(170, 230) * k, ti, D + 0.05, src); osc('square', rr(30, 45), ti, D + 0.05, gn(am.gain, 0.5));
      g.gain.setValueAtTime(0.0001, ti); g.gain.linearRampToValueAtTime(0.4, ti + 0.012); g.gain.setValueAtTime(0.4, ti + D * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, ti + D);
      if (trill) break;
    }
  }
  function cricket(d, t) { // one chirp: a few quick pulses of a high tone
    const f = rr(4000, 4700), n = 3 + ((rnd() * 2) | 0), g = gn(d); osc('sine', f, t, n * 0.026 + 0.05, g);
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < n; i++) { const ti = t + i * 0.026; g.gain.setValueAtTime(0.0001, ti); g.gain.linearRampToValueAtTime(0.12, ti + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, ti + 0.017); }
  }
  function drip(d, t) { const f = rr(800, 1300), g = gn(d), o = osc('sine', f, t, 0.12, g); sw(o.frequency, t, f, f * 1.9, 0.035); ad(g.gain, t, 0.35, 0.002, 0.07); }
  function bubble(d, t, vel) { const f = rr(170, 420), g = gn(d), o = osc('sine', f, t, 0.12, g); sw(o.frequency, t, f, f * rr(1.6, 2.4), 0.06); ad(g.gain, t, vel, 0.004, 0.07); }
  function bubbles(d, t) { const n = 3 + ((rnd() * 5) | 0); let ti = t; for (let i = 0; i < n; i++) { bubble(d, ti, rr(0.15, 0.35)); ti += rr(0.05, 0.2); } }
  function blorp(d, t, vel) { // a fat lava bubble bursting
    const f = rr(170, 320), g = gn(d), o = osc('sine', f, t, 0.2, g); sw(o.frequency, t, f * 1.4, f * 0.5, 0.13); ad(g.gain, t, vel, 0.004, 0.13);
    const n = gn(d), nf = flt(n, 'lowpass', 1000); noi(t + 0.02, 0.08, nf); ad(n.gain, t + 0.02, vel * 0.6, 0.002, 0.05);
  }
  function lavaPops(d, t) { const n = 1 + ((rnd() * 3) | 0); for (let i = 0; i < n; i++) blorp(d, t + rnd() * 0.6, rr(0.25, 0.5)); }
  function steam(d, t) { // a vent hissing for a moment
    const D = rr(0.9, 2.2), g = gn(d), f = flt(flt(g, 'bandpass', rr(2600, 4200), 1.2), 'lowpass', 8000); noi(t, D + 0.1, f);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + D * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + D);
  }
  function rustle(d, t) { // palm fronds in a gust
    const D = rr(1.2, 2.6), g = gn(d); grains(g, t, (20 * D) | 0, D, 0.25, 0.004, 0.02, 2200, 6500, 2, 0);
    const s = gn(d), sf = flt(s, 'bandpass', 3800, 0.8); noi(t, D, sf, bufPink);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + D * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + D);
    s.gain.setValueAtTime(0.0001, t); s.gain.linearRampToValueAtTime(0.12, t + D * 0.4); s.gain.linearRampToValueAtTime(0.0001, t + D);
  }
  function chirps(d, t) { // a small bird far off
    const n = 2 + ((rnd() * 4) | 0), f0 = rr(2800, 3800);
    for (let i = 0; i < n; i++) { const ti = t + i * rr(0.09, 0.16), g = gn(d), o = osc('sine', f0, ti, 0.08, g); o.frequency.setValueAtTime(f0 * 0.85, ti); o.frequency.exponentialRampToValueAtTime(f0 * rr(1.1, 1.3), ti + 0.05); ad(g.gain, ti, 0.1, 0.005, 0.05); }
  }
  function hawk(d, t) { // a long falling cry, very distant
    const D = rr(0.8, 1.2), g = gn(d), o = osc('sine', 2600, t, D, g), f0 = rr(2300, 2800);
    o.frequency.setValueAtTime(f0 * 0.9, t); o.frequency.linearRampToValueAtTime(f0, t + 0.1); o.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + D);
    osc('sine', 9, t, D, gn(o.detune, 40));
    const h = osc('sine', f0 * 2, t, D, gn(g, 0.25)); h.frequency.setValueAtTime(f0 * 1.8, t); h.frequency.exponentialRampToValueAtTime(f0 * 1.2, t + D);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + D);
  }
  function boulder(d, t, vel) {
    const k = rr(0.7, 1.3), g = gn(d), o = osc('sine', 90 * k, t, 0.4, g); sw(o.frequency, t, 120 * k, 45 * k, 0.2); ad(g.gain, t, vel, 0.003, 0.3);
    const c = gn(d), cf = flt(c, 'bandpass', 800 * k, 1.4); noi(t, 0.16, cf); ad(c.gain, t, vel * 0.7, 0.001, 0.1);
  }

  // Stormreach details: surf on the cliffs, gusts, ship timbers, far gulls, rain patter (louder the closer the camera).
  function surf(d, t) { // a wave rolls in and breaks against the rocks below, then drains back
    const k = rr(0.85, 1.15), tc = t + rr(1.6, 2.6);
    const s = gn(d), sf = flt(s, 'lowpass', 300, 0.6); noi(t, tc - t + 3.5, sf, bufBrown); sw(sf.frequency, t, 180 * k, 700 * k, tc - t); sf.frequency.exponentialRampToValueAtTime(220 * k, tc + 3);
    s.gain.setValueAtTime(0.0001, t); s.gain.exponentialRampToValueAtTime(0.5, tc); s.gain.exponentialRampToValueAtTime(0.0001, tc + 3.2);
    const c = gn(d), cf = flt(c, 'bandpass', 900 * k, 0.5); noi(tc - 0.1, 2.6, cf, bufPink); sw(cf.frequency, tc - 0.1, 1600 * k, 500 * k, 2.2);
    c.gain.setValueAtTime(0.0001, tc - 0.1); c.gain.linearRampToValueAtTime(0.45, tc + 0.08); c.gain.exponentialRampToValueAtTime(0.0001, tc + 2.4);
    const th = gn(d), to = osc('sine', 60 * k, tc, 0.6, th); sw(to.frequency, tc, 75 * k, 38 * k, 0.4); ad(th.gain, tc, 0.25, 0.02, 0.5); // the thud on the rock
    const f = gn(d), ff = flt(f, 'highpass', 2600); noi(tc + 0.4, 3.0, ff); f.gain.setValueAtTime(0.0001, tc + 0.4); f.gain.linearRampToValueAtTime(0.06, tc + 1.0); f.gain.exponentialRampToValueAtTime(0.0001, tc + 3.2); // foam
    grains(d, tc + 1.0, 14, 2.0, 0.08, 0.004, 0.015, 900, 3000, 4, 1); // pebbles dragged back
  }
  function gust(d, t) {
    const D = rr(2, 4), g = gn(d), b = flt(g, 'bandpass', 500, 1.5), f0 = rr(300, 500); noi(t, D + 0.1, b, bufPink);
    b.frequency.setValueAtTime(f0, t); b.frequency.linearRampToValueAtTime(f0 * rr(2, 3), t + D * 0.45); b.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + D);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + D * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + D);
    if (rnd() < 0.4) { // the gust whistles through the rigging
      const w = gn(d), wf = flt(w, 'bandpass', rr(900, 1400), 18); noi(t, D, wf, bufPink); sw(wf.frequency, t + D * 0.2, wf.frequency.value, wf.frequency.value * 1.3, D * 0.4);
      w.gain.setValueAtTime(0.0001, t); w.gain.linearRampToValueAtTime(0.5, t + D * 0.5); w.gain.exponentialRampToValueAtTime(0.0001, t + D);
    }
  }
  function timber(d, t) { // old ship timbers groaning as they shift
    const n = rnd() < 0.5 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const ti = t + i * rr(0.6, 1.1), D = rr(0.6, 1.4), g = gn(d), src = gn(null, 1), fb = rr(260, 420);
      src.connect(flt(g, 'bandpass', fb, 8)); src.connect(flt(gn(g, 0.5), 'bandpass', fb * 2.3, 10));
      const o = osc('sawtooth', 20, ti, D + 0.05, src); o.frequency.setValueAtTime(rr(9, 14), ti); o.frequency.linearRampToValueAtTime(rr(22, 40), ti + D * 0.5); o.frequency.linearRampToValueAtTime(rr(10, 16), ti + D);
      g.gain.setValueAtTime(0.0001, ti); g.gain.linearRampToValueAtTime(0.5, ti + D * 0.35); g.gain.linearRampToValueAtTime(0.35, ti + D * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, ti + D);
    }
    if (rnd() < 0.3) knock(d, t + rr(0.2, 1), 0.2, rr(150, 220));
  }
  function gull(d, t, k) { // "kee-ow"
    const D = rr(0.35, 0.55), g = gn(d), src = gn(null, 1); src.connect(flt(g, 'bandpass', 1900 * k, 3)); src.connect(flt(gn(g, 0.5), 'bandpass', 3100 * k, 4));
    const o = osc('sawtooth', 900 * k, t, D + 0.05, src); o.frequency.setValueAtTime(950 * k, t); o.frequency.linearRampToValueAtTime(1350 * k, t + D * 0.3); o.frequency.exponentialRampToValueAtTime(800 * k, t + D);
    osc('sine', rr(20, 30), t, D, gn(o.frequency, 25 * k)); // rasp
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.06); g.gain.setValueAtTime(0.12, t + D * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + D);
  }
  function gulls(d, t) { const n = 2 + ((rnd() * 3) | 0), k = rr(0.9, 1.15), lp = flt(d, 'lowpass', 3500); for (let i = 0; i < n; i++) gull(lp, t + i * rr(0.4, 0.7), k * rr(0.96, 1.04)); }
  function patter(d, t) { // drops on rock and wood near the camera
    grains(d, t, 10 + ((rnd() * 10) | 0), 1.2, 0.22 * (0.35 + 0.65 * STORM.near), 0.002, 0.008, 2000, 7000, 3, 0);
    if (rnd() < 0.3) drip(d, t + rr(0, 1));
  }
  // The steady bed: far rain (a soft wash), near rain (bright hiss whose level and brightness follow the camera zoom),
  // and the open sea's low roar rising and falling.
  const STORM = { close: null, closeF: null, near: 0.5, aN: -1 };
  function stormBed(g) {
    const close = gn(g, 0.11), lp = flt(close, 'lowpass', 4600, 0.5), hp = flt(lp, 'highpass', 2200, 0.6);
    STORM.close = close; STORM.closeF = lp; STORM.aN = -1;
    return nbed(g, bufPink, 'lowpass', 1400, 0.5, 0.24, 0.05, 0.25).concat(nbed(g, bufPink, 'bandpass', 3000, 0.5, 0.1, 0.07, 0.3),
      [loopSrc(bufWhite, hp, 1.0)], nbed(g, bufBrown, 'lowpass', 160, 0.7, 0.3, 0.09, 0.6));
  }

  // Loop helper for beds: a noise source through a filter, its level and pitch wandering on slow LFOs.
  function nbed(g, buf, type, f, q, lvl, lfoHz, lfoAmt, fHz, fAmt) {
    const m = gn(g, lvl), b = flt(m, type, f, q), out = [loopSrc(buf, b, 1.0)];
    if (lfoHz) out.push(loopOsc('sine', lfoHz * rr(0.85, 1.15), gn(m.gain, lvl * lfoAmt)));
    if (fHz) out.push(loopOsc('sine', fHz * rr(0.85, 1.15), gn(b.frequency, fAmt)));
    return out;
  }
  function fogDrone(g) { // low and uneasy: a slow beating cluster under a soft filter that breathes
    const lp = flt(g, 'lowpass', 420, 2.5), out = [];
    [[55, -8, 0.22], [55, 7, 0.22], [82.4, 3, 0.16], [116.5, 0, 0.1], [164.8, -4, 0.08]].forEach((a, i) => { const o = loopOsc(i < 2 ? 'sawtooth' : 'triangle', a[0], gn(lp, a[2])); o.detune.value = a[1]; out.push(o); });
    out.push(loopOsc('sine', 0.08, gn(lp.frequency, 220)));
    return out;
  }
  const LAND = {
    ashen: { lvl: 0.67, rev: 0.35, // wind moaning through a dead pass, crows, trickling scree, sparks off the beacon
      bed: (g) => nbed(g, bufPink, 'bandpass', 330, 7, 0.55, 0.07, 0.8, 0.05, 90).concat(nbed(g, bufBrown, 'lowpass', 260, 0.7, 0.35, 0.11, 0.5)),
      ev: [[crows, 16, 0.45, 0.9], [pebbles, 11, 0.35], [ember, 2.5, 0.5, 0.3]] },
    frost: { lvl: 0.5, rev: 0.45, // thin icy whistle, creaking ice, the frozen lake's ping, crystals
      bed: (g) => nbed(g, bufPink, 'bandpass', 1700, 9, 0.45, 0.09, 0.8, 0.06, 450).concat(nbed(g, bufWhite, 'highpass', 5200, 0.7, 0.05, 0.13, 0.7)),
      ev: [[creak, 9, 0.6], [icePing, 17, 0.5], [tinkle, 8, 0.45]] },
    fen: { lvl: 0.75, rev: 0.3, // a wet murmur, frogs, crickets, drips and bubbles
      bed: (g) => nbed(g, bufBrown, 'bandpass', 300, 1.1, 0.45, 0.06, 0.4),
      ev: [[frog, 3.2, 0.45], [cricket, 0.9, 0.3], [drip, 2.8, 0.4], [bubbles, 7, 0.5, 0.6]] },
    ember: { lvl: 0.6, rev: 0.3, // lava rumbling, vents hissing, lava popping, rock crackling
      bed: (g) => nbed(g, bufBrown, 'lowpass', 170, 0.8, 0.32, 0.17, 0.5).concat(nbed(g, bufBrown, 'bandpass', 280, 1.4, 0.26, 0.23, 0.6), nbed(g, bufWhite, 'highpass', 3500, 0.7, 0.03, 0.08, 0.9)),
      ev: [[lavaPops, 2.6, 0.55], [steam, 9, 0.6], [ember, 3, 0.6, 0.6]] },
    dunes: { lvl: 0.48, rev: 0.25, // dry wind with sand in it, palms rustling, birds far away
      bed: (g) => nbed(g, bufPink, 'bandpass', 1100, 0.9, 0.25, 0.09, 0.8, 0.05, 300).concat(nbed(g, bufWhite, 'highpass', 5500, 0.7, 0.05, 0.09, 0.8)),
      ev: [[rustle, 6, 0.5], [chirps, 9, 0.5], [hawk, 24, 0.6]] },
    storm: { lvl: 0.41, rev: 0.3, // rain near and far, surf on the cliffs, gusts, ship timbers, far gulls (thunder: stormTick)
      bed: (g) => stormBed(g),
      ev: [[surf, 8, 0.8, 0.5], [gust, 9, 0.5], [timber, 12, 0.45, 0.7], [gulls, 26, 0.3, 0.9], [patter, 1.3, 0.4]] },
  };
  // The general wind bed's colour per land: [filter multiplier, whistle multiplier].
  const WINDK = { ashen: [1, 1], frost: [1.3, 1.7], fen: [0.75, 0.5], ember: [0.85, 0.7], dunes: [1.45, 0.8], storm: [1.15, 1.3] };
  const WIND_LVL = 0.42;

  // Land events: a swell under the one-shot that starts them.
  const EVB = {
    rockslide: { lvl: 0.66, rev: 0.4, bed: (g) => nbed(g, bufBrown, 'lowpass', 150, 0.8, 0.9, 0.3, 0.6).concat(nbed(g, bufBrown, 'bandpass', 360, 1.2, 0.6, 0.45, 0.7)),
      ev: [[pebbles, 0.7, 0.8], [(d, t) => boulder(d, t, rr(0.3, 0.6)), 2.2, 0.7]] },
    blizzard: { lvl: 0.65, rev: 0.4, bed: (g) => nbed(g, bufPink, 'bandpass', 520, 6, 0.9, 0.14, 0.7, 0.09, 260).concat(nbed(g, bufPink, 'bandpass', 950, 9, 0.6, 0.11, 0.8, 0.07, 400), nbed(g, bufWhite, 'highpass', 4000, 0.7, 0.07, 0.2, 0.8)),
      ev: [[tinkle, 3, 0.4]] },
    bogfog: { lvl: 0.7, rev: 0.6, bed: (g) => fogDrone(g), ev: [[bubbles, 1.6, 0.7, 0.7], [drip, 2.2, 0.4]] },
    lavaSurge: { lvl: 0.46, rev: 0.35, bed: (g) => nbed(g, bufBrown, 'lowpass', 220, 1, 1.1, 0.25, 0.5).concat(nbed(g, bufWhite, 'highpass', 3800, 0.7, 0.08, 0.4, 0.9)),
      ev: [[lavaPops, 0.8, 0.7], [steam, 3.5, 0.6], [ember, 1.2, 0.6]] },
    sandstorm: { lvl: 0.35, rev: 0.3, bed: (g) => nbed(g, bufPink, 'bandpass', 1200, 0.8, 0.7, 0.16, 0.6, 0.08, 500).concat(nbed(g, bufWhite, 'highpass', 3800, 0.7, 0.14, 0.21, 0.6)),
      ev: [[(d, t) => grains(d, t, 30, 1.2, 0.2, 0.002, 0.006, 2500, 7000, 2, 0), 0.9, 0.6]] },
    thunderstorm: { lvl: 0.45, rev: 0.35, // the rain hammering down, the wind howling, thunder rolling beyond the board
      bed: (g) => nbed(g, bufWhite, 'bandpass', 4500, 0.6, 0.22, 0.15, 0.4).concat(nbed(g, bufPink, 'bandpass', 1300, 0.8, 0.45, 0.12, 0.6, 0.07, 400), nbed(g, bufPink, 'bandpass', 520, 5, 0.45, 0.14, 0.7, 0.09, 220)),
      ev: [[(d, t) => { if (!TH.hook) thunderV(d, t, rr(0, 0.4), rr(0.5, 0.8)); }, 7, 0.6], [gust, 4, 0.5], [patter, 0.8, 0.5]] }, // with Ash's flashes, thunder only follows a flash
  };

  // Which land and event are playing now.
  const PAD_LVL = 1.5; // calm pads, a little above the wind
  const LS = { key: null, base: null, wind: null, land: null, ev: null, evKind: null };
  function scapes(now, paused) {
    if (typeof G === 'undefined' || !G) return;
    const lf = G.B && G.B.bio ? landFor(G.B.bio) : null, key = lf ? lf.id : null;
    if (key !== LS.key) { // crossfade the land beds over a few seconds
      LS.key = key; LS.base = lf ? lf.base : null; LS.wind = lf ? lf.wind : null;
      scapeOff(LS.land, 1.3); LS.land = lf && lf.scape ? scapeOn(lf.scape, nLand, 1.5) : null;
      if (lf) landMusic(lf.L, key, now);
    }
    const ek = G.event && typeof G.event.kind === 'string' ? G.event.kind : null;
    if (ek !== LS.evKind) {
      const was = LS.evKind; LS.evKind = ek;
      scapeOff(LS.ev, ek ? 0.5 : 1.0); LS.ev = null;
      if (ek && EVB[ek]) {
        LS.ev = scapeOn(EVB[ek], nEvt, 1.6);
        // The game calls sfx(kind) when an event starts; this backs it up, and the gap rule stops a double.
        if (G.phase === 'play' && !paused) play(ek, 0, 0.9, 0);
      } else if (!ek && was && G.phase === 'play' && !paused) play('eventEnd', 0, 1, 0);
    }
    if (!paused && !api.muted) { if (LS.land) scapeTick(LS.land, now); if (LS.ev) scapeTick(LS.ev, now); }
    stormTick(now, paused);
  }
  // Thunder in Stormreach. A storm flash (Ash's G.flashT: seconds since the last flash, reset to 0 by each one) brings its
  // thunder: right away for a near one, after a short delay for a distant one (G.flashD says how far, G.flashX / G.flashZ
  // pan it; without them the whole sky lit and it is usually far). A strike that plays sfx('thunder') itself mutes its flash's echo.
  // Without the hook, distant thunder of its own now and then (far only: nothing lights up).
  const TH = { ft: -1, fn: -1, hook: false, next: 0, pend: [], n: 0, strikeAt: -9 };
  function queueThunder(t, near, vel, pan) { if (TH.pend.length < 4) TH.pend.push([t, near, vel, pan === undefined ? rr(-0.6, 0.6) : pan]); }
  function flashSeen(now, ft) {
    if (now - TH.strikeAt < 0.6) return;
    TH.n++;
    let near = Math.pow(rnd(), 1.6), pan = rr(-0.6, 0.6);
    const fx = G.flashX, fz = G.flashZ, fd = G.flashD;
    if (typeof fx === 'number' && typeof fz === 'number' && fx === fx && fz === fz) {
      const dx = fx - CAM.x, dz = fz - CAM.z;
      near = cl(1 - Math.hypot(dx, dz) / 60, 0, 1); pan = cl((dx * Math.cos(CAM.yaw) - dz * Math.sin(CAM.yaw)) / ((R.viewW || 40) * 0.5), -1, 1) * 0.7;
    }
    if (typeof fd === 'number' && fd === fd) near = cl(1 - fd, 0, 1); // Ash's distance: 0 a strike on the board, 1 far out at sea
    // The flash began ft game seconds ago (a frame at most): count that against the delay, in real seconds.
    const sp = G.speed > 0 ? G.speed : 1, late = typeof ft === 'number' && ft > 0 ? Math.min(ft / sp, 0.3) : 0;
    queueThunder(now + Math.max(0, (near > 0.8 ? 0 : (0.25 + 2.6 * (1 - near)) * rr(0.85, 1.15)) - late), near, rr(0.75, 1), pan);
  }
  function stormTick(now, paused) {
    const on = LS.base === 'storm' || LS.evKind === 'thunderstorm' || !!(G.B && G.B.bio && G.B.bio.lightning > 0), ft = typeof G.flashT === 'number' ? G.flashT : typeof FX !== 'undefined' && FX ? FX.flashT : undefined;
    if (typeof ft === 'number' && ft === ft) {
      TH.hook = true;
      // A new flash: G.flashN went up (two flashes inside one frame still make one roll), or G.flashT went back.
      const fn = typeof G.flashN === 'number' ? G.flashN : -1, fresh = fn >= 0 ? TH.fn >= 0 && fn !== TH.fn : TH.ft >= 0 && ft < TH.ft;
      if (fresh && on && !paused) flashSeen(now, ft);
      TH.ft = ft; TH.fn = fn;
    } else if (on && !paused) {
      if (!TH.next) TH.next = now + rr(6, 16);
      else if (now >= TH.next) { TH.next = now + rr(14, 34) * (LS.evKind === 'thunderstorm' ? 0.4 : 1); queueThunder(now + rr(0.1, 0.4), rr(0, 0.35), rr(0.55, 0.85)); }
    }
    if (!on) { TH.next = 0; TH.pend.length = 0; }
    for (let i = TH.pend.length - 1; i >= 0; i--) {
      const p = TH.pend[i]; if (now < p[0] - 0.03) continue;
      TH.pend.splice(i, 1);
      if (paused || api.muted) continue;
      const t = Math.max(p[0], now + 0.005), v = voice(p[3], 1, 0.5, nLand); V = v;
      try { thunderV(v.out, t, p[1], p[2] * THUNDER_LVL); } catch (e) { if (!ST.err) ST.err = 'thunder: ' + e.message; }
      finishVoice(v); ST.amb++;
      if (p[1] > 0.4 && lateDuck.length < 8) lateDuck.push([t + 0.05, 0.35 * p[1]]);
    }
    if (STORM.close && LS.base === 'storm') { // the near rain follows the camera: louder and brighter zoomed in
      const z = typeof CAM !== 'undefined' && CAM && CAM.zoom > 0 ? CAM.zoom : 1, nr = cl((z - 0.7) / 1.4, 0, 1);
      STORM.near = nr;
      if (Math.abs(nr - STORM.aN) > 0.02) { STORM.aN = nr; STORM.close.gain.setTargetAtTime(0.09 + 0.1 * nr, now, 0.5); STORM.closeF.frequency.setTargetAtTime(3800 + 4000 * nr, now, 0.5); }
    }
  }
  const THUNDER_LVL = 1;

  // ---- Round 8: the Long Night's lands. Ash's procBiome gives bio.key 'proc' and bio.music = { seed, base }, base being
  // a hand-made land. The base sets the family: its modes are the likeliest, and the pad, kit, lead and soundscape lean
  // towards it; the seed picks the rest (root, chords, tempo, voices, motifs and details). The lantern motif is always
  // one of the battle motifs and shapes the arrival figure. A land key the audio does not know is treated the same way,
  // seeded from its key and name. The same seed always gives the same music. ----
  const PHRYG = [0, 1, 3, 5, 7, 8, 10], HUNGMIN = [0, 2, 3, 6, 7, 8, 11];
  const MODENAME = [[DORIAN, 'dorian'], [AEOLIAN, 'aeolian'], [HARMMIN, 'harmonic minor'], [PHRYGDOM, 'phrygian dominant'], [PHRYG, 'phrygian'], [HUNGMIN, 'hungarian minor']];
  const FAMILY = {
    ashen: [[DORIAN, 3], [AEOLIAN, 2], [PHRYG, 1]],
    frost: [[AEOLIAN, 3], [DORIAN, 2], [HUNGMIN, 1]],
    fen: [[AEOLIAN, 3], [PHRYG, 2], [DORIAN, 1]],
    ember: [[HARMMIN, 3], [HUNGMIN, 2], [PHRYG, 1]],
    dunes: [[PHRYGDOM, 3], [HUNGMIN, 2], [HARMMIN, 1]],
    storm: [[AEOLIAN, 3], [DORIAN, 1], [HARMMIN, 1], [PHRYG, 1]],
  };
  const BASES = ['ashen', 'frost', 'fen', 'ember', 'dunes', 'storm'];
  const PADS = ['saw', 'glass', 'murk', 'brass', 'nasal', 'strings'], CALMS = ['piano', 'glass', 'reed', 'lowbrass', 'oud', 'cello'];
  const KITS = ['drums', 'glass', 'frame', 'heavy', 'hand', 'storm'], LEADS = ['brass', 'bell', 'reed', 'ney', 'lowbrass', 'concertina'];
  const PADLVL = { saw: 1, glass: 0.75, murk: 0.9, brass: 1.5, nasal: 1, strings: 0.85 };
  const DETAIL = [crows, pebbles, ember, creak, icePing, tinkle, frog, cricket, drip, bubbles, steam, rustle, chirps, hawk, gust, timber];
  function hash32(s) { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulb(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function wpick(r, list) { let s = 0; for (let i = 0; i < list.length; i++) s += list[i][1]; let u = r() * s; for (let i = 0; i < list.length; i++) { u -= list[i][1]; if (u < 0) return list[i][0]; } return list[0][0]; }
  const lean = (r, own, all, w) => (r() < w ? own : all[(r() * all.length) | 0]);
  // A chord on scale degree k, voiced like the hand-made lands: [bass, fifth, root, third, fifth (or a 7th / 9th colour)],
  // with melody notes for the calm voice taken from its tones between C4 and A5.
  function genChord(r, sc, tonic, k) {
    const st = (i) => sc[(((k + i) % 7) + 7) % 7] + 12 * Math.floor((k + i) / 7);
    const root = st(0), third = st(2) - root, fifth = st(4) - root;
    let bass = tonic + root - 12; while (bass > 41) bass -= 12; while (bass < 29) bass += 12;
    const top = bass + 12, n = [bass, bass + fifth, top, top + third, top + fifth];
    let col = -1; if (r() < 0.35) { col = (r() < 0.5 ? st(6) : st(8)) - root; n[4] = top + col; }
    const pcs = [0, third, fifth].concat(col >= 0 ? [col] : []).map((x) => (bass + x) % 12), all = [], m = [];
    for (let x = 60; x <= 81; x++) if (pcs.indexOf(x % 12) >= 0) all.push(x);
    const step = Math.max(1, all.length / 6); for (let i = 0; i < all.length && m.length < 6; i += step) m.push(all[Math.floor(i)]);
    return { n: n, m: m, to: [] };
  }
  function genMotif(r) { // a two-bar line wandering by steps, home on the tonic at the end
    const out = [], LEN = [2, 2, 4, 4, 6, 2, 8], MV = [-2, -1, -1, 1, 1, 2, 0];
    let s = 0, d = r() < 0.5 ? 0 : -3;
    while (s < 24) { const len = Math.min(LEN[(r() * LEN.length) | 0], 24 - s); out.push([s, d, len]); s += len; d = cl(d + MV[(r() * MV.length) | 0], -4, 5); }
    out.push([24, 0, 8]); return out;
  }
  function genLand(seed, base) {
    const r = mulb(hash32('lanternhold:' + seed + ':' + base)), b = LANDMUS[base], sc = wpick(r, FAMILY[base]);
    const tonic = 45 + ((r() * 11) | 0), pad = lean(r, b.pad, PADS, 0.55), calm = lean(r, b.calm, CALMS, 0.5), kit = lean(r, b.kit, KITS, 0.6), lead = lean(r, b.lead, LEADS, 0.45);
    // chords: the tonic and up to four more (VI, iv, VII, III, v, II in that order of liking), skipping any without a perfect fifth
    const cand = [[5, 3], [3, 3], [6, 2], [2, 2], [4, 2], [1, 1]], degs = [0];
    for (let n = 0; n < 40 && degs.length < 5; n++) {
      const k = wpick(r, cand); if (degs.indexOf(k) >= 0) continue;
      if (sc[(k + 4) % 7] + (k + 4 >= 7 ? 12 : 0) - sc[k] !== 7) continue;
      degs.push(k);
    }
    const ch = degs.map((k) => genChord(r, sc, tonic, k)), N = ch.length;
    for (let i = 0; i < N; i++) { // which chords may follow: the tonic may go anywhere, the others mostly lean home
      const o = []; for (let j = 0; j < N; j++) if (j !== i) o.push(j);
      for (let j = o.length - 1; j > 0; j--) { const q = (r() * (j + 1)) | 0, x = o[j]; o[j] = o[q]; o[q] = x; }
      const to = o.slice(0, i === 0 ? Math.min(3, o.length) : 1 + ((r() * 2) | 0));
      if (i > 0 && to.indexOf(0) < 0 && (r() < 0.6 || i === N - 1)) to[0] = 0;
      ch[i].to = to;
    }
    const motifs = [LANTERN_M, b.motifs ? b.motifs[(r() * b.motifs.length) | 0] : MOTIF[(r() * 3) | 0], genMotif(r)];
    const sp = 0.28 + r() * 0.14, e3 = 3 * sp; // the arrival figure: the lantern rising, then home
    const arr = [[0, -3, sp], [sp, 0, sp], [2 * sp, 1, sp], [e3, 2, 0.9], [e3 + 0.95, 1, sp], [e3 + 1.05 + sp, 0, 1.6]];
    const L = { semi: tonic - 50, tonic: tonic, scale: sc, pad: pad, calm: calm, kit: kit, lead: lead, bpm: cl(b.bpm + Math.round((r() - 0.5) * 12), -12, 8), lvl: PADLVL[pad] || 1, ch: ch, motifs: motifs, arr: arr, base: base, gen: seed };
    if (pad === 'glass' || kit === 'glass') L.sparse = 0.5;
    // the soundscape: the base land's bed, its details re-timed (one dropped now and then), and a detail from another land
    const B0 = LAND[base], ev = B0.ev.map((e) => [e[0], e[1] * (0.7 + r() * 0.7), e[2], e[3]]);
    if (ev.length > 2 && r() < 0.4) ev.splice((r() * ev.length) | 0, 1);
    const dn = DETAIL[(r() * DETAIL.length) | 0]; if (!ev.some((e) => e[0] === dn)) ev.push([dn, 7 + r() * 14, 0.35 + r() * 0.2, 0.8]);
    const drone = r() < 0.3, bed0 = B0.bed;
    const scape = { lvl: B0.lvl * (0.85 + r() * 0.3), rev: (B0.rev || 0.3) + r() * 0.15, bed: drone ? (g) => bed0(g).concat(fogDrone(gn(g, 0.45))) : bed0, ev: ev };
    const wk = WINDK[base];
    return { L: L, scape: scape, wind: [wk[0] * (0.85 + r() * 0.3), wk[1] * (0.7 + r() * 0.6)], base: base };
  }
  const HAND = Object.create(null), GEN = Object.create(null); let genN = 0;
  // The music, soundscape and wind for a land (its BIOMES entry): the hand-made ones as they are, anything else generated.
  function landFor(bio) {
    if (!bio || typeof bio !== 'object' || typeof bio.key !== 'string' || !bio.key) return null;
    const k = bio.key;
    if (LANDMUS[k]) return HAND[k] || (HAND[k] = { id: k, L: LANDMUS[k], scape: LAND[k], wind: WINDK[k], base: k });
    const mu = bio.music && typeof bio.music === 'object' ? bio.music : null;
    let seed = mu && mu.seed !== undefined && mu.seed !== null && isFinite(+mu.seed) ? +mu.seed >>> 0 : -1;
    if (seed < 0) seed = hash32(k + '|' + (typeof bio.name === 'string' ? bio.name : ''));
    const bk = mu && typeof mu.base === 'string' ? mu.base : typeof bio.dress === 'string' ? bio.dress : '';
    const base = LANDMUS[bk] ? bk : BASES[seed % 6], id = k + ':' + seed + ':' + base;
    let e = GEN[id];
    if (!e) { if (++genN > 32) { for (const q in GEN) delete GEN[q]; genN = 1; } e = genLand(seed, base); e.id = id; GEN[id] = e; }
    return e;
  }
  const NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  function describe(L) {
    if (!L) return '';
    const mn = MODENAME.find((x) => x[0] === L.scale);
    return NOTE[((L.tonic % 12) + 12) % 12] + ' ' + (mn ? mn[1] : '?') + ', pad ' + L.pad + ', calm ' + L.calm + ', kit ' + L.kit + ', lead ' + L.lead + ', bpm ' + (L.bpm >= 0 ? '+' : '') + L.bpm + ', ' + L.ch.length + ' chords' + (L.gen !== undefined ? ', from ' + L.base + ' seed ' + L.gen : '');
  }

  // ---- Round 8: scenes. The main menu plays the title theme over the AI demo (the demo's land music silent, its
  // effects pushed back, its stingers left out); a story panel ducks the music; the game is everything else. Mira's UI
  // can say which with AU.setScene('menu' | 'story' | 'game'). Without that the scene is read from the game each frame:
  // G.phase or G.scene 'menu' / 'story', UI.mainMenu, UI.title, UI.home or UI.offer (the continue prompt) for the menu,
  // UI.story, UI.dialog or UI.dialogue (an object, or true; an object with open / active / visible false is shut) for
  // a story panel. What the game shows wins over setScene; setScene covers what the audio cannot see.
  // Levels per scene: [land music, title theme, effects and crowd, ambience, music duck].
  const SCL = { game: [1, 0, 1, 1, 1], menu: [0, 1, 0.4, 0.7, 1], story: [1, 0, 0.7, 0.85, 0.35] };
  const SC = { forced: null, cur: 'game', applied: false, game: null, gameRv: null, fx: null, fxRv: null, amb: null, duck: null, offAt: 0, idle: false, st: null, stKey: null, lineQ: [] };
  function setScene(s) {
    SC.forced = s === 'menu' || s === 'story' || s === 'game' ? s : null;
    if (ctx && api.ready) { try { sceneTick(ctx.currentTime); } catch (e) { if (!ST.err) ST.err = 'scene: ' + e.message; } }
  }
  const shown = (o) => o === true || (!!o && typeof o === 'object' && o.open !== false && o.active !== false && o.visible !== false && o.closed !== true && o.done !== true);
  function storyState() {
    const U = typeof UI !== 'undefined' && UI ? UI : null, g = typeof G !== 'undefined' && G ? G : null;
    if (U) { if (shown(U.story)) return U.story; if (shown(U.dialog)) return U.dialog; if (shown(U.dialogue)) return U.dialogue; }
    if (g && g.story && typeof g.story === 'object' && (g.story.open === true || g.story.active === true)) return g.story;
    if (g && (g.phase === 'story' || g.scene === 'story')) return true;
    return null;
  }
  function menuShown() {
    const U = typeof UI !== 'undefined' && UI ? UI : null, g = typeof G !== 'undefined' && G ? G : null;
    if (g && (g.phase === 'menu' || g.scene === 'menu' || g.mainMenu === true)) return true;
    return !!U && (shown(U.mainMenu) || shown(U.title) || shown(U.home) || shown(U.offer));
  }
  function sceneTick(now) {
    const st = storyState(), s = st ? 'story' : menuShown() ? 'menu' : SC.forced || 'game';
    storyWatch(st, now);
    if (s === SC.cur && SC.applied) return;
    const was = SC.applied ? SC.cur : 'game', L = SCL[s], tc = s === 'menu' ? 0.5 : was === 'menu' ? 0.9 : 0.35;
    SC.cur = s; SC.applied = true;
    const to = (n, v, c) => { n.gain.cancelScheduledValues(now); n.gain.setTargetAtTime(v, now, c); };
    to(SC.game, L[0], tc); to(SC.gameRv, L[0], tc);
    to(TT.bus, L[1] * TT_LVL, s === 'menu' ? 0.35 : 1.0); to(TT.rv, L[1] * TT_LVL, s === 'menu' ? 0.35 : 1.0);
    to(SC.fx, L[2], tc); to(SC.fxRv, L[2], tc); to(SC.amb, L[3], tc);
    to(SC.duck, L[4], L[4] < 1 ? 0.25 : 0.6);
    if (s === 'menu') { titleStart(now); SC.offAt = now + 5; }
    else if (was === 'menu') { // into a run: the title fades over a few seconds while the land's music comes in on a fresh chord
      TT.stopAt = now + 7;
      if (SC.idle) { mus.nextChord = now + 0.15; SC.idle = false; }
      calmDown();
    }
  }
  // Story lines, read from the panel object: a new line index (i, idx, index, line, step or page) or new text plays the
  // speaker's murmur. The speaker comes from speaker / who / portrait, on the panel or on lines[index].
  function storyWatch(st, now) {
    if (!st) { SC.st = null; SC.stKey = null; return; }
    const first = !SC.st; SC.st = st;
    if (first) play('storyOpen', 0, 1, 0);
    if (typeof st !== 'object') return;
    const ks = ['i', 'idx', 'index', 'line', 'step', 'page']; let idx;
    for (let j = 0; j < ks.length; j++) if (typeof st[ks[j]] === 'number') { idx = st[ks[j]]; break; }
    const ln = Array.isArray(st.lines) && idx !== undefined ? st.lines[idx] : null, lo = ln && typeof ln === 'object' ? ln : null;
    const text = typeof st.text === 'string' ? st.text : lo && typeof lo.text === 'string' ? lo.text : typeof ln === 'string' ? ln : '';
    const who = st.speaker || st.who || st.portrait || (lo ? lo.speaker || lo.who || lo.portrait : '') || '';
    const key = (idx === undefined ? '' : idx) + '|' + text.slice(0, 48) + '|' + (typeof who === 'object' ? who.key || who.id || who.name || '' : who);
    if (key !== SC.stKey) { SC.stKey = key; if ((idx !== undefined || text) && SC.lineQ.length < 3) SC.lineQ.push([now + (first ? 0.45 : 0.03), who, text]); }
  }
  // Speaker to voice: 0 the Keeper, 0.5 the Old Keeper's ghost (or any spirit), 1 a boss, other names 0.25-0.35.
  function speakerP(w) {
    if (typeof w === 'number' && w === w) return cl(w, 0, 1);
    if (w && typeof w === 'object') w = w.key || w.id || w.name || w.who || '';
    const s = String(w || '').toLowerCase();
    if (!s) return 0;
    if (/ghost|old ?keeper|spirit|shade|wisp|elder|voice/.test(s)) return 0.5;
    if (/boss|king|queen|giant|ogre|jotun|colossus|leviathan|hollow|lord|tyrant|drowned|titan/.test(s) || (typeof MON !== 'undefined' && MON && MON[s] && MON[s].boss)) return 1;
    if (/keeper|lantern|hero|player/.test(s)) return 0;
    return 0.25 + (hash32(s) % 100) / 1000;
  }
  function storyLine(who, text) {
    if (!api.ready) return;
    SL.n = typeof text === 'string' && text ? cl(Math.round(text.length / 9), 3, 9) : 0;
    play('storyLine', 0, 1, speakerP(who)); SL.n = 0;
  }
  function storyQueue(now) { for (let i = SC.lineQ.length - 1; i >= 0; i--) if (now >= SC.lineQ[i][0]) { const q = SC.lineQ.splice(i, 1)[0]; if (SC.st) storyLine(q[1], q[2]); } }

  // ---- Round 8: the Lanternhold title theme, for the main menu. D minor, 70 bpm. An intro where the lantern motif rings
  // alone on a music box over the pad and a far bell; the Keeper's melody on a cello, built on the motif (A); the strings
  // take it up high over a heartbeat drum, and the bar before the return answers with the motif in A major (B); the
  // melody on the music box with the cello singing under it (A'); a quiet close on the motif (outro); then it loops
  // from A (a horn takes the melody the second time). It has its own bus, so it keeps playing over the paused demo. ----
  const TT = { bus: null, rv: null, on: false, next: 0, sec: 0, bar: 0, loops: 0, stopAt: 0 };
  const TBAR = 240 / 70, T8 = TBAR / 8, TT_LVL = 2.5; // the title is the foreground on the menu: well above the land music's level
  const TCH = { Dm: [38, 50, 53, 57, 62], Dm9: [38, 50, 53, 57, 64], Bb: [34, 50, 53, 58, 62], Bbmaj7: [34, 46, 50, 53, 57], F: [41, 48, 53, 57, 60], C: [36, 48, 52, 55, 60],
    Gm: [43, 50, 55, 58, 62], Gm6: [43, 50, 52, 55, 58], A: [33, 49, 52, 57, 61], Asus: [33, 50, 52, 57, 62] };
  // Melodies per bar as [eighth, MIDI note, length in eighths].
  const TA = [[[0, 57, 1], [1, 62, 1], [2, 64, 1], [3, 65, 9]], [[4, 64, 2], [6, 62, 2]], [[0, 60, 2], [2, 65, 2], [4, 69, 4]], [[0, 67, 3], [3, 65, 1], [4, 64, 4]],
    [[0, 57, 1], [1, 62, 1], [2, 64, 1], [3, 65, 5]], [[0, 67, 2], [2, 65, 2], [4, 62, 4]], [[0, 70, 3], [3, 69, 1], [4, 67, 2], [6, 65, 2]], [[0, 64, 4], [4, 61, 4]]];
  const TB = [[[0, 67, 2], [2, 70, 2], [4, 74, 4]], [[0, 72, 3], [3, 70, 1], [4, 69, 4]], [[0, 70, 2], [2, 74, 2], [4, 77, 4]], [[0, 76, 3], [3, 74, 1], [4, 72, 4]],
    [[0, 67, 2], [2, 70, 2], [4, 74, 4]], [[0, 77, 4], [4, 76, 2], [6, 74, 2]], [[0, 74, 3], [3, 72, 1], [4, 70, 2], [6, 69, 2]], [[0, 69, 8]]];
  const TCTR = [[[0, 50, 8]], [[0, 50, 4], [4, 53, 4]], [[0, 48, 8]], [[0, 48, 4], [4, 52, 4]], [[0, 50, 8]], [[0, 53, 8]], [[0, 55, 4], [4, 58, 4]], [[0, 57, 4], [4, 55, 4]]];
  const TSEC = [
    { ch: ['Dm9', 'Bbmaj7', 'Dm9', 'Asus'], mel: [[[0, 69, 1], [1, 74, 1], [2, 76, 1], [3, 77, 9]], [], [[0, 69, 1], [1, 74, 1], [2, 76, 1], [3, 79, 3], [6, 77, 2]], [[0, 76, 8]]], v: 'lantern', bass: 0, arp: 0, drum: 0, bell: 1, pad: 0.7 },
    { ch: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'], mel: TA, v: 'cello', bass: 1, arp: 1, drum: 0, pad: 0.85 },
    { ch: ['Gm', 'Dm', 'Bb', 'F', 'Gm', 'Dm', 'Bb', 'A'], mel: TB, v: 'violin', bass: 1, arp: 2, drum: 1, pad: 1, glint: 1 },
    { ch: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'], mel: TA, up: 12, v: 'lantern', ctr: TCTR, bass: 1, arp: 2, drum: 0.5, pad: 0.9 },
    { ch: ['Dm9', 'Bbmaj7', 'Gm6', 'Dm9'], mel: [[[0, 69, 2], [2, 74, 2], [4, 76, 2], [6, 77, 6]], [[4, 76, 2], [6, 74, 2]], [[0, 67, 2], [2, 70, 2], [4, 76, 4]], [[0, 74, 8]]], v: 'piano', bass: 0.5, arp: 0, drum: 0, bell: 1, pad: 0.7 },
  ];
  function tv(pan, send) { const v = voice(pan, 1, send, TT.bus); V = v; return v; }
  function tNote(vox, t, m, dur, vel) {
    const v = tv(vox === 'lantern' ? rr(-0.25, 0.25) : rr(-0.12, 0.12), vox === 'lantern' ? 0.55 : 0.4), d = Math.max(0.3, dur);
    if (vox === 'lantern') lanternTone(v.out, t, m, 0.9 * vel);
    else if (vox === 'cello') celloTone(v.out, t, m, d, 1.1 * vel);
    else if (vox === 'violin') { celloTone(v.out, t, m, d, 0.8 * vel); hornNote(v.out, t, mtof(m - 12), d, 0.05 * vel, 0.8); }
    else if (vox === 'horn') hornNote(v.out, t, mtof(m), d, 0.09 * vel, 0.85);
    else pianoTone(v.out, t, m, 0.9 * vel);
    finishVoice(v);
  }
  function tPad(t, ch, dur, lvl) { // warm strings: two detuned saws a note, spread, a filter that breathes with the bar
    const v = tv(0, 0.6), env = gn(v.out), lp = flt(env, 'lowpass', 600, 0.6), end = dur + 2.6;
    lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(700 + 600 * lvl, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(600, t + end);
    const vib = gn(null, 3); osc('sine', rr(4.5, 5.2), t, end, vib);
    for (let i = 1; i < ch.length; i++) for (let s = 0; s < 2; s++) { const o = osc('sawtooth', mtof(ch[i]), t, end, gn(panNode(s ? 0.35 : -0.35, lp), 0.03)); o.detune.value = (s ? 1 : -1) * rr(4, 8); vib.connect(o.detune); }
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(lvl, t + 0.9); env.gain.setValueAtTime(lvl, t + dur - 0.2); env.gain.setTargetAtTime(0.0001, t + dur - 0.2, 0.45);
    finishVoice(v);
  }
  function tBass(t, m, dur, lvl) { // a soft low root, and a bowed cello an octave up so a phone speaker hears it
    const v = tv(0, 0.2), g = gn(v.out), lp = flt(g, 'lowpass', 400);
    osc('triangle', mtof(m), t, dur + 1, lp); osc('sine', mtof(m), t, dur + 1, gn(lp, 0.8));
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.055 * lvl, t + 0.3); g.gain.setTargetAtTime(0.0001, t + dur - 0.1, 0.25);
    celloTone(v.out, t, m + 12, dur - 0.1, 0.45 * lvl);
    finishVoice(v);
  }
  function tArp(t, ch, k) { // a harp: quarter notes rising (k = 1), or eighths rising and falling (k = 2)
    const up = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[4] + 12], seq = k === 1 ? [0, 1, 2, 3] : [0, 1, 2, 3, 2, 1, 2, 3], step = k === 1 ? 2 : 1;
    for (let i = 0; i < seq.length; i++) { const v = tv(rr(-0.4, 0.4), 0.4); harpTone(v.out, t + i * step * T8, up[seq[i]], (i % 4 === 0 ? 0.9 : 0.65) * (k === 1 ? 0.8 : 0.7)); finishVoice(v); }
  }
  function tDrum(t, k, roll) { // a heartbeat on a muffled frame drum; a timpani roll into the return
    const v = tv(0, 0.35);
    frameD(v.out, t, 0.35 * k); if (k >= 1) { frameD(v.out, t + 3 * T8, 0.18); frameD(v.out, t + 4 * T8, 0.26); }
    if (roll) for (let i = 0; i < 12; i++) timpHit(v.out, t + 4 * T8 + i * T8 * 0.33, 0.04 + 0.012 * i, mtof(38));
    finishVoice(v);
  }
  function titleBar(t) {
    const S0 = TSEC[TT.sec], b = TT.bar, ch = TCH[S0.ch[b]], last = b === S0.ch.length - 1;
    tPad(t, ch, TBAR + 0.25, S0.pad);
    if (S0.bass) tBass(t, ch[0], TBAR, S0.bass);
    if (S0.arp) tArp(t, ch, S0.arp);
    if (S0.drum) tDrum(t, S0.drum, last && S0.glint);
    if (S0.bell && b === 0) { const v = tv(rr(-0.3, 0.3), 0.9); belld(flt(v.out, 'lowpass', 3000), t, mtof(62), 0.05, 4); finishVoice(v); }
    const mel = S0.mel[b] || [], vox = TT.loops > 0 && TT.sec === 1 ? 'horn' : S0.v;
    for (let i = 0; i < mel.length; i++) tNote(vox, t + mel[i][0] * T8, mel[i][1] + (S0.up || 0), mel[i][2] * T8, 1);
    if (S0.ctr) for (let i = 0; i < S0.ctr[b].length; i++) { const n = S0.ctr[b][i]; tNote('cello', t + n[0] * T8, n[1], n[2] * T8, 0.6); }
    if (S0.glint && last) [76, 81, 83, 85].forEach((m, i) => tNote('lantern', t + (2 + i) * T8, m, T8, i === 3 ? 0.9 : 0.7)); // the lantern in A major
    if (++TT.bar >= S0.ch.length) { TT.bar = 0; if (++TT.sec >= TSEC.length) { TT.sec = 1; TT.loops++; } }
  }
  function titleStart(now) {
    TT.stopAt = 0;
    if (TT.on) return; // back to the menu before the title had faded: it carries on where it was
    TT.on = true; TT.sec = 0; TT.bar = 0; TT.loops = 0; TT.next = now + 0.3;
  }
  function titleTick(now) {
    if (!TT.on) return;
    if (SC.cur !== 'menu' && TT.stopAt && now > TT.stopAt) { TT.on = false; return; }
    if (api.muted) return;
    if (TT.next < now - 0.3) TT.next = now + 0.05; // after a stall (muted, hidden), rejoin on the next bar
    let n = 0; while (TT.next < now + 0.4 && n++ < 2) { titleBar(TT.next); TT.next += TBAR; }
  }

  // ---- Reading the battlefield (about 8 times a second). ----
  // Same pan and distance law as sfx() in 90-main, for sounds the audio plays on its own.
  function playAt(name, x, z, gain, p) {
    const dx = x - CAM.x, dz = z - CAM.z, u = dx * Math.cos(CAM.yaw) - dz * Math.sin(CAM.yaw);
    play(name, cl(u / ((R.viewW || 40) * 0.5), -1, 1) * 0.75, gain * cl(1.12 - Math.hypot(dx, dz) / 46, 0.4, 1) * (0.72 + 0.28 * CAM.zoom), p || 0);
  }

  // ---- Watching the game for moments without their own sfx() call: phase changes (stingers), a wave cleared,
  // the menus and spell arming, overcharge and a mended beacon (the player and the AI share those, so both are heard). ----
  const W = { phase: null, k: -1, waves: [], seen: typeof WeakSet === 'function' ? new WeakSet() : null, cntAt: 0, lives: -1, B: null, ui: false, spell: null, menu: null, sel: null, hover: [], flush: false, oc: typeof WeakMap === 'function' ? new WeakMap() : null, ocAt: 0 };
  const KINDS = ['archer', 'bombard', 'spire', 'guard'];
  function calmDown() { SEQ.I = Math.min(SEQ.I, 0.05); SEQ.tI = 0; SEQ.motif = -1; }
  function watch(now) {
    if (typeof G === 'undefined' || !G) return;
    const ph = G.phase, prev = W.phase;
    if (ph !== prev) {
      W.phase = ph;
      if (prev !== null) {
        if (ph === 'clear') { play('fanfare', 0, 1, 0); calmDown(); }
        else if (ph === 'defeat') { play('lament', 0, 1, 0); calmDown(); }
        else if (ph === 'rise') play('arrival', 0, 1, 0);
      }
    }
    if (ph === 'play') {
      // A wave is beaten when every monster it brought is gone. Waves overlap (the next one often starts while the
      // last is still on the road), so each wave keeps its own list; leftovers from earlier waves never count.
      if (G.k !== W.k) {
        W.k = G.k;
        if (W.seen && G.mons) for (let i = 0; i < G.mons.length; i++) W.seen.add(G.mons[i]);
        if (W.seen && G.k > 0 && !G.bossWave) { W.waves.push([]); if (W.waves.length > 3) W.waves.shift(); }
      }
      if (W.waves.length && G.mons && now >= W.cntAt) {
        W.cntAt = now + 0.15; const M = G.mons, cur = W.waves[W.waves.length - 1];
        if (G.spawning) for (let i = 0; i < M.length; i++) if (!W.seen.has(M[i])) { W.seen.add(M[i]); if (!M[i].dead) cur.push(M[i]); }
        for (let w = 0; w < W.waves.length; w++) {
          const L = W.waves[w]; if (w === W.waves.length - 1 && G.spawning) continue;
          let alive = false; for (let i = 0; i < L.length; i++) if (!L[i].dead) { alive = true; break; }
          if (!alive) { W.waves.splice(w, 1); if (L.length) play('waveClear', 0, 1, 0); break; }
        }
      }
      if (prev === 'play' && W.B === G.B && W.lives >= 0 && G.lives > W.lives && G.B && G.B.beacon) playAt('mend', G.B.beacon.x, G.B.beacon.z, 1);
    } else { W.k = -1; W.waves.length = 0; }
    W.lives = G.lives; W.B = G.B;
    if (W.oc && G.towers && now >= W.ocAt) {
      W.ocAt = now + 0.12;
      for (let i = 0; i < G.towers.length; i++) { const t = G.towers[i], oc = t.oc || 0, was = W.oc.get(t); if (was !== undefined && oc > was && ph === 'play') playAt('overcharge', t.x, t.z, 1, cl(oc / 3, 0, 1)); W.oc.set(t, oc); }
    }
    let voiced = false;
    const U = typeof UI !== 'undefined' && UI ? UI : null;
    if (U) {
      W.ui = true;
      const sp = typeof U.spell === 'string' ? U.spell : null;
      if (sp !== W.spell) {
        if (sp) { play('spellArm', 0, 0.9, sp === 'meteor' ? 0 : sp === 'frost' ? 0.5 : 1); voiced = true; }
        else if (ph === 'play' && !(G.spellCd && G.spellCd[W.spell] > 0)) { play('spellCancel', 0, 0.8, 0); voiced = true; }
        W.spell = sp;
      }
      const mn = U.menu && typeof U.menu === 'object' ? U.menu : null;
      if (mn !== W.menu) {
        if (mn && (!W.menu || mn.pad !== W.menu.pad)) { const t = mn.tower; play('menuOpen', 0, 0.8, t && t.lvl === 2 && !t.branch ? 1 : 0); voiced = true; }
        W.menu = mn; W.sel = mn ? mn.sel : null;
      } else if (mn && mn.sel !== W.sel) {
        W.sel = mn.sel;
        if (mn.sel) {
          const br = mn.tower && mn.tower.def && mn.tower.def.branches ? Object.keys(mn.tower.def.branches) : null;
          play('uiPreview', 0, 0.8, br ? (br.indexOf(mn.sel) === 1 ? 1 : 0) : cl(KINDS.indexOf(mn.sel) / 3, 0, 1)); voiced = true;
        }
      }
    }
    if (W.hover.length) {
      if (!voiced) { W.flush = true; for (let i = 0; i < W.hover.length; i++) play('uiHover', W.hover[i][0], W.hover[i][1], W.hover[i][2]); W.flush = false; }
      W.hover.length = 0;
    }
  }
  function scan() {
    if (typeof G === 'undefined' || !G || !G.mons) return;
    const live = G.phase === 'play', cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw), half = (R.viewW || 40) * 0.5;
    let n = 0, ground = 0, near = 0, maxP = 0, wl = 0, wr = 0, big = 0, swarm = 0, boss = null;
    const P = CR.pick; P.length = 0;
    for (let i = 0; i < G.mons.length; i++) {
      const m = G.mons[i]; if (m.dead) continue;
      const bk = beastKey(m); if (bk) beastMark(m, bk);
      if (!m.vis && !m.fly) continue;
      const d = m.def;
      // (An elite is announced once, by makeElite's own sfx('elite') when it spawns; a second chime here doubled it.)
      if (d.boss) { if (m.hp > 0 && !(m.dying > 0)) boss = m; else continue; }
      n++;
      if (m.prog > maxP) maxP = m.prog; if (m.prog > 0.75) near++;
      const dx = m.x - CAM.x, dz = m.z - CAM.z, pan = cl((dx * cy - dz * sy) / half, -1, 1), w = cl(1.12 - Math.hypot(dx, dz) / 46, 0.3, 1);
      if (!m.fly) { ground++; wl += w * (1 - pan); wr += w * (1 + pan); if (d.mass >= 4) big++; if (d.cat === 'swarm') swarm++; }
      if (P.length < 48 && rnd() < 48 / (G.mons.length + 1) + 0.1) {
        const c = m.fly ? 4 : d.cat === 'swarm' || d.death === 'bug' ? 2 : d.death === 'bones' || d.death === 'rock' ? 3 : 1;
        P.push({ pan: pan, w: w, c: c, big: d.mass >= 4 });
      }
    }
    const frac = G.maxLives ? G.lives / G.maxLives : 1, low = live ? cl((0.5 - frac) / 0.4, 0, 1) : 0;
    // Danger: how many are out, a flood beyond the old cap, how close the leader is, and lives.
    const dens = 1 - Math.exp(-n / 32), flood = cl((n - 60) / 120, 0, 1), prox = n ? cl((maxP - 0.45) / 0.5, 0, 1) * (0.6 + 0.4 * cl(near / 6, 0, 1)) : 0;
    let I = 0.55 * dens + 0.25 * flood + 0.4 * prox + (n ? 0.25 : 0.12) * low;
    if (boss) I = Math.max(I, 0.62) + 0.1;
    if (G.event) I += 0.08;
    // A boss's first appearance: its sting, and its theme waits for the sting to finish.
    const now = ctx.currentTime;
    if (boss && live && SEQ.seenBoss && !SEQ.seenBoss.has(boss)) { SEQ.seenBoss.add(boss); stingKey = boss.type; playAt('bossSting', boss.x, boss.z, 1.1); SEQ.stingTill = now + 1.9; }
    const horde = live && G.horde === true;
    if (horde && !SEQ.hordeWas && G.B && G.B.cave) playAt('horde', G.B.cave.x, G.B.cave.z, 1.1);
    SEQ.hordeWas = horde;
    if (horde) I = Math.max(I, 0.8);
    I = Math.max(I, cur.tension * 0.6);
    SEQ.tI = live ? cl(I, 0, 1) : 0;
    SEQ.low = low; SEQ.bossKey = live && boss && now >= SEQ.stingTill ? boss.type : null; SEQ.rage = !!(boss && boss.rage); SEQ.hordeT = horde ? 1 : 0;
    CR.tl = live || G.phase === 'defeat' ? cl(Math.sqrt(ground / 110), 0, 1) * (horde ? 1.25 : 1) : 0;
    const tot = wl + wr; CR.p = tot > 0 ? 0.7 * (wr - wl) / tot : 0;
    CR.big = ground ? big / ground : 0; CR.swarm = ground ? swarm / ground : 0;
  }
  // ---- The round 4 monsters, heard from G.mons alone: each kind (m.type, or m.def.rig) gets a first-sighting cue,
  // a loop or a run of small calls that grows with how many are near the camera, its moves (a ram's shove, a shaman's
  // ward, a harpy's dive, a hound pack arriving) and its death. Every call goes through play(), so the voice limits hold. ----
  const BEASTS = { ram: 0, shaman: 1 / 3, harpy: 2 / 3, hound: 1 };
  // Calls per kind: [sound, calls a second for each nearby one, most calls a second, gain].
  const BCALL = { ram: [['ramCreak', 0.4, 0.8, 0.8]], shaman: [['shamanChant', 0.35, 0.5, 0.9]], harpy: [['harpyWings', 0.45, 0.9, 0.8]],
    hound: [['houndSnarl', 0.3, 0.7, 0.8], ['houndPant', 0.22, 0.4, 0.7], ['houndFire', 0.5, 1.0, 0.7]] };
  const BDONE = {}, BT = { list: [], map: typeof WeakMap === 'function' ? new WeakMap() : null, first: {}, queue: [], qAt: 0, at: 0, packs: [], howlAt: -99, howl: null, acc: {}, sum: {}, beds: {}, rams: 0 };
  function beastKey(m) {
    const t = m.type; if (typeof t === 'string' && hasOwn(BEASTS, t)) return t;
    const r = m.def && m.def.rig; return typeof r === 'string' && hasOwn(BEASTS, r) ? r : null;
  }
  // From scan() (8 times a second): note that it is still on the field, and track it from its first scan, even in the
  // cave, so that one killed the moment it comes out is still heard. beastTick() watches the tracked ones every frame.
  function beastMark(m, k) {
    if (!BT.map) return;
    const now = ctx.currentTime, e = BT.map.get(m);
    if (e) { if (e !== BDONE) e.at = now; return; }
    if (!(m.hp > 0)) return;
    const n = { m: m, k: k, at: now, v: false, sw: +m.swoop || 0, ca: +m.cast || 0, sh: +m.shove || 0 };
    BT.map.set(m, n); BT.list.push(n);
  }
  function beastSeen(k, now) { // it has just come into view: a first-sighting cue, and hounds count towards a pack
    if (G.phase !== 'play') return;
    if (!BT.first[k]) { BT.first[k] = 1; BT.queue.push(k); }
    if (k === 'hound') { BT.packs.push(now); if (BT.packs.length > 8) BT.packs.shift(); }
  }
  function nearW(x, z) { const d = Math.hypot(x - CAM.x, z - CAM.z); return cl(1.15 - d / 34, 0, 1) * (0.72 + 0.28 * CAM.zoom); }
  // Every frame (not just on the scan), so a death, a shove, a ward or a dive is heard on the frame it happens.
  function beastTick(now) {
    if (typeof G === 'undefined' || !G) return;
    const live = G.phase === 'play', dt = cl(now - BT.at, 0, 0.5), half = (R.viewW || 40) * 0.5, cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw);
    BT.at = now;
    for (const k in BEASTS) { const s = BT.sum[k] || (BT.sum[k] = { w: 0, p: 0, n: 0, pick: [] }); s.w = s.p = s.n = 0; s.pick.length = 0; }
    let rams = 0;
    for (let i = BT.list.length - 1; i >= 0; i--) {
      const e = BT.list[i], m = e.m, k = e.k;
      if (m.hp <= 0) { if (e.v && (live || G.phase === 'clear' || G.phase === 'defeat')) playAt(k + 'Die', m.x, m.z, 1); }
      else if (!m.dead && now - e.at < 2.5) {
        if (!e.v) { if (!m.vis && !m.fly) continue; e.v = true; beastSeen(k, now); }
        if (live) {
          const sw = +m.swoop || 0, ca = +m.cast || 0, sh = +m.shove || 0;
          if (k === 'harpy' && sw > 0 && e.sw <= 0) { playAt('harpyScreech', m.x, m.z, 1); playAt('harpyWings', m.x, m.z, 0.9); }
          if (k === 'shaman' && ca > e.ca + 0.15) playAt('shamanWard', m.x, m.z, 1);
          if (k === 'ram' && sh > e.sh + 0.2) playAt('ramHit', m.x, m.z, 1); // ramShove() sets m.shove = 1 on each footman it knocks aside
          e.sw = sw; e.ca = ca; e.sh = sh;
        }
        if (k === 'ram') rams++;
        const w = nearW(m.x, m.z), s = BT.sum[k];
        s.n++; if (w > 0) { s.w += w; s.p += w * cl(((m.x - CAM.x) * cy - (m.z - CAM.z) * sy) / half, -1, 1); if (s.pick.length < 12) s.pick.push(m); }
        continue;
      }
      BT.map.set(m, BDONE); BT.list[i] = BT.list[BT.list.length - 1]; BT.list.pop(); // dead, leaked or gone from the field: never tracked again
    }
    BT.rams = rams;
    if (!live) { BT.queue.length = 0; BT.howl = null; return; }
    // First sightings, one at a time.
    if (BT.queue.length && now >= BT.qAt) { const k = BT.queue.shift(); play('newFoe', 0, 1, BEASTS[k]); BT.qAt = now + 1.7; }
    // A pack of hounds comes into view (two or more within two seconds): they howl, after any first-sighting cue.
    const P = BT.packs; while (P.length && now - P[0] > 2) P.shift();
    if (P.length >= 2 && now - BT.howlAt > 12 && BT.sum.hound.pick.length) { BT.howlAt = now; BT.howl = [Math.max(now + 0.2, BT.qAt - 0.2), BT.sum.hound.pick[0]]; P.length = 0; }
    if (BT.howl && now >= BT.howl[0]) { const m = BT.howl[1]; playAt('houndHowl', m.x, m.z, 1); BT.howl = null; }
    // Small calls from the ones near the camera, more of them the more there are.
    for (const k in BCALL) {
      const s = BT.sum[k], C = BCALL[k]; if (!s.pick.length) continue;
      for (let j = 0; j < C.length; j++) {
        const c = C[j], key = k + j, rate = Math.min(c[2], c[1] * s.w);
        BT.acc[key] = (BT.acc[key] || 0) + dt * rate;
        if (BT.acc[key] >= 1) { BT.acc[key] -= rr(0.6, 1.4); const m = s.pick[(rnd() * s.pick.length) | 0]; playAt(c[0], m.x, m.z, c[3]); }
      }
    }
  }
  // Loops under the calls: the ram's rumble and rolling wheels, and the hounds' smouldering fire. Built only while needed.
  const BBED = {
    ram: { max: 0.34, k: 1.3, make: (o) => {
      const am = gn(o, 0.6), sq = gn(o, 0);
      return [loopSrc(bufBrown, flt(gn(o, 1.3), 'lowpass', 110, 0.7), 0.9), // the rumble
        loopSrc(bufBrown, flt(flt(am, 'bandpass', 240, 1.4), 'highpass', 120), 1.0), // the rolling body, for small speakers
        loopOsc('sine', 1.35, gn(am.gain, 0.45)), // wheels turning
        loopSrc(bufPink, flt(sq, 'bandpass', 1250, 16), 1.0), loopOsc('sine', 0.21, gn(sq.gain, 0.04))]; // an axle squeal coming and going
    } },
    hound: { max: 0.2, k: 2, make: (o) => {
      const fg = gn(o, 0.5);
      return [loopSrc(bufBrown, flt(flt(fg, 'bandpass', 420, 0.9), 'highpass', 150), 1.0), loopOsc('sine', 6.1, gn(fg.gain, 0.2)), loopOsc('sine', 2.7, gn(fg.gain, 0.15)),
        loopSrc(bufWhite, flt(flt(gn(o, 0.025), 'highpass', 2500), 'lowpass', 6000), 1.0)];
    } },
  };
  function beastBeds(now, adt) {
    if (!nBeast) return;
    for (const k in BBED) {
      const D = BBED[k], b = BT.beds[k] || (BT.beds[k] = { src: null, g: null, pan: null, lvl: 0, idle: 0, aL: -1, aP: -2 }), s = BT.sum[k];
      const tl = s && G && G.phase === 'play' ? D.max * (1 - Math.exp(-s.w / D.k)) : 0, tp = s && s.w > 0 ? 0.8 * s.p / s.w : 0;
      b.lvl += (tl - b.lvl) * (1 - Math.exp(-adt / 0.7));
      if (tl > 0.005 && !b.src) {
        b.pan = panNode(tp, nBeast); b.g = gn(b.pan, 0);
        try { b.src = D.make(b.g); } catch (e) { b.src = []; if (!ST.err) ST.err = 'bed ' + k + ': ' + e.message; }
        b.aL = b.aP = -2; b.idle = 0;
      } else if (b.src && tl <= 0.005 && b.lvl < 0.003 && (b.idle += adt) > 2) {
        const src = b.src, g = b.g, p = b.pan; b.src = null;
        g.gain.setTargetAtTime(0, now, 0.02);
        for (let i = 0; i < src.length; i++) src[i].stop(now + 0.15);
        if (src.length) src[0].onended = () => { try { g.disconnect(); p.disconnect(); } catch (e) {} };
      }
      if (b.src) {
        if (tl > 0.005) b.idle = 0;
        if (Math.abs(b.lvl - b.aL) > 0.003) { b.aL = b.lvl; b.g.gain.setTargetAtTime(b.lvl, now, 0.2); }
        if (b.pan.pan && Math.abs(tp - b.aP) > 0.03) { b.aP = tp; b.pan.pan.setTargetAtTime(tp, now, 0.4); }
      }
    }
  }
  function stats() {
    const L = SEQ.lay;
    return Object.assign({}, ST, { voices: act.length, intensity: +SEQ.I.toFixed(3), crowdLvl: +CR.lvl.toFixed(3), bpm: Math.round(SEQ.bpm), boss: SEQ.bossKey, horde: +SEQ.horde.toFixed(2), low: +SEQ.low.toFixed(2), layers: Object.keys(L).filter((k) => L[k]).join(','), land: LS.key, music: LM.key || '', beasts: BT.list.length, beastBeds: Object.keys(BT.beds).filter((k) => BT.beds[k].src).join(','), event: LS.evKind, scene: SC.cur, title: TT.on ? 'sec' + TT.sec + ' bar' + TT.bar + (TT.loops ? ' loop' + TT.loops : '') : '', musicDesc: describe(LM.def), flashes: TH.n, flashHook: TH.hook, paused: PZ.on, hidden: hidden, state: ctx ? ctx.state : 'none' });
  }

  function softClip() {
    // Input is pre-scaled by 0.5, so the curve covers +-2: linear to 0.7, then bends to a 0.9 ceiling (about -0.9 dBFS).
    const n = 4097, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const u = (i / (n - 1) * 2 - 1) * 2, a = Math.abs(u); c[i] = Math.sign(u) * (a < 0.7 ? a : 0.7 + 0.2 * Math.tanh((a - 0.7) / 0.2)); }
    return c;
  }
  // Whenever the context starts running again (a tap after a refused resume, or iPhone handing the sound back after a
  // call or Siri with the page never hidden), the mix fades back in rather than starting at full level.
  function sync() {
    const was = api.ready; api.ready = !!ctx && ctx.state === 'running';
    if (api.ready && !was && nPage && !hidden) { const t = ctx.currentTime; nPage.gain.cancelScheduledValues(t); nPage.gain.setValueAtTime(0.0001, t); nPage.gain.setTargetAtTime(1, t, 0.25); }
  }
  function build() {
    sr = ctx.sampleRate;
    const clip = ctx.createWaveShaper(); clip.curve = softClip(); clip.oversample = 'none'; clip.connect(ctx.destination);
    const pre = gn(clip, 0.5);
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -9; lim.knee.value = 5; lim.ratio.value = 14; lim.attack.value = 0.002; lim.release.value = 0.2;
    lim.connect(pre);
    const sh = (dest, type, f, g, q) => { const b = flt(dest, type, f, q); b.gain.value = g; return b; };
    nMaster = gn(sh(sh(sh(flt(flt(lim, 'highpass', 32, 0.7), 'highpass', 32, 0.7), 'highshelf', 3000, 6), 'peaking', 1200, 3, 0.7), 'lowshelf', 180, -10), 0); nMaster.gain.setValueAtTime(0.0001, ctx.currentTime); nMaster.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.6);
    nPage = gn(nMaster, 1); // fades out before the page is hidden and the context suspended
    nMute = gn(nPage, api.muted ? 0 : 1);
    // Glue compressor on effects only, so a pile-up of hits thickens instead of spiking.
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -14; glue.knee.value = 10; glue.ratio.value = 2.5; glue.attack.value = 0.006; glue.release.value = 0.25;
    // Scene gains (sceneTick): the effects, crowd and ambience step back under the main menu; UI sounds never do.
    SC.fx = gn(nMute, 1); SC.amb = gn(nMute, 1);
    glue.connect(SC.fx);
    // Pause gains: one per bus, so pausing can quiet each part differently (see pauseMix).
    PZ.sfx = gn(glue, 1); PZ.amb = gn(SC.amb, 1); PZ.crowd = gn(SC.fx, 1);
    nSfx = gn(PZ.sfx, VOL.sfx); nUi = gn(nMute, VOL.sfx); nAmb = gn(PZ.amb, 0.9 * VOL.ambience);
    // Music: the duck (loud hits, stingers), the story duck, the music volume, then the land's music and the title theme.
    nMusDuck = gn(nMute, 1); SC.duck = gn(nMusDuck, 1); nMusic = gn(SC.duck, 0.5 * VOL.music);
    SC.game = gn(nMusic, 1); TT.bus = gn(nMusic, 0);
    PZ.pad = gn(SC.game, 1); PZ.seq = gn(SC.game, 1); nPad = gn(PZ.pad, 1); nSeq = gn(PZ.seq, 1.5);
    PZ.sting = gn(nMute, 1); nSting = gn(PZ.sting, STING_LVL * VOL.music);
    nCrowdDuck = gn(PZ.crowd, 1);
    nBeast = gn(nCrowdDuck, VOL.crowd); // the new monsters' loops: crowd volume, ducked and paused with the crowd
    nLand = gn(nAmb, 1); nEvt = gn(nAmb, 1);
    makeBuffers();
    const conv = ctx.createConvolver(); conv.buffer = makeImpulse();
    PZ.rev = gn(nMute, 0.5); conv.connect(PZ.rev);
    nRevIn = gn(null, 1); nRevIn.connect(flt(conv, 'highpass', 120));
    // Reverb sends per bus, so turning a bus down in the settings turns its echo down too.
    SC.fxRv = gn(nRevIn, 1);
    RV.sfx = gn(SC.fxRv, VOL.sfx); RV.ui = gn(nRevIn, VOL.sfx); RV.music = gn(nRevIn, VOL.music); RV.amb = gn(nRevIn, VOL.ambience); RV.crowd = gn(SC.fxRv, VOL.crowd);
    SC.gameRv = gn(RV.music, 1); TT.rv = gn(RV.music, 0); TT.bus.rv = TT.rv;
    nSfx.rv = RV.sfx; nUi.rv = RV.ui; nSting.rv = RV.music; nPad.rv = nSeq.rv = SC.gameRv; nLand.rv = RV.amb; // the land's thunder echoes with the ambience volume
    LM.bus = landBus();
    PZ.crowd.connect(gn(nRevIn, 0.15));
    startBeds();
    try { startCrowd(); } catch (e) { ST.err = 'crowd: ' + e.message; }
    mus.nextChord = ctx.currentTime + 1.5; mus.chord = 0; mus.pendC = mus.playC = LM.def.ch[0];
    SEQ.next = ctx.currentTime + 0.5; SEQ.lastNow = ctx.currentTime;
  }
  function unlock() {
    if (!ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      // iPhone: play like media so the ring/silent switch doesn't mute the game.
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      try { ctx = new AC(); build(); ctx.onstatechange = sync; }
      catch (e) { try { if (ctx && ctx.close) ctx.close(); } catch (e2) {} ctx = null; api.ready = false; return false; }
    }
    if (ctx.state !== 'running') {
      // Older iPhones only unlock once a sound starts inside the gesture: a one-sample silent buffer does it.
      try { const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, sr); b.connect(ctx.destination); b.onended = () => { try { b.disconnect(); } catch (e) {} }; b.start(0); } catch (e) {}
      if (ctx.resume) { const pr = ctx.resume(); if (pr && pr.then) pr.then(sync, () => {}); }
    }
    if (nPage && !hidden) nPage.gain.setTargetAtTime(1, ctx.currentTime, 0.1);
    sync();
    return api.ready;
  }
  // Page hidden: fade out quickly, then suspend the context; on return resume it and fade back in.
  // (iPhone may also leave the context 'interrupted'; resuming covers that, or the next tap unlocks it.)
  let hidden = false, hideTimer = 0;
  function setPaused(b) {
    if (!ctx || !nPage) return;
    hidden = !!b;
    clearTimeout(hideTimer);
    if (hidden) {
      nPage.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      hideTimer = setTimeout(() => { if (hidden && ctx.state === 'running' && ctx.suspend) { const pr = ctx.suspend(); if (pr && pr.then) pr.then(sync, () => {}); } }, 200);
    } else {
      const up = () => { sync(); if (!hidden) nPage.gain.setTargetAtTime(1, ctx.currentTime, 0.25); };
      // Fade back in even if resuming fails (no gesture yet): the next tap's unlock() resumes the context.
      if (ctx.state !== 'running' && ctx.state !== 'closed' && ctx.resume) { const pr = ctx.resume(); if (pr && pr.then) pr.then(up, up); else up(); } else up();
    }
  }
  // Game paused (P): effects, crowd and the beat stop; the pads and the land murmur on quietly. UI sounds stay.
  function pauseMix(p, now) {
    if (p === PZ.on) return;
    PZ.on = p;
    const tc = p ? 0.12 : 0.35, L = [[PZ.sfx, 0], [PZ.crowd, 0], [PZ.seq, 0], [PZ.pad, 0.5], [PZ.amb, 0.45], [PZ.rev, 0.25], [PZ.sting, 0.6]];
    for (let i = 0; i < L.length; i++) L[i][0].gain.setTargetAtTime(p ? L[i][1] : i === 5 ? 0.5 : 1, now, tc);
  }
  // Bus levels 0..1 for a future settings menu: 'sfx', 'music', 'ambience' (wind, fire), 'crowd'.
  const VOL = { sfx: 1, music: 1, ambience: 1, crowd: 1 };
  const STING_LVL = 0.9, RV = { sfx: null, ui: null, music: null, amb: null, crowd: null };
  function setVolume(bus, v) {
    if (!hasOwn(VOL, bus)) return;
    VOL[bus] = cl(+v || 0, 0, 1);
    if (!ctx || !nSfx) return;
    const now = ctx.currentTime, n = { sfx: nSfx, music: nMusic, ambience: nAmb, crowd: nCrowd }[bus], base = { sfx: 1, music: 0.5, ambience: 0.9, crowd: 1 }[bus];
    if (n && bus !== 'crowd') n.gain.setTargetAtTime(base * VOL[bus], now, 0.05);
    if (bus === 'sfx') { nUi.gain.setTargetAtTime(VOL.sfx, now, 0.05); RV.ui.gain.setTargetAtTime(VOL.sfx, now, 0.05); }
    if (bus === 'music') nSting.gain.setTargetAtTime(STING_LVL * VOL.music, now, 0.05);
    const rv = { sfx: RV.sfx, music: RV.music, ambience: RV.amb, crowd: RV.crowd }[bus]; if (rv) rv.gain.setTargetAtTime(VOL[bus], now, 0.05);
    if (bus === 'crowd') { appM.crowd = -1; if (nBeast) nBeast.gain.setTargetAtTime(VOL.crowd, now, 0.05); }
  }
  function setMuted(b) {
    api.muted = !!b;
    if (ctx && nMute) nMute.gain.setTargetAtTime(api.muted ? 0 : 1, ctx.currentTime, 0.06);
  }
  function setP(key, param, v, now) { if (Math.abs(v - app[key]) > 0.004) { app[key] = v; param.setTargetAtTime(v, now, 0.12); } }
  const appM = { pad: -1, drone: -1, crowd: -1, P: -2, mur: -1, rust: -1, dm: -1, dc: -1 };
  function setM(key, param, v, now, tc) { if (Math.abs(v - appM[key]) > 0.005) { appM[key] = v; param.setTargetAtTime(v, now, tc); } }
  function reactive(now) {
    const adt = cl(now - SEQ.lastNow, 0, 0.25); SEQ.lastNow = now;
    if (now >= SEQ.scanAt) { SEQ.scanAt = now + 0.125; scan(); }
    beastTick(now);
    beastBeds(now, adt);
    // Danger rises in a couple of seconds and settles slowly, so the music never flickers.
    SEQ.I += (SEQ.tI - SEQ.I) * (1 - Math.exp(-adt / (SEQ.tI > SEQ.I ? 1.6 : 5.5)));
    SEQ.horde += (SEQ.hordeT - SEQ.horde) * (1 - Math.exp(-adt / (SEQ.hordeT ? 1.0 : 3.0)));
    api.intensity = SEQ.I;
    if (SEQ.horde > 0.05) choirOn(); else if (SEQ.choir) choirOff(now);
    if (SEQ.choir) SEQ.choir.g.gain.setTargetAtTime(0.05 * SEQ.horde * (0.6 + 0.4 * SEQ.I), now, 0.3);
    if (!api.muted && !SC.idle) seqTick(now); else SEQ.next = 0;
    const dr = Math.max(cur.tension, SEQ.I * 0.75);
    if (Math.abs(dr - appM.drone) > 0.01) { appM.drone = dr; bed.droneG.gain.setTargetAtTime(dr * 0.1, now, 0.4); bed.droneLP.frequency.setTargetAtTime(280 + 220 * dr, now, 0.4); }
    setM('pad', nPad.gain, PAD_LVL * (1 - 0.3 * SEQ.I), now, 0.6);
    duckE *= Math.exp(-adt / 0.35);
    for (let i = lateDuck.length - 1; i >= 0; i--) if (now >= lateDuck[i][0]) { duckE = Math.max(duckE, lateDuck[i][1]); lateDuck.splice(i, 1); }
    let hold = 0; for (let i = holds.length - 1; i >= 0; i--) { if (now >= holds[i][0]) { holds[i] = holds[holds.length - 1]; holds.pop(); } else if (holds[i][1] > hold) hold = holds[i][1]; }
    const dk = SC.cur === 'menu' ? 0.3 : 1; // the demo's explosions only nudge the title theme
    setM('dm', nMusDuck.gain, Math.min(1 - 0.45 * duckE * dk, 1 - hold * dk), now, hold ? 0.25 : 0.04);
    setM('dc', nCrowdDuck.gain, 1 - 0.35 * duckE, now, 0.04);
    if (nCrowd) {
      CR.lvl += (CR.tl - CR.lvl) * (1 - Math.exp(-adt / 0.8));
      if (CR.tl > 0.01) { CR.idle = 0; crowdSrc(true, now); } else if (CR.src && CR.lvl < 0.004 && (CR.idle += adt) > 2) crowdSrc(false, now);
      setM('crowd', nCrowd.gain, 0.3 * CR.lvl * VOL.crowd, now, 0.25);
      if (CR.pan.pan) setM('P', CR.pan.pan, CR.p, now, 0.5);
      if (CR.src) { setM('mur', CR.src.mur.gain, 0.25 + 0.75 * CR.big, now, 0.5); setM('rust', CR.src.rust.gain, 0.1 + 0.6 * CR.swarm, now, 0.5); }
      if (CR.lvl > 0.05 && !api.muted) {
        CR.acc += adt * Math.min(LOW ? 3.5 : 6, 0.06 * CR.lvl * 110 * (LOW ? 0.6 : 1));
        if (CR.acc >= 1) { CR.acc -= rr(0.6, 1.4); crowdEvent(now); }
      }
    }
  }
  let lastUpd = -1;
  function update() {
    if (!ctx) return;
    sync();
    if (!api.ready) return;
    // Time comes from the audio clock, so fast-forward (several steps a frame) does not speed up the beds.
    const now = ctx.currentTime, dt = lastUpd < 0 ? 0.016 : cl(now - lastUpd, 0, 0.1);
    if (lastUpd >= 0 && dt <= 0) return;
    lastUpd = now;
    const paused = typeof G !== 'undefined' && !!G && G.paused === true;
    pauseMix(paused, now);
    const k = 1 - Math.exp(-dt * 2.5);
    cur.fire += (tgt.fire - cur.fire) * k; cur.wind += (tgt.wind - cur.wind) * k; cur.tension += (tgt.tension - cur.tension) * k;
    setP('fire', bed.fireG.gain, cur.fire, now);
    setP('wind', bed.windG.gain, cur.wind * WIND_LVL, now);
    bed.timer -= dt;
    if (bed.timer <= 0) {
      bed.timer = rr(2, 5);
      const wk = LS.wind || WINDK.ashen, tc = rr(1.2, 3), f = rr(200, 520) * (0.7 + 0.6 * cur.wind) * wk[0];
      for (let i = 0; i < bed.windLP.length; i++) bed.windLP[i].frequency.setTargetAtTime(f * rr(0.85, 1.15), now, tc);
      bed.gustG.gain.setTargetAtTime(rr(0.45, 1.0), now, tc);
      const w = rnd(); bed.whG.gain.setTargetAtTime(w * w * 0.3 * wk[1], now, tc); bed.whF.frequency.setTargetAtTime(rr(600, 1100) * wk[0], now, tc);
    }
    if (cur.fire > 0.02 && !paused) {
      bed.popAcc += dt * (1.5 + 13 * cur.fire);
      let n = 0;
      while (bed.popAcc >= 1 && n++ < 4) { bed.popAcc -= rr(0.5, 1.5); pop(); }
      if (bed.popAcc > 4) bed.popAcc = 0;
    }
    try { sceneTick(now); titleTick(now); storyQueue(now); } catch (e) { if (!ST.err) ST.err = 'scene: ' + String(e && e.message || e).slice(0, 200); }
    SC.idle = SC.cur === 'menu' && now > SC.offAt; // under the menu, once faded, the land's music stops being written
    if (!SC.idle) musicTick(now);
    // The reactive parts never take the game down: any fault is recorded in stats().err.
    for (let i = LM.old.length - 1; i >= 0; i--) if (now >= LM.old[i][1]) { try { LM.old[i][0].disconnect(); } catch (e) {} LM.old.splice(i, 1); }
    try { scapes(now, paused); watch(now); if (!paused) reactive(now); else { SEQ.lastNow = now; SEQ.next = 0; } } catch (e) { if (!ST.err) ST.err = String(e && e.stack || e).slice(0, 300); }
  }

  if (typeof window !== 'undefined') window.__cwAudio = api;
  return api;
})();
