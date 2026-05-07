import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function init(renderer) {
  // --- Background (full-screen quad with texture) ---
  const bgScene = new THREE.Scene();
  const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const bgTexture = new THREE.TextureLoader().load('https://picsum.photos/seed/tetra/1920/1080');
  bgTexture.colorSpace = THREE.SRGBColorSpace;

  const bgMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: bgTexture }),
  );
  bgScene.add(bgMesh);

  // --- Main scene ---
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 5;

  const geometry = new THREE.TetrahedronGeometry(1.4, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0xff6644,
    roughness: 0.3,
    metalness: 0.2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xff9966, 0.4);
  fillLight.position.set(-4, -2, 3);
  scene.add(fillLight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 2.0;

  return { bgScene, bgCamera, scene, camera, controls, mesh, geometry, material, bgTexture };
}

export function tick(state, renderer, t) {
  const { bgScene, bgCamera, scene, camera, controls, mesh } = state;

  mesh.position.y = Math.sin(t * 1.1) * 0.4;
  controls.update();

  renderer.clear();
  renderer.render(bgScene, bgCamera);
  renderer.render(scene, camera);
}

export function dispose(state) {
  state.controls.dispose();
  state.geometry.dispose();
  state.material.dispose();
  state.bgTexture.dispose();
}
