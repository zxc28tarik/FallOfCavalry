/**
 * FallOfCavalry - City Mode
 * Şehir içi yönetim modu
 */

export class CityMode {
  constructor(state) {
    this.state = state;
  }
  
  init() {
    console.log('[CityMode] Entering city:', this.state.currentCity?.name);
  }
  
  update(dt) {
    this.handleInput();
  }
  
  handleInput() {
    const input = this.state.input;
    
    // ESC to exit city
    if (input.isKeyPressed('escape')) {
      this.exitCity();
    }
  }
  
  exitCity() {
    console.log('[CityMode] Exiting city');
    this.state.currentCity = null;
    this.state.setMode('map');
  }
  
  recruitUnit(unitType) {
    const city = this.state.currentCity;
    if (!city) return;
    
    const unit = city.recruitUnit(unitType);
    if (unit) {
      this.state.modifyArmy(1);
      console.log('[CityMode] Recruited:', unitType);
    }
  }
  
  buildBuilding(buildingType) {
    const city = this.state.currentCity;
    if (!city) return;
    
    if (city.buildBuilding(buildingType)) {
      console.log('[CityMode] Built:', buildingType);
    }
  }
  
  cleanup() {
    console.log('[CityMode] Cleanup');
  }
}

export default CityMode;