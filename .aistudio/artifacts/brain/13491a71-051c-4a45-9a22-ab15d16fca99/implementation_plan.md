# Hollow Knight 3D Character Reference & GPU Fur Simulation

A robust, production-grade WebGL/Three.js interactive character reference and groom look-development studio for 10 iconic Hollow Knight characters, featuring multi-angle turnaround views, real-time GPU micro-fur, soft-body cloth dynamics, physical lighting passes, and interactive shader inspection tools.

---

### Issues Resolved & Decisions Implemented

> [!NOTE]
> All blocking runtime exceptions and roster discrepancies have been diagnosed, resolved, and verified:

1. **Fixed `createEnvironmentManager` Calling Convention Bug**:
   - *Cause*: `src/environments.js` was expecting an options object `{ scene, renderer, ... }`, but was called in `src/main.js` with positional arguments `(scene, camera, renderer)`. Consequently, `scene` was `undefined`, throwing `TypeError: Cannot read properties of undefined (reading 'add')` when creating the studio environment.
   - *Fix*: `createEnvironmentManager` now natively supports both positional arguments `(scene, camera, renderer)` and options objects `{ scene, renderer, container, ... }` with safe fallbacks for all light handles and uniform structures (`furUniforms`).

2. **Fixed `TorusknotGeometry` Syntax Error**:
   - *Cause*: In `src/blobCreature.js`, an expression `new THREE.TorusknotGeometry ? ...` threw `TypeError: THREE.TorusknotGeometry is not a constructor` when loading The Pale King.
   - *Fix*: Replaced with `new THREE.TorusGeometry(0.11, 0.022, 16, 36)`.

