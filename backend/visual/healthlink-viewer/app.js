// ═══════════════════════════════════════════════════════════════════
// HealthLink — 3D Anatomical Viewer (app.js)
// Full-screen overlay architecture with Chat + Anatomy panels
// [RN: This file maps to the following React Native modules:]
//   - App.jsx (root navigator)
//   - screens/ViewerScreen.jsx (3D canvas + overlays)
//   - screens/ChatScreen.jsx (chat overlay)
//   - screens/AnatomyPanel.jsx (anatomy overlay)
//   - utils/zoneDetection.js (classifyVertex, getNormalizedPoint)
//   - services/clinicalData.js (fetchZoneData)
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ─── Debug Mode ───
let ZONE_DEBUG = true;

// ═══════════════════════════════════════════════════════════════════
// [RN: config/anatomyRegions.js] — Region Definitions
// ═══════════════════════════════════════════════════════════════════
const ANATOMY_REGIONS = [
  { id: 'cranium',     category: 'Head & Neck', label: 'Cranium / Brain',        icon: '🧠', color: 0xA78BFA, queryName: 'Brain' },
  { id: 'face',        category: 'Head & Neck', label: 'Face / Maxillofacial',   icon: '👁️', color: 0xC4B5FD, queryName: 'Face' },
  { id: 'neck',        category: 'Head & Neck', label: 'Neck / Cervical',        icon: '🦴', color: 0x818CF8, queryName: 'Neck' },
  { id: 'heart',       category: 'Cardiopulmonary', label: 'Heart',              icon: '❤️', color: 0xF87171, queryName: 'Heart' },
  { id: 'left_lung',   category: 'Cardiopulmonary', label: 'Left Lung',          icon: '🫁', color: 0x60A5FA, queryName: 'Left Lung' },
  { id: 'right_lung',  category: 'Cardiopulmonary', label: 'Right Lung',         icon: '🫁', color: 0x60A5FA, queryName: 'Right Lung' },
  { id: 'stomach',     category: 'Digestive System', label: 'Stomach',           icon: '🍽️', color: 0x34D399, queryName: 'Stomach' },
  { id: 'liver',       category: 'Digestive System', label: 'Liver',             icon: '🩸', color: 0x6EE7B7, queryName: 'Liver' },
  { id: 'intestines',  category: 'Digestive System', label: 'Intestines / Pelvis', icon: '🔄', color: 0x34D399, queryName: 'Intestines' },
  { id: 'pectorals',   category: 'Musculoskeletal', label: 'Pectoralis Major',   icon: '💪', color: 0xFBBF24, queryName: 'Pectorals' },
  { id: 'abdominals',  category: 'Musculoskeletal', label: 'Rectus Abdominis',   icon: '🛡️', color: 0xF59E0B, queryName: 'Abdominals' },
  { id: 'trapezius',   category: 'Musculoskeletal', label: 'Trapezius',          icon: '🦴', color: 0xFBBF24, queryName: 'Trapezius' },
  { id: 'lats',        category: 'Musculoskeletal', label: 'Latissimus Dorsi',   icon: '🦴', color: 0xF59E0B, queryName: 'Lats' },
  { id: 'glutes',      category: 'Musculoskeletal', label: 'Gluteus Maximus',    icon: '🦴', color: 0xD97706, queryName: 'Glutes' },
  { id: 'left_shoulder',  category: 'Upper Limbs', label: 'Left Deltoid',        icon: '🦾', color: 0x38BDF8, queryName: 'Left Shoulder' },
  { id: 'right_shoulder', category: 'Upper Limbs', label: 'Right Deltoid',       icon: '🦾', color: 0x38BDF8, queryName: 'Right Shoulder' },
  { id: 'left_arm',    category: 'Upper Limbs', label: 'Left Bicep / Tricep',    icon: '💪', color: 0x0EA5E9, queryName: 'Left Arm' },
  { id: 'right_arm',   category: 'Upper Limbs', label: 'Right Bicep / Tricep',   icon: '💪', color: 0x0EA5E9, queryName: 'Right Arm' },
  { id: 'left_forearm', category: 'Upper Limbs', label: 'Left Forearm',          icon: '✋', color: 0x7DD3FC, queryName: 'Left Forearm' },
  { id: 'right_forearm', category: 'Upper Limbs', label: 'Right Forearm',        icon: '✋', color: 0x7DD3FC, queryName: 'Right Forearm' },
  { id: 'left_thigh',  category: 'Lower Limbs', label: 'Left Quadricep / Hamstring', icon: '🦵', color: 0xA3E635, queryName: 'Left Thigh' },
  { id: 'right_thigh', category: 'Lower Limbs', label: 'Right Quadricep / Hamstring', icon: '🦵', color: 0xA3E635, queryName: 'Right Thigh' },
  { id: 'left_calf',   category: 'Lower Limbs', label: 'Left Calf / Shin',      icon: '🦵', color: 0x84CC16, queryName: 'Left Calf' },
  { id: 'right_calf',  category: 'Lower Limbs', label: 'Right Calf / Shin',     icon: '🦵', color: 0x84CC16, queryName: 'Right Calf' },
  { id: 'left_foot',   category: 'Lower Limbs', label: 'Left Foot / Ankle',     icon: '👟', color: 0x65A30D, queryName: 'Left Foot' },
  { id: 'right_foot',  category: 'Lower Limbs', label: 'Right Foot / Ankle',    icon: '👟', color: 0x65A30D, queryName: 'Right Foot' },
];

