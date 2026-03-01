export function applyBattleOutcomes({ battle, party, cfg, rng }) {
  const roster = party?.roster;
  if (!battle || !Array.isArray(battle.playerUnits) || !Array.isArray(roster)) return;
  const roll = typeof rng === 'function' ? rng : Math.random;
  const byId = new Map(roster.map((u) => [u?.id, u]));

  for (const unit of battle.playerUnits) {
    const rosterId = unit?.rosterId ?? unit?.sourceId;
    const rosterUnit = byId.get(rosterId);
    if (!rosterUnit) continue;

    if ((unit?.hp ?? 0) <= 0 || unit?.dead) {
      rosterUnit.status = 'dead';
      rosterUnit.healProgress = 0;
      continue;
    }

    rosterUnit.hp = Math.max(1, Math.floor(unit.hp ?? rosterUnit.hp ?? rosterUnit.maxHp ?? 1));
    let woundedChance = 0;
    const hpPct = Math.max(0, Number(unit.hp ?? 0)) / Math.max(1, Number(unit.hpMax ?? unit.maxHp ?? rosterUnit.maxHp ?? 1));
    if (hpPct <= Number(cfg?.WOUNDED_HP_THRESHOLD_PCT ?? 0.35)) woundedChance += Number(cfg?.WOUNDED_BASE_CHANCE ?? 0.4);
    if (unit?.moraleState === 'routing') woundedChance += Number(cfg?.WOUNDED_ROUTE_BONUS_CHANCE ?? 0.2);

    if (woundedChance > 0 && roll() < woundedChance) {
      rosterUnit.status = 'wounded';
      rosterUnit.healProgress = 0;
    } else if (rosterUnit.status !== 'wounded') {
      rosterUnit.status = 'healthy';
      rosterUnit.healProgress = 0;
    }
  }

  party.roster = roster.filter((unit) => unit?.status !== 'dead');
}

export function tickHealing({ party, cfg, isCamp, isStarving }) {
  const roster = party?.roster;
  if (!Array.isArray(roster)) return;

  for (const unit of roster) {
    if (unit?.status !== 'wounded') continue;
    let mult = 1;
    if (isCamp) mult *= Number(cfg?.HEAL_CAMP_MULT ?? 1.5);
    if (isStarving) mult *= Number(cfg?.HEAL_STARVING_MULT ?? 0.3);
    unit.healProgress = Math.max(0, Number(unit.healProgress ?? 0)) + Number(cfg?.HEAL_PER_DAY ?? 0.4) * mult;
    if (unit.healProgress >= 1) {
      unit.status = 'healthy';
      unit.healProgress = 0;
    }
  }
}
