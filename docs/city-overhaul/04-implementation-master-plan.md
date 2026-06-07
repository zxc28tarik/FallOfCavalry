# Implementation Master Plan

## Belgenin Amaci
Bu belge sehir sahnesi sisteminin yasayan uygulama planidir. Kod, dokuman, sanat teslimi ve test ilerlemesi burada tutulur.

## Yeni Karar Ozetleri
- Eski `12/13 bolge + rezerv` mantigi artik `alan doluluk varyanti` mantigina donusturuldu.
- Tek sabit tam dolu alan `Ic Kale / Yonetim Cekirdegi`dir.
- Diger alanlar `bos / az dolu / yari dolu / tam dolu` varyanti ile seed edilir.
- Oyuncu alanlara tiklar; bina veya servis secimini sag panelden yapar.
- Altyapi yapilari buyuk bina olarak cizilmez; `Sehir Kethudasi` uzerinden gorunmez grup olarak modellenir.

## Fazlar

### Faz 1 - Dokumantasyon
- [x] `01-city-system-gdd.md` yeni alan modeline guncellendi.
- [x] `02-master-building-catalog.md` yeni bina havuzlarina guncellendi.
- [x] `03-faction-art-bible.md` alan bazli cizim mantigina guncellendi.
- [x] `04-implementation-master-plan.md` bu kararla yeniden yazildi.
- [x] `05-city-gameplay-mechanics.md` detayli gameplay mekanikleri, organik baglantilar, oyuncu aksiyonlari, etki tablolari ve on kosullar belgesi eklendi.
- [x] `CLAUDE.md` proje rehberi olusturuldu (sehir sistemi tasarim belgelerine referanslar icerir).

### Faz 2 - Veri Modeli
- [x] `city-building-catalog.js` yeni alan havuzlari ile guncellendi.
- [x] `city-scene-defs.js` mikro slot mantigindan alan mantigina gecirildi.
- [x] `city-state.js` alan doluluk varyanti mantigina gecirildi.
- [x] `cityState.infrastructure` blogu eklendi.
- [x] Istanbul ozel uretim baslangici ve Kagit Imalathanesi bonusu eklendi.

### Faz 3 - UI Uyumlandirma
- [x] Sehir sahnesinde alan tiklama akisi korundu.
- [x] Sag panel artik alan menusu -> bina secimi -> servis akisiyla calisiyor.
- [x] Servis basliklari yeni kurum adlarina gore guncellendi.
- [x] Genel bakis paneline Sehir Kethudasi / altyapi ozeti eklendi.
- [ ] Altyapi icin ayri Kethuda paneli ikinci katmanda acilacak.

### Faz 4 - Sanat ve Cizim Hazirligi
- [x] Cizer icin Ic Kale sabit dolu, diger alanlar degisken mantigi netlestirildi.
- [x] Pasif liman ve beklemede askeri alan kurali dokumana islendi.
- [ ] Istanbul sabit ana sehir cizim spec'i bu yeni alan havuzlariyla tekrar hizalanacak.
- [ ] Diger Osmanli sehirleri icin doluluk varyanti referanslari hazirlanacak.

### Faz 5 - Oynanis Derinlestirme (detaylar: `05-city-gameplay-mechanics.md`)
- [ ] Askeri alan aktiflestirilecek mi kararlastirilacak.
- [ ] Liman alani deniz geldikten sonra acilacak.
- [ ] Sehir Kethudasi paneli ile altyapi kurma akisi eklenecek.
- [ ] Alan bazli sayisal bonus / ceza ve nufus baskisi modeli eklenecek.
- [ ] Kadilik etki sistemi: asayis, halk guveni, tuccar/nufus cekimi.
- [ ] Medrese etki sistemi: memur kalitesi -> kadilik/defterhane/reisulkuttab verimi.
- [ ] Defterhane rapor sistemi: seviyeye gore detay artan sehir raporlari.
- [ ] Reisulkuttab diplomasi sistemi: seviyeye gore acilan diplomasi secenekleri.
- [ ] Bostancilar sistemi: huzur, kacakcilik, vergi kaybi, muhafiz birlikleri.
- [ ] Organik alan baglanti sistemi: alanlar arasi cross-effect hesaplama.
- [ ] Uretim yapisi acilma on kosullari: ticaret/kervan/altyapi baglantilari.
- [ ] Uretim olumlu/olumsuz etki sistemi: tabakhane kirliligi, boyahane su ihtiyaci vb.

