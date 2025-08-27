import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ===== DOM / constants ===== */
const canvas = document.getElementById('eagle-canvas');

const BADGE_SIZE = 180;     // identical on desktop & mobile
const BADGE_SIZE_TINY = 148; // if viewport < 360px
const OFFSET = 20;
const TINY_BP = 360;

const SPIN_SPEED = THREE.MathUtils.degToRad(0.18);  // badge idle spin
const BOB_PIXELS = 5;    // visually small; we convert to world units
const INTRO_TIME = 2.0;  // total seconds

/* ===== Renderer ===== */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const dpr = /Mobi|Android/i.test(navigator.userAgent) ? 1.5 : 1.75;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, dpr));
renderer.setSize(badgeSize(), badgeSize(), false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = false;

/* ===== Scene + Environment (this makes chrome SHINE) ===== */
const scene = new THREE.Scene();
scene.background = null;
const pmrem = new THREE.PMREMGenerator(renderer);
const env = new RoomEnvironment();
const envTex = pmrem.fromScene(env).texture;
scene.environment = envTex;  // <-- key: reflections for metallic materials

/* ===== Camera ===== */
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 2000);

/* ===== Lights ===== */
// Key light (main)
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(2.5, 3.4, 2.0);
scene.add(key);

// Rim light (soft edge highlight)
const rim = new THREE.DirectionalLight(0xffffff, 0.6);
rim.position.set(-2.0, 2.5, -2.0);
scene.add(rim);

// Fill (ambient)
const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.6);
scene.add(hemi);

/* ===== Model load ===== */
const MODEL_URL = 'assets/eagle.glb';
let model = null;

const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
gltfLoader.setDRACOLoader(draco);

gltfLoader.load(
  MODEL_URL,
  (gltf) => {
    model = gltf.scene;

    // Normalize materials for chrome look but keep original where present
    model.traverse((o) => {
      if (o.isMesh) {
        const m = o.material;
        if (m && 'metalness' in m && 'roughness' in m) {
          // Chrome settings now actually reflect the environment
          m.metalness = 1.0;
          m.roughness = 0.12;
          m.envMapIntensity = 1.0;
        }
      }
    });

    scene.add(model);
    startIntro();
  },
  undefined,
  (err) => console.error('Failed to load model:', err)
);

/* ===== Layout helpers ===== */
function isTiny() { return window.innerWidth < TINY_BP; }
function badgeSize() { return isTiny() ? BADGE_SIZE_TINY : BADGE_SIZE; }

function setCanvasBox(left, top, size) {
  canvas.style.position = 'fixed';
  canvas.style.left = `${left}px`;
  canvas.style.top = `${top}px`;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
}

function centerStartBox() {
  const size = Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.6);
  const left = Math.round((window.innerWidth - size) / 2);
  const top  = Math.round((window.innerHeight - size) / 2);
  return { left, top, size };
}

function finalBadgeBox() {
  const size = badgeSize();
  return { left: OFFSET, top: OFFSET, size };
}

function frameForBox(obj, sizePx, pad = 1.15) {
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(dim.x, dim.y, dim.z);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const dist = (maxDim / (2 * Math.tan(fov / 2))) * pad;
  const center = box.getCenter(new THREE.Vector3());
  camera.position.copy(center).add(new THREE.Vector3(dist * 0.7, dist * 0.6, dist * 0.9));
  camera.near = Math.max(0.01, maxDim / 1000);
  camera.far = Math.max(50, dist * 10);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  renderer.setSize(sizePx, sizePx, false);
}

/* ===== Intro timeline ===== */
let t0 = 0;
let introDone = false;
let pausedHover = false;
let floatPhase = 0;

function startIntro() {
  const start = centerStartBox();
  const end = finalBadgeBox();

  // Start large, centered
  setCanvasBox(start.left, start.top, start.size);
  frameForBox(model, start.size, 1.05); // a tad tighter for drama

  // Initial pose: slight tilt so it doesn’t feel dead
  if (model) {
    model.rotation.set(THREE.MathUtils.degToRad(2), 0, THREE.MathUtils.degToRad(-1));
  }

  // Time origin
  t0 = performance.now();
  introDone = false;

  requestAnimationFrame(loop);
}

