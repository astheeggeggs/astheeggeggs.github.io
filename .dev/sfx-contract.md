# FPSFX — the first-person sound kit (contract, 2026-09-27; levels, ducking and the weak-point tone 2026-09-29; the BFG held, the sting's edge and the crit's accent in the 2026-09-29 fix pass)

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
| `FPSFX.info(name)` / `FPSFX.list()` | `{name, use, len, level, mix, vary, gate, poly, duck, accent, variants, loop, bake, crush, dur, pitch}`: `level` is the rendered buffer's peak (at k = 0 on `hit.weak`/`hit.crit`), `mix` the dB that put it under the music (below), `duck` the ducking family or null, `accent` true on `hit.crit` (below); `pitch`: `{span: 19, step: 2}` on `hit.weak`/`hit.crit`, else null |
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

Ducking (names with `duck`: `hit.weak` and `hit.crit`, family `ding`): the strikes of one family soften each other, so a
burst of weak-point hits is about as loud as one hit instead of stacking up. A strike plays at `n ^ -0.6` of its gain,
where `n = 1 + Σ (1 - age / 0.4)` over the family's strikes in the last 0.4 s (gated plays do not count). A lone hit is
untouched; at the gun's 0.13 s each hit is 3.6 dB down, and three in 0.4 s add up to 1.2 dB over one hit (4.8 dB undamped).
Checked in Node on strikes that do not overlap: -1.564 dB measured and expected at 0.26 s apart; a name without `duck`
(`hit.flesh`) is untouched by the same train (within 0.15 dB, the overlap of its own tails).
- `hit.crit` is the family's **accent**: it counts toward softening the strikes after it but is never softened itself,
  so the chain of weak hits it ends cannot bury it (REVIEWER 2's every-fourth crit was 3.7 dB down after three hits at
  the gun's rate; now 0).
- A strike's gain is fixed when it is scheduled, so one played with `delay` counts only the strikes known then. Strikes
  are kept by their own time, not the order they were played in, until no later play can reach them (older than 0.4 s
  before `currentTime`). Checked (`.dev/tmp/fpsfx/fix3/ducktest.mjs`, the runtime review's case): a strike scheduled for
  1.2 s, a live one at 0.4 s, a live one at 1.3 s: the last is ducked -2.92 dB, the same as with all three live and as
  the law (it was undamped, 0.00 dB, when the list was pruned by position); a live or pre-scheduled in-order train is
  unchanged to 0.0000 dB.

## The bus and levels

One bus per context: input gain → DynamicsCompressor (threshold -6 dB, knee 3, ratio 12, attack 1 ms, release 120 ms)
→ trim 0.728 → a WaveShaper soft ceiling (linear to 0.6, never above 0.8) → destination. Measured in Chrome at 48 kHz:
- Small-signal gain of the bus 1.00 (the trim cancels Chrome's automatic makeup gain, measured ×1.373).
- A new DynamicsCompressor starts in deep reduction and takes ~100 ms to open (a shot at creation came out at 0.11 of
  0.6). The bus therefore opens on a direct path, delayed by the compressor's 6 ms look-ahead, and crossfades onto the
  limiter over 250 ms.
- Each sound alone after warm-up: peak ≤ 0.48 (`quake`; table), under the limiter's threshold (0.5) except the editor's
  pings at their host gain 1.25 (0.525 at k 0). Eleven of the heaviest sounds at once plus a gun burst: peak 0.65-0.66 in
  steady state and 0.793 at bus creation (the ceiling). Sustained fire (the gun every 0.13 s) peaks at 0.052. So the
  limiter and the ceiling are now a safety net: over a minute of either fight the real bus and a linear model of it
  agree within 0.1 dB on the routine-sound figures below.

### Levels under the music (2026-09-29, fix pass the same day)

Duncan, after the first-person upgrade: "now the soundtrack is too quiet by comparison." The kit was re-levelled to a
written target (MIX_SPEC, `.dev/tmp/mixmeter/spec.mjs`), measured with the shared meter in `.dev/tmp/mixmeter/`:
short-term loudness, ITU-R BS.1770 K-weighting, 400 ms windows every 100 ms, of the music alone and of the kit alone,
from a realistic 60 s event log of each fight (`logs-fp.mjs`: the hosts' own calls, gains, gates and state-machine
timings) played through the real kit and bus in Chrome. The rules: routine sounds (everything but the one-offs) at least
9 dB under the music in the median window and 4 dB under it in the 90th-percentile window; a one-off at most 2 dB over
the music's level in its loudest window (this kit aims lower: at most the music's level); each critical cue (the
weak-point tone, the hurt, the warning beeps) no more than 6 dB under the music in the 1.5-5 kHz band in its own window;
music + effects summed, samples over 1.0 counted.

The review of the first level pass (b8bf952) found two holes the meter could not see, and this pass closes them:
- **The BFG held.** The meter classed `bfg.*` and `enemy.pain` as one-offs and its EDITOR log has no BFG, but the sage
  hands it over at the start of that fight and a held trigger fires it every 1.3 s (quest.js: `bfg.charge` 0.3 s, then
  `bfg.fire`, fireCool 1.0; boss.js: `hit.crit` + `bfg.blast` + `enemy.pain` on the badge). At the one-offs' level it
  was the bed of the fight: routine sounds -2.8 to -3.2 / -0.2 to -0.5 re the music, 125-235 samples over 1.0 (Node).
  The BFG is now a tier of its own, scored as held fire (`.dev/tmp/fpsfx/fix3/lib.mjs` `editorBfgLog`: the editor log's
  attacks and hurts, the paper gun replaced by the BFG's cadence; [ASSUMPTION: aim] 85% badge, 10% body, 5% ground,
  bursts of 2-5 s).
- **Each cue on its own, over more than one minute.** The meter scores all cues in one stream (so a crit borrowed the
  weak hits before it, the rain marks the pings) and from one seeded minute. Swept across REVIEWER 2's score, the hurt
  fell under its floor at 56 of 176 moments (worst -9.0) and a lone crit at 16 (worst -8.1); at the end of a chain of
  weak hits the crit was ducked 3.7 dB and missed at 100 of 176. Each cue is now scored on its own sound as played in
  the mix (ducking kept; the hurt as its pair, `player.pain` + `heart.lost`), in ten REVIEWER 2 minutes (seeds 1-10) and
  in sweeps of 176 moments across each score.

Through the real bus in Chrome (`.dev/tmp/fpsfx/fix3/chrome.mjs`, and the meter's `mix.mjs editor reviewer2`):

| minute (60 s) | routine sounds re music, median / p90 | weakest cue re music band, each alone (floor -6) | sum peak / samples over 1.0 |
|---|---|---|---|
| EDITOR, paper gun (the meter's log) | -14.7 / -6.0 (b8bf952 -14.7 / -5.8; 8a063df +0.4 / +2.1) | weak point +5.3; hurt +6.5; rain marks -4.0 | 1.091 / 3 (one run of 3) |
| EDITOR, BFG held, seeds 7 / 11 / 23 | -10.1 / -5.3, -9.8 / -5.0, -9.9 / -5.1 (b8bf952 -3.0 / -0.4, -2.8 / -0.4, -2.8 / -0.2) | crit +6.1; hurt +6.4; rain marks -4.0 | 0.93-1.01 / 0-4 (b8bf952 1.21 / 206-235, Node) |
| EDITOR, BFG in sparse bursts | -11.5 / -5.9 | crit +5.8 | 0.98 / 0 |
| EDITOR, paper for 8 s, then the BFG (the audition) | -10.1 / -5.4 | weak point +10.6; crit +5.5 | 1.091 / 3 |
| REVIEWER 2 (the meter's log, seed 2) | -13.1 / -4.2 (meter -13.0 / -4.3; b8bf952 -13.0 / -4.5; 8a063df +0.7 / +4.4) | weak point -5.1; crit -2.6; hurt -2.1 | 0.878 / 0 |
| REVIEWER 2, seeds 1, 3-10 | -12.6 to -13.1 / -4.6 to -6.5 | weak point -5.9, crit -5.7, hurt -5.4 (0 of 332, 55, 53 under; b8bf952 2, 24 and 15 under, worst -6.3, -10.7, -8.6) | up to 1.117 / 0-4 |

One-offs, loudest window re the music (the meter): the editor's landing -0.6, his death -1.3, REJECTED! -0.9 to -1.4,
the blast-off -0.8 to -1.4, REVIEWER 2's arrival -0.7, phase change -0.9, death -0.6; one BFG shot alone -6.1 (b8bf952
-0.6). Sweeps of one cue alone at 176 moments across the score (Node, the kit's own code; its loudest band window
against the music's there), before this pass in brackets: the hurt, REVIEWER 2 worst -5.6, median -1.1, 0 under (-9.0,
56 under), EDITOR worst +4.7; a lone crit, REVIEWER 2 worst -5.7, 0 under (-8.1, 16), EDITOR +4.7; a crit after three
weak hits 0.13 s apart, worst -5.4, 0 under (-11.6, 100); the rain marks in bursts of 5 and 9, each mark, worst -2.7 and
-2.5 (0 of 880 and 1584). Node and the real bus agree within 0.1 dB on every routine figure and every cue's worst
occurrence. The summed overs are single runs of 1-4 samples (under 0.1 ms) where a ping or a BFG hit meets a peak of the
music; music and effects are two contexts (Riff has its own), each limited on its own [ASSUMPTION: the browser/OS sums
them linearly and clips at ±1], so only a shared final limiter (in riff.js, off limits) could rule that out.

**REVIEWER 2 is at the edge, by construction.** Its score is 10 dB brighter in the band than the editor's, and its
loudest tenth of windows is the cues themselves (weak-point tones 45%, crits 17%, the sting 9%, the grunt 5%; the gun,
the manuscripts and his hiss 2-6% each): the 90th-percentile rule and the cue floors pull against each other, and each
0.1 dB on the weak-point tone costs about 0.04 dB of p90. The plan sits between them: p90 -4.2 with every cue
occurrence in ten minutes over its floor (the worst by 0.1 dB, at 43-52 s where the score is brightest). Cutting his
attacks further (1.5-2 dB off `fireball.launch` and `pickup`) would buy about 0.1 dB and bury them more; they are
already carried by their onsets and the visuals. [ASSUMPTION: the meter's REVIEWER 2 log (~45 weak hits a minute) is
the real density.] Seed 2 is the worst p90 of the ten.

Each routine sound's level in the windows it sounds in, median re the music in the same window (dB; Node, the kit's
code, `.dev/tmp/fpsfx/fix3/final-disk.json`):
- THE EDITOR (paper): gun -20.2; `hit.block` -20.3, `hit.armour` -23.9; `windup` -17.1, `fireball.launch` -13.3,
  `fireball.burst` -20.9, `slam` -16.2, `whoosh` -15.9, `stomp` -20.1; `hit.weak` -8.9; `ui.tick` (rain marks) -8.7;
  `player.pain` -13.7, `heart.lost` -11.9.
- THE EDITOR (BFG held): `bfg.charge` -18.4, `bfg.fire` -19.9, `bfg.blast` -21.2, `enemy.pain` -16.5, `hit.crit` -9.3
  (medians over every window a sound touches, tails included). The loudest 400 ms window of one whole shot (charge,
  fire, then crit + blast + flinch) is -5.9 re the music's level (8a063df +4.7, b8bf952 -0.7); without the crit -9.9;
  one paper shot -24.4.
- REVIEWER 2: gun -19.7; `hit.flesh` -24.4 and `hit.armour` -25.1 (magician.js plays them at 0.45 and 0.7); `hiss`
  -20.2, `fireball.launch` -13.3, `fireball.burst` -17.1, `teleport` -20.7, `flame` -16.9, `dash` -16.4, `windup` -20.8,
  `pickup` -13.9; `hit.weak` -8.8, `hit.crit` -8.4; `player.pain` -12.7, `heart.lost` -10.3.
- In the 1.5-5 kHz band (a diagnostic, not a rule; each name alone against the music's band, median over its windows):
  the editor's dark score leaves the routine sounds close to it (gun -4.4, `hit.block` -5.7, `windup` -3.2, `whoosh`
  -1.1); REVIEWER 2's bright score covers them by 7-25 dB (gun -13.8, `fireball.launch` -7.5, `flame` -10.2, `hiss`
  -15.5). His attacks are carried there by their onsets and the visuals (above).

How it is done, all in fpsfx.js (every host gain is as it was):
- **The mix tiers** (`MIX`, the `mix` column below; the rendered peak is `level` x `mix`): the gun -19.5 dB, the
  commonest sound under held fire, so the lowest; **the BFG -13** (`bfg.charge`, `bfg.fire`, `bfg.blast`; `enemy.pain`,
  its flinch on every hit, -16), held fire now, 9 dB under the first pass; every routine sound -10.5 (hits, the bosses'
  attacks, telegraphs and movement, pickups, UI); the weak-point tone -0.4 (`hit.crit` 3 dB under it, -3.4: its triple
  strike is about 3 dB louder at the same peak, so a crit lands at about a plain hit's level and stands out by its rising
  strikes and shriek); the hurt -10 on the sting (`heart.lost`, which carries it in the band) and -12 on the grunt
  (`player.pain`, which puts about 3% of its loudness in the band: it cost p90 and added nothing to the cue); the
  warning beeps (`ui.tick`, `ui.go`) -1.9; the one-offs -4, the loudest of them deeper so none is louder than the music:
  `explosion` -8, `player.death` -7, `boss.roar` and `boss.screech` -6.5, `quake` and `whistle` -5, `boss.laugh`, `omen`
  and `rocket` -4.5. Every one-off event, alone or in play, peaks 0.6-8 dB under the music's level (8a063df: +2.2 to
  +5.8 over it). Changes in this pass: BFG -9 dB, `enemy.pain` -9, `hit.weak` +0.4, `hit.crit` +2.4, `heart.lost` -2
  (and brighter), `player.pain` -4, `ui.tick`/`ui.go` +1.5.
- **The weak-point tone's presence ring**: with the score this far forward, REVIEWER 2's weak-point tone could not be
  both under the music and heard over it by level alone (the meter's proof: the magician score is 10 dB brighter at
  1.5-5 kHz than the editor's, and a 660-1300 Hz ding put only a fifth of its loudness there). `ding()` rings the
  harmonics of its pitch that fall near 2.6 kHz for 1.6 times the strike's decay, so about four-fifths of each
  strike's loudness sits in the band at every k (band minus full band -0.6 to -1.1 dB; 8a063df -6.7 at k = 0). The
  top steps are unchanged; the low ones are brighter, bell-like. `hit.weak` is 0.25 s long (was 0.17), and its steps
  are equally loud to within about 1.5 dB (the `tilt`).
- **The sting's presence edge** (this pass): `sting()` lays the note's own square, band-passed twice at 2.6 kHz (Q 4),
  over the driven buzz, so `heart.lost` puts two-thirds of its loudness in the band instead of a sixth (band minus full
  band -1.7 dB, was -7.9): at the same peak it is 5.5 dB louder in the band and 0.7 dB quieter overall. A nasal, harder
  edge on the same two notes; A/B `.dev/tmp/render/sfx-fps/_heart.lost-before-after.m4a` (loudness-matched). Its
  up-sampling image (the sting is synthesised at 32 kHz) sits 39-42 dB under the edge, at 18.6 kHz (48 kHz) or 14.7 kHz
  (44.1 kHz), as before.
- **Ducking** (above): the loudest routine windows were the densest runs of weak-point hits (a window with three
  strikes was about 4 dB louder than one with a single strike); now it is 1.3-1.7 dB louder. The crit is the accent. A
  stronger law (n ^ -0.8) was tried and dropped: 0.1 dB of p90 for 0.9 dB off the weak-point tone's worst occurrence.

Character figures that do not depend on level still hold: the gun's energy is in the crack (47-48% at 2-5 kHz, 14-19%
below 150 Hz, centroid 2.7-3.4 kHz), and the gun and `hit.block` are far apart (fingerprint distance 13-14 dB, the mean
|dB| difference over 18 log bands × 20 ms frames, against 2.5-5.8 between variants of one sound). The table's `loud`
column is each sound's loudest A-weighted 50 ms window (hop 10 ms, dB re an RMS of 1, so a full-scale 1 kHz sine reads
-3.0), at its new level.