// ═══════════════════════════════════════════════════════════════════
// [RN: services/clinicalData.js] — Data Fetching
// ═══════════════════════════════════════════════════════════════════
let clinicalData = null;

async function fetchZoneData(zoneId) {
  const region = ANATOMY_REGIONS.find(r => r.id === zoneId);
  if (!region) return null;
  if (!clinicalData) {
    try {
      const response = await fetch('/visual/healthlink-viewer/data.json');
      clinicalData = await response.json();
    } catch (err) {
      console.error('Failed to load data.json', err);
      return null;
    }
  }
  return clinicalData[region.queryName] || null;
}

// ═══════════════════════════════════════════════════════════════════
// Three.js Scene Setup [RN: uses expo-three + GLView]
// ═══════════════════════════════════════════════════════════════════
let scene, camera, renderer, controls, model;
let raycaster, mouse;
let autoRotate = true;
let activeZone = null;
let hoveredZone = null;
let isLoadingZone = false;
let modelBounds = null;

const canvas = document.getElementById('three-canvas');
const container = document.getElementById('canvas-container');
const tooltip = document.getElementById('zone-tooltip');
const progressFill = document.getElementById('progress-fill');

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0B0E14);
  scene.fog = new THREE.Fog(0x0B0E14, 120, 280);

  // Full-screen canvas — no sidebar offset
  const aspect = window.innerWidth / (window.innerHeight - 56);
  camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 500);
  camera.position.set(0, 50, 150);
  camera.lookAt(0, 50, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight - 56);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 55, 0);
  controls.minDistance = 40;
  controls.maxDistance = 180;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.0;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.minPolarAngle = Math.PI * 0.15;

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  setupLighting();
  loadModel();
  addEnvironment();
  setupEvents();
  renderDirectoryList();
  setupChat();
  createDebugHUD();
  animate();
}

function setupLighting() {
  scene.add(new THREE.AmbientLight(0x8B95A8, 0.8));
  scene.add(new THREE.HemisphereLight(0xC4B5FD, 0x1E293B, 0.9));
  const keyLight = new THREE.DirectionalLight(0xFFF1E6, 1.8);
  keyLight.position.set(30, 80, 50); keyLight.castShadow = true; scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xA5B4FC, 0.9);
  fillLight.position.set(-25, 50, -30); scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0x7C5CFC, 0.7);
  rimLight.position.set(-10, 30, -60); scene.add(rimLight);
  const frontFill = new THREE.DirectionalLight(0xE8E0FF, 0.6);
  frontFill.position.set(0, 50, 70); scene.add(frontFill);
  const underLight = new THREE.PointLight(0x7C5CFC, 0.5, 80);
  underLight.position.set(0, 30, 20); scene.add(underLight);
}

function addEnvironment() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x0B0E14, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = 18;
  ground.receiveShadow = true; scene.add(ground);
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 18, 2, 64),
    new THREE.MeshStandardMaterial({ color: 0x161B28, roughness: 0.6, metalness: 0.3 })
  );
  pedestal.position.y = 19; pedestal.receiveShadow = true; scene.add(pedestal);
}

function loadModel() {
  const loader = new OBJLoader();
  const textureLoader = new THREE.TextureLoader();
  const texturePath = '/visual/ekershe-male/textures/';
  const modelPath = '/visual/ekershe-male/source/Ekershe_Sasha_lp.obj';

  const loadTex = (file) => new Promise(r => textureLoader.load(texturePath + file, t => { t.colorSpace = THREE.SRGBColorSpace; r(t); }, undefined, () => r(null)));
  const loadTexLin = (file) => new Promise(r => textureLoader.load(texturePath + file, t => { t.colorSpace = THREE.LinearSRGBColorSpace; r(t); }, undefined, () => r(null)));

  Promise.all([
    loadTex('Ekershe_Sasha_albedo_3dc.jpg'),
    loadTexLin('wire_023023023_normal.png'),
    loadTexLin('wire_023023023_roughness.jpg'),
    loadTexLin('wire_023023023_AO.jpg'),
    loadTexLin('wire_023023023_metallic.jpg'),
  ]).then(([albedo, normal, roughness, ao, metallic]) => {
    progressFill.style.width = '50%';
    loader.load(modelPath, (obj) => {
      progressFill.style.width = '90%';
      model = obj;
      model.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            map: albedo, normalMap: normal, roughnessMap: roughness, aoMap: ao, metalnessMap: metallic,
            roughness: 0.55, metalness: 0.15, envMapIntensity: 0.8,
          });
          child.castShadow = true; child.receiveShadow = true;
          const geom = child.geometry;
          if (geom && geom.attributes.position) {
            const posAttr = geom.attributes.position;
            const colors = new Float32Array(posAttr.count * 3).fill(1);
            geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          }
        }
      });

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      model.scale.setScalar(60 / Math.max(size.x, size.y, size.z));

      const box2 = new THREE.Box3().setFromObject(model);
      const center2 = box2.getCenter(new THREE.Vector3());
      model.position.x = -center2.x;
      model.position.z = -center2.z;
      model.position.y = 20 - box2.min.y;

      scene.add(model);

      // Zoom-to-fit
      const finalBox = new THREE.Box3().setFromObject(model);
      const finalSize = finalBox.getSize(new THREE.Vector3());
      const finalCenter = finalBox.getCenter(new THREE.Vector3());
      controls.target.copy(finalCenter);
      const fovRad = camera.fov * (Math.PI / 180);
      const vDist = (finalSize.y / 2) / Math.tan(fovRad / 2);
      const hDist = (finalSize.x / 2) / Math.tan((fovRad * camera.aspect) / 2);
      const camDist = Math.max(vDist, hDist) * 1.25;
      camera.position.set(finalCenter.x, finalCenter.y, finalCenter.z + camDist);

      cacheModelBounds();
      progressFill.style.width = '100%';
      setTimeout(() => document.getElementById('loading-overlay').classList.add('hidden'), 500);
    });
  });
}

function cacheModelBounds() {
  let gMinX = Infinity, gMaxX = -Infinity;
  let gMinY = Infinity, gMaxY = -Infinity;
  let gMinZ = Infinity, gMaxZ = -Infinity;
  model.traverse((child) => {
    if (!child.isMesh) return;
    const pos = child.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (x < gMinX) gMinX = x; if (x > gMaxX) gMaxX = x;
      if (y < gMinY) gMinY = y; if (y > gMaxY) gMaxY = y;
      if (z < gMinZ) gMinZ = z; if (z > gMaxZ) gMaxZ = z;
    }
  });
  modelBounds = {
    minX: gMinX, maxX: gMaxX, minY: gMinY, maxY: gMaxY, minZ: gMinZ, maxZ: gMaxZ,
    height: gMaxY - gMinY, width: gMaxX - gMinX, depth: gMaxZ - gMinZ,
    centerX: (gMinX + gMaxX) / 2, centerZ: (gMinZ + gMaxZ) / 2,
  };
  if (ZONE_DEBUG) {
    console.log('%c[Model Bounds]', 'color: #34D399; font-weight:bold;');
    console.log(`  X: ${gMinX.toFixed(2)} → ${gMaxX.toFixed(2)}  Y: ${gMinY.toFixed(2)} → ${gMaxY.toFixed(2)}  Z: ${gMinZ.toFixed(2)} → ${gMaxZ.toFixed(2)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// [RN: utils/zoneDetection.js] — Hierarchical Y+X+Z Detection
// ═══════════════════════════════════════════════════════════════════
function getNormalizedPoint(worldPoint) {
  if (!modelBounds) return null;
  const localPoint = model.worldToLocal(worldPoint.clone());
  const b = modelBounds;
  return {
    x: (localPoint.x - b.centerX) / b.width,
    y: (localPoint.y - b.minY) / b.height,
    z: (localPoint.z - b.centerZ) / b.depth,
  };
}

function getZoneAtPoint(intersect) {
  if (!intersect || !model || !modelBounds) return null;
  const p = getNormalizedPoint(intersect.point);
  if (!p) return null;
  const nY = p.y, nX = p.x, nZ = p.z;
  if (ZONE_DEBUG) {
    console.log(`%c[Zone] nY=${nY.toFixed(3)} nX=${nX.toFixed(3)} nZ=${nZ.toFixed(3)}`, 'color: #7C5CFC; font-weight: bold;');
    updateDebugHUD(nY, nX, nZ, null);
  }
  const zoneId = classifyVertex(nY, nX, nZ);
  if (ZONE_DEBUG) updateDebugHUD(nY, nX, nZ, zoneId);
  return zoneId;
}

function classifyVertex(nY, nX, nZ) {
  const absX = Math.abs(nX);
  if (nY > 0.88) return nZ > 0.02 ? 'face' : 'cranium';
  if (nY > 0.82) return 'neck';
  if (absX > 0.22) {
    if (nY > 0.72) return nX < 0 ? 'left_shoulder' : 'right_shoulder';
    if (nY > 0.55) return nX < 0 ? 'left_arm' : 'right_arm';
    return nX < 0 ? 'left_forearm' : 'right_forearm';
  }
  if (nY > 0.65) {
    if (nZ > 0) { if (absX < 0.07) return 'heart'; return 'pectorals'; }
    return 'trapezius';
  }
  if (nY > 0.52) {
    if (nZ > 0) { if (absX < 0.10) return 'abdominals'; if (nX < 0) return 'liver'; return 'stomach'; }
    return 'lats';
  }
  if (nY > 0.45) return nZ > 0 ? 'intestines' : 'glutes';
  if (nY > 0.22) return nX < 0 ? 'left_thigh' : 'right_thigh';
  if (nY > 0.07) return nX < 0 ? 'left_calf' : 'right_calf';
  return nX < 0 ? 'left_foot' : 'right_foot';
}

// ═══════════════════════════════════════════════════════════════════
// Debug HUD
// ═══════════════════════════════════════════════════════════════════
let debugHUD = null;
function createDebugHUD() {
  if (!ZONE_DEBUG) return;
  debugHUD = document.createElement('div');
  debugHUD.id = 'debug-hud';
  debugHUD.style.cssText = `position:absolute;top:64px;left:8px;z-index:45;background:rgba(11,14,20,0.92);border:1px solid rgba(124,92,252,0.3);border-radius:8px;padding:10px 14px;font-family:'Cascadia Code',monospace;font-size:12px;color:#A5B4FC;pointer-events:none;min-width:230px;backdrop-filter:blur(8px);`;
  debugHUD.innerHTML = `<div style="color:#7C5CFC;font-weight:700;margin-bottom:4px;">🎯 Debug HUD</div><div>Y: <span id="hud-y">—</span></div><div>X: <span id="hud-x">—</span></div><div>Z: <span id="hud-z">—</span></div><div style="margin-top:6px;color:#34D399;">Detected: <span id="hud-zone" style="font-weight:700;color:#FCD34D;">—</span></div><div style="margin-top:4px;color:#64748B;font-size:10px;">Press D to toggle</div>`;
  container.appendChild(debugHUD);
}
function updateDebugHUD(nY, nX, nZ, zoneId) {
  if (!debugHUD) return;
  document.getElementById('hud-y').textContent = nY.toFixed(4);
  document.getElementById('hud-x').textContent = nX.toFixed(4);
  document.getElementById('hud-z').textContent = nZ.toFixed(4);
  if (zoneId) {
    const region = ANATOMY_REGIONS.find(r => r.id === zoneId);
    document.getElementById('hud-zone').textContent = region ? region.label : zoneId;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Zone Highlighting [RN: handled by expo-three shader]
// ═══════════════════════════════════════════════════════════════════
function highlightZone(zoneId) {
  if (!model || !modelBounds) return;
  const region = ANATOMY_REGIONS.find(r => r.id === zoneId);
  if (!region) return;
  const zoneColor = new THREE.Color(region.color);
  const b = modelBounds;
  model.traverse((child) => {
    if (!child.isMesh) return;
    const geom = child.geometry;
    const posAttr = geom.attributes.position;
    const colorAttr = geom.attributes.color;
    if (!posAttr || !colorAttr) return;
    for (let i = 0; i < posAttr.count; i++) {
      const nX = (posAttr.getX(i) - b.centerX) / b.width;
      const nY = (posAttr.getY(i) - b.minY) / b.height;
      const nZ = (posAttr.getZ(i) - b.centerZ) / b.depth;
      if (classifyVertex(nY, nX, nZ) === zoneId) {
        colorAttr.setXYZ(i, 0.4 + zoneColor.r * 0.6, 0.4 + zoneColor.g * 0.6, 0.4 + zoneColor.b * 0.6);
      } else {
        colorAttr.setXYZ(i, 1, 1, 1);
      }
    }
    colorAttr.needsUpdate = true;
    child.material.vertexColors = true;
    child.material.needsUpdate = true;
  });
}

function clearHighlight() {
  if (!model) return;
  model.traverse((child) => {
    if (!child.isMesh) return;
    const colorAttr = child.geometry.attributes.color;
    if (!colorAttr) return;
    for (let i = 0; i < colorAttr.count; i++) colorAttr.setXYZ(i, 1, 1, 1);
    colorAttr.needsUpdate = true;
    child.material.vertexColors = false;
    child.material.needsUpdate = true;
  });
}


// ═══════════════════════════════════════════════════════════════════
// [RN: components/AnatomyDirectory.jsx] — Directory + Detail UI
// ═══════════════════════════════════════════════════════════════════
function renderDirectoryList() {
  const listEl = document.getElementById('directory-list');
  const categories = {};
  for (const reg of ANATOMY_REGIONS) {
    if (!categories[reg.category]) categories[reg.category] = [];
    categories[reg.category].push(reg);
  }
  let html = '';
  for (const [cat, items] of Object.entries(categories)) {
    html += `<div class="directory-category"><div class="directory-category-title">${cat}</div>`;
    for (const item of items) {
      html += `<div class="directory-item" data-id="${item.id}" style="color: #${item.color.toString(16).padStart(6, '0')}">
        <div class="directory-icon">${item.icon}</div>
        <div class="directory-name">${item.label}</div>
      </div>`;
    }
    html += `</div>`;
  }
  listEl.innerHTML = html;
  document.querySelectorAll('.directory-item').forEach(el => {
    el.addEventListener('click', () => selectZone(el.dataset.id));
  });
}

async function selectZone(zoneId) {
  if (isLoadingZone || !zoneId) return;
  isLoadingZone = true;
  activeZone = zoneId;

  const urlParams = new URLSearchParams(window.location.search);
  const isWebContainer = urlParams.get('source') === 'rnweb';

  // React Native Integration
  if (window.ReactNativeWebView || isWebContainer) {
    const msg = JSON.stringify({ type: 'ZONE_CLICK', zoneId: zoneId });
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    else if (window.parent) window.parent.postMessage(msg, '*');
    
    highlightZone(zoneId);
    isLoadingZone = false;
    return;
  }

  // Open the overlay panel (HTML fallback)
  openOverlayPanel();

  document.querySelectorAll('.directory-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === zoneId);
  });

  document.getElementById('anatomy-directory').style.display = 'none';
  document.getElementById('zone-detail').classList.remove('hidden');
  document.getElementById('entity-loading').classList.remove('hidden');
  document.getElementById('entity-content').classList.add('hidden');

  highlightZone(zoneId);

  const data = await fetchZoneData(zoneId);
  const regionInfo = ANATOMY_REGIONS.find(r => r.id === zoneId);

  if (regionInfo) {
    document.getElementById('detail-icon').textContent = regionInfo.icon;
    document.getElementById('detail-category').textContent = regionInfo.category;
    document.getElementById('detail-name').textContent = regionInfo.label;

    const statsSection = document.getElementById('stats-section');
    if (data && data.stats && data.stats.length > 0) {
      statsSection.style.display = 'block';
      document.getElementById('stat-grid').innerHTML = data.stats.map(s => `
        <div class="stat-card">
          <div class="stat-label">${s.label}</div>
          <div class="stat-value">${s.value}<span class="stat-unit">${s.unit}</span></div>
          <div class="stat-trend ${s.trend}">${s.trendText}</div>
        </div>`).join('');
    } else {
      statsSection.style.display = 'none';
    }

    renderEntities(data);
    document.getElementById('entity-loading').classList.add('hidden');
    document.getElementById('entity-content').classList.remove('hidden');
  }
  isLoadingZone = false;
}

window.selectZone = selectZone;

function renderEntities(data) {
  const container = document.getElementById('entity-list');
  if (!data || (!data.medications?.length && !data.diagnostics?.length && !data.other?.length)) {
    container.innerHTML = '<p class="no-entities">No clinical records found for this region.</p>';
    return;
  }
  let html = '';
  const renderGroup = (title, icon, items) => {
    if (!items || items.length === 0) return '';
    return `<div class="entity-group">
      <div class="entity-group-header">
        <span class="entity-group-icon">${icon}</span>
        <span class="entity-group-title">${title.toUpperCase()}</span>
        <span class="entity-group-count">${items.length}</span>
      </div>
      ${items.map(name => `
        <div class="entity-card"><div class="entity-main">
          <div class="entity-info"><span class="entity-name">${name}</span></div>
          <div class="entity-meta">
            <span class="entity-status status-active">ACTIVE</span>
            <span class="entity-date">Current</span>
          </div>
        </div></div>`).join('')}
    </div>`;
  };
  html += renderGroup('Diagnostics', '🩺', data.diagnostics);
  html += renderGroup('Medications', '💊', data.medications);
  html += renderGroup('Other Records', '📋', data.other);
  container.innerHTML = html;
}

function deselectZone() {
  activeZone = null;
  document.querySelectorAll('.directory-item').forEach(c => c.classList.remove('active'));
  document.getElementById('anatomy-directory').style.display = 'block';
  document.getElementById('zone-detail').classList.add('hidden');
  clearHighlight();
}


// ═══════════════════════════════════════════════════════════════════
// [RN: navigation/overlayManager.js] — Overlay Panel Management
// ═══════════════════════════════════════════════════════════════════
const overlayPanel = document.getElementById('overlay-panel');
const chatOverlay = document.getElementById('chat-overlay');
const chatFab = document.getElementById('btn-chat');

function openOverlayPanel() {
  overlayPanel.classList.remove('overlay-hidden');
  chatFab.classList.add('dimmed');
}

function closeOverlayPanel() {
  overlayPanel.classList.add('overlay-hidden');
  chatFab.classList.remove('dimmed');
  deselectZone();
}

function openChat() {
  chatOverlay.classList.remove('overlay-hidden');
  chatFab.classList.add('hidden-fab');
  // Close anatomy panel if open
  overlayPanel.classList.add('overlay-hidden');
  document.getElementById('chat-input').focus();
}

function closeChat() {
  chatOverlay.classList.add('overlay-hidden');
  chatFab.classList.remove('hidden-fab');
  chatFab.classList.remove('dimmed');
}


// ═══════════════════════════════════════════════════════════════════
// [RN: screens/ChatScreen.jsx] — Chat Logic (wired to backend /chat API)
// ═══════════════════════════════════════════════════════════════════

function setupChat() {
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');

  // Welcome message
  addMessage('bot', "Hello! 👋 I'm your HealthLink assistant. Ask me anything about your health records, or click on the 3D model to explore specific body regions.");

  // FAB click
  chatFab.addEventListener('click', openChat);

  // Close buttons
  document.getElementById('btn-chat-close').addEventListener('click', closeChat);
  document.getElementById('btn-panel-close').addEventListener('click', closeOverlayPanel);

  // Backdrop click for chat
  chatOverlay.addEventListener('click', (e) => {
    if (e.target === chatOverlay) closeChat();
  });

  // Backdrop click for overlay panel
  overlayPanel.addEventListener('click', (e) => {
    if (e.target === overlayPanel) closeOverlayPanel();
  });

  // Send message
  document.getElementById('btn-chat-send').addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  addMessage('user', text);
  input.value = '';

  // Show typing indicator
  const chatMessages = document.getElementById('chat-messages');
  const typingEl = document.createElement('div');
  typingEl.className = 'typing-indicator';
  typingEl.innerHTML = '<span></span><span></span><span></span>';
  chatMessages.appendChild(typingEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const resp = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, user_phone: '' }),
    });
    const data = await resp.json();
    typingEl.remove();
    addMessage('bot', data.reply || 'Sorry, I could not process that.');
  } catch (err) {
    typingEl.remove();
    addMessage('bot', 'Error connecting to backend. Please try again.');
  }
}

