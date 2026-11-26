# Drawings

Every layer has one SVG per view in `assets/svg/` (`<layer>-anterior.svg`, `<layer>-posterior.svg`) and a realistic version of each (`…-realistic.svg`). All share the same `viewBox="0 0 480 1200"` and are aligned to the skeleton. The full class vocabulary and rules are in [`assets/svg/CLAUDE.md`](../assets/svg/CLAUDE.md).

## The frame

The figure faces you, so **the body's right is on the viewer's left (x < 240)**, and *every* file uses this front frame, the back views included. The app shows the back by flipping the rendered view. Seen from behind, an outline is the mirror image of the front one, so in this frame bone and limb outlines are the same in both files. Copy them, then change the draw order, the `back` class (hidden structures), the `deep` class (what now lies in front, drawn faint) and the detail lines.

## Shapes

```svg
<g class="structures">
  <g class="s m" data-id="biceps" data-side="right">
    <path class="b" d="…"/>   <!-- the body: filled, highlighted, tapped -->
    <path class="c" d="…"/>   <!-- optional: tendon or cartilage -->
    <path class="d" d="…"/>   <!-- optional: detail lines (fibres, sutures) -->
  </g>
</g>
```

- `data-id` (and `data-side` for paired structures) is the only link to the data, so a renamed id must change in both places.
- Add `m` for muscles and `o` for organs; `a`, `v` and `n` mark arteries, veins and nerves.
- `class="deco"` is decoration with no data. `data-sex="female|male"` marks a shape that exists for one biological sex.
- Don't hard-code colours: `js/map.js` drops `<style>`, `<title>` and `<script>`, and everything is styled in `css/app.css` from the theme tokens.

## Realistic drawings

The realistic files are **generated**: don't edit them by hand. `tools/realistic/build.py` builds them from the schematic files (which supply the ids, sides, draw order and joint markers) plus its own anatomy:

- bones from `tools/realistic/skeleton.py` (one builder per bone), joints from `joints.py`
- muscles from `muscles.py` (front) and `muscles_back.py` (back)
- organs, vessels, nerves, lymphatics and ligaments from the 3D model's outlines (`outlines3d.json`, written by the 3D build), except the stand-ins for organs and one-sex structures, which keep their hand-drawn shapes
- shading, rims, fibres and sheen for everything

So **after editing any schematic file, run the build again**, then the data check:

```sh
python3 -m venv ~/.venvs/corpus && ~/.venvs/corpus/bin/pip install shapely   # once
~/.venvs/corpus/bin/python -I tools/realistic/build.py
node tools/check.mjs
```

The check compares each realistic file's ids with its schematic one. It catches a missing or extra id, but not a shape that changed in one style only.

## "Where does it hurt?" areas

`regions-anterior.svg` and `regions-posterior.svg` hold tap areas (`<g class="rg" data-id=<region id>>`), not drawings, so both styles share them. After changing one, also rebuild the 3D skin, which takes its areas from these files (see [3d-model.md](3d-model.md)).
