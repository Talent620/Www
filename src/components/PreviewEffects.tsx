'use client';

import { useEffect, useRef } from 'react';
import { AURORA_VERT, AURORA_FRAG } from '@/lib/export/effects';

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

/** Starts the aurora shader on a canvas; returns a cleanup, or null on fallback. */
function startAurora(canvas: HTMLCanvasElement, reduce: boolean): (() => void) | null {
  const hero = canvas.closest('.hero');
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  } catch {
    /* ignore */
  }
  if (!gl || reduce) {
    hero?.classList.add('no-webgl');
    return null;
  }
  const css = getComputedStyle(canvas);
  const sh = (ty: number, src: string) => {
    const s = gl!.createShader(ty)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    return s;
  };
  const pr = gl.createProgram()!;
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, AURORA_VERT));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, AURORA_FRAG));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
    hero?.classList.add('no-webgl');
    return null;
  }
  gl.useProgram(pr);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(pr, 'r');
  const uT = gl.getUniformLocation(pr, 't');
  const color = (name: string, fallback: string) =>
    hexToRgb(css.getPropertyValue(name) || fallback);
  gl.uniform3fv(gl.getUniformLocation(pr, 'c1'), color('--bg', '#0b1020'));
  gl.uniform3fv(gl.getUniformLocation(pr, 'c2'), color('--primary', '#3563ff'));
  gl.uniform3fv(gl.getUniformLocation(pr, 'c3'), color('--accent', '#22d3ee'));
  const size = () => {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * d;
    canvas.height = canvas.clientHeight * d;
    gl!.viewport(0, 0, canvas.width, canvas.height);
  };
  size();
  window.addEventListener('resize', size);
  const start = performance.now();
  let raf = 0;
  const loop = (now: number) => {
    gl!.uniform2f(uR, canvas.width, canvas.height);
    gl!.uniform1f(uT, (now - start) / 1000);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', size);
  };
}