3. **Unified 10-Character Canonical Roster (Keys `1`–`9`, `0`)**:
   - Fully standardized schemas and sculpted geometry for all 10 characters:
     1. `the_knight`: The Knight (Vessel of the Abyss, Pure Nail)
     2. `the_hollow_knight`: The Hollow Knight / Pure Vessel (Corrupted Greatnail, SSS Infection Sacs)
     3. `hornet`: Hornet (Needle & Silk Thread, crimson cloak)
     4. `quirrel`: Quirrel (Curved Explorer's Nail, Monomon's Mask)
     5. `cloth`: Cloth (Prickly Great-Club, cicada warrior hood)
     6. `grimm`: Troupe Master Grimm (Scarlet Nightmare Flame Orbs, bat-wing cloak)
     7. `the_pale_king`: The Pale King (Pale Court Sigil Halo, Wyrm Crown-Mask, monarch robes)
     8. `the_radiance`: The Radiance (Halo of Dream Swords, moth fur mane, light-feather wings)
     9. `zote_the_mighty`: Zote the Mighty (Life Ender shellwood sword, lopsided horned mask)
     10. `cornifer`: Cornifer the Cartographer (Map bundle & quill, weevil mask, traveler's cloak)

4. **Defensive UI Hardening**:
   - Replaced fragile direct property lookups in `src/ui.js` with optional chaining (`spec?.body_and_attire?.cloak?.material`) to prevent uncaught runtime errors during character transitions.

5. **Fixed `Cannot read properties of undefined (reading 'position')` in Environment Update Loop**:
   - *Cause*: `envManager.update` was invoked with `(dt, elapsed)` missing the 3rd parameter `creatureRoot`, causing `creatureRoot.position.y` to throw a `TypeError`.
   - *Fix*: Made `creatureRoot` parameter optional with fallback coordinates (`creatureRoot?.position || { x: 0, y: 0, z: 0 }`), and updated call in `src/main.js` to pass `(elapsed, simState.windStrength, creature.root)`.

6. **Implemented `gpuPhysics.reset` and `getTexture`**:
   - *Cause*: `src/main.js` called `gpuPhysics.reset()` on character change and groom reset, but `createGPUFurPhysics` did not expose a `reset()` method.
   - *Fix*: Added `reset()`, `getTexture()`, and `supported` getter to `createGPUFurPhysics` in `src/gpuPhysics.js`, and added defensive type checks before invocations.

7. **Eliminated `computeBoundingSphere() Computed radius is NaN` across Geometries**:
   - *Cause*: Cylinder, cone, and pleating formulas computed `Math.pow(t, exponent)` with non-integer exponents (e.g. 2.5, 1.6, 0.85) where floating point boundary coordinates slightly exceeded bounds, causing `Math.pow(negativeNumber, nonInt)` to return `NaN`.
   - *Fix*: Added `safePow(base, exp) = Math.pow(Math.max(0.0, base), exp)` and clamped `t = Math.max(0.0, Math.min(1.0, ...))` across all 10 character sculpts in `src/blobCreature.js`, eliminating `NaN` coordinates and ensuring valid bounding spheres.

8. **Dynamic Performance & Strand Count Scaling**:
   - Added dynamic instanced buffer count scaling in `src/furSystem.js` tied to `furDensity`, allowing real-time adjustment of active strand counts (60,000 down to 9,000) for sustained 60 FPS performance on any hardware.

9. **Implemented `gpuPhysics.update` for Per-Frame Physics Simulation**:
   - *Cause*: `src/main.js` called `gpuPhysics.update(dt, elapsed, { ... })` during each frame of the render loop, but `src/gpuPhysics.js` only exposed `step`.
   - *Fix*: Implemented `update(dt, time, options)` in `src/gpuPhysics.js` with full backward compatibility (handling both object and positional signatures, inertia fallbacks, and shockwave propagation), exported it, and added defensive existence guards in `src/main.js`.
10. **Decluttering, Modern Minimal Redesign & Viewport Maximization**:
   - **Ultra-Clean Header Bar (`#studio-header`)**: Replaced multiple rows of buttons with a unified modern pill containing:
     - Left: Branding with live selected character badge (`HALLOWNEST / The Knight`).
     - Center: Camera angle segmented control (*3/4 Hero*, *Front*, *Side*, *Free Orbit*, *3-View Sheet*).
     - Right: Floating dropdown menus for Lighting (*Studio*, *Twilight*, *Sanctum*, *Abyss*) and Render Passes (*Beauty*, *Groom*, *Displacement*, *SSS*, *Topology*), a quick Action burst button (`Space`), and a Controls inspector toggle (`I`).
   - **Single Sleek Floating Dock (`.studio-dock`)**: Replaced the previous bulky two-story card stack with a single 40px capsule containing:
     - 5 cursor tools (*Groom*, *Wind*, *Action*, *Light*, *X-Ray* with keycaps `Q`, `W`, `E`, `R`, `T`).
     - Dynamic X-Ray map chips only visible when X-Ray tool is active.
     - 10 canonical Hollow Knight characters (`1`–`9`, `0`) with individual color accent beads.
   - **Unobstructed 3D Interaction Viewport**:
     - Defaults to **3/4 Hero** with active OrbitControls so users can freely orbit, drag, and zoom in 3D right away.
     - Controls sidebar (`#ui-root`) is tucked away as a clean slide-out drawer (`drawer-hidden` by default) toggled with `I` or the Controls button.
     - Keyboard shortcut guide moved to a subtle bottom-left pill that fades out cleanly.

---

## Technical Architecture & State Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Application Root                               │
│                         (index.html & style.css)                            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐
│     Three.js Viewport (main)  │             │     DOM UI & Toolbelt (ui)    │
│  - 3-Point Studio Lighting    │             │  - 10-Character Roster Bar    │
│  - Synchronized Cam Scissor   │◄────────────┤  - 5-Mode Cursor Toolbelt     │
│  - Orbit Controls             │             │  - Zone Highlight Cards       │
│  - Ground Shadow & Particles  │             │  - Live JSON Spec Modal       │
└───────────────┬───────────────┘             └───────────────┬───────────────┘
                │                                             │
      ┌─────────┴─────────┐                         ┌─────────┴─────────┐
      ▼                   ▼                         ▼                   ▼
┌───────────────┐   ┌───────────────┐         ┌───────────────┐   ┌───────────┐
│ blobCreature  │   │   furSystem   │         │characterSpecs │   │environments│
│ - 10 Chars    │   │ - 64 Shells   │         │ - 10 Schemas  │   │ - Studio  │
│ - Mask/Horns  │   │ - Scalable    │         │ - Wiki Quotes │   │ - Three-  │
│ - Cloaks/Wings│   │   Strands     │         │ - Sim Presets │   │   Point   │
│ - Props/Weapons│  │ - BSDF Shaders│         │ - Live Synced │   │   Rig     │
└───────────────┘   └───────────────┘         └───────────────┘   └───────────┘
```
