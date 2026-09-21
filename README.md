# astheeggeggs.github.io

Personal site for Duncan Palmer, built with Jekyll and hosted on GitHub Pages.

## Structure

| Path | What it is |
| --- | --- |
| `index.md` | Home page: hero, stats, themes, selected work |
| `research.md` | Research themes |
| `publications.md` | Filterable publication list, rendered from `_data/publications.yml` |
| `code.md` | Software and repositories |
| `_data/publications.yml` | The bibliography. Wrap your own name in `<em>` to highlight it |
| `_layouts/` | `default`, `home`, `page`, `post` |
| `_includes/` | `head`, `header`, `footer` |
| `assets/css/swank.css` | The entire stylesheet |
| `_config.yml` | Site metadata, nav items, and outbound links |

There is no theme gem. Everything is in this repository.

## The game

The home page embeds "Palmer's Progress", a small third-person Three.js world
in `assets/js/quest.js`. Three.js loads from cdnjs (pinned to r160) only on
pages with `quest: true` in their front matter. Buildings, NPCs and their
dialogue text live in the `PLACES` and `NPCS` arrays at the top of that file.
Collected facts persist per browser in `localStorage` under `quest.found`.
Six reviewers roam the map and chase the player; F near one rebuts it, Space jumps.
NPC speech is voiced Banjo-Kazooie style: `speak()` plays a pitched blip per
syllable, with a `voice` per character in the `NPCS` array.


Music is synthesised live by `assets/js/riff.js` (WebAudio, no samples or MIDI
files, so nothing to license). Each game has a ♫ toggle in its HUD.

- The game plays a composed overworld piece, about 3½ minutes, that loops
  seamlessly. A `dread` value rises linearly, reaching 0.7 at 90 seconds (`DREAD_TIME`,
  `FP_AT` in `quest.js`), at which point the camera blends into first person
  and F or a click throws rebuttals; two hits retire a reviewer for 22 seconds.
  The score is one continuous piece: tempo dips to about 110 around dread 0.4
  then accelerates to 160, the tune thins out, and palm-muted bass stabs,
  a tritone drone, heavy drums and the odd dissonant shriek phase in
  (the `grim` block in `scheduleOverworld`). Five reviewer hits in first person end the game with a
  GTA-style REJECTED! screen; Space, F or a click resubmits and resets dread.
  `?dread=0.7` and `?maxhits=1` on the URL are test hooks and is fed to `Riff.setDread()`: the piece bends
  into its parallel minor, slows, gains a drone and a tritone, and darkens
  through a low-pass filter, while the sky, fog, lights, trees and water follow. `composeOverworld()` builds it once from a fixed seed: a 14-section
  form in G major (`FORM`, `PROG`), per-section themes generated from chord
  tones and reused whenever a section returns, marimba arpeggios, bass, pads and
  brushed drums. Change the seed, key, form or progressions there.

## The title sequence

`assets/js/intro.js` (`window.QuestIntro`) replaces the old start overlay with an
arcade title screen: a Streets of Rage 2 homage set in Oxford. It runs in three
phases because browsers will not play audio before the user interacts with the
page, and a cabinet's rhythm happens to be the same rhythm.

1. **Attract** — a silent 12-second loop, pixel-perfect at both ends: a parallax
   Oxford night, warm windows, neon (`P<0.05`, `LIBRARY 24H`, `VIVA`), the logo
   and `CLICK FOR SOUND`.
2. **Cinematic** — the first click inserts the coin and starts the score. 37.5
   seconds: a slow pan, dry intertitles, a photograph of the handshake that burns
   away, the Institute sliding in and igniting, and MR. E rising out of the black.
3. **Title** — `PRESS START`, held indefinitely.

Clicking three times in quick succession lands you in the game, so it is never a
gate. Everything is drawn into one **320×224 buffer** blitted with
`imageSmoothingEnabled = false`, in the real Mega Drive 9-bit palette: every
colour channel is one of `{0, 36, 73, 109, 146, 182, 219, 255}`, and all shading
is 4×4 ordered dithering — no gradients, no alpha blending.

The cinematic is **scored to picture**. It is exactly 20 bars at 128 BPM and all
fifteen of its beats land on bar lines; `Riff.play('title')` is written against
those exact times, so the first accent lands when the Institute ignites and the
biggest hit in the piece lands on the white flash. The beat table is exposed as
`QuestIntro(...).beats`; **if you retime the cinematic, retime the music too.**
During the cinematic the picture is driven by the AudioContext clock rather than
by frame deltas, because the two drift and dropped frames would desynchronise it.

## The endgame

Collecting all eight facts forces first person and starts the reckoning.

