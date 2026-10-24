import * as THREE from 'three';
import {
  KNIGHT_SURFACE_VERTEX_SHADER,
  KNIGHT_SURFACE_FRAGMENT_SHADER
} from './furShaders.js';

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3.0 - 2.0 * t);
}

/**
 * Evaluates follicle density and length weight across all 4 anatomical zones:
 * Zone 1.0 = Hard Chitin Shell / Mask / Crown: subtle micro-fiber rim fuzz along outer contours (0.14 .. 0.34).
 * Zone 2.0 = Soft-Body Cloak / Robes / Moth Wings: woven fabric fuzz (0.58) ramping up to 1.38 along frayed edges.
 * Zone 3.0 = Velvety Body / Limbs / Moth Mane: ultra-fine velvety nap (0.48) or dense Radiance moth mane (1.42).
 * Zone 4.0 = Infection Core / Gold Filigree / Props: subtle surface spore/dust fibers (0.24).
 */
export function evaluateFollicleMask(x, y, z, zone = 2.0) {
  if (zone < 1.5) {
    // Zone 1: Hard Mask / Crown — micro-fuzz concentrated on outer silhouette contours & horn ridges
    const radial = Math.hypot(x, z);
    const contourRim = smoothstep(0.18, 0.44, radial);
    const hornFuzz = smoothstep(0.52, 1.08, y) * 0.25;
    const eyeSocketCutout =
      z > 0.14
        ? 1.0 -
          0.92 *
            (Math.exp(-((x - 0.14) ** 2 + (y - 0.44) ** 2) / 0.011) +
              Math.exp(-((x + 0.14) ** 2 + (y - 0.44) ** 2) / 0.011))
        : 1.0;
    return Math.max(0.06, (0.13 + 0.21 * contourRim + hornFuzz) * Math.max(0.08, eyeSocketCutout));
  }

  if (zone < 2.5) {
    // Zone 2: Soft-Body Cloak / Silk / Burlap / Wings — dense fabric nap + long frayed edge strands at hem
    const hemProximity = smoothstep(-0.18, -0.58, y);
    const az = Math.atan2(x, z);
    const frayDag = 0.5 + 0.5 * Math.sin(az * 7.0 + Math.cos(az * 13.0) * 0.7);
    const collarFactor = smoothstep(0.28, 0.05, y);
    return 0.48 * collarFactor + hemProximity * (0.58 + 0.42 * frayDag);
  }

  if (zone < 3.5) {
    // Zone 3: Slender Limbs OR Plush Moth Mane (higher near chest y > -0.15 and radial > 0.24)
    const isMane = smoothstep(-0.15, 0.32, y) * smoothstep(0.18, 0.36, Math.hypot(x, z));
    return 0.44 + isMane * 0.88;
  }

  // Zone 4: Infection Sacs / Gold Filigree / Club Spikes
  return 0.22;
}

/**
 * Evaluates natural groom tangent flow vector for each anatomical zone.
 */
export function evaluateGroomFlow(x, y, z, nx, ny, nz, zone = 2.0) {
  let gx = 0.0;
  let gy = -0.68;
  let gz = -0.18;

  if (zone < 1.5) {
    // Mask micro-fibers sweep upward and outward toward the horn tips
    const rLen = Math.hypot(x, z) || 1.0;
    gx = (x / rLen) * 0.42;
    gy = y > 0.52 ? 0.88 : 0.48;
    gz = (z / rLen) * 0.25 - 0.2;
  } else if (zone < 2.5) {
    // Cloak & frayed hem fibers sweep downward along the drape pleats and flare outward at the hem
    const rLen = Math.hypot(x, z) || 1.0;
    const hemFlare = smoothstep(-0.22, -0.62, y);
    gx = (x / rLen) * (0.26 + 0.46 * hemFlare);
    gy = -0.92;
    gz = (z / rLen) * (0.26 + 0.46 * hemFlare) - 0.14;
  } else if (zone < 3.5) {
    // Velvety nap sweeps downward along limbs; outward & downward for chest mane
    const rLen = Math.hypot(x, z) || 1.0;
    gx = (x / rLen) * 0.35;
    gy = -0.82;
    gz = (z / rLen) * 0.35 - 0.12;
  } else {
    // Core / filigree radial outward bloom
    gx = nx * 0.65;
    gy = ny * 0.65 + 0.25;
    gz = nz * 0.65;
  }

  const dotGN = gx * nx + gy * ny + gz * nz;
  gx -= nx * dotGN;
  gy -= ny * dotGN;
  gz -= nz * dotGN;

  const len = Math.hypot(gx, gy, gz);
  if (len < 1e-4) return [0, -1, 0];
  return [gx / len, gy / len, gz / len];
}

function tagZoneAndAttributes(geom, zoneValue) {
  geom.computeVertexNormals();
  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  const count = pos.count;

  const masks = new Float32Array(count);
  const grooms = new Float32Array(count * 3);
  const zones = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = norm.getX(i);
    const ny = norm.getY(i);
    const nz = norm.getZ(i);

    zones[i] = zoneValue;
    masks[i] = evaluateFollicleMask(x, y, z, zoneValue);
    const g = evaluateGroomFlow(x, y, z, nx, ny, nz, zoneValue);
    grooms[i * 3] = g[0];
    grooms[i * 3 + 1] = g[1];
    grooms[i * 3 + 2] = g[2];
  }

  geom.setAttribute('aFollicleMask', new THREE.BufferAttribute(masks, 1));
  geom.setAttribute('aGroomDir', new THREE.BufferAttribute(grooms, 3));
  geom.setAttribute('aSurfaceZone', new THREE.BufferAttribute(zones, 1));
  return geom;
}

