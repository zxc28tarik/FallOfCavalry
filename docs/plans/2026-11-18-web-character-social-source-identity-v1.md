# Fall of Cavalry WEB — Character System v2 V1.9: Tarihsel kaynak ve gerçek kişi kimliği ön doğrulaması

**Tarih:** 18 Kasım 2026 · **Proje:** yalnızca `zxc28tarik/FallOfCavalry` WEB · **Durum:** kaynak/kişi eşleştirme **teknik alt işi QA PASS**; gerçek tarihsel veri girişi ve kişi içeriği hâlâ **açık**. **Karar otoritesi:** `FOC-Karar-Defteri-Guncel.md` §7 Character System v2, §10 Aile ve §11 Hizip. PR: [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) (DRAFT; main'e birleştirilmedi).

## Amaç ve kaynak ayrımı

- Karar defterine göre **A/B karakterlerin aileleri kesin takip edilir**, C aileler olabilir, aileye girmiş D kalıcı takip edilir; aile **hizip değildir**, hizip de **devlet/faction değildir**. Tam CK tarzı soy ağacı, karmaşık miras mücadelesi ve entrika sistemi *rafa kaldırılmıştır*.
- V1.8'de oluşturulan authoritative `HouseState/CliqueState` kapısı, güvenilir oyun içi tanımları olmayan sosyal grupları etkinleştirmiyordu. V1.9 bu kapının **kanıta dayalı karakter referanslarıyla nasıl doldurulacağını denetler**; henüz tarihsel aile/hizip eklemez.
- Var olan 1.762 başlangıç NPC'sinin adları seed'den gelen **üretim şablonlarıdır**, tarihsel şahıs kimlikleri **değildir**. Aynı adın bulunması kimlik doğrulaması sayılmaz. Bu şemadaki `reviewStatus: 'approved'` yalnız editoryal iş akışı işaretidir; *tarihsel doğruluğun ya da kullanıcının onayının kendiliğinden kanıtı değildir*.
- Bu aşamada gerçek tarihsel kaynak araştırması yapılmadı ve doğrulanmış karakter kayıtları ithal edilmedi. `js/data/character-social-source-manifest.js` **bilinçli olarak boş** kaynak dosyasıdır.

## Veri sözleşmesi (V1.9)

`js/systems/character-social-source-manifest.js` içindeki `compileCharacterSocialSourceManifest(manifest, { roster, settlements })` üç kayıt akışını tek, deterministik ve yan etkisiz ön doğrulamada birleştirir:

| Girdi | Zorunlu alanlar | Kontrol |
| --- | --- | --- |
| `sources[]` | `sourceId`, `title`, `locator`, `reviewStatus:'approved'` | Kimliği tekrarsız, başlık/referans mevcut ve temiz; taslak kaynak kullanılmaz |
| `people[]` | `personKey`, `characterId`, `expectedName`, `sourceId` | Var olan **NamedCharacter** ID'si ve tam adı birebir örtüşür; kaynak kayıtlıdır; takma ad/numara çakışmaz |
| `houses[]` | `houseId`, `houseName`, `houseHeadPersonKey`, `sourceId` | Doğrulanmış kişi bağlantısı ve kaynak gerekir; reis uydurulmaz |
| `cliques[]` | `cliqueId`, `cliqueName`, `leaderPersonKey|null`, `parentCliqueId|null`, `centerCityId|null`, `cliqueType|null`, `sourceId` | Lider varsa doğrulanmış kişi, merkez varsa gerçek şehir, üst hizip varsa kayıtlı ve döngüsüzdür |

- `personKey` araştırma dosyasındaki benzersiz başvurudur; **oyun karakter ID'sinin yerine geçmez**. Aynı isimli iki NPC arasında isim yakınlığına göre seçim yapılmaz. Kaynak, karakter ID'si ve adı açıkça bağlanır. Birden fazla kaynaktan aynı kişinin teyidi için ayrıntılı birleştirme/çoklu atıf sistemi ileride tasarlanacaktır.
- Dönüş: `{ catalog, sources, people, diagnostics, accepted }`. Hatalar `invalid_manifest`, `unapproved_source`, `unresolved_identity_binding`, `character_id_or_name_mismatch`, `unresolved_house_source_or_head`, `unresolved_clique_source_or_reference`, `invalid_clique_hierarchy` vb. *ayırt edilebilir kodlarla* listelenir.
- **Atomik yayın kapısı:** `accepted === false` ise derlenmiş kısmi katalog **oyun otoritesine alınmaz**. Varsayılan `getAuthoritativeCharacterSocialGroups` yalnız tamamı geçerli, oyun dosyasındaki source manifesti kullanabilir; geçmiş veya dışarıdan yazılmış save verisini kaynak saymaz. Mevcut `state.characterSocialAuthority` yolu yalnız **güvenilir oyun boot kodu/test fixture** enjeksiyonu için korunur.
- Derlenen katalog yalnız `houses` ve `cliques` tanımlarıdır. Buradan **otomatik aile üyeliği, kan bağı, evlilik, miras, hizip üyeliği, rütbe, servet, nüfuz, sadakat veya asker gücü** oluşturulmaz.
- Mevcut `characterSocialPending` (eski sosyal kayıtların etkin olmayan karantinası), `worldCharacters.seeded-delta-v1` ve `characterOrganization` formatlarına dokunulmaz. Kaynak manifesti **save içinde yazılmaz**.

## QA ve kanıt

- Kod/test revizyonu: `bb9d907e5780a3f0943fd821c837d8f91e547c13`.
- [Web validation #44298356317](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44298356317) **PASS**: **582/582 unit**, **994/995 tam Vitest** (1 skipped), lint/statik/production build/hygiene PASS. Dünya bütünlüğü: 881 yerleşim, 304 yol, 3 nehir, 4 geçit, **0 error, 1 önceden mevcut warning**.
- [Gerçek Chromium #44298356418](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44298356418) **PASS**: tam dünya boot, 1.762 NPC, 1.975 üretim kaynağı, D→C, oyuncu üyeliği ve görevleri, save/load, `noInventedSocialTies`, `noInventedSocialTiesAfterLoad`, 0 konsol hatası.
- `tests/unit/character-social-source-manifest.test.js`: **9 yeni test**. Boş katalog, doğru kaynak-kişi eşleştirmesi, yalnız adla eşleştirmeme, generated/missing kişi reddi, taslak kaynak/atıf eksikliği, aynı ID ve anahtarın tekrar kullanımı, sahte şehir, döngü/dangling alt-hizip, atomik reddetme ve güvenilir katalogla gerçek SaveManager/SaveSystem roundtrip.

## Kalan kararlar ve sonraki mühendislik

1. **CharacterDefinition otoritesi:** gerçek tarihsel kişileri seedli takma isim havuzlarından ayrı ve sürümlü, kalıcı kimlikle tanımlayacak içerik otoritesi. Şu an **yok**, dolayısıyla araştırılmış gerçek aileleri generated NPC'lerle otomatik eşleştirmemek esastır.
2. **Kaynak toplama ve insan incelemesi:** belge/ad/ünvan/varyant ad, referans/yerleşim/tarihsel dönem, kaynak çelişkileri ve kullanıcıca onaylı tarihsel veri listesi. `approved` alanını yalnız içerik gözden geçirme süreci dolduracak; bu V1.9 içerik onayı vermez.
3. **Aile/hizip katalog içeriği:** A/B aile kapsamı, C/D aile kuralları, miras, aile prestij/onuru/serveti, hizip gücü/tavrı ve aile-hizip arası ilişkilerin oynanış kuralları henüz tamamlanmadı.
4. Varsayılan `AUTHORED_CHARACTER_SOCIAL_CATALOG` V1.8 boş uyumluluk sabitidir; **V1.9 sonrası varsayılan giriş**, yeni kaynak manifestinden derlenmiş katalogdur. Eski boş dosyadan tarihsel grup üretimi yapılmaz.
5. PR #68 taslak kalır. Ana paket `O00-06` **UYGULAMADA**; V1.9 alt iş QA PASS, bütün Character System v2 DONE değil.

**Not:** Bu belge mevcut kararlardan teknik uygulama üretir; kaynakların tarihsel doğruluğunu kanıtladığını, onaylanmamış dünya verisini başlattığını veya Unity projesini değiştirdiğini iddia etmez.
