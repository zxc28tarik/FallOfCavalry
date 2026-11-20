/**
 * V1.34 - optional read-only market / convoy audit panel.
 * No inputs in this panel trigger trade, quest progress, save or recovery.
 */
const safeText = value => String(value ?? '-');
const statuses = {
  equal: 'Eşit', conflict: 'ÇATIŞMA',
  missing_city: 'Şehir defteri eksik',
  missing_market: 'İkinci pazar defteri yok',
  invalid_quantity: 'Geçersiz miktar',
  unknown_item: 'Bilinmeyen ürün',
  duplicate_city_item: 'Tekrarlanan ürün',
};
const kinds = {
  legacy_buy: 'Şehir alımı', legacy_sell: 'Şehir satışı',
  modern_buy: 'Pazar alımı', modern_sell: 'Pazar satışı',
  day_drift: 'Günlük arz değişimi',
  escort_reserved: 'Kervana ayrıldı',
  escort_delivered: 'Kervan teslim etti',
};
const cargoReasons = {
  guard_returned: 'Muhafız kervana geri aldı',
  player_recovered: 'Oyuncu kazandı',
  unrecovered_loss: 'Geri alınamayan kayıp',
};

export default class CargoMarketReportPanel {
  constructor(game) {
    this.game = game;
    this.toggle = null;
    this.root = null;
    this.filter = null;
    this.content = null;
    this.selectedCity = '';
  }

  ensureRoot() {
    if (typeof document === 'undefined') return null;
    if (this.root) return this.root;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'cargoMarketReportToggle';
    toggle.textContent = 'Mal Hareketleri';
    toggle.style.cssText = 'position:fixed;left:12px;bottom:14px;z-index:19000;'
      + 'padding:8px 12px;background:#233b42;color:#fff;border:1px solid #b8a076;'
      + 'border-radius:6px;cursor:pointer;font:14px sans-serif;display:none';
    const panel = document.createElement('aside');
    panel.id = 'cargoMarketReportPanel';
    panel.setAttribute('aria-label', 'Pazar ve kervan mal hareketleri raporu');
    panel.style.cssText = 'position:fixed;left:12px;bottom:57px;z-index:19000;'
      + 'width:min(520px,calc(100vw - 24px));max-height:65vh;overflow:auto;'
      + 'padding:13px;background:#182a31;color:#f0e5d0;border:1px solid #b8a076;'
      + 'border-radius:7px;box-shadow:0 6px 24px #0008;'
      + 'font:13px/1.45 sans-serif;display:none';
    const heading = document.createElement('strong');
    heading.textContent = 'Pazar ve kervan muhasebesi';
    const note = document.createElement('p');
    note.textContent = 'Salt okunur. İşlemler ve ganimet kayıtları yalnız bu oturumda tutulur. '
      + 'İki pazar defteri çelişiyorsa hiçbir miktar otomatik düzeltilmez.';
    note.style.margin = '6px 0 10px';
    const controlRow = document.createElement('div');
    controlRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:8px 0';
    const select = document.createElement('select');
    select.id = 'cargoMarketReportCity';
    select.setAttribute('aria-label', 'Şehir filtresi');
    select.style.cssText = 'background:#223d44;color:#fff;min-width:170px;max-width:300px;'
      + 'padding:6px;border:1px solid #b8a076;border-radius:4px;flex:1';
    select.addEventListener('change', () => {
      this.selectedCity = select.value;
      this.refresh();
    });
    const button = (id, label, callback) => {
      const element = document.createElement('button');
      element.type = 'button'; element.id = id; element.textContent = label;
      element.style.cssText = 'padding:6px 9px;background:#314b52;color:#fff;'
        + 'border:1px solid #b8a076;border-radius:4px;cursor:pointer';
      element.addEventListener('click', callback);
      return element;
    };
    const refresh = button('cargoMarketReportRefresh', 'Yenile', () => this.refresh());
    const close = button('cargoMarketReportClose', 'Kapat', () => {
      panel.style.display = 'none';
    });
    controlRow.append(select, refresh, close);
    const content = document.createElement('div');
    content.id = 'cargoMarketReportContent';
    panel.append(heading, note, controlRow, content);
    toggle.addEventListener('click', () => {
      this.syncVisibility();
      if (panel.style.display === 'none') {
        this.refresh();
        panel.style.display = 'block';
      } else panel.style.display = 'none';
    });
    document.body.append(toggle, panel);
    this.root = panel;
    this.toggle = toggle;
    this.filter = select;
    this.content = content;
    this.syncVisibility();
    return panel;
  }

