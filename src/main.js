import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createBlobCreature } from './blobCreature.js';
import { createGPUFurPhysics } from './gpuPhysics.js';
import { createGPUFurSystem } from './furSystem.js';
import { createEnvironmentManager } from './environments.js';
import { initUI } from './ui.js';
import { CHARACTER_SPECS, getCharacterSpecById } from './characterSpecs.js';

const initialSpec = getCharacterSpecById('the_knight');

const simState = {
  environment: 'studio',
  viewMode: 'turnaround', // 'turnaround' | 'three_quarter' | 'front' | 'side'
  renderMode: 0, // 0=Final Render, 1=Groom Map, 2=Displacement Map, 3=SSS Map, 4=Topology
  cursorTool: 0, // 0=Comb, 1=Wind Vortex, 2=Lore Action, 3=Light Wand, 4=X-Ray Lens
  lensChannel: 1, // 1=Groom, 2=Disp, 3=SSS, 4=Topo
  highlightZone: 0, // 0=All, 1=Mask, 2=Cloak, 3=Body, 4=Core/Weapon
  characterId: initialSpec.character_id,
  ...initialSpec.simPreset,
  lightAngle: -48,
  lightIntensity: 1.42,
  rimIntensity: 1.75
};

const container = document.getElementById('canvas-container');
const uiRoot = document.getElementById('ui-root');
const hudHint = document.getElementById('hud-hint');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  34,
  window.innerWidth / window.innerHeight,
  0.1,
  65
);
camera.position.set(-1.95, 0.36, 3.15);

const turnaroundAngles = [
  0.0, // Column 0: Front View (0°)
  -Math.PI * 0.2, // Column 1: Three-Quarter View (-36°)
  Math.PI * 0.5 // Column 2: Side Profile View (+90°)
];
const turnaroundCamRadius = 4.05;
const turnaroundCamHeight = 0.22;
const turnaroundTarget = new THREE.Vector3(0, 0.14, 0);

const turnaroundCameras = turnaroundAngles.map((az) => {
  const cam = new THREE.PerspectiveCamera(31, 1, 0.1, 65);
  cam.position.set(
    Math.sin(az) * turnaroundCamRadius,
    turnaroundCamHeight,
    Math.cos(az) * turnaroundCamRadius
  );
  cam.lookAt(turnaroundTarget);
  return cam;
});

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 1.85;
controls.maxDistance = 6.2;
controls.minPolarAngle = Math.PI * 0.18;
controls.maxPolarAngle = Math.PI * 0.78;
controls.target.set(0, 0.14, 0);

let desiredCameraPos = null;

function setSingleCameraAngle(mode) {
  const r = 3.65;
  const y = 0.28;
  if (mode === 'front') {
    desiredCameraPos = new THREE.Vector3(0.0, y, r);
  } else if (mode === 'side') {
    desiredCameraPos = new THREE.Vector3(r, y, 0.0);
  } else if (mode === 'three_quarter') {
    const az = -Math.PI * 0.2;
    desiredCameraPos = new THREE.Vector3(Math.sin(az) * r, y, Math.cos(az) * r);
  } else {
    desiredCameraPos = null;
  }
}

// 3-Point Studio Lighting Setup
const ambientLight = new THREE.HemisphereLight(0x38bdf8, 0x090b10, 0.56);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xf8fafc, simState.lightIntensity);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x7dd3fc, simState.rimIntensity);
scene.add(rimLight);

// Ground Shadow Receiver
const shadowGeo = new THREE.PlaneGeometry(5.2, 5.2);
const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = 128;
shadowCanvas.height = 128;
const sCtx = shadowCanvas.getContext('2d');
const grad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
grad.addColorStop(0, 'rgba(3, 5, 10, 0.65)');
grad.addColorStop(0.55, 'rgba(3, 5, 10, 0.24)');
grad.addColorStop(1, 'rgba(3, 5, 10, 0.0)');
sCtx.fillStyle = grad;
sCtx.fillRect(0, 0, 128, 128);

const shadowTex = new THREE.CanvasTexture(shadowCanvas);
const shadowMat = new THREE.MeshBasicMaterial({
  map: shadowTex,
  transparent: true,
  depthWrite: false
});
const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = -0.92;
scene.add(shadowPlane);

// Initialize Multi-Character Hollow Knight Rig + GPGPU Verlet Fur Physics + 60,000 Strands
const creature = createBlobCreature(simState.characterId, simState);
scene.add(creature.root);

// 3D Interactive Tool Ring Indicator (Visualizes X-Ray Lens, Light Wand, or Wind Vortex on surface)
const cursorRingGeo = new THREE.RingGeometry(0.39, 0.42, 48);
const cursorRingMat = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  transparent: true,
  opacity: 0.0,
  side: THREE.DoubleSide,
  depthTest: false
});
const cursorRingMesh = new THREE.Mesh(cursorRingGeo, cursorRingMat);
cursorRingMesh.renderOrder = 10;
creature.bodyGroup.add(cursorRingMesh);

const gpuPhysics = createGPUFurPhysics(renderer);

const furSystem = createGPUFurSystem(creature.furBaseMesh.geometry, simState);
creature.bodyGroup.add(furSystem.furGroup);

if (gpuPhysics.supported) {
  furSystem.sharedUniforms.uUseGPUSim.value = 1.0;
  furSystem.sharedUniforms.uSimPosTex.value = gpuPhysics.getTexture();
}

const envManager = createEnvironmentManager(scene, camera, renderer);

const lightDir = new THREE.Vector3();
const rimDir = new THREE.Vector3();

function updateLightingVectors() {
  const rad = (simState.lightAngle * Math.PI) / 180;
  lightDir.set(Math.cos(rad) * 3.2, 2.7, Math.sin(rad) * 3.2).normalize();
  keyLight.position.copy(lightDir).multiplyScalar(6);
  keyLight.intensity = simState.lightIntensity;

  rimDir.set(-lightDir.x * 0.92, 1.55, -lightDir.z * 0.92).normalize();
  rimLight.position.copy(rimDir).multiplyScalar(5);
  rimLight.intensity = simState.rimIntensity;
}
updateLightingVectors();

// Raycaster & Pointer Grooming / Tool State
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(0, 0);
const prevPointerLocal = new THREE.Vector3();
const currPointerLocal = new THREE.Vector3(0, 0, 99);
const pointerLocalVel = new THREE.Vector3();
let isPointerOnCreature = false;
let hasInteracted = false;

const prevCameraPos = new THREE.Vector3().copy(camera.position);
const cameraVelocity = new THREE.Vector3();
const springInertia = new THREE.Vector3();
const springVelocity = new THREE.Vector3();

let uiController = null;

function applyEnvironmentSelection(envId) {
  const preset = envManager.setEnvironment(envId, {
    onArFallback() {
      if (hudHint) {
        hudHint.textContent = 'Camera unavailable — remaining in Studio Reference Backdrop';
        hudHint.classList.remove('hidden');
      }
      if (uiController) {
        uiController.setEnvironmentActive(envManager.getActiveId());
      }
    }
  });

  simState.environment = envManager.getActiveId();
  simState.lightAngle = preset.lightAngle;
  simState.lightIntensity = preset.lightIntensity;
  simState.rimIntensity = preset.rimIntensity;
  simState.windStrength = preset.windStrength;

  keyLight.color.set(preset.keyColor);
  rimLight.color.set(preset.rimColor);
  ambientLight.color.set(preset.hemiSkyColor);
  ambientLight.groundColor.set(preset.hemiGroundColor);
  ambientLight.intensity = preset.ambientIntensity;

  furSystem.sharedUniforms.uKeyLightColor.value.set(preset.keyColor);
  furSystem.sharedUniforms.uRimLightColor.value.set(preset.rimColor);
  furSystem.sharedUniforms.uAmbientIntensity.value = preset.ambientIntensity;
  furSystem.sharedUniforms.uEnvSkyColor.value.set(preset.hemiSkyColor);
  furSystem.sharedUniforms.uEnvGroundColor.value.set(preset.hemiGroundColor);
  furSystem.sharedUniforms.uEnvTintStrength.value = preset.envTintStrength;

  shadowPlane.visible = Boolean(preset.showGroundShadow);
  updateLightingVectors();

  if (uiController) {
    uiController.setEnvironmentActive(simState.environment);
    uiController.syncSlidersFromState();
  }
}

uiController = initUI(
  uiRoot,
  simState,
  () => {
    updateLightingVectors();
  },
  (actionType) => {
    const now = performance.now() * 0.001;
    if (actionType === 'resetGroom') {
      gpuPhysics.reset();
      furSystem.triggerShockwave(new THREE.Vector3(0, 0, 0.8), now);
    } else if (actionType === 'characterAction') {
      creature.triggerCharacterAction();
      furSystem.triggerShockwave(new THREE.Vector3(0, 0.1, 0.6), now);
    }
  },
  (selectedEnvId) => {
    applyEnvironmentSelection(selectedEnvId);
  },
  (selectedViewMode) => {
    setSingleCameraAngle(selectedViewMode);
  },
  (characterId, spec) => {
    const newGeom = creature.setCharacter(characterId, spec.simPreset);
    furSystem.rebuildForGeometry(newGeom);
    gpuPhysics.reset();
    furSystem.triggerShockwave(new THREE.Vector3(0, 0.15, 0.65), performance.now() * 0.001);
  }
);

applyEnvironmentSelection('studio');

if (hudHint) {
  hudHint.textContent =
    'Keys 1–8: Switch Lore Characters · Q/W/E/R/T: Interactive Tools (Brush, Wind Vortex, Action, Light Wand, X-Ray Lens) · Click/Drag on any view';
}

// Keyboard Shortcuts for instant interactivity
window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
    return;
  }
  const key = e.key.toUpperCase();
  if (key >= '1' && key <= '8') {
    const idx = parseInt(key, 10) - 1;
    if (CHARACTER_SPECS[idx] && uiController) {
      uiController.selectCharacterById(CHARACTER_SPECS[idx].character_id);
    }
  } else if (key === 'Q' && uiController) {
    uiController.setCursorTool(0);
  } else if (key === 'W' && uiController) {
    uiController.setCursorTool(1);
  } else if (key === 'E' && uiController) {
    uiController.setCursorTool(2);
    creature.triggerCharacterAction();
    furSystem.triggerShockwave(new THREE.Vector3(0, 0.1, 0.6), performance.now() * 0.001);
  } else if (key === 'R' && uiController) {
    uiController.setCursorTool(3);
  } else if (key === 'T' && uiController) {
    uiController.setCursorTool(4);
  } else if (e.code === 'Space') {
    e.preventDefault();
    creature.triggerCharacterAction();
    furSystem.triggerShockwave(new THREE.Vector3(0, 0.1, 0.6), performance.now() * 0.001);
  } else if (e.key === 'Escape' && uiController) {
    uiController.toggleJsonModal(false);
  }
});

function getActiveRayCameraAndNDC(clientX, clientY) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (simState.viewMode === 'turnaround' && simState.environment === 'studio') {
    const colW = w / 3;
    const colIndex = Math.min(2, Math.max(0, Math.floor(clientX / colW)));
    const localX = clientX - colIndex * colW;
    const ndcX = (localX / colW) * 2 - 1;
    const ndcY = -(clientY / h) * 2 + 1;
    return {
      rayCam: turnaroundCameras[colIndex],
      ndc: new THREE.Vector2(ndcX, ndcY)
    };
  }

  return {
    rayCam: camera,
    ndc: new THREE.Vector2((clientX / w) * 2 - 1, -(clientY / h) * 2 + 1)
  };
}

function handlePointerMove(clientX, clientY) {
  const { rayCam, ndc } = getActiveRayCameraAndNDC(clientX, clientY);
  pointerNDC.copy(ndc);

  raycaster.setFromCamera(ndc, rayCam);
  const hits = raycaster.intersectObject(creature.furBaseMesh, false);

  if (hits.length > 0) {
    const worldHit = hits[0].point.clone();
    const localHit = creature.bodyGroup.worldToLocal(worldHit);

    if (isPointerOnCreature) {
      pointerLocalVel.subVectors(localHit, prevPointerLocal).multiplyScalar(14.0);
      pointerLocalVel.clampLength(0, 3.0);
    } else {
      pointerLocalVel.set(0, 0, 0);
    }

    // Wind Vortex tool amplifies swirling velocity
    if (simState.cursorTool === 1) {
      const swirlVec = new THREE.Vector3(-localHit.z, 0.35, localHit.x)
        .normalize()
        .multiplyScalar(2.4);
      pointerLocalVel.add(swirlVec).clampLength(0, 3.5);
    }

    prevPointerLocal.copy(localHit);
    currPointerLocal.copy(localHit);
    isPointerOnCreature = true;

    // Position 3D tool ring on surface normal for X-Ray Lens, Light Wand, or Wind Vortex
    if (simState.cursorTool >= 1) {
      cursorRingMesh.position.copy(localHit);
      const localNormal = hits[0].face
        ? hits[0].face.normal.clone()
        : new THREE.Vector3(0, 0, 1);
      cursorRingMesh.lookAt(localHit.clone().add(localNormal));
      const toolColors = [0x38bdf8, 0x38bdf8, 0xf59e0b, 0xfef08a, 0x38bdf8];
      cursorRingMat.color.setHex(toolColors[simState.cursorTool] || 0x38bdf8);
      cursorRingMat.opacity = simState.cursorTool === 4 ? 0.65 : 0.35;
    } else {
      cursorRingMat.opacity = 0.0;
    }

    if (!hasInteracted && hudHint) {
      hasInteracted = true;
      setTimeout(() => {
        hudHint.classList.add('hidden');
      }, 4200);
    }
  } else {
    isPointerOnCreature = false;
    pointerLocalVel.multiplyScalar(0.85);
    cursorRingMat.opacity = 0.0;
  }
}

window.addEventListener('pointermove', (e) => {
  if (
    e.target &&
    (e.target.closest('#ui-root') ||
      e.target.closest('#scene-nav') ||
      e.target.closest('#page-nav') ||
      e.target.closest('#character-roster-dock') ||
      e.target.closest('#json-pipeline-modal'))
  ) {
    isPointerOnCreature = false;
    cursorRingMat.opacity = 0.0;
    return;
  }
  handlePointerMove(e.clientX, e.clientY);
});

window.addEventListener('pointerdown', (e) => {
  if (
    e.target &&
    (e.target.closest('#ui-root') ||
      e.target.closest('#scene-nav') ||
      e.target.closest('#page-nav') ||
      e.target.closest('#character-roster-dock') ||
      e.target.closest('.turnaround-col-expand') ||
      e.target.closest('#json-pipeline-modal'))
  ) {
    return;
  }
  handlePointerMove(e.clientX, e.clientY);
  if (isPointerOnCreature) {
    furSystem.triggerShockwave(currPointerLocal, performance.now() * 0.001);
    if (simState.cursorTool === 2) {
      creature.triggerCharacterAction();
    }
  }
});

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();

  const isTurnaroundSheet =
    simState.viewMode === 'turnaround' && simState.environment === 'studio';

  controls.enabled = !isTurnaroundSheet;

  if (!isTurnaroundSheet) {
    if (desiredCameraPos) {
      camera.position.lerp(desiredCameraPos, Math.min(1.0, dt * 7.5));
      if (camera.position.distanceTo(desiredCameraPos) < 0.02) {
        desiredCameraPos = null;
      }
    }
    controls.update();
  }

  cameraVelocity.subVectors(camera.position, prevCameraPos).divideScalar(Math.max(dt, 0.001));
  prevCameraPos.copy(camera.position);

  const targetInertia = cameraVelocity.clone().multiplyScalar(-0.045);
  targetInertia.clampLength(0, 0.35);

  const stiffness = 140.0;
  const damping = 12.0;
  const accel = targetInertia
    .sub(springInertia)
    .multiplyScalar(stiffness)
    .sub(springVelocity.clone().multiplyScalar(damping));
  springVelocity.addScaledVector(accel, dt);
  springInertia.addScaledVector(springVelocity, dt);

  envManager.update(dt, elapsed);

  const creatureAnim = creature.update(
    dt,
    elapsed,
    pointerNDC,
    isPointerOnCreature,
    {
      windStrength: simState.windStrength,
      wearAmount: simState.wearAmount,
      charType: simState.charType,
      renderMode: simState.renderMode || 0,
      cursorTool: simState.cursorTool || 0,
      lensChannel: simState.lensChannel || 1,
      highlightZone: simState.highlightZone || 0,
      baseColor: simState.baseColor,
      tipColor: simState.tipColor,
      maskColor: simState.maskColor,
      coreColor: simState.coreColor,
      lightIntensity: simState.lightIntensity,
      rimIntensity: simState.rimIntensity,
      lightDir,
      rimDir,
      inertiaVec: springInertia,
      keyLightColor: keyLight.color,
      rimLightColor: rimLight.color
    },
    currPointerLocal
  );

  pointerLocalVel.multiplyScalar(0.92);
  furSystem.setPointerInteraction(
    currPointerLocal,
    pointerLocalVel,
    isPointerOnCreature ? 1.0 : 0.0
  );

  if (gpuPhysics.supported) {
    const simTex = gpuPhysics.update(dt, elapsed, {
      windStrength: simState.windStrength,
      curliness: simState.curliness,
      inertia: springInertia,
      pointerLocalPos: currPointerLocal,
      pointerLocalVel,
      pointerActive: isPointerOnCreature ? 1.0 : 0.0,
      shockwaveOrigin: furSystem.sharedUniforms.uShockwaveOrigin.value,
      shockwaveTime: furSystem.sharedUniforms.uShockwaveTime.value
    });
    furSystem.sharedUniforms.uSimPosTex.value = simTex;
  }

  furSystem.updateUniforms(
    simState,
    elapsed,
    lightDir,
    rimDir,
    springInertia,
    creatureAnim.breathPhase,
    creatureAnim.actionSurge
  );

  const w = window.innerWidth;
  const h = window.innerHeight;

  const turnaroundOverlay = document.getElementById('turnaround-overlay');
  if (turnaroundOverlay) {
    turnaroundOverlay.classList.toggle('hidden', !isTurnaroundSheet);
  }

  if (isTurnaroundSheet) {
    renderer.setScissorTest(true);
    const colW = Math.floor(w / 3);

    for (let i = 0; i < 3; i++) {
      const x = i * colW;
      const curW = i === 2 ? w - x : colW;

      const cam = turnaroundCameras[i];
      cam.aspect = curW / h;
      cam.updateProjectionMatrix();

      renderer.setViewport(x, 0, curW, h);
      renderer.setScissor(x, 0, curW, h);
      renderer.render(scene, cam);
    }

    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
  } else {
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
    renderer.render(scene, camera);
  }
}

animate();
