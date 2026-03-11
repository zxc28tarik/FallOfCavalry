import { it } from 'vitest';
import assert from 'node:assert/strict';

import * as CONST from '../../js/constants.js';
import { computeUnitCohesion, getFormationMultipliers } from '../../js/systems/formation.js';

it('formation cohesion increases with nearby allies', () => {
  const unit = { x: 0, y: 0, hp: 10, dead: false };
  const alliesFar = [
    unit,
    { x: 120, y: 0, hp: 10, dead: false },
    { x: 0, y: 120, hp: 10, dead: false },
  ];
  const alliesNear = [
    unit,
    { x: 20, y: 0, hp: 10, dead: false },
    { x: 0, y: 20, hp: 10, dead: false },
    { x: 30, y: 10, hp: 10, dead: false },
  ];

  const farCohesion = computeUnitCohesion(unit, alliesFar, 55, 3);
  const nearCohesion = computeUnitCohesion(unit, alliesNear, 55, 3);

  assert.equal(farCohesion, 0);
  assert.ok(nearCohesion > farCohesion);
  assert.equal(nearCohesion, 1);
});

it('line formation defense multiplier scales with cohesion', () => {
  const baseUnit = { formation: CONST.FORMATION.LINE, formSlot: 0 };
  const low = getFormationMultipliers(baseUnit, 0.1);
  const high = getFormationMultipliers(baseUnit, 1);

  assert.ok(high.formationDefMult > low.formationDefMult);
  assert.equal(high.formationDefMult, 1 + CONST.BATTLE_FORMATION.LINE_DEF_BONUS);
});