The kit's output goes to `ac.destination` of the host's context (quest.js's `AC`); Riff plays on its own context.

## Performance

Rendering is lazy (first play) or ahead (`warm`). All 86 default buffers (64.7 s of audio, every variant, every rendered
`hit.weak`/`hit.crit` step, each length-baked sound at its default length) took 457 ms on the running game page in
headless Chrome at 48 kHz on 2026-09-29, at a load average of about 7 (820 ms on 2026-09-27, 2.0 s at a load of ~45). In
Node the set takes 471 ms against 391 ms for the 2026-09-28 commit: the presence ring adds about 80 ms over the 22
weak-point buffers, the slowest of which takes 5 ms. A buffer cannot be split, so the longest main-thread block of
`warm()` is its slowest buffer. After the 2026-09-29 fix pass (the sting's edge adds one square and two filters over
0.58 s) the page's `prerender()` of the same 86 buffers took 600 and 1125 ms in two runs under different loads (about 25
in the slower). Measured first renders (not cached; the low figure is this revision's run on a fresh page at 44.1 kHz,
the high one the runtime review's on the game page at 48 kHz): `flame` 24-99 ms, `boss.roar` 28-61 ms, `quake` 21-55 ms,
`rocket` 56 ms at dur 4.2 and up to 119 ms at dur 8, `omen` 54 ms at dur 3 and 85 ms at dur 8, `windup` 33 ms at dur
2.2; a whole `k.warm()` on a fresh page had 6 long tasks, the longest 109 ms. So: **call `k.warm([...])` at a
non-interactive moment (the dossier card, the WARNING card), with the exact names and lengths you will play** (`{name:
'windup', dur: D}` for every D), and never let a big sound's first play land mid-fight. Each play costs one BufferSource
and one GainNode (two more nodes if positioned). Buffers are cached per sample rate and shared across kits.

## The names

`len` s = default length (loops: loop length); `mix` = dB under the kit balance (the tiers above); `level` = peak of the
rendered buffer, the balance times the mix (`hit.weak`/`hit.crit`: at k 0 → at k 1); `bus` = peak / 50 ms RMS out of the
bus (measured in Chrome on the game page, alone, after warm-up, in the fix pass); `loud` = loudest A-weighted 50 ms, dB
(see above; `hit.weak`/`hit.crit` the loudest over k 0, 0.5, 1); `vary` ± semitones; `gate` s / `poly` (/ duck: the
ducking family; accent: counted, never softened); grit: synthesis rate/bits (Doom-style sample-and-hold, no
interpolation) or clean (HotD, synthesised at ≤ 32 kHz and interpolated up).

| name | len | mix | level | bus | loud | vary | var | gate / poly | baked | grit | for |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `gun` | 0.3 | -19.5 | 0.051 | 0.051 / 0.019 | -33.8 | 0.7 | 3 | 0.05 / 4 |  | clean | the paper-ball rebuttal leaving the hand (quest.js fire()) |
| `reload` | 0.36 | -10.5 | 0.179 | 0.179 / 0.023 | -32.5 | 0.5 | 1 | 0.2 / 1 |  | clean | the gun readied: entering first person, after RESUBMIT |
| `click` | 0.07 | -10.5 | 0.104 | 0.104 / 0.008 | -40.8 | 1 | 1 | 0.04 / 2 |  | clean | a dry click: a trigger that does nothing, a menu tick |
| `bfg.charge` | 0.7 | -13 | 0.123 | 0.123 / 0.04 | -27.4 | 0.3 | 1 | 0.1 / 1 | dur 0.7 (0.2-3) | 11.025k/8b | the BFG wind-up; pass dur = the wind-up (BFG_WIND) |
| `bfg.fire` | 1.15 | -13 | 0.179 | 0.179 / 0.073 | -30.2 | 0.4 | 1 | 0.15 / 2 |  | 11.025k/8b | the BFG discharging (fireBfg()) |
| `bfg.blast` | 1.6 | -13 | 0.179 | 0.179 / 0.071 | -28.3 | 0.8 | 1 | 0.08 / 3 |  | 11.025k/8b | a BFG ball bursting on anything (body, weak point, ground, a reviewer) |
| `plasma` | 0.24 | -10.5 | 0.134 | 0.134 / 0.041 | -28.1 | 1.5 | 2 | 0.04 / 4 |  | 11.025k/8b | an electrical zap: BFG sparks, a failing light, a short circuit |
| `hit.flesh` | 0.3 | -10.5 | 0.164 | 0.164 / 0.049 | -27.2 | 2 | 3 | 0.03 / 3 |  | clean | a shot into flesh that is not a weak point: a reviewer, the Magician's sinew |
| `hit.armour` | 0.5 | -10.5 | 0.149 | 0.149 / 0.036 | -27.2 | 1.5 | 3 | 0.04 / 3 |  | clean | a shot off armour: the Magician's bone plates, the editor's tenure (body) |
| `hit.block` | 0.2 | -10.5 | 0.194 | 0.194 / 0.04 | -28.3 | 1.5 | 2 | 0.04 / 3 |  | clean | a shot stopped by the editor's journal-cover guard (cardboard, not metal) |
| `hit.weak` | 0.25 | -0.4 | 0.420 → 0.354 | 0.42 / 0.134 | -15.9 | 0.15 | 1 | 0.02 / 3 / duck | k / pitch | clean | a weak-point hit (H-INDEX badge, CONFLICTS OF INTEREST); k = 1 - hp/maxHp raises the pitch |
| `hit.crit` | 0.42 | -3.4 | 0.311 → 0.220 | 0.311 / 0.113 | -18.3 | 0.1 | 1 | 0.03 / 2 / duck, accent | k / pitch | clean | a critical weak-point hit (the Magician's every-fourth chained hit, the BFG on the badge); same k |
| `enemy.pain` | 0.44 | -16 | 0.095 | 0.095 / 0.039 | -26.7 | 2.5 | 3 | 0.08 / 2 |  | 11.025k/8b | a boss flinch: the editor hit by the BFG (boss.js SFX.plasma, SFX.blast) |
| `gib` | 0.7 | -4 | 0.442 | 0.441 / 0.157 | -20.6 | 1.5 | 1 | 0.1 / 2 |  | 11.025k/8b | a meaty splat: something coming apart (a boss's last hit, a messy retirement) |
| `boss.roar` | 2.3 | -6.5 | 0.379 | 0.378 / 0.099 | -24.9 | 1.2 | 1 | 0.5 / 2 |  | 11.025k/8b | a boss roar: the editor landing and changing phase, a big entrance |
| `boss.screech` | 1.35 | -6.5 | 0.308 | 0.307 / 0.16 | -16.9 | 1.2 | 1 | 0.4 / 2 |  | 16k/10b | a creature screech (the Magician hurt, enraged, or arriving) |
| `boss.laugh` | 1.3 | -4.5 | 0.387 | 0.387 / 0.189 | -17.1 | 1 | 1 | 0.6 / 1 |  | 16k/10b | the Magician's laugh (arrival, phase change, exit) |
| `windup` | 1.06 | -10.5 | 0.179 | 0.179 / 0.053 | -25.9 | 0.5 | 1 | 0.2 / 1 | dur 1 (0.3-4) | 11.025k/8b | a boss attack winding up; pass dur = the wind-up (boss.js charge(F.dur)) |
| `hiss` | 0.88 | -10.5 | 0.134 | 0.134 / 0.039 | -27.9 | 1 | 1 | 0.15 / 2 | dur 0.8 (0.2-3) | clean | the Magician's hiss before an attack or while exposed; pass dur |
| `fireball.launch` | 0.5 | -10.5 | 0.164 | 0.164 / 0.076 | -22.5 | 2 | 2 | 0.05 / 4 |  | 11.025k/8b | a fireball thrown (the Magician's burning manuscripts, the editor's orbs) |
| `fireball.burst` | 0.65 | -10.5 | 0.179 | 0.179 / 0.067 | -23.8 | 2 | 2 | 0.04 / 4 |  | 11.025k/8b | a fireball bursting: shot down, or landing (orb pop, ink stroke landing) |
| `crackle` | 0.22 | -10.5 | 0.104 | 0.104 / 0.009 | -39.8 | 3 | 3 | 0.06 / 3 |  | clean | a few pops of flame: a manuscript catching, scorch trails |
| `teleport` | 0.62 | -10.5 | 0.179 | 0.179 / 0.053 | -24.6 | 0.8 | 1 | 0.15 / 2 |  | clean | a teleport out: a reversed swell that stops dead |
| `appear` | 0.8 | -10.5 | 0.194 | 0.194 / 0.065 | -25.2 | 1 | 1 | 0.12 / 2 |  | clean | a teleport in: arrival in a column of flame |
| `flame` | 2.4 | -10.5 | 0.179 | 0.179 / 0.053 | -29.8 | 1 | 1 | 0.1 / 3 | loop | clean | LOOP: burning ground, a flame column, the line of fire; pass dur or stop() |
| `drone` | 2 | -10.5 | 0.134 | 0.134 / 0.061 | -37.2 | 0 | 1 | 0.2 / 2 | loop | clean | LOOP: a menacing hum (the desperation ring); play with ttl, feed() every frame |
| `wind` | 4 | -4 | 0.252 | 0.252 / 0.074 | -24.2 | 0 | 1 | 0.5 / 1 | loop | clean | LOOP: an ill wind before the Magician arrives; pass dur |
| `dispel` | 0.8 | -10.5 | 0.149 | 0.149 / 0.054 | -24.0 | 0.5 | 1 | 0.2 / 1 |  | clean | a curse lifted (the Magician's ring of fire dispelled) |
| `dash` | 0.55 | -10.5 | 0.179 | 0.179 / 0.064 | -25.3 | 1.5 | 1 | 0.15 / 2 |  | clean | a lunge: the Magician's dash |
| `whoosh` | 0.4 | -10.5 | 0.119 | 0.119 / 0.036 | -28.6 | 2 | 2 | 0.08 / 3 |  | clean | something light flying past: an orb lobbed, an ink stroke falling |
| `slam` | 0.85 | -10.5 | 0.239 | 0.239 / 0.12 | -27.6 | 1 | 1 | 0.1 / 2 |  | 22.05k/10b | a heavy ground hit: the editor's shockwave ring, the Magician's line of fire starting |
| `stomp` | 0.4 | -10.5 | 0.179 | 0.179 / 0.08 | -33.7 | 1.5 | 1 | 0.1 / 2 |  | clean | a giant footstep (the editor walking); scale gain by distance |
| `quake` | 3 | -5 | 0.478 | 0.478 / 0.227 | -22.6 | 0.5 | 1 | 0.5 / 1 |  | 11.025k/8b | the enormous landing (the editor falling on the town) |
| `explosion` | 1.8 | -8 | 0.338 | 0.338 / 0.126 | -22.8 | 1.5 | 2 | 0.08 / 3 |  | 11.025k/8b | a big explosion (a boss blowing apart) |
| `shatter` | 0.95 | -4 | 0.379 | 0.378 / 0.092 | -20.8 | 1 | 1 | 0.2 / 2 |  | clean | armour or glass shattering (the editor's death, the Magician's plates falling) |
| `snap` | 0.2 | -4 | 0.442 | 0.441 / 0.07 | -22.1 | 1 | 1 | 0.08 / 2 |  | clean | a finger snap (the Magician: "I WAS NEVER HERE.") |
| `omen` | 3.1 | -4.5 | 0.357 | 0.357 / 0.179 | -33.2 | 0 | 1 | 1 / 1 | dur 3 (0.5-8) | 11.025k/8b | a rumbling swell before a boss arrives (silence, then this); pass dur |
| `whistle` | 2.03 | -5 | 0.281 | 0.281 / 0.16 | -18.7 | 0 | 1 | 1 / 1 | dur 2 (0.5-6) | clean | something falling from the sky (the editor's drop); pass dur |
| `rocket` | 4 | -4.5 | 0.447 | 0.447 / 0.183 | -20.1 | 0 | 1 | 1 / 1 | dur 4 (1-8) | 22.05k/10b | ignition and a rocket roar (the blast-off); pass dur |
| `player.pain` | 0.36 | -12 | 0.176 | 0.176 / 0.084 | -22.6 | 1 | 2 | 0.25 / 1 |  | 11.025k/8b | the player hit (api.hurt): the grunt; pair with heart.lost |
| `heart.lost` | 0.58 | -10 | 0.142 | 0.142 / 0.061 | -24.3 | 0 | 1 | 0.3 / 1 |  | clean | a heart gone: the harsh arcade damage sting |
| `player.death` | 2 | -7 | 0.357 | 0.357 / 0.187 | -16.6 | 0.5 | 1 | 1 / 1 |  | 11.025k/8b | REJECTED!: the death scream and the body hitting the floor |
| `pickup` | 0.18 | -10.5 | 0.06 | 0.06 / 0.045 | -26.4 | 0 | 1 | 0.05 / 2 |  | 11.025k/8b | an item picked up (FACT FOUND, a heart) |
| `powerup` | 1.05 | -4 | 0.347 | 0.347 / 0.129 | -17.4 | 0 | 1 | 0.5 / 1 |  | 22.05k/8b | a power-up: the BFG handed over |
| `victory` | 1.7 | -4 | 0.379 | 0.378 / 0.115 | -19.1 | 0 | 1 | 1 / 1 |  | 22.05k/10b | a boss beaten: the short fanfare under REBUTTAL/MANUSCRIPT ACCEPTED |
| `ui.confirm` | 0.3 | -10.5 | 0.06 | 0.06 / 0.038 | -27.6 | 0 | 1 | 0.05 / 2 |  | clean | a menu confirm: PRESS START, RESUBMIT, a talk prompt accepted |
| `ui.tick` | 0.18 | -1.9 | 0.193 | 0.193 / 0.132 | -20.6 | 0 | 1 | 0.2 / 1 |  | clean | a countdown beep (3, 2, 1) |
| `ui.go` | 0.55 | -1.9 | 0.177 | 0.177 / 0.116 | -18.7 | 0 | 1 | 0.2 / 1 |  | clean | the countdown's GO |
| `engine` | 0.9 | -14.5 | 0.075 | not measured | not measured | 0 | 1 | 0.2 / 1 | loop | clean | LOOP: the Warthog's engine (warthog.js); played with ttl, feed() every frame, pitch follows the speed |
| `skid` | 0.6 | -10.5 | 0.134 | not measured | not measured | 1 | 1 | 0.2 / 2 |  | clean | the Warthog's tyres sliding: a short squeal on hard turns at speed, the handbrake |
| `thud` | 0.32 | -10.5 | 0.164 | not measured | not measured | 1.5 | 2 | 0.05 / 3 |  | clean | a soft body hit: a reviewer run over, a box man landing flat |
| `bump` | 0.45 | -10.5 | 0.164 | not measured | not measured | 1 | 2 | 0.08 / 2 |  | clean | the Warthog's chassis hitting a collider: a metal knock and a low thump |
| `chaingun` | 0.16 | -15 | 0.089 | not measured | not measured | 0.6 | 3 | 0.035 / 6 |  | clean | one round of the chain gun (twelve a second while the trigger is held; the kit's gate and poly carry the rate) |
| `door` | 0.4 | -10.5 | 0.134 | not measured | not measured | 0.5 | 1 | 0.15 / 1 |  | clean | climbing into or out of the Warthog: a latch and a hollow door thunk |
| `splash` | 0.7 | -10.5 | 0.149 | not measured | not measured | 0.5 | 1 | 0.2 / 2 |  | clean | the dive into the fountain (quest.js startDive / diveFrame) |
| `alert` | 0.39 | -3.4 | 0.311 | not measured | not measured | 0 | 1 | 0.25 / 2 |  | clean | SNAKE MODE (quest.js, ten clears): a reviewer spots him, the "!": a click, a 1976 Hz square snapping down to 1318 Hz, ringing off. Unducked, at `hit.crit`'s tier |
| `lost` | 0.42 | -10.5 | 0.09 | not measured | not measured | 0 | 1 | 0.25 / 2 |  | clean | SNAKE MODE: he is lost, or a reviewer is curious about a cardboard box, the "?": two softer notes rising (587 then 784 Hz) |
| `ui.type` | 0.04 | -10.5 | 0.075 | 0.075 / 0.007 | -Infinity | 2 | 1 | 0.04 / 2 |  | clean | a keystroke of the dossier card typing out |

## Wiring (as shipped; old call → new)

The kit is `var sfx = FPSFX.kit(api.audio())` in each boss module (lazily, or on `start()`), and quest.js's own `AC`.
**`api.audio()` IS quest.js's `AC`, so every module shares ONE kit.** Tag your plays (`{group: 'boss'}`) and stop only
your own in `stop()` with `sfx.stopAll(0.1, 'boss')` (this replaces `killSfx()`); an untagged `stopAll` would also cut
quest.js's sounds (the REJECTED! scream). `setListener` and `volume` are shared too: set the listener once
(`sfx.setListener(api.camera)`) and pass `pos` for sounds that come from the boss, so they pan.

quest.js (first person exists only in the endgame now, so reviewers are never shot)

SNAKE MODE (2026-10-11, quest.js `snakeAlert` / `snakeLost`): `alert` positioned at the spotting reviewer (joiners who heard him
play nothing), `lost` positioned at the reviewer on "?". Both warmed on the first Snake-mode frame. Not in the mix measurements above.
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

- The mix, as heard: `.dev/tmp/render/mix/fps-editor-mix.m4a` and `fps-magician-mix.m4a`, 60 s of each fight through
  the real kit and bus in Chrome, plus the music, with a loudness PNG beside each (music blue, effects red), a
  spectrogram of 20-28 s (`spec-fps-*-mix.png`) and `fps-mix.json`. The EDITOR minute is the meter's log with the paper
  gun for 8 s, then the BFG handed over and held (how most of that fight is played; `editorBfgLog(7, {pickup: 8})`),
  REVIEWER 2's is the meter's log. Effects re music over the minute, median / p90 (every sound): -10.0 / -5.3 and
  -13.0 / -4.1; 3 and 0 samples over 1.0. The same minutes with the 2026-09-28 kit (8a063df, what Duncan heard), for
  A/B: `fps-editor-mix-before.m4a` (+0.7 / +2.7, 1022 over), `fps-magician-mix-before.m4a` (+0.8 / +4.4, 86 over: the
  meter's baseline). Written by `MM_PORT=9769 MM_PROFILE=fix-fpsfx node .dev/tmp/fpsfx/fix3/audition.mjs [--rev 8a063df
  --suffix -before]`; `node .dev/tmp/fpsfx/fix3/specmix.mjs` draws the spectrograms.
- `.dev/tmp/render/sfx-fps/<name>.m4a` (and `.wav`): every variant in sequence, at its in-game level; `hit.weak`/`hit.crit`
  climb k 0 → 1 in 12 hits; loops play three times, then fade (to hear the seam). `_montage.m4a`: every sound, then the
  gun every 0.13 s for 3 s. `_badge-editor.m4a`: sustained fire on the H-INDEX badge (the gun every 0.13 s, a `hit.weak`
  at the host's 1.25 0.25 s after each, k rising a hit at a time, ducking each other); `_badge-magician.m4a`: the same
  with a crit every fourth hit and `hit.flesh` at 0.45 under each. `_short-montage.m4a`: a fight in the order a player
  meets it, at in-game levels (`_short-montage-2026-09-28.m4a` is the one Duncan auditioned, at the old levels).
  `_hit.weak-before-after.m4a`: the weak-point tone climbing k 0 → 1 at 8a063df, then now, every hit matched in loudness
  so only the presence ring differs (`spec-hit.weak-before.png` / `-after.png`). `_heart.lost-before-after.m4a`: the
  damage sting three times at b8bf952, then three times now, matched in loudness, so only its 2.6 kHz edge differs
  (`spec-heart.lost-before.png` / `-after.png`). `_gunburst-through-bus.m4a`: the gun burst
  through the real bus in Chrome. `spec-*.png`: spectrograms.
- `node .dev/tmp/fpsfx/render-all.mjs [--no-m4a] [names…]` renders the per-sound files, `_montage`, the spectrograms and
  `_measurements.json` in Node (fpsfx.js through `vm`, a bare `window` stub). It empties the folder first and renders the
  badges from bare buffers (no ducking), so run `node .dev/tmp/fpslevel/render-extra.mjs` after it (the badges, the short
  montage and the before/after through the kit's own play logic) and `page.mjs` (below) for the page files.
- `node .dev/tmp/fpsfx/page.mjs [port] [profile]` (default port 9821, profile `fpsfx`) checks the real page: load
  order, render time, every name on `api.audio()`, the voice cap under 100 plays in 1 s, and the bus offline. It also
  measures music loudness and writes `_page-results.json`. `handles.mjs` tests `stop`/`fade`/`feed`/`place`/`dur`/`ttl`.
- `.dev/tmp/fpsfx/fix/` (port 9829, profile `fix-fpsfx`): `base.mjs [fpsfx.js]` prints the 2026-09-27 loudness figures,
  the gun's masking by the music, the badge streams and the fingerprint distances (`fpsfx-before.js` is the previous
  revision, for comparison); `runtime.mjs` checks the voice accounting against scheduled plays, quick stops cutting
  slow ones, the ttl drone, `warm()` inputs and odd options (its volley check counts a gun as heard above a peak of 0.1,
  which the gun no longer reaches at -19.5 dB: at 0.02 all 12 of 12 are heard); `bus.mjs` measures the limiter on
  sustained fire and the music + effects sum; `warmjank.mjs` the main-thread blocking of `warm()`.
  `.dev/tmp/fpslevel/table.mjs` regenerates the table above (with the `mix` column).
- The levels (`.dev/tmp/mixmeter/`, see its `baseline.md`): `node mix.mjs editor reviewer2 --port <p> --profile <n>`
  scores both fights through the real bus against MIX_SPEC (PASS/FAIL); `fpnode.mjs editor reviewer2` does the same in
  Node in a minute. `.dev/tmp/fpslevel/`: `model.mjs` scores a level plan per name in milliseconds (its per-name
  streams are cached by the hash of fpsfx.js); `opt.mjs` puts the cues at their floors and finds the routine cut;
  `bigcut.mjs` the one-off cuts; `alone.mjs` every name alone against the music; `duckcheck.mjs` the ducking law.
- The fix pass (`.dev/tmp/fpsfx/fix3/`, port 9769, profile `fix-fpsfx`), which scores what the meter cannot: `lib.mjs`
  (the BFG-held EDITOR log, each cue group scored alone as played in the mix, sweeps of one cue across a score);
  `node run.mjs [plan] [--controls] [--only ids]` every minute, ten REVIEWER 2 seeds and the sweeps in Node, a level plan
  tried in memory first (`plans.mjs`: string patches of fpsfx.js and play-gain what-ifs; `disk` is the file as it is;
  `--controls` checks the scoring on the same minute at -10 dB, which must read exactly 10 dB lower, and on silence);
  `MM_PORT=9769 MM_PROFILE=fix-fpsfx node chrome.mjs` the same minutes through the real bus (`chrome.json`);
  `ducktest.mjs` the ducking with delayed plays and the accent; `share.mjs` how much of a sound's loudness sits in the
  band; `p90who.mjs` which names fill the loudest windows; `cuediag.mjs` a cue's worst occurrences.
