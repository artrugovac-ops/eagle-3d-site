import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // not used interactively, but handy for dev
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/* ===== DOM ===== */
const canvas = document.getElementById('eagle-canvas');
const dprDesktop = 1.75;
const dprMobile  = 1.5;

/* ===== Badge constants ===== */
const BADGE_SIZE_DESKTOP = 180;        // px — same on desktop & mobile
const BADGE_SIZE_TINY    = 148;        // px — only if viewport < 360px
const BADGE_OFFSET       = 20;         // px from top/left
const TINY_BREAKPOINT    = 360;        // px viewport width
const SPIN_SPEED_BADGE   = THREE.MathUtils.degToRad(0.18); // rad/s ~1 rev / ~33s
const LIGHT_DRIFT_AMPL   = THREE.MathUtils.degToRad(6);    // ±6° over 10s
const LIGHT_DRIFT_PERIOD = 10.0;       // seconds

/* ===== Render setup ===== */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const isTiny = () => window.innerWidth < TINY_BREAKPOINT;
const badgeSize = () => (isTiny() ? BADGE_SIZE_TINY : BADGE_SIZE_DESKTOP);

renderer.setPixelRatio(Math.min(window.devicePixelRatio, /Mobi|Android/i.test(navigator.userAgent) ? dprMobile : dprDesktop));
renderer.setSize(badgeSize(), badgeSize(), false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
// No shadows in badge mode (perf-friendly)
renderer.shadowMap.enabled = false;

/* ===== Scene ===== */
const scene = new THREE.Scene();
scene.background = null; // alpha true → blends over page

/* Camera */
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 2000);
camera.position.set(0.8, 0.7, 1.4);

/* Controls (dev only, disabled by default) */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false;

/* Lights */
const hemi = new THREE.HemisphereLight(0xffffff, 0x111122, 0.9);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.25);
key.position.set(2.5, 3.4, 2.0);
scene.add(key);

/* Subtle floor (off for badge transparency) */
// (No floor — we want clean chrome on transparent page)

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
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false; o.receiveShadow = false;
        if (o.material && o.material.metalness !== undefined) {
          // Make chrome pop
          o.material.metalness = 0.9;
          o.material.roughness = 0.25;
        }
      }
    });
    scene.add(model);
    onModelReady();
  },
  undefined,
  (err) => {
    console.error('Failed to load model:', err);
  }
);

/* ===== Layout helpers: animate canvas to badge ===== */
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
  return { left: BADGE_OFFSET, top: BADGE_OFFSET, size };
}

/* ===== Framing: compute camera distance for badge box ===== */
function frameForBox(obj, sizePx) {
  // Fit model comfortably within the canvas box
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(dim.x, dim.y, dim.z);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  // Factor (~1.15) leaves some negative space in the badge
  const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.15;
  // Update camera Z relative to target center
  const center = box.getCenter(new THREE.Vector3());
  camera.position.copy(center).add(new THREE.Vector3(distance * 0.7, distance * 0.6, distance * 0.9));
  camera.near = Math.max(0.01, maxDim / 1000);
  camera.far = Math.max(50, distance * 10);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  // Also size renderer to the box
  renderer.setSize(sizePx, sizePx, false);
}

/* ===== Intro timeline (2.0s) ===== */
let t0 = performance.now();
let introDone = false;
let pausedHover = false;

function onModelReady() {
  // Initial: center big & close
  const start = centerStartBox();
  setCanvasBox(start.left, start.top, start.size);

  // Pre-frame for the start size (we'll keep camera close; feels big)
  frameForBox(model, start.size);

  // Small hover feel at start
  floatingPhase = Math.random() * Math.PI * 2; // randomize starting phase

  // Flash pop & sparkle (handled in render loop with time)
  t0 = performance.now();
  introDone = false;

  // Kick the loop
  requestAnimationFrame(tick);
}

/* ===== Floating (badge) motion ===== */
let floatingPhase = 0;

