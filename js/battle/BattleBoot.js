import Phaser from 'phaser';
import { BattleScene, setPendingArmyData } from './BattleScene.js';
import { LayerStressTest } from './debug/LayerStressTest.js';

const BATTLE_WIDTH  = 1280;
const BATTLE_HEIGHT = 720;

let phaserInstance = null;

/**
 * Phaser battle modunu başlatır.
 *
 * @param {{ attackerArmy: object, defenderArmy: object }|null} armyData
 *   null → test modu (testBattleData.js kullanılır)
 *   object → ana oyun modu (BattleAdapter.createBattleData dönüştürür)
 * @param {string} parentId  DOM container id'si
 * @returns {Phaser.Game}
 *
 * Kullanım örneği (ana oyundan):
 *   import { launchBattle } from './battle/BattleBoot.js';
 *   launchBattle({ attackerArmy, defenderArmy });
 *
 *   window.addEventListener('battleComplete', (e) => {
 *     const result = e.detail;
 *     // applyBattleResult(attackerArmy, defenderArmy, result);
 *   });
 */
export function launchBattle(armyData = null, parentId = 'phaser-battle-container') {
  // Dev evals cache-bust ile yeni modül yükleyebilir; window ref'i kontrol et
  if (!phaserInstance && window.__focBattle) {
    phaserInstance = window.__focBattle;
  }
  if (phaserInstance) {
    console.warn('[BattleBoot] Phaser instance already running');
    return phaserInstance;
  }

  // Ordu verisi varsa BattleScene.create() öncesinde ayarla
  setPendingArmyData(armyData);

  let parent = document.getElementById(parentId);
  if (!parent) {
    parent = document.createElement('div');
    parent.id = parentId;
    parent.style.cssText =
      'position:fixed;inset:0;z-index:9999;background:#000;display:flex;align-items:center;justify-content:center;';
    document.body.appendChild(parent);
  }

  phaserInstance = window.__focBattle = new Phaser.Game({
    type: Phaser.AUTO,
    width: BATTLE_WIDTH,
    height: BATTLE_HEIGHT,
    parent: parentId,
    // LayerStressTest debug sahnesi BattleScene'den F11 ile başlatılır;
    // game instance'a kayıtlı olması yeterli — otomatik start etmez.
    scene: [BattleScene, LayerStressTest],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: { pixelArt: true },
  });

  return phaserInstance;
}

/** Dev/test accessor — pool doğrulama için kullanılır. */
export function _getPhaserInstance() { return phaserInstance; }

export function destroyBattle() {
  if (!phaserInstance) return;
  phaserInstance.destroy(true);
  phaserInstance = null;
  window.__focBattle = null;
  setPendingArmyData(null);

  const container = document.getElementById('phaser-battle-container');
  if (container) container.remove();
}
