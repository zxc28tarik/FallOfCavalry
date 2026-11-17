# FOC WEB — KAYNAKÇA VE KOD OTORİTESİ

## A. Canlı web GitHub kaynakları (17 Kasım 2026'da incelendi)

- Repo: https://github.com/zxc28tarik/FallOfCavalry
- `main` HEAD: https://github.com/zxc28tarik/FallOfCavalry/commit/f377c72f0c094f274a72239fa477f996a21af114
- GitHub PR #50 (yeni Phaser/soldier modular altyapısı — görsel asker G14'e kadar dokunulmaz): https://github.com/zxc28tarik/FallOfCavalry/pull/50
- Aktif harita orchestrator: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/managers/RenderManager.js
- Dünya 64×32 projection: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/rendering/dimetric/projection.js
- Dimetrik chunk/biyom: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/rendering/dimetric/terrain-chunk-cache.js
- Nature/variant: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/rendering/dimetric/nature-layer.js
- Yol ve nehir: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/rendering/dimetric/path-layer.js
- World sprite depth: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/rendering/dimetric/depth-sort.js
- Main ground shared helper: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/rendering/main-ground-texture.js
- Sprite loader: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/rendering/sprite-loader.js
- World source/map manifest: https://github.com/zxc28tarik/FallOfCavalry/blob/main/assets/world-map/world-map-manifest.json
- Map asset loader: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/world/world-map-asset-loader.js
- World graphics config: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/constants/world.js
- City scene definitions: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/data/city-scene-defs.js
- City building catalog: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/data/city-building-catalog.js
- City UI scenes/services: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/ui/city-services.js
- City state/warnings: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/systems/city-state.js
- City manifest template: https://github.com/zxc28tarik/FallOfCavalry/blob/main/assets/city-scenes/ottoman/manifests/cityscene_ottoman_full_manifest.template.json
- City system GDD: https://github.com/zxc28tarik/FallOfCavalry/blob/main/docs/city-overhaul/01-city-system-gdd.md
- City faction art bible: https://github.com/zxc28tarik/FallOfCavalry/blob/main/docs/city-overhaul/03-faction-art-bible.md
- City implementation master plan: https://github.com/zxc28tarik/FallOfCavalry/blob/main/docs/city-overhaul/04-implementation-master-plan.md
- City gameplay mechanics: https://github.com/zxc28tarik/FallOfCavalry/blob/main/docs/city-overhaul/05-city-gameplay-mechanics.md
- Build/test: https://github.com/zxc28tarik/FallOfCavalry/blob/main/package.json
- Regression test checklist: https://github.com/zxc28tarik/FallOfCavalry/blob/main/docs/regression-checklist.md
- Historical progress: https://github.com/zxc28tarik/FallOfCavalry/blob/main/progress.md
- Phaser scene (soldier assets reserved): https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/battle/BattleScene.js

**Source timing:** Links go to current `main`; repo may change later. At implementation start refresh HEAD and recheck paths. 17 Kasım 2026 denetiminde HEAD `f377c72` idi.

## B. Bu projenin yüklenmiş önceki kaynakları

- `foc.zip` — web oyunu arşivi, GitHub PR #50 öncesi kaynak snapshot olabilir; main'e kör kopyalanmaz.
- `FOC_Web_Plan_Paketi/01_MASTER_PLAN.md` — 72 işli daha geniş **gameplay/technical** plan; görsel program onun ekidir.
- `Osmanli_Sehir_Yapisi_V2_Guncel_Plan.md` — alan tabanlı şehir, İç Kale sabit, diğerleri doluluk varyantı ve pasif alanlar.
- `Osmanli_Uretim_Ilerlemesi.md` — önceki Osmanlı görsel ilerleme kaynak belgesi; eski görseller yeni final sanata otomatik aktarılmaz.
- `FOC-Karar-Defteri-Guncel.md` — eski kapsamlı karar defteri; yeni kullanıcı kararları daha üst düzeydedir.
- `FOC_Web_GitHub_Durum_Raporu_2026-11-17.md` — GitHub yapısı ve güncel hasar incelemesi.
- `visual_audit/contact_sheet.jpg` — eski harita ve battle screenshot temas sayfası; estetik/teknik baseline niteliğindedir.

## C. Kaynak öncelik sırası

1. Kullanıcının **bu konuşmada en yeni açık kararı**.
2. Bu V1 görsel programının kullanıcının onayladığı değişmez ilkeleri.
3. GitHub'da anlık çalışan code + state semantiği (uygulama doğrusu).
4. Şehir GDD/art bible/V2 kararları (şehir kapsamı), bunlarla çelişmeyen sanat standardı.
5. Önceki görsel/progress kaynakları (tarihsel bilgi; nihai üretim kaynağı değil).
6. Eski resimler (yalnız kıyas ve geçici fallback).

**Kritik uyarı:** Sadece görsel üretim amacıyla gameplay ve source-of-truth state değişikliklerine gidilmez. Tarihsel karar ile mevcut çalışan kod farklıysa önce fark **raporlanır**, kullanıcı/teknik kararı olmadan birine göre diğerini sessizce değiştirme.