# FallOfCavalry Web — 18 Kasım 2026 V2 Birleşik Geliştirme Planı

**Yetkili oyun ve repo:** https://github.com/zxc28tarik/FallOfCavalry
**Başlangıç main:** 1d48e49854385aed1a9aaf1ee12294173f5335b3
**Çerçeve:** Eski harita ve art dosyaları kullanıcı kararıyla silindi. Yeni dünya veri temeli ve özgün 2D görseller sıfırdan inşa edilecek. Unity masaüstü deposuna dokunulmaz.

## İçerik
- [01_MASTER_PLAN_V2.md](01_MASTER_PLAN_V2.md) — kapsam, teknik mimari, yeni dünya verisi, 18 iş hattı, QA, 1648 kararı, şehir V2, geçişler ve ayrıntılı icra sırası.
- [02_GOREV_TAKIP_V2.csv](02_GOREV_TAKIP_V2.csv) — **131 V2 koordinasyon paketi**, bağımlılık, durum, kaynak eşlemesi ve kullanıcı onayı alanları.
- [03_KARAR_RISK_VE_UYUM.md](03_KARAR_RISK_VE_UYUM.md) — kesin kararlar, kullanıcı onay kapıları, risk ve eski 215/72 görev uyumu.
- [04_KABUL_QA_KAPILARI.md](04_KABUL_QA_KAPILARI.md) — statik/CI/browser/performance/visual/historical data kalite kapıları.

**V2 görevleri, eski 215 görsel ve 72 genel geliştirme işine ilave bir 131 bağımsız iş yükü değildir.** Üst düzey yürütme paketleridir; eski atomik görev ağacı olduğu gibi korunur. Eski planın silinmiş 1648 world-map/BIN/PNG kaynakları varmış varsayımları geçersizdir.

**İlk icra:** K00 → K01, D00 **tam dünya kapsamı** karar kapısı, D01 **pilot bölgesiz doğrudan tam dünya veri üretimi ve QA**, G02 sanat kartı, G03 manifest/dummy **görsel entegrasyon** testi. Sonra G04 dünya zemini. Asker G14 **en son**.

**Kanıt:** source commit, CI, gerçek browser, screenshot, kullanıcı estetik kararı. Plan dosyasının varlığı işi tamamlamaz.

## İlk uygulama — tam dünya diagnostik envanteri
- `npm run audit:world` geçici prosedürel dünya **tamamını** tarar; bir dünya veri pilotu değildir.
- Rapor `output/reports/world-integrity.json` ve GitHub CI artifact olarak üretilir; mevcut 1648 atlasının varlığını iddia etmez.
- `K01-05` ve `Q00-03` uygulamada; **KABUL** için tarayıcıda doğrulama ve geçerli tüm-dünya veri setinde tekrar denetim gerekir.

## Gerçek tarayıcı başlangıç denetimi
- [06_BROWSER_WORLD_SMOKE_IMPLEMENTATION.md](06_BROWSER_WORLD_SMOKE_IMPLEMENTATION.md): Chromium ile Start→World, screenshot ve console/network raporu. Görevler henüz UYGULAMADA.
