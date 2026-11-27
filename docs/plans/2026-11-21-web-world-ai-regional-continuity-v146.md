# Fall of Cavalry WEB — V1.46 Bölgesel NPC sürekliliği ve gerçek yol ağı üzerinden çok şehirli yolculuk

**Tarih:** 21 Kasım 2026  
**Kapsam:** O00-06, yalnız WEB  
**Dal:** `codex/web-world-npc-roster-20261118`  
**PR:** [#68 — DRAFT/UNMERGED](https://github.com/zxc28tarik/FallOfCavalry/pull/68)  
**Sınır:** `main`, Unity PC ve başka oyunların kodu değiştirilmedi.

## Önceki sorun ve değişiklik ihtiyacı

[V1.45 Chromium #44903307127](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44903307127) ile gerçek seed 1337 haritasında başlangıç için **881 şehir, 304 kayıtlı yol, 3 nehir, 4 geçit** doğrulandı; başlangıç çevresindeki **19/19** NPC gerçek şehir veya ticaret yolu kaynaklıydı ve 32 kare boyunca hayattaydı. Ancak mevcut 40 karo mesafesi aşıldığında, çevreden silinen normal haydut/devriye/kervan ve sivil gruplar kalıcı olarak kayboluyordu; yeni bölge için 3 oyun günü dolmadan yenileri gelmiyordu. Kervan ve devriye de ilk yolun sonuna varınca uzak/rastgele şehre hedeflenebiliyordu.

## Uygulama

### 1. Kayıtlı kanonik yollardan çok ayaklı rota

- `js/systems/world-ai-local-sources.js`: `nextCanonicalCityLeg` mevcut doğrulanmış yol bağlantılarından, ulaşılan şehre bağlanan bir sonraki gerçek yolu seçer. Alternatif varsa az önce gelinen şehre hemen geri dönmez; gerçek çıkmazda aynı kanonik yoldan dönebilir.
- `verifiedRoadLegPath` kayıt sonrasında konum ve uç şehir kimliklerini gerçek yol geometrisiyle yeniden eşleştirir. Var olmayan yol uydurulmaz, kayıttan gelen iddia edilmiş waypoint dizisi kaynak kabul edilmez.
- `js/systems/world-ai.js`: Kervan ve devriye için `currentCityId`, `previousCityId`, `completedRoadLegs` güncellenir; gerçek sokak/yol waypoint dizisi kullanılır. `homeCityId` ilk kaynak olarak korunur.
- Eski/yolsuz haritaların kaynaklı normal hedefleme davranışı için geriye dönük uyumluluk korunur; onlara doğrulanmamış `routeId` verilmez.

### 2. Dünya bölgesi değişince NPC'yi öldürmeden park etme

- `js/systems/world-ai-regional-stream.js`: Oyuncu etkin bölgesinden yeterince uzaklaştığında sıradan partiler `worldAi.dormantParties` listesine **aynı ID ve canlı nesne** ile taşınır. Görünmez/etkileşimsizken aynı anda yeniden oluşturulmaz; bölgeye dönülürse önce bu kimlikler geri yüklenir. Yalnız eksik kotaya göre yeni parti oluşturulur.
- `regionAnchor` ve `regionHistory` oyuncu yakınındaki ziyaret edilen gerçek bölgeleri izler. Yeni bir gerçek şehirli bölge ilk kez ziyaret edilince yerel nüfus oluşturulabilir. Bu işlem eski **3 oyun günlük global respawn** gününü sıfırlamaz. Ziyaret edilen bölgenin tekrar doldurulması ayrı takvime bağlıdır.
- Oyuncu bölge merkezi değişmeden **yavaşça 40 karo sınırını** geçerse `world-ai.updateWorldParties` canlı partiyi yine geçici saklar; yok olmuş veya yenilmiş saymaz. **Görev kanıtı ve escrow malları bu yüzden imha edilmez.**
- Aktif göreve ait ve gerçekten kayıtlı yola bağlanan haydutlar bölgesel temizleme sırasında korunur. Eskort ve eskort muhafızları özel kaynaklı kendi yaşam döngüsünde tutulur.
- İstisna: Bir parti gerçek çatışmada yenilirse normal oyun/loot temizleme kuralları çalışmaya devam eder. Bu değişiklik yenilmiş askerleri diriltmez.

### 3. Hızlı kayıt ve eski dosya uyumu

- `SaveManager` yerel canlı ve park edilmiş partilerin ID/tür/fraksiyon/şehir kaynak kimlikleri, `regionAnchor`, `regionHistory`, yolculuk şehir kimliği ve tamamlanan yol ayağı sayısını saklar.
- Eski kayıtlar yeni alanları taşımadığında boş bölgesel durumdan güvenli başlatılır. 0 numaralı gerçek şehir kaydı `null` ile karıştırılmaz.
- Sahte route ID veya kayıt waypoint dizisi gerçek yol/kişilik/quest kanıtı sayılmaz. Korunan eskort yükleri/ticaret makbuzları eski doğrulanmış yaşam döngüsünde kalır.

### 4. Görev ekranlarını kesen ani devriye çatışmasına karşı güvenli başlangıç

İlk Chromium koşularında gerçek eski görev ve pazar kabul testi sırasında **yeni bölgeden etkinleşen yabancı devriyenin oyuncunun üstünde çatışma başlatması** tespit edildi. [Hata teşhisi #44905946535](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44905946535) olayında beklenmeyen `encounterType: enemy_patrol` görüldü.

Düzeltme:
- Yeni devriye kaynağı mümkünse oyuncudan en az 8 karo uzaktaki **gerçek bir şehir** seçilir.
- Yeni bölgeden doğan, saklandığı bölgeden geri gelen veya hızlı kayıttan yüklenen düşman haydut/devriyeye **6 saniyelik karşılaşma hazırlığı** tanınır. Süre geçince mevcut saldırı menzili, fraksiyon düşmanlığı ve gerçek çatışma algoritması normal çalışır.
- Oyuncu haritada hareketsiz şekilde şehir pazarı, kayıt veya görev ekranına bakarken **rastgele sürpriz karşılaşma** açılmaz; açıkça talep edilmiş/kanıtlı görev ve senaryo karşılaşması bundan etkilenmez. Hareket ederken sürpriz karşılaşmalar hâlâ mümkündür.

## Gerçek testler

**Kod başlığı:** `78cd521868940d184f7778dec058c715705e3619`.

- [Web validation #44906306999](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44906306999): **PASS** — **875/875 birim** ve **1.287/1.287 genel test**, +1 önceden mevcut skip. 17 yeni V1.46 testi: çok ayaklı yol, çıkmazdan dönüş, şehir bağlantısı, kayıtlı yolun yeniden kurulması, farklı bölgeye geçiş, uyuyan partinin aynı kimlikle dönüşü, oyunun üç günlük doğma takvimi, yol kaynaklı görevli haydut koruması, kayıt/yükleme, yavaş sınır geçişi, idle sürpriz koruması, güvenli devriye doğumu ve karşılaşma hazırlık süresinin sona ermesi. Build ve lint PASS. Dünya bütünlüğü: 881 şehir, 304 yol, 0 hata, 1 mevcut yapısal uyarı.
- [Gerçek Chromium #44906306998](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44906306998): **PASS** — mevcut menü→dünya→görev→savaş→ekonomi→kervan→pazar→kayıt/yükleme ve V1.40–V1.45 testleri başarılı; konsol hatası sıfır.
- Gerçek Chromium V1.46 testine özel karşılaştırma: **183,325 karo** uzaklıkta başka bir gerçek şehir (`targetCityId=1`), **19** başlangıç partisi saklandı, yeni bölgede **19** parti üretildi, hızlı `quickSave` ve `quickLoad` başarılı. İlk bölgeye dönünce **19/19 eski parti ID'si geri geldi**, yeni bölgedeki 19 parti de park edildi; `lastRespawnDay` global oyun günü damgası değişmedi. Yeni bölgedeki temel partilerin kaynak şehirleri gerçek kayıtlarla eşleşti.
- Mevcut 32 kare yaşam döngüsünde 19 partili harita korunuyor; tekrar doğma/silinme döngüsü geri gelmedi. V1.41 sıcak-soğuk ortalama `updateMap` süreleri yaklaşık **1,491 / 1,409 / 1,403 ms/kare**, dünya AI yaklaşık **0,259 / 0,234 / 0,256 ms/kare**. Başsız Chromium SwiftShader `rAF` yaklaşık **401–445 ms**: bu **oyuncunun gerçek PC GPU FPS'i değildir**.

## Açık sınırlar ve sıradaki kapsam

- Gerçek Chromium'da uzak iki şehir arasında **kontrollü konum geçişi** ve kayıttan geri dönüş kanıtlandı. Oyuncunun tüm 881 şehirli haritayı saatlerce kesintisiz dolaşması, uzun süre park edilen parti kayıtlarının bellek/kayıt büyümesi ve çok farklı fraksiyonların tarihsel ticaret koridorlarına göre makro ekonomi henüz ayrıca ölçülmedi.
- Park edilen partiler aktif dünya simülasyonunda **dondurulur**; görünür olmayan partiler için ayrı offscreen gündelik ekonomi/savaş simülasyonu eklenmedi. Bu, maliyet ve kimlik koruma amacıyla bilinçli kapsam sınırıdır.
- Yol bağlantısı olmayan eski haritaların normal hareketi, 1650 tarihsel UI/görsellik ve Unity masaüstü tasarımı bu aşamada değiştirilmedi.
- **V1.47 aday:** uzun kampanya boyunca bölgesel `dormantParties` bellek/JSON boyutu, orijinal kimliklerin tekrar ziyaret ve görev ölümü sonrası tutulması; çok fraksiyonlu makro ticaret ve devamlı karavan akışı; gerçek oyuncu hareketiyle 100+ karo kesintisiz saha testi.

**Karar:** V1.46 kodu ve gerçek oyun testleri PASS; PR #68 **DRAFT / UNMERGED**, Unity ve `main` değiştirilmedi.
