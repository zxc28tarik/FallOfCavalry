// FallOfCavalry - UI constants

export const UI = Object.freeze({
  // Zamanlama
  TOOLTIP_DELAY: 500,
  NOTIFICATION_DURATION: 3000,
  MODAL_ANIMATION_MS: 300,

  // Z-index katmanları
  Z_INDEX: {
    BASE: 1,
    HUD: 30,
    BATTLE_HUD: 30,
    CORNER_PANEL: 35,
    TOOLTIP: 40,
    DEBUG: 45,
    MODAL: 50,
  },

  // Minimap
  MINIMAP_SIZE: 220,
  MINIMAP_ZOOM: 0.1,
});

export const TUTORIAL_HINTS = Object.freeze({
  ENABLED_DEFAULT: true,
  MAX_DAYS: 3,
  MAX_REALTIME_SEC: 600,
  COOLDOWN_MS: 6500,
  PRIORITY: Object.freeze({
    encounter: 100,
    battleDeploy: 90,
    battleCmd: 90,
    city: 80,
    poi: 70,
    camp: 60,
    movement: 50,
  }),
});

export const HINT_TEXT = Object.freeze({
  encounter: 'İpucu: Karşılaşmada Fight ile savaşa gir veya Retreat ile geri çekil.',
  movement: 'İpucu: Haritada yön tuşları veya ekran kenarı ile kamerayı kaydır, tekerlekle zoom yap.',
  city: 'İpucu: Şehir yakınında C ile şehre gir (Recruit/Trade).',
  poi: 'İpucu: POI yakınında E ile incele (ganimet/pusu/ipucu).',
  camp: 'İpucu: K ile kamp kur, nöbet seç; erzak tüketimi düşer.',
  battleDeploy: 'İpucu: Deploy: 1-4 formasyon, Q/E dön, tıkla yerleştir, Enter başlat.',
  battleCmd: 'İpucu: Komutlar: H Hold, F Focus, K Skirmish, R Retreat.',
});

export const DEFAULT_KEYBINDS = Object.freeze({
  // Hareket
  moveUp: 'w',
  moveDown: 's',
  moveLeft: 'a',
  moveRight: 'd',

  // Kamera
  cameraUp: 'ArrowUp',
  cameraDown: 'ArrowDown',
  cameraLeft: 'ArrowLeft',
  cameraRight: 'ArrowRight',

  // Oyun kontrolü
  togglePause: ' ',
  quickSave: 'F5',
  quickLoad: 'F9',
  toggleDebug: 'F3',

  // Etkileşim
  interact: 'Enter',
  cancel: 'Escape',

  // Savaş
  battlePause: 'p',
  battleSpeed1: '1',
  battleSpeed2: '2',
  battleSpeed3: '3',
});

export const DEBUG = Object.freeze({
  ENABLED: false,
  LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
  SHOW_FPS: true,
  SHOW_HITBOXES: false,
  SHOW_PATHFINDING: false,
  GOD_MODE: false,
  // Phaser battle yerine eski Canvas BattleManager devrede kalır.
  // true yapmak için bu satırı değiştir veya devConsole'dan:
  //   import('/js/constants/ui.js').then(m => console.log(m.DEBUG.USE_PHASER_BATTLE))
  USE_PHASER_BATTLE: false,
});
