/**
 * V1.35 — player-facing, strictly read-only market & convoy diagnostics.
 * All tab/filter/page/CSV operations use derived views, never game receipts.
 */
import {
  queryMarketCargoReportRows, marketCargoReportCsv,
} from '../systems/market-cargo-report.js';

const sections = [
  ['movements','Gerçek stok hareketleri'],
  ['stock','Pazar defterleri'],
  ['escorts','Canlı kervan dengesi'],
  ['dispositions','Haydut ganimeti akıbeti'],
];
const types = {
  movements: [
    ['modern_buy','Pazar alımı'], ['modern_sell','Pazar satışı'],
    ['legacy_buy','Şehir alımı'], ['legacy_sell','Şehir satışı'],
    ['day_drift','Günlük arz değişimi'],
    ['escort_reserved','Kervana ayrıldı'],
    ['escort_delivered','Kervan teslim etti'],
  ],
  stock: [
    ['conflict','Çelişen miktar'],['missing_market','İkinci defter eksik'],
    ['missing_city','Şehir defteri eksik'],
    ['invalid_quantity','Geçersiz miktar'],
    ['unknown_item','Bilinmeyen ürün'],
    ['duplicate_city_item','Tekrarlanan ürün'],
    ['orphan_market','Sahipsiz pazar'],
    ['duplicate_settlement','Tekrarlanan şehir'],
    ['equal','Eşit'],
  ],
  escorts: [['balanced','Dengeli'],['mismatch','Açıklanamayan fark']],
  dispositions: [
    ['player_recovered','Oyuncunun kazandığı'],
    ['guard_returned','Muhafızın geri aldığı'],
    ['unrecovered_loss','Geri alınamayan kayıp'],
    ['patrol_kill','Devriye temizliği'],
    ['out_of_range','Haydut uzaklaştı'],
    ['escort_guard_kill','Muhafız çarpışması'],
    ['player_victory_forfeited','Alınmadan bırakıldı'],
  ],
};
const names = {
  modern_buy:'Pazar alımı',modern_sell:'Pazar satışı',
  legacy_buy:'Şehir alımı',legacy_sell:'Şehir satışı',
  day_drift:'Günlük arz değişimi',
  escort_reserved:'Kervana ayrıldı',escort_delivered:'Kervan teslim etti',
  equal:'Eşit',conflict:'ÇATIŞMA',balanced:'Dengeli',mismatch:'FARK VAR',
  player_recovered:'Oyuncu kazandı',guard_returned:'Muhafız geri aldı',
  unrecovered_loss:'Geri alınamayan mal',
};
const safeText = value => String(value ?? '-');
function addOption(select, id, label) {
  const option = document.createElement('option');
  option.value = id; option.textContent = label;
  select.append(option);
}
function button(id,label,callback) {
  const element = document.createElement('button');
  element.type = 'button';element.id = id;element.textContent = label;
  element.style.cssText = 'padding:6px 9px;background:#314b52;color:#fff;'
    + 'border:1px solid #b8a076;border-radius:4px;cursor:pointer';
  element.addEventListener('click',callback);
  return element;
}

export default class CargoMarketReportPanel {
  constructor(game) {
    this.game = game;
    this.root = null;this.toggle = null;this.content = null;
    this.selectedCity = '';this.selectedSection = 'movements';
    this.selectedType = '';this.itemId = '';this.search = '';
    this.page = 1;this.pageSize = 20;
    this.lastReport = null;this._settlementsRef = null;
  }

  ensureRoot() {
    if (typeof document === 'undefined') return null;
    if (this.root) return this.root;
    const toggle = button('cargoMarketReportToggle','Mal Hareketleri',()=>{
      this.syncVisibility();
      if (this.root.style.display === 'none') {
        this.refresh();this.root.style.display = 'block';
      } else this.root.style.display = 'none';
    });
    toggle.style.cssText = 'position:fixed;left:12px;bottom:14px;z-index:19000;'
      + 'padding:8px 12px;background:#233b42;color:#fff;'
      + 'border:1px solid #b8a076;border-radius:6px;cursor:pointer;'
      + 'font:14px sans-serif;display:none';
    const panel = document.createElement('aside');
    panel.id = 'cargoMarketReportPanel';
    panel.setAttribute('aria-label','Pazar ve kervan mal hareketleri raporu');
    panel.style.cssText = 'position:fixed;left:12px;bottom:57px;z-index:19000;'
      + 'width:min(560px,calc(100vw - 24px));max-height:68vh;overflow:auto;'
      + 'padding:13px;background:#182a31;color:#f0e5d0;border:1px solid #b8a076;'
      + 'border-radius:7px;box-shadow:0 6px 24px #0008;'
      + 'font:13px/1.45 sans-serif;display:none';
    const heading=document.createElement('strong');
    heading.textContent='Pazar ve kervan muhasebesi';
    const note=document.createElement('p');
    note.textContent='Salt okunur. Olay günlüğü sadece bu oturumdan gelir '
      + '(en son 160 stok, 128 ganimet kaydı). '
      + 'Eski iki pazar defteri birleştirilmez. CSV yalnızca süzülmüş gözlemleri içerir.';
    note.style.margin='6px 0 10px';
    const controls=document.createElement('div');
    controls.style.cssText='display:flex;gap:7px;flex-wrap:wrap;align-items:center;'
      + 'margin:8px 0';
    const category=document.createElement('select');
    category.id='cargoMarketReportSection';
    category.setAttribute('aria-label','Rapor kategorisi');
    for(const [id,label] of sections)addOption(category,id,label);
    category.addEventListener('change',()=>{
      this.selectedSection=category.value;this.selectedType='';this.page=1;
      this.populateTypes();this.refresh();
    });
    this.category=category;
    const select=document.createElement('select');
    select.id='cargoMarketReportCity';
    select.setAttribute('aria-label','Şehir filtresi');
    select.style.maxWidth='235px';
    select.addEventListener('change',()=>{
      this.selectedCity=select.value;this.page=1;this.refresh();
    });
    this.filter=select;
    const type=document.createElement('select');
    type.id='cargoMarketReportType';
    type.setAttribute('aria-label','İşlem veya durum filtresi');
    type.addEventListener('change',()=>{
      this.selectedType=type.value;this.page=1;this.renderCached();
    });
    this.type=type;
    this.populateTypes();
    const item=document.createElement('input');
    item.id='cargoMarketReportItem';
    item.type='search';item.placeholder='Ürün ID (örn wheat)';
    item.setAttribute('aria-label','Ürün filtresi');
    item.style.cssText='min-width:115px;max-width:175px;padding:6px;'
      + 'background:#223d44;color:#fff;border:1px solid #b8a076;border-radius:4px';
    item.addEventListener('input',()=>{
      this.itemId=item.value;this.page=1;this.renderCached();
    });
    const search=document.createElement('input');
    search.id='cargoMarketReportSearch';
    search.type='search';search.placeholder='Şehir / rota / görev ara';
    search.setAttribute('aria-label','Metinle ara');
    search.style.cssText=item.style.cssText;
    search.addEventListener('input',()=>{
      this.search=search.value;this.page=1;this.renderCached();
    });
    controls.append(select,category,type,item,search);
    const navigation=document.createElement('div');
    navigation.style.cssText='display:flex;gap:7px;flex-wrap:wrap;align-items:center;'
      + 'margin:8px 0';
    const size=document.createElement('select');
    size.id='cargoMarketReportPageSize';size.setAttribute('aria-label','Sayfa başına kayıt');
    for(const n of [10,20,50])addOption(size,String(n),n+' / sayfa');
    size.value='20';
    size.addEventListener('change',()=>{
      this.pageSize=Number(size.value);this.page=1;this.renderCached();
    });
    const prev=button('cargoMarketReportPrev','Önceki',()=>{
      if(this.page>1){this.page--;this.renderCached();}
    });
    const next=button('cargoMarketReportNext','Sonraki',()=>{
      if(this.lastPage && this.page<this.lastPage){
        this.page++;this.renderCached();
      }
    });
    const pageInfo=document.createElement('span');
    pageInfo.id='cargoMarketReportPageInfo';
    pageInfo.setAttribute('role','status');
    const exportButton=button('cargoMarketReportCsv','CSV indir',()=>this.exportCsv());
    const refresh=button('cargoMarketReportRefresh','Yenile',()=>this.refresh());
    const close=button('cargoMarketReportClose','Kapat',()=>{
      panel.style.display='none';
    });
    navigation.append(size,prev,pageInfo,next,exportButton,refresh,close);
    const content=document.createElement('div');
    content.id='cargoMarketReportContent';
    panel.append(heading,note,controls,navigation,content);
    document.body.append(toggle,panel);
    this.root=panel;this.toggle=toggle;this.content=content;
    this.pageInfo=pageInfo;this.prev=prev;this.next=next;
    this.syncVisibility();
    return panel;
  }

  populateTypes() {
    if(!this.type)return;
    this.type.replaceChildren();
    addOption(this.type,'','Tüm işlem / durumlar');
    for(const [key,label] of types[this.selectedSection] || [])
      addOption(this.type,key,label);
    this.type.value=this.selectedType;
  }

  syncVisibility() {
    if(!this.toggle)return;
    const visible=this.game?.started
      && ['map','city'].includes(this.game?.state?.mode);
    this.toggle.style.display=visible?'block':'none';
    if(!visible && this.root) {
      this.root.style.display='none';
      this.lastReport=null; // no stale preview after a mode transition
    }
  }

  /**
   * Invalidate snapshots when a new campaign/save restore changes the
   * underlying world. Never reset trusted economy inventories from this UI.
   */
  invalidate() {
    this.lastReport=null;
    this._settlementsRef=null;
    if(this.root)this.root.style.display='none';
  }

  updateCityOptions(settlements) {
    if(this._settlementsRef===settlements)return;
    this._settlementsRef=settlements;
    this.filter.replaceChildren();
    addOption(this.filter,'','Tüm şehirler (genel)');
    const cities=[...settlements].filter(s=>s?.id!=null).sort((a,b)=>
      safeText(a.name||a.id).localeCompare(safeText(b.name||b.id),'tr'));
    for(const city of cities)addOption(this.filter,String(city.id),
      safeText(city.name||city.id)+' #'+city.id);
    if(![...this.filter.options].some(o=>o.value===this.selectedCity))
      this.selectedCity='';
    this.filter.value=this.selectedCity;
  }

  getQueryOptions() {
    return {section:this.selectedSection,itemId:this.itemId,
      type:this.selectedType,search:this.search,
      page:this.page,pageSize:this.pageSize};
  }

  refresh() {
    if(!this.ensureRoot())return null;
    const g=this.game;
    const settlements=Array.isArray(g?.state?.map?.settlements)
      ? g.state.map.settlements : [];
    this.updateCityOptions(settlements);
    // Only the requested category is scanned. Full 881-city stock audit
    // is deferred until the stock tab is opened or explicitly refreshed.
    this.lastReport=g?.economyManager?.buildCargoMarketReport?.(
      this.selectedCity||null,160,this.selectedSection) || null;
    return this.renderCached();
  }

