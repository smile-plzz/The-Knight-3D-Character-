// Physical Hair BSDF (Marschner / Kajiya-Kay Dual-Specular + TT Scatter + Volumetric Self-Shadowing),
// Soft-Body Cloth Dynamics, Multi-Character PBR/SSS Surface Shaders, Interactive X-Ray Lens & Light Wand
// for the Hollow Knight Lore Character Reference & Simulation Pipeline.

export const COMMON_CLOTH_SOFTBODY_GLSL = /* glsl */ `
  // Deterministic soft-body fabric & wing wave displacement shared by the Base Mesh,
  // 64 Volumetric Shells, and 60,000 Instanced 3D Strands so fibers stay 100% locked to moving cloth.
  vec3 evaluateClothSoftBody(
    vec3 p,
    float zone,
    float time,
    float windStrength,
    vec3 inertia,
    vec3 pointerLocalPos,
    float pointerActive,
    float cursorTool
  ) {
    float isCloak = smoothstep(1.5, 1.8, zone) * (1.0 - smoothstep(2.2, 2.5, zone));
    if (isCloak < 0.01) {
      return vec3(0.0);
    }
    // Pin near neck collar (y >= 0.22) and billow progressively toward frayed hem / wing tips
    float drapeT = clamp((0.24 - p.y) / 0.92, 0.0, 1.0);
    float ease = drapeT * drapeT * (1.35 - 0.35 * drapeT);

    float az = atan(p.x, p.z);
    float effWind = max(0.18, windStrength);

    // Traveling pleat waves & high-frequency frayed hem flutter
    float wavePrimary = sin(az * 6.0 + time * 3.1 - p.y * 4.2) * 0.036;
    float waveSecondary = cos(az * 11.0 - time * 4.6 - p.y * 6.5) * 0.018 * drapeT;
    float gustSway = sin(time * 1.85 + p.y * 2.2) * 0.048 * effWind;

    vec3 radialDir = normalize(vec3(p.x, 0.0, p.z) + vec3(0.0, 0.0, 1e-4));
    vec3 tangDir = vec3(-radialDir.z, 0.0, radialDir.x);

    vec3 clothDisp =
      radialDir * ((wavePrimary + waveSecondary) * (0.55 + 0.65 * effWind) + 0.022 * effWind * drapeT) +
      tangDir * (cos(az * 5.0 + time * 2.4) * 0.018 * effWind) +
      vec3(gustSway, abs(wavePrimary) * 0.28 * effWind, cos(time * 1.5 + p.x * 2.4) * 0.028 * effWind) +
      inertia * 0.38;

    // Interactive Wind Vortex Tool (cursorTool == 1) billows the soft-body fabric dynamically
    if (pointerActive > 0.5) {
      float pDist = distance(p, pointerLocalPos);
      float radius = cursorTool > 0.5 && cursorTool < 1.5 ? 0.85 : 0.48;
      if (pDist < radius) {
        float falloff = pow(1.0 - pDist / radius, 1.6);
        vec3 away = normalize(p - pointerLocalPos + vec3(0.0, 1e-4, 0.0));
        if (cursorTool > 0.5 && cursorTool < 1.5) {
          // Swirling turbulent wind vortex blast
          vec3 swirl = cross(vec3(0.0, 1.0, 0.0), away);
          float gust = 0.24 + 0.08 * sin(time * 14.0 + pDist * 12.0);
          clothDisp += (away * 0.85 + swirl * 0.65 + vec3(0.0, 0.35, 0.0)) * falloff * gust;
        } else {
          clothDisp += away * falloff * 0.09;
        }
      }
    }

    return clothDisp * ease * isCloak;
  }
`;

