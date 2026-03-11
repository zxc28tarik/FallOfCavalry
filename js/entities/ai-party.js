/**
 * FallOfCavalry - AI Party
 */

import { distance, randInt, randFloat } from '../utils.js';

export class AIParty {
  constructor(data) {
    this.id = data.id;
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.tx = this.x;
    this.ty = this.y;
    this.faction = data.faction;
    this.strength = data.strength || 50;
    this.behavior = data.behavior || 'patrol'; // patrol, chase, flee, idle
    this.speed = data.speed || 30;
    this.patrolRadius = data.patrolRadius || 15;
    this.homeX = this.x;
    this.homeY = this.y;
    this.patrolTimer = 0;
  }
  
  update(dt, state) {
    // Move towards target
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist > 0.5) {
      const moveAmount = Math.min(this.speed * dt, dist);
      this.x += (dx / dist) * moveAmount;
      this.y += (dy / dist) * moveAmount;
    } else {
      this.x = this.tx;
      this.y = this.ty;
    }
    
    // Update behavior
    this.patrolTimer += dt;
    
    if (this.patrolTimer > 5) {
      this.patrolTimer = 0;
      this.updateBehavior(state);
    }
  }
  
  updateBehavior(state) {
    const player = state.player;
    const distToPlayer = distance(this.x, this.y, player.x, player.y);
    
    switch (this.behavior) {
      case 'patrol':
        // Random patrol around home
        this.tx = this.homeX + randFloat(-this.patrolRadius, this.patrolRadius);
        this.ty = this.homeY + randFloat(-this.patrolRadius, this.patrolRadius);
        
        // Clamp to map
        this.tx = Math.max(5, Math.min(state.map.width - 5, this.tx));
        this.ty = Math.max(5, Math.min(state.map.height - 5, this.ty));
        break;
        
      case 'chase':
        // Chase player if close
        if (distToPlayer < 20) {
          this.tx = player.x;
          this.ty = player.y;
        } else {
          this.behavior = 'patrol';
        }
        break;
        
      case 'flee': {
        // Flee from player
        const fleeAngle = Math.atan2(this.y - player.y, this.x - player.x);
        this.tx = this.x + Math.cos(fleeAngle) * 10;
        this.ty = this.y + Math.sin(fleeAngle) * 10;
        break;
      }
        
      case 'idle':
        // Do nothing
        break;
    }
  }
  
  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      faction: this.faction,
      strength: this.strength,
      behavior: this.behavior,
      speed: this.speed,
    };
  }
}

export class AIPartyManager {
  constructor(state) {
    this.state = state;
  }
  
  update(dt) {
    for (const party of this.state.aiParties) {
      party.update(dt, this.state);
    }
  }
  
  spawnRandomParty() {
    const mapData = this.state.map;
    
    const party = new AIParty({
      id: this.state.aiParties.length,
      x: randInt(10, mapData.width - 10),
      y: randInt(10, mapData.height - 10),
      faction: 'bandit',
      strength: randInt(20, 80),
      behavior: 'patrol',
    });
    
    this.state.aiParties.push(party);
    return party;
  }
  
  removeParty(partyId) {
    const index = this.state.aiParties.findIndex(p => p.id === partyId);
    if (index > -1) {
      this.state.aiParties.splice(index, 1);
    }
  }
}

export default AIParty;