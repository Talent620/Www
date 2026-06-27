# Architecture

## Overview

The app is a single static page. `index.html` provides a full-viewport `<canvas>`,
a small foreground HTML overlay, and a tall "scroll spacer" that gives the
document real height. `src/main.js` boots Three.js, builds the scene from small
single-purpose modules, and runs a render loop. Page scroll is the only input —
it drives the camera down a corridor of gallery panels.

```
index.html
  └─ src/main.js  (orchestrator)
       ├─ scene/createRenderer.js   → WebGLRenderer
       ├─ scene/createScene.js      → Scene + fog
       ├─ scene/createCamera.js     → PerspectiveCamera
       ├─ scene/createLights.js     → lighting rig (+ 1 shadow caster)
       ├─ scene/createGallery.js    → floor, walls, panels (+ layout metadata)
       ├─ controls/scrollCamera.js  → scroll → camera position
       └─ ui/debugOverlay.js        → throttled HUD
```

## Scene architecture

- **Renderer** (`createRenderer.js`): `WebGLRenderer` with antialiasing, device
  pixel ratio capped at 2 (prevents high-DPI mobile from rendering 3–4× the
  pixels), `PCFShadowMap` soft-ish shadows, sRGB output color space and ACES
  filmic tone mapping for a modern look.
- **Scene** (`createScene.js`): dark background plus linear `Fog`. The fog hides
  the far end of the corridor, so panels fade in as the camera approaches and we
  avoid an obvious "end of the world".
- **Camera** (`createCamera.js`): 60° `PerspectiveCamera` at eye height
  (`y = 1.6`) facing down −Z. Its Z (and a little X/Y) is overwritten every frame
  by the scroll controller.
- **Lights** (`createLights.js`): a hemisphere + ambient base fill so nothing is
  pure black, **one** shadow-casting `DirectionalLight` (the key light — shadows
  are the expensive part, so we keep it to one), and a few cheap accent
  `PointLight`s spaced down the corridor for rhythm.
- **Gallery** (`createGallery.js`): a floor plane, two side walls, and 8 panels.
  Each panel is a `Group` containing a beveled frame `Box` and a textured plane.
  Textures are drawn at runtime onto a 2D `<canvas>` (`CanvasTexture`) from a
  hard-coded project list, so there are **no image assets** to load. The module
  returns the panels plus `startZ`/`endZ` layout metadata so the camera knows how
  far to travel.

## Module responsibilities

Each `create*` module is a pure factory: it takes only what it needs (e.g. the
scene to add to), returns the objects it created, and holds no global state. This
keeps `main.js` a thin orchestrator and makes each piece independently testable
and replaceable.

## Render loop

`main.js` uses Three's `Timer` (the modern replacement for the deprecated
`Clock`). `timer.connect(document)` makes it reset its delta when the tab regains
visibility, avoiding a large time jump after the tab was backgrounded. Each
frame:

1. `timer.update()` then read a clamped `dt` (seconds).
2. `scrollCamera.update(dt)` — smooth toward the scroll target and reposition the
   camera.
3. `debugOverlay.update(dt, …)` — update the HUD (throttled to ~6 Hz).
4. `renderer.render(scene, camera)`.
5. `requestAnimationFrame(tick)`.

One frame is rendered **before** the loop starts so there's never a blank screen.

## Scroll camera logic

`controls/scrollCamera.js` listens to `scroll` (passive) and computes raw
progress:

```
progress = clamp(window.scrollY / (scrollHeight - innerHeight), 0, 1)
```

This raw target is then **exponentially damped** toward each frame using a
frame-rate-independent factor `1 - 0.0015^dt`, so the camera feels weighty and
consistent regardless of FPS. The smoothed progress maps:

- **Z**: `lerp(startZ, endZ, p)` — the primary glide down the corridor.
- **X / Y sway**: small, slow sine offsets (`±0.6` X, `±0.12` Y) for a steadicam
  drift. Amplitudes are deliberately tiny to stay cinematic, not nauseating.
- **lookAt**: a point ~6 units ahead down the corridor, biased slightly by the
  sway so panels swing gently into view.

Because the camera is recomputed from absolute scroll progress every frame (not
accumulated), it's robust to scroll jumps, refreshes mid-page, and resize.

## Why not WebGPU / R3F / React?

- **No React / Next.js / R3F**: the brief is a focused 3D spike, not an
  application. A component framework would add a build/runtime layer, a reconciler,
  and conceptual overhead for what is essentially one canvas and a render loop.
  Vanilla JS keeps the whole thing readable in a handful of small files.
- **No WebGPU**: as of this build, the WebGL path has the broadest, most stable
  browser support (especially on mobile Safari). WebGPU would add capability we
  don't need for flat textured panels and one shadow light, at the cost of
  reliability. See `docs/DECISIONS.md`.
- **No GSAP / scroll libraries**: the scroll→camera mapping is a few lines of
  `lerp` + damping. A dependency would be more code than the feature.
