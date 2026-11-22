# WEB V1.69 — Kethüda hizmet yeterliliği ve gerçek inşaat ekonomisi

**Tarih:** 2026-11-23 · **Dal:** `codex/web-world-npc-roster-20261118` · **PR #68 (draft, unmerged)**.
V1.68 üzerine, var olan City V2 ve kanonik building catalogunu koruyarak.

## Neden bu iş?

V1.68 altyapı yatırımlarını oyuncu hazinesinden inşa/iyileştirme olarak açtı; ancak şehir nüfusuna göre hizmet türleri raporlanmıyor ve gerçek binaların yatırım maliyetine etkisi bulunmuyordu. Bu aşama görünmez Kethüda servislerini doğrudan oyuncunun kararına bağlar.

## Kullanılan veri/kurallar

- **Sadece onaylı 9 altyapı ID'si.** Kuyu/çeşme/sarnıç/su yolu, taş yol/ara yol/köprü, drenaj/kanalizasyon. Kethüda yine şehirde ayrı parsel, bina veya yeni NPC değildir.
- **Nüfus temelli üç ayrı kategori:** `water`: 6.000 kişi / kapasite birimi, `roads`: 10.000, `sanitation`: 16.000. Gereksinim `max(1,ceil(population/threshold))`. Kapasite = katalogda kurulu gerçek altyapı sayısı + yalnız kurulu olanlar için 0–2 arasında doğrulanmış geliştirme düzeyi. `coveragePct` 0–100; eksik = `max(0,need-capacity)`.
- **Kethüda altyapı proje erişimi:** Önceden mevcut olan şehre sahiplik, gün ve altın kapılarının yanına katalogdaki `minTier` ve `factions` uygunluğu eklendi. Böylece 1. seviye yerleşimde kanalizasyon, kültürel kaydı bulunmayan yapılar veya hayali foreign modüller otomatik açılmaz.
- **Gerçek inşaat nakliye tasarrufu:** Kanonik yol ID'lerindeki iyileştirme düzeyleri toplamı × %3 × yol hizmet kapsamı (0–1); üst sınır **%15**. İndirim taban bina `buildCostGold` değerinden bir kere aşağı yuvarlanır. `getKethudaConstructionQuote` aynı maliyeti hem gerçek `constructBuildingOnParcel` işleminde (yetki/ücret/sonuç), hem şehir inşa butonu ve alan menülerinde kullanır. İndirimin nakit etkisi, yalnız gerçek bina yapılıp oyun hazinesinden kesinti yapıldığında oluşur.
- **Proje inşaatı farklıdır:** Kethüda projelerinde yol indirimi uygulanmaz; bunlar kendi kaynak katalog maliyetiyle kalır. İnşaat avantajı yeni stok, ücretsiz hazine, yan ekonomi, nüfus büyümesi veya üretim yaratmaz. Var olan kent stok, kervan, şehir güvenliği ve meclis ekonomisi (V1.68) korunur.

## Geçici denge varsayımları

Nüfus eşikleri ve %3/%15 inşaat tasarruf katsayıları **ASSISTANT_FILLED / PROVISIONAL** değerlerdir; tarihî ölçüm, kullanıcının onayladığı nihai sayı veya tam City V2 ekonomi/üretim uygulaması değildir. Nihai oyun sırasında lojistik/bina üretim girdileri ile derinleştirilebilir. City-stock miktarları bu sürümde bağımsız olarak değiştirilmez; mimari gereği sahte üretim kurulmaz.

## Değişen dosyalar

- `js/systems/city-infrastructure-benefits.js` — doğrulanmış, salt-okunur hizmet kapsamı ve inşaat fiyat teklifleri.
- `js/systems/city-kethuda.js` — hizmet raporu, katalog/tier/faction izinleri.
- `js/systems/city-state.js` — gerçek inşaatta tek fiyat otoritesi; bonus uygulansa da authoritative yapılar aynı.
- `js/ui/city-services.js` — üç kapasite kartı, aynı indirimli fiyatla gerçek buton erişimi; güncel kethüda özeti.
- `tests/unit/city-kethuda-economics-v169.test.js` — nüfus ölçekleri, gerçek yapı fiyatı, kaydet/yükle, negatif/uyumsuz projeler, sahte iyileştirmeler.
- Önceki V1.68 testleri, fiyat + UI smoke + dünya bütünlüğü çapraz regresyon için çalıştırılır.

## Kabul

Aynı son kod commit'inde **Web validation**, **Web Chromium browser smoke** ve **Downloadable current single-HTML game** sonuçları ayrı ayrı PASS görülmeden READY ilan edilmeyecek. Dünya census'unun known warning'i ve skipped testler saklanmayacak. PR #68 taslak kalır; `main` ve Unity'ye merge yok.

## Bilinçli ertelenen kapsam

- Her altyapının mevsime göre fiziksel aşınması / sürekli bakım ücretleri için doğrulanmış şehir bütçe modeli henüz yok; oyuncu altınına izinsiz günlük borç eklenmez.
- Nüfusa bağlı gerçek tüketim / salgın / üretim çıktısı için ayrı kanonik demografi ve üretim zinciri gerekir. Bu aşamada `marketStock` veya `population` keyfi artmaz.
- Şehir çizimlerindeki görünür bina, iç kale ve estetik varlıklar değiştirilmez.
