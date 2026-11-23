# GEMINI İLK UYGULAMA PROMPTU — G3D-02A
## Fall of Cavalry | 3D savaş sahnesinin temeli: zemin + kamera + güvenli görüntü katmanı

**GÖREVİN:** Kodda gerçek değişiklik yap. Sadece plan veya öneri yazma. Ancak bu promptta yalnızca **G3D-02A** bölümünü uygula; asker modelleri, animasyonlar, savaş kuralları ve oyunun başka sistemleri sonraki promptlara kalacak. Mevcut çalışan oyunu başka bir oyuna çevirmeyeceksin.

### 0. GitHub ve zorunlu okuma
- Repo: `zxc28tarik/FallOfCavalry` (WEB/JS). Unity deposuna dokunma.
- Kaynak çalışma dalı: `codex/web-3d-protected-battle-20261123`; **başlangıç HEAD'i:** `3828e89dbade1b655ffe4730de6301ba9c780f3a`. Başlamadan önce yeni HEAD varsa güncel kodu ve değişiklikleri incele; bu SHA'yı otomatik olarak eski sürümüne zorla döndürme.
- Kendi **aday dalını** `gemini/g3d-02a-three-scene-camera-20261123` adında bu çalışma dalından aç ve yalnız burada çalış. `main`, PR #68, PR #72, `archive/**` üzerinde değişiklik yapma.
- Mutlaka oku: `GEMINI.md`, `docs/3d-migration/00_KORUMA_SISTEMI.md`, `docs/3d-migration/01_EN_IYI_PARCA_KAYITLARI.md`, `docs/3d-migration/GEMINI_GOREV_G3D02_SAVAS.md`, `docs/3d-migration/checkpoints/G3D-01.md`.
- Kodda incele: `js/battle3d/ActiveSector3DViewModel.js`, `js/battle/sector/SectorManager.js`, `js/battle/sector/SectorRenderer.js`, `js/battle/unit/FormationController.js`, `js/battle/BattleBoot.js` ve mevcut G3D-01 testleri.
- **G3D-01 doğrulanmış BEST:** `c0e91e86873e2e680d1eb40c8fc9abd49d9f4224`. Koruma referansı: `archive/3d-g3d01-verified-20261123`. Orijinal 2D+oyun geri dönüş referansı: `archive/3d-v175-koruma-20261123` @ `5641184f3cf745bfbc37c86740a261c97edb3662`.

### 1. Bu promptta gerçekten üretilecekler
1. Yeni `js/battle3d/` dizininde `Battle3DRenderer` (uygun modüllere bölebilirsin) oluştur. **Three.js** kullan; bağımlılığı sürüm ve lockfile ile projeye ekle. CDN'den rastgele JS çekme.
2. `init(container)`, `sync(snapshot)`, `render/update`, `resize`, `dispose` gibi açık ve test edilebilir yaşam döngüsü olsun. `dispose` WebGL/geometry/material/RAF/listener temizliğini gerçekten yapsın. Sadece tek renderer örneği sahibi ol; bellek sızıntısı olmasın.
3. Orta büyüklükte **gerçek 3D bir savaş zemini**, basit arazi yüzeyi, tekil gün ışığı/ambient ışık, ölçülü gölge ve atmosfer oluştur. Görsel hedef: 1650 Avrupa/Osmanlı meydan muharebesi için doğal, okunabilir toprak-çim renkleri. **Bu turda gerçek yükseklik/arazi verisi bağlı değilse zemin geçici ve düz olduğunu açıkça göster; sahte tarihî harita veya şehir üretme.**
4. Döndürülebilir RTS kamera: orbit, kaydırma/pan, yakınlaştırma-uzaklaştırma, mantıklı sınırlar, imleç/fare olaylarında takılmama. Perspektif yerden değil, yüksekten taktik bakış; sonraki 300 asker/5 formasyona uygun mesafe ve kadraj.
5. Mevcut `projectActiveSector3D(sectorManager)` çıktısını **yalnızca oku**. Kaynak `sectorId`, görünür asker sayısı ve koordinat çevresi kamera hedefini belirleyebilsin. `SoldierInstance` / `UnitGroup` / sektör verisine hiçbir şey yazma. Render işinde tekrar asker veya oyun verisi üretme.
6. 3D sahneyi göstermek için oyuna dokunmayan, **ayrı ve açıkça geliştirici önizlemesi** bir Vite sayfası/entry oluştur (ör. `battle3d-preview.html`). Veri oluşturmak gerekirse projenin `createTestBattleData()` fixture'ını mevcut `SectorManager` üzerinden geçir; **bunun gerçek kampanya savaşı olduğunu iddia etme**. Bu önizleme sıfır/boş veriyle de çökmemeli. Gerekli debug bilgileri yalnız bu sayfada olsun.
7. Bu aşamada 3D asker mesh'i **oluşturma**. Geçici zemin, kamera ve snapshot bağlantısı gözüksün; asker çizimi **G3D-02B**'de başlayacak. Mevcut 2D oyun varsayılan ve eksiksiz çalışacak; yeni 3D sayfa yalnız açıkça çağrılırsa açılacak.
8. Basit testler ekle: sahne oluşturma/kapatma kaynak temizliği, kamera sınırları, geçersiz/boş snapshot, kaynak state'in değişmemesi. Tarayıcıda WebGL açılmadığında açıklayıcı hata ve güvenli kapatma olmalı.

### 2. KESİNLİKLE YASAK
- `js/battle/**`, `js/world/**`, `js/systems/**`, `js/managers/**`, `js/ui/**` veya mevcut gerçek oyun kontrol/AI/save/quest/ekonomi dosyalarını değiştirme. Orijinal `BattleScene`, `BattleBoot`, `SectorManager`, `BattleSimulation`, formasyon ve Phaser 2D render yolunu aynen bırak. V1.75'in başka özelliklerini silme.
- Asker sayılarını, komutanları, silah/ekipmanı, AI kararını, hasarı, dünyayı, ekonomi ve şehirleri yeniden oluşturma; örnekteki başka oyunun birimlerini veya sahte senaryoyu FOC'ye taşıma.
- Bu aşamayı bütün savaş sistemi tamamlanmış gibi gösterme. G3D-02A bir **görüntü ve kamera altyapısı** görevidir.
- **GEMINI ŞU KAYITLARA DOKUNAMAZ:** `GEMINI.md`, `docs/3d-migration/00_KORUMA_SISTEMI.md`, `01_EN_IYI_PARCA_KAYITLARI.md`, `docs/3d-migration/checkpoints/**`, `scripts/check-3d-core-protection.mjs`, `archive/**`. Kayıtları, SHA yedeklerini, BEST karşılaştırmasını, kurtarma işlemlerini ve kabulü **yalnız ChatGPT yapacak**. Senin commit'in yalnız **ADAY TESLİM**.
- `git reset --hard`, force push, test silme, geniş kapsamlı refactor veya onaysız merge yapma.

### 3. İzinli dosyalar ve test
- Tercih edilen yeni dosyalar: `js/battle3d/Battle3DRenderer.js`, `js/battle3d/RTSCamera3D.js` (gerekirse), `js/battle3d/preview-entry.js`, `battle3d-preview.html`, `tests/unit/battle3d-*.test.js`.
- Mevcut `js/battle3d/ActiveSector3DViewModel.js` ve `tests/unit/battle3d-projection-g3d01.test.js` **değişmez**.
- `package.json` ve `package-lock.json` yalnız Three.js bağımlılığı için değişebilir; mevcut script veya paketleri kaldırma.
- Adayın durumunu görebilmek için `npm run validate`, `npm test`, `npm run audit:world`, `node scripts/check-3d-core-protection.mjs` çalıştır. Gerçek Chromium/WebGL önizlemesini dene. Test çalışmadıysa **çalışmadı** de. FPS uydurma; ölçmediysen `ölçülmedi` de.

### 4. Teslim biçimi
**Sadece G3D-02A tamamlandığında DUR.** G3D-02B'ye, askerlere, şehre veya haritaya kendiliğinden geçme.
- Ayrı aday branch ve **exact son commit SHA**, değişen dosyalar, neyin gerçekten çalıştığı, demo URL/çalıştırma komutu.
- Test komutları ve gerçek PASS/FAIL çıktıları; WebGL ekranını doğrulayabildiysen kanıtını belirt.
- Açık eksikleri ve özellikle G3D-02B'ye bırakılan noktaları yaz.
- Mevcut 2D oyunu ve orijinal savaş sistemlerini değiştirmediğini yalnız somut diff'le belirt.
- **BEST/ONAYLANDI/KAYDEDİLDİ** deme. Kabulü, kayıtları ve gerekirse eski en iyi parçaları geri getirmeyi ChatGPT koordinatörü yapacak.

**ÇIKTI HEDEFİ:** Kaynak kod ve tarayıcıda açılabilen, kamerayla gezilebilen **bağımsız Three.js 3D savaş zemini**, gerçek FOC sektör snapshot'ını salt-okunur alabilecek mimari, 2D oyuna sıfır regresyon, tek izole aday commit. **Bu, uzun vadeli tam 3D oyunun ilk Gemini kod teslimidir.**
