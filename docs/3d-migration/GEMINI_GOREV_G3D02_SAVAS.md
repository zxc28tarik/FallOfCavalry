# GEMINI GÖREV PAKETİ — G3D-02: FOC 3D AKTİF SEKTÖR SAVAŞ GÖRSELİ

**GÖREV AYRIMI: Gemini yalnızca kod adayı üretir. Yedek/önceki BEST kıyası/checkpoint/test doğrulaması/kabul yalnız ChatGPT'ye aittir.**

> BU GÖREVİ UYGULAMADAN ÖNCE `docs/3d-migration/00_KORUMA_SISTEMI.md` ve `01_EN_IYI_PARCA_KAYITLARI.md` dosyalarını **eksiksiz oku**. Kullanıcının en önemli kuralı: yeni bir gelişmede önceki en iyi parçayı asla silme; her adımı ayrı commit'te kaydet ve eski+yeniyi kontrol et. Kullanıcının chat eki `3d_age_of_empires_rts_sava_oyunu.html` yalnız HTML/Three.js ile gerçek 3D RTS yapma yöntemini örnekler; o örneğin sahte ordularını, istatistiklerini, müziğini veya savaş motorunu taşımak yasaktır.

## Bağlam ve mevcut proje

- Repo `zxc28tarik/FallOfCavalry`; 3D başlangıç çalışma dalı `codex/web-3d-protected-battle-20261123`; değişmez eski 2D+oyun baseline dalı `archive/3d-v175-koruma-20261123` @ `5641184f3cf745bfbc37c86740a261c97edb3662`.
- Oyun web sürümünde Phaser kullanan 2D savaş ve sektör alt yapısı gerçek. Nihai PC/Steam Unity hedefi ile bunu karıştırma.
- `js/battle/sector/SectorManager.js`, `SectorState.js`, `SectorRenderer.js`: çok sektör; yalnız biri görsel, diğerleri headless. 150 asker/taraf, toplam ~300 **hard cap**; sabit 9 sektör yok.
- `js/battle/unit/SoldierInstance.js` asker ID/kalıcı loadout sahibidir. `UnitGroup.js` birlik, `FormationController.js` pozisyon sahibidir. `BattleSimulation.js` canlı çatışma hesaplar. 3D bunların hiçbirine paralel ikinci kural motoru getirmez.
- `js/battle/BattleAdapter.js`, `BattleBoot.js`, `BattleScene.js` ve mevcut deploy → battle → aftermath/quest/save akışına dokunmadan geri dönüş seçeneği sağla.
- İlk read-only veri köprüsü `js/battle3d/ActiveSector3DViewModel.js` dosyasında yer alır (G3D-01); **sahte asker yerine bu görünümü kullan**. G3D-01 eksikse önce üret ama G3D-02 kodunu aynı commit'e yığma.

## Görev yalnız G3D-02: 3D RENDERER V1

1. Yeni, izole `js/battle3d/` dizininde **Three.js tabanlı** (npm bağımlılığı + lockfile) `Battle3DRenderer` oluştur; normal oyunun mevcut renderer'ını silme.
2. Oynatılabilir **gerçek aktif sektör** verisinden temel 3D arazi, basit ama okunur piyade, okçu, mızraklı, tüfekçi ve süvari temsilleri çizebilsin. Eksik görsel varlıklar için açık `placeholder` kullan, kimliği/ekipmanı uydurma. Basit geometry ve animasyon referanstaki gibi olabilir, birebir kopyalama değil.
3. Birlik, asker ve grup ID'leri kaynak FOC verisiyle birebir bağlantılı olmalı; seçili asker/orduya güvenli görsel işaret, kamera orbit/pan/zoom ve sadece gözlem amaçlı HUD olabilir. Tıklama emirlerini yeniden icat etme; önce mevcut emre bağlayan ayrı adaptör tasarla.
4. Görünür sayı yalnız aktif sektörde max **150+150**. Uzak 3D nesneler için instancing ve LOD stratejisi; her asker için birden fazla bağımsız shadow caster ve her kare O(n²) separation YASAK.
5. Her güncellemede 3D objeleri sıfırdan üretme. Key = `sectorId:groupId:soldierId`; aynı asker state güncellendiğinde aynı pooled visual yaşamaya devam etsin. Sektör geçişinde önceki 3D nesneleri release et; data/SoldierInstance asla yok edilmez.
6. Eski `launchBattle`, deploy, dünya, karakter üretimi, atölye/satıcı, 881 şehir/304 yol, save, quest ve 2D battle fallback değişmeden kalır.
7. İlk açılış 3D'yi varsayılan yapma; **feature flag** ile 2D ve 3D arasında açık kullanıcı/QA seçimi. 2D yol testlerini koru.

## KORUNMASI ZORUNLU EN İYİ PARÇALAR

- SectorManager/State: kaynaklı gerçek savaş, hafif pasif sektör, tek görünür aktif sektör.
- BattleSimulation: hasar/hit/morale/retreat/projecile hesabı yalnız eski gerçek motorda.
- SoldierInstance: kalıcı ve tekil kimlik, yük/aktif silah, yaralanma/ölüm ve save sonucu.
- Group formasyonları/emirleri; gerçek deploy; mevcut savaş sonucunun quest/loot/save tetiklemeleri.
- Phaser 2D renderer/sprite havuzu/animasyonların **tamamı** geri dönüş yolu olarak durur.
- Referanstaki AOE benzeri 'Kraliyet Ordusu' / 'Kızıl Lejyon' birlikleri, sahte scenario spawn veya başka bir balance system getirilmeyecek.

## DOSYA KAPSAMI

**Tercih edilen izinli:** `js/battle3d/**`, `tests/unit/battle3d-*.test.js`, ayrı kapalı 3D giriş adapter'ı, `package.json` / `package-lock.json` (yalnız dependency), `docs/3d-migration/checkpoints/**` (YALNIZ CHATGPT; Gemini bu dosyalara dokunamaz).

**Varsayılan dokunma:** `js/battle/core/**`, `js/battle/sector/**`, `js/battle/unit/**`, `js/systems/**`, `js/managers/**`, `js/ui/**`, `assets/world-map/**`, save ve quest. Zorunlu küçük edit için önce dosya/fonksiyon sınırını ve geri dönüş kanıtını sun; korunan kodu silme.

## TESLİM ŞEKLİ (adım adım)

- Commit A: 3D renderer yalnız sahne/zemin/kamera + gerçek proje bağı.
- Commit B: canlı 3D asker instancing/pool ve yük profilini modelleme.
- Commit C: testler, fallback ve gerçek aktif sektör geçişi.
- Her **Gemini aday commit'i** sonrası değişikliği **ChatGPT** ayrı kaydeder, `git diff` ile önceki BEST parçaları tek tek karşılaştırır ve `npm run validate` + `npm test` + `npm run audit:world` + gerçek Chromium WebGL smoke sonuçlarını bağımsız doğrular.
- `checkpoints/G3D-02.md` dosyasını **YALNIZ CHATGPT** yazar: teslimin exact SHA'sı, önceki en iyi parça, PASS/FAIL kanıtı, gerçek ölçülmüş FPS veya `ÖLÇÜLMEDİ`. Gemini kendi kabul kaydını tutamaz.
- BEST statüsüne yükseltme yetkisi **yalnız CHATGPT'de**; Gemini kendi kodunu BEST ilan edemez. `main`e birleştirme ve koruma dalını silme YASAK.

**Tamamlandı kıstası:** gerçek FOC savaş verisi ile geçerli 3D savaş sahnesi, 2D fallback sağlam, aktif sektör dışında 3D asker yok, 150/150 limitleri, gerçek savaş sonucu sahipliği korunmuş, regresyon testleri PASS ve checkpoint kaydı mevcut.
