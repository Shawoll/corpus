# 3D model licence

The `.glb` files in this folder are adapted from the **Z-Anatomy** 3D models by Lluís Vinent Juanico, Gauthier Kervyn and contributors (<https://github.com/LluisV/Z-Anatomy>), licensed under the [Creative Commons Attribution-ShareAlike 4.0 International licence](https://creativecommons.org/licenses/by-sa/4.0/) (CC BY-SA 4.0).

Z-Anatomy is built on **BodyParts3D**, © The Database Center for Life Science, licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/): "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International" (<https://dbarchive.biosciencedbc.jp/en/bodyparts3d/>).

## Changes made

`tools/model3d/build.py` selects and merges the source parts for each Corpus structure (as listed in `tools/model3d/map.json`), splits right from left, simplifies the meshes, quantises them and compresses them with meshoptimizer. No anatomy was redrawn. `tools/model3d/outlines.py` projects the meshes of five layers into the 2D drawings' frame to give the realistic drawings their outlines. `tools/model3d/generated.py` adds simple tubes, sacs and folds for the structures the source lacks (ducts, two nerves, five tendons, the breasts, the scrotum and the female reproductive organs and ovarian vessels); those are Corpus's own.

## Licence of these files

These adapted models are shared under the same licence, **CC BY-SA 4.0**. You may copy, change and share them, including commercially, as long as you credit Z-Anatomy and BodyParts3D as above, say what you changed, and share your version under CC BY-SA 4.0.

It also covers the outlines derived from these models: `tools/realistic/outlines3d.json` and the shapes drawn from it in the realistic organ, vessel, nerve, lymphatic and ligament drawings (`assets/svg/{organs,vessels,nerves,lymphatics,ligaments}-*-realistic.svg`). The rest of Corpus (code, data and the other drawings) is not part of the adapted material.
