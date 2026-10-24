import * as THREE from 'three';
import {
  SHELL_VERTEX_SHADER,
  SHELL_FRAGMENT_SHADER,
  STRAND_VERTEX_SHADER,
  STRAND_FRAGMENT_SHADER
} from './furShaders.js';
import { evaluateFollicleMask, evaluateGroomFlow } from './blobCreature.js';

export function createGPUFurSystem(initialBaseGeometry, initialState) {
  const furGroup = new THREE.Group();
  furGroup.name = 'GPUFurSystem';

  const SHELL_COUNT = 64;
  const STRAND_COUNT = 60000;

  const sharedUniforms = {
    uTime: { value: 0 },
    uFurLength: { value: initialState.furLength },
    uFurDensity: { value: initialState.furDensity },
    uRoughness: { value: initialState.roughness },
    uSpecular: { value: initialState.specular },
    uClumping: { value: initialState.clumping },
    uCurliness: { value: initialState.curliness },
    uWindStrength: { value: initialState.windStrength },
    uWearAmount: { value: initialState.wearAmount ?? 0.35 },
    uCharType: { value: initialState.charType ?? 0 },
    uRenderMode: { value: initialState.renderMode || 0 },
    uCursorTool: { value: initialState.cursorTool || 0 },
    uLensChannel: { value: initialState.lensChannel || 1 },
    uHighlightZone: { value: initialState.highlightZone || 0 },
    uBaseColor: { value: new THREE.Color(initialState.baseColor) },
    uTipColor: { value: new THREE.Color(initialState.tipColor) },
    uMaskColor: { value: new THREE.Color(initialState.maskColor || '#f1f5f9') },
    uCoreColor: { value: new THREE.Color(initialState.coreColor || '#0f172a') },
    uKeyLightDir: { value: new THREE.Vector3(2.4, 3.2, 2.8).normalize() },
    uKeyLightColor: { value: new THREE.Color('#f8fafc') },
    uKeyLightIntensity: { value: initialState.lightIntensity },
    uRimLightDir: { value: new THREE.Vector3(-2.6, 2.0, -2.5).normalize() },
    uRimLightColor: { value: new THREE.Color('#7dd3fc') },
    uRimIntensity: { value: initialState.rimIntensity },
    uAmbientIntensity: { value: 0.56 },
    uEnvSkyColor: { value: new THREE.Color('#38bdf8') },
    uEnvGroundColor: { value: new THREE.Color('#090b10') },
    uEnvTintStrength: { value: 0.25 },
    uPointerLocalPos: { value: new THREE.Vector3(0, 0, 99) },
    uPointerLocalVel: { value: new THREE.Vector3(0, 0, 0) },
    uPointerActive: { value: 0.0 },
    uShockwaveOrigin: { value: new THREE.Vector3(0, 0, 0) },
    uShockwaveTime: { value: -10.0 },
    uInertia: { value: new THREE.Vector3(0, 0, 0) },
    uBreathPhase: { value: 0.0 },
    uActionSurge: { value: 0.0 },
    uSimPosTex: { value: null },
    uUseGPUSim: { value: 0.0 }
  };

  const shellMaterial = new THREE.ShaderMaterial({
    vertexShader: SHELL_VERTEX_SHADER,
    fragmentShader: SHELL_FRAGMENT_SHADER,
    uniforms: sharedUniforms,
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide
  });

  const strandMaterial = new THREE.ShaderMaterial({
    vertexShader: STRAND_VERTEX_SHADER,
    fragmentShader: STRAND_FRAGMENT_SHADER,
    uniforms: sharedUniforms,
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide
  });

  // Reusable ribbon template geometry for instanced strands
  const SEGMENTS_Y = 7;
  const ribbonTemplate = new THREE.BufferGeometry();
  const ribbonVerts = [];
  const ribbonCoords = [];
  const ribbonIndices = [];

  for (let i = 0; i <= SEGMENTS_Y; i++) {
    const t = i / SEGMENTS_Y;
    ribbonVerts.push(-0.5, t, 0);
    ribbonCoords.push(-1.0, t);

    ribbonVerts.push(0.5, t, 0);
    ribbonCoords.push(1.0, t);
  }

  for (let i = 0; i < SEGMENTS_Y; i++) {
    const row = i * 2;
    ribbonIndices.push(row, row + 1, row + 2);
    ribbonIndices.push(row + 1, row + 3, row + 2);
  }

  let shellMesh = null;
  let strandMesh = null;

  function buildMeshesFromBase(baseGeometry) {
    if (shellMesh) {
      furGroup.remove(shellMesh);
      shellMesh.geometry.dispose();
    }
    if (strandMesh) {
      furGroup.remove(strandMesh);
      strandMesh.geometry.dispose();
    }

    // 1. Volumetric Shell Mesh (64 Shells)
    const shellGeometry = new THREE.InstancedBufferGeometry();
    shellGeometry.index = baseGeometry.index;
    shellGeometry.setAttribute('position', baseGeometry.attributes.position);
    shellGeometry.setAttribute('normal', baseGeometry.attributes.normal);
    if (baseGeometry.attributes.uv) {
      shellGeometry.setAttribute('uv', baseGeometry.attributes.uv);
    }
    if (baseGeometry.attributes.aFollicleMask) {
      shellGeometry.setAttribute('aFollicleMask', baseGeometry.attributes.aFollicleMask);
    }
    if (baseGeometry.attributes.aGroomDir) {
      shellGeometry.setAttribute('aGroomDir', baseGeometry.attributes.aGroomDir);
    }
    if (baseGeometry.attributes.aSurfaceZone) {
      shellGeometry.setAttribute('aSurfaceZone', baseGeometry.attributes.aSurfaceZone);
    }
    shellGeometry.instanceCount = SHELL_COUNT;

    const shellFractions = new Float32Array(SHELL_COUNT);
    for (let i = 0; i < SHELL_COUNT; i++) {
      shellFractions[i] = (i + 1) / SHELL_COUNT;
    }
    shellGeometry.setAttribute(
      'aShellFraction',
      new THREE.InstancedBufferAttribute(shellFractions, 1)
    );

    shellMesh = new THREE.Mesh(shellGeometry, shellMaterial);
    shellMesh.frustumCulled = false;
    shellMesh.renderOrder = 1;
    furGroup.add(shellMesh);

    // 2. 60,000 Guard Hair Strands + Cloak Frayed Edge Fibers + Mask Contour Fuzz
    const strandGeometry = new THREE.InstancedBufferGeometry();
    strandGeometry.setIndex(ribbonIndices);
    strandGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(ribbonVerts, 3)
    );
    strandGeometry.setAttribute(
      'aStrandCoord',
      new THREE.Float32BufferAttribute(ribbonCoords, 2)
    );
    strandGeometry.instanceCount = STRAND_COUNT;

    const nonIndexed = baseGeometry.index
      ? baseGeometry.toNonIndexed()
      : baseGeometry.clone();
    const posAttr = nonIndexed.attributes.position;
    const normAttr = nonIndexed.attributes.normal;
    const zoneAttr = nonIndexed.attributes.aSurfaceZone;
    const maskAttr = nonIndexed.attributes.aFollicleMask;
    const triCount = Math.floor(posAttr.count / 3);

    const aA = new THREE.Vector3();
    const bB = new THREE.Vector3();
    const cC = new THREE.Vector3();
    const edge1 = new THREE.Vector3();
    const edge2 = new THREE.Vector3();
    const crossVec = new THREE.Vector3();

    const cumulativeAreas = new Float32Array(triCount);
    const triData = new Array(triCount);
    let totalWeightedArea = 0;

    for (let t = 0; t < triCount; t++) {
      const i0 = t * 3;
      aA.fromBufferAttribute(posAttr, i0);
      bB.fromBufferAttribute(posAttr, i0 + 1);
      cC.fromBufferAttribute(posAttr, i0 + 2);

      edge1.subVectors(bB, aA);
      edge2.subVectors(cC, aA);
      crossVec.crossVectors(edge1, edge2);
      const area = 0.5 * crossVec.length();

      const cx = (aA.x + bB.x + cC.x) / 3;
      const cy = (aA.y + bB.y + cC.y) / 3;
      const cz = (aA.z + bB.z + cC.z) / 3;

      const avgZone = zoneAttr
        ? (zoneAttr.getX(i0) + zoneAttr.getX(i0 + 1) + zoneAttr.getX(i0 + 2)) / 3
        : 2.0;
      const avgMask = maskAttr
        ? (maskAttr.getX(i0) + maskAttr.getX(i0 + 1) + maskAttr.getX(i0 + 2)) / 3
        : evaluateFollicleMask(cx, cy, cz, avgZone);

      let zonePriority = 1.0;
      if (avgZone > 1.5 && avgZone < 2.5) {
        const isHem = cy < -0.45 ? 1.85 : 1.15;
        zonePriority = isHem;
      } else if (avgZone < 1.5) {
        zonePriority = 0.85;
      } else if (avgZone >= 2.5 && avgZone < 3.5) {
        zonePriority = 1.05;
      } else {
        zonePriority = 0.45;
      }

      const weight = area * Math.pow(Math.max(0.0, avgMask), 1.45) * zonePriority;
      totalWeightedArea += weight;
      cumulativeAreas[t] = totalWeightedArea;

      triData[t] = {
        ax: aA.x, ay: aA.y, az: aA.z,
        bx: bB.x, by: bB.y, bz: bB.z,
        cx: cC.x, cy: cC.y, cz: cC.z,
        nax: normAttr.getX(i0), nay: normAttr.getY(i0), naz: normAttr.getZ(i0),
        nbx: normAttr.getX(i0 + 1), nby: normAttr.getY(i0 + 1), nbz: normAttr.getZ(i0 + 2),
        ncx: normAttr.getX(i0 + 2), ncy: normAttr.getY(i0 + 2), ncz: normAttr.getZ(i0 + 2),
        zone: avgZone
      };
    }

    const strandRoots = new Float32Array(STRAND_COUNT * 3);
    const strandNormals = new Float32Array(STRAND_COUNT * 3);
    const strandSeeds = new Float32Array(STRAND_COUNT * 4);
    const strandGrooms = new Float32Array(STRAND_COUNT * 3);
    const strandZones = new Float32Array(STRAND_COUNT);

    function pickTriangle(r) {
      let low = 0;
      let high = triCount - 1;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (cumulativeAreas[mid] < r) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      return low;
    }

    let seedState = 133742;
    function pseudoRandom() {
      seedState = (seedState * 1664525 + 1013904223) >>> 0;
      return seedState / 4294967296;
    }

    for (let s = 0; s < STRAND_COUNT; s++) {
      const rArea = pseudoRandom() * totalWeightedArea;
      const triIdx = pickTriangle(rArea);
      const tri = triData[triIdx];

      let u = pseudoRandom();
      let v = pseudoRandom();
      if (u + v > 1.0) {
        u = 1.0 - u;
        v = 1.0 - v;
      }
      const w = 1.0 - u - v;

      const rx = w * tri.ax + u * tri.bx + v * tri.cx;
      const ry = w * tri.ay + u * tri.by + v * tri.cy;
      const rz = w * tri.az + u * tri.bz + v * tri.cz;

      let nx = w * tri.nax + u * tri.nbx + v * tri.ncx;
      let ny = w * tri.nay + u * tri.nby + v * tri.ncy;
      let nz = w * tri.naz + u * tri.nbz + v * tri.ncz;
      const nLen = Math.hypot(nx, ny, nz) || 1.0;
      nx /= nLen;
      ny /= nLen;
      nz /= nLen;

      const idx3 = s * 3;
      strandRoots[idx3] = rx;
      strandRoots[idx3 + 1] = ry;
      strandRoots[idx3 + 2] = rz;

      strandNormals[idx3] = nx;
      strandNormals[idx3 + 1] = ny;
      strandNormals[idx3 + 2] = nz;

      const groom = evaluateGroomFlow(rx, ry, rz, nx, ny, nz, tri.zone);
      strandGrooms[idx3] = groom[0];
      strandGrooms[idx3 + 1] = groom[1];
      strandGrooms[idx3 + 2] = groom[2];

      strandZones[s] = tri.zone;

      const idx4 = s * 4;
      strandSeeds[idx4] = pseudoRandom();
      strandSeeds[idx4 + 1] = pseudoRandom();
      strandSeeds[idx4 + 2] = pseudoRandom();
      strandSeeds[idx4 + 3] = pseudoRandom();
    }

    nonIndexed.dispose();

    strandGeometry.setAttribute(
      'aStrandRoot',
      new THREE.InstancedBufferAttribute(strandRoots, 3)
    );
    strandGeometry.setAttribute(
      'aStrandNormal',
      new THREE.InstancedBufferAttribute(strandNormals, 3)
    );
    strandGeometry.setAttribute(
      'aStrandSeed',
      new THREE.InstancedBufferAttribute(strandSeeds, 4)
    );
    strandGeometry.setAttribute(
      'aStrandGroom',
      new THREE.InstancedBufferAttribute(strandGrooms, 3)
    );
    strandGeometry.setAttribute(
      'aStrandZone',
      new THREE.InstancedBufferAttribute(strandZones, 1)
    );

    strandMesh = new THREE.Mesh(strandGeometry, strandMaterial);
    strandMesh.frustumCulled = false;
    strandMesh.renderOrder = 2;
    furGroup.add(strandMesh);
  }

  buildMeshesFromBase(initialBaseGeometry);

  function updateUniforms(state, elapsed, lightDir, rimDir, inertiaVec, breathPhase, actionSurge = 0) {
    sharedUniforms.uTime.value = elapsed;
    sharedUniforms.uFurLength.value = state.furLength;
    sharedUniforms.uFurDensity.value = state.furDensity;
    sharedUniforms.uRoughness.value = state.roughness;
    sharedUniforms.uSpecular.value = state.specular;
    sharedUniforms.uClumping.value = state.clumping;
    sharedUniforms.uCurliness.value = state.curliness;
    sharedUniforms.uWindStrength.value = state.windStrength;
    sharedUniforms.uWearAmount.value = state.wearAmount ?? 0.35;
    sharedUniforms.uCharType.value = state.charType ?? 0;
    sharedUniforms.uRenderMode.value = state.renderMode || 0;
    sharedUniforms.uCursorTool.value = state.cursorTool || 0;
    sharedUniforms.uLensChannel.value = state.lensChannel || 1;
    sharedUniforms.uHighlightZone.value = state.highlightZone || 0;
    sharedUniforms.uBaseColor.value.set(state.baseColor);
    sharedUniforms.uTipColor.value.set(state.tipColor);
    if (state.maskColor) sharedUniforms.uMaskColor.value.set(state.maskColor);
    if (state.coreColor) sharedUniforms.uCoreColor.value.set(state.coreColor);
    sharedUniforms.uKeyLightIntensity.value = state.lightIntensity;
    sharedUniforms.uRimIntensity.value = state.rimIntensity;
    sharedUniforms.uKeyLightDir.value.copy(lightDir);
    sharedUniforms.uRimLightDir.value.copy(rimDir);
    sharedUniforms.uInertia.value.copy(inertiaVec);
    sharedUniforms.uBreathPhase.value = breathPhase;
    sharedUniforms.uActionSurge.value = actionSurge;

    // Hide fur shells & guard strands when inspecting Clean Topology Reference (mode 4)
    const showFur = (state.renderMode || 0) < 3.5;
    if (shellMesh) shellMesh.visible = showFur;
    if (strandMesh) strandMesh.visible = showFur;
  }

  function setPointerInteraction(localPos, localVel, active) {
    sharedUniforms.uPointerLocalPos.value.copy(localPos);
    sharedUniforms.uPointerLocalVel.value.copy(localVel);
    sharedUniforms.uPointerActive.value = active;
  }

  function triggerShockwave(localOrigin, currentTime) {
    sharedUniforms.uShockwaveOrigin.value.copy(localOrigin);
    sharedUniforms.uShockwaveTime.value = currentTime;
  }

  return {
    furGroup,
    sharedUniforms,
    updateUniforms,
    setPointerInteraction,
    triggerShockwave,
    rebuildForGeometry: buildMeshesFromBase
  };
}
