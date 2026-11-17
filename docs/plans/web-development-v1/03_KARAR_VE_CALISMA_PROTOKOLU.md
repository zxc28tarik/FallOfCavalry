# FOC WEB — KARAR DEFTERİ VE AGENT ÇALIŞMA SÖZLEŞMESİ V1

**Aktif kaynak:** `zxc28tarik/FallOfCavalry` (`main` başlangıç HEAD: `f377c72`)  
**Kapsam dışı:** `zxc28tarik/FallOfCavalry-Unity`  
**Etiket açıklaması:** `USER_DECIDED` kullanıcı açıkça seçti; `PROPOSED` kullanıcı onayı bekleniyor; `PENDING` soru açık; `SUPERSEDED` sonraki kararla geçersiz.

| ID | Karar | Durum | Uygulama etkisi |
|---|---|---|---|
| DEC-001 | Web ve Unity farklı ürün/geliştirme hatları | USER_DECIDED | Unity repo ve içerikleri otomatik karışmaz |
| DEC-002 | Yeni çizim/sprite/grafik polish çalışmaları ertelendi | USER_DECIDED | Tasarım/renderer kodu yapılabilir; yeni sanat üretimi yok |
| DEC-003 | Önce hasar analizi ve master plan hazırlanacak | USER_DECIDED | Kod/depo mutasyonu yapılmaz |
| DEC-004 | Canvas mevcut live motor; Phaser yalnız deneysel ve parity sonrası değerlendirilecek | PROPOSED | Toggle default değişmez; yeni entegrasyon önce test edilir |
| DEC-005 | Tarayıcı birincil ürün; masaüstü wrapper ayrı seçenek | PROPOSED | Web stack korunur |
| DEC-006 | Korumalı küçük PR, reproducible CI, test fail durumunda durma | PROPOSED | Her paket için gate |
| DEC-007 | Quest/Contracts aynı gameplay event omurgasını paylaşacak | PROPOSED | Duplicate ödül ve save kopukluğu engellenir |
| DEC-008 | Mevcut ana mimariyi koru, toptan yeniden yazma ancak kanıtla | PROPOSED | Uyumlu refactor |
| DEC-009 | Unity dalları web main'e merge edilmez; açık PR'ler önce diff audit | PROPOSED | Çakışma riski azalır |
| DEC-010 | Save şeması değişiminde migration ve eski save testleri zorunlu | PROPOSED | Oyuncu kampanyası kaybolmaz |
| DEC-011 | Ekonomi gerçek stok/kaynak kuralları ile ilerleyecek | PROPOSED | Negatif stok, iki kez ödül yasak |
| DEC-012 | Grafik fazında lisans doğrulaması zorunlu, yayın kapısı ayrı | PROPOSED | Asset riskleri görünür kalır |

## Agent için açılış protokolü

1. Kullanıcının bu oturumdaki en yeni kararları ve `01_MASTER_PLAN.md` okunur; oyun üzerinde kod değişikliği için açık talimat beklenir.
2. İşlemlerde yalnız `FallOfCavalry` deposu kullanılacak; Unity deposu yalnızca kullanıcının ayrıca istediği karşılaştırmalar için salt okunur bakılabilir.
3. Her turda GitHub `main` HEAD ve en son PR/CI kontrol edilir; eski lokal ZIP ile kör devam edilmez.
4. Çalışılan modül `KEEP / REPAIR / INTEGRATE / REPLACE / DEFER` sınıfına konur.
5. Bir seferde **en fazla 1 ana work package**; yakın ilgili küçük alt işler bir PR'de olabilir.
6. Unit + integration + smoke + save testlerinden uygun olanlar tamamlanmadan `DONE` yazılmaz.
7. Her kod değişikliği için açık geri alma yöntemi bulunur; eski Canvas çalışır halde kalır (kullanıcı kararına kadar).
8. Debug/temporary placeholder kabul edilir; yeni görsel varlık üretimi yapılmaz.
9. Kullanıcı onayı gereken kararlar `PROPOSED` olarak kalır; otomatik onay sayılamaz.
10. Geliştirme kayıtları task ID ve H-ID ile eşleşir; ilerleme yüzdesi tahmin edilmez, tamamlanan acceptance gate sayısı ölçülür.

## Her yeni görevde minimum raporlama

`ID | Hedef | önceki HEAD | branch | değişen dosyalar | test komutları | exact PASS/FAIL/SKIP | save uyumu | kapanan riskler | yeni riskler | sonraki iş | kullanıcı onayı gerektiriyor mu?`

## Yasak sapmalar

- Kullanıcı açıkça istemedikçe `FallOfCavalry-Unity` içine commit, PR, branch açma.
- `codex/impl-*` içeriklerini web oyununun hazır modülü gibi varsayma.
- `.md` planında işaretli diye test edilmeyen işi `DONE` sayma.
- Sadece testleri geçirtmek için gameplay hesapları değiştirme.
- Eski save'leri gerekçe göstermeden geçersizleştirme.
- Sanat fazını gizlice başlatma; geçici atlas yaratmak yalnız test fixture'ı ise ayrı iş kaydıyla.
- Açık PR'leri, büyük dosyaları, eski branch'leri salt varlıklarından ötürü silme.