# Contributing to Corpus

## Ground rules

- **No build step, no dependencies.** Corpus is plain HTML, CSS, ES modules, JSON and SVG, served as files. Don't add a bundler, npm packages, CDN scripts or absolute paths. The one exception is three.js (MIT, r170), copied into `js/vendor/three/` for the 3D view and loaded only when that view opens. Update it only by replacing those files with another pinned release.
- **No external requests.** Everything the site needs is in the repository.
- **Health content stays general and conservative.** Every health page shows the disclaimer, urgency is one of `self-care`, `doctor` or `urgent`, and nothing may read as a diagnosis. See [`PRODUCT.md`](../PRODUCT.md).
- **British spelling** ("fibres", "colour"). Latin names follow Terminologia Anatomica.

## Run and check

```sh
python3 -m http.server 8000   # fetch() fails from file://, so serve the folder
open http://localhost:8000/?debug
node tools/check.mjs          # the same data check headless (Node 22+); CI runs it on every push
```

`?debug` logs the data check to the console and shows a badge. The check makes sure that every drawn shape has data, every reference resolves, the bones add up to 206, every bone has a joint, every muscle has a nerve and a blood supply, and the 3D models match the data. It runs once per biological sex setting. Get it to 0 issues before you push.

The page is served through a service worker that fetches from the network first (see [offline.md](offline.md)), so a reload picks up your edits. If an old copy ever sticks, reload once more or clear the site data.

## Typical changes

- **Fix or add facts**: edit `data/*.json`, run the check. See [data.md](data.md) and [`data/CLAUDE.md`](../data/CLAUDE.md).
- **Add a structure**: give it an entry in its layer's JSON *and* a shape in the drawings (or mark it `listOnly`), then run the check. See [data.md](data.md#adding-a-structure-or-a-layer).
- **Change a drawing**: edit the schematic SVG, then regenerate the realistic one with `tools/realistic/build.py`. See [drawings.md](drawings.md).
- **Change the 3D model**: edit `tools/model3d/map.json` or `generated.py` and rebuild. See [3d-model.md](3d-model.md).
- **Change English text**: the check then reports its translations as stale. Update them in `locales/<lang>/`, then run `node tools/i18n.mjs snapshot <lang>`. A new text field must also be added to `TEXT_FIELDS` in `js/i18n.js`. See [i18n.md](i18n.md).
- **A new interface string**: add the key to `locales/en/ui.json` and use `t('key')` (or `t.html` for markup), then translate it in every other `ui.json`.
- **A new "Where does it hurt?" area**: add it to `data/regions.json`, draw it in `assets/svg/regions-*.svg`, add it to `REGION_GROUPS` in `js/panel.js` (or it won't be listed), and rebuild the 3D skin (`build.py skin`).

## Style of the code

- Every data value in the panel's HTML goes through `esc()`.
- The store compares fields by reference: always pass new objects (`new Set(prev.visible)`), never mutate state in place.
- Navigation always goes through the hash: `Router.go()` → `hashchange` → `onRoute()` → `store.set()` → render.
- Keep the light and dark tokens in `css/base.css` in step: dark tokens are defined twice (the media query and `[data-theme="dark"]`).
