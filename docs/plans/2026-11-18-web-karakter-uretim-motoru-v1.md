# WEB — KARAKTER ÜRETİM MOTORU V1 / SİSTEM SÖZLEŞMESİ

**Tarih:** 18 Kasım 2026
**Repo:** `zxc28tarik/FallOfCavalry` — **sadece web/JS**
**Çalışma:** [PR #68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) — ana dala alınmadı, taslak
**Talep odağı:** Kullanıcının son düzeltmesi **"SİSTEMİ OTURTMAN, ÜRETİM SİSTEMİNİ"**. Bu, oyuncunun başlangıç karakteri ekranı, tek tek NPC bilgi kartları ya da Unity taşıması değildir. Öncelik karakter **üretim kuralları, kaynaklar, kimlik, kalıcılaştırma ve test edilebilir sözleşmedir**.
**Tasarım kaynağı:** Projenin `FOC-Karar-Defteri-Guncel.md` dosyası, Character System v2 (§7), Adam Alma Kaynakları (§9). Bu referans dosyası Unity hedefini anlatsa da kullanıcı talimatı gereği sadece web için **uyarlanabilir oyun kuralları** alınmıştır; Unity kaynakları taşınmamıştır.

## Karar durumu

**Korunan kesin kararlar:** Ana insan ağı, ayrı yoldaş class'ı yok; düşük önemli `GeneratedPerson` önem kazanınca **aynı ID ile `NamedCharacter(D)`**; D→C otomatik değil; statlar 0–100; ilişkiler -100..100 ve tam grafik değil; sadakat, memnuniyet, ilişki, itibar ve nüfuz farklı; tesadüfî aile, hizip, ihanet, din veya askerî rütbe ataması yok; kalıcılaşmamış düşük önemdekiler save'e girmez.

**Açık/provizyonel:** Karakter isim havuzu tarihsel incelemesi, ilk yaşlar, 6 başlangıç rol profilinin stat bazları, 14 kaynak türündeki rol ağırlıkları, bir kaynaktan kaç kişinin gelebileceği, C/B/A sınıfı özel kaynaklar ve oyuncuya katılım koşulları. `js/data/character-production-catalog.js` sayıları üretim motorunu doğrulamak için **ASSISTANT_FILLED / PROVISIONAL** durumundadır; kullanıcı dengesi veya tarihsel veri olarak onaylanmadı.

**Önemli sınır:** Mevcut PR #68'in önceki diliminde iki kişi/yerleşim `worldCharacters` temel veri havuzu bulunuyor. Bunlar **nihai nüfus modeline eşit DEĞİL** ve artık genel karakter edinme üretiminin kaynağı da DEĞİL. Yeni üretim motoru bu havuzdan bağımsız **isteğe bağlı / olay tetikli** aday üretir; büyük nüfus simülasyonuna dönüştürmez. Eski yerleşim örneklerini topluca kaldırmak ayrıca save ve oyun kabul kapısıdır.

## 1. Kesin teknik boru hattı

```text
Gerçek gameplay kaynağı
  -> Kaynak kimliği / konum / tür / içerik doğrulaması
  -> Kaynak rol şablonu + seçilmiş ad havuzu
  -> Dünyaya bağlı seed + kaynak ID + aday sıra numarası
  -> Geçici GeneratedPerson aday kümesi (state/save'e YAZILMAZ)
  -> Oyun olayı / görev / kullanıcı kararı
  -> Yalnız seçilen aday NamedCharacter(D) olarak kayıt
  -> Aynı karakterId + created/promoted geçmişi
  -> worldCharacters yetkili kayıt listesi
  -> Seedli-delta save: sadece farklar + eklenen kalıcı kişi
```

### A. Kaynak kimliği

`character-production-catalog.js` kaynak türleri:

- Yerleşim otoritesi: `village, town, city, fort`. `source.id` gerçek `settlement.id` ile aynı olmak ve harita yerleşim tipiyle uyuşmak zorunda.
- Diğer sahip sistemlerden doğrulanacak: `inn, port, tribe, business, mine, caravanserai, military-training, production, quest, event`. Burada `registeredSources` bir öteki gameplay sisteminin gerçekten mevcut olduğunu doğruladığı kayıtları taşır. Fiktif han/maden/saray otomatik icat edilemez.
- **Gerçek şehir yapısı adaptörü eklendi:** `js/systems/character-production-sources.js` mevcut `settlement.cityState.parcels[].buildingIds` içinden **inşa edilmiş** `han`, `merchant_han` (inn), `caravanserai` ve katalog kategori `industry/food` üretim tesislerini karakter kaynağı olarak keşfeder. **Pazar, bedesten, gümrük, depo doğrudan adam kaynağı yapılmaz** (FOC karar defteri §9). `CityState` oluşturulmaz/değiştirilmez; bulunmayan/kilitli yapılar listelenmez. `GameFlowManager.listWorldCharacterProductionSources()` bunlara read-only erişim sunar, preview/retain sırasında kaynak hâlâ var mı tekrar kontrol eder.
- **Henüz bağlanmayan sahip sistemler:** Gerçek işletme, maden, liman, göçebe oba, askerî eğitim, quest/event kaynaklarının kendi kaynak kayıt servisleri. Türleri teknik katalogda var, fakat **yalnız otoriter upstream kaynaktan** eklenince aday üretecekler; mevcut plan askerî/liman mekaniğini otomatik açmaz.
- Liman kaynak türünün tanımlanması, oyun limanı/deniz mekaniğini açmaz.
- `cultureId` yalnız açık isim havuzu girdisidir; `originFactionId` ayrı açık girdi. Din, mezhep, devlet sahipliği, kültür veya soy birbirinden otomatik türetilmez.

### B. Aday üretimi

- `produceCharacterCandidates` saf, tekrarlanabilir ve en fazla 8 aday döndüren fonksiyondur.
- Aynı `worldSeed, source.type, source.id, source.settlementId, cultureId, slot` için aynı kimlik/rol/ad/stat/trait; başka şehirlerin sıraya eklenmesi bu adayı değiştirmez.
- `npc:source-<type>~<id>:<slot>` kararlı isim alanı; eski `npc:<settlementId>:<slot>` kimlikleriyle çakışmaz. Sayısal `0` yerleşim ID'si geçerlidir.
- Tek adayın `history.created` kaydı `sourceType`, `sourceId`, üretim günü taşır. Kaynak önce doğrulanır; RNG yokken kaynak üretilmez.
- `role` var olan altı geçici profil üzerindedir: `artisan, merchant, administrator, commander, traveler, scholar`. Bu etiket görev/meslek ataması, asker veya oyuncu birliği anlamına gelmez.
- Çıktıdaki `recruitment.canJoinParty, canBeAssigned, canJoinTradeNetwork, canJoinDiplomacyNetwork` **false**: kaynak adaylığı otomatik sadakat veya katılım garantisi değildir.
- Görsel karakter sprite üretimi/animasyon yok; asker görselleri G14 öncesi yasaktır.

### C. Kalıcılaştırma

- `registerProducedCharacter` belirli bir adayın yeniden üretildiğinde aynı kaldığını, kaynak ve dünya konumunun hâlâ geçerli olduğunu doğrular.
- Seçilmeyenler hiç kaydedilmez. Seçilen tek kişi `kind:'named'`, `importance:'D'` olarak **aynı ID, ad, stat, kaynak ve konum** ile eklenir. History `created -> promoted`.
- Çift kayıt reddedilir; full-roster 4096 kayıt üst sınırı korunur. Bu sınır geçici bir runtime emniyetidir, nihai dünya nüfus hedefi değildir.
- İlişki/evlilik, aile/House, Clique, religion/sect, asker alımı, ticaret ataması veya savaş stats'ı **otomatik üretilmez**.
- `GameFlowManager.listWorldCharacterProductionSources`, `previewWorldCharacterCandidates` ve `retainWorldCharacter` kampanya bağlamında yetkili map/seed ile birlikte gerçekten **mevcut yapıdan keşfedilen** kaynakları kullanır. UI gerekli değildir. İnsan kaydı oyun olaylarına daha sonra bağlanabilir.

### D. Kayıt ve yükleme

- Önceden eklenen `seeded-delta-v1` kaydı korunur.
- Normal seed NPC'lerin tamamı save'e tekrar yazılmaz.
- Yeni kayıtlı Named(D) kişilerin yalnızca `additions` payload'ları tutulur. Var olanların değişiklikleri `overrides` alanında kalır; ilişkiler seyrek `relations` listesinde ayrı.
- Tam `packed-v1` ve eski obje biçimleri de okunur. Kaynağın üretildiği yapı kimliği/history'si `created` evento metadata'sından korunur.
- Yüklemede `additions`, geçerli yerleşim referansı ve kimlik alanı doğrulanmadan kabul edilmez. Mevcut kayıtların kaybolmasına karşı, eksik baseline durumda full `packed-v1` fallback sürer.
- **Önemli risk:** Mevcut seed bazlı NPC jeneratörü ve V1 production name/role catalog içerik revizyonları gelecekte değişirse save migrasyonu veya sürüm pinlemesi gerekir. Bu değişiklikler hiçbir zaman sessizce yapılmamalı.

## 2. Düzeyli üretim — neler YOK?

- Gerçek A/B/C tarihsel kişi veritabanı, hükümdar/bey/komutan/aile tanımları **ayrı authored içerik kaynağı** olarak planlanmalı. Sıradan kaynaktan A karakter rastgele düşürülmez.
- Mesleğe atanma, gelir/servet etkileri, kişinin işe kabulü ve yeteneklerin gerçek görev başarısına ağırlıklı etkisi farklı gameplay kurallarıdır. Üretim motoru bunların yerine geçmiş sayılamaz.
- Kişilik traitleri, kadim aile/soy ve din havuzları nihai onaylanmış içerik değildir.
- Askerler `playerParty.roster`/battle birimleridir, karakter kimlik verisinin aynısı sayılmaz. G14 grafikleri uygulanmadı.
- NPC doğum/ölüm/miras/siyasi hizip/terfi zinciri bu üretim çekirdeğinin yapılmış parçası değildir.

## 3. Test ve kabul kapıları

1. 14 tipin sözlüğü; geçerli kaynak / sahte kaynak ve yerleşim tipi reddi.
2. Aynı seed+source+slot eşit; farklı seed/source farklı; aday seçilmeden state değişmez.
3. Kaynak odaklı şablonlar farklı sonuç üretir; stat 0..100, traitler tekil.
4. Seçilen `GeneratedPerson` => `Named(D)` tek ID, kayıp/ikili kayıtsız.
5. Kayıt eski NPC havuzunu tekrar şişirmez; `additions` küçük kalır; tam restore.
6. Gerçek Chromium'da dünya açılışı ve kaynak karakter üretim→retain→quick save→load; önceki NPC şehir ekranı ve savaş placeholder'ları bozulmaz.
7. Tüm test sonuçları **aynı final SHA** üzerinde raporlanır; hiçbir UI, nüfus veya sanat fazı bu çalışmayla tamamlandı ilan edilmez.

**Çalışma durumu:** Kod ve birim/E2E testleri PR #68'de; CI exact-head raporu tamamlandıktan sonra işaretlenecek. Kullanıcı tarihsel üretim balansını, A/B/C içeriğini ve karakter sprite teknolojisini ayrıca kararlaştırır.


## 4. V1.3 üretim kimliği, kaynak otoritesi ve politikaların mühendislik sınırları (18.11.2026)

**Sorun:** İlk sürümde `npc:source-inn~inn-01:1` gibi kimlikler, iki farklı şehirde `inn-01` adlı iki tesisi aynı kişi sanabiliyordu. İkinci sorun: kampanya API'si dışarıdan sahte `registeredSources` ve değişmiş isim/rol politikası kabul edebiliyordu. Üçüncü sorun: farklı dünya seed'inden gelen teklif, aynı kampanya kimliği altında kalıcı kişiye dönüşebiliyordu.

**Çözümler (teknik emniyet, oyuncu balansı kararı değil):**

1. Yerleşim kaynakları eski `npc:source-city~0:1` gibi kimliklerini korur. Yerleşim dışı kayıtlı kaynakların yeni kimliği `npc:source-<type>~<settlementId>~<sourceId>:<slot>` biçimindedir. Aynı `inn-01` iki şehirde iki farklı ID üretir. Eski branch'teki bu tür formatlı deneysel kayıtlardan yayınlanmış main veri yoktur; ileride migration ihtiyacı ayrıca takip edilecektir.
2. `GameFlowManager` üretim için yalnız `listWorldCharacterProductionSources()` keşfinden gelen **kanonik kaynak kaydını** alır. Çağıran tarafın uydurduğu `registeredSources`, `rolePolicy`, `namePools` oyun facade'ında kabul edilmez. Kaynak sahibi quest/event modülü önce ayrı **yetkili adaptör** ile bağlanmalıdır. Düşük seviye saf üretici, fixture testleri için katalog girdisi alabilir; bu gameplay otoritesi değildir.
3. Kampanya kalıcılaştırma, `expectedWorldSeed` ile teklifi denetler: başka kampanya seed'iyle oluşturulan aday kalıcılaştırılamaz. Kaynak silinmişse kayıt engellenir. Mevcut kalıcı kişi bina yıkılmasıyla **otomatik silinmez**.
4. `source.cultureId`, yalnız gerçek `settlement.cultureId` gibi açık, desteklenen bir kültür verisi varsa kaynağa taşınır. **`ownerFactionId` ≠ kültür**; yoksa `generic` seçilir. Çağıranın getirdiği kültür veya ilk devlet kimliği kanonik kaydın yerine geçmez. Din/mezhep/soy **çıkarılmaz**. Gelecekte dünya verisi otoritesi netleşince kültür alanı ayrı onayla beslenebilir.
5. Aday sonucu artık `sourceContract` taşır: `sourceLocationId`, `sourceCultureId`, `possibleRoleTags`, `possibleImportanceClasses:['D']`, `staysInLocation:true`, `isUnavailableForRecruitment:true`. Bu değerler **yalnız mevcut motorda açık olmayan yetkileri** temsil eder. Gelecekte A/B/C, oyun içi yoldaşlık, asker alımı veya diplomasi erişimi için ilave kabul edilmiş kurallar gerekir.
6. Kaynak tipi çözücüsünde prototip üzerinden gelen sahte `constructor/toString` anahtarları reddedilir; yalnız açık alias listesi geçerlidir.
7. 14 kayıt türünün tamamının üretim/rol sözleşmesi; aynı adla iki şehrin kaynak çakışması; seed/culture/owner manipülasyonu; silinmiş tesis ve boşta kalan kaynak reddi; küçük delta save ve gerçek Chromium E2E testlerine eklendi.

**Hâlen engelli / sonraki adım:** Otomatik NPC arama teklifleri, kaynak sıklığı/yenilenme, nadirlik, A/B/C önemli tarihsel kişiler, din/aile/hizip bağlama, gerçek quest/işletme/maden/oba kaynağı adaptörleri kullanıcıca onaylanmış davranış olmadan açılmaz. Bu PR teknik üretim güvenilirliği sağlar, tüm canlı dünya AI simülasyonunu tamamlamaz.


### V1.3 doğrulama kanıtı — 18.11.2026

- [Web validation #44227315955](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44227315955) **PASS**: **543/543 unit**; tam Vitest **955/956** (1 skipped); Vite production build ve source hygiene PASS; dünyanın 881 yerleşim / 304 yol / 3 nehir / 4 geçit kontrolünde 0 error, 1 açık uyarı.
- [Chromium browser #44227315983](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44227315983) **PASS**: 1.762 dünya NPC'si; 4.732 mevcut yerleşim/inşa edilmiş yapı üretim kaynağı; sahte han kaynağı RED, yanlış campaign seed RED, duplicate RED; geçici aday yaratırken world state değişmiyor; seçilen kişi Named(D) + `additions:1` kaydıyla korunuyor; quick save/load sonrası kişi aynı, player soldier roster değişmiyor, JS console errors=0; şehir NPC profil ekranı açılıyor.
- İşleyen kodun test edilen HEAD'i: `0a8f08a4f6f6f6c75224cfc17a9124aa07f57e36`. Sonraki dokümantasyon commitleri yeniden CI alır; **PR draft, main'e merge yok**.
- Bu QA **üretim altyapısı alt-dilimi** için geçerlidir: toplu tarihsel dünya verisi, oyuncuya katılım dengesi, görsel asker üretimi ve bütün olay/quest source adaptörleri bitmedi.


## 5. V1.4 — kalıcılaşmış kişi tekrar teklif edilmez (18.11.2026)

**Hedef:** Üretim kaynağının tekrar ziyaretinde zaten Named(D) olan kişiyi aday gibi sunmamak; yeniden yüklenmiş save'de dahi kararlı teklif kümesi. Önceki V1.3 kaynak doğrulamasının üstünde yalnız teknik bir aday filtresi uygulanır.

- `produceUnregisteredCharacterCandidates` gerçek `worldCharacters.characters[].id` kayıtlarını okur; `sourceType + settlementId + sourceId + slot` kimliğinin **kalıcı olarak kaydedilmiş** olup olmadığını kontrol eder. Kayıtlı ise slotu atlayıp sonraki boş slotu arar. Teklif kartının kaynak kimliği, isim/rol/stat algoritması ve kayıt biçimi değişmez.
- `candidateSlots`, `nextSlot` ve `rosterFull` salt-okunur teknik çıktı alanlarıdır. Yerleşim ve aktör kayıtlarına yazılmaz; özel aday defteri, bekleme/gün sayacı, otomatik yenilenme, tazelenme süresi veya nadirlik oranı **tanımlanmaz**.
- `GameFlowManager.previewWorldCharacterCandidates` yeni salt-okunur filtreyi kullanır. `registerProducedCharacter`, `NamedCharacter(D)` ve `seeded-delta-v1 additions` aynı sözleşmede kalır. Dünya kaydına yeni alan eklenmez; yayınlanmış save migration ihtiyacı doğmaz.
- **Karar sınırı:** Onaylı Character System v2 gereği *seçilmemiş* `GeneratedPerson` kayda girmez. Bu sebeple yalnız gösterilip seçilmeyen adayın gelecekte aynı slotla tekrar görünmesi mümkündür. Kullanıcı yeni bir `rejected/seen` teklif defteri, ücret, yenilenme aralığı, kıtlık veya günlük popülasyon üretimi onaylamadıkça bunları gizlice açmayız. Bu özellik yalnız **zaten kalıcılaşan kişi** tekrar sunulmasını engeller.
- **Şehir V2 uyumu:** `CITY_BUILDING_CATEGORY.FOOD` alanındaki gıda yapıları (fırın, kasaphane/balıkhane vb.) `production` kaynağına otomatik bağlanmaz. Karar defterinde gıda alanı ile üretim/zanaat alanı ayrıdır. Kaynak adaptörü yalnız gerçekten inşa edilmiş `INDUSTRY` binalarını üretim kaynağı kabul eder. Gıda/ikmalde adam alma mekanizması sonraki açık karar konusudur.
- Testler: boş yerleşim/adayı teklif etme, aradan seçilen slotu sonraki sorguda atlama, diğer kişilerin değişmeden kalması, kayıt/yükleme sonrası slot kararlılığı, tam dünya kimlik kapasitesi, batch 1..8, gerçek Chromium'da kalıcılaştırılmış kişinin yeni teklifte görünmemesi.

**Kabul:** [PR #68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) altında testler final commit SHA için kontrol edilecek. Bu iş üretim algoritması alt parçasıdır, bütün karakter AI'sinin veya otomatik adam alma oyun döngüsünün tamamlandığı anlamına gelmez.
