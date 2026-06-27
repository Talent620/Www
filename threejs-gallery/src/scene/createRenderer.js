import * as THREE from 'three';

/**
 * Create and configure the WebGLRenderer.
 *
 * Course correction: tutorials often set `renderer.setPixelRatio(window.devicePixelRatio)`
 * unbounded, which tanks performance on high-DPI phones. We cap it at 2.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {THREE.WebGLRenderer}
 */
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Filtered shadows. (Three.js 0.185 deprecated PCFSoftShadowMap and folds it
  // into PCFShadowMap, so we use the current constant to avoid a console warn.)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // Modern color pipeline. `outputColorSpace` replaced the deprecated
  // `outputEncoding` in recent Three.js versions — using the old one silently
  // does nothing.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  return renderer;
}
