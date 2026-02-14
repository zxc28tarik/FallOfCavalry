/**
 * FallOfCavalry - Economy System
 */

export class EconomySystem {
  constructor(state) {
    this.state = state;
  }
  
  calculateDailyIncome() {
    let totalIncome = 0;
    
    for (const settlement of this.state.map.settlements) {
      if (settlement.owner === this.state.selectedFaction?.id) {
        const income = settlement.calculateIncome();
        totalIncome += income;
      }
    }
    
    return totalIncome;
  }
  
  processDailyIncome() {
    const income = this.calculateDailyIncome();
    
    if (income > 0) {
      this.state.modifyGold(income);
      console.log('[Economy] Daily income:', income);
    }
  }
  
  trade(goldAmount, resourceType, resourceAmount) {
    // Simple trading logic
    const cost = this.calculateResourceCost(resourceType, resourceAmount);
    
    if (this.state.player.gold >= cost) {
      this.state.modifyGold(-cost);
      // Add resources to inventory
      return true;
    }
    
    return false;
  }
  
  calculateResourceCost(resourceType, amount) {
    const basePrices = {
      food: 2,
      wood: 5,
      stone: 8,
      iron: 15,
    };
    
    const basePrice = basePrices[resourceType] || 10;
    return basePrice * amount;
  }
  
  taxSettlement(settlement, amount) {
    if (settlement.owner !== this.state.selectedFaction?.id) {
      return false;
    }
    
    // Tax reduces loyalty
    settlement.updateLoyalty(-5);
    this.state.modifyGold(amount);
    
    return true;
  }
}

export default EconomySystem;