# Decisions log

Engineering decisions for this build, including corrections made to the source
course (treated as reference material, not trusted source code).

## D1 — Stack: Vite + Vanilla JS + Three.js

**Decision:** Build with Vite (dev server + bundler), plain ES-module JavaScript,
and Three.js. No React, Next.js, R3F, GSAP, or other frameworks.

**Why:** The deliverable is a focused 3D spike — one canvas, a render loop, and a
scroll mapping. A component framework or a 3D-framework wrapper (R3F) would add a
reconciler, build complexity, and conceptual overhead disproportionate to the
problem. Vanilla keeps the whole app in a handful of small, readable modules and
makes the Three.js concepts explicit rather than hidden behind abstractions.

## D2 — Avoid WebGPU for the MVP

**Decision:** Use the WebGL renderer (`WebGLRenderer`), not `WebGPURenderer`.

**Why:** WebGL has the broadest and most stable cross-browser support, especially
on mobile Safari. The scene (flat textured panels, one shadow light, fog) needs
nothing WebGPU offers. Choosing WebGPU would trade reliability for capability we
don't use. WebGPU is a reasonable *future* upgrade if the scene grows into
compute-heavy effects.

## D3 — Fix the `overflow: hidden` scroll bug (critical course correction)

**Decision:** Do **not** apply `html, body { overflow: hidden; }`. Instead:
`body` has `min-height: 500vh`, the canvas is `position: fixed`, and only
`overflow-x` is hidden.

**Why:** The source course set `overflow: hidden` on `html, body`. That removes
all scrollable height, so `window.scrollY` is always `0` and the scroll-driven
camera never moves — it silently breaks the entire feature. The corrected CSS
gives the document real height (the camera traverses the gallery across ~4
viewport heights) while keeping the canvas pinned. A smoke test
(`tests/smoke.spec.js`) explicitly asserts the camera's Z changes on scroll so
this regression can't return unnoticed.

## D4 — Treat the app as a spike, not a product

**Decision:** Keep scope tight: placeholder panels from a hard-coded list,
generated canvas textures (no asset pipeline), no routing, no CMS, no clickable
links, no post-processing.

**Why:** The goal is a working, well-structured demonstration of the technique.
Building a full product (asset loading, content management, interactions) would
balloon the codebase and obscure the core ideas. The structure is deliberately
extensible — `createGallery.js` is the single place to swap placeholders for real
data — so productionizing later is straightforward.

## D5 — Other course corrections applied

These are fixes made while implementing, beyond the headline `overflow` bug:

- **Capped device pixel ratio.** Courses commonly call
  `setPixelRatio(window.devicePixelRatio)` unbounded, which renders 3–4× the
  pixels on high-DPI phones and tanks FPS. We cap at `min(dpr, 2)`.
- **Modern color management.** Used `outputColorSpace = SRGBColorSpace` (the old
  `outputEncoding` is deprecated and silently does nothing in current Three.js)
  plus ACES tone mapping, and tagged canvas textures `SRGBColorSpace`.
- **Shadow constant.** Three.js 0.185 deprecated `PCFSoftShadowMap` (it warns and
  falls back to `PCFShadowMap`); we use `PCFShadowMap` directly to keep the
  console clean.
- **`Timer` instead of `Clock`.** `THREE.Clock` is deprecated; we use
  `THREE.Timer` with `connect(document)` so the frame delta resets on tab
  re-visibility instead of producing a huge jump.
- **Frame-rate-independent camera smoothing.** Rather than a fixed
  `lerp(a, b, 0.1)` per frame (which moves faster at higher FPS), we damp with
  `1 - 0.0015^dt` so the feel is identical at 30, 60, or 144 Hz.
- **One shadow caster.** Only the key directional light casts shadows; accent
  point lights don't — shadows are the dominant cost.
- **No-blank-screen guarantee.** One frame is rendered before the rAF loop
  starts.
- **Favicon 404 removed.** An empty inline `data:` favicon avoids a stray 404
  console error (which the smoke test would otherwise flag).

## D6 — Live in a subdirectory of the existing repo

**Decision:** This gallery lives under `threejs-gallery/` rather than at the repo
root.

**Why:** The repository root already contains an unrelated Next.js application
("Aurea"). Overwriting the root `package.json`/config with a Vite project would
destroy that app. Keeping the gallery as a self-contained Vite project in its own
directory preserves both, while still matching the required internal structure
(`index.html`, `src/...`, `docs/...`, `tests/...`) relative to its own root.

## D7 — Playwright is optional and binary-flexible

**Decision:** Include Playwright smoke tests, but make the Chromium binary
overridable via `PW_CHROMIUM_PATH`, and run them single-worker/serial.

**Why:** Some CI/sandbox images ship a Chromium and forbid `playwright install`;
the env override lets the same tests run there. Serial execution avoids flaky
software-render/GPU contention between the two WebGL-backed test pages.
