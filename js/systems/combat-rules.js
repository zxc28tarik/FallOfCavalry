import * as CONST from '../constants.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function computeDamage({ attacker, defender, base, damageType, terrainMods, commandCtx } = {}) {
  const atk = Number.isFinite(base) ? base : Math.max(1, Number(attacker?.atk ?? 1));
  const armorType = defender?.armorType || CONST.ARMOR_TYPE.NONE;
  const type = damageType || attacker?.damageType || CONST.DAMAGE_TYPE.CUT;
  const mit = Number(CONST.ARMOR_MITIGATION[armorType] ?? 0);
  const vsBonus = Number(CONST.DAMAGE_VS_ARMOR?.[type]?.[armorType] ?? 0);

  const acc = Number(terrainMods?.acc ?? 1);
  const charge = Number(terrainMods?.charge ?? 1);
  const holdDef = commandCtx?.defMult ?? 1;
  const retreatDef = commandCtx?.retreating ? 0.94 : 1;

  const reduced = atk * acc * charge * retreatDef * holdDef * (1 - clamp(mit - vsBonus, 0, 0.6));
  return Math.max(1, Math.floor(reduced));
}

export function applyCommandEffects(unit, command) {
  if (!unit) return unit;
  const cmd = command || CONST.BATTLE_COMMANDS.HOLD;
  unit.command = cmd;

  if (cmd === CONST.BATTLE_COMMANDS.HOLD) {
    unit.commandSpeedMult = 0.85;
    unit.commandDefMult = 1.10;
    unit.retreating = false;
    unit.skirmish = false;
    return unit;
  }

  if (cmd === CONST.BATTLE_COMMANDS.FOCUS) {
    unit.commandSpeedMult = 1.0;
    unit.commandDefMult = 1.0;
    unit.retreating = false;
    unit.skirmish = false;
    return unit;
  }

  if (cmd === CONST.BATTLE_COMMANDS.SKIRMISH) {
    unit.commandSpeedMult = 1.1;
    unit.commandDefMult = 0.9;
    unit.retreating = false;
    unit.skirmish = true;
    return unit;
  }

  if (cmd === CONST.BATTLE_COMMANDS.RETREAT) {
    unit.commandSpeedMult = 1.2;
    unit.commandDefMult = 0.95;
    unit.retreating = true;
    unit.skirmish = false;
    unit.morale = Math.max(0, Number(unit.morale ?? 50) - 2);
    return unit;
  }

  return unit;
}

export default { computeDamage, applyCommandEffects };
