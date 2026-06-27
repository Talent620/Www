# Validation

How to verify the gallery works. Automated smoke tests cover the critical path;
the checklists below cover what a human should confirm.

## Automated

| Check | Command | Expected |
|---|---|---|
| Install | `npm install` | completes, 0 vulnerabilities |
| Production build | `npm run build` | `✓ built`, `dist/` emitted (one >500 kB chunk warning from Three is expected) |
| Smoke tests | `npm test` | 2 passed |

> In an image with a pre-installed Chromium, run
> `PW_CHROMIUM_PATH=/path/to/chrome npm test` so Playwright skips
> `playwright install`.

The smoke tests (`tests/smoke.spec.js`) assert:
1. The page boots with **no console errors** and a visible, non-empty canvas
   with a live WebGL context.
2. The debug overlay reports `scroll` / `cam.z`, and **the camera Z decreases by
   a meaningful amount after scrolling to the bottom** (proves the scroll effect
   works — the core course correction).

## Manual browser checklist

- [ ] `npm run dev`, open the URL — scene appears immediately, **no blank
      screen**.
- [ ] Browser console shows **no errors** (harmless `GPU stall`/deprecation
      *warnings* in software-rendered envs are acceptable).
- [ ] Scrolling down moves the camera forward through the corridor; scrolling up
      reverses it.
- [ ] Panels fade in from the fog and pass on the left/right alternately.
- [ ] Debug overlay (top-right) updates scroll %, cam.z, cam.x/y, fps, calls,
      tris.
- [ ] At the top, scroll ≈ 0%; at the bottom, scroll ≈ 100%.
- [ ] Page scrolls naturally — the canvas never "traps" the gesture.

## Build checklist

- [ ] `npm run build` succeeds.
- [ ] `npm run preview` serves `dist/` and behaves identically to dev.
- [ ] No errors in the preview console.
- [ ] `base: './'` means assets load even from a sub-path.

## Mobile checklist

- [ ] Loads on a phone (or DevTools device emulation) without breaking.
- [ ] Canvas covers the full viewport; no horizontal scrollbar.
- [ ] Touch scroll moves the camera.
- [ ] Device pixel ratio is capped (no meltdown on high-DPI screens).
- [ ] Intro text remains readable and doesn't block scrolling
      (`pointer-events: none`).

## Performance checklist

- [ ] FPS in the overlay is reasonable (≈60 on desktop; software renderers will
      be lower — expected).
- [ ] Draw calls stay low (tens, not thousands) — confirm in the overlay.
- [ ] Only one shadow-casting light; accent lights cast none.
- [ ] DPR capped at 2 in `createRenderer.js`.
- [ ] `dt` is clamped and Timer is `connect`-ed so a backgrounded tab doesn't
      cause a jump on return.
