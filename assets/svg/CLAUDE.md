# Layer drawings

One SVG per layer and view (`<layer>-anterior.svg`, `<layer>-posterior.svg`), listed per view in `data/manifest.json`, all in the same `viewBox="0 0 480 1200"` and aligned to the skeleton. Shapes are joined to data **only** by `data-id` (plus `data-side="right|left"` for paired structures), so a renamed id must change in both the SVG and the JSON.

**Every file uses the front frame: the body's right side has x < 240, posterior files included.** The app shows a view with `"flip": true` (the back) through the mirror transform, so seen from behind the right side ends up on the viewer's right. An outline seen from behind is the mirror image of the front one, so in this frame bone and limb outlines are identical in both views: copy them, then change the draw order (what is on top from behind), the `back` class (what is hidden) and the `.d` detail lines. A structure drawn in a view only as `s back` doesn't count as shown there, so selecting it switches to a view where it is tappable.

`js/map.js` imports only the root's child elements and **drops `<title>`, `<style>` and `<script>`**. Inline styles and fill colours are therefore lost or fight the theme. Style everything in `css/app.css` using tokens from `css/base.css`.

## Class vocabulary

| Markup | Meaning |
| --- | --- |
| `<g class="structures">` | wrapper for interactive shapes |
| `<g class="s" data-id … data-side …>` | one structure instance. Add `m` for muscles and `o` for organs |
| `data-sex="female\|male"` on a `<g class="s">` | a sex-specific shape, shown only when that biological sex is chosen. Its structure must carry the same `"sex"` in the data (the check reports a mismatch per sex). Two shapes may share an id and side when each has a different `data-sex` (the female and male breast) |
| `.b` path | body shape: filled, used for highlights, outlines and the bounding box. map.js clones it into the tap target (`.hit`), so don't add `.hit` by hand |
| `.c` path | cartilage or tendon |
| `.d` path | detail lines (fibres, sutures). Hidden for muscles when that layer is in the background or in hurt mode |
| `s deep` | a structure lying under others. Darker fill, still tappable |
| `s back` | a structure behind the body (e.g. the back half of the ribs). Muted fill, and its `.hit` is disabled, so it can't be tapped |
| `s a` / `s v` / `s n` | an artery, vein or nerve (vessels and nerves layers). Drawn as thin filled bands |
| `.c` path in `s a` / `s v` / `s n` | a stretch that runs behind bone (the radial nerve's spiral groove, the deep femoral artery). Drawn faint, not part of the tap target |
| `s jt` | joint tissue drawn as a shape (e.g. intervertebral discs). Its `data-id` is a joint id |
| `<g class="joints"><circle class="jm" data-id=<joint id> …>` | joint markers, coloured by the joint's `class` and hidden by the Joints toggle. In a realistic file a joint listed in `tools/realistic/joints.py` (`JOINTS`) is also drawn as anatomy, `<g class="jm ja">` with a capsule (`.cap`) and joint space (`.js`) path (`jm ja su` for a suture: `.js` is the serrated seam, `.cap` an invisible tap target), and its dot becomes `class="jm jd"`. The Joints setting shows the dots (`#map.joints-dots`) or the anatomy, never both |
| `class="deco …"` | non-interactive decoration (no `data-id`) |
| `regions-<view>.svg`: `<g class="regions"><g class="rg" data-id=<region id>>` | "Where does it hurt?" areas. Ids match `data/regions.json`; the same id may appear in both views |

## Realistic drawings

A layer can have a second drawing per view in another style, listed under the layer's `styles` in `data/manifest.json` (`"styles": { "realistic": { "anterior": "assets/svg/skeleton-anterior-realistic.svg" } }`). The app mounts both, shows the one matching the Simple / Real switch, and falls back to the default drawing in views without one. **A realistic file must contain exactly the same `data-id` / `data-side` set as the default file for that view** (the data check reports any difference), in the same frame and draw order, with the same joint markers.

Realistic structures add shading paths inside each `<g class="s">`, all non-interactive and coloured from tokens through the layer's `--shade` / `--lit` / `--pore`:

| Markup | Meaning |
| --- | --- |
| `.sh.sh1` … `.sh.sh4` | stacked form-shadow bands on the side away from the light (upper left), widest and faintest first, plus contact shadows from bones lying on top |
| `.hl` | the lit rim on the upper-left edge |
| `.f` | recesses drawn dark: foramina, sockets, fovea, notches |
| `.fb` | finer fibre lines between the drawn `.d` fibres (muscles, ligaments) |
| `.gl` | a soft sheen inside the lit edge (smooth organs, lymph nodes) |

`skeleton-anterior-realistic.svg` and `skeleton-posterior-realistic.svg` are **generated**: don't edit them by hand. `tools/realistic/` builds them from the schematic files (which supply the draw order, ids, sides and joint markers) and its own anatomy (`skeleton.py`, one builder per bone, right side only; the left is mirrored and lit again). To change a realistic bone, edit its builder and run `python3 tools/realistic/build.py`, then `node tools/check.mjs`. It needs shapely (`python3 -m venv ~/.venvs/corpus && ~/.venvs/corpus/bin/pip install shapely`, then run the build with that Python); the site itself stays dependency-free. In the back view the light is mirrored in the frame, so on screen both views are lit from the upper left. A structure added to a schematic skeleton file needs a builder too, or the build stops.

The other layers' realistic files (`muscles-anterior-realistic.svg` and so on) are generated too, by `tools/realistic/layers.py` in the same build. They keep the schematic ids, classes and draw order, and (except the front muscles, below) the schematic outlines and paths, and add the shading paths above (`.sh*`, `.hl`, plus `.fb` / `.gl` per layer), with the shading depth scaled to each shape's thickness and coloured from its own tissue colour in `css/app.css`. So **after editing any schematic layer file, run the build again**: the data check catches a missing or extra id, but not a shape that changed in one style only. The "Where does it hurt?" regions are tap areas rather than drawings, so both styles share one regions file per view.

In `muscles-anterior-realistic.svg` every muscle with a builder in `tools/realistic/muscles.py` (`FRONT`, right side only; the left is mirrored) is redrawn as anatomy: its own outline (`.b`), tendons and aponeuroses under the belly (`.c` before `.b`), tendinous intersections on top (`.c` after `.b`) and fibres along its real fibre direction (`.d`), then shaded like the rest. A muscle without a builder (the diaphragm) keeps its schematic outline. A new front muscle needs a shape in the schematic file (for the id, side and draw order) and, for anatomy, a builder.

The default drawings are schematic, not illustration. They were generated once from landmark coordinates (rounded shapes, left and right mirrored about x = 240) and are now ordinary SVG files to edit by hand.