function mergeCharacterZones(geometries) {
  let totalVerts = 0;
  let totalIndices = 0;

  const indexedGeoms = geometries.map((g) => {
    if (!g.index) {
      const count = g.attributes.position.count;
      const idx = new Uint32Array(count);
      for (let i = 0; i < count; i++) idx[i] = i;
      g.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    totalVerts += g.attributes.position.count;
    totalIndices += g.index.count;
    return g;
  });

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const masks = new Float32Array(totalVerts);
  const grooms = new Float32Array(totalVerts * 3);
  const zones = new Float32Array(totalVerts);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  for (const g of indexedGeoms) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const uv = g.attributes.uv;
    const m = g.attributes.aFollicleMask;
    const gr = g.attributes.aGroomDir;
    const z = g.attributes.aSurfaceZone;
    const idx = g.index;
    const vCount = p.count;

    for (let i = 0; i < vCount; i++) {
      const dst3 = (vOffset + i) * 3;
      positions[dst3] = p.getX(i);
      positions[dst3 + 1] = p.getY(i);
      positions[dst3 + 2] = p.getZ(i);

      normals[dst3] = n.getX(i);
      normals[dst3 + 1] = n.getY(i);
      normals[dst3 + 2] = n.getZ(i);

      const dst2 = (vOffset + i) * 2;
      uvs[dst2] = uv ? uv.getX(i) : 0;
      uvs[dst2 + 1] = uv ? uv.getY(i) : 0;

      masks[vOffset + i] = m ? m.getX(i) : 0.5;
      zones[vOffset + i] = z ? z.getX(i) : 2.0;

      grooms[dst3] = gr ? gr.getX(i) : 0;
      grooms[dst3 + 1] = gr ? gr.getY(i) : -1;
      grooms[dst3 + 2] = gr ? gr.getZ(i) : 0;
    }

    for (let i = 0; i < idx.count; i++) {
      indices[iOffset + i] = idx.getX(i) + vOffset;
    }

    vOffset += vCount;
    iOffset += idx.count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setAttribute('aFollicleMask', new THREE.BufferAttribute(masks, 1));
  merged.setAttribute('aGroomDir', new THREE.BufferAttribute(grooms, 3));
  merged.setAttribute('aSurfaceZone', new THREE.BufferAttribute(zones, 1));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

// ============================================================================
// ZONE 1 BUILDERS: HEAD MASKS, HORNS, & CROWNS (Authentic Hollow Knight Wiki)
// ============================================================================
function buildMaskAndHorns(characterId) {
  const parts = [];

  // 1. Sculpted Head Mask Shell
  const headGeom = new THREE.SphereGeometry(0.35, 56, 44);
  const hPos = headGeom.attributes.position;

  for (let i = 0; i < hPos.count; i++) {
    let x = hPos.getX(i);
    let y = hPos.getY(i);
    let z = hPos.getZ(i);

    if (characterId === 'hornet') {
      // Hornet: Sleek, narrow, pointed chin mask
      const taper = y < 0 ? 0.68 + 0.32 * (1.0 + y / 0.35) : 0.94;
      x *= 0.88 * taper;
      y *= 1.02;
      z *= 0.84 * taper;
    } else if (characterId === 'the_hollow_knight') {
      // The Hollow Knight: Tall, narrow, angular mask with diagonal crack
      const taper = y < 0 ? 0.66 + 0.34 * (1.0 + y / 0.35) : 0.96;
      x *= 0.86 * taper;
      y *= 1.12;
      z *= 0.84 * taper;
      // Diagonal structural crack across left eye socket (x < 0, z > 0.1)
      if (z > 0.12 && x < 0.05) {
        const crackDist = Math.abs((y - 0.05) - (x + 0.14) * 1.45);
        if (crackDist < 0.024) {
          const depth = (1.0 - crackDist / 0.024) * 0.032;
          z -= depth;
        }
      }
    } else if (characterId === 'quirrel') {
      // Quirrel: Rounded explorer mask with subtle beak-like snout projection
      x *= 0.98;
      y *= 0.92;
      z *= 0.94;
      if (z > 0.1 && y < 0.06) {
        z += smoothstep(0.1, 0.35, z) * (1.0 - Math.abs(x) * 2.2) * 0.065;
      }
    } else if (characterId === 'cloth') {
      // Cloth: Large, stout cicada burlap hood-mask
      x *= 1.18;
      y *= 1.04;
      z *= 1.08;
    } else if (characterId === 'grimm') {
      // Troupe Master Grimm: Sharp, sculpted face split down the centerline
      const taper = y < 0 ? 0.65 + 0.35 * (1.0 + y / 0.35) : 0.95;
      x *= 0.88 * taper;
      y *= 1.04;
      z *= 0.86 * taper;
      // Center vertical cleft
      if (z > 0.15 && Math.abs(x) < 0.035) {
        z -= (1.0 - Math.abs(x) / 0.035) * 0.018;
      }
    } else if (characterId === 'the_pale_king') {
      // The Pale King: Narrow, regal monarch mask seamlessly rising into crown
      const taper = y < 0 ? 0.72 + 0.28 * (1.0 + y / 0.35) : 1.04;
      x *= 0.86 * taper;
      y *= 1.06;
      z *= 0.84 * taper;
    } else if (characterId === 'the_radiance') {
      // The Radiance: Angular blazing white carapace head
      x *= 0.96;
      y *= 0.95;
      z *= 0.88;
    } else {
      // The Knight: Iconic rounded-trapezoid Vessel mask
      const normY = y / 0.35;
      const jawTaper = normY < 0.0 ? 0.86 + 0.14 * (1.0 + normY) : 1.02 - 0.06 * normY;
      x *= 1.08 * jawTaper;
      y *= 0.94;
      z *= 0.88;
      if (z > 0.0) z = Math.pow(z / 0.308, 0.84) * 0.31;
    }

    // Concave eye-socket depressions on the front face
    if (z > 0.12 && characterId !== 'the_radiance') {
      const eyeX = characterId === 'hornet' || characterId === 'grimm' ? 0.125 : 0.138;
      const eyeY = -0.02;
      const rx = 0.095;
      const ry = characterId === 'cloth' ? 0.095 : 0.125;
      const dLeft = ((x + eyeX) / rx) ** 2 + ((y - eyeY) / ry) ** 2;
      const dRight = ((x - eyeX) / rx) ** 2 + ((y - eyeY) / ry) ** 2;
      const socketIndent =
        Math.exp(-dLeft * 1.45) * 0.082 + Math.exp(-dRight * 1.45) * 0.082;
      z -= socketIndent;
    }

    hPos.setXYZ(i, x, y + 0.46, z);
  }
  parts.push(tagZoneAndAttributes(headGeom, 1.0));

  // 2. Character-Specific Horns, Crowns, or Spikes
  if (characterId === 'the_knight') {
    for (const side of [-1, 1]) {
      const hornGeom = new THREE.CylinderGeometry(0.016, 0.092, 0.56, 28, 32, false);
      const hp = hornGeom.attributes.position;
      for (let i = 0; i < hp.count; i++) {
        let hx = hp.getX(i);
        let hy = hp.getY(i);
        let hz = hp.getZ(i);
        const t = (hy + 0.28) / 0.56;
        const archX =
          side *
          (0.185 + Math.sin(t * Math.PI * 0.76) * 0.135 - Math.pow(t, 2.5) * 0.11);
        const archY = 0.68 + t * 0.50;
        const archZ = -0.02 - Math.pow(t, 1.6) * 0.075;
        const innerSide = hx * side < 0;
        const notchWindow = Math.exp(-Math.pow((t - 0.77) / 0.08, 2.0));
        if (innerSide && t > 0.62) {
          hx += side * notchWindow * 0.022;
        }
        const radiusScale = 1.0 - 0.25 * Math.pow(t, 1.8);
        hp.setXYZ(i, hx * radiusScale + archX, archY, hz * 0.85 * radiusScale + archZ);
      }
      parts.push(tagZoneAndAttributes(hornGeom, 1.0));
    }
  } else if (characterId === 'the_hollow_knight') {
    // Tall, sweeping serrated royal V-horns with 3 inner notches
    for (const side of [-1, 1]) {
      const hornGeom = new THREE.CylinderGeometry(0.014, 0.095, 0.86, 28, 40, false);
      const hp = hornGeom.attributes.position;
      for (let i = 0; i < hp.count; i++) {
        let hx = hp.getX(i);
        let hy = hp.getY(i);
        let hz = hp.getZ(i);
        const t = (hy + 0.43) / 0.86;
        const archX =
          side * (0.16 + t * 0.28 - Math.pow(t, 2.6) * 0.14);
        const archY = 0.72 + t * 0.76;
        const archZ = -0.02 - t * 0.14;
        // 3 serrated notches on inner face
        if (hx * side < 0 && t > 0.25 && t < 0.85) {
          const serration = Math.sin(t * Math.PI * 7.0);
          if (serration > 0.2) hx += side * serration * 0.026;
        }
        const scale = 1.0 - 0.35 * Math.pow(t, 1.5);
        hp.setXYZ(i, hx * scale + archX, archY, hz * 0.82 * scale + archZ);
      }
      parts.push(tagZoneAndAttributes(hornGeom, 1.0));
    }
  } else if (characterId === 'hornet') {
    // Hornet: Two tall, sleek, razor-sharp swept-back white horns
    for (const side of [-1, 1]) {
      const hornGeom = new THREE.CylinderGeometry(0.008, 0.088, 0.76, 28, 32, false);
      const hp = hornGeom.attributes.position;
      for (let i = 0; i < hp.count; i++) {
        let hx = hp.getX(i);
        let hy = hp.getY(i);
        let hz = hp.getZ(i);
        const t = (hy + 0.38) / 0.76;
        const archX = side * (0.14 + t * 0.19 - Math.pow(t, 2.2) * 0.05);
        const archY = 0.68 + t * 0.68;
        const archZ = -0.01 - Math.pow(t, 1.4) * 0.12;
        const scale = 1.0 - 0.45 * Math.pow(t, 1.4);
        hp.setXYZ(i, hx * scale + archX, archY, hz * 0.8 * scale + archZ);
      }
      parts.push(tagZoneAndAttributes(hornGeom, 1.0));
    }
  } else if (characterId === 'cloth') {
    // Cloth: Knotted burlap hood twin horn-ears at top of hood
    for (const side of [-1, 1]) {
      const knotGeom = new THREE.CylinderGeometry(0.028, 0.075, 0.30, 20, 16, false);
      const kp = knotGeom.attributes.position;
      for (let i = 0; i < kp.count; i++) {
        const kx = kp.getX(i);
        const ky = kp.getY(i);
        const kz = kp.getZ(i);
        const t = (ky + 0.15) / 0.30;
        kp.setXYZ(
          i,
          kx + side * (0.20 + t * 0.08),
          0.74 + t * 0.25,
          kz - t * 0.05
        );
      }
      parts.push(tagZoneAndAttributes(knotGeom, 1.0));
    }
  } else if (characterId === 'grimm') {
    // Troupe Master Grimm: Twin swept-back vampire-crown horns
    for (const side of [-1, 1]) {
      const hornGeom = new THREE.CylinderGeometry(0.012, 0.085, 0.64, 24, 28, false);
      const hp = hornGeom.attributes.position;
      for (let i = 0; i < hp.count; i++) {
        const hx = hp.getX(i);
        const hy = hp.getY(i);
        const hz = hp.getZ(i);
        const t = (hy + 0.32) / 0.64;
        const archX = side * (0.14 + Math.sin(t * Math.PI * 0.65) * 0.16);
        const archY = 0.72 + t * 0.54;
        const archZ = -0.02 - Math.pow(t, 1.5) * 0.11;
        const scale = 1.0 - 0.35 * t;
        hp.setXYZ(i, hx * scale + archX, archY, hz * scale + archZ);
      }
      parts.push(tagZoneAndAttributes(hornGeom, 1.0));
    }
  } else if (characterId === 'the_pale_king') {
    // The Pale King: 4 symmetrical upward-pointing royal Wyrm crown spikes
    const crownOffsets = [-0.21, -0.072, 0.072, 0.21];
    for (let c = 0; c < crownOffsets.length; c++) {
      const cx = crownOffsets[c];
      const isInner = Math.abs(cx) < 0.12;
      const height = isInner ? 0.56 : 0.48;
      const prongGeom = new THREE.ConeGeometry(0.048, height, 20, 20);
      const pp = prongGeom.attributes.position;
      for (let i = 0; i < pp.count; i++) {
        const px = pp.getX(i);
        const py = pp.getY(i);
        const pz = pp.getZ(i);
        const t = (py + height * 0.5) / height;
        const flareX = cx * (1.0 + t * 0.22);
        pp.setXYZ(i, px + flareX, 0.74 + t * height, pz * 0.75 + 0.02);
      }
      parts.push(tagZoneAndAttributes(prongGeom, 1.0));
    }
  } else if (characterId === 'the_radiance') {
    // The Radiance: 3 tall curved crown horn-spikes (left curved inward, center tall spire, right curved inward)
    for (const side of [-1, 0, 1]) {
      const hLen = side === 0 ? 0.68 : 0.62;
      const hornGeom = new THREE.CylinderGeometry(0.01, 0.068, hLen, 22, 24, false);
      const hp = hornGeom.attributes.position;
      for (let i = 0; i < hp.count; i++) {
        const hx = hp.getX(i);
        const hy = hp.getY(i);
        const hz = hp.getZ(i);
        const t = (hy + hLen * 0.5) / hLen;
        const archX =
          side === 0
            ? 0
            : side * (0.18 + Math.sin(t * Math.PI * 0.82) * 0.14 - Math.pow(t, 2.2) * 0.09);
        const archY = 0.72 + t * hLen;
        const scale = 1.0 - 0.45 * t;
        hp.setXYZ(i, hx * scale + archX, archY, hz * scale);
      }
      parts.push(tagZoneAndAttributes(hornGeom, 1.0));
    }
  }

  return parts;
}

// ============================================================================
// ZONE 2 BUILDERS: SOFT-BODY CLOAKS, TRENCH COATS, WINGS, & MONARCH ROBES
// ============================================================================
function buildCloakGeometry(characterId) {
  let topR = 0.21;
  let botR = 0.54;
  let height = 0.86;
  let yCenter = -0.22;
  let pleatCount = 9.0;

  if (characterId === 'hornet') {
    // Vivid crimson bell-shaped silk cloak flaring sharply outward
    topR = 0.19;
    botR = 0.64;
    height = 0.78;
    yCenter = -0.18;
    pleatCount = 12.0;
  } else if (characterId === 'the_hollow_knight') {
    // Massive, heavy floor-length shredded vessel cloak
    topR = 0.24;
    botR = 0.58;
    height = 1.02;
    yCenter = -0.26;
    pleatCount = 11.0;
  } else if (characterId === 'quirrel') {
    // Compact scholar's trench coat & wrapped scarf
    topR = 0.23;
    botR = 0.46;
    height = 0.74;
    yCenter = -0.18;
    pleatCount = 7.0;
  } else if (characterId === 'cloth') {
    // Short, stout frayed burlap poncho-cape + thick neck scarf
    topR = 0.28;
    botR = 0.52;
    height = 0.64;
    yCenter = -0.10;
    pleatCount = 8.0;
  } else if (characterId === 'grimm') {
    // High-collared bat-wing cloak with dramatic upturned collar spikes
    topR = 0.22;
    botR = 0.60;
    height = 0.98;
    yCenter = -0.22;
    pleatCount = 8.0;
  } else if (characterId === 'the_pale_king') {
    // Floor-length layered monarch robes concealing the body
    topR = 0.23;
    botR = 0.56;
    height = 1.06;
    yCenter = -0.27;
    pleatCount = 14.0;
  } else if (characterId === 'the_radiance') {
    // Sweeping multi-layered moth light-feather wings draping from shoulders
    topR = 0.26;
    botR = 0.72;
    height = 0.96;
    yCenter = -0.20;
    pleatCount = 10.0;
  }

  const cloakGeom = new THREE.CylinderGeometry(topR, botR, height, 72, 40, false);
  const cp = cloakGeom.attributes.position;

  for (let i = 0; i < cp.count; i++) {
    let cx = cp.getX(i);
    let cy = cp.getY(i);
    let cz = cp.getZ(i);

    const t = (height * 0.5 - cy) / height; // 0 at collar, 1 at hem
    const az = Math.atan2(cx, cz);

    // Fluted vertical pleats
    const pleatWave =
      Math.sin(az * pleatCount) * 0.048 * Math.pow(t, 0.85) +
      Math.cos(az * (pleatCount * 2.0 - 1.0)) * 0.022 * Math.pow(t, 1.3);

    let rScale = 1.0 + pleatWave + 0.14 * Math.pow(t, 1.6);

    if (characterId === 'hornet') {
      // Crisp bell flare with minimal raggedness
      rScale = 1.0 + Math.sin(az * pleatCount) * 0.042 * t + 0.22 * Math.pow(t, 1.35);
    } else if (characterId === 'the_radiance') {
      // Wing-like lateral span (wider along X, swept back along Z)
      cx *= 1.28;
      cz *= 0.78;
    } else if (characterId === 'grimm' && t < 0.22) {
      // High flared vampire collar rising behind the head
      const collarBack = smoothstep(-0.1, -0.35, cz);
      cy += collarBack * (1.0 - t / 0.22) * 0.26;
      rScale += collarBack * 0.22;
    }

    cx *= rScale;
    cz *= rScale * 0.92 - t * 0.045;

    // Frayed / feathered hem contour
    const frayCut =
      characterId === 'hornet' || characterId === 'the_pale_king'
        ? Math.sin(az * pleatCount) * 0.032
        : (Math.sin(az * 7.0) * 0.06 +
            Math.cos(az * 13.0 + 0.9) * 0.042 +
            Math.sin(az * 21.0) * 0.02) *
          smoothstep(0.62, 1.0, t);

    cy = cy + yCenter - frayCut;
    cp.setXYZ(i, cx, cy, cz);
  }

  return tagZoneAndAttributes(cloakGeom, 2.0);
}

// ============================================================================
// ZONE 3 BUILDERS: VELVETY LIMBS, INSECTOID THORAX, & RADIANCE MOTH MANE
// ============================================================================
function buildBodyAndLimbs(characterId) {
  const parts = [];

  if (characterId === 'the_radiance') {
    // Voluminous plush white-gold moth fur mane around neck & upper chest
    const maneGeom = new THREE.SphereGeometry(0.38, 44, 32);
    const mp = maneGeom.attributes.position;
    for (let i = 0; i < mp.count; i++) {
      const x = mp.getX(i) * 1.18;
      const y = mp.getY(i) * 0.72 + 0.12;
      const z = mp.getZ(i) * 1.08 + 0.04;
      mp.setXYZ(i, x, y, z);
    }
    parts.push(tagZoneAndAttributes(maneGeom, 3.0));

    // Tapered lower moth spike-legs
    for (const side of [-1, 0, 1]) {
      const spikeLeg = new THREE.ConeGeometry(0.055, 0.65, 16, 16);
      const sp = spikeLeg.attributes.position;
      for (let i = 0; i < sp.count; i++) {
        sp.setXYZ(
          i,
          sp.getX(i) + side * 0.14,
          -sp.getY(i) - 0.56,
          sp.getZ(i)
        );
      }
      parts.push(tagZoneAndAttributes(spikeLeg, 3.0));
    }
    return parts;
  }

  // Torso core
  const torsoRadius = characterId === 'cloth' ? 0.25 : 0.16;
  const torsoGeom = new THREE.CylinderGeometry(
    torsoRadius * 0.85,
    torsoRadius,
    0.58,
    24,
    18
  );
  const tp = torsoGeom.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    tp.setXYZ(i, tp.getX(i), tp.getY(i) - 0.22, tp.getZ(i));
  }
  parts.push(tagZoneAndAttributes(torsoGeom, 3.0));

  // Legs
  const legSpread = characterId === 'cloth' ? 0.14 : 0.095;
  const legRadius = characterId === 'cloth' ? 0.062 : 0.036;
  for (const side of [-1, 1]) {
    const legGeom = new THREE.CylinderGeometry(legRadius, legRadius * 0.58, 0.56, 18, 18);
    const lp = legGeom.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      let lx = lp.getX(i);
      let ly = lp.getY(i);
      let lz = lp.getZ(i);
      const t = (0.28 - ly) / 0.56;
      lx += side * (legSpread + t * 0.025);
      ly -= 0.58;
      lz += Math.sin(t * Math.PI) * 0.02;
      lp.setXYZ(i, lx, ly, lz);
    }
    parts.push(tagZoneAndAttributes(legGeom, 3.0));
  }

  // Arms (The Hollow Knight canonically has only its right arm)
  const armSides = characterId === 'the_hollow_knight' ? [1] : [-1, 1];
  for (const side of armSides) {
    const armGeom = new THREE.CylinderGeometry(0.032, 0.022, 0.42, 16, 14);
    const ap = armGeom.attributes.position;
    for (let i = 0; i < ap.count; i++) {
      let ax = ap.getX(i);
      let ay = ap.getY(i);
      let az = ap.getZ(i);
      const t = (0.21 - ay) / 0.42;
      ax += side * (0.20 + t * 0.14);
      ay -= 0.14;
      az += side > 0 ? 0.08 * t : 0.02 * t;
      ap.setXYZ(i, ax, ay, az);
    }
    parts.push(tagZoneAndAttributes(armGeom, 3.0));
  }

  return parts;
}

