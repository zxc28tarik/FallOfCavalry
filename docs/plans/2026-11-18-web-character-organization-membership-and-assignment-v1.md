# Fall of Cavalry WEB — Character System v2 organizasyon üyeliği ve görev ayrımı V1

**Tarih:** 18 Kasım 2026 · **Kapsam:** Yalnız `zxc28tarik/FallOfCavalry` WEB oyunu · **Durum:** Teknik alt iş PR #68 (taslak), sayısal denge ve aile/hizip bağlantıları açık.  
**Birincil karar kaynağı:** Kullanıcının `FOC-Karar-Defteri-Guncel.md` §7 **Character System v2** ve §8 **Oyuncu Organizasyonu**; bunlar Unity planı içerse de burada yalnız kararların WEB uyarlaması söz konusudur.

## Kesin tasarım kuralları ve teknik karşılıkları

1. **Kimlik (`NamedCharacter`)**: `worldCharacters.characters[]` kalıcı ID, isim, önem sınıfı (A/B/C/D), karakterin temel rol *profili*, statları, statüsü, konumu ve geçmişinin otoritesidir. Oyuncu organizasyonu üyesi olmak veya göreve atanmak karakter türünü değiştirmez. `GeneratedPerson` üyelik/görev almaz; önce Named(D) olmalıdır.
2. **Üyelik (`CharacterOrganizationState.memberships`)**: Her satır `characterId, branch, joinedDay, reason` taşır. Yalnız **altı kesin ana dal** desteklenir: `party` (PlayerParty), `household` (PlayerHousehold), `army_network` (PlayerArmyNetwork), `city_administration` (PlayerCityAdministration), `trade_network` (PlayerTradeNetwork), `diplomacy_network` (PlayerDiplomacyNetwork). Aile üyeliği ve hizip üyeliği **bu veriyle aynı şey değildir**.
3. **Görev (`CharacterOrganizationState.assignments`)**: Kişi `branch`, `assignmentRole`, `assignmentLocation`, `assignmentStartDay`, `assignmentStatus`, `employerCharacterId`, `assignedByCharacterId`, `reason` ile ayrı kayıt alır. Üyelikten bağımsızdır: ticaret ağına üye olan kişi şehir idaresi için görevlendirilebilir, üyeliği değişmez. Görev `complete` komutuyla bitirilir; `endDay/endReason` ile geçmişi korunur. Bu V1'de tek güncel aktif görev desteklenir; ikincisi açıkça kapatılmadan başlatılamaz.
4. **Gerçek konum:** Şimdilik görev merkezi yalnız **gerçek yerleşim kimliği** olabilir. Sahte ordu/kervan/hizip/görev merkezi ID'si icat edilmez. Gelecekte owning system kanonik varlık kayıtları sağladığında `army/caravan` konum bağlantıları ayrı tanımlanır.
5. **Tetikleyici:** Üyelik/görev yalnız açık `GameFlowManager` komutlarıyla kaydedilir; görev yapılmış gibi kaynak/sprite/ordu askerleri oluşturulmaz. Kayıtlar para, sadakat, nüfuz, stat, asker gücü, gerçek makam, diplomasi yetkisi, asker alımı veya `party` organizasyonu yaratmaz. Buradaki `assignmentRole` **tanımlayıcı kod**dur, gameplay izni değildir.
6. **Kimlik doğrulama:** Yalnız var olan `NamedCharacter` bağlanır. Yeni komut için yaşayan kişi, geçerli gün, temiz gerekçe, geçerli altı ana dal, gerçek yerleşim ve belirtiliyorsa kayıtlı yaşayan görevlendiren/işveren gerekir. Sahte karakter veya yerleşim reddedilir. Ölmüş kalıcı kişilerin **önceki** üyelik ve görev kayıtları kayıt/yükleme sırasında korunur.
7. **Kaydet/yükle:** Ayrı opsiyonel `game.characterOrganization` yan kaydı (`version:1, memberships:[], assignments:[]`). Var olan `worldCharacters.seeded-delta-v1` biçimi ve temel kişi satırları değişmez. `SaveSystem` ham save'i biçimsel temizler; `SaveManager` dünya ve önemli kişiler kurulduktan sonra kişilerin/şehirlerin gerçekten varlığını yeniden doğrular. Eski kayıtlar boş yan kayıtla açılır. Bütün dünya kişileri save dosyasına kopyalanmaz.
8. **Kişi kimliği ve rol ayrımı:** Kişinin ilk altı örnek rolünden gelen `person.role` alanı **meslek/rol profili** olarak kalır; `assignmentRole` o anki görevin kodudur, aynı değer olmak zorunda değildir. UI bu ayrımı gösterebilir, fakat bu işte ekran tasarımı değiştirilmez.

## Henüz onaylanmamış kararlar

- Altı kesin ana dala `settlements/estates/production/special_agents` uygulama dallarının nasıl bağlanacağı; bu V1 bunları yeni ana dal saymaz.
- Üyeliğin seviyesi, önceliği ve aynı anda kaç üyeliğin *oyunsal olarak* kullanılacağı. Teknik veri birden çok açık linki tutabilir; bu sayı veya bonus dengesi değildir.
- İktidar/makamın ve gerçek oyuncu yetkilerinin kim tarafından, hangi olay/ekonomik/askerî koşullarla verileceği. Yeni görev kayıtları **yetki ataması değildir**.
- `HouseState`, `CliqueState`, din/mezhep otoriteleri ve bağlı devlet ilişkisi farklı sistemlerdir; hiçbirisi bu yan veri tarafından uydurulmaz. Gerçek family, faction ve clan linkleri için kaynak kayıtları gereklidir.
- Ordunun, kervanın ve sahra görev merkezinin gerçek varlık ID'leri; görev sayısı, eşzamanlılık, ölüm/ayrılma sonrası organizasyon üyeliği politikası.

## QA kapıları

- `tests/unit/character-organization.test.js`: altı dal ve açık kayıt; generated/dead/fake aktör reddi; üyelik/görev bağımsızlığı; görev bitiş geçmişi; sahte varlıkların normalize/load'da elenmesi; eski save uyumu; `Named(D)` üretim → üyelik/görev → `SaveSystem` ve `SaveManager` döngüsü.
- `tools/browser-world-smoke.mjs`: gerçek Chromium'da bir şehir karakteri Named(D)→C iken ticaret üyeliği + bağımsız şehir görevi → quickSave/load; oynanabilir dünya, asker listesi ve NPC yapıları korunmalı.
- CI yalnız **aynı güncel HEAD** üzerindeki başarılı `Web validation` ve `Web Chromium browser smoke` çalışmaları denetlendiğinde DONE kabul edilir. PR #68 taslak kalır; main'e kullanıcı onayı olmadan birleştirilmez.

**Mimari sonuç:** Kişi kimliği, organizasyon bağlantısı ve aktif görevi ayrı tutulur; birbirlerinden gizli yan etkilerle türetilmez. Bu, tüm Character System v2'nin veya oyun içi AI/diplomasi/ekonomik atamaların tamamlandığı anlamına gelmez.
