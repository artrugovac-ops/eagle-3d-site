import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/* ====== DOM refs ====== */
const canvas = document.getElementById('eagle-canvas');
const loaderEl = document.getElementById('loader');
const barEl = document.getElementById('bar');
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const btnReset = document.getElementById('btnReset');
const btnQuality = document.getElementById('btnQuality');

/* ====== Config / toggles ====== */
let highQuality = true; // quick toggle; we’ll tie to UI
const MODEL_URL = 'assets/eagle.glb';

/* ====== Three.js boot ====== */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, highQuality ? 2 : 1.25));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0d);

const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.05, 2000);
camera.position.set(0.8, 0.7, 1.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 0.45;
controls.maxDistance = 6;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 0.15, 0);

/* Lights + floor */
scene.add(new THREE.HemisphereLight(0xffffff, 0x111122, 0.9));
const dir = new THREE.DirectionalLight(0xffffff, 1.25);
dir.position.set(2.5, 3.4, 2.0);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
scene.add(dir);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(4, 64),
  new THREE.MeshStandardMaterial({ color: 0x0f0f13, roughness: 0.95, metalness: 0.05 })
);
floor.receiveShadow = true;
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.001;
scene.add(floor);

/* ====== Load the eagle (DRACO-ready) ====== */
let model;
const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/'); // CDN decoders
gltfLoader.setDRACOLoader(draco);

gltfLoader.load(
  MODEL_URL,
  (gltf) => {
    model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material && o.material.metalness !== undefined) {
          o.material.metalness = Math.min(0.85, o.material.metalness ?? 0.2);
          o.material.roughness = Math.max(0.25, o.material.roughness ?? 0.4);
        }
      }
    });
    scene.add(model);
    frameObject(model);
    hideLoader();

    // ===== HOOK: call the intro animation here (next step) =====
    // startIntroAnimation({ scene, camera, controls, model, renderer });
  },
  (ev) => {
    const pct = Math.min(100, Math.round((ev.loaded / (ev.total || 1)) * 100));
    barEl.style.width = pct + '%';
    statusEl.textContent = 'Loading… ' + pct + '%';
  },
  (err) => {
    console.error(err);
    showError('Failed to load model. Ensure assets/eagle.glb exists.');
  }
);

/* ====== Resize handling ====== */
function onResize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', () => requestAnimationFrame(onResize));
requestAnimationFrame(onResize);

/* ====== Controls/UI ====== */
btnReset?.addEventListener('click', () => model && frameObject(model));
btnQuality?.addEventListener('click', () => {
  highQuality = !highQuality;
  btnQuality.textContent = highQuality ? 'HQ' : 'LQ';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, highQuality ? 2 : 1.25));
});

/* ====== Animation loop ====== */
function tick() {
  requestAnimationFrame(tick);
  controls.update();
  renderer.render(scene, camera);
}
tick();

/* ====== Utilities ====== */
function frameObject(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fitDist = (maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) * 1.25;
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(fitDist * 0.7, fitDist * 0.6, fitDist * 0.9));
  camera.near = Math.max(0.01, maxDim / 1000);
  camera.far = Math.max(50, fitDist * 10);
  camera.updateProjectionMatrix();
}

function hideLoader(){ loaderEl.classList.remove('show'); loaderEl.classList.add('hidden'); }
function showError(msg){ errorEl.hidden = false; errorEl.textContent = msg; }