const COMMON_HAIR_BSDF_GLSL = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uTipColor;
  uniform vec3 uMaskColor;
  uniform vec3 uCoreColor;
  uniform float uRoughness;
  uniform float uSpecular;
  uniform float uFurDensity;
  uniform float uWearAmount;
  uniform float uCharType;
  uniform vec3 uKeyLightDir;
  uniform vec3 uKeyLightColor;
  uniform float uKeyLightIntensity;
  uniform vec3 uRimLightDir;
  uniform vec3 uRimLightColor;
  uniform float uRimIntensity;
  uniform float uAmbientIntensity;
  uniform vec3 uEnvSkyColor;
  uniform vec3 uEnvGroundColor;
  uniform float uEnvTintStrength;
  uniform float uRenderMode; // 0=Final Render, 1=Groom & Weight Map, 2=Carapace/Cloth Displacement, 3=SSS & Infection Map, 4=Topology
  uniform float uCursorTool; // 0=Comb, 1=Wind Vortex, 2=Action Strike, 3=Light Wand, 4=X-Ray Lens
  uniform float uLensChannel; // Channel revealed inside X-Ray Lens (1..4)
  uniform float uHighlightZone; // 0=All, 1=Head/Mask, 2=Cloak, 3=Body/Limbs, 4=Core/Props
  uniform vec3 uPointerLocalPos;
  uniform float uPointerActive;

  vec3 shiftTangent(vec3 T, vec3 N, float shift) {
    return normalize(T + N * shift);
  }

  float hairSpecularLobe(vec3 T, vec3 N, vec3 V, vec3 L, float roughness) {
    vec3 H = normalize(L + V + vec3(1e-6, 1e-6, 1e-6));
    float dotTH = clamp(dot(T, H), -1.0, 1.0);
    float sinTH = sqrt(max(1e-5, 1.0 - dotTH * dotTH));
    float hemiVis = smoothstep(-0.25, 0.15, dot(N, L));
    float exponent = mix(220.0, 10.0, clamp(roughness * roughness, 0.0, 1.0));
    float normFactor = (exponent + 2.0) / 8.0;
    return hemiVis * pow(sinTH, exponent) * normFactor * 0.095;
  }

  vec3 evaluateTechnicalShaderChannel(
    float channel,
    vec3 localPos,
    vec3 N,
    vec3 T,
    vec3 V,
    vec3 L,
    float h,
    float combMemory,
    float surfaceZone,
    float follicleMask
  ) {
    // Channel 1: Dynamic Fur Grooming & Cloth Wind-Resistance Weight Map
    if (channel < 1.5) {
      vec3 maskRimFuzzCol = vec3(0.18, 0.58, 1.0);  // Blue: Mask Contour Micro-Fibers
      vec3 cloakFuzzCol   = vec3(0.96, 0.22, 0.58); // Magenta: Dynamic Cloak & Frayed Edge Fuzz
      vec3 limbNapCol     = vec3(0.08, 0.88, 0.78); // Cyan: Velvety Limb Nap / Moth Mane
      vec3 coreCol        = vec3(1.0, 0.62, 0.08);  // Amber: Infection / Filigree Core
      vec3 zoneCol = cloakFuzzCol;
      if (surfaceZone < 1.5) zoneCol = maskRimFuzzCol;
      else if (surfaceZone > 2.5 && surfaceZone < 3.5) zoneCol = limbNapCol;
      else if (surfaceZone >= 3.5) zoneCol = coreCol;
      float tipGlow = 0.45 + 0.65 * h;
      return zoneCol * tipGlow * clamp(follicleMask, 0.25, 1.25) + vec3(combMemory * 0.35);
    }

    // Channel 2: Hard Carapace vs. Soft Cloth Displacement Map
    if (channel < 2.5) {
      float dispVal = clamp(0.18 + 0.78 * h * clamp(follicleMask, 0.2, 1.3), 0.0, 1.0);
      return vec3(dispVal);
    }

    // Channel 3: Subsurface Scattering (SSS) & Infection Sac Emission Map
    if (channel < 3.5) {
      float rimSSS = pow(1.0 - max(0.0, dot(N, V)), 1.8);
      if (surfaceZone >= 3.5) {
        return vec3(1.0, 0.42, 0.05) * (1.2 + 0.5 * rimSSS);
      }
      if (surfaceZone < 1.5) {
        return mix(vec3(0.25, 0.15, 0.10), vec3(0.96, 0.82, 0.68), rimSSS * 0.85 + 0.25);
      }
      return mix(vec3(0.05, 0.12, 0.24), uCoreColor + vec3(0.2, 0.4, 0.6), h * rimSSS);
    }

    // Channel 4: Clean Quad/Tri Topology Reference
    float clayDiff = clamp(dot(N, L) * 0.5 + 0.5, 0.15, 1.0);
    float clayRim = pow(1.0 - max(0.0, dot(N, V)), 2.5) * 0.45;
    return vec3(0.36, 0.40, 0.46) * (clayDiff * (0.4 + 0.6 * h) + clayRim);
  }

  vec3 evaluatePhysicalHairShading(
    vec3 localPos,
    vec3 worldPos,
    vec3 surfNormal,
    vec3 hairTangent,
    float h,
    float strandSeed,
    float combMemory,
    float surfaceZone,
    float follicleMask
  ) {
    vec3 N = normalize(surfNormal);
    vec3 T = normalize(hairTangent);
    vec3 V = normalize(cameraPosition - worldPos);
    vec3 L = normalize(uKeyLightDir);
    vec3 Lrim = normalize(uRimLightDir);

    // Full-screen Technical Shader Channel when uRenderMode > 0
    if (uRenderMode > 0.5) {
      return evaluateTechnicalShaderChannel(
        uRenderMode,
        localPos,
        N,
        T,
        V,
        L,
        h,
        combMemory,
        surfaceZone,
        follicleMask
      );
    }

    // Regional Pigment Calibration across all 8 Hollow Knight Characters:
    vec3 regionalRoot = uBaseColor;
    vec3 regionalTip  = uTipColor;

    if (surfaceZone < 1.5) {
      // Zone 1: Chitin Mask Contour Micro-Fuzz
      regionalRoot = mix(uMaskColor * 0.82, uBaseColor, 0.18);
      regionalTip  = mix(vec3(0.94, 0.97, 1.0), uTipColor, 0.45);
    } else if (surfaceZone > 2.5 && surfaceZone < 3.5) {
      // Zone 3: Slender Limbs Velvety Nap (or Golden-White Fluffy Moth Mane on The Radiance charType==5)
      if (abs(uCharType - 5.0) < 0.4) {
        regionalRoot = vec3(0.95, 0.86, 0.62);
        regionalTip  = vec3(1.0, 0.99, 0.92);
      } else if (abs(uCharType - 7.0) < 0.4) {
        // Cornifer warm brown velvet body nap
        regionalRoot = vec3(0.24, 0.13, 0.06);
        regionalTip  = vec3(0.68, 0.44, 0.24);
      } else {
        regionalRoot = uBaseColor * 0.36;
        regionalTip  = mix(uBaseColor * 0.65, uTipColor, 0.52);
      }
    } else if (surfaceZone >= 3.5) {
      // Zone 4: Infection Sacs / Filigree / Scrolls
      regionalRoot = uCoreColor * 0.85;
      regionalTip  = mix(uCoreColor, vec3(1.0, 0.92, 0.65), 0.65);
    }

    // 1. Root-to-Tip Melanin / Pigment Gradient
    float rootTipMix = smoothstep(0.05, 0.92, pow(h, 0.78));
    vec3 strandTint = mix(vec3(0.92), vec3(1.08), fract(strandSeed * 13.37));
    vec3 albedo = mix(regionalRoot, regionalTip, rootTipMix) * strandTint;

    // 2. Follicle Ambient Occlusion
    float follicleAO = mix(0.20, 1.0, pow(clamp(h, 0.0, 1.0), 0.70));

    // 3. Beer-Lambert Volumetric Hair Self-Shadowing
    float NdotL = dot(N, L);
    float opticalDepth = (1.0 - h) * (0.45 + 0.55 * uFurDensity) / max(0.22, NdotL * 0.5 + 0.55);
    float deepShadow = exp(-opticalDepth * 1.45);
    float wrapDiffuse = clamp((NdotL + 0.45) / 1.45, 0.0, 1.0);

    // 4. Primary Specular Lobe (R)
    float sheenBoost = 1.0 + combMemory * 0.48;
    vec3 tPrimary = shiftTangent(T, N, -0.16 + (strandSeed - 0.5) * 0.05);
    float specR = hairSpecularLobe(tPrimary, N, V, L, uRoughness) * uSpecular * sheenBoost;
    vec3 colorR = specR * uKeyLightColor * mix(vec3(1.0), albedo, 0.15);

    // 5. Secondary Specular Lobe (TRT)
    vec3 tSecondary = shiftTangent(T, N, 0.24 + (strandSeed - 0.5) * 0.08);
    float glint = 0.75 + 0.5 * sin(strandSeed * 62.83);
    float specTRT = hairSpecularLobe(tSecondary, N, V, L, min(1.0, uRoughness * 1.35)) * uSpecular * 0.90 * glint;
    vec3 colorTRT = specTRT * mix(albedo, regionalTip, 0.65) * uKeyLightColor * 1.65;

    // 6. Dominant Cool-Blue Studio Rim Light + Subtle Warm Fill Light (per global_simulation_specs)
    float forwardKey = pow(clamp(dot(V, -L + N * 0.35), 0.0, 1.0), 3.2);
    float forwardRim = pow(clamp(dot(V, -Lrim + N * 0.4), 0.0, 1.0), 2.2);
    float fresnelRim = pow(1.0 - max(0.0, dot(N, V)), 2.1);
    vec3 rimGlowColor = mix(uRimLightColor, vec3(0.68, 0.88, 1.0), 0.52);
    vec3 scatterTT = (
      forwardKey * uKeyLightColor * 0.35 +
      (forwardRim * 0.85 + fresnelRim * 0.95) * rimGlowColor * uRimIntensity
    ) * mix(regionalRoot + vec3(0.08), regionalTip, 0.82) * (0.30 + 0.70 * h);

    // 7. Subtle Warm Fill Light & Hemisphere Balance
    vec3 warmFillDir = normalize(vec3(-0.7, -0.2, 0.65));
    float warmFill = max(0.0, dot(N, warmFillDir)) * 0.24;
    vec3 baseSkyColor = mix(regionalTip, vec3(0.78, 0.88, 1.0), 0.65);
    vec3 baseGroundColor = regionalRoot * 0.38;
    vec3 skyColor = mix(baseSkyColor, uEnvSkyColor, uEnvTintStrength);
    vec3 groundColor = mix(baseGroundColor, uEnvGroundColor, uEnvTintStrength);
    vec3 hemiFill = (mix(groundColor, skyColor, N.y * 0.5 + 0.5) + vec3(1.0, 0.84, 0.64) * warmFill) * uAmbientIntensity;

    vec3 balancedKeyTint = mix(vec3(1.0), uKeyLightColor, 0.58);
    vec3 finalCol =
      albedo * balancedKeyTint * uKeyLightIntensity * wrapDiffuse * deepShadow +
      (colorR + colorTRT) * uKeyLightIntensity * deepShadow * (0.25 + 0.75 * h) +
      scatterTT +
      albedo * hemiFill * follicleAO;

    // Interactive Tool 3: Live Light Wand (illuminates micro-fur & SSS under cursor)
    if (uPointerActive > 0.5 && abs(uCursorTool - 3.0) < 0.4) {
      float dWand = distance(localPos, uPointerLocalPos);
      float wandAtten = 1.0 / (1.0 + dWand * dWand * 6.5);
      vec3 wandLight = mix(vec3(0.55, 0.88, 1.0), vec3(1.0, 0.85, 0.55), h);
      finalCol += (albedo + vec3(0.25)) * wandLight * wandAtten * 1.95;
    }

    // Interactive Tool 4: X-Ray Shader Lens (reveals underlying technical map inside spherical cursor lens)
    if (uPointerActive > 0.5 && abs(uCursorTool - 4.0) < 0.4) {
      float dLens = distance(localPos, uPointerLocalPos);
      float lensRadius = 0.46;
      if (dLens < lensRadius) {
        vec3 techCol = evaluateTechnicalShaderChannel(
          max(1.0, uLensChannel),
          localPos,
          N,
          T,
          V,
          L,
          h,
          combMemory,
          surfaceZone,
          follicleMask
        );
        float ring = smoothstep(lensRadius - 0.035, lensRadius - 0.01, dLens);
        finalCol = mix(techCol, vec3(0.45, 0.92, 1.0) * 1.6, ring);
      }
    }

    // Interactive Zone Isolation Dimming when user clicks a material zone in the JSON Spec Inspector
    if (uHighlightZone > 0.5) {
      float match = 1.0 - clamp(abs(surfaceZone - uHighlightZone), 0.0, 1.0);
      finalCol *= mix(0.22, 1.25, match);
    }

    return finalCol;
  }
