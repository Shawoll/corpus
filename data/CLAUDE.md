# Data files

The structures and links behind the map. The JSON shapes are in the root `README.md` ("Data shapes"). This file covers the rules that aren't obvious from the shapes. Run `/?debug` after every edit (see the root `CLAUDE.md`).

## Ids and sides

- `id`s are global across **all** layers and joints. If two entries share an id, the later one overwrites the earlier one, and only `?debug` reports it (`Duplicate id`). Ids are kebab-case and appear in URLs (`#/s/<id>`).
- `"paired": true` means the structure exists as `id:right` and `id:left`. The data has one entry, and the SVG draws both sides with `data-side`. Use `"id:right"` in a reference only to point at one side. Otherwise the side rules in `graph.js` (`resolvePair`) choose sides.
- A structure that isn't drawn in the front view needs `"listOnly": true`, or the check reports it as not drawn.

## Skeleton (`skeleton.json`)

- The `count` fields of all bones must sum to **206**. Paired bones count both sides (`femur` has `count: 2`). A grouped entry (carpals, phalanges…) carries the total for its `members`.
- Every bone needs at least one joint. A bone that genuinely has none (the hyoid) gets `"noJoints": "<explanation>"`, which the panel also shows.
- Joints connect bones with exactly one of `bones` (every pair), `chain` (each to the next) or `pairs`. A single `bones` entry has two meanings. On a paired joint it is a joint *inside* a grouped bone (`intercarpal` on `carpals`): it is recorded as a member and creates no edge. On an unpaired joint with a paired bone it joins that bone's two sides (`pubic-symphysis` on `hip-bone`). `class` must be `synovial`, `cartilaginous` or `fibrous`, because it drives the marker colour.
- Numbered siblings (ribs, vertebrae) carry an `ordinal`. Their group's `rangeLabel` (with `{r}`) and optional `rangePrefix` let the panel collapse them into ranges such as "T1–T12" (prefixes `C`, `T`, `L`).

## Groups

`groups` form a tree through `parent`. `"@<group>"` in any reference list (links, region `structures`, cause `related`) expands to every structure in that subtree. A group's `issues` are shown on member structures that have no `issues` of their own (`inheritedIssues`).

## Muscles and field links

`origin` and `insertion` are arrays of structure ids. They become edges because their link types in `manifest.json` declare `"field"`. An optional `<field>Note` (`originNote`, `insertionNote`) is shown as the attachment detail. It is also shown when the array is empty, e.g. the diaphragm inserting into its own central tendon. Every muscle needs at least one origin or insertion.

## Links (`links.json`)

`type` must be a key of `manifest.json` → `linkTypes`, whose `forward` / `reverse` labels are the panel section titles. `"side": "right"` keeps only right-side (and midline) matches. `note` is shown next to the section title.

## Regions (`regions.json`)

- Region ids are separate from structure ids (`knee` can be both a region and a joint).
- Each region that isn't `"view": "back"` needs a shape in `assets/svg/regions-anterior.svg`.
- A new region also has to be added to `REGION_GROUPS` in `js/panel.js`, or it won't appear in the "Where does it hurt?" list.
- `urgency` is `self-care`, `doctor` or `urgent`. Keep `redFlags` pointed at emergency care, and keep content general rather than diagnostic.
