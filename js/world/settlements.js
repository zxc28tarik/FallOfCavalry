/**
 * FallOfCavalry - Settlement Management
 */

import * as CONST from '../constants.js';

export class Settlement {
  constructor(data) {
    this.id = data.id;
    this.x = data.x;
    this.y = data.y;
    this.name = data.name;
    this.type = data.type; // city, town, village
    this.owner = data.owner; // faction id
    this.population = data.population || 100;
    this.garrison = data.garrison || 0;
    this.buildings = data.buildings || [];
    this.taxRate = data.taxRate || CONST.SETTLEMENT.BASE_TAX_RATE;
    this.loyalty = data.loyalty || 100;
    this.resources = {
      gold: 0,
      food: 100,
      wood: 50,
      stone: 30,
    };
  }
  
  calculateIncome() {
    let base = 0;
    
    switch (this.type) {
      case CONST.SETTLEMENT.TYPE.CITY:
        base = CONST.SETTLEMENT.CITY_INCOME;
        break;
      case CONST.SETTLEMENT.TYPE.TOWN:
        base = CONST.SETTLEMENT.TOWN_INCOME;
        break;
      case CONST.SETTLEMENT.TYPE.VILLAGE:
        base = CONST.SETTLEMENT.VILLAGE_INCOME;
        break;
    }
    
    // Modifiers
    const popBonus = Math.floor(this.population / 1000) * 10;
    const loyaltyMod = this.loyalty / 100;
    const buildingBonus = this.buildings.filter(b => b.type === 'market').length * 50;
    
    return Math.floor((base + popBonus + buildingBonus) * loyaltyMod * this.taxRate);
  }
  
  canRecruit(unitType) {
    const cost = CONST.UNIT.COST[unitType] || 100;
    return this.resources.gold >= cost;
  }
  
  recruitUnit(unitType) {
    const cost = CONST.UNIT.COST[unitType] || 100;
    
    if (!this.canRecruit(unitType)) {
      return null;
    }
    
    this.resources.gold -= cost;
    this.garrison += 1;
    
    return {
      type: unitType,
      faction: this.owner,
      hp: 100,
      morale: 100,
    };
  }
  
  canBuild(buildingType) {
    // Check if already exists
    if (this.buildings.some(b => b.type === buildingType)) {
      return false;
    }
    
    // Check resources
    const costs = {
      market: { gold: 500, wood: 100, stone: 50 },
      barracks: { gold: 300, wood: 150, stone: 100 },
      wall: { gold: 1000, wood: 200, stone: 500 },
      temple: { gold: 800, wood: 100, stone: 200 },
    };
    
    const cost = costs[buildingType];
    if (!cost) return false;
    
    return this.resources.gold >= cost.gold &&
           this.resources.wood >= cost.wood &&
           this.resources.stone >= cost.stone;
  }
  
  buildBuilding(buildingType) {
    if (!this.canBuild(buildingType)) {
      return false;
    }
    
    const costs = {
      market: { gold: 500, wood: 100, stone: 50 },
      barracks: { gold: 300, wood: 150, stone: 100 },
      wall: { gold: 1000, wood: 200, stone: 500 },
      temple: { gold: 800, wood: 100, stone: 200 },
    };
    
    const cost = costs[buildingType];
    this.resources.gold -= cost.gold;
    this.resources.wood -= cost.wood;
    this.resources.stone -= cost.stone;
    
    this.buildings.push({
      type: buildingType,
      level: 1,
      constructedDay: 0, // Will be set by game
    });
    
    return true;
  }
  
  updateLoyalty(change) {
    this.loyalty = Math.max(0, Math.min(100, this.loyalty + change));
  }
  
  changeOwner(newOwner) {
    this.owner = newOwner;
    this.loyalty = 50; // Reduced loyalty after capture
  }
  
  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      name: this.name,
      type: this.type,
      owner: this.owner,
      population: this.population,
      garrison: this.garrison,
      buildings: this.buildings,
      taxRate: this.taxRate,
      loyalty: this.loyalty,
      resources: this.resources,
    };
  }
}

export default Settlement;