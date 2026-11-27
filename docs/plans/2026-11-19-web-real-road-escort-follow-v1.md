# Fall of Cavalry WEB — Character System v2 V1.25: Kaynaklı Yol Noktası Takibi ve 30+ Kare Refakat

**Tarih:** 19 Kasım 2026 · **Kapsam:** yalnız `zxc28tarik/FallOfCavalry` web oyunu; Unity ayrı proje. **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68), **DRAFT / UNMERGED**. **O00-06:** UYGULAMADA. **V1.25 yol takip alt işi:** QA PASS.

## Sorun ve kapsam

V1.24'teki otomatik `Kervanı takip et` kontrolü oyuncunun `destX/destY` değerlerini doğrudan hareket eden kervanın dünya koordinatına yönlendiriyordu. Uzun ve köşeli güzergâhlarda bu, yol köşelerini kesme, engelli zemine doğrudan hedef verme ve normal hızda kervandan ayrılma riski yaratıyordu. V1.25, **mevcut gerçek `WorldGenerator.roads` geometrisine bağlı refakat kervanı** üzerinde yolun polyline noktalarını kullanarak kısa ve geçilebilir ara hedefler verir. Kervanların ve görev ödüllerinin kaynak doğrulama zincirini değiştirmez.

### Yapılan kod değişiklikleri

1. **Yeni `js/systems/quest-escort-road-follow.js`**: `chooseEscortRoadFollowTarget` saf planlayıcı. Yalnız aynı JS oturumunda resmen `spawnQuestEscortCaravan` ile oluşturulmuş `isLiveEscortParty=true` kervan kabul edilir. `caravan.path` gerçekten `roadWorldWaypoints` içinden gelen world-pixel polyline'dır; JSON'dan gelen klon kervan reddedilir. En fazla 8192 noktalı sonlu/geçerli yol geometrisi kabul edilir.
2. **Geometrik rota izleme**: oyuncu ile kervanın yol üzerindeki en yakın *segment-projeksiyon* ilerlemesi hesaplanır. Oyuncu yol koridorundan uzaktaysa önce en yakın gerçek yola bağlanır (`joining_road`), sonra kervanın mevcut noktasına doğru ileri/geri **azami 1,25 tile** ara hedef seçer (`road`). Kervan öne geçmişse yön tersine çevrilir; kaynak yolun dışına düz çizgide kesme yapılmaz. Kısa yerel hedefler otomatik dinamik güncellenir.
3. **Engel kontrolü**: önerilen her oyuncu segmenti **azami 0,45 tile** aralıkla `WorldManager.getMovementContextAt` üzerinde örneklenir. Hedefe giden hat blocked ise önce daha kısa `road_short` ara hedefler denenir; bunlar da blocked ise `blocked` döner. Engel boyunca güvenli bir kısmın gidilebilir olması başlangıçtan gereksiz durmayı önler. **Bu bir global A*/Dijkstra sapma yolu sistemi değildir**; geçilemeyen koridoru sihirli biçimde dolaşmaz.
4. **`js/ui/QuestEscortHud.js`**: `refreshFollowTarget` doğrudan kervan koordinatı yerine sadece bu doğrulanmış yol ara hedefini `player.destX/destY` alanına yazar. `WorldSimManager.updatePlayerParty` hâlâ gerçek oyuncu hızı, terrain speed, lojistik, engel/kamp kontrolleri ve `clampToWorld` üzerinden hareket ettirir; *teleport, hız hilesi yok*. Gerçek buton isteği olmadan takip açılmaz. Takip durduğunda Türkçe engel bilgisi gösterilir; varış/harita dışı mod/gerçek manuel hedef önceliği aynen korunur. `Kervana git` tek seferlik hareket seçeneği de korunmuştur.
5. **Ödül ve save güveni**: kaynaklı `caravan_arrival` / `QuestEventMatcher` / gerçek `QuestCompletionOverlay` / `caravan_delivered` zinciri değişmedi. Tek seferlik **250 altın**; oyuncu butonu seçmeden ödül yok, kaydedilmiş eskort partisi soğuk save'den gerçek varış kanıtı olamaz. V1.24 gerçek muhafız savaş zafer/yenilgi sonucu geri alınmadı.

## Doğrulama

**Son kod commit:** `a03a61a0b57130291f857d13c592a391905c2d5c`.

