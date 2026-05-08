import * as THREE from 'three';
import * as CubeScene        from './scene-cube.js';
import * as TetrahedronScene from './scene-tetrahedron.js';
import * as CylinderScene    from './scene-cylinder.js';
import { scroll }            from './scroll.js';
import                           './debug.js';

// ─── Renderer ────────────────────────────────────────────────────────────────

const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// ─── Scenes ──────────────────────────────────────────────────────────────────

const SCENE_NAMES = ['cube', 'tetrahedron', 'cylinder'];
const MODULES = {
  cube:        CubeScene,
  tetrahedron: TetrahedronScene,
  cylinder:    CylinderScene,
};

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
  uniform sampler2D uLevelMask;
  uniform float uProgress;
  // Half-width of the feather edge in mask-value space.
  // 0.05 = 10% total blend band around the threshold.
  uniform float uEdge;
  varying vec2 vUv;
  void main() {
    vec4 colorFrom = texture2D(uFrom, vUv);
    vec4 colorTo   = texture2D(uTo,   vUv);
    float mask = texture2D(uLevelMask, vUv).r;
    // Stretch the threshold so it sweeps from below 0 to above 1.
    // At uProgress=0 the window is entirely below the mask range → edge=1 everywhere (100% from).
    // At uProgress=1 the window is entirely above the mask range → edge=0 everywhere (100% to).
    float p    = mix(-uEdge, 1.0 + uEdge, uProgress);
    float edge = smoothstep(p - uEdge, p + uEdge, mask);
    gl_FragColor = mix(colorTo, colorFrom, edge);
  }
`;

const levelMask = new THREE.TextureLoader().load('/textures/levels1.jpg');
levelMask.wrapS = THREE.RepeatWrapping;
levelMask.wrapT = THREE.RepeatWrapping;

const compUniforms = {
  uFrom:      { value: rts['cube'].texture },
  uTo:        { value: rts['tetrahedron'].texture },
  uLevelMask: { value: levelMask },
  uProgress:  { value: 0.0 },
  uEdge:      { value: 0.05 },
};

const compScene  = new THREE.Scene();
const compCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
compScene.add(new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    uniforms: compUniforms,
    vertexShader:   COMP_VERT,
    fragmentShader: COMP_FRAG,
  }),
));

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Enable controls only for the scene that is most visible; disabling the
// others prevents all three OrbitControls from fighting over the same pointer.
let lastDominantName = '';
function syncControls(dominantName) {
  if (dominantName === lastDominantName) return;
  lastDominantName = dominantName;
  for (const name of SCENE_NAMES) {
    states[name].controls.enabled = (name === dominantName);
  }
}

let lastSectionIndex = -1;
function syncCompositorTextures(index) {
  if (index === lastSectionIndex) return;
  lastSectionIndex = index;
  compUniforms.uFrom.value = rts[SCENE_NAMES[index]].texture;
  compUniforms.uTo.value   = rts[SCENE_NAMES[index + 1]].texture;
}

// ─── Loop ─────────────────────────────────────────────────────────────────────

const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);

  const t = clock.getElapsedTime();
  const { sectionIndex, sectionProgress } = scroll;

  // Keep compositor textures pointing at the right pair of scenes
  syncCompositorTextures(sectionIndex);

  // Drive the blend directly from scroll
  compUniforms.uProgress.value = sectionProgress;

  // Hand off controls to whichever scene is occupying more than half the screen
  const dominantName = sectionProgress >= 0.5
    ? SCENE_NAMES[sectionIndex + 1]
    : SCENE_NAMES[sectionIndex];
  syncControls(dominantName);

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

syncControls('cube');
tick();

// Expose scroll state for debugging:
//   __scrollData   → { x, y, normalizedX, normalizedY, sectionIndex, sectionProgress }
window.__scrollData = scroll;
