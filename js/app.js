import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ===== DOM / constants ===== */
const canvas = document.getElementById('eagle-canvas');

const BADGE_PX = 180;              // identical on desktop & mobile
const BADGE_PX_TINY = 148;         // for very small screens (<360px)
const OFFSET_PX = 20;              // corner offset
const TINY_BP = 360;               // px

const INTRO_TIME = 2.0;            // seconds
const SPIN_BADGE_RPS = (Math.PI * 2) / 10; // 10s per rotation -> ~0.628 rad/s (clockwise)
const KEY_DRIFT_AMPL = THREE.MathUtils.degToRad(10); // ±10°
const KEY_DRIFT_PERIOD = 8.0;      // seconds
const RIM_INTENSITY = 0.9;         // stronger rim for chrome edges

/* ===== Renderer ===== */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const dpr = /Mobi|Android/i.test(navigator.userAgent) ? 1.5 : 1.75;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, dpr));
renderer.setSize(badgeSize(), badgeSize(), false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

/* ===== Scene + environment (real reflections) ===== */
const scene = new THREE.Scene();
scene.background = null;
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment()).texture;
scene.environment = envTex;

/* ===== Camera ===== */
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 2000);

/* ===== Lights ===== */
const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.65);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(2.6, 3.2, 2.1);
scene.add(key);

