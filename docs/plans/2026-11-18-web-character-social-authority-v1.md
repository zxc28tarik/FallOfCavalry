# Fall of Cavalry WEB — Character System v2 V1.8: Aile / Hizip kaynak otoritesi ve eski kayıt karantinası

**Tarih:** 18.11.2026. **Kapsam:** Yalnız `zxc28tarik/FallOfCavalry` web oyunu, [taslak PR #68](https://github.com/zxc28tarik/FallOfCavalry/pull/68). **Üst karar kaynağı:** kullanıcının `FOC-Karar-Defteri-Guncel.md` §7, §10 Aile ve §11 Hizip. Bu belge onaylanmamış oyun dengesi kararları getirmez.

## Gerekçe

V1.7, `HouseState` / `CliqueState` referanslarının biçimsel bütünlüğünü denetliyordu; ancak aile/hizip tanımlarının kendisi de `game.characterSocial` save kaydından geri yüklenebiliyordu. Bu durum save içinde iyi biçimlenmiş fakat oyun dünyasında var olmayan bir aile veya hizip tanımının aktifleştirilmesi riskini yaratıyordu. Bu teknik açık V1.8'de yetkili kaynak ile değiştirilebilir kampanya kayıtları ayrılarak giderildi.

## Kaynak otoritesi

- `js/data/character-social-catalog.js` oyun kaynak dosyasının tek kanonik varsayılanıdır. **Henüz doğrulanmış gerçek aile/hizip listesi olmadığından `houses: []`, `cliques: []`.** Tarihsel kişi adı, soy/hizip ve siyasi bağ uydurulmaz.
- `js/systems/character-social-authority.js` kanonik tanımları gerçek `NamedCharacter` ve yerleşim kayıtlarıyla doğrular. Aile reisi kalıcı karakter olmalı; varsa hizip lideri kalıcı karakter, merkez şehri gerçek yerleşim, parent hizbi var ve döngüsüz olmalıdır.
- Tanımlar için bir derleme/oyun-verisi yükleme hattı hazırdır. İleride kaynak içeriğini hazırlayan **güvenilen oyun kodu** `state.characterSocialAuthority` üzerinden authored katalog verebilir; bu alan `SaveSystem` veya `SaveManager` ile save'den okunmaz. Fixture kataloğu yalnız unit testlerde kullanılır. Kullanıcı açık onayı olmadan kurgusal/historik katalog eklenmez.
- `GameFlowManager.getWorldCharacterSocialProfile/linkWorldCharacterToHouse/linkWorldCharacterToClique/linkWorldHouseToClique` artık her çağrıda bu kaynak kapısından geçer. Var olmayan gruba bağlantı kurmak veya save dosyasını grup kaynağı saymak mümkün değildir.
- Aile üyeliği ve hizip üyeliği bağımsızdır. Aile-hizip kenarı aile üyelerine otomatik clique membership vermez. Grup tanımı tek başına itibar, para, asker, din, makam veya soy ilişkisi yaratmaz.

## Save / eski veri sürekliliği

1. `game.characterSocial` **etkin** sosyal kayıtları içerir; V1.7 ile biçim uyumu için kanonik grupların kimlik tanımları burada hâlâ *snapshot* olarak görünebilir. Bunlar **kaynak otoritesi değil**, kayıt/uyumluluk verisidir. Save'in etkili üyelik ve bağları yalnız eşleşen yetkili katalogdan geri kurulur.
2. `game.characterSocialPending` **doğrulanamayan geçmiş kayıtların etkin olmayan karantinasıdır**. Eski V1.7 snapshot'ı sessizce kaybedilmez, fakat UI/AI/görev/oyuncu yetkisine karışmaz.
3. Yeni bir güvenilen katalog ileride ilgili `houseId/cliqueId` ile **tanımın diğer alanlarını da aynı** getirirse, eski snapshot'taki ilişkiler katalog otoritesi altında yeniden etkinleştirilebilir. Sadece aynı ID yeterli değildir: başka aile adı/başka reisi olan sahte kayıt yeni gerçek gruba bağlanmaz.
4. `SaveSystem` iki alanın biçimini temizler; `SaveManager` gerçek NPC/yerleşimler restore edildikten sonra kaynak + kayıtları yeniden uzlaştırır. Eski kayıtlarda ikisi yoksa ikisi de boş açılır. `worldCharacters.seeded-delta-v1`, `characterOrganization` ve asker rosterı biçimleri değiştirilmedi.
5. **Karantinadan otomatik siyasi oynanış çıkmaz.** Bu aşama kayıt güvenliği ve gelecekteki veri migrasyonu altyapısıdır; gerçek tarihsel aile/hiziplerin içeriği, gameplay ekonomisi ve liderlik devri değildir.

## Testler ve devam eden sınırlar

- `tests/unit/character-social-authority.test.js`: kaynak yoksa sıfır aile/hizip; sahte save tanımının reddi ve karantinada tutulması; sonra eşleşen resmi katalogla bağlantı kurtarma; aynı ID ile başka isim/reis spoof'unun engellenmesi; sahte merkez ve geçici reisin reddi; ölmüş kalıcı karakter bağlantı sürekliliği.
- `tests/unit/character-social.test.js`: V1.7'nin kaynak temelli fixture entegrasyonu korunur; SaveSystem/SaveManager uçtan uca testi artık **açık test kataloğu** kullanır.
- `tools/browser-world-smoke.mjs`: gerçek Chromium'da katalog boş ve hiçbir sahte family/clique bağlantısı yokken normal save/load; `characterSocialPending` gereksiz verilerle dolmaz; NPC, rol, görev ve asker sistemleri etkilenmez.
- Alt işin kabulü için güncel kod/dokümantasyon HEAD üzerinde Web validation ve Chromium **PASS** kanıtı gerekir. Dünya bütünlüğü genel uyarısı bağımsızdır.

**Açık kararlar:** Hangi gerçek aile/hizipler oyun dünyasına eklenecek, tarihsel kaynakların onayı, A/B aile kapsamı, `housePrestige`, `houseHonor`, `houseWealth`, miras, hizip tavrı, güç ağırlıkları, aile/hizip ilişkilerinin olay kaynakları. Hiçbiri V1.8'de kendiliğinden doldurulmaz.

**Durum:** V1.8 altyapı **QA PASS**. Uygulama/doküman SHA `053f5b0b84697ef7a2c6605a7c129cdc548d0cc0`: [Web validation #44295496720](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44295496720) **573/573 unit; 985/986 full (1 skipped)**; lint/static/build/hygiene PASS; 881 yerleşim, 304 yol, 3 nehir, 4 geçit; **0 hata, 1 mevcut uyarı**. [Gerçek Chromium #44295496745](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44295496745) **PASS**; kaynak üretim/Named(D)→C, üyelik/görev, save/load ve kaynak yokken hayalî sosyal grupların reddi; 0 JS konsol hatası. QA notu için oluşan sonraki doküman HEAD ayrıca CI denetiminden geçecektir. **Character System v2 bütünü UYGULAMADA**.
