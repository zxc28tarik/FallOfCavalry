import * as CONST from '../constants.js';
import { getSettlementCharacters } from './world-characters.js';
import {selectCooperationCaravan} from './route-production-cooperation.js';

const runtime = {
  party: null,
  map: null,
  worldSeed: 1,
  offersByCity: new Map(),
};

const CONTRACT_TYPES = Object.freeze(['BANDIT', 'DELIVER', 'SCOUT', 'DEFEND', 'ESCORT', 'ASSASSINATE', 'COURIER', 'RELIEF', 'DISPATCH', 'CIVIC_FOLLOWUP', 'CHARACTER_COMMISSION', 'DISPUTE_REMEDY', 'DISPUTE_ACCORD', 'REGIONAL_AID', 'REGIONAL_RECOVERY', 'INTERCITY_TRADE', 'PRODUCTION_CARAVAN']);

function hashString(input) {
  const text = String(input || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRng(seedValue) {
  let s = (Number(seedValue) >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pickOne(list, rng, fallback = null) {
  if (!Array.isArray(list) || list.length === 0) return fallback;
  const idx = Math.max(0, Math.min(list.length - 1, Math.floor(rng() * list.length)));
  return list[idx];
}

function clampInt(v, min, max) {
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function isAtWarForFaction({ ownerFactionId, warState, factions } = {}) {
  if (!ownerFactionId) return false;

  const wars = Array.isArray(warState?.wars) ? warState.wars : (Array.isArray(warState?.activeWars) ? warState.activeWars : []);
  if (wars.some((war) => {
    const a = war?.a || war?.attacker || war?.left || war?.factionA;
    const b = war?.b || war?.defender || war?.right || war?.factionB;
    const active = war?.active !== false;
    return active && (a === ownerFactionId || b === ownerFactionId);
  })) return true;

  const rels = factions?.relations;
  if (rels && typeof rels === 'object') {
    return Object.entries(rels).some(([key, value]) => {
      if (!Number.isFinite(Number(value)) || Number(value) > Number(CONST.DIPLOMACY_RELATIONS?.WAR_THRESHOLD ?? -35)) return false;
      return String(key).split(/[:|]/).includes(ownerFactionId);
    });
  }

  return false;
}

function buildContractBase({ id, type, cityId, title, desc, rewardGold, rewardRenown, ownerFactionId, isWarContract = false }) {
  return {
    id,
    type,
    cityId,
    title,
    desc,
    ownerFactionId: ownerFactionId || null,
    factionId: ownerFactionId || null,
    isWarContract,
    progress: 0,
    accepted: false,
    completed: false,
    rewardGold: Math.floor(rewardGold),
    rewardRenown: Math.floor(rewardRenown),
  };
}

export function setContractsRuntimeContext({ party, map, worldSeed } = {}) {
  if (party && typeof party === 'object') runtime.party = party;
  if (map && typeof map === 'object') runtime.map = map;
  if (Number.isFinite(worldSeed)) runtime.worldSeed = worldSeed;
}

function getSettlements(map) {
  return Array.isArray(map?.settlements) ? map.settlements.filter((s) => s?.id != null) : [];
}

function getPois(map) {
  return Array.isArray(map?.pois) ? map.pois : [];
}

function getSettlementById(map, cityId) {
  return getSettlements(map).find((s) => s.id === cityId) || null;
}

function settlementName(settlement, fallbackId = 'Unknown') {
  return settlement?.name || settlement?.label || settlement?.id || fallbackId;
}

function distanceBetweenSettlements(a, b) {
  const ax = Number(a?.tx ?? a?.x ?? 0);
  const ay = Number(a?.ty ?? a?.y ?? 0);
  const bx = Number(b?.tx ?? b?.x ?? 0);
  const by = Number(b?.ty ?? b?.y ?? 0);
  return Math.hypot(ax - bx, ay - by);
}

function createBanditContract({ cityId, day, seed, rng, ownerFactionId, cityName }) {
  const factionFlavor = ownerFactionId && ownerFactionId !== CONST.FACTION.ID.BANDITS
    ? ` for ${ownerFactionId}`
    : '';
  return {
    ...buildContractBase({
      id: `ct-bandit-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
      type: 'BANDIT',
      cityId,
      title: `Clear Bandit Patrol${factionFlavor}`,
      desc: `Suppress raiders threatening ${cityName}.`,
      rewardGold: CONST.CONTRACTS.REWARD_GOLD_BASE * 1.1,
      rewardRenown: CONST.CONTRACTS.REWARD_RENOWN_BASE,
      ownerFactionId,
    }),
    targetRegionId: `region-${hashString(`${seed}:${cityId}:${day}:bandit`) % 16}`,
    requiredCount: Math.max(1, Number(CONST.CONTRACTS.BANDIT_BATTLE_COUNT || 1)),
  };
}

function createDeliveryContract({ cityId, day, rng, map, ownerFactionId, cityName }) {
  const settlements = getSettlements(map).filter((s) => s.id !== cityId);
  const target = pickOne(settlements, rng, null);
  const minFood = Math.floor(CONST.CONTRACTS.DELIVERY_FOOD_MIN);
  const maxFood = Math.floor(CONST.CONTRACTS.DELIVERY_FOOD_MAX);
  const amount = clampInt(minFood + Math.floor(rng() * (Math.max(minFood + 1, maxFood + 1) - minFood)), minFood, maxFood);
  return {
    ...buildContractBase({
      id: `ct-deliver-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
      type: 'DELIVER',
      cityId,
      title: 'Deliver Food Caravan',
      desc: `Move wheat from ${cityName} to ${settlementName(target, 'target city')}.`,
      rewardGold: CONST.CONTRACTS.REWARD_GOLD_BASE * 1.35,
      rewardRenown: CONST.CONTRACTS.REWARD_RENOWN_BASE * 0.9,
      ownerFactionId,
    }),
    targetCityId: target?.id || cityId,
    requiredAmount: amount,
    requiredCount: amount,
  };
}

function createScoutContract({ cityId, day, rng, map, ownerFactionId }) {
  const ruins = getPois(map).filter((poi) => poi?.id && poi.type === 'ruin');
  const targetPoi = pickOne(ruins, rng, null);
  return {
    ...buildContractBase({
      id: `ct-scout-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
      type: 'SCOUT',
      cityId,
      title: 'Scout Nearby Ruin',
      desc: `Explore ruin ${targetPoi?.id || 'target'} and report back.`,
      rewardGold: CONST.CONTRACTS.REWARD_GOLD_BASE,
      rewardRenown: CONST.CONTRACTS.REWARD_RENOWN_BASE * 1.25,
      ownerFactionId,
    }),
    targetPoiId: targetPoi?.id || null,
    requiredCount: Math.max(1, Number(CONST.CONTRACTS.SCOUT_POI_COUNT || 1)),
  };
}

function createDefendContract({ cityId, day, rng, ownerFactionId, cityName }) {
  const requiredCount = Math.max(1, Number(CONST.CONTRACTS.DEFEND_WAVE_COUNT ?? 2));
  const windowDays = Math.max(1, Number(CONST.CONTRACTS.DEFEND_WINDOW_DAYS ?? 3));
  return {
    ...buildContractBase({
      id: `ct-defend-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
      type: 'DEFEND',
      cityId,
      title: `Defend ${cityName}`,
      desc: `Defend ${cityName} against raids (${requiredCount} battles in ${windowDays} days).`,
      rewardGold: CONST.CONTRACTS.REWARD_GOLD_BASE * 1.45,
      rewardRenown: CONST.CONTRACTS.REWARD_RENOWN_BASE * 1.5,
      ownerFactionId,
      isWarContract: true,
    }),
    requiredCount,
    windowDays,
  };
}

function createEscortContract({ cityId, day, rng, map, ownerFactionId, cityName }) {
  const from = getSettlementById(map, cityId);
  const others = getSettlements(map).filter((s) => s.id !== cityId);
  const minDistance = Number(CONST.CONTRACTS.ESCORT_DISTANCE_MIN ?? 10);
  const maxDistance = Number(CONST.CONTRACTS.ESCORT_DISTANCE_MAX ?? 25);
  const candidates = others.filter((target) => {
    const d = distanceBetweenSettlements(from, target);
    return d >= minDistance && d <= maxDistance;
  });
  const target = pickOne(candidates.length ? candidates : others, rng, null);
  return {
    ...buildContractBase({
      id: `ct-escort-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
      type: 'ESCORT',
      cityId,
      title: `Escort caravan from ${cityName}`,
      desc: `Escort caravan from ${cityName} to ${settlementName(target, 'target city')}.`,
      rewardGold: CONST.CONTRACTS.REWARD_GOLD_BASE * 1.2,
      rewardRenown: CONST.CONTRACTS.REWARD_RENOWN_BASE * 1.1,
      ownerFactionId,
    }),
    targetCityId: target?.id || cityId,
    routeFromName: cityName,
    routeToName: settlementName(target, target?.id || cityId),
    maxBanditEncounters: 1,
    escortBanditEncounters: 0,
    requiredCount: 1,
  };
}

function createAssassinateContract({ cityId, day, rng, seed, ownerFactionId }) {
  const targetRegionId = `region-${hashString(`${seed}:${cityId}:${day}:leader`) % 16}`;
  return {
    ...buildContractBase({
      id: `ct-assassinate-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
      type: 'ASSASSINATE',
      cityId,
      title: 'Eliminate Bandit Leader',
      desc: `Eliminate a notorious bandit leader near ${targetRegionId}.`,
      rewardGold: CONST.CONTRACTS.REWARD_GOLD_BASE * 1.6,
      rewardRenown: CONST.CONTRACTS.REWARD_RENOWN_BASE * 1.65,
      ownerFactionId,
      isWarContract: true,
    }),
    targetFactionId: CONST.FACTION.ID.BANDITS,
    targetRegionId,
    targetPower: Number(CONST.CONTRACTS.ASSASSINATE_TARGET_POWER ?? 1.5),
    requiredCount: 1,
  };
}

/**
 * A city-to-city letter uses an authentic existing settlement. Completing it
 * requires entering the actual target city; viewing the board cannot credit it.
 */
function createCourierContract({cityId,day,rng,map,ownerFactionId,cityName}) {
  const source=getSettlementById(map,cityId);
  const destinations=getSettlements(map)
    .filter(s=>String(s.id)!==String(cityId))
    .sort((a,b)=>distanceBetweenSettlements(source,a)-distanceBetweenSettlements(source,b))
    .slice(0,12);
  const target=pickOne(destinations,rng,null);
  if(!target)return null;
  return {
    ...buildContractBase({
      id:`ct-courier-${cityId}-${day}-${Math.floor(rng()*10000)}`,
      type:'COURIER',cityId,
      title:'Mühürlü Ferman',
      desc:`${cityName} şehrinden ${settlementName(target)} şehrine mühürlü haberi götür.`,
      rewardGold:CONST.CONTRACTS.REWARD_GOLD_BASE*0.9,
      rewardRenown:CONST.CONTRACTS.REWARD_RENOWN_BASE,
      ownerFactionId,
    }),
    targetCityId:target.id,requiredCount:1,
  };
}
/**
 * A multi-stage administrative dispatch. All legs resolve to actual cities,
 * and a player must visit two different destinations before returning home.
 */
function createDispatchContract({cityId,day,rng,map,ownerFactionId,cityName}) {
  const source=getSettlementById(map,cityId);
  const choices=getSettlements(map)
    .filter(city=>String(city.id)!==String(cityId))
    .sort((a,b)=>distanceBetweenSettlements(source,a)-distanceBetweenSettlements(source,b))
    .slice(0,24);
  if(choices.length<2)return null;
  const first=pickOne(choices,rng);
  const second=pickOne(choices.filter(s=>String(s.id)!==String(first.id)),rng);
  if(!second)return null;
  return {
    ...buildContractBase({
      id:`ct-dispatch-${cityId}-${day}-${Math.floor(rng()*10000)}`,
      type:'DISPATCH',cityId,title:'Vilayetler Arası Mühürlü Yazışma',
      desc:`${cityName} → ${settlementName(first)} → ${settlementName(second)} → ${cityName}: belgeleri sırayla teslim edip dön.`,
      rewardGold:CONST.CONTRACTS.REWARD_GOLD_BASE*1.8,
      rewardRenown:CONST.CONTRACTS.REWARD_RENOWN_BASE*1.5,
      ownerFactionId,
    }),
    targetCityId:first.id,
    dispatchStops:[first.id,second.id,cityId],
    dispatchStopNames:[settlementName(first),settlementName(second),cityName],
    requiredCount:3,progress:0,civicSecurityBonus:1,
  };
}

/** Food relief is credited only by a real successful wheat sale at target. */
function createReliefContract({cityId,day,rng,map,ownerFactionId,cityName}) {
  const source=getSettlementById(map,cityId);
  const destinations=getSettlements(map)
    .filter(s=>String(s.id)!==String(cityId))
    .sort((a,b)=>Number(a.security??50)-Number(b.security??50)
      ||distanceBetweenSettlements(source,a)-distanceBetweenSettlements(source,b))
    .slice(0,16);
  const target=pickOne(destinations,rng,null);
  if(!target)return null;
  const amount=Math.max(4,Math.min(20,Math.floor(Number(CONST.CONTRACTS.DELIVERY_FOOD_MIN)||8)));
  return {
    ...buildContractBase({
      id:`ct-relief-${cityId}-${day}-${Math.floor(rng()*10000)}`,
      type:'RELIEF',cityId,
      title:'Halka Erzak Yardımı',
      desc:`${cityName} adına ${settlementName(target)} pazarına ${amount} buğday sat.`,
      rewardGold:CONST.CONTRACTS.REWARD_GOLD_BASE*1.15,
      rewardRenown:CONST.CONTRACTS.REWARD_RENOWN_BASE*1.2,
      ownerFactionId,
    }),
    targetCityId:target.id,requiredAmount:amount,requiredCount:amount,
    civicSecurityBonus:3,
  };
}

/**
 * Daily follow-up to a genuine council decision. A later day opens one
 * source-backed petition, not a free daily payout or a synthetic encounter.
 */
function createCivicFollowup({cityId,day,seed,map,ownerFactionId,cityName,civicDecision}) {
  if(!civicDecision||Math.floor(Number(civicDecision.day))!==Math.floor(Number(day))-1)
    return null;
  const kind=String(civicDecision.id||'');
  if(!['patrol','granary','levy'].includes(kind))return null;
  const source=getSettlementById(map,cityId);
  if(!source)return null;
  const destinations=getSettlements(map)
    .filter(city=>String(city.id)!==String(cityId))
    .sort((a,b)=>distanceBetweenSettlements(source,a)-distanceBetweenSettlements(source,b));
  const target=destinations[hashString(`${seed}:${cityId}:${day}:civic`) % (destinations.length||1)];
  if(kind!=='granary'&&!target)return null;
  const config={
    patrol:{title:'Devriye Güzergâhı Raporu',desc:`Yeni nöbet düzenini ${settlementName(target)} şehrinde denetle, ardından ${cityName} şehrine rapor getir.`,bonus:3},
    granary:{title:'İmaret Dağıtım Nöbeti',desc:`${cityName} pazarına 6 buğday satarak imaretin erzak ihtiyacını karşıla.`,bonus:4},
    levy:{title:'Vergi İtiraznamesi',desc:`${settlementName(target)} şehrinde halkın dilekçesini topla, ardından ${cityName} şehrine dön.`,bonus:5},
  }[kind];
  return {
    ...buildContractBase({
      id:`ct-civic-${cityId}-${day}-${kind}`,type:'CIVIC_FOLLOWUP',
      cityId,title:config.title,desc:config.desc,
      rewardGold:Math.floor(CONST.CONTRACTS.REWARD_GOLD_BASE*0.75),
      rewardRenown:Math.max(1,Math.floor(CONST.CONTRACTS.REWARD_RENOWN_BASE)),
      ownerFactionId,
    }),
    civicKind:kind,civicSecurityBonus:config.bonus,
    targetCityId:kind==='granary'?cityId:target.id,
    civicStops:kind==='granary'?[]:[target.id,cityId],
    requiredCount:kind==='granary'?6:2,
  };
}

/**
 * A supported named citizen may ask for ONE actual-world commission the next
 * campaign day. A verified historic petition response is its provenance.
 * No generated NPC is promoted and no target is inferred from a display name.
 */
function createCharacterCommission({cityId,day,seed,map,ownerFactionId,roster}){
  if(cityId==null||!Number.isSafeInteger(day)||day<2)return null;
  const people=getSettlementCharacters(roster,cityId)
    .filter(p=>p.kind==='named'&&p.status==='alive'&&Array.isArray(p.history)
      &&p.history.some(h=>h?.day===day-1&&h.type==='state-changed'
        &&h.metric==='satisfaction'
        &&h.reason==='Şehir dilekçesi: desteklendi'))
    .sort((a,b)=>a.id.localeCompare(b.id,'en'));
  const person=people[0];
  if(!person)return null;
  const home=getSettlementById(map,cityId);
  const candidates=getSettlements(map)
    .filter(s=>String(s.id)!==String(cityId))
    .sort((a,b)=>distanceBetweenSettlements(home,a)-distanceBetweenSettlements(home,b))
    .slice(0,20);
  if(!candidates.length)return null;
  const target=candidates[hashString(`${seed}:${person.id}:${day}`)%candidates.length];
  const supplies=person.role==='artisan'||person.role==='commander'||person.role==='traveler';
  const amount=6;
  const kindLabel={
    merchant:'Tüccarın Ticaret Haberi',artisan:'Usta İçin İkmal',
    administrator:'İdare Defteri Teslimi',commander:'Garnizon Erzak Görevi',
    traveler:'Yol Hanı İkmali',scholar:'Bilginin Yazışması',
  }[person.role]||'Kişisel Hizmet';
  return {
    ...buildContractBase({
      id:`ct-character-${person.id}-${day}`,
      type:'CHARACTER_COMMISSION',cityId,
      title:`${person.name} — ${kindLabel}`,
      desc:supplies
        ?`${person.name} adına ${settlementName(target)} şehrine ${amount} buğday sat.`
        :`${person.name} için ${settlementName(target)} şehrine git, sonra geri dön.`,
      rewardGold:Math.floor(CONST.CONTRACTS.REWARD_GOLD_BASE*1.1),
      rewardRenown:Math.max(1,Math.floor(CONST.CONTRACTS.REWARD_RENOWN_BASE*1.1)),
      ownerFactionId,
    }),
    characterId:person.id,characterRole:person.role,commissionKind:supplies?'supply':'correspondence',
    targetCityId:target.id,
    commissionStops:supplies?[]:[target.id,cityId],
    requiredAmount:supplies?amount:null,requiredCount:supplies?amount:2,
  };
}

/**
 * Follow-up to an actual previous-day dispute. Cause comes from persisted
 * named-character state history, NOT current conditions or an invented event.
 * No battle spawn or new quest authority: these are normal city contracts.
 */
function createDisputeRemedy({cityId,day,seed,map,ownerFactionId,roster,cityName}){
  if(cityId==null||!Number.isSafeInteger(day)||day<2)return null;
  const actors=getSettlementCharacters(roster,cityId)
    .filter(p=>p.kind==='named'&&p.status==='alive'&&Array.isArray(p.history))
    .sort((a,b)=>a.id.localeCompare(b.id,'en'));
  const record=actors.flatMap(person=>person.history
    .filter(h=>h.day===day-1&&h.type==='state-changed'
      &&h.metric==='satisfaction'&&/^Şehir ihtilafı: (first|second|mediate):(security|scarcity|trade|civic)$/.test(h.reason||''))
    .map(h=>({person,h}))).sort((a,b)=>a.person.id.localeCompare(b.person.id,'en'))[0];
  if(!record)return null;
  const cause=record.h.reason.split(':').at(-1);
  const home=getSettlementById(map,cityId);
  if(!home)return null;
  const destinations=getSettlements(map).filter(c=>String(c.id)!==String(cityId))
    .sort((a,b)=>distanceBetweenSettlements(home,a)-distanceBetweenSettlements(home,b))
    .slice(0,20);
  const supply=cause==='scarcity';
  if(!supply&&!destinations.length)return null;
  const target=supply?home:destinations[hashString(`${seed}:${cityId}:${day}:${cause}`)%destinations.length];
  const kind={
    security:{title:'Mahalle Asayiş Raporu',action:`${settlementName(target)} şehrindeki nöbetleri denetle ve ${cityName} şehrine dön.`,bonus:5},
    scarcity:{title:'Erzak Krizi Yardımı',action:`${cityName} pazarına 8 buğday sat.`,bonus:4},
    trade:{title:'Pazar Müzakeresi',action:`${settlementName(target)} şehrinde tüccarlarla görüş ve ${cityName} şehrine geri dön.`,bonus:2},
    civic:{title:'Şehir İdaresi Uzlaşması',action:`${settlementName(target)} şehrinin idare usullerini öğrenip ${cityName} şehrine dön.`,bonus:3},
  }[cause];
  return {
    ...buildContractBase({
      id:`ct-dispute-${cityId}-${day}-${cause}`,type:'DISPUTE_REMEDY',cityId,
      title:kind.title,desc:kind.action,
      rewardGold:Math.floor(CONST.CONTRACTS.REWARD_GOLD_BASE*0.85),
      rewardRenown:Math.max(1,Math.floor(CONST.CONTRACTS.REWARD_RENOWN_BASE)),
      ownerFactionId,
    }),
    disputeCause:cause,disputeCharacterId:record.person.id,
    targetCityId:target.id,disputeSecurityBonus:kind.bonus,
    disputeStops:supply?[]:[target.id,cityId],
    requiredCount:supply?8:2,requiredAmount:supply?8:null,
  };
}

/**
 * Chapter 2 exists only after the REAL remedy was claimed and both named
 * disputants still reside in the issuing settlement. The claim ledger is the
 * provenance; reloading or revisiting a contract board cannot forge it.
 */
function createDisputeAccord({cityId,day,seed,map,roster,party,ownerFactionId}){
  if(cityId==null||!Number.isSafeInteger(day)||day<2)return null;
  const claims=Array.isArray(party?.completedDisputeRemedies)?party.completedDisputeRemedies:[];
  if(!claims.length)return null;
  const residents=getSettlementCharacters(roster,cityId).filter(person=>
    person.kind==='named'&&person.status==='alive'&&Array.isArray(person.history));
  const sources=[];
  for(const person of residents){
    for(const h of person.history){
      if(h.type!=='state-changed'||h.metric!=='satisfaction'
        ||!Number.isSafeInteger(h.day)||h.day>=day
        ||!/^Şehir ihtilafı: (first|second|mediate):(security|scarcity|trade|civic)$/.test(h.reason||''))continue;
      const cause=h.reason.split(':').at(-1);
      const remedyId=`ct-dispute-${cityId}-${h.day+1}-${cause}`;
      const accordId=`ct-accord-${cityId}-${h.day+1}-${cause}`;
      if(!claims.includes(remedyId))continue;
      if(party.completedDisputeAccords?.includes(accordId))continue;
      sources.push({personId:person.id,h,cause,accordId,remedyId});
    }
  }
  sources.sort((a,b)=>b.h.day-a.h.day||a.personId.localeCompare(b.personId,'en'));
  const origin=sources.find(item=>sources.filter(s=>
    s.h.day===item.h.day&&s.h.reason===item.h.reason).length>=2);
  if(!origin)return null;
  const people=sources.filter(item=>
    item.h.day===origin.h.day&&item.h.reason===origin.h.reason).slice(0,2);
  if(people.length!==2||people[0].personId===people[1].personId)return null;
  const home=getSettlementById(map,cityId);
  if(!home)return null;
  const nearby=getSettlements(map).filter(c=>String(c.id)!==String(cityId))
    .sort((a,b)=>distanceBetweenSettlements(home,a)-distanceBetweenSettlements(home,b))
    .slice(0,20);
  if(!nearby.length)return null;
  const target=nearby[hashString(`${seed}:${origin.accordId}`)%nearby.length];
  const targetName=settlementName(target);
  return {
    ...buildContractBase({
      id:origin.accordId,type:'DISPUTE_ACCORD',cityId,
      title:'Şehir Uzlaşma Heyeti',
      desc:`1) ${targetName} şehrinde görüş. 2) Orada 4 buğday sat. 3) ${settlementName(home)} şehrine geri dön ve iki önemli kişiyle uzlaşmayı tamamla.`,
      rewardGold:Math.floor(CONST.CONTRACTS.REWARD_GOLD_BASE*1.2),
      rewardRenown:Math.max(1,Math.floor(CONST.CONTRACTS.REWARD_RENOWN_BASE*1.2)),
      ownerFactionId,
    }),
    accordCause:origin.cause,accordCharacters:people.map(x=>x.personId),
    sourceRemedyId:origin.remedyId,targetCityId:target.id,
    accordStage:0,accordDelivered:0,requiredCount:3,
  };
}

/**
 * V1.62: Offers originate in a real nearby city's observable shortage or
 * insecurity. No fictional settlement, social group or external event exists.
 * Once accepted the destination is frozen in the saved contract.
 */
function createRegionalAid({cityId,day,map,ownerFactionId,party}){
  if(cityId==null||!Number.isSafeInteger(day)||day<1)return null;
  const origin=getSettlementById(map,cityId);
  if(!origin)return null;
  const neighbors=getSettlements(map).filter(city=>String(city.id)!==String(cityId)
    &&Number.isFinite(Number(city.tx??city.x))
    &&Number.isFinite(Number(city.ty??city.y)))
    .map(city=>{
      const security=Number(city.security??50);
      const wheat=(city.marketStock||[]).find(row=>row.id==='wheat'||row.id==='food');
      const scarce=!!wheat&&Number.isFinite(Number(wheat.qty))&&Number(wheat.qty)<10;
      const danger=Number.isFinite(security)&&security<40;
      return {city,kind:scarce?'food':danger?'security':null,
        distance:distanceBetweenSettlements(origin,city)};
    })
    .filter(row=>row.kind&&Number.isFinite(row.distance))
    .sort((a,b)=>a.distance-b.distance||String(a.city.id).localeCompare(String(b.city.id),'en'));
  const selected=neighbors[0];
  if(!selected)return null;
  const {city,kind}=selected;
  const id=`ct-regional-${cityId}-${city.id}-${day}-${kind}`;
  if(party?.completedRegionalAid?.includes(id))return null;
  const supply=kind==='food';
  return {
    ...buildContractBase({
      id,type:'REGIONAL_AID',cityId,
      title:supply?'Komşu Şehre Erzak Yardımı':'Komşu Şehir Asayiş Haberi',
      desc:supply
        ?`${settlementName(city)} şehri buğday sıkıntısı yaşıyor. Oranın gerçek pazarına 6 buğday sat.`
        :`${settlementName(city)} şehrindeki güvenlik durumunu yerinde incele, ardından ${settlementName(origin)} şehrine dön.`,
      ownerFactionId,
      rewardGold:Math.floor(CONST.CONTRACTS.REWARD_GOLD_BASE*0.9),
      rewardRenown:Math.max(1,Math.floor(CONST.CONTRACTS.REWARD_RENOWN_BASE)),
    }),
    targetCityId:city.id,regionalAidKind:kind,requiredCount:supply?6:2,
    requiredAmount:supply?6:null,regionalStops:supply?[]:[city.id,cityId],
    regionalSecurityBonus:supply?3:5,
  };
}

/**
 * One follow-up chapter for a real redeemed aid mission. Offer only on
 * the following day in the beneficiary settlement and verify live geography.
 */
function createRegionalRecovery({cityId,day,map,party,ownerFactionId}){
  if(cityId==null||!Number.isSafeInteger(day)||day<2)return null;
  const records=Array.isArray(party?.regionalAidOutcomes)?party.regionalAidOutcomes:[];
  const claims=Array.isArray(party?.completedRegionalAid)?party.completedRegionalAid:[];
  const candidate=records.filter(record=>record&&record.day===day-1
    &&String(record.targetCityId)===String(cityId)&&claims.includes(record.id)
    &&['food','security'].includes(record.kind))
    .sort((a,b)=>a.id.localeCompare(b.id,'en'))[0];
  if(!candidate)return null;
  const home=getSettlementById(map,cityId);
  const source=getSettlements(map).find(s=>String(s.id)===String(candidate.sourceCityId));
  if(!home||!source||String(home.id)===String(source.id))return null;
  const id=`ct-regional-recovery-${candidate.id}`;
  if(party?.completedRegionalRecovery?.includes(id))return null;
  const food=candidate.kind==='food';
  return {
    ...buildContractBase({
      id,type:'REGIONAL_RECOVERY',cityId,
      title:food?'Erzak Takip Heyeti':'Asayiş Takip Heyeti',
      desc:food
        ?`Yardım eden ${settlementName(source)} şehrine git, sonra ${settlementName(home)} pazarına 4 buğday sat.`
        :`Yardım eden ${settlementName(source)} şehrine git, sonra ${settlementName(home)} şehrine dön.`,
      ownerFactionId,
      rewardGold:Math.floor(CONST.CONTRACTS.REWARD_GOLD_BASE*0.75),
      rewardRenown:Math.max(1,Math.floor(CONST.CONTRACTS.REWARD_RENOWN_BASE)),
    }),
    sourceAidId:candidate.id,regionalRecoveryKind:candidate.kind,
    sourceCityId:source.id,targetCityId:home.id,recoveryStage:0,
    recoveryDelivered:0,requiredCount:2,requiredAmount:null,
    recoverySecurityBonus:food?3:4,
  };
}

/**
 * Next-day merchant exchange between two actual towns whose named merchant/
 * artisan contacts were linked by a redeemed recovery. No synthetic markets.
 */
function createIntercityTrade({cityId,day,map,party,roster,ownerFactionId}){
  if(cityId==null||!Number.isSafeInteger(day)||day<2)return null;
  const records=Array.isArray(party?.regionalCooperation)?party.regionalCooperation:[];
  const recordsForDay=records.filter(x=>x?.day===day-1
    &&String(x.sourceCityId)===String(cityId)
    &&party?.completedRegionalRecovery?.includes(x.sourceRecoveryId)
    &&party?.completedRegionalAid?.includes(x.sourceAidId))
    .sort((a,b)=>a.sourceRecoveryId.localeCompare(b.sourceRecoveryId,'en'));
  for(const record of recordsForDay){
    const source=getSettlements(map).find(s=>String(s.id)===String(record.sourceCityId));
    const target=getSettlements(map).find(s=>String(s.id)===String(record.targetCityId));
    if(!source||!target||String(source.id)===String(target.id))continue;
    const people=Array.isArray(record.characterIds)?record.characterIds.map((id,index)=>
      getSettlementCharacters(roster,index===0?source.id:target.id)
        .find(p=>p.id===id&&p.kind==='named'&&p.status==='alive'
          &&['merchant','artisan'].includes(p.role))):[];
    if(people.length!==2||people.some(p=>!p))continue;
    const id=`ct-intercity-${record.sourceRecoveryId}`;
    if(party?.completedIntercityTrade?.includes(id))continue;
    return {
      ...buildContractBase({id,type:'INTERCITY_TRADE',cityId,
        title:'Şehirler Arası Ticaret Heyeti',
        desc:`${settlementName(target)} şehrindeki ticaret temsilcisine git, oranın pazarına 5 buğday sat ve ${settlementName(source)} şehrine dön.`,
        rewardGold:Math.floor(CONST.CONTRACTS.REWARD_GOLD_BASE*1.1),
        rewardRenown:Math.max(1,Math.floor(CONST.CONTRACTS.REWARD_RENOWN_BASE*1.2)),
        ownerFactionId,
      }),
      sourceRecoveryId:record.sourceRecoveryId,sourceAidId:record.sourceAidId,
      linkedCharacters:[...record.characterIds],targetCityId:target.id,
      tradeStage:0,tradeDelivered:0,requiredCount:3,
      requiredAmount:null,
    };
  }
  return null;
}

function createProductionCaravan({cityId,day,map,party,roster,ownerFactionId}){
  const route=selectCooperationCaravan({map,party,roster,cityId,day});
  if(!route)return null;
  const id=`ct-production-${route.sourceRecoveryId}-${route.itemId}`;
  if(party?.completedProductionCaravans?.includes(id))return null;
  const cargo=(CONST.TRADE_ITEMS||[]).find(x=>x.id===route.itemId);
  return {
    ...buildContractBase({id,type:'PRODUCTION_CARAVAN',cityId,
      title:'Üretim Kervanı — Gerçek Ticaret Yolu',
      desc:`${settlementName(route.source)} pazarından 3 ${cargo?.name||route.itemId} satın al, ${settlementName(route.target)} şehrine git ve aynı maldan 3 adet orada sat.`,
      rewardGold:Math.max(1,Math.floor(CONST.CONTRACTS.REWARD_GOLD_BASE)),
      rewardRenown:Math.max(1,Math.floor(CONST.CONTRACTS.REWARD_RENOWN_BASE)),
      ownerFactionId,
    }),
    sourceRecoveryId:route.sourceRecoveryId,sourceCityId:route.source.id,
    targetCityId:route.target.id,routeId:route.routeId,
    cargoItemId:route.itemId,productionBiome:route.biome,
    caravanStage:0,caravanBought:0,caravanSold:0,requiredCount:3,
  };
}

export function generateContractsForCity({ cityId, day, seed, map, worldState, factions, warState } = {}) {
  const chosenMap = map || worldState?.map || runtime.map || { settlements: [], pois: [] };
  const worldSeed = Number.isFinite(seed)
    ? seed
    : (Number.isFinite(worldState?.seed) ? worldState.seed : runtime.worldSeed);
  const key = `${cityId ?? 'city'}:${Number(day || 1)}:${worldSeed}`;
  const rng = makeRng(hashString(key));
  const settlement = getSettlementById(chosenMap, cityId);
  const ownerFactionId = settlement?.ownerFactionId || settlement?.owner || null;
  const cityName = settlementName(settlement, cityId);
  const warActive = isAtWarForFaction({ ownerFactionId, warState, factions: factions || worldState?.factions });

  const pool = warActive
    ? ['DEFEND', 'ASSASSINATE', 'BANDIT', 'ESCORT', 'DELIVER', 'DEFEND', 'ASSASSINATE']
    : ['BANDIT', 'DELIVER', 'SCOUT', 'ESCORT', 'BANDIT', 'SCOUT'];
  const selected = [];
  while (selected.length < 3 && pool.length) {
    const picked = pickOne(pool, rng);
    if (!picked) break;
    if (!selected.includes(picked)) selected.push(picked);
    if (selected.length < 3 && selected.includes('SCOUT') && !pool.includes('ESCORT')) pool.push('ESCORT');
  }

  if (!selected.includes('BANDIT')) selected[0] = 'BANDIT';
  if (!warActive && !selected.includes('SCOUT')) selected[1] = 'SCOUT';
  if (!selected.includes('ESCORT')) selected[2] = 'ESCORT';

  if (warActive && !selected.some((type) => type === 'DEFEND' || type === 'ASSASSINATE')) {
    const warType = pickOne(['DEFEND', 'ASSASSINATE'], rng, 'DEFEND');
    const replaceCandidates = [0, 1, 2].filter((idx) => selected[idx] !== 'ESCORT');
    const replaceIndex = pickOne(replaceCandidates, rng, 1);
    selected[replaceIndex] = warType;
  }

  // Original military/commercial work plus three different civil missions.
  // Never remove the wartime military slot.
  const expanded = [...selected.slice(0,3),'COURIER','RELIEF','DISPATCH'];
  const contracts = expanded.map((type) => {
    if (!CONTRACT_TYPES.includes(type)) return null;
    if (type === 'BANDIT') return createBanditContract({ cityId, day, seed: worldSeed, rng, ownerFactionId, cityName });
    if (type === 'DELIVER') return createDeliveryContract({ cityId, day, rng, map: chosenMap, ownerFactionId, cityName });
    if (type === 'SCOUT') return createScoutContract({ cityId, day, rng, map: chosenMap, ownerFactionId });
    if (type === 'DEFEND') return createDefendContract({ cityId, day, rng, ownerFactionId, cityName });
    if (type === 'ESCORT') return createEscortContract({ cityId, day, rng, map: chosenMap, ownerFactionId, cityName });
    if (type === 'ASSASSINATE') return createAssassinateContract({ cityId, day, rng, seed: worldSeed, ownerFactionId });
    if (type === 'COURIER') return createCourierContract({cityId,day,rng,map:chosenMap,ownerFactionId,cityName});
    if (type === 'RELIEF') return createReliefContract({cityId,day,rng,map:chosenMap,ownerFactionId,cityName});
    if (type === 'DISPATCH') return createDispatchContract({cityId,day,rng,map:chosenMap,ownerFactionId,cityName});
    return null;
  }).filter(Boolean);

  const followup=createCivicFollowup({
    cityId,day,seed:worldSeed,map:chosenMap,ownerFactionId,cityName,
    civicDecision:settlement?.civicDecision,
  });
  if(followup)contracts.push(followup);
  const commission=createCharacterCommission({
    cityId,day:Math.floor(Number(day)||0),seed:worldSeed,map:chosenMap,
    ownerFactionId,roster:worldState?.worldCharacters,
  });
  if(commission)contracts.push(commission);
  const remedy=createDisputeRemedy({
    cityId,day:Math.floor(Number(day)||0),seed:worldSeed,map:chosenMap,
    ownerFactionId,roster:worldState?.worldCharacters,cityName,
  });
  if(remedy)contracts.push(remedy);
  const accord=createDisputeAccord({
    cityId,day:Math.floor(Number(day)||0),seed:worldSeed,map:chosenMap,
    roster:worldState?.worldCharacters,party:worldState?.playerParty||runtime.party,
    ownerFactionId,
  });
  if(accord)contracts.push(accord);
  const regional=createRegionalAid({cityId,day:Math.floor(Number(day)||0),map:chosenMap,
    ownerFactionId,party:worldState?.playerParty||runtime.party});
  if(regional)contracts.push(regional);
  const recovery=createRegionalRecovery({cityId,day:Math.floor(Number(day)||0),
    map:chosenMap,party:worldState?.playerParty||runtime.party,ownerFactionId});
  if(recovery)contracts.push(recovery);
  const intercity=createIntercityTrade({cityId,day:Math.floor(Number(day)||0),
    map:chosenMap,party:worldState?.playerParty||runtime.party,
    roster:worldState?.worldCharacters,ownerFactionId});
  if(intercity)contracts.push(intercity);
  const caravan=createProductionCaravan({cityId,day:Math.floor(Number(day)||0),
    map:chosenMap,party:worldState?.playerParty||runtime.party,
    roster:worldState?.worldCharacters,ownerFactionId});
  if(caravan)contracts.push(caravan);
  runtime.offersByCity.set(String(cityId ?? ''), contracts.map((c) => ({ ...c })));
  return contracts;
}

export function acceptContract(contractId, party = runtime.party) {
  if (!party || !contractId) return null;
  if (!Array.isArray(party.contracts)) party.contracts = [];
  if(Array.isArray(party.completedDisputeRemedies)
    &&party.completedDisputeRemedies.includes(contractId))return null;
  if(Array.isArray(party.completedDisputeAccords)
    &&party.completedDisputeAccords.includes(contractId))return null;
  if(Array.isArray(party.completedRegionalAid)
    &&party.completedRegionalAid.includes(contractId))return null;
  if(Array.isArray(party.completedRegionalRecovery)
    &&party.completedRegionalRecovery.includes(contractId))return null;
  if(Array.isArray(party.completedIntercityTrade)
    &&party.completedIntercityTrade.includes(contractId))return null;
  if(Array.isArray(party.completedProductionCaravans)
    &&party.completedProductionCaravans.includes(contractId))return null;
  const already = party.contracts.find((c) => c?.id === contractId);
  if (already) return already;

  const offer = Array.from(runtime.offersByCity.values())
    .flat()
    .find((contract) => contract?.id === contractId);

  if (!offer) return null;
  const accepted = { ...offer, accepted: true, completed: false, progress: Math.max(0, Number(offer.progress ?? 0)) };
  party.contracts.push(accepted);
  return accepted;
}

export function updateContractProgress(event, party = runtime.party) {
  if (!party || !Array.isArray(party.contracts) || !event || typeof event !== 'object') return [];
  const changed = [];

  party.contracts.forEach((contract) => {
    if (!contract?.accepted || contract?.completed) return;
    const prev = Number(contract.progress ?? 0);
    if (contract.type === 'BANDIT' && event.type === 'BATTLE_WON') {
      if (event.enemyFaction === 'bandits') {
        contract.progress = prev + 1;
      }
    }
    if (contract.type === 'DEFEND' && event.type === 'BATTLE_WON') {
      if (event.enemyFaction === 'bandits' && event.locationCityId === contract.cityId) {
        contract.progress = prev + 1;
      }
    }
    if (contract.type === 'ASSASSINATE' && event.type === 'BATTLE_WON') {
      if (event.enemyFaction === 'bandits' && event.isTargetLeader) {
        contract.progress = prev + 1;
      }
    }
    if (contract.type === 'ESCORT' && event.type === 'BATTLE_WON') {
      if (event.enemyFaction === 'bandits' && !contract.completed) {
        contract.escortBanditEncounters = Number(contract.escortBanditEncounters ?? 0) + 1;
      }
    }
    if (contract.type === 'ESCORT' && event.type === 'ESCORT_COMPLETE') {
      const success = Boolean(event.success);
      if (event.fromCityId === contract.cityId && event.toCityId === contract.targetCityId && success) {
        contract.progress = 1;
      }
    }
    if(contract.type==='PRODUCTION_CARAVAN'){
      const stage=Math.max(0,Math.floor(Number(contract.caravanStage)||0));
      const validCount=Number.isFinite(Number(event.qty))&&Number(event.qty)>0
        ?Math.floor(Number(event.qty)):0;
      if(stage===0&&event.type==='TRADE_GOOD_BOUGHT'&&event.cityId!=null
        &&String(event.cityId)===String(contract.sourceCityId)
        &&event.itemId===contract.cargoItemId&&validCount>0){
        contract.caravanBought=Math.min(3,Math.max(0,Number(contract.caravanBought)||0)+validCount);
        if(contract.caravanBought===3){contract.caravanStage=1;contract.progress=1;}
      }else if(stage===1&&event.type==='CITY_VISITED'&&event.cityId!=null
        &&String(event.cityId)===String(contract.targetCityId)){
        contract.caravanStage=2;contract.progress=2;
      }else if(stage===2&&event.type==='TRADE_GOOD_SOLD'&&event.cityId!=null
        &&String(event.cityId)===String(contract.targetCityId)
        &&event.itemId===contract.cargoItemId&&validCount>0){
        contract.caravanSold=Math.min(3,Math.max(0,Number(contract.caravanSold)||0)+validCount);
        if(contract.caravanSold===3){contract.caravanStage=3;contract.progress=3;}
      }
    }
    if(contract.type==='INTERCITY_TRADE'){
      const stage=Math.max(0,Math.floor(Number(contract.tradeStage)||0));
      if(stage===0&&event.type==='CITY_VISITED'&&event.cityId!=null
        &&String(event.cityId)===String(contract.targetCityId)){
        contract.tradeStage=1;
        contract.progress=1;
      }else if(stage===1&&event.type==='DELIVERED'&&event.itemId==='food'
        &&event.cityId!=null&&String(event.cityId)===String(contract.targetCityId)
        &&Number.isFinite(Number(event.qty))&&Number(event.qty)>0){
        contract.tradeDelivered=Math.min(5,Math.max(0,Number(contract.tradeDelivered)||0)
          +Math.floor(Number(event.qty)));
        if(contract.tradeDelivered>=5){
          contract.tradeStage=2;
          contract.progress=2;
        }
      }else if(stage===2&&event.type==='CITY_VISITED'&&event.cityId!=null
        &&String(event.cityId)===String(contract.cityId)){
        contract.tradeStage=3;
        contract.progress=3;
      }
    }
    if(contract.type==='REGIONAL_RECOVERY'){
      const stage=Math.max(0,Math.floor(Number(contract.recoveryStage)||0));
      if(stage===0&&event.type==='CITY_VISITED'&&event.cityId!=null
        &&String(event.cityId)===String(contract.sourceCityId)){
        contract.recoveryStage=1;
        contract.progress=1;
      }else if(stage===1&&contract.regionalRecoveryKind==='security'
        &&event.type==='CITY_VISITED'&&event.cityId!=null
        &&String(event.cityId)===String(contract.cityId)){
        contract.recoveryStage=2;
        contract.progress=2;
      }else if(stage===1&&contract.regionalRecoveryKind==='food'
        &&event.type==='DELIVERED'&&event.itemId==='food'
        &&event.cityId!=null&&String(event.cityId)===String(contract.cityId)
        &&Number.isFinite(Number(event.qty))&&Number(event.qty)>0){
        contract.recoveryDelivered=Math.min(4,Math.max(0,Number(contract.recoveryDelivered)||0)
          +Math.floor(Number(event.qty)));
        if(contract.recoveryDelivered>=4){
          contract.recoveryStage=2;
          contract.progress=2;
        }
      }
    }
    if(contract.type==='REGIONAL_AID'){
      if(contract.regionalAidKind==='food'&&event.type==='DELIVERED'
        &&event.itemId==='food'&&event.cityId!=null
        &&String(event.cityId)===String(contract.targetCityId)
        &&Number.isFinite(Number(event.qty))&&Number(event.qty)>0)
        contract.progress=prev+Math.floor(Number(event.qty));
      if(contract.regionalAidKind==='security'&&event.type==='CITY_VISITED'){
        const stops=Array.isArray(contract.regionalStops)?contract.regionalStops:[];
        const next=Math.max(0,Math.floor(Number(contract.progress)||0));
        if(next<stops.length&&event.cityId!=null
          &&String(event.cityId)===String(stops[next]))contract.progress=next+1;
      }
    }
    if(contract.type==='DISPUTE_ACCORD'){
      const stage=Math.max(0,Math.floor(Number(contract.accordStage)||0));
      if(stage===0 && event.type==='CITY_VISITED'&&event.cityId!=null
        &&String(event.cityId)===String(contract.targetCityId)){
        contract.accordStage=1;
        contract.progress=1;
      }else if(stage===1 && event.type==='DELIVERED'&&event.cityId!=null
        &&String(event.cityId)===String(contract.targetCityId)
        &&event.itemId==='food'&&Number.isFinite(Number(event.qty))
        &&Number(event.qty)>0){
        const quantity=Math.max(0,Number(contract.accordDelivered)||0);
        contract.accordDelivered=Math.min(4,quantity+Math.floor(Number(event.qty)));
        if(contract.accordDelivered>=4){
          contract.accordStage=2;
          contract.progress=2;
        }
      }else if(stage===2 && event.type==='CITY_VISITED'&&event.cityId!=null
        &&String(event.cityId)===String(contract.cityId)){
        contract.accordStage=3;
        contract.progress=3;
      }
    }
    if (contract.type === 'DISPUTE_REMEDY') {
      if(contract.disputeCause==='scarcity' && event.type==='DELIVERED'
        && event.itemId==='food'&&event.cityId!=null
        && String(event.cityId)===String(contract.cityId))
        contract.progress=prev+Math.max(0,Number(event.qty??0));
      if(contract.disputeCause!=='scarcity' && event.type==='CITY_VISITED'){
        const stops=Array.isArray(contract.disputeStops)?contract.disputeStops:[];
        const next=Math.max(0,Math.floor(Number(contract.progress)||0));
        if(next<stops.length&&event.cityId!=null
          &&String(event.cityId)===String(stops[next]))contract.progress=next+1;
      }
    }
    if (contract.type === 'CHARACTER_COMMISSION') {
      if(contract.commissionKind==='supply' && event.type==='DELIVERED'
        && event.itemId==='food' && event.cityId!=null
        && String(event.cityId)===String(contract.targetCityId))
        contract.progress=prev+Math.max(0,Number(event.qty??0));
      if(contract.commissionKind==='correspondence' && event.type==='CITY_VISITED'){
        const stops=Array.isArray(contract.commissionStops)?contract.commissionStops:[];
        const next=Math.max(0,Math.floor(Number(contract.progress)||0));
        if(next<stops.length && event.cityId!=null
          && String(event.cityId)===String(stops[next]))contract.progress=next+1;
      }
    }
    if (contract.type === 'CIVIC_FOLLOWUP') {
      if(contract.civicKind==='granary' && event.type==='DELIVERED'
        && event.itemId==='food' && event.cityId!=null
        && String(event.cityId)===String(contract.cityId))
        contract.progress=prev+Math.max(0,Number(event.qty??0));
      if(contract.civicKind!=='granary' && event.type==='CITY_VISITED'){
        const stops=Array.isArray(contract.civicStops)?contract.civicStops:[];
        const next=Math.max(0,Math.floor(Number(contract.progress)||0));
        if(next<stops.length && event.cityId!=null
          && String(event.cityId)===String(stops[next]))contract.progress=next+1;
      }
    }
    if (contract.type === 'DISPATCH' && event.type === 'CITY_VISITED') {
      const stops=Array.isArray(contract.dispatchStops)?contract.dispatchStops:[];
      const index=Math.max(0,Math.floor(Number(contract.progress)||0));
      if(index<stops.length && event.cityId!=null
        && String(event.cityId)===String(stops[index]))
        contract.progress=index+1;
    }
    if (contract.type === 'COURIER' && event.type === 'CITY_VISITED') {
      if (String(event.cityId) === String(contract.targetCityId)) contract.progress=1;
    }
    if (contract.type === 'RELIEF' && event.type === 'DELIVERED') {
      if (event.itemId === 'food' && String(event.cityId)===String(contract.targetCityId))
        contract.progress=prev+Math.max(0,Number(event.qty??0));
    }
    if (contract.type === 'DELIVER' && event.type === 'DELIVERED') {
      if (event.itemId === 'food' && event.cityId === contract.targetCityId) {
        contract.progress = prev + Math.max(0, Number(event.qty ?? 0));
      }
    }
    if (contract.type === 'SCOUT' && event.type === 'POI_EXPLORED') {
      if (event.poiId && event.poiId === contract.targetPoiId) {
        contract.progress = prev + 1;
      }
    }

    const required = (contract.type === 'DELIVER' || contract.type === 'RELIEF' || contract.type === 'CIVIC_FOLLOWUP' || contract.type === 'CHARACTER_COMMISSION' || contract.type === 'DISPUTE_REMEDY' || contract.type === 'REGIONAL_AID')
      ? Math.max(1, Number(contract.requiredAmount ?? contract.requiredCount ?? 1))
      : Math.max(1, Number(contract.requiredCount ?? 1));

    if (contract.progress >= required) {
      contract.completed = true;
      contract.progress = required;
    }

    if (contract.progress !== prev || contract.completed) changed.push(contract);
  });

  return changed;
}

export function completeContract(contractId, party = runtime.party, options = {}) {
  if (!party || !Array.isArray(party.contracts) || !contractId) return null;
  const idx = party.contracts.findIndex((c) => c?.id === contractId);
  if (idx < 0) return null;
  const contract = party.contracts[idx];
  if (!contract.completed) return null;
  if(contract.type==='DISPUTE_REMEDY'&&Array.isArray(party.completedDisputeRemedies)
    &&party.completedDisputeRemedies.includes(contract.id))return null;
  if(contract.type==='DISPUTE_ACCORD'&&Array.isArray(party.completedDisputeAccords)
    &&party.completedDisputeAccords.includes(contract.id))return null;
  if(contract.type==='REGIONAL_AID'&&Array.isArray(party.completedRegionalAid)
    &&party.completedRegionalAid.includes(contract.id))return null;
  if(contract.type==='REGIONAL_RECOVERY'&&Array.isArray(party.completedRegionalRecovery)
    &&party.completedRegionalRecovery.includes(contract.id))return null;

  if(contract.type==='INTERCITY_TRADE'&&Array.isArray(party.completedIntercityTrade)
    &&party.completedIntercityTrade.includes(contract.id))return null;
  if(contract.type==='PRODUCTION_CARAVAN'&&Array.isArray(party.completedProductionCaravans)
    &&party.completedProductionCaravans.includes(contract.id))return null;
  const resolvedWarState = options?.warState || null;
  const isWarNow = isAtWarForFaction({ ownerFactionId: contract.ownerFactionId || contract.factionId, warState: resolvedWarState, factions: options?.factions });
  const warContractTypes = new Set(['DEFEND', 'ASSASSINATE']);
  const warBonus = warContractTypes.has(contract.type) && isWarNow
    ? Number(CONST.CONTRACTS.WAR_CONTRACT_BONUS_RENOWN ?? 0)
    : 0;

  party.gold = Math.floor(Number(party.gold ?? 0) + Number(contract.rewardGold ?? 0));
  party.renown = Math.floor(Number(party.renown ?? 0) + Number(contract.rewardRenown ?? 0) + warBonus);

  const completed = { ...contract, bonusRenown: warBonus };
  // Civilian relief improves the actual beneficiary settlement, not an
  // unverified quest title or a synthetic regional economy location.
  if (contract.type === 'PRODUCTION_CARAVAN' && typeof options?.onProductionCaravan === 'function') {
    options.onProductionCaravan(completed);
  }
  if (contract.type === 'INTERCITY_TRADE' && typeof options?.onIntercityTrade === 'function') {
    options.onIntercityTrade(completed);
  }
  if (contract.type === 'REGIONAL_RECOVERY' && typeof options?.onRegionalRecovery === 'function') {
    options.onRegionalRecovery(completed);
  }
  if (contract.type === 'REGIONAL_AID' && typeof options?.onRegionalAid === 'function') {
    options.onRegionalAid(completed);
  }
  if (contract.type === 'DISPUTE_ACCORD' && typeof options?.onDisputeAccord === 'function') {
    options.onDisputeAccord(completed);
  }
  if (contract.type === 'DISPUTE_REMEDY' && typeof options?.onDisputeRemedy === 'function') {
    options.onDisputeRemedy(completed);
  }
  if (contract.type === 'CHARACTER_COMMISSION' && typeof options?.onCharacterCommission === 'function') {
    options.onCharacterCommission(completed);
  }
  if (contract.type === 'RELIEF' && typeof options?.onCivicRelief === 'function') {
    options.onCivicRelief(completed);
  }
  if (contract.type === 'CIVIC_FOLLOWUP' && typeof options?.onCivicFollowup === 'function') {
    options.onCivicFollowup(completed);
  }
  if (contract.type === 'DISPATCH' && typeof options?.onCivicDispatch === 'function') {
    options.onCivicDispatch(completed);
  }
  party.contracts.splice(idx, 1);
  if(contract.type==='DISPUTE_REMEDY'){
    const previous=Array.isArray(party.completedDisputeRemedies)?party.completedDisputeRemedies:[];
    party.completedDisputeRemedies=[...new Set([...previous,contract.id])].slice(-128);
  }
  if(contract.type==='DISPUTE_ACCORD'){
    const previous=Array.isArray(party.completedDisputeAccords)?party.completedDisputeAccords:[];
    party.completedDisputeAccords=[...new Set([...previous,contract.id])].slice(-128);
  }
  if(contract.type==='REGIONAL_AID'){
    const previous=Array.isArray(party.completedRegionalAid)?party.completedRegionalAid:[];
    party.completedRegionalAid=[...new Set([...previous,contract.id])].slice(-128);
    if(typeof options?.onRegionalAidOutcome==='function')options.onRegionalAidOutcome(completed);
  }
  if(contract.type==='REGIONAL_RECOVERY'){
    const previous=Array.isArray(party.completedRegionalRecovery)?party.completedRegionalRecovery:[];
    party.completedRegionalRecovery=[...new Set([...previous,contract.id])].slice(-128);
    if(typeof options?.onRegionalCooperation==='function')options.onRegionalCooperation(completed);
  }
  if(contract.type==='INTERCITY_TRADE'){
    const previous=Array.isArray(party.completedIntercityTrade)?party.completedIntercityTrade:[];
    party.completedIntercityTrade=[...new Set([...previous,contract.id])].slice(-128);
  }
  if(contract.type==='PRODUCTION_CARAVAN'){
    const previous=Array.isArray(party.completedProductionCaravans)?party.completedProductionCaravans:[];
    party.completedProductionCaravans=[...new Set([...previous,contract.id])].slice(-128);
  }

  if (warBonus > 0 && typeof options?.onRelationBonus === 'function') {
    options.onRelationBonus(completed);
  }

  return completed;
}

export function emitContractEvent(event, party = runtime.party) {
  return updateContractProgress(event, party);
}

export function getActiveContracts(party = runtime.party) {
  if (!party || !Array.isArray(party.contracts)) return [];
  return party.contracts;
}
