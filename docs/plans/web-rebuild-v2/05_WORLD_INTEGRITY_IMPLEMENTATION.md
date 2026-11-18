# WEB V2 — İlk uygulama: dünya veri denetleyicisi

**Başlangıç commit:** `51769ebdf198c111026e3290883335a96f41c065`. **İş:** K01-05 + Q00-03, ayrıca gelecekte D01-07 kabulüne teknik altyapı.
**Kullanıcı kuralı:** İlk dünya veri pilotu olmayacak. Bu denetleyici yeni dünya **üretmez**, mevcut geçici prosedürel dünyanın **tamamını** tarar.

## İşlenen kod
- `scripts/audit-world-integrity.mjs` — 1068×714 geçici prosedürel dünyanın tüm hücrelerini (boyutu değişirse mevcut tam boyutu) sayaç/fingerprint ile okur.
- Kontrol edilen katmanlar: terrain, heightMap, flags, owner, fog ve mevcutsa biomes/politicalOwnerMap.
- Saha kayıtları: settlement id/owner/tier, duplicate id, roads source/target ve polyline, rivers, crossings, out-of-bounds ve political owner coverage.
- `tests/unit/world-integrity-audit.test.js` — elle oluşturulmuş **sentetik test nesnesi** ile denetleyici testleri; bu örnek dünya veri *pilotu* değildir, sadece birim test fixtürüdür.
- `npm run audit:world` — JSON raporunu **Git tarafından ignore edilen** `output/reports/world-integrity.json` altında çıkarır.
- `.github/workflows/web-validation.yml` — tam dünya veri taraması ve raporun 14 günlük GitHub artifact olarak saklanması.

## Başarı ve eksikler
- Denetleyici dünya kapsamını genişletmez; kullanıcı onaylı yeni tarihsel dünya veya grafik üretmez.
- `--strict` seçeneği sert veri bütünlüğü ihlallerini başarısız kodla bildirir. Varsayılan CI komutu ilk devreye alımda raporu toplamaya odaklanır ve `NEEDS_REPAIR` sonucunu **yanlış biçimde PASS olarak yorumlamamak gerekir**.
- Görev defterindeki `K01-05` ve `Q00-03` durumu `UYGULAMADA`; yalnız CI sonucu ve rapor bulguları kaydedildikten sonra ilerler.
- Bu ilk adım **gerçek tarayıcı smoke testi, yeni tam 1648 atlası, yeni görseller, save migration veya GameFlow doğrulaması değildir**. Bunlar ayrı V2 görevleridir.

## Doğrulama
PR CI çalışması ile kaynak lint, Vitest, Vite build ve `world-integrity-report` artifact kontrol edilir. Bulunan eksikler ayrı hata kaydı ve düzeltilmiş testle kapatılır. Artifaktın tek başına üretilmesi D01 tam dünya kabulü değildir.
