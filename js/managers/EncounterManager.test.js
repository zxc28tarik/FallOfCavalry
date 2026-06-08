/**
 * EncounterManager.test.js
 *
 * _buildPhaserArmyData() zinciri için saf birim testleri.
 * Phaser / BattleBoot / GameState bağımlılığı yok.
 *
 * Test edilen davranışlar:
 *   1. DEFAULT_ENEMY_SQUAD_SIZE sabiti 20 olarak export edilir.
 *   2. count alanı olmayan düşman birimi DEFAULT_ENEMY_SQUAD_SIZE alır.
 *   3. count alanı olan düşman birimi kendi count'unu korur.
 *   4. count = 0 olan düşman birimi minimum 1 alır (Math.max güvencesi).
 *   5. Oyuncu birimi count yoksa 1 alır (mevcut davranış korunur).
 *   6. Oyuncu birimi kendi count'unu korur.
 *   7. Ranged düşman birimi doğru visualProfileId alır.
 *   8. Cavalry oyuncu birimi mounted_knight_placeholder alır.
 *   9. enemyRoster boşsa defenderArmy.units boş döner.
 *  10. playerRoster'da selected=false birimi attackerArmy'e dahil edilmez.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EncounterManager } from './EncounterManager.js';

// ── Minimal stub'lar ───────────────────────────────────────────────────────────

/** EncounterManager'ın _buildPhaserArmyData dışı bağımlılıklarını karşılayan
 *  minimal GameState stub'ı. */
function makeMinimalState() {
  return {
    mode: 'encounter',
    battle: { phase: 'deploy', enemyUnitsById: {} },
    playerParty: { roster: [], morale: 60, gold: 100 },
    enemies: [],
    currentEnemy: null,
  };
}

/** EncounterManager instance'ı kurar ve playerRoster / enemyRoster'ı doğrudan
 *  atar (enterRoster çağrısını bypass ederiz — burada sadece
 *  _buildPhaserArmyData mantığını test ediyoruz). */
function makeManager({ playerRoster = [], enemyRoster = [] } = {}) {
  const state = makeMinimalState();
  const em = new EncounterManager(state);
  // game objesi gerekmeyen metodları test ediyoruz; game stub ekleme
  em.playerRoster = playerRoster;
  em.enemyRoster  = enemyRoster;
  return em;
}

// ── Sabit ─────────────────────────────────────────────────────────────────────

describe('DEFAULT_ENEMY_SQUAD_SIZE', () => {
  it('20 olarak tanımlanmış olmalı', () => {
    expect(EncounterManager.DEFAULT_ENEMY_SQUAD_SIZE).toBe(20);
  });
});

// ── Düşman count normalizasyonu ───────────────────────────────────────────────

describe('_buildPhaserArmyData — düşman count normalizasyonu', () => {
  it('count alanı olmayan düşman birimi DEFAULT_ENEMY_SQUAD_SIZE alır', () => {
    const em = makeManager({
      enemyRoster: [{ id: 'raider-1', class: 'infantry', isRanged: false }],
    });
    const { defenderArmy } = em._buildPhaserArmyData('test-enemy');
    expect(defenderArmy.units[0].count).toBe(EncounterManager.DEFAULT_ENEMY_SQUAD_SIZE);
  });

  it('count=undefined düşman birimi DEFAULT_ENEMY_SQUAD_SIZE alır', () => {
    const em = makeManager({
      enemyRoster: [{ id: 'r1', class: 'infantry', isRanged: false, count: undefined }],
    });
    const { defenderArmy } = em._buildPhaserArmyData('test-enemy');
    expect(defenderArmy.units[0].count).toBe(EncounterManager.DEFAULT_ENEMY_SQUAD_SIZE);
  });

  it('count=null düşman birimi DEFAULT_ENEMY_SQUAD_SIZE alır', () => {
    const em = makeManager({
      enemyRoster: [{ id: 'r1', class: 'infantry', isRanged: false, count: null }],
    });
    const { defenderArmy } = em._buildPhaserArmyData('test-enemy');
    expect(defenderArmy.units[0].count).toBe(EncounterManager.DEFAULT_ENEMY_SQUAD_SIZE);
  });

  it('count=30 olan düşman birimi kendi count değerini korur', () => {
    const em = makeManager({
      enemyRoster: [{ id: 'r1', class: 'infantry', isRanged: false, count: 30 }],
    });
    const { defenderArmy } = em._buildPhaserArmyData('test-enemy');
    expect(defenderArmy.units[0].count).toBe(30);
  });

  it('count=0 olan düşman birimi en az 1 alır (Math.max güvencesi)', () => {
    const em = makeManager({
      enemyRoster: [{ id: 'r1', class: 'infantry', isRanged: false, count: 0 }],
    });
    const { defenderArmy } = em._buildPhaserArmyData('test-enemy');
    expect(defenderArmy.units[0].count).toBeGreaterThanOrEqual(1);
  });

  it('count=-5 olan düşman birimi en az 1 alır', () => {
    const em = makeManager({
      enemyRoster: [{ id: 'r1', class: 'infantry', isRanged: false, count: -5 }],
    });
    const { defenderArmy } = em._buildPhaserArmyData('test-enemy');
    expect(defenderArmy.units[0].count).toBeGreaterThanOrEqual(1);
  });

  it('birden fazla birim — her biri bağımsız normalize edilir', () => {
    const em = makeManager({
      enemyRoster: [
        { id: 'r1', class: 'infantry', isRanged: false },           // count yok → default
        { id: 'r2', class: 'archer',   isRanged: true,  count: 15 }, // explicit count
        { id: 'r3', class: 'infantry', isRanged: false, count: 0 },  // 0 → min 1
      ],
    });
    const { defenderArmy } = em._buildPhaserArmyData('test-enemy');
    const counts = defenderArmy.units.map(u => u.count);
    expect(counts[0]).toBe(EncounterManager.DEFAULT_ENEMY_SQUAD_SIZE);
    expect(counts[1]).toBe(15);
    expect(counts[2]).toBeGreaterThanOrEqual(1);
  });
});

