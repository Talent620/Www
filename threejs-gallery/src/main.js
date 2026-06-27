import * as THREE from 'three';
import { createRenderer } from './scene/createRenderer.js';
import { createScene } from './scene/createScene.js';
import { createCamera } from './scene/createCamera.js';
import { createLights } from './scene/createLights.js';
import { createGallery } from './scene/createGallery.js';
import { ScrollCamera } from './controls/scrollCamera.js';
import { DebugOverlay } from './ui/debugOverlay.js';

/**
 * Entry point. Wires the scene graph together, starts the render loop, and
 * handles resize. Kept deliberately small — each concern lives in its own
 * module so this file just orchestrates.
 */
function init() {
  const canvas = document.getElementById('scene');

  const renderer = createRenderer(canvas);
  const scene = createScene();
  const camera = createCamera();

  createLights(scene);
  const gallery = createGallery(scene);

  const scrollCamera = new ScrollCamera(camera, gallery);
  const debug = new DebugOverlay(document.getElementById('debug'), renderer);

  // --- Resize ------------------------------------------------------------
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Scroll range may change with viewport height; re-read it.
    scrollCamera._onScroll();
  }
  window.addEventListener('resize', onResize);

  // --- Render loop -------------------------------------------------------
  // Timer replaces the deprecated Clock and, via connect(document), automatically
  // resets delta when the tab regains visibility — no manual jump-guard needed.
  const timer = new THREE.Timer();
  timer.connect(document);

  function tick() {
    timer.update();
    // Clamp dt as a final safety net (very first frame / extreme stalls).
    const dt = Math.min(timer.getDelta(), 0.1);

    scrollCamera.update(dt);
    debug.update(dt, { camera, progress: scrollCamera.progress });

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  // Render one frame immediately so there is no blank screen before the first
  // rAF callback, then start the loop.
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

init();
