# Fall Of Cavalry - Proje Rehberi

## Proje Tanimi

16. yuzyil Avrupa temasinda, tarayici tabanli (Canvas 2D), offline grand strategy / RPG melez oyun.
Saf JavaScript (ES Modules), HTML5 Canvas, Tailwind CSS. Framework yok.
Dimetrik (izometrik benzeri) gorunum, HoMM3 esintili.
Arayuz buyuk olcude Turkce.

## Teknoloji

- **Dil:** Vanilla JavaScript (ES Modules)
- **Rendering:** HTML5 Canvas 2D, dimetrik gorunum (64x32 tile)
- **CSS:** Tailwind CSS
- **Sunucu:** Yok (offline, localStorage save)
- **Build:** Vite dev server

## Klasor Yapisi

```
js/
  main.js              # Ana giris noktasi, FallOfCavalry sinifi
  constants.js          # Re-export facade (constants/ altindan)
  constants/
    battle.js           # Savas sabitleri (hasar, moral, formasyon, flank, charge vb.)
    economy.js          # Ekonomi sabitleri (ticaret, erzak, kapasite, kontrat, muhasebe)
    systems.js          # Sistem sabitleri (faksiyonlar, diplomasi, olaylar, save, birimler)
    ui.js               # UI sabitleri (tutor, keybind, debug)
    world.js            # Dunya sabitleri (harita, biyom, yerlesim, hava, POI, AI)
  core/
    state.js            # Merkezi GameState sinifi (observer pattern)
    input.js            # Giris yonetimi
    game-loop.js        # Ana oyun dongusu
  managers/             # 18 manager sinifi (BattleManager, WorldManager, CityManager vb.)
  systems/              # Alt sistemler (trade, supplies, weather, contracts, diplomacy vb.)
  rendering/            # Canvas rendering (camera, animation, battle-fx, weather-layer)
  ui/                   # UI bilesenler (hud, modals, settings, camp-ui, codex vb.)
  world/                # Fog of war
docs/
  city-overhaul/        # Sehir sistemi tasarim belgeleri (asagida detay)
assets/
  city-scenes/          # Sehir sahne gorselleri (faction bazli)
css/
  styles.css
```

## Oyun Modlari

| Mod | Aciklama |
|-----|----------|
| `start` | Faction secimi + yeni oyun baslangici |
| `map` | Dunya haritasinda gezinme |
| `city` | Sehir ici: ticaret, asker toplama, kontrat alma |
| `battle` | Gercek zamanli taktik savas |
| `encounter` | Haritada rastgele karsilasma |

## Oynanabilir Faksiyonlar

Osmanli, Kutsal Roma, Ispanya, Polonya, Venedik (toplam 19 faction, 5 oynanabilir).

## Temel Sistemler

- **Ekonomi:** 6 ticaret mali, supply-demand fiyatlama, momentum, diplomasi etkisi
- **Savas:** Gercek zamanli taktik, counter sistemi, moral, charge, flank, formasyon
- **Diplomasi:** Iliski -100/+100, savas/baris, ticaret anlasmasi, iliski gelistirme
- **Erzak:** Gunluk tuketim, aclik penaltisi, kamp sistemi
- **Kontrat:** 6 gorev tipi (BANDIT, DELIVER, SCOUT, DEFEND, ESCORT, ASSASSINATE)
- **POI:** 6 ilgi noktasi tipi, ganimet/pusu/ipucu sonuclari
- **Hava Durumu:** Seed bazli deterministik, gunduz dongusu

## Sehir Sistemi Tasarim Belgeleri

**ONEMLI:** Sehir sistemi buyuk bir yeniden yapilanma surecinde.
Tasarim belgeleri `docs/city-overhaul/` altinda:

