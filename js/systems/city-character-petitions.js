/**
 * V1.53: Named citizens can make direct, role-specific petitions at their
 * real settlement. A response is limited to once per person per day and
 * uses the existing character state/history and player treasury.
 */
import {getSettlementCharacters} from './world-characters.js';
import {changeNamedCharacterMetric} from './named-character-state.js';

export const PETITION_BY_ROLE=Object.freeze({
  artisan:Object.freeze({title:'Lonca tezgâhlarına yardım',description:'Mahalle ustaları için malzeme ve çalışma alanı desteği.',cost:55,gain:7}),
  merchant:Object.freeze({title:'Ticaret yolları için kefalet',description:'Tüccarların kervan hazırlığına küçük bir katkı.',cost:80,gain:8}),
  administrator:Object.freeze({title:'Şehir kaleminin masrafları',description:'Kâtiplerin defter ve mühür ihtiyaçlarını karşıla.',cost:65,gain:6}),
  commander:Object.freeze({title:'Garnizon erzak desteği',description:'Nöbetçilerin küçük ikmal giderlerini üstlen.',cost:90,gain:7}),
  traveler:Object.freeze({title:'Yolcu hanına katkı',description:'Yolcular için barınma ve erzak desteği sağla.',cost:40,gain:7}),
  scholar:Object.freeze({title:'Medrese kitap desteği',description:'Bilginlerin kitap ve kâğıt ihtiyacına yardım et.',cost:70,gain:8}),
});
const REASON='Şehir dilekçesi:';
const sameDay=(person,day)=>Array.isArray(person?.history)
  &&person.history.some(e=>e?.day===day&&e?.type==='state-changed'
    &&e?.metric==='satisfaction'&&String(e?.reason||'').startsWith(REASON));

export function getCharacterPetition({roster,cityId,characterId,day}={}){
  if(cityId==null||typeof characterId!=='string'
    ||!Number.isSafeInteger(day)||day<1)return null;
  const person=getSettlementCharacters(roster,cityId)
    .find(p=>p.id===characterId&&p.kind==='named'&&p.status==='alive');
  const rule=person&&PETITION_BY_ROLE[person.role];
  if(!rule||!Number.isSafeInteger(person.satisfaction))return null;
  return {
    characterId,cityId,day,role:person.role,name:person.name,
    ...rule,
    answered:sameDay(person,day),
    supportAvailable:person.satisfaction<100,
    declineAvailable:person.satisfaction>0,
  };
}

export function answerCharacterPetition({
  roster,cityId,characterId,day,party,decision,
}={}){
  const petition=getCharacterPetition({roster,cityId,characterId,day});
  if(!petition||!party||petition.answered||!['support','decline'].includes(decision))
    return {ok:false,message:'Bu dilekçe şu anda yanıtlanamaz.'};
  const person=getSettlementCharacters(roster,cityId).find(p=>p.id===characterId);
  const old=person.satisfaction;
  if(decision==='support'){
    if(!petition.supportAvailable)return {ok:false,message:'Karakter zaten tamamen memnun.'};
    if(!Number.isFinite(party.gold)||party.gold<petition.cost)
      return {ok:false,message:'Dilekçe için yeterli altın yok.'};
  }else if(!petition.declineAvailable){
    return {ok:false,message:'Karakterin memnuniyeti zaten en düşük düzeyde.'};
  }
  const next=Math.max(0,Math.min(100,old+(decision==='support'?petition.gain:-5)));
  const changed=changeNamedCharacterMetric(roster,characterId,{
    metric:'satisfaction',value:next,day,
    reason:`${REASON} ${decision==='support'?'desteklendi':'reddedildi'}`,
  });
  if(!changed)return {ok:false,message:'Karakter durumu değiştirilemedi.'};
  if(decision==='support')party.gold=Math.floor(party.gold-petition.cost);
  return {ok:true,decision,characterId,from:old,to:next,
    message:decision==='support'
      ?`${person.name} dilekçesi desteklendi: -${petition.cost} altın, memnuniyet +${next-old}.`
      :`${person.name} dilekçesi reddedildi: memnuniyet ${next-old}.`};
}
