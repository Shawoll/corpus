# Layer drawings

One SVG per layer and view (`<layer>-anterior.svg`), all in the same `viewBox="0 0 480 1200"` and aligned to the skeleton. Shapes are joined to data **only** by `data-id` (plus `data-side="right|left"` for paired structures), so a renamed id must change in both the SVG and the JSON. The figure faces the viewer: the body's right side has x < 240.

`js/map.js` imports only the root's child elements and **drops `<title>`, `<style>` and `<script>`**. Inline styles and fill colours are therefore lost or fight the theme. Style everything in `css/app.css` using tokens from `css/base.css`.

## Class vocabulary

| Markup | Meaning |
| --- | --- |
| `<g class="structures">` | wrapper for interactive shapes |
| `<g class="s" data-id … data-side …>` | one structure instance. Add `m` for muscles and `o` for organs |
| `.b` path | body shape: filled, used for highlights, outlines and the bounding box. map.js clones it into the tap target (`.hit`), so don't add `.hit` by hand |
| `.c` path | cartilage or tendon |
| `.d` path | detail lines (fibres, sutures). Hidden for muscles when that layer is in the background or in hurt mode |
| `s deep` | a structure lying under others. Darker fill, still tappable |
| `s back` | a structure behind the body (e.g. the back half of the ribs). Muted fill, and its `.hit` is disabled, so it can't be tapped |
| `s jt` | joint tissue drawn as a shape (e.g. intervertebral discs). Its `data-id` is a joint id |
| `<g class="joints"><circle class="jm" data-id=<joint id> …>` | joint markers, coloured by the joint's `class` and hidden by the Joints toggle |
| `class="deco …"` | non-interactive decoration (no `data-id`) |
| `regions-anterior.svg`: `<g class="regions"><g class="rg" data-id=<region id>>` | "Where does it hurt?" areas. Ids match `data/regions.json` |

The drawings are schematic, not illustration. They were generated once from landmark coordinates (rounded shapes, left and right mirrored about x = 240) and are now ordinary SVG files to edit by hand.