const rim = new THREE.DirectionalLight(0xffffff, RIM_INTENSITY);
rim.position.set(-2.0, 2.4, -2.0);
scene.add(rim);

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

    // Chrome look with strong reflections
    model.traverse((o) => {
      if (o.isMesh && o.material && 'metalness' in o.material && 'roughness' in o.material) {
        o.material.metalness = 1.0;
        o.material.roughness = 0.09;
        o.material.envMapIntensity = 1.4;
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
function badgeSize() { return isTiny() ? BADGE_PX_TINY : BADGE_PX; }

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
  return { left: OFFSET_PX, top: OFFSET_PX, size };
}

/* Frame model for a given square box; final badge uses flat/front view */
function frameForBoxFlat(obj, sizePx, pad = 1.12) {
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(dim.x, dim.y, dim.z);

  const dist = (maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) * pad;

  camera.position.set(center.x, center.y, center.z + dist); // front-on (flat)
  camera.near = Math.max(0.01, maxDim / 1000);
  camera.far = Math.max(50, dist * 10);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  renderer.setSize(sizePx, sizePx, false);
}

/* ===== Intro timeline (Arc Glide) ===== */
let t0 = 0;
let introDone = false;
let pausedHover = false;

function startIntro() {
  const start = centerStartBox();
  const end = finalBadgeBox();

  // Start large, centered
  setCanvasBox(start.left, start.top, start.size);
  frameForBoxFlat(model, start.size, 1.05);

  // Subtle initial pose so it’s not rigid
  model.rotation.set(THREE.MathUtils.degToRad(1.5), 0, THREE.MathUtils.degToRad(-1));

  t0 = performance.now();
  introDone = false;

  requestAnimationFrame(loop);
}

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function loop(now) {
  const dt = Math.min(0.033, (now - (loop._last || now)) / 1000);
  loop._last = now;

  // Drift key light for rolling highlight (always on)
  const driftPhase = (now / 1000) / KEY_DRIFT_PERIOD * Math.PI * 2;
  const drift = Math.sin(driftPhase) * KEY_DRIFT_AMPL;
  key.position.set(2.6 * Math.cos(drift), 3.2, 2.1 * Math.sin(drift));
  key.lookAt(0, 0, 0);

  if (!introDone) {
    const elapsed = (now - t0) / 1000;
    const start = centerStartBox();
    const end = finalBadgeBox();

    // Flash pop (0–0.30s) + sparkle
    if (elapsed <= 0.30) {
      const t = elapsed / 0.30;
      key.intensity = 1.8 + t * 0.9;          // up to ~2.7
      rim.intensity = RIM_INTENSITY + t * 0.5;
      renderer.toneMappingExposure = 1.0 + t * 0.12;
    } else if (elapsed <= 0.42) {
      const t = (elapsed - 0.30) / 0.12;
      key.intensity = 2.7 - t * 0.9;          // ease back to ~1.8
      rim.intensity = (RIM_INTENSITY + 0.5) - t * 0.5;
      renderer.toneMappingExposure = 1.12 - t * 0.12;
    } else {
      key.intensity = 1.8;
      rim.intensity = RIM_INTENSITY;
      renderer.toneMappingExposure = 1.0;
    }

    // Arc Glide path (0.30–1.60s): bezier-ish via eased lerp
    const moveT = clamp01((elapsed - 0.30) / (1.60 - 0.30));
    const e = easeOutCubic(moveT);

    // Control a slight arc by biasing Y (up) a touch before settling
    const arcBias = Math.sin(e * Math.PI) * 0.12; // 0..~0.12
    const left = start.left + (end.left - start.left) * e;
    const top  = start.top  + (end.top  - start.top ) * (e * (1 - 0.10) + arcBias * 0.10);
    const size = start.size + (end.size - start.size) * e;

    setCanvasBox(left, top, size);
    renderer.setSize(size, size, false);
    camera.aspect = 1; camera.updateProjectionMatrix();

    // Clockwise spin across the entire intro (~90° total)
    if (model) {
      const totalYaw = THREE.MathUtils.degToRad(90) * clamp01(elapsed / INTRO_TIME);
      model.rotation.y = -totalYaw; // negative for clockwise in screen space
      // Gentle, **temporary** float while traveling so it never looks dead
      if (elapsed <= 1.6) {
        const bob = Math.sin(elapsed * Math.PI * 1.2) * 0.015;
        const tilt = Math.sin(elapsed * Math.PI * 0.8) * THREE.MathUtils.degToRad(1.2);
        model.position.y = bob;
        model.rotation.z = tilt * 0.6;
        model.rotation.x = tilt * 0.3;
      }
    }

    // Glint sweep during settle (1.60–2.00s)
    if (elapsed >= 1.60 && elapsed <= 2.00) {
      const t = (elapsed - 1.60) / 0.40;
      const phase = -THREE.MathUtils.degToRad(12) + t * THREE.MathUtils.degToRad(32);
      key.position.set(2.6 * Math.cos(phase), 3.2, 2.1 * Math.sin(phase));
    }

    // Land & lock
    if (elapsed >= INTRO_TIME) {
      const b = finalBadgeBox();
      setCanvasBox(b.left, b.top, b.size);
      // Flat/front framing for badge, no tilt, no bob
      if (model) {
        model.position.set(0, 0, 0);
        model.rotation.x = 0;
        model.rotation.z = 0;
      }
      frameForBoxFlat(model, b.size, 1.12);
      introDone = true;
    }
  } else {
    // BADGE STATE — continuous clockwise spin (no bob, no tilt)
    const target = badgeSize();
    if (Math.abs(canvas.clientWidth - target) > 1) {
      renderer.setSize(target, target, false);
      const b = finalBadgeBox();
      setCanvasBox(b.left, b.top, b.size);
      camera.aspect = 1; camera.updateProjectionMatrix();
      frameForBoxFlat(model, b.size, 1.12);
    }
    if (!pausedHover && model) {
      model.rotation.y -= SPIN_BADGE_RPS * dt; // clockwise
      // keep flat
      model.rotation.x = 0;
      model.rotation.z = 0;
      model.position.y = 0;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

/* Hover pause (desktop only) */
canvas.addEventListener('mouseenter', () => { pausedHover = true; });
canvas.addEventListener('mouseleave', () => { pausedHover = false; });

/* Resize: keep badge crisp and in place */
window.addEventListener('resize', () => {
  if (!introDone) return;
  const b = finalBadgeBox();
  setCanvasBox(b.left, b.top, b.size);
  renderer.setSize(b.size, b.size, false);
  camera.aspect = 1; camera.updateProjectionMatrix();
  frameForBoxFlat(model, b.size, 1.12);
});

/* ===== utilities ===== */
function badgeSize(){ return isTiny() ? BADGE_PX_TINY : BADGE_PX; }
function isTiny(){ return window.innerWidth < TINY_BP; }