// ============================================================================
// ZONE 4 BUILDERS: INFECTION SACS, MONOMON ARCHIVE MASK, SCARLET ORBS, & FILIGREE
// ============================================================================
function buildCoreAndSpecialZone(characterId) {
  const parts = [];

  if (characterId === 'the_hollow_knight') {
    // Volatile glowing orange Radiance Infection Sacs bursting from the chest cavity
    const sacOffsets = [
      [0.0, -0.08, 0.24, 0.11],
      [-0.08, -0.15, 0.22, 0.085],
      [0.07, -0.18, 0.23, 0.078],
      [-0.04, 0.52, 0.27, 0.048] // Infection pustule inside the cracked left eye socket
    ];
    for (const [sx, sy, sz, sr] of sacOffsets) {
      const sacGeom = new THREE.SphereGeometry(sr, 24, 20);
      const sp = sacGeom.attributes.position;
      for (let i = 0; i < sp.count; i++) {
        sp.setXYZ(i, sp.getX(i) + sx, sp.getY(i) + sy, sp.getZ(i) + sz);
      }
      parts.push(tagZoneAndAttributes(sacGeom, 4.0));
    }
  } else if (characterId === 'quirrel') {
    // Monomon the Teacher's Archive Mask worn perched atop Quirrel's head like a hat
    const hatGeom = new THREE.SphereGeometry(0.24, 28, 22);
    const hp = hatGeom.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i) * 1.12;
      const y = hp.getY(i) * 0.55 + 0.78;
      const z = hp.getZ(i) * 0.95 + 0.06;
      hp.setXYZ(i, x, y, z);
    }
    parts.push(tagZoneAndAttributes(hatGeom, 4.0));
  } else if (characterId === 'grimm') {
    // Scarlet Nightmare Heart brooch & collar emblem
    const broochGeom = new THREE.OctahedronGeometry(0.085, 2);
    const bp = broochGeom.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      bp.setXYZ(i, bp.getX(i), bp.getY(i) + 0.08, bp.getZ(i) * 0.6 + 0.23);
    }
    parts.push(tagZoneAndAttributes(broochGeom, 4.0));
  } else if (characterId === 'the_pale_king') {
    // Luminous King's Brand royal chest seal
    const sealGeom = new THREE.TorusknotGeometry
      ? new THREE.TorusGeometry(0.11, 0.022, 16, 36)
      : new THREE.TorusGeometry(0.11, 0.022, 16, 36);
    const sp = sealGeom.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      sp.setXYZ(i, sp.getX(i), sp.getY(i) + 0.04, sp.getZ(i) + 0.24);
    }
    parts.push(tagZoneAndAttributes(sealGeom, 4.0));
  } else if (characterId === 'the_radiance') {
    // Blazing Sun-Core chest orb
    const sunCore = new THREE.SphereGeometry(0.14, 24, 20);
    const sp = sunCore.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      sp.setXYZ(i, sp.getX(i), sp.getY(i) + 0.10, sp.getZ(i) + 0.28);
    }
    parts.push(tagZoneAndAttributes(sunCore, 4.0));
  }

  return parts;
}

export function buildCharacterBaseGeometry(characterId = 'the_knight') {
  const geoms = [
    ...buildMaskAndHorns(characterId),
    buildCloakGeometry(characterId),
    ...buildBodyAndLimbs(characterId),
    ...buildCoreAndSpecialZone(characterId)
  ];
  return mergeCharacterZones(geoms);
}

// ============================================================================
// SIGNATURE WEAPONS, PROPS, & EYE CORES FOR ALL 8 CHARACTERS
// ============================================================================
function populateEyesForCharacter(eyeSocketsGroup, characterId, eyeGlowHex) {
  while (eyeSocketsGroup.children.length > 0) {
    const ch = eyeSocketsGroup.children[0];
    eyeSocketsGroup.remove(ch);
  }

  const voidCoreMat = new THREE.MeshBasicMaterial({ color: 0x030508 });
  const glowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(eyeGlowHex || '#38bdf8'),
    transparent: true,
    opacity: characterId === 'the_radiance' || characterId === 'grimm' ? 0.85 : 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  if (characterId === 'the_radiance') {
    // 6 blazing golden-amber eyes arranged in 3 pairs on the Radiance's face
    const pairs = [
      [0.14, 0.50, 0.26, 0.042],
      [0.17, 0.41, 0.25, 0.036],
      [0.12, 0.33, 0.24, 0.030]
    ];
    for (const [ex, ey, ez, er] of pairs) {
      for (const side of [-1, 1]) {
        const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(er, 16, 14), glowMat);
        eyeMesh.position.set(side * ex, ey, ez);
        eyeSocketsGroup.add(eyeMesh);
      }
    }
    return { glowMat };
  }

  const eyeX = characterId === 'hornet' || characterId === 'grimm' ? 0.122 : 0.132;
  const eyeScaleY = characterId === 'cloth' ? 1.0 : 1.32;

  for (const side of [-1, 1]) {
    const eyeCore = new THREE.Mesh(new THREE.SphereGeometry(0.072, 24, 20), voidCoreMat);
    eyeCore.scale.set(0.84, eyeScaleY, 0.52);
    eyeCore.position.set(side * eyeX, 0.44, 0.252);
    eyeCore.rotation.z = side * (characterId === 'hornet' || characterId === 'grimm' ? -0.24 : -0.08);
    eyeSocketsGroup.add(eyeCore);

    const glowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.052, 20, 16), glowMat);
    glowMesh.scale.set(0.75, eyeScaleY * 0.92, 0.42);
    glowMesh.position.set(side * eyeX, 0.435, 0.268);
    eyeSocketsGroup.add(glowMesh);
  }

  return { glowMat };
}

function populateWeaponForCharacter(weaponGroup, characterId, accentColor) {
  while (weaponGroup.children.length > 0) {
    const ch = weaponGroup.children[0];
    weaponGroup.remove(ch);
  }

  const runeMaterials = [];

  if (characterId === 'hornet') {
    // Hornet's Needle with Circular Ring Pommel & Trailing Woven Red Silk Thread
    const needleMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.18,
      metalness: 0.72,
      emissive: 0x334155,
      emissiveIntensity: 0.25
    });
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.036, 1.18, 6, 20), needleMat);
    blade.scale.set(1.0, 1.0, 0.35);
    blade.position.y = 0.28;
    weaponGroup.add(blade);

    const ringPommel = new THREE.Mesh(
      new THREE.TorusGeometry(0.082, 0.016, 16, 32),
      needleMat
    );
    ringPommel.position.y = -0.38;
    weaponGroup.add(ringPommel);

    // Trailing Crimson Silk Thread Arc
    const silkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.46, 0),
      new THREE.Vector3(0.18, -0.58, -0.14),
      new THREE.Vector3(0.32, -0.42, -0.28),
      new THREE.Vector3(0.16, -0.18, -0.36)
    ]);
    const silkMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.85
    });
    const silkMesh = new THREE.Mesh(
      new THREE.TubeGeometry(silkCurve, 32, 0.008, 8, false),
      silkMat
    );
    weaponGroup.add(silkMesh);
    runeMaterials.push(silkMat);

    weaponGroup.position.set(0.38, -0.16, 0.16);
    weaponGroup.rotation.set(0.24, -0.22, -0.52);
  } else if (characterId === 'cloth') {
    // Cloth's Massive Prickly Great-Club studded with sharp bone spikes
    const clubWoodMat = new THREE.MeshStandardMaterial({
      color: 0x78553a,
      roughness: 0.78,
      metalness: 0.08
    });
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.32,
      metalness: 0.15,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.18
    });
    const clubBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.042, 0.96, 14, 12),
      clubWoodMat
    );
    clubBody.position.y = 0.16;
    weaponGroup.add(clubBody);

    for (let s = 0; s < 10; s++) {
      const angle = (s / 10) * Math.PI * 2.0;
      const sy = 0.15 + (s % 3) * 0.16;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.14, 8), spikeMat);
      spike.position.set(Math.cos(angle) * 0.11, sy, Math.sin(angle) * 0.11);
      spike.rotation.z = -Math.cos(angle) * 1.25;
      spike.rotation.x = Math.sin(angle) * 1.25;
      weaponGroup.add(spike);
    }
    weaponGroup.position.set(0.42, -0.14, 0.14);
    weaponGroup.rotation.set(0.15, -0.18, -0.35);
  } else if (characterId === 'grimm') {
    // Troupe Master Grimm: Orbiting Scarlet Nightmare Flame Lantern Orbs
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff2a4b,
      transparent: true,
      opacity: 0.9
    });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffe4e6 });
    for (let f = 0; f < 3; f++) {
      const ang = (f / 3) * Math.PI * 2;
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.068, 2), flameMat);
      orb.position.set(Math.cos(ang) * 0.16, f * 0.14 - 0.05, Math.sin(ang) * 0.16);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), coreMat);
      orb.add(inner);
      weaponGroup.add(orb);
    }
    runeMaterials.push(flameMat);
    weaponGroup.position.set(0.38, -0.05, 0.24);
    weaponGroup.rotation.set(0, 0, 0);
  } else if (characterId === 'the_pale_king') {
    // The Pale King: Luminous Pale Court Sigil Halo & White Palace Saw-Emblem
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide
    });
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.50, 48), haloMat);
    const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.34, 36), haloMat);
    weaponGroup.add(outerRing, innerRing);
    runeMaterials.push(haloMat);
    weaponGroup.position.set(0.0, 0.44, -0.22);
    weaponGroup.rotation.set(0, 0, 0);
  } else if (characterId === 'the_radiance') {
    // The Radiance: Conjured Ring of Blazing Dream Swords Halo
    const swordMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.88
    });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const sword = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.36, 4), swordMat);
      sword.position.set(Math.cos(a) * 0.58, Math.sin(a) * 0.58, 0);
      sword.rotation.z = a - Math.PI * 0.5;
      weaponGroup.add(sword);
    }
    runeMaterials.push(swordMat);
    weaponGroup.position.set(0.0, 0.24, -0.26);
    weaponGroup.rotation.set(0, 0, 0);
  } else {
    // The Knight (Pure Nail), The Hollow Knight (Corrupted Greatnail), or Quirrel (Curved Nail)
    const isHK = characterId === 'the_hollow_knight';
    const bladeLen = isHK ? 1.18 : 0.86;
    const bladeRad = isHK ? 0.072 : 0.055;
    const bladeGeom = new THREE.ConeGeometry(bladeRad, bladeLen, 4, 28);
    const bp = bladeGeom.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      let x = bp.getX(i);
      let y = bp.getY(i);
      let z = bp.getZ(i) * 0.32;
      const t = (y + bladeLen * 0.5) / bladeLen;
      const fuller = Math.exp(-Math.pow(x / 0.018, 2.0)) * (1.0 - t) * 0.008;
      if (Math.abs(z) > 0.001) z -= Math.sign(z) * fuller;
      bp.setXYZ(i, x, y + 0.18, z);
    }
    bladeGeom.computeVertexNormals();

    const bladeMat = new THREE.MeshStandardMaterial({
      color: isHK ? 0xd6d3d1 : 0xf1f5f9,
      roughness: 0.24,
      metalness: 0.35,
      emissive: new THREE.Color(accentColor || '#bae6fd'),
      emissiveIntensity: 0.22
    });
    weaponGroup.add(new THREE.Mesh(bladeGeom, bladeMat));

    const runeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(accentColor || '#e0f2fe'),
      transparent: true,
      opacity: 0.85
    });
    for (let r = 0; r < 5; r++) {
      const ry = -0.10 + r * 0.11;
      const rw = (1.0 - r * 0.14) * 0.032;
      const rune = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.012, 0.038), runeMat);
      rune.position.set(0, ry, 0);
      rune.rotation.z = r % 2 === 0 ? 0.38 : -0.38;
      weaponGroup.add(rune);
    }
    runeMaterials.push(runeMat);

    const hilt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.015, 0.22, 14),
      new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.72 })
    );
    hilt.position.y = -0.34;
    weaponGroup.add(hilt);

    weaponGroup.position.set(0.34, -0.22, 0.14);
    weaponGroup.rotation.set(0.28, -0.24, -0.56);
  }

  return { runeMaterials };
}

