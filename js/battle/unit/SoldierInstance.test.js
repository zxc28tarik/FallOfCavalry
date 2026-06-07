import { describe, it, expect } from 'vitest';
import { SoldierInstance, defaultWeaponLoadout, defaultArmorLoadout } from './SoldierInstance.js';

describe('SoldierInstance', () => {
  it('constructor — zorunlu alanları doğru set eder', () => {
    const s = new SoldierInstance({ id: 's1', unitClass: 'azap' });
    expect(s.id).toBe('s1');
    expect(s.unitClass).toBe('azap');
  });

  it('constructor — default değerler uygulanır', () => {
    const s = new SoldierInstance({ id: 's2', unitClass: 'janissary' });
    expect(s.bodyType).toBe('infantry');
    expect(s.mountType).toBeNull();
    expect(s.activeWeapon).toBeNull();
    expect(s.combatRole).toBe('melee');
    expect(s.combatProfileId).toBeNull();
    expect(s.visualProfileId).toBe('tiny_warrior');
    expect(s.hp).toBe(100);
  });

  it('alive flag — başlangıçta true, state başlangıçta idle', () => {
    const s = new SoldierInstance({ id: 's3', unitClass: 'sipahi' });
    expect(s.alive).toBe(true);
    expect(s.state).toBe('idle');
  });

  it('state — dışarıdan değiştirilebilir (mutable savaş durumu)', () => {
    const s = new SoldierInstance({ id: 's4', unitClass: 'azap' });
    s.state = 'attacking';
    s.alive = false;
    expect(s.state).toBe('attacking');
    expect(s.alive).toBe(false);
  });

  it('weaponLoadout — default shape doğru alanları içerir', () => {
    const s = new SoldierInstance({ id: 's5', unitClass: 'azap' });
    const wl = s.weaponLoadout;
    expect(wl).toHaveProperty('primary', null);
    expect(wl).toHaveProperty('secondary', null);
    expect(wl).toHaveProperty('sidearm', null);
    expect(wl).toHaveProperty('shield', null);
    expect(wl).toHaveProperty('throwing', null);
    expect(wl).toHaveProperty('special', null);
    expect(wl.ammo).toMatchObject({ arrow: 0, bullet: 0, javelin: 0, humbara: 0 });
  });

  it('armorLoadout — default shape doğru alanları içerir', () => {
    const s = new SoldierInstance({ id: 's6', unitClass: 'azap' });
    const al = s.armorLoadout;
    expect(al).toHaveProperty('bodyArmor', null);
    expect(al).toHaveProperty('helmet', null);
    expect(al).toHaveProperty('horseArmor', null);
    expect(al.quality).toMatchObject({ weapon: 'orta', armor: 'orta' });
  });

  it('visualProfileId — config üzerinden override edilebilir', () => {
    const s = new SoldierInstance({ id: 's7', unitClass: 'azap', visualProfileId: 'tiny_lancer' });
    expect(s.visualProfileId).toBe('tiny_lancer');
  });

  it('weaponLoadout — config üzerinden custom değer alır', () => {
    const s = new SoldierInstance({
      id: 's8',
      unitClass: 'azap',
      weaponLoadout: { ...defaultWeaponLoadout(), primary: 'spear', sidearm: 'yatagan' },
    });
    expect(s.weaponLoadout.primary).toBe('spear');
    expect(s.weaponLoadout.sidearm).toBe('yatagan');
    expect(s.weaponLoadout.secondary).toBeNull(); // diğer alanlar hâlâ default
  });

  it('defaultWeaponLoadout — her çağrıda yeni obje döner (referans paylaşımı yok)', () => {
    const a = defaultWeaponLoadout();
    const b = defaultWeaponLoadout();
    a.primary = 'sword';
    expect(b.primary).toBeNull();
  });

  it('defaultArmorLoadout — her çağrıda yeni obje döner', () => {
    const a = defaultArmorLoadout();
    const b = defaultArmorLoadout();
    a.bodyArmor = 'zirh';
    expect(b.bodyArmor).toBeNull();
  });
});