// ── Oyuncu count davranışı (mevcut davranış korunuyor mu?) ────────────────────

describe('_buildPhaserArmyData — oyuncu count davranışı', () => {
  it('count alanı olmayan oyuncu birimi 1 alır', () => {
    const em = makeManager({
      playerRoster: [{ id: 'inf-1', class: 'infantry', selected: true }],
    });
    const { attackerArmy } = em._buildPhaserArmyData('test-enemy');
    expect(attackerArmy.units[0].count).toBe(1);
  });

  it('count=25 olan oyuncu birimi kendi count değerini korur', () => {
    const em = makeManager({
      playerRoster: [{ id: 'inf-1', class: 'infantry', count: 25, selected: true }],
    });
    const { attackerArmy } = em._buildPhaserArmyData('test-enemy');
    expect(attackerArmy.units[0].count).toBe(25);
  });
});

// ── Görsel profil ve tip çıkarımı ─────────────────────────────────────────────

describe('_buildPhaserArmyData — görsel profil çıkarımı', () => {
  it('ranged=true düşman → tiny_archer profili', () => {
    const em = makeManager({
      enemyRoster: [{ id: 'archer-1', class: 'archer', isRanged: true }],
    });
    const { defenderArmy } = em._buildPhaserArmyData('test-enemy');
    expect(defenderArmy.units[0].visualProfileId).toBe('tiny_archer');
    expect(defenderArmy.units[0].combatRole).toBe('ranged');
  });

  it('ranged=false düşman → tiny_warrior profili', () => {
    const em = makeManager({
      enemyRoster: [{ id: 'inf-1', class: 'infantry', isRanged: false }],
    });
    const { defenderArmy } = em._buildPhaserArmyData('test-enemy');
    expect(defenderArmy.units[0].visualProfileId).toBe('tiny_warrior');
    expect(defenderArmy.units[0].combatRole).toBe('melee');
  });

  it('cavalry oyuncu birimi → mounted_knight_placeholder profili', () => {
    const em = makeManager({
      playerRoster: [{ id: 'cav-1', class: 'cavalry', count: 10, selected: true }],
    });
    const { attackerArmy } = em._buildPhaserArmyData('test-enemy');
    expect(attackerArmy.units[0].visualProfileId).toBe('mounted_knight_placeholder');
    expect(attackerArmy.units[0].bodyType).toBe('mounted');
  });
});

// ── Kenar durumlar ────────────────────────────────────────────────────────────

describe('_buildPhaserArmyData — kenar durumlar', () => {
  it('enemyRoster boşsa defenderArmy.units boş döner', () => {
    const em = makeManager({ enemyRoster: [] });
    const { defenderArmy } = em._buildPhaserArmyData('test-enemy');
    expect(defenderArmy.units).toHaveLength(0);
  });

  it('playerRoster null/undefined ise attackerArmy.units boş döner', () => {
    const em = makeManager();
    em.playerRoster = null;
    const { attackerArmy } = em._buildPhaserArmyData('test-enemy');
    expect(attackerArmy.units).toHaveLength(0);
  });

  it("selected=false birim attackerArmy'e dahil edilmez", () => {
    const em = makeManager({
      playerRoster: [
        { id: 'inf-1', class: 'infantry', count: 20, selected: true  },
        { id: 'inf-2', class: 'infantry', count: 20, selected: false },
      ],
    });
    const { attackerArmy } = em._buildPhaserArmyData('test-enemy');
    expect(attackerArmy.units).toHaveLength(1);
    expect(attackerArmy.units[0].unitClass).toBe('inf-1');
  });

  it('_phaserSelectedRoster selected birimleri yakalar', () => {
    const em = makeManager({
      playerRoster: [
        { id: 'inf-1', class: 'infantry', count: 10, selected: true  },
        { id: 'inf-2', class: 'infantry', count: 10, selected: false },
      ],
    });
    em._buildPhaserArmyData('test-enemy');
    expect(em._phaserSelectedRoster).toHaveLength(1);
    expect(em._phaserSelectedRoster[0].id).toBe('inf-1');
  });
});