// ============================================================================
// MAIN CHARACTER FACTORY & MULTI-CHARACTER CONTROLLER
// ============================================================================
export function createBlobCreature(initialCharacterId = 'the_knight', initialPreset = {}) {
  const root = new THREE.Group();
  root.name = 'HollowKnightCharacterRoot';

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'KnightBody';
  root.add(bodyGroup);

  const baseGeometry = buildCharacterBaseGeometry(initialCharacterId);

  const skinUniforms = {
    uTime: { value: 0 },
    uBreathPhase: { value: 0 },
    uWindStrength: { value: initialPreset.windStrength ?? 0.95 },
    uWearAmount: { value: initialPreset.wearAmount ?? 0.35 },
    uCharType: { value: initialPreset.charType ?? 0 },
    uRenderMode: { value: 0 },
    uCursorTool: { value: 0 },
    uLensChannel: { value: 1 },
    uHighlightZone: { value: 0 },
    uActionSurge: { value: 0 },
    uInertia: { value: new THREE.Vector3(0, 0, 0) },
    uPointerLocalPos: { value: new THREE.Vector3(0, 0, 99) },
    uPointerActive: { value: 0 },
    uBaseColor: { value: new THREE.Color(initialPreset.baseColor || '#1e2433') },
    uTipColor: { value: new THREE.Color(initialPreset.tipColor || '#bae6fd') },
    uMaskColor: { value: new THREE.Color(initialPreset.maskColor || '#f1f5f9') },
    uCoreColor: { value: new THREE.Color(initialPreset.coreColor || '#0f172a') },
    uKeyLightDir: { value: new THREE.Vector3(2.4, 3.2, 2.8).normalize() },
    uKeyLightColor: { value: new THREE.Color('#f8fafc') },
    uKeyLightIntensity: { value: 1.42 },
    uRimLightDir: { value: new THREE.Vector3(-2.6, 2.0, -2.5).normalize() },
    uRimLightColor: { value: new THREE.Color('#7dd3fc') },
    uRimIntensity: { value: 1.75 }
  };

  const baseSkinMat = new THREE.ShaderMaterial({
    vertexShader: KNIGHT_SURFACE_VERTEX_SHADER,
    fragmentShader: KNIGHT_SURFACE_FRAGMENT_SHADER,
    uniforms: skinUniforms,
    side: THREE.DoubleSide
  });

  const furBaseMesh = new THREE.Mesh(baseGeometry, baseSkinMat);
  furBaseMesh.name = 'FurBaseMesh';
  furBaseMesh.renderOrder = 0;
  bodyGroup.add(furBaseMesh);

  // Clean Topology Wireframe Overlay (shown in Render Mode 4)
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.36,
    depthWrite: false
  });
  const topologyWireMesh = new THREE.Mesh(baseGeometry, wireMat);
  topologyWireMesh.name = 'TopologyWireMesh';
  topologyWireMesh.scale.setScalar(1.0018);
  topologyWireMesh.visible = false;
  bodyGroup.add(topologyWireMesh);

  // Eye Sockets & Weapon Groups
  const eyeSocketsGroup = new THREE.Group();
  eyeSocketsGroup.name = 'VoidEyeSockets';
  bodyGroup.add(eyeSocketsGroup);

  const weaponGroup = new THREE.Group();
  weaponGroup.name = 'PureNailWeapon';
  bodyGroup.add(weaponGroup);

  let activeCharacterId = initialCharacterId;
  let eyeRefs = populateEyesForCharacter(
    eyeSocketsGroup,
    initialCharacterId,
    initialPreset.eyeGlowColor || '#38bdf8'
  );
  let weaponRefs = populateWeaponForCharacter(
    weaponGroup,
    initialCharacterId,
    initialPreset.eyeGlowColor || '#7dd3fc'
  );

  // Soft-Surface Fiber, Soul, Infection, & Flame Particle Simulation
  const PARTICLE_COUNT = 160;
  const pPositions = new Float32Array(PARTICLE_COUNT * 3);
  const pColors = new Float32Array(PARTICLE_COUNT * 3);
  const pSeeds = new Float32Array(PARTICLE_COUNT * 4);

  function colorizeParticles(primaryHex, secondaryHex) {
    const c1 = new THREE.Color(primaryHex || '#bae6fd');
    const c2 = new THREE.Color(secondaryHex || '#38bdf8');
    const c3 = new THREE.Color('#090d16');

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const kind = i % 3;
      const col = kind === 0 ? c1 : kind === 1 ? c2 : c3;
      pColors[i3] = col.r;
      pColors[i3 + 1] = col.g;
      pColors[i3 + 2] = col.b;
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const i4 = i * 4;
    const r = 0.28 + Math.random() * 0.58;
    const theta = Math.random() * Math.PI * 2.0;
    const y = -0.68 + Math.random() * 1.65;

    pPositions[i3] = Math.cos(theta) * r;
    pPositions[i3 + 1] = y;
    pPositions[i3 + 2] = Math.sin(theta) * r;

    pSeeds[i4] = r;
    pSeeds[i4 + 1] = theta;
    pSeeds[i4 + 2] = y;
    pSeeds[i4 + 3] = 0.4 + Math.random() * 0.9;
  }
  colorizeParticles(initialPreset.tipColor, initialPreset.eyeGlowColor);

  const particleGeom = new THREE.BufferGeometry();
  particleGeom.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  particleGeom.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

  const particleMat = new THREE.PointsMaterial({
    size: 0.024,
    vertexColors: true,
    transparent: true,
    opacity: 0.76,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const particleSystem = new THREE.Points(particleGeom, particleMat);
  particleSystem.name = 'SoftSurfaceParticles';
  root.add(particleSystem);

  const lookTarget = new THREE.Vector3(0, 0, 0);
  const currentLook = new THREE.Vector3(0, 0, 0);
  let blinkTimer = 0;
  let nextBlink = 3.2;
  let isBlinking = false;
  let actionTimer = 0; // Counts down from 1.8s when signature action is triggered

  function triggerCharacterAction() {
    actionTimer = 1.8;
  }

  function setCharacter(characterId, presetState = {}) {
    activeCharacterId = characterId;
    const newGeom = buildCharacterBaseGeometry(characterId);
    const oldGeom = furBaseMesh.geometry;
    furBaseMesh.geometry = newGeom;
    topologyWireMesh.geometry = newGeom;
    oldGeom.dispose();

    eyeRefs = populateEyesForCharacter(
      eyeSocketsGroup,
      characterId,
      presetState.eyeGlowColor || '#38bdf8'
    );
    weaponRefs = populateWeaponForCharacter(
      weaponGroup,
      characterId,
      presetState.eyeGlowColor || '#7dd3fc'
    );
    colorizeParticles(presetState.tipColor, presetState.eyeGlowColor);
    particleGeom.attributes.color.needsUpdate = true;

    if (presetState.maskColor) skinUniforms.uMaskColor.value.set(presetState.maskColor);
    if (presetState.coreColor) skinUniforms.uCoreColor.value.set(presetState.coreColor);
    if (presetState.wearAmount !== undefined) skinUniforms.uWearAmount.value = presetState.wearAmount;
    if (presetState.charType !== undefined) skinUniforms.uCharType.value = presetState.charType;

    triggerCharacterAction();
    return newGeom;
  }

  function update(
    dt,
    elapsed,
    pointerNDC,
    pointerActive,
    syncParams = null,
    pointerLocalPos = null
  ) {
    const breathPhase = Math.sin(elapsed * 2.15);
    const floatBob = Math.sin(elapsed * 2.15) * 0.016;

    if (actionTimer > 0) {
      actionTimer = Math.max(0, actionTimer - dt);
    }
    const actionSurge = actionTimer > 0 ? Math.sin((actionTimer / 1.8) * Math.PI) : 0.0;

    if (pointerActive && pointerNDC) {
      lookTarget.set(pointerNDC.x * 0.14, pointerNDC.y * 0.10, 0);
    } else {
      lookTarget.set(
        Math.sin(elapsed * 0.65) * 0.04,
        Math.cos(elapsed * 0.5) * 0.025,
        0
      );
    }

    currentLook.lerp(lookTarget, Math.min(1.0, dt * 5.0));

    bodyGroup.position.y = floatBob + actionSurge * 0.06;
    bodyGroup.rotation.y = currentLook.x * 0.48;
    bodyGroup.rotation.x = -currentLook.y * 0.25;
    bodyGroup.rotation.z = -currentLook.x * 0.08;

    // Weapon / Halo idle & signature action motion
    if (activeCharacterId === 'the_pale_king' || activeCharacterId === 'the_radiance') {
      weaponGroup.rotation.z = elapsed * (activeCharacterId === 'the_radiance' ? 0.55 : 0.35) + actionSurge * 2.2;
      const s = 1.0 + actionSurge * 0.28 + 0.04 * Math.sin(elapsed * 3.0);
      weaponGroup.scale.setScalar(s);
    } else if (activeCharacterId === 'grimm') {
      weaponGroup.rotation.y = elapsed * 1.8 + actionSurge * 4.0;
      weaponGroup.position.y = -0.05 + Math.sin(elapsed * 3.2) * 0.04 + actionSurge * 0.12;
    } else {
      weaponGroup.rotation.z =
        -0.52 + Math.sin(elapsed * 2.15 - 0.5) * 0.045 + actionSurge * 0.68;
      weaponGroup.rotation.x = 0.24 + actionSurge * 0.35;
    }

    const runePulse = 0.68 + 0.32 * Math.sin(elapsed * 3.4) + actionSurge * 0.65;
    for (const rm of weaponRefs.runeMaterials) {
      rm.opacity = Math.min(1.0, runePulse);
    }

    // Void / Flame / Radiance Eye Pulse
    blinkTimer += dt;
    if (!isBlinking && blinkTimer >= nextBlink) {
      isBlinking = true;
      blinkTimer = 0;
    }
    let pulseScale = 1.0 + 0.12 * Math.sin(elapsed * 3.6) + actionSurge * 0.35;
    if (isBlinking) {
      const p = blinkTimer / 0.18;
      if (p >= 1.0) {
        isBlinking = false;
        blinkTimer = 0;
        nextBlink = 2.8 + Math.random() * 3.2;
      } else {
        pulseScale *= 0.25 + 0.75 * Math.abs(Math.cos(p * Math.PI));
      }
    }
    if (eyeRefs.glowMat) {
      eyeRefs.glowMat.opacity = Math.min(
        1.0,
        (0.36 + 0.18 * Math.sin(elapsed * 4.1)) * pulseScale + actionSurge * 0.45
      );
    }

    // Update Soft-Surface Particle Simulation
    const posAttr = particleGeom.attributes.position;
    const windStr = syncParams ? syncParams.windStrength : 0.95;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const i4 = i * 4;
      const baseR = pSeeds[i4];
      const baseTheta = pSeeds[i4 + 1];
      const baseY = pSeeds[i4 + 2];
      const speed = pSeeds[i4 + 3] * (1.0 + actionSurge * 2.2);

      const yOffset = ((elapsed * 0.24 * speed + (baseY + 0.75)) % 1.75) - 0.72;
      const swirl =
        baseTheta +
        elapsed * (0.35 + 0.28 * windStr) * (i % 2 === 0 ? 1 : -1);
      const radialBreath =
        baseR +
        0.07 * Math.sin(elapsed * 2.1 + i) +
        0.05 * windStr * Math.max(0, -yOffset) +
        actionSurge * 0.18;

      let px = Math.cos(swirl) * radialBreath + Math.sin(elapsed * 1.6 + yOffset * 3.0) * 0.04 * windStr;
      let py = yOffset;
      let pz = Math.sin(swirl) * radialBreath;

      if (pointerActive && pointerLocalPos) {
        const dx = px - pointerLocalPos.x;
        const dy = py - pointerLocalPos.y;
        const dz = pz - pointerLocalPos.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 0.48 && dist > 1e-4) {
          const push = ((0.48 - dist) / 0.48) * 0.22;
          px += (dx / dist) * push;
          py += (dy / dist) * push;
          pz += (dz / dist) * push;
        }
      }

      posAttr.setXYZ(i, px, py, pz);
    }
    posAttr.needsUpdate = true;

    // Sync Base Mesh Shaders
    skinUniforms.uTime.value = elapsed;
    skinUniforms.uBreathPhase.value = breathPhase;
    skinUniforms.uActionSurge.value = actionSurge;
    if (syncParams) {
      skinUniforms.uWindStrength.value = syncParams.windStrength;
      skinUniforms.uWearAmount.value = syncParams.wearAmount ?? 0.35;
      skinUniforms.uCharType.value = syncParams.charType ?? 0;
      skinUniforms.uRenderMode.value = syncParams.renderMode || 0;
      skinUniforms.uCursorTool.value = syncParams.cursorTool || 0;
      skinUniforms.uLensChannel.value = syncParams.lensChannel || 1;
      skinUniforms.uHighlightZone.value = syncParams.highlightZone || 0;
      skinUniforms.uBaseColor.value.set(syncParams.baseColor);
      skinUniforms.uTipColor.value.set(syncParams.tipColor);
      if (syncParams.maskColor) skinUniforms.uMaskColor.value.set(syncParams.maskColor);
      if (syncParams.coreColor) skinUniforms.uCoreColor.value.set(syncParams.coreColor);
      skinUniforms.uKeyLightIntensity.value = syncParams.lightIntensity;
      skinUniforms.uRimIntensity.value = syncParams.rimIntensity;
      if (syncParams.lightDir) skinUniforms.uKeyLightDir.value.copy(syncParams.lightDir);
      if (syncParams.rimDir) skinUniforms.uRimLightDir.value.copy(syncParams.rimDir);
      if (syncParams.inertiaVec) skinUniforms.uInertia.value.copy(syncParams.inertiaVec);
      if (syncParams.keyLightColor) skinUniforms.uKeyLightColor.value.copy(syncParams.keyLightColor);
      if (syncParams.rimLightColor) skinUniforms.uRimLightColor.value.copy(syncParams.rimLightColor);

      const isTopo = (syncParams.renderMode || 0) > 3.5;
      topologyWireMesh.visible = isTopo;
      particleSystem.visible = !isTopo;
    }
    if (pointerLocalPos) {
      skinUniforms.uPointerLocalPos.value.copy(pointerLocalPos);
    }
    skinUniforms.uPointerActive.value = pointerActive ? 1.0 : 0.0;

    return {
      breathPhase,
      floatBob,
      actionSurge
    };
  }

  return {
    root,
    bodyGroup,
    furBaseMesh,
    skinUniforms,
    update,
    setCharacter,
    triggerCharacterAction
  };
}
