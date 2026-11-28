// ---- Saarepagar audio (Echo): every sound and all the music, synthesized with WebAudio. No files, no network.
// API (DESIGN.md):  sfx(name, opts)   MUSIC.scene(name, {area})   AU.unlock()   AU.setVolume('music'|'sfx', v)
//                   AU.muted / AU.setMuted(b)   AU.stats()   AU.lite (no reverb, fewer nodes; auto on <= 4 cores)
//                   AU.suspend() / AU.resume() (same as a hidden / shown page)
// Tests: window.__saAudio (= AU), window.__saMusic (= MUSIC), AU.meter(true) then AU.stats().meter (LUFS, true peak, bands).
// Style (v2): modern chill-pop / lo-fi / tropical-lite. Electric piano, plucks, side-chained pads, soft claps and snaps,
// a phone-friendly bass and vocal-chop hooks; every sound is in the music's key, and merges climb across a combo.
// Mix: sfx bus + music bus (ducked by big moments) -> mute -> page fade -> low cut, soft top -> limiter -> soft clipper
// (ceiling 0.88, about -1.1 dBFS). Music sits around -22 LUFS; sounds speak over it.
const AU = (function () {
  const W = typeof window !== 'undefined' ? window : {}, NAV = typeof navigator !== 'undefined' ? navigator : {};
  const DOC = typeof document !== 'undefined' ? document : null;
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rnd = Math.random, pick = (a) => a[(rnd() * a.length) | 0];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const fold = (m, lo, hi) => { while (m < lo) m += 12; while (m >= hi) m -= 12; return m; };
  let LITE = NAV.hardwareConcurrency > 0 && NAV.hardwareConcurrency <= 4;
  let PHONE = false; try { PHONE = !!(W.matchMedia && W.matchMedia('(pointer: coarse)').matches); } catch (e) {}
  // iPhone: play like media, so the silent switch doesn't mute the game. Set early and again at unlock.
  try { if (NAV.audioSession) NAV.audioSession.type = 'playback'; } catch (e) {}

  let ctx = null, sr = 48000, NB = null, REV = null, hidden = false, hideTimer = 0, timer = 0;
  const B = {}; // buses
  const WV = {}; // periodic waves
  const VOL = { music: 1, sfx: 1 };
  const ST = { names: {}, made: 0, dropped: 0, err: '', nodeRate: 0, nrMade: 0, nrT: 0 };
  const act = []; // live sfx events {name, end}
  let muted = false;

  // ---------- node helpers (each counts toward the node rate, a CPU proxy for weak phones) ----------
  function G(dest, v) { const g = ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); ST.made++; return g; }
  function F(dest, type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; if (dest) b.connect(dest); ST.made++; return b; }
  function O(w, f, t) { const o = ctx.createOscillator(); if (typeof w === 'string') o.type = w; else o.setPeriodicWave(w); o.frequency.setValueAtTime(f, t); ST.made++; return o; }
  function fin(src, t0, t1, last) { src.start(t0); src.stop(t1); src.onended = () => { try { last.disconnect(); } catch (e) {} }; }
  function wave(h) { const re = new Float32Array(h.length), im = new Float32Array(h.length); for (let i = 1; i < h.length; i++) im[i] = h[i]; return ctx.createPeriodicWave(re, im); }
  // Optional stereo spread for sparkles (headphones); skipped in lite.
  function panTo(dest, p) { if (!p || LITE || !ctx.createStereoPanner) return dest; const s = ctx.createStereoPanner(); s.pan.value = cl(p, -1, 1); s.connect(dest); ST.made++; return s; }

  // One voice: oscillator (glide optional) -> optional low-pass (sweep optional) -> envelope. Returns the end time.
  function tone(t, o) {
    const a = o.a !== undefined ? o.a : 0.005, d = o.d !== undefined ? o.d : 0.2, h = o.h || 0, v = o.v || 0.1;
    const g = G(panTo(o.dest || B.sfxIn, o.pan), 0); let n = g;
    if (o.lp) { const f = F(g, 'lowpass', o.lp, o.q || 0.7); if (o.lp2) { f.frequency.setValueAtTime(o.lp, t); f.frequency.exponentialRampToValueAtTime(o.lp2, t + a + h + d * 0.7); } n = f; }
    const os = O(o.w || 'sine', o.f, t);
    if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, t + (o.gt || a + d));
    if (o.det) os.detune.value = o.det;
    os.connect(n);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); if (h) g.gain.setValueAtTime(v, t + a + h);
    g.gain.exponentialRampToValueAtTime(0.0003, t + a + h + d);
    const e = t + a + h + d + 0.03; fin(os, t, e, g); return e;
  }
  // Filtered noise burst (a slice of a shared noise buffer).
  function noise(t, o) {
    const a = o.a !== undefined ? o.a : 0.003, d = o.d !== undefined ? o.d : 0.08, v = o.v || 0.05;
    const g = G(panTo(o.dest || B.sfxIn, o.pan), 0), f = F(g, o.type || 'bandpass', o.f || 1000, o.q || 1);
    if (o.f2) { f.frequency.setValueAtTime(o.f, t); f.frequency.exponentialRampToValueAtTime(o.f2, t + a + d); }
    const s = ctx.createBufferSource(); ST.made++; s.buffer = NB; s.connect(f);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0003, t + a + d);
    const len = a + d + 0.03; if (len > NB.duration - 0.05) { s.loop = true; s.start(t, 0); s.stop(t + len); } else s.start(t, rnd() * (NB.duration - len - 0.01), len); s.onended = () => { try { g.disconnect(); } catch (e) {} };
    return t + len;
  }

  // ---------- instruments (shared by music and jingles) ----------
  const VOWEL = { a: [760, 1180], o: [500, 860], e: [560, 1700], u: [380, 820], i: [360, 1950] };
  const INS = {
    // Electric piano: FM tine (modulator at 1x whose depth fades: a bark that mellows). 4 nodes (2 in lite).
    ep(t, m, dur, v, dest) {
      const f = mtof(m), g = G(dest, 0), rel = 0.32, e = t + dur + rel + 0.03;
      const c = O(LITE ? WV.ep : 'sine', f, t); c.detune.value = (rnd() - 0.5) * 9;
      if (!LITE) {
        const mo = O('sine', f, t), mg = G(c.frequency, 0); mo.connect(mg);
        mg.gain.setValueAtTime(f * 1.25, t); mg.gain.exponentialRampToValueAtTime(f * 0.12, t + 0.5);
        mo.start(t); mo.stop(e);
      }
      c.connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(v * 0.42, t + 0.45);
      g.gain.setValueAtTime(v * (dur > 0.45 ? 0.38 : 0.42), t + Math.max(dur, 0.06)); g.gain.exponentialRampToValueAtTime(0.0003, t + dur + rel);
      fin(c, t, e, g);
    },
    // Plucky synth: soft saw through a fast-closing resonant low-pass. 3 nodes.
    pluck(t, m, dur, v, dest, p) {
      const f = mtof(m), g = G(panTo(dest, p), 0), top = Math.min(f * 7, 5200), lp = F(g, 'lowpass', top, 2.2), d = 0.16 + Math.min(dur, 0.5) * 0.6;
      lp.frequency.setValueAtTime(top, t); lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.3, 300), t + 0.16);
      const o = O(WV.saw, f, t); o.connect(lp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0003, t + d);
      fin(o, t, t + d + 0.03, g);
    },
    // Marimba-ish mallet: sine plus a fast 4x click partial. 4 nodes (2 in lite).
    mallet(t, m, dur, v, dest, p) {
      const f = mtof(m), d = cl(0.5 - (m - 72) * 0.012, 0.18, 0.6);
      tone(t, { f: f, a: 0.002, d: d, v: v, dest: dest, pan: p });
      if (!LITE && f * 4 < 7000) tone(t, { f: f * 4, a: 0.001, d: 0.04, v: v * 0.22, dest: dest, pan: p });
    },
    // Glassy bell: sine with an inharmonic partial that fades first. 4 nodes (2 in lite).
    bell(t, m, dur, v, dest, p) {
      const f = mtof(m), ring = cl(1.3 - (m - 76) * 0.025, 0.45, 1.6);
      tone(t, { f: f, a: 0.002, d: ring, v: v, dest: dest, pan: p });
      if (!LITE && f * 2.76 < 6500) tone(t, { f: f * 2.76, a: 0.001, d: ring * 0.22, v: v * 0.28, dest: dest, pan: p });
    },
    // Warm pad: two detuned soft saws, low-passed, slow attack (sent to the side-chained pump bus). 4 nodes (3 in lite).
    pad(t, m, dur, v, dest) {
      const f = mtof(m), g = G(dest, 0), lp = F(g, 'lowpass', cl(f * 3, 700, 1700), 0.5), e = t + dur + 0.5;
      const o1 = O(WV.saw, f, t); o1.detune.value = -8; o1.connect(lp);
      if (!LITE) { const o2 = O(WV.saw, f, t); o2.detune.value = 9; o2.connect(lp); o2.start(t); o2.stop(e); }
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.35, dur * 0.4)); g.gain.setValueAtTime(v, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.45);
      fin(o1, t, e, g);
    },
    // Deep but phone-friendly bass: fundamental plus 2nd/3rd harmonics so small speakers still "hear" it. 3 nodes.
    bass(t, m, dur, v, dest) {
      const f = mtof(m), g = G(dest, 0), lp = F(g, 'lowpass', 520, 0.8), o = O(WV.bass, f, t); o.connect(lp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(v * 0.55, t + Math.min(dur, 0.3));
      g.gain.setValueAtTime(v * 0.55, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
      fin(o, t, t + dur + 0.07, g);
    },
    // Vocal-chop synth: a scooped saw through two formant band-passes ("ah", "oh", "eh"...). 4 nodes (3 in lite).
    vox(t, m, dur, v, dest, vw) {
      const f = mtof(m), fm = VOWEL[vw] || VOWEL.a, g = G(dest, 0), e = t + dur + 0.12;
      const o = O(WV.saw, f * 0.95, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
      o.connect(F(g, 'bandpass', fm[0], 4));
      if (!LITE) o.connect(F(g, 'bandpass', fm[1], 6));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.setValueAtTime(v * 0.85, t + Math.max(0.03, dur));
      g.gain.linearRampToValueAtTime(0, t + dur + 0.09);
      fin(o, t, e, g);
    },
    // Short bright chord stab for jingles: detuned saws, filter opens then settles. 4 nodes per note (3 in lite).
    stab(t, m, dur, v, dest) {
      const f = mtof(m), g = G(dest, 0), lp = F(g, 'lowpass', 900, 1.2), e = t + dur + 0.35;
      lp.frequency.setValueAtTime(700, t); lp.frequency.exponentialRampToValueAtTime(3600, t + 0.03); lp.frequency.exponentialRampToValueAtTime(1300, t + 0.3 + dur * 0.3);
      const o1 = O(WV.saw, f, t); o1.detune.value = -10; o1.connect(lp);
      if (!LITE) { const o2 = O(WV.saw, f, t); o2.detune.value = 11; o2.connect(lp); o2.start(t); o2.stop(e); }
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(v * 0.5, t + 0.2); g.gain.setValueAtTime(v * 0.5, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.3);
      fin(o1, t, e, g);
    },
    // Drums: punchy but soft.
    kick(t, v, dest) {
      tone(t, { f: 165, f2: 64, gt: 0.08, a: 0.002, d: 0.2, v: v, dest: dest });
      if (!LITE) tone(t, { w: 'triangle', f: 900, f2: 260, gt: 0.012, a: 0.001, d: 0.018, v: v * 0.12, dest: dest });
    },
    clap(t, v, dest) {
      const n = LITE ? 2 : 3;
      for (let i = 0; i < n; i++) noise(t + i * 0.011, { f: 1350, q: 1.1, a: 0.001, d: 0.011, v: v * 0.8, dest: dest });
      noise(t + n * 0.011, { f: 1250, q: 0.9, a: 0.001, d: 0.12, v: v, dest: dest });
    },
    snap(t, v, dest) { noise(t, { f: 2300, q: 1.6, a: 0.001, d: 0.035, v: v, dest: dest }); if (!LITE) tone(t, { f: 1500, f2: 1100, a: 0.001, d: 0.02, v: v * 0.25, dest: dest }); },
    snare(t, v, dest) { noise(t, { f: 1700, q: 0.7, a: 0.001, d: 0.12, v: v, dest: dest }); tone(t, { w: 'triangle', f: 210, f2: 160, a: 0.001, d: 0.07, v: v * 0.6, dest: dest }); },
    hat(t, v, dest) { noise(t, { f: 6200, q: 0.9, a: 0.001, d: 0.028, v: v, dest: dest }); },
    shaker(t, v, dest) { if (LITE) return; noise(t, { f: 4300, q: 0.8, a: 0.01, d: 0.035, v: v, dest: dest }); },
  };

  // ---------- sounds ----------
  const PENT = [0, 2, 4, 7, 9];
  const pent = (i) => 12 * Math.floor(i / 5) + PENT[((i % 5) + 5) % 5];
  // Jingles sit in the song's key: kr(o) = the music's tonic in octave o (C if no music).
  const keyPC = () => (MU.E ? ((MU.E.c.root % 12) + 12) % 12 : 0);
  const kr = (oct) => 12 * oct + keyPC();
  const top = (m, hi) => { while (m >= hi) m -= 12; return m; }; // keep sparkles below a ceiling (no harsh highs)
  let lastMerge = -9, combo = 0;
  function comboStep(t, add) { combo = t - lastMerge < 2.4 ? Math.min(combo + add, 40) : 0; lastMerge = t; return combo; }
  // The merge pop: a pitched "bloop", a clean click and a three-note sparkle. m = midi of the pop.
  function pop(t, m, v, big) {
    const f = mtof(m);
    tone(t, { f: f * 0.5, f2: f, gt: 0.035, a: 0.002, d: 0.13, v: 0.24 * v });
    tone(t + 0.012, { f: f, a: 0.002, d: big ? 0.45 : 0.3, v: 0.08 * v });
    if (!LITE) tone(t + 0.012, { f: f * 2, a: 0.001, d: 0.06, v: 0.018 * v });
    noise(t, { f: 3000, q: 0.8, a: 0.001, d: 0.012, v: 0.05 * v });
  }
  function sparkle(t, m, n, gap, v) {
    const sp = [0, 4, 7, 12, 16, 19, 24];
    for (let i = 0; i < n; i++) INS.bell(t + i * gap, top(m + sp[i % sp.length], 100), 0.3, v * (1 - i * 0.06), B.sfxIn, i % 3 === 0 ? 0 : i % 3 === 1 ? -0.35 : 0.35);
  }
  function shimmer(t, d, v) { noise(t, { f: 2200, f2: 5200, q: 1.5, a: d * 0.4, d: d * 0.6, v: v }); }
  function whoosh(t, d, v, up) { noise(t, { f: up ? 500 : 2400, f2: up ? 2400 : 500, q: 1.1, a: d * 0.55, d: d * 0.45, v: v }); }
  function chord(t, root, iv, dur, v, ins) { for (let i = 0; i < iv.length; i++) INS[ins || 'stab'](t + i * 0.006, root + iv[i], dur, v, B.sfxIn); }
  function pings(t, n, base, gap, v) { // cascading coin pings, climbing the key's pentatonic
    for (let i = 0; i < n; i++) {
      const tt = t + i * gap * (1 - i * 0.03) + rnd() * 0.008, m = top(base + pent(i), 98), f = mtof(m);
      tone(tt, { f: f, a: 0.001, d: 0.2, v: v, pan: i % 2 ? 0.3 : -0.3 });
      tone(tt, { f: f * 2, a: 0.001, d: 0.06, v: v * 0.35, pan: i % 2 ? 0.3 : -0.3 });
    }
    return t + n * gap + 0.25;
  }
  function fill(t, n, gap, v) { for (let i = 0; i < n; i++) INS.snap(t + i * gap, v * (0.6 + 0.4 * i / n), B.sfxIn); }

  const SFX = {
    pick(t) { // a soft bubbly lift
      tone(t, { f: 420, f2: 780, gt: 0.05, a: 0.003, d: 0.07, v: 0.13 });
      noise(t, { f: 3200, q: 1, a: 0.001, d: 0.01, v: 0.025 });
      return t + 0.1;
    },
    drop(t) { // a soft "thup"
      const k = 0.94 + rnd() * 0.12;
      tone(t, { f: 240 * k, f2: 120 * k, gt: 0.06, a: 0.002, d: 0.1, v: 0.26 });
      noise(t, { f: 2400, q: 0.9, a: 0.001, d: 0.012, v: 0.04 });
      return t + 0.16;
    },
    swap(t) { // swish and two blips
      whoosh(t, 0.12, 0.035, true);
      tone(t + 0.01, { f: 620, f2: 760, a: 0.002, d: 0.06, v: 0.1 }); tone(t + 0.075, { f: 820, f2: 980, a: 0.002, d: 0.07, v: 0.09 });
      return t + 0.2;
    },
    // Pop + sparkle; the pitch climbs one pentatonic step per merge in a combo (and a little with the item's level).
    merge(t, o) {
      const L = cl(+o.level || 1, 1, 14), c = o.combo !== undefined ? (combo = Math.min(40, +o.combo || 0), lastMerge = t, combo) : comboStep(t, 1);
      const idx = Math.min(15, c + ((L - 1) >> 2)), m = kr(4) + 7 + pent(idx);
      pop(t, m, 1, L >= 6);
      sparkle(t + 0.04, m + 12, c >= 8 ? 4 : 3, 0.035, 0.04);
      if (L >= 5) tone(t, { f: 190, f2: 95, gt: 0.07, a: 0.002, d: 0.16, v: 0.12 });
      if (c >= 10) shimmer(t + 0.03, 0.25, 0.012);
      return t + 0.45;
    },
    merge5(t, o) { // a bigger double pop (a 5-merge makes two)
      const L = cl(+o.level || 1, 1, 14), c = comboStep(t, 2), idx = Math.min(15, c + ((L - 1) >> 2)), m = kr(4) + 7 + pent(idx);
      pop(t, m, 1.05, true); pop(t + 0.09, m + (pent(idx + 2) - pent(idx)), 1.1, true);
      tone(t, { f: 200, f2: 95, gt: 0.08, a: 0.002, d: 0.2, v: 0.15 });
      sparkle(t + 0.12, m + 12, 5, 0.03, 0.045); shimmer(t + 0.1, 0.3, 0.014);
      return t + 0.6;
    },
    combo(t, o) { // a "bling-bling" that rises with the combo count; every 5th is a bigger hit
      const n = cl(+o.n || 2, 2, 40); if (n > combo) { combo = n; lastMerge = t; }
      const m = kr(5) + pent(Math.min(10, n)), big = n % 5 === 0;
      INS.mallet(t, top(m, 96), 0.2, 0.1, B.sfxIn, -0.2); INS.mallet(t + 0.07, top(m + 7, 98), 0.3, 0.1, B.sfxIn, 0.2);
      shimmer(t, 0.22, 0.012);
      if (big) { duck(0.6, 0.8); chord(t + 0.14, kr(5), [0, 4, 7, 12], 0.25, 0.035); INS.kick(t + 0.14, 0.2, B.sfxIn); sparkle(t + 0.16, kr(6) + 7, 5, 0.03, 0.04); }
      return t + (big ? 0.8 : 0.4);
    },
    mergeMax(t) { // top of a chain: pop, a stab chord, a rising sparkle
      duck(0.45, 1.4);
      const r = kr(5);
      pop(t, r + 19, 1.1, true); INS.kick(t, 0.24, B.sfxIn);
      chord(t + 0.08, r, [0, 4, 7, 11, 14], 0.5, 0.032); INS.bass(t + 0.08, r - 12, 0.5, 0.18, B.sfxIn);
      sparkle(t + 0.12, r + 12, 7, 0.04, 0.045); shimmer(t + 0.1, 0.5, 0.016);
      return t + 1.4;
    },
    lucky(t) { // rainbow jackpot: a two-octave run of bells sweeping left to right, then a bright chord
      duck(0.4, 1.8);
      const r = kr(5);
      for (let i = 0; i < 12; i++) INS.bell(t + i * 0.03, top(r + pent(i + 2), 100), 0.3, 0.04, B.sfxIn, -0.6 + i * 0.1);
      shimmer(t, 0.5, 0.02);
      chord(t + 0.4, r, [0, 4, 7, 12, 16], 0.6, 0.03); INS.kick(t + 0.4, 0.22, B.sfxIn); INS.clap(t + 0.4, 0.07, B.sfxIn);
      INS.bass(t + 0.4, r - 12, 0.6, 0.17, B.sfxIn);
      for (let i = 0; i < 6; i++) INS.bell(t + 0.5 + i * 0.06, top(r + 24 + [0, 7, 4, 12, 7, 16][i], 100), 0.3, 0.035, B.sfxIn, i % 2 ? 0.4 : -0.4);
      return t + 1.8;
    },
    discover(t) { // new item: "ta-da!"
      duck(0.5, 1.2);
      const r = kr(5);
      chord(t, r - 1, [0, 3, 7], 0.08, 0.025); // the "ta" (a leading-tone grace chord)
      chord(t + 0.13, r, [0, 4, 7, 12], 0.55, 0.034); INS.kick(t + 0.13, 0.22, B.sfxIn); INS.clap(t + 0.13, 0.06, B.sfxIn);
      INS.bass(t + 0.13, r - 12, 0.5, 0.16, B.sfxIn);
      sparkle(t + 0.18, r + 12, 5, 0.035, 0.045);
      return t + 1.2;
    },
    spawn(t, o) { // a bubbly pop-out with an in-key ping
      const m = top(kr(5) + pent(((+o.level || 1) - 1) % 5 + (rnd() < 0.5 ? 0 : 1)), 90);
      tone(t, { f: 260, f2: 620, gt: 0.04, a: 0.002, d: 0.07, v: 0.13 });
      INS.mallet(t + 0.03, m, 0.2, 0.08, B.sfxIn);
      return t + 0.4;
    },
    noEnergy(t) { // a soft descending "bwoo-oop"
      tone(t, { w: 'triangle', f: 440, f2: 330, gt: 0.2, a: 0.01, d: 0.22, v: 0.12, lp: 1400 });
      tone(t + 0.2, { w: 'triangle', f: 300, f2: 220, gt: 0.25, a: 0.01, d: 0.3, v: 0.11, lp: 1000 });
      return t + 0.6;
    },
    bubble(t) { // watery bloop-bloop
      tone(t, { f: 380, f2: 900, gt: 0.07, a: 0.003, d: 0.1, v: 0.13 });
      tone(t + 0.08, { f: 560, f2: 1150, gt: 0.06, a: 0.003, d: 0.09, v: 0.09 });
      return t + 0.25;
    },
    bubblePop(t) {
      noise(t, { f: 2200, q: 1.2, a: 0.001, d: 0.03, v: 0.13 });
      tone(t, { f: 1200, f2: 500, gt: 0.04, a: 0.001, d: 0.05, v: 0.14 });
      sparkle(t + 0.03, kr(6) + 7, 3, 0.03, 0.035);
      return t + 0.4;
    },
    chest(t) { // latch click, a whoosh, the reveal
      duck(0.6, 1.2);
      tone(t, { w: 'triangle', f: 900, f2: 600, a: 0.001, d: 0.03, v: 0.08 }); noise(t, { f: 2500, q: 2, a: 0.001, d: 0.015, v: 0.05 });
      whoosh(t + 0.05, 0.3, 0.04, true);
      pop(t + 0.35, kr(5) + 7, 1, true);
      sparkle(t + 0.4, kr(5) + 12, 6, 0.045, 0.045);
      return t + 1.3;
    },
    mystery(t) { // a box shakes (rattle, rattle, rattle), a riser, then it opens
      duck(0.55, 1.8);
      for (let i = 0; i < 4; i++) {
        const tt = t + i * 0.12, hi = i % 2;
        noise(tt, { f: hi ? 1100 : 800, q: 1.4, a: 0.002, d: 0.05, v: 0.1 });
        tone(tt, { w: 'triangle', f: hi ? 260 : 220, f2: hi ? 200 : 170, a: 0.001, d: 0.05, v: 0.11 });
      }
      whoosh(t + 0.5, 0.42, 0.045, true);
      tone(t + 0.55, { f: kr(4), f2: kr(5) + 7, gt: 0.35, a: 0.3, d: 0.08, v: 0.03 });
      pop(t + 0.95, kr(5) + 12, 1.1, true); INS.kick(t + 0.95, 0.2, B.sfxIn);
      chord(t + 0.98, kr(5), [0, 4, 7, 12], 0.4, 0.028);
      sparkle(t + 1.0, kr(5) + 12, 6, 0.035, 0.045);
      return t + 1.8;
    },
    order(t) { // a soft modern notification (marimba, rising)
      INS.mallet(t, top(kr(5) + 7, 92), 0.2, 0.09, B.sfxIn); INS.mallet(t + 0.11, top(kr(5) + 12, 94), 0.3, 0.09, B.sfxIn);
      return t + 0.6;
    },
    orderDone(t) { // "ka-ching": a snap, a two-note mallet and cascading pings
      duck(0.65, 0.9);
      INS.snap(t, 0.09, B.sfxIn);
      INS.mallet(t + 0.02, top(kr(5) + 12, 94), 0.3, 0.1, B.sfxIn); INS.mallet(t + 0.1, top(kr(5) + 19, 96), 0.4, 0.1, B.sfxIn);
      tone(t, { f: 200, f2: 110, a: 0.002, d: 0.12, v: 0.1 });
      pings(t + 0.16, 4, kr(6) + 7, 0.05, 0.045);
      return t + 1;
    },
    coins(t, o) { const n = cl((+o.n) | 0 || 4, 1, 8); return pings(t, n, kr(6) + 4, 0.048, 0.05); },
    stars(t, o) { // a whoosh up and a rising twinkle that lands on a chord
      const n = cl((+o.n) | 0 || 5, 3, 7), r = kr(5) + 12;
      whoosh(t, 0.25, 0.03, true);
      for (let i = 0; i < n; i++) INS.bell(t + 0.05 + i * 0.05, top(r + pent(i + 2), 100), 0.3, 0.045, B.sfxIn, i % 2 ? 0.3 : -0.3);
      const e = t + 0.05 + n * 0.05;
      INS.bell(e, top(r + 12, 100), 0.6, 0.04, B.sfxIn); INS.bell(e, top(r + 16, 100), 0.6, 0.03, B.sfxIn);
      return e + 0.6;
    },
    event(t) { // event reward: a bright motif, a chord and coins
      duck(0.55, 1.4);
      const r = kr(5), mel = [0, 4, 7, 12];
      for (let i = 0; i < 4; i++) INS.mallet(t + i * 0.08, top(r + 12 + mel[i], 98), 0.2, 0.09, B.sfxIn, i % 2 ? 0.25 : -0.25);
      chord(t + 0.34, r, [0, 4, 7, 14], 0.45, 0.028); INS.kick(t + 0.34, 0.2, B.sfxIn);
      pings(t + 0.42, 5, kr(6) + 4, 0.045, 0.04);
      return t + 1.3;
    },
    claim(t) { // claiming a reward (album, festival, free energy): a bright two-note lift, a soft chord, pings
      duck(0.6, 1);
      const r = kr(5);
      INS.mallet(t, top(r + 12, 96), 0.2, 0.1, B.sfxIn, -0.2); INS.mallet(t + 0.08, top(r + 19, 98), 0.3, 0.1, B.sfxIn, 0.2);
      chord(t + 0.16, r, [4, 7, 12], 0.35, 0.022, 'ep'); shimmer(t + 0.1, 0.3, 0.012);
      pings(t + 0.2, 4, kr(6) + 4, 0.045, 0.04);
      return t + 0.9;
    },
    hint(t) { tone(t, { f: 1320, a: 0.002, d: 0.035, v: 0.028 }); tone(t, { f: 1980, a: 0.001, d: 0.015, v: 0.008 }); return t + 0.06; },
    taskDone(t) { // short modern fanfare: a pluck run up and a chord
      duck(0.4, 1.6);
      const r = kr(5), up = [0, 4, 7, 11, 12];
      for (let i = 0; i < up.length; i++) INS.pluck(t + i * 0.06, r + up[i], 0.1, 0.09, B.sfxIn, (i - 2) * 0.15);
      const tc = t + up.length * 0.06 + 0.02;
      chord(tc, r, [0, 4, 7, 12, 14], 0.6, 0.03); INS.kick(tc, 0.22, B.sfxIn); INS.clap(tc, 0.06, B.sfxIn); INS.bass(tc, r - 12, 0.6, 0.17, B.sfxIn);
      sparkle(tc + 0.05, r + 12, 5, 0.04, 0.045);
      return tc + 1.1;
    },
    levelUp(t) { // the big one: a snap fill and a run up, then IV - V - I hits with a vocal "hey" and sparkles
      duck(0.35, 2.4);
      const r = kr(5), up = [0, 4, 7, 11, 12, 16, 19, 23];
      fill(t, 4, 0.11, 0.09);
      for (let i = 0; i < up.length; i++) INS.pluck(t + i * 0.055, r + up[i], 0.1, 0.085, B.sfxIn, (i - 3.5) * 0.1);
      const h = t + 0.48;
      chord(h, r + 5, [0, 4, 7], 0.12, 0.03); INS.kick(h, 0.22, B.sfxIn); INS.bass(h, r - 7, 0.15, 0.15, B.sfxIn);
      chord(h + 0.22, r + 7, [0, 5, 7], 0.12, 0.03); INS.kick(h + 0.22, 0.22, B.sfxIn); INS.bass(h + 0.22, r - 5, 0.15, 0.15, B.sfxIn);
      const tc = h + 0.44;
      chord(tc, r, [0, 4, 7, 12, 14], 0.9, 0.034); INS.kick(tc, 0.26, B.sfxIn); INS.clap(tc, 0.08, B.sfxIn); INS.bass(tc, r - 12, 0.9, 0.19, B.sfxIn);
      INS.vox(tc, r + 16, 0.12, 0.2, B.sfxIn, 'e'); INS.vox(tc + 0.15, r + 19, 0.35, 0.2, B.sfxIn, 'a');
      sparkle(tc + 0.1, r + 12, 7, 0.045, 0.045); shimmer(tc, 0.7, 0.018);
      return tc + 1.4;
    },
    album(t) { // album page complete: a page-flip swish, a mallet melody and a fanfare chord
      duck(0.4, 2);
      const r = kr(5), mel = [[7, 0], [9, 0.1], [12, 0.2], [16, 0.32], [14, 0.44]];
      whoosh(t, 0.16, 0.045, false); noise(t + 0.12, { f: 1600, q: 0.8, a: 0.001, d: 0.03, v: 0.05 });
      for (const [d, dt] of mel) INS.mallet(t + 0.18 + dt, top(r + 12 + d, 98), 0.2, 0.1, B.sfxIn, (d - 11) * 0.05);
      const tc = t + 0.8;
      chord(tc, r, [0, 4, 7, 11, 16], 0.8, 0.032); INS.kick(tc, 0.24, B.sfxIn); INS.clap(tc, 0.07, B.sfxIn); INS.bass(tc, r - 12, 0.8, 0.18, B.sfxIn);
      sparkle(tc + 0.08, r + 12, 7, 0.05, 0.045); shimmer(tc, 0.6, 0.016);
      return tc + 1.3;
    },
    daily(t) { // the gift: a ribbon swish and the title hook on a music box
      duck(0.5, 2);
      const r = kr(5) + 12, mel = [[4, 0], [4, 0.15], [5, 0.22], [4, 0.3], [2, 0.45], [1, 0.6], [2, 0.68], [0, 0.82]];
      whoosh(t, 0.2, 0.03, true);
      for (const [d, dt] of mel) INS.bell(t + 0.15 + dt, top(r + [0, 2, 4, 5, 7, 9][d], 100), 0.4, 0.06, B.sfxIn);
      chord(t + 0.97, r - 12, [0, 4, 7, 14], 0.6, 0.026, 'ep');
      return t + 2;
    },
    tap(t) { tone(t, { f: 950, f2: 720, a: 0.001, d: 0.028, v: 0.065 }); noise(t, { f: 2600, q: 1.5, a: 0.001, d: 0.008, v: 0.025 }); return t + 0.05; },
    open(t) { whoosh(t, 0.12, 0.035, true); tone(t + 0.04, { f: 600, f2: 880, gt: 0.05, a: 0.003, d: 0.07, v: 0.07 }); return t + 0.18; },
    close(t) { whoosh(t, 0.12, 0.03, false); tone(t + 0.03, { f: 760, f2: 520, gt: 0.05, a: 0.003, d: 0.07, v: 0.06 }); return t + 0.18; },
    sell(t) { whoosh(t, 0.12, 0.03, false); pings(t + 0.06, 2, kr(6) + 7, 0.05, 0.045); return t + 0.4; },
    deny(t) { // a gentle "uh-uh"
      tone(t, { w: 'triangle', f: 330, a: 0.01, h: 0.05, d: 0.08, v: 0.11, lp: 1300 });
      tone(t + 0.14, { w: 'triangle', f: 294, a: 0.01, h: 0.05, d: 0.12, v: 0.1, lp: 1200 });
      return t + 0.4;
    },
    talk(t, o) { return voice(t, o.who || 'mina', o.ch); },
  };

  // Cute voice blips. Each character has its own pitch, timbre and lilt; opts.ch (the letter) picks the vowel colour.
  const WHO = {
    maali: { f: 300, w: 'triangle', lp: 1500, glide: 0.94, spread: [0, 2, 4, -3] },
    ants: { f: 150, w: 'square', lp: 850, glide: 0.97, spread: [0, -2, 2, 0] },
    muri: { f: 640, w: 'triangle', lp: 2200, glide: 1.25, spread: [0, 4, 7, 2], mew: true },
    liisa: { f: 430, w: 'triangle', lp: 2100, glide: 1.06, spread: [0, 2, 4, 7] },
    peeter: { f: 185, w: 'sawtooth', lp: 750, glide: 0.95, spread: [0, -2, 0, 3] },
    mina: { f: 360, w: 'triangle', lp: 1800, glide: 1.02, spread: [0, 2, -2, 4] },
  };
  const PUNCT = /^[\s.,!?;:…"'()\-–—]$/; // spaces and punctuation are silent in dialogue
  const VOW = { a: [0, 1], e: [2, 1.15], i: [4, 1.35], o: [-1, 0.8], u: [-3, 0.7], 'õ': [-2, 0.85], 'ä': [1, 1.2], 'ö': [0, 0.85], 'ü': [3, 0.8], y: [3, 0.8] };
  function voice(t, who, ch) {
    const P = WHO[who] || WHO.mina;
    let semi = pick(P.spread), br = 1;
    if (typeof ch === 'string' && ch) {
      const c = ch.toLowerCase();
      const v = VOW[c]; if (v) { semi += v[0]; br = v[1]; }
    }
    const f = P.f * Math.pow(2, semi / 12), d = P.mew ? 0.09 : 0.06;
    tone(t, { w: P.w, f: f, f2: f * P.glide, gt: d, a: 0.008, d: d, v: P.w === 'triangle' ? 0.11 : 0.06, lp: P.lp * br, q: 2 });
    return t + d + 0.02;
  }

  // Voice limits: a minimum gap per sound, a cap per sound, and a cap on everything at once.
  const LIM = { merge: [0.04, 4], merge5: [0.08, 2], combo: [0.12, 1], talk: [0.055, 2], coins: [0.07, 2], tap: [0.03, 2], hint: [0.2, 1], pick: [0.04, 2], drop: [0.04, 3], swap: [0.05, 2], spawn: [0.05, 3], bubble: [0.1, 2], bubblePop: [0.04, 3], stars: [0.15, 1], mergeMax: [0.3, 1], lucky: [0.4, 1], claim: [0.25, 1], discover: [0.3, 1], mystery: [0.5, 1], event: [0.4, 1], album: [0.5, 1], taskDone: [0.5, 1], levelUp: [0.5, 1], daily: [0.5, 1], orderDone: [0.2, 1], chest: [0.3, 1], order: [0.2, 1], deny: [0.15, 1], noEnergy: [0.25, 1], open: [0.06, 1], close: [0.06, 1], sell: [0.1, 1] };
  const PRI = { mergeMax: 1, taskDone: 1, levelUp: 1, orderDone: 1, daily: 1, chest: 1, lucky: 1, discover: 1, mystery: 1, event: 1, album: 1, combo: 1, claim: 1 };
  const lastAt = {};
  function sfx(name, opts) {
    if (typeof name !== 'string' || !hasOwn(SFX, name)) return false;
    ST.names[name] = (ST.names[name] || 0) + 1;
    if (name === 'talk' && opts && typeof opts.ch === 'string' && PUNCT.test(opts.ch)) return false;
    if (!ctx || !api.ready || muted || hidden || VOL.sfx <= 0) return false;
    try {
      const now = ctx.currentTime, lim = LIM[name] || [0.03, 2];
      if (now - (lastAt[name] || -9) < lim[0]) { ST.dropped++; if (name === 'merge') comboStep(now, 1); return false; }
      let all = 0, same = 0;
      for (let i = act.length - 1; i >= 0; i--) { if (act[i].end <= now) { act.splice(i, 1); continue; } all++; if (act[i].name === name) same++; }
      if (same >= lim[1] || (all >= (LITE ? 8 : 14) && !PRI[name])) { ST.dropped++; if (name === 'merge') comboStep(now, 1); return false; }
      lastAt[name] = now;
      const end = SFX[name](now + 0.005, opts || {});
      act.push({ name: name, end: end || now + 0.3 });
      return true;
    } catch (e) { ST.err = name + ': ' + e.message; return false; }
  }
  function duck(depth, hold) {
    if (!B.duck) return;
    const now = ctx.currentTime, g = B.duck.gain;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.setTargetAtTime(depth, now, 0.04); g.setTargetAtTime(1, now + hold, 0.5);
  }

  // ---------- music ----------
  // A small song engine: 16th-note grid, bar by bar. Each area has its own key, tempo, groove, chords and hook.
  // Sections (intro, verse, pre, chorus, break, verse2, chorus2, outro) shuffle between cycles; verses get fresh melodies.
  const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], aeolian: [0, 2, 3, 5, 7, 8, 10], mixo: [0, 2, 4, 5, 7, 9, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };
  const Q = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], d7: [0, 4, 7, 10], sus: [0, 5, 7, 10], add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], M: [0, 4, 7], m: [0, 3, 7] };
  // Hooks: two bars of [16th step, scale degree, length]; a = bar 1, b1 = the "call" ending, b2 = the "answer".
  const HOOK = {
    title: { a: [[0, 4, 2], [3, 4, 1], [4, 5, 2], [6, 4, 2], [10, 2, 2], [12, 1, 2], [14, 2, 2]], b1: [[0, 0, 3], [3, 2, 1], [4, 1, 6], [12, 4, 2], [14, 5, 2]], b2: [[0, 2, 3], [3, 1, 1], [4, 0, 8], [14, 4, 2]] },
    cafe: { a: [[2, 4, 2], [4, 5, 1], [6, 4, 3], [10, 2, 2], [12, 4, 4]], b1: [[2, 2, 2], [4, 1, 2], [6, 0, 2], [8, 1, 6]], b2: [[2, 5, 2], [4, 4, 2], [6, 2, 2], [8, 0, 6]] },
    garden: { a: [[0, 0, 1], [2, 2, 1], [3, 4, 2], [6, 4, 1], [8, 5, 2], [10, 4, 2], [12, 2, 3]], b1: [[0, 1, 1], [2, 2, 1], [3, 4, 2], [6, 2, 2], [8, 1, 4], [14, 4, 1]], b2: [[0, 1, 1], [2, 2, 1], [3, 4, 2], [6, 5, 2], [8, 7, 6]] },
    harbour: { a: [[0, 4, 1], [2, 4, 1], [3, 2, 2], [6, 4, 2], [8, 6, 1], [10, 4, 2], [12, 2, 2], [14, 0, 2]], b1: [[0, 2, 3], [3, 4, 1], [4, 2, 2], [6, 0, 2], [8, -1, 4], [14, 0, 1]], b2: [[0, 2, 3], [3, 4, 1], [4, 6, 2], [6, 7, 4], [12, 4, 4]] },
    mill: { a: [[0, 0, 2], [2, 4, 2], [4, 4, 1], [6, 3, 1], [7, 4, 3], [10, 6, 2], [12, 4, 4]], b1: [[0, 3, 2], [2, 2, 2], [4, 1, 1], [6, 2, 3], [10, 0, 2], [12, 1, 4]], b2: [[0, 3, 2], [2, 4, 2], [4, 6, 1], [6, 7, 6], [14, 4, 2]] },
    light: { a: [[0, 4, 4], [4, 2, 2], [6, 4, 2], [8, 7, 6], [14, 6, 2]], b1: [[0, 5, 4], [4, 4, 4], [8, 2, 8]], b2: [[0, 5, 4], [4, 6, 2], [6, 7, 2], [8, 9, 8]] },
    secret: { a: [[0, 0, 2], [2, 2, 2], [4, 4, 3], [7, 3, 1], [8, 2, 4], [14, 4, 2]], b1: [[0, 6, 2], [2, 4, 2], [4, 3, 2], [6, 2, 2], [8, 1, 6]], b2: [[0, 6, 2], [2, 7, 2], [4, 9, 2], [6, 7, 2], [8, 4, 8]] },
    story: { a: [[0, 4, 4], [4, 5, 2], [6, 4, 2], [8, 2, 8]], b1: [[0, 1, 4], [4, 2, 2], [6, 4, 2], [8, 5, 8]], b2: [[0, 4, 4], [4, 2, 2], [6, 1, 2], [8, 0, 8]] },
  };
  // Grooves: kick, snare/clap steps, hats; the snare voice; the bass line [step, length, interval].
  const GROOVE = {
    lofi: { k: [0, 7, 10], s: [4, 12], sn: 'snare', h: [0, 2, 4, 6, 8, 10, 12, 14], acc: 2, sh: false, bass: [[0, 6, 0], [7, 2, 0], [10, 5, 7]] },
    pop: { k: [0, 6, 8], s: [4, 12], sn: 'clap', h: [2, 6, 10, 14], acc: 0, sh: true, bass: [[0, 3, 0], [3, 3, 0], [6, 2, 12], [8, 3, 0], [11, 3, 7], [14, 2, 0]] },
    tropical: { k: [0, 4, 8, 12], s: [4, 12], sn: 'clap', h: [2, 6, 10, 14], acc: 0, sh: true, bass: [[0, 2, 0], [2, 2, 12], [6, 2, 0], [8, 2, 0], [10, 2, 12], [14, 2, 7]] },
    bouncy: { k: [0, 3, 8, 10], s: [4, 12], sn: 'snap', h: [0, 2, 4, 6, 8, 10, 12, 14], acc: 2, sh: false, bass: [[0, 2, 0], [3, 2, 7], [6, 1, 12], [8, 2, 0], [11, 2, 7], [14, 1, 12]] },
    half: { k: [0, 11], s: [8], sn: 'snap', h: [0, 4, 8, 12], acc: 4, sh: false, bass: [[0, 10, 0], [11, 4, 7]] },
    none: { k: [], s: [], sn: 'snap', h: [], acc: 0, sh: false, bass: [[0, 15, 0]] },
  };
  // Chord comping: [step, length, velocity].
  const COMP = {
    lofi: [[0, 7, 1], [10, 6, 0.7]],
    pop: [[0, 3, 1], [3, 3, 0.8], [6, 2, 0.7], [8, 3, 0.9], [11, 3, 0.75], [14, 2, 0.6]],
    offbeat: [[2, 1, 1], [6, 1, 0.85], [10, 1, 0.95], [14, 1, 0.85]],
    halves: [[0, 8, 1], [8, 8, 0.8]],
    whole: [[0, 16, 1]],
  };
  const C = (s, q) => [s, q];
  // Areas. root: tonic (midi), mode: melody scale, keys: chord instrument, lead: hook voice, lead2: verse melodies.
  const CFG = {
    title: { root: 65, mode: 'major', bpm: 100, swing: 0.04, groove: 'pop', keys: 'ep', compV: 'halves', compC: 'pop', lead: 'vox', lead2: 'pluck', arp: 'pluck', pad: 1, pump: 0.5, tone: 9000, hook: 'title', vol: 0.8,
      v: [[C(5, 'maj9')], [C(7, 'sus')], [C(4, 'm7')], [C(9, 'm9')]], c: [[C(5, 'maj7')], [C(7, 'M')], [C(4, 'm7'), C(9, 'm7')], [C(2, 'm9'), C(7, 'sus')]] },
    pagariari: { root: 63, mode: 'major', bpm: 84, swing: 0.24, groove: 'lofi', keys: 'ep', compV: 'lofi', compC: 'lofi', lead: 'ep', lead2: 'vox', arp: null, pad: 0.6, pump: 0.15, tone: 3200, crackle: true, hook: 'cafe', vol: 0.95,
      v: [[C(2, 'm9')], [C(7, 'd7')], [C(0, 'maj9')], [C(9, 'm7')]], c: [[C(5, 'maj9')], [C(4, 'm7'), C(9, 'm7')], [C(2, 'm9')], [C(7, 'sus'), C(7, 'd7')]] },
    aed: { root: 67, mode: 'major', bpm: 104, swing: 0.06, groove: 'pop', keys: 'ep', compV: 'halves', compC: 'pop', lead: 'mallet', lead2: 'vox', arp: 'pluck', pad: 0.7, pump: 0.35, tone: 9000, hook: 'garden', vol: 0.8,
      v: [[C(0, 'add9')], [C(7, 'M')], [C(9, 'm7')], [C(5, 'maj7')]], c: [[C(5, 'maj7')], [C(0, 'add9')], [C(7, 'sus'), C(7, 'M')], [C(9, 'm7')]] },
    sadam: { root: 57, mode: 'aeolian', bpm: 110, swing: 0, groove: 'tropical', keys: 'pluck', compV: 'offbeat', compC: 'offbeat', lead: 'vox', lead2: 'mallet', arp: null, pad: 1, pump: 0.6, tone: 9000, hook: 'harbour', vol: 1.1, bassV: 0.75,
      v: [[C(0, 'm7')], [C(8, 'maj7')], [C(3, 'add9')], [C(10, 'M')]], c: [[C(5, 'm7')], [C(8, 'maj7')], [C(3, 'add9')], [C(10, 'sus'), C(10, 'M')]] },
    tuuleveski: { root: 62, mode: 'mixo', bpm: 96, swing: 0.1, groove: 'bouncy', keys: 'ep', compV: 'pop', compC: 'pop', lead: 'pluck', lead2: 'vox', arp: 'mallet', pad: 0.6, pump: 0.3, tone: 8000, hook: 'mill', vol: 0.85,
      v: [[C(0, 'M')], [C(10, 'add9')], [C(5, 'maj7')], [C(0, 'add9')]], c: [[C(5, 'maj7')], [C(7, 'm7')], [C(10, 'M')], [C(0, 'add9'), C(7, 'm7')]] },
    majakas: { root: 58, mode: 'major', bpm: 78, swing: 0.08, groove: 'half', keys: 'ep', compV: 'whole', compC: 'halves', lead: 'bell', lead2: 'vox', arp: 'mallet', pad: 1, pump: 0.25, tone: 6000, hook: 'light', vol: 0.95,
      v: [[C(0, 'maj9')], [C(5, 'maj9')], [C(9, 'm9')], [C(7, 'sus')]], c: [[C(5, 'maj7')], [C(7, 'add9')], [C(4, 'm7')], [C(9, 'm9')]] },
    saladus: { root: 62, mode: 'aeolian', bpm: 76, swing: 0.18, groove: 'lofi', keys: 'ep', compV: 'lofi', compC: 'halves', lead: 'vox', lead2: 'bell', arp: 'mallet', pad: 1, pump: 0.2, tone: 2600, crackle: true, hook: 'secret', vol: 0.95,
      v: [[C(0, 'm9')], [C(8, 'maj7')], [C(5, 'maj7')], [C(7, 'sus'), C(7, 'm7')]], c: [[C(8, 'maj7')], [C(10, 'add9')], [C(0, 'm9')], [C(7, 'sus')]] },
    story: { root: 60, mode: 'major', bpm: 72, swing: 0.06, groove: 'none', keys: 'ep', compV: 'whole', compC: 'halves', lead: 'bell', lead2: 'ep', arp: 'mallet', pad: 1, pump: 0, tone: 5000, hook: 'story', vol: 1.1, story: true,
      v: [[C(0, 'maj9')], [C(9, 'm9')], [C(5, 'maj9')], [C(7, 'sus')]], c: [[C(5, 'maj7')], [C(4, 'm7')], [C(9, 'm9')], [C(7, 'sus'), C(7, 'M')]] },
  };
  const ALIAS = { bakery: 'pagariari', pagar: 'pagariari', cafe: 'pagariari', kohvik: 'pagariari', garden: 'aed', harbour: 'sadam', harbor: 'sadam', windmill: 'tuuleveski', veski: 'tuuleveski', lighthouse: 'majakas', secret: 'saladus' };
  const ORDER = ['pagariari', 'aed', 'sadam', 'tuuleveski', 'majakas', 'saladus'];
  function normArea(a) {
    if (typeof a === 'number') return ORDER[cl(a | 0, 0, 5)];
    let s = String(a || '').toLowerCase().replace(/[äâ]/g, 'a').replace(/[õöó]/g, 'o').replace(/ü/g, 'u').replace(/[^a-z]/g, '');
    if (ALIAS[s]) s = ALIAS[s];
    return hasOwn(CFG, s) && s !== 'title' && s !== 'story' ? s : 'pagariari';
  }
  const LEADV = { vox: 0.3, pluck: 0.085, mallet: 0.11, bell: 0.075, ep: 0.1 };
  const MU = { E: null, want: null, key: '', sinceRest: 0, restAt: 190 };
  function degMidi(c, d, base) { const s = SCALE[c.mode], o = Math.floor(d / 7), i = d - o * 7; return base + 12 * o + s[i]; }
  function voicing(c, ch) { // chord tones (root dropped from 4+ note chords; the bass has it) in a mid window
    const iv = Q[ch[1]], lo = fold(c.root, 55, 67) - 3, out = [];
    for (const k of iv) { if (iv.length >= 4 && k === 0) continue; const m = fold(c.root + ch[0] + k, lo, lo + 14); if (out.indexOf(m) < 0) out.push(m); }
    return out.sort((a, b) => a - b);
  }
  const pcs = (c, ch) => Q[ch[1]].map((k) => (((c.root + ch[0] + k) % 12) + 12) % 12);
  const leadBase = (c) => fold(c.root, 64, 76);
  // Hook bars -> notes [step, midi, len, degree, vowel]
  function hookBar(c, bar, shift) {
    const base = leadBase(c), vw = ['a', 'o', 'a', 'e', 'o', 'u'];
    return bar.map((n, i) => { const d = n[1] + (shift && shift[i] ? shift[i] : 0); return [n[0], degMidi(c, d, base), n[2], d, vw[(i + (n[0] >> 2)) % vw.length]]; });
  }
  function hookMel(E, varied) {
    const c = E.c, H = HOOK[c.hook], A = hookBar(c, H.a), B1 = hookBar(c, H.b1), B2 = hookBar(c, H.b2), out = [A, B1, A, B2];
    if (!varied) return out.concat(out);
    // Second half: the call bar is re-sung with a couple of notes nudged (the last one stays home).
    const sh = H.b1.map((n, i) => (i < H.b1.length - 1 && rnd() < 0.35 ? pick([-1, 1, 2]) : 0));
    const sa = H.a.map((n, i) => (i > 1 && rnd() < 0.2 ? pick([-1, 1]) : 0));
    return out.concat([hookBar(c, H.a, sa), hookBar(c, H.b1, sh), A, B2]);
  }
  // Fresh verse melodies: a 2-bar rhythm motif, repeated with new pitches; strong beats land on chord tones.
  const RHY = {
    sparse: [[[0, 4], [6, 2], [8, 6]], [[2, 2], [4, 4], [10, 2], [12, 4]], [[0, 6], [8, 2], [10, 6]], [[4, 2], [6, 2], [8, 8]], [[0, 3], [3, 5], [12, 4]]],
    busy: [[[0, 2], [2, 1], [3, 3], [6, 2], [8, 2], [10, 2], [12, 4]], [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]], [[2, 2], [4, 2], [6, 1], [7, 3], [10, 2], [12, 2], [14, 2]], [[0, 1], [2, 1], [3, 1], [4, 4], [8, 1], [10, 1], [11, 1], [12, 4]]],
  };
  function genMel(E, prog, n, dens) {
    const c = E.c, base = leadBase(c), out = [], vw = ['a', 'o', 'e', 'a', 'u'];
    let d = E.prev, motif = null;
    for (let b = 0; b < n; b++) {
      if (b % 2 === 0) motif = [pick(RHY[dens]), pick(RHY[dens])];
      const rh = motif[b % 2], bar = [], ch = prog[b % prog.length];
      rh.forEach((r, j) => {
        const s = r[0], cc = ch.length > 1 && s >= 8 ? ch[1] : ch[0], P = pcs(c, cc);
        d += pick([-2, -1, -1, 1, 1, 2, 0, 3]); d = cl(d, 0, 9);
        if (s % 4 === 0 || (b % 2 === 1 && j === rh.length - 1)) { let best = d, bd = 99; for (let k = 0; k <= 10; k++) { const pc = ((degMidi(c, k, base) % 12) + 12) % 12; if (P.indexOf(pc) >= 0 && Math.abs(k - d) < bd) { bd = Math.abs(k - d); best = k; } } d = best; }
        if (dens === 'sparse' && j > 0 && rnd() < 0.12) return;
        bar.push([s, degMidi(c, d, base), r[1], d, vw[(j + b) % vw.length]]);
      });
      out.push(bar);
    }
    E.prev = d; return out;
  }
  function section(E, type) {
    const c = E.c, S = { type: type, n: 8, prog: c.v, comp: c.compV, keys: true, dr: 0, bass: true, pad: false, arp: false, mel: null, lead: null, harm: false, dbl: false, lv: 1, filt: null, fill: false, riser: false };
    if (type === 'intro') { S.n = 4; S.comp = 'whole'; S.bass = E.cycle > 0; S.pad = true; S.filt = [450, c.tone]; if (E.cycle > 0) { S.mel = hookMel(E, false).slice(0, 4); S.lead = 'bell'; S.lv = 0.6; } }
    else if (type === 'verse') { S.dr = 1; S.mel = genMel(E, S.prog, 8, 'sparse'); S.lead = c.lead2; S.lv = 0.75; }
    else if (type === 'verse2') { S.dr = 2; S.mel = genMel(E, S.prog, 8, 'busy'); S.lead = c.lead2 === 'vox' ? c.lead : c.lead2; S.lv = 0.75; S.arp = !!c.arp; }
    else if (type === 'pre') { S.n = 4; S.dr = 1; S.pad = true; S.riser = true; S.fill = true; S.filt = [c.tone * 0.35, c.tone]; S.comp = c.compC; }
    else if (type === 'chorus' || type === 'chorus2') { S.prog = c.c; S.comp = c.compC; S.dr = 2; S.pad = true; S.mel = hookMel(E, type === 'chorus2'); S.lead = c.lead; S.dbl = c.lead === 'vox'; S.harm = type === 'chorus2' && E.cycle > 0 && !LITE; S.arp = !!c.arp; S.fill = true; S.lv = 0.82; if (LITE) S.dbl = false; }
    else if (type === 'break') { S.n = 4; S.prog = c.c; S.comp = 'whole'; S.dr = 0; S.bass = false; S.pad = true; S.mel = hookMel(E, false).slice(4); S.lead = c.lead === 'bell' ? 'mallet' : 'bell'; S.lv = 0.75; S.filt = [Math.min(1800, c.tone), Math.min(1800, c.tone)]; }
    else if (type === 'outro') { S.n = 2; S.prog = [[c.v[0][0]], [c.v[0][0]]]; S.comp = 'whole'; S.pad = true; S.lv = 0.85; }
    else if (type === 'rest') { S.n = 4; S.comp = 'whole'; S.bass = false; S.pad = true; S.lv = 0.6; S.filt = [1400, 1400]; }
    else if (type === 'hush') { S.n = Math.max(2, Math.ceil(9 / E.bar)); S.keys = false; S.bass = false; }
    if (c.story) { S.dr = 0; S.fill = false; S.riser = false; if (S.lead === 'vox') S.lead = 'bell'; S.dbl = false; if (type === 'chorus' || type === 'chorus2') S.lv = 0.85; }
    if (c.groove === 'none') S.dr = 0;
    return S;
  }
  function form(E) {
    const c = E.c;
    if (c.story) return E.cycle === 0 ? ['intro', 'verse', 'chorus', 'break', 'outro'] : pick([['verse', 'chorus2', 'outro'], ['intro', 'chorus', 'break', 'verse', 'outro']]);
    if (E.cycle === 0) return E.name === 'title' ? ['intro', 'chorus', 'verse', 'pre', 'chorus2', 'break', 'chorus', 'outro'] : ['intro', 'verse', 'pre', 'chorus', 'break', 'verse2', 'chorus2', 'outro'];
    return pick([['verse', 'chorus', 'break', 'chorus2', 'outro'], ['intro', 'verse2', 'pre', 'chorus', 'chorus2', 'outro'], ['verse', 'pre', 'chorus2', 'break', 'verse2', 'chorus', 'outro'], ['intro', 'verse', 'verse2', 'pre', 'chorus', 'break', 'chorus2', 'outro']]);
  }
  function startMusic(key) {
    if (MU.key === key) return;
    MU.key = key;
    const now = ctx.currentTime, old = MU.E;
    if (old) {
      old.dead = true; const g = old.bus.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.setTargetAtTime(0, now, 0.45);
      setTimeout(() => { try { old.bus.disconnect(); } catch (e) {} }, 6000);
    }
    if (!key) { MU.E = null; return; }
    const name = key.indexOf(':') > 0 ? key.split(':')[1] : key, c = CFG[name];
    const e16 = 60 / c.bpm / 4, bus = G(B.music, 0), lp = F(bus, 'lowpass', c.tone, 0.7), inn = G(lp, 1);
    const E = { c: c, name: name, e16: e16, bar: 16 * e16, bus: bus, lp: lp, in: inn, pump: G(inn, 1), t: now + (old ? 0.5 : 0.15), form: null, si: 0, bi: 0, S: null, cycle: 0, prev: 4, bars: 0 };
    E.bus.gain.setValueAtTime(0.0001, now); E.bus.gain.linearRampToValueAtTime(c.vol, now + (old ? 2.2 : 0.8));
    E.form = form(E); MU.E = E; MU.sinceRest = 0; MU.restAt = 170 + rnd() * 70;
  }
  function nextSection(E) {
    if (E.S && E.S.type !== 'rest' && E.S.type !== 'hush') MU.sinceRest += E.S.n * E.bar;
    E.si++;
    if (E.si >= E.form.length) { E.cycle++; E.form = form(E); E.si = 0; }
    // Every few minutes a quiet stretch (a hush, or a few bars of soft pad) before the song comes back.
    if (MU.sinceRest > MU.restAt && E.form[E.si] !== 'outro' && !E.c.story) {
      MU.sinceRest = 0; MU.restAt = 170 + rnd() * 70;
      E.form.splice(E.si, 0, rnd() < 0.4 ? 'hush' : 'rest');
      if (E.form[E.si + 1] !== 'intro') E.form.splice(E.si + 1, 0, 'intro');
    }
  }
  function pumpAt(E, t, depth) { // side-chain: the pad bus ducks on each kick and breathes back
    if (depth <= 0) return; const g = E.pump.gain;
    g.setValueAtTime(1 - depth, t); g.setTargetAtTime(1, t + 0.01, E.e16 * 1.1);
  }
  function playBar(E) {
    if (!E.S || E.bi >= E.S.n) { if (E.S) nextSection(E); E.bi = 0; E.S = section(E, E.form[E.si]); }
    const S = E.S, c = E.c, t0 = E.t, e16 = E.e16, b = E.bi, dest = E.in, lv = S.lv, GR = GROOVE[c.groove];
    const sw = (s) => (s % 2 ? c.swing * e16 : 0), hum = () => rnd() * 0.005, T = (s) => t0 + s * e16 + sw(s);
    const bar = S.prog[b % S.prog.length], chAt = (s) => (bar.length > 1 && s >= 8 ? bar[1] : bar[0]);
    // Tone filter (sweeps open in intros and builds, closes in breaks).
    const lpf = E.lp.frequency;
    if (S.filt) { const a = S.filt[0], z = S.filt[1], f0 = a * Math.pow(z / a, b / S.n), f1 = a * Math.pow(z / a, (b + 1) / S.n); lpf.setValueAtTime(f0, t0); lpf.exponentialRampToValueAtTime(f1, t0 + E.bar); }
    else lpf.setTargetAtTime(c.tone, t0, 0.15);
    // Chords
    if (S.keys && S.comp) {
      const P = COMP[S.comp], kv = (c.keys === 'pluck' ? 0.05 : 0.055) * lv;
      for (const p of P) {
        const s = p[0], V = voicing(c, chAt(s)), len = p[1] * e16 * (c.keys === 'pluck' ? 1 : 0.95);
        for (let i = 0; i < V.length; i++) INS[c.keys](T(s) + i * 0.006 + hum(), V[i], len, kv * p[2] * (S.comp === 'whole' ? 0.85 : 1), dest);
      }
    }
    // Pad (side-chained)
    if (S.pad && c.pad) {
      const halves = bar.length > 1 ? [0, 8] : [0], len = (bar.length > 1 ? 8 : 16) * e16;
      for (const s of halves) for (const m of voicing(c, chAt(s))) INS.pad(t0 + s * e16, m, len - 0.04, 0.02 * c.pad * lv, E.pump);
    }
    // Pump: on the kicks when the drums play, softly on the beat otherwise
    if (c.pump > 0) { if (S.dr && GR.k.length) { for (const s of GR.k) pumpAt(E, T(s), c.pump); } else if (S.pad) for (let s = 0; s < 16; s += 4) pumpAt(E, T(s), c.pump * 0.4); }
    // Arpeggio
    if (S.arp && c.arp) {
      const pat = [0, 1, 2, 3, 2, 1, 2, 3], slow = c.groove === 'half' || c.groove === 'lofi';
      for (let i = 0; i < 8; i++) { if (slow && i % 2) continue; const s = i * 2, V = voicing(c, chAt(s)); INS[c.arp](T(s) + hum(), V[pat[i] % V.length] + 12, e16 * 2, (c.arp === 'mallet' ? 0.045 : 0.03) * lv, dest, i % 2 ? 0.25 : -0.25); }
    }
    // Bass
    if (S.bass) {
      const bm = (s, k) => fold(c.root + chAt(s)[0] + k, 41, 53);
      const line = S.dr ? GR.bass : [[0, 15, 0]];
      for (const n of line) INS.bass(T(n[0]), bm(n[0], n[2]), n[1] * e16 * 0.9, 0.14 * (c.bassV || 1) * lv * (n[2] === 12 ? 0.8 : 1), E.pump);
    }
    // Lead
    if (S.mel && S.lead) {
      const notes = S.mel[b % S.mel.length], I = INS[S.lead], lift = S.lead === 'bell' ? 12 : 0, v = LEADV[S.lead] * lv;
      for (const n of notes) {
        const t = T(n[0]) + hum(), d = n[2] * e16 * (S.lead === 'vox' ? 0.7 : 0.92), m = n[1] + lift;
        I(t, m, d, v * (n[0] % 4 === 0 ? 1 : 0.88), dest, S.lead === 'vox' ? n[4] : 0);
        if (S.dbl) INS.pluck(t, m + 12, d, 0.03 * lv, dest, 0.2);
        if (S.harm) INS[S.lead === 'vox' ? 'mallet' : 'bell'](t + 0.01, degMidi(c, n[3] - 2, leadBase(c)) + (S.lead === 'vox' ? 0 : 12), d, 0.035 * lv, dest, -0.2);
      }
    }
    // Drums
    if (S.dr) {
      const last = b === S.n - 1, full = S.dr >= 2, fillOn = last && S.fill;
      for (let s = 0; s < 16; s++) {
        const t = T(s);
        if (fillOn && s >= 12) { INS.snap(t, 0.05 + (s - 12) * 0.012, dest); if (s === 12) INS.kick(t, 0.2, dest); continue; }
        if (GR.k.indexOf(s) >= 0) INS.kick(t, (s === 0 ? 0.22 : 0.17) * (c.groove === 'tropical' && s ? 0.85 : 1), dest);
        if (GR.s.indexOf(s) >= 0) INS[GR.sn](t, GR.sn === 'clap' ? 0.075 : GR.sn === 'snare' ? 0.07 : 0.08, dest);
        if (full && GR.h.indexOf(s) >= 0) INS.hat(t, (GR.acc && s % GR.acc === 0 ? 0.028 : 0.019) * (c.groove === 'half' ? 0.8 : 1), dest);
        if (full && GR.sh && s % 2 === 1) INS.shaker(t, 0.011, dest);
      }
      if (b % 4 === 3 && !fillOn && full) INS.kick(T(14), 0.14, dest);
    }
    if (S.riser && b === S.n - 1) noise(t0, { f: 400, f2: 3200, q: 1.2, a: E.bar * 0.9, d: 0.08, v: 0.03, dest: dest });
    if (c.crackle && !LITE && S.type !== 'hush') for (let i = 0; i < 3; i++) noise(t0 + rnd() * E.bar, { type: 'highpass', f: 2500, q: 0.5, a: 0.001, d: 0.003, v: 0.006 + rnd() * 0.008, dest: dest });
    E.bi++; E.bars++; E.t += E.bar;
  }
  function musicTick() {
    const E = MU.E; if (!E || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (E.t < now - 0.05) E.t = now + 0.08; // after a suspend: pick up from now
    let guard = 0;
    while (E.t < now + 0.35 && guard++ < 4) { try { playBar(E); } catch (e) { ST.err = 'music: ' + e.message; E.t += E.bar; } }
  }
  const MUSIC = {
    // MUSIC.scene('title' | 'board' | 'story' | null, {area}) — crossfades; the same scene again is a no-op.
    scene(name, opts) {
      let key = '';
      if (name === 'title' || name === 'story') key = name;
      else if (name === 'board') key = 'board:' + normArea(opts && opts.area);
      MU.want = key;
      if (ctx && api.ready) startMusic(key);
      return key;
    },
    stop() { return MUSIC.scene(null); },
    get current() { return MU.key; },
    areas: ORDER.slice(),
  };

  // ---------- graph, unlock, hide/show ----------
  function softClip() { // input pre-scaled by 0.5: linear to 0.68, then bends to a 0.88 ceiling (about -1.1 dBFS)
    const n = 4097, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const u = (i / (n - 1) * 2 - 1) * 2, a = Math.abs(u); c[i] = Math.sign(u) * (a < 0.68 ? a : 0.68 + 0.2 * Math.tanh((a - 0.68) / 0.2)); }
    return c;
  }
  function impulse(secs) { // a small warm room, generated
    const len = Math.round(sr * secs), b = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const x = i / len; lp += 0.35 * ((rnd() * 2 - 1) - lp); d[i] = lp * Math.pow(1 - x, 2.6) * (i < sr * 0.01 ? i / (sr * 0.01) : 1); } }
    return b;
  }
  function build() {
    sr = ctx.sampleRate;
    { const h = [0]; for (let n = 1; n <= 14; n++) h.push((1 / n) * (n > 8 ? 0.6 : 1)); WV.saw = wave(h); } // soft saw
    WV.ep = wave([0, 1, 0.3, 0.08, 0.06, 0.02]); // lite electric piano
    WV.bass = wave([0, 1, 0.55, 0.3, 0.12, 0.05]);
    NB = ctx.createBuffer(1, sr * 2, sr); { const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
    const clip = ctx.createWaveShaper(); clip.curve = softClip(); clip.oversample = 'none'; clip.connect(ctx.destination); B.clip = clip;
    const pre = G(clip, 0.5);
    const lim = ctx.createDynamicsCompressor(); ST.made++;
    lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25; lim.connect(pre);
    // Kind to phone speakers: cut what they can't play (steeper on phones), soften the top, no harsh highs.
    const hpF = PHONE ? 110 : 55, shelf = F(lim, 'highshelf', 4500); shelf.gain.value = -5;
    const top = F(shelf, 'lowpass', 10000, 0.5), hp2 = F(top, 'highpass', hpF, 0.7), hp1 = F(hp2, 'highpass', hpF, 0.7);
    B.master = G(hp1, 0.0001); B.master.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.5);
    B.page = G(B.master, 1); B.mute = G(B.page, muted ? 0 : 1);
    // Sounds: a gentle glue so a burst of merges thickens instead of spiking.
    const glue = ctx.createDynamicsCompressor(); ST.made++;
    glue.threshold.value = -16; glue.knee.value = 10; glue.ratio.value = 3; glue.attack.value = 0.004; glue.release.value = 0.2;
    B.sfx = G(B.mute, VOL.sfx); glue.connect(B.sfx); B.sfxIn = G(glue, 1);
    B.duck = G(B.mute, 1); B.music = G(B.duck, 0.55 * VOL.music);
    revSet(!LITE);
  }
  function revSet(on) {
    if (on && !REV) {
      const cv = ctx.createConvolver(); ST.made++; cv.buffer = impulse(1.6);
      const out = G(B.mute, 0.5), hp = F(cv, 'highpass', 200, 0.7); cv.connect(out);
      REV = { cv: cv, out: out, hp: hp, s1: G(hp, 0.32), s2: G(hp, 0.14) };
      B.music.connect(REV.s1); B.sfx.connect(REV.s2);
    } else if (!on && REV) {
      try { B.music.disconnect(REV.s1); B.sfx.disconnect(REV.s2); REV.out.disconnect(); } catch (e) {}
      REV = null;
    }
  }
  function sync() {
    const was = api.ready; api.ready = !!ctx && ctx.state === 'running';
    if (api.ready && !was) { if (B.page && !hidden) { const t = ctx.currentTime; B.page.gain.cancelScheduledValues(t); B.page.gain.setValueAtTime(0.0001, t); B.page.gain.setTargetAtTime(1, t, 0.2); } if (MU.want !== null && MU.key !== MU.want) startMusic(MU.want); }
  }
  function unlock() {
    if (!ctx) {
      const AC = W.AudioContext || W.webkitAudioContext; if (!AC) return false;
      try { if (NAV.audioSession) NAV.audioSession.type = 'playback'; } catch (e) {}
      try { ctx = new AC({ latencyHint: LITE ? 'balanced' : 'interactive' }); build(); ctx.onstatechange = sync; timer = setInterval(tick, 100); }
      catch (e) { ST.err = 'unlock: ' + e.message; try { if (ctx && ctx.close) ctx.close(); } catch (e2) {} ctx = null; api.ready = false; return false; }
    }
    if (ctx.state !== 'running' && !hidden) {
      // Older iPhones only unlock when a sound starts inside the gesture: a one-sample silent buffer does it.
      try { const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, sr); b.connect(ctx.destination); b.start(0); } catch (e) {}
      if (ctx.resume) { const p = ctx.resume(); if (p && p.then) p.then(sync, () => {}); }
    }
    sync();
    return api.ready;
  }
  function setHidden(h) {
    hidden = !!h; if (!ctx || !B.page) return;
    clearTimeout(hideTimer);
    const now = ctx.currentTime;
    if (hidden) {
      B.page.gain.cancelScheduledValues(now); B.page.gain.setTargetAtTime(0, now, 0.03);
      hideTimer = setTimeout(() => { if (hidden && ctx.state === 'running' && ctx.suspend) { const p = ctx.suspend(); if (p && p.then) p.then(sync, () => {}); } }, 220);
    } else {
      const up = () => { sync(); if (!hidden && ctx.state === 'running') { const t = ctx.currentTime; B.page.gain.cancelScheduledValues(t); B.page.gain.setValueAtTime(0.0001, t); B.page.gain.setTargetAtTime(1, t, 0.25); } };
      if (ctx.state !== 'running' && ctx.state !== 'closed' && ctx.resume) { const p = ctx.resume(); if (p && p.then) p.then(up, up); else up(); } else up();
    }
  }
  if (DOC) {
    DOC.addEventListener('visibilitychange', () => setHidden(DOC.visibilityState === 'hidden'));
    W.addEventListener && W.addEventListener('pagehide', () => setHidden(true));
    W.addEventListener && W.addEventListener('pageshow', () => { if (DOC.visibilityState !== 'hidden') setHidden(false); });
    // Safety net: unlock on the first gesture even if the game forgets (the game calls AU.unlock() too).
    const ev = ['pointerdown', 'touchend', 'click', 'keydown'], gest = () => { if (unlock()) ev.forEach((e) => W.removeEventListener(e, gest, true)); };
    if (W.addEventListener) ev.forEach((e) => W.addEventListener(e, gest, true));
  }
  function tick() {
    if (!ctx) return;
    musicTick(); meterTick();
    const now = performance.now(); if (now - ST.nrT >= 5000) { const r = (ST.made - ST.nrMade) * 1000 / (now - ST.nrT || 1); ST.nodeRate = Math.round(ST.nrT ? (ST.nodeRate ? 0.5 * ST.nodeRate + 0.5 * r : r) : 0); ST.nrMade = ST.made; ST.nrT = now; } // nodes per second, averaged over 5 s windows
  }
  function setVolume(kind, v) {
    if (!hasOwn(VOL, kind)) return;
    VOL[kind] = cl(+v || 0, 0, 1);
    if (!ctx) return;
    const now = ctx.currentTime;
    if (kind === 'music') B.music.gain.setTargetAtTime(0.55 * VOL.music, now, 0.05);
    else B.sfx.gain.setTargetAtTime(VOL.sfx, now, 0.05);
  }
  function setMuted(b) {
    muted = !!b;
    if (ctx && B.mute) B.mute.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.04);
    return muted;
  }
  function setLite(b) { LITE = !!b; if (ctx) revSet(!LITE); return LITE; }

  // ---------- meter for tests (built only when AU.meter(true) is called): peak, approx. LUFS, band shares ----------
  const MT = { an: null, buf: null, sp: null, on: false, max: 0, t0: 0, sub: [], blk: [], acc: 0, accN: 0, band: [0, 0, 0, 0, 0], smp: 0, sPk: 0, n: 0 };
  const MT_BANDS = [[0, 150], [150, 500], [500, 2500], [2500, 6000], [6000, 0]], MT_NAMES = ['sub', 'low', 'mid', 'pres', 'air'];
  function meterTap() {
    const NBD = MT_BANDS.length, mg = ctx.createChannelMerger(4 + NBD), spl = ctx.createChannelSplitter(2);
    B.clip.connect(spl);
    for (let c = 0; c < 2; c++) { const hs = F(null, 'highshelf', 1500); hs.gain.value = 4; spl.connect(hs, c); hs.connect(F(null, 'highpass', 38, 0.5)).connect(mg, 0, c); spl.connect(mg, c, 2 + c); }
    const mono = G(null, 1); mono.channelCount = 1; mono.channelCountMode = 'explicit'; B.clip.connect(mono);
    for (let b = 0; b < NBD; b++) { let n = mono; const lo = MT_BANDS[b][0], hi = MT_BANDS[b][1]; if (lo) n = n.connect(F(null, 'highpass', lo, 0.707)).connect(F(null, 'highpass', lo, 0.707)); if (hi) n = n.connect(F(null, 'lowpass', hi, 0.707)).connect(F(null, 'lowpass', hi, 0.707)); n.connect(mg, 0, 4 + b); }
    const sp = ctx.createScriptProcessor(4096, 4 + NBD, 1), blkLen = Math.round(sr * 0.1);
    mg.connect(sp); sp.connect(G(ctx.destination, 0));
    sp.onaudioprocess = (ev) => {
      if (!MT.on) return;
      const I = ev.inputBuffer, kl = I.getChannelData(0), kr = I.getChannelData(1), l = I.getChannelData(2), r = I.getChannelData(3), len = kl.length;
      let pk = MT.sPk;
      for (let i = 0; i < len; i++) {
        const a = Math.max(Math.abs(l[i]), Math.abs(r[i])); if (a > pk) pk = a;
        MT.acc += kl[i] * kl[i] + kr[i] * kr[i];
        if (++MT.accN >= blkLen) { MT.sub.push(MT.acc / MT.accN); MT.acc = 0; MT.accN = 0; if (MT.sub.length >= 4) { const s = MT.sub; MT.blk.push((s[s.length - 1] + s[s.length - 2] + s[s.length - 3] + s[s.length - 4]) / 4); if (s.length > 8) s.splice(0, 4); } }
      }
      MT.sPk = pk;
      for (let b = 0; b < NBD; b++) { const d = I.getChannelData(4 + b); let ss = 0; for (let i = 0; i < len; i++) ss += d[i] * d[i]; MT.band[b] += ss; }
      MT.smp += len;
    };
    MT.sp = sp;
  }
  function meter(on) {
    if (!ctx || !B.clip) return false;
    on = on !== false;
    if (on && !MT.sp && ctx.createScriptProcessor) { try { meterTap(); } catch (e) { ST.err = 'meter: ' + e.message; } }
    if (on && !MT.an) { MT.an = ctx.createAnalyser(); MT.an.fftSize = 2048; MT.buf = new Float32Array(2048); B.clip.connect(MT.an); }
    MT.on = on; MT.max = 0; MT.t0 = ctx.currentTime; MT.sub.length = 0; MT.blk.length = 0; MT.acc = 0; MT.accN = 0; MT.smp = 0; MT.sPk = 0; MT.n = 0; MT.band.fill(0);
    return on;
  }
  function meterTick() { if (!MT.on || !MT.an) return; MT.an.getFloatTimeDomainData(MT.buf); for (let i = 0; i < MT.buf.length; i++) { const a = Math.abs(MT.buf[i]); if (a > MT.max) MT.max = a; } MT.n++; }
  const db = (x) => (x > 1e-6 ? +(20 * Math.log10(x)).toFixed(1) : -120), lufs = (ms) => (ms > 1e-12 ? -0.691 + 10 * Math.log10(ms) : -120);
  function meterOut() {
    if (!MT.on) return null;
    const o = { secs: +(ctx.currentTime - MT.t0).toFixed(1), tp: db(Math.max(MT.sPk, MT.max)) }, Bk = MT.blk;
    if (Bk.length) {
      let s = 0, n = 0, mx = 0; for (const x of Bk) { if (x > mx) mx = x; if (lufs(x) > -70) { s += x; n++; } }
      o.mMax = +lufs(mx).toFixed(1);
      if (n) { const rel = lufs(s / n) - 10; s = 0; n = 0; for (const x of Bk) { const v = lufs(x); if (v > -70 && v > rel) { s += x; n++; } } o.lufs = n ? +lufs(s / n).toFixed(1) : -120; } else o.lufs = -120;
    }
    let tot = 0; for (const x of MT.band) tot += x; o.bands = {}; MT_NAMES.forEach((k, i) => { o.bands[k] = tot > 0 ? Math.round(100 * MT.band[i] / tot) : 0; });
    return o;
  }
  const S_KEYS = (E) => (E.S.keys && E.S.comp ? E.c.keys + '/' + E.S.comp : '-') + (E.S.dr ? ' drums:' + E.c.groove : '');
  function stats() {
    const now = ctx ? ctx.currentTime : 0; let live = 0; for (const a of act) if (a.end > now) live++;
    const E = MU.E;
    return { ready: api.ready, state: ctx ? ctx.state : 'none', muted: muted, hidden: hidden, lite: LITE, phone: PHONE, vol: Object.assign({}, VOL), music: MU.key, section: E && E.S ? E.S.type + ' bar' + E.bi + '/' + E.S.n + ' cycle' + E.cycle + ' lead:' + (E.S.lead || '-') + ' keys:' + (S_KEYS(E)) : '', bars: E ? E.bars : 0, sinceRest: Math.round(MU.sinceRest), sfxLive: live, made: ST.made, nodeRate: ST.nodeRate, dropped: ST.dropped, names: Object.assign({}, ST.names), err: ST.err, reverb: !!REV, meter: meterOut() };
  }

  const api = { ready: false, unlock: unlock, setVolume: setVolume, setMuted: setMuted, setLite: setLite, stats: stats, sfx: sfx, meter: meter, music: MUSIC, sounds: Object.keys(SFX), who: Object.keys(WHO), setHidden: setHidden, suspend: () => setHidden(true), resume: () => { if (!DOC || DOC.visibilityState !== 'hidden') setHidden(false); } };
  Object.defineProperty(api, 'muted', { get: () => muted, set: setMuted, enumerable: true });
  Object.defineProperty(api, 'lite', { get: () => LITE, set: setLite, enumerable: true });
  Object.defineProperty(api, 'volume', { get: () => Object.assign({}, VOL), enumerable: true });
  return api;
})();
const MUSIC = AU.music;
function sfx(name, opts) { return AU.sfx(name, opts); }
try { window.__saAudio = AU; window.__saMusic = MUSIC; } catch (e) {}
