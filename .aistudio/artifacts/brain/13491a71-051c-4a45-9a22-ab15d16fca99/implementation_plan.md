# Hollow Knight 3D Character Reference & GPU Fur Simulation

A robust, production-grade WebGL/Three.js interactive character reference and groom look-development studio for 10 iconic Hollow Knight characters, featuring multi-angle turnaround views, real-time GPU micro-fur, soft-body cloth dynamics, physical lighting passes, and interactive shader inspection tools.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were clarified and confirmed during the intake interview:

- **Confirmed Decision 1 (10-Character Roster)**: We will include all 10 canonical characters in the application roster (Keys `1` through `0`):
  1. `the_knight`: The Knight (Vessel of the Abyss, Pure Nail)
  2. `the_hollow_knight`: The Hollow Knight / Pure Vessel (Corrupted Greatnail, SSS Infection Sacs)
  3. `hornet`: Hornet (Needle & Silk Thread, crimson cloak)
  4. `quirrel`: Quirrel (Curved Explorer's Nail, Monomon's Mask)
  5. `cloth`: Cloth (Prickly Great-Club, Cicada warrior hood)
  6. `grimm`: Troupe Master Grimm (Scarlet Nightmare Flame Orbs, bat-wing cloak)
  7. `the_pale_king`: The Pale King (Pale Court Sigil Halo, Wyrm Crown-Mask, monarch robes)
  8. `the_radiance`: The Radiance (Halo of Dream Swords, moth fur mane, light-feather wings)
  9. `zote_the_mighty`: Zote the Mighty (Life Ender shellwood sword, lopsided horned mask)
  10. `cornifer`: Cornifer the Cartographer (Map bundle & quill, weevil mask, traveler's cloak)

- **Confirmed Decision 2 (Pipeline Scope)**: The application will operate as a focused, high-performance browser-based 3D reference and groom look-development workstation (with real-time JSON pipeline viewer and clipboard copy), without external 3D DCC mesh/groom file export.

- **Confirmed Root Cause & Fix (Runtime Crash)**: In `src/characterSpecs.js`, characters like The Pale King and The Radiance used non-standard nested keys (`head_crown`, `attire`, `wings_and_fur`) rather than the uniform `head_mask` and `body_and_attire` structure. Accessing `spec.body_and_attire.cloak` threw unhandled `TypeError` exceptions in `src/ui.js` that crashed execution. We will standardize the schema across all 10 characters with defensive safe navigation (`spec?.body_and_attire?.cloak ?? ...`).

---

## 1. Overview & Core Concept

- **What It Does**: Renders an interactive 3D character turnaround sheet (simultaneous Front `0°`, Hero Three-Quarter `-36°`, and Side Profile `90°`) or single free-orbit view on a neutral dark-gray studio backdrop. Features 60,000 GPU-instanced fur/velvet fibers, soft-body cloth physics, Marschner hair shading, and multi-channel technical inspection passes.
- **Target Audience**: Technical artists, 3D character modelers, groom artists, and Hollow Knight lore enthusiasts looking for precise material zoning, silhouette, and simulation reference.
- **Key Value**: Instantaneous switching between 10 characters with true-to-lore geometry, reactive physics, and interactive inspection tools (Groom Brush, Wind Vortex, Lore Action, Light Wand, and X-Ray Shader Lens).

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Character Exploration**: User taps keys `1`–`9` or `0` (or clicks the bottom roster cards) to swap characters. The base geometry, material zones, particle effects, and weapon models instantaneously rebuild without stutter.
  2. **View Angle Switch**: User toggles between the 3-View Turnaround Reference Sheet and focused Full-Viewport views (`Three-Quarter`, `Front`, `Side`).
  3. **Interactive Toolbelt**:
     - `Q` — Groom Brush: Interactively combs and parts fur fibers.
     - `W` — Wind Vortex: Generates dynamic swirling wind to billow soft-body cloth and moth wings.
     - `E` / `Space` — Signature Lore Action: Triggers unique character animations and shockwaves.
     - `R` — Light Wand: Drags a 3D dual-spectrum point light for SSS and rim specular inspection.
     - `T` — X-Ray Shader Lens: Magnifies internal passes (Groom Weight, Carapace Displacement, SSS, or Topology).
  4. **Material Zone Highlighting**: Hovering/clicking on any of the 4 anatomical zones isolates and pulses that region on the 3D model.
  5. **Performance / Quality Control**: Adds an interactive strand-count / quality toggle (Ultra 60k, High 30k, Performance 12k) so the sim runs at a steady 60 FPS on any hardware.

- **Visual Identity & Theme**:
  - *Aesthetic*: Minimalist, technical dark-mode studio cyclorama inspired by UE5 LookDev viewports and dark fantasy Hallownest aesthetics.
  - *Color Palette*: Deep studio obsidian (`#090c12`), dark slate cards (`rgba(13, 16, 24, 0.94)`), Hallownest Soul-blue accents (`#38bdf8`, `#7dd3fc`), and character-specific accent tags.
  - *Typography*: Google Sans / Plus Jakarta Sans for UI text, Cinzel for character titles, and JetBrains Mono for technical telemetry and shader coordinates.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Schema Normalization & Defensive Safe Accessors**
  - *Chosen Approach*: Standardize all 10 character entries in `src/characterSpecs.js` to strictly provide `head_mask`, `body_and_attire`, and `weapon`/`props` objects with uniform fields. Add fallback optional-chaining in `src/ui.js` (`spec?.head_mask?.material || 'Matte Carapace'`).
  - *Why*: Eliminates `TypeError` exceptions during character selection and ensures the live JSON viewer output conforms to the structured JSON specification.

- **Decision 2: Procedural Geometry for Zote and Cornifer**
  - *Chosen Approach*: Implement distinctive 3D procedural sculpts for Zote the Mighty (dull grey chipped mask, clumsy uneven horns, dingy purple-brown cloak, wooden Life Ender sword) and Cornifer (warm amber weevil mask with curved proboscis trunk and spectacles, plump velvet body, green-brown traveler's cloak, and map bundle/quill).
  - *Why*: Delivers all 10 characters with authentic, visually distinct silhouettes matching Hollow Knight Wiki reference art.

- **Decision 3: Scalable Strand Count & Quality Level**
  - *Chosen Approach*: Expose a strand density/count slider and quality presets (`Ultra: 60k`, `High: 30k`, `Medium: 15k`) in the inspector.
  - *Why*: Solves potential frame drops on lower-powered devices without diminishing visual fidelity on high-end GPUs.

---

## 4. Technical Architecture & Data Strategy

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
│ - Mask/Horns  │   │ - 60k Strands │         │ - Wiki Quotes │   │ - Three-  │
│ - Cloaks/Wings│   │ - BSDF Shaders│         │ - Sim Presets │   │   Point   │
│ - Props/Weapons│  │ - X-Ray Lens  │         │ - Live Synced │   │   Rig     │
└───────────────┘   └───────────────┘         └───────────────┘   └───────────┘
```

### Execution Steps
1. **Schema Standardization (`src/characterSpecs.js`)**: Format all 10 characters with consistent `head_mask`, `body_and_attire`, and `weapon` schemas, including complete wiki quotes and calibrated presets.
2. **Defensive UI Hardening (`src/ui.js`)**: Update `renderAnatomyZoneCards` and `updateCharacterPresentation` to safely navigate all character structures with fallbacks and support hotkeys `1` through `0`.
3. **Procedural Rigs for Zote & Cornifer (`src/blobCreature.js`)**: Add geometry generation, mask contours, cloaks, and weapons for Zote and Cornifer.
4. **Strand Count & Quality Control (`src/furSystem.js` & `src/ui.js`)**: Allow dynamic adjustment of active strand counts for scalable performance.
5. **Verification & Smoke-Testing**: Recompile, run unit/smoke tests on all 10 characters and 5 tools, and confirm clean rendering in the dev server.
