# Fall of Cavalry Web — Oyuncu Karakteri Oluşturma V1

**Tarih:** 2026-11-18
**Depo:** `zxc28tarik/FallOfCavalry` (web)
**Uygulama dalı:** `codex/web-character-creator-20261118`
**Durum:** Kaynak kodu ve birim testleri PR'da; nihai DONE ve tarayıcı kabulü için CI + gerçek browser smoke gerekir.
**İlgili V2 paketleri:** O00-01 (kampanya start), K01-04 (save/load). Yeni bağımsız 132. V2 işi değildir.
**Unity:** `FallOfCavalry-Unity` bu işlemde değiştirilmedi.

## 1. Kullanıcı kararı ve sınırlar
- Kullanıcı Fall of Cavalry için karakter oluşturma sisteminin geliştirilmesini istedi.
- Güncel çalışılan web oyununda bu istek Start ekranına bağlandı; ayrı masaüstü Unity sistemine mimari değişiklik yapılmadı.
- Asker sprite/animasyon üretimi G14 son faz kısıtı gereği başlamadı.
- Köken/uzmanlık seçenekleri ve sayısal bonuslar **ASSISTANT_FILLED / GEÇİCİ DENGE ÖNERİSİ** niteliğindedir; kullanıcı tarafından nihai tasarım otoritesi olarak onaylanmış sayılmaz.
- Karakterin kimliği ve kökeni mevcut fraksiyon sahipliğiyle karıştırılmaz; seçim yeni ülke, hizip, din veya asker birimi yaratmaz.

## 2. Yapılan teknik işler
1. `js/systems/character-creation.js`: Bağımsız saf kurallar, enum beyaz listesi, ad doğrulama, sabit oyuncu ID'si, 0–100 statlar, güvenli save normalizasyonu.
2. `js/ui/start-screen.js`: Başlangıç karakter formu, canlı önizleme, hatalı adı reddetme, faction'a bağlı önerilen kültür.
3. `index.html` ve `css/styles.css`: Responsive orijinal 2D UI; yeni çizim veya asker art'ı gerekmiyor.
4. `js/managers/GameFlowManager.js`: Karakterin gerçek `playerParty.character` state'ine atanması, seçilmiş kökene göre bir defalık küçük başlangıç etkileri.
5. `js/managers/SaveManager.js` ve `js/systems/save-system.js`: Save build, normalizasyon ve load sırasında kimlik korunuyor; eski saves alanı yoksa `null` ve mevcut kampanya bozulmaz.
6. `tests/unit/character-creation.test.js`: İsim güvenliği, determinism, stat sınırları, seçenek normalizasyonu, önizleme, save/legacy normalizasyonu.

## 3. V1 karakter alanları
- `id`: `player-hero` (kampanya boyunca kararlı)
- `name`: oyuncunun girdiği isim (2–32 Unicode karakter)
- `cultureId`: Osmanlı / Orta Avrupa / Leh / İber / Venedikli
- `originId`: tecrübeli asker / tüccar ailesi / kâtip-medrese / seyyah-haberci
- `focusId`: kumandanlık / ticaret / ikna / yönetim / liderlik
- `ageGroup`: genç / olgun / yaşlı
- `importance`: A (oyuncu)
- `stats`: zekâ, gözlem, ikna, liderlik, kumandanlık, ticaret, yönetim, cesaret, tecrübe — hepsi 0–100.

Köken değişimi kaynaklardan yalnızca küçük miktarda başlangıç altını/moral/şöhret verir; bu sistem tam kariyer veya RPG yükselme ekonomisi olduğu iddiasında değildir. Statlar veri olarak kaydolur; ilgili şehir, savaş, ticaret, diplomasi aksiyonlarının tamamında kullanılmaları ileriki entegrasyon işidir.

## 4. Kontroller / açık noktalar
- [x] Kaynak kodu yazıldı ve web çalışma dalına commit edildi.
- [x] SaveSystem normalizasyonundaki ekstra alanı düşürme sorunu giderildi.
- [x] Unit test kaynakları eklendi (geçtiği ancak CI ile doğrulanabilir).
- [ ] İlgili SHA için GitHub Web validation PASS kanıtı.
- [ ] Gerçek Chromium başlangıç, seçim, reload, save/load E2E.
- [ ] UI küçük ekran ve klavye kullanım doğrulaması.
- [ ] Tam AI/NPC üretimi; GeneratedPerson→NamedCharacter, aile/hizip/ilişki ve oyundaki stat etkileri: **bu V1 kapsamında yapılmadı**.
- [ ] Nihai karakter portresi/görsel modülerlik: asker sanatı G14 kullanıcı kapısı gereği başlatılmadı.
- [ ] Tüm sayısal köken/uzmanlık katsayıları için tasarım onayı.

## 5. Kabul
- Oyun eski karakter alanı bulunmayan kayıtla yüklenebilmeli.
- Yeni oyuncu karakteri isim/kültür/köken/uzmanlık/yaş grubuyla başlayıp aynı ID ve statlarla kaydedilip yüklenebilmeli.
- Başlangıç etkileri tekrar yüklemede bir daha uygulanmamalı.
- Formdaki kullanıcı metni `innerHTML` ile render edilmemeli.
- Web dosyası Unity dosyalarını, silinmiş dünya BIN/sprite'larını ya da G14 asker görsellerini geri getirmemeli.
