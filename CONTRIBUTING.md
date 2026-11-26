# Contributing to Corpus

Corpus is plain HTML, CSS, ES modules, JSON and SVG. There is no build step, no package manager and no external requests, and it should stay that way.

## Run and check

```sh
python3 -m http.server 8000   # fetch() fails from file://, so serve the folder
open http://localhost:8000/?debug
node tools/check.mjs          # the same data check headless (Node 22+); CI runs it on every push
```

`?debug` logs a data check to the console and shows a badge. It checks that every drawn shape has data, every reference resolves, the bones add up to 206, every bone has a joint, and every muscle has a nerve and a blood supply. Get it to 0 issues before you push.

## Project layout

```
index.html              app shell
css/base.css            design tokens, light/dark themes, typography
css/app.css             layout, panel, map states
js/main.js              boot + wiring (store, routes, controls)
js/graph.js             the body graph: nodes, joints, links, side rules, search
js/map.js               mounts SVG layers, highlights, hit-testing ("Under this spot")
js/zoom.js              pan / zoom by animating the SVG viewBox
js/panel.js             the detail panel for every kind of page
js/search.js            type-ahead search
js/browse.js            browse drawer (keyboard-friendly access to everything)
js/router.js            hash routes
js/state.js             tiny observable store
js/sex.js               biological sex: filters the data for one sex (forSex)
js/validate.js          ?debug data checks, once per sex
data/manifest.json      views, styles, sexes, layers, link types, region files
data/skeleton.json      bone groups, bones, joints
data/muscles.json       muscle groups and muscles (origin, insertion, nerve, actions)
data/organs.json        organs
data/vessels.json       arteries and veins (supplies, branches, continues, drains)
data/nerves.json        spinal cord and nerves (innervates, branches)
data/lymphatics.json    lymph vessels, ducts, node groups, thymus and tonsils (collects, drains)
data/ligaments.json     ligaments, tendons, fascia and the knee menisci (stabilises, attaches)
data/links.json         cross-layer and organ-to-organ links
data/regions.json       "Where does it hurt?" areas, causes, red flags
assets/fonts/           Source Serif 4 (roman + italic WOFF2, Latin subset) and its OFL licence
assets/svg/*.svg        one drawing per layer and view (*-anterior, *-posterior), all in the same 480 × 1200 frame
tools/check.mjs         the ?debug data check, headless (node tools/check.mjs)
tools/realistic/        generator for the realistic drawings of every layer (Python + shapely, drawing only)
```

## How the pieces connect

Drawings and data are joined **only by ids**. A shape in an SVG carries `data-id`
(and `data-side="right|left"` for paired structures) matching an `id` in the JSON.
At startup every layer's data is merged into one graph:

- **Nodes** are structures: bones, joints, organs. Paired ones exist twice, as `femur:right` and `femur:left`.
- **Joints** create `articulates` edges between bones, and are clickable nodes themselves.
- **Links** (`data/links.json`) add typed edges such as `protects`, `continues` and `drains`.
  `"@ribs"` refers to every structure in a group.
- **Field links**: a link type in the manifest can name a `field`. Every structure with that field
  then links to what it lists. This is how a muscle's `"origin": ["scapula"]` and
  `"insertion": ["radius"]` become edges, and why each bone panel lists the muscles that start
  or insert on it. Nerves and vessels work the same way: `innervates`, `supplies`, `branches`,
  `continues` and `drains` are fields on their structures.
- **Side rules**: paired ↔ paired links same side to same side, a midline structure links to
  both sides, and `"side": "right"` narrows a link (the liver is protected only by the right ribs).

**Biological sex** (Not set / Female / Male) is a setting, not a route. Anything in the data can
carry `"sex": "female"` or `"male"`; the app builds one graph per setting from data filtered by
`js/sex.js`, and shapes tagged `data-sex` are shown only for their sex. See `data/CLAUDE.md`.

Coordinates follow the anatomical convention: the figure faces you, so the **body's right
is on the viewer's left** (x < 240). The Mirror button flips the view for people matching
it to their own body.

### Data shapes (short)

```jsonc
// a structure (bone or organ)
{ "id": "femur", "name": "Femur", "latin": "Femur", "aka": ["thigh bone"],
  "kind": "long", "group": "lower-limb", "paired": true, "count": 2,
  "summary": "…", "issues": [{ "name": "Hip fracture", "note": "…" }],
  "members": [ … ],     // optional: bones drawn as one group (carpals)
  "countLabel": "…",     // optional: a paired organ's Count fact (default "One on each side")
  "listOnly": true,     // optional: not drawn in any view
  "sex": "female",       // optional: only exists for this biological sex (see data/CLAUDE.md)
  "sexNotes": [{ "sex": "female", "text": "…" }] }  // optional: how it differs by sex

// a joint: connect bones with "bones" (every pair), "chain" (each to the next) or "pairs"
{ "id": "knee", "name": "Knee joint", "class": "synovial", "subtype": "Modified hinge",
  "paired": true, "pairs": [["femur", "tibia"], ["femur", "patella"]], "summary": "…" }

// a muscle: origin / insertion become links (field links, see manifest linkTypes)
{ "id": "biceps", "name": "Biceps brachii", "kind": "muscle", "group": "arm-muscles", "paired": true,
  "origin": ["scapula"], "originNote": "Coracoid process and supraglenoid tubercle",
  "insertion": ["radius"], "nerve": "Musculocutaneous nerve", "actions": ["Turns the palm up", "Bends the elbow"] }

// a link
{ "type": "protects", "from": ["rib-7", "rib-8"], "to": ["liver"], "side": "right" }

// a region
{ "id": "knee", "name": "Knee", "paired": true, "structures": ["femur", "tibia", "knee"],
  "causes": [{ "title": "Meniscus tear", "signs": "…", "urgency": "doctor", "related": ["knee"] }],
  "redFlags": ["…", { "text": "…", "sex": "male" }] }  // functions and redFlags items: a string or { text, sex }
```

## Adding a layer (lymphatics…)

1. **Draw** `assets/svg/<layer>-anterior.svg` with `viewBox="0 0 480 1200"`, aligned to the skeleton.
   Put the shapes inside `<g class="structures">`. Each structure is a
   `<g class="s" data-id="biceps" data-side="right"><path class="b" d="…"/></g>`, where
   `.b` is the body shape, an optional `.c` path holds tendon or cartilage, and an optional `.d` path holds
   detail lines (fibres, sutures). Use `class="deco"` for
   non-interactive decoration. Don't hard-code fill colours: style the layer in `css/app.css`.
2. **Describe** it in `data/<layer>.json`: `{ "layer": "<layer>", "groups": [...], "structures": [...] }`.
3. **Register** it in `data/manifest.json` under `layers`, with `"svg": { "anterior": "assets/svg/<layer>-anterior.svg" }`
   (the order is the drawing order, bottom first).
4. **Connect** it, either with entries in `data/links.json` or with a field on each structure.
   A link type with a `field` links every structure that has that field: a nerve such as
   `{ "id": "radial-nerve", "innervates": ["triceps", "brachioradialis"] }` links itself. To add a
   new kind of relationship, add a link type with `forward` / `reverse` labels (and a `field` if it
   lives on the structures).
5. Run `node tools/check.mjs` (or open `/?debug`) and fix anything the check reports.

### Drawing a layer from the back

List the file under the layer's `svg` in the manifest (`"svg": { "anterior": "…", "posterior": "…-posterior.svg" }`).
Posterior files use the **front frame** (body's right at x < 240); the app flips the back view when it
shows it. Seen from behind, an outline is the mirror image of the front one, so in this frame the
outlines are the same in both files: reuse them and change the draw order, the `back` class (hidden
structures), the `deep` class (what now lies in front, drawn faint) and the detail lines. A stretch
marked `.c` because it is behind bone from the front is usually in plain view from behind, so merge it
into the `.b` shape there. Remove `"listOnly"` from anything you newly draw.

## About the drawings

The SVGs are schematic, not anatomical illustration. They were generated once from
landmark coordinates (rounded shapes, mirrored left and right) and are now ordinary SVG
files: edit them in any vector editor as long as you keep the `data-id` / `data-side`
attributes.