/* ===== Render loop ===== */
function tick(now) {
  const dt = Math.min(0.033, (now - (tick._last || now)) / 1000); // clamp dt
  tick._last = now;
  const elapsed = (now - t0) / 1000;

  // LIGHT DRIFT for chrome shine
  const drift = Math.sin(now / 1000 / LIGHT_DRIFT_PERIOD * Math.PI * 2) * LIGHT_DRIFT_AMPL;
  key.position.set(2.5 * Math.cos(drift), 3.4, 2.0 * Math.sin(drift));
  key.lookAt(0, 0, 0);

  if (!introDone) {
    // Phases:
    // 0.00–0.30s: flash pop + sparkle + start hover
    // 0.30–1.60s: travel from center to top-left + size down + rotate ~90°
    // 1.60–2.00s: settle + glint sweep
    const start = centerStartBox();
    const end   = finalBadgeBox();

    // Lerp helper
    const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
    const clamp01 = (x) => Math.max(0, Math.min(1, x));

    // 0.30 → 1.60
    const moveStart = 0.30, moveEnd = 1.60;
    const moveT = clamp01((elapsed - moveStart) / (moveEnd - moveStart));
    const e = easeOutCubic(moveT);

    const left = start.left + (end.left - start.left) * e;
    const top  = start.top  + (end.top  - start.top ) * e;
    const size = start.size + (end.size - start.size) * e;

    setCanvasBox(left, top, size);
    renderer.setSize(size, size, false);
    camera.aspect = 1; camera.updateProjectionMatrix();

    // Rotate ~90° over full 0 → 2s
    const totalSpin = THREE.MathUtils.degToRad(90);
    if (model) model.rotation.y = totalSpin * clamp01(elapsed / 2.0);

    // Hover bob + micro tilt during intro so it doesn't look stagnant
    if (model) {
      floatingPhase += dt * (Math.PI * 2 / 8); // 8s cycle
      const bob = Math.sin(floatingPhase) * 0.02; // ~2cm bob
      const tilt = Math.sin(floatingPhase * 0.5) * THREE.MathUtils.degToRad(1.5);
      model.position.y = bob;
      model.rotation.z = tilt * 0.7;
      model.rotation.x = tilt * 0.3;
    }

    // Flash pop (0–0.30s) & glint sweep (1.60–2.00s)
    if (elapsed <= 0.30) {
      key.intensity = 1.25 + (elapsed / 0.30) * 0.5; // ramp to 1.75
      renderer.toneMappingExposure = 1.0 + (elapsed / 0.30) * 0.1; // slight pop
    } else if (elapsed <= 0.40) {
      // quick drop back
      key.intensity = 1.25 + (1 - (elapsed - 0.30) / 0.10) * 0.5;
      renderer.toneMappingExposure = 1.1 - (elapsed - 0.30) / 0.10 * 0.1;
    } else {
      key.intensity = 1.25;
      renderer.toneMappingExposure = 1.0;
    }

    // Glint sweep at settle
    if (elapsed >= 1.60 && elapsed <= 2.00) {
      const sweep = (elapsed - 1.60) / 0.40; // 0..1
      const extra = THREE.MathUtils.degToRad(12); // quick +12° sweep
      const phase = -LIGHT_DRIFT_AMPL + sweep * (2 * LIGHT_DRIFT_AMPL + extra);
      key.position.set(2.5 * Math.cos(phase), 3.4, 2.0 * Math.sin(phase));
    }

    if (elapsed >= 2.0) {
      // Lock into final badge state
      const endBox = finalBadgeBox();
      setCanvasBox(endBox.left, endBox.top, endBox.size);
      frameForBox(model, endBox.size);
      introDone = true;
    }
  } else {
    // BADGE STATE — continuous slow spin + float
    if (!pausedHover && model) {
      model.rotation.y += SPIN_SPEED_BADGE * dt;
      floatingPhase += dt * (Math.PI * 2 / 8); // 8s cycle
      const bob = Math.sin(floatingPhase) * 0.02; // ~2cm bob
      const tilt = Math.sin(floatingPhase * 0.5) * THREE.MathUtils.degToRad(1.5);
      model.position.y = bob;
      model.rotation.z = tilt * 0.7;
      model.rotation.x = tilt * 0.3;
    }

    // Keep renderer sized to badge in case device rotates
    const targetSize = badgeSize();
    const currentW = canvas.clientWidth;
    if (Math.abs(currentW - targetSize) > 1) {
      renderer.setSize(targetSize, targetSize, false);
      const endBox = finalBadgeBox();
      setCanvasBox(endBox.left, endBox.top, targetSize);
      camera.aspect = 1; camera.updateProjectionMatrix();
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* ===== Hover pause (desktop only) ===== */
canvas.addEventListener('mouseenter', () => { pausedHover = true; });
canvas.addEventListener('mouseleave', () => { pausedHover = false; });

/* ===== Resize handling ===== */
window.addEventListener('resize', () => {
  if (!introDone) return; // intro lerps layout every frame anyway
  const end = finalBadgeBox();
  setCanvasBox(end.left, end.top, end.size);
  renderer.setSize(end.size, end.size, false);
  camera.aspect = 1; camera.updateProjectionMatrix();
});