| Dosya | Icerik |
|-------|--------|
| `01-city-system-gdd.md` | Ana GDD: alan modeli, UI akisi, veri yapisi |
| `02-master-building-catalog.md` | Otorite bina listesi: alan havuzlari, servis eslesmeleri |
| `03-faction-art-bible.md` | Gorsel kurallar: perspektif, renk, siluet, asset naming |
| `04-implementation-master-plan.md` | Uygulama plani: fazlar, ilerleme, karar logu |
| `05-city-gameplay-mechanics.md` | **DETAYLI GAMEPLAY TASARIMI:** Alanlarin mekanikleri, organik baglantilar, oyuncu aksiyonlari, etki tablolari, on kosullar |

`05-city-gameplay-mechanics.md` en kapsamli belgedir. Her alanin:
- Oyun ici gorevi
- Oyuncunun yapabilecekleri (aksiyon listesi)
- Etki tablolari (hangi sistemi nasil etkiler)
- Diger alanlarla organik baglantilari
- On kosullari (hangi bina hangi baglantiyi gerektirir)
- Ornekler

### Sehir Alanlari (10 alan)

1. **Ic Kale / Yonetim Cekirdegi** - Kadilik, Medrese, Defterhane, Reisulkuttab, Bostancilar
2. **Ticaret Alani** - Pazar, Bedesten, Lonca, Gumruk
3. **Hanlar / Kervan Alani** - Han, Tuccar Hani, Kervansaray
4. **Konut Alani** - Fakir/Orta/Zengin mahalleler
5. **Askeri Alan** - Kisla, Talim, Cephanelik (beklemede)
6. **Saglik / Hamam** - Darussifa, Hamam, Eczane
7. **Uretim / Zanaat** - Demirci, Marangoz, Tabakhane, Dokuma, Boyahane, Sabunhane, Kagit, Mumhane, Tas Ustasi, Nalbant
8. **Gida / Ikmal** - Firin, Degirmen, Ambar, Kasaphane, Balikhane
9. **Meydan / Kultur** - At Meydani, Panayir, Anitsal Yapi
10. **Altyapi** - Su, yol, drenaj, kanalizasyon (Sehir Kethudasi yonetir)

### Organik Baglanti Felsefesi

Sehirde her alan birbirini etkiler. Oyuncu ticareti buyutmeden bazi uretim yapilarini
acamaz. Uretimi gelistirmeden kaliteli asker cikaramaz. Medreseyi gelistirmeden guclu
memur kadrosu kuramaz. Kadilik guclenmeden nufus ve tuccar cekimi surdurulemez.
Defterhane gelismeden sehir sorunlari net gorulemez.

## Kodlama Kurallari

- Turkce degisken/fonksiyon ismi kullanma, Ingilizce tut
- constants.js altindaki modullere yeni sabit ekle, dogrudan dosyaya yazma
- GameState uzerinden observer pattern (on/off/emit) kullan
- Manager siniflarini FallOfCavalry ana sinifina bagla
- Her manager kendi state parcasini yonetir
- Save/load uyumlulugu icin serialize/deserialize fonksiyonlarini guncelle

## Bilinen Tuzaklar

- **Aktif map renderer:** `js/managers/RenderManager.js`
  `js/rendering/map-renderer.js` runtime'da aktif degil; buraya yapilan
  gorsel degisiklikler oyunda gorunmez.

- **Worldgen uretim metodu:** `generateMapData()` (typed-array path)
  `WorldGenerator` icinde `generate()` metodu yoktur.

- **Settlement sprite cache:** logic degistiginde key'deki version string'i bump et.

- **Playwright:** Skill client dogrudan calismayabilir (`ERR_MODULE_NOT_FOUND`).
  Proje-yerel `tmp/` scriptlerini veya loader shim'i kullan.

- **Dev server:** `npm.cmd run dev` (Vite). `python http.server` kullanma.

- **Validation:** Her oturum sonunda `npm.cmd run validate` calistir.
  Gorsel dogrulama icin dev server ayaktayken `npm.cmd run validate:smoke` kullan.

## Bilinen Uyarilar

- Vite large chunk warning (~699KB main bundle)
- 3 lint warning mevcut ve biliniyor
- Tailwind CDN warning (production console)
