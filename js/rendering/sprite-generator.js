/**
 * FallOfCavalry - Sprite Generator (Norland-style)
 * Eski app.js'den tam implementasyon
 */

import { mulberry32, hashStr, hexToRgb, rgbToHex, shade, clamp } from '../utils.js';

// Faction görsel tanımlamaları
const FACTION_VISUALS = {
  ottoman: {
    primary: "#c0392b",
    secondary: "#8e2a1f",
    accent: "#f1c40f",
    metal: "#8c8f95",
    leather: "#6a4a2f",
    horse: "#6d5845",
    headgear: "turban",
    cloak: true,
  },
  hre: {
    primary: "#2c3e50",
    secondary: "#1d2a38",
    accent: "#f4d03f",
    metal: "#9aa5b1",
    leather: "#4b3a2a",
    horse: "#4f4540",
    headgear: "kettle",
    cloak: false,
  },
  polish: {
    primary: "#e74c3c",
    secondary: "#9b2d21",
    accent: "#f7dc6f",
    metal: "#b0b7c2",
    leather: "#6e4a32",
    horse: "#6b4a3a",
    headgear: "cap",
    cloak: true,
  },
  spanish: {
    primary: "#f1c40f",
    secondary: "#b9770e",
    accent: "#c0392b",
    metal: "#a0a7b0",
    leather: "#5b4127",
    horse: "#5a4a3f",
    headgear: "morion",
    cloak: false,
  },
  venice: {
    primary: "#16a085",
    secondary: "#0e6655",
    accent: "#f4d03f",
    metal: "#9aa5b1",
    leather: "#6a4a2f",
    horse: "#6b5a45",
    headgear: "kettle",
    cloak: true,
  },
  bandit: {
    primary: "#3e2723",
    secondary: "#2a1a15",
    accent: "#6d4c41",
    metal: "#5a5a5a",
    leather: "#4e3629",
    horse: "#5c4033",
    headgear: "hood",
    cloak: true,
  },
};

const UNIT_VISUALS = {
  archer: { weapon: "bow", armor: "leather", shield: false, plume: false },
  pike_inf: { weapon: "pike", armor: "mail", shield: true, plume: false },
  musketeer: { weapon: "musket", armor: "coat", shield: false, plume: false },
  cav_archer: { weapon: "bow", armor: "leather", shield: false, plume: false },
  cav_pike: { weapon: "spear", armor: "mail", shield: false, plume: false },
  carbine_cav: { weapon: "carbine", armor: "coat", shield: false, plume: false },
  heavy_cav: { weapon: "lance", armor: "plate", shield: false, plume: true },
};

const FACTION_UNIT_OVERRIDES = {
  ottoman: {
    musketeer: { headgear: "janissary" },
    archer: { weapon: "composite_bow" },
  },
  hre: {
    pike_inf: { headgear: "kettle", shield: true },
    heavy_cav: { headgear: "closed" },
  },
  polish: {
    heavy_cav: { wings: true, plume: true, headgear: "cap" },
    cav_pike: { headgear: "cap" },
  },
  spanish: {
    musketeer: { headgear: "morion", weapon: "musket" },
    pike_inf: { headgear: "morion", weapon: "pike" },
  },
  venice: {
    musketeer: { headgear: "kettle", weapon: "musket" },
    heavy_cav: { plume: true, headgear: "closed" },
  },
};

export class SpriteGenerator {
  constructor() {
    this.cache = new Map();
  }
  
  getUnitSprite(factionId, unitType, seedKey = "") {
    const key = `${factionId}|${unitType}|${seedKey}`;
    
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    this.drawUnitSprite(ctx, factionId, unitType, size, seedKey);
    
    this.cache.set(key, canvas);
    return canvas;
  }
  
  drawUnitSprite(g, factionId, unitType, size, seedKey = "") {
    const rng = mulberry32(hashStr(`${factionId}|${unitType}|${seedKey}`));
    
    const factionBase = FACTION_VISUALS[factionId] || FACTION_VISUALS.ottoman;
    const unitBase = UNIT_VISUALS[unitType] || UNIT_VISUALS.pike_inf;
    const override = FACTION_UNIT_OVERRIDES[factionId]?.[unitType] || {};
    const profile = { ...unitBase, ...override };
    
    // Random variations
    const hasBeard = rng() > 0.62;
    const hairVariants = ["#3c2b1e", "#5a3b22", "#7a4c2a", "#2c1b12", "#c2a26a"];
    const hairColor = hairVariants[Math.floor(rng() * hairVariants.length)];
    const skinVariants = ["#e6c2a8", "#d9b38c", "#c99b74"];
    const skin = skinVariants[Math.floor(rng() * skinVariants.length)];
    
    const cloth = shade(factionBase.primary, profile.armor === "coat" ? 0.08 : 0);
    const clothHi = shade(cloth, 0.25);
    const clothLo = shade(cloth, -0.25);
    const hasHelm = rng() > 0.35 || profile.armor === "plate";
    
    const isCavalry = ['cav_archer', 'cav_pike', 'carbine_cav', 'heavy_cav'].includes(unitType);
    
    g.save();
    g.translate(size / 2, size / 2);
    
    // Draw horse for cavalry
    if (isCavalry) {
      this.drawHorse(g, factionBase.horse, size);
    }
    
    // Draw body
    this.drawBody(g, cloth, clothHi, clothLo, profile, size);
    
    // Draw head
    if (hasHelm) {
      this.drawHelmet(g, factionBase.metal, profile.headgear || factionBase.headgear, size);
    } else {
      this.drawHead(g, skin, hairColor, hasBeard, size);
    }
    
    // Draw weapon
    this.drawWeapon(g, profile.weapon, factionBase.metal, size);
    
    // Draw shield
    if (profile.shield) {
      this.drawShield(g, factionBase.primary, factionBase.accent, size);
    }
    
    // Draw plume
    if (profile.plume) {
      this.drawPlume(g, factionBase.accent, size);
    }
    
    // Draw wings (Polish Hussars)
    if (profile.wings) {
      this.drawWings(g, size);
    }
    
    g.restore();
  }
  
