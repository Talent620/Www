import * as THREE from 'three';

/**
 * Scroll-driven camera controller.
 *
 * The camera's Z is mapped from page scroll progress (0 → 1). We add a gentle,
 * smoothed sway on X/Y plus a slight look-ahead so the motion feels cinematic
 * without being nauseating. Smoothing uses frame-rate-independent damping so the
 * feel is consistent across devices.
 */
export class ScrollCamera {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {{ startZ: number, endZ: number }} layout
   */
  constructor(camera, layout) {
    this.camera = camera;
    this.startZ = layout.startZ;
    this.endZ = layout.endZ;

    this.progress = 0; // smoothed 0..1
    this.targetProgress = 0; // raw from scroll
    this._tmpTarget = new THREE.Vector3();

    this._onScroll = this._onScroll.bind(this);
    window.addEventListener('scroll', this._onScroll, { passive: true });
    this._onScroll(); // initialise from current scroll position
  }

  /** Compute raw scroll progress (0..1) from the document. */
  _onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    // Guard against divide-by-zero before layout settles.
    this.targetProgress = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
  }

  /**
   * Advance the smoothing and reposition the camera.
   * @param {number} dt delta time in seconds
   */
  update(dt) {
    // Exponential damping toward the target — independent of frame rate.
    const smoothing = 1 - Math.pow(0.0015, dt);
    this.progress += (this.targetProgress - this.progress) * smoothing;

    const p = this.progress;

    // Primary motion: glide down the corridor along Z.
    const z = THREE.MathUtils.lerp(this.startZ, this.endZ, p);

    // Cinematic sway: small, slow sine offsets. Amplitudes kept tiny on X/Y so
    // it reads as a steadicam drift rather than a rollercoaster.
    const sway = Math.sin(p * Math.PI * 2) * 0.6;
    const bob = Math.sin(p * Math.PI * 4) * 0.12;

    this.camera.position.set(sway, 1.6 + bob, z);

    // Look slightly ahead down the corridor, biased toward the current sway so
    // panels swing gently into view.
    this._tmpTarget.set(sway * 0.4, 1.5, z - 6);
    this.camera.lookAt(this._tmpTarget);
  }

  dispose() {
    window.removeEventListener('scroll', this._onScroll);
  }
}
