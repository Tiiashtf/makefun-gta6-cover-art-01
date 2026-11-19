# Vice City Sunset — GTA-style Cover Art Maker

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Tiiashtf/makefun-gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Tiiashtf/makefun-gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns your photos and a caption into a multi-panel
poster cover in the style of GTA 6's posters — a Vice City sunset grade,
palm silhouettes, neon pink and cyan lettering — and exports it as a PNG
to share. Built for the make.fun competition
[Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01).

## What it does

- **Your photos, your machine.** Pick photos from your computer (file
  picker or drag-and-drop) or try the two built-in demo photos. Photos are
  read locally with the browser's file APIs and never uploaded anywhere.
- **Multi-panel poster.** Three layouts: a hero panel over two smaller
  ones, three tall vertical strips, or a 2×2 grid. One photo can fill
  several panels, or each panel can hold a different photo.
- **Crop and position.** Click a panel to select it, then drag its photo
  to move it, scroll or use the slider to zoom it, until every panel is
  framed the way you want.
- **Caption.** A big condensed title and a subtitle line, both editable,
  shown live on the preview in bold display lettering with a neon offset
  shadow.
- **Sunset grade.** Every photo gets the same warm golden-hour wash, over
  a hand-drawn sunset sky with a low sun, palm silhouettes, film grain
  and a vignette.
- **Export.** One click downloads the poster as a PNG at 1080×1080,
  1080×1350 or 1920×1080.

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. No build step,
no network: every script, style, font and image is a file under `app/`.

## How to make a cover

1. Add photos with **Choose photos…** (or drop them on the drop zone),
   or click a demo photo.
2. Pick a layout, type your title and subtitle.
3. Click a panel, drag its photo into place, zoom with the slider.
4. Pick an export size and press **Download PNG cover**.

Keyboard shortcuts (with the preview focused or anywhere outside a text
field): arrow keys nudge the selected panel's photo, `+` and `−` zoom it.

A cover can also be reproduced exactly from a URL, for example:

```
http://localhost:8080/?photo=pier&caption=Neon%20Tide&subtitle=The%20catch%20of%20the%20century&layout=strips&size=wide&shot=cover
```

`shot=cover` shows the finished cover full-frame; without it you get the
editor.

## Originality

All art and lettering in this entry is original: the sunset sky, the sun,
the palm silhouettes and the grain are drawn in code, and the caption is
set in Oswald and Inter, both under the SIL Open Font License (see
`app/fonts/OFL.txt`). No Rockstar Games logo, wordmark, official artwork,
character or font is used anywhere. The two demo photos
(`app/samples/boulevard.jpg`, `app/samples/pier.jpg`) were made with an
image model for make.fun and are free to use.

## Repository layout

- `app/` — the offline web app: `index.html`, `style.css`, `src/cover.js`
  (the poster renderer), `src/main.js` (the editor), `fonts/`,
  `samples/`.
- `main.ts` — the entry program: copies `app/` and `screenshots/` to the
  output directory and writes `dossier.json` with the kit library.
- `screenshots/` — four screenshots taken from the app itself.
- `vendor/makefun-app.ts` — the kit's dossier library, unchanged.

## License

MIT — see [LICENSE](LICENSE).