  syncVisibility() {
    if (!this.toggle) return;
    const visible = this.game?.started
      && ['map', 'city'].includes(this.game?.state?.mode);
    this.toggle.style.display = visible ? 'block' : 'none';
    if (!visible && this.root) this.root.style.display = 'none';
  }

  refresh() {
    if (!this.ensureRoot()) return null;
    const g = this.game;
    const settlements = Array.isArray(g?.state?.map?.settlements)
      ? g.state.map.settlements : [];
    const existingId = this.selectedCity;
    this.filter.replaceChildren();
    const all = document.createElement('option');
    all.value = ''; all.textContent = 'Tüm şehirler (genel)';
    this.filter.append(all);
    for (const city of [...settlements].filter(s => s?.id != null)
      .sort((a,b) => safeText(a.name || a.id).localeCompare(
        safeText(b.name || b.id), 'tr'))) {
      const opt = document.createElement('option');
      opt.value = String(city.id);
      opt.textContent = safeText(city.name || city.id) + ' #' + city.id;
      this.filter.append(opt);
    }
    this.selectedCity = existingId && [...this.filter.options].some(o =>
      o.value === existingId) ? existingId : '';
    this.filter.value = this.selectedCity;
    const report = g?.economyManager?.buildCargoMarketReport?.(
      this.selectedCity || null, 24);
    this.content.replaceChildren();
    if (!report) return null;
    const add = (heading, text) => {
      const section = document.createElement('section');
      section.style.cssText = 'border-top:1px solid #52676c;padding:9px 0';
      const title = document.createElement('strong');
      title.textContent = heading;
      const body = document.createElement('pre');
      body.style.cssText = 'white-space:pre-wrap;word-break:break-word;'
        + 'margin:5px 0 0;font:12px/1.5 monospace';
      body.textContent = text;
      section.append(title, body);
      this.content.append(section);
    };
    const counts = report.stockAudit.counts || {};
    add('Pazar defterleri (anlık)', [
      'Şehir sayısı: ' + report.stockAudit.settlementCount,
      'Eşit satırlar: ' + (counts.equal || 0),
      'Çakışan miktarlar: ' + report.stockAudit.conflicts,
      'Diğer eksik/uyumsuz: ' + (report.stockAudit.unresolved
        - report.stockAudit.conflicts),
      ...report.stockAudit.rows.filter(row => row.status !== 'equal')
        .slice(0,12).map(row => `${safeText(row.itemId)}: şehir ${safeText(row.cityQty)}, `
          + `pazar ${safeText(row.marketQty)} — ${statuses[row.status] || row.status}`),
    ].join('\n'));
    add('Gerçek stok hareketleri (son 24)', report.movements.length
      ? [...report.movements].reverse().map(row =>
        `G${row.day} ${kinds[row.kind] || row.kind} #${row.settlementId} `
        + `${row.itemId}: ${row.before} → ${row.after} (${row.delta > 0 ? '+' : ''}${row.delta}); `
        + `${statuses[row.status] || row.status}`
        + (row.routeId ? ` [${row.routeId}]` : '')).join('\n')
      : 'Bu oturumda gözlemlenmiş işlem yok.');
    add('Canlı kervanların ürün dengesi', report.escorts.length
      ? report.escorts.slice(0,8).map(e => `${e.questId}: `
        + `${e.accounted}/${e.reserved}, fark ${e.gap} — ${e.status}`
        + '\n' + e.rows.map(x => `  ${x.id}: kervan ${x.inCaravan}, `
          + `haydut ${x.inBandits}, oyuncu ${x.inPlayer}, `
          + `hedef ${x.atDestination}, kayıp ${x.unrecovered}, fark ${x.gap}`)
          .join('\n')).join('\n')
      : 'Aktif, kaynaklı kervan raporu yok.');
    add('Gerçek haydut ganimet akıbeti (son 24)', report.cargoDispositions.length
      ? [...report.cargoDispositions].reverse().map(e =>
        `${cargoReasons[e.kind] || e.kind} (${e.reason}), `
        + `haydut ${e.banditId}, yol ${e.routeId}: `
        + e.goods.map(x => `${x.id} x${x.qty}`).join(', ')).join('\n')
      : 'Bu oturumda doğrulanmış ganimet hareketi yok.');
    return report;
  }
}
