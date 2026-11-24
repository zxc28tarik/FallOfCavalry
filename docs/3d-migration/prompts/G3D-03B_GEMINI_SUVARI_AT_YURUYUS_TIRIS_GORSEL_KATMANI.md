# GEMINI — G3D-03B: SÜVARİ + AT YÜRÜYÜŞ/TIRIS GÖRSEL ANİMASYONU

## Görev / tek aşama
**Tek temel dosya:** `fall_of_cavalry_g3d_03a_r3_y_r_y_kamera_oda_korumas.html`. Bu dosya ChatGPT bağımsız QA ile **G3D-03A-R3 ACCEPTED** sayıldı: 24/24 Chromium test PASS, 206 model şablonu ve 442 asker korunmuş, piyade yürüyüşü, 0→1→2→3 kamera odak koruması, 7 soldier batches, WebGL glError0. Kod koruma raporu: `docs/3d-migration/checkpoints/G3D-03A-R3-ACCEPTED-20261124.md`; özgün HTML branch `archive/gemini-g3d03a-r3-original-20261124`, commit `ee9b060fed18bd9010172d8fa0196a73c747f3ba` ve orijinal Git blob SHA `93e6731560718b8a38efb6b54732a74451e6495d`.

**Yeni iş sadece süvari+at için yer değiştirme sırasında doğal görsel yürüyüş ve tırıs hareketleri.** Bu gerçek savaş hareket/AI/pathfinding/saldırı/temas/hasar animasyonu DEĞİLDİR. Poz ve gait, gelen snapshot `position` ile oluşturulan `SoldierVisualRegistry` görsel state'inden üretilir. Geçici demo snapshot gerçek asker kaydını değiştiremez. Süvari oyunu ancak ileride gerçekten gerçek battle authority ile entegre edilebilir.

**TEK indirilebilir bağımsız offline HTML:** `FallOfCavalry_G3D03B_SUVARI_AT_YURUYUS_TIRIS.html`. Tek script/CSS HTML içine; harici CDN, font, JS, model, ZIP veya ikinci dosya YOK. G3D-03B'yi bitir ve DUR; G3D-03C/G3D-04'e geçme.

## KESİN KORUMA — BÜTÜN ÖNCEKİ KAZANIMLAR
- G3D-03A-R3 **24/24 test** aynen koşulsuz korunacak (testleri kolaylaştırma, silme, hardcode PASS yapma). R3'ün `Battle3DRenderer.sync(...,{preserveCamera:true})` davranışını ve **4 leg boyunca kamera odağını koruma testini** bozma.
- **206 toplam model şablonunun** bütün `prim`, `mat`, `localMat[16]`, part count/position/scale/silah/armor/horse anatomisi değerleri **BİREBİR AYNI**. 6 piyade (44/43/41 her iki taraf) + 200 süvari (side/mount/weapon/rider kombinasyonları). **Gait rig etiketleri/ayrı animasyon metadata'sı eklenebilir, ama orijinal geometriler değiştirilmez veya hiçbir parça silinmez.**
- **12 grup ve 442 askerlik `createTestBattleData()` kaynak ordusu birebir**: `groupId, soldierId, viewId, unitClass, activeWeapon, weaponLoadout, armorLoadout, mountType, hp, state, side, position` değişmez. Merkez 300 (150+150), hiddenAlive 18/12, batı62, doğu50, boş0. Kılıçlı piyade yoksa sırf test için diğerlerinin sınıfını değiştirme.
- Mevcut bütün piyade yürüyüşü (`computeInfantryPartLocalMatrix`, 16 piyade, yürüyüş kamerası, 24 test), GPU context loss / dispose / reinit / camera user override, responsive 1440/768/390 kullanıcı tıklaması, `ANGLE_instanced_arrays` fallback, eski renklendirme korunacak. Yeni üst toolbar butonu/YENİ HUD tasarımı yok.
- R3'te küçük kapsam dışı değişiklik olarak düşman demo `nextZ += dir * step.dz` not edildi; mevcut fonksiyonu savaş hareketi gibi sayma, **bu aşamada değiştirme**. Sadece süvari demo yürüyüş hedeflerini kopya snapshot'ta oluştur.
- Özel `FOC_THREE` motorunu **Three.js diye sunma**, gerçek FallOfCavalry oyun savaş/Unity runtime ile bağlanmış gibi raporlama.