## Teknik Degisiklikler

### City Scene / Data Model
- `parcels[]` korunuyor ama artik bunlar mikro parsel degil, buyuk alan nesneleri.
- Her alan `fill`, `buildingIds[]`, `starterBuildingIds[]`, `fixedBuildingIds[]` tasiyor.
- `currentBuildingId` uyumluluk icin korunuyor; alandaki oncelikli temsili bina olarak kullaniliyor.

### Service Source Kurali
- `trade` => Pazar / Bedesten / Lonca / Gumruk
- `contracts` => Han / Tuccar Hani / Kervansaray
- `diplomacy` => Reisulkuttab
- `healing` => Darussifa / Hamam / Eczane
- `tax` => Defterhane / Gumruk

### Altyapi Kurali
- `cityState.infrastructure` su bilgileri tasir:
  - `managerLabel`
  - `needScore`
  - `installedBuildingIds`
  - `availableBuildingIds`
- Bu grup scene hotspot sistemi icine zorunlu olarak girmez.

## Siradaki Buyuk Isler
1. Istanbul sabit ana sehir cizim spec'ini yeni alan havuzlariyla yeniden yaz.
2. Cizer icin "alan doluluk varyanti" referans setini ayri belgeye cikar.
3. Sehir Kethudasi panelini oynanabilir hale getir.
4. Alan bazli bonus / ceza hesaplarini ekonomi katmanina bagla.

## Decision Log
- `2026-04-25`: Ic Kale / Yonetim Cekirdegi sehirdaki tek sabit tam dolu alan olarak sabitlendi.
- `2026-04-25`: Ticaret alani baslangicta yalniz Pazar ile baslar karari alindi.
- `2026-04-25`: Hanlar alani baslangicta yalniz Han ile baslar karari alindi.
- `2026-04-25`: Saglik alanina Eczane eklendi.
- `2026-04-25`: Uretim alaninda Kasaphane ve Balikhane kaldirildi; Gida alanina tasindi.
- `2026-04-25`: Diplomasi alani kaldirildi; Reisulkuttab Ic Kale icine alindi.
- `2026-04-25`: Altyapi / Sehir Hizmetleri gorunmez bina grubu olarak Kethuda uzerinden modele eklendi.

- `2026-05-22`: Detayli gameplay mekanikleri belgesi (`05-city-gameplay-mechanics.md`) eklendi.
- `2026-05-22`: CLAUDE.md proje rehberi olusturuldu.
- `2026-05-22`: Faz 5 genisletildi: Kadilik, Medrese, Defterhane, Reisulkuttab, Bostancilar etki sistemleri, organik alan baglantilari ve uretim on kosullari eklendi.

## Delta Log
- `2026-04-25`: Kodda alan bazli `fill` ve `buildingIds[]` modeli acildi.
- `2026-04-25`: UI alan menusu akisina uyarlandi.
- `2026-04-25`: Dokumanlar yeni alan havuzu sistemine guncellendi.

## Approved Changes
- Ic Kale sabit dolu cekirdek
- Ticaret alaninin Pazar ile baslamasi
- Han alaninin Han ile baslamasi
- Eczanenin saglik havuzuna eklenmesi
- Diplomasi alaninin kaldirilmasi
- Sehir Kethudasi altyapi sisteminin gorunmez grup olarak modellenmesi

## Waiting for User
- Askeri alanin aktiflestirme zamani
- Liman alaninin ne zaman oyuna alinacagi
- Istanbul disindaki ilk cizilecek Osmanli sehirlerinin oncelik sirasi

## Test Durumu
- [x] `tests/unit/city-state.test.js`
- [x] `tests/unit/save.test.js`
- [x] `tests/unit/world-generator.test.js`
- [x] `npm run build`
