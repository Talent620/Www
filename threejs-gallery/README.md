# Interactive 3D Gallery (Three.js + Vite)

A scroll-driven 3D gallery / showroom that runs in the browser. As you scroll the
page, a camera glides down a corridor past a series of framed project panels.
Built with **Vite + Vanilla JavaScript + Three.js** — no React, Next.js, R3F,
WebGPU, GSAP, or other heavyweight dependencies.

> This project was built from a Polish markdown course as reference material.
> Several mistakes in the course were detected and corrected before
> implementation — most importantly the `overflow: hidden` bug that would have
> broken the scroll effect entirely. See [`docs/DECISIONS.md`](docs/DECISIONS.md).

## What it does

- A real Three.js scene: `Scene`, `PerspectiveCamera`, `WebGLRenderer`, a
  `requestAnimationFrame` loop, and resize handling.
- A corridor with a floor, two side walls, and **8 gallery panels** placed along
  the Z axis, alternating left/right.
- **Scroll-driven camera**: `window.scrollY` → progress (0→1) → camera position
  down the corridor, with a gentle cinematic sway.
- Basic lighting with **soft shadows** from a single key light (kept cheap).
- A **debug overlay** showing scroll %, camera position, FPS, and draw calls.
- Placeholder panels drawn with **generated canvas textures** — zero image
  assets required, so the build is self-contained.

## Tech stack

| Concern | Choice |
|---|---|
| Bundler / dev server | Vite 6 |
| Language | Vanilla JavaScript (ES modules) |
| 3D | Three.js 0.185 |
| Tests (optional) | Playwright smoke tests |

## Getting started

Requires Node 18+ (built and tested on Node 22).

```bash
# 1. Install
npm install

# 2. Run the dev server (http://localhost:5173)
npm run dev

# 3. Production build (outputs to dist/)
npm run build

# 4. Preview the production build locally
npm run preview
```

Then open the printed URL and **scroll** to move through the gallery.

## Validation

```bash
# Production build must succeed
npm run build

# Optional: Playwright smoke tests (boots dev server, checks no console
# errors, WebGL alive, and that the camera moves on scroll)
npm test
```

In a sandbox/CI image that ships its own Chromium (so `playwright install` is
not needed), point Playwright at it:

```bash
PW_CHROMIUM_PATH=/path/to/chrome npm test
```

Full manual / build / mobile / performance checklists are in
[`docs/VALIDATION.md`](docs/VALIDATION.md).

## Project structure

```
index.html                 # canvas + foreground HTML + scroll spacer
vite.config.js
playwright.config.js        # smoke-test runner config
src/
  main.js                   # orchestrator: wires modules, render loop, resize
  styles/main.css           # fixed canvas + tall scrollable body (the fix)
  scene/
    createRenderer.js       # WebGLRenderer (capped DPR, shadows, color mgmt)
    createScene.js          # Scene + fog
    createCamera.js         # PerspectiveCamera
    createLights.js         # hemisphere + ambient + shadow key + accents
    createGallery.js        # floor, walls, panels (canvas-texture placeholders)
  controls/
    scrollCamera.js         # scroll → progress → camera, with damping & sway
  ui/
    debugOverlay.js         # throttled debug HUD
tests/
  smoke.spec.js             # Playwright smoke tests
docs/
  ARCHITECTURE.md
  VALIDATION.md
  DECISIONS.md
```

## Known limitations

- Panels are **placeholders** generated from a hard-coded list in
  `createGallery.js` (canvas textures). No real images, links, or routing.
- The whole Three.js library ships in one ~517 kB JS chunk (~131 kB gzipped).
  That's Three itself; the app code is tiny. See "Next improvements".
- No post-processing, no GLTF model loading, no orbit/free-fly controls — camera
  motion is intentionally scroll-only.
- On very low-end mobile GPUs the shadow map may cost a few frames; shadows can
  be disabled in `createRenderer.js` if needed.
- Software-rendered headless environments emit harmless `GPU stall due to
  ReadPixels` performance warnings (not errors).

## Next improvements

1. Code-split: lazy-load Three or use `manualChunks` to separate vendor.
2. Replace placeholder textures with real images + clickable project links
   (raycasting on the panels).
3. Add a small "table of contents" that snaps scroll to each panel.
4. Optional `prefers-reduced-motion` mode that removes the camera sway.
5. Instanced geometry / texture atlas if the panel count grows large.
