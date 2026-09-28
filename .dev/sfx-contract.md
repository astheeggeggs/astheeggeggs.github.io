# FPSFX — the first-person sound kit (contract, 2026-09-27)

`assets/js/fpsfx.js` defines `window.FPSFX`: one synthesised sound kit shared by `quest.js` (the paper-ball gun,
the BFG, reviewers, hearts, REJECTED!), `boss.js` (THE EDITOR-IN-CHIEF) and `magician.js` (REVIEWER 2). It replaces
the ad-hoc `tone()/noise()/blip()` SFX in those files. The character is DOOM crossed with THE HOUSE OF THE DEAD 1/2.
Nothing is sampled: every sound is synthesised in JS, then played from a cached AudioBuffer.

Load order: `_layouts/default.html` loads `fpsfx.js` (defer) after `cave.js` and before `boss.js`, so `FPSFX` exists
before any boss module or `quest.js` runs. `.dev/bundle-artifact.py` bundles it in the same place.

## API

```js
var k = FPSFX.kit(api.audio());   // one kit per AudioContext, cached: calling kit(ac) again returns the same kit
var h = k.play('gun');            // → handle (never throws; unknown or rate-gated names return a dead handle, h.ok === false)
```

`FPSFX` (static, no AudioContext needed)
| call | returns |
|---|---|
| `FPSFX.kit(ac)` | the kit bound to `ac` (a no-op kit if `ac` is missing, so hosts never need to guard) |
| `FPSFX.names()` / `FPSFX.has(name)` | every name / whether a name exists |
| `FPSFX.info(name)` / `FPSFX.list()` | `{name, use, len, level, vary, gate, poly, variants, loop, bake, crush, dur, pitch}` (`pitch`: `{span: 19, step: 2}` on `hit.weak`/`hit.crit`, else null; `level` of those two is at k = 0) |
| `FPSFX.steps()` | the semitones `hit.weak` / `hit.crit` are rendered at: `[0,2,4,…,20]` (k itself is continuous, see `k` below) |
| `FPSFX.render(name, sampleRate, opts)` | `{data: Float32Array, sampleRate, loop, key, rate}`: pure synthesis for offline tests; `rate` is the playback rate the kit adds for the pitch not rendered in (before its random `vary`) |
| `FPSFX.stats()` | `{renders, ms, samples}` rendered so far |

The kit
| call | what |
|---|---|
| `k.play(name, opts)` | play one sound now (or after `opts.delay`) → handle |
| `k.warm(items?, done?)` | render ahead a buffer at a time, yielding (setTimeout 0) once 12 ms of work has passed since the last yield, then `done(ms)`. A buffer is never split, so one tick blocks for at least its slowest buffer (Performance, below). `items`: one name, one `{name, dur}` (a length-baked sound at the length you will play), or a list of either. Default: every name at its default length. Never throws. |
| `k.prerender(items?)` | the same, synchronously → ms (tests; do not call mid-game) |
| `k.setListener(obj)` | default listener for positioned plays: a THREE camera/Object3D (uses `matrixWorld`) or `{x, y, z, yaw}` |
| `k.stopAll(fade = 0.05, group?)` | stop every voice, scheduled plays too; with `group`, only the voices played with that `opts.group`. It cuts a slow `h.stop(3)` / `h.fade(0, 3)` already under way (a stop always ends a voice at the sooner of the two ends) |
| `k.volume(x)` | bus input gain (default 1) |
| `k.setVoices(n)` | global voice cap (default 24, 1..64) |
| `k.voices()` / `k.info()` | live voices / `{voices, cap, nodes, renders, renderMs, samples}` |
| `k.bus`, `k.ac` | the bus input GainNode, the context |

`play` options (all optional)
| opt | meaning |
|---|---|
| `gain` | level multiplier (default 1) |
| `pitch` | semitones. On `hit.weak`/`hit.crit` it is rendered at the nearest even semitone and the rest (at most 1 semitone) is playback rate, so the length changes by at most 6%; elsewhere it is all playback rate |
| `k` | 0..1, `hit.weak`/`hit.crit` only: 0 → 19 semitones, continuously (660 Hz → 1976 Hz). Use `k = 1 - hp / maxHp`: every hit is a little higher than the last (at 100 HP and 1 HP a hit, 100 distinct pitches). `pitch` wins if both are given |
| `rate` | playback-rate multiplier |
| `vary` | random pitch spread, ± semitones, per play (Doom-style). Default per sound (table); `vary: 0` for exact |
| `variant` | pick a variant index; otherwise a random one, never the same twice running |
| `delay` | seconds from now |
| `dur` | length-baked sounds (`bfg.charge`, `windup`, `hiss`, `omen`, `whistle`, `rocket`): the length to render (quantised to 0.05 or 0.1 s, cached per length). Loops (`flame`, `drone`, `wind`): run this long, then fade out by themselves |
| `fade` | the fade-out at the end of a looped `dur` (default 0.25 s) |
| `attack` | fade-in seconds (loops default 0.03) |
| `ttl` | watchdog: the voice fades out unless `h.feed()` is called within `ttl` seconds (a per-frame hum that must die with the frames) |
| `pan` | -1..1 |
| `pos`, `listener`, `ref`, `floor` | positioned: `{x, y, z}` in world units; pan from the listener's right vector (max ±0.85), gain 1 inside `ref` (default 6), then `ref/d`, never below `floor` (default 0.25). `listener` defaults to `k.setListener()` |
| `gate` | override the per-name rate gate (seconds; 0 disables) |
| `group` | a tag for `k.stopAll(fade, group)`: `'boss'`, `'quest'`, … |

Handle: `h.ok`, `h.name`, `h.t0`, `h.stop(fade = 0.04)`, `h.fade(to, secs)` (`to` multiplies the play gain; `to <= 0` is
`h.stop(secs)`; a loop's `dur` tail and a `ttl` watchdog survive a level change), `h.feed()` (for `ttl`), `h.place(pos,
listener?)` (move a positioned voice), `h.playing()`. Every method is safe on a dead handle. Stops only ever shorten: a
quicker stop cuts a slower one under way, a slower one never lengthens a quicker one.

Rules the kit enforces: a per-name rate gate (a second play of the same name inside `gate` seconds is dropped), per-name
polyphony (`poly`: the oldest of that name is stolen) and a global cap of 24 (the oldest one-shot is stolen before any
loop). Steals fade over 10 ms. Voices are counted over the time they will actually sound: a new voice is checked at its
own start and at the start of every voice already scheduled inside its span, and a steal happens at that moment. So a
volley scheduled ahead with `delay` plays in full, and an immediate burst on top of it cannot exceed the cap either
(measured: 24 scheduled + 24 immediate long sounds → 24 sounding; 3 + 3 explosions → 3).

## The bus and levels

One bus per context: input gain → DynamicsCompressor (threshold -6 dB, knee 3, ratio 12, attack 1 ms, release 120 ms)
→ trim 0.728 → a WaveShaper soft ceiling (linear to 0.6, never above 0.8) → destination. Measured in Chrome at 48 kHz:
- Small-signal gain of the bus 1.00 (the trim cancels Chrome's automatic makeup gain, measured ×1.373).
- A new DynamicsCompressor starts in deep reduction and takes ~100 ms to open (a shot at creation came out at 0.11 of
  0.6). The bus therefore opens on a direct path, delayed by the compressor's 6 ms look-ahead, and crossfades onto the
  limiter over 250 ms.
- Each sound alone after warm-up: peak ≤ 0.62 (table). Eleven of the heaviest sounds at once plus a gun burst: peak
  0.72-0.73 in steady state and 0.793 at bus creation (the ceiling). Sustained fire (the gun every 0.13 s) peaks at 0.49
  and the limiter does nothing to it; with a `hit.weak` after every shot it takes 0.5 dB off (1.1 dB at the 95th
  percentile).

Loudness is measured as the A-weighted level over 50 ms windows (hop 10 ms), in dB re an RMS of 1, so a full-scale
1 kHz sine reads -3.0 (meter controls: 100 Hz -22.2, silence -150). The `loud` column is each sound's loudest 50 ms.
Levels are still set by peak (`level`), but the kit was balanced against these figures:
- The music, for reference (the 60 s magician render): median -21.3, 95th percentile -16.0, loudest -14.0; its loud
  stretch (30-50 s) median -18.1.
- The gun: -14.3 to -14.7 (every variant), louder than the `hit.flesh` / `hit.armour` it triggers (-16.7 at most).
  Its energy is in the crack: 47-48% at 2-5 kHz, 14-19% below 150 Hz, centroid 2.7-3.4 kHz; sparse paper crackles
  follow it from 40 ms. Sustained fire has a median of -19.3 and falls about 31 dB between shots (never less than 27);
  mixed into the magician music's loud stretch it raises the A-weighted level by 2.6 dB and the 2-5 kHz band by 5.1 dB,
  so a miss is heard. The gun and `hit.block` are far apart: their fingerprint distance (the mean |dB| difference over
  18 log bands × 20 ms frames) is 13-14 dB, against 2.5-5.8 between variants of one sound and a kit median of 15.5.
- `hit.weak`: one strike, -17.5 to -17.9 at every k (the level falls 3.5 dB over the climb to offset the brighter top).
  Hitting the badge at the fire rate: median -22.7, 95th percentile -18.0, below the music's 95th percentile, and
  silent between strikes (10 ms level 5th percentile -44). The Magician's chain (a crit every fourth hit, `hit.flesh`
  at 0.45 under each): median -18.5, 95th percentile -15.7.
- Attack cues: `windup` (dur 1) rises from -28.8 in its first eighth to -15.4, median -21.5; the `flame` loop has a
  median of -23.2; `stomp` -23.2 at full gain; `hit.block` -17.8 to -19.0.
- Voices and big events sit above the music on purpose: `enemy.pain` / `boss.screech` -10.4 to -10.7,
  `player.death` -9.6. UI blips sit at -16 to -19 (`ui.confirm` -17.1, `pickup` -15.9, `warning` -15.9).
- Music and effects are two contexts (Riff has its own), each limited on its own. Their sum is not: in a 20 s busy fight
  (sustained fire on the badge, roars, orb bursts, slams with explosions, hurts, BFG shots; SFX peak 0.71) mixed with
  the magician music (peak 0.72), the sum peaked at 1.16-1.20, with 65-125 samples above 1.0 in 27-44 runs of at most
  14 samples (0.3 ms). [ASSUMPTION: the browser/OS sums the two linearly and clips at ±1.] Runs that short are not
  audible, so the ceiling stays at 0.8 rather than squashing every loud moment of the kit.

The kit's output goes to `ac.destination` of the host's context (quest.js's `AC`); Riff plays on its own context.

## Performance

Rendering is lazy (first play) or ahead (`warm`). All 89 default buffers (66.9 s of audio, every variant, every
rendered `hit.weak`/`hit.crit` step, each length-baked sound at its default length) took 820 ms on the running game
page in headless Chrome at 48 kHz (2.0 s in another run while the machine sat at a load average of ~45 from other test
browsers; the previous revision measured 736-857 ms). In Node on the same machine the whole set takes the same time as
the previous revision (best of three: 1089 against 1133 ms). A buffer cannot be split, so the longest main-thread block of `warm()` is its
slowest buffer. Measured first renders (not cached; the low figure is this revision's run on a fresh page at 44.1 kHz,
the high one the runtime review's on the game page at 48 kHz): `flame` 24-99 ms, `boss.roar` 28-61 ms, `quake` 21-55 ms,
`rocket` 56 ms at dur 4.2 and up to 119 ms at dur 8, `omen` 54 ms at dur 3 and 85 ms at dur 8, `windup` 33 ms at
dur 2.2; a whole `k.warm()` on a fresh page had 6 long tasks, the longest 109 ms. So: **call `k.warm([...])` at a
non-interactive moment (the dossier card, the WARNING card), with the exact names and lengths you will play**
(`{name: 'windup', dur: D}` for every D), and never let a big sound's first play land mid-fight. Each play costs one
BufferSource and one GainNode (two more nodes if positioned). Buffers are cached per sample rate and shared across kits.

## The names

`len` s = default length (loops: loop length); `level` = peak of the rendered buffer (`hit.weak`/`hit.crit`: at k 0 →
at k 1); `bus` = peak / 50 ms RMS out of the bus (measured in Chrome, alone, after warm-up); `loud` = loudest
A-weighted 50 ms, dB (see above; `hit.weak`/`hit.crit` the loudest over k 0, 0.5, 1); `vary` ± semitones; `gate` s /
`poly`; grit: synthesis rate/bits (Doom-style sample-and-hold, no interpolation) or clean (HotD, synthesised at
≤ 32 kHz and interpolated up).

| name | len | level | bus | loud | vary | var | gate / poly | baked | grit | for |
|---|---|---|---|---|---|---|---|---|---|---|
| `gun` | 0.3 | 0.48 | 0.48 / 0.179 | -14.3 | 0.7 | 3 | 0.05 / 4 |  | clean | the paper-ball rebuttal leaving the hand (quest.js fire()) |
| `reload` | 0.36 | 0.6 | 0.567 / 0.077 | -22.0 | 0.5 | 1 | 0.2 / 1 |  | clean | the gun readied: entering first person, after RESUBMIT |
| `click` | 0.07 | 0.35 | 0.35 / 0.025 | -30.3 | 1 | 1 | 0.04 / 2 |  | clean | a dry click: a trigger that does nothing, a menu tick |
| `bfg.charge` | 0.7 | 0.55 | 0.542 / 0.177 | -14.4 | 0.3 | 1 | 0.1 / 1 | dur 0.7 (0.2-3) | 11.025k/8b | the BFG wind-up; pass dur = the wind-up (BFG_WIND) |
| `bfg.fire` | 1.15 | 0.8 | 0.611 / 0.306 | -17.2 | 0.4 | 1 | 0.15 / 2 |  | 11.025k/8b | the BFG discharging (fireBfg()) |
| `bfg.blast` | 1.6 | 0.8 | 0.604 / 0.26 | -15.3 | 0.8 | 1 | 0.08 / 3 |  | 11.025k/8b | a BFG ball bursting on anything (body, weak point, ground, a reviewer) |
| `plasma` | 0.24 | 0.45 | 0.45 / 0.138 | -17.6 | 1.5 | 2 | 0.04 / 4 |  | 11.025k/8b | an electrical zap: BFG sparks, a failing light, a short circuit |
| `hit.flesh` | 0.3 | 0.55 | 0.542 / 0.162 | -16.7 | 2 | 3 | 0.03 / 3 |  | clean | a shot into flesh that is not a weak point: a reviewer, the Magician's sinew |
| `hit.armour` | 0.5 | 0.5 | 0.5 / 0.122 | -16.7 | 1.5 | 3 | 0.04 / 3 |  | clean | a shot off armour: the Magician's bone plates, the editor's tenure (body) |
| `hit.block` | 0.2 | 0.65 | 0.585 / 0.124 | -17.8 | 1.5 | 2 | 0.04 / 3 |  | clean | a shot stopped by the editor's journal-cover guard (cardboard, not metal) |
| `hit.weak` | 0.17 | 0.44 → 0.29 | 0.44 / 0.153 | -17.5 | 0.15 | 1 | 0.02 / 3 | k / pitch | clean | a weak-point hit (H-INDEX badge, CONFLICTS OF INTEREST); k = 1 - hp/maxHp raises the pitch |
| `hit.crit` | 0.42 | 0.46 → 0.31 | 0.46 / 0.178 | -15.7 | 0.1 | 1 | 0.03 / 2 | k / pitch | clean | a critical weak-point hit (the Magician's every-fourth chained hit, the BFG on the badge); same k |
| `enemy.pain` | 0.44 | 0.6 | 0.567 / 0.24 | -10.7 | 2.5 | 3 | 0.08 / 2 |  | 11.025k/8b | a reviewer hit but not retired ("I REMAIN UNCONVINCED"); a boss flinch |
| `gib` | 0.7 | 0.7 | 0.597 / 0.227 | -16.6 | 1.5 | 1 | 0.1 / 2 |  | 11.025k/8b | a meaty splat: something coming apart (a boss's last hit, a messy retirement) |
| `boss.roar` | 2.3 | 0.8 | 0.604 / 0.196 | -18.4 | 1.2 | 1 | 0.5 / 2 |  | 11.025k/8b | a boss roar: the editor landing and changing phase, a big entrance |
| `boss.screech` | 1.35 | 0.65 | 0.584 / 0.313 | -10.4 | 1.2 | 1 | 0.4 / 2 |  | 16k/10b | a creature screech (the Magician hurt, enraged, or arriving) |
| `boss.laugh` | 1.3 | 0.65 | 0.584 / 0.307 | -12.6 | 1 | 1 | 0.6 / 1 |  | 16k/10b | the Magician's laugh (arrival, phase change, exit) |
| `windup` | 1.06 | 0.6 | 0.567 / 0.175 | -15.4 | 0.5 | 1 | 0.2 / 1 | dur 1 (0.3-4) | 11.025k/8b | a boss attack winding up; pass dur = the wind-up (boss.js charge(F.dur)) |
| `hiss` | 0.88 | 0.45 | 0.45 / 0.129 | -17.4 | 1 | 1 | 0.15 / 2 | dur 0.8 (0.2-3) | clean | the Magician's hiss before an attack or while exposed; pass dur |
| `fireball.launch` | 0.5 | 0.55 | 0.542 / 0.253 | -12.0 | 2 | 2 | 0.05 / 4 |  | 11.025k/8b | a fireball thrown (the Magician's burning manuscripts, the editor's orbs) |
| `fireball.burst` | 0.65 | 0.6 | 0.568 / 0.219 | -13.3 | 2 | 2 | 0.04 / 4 |  | 11.025k/8b | a fireball bursting: shot down, or landing (orb pop, ink stroke landing) |
| `crackle` | 0.22 | 0.35 | 0.35 / 0.03 | -29.3 | 3 | 3 | 0.06 / 3 |  | clean | a few pops of flame: a manuscript catching, scorch trails |
| `teleport` | 0.62 | 0.6 | 0.568 / 0.176 | -14.1 | 0.8 | 1 | 0.15 / 2 |  | clean | a teleport out: a reversed swell that stops dead |
| `appear` | 0.8 | 0.65 | 0.585 / 0.204 | -14.7 | 1 | 1 | 0.12 / 2 |  | clean | a teleport in: arrival in a column of flame |
| `flame` | 2.4 | 0.6 | 0.568 / 0.177 | -19.3 | 1 | 1 | 0.1 / 3 | loop | clean | LOOP: burning ground, a flame column, the line of fire; pass dur or stop() |
| `drone` | 2 | 0.45 | 0.45 / 0.205 | -26.7 | 0 | 1 | 0.2 / 2 | loop | clean | LOOP: a menacing hum (the desperation ring); play with ttl, feed() every frame |
| `wind` | 4 | 0.4 | 0.4 / 0.117 | -20.2 | 0 | 1 | 0.5 / 1 | loop | clean | LOOP: an ill wind before the Magician arrives; pass dur |
| `dispel` | 0.8 | 0.5 | 0.5 / 0.182 | -13.5 | 0.5 | 1 | 0.2 / 1 |  | clean | a curse lifted (the Magician's ring of fire dispelled) |
| `dash` | 0.55 | 0.6 | 0.567 / 0.213 | -14.8 | 1.5 | 1 | 0.15 / 2 |  | clean | a lunge: the Magician's dash |
| `whoosh` | 0.4 | 0.4 | 0.4 / 0.12 | -18.1 | 2 | 2 | 0.08 / 3 |  | clean | something light flying past: an orb lobbed, an ink stroke falling |
| `slam` | 0.85 | 0.8 | 0.602 / 0.328 | -17.1 | 1 | 1 | 0.1 / 2 |  | 22.05k/10b | a heavy ground hit: the editor's shockwave ring, the Magician's line of fire starting |
| `stomp` | 0.4 | 0.6 | 0.568 / 0.261 | -23.2 | 1.5 | 1 | 0.1 / 2 |  | clean | a giant footstep (the editor walking); scale gain by distance |
| `quake` | 3 | 0.85 | 0.616 / 0.304 | -17.6 | 0.5 | 1 | 0.5 / 1 |  | 11.025k/8b | the enormous landing (the editor falling on the town) |
| `explosion` | 1.8 | 0.85 | 0.61 / 0.271 | -14.8 | 1.5 | 2 | 0.08 / 3 |  | 11.025k/8b | a big explosion (a boss blowing apart) |
| `shatter` | 0.95 | 0.6 | 0.568 / 0.141 | -16.8 | 1 | 1 | 0.2 / 2 |  | clean | armour or glass shattering (the editor's death, the Magician's plates falling) |
| `snap` | 0.2 | 0.7 | 0.598 / 0.096 | -18.1 | 1 | 1 | 0.08 / 2 |  | clean | a finger snap (the Magician: "I WAS NEVER HERE.") |
| `omen` | 3.1 | 0.6 | 0.566 / 0.3 | -28.7 | 0 | 1 | 1 / 1 | dur 3 (0.5-8) | 11.025k/8b | a rumbling swell before a boss arrives (silence, then this); pass dur |
| `whistle` | 2.03 | 0.5 | 0.5 / 0.285 | -13.7 | 0 | 1 | 1 / 1 | dur 2 (0.5-6) | clean | something falling from the sky (the editor's drop); pass dur |
| `rocket` | 4 | 0.75 | 0.602 / 0.28 | -15.6 | 0 | 1 | 1 / 1 | dur 4 (1-8) | 22.05k/10b | ignition and a rocket roar (the blast-off); pass dur |
| `player.pain` | 0.36 | 0.7 | 0.591 / 0.295 | -10.6 | 1 | 2 | 0.25 / 1 |  | 11.025k/8b | the player hit (api.hurt): the grunt; pair with heart.lost |
| `heart.lost` | 0.58 | 0.45 | 0.45 / 0.258 | -12.7 | 0 | 1 | 0.3 / 1 |  | clean | a heart gone: the harsh arcade damage sting |
| `player.death` | 2 | 0.8 | 0.606 / 0.358 | -9.6 | 0.5 | 1 | 1 / 1 |  | 11.025k/8b | REJECTED!: the death scream and the body hitting the floor |
| `pickup` | 0.18 | 0.2 | 0.2 / 0.149 | -15.9 | 0 | 1 | 0.05 / 2 |  | 11.025k/8b | an item picked up (FACT FOUND, a heart) |
| `powerup` | 1.05 | 0.55 | 0.542 / 0.204 | -13.4 | 0 | 1 | 0.5 / 1 |  | 22.05k/8b | a power-up: the BFG handed over |
| `victory` | 1.7 | 0.6 | 0.568 / 0.179 | -15.1 | 0 | 1 | 1 / 1 |  | 22.05k/10b | a boss beaten: the short fanfare under REBUTTAL/MANUSCRIPT ACCEPTED |
| `ui.confirm` | 0.3 | 0.2 | 0.2 / 0.128 | -17.1 | 0 | 1 | 0.05 / 2 |  | clean | a menu confirm: PRESS START, RESUBMIT, a talk prompt accepted |
| `ui.tick` | 0.18 | 0.24 | 0.24 / 0.164 | -18.7 | 0 | 1 | 0.2 / 1 |  | clean | a countdown beep (3, 2, 1) |
| `ui.go` | 0.55 | 0.22 | 0.22 / 0.145 | -16.8 | 0 | 1 | 0.2 / 1 |  | clean | the countdown's GO |
| `ui.type` | 0.04 | 0.25 | 0.25 / 0.024 | -Infinity | 2 | 1 | 0.04 / 2 |  | clean | a keystroke of the dossier card typing out |

## Wiring (as shipped; old call → new)

The kit is `var sfx = FPSFX.kit(api.audio())` in each boss module (lazily, or on `start()`), and quest.js's own `AC`.
**`api.audio()` IS quest.js's `AC`, so every module shares ONE kit.** Tag your plays (`{group: 'boss'}`) and stop only
your own in `stop()` with `sfx.stopAll(0.1, 'boss')` (this replaces `killSfx()`); an untagged `stopAll` would also cut
quest.js's sounds (the REJECTED! scream). `setListener` and `volume` are shared too: set the listener once
(`sfx.setListener(api.camera)`) and pass `pos` for sounds that come from the boss, so they pan.

quest.js (first person exists only in the endgame now, so reviewers are never shot)
| event | before | FPSFX |
|---|---|---|
| `fire()` paper ball | `blip(1200)` + `blip(300)` | `gun` (not while the boss card or the swoop is up) |
| BFG wind-up | `bfgTone(120→900)` ×2 | `bfg.charge {dur: BFG_WIND}` |
| `fireBfg()` | three `bfgTone`s | `bfg.fire` |
| a plasma ball bursting | `bfgTone(140→40)` | `bfg.blast {pos, ref: 14}` |
| "THAT WAS A COLLEAGUE" | `blip(200)` | `hit.flesh {pos, gain: 0.6}` |
| `hurt()` | `grunt()` | `player.pain`, then `heart.lost {delay: 0.15}` (god mode: `player.pain` only) |
| `rejected()` | two `blip` thuds | `stopAll`, then `player.death` |
| end of the swoop into first person | two blips | `reload {delay: FP_READY}` (the boss modules own the card's sounds) |
| retry after REJECTED! | `blip(440)` | `reload {delay: 0.2}` (the boss module makes the confirm) |
| a jump in first person | town blips | `whoosh {pitch: 5, gain: 0.45, gate: 0}`, landing `stomp {pitch: 6, gain: 0.5, gate: 0}` |

boss.js (the editor)
| `SFX.` | FPSFX |
|---|---|
| `ping(k)` | `hit.weak {k}` |
| `plasma(k)` (BFG on the badge) | `hit.crit {k}` + `bfg.blast` |
| `block()` | `hit.block` |
| `clank()` | `hit.armour` |
| `blast()` (BFG on the body) | `bfg.blast` |
| `whoosh()` | `whoosh` or `fireball.launch` (orbs) |
| `puff()` (orb pop) / `stroke()` | `fireball.burst {gain: 0.6}` / `fireball.burst` |
| `charge(dur)` | `windup {dur}` |
| `roar()` | `boss.roar` |
| `thud(0.16)` walking / `thud(0.95)` ring | `stomp` (full gain) / `slam` |
| building debris on landing | `slam {pos, gain: near}` |
| `omen(len)` / `whistle(len)` / `impact()` | `omen {dur}` / `whistle {dur}` / `quake` |
| `shatter()` / `boom()` | `shatter` / `explosion` (+ `gib`) |
| `count(false/true)` | `ui.tick` / `ui.go` |
| the death swell | `omen {dur: 1.2}` + `windup {dur: 1.2, gain: 0.5, gate: 0}` |
| a rain mark (warning tick) | `ui.tick {pitch: -7, gain: 0.8}` |
| `rocket(dur)` | `rocket {dur}` |
| `type()` | `ui.type` |

magician.js (REVIEWER 2)
| `SFX.` | FPSFX |
|---|---|
| `ping(k, crit)` | `hit.weak {k}` or `hit.crit {k}` |
| `plate()` | `hit.armour {variant: 0, gain: 0.7}`, gated 0.22 s |
| death clatter (each plate landing) | `hit.armour {variant: 0, gain: 0.55 × impact}`, pitched by size |
| `crouch(dur)` (dash crouch) | `windup {dur}` |
| `clank()` (sinew, not a weak point) | `hit.flesh` |
| `whoosh()` (teleport out) / `appear()` | `teleport` / `appear` |
| `column(dur)` | `appear` + `flame {dur}` |
| `crackle()` | `crackle` |
| throwing a manuscript (`appear` + `crackle`) | `fireball.launch {pos}` |
| `pop()` (manuscript burst) | `fireball.burst {pos}` |
| `chime()` (manuscript shot down) | `fireball.burst` + `pickup` |
| `dash()` / `hiss(dur)` | `dash` / `hiss {dur}` |
| `slam()` + `roar(dur)` (line of fire) | `slam` + `flame {dur}` |
| `hum(h)` (desperation ring) | `drone {ttl: 0.7}` + `flame {ttl: 0.7, gain 0.45→0.8 as the ring closes, gate: 0}`, both fed every frame, stopped over 0.3 s (dispel) or 1.2 s (burn-out) |
| `dispel()` | `dispel` |
| `laugh()` | `boss.laugh` |
| phase change / hurt | `boss.screech` |
| `buzz()` (dying flicker) | `plasma {gain: 0.4}` |
| `wind(len)` | `wind {dur: len}` |
| `snap()` | `snap` twice, 0.13 s apart (`{delay: 0.13}` on the second) |
| `shatter()` / `count()` / `rocket(dur)` / `type()` | `shatter` / `ui.tick`, `ui.go` / `rocket {dur}` / `ui.type` |

## Auditioning and tests (scratch, in `.dev/tmp/`)

- `.dev/tmp/render/sfx-fps/<name>.m4a` (and `.wav`): every variant in sequence; `hit.weak`/`hit.crit` climb k 0 → 1
  in 12 hits; loops play three times, then fade (to hear the seam). `_montage.m4a`: every sound, then the gun every
  0.13 s for 3 s. `_badge-editor.m4a`: sustained fire on the H-INDEX badge (the gun every 0.13 s, a `hit.weak` 0.25 s
  after each, k rising a hit at a time); `_badge-magician.m4a`: the same with a crit every fourth hit and `hit.flesh`
  under each. `_gunburst-through-bus.m4a`: the gun burst through the real bus in Chrome. `spec-*.png`: spectrograms.
- `node .dev/tmp/fpsfx/render-all.mjs [--no-m4a] [names…]` renders all of it in Node (fpsfx.js through `vm`, a
  bare `window` stub) and writes `_measurements.json`.
- `node .dev/tmp/fpsfx/page.mjs [port] [profile]` (default port 9821, profile `fpsfx`) checks the real page: load
  order, render time, every name on `api.audio()`, the voice cap under 100 plays in 1 s, and the bus offline. It also
  measures music loudness and writes `_page-results.json`. `handles.mjs` tests `stop`/`fade`/`feed`/`place`/`dur`/`ttl`.
- `.dev/tmp/fpsfx/fix/` (port 9829, profile `fix-fpsfx`): `base.mjs [fpsfx.js]` prints the loudness figures above,
  the gun's masking by the music, the badge streams and the fingerprint distances (`fpsfx-before.js` is the previous
  revision, for comparison); `runtime.mjs` checks the voice accounting against scheduled plays, quick stops cutting
  slow ones, the ttl drone, `warm()` inputs and odd options; `bus.mjs` measures the limiter on sustained fire and the
  music + effects sum; `warmjank.mjs` the main-thread blocking of `warm()`. `../table.mjs` regenerates the table above.
