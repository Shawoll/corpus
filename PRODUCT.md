# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Corpus is for two groups. The general public comes first.

- **The curious public (primary).** Adults with no anatomy background who want to understand their own body. Often something prompts the visit: an ache, a sore spot, or a diagnosis or body part someone mentioned. Many open it on a phone, sometimes at the moment something hurts. They need plain language, a sense of where things are, and an honest answer to "should I see someone about this?"
- **Students (secondary).** Anatomy, physiotherapy, nursing and medical students revising structures, origins and insertions, nerve supply, blood supply and drainage. They need correct terminology (Latin names per Terminologia Anatomica) and the connections between structures. These sit one layer below the plain-language reading. They are not left out.

## Product Purpose

Corpus is an interactive map of the human body, seen from the front and the back, with bones, joints, muscles, organs, blood vessels, nerves and body areas. Tap any structure to see what it is, what it connects to and what commonly goes wrong with it. In the "Where does it hurt?" mode, tap a body area to see what lies there, the usual causes of pain, how urgent each one is and the red flags that need emergency care.

Success means someone with no training can work out what is in the part of the body they're curious or worried about, how it connects to the rest, and whether to look after it at home, see a doctor or get urgent help. They should never come away thinking the app gave them a diagnosis.

## Positioning

Corpus makes four claims, and the user stands behind all of them:

1. **The body as one connected graph.** Every structure links to the others: bones through joints, muscles to the bones they start and end on, nerves to what they supply, arteries to what they feed, and veins to where they drain. You learn by following those links. You don't read isolated entries.
2. **From pain to anatomy.** "Where does it hurt?" goes from a sore spot to the structures under it, then to likely causes and how urgent they are.
3. **Free and open.** No account, no ads, no tracking and no external requests. It's a static site anyone can fork.
4. **Fast and light.** It loads instantly on a phone, works fully from the keyboard and runs on any modest device.

## Operating Context

- People mostly use it on phones, often in the moment, so one-handed tapping on a small screen is the main way in. Desktop and keyboard use are fully supported too.
- People reach it through search, by browsing the list of everything, by tapping the map, or by following a shared hash link (`#/s/femur/left`, `#/r/knee`).
- It's a personal side project kept up by one person. Each feature has to be worth the upkeep it adds.

## Capabilities and Constraints

- Layers: skeleton (all 206 bones, 33 joints), ligaments and tendons, muscles, organs (including the endocrine glands, the senses and skin, and the reproductive organs), vessels, lymphatics, nerves (including all 12 cranial nerves), and the "Where does it hurt?" body areas. There are two views, Front and Back, and every layer is drawn in both. A third view, **3D**, shows a model you can turn with a drag (every layer, from Z-Anatomy, CC BY-SA 4.0; every structure has a mesh except the skin, which is the body surface; 21 of them are simple stand-ins for what the source lacks: ducts, two nerves, five tendons, the breasts, the scrotum and the female organs and ovarian vessels, and a note says so when one is selected). The model is a male body: the male organs show only with Male chosen and the female ones (stand-ins placed in the same pelvis) only with Female, as in 2D. The breasts and scrotum are drawn see-through so the organs behind and inside them stay visible. "Where does it hurt?" works in 3D too, on a skin with the same body areas as the drawings (left without genitals, so it is the same for every sex setting), and the joints show as markers.
- Two drawing styles: Schematic (the default) and Realistic (real bone form, joints drawn as anatomy, shaded soft tissue with fibres). Joints can be shown as Dots, as Anatomy (Realistic only) or not at all.
- Biological sex: Not set (the default), Female or Male. Sex-specific structures and body areas exist only for their sex, so none are drawn when it is Not set. Sex-specific health text is hidden only for the other sex, and with Not set it is shown with a "female" / "male" tag, so an urgent cause is never hidden.
- Controls: the map has zoom, move up / down (Shift + ↑ / ↓) and reset view (0) buttons, and the layer buttons, which collapse to icons (on phones they open as a menu). In 3D a drag turns the body freely, over the head and under the feet. Display (2D / 3D), View (Front / Back), Drawings, Biological sex, Joints, Mirror and Theme live in the settings cog, with the keyboard shortcuts M (display), B (view: in 3D it turns the model around), D (drawings) and S (sex).
- Stack: plain HTML, CSS, ES modules, JSON and SVG. No build step, package manager, dependencies, CDN scripts or external requests. The one exception is three.js, copied into the repository for the 3D view and loaded only when it is opened. It deploys as-is to GitHub Pages from the repository root. Paths stay relative and routing uses the URL hash.
- Orientation convention: the front figure faces the viewer, so the body's right is on the viewer's left. "Mirror" and the back view flip only what is rendered.
- Drawings and data are joined only by ids. The realistic drawings are generated from the schematic ones (`tools/realistic/build.py`) and keep the same ids. Bones, joints and the muscles (front and back) are drawn as real anatomy. The organs, vessels, nerves, lymphatics and ligaments take their realistic outlines from the 3D model, projected into the drawing frame (organs also show the edges between their parts, such as lung lobes), so 2D and 3D agree; the stand-ins for the female organs, breasts and scrotum, and the ovarian vessels, keep their hand-drawn outlines, since the drawings show more than a stand-in. These derived outlines are CC BY-SA 4.0, like the model.
- Load weight: a first visit downloads the data and the schematic drawings only (about 0.43 MB compressed). The realistic drawings (about 0.64 MB compressed) are fetched the first time someone switches to them, the current view first. The 3D view costs nothing until it is opened; then three.js (about 0.17 MB compressed) and one model per visible layer load (compressed: about 1.3 MB each for the skeleton and the muscles, 0.6 MB for the organs, 0.4 MB for the vessels, 0.3 MB for the nerves, 0.1 MB for the lymphatics and 0.07 MB for the ligaments).
- Offline: a service worker keeps a copy of everything a visit has loaded, so Corpus works without a connection afterwards and can be installed to the home screen. "Save for offline" in the settings fetches the rest (the realistic drawings and the 3D view, about 6 MB). It always fetches from the network first, so updates show on the next visit.
- Health content is general and conservative. Urgency is one of `self-care`, `doctor` or `urgent`. Every health page shows the disclaimer and emergency numbers from `data/regions.json`.
- Language: British English spelling ("fibres", "colour"), Latin names per Terminologia Anatomica. Whether to translate is undecided.
- Preferences (theme, view, drawing style, biological sex, joints and joint style, mirror) stay in the browser under `corpus:`-prefixed keys. Nothing leaves the device.

## Brand Commitments

- Name: **Corpus**, with the strapline "a connected map of the body".
- Voice: plain, calm and conservative. Corpus explains and gives directions to help. It never diagnoses or alarms. "Corpus is educational. It is not a diagnosis and not medical advice."

## Evidence on Hand

- The structured anatomy data in `data/*.json`, with typed links between structures.
- The SVG drawings in `assets/svg/`: front and back views for every layer, in the schematic and realistic styles.
- 44 body areas (35 drawn on the front, 19 on the back, some on both), each with causes, urgency and red flags.
- There are no testimonials, user numbers, clinical review or endorsements. Future work must not invent them or suggest medical sign-off.

## Product Principles

1. **Plain first, precise underneath.** Lead with everyday language a layperson understands, and keep the Latin names and fine anatomy one step away for students.
2. **Connections are the content.** Any structure should lead to its neighbours, supply and drainage. A dead end is a missed lesson.
3. **Safe before helpful.** Health guidance stays general, shows how urgent it is and points to help. When in doubt, send people to a doctor and never toward a diagnosis.
4. **Weightless by design.** No dependencies, no tracking, instant on a phone. Anything that costs load time, privacy or upkeep must earn its place.
5. **Small enough for one person to keep up.** Features have to fit what a solo maintainer can look after.

## Accessibility & Inclusion

- WCAG 2.2 AA is a requirement.
- Everything on the map must also be reachable without the map: search and Browse give keyboard and screen-reader access to every structure.
- Touch targets and the layout are designed for phones first. People may be in pain or anxious when they use it, so stay clear and calm and don't make them work hard to find things.
