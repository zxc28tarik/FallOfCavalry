# City Scene Asset Workspace

Bu klasor, sehir sahnesi sistemi icin kullanicidan gelecek gorsellerin repo ici teslim alanidir.

## Klasorler
- `ottoman/`
- `hre/`
- `venice/`
- `polish/`
- `spanish/`

Her faction klasoru su alt klasorleri kullanir:
- `base/`
- `overlays/`
- `manifests/`

## Kural
- Base scene tek dosya olur.
- Overlayler slot ve bina ailesine gore adlandirilir.
- Manifest dosyalari teknik entegrasyonun tek giris noktasi olarak kullanilir.
- Slot kimliklerinin otorite kaynagi `js/data/city-scene-defs.js` dosyasidir.

## Ilk Odak
Ilk tam teslim Osmanli tam sehir kitidir. Diger medeniyet klasorleri simdiden acilir ama ikinci faz odagidir.
