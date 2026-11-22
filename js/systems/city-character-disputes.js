/**
 * WEB V1.55 — a council dispute between two existing named citizens.
 * The game does not invent offices, organizations, family ties or NPCs.
 * This is a limited explicit dispute scenario, not an inferred social network.
 */
import {getSettlementCharacters,setWorldCharacterRelation} from './world-characters.js';
import {changeNamedCharacterMetric} from './named-character-state.js';

export const DISPUTE_CHOICES=Object.freeze({
  first:Object.freeze({label:'İlk kişiyi destekle',first:6,second:-6,relation:-8,cost:0}),
  second:Object.freeze({label:'İkinci kişiyi destekle',first:-6,second:6,relation:-8,cost:0}),
  mediate:Object.freeze({label:'Uzlaşma masrafını karşıla',first:3,second:3,relation:12,cost:60}),
});
const REASON='Şehir ihtilafı: ';
const lastDay=person=>Array.isArray(person?.history)&&person.history.length
  ? Number(person.history[person.history.length-1]?.day||0):0;
const wasResolved=(person,day)=>Array.isArray(person?.history)
  &&person.history.some(h=>h.day===day&&h.type==='state-changed'
    &&h.metric==='satisfaction'&&String(h.reason||'').startsWith(REASON));

export function getCityDispute({roster,cityId,day}={}){
  if(cityId==null||!Number.isSafeInteger(day)||day<1)return null;
  const people=getSettlementCharacters(roster,cityId)
    .filter(p=>p.kind==='named'&&p.status==='alive'&&Number.isSafeInteger(p.satisfaction)
      &&p.satisfaction>=10&&p.satisfaction<=90
      &&lastDay(p)<=day)
    .sort((a,b)=>a.id.localeCompare(b.id,'en'));
  if(people.length<2)return null;
  const [first,second]=people;
  const prior=(roster.relations||[]).find(rel=>
    [rel.firstId,rel.secondId].includes(first.id)
    &&[rel.firstId,rel.secondId].includes(second.id));
  return {
    cityId,day,
    first:{id:first.id,name:first.name,role:first.role,satisfaction:first.satisfaction},
    second:{id:second.id,name:second.name,role:second.role,satisfaction:second.satisfaction},
    relation:prior?.value??0,
    resolved:wasResolved(first,day)||wasResolved(second,day),
  };
}

export function resolveCityDispute({roster,cityId,day,party,choice}={}){
  const rule=DISPUTE_CHOICES[choice];
  const dispute=getCityDispute({roster,cityId,day});
  if(!rule||!dispute||dispute.resolved||!party)
    return {ok:false,message:'Bu anlaşmazlık artık çözülemez.'};
  if(!Number.isFinite(party.gold)||party.gold<rule.cost)
    return {ok:false,message:'Uzlaşma için yeterli altın yok.'};
  const [first,second]=[dispute.first,dispute.second];
  const a=first.satisfaction+rule.first;
  const b=second.satisfaction+rule.second;
  const reason=`${REASON}${choice}`;
  // Existing NamedCharacterState validates identity, day and authorized metric.
  const changedFirst=changeNamedCharacterMetric(roster,first.id,{
    metric:'satisfaction',value:a,day,reason,
  });
  if(!changedFirst)return {ok:false,message:'İlk karakterin durumu değiştirilemedi.'};
  const changedSecond=changeNamedCharacterMetric(roster,second.id,{
    metric:'satisfaction',value:b,day,reason,
  });
  if(!changedSecond){
    // Leave a detectable marker, but do not take gold or change relations.
    return {ok:false,message:'İkinci karakterin durumu değiştirilemedi.'};
  }
  const updatedRelation=Math.max(-100,Math.min(100,dispute.relation+rule.relation));
  setWorldCharacterRelation(roster,first.id,second.id,updatedRelation);
  party.gold=Math.floor(party.gold-rule.cost);
  return {
    ok:true,choice,firstId:first.id,secondId:second.id,
    fromRelation:dispute.relation,toRelation:updatedRelation,
    message:`Şehir anlaşmazlığı: ${DISPUTE_CHOICES[choice].label}. ${first.name}: ${rule.first>0?'+':''}${rule.first}, ${second.name}: ${rule.second>0?'+':''}${rule.second} memnuniyet. İlişki: ${updatedRelation}.`,
  };
}
