# GEMINI DÜZELTME GÖREVİ — G3D-02A-R1 (AYNI AŞAMA, YENİ SÜRÜM)

**Bu görev bir sonraki G3D-02B DEĞİL.** Önce gönderdiğin G3D-02A tek HTML önizlemesini, güzel çalışmış parçaları silmeden, gerçek Fall of Cavalry WEB projesine bağlı **modüler** kod hâline getir. Yalnız R1'i yap ve DUR.

## Önceki teslim — HİÇBİR ŞEYİ KAYBETME

ChatGPT, gönderdiğin **50.742 baytlık HTML'yi** GitHub'da ayrı arşivledi:
- **Arşiv:** `archive/gemini-g3d02a-html-candidate-20261123`
- **Dosya:** `docs/3d-migration/candidates/G3D-02A/gemini-upload-20261123.html`
- **Arşiv commit'i:** `03a024f711c3b433b79043873a662c821420c52b`
- **SHA-256:** `da5c1ff7fbba87df9c43843667c55aa3a5940bc4ed81d89ef24a1093ecf0815e`

**Korunacak iyi özellikler:** doğal zemin/organik doku, ölçülü 1650 ışığı ve sis, yüksekten RTS kamera (WASD, zoom, orbit, pan), yumuşak hareket, sektör kadrajı, init/resize/dispose ve aç-kapa, boş-veri/WebGL hatası görünümü. Bunları yok edip daha zayıf bir sahne yazma.

**ChatGPT'nin denetim raporu:** `docs/3d-migration/checkpoints/G3D-02A-INCOMING-20261123.md`. Orada tespit edilen gerçek eksikleri düzelt. Sen raporu değiştiremezsin.

## Proje ve koruma

- Repo: `zxc28tarik/FallOfCavalry`, WEB sürümüdür; Unity değil.
- Kaynak dal: `codex/web-3d-protected-battle-20261123`; başlamadan önce HEAD'i oku.
- Yeni **Gemini ADAY** dalı: `gemini/g3d-02a-r1-real-project-20261123`; `main`, PR #68, PR #72 ve `archive/**` ASLA değişmez.
- Zorunlu okuma: `GEMINI.md`, `00_KORUMA_SISTEMI.md`, `01_EN_IYI_PARCA_KAYITLARI.md`, `GEMINI_GOREV_G3D02_SAVAS.md`, `checkpoints/G3D-01.md`.
- **G3D-01 BEST**: `js/battle3d/ActiveSector3DViewModel.js` @ `c0e91e86873e2e680d1eb40c8fc9abd49d9f4224` (değiştirme). `projectActiveSector3D(sectorManager)` gerçek çıktı şeması:
  ```js
  {
    sectorId: string|null,
    soldiers: Array<{viewId,sectorId,side,groupId,soldierId,unitClass,combatRole,bodyType,mountType,activeWeapon,weaponLoadout,armorLoadout,state,hp,position:{x,y,z}}>,
    limits:{player:number,enemy:number},
    visible:{player:number,enemy:number},
    hiddenAlive:{player:number,enemy:number},
    dataAuthority:'existing_battle_simulation'
  }
  ```
  **Snapshot'ta `bounds`, `cameraTarget`, `friendlyCount`, `unitGroupCount` yoktur.** Bunları zorunlu alan sanıp gerçek snapshot üzerinde hata verme. Kamera sınırlarını ve hedefini `soldiers[].position` üzerinden **salt-okunur türet**, boş sektörde güvenli varsayılan kullan. Grup sayısını unique `groupId` ile hesapla.

## R1'DE KESİN YAPILACAKLAR

