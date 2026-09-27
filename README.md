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
Finishing the shooter offers a harder SECOND LOOP (see below).
NPC speech is voiced Banjo-Kazooie style: `speak()` plays a pitched blip per
syllable, with a `voice` per character in the `NPCS` array.


Music is synthesised live by `assets/js/riff.js` (WebAudio, no samples or MIDI
files, so nothing to license). Each game has a ♫ toggle in its HUD.

- The game plays an overworld town theme in G at 108 BPM: twelve 8-bar
  sections, 3 minutes 33 seconds, looping seamlessly. It is written by hand as
  note data (`composeOverworld()` in `riff.js`), with a hook, call and response
  between flute and bell, a moving bass and sections that thin out and build.
  A `dread` value rises linearly, reaching 0.7 at 90 seconds (`DREAD_TIME`,
  `FP_AT` in `quest.js`), at which point the camera blends into first person
  and F or a click throws rebuttals; two hits retire a reviewer for 22 seconds.
  The score stays one continuous piece. Tempo dips to 96 around dread 0.4 and
  then accelerates to 160. Whole four-bar phrases are re-read through darker
  modes as dread crosses 0.3, 0.5, 0.7 and 0.85, never single wrong notes.
  Palm-muted bass stabs, a tritone drone, heavy drums and the odd shriek phase
  in over the back half. Five reviewer hits in first person end the game with a
  GTA-style REJECTED! screen; Space, F or a click resubmits and resets dread.
  The sky, fog, lights, trees and water follow the same `dread` value.

## The title sequence

`assets/js/intro.js` (`window.QuestIntro`) replaces the old start overlay with an
arcade title screen set in Oxford. It runs in two phases because browsers will
not play audio before the user interacts with the page.

1. **Attract**: a silent 12-second loop, pixel-perfect at both ends. It shows a
   parallax Oxford night, warm windows, neon (`P<0.05`, `LIBRARY 24H`, `VIVA`), the
   logo and `CLICK FOR SOUND`.
2. **Title**: the first click inserts the coin, starts the title theme and slams
   the logo onto THE ROAD TO PUBLICATION plate. `PRESS START` is held indefinitely.
   In the second loop the card reads SECOND LOOP · MASTER QUEST and CREDIT 02.

Two clicks land you in the game, so it is never a gate. Everything is drawn into one **320×224 buffer** blitted with
`imageSmoothingEnabled = false`, in the real Mega Drive 9-bit palette: every
colour channel is one of `{0, 36, 73, 109, 146, 182, 219, 255}`, and all shading
is 4×4 ordered dithering, with no gradients and no alpha blending.

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

## The second loop

The PUBLISHED! screen offers ▶ SECOND LOOP, which calls `api.startLoop2()`. The loop
is stored in `localStorage` under `quest.loop`, and `?loop=2` forces it. PLAY AGAIN on
the true ending returns to loop 1.

| Part | What changes |
| --- | --- |
| Overworld (`quest.js`) | MASTER QUEST: the town is mirrored left to right, nine faster reviewers, first person at 57 s, three hearts, no floating markers (a read building's door and sign turn green), a gold LOOP 2 pill, harsher reviewer lines, and a green Link cap on the player. Reviewers are capped below the player's speed and there is a 6-second grace period after PRESS START. |
| Boss (`magician.js`, `window.QuestMagician`) | REVIEWER 2, TYPE 0002, in the mould of the Magician from The House of the Dead 2: a hovering, horned figure of crimson sinew and bone plates with red tendrils. He teleports between rooftops and the street, throws burning manuscripts (shoot them down), dashes, and sends a line of ground fire. Only the three CONFLICTS OF INTEREST count, the pink flesh his chest doors and hip plates uncover when he winds up, after a dash, and when a manuscript is shot down. REBUTTAL ACCEPTED, then a blast-off in the departmental shuttle. There is no BFG in this loop. |
| Shooter (`shmup.js`) | A DoDonPachi DaiOuJou second loop: revenge bullets from every kill, faster and denser waves, rank, doubled scores and harder bosses. After THE IMPACT FACTOR comes the True Last Boss, PEER REVIEW, a Hibachi homage in five phases, then the TENURED! true ending. |

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

`assets/js/riff.js` (`window.Riff`) synthesises every piece at runtime. There are
no samples and no MIDI files, so there is nothing to license. `assets/js/riff2.js`
adds the second loop's tracks through the plug-in hook (`Riff.addStyle`,
`Riff.addStinger`, `Riff.kit`, `Riff.has`) without touching `riff.js`.

| Call | What plays |
| --- | --- |
| `Riff.play('quest')` | the evolving overworld piece; `Riff.setDread(0..1)` darkens it phrase by phrase, bends the tempo and closes a low-pass filter |
| `Riff.play('quest2')` | the Master Quest version: the same tune inverted about the tonic in the parallel minor, 132 BPM, harder kit and chug bass, darkening sooner |
| `Riff.boss(true)` | a Dark Souls layer joined on the next bar line |
| `Riff.play('space')` | the shooter's arcade track, 2.6 minutes, seamless |
| `Riff.play('cave')` | Beethoven's Moonlight Sonata, first movement, the piece Earthworm Jim 2 used for that level. Generated from the Mutopia engraving, so the notes are the score |
| `Riff.play('title')` | the Koshiro homage: coin blips, a two-bar lead-in, then a seamless 40-bar loop of FM bass, a 303 hook and arcade techno |
| `Riff.play('magician')` | `riff2.js`: industrial techno-rock in D minor at 170 with a four-note teleport motif |
| `Riff.play('space2')` | `riff2.js`: hard trance in E minor at 155 that quotes loop 1's theme in its break and anthem |
| `Riff.play('tlb')` | `riff2.js`: the True Last Boss, E minor at 178, with no relief |
| `Riff.stinger(name)` | `impact`, `victory`, `launch`, `ending`; from `riff2.js`, `reveal`, `tenure`, `tlbwarn` |

`Riff.render(style, seconds, opts)` renders any style offline into an `AudioBuffer`
without disturbing live playback, and `Riff.analyse(buffer)` returns peak, RMS and
onset figures. Nobody has listened to the tracks yet; offline renders for
auditioning are written to `.dev/tmp/render/`.

## Test hooks

Query-string hooks on the home page, all optional:

`?endgame=1` `?bosshp=5` `?skipintro=1` `?god=1` `?shmup=1` `?shmupstage=2|mid|boss|tlb|ending`
`?shmupgod=1` `?shmupdbg=1` `?cave=1` `?cavequiz=1` `?cavecow=1` `?cavegod=1` `?timescale=1..20`
`?dread=0.71` `?maxhits=1` `?bossdbg=1` `?loop=2`

`?shmupstage=tlb` needs `?loop=2`, and `?shmupstage=ending` shows the true ending in loop 2.
`?bossdbg=1` exposes `window.__qb` for whichever boss is active, and `?shmupdbg=1`
exposes `window.__qs` for the shooter.

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
