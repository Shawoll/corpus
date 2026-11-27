# Data

The anatomy lives in `data/*.json`, one file per layer, plus `links.json`, `regions.json` and `manifest.json`. Drawings and data are joined **only by ids**: a shape in an SVG carries `data-id` (and `data-side` for paired structures) matching an `id` in the JSON. The detailed rules for editing are in [`data/CLAUDE.md`](../data/CLAUDE.md).

## The manifest

`data/manifest.json` lists the views (Front, Back, 3D), the drawing styles, the biological sex settings, the layers (each with its data file, its drawings per view and style, and its 3D model), the link types and the region files. The order of `layers` is the drawing order, bottom first.

## How structures connect

- **Nodes** are structures: bones, joints, muscles, organs, vessels, nerves… A paired one exists twice, as `femur:right` and `femur:left`.
- **Joints** connect bones and are clickable nodes themselves.
- **Links** (`data/links.json`) add typed edges such as `protects`, `continues` and `drains`. `"@ribs"` refers to every structure in a group.
- **Field links**: a link type in the manifest can name a `field`. Every structure with that field links to what it lists. That's how a muscle's `"origin": ["scapula"]` becomes an edge, and why each bone lists the muscles that start or end on it. `innervates`, `supplies`, `branches`, `continues` and `drains` work the same way.
- **Side rules**: paired links to paired on the same side, a midline structure links to both sides, and `"side": "right"` narrows a link (the liver is protected only by the right ribs).

## Biological sex

Not set, Female or Male is a setting, not a route. Anything in the data can carry `"sex": "female"` or `"male"`. A tagged *structure, joint, group, link or region* exists only for that sex, while a tagged *text item* (an issue, cause, red flag…) is hidden only for the other sex and is shown with a tag when the setting is Not set, so an urgent cause is never hidden. Shapes for a tagged structure carry `data-sex`. See [`data/CLAUDE.md`](../data/CLAUDE.md#sex-specific-content).

## Languages

The data is written in English. Other languages overlay its text from `locales/<lang>/data/`, keyed by id, and never change ids, links or `latin`. See [i18n.md](i18n.md).

## Shapes

```jsonc
// a structure (bone or organ)
{ "id": "femur", "name": "Femur", "latin": "Femur", "aka": ["thigh bone"],
  "kind": "long", "group": "lower-limb", "paired": true, "count": 2,
  "summary": "…", "issues": [{ "name": "Hip fracture", "note": "…" }],
  "members": [ … ],      // optional: bones drawn as one group (carpals)
  "countLabel": "…",     // optional: a paired organ's Count fact (default "One on each side")
  "listOnly": true,      // optional: not drawn in any view
  "sex": "female",       // optional: only exists for this biological sex
  "sexNotes": [{ "sex": "female", "text": "…" }] }  // optional: how it differs by sex

// a joint: connect bones with "bones" (every pair), "chain" (each to the next) or "pairs"
{ "id": "knee", "name": "Knee joint", "class": "synovial", "subtype": "Modified hinge",
  "paired": true, "pairs": [["femur", "tibia"], ["femur", "patella"]], "summary": "…" }

// a muscle: origin and insertion become links (field links)
{ "id": "biceps", "name": "Biceps brachii", "kind": "muscle", "group": "arm-muscles", "paired": true,
  "origin": ["scapula"], "originNote": "Coracoid process and supraglenoid tubercle",
  "insertion": ["radius"], "nerve": "Musculocutaneous nerve", "actions": ["Turns the palm up", "Bends the elbow"] }

// a link
{ "type": "protects", "from": ["rib-7", "rib-8"], "to": ["liver"], "side": "right" }

// a region ("Where does it hurt?")
{ "id": "knee", "name": "Knee", "paired": true, "structures": ["femur", "tibia", "knee"],
  "causes": [{ "title": "Meniscus tear", "signs": "…", "urgency": "doctor", "related": ["knee"] }],
  "redFlags": ["…", { "text": "…", "sex": "male" }] }  // functions and redFlags items: a string or { text, sex }
```

## Adding a structure or a layer

A new **structure** needs an entry in its layer's JSON and a shape in at least one view's drawing (see [drawings.md](drawings.md)), or `"listOnly": true` if it isn't drawn. To show it in 3D, map it in `tools/model3d/map.json` (see [3d-model.md](3d-model.md)).

A new **layer**:

1. **Draw** `assets/svg/<layer>-anterior.svg` (and `-posterior.svg`) in the shared 480 × 1200 frame, aligned to the skeleton.
2. **Describe** it in `data/<layer>.json`: `{ "layer": "<layer>", "groups": [...], "structures": [...] }`.
3. **Register** it in `data/manifest.json` under `layers`, with its `data` and its `svg` per view.
4. **Connect** it, with entries in `data/links.json` or with a field on each structure. For a new kind of relationship, add a link type with `forward` / `reverse` labels (and a `field` if it lives on the structures).
5. **Style** it in `css/app.css` (`[data-layer="<layer>"]`), then run `node tools/check.mjs` and fix what it reports.
