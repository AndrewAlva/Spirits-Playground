import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const BG_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Emit clip-space position directly — bypasses all camera/model matrices
    // so the quad always fills the screen regardless of orbit controls.
    // z = w = 1.0 places the fragment at the far clip plane.
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const BG_FRAG = /* glsl */`
  uniform sampler2D uTexture;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(uTexture, vUv);
  }
`;

export function init(renderer) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 5;

  // --- Background quad (screen-space, always behind) ---
  const bgTexture = new THREE.TextureLoader().load('/textures/scene1.png');
  // bgTexture.colorSpace = THREE.SRGBColorSpace;

  const bgMaterial = new THREE.ShaderMaterial({
    uniforms: { uTexture: { value: bgTexture } },
    vertexShader: BG_VERT,
    fragmentShader: BG_FRAG,
    depthWrite: false,
    depthTest: false,
  });

  const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMaterial);
  bgMesh.renderOrder = -1;
  scene.add(bgMesh);

  // --- Main mesh ---
  const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const material = new THREE.MeshStandardMaterial({
    color: 0x4477ff,
    roughness: 0.35,
    metalness: 0.25,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x8899ff, 0.4);
  fillLight.position.set(-4, -2, 3);
  scene.add(fillLight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 2.0;

  return { scene, camera, controls, mesh, geometry, material, bgMaterial, bgTexture };
}

export function tick(state, renderer, t, rt) {
  const { scene, camera, controls, mesh } = state;
  mesh.position.y = Math.sin(t * 1.1) * 0.4;
  controls.update();
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
}

export function dispose(state) {
  state.controls.dispose();
  state.geometry.dispose();
  state.material.dispose();
  state.bgMaterial.dispose();
  state.bgTexture.dispose();
}
