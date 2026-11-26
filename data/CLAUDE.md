# Data files

The structures and links behind the map. The JSON shapes are in the root `CONTRIBUTING.md` ("Data shapes"). This file covers the rules that aren't obvious from the shapes. Run `node tools/check.mjs` (or `/?debug`) after every edit (see the root `CLAUDE.md`).

## Ids and sides

- `id`s are global across **all** layers and joints. If two entries share an id, the later one overwrites the earlier one, and only `?debug` reports it (`Duplicate id`). Ids are kebab-case and appear in URLs (`#/s/<id>`).
- `"paired": true` means the structure exists as `id:right` and `id:left`. The data has one entry, and the SVG draws both sides with `data-side`. Use `"id:right"` in a reference only to point at one side. Otherwise the side rules in `graph.js` (`resolvePair`) choose sides.
- A structure that isn't drawn in any view (front or back) needs `"listOnly": true`, or the check reports it as not drawn. Remove the flag once it is drawn: the check also reports a drawn structure that is still `listOnly`.

## Skeleton (`skeleton.json`)

- The `count` fields of all bones must sum to **206**. Paired bones count both sides (`femur` has `count: 2`). A grouped entry (carpals, phalanges…) carries the total for its `members`.
- Every bone needs at least one joint. A bone that genuinely has none (the hyoid) gets `"noJoints": "<explanation>"`, which the panel also shows.
- Joints connect bones with exactly one of `bones` (every pair), `chain` (each to the next) or `pairs`. A single `bones` entry has two meanings. On a paired joint it is a joint *inside* a grouped bone (`intercarpal` on `carpals`): it is recorded as a member and creates no edge. On an unpaired joint with a paired bone it joins that bone's two sides (`pubic-symphysis` on `hip-bone`). `class` must be `synovial`, `cartilaginous` or `fibrous`, because it drives the marker colour.
- Numbered siblings (ribs, vertebrae) carry an `ordinal`. Their group's `rangeLabel` (with `{r}`) and optional `rangePrefix` let the panel collapse them into ranges such as "T1–T12" (prefixes `C`, `T`, `L`).

## Groups

`groups` form a tree through `parent`. `"@<group>"` in any reference list (links, region `structures`, cause `related`) expands to every structure in that subtree. A group's `issues` are shown on member structures that have no `issues` of their own (`inheritedIssues`).

## Muscles and field links

`origin` and `insertion` are arrays of structure ids. They become edges because their link types in `manifest.json` declare `"field"`. An optional `<field>Note` (`originNote`, `insertionNote`) is shown as the attachment detail. It is also shown when the array is empty, e.g. the diaphragm inserting into its own central tendon. Every muscle needs at least one origin or insertion.

## Vessels and nerves (`vessels.json`, `nerves.json`)

- Their links are field links too: `supplies` (artery → what it feeds), `innervates` (nerve → muscle or organ), `branches` (parent → branch, shown as "Gives rise to" / "Arises from"), `continues` (the same vessel under a new name, e.g. axillary → brachial artery) and `drains` (vein → the vein or heart it empties into). Each can carry a `<field>Note`.
- Use a side in a reference when only one side is meant: the aorta gives rise to `subclavian-artery:left` while the brachiocephalic trunk gives rise to `subclavian-artery:right`.
- Organ → vein drainage and the heart's `pumps` links live in `links.json`, because the organ is the source.
- `kind` is `artery` or `vein` for vessels and `cranial`, `spinal-cord`, `spinal`, `plexus` or `peripheral` for nerves. Optional `carries`, `pulse` and `roots` are shown as facts.
- Keep `aka` to true synonyms. Branch names belong in `members`, which search already indexes; the panel shows the first `aka` that isn't a member as "also: …".
- `?debug` requires every muscle to have a nerve supply (`innervates`) and a blood supply (`supplies`), and every organ a blood supply, so a new muscle or organ needs both.

## Lymphatics (`lymphatics.json`)

- Its file `type` is `lymph`, and `kind` is `node` (a node group), `vessel`, `duct` or `organ` (thymus, tonsils). The spleen stays in `organs.json`.
- `collects` (node or vessel → the organs and muscles whose lymph it filters, "Collects lymph from" / "Lymph drains to") and `drains` (lymph flow onward, ending in `subclavian-vein:left` / `:right`) are field links. Paired node groups that drain into a different duct on each side (cervical and axillary nodes: right → right lymphatic duct, left → thoracic duct) do so through `links.json` entries with `"side"`.
- `?debug` reports a lymphatic structure that connects nothing, as it does for nerves and vessels.

## Ligaments & tendons (`ligaments.json`)

- Its file `type` is `connective`, and `kind` is `ligament`, `tendon`, `fascia` or `cartilage` (the menisci), shown as the panel's Type.
- `stabilises` (→ the joints it holds, "Stabilises" / "Stabilised by") and `attaches` (→ the bones and muscles it joins, "Attaches to" / "Ligaments & tendons attached") are field links. A tendon attaches to its muscle and its bone.
- `?debug` reports a ligament or tendon that connects nothing. Add a new one to the matching "Where does it hurt?" region's `structures` and to the `related` of its causes.

## Links (`links.json`)

`type` must be a key of `manifest.json` → `linkTypes`, whose `forward` / `reverse` labels are the panel section titles. `"side": "right"` keeps only right-side (and midline) matches. `note` is shown next to the section title, or above its own chips when a section mixes links with different notes, so only annotate a link when the note tells it apart from others in the same section.

## Regions (`regions.json`)

- Region ids are separate from structure ids (`knee` can be both a region and a joint).
- Each region needs a shape in `assets/svg/regions-anterior.svg`, or, when it is `"view": "back"` (an area on the back of the body), in `regions-posterior.svg`. Areas seen from both sides (limbs, head, neck) can also have a shape with the same id in the other drawing.
- A new region also has to be added to `REGION_GROUPS` in `js/panel.js`, or it won't appear in the "Where does it hurt?" list.
- `urgency` is `self-care`, `doctor` or `urgent`. Keep `redFlags` pointed at emergency care, and keep content general rather than diagnostic.
