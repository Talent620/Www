import * as THREE from 'three';

/**
 * Create the Scene with a dark background and distance fog. The fog hides the
 * far end of the corridor so panels fade in as the camera approaches, which
 * also lets us keep the geometry simple without an obvious "end of world".
 *
 * @returns {THREE.Scene}
 */
export function createScene() {
  const scene = new THREE.Scene();

  const bg = new THREE.Color('#0b0d12');
  scene.background = bg;
  // Linear fog: fully clear up close, fully fogged by the far wall.
  scene.fog = new THREE.Fog(bg, 12, 60);

  return scene;
}
