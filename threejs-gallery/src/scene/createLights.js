import * as THREE from 'three';

/**
 * Build the lighting rig and add it to the scene.
 *
 * - Hemisphere + ambient: soft base fill so nothing is pure black.
 * - One shadow-casting directional light: the key light for depth.
 * - A couple of cheap point lights down the corridor for warmth/rhythm.
 *
 * @param {THREE.Scene} scene
 */
export function createLights(scene) {
  // Sky/ground fill — cheap and gives a natural ambient gradient.
  const hemi = new THREE.HemisphereLight('#bcd0ff', '#10131a', 0.6);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight('#ffffff', 0.25);
  scene.add(ambient);

  // Key light — the only shadow caster (shadows are the expensive part).
  const key = new THREE.DirectionalLight('#ffffff', 1.1);
  key.position.set(6, 12, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 60;
  // Widen the orthographic shadow frustum to cover the whole corridor.
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 20;
  key.shadow.camera.bottom = -20;
  key.shadow.bias = -0.0005;
  scene.add(key);

  // Accent point lights spaced down the corridor (no shadows = cheap).
  const accentColors = ['#6ea8fe', '#b58cff'];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.PointLight(accentColors[i % accentColors.length], 12, 18, 2);
    p.position.set(0, 4, -i * 16 - 4);
    scene.add(p);
  }

  return { hemi, ambient, key };
}
