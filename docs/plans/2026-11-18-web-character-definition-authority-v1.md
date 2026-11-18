# Fall of Cavalry WEB — Character System v2 / V1.10: CharacterDefinition ve kalıcı önemli kişi kimliği

**Tarih:** 18 Kasım 2026 · **Proje:** yalnız `zxc28tarik/FallOfCavalry` web oyunu (Unity değil) · **Kapsam:** V1.10 teknik alt iş · **Ana görev:** `O00-06` hâlâ UYGULAMADA.  
**Bağlayıcı kaynak:** `FOC-Karar-Defteri-Guncel.md` §7 Character System v2, §10 Aile, §11 Hizip; AGENTS.md ve `docs/plans/web-rebuild-v2` çerçevesi. Tasarım otoritesindeki “JS'de yok, Unity'de sıfırdan kurulacak” cümlesi tarihsel projelendirmedir; burada kullanıcı yönlendirmesiyle mevcut **web oyunu** geliştirilmiştir.

## 1. Giderilen eksik

Web'de `GeneratedPerson` seed ile üretiliyor, `NamedCharacter(D)` aynı ID korunarak terfi alıyor ve `A/B/C/D` önem geçişleri ayrı olayla yönetiliyordu. Ancak **gerçekten önceden tanımlanmış önemli kişiyi**, üretilmiş isim havuzlarından ayıran ve oyuna *kalıcı, seed'den bağımsız* kimlikle yükleyen `CharacterDefinition` veri otoritesi yoktu.

V1.10 bu teknik boşluğu giderir, tarihsel şahısları **kendiliğinden üretmez**. `A/B/C` başlangıç önem sınıfları katalog tarafından açıkça seçilir; `D` generated-origin kalıcılaştırma sınıfı olarak korunur. Yoldaşlık ayrı karakter türü değildir.

## 2. Yeni veri katmanı

| Dosya | Sorumluluk |
| --- | --- |
| `js/data/character-definition-catalog.js` | **Kanonik, güvenilir ve şu anda boş** `{version:1,sources:[],definitions:[]}` manifesti; gerçek kişi/hane adı icat etmez |
| `js/systems/character-definitions.js` | `CharacterDefinition` kaynak kimliği, onay etiketi, yerleşim bağlantısı, benzersizlik, stat ve NamedCharacter runtime şeması doğrulaması |
| `js/systems/world-characters.js` | Opsiyonel `authoredCharacters` listesini seeded baseline'a **sadece güvenilir içerikten** ekler; önceden var olan seeded NPC'leri kaydırmaz veya üzerine yazmaz; delta save/load geri kurar |
| `GameFlowManager` | `startNewGame` sırasında güvenilir manifest derlemesi; `getWorldCharacterDefinition` okuma köprüsü |
| `SaveManager` | Aynı katalog üzerinden authored baseline'ı kayıt/yüklemeye bağlar; kaynak manifestini save içine yazmaz |

### CharacterDefinition sözleşmesi

Her karakter kaydında `personKey`, `characterId`, `sourceId`, `name`, opsiyonel `title`, `cultureId`, opsiyonel `originFactionId`, `importance` (A/B/C), `role` (mevcut teknik rol profillerinden biri), `age`, `traits`, dokuz alanlı **açık `stats`**, `loyalty/satisfaction/reputation/standing`, `status` (alive/dead) ve **mevcut `settlementId`** bulunmalıdır. Din/mezhep alanları `religionId/sectId` olarak isteğe bağlı metadata'dır; varsayılan inanç atanmaz. `gender` opsiyonelliği ve son gameplay etkisi ayrı şema/Rules kararına bırakıldı.

Kaynak kaydı `sourceId/title/locator/reviewStatus:'approved'` taşımalıdır. `approved` yalnız editoryal işarettir, kullanıcı onayının veya tarihsel doğruluğun kanıtı değildir; gerçek tarihsel içerik için ayrıca kaynak incelemesi ve kullanıcıca yetkilendirme gereklidir. Katalog **boş** olduğundan oyuna hiçbir tarihsel kişi girmedi.

### Kalıcı ID ilkesi

`characterId` yeni, ayrı `npc:authored-<slug>:<sayı>` ad alanındadır; isimden veya mevcut şehir/seed sırasından türetilmez. `personKey` araştırma atıf/eşleştirme anahtarıdır; runtime kimliğinin yerine geçmez. `source-produced` NPC'lerin `npc:source-...` ve yerleşim baseline NPC'lerinin `npc:<settlement>:<slot>` kimlikleri değişmez. Ad benzerliği, kültür havuzu veya seçili devlet tek başına tarihsel kişi kimliği sayılmaz.

## 3. Runtime, kayıt/yükleme ve güvenlik

- **Atomik manifest:** Tek bir eksik/uygunsuz kaynak, görev-dışı rol, 0–100 dışı stat, çakışan ID, geçersiz yerleşim, D başlangıç sınıfı, sahte ad veya eksik status varsa compiler `accepted:false` döner. **Hiçbir kısmi authored kişi oyuna girmez**; hata listesi `diagnostics` tutulur.
- **Tekil kaynak:** `startNewGame` ve `SaveManager`, yalnız trusted boot-scope `characterDefinitionAuthority` veya varsayılan boş oyun dosyasını okur. Bu alan **save şemasına eklenmez**, kullanıcı save'i tarihsel tanım üretemez.
- **Seeded baseline:** Normal `createWorldCharacterRoster`, eski NPC setini aynı üretir; daha sonra doğrulanmış `Named(A/B/C)` ayrı eklenir. Kapasite, aynı ID ve gerçek şehir kontrolü vardır. D→C yükseltme politikası değiştirilmez.
- **Sparse save:** `createWorldCharacterSave` baseline'a authored karakterleri dahil eder. Kayıt biçimi `seeded-delta-v1` olarak kalır; değişmemiş authored kişiler yeniden kopyalanmaz; stat/önem/tarihçe değişiklikleri yalnız override olarak saklanır. Restore eski delta'ya güvenilir katalogdan yeni authored karakter ekleyebilir. Kaynak kaynaklı `additions` kabul kuralı değişmez.
- **Kimlik saldırısı engeli:** Authored ID için save override'ı, kanonik ad/kültür/ilk bağlı devlet/başlangıç yaşıyla çelişirse reddedilir; doğru ID'nin değişmiş olay/önem geçmişi korunur. Yetkisiz authored ID'si delta `additions` üzerinden eklenemez.
- **Eski packed full-save:** Kanonik kaynak olmadan kaydedilmiş bağımsız authored kişilerin kaybolmaması için yeni save üretimi gerekirse `packed-v1` tam kayıt biçimine düşer. **Eski full-save restorasyonu mevcut davranışı korur**; katalog sonradan eklendiğinde eksik authored kişileri otomatik geriye doldurma yalnız `seeded-delta-v1` yolu için desteklenir. Bu bilinen geçiş sınırıdır.
- **Sosyal bağlantı:** V1.9 `compileCharacterSocialSourceManifest`, bir kişinin `characterId` + beklenen tam adını yeni kaynaktan gelen `NamedCharacter` üzerinde doğrulayabilir. Evlilik, soy, hane üyeliği, miras, makam veya hizip üyeliği **otomatik oluşmaz**.
- **Kapsam sınırı:** Eski dokuz stat alanı ve altı rol profili, web'in güncel geçici runtime şemasıdır; karar defterindeki daha geniş stat listesi, loyal/reputation baseline ayrımı, meslek/ana-yan roller, görev, `CurrentInfluence` gibi son şema kararları bu alt işte tamamlanmış sayılmaz.

## 4. Doğrulama

**Kod/test HEAD:** `eecb8aff25748a81d1d8878dd61f8f70990308cf`.

- [Web validation #44301730813](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44301730813) **PASS**: **594/594 unit**, **1006/1007 full Vitest (1 skipped)**; lint, static, production build ve repository hygiene başarılı.
- [Chromium #44301730844](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44301730844) **PASS**: gerçek 881 yerleşim, 1762 başlangıç NPC, 1975 kaynak, Named(D)→C, üyelik/görev, sosyal verinin boş kalması, authored kataloğunun boşluğu, save/load, 0 JS hata.
- Dünya veri denetimi: **881 yerleşim, 304 yol, 3 nehir, 4 geçit; 0 hata, 1 mevcut uyarı**.
- `tests/unit/character-definitions.test.js`: 12 test; tam kaynak/stats, atomik reddetme, ID çakışması, generated NPC korunması, seeded sparse save, A/B önem geçmişi, kimlik sahteciliği, eski delta göçü, sosyal kaynak eşleşmesi, SaveManager/SaveSystem ve full-save fallback.
- `tools/browser-world-smoke.mjs`: sıfır authored kaydı varsayılanı, yeni `getWorldCharacterDefinition` generated NPC'yi tarihi kişi ilan etmemesi ve kayıtta katalog sızıntısı olmaması ayrıca denetlenir.
- QA kanıtından sonra durum belgesi HEAD'i ilerleteceği için **son SHA'nın iki workflow'u** tekrar kontrol edilir.

## 5. Kalanlar

Gerçek tarihsel kişi/kaynak kataloglarının bağımsız arşiv/bibliyografya incelemesi ve insan onayı; tüm A/B kişiler için gerekli aile bağlantılarının içerik olarak sağlanması; A/B/C stat dengesi; ana/yan roller; diğer stat ve `BaseLoyalty` ayrımı; din/mezhep bağı; tarihsel unvanın UI sunumu; olay tabanlı görev/karakter gelişimi, aile reisi/miras/servet, hizip güç dengesi. **Hiçbiri bu teknik eklemeyle aktif edilmiş veya onaylanmış değildir.**

**Sonuç:** V1.10 önemli kişi kimlik ve authored başlangıç katmanı teknik olarak uygulanıp doğrulandı; Character System v2 bütünü ve O00-06 ana paket **UYGULAMADA**, PR #68 **taslak** ve `main` üzerinde değişiklik yok.
