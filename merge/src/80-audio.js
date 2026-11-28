// ---- Saarepagar audio (Echo): every sound and all the music, synthesized with WebAudio. No files, no network.
// API (DESIGN.md):  sfx(name, opts)   MUSIC.scene(name, {area})   AU.unlock()
//   v3: MUSIC.scene('map')   MUSIC.scene('level', {chapter | level, tense})   MUSIC.mood('tense'|'normal')
//       sfx: iceCrack boxBreak cobweb booster{kind: wand|scissors|shuffle|moves5} wheelTick{speed 0..1} wheelWin{big}
//            levelWin{stars 1..3} levelFail star{n 1..3} piggy calendar heart movesLow   AU.setVolume('music'|'sfx', v)
//                   AU.muted / AU.setMuted(b)   AU.stats()   AU.lite (no reverb, fewer nodes; auto on <= 4 cores)
//                   AU.suspend() / AU.resume() (same as a hidden / shown page)
//   v3 phase B: MUSIC.scene('board', {area, tour: theme}) with theme flower|spa|icecream|fashion|wedding|beach|xmas|orchard
//       (also an Estonian name, an island object {theme} or an index; anything else falls back to the area's song)
//       MUSIC.scene('event', {week: garden|fashion|wedding|beach}) (unknown -> garden)
//       MUSIC.season(key) winter|spring|summer|autumn|'auto' (default: from the date; URL flag season=), layered on every scene
//       sfx: passStep{n} styleSwap{style: boho|minimal|romantic} wardrobe pet{kind: muri|kutsu|janku} eventCur{n, week}
//            photo islandNew. Unknown sound names and unknown options never throw (sfx returns false).
//   v3 phase C: the context sleeps (suspended: no CPU, no audio hardware) when the page is hidden, when muted or both volumes
//       are 0 ('silent'), after AU.setIdle(ms) (default 4 min) without a touch ('idle': the music fades out first and starts
//       again from its intro on the next touch) and after 15 s with no music and no sound ('quiet': the next sound wakes it).
//       Every touch also resumes a context an iPhone interruption (a call, Siri) left suspended. Music volume 0 writes no notes.
//       Music bars and the tails of long jingles are built just in time (a look-ahead that grows after main-thread stalls),
//       so a slow phone never gets a 100-node burst in one frame. AU.timing() / AU.resetTiming() (late notes, skipped bars,
//       worst update gap, audio JS ms per second), AU.render({scene, secs, lite, phone, events, seed}) renders offline.
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
  let rnd = Math.random; const pick = (a) => a[(rnd() * a.length) | 0]; // rnd: seeded during AU.render({seed})
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const fold = (m, lo, hi) => { while (m < lo) m += 12; while (m >= hi) m -= 12; return m; };
  let LITE = NAV.hardwareConcurrency > 0 && NAV.hardwareConcurrency <= 4;
  // Android phones get the 'balanced' output buffer: a few ms more latency, far fewer underruns on a busy cheap phone.
  const ANDROID = /Android/i.test(NAV.userAgent || '');
  let PHONE = false; try { PHONE = !!(W.matchMedia && W.matchMedia('(pointer: coarse)').matches); } catch (e) {}
  // iPhone: play like media, so the silent switch doesn't mute the game. Set early and again at unlock.
  try { if (NAV.audioSession) NAV.audioSession.type = 'playback'; } catch (e) {}

  let ctx = null, sr = 48000, NB = null, REV = null, hidden = false, hideTimer = 0, timer = 0;
  const B = {}; // buses
  const WV = {}; // periodic waves
  const VOL = { music: 1, sfx: 1 };
  const ST = { names: {}, made: 0, dropped: 0, err: '', nodeRate: 0, nrMade: 0, nrT: 0, live: 0 }; // live: started sources not yet ended
  const act = []; // live sfx events {name, end}
  let muted = false;
  const PNOW = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // Timing (phase C, cheap Android): music notes written after their time (late), bars skipped after a stall, the worst
  // gap between scheduler updates, and the main-thread time the audio code takes (ms per second; worst music update, worst sound).
  const TM = { notes: 0, late: 0, lateMax: 0, skips: 0, updMax: 0, last: 0, cpu: 0, cpuMax: 0, sfxMax: 0, t0: PNOW(), look: 0 };
  let inMusic = false; // true while playBar writes notes (only those count toward late)
  // Lifecycle: the context sleeps (suspended, no CPU, no audio hardware) while 'silent' (muted or both volumes at 0),
  // 'idle' (no touch for IDLE ms: the music fades out first) or 'quiet' (no music and no sound for a while).
  let sleepWhy = '', sleepTimer = 0, lastInput = PNOW(), lastSound = PNOW(), IDLE = 240000, fadeTc = 0.2;
  let OFF = null; // offline render in progress (AU.render): its clock replaces ctx.currentTime for ducks

  // ---------- node helpers (each counts toward the node rate, a CPU proxy for weak phones) ----------
  function G(dest, v) { const g = ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); ST.made++; return g; }
  function F(dest, type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; if (dest) b.connect(dest); ST.made++; return b; }
  function O(w, f, t) { const o = ctx.createOscillator(); if (typeof w === 'string') o.type = w; else o.setPeriodicWave(w); o.frequency.setValueAtTime(f, t); ST.made++; return o; }
  function lateChk(t0) { if (!inMusic) return; TM.notes++; const d = ctx.currentTime - t0; if (d > 0.003) { TM.late++; if (d > TM.lateMax) TM.lateMax = d; } }
  function fin(src, t0, t1, last) { lateChk(t0); src.start(t0); src.stop(t1); const on = !OFF; if (on) ST.live++; src.onended = () => { if (on) ST.live--; try { last.disconnect(); } catch (e) {} }; }
  function wave(h) { const re = new Float32Array(h.length), im = new Float32Array(h.length); for (let i = 1; i < h.length; i++) im[i] = h[i]; return ctx.createPeriodicWave(re, im); }
  // Optional stereo spread for sparkles (headphones); skipped in lite.
  // A mono voice into a stereo bus plays at full level on both sides; a StereoPanner (equal power) gives cos/sin, about
  // -3 dB of power. Lite skips the panner, so panned voices get panK (0.707) to stay as loud as in full mode (before this
  // fix lite was up to 3 dB louder on panned parts, so songs without an arpeggio sounded 1.5 dB quieter in lite than the rest).
  const panK = (p) => (p && (LITE || !ctx.createStereoPanner) ? 0.7071 : 1);
  function panTo(dest, p) { if (!p || LITE || !ctx.createStereoPanner) return dest; const s = ctx.createStereoPanner(); s.pan.value = cl(p, -1, 1); s.connect(dest); ST.made++; return s; }

  // One voice: oscillator (glide optional) -> optional low-pass (sweep optional) -> envelope. Returns the end time.
  function tone0(t, o) {
    const a = o.a !== undefined ? o.a : 0.005, d = o.d !== undefined ? o.d : 0.2, h = o.h || 0, v = (o.v || 0.1) * panK(o.pan);
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
  function noise0(t, o) {
    const a = o.a !== undefined ? o.a : 0.003, d = o.d !== undefined ? o.d : 0.08, v = (o.v || 0.05) * panK(o.pan);
    const g = G(panTo(o.dest || B.sfxIn, o.pan), 0), f = F(g, o.type || 'bandpass', o.f || 1000, o.q || 1);
    if (o.f2) { f.frequency.setValueAtTime(o.f, t); f.frequency.exponentialRampToValueAtTime(o.f2, t + a + d); }
    const s = ctx.createBufferSource(); ST.made++; s.buffer = NB; s.connect(f);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0003, t + a + d);
    const len = a + d + 0.03; lateChk(t); if (len > NB.duration - 0.05) { s.loop = true; s.start(t, 0); s.stop(t + len); } else { s.start(t, rnd() * (NB.duration - len - 0.01)); s.stop(t + len); } // start + stop, not start(t, off, duration): Chrome sometimes never ends those (no 'ended': about 1 in 3000 around a suspend) const on = !OFF; if (on) ST.live++; s.onended = () => { if (on) ST.live--; try { g.disconnect(); } catch (e) {} };
    return t + len;
  }

  // ---------- instruments (shared by music and jingles) ----------
  // Spread the work (cheap phones): while a music bar is written (DQ set), voices are queued with their start time instead
  // of being built; musicTick builds them just in time (one look-ahead early), so a bar's 100-300 nodes are made over many
  // updates instead of in one main-thread burst. Sounds (sfx) are always built at once.
  let DQ = null; const FXQ = [];
  function deferable(fn) { return function () { if (DQ) { DQ.push([arguments[0], fn, arguments]); return arguments[0]; } return fn.apply(null, arguments); }; }
  const tone = deferable(tone0), noise = deferable(noise0);
  const VOWEL = { a: [760, 1180], o: [500, 860], e: [560, 1700], u: [380, 820], i: [360, 1950] };
  // Lite drops a partial, a detuned twin or a formant from some voices; these gains keep their loudness level with full mode.
  const LITE_V = { pad: 1.35, stab: 1.35, vox: 1.25, steel: 1.12, mallet: 1.05, bell: 1.05 };
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
      v *= panK(p);
      const f = mtof(m), g = G(panTo(dest, p), 0), top = Math.min(f * 7, 5200), lp = F(g, 'lowpass', top, 2.2), d = 0.16 + Math.min(dur, 0.5) * 0.6;
      lp.frequency.setValueAtTime(top, t); lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.3, 300), t + 0.16);
      const o = O(WV.saw, f, t); o.connect(lp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0003, t + d);
      fin(o, t, t + d + 0.03, g);
    },
    // Marimba-ish mallet: sine plus a fast 4x click partial. 4 nodes (2 in lite).
    mallet(t, m, dur, v, dest, p) {
      if (LITE) v *= LITE_V.mallet;
      const f = mtof(m), d = cl(0.5 - (m - 72) * 0.012, 0.18, 0.6);
      tone(t, { f: f, a: 0.002, d: d, v: v, dest: dest, pan: p });
      if (!LITE && f * 4 < 7000) tone(t, { f: f * 4, a: 0.001, d: 0.04, v: v * 0.22, dest: dest, pan: p });
    },
    // Glassy bell: sine with an inharmonic partial that fades first. 4 nodes (2 in lite).
    bell(t, m, dur, v, dest, p) {
      if (LITE) v *= LITE_V.bell;
      const f = mtof(m), ring = cl(1.3 - (m - 76) * 0.025, 0.45, 1.6);
      tone(t, { f: f, a: 0.002, d: ring, v: v, dest: dest, pan: p });
      if (!LITE && f * 2.76 < 6500) tone(t, { f: f * 2.76, a: 0.001, d: ring * 0.22, v: v * 0.28, dest: dest, pan: p });
    },
    // Warm pad: two detuned soft saws, low-passed, slow attack (sent to the side-chained pump bus). 4 nodes (3 in lite).
    pad(t, m, dur, v, dest) {
      if (LITE) v *= LITE_V.pad;
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
      if (LITE) v *= LITE_V.vox;
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
      if (LITE) v *= LITE_V.stab;
      const f = mtof(m), g = G(dest, 0), lp = F(g, 'lowpass', 900, 1.2), e = t + dur + 0.35;
      lp.frequency.setValueAtTime(700, t); lp.frequency.exponentialRampToValueAtTime(3600, t + 0.03); lp.frequency.exponentialRampToValueAtTime(1300, t + 0.3 + dur * 0.3);
      const o1 = O(WV.saw, f, t); o1.detune.value = -10; o1.connect(lp);
      if (!LITE) { const o2 = O(WV.saw, f, t); o2.detune.value = 11; o2.connect(lp); o2.start(t); o2.stop(e); }
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(v * 0.5, t + 0.2); g.gain.setValueAtTime(v * 0.5, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.3);
      fin(o1, t, e, g);
    },
    // Steel pan (beach themes): a sine with an octave and a soft twelfth that fade first. 6 nodes (2 in lite).
    steel(t, m, dur, v, dest, p) {
      if (LITE) v *= LITE_V.steel;
      const f = mtof(m), d = cl(0.75 - (m - 72) * 0.015, 0.3, 0.9);
      tone(t, { f: f, a: 0.004, d: d, v: v, dest: dest, pan: p });
      if (!LITE && f * 2 < 5000) tone(t, { f: f * 2, a: 0.003, d: d * 0.45, v: v * 0.32, dest: dest, pan: p });
      if (!LITE && f * 3 < 4200) tone(t, { f: f * 3.01, a: 0.002, d: d * 0.2, v: v * 0.1, dest: dest, pan: p });
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
  for (const k of Object.keys(INS)) INS[k] = deferable(INS[k]);

  // ---------- sounds ----------
  const PENT = [0, 2, 4, 7, 9];
  const pent = (i) => 12 * Math.floor(i / 5) + PENT[((i % 5) + 5) % 5];
  // Jingles sit in the song's key: kr(o) = the music's tonic in octave o (C if no music).
  const keyPC = () => (MU.E ? ((MU.E.c.root % 12) + 12) % 12 : 0);
  const kr = (oct) => 12 * oct + keyPC();
  const top = (m, hi) => { while (m >= hi) m -= 12; return m; }; // keep sparkles below a ceiling (no harsh highs)
  let lastMerge = -9, combo = 0;
  function comboStep(t, add) { combo = t - lastMerge < 2.6 ? Math.min(combo + add, 40) : 0; lastMerge = t; return combo; }
  // The merge pop: a pitched "bloop", a clean click and a three-note sparkle. m = midi of the pop.
  // Each call varies a little (phase C: heard thousands of times in a session): a few cents of pitch, the glide, the level,
  // the click's colour and which overtone rings, so no two pops are the same.
  const vary = (x, amt) => x * (1 + (rnd() * 2 - 1) * amt);
  function pop(t, m, v, big) {
    const f = mtof(m) * Math.pow(2, (rnd() - 0.5) * 0.02); v = vary(v, 0.08);
    tone(t, { f: f * vary(0.5, 0.04), f2: f, gt: vary(0.036, 0.25), a: 0.002, d: vary(0.13, 0.15), v: 0.24 * v });
    tone(t + 0.012, { f: f, a: 0.002, d: (big ? 0.45 : 0.3) * vary(1, 0.15), v: 0.08 * v });
    if (!LITE) { const h = rnd() < 0.5 ? 2 : 3; tone(t + 0.012, { f: f * h, a: 0.001, d: 0.06, v: (h === 2 ? 0.018 : 0.012) * v }); }
    noise(t, { f: vary(3000, 0.2), q: 0.8, a: 0.001, d: 0.012, v: 0.05 * v });
  }
  const SPK = [[0, 4, 7, 12, 16, 19, 24], [0, 7, 4, 12, 19, 16, 24], [4, 7, 12, 16, 19, 24, 28], [0, 4, 12, 7, 16, 24, 19]];
  function sparkle(t, m, n, gap, v) { // a different spread of chord tones and a mirrored stereo sweep each time
    const sp = pick(SPK), sw = rnd() < 0.5 ? 1 : -1; gap = vary(gap, 0.15);
    for (let i = 0; i < n; i++) INS.bell(t + i * gap, top(m + sp[i % sp.length], 100), 0.3, v * (1 - i * 0.06) * vary(1, 0.1), B.sfxIn, sw * (i % 3 === 0 ? 0 : i % 3 === 1 ? -0.35 : 0.35));
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
      const k = vary(1, 0.07);
      tone(t, { f: 420 * k, f2: 780 * k * vary(1, 0.04), gt: vary(0.05, 0.2), a: 0.003, d: 0.07, v: vary(0.13, 0.08) });
      noise(t, { f: vary(3200, 0.2), q: 1, a: 0.001, d: 0.01, v: 0.025 });
      return t + 0.1;
    },
    drop(t) { // a soft "thup"
      const k = vary(1, 0.1);
      tone(t, { f: 240 * k, f2: 120 * k * vary(1, 0.06), gt: vary(0.06, 0.2), a: 0.002, d: vary(0.1, 0.15), v: vary(0.26, 0.08) });
      noise(t, { f: vary(2400, 0.25), q: 0.9, a: 0.001, d: 0.012, v: 0.04 });
      if (rnd() < 0.5) tone(t, { w: 'triangle', f: 240 * k * pick([2.5, 3, 3.5]), f2: 180 * k, a: 0.001, d: 0.03, v: 0.035 }); // sometimes a little wood
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
      // a lone merge (no combo) lands on one of three neighbouring notes of the key; in a combo the pitch climbs step by step
      const idx = Math.min(15, c + ((L - 1) >> 2) + (c === 0 ? pick([0, 0, 1, 2]) : 0)), m = kr(4) + 7 + pent(idx);
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
      // It plays on every combo merge (after the merge pop), so it stays a light accent until the 5th, 10th...
      INS.mallet(t + 0.06, top(m, 96), 0.2, 0.06, B.sfxIn, -0.2); if (n >= 3) INS.mallet(t + 0.12, top(m + 7, 98), 0.3, 0.055, B.sfxIn, 0.2);
      if (n >= 4) shimmer(t + 0.05, 0.22, 0.01);
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
      const m = top(kr(5) + pent(((+o.level || 1) - 1) % 5 + pick([0, 1, 2])), 90), k = vary(1, 0.08);
      tone(t, { f: 260 * k, f2: 620 * k, gt: vary(0.04, 0.2), a: 0.002, d: 0.07, v: vary(0.13, 0.08) });
      INS.mallet(t + vary(0.03, 0.3), m, 0.2, vary(0.08, 0.1), B.sfxIn, (rnd() - 0.5) * 0.4);
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
      const k = vary(1, 0.12);
      noise(t, { f: 2200 * k, q: 1.2, a: 0.001, d: 0.03, v: 0.13 });
      tone(t, { f: 1200 * k, f2: 500 * vary(1, 0.1), gt: vary(0.04, 0.2), a: 0.001, d: 0.05, v: 0.14 });
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
      const mo = pick([[7, 12], [7, 12], [4, 9], [9, 14], [2, 7]]), g = vary(0.11, 0.12);
      INS.mallet(t, top(kr(5) + mo[0], 92), 0.2, vary(0.09, 0.08), B.sfxIn, -0.1); INS.mallet(t + g, top(kr(5) + mo[1], 94), 0.3, vary(0.09, 0.08), B.sfxIn, 0.1);
      return t + 0.6;
    },
    orderDone(t) { // "ka-ching": a snap, a two-note mallet and cascading pings
      duck(0.65, 0.9);
      INS.snap(t, 0.09, B.sfxIn);
      const mo = pick([[12, 19], [12, 19], [12, 16], [9, 16], [7, 14]]);
      INS.mallet(t + 0.02, top(kr(5) + mo[0], 94), 0.3, vary(0.1, 0.08), B.sfxIn, -0.1); INS.mallet(t + vary(0.1, 0.12), top(kr(5) + mo[1], 96), 0.4, vary(0.1, 0.08), B.sfxIn, 0.1);
      tone(t, { f: vary(200, 0.06), f2: 110, a: 0.002, d: 0.12, v: 0.1 });
      pings(t + 0.16, pick([3, 4, 4, 5]), kr(6) + pick([7, 4, 9]), vary(0.05, 0.1), 0.045);
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
    tap(t) { const k = vary(1, 0.08); tone(t, { f: 950 * k, f2: 720 * k * vary(1, 0.05), a: 0.001, d: vary(0.028, 0.15), v: vary(0.065, 0.1) }); noise(t, { f: vary(2600, 0.2), q: 1.5, a: 0.001, d: 0.008, v: 0.025 }); return t + 0.05; },
    open(t) { whoosh(t, 0.12, 0.035, true); tone(t + 0.04, { f: 600, f2: 880, gt: 0.05, a: 0.003, d: 0.07, v: 0.07 }); return t + 0.18; },
    close(t) { whoosh(t, 0.12, 0.03, false); tone(t + 0.03, { f: 760, f2: 520, gt: 0.05, a: 0.003, d: 0.07, v: 0.06 }); return t + 0.18; },
    sell(t) { whoosh(t, 0.12, 0.03, false); pings(t + 0.06, 2, kr(6) + 7, 0.05, 0.045); return t + 0.4; },
    deny(t) { // a gentle "uh-uh"
      tone(t, { w: 'triangle', f: 330, a: 0.01, h: 0.05, d: 0.08, v: 0.11, lp: 1300 });
      tone(t + 0.14, { w: 'triangle', f: 294, a: 0.01, h: 0.05, d: 0.12, v: 0.1, lp: 1200 });
      return t + 0.4;
    },
    talk(t, o) { return voice(t, o.who || 'mina', o.ch); },

    // ---- v3 level mode: obstacles, boosters, wheel, level win/fail, map rewards ----
    iceCrack(t) { // crisp little crackles, a soft crunch, then glassy tinkles falling in key
      const n = LITE ? 2 : 4;
      for (let i = 0; i < n; i++) noise(t + i * 0.022 + rnd() * 0.01, { f: 3000 + rnd() * 900, q: 2.2, a: 0.001, d: 0.012 + rnd() * 0.01, v: 0.07, pan: (rnd() - 0.5) * 0.6 });
      noise(t + 0.02, { f: 1700, f2: 900, q: 0.9, a: 0.002, d: 0.09, v: 0.06 });
      tone(t, { w: 'triangle', f: 520, f2: 260, gt: 0.05, a: 0.001, d: 0.06, v: 0.08 });
      const r = kr(6);
      for (let i = 0; i < 3; i++) INS.bell(t + 0.07 + i * 0.05, top(r + pent(5 - i * 2), 98), 0.3, 0.035, B.sfxIn, i === 1 ? -0.35 : 0.35);
      return t + 0.6;
    },
    boxBreak(t) { // a gift box pops open: thump, a paper rip, a pop, then confetti ticks and a sparkle
      duck(0.7, 0.7);
      tone(t, { f: 210, f2: 105, gt: 0.06, a: 0.002, d: 0.12, v: 0.2 });
      noise(t, { f: 1500, f2: 700, q: 1.1, a: 0.004, d: 0.1, v: 0.065 });
      pop(t + 0.06, kr(5) + 7, 1, true);
      const n = LITE ? 4 : 9;
      for (let i = 0; i < n; i++) noise(t + 0.1 + rnd() * 0.45, { type: 'highpass', f: 3800, q: 0.7, a: 0.001, d: 0.006, v: 0.018 + rnd() * 0.016, pan: (rnd() - 0.5) * 1.4 });
      sparkle(t + 0.12, kr(5) + 12, 4, 0.04, 0.04);
      return t + 0.8;
    },
    cobweb(t) { // a sticky stretch ("fwiip") that lets go with a soft snap and a twinkle
      noise(t, { f: 600, f2: 2200, q: 3, a: 0.08, d: 0.05, v: 0.045 });
      tone(t, { w: 'triangle', f: 300, f2: 680, gt: 0.12, a: 0.02, d: 0.1, v: 0.07, lp: 1500 });
      tone(t + 0.13, { f: 980, f2: 520, gt: 0.03, a: 0.001, d: 0.04, v: 0.07 });
      noise(t + 0.13, { f: 2600, q: 1.4, a: 0.001, d: 0.015, v: 0.04 });
      INS.bell(t + 0.17, top(kr(6) + 7, 98), 0.3, 0.035, B.sfxIn, 0.2);
      return t + 0.5;
    },
    booster(t, o) { // wand | scissors | shuffle | moves5
      const k = o.kind || 'wand', r = kr(5);
      if (k === 'scissors') { // snip-snip, then a little split pop
        for (let i = 0; i < 2; i++) { const tt = t + i * 0.13; noise(tt, { f: 4000, q: 3, a: 0.001, d: 0.02, v: 0.08 }); tone(tt, { w: 'triangle', f: 2100, f2: 1500, a: 0.001, d: 0.025, v: 0.035 }); tone(tt + 0.012, { f: 700, f2: 450, a: 0.001, d: 0.03, v: 0.06 }); }
        pop(t + 0.3, r + 7, 0.9, false); pop(t + 0.36, r + 12, 0.8, false);
        return t + 0.75;
      }
      duck(0.6, 1.1);
      if (k === 'shuffle') { // a swirl: blips circling left-right, up then down, landing on a mallet
        whoosh(t, 0.35, 0.04, true); whoosh(t + 0.3, 0.3, 0.035, false);
        const st = [0, 2, 4, 6, 4, 2, 1, 3];
        for (let i = 0; i < st.length; i++) tone(t + i * 0.055, { f: mtof(top(r + 7 + pent(st[i]), 92)), a: 0.002, d: 0.05, v: 0.06, pan: Math.sin(i * 1.4) * 0.6 });
        INS.mallet(t + 0.5, top(r + 12, 94), 0.3, 0.09, B.sfxIn); INS.mallet(t + 0.5, top(r + 7, 94), 0.3, 0.06, B.sfxIn);
        return t + 1;
      }
      if (k === 'moves5') { // counting up five, then a bright "ding"
        for (let i = 0; i < 5; i++) INS.mallet(t + i * 0.065, top(r + pent(i + 2), 96), 0.2, 0.08, B.sfxIn, (i - 2) * 0.15);
        chord(t + 0.36, r, [4, 7, 12], 0.35, 0.022, 'ep'); INS.bell(t + 0.36, top(r + 24, 100), 0.5, 0.045, B.sfxIn);
        shimmer(t + 0.3, 0.3, 0.012);
        return t + 1;
      }
      // wand: a magic rising glissando, a shimmer and a soft bell chord
      whoosh(t, 0.3, 0.035, true); shimmer(t + 0.05, 0.45, 0.016);
      for (let i = 0; i < (LITE ? 6 : 9); i++) INS.bell(t + i * 0.035, top(r + pent(i), 100), 0.3, 0.035, B.sfxIn, -0.5 + i * 0.12);
      INS.bell(t + 0.36, top(r + 12, 100), 0.6, 0.04, B.sfxIn); INS.bell(t + 0.36, top(r + 16, 100), 0.6, 0.03, B.sfxIn);
      tone(t + 0.34, { f: 200, f2: 100, gt: 0.07, a: 0.002, d: 0.15, v: 0.1 });
      return t + 1.1;
    },
    wheelTick(t, o) { // one slice going past: a light click; faster spin = higher and brighter
      const s = cl(o.speed === undefined ? 0.5 : +o.speed || 0, 0, 1), f = 900 + s * 900;
      tone(t, { w: 'triangle', f: f, f2: f * 0.7, a: 0.001, d: 0.022, v: 0.05 + s * 0.02 });
      if (!LITE) noise(t, { f: 2600 + s * 1000, q: 1.6, a: 0.001, d: 0.006, v: 0.02 });
      return t + 0.04;
    },
    wheelWin(t, o) { // the wheel stops on a prize; {big} = the rare jackpot
      const r = kr(5);
      if (o.big) {
        duck(0.35, 2.2);
        fill(t, 4, 0.08, 0.08);
        for (let i = 0; i < 12; i++) INS.bell(t + 0.1 + i * 0.03, top(r + pent(i + 2), 100), 0.3, 0.04, B.sfxIn, -0.6 + i * 0.1);
        const tc = t + 0.5;
        chord(tc, r, [0, 4, 7, 12, 16], 0.8, 0.032); INS.kick(tc, 0.24, B.sfxIn); INS.clap(tc, 0.08, B.sfxIn); INS.bass(tc, r - 12, 0.8, 0.18, B.sfxIn);
        INS.vox(tc, r + 16, 0.12, 0.18, B.sfxIn, 'e'); INS.vox(tc + 0.15, r + 19, 0.35, 0.18, B.sfxIn, 'a');
        pings(tc + 0.1, 6, kr(6) + 4, 0.045, 0.04); sparkle(tc + 0.15, r + 12, 6, 0.05, 0.04); shimmer(tc, 0.7, 0.018);
        return tc + 1.5;
      }
      duck(0.55, 1.2);
      INS.mallet(t, top(r + 12, 96), 0.2, 0.1, B.sfxIn, -0.2); INS.mallet(t + 0.08, top(r + 16, 96), 0.2, 0.1, B.sfxIn); INS.mallet(t + 0.16, top(r + 19, 98), 0.3, 0.1, B.sfxIn, 0.2);
      chord(t + 0.24, r, [0, 4, 7, 12], 0.45, 0.028); INS.kick(t + 0.24, 0.2, B.sfxIn);
      pings(t + 0.3, 4, kr(6) + 4, 0.045, 0.04);
      return t + 1.1;
    },
    levelWin(t, o) { // bright jingle; more stars = a longer, bigger ending
      const st = cl((+o.stars) | 0 || 1, 1, 3), r = kr(5), up = [0, 4, 7, 12];
      duck(0.25, 1.6 + st * 0.5);
      fill(t, 3, 0.09, 0.08);
      for (let i = 0; i < up.length; i++) INS.pluck(t + i * 0.07, r + up[i], 0.1, 0.09, B.sfxIn, (i - 1.5) * 0.15);
      let tc = t + 0.3;
      chord(tc, r, [0, 4, 7, 12], 0.35, 0.03); INS.kick(tc, 0.22, B.sfxIn); INS.clap(tc, 0.07, B.sfxIn); INS.bass(tc, r - 12, 0.35, 0.16, B.sfxIn);
      if (st >= 2) { // IV - V lift
        tc += 0.36; chord(tc, r + 5, [0, 4, 7], 0.14, 0.028); INS.kick(tc, 0.2, B.sfxIn); INS.bass(tc, r - 7, 0.15, 0.14, B.sfxIn);
        tc += 0.2; chord(tc, r + 7, [0, 5, 7], 0.14, 0.028); INS.kick(tc, 0.2, B.sfxIn); INS.bass(tc, r - 5, 0.15, 0.14, B.sfxIn);
        tc += 0.2; chord(tc, r, [0, 4, 7, 12, 14], 0.6 + st * 0.15, 0.032); INS.kick(tc, 0.24, B.sfxIn); INS.clap(tc, 0.08, B.sfxIn); INS.bass(tc, r - 12, 0.7, 0.18, B.sfxIn);
      }
      if (st >= 3) { INS.vox(tc, r + 16, 0.12, 0.18, B.sfxIn, 'e'); INS.vox(tc + 0.15, r + 19, 0.4, 0.18, B.sfxIn, 'a'); shimmer(tc, 0.8, 0.018); }
      sparkle(tc + 0.08, r + 12, 3 + st * 2, 0.045, 0.045);
      return tc + 1 + st * 0.2;
    },
    levelFail(t) { // a kind, soft "aww" and a comforting IV - I, ending on a hopeful little bell
      duck(0.4, 2);
      const r = kr(5);
      tone(t, { w: 'triangle', f: mtof(r + 16), f2: mtof(r + 12), gt: 0.5, a: 0.05, h: 0.15, d: 0.45, v: 0.08, lp: 1700, q: 1.2 });
      if (!LITE) tone(t + 0.01, { w: 'triangle', f: mtof(r + 9), f2: mtof(r + 5), gt: 0.5, a: 0.05, h: 0.15, d: 0.45, v: 0.04, lp: 1400 });
      chord(t + 0.05, r - 12 + 5, [0, 4, 7, 11], 0.6, 0.026, 'ep');
      chord(t + 0.75, r - 12, [4, 7, 11, 14], 0.9, 0.026, 'ep');
      INS.bell(t + 1.15, top(r + 19, 100), 0.5, 0.035, B.sfxIn); INS.bell(t + 1.3, top(r + 24, 100), 0.6, 0.03, B.sfxIn);
      return t + 2;
    },
    star(t, o) { // one of three stars landing; each is a step higher, the third gets a little chord
      const n = cl((+o.n) | 0 || 1, 1, 3), r = kr(5) + 12, m = top(r + [0, 4, 7][n - 1], 100);
      whoosh(t, 0.14, 0.025, true);
      INS.bell(t + 0.08, m, 0.5, 0.055, B.sfxIn, (n - 2) * 0.3); INS.mallet(t + 0.08, m - 12, 0.2, 0.08, B.sfxIn, (n - 2) * 0.3);
      tone(t + 0.08, { f: 190, f2: 100, gt: 0.06, a: 0.002, d: 0.1, v: 0.09 });
      if (n === 3) { chord(t + 0.1, r - 12, [0, 4, 7, 12], 0.4, 0.02, 'ep'); sparkle(t + 0.14, r, 4, 0.035, 0.04); }
      return t + 0.7;
    },
    piggy(t) { // a coin jar shaken a few times, a cork-pop as it opens, coins pour out
      duck(0.55, 1.8);
      for (let i = 0; i < 4; i++) {
        const tt = t + i * 0.11;
        noise(tt, { f: i % 2 ? 900 : 700, q: 1.3, a: 0.002, d: 0.04, v: 0.07 });
        for (let j = 0; j < (LITE ? 1 : 2); j++) tone(tt + 0.01 + j * 0.02, { f: 2300 + rnd() * 800, a: 0.001, d: 0.04, v: 0.025, pan: (rnd() - 0.5) * 0.6 });
      }
      tone(t + 0.5, { f: 400, f2: 900, gt: 0.03, a: 0.001, d: 0.05, v: 0.12 }); noise(t + 0.5, { f: 1800, q: 1, a: 0.001, d: 0.02, v: 0.06 });
      pings(t + 0.55, 6, kr(6) + 4, 0.05, 0.045);
      chord(t + 0.6, kr(5), [0, 4, 7, 12], 0.4, 0.024, 'ep');
      return t + 1.5;
    },
    calendar(t) { // the daily stamp: a swish, a soft "thunk", a paper slap and a happy two-note
      whoosh(t, 0.1, 0.03, false);
      tone(t + 0.1, { f: 190, f2: 85, gt: 0.06, a: 0.002, d: 0.12, v: 0.22 });
      noise(t + 0.1, { f: 1200, q: 0.8, a: 0.001, d: 0.05, v: 0.07 });
      INS.mallet(t + 0.2, top(kr(5) + 7, 94), 0.2, 0.09, B.sfxIn); INS.mallet(t + 0.3, top(kr(5) + 12, 96), 0.3, 0.09, B.sfxIn);
      sparkle(t + 0.34, kr(5) + 12, 3, 0.04, 0.035);
      return t + 0.8;
    },
    heart(t) { // a life refills: a soft heartbeat "ba-dum", a warm rising chord and a twinkle
      duck(0.65, 1);
      tone(t, { f: 180, f2: 95, gt: 0.06, a: 0.003, d: 0.1, v: 0.16 }); tone(t + 0.15, { f: 170, f2: 90, gt: 0.06, a: 0.003, d: 0.12, v: 0.13 });
      const r = kr(5);
      [4, 7, 12].forEach((d, i) => INS.ep(t + 0.3 + i * 0.07, r + d, 0.5 - i * 0.07, 0.06, B.sfxIn));
      INS.bell(t + 0.5, top(r + 24, 100), 0.5, 0.035, B.sfxIn); shimmer(t + 0.3, 0.4, 0.012);
      return t + 1.1;
    },
    movesLow(t) { // a subtle "tick-tock" (woodblock) when 3 or fewer moves are left
      const m = top(kr(6) + 7, 94);
      tone(t, { w: 'triangle', f: mtof(m), a: 0.001, d: 0.045, v: 0.05, lp: 3000 });
      tone(t + 0.13, { w: 'triangle', f: mtof(m - 5), a: 0.001, d: 0.05, v: 0.045, lp: 2600 });
      return t + 0.25;
    },

    // ---- v3 phase B: season pass, design choices, wardrobe, pets, weekly events, photo mode, new islands ----
    passStep(t, o) { // a step on the season track: a soft footstep and a two-note climb; every 5th a little chord, the 30th a fanfare
      const n = Math.max(1, (+o.n || +o.step || 1) | 0), r = kr(5), m = top(r + pent(n % 10), 94), big = n % 5 === 0, last = n >= 30;
      tone(t, { f: 210, f2: 115, gt: 0.05, a: 0.002, d: 0.08, v: 0.13 });
      noise(t, { f: 1800, q: 0.9, a: 0.001, d: 0.02, v: 0.03 });
      INS.mallet(t + 0.03, m, 0.2, 0.085, B.sfxIn, ((n % 3) - 1) * 0.25); INS.mallet(t + 0.1, top(m + 7, 96), 0.25, 0.065, B.sfxIn, ((n % 3) - 1) * 0.25);
      if (!big && !last) return t + 0.45;
      duck(last ? 0.4 : 0.6, last ? 1.6 : 1);
      chord(t + 0.17, r, last ? [0, 4, 7, 12, 14] : [0, 4, 7, 12], last ? 0.6 : 0.35, last ? 0.03 : 0.022, last ? 'stab' : 'ep');
      if (last) { INS.kick(t + 0.17, 0.22, B.sfxIn); INS.clap(t + 0.17, 0.06, B.sfxIn); INS.bass(t + 0.17, r - 12, 0.6, 0.16, B.sfxIn); }
      sparkle(t + 0.2, r + 12, last ? 6 : 4, 0.035, 0.04);
      return t + (last ? 1.4 : 0.9);
    },
    styleSwap(t, o) { // a design choice changes: a swish, the new look's "voice", a soft settle pop
      const st = slug(o.style || o.key || o.choice), r = kr(5);
      whoosh(t, 0.14, 0.032, true);
      if (st === 'boho') { // warm and woody: mallets and a little shaker
        INS.mallet(t + 0.06, top(r + 7, 92), 0.2, 0.08, B.sfxIn, -0.2); INS.mallet(t + 0.13, top(r + 9, 92), 0.2, 0.075, B.sfxIn, 0.1); INS.mallet(t + 0.2, top(r + 14, 94), 0.3, 0.07, B.sfxIn, 0.25);
        noise(t + 0.06, { f: 3800, q: 0.8, a: 0.02, d: 0.05, v: 0.02 }); noise(t + 0.2, { f: 3800, q: 0.8, a: 0.02, d: 0.05, v: 0.018 });
      } else if (st === 'minimal') { // clean: two pure pings, nothing else
        tone(t + 0.07, { f: mtof(top(r + 12, 94)), a: 0.002, d: 0.18, v: 0.06, pan: -0.15 }); tone(t + 0.15, { f: mtof(top(r + 19, 96)), a: 0.002, d: 0.25, v: 0.055, pan: 0.15 });
      } else if (st === 'romantic') { // soft: bells over a gentle electric-piano chord
        chord(t + 0.06, r, [4, 7, 11], 0.4, 0.02, 'ep');
        INS.bell(t + 0.08, top(r + 16, 98), 0.4, 0.04, B.sfxIn, -0.25); INS.bell(t + 0.18, top(r + 19, 98), 0.5, 0.035, B.sfxIn, 0.25); shimmer(t + 0.1, 0.3, 0.008);
      } else { INS.bell(t + 0.07, top(r + 12, 98), 0.3, 0.04, B.sfxIn, -0.2); INS.bell(t + 0.15, top(r + 16, 98), 0.4, 0.035, B.sfxIn, 0.2); }
      pop(t + 0.26, top(r + 7, 86), 0.55, false);
      return t + 0.7;
    },
    wardrobe(t) { // a fabric rustle, a hanger click, a twirl and a little "ta-da"
      const r = kr(5);
      noise(t, { f: 1400, f2: 850, q: 0.7, a: 0.03, d: 0.12, v: 0.045 });
      tone(t + 0.02, { w: 'triangle', f: 2300, f2: 1800, a: 0.001, d: 0.018, v: 0.035 }); noise(t + 0.02, { f: 3000, q: 3, a: 0.001, d: 0.01, v: 0.035 });
      noise(t + 0.13, { f: 900, f2: 1700, q: 0.7, a: 0.04, d: 0.1, v: 0.04 });
      INS.mallet(t + 0.24, top(r + 7, 92), 0.2, 0.08, B.sfxIn, -0.2); INS.mallet(t + 0.33, top(r + 12, 94), 0.3, 0.085, B.sfxIn, 0.2);
      INS.bell(t + 0.36, top(r + 19, 98), 0.4, 0.03, B.sfxIn); shimmer(t + 0.3, 0.3, 0.009);
      return t + 0.85;
    },
    pet(t, o) { return petSound(t, o.kind || o.who || o.pet); },
    eventCur(t, o) { // weekly-event currency: gem-like chimes (each week its own timbre), a light shimmer
      const n = cl((+o.n) | 0 || 3, 1, 6), w = slug(o.week || o.event), ins = { garden: 'mallet', fashion: 'pluck', wedding: 'bell', beach: 'steel' }[w] || 'bell';
      const v = { mallet: 0.07, pluck: 0.06, bell: 0.045, steel: 0.06 }[ins], base = kr(6) + 0, iv = [0, 4, 7, 9, 12, 16];
      for (let i = 0; i < n; i++) INS[ins](t + i * 0.055 + rnd() * 0.006, top(base + iv[i], ins === 'bell' ? 98 : 94), 0.2, v * (1 - i * 0.05), B.sfxIn, i % 2 ? 0.3 : -0.3);
      shimmer(t + 0.02, 0.2 + n * 0.03, 0.009);
      return t + n * 0.055 + 0.4;
    },
    photo(t) { // a camera shutter: a crisp front click, the mirror clack, a soft "flash" twinkle
      noise(t, { f: 3400, q: 1.2, a: 0.001, d: 0.012, v: 0.1 });
      tone(t, { w: 'triangle', f: 1600, f2: 1050, a: 0.001, d: 0.02, v: 0.045 });
      tone(t, { f: 320, f2: 190, a: 0.001, d: 0.04, v: 0.07 });
      noise(t + 0.06, { f: 2100, q: 1.5, a: 0.001, d: 0.02, v: 0.085 });
      tone(t + 0.06, { w: 'triangle', f: 880, f2: 600, a: 0.001, d: 0.025, v: 0.055 });
      INS.bell(t + 0.11, top(kr(6) + 7, 98), 0.3, 0.03, B.sfxIn, 0.2); shimmer(t + 0.09, 0.25, 0.008);
      return t + 0.5;
    },
    islandNew(t) { // a new island: waves swell, a friendly boat horn, then the reveal (chord, "hey-ah", sparkles)
      duck(0.35, 2.8);
      const r = kr(5), hz = kr(3) + 7;
      noise(t, { type: 'lowpass', f: 450, f2: 1400, q: 0.5, a: 0.5, d: 0.7, v: 0.05 });
      whoosh(t + 0.25, 0.5, 0.025, true);
      tone(t + 0.08, { w: 'triangle', f: mtof(hz), a: 0.06, h: 0.22, d: 0.25, v: 0.09, lp: 900 });
      if (!LITE) tone(t + 0.08, { w: 'triangle', f: mtof(hz + 7), a: 0.06, h: 0.22, d: 0.25, v: 0.05, lp: 1000 });
      tone(t + 0.42, { w: 'triangle', f: mtof(hz + 5), a: 0.04, h: 0.08, d: 0.3, v: 0.08, lp: 900 });
      const tc = t + 0.85;
      chord(tc, r, [0, 4, 7, 12, 14], 0.9, 0.032); INS.kick(tc, 0.24, B.sfxIn); INS.clap(tc, 0.07, B.sfxIn); INS.bass(tc, r - 12, 0.9, 0.18, B.sfxIn);
      INS.vox(tc, r + 16, 0.12, 0.18, B.sfxIn, 'e'); INS.vox(tc + 0.15, r + 19, 0.4, 0.18, B.sfxIn, 'a');
      sparkle(tc + 0.1, r + 12, 7, 0.045, 0.045); shimmer(tc, 0.7, 0.016);
      return tc + 1.5;
    },
  };
  // Pets: Muri the cat (a "mi-aau"), Kutsu the puppy (a small "vuf-vuf"), Jänku the bunny (a soft squeak and a foot thump).
  const PET_ALIAS = { cat: 'muri', kass: 'muri', kiisu: 'muri', dog: 'kutsu', koer: 'kutsu', puppy: 'kutsu', kutsikas: 'kutsu', bunny: 'janku', rabbit: 'janku', janes: 'janku', jankus: 'janku' };
  // A formant voice: a saw whose pitch and two band-passes glide through the given points [time, f0, F1, F2]. 6 nodes (5 in lite).
  function formant(t, pts, v, q) {
    const end = t + pts[pts.length - 1][0], g = G(B.sfxIn, 0), o = O(WV.saw, pts[0][1], t);
    const f1 = F(g, 'bandpass', pts[0][2], q || 5), f2 = LITE ? null : F(g, 'bandpass', pts[0][3], (q || 5) * 1.5);
    o.connect(f1); if (f2) o.connect(f2);
    for (let i = 1; i < pts.length; i++) { const tt = t + pts[i][0]; o.frequency.linearRampToValueAtTime(pts[i][1], tt); f1.frequency.linearRampToValueAtTime(pts[i][2], tt); if (f2) f2.frequency.linearRampToValueAtTime(pts[i][3], tt); }
    const dur = end - t; if (LITE) v *= 1.3; // lite: one formant band instead of two (about 2.5 LU less without this)
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.04, dur * 0.2)); g.gain.setValueAtTime(v * 0.85, t + dur * 0.6); g.gain.linearRampToValueAtTime(0, end);
    fin(o, t, end + 0.02, g);
    return end;
  }
  function petSound(t, kind) {
    let k = slug(kind); if (PET_ALIAS[k]) k = PET_ALIAS[k];
    const j = Math.pow(2, (rnd() - 0.5) / 12); // a little variety each time
    if (k === 'kutsu') { // two small barks, the second a touch higher
      for (let i = 0; i < 2; i++) {
        const tt = t + i * 0.17, p = j * (i ? 1.08 : 1);
        formant(tt, [[0, 520 * p, 900, 1900], [0.03, 600 * p, 1150, 2100], [0.09, 380 * p, 700, 1600]], 0.2, 3);
        noise(tt, { f: 1300, q: 1, a: 0.002, d: 0.05, v: 0.035 });
      }
      INS.bell(t + 0.42, top(kr(6) + 4, 96), 0.3, 0.025, B.sfxIn, 0.2);
      return t + 0.7;
    }
    if (k === 'janku') { // a soft high squeak, then a foot thump (with a body tone the phone can play)
      tone(t, { f: 1250 * j, f2: 1700 * j, gt: 0.05, a: 0.008, d: 0.07, v: 0.045 });
      tone(t + 0.07, { f: 1600 * j, f2: 1350 * j, gt: 0.04, a: 0.004, d: 0.05, v: 0.035 });
      tone(t + 0.2, { f: 150, f2: 75, gt: 0.05, a: 0.002, d: 0.1, v: 0.2 });
      tone(t + 0.2, { w: 'triangle', f: 300, f2: 160, gt: 0.04, a: 0.002, d: 0.06, v: 0.06 });
      noise(t + 0.2, { type: 'lowpass', f: 700, q: 0.7, a: 0.002, d: 0.05, v: 0.06 });
      INS.bell(t + 0.32, top(kr(6) + 7, 96), 0.3, 0.025, B.sfxIn, -0.2);
      return t + 0.6;
    }
    // muri (and anything unknown): "mi" -> "aa" -> "u"
    formant(t, [[0, 560 * j, 450, 2300], [0.12, 740 * j, 950, 1800], [0.3, 640 * j, 850, 1500], [0.48, 500 * j, 520, 1100]], 0.14, 6);
    INS.bell(t + 0.5, top(kr(6) + 7, 96), 0.3, 0.022, B.sfxIn, 0.2);
    return t + 0.75;
  }

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
  const LIM = { merge: [0.04, 4], merge5: [0.08, 2], combo: [0.12, 1], talk: [0.055, 2], coins: [0.07, 2], tap: [0.03, 2], hint: [0.2, 1], pick: [0.04, 2], drop: [0.04, 3], swap: [0.05, 2], spawn: [0.05, 3], bubble: [0.1, 2], bubblePop: [0.04, 3], stars: [0.15, 1], mergeMax: [0.3, 1], lucky: [0.4, 1], claim: [0.25, 1], discover: [0.3, 1], mystery: [0.5, 1], event: [0.4, 1], album: [0.5, 1], taskDone: [0.5, 1], levelUp: [0.5, 1], daily: [0.5, 1], orderDone: [0.2, 1], chest: [0.3, 1], order: [0.2, 1], deny: [0.15, 1], noEnergy: [0.25, 1], open: [0.06, 1], close: [0.06, 1], sell: [0.1, 1],
    iceCrack: [0.05, 3], boxBreak: [0.08, 2], cobweb: [0.06, 2], booster: [0.3, 2], wheelTick: [0.03, 3], wheelWin: [0.5, 2], levelWin: [0.8, 2], levelFail: [0.8, 2], star: [0.12, 2], piggy: [0.5, 1], calendar: [0.3, 1], heart: [0.25, 1], movesLow: [0.6, 1],
    passStep: [0.08, 2], styleSwap: [0.15, 1], wardrobe: [0.2, 1], pet: [0.25, 2], eventCur: [0.07, 2], photo: [0.3, 1], islandNew: [1, 1] };
  // Levels against the music (phase C, from tools/mergeaudio.js --sfxmix): the big jingles were about 15 LU over the music
  // bed (on top of its duck), merges 7 and the "uh-uh" 7; these bring jingles to about +11, merges to +5, the denial to +3.
  // (The sound glue compresses the loud ones, so a jingle needs about 2 dB of gain cut per 1 dB it should drop.)
  const SFXG = { merge: 0.8, merge5: 0.6, mergeMax: 0.5, lucky: 0.55, discover: 0.52, taskDone: 0.52, levelUp: 0.36, album: 0.5, levelWin: 0.42, islandNew: 0.4,
    deny: 0.6, heart: 0.78, mystery: 0.85, boxBreak: 0.85, calendar: 0.75, wheelWin: (o) => (o.big ? 0.42 : 1), passStep: (o) => ((+o.n || +o.step || 1) >= 30 ? 0.55 : 1) };
  const PRI = { mergeMax: 1, taskDone: 1, levelUp: 1, orderDone: 1, daily: 1, chest: 1, lucky: 1, discover: 1, mystery: 1, event: 1, album: 1, combo: 1, claim: 1, booster: 1, wheelWin: 1, levelWin: 1, levelFail: 1, star: 1, piggy: 1, calendar: 1, heart: 1, passStep: 1, styleSwap: 1, wardrobe: 1, pet: 1, photo: 1, islandNew: 1 };
  const lastAt = {};
  // Nodes to disconnect once the audio clock passes a time: [time, node]. On the audio clock, not setTimeout: while the
  // context is suspended (hidden, muted, asleep) wall time runs on, and cutting a chain whose sources have not ended yet
  // orphaned them (Chrome then collects them without an 'ended' event: the live count crept up and the quiet sleep waited).
  const GQ = [];
  function reap(now) {
    for (let i = GQ.length - 1; i >= 0; i--) if (now >= GQ[i][0]) { try { GQ[i][1].disconnect(); } catch (e) {} GQ.splice(i, 1); }
    for (let i = MU.olds.length - 1; i >= 0; i--) { const o = MU.olds[i]; if (now >= o.kill) { try { o.bus.disconnect(); } catch (e) {} MU.olds.splice(i, 1); } }
  }
  function sfx(name, opts) {
    if (typeof name !== 'string' || !hasOwn(SFX, name)) return false;
    ST.names[name] = (ST.names[name] || 0) + 1;
    if (name === 'talk' && opts && typeof opts.ch === 'string' && PUNCT.test(opts.ch)) return false;
    if (!ctx || muted || hidden || VOL.sfx <= 0 || OFF) return false;
    // Asleep after a quiet stretch: wake up (the game plays sounds from a touch, so iPhone allows the resume); the sound is
    // written at the frozen clock and plays the moment the context runs again. Asleep while idle (nobody there): dropped,
    // so a game timer's sound can't keep restarting the music; only a touch wakes an idle context.
    if (!api.ready) { if (sleepWhy !== 'quiet' || ctx.state === 'closed') return false; wake(true); }
    const c0 = PNOW();
    lastSound = c0;
    try {
      const now = ctx.currentTime, lim = LIM[name] || [0.03, 2];
      if (now - (lastAt[name] || -9) < lim[0]) { ST.dropped++; if (name === 'merge') comboStep(now, 1); return false; }
      let all = 0, same = 0;
      for (let i = act.length - 1; i >= 0; i--) { if (act[i].end <= now) { act.splice(i, 1); continue; } all++; if (act[i].name === name) same++; }
      if (same >= lim[1] || (all >= (LITE ? 8 : 14) && !PRI[name])) { ST.dropped++; if (name === 'merge') comboStep(now, 1); return false; }
      lastAt[name] = now;
      // The first look-ahead of the sound (0.35 s, 0.6 in lite, more after stalls) is built now; the rest of a long jingle
      // is queued and built just in time by tick().
      const o = opts && typeof opts === 'object' ? opts : {}, tmp = DQ = [], bus0 = B.sfxIn;
      let gv = SFXG[name]; if (typeof gv === 'function') gv = gv(o);
      if (gv && gv !== 1) B.sfxIn = G(bus0, gv); // the sound's own level (one gain node, gone with the sound)
      let end;
      try {
        end = SFX[name](now + 0.005, o);
        DQ = null;
        tmp.sort((a, b) => a[0] - b[0]);
        let k = 0; const win = now + Math.max(0.15, TM.look || lookBase()); for (; k < tmp.length && tmp[k][0] < win; k++) tmp[k][1].apply(null, tmp[k][2]);
        if (k < tmp.length) { for (; k < tmp.length; k++) { tmp[k][3] = B.sfxIn; FXQ.push(tmp[k]); } FXQ.sort((a, b) => a[0] - b[0]); }
      } finally {
        DQ = null;
        if (B.sfxIn !== bus0) { let last = end || now + 1; for (const x of FXQ) if (x[3] === B.sfxIn && x[0] > last) last = x[0]; GQ.push([last + 5, B.sfxIn]); B.sfxIn = bus0; } // after its last voice (and tail)
      }
      act.push({ name: name, end: end || now + 0.3 });
      cpuAdd(c0, 1);
      return true;
    } catch (e) { ST.err = name + ': ' + e.message; return false; }
  }
  function cpuAdd(c0, fx) { const d = PNOW() - c0; TM.cpu += d; if (fx) { if (d > TM.sfxMax) TM.sfxMax = d; } else if (d > TM.cpuMax) TM.cpuMax = d; }
  function duck(depth, hold) {
    if (!B.duck) return;
    const now = OFF ? OFF.t : ctx.currentTime, g = B.duck.gain;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.setTargetAtTime(depth, now, 0.04); g.setTargetAtTime(1, now + hold, 0.5);
  }

  // ---------- music ----------
  // A small song engine: 16th-note grid, bar by bar. Each area has its own key, tempo, groove, chords and hook.
  // Sections (intro, verse, pre, chorus, break, verse2, chorus2, outro) shuffle between cycles; verses get fresh melodies.
  const SCALE = { lydian: [0, 2, 4, 6, 7, 9, 11], major: [0, 2, 4, 5, 7, 9, 11], aeolian: [0, 2, 3, 5, 7, 8, 10], mixo: [0, 2, 4, 5, 7, 9, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };
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
    // v3: the level map and the level chapters
    map: { a: [[0, 0, 2], [2, 4, 2], [4, 7, 3], [7, 6, 1], [8, 4, 2], [10, 5, 2], [12, 4, 4]], b1: [[0, 2, 2], [2, 4, 2], [4, 5, 2], [6, 4, 2], [8, 2, 6], [14, 1, 2]], b2: [[0, 2, 2], [2, 4, 2], [4, 7, 2], [6, 9, 3], [9, 8, 1], [10, 7, 6]] },
    candy: { a: [[0, 4, 1], [2, 4, 1], [3, 5, 2], [6, 4, 2], [8, 2, 2], [10, 4, 2], [12, 0, 3]], b1: [[0, 1, 2], [2, 2, 2], [4, 4, 2], [6, 2, 2], [8, 1, 6]], b2: [[0, 1, 2], [2, 2, 2], [4, 4, 2], [6, 5, 2], [8, 7, 4], [12, 4, 4]] },
    meadow: { a: [[0, 2, 2], [2, 4, 2], [4, 5, 2], [6, 7, 4], [10, 5, 2], [12, 4, 4]], b1: [[0, 5, 2], [2, 4, 2], [4, 2, 2], [6, 4, 3], [9, 1, 7]], b2: [[0, 5, 2], [2, 4, 2], [4, 2, 2], [6, 1, 2], [8, 0, 8]] },
    berry: { a: [[0, 0, 1], [1, 2, 1], [2, 4, 2], [4, 4, 1], [6, 6, 2], [8, 4, 2], [10, 2, 1], [11, 4, 5]], b1: [[0, 3, 2], [2, 2, 1], [3, 1, 1], [4, 2, 4], [8, 0, 2], [10, -1, 6]], b2: [[0, 3, 2], [2, 4, 1], [3, 5, 1], [4, 6, 4], [8, 7, 8]] },
    cliffs: { a: [[0, 4, 3], [3, 3, 1], [4, 2, 2], [6, 0, 2], [8, 2, 2], [10, 4, 2], [12, 6, 4]], b1: [[0, 7, 2], [2, 6, 2], [4, 4, 4], [8, 3, 2], [10, 2, 6]], b2: [[0, 7, 2], [2, 6, 2], [4, 4, 2], [6, 6, 2], [8, 7, 8]] },
    winter: { a: [[0, 2, 2], [2, 4, 2], [4, 7, 2], [6, 4, 2], [8, 5, 4], [12, 4, 4]], b1: [[0, 3, 2], [2, 2, 2], [4, 1, 2], [6, 2, 2], [8, 4, 6], [14, 2, 2]], b2: [[0, 3, 2], [2, 4, 2], [4, 5, 2], [6, 6, 2], [8, 7, 8]] },
    lavender: { a: [[2, 4, 2], [4, 6, 2], [6, 4, 2], [8, 2, 4], [12, 1, 2], [14, 2, 2]], b1: [[0, 4, 4], [4, 2, 2], [6, 1, 2], [8, 0, 8]], b2: [[0, 4, 4], [4, 5, 2], [6, 6, 2], [8, 7, 6], [14, 6, 2]] },
    // v3 phase B: the island tour themes
    t_flower: { a: [[0, 2, 2], [2, 4, 2], [4, 5, 1], [5, 4, 1], [6, 2, 2], [8, 4, 4], [12, 7, 2], [14, 5, 2]], b1: [[0, 4, 2], [2, 2, 2], [4, 1, 2], [6, 2, 4], [10, 1, 6]], b2: [[0, 4, 2], [2, 5, 2], [4, 7, 2], [6, 5, 2], [8, 4, 2], [10, 2, 2], [12, 0, 4]] },
    t_spa: { a: [[0, 4, 6], [6, 3, 2], [8, 6, 8]], b1: [[0, 5, 4], [4, 4, 4], [8, 1, 8]], b2: [[0, 5, 4], [4, 6, 4], [8, 7, 8]] },
    t_icecream: { a: [[0, 4, 1], [1, 5, 1], [2, 4, 2], [4, 2, 1], [6, 4, 2], [8, 7, 1], [10, 6, 1], [11, 4, 3], [14, 2, 2]], b1: [[0, 1, 1], [2, 2, 1], [3, 4, 3], [6, 2, 2], [8, 1, 4], [12, 4, 2], [14, 5, 2]], b2: [[0, 4, 1], [2, 5, 1], [3, 7, 3], [6, 5, 2], [8, 4, 2], [10, 2, 2], [12, 0, 4]] },
    t_fashion: { a: [[0, 0, 2], [2, 2, 1], [3, 4, 3], [6, 6, 2], [8, 4, 2], [10, 2, 2], [12, 4, 4]], b1: [[0, 3, 2], [2, 2, 2], [4, 0, 2], [6, 2, 4], [10, 1, 6]], b2: [[0, 3, 2], [2, 4, 2], [4, 6, 2], [6, 7, 4], [12, 4, 4]] },
    t_wedding: { a: [[0, 2, 4], [4, 4, 2], [6, 7, 2], [8, 6, 6], [14, 4, 2]], b1: [[0, 5, 4], [4, 4, 2], [6, 2, 2], [8, 1, 8]], b2: [[0, 5, 4], [4, 6, 2], [6, 8, 2], [8, 7, 8]] },
    t_beach: { a: [[0, 4, 2], [3, 4, 1], [4, 5, 2], [6, 4, 2], [8, 2, 2], [11, 4, 1], [12, 6, 4]], b1: [[0, 7, 2], [3, 6, 1], [4, 4, 2], [6, 2, 2], [8, 3, 6], [14, 2, 2]], b2: [[0, 4, 2], [3, 6, 1], [4, 7, 4], [8, 6, 2], [10, 4, 2], [12, 0, 4]] },
    t_xmas: { a: [[0, 0, 2], [2, 4, 2], [4, 5, 2], [6, 7, 2], [8, 6, 3], [11, 5, 1], [12, 4, 4]], b1: [[0, 3, 2], [2, 4, 2], [4, 3, 2], [6, 2, 2], [8, 1, 6], [14, 4, 2]], b2: [[0, 3, 2], [2, 4, 2], [4, 5, 2], [6, 6, 2], [8, 7, 8]] },
    t_orchard: { a: [[2, 4, 2], [4, 3, 2], [6, 4, 4], [10, 2, 2], [12, 0, 4]], b1: [[2, 2, 2], [4, 3, 2], [6, 4, 2], [8, 6, 6], [14, 5, 2]], b2: [[2, 6, 2], [4, 5, 2], [6, 4, 2], [8, 3, 2], [10, 2, 2], [12, 0, 4]] },
    // v3 phase B: the weekly events (livelier than the islands: festival energy)
    ev_garden: { a: [[0, 4, 1], [2, 4, 1], [3, 5, 1], [4, 7, 2], [6, 5, 2], [8, 4, 2], [10, 2, 2], [12, 4, 4]], b1: [[0, 5, 1], [2, 5, 1], [3, 4, 1], [4, 2, 2], [6, 1, 2], [8, 2, 6], [14, 1, 2]], b2: [[0, 5, 1], [2, 5, 1], [3, 6, 1], [4, 7, 4], [8, 9, 2], [10, 7, 6]] },
    ev_fashion: { a: [[0, 4, 2], [3, 4, 1], [4, 3, 2], [6, 2, 2], [8, 0, 2], [10, 2, 1], [11, 4, 3], [14, 2, 2]], b1: [[0, 5, 2], [3, 4, 1], [4, 2, 4], [8, 4, 2], [10, 3, 6]], b2: [[0, 5, 2], [3, 6, 1], [4, 7, 4], [8, 6, 2], [10, 4, 2], [12, 0, 4]] },
    ev_wedding: { a: [[0, 7, 2], [2, 6, 1], [3, 7, 1], [4, 4, 4], [8, 5, 2], [10, 4, 2], [12, 2, 4]], b1: [[0, 4, 2], [2, 2, 2], [4, 1, 2], [6, 2, 2], [8, 4, 6], [14, 5, 2]], b2: [[0, 4, 2], [2, 5, 2], [4, 7, 2], [6, 9, 2], [8, 7, 8]] },
    ev_beach: { a: [[0, 0, 1], [1, 2, 1], [2, 4, 1], [3, 7, 3], [6, 6, 2], [8, 4, 2], [10, 6, 2], [12, 7, 4]], b1: [[0, 9, 2], [2, 7, 2], [4, 6, 2], [6, 4, 2], [8, 3, 4], [12, 2, 4]], b2: [[0, 9, 2], [2, 7, 2], [4, 6, 2], [6, 4, 2], [8, 2, 2], [10, 1, 2], [12, 0, 4]] },
  };
  // Grooves: kick, snare/clap steps, hats; the snare voice; the bass line [step, length, interval].
  const GROOVE = {
    lofi: { k: [0, 7, 10], s: [4, 12], sn: 'snare', h: [0, 2, 4, 6, 8, 10, 12, 14], acc: 2, sh: false, bass: [[0, 6, 0], [7, 2, 0], [10, 5, 7]] },
    pop: { k: [0, 6, 8], s: [4, 12], sn: 'clap', h: [2, 6, 10, 14], acc: 0, sh: true, bass: [[0, 3, 0], [3, 3, 0], [6, 2, 12], [8, 3, 0], [11, 3, 7], [14, 2, 0]] },
    tropical: { k: [0, 4, 8, 12], s: [4, 12], sn: 'clap', h: [2, 6, 10, 14], acc: 0, sh: true, bass: [[0, 2, 0], [2, 2, 12], [6, 2, 0], [8, 2, 0], [10, 2, 12], [14, 2, 7]] },
    bouncy: { k: [0, 3, 8, 10], s: [4, 12], sn: 'snap', h: [0, 2, 4, 6, 8, 10, 12, 14], acc: 2, sh: false, bass: [[0, 2, 0], [3, 2, 7], [6, 1, 12], [8, 2, 0], [11, 2, 7], [14, 1, 12]] },
    half: { k: [0, 11], s: [8], sn: 'snap', h: [0, 4, 8, 12], acc: 4, sh: false, bass: [[0, 10, 0], [11, 4, 7]] },
    none: { k: [], s: [], sn: 'snap', h: [], acc: 0, sh: false, bass: [[0, 15, 0]] },
    // v3 phase B: soft four-on-the-floor for the fashion week (offbeat hats, an octave bass)
    house: { k: [0, 4, 8, 12], s: [4, 12], sn: 'clap', h: [2, 6, 10, 14], acc: 0, sh: true, bass: [[0, 2, 0], [2, 2, 12], [4, 2, 0], [6, 2, 12], [8, 2, 0], [10, 2, 12], [12, 2, 0], [14, 2, 7]] },
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
    title: { root: 65, mode: 'major', bpm: 100, swing: 0.04, groove: 'pop', keys: 'ep', compV: 'halves', compC: 'pop', lead: 'vox', lead2: 'pluck', arp: 'pluck', pad: 1, pump: 0.5, tone: 9000, hook: 'title', vol: 0.734,
      v: [[C(5, 'maj9')], [C(7, 'sus')], [C(4, 'm7')], [C(9, 'm9')]], c: [[C(5, 'maj7')], [C(7, 'M')], [C(4, 'm7'), C(9, 'm7')], [C(2, 'm9'), C(7, 'sus')]] },
    pagariari: { root: 63, mode: 'major', bpm: 84, swing: 0.24, groove: 'lofi', keys: 'ep', compV: 'lofi', compC: 'lofi', lead: 'ep', lead2: 'vox', arp: null, pad: 0.6, pump: 0.15, tone: 3200, crackle: true, hook: 'cafe', vol: 0.925, pres: -1,
      v: [[C(2, 'm9')], [C(7, 'd7')], [C(0, 'maj9')], [C(9, 'm7')]], c: [[C(5, 'maj9')], [C(4, 'm7'), C(9, 'm7')], [C(2, 'm9')], [C(7, 'sus'), C(7, 'd7')]] },
    aed: { root: 67, mode: 'major', bpm: 104, swing: 0.06, groove: 'pop', keys: 'ep', compV: 'halves', compC: 'pop', lead: 'mallet', lead2: 'vox', arp: 'pluck', pad: 0.7, pump: 0.35, tone: 9000, hook: 'garden', vol: 1.031, liteV: 1.059, mud: -6, pres: 6,
      v: [[C(0, 'add9')], [C(7, 'M')], [C(9, 'm7')], [C(5, 'maj7')]], c: [[C(5, 'maj7')], [C(0, 'add9')], [C(7, 'sus'), C(7, 'M')], [C(9, 'm7')]] },
    sadam: { root: 57, mode: 'aeolian', bpm: 110, swing: 0, groove: 'tropical', keys: 'pluck', compV: 'offbeat', compC: 'offbeat', lead: 'vox', lead2: 'mallet', arp: null, pad: 1, pump: 0.6, tone: 9000, hook: 'harbour', vol: 1.075, pres: -0.4, bassV: 0.75,
      v: [[C(0, 'm7')], [C(8, 'maj7')], [C(3, 'add9')], [C(10, 'M')]], c: [[C(5, 'm7')], [C(8, 'maj7')], [C(3, 'add9')], [C(10, 'sus'), C(10, 'M')]] },
    tuuleveski: { root: 62, mode: 'mixo', bpm: 96, swing: 0.1, groove: 'bouncy', keys: 'ep', compV: 'pop', compC: 'pop', lead: 'pluck', lead2: 'vox', arp: 'mallet', pad: 0.6, pump: 0.3, tone: 8000, hook: 'mill', vol: 0.937, liteV: 1.035,
      v: [[C(0, 'M')], [C(10, 'add9')], [C(5, 'maj7')], [C(0, 'add9')]], c: [[C(5, 'maj7')], [C(7, 'm7')], [C(10, 'M')], [C(0, 'add9'), C(7, 'm7')]] },
    majakas: { root: 58, mode: 'major', bpm: 78, swing: 0.08, groove: 'half', keys: 'ep', compV: 'whole', compC: 'halves', lead: 'bell', lead2: 'vox', arp: 'mallet', pad: 1, pump: 0.25, tone: 6000, hook: 'light', vol: 0.956, liteV: 1.047,
      v: [[C(0, 'maj9')], [C(5, 'maj9')], [C(9, 'm9')], [C(7, 'sus')]], c: [[C(5, 'maj7')], [C(7, 'add9')], [C(4, 'm7')], [C(9, 'm9')]] },
    saladus: { root: 62, mode: 'aeolian', bpm: 76, swing: 0.18, groove: 'lofi', keys: 'ep', compV: 'lofi', compC: 'halves', lead: 'vox', lead2: 'bell', arp: 'mallet', pad: 1, pump: 0.2, tone: 2600, crackle: true, hook: 'secret', vol: 0.915, liteV: 1.035, pres: -1,
      v: [[C(0, 'm9')], [C(8, 'maj7')], [C(5, 'maj7')], [C(7, 'sus'), C(7, 'm7')]], c: [[C(8, 'maj7')], [C(10, 'add9')], [C(0, 'm9')], [C(7, 'sus')]] },
    story: { root: 60, mode: 'major', bpm: 72, swing: 0.06, groove: 'none', keys: 'ep', compV: 'whole', compC: 'halves', lead: 'bell', lead2: 'ep', arp: 'mallet', pad: 1, pump: 0, tone: 5000, hook: 'story', vol: 1.1, story: true,
      v: [[C(0, 'maj9')], [C(9, 'm9')], [C(5, 'maj9')], [C(7, 'sus')]], c: [[C(5, 'maj7')], [C(4, 'm7')], [C(9, 'm9')], [C(7, 'sus'), C(7, 'M')]] },
    // v3 level map: bright, adventurous feel-good pop (I - V - vi - IV verses, a vi - IV - I - V chorus).
    map: { root: 64, mode: 'major', bpm: 110, swing: 0.03, groove: 'pop', keys: 'ep', compV: 'pop', compC: 'pop', lead: 'vox', lead2: 'mallet', arp: 'pluck', pad: 0.8, pump: 0.45, tone: 9500, hook: 'map', vol: 0.724,
      v: [[C(0, 'add9')], [C(7, 'M')], [C(9, 'm7')], [C(5, 'maj7')]], c: [[C(9, 'm7')], [C(5, 'maj9')], [C(0, 'add9')], [C(7, 'sus'), C(7, 'M')]] },
    // v3 level chapters: energetic but not stressful puzzle music, one per map chapter (they cycle).
    candy: { root: 62, mode: 'major', bpm: 114, swing: 0, groove: 'tropical', keys: 'pluck', compV: 'offbeat', compC: 'offbeat', lead: 'mallet', lead2: 'vox', arp: null, pad: 0.9, pump: 0.5, tone: 9000, hook: 'candy', vol: 1.132, liteV: 1.161, bassV: 0.75, level: true,
      v: [[C(0, 'add9')], [C(9, 'm7')], [C(5, 'maj7')], [C(7, 'M')]], c: [[C(5, 'maj7')], [C(7, 'M')], [C(4, 'm7'), C(9, 'm7')], [C(2, 'm7'), C(7, 'sus')]] },
    meadow: { root: 65, mode: 'major', bpm: 106, swing: 0.05, groove: 'pop', keys: 'ep', compV: 'halves', compC: 'pop', lead: 'vox', lead2: 'pluck', arp: 'mallet', pad: 0.7, pump: 0.35, tone: 9000, hook: 'meadow', vol: 0.8, level: true,
      v: [[C(0, 'maj9')], [C(2, 'm7')], [C(5, 'maj7')], [C(7, 'sus'), C(7, 'M')]], c: [[C(5, 'maj9')], [C(7, 'add9')], [C(9, 'm7')], [C(0, 'add9')]] },
    berry: { root: 60, mode: 'mixo', bpm: 102, swing: 0.12, groove: 'bouncy', keys: 'ep', compV: 'pop', compC: 'pop', lead: 'pluck', lead2: 'vox', arp: 'mallet', pad: 0.6, pump: 0.3, tone: 8000, hook: 'berry', vol: 0.965, liteV: 1.035, pres: 2.3, level: true,
      v: [[C(0, 'M')], [C(10, 'add9')], [C(5, 'M')], [C(0, 'add9')]], c: [[C(5, 'maj7')], [C(10, 'M')], [C(0, 'add9')], [C(7, 'm7'), C(10, 'M')]] },
    cliffs: { root: 57, mode: 'dorian', bpm: 108, swing: 0, groove: 'pop', keys: 'ep', compV: 'offbeat', compC: 'pop', lead: 'vox', lead2: 'mallet', arp: 'pluck', pad: 1, pump: 0.55, tone: 9000, hook: 'cliffs', vol: 0.793, pres: 2.2, level: true,
      v: [[C(0, 'm9')], [C(5, 'add9')], [C(10, 'M')], [C(0, 'm7')]], c: [[C(3, 'maj7')], [C(10, 'add9')], [C(5, 'M')], [C(7, 'm7'), C(5, 'M')]] },
    winter: { root: 67, mode: 'major', bpm: 100, swing: 0.08, groove: 'bouncy', keys: 'ep', compV: 'halves', compC: 'pop', lead: 'bell', lead2: 'mallet', arp: 'mallet', pad: 0.9, pump: 0.3, tone: 7500, hook: 'winter', bassV: 0.8, vol: 1.324, mud: -6, pres: 6, jingle: true, level: true,
      v: [[C(0, 'maj7')], [C(4, 'm7')], [C(5, 'maj9')], [C(7, 'sus')]], c: [[C(5, 'maj7')], [C(7, 'M')], [C(9, 'm7')], [C(2, 'm7'), C(7, 'd7')]] },
    lavender: { root: 63, mode: 'major', bpm: 96, swing: 0.16, groove: 'pop', keys: 'ep', compV: 'lofi', compC: 'pop', lead: 'vox', lead2: 'ep', arp: 'pluck', pad: 0.9, pump: 0.3, tone: 6500, hook: 'lavender', vol: 0.779, pres: -1, level: true,
      v: [[C(0, 'maj9')], [C(9, 'm9')], [C(2, 'm7')], [C(7, 'sus')]], c: [[C(5, 'maj9')], [C(4, 'm7'), C(9, 'm7')], [C(2, 'm9')], [C(7, 'sus'), C(7, 'd7')]] },
    // ---- v3 phase B: island tour themes (one song each; sections reshuffle and verses get fresh melodies every cycle) ----
    // Flower shop: sunny F major pop, mallet hook over electric piano.
    t_flower: { root: 65, mode: 'major', bpm: 102, swing: 0.05, groove: 'pop', keys: 'ep', compV: 'halves', compC: 'pop', lead: 'mallet', lead2: 'vox', arp: 'pluck', pad: 0.7, pump: 0.35, tone: 8500, hook: 't_flower', vol: 0.894,
      v: [[C(0, 'add9')], [C(9, 'm7')], [C(5, 'maj7')], [C(7, 'sus'), C(7, 'M')]], c: [[C(5, 'maj9')], [C(7, 'M')], [C(4, 'm7'), C(9, 'm7')], [C(0, 'add9')]] },
    // Spa: slow, dreamy C lydian, bells and a soft pad, barely-there drums.
    t_spa: { root: 60, mode: 'lydian', bpm: 70, swing: 0.06, groove: 'half', keys: 'ep', compV: 'whole', compC: 'halves', lead: 'bell', lead2: 'ep', arp: 'mallet', pad: 1, pump: 0.15, tone: 4200, hook: 't_spa', vol: 1.07, pres: 4, liteV: 0.966,
      v: [[C(0, 'maj9')], [C(2, 'add9')], [C(0, 'maj7')], [C(2, 'M')]], c: [[C(9, 'm9')], [C(2, 'add9')], [C(4, 'm7')], [C(0, 'maj9')]] },
    // Ice cream kiosk: bouncy D major, offbeat plucks, playful mallet hook.
    t_icecream: { root: 62, mode: 'major', bpm: 112, swing: 0, groove: 'bouncy', keys: 'pluck', compV: 'offbeat', compC: 'offbeat', lead: 'mallet', lead2: 'vox', arp: null, pad: 0.8, pump: 0.45, tone: 8500, hook: 't_icecream', vol: 1.119, liteV: 1.161, bassV: 0.8,
      v: [[C(0, 'M')], [C(7, 'M')], [C(9, 'm7')], [C(5, 'add9')]], c: [[C(5, 'maj7')], [C(7, 'add9')], [C(4, 'm7'), C(9, 'm7')], [C(2, 'm7'), C(7, 'sus')]] },
    // Fashion boutique: chic A dorian groove, vocal-chop hook.
    t_fashion: { root: 57, mode: 'dorian', bpm: 106, swing: 0.04, groove: 'pop', keys: 'ep', compV: 'offbeat', compC: 'pop', lead: 'vox', lead2: 'pluck', arp: 'pluck', pad: 0.9, pump: 0.5, tone: 8500, hook: 't_fashion', vol: 0.791, pres: 4.4,
      v: [[C(0, 'm9')], [C(5, 'd7')], [C(0, 'm7')], [C(5, 'add9')]], c: [[C(3, 'maj7')], [C(10, 'add9')], [C(5, 'M')], [C(7, 'm7'), C(10, 'M')]] },
    // Wedding garden: a tender Bb major ballad, bell melody over warm ninths.
    t_wedding: { root: 58, mode: 'major', bpm: 78, swing: 0.06, groove: 'half', keys: 'ep', compV: 'whole', compC: 'halves', lead: 'bell', lead2: 'vox', arp: 'mallet', pad: 1, pump: 0.25, tone: 5500, hook: 't_wedding', vol: 0.921, liteV: 1.109,
      v: [[C(0, 'maj9')], [C(4, 'm7')], [C(5, 'maj9')], [C(7, 'sus'), C(7, 'M')]], c: [[C(5, 'maj7')], [C(7, 'add9')], [C(9, 'm9')], [C(2, 'm7'), C(7, 'd7')]] },
    // Beach club: laid-back G mixolydian, steel pan hook, offbeat plucks.
    t_beach: { root: 55, mode: 'mixo', bpm: 98, swing: 0.08, groove: 'tropical', keys: 'pluck', compV: 'offbeat', compC: 'offbeat', lead: 'steel', lead2: 'vox', arp: null, pad: 0.9, pump: 0.5, tone: 8000, hook: 't_beach', vol: 1.242, liteV: 1.096, bassV: 0.75,
      v: [[C(0, 'M')], [C(10, 'add9')], [C(5, 'maj7')], [C(0, 'add9')]], c: [[C(5, 'add9')], [C(10, 'M')], [C(9, 'm7')], [C(7, 'm7'), C(10, 'M')]] },
    // Christmas market: cozy swung A major with bells and sleigh bells.
    t_xmas: { root: 57, mode: 'major', bpm: 96, swing: 0.14, groove: 'bouncy', keys: 'ep', compV: 'halves', compC: 'pop', lead: 'bell', lead2: 'mallet', arp: 'mallet', pad: 0.9, pump: 0.3, tone: 7000, hook: 't_xmas', vol: 1.112, mud: -4, pres: 6, jingle: true,
      v: [[C(0, 'maj7')], [C(9, 'm7')], [C(2, 'm7')], [C(7, 'd7')]], c: [[C(5, 'maj7')], [C(4, 'm7'), C(9, 'm7')], [C(2, 'm9')], [C(7, 'sus'), C(7, 'd7')]] },
    // Autumn orchard: warm E dorian lo-fi with vinyl crackle.
    t_orchard: { root: 64, mode: 'dorian', bpm: 82, swing: 0.2, groove: 'lofi', keys: 'ep', compV: 'lofi', compC: 'halves', lead: 'mallet', lead2: 'vox', arp: 'pluck', pad: 0.8, pump: 0.2, tone: 3400, crackle: true, hook: 't_orchard', vol: 0.95,
      v: [[C(0, 'm9')], [C(5, 'add9')], [C(3, 'maj7')], [C(10, 'add9')]], c: [[C(3, 'maj9')], [C(10, 'M')], [C(0, 'm7')], [C(5, 'M'), C(7, 'm7')]] },
    // ---- v3 phase B: weekly events (festival energy, still easy to listen to for a long time) ----
    ev_garden: { root: 57, mode: 'major', bpm: 112, swing: 0.06, groove: 'bouncy', keys: 'ep', compV: 'pop', compC: 'pop', lead: 'pluck', lead2: 'vox', arp: 'mallet', pad: 0.7, pump: 0.35, tone: 8500, hook: 'ev_garden', vol: 0.915, liteV: 1.047, mud: -3, pres: 6, event: true,
      v: [[C(0, 'add9')], [C(5, 'M')], [C(9, 'm7')], [C(7, 'M')]], c: [[C(5, 'maj7')], [C(7, 'M')], [C(0, 'add9')], [C(9, 'm7'), C(7, 'sus')]] },
    ev_fashion: { root: 54, mode: 'aeolian', bpm: 120, swing: 0, groove: 'house', keys: 'ep', compV: 'offbeat', compC: 'offbeat', lead: 'vox', lead2: 'pluck', arp: 'pluck', pad: 1, pump: 0.6, tone: 8500, hook: 'ev_fashion', vol: 0.92, event: true, bassV: 0.8,
      v: [[C(0, 'm7')], [C(8, 'maj7')], [C(3, 'add9')], [C(10, 'M')]], c: [[C(8, 'maj9')], [C(10, 'add9')], [C(0, 'm9')], [C(5, 'm7'), C(7, 'sus')]] },
    ev_wedding: { root: 62, mode: 'major', bpm: 104, swing: 0.04, groove: 'pop', keys: 'ep', compV: 'halves', compC: 'pop', lead: 'bell', lead2: 'vox', arp: 'mallet', pad: 1, pump: 0.4, tone: 7500, hook: 'ev_wedding', vol: 0.86, event: true,
      v: [[C(0, 'add9')], [C(7, 'M')], [C(9, 'm7')], [C(5, 'maj7')]], c: [[C(5, 'maj9')], [C(7, 'add9')], [C(4, 'm7'), C(9, 'm7')], [C(2, 'm7'), C(7, 'M')]] },
    ev_beach: { root: 60, mode: 'mixo', bpm: 116, swing: 0, groove: 'tropical', keys: 'pluck', compV: 'offbeat', compC: 'offbeat', lead: 'steel', lead2: 'vox', arp: 'mallet', pad: 0.9, pump: 0.55, tone: 8500, hook: 'ev_beach', vol: 1.069, liteV: 1.202, event: true, bassV: 0.75,
      v: [[C(0, 'M')], [C(10, 'M')], [C(5, 'add9')], [C(0, 'add9')]], c: [[C(5, 'maj7')], [C(10, 'add9')], [C(9, 'm7')], [C(7, 'm7'), C(10, 'M')]] },
  };
  const CHAPTERS = ['candy', 'meadow', 'berry', 'cliffs', 'winter', 'lavender'];
  const CH_ALIAS = { beach: 'candy', rand: 'candy', komm: 'candy', kommirand: 'candy', flower: 'meadow', flowers: 'meadow', niit: 'meadow', lilleniit: 'meadow', forest: 'berry', mets: 'berry', marjamets: 'berry', lighthouse: 'cliffs', cliff: 'cliffs', kalju: 'cliffs', kaljud: 'cliffs', majakas: 'cliffs', village: 'winter', talv: 'winter', kula: 'winter', talvekula: 'winter', lavendel: 'lavender', lavendlivali: 'lavender' };
  // Chapter: a number (1 = candy beach, 2 = flower meadow, ... cycling forever), a name, or {level: n} (50 levels a chapter).
  function normChapter(o) {
    o = o || {};
    let ch = o.chapter;
    if (ch === undefined && o.level !== undefined) ch = Math.floor(Math.max(0, (+o.level || 1) - 1) / 50) + 1;
    if (typeof ch === 'number' || (typeof ch === 'string' && /^\d+$/.test(ch))) { const n = Math.max(1, (+ch) | 0); return CHAPTERS[(n - 1) % CHAPTERS.length]; }
    let s = String(ch || '').toLowerCase().replace(/[äâ]/g, 'a').replace(/[õöó]/g, 'o').replace(/ü/g, 'u').replace(/[^a-z]/g, '');
    if (CH_ALIAS[s]) s = CH_ALIAS[s];
    return CHAPTERS.indexOf(s) >= 0 ? s : CHAPTERS[0];
  }
  const ALIAS = { bakery: 'pagariari', pagar: 'pagariari', cafe: 'pagariari', kohvik: 'pagariari', garden: 'aed', harbour: 'sadam', harbor: 'sadam', windmill: 'tuuleveski', veski: 'tuuleveski', lighthouse: 'majakas', secret: 'saladus' };
  const ORDER = ['pagariari', 'aed', 'sadam', 'tuuleveski', 'majakas', 'saladus'];
  const slug = (v) => String(v === undefined || v === null ? '' : v).toLowerCase().replace(/[äâáà]/g, 'a').replace(/[õöóò]/g, 'o').replace(/[üú]/g, 'u').replace(/[éè]/g, 'e').replace(/š/g, 's').replace(/ž/g, 'z').replace(/[^a-z0-9]/g, '');
  function normArea(a) {
    if (typeof a === 'number') return ORDER[cl(a | 0, 0, 5)] || ORDER[0];
    let s = slug(a);
    if (ALIAS[s]) s = ALIAS[s];
    return ORDER.indexOf(s) >= 0 ? s : 'pagariari';
  }
  // v3 phase B: island tour themes and weekly events. Keys, Estonian names and a few English words all work.
  const TOURS = ['flower', 'spa', 'icecream', 'fashion', 'wedding', 'beach', 'xmas', 'orchard'];
  const TOUR_ALIAS = { lillepood: 'flower', lilled: 'flower', lill: 'flower', flowers: 'flower', florist: 'flower', spaa: 'spa', saun: 'spa', jaatis: 'icecream', jaatisekiosk: 'icecream', ice: 'icecream', icecreamkiosk: 'icecream',
    moebutiik: 'fashion', moe: 'fashion', butiik: 'fashion', boutique: 'fashion', pulmaaed: 'wedding', pulmad: 'wedding', pulm: 'wedding', rannaklubi: 'beach', rand: 'beach', beachclub: 'beach',
    jouluturg: 'xmas', joulud: 'xmas', christmas: 'xmas', christmasmarket: 'xmas', ounaaed: 'orchard', sugiseneounaaed: 'orchard', apple: 'orchard', autumn: 'orchard' };
  const WEEKS = ['garden', 'fashion', 'wedding', 'beach'];
  const WEEK_ALIAS = { aiapidu: 'garden', aed: 'garden', evgarden: 'garden', moenadal: 'fashion', moe: 'fashion', evfashion: 'fashion', pulmad: 'wedding', pulm: 'wedding', evwedding: 'wedding', rannafestival: 'beach', rand: 'beach', festival: 'beach', evbeach: 'beach' };
  function normTour(v) { // a key, a name, an island object {theme} or an index; '' when it is none of those
    if (v && typeof v === 'object') v = v.theme !== undefined ? v.theme : v.key;
    if (typeof v === 'number' && isFinite(v)) return TOURS[((Math.floor(v) % 8) + 8) % 8];
    let s = slug(v); if (TOUR_ALIAS[s]) s = TOUR_ALIAS[s];
    return TOURS.indexOf(s) >= 0 ? s : '';
  }
  function normWeek(o) {
    let v = o && typeof o === 'object' ? (o.week !== undefined ? o.week : o.event !== undefined ? o.event : o.key !== undefined ? o.key : o.id) : o;
    if (v && typeof v === 'object') v = v.key !== undefined ? v.key : v.id;
    let s = slug(v); if (WEEK_ALIAS[s]) s = WEEK_ALIAS[s];
    return WEEKS.indexOf(s) >= 0 ? s : 'garden';
  }
  // Music keys -> song configs: 'tour:flower' -> t_flower, 'event:beach' -> ev_beach, 'board:aed' -> aed, 'level:candy' -> candy.
  function cfgName(key) {
    const i = key.indexOf(':'), pre = i > 0 ? key.slice(0, i) : key, nm = i > 0 ? key.slice(i + 1) : key;
    return pre === 'tour' ? 't_' + nm : pre === 'event' ? 'ev_' + nm : nm;
  }
  // Seasons: a colour layered on every song (sleigh bells and celesta in winter, birdsong mallets in spring, brighter tops
  // and a shaker in summer, a warmer tone, a lazier swing and a little vinyl dust in autumn).
  const SEASONS = ['winter', 'spring', 'summer', 'autumn'];
  const SEASON_ALIAS = { talv: 'winter', kevad: 'spring', suvi: 'summer', sugis: 'autumn', fall: 'autumn' };
  const SEAS = { winter: { tone: 0.92, swing: 0 }, spring: { tone: 1.06, swing: 0 }, summer: { tone: 1.22, swing: 0 }, autumn: { tone: 0.82, swing: 0.04 } };
  function dateSeason(d) { const m = (d || new Date()).getMonth(); return m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn'; }
  function normSeason(v) { let s = slug(v); if (SEASON_ALIAS[s]) s = SEASON_ALIAS[s]; return SEASONS.indexOf(s) >= 0 ? s : ''; }
  const LITE_MU = 1.0; // lite make-up gain on the music bus (no reverb return, single-oscillator voices)
  // vol, mud, pres and liteV per song were calibrated with tools/mergeaudio.js (--mix, 150 s) so every song sits within
  // about 1 LU of -23.4 LUFS full range and -26.4 through a phone-speaker model, lite within 0.8 LU of full (phase C:
  // spread 1.8 / 2.4 / 1.6 LU; before: 2.2 / 3.4 / 2.2 and lite down to -1.6 LU on the beach and ice cream songs).
  const LEADV = { vox: 0.3, pluck: 0.085, mallet: 0.11, bell: 0.075, ep: 0.1, steel: 0.09 };
  // liteV: lite has no reverb, and songs of short plucked notes lose more of their loudness without it (up to 1.6 LU).
  const songVol = (c) => c.vol * (LITE && c.liteV ? c.liteV : 1);
  const MU = { E: null, olds: [], want: null, key: '', sinceRest: 0, restAt: 190, tense: false, season: dateSeason(), seasonAuto: true };
  try { const q = W.location && /[?&#]season=([a-z]+)/i.exec(W.location.search + W.location.hash); const s = q && normSeason(q[1]); if (s) { MU.season = s; MU.seasonAuto = false; } } catch (e) {}
  const toneOf = (c) => Math.min(10000, c.tone * SEAS[MU.season].tone);
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
    if (type === 'intro') { S.n = 4; S.comp = 'whole'; S.bass = E.cycle > 0; S.pad = true; S.filt = [450, toneOf(c)]; if (E.cycle > 0) { S.mel = hookMel(E, false).slice(0, 4); S.lead = 'bell'; S.lv = 0.6; } }
    else if (type === 'verse') { S.dr = 1; S.mel = genMel(E, S.prog, 8, 'sparse'); S.lead = c.lead2; S.lv = 0.75; }
    else if (type === 'verse2') { S.dr = 2; S.mel = genMel(E, S.prog, 8, 'busy'); S.lead = c.lead2 === 'vox' ? c.lead : c.lead2; S.lv = 0.75; S.arp = !!c.arp; }
    else if (type === 'pre') { S.n = 4; S.dr = 1; S.pad = true; S.riser = true; S.fill = true; S.filt = [toneOf(c) * 0.35, toneOf(c)]; S.comp = c.compC; }
    else if (type === 'chorus' || type === 'chorus2') { S.prog = c.c; S.comp = c.compC; S.dr = 2; S.pad = true; S.mel = hookMel(E, type === 'chorus2'); S.lead = c.lead; S.dbl = c.lead === 'vox'; S.harm = type === 'chorus2' && E.cycle > 0 && !LITE; S.arp = !!c.arp; S.fill = true; S.lv = 0.82; if (LITE) S.dbl = false; }
    else if (type === 'break') { S.n = 4; S.prog = c.c; S.comp = 'whole'; S.dr = 0; S.bass = false; S.pad = true; S.mel = hookMel(E, false).slice(4); S.lead = c.lead === 'bell' ? 'mallet' : 'bell'; S.lv = 0.75; S.filt = [Math.min(1800, toneOf(c)), Math.min(1800, toneOf(c))]; }
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
  function startMusic(key, cut) { // cut: the old song stops at once (its written notes are dropped) and the new one fades in slowly
    if (MU.key === key) return;
    MU.key = key;
    const now = ctx.currentTime, old = MU.E;
    if (old) {
      old.dead = true; const g = old.bus.gain; old.fade = [now, g.value]; g.cancelScheduledValues(now); g.setValueAtTime(cut ? 0 : g.value, now); g.setTargetAtTime(0, now, 0.45); g.setValueAtTime(0, now + 4); if (cut) old.fade[1] = 0;
      if (!OFF) { old.kill = now + 8; MU.olds.push(old); } // disconnected by tick() on the audio clock (see reap)
    }
    if (!key) { MU.E = null; return; }
    const name = hasOwn(CFG, cfgName(key)) ? cfgName(key) : 'pagariari', c = CFG[name];
    const e16 = 60 / c.bpm / 4, bus = G(B.music, 0);
    // Phone-speaker EQ per song: a low-mid dip (the 200-500 Hz chord and pad region turns to mud on a small speaker) and a
    // gentle presence lift so the melody carries. Two filters per song, not per note.
    const lo = F(bus, 'peaking', 320, 0.8), pr = F(lo, 'peaking', 2300, 0.8); lo.gain.value = c.mud !== undefined ? c.mud : -2; pr.gain.value = c.pres !== undefined ? c.pres : 1.5;
    const lp = F(pr, 'lowpass', toneOf(c), 0.7), inn = G(lp, 1);
    const E = { c: c, name: name, e16: e16, bar: 16 * e16, bus: bus, lp: lp, in: inn, pump: G(inn, 1), tempo: 1, t: now + (old ? 0.5 : 0.15), q: [], qi: 0, form: null, si: 0, bi: 0, S: null, cycle: 0, prev: 4, bars: 0 };
    E.bus.gain.setValueAtTime(0.0001, now); E.bus.gain.linearRampToValueAtTime(songVol(c), now + (cut ? 3 : old ? 2.2 : 0.8));
    E.form = form(E); MU.E = E; MU.sinceRest = 0; MU.restAt = 170 + rnd() * 70;
  }
  function nextSection(E) {
    if (E.S && E.S.type !== 'rest' && E.S.type !== 'hush') MU.sinceRest += E.S.n * E.bar;
    E.si++;
    if (E.si >= E.form.length) { E.cycle++; E.form = form(E); E.si = 0; }
    // Every few minutes a quiet stretch (a hush, or a few bars of soft pad) before the song comes back.
    if (MU.sinceRest > MU.restAt && E.form[E.si] !== 'outro' && !E.c.story && !(MU.tense && E.c.level)) {
      MU.sinceRest = 0; MU.restAt = 170 + rnd() * 70;
      E.form.splice(E.si, 0, rnd() < 0.4 ? 'hush' : 'rest');
      if (E.form[E.si + 1] !== 'intro') E.form.splice(E.si + 1, 0, 'intro');
    }
  }
  function pumpAt(E, t, depth) { // side-chain: the pad bus ducks on each kick and breathes back
    if (depth <= 0) return; const g = E.pump.gain;
    g.setValueAtTime(1 - depth, t); g.setTargetAtTime(1, t + 0.01, E.e16 * 1.1);
  }
  // The season's colour, on top of whatever song plays. Quiet, in key, and kept below about 2.1 kHz for the tonal parts.
  function seasonLayer(E, S, T, chAt, b) {
    const s = MU.season, c = E.c, lv = S.lv, dest = E.in, GR = GROOVE[c.groove], full = S.dr >= 2;
    const hiTone = (st) => { const V = voicing(c, chAt(st)); return top(V[V.length - 1] + 12, 93); };
    if (s === 'winter') {
      // sleigh bells on the off-beats (the songs with their own already have them), a celesta note every other bar
      if (S.dr && !c.jingle && !LITE) for (let k = 2; k < 16; k += 4) noise(T(k), { f: 4300, q: 4, a: 0.002, d: 0.07, v: (full ? 0.011 : 0.007) * lv, dest: dest });
      if (b % 2 === 0) INS.bell(T(0) + 0.02, hiTone(0), 0.3, 0.026 * lv, dest, b % 4 ? 0.3 : -0.3);
    } else if (s === 'spring') {
      // birdsong: two quick mallet notes high in the chord, every other bar, in a different spot each time
      if (b % 2 === 1) { const st = pick([6, 10, 11]), m = hiTone(st); INS.mallet(T(st), m, 0.1, 0.03 * lv, dest, 0.4); INS.mallet(T(st) + E.e16 * 0.5, top(m + pick([2, 5]), 95), 0.1, 0.024 * lv, dest, 0.45); }
    } else if (s === 'summer') {
      // brighter tops (the tone filter) and a light shaker when the groove has none
      if (S.dr && !GR.sh && !LITE) for (let k = 1; k < 16; k += 2) INS.shaker(T(k), (full ? 0.01 : 0.007) * lv, dest);
      if (full && b % 4 === 0 && !c.story) INS.pluck(T(0) + 0.01, hiTone(0), 0.2, 0.022 * lv, dest, -0.3);
    } else if (s === 'autumn') {
      // a little vinyl dust (the lazier swing and warmer tone are in playBar and toneOf)
      if (!c.crackle && !LITE) for (let i = 0; i < 2; i++) noise(T(0) + rnd() * E.bar, { type: 'highpass', f: 2500, q: 0.5, a: 0.001, d: 0.003, v: 0.004 + rnd() * 0.005, dest: dest });
      if (b % 4 === 2) INS.ep(T(8), hiTone(8) - 12, E.e16 * 6, 0.02 * lv, dest);
    }
  }
  function playBar(E) {
    // Tense (few moves left, level music only): the tempo lifts about 6 % over two bars and the hats stay on.
    const tense = MU.tense && !!E.c.level, tg = tense ? 1.06 : 1;
    if (E.tempo !== tg) { E.tempo = Math.abs(tg - E.tempo) < 0.012 ? tg : E.tempo + (tg - E.tempo) * 0.55; E.e16 = 60 / (E.c.bpm * E.tempo) / 4; E.bar = 16 * E.e16; }
    if (!E.S || E.bi >= E.S.n) { if (E.S) nextSection(E); E.bi = 0; E.S = section(E, E.form[E.si]); }
    const S = E.S, c = E.c, t0 = E.t, e16 = E.e16, b = E.bi, dest = E.in, lv = S.lv, GR = GROOVE[c.groove];
    const sw = (s) => (s % 2 ? (c.swing + SEAS[MU.season].swing) * e16 : 0), hum = () => rnd() * 0.005, T = (s) => t0 + s * e16 + sw(s);
    const bar = S.prog[b % S.prog.length], chAt = (s) => (bar.length > 1 && s >= 8 ? bar[1] : bar[0]);
    // Tone filter (sweeps open in intros and builds, closes in breaks).
    const lpf = E.lp.frequency;
    if (S.filt) { const a = S.filt[0], z = S.filt[1], f0 = a * Math.pow(z / a, b / S.n), f1 = a * Math.pow(z / a, (b + 1) / S.n); lpf.setValueAtTime(f0, t0); lpf.exponentialRampToValueAtTime(f1, t0 + E.bar); }
    else lpf.setTargetAtTime(toneOf(c), t0, 0.15);
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
      const last = b === S.n - 1, full = S.dr >= 2 || tense, fillOn = last && S.fill;
      for (let s = 0; s < 16; s++) {
        const t = T(s);
        if (fillOn && s >= 12) { INS.snap(t, 0.05 + (s - 12) * 0.012, dest); if (s === 12) INS.kick(t, 0.2, dest); continue; }
        if (GR.k.indexOf(s) >= 0) INS.kick(t, (s === 0 ? 0.22 : 0.17) * (c.groove === 'tropical' && s ? 0.85 : 1), dest);
        if (GR.s.indexOf(s) >= 0) INS[GR.sn](t, GR.sn === 'clap' ? 0.075 : GR.sn === 'snare' ? 0.07 : 0.08, dest);
        if (full && GR.h.indexOf(s) >= 0) INS.hat(t, (GR.acc && s % GR.acc === 0 ? 0.028 : 0.019) * (c.groove === 'half' ? 0.8 : 1), dest);
        if (full && GR.sh && s % 2 === 1) INS.shaker(t, 0.011, dest);
        if (c.jingle && full && !LITE && s % 4 === 2) noise(t, { f: 4200, q: 4, a: 0.002, d: 0.06, v: 0.012, dest: dest }); // soft sleigh bells
      }
      if (b % 4 === 3 && !fillOn && full) INS.kick(T(14), 0.14, dest);
    }
    if (S.type !== 'hush') seasonLayer(E, S, T, chAt, b);
    if (S.riser && b === S.n - 1) noise(t0, { f: 400, f2: 3200, q: 1.2, a: E.bar * 0.9, d: 0.08, v: 0.03, dest: dest });
    if (c.crackle && !LITE && S.type !== 'hush') for (let i = 0; i < 3; i++) noise(t0 + rnd() * E.bar, { type: 'highpass', f: 2500, q: 0.5, a: 0.001, d: 0.003, v: 0.006 + rnd() * 0.008, dest: dest });
    E.bi++; E.bars++; E.t += E.bar;
  }
  function musicTick() {
    const E = MU.E; if (!E || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // Music volume at 0 (or muted): write nothing, keep the clock (no CPU spent on a song nobody hears).
    if (VOL.music <= 0 || muted) { if (E.t < now + 0.1) E.t = now + 0.1; E.q.length = 0; E.qi = 0; return; }
    if (E.t < now - 0.05) { TM.skips++; E.t = now + 0.08; E.q.length = 0; E.qi = 0; } // after a stall or a suspend: pick up from now
    let guard = 0;
    while (E.t < now + TM.look + 0.1 && guard++ < 4) { // write the next bar into the queue
      const q0 = E.q.length; DQ = E.q;
      try { playBar(E); } catch (e) { ST.err = 'music: ' + e.message; E.t += E.bar; }
      DQ = null;
      if (E.q.length > q0) { const tail = E.q.splice(E.qi).sort((a, b) => a[0] - b[0]); for (const x of tail) E.q.push(x); }
    }
    flushMusic(E, now + TM.look);
  }
  function flushFx(until) {
    if (!FXQ.length) return;
    const now = ctx.currentTime; let k = 0; inMusic = true;
    const bus0 = B.sfxIn;
    try { for (; k < FXQ.length && FXQ[k][0] < until; k++) { const x = FXQ[k]; if (x[0] < now - 0.003) { TM.late++; TM.notes++; if (now - x[0] > TM.lateMax) TM.lateMax = now - x[0]; continue; } B.sfxIn = x[3] || bus0; x[1].apply(null, x[2]); } } catch (e) { ST.err = 'sfx: ' + e.message; }
    B.sfxIn = bus0; inMusic = false; if (k) FXQ.splice(0, k);
  }
  function flushMusic(E, until) {
    const q = E.q, now = ctx.currentTime; inMusic = true;
    try {
      while (E.qi < q.length && q[E.qi][0] < until) {
        const x = q[E.qi++];
        if (x[0] < now - 0.003) { TM.late++; TM.notes++; const d = now - x[0]; if (d > TM.lateMax) TM.lateMax = d; continue; } // too late: dropped, not smeared
        x[1].apply(null, x[2]);
      }
    } catch (e) { ST.err = 'music: ' + e.message; }
    inMusic = false;
    if (E.qi > 200) { q.splice(0, E.qi); E.qi = 0; }
  }
  // Look-ahead: how far ahead the next bar is written. Longer in lite (slow phones stall more); after a long gap between
  // updates (a busy frame, a GC) it grows to cover it, then eases back.
  const lookBase = () => (LITE ? 0.6 : 0.35);
  function sceneKey(name, opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    if (name === 'title' || name === 'story' || name === 'map') return name;
    if (name === 'board') { const th = o.tour !== undefined && o.tour !== null && o.tour !== false ? normTour(o.tour) : ''; return th ? 'tour:' + th : 'board:' + normArea(o.area); }
    if (name === 'tour') return 'tour:' + (normTour(o.tour !== undefined ? o.tour : o.theme !== undefined ? o.theme : opts) || TOURS[0]);
    if (name === 'event') return 'event:' + normWeek(opts);
    if (name === 'level') return 'level:' + normChapter(o);
    return '';
  }
  const MUSIC = {
    // MUSIC.scene('title' | 'board' | 'story' | 'map' | 'level' | null, {area} | {chapter, level, tense}) — crossfades; the same scene again is a no-op.
    //   v3 phase B: 'board' with {tour: theme} plays that island theme's song; 'event' with {week: key}. Never throws.
    scene(name, opts) {
      let key = '';
      try {
        key = sceneKey(name, opts);
        if (name === 'level') MU.tense = !!(opts && opts.tense);
        MU.want = key;
        if (OFF) return key; // an offline render is running: applied when it ends
        if (key && sleepWhy === 'quiet') wake(true);
        if (ctx && api.ready) startMusic(key);
      } catch (e) { ST.err = 'scene: ' + e.message; }
      return key;
    },
    // MUSIC.season('winter' | 'spring' | 'summer' | 'autumn' | 'auto') -> the active season; no argument reads it.
    // Estonian names work too (talv, kevad, suvi, sügis). Unknown keys keep the current season. Applies from the next bar.
    season(k) {
      if (k === undefined) return MU.season;
      if (k === null || k === 'auto' || k === true) { MU.seasonAuto = true; MU.season = dateSeason(); return MU.season; }
      const s = normSeason(k); if (s) { MU.season = s; MU.seasonAuto = false; }
      return MU.season;
    },
    seasons: SEASONS.slice(),
    tours: TOURS.slice(),
    weeks: WEEKS.slice(),
    stop() { return MUSIC.scene(null); },
    // MUSIC.mood('tense' | 'normal'): few moves left in a level -> a slightly faster tempo (no restart, no crossfade).
    mood(m) { MU.tense = m === 'tense' || m === true; return MU.tense ? 'tense' : 'normal'; },
    get tense() { return MU.tense; },
    chapters: CHAPTERS.slice(),
    cfg: CFG, // the song settings (tests and tools/mergeaudio.js tune vol, mud, pres here)
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
    B.duck = G(B.mute, 1); B.music = G(B.duck, musicGain());
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
  function pageFade(tc) { if (!B.page) return; const t = ctx.currentTime, g = B.page.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.0001, t); g.setTargetAtTime(1, t, tc); }
  function sync() {
    const was = api.ready; api.ready = !!ctx && !OFF && ctx.state === 'running';
    if (api.ready && !was) { if (!hidden && !sleepWhy) pageFade(fadeTc); fadeTc = 0.2; if (MU.want !== null && MU.key !== MU.want) startMusic(MU.want); }
  }
  function resumeCtx(then) {
    if (ctx.state === 'running' || ctx.state === 'closed' || !ctx.resume) { if (then) then(); return; }
    try { const p = ctx.resume(); if (p && p.then) p.then(then || sync, then || (() => {})); else if (then) then(); } catch (e) { if (then) then(); }
  }
  function unlock() {
    if (!ctx) {
      const AC = W.AudioContext || W.webkitAudioContext; if (!AC) return false;
      try { if (NAV.audioSession) NAV.audioSession.type = 'playback'; } catch (e) {}
      try { ctx = new AC({ latencyHint: LITE || ANDROID ? 'balanced' : 'interactive' }); build(); ctx.onstatechange = sync; timer = setInterval(tick, 100); }
      catch (e) { ST.err = 'unlock: ' + e.message; try { if (ctx && ctx.close) ctx.close(); } catch (e2) {} ctx = null; api.ready = false; return false; }
    }
    if (ctx.state !== 'running' && !hidden && !sleepWhy && !OFF) {
      // iPhone: the session type can reset after a call or Siri ('interrupted'); set it again before resuming.
      try { if (NAV.audioSession && NAV.audioSession.type !== 'playback') NAV.audioSession.type = 'playback'; } catch (e) {}
      // Older iPhones only unlock when a sound starts inside the gesture: a one-sample silent buffer does it.
      try { const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, sr); b.connect(ctx.destination); b.start(0); } catch (e) {}
      resumeCtx(sync);
    }
    sync();
    return api.ready;
  }
  // ---------- lifecycle: sleep (suspend) and wake, never a blast: the page gain is at 0 before a suspend and fades in after ----------
  function goSleep(why, fade) {
    if (!ctx || sleepWhy === why) return;
    sleepWhy = why; clearTimeout(sleepTimer); FXQ.length = 0;
    if (ctx.state === 'running' && B.page) { const t = ctx.currentTime, g = B.page.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(0, t, fade / 4); }
    sleepTimer = setTimeout(() => { if (sleepWhy && ctx.state === 'running' && ctx.suspend && !OFF) { try { const p = ctx.suspend(); if (p && p.then) p.then(sync, () => {}); } catch (e) {} } }, fade * 1000 + 60);
  }
  function wake(fast) {
    if (!sleepWhy || !ctx) return;
    const why = sleepWhy; sleepWhy = ''; clearTimeout(sleepTimer); lastSound = PNOW();
    if (why === 'idle') { const k = MU.want !== null ? MU.want : MU.key; if (k) { MU.key = ''; startMusic(k, true); } } // come back gently: the song starts again from its intro
    if (hidden) return;
    fadeTc = fast ? 0.03 : 0.2;
    if (ctx.state === 'running') { pageFade(fadeTc); fadeTc = 0.2; } // the suspend had not happened yet
    else unlock();
  }
  function lifeTick(now) {
    if (hidden || OFF || !ctx || ctx.state === 'closed') return;
    const silent = muted || (VOL.music <= 0 && VOL.sfx <= 0);
    if (silent) { if (sleepWhy !== 'silent') goSleep('silent', 0.3); return; }
    if (sleepWhy === 'silent') { wake(false); return; }
    if (sleepWhy || ctx.state !== 'running') return;
    let busy = false; const t = ctx.currentTime; for (const a of act) if (a.end > t) { busy = true; break; }
    if (now - lastInput > IDLE) goSleep('idle', 4);
    // quiet: also wait for every tail to end (a tail frozen by the suspend would play on at the next wake), at most 60 s
    else if ((!MU.key || VOL.music <= 0) && !busy && now - lastSound > 15000 && (ST.live <= 0 || now - lastSound > 60000)) goSleep('quiet', 0.3);
  }
  function setHidden(h) {
    hidden = !!h; if (!ctx || !B.page) return;
    clearTimeout(hideTimer);
    const now = ctx.currentTime;
    if (hidden) {
      FXQ.length = 0;
      B.page.gain.cancelScheduledValues(now); B.page.gain.setValueAtTime(B.page.gain.value, now); B.page.gain.setTargetAtTime(0, now, 0.03);
      hideTimer = setTimeout(() => { if (hidden && ctx.state === 'running' && ctx.suspend) { const p = ctx.suspend(); if (p && p.then) p.then(sync, () => {}); } }, 220);
    } else {
      lastInput = PNOW(); if (sleepWhy === 'idle') sleepWhy = ''; // coming back to the page counts as being here
      if (sleepWhy) { sync(); return; } // still muted or quiet: stay asleep
      const up = () => { sync(); if (!hidden && !sleepWhy && ctx.state === 'running') pageFade(0.25); };
      resumeCtx(up);
    }
  }
  if (DOC) {
    DOC.addEventListener('visibilitychange', () => setHidden(DOC.visibilityState === 'hidden'));
    W.addEventListener && W.addEventListener('pagehide', () => setHidden(true));
    W.addEventListener && W.addEventListener('pageshow', () => { if (DOC.visibilityState !== 'hidden') setHidden(false); });
    // Every gesture: counts as activity, wakes an idle or quiet context and, after an iPhone interruption (a call, Siri,
    // another app's audio), resumes it inside the gesture as iOS requires. The first gesture also unlocks the audio
    // even if the game forgets (the game calls AU.unlock() too).
    const gest = () => {
      lastInput = PNOW();
      if (!ctx) { unlock(); return; }
      if (sleepWhy === 'idle' || sleepWhy === 'quiet') wake(true);
      else if (!sleepWhy && !hidden && ctx.state !== 'running' && ctx.state !== 'closed') unlock();
    };
    if (W.addEventListener) ['pointerdown', 'touchend', 'click', 'keydown'].forEach((e) => W.addEventListener(e, gest, { capture: true, passive: true }));
  }
  function tick() {
    if (!ctx || OFF) return;
    const c0 = PNOW();
    if (ctx.state === 'running') {
      const gap = TM.last ? (c0 - TM.last) / 1000 : 0; TM.last = c0;
      if (gap > TM.updMax) TM.updMax = gap;
      const base = lookBase(); if (!TM.look) TM.look = base;
      TM.look = gap > TM.look * 0.6 ? Math.min(2, Math.max(TM.look, gap * 1.6)) : Math.max(base, TM.look * 0.997);
      musicTick(); flushFx(ctx.currentTime + TM.look); meterTick(); reap(ctx.currentTime);
      cpuAdd(c0);
    } else TM.last = 0;
    lifeTick(c0);
    if (MU.seasonAuto && MU.E && MU.E.bars % 64 === 0) MU.season = dateSeason(); // a session across midnight on the 1st
    const now = performance.now(); if (now - ST.nrT >= 5000) { const r = (ST.made - ST.nrMade) * 1000 / (now - ST.nrT || 1); ST.nodeRate = Math.round(ST.nrT ? (ST.nodeRate ? 0.5 * ST.nodeRate + 0.5 * r : r) : 0); ST.nrMade = ST.made; ST.nrT = now; } // nodes per second, averaged over 5 s windows
  }
  // Ramp a bus gain; at 0 it lands on exactly 0 (truly silent), and the sleep check runs at once.
  function rampTo(g, v) { const now = ctx.currentTime; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.setTargetAtTime(v, now, 0.04); if (v <= 0) g.setValueAtTime(0, now + 0.35); }
  const musicGain = () => 0.55 * VOL.music * (LITE ? LITE_MU : 1);
  function setVolume(kind, v) {
    if (!hasOwn(VOL, kind)) return;
    VOL[kind] = cl(+v || 0, 0, 1);
    if (!ctx || OFF) return;
    rampTo(kind === 'music' ? B.music.gain : B.sfx.gain, kind === 'music' ? musicGain() : VOL.sfx);
    lifeTick(PNOW());
  }
  function setMuted(b) {
    muted = !!b; if (muted) FXQ.length = 0;
    if (ctx && B.mute && !OFF) { rampTo(B.mute.gain, muted ? 0 : 1); lifeTick(PNOW()); }
    return muted;
  }
  function setLite(b) { LITE = !!b; if (ctx && !OFF) { revSet(!LITE); rampTo(B.music.gain, VOL.music > 0 ? musicGain() : 0); if (MU.E && !MU.E.dead) rampTo(MU.E.bus.gain, songVol(MU.E.c)); TM.look = 0; } return LITE; }

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

  // ---------- offline render (for tools/mergeaudio.js: the mix analysis, faster than real time) ----------
  // AU.render({ scene: ['board', {tour: 'spa'}], secs, lite, phone, season, events: [[t, name, opts] | [t, 'mood', 'tense'|'normal']] })
  //   -> Promise of { L, R, rate, made }: the master output after the clipper, at full volumes, with a fresh song.
  // The live context keeps its state; the game's sounds and the music scheduler pause while it renders.
  async function render(o) {
    if (OFF) throw new Error('render busy');
    const OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext; if (!OAC) throw new Error('no OfflineAudioContext');
    o = o || {};
    const rate = o.rate || 48000, secs = Math.max(1, +o.secs || 30), oc = new OAC(2, Math.ceil(rate * secs), rate);
    const keep = { rnd: rnd, ctx: ctx, sr: sr, NB: NB, REV: REV, LITE: LITE, PHONE: PHONE, B: Object.assign({}, B), WV: Object.assign({}, WV), MU: Object.assign({}, MU), combo: combo, lastMerge: lastMerge, made: ST.made, ready: api.ready };
    OFF = { t: 0 }; api.ready = false;
    try {
      ctx = oc; REV = null;
      if (o.seed) { let a = o.seed >>> 0; rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
      if (o.lite !== undefined) LITE = !!o.lite;
      if (o.phone !== undefined) PHONE = !!o.phone;
      for (const k in B) delete B[k];
      MU.E = null; MU.key = ''; MU.tense = false; MU.sinceRest = 0; combo = 0; lastMerge = -9;
      if (o.season) { const s = normSeason(o.season); if (s) MU.season = s; }
      build();
      B.music.gain.value = 0.55 * (LITE ? LITE_MU : 1); B.sfx.gain.value = 1; B.mute.gain.value = 1;
      const sc = o.scene || [null];
      if (sc[0]) { const key = sceneKey(sc[0], sc[1]); if (sc[1] && sc[1].tense) MU.tense = true; if (key) startMusic(key); }
      if (MU.E) MU.restAt = o.restAt || MU.restAt;
      const ev = (o.events || []).slice().sort((a, b) => a[0] - b[0]); let ei = 0;
      const feed = (until) => {
        const E = MU.E; let g = 0; while (E && E.t < until && g++ < 64) playBar(E);
        while (ei < ev.length && ev[ei][0] < until) {
          const x = ev[ei++]; OFF.t = x[0];
          if (x[1] === 'mood') MU.tense = x[2] === 'tense';
          else if (hasOwn(SFX, x[1])) { const so = x[2] && typeof x[2] === 'object' ? x[2] : {}, b0 = B.sfxIn; let gv = SFXG[x[1]]; if (typeof gv === 'function') gv = gv(so); if (gv && gv !== 1) B.sfxIn = G(b0, gv); try { SFX[x[1]](x[0], so); } finally { B.sfxIn = b0; } }
        }
      };
      feed(Math.min(secs, 2.5));
      for (let t = 1; t < secs - 0.5; t += 1) { const tt = t; oc.suspend(tt).then(() => { feed(tt + 2.5); oc.resume(); }); }
      const buf = await oc.startRendering();
      return { L: buf.getChannelData(0), R: buf.getChannelData(1), rate: rate, made: ST.made - keep.made, rest: MU.restAt };
    } finally {
      rnd = keep.rnd; ctx = keep.ctx; sr = keep.sr; NB = keep.NB; REV = keep.REV; LITE = keep.LITE; PHONE = keep.PHONE;
      for (const k in B) delete B[k]; Object.assign(B, keep.B); Object.assign(WV, keep.WV); Object.assign(MU, keep.MU);
      combo = keep.combo; lastMerge = keep.lastMerge; ST.made = keep.made; OFF = null;
      if (ctx) { sync(); if (MU.want !== null && MU.key !== MU.want && api.ready) startMusic(MU.want); }
      api.ready = !!ctx && ctx.state === 'running';
    }
  }
  // Scheduler timing since the last resetTiming(): notes, late notes, worst lateness (s), bars skipped after a stall,
  // the worst gap between updates (s), the look-ahead (s), and audio JS time (ms per second of wall time, worst call ms).
  function timing() {
    const secs = Math.max(0.001, (PNOW() - TM.t0) / 1000);
    return { notes: TM.notes, late: TM.late, lateMax: +TM.lateMax.toFixed(3), skips: TM.skips, updMax: +TM.updMax.toFixed(3), look: +(TM.look || lookBase()).toFixed(2), cpuMs: +(TM.cpu / secs).toFixed(2), cpuMax: +TM.cpuMax.toFixed(2), sfxMax: +TM.sfxMax.toFixed(2), secs: +secs.toFixed(1) };
  }
  function resetTiming() { TM.notes = TM.late = TM.lateMax = TM.skips = TM.updMax = TM.cpu = TM.cpuMax = TM.sfxMax = 0; TM.t0 = PNOW(); }
  const S_KEYS = (E) => (E.S.keys && E.S.comp ? E.c.keys + '/' + E.S.comp : '-') + (E.S.dr ? ' drums:' + E.c.groove : '');
  function stats() {
    const now = ctx ? ctx.currentTime : 0; let live = 0; for (const a of act) if (a.end > now) live++;
    const E = MU.E;
    return { ready: api.ready, state: ctx ? ctx.state : 'none', season: MU.season, live: ST.live, muted: muted, hidden: hidden, lite: LITE, phone: PHONE, vol: Object.assign({}, VOL), music: MU.key, section: E && E.S ? E.S.type + ' bar' + E.bi + '/' + E.S.n + ' cycle' + E.cycle + ' lead:' + (E.S.lead || '-') + ' keys:' + (S_KEYS(E)) + (E.tempo !== 1 ? ' tempo x' + E.tempo.toFixed(2) : '') : '', bars: E ? E.bars : 0, sinceRest: Math.round(MU.sinceRest), sfxLive: live, made: ST.made, nodeRate: ST.nodeRate, dropped: ST.dropped, names: Object.assign({}, ST.names), err: ST.err, reverb: !!REV, sleep: sleepWhy, page: B.page ? +B.page.gain.value.toFixed(4) : 0, musicGain: B.music ? +B.music.gain.value.toFixed(4) : 0, engines: (E ? 1 : 0) + MU.olds.filter((o) => now < o.fade[0] + 4 && o.fade[1] * Math.exp(-(now - o.fade[0]) / 0.45) > 0.01).length, idleIn: Math.max(0, Math.round((IDLE - (PNOW() - lastInput)) / 1000)), timing: timing(), meter: meterOut() };
  }

  const api = { ready: false, unlock: unlock, setVolume: setVolume, setMuted: setMuted, setLite: setLite, stats: stats, sfx: sfx, meter: meter, music: MUSIC, sounds: Object.keys(SFX), who: Object.keys(WHO), setHidden: setHidden, render: render, timing: timing, resetTiming: resetTiming,
    setIdle: (ms) => { IDLE = Math.max(1000, +ms || 240000); return IDLE; }, poke: () => { lastInput = PNOW(); if (sleepWhy === 'idle' || sleepWhy === 'quiet') wake(true); },
    get context() { return ctx; }, suspend: () => setHidden(true), resume: () => { if (!DOC || DOC.visibilityState !== 'hidden') setHidden(false); } };
  Object.defineProperty(api, 'muted', { get: () => muted, set: setMuted, enumerable: true });
  Object.defineProperty(api, 'lite', { get: () => LITE, set: setLite, enumerable: true });
  Object.defineProperty(api, 'volume', { get: () => Object.assign({}, VOL), enumerable: true });
  return api;
})();
const MUSIC = AU.music;
function sfx(name, opts) { return AU.sfx(name, opts); }
try { window.__saAudio = AU; window.__saMusic = MUSIC; } catch (e) {}
