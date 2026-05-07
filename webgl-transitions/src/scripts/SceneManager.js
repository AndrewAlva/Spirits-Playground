import * as THREE from 'three';
import * as CubeScene from './scene-cube.js';
import * as TetrahedronScene from './scene-tetrahedron.js';
import * as CylinderScene from './scene-cylinder.js';

const SCENES = {
  cube: CubeScene,
  tetrahedron: TetrahedronScene,
  cylinder: CylinderScene,
};

const canvas = document.getElementById('webgl-canvas');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
// autoClear off — each scene's tick handles clear order (bg quad first, then mesh)
renderer.autoClear = false;

const clock = new THREE.Clock();

let activeModule = null;
let activeState = null;

function switchTo(name) {
  if (!SCENES[name]) {
    console.warn(`SceneManager: unknown scene "${name}". Available: ${Object.keys(SCENES).join(', ')}`);
    return;
  }

  if (activeModule && activeState) {
    activeModule.dispose(activeState);
  }

  activeModule = SCENES[name];
  activeState = activeModule.init();
  console.log(`SceneManager: switched to "${name}"`);
}

function tick() {
  requestAnimationFrame(tick);

  if (!activeModule || !activeState) return;

  activeModule.tick(activeState, renderer, clock.getElapsedTime());
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  if (activeState?.camera) {
    activeState.camera.aspect = window.innerWidth / window.innerHeight;
    activeState.camera.updateProjectionMatrix();
  }
});

// Boot with cube scene active
switchTo('cube');
tick();

// Expose on window for quick console switching:
//   __sceneManager.switchTo('tetrahedron')
//   __sceneManager.switchTo('cylinder')
//   __sceneManager.switchTo('cube')
window.__sceneManager = { switchTo, renderer, clock };
