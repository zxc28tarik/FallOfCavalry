# FOC Web — GitHub kaynak deposu temizliği (17 Kasım 2026)

**Kapsam:** Sadece `zxc28tarik/FallOfCavalry` web deposu. Unity reposuna dokunulmaz.  
**Denetlenen web HEAD:** `e66957ec72f5f870419d25a8528cf2e358483042`.  
**İş türü:** Takip edilen geçici dosyaları kaldırma, benzersiz kaynakları koruma, çalıştırma komut yolunu düzeltme, yeni dosyaların yeniden eklenmesini engelleme.

## Neden gerekli?
Temizlik öncesi ana dalda **2.448 takip edilen dosya** vardı. Geçici çıktı, test ekranı, önbellek ve eski araç denemeleri kod dışı **2.044 dosya, 293.997.254 bayt** kaplıyordu. Bu sayı Git ağacının blob size toplamıdır; clone geçmişi ve sıkıştırma maliyetiyle birebir aynı değildir.

## Gerçek silme listesi
| Dizinin eski adı | Silinen dosya | Yaklaşık MB | İçerik |
|---|---:|---:|---|
| `output/` | 238 | 256.24 | Eski ekran görüntüleri, dev smoke ve analitik çıktıları |
| `tmp/` | 1.798 | 37.66 | Geçici kaynak parçaları, deney betikleri, loglar, güçlü kale extraction |
| `.vite/` | 3 | 0.00 | Vite/Vitest yerel önbelleği |
| `screenshots/` | 4 | 0.06 | Geçici test ekranları ve placeholder |
| `tools/__pycache__/` | 1 | 0.04 | Python derleme önbelleği |
| **TOPLAM** | **2.044** | **294.00** | |

Silinmiş dosyalar ana daldaki yeni Git çalışma ağacında bulunmaz, **ancak önceki commit'te tam geri alınabilirler**: https://github.com/zxc28tarik/FallOfCavalry/tree/e66957ec72f5f870419d25a8528cf2e358483042

## Özellikle KORUNAN üç kaynak
1. `tmp/incoming/fort-user-raw.png` → `reference/legacy/fort-user-raw.png`: muhtemel kullanıcı ham kale kaynak görseli, üretime otomatik dahil edilmez. Başlangıç blob: `733b16dde2ad08efdea348ca7b605ce0019f071b`.
2. `tmp/web_game_playwright_client.mjs` → `tools/web_game_playwright_client.mjs`: `npm run validate:smoke` tarafından çağrılan araç; `package.json` yolu güncellendi. Başlangıç blob: `ffed8ec7dad4eaa32ea180c7fd87370db64a4e9c`.
3. `output/text/osmanli-ana-sehir-sahnesi-bolgeleme-belgesi.txt` → `docs/archive/osmanli-ana-sehir-sahnesi-bolgeleme-belgesi.txt`: tarihi plan/kapsam bilgisi. Başlangıç blob: `61691a52e119444364e2fd128560fdc8716def81`.

## Yeniden dolmasını engelleme
- `.gitignore`: `output/`, `tmp/`, `.vite/`, `screenshots/`, Python cache, `*.log`, `*.err`, `*.pid` engeller.
- `scripts/check-repository-hygiene.mjs`: `git ls-files` üzerinden yasaklı takip dosyalarını kontrol eder; `validate:static` aşamasına bağlandı.
- `AGENTS.md`: yeni çalışma protokolü. İnsan kaynaklı ham görseller silinmeden önce korunur; aktif oyun asset'leri gözü kapalı temizlenmez.

## Bilerek SİLİNMEYENLER / açık riskler
- `assets/`, `js/`, `tests/`, `scripts/` içinde çalışan veya kullanım olasılığı bulunan içerikler (özellikle `js/data/homm3-map-art.json`, dünya haritası binary'leri, aktif settlement PNG'leri): hiçbiri bu safhada silinmez.
- `assets/settlements/stronghold/`, `assets/stronghold/world/`, eski alternatif sprite setleri: telif, kaynak ve aktif kullanım ayrıştırması yapılmadan silinmez.
- Web deposundaki yanlış yerde kalan `codex/impl-0` ... `codex/impl-8` Unity branch'leri: ayrı Unity deposunda SHA'ları eşleşiyor. Branch silme aracı bu bağlantıda bulunmadığı için **silinmedi**. Açık PR referansları da ayrıca kontrol edilmelidir.
- Açık web PR #28, #29, #30: eşdeğer özellikler geliştirilmiş görünse de **henüz kapatılmadı**; kullanıcının izni olmadan PR kapatılmadı.
- `validate:smoke` betiği artık doğru yerde, fakat `playwright` `package.json` bağımlılığı değildir ve betik çalıştırıldığında ayrıca kullanıcı eylemi argümanı ister. Bu ilk geçişte mevcut smoke testin gerçekten başarılı olduğu iddia edilmez.

## Doğrulama / Kabul
1. Yeni HEAD ağacında `output/`, `tmp/`, `screenshots/`, `.vite/`, `tools/__pycache__/` bulunmaz.
2. Üç benzersiz dosyanın taşınan yollarında eski blob SHA'ları aynıdır.
3. `package.json` geçerli JSON ve `validate:smoke` `tools/` yolunu kullanır.
4. `scripts/check-repository-hygiene.mjs` Git checkout'unda başarı verir.
5. `js/`, `assets/`, `tests/` çalışma dosyaları değişmemiştir. CI/birim/build çalıştırılmadan bunların testleri geçtiği iddia edilmez.

**Not:** Git geçmişi eski blob'ları sakladığı için `main` çalışma ağacı belirgin küçülse bile GitHub deposunun toplam geçmiş boyutu otomatik olarak aynı oranda küçülmeyebilir. Geçmişi yeniden yazmak bu işlem kapsamı dışındadır.
