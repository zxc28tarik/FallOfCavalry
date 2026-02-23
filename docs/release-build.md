# Release / Export Build

## Tek tık (Node varsa)

Projede Node yüklüyse kökten şu komutu çalıştır:

```bash
npx --yes bestzip FallOfCavalry-build.zip index.html css js docs
```

Bu komut statik dağıtım dosyalarını tek zip içine koyar.

## Manual export (Node yoksa)

1. `index.html`, `css/`, `js/`, `docs/` klasörlerini seç.
2. Sistem zip aracı ile `FallOfCavalry-build.zip` oluştur.
3. Zip açıldığında `index.html` aynı kök seviyede olmalı.

## Version stamp

Node olmadan hızlı sürüm damgası için:

- `index.html` footer veya changelog satırına tarih/saat ekleyin (`YYYY-MM-DD HH:mm`).
- Eğer commit hash erişimi yoksa bu damga release etiketi olarak kabul edilir.