`;

export const SHELL_VERTEX_SHADER = /* glsl */ `
  attribute float aFollicleMask;
  attribute vec3 aGroomTangent;
  attribute float aSurfaceZone;
  attribute float aShellIndex;

  uniform sampler2D uPhysicsTex;
  uniform float uFurLength;
  uniform float uClumping;
  uniform float uCurliness;
  uniform float uTime;
  uniform float uWindStrength;
  uniform vec3 uPointerLocalPos;
  uniform float uPointerActive;
  uniform float uCursorTool;
  uniform float uCharType;
  uniform float uGpuFurMode;
  uniform float uShellCountScale;
  uniform vec3 uWebGLInertia;
  uniform float uBoopShockwave;

  varying float vLayerHeight;
  varying float vFollicleMask;
  varying float vSurfaceZone;
  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec3 vSurfNormal;
  varying vec3 vHairTangent;
  varying float vCombMemory;

  ${COMMON_CLOTH_SOFTBODY_GLSL}

  vec2 normalToSphericalUV(vec3 n) {
    vec3 d = normalize(n);
    float u = atan(d.x, d.z) / (2.0 * 3.14159265) + 0.5;
    float v = 1.0 - acos(clamp(d.y, -1.0, 1.0)) / 3.14159265;
    return vec2(u, v);
  }

  void main() {
    float h = clamp(aShellIndex * uShellCountScale, 0.0, 1.0);
    vLayerHeight = h;
    vFollicleMask = aFollicleMask;
    vSurfaceZone = aSurfaceZone;
    vLocalPos = position;

    vec3 localNormal = normalize(normal);
    vec3 groomDir = normalize(aGroomTangent);
    vec3 sideDir = normalize(cross(localNormal, groomDir) + vec3(1e-4, 0.0, 0.0));

    vec3 gpuDisp = vec3(0.0);
    vCombMemory = 0.0;
    if (uGpuFurMode > 0.5) {
      vec2 simUV = normalToSphericalUV(localNormal);
      vec4 gpgpuData = texture2D(uPhysicsTex, simUV);
      gpuDisp = gpgpuData.xyz;
      vCombMemory = gpgpuData.w;
    } else {
      vec3 tangInertia = uWebGLInertia - localNormal * min(0.0, dot(uWebGLInertia, localNormal));
      gpuDisp = tangInertia;
      if (uBoopShockwave > 0.01) {
        float waveFront = (1.0 - uBoopShockwave) * 2.2;
        float dFront = abs(distance(localNormal, vec3(0.0, 0.1, 0.98)) - waveFront);
        if (dFront < 0.38) {
          float ripple = (1.0 - dFront / 0.38) * uBoopShockwave;
          vec3 radial = normalize(localNormal - vec3(0.0, 0.1, 0.98) + vec3(0.0, 1e-4, 0.0));
          gpuDisp += radial * ripple * 0.65;
        }
      }
      if (uPointerActive > 0.5) {
        float pDist = distance(position, uPointerLocalPos);
        if (pDist < 0.48) {
          vCombMemory = (1.0 - pDist / 0.48) * 0.65;
        }
      }
    }

    vec3 clothDisp = evaluateClothSoftBody(
      position,
      aSurfaceZone,
      uTime,
      uWindStrength,
      gpuDisp,
      uPointerLocalPos,
      uPointerActive,
      uCursorTool
    );

    float bendFactor = pow(h, 1.55);
    vec3 windWave = vec3(
      sin(position.y * 4.2 + uTime * 2.6) * 0.08,
      cos(position.x * 3.8 + uTime * 2.1) * 0.04,
      cos(position.z * 4.0 - uTime * 2.4) * 0.08
    ) * uWindStrength;

    vec3 pointerPush = vec3(0.0);
    if (uPointerActive > 0.5 && uCursorTool < 2.5) {
      float pDist = distance(position, uPointerLocalPos);
      float pushRad = (uCursorTool > 0.5 && uCursorTool < 1.5) ? 0.82 : 0.55;
      if (pDist < pushRad) {
        vec3 away = normalize(position - uPointerLocalPos + vec3(0.0, 1e-4, 0.0));
        away -= localNormal * dot(away, localNormal);
        float strength = (uCursorTool > 0.5 && uCursorTool < 1.5) ? 0.68 : 0.35;
        pointerPush = away * pow(1.0 - pDist / pushRad, 1.6) * strength;
      }
    }

    float zoneScale = 1.0;
    if (aSurfaceZone < 1.5) zoneScale = 0.36;
    else if (aSurfaceZone > 2.5 && aSurfaceZone < 3.5) {
      // Boost fluffy Moth Mane on The Radiance (charType == 5)
      zoneScale = abs(uCharType - 5.0) < 0.4 ? 1.15 : 0.52;
    } else if (aSurfaceZone >= 3.5) {
      zoneScale = 0.25;
    }

    float effectiveLen = uFurLength * aFollicleMask * zoneScale;

    float lockPhase = dot(position, vec3(5.4, 6.2, 5.0));
    float curlFreq = mix(3.2, 7.8, uCurliness);
    float wavePhase = h * curlFreq + lockPhase;
    float smoothEnv = h * h * (3.0 - 2.0 * h);
    float waveAmp = uCurliness * effectiveLen * 0.28 * smoothEnv;
    vec3 waveOffset = (sideDir * sin(wavePhase) + groomDir * (cos(wavePhase) - 1.0) * 0.55) * waveAmp;
    vec3 waveTangent = (sideDir * cos(wavePhase) - groomDir * sin(wavePhase) * 0.55) * (waveAmp * curlFreq);

    vec3 totalOffset =
      clothDisp +
      localNormal * (h * effectiveLen) +
      groomDir * (bendFactor * effectiveLen * (0.28 + 0.18 * uClumping)) +
      waveOffset +
      (gpuDisp * 0.42 + windWave + pointerPush) * bendFactor * effectiveLen;

    vec3 displacedLocal = position + totalOffset;
    vec4 worldPosition = modelMatrix * vec4(displacedLocal, 1.0);
    vWorldPos = worldPosition.xyz;

    vSurfNormal = normalize(mat3(modelMatrix) * localNormal);
    vec3 localHairDir = normalize(
      localNormal * max(0.001, effectiveLen) +
      groomDir * (1.55 * pow(max(0.05, h), 0.55) * effectiveLen * 0.35) +
      waveTangent +
      (gpuDisp * 0.42 + windWave + pointerPush) * 1.55 * pow(max(0.05, h), 0.55)
    );
    vHairTangent = normalize(mat3(modelMatrix) * localHairDir);

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const SHELL_FRAGMENT_SHADER = /* glsl */ `
  ${COMMON_HAIR_BSDF_GLSL}

  uniform float uClumping;
  uniform float uCurliness;
  uniform float uGpuFurMode;

  varying float vLayerHeight;
  varying float vFollicleMask;
  varying float vSurfaceZone;
  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec3 vSurfNormal;
  varying vec3 vHairTangent;
  varying float vCombMemory;

  vec2 octahedralUV(vec3 n) {
    vec3 d = n / (abs(n.x) + abs(n.y) + abs(n.z) + 1e-6);
    vec2 oct = d.y >= 0.0
      ? d.xz
      : (1.0 - abs(d.zx)) * vec2(d.x >= 0.0 ? 1.0 : -1.0, d.z >= 0.0 ? 1.0 : -1.0);
    return oct * 0.5 + 0.5;
  }

  vec3 hash23(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.xxz + p3.yxx) * p3.zyx);
  }

  void main() {
    if (vFollicleMask < 0.03) {
      discard;
    }

    float zoneFreqBoost = vSurfaceZone > 2.5 ? 1.35 : (vSurfaceZone < 1.5 ? 1.45 : 1.0);
    float gridScale = mix(58.0, 108.0, clamp(uFurDensity, 0.0, 1.0)) * zoneFreqBoost;
    vec2 baseUV = octahedralUV(normalize(vLocalPos + vec3(0.0, 0.35, 0.0)));
    vec2 warpedUV = baseUV + 0.008 * sin(baseUV.yx * 28.0);
    vec2 sampleUV = warpedUV * gridScale;

    vec2 clumpGrid = warpedUV * (gridScale * 0.24);
    vec2 clumpFract = fract(clumpGrid) - 0.5;
    sampleUV -= clumpFract * (vLayerHeight * uClumping * 1.65);

    vec2 cellId = floor(sampleUV);
    vec2 cellLocal = fract(sampleUV) - 0.5;
    vec3 rand = hash23(cellId);

    float densityFactor = clamp(uFurDensity * 1.08, 0.22, 1.0) * clamp(vFollicleMask * 1.25, 0.0, 1.0);
    float fiberMaxH = mix(0.32, 1.0, rand.z) * densityFactor;
    if (vLayerHeight > fiberMaxH) {
      discard;
    }

    float curlFreq = mix(3.2, 7.8, uCurliness);
    float curlAngle = vLayerHeight * curlFreq + rand.x * 6.28318;
    float smoothEnv = vLayerHeight * vLayerHeight * (3.0 - 2.0 * vLayerHeight);
    float curlRadius = (0.03 * uClumping + 0.12 * uCurliness) * smoothEnv;
    vec2 strandCenter = (rand.xy - 0.5) * 0.22 + vec2(cos(curlAngle), sin(curlAngle)) * curlRadius;
    float distToAxis = length(cellLocal - strandCenter);

    float normH = clamp(vLayerHeight / max(0.15, fiberMaxH), 0.0, 1.0);
    float maxRadius = 0.62 * (1.0 - pow(normH, 1.25));
    if (distToAxis > maxRadius) {
      discard;
    }

    vec3 color = evaluatePhysicalHairShading(
      vLocalPos,
      vWorldPos,
      vSurfNormal,
      vHairTangent,
      vLayerHeight,
      rand.x,
      vCombMemory,
      vSurfaceZone,
      vFollicleMask
    );

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const STRAND_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aRootPos;
  attribute vec3 aRootNormal;
  attribute vec3 aGroomDir;
  attribute vec3 aClumpOffset;
  attribute float aStrandSeed;
  attribute float aMaskValue;
  attribute float aStrandZone;

  uniform sampler2D uPhysicsTex;
  uniform float uFurLength;
  uniform float uFurDensity;
  uniform float uClumping;
  uniform float uCurliness;
  uniform float uTime;
  uniform float uWindStrength;
  uniform vec3 uPointerLocalPos;
  uniform float uPointerActive;
  uniform float uCursorTool;
  uniform float uCharType;
  uniform float uGpuFurMode;
  uniform vec3 uWebGLInertia;
  uniform float uBoopShockwave;

  varying float vHeight;
  varying float vRibbonU;
  varying float vStrandSeed;
  varying float vSurfaceZone;
  varying float vFollicleMask;
  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec3 vSurfNormal;
  varying vec3 vHairTangent;
  varying float vCombMemory;

  ${COMMON_CLOTH_SOFTBODY_GLSL}

  vec2 normalToSphericalUV(vec3 n) {
    vec3 d = normalize(n);
    float u = atan(d.x, d.z) / (2.0 * 3.14159265) + 0.5;
    float v = 1.0 - acos(clamp(d.y, -1.0, 1.0)) / 3.14159265;
    return vec2(u, v);
  }

  void main() {
    float h = position.y;
    vHeight = h;
    vRibbonU = position.x;
    vStrandSeed = aStrandSeed;
    vSurfaceZone = aStrandZone;
    vFollicleMask = aMaskValue;
    vLocalPos = aRootPos;

    if (aStrandSeed > uFurDensity || aMaskValue < 0.04) {
      gl_Position = vec4(2.0, 2.0, 2.0, 0.0);
      return;
    }

    vec3 N = normalize(aRootNormal);
    vec3 G = normalize(aGroomDir);
    vec3 sideVec = normalize(cross(N, G) + vec3(1e-4, 0.0, 0.0));

    vec3 gpuDisp = vec3(0.0);
    vCombMemory = 0.0;
    if (uGpuFurMode > 0.5) {
      vec2 simUV = normalToSphericalUV(N);
      vec4 gpgpuData = texture2D(uPhysicsTex, simUV);
      gpuDisp = gpgpuData.xyz;
      vCombMemory = gpgpuData.w;
    } else {
      gpuDisp = uWebGLInertia - N * min(0.0, dot(uWebGLInertia, N));
      if (uBoopShockwave > 0.01) {
        float waveFront = (1.0 - uBoopShockwave) * 2.2;
        float dFront = abs(distance(N, vec3(0.0, 0.1, 0.98)) - waveFront);
        if (dFront < 0.38) {
          float ripple = (1.0 - dFront / 0.38) * uBoopShockwave;
          vec3 radial = normalize(N - vec3(0.0, 0.1, 0.98) + vec3(0.0, 1e-4, 0.0));
          gpuDisp += radial * ripple * 0.65;
        }
      }
      if (uPointerActive > 0.5) {
        float pDist = distance(aRootPos, uPointerLocalPos);
        if (pDist < 0.48) {
          vCombMemory = (1.0 - pDist / 0.48) * 0.65;
        }
      }
    }

    vec3 clothDisp = evaluateClothSoftBody(
      aRootPos,
      aStrandZone,
      uTime,
      uWindStrength,
      gpuDisp,
      uPointerLocalPos,
      uPointerActive,
      uCursorTool
    );

    float zoneLenScale = 1.0;
    if (aStrandZone < 1.5) zoneLenScale = 0.40;
    else if (aStrandZone > 2.5 && aStrandZone < 3.5) {
      zoneLenScale = abs(uCharType - 5.0) < 0.4 ? 1.25 : 0.55;
    } else if (aStrandZone >= 3.5) {
      zoneLenScale = 0.25;
    }

    float lenVariation = 0.80 + 0.40 * fract(aStrandSeed * 17.31);
    float totalLen = uFurLength * aMaskValue * zoneLenScale * lenVariation * 1.12;

    float bend = pow(h, 1.55);
    float smoothEnv = h * h * (3.0 - 2.0 * h);

    vec3 windWave = vec3(
      sin(aRootPos.y * 4.4 + uTime * 2.7 + aStrandSeed * 3.14) * 0.08,
      cos(aRootPos.x * 3.9 + uTime * 2.2) * 0.04,
      cos(aRootPos.z * 4.1 - uTime * 2.5 + aStrandSeed * 3.14) * 0.08
    ) * uWindStrength;

    vec3 pointerPush = vec3(0.0);
    if (uPointerActive > 0.5 && uCursorTool < 2.5) {
      float pDist = distance(aRootPos, uPointerLocalPos);
      float pushRad = (uCursorTool > 0.5 && uCursorTool < 1.5) ? 0.85 : 0.58;
      if (pDist < pushRad) {
        vec3 away = normalize(aRootPos - uPointerLocalPos + vec3(0.0, 1e-4, 0.0));
        away -= N * dot(away, N);
        float strength = (uCursorTool > 0.5 && uCursorTool < 1.5) ? 0.78 : 0.42;
        pointerPush = away * pow(1.0 - pDist / pushRad, 1.6) * strength;
      }
    }

    vec3 tuftAnchor = aRootPos + aClumpOffset;
    float coherentPhase = dot(tuftAnchor, vec3(5.4, 6.2, 5.0)) + (fract(aStrandSeed * 43.17) - 0.5) * 0.65;
    float curlFreq = mix(3.2, 8.2, uCurliness);
    float spiralAngle = h * curlFreq + coherentPhase;

    float curlAmp = uCurliness * totalLen * 0.34 * smoothEnv;
    vec3 curlOffset =
      sideVec * (sin(spiralAngle) - sin(coherentPhase)) * curlAmp +
      G * (cos(spiralAngle) - cos(coherentPhase)) * (curlAmp * 0.65);

    vec3 curlTangent =
      (sideVec * cos(spiralAngle) - G * sin(spiralAngle) * 0.65) * (curlAmp * curlFreq);

    vec3 clumpPull = aClumpOffset * (smoothEnv * uClumping * totalLen * 0.68);

    vec3 spineLocal =
      aRootPos +
      clothDisp +
      N * (h * totalLen) +
      G * (bend * totalLen * 0.34) +
      clumpPull +
      curlOffset +
      (gpuDisp * 0.48 + windWave + pointerPush) * bend * totalLen;

    vec3 localTangent = normalize(
      N * max(0.001, totalLen) +
      G * (1.55 * pow(max(0.05, h), 0.55) * totalLen * 0.34) +
      clumpPull * 1.15 +
      curlTangent +
      (gpuDisp * 0.48 + windWave + pointerPush) * 1.55 * pow(max(0.05, h), 0.55)
    );

    vec3 worldSpine = (modelMatrix * vec4(spineLocal, 1.0)).xyz;
    vec3 worldTangent = normalize(mat3(modelMatrix) * localTangent);
    vSurfNormal = normalize(mat3(modelMatrix) * N);
    vHairTangent = worldTangent;

    vec3 viewDir = normalize(cameraPosition - worldSpine);
    vec3 billboardRight = normalize(cross(worldTangent, viewDir) + vec3(1e-5, 0.0, 0.0));

    float modelScale = length(modelMatrix[0].xyz);
    float modeWidthBoost = mix(1.32, 1.0, uGpuFurMode);
    float zoneWidthScale = aStrandZone < 1.5 ? 0.62 : (aStrandZone > 2.5 ? 0.78 : 0.95);
    float baseWidth = 0.0115 * zoneWidthScale * modeWidthBoost * (0.82 + 0.38 * (1.0 - uFurDensity)) * modelScale;
    float width = baseWidth * (1.0 - pow(h, 1.35));

    vec3 finalWorld = worldSpine + billboardRight * (position.x * width);
    vWorldPos = finalWorld;

    gl_Position = projectionMatrix * viewMatrix * vec4(finalWorld, 1.0);
  }
`;

export const STRAND_FRAGMENT_SHADER = /* glsl */ `
  ${COMMON_HAIR_BSDF_GLSL}

  varying float vHeight;
  varying float vRibbonU;
  varying float vStrandSeed;
  varying float vSurfaceZone;
  varying float vFollicleMask;
  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec3 vSurfNormal;
  varying vec3 vHairTangent;
  varying float vCombMemory;

  void main() {
    vec3 color = evaluatePhysicalHairShading(
      vLocalPos,
      vWorldPos,
      vSurfNormal,
      vHairTangent,
      vHeight,
      vStrandSeed,
      vCombMemory,
      vSurfaceZone,
      vFollicleMask
    );

    float radialDist = abs(vRibbonU);
    float cylinderRoundness = sqrt(max(0.18, 1.0 - radialDist * radialDist * 0.82));
    color *= (0.82 + 0.24 * cylinderRoundness);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ============================================================================
// BASE ANATOMY SURFACE SHADER (Chitin Shell SSS + Woven Cloak + Limbs + Infection Sacs)
// ============================================================================
export const KNIGHT_SURFACE_VERTEX_SHADER = /* glsl */ `
  attribute float aFollicleMask;
  attribute vec3 aGroomTangent;
  attribute float aSurfaceZone;

  uniform float uTime;
  uniform float uWindStrength;
  uniform vec3 uWebGLInertia;
  uniform vec3 uPointerLocalPos;
  uniform float uPointerActive;
  uniform float uCursorTool;

  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  varying float vFollicleMask;
  varying float vSurfaceZone;
  varying vec3 vGroomTangent;

  ${COMMON_CLOTH_SOFTBODY_GLSL}

  void main() {
    vLocalPos = position;
    vUv = uv;
    vFollicleMask = aFollicleMask;
    vSurfaceZone = aSurfaceZone;
    vGroomTangent = aGroomTangent;

    vec3 clothDisp = evaluateClothSoftBody(
      position,
      aSurfaceZone,
      uTime,
      uWindStrength,
      uWebGLInertia,
      uPointerLocalPos,
      uPointerActive,
      uCursorTool
    );
    vec3 displaced = position + clothDisp;

    vec4 wp = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);

    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const KNIGHT_SURFACE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uTipColor;
  uniform vec3 uMaskColor;
  uniform vec3 uCoreColor;
  uniform float uWearAmount;
  uniform float uCharType;
  uniform vec3 uKeyLightDir;
  uniform vec3 uKeyLightColor;
  uniform float uKeyLightIntensity;
  uniform vec3 uRimLightDir;
  uniform vec3 uRimLightColor;
  uniform float uRimIntensity;
  uniform float uAmbientIntensity;
  uniform float uRenderMode;
  uniform float uCursorTool;
  uniform float uLensChannel;
  uniform float uHighlightZone;
  uniform vec3 uPointerLocalPos;
  uniform float uPointerActive;
  uniform float uTime;

  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  varying float vFollicleMask;
  varying float vSurfaceZone;
  varying vec3 vGroomTangent;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float evaluateChitinMicroWear(vec3 p, float wearScale) {
    vec2 uv1 = p.xy * 18.0 + vec2(p.z * 9.0, -p.z * 7.0);
    float finePore = valueNoise(uv1 * 3.5);
    float s1 = smoothstep(0.955, 0.995, sin(p.x * 58.0 + p.y * 42.0 + valueNoise(uv1 * 2.2) * 3.5));
    float s2 = smoothstep(0.965, 0.996, cos(p.y * 74.0 - p.x * 31.0 + valueNoise(uv1 * 3.1) * 4.0));
    return clamp((finePore * 0.25 + (s1 + s2) * 0.75) * (0.35 + 1.15 * wearScale), 0.0, 1.0);
  }

  float evaluateWovenFabric(vec3 p) {
    float az = atan(p.x, p.z);
    vec2 weaveUV = vec2(az * 95.0, p.y * 220.0);
    float warp = sin(weaveUV.x) * 0.5 + 0.5;
    float weft = sin(weaveUV.y + sin(weaveUV.x * 0.5) * 1.2) * 0.5 + 0.5;
    float pleatCrease = sin(az * 9.0) * 0.5 + 0.5;
    return clamp(warp * 0.35 + weft * 0.35 + pleatCrease * 0.30, 0.0, 1.0);
  }

  vec3 evaluateSurfaceTechnicalChannel(float channel, vec3 N, vec3 V, vec3 L, float wear, float weave) {
    // Channel 1: Dynamic Fur Grooming & Cloth Wind-Resistance Weight Map
    if (channel < 1.5) {
      vec3 baseShell = vec3(0.08, 0.10, 0.14);
      vec3 maskRimCol = vec3(0.15, 0.52, 0.98) * clamp(vFollicleMask * 2.2, 0.0, 1.0);
      vec3 cloakMapCol = mix(vec3(0.28, 0.12, 0.42), vec3(0.98, 0.20, 0.55), clamp(vFollicleMask * 0.85, 0.0, 1.0));
      vec3 limbMapCol = vec3(0.06, 0.82, 0.74) * clamp(vFollicleMask * 1.6, 0.0, 1.0);
      vec3 coreMapCol = vec3(1.0, 0.62, 0.08);

      vec3 mapCol = baseShell + maskRimCol;
      if (vSurfaceZone > 1.5 && vSurfaceZone < 2.5) mapCol = cloakMapCol;
      else if (vSurfaceZone > 2.5 && vSurfaceZone < 3.5) mapCol = limbMapCol;
      else if (vSurfaceZone >= 3.5) mapCol = coreMapCol;

      float flowStripe = sin(dot(vLocalPos, vGroomTangent) * 65.0) * 0.5 + 0.5;
      return mapCol * (0.85 + 0.25 * flowStripe);
    }

    // Channel 2: Hard Carapace vs. Soft Cloth Displacement Map
    if (channel < 2.5) {
      float disp = 0.5;
      if (vSurfaceZone < 1.5) disp = 0.84 - wear * 0.42;
      else if (vSurfaceZone < 2.5) disp = 0.28 + weave * 0.26 + clamp(vFollicleMask - 0.5, 0.0, 0.8) * 0.35;
      else if (vSurfaceZone < 3.5) disp = 0.14 + valueNoise(vLocalPos.xy * 90.0) * 0.16;
      else disp = 0.92;
      return vec3(disp);
    }

    // Channel 3: Subsurface Scattering (SSS) & Infection Sac Map
    if (channel < 3.5) {
      float fresnel = pow(1.0 - max(0.0, dot(N, V)), 1.8);
      if (vSurfaceZone >= 3.5) {
        return vec3(1.0, 0.48, 0.06) * (1.25 + 0.4 * sin(uTime * 4.5));
      }
      if (vSurfaceZone < 1.5) {
        return mix(vec3(0.32, 0.16, 0.12), vec3(0.98, 0.84, 0.72), fresnel * 0.85 + 0.20);
      }
      return mix(vec3(0.06, 0.12, 0.22), uCoreColor + vec3(0.15, 0.35, 0.55), fresnel * 0.75);
    }

    // Channel 4: Clean Quad/Tri Topology Reference
    float diff = clamp(dot(N, L) * 0.5 + 0.5, 0.18, 1.0);
    float rim = pow(1.0 - max(0.0, dot(N, V)), 2.8) * 0.55;
    vec3 clayBase = vSurfaceZone < 1.5
      ? vec3(0.72, 0.75, 0.80)
      : (vSurfaceZone < 2.5 ? vec3(0.32, 0.35, 0.42) : vec3(0.18, 0.20, 0.25));
    float az = atan(vLocalPos.x, vLocalPos.z);
    vec2 gridCoord = vSurfaceZone < 1.5
      ? vec2(vLocalPos.x * 26.0, vLocalPos.y * 26.0)
      : vec2(az * 14.0, vLocalPos.y * 28.0);
    vec2 gridFract = abs(fract(gridCoord - 0.5) - 0.5);
    float wire = 1.0 - smoothstep(0.03, 0.08, min(gridFract.x, gridFract.y));
    return mix(clayBase * diff + vec3(rim * 0.4), vec3(0.38, 0.78, 1.0), wire * 0.75);
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uKeyLightDir);
    vec3 Lrim = normalize(uRimLightDir);

    float wear = evaluateChitinMicroWear(vLocalPos, uWearAmount);
    float weave = evaluateWovenFabric(vLocalPos);

    if (uRenderMode > 0.5) {
      vec3 tech = evaluateSurfaceTechnicalChannel(uRenderMode, N, V, L, wear, weave);
      gl_FragColor = vec4(tech, 1.0);
      return;
    }

    float NdotL = dot(N, L);
    float diffWrap = clamp((NdotL + 0.35) / 1.35, 0.0, 1.0);
    vec3 H = normalize(L + V);
    float NdotH = max(0.0, dot(N, H));
    float fresnel = pow(1.0 - max(0.0, dot(N, V)), 2.5);
    float backRim = pow(clamp(dot(V, -Lrim + N * 0.35), 0.0, 1.0), 2.2);

    vec3 rimLightTint = mix(uRimLightColor, vec3(0.74, 0.90, 1.0), 0.5);
    vec3 warmFillDir = normalize(vec3(-0.7, -0.2, 0.65));
    float warmFill = max(0.0, dot(N, warmFillDir)) * 0.25;

    vec3 col = vec3(0.0);

    if (vSurfaceZone < 1.5) {
      // 1. CHITIN MASK / WYRM CROWN (Matte-Satin Shell + Subsurface Scattering + Structural Wear)
      vec3 chitinBase = uMaskColor * (0.96 - 0.14 * wear);

      // Structural diagonal eye crack on The Hollow Knight (charType == 1)
      if (abs(uCharType - 1.0) < 0.4) {
        float crackDist = abs((vLocalPos.x + 0.15) * 1.45 - (vLocalPos.y - 0.44) * 0.85 + 0.015 * sin(vLocalPos.y * 45.0));
        float crackMask = (1.0 - smoothstep(0.008, 0.024, crackDist)) * smoothstep(0.18, 0.26, vLocalPos.z) * step(vLocalPos.x, 0.02);
        vec3 crackGlow = vec3(1.0, 0.45, 0.05) * (0.8 + 0.3 * sin(uTime * 3.8));
        chitinBase = mix(chitinBase, crackGlow, crackMask);
      }

      // Grumpy mandible line on Zote the Mighty (charType == 6)
      if (abs(uCharType - 6.0) < 0.4 && vLocalPos.z > 0.18) {
        float mouthWave = vLocalPos.y - (0.28 - 0.04 * abs(vLocalPos.x * 4.0) + 0.025 * vLocalPos.x);
        float frownMask = (1.0 - smoothstep(0.006, 0.016, abs(mouthWave))) * step(abs(vLocalPos.x), 0.18);
        chitinBase *= (1.0 - 0.78 * frownMask);
      }

      // Ink spots on Cornifer (charType == 7)
      if (abs(uCharType - 7.0) < 0.4) {
        float inkSpot = smoothstep(0.76, 0.82, valueNoise(vLocalPos.xy * 24.0));
        chitinBase *= (1.0 - 0.55 * inkSpot);
      }

      // Subsurface Scattering (warm ivory internal scatter + cool blue-white contour rim)
      float sssThickness = clamp(1.0 - abs(dot(N, L)), 0.0, 1.0);
      vec3 sssWarm = vec3(0.96, 0.84, 0.72) * pow(sssThickness, 1.8) * 0.28 * uKeyLightIntensity;
      float specChitin = pow(NdotH, mix(48.0, 14.0, wear)) * (0.32 - 0.16 * wear);
      vec3 contourRim = rimLightTint * (fresnel * 0.85 + backRim * 0.65) * uRimIntensity * 0.72;

      col =
        chitinBase * (0.32 * uAmbientIntensity + diffWrap * uKeyLightIntensity * 0.82 * uKeyLightColor + vec3(1.0, 0.85, 0.65) * warmFill) +
        sssWarm +
        vec3(specChitin) * uKeyLightColor * uKeyLightIntensity +
        contourRim;
    } else if (vSurfaceZone < 2.5) {
      // 2. SOFT-BODY CLOAK / SILK SKIRT / TRENCH COAT / CEREMONIAL ROBES
      vec3 clothAlbedo = mix(uBaseColor * 0.48, uBaseColor, 0.55) * (0.82 + 0.34 * weave);
      float fabricSheen = pow(1.0 - max(0.0, dot(N, V)), 2.2);
      vec3 clothSSS = mix(uBaseColor, uTipColor, 0.65) * (fabricSheen * 0.55 + backRim * 0.75) * uRimIntensity * 0.65;
      vec3 rimEdge = rimLightTint * pow(fresnel, 1.4) * uRimIntensity * 0.58;

      col =
        clothAlbedo * (0.36 * uAmbientIntensity + diffWrap * uKeyLightIntensity * 0.88 * uKeyLightColor + vec3(1.0, 0.85, 0.65) * warmFill) +
        clothSSS +
        rimEdge;
    } else if (vSurfaceZone < 3.5) {
      // 3. VELVETY LIMBS / MOTH MANE UNDERCOAT
      vec3 limbBase = abs(uCharType - 5.0) < 0.4
        ? vec3(0.88, 0.78, 0.58)
        : (abs(uCharType - 7.0) < 0.4 ? vec3(0.18, 0.10, 0.05) : vec3(0.025, 0.03, 0.048));
      float velvetNap = pow(1.0 - max(0.0, dot(N, V)), 1.85);
      vec3 velvetRim = mix(vec3(0.45, 0.75, 1.0), uTipColor, 0.45) * velvetNap * (0.45 + 0.55 * uRimIntensity);
      col = limbBase * (0.35 + 0.65 * diffWrap * uKeyLightIntensity) + velvetRim * 0.55;
    } else {
      // 4. VOLATILE INFECTION CORE / GOLD FILIGREE / PARCHMENT SCROLLS / MONOMON CREST
      float pulse = 0.82 + 0.18 * sin(uTime * 3.8 + vLocalPos.y * 8.0);
      vec3 sssCore = uCoreColor * (0.65 + 0.55 * diffWrap) + mix(uCoreColor, vec3(1.0, 0.92, 0.65), fresnel * 0.75) * pulse * 0.95;
      col = sssCore;
    }

    // Interactive Tool 3: Live Light Wand
    if (uPointerActive > 0.5 && abs(uCursorTool - 3.0) < 0.4) {
      float dWand = distance(vLocalPos, uPointerLocalPos);
      float wandAtten = 1.0 / (1.0 + dWand * dWand * 6.5);
      col += (col + vec3(0.18, 0.28, 0.38)) * wandAtten * 2.1;
    }

    // Interactive Tool 4: X-Ray Shader Lens
    if (uPointerActive > 0.5 && abs(uCursorTool - 4.0) < 0.4) {
      float dLens = distance(vLocalPos, uPointerLocalPos);
      float lensRadius = 0.46;
      if (dLens < lensRadius) {
        vec3 techCol = evaluateSurfaceTechnicalChannel(max(1.0, uLensChannel), N, V, L, wear, weave);
        float ring = smoothstep(lensRadius - 0.035, lensRadius - 0.01, dLens);
        col = mix(techCol, vec3(0.45, 0.92, 1.0) * 1.6, ring);
      }
    }

    // Anatomical Zone Isolation Dimming
    if (uHighlightZone > 0.5) {
      float match = 1.0 - clamp(abs(vSurfaceZone - uHighlightZone), 0.0, 1.0);
      col *= mix(0.20, 1.28, match);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;
