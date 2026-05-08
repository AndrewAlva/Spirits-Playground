import * as THREE from 'three';
import * as CubeScene from './scene-cube.js';
import * as TetrahedronScene from './scene-tetrahedron.js';
import * as CylinderScene from './scene-cylinder.js';

// ─── Renderer ────────────────────────────────────────────────────────────────

const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// ─── Scenes ──────────────────────────────────────────────────────────────────

const SCENE_NAMES = ['cube', 'tetrahedron', 'cylinder'];
const MODULES = {
  cube: CubeScene,
  tetrahedron: TetrahedronScene,
  cylinder: CylinderScene,
};

// All scenes are initialised upfront so their render targets stay live.
const states = {};
for (const name of SCENE_NAMES) {
  states[name] = MODULES[name].init(renderer);
}

// ─── Render targets ───────────────────────────────────────────────────────────

const rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const rts = {};
for (const name of SCENE_NAMES) {
  rts[name] = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, rtOpts);
}

// ─── Compositor ───────────────────────────────────────────────────────────────
// A full-screen quad that samples two scene textures and mixes them.

const COMP_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const COMP_FRAG = /* glsl */`
  uniform sampler2D uFrom;
  uniform sampler2D uTo;
  uniform float uProgress;
  varying vec2 vUv;
  void main() {
    vec4 colorFrom = texture2D(uFrom, vUv);
    vec4 colorTo   = texture2D(uTo,   vUv);
    gl_FragColor   = mix(colorFrom, colorTo, smoothstep(0.0, 1.0, uProgress));
  }
`;

const compUniforms = {
  uFrom:     { value: rts['cube'].texture },
  uTo:       { value: rts['cube'].texture },
  uProgress: { value: 1.0 },
};

const compScene = new THREE.Scene();
const compCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const compMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    uniforms: compUniforms,
    vertexShader: COMP_VERT,
    fragmentShader: COMP_FRAG,
  }),
);
compScene.add(compMesh);

// ─── Transition state ─────────────────────────────────────────────────────────

let fromName = 'cube';
let toName   = 'cube';
let progress = 1.0;
let transitioning = false;
let transitionDuration = 1.0;

// Only the active (incoming) scene responds to pointer events.
function setActiveControls(name) {
  for (const n of SCENE_NAMES) {
    states[n].controls.enabled = (n === name);
  }
}

function transitionTo(name, duration = 1.0) {
  if (!MODULES[name]) {
    console.warn(`SceneManager: unknown scene "${name}". Available: ${SCENE_NAMES.join(', ')}`);
    return;
  }
  if (name === toName && !transitioning) return;

  fromName = toName;
  toName   = name;
  progress = 0.0;
  transitioning = true;
  transitionDuration = duration;

  compUniforms.uFrom.value     = rts[fromName].texture;
  compUniforms.uTo.value       = rts[toName].texture;
  compUniforms.uProgress.value = 0.0;

  setActiveControls(toName);
  console.log(`SceneManager: "${fromName}" → "${toName}" (${duration}s)`);
}

// ─── Loop ─────────────────────────────────────────────────────────────────────

const clock = new THREE.Clock();
let prevT = 0;

function tick() {
  requestAnimationFrame(tick);

  const t     = clock.getElapsedTime();
  const delta = t - prevT;
  prevT = t;

  // Advance transition progress
  if (transitioning) {
    progress = Math.min(progress + delta / transitionDuration, 1.0);
    compUniforms.uProgress.value = progress;
    if (progress >= 1.0) {
      transitioning = false;
      fromName = toName;
    }
  }

  // Render every scene into its own render target
  for (const name of SCENE_NAMES) {
    MODULES[name].tick(states[name], renderer, t, rts[name]);
  }

  // Compositor → canvas
  renderer.setRenderTarget(null);
  renderer.render(compScene, compCamera);
}

// ─── Resize ───────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;

  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  for (const name of SCENE_NAMES) {
    rts[name].setSize(w, h);
    states[name].camera.aspect = w / h;
    states[name].camera.updateProjectionMatrix();
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

setActiveControls('cube');
tick();

// Console API:
//   __sceneManager.transitionTo('tetrahedron')
//   __sceneManager.transitionTo('cylinder', 2.0)
//   __sceneManager.transitionTo('cube', 0.5)
window.__sceneManager = { transitionTo, renderer, clock };
