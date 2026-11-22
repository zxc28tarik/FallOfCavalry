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

export const DISPUTE_CAUSES=Object.freeze({
  security:Object.freeze({
    title:'Mahalle Asayişi',desc:'Düşük güvenlik nedeniyle nöbet ve mahalle düzeni konusunda çekişme.',
    effects:{first:-2,second:-2,mediate:6},
  }),
  scarcity:Object.freeze({
    title:'Erzak Paylaşımı',desc:'Buğday stokları azaldı; esnafla idare erzak dağıtımında anlaşamıyor.',
    effects:{first:-1,second:-1,mediate:4},
  }),
  trade:Object.freeze({
    title:'Pazar İmtiyazı',desc:'Pazarın fiyat koşulları ve ticaret hakları yüzünden anlaşmazlık.',
    effects:{first:-2,second:-2,mediate:3},
  }),
  civic:Object.freeze({
    title:'Şehir Meclisi Kararları',desc:'Yerel ileri gelenler şehir idaresi konusunda görüş ayrılığı yaşıyor.',
    effects:{first:-1,second:-1,mediate:3},
  }),
});
export function getDisputeCause(city){
  if(!city||typeof city!=='object')return 'civic';
  const security=Number(city.security??50);
  if(Number.isFinite(security)&&security<40)return 'security';
  const grain=Array.isArray(city.marketStock)
    ? city.marketStock.find(x=>x?.id==='wheat'||x?.id==='food') : null;
  if(grain&&Number.isFinite(Number(grain.qty))&&Number(grain.qty)<10)return 'scarcity';
  const wheatPrice=Number(city.priceMultiplier?.wheat??city.priceMultiplier?.food??1);
  if(Number.isFinite(wheatPrice)&&wheatPrice>1.14)return 'trade';
  return 'civic';
}

export function getCityDispute({roster,cityId,day,city}={}){
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
  const cause=getDisputeCause(city);
  return {
    cityId,day,cause,causeTitle:DISPUTE_CAUSES[cause].title,
    causeDescription:DISPUTE_CAUSES[cause].desc,
    first:{id:first.id,name:first.name,role:first.role,satisfaction:first.satisfaction},
    second:{id:second.id,name:second.name,role:second.role,satisfaction:second.satisfaction},
    relation:prior?.value??0,
    resolved:wasResolved(first,day)||wasResolved(second,day),
  };
}

export function resolveCityDispute({roster,cityId,day,party,choice,city}={}){
  const rule=DISPUTE_CHOICES[choice];
  const dispute=getCityDispute({roster,cityId,day,city});
  if(!rule||!dispute||dispute.resolved||!party)
    return {ok:false,message:'Bu anlaşmazlık artık çözülemez.'};
  if(!Number.isFinite(party.gold)||party.gold<rule.cost)
    return {ok:false,message:'Uzlaşma için yeterli altın yok.'};
  const [first,second]=[dispute.first,dispute.second];
  const a=first.satisfaction+rule.first;
  const b=second.satisfaction+rule.second;
  const reason=`${REASON}${choice}:${dispute.cause}`;
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
  // Persist economic consequences only on a real validated issuing city.
  // Settlement market modifiers already use the canonical markets save path.
  let citySecurity=null;
  let wheatPrice=null;
  if(city&&String(city.id)===String(cityId)){
    const delta=DISPUTE_CAUSES[dispute.cause].effects[choice];
    const security=Number(city.security??50);
    if(Number.isFinite(security)){
      city.security=Math.max(0,Math.min(100,Math.floor(security+delta)));
      city.civicDirty=true;
      citySecurity=city.security;
    }
    if(dispute.cause==='scarcity'||dispute.cause==='trade'){
      if(!city.priceMultiplier||typeof city.priceMultiplier!=='object')city.priceMultiplier={};
      const previous=Number(city.priceMultiplier.wheat??1);
      if(Number.isFinite(previous)){
        const next=previous+(choice==='mediate'?-0.06:0.04);
        city.priceMultiplier.wheat=Math.max(0.8,Math.min(1.3,Math.round(next*100)/100));
        wheatPrice=city.priceMultiplier.wheat;
      }
    }
  }
  return {
    ok:true,choice,firstId:first.id,secondId:second.id,
    fromRelation:dispute.relation,toRelation:updatedRelation,
    cause:dispute.cause,citySecurity,wheatPrice,
    message:`Şehir anlaşmazlığı: ${DISPUTE_CHOICES[choice].label}. ${first.name}: ${rule.first>0?'+':''}${rule.first}, ${second.name}: ${rule.second>0?'+':''}${rule.second} memnuniyet. İlişki: ${updatedRelation}.`,
  };
}