/* Smooth cubic-out */
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function loop(now) {
  const dt = Math.min(0.033, (now - (loop._last || now)) / 1000);
  loop._last = now;
  const elapsed = (now - t0) / 1000;

  // Subtle environment drift to keep chrome alive (very slow)
  const drift = Math.sin(now / 1000 / 10.0 * Math.PI * 2) * THREE.MathUtils.degToRad(6);
  key.position.set(2.5 * Math.cos(drift), 3.4, 2.0 * Math.sin(drift));
  rim.position.set(-2.0 * Math.cos(drift * 0.8), 2.5, -2.0 * Math.sin(drift * 0.8));

  if (!introDone) {
    const start = centerStartBox();
    const end = finalBadgeBox();

    // — Flash pop & sparkle (0–0.30s) —
    if (elapsed <= 0.30) {
      const t = elapsed / 0.30;
      key.intensity = 1.6 + t * 0.9;             // up to 2.5
      rim.intensity = 0.6 + t * 0.6;             // rim brightens briefly
      renderer.toneMappingExposure = 1.0 + t * 0.12;
    } else if (elapsed <= 0.42) {
      const t = (elapsed - 0.30) / 0.12;
      key.intensity = 2.5 - t * 0.9;             // fall back to ~1.6
      rim.intensity = 1.2 - t * 0.6;             // fall back to 0.6
      renderer.toneMappingExposure = 1.12 - t * 0.12;
    } else {
      key.intensity = 1.6;
      rim.intensity = 0.6;
      renderer.toneMappingExposure = 1.0;
    }

    // — Travel (0.30–1.60s) —
    const moveT = clamp01((elapsed - 0.30) / (1.60 - 0.30));
    const e = easeOutCubic(moveT);

    // Bezier-ish curve to top-left (ease adds curvature)
    const left = start.left + (end.left - start.left) * e;
    const top  = start.top  + (end.top  - start.top ) * e;
    const size = start.size + (end.size - start.size) * e;
    setCanvasBox(left, top, size);
    renderer.setSize(size, size, false);
    camera.aspect = 1; camera.updateProjectionMatrix();

    // Model motion so it never feels stagnant
    if (model) {
      // Yaw total ~90° across whole intro
      model.rotation.y = THREE.MathUtils.degToRad(90) * clamp01(elapsed / INTRO_TIME);
      // Float (translate small amount in world space)
      floatPhase += dt * (Math.PI * 2 / 8);
      const bobWorld = (BOB_PIXELS / size) * 0.5; // convert pixels to ~world
      model.position.y = Math.sin(floatPhase) * bobWorld;
      const tilt = Math.sin(floatPhase * 0.6) * THREE.MathUtils.degToRad(1.6);
      model.rotation.z = tilt * 0.7;
      model.rotation.x = tilt * 0.35;
    }

    // — Glint sweep during settle (1.60–2.00s) —
    if (elapsed >= 1.60 && elapsed <= 2.00) {
      const t = (elapsed - 1.60) / 0.40;
      const extra = THREE.MathUtils.degToRad(14);
      const phase = -THREE.MathUtils.degToRad(6) + t * (THREE.MathUtils.degToRad(12) + extra);
      key.position.set(2.5 * Math.cos(phase), 3.4, 2.0 * Math.sin(phase));
    }

    // End intro
    if (elapsed >= INTRO_TIME) {
      const b = finalBadgeBox();
      setCanvasBox(b.left, b.top, b.size);
      frameForBox(model, b.size, 1.15);
      introDone = true;
    }
  } else {
    // BADGE STATE — continuous slow spin + subtle float (unless hover paused)
    const bSize = badgeSize();
    if (Math.abs(canvas.clientWidth - bSize) > 1) {
      renderer.setSize(bSize, bSize, false);
      const b = finalBadgeBox();
      setCanvasBox(b.left, b.top, b.size);
      camera.aspect = 1; camera.updateProjectionMatrix();
    }

    if (!pausedHover && model) {
      model.rotation.y += SPIN_SPEED * dt;

      floatPhase += dt * (Math.PI * 2 / 8);
      const bobWorld = (BOB_PIXELS / bSize) * 0.5;
      model.position.y = Math.sin(floatPhase) * bobWorld;
      const tilt = Math.sin(floatPhase * 0.6) * THREE.MathUtils.degToRad(1.6);
      model.rotation.z = tilt * 0.7;
      model.rotation.x = tilt * 0.35;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

/* ===== Hover pause (desktop) ===== */
canvas.addEventListener('mouseenter', () => { pausedHover = true; });
canvas.addEventListener('mouseleave', () => { pausedHover = false; });

/* ===== Resize ===== */
window.addEventListener('resize', () => {
  if (!introDone) return;
  const b = finalBadgeBox();
  setCanvasBox(b.left, b.top, b.size);
  renderer.setSize(b.size, b.size, false);
  camera.aspect = 1; camera.updateProjectionMatrix();
});
