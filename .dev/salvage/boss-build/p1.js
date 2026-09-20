/* =============================================================================
   BOSS.JS — "Palmer's Progress", the reckoning.
   THE EDITOR-IN-CHIEF: a House of the Dead style dossier card, a Dark Souls style
   drop from the sky that flattens the town, a fight where only the H-INDEX counts,
   then MANUSCRIPT ACCEPTED and a blast-off into space.
   Defines window.QuestBoss(api) only; all work happens inside start()/update().
   Everything is procedural: box geometry, canvas textures, WebAudio SFX.
   ============================================================================= */
(function () {
  'use strict';

  window.QuestBoss = function (api) {
    var THREE = api.THREE, scene = api.scene, camera = api.camera;
    var self = { active: false, cinematic: false, start: start, stop: stop, update: update, hitTest: hitTest };

    /* ------------------------------------------------------------ constants */
    var S = 5.6;                        // model units (a 3.16-unit box man) → world: about 17.7 units tall
    var COL_R = 3.4;                    // boss collider radius (2D)
    var BODY_R = 3.0, BODY_TOP = 13.4;  // body cylinder for shot tests
    var HEAD_Y = 14.4, HEAD_R = 2.7;
    var WEAK_R = 1.65;                  // generous sphere round the badge
    var ARENA_R = 46;
    var VANTAGE = { x: 4, z: 24 };
    var WAVE = 26;                      // landing shockwave speed (u/s): buildings burst as it reaches them
    var DEEP = { base: 70, wave: 'sawtooth', spread: 0.2 };
    var FONT = '"Press Start 2P", monospace';

    /* ------------------------------------------------------------ utils */
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function lerp(a, b, k) { return a + (b - a) * k; }
    function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
    function rand(a, b) { return a + Math.random() * (b - a); }
    function angDiff(a, b) { var d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); }
    function guard(fn) { try { return fn(); } catch (e) { if (window.console) console.error(e); } }
    function say(fn, arg) { try { api[fn](arg); } catch (e) {} }
    var V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), Q1 = new THREE.Quaternion();

    /* ------------------------------------------------------------ sfx (all synthesised) */
    var sfxBus = null, sfxComp = null, noiseBuf = null, liveSfx = [], sfxGate = {};
    function ac() { try { return api.audio(); } catch (e) { return null; } }
    function bus() {
      var a = ac(); if (!a) return null;
      if (!sfxBus || sfxBus.context !== a) {
        sfxBus = a.createGain(); sfxBus.gain.value = 0.5;
        sfxComp = a.createDynamicsCompressor(); sfxBus.connect(sfxComp); sfxComp.connect(a.destination);
      }
      return sfxBus;
    }
    function gate(name, secs) {      // rate limit by wall clock so a hail of shots cannot stack a hundred voices
      var now = Date.now(); if (sfxGate[name] && now - sfxGate[name] < secs * 1000) return false; sfxGate[name] = now; return true;
    }
    function tone(o) {
      try {
        var b = bus(); if (!b) return null; var a = b.context, t = a.currentTime + (o.delay || 0);
        var osc = a.createOscillator(), g = a.createGain();
        osc.type = o.type || 'square'; osc.frequency.setValueAtTime(o.f0, t);
        if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.1, t + (o.attack || 0.006));
        g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
        osc.connect(g); g.connect(b); osc.start(t); osc.stop(t + o.dur + 0.03);
        return { src: osc, gain: g };
      } catch (e) { return null; }
    }
    function noise(o) {
      try {
        var b = bus(); if (!b) return null; var a = b.context, t = a.currentTime + (o.delay || 0);
        if (!noiseBuf || noiseBuf.sampleRate !== a.sampleRate) {
          noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); var d = noiseBuf.getChannelData(0);
          for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        var n = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
        n.buffer = noiseBuf; n.loop = true;
        f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.8; f.frequency.setValueAtTime(o.f0, t);
        if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(10, o.f1), t + o.dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.1, t + (o.attack || 0.008));
        if (o.hold) g.gain.setValueAtTime(o.gain || 0.1, t + o.hold);
        g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
        n.connect(f); f.connect(g); g.connect(b); n.start(t); n.stop(t + o.dur + 0.03);
        return { src: n, gain: g };
      } catch (e) { return null; }
    }
    function keep(h) { if (h) liveSfx.push(h); return h; }
    function killSfx() {
      liveSfx.forEach(function (h) { try { h.gain.gain.cancelScheduledValues(0); h.gain.gain.value = 0; h.src.stop(); } catch (e) {} });
      liveSfx.length = 0;
    }
    var SFX = {
      clank: function () { if (!gate('clank', 0.07)) return; tone({ f0: rand(1500, 1900), f1: 700, dur: 0.06, type: 'square', gain: 0.07 }); noise({ f0: 3200, dur: 0.05, type: 'bandpass', q: 4, gain: 0.08 }); },
      block: function () { if (!gate('block', 0.07)) return; tone({ f0: rand(420, 520), f1: 180, dur: 0.09, type: 'triangle', gain: 0.12 }); noise({ f0: 900, dur: 0.06, type: 'bandpass', q: 2, gain: 0.07 }); },
      ping: function (k) { var f = 560 * Math.pow(2, clamp(k, 0, 1) * 1.75); tone({ f0: f, f1: f * 1.02, dur: 0.13, type: 'triangle', gain: 0.16 }); tone({ f0: f * 2, dur: 0.07, type: 'sine', gain: 0.06 }); },
      whoosh: function () { if (!gate('whoosh', 0.09)) return; noise({ f0: 350, f1: 1900, dur: 0.32, type: 'bandpass', q: 1.4, gain: 0.1, attack: 0.05 }); },
      charge: function (dur) { keep(tone({ f0: 70, f1: 320, dur: dur, type: 'sawtooth', gain: 0.06, attack: dur * 0.7 })); },
      roar: function () {
        keep(tone({ f0: 92, f1: 40, dur: 1.9, type: 'sawtooth', gain: 0.3, attack: 0.12 })); keep(tone({ f0: 61, f1: 33, dur: 2.0, type: 'square', gain: 0.16, attack: 0.2 }));
        keep(noise({ f0: 900, f1: 180, dur: 1.8, type: 'bandpass', q: 0.9, gain: 0.22, attack: 0.15 }));
      },
      thud: function (g) { tone({ f0: 95, f1: 30, dur: 0.5, type: 'sine', gain: 0.5 * g, attack: 0.004 }); noise({ f0: 260, f1: 60, dur: 0.45, gain: 0.35 * g }); },
      impact: function () {
        tone({ f0: 120, f1: 24, dur: 1.6, type: 'sine', gain: 0.7, attack: 0.004 }); tone({ f0: 55, f1: 28, dur: 1.2, type: 'sawtooth', gain: 0.25 });
        keep(noise({ f0: 1400, f1: 50, dur: 2.4, gain: 0.55 })); noise({ f0: 5000, f1: 800, dur: 0.5, type: 'highpass', gain: 0.12 });
      },
      whistle: function (dur) { keep(tone({ f0: 2600, f1: 260, dur: dur, type: 'sine', gain: 0.1, attack: dur * 0.5 })); keep(noise({ f0: 3000, f1: 400, dur: dur, type: 'bandpass', q: 3, gain: 0.06, attack: dur * 0.6 })); },
      omen: function (dur) { keep(noise({ f0: 90, f1: 260, dur: dur, gain: 0.3, attack: dur * 0.8 })); keep(tone({ f0: 38, f1: 52, dur: dur, type: 'sine', gain: 0.3, attack: dur * 0.8 })); },
      stroke: function () { if (!gate('stroke', 0.06)) return; noise({ f0: 4200, f1: 500, dur: 0.12, type: 'bandpass', q: 2, gain: 0.1 }); tone({ f0: 140, f1: 50, dur: 0.18, type: 'sine', gain: 0.22 }); },
      puff: function () { if (!gate('puff', 0.1)) return; noise({ f0: 700, f1: 150, dur: 0.14, gain: 0.07 }); },
      shatter: function () { for (var i = 0; i < 9; i++) tone({ f0: rand(1400, 4200), f1: rand(700, 1500), dur: rand(0.12, 0.4), type: 'triangle', gain: 0.07, delay: i * 0.035 }); noise({ f0: 6000, f1: 1500, dur: 0.6, type: 'highpass', gain: 0.14 }); },
      boom: function () { tone({ f0: 80, f1: 22, dur: 1.4, type: 'sine', gain: 0.6, attack: 0.005 }); keep(noise({ f0: 900, f1: 40, dur: 2.0, gain: 0.5 })); },
      count: function (go) { tone({ f0: go ? 880 : 440, dur: go ? 0.5 : 0.16, type: 'square', gain: 0.1 }); },
      rocket: function (dur) { keep(noise({ f0: 120, f1: 2400, dur: dur, gain: 0.5, attack: 1.2, hold: dur * 0.8 })); keep(tone({ f0: 45, f1: 160, dur: dur, type: 'sawtooth', gain: 0.18, attack: 1.0 })); },
      type: function () { if (gate('type', 0.045)) blipSafe(1320, 0.03, 'square'); }
    };
    function blipSafe(f, d, w) { try { api.blip(f, d, w); } catch (e) {} }

