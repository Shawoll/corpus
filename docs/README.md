# Corpus documentation

| Guide | What it covers |
| --- | --- |
| [Contributing](CONTRIBUTING.md) | The ground rules, running and checking the site, and the usual workflow |
| [Architecture](architecture.md) | The project layout, the body graph, routing and state, and how the views are drawn |
| [Data](data.md) | The JSON shapes, links and side rules, biological sex, and adding a layer |
| [Drawings](drawings.md) | The SVG conventions, the front and back views, and the realistic drawing generator |
| [3D model](3d-model.md) | Where the models come from, how they are built, stand-ins and the skin |
| [Offline](offline.md) | The service worker, "Save for offline" and installing the app |
| [Languages](i18n.md) | Translations: the locale files, how they overlay the data, the check and the tools |

Elsewhere in the repository:

- [`PRODUCT.md`](../PRODUCT.md): who Corpus is for, what it promises and what it must never do
- [`DESIGN.md`](../DESIGN.md): the visual system, with its colours, type and components
- [`data/CLAUDE.md`](../data/CLAUDE.md) and [`assets/svg/CLAUDE.md`](../assets/svg/CLAUDE.md): the detailed rules for editing data and drawings (written for Claude Code, but they read fine as reference)
- [`CLAUDE.md`](../CLAUDE.md): a dense summary of all of the above for Claude Code
- [`assets/3d/LICENSE.md`](../assets/3d/LICENSE.md): the 3D model licence (CC BY-SA 4.0)

`PRODUCT.md` and `DESIGN.md` stay at the repository root, where design tools look for them.
