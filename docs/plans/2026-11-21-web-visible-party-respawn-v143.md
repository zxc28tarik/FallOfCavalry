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


## Gerçek CI kabulü — V1.43 PASS

- **Kod/test başlığı:** `c0d95469dad87a853fa1134554481538e52bb4ef`.
- [Web validation #44849160828](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44849160828): **PASS**. 833/833 unit (V1.43 için 9 yeni test), 1.245/1.245 genel + 1 önceden mevcut skip, production build ve lint PASS, gerçek dünya 881 şehir / 304 yol / 3 nehir / 4 geçit / 0 hata / 1 mevcut uyarı.
- [Gerçek Chromium #44849160988](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44849160988): **PASS**. Önceki bütün görev / savaş / ticaret / escort / loot / kayıt senaryoları ve performans gözlem zinciri PASS, oyun konsolu hatası sıfır. Gerçek V1.43 yaşam döngüsü regresyonu `PASS_REGRESSION`.
- İlgili CI artifact: `chromium-world-browser-report/party-lifecycle-profile.json`. Gerçek 881 şehirli haritada 32 karede **64 ensure çağrısı / 32 worldAI update**, **0 base parti yeniden üretimi / 0 ekstra parti yeniden üretimi**, **0 parti silinmesi**, `lastRespawnDay=1` ve `lastVisibleRespawnDay=1` değişmeden korunuyor. Düzeltme öncesi aynı profil 32 karede **288 ekstra parti oluşumu/silinmesi** göstermişti.
- **Canlı quickSave/quickLoad kanıtı:** `saved=true`, `loaded=true`, görünür parti zaman damgası **önce 1 / sonra 1**, `sameStamp=true`, `noImmediateRefill=true`, save öncesi ve sonrası ekstra parti sayısı 0.
- `ensureWorldParties` toplam **4,5 ms / 64 çağrı** (ortalama ~0,070 ms) ve dünya `mapSimulation` toplam **35,1 ms / 32 kare** (ortalama **1,097 ms/kare**). V1.42 düzeltmesi sonrası, fakat V1.43 öncesi karşılaştırılan ayrı CI örneğinde dünya simülasyonu **8,534 ms/kare** idi. Bu sayı farklı başsız Chromium CI koşullarına aittir; oyuncunun ekran FPS artışı anlamına gelmez.
- V1.41 canlı `loop.updateMap` yeni üç ölçüm penceresinde **1,459 / 1,153 / 1,119 ms/kare**; `loop.renderMap` **3,534 / 3,444 / 3,931 ms/kare**. Buna rağmen rAF interval **139,239 / 135,481 / 136,013 ms** kaldı. Geriye kalan başsız grafik sunum/scheduler maliyeti gerçek GPU performansının doğrudan kanıtı değildir.

**V1.43 sonucu:** ek görünür parti **her kare yeniden doğma döngüsü kaldırıldı**, mevcut tür/kota, ilk dalga, save/load, özgün oyun ve simülasyon kuralları korundu; gerçek CI PASS.

**Sonraki aday V1.44:** İlk doğan normal ve ek partilerin oyuncudan çok uzaktaki şehirlerde yaratılıp aynı gün silinmesi yüzünden görünür dünya nüfusunun boş kalması. Bu, görsel/UI veya RPG karşılaşma dağılımını etkileyebilecek bir *tasarım* sorunudur; otomatik spawn lokasyonunu değiştirmeden önce coğrafi yakınlık, aktif parti ve encounter tutarlılığı hakkında ayrıca gerçek harita kanıtı topla. FPS uğruna dünya nüfusunu veya AI'ı azaltma.

O00-06 devam; PR #68 **DRAFT, UNMERGED**; `main`, Unity ve savaş sistemleri dokunulmadı.
