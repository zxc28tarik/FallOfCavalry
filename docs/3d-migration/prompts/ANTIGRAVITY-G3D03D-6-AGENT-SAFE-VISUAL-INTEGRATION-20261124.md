# ANTIGRAVITY — G3D-03D: 6 Görsel Ajan Çıktısını Kayıpsız Birleştir

## Girdi, otorite ve tek hedef
Bu görevi **verilen `focvisi(1).zip` içeriğini açarak** yap. Görev paketi `FOC-Visual-Sandbox/FOC_ANTIGRAVITY_6_AJAN_PAKETI/`. Kaynak `BASE_KORUNMUS_G3D03C_R1.html` **420537 byte SHA256 8b2eb0974937531fe1734f775335579aa9e171e923262cee27ee73ffaa8e0063** (ChatGPT'nin kabul ettiği G3D-03C-R1). Altı ayrı `AJANLAR/01..06/DELIVERABLE.html` aynı base'den türemiş alternatif kopyalardır. **Biri diğerinin üstüne kopyalanmayacak**. Kaynak ve özgün çıktılar salt okunur.

Bağımsız ChatGPT QA: Altı ajanın altısı gerçek Chromium'da **38/38 PASS**, 206 model `prim/mat/localMat[16]` ve 12 grup/442 asker verisi kayıpsız; 300 asker/7 batch korunmuş. **Bu birleşik sürümün başarılı olduğunu göstermez.** 05'in yoğun mock stres testi SwiftShader üzerinde **~47.18 saniye** sürdü. QA kaynak: `docs/3d-migration/checkpoints/ANTIGRAVITY-6-AGENT-ROUND1-20261124.md`.

**TEK hedef çıktı:** `INTEGRATION/FOC_G3D03D_6_AJAN_BIRLESIK_ADAY.html` + `INTEGRATION/MERGE_REPORT.md` + QA raporları. Bu özel `FOC_THREE` görsel önizlemesidir, gerçek Three.js/Unity ya da gerçek FallOfCavalry savaş/AI motoru değildir.

## Koordinatör — eşzamanlı 6 ajan, dosya çakışması sıfır
**6 ajanı aynı anda başlat:** yalnız bir ajan birleşik HTML dosyasına yazabilsin; diğer beş ajan kendi rapor alanında yalnız salt okunur analiz/QA çalışsın. Eşzamanlı yazma ve otomatik main merge yasak. Ajanlar:
1. **MERGE_WRITER**: altı ajan değişikliğini `INTEGRATION/G3D03D_MERGED_WORKING.html` içine fonksiyon bazında birleştiren **tek yazar**.
2. **CAVALRY_AUDIT**: 01+02+03 mızrak, kılıç, karabina ve tabancanın aynı asker registry/lifecycle'ında çakışmama kontrolü; sadece `QA/CAVALRY_AUDIT.md`.
3. **HORSE_AUDIT**: 04 walk/trot/toynak/5 at tipi, gait+action blend ve rider/eyer/üzengi; sadece `QA/HORSE_AUDIT.md`.
4. **FX_AUDIT**: 05 FX GPU state, 64 slot, draw calls, `depthMask`, `BLEND`, buffer/cleanup ve ~47s stres incelemesi; sadece `QA/FX_AUDIT.md`.
5. **SCENE_AUDIT**: 06 shader/light/fog/terrain ve 05 dumanının birleşik görünüşü; sadece `QA/SCENE_AUDIT.md`.
6. **REGRESSION_AUDIT**: önceki 37 testin aynı olması, bütün altı ek testin saklanması, kaynak/geometry/442 kimliği, sektör/GL/mobile kontrolleri; sadece `QA/REGRESSION_AUDIT.md`.

Salt okunur QA ajanları hemen bağımsız kod incelemesine başlayıp rapor yazarlar. Birleşik HTML bitmeden test koşturamadılarsa bunu açıkça belirtirler. MERGE_WRITER raporları kullanır ama diğer ajana ortak HTML yazma hakkı vermez. **Altı ajanın paralel çalışması ayrı yazıcı gerektirmez.**

## Birleştirilecek altı görsel özellik
- **01_ATLI_MIZRAK**: mevcut süvari mızrağı hazırlık, hamle ve toparlanma.
- **02_ATLI_KILIC**: mevcut süvari kılıç savuruşu.
- **03_ATLI_ATESLI**: mevcut karabina/tabanca nişan, recoil ve recovery.
- **04_AT_TOYNAK**: 5 at tipi, 4-beat walk, diagonal trot, toynak ve rider salınımı.
- **05_KARA_BARUT**: mevcut piyade tüfek ateşinin namlu flash/duman efektleri, 64-slot FX pool, GPU kaynaklarını yeniden kullan.
- **06_SAHA_GORSELLIK**: zemin/ışık/sis/uzak siluet paleti.

Önemli: 01,02,03 **aynı `computeCavalryPartLocalMatrix` ve `SoldierVisualRegistry` (`setSoldierVisualCombatAction`, `sync`, `update`) fonksiyonlarını değiştiriyor**. Üç helper'ın mantığını archetype seçimine göre tek fonksiyonda uyumlu birleştir. Yeni saldırı aktifken gait'i ve silah el bağlantısını koru; tek-shot one-intent döngü G3D-03C-R1 gibi bittiğinde durur. Hiçbir cavalry sınıfı diğer sınıfın hareketini yanlış almaz. 04'ün gait iyileştirmesini 01-03'ün eski fonksiyonuyla yanlışlıkla ezme. 05'in transparency drawing'i GPU state temizlemesini sağlamalı; 06'nın shader/fog ortamında render etmelidir. Önce 5 ayrı görseli kolaylaştırma adına kaldırmak yasak.

## 43 test ve gerçek QA
Eski 1–37 testler **anlamlı assertleri korunarak** çalışacak. Altı bağımsız ajan kendi testini **38** olarak eklemiş. Bunları aynen ve altısının da gerçek mantığını koruyup **38=01,39=02,40=03,41=04,42=05,43=06** olarak numarala. Hiçbirini silme, sabit PASS döndürme veya eşiği gevşetme. Test panelinde başarı sayısı gerçek sonuçtan üretilmeli; sabit `43/43` başlık metnine güvenme.

**Hedef 43/43** ama gerçek PASS görülmediyse eksikleri raporla. 05'in yoğun 55 adımlık mock testi doğal Chromium click işleminde 45–50 saniye sürebiliyor; bu sürede false timeout verip 43/43 olmuş gibi söyleme. Testte gereksiz GPU yükü varsa testin anlamlı kontrolünü koruyarak ayrı CI fast/stress modları sunabilirsin, fakat yeni birleşik QA'da 43 asıl test gerçekten geçmeli.

Gerçek WebGL smoke: 300 (150/150), batı62, doğu50, boş0, tekrar 300; 7 soldier batch, FX draw call ayrıca; 3 shader LINK true, `gl.getError=0` normal sahnede, WebGL context loss/fallback/manual reinit, dispose/reinit. Animasyon preview'leri doğru sınıflar, `viewId`/equipment sabit, 16 tek atak piyade/at kinematik, kullanıcı kamera pan/zoom preserved, ON→OFF eski duruş. 1440×900 ve 390×844 normal pointer click; gerçek screenshot görsel inceleme. **Fiziksel cihaz FPS, `file://`, otomatik context restore ayrı denenmediyse PASS iddia etme.**

## Sert koruma
- `createSoldierPartTemplates()` 206 anahtar; tüm `prim/mat/localMat[16]` 1:1. Yeni `rigGroup` metadata serbest, eski şekiller bozulmaz.
- `createTestBattleData()` 12 grup/442 SoldierInstance tam JSON 1:1; aktif silah, HP, class, side, groupId, pos, equipment değişmez.
- 150+150 görünürlük; 300/62/50/0; 7 soldier batch (ayrı FX ek draw call olabilir).
- Piyade walk, cavalry walk/trot, piyade 3 görsel action, 37 eski test, ekranlar ve kamera lifecycle korunur.
- Oyun AI, fizik, isabet/hasar, cephane/reload otoritesi, Unity ya da gerçek battle runtime kodu **KESİNLİKLE YOK**. Sadece görsel.
- `main`, `archive/**`, eski BEST, GitHub push/commit/merge, orijinal BASE/ajan dosyaları değişmeyecek. ChatGPT son QA ve sürüm kabulünden sorumlu.

## Teslim biçimi
1. **`INTEGRATION/FOC_G3D03D_6_AJAN_BIRLESIK_ADAY.html`**, tek çevrimdışı çalışan HTML.
2. **`INTEGRATION/MERGE_REPORT.md`**: 6 özelliğin tam olarak hangi fonksiyonlarda birleştirildiği, 43 test sonucu, gerçek görsel screenshot, render kaynak metrikleri, değişiklik/çakışma listesi ve açık FAIL'ler.
3. **`QA/*.md`** beş salt-okunur denetim raporu.
4. Çıktıları mevcut ZIP teslim düzeninde tek ZIP olarak kullanıcı ChatGPT'ye yollayacak. **Sen ayrıca nihai merge yapma veya 'kabul edildi' deme.** Birleşik görsel adayı teslim et ve DUR.