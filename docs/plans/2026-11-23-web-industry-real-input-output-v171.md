# Fall of Cavalry WEB V1.71 — Gerçek girdili şehir sanayisi

**23 Kasım 2026** · `codex/web-world-npc-roster-20261118` · PR #68 (draft). Bu değişiklik web JavaScript oyunundadır; Unity tarafına, `main` dalına veya kullanıcı tarafından onaylanmış başka sistem kararlarına dokunmaz.

## Problemin kaynağı

V1.70, gerçek City V2 bina parselleri ile iki gıda dönüşümünü aynı `state.markets[id].stocks` pazar kaydına bağladı. Fakat kanonik şehir kataloğundaki diğer gerçek atölyeler yalnız görünüm/servis olarak duruyordu. V1.71, yalnız mevcut mal kataloğuyla teknik ve tarihsel açıdan makul bir girdi ve çıktı eşleşmesi yapılabilen imalathaneleri üretime bağlar.

## Canlı gün içi imalat zinciri

**Tüm oranlar PROVISIONAL / ASSISTANT_FILLED oyun dengesi; fiziksel ölçü ya da kullanıcı onaylı tarihsel üretim katsayısı değil.**

| Kurulu gerçek şehir binası | Var olan pazardan tüketim | Var olan pazara çıktı | Lojistik kapasite koşulu |
| --- | --- | --- | --- |
| `mill` Değirmen (V1.70) | 2 `wheat` | 1 `flour` | İyileştirilmiş su |
| `bakery` Fırın (V1.70) | 1 `flour` + 1 `wood` | 1 `bread` | İyileştirilmiş su + drenaj |
| `tannery` Tabakhane | 1 `leather` + 1 `salt` | 1 `processed_leather` | İyileştirilmiş su + drenaj |
| `weaving_house` Dokuma Atölyesi | 2 `wool` | 1 `cloth` | İyileştirilmiş su |
| `blacksmith` Demirci | 1 `iron` + 1 `wood` | 1 `iron_tools` | İyileştirilmiş yol |
| `carpenter` Marangoz | 1 `timber` + 1 `iron_tools` | 1 `furniture` | İyileştirilmiş yol |
| `paper_mill` Kâğıt İmalathanesi | 1 `cloth` (bez/paçavra girdisi için mevcut stok temsili) | 1 `paper` | İyileştirilmiş su |
| `farrier` Nalbant | 1 `iron` + 1 `wood` | 2 `horseshoe` | İyileştirilmiş yol |

**Günlük yürütme:** Eski `EconomyManager.processDailyEconomy` → `trade.advanceMarketOneDay` → deterministik piyasa hareketi → `advanceCityMarketCycle`. Üretim sırası hammaddeden ara mala, ara maldan işlenmiş ürüne aynı gün geçebilecek şekildedir. Aynı hammaddeden üretim yapan iki atölye hangi sırada stok kalmışsa o stokla çalışır; hiçbiri rezervasyon veya karşılıksız üretim ayrıcalığına sahip değildir.

**Kesin kurallar:** Gerçek `cityState.parcels[].buildingIds` ve katalog ID'si gerekir. En fazla üç gerçek bina üretim hacmine sayılır; bina başına 1 parti/gün; uygun, gerçek Kethüda iyileştirmesi ve ilgili hizmetin en az %50 nüfusa erişimi varsa 2 parti/gün. Her parti için her girdi önceden mevcut ve yeterli, çıktı da yerleşimin kanonik stok tavanının altında olmalıdır; aksi halde **o parti atomik olarak hiç çalışmaz**. Malzeme stoğu ve depo dışında üretim yapılmaz. `city.marketStock` ile `state.markets[id].stocks` arasındaki var olan güvenli köprü korunur; ikinci ledger yoktur. Atölye girdi/çıktıları eski `workshop_input` ve `workshop_output` audit hareketlerine düşer.

**Nüfus tüketimi:** V1.70'in aynı pazardan gündelik gıda tüketimi ve kıtlık fiyat baskısı değişmedi. İmalathaneler oyuncuya bedava altın ya da üretim geliri dağıtmaz. Birinci taraf çekirdek `advanceMarketOneDay` API'sinin önceki `undefined` dönüş sözleşmesi de aynen korunur.

## Bilerek eklenmeyen üretimler

Kanonik ticaret kataloğunda boya maddesi/indigo, sabun için alkali/kül, mum için balmumu/don yağı, taş ustasının işlenmiş yapı malzemesi gibi uygun nihai girdiler/çıktılar henüz tanımlı değildir. Bu nedenle `dyeworks`, `soapworks`, `chandlery`, `stoneworks` kurulu olsalar da V1.71 **mal yaratmazlar**. Önce kanonik mal/işleme kararları ve UI tüketim yeri gerekir.

## UI

`city-services.js` Şehir İaşesi bölümünde günlük nüfus ihtiyacı, gerçekten kurulu atölye sayısı ve açılabilir tarif/üst sınır listesi gösterilir. Aktif imalathaneler öne gelir. **“Malzeme varsa işler”** ifadesi gün içinde stok/girdi/depo koşulu olmadan çalışır vaadi değildir.

## Test stratejisi

Yeni `tests/unit/city-industrial-chains-v171.test.js`: 7 vaka. Katalog bütünlüğü, dokuma→kâğıt ve demirci→marangoz zinciri, tabaklama/nalbant, eksik girdi/tam depo atomikliği, altyapı doğrulaması, save-restore ile aynı gün tekrar üretim engeli. `tests/unit/city-market-cycle-v170.test.js` önceki fırın/değirmen beklentisini 8 tarif içinde doğru filtreler. Tüm V1.70 stok/iaşe ve daha eski ticaret testleri koşul olarak korunur.

## İşçilik ve bakım (bilinçli ertelendi)

Kullanıcı altınından otomatik masraf kesmek için şehir hazinesi, hak sahipliği, maaş dağıtımı ve atölye sahipliği otoriteleri hâlen kanonik biçimde bağlanmış değildir. Bu kapsamda kimseye sessiz günlük altın borcu yaratılmaz. Yeni reçetelerde **odun yakıtı ve demir aletleri** bazı imalathaneler için gerçek sarf malzemesidir; bu, işçi ücreti/sabit bakım hesabının yerini almaz. Tam işçilik modeli sonraki aşamada envanter, şehir özerkliği, sahiplik ve şirket sistemiyle tasarlanmalıdır.

## Kabul

`main` birleştirmesi yok. Aynı son commit SHA için Web validation + gerçek Chromium smoke + tek HTML indirilebilir build üçü de başarılı ve yeni yedi test PASS olmadan tamamlandı denmeyecek. Dünya bütünlüğündeki önceki tek uyarı ayrı kayıt altındadır.
