# Corpus

**An interactive map of the human body, treated as one connected system.**

### [▶ Open Corpus → shawoll.github.io/corpus](https://shawoll.github.io/corpus/)

[![Corpus with the right femur selected: the bone is red, and the hip bone, tibia and patella it connects to are teal](assets/social.png)](https://shawoll.github.io/corpus/)

Tap any bone, joint, muscle, organ, nerve or blood vessel to see what it is, what it connects to and what commonly goes wrong. Switch to **Where does it hurt?**, tap a body area, and see what lies there, the usual causes of pain and when to get help.

> [!WARNING]
> **Corpus is not a diagnostic tool.** It is for learning about the body only. It does not give medical advice, cannot examine you or take your history, and must not be used to diagnose or treat anything. If you are in pain or worried about your health, see a doctor or pharmacist. **In an emergency, call your local emergency number.**

## What's inside

- **Skeleton**: all 206 bones and 33 joints
- **Muscles**: 72 muscles and muscle groups, with origin, insertion, nerve and blood supply
- **Organs**: from the brain and senses to the endocrine glands and the female and male reproductive organs
- **Vessels, nerves, lymphatics, ligaments and tendons**, each linked to what they supply, drain or hold together
- **Where does it hurt?**: 44 body areas with likely causes, how urgent they are and red flags

Every layer is drawn from the front and the back, in a schematic and a realistic style, and can be turned around in **3D**. Everything is linked: a bone lists the muscles that attach to it, a muscle lists its nerve and artery, and so on.

## Features

- Search, a browse list and full keyboard access to every structure
- Zoom, pan and **Mirror**, which flips the figure to match your own body
- A **3D view** of every layer, built on the [Z-Anatomy](https://github.com/LluisV/Z-Anatomy) models (CC BY-SA 4.0)
- Works **offline** and can be added to your home screen
- Light and dark themes, made for phones first
- No sign-up, no tracking, no external requests

## Run it locally

```sh
python3 -m http.server 8000   # then open http://localhost:8000
node tools/check.mjs          # the data check (Node 22+)
```

Plain HTML, CSS, JavaScript, JSON and SVG: no build step and no dependencies apart from a vendored copy of three.js for the 3D view. It deploys to GitHub Pages as-is.

## Documentation

Start with the [docs](docs/README.md): how the code fits together, the data, the drawings, the 3D model, offline use and how to contribute.

## Licences

The code, data and drawings are Corpus's own. The 3D models and the outlines drawn from them are adapted from Z-Anatomy and BodyParts3D under CC BY-SA 4.0 (see [assets/3d/LICENSE.md](assets/3d/LICENSE.md)). Source Serif 4 is under the SIL Open Font License ([assets/fonts/OFL.txt](assets/fonts/OFL.txt)), and three.js under the MIT licence ([js/vendor/three/LICENSE](js/vendor/three/LICENSE)).

## Support

If Corpus is useful to you, you can [buy me a coffee on Ko-fi](https://ko-fi.com/A6H428CUW3). ☕
