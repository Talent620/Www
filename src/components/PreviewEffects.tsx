'use client';

import { useEffect, useRef } from 'react';
import {
  AURORA_VERT,
  AURORA_FRAG,
  PARTICLE_VERT,
  PARTICLE_FRAG,
  spherePoints,
} from '@/lib/export/effects';

const SPHERE = new Float32Array(spherePoints(520));

/**
 * Activates the hi-level visual layer inside the live preview: WebGL aurora
 * hero, pointer-driven 3D card tilt, and scroll-reveal. Mirrors the static
 * export's `effectsJs()` so preview and exported site behave identically, and
 * shares the exact same shader source so the two never drift.
 */
export function PreviewEffects({ scope }: { scope: React.RefObject<HTMLElement> }) {
  useEffect(() => {
    const root = scope.current;
    if (!root) return;
    // Gate reveal animations on `.js` so content is fully visible if this
    // effect never runs (parity with the static export's behaviour).
    document.documentElement.classList.add('js');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cleanups: (() => void)[] = [];

    // scroll-reveal
    const revealEls = Array.from(root.querySelectorAll<HTMLElement>('.reveal'));
    if (reduce || !('IntersectionObserver' in window)) {
      revealEls.forEach((el) => el.classList.add('is-visible'));
    } else {
      const io = new IntersectionObserver(
        (entries) =>
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add('is-visible');
              io.unobserve(en.target);
            }
          }),
        { threshold: 0.14 },
      );
      revealEls.forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());
    }

    // 3D tilt
    if (!reduce) {
      root.querySelectorAll<HTMLElement>('.card').forEach((c) => {
        const move = (e: PointerEvent) => {
          const r = c.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          c.style.transform = `rotateX(${-py * 7}deg) rotateY(${px * 9}deg) translateY(-6px)`;
        };
        const leave = () => {
          c.style.transform = '';
        };
        c.addEventListener('pointermove', move);
        c.addEventListener('pointerleave', leave);
        cleanups.push(() => {
          c.removeEventListener('pointermove', move);
          c.removeEventListener('pointerleave', leave);
        });
      });
    }

    // WebGL aurora hero
    const canvas = root.querySelector<HTMLCanvasElement>('.hero-canvas');
    if (canvas) {
      const stop = startAurora(canvas, reduce);
      if (stop) cleanups.push(stop);
    }

    return () => cleanups.forEach((fn) => fn());
  }, [scope]);

  return null;
}

function hexToRgb(h: string): [number, number, number] {
  let s = h.trim().replace('#', '');
  if (s.length === 3) s = s.replace(/./g, '$&$&');
  const n = parseInt(s || '000000', 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Renders the hero scene: animated aurora background + a rotating 3D particle
 * globe (additive glow). Returns a cleanup, or null when WebGL is unavailable.
 * Mirrors the static export's `scene()` and shares the same shader source.
 */
function startAurora(canvas: HTMLCanvasElement, reduce: boolean): (() => void) | null {
  const hero = canvas.closest('.hero');
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = (canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  } catch {
    /* ignore */
  }
  if (!gl || reduce) {
    hero?.classList.add('no-webgl');
    return null;
  }
  const g = gl;
  const css = getComputedStyle(canvas);
  const sh = (ty: number, src: string) => {
    const s = g.createShader(ty)!;
    g.shaderSource(s, src);
    g.compileShader(s);
    return s;
  };
  const prog = (vs: string, fs: string) => {
    const p = g.createProgram()!;
    g.attachShader(p, sh(g.VERTEX_SHADER, vs));
    g.attachShader(p, sh(g.FRAGMENT_SHADER, fs));
    g.linkProgram(p);
    return g.getProgramParameter(p, g.LINK_STATUS) ? p : null;
  };
  const aur = prog(AURORA_VERT, AURORA_FRAG);
  const par = prog(PARTICLE_VERT, PARTICLE_FRAG);
  if (!aur || !par) {
    hero?.classList.add('no-webgl');
    return null;
  }
  const color = (name: string, fallback: string) =>
    hexToRgb(css.getPropertyValue(name) || fallback);
  const bg = color('--bg', '#0b1020');
  const pri = color('--primary', '#3563ff');
  const acc = color('--accent', '#22d3ee');

  const tbuf = g.createBuffer();
  g.bindBuffer(g.ARRAY_BUFFER, tbuf);
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
  const pbuf = g.createBuffer();
  g.bindBuffer(g.ARRAY_BUFFER, pbuf);
  g.bufferData(g.ARRAY_BUFFER, SPHERE, g.STATIC_DRAW);
  const aLoc = g.getAttribLocation(aur, 'p');
  const pLoc = g.getAttribLocation(par, 'pos');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const size = () => {
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    g.viewport(0, 0, canvas.width, canvas.height);
  };
  size();
  window.addEventListener('resize', size);
  const start = performance.now();
  let raf = 0;
  const loop = (now: number) => {
    const t = (now - start) / 1000;
    g.disable(g.BLEND);
    g.useProgram(aur);
    g.bindBuffer(g.ARRAY_BUFFER, tbuf);
    g.enableVertexAttribArray(aLoc);
    g.vertexAttribPointer(aLoc, 2, g.FLOAT, false, 0, 0);
    g.uniform2f(g.getUniformLocation(aur, 'r'), canvas.width, canvas.height);
    g.uniform1f(g.getUniformLocation(aur, 't'), t);
    g.uniform3fv(g.getUniformLocation(aur, 'c1'), bg);
    g.uniform3fv(g.getUniformLocation(aur, 'c2'), pri);
    g.uniform3fv(g.getUniformLocation(aur, 'c3'), acc);
    g.drawArrays(g.TRIANGLES, 0, 3);

    g.enable(g.BLEND);
    g.blendFunc(g.SRC_ALPHA, g.ONE);
    g.useProgram(par);
    g.bindBuffer(g.ARRAY_BUFFER, pbuf);
    g.enableVertexAttribArray(pLoc);
    g.vertexAttribPointer(pLoc, 3, g.FLOAT, false, 0, 0);
    g.uniform1f(g.getUniformLocation(par, 't'), t);
    g.uniform1f(g.getUniformLocation(par, 'dpr'), dpr);
    g.uniform2f(g.getUniformLocation(par, 'res'), canvas.width, canvas.height);
    g.uniform3fv(g.getUniformLocation(par, 'col'), acc);
    g.uniform3fv(g.getUniformLocation(par, 'col2'), pri);
    g.drawArrays(g.POINTS, 0, SPHERE.length / 3);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', size);
  };
}
