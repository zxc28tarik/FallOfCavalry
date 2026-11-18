# K01 — Gerçek Chromium oyun açılış denetimi (18.11.2026)

## Amaç
GitHub CI içinde gerçek Chromium tarayıcısıyla **production Vite bundle** açılır. Mevcut kullanıcı menüsünde fraksiyon ve seed seçilir; mevcut **tam prosedürel dünya** yüklenir. Bu işlem küçük veya yeni dünya veri pilotu üretmez.

## Teknik dosyalar
- `tools/browser-world-smoke.mjs`: ilk açılış, menü, fraksiyon seçimi, oyunu başlatma ve runtime MapData/Canvas doğrulaması.
- `.github/workflows/web-browser-smoke.yml`: Node 22, npm ci, test-only sabit Playwright sürümü, Chromium kurulumu, Vite production preview, browser test, screenshot + JSON artifact.
- `npm run test:browser:world`: yerel kullanımda Playwright ve Chromium kurulu olmalıdır.
- `K01-02` ve `Q00-02` **UYGULAMADA**; yalnız dosya oluştu diye tamamlanmaz.

## Kabul
Tarayıcıda `window.game.initialized`, seçilebilir faction, çalışan Start düğmesi, `game.started`, tam world MapData terrain boyutu, pozitif settlement sayısı ve görünür oyun canvas. Birinci parti 404/network hataları veya uncaught JS pageerror olmamalı. Screenshot ve ölçüm GitHub artifact ile sunulur.

## Sınır
Bu sürüm *start→world* smoke testidir. Şehir, görev, savaş, aftermath ve save/load E2E henüz kanıtlı değildir. App console.error ve dış CDN uyarıları JSON'da saklanır, başlangıçta yalnız uncaught hata ve birinci parti kaynak kaybı kapıyı düşürür. İleride geniş testler için ayrıca iş emri vardır.