  drawHorse(g, color, size) {
    const s = size * 0.06;
    
    g.fillStyle = shade(color, -0.2);
    
    // Body
    g.fillRect(-3 * s, 1 * s, 6 * s, 4 * s);
    
    // Head
    g.fillRect(-1 * s, -1 * s, 2 * s, 3 * s);
    
    // Legs
    g.fillRect(-3 * s, 5 * s, 1.5 * s, 2 * s);
    g.fillRect(1.5 * s, 5 * s, 1.5 * s, 2 * s);
  }
  
  drawBody(g, cloth, clothHi, clothLo, profile, size) {
    const s = size * 0.06;
    
    // Torso
    g.fillStyle = cloth;
    g.fillRect(-2 * s, -2 * s, 4 * s, 5 * s);
    
    // Arms
    g.fillStyle = clothLo;
    g.fillRect(-3 * s, -1 * s, 1 * s, 4 * s);
    g.fillRect(2 * s, -1 * s, 1 * s, 4 * s);
    
    // Armor highlights
    if (profile.armor === "plate") {
      g.fillStyle = clothHi;
      g.fillRect(-1.5 * s, -1 * s, 3 * s, 1 * s);
    }
  }
  
  drawHead(g, skin, hairColor, hasBeard, size) {
    const s = size * 0.06;
    
    // Face
    g.fillStyle = skin;
    g.fillRect(-1.5 * s, -5 * s, 3 * s, 3 * s);
    
    // Hair
    g.fillStyle = hairColor;
    g.fillRect(-1.5 * s, -6 * s, 3 * s, 1.5 * s);
    
    // Beard
    if (hasBeard) {
      g.fillRect(-1 * s, -2.5 * s, 2 * s, 1 * s);
    }
  }
  
  drawHelmet(g, metalColor, type, size) {
    const s = size * 0.06;
    
    g.fillStyle = metalColor;
    
    switch (type) {
      case "kettle":
        g.fillRect(-2 * s, -6 * s, 4 * s, 4 * s);
        break;
      case "morion":
        g.fillRect(-2.5 * s, -6 * s, 5 * s, 3 * s);
        break;
      case "turban":
        g.fillStyle = "#f1c40f";
        g.fillRect(-2 * s, -6 * s, 4 * s, 3 * s);
        break;
      case "cap":
        g.fillStyle = "#c0392b";
        g.fillRect(-1.5 * s, -6 * s, 3 * s, 2 * s);
        break;
      default:
        g.fillRect(-1.5 * s, -6 * s, 3 * s, 3 * s);
    }
  }
  
  drawWeapon(g, weaponType, metalColor, size) {
    const s = size * 0.06;
    
    g.fillStyle = metalColor;
    
    switch (weaponType) {
      case "pike":
      case "spear":
        g.fillRect(2.5 * s, -8 * s, 0.5 * s, 10 * s);
        break;
      case "bow":
        g.strokeStyle = "#4e342e";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(3 * s, -2 * s, 2 * s, -Math.PI / 2, Math.PI / 2);
        g.stroke();
        break;
      case "musket":
      case "carbine":
        g.fillRect(2.5 * s, -3 * s, 0.8 * s, 5 * s);
        break;
      case "lance":
        g.fillRect(2.5 * s, -9 * s, 0.6 * s, 11 * s);
        break;
    }
  }
  
  drawShield(g, primaryColor, accentColor, size) {
    const s = size * 0.06;
    
    g.fillStyle = primaryColor;
    g.fillRect(-3.5 * s, -1 * s, 1.5 * s, 3 * s);
    
    g.fillStyle = accentColor;
    g.fillRect(-3.2 * s, 0, 1 * s, 1 * s);
  }
  
  drawPlume(g, color, size) {
    const s = size * 0.06;
    
    g.fillStyle = color;
    g.fillRect(-0.5 * s, -8 * s, 1 * s, 2 * s);
  }
  
  drawWings(g, size) {
    const s = size * 0.06;
    
    g.strokeStyle = "#8b4513";
    g.lineWidth = 2;
    
    // Left wing
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(-2 * s, -3 * s + i * s);
      g.lineTo(-5 * s, -5 * s + i * s);
      g.stroke();
    }
    
    // Right wing
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(2 * s, -3 * s + i * s);
      g.lineTo(5 * s, -5 * s + i * s);
      g.stroke();
    }
  }
  
  clearCache() {
    this.cache.clear();
  }
}

export default SpriteGenerator;