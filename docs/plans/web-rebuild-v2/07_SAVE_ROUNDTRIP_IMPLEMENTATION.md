# K01 — Yeni dünya kaydı için gerçek tarayıcı round-trip (18.11.2026)

Gerçek Chrome E2E testi ilk ekran ve tam dünya açılışı PASS olduktan sonra mevcut `SaveManager.quickSave()` ile `manual1` yuvasına kayıt yapar, slotu doğrular, `quickLoad()` çağırır ve oyun günü, altın, fraksiyon, dünya boyutları ve yerleşim sayısını karşılaştırır. Kullanılan browser context her GitHub Actions çalışmasında yalıtılmıştır; gerçek kullanıcı kayıtlarına dokunmaz.

Kapsam: **Yeni prosedürel dünya için aynı oturumda save/load**. Tam pencere yeniden yüklemesi, eski kayıt migrasyonu, farklı sürümlerde harita yükleme, bütün city/economy/quest state alanlarının korunması ve uzun süreli autosave henüz doğrulanmış sayılmaz.

İlgili görev `K01-04 = UYGULAMADA`; yalnız GitHub'ın tam Chrome ve static/test run'ları PASS olduğunda bu adımın alt-senaryosu doğrulanabilir. Eski harita silme kararı, 2D sanat planı ve Unity dosyaları değişmez.
