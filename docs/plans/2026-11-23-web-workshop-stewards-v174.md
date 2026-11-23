# Fall of Cavalry — WEB V1.74: Açık emirle gerçek atölye nezaretçisi görevlendirme

**23 Kasım 2026** · Sadece web oyunu · `codex/web-world-npc-roster-20261118` · PR #68 taslak.

## Geçerli kararlar ve sınırlar

**Kullanıcının önceden belirlediği sınırlar:** Bina/kaynak gerçek City V2 parseline ait olmalı; karakter sistemi mevcut `worldCharacters` ve `characterOrganization` otoritesini kullanmalı; otomatik karakter üretimi/ücret/gelir/ek hazine/atölye sahibi yaratılmamalı; PR `main` dalına izinsiz birleştirilmemeli.

**V1.74 kararı, geçici uygulama semantiği:** Atölyede oyuncunun açıkça görevlendirdiği **“atölye nezaretçisi”** yalnız bir yönetim görevidir. **Atölyenin sahibi, üretici işçi, ticari malın sahibi, resmi lonca üyesi veya maaş alacaklısı değildir.** Zanaat kaynağından doğmuş kişi olma zorunluluğu yoktur: oyuncu aynı şehirde bulunan, yaşayan, kalıcı **NamedCharacter** arasından seçer. V1.73 kaynak kökeni bu görevden bağımsız kalır.

## Tam entegrasyon

1. `js/systems/character-organization.js` mevcut sürüm-1 yapı ve kayıt alanlarını korur. Yalnız `assignmentRole = workshop_steward`, `branch = trade_network` ikilisi için **opsiyonel assignmentSource** doğrulaması ekler:
   - `{type:'production', id:'built-<city>~<parcel>~<building>', settlementId:<city>}`
   - Sadece gerçekten kurulu, kilitli olmayan Industry yapısının kanonik `discoverCharacterProductionSources` kaydı kabul edilir.
   - Gelen kayıtlar hem syntactic doğrulama hem canlı dünya doğrulamasından geçer; kaynak yoksa **aktif** atama save/load sırasında yetkili görev olarak kabul edilmez.
   - Tamamlanmış görevler tarihsel kayıt olarak tutulur; başka görev dalları ve eski kayıtlar değişmez.
   - Karakterin hâlihazırda aktif başka organizasyon görevi varsa atama yapılamaz.
2. `js/systems/city-workshop-assignments.js` yeni operasyonel arayüz:
   - `listCityWorkshopStewards`: gerçek şehir atölyelerini ve şehrin boşta, yaşayan kalıcı karakterlerini birleştiren **read-only** liste.
   - `appointCityWorkshopSteward`: doğru oyuncu fraksiyonunun sahip olduğu şehirde, gerçek kaynak kimliği ve tekil kişi/tekil atölye ile `startCharacterAssignment` çağırır.
   - `releaseCityWorkshopSteward`: **aynı atölye + aynı aktif görevli** doğrulanmadan görev sonlandırmaz; `completeCharacterAssignment` mevcut gerçek görev geçmişini kapatır.
   - Para stok, pazar fiyatı, görev dışı karakter özellikleri ve asker sistemine **dokunmaz**.
3. `js/managers/CityManager.js` UI eylemlerini mevcut GameFlowManager olay kaydına ve `runAutosave('workshop-steward-assignment')` ile mevcut save hattına bağlar. Sadece **başarılı kullanıcı eyleminde** autosave yapılır.
4. `js/ui/city-services.js` Şehir İaşesi altında `Atölye Nezaretçileri — Açık Görevlendirme` paneli gösterir. Oyuncu gerçek kendi şehrindeki boşta kalıcı karakterlerden seçer, `Görevlendir` / `Görevi bitir` butonlarını kullanır. Başka fraksiyon şehrinde butonlar yoktur. Hata nedeni açıkça gösterilir.

## Kapsam dışı (bilerek)

- NPC kökeni görev yetkisi sağlamaz (V1.73 temsili değiştirilmedi).
- Atölyede tek nezaretçi sınırı V1.74 geçici insan-yönetici UI kuralıdır; işçi kapasitesi veya ekonomik verim tavanı değildir.
- Görevlendirme **otomatik** `trade_network` üyeliği kazandırmaz: CharacterOrganization `memberships` ayrı kalır.
- Atamaya maaş, pasif altın, üretim sayısı, satış kârı veya şehir hazinesi bağlanmadı. İleriki işletme/işçilik motoru kendi aktör ve altın haklarını ayrıca tanımlamalı.
- Savaş, Unity proje yapısı, map generation, oyuncu parti kadrosu, yeni save şeması ve varsayılan ayarlar değiştirilmedi.

## Test kapıları

Yeni `tests/unit/city-workshop-stewards-v174.test.js` **10 test**: oyuncu ataması, tekil atölye/aktif görev çatışması, yabancı şehir yetki reddi, kilitli/silinmiş/sahte atölye, ölü/taşınmış/generated NPC, görev kapama/tarihçe, eski-yeni save normalizasyonu, sahte fiziksel kaynak, org API yetkisiz kullanım ve başarısız günün yan etkisizliği.

Daha önceki V1.73 karakter provenansı ve V1.72 pazar hesapları testleri aynı anda korunur. Son commit üzerinde Web validation + indirilir HTML file:// smoke + Chromium gerçek dünya smoke üçü PASS olana kadar teslimde o son kontrol eksik belirtilir.

**Gelecek gerçek sahiplik aşaması:** İşletme şahıs mülkiyeti, kira/çırak/işçilik, alacaklı, işletme kasası, sermaye, iflas ve ölüm/miras gibi kurallar ayrı model/karar gerektirir. Bu görev sistemi bu otorite yerine geçmez.