- [Web validation #44542287543](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44542287543) **PASS:** **714/714 birim**, **1.126 genel PASS +1 skipped**, üretim build/statik PASS. Dünya integrity **881 settlements, 304 roads, 3 rivers, 4 crossings, 0 errors, 1 önceki warning**.
- [Gerçek Chromium #44542287566](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44542287566) **PASS**. Bütün önceki quest/guard battle/recon/legacy/save regresyonlarını da geçti; browser console **0 hata**.
- `native-movement-long-road-convoy-follow`: gerçek üretilmiş `route:505:702`, **30,8284 tile**, **31 gerçek road path noktası**, kervan hızı **0,8 tile/sn** (QA'da hız artırılmadı), **276 simülasyon güncellemesi**; oyuncunun başlangıca göre ilerlemesi **935,68 world px**, toplam native movement **953,26 world px**, bir tick'teki en büyük hareket **40 px**, kervanla en fazla ayrılık **46,72 world px**, geçilemez zeminde engellenme **false**, `caravan_arrived=true`, kaynaklı ledger kanıtı **true** ve gerçek görev UI seçeneği **görünür**.
- `native-long-road-delivery-250g-once`: gerçek `Kervan güvenli ulaştı` DOM butonu, 250 altın **tam bir kez**, tekrar tamamlama reddi ve Save/Load archive güveni **PASS**.
- Ön [Chromium #44541954229](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44541954229) **18 tile** doğal hızda refakat PASS, önce [#44541496470](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44541496470) **8,83 tile** doğal hız test PASS. Son hedef 30+ tile'a yükseltildi.
- `tests/unit/quest-escort-road-follow.test.js` içinde **6 yeni birim testi**: sağ açılı 7 noktalı yolun köşesinde çapraz kesmeme; uzun yolun tamamında bounded waypoint dizisi; yola ilk bağlanma; fiziksel engelde yalnız güvenli yere kadar ilerleme; JSON klon/NaN yol reddi; kervanı geçmiş oyuncunun geri dönüş yönü. Önceki V1.24 birim testinde varış hedefinin bir normal hareket tick'inde tamamlanabileceği ve `hasDestination` geçici false olabileceği açıkça doğrulandı.

## Sınırlar ve kalanlar

- Gerçek `WorldGenerator.generateRoadPath` şu an iki yerleşim arasında **tile bazında yuvarlanmış doğrusal interpolasyon** yapıyor. Kodumuz bu noktaları gerçekten izliyor ve olası keskin köşeleri de yönetiyor; **henüz yeni doğal kıvrımlı/kavisli yol geometrisi üretmiyoruz**. Gelecekteki kıvrımlı yollar bu polyline planlayıcıyla çalışabilecek; fakat haritanın yol içeriği ayrıca geliştirilmeli.
- Test, gerçek Chromium'da **oyuncunun normal hareket simülasyonunu her adımda kullandı** ve kervanı *gerçek normal hızında* ilerletti. Ancak QA başlatılırken oyuncu kervanın gerçek kaynak şehrine konumlandırıldı, sonra normal `updatePlayerParty` ve `processQuestEscortCaravans` adımları kodla çalıştırıldı. Böylece tamamen manuel kullanıcı fare/klavye kontrolü ve tüm harita etkinlikleriyle oynanmış 30 tile koşusu **iddia edilmiyor**.
- `WorldAI` genel caravan/ordu/patrol **şehirler arası global shortest-path/graph routing** henüz uygulanmadı. Takip yalnız **mevcut tek gerçek yol güzergâhındaki** kervan refakatini ele alır. Engel varsa alternatif bağlantıyı otomatik bulmaz.
- **Bağımsız NPC muhafız AI, konvoy HP/yük/yağma ve dünya bandit-to-caravan fiziksel saldırı simülasyonu bu adımda eklenmedi.** V1.24 oyuncunun gerçek taktik savaş sonucuyla kervan güvenliği ilişkisi korunur. Bu sistemleri ayrıca kaynaklı bir dünya savaş sözleşmesi ve kanıtsız ödül yaratmama kuralıyla geliştirmek gerekiyor.
- `investigate_missing_caravan` gerçek bandit kanıtını işler ama kervanın kendisinin kayıp nedeni, eşya envanteri/kaderi gibi çok aşamalı araştırma mekanizması yok. Soğuk oturum save objective kanıtı bilinçli olarak inert; görev için yeni canlı kaynak gerekir.
- Character System v2'nin `Organization/makam UI`, historical NPC/commander lifecycle ve sosyal sistemlerinin tamamı hâlâ **açık**.

**Sıradaki V1.26:** oyunun mevcut kara parti simülasyonunu bozmadan görünür eskort muhafızları, kaynaklı NPC bandit-kervan çatışması, gerçek kervan HP/yük kaybı ve Save/Load güvenlik testleri; sonrasında daha karmaşık world pathfinding / yol jenerasyonu. **PR #68 taslak, main'e kullanıcı izni olmadan merge yok.**
