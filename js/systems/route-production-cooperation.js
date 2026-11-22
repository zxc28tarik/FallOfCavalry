/**
 * V1.65: An authenticated road-backed caravan carrying goods favored by the
 * source settlement's existing biome production profile.
 */
import * as CONST from '../constants.js';
import {canonicalRoadLinks} from './world-trade-road-topology.js';
import {getRegionalCooperation} from './regional-cooperation.js';

export function selectCooperationCaravan({map,party,roster,cityId,day}={}){
  if(!map||cityId==null||!Number.isSafeInteger(day))return null;
  const cooperation=getRegionalCooperation({party,roster,cityId,day});
  if(!cooperation||String(cooperation.sourceCityId)!==String(cityId))return null;
  const source=map.settlements?.find(s=>String(s.id)===String(cityId));
  const target=map.settlements?.find(s=>String(s.id)===String(cooperation.targetCityId));
  if(!source||!target||String(source.id)===String(target.id))return null;
  const road=canonicalRoadLinks(map).find(link=>
    [String(link.fromCityId),String(link.toCityId)].includes(String(source.id))
    &&[String(link.fromCityId),String(link.toCityId)].includes(String(target.id)));
  if(!road)return null;
  // Procedural world settlements usually have no per-city biome field.
  // Read the authoritative typed biome layer by the city's actual tile.
  const tx=Number(source.tx),ty=Number(source.ty),width=Number(map.width);
  const layer=map.biomes;
  const index=Number.isInteger(tx)&&Number.isInteger(ty)&&Number.isInteger(width)
    &&tx>=0&&ty>=0&&width>0&&tx<width&&ty<Number(map.height)
    ?ty*width+tx:-1;
  const stored=source.biome??source.biomeId
    ??(index>=0&&layer?.length===width*Number(map.height)?layer[index]:null);
  const biome=Number.isInteger(stored)
    ?Object.keys(CONST.BIOME).find(key=>CONST.BIOME[key]===stored)||''
    :String(stored||'').toUpperCase();
  const production=CONST.MARKET_BIOME_PRODUCTION?.[biome];
  if(!production)return null;
  const cargo=Object.entries(production)
    .filter(([id,amount])=>amount>0&&(CONST.TRADE_ITEMS||[]).some(item=>item.id===id)
      &&(source.marketStock||[]).some(stock=>stock.id===id&&Number(stock.qty)>=3))
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'en'))[0];
  if(!cargo)return null;
  return {
    source, target,routeId:road.id,sourceRecoveryId:cooperation.sourceRecoveryId,
    itemId:cargo[0],productionAmount:cargo[1],biome,
  };
}
