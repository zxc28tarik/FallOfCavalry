# Sehir Sahnesi GDD

## Sistem Amaci
- Sehir icinde dolasma mekanigini geri getirmeden daha derin bir sehir yonetim katmani saglamak.
- Mevcut settlement etkilesimini alan tabanli bir sehir sahnesine donusturmek.
- Oyuncunun sehirdeki alanlara tiklayip ilgili bina veya servisi sag panelden secmesini saglamak.
- Cizilecek yeni sehir gorsellerini kod, save/load ve UI ile dogrudan uyumlu hale getirmek.

## Temel Oynanis Akisi
1. Oyuncu bir sehre girer.
2. Ikariam benzeri tek bir sehir sahnesi acilir.
3. Oyuncu tek tek bina yerine sehirdeki bir alana tiklar.
4. Sag panelde o alanin bina listesi, servisleri ve gelisim secenekleri gorulur.
5. Oyuncu ilgili binayi secerek bilgi, servis veya gelisim islemini baslatir.

## Alan Modeli
Eski `mikro slot + rezerv parsel` mantigi kaldirilmistir. Yeni model:
- `alan`
- `bina havuzu`
- `alan doluluk varyanti`

Ic Kale / Yonetim Cekirdegi disindaki tum alanlar su varyantlardan biriyle baslar:
- `bos`
- `az dolu`
- `yari dolu`
- `tam dolu`

## Sabit Dolu Alan
Sehirde tek sabit tam dolu alan `Ic Kale / Yonetim Cekirdegi`dir.

Bu alanda hazir kabul edilen yapilar:
- Ic Kale Surlari
- Saray
- Mahkeme ve Kadilik
- Cami
- Medrese
- Defterhane-i Amire
- Reisulkuttab Dairesi
- Bostancilar Karargahi

Bu alan bos baslamaz ve rastgele eksilmez.

## Aktif Alanlar
- `trade_area`
- `caravan_area`
- `housing_area`
- `health_area`
- `production_area`
- `food_area`
- `culture_area`

## Pasif veya Beklemede Olan Alanlar
- `military_area`
  - kodda korunur
  - varsayilan durumda beklemededir
- `port_area`
  - oyunda deniz olmadigi icin pasiftir

## Kaldirilan Alan
- Ayri bir `diplomasi_area` yoktur.
- Diplomasi ve yazisma `Reisulkuttab Dairesi` ile Ic Kale icinde temsil edilir.

## Alan Havuzlari

### Ticaret Alani
Baslangicta yalniz `Pazar` ile baslar.

Havuz:
- Pazar
- Bedesten
- Lonca Konagi
- Gumruk Dairesi

### Hanlar ve Kervan Alani
Baslangicta yalniz `Han` ile baslar.

Havuz:
- Han
- Tuccar Hani
- Kervansaray

### Konut Alani
Havuz:
- Fakir Mahalle
- Orta Halli Dusuk Gelir Evleri
- Orta Halli Zengin Evleri
- Ust Zumre Konaklari

### Saglik Alani
Havuz:
- Darussifa
- Buyuk Hamam
- Eczane

### Uretim ve Zanaat Alani
Havuz:
- Tabakhane
- Demirci
- Marangoz
- Dokuma Atolyesi
- Boyahane
- Sabunhane
- Kagit Imalathanesi
- Mumhane
- Tas Ustasi ve Insaat Atolyesi
- Nalbant

### Gida ve Ikmal Alani
Havuz:
- Firin
- Degirmen
- Ambar
- Kasaphane
- Balikhane

### Kultur Alani
Havuz:
- At Meydani
- Panayir Alani
- Buyuk Anitsal Kamusal Yapi

## Servis-Bina Eslesmeleri
- `trade` = Pazar, Bedesten, Lonca Konagi, Gumruk Dairesi
- `contracts` = Han, Tuccar Hani, Kervansaray
- `diplomacy` = Reisulkuttab Dairesi
- `healing` = Darussifa, Buyuk Hamam, Eczane
- `tax` = Defterhane-i Amire, Gumruk Dairesi
- `recruit` = Kisla (beklemede)

## Altyapi ve Sehir Kethudasi
Altyapi artik ayri buyuk bina cizimi gerektirmeyen gorunmez sistem grubudur.

Yoneten:
- `Sehir Kethudasi`

Altyapi havuzu:
- Kuyu
- Cesme
- Sarnic
- Su Yolu / Kanal
- Tas Doseli Ana Yol
- Ara Yol
- Kopru / Gecit
- Drenaj Hatti
- Kanalizasyon / Atik Kanali

Kurallar:
- buyuk bina olarak gosterilmez
- nufusa oranla ihtiyac uretir
- maliyet ve fayda saglar
- kod tarafinda ayri `infrastructure` blogu olarak tutulur

## Istanbul Ozel Karari
Istanbul, tam gelismis ozel sehir profiline sahiptir.

Kural:
- Ic Kale / Yonetim Cekirdegi tam doludur.
- Uretim alaninda baslangicta:
  - Demirci
  - Marangoz
  - Tabakhane
  - Sabunhane
- Istanbul ozel bonusu:
  - Kagit Imalathanesi

## Veri Modeli
Her settlement icin `cityState` blogu tutulur:
- `sceneId`
- `artSetKey`
- `tier`
- `role`
- `parcels[]`
- `activeBuildings[]`
- `landmarks[]`
- `services{}`
- `infrastructure{}`
- `validation{}`

Her alan icin:
- `id`
- `label`
- `areaType`
- `fill`
- `buildingIds[]`
- `allowedBuildingIds[]`
- `fixedBuildingIds[]`
- `starterBuildingIds[]`
- `buildDisabled`

## Cekirdek UI Kurali
- Oyuncu bina icine girmez.
- Alan secilir.
- Sag panelde bina secilir.
- Servis sert bina kilidi ile acilir.
- Alan bos olsa bile bina havuzu panelde gorunebilir.
