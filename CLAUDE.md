# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Corpus is an interactive front-view map of the human body (bones, joints, muscles, organs, blood vessels, nerves and "Where does it hurt?" regions). It is plain HTML, CSS, ES modules, JSON and SVG. There is no build step, no package manager, no dependencies and no external requests, and it deploys as-is to GitHub Pages from the repository root on `master`. Keep it that way: don't add a bundler, npm packages, CDN scripts or absolute paths.

`README.md` documents the data shapes and the "add a layer" recipe in full. `data/CLAUDE.md` and `assets/svg/CLAUDE.md` hold the rules for editing data and drawings.

## Commands

```sh
python3 -m http.server 8000      # serve the folder; fetch() fails from file://
open http://localhost:8000/?debug # run the data check
```

There are no tests, linter or build. The only automated check is `?debug`: `main.js` dynamically imports `js/validate.js`, which logs a `[Corpus] data check` group to the console (a table of problems) and adds a badge to the page. Run it after any data or SVG change and get it to 0 issues. It checks that every drawn shape has data, every reference and group resolves, paired and unpaired sides match, every structure that isn't `listOnly` is drawn, bone `count`s sum to 206, every bone (except ones with `noJoints`) has a joint, every joint connects something, every muscle has an origin or insertion, every nerve and vessel connects to something, every muscle has a nerve and a blood supply, and every organ has a blood supply.

`window.corpus` exposes `{ graph, map, store, zoom }` in the console for inspection, e.g. `corpus.graph.edges('femur:right')`.

Data and SVG are fetched with `cache: 'no-cache'`, so a reload picks up edits.

## Architecture

**Boot (`js/main.js`)**: loads `data/manifest.json`, then every layer's JSON and SVG text, the link files and the regions in parallel. It builds one `Graph`, mounts all SVGs into the single `<svg id="map">`, and wires the store, router, panel, search, browse and controls. All DOM event handling for the panel lives here, delegated on data attributes the panel emits (see below).

**Graph (`js/graph.js`)** is the core model. The rest of the code works with graph keys, not raw JSON:
- A *key* is `id` for midline structures and `id:right` / `id:left` for `paired` ones (`parseKey`, `graph.k`, `keysFor`, `instances`). SVG shapes, highlights, routes and panel chips all use the same keys.
- A node's `type` comes from the structure's own `type`, else the data file's top-level `type` (`bone`, `muscle`, `organ`, `vessel`, `nerve`). Entries in a file's `joints` array become `type: 'joint'`. Panel and validation logic branch on `type`.
- Edges are stored in both directions in `adj`, with `dir` set to `out`, `in` or (for `articulates`) `both`. Joints add `articulates` edges with `via: <joint key>` and fill `jointMembers` / `memberJoints`.
- Links come from three sources: joints, `data/links.json`, and *field links*. A `linkTypes` entry in the manifest with a `field` turns that field on every structure into links: muscle `origin` / `insertion`, nerve `innervates`, artery `supplies`, and `branches`, `continues` and `drains` on nerves and vessels. To add a relationship, give the link type a `field` and put the field on the structures. No code change is needed.
- `resolvePair` applies the side rules (paired to paired same side, midline to both sides, explicit `:side` or link `side` narrows the match). `@group` refs expand to the whole group subtree.
- Unknown ids, groups and link types are collected in `graph.problems` instead of throwing. Only `?debug` shows them, so a typo fails silently in normal use.
- The search index and its ranking weights are also built here.

**Map (`js/map.js`)**: imports each SVG's children into `<g class="layer" data-layer=…>` (in manifest order: first is drawn at the bottom). It then indexes every `[data-id]` element by key and clones each `.b` path as an invisible wider `.hit` path for tapping. `render()` toggles `is-sel` / `is-rel` classes, layer `off` / `active` / `context` classes, the mirror transform on `#world`, and outline overlays. `probe()` uses `elementsFromPoint` with a `.probing` class to list everything under a tap across all layers, including hidden ones (the "Under this spot" list in hurt mode).

**State and routing**: `js/state.js` is a minimal store. Subscribers compare fields **by reference**, so always pass a new object (e.g. `new Set(prev.visible)`) and never mutate state in place, or the panel won't re-render. `js/router.js` handles hash routes: `#/s/<id>[/<side>][?m=<member>]`, `#/g/<group>`, `#/hurt`, `#/r/<region>[/<side>]`. Navigation is always `Router.go()` → `hashchange` → `onRoute()` → `store.set()` → render.

**Panel (`js/panel.js`)**: renders the current route to an HTML string. Every data value must go through `esc()`. Interactivity is declared with attributes that `main.js` handles: `data-nav` (route path), `data-keys` / `data-rkeys` (highlight on hover or focus), `data-expand` (open a collapsed range chip), `data-layer-on` (show a hidden layer) and `data-back` (return to the region). Runs of three or more numbered siblings collapse into one range chip using the structure's `ordinal` and the group's `rangeLabel` / `rangePrefix`. Link sections follow the `order` list in `linksSection` (a new link type not in it sorts last), and flow types in `UPSTREAM_FIRST` show the incoming side first. A link `note` shared by a whole section goes in its title; when notes differ (the kidney drains urine to the bladder and blood to the renal vein) each note labels its own chips. Nerve and vessel facts come from `kind`, `roots`, `carries` and `pulse`. `REGION_GROUPS` at the top hard-codes the order and grouping of the "Where does it hurt?" list, so **a new region must also be added there** or it won't appear in that list.

**Zoom (`js/zoom.js`)**: pans and zooms by animating the SVG `viewBox` rather than with CSS transforms. `reveal(bbox)` frames a selection.

**Styling**: `css/base.css` holds design tokens, typography and the light and dark themes. Dark tokens are defined twice: under `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and under `:root[data-theme="dark"]`. Change both together. `css/app.css` holds layout and all map styling, keyed on SVG classes and `[data-layer=…]`. The theme toggle sets `data-theme` on `<html>`. Preferences (theme, joints, mirror) are stored in `localStorage` under keys prefixed `corpus:`.

## Conventions

- Anatomical orientation: the figure faces the viewer, so the **body's right is on the viewer's left (x < 240)**. "Mirror" only flips the rendered view (`matrix(-1 0 0 1 480 0)` on `#world`). Data and drawings always use the anatomical convention.
- Health content stays general and conservative, and every health page shows the disclaimer from `data/regions.json`. Urgency values are `self-care`, `doctor` and `urgent`.
- Copy uses British spelling ("fibres", "colour"). Latin names follow Terminologia Anatomica.
- `.impeccable/` is a local design-tool cache and is gitignored.
