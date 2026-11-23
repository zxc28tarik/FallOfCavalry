# FOC 3D — EN İYİ PARÇA KAYITLARI (SÜRÜM KORUMA)

**Başlangıç:** 23.11.2026. **Korunmuş kaynak:** `5641184f3cf745bfbc37c86740a261c97edb3662` / `archive/3d-v175-koruma-20261123`.

Bu kayıt **onaylanmış (BEST)** ve yalnızca önerilen **aday (CANDIDATE)** kodu birbirine karıştırmaz. Her Gemini görevinden sonra ilgili satırı kaynak SHA, test ve görüntü/gözlem kanıtıyla güncelle. Yeni çalışma önceki en iyi sürümü sessizce geçersiz kılamaz.

| Kod/özellik | En iyi korunmuş kaynak | Durum / vazgeçilmez özellik |
| --- | --- | --- |
| `SectorManager`, `SectorState` | V1.75 baseline SHA | Aktif sektör tek; sektör sayısı dinamik, diğerleri hafif simülasyon |
| `SectorRenderer` | V1.75 baseline SHA | **150 oyuncu + 150 düşman görsel**, yalnız aktif sektör, pool iadesi |
| `BattleSimulation`, savaş emirleri | V1.75 baseline SHA | Hasar, hedefleme, AI, moral / emir sistemini yeni renderer yeniden yazamaz |
| `SoldierInstance` | V1.75 baseline SHA | Kalıcı asker ID/loadout; battle başında reroll yok; Phaser'dan ayrı |
| `UnitGroup`, `FormationController` | V1.75 baseline SHA | Grup kimliği, gerçek formasyon pozisyonları ve komutları korunur |
| `BattleAdapter`, `BattleBoot` | V1.75 baseline SHA | Haritadan gerçek ordunun savaş/deploy girişine ve gerçek sonuçlarına köprü |
| `VisualSoldierPool`, `VisualSoldier` | V1.75 baseline SHA | Eski 2D renderer geri dönüş yolu ve görsel havuz davranışı |
| `BattleScene`, DeployScreen | V1.75 baseline SHA | Mevcut oynanabilir savaş/deploy modları kırılmaz |
| `js/systems/world-*` + harita | V1.75 baseline SHA | 881 şehir / 304 gerçek yol ve dünya kimliği (kanıt gerektirir) |
| City V2 / NPC / pazar / görev / kayıt | V1.75 baseline SHA | Şehir arazisi, gerçek üretim/stoğu, NPC/kervan ve save kaybı yok |
| 3D aktif sektör verisi adaptörü | **G3D-01 BEST: `c0e91e86873e2e680d1eb40c8fc9abd49d9f4224`**; test `cd02a59d72d41c1ece7ff9acdb5469bc64d862de` | Aktif sektör, 150+150, gerçek ID/equipment/formation; CI PASS `cbe3a1383c63f145010bec2b99d372832e2c2249` |
| Gerçek Three.js 3D savaş renderer'ı | YOK — G3D-02 BEKLEMEDE | 2D yol korunarak geliştirilecek |
| 3D dünya / 3D şehir | YOK — G3D-06/07 BEKLEMEDE | Önce gerçek kaynak, sonra çizim |

## Güncelleme şablonu (her modül, her artış)

- Görev: `G3D-XX`
- **Önceki BEST:** `<commit>` + `<dosya/fonksiyon>`
- **Gemini adayı:** `<branch>@<commit>`; değişen dosyalar
- **Silme/gerileme denetimi:** `PASS/FAIL`; gerekirse geri getirilen fonksiyonlar
- **Fonksiyonel test:** komut + gerçek çıktı
- **Görsel WebGL / 300 asker / sektör geçişi testi:** gerçek ölçüm veya `ÖLÇÜLMEDİ`
- **Karar:** `BEST'e terfi etti` veya `aday reddedildi, eski BEST korunuyor`
- **Kurtarma bağlantısı:** en iyi commit/branch

**Önemli:** 'en gelişmiş' tek bir son commit değildir. Bir parçanın gelişmişliği; ilgili işlev, çizim, oynanış, veri güvenliği ve testlerinin gerçekten korunmasıyla değerlendirilir. Bazı parçalar eski kabul edilmiş bir commit'te daha iyi olabilir.