## 1. At gövdesini yeniden modellemeden gerçek yürüyüş görseli
`createSoldierPartTemplates` içindeki `buildAnatomicalHorse1650` mevcut parça sırasından atın 4 ayrı ön/arka sol/sağ bacağını tanımla (üst bacak, diz, alt bacak, bilek, toynak). `rigGroup` veya ayrı deterministic bone metadata atayabilirsin; **orijinal localMat, renk/prim/part count değişmesin**. Rigid at gövdesi + boyun/baş + eyer/üzengi/dizginliğinin doğal hareketini hafif görsel transform ile sağla. Toplam model boyu orantısı ve animasyon yürüyüş sırasında korunur, at uzayıp kısalmaz, bacaklar ters dönmez. Ayaklar mümkün olduğunca zemine temas etsin, hareketsiz atların tüm parçaları orijinal statik pozuna **birebir** dönsün.

Gait:
- **Walk**: dört bacak ayrı fazlar, yumuşak adım, hafif baş/gövde salınımı, üst-alt bacak uyumu.
- **Trot**: karşı köşegen bacak çiftlerinin uyumlu daha hızlı adımlaması, biraz daha belirgin ama ölçülü dikey yaylanma; gerçek hareket hızıyla tutarlı faz.
- Ayrı `horseGaitPhase`, `horseGaitBlend`, `horseGaitMode` (veya mevcut görsel state'i uyarlayan eşdeğer) yalnız render kayıtlarında; hız/değişen target delta based. Gait seçimi gerçek snapshot state/speed varsa yalnız veri okur; **atın gerçek hızını veya savaş konumunu değiştirerek animasyon üretme.** Eşikler belirli, yumuşak geçişli. Sadece yeni hedefe yaklaşırken stride ilerler, durunca blend→0 ve hazır duruşa geçer; sabit snapshot'ta zamanla koşmaya devam etmez.
- At **tırnak/toynak, yele, kuyruk, baş/neck ve eyer/koşum** parçalarının kimliği korunsun. Baş eyerden kopmasın, reins ellerle uyumlu, at bacağı bedenle aynı kompozisyonda.

## 2. Binici at ile doğru hareket etsin
- Binicinin mevcut silueti, eyer üstündeki konumu, kask/zırh/silah korunur. Binici pelvis/torso çok küçük kontrollü yukarı-aşağı hareketle at ritmine uyum sağlar; diz/ayaklar üzengiden ayrılmaz, rider atın içine girmez veya havada uçmaz.
- Dört aktif süvari silah varyantı **kesin korunur**: `war_lance` (mızrak), `cavalry_sabre/sabre` (kılıç), `carbine/flintlock_carbine/short_carbine` (karabina), `wheellock_pistol` (tabanca). Gait sırasında karabina aniden kılıca dönüşmeyecek, mızrak/rifle binici elinden kopmayacak. Yeni gerçek saldırı, atış, reload, kıvılcım veya hitbox ANİMASYONU YOK.
- `resolveCavalryVisualVariant(soldier)` mevcut `mountVariant` 5 tür ve `riderVariant` 5 tür yapısını kullan; 200 anahtarın hepsinde gövde/silah materyal değişimine neden olma. Piyade rig hesapları ayrı kalsın.
- `Mat4.multiply()`, scratch typed arrays ve mevcut `_updateBatchBuffersInPlace()` yoluna **animasyon local transform uygulanarak**, her kare 1 mesh/1 gl buffer yaratılmadan, 7 soldier batch (uygunsa 7; zorunluysa 10'a kadar gerekçeli) ile çalışmalı. Büyük format değişimi veya yeni motor yok.

## 3. KULLANICIYA GÖRSEL SÜVARİ TESTİ — gerçek orduyu değiştirme
- Mevcut `unitTestPanel` içine **küçük bir 'Süvari Hareket Önizlemesi' aç/kapat kontrolü** koy; piyade yürüyüş butonunu olduğu gibi bırak. Aynı anda iki demo açık olmasın; biri açılırsa diğer demo güvenle kapanmalı. **Üst toolbar'a yeni buton koyma.**
- Demo yalnız `projectActiveSector3D()` sonuçlarının **kopya snapshot** verisinde örn 4 dost cuirassier ve 4 düşman lancer hareketini kısa hedeflere götürebilir; normal 12 grup değiştirilmez. İsteğe bağlı batıdaki carbine/pistol ve doğudaki carbine/sabre'yi gerçek mevcut gruplarda ayrı sektör testinde göster.
- Test kamerası R3'ün `preserveCamera:true` düzeltmesini aynen kullanmalı: 1440×900 sol/right paneller arasında en az **4** görünür hareketli süvari, yürüyüş boyunca kadrajda olsun, yeni leg gelince sektör merkezine sıçramasın. Kullanıcının pan/zoom/rotate müdahalesi sonraki snapshot'ta korunmalı; demo OFF→başlangıç kamerası dönmeli. Sektör değişiminde, boş veride, context lost / dispose'da önizleme state temizlenmeli, eski atlar/snapshots ghost bırakmamalı.
- Sadece gerçek demo olan 1650 test ordusu; asıl savaş simülasyonu yürütülüyor, AI süvari hareket ediyor veya grafik engine Three.js oldu diye iddia etme.

## 4. Kabul testleri — eski 24 + yeni minimum 6 bağımsız test = 30/30
Önceki 24 testin kaynaklarını aynen koru, yeni **25–30** testleri gerçek hesaplama/konum/GL durumundan geçir:
25. Süvari model 200/200 tam parça matrix kimliği ve 4 aktif silah sınıfı korunması, demo kopyası `viewId/equipment/side/hp` değişmez.
26. Aynı snapshot tekrar verildiğinde süvari model yeniden yaratılmaz/animasyon yeniden başlamaz; yeni hedef ve `viewId` sürekliliği/finite position.
27. Statik at tam önceki statik localMat; walk/stand/stop dönüşü, dört bacakta ayrı phase, toynak zemin sınırı, bacakların negatif uzunluk/ölçek patlaması olmaması.
28. Trot köşegen çiftleri faz/kadans farkı ve binici-eyer/silah bütünlüğü, farklı beş at tipi ve dört silah varyantının örnekleri; yalnız mock emek değil gerçekten `evaluateSoldierPartMatrix`/instance-matrix üzerinden.
29. Görsel süvari önizlemesi ON→ iki/üç leg→OFF; gerçek kamera preserve ve 1440x900 ekran izdüşümüyle en az 4 hareketli süvari paneller arasında; insan piyade preview'suna ve 16 askere regresyon yok.
30. 300/62/50/0, hiddenAlive, batch <=10 (hedef7), GL context loss/reinit, GPU buffer lifecycle ve aynı 442 ham asker data test.

Bütün testlerin gerçekten çalıştırılması, `PASS` labelını sabit yazmama. Özellikle 24. kamera testi 0→1→2→3 korunacak. Gerçek Chromium/WebGL'de görsel **at gait farklı fazları** screenshot/inspection; 1440x900 + 390x844 click, Shader LINK 3/3, glError0; file:// bizzat doğrulanmadıysa söyle. Fiziksel GPU FPS/VRAM ölçmeden sayı verme.

## Tek teslim
**`FallOfCavalry_G3D03B_SUVARI_AT_YURUYUS_TIRIS.html`**. Kısa özet: hangi görsel gait desteklendi, model/data koruması, yeni test sonuçları, ölçülemeyen/çalıştırılamayanlar. Ana `main`, `archive/**`, `GEMINI.md`, BEST ve checkpoint'e dokunma; bunları ChatGPT koruyup bağımsız doğrulayacak. **İş bitince DUR.** G3D-03C, gerçek battle AI, fizik, savaş animasyonu, Unity geçişi, şehir ve dünya haritasına geçme.
