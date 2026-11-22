/**
 * WEB V1.50 — settlement civic decisions. Cost and outcome are applied
 * atomically, once per settlement per campaign day, with no NPC spawn.
 * The canonical city and player-party objects are the only beneficiaries.
 */
import {getCityAccordLegacy,getLegacyCivicImpact} from './city-accord-legacy.js';

export const CIVIC_DECISIONS=Object.freeze({
  patrol:{label:'Mahalle Nöbeti',cost:120,security:8,renown:1,
    desc:'Devriye ve mahalle bekçilerini destekle. Güvenliği artırır.'},
  granary:{label:'İmarete Erzak',cost:90,security:4,renown:2,
    desc:'Aşevi ve ambar için erzak fonu ayır. Huzuru ve itibarı artırır.'},
  levy:{label:'Olağanüstü Vergi',cost:-75,security:-9,renown:-2,
    desc:'Hazineden para kazan, fakat halkın güvenliğini ve itibarını zedele.'},
});

export function getCivicDecisionAvailability(city,party,day){
  if(!city||city.id==null||!party)return {available:false,reason:'Geçerli şehir veya oyuncu bulunamadı.'};
  const today=Math.max(1,Math.floor(Number(day)||1));
  const last=Math.floor(Number(city.civicDecision?.day)||0);
  if(last>=today)return {available:false,reason:'Bugünkü şehir kararı zaten alındı.'};
  return {available:true,reason:null};
}

export function getEffectiveCivicDecision({city,party,roster,day,decisionId}={}){
  const base=CIVIC_DECISIONS[decisionId];
  if(!base)return null;
  const legacy=getCityAccordLegacy({party,roster,cityId:city?.id,day:Math.max(1,Math.floor(Number(day)||1))});
  const {goldDiscount,securityPenalty}=getLegacyCivicImpact(legacy,decisionId);
  return {...base,cost:base.cost-goldDiscount,
    security:base.security-securityPenalty,legacy,discount:goldDiscount,penalty:securityPenalty};
}

export function applyCivicDecision({city,party,roster,day,decisionId}={}){
  const definition=getEffectiveCivicDecision({city,party,roster,day,decisionId});
  if(!definition)return {ok:false,message:'Bilinmeyen şehir kararı.'};
  const gate=getCivicDecisionAvailability(city,party,day);
  if(!gate.available)return {ok:false,message:gate.reason};
  const gold=Number(party.gold);
  if(!Number.isFinite(gold)||gold<Math.max(0,definition.cost))
    return {ok:false,message:'Hazinende yeterli altın yok.'};
  const security=Number(city.security??50);
  if(!Number.isFinite(security))return {ok:false,message:'Şehir güvenliği geçersiz.'};
  const today=Math.max(1,Math.floor(Number(day)||1));
  const newSecurity=Math.max(0,Math.min(100,Math.floor(security+definition.security)));
  party.gold=Math.floor(gold-definition.cost);
  party.renown=Math.max(0,Math.floor(Number(party.renown??0)+definition.renown));
  city.security=newSecurity;
  city.civicDirty=true;
  city.civicDecision={day:today,id:decisionId};
  return {
    ok:true,
    message:`${definition.label}: şehir güvenliği ${newSecurity}/100, altın ${definition.cost>0?'-':'+'}${Math.abs(definition.cost)}.`,
    cityId:city.id,decisionId,security:newSecurity,gold:party.gold,
    legacyApplied:Boolean(definition.legacy),discount:definition.discount,penalty:definition.penalty,
  };
}
