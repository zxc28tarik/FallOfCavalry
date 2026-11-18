# WEB — Dünya NPC / Karakter Üretimi V1

**Tarih:** 18.11.2026
**Yetkili repo:** `zxc28tarik/FallOfCavalry` (JavaScript web oyunu)
**Durum:** Kaynak kodu ve testler geliştirildi; CI/browser ve kullanıcı kabulü ayrı kapılardır.
**Kapsam düzeltmesi:** Kullanıcı **OYUNCU KARAKTERİ DEĞİL** ve **UNITY DEĞİL** dedi. Ayrı Unity PR #1 ve yanlış web oyuncu karakteri PR #67 **birleştirilmeden kapatıldı**. Bu plan yalnız web dünyasındaki karakter/NPC üretimini kapsar.

## Gerçek mevcut durum

Web oyunu `playerParty.roster`, dünya AI orduları ve savaş `SoldierInstance` nesnelerine sahipti; bunlar nüfus içindeki gerçek kişiler için ayrı kalıcı karakter otoritesi değildi. Mevcut web ana dalında oyunun başlatıcısı `GameFlowManager.startNewGame()`, v1 kayıt otoritesi `SaveManager` + `SaveSystem`, şehir görünümü `CityServicesUI` idi.

## Uygulanan teknik alt iş

- `js/systems/world-characters.js`: Tek tanımlı `worldCharacters: { version, characters, relations }` koleksiyonu; `GeneratedPerson` benzeri `kind: generated` ve önemli olunca `kind: named` + `importance: D` geçişi.
- Her kişinin `npc:<settlementId>:<serial>` kararlı kimliği; adı, kültür etiketi, başlangıç rol profili, yaş, iki kişilik etiketi, dokuz 0–100 özellik, sadakat/memnuniyet/itibar/konum ayrı değerleri, tek şehir konumu ve sınırlı geçmişi.
- Haritanın **bütün mevcut yerleşimlerini** kapsayan, yerleşim sırasından bağımsız seedli üretim; geçerli/benzersiz yerleşim ID'lerini kullanır. Büyük kayıtlar için korumalı kapasite sınırı (4096). İki örnek kişi/yerleşim **oyun nüfus sayısı değildir**; yalnız gerçek kişi kayıt altyapısını başlatan teknik varsayılandır.
- NPC kayıtları oyuncunun `playerParty` birliği, asker, sprite veya dünya AI savaşçı nesnelerine otomatik çevrilmez; görev/aile/klan/din atamaları yok.
- `GameFlowManager.startNewGame()` başlangıcında üretim, `GameState` runtime ve küçük genel state serializasyonu, `SaveManager.buildSavePayload/applySavePayload` ve `SaveSystem.normalizePayload` üzerinden kalıcılık.
- Eski v1 kayıtları alan içermediğinde `characters:[]` ve `relations:[]` ile açılır; mevcut NPC yokken kayda uydurma kişi eklenmez. Kayıt ana `schemaVersion: 1` korunur, çünkü isteğe bağlı alan ekidir.
- `CityServicesUI` mevcut şehir özetinde o şehre bağlı isim/rol/yaş listesi gösterir. Karakter metni HTML injection'a karşı kaçıştan geçirilir.
- Sadece açık `setWorldCharacterRelation` ile seyrek ilişkiler; rastgele bütün karakterleri birbirine bağlamaz.
- `promoteWorldCharacter` aynı nesne/ID/özellik/konumu koruyarak kimlik ve önem sınıfı değiştirir.
- Unit ve Chromium browser smoke: determinism, seed değişikliği, farklı settlement sıralaması, sınır/çarpışma, promotion, ilişki, eski-save ve gerçek save/load.

## Korunan kullanıcı kararları

- **Web ≠ Unity**: Unity deposuna yeni uygulama yapılmaz.
- **Oyuncu karakteri ekranı yok**: StartScreen'a isim, sınıf, origin, görünüm eklenmez.
- **2D, sıfırdan özgün**: NPC/asker görselleri, atlas ve animasyon yalnız önceden kararlaştırılan **G14 son faz / kullanıcı onayı** sonrasında üretilir; bu PR yalnız gameplay verisidir.
- **Dünya veri pilotu yok**: Bu iş D00/D01 onaylı coğrafya değildir. Geçici mevcut prosedürel haritanın tüm yerleşimlerine veri kaydı oluşturur; yeni coğrafya üretmez, nihai tarihsel nüfus iddiasında bulunmaz.
- Yeni tarihsel kişilerin/isimlerin doğruluğu **onaylı sayılmaz**; isim havuzları, rol olasılıkları, stat aralıkları, iki kişi/yerleşim, yaş ve kişilik etiketleri **ASİSTANIN GEÇİCİ TEKNİK VARSAYIMIDIR**, kullanıcıca onaylanmış oyun balansı değildir.

## Sınırlar, riskler, sonraki işler

1. Kayıtların oyun tarihine göre yaşlanması, doğum/ölüm, din/kültür bağlılığı, meslek/atama ve miras **henüz yok**.
2. `role` yalnız başlangıç profilidir; şehir kadılığı, tüccar iktisadi aktörü, ordunun komutanı veya diplomatik elçi olarak atanmamış kişi bunların yetkilerini taşımaz.
3. Şehir el değiştirince `originFactionId` yaratılıştaki menşei etiketidir, otomatik siyasi bağlılık veya zorla din değişimi olmaz.
4. `worldCharacters` v1 bağımsız, şimdilik küçük ve düz array veri modelidir; ilerde kişi sayısı büyürse indeksleme, simülasyon yoğunluk bütçesi ve eski kayıt migrasyonu ayrı onaylanmalıdır.
5. Kalıcı kişisel ilişkiler/house/clique/ticaret/ordu, görev ve günlük AI uygulamaları gelecekte yapılacak bağımsız sistem alt işleridir; bu PR bunları bitirdiğini iddia etmez.
6. Nihai dünyada mevcut yerleşim ID'leri değiştiğinde eski NPC konumlarının taşınma politikası `D00/D01/O00-02` kararıyla belirlenmelidir.
7. Gerçek tarayıcı görüntüsü ve .NET/Unity değil **Web validation + Chromium** gereklidir.

## Kabul kriterleri

- [x] Yalnız web deposunda odaklı kod ve test.
- [x] Oyuncu/asker veri katmanını değiştirmeme.
- [x] Gerçek yerleşimlerden deterministik NPC üretim ve kayıt adaptörü.
- [x] Şehir özetinde isimlerin görülmesi (kod entegrasyonu).
- [ ] Web CI exact-head başarı kanıtı.
- [ ] Chromium gerçek yeni oyun/şehir/save/load kanıtı.
- [ ] Kullanıcı tarihsel içerik / sistem mekanikleri kabulü.
