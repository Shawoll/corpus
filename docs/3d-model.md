# The 3D model

The 3D view shows every layer as meshes in `assets/3d/` (one `.glb` per layer, plus `skin.glb` for "Where does it hurt?"). They are adapted from the [Z-Anatomy](https://github.com/LluisV/Z-Anatomy) models (CC BY-SA 4.0, built on BodyParts3D, CC BY 4.0). See [`assets/3d/LICENSE.md`](../assets/3d/LICENSE.md).

## In the app

`js/model3d.js` (with three.js) loads only when the 3D view is first opened, then one model per visible layer. Every mesh is named with its graph key (`femur:right`), so selection, highlights and the panel work as in 2D. A drag turns the body, and a tap picks what is under it (a miss tries rings of rays around the point, so thin nerves can still be tapped). `assets/3d/keys.json`, loaded at boot, lists what each model holds, so the app knows what 3D can show before loading it.

The source is one male body. The male organs show only with Male chosen, and the female organs (simple stand-ins placed in the same pelvis) only with Female. The breasts and scrotum are drawn see-through unless selected, so the organs behind and inside them stay visible.

## Rebuilding the models

The source files are large and not in the repository. To rebuild:

1. Download the FBX files from Z-Anatomy's `Resources/Models/FBX` into `tools/model3d/source/zanatomy/` (gitignored).
2. Set up the tools once: `python3 -m venv ~/.venvs/corpus && ~/.venvs/corpus/bin/pip install numpy meshoptimizer shapely`.
3. Index the source once: `~/.venvs/corpus/bin/python -I tools/model3d/index_source.py` writes `source/index.json`, a list of every part.
4. Build: `~/.venvs/corpus/bin/python -I tools/model3d/build.py [layer…]`. With no layer it builds every one, the skin included.
5. Rebuild the realistic drawings, whose outlines follow the model: `~/.venvs/corpus/bin/python -I tools/realistic/build.py`.
6. Run `node tools/check.mjs`.

`tools/model3d/coverage.py` shows which structures have a mesh and estimates the download size per layer.

## Mapping structures to the source

`tools/model3d/map.json` maps each Corpus id to source part names, per layer:

- `"Femur"` takes that part and its `.r` / `.l` copies. Paired ids are split by side automatically.
- `"@Name"` also takes every part below it in the source's hierarchy.
- `"Sigmoid colon | y < 0.905"` keeps only the triangles on one side of a plane (metres), for a source part that holds two structures (the source's sigmoid colon runs on into the rectum).
- An id the source lacks goes under `generated` if `tools/model3d/generated.py` has a recipe for a simple stand-in, else under `missing`, with the reason.

## Stand-ins

`generated.py` draws simple shapes for what the source lacks: tubes for ducts, nerves and tendons, and sacs and folds for the breasts, the scrotum and the female reproductive organs. Each recipe places its shape against source meshes (bones, the bladder, veins…). Stand-ins are marked in the model, and the app says "drawn as a simple shape" when one is selected. A recipe can return one mesh per sex for an id both have (the breast), and `SHELL` marks the ones drawn see-through.

## What else the build makes

- **Joint markers** in `skeleton.glb`, placed where the member bones of each joint meet.
- **The skin** (`skin.glb`) for "Where does it hurt?" in 3D: each vertex knows its place in the 2D frame and its body area, taken from `assets/svg/regions-*.svg`. After changing a region shape, rebuild it with `build.py skin`. The skin leaves out the genitals, so it is the same for every sex setting.
- **Outlines for the realistic drawings** (`tools/realistic/outlines3d.json`): the meshes projected into the 2D frame, so the 2D organs, vessels and nerves match the model.

Every structure's mesh is merged, simplified to the layer's triangle budget, quantised and compressed with meshoptimizer. The frame matches the drawings: Y up, in metres, facing +Z, with the body's right at x < 0.
