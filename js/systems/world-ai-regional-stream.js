/**
 * WEB V1.46: bounded ACTIVE-window streaming without destroying world-party
 * identity, source city or quest context when the player travels.
 *
 * Dormant parties are intentionally NOT updated, rendered, encountered, or
 * counted against the per-kind active quota. They keep their exact IDs and
 * last real position for a later return to this region. The region history
 * preserves cooldown separately from the original global 3-day cadence.
 */
import {nearbyActualCities} from './world-ai-local-sources.js';

const activeKinds=new Set([
  'bandit','patrol','caravan',
  'refugee','merchant','messenger','villagers','noble',
]);
const caps={
  bandit:['MAX_BANDIT_PARTIES',4],
  patrol:['MAX_PATROL_PARTIES',3],
  caravan:['MAX_CARAVAN_PARTIES',3],
  refugee:['MAX_REFUGEE_PARTIES',2],
  merchant:['MAX_TRAVELING_MERCHANT_PARTIES',2],
  messenger:['MAX_MESSENGER_PARTIES',2],
  villagers:['MAX_VILLAGER_PARTIES',2],
  noble:['MAX_NOBLE_PARTIES',1],
};
const valid=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const maxKind=(kind,cfg)=>Math.max(0,Math.floor(Number(
  cfg?.[caps[kind]?.[0]]??caps[kind]?.[1]??0,
)));
const typeCount=(parties,kind)=>parties.filter(p=>p?.alive!==false&&p?.kind===kind).length;

export function streamWorldAiRegion({
  aiState,worldState,playerParty,cfg={},currentDay=1,
  protectedRouteIds=[],
}={}){
  const noChange={changed:false,forcePopulation:false,parked:0,restored:0};
  if(!aiState||!Array.isArray(aiState.parties)||!valid(playerParty))return noChange;
  const tile=Number(worldState?.tileSize||32);
  const configured=Number(cfg?.DESPAWN_DISTANCE??40);
  if(!Number.isFinite(tile)||tile<=0||!Number.isFinite(configured)||configured<=8)
    return noChange;
  const step=Math.max(8,configured-12)*tile;
  const activeRadius=Math.max(4,configured-4)*tile;
  const revisitRadius=Math.max(4,configured-21)*tile;
  const day=Math.max(1,Math.floor(Number(currentDay)||1));
  if(!Array.isArray(aiState.dormantParties))aiState.dormantParties=[];
  if(!Array.isArray(aiState.regionHistory))aiState.regionHistory=[];
  if(!valid(aiState.regionAnchor)){
    aiState.regionAnchor={x:playerParty.x,y:playerParty.y};
    if(!aiState.regionHistory.length)
      aiState.regionHistory.push({x:playerParty.x,y:playerParty.y,lastDay:day});
    return noChange;
  }
  if(dist(aiState.regionAnchor,playerParty)<step)return noChange;
  aiState.regionAnchor={x:playerParty.x,y:playerParty.y};
  const protectedIds=new Set(protectedRouteIds.map(String));
  const dormantIds=new Set(aiState.dormantParties.map(p=>String(p?.id)));
  const living=[];
  let parked=0,restored=0;
  for(const p of aiState.parties){
    const protectedQuest=Boolean(
      p?.escortQuestId||p?.escortGuardFor||p?.kind==='escort_guard'
      ||(p?.kind==='bandit'&&p?.routeId!=null
        &&protectedIds.has(String(p.routeId))),
    );
    if(p?.alive!==false&&p?.id!=null&&activeKinds.has(p.kind)
      &&valid(p)&&dist(p,playerParty)>activeRadius&&!protectedQuest){
      if(!dormantIds.has(String(p.id))){
        aiState.dormantParties.push(p);
        dormantIds.add(String(p.id));
      }
      parked++;
    }else living.push(p);
  }
  aiState.parties=living;
  // Restore known IDs BEFORE generating any new party in this region.
  // Do not resurrect a defeated party; only the explicitly parked live list.
  const waiting=[];
  const activeIds=new Set(living.map(p=>String(p?.id)));
  for(const p of aiState.dormantParties){
    if(p?.alive!==false&&p?.id!=null&&activeKinds.has(p.kind)
      &&valid(p)&&dist(p,playerParty)<=activeRadius
      &&!activeIds.has(String(p.id))
      &&typeCount(living,p.kind)<maxKind(p.kind,cfg)){
      // Returning to a region is not an instant ambush at the streaming
      // threshold; the actual patrol/bandit still exists and can engage once
      // a brief transition grace has elapsed.
      if(p.kind==='bandit'||p.kind==='patrol')
        p.regionEntryGraceSeconds=6;
      living.push(p);
      activeIds.add(String(p.id));
      restored++;
    }else waiting.push(p);
  }
  aiState.dormantParties=waiting;
  const visited=aiState.regionHistory.find(row=>valid(row)
    &&dist(row,playerParty)<revisitRadius);
  const interval=Math.max(0,Number(cfg?.RESPAWN_INTERVAL_DAYS??3));
  const allow=(!visited||day-Number(visited.lastDay||0)>=interval)
    &&nearbyActualCities(worldState,playerParty,cfg).length>0;
  if(allow){
    if(visited){
      visited.x=playerParty.x;
      visited.y=playerParty.y;
      visited.lastDay=day;
    }else aiState.regionHistory.push({
      x:playerParty.x,y:playerParty.y,lastDay:day,
    });
  }
  // Region stamps are lightweight, not party records. Keep a bounded
  // chronology while the dormant ID/state records themselves remain intact.
  if(aiState.regionHistory.length>128)
    aiState.regionHistory=aiState.regionHistory.slice(-128);
  return {changed:true,forcePopulation:allow,parked,restored};
}
