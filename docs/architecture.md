# Architecture

## Project layout

```
index.html              app shell (and the import map for three.js)
manifest.webmanifest    web app manifest: name, colours, icons (installing, offline.md)
sw.js                   service worker: network first, cache as fallback (offline.md)
css/base.css            design tokens, light and dark themes, typography
css/app.css             layout, panel, map and 3D states
js/main.js              boot and wiring: loads everything, store, routes, controls, settings
js/graph.js             the body graph: nodes, joints, links, side rules, search index
js/map.js               mounts the SVG drawings, highlights, hit-testing ("Under this spot")
js/zoom.js              pan and zoom by animating the SVG viewBox
js/panel.js             the detail panel for every kind of page
js/search.js            type-ahead search
js/browse.js            the browse list (keyboard access to everything)
js/router.js            hash routes
js/state.js             a tiny observable store
js/sex.js               biological sex: filters the data for one setting (forSex)
js/i18n.js              languages: interface strings (t), data overlays (forLang) (i18n.md)
js/model3d.js           the 3D view (three.js): models, picking, highlights, camera
js/offline.js           registers sw.js, "Save for offline"
js/validate.js          the data check (pure), shared by ?debug and tools/check.mjs
js/vendor/three/        three.js r170 (MIT): the module, GLTFLoader, OrbitControls, the meshopt decoder
data/                   the anatomy as JSON, in English (data.md)
locales/                interface strings and translations of the data (i18n.md)
assets/svg/             one drawing per layer, view and style (drawings.md)
assets/3d/              one .glb per layer, the skin, keys.json and the model licence (3d-model.md)
assets/fonts/           Source Serif 4 (WOFF2, Latin subset) and its OFL licence
assets/icons/           app icons for the home screen
tools/check.mjs         the data check, headless
tools/i18n.mjs          translation status, to-do lists and snapshots (i18n.md)
tools/realistic/        generator for the realistic drawings (Python + shapely, drawing only)
tools/model3d/          builds assets/3d/ from the Z-Anatomy models (Python + numpy + meshoptimizer, drawing only)
docs/                   these guides
```

## How it starts

`js/main.js` loads `data/manifest.json`, then in parallel every layer's JSON, its default drawing for each view, the link files, the regions, and the English and chosen language's strings and overlays ([i18n.md](i18n.md)). It builds the graph, mounts every drawing into the single `<svg id="map">` and wires up the store, the router, the panel, search, browse and the controls. All the panel's interactivity is declared with data attributes (`data-nav`, `data-keys`…) and handled by delegation in `main.js`.

What isn't needed for the first paint loads on demand: the realistic drawings the first time that style is shown, and the 3D view (three.js and one model per visible layer) the first time it is opened. Once the page has loaded, `js/offline.js` starts the service worker.

## The body graph

`js/graph.js` turns the data into one graph, and the rest of the code works with its *keys*:

- A key is `id` for a midline structure and `id:right` / `id:left` for a paired one. Drawings, highlights, routes and panel chips all use the same keys.
- Edges come from three places: joints (bone to bone, through the joint), `data/links.json`, and *field links*, where a link type in the manifest names a field (`origin`, `innervates`, `supplies`…) and every structure with that field links to what it lists.
- Side rules decide which sides connect: paired to paired on the same side, midline to both sides, and an explicit `:side` or link `side` narrows it.
- Unknown ids and groups are collected in `graph.problems` instead of throwing, so a typo only shows in the data check.

One graph is built per biological sex setting (Not set, Female, Male), from the data in the chosen language (`js/i18n.js`'s `forLang`) filtered by `js/sex.js`. Switching the setting swaps the graph; switching the language rebuilds them.

## Routes and state

Routes live in the URL hash: `#/s/<id>[/<side>]` for a structure, `#/g/<group>`, `#/hurt` and `#/r/<region>[/<side>]`. Navigation always goes `Router.go()` → `hashchange` → `onRoute()` → `store.set()` → render. The store (`js/state.js`) compares fields by reference, so every change passes a new object.

The view (Front, Back, 3D), drawing style, biological sex, language, theme, joints and mirror are preferences, saved in `localStorage` under `corpus:` keys and not part of the route. When a route's structure isn't drawn in the current view, or exists only for another sex, `onRoute()` switches to one where it is.

## Drawing it

- **2D** (`js/map.js`, `js/zoom.js`): each view is a `<g class="view">` of `<g class="layer">` groups in manifest order (the first is at the bottom). Rendering toggles classes (`is-sel`, `is-rel`, `off`, `context`…), and the back view is the front frame flipped by a transform. Zoom animates the `viewBox`, and framing a selection keeps it clear of the layer chips and, on phones, the bottom sheet.
- **3D** (`js/model3d.js`): mirrors the map's interface (`render`, `setHover`, `probe`, `frame`…), so `main.js` treats it as another view. See [3d-model.md](3d-model.md).
- **Styling**: `css/base.css` holds the design tokens and both themes. `css/app.css` holds the layout and all map styling, keyed on SVG classes and `[data-layer=…]`. The design system is described in [`DESIGN.md`](../DESIGN.md).

## The data check

`js/validate.js` is pure (no DOM). `node tools/check.mjs` runs it headless (and CI runs that on every push), and `?debug` runs it in the browser with a console table and a badge. It runs once per biological sex setting, and checks every translation against English.
