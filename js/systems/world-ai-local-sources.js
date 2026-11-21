/**
 * WEB V1.45: local WORLD-AI sources must be registered cities, never a
 * fabricated settlement or an unchecked route id. This module makes no
 * changes to existing party movement, encounter or respawn rules.
 */
import * as CONST from '../constants.js';
import {canonicalRoadLinks,roadWorldWaypoints} from './world-trade-road-topology.js';

const real=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const id=x=>String(x??'');
const cityOwner=s=>s?.ownerFactionId||s?.owner||s?.factionId||null;
const tileSize=world=>Number(world?.tileSize||CONST.WORLD.TILE_SIZE||32);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const select=rows=>rows.length?rows[Math.floor(Math.random()*rows.length)]:null;

export function localWorldRadius(worldState,cfg={},marginTiles=4){
  const tiles=Number(cfg?.DESPAWN_DISTANCE??40)-marginTiles;
  return Number.isFinite(tiles)&&tiles>0?tiles*tileSize(worldState):0;
}
export function nearbyActualCities(worldState,playerParty,cfg={}){
  if(!real(playerParty))return [];
  const radius=localWorldRadius(worldState,cfg);
  if(radius<=0)return [];
  return (Array.isArray(worldState?.settlements)?worldState.settlements:[])
    .filter(s=>s?.id!=null&&real(s)
      &&distance(s,playerParty)<=radius);
}
/** Pick an existing city. Only return null when the active region is empty. */
export function selectLocalCity(worldState,playerParty,cfg={},{
  factionId=null,excludeCityId=null,minDistanceTiles=0,
}={}){
  const local=nearbyActualCities(worldState,playerParty,cfg)
    .filter(s=>(excludeCityId==null||id(s.id)!==id(excludeCityId))
      &&(!factionId||cityOwner(s)===factionId));
  if(!local.length)return null;
  const min=Math.max(0,Number(minDistanceTiles)||0)*tileSize(worldState);
  const beyond=local.filter(s=>distance(s,playerParty)>=min);
  return select(beyond.length?beyond:local);
}

/**
 * Return only one ACTUALLY connected, canonical road. A fake or stale
 * trade route list cannot create a new road or source identity here.
 */
export function localRoadFromCity(worldState,home,playerParty,cfg={}){
  if(!real(home)||home?.id==null||!real(playerParty))return null;
  const radius=localWorldRadius(worldState,cfg);
  if(radius<=0)return null;
  const candidates=canonicalRoadLinks(worldState).flatMap(link=>{
    const start=id(link.fromCityId)===id(home.id);
    const end=id(link.toCityId)===id(home.id);
    if(!start&&!end)return [];
    const other=start?link.to:link.from;
    if(!real(other)||distance(other,playerParty)>radius)return [];
    const worldPoints=roadWorldWaypoints(worldState,link.road);
    if(worldPoints.length<2)return [];
    const path=start?worldPoints:[...worldPoints].reverse();
    return [{city:other,path,sourceCityId:home.id,roadId:link.id}];
  });
  return select(candidates);
}

/** Return a road waypoint from the AUTHENTIC map, not a straight-line guess. */
export function localBanditRouteAnchors(worldState,link,playerParty,cfg={}){
  if(!real(playerParty)||!link?.road)return [];
  const max=localWorldRadius(worldState,cfg);
  const preferredMin=8*tileSize(worldState);
  const pts=roadWorldWaypoints(worldState,link.road)
    .filter(p=>distance(p,playerParty)<=max);
  const safe=pts.filter(p=>distance(p,playerParty)>=preferredMin);
  return safe.length?safe:pts;
}