| Module | What it is |
| --- | --- |
| `assets/js/boss.js` (`window.QuestBoss`) | THE EDITOR-IN-CHIEF. A House of the Dead 2 dossier card names the weak point, then a 17-unit boss falls out of the sky and the landing destroys every building, crushes the fountain and takes each collider with it. Only the H-INDEX badge counts; it is guarded by orbiting journal covers and opens on attack wind-ups. At zero: MANUSCRIPT ACCEPTED, and the manuscript becomes a rocket. |
| `assets/js/shmup.js` (`window.QuestShmup`) | PUBLISH OR PERISH. A vertical bullet-hell shooter in an arcade bezel — DoDonPachi tap-shot versus hold-laser with a HIT chain, crossed with Truxton's three colour weapons and skull bomb. Stage 1 COPYEDITING → THE TYPESETTER → Stage 2 PROOFS → THE IMPACT FACTOR, then the PUBLISHED! ending. Unlimited continues. |

When the boss lands, a **PROFESSOR EMERITUS** appears in the rubble. Talk to him
and he says *"IT'S DANGEROUS TO GO ALONE! TAKE THIS."* and hands over a BFG9000,
which punches through the guard and does far more damage per hit. He is entirely
ignorable; the fight is winnable with paper balls exactly as before.

## The fountain

Walk into the fountain and you fall into `assets/js/cave.js` (`window.QuestCave`):
THE UNDERSPEND, an homage to Earthworm Jim 2's "Jim's Now a Blind Cave
Salamander". That level is set inside an intestine, so this one is the digestive
tract of the finance office — the villi lining the walls absorb your grant as it
passes, and your health bar is your budget, in pounds. Swim (do not touch the
walls), dodge bumpers labelled OVERHEADS and VAT, collect compute credits, then
answer one quiz question per credit in SPEND IT OR LOSE IT! and take the two-cow
WELL DONE screen. The prize converts to extra hearts for the boss fight, saved
under `quest.cave` and banked once. Drowning washes you back out empty-handed.

The trigger arms only once you have walked away from the fountain, because the
player spawns four units from it.

## Music

`assets/js/riff.js` (`window.Riff`) synthesises five pieces at runtime. There are
no samples and no MIDI files, so there is nothing to license.

| Call | What plays |
| --- | --- |
| `Riff.play('quest')` | the evolving overworld piece; `Riff.setDread(0..1)` bends it minor, slows it and darkens it |
| `Riff.boss(true)` | a Dark Souls layer joined on the next bar line |
| `Riff.play('space')` | the shooter's arcade track, 2.6 minutes, seamless |
| `Riff.play('cave')` | Beethoven's Moonlight Sonata, first movement — the piece Earthworm Jim 2 used for that level. Generated from the Mutopia engraving, so the notes are the score |
| `Riff.play('title')` | the Koshiro homage: FM bass, a 303 hook, arcade techno, scored to the title cinematic |
| `Riff.stinger(name)` | `impact`, `victory`, `launch`, `ending` |

## Test hooks

Query-string hooks on the home page, all optional:

`?endgame=1` `?bosshp=5` `?skipintro=1` `?god=1` `?shmup=1` `?shmupstage=2|mid|boss|ending`
`?shmupgod=1` `?cave=1` `?cavequiz=1` `?cavecow=1` `?cavegod=1` `?timescale=1..20`
`?dread=0.71` `?maxhits=1` `?bossdbg=1`

## Testing the game

`.dev/cdp-lib.mjs` drives the real page in headless Chrome over the DevTools
protocol (Node 22+, no dependencies); `.dev/regress.mjs` is a smoke test.

**Headless Chrome throttles `requestAnimationFrame` to about 1 Hz unless
something asks the compositor for a frame**, so the game clock barely advances
during a plain `sleep` and a test can look green while exercising almost
nothing. `.dev/tmp/lib-pump.mjs` forces frames by capturing tiny screenshots;
use it for any wait that is meant to let game time pass, together with
`?timescale=`. `b.startGame()` clicks through the title sequence automatically.

## Adding a publication

Append an entry to `_data/publications.yml`:

```yaml
- year: 2026
  title: "Paper title"
  authors: "Author A, <em>Palmer DS</em>, Author C"
  venue: "Journal 1:1–10"
  url: "https://doi.org/..."
  badge: "Preprint"      # optional
  tags: "lead rare methods"
```

`tags` drives the filter buttons on the publications page. Valid values are
`lead`, `rare`, `methods`, `psych`, `repro`, `pathogen`, `preprint`.

## Running locally

```
bundle install
bundle exec jekyll serve
```

Then open http://127.0.0.1:4000. The stat counters on the home page are set
inline in `index.md` via `data-count` attributes.
