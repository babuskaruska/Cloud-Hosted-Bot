// Cinderwatch sound: every sound is synthesized here with Web Audio (no audio files).
// Layout: helpers and the one-shot sound library S, the voice manager play() (per-kind voice
// limits, stealing, density-aware gain, jittered timing), the ambient beds (wind, fire, drone),
// the crowd bed (a horde on the road), the land soundscapes and land-event swells, the reactive
// music (pads + a step sequencer whose layers follow the danger, with a sting and a theme per boss),
// pause and page-hide handling, and the master chain (glue, limiter, soft clipper).
const AU = (function () {
  const api = { ready: false, muted: false, intensity: 0, unlock: unlock, setMuted: setMuted, setPaused: setPaused, play: play, setAmbience: setAmbience, update: update, setVolume: setVolume, stats: stats, has: (n) => typeof n === 'string' && hasOwn(DEF, n) };

  let ctx = null, sr = 44100;
  let nMaster = null, nMute = null, nSfx = null, nAmb = null, nMusic = null, nRevIn = null;
  let nPad = null, nSeq = null, nMusDuck = null, nCrowd = null, nCrowdDuck = null, nPage = null, nUi = null, nLand = null, nEvt = null;
  const PZ = { on: false, sfx: null, amb: null, crowd: null, pad: null, seq: null, rev: null };
  let bufWhite = null, bufPink = null, bufBrown = null;
  let V = null;
  const shapeCurves = {};
  const tgt = { fire: 0, wind: 0, tension: 0 }, cur = { fire: 0, wind: 0, tension: 0 }, app = { fire: -1, wind: -1, tension: -1 };
  const bed = { windG: null, gustG: null, windLP: [], whG: null, whF: null, fireG: null, popBus: null, droneG: null, droneLP: null, timer: 0, popAcc: 0 };
  const mus = { nextChord: 0, chord: 0, lastNote: -1, playing: 0, pend: 0, pendAt: 0 };
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
    if (send > 0) { wet = gn(nRevIn, send); tail.connect(wet); }
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
    const c = gn(d), cf = flt(c, 'bandpass', 900, 0.8); noi(t + 0.015, 0.2, cf); ad(c.gain, t + 0.015, 0.1, 0.004, 0.13);
    grains(d, t + 0.05, 4, 0.25, 0.07, 0.01, 0.03, 700, 2000, 4, 1);
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
    grains(d, t + 0.04, 6, 0.36, 0.22, 0.02, 0.06, 1700, 3600, 10, 1);
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
  S.uiDeny = (d, t) => {
    const lp = flt(d, 'lowpass', 700);
    for (let i = 0; i < 2; i++) {
      const ti = t + i * 0.11, g = gn(lp); osc('triangle', i ? 128 : 158, ti, 0.1, g); osc('square', i ? 64 : 79, ti, 0.1, gn(g, 0.3));
      g.gain.setValueAtTime(0.0001, ti); g.gain.linearRampToValueAtTime(0.3, ti + 0.008); g.gain.setValueAtTime(0.3, ti + 0.06); g.gain.linearRampToValueAtTime(0.0001, ti + 0.085);
    }
  };
  S.crumble = (d, t) => {
    const D = 3.0;
    const r = gn(d), rf = flt(r, 'lowpass', 130, 0.6); noi(t, D + 0.4, rf, bufBrown); sw(rf.frequency, t, 170, 60, D);
    r.gain.setValueAtTime(0.0001, t); r.gain.linearRampToValueAtTime(1.0, t + 0.35); r.gain.linearRampToValueAtTime(0.7, t + D * 0.6); r.gain.exponentialRampToValueAtTime(0.0001, t + D + 0.3);
    const s = gn(d), o = osc('sine', 44, t, D, s); sw(o.frequency, t, 48, 30, D); ad(s.gain, t, 0.5, 0.4, D - 0.4);
    grains(d, t + 0.1, 26, D - 0.3, 0.5, 0.05, 0.2, 180, 700, 3, 0);
    grains(d, t + 0.2, 16, D - 0.5, 0.2, 0.01, 0.04, 800, 2600, 5, 0);
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
    const lp = flt(d, 'lowpass', 7000), R = [1, 1.51, 2.27, 2.94, 3.76];
    for (let i = 0; i < 5; i++) { const cg = gn(lp); osc(i % 2 ? 'sine' : 'triangle', 620 * R[i] * rr(0.995, 1.005), t + 0.01, 1.4, cg); ad(cg.gain, t + 0.01, 0.14 / (1 + i * 0.4), 0.001, 1.1 / (1 + i * 0.5)); }
    const t2 = t + 0.2, ch = [50, 57, 62, 66];
    for (let i = 0; i < ch.length; i++) brassNote(d, t2, mtof(ch[i]), 1.0, 0.11, 1.15);
    brassNote(d, t2 + 0.5, mtof(69), 0.9, 0.11, 1.3);
    whoomp(d, t, 0.4, 0.6);
    grains(lp, t + 0.25, 14, 1.2, 0.09, 0.003, 0.015, 2600, 7000, 3, 1);
    belld(lp, t + 0.75, mtof(86), 0.05, 1.6);
  };
  const METEOR_FALL = 0.9; // seconds of whistle before the impact
  S.meteor = (d, t) => {
    const ti = t + METEOR_FALL;
    // the fall: a whistle that rises while a roar of torn air builds
    const wg = gn(d), wo = osc('sine', 520, t, METEOR_FALL + 0.05, wg); wo.frequency.setValueAtTime(520, t); wo.frequency.exponentialRampToValueAtTime(1900, ti);
    osc('sine', 7, t, METEOR_FALL, gn(wo.detune, 25));
    wg.gain.setValueAtTime(0.0001, t); wg.gain.exponentialRampToValueAtTime(0.12, ti - 0.05); wg.gain.linearRampToValueAtTime(0.0001, ti + 0.02);
    const rg = gn(d), rf = flt(rg, 'bandpass', 600, 1.2); noi(t, METEOR_FALL + 0.05, rf, bufPink); sw(rf.frequency, t, 300, 2600, METEOR_FALL);
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

  // Boss entrance stings: short and different for each boss, played the first time one is seen.
  function stingHit(d, t, vel) { // a drum and a dull thud under each stab
    drumHit(d, t, vel, 50);
    const m = gn(d), mf = flt(m, 'bandpass', 300, 1); noi(t, 0.25, mf); ad(m.gain, t, vel * 0.45, 0.002, 0.18);
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
  };
  let stingKey = 'giant';
  S.bossSting = (d, t) => { (STING[stingKey] || STING.giant)(d, t); };

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
  });
  // Kinds that share a voice budget, and how hard a sound ducks the music and crowd.
  const FAM = { cannon: 'boom', explode: 'boom', chainBoom: 'boom', burn: 'fire', ignite: 'fire', ratSqueal: 'die', boneRattle: 'die', squelch: 'die', batScreech: 'die' };
  const FAMCAP = LOW ? { boom: 4, fire: 3, die: 5 } : { boom: 5, fire: 4, die: 7 };
  const DUCK = { cannon: 0.3, explode: 0.4, chainBoom: 0.3, zap: 0.2, roar: 0.5, bossStep: 0.35, bossDie: 0.8, horn: 0.35, hornBoss: 0.5, horde: 0.6, crumble: 0.7, beaconOut: 0.8, rise: 0.5,
    branch: 0.4, frostNova: 0.3, rally: 0.3, rockslide: 0.4, blizzard: 0.3, bogfog: 0.3, lavaSurge: 0.4, sandstorm: 0.3, bossSting: 0.6 };
  // Ducks that land later than the call (the meteor hits after its whistle).
  const DUCK_LATE = { meteor: [METEOR_FALL, 0.8] };
  // Exact gaps, no jitter: these are one per event, and the gap is what stops a double start.
  const NOJIT = { rockslide: 1, blizzard: 1, bogfog: 1, lavaSurge: 1, sandstorm: 1, eventEnd: 1, bossSting: 1, spellReady: 1 };
  // UI sounds go to their own bus so they still play while the game is paused.
  const UIS = { uiHover: 1, uiClick: 1, uiDeny: 1 };
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
    const df = DEF[name];
    ST.req++;
    let g = gain === undefined ? 1 : +gain;
    if (g !== g) g = 1; // no usable position: play it centred
    if (!(g > 0.003)) return;
    pan = cl(+pan || 0, -1, 1);
    const now = ctx.currentTime;
    if (now - (lastAt[name] === undefined ? -9 : lastAt[name]) < (gapOf[name] || df[1])) { ST.gap++; return; }
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
    const v = voice(pan, cl(g, 0, 1.5) * df[5], df[2], UIS[name] ? nUi : nSfx);
    V = v;
    try { df[0](v.out, t, cl(+p || 0, 0, 1)); } catch (e) { if (!ST.err) ST.err = name + ': ' + e.message; }
    finishVoice(v);
    act.push({ end: t + df[4], v: v, name: name, fam: fam, pri: pri, t0: now });
    ST.played++; ST.names[name] = (ST.names[name] || 0) + 1; if (act.length > ST.peak) ST.peak = act.length;
    if (DUCK[name]) duckE = Math.max(duckE, DUCK[name] * cl(g, 0, 1));
    if (DUCK_LATE[name] && lateDuck.length < 8) lateDuck.push([t + DUCK_LATE[name][0], DUCK_LATE[name][1] * cl(g, 0, 1)]);
    const sup = SUPER[name];
    if (sup) for (let i = 0; i < act.length - 1; i++) if (act[i].end > now && sup.indexOf(act[i].name) >= 0) steal(act[i], now);
  }
  function startBeds() {
    bed.windG = gn(nAmb, 0); bed.windG.connect(gn(nRevIn, 0.12));
    bed.gustG = gn(bed.windG, 0.7);
    for (let i = 0; i < 2; i++) { const lf = flt(flt(panNode(i ? 0.55 : -0.55, bed.gustG), 'highpass', 110, 0.5), 'lowpass', 420, 0.4); loopSrc(bufPink, gn(lf, 2.6), 0.8 + i * 0.13); bed.windLP.push(lf); }
    bed.whG = gn(bed.gustG, 0); bed.whF = flt(bed.whG, 'bandpass', 800, 7); loopSrc(bufPink, gn(bed.whF, 3), 1.0);
    bed.fireG = gn(nAmb, 0);
    const hiss = flt(flt(gn(bed.fireG, 0.1), 'lowpass', 4500), 'highpass', 900); loopSrc(bufWhite, hiss, 1.0);
    const roarG = gn(bed.fireG, 0.32), roarF = flt(flt(roarG, 'highpass', 75, 0.5), 'lowpass', 280, 0.5); loopSrc(bufBrown, roarF, 1.0);
    loopOsc('sine', 6.7, gn(roarG.gain, 0.1)); loopOsc('sine', 2.3, gn(roarG.gain, 0.07));
    bed.popBus = gn(bed.fireG, 2.0); bed.popBus.connect(gn(nRevIn, 0.1));
    bed.droneG = gn(PZ.pad, 0); bed.droneG.connect(gn(nRevIn, 0.3));
    bed.droneLP = flt(bed.droneG, 'lowpass', 300, 0.6);
    const dv = gn(null, 4); loopOsc('sine', 4.9, dv);
    [[73.42, -5, 0.5], [73.42, 6, 0.5], [36.71, 0, 0.3], [110.0, 3, 0.12]].forEach((a) => { const o = loopOsc('sawtooth', a[0], gn(bed.droneLP, a[2])); o.detune.value = a[1]; dv.connect(o.detune); });
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

  const CH = [
    { n: [38, 45, 50, 53, 57], m: [62, 65, 69, 72, 74, 76], to: [1, 2, 4, 3] },
    { n: [34, 41, 50, 53, 58], m: [62, 65, 70, 74, 69], to: [2, 0, 4] },
    { n: [31, 43, 46, 50, 55], m: [62, 67, 70, 74, 69], to: [0, 3, 1] },
    { n: [33, 40, 45, 48, 52], m: [64, 69, 72, 76, 67], to: [0, 1] },
    { n: [29, 41, 45, 48, 53], m: [60, 65, 69, 72, 77, 67], to: [2, 0, 1] },
  ];
  function padChord(t, c, dur) {
    const v = voice(0, 1, 0.5, nPad); V = v;
    const env = gn(v.out), hp = flt(env, 'highpass', 50), sides = [], open = rr(560, 700);
    for (let s = 0; s < 2; s++) {
      const l = flt(panNode(s ? 0.4 : -0.4, hp), 'lowpass', 380, 0.5);
      l.frequency.setValueAtTime(380, t); l.frequency.linearRampToValueAtTime(open, t + dur * 0.5); l.frequency.linearRampToValueAtTime(400, t + dur + 4);
      sides.push(l);
    }
    const vib = gn(null, rr(2.5, 4)); osc('sine', rr(4.4, 5.2), t, dur + 5.5, vib);
    for (let i = 0; i < c.n.length; i++) {
      const f = mtof(c.n[i]);
      for (let s = 0; s < 2; s++) { const o = osc('sawtooth', f, t, dur + 5.5, gn(sides[s], i === 0 ? 0.05 : 0.036)); o.detune.value = (s ? 1 : -1) * rr(4, 8); vib.connect(o.detune); }
    }
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(1, t + 3.5); env.gain.setTargetAtTime(0.0001, t + dur, 1.3);
    finishVoice(v);
  }
  function pianoNote(t, m, vel) {
    const f = mtof(m), v = voice(rr(-0.3, 0.3), 1, 0.8, nPad); V = v;
    const lp = flt(v.out, 'lowpass', 2200, 0.4);
    lp.frequency.setValueAtTime(Math.min(3200, f * 5), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.3), t + 2.2);
    const dec = 3.6 * Math.pow(440 / f, 0.35), H = [[1, 1, 1], [2.002, 0.3, 0.55], [3.006, 0.1, 0.35], [4.012, 0.04, 0.22]];
    for (let i = 0; i < H.length; i++) { const h = H[i], g = gn(lp); osc('sine', f * h[0], t, dec * h[2] + 0.1, g); ad(g.gain, t, vel * 0.11 * h[1], 0.007, dec * h[2]); }
    const tg = gn(lp); osc('triangle', f, t, dec * 0.5, tg); ad(tg.gain, t, vel * 0.03, 0.006, dec * 0.4);
    const n = gn(v.out), nf = flt(n, 'lowpass', 900); noi(t, 0.05, nf); ad(n.gain, t, vel * 0.03, 0.002, 0.03);
    finishVoice(v);
  }
  function timp(t, vel) {
    const v = voice(rr(-0.15, 0.15), 1, 0.6, nSeq); V = v;
    const g = gn(v.out), o = osc('sine', 73.4, t, 1.3, g); sw(o.frequency, t, 80, 72.5, 0.08); ad(g.gain, t, vel, 0.006, 1.1);
    const g2 = gn(v.out); osc('sine', 110.4, t, 0.7, g2); ad(g2.gain, t, vel * 0.35, 0.005, 0.5);
    const g3 = gn(v.out); osc('sine', 147.5, t, 0.4, g3); ad(g3.gain, t, vel * 0.15, 0.004, 0.3);
    const n = gn(v.out), nf = flt(n, 'lowpass', 200); noi(t, 0.1, nf); ad(n.gain, t, vel * 0.6, 0.003, 0.06);
    finishVoice(v);
  }
  function pickNote(c) {
    let m = c.m[(rnd() * c.m.length) | 0];
    if (m === mus.lastNote) m = c.m[(c.m.indexOf(m) + 1) % c.m.length];
    mus.lastNote = m; return m;
  }

  // ---- Calm layer: slow pad chords with a few piano notes. ----
  function musicTick(now) {
    if (now > mus.nextChord - 0.3) {
      const t = Math.max(mus.nextChord, now + 0.05), c = CH[mus.chord], dur = rr(11, 15);
      padChord(t, c, dur);
      mus.pend = mus.chord; mus.pendAt = t;
      if (rnd() < 0.75 * (1 - 0.6 * SEQ.I)) {
        const t1 = t + rr(3, 6.5); pianoNote(t1, pickNote(c), rr(0.6, 1));
        if (rnd() < 0.35) pianoNote(t1 + rr(2.4, 4.2), pickNote(c), rr(0.45, 0.8));
      }
      mus.nextChord = t + dur - 1.0;
      mus.chord = c.to[(rnd() * c.to.length) | 0];
    }
  }
  // Bass root of the chord sounding at time t, folded into C2..B2.
  function rootAt(t) {
    if (t >= mus.pendAt) mus.playing = mus.pend;
    let r = CH[mus.playing].n[0]; while (r < 36) r += 12; return r;
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
  // Motifs in D minor: [step, midi, length in steps]; each spans two bars.
  const MOTIF = [
    [[0, 50, 6], [6, 53, 2], [8, 52, 4], [12, 50, 4], [16, 48, 8], [24, 50, 8]],
    [[0, 45, 4], [4, 50, 4], [8, 53, 6], [14, 52, 2], [16, 50, 8], [24, 45, 8]],
    [[0, 50, 3], [3, 50, 3], [6, 48, 2], [8, 45, 8], [16, 46, 6], [22, 45, 10]],
  ];
  // One theme per boss: percussion colour, lead voice, motif and tempo offset.
  const BOSS = {
    giant: { perc: 'bone', lead: 'brass', bpm: 0, m: [[0, 38, 4], [4, 41, 4], [8, 40, 4], [12, 38, 4], [16, 37, 8], [24, 38, 8]] },
    ogre: { perc: 'heavy', lead: 'brass', bpm: -10, m: [[0, 38, 8], [8, 44, 8], [16, 38, 6], [22, 44, 2], [24, 43, 8]] },
    jotun: { perc: 'ice', lead: 'bell', bpm: -6, m: [[0, 74, 6], [6, 77, 2], [8, 76, 8], [16, 72, 4], [20, 69, 12]] },
    queen: { perc: 'skitter', lead: 'trem', bpm: 4, m: [[0, 62, 8], [8, 63, 8], [16, 62, 8], [24, 61, 8]] },
    colossus: { perc: 'anvil', lead: 'dist', bpm: 0, m: [[0, 26, 8], [8, 26, 4], [12, 29, 4], [16, 32, 8], [24, 31, 8]] },
    king: { perc: 'ritual', lead: 'reed', bpm: -4, m: [[0, 62, 4], [4, 63, 4], [8, 65, 6], [14, 63, 2], [16, 62, 6], [22, 60, 2], [24, 62, 8]] },
  };
  const SEQ = { next: 0, step: 0, bar: 0, phrase: 0, bpm: 80, I: 0, tI: 0, lay: {}, pat: 0, ost: 0, motif: -1, rest: false, boss: null, bossKey: null, rage: false, horde: 0, hordeT: 0, hordeWas: false, heard: typeof WeakSet === 'function' ? new WeakSet() : null, seenBoss: typeof WeakSet === 'function' ? new WeakSet() : null, stingTill: 0, low: 0, lastNow: 0, scanAt: 0, choir: null };

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
  function pluck(t, m, vel, dur) {
    const f = mtof(m), v = sv(0, 0.12), g = gn(v.out), lp = flt(g, 'lowpass', f * 6, 2);
    osc('sawtooth', f, t, dur + 0.1, lp); sw(lp.frequency, t, f * 7, f * 1.4, dur * 0.8); ad(g.gain, t, vel, 0.004, dur);
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

  // Horde choir: a sustained "ahh" built only while a horde is on.
  function choirOn() {
    if (SEQ.choir) return;
    const g = gn(nSeq, 0), f1 = flt(g, 'bandpass', 720, 5), f2 = flt(g, 'bandpass', 1150, 7), mix = gn(null, 1);
    mix.connect(f1); mix.connect(gn(f2, 0.6)); mix.connect(flt(gn(g, 0.4), 'lowpass', 300));
    const os = [], vib = gn(null, 6); os.push(loopOsc('sine', 5.1, vib));
    [[50, -6], [50, 7], [57, 3], [62, -3], [38, 0]].forEach((a) => { const o = loopOsc('sawtooth', mtof(a[0]), gn(mix, 0.2)); o.detune.value = a[1]; vib.connect(o.detune); os.push(o); });
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
      SEQ.motif = I > 0.45 && SEQ.phrase % 2 === 0 ? (rnd() * MOTIF.length) | 0 : -1;
    }
    SEQ.boss = SEQ.bossKey ? BOSS[SEQ.bossKey] || BOSS.giant : null;
    SEQ.bpm = 76 + 24 * I + (SEQ.boss ? SEQ.boss.bpm + (SEQ.rage ? 14 : 0) : 0) + (SEQ.horde > 0.5 ? 8 : 0);
  }
  function lead(B, t, mi, len, sd) {
    const dur = len * sd, ln = B.lead;
    if (ln === 'brass') brassV(t, mi, dur * 0.9, 0.15, false);
    else if (ln === 'dist') brassV(t, mi + 12, dur * 0.9, 0.09, true);
    else if (ln === 'bell') bell(t, mi, 0.12, rr(-0.5, 0.5));
    else if (ln === 'reed') reed(t, mi, dur * 0.92, 0.09);
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
  }
  function playStep(t) {
    const s = SEQ.step;
    if (s === 0) decideBar();
    const I = SEQ.I, L = SEQ.lay, sd = 60 / SEQ.bpm / 4, r = rootAt(t), hv = () => rr(0.88, 1.08);
    if (L.pulse) {
      if (SEQ.low > 0.45) { if (s === 0 || s === 8) { drum(t, (0.3 + 0.25 * SEQ.low) * hv(), 52); drum(t + 0.17, (0.2 + 0.15 * SEQ.low) * hv(), 47); } }
      else { const P = PULSE[SEQ.pat][s]; if (P) drum(t, P * (0.22 + 0.3 * I) * hv(), 55); }
    }
    if (L.tick && s % 2 === 1 && rnd() < 0.85) shaker(t, (s % 4 === 3 ? 0.07 : 0.045) * (0.5 + I) * hv());
    if (L.bass && !SEQ.rest) { const o = OST[SEQ.ost][s]; if (o !== null) pluck(t, r + o, (0.09 + 0.07 * I) * hv() * (s % 4 === 0 ? 1.15 : 1), sd * 1.6); }
    if (L.war) {
      const w = WAR[SEQ.pat][s]; if (w) taiko(t, w * (0.25 + 0.3 * I) * hv(), 60);
      if (SEQ.bar === 7 && s >= 12) taiko(t + sd * 0.5, 0.18 * hv(), 78 + (s - 12) * 6);
    }
    if (L.gong && SEQ.bar === 0 && s === 0 && SEQ.phrase % 2 === 1) gong(t, 0.09);
    if (SEQ.motif >= 0 && !SEQ.boss) {
      const b2 = SEQ.bar * 16 + s, M = MOTIF[SEQ.motif], oct = SEQ.bar >= 4 ? 12 : 0, off = SEQ.bar >= 4 ? 64 : 0;
      if (SEQ.bar < 2 || (SEQ.bar >= 4 && SEQ.bar < 6 && I > 0.75)) for (let i = 0; i < M.length; i++) if (M[i][0] === b2 - off) brassV(t, M[i][1] + oct, M[i][2] * sd * 0.92, 0.1 + 0.05 * I, false);
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
    nCrowd = gn(nCrowdDuck, 0); // its reverb send is taken after the pause gain, in build()
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
      for (let i = 0; i < c.nodes.length; i++) c.nodes[i].stop(now + 0.05);
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
    g.connect(gn(nRevIn, def.rev === undefined ? 0.3 : def.rev)); // send after the fade, so a fading scape fades its echo too
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
  };
  // The general wind bed's colour per land: [filter multiplier, whistle multiplier].
  const WINDK = { ashen: [1, 1], frost: [1.3, 1.7], fen: [0.75, 0.5], ember: [0.85, 0.7], dunes: [1.45, 0.8] };
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
  };

  // Which land and event are playing now.
  const PAD_LVL = 1.5; // calm pads, a little above the wind
  const LS = { key: null, land: null, ev: null, evKind: null };
  function scapes(now, paused) {
    if (typeof G === 'undefined' || !G) return;
    const key = G.B && G.B.bio && typeof G.B.bio.key === 'string' ? G.B.bio.key : null;
    if (key !== LS.key) { // crossfade the land beds over a few seconds
      LS.key = key; scapeOff(LS.land, 1.3); LS.land = key && LAND[key] ? scapeOn(LAND[key], nLand, 1.5) : null;
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
  }

  // ---- Reading the battlefield (about 8 times a second). ----
  // Same pan and distance law as sfx() in 90-main, for sounds the audio plays on its own.
  function playAt(name, x, z, gain) {
    const dx = x - CAM.x, dz = z - CAM.z, u = dx * Math.cos(CAM.yaw) - dz * Math.sin(CAM.yaw);
    play(name, cl(u / ((R.viewW || 40) * 0.5), -1, 1) * 0.75, gain * cl(1.12 - Math.hypot(dx, dz) / 46, 0.4, 1) * (0.72 + 0.28 * CAM.zoom), 0);
  }
  function scan() {
    if (typeof G === 'undefined' || !G || !G.mons) return;
    const live = G.phase === 'play', cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw), half = (R.viewW || 40) * 0.5;
    let n = 0, ground = 0, near = 0, maxP = 0, wl = 0, wr = 0, big = 0, swarm = 0, boss = null;
    const P = CR.pick; P.length = 0;
    for (let i = 0; i < G.mons.length; i++) {
      const m = G.mons[i]; if (m.dead || (!m.vis && !m.fly)) continue;
      const d = m.def;
      if (m.elite && SEQ.heard && !SEQ.heard.has(m)) { SEQ.heard.add(m); if (live) playAt('elite', m.x, m.z, 1); }
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
  function stats() {
    const L = SEQ.lay;
    return Object.assign({}, ST, { voices: act.length, intensity: +SEQ.I.toFixed(3), crowdLvl: +CR.lvl.toFixed(3), bpm: Math.round(SEQ.bpm), boss: SEQ.bossKey, horde: +SEQ.horde.toFixed(2), low: +SEQ.low.toFixed(2), layers: Object.keys(L).filter((k) => L[k]).join(','), land: LS.key, event: LS.evKind, paused: PZ.on, hidden: hidden, state: ctx ? ctx.state : 'none' });
  }

  function softClip() {
    // Input is pre-scaled by 0.5, so the curve covers +-2: linear to 0.7, then bends to a 0.9 ceiling (about -0.9 dBFS).
    const n = 4097, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const u = (i / (n - 1) * 2 - 1) * 2, a = Math.abs(u); c[i] = Math.sign(u) * (a < 0.7 ? a : 0.7 + 0.2 * Math.tanh((a - 0.7) / 0.2)); }
    return c;
  }
  function sync() { api.ready = !!ctx && ctx.state === 'running'; }
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
    glue.connect(nMute);
    // Pause gains: one per bus, so pausing can quiet each part differently (see pauseMix).
    PZ.sfx = gn(glue, 1); PZ.amb = gn(nMute, 1); PZ.crowd = gn(nMute, 1);
    nSfx = gn(PZ.sfx, VOL.sfx); nUi = gn(glue, VOL.sfx); nAmb = gn(PZ.amb, 0.9 * VOL.ambience);
    nMusDuck = gn(nMute, 1); nMusic = gn(nMusDuck, 0.5 * VOL.music);
    PZ.pad = gn(nMusic, 1); PZ.seq = gn(nMusic, 1); nPad = gn(PZ.pad, 1); nSeq = gn(PZ.seq, 1.5);
    nCrowdDuck = gn(PZ.crowd, 1);
    nLand = gn(nAmb, 1); nEvt = gn(nAmb, 1);
    makeBuffers();
    const conv = ctx.createConvolver(); conv.buffer = makeImpulse();
    PZ.rev = gn(nMute, 0.5); conv.connect(PZ.rev);
    nRevIn = gn(null, 1); nRevIn.connect(flt(conv, 'highpass', 120));
    PZ.crowd.connect(gn(nRevIn, 0.15));
    startBeds();
    try { startCrowd(); } catch (e) { ST.err = 'crowd: ' + e.message; }
    mus.nextChord = ctx.currentTime + 1.5; mus.chord = 0;
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
    if (ctx.state !== 'running' && ctx.resume) { const pr = ctx.resume(); if (pr && pr.then) pr.then(sync, () => {}); }
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
    const tc = p ? 0.12 : 0.35, L = [[PZ.sfx, 0], [PZ.crowd, 0], [PZ.seq, 0], [PZ.pad, 0.5], [PZ.amb, 0.45], [PZ.rev, 0.25]];
    for (let i = 0; i < L.length; i++) L[i][0].gain.setTargetAtTime(p ? L[i][1] : i === 5 ? 0.5 : 1, now, tc);
  }
  // Bus levels 0..1 for a future settings menu: 'sfx', 'music', 'ambience' (wind, fire), 'crowd'.
  const VOL = { sfx: 1, music: 1, ambience: 1, crowd: 1 };
  function setVolume(bus, v) {
    if (!hasOwn(VOL, bus)) return;
    VOL[bus] = cl(+v || 0, 0, 1);
    if (!ctx || !nSfx) return;
    const now = ctx.currentTime, n = { sfx: nSfx, music: nMusic, ambience: nAmb, crowd: nCrowd }[bus], base = { sfx: 1, music: 0.5, ambience: 0.9, crowd: 1 }[bus];
    if (n && bus !== 'crowd') n.gain.setTargetAtTime(base * VOL[bus], now, 0.05);
    if (bus === 'sfx') nUi.gain.setTargetAtTime(VOL.sfx, now, 0.05);
    if (bus === 'crowd') appM.crowd = -1;
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
    // Danger rises in a couple of seconds and settles slowly, so the music never flickers.
    SEQ.I += (SEQ.tI - SEQ.I) * (1 - Math.exp(-adt / (SEQ.tI > SEQ.I ? 1.6 : 5.5)));
    SEQ.horde += (SEQ.hordeT - SEQ.horde) * (1 - Math.exp(-adt / (SEQ.hordeT ? 1.0 : 3.0)));
    api.intensity = SEQ.I;
    if (SEQ.horde > 0.05) choirOn(); else if (SEQ.choir) choirOff(now);
    if (SEQ.choir) SEQ.choir.g.gain.setTargetAtTime(0.05 * SEQ.horde * (0.6 + 0.4 * SEQ.I), now, 0.3);
    if (!api.muted) seqTick(now); else SEQ.next = 0;
    const dr = Math.max(cur.tension, SEQ.I * 0.75);
    if (Math.abs(dr - appM.drone) > 0.01) { appM.drone = dr; bed.droneG.gain.setTargetAtTime(dr * 0.1, now, 0.4); bed.droneLP.frequency.setTargetAtTime(280 + 220 * dr, now, 0.4); }
    setM('pad', nPad.gain, PAD_LVL * (1 - 0.3 * SEQ.I), now, 0.6);
    duckE *= Math.exp(-adt / 0.35);
    for (let i = lateDuck.length - 1; i >= 0; i--) if (now >= lateDuck[i][0]) { duckE = Math.max(duckE, lateDuck[i][1]); lateDuck.splice(i, 1); }
    setM('dm', nMusDuck.gain, 1 - 0.45 * duckE, now, 0.04);
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
      const wk = WINDK[LS.key] || WINDK.ashen, tc = rr(1.2, 3), f = rr(200, 520) * (0.7 + 0.6 * cur.wind) * wk[0];
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
    musicTick(now);
    // The reactive parts never take the game down: any fault is recorded in stats().err.
    try { scapes(now, paused); if (!paused) reactive(now); else { SEQ.lastNow = now; SEQ.next = 0; } } catch (e) { if (!ST.err) ST.err = String(e && e.stack || e).slice(0, 300); }
  }

  if (typeof window !== 'undefined') window.__cwAudio = api;
  return api;
})();
