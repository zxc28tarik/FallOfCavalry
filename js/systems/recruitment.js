import * as CONST from '../constants.js';

function hashSeed(input) {
  const str = String(input || 'seed');
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function ensureRosterModel(roster) {
  if (!Array.isArray(roster)) return [];
  return roster.map((unit, index) => ({
    id: unit.id || `unit-${Date.now()}-${index}`,
    name: unit.name || unit.label || `Unit ${index + 1}`,
    class: unit.class || 'infantry',
    hp: Math.max(1, Math.floor(unit.hp ?? unit.maxHp ?? 100)),
    maxHp: Math.max(1, Math.floor(unit.maxHp ?? unit.hp ?? 100)),
    atk: Math.max(1, Math.floor(unit.atk ?? 10)),
    def: Math.max(0, Math.floor(unit.def ?? 5)),
    wage: Math.max(0, Math.floor(unit.wage ?? unit.wagePerDay ?? 1)),
    cost: Math.max(1, Math.floor(unit.cost ?? 10)),
    wagePerDay: Math.max(0, Math.floor(unit.wagePerDay ?? unit.wage ?? 1)),
    speed: Math.max(20, Math.floor(unit.speed ?? 70)),
    isRanged: Boolean(unit.isRanged),
    rangedRange: Math.max(0, Math.floor(unit.rangedRange ?? 0)),
    rangedDamage: Math.max(0, Math.floor(unit.rangedDamage ?? 0)),
    rangedCooldown: Number(unit.rangedCooldown ?? 0),
  }));
}

export function getRecruitPool(settlement, seed) {
  const tier = Number.isFinite(settlement?.tier)
    ? settlement.tier
    : CONST.SETTLEMENT_TIER[String(settlement?.type || '').toLowerCase()] || CONST.SETTLEMENT_TIER.village;
  const templates = CONST.RECRUIT_POOL_BY_TIER[tier] || CONST.RECRUIT_POOL_BY_TIER[1] || [];
  const rng = mulberry32(hashSeed(`${settlement?.id || 'settlement'}:${seed || 1}:${tier}`));
  const count = 6 + Math.floor(rng() * 7);
  const pool = [];
  for (let i = 0; i < count; i += 1) {
    const tpl = templates[Math.floor(rng() * templates.length)] || templates[0];
    if (!tpl) continue;
    pool.push({
      ...tpl,
      uid: `${settlement?.id || 's'}-${seed}-${i}-${tpl.id}`,
      cost: Math.max(1, Math.floor(tpl.cost * (0.9 + rng() * 0.3))),
      hp: tpl.hp ?? 100,
      maxHp: tpl.maxHp ?? tpl.hp ?? 100,
      atk: tpl.atk ?? 10,
      def: tpl.def ?? 5,
      wage: tpl.wage ?? 1,
      wagePerDay: tpl.wage ?? 1,
      speed: tpl.speed ?? 70,
      isRanged: Boolean(tpl.isRanged),
      rangedRange: tpl.rangedRange ?? 0,
      rangedDamage: tpl.rangedDamage ?? 0,
      rangedCooldown: tpl.rangedCooldown ?? 0,
    });
  }
  return pool;
}

export function canHire(playerGold, unit) {
  return Number(playerGold || 0) >= Number(unit?.cost || 0);
}

export function hireUnit(party, unit) {
  if (!party || !unit) return { ok: false, message: 'Geçersiz birim.' };
  if (!Array.isArray(party.roster)) party.roster = [];
  party.roster = ensureRosterModel(party.roster);
  if (!canHire(party.gold, unit)) return { ok: false, message: 'Altın yetersiz.' };

  const next = {
    id: unit.uid || `${unit.id}-${Date.now()}-${party.roster.length + 1}`,
    name: unit.label || unit.name || unit.id,
    class: unit.class || 'infantry',
    hp: unit.hp ?? 100,
    maxHp: unit.maxHp ?? unit.hp ?? 100,
    atk: unit.atk ?? 10,
    def: unit.def ?? 5,
    wage: unit.wage ?? 1,
    cost: unit.cost ?? 10,
    wagePerDay: unit.wage ?? 1,
    speed: unit.speed ?? 70,
    isRanged: Boolean(unit.isRanged),
    rangedRange: unit.rangedRange ?? 0,
    rangedDamage: unit.rangedDamage ?? 0,
    rangedCooldown: unit.rangedCooldown ?? 0,
  };

  party.gold = Math.max(0, Math.floor((party.gold || 0) - (unit.cost || 0)));
  party.roster.push(next);
  return { ok: true, message: `${next.name} kiralandı.` };
}

export default {
  ensureRosterModel,
  getRecruitPool,
  canHire,
  hireUnit,
};
