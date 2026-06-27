/**
 * Lightweight debug overlay. Renders scroll progress, camera Z, FPS and
 * renderer draw-call info into the fixed #debug element. Updates are throttled
 * to ~6 Hz so they're readable and don't thrash the DOM.
 */
export class DebugOverlay {
  /**
   * @param {HTMLElement} el
   * @param {THREE.WebGLRenderer} renderer
   */
  constructor(el, renderer) {
    this.el = el;
    this.renderer = renderer;
    this._acc = 0;
    this._frames = 0;
    this._fps = 0;
    this._sinceRender = 0;
    if (this.el) this.el.setAttribute('aria-hidden', 'false');
  }

  /**
   * @param {number} dt delta seconds
   * @param {{ camera: THREE.Camera, progress: number }} state
   */
  update(dt, { camera, progress }) {
    if (!this.el) return;

    // FPS: count frames over a rolling ~0.5s window.
    this._acc += dt;
    this._frames += 1;
    if (this._acc >= 0.5) {
      this._fps = Math.round(this._frames / this._acc);
      this._acc = 0;
      this._frames = 0;
    }

    // DOM writes throttled to ~6 Hz.
    this._sinceRender += dt;
    if (this._sinceRender < 0.16) return;
    this._sinceRender = 0;

    const info = this.renderer.info.render;
    this.el.textContent =
      `scroll   ${(progress * 100).toFixed(1)}%\n` +
      `cam.z    ${camera.position.z.toFixed(2)}\n` +
      `cam.x/y  ${camera.position.x.toFixed(2)} / ${camera.position.y.toFixed(2)}\n` +
      `fps      ${this._fps}\n` +
      `calls    ${info.calls}\n` +
      `tris     ${info.triangles}`;
  }
}
