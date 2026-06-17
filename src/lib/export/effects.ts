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
}`;
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

/* ---- WebGL aurora hero ---- */
function hexToRgb(h){h=h.replace("#","");if(h.length===3)h=h.replace(/./g,"$&$&");
  var n=parseInt(h,16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];}
function aurora(canvas){
  var gl=null;try{gl=canvas.getContext("webgl")||canvas.getContext("experimental-webgl");}catch(e){}
  var hero=canvas.closest(".hero");
  if(!gl||reduce){if(hero)hero.classList.add("no-webgl");return;}
  function sh(ty,src){var s=gl.createShader(ty);gl.shaderSource(s,src);gl.compileShader(s);return s;}
  var pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));
  gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){if(hero)hero.classList.add("no-webgl");return;}
  gl.useProgram(pr);
  var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  var loc=gl.getAttribLocation(pr,"p");gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  var uR=gl.getUniformLocation(pr,"r"),uT=gl.getUniformLocation(pr,"t");
  gl.uniform3fv(gl.getUniformLocation(pr,"c1"),hexToRgb(v("--bg","#0b1020")));
  gl.uniform3fv(gl.getUniformLocation(pr,"c2"),hexToRgb(v("--primary","#3563ff")));
  gl.uniform3fv(gl.getUniformLocation(pr,"c3"),hexToRgb(v("--accent","#22d3ee")));
  function size(){var d=Math.min(devicePixelRatio||1,2);
    canvas.width=canvas.clientWidth*d;canvas.height=canvas.clientHeight*d;
    gl.viewport(0,0,canvas.width,canvas.height);}
  size();addEventListener("resize",size);
  var start=performance.now();
  (function loop(now){gl.uniform2f(uR,canvas.width,canvas.height);
    gl.uniform1f(uT,(now-start)/1000);gl.drawArrays(gl.TRIANGLES,0,3);
    requestAnimationFrame(loop);})(start);
}

function init(){
  try{reveal();}catch(e){bail();}
  try{tilt();}catch(e){}
  try{var c=document.querySelector(".hero-canvas");if(c)aurora(c);}catch(e){}
}
if(document.readyState!=="loading")init();else addEventListener("DOMContentLoaded",init);
})();`;
}
