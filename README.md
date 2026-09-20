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
