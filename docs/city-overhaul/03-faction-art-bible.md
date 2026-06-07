# Faction Art Bible

## Genel Sanat Dili
- 2D strateji oyunu asset mantigi.
- HOMM3 esintili, okunakli ve oyun ici tekrar kullanima uygun siluet.
- Hafif resimsi, hafif karanlik orta cag / erken modern ton.
- Karikaturlestirilmemis, ama tam fotogercek de olmayan yorum.
- Base scene + overlay + hotspot mantigi korunur.

## Yeni Sahne Kurali
- Eski mikro slot / rezerv mantigi terk edildi.
- Cizer artik sehirleri `alan` mantigiyla dusunur.
- Her alanda birden fazla bina temsil edilebilir.
- Ic Kale ve Yonetim Cekirdegi tek sabit dolu alandir.
- Diger alanlar `bos / az dolu / yari dolu / tam dolu` varyantiyla uretilir.

## Teslim Modeli
Her sehir sahnesi teslimi su kalemleri icermeli:
- 1 adet `base scene`
- alan veya bina bazli `overlay` PNG katmanlari
- alan kimlik listesi
- hotspot/layout manifesti
- naming kurallarina uygun dosya adlari

## Repo Icindeki Klasor Yapisi
- `assets/city-scenes/<faction>/base/`
- `assets/city-scenes/<faction>/overlays/`
- `assets/city-scenes/<faction>/manifests/`

## Naming Standardi
- `cityscene_<faction>_<variant>_base.png`
- `cityscene_<faction>_<area-id>_<building-id>_overlay.png`
- `cityscene_<faction>_<variant>_manifest.template.json`

## Teknik Kurallar
- Tum overlayler seffaf arka planli olacak.
- Ayni sahne ailesinde tek bir perspektif sabit kalacak.
- Isik yonu tum setlerde ayni olacak.
- Alan hotspotlari alanin baskin islevini kapsayacak.
- Aynj alan icindeki bina varyantlari asiri boy farki yaratmamali.
- Alan dolulugu gorselde okunmali; bina sayisi tek tek hotspot zorunlulugu yaratmaz.

## Osmanli Alan Seti
Ilk cizim odagi Osmanli sehir ailesidir.

### Sabit Ic Cekirdek
- Ic Kale Surlari
- Saray
- Mahkeme ve Kadilik
- Cami
- Medrese
- Defterhane-i Amire
- Reisulkuttab Dairesi
- Bostancilar Karargahi

### Alan Havuzlari
- Ticaret: Pazar, Bedesten, Lonca Konagi, Gumruk Dairesi
- Hanlar: Han, Tuccar Hani, Kervansaray
- Konut: Fakir Mahalle, dusuk gelir evleri, zengin evleri, konaklar
- Saglik: Darussifa, Buyuk Hamam, Eczane
- Uretim: Tabakhane, Demirci, Marangoz, Dokuma, Boyahane, Sabunhane, Kagit, Mumhane, Tas Ustasi, Nalbant
- Gida: Firin, Degirmen, Ambar, Kasaphane, Balikhane
- Kultur: At Meydani, Panayir Alani, Buyuk Anitsal Yapi

### Cizilmemesi Gereken Buyuk Bina Grubu
`Sehir Kethudasi` tarafindan yonetilen altyapi yapilari buyuk bina olarak cizilmez:
- Kuyu
- Cesme
- Sarnic
- Su yolu / kanal
- Tas doseli ana yol
- Ara yol
- Kopru / gecit
- Drenaj hatti
- Kanalizasyon / atik kanali

## Istanbul Ozel Notu
- Istanbul neredeyse tam dolu sehir profiline sahiptir.
- Ic cekirdek daima tam dolu ve ihtisamli gorunmelidir.
- Uretim alaninda baslangicta Demirci, Marangoz, Tabakhane ve Sabunhane okunur olmali.
- Istanbul ozel bonusu olan Kagit Imalathanesi bu sehirde ayri bir ustunluk gibi dusunulmelidir.

## Diger Medeniyetler
Kod tarafinda sahne kimligi ve theme anahtarlari acik:
- HRE
- Venedik
- Polonya
- Ispanya

Bu medeniyetlerde de ayni alan mantigi korunur; fark malzeme, cati, kule, meydan ve landmark yorumundan gelir.

## Hotspot Guvenli Alan Kurali
- Hotspot kutusu bina yerine alanin ana siluetini kapsayabilir.
- Label alani, yapinin veya alanin okunur ust / yan bosluguna oturacak.
- Konut alanlarinda hotspot tek eve degil mahalle butunune oturabilir.
- Ic Kale cekirdeginde hotspot tum yonetim kitlesini temsil edebilir.

## Kod Uyum Sozlesmesi
- Base scene gelmese bile oyun placeholder kullanir.
- Overlay gelmezse alan etiketi ile placeholder gorunur.
- Manifest geldikten sonra kod tarafinda sadece dosya yolu ve hotspot ayari guncellenir.
- Yeni art geldiginde veri modeli degismeden sahne gercek asset ile calismalidir.
