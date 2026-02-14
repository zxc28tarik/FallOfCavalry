/**
 * FallOfCavalry - Diplomacy System
 * İleride genişletilecek
 */

import * as CONST from '../constants.js';

export class DiplomacySystem {
  constructor(state) {
    this.state = state;
    this.relations = new Map(); // faction -> faction -> value
    this.treaties = [];
    
    this.initRelations();
  }
  
  initRelations() {
    const factions = Object.values(CONST.FACTION.ID).filter(f => f !== 'bandit');
    
    // Initialize neutral relations
    for (const f1 of factions) {
      for (const f2 of factions) {
        if (f1 !== f2) {
          this.setRelation(f1, f2, CONST.DIPLOMACY.RELATION.NEUTRAL);
        }
      }
    }
  }
  
  getRelation(faction1, faction2) {
    const key = `${faction1}_${faction2}`;
    return this.relations.get(key) || CONST.DIPLOMACY.RELATION.NEUTRAL;
  }
  
  setRelation(faction1, faction2, value) {
    const key1 = `${faction1}_${faction2}`;
    const key2 = `${faction2}_${faction1}`;
    
    const clamped = Math.max(
      CONST.DIPLOMACY.RELATION.MIN,
      Math.min(CONST.DIPLOMACY.RELATION.MAX, value)
    );
    
    this.relations.set(key1, clamped);
    this.relations.set(key2, clamped);
  }
  
  modifyRelation(faction1, faction2, delta, reason) {
    const current = this.getRelation(faction1, faction2);
    const newValue = current + delta;
    
    this.setRelation(faction1, faction2, newValue);
    
    console.log(`[Diplomacy] ${faction1} -> ${faction2}: ${current} -> ${newValue} (${reason})`);
    
    // Check for automatic state changes
    if (newValue < CONST.DIPLOMACY.RELATION.WAR && current >= CONST.DIPLOMACY.RELATION.WAR) {
      this.declareWar(faction1, faction2);
    } else if (newValue > CONST.DIPLOMACY.RELATION.ALLIED && current <= CONST.DIPLOMACY.RELATION.ALLIED) {
      this.proposeAlliance(faction1, faction2);
    }
  }
  
  declareWar(faction1, faction2) {
    console.log(`[Diplomacy] WAR: ${faction1} vs ${faction2}`);
    
    this.treaties = this.treaties.filter(t =>
      !(t.factions.includes(faction1) && t.factions.includes(faction2))
    );
    
    this.treaties.push({
      type: CONST.DIPLOMACY.TREATY_TYPE.WAR,
      factions: [faction1, faction2],
      startDay: this.state.day,
    });
    
    this.state.emit('diplomacy:war', { faction1, faction2 });
  }
  
  proposeAlliance(faction1, faction2) {
    console.log(`[Diplomacy] ALLIANCE proposed: ${faction1} <-> ${faction2}`);
    
    // Auto-accept if relations high enough
    if (this.getRelation(faction1, faction2) >= CONST.DIPLOMACY.RELATION.ALLIED) {
      this.formAlliance(faction1, faction2);
    }
  }
  
  formAlliance(faction1, faction2) {
    console.log(`[Diplomacy] ALLIANCE formed: ${faction1} <-> ${faction2}`);
    
    this.treaties.push({
      type: CONST.DIPLOMACY.TREATY_TYPE.ALLIANCE,
      factions: [faction1, faction2],
      startDay: this.state.day,
    });
    
    this.state.emit('diplomacy:alliance', { faction1, faction2 });
  }
  
  isAtWar(faction1, faction2) {
    return this.treaties.some(t =>
      t.type === CONST.DIPLOMACY.TREATY_TYPE.WAR &&
      t.factions.includes(faction1) &&
      t.factions.includes(faction2)
    );
  }
  
  areAllied(faction1, faction2) {
    return this.treaties.some(t =>
      t.type === CONST.DIPLOMACY.TREATY_TYPE.ALLIANCE &&
      t.factions.includes(faction1) &&
      t.factions.includes(faction2)
    );
  }
}

export default DiplomacySystem;