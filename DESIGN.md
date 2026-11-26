---
name: Corpus
description: A connected map of the human body, drawn as a living anatomy atlas.
colors:
  vermilion: "#c8402a"
  vermilion-fill: "#f4b9a9"
  verdigris: "#1f7a80"
  verdigris-fill: "#bfe1df"
  focus-teal: "#1f6f75"
  paper: "#f3eee4"
  paper-raised: "#f8f4ec"
  paper-sunk: "#e9e2d4"
  ink: "#2a231c"
  ink-soft: "#5b5044"
  ink-faint: "#6f6456"
  hairline: "#d9cfbe"
  hairline-strong: "#c7bba7"
  bone: "#fbf7ee"
  bone-line: "#6b5a48"
  cartilage: "#dbe4e0"
  muscle: "#b65a4e"
  tendon: "#ece3d1"
  artery: "#b8363a"
  vein: "#3f63a8"
  nerve: "#e2bc3c"
  urgency-self-care: "#4e7a4b"
  urgency-doctor: "#9a6a12"
  urgency-urgent: "#b8361f"
  night: "#121417"
  night-raised: "#181b1f"
  night-ink: "#ece6da"
  vermilion-night: "#ff7a5c"
  verdigris-night: "#5cc8cc"
typography:
  brand:
    fontFamily: "Source Serif 4, Iowan Old Style, Palatino Linotype, Palatino, Book Antiqua, Georgia, ui-serif, serif"
    fontSize: "25px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.005em"
  headline:
    fontFamily: "Source Serif 4, Iowan Old Style, Palatino Linotype, Palatino, Book Antiqua, Georgia, ui-serif, serif"
    fontSize: "31px"
    fontWeight: 600
    lineHeight: 1.1
  lede:
    fontFamily: "Source Serif 4, Iowan Old Style, Palatino Linotype, Palatino, Book Antiqua, Georgia, ui-serif, serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.4
  latin:
    fontFamily: "Source Serif 4, Iowan Old Style, Palatino Linotype, Palatino, Book Antiqua, Georgia, ui-serif, serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  summary:
    fontFamily: "Source Serif 4, Iowan Old Style, Palatino Linotype, Palatino, Book Antiqua, Georgia, ui-serif, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.58
  control:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.3
  eyebrow:
    fontFamily: "Source Serif 4, Iowan Old Style, Palatino Linotype, Palatino, Book Antiqua, Georgia, ui-serif, serif"
    fontSize: "14.5px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.08em"
rounded:
  hint: "6px"
  tag: "9px"
  card: "12px"
  dropdown: "14px"
  sheet: "18px"
  pill: "999px"
spacing:
  xxs: "4px"
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "16px"
  panel-x: "26px"
  section: "26px"
components:
  button-icon:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 12px"
  button-icon-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  segmented-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "6px 13px"
  segmented-hurt-on:
    backgroundColor: "{colors.vermilion}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
  input-search:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 14px 0 38px"
  chip-layer:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    height: "34px"
    padding: "0 13px 0 10px"
  chip-link:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "5px 11px"
  card-cause:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 14px"
  badge-urgent:
    backgroundColor: "{colors.urgency-urgent}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "3px 8px"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "7px"
    padding: "5px 9px"
---

# Design System: Corpus

## Overview

**Creative North Star: "The Living Atlas"**

Corpus is a beautiful, faithful anatomy atlas that responds to touch. The body is the only thing on the page with real colour and weight. Bone, muscle, vessels and organs sit on warm paper, and everything around them (the top bar, layer chips, zoom controls, the detail panel) behaves like a quiet instrument: hairline borders, soft pills, small type. Studying it should be a pleasure. A student should want to stay for an hour, and a worried person should feel oriented, not alarmed.

The page reads as one calm spread. A serif voice (Source Serif 4, italic for the brand and Latin names) carries the atlas: titles, Latin names, the home lede. A system sans carries the interface. Only two colours mean something about state. **Vermilion** marks what you selected and **Verdigris** traces what it connects to. Every other colour belongs to the tissue being drawn. Light is warm paper and ink. Dark is a cool graphite night in which the tissues stay legible and the state colours brighten.

The drawings are moving from schematic to realistic. Today's drawings are schematic: rounded, mirrored shapes made from landmark coordinates. The direction is anatomically faithful illustration, with true bone form, fibre direction in muscle and tissue-true colour, and a **Schematic / Realistic** switch so either style can be shown. Realistic is the lead style once it exists. Schematic stays for clarity at small sizes and for anyone who prefers it. Both styles are plain SVG styled from CSS, so the site still runs from GitHub Pages with no build and no external requests.

The confirmed anti-reference is the **sterile medical app**: clinical blue and white, glossy 3D renders, the hospital-portal look. Realism here means the quality of an atlas plate, not the coldness of a clinic.

**Key Characteristics:**
- Warm paper and ink in light mode, cool graphite night in dark mode.
- The body carries the colour. The interface stays neutral apart from the two state colours.
- A serif voice for the atlas and a sans voice for the instruments.
- Pill-shaped, hairline-bordered controls that float over the map on translucent paper.
- Two drawing styles, Schematic and Realistic, sharing one frame, one set of ids and one state language.

## Colors

The palette is warm paper and ink with tissue pigments. Two state colours sit on top: a vermilion for the selection and a verdigris for its connections. The authoritative values are the custom properties in `css/base.css`. Every token has a light value, and dark values are defined twice: under `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and under `:root[data-theme="dark"]`.

### Primary
- **Vermilion** (`--sel`): the selection. The stroke of the selected shape, the outline overlay, the active "Where does it hurt?" toggle, the hurt-mode banner, search-match highlights and the red-flags heading. **Vermilion Wash** (`--sel-fill`) fills the selected shape, and `--sel-soft` (10% vermilion) tints the background behind a focused member or the red-flags box. At night it brightens to a coral (`--sel` #ff7a5c).

### Secondary
- **Verdigris** (`--rel`): the relation. The stroke of every structure linked to the selection, the dashed related-outline overlay, chip hover and focus, "Show layer" links and group links in Browse. **Verdigris Wash** (`--rel-fill`) fills related shapes, and `--rel-soft` tints note cards. **Focus Teal** (`--focus`) is a slightly deeper sibling used only for keyboard focus rings and the search field's focus border. At night verdigris becomes a bright sea-glass (#5cc8cc).

### Tertiary: tissue pigments (the drawing palette)
These belong to the drawing, never to the interface.
- **Bone** (`--bone`) with **Sepia Line** (`--bone-line`): bone surfaces. `--bone-back` and `--bone-deep` handle structures behind or under others, and `--bone-detail` draws sutures and ridges.
- **Cartilage** (`--cart`): a pale grey-green for cartilage, discs and joint surfaces.
- **Muscle** (`--muscle`, `--muscle-deep`), with fibre strokes in translucent pink (`--muscle-fibre`) and **Tendon** (`--tendon`) for tendon ends.
- **Artery Red** (`--artery`), **Vein Blue** (`--vein`) and **Nerve Ochre** (`--nerve`), each with a darker line token, drawn as thin bands.
- **Organ watercolours** (`--o-*`, one per organ, from `--o-brain` to `--o-bladder`): muted, desaturated tints, each set on the organ's group via a local `--organ` property.
- **Joint classes**: synovial uses verdigris (`--j-synovial`), cartilaginous uses ochre (`--j-cartilaginous`), fibrous uses umber (`--j-fibrous`).
- **Region tints** (`--rg-*`): vermilion at 5–28% opacity for the "Where does it hurt?" areas.

### Neutral
- **Paper** (`--paper`): the page and the top bar. A warm, unbleached cream.
- **Raised Paper** (`--paper-2`): the panel, Browse drawer, search field, pills and dropdowns. One step lighter than Paper.
- **Sunk Paper** (`--paper-3`): hover rows and movement tags. One step darker than Paper.
- **Ink** (`--ink`): body text, and the fill of "on" controls. A warm near-black brown.
- **Soft Ink** (`--ink-2`) and **Faint Ink** (`--ink-3`): secondary text, then metadata, eyebrows and placeholders.
- **Hairline** (`--line`) and **Strong Hairline** (`--line-2`): dividers, then control borders.
- **Night** (`--paper` #121417 in dark mode): a cool graphite, not a warm brown. It sits behind warm ink (#ece6da) so the tissue colours read clearly.

### Urgency
- **Self-care Moss** (`--u-self`), **See-a-doctor Amber** (`--u-doctor`) and **Urgent Vermilion** (`--u-urgent`). Self-care and doctor appear as outlined badges, and urgent is the only solid badge.

### Named Rules
**The Two Voices Rule.** Only vermilion and verdigris carry state: vermilion is what you chose, verdigris is what it connects to. No third accent, and never swap their meanings. If a new feature needs a state colour, it has to fit one of these two meanings.

**The Body Carries the Colour Rule.** Tissue pigments live only in the drawing. Controls, panels and text never borrow bone, muscle, artery or organ colours, except as legend swatches that explain the drawing.

**The Paired Theme Rule.** Every token change is made in three places: the light `:root`, the `prefers-color-scheme` dark block and the `[data-theme="dark"]` block.

## Typography

**Display and Reading Font:** Source Serif 4 (Adobe, SIL OFL 1.1), bundled in `assets/fonts/` (with Iowan Old Style, Palatino Linotype, Palatino, Book Antiqua, Georgia, then the system serif as fallbacks)
**Interface Font:** the system sans (`ui-sans-serif`, `system-ui`, `-apple-system`, Segoe UI, Roboto, …)
**Label/Mono Font:** the system monospace, used only for the `?debug` badge

**Character:** the panel reads like a page of an anatomy textbook. A text serif carries the atlas (names, Latin, the lede, section headings and every paragraph of reading text) and the device's own sans runs the interface. Source Serif 4 is the one bundled font: two variable WOFF2 files (roman and italic, weight 400–700, optical size 8–60), subset to Latin, Greek, punctuation and arrows, about 340 KB together and preloaded from `index.html`. It is served from the repo, never from a font CDN. To regenerate the subset, run `pyftsubset` and `fonttools varLib.instancer wght=400:700` on the upstream variable files.

### Hierarchy
- **Brand** (italic, 400, 25px, falling to 21px on phones): the "Corpus" wordmark only.
- **Headline** (600, 31px, falling to 26px on phones, line-height 1.1, balanced wrap): the structure or region name at the top of the panel.
- **Lede** (400, 21px, 1.4): the home page's opening sentence. Stat numbers (600, 22px) and the Browse heading (600, 20px) use the same serif.
- **Latin** (italic, 16.5px in the subline and 13px beside member names, in Soft Ink or Faint Ink): every Terminologia Anatomica name.
- **Body** (sans, 400, 15px, 1.5): the default text of the interface.
- **Reading text** (serif, old-style figures, hyphenated, pretty wrap): the **Summary** (17px, 1.58) about a structure, and the text of notes, issues, causes, flags, the how-to list, the member descriptions, side and section notes and the disclaimer (13.5–15.5px). Chips and buttons inside these blocks switch back to the sans.
- **Control** (sans, 13–13.5px): chips, segmented buttons, layer chips and crumbs.
- **Eyebrow** (serif, 600, 14.5–15px, all small caps, 0.08em tracking, Faint Ink): section headings in the panel and the kind label above the title, the way a textbook sets its running heads. Counts beside a heading stay in the small sans. Fact labels (10.5px) and the strapline (11px, 0.14em) keep the uppercase sans.

### Named Rules
**The Latin Is Italic Rule.** Latin names are always serif italic in a softer ink, so the plain name stays the main read and the Latin sits just below it.

**The Serif for Things, Sans for Controls Rule.** The serif names and describes anatomy: structures, regions, the lede, stat numbers, section headings and reading text. The sans runs the interface. Never set a button or chip in the serif, even when it sits inside a serif paragraph.

## Layout

On desktop the stage is a two-column grid: the map fills the flexible left column and the detail panel takes `clamp(340px, 36vw, 460px)` on the right, separated by a hairline. A 60px top bar holds Browse, the wordmark, a pill-shaped search field (up to 440px wide), the Explore / Where-does-it-hurt toggle and the settings cog. The Browse drawer slides over the map from the left (`min(340px, 88vw)`).

The map is a full-bleed SVG in the 480 × 1200 body frame, behind a soft radial paper vignette. Floating instruments sit on its edges: layer chips in one column down the top-left edge (never a wrapping row across the top), stacked zoom, view and mirror controls bottom-left, "R / body's right" and "L / body's left" labels at mid-height on each side, and a one-line hint at the bottom centre.

Spacing follows a small 4–6–8–10–14–16 scale. The panel has 24–26px of padding with 26px between sections, chips sit 6px apart, and cards have 12–14px of internal padding.

**At 1100px and below** the strapline is hidden. **At 760px and below** the layout is a single column. The top bar wraps, with search taking a full row underneath. The mode toggle switches to its short label ("Where it hurts") and button labels become icons. The panel becomes a bottom sheet with three positions: peek (92px), half and full. It has an 18px top radius and a drag handle. The map controls lift above the peek height, and the layer chips shrink to 30px.

## Elevation & Depth

Corpus is mostly flat and gets depth from layers of paper. Surfaces separate by tone (Paper → Raised Paper → Sunk Paper) and by hairlines, not by shadow. One shared shadow token (`--shadow`), a soft two-part ambient shadow, is kept for things that genuinely float over other content: the search dropdown, the Browse drawer, the mobile bottom sheet, the tooltip and the hurt-mode banner. Controls over the map use translucent Raised Paper (88–90%) with a 6px backdrop blur instead of a shadow.

In the drawing, depth is anatomical. Structures behind others (`.back`) are paler with thinner strokes, deep structures (`.deep`) are darker or half-transparent, and a selected structure hidden behind others gets a dashed vermilion outline drawn on top.

### Shadow Vocabulary
- **Float** (`--shadow`: `0 1px 2px rgba(40,30,20,0.06), 0 8px 24px rgba(40,30,20,0.08)`; at night `0 1px 2px rgba(0,0,0,0.3), 0 10px 30px rgba(0,0,0,0.35)`): the only shadow, used for floating layers.

### Named Rules
**The Paper Stack Rule.** Surfaces separate by tone and hairline. A shadow means "this is floating over the map or the page", and nothing that sits in the layout gets one.

## Shapes

The form language is soft and round, like instruments laid on paper. Anything you tap and toggle is a full pill (999px): search, segmented controls, icon buttons, layer chips, link chips, urgency badges and the hint. Containers are gently rounded: cause cards, red-flag boxes, note cards and stat tiles at 12px, fact tags and hover rows at 9px, the search dropdown at 14px, the zoom group at 12px, the mobile sheet at 18px on top only. Small tags (movements, kbd) use 5–6px. The unused `--radius: 10px` token in `css/base.css` is not part of this scale.

Borders are always 1px hairlines. A dashed border means "more is hidden here": a collapsed range chip, an unavailable layer chip, a hurt region at rest and a selected structure behind other structures.

In the drawing, every stroke is `vector-effect: non-scaling-stroke` with round joins, so line weight stays constant at any zoom.

## Components

### Buttons
Quiet instruments: hairline, neutral and small until they're pressed.
- **Shape:** full pill (999px), 40px tall (36px on phones).
- **Icon button:** Raised Paper, Soft Ink text and icon, Strong Hairline border, with a 16px inline-SVG icon and an optional label.
- **Hover:** text darkens to Ink and the border to Faint Ink. No fill change.
- **Pressed / expanded:** the colours invert to an Ink fill with Paper text.
- **Focus:** a 2px Focus Teal outline with a 2px offset, shared by every focusable element.

### Segmented control
- **Style:** a pill track (Raised Paper, Strong Hairline border, 3px padding) holding pill buttons in Soft Ink.
- **On:** Ink fill and Paper text. The "Where does it hurt?" segment turns **Vermilion** with white text when on. It's the only control that changes colour, because it changes what the map means.

### Chips
- **Layer chip:** a 34px translucent pill with a small 12px rounded swatch. States: *active* (Ink border, filled swatch), *context* (shown for orientation, swatch at 35%), *off* (Faint Ink) and *unavailable in this view* (dashed border, 45% opacity, not-allowed cursor).
- **Link chip:** a Paper pill with a Strong Hairline border, used for every connected structure in the panel. Hover and focus tint it Verdigris (border and soft fill), which also lights up the matching shape on the map. Side labels sit inside in small Faint Ink. Range chips ("Ribs 3–10") have a dashed border and open in place.

### Cards / Containers
- **Corner style:** gently rounded (12px).
- **Background:** Paper on Raised Paper, so a card reads as a sheet laid on the panel.
- **Shadow strategy:** none (see Elevation).
- **Border:** a 1px Hairline. Red-flag and note boxes swap it for 35% vermilion or verdigris over a soft tint.
- **Internal padding:** 12px 14px.

### Inputs / Fields
- **Search:** a 40px pill in Raised Paper with a Strong Hairline border, a leading 16px magnifier in Faint Ink and a Faint Ink placeholder.
- **Focus:** the border turns Focus Teal with a 3px Focus Teal halo at 18%.
- **Results:** a floating Raised Paper list (14px radius, Float shadow) with 9px-radius rows. The selected row is Sunk Paper, and the matched letters are in Vermilion.

### Navigation
- **Top bar:** Browse, then the wordmark (italic serif, with the uppercase tracked strapline), then search, the mode toggle and the settings cog. Plain Paper with a hairline bottom edge.
- **Settings (cog):** a Raised Paper sheet under the top bar with the Float shadow. Each setting (Theme: Auto / Light / Dark, View, Drawings, Biological sex, Joints: Dots / Anatomy / Off, Mirror) is a labelled segmented switch built from `settingRows` in `js/main.js`; a new setting is one more row there. Options that do not apply in the current view are disabled, not hidden. It closes on Escape or a tap outside.
- **Browse drawer:** a Raised Paper sheet with a serif heading, disclosure groups with a rotating "›" marker, counts aligned right, and rows that turn Sunk Paper on hover.
- **Panel:** a crumb, eyebrow, serif headline, italic Latin subline, then fact tags, the summary and eyebrow-headed sections. It ends with a hairline-topped disclaimer in Faint Ink, which appears on every health page.
- **Mobile:** the panel becomes a bottom sheet with peek, half and full positions, a 42 × 5px handle and the Float shadow.

### Urgency badge and cause card (signature)
Each cause is a Paper card with a 650-weight title, a 14px Soft Ink description and an urgency badge on the right. The badge is an 11px uppercase pill: outlined in Moss for self-care, outlined in Amber for doctor, and solid Urgent Vermilion with white text for urgent. Red flags sit in a vermilion-tinted box below the causes, with the emergency numbers in 600 weight.

### Map states (signature)
The state language that makes the atlas respond, shared by every layer and both drawing styles:
- **Rest:** tissue pigment with its own line colour.
- **Hover:** the fill lightens (pale cream on bone; for other tissues, its own colour mixed with white).
- **Selected** (`is-sel`): a Vermilion Wash fill with a 1.6–1.8px Vermilion stroke, plus a 2px vermilion outline overlay (dashed when the structure is hidden behind others).
- **Related** (`is-rel`): a Verdigris Wash fill with a Verdigris stroke, plus a dashed verdigris outline. Related joint markers pulse gently.
- **Everything else, while something is selected:** fades to 50%, and joint markers to 35%.
- **Context layer:** shown at about 32% opacity (skeleton at 60%, with faint fills) and not tappable.
- **Hurt mode:** dashed vermilion region outlines over a dimmed body. A tap leaves a vermilion probe dot.

### Joint markers
Small round markers coloured by joint class (synovial in verdigris, cartilaginous in ochre, fibrous in umber) with a Paper ring. They grow to 1.35× on hover and 1.6× in Vermilion when selected, using the `--ease` curve `cubic-bezier(0.2, 0.7, 0.2, 1)`.

In the realistic skeleton every joint with a marker is also drawn as anatomy, the default: a dashed capsule in the joint-class colour (16% fill) over the joint line, and the joint space as cartilage (`--cart`). The big ball and hinge joints get one capsule around the bone ends; the small joints of the hand and foot, the clavicle and the jaw one per joint line; each finger joint its own small ring. Sutures are a serrated umber band along each seam, with an invisible wider tap target that tints on hover. Anatomical joints never scale: selection and relation recolour the capsule (Vermilion or Verdigris, solid stroke) and fill the joint space. The cog's **Joints** row switches between Dots, Anatomy and Off (`corpus:joints`, `corpus:jointStyle`); Anatomy is disabled with Simple drawings, which only have dots, and the Joints chip in the layer bar still shows or hides them.

### Drawing styles: Schematic and Realistic (realistic skeleton built, front and back)
- **Schematic** (the default for now): rounded shapes generated from landmark coordinates and mirrored left to right, flat tissue fills and sparse detail lines.
- **Realistic** (the planned lead style; the skeleton is done in both views, other layers still schematic): anatomically faithful outlines (skull with orbits, nasal aperture and teeth; vertebrae with their processes; ribs with costal cartilages; scapula with its spine; long bones with their heads, tubercles and condyles; carpals, tarsals and phalanges as separate bones), generated by `tools/realistic/`, on the same tissue fill, with form drawn as shading paths rather than filters: four stacked form-shadow bands (`--bone-shade` at 7–15% each) on the side away from a light at the upper left, a lit rim (`--bone-light`), contact shadows where one bone lies on another, and dark recesses (`--bone-pore`) for foramina and sockets. Outlines are thinner (0.75px) than in Schematic. Selected and related bones keep their shading, tinted toward vermilion or verdigris. Each layer sets `--shade`, `--lit` and `--pore`, so a realistic muscles layer can bring its own shading colours.
- **The switch:** a "Simple / Real" pair in the stacked map controls under Front / Back, and the `D` key. The choice is saved as `corpus:style`. The buttons are disabled in a view where no layer has a realistic drawing.

**The Same Bones Rule.** Both styles share the 480 × 1200 frame, the anatomical orientation, every `data-id` / `data-side`, the `.s` / `.b` / `.c` / `.d` / `.deco` structure and the whole map-state language. Switching style must never change what is selected, what is related or where it sits.

## Do's and Don'ts

### Do:
- **Do** keep vermilion for the selection and verdigris for its connections, everywhere: map, chips, outlines, legend.
- **Do** let the drawing carry the colour and the beauty. Keep the instruments around it to hairlines, pills and small type.
- **Do** style tissue from CSS tokens in `css/base.css` (no hard-coded fills in the SVG) and give every new token a light value plus both dark blocks.
- **Do** set structure names, the lede and reading text in Source Serif 4, and Latin names in italic serif in a softer ink.
- **Do** use the single Float shadow only for layers that float. Surfaces in the layout separate by paper tone and 1px hairlines.
- **Do** keep stroke weight constant with `non-scaling-stroke`, and keep 12px hit tolerance on touch screens.
- **Do** push the drawings toward atlas-quality realism while keeping the schematic style one switch away.

### Don't:
- **Don't** make it look like a sterile medical app: no clinical blue and white, no glossy 3D renders, no hospital-portal chrome.
- **Don't** add a third accent colour or reuse vermilion for decoration. It always means "selected" or "urgent".
- **Don't** set controls in the serif, or show Latin in upright roman.
- **Don't** put shadows on cards, chips or panels that sit in the layout.
- **Don't** load fonts or anything else from a CDN, add a second bundled font, or add raster image dependencies for the drawings. The site stays static, self-contained and fast on a phone.
- **Don't** let the realistic style change ids, the frame or the state colours (see the Same Bones Rule).
