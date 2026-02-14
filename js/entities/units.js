/**
 * FallOfCavalry - Unit System
 */

import * as CONST from '../constants.js';
import { distance, clamp } from '../utils.js';

export class Unit {
  constructor(data) {
    this.id = data.id;
    this.type = data.type;
    this.faction = data.faction;
    this.side = data.side; // 'player' or 'enemy'
    
    // Position
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.tx = this.x;
    this.ty = this.y;
    
    // Stats
    this.hp = data.hp || 100;
    this.maxHp = data.maxHp || 100;
    this.morale = data.morale || 100;
    this.maxMorale = 100;
    
    // Combat
    this.attack = this.getBaseAttack();
    this.defense = this.getBaseDefense();
    this.range = this.getBaseRange();
    this.speed = this.getBaseSpeed();
    
    // State
    this.stance = data.stance || CONST.UNIT.STANCE.ATTACK;
    this.target = null;
    this.attackCooldown = 0;
    this.retreating = false;
  }
  
  getBaseAttack() {
    const attacks = {
      pike_inf: 15,
      archer: 12,
      musketeer: 20,
      cav_archer: 18,
      cav_pike: 25,
      carbine_cav: 30,
      heavy_cav: 40,
    };
    return attacks[this.type] || 15;
  }
  
  getBaseDefense() {
    const defenses = {
      pike_inf: 20,
      archer: 8,
      musketeer: 10,
      cav_archer: 10,
      cav_pike: 15,
      carbine_cav: 12,
      heavy_cav: 25,
    };
    return defenses[this.type] || 10;
  }
  
  getBaseRange() {
    const ranges = {
      pike_inf: CONST.BATTLE.RANGE_MELEE,
      archer: CONST.BATTLE.RANGE_ARCHER,
      musketeer: CONST.BATTLE.RANGE_MUSKET,
      cav_archer: CONST.BATTLE.RANGE_ARCHER,
      cav_pike: CONST.BATTLE.RANGE_MELEE,
      carbine_cav: CONST.BATTLE.RANGE_CARBINE,
      heavy_cav: CONST.BATTLE.RANGE_MELEE,
    };
    return ranges[this.type] || CONST.BATTLE.RANGE_MELEE;
  }
  
  getBaseSpeed() {
    const speeds = {
      pike_inf: 40,
      archer: 45,
      musketeer: 35,
      cav_archer: 80,
      cav_pike: 75,
      carbine_cav: 85,
      heavy_cav: 70,
    };
    return speeds[this.type] || 50;
  }
  
  isRanged() {
    return this.range > CONST.BATTLE.RANGE_MELEE;
  }
  
  isCavalry() {
    return ['cav_archer', 'cav_pike', 'carbine_cav', 'heavy_cav'].includes(this.type);
  }
  
  update(dt, enemies) {
    // Update cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }
    
    // Check if should flee
    if (this.morale < CONST.BATTLE.MORALE_FLEE_THRESHOLD) {
      this.retreating = true;
      this.flee();
      return;
    }
    
    // Find target
    if (!this.target || this.target.hp <= 0) {
      this.target = this.findNearestEnemy(enemies);
    }
    
    // Behavior based on stance
    if (this.target) {
      this.engageTarget(dt);
    } else if (this.stance === CONST.UNIT.STANCE.ATTACK) {
      // Advance forward
      this.tx = this.x;
      this.ty = Math.max(0, this.y - 20);
    }
    
    // Move towards target position
    this.move(dt);
  }
  
  move(dt) {
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist > 1) {
      const moveAmount = Math.min(this.speed * dt, dist);
      this.x += (dx / dist) * moveAmount;
      this.y += (dy / dist) * moveAmount;
    }
  }
  
  engageTarget(dt) {
    if (!this.target) return;
    
    const dist = distance(this.x, this.y, this.target.x, this.target.y);
    
    if (dist <= this.range) {
      // In range - attack
      if (this.attackCooldown <= 0) {
        this.attackTarget();
        this.attackCooldown = this.isRanged() ? 2.0 : 1.0;
      }
      
      // Stop moving if melee
      if (!this.isRanged()) {
        this.tx = this.x;
        this.ty = this.y;
      }
    } else {
      // Move towards target
      if (this.stance !== CONST.UNIT.STANCE.HOLD) {
        this.tx = this.target.x;
        this.ty = this.target.y;
      }
    }
  }
  
  attackTarget() {
    if (!this.target || this.target.hp <= 0) return;
    
    const damage = this.calculateDamage(this.target);
    const killed = this.target.takeDamage(damage);
    
    if (killed) {
      this.target = null;
    }
  }
  
  calculateDamage(target) {
    const baseDamage = this.attack;
    const defense = target.defense;
    const moraleMod = this.morale / 100;
    
    const damage = Math.max(1, (baseDamage - defense * 0.5) * moraleMod);
    return damage;
  }
  
  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.reduceMorale(amount * 0.2);
    
    return this.hp <= 0;
  }
  
  reduceMorale(amount) {
    this.morale = Math.max(0, this.morale - amount);
  }
  
  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }
  
  findNearestEnemy(enemies) {
    let nearest = null;
    let minDist = Infinity;
    
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      
      const dist = distance(this.x, this.y, enemy.x, enemy.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = enemy;
      }
    }
    
    return nearest;
  }
  
  flee() {
    // Move to the back
    if (this.side === 'player') {
      this.ty = Math.min(CONST.BATTLE.BATTLEFIELD_HEIGHT, this.y + 50);
    } else {
      this.ty = Math.max(0, this.y - 50);
    }
  }
  
  serialize() {
    return {
      id: this.id,
      type: this.type,
      faction: this.faction,
      side: this.side,
      x: this.x,
      y: this.y,
      hp: this.hp,
      maxHp: this.maxHp,
      morale: this.morale,
      stance: this.stance,
    };
  }
}

export default Unit;