# Corpus: a connected map of the human body

An interactive map of the human body, seen from the front and the back, treated as one connected system.
Tap a bone, joint, muscle, organ, nerve or blood vessel to see what it is, what it connects to
and what commonly goes wrong. In **Where does it hurt?** mode you tap a body area to see what lies there,
the usual causes of pain and when to get help.

Everything is plain HTML, CSS, JavaScript (ES modules), JSON and SVG: no build step,
no dependencies, no external requests. It runs as-is on GitHub Pages.

> Corpus is educational. It is not a diagnosis and not medical advice.

## What's inside

| Layer | Contents |
| --- | --- |
| Skeleton | All **206** bones: 71 entries, with tiny bones grouped (carpals, metacarpals, phalanges, tarsals, metatarsals), plus **33 joints** classified as synovial, cartilaginous or fibrous |
| Muscles | 45 entries: 35 drawn from the front, plus back and deep muscles such as the hamstrings, rotator cuff and erector spinae in the list. Small muscles that work together (forearm flexors, adductors…) are grouped, with their members listed |
| Organs | 16 major organs: brain, thyroid, trachea, esophagus, lungs, heart, liver, gallbladder, stomach, spleen, pancreas, kidneys, small and large intestine, appendix, bladder |
| Vessels | 38 major arteries and veins, from the aorta and venae cavae to the palmar arches and the great saphenous vein, with pulse points |
| Nerves | 24 entries: the spinal cord and spinal nerves, four cranial nerves (trigeminal, facial, vagus, accessory), the cervical, brachial, lumbar and sacral plexuses and the main nerves of the arms and legs |
| Links | Bone ↔ bone (through joints), muscle → bone (origin and insertion), bone → organ ("protects"), organ → organ ("continues into", "drains into"), nerve → muscle or organ ("supplies nerves to"), artery → muscle, organ or bone ("supplies blood to"), vessel and nerve branching ("gives rise to"), vein → vein or heart ("drains into"), heart → aorta ("pumps blood into") |
| Views | **Front** and **Back**. Every layer is drawn from both sides. The back view shows the back of the skeleton, the back muscles (trapezius, latissimus dorsi, erector spinae, glutes, hamstrings, calf), the vessels and nerves with the ones lying in front drawn faint, the organs from behind and the body areas |
| Regions | 25 front body areas and 3 back areas (upper back, lower back, buttock), each with likely causes, urgency and red flags. Limb, head and neck areas can be tapped from both sides |

## Run it locally

Browsers block `fetch()` from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Add `?debug` to the URL (`http://localhost:8000/?debug`) to run a data check, or run the same
check without a browser with `node tools/check.mjs` (Node 22+, no packages; GitHub Actions runs it
on every push). The browser version logs to the
console and shows a badge: every SVG shape has data, every reference resolves, the
bones add up to 206, every bone except the hyoid has a joint, and every muscle has a nerve
and blood supply.

## Deploy to GitHub Pages

1. Create a repository and push this folder to it (the repository root is the site root).
2. In **Settings → Pages**, choose **Deploy from a branch**, pick your default branch (`main` or `master`) and folder `/ (root)`.
3. The site appears at `https://<user>.github.io/<repo>/`.

All paths are relative and routing uses the URL hash (`#/s/femur/left`), so no server
configuration is needed. `.nojekyll` stops GitHub from running Jekyll over the files.

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
js/validate.js          ?debug data checks
data/manifest.json      layers, link types, region files
data/skeleton.json      bone groups, bones, joints
data/muscles.json       muscle groups and muscles (origin, insertion, nerve, actions)
data/organs.json        organs
data/vessels.json       arteries and veins (supplies, branches, continues, drains)
data/nerves.json        spinal cord and nerves (innervates, branches)
data/links.json         cross-layer and organ-to-organ links
data/regions.json       "Where does it hurt?" areas, causes, red flags
assets/svg/*.svg        one drawing per layer and view (*-anterior, *-posterior), all in the same 480 × 1200 frame
tools/check.mjs         the ?debug data check, headless (node tools/check.mjs)
tools/realistic/        generator for the realistic skeleton drawings (Python + shapely, drawing only)
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
  "listOnly": true }    // optional: not drawn in any view

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
  "redFlags": ["…"] }
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

## Content and safety

The anatomy follows standard references, with Latin names from Terminologia Anatomica. The
health content is general and conservative: common issues, typical signs, a rough urgency
(self-care, see a doctor, urgent) and red flags that point to emergency care. It can't take
a history or examine anyone, so the app says so on every health page.