function addMessage(role, text) {
  const chatMessages = document.getElementById('chat-messages');
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const msgEl = document.createElement('div');
  msgEl.className = `chat-msg ${role}`;
  msgEl.innerHTML = `${text}<span class="msg-time">${time}</span>`;
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}


// ═══════════════════════════════════════════════════════════════════
// Event Listeners
// ═══════════════════════════════════════════════════════════════════
function setupEvents() {
  document.getElementById('btn-back').addEventListener('click', () => {
    deselectZone();
    // Keep overlay open showing directory
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    closeOverlayPanel();
    if (model) {
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      controls.target.copy(center);
      const fovRad = camera.fov * (Math.PI / 180);
      const vDist = (size.y / 2) / Math.tan(fovRad / 2);
      const hDist = (size.x / 2) / Math.tan((fovRad * camera.aspect) / 2);
      camera.position.set(center.x, center.y, center.z + Math.max(vDist, hDist) * 1.25);
    }
  });

  document.getElementById('btn-auto-rotate').addEventListener('click', (e) => {
    autoRotate = !autoRotate;
    controls.autoRotate = autoRotate;
    e.currentTarget.classList.toggle('active', autoRotate);
  });

  window.addEventListener('message', (event) => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data.type === 'SELECT_ZONE' && data.zoneId && window.selectZone) {
        window.selectZone(data.zoneId);
      } else if (data.type === 'CLEAR_HIGHLIGHT') {
        if (window.clearHighlight) window.clearHighlight();
        if (controls) controls.autoRotate = true;
        activeZone = null;
      }
    } catch(e) {}
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
      if (debugHUD) debugHUD.style.display = debugHUD.style.display === 'none' ? 'block' : 'none';
    }
    if (e.key === 'Escape') {
      if (!chatOverlay.classList.contains('overlay-hidden')) closeChat();
      else if (!overlayPanel.classList.contains('overlay-hidden')) closeOverlayPanel();
    }
  });

  renderer.domElement.addEventListener('click', onCanvasClick);
  renderer.domElement.addEventListener('mousemove', onCanvasHover);
  
  // Touch support
  renderer.domElement.addEventListener('touchstart', onCanvasHover, {passive: true});
  renderer.domElement.addEventListener('touchend', (e) => {
    // Prevent default click from double firing if touchend handles it, 
    // but in mobile webviews 'click' often fails or delays.
    onCanvasClick(e);
  }, {passive: true});

  window.addEventListener('resize', onResize);
}

