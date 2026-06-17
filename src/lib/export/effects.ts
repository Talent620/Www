/**
 * Shared "hi-level" visual layer for generated sites.
 *
 * A single source of truth for the modern, animated, pseudo-3D look applied to
 * every generated site, consumed by BOTH surfaces so they stay identical:
 *  - the live preview (React) injects `effectsCss()` and drives the behaviours
 *    with client components;
 *  - the static export appends `effectsCss()` to its stylesheet and ships
 *    `effectsJs()` as a tiny dependency-free script.
 *
 * Everything is driven by the design tokens already exposed as CSS variables
 * (--primary, --accent, --secondary, --bg, --surface ...), so it adapts to each
 * site's palette automatically. The hero uses a lightweight WebGL fragment
 * shader (animated aurora) with a graceful CSS fallback.
 */

/**
 * Google Fonts stylesheet URL for the site's heading + body fonts. The
 * generated design picks real Google Fonts; loading them (instead of falling
 * back to system-ui) is the single biggest lift to a premium feel. Falls back
 * gracefully to the system stack offline.
 */
export function googleFontsHref(headingFont: string, bodyFont: string): string {
  const fonts = [headingFont, bodyFont].filter((f): f is string => Boolean(f && f.trim()));
  const families = Array.from(new Set(fonts.length ? fonts : ['Inter']))
    .map((f) => `family=${f.trim().replace(/\s+/g, '+')}:wght@400;500;600;700;800`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** WebGL vertex shader — a single fullscreen triangle. */
export const AURORA_VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

/** WebGL fragment shader — animated aurora driven by three palette colours. */
export const AURORA_FRAG =
  'precision highp float;uniform vec2 r;uniform float t;uniform vec3 c1,c2,c3;' +
  'float n(vec2 x){return sin(x.x)*sin(x.y);}' +
  'void main(){vec2 uv=gl_FragCoord.xy/r;vec2 q=uv;' +
  'float f=0.;f+=0.55*n(q*3.+vec2(t*0.6,t*0.4));' +
  'f+=0.30*n(q*6.-vec2(t*0.5,t*0.7));f+=0.15*n(q*12.+t);' +
  'f=0.5+0.5*f;' +
  'vec3 col=mix(c1,c2,smoothstep(0.2,0.8,f+uv.y*0.3));' +
  'col=mix(col,c3,smoothstep(0.6,1.0,n(q*2.+t*0.3)*0.5+0.5));' +
  'float vig=smoothstep(1.2,0.2,length(uv-0.5));' +
  'gl_FragColor=vec4(col*vig,1.);}';

/**
 * Vertex shader for the 3D particle globe: rotates a unit-sphere point cloud
 * over time and projects it with a real perspective divide, so the rotation
 * reads as genuine depth. Point size and a depth varying drive the glow/fade.
 */
export const PARTICLE_VERT =
  'attribute vec3 pos;uniform float t;uniform vec2 res;uniform float dpr;varying float vz;' +
  'void main(){float a=t*0.22,b=t*0.13;' +
  'mat3 ry=mat3(cos(a),0.,sin(a),0.,1.,0.,-sin(a),0.,cos(a));' +
  'mat3 rx=mat3(1.,0.,0.,0.,cos(b),-sin(b),0.,sin(b),cos(b));' +
  'vec3 p=rx*ry*pos;float cam=3.2;float z=p.z+cam;' +
  'vec2 pr=p.xy/z;pr.x/=res.x/res.y;' +
  'gl_Position=vec4(pr*1.5,0.,1.);' +
  'gl_PointSize=clamp(70.0/z,1.5,11.0)*dpr;vz=z;}';

/** Fragment shader for the particle globe: soft round points, depth-faded. */
export const PARTICLE_FRAG =
  'precision highp float;uniform vec3 col;uniform vec3 col2;varying float vz;' +
  'void main(){vec2 c=gl_PointCoord-0.5;float d=length(c);if(d>0.5)discard;' +
  'float a=smoothstep(0.5,0.0,d);' +
  'float depth=clamp((4.6-vz)/3.0,0.12,1.0);' +
  'vec3 col3=mix(col2,col,depth);' +
  'gl_FragColor=vec4(col3,a*depth*0.92);}';

/** Unit-sphere point cloud (Fibonacci distribution) as a flat [x,y,z,...] array. */
export function spherePoints(n: number): number[] {
  const pts: number[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * golden;
    pts.push(Math.cos(th) * r, y, Math.sin(th) * r);
  }
  return pts;
}

/** Additive CSS: animated aurora, glass depth, 3D tilt base, scroll-reveal. */
export function effectsCss(): string {
  return `
/* ---- hi-level visual layer (animated · pseudo-3D · modern) ---------------- */
.hero{position:relative;overflow:hidden;isolation:isolate;perspective:1200px}
.hero-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:-2;display:block}
.hero::after{content:"";position:absolute;inset:0;z-index:-1;
  background:radial-gradient(60% 80% at 50% 0%,color-mix(in srgb,var(--primary) 22%,transparent),transparent 70%);
  pointer-events:none}
/* CSS aurora fallback when WebGL is unavailable */
.hero.no-webgl{background:
  radial-gradient(40% 60% at 20% 10%,color-mix(in srgb,var(--primary) 38%,transparent),transparent 60%),
  radial-gradient(45% 65% at 85% 20%,color-mix(in srgb,var(--accent) 34%,transparent),transparent 62%),
  radial-gradient(50% 70% at 50% 100%,color-mix(in srgb,var(--secondary,var(--primary)) 30%,transparent),transparent 65%),
  var(--bg);
  background-size:200% 200%;animation:aurora-shift 18s ease-in-out infinite}
@keyframes aurora-shift{0%,100%{background-position:0% 0%,100% 0%,50% 100%}50%{background-position:100% 50%,0% 50%,50% 0%}}

.hero h1{background-image:linear-gradient(120deg,var(--text),color-mix(in srgb,var(--primary) 80%,var(--text)),var(--accent));
  background-size:200% auto}
@supports ((-webkit-background-clip:text) or (background-clip:text)){
  .hero h1{-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
    animation:sheen 6s linear infinite}
}
@keyframes sheen{to{background-position:200% center}}

.btn{position:relative;transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s ease;
  box-shadow:0 8px 24px color-mix(in srgb,var(--primary) 35%,transparent)}
.btn:hover{transform:translateY(-3px) scale(1.02);box-shadow:0 16px 40px color-mix(in srgb,var(--primary) 45%,transparent)}

/* glassmorphism + depth on cards */
.card{position:relative;transform-style:preserve-3d;transition:transform .2s ease,box-shadow .3s ease,border-color .3s ease;
  border:1px solid color-mix(in srgb,var(--text) 8%,transparent);
  background:color-mix(in srgb,var(--surface) 80%,transparent);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  box-shadow:0 10px 30px color-mix(in srgb,#000 14%,transparent)}
.card:hover{box-shadow:0 22px 55px color-mix(in srgb,var(--primary) 22%,transparent);
  border-color:color-mix(in srgb,var(--primary) 35%,transparent)}
.card>*{transform:translateZ(28px)}

.stats strong{display:inline-block;animation:float 5s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}

/* scroll-reveal — gated on .js so content is fully visible if JS never runs */
.js .reveal{opacity:0;transform:translateY(26px) scale(.985);
  transition:opacity .7s cubic-bezier(.2,.8,.2,1),transform .7s cubic-bezier(.2,.8,.2,1)}
.js .reveal.is-visible{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){
  .js .reveal{opacity:1;transform:none;transition:none}
  .hero h1,.stats strong,.hero.no-webgl{animation:none}
}

/* ---- premium polish ---------------------------------------------------- */
body{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
  letter-spacing:-0.011em}
h1,h2,h3{letter-spacing:-0.022em}
.hero{min-height:88vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding-top:7rem;padding-bottom:7rem}
.hero h1{font-weight:800;font-size:clamp(2.6rem,6.2vw,4.6rem);line-height:1.04}
.hero .sub{font-size:clamp(1.05rem,1.6vw,1.3rem);max-width:42rem;opacity:.92}
.eyebrow{display:inline-flex;align-items:center;gap:.5rem;margin:0 auto 1.4rem;
  padding:.4rem .9rem;font-size:.78rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
  color:var(--primary);border-radius:999px;
  border:1px solid color-mix(in srgb,var(--primary) 40%,transparent);
  background:color-mix(in srgb,var(--primary) 12%,transparent);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.eyebrow::before{content:"";width:.5rem;height:.5rem;border-radius:999px;background:var(--accent);
  box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 30%,transparent)}
.btn{background:linear-gradient(120deg,var(--primary),var(--accent));background-size:140% 140%;
  border-radius:999px;padding:.95rem 2.1rem;letter-spacing:.01em}
.btn:hover{background-position:100% 0}
.block h2{font-size:clamp(1.7rem,3vw,2.4rem);font-weight:700}
.stats strong{font-size:clamp(2.2rem,4vw,3rem);font-weight:800;
  background:linear-gradient(120deg,var(--primary),var(--accent));
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.site-header{padding-top:1.1rem;padding-bottom:1.1rem}
.site-header nav a{position:relative;transition:color .2s}
.site-header nav a::after{content:"";position:absolute;left:0;right:0;bottom:-4px;height:2px;
  background:linear-gradient(90deg,var(--primary),var(--accent));transform:scaleX(0);transform-origin:left;
  transition:transform .25s ease}
.site-header nav a:hover{color:var(--text)}
.site-header nav a:hover::after,.site-header nav a[aria-current]::after{transform:scaleX(1)}
.cta-band{border-radius:0;background:linear-gradient(120deg,var(--primary),var(--accent))}
.faq details{border:1px solid color-mix(in srgb,var(--text) 8%,transparent)}
.faq details[open]{border-color:color-mix(in srgb,var(--primary) 35%,transparent)}`;
}

/**
 * Self-contained behaviour script for the static export: WebGL aurora hero,
 * pointer-driven 3D card tilt, and IntersectionObserver scroll-reveal. No
 * dependencies; reads colours from the page's CSS variables.
 */
export function effectsJs(): string {
  return `(()=>{
"use strict";
var VS=${JSON.stringify(AURORA_VERT)},FS=${JSON.stringify(AURORA_FRAG)};
var PV=${JSON.stringify(PARTICLE_VERT)},PF=${JSON.stringify(PARTICLE_FRAG)};
var PTS=(function(n){var a=[],g=Math.PI*(3-Math.sqrt(5)),i,y,r,th;
  for(i=0;i<n;i++){y=1-(i/(n-1))*2;r=Math.sqrt(Math.max(0,1-y*y));th=i*g;
    a.push(Math.cos(th)*r,y,Math.sin(th)*r);}return new Float32Array(a);})(520);
var docEl=document.documentElement;
docEl.classList.add("js");
function bail(){docEl.classList.remove("js");}
var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
var css=getComputedStyle(document.documentElement);
function v(n,f){var x=css.getPropertyValue(n).trim();return x||f;}

/* ---- scroll reveal ---- */
function reveal(){
  var els=[].slice.call(document.querySelectorAll(".reveal"));
  if(reduce||!("IntersectionObserver"in window)){els.forEach(function(e){e.classList.add("is-visible");});return;}
  var io=new IntersectionObserver(function(es){es.forEach(function(en){
    if(en.isIntersecting){en.target.classList.add("is-visible");io.unobserve(en.target);}});},{threshold:.14});
  els.forEach(function(e){io.observe(e);});
}

/* ---- 3D tilt on cards ---- */
function tilt(){
  if(reduce)return;
  [].slice.call(document.querySelectorAll(".card")).forEach(function(c){
    c.addEventListener("pointermove",function(e){
      var r=c.getBoundingClientRect();
      var px=(e.clientX-r.left)/r.width-.5, py=(e.clientY-r.top)/r.height-.5;
      c.style.transform="rotateX("+(-py*7)+"deg) rotateY("+(px*9)+"deg) translateY(-6px)";
    });
    c.addEventListener("pointerleave",function(){c.style.transform="";});
  });
}

/* ---- WebGL hero: animated aurora + rotating 3D particle globe ---- */
function hexToRgb(h){h=h.replace("#","");if(h.length===3)h=h.replace(/./g,"$&$&");
  var n=parseInt(h,16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];}
function scene(canvas){
  var gl=null;try{gl=canvas.getContext("webgl",{alpha:true,premultipliedAlpha:false})||canvas.getContext("experimental-webgl");}catch(e){}
  var hero=canvas.closest(".hero");
  if(!gl||reduce){if(hero)hero.classList.add("no-webgl");return;}
  function sh(ty,src){var s=gl.createShader(ty);gl.shaderSource(s,src);gl.compileShader(s);return s;}
  function prog(vs,fs){var p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));
    gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
    return gl.getProgramParameter(p,gl.LINK_STATUS)?p:null;}
  var aur=prog(VS,FS),par=prog(PV,PF);
  if(!aur||!par){if(hero)hero.classList.add("no-webgl");return;}
  var bg=hexToRgb(v("--bg","#0b1020")),pri=hexToRgb(v("--primary","#3563ff")),acc=hexToRgb(v("--accent","#22d3ee"));
  // aurora fullscreen triangle
  var tbuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,tbuf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  // particle globe
  var pbuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pbuf);
  gl.bufferData(gl.ARRAY_BUFFER,PTS,gl.STATIC_DRAW);
  var aLoc=gl.getAttribLocation(aur,"p"),pLoc=gl.getAttribLocation(par,"pos");
  var dpr=Math.min(devicePixelRatio||1,2);
  function size(){canvas.width=canvas.clientWidth*dpr;canvas.height=canvas.clientHeight*dpr;
    gl.viewport(0,0,canvas.width,canvas.height);}
  size();addEventListener("resize",size);
  var start=performance.now();
  (function loop(now){var t=(now-start)/1000;
    // pass 1: aurora background
    gl.disable(gl.BLEND);gl.useProgram(aur);
    gl.bindBuffer(gl.ARRAY_BUFFER,tbuf);gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc,2,gl.FLOAT,false,0,0);
    gl.uniform2f(gl.getUniformLocation(aur,"r"),canvas.width,canvas.height);
    gl.uniform1f(gl.getUniformLocation(aur,"t"),t);
    gl.uniform3fv(gl.getUniformLocation(aur,"c1"),bg);
    gl.uniform3fv(gl.getUniformLocation(aur,"c2"),pri);
    gl.uniform3fv(gl.getUniformLocation(aur,"c3"),acc);
    gl.drawArrays(gl.TRIANGLES,0,3);
    // pass 2: additive 3D particle globe
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.useProgram(par);
    gl.bindBuffer(gl.ARRAY_BUFFER,pbuf);gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc,3,gl.FLOAT,false,0,0);
    gl.uniform1f(gl.getUniformLocation(par,"t"),t);
    gl.uniform1f(gl.getUniformLocation(par,"dpr"),dpr);
    gl.uniform2f(gl.getUniformLocation(par,"res"),canvas.width,canvas.height);
    gl.uniform3fv(gl.getUniformLocation(par,"col"),acc);
    gl.uniform3fv(gl.getUniformLocation(par,"col2"),pri);
    gl.drawArrays(gl.POINTS,0,PTS.length/3);
    requestAnimationFrame(loop);})(start);
}

function init(){
  try{reveal();}catch(e){bail();}
  try{tilt();}catch(e){}
  try{var c=document.querySelector(".hero-canvas");if(c)scene(c);}catch(e){}
}
if(document.readyState!=="loading")init();else addEventListener("DOMContentLoaded",init);
})();`;
}
