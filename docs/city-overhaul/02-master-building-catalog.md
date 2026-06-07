# Master Building Catalog

## Kullanim Notu
Bu dosya alan tabanli sehir sisteminin tek otorite bina listesidir. Eski `12/13 bolge + rezerv slot` dili yerine artik `alan + bina havuzu + doluluk varyanti` modeli kullanilir.

## Alan Doluluk Mantigi
- `inner_citadel_core` disindaki tum alanlar `bos / az dolu / yari dolu / tam dolu` varyanti ile calisir.
- Alan bos olabilir, ama bina havuzu yine sabittir.
- Oyuncu bina icine girmez; alana tiklar, sag panelde o alandaki bina listesini ve servisleri gorur.
- Altyapi ve sehir hizmetleri buyuk bina olarak cizilmez; `Sehir Kethudasi` uzerinden gorunmez sistem olarak isler.

## 1. Ic Kale ve Yonetim Cekirdegi
Bu alan sehirdaki tek sabit tam dolu alandir.

Hazir kabul edilen yapilar:
- `inner_citadel` - Ic Kale Surlari
- `palace` - Saray
- `court_house` - Mahkeme ve Kadilik
- `imperial_mosque` - Cami
- `medrese` - Medrese
- `defterhane_amire` - Defterhane-i Amire
- `reisulkuttab_office` - Reisulkuttab Dairesi
- `bostanci_hq` - Bostancilar Karargahi

Servis temsilciligi:
- `diplomacy` = `reisulkuttab_office`
- `tax` = `defterhane_amire`

## 2. Ticaret Alani
Baslangicta yalniz `Pazar` ile baslar.

Havuz:
- `bazaar_market` - Pazar
- `bedesten` - Bedesten
- `guild_hall` - Lonca Konagi
- `customs_office` - Gumruk Dairesi

Servis:
- `trade`

## 3. Hanlar ve Kervan Alani
Baslangicta yalniz `Han` ile baslar.

Havuz:
- `han` - Han
- `merchant_han` - Tuccar Hani
- `caravanserai` - Kervansaray

Servis:
- `contracts`

## 4. Konut Alani
Bu alan sosyal sinifa gore genisler.

Havuz:
- `poor_quarter` - Fakir Mahalle
- `modest_houses` - Orta Halli Dusuk Gelir Evleri
- `affluent_houses` - Orta Halli Zengin Evleri
- `elite_mansions` - Ust Zumre Konaklari

## 5. Askeri Alan
Bu alan su an beklemededir.

Tanimi:
- `barracks` - Kisla

Not:
- Kodda alan korunur ama varsayilan olarak pasif/special durumdadir.
- `recruit` servisi bina gelmeden acilmaz.

## 6. Saglik Alani
Havuz:
- `darussifa` - Darussifa
- `great_hammam` - Buyuk Hamam
- `pharmacy` - Eczane

Servis:
- `healing`

## 7. Uretim ve Zanaat Alani
Alan tamamlanmis sehirlerde 4-5 yapiya kadar dolabilir. Eksik sehirlerde 1-3 arasi yapi ile baslar.

Havuz:
- `tannery` - Tabakhane
- `blacksmith` - Demirci
- `carpenter` - Marangoz
- `weaving_house` - Dokuma Atolyesi
- `dyeworks` - Boyahane
- `soapworks` - Sabunhane
- `paper_mill` - Kagit Imalathanesi
- `chandlery` - Mumhane
- `stoneworks` - Tas Ustasi ve Insaat Atolyesi
- `farrier` - Nalbant

Not:
- `Kasaphane` ve `Balikhane` buradan cikarildi.
- `Halat Atolyesi` aktif havuzdan cikarildi.

Istanbul ozel baslangici:
- `blacksmith`
- `carpenter`
- `tannery`
- `soapworks`

Istanbul ozel bonusu:
- `paper_mill`

## 8. Gida ve Ikmal Alani
Havuz:
- `bakery` - Firin
- `mill` - Degirmen
- `granary_store` - Ambar
- `butcher_shop` - Kasaphane
- `fish_market` - Balikhane

## 9. Deniz ve Liman Alani
Su an oyunda deniz olmadigi icin pasif alandir.

Kurallar:
- aktif bina havuzu yok
- cizimde buyuk liman varligi zorunlu degil
- kodda `special` / pasif alan olarak tutulur

## 10. Diplomasi Alani
Ayrica bir diplomasi alani artik yoktur.

Kural:
- diplomasi ve yazisma islevleri `Reisulkuttab Dairesi` ile Ic Kale icinde temsil edilir

## 11. Meydan ve Kultur Alani
Havuz:
- `at_meydani` - At Meydani
- `fairground` - Panayir Alani
- `monumental_public_building` - Buyuk Anitsal Kamusal Yapi

## 12. Altyapi ve Sehir Hizmetleri
Bu grup gorunmez bina grubu olarak calisir.

Yoneten:
- `Sehir Kethudasi`

Havuz:
- `well` - Kuyu
- `fountain` - Cesme
- `cistern` - Sarnic
- `aqueduct_channel` - Su Yolu ve Kanal
- `paved_main_road` - Tas Doseli Ana Yol
- `side_road` - Ara Yol
- `bridge_crossing` - Kopru ve Gecit
- `drainage_line` - Drenaj Hatti
- `sewer_canal` - Kanalizasyon ve Atik Kanali

Kurallar:
- buyuk bina olarak cizilmez
- nufusa gore ihtiyac dogurur
- maliyet ve fayda uretir
- city scene icinde ayri hotspot zorunlu degildir

## Servis Eslesmeleri
- `trade` = `bazaar_market`, `bedesten`, `guild_hall`, `customs_office`
- `contracts` = `han`, `merchant_han`, `caravanserai`
- `diplomacy` = `reisulkuttab_office`
- `healing` = `darussifa`, `great_hammam`, `pharmacy`
- `tax` = `defterhane_amire`, `customs_office`
- `recruit` = `barracks` (su an beklemede)