  /**
   * Pure presentation path for typing, sorting by filters and paging:
   * no economy/world scan until explicit Refresh, city or tab selection.
   */
  renderCached() {
    const report=this.lastReport;
    if(!report || !this.content)return null;
    this.content.replaceChildren();
    const page=queryMarketCargoReportRows(report,this.getQueryOptions());
    this.page=page.page;this.lastPage=page.pageCount;
    this.prev.disabled=page.page<=1;this.next.disabled=page.page>=page.pageCount;
    this.pageInfo.textContent=' '+page.first+'–'+page.last+' / '+page.total
      +' (sayfa '+page.page+'/'+page.pageCount+') ';
    const add=(heading,text)=>{
      const section=document.createElement('section');
      section.style.cssText='border-top:1px solid #52676c;padding:9px 0';
      const title=document.createElement('strong');title.textContent=heading;
      const body=document.createElement('pre');
      body.style.cssText='white-space:pre-wrap;word-break:break-word;'
        + 'margin:5px 0 0;font:12px/1.5 monospace';
      body.textContent=text;
      section.append(title,body);
      this.content.append(section);
    };
    const counts=report.stockAudit.counts||{};
    add('Pazar defterleri (anlık)',
      report.stockAudit.scanned
        ? 'Şehir: '+report.stockAudit.settlementCount
          +' | Eşit: '+(counts.equal||0)
          +' | Çatışma: '+report.stockAudit.conflicts
          +' | Eksik / diğer: '+(report.stockAudit.unresolved
            -report.stockAudit.conflicts)
        : 'Detaylar yalnız Pazar defterleri sekmesinde hesaplanır.');
    add('Genel durum',
      'Gerçek stok hareketleri: '
        +(report.computedSections.movements ? report.movements.length
          +' (son 160 oturum kaydı)' : 'İşlemler sekmesinde')
      +'\nCanlı kervanlar: '
        +(report.computedSections.escorts ? report.escorts.length
          : 'Kervan sekmesinde')
      +'\nHaydut ganimet akıbeti: '
        +(report.computedSections.dispositions
          ? report.cargoDispositions.length : 'Ganimet sekmesinde')
      +'\nCSV: seçilen kategoriye ve filtreye uyan '
      +'bütün mevcut satırlar; sadece görünen sayfa değil.');
    const fmt=row=>{
      switch(page.section){
        case 'stock':
          return '#'+safeText(row.settlementId)+' '+safeText(row.itemId)
            +' | şehir '+safeText(row.cityQty)
            +' | pazar '+safeText(row.marketQty)
            +' | '+(names[row.status]||row.status);
        case 'movements':
          return 'G'+safeText(row.day)+' '+(names[row.kind]||row.kind)
            +' #'+safeText(row.settlementId)+' '+safeText(row.itemId)
            +': '+safeText(row.before)+' → '+safeText(row.after)
            +' ('+(row.delta>0?'+':'')+safeText(row.delta)+')'
            +(row.routeId?' ['+row.routeId+']':'')
            +' | '+(names[row.status]||row.status);
        case 'escorts':
          return safeText(row.questId)+' '+safeText(row.itemId)
            +' | ayrılan '+row.reserved+'; kervan '+row.inCaravan
            +'; haydut '+row.inBandits+'; oyuncu '+row.inPlayer
            +'; hedef '+row.atDestination+'; kayıp '+row.unrecovered
            +'; fark '+row.gap+' | '+(names[row.status]||row.status);
        default:
          return (names[row.kind]||row.kind)+' ('+row.reason+')'
            +' '+safeText(row.itemId)+' x'+row.qty
            +' | haydut '+safeText(row.banditId)
            +' | kaynak '+safeText(row.fromId)
            +' | görev '+safeText(row.questId);
      }
    };
    const sectionName=sections.find(x=>x[0]===page.section)?.[1]||page.section;
    add(sectionName+' — '+page.first+'–'+page.last+' / '+page.total,
      page.rows.length?page.rows.map(fmt).join('\n')
        :'Bu filtre için kayıt yok.');
    return report;
  }

  exportCsv() {
    if(!this.ensureRoot())return null;
    // Export EXACTLY the currently displayed snapshot. Do not trigger a
    // hidden rescan or mix a new day with the visible preview on download.
    const report=this.lastReport || this.refresh();
    if(!report)return null;
    const csv=marketCargoReportCsv(report,this.getQueryOptions());
    const filename='foc-mal-hareketleri-'
      +this.selectedSection+'-'
      +String(this.selectedCity||'tum').replace(/[^a-zA-Z0-9_-]/g,'_')
      +'.csv';
    const blob=new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=filename;
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),0);
    return csv;
  }
}
