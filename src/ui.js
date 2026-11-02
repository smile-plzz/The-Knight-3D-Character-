// Interactive UI, 8-Character Hollow Knight Lore Switcher, Cursor Toolbelt (Comb, Wind Vortex,
// Signature Action, Light Wand, X-Ray Shader Lens), Interactive Material Zone Inspector,
// and Live JSON Pipeline Specification Viewer.

import { ENVIRONMENT_PRESETS, sanitizeEnvId } from './environments.js';
import {
  PIPELINE_METADATA,
  CHARACTER_SPECS,
  getCharacterSpecById
} from './characterSpecs.js';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function clampNum(val, min, max, fallback) {
  const n = Number(val);
  if (Number.isNaN(n) || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeHexColor(val, fallback) {
  if (typeof val === 'string' && HEX_COLOR_REGEX.test(val.trim())) {
    return val.trim().toLowerCase();
  }
  return fallback;
}

export const VIEW_MODES = [
  { id: 'three_quarter', label: '3/4 Hero', shortLabel: '3/4', badge: '-36° Hero' },
  { id: 'front', label: 'Front', shortLabel: 'Front', badge: '0° Front' },
  { id: 'side', label: 'Side', shortLabel: 'Side', badge: '90° Side' },
  { id: 'orbit', label: 'Free Orbit', shortLabel: 'Orbit', badge: 'Free 3D' },
  { id: 'turnaround', label: '3-View Sheet', shortLabel: 'Sheet', badge: '0° · -36° · 90°' }
];

export const RENDER_MODES = [
  { id: 0, label: 'Final Beauty (UE5 / Cycles)', shortLabel: 'Beauty' },
  { id: 1, label: 'Groom & Fur Map', shortLabel: 'Groom' },
  { id: 2, label: 'Displacement Map', shortLabel: 'Displacement' },
  { id: 3, label: 'Subsurface Scattering (SSS)', shortLabel: 'SSS' },
  { id: 4, label: 'Clean Topology Wireframe', shortLabel: 'Topology' }
];

export const CURSOR_TOOLS = [
  {
    id: 0,
    key: 'Q',
    label: 'Groom Brush',
    shortLabel: 'Groom',
    desc: 'Comb & part 60k micro-fur & cloak fibers'
  },
  {
    id: 1,
    key: 'W',
    label: 'Wind Vortex',
    shortLabel: 'Wind',
    desc: 'Billow soft-body cloak, silk & moth wings'
  },
  {
    id: 2,
    key: 'E',
    label: 'Lore Action',
    shortLabel: 'Action',
    desc: 'Trigger signature weapon & particle burst'
  },
  {
    id: 3,
    key: 'R',
    label: 'Light Wand',
    shortLabel: 'Light',
    desc: 'Move live dual-spectrum SSS & rim light'
  },
  {
    id: 4,
    key: 'T',
    label: 'X-Ray Lens',
    shortLabel: 'X-Ray',
    desc: 'Magnify internal shader maps on hover'
  }
];

function createActionIcon(type) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const path = document.createElementNS(svgNS, 'path');
  if (type === 'comb') {
    path.setAttribute('d', 'M4 6h16M4 12h16M4 18h10');
  } else if (type === 'reset') {
    path.setAttribute('d', 'M3 12a9 9 0 1 0 3-6.7L3 8v-5');
  } else if (type === 'chevron') {
    path.setAttribute('d', 'M6 9l6 6 6-6');
  } else if (type === 'spark') {
    path.setAttribute('d', 'M13 2L3 14h9l-1 8 10-12h-9l1-8z');
  } else if (type === 'code') {
    path.setAttribute('d', 'M16 18l6-6-6-6M8 6l-6 6 6 6');
  }
  svg.appendChild(path);
  return svg;
}

export function initUI(
  container,
  state,
  onChange,
  onAction,
  onEnvironmentSelect,
  onViewModeSelect,
  onCharacterSelect
) {
  container.textContent = '';

  const viewNavUpdaters = [];
  const renderPassUpdaters = [];
  const characterUpdaters = [];
  const toolUpdaters = [];
  const zoneUpdaters = [];

  // -------------------------------------------------------------------------
  // 1. TOP BAR: View Mode Switcher + Dropdowns + Spec Modal + Inspector
  // -------------------------------------------------------------------------
  const viewNav = document.getElementById('view-mode-nav');
  if (viewNav) {
    viewNav.textContent = '';
    VIEW_MODES.forEach((vm) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'nav-pill' + ((state.viewMode || 'three_quarter') === vm.id ? ' active' : '');
      btn.textContent = vm.label;
      btn.title = vm.badge || vm.label;
      btn.addEventListener('click', () => {
        state.viewMode = vm.id;
        syncViewNavActive();
        if (typeof onViewModeSelect === 'function') {
          onViewModeSelect(vm.id);
        }
      });
      viewNav.appendChild(btn);
      viewNavUpdaters.push((activeMode) => {
        btn.classList.toggle('active', activeMode === vm.id);
      });
    });
  }

  // Header Dropdowns: Lighting & Shading
  const lightingMenu = document.getElementById('lighting-menu');
  const btnLighting = document.getElementById('btn-lighting-dropdown');
  const labelActiveEnv = document.getElementById('label-active-env');
  const sceneNav = document.getElementById('scene-nav');
  const sceneButtons = new Map();

  const shadingMenu = document.getElementById('shading-menu');
  const btnShading = document.getElementById('btn-shading-dropdown');
  const labelActivePass = document.getElementById('label-active-pass');
  const passNav = document.getElementById('render-pass-nav');

  function closeAllDropdowns() {
    if (lightingMenu) lightingMenu.classList.add('hidden');
    if (shadingMenu) shadingMenu.classList.add('hidden');
    if (btnLighting) {
      btnLighting.classList.remove('active');
      btnLighting.setAttribute('aria-expanded', 'false');
    }
    if (btnShading) {
      btnShading.classList.remove('active');
      btnShading.setAttribute('aria-expanded', 'false');
    }
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.header-dropdown-container')) {
      closeAllDropdowns();
    }
  });

  if (btnLighting && lightingMenu) {
    btnLighting.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = lightingMenu.classList.contains('hidden');
      closeAllDropdowns();
      if (isHidden) {
        lightingMenu.classList.remove('hidden');
        btnLighting.classList.add('active');
        btnLighting.setAttribute('aria-expanded', 'true');
      }
    });
  }

  if (sceneNav) {
    sceneNav.textContent = '';
    ENVIRONMENT_PRESETS.forEach((env) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'dropdown-item' + (state.environment === env.id ? ' active' : '');
      btn.setAttribute('aria-pressed', state.environment === env.id ? 'true' : 'false');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'dropdown-item-name';
      nameSpan.textContent = env.name;

      const subSpan = document.createElement('span');
      subSpan.className = 'dropdown-item-sub';
      subSpan.textContent = env.subtitle;

      btn.appendChild(nameSpan);
      btn.appendChild(subSpan);

      btn.addEventListener('click', () => {
        const safeId = sanitizeEnvId(env.id);
        if (typeof onEnvironmentSelect === 'function') {
          onEnvironmentSelect(safeId);
        }
        if (labelActiveEnv) {
          labelActiveEnv.textContent = env.name.split(' ')[0];
        }
        closeAllDropdowns();
      });

      sceneNav.appendChild(btn);
      sceneButtons.set(env.id, btn);
    });
  }

  if (btnShading && shadingMenu) {
    btnShading.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = shadingMenu.classList.contains('hidden');
      closeAllDropdowns();
      if (isHidden) {
        shadingMenu.classList.remove('hidden');
        btnShading.classList.add('active');
        btnShading.setAttribute('aria-expanded', 'true');
      }
    });
  }

  if (passNav) {
    passNav.textContent = '';
    RENDER_MODES.forEach((rm) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'dropdown-item' + ((state.renderMode || 0) === rm.id ? ' active' : '');
      btn.textContent = rm.label;
      btn.addEventListener('click', () => {
        state.renderMode = rm.id;
        syncRenderPassActive();
        if (labelActivePass) {
          labelActivePass.textContent = rm.shortLabel;
        }
        closeAllDropdowns();
        onChange(state);
      });
      passNav.appendChild(btn);
      renderPassUpdaters.push((activePass) => {
        btn.classList.toggle('active', activePass === rm.id);
      });
    });
  }

  // Top Bar Action Buttons
  const jsonBtn = document.getElementById('btn-json-spec');
  if (jsonBtn) {
    jsonBtn.addEventListener('click', () => {
      toggleJsonModal(true);
    });
  }

  const inspectorBtn = document.getElementById('btn-toggle-inspector');
  let isInspectorOpen = false; // Closed by default for maximum interaction space

  function toggleInspector(forceState) {
    if (typeof forceState === 'boolean') {
      isInspectorOpen = forceState;
    } else {
      isInspectorOpen = !isInspectorOpen;
    }
    const uiRootEl = document.getElementById('ui-root');
    if (uiRootEl) {
      uiRootEl.classList.toggle('drawer-hidden', !isInspectorOpen);
      uiRootEl.classList.toggle('mobile-sheet-open', isInspectorOpen);
    }
    if (inspectorBtn) {
      inspectorBtn.classList.toggle('active', isInspectorOpen);
    }
  }

  if (inspectorBtn) {
    inspectorBtn.addEventListener('click', () => {
      toggleInspector();
    });
  }

  // -------------------------------------------------------------------------
  // 2. TURNAROUND REFERENCE SHEET OVERLAY + CHARACTER ROSTER + CURSOR TOOLBELT
  // -------------------------------------------------------------------------
  const turnaroundOverlay = document.getElementById('turnaround-overlay');
  let charRosterHeaderName = null;
  let charRosterHeaderRole = null;
  let charRosterQuote = null;
  let turnaroundFooterSpecs = [];

  if (turnaroundOverlay) {
    turnaroundOverlay.textContent = '';

    // Top Reference Sheet Header Banner (updates dynamically per character)
    const sheetHeader = document.createElement('div');
    sheetHeader.className = 'turnaround-sheet-header';

    const sheetTitleLeft = document.createElement('div');
    sheetTitleLeft.className = 'turnaround-sheet-title';
    charRosterHeaderName = document.createElement('span');
    charRosterHeaderName.textContent = 'THE KNIGHT — 3D CHARACTER TURNAROUND SHEET';
    charRosterQuote = document.createElement('span');
    charRosterQuote.className = 'turnaround-wiki-quote';
    sheetTitleLeft.appendChild(charRosterHeaderName);
    sheetTitleLeft.appendChild(charRosterQuote);

    charRosterHeaderRole = document.createElement('div');
    charRosterHeaderRole.className = 'turnaround-sheet-meta';
    charRosterHeaderRole.textContent =
      'UE5 / BLENDER CYCLES · 64 SHELLS + 60,000 MICRO-FUR STRANDS';

    sheetHeader.appendChild(sheetTitleLeft);
    sheetHeader.appendChild(charRosterHeaderRole);
    turnaroundOverlay.appendChild(sheetHeader);

    // 3 Turnaround Column Frames (Front 0°, Three-Quarter -36°, Side Profile 90°)
    const colsGrid = document.createElement('div');
    colsGrid.className = 'turnaround-columns-grid';

    const columns = [
      {
        code: 'FIG 01 // FRONT ORTHO',
        angle: '0° AZIMUTH',
        focusMode: 'front'
      },
      {
        code: 'FIG 02 // THREE-QUARTER',
        angle: '-36° HERO TURNAROUND',
        focusMode: 'three_quarter'
      },
      {
        code: 'FIG 03 // SIDE PROFILE',
        angle: '+90° SILHOUETTE',
        focusMode: 'side'
      }
    ];

    columns.forEach((col, idx) => {
      const colEl = document.createElement('div');
      colEl.className = 'turnaround-col';

      const colTop = document.createElement('div');
      colTop.className = 'turnaround-col-top';

      const codeSpan = document.createElement('span');
      codeSpan.className = 'turnaround-col-code';
      codeSpan.textContent = col.code;

      const angleBtn = document.createElement('button');
      angleBtn.type = 'button';
      angleBtn.className = 'turnaround-col-expand';
      angleBtn.textContent = col.angle + ' ↗';
      angleBtn.title = 'Click to expand this angle to full viewport';
      angleBtn.addEventListener('click', () => {
        state.viewMode = col.focusMode;
        syncViewNavActive();
        if (typeof onViewModeSelect === 'function') {
          onViewModeSelect(col.focusMode);
        }
      });

      colTop.appendChild(codeSpan);
      colTop.appendChild(angleBtn);

      const colBottom = document.createElement('div');
      colBottom.className = 'turnaround-col-bottom';
      const specSpan = document.createElement('span');
      specSpan.className = 'turnaround-col-spec';
      turnaroundFooterSpecs.push(specSpan);
      colBottom.appendChild(specSpan);

      colEl.appendChild(colTop);
      colEl.appendChild(colBottom);
      colsGrid.appendChild(colEl);
    });

    turnaroundOverlay.appendChild(colsGrid);
  }

  // -------------------------------------------------------------------------
  // 3. MINIMAL MODERN STUDIO DOCK (Bottom Center Capsule)
  // -------------------------------------------------------------------------
  let interactiveDock = document.getElementById('character-roster-dock');
  if (!interactiveDock) {
    interactiveDock = document.createElement('div');
    interactiveDock.id = 'character-roster-dock';
    document.body.appendChild(interactiveDock);
  }
  interactiveDock.className = 'studio-dock';
  interactiveDock.textContent = '';

  // Tools Section (Left)
  const dockToolsGroup = document.createElement('div');
  dockToolsGroup.className = 'dock-group dock-tools-group';

  CURSOR_TOOLS.forEach((tool) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'dock-tool-btn' + ((state.cursorTool || 0) === tool.id ? ' active' : '');
    btn.title = `${tool.label} (${tool.key}) — ${tool.desc}`;

    const keyBadge = document.createElement('span');
    keyBadge.className = 'dock-key';
    keyBadge.textContent = tool.key;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'dock-label';
    labelSpan.textContent = tool.shortLabel || tool.label;

    btn.appendChild(keyBadge);
    btn.appendChild(labelSpan);

    btn.addEventListener('click', () => {
      if (tool.id === 2) {
        state.cursorTool = 2;
        syncToolActive();
        onChange(state);
        onAction('characterAction');
      } else {
        state.cursorTool = tool.id;
        syncToolActive();
        onChange(state);
      }
    });

    dockToolsGroup.appendChild(btn);
    toolUpdaters.push((activeTool) => {
      btn.classList.toggle('active', activeTool === tool.id);
    });
  });

  // X-Ray Lens Channel Selector
  const lensSelectWrap = document.createElement('div');
  lensSelectWrap.className = 'dock-lens-wrap';
  lensSelectWrap.style.display = (state.cursorTool === 4) ? 'inline-flex' : 'none';
  toolUpdaters.push((activeTool) => {
    lensSelectWrap.style.display = (activeTool === 4) ? 'inline-flex' : 'none';
  });

  const lensChannels = [
    { id: 1, name: 'Groom' },
    { id: 2, name: 'Disp' },
    { id: 3, name: 'SSS' },
    { id: 4, name: 'Topo' }
  ];
  const lensBtns = [];
  lensChannels.forEach((lc) => {
    const lBtn = document.createElement('button');
    lBtn.type = 'button';
    lBtn.className =
      'dock-lens-btn' + ((state.lensChannel || 1) === lc.id ? ' active' : '');
    lBtn.textContent = lc.name;
    lBtn.addEventListener('click', () => {
      state.lensChannel = lc.id;
      state.cursorTool = 4;
      lensBtns.forEach((b, i) => b.classList.toggle('active', lensChannels[i].id === lc.id));
      syncToolActive();
      onChange(state);
    });
    lensBtns.push(lBtn);
    lensSelectWrap.appendChild(lBtn);
  });
  dockToolsGroup.appendChild(lensSelectWrap);
  interactiveDock.appendChild(dockToolsGroup);

  // Divider
  const dockDivider = document.createElement('div');
  dockDivider.className = 'dock-divider';
  dockDivider.setAttribute('aria-hidden', 'true');
  interactiveDock.appendChild(dockDivider);

  // Characters Section (Right)
  const dockCharsGroup = document.createElement('div');
  dockCharsGroup.className = 'dock-group dock-chars-group';

  CHARACTER_SPECS.forEach((charSpec) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isSelected = (state.characterId || 'the_knight') === charSpec.character_id;
    btn.className = 'dock-char-btn' + (isSelected ? ' active' : '');
    btn.style.setProperty('--char-accent', charSpec.accentColor);
    btn.title = `${charSpec.name} (${charSpec.hotkey}) — ${charSpec.role}`;

    const dotSpan = document.createElement('span');
    dotSpan.className = 'dock-char-dot';
    dotSpan.style.backgroundColor = charSpec.accentColor;

    const numSpan = document.createElement('span');
    numSpan.className = 'dock-char-num';
    numSpan.textContent = charSpec.hotkey;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'dock-char-name';
    nameSpan.textContent = charSpec.shortName;

    btn.appendChild(dotSpan);
    btn.appendChild(numSpan);
    btn.appendChild(nameSpan);

    btn.addEventListener('click', () => {
      selectCharacterById(charSpec.character_id);
    });

    dockCharsGroup.appendChild(btn);
    characterUpdaters.push((activeCharId) => {
      btn.classList.toggle('active', activeCharId === charSpec.character_id);
    });
  });

  interactiveDock.appendChild(dockCharsGroup);

  // -------------------------------------------------------------------------
  // 5. RIGHT INSPECTOR PANEL (#ui-root): Lore Specs, Zone Isolation & Sliders
  // -------------------------------------------------------------------------
  const card = document.createElement('div');
  card.className = 'glass-card';

  const header = document.createElement('div');
  header.className = 'card-header';
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-expanded', 'true');

  const titleWrap = document.createElement('div');
  titleWrap.className = 'title-wrap';

  const badgeRow = document.createElement('div');
  badgeRow.className = 'badge-row';

  const statusDot = document.createElement('span');
  statusDot.className = 'status-dot';

  const badgeText = document.createElement('span');
  badgeText.className = 'badge-text';
  badgeText.textContent = 'UE5 / CYCLES · HOUDINI GROOM';

  badgeRow.appendChild(statusDot);
  badgeRow.appendChild(badgeText);

  const panelTitleEl = document.createElement('h1');
  panelTitleEl.className = 'app-title';
  panelTitleEl.textContent = 'The Knight';

  const panelSubEl = document.createElement('p');
  panelSubEl.className = 'app-subtitle';
  panelSubEl.textContent = 'Protagonist · Vessel of the Abyss';

  titleWrap.appendChild(badgeRow);
  titleWrap.appendChild(panelTitleEl);
  titleWrap.appendChild(panelSubEl);

  const headerActions = document.createElement('div');
  headerActions.className = 'header-btn-group';

  const collapseBtn = document.createElement('button');
  collapseBtn.type = 'button';
  collapseBtn.className = 'collapse-btn';
  collapseBtn.setAttribute('aria-label', 'Collapse Inspector Sections');
  collapseBtn.appendChild(createActionIcon('chevron'));

  const closeDrawerBtn = document.createElement('button');
  closeDrawerBtn.type = 'button';
  closeDrawerBtn.className = 'drawer-close-btn';
  closeDrawerBtn.setAttribute('aria-label', 'Close Inspector (I)');
  closeDrawerBtn.title = 'Close Inspector (I)';
  closeDrawerBtn.innerHTML = '&times;';
  closeDrawerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleInspector(false);
  });

  headerActions.appendChild(collapseBtn);
  headerActions.appendChild(closeDrawerBtn);
  header.appendChild(headerActions);
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'card-body';

  let isCollapsed = false;
  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    card.classList.toggle('collapsed', isCollapsed);
    header.setAttribute('aria-expanded', String(!isCollapsed));
  }
  header.addEventListener('click', toggleCollapse);

  // --- Section 1: Signature Lore Action Button ---
  const actionHeroBtn = document.createElement('button');
  actionHeroBtn.type = 'button';
  actionHeroBtn.className = 'lore-action-hero-btn';
  actionHeroBtn.appendChild(createActionIcon('spark'));
  const actionHeroText = document.createElement('span');
  actionHeroText.textContent = 'Trigger: Pure Nail Focus & Void Pulse (Space)';
  actionHeroBtn.appendChild(actionHeroText);
  actionHeroBtn.addEventListener('click', () => {
    onAction('characterAction');
  });
  body.appendChild(actionHeroBtn);

  // --- Section 2: Interactive Anatomical Material Zone Inspector ---
  const zoneSec = document.createElement('div');
  zoneSec.className = 'control-section';

  const zoneHeaderRow = document.createElement('div');
  zoneHeaderRow.className = 'section-header-inline';

  const zoneTitle = document.createElement('div');
  zoneTitle.className = 'section-title';
  zoneTitle.textContent = 'Interactive Material Zones (Hover / Click)';

  const clearZoneBtn = document.createElement('button');
  clearZoneBtn.type = 'button';
  clearZoneBtn.className = 'zone-reset-link';
  clearZoneBtn.textContent = 'Show All';
  clearZoneBtn.addEventListener('click', () => {
    state.highlightZone = 0;
    syncZoneActive();
    onChange(state);
  });

  zoneHeaderRow.appendChild(zoneTitle);
  zoneHeaderRow.appendChild(clearZoneBtn);
  zoneSec.appendChild(zoneHeaderRow);

  const zoneListEl = document.createElement('div');
  zoneListEl.className = 'anatomy-zone-list';
  zoneSec.appendChild(zoneListEl);
  body.appendChild(zoneSec);

  const sliderUpdaters = {};

  function addSlider(parent, key, label, min, max, step, unit = '') {
    const row = document.createElement('div');
    row.className = 'slider-row';

    const labelWrap = document.createElement('div');
    labelWrap.className = 'slider-label-wrap';

    const labelEl = document.createElement('label');
    labelEl.className = 'slider-label';
    labelEl.textContent = label;
    labelEl.setAttribute('for', `ctrl-${key}`);

    const valEl = document.createElement('span');
    valEl.className = 'slider-value';
    const decimals = step < 0.05 ? 2 : step < 1 ? 1 : 0;
    valEl.textContent = `${Number(state[key]).toFixed(decimals)}${unit}`;

    labelWrap.appendChild(labelEl);
    labelWrap.appendChild(valEl);

    const input = document.createElement('input');
    input.type = 'range';
    input.id = `ctrl-${key}`;
    input.className = 'glass-slider';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(state[key]);

    input.addEventListener('input', () => {
      const safeVal = clampNum(input.value, min, max, state[key]);
      state[key] = safeVal;
      valEl.textContent = `${safeVal.toFixed(decimals)}${unit}`;
      onChange(state);
    });

    sliderUpdaters[key] = (newVal) => {
      input.value = String(newVal);
      valEl.textContent = `${Number(newVal).toFixed(decimals)}${unit}`;
    };

    row.appendChild(labelWrap);
    row.appendChild(input);
    parent.appendChild(row);
  }

  // --- Section 3: Micro-Fur, Velvet Nap & Chitin Wear ---
  const furSec = document.createElement('div');
  furSec.className = 'control-section';
  const furSecTitle = document.createElement('div');
  furSecTitle.className = 'section-title';
  furSecTitle.textContent = 'Micro-Fur, Nap & Surface Wear';
  furSec.appendChild(furSecTitle);

  addSlider(furSec, 'furLength', 'Edge Fuzz & Mane Length', 0.08, 0.55, 0.01, 'm');
  addSlider(furSec, 'furDensity', 'Velvet Nap Density', 0.25, 1.0, 0.01);
  addSlider(furSec, 'wearAmount', 'Chitin Cracks & Pitting', 0.0, 1.0, 0.01);
  addSlider(furSec, 'clumping', 'Frayed Strand Bundling', 0.0, 1.0, 0.01);
  addSlider(furSec, 'curliness', 'Fiber Wave & Fray', 0.0, 1.0, 0.01);
  body.appendChild(furSec);

  // --- Section 4: Studio 3-Point Lighting & Wind Physics ---
  const lightSec = document.createElement('div');
  lightSec.className = 'control-section';
  const lightSecTitle = document.createElement('div');
  lightSecTitle.className = 'section-title';
  lightSecTitle.textContent = 'Studio 3-Point Lighting & Wind';
  lightSec.appendChild(lightSecTitle);

  addSlider(lightSec, 'windStrength', 'Cloak & Fur Wind Force', 0.0, 2.2, 0.05, 'x');
  addSlider(lightSec, 'rimIntensity', 'Blue-White Rim Separation', 0.2, 2.6, 0.05);
  addSlider(lightSec, 'lightIntensity', 'Key Studio Light', 0.3, 2.5, 0.05);
  addSlider(lightSec, 'lightAngle', 'Studio Rig Orbit', -180, 180, 1, '°');
  addSlider(lightSec, 'roughness', 'Matte Shell vs Silk Gloss', 0.12, 0.95, 0.01);
  body.appendChild(lightSec);

  // --- Section 5: Palette Swatches ---
  const colorSec = document.createElement('div');
  colorSec.className = 'control-section';
  const colorTitle = document.createElement('div');
  colorTitle.className = 'section-title';
  colorTitle.textContent = 'Material Zone Chromatics';
  colorSec.appendChild(colorTitle);

  const colorRow = document.createElement('div');
  colorRow.className = 'color-row';

  function createColorPicker(key, labelText) {
    const wrap = document.createElement('label');
    wrap.className = 'color-picker-wrap';

    const span = document.createElement('span');
    span.className = 'color-picker-label';
    span.textContent = labelText;

    const swatchWrap = document.createElement('div');
    swatchWrap.className = 'swatch-circle';
    swatchWrap.style.backgroundColor = state[key];

    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'color-input-hidden';
    input.value = state[key];

    input.addEventListener('input', () => {
      const safeHex = sanitizeHexColor(input.value, state[key]);
      state[key] = safeHex;
      swatchWrap.style.backgroundColor = safeHex;
      onChange(state);
    });

    sliderUpdaters[key] = (newHex) => {
      input.value = newHex;
      swatchWrap.style.backgroundColor = newHex;
    };

    swatchWrap.appendChild(input);
    wrap.appendChild(swatchWrap);
    wrap.appendChild(span);
    return wrap;
  }

  colorRow.appendChild(createColorPicker('maskColor', 'Mask Shell'));
  colorRow.appendChild(createColorPicker('baseColor', 'Cloak / Coat'));
  colorRow.appendChild(createColorPicker('tipColor', 'Rim Fuzz'));
  colorSec.appendChild(colorRow);
  body.appendChild(colorSec);

  // --- Section 6: Quick Groom Actions ---
  const actionRow = document.createElement('div');
  actionRow.className = 'action-row';

  const fluffBtn = document.createElement('button');
  fluffBtn.type = 'button';
  fluffBtn.className = 'action-btn primary';
  fluffBtn.appendChild(createActionIcon('comb'));
  const fluffSpan = document.createElement('span');
  fluffSpan.textContent = 'Reset Groom';
  fluffBtn.appendChild(fluffSpan);
  fluffBtn.addEventListener('click', () => onAction('resetGroom'));

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'action-btn';
  resetBtn.appendChild(createActionIcon('reset'));
  const resetSpan = document.createElement('span');
  resetSpan.textContent = 'Reset Preset';
  resetBtn.appendChild(resetSpan);
  resetBtn.addEventListener('click', () => {
    selectCharacterById(state.characterId || 'the_knight');
  });

  actionRow.appendChild(fluffBtn);
  actionRow.appendChild(resetBtn);
  body.appendChild(actionRow);

  card.appendChild(body);
  container.appendChild(card);

  // -------------------------------------------------------------------------
  // 6. INTERACTIVE JSON SPECIFICATION & HOLLOW KNIGHT WIKI MODAL
  // -------------------------------------------------------------------------
  let jsonModal = document.getElementById('json-pipeline-modal');
  if (!jsonModal) {
    jsonModal = document.createElement('div');
    jsonModal.id = 'json-pipeline-modal';
    jsonModal.className = 'json-pipeline-modal hidden';
    document.body.appendChild(jsonModal);
  }
  jsonModal.textContent = '';

  const modalCard = document.createElement('div');
  modalCard.className = 'json-modal-card';

  const modalHeader = document.createElement('div');
  modalHeader.className = 'json-modal-header';

  const modalTitleWrap = document.createElement('div');
  const modalTitle = document.createElement('h2');
  modalTitle.className = 'json-modal-title';
  modalTitle.textContent = PIPELINE_METADATA.title;
  const modalSub = document.createElement('p');
  modalSub.className = 'json-modal-sub';
  modalSub.textContent =
    'Structured JSON Pipeline Spec & Hollow Knight Wiki Reference — Live synced with 3D viewport';
  modalTitleWrap.appendChild(modalTitle);
  modalTitleWrap.appendChild(modalSub);

  const modalBtnGroup = document.createElement('div');
  modalBtnGroup.className = 'json-modal-actions';

  const wikiLink = document.createElement('a');
  wikiLink.href = 'https://hollowknight.fandom.com/wiki/Hollow_Knight_Wiki';
  wikiLink.target = '_blank';
  wikiLink.rel = 'noopener noreferrer';
  wikiLink.className = 'json-action-pill';
  wikiLink.textContent = 'Hollow Knight Wiki ↗';

  const copyJsonBtn = document.createElement('button');
  copyJsonBtn.type = 'button';
  copyJsonBtn.className = 'json-action-pill primary';
  copyJsonBtn.textContent = 'Copy Active JSON';

  const closeJsonBtn = document.createElement('button');
  closeJsonBtn.type = 'button';
  closeJsonBtn.className = 'json-action-pill';
  closeJsonBtn.textContent = 'Close (Esc)';

  modalBtnGroup.appendChild(wikiLink);
  modalBtnGroup.appendChild(copyJsonBtn);
  modalBtnGroup.appendChild(closeJsonBtn);

  modalHeader.appendChild(modalTitleWrap);
  modalHeader.appendChild(modalBtnGroup);
  modalCard.appendChild(modalHeader);

  const jsonPre = document.createElement('pre');
  jsonPre.className = 'json-modal-pre';
  modalCard.appendChild(jsonPre);
  jsonModal.appendChild(modalCard);

  function buildLiveSpecJson() {
    const spec = getCharacterSpecById(state.characterId || 'the_knight');
    return {
      project_metadata: PIPELINE_METADATA,
      active_character: {
        character_id: spec.character_id,
        name: spec.name,
        role: spec.role,
        wiki_quote: spec.wikiQuote,
        head_mask: spec.head_mask,
        body_and_attire: spec.body_and_attire,
        weapon: spec.weapon,
        props: spec.props,
        live_simulation_parameters: {
          furLength: state.furLength,
          furDensity: state.furDensity,
          wearAmount: state.wearAmount,
          windStrength: state.windStrength,
          roughness: state.roughness,
          maskColor: state.maskColor,
          baseColor: state.baseColor,
          tipColor: state.tipColor
        }
      },
      all_pipeline_characters: CHARACTER_SPECS.map((c) => ({
        character_id: c.character_id,
        name: c.name,
        role: c.role
      }))
    };
  }

  function toggleJsonModal(show) {
    if (show) {
      jsonPre.textContent = JSON.stringify(buildLiveSpecJson(), null, 2);
      jsonModal.classList.remove('hidden');
    } else {
      jsonModal.classList.add('hidden');
    }
  }

  copyJsonBtn.addEventListener('click', () => {
    const text = JSON.stringify(buildLiveSpecJson(), null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      copyJsonBtn.textContent = 'Copied to Clipboard!';
      setTimeout(() => {
        copyJsonBtn.textContent = 'Copy Active JSON';
      }, 1600);
    }
  });

  closeJsonBtn.addEventListener('click', () => toggleJsonModal(false));
  jsonModal.addEventListener('click', (e) => {
    if (e.target === jsonModal) toggleJsonModal(false);
  });

  // -------------------------------------------------------------------------
  // 7. DYNAMIC CHARACTER SPEC UPDATER & ANATOMICAL ZONE CARDS
  // -------------------------------------------------------------------------
  function renderAnatomyZoneCards(spec) {
    zoneListEl.textContent = '';
    zoneUpdaters.length = 0;

    const headMask = spec?.head_mask || {};
    const bodyAttire = spec?.body_and_attire || {};
    const cloakOrAttire =
      bodyAttire.cloak ||
      bodyAttire.attire ||
      bodyAttire.wings ||
      {};
    const coreOrWeapon =
      bodyAttire.infection_core ||
      spec?.weapon || { name: 'Props', type: spec?.props || 'Lore Relic' };

    const zones = [
      {
        id: 1,
        code: 'ZONE 01 · HEAD MASK / CROWN',
        title: headMask.material || 'Matte Porcelain Carapace',
        detail: `${headMask.surface_details || 'Micro-scratches'} · ${headMask.groom_features || 'Velvet fuzz'}`,
        color: '#38bdf8'
      },
      {
        id: 2,
        code: 'ZONE 02 · SOFT-BODY CLOAK / WINGS',
        title:
          cloakOrAttire.material ||
          cloakOrAttire.type ||
          cloakOrAttire.garment ||
          cloakOrAttire.color ||
          'Dynamic Woven Fabric',
        detail:
          cloakOrAttire.simulation_properties ||
          cloakOrAttire.draping ||
          'High-displacement wind & collision simulation',
        color: '#f43f5e'
      },
      {
        id: 3,
        code: 'ZONE 03 · PHYSIQUE & VELVETY NAP',
        title: bodyAttire.physique || 'Insectoid Anatomy',
        detail:
          bodyAttire.skin_texture ||
          bodyAttire.upper_body_fur ||
          bodyAttire.shell_plating ||
          'Reactive micro-fur nap',
        color: '#10b981'
      },
      {
        id: 4,
        code: 'ZONE 04 · WEAPON / CORE / RELIC',
        title: coreOrWeapon.name || coreOrWeapon.location || 'Hallownest Relic',
        detail:
          coreOrWeapon.type ||
          coreOrWeapon.texture ||
          coreOrWeapon.details ||
          spec?.props ||
          'Subsurface emissive core',
        color: '#f59e0b'
      }
    ];

    zones.forEach((z) => {
      const item = document.createElement('div');
      item.className =
        'anatomy-zone-card' + ((state.highlightZone || 0) === z.id ? ' active' : '');
      item.style.setProperty('--zone-color', z.color);

      const codeRow = document.createElement('div');
      codeRow.className = 'zone-card-code';
      codeRow.textContent = z.code;

      const titleRow = document.createElement('div');
      titleRow.className = 'zone-card-title';
      titleRow.textContent = z.title;

      const detailRow = document.createElement('div');
      detailRow.className = 'zone-card-detail';
      detailRow.textContent = z.detail;

      item.appendChild(codeRow);
      item.appendChild(titleRow);
      item.appendChild(detailRow);

      // Hover temporarily highlights the zone on the 3D model; click locks/unlocks it
      item.addEventListener('mouseenter', () => {
        if (!item.dataset.locked) {
          state.highlightZone = z.id;
          onChange(state);
        }
      });
      item.addEventListener('mouseleave', () => {
        if (!item.dataset.locked) {
          state.highlightZone = 0;
          syncZoneActive();
          onChange(state);
        }
      });
      item.addEventListener('click', () => {
        const wasLocked = item.dataset.locked === 'true';
        zoneListEl.querySelectorAll('.anatomy-zone-card').forEach((el) => {
          delete el.dataset.locked;
        });
        if (wasLocked) {
          state.highlightZone = 0;
        } else {
          item.dataset.locked = 'true';
          state.highlightZone = z.id;
        }
        syncZoneActive();
        onChange(state);
      });

      zoneListEl.appendChild(item);
      zoneUpdaters.push((activeZ) => {
        item.classList.toggle('active', activeZ === z.id);
      });
    });
  }

  function updateCharacterPresentation(spec) {
    panelTitleEl.textContent = spec.name;
    panelSubEl.textContent = spec.role;
    actionHeroText.textContent = `Trigger: ${spec.actionName} (Space)`;

    const headerCharBadge = document.getElementById('header-char-badge');
    if (headerCharBadge) {
      headerCharBadge.textContent = spec.name;
    }
    const headerActionLabel = document.getElementById('header-action-label');
    if (headerActionLabel) {
      headerActionLabel.textContent = spec.actionName.split(' ')[0] || 'Action';
    }

    if (charRosterHeaderName) {
      charRosterHeaderName.textContent = `${spec.name.toUpperCase()} — 3D CHARACTER TURNAROUND SHEET`;
    }
    if (charRosterQuote) {
      charRosterQuote.textContent = spec.wikiQuote;
    }
    if (turnaroundFooterSpecs.length === 3) {
      const cloakInfo =
        spec?.body_and_attire?.cloak?.material ||
        spec?.body_and_attire?.cloak?.color ||
        spec?.body_and_attire?.attire?.garment ||
        spec?.body_and_attire?.wings?.type ||
        'Soft-Body Fabric';
      const weaponInfo = spec?.weapon
        ? `${spec.weapon.name} — ${spec.weapon.type}`
        : spec?.props || 'Hallownest Lore Asset';

      turnaroundFooterSpecs[0].textContent = `Mask: ${spec?.head_mask?.material || 'Matte Carapace'}`;
      turnaroundFooterSpecs[1].textContent = `Groom: ${cloakInfo}`;
      turnaroundFooterSpecs[2].textContent = `Relic: ${weaponInfo}`;
    }

    renderAnatomyZoneCards(spec);
  }

  function selectCharacterById(characterId) {
    const spec = getCharacterSpecById(characterId);
    state.characterId = spec.character_id;
    Object.assign(state, spec.simPreset);
    state.highlightZone = 0;

    Object.keys(spec.simPreset).forEach((k) => {
      if (sliderUpdaters[k]) sliderUpdaters[k](state[k]);
    });

    updateCharacterPresentation(spec);
    characterUpdaters.forEach((fn) => fn(spec.character_id));

    if (typeof onCharacterSelect === 'function') {
      onCharacterSelect(spec.character_id, spec);
    }
    onChange(state);
  }

  function syncViewNavActive() {
    const current = state.viewMode || 'three_quarter';
    viewNavUpdaters.forEach((fn) => fn(current));
    if (turnaroundOverlay) {
      turnaroundOverlay.classList.toggle('hidden', current !== 'turnaround');
    }
  }

  function syncRenderPassActive() {
    const current = state.renderMode || 0;
    renderPassUpdaters.forEach((fn) => fn(current));
  }

  function syncToolActive() {
    const current = state.cursorTool || 0;
    toolUpdaters.forEach((fn) => fn(current));
  }

  function syncZoneActive() {
    const current = state.highlightZone || 0;
    zoneUpdaters.forEach((fn) => fn(current));
  }

  // Initialize presentation with initial character
  const initialSpec = getCharacterSpecById(state.characterId || 'the_knight');
  updateCharacterPresentation(initialSpec);
  syncViewNavActive();
  syncRenderPassActive();
  syncToolActive();

  return {
    setEnvironmentActive(envId) {
      sceneButtons.forEach((btn, id) => {
        const active = id === envId;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      if (labelActiveEnv) {
        const p = ENVIRONMENT_PRESETS.find((e) => e.id === envId);
        if (p) labelActiveEnv.textContent = p.name.split(' ')[0];
      }
    },
    syncSlidersFromState() {
      Object.keys(sliderUpdaters).forEach((k) => {
        if (state[k] !== undefined) {
          sliderUpdaters[k](state[k]);
        }
      });
      syncViewNavActive();
      syncRenderPassActive();
      syncToolActive();
    },
    selectCharacterById,
    setCursorTool(toolId) {
      state.cursorTool = toolId;
      syncToolActive();
      onChange(state);
    },
    toggleJsonModal,
    toggleInspector
  };
}