1. **Gerçek proje yapısı:** `three` npm dependency + `package-lock.json`; `js/battle3d/Battle3DRenderer.js`, tercihen `RTSCamera3D.js` / `Battle3DPreview.js`, `battle3d-preview.html`. Vite ile çalışan ayrı entry. **CDN'den** Three.js, Tailwind veya dış JS çekme. UI için küçük yerel CSS kullan.
2. **Projeden gerçek test veri adaptasyonu:** `js/battle/data/testBattleData.js` içindeki `createTestBattleData()` ve mevcut `SectorManager` API'sini kullan, `projectActiveSector3D` çıktısını orijinal fonksiyonla al. Yeni `createDeveloperTestBattleData`, `projectActiveSector3DSafe` veya HTML'de sahte `ug_royal_*` grupları üretme.
3. **Sadece zemin+kamera:** İyi önceki zemin, ışık, sis ve kamera davranışlarını yeni modüle taşı; 3D asker modelleri henüz yok (G3D-02B). Gelecek gerçek asker pozisyonları için çerçeve/odak şimdiden doğru olsun.
4. **Açık API:** `init(mount)`, `sync(snapshot)`, `resize()`, `dispose()` gibi çağrılar; idempotent dispose, RAF + window event listeners, GPU geometry/material/texture temizliği ve kapanış sonrası yeniden başlatma.
5. **Doğrudan ana oyuna müdahale etme:** 2D savaş sahnesi, ordu verisi, savaş AI/hasar, sektör, ekonomik görev/save akışları değişmez. Önizleme yalnız ayrı URL/feature flag ile açılır.
6. **Sınırlar:** `visible.player<=150`, `visible.enemy<=150` mevcut G3D-01'den; sen tekrar bir ordu oluşturarak 300 kuralını taklit etme.
7. **Açık hata davranışı:** WebGL başarısızlığında önizleme güvenli uyarı versin, 2D oyuna otomatik zarar vermesin. Kamera hareketleri yalnız 3D canvas üzerinde etkili olsun; klavye odağı UI butonlarını bozmasın.

## TESTLER (Gerçek kod/tests sun)

- Yeni `tests/unit/battle3d-*.test.js` testleri: null/empty/real snapshot, bounds derivation, camera clamp/zoom, oluştur-kapat-oluştur, kaynağın değişmezliği.
- `npm run validate`; `npm test`; `npm run audit:world`; `node scripts/check-3d-core-protection.mjs`.
- Vite preview'yi gerçek Chromium/WebGL ile açıp mümkünse gözlem kaydı ver.
- Çalışmadıysa açıkça `NOT RUN` ya da `FAIL` de. FPS ölçmediysen değer üretme.

## DOSYALAR / YETKİLER

**İzinli:** yeni `js/battle3d/**` dosyaları (yalnız yeni, G3D-01'dekini değiştirme), yeni `battle3d-preview.html`, yeni `tests/unit/battle3d-*.test.js`, `package.json` / `package-lock.json` (yalnız three ekleme).

**YASAK:** `js/battle/**`, `js/world/**`, `js/systems/**`, `js/managers/**`, `js/ui/**`, var olan oyun/test dosyaları, mevcut G3D-01 adaptör ve testleri, `main`, `archive/**`, force push/merge. Bunlara dokunmak gerekiyorsa **dur, gerekçeyi bildir**; kendiliğinden değiştirme.

**KAYIT VE KABUL SADECE CHATGPT'NİN:** `GEMINI.md`, `docs/3d-migration/00_KORUMA_SISTEMI.md`, `01_EN_IYI_PARCA_KAYITLARI.md`, `docs/3d-migration/checkpoints/**` ve koruma scriptlerini değiştirme. Sana ait tek iş kod adayını üretmek ve gerçek SHA ile teslim etmek.

## TESLİM

Bitince **yalnız G3D-02A-R1'de DUR**; G3D-02B'ye geçme.

- Aday dal adı ve **exact commit SHA**,
- tüm değişen dosyalar ve ne işe yaradıkları,
- bağımsız tarayıcı önizlemesinin açılış komutu/URL,
- testlerin gerçek çıktısı / başarısızlıklar,
- önceki HTML'nin korunmuş kamera-zemin-lifecycle özellikleri,
- şu aşamada eksik kalanlar.

**Çıktı yalnız HTML mockup değil; mevcut FOC web deposuna entegre edilmek üzere modüler gerçek kod.** Kabulü ve daha önceki en iyi özelliklerin güvenli kayıtlarını ChatGPT yapacak.
