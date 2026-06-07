export const QuestType = Object.freeze({
  MILITARY: 'military',
  SECURITY: 'security',
  DIPLOMATIC: 'diplomatic',
  ECONOMIC: 'economic',
  INTELLIGENCE: 'intelligence',
  SPECIAL: 'special',
});

export const QuestStatus = Object.freeze({
  AVAILABLE: 'available',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
});

export const QuestSource = Object.freeze({
  CITY_GOVERNOR: 'city_governor',
  SULTAN_KING: 'sultan_king',
  MERCHANT_GUILD: 'merchant_guild',
  RELIGIOUS_LEADER: 'religious_leader',
  ENCOUNTER_MESSENGER: 'encounter_messenger',
  CARAVANSERAI: 'caravanserai',
  NOBLE: 'noble',
  CARAVAN_LEADER: 'caravan_leader',
  COMPANION: 'companion',
  VILLAGERS: 'villagers',
});
