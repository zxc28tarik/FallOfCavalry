# Fall of Cavalry WEB — Character System v2: Aile / Hizip bağlayıcı katmanı V1.7

**Tarih:** 18.11.2026 · **Kapsam:** yalnız `zxc28tarik/FallOfCavalry` WEB projesi · **Durum:** PR #68 taslak; sosyo-politik veri üretimi değil, şema/bağlantı/integrity altyapısı.
**Karar otoritesi:** Kullanıcının `FOC-Karar-Defteri-Guncel.md` §7 **Character System v2**, §10 **Aile Sistemi**, §11 **Hizip Sistemi**.

## Tasarım otoritesi ve mevcut gerçeklik

- **Aile hizip değildir**: aile; soy/hane/kan bağı, olası evlilik, mal ve miras gibi ilişkilerin otoritesidir. Her ailenin reisi olur; A/B karakterlerin ailelerinin kesin takibi hedefi korunur. Ancak aile üyeliği otomatik evlilik/kan bağı veya miras anlamına gelmez.
- **Hizip aile veya devlet değildir**: sosyal, ekonomik, askerî, dinî güç odağıdır. Üyelik zorunlu değildir. Küçük/orta hiziplerin bağımsız veya başka bir büyük hizbe alt kol olması kararı korunur. `parentCliqueId` sadece mevcut gerçek `CliqueState` ID'sine işaret eder; döngü/boş referans silinir.
- **Gerçek veri durumu:** 18 Kasım web repo ağacında `HouseState` veya `CliqueState` gerçek dünya örnekleri, tarihsel aile/hizip manifesti veya onları üreten bir owning system bulunmadı. Bu yüzden **hiçbir karaktere yapay soy/hizip atanmaz**; testteki açık `house:test` ve `clique:test` örnekleri yalnız test fixture'dır ve canlı kampanyaya girmez.
- Aileye bağlı olmak hizbe üyelik değildir. Bir ailenin bir veya daha çok hiziple explicit bağlantısı olabilir; bu, aile üyelerini otomatik hizbe sokmaz. Aile/hizip bağı ile devlet/faction bağlantısı da farklıdır. Önceki altı oyuncu organizasyonu dalı bu işte değişmez.

## Kodlanan teknik katman

`js/systems/character-social.js` aşağıdaki ayrı ve sürümlü veriyi sunar:
```text
characterSocial: {
  version: 1,
  houses: HouseState[],
  cliques: CliqueState[],
  houseMemberships: {characterId,houseId,joinedDay,reason}[],
  cliqueMemberships: {characterId,cliqueId,joinedDay,reason}[],
  houseCliqueLinks: {houseId,cliqueId,joinedDay,reason}[]
}
```

- **HouseState (asgari):** `houseId`, `houseName`, `houseHeadCharacterId` (mutlaka gerçek kalıcı karakter). Nam, onur, mal, mülk, varis, aile içi konum gibi alanlar henüz canlı hesaplanmaz.
- **CliqueState (asgari):** `cliqueId`, `cliqueName`, `cliqueType` (liste onaylanmadığı için opsiyonel/null), `leaderCharacterId` (opsiyonel), `centerCityId` (opsiyonel, varsa gerçek şehir), `parentCliqueId` (opsiyonel, varsa kayıtlı başka hizip; döngüsüz).
- **Açık insan bağlantıları:** yalnız `NamedCharacter` ID'leri; ilişkiler ayrı kenar kaydıdır, `person.role` veya `characterOrganization` modifiye edilmez. Yeni bağlantı için yaşayan kişi, gerçekten mevcut aile/hizip, kampanya günü ve açık gerekçe aranır. Ölü önemli karakterlerin geçmiş bağlantıları korunur.
- **Aile-hizip ilişkileri:** `linkExistingHouseToClique` yalnız mevcut ve gerçek iki grubu bağlar; hiçbir üyeliği topluca dağıtmaz. Yüzde, politik güç, sayısal nüfuz, aile mirası veya clique attitude hesabı yapmaz.
- **Güvenlik:** imla/sürüm/kapsam filtresi, tekrarlanan kenar engeli, kayıp kişi/şehir/grup referansı reddi, döngüsel parent hizip referansını kaldırma, bounded veri boyutu. Kaynak içerik kendiliğinden gerçek kabul edilmez: oyun içi owning sistem ayrı gerçek `HouseState/CliqueState` manifesti sağlamalıdır. Şimdilik yapıya veri yazan herkese açık grup yaratma API'si yoktur.
- **GameFlowManager:** `getWorldCharacterSocialProfile`, `linkWorldCharacterToHouse`, `linkWorldCharacterToClique`, `linkWorldHouseToClique`. Bu API'ler hiçbir kuruluş oluşturmaz; kayıt ön koşulu karşılanmazsa false döner. Test fixture dışında canlı dünyada henüz bağlantı üretilemez.
- **Kaydet/yükle:** `SaveManager` opsiyonel `game.characterSocial` yan kaydını yazar, `SaveSystem` biçimi temizler, `SaveManager` gerçek dünya ve kişi registries yeniden kurulunca ilişkileri tekrar doğrular. Önceki `worldCharacters.seeded-delta-v1` ve `characterOrganization` aynen kalır. Eski save'de yoksa tamamen boş varsayılır.

## Bilerek yapılmayan işler

**Kullanıcı oyun tasarımı kararı gerektiren ve burada açılmayanlar:** Tarihsel aile/hizip veri kaynağı; A/B karakterlerin ailelerinin kapsamlı doldurulması; evlilik, kan bağı, tam soy ağacı (zaten kapsam dışı), miras, aile namı/onuru, servet/mülk, hizip türleri ve ağırlıkları, hizip tavrı ve güç hesapları, canlı aile reisi devri, hiyerarşik görev yetkileri, siyasi kontrol, yapay zekâ, asker ve ekonomik bonuslar. Bağlılık için toplam eşzamanlılık limiti oyunsal olarak belirlenmedi; ilk şemadaki çoklu kayıt yetkisi bir oyun dengesi kararı değildir.

## Test ve kabul

- `tests/unit/character-social.test.js`: boş yeni kampanya; gerçek grubu olmayan bağın reddi; ayrı aile/hizip; açık örnek kaynaktan bağ; sahte karakter/şehir/parent temizliği; ölmüş önemli kişinin geçmişini koruma; eski save uyumu; `SaveManager` / `SaveSystem` tam roundtrip.
- `tools/browser-world-smoke.mjs`: gerçek Chromium'da 881 yerleşim ve 1.762 NPC başlangıcında kaynaktan Named(D)→C; üyelik/görev ayrımı korunurken sosyal kayıtların boş kalması, sahte `house:nonexistent` / `clique:nonexistent` bağların reddi ve quickSave/load.
- **V1.7 teknik alt iş QA-PASS:** Uygulama/doküman SHA `b25842312543e60e86965e0c0f6f6baf3445e1dc` üzerinde [Web validation #44292679178](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44292679178) **566/566 unit; 978/979 full Vitest (1 skipped); statik/lint/production build PASS**. Dünya: 881 yerleşim, 304 yol, 3 nehir, 4 geçit; 0 hata ve mevcut 1 uyarı. [Chromium #44292679092](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44292679092) **PASS**: 1.762 baseline NPC, 1.975 gerçek kaynak, sahte aile/hizip bağları reddi, sosyal kayıtlar boşken save/load, daha önceki Named(D)→C ve üyelik/görev döngüsü, 0 konsol hatası. Aşağıdaki kayıt notu HEAD'i ilerleteceği için final doküman commitinin CI'sı ayrıca denetlenir. PR #68 taslaktır, main'e açık onaysız merge yok.

**Çalışma sınırı:** Bu ilerleme gerçek, tarihsel aile/hizip verilerinin oluşturulduğu veya simülasyonlarının oynanabilir olduğu anlamına gelmez.
