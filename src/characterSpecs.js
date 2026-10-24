// Structured JSON Specification, Hollow Knight Wiki Lore, & Calibrated 3D Simulation Presets
// for all 8 Hollow Knight Characters

export const PIPELINE_METADATA = {
  title: 'Hollow Knight Lore Character Reference & Simulation Pipeline',
  description:
    'Comprehensive structured JSON specification for multi-character 3D asset generation, material zoning, and advanced fur, hair, and soft-body fabric simulations.',
  target_engines: [
    'Unreal Engine 5',
    'Blender Cycles',
    'Houdini (XGen/Hair & Fur Subsystem)'
  ],
  art_style:
    'High-end cinematic dark fantasy game asset, photorealistic material blending, hard chitinous shells, organic textures, micro-fur, velvet fuzz, and reactive fabric dynamics.',
  wiki_reference: 'https://hollowknight.fandom.com/wiki/Hollow_Knight_Wiki'
};

export const CHARACTER_SPECS = [
  {
    character_id: 'the_knight',
    name: 'The Knight',
    shortName: 'The Knight',
    role: 'Protagonist · Vessel of the Abyss',
    hotkey: '1',
    accentColor: '#7dd3fc',
    wikiQuote: '“An enigmatic wanderer who descends into Hallownest carrying only a broken nail, born of God and Void.”',
    actionName: 'Pure Nail Focus & Void Pulse',
    simPreset: {
      charType: 0,
      baseColor: '#1e2433',
      tipColor: '#bae6fd',
      maskColor: '#f1f5f9',
      eyeGlowColor: '#38bdf8',
      coreColor: '#0f172a',
      furLength: 0.26,
      furDensity: 0.86,
      roughness: 0.68,
      specular: 0.34,
      clumping: 0.42,
      curliness: 0.18,
      wearAmount: 0.35,
      windStrength: 0.95
    },
    head_mask: {
      material: 'Smooth, matte-white porcelain and chitin-blend',
      surface_details: 'Microscopic surface pitting, fine hairline fractures, inward-notched pincer horns',
      groom_features: 'Soft velvet fuzz micro-fibers catching rim light along contours',
      eyes: 'Hollow, dark eye sockets emitting a faint, cool inner void emission'
    },
    body_and_attire: {
      physique: 'Slender, pitch-black ink-like Void body',
      skin_texture: 'Ultra-fine velvety nap',
      cloak: {
        color: 'Deep charcoal-black',
        material: 'Dense woven Mothwing Cloak fabric structure',
        simulation_properties:
          'Frayed, dynamic fuzz strands engineered for high-displacement wind and collision simulation'
      }
    },
    weapon: {
      name: 'Pure Nail',
      type: 'Slender, sharpened blade forged to perfection by the Nailsmith',
      details: 'Etched pale-steel filigree with a faint, ethereal white Soul glow'
    }
  },
  {
    character_id: 'the_hollow_knight',
    name: 'The Hollow Knight',
    shortName: 'Hollow Knight',
    role: 'Pure Vessel · Sealed in the Black Egg',
    hotkey: '2',
    accentColor: '#fb923c',
    wikiQuote: '“The fully grown Vessel chosen to seal the Radiance within the Temple of the Black Egg.”',
    actionName: 'Infection Core Eruption',
    simPreset: {
      charType: 1,
      baseColor: '#232028',
      tipColor: '#fdba74',
      maskColor: '#e6dec8',
      eyeGlowColor: '#ff7b00',
      coreColor: '#ff6b00',
      furLength: 0.32,
      furDensity: 0.88,
      roughness: 0.72,
      specular: 0.30,
      clumping: 0.56,
      curliness: 0.28,
      wearAmount: 0.88,
      windStrength: 1.12
    },
    head_mask: {
      material: 'Aged ivory-white chitin with tall serrated royal horns',
      surface_details: 'Massive diagonal structural crack across left eye socket, heavy discoloration',
      groom_features: 'Heavy velvet-fuzz growth along seam lines'
    },
    body_and_attire: {
      physique: 'Towering, lean bug-oid anatomy (single right arm)',
      shell_plating: 'Dark, charcoal-grey segmented shell plating',
      infection_core: {
        location: 'Exposed ruptured chest core',
        texture: 'Volatile, glowing orange Radiance infection-sac/blight',
        shader_settings: 'Subsurface scattering enabled'
      },
      cloak: {
        type: 'Massive, tattered shredded silk-cloth',
        draping: 'Heavy, weighted folds',
        simulation_properties: 'Dynamic simulation guides for particle tearing and dust interaction'
      }
    },
    weapon: {
      name: 'Corrupted Greatnail',
      type: 'Massive, heavy blade matching its towering scale'
    }
  },
  {
    character_id: 'hornet',
    name: 'Hornet',
    shortName: 'Hornet',
    role: 'Protector of Hallownest · Daughter of Deepnest',
    hotkey: '3',
    accentColor: '#f87171',
    wikiQuote: '“Skilled protector of Hallownest’s ruins, wielding a needle and thread with lethal grace.”',
    actionName: 'Gossamer Storm & Needle Lunge',
    simPreset: {
      charType: 2,
      baseColor: '#881313',
      tipColor: '#fca5a5',
      maskColor: '#f8fafc',
      eyeGlowColor: '#0f172a',
      coreColor: '#dc2626',
      furLength: 0.22,
      furDensity: 0.90,
      roughness: 0.50,
      specular: 0.48,
      clumping: 0.25,
      curliness: 0.10,
      wearAmount: 0.14,
      windStrength: 1.05
    },
    head_mask: {
      material: 'Smooth, polished bone-white chitin with tall twin sweeping horns',
      surface_details: 'Streamlined, sleek, minimal wear, angled almond eye apertures',
      groom_features: 'Sharp rim-light separation along horns'
    },
    body_and_attire: {
      physique: 'Slender, agile arachnid-insectoid limbs',
      defensive_bindings: 'Subtle black-chitin wrapping',
      cloak: {
        color: 'Vivid, deep crimson-red',
        material: 'Heavy, dynamic Weaversilk fabric with fine reactive micro-fuzz nap',
        draping: 'Sharp, conical pleated bell draping over agile frame'
      }
    },
    weapon: {
      name: 'Needle & Silk Thread',
      type: 'Razor-sharp, glinting piercing weapon with circular ring hilt',
      accessory: 'Woven red & gossamer silk tassel'
    }
  },
  {
    character_id: 'quirrel',
    name: 'Quirrel',
    shortName: 'Quirrel',
    role: 'Scholar & Explorer · Disciple of Monomon',
    hotkey: '4',
    accentColor: '#2dd4bf',
    wikiQuote: '“An inquisitive, cheerful explorer drawn to the Teacher’s Archives in Fog Canyon.”',
    actionName: 'Archive Scholar Slash',
    simPreset: {
      charType: 3,
      baseColor: '#134e4a',
      tipColor: '#99f6e4',
      maskColor: '#e7dfd3',
      eyeGlowColor: '#38bdf8',
      coreColor: '#0f766e',
      furLength: 0.28,
      furDensity: 0.85,
      roughness: 0.74,
      specular: 0.28,
      clumping: 0.45,
      curliness: 0.22,
      wearAmount: 0.52,
      windStrength: 0.90
    },
    head_mask: {
      material: "Cream-colored weathered explorer's mask crowned with Monomon's Dreamer Mask hat",
      surface_details: 'Distinct snout contour, travel dust, scratches, 4-eyed Dreamer crest on brow',
      groom_features: 'Soft velvet-fuzz contour'
    },
    body_and_attire: {
      physique: 'Compact, nimble pillbug body covered in a matte-black velvety nap',
      attire: {
        garment: "Deep teal-blue scholar's trench cloak and wrapped neck scarf",
        material: 'Thick, worn wool-blend fabric',
        simulation_properties: 'Visible threading and dynamic edge fuzz'
      }
    },
    weapon: {
      name: 'Curved Explorer Nail',
      type: "Elegant, finely honed explorer's nail with worn scabbard"
    }
  },
  {
    character_id: 'the_pale_king',
    name: 'The Pale King',
    shortName: 'Pale King',
    role: 'Wyrm · Monarch of Hallownest',
    hotkey: '5',
    accentColor: '#fde047',
    wikiQuote: '“No cost too great. The ancient Wyrm who shed his shell to grant sapience to Hallownest.”',
    actionName: 'Pale Wyrm Soul Beacon',
    simPreset: {
      charType: 4,
      baseColor: '#cbd5e1',
      tipColor: '#fef9c3',
      maskColor: '#ffffff',
      eyeGlowColor: '#fef08a',
      coreColor: '#eab308',
      furLength: 0.25,
      furDensity: 0.92,
      roughness: 0.46,
      specular: 0.58,
      clumping: 0.30,
      curliness: 0.14,
      wearAmount: 0.10,
      windStrength: 0.85
    },
    morphology: 'Ethereal Higher Being combining insectoid royalty and ancient Wyrm anatomy',
    head_crown: {
      material: 'Intricate, 6-pronged crown-like white chitinous head-plate',
      ornamentation: 'Subtle golden filigree with glowing pale-light particle emission'
    },
    attire: {
      garment: 'Multi-layered, ornate white-gold ceremonial monarch robes',
      material: 'Heavy silk brocade',
      simulation_properties: 'Reactive fringe fuzz and procedural pale-light dissipation guides'
    },
    weapon: {
      name: 'King’s Brand Scepter',
      type: 'Radiant Pale Court sigil staff and glowing Soul Focus aura'
    }
  },
  {
    character_id: 'the_radiance',
    name: 'The Radiance',
    shortName: 'The Radiance',
    role: 'Higher Being · Forgotten Light of Dreams',
    hotkey: '6',
    accentColor: '#facc15',
    wikiQuote: '“The blazing, moth-like Higher Being of Light and Dream, source of the Infection.”',
    actionName: 'Blazing Dawn Burst',
    simPreset: {
      charType: 5,
      baseColor: '#d97706',
      tipColor: '#fef9c3',
      maskColor: '#ffffff',
      eyeGlowColor: '#ff7b00',
      coreColor: '#f59e0b',
      furLength: 0.48,
      furDensity: 0.98,
      roughness: 0.56,
      specular: 0.54,
      clumping: 0.52,
      curliness: 0.42,
      wearAmount: 0.08,
      windStrength: 1.35
    },
    morphology: 'Moth-like divine deity with 3 crown spikes and radiating light construct wings',
    head_and_face: {
      material: 'Pure white luminescent shell plate',
      eyes: 'Multiple glowing fiery-orange light arrays (emissive volumetric shader)'
    },
    wings_and_fur: {
      wings:
        'Multi-layered ethereal light-feather wings with dynamic particle shredding and energy trails',
      groom_features:
        'Dense, luminescent golden-white fluff and micro-fur coat covering the torso and moth mane, reacting to strong wind vectors and divine light physics'
    },
    weapon: {
      name: 'Dream Nail Sword Halo',
      type: 'Radiating ring of conjured golden-white light blades'
    }
  },
  {
    character_id: 'zote_the_mighty',
    name: 'Zote the Mighty',
    shortName: 'Zote',
    role: 'Self-Proclaimed “Knight of Great Renown”',
    hotkey: '7',
    accentColor: '#c084fc',
    wikiQuote: '“Precept One: Always Win Your Battles. Wields a shellwood blade named Life Ender.”',
    actionName: 'Life Ender Flailing Strike',
    simPreset: {
      charType: 6,
      baseColor: '#3b2838',
      tipColor: '#a88b9c',
      maskColor: '#cbd5e1',
      eyeGlowColor: '#475569',
      coreColor: '#581c87',
      furLength: 0.29,
      furDensity: 0.78,
      roughness: 0.86,
      specular: 0.18,
      clumping: 0.68,
      curliness: 0.48,
      wearAmount: 0.92,
      windStrength: 0.75
    },
    head_mask: {
      material: 'Dull, chalky grey mask with crooked lopsided horns and grumpy downturned mouth',
      surface_details: 'Scratches, battle smudges, and lack of maintenance polish'
    },
    body_and_attire: {
      physique: 'Compact, awkward insectoid proportions with a haughty tilted posture',
      cloak: {
        color: 'Dingy, faded purple-brown fabric',
        simulation_properties:
          'Stiff, poorly maintained cloth simulation with heavy wrinkles and dust particle interaction'
      }
    },
    weapon: {
      name: 'Life Ender',
      type: 'Cumbersome shellwood sword — incapable of dealing physical damage, yet swung with pride'
    }
  },
  {
    character_id: 'cornifer',
    name: 'Cornifer',
    shortName: 'Cornifer',
    role: 'Master Cartographer of Dirtmouth',
    hotkey: '8',
    accentColor: '#4ade80',
    wikiQuote: '“Hmm-hm-hm-hm-hmmm... A cheerful weevil cartographer charting every cavern of Hallownest.”',
    actionName: 'Cartographer’s Humming & Quill Sketch',
    simPreset: {
      charType: 7,
      baseColor: '#2d3b2d',
      tipColor: '#a7f3d0',
      maskColor: '#e2c08d',
      eyeGlowColor: '#fde68a',
      coreColor: '#65a30d',
      furLength: 0.33,
      furDensity: 0.88,
      roughness: 0.76,
      specular: 0.26,
      clumping: 0.50,
      curliness: 0.34,
      wearAmount: 0.58,
      windStrength: 0.80
    },
    head_mask: {
      material: 'Warm amber-tinted weevil mask with long curved proboscis trunk & wire spectacles',
      surface_details: 'Stained with black cartography ink spots and travel wear'
    },
    body_and_attire: {
      physique: 'Plump, rotund insectoid body with a dense warm-brown velvet nap',
      attire: {
        garment: "Bulky green-brown traveler's cloak and oversized mapmaker backpack",
        simulation_properties:
          'Soft felt and wool texture with loose fuzz strands suited for relaxed cloth drape physics'
      }
    },
    props: 'Carrying a bundle of rolled parchment map scrolls, spectacles, and feather quill',
    weapon: {
      name: 'Rolled Map Bundle & Quill',
      type: 'Parchment scroll case strapped across back with ink-dipped feather quill'
    }
  }
];

export function getCharacterSpecById(id) {
  return CHARACTER_SPECS.find((c) => c.character_id === id) || CHARACTER_SPECS[0];
}