function onCanvasClick(event) {
  updateMouse(event);
  raycaster.setFromCamera(mouse, camera);
  if (model) {
    const meshes = [];
    model.traverse(c => { if (c.isMesh) meshes.push(c); });
    const intersects = raycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      const zoneId = getZoneAtPoint(intersects[0]);
      if (zoneId) selectZone(zoneId);
    }
  }
}

function onCanvasHover(event) {
  updateMouse(event);
  raycaster.setFromCamera(mouse, camera);
  if (model) {
    const meshes = [];
    model.traverse(c => { if (c.isMesh) meshes.push(c); });
    const intersects = raycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      const zoneId = getZoneAtPoint(intersects[0]);
      if (zoneId && zoneId !== hoveredZone) {
        hoveredZone = zoneId;
        const region = ANATOMY_REGIONS.find(r => r.id === zoneId);
        tooltip.textContent = region ? region.label : zoneId;
        tooltip.classList.remove('hidden');
        renderer.domElement.style.cursor = 'pointer';
        if (!activeZone) highlightZone(zoneId);
      }
      tooltip.style.left = (event.clientX + 15) + 'px';
      tooltip.style.top = (event.clientY - 10) + 'px';
    } else {
      hoveredZone = null;
      tooltip.classList.add('hidden');
      renderer.domElement.style.cursor = 'grab';
      if (!activeZone) clearHighlight();
    }
  }
}

window.clearHighlight = clearHighlight;
window.controls = controls;

function updateMouse(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  let clientX = event.clientX;
  let clientY = event.clientY;
  
  if (event.changedTouches && event.changedTouches.length > 0) {
    clientX = event.changedTouches[0].clientX;
    clientY = event.changedTouches[0].clientY;
  } else if (event.touches && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  }
  
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight - 56;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

init();
