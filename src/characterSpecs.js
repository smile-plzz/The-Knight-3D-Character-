// Structured JSON Specification, Hollow Knight Wiki Lore, & Calibrated 3D Simulation Presets
// for all 10 Canonical Hollow Knight Characters.

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
        draping: 'Deeply fluted vertical pleats billowing with wind vectors',
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
        color: 'Tattered shredded charcoal-grey silk',
        material: 'Massive, heavy shredded silk-cloth',
        draping: 'Heavy, weighted floor-length folds',
        simulation_properties: 'Dynamic simulation guides for particle tearing and dust interaction'
      }
    },
    weapon: {
      name: 'Corrupted Greatnail',
      type: 'Massive, heavy blade matching its towering scale',
      details: 'Notched blackened steel emitting infection blight sparks'
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
      skin_texture: 'Subtle black-chitin wrapping',
      cloak: {
        color: 'Vivid, deep crimson-red',
        material: 'Heavy, dynamic Weaversilk fabric with fine reactive micro-fuzz nap',
        draping: 'Sharp, conical pleated bell draping over agile frame',
        simulation_properties: 'Responsive cloth simulation with edge silk micro-fuzz'
      }
    },
    weapon: {
      name: 'Needle & Silk Thread',
      type: 'Razor-sharp, glinting piercing weapon with circular ring hilt',
      details: 'Polished silver-steel Needle blade trailing woven red silk filament'
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
      surface_details: 'Distinct rounded beak snout, travel dust, scratches, 4-lens Dreamer crest',
      groom_features: 'Soft velvet-fuzz contour'
    },
    body_and_attire: {
      physique: 'Compact, nimble pillbug body covered in a matte-black velvety nap',
      skin_texture: 'Fine dark velvet nap',
      cloak: {
        color: 'Deep teal-blue',
        material: "Deep teal-blue scholar's trench cloak and wrapped neck scarf",
        draping: 'Worn wool-blend drape with travel wrinkles',
        simulation_properties: 'Visible threading and dynamic edge fuzz'
      }
    },
    weapon: {
      name: 'Curved Explorer Nail',
      type: "Elegant, finely honed explorer's nail with worn leather scabbard",
      details: 'Single-edged curved steel blade with brass pommel'
    }
  },
  {
    character_id: 'cloth',
    name: 'Cloth',
    shortName: 'Cloth',
    role: 'Cicada Warrior · Adventurer from Faraway',
    hotkey: '5',
    accentColor: '#f59e0b',
    wikiQuote: '“An amicable, stout cicada warrior traveling through Hallownest to prove her bravery.”',
    actionName: 'Great-Club Ground Slam',
    simPreset: {
      charType: 4,
      baseColor: '#52341d',
      tipColor: '#fde68a',
      maskColor: '#d97706',
      eyeGlowColor: '#78350f',
      coreColor: '#b45309',
      furLength: 0.32,
      furDensity: 0.84,
      roughness: 0.78,
      specular: 0.22,
      clumping: 0.54,
      curliness: 0.28,
      wearAmount: 0.65,
      windStrength: 0.85
    },
    head_mask: {
      material: 'Stout cicada warrior hood-mask with knotted horn-ears',
      surface_details: 'Coarse burlap fiber texture, small rounded eye apertures',
      groom_features: 'Loose burlap fray strands and edge fibers'
    },
    body_and_attire: {
      physique: 'Stocky, robust insectoid warrior build',
      skin_texture: 'Matte brown velvet nap',
      cloak: {
        color: 'Warm ochre and weathered burlap',
        material: 'Rugged frayed burlap poncho-cape & knotted neck scarf',
        draping: 'Weighted drape with loose frayed strands',
        simulation_properties: 'Coarse fabric simulation with fray fiber separation'
      }
    },
    weapon: {
      name: 'Prickly Great-Club',
      type: 'Massive dinosaur-bone and timber war-club studded with sharp thorns',
      details: 'Studded with sharp ivory bone spikes and heavy timber head'
    }
  },
  {
    character_id: 'grimm',
    name: 'Troupe Master Grimm',
    shortName: 'Grimm',
    role: 'Vessel of the Nightmare Heart · Ringmaster',
    hotkey: '6',
    accentColor: '#ef4444',
    wikiQuote: '“Shadows dream of endless fire, flames devour and embers soar. Dance with me, my friend.”',
    actionName: 'Nightmare Flame Pillar & Bat Cloak Flare',
    simPreset: {
      charType: 5,
      baseColor: '#18181b',
      tipColor: '#fca5a5',
      maskColor: '#ffffff',
      eyeGlowColor: '#dc2626',
      coreColor: '#b91c1c',
      furLength: 0.24,
      furDensity: 0.92,
      roughness: 0.44,
      specular: 0.62,
      clumping: 0.35,
      curliness: 0.16,
      wearAmount: 0.12,
      windStrength: 1.15
    },
    head_mask: {
      material: 'Stark bone-white theater mask split by vertical scarlet flame markings',
      surface_details: 'Smooth porcelain finish with high-gloss scarlet streaks, tall swept-back bat horns',
      groom_features: 'Micro-velvet rim highlight along horn edges'
    },
    body_and_attire: {
      physique: 'Slender, razor-thin vampire-insectoid frame',
      skin_texture: 'Ultra-fine abyssal velvet nap',
      cloak: {
        color: 'Obsidian black with vivid scarlet red inner lining',
        material: 'High-collared bat-wing outer cloak with jagged hem',
        draping: 'Dramatic flared collar with scalloped hem folds',
        simulation_properties: 'High-displacement flutter with sharp bat-wing points'
      }
    },
    weapon: {
      name: 'Scarlet Nightmare Flame Orbs',
      type: 'Orbiting lantern of volatile scarlet dreamfire and Nightmare brooch',
      details: 'Revolving scarlet ember lanterns and glowing chest brooch'
    }
  },
  {
    character_id: 'the_pale_king',
    name: 'The Pale King',
    shortName: 'Pale King',
    role: 'Wyrm · Monarch of Hallownest',
    hotkey: '7',
    accentColor: '#fde047',
    wikiQuote: '“No cost too great. The ancient Wyrm who shed his shell to grant sapience to Hallownest.”',
    actionName: 'Pale Court Sigil Pulse & Saw Halo',
    simPreset: {
      charType: 6,
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
    head_mask: {
      material: 'Regal bone-white Wyrm Crown-Mask with 4 tall symmetrical spikes',
      surface_details: 'Flawless carved alabaster shell with subtle golden filigree',
      groom_features: 'Ethereal pale rim fuzz and soul particle dissipation'
    },
    body_and_attire: {
      physique: 'Ethereal Wyrm Higher Being form concealed beneath robes',
      skin_texture: 'Silvery velvet nap',
      cloak: {
        color: 'Layered pale-silver and white-gold',
        material: 'Heavy silk brocade ceremonial monarch robes dragging at hem',
        draping: 'Floor-length heavy drape with pleated folds',
        simulation_properties: 'Floor-length heavy drape with reactive fringe fuzz'
      }
    },
    weapon: {
      name: "King's Brand Sigil Halo",
      type: 'Luminous Pale Court buzzsaw-halo and Soul Focus aura',
      details: 'Concentric rotating gold and pale Soul rings floating behind crown'
    }
  },
  {
    character_id: 'the_radiance',
    name: 'The Radiance',
    shortName: 'The Radiance',
    role: 'Higher Being · Forgotten Light of Dreams',
    hotkey: '8',
    accentColor: '#facc15',
    wikiQuote: '“The blazing, moth-like Higher Being of Light and Dream, source of the Infection.”',
    actionName: 'Blazing Sunburst & Dream Sword Halo',
    simPreset: {
      charType: 7,
      baseColor: '#b45309',
      tipColor: '#fef08a',
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
    head_mask: {
      material: 'Pure white carapace crowned with 3 curved horn-spikes',
      surface_details: 'Six blazing golden-amber eye arrays',
      groom_features: 'Dense golden-white moth fluff and mane contours'
    },
    body_and_attire: {
      physique: 'Towering divine moth deity with spiked legs',
      skin_texture: 'Plush moth fluff',
      cloak: {
        color: 'Radiant golden-white',
        material: 'Multi-layered ethereal light-feather wings draping like a cape',
        draping: 'Sweeping wing span cascading from shoulders',
        simulation_properties: 'High-amplitude wind fluttering and divine particle shed'
      }
    },
    weapon: {
      name: 'Dream Nail Sword Halo & Sun Core',
      type: 'Blazing chest core and revolving ring of golden Dream Swords',
      details: 'Eight conjured light blades and blinding emissive chest orb'
    }
  },
  {
    character_id: 'zote_the_mighty',
    name: 'Zote the Mighty',
    shortName: 'Zote',
    role: 'Self-Proclaimed “Knight of Great Renown”',
    hotkey: '9',
    accentColor: '#c084fc',
    wikiQuote: '“Precept One: Always Win Your Battles. Wields a shellwood blade named Life Ender.”',
    actionName: 'Life Ender Flailing Strike',
    simPreset: {
      charType: 8,
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
      material: 'Dull chalky-grey mask with crooked lopsided horns',
      surface_details: 'Heavy scratches, battle smudges, grumpy downturned mouth',
      groom_features: 'Uneven sparse edge fuzz'
    },
    body_and_attire: {
      physique: 'Compact, awkward insectoid proportions with haughty posture',
      skin_texture: 'Matte dusty grey nap',
      cloak: {
        color: 'Dingy faded purple-brown',
        material: 'Stiff, poorly maintained cloth with heavy wrinkles',
        draping: 'Stiff, asymmetrical folds with jagged frayed hem',
        simulation_properties: 'Stiff cloth drape with dust particle shed'
      }
    },
    weapon: {
      name: 'Life Ender',
      type: 'Cumbersome carved shellwood sword incapable of cutting, swung with fury',
      details: 'Rough-hewn wooden blade notched from hitting stone walls'
    }
  },
  {
    character_id: 'cornifer',
    name: 'Cornifer',
    shortName: 'Cornifer',
    role: 'Master Cartographer of Dirtmouth',
    hotkey: '0',
    accentColor: '#4ade80',
    wikiQuote: '“Hmm-hm-hm-hm-hmmm... A cheerful weevil cartographer charting every cavern of Hallownest.”',
    actionName: 'Cartographer Humming & Quill Sketch',
    simPreset: {
      charType: 9,
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
      material: 'Warm amber weevil mask with long curved proboscis trunk',
      surface_details: 'Stained with black cartography ink spots and wire spectacles',
      groom_features: 'Soft velvet-fuzz contour'
    },
    body_and_attire: {
      physique: 'Plump, rotund insectoid body with warm-brown velvet nap',
      skin_texture: 'Dense plush velvet nap',
      cloak: {
        color: 'Earthy green-brown felt',
        material: "Bulky traveler's cape and oversized backpack strap",
        draping: 'Soft, rounded folds suited for sitting on a bench',
        simulation_properties: 'Soft felt and wool texture with loose fuzz'
      }
    },
    weapon: {
      name: 'Rolled Map Bundle & Quill',
      type: 'Parchment scroll case strapped across back with ink-dipped feather quill',
      details: 'Bundle of hand-drawn Hallownest maps with a large goose feather quill'
    },
    props: 'Rolled parchment maps, wire spectacles, ink bottle, and feather quill'
  }
];

export function getCharacterSpecById(id) {
  return CHARACTER_SPECS.find((c) => c.character_id === id) || CHARACTER_SPECS[0];
}
