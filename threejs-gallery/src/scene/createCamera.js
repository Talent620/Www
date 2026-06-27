import * as THREE from 'three';

/**
 * Create the PerspectiveCamera positioned at the entrance of the corridor,
 * looking down the -Z axis (the direction the gallery extends into).
 *
 * @returns {THREE.PerspectiveCamera}
 */
export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    60, // fov
    window.innerWidth / window.innerHeight,
    0.1, // near
    100, // far
  );

  // Entrance position; the scroll controller overwrites Z each frame.
  camera.position.set(0, 1.6, 8);
  camera.lookAt(0, 1.4, 0);

  return camera;
}
