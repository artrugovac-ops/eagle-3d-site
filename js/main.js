import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('c');
const loaderEl = document.getElementById('loader');
const barEl = document.getElementById('bar');
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0d);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 2000);
camera.position.set(0.8, 0.7, 1.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 0.5;
controls.maxDistance = 6;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 0.15, 0);

const ambient = new THREE.HemisphereLight(0xffffff, 0x111122, 0.85);
scene.add(ambient);

const dir = new THREE.DirectionalLight(0xffffff, 1.35);
dir.position.set(2.5, 3.5, 2.0);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
scene.add(dir);

const floorGeo = new THREE.CircleGeometry(4, 64);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x0f0f13, roughness: 0.95, metalness: 0.05 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.receiveShadow = true;
floor.rotation.x = -Math.PI/2;
floor.position.y = -0.001;
scene.add(floor);

let model;
const gltfLoader = new GLTFLoader();

gltfLoader.load(
  'assets/eagle.glb',
  (gltf) => {
    model = gltf.scene;
    model.traverse((o)=>{
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

    // Frame the model nicely
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fitDist = (maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) * 1.25;

    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(fitDist * 0.7, fitDist * 0.6, fitDist * 0.9));
    camera.near = Math.max(0.01, maxDim / 1000);
    camera.far = Math.max(50, fitDist * 10);
    camera.updateProjectionMatrix();

    statusEl.textContent = 'Done';
    setTimeout(()=> loaderEl.classList.remove('show'), 250);
  },
  (ev) => {
    const total = ev.total || 1;
    const pct = Math.min(100, Math.round((ev.loaded / total) * 100));
    barEl.style.width = pct + '%';
    statusEl.textContent = `Loading model… ${pct}%`;
  },
  (err) => {
    console.error(err);
    statusEl.textContent = 'Failed to load model';
    showError();
  }
);

function showError(){
  errorEl.classList.remove('hidden');
  errorEl.innerHTML = "<b>Model not found.</b> Put your GLB at <code>assets/eagle.glb</code> then refresh.";
}

function onResize(){
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);

window.addEventListener('dblclick', ()=>{
  if (!model) return;
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  controls.target.copy(center);
});

function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
