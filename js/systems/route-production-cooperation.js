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
  const biome=String(source.biome||source.biomeId||'').toUpperCase();
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
