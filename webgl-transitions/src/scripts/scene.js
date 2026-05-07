import * as THREE from 'three';

const canvas = document.getElementById('webgl-canvas');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 5;

// Cube
const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const material = new THREE.MeshStandardMaterial({
  color: 0x4477ff,
  roughness: 0.35,
  metalness: 0.25,
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
keyLight.position.set(4, 6, 5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x8899ff, 0.4);
fillLight.position.set(-4, -2, 3);
scene.add(fillLight);

// Animation loop
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);

  const t = clock.getElapsedTime();

  // Slow auto-rotation
  cube.rotation.x = t * 0.3;
  cube.rotation.y = t * 0.5;

  // Sine-wave vertical float
  cube.position.y = Math.sin(t * 1.1) * 0.4;

  renderer.render(scene, camera);
}

tick();

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Expose renderer + scene globally so future transition logic can access them
window.__wglScene = { renderer, scene, camera, cube, clock };
