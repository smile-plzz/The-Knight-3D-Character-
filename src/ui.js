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
  { id: 'turnaround', label: '3-View Reference Sheet', badge: '0° · -36° · 90°' },
  { id: 'three_quarter', label: 'Three-Quarter View', badge: '-36° Hero' },
  { id: 'front', label: 'Front Ortho View', badge: '0° Front' },
  { id: 'side', label: 'Side Profile View', badge: '90° Side' }
];

export const RENDER_MODES = [
  { id: 0, label: 'Final Render (UE5 / Cycles)', shortLabel: 'Final Render' },
  { id: 1, label: 'Groom & Cloth Weight Map', shortLabel: 'Groom Map' },
  { id: 2, label: 'Carapace & Cloth Displacement', shortLabel: 'Disp Map' },
  { id: 3, label: 'Subsurface Scattering (SSS)', shortLabel: 'SSS Map' },
  { id: 4, label: 'Clean Topology Reference', shortLabel: 'Topology' }
];

export const CURSOR_TOOLS = [
  {
    id: 0,
    key: 'Q',
    label: 'Groom Brush',
    desc: 'Comb & part 60k micro-fur & cloak fibers'
  },
  {
    id: 1,
    key: 'W',
    label: 'Wind Vortex',
    desc: 'Billow soft-body cloak, silk & moth wings'
  },
  {
    id: 2,
    key: 'E',
    label: 'Lore Action',
    desc: 'Trigger signature weapon & particle burst'
  },
  {
    id: 3,
    key: 'R',
    label: 'Light Wand',
    desc: 'Move live dual-spectrum SSS & rim light'
  },
  {
    id: 4,
    key: 'T',
    label: 'X-Ray Lens',
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
  // 1. TOP BAR (#page-nav): View Angle Switcher + Render Pass + JSON Spec Btn
  // -------------------------------------------------------------------------
  const pageNav = document.getElementById('page-nav');
  if (pageNav) {
    pageNav.textContent = '';

    const brandBadge = document.createElement('div');
    brandBadge.className = 'ref-brand-badge';

    const brandDot = document.createElement('span');
    brandDot.className = 'ref-brand-dot';

    const brandTitle = document.createElement('span');
    brandTitle.className = 'ref-brand-title';
    brandTitle.textContent = 'HALLOWNEST 3D ASSET & FUR PIPELINE';

    brandBadge.appendChild(brandDot);
    brandBadge.appendChild(brandTitle);
    pageNav.appendChild(brandBadge);

    // View angle switcher group
    const viewGroup = document.createElement('div');
    viewGroup.className = 'top-pill-group';

    VIEW_MODES.forEach((vm) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'nav-pill' + ((state.viewMode || 'turnaround') === vm.id ? ' active' : '');
      btn.textContent = vm.label;
      btn.addEventListener('click', () => {
        state.viewMode = vm.id;
        syncViewNavActive();
        if (typeof onViewModeSelect === 'function') {
          onViewModeSelect(vm.id);
        }
      });
      viewGroup.appendChild(btn);
      viewNavUpdaters.push((activeMode) => {
        btn.classList.toggle('active', activeMode === vm.id);
      });
    });

    pageNav.appendChild(viewGroup);

    // Technical Render Channel Switcher
    const passGroup = document.createElement('div');
    passGroup.className = 'top-pill-group pass-pill-group';

    RENDER_MODES.forEach((rm) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'nav-pill pass-pill' + ((state.renderMode || 0) === rm.id ? ' active' : '');
      btn.textContent = rm.shortLabel;
      btn.title = rm.label;
      btn.addEventListener('click', () => {
        state.renderMode = rm.id;
        syncRenderPassActive();
        onChange(state);
      });
      passGroup.appendChild(btn);
      renderPassUpdaters.push((activePass) => {
        btn.classList.toggle('active', activePass === rm.id);
      });
    });

    pageNav.appendChild(passGroup);

    // JSON Pipeline Spec Modal Trigger Button
    const jsonBtn = document.createElement('button');
    jsonBtn.type = 'button';
    jsonBtn.className = 'nav-pill json-spec-trigger';
    jsonBtn.appendChild(createActionIcon('code'));
    const jsonBtnTxt = document.createElement('span');
    jsonBtnTxt.textContent = 'JSON Pipeline & Wiki';
    jsonBtn.appendChild(jsonBtnTxt);
    jsonBtn.addEventListener('click', () => {
      toggleJsonModal(true);
    });
    pageNav.appendChild(jsonBtn);
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
  // 3. INTERACTIVE 8-CHARACTER ROSTER DOCK & CURSOR TOOLBELT (Bottom Center)
  // -------------------------------------------------------------------------
  let interactiveDock = document.getElementById('character-roster-dock');
  if (!interactiveDock) {
    interactiveDock = document.createElement('div');
    interactiveDock.id = 'character-roster-dock';
    interactiveDock.className = 'character-roster-dock';
    document.body.appendChild(interactiveDock);
  }
  interactiveDock.textContent = '';

  // Row A: Interactive Cursor Toolbelt (Brush, Wind Vortex, Action Strike, Light Wand, X-Ray Lens)
  const toolbeltBar = document.createElement('div');
  toolbeltBar.className = 'cursor-toolbelt-bar';

  const toolbeltLabel = document.createElement('span');
  toolbeltLabel.className = 'toolbelt-caption';
  toolbeltLabel.textContent = 'INTERACTIVE TOOLS:';
  toolbeltBar.appendChild(toolbeltLabel);

  CURSOR_TOOLS.forEach((tool) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'cursor-tool-btn' + ((state.cursorTool || 0) === tool.id ? ' active' : '');
    btn.title = `${tool.label} (${tool.key}) — ${tool.desc}`;

    const keyBadge = document.createElement('span');
    keyBadge.className = 'tool-key-badge';
    keyBadge.textContent = tool.key;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'tool-label-text';
    labelSpan.textContent = tool.label;

    btn.appendChild(keyBadge);
    btn.appendChild(labelSpan);

    btn.addEventListener('click', () => {
      if (tool.id === 2) {
        // Also immediately fire the character's signature action burst on click!
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

    toolbeltBar.appendChild(btn);
    toolUpdaters.push((activeTool) => {
      btn.classList.toggle('active', activeTool === tool.id);
    });
  });

  // X-Ray Lens Channel Selector (shown when X-Ray Lens is active)
  const lensSelectWrap = document.createElement('div');
  lensSelectWrap.className = 'lens-channel-wrap';
  const lensLabel = document.createElement('span');
  lensLabel.className = 'toolbelt-caption';
  lensLabel.textContent = 'LENS MAP:';
  lensSelectWrap.appendChild(lensLabel);

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
      'lens-mini-btn' + ((state.lensChannel || 1) === lc.id ? ' active' : '');
    lBtn.textContent = lc.name;
    lBtn.addEventListener('click', () => {
      state.lensChannel = lc.id;
      state.cursorTool = 4; // Auto-enable X-Ray Lens when choosing a lens map
      lensBtns.forEach((b, i) => b.classList.toggle('active', lensChannels[i].id === lc.id));
      syncToolActive();
      onChange(state);
    });
    lensBtns.push(lBtn);
    lensSelectWrap.appendChild(lBtn);
  });
  toolbeltBar.appendChild(lensSelectWrap);

  interactiveDock.appendChild(toolbeltBar);

  // Row B: 8-Character Hollow Knight Lore Switcher Bar
  const rosterBar = document.createElement('div');
  rosterBar.className = 'character-roster-bar';

  CHARACTER_SPECS.forEach((charSpec) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isSelected = (state.characterId || 'the_knight') === charSpec.character_id;
    btn.className = 'character-card-btn' + (isSelected ? ' active' : '');
    btn.style.setProperty('--char-accent', charSpec.accentColor);

    const topRow = document.createElement('div');
    topRow.className = 'char-card-top';

    const keySpan = document.createElement('span');
    keySpan.className = 'char-hotkey';
    keySpan.textContent = charSpec.hotkey;

    const dotSpan = document.createElement('span');
    dotSpan.className = 'char-swatch-dot';
    dotSpan.style.backgroundColor = charSpec.accentColor;

    topRow.appendChild(keySpan);
    topRow.appendChild(dotSpan);

    const nameSpan = document.createElement('div');
    nameSpan.className = 'char-card-name';
    nameSpan.textContent = charSpec.shortName;

    const roleSpan = document.createElement('div');
    roleSpan.className = 'char-card-role';
    roleSpan.textContent = charSpec.role.split('·')[0].trim();

    btn.appendChild(topRow);
    btn.appendChild(nameSpan);
    btn.appendChild(roleSpan);

    btn.addEventListener('click', () => {
      selectCharacterById(charSpec.character_id);
    });

    rosterBar.appendChild(btn);
    characterUpdaters.push((activeCharId) => {
      btn.classList.toggle('active', activeCharId === charSpec.character_id);
    });
  });

  interactiveDock.appendChild(rosterBar);

  // -------------------------------------------------------------------------
  // 4. SCENE / ENVIRONMENT BAR (#scene-nav)
  // -------------------------------------------------------------------------
  const sceneNav = document.getElementById('scene-nav');
  const sceneButtons = new Map();

  if (sceneNav) {
    sceneNav.textContent = '';
    ENVIRONMENT_PRESETS.forEach((env) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'scene-pill' + (state.environment === env.id ? ' active' : '');
      btn.setAttribute('aria-pressed', state.environment === env.id ? 'true' : 'false');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'scene-pill-name';
      nameSpan.textContent = env.name;

      const subSpan = document.createElement('span');
      subSpan.className = 'scene-pill-sub';
      subSpan.textContent = env.subtitle;

      btn.appendChild(nameSpan);
      btn.appendChild(subSpan);

      btn.addEventListener('click', () => {
        const safeId = sanitizeEnvId(env.id);
        if (typeof onEnvironmentSelect === 'function') {
          onEnvironmentSelect(safeId);
        }
      });

      sceneNav.appendChild(btn);
      sceneButtons.set(env.id, btn);
    });
  }

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

  const collapseBtn = document.createElement('button');
  collapseBtn.type = 'button';
  collapseBtn.className = 'collapse-btn';
  collapseBtn.setAttribute('aria-label', 'Toggle Simulation Controls');
  collapseBtn.appendChild(createActionIcon('chevron'));

  header.appendChild(titleWrap);
  header.appendChild(collapseBtn);
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

    const cloakOrAttire =
      spec.body_and_attire.cloak ||
      spec.body_and_attire.attire ||
      spec.body_and_attire.wings ||
      {};
    const coreOrWeapon =
      spec.body_and_attire.infection_core ||
      spec.weapon || { name: 'Props', type: spec.props || 'Lore Relic' };

    const zones = [
      {
        id: 1,
        code: 'ZONE 01 · HEAD MASK / CROWN',
        title: spec.head_mask.material,
        detail: `${spec.head_mask.surface_details} · ${spec.head_mask.groom_features}`,
        color: '#38bdf8'
      },
      {
        id: 2,
        code: 'ZONE 02 · SOFT-BODY CLOAK / WINGS',
        title:
          cloakOrAttire.material ||
          cloakOrAttire.type ||
          cloakOrAttire.garment ||
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
        title: spec.body_and_attire.physique,
        detail:
          spec.body_and_attire.skin_texture ||
          spec.body_and_attire.upper_body_fur ||
          spec.body_and_attire.shell_plating ||
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
          spec.props ||
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

    if (charRosterHeaderName) {
      charRosterHeaderName.textContent = `${spec.name.toUpperCase()} — 3D CHARACTER TURNAROUND SHEET`;
    }
    if (charRosterQuote) {
      charRosterQuote.textContent = spec.wikiQuote;
    }
    if (turnaroundFooterSpecs.length === 3) {
      const cloakInfo =
        spec.body_and_attire.cloak?.material ||
        spec.body_and_attire.attire?.garment ||
        spec.body_and_attire.wings?.type ||
        'Soft-Body Fabric';
      const weaponInfo = spec.weapon
        ? `${spec.weapon.name} — ${spec.weapon.type}`
        : spec.props || 'Hallownest Lore Asset';

      turnaroundFooterSpecs[0].textContent = `MASK // ${spec.head_mask.material}`;
      turnaroundFooterSpecs[1].textContent = `GROOM // ${cloakInfo}`;
      turnaroundFooterSpecs[2].textContent = `PROP // ${weaponInfo}`;
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
    const current = state.viewMode || 'turnaround';
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
    toggleJsonModal
  };
}
