# Fall of Cavalry WEB — V1.43: Ek görünür dünya partilerinde yeniden doğma ve kayıt tutarlılığı

**Tarih:** 21 Kasım 2026. **Dal:** `codex/web-world-npc-roster-20261118`; yalnız WEB. PR #68 DRAFT ve unmerged. Ana proje O00-06 açık; Unity ve `main` değişmez.

## Kanıtlanmış problem ve çözümün sınırları

V1.42 gerçek Chromium testinde, 32 gerçek oyun karesinde **9 ek parti × 32 = 288 parti** oluşturulup aynı karede uzaklık denetimiyle kaldırıldı. Türler: `refugee×2`, `merchant×2`, `messenger×2`, `villagers×2`, `noble×1`. Temel dünya bandit/patrol/caravan partileri için çözülen 3 oyun günü kuralına rağmen bu ek havuz her `WorldPartyManager.ensureWorldParties` çağrısında tekrar dolduruluyordu.

**Üretim düzeltmesi** yalnız ekstra görünür parti havuzunun yeniden dolma zamanlamasına ilişkindir:

- `WorldPartyManager.ensureWorldParties` ilk kampanya kurulumunda **tüm dokuz ek partiyi eskisi gibi** derhal üretir. Canlı partilerin kimlikleri, mevcut maksimumlar ve quest/encounter türleri korunur.
- Ek havuz bir kez üretildikten sonra `RESPAWN_INTERVAL_DAYS` (varsayılan 3 **oyun günü**) dolmadan tekrar doldurulmaz. Dördüncü gün yalnız eksik türler, mevcut max kota ve korunmuş canlı parti kimlikleri üzerinden eklenir. `0` günlük açık yapılandırma izinlidir.
- Son gerçek ekstra üretimin günü `worldAi.lastVisibleRespawnDay` ile tutulur; yeni kampanyada `null` olması ilk üretime izin verir. Bu alan `SaveManager`'da gerçek `quickSave` payload'ına alınır ve gerçek `quickLoad` ile geri okunur. Eski kayıt alanı içermezse `null` olarak geri yüklenip mevcut ekstra kota ilk ensure'da bir defa tamamlanabilir. Save format sürüm kapısı zorlanmaz, mevcut eski alanlar korunur.
- İlk temel `lastRespawnDay`, bandit/patrol/caravan 3 günlük takvim ve aktif eskort/kervan kaynakları **değişmez**. Yeni AI etkisi yalnız normal ekstra dünya partilerinin sonraki otomatik oluşturulmasıdır; hedef oyuncu konumu, çıkış noktası, hız, loot, yol bulma, savaş ve çizim sistemleri dokunulmadı.
- `tests/unit/world-visible-party-respawn.test.js` 9 canlı fonksiyon testini kullanır: ilk dokuz tür, 50 kez aynı gün ensure, gerçek out-of-range despawn, 3 gün bekleme, surviving ID'ler, eski kayıt uyumluluğu, JSON serializasyonu, 0-gün override/dinamik kota, 0 kota.
- `tools/browser-world-party-lifecycle-profile.mjs` bu değişiklikten sonra aynı gerçek 881-şehirli haritada, 32 gerçek rAF döngüsünde en fazla bir **9 kişilik** ek üretim dalgasına izin verir. Ayrıca canlı Chromium'da `quickSave → quickLoad → ensureWorldParties` yaparak `lastVisibleRespawnDay`'in korunduğunu ve kayıttan hemen sonra ekstra partilerin tekrar doğmadığını zorunlu olarak doğrular. Rapor `output/browser-smoke/party-lifecycle-profile.json`.
- Mevcut tam browser kabul akışı V1.38–V1.42 korunur. Birim+genel test, üretim build, lint, save/load, görev, ticaret, savaş ve dünya bütünlüğü PASS olmadan V1.43 bitmiş sayılmaz.

## Dikkat edilmesi gerekenler

İlk açılışta harita genelinde rastgele yerleşimlerden doğan ek partilerin ilk karede oyuncudan çok uzakta kalıp silinmesi **ayrı bir modelleme konusu**. Bu adımda şehir seçimini oyuncunun yakınına çekmiyoruz; o davranış karşılaşma dağılımını ve rol yapma dengesini değiştirebilir. Buradaki hedef yalnızca pahalı ve anlamsız **aynı gün tekrar oluşturma** döngüsünü, var olan üç günlük politikayı ek partilere de uygulayarak kaldırmak. Gerçek kullanıcı donanımında FPS sonucu iddia edilemez.

## Durum

Kod ve test eklendikten sonraki exact HEAD commit ve iki GitHub CI sonucuna göre güncellenecek. PR #68 DRAFT/unmerged, `main` ve Unity değiştirilmedi.
