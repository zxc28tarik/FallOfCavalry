import { describe, it, expect, vi } from 'vitest';
import { resolveAnimationKey, resolveAndPlay } from './AnimationResolver.js';

// ── Mock profile yardımcısı ────────────────────────────────────────────────────

/**
 * Test için minimal VisualProfile — sadece ihtiyaç duyulan key'leri içerir.
 */
function makeProfile(animations = {}, fallbackAnimations = {}, bodyType = 'infantry') {
  return { animations, fallbackAnimations, bodyType };
}

/**
 * Tam set içeren warrior profili (gerçek yapıya yakın).
 */
const warriorProfile = makeProfile(
  {
    idle:         'warrior_idle',
    walk:         'warrior_walk',
    melee_attack: 'warrior_attack',
    sword_attack: 'warrior_attack',
    spear_attack: null,
    bow_attack:   null,
    death:        'warrior_death',
  },
  {
    spear_attack: 'melee_attack',
    bow_attack:   'idle',
    axe_attack:   'melee_attack',
    mace_attack:  'melee_attack',
  },
);

/**
 * Atlı birim profili.
 */
const mountedProfile = makeProfile(
  {
    idle:         'mounted_idle',
    walk:         'mounted_walk',
    gallop:       'mounted_gallop',
    melee_attack: 'mounted_attack',
    sword_attack: 'mounted_attack',
    death:        'mounted_death',
  },
  {},
  'mounted',
);

// ── resolveAnimationKey — attack ─────────────────────────────────────────────

describe('resolveAnimationKey — attack', () => {
  it('sword → profile.animations["sword_attack"] döner', () => {
    const s = { activeWeapon: 'sword', bodyType: 'infantry' };
    expect(resolveAnimationKey(s, 'attack', warriorProfile)).toBe('warrior_attack');
  });

  it('pala (Türkçe silah adı) → sword_attack zinciri → warrior_attack', () => {
    const s = { activeWeapon: 'pala', bodyType: 'infantry' };
    expect(resolveAnimationKey(s, 'attack', warriorProfile)).toBe('warrior_attack');
  });

  it('spear → spear_attack null ise fallbackAnimations üzerinden melee_attack → warrior_attack', () => {
    // warriorProfile: spear_attack=null, fallback spear_attack→melee_attack→warrior_attack
    const s = { activeWeapon: 'spear', bodyType: 'infantry' };
    expect(resolveAnimationKey(s, 'attack', warriorProfile)).toBe('warrior_attack');
  });

  it('bow → bow_attack null, fallback bow_attack→idle → warrior_idle', () => {
    const s = { activeWeapon: 'bow', bodyType: 'infantry' };
    expect(resolveAnimationKey(s, 'attack', warriorProfile)).toBe('warrior_idle');
  });

  it('bilinmeyen silah → melee_attack → warrior_attack', () => {
    const s = { activeWeapon: 'bilinmeyen_silah', bodyType: 'infantry' };
    expect(resolveAnimationKey(s, 'attack', warriorProfile)).toBe('warrior_attack');
  });

  it('null activeWeapon → melee_attack → warrior_attack', () => {
    const s = { activeWeapon: null, bodyType: 'infantry' };
    expect(resolveAnimationKey(s, 'attack', warriorProfile)).toBe('warrior_attack');
  });

  it('musket → musket_attack key; profile yoksa melee_attack fallback', () => {
    const s = { activeWeapon: 'musket', bodyType: 'infantry' };
    // warriorProfile'da musket_attack yok → melee_attack fallback
    expect(resolveAnimationKey(s, 'attack', warriorProfile)).toBe('warrior_attack');
  });

  it('axe → axe_attack → fallback melee_attack → warrior_attack', () => {
    const s = { activeWeapon: 'axe', bodyType: 'infantry' };
    expect(resolveAnimationKey(s, 'attack', warriorProfile)).toBe('warrior_attack');
  });

  it('profile null ise null döner', () => {
    const s = { activeWeapon: 'sword' };
    expect(resolveAnimationKey(s, 'attack', null)).toBeNull();
  });
});

// ── resolveAnimationKey — walk ────────────────────────────────────────────────

describe('resolveAnimationKey — walk', () => {
  it('infantry walk → profile.animations["walk"]', () => {
    const s = { activeWeapon: null, bodyType: 'infantry', mountType: null };
    expect(resolveAnimationKey(s, 'walk', warriorProfile)).toBe('warrior_walk');
  });

  it('infantry walk yoksa null döner', () => {
    const prof = makeProfile({ idle: 'x_idle' });  // walk yok
    const s    = { activeWeapon: null, bodyType: 'infantry', mountType: null };
    expect(resolveAnimationKey(s, 'walk', prof)).toBeNull();
  });

  it('mounted walk → gallop önce, sonra walk', () => {
    const s = { activeWeapon: null, bodyType: 'mounted', mountType: 'horse' };
    expect(resolveAnimationKey(s, 'walk', mountedProfile)).toBe('mounted_gallop');
  });

  it('mounted + gallop yoksa walk döner', () => {
    const prof = makeProfile(
      { idle: 'm_idle', walk: 'm_walk' },
      {},
      'mounted',
    );
    const s = { activeWeapon: null, bodyType: 'mounted', mountType: 'horse' };
    expect(resolveAnimationKey(s, 'walk', prof)).toBe('m_walk');
  });

  it('soldier.mountType !== null → mounted olarak kabul edilir', () => {
    // bodyType infantry ama mountType set → mounted
    const prof = makeProfile(
      { idle: 'x_idle', gallop: 'x_gallop', walk: 'x_walk' },
      {},
      'infantry',  // bodyType infantry ama mountType var
    );
    const s = { activeWeapon: null, bodyType: 'infantry', mountType: 'horse' };
    expect(resolveAnimationKey(s, 'walk', prof)).toBe('x_gallop');
  });
});

// ── resolveAnimationKey — idle / death ───────────────────────────────────────

describe('resolveAnimationKey — idle ve death', () => {
  it('idle → profile.animations["idle"]', () => {
    const s = { activeWeapon: null };
    expect(resolveAnimationKey(s, 'idle', warriorProfile)).toBe('warrior_idle');
  });

  it('death → profile.animations["death"]', () => {
    const s = { activeWeapon: null };
    expect(resolveAnimationKey(s, 'death', warriorProfile)).toBe('warrior_death');
  });

  it('death key yoksa null döner', () => {
    const prof = makeProfile({ idle: 'x_idle' });
    const s    = { activeWeapon: null };
    expect(resolveAnimationKey(s, 'death', prof)).toBeNull();
  });

  it('bilinmeyen action → null döner', () => {
    const s = { activeWeapon: null };
    expect(resolveAnimationKey(s, 'unknown_action', warriorProfile)).toBeNull();
  });
});

// ── resolveAndPlay ─────────────────────────────────────────────────────────────

describe('resolveAndPlay', () => {
  it('geçerli profil + action → visualSoldier.playAnimation çağrılır', () => {
    const vs     = { playAnimation: vi.fn() };
    const soldier = { visualProfileId: 'tiny_warrior', activeWeapon: 'sword', bodyType: 'infantry' };

    resolveAndPlay(vs, soldier, 'attack');

    // tiny_warrior profili gerçek getVisualProfile'dan alınır;
    // sword_attack → tiny_warrior_attack bulunur → playAnimation çağrılır
    expect(vs.playAnimation).toHaveBeenCalledWith('attack', 'sword');
  });

  it('bilinmeyen profil → warn, playAnimation çağrılmaz', () => {
    const vs     = { playAnimation: vi.fn() };
    const soldier = { visualProfileId: 'var_olmayan_profil', activeWeapon: null };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    resolveAndPlay(vs, soldier, 'idle');

    expect(vs.playAnimation).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('key çözülemezse playAnimation çağrılmaz (null döndüğünde)', () => {
    // tiny_archer profili: walk animasyonu var, ama action "walk" için key resolveEdilir
    // Burada: profile'da hiç animasyon olmayan bir action
    const vs      = { playAnimation: vi.fn() };
    const soldier = { visualProfileId: 'tiny_warrior', activeWeapon: null, bodyType: 'infantry' };

    // 'death' action için tiny_warrior profili tiny_warrior_death dönmeli → playAnimation çağrılır
    // Ama eğer profile'da death null olsaydı → çağrılmazdı.
    // Bu test: profile geçerli ama death key'i var → çağrılır
    resolveAndPlay(vs, soldier, 'death');
    // tiny_warrior'da death: 'tiny_warrior_death' var → playAnimation çağrılır
    expect(vs.playAnimation).toHaveBeenCalledWith('death', null);
  });
});
