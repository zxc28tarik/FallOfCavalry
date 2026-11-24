# GEMINI — G3D-03A: PİYADE 3D HAREKET / YÜRÜYÜŞ GÖRSEL KATMANI

## Sınır: YALNIZ görsel hareket
Fall of Cavalry **`fall_of_cavalry_g3d_02c_r1_context_restore_ve_men_ak_mas_d_zeltmesi.html`** dosyasını aynen temel al. **G3D-03A** aşamasında ilk kez hareketsiz asker önizlemesine veri-güdümlü basit **yürüme/yer değiştirme/istikamet görselleştirmesi** eklenecek. Bu **savaş, AI, takım emirleri, gerçek pathfinding veya animasyon motorunu yeniden yazma görevi değildir**.

**ÇIKTI TAM OLARAK BİR TEK İNDİRİLEBİLİR HTML: `FallOfCavalry_G3D03A_PIYADE_HAREKET_YURUYUS.html`**. JS/CSS ve geometri aynı HTML içinde, harici CDN/font/3D asset/JS/CSS/ZIP yok. Kullanıcıya yalnız tek HTML teslim et. G3D-03A'da dur, G3D-03B/04'e geçme.

## Önce koru — QA kapıları
- G3D-02C-R1 orijinal arşiv `archive/gemini-g3d02c-r1-original-20261124`, commit `ad1684e28331490904e263ffe5cd29a2756fff9f`, SHA256 `fee773a427f900c06dcf2a6d80ec02a7c8a1003b949e6b288c54c43ddb45e9eb`.
- R1 önceki **11/11 test gerçek Chromium'da PASS**; 1440×900 üst menüde önceki tıklanamazlık düzeltilmiş; 1366/1440/1680/768/390 genişliklerinde normal pointer tıklamaları PASS. WebGL 3 shader link PASS, normal glError 0. Bu düzeltmeleri koru.
- **Piyade şablonları** pikeman=44, musketeer=43, swordsman=41 parça (iki taraf); **200 at/binici süvari şablonu**, dört süvari görsel silahı, materyal/renk/ölçek/at anatomisi değişmeyecek. Yeni bir model seti yazma; piyade parçalarını azaltma veya low-quality değişimle animasyon çözme.
- **12 demo grup/kimlik/ekipman/aktif silah/kayıt/pozisyon aynen korunacak**: `createTestBattleData()`, `SectorManager`, `projectActiveSector3D()`, limit 150+150, hiddenAlive 18/12, merkez 300, batı 62, doğu 50, `grp_p_musketeers_right` 40 / `grp_e_arquebusiers_south` 38; 7 soldier batch temel hedef; 11 scene draw calls önceki ortam ölçümü yalnız referanstır.
- `FOC_THREE` bu dosyanın kendi WebGL motorudur, gerçek Three.js veya gerçek Fall of Cavalry savaş runtime'ı değildir. **İkisini burada değiştirme veya bağlıymış gibi iddia etme.** Sadece görsel önizleme.
- R1'deki context lost/restored, shader cleanup, test sistemi, responsive layout, boş veri fallback, dispose/reinit ve kamera kontrolleri **korunacak**.

## A. HAREKETİN TEK OTORİTESİ SNAPSHOT
- Her askerin hareketi **dışarıdan gelen aynı `viewId`'li `snapshot.soldiers[]` içindeki `position` ve mümkünse `state` alanlarını okuyarak** olsun. Simülasyon otoritesi 3D çizim katmanına geçmesin.
- `SoldierInstance` / `UnitGroup` ve `createTestBattleData` verilerini oynatmak için mutasyona uğratma. `soldier.position`, `activeWeapon`, `hp`, `state`, `side`, `groupId` ve savaş mekaniğine yazma.
- Aynı `viewId` hedef konumu güncellendiğinde görsel asker önceki konumdan yeni konuma hızla teleport etmeden **ölçülü interpolasyon** yapabilsin. Hedefe varınca tam pozisyonda dursun. Yeni snapshot gelmediğinde hedefe bağlı kalıp kendi başına yürümeye devam etmesin.
- Dönerken yürüyüş yönüne göre gövdenin yüzü dönsün; iki tarafın aynı eski karşıya bakma `yaw` varsayımı yalnız eski sabit durumda fallback olabilir. Kamera/terrain/saha koordinat sistemini koru.
- Duraklama/boş veri/sektör değişimi/dispose/reinit/context kaybında interpolasyon tamponları güvenle temizlensin veya sabitlensin. Yeni sektöre eski sektör askerleri kayarak taşınmasın.
- `viewId` sabit kalsın; görsel alt nesneler her güncellemede yeniden oluşturulmasın; aynı snapshot'ı tekrar vermek asker hareketini yeniden başlatmasın.

## B. YALNIZ PİYADELER İÇİN HAFİF YÜRÜYÜŞ POZU
- Sadece `infantry_pikeman`, `infantry_musketeer`, `infantry_swordsman` için hareket hâlinde dönüşümlü bacak/kol yürüyüş pozu ekle. **Mevcut 44/43/41 parça kimliği/silueti korunacak**, yeni düşük çözünürlüklü modele geçme. Hareket etmeyen askerler orijinal statik pozlarını kullanmalı; gereksiz nefes/salınım animasyonu ekleme.
- Sol/sağ adım dönüşümlü, ayaklar zeminin üstünde ve uzaktan anlaşılır ama aşırı savrulma/kayma yok; tüfek, mızrak ve kalkan/eldeki silah **elde kalmalı**, eldeki mevcut aktif silah başka silaha dönüşmemeli.
- Aynı asker bütün karelerde aynı boyda/ekipmanda. Yakın kamera veya uzak kamera model silueti bozulmamalı.
- İlk sürümde **süvariler statik model olarak kalabilir**; konumları snapshot ile taşınabilir ama dörtnal, at bacağı animasyonu ve süvari saldırısı BU AŞAMADA YOK.
- Hareket ve beden pozları görünüş içindir; çarpışma, saldırı, vurma, düşme, animasyon-hitbox veya fizik oluşturma.

## C. PERFORMANS VE GPU KAYNAKLARI
- Mevcut **7 instanced soldier batch** mümkünse koru (aynı 6 primitive + 1 shadow); anlık karede her askere ayrı draw call/mesh oluşturma.
- Kalıcı geometri ve GL buffer kullanımını koru. Yalnız hareket eden askerin gerekli instance transform verisini güncelle; CPU'da her kare bütün 200 süvari şablonunu yeniden oluşturma. Tekrarlanan snapshot'ta yeni buffer yaratma. Normal yolda unbounded RAF, interval, listener bırakma.
- `ANGLE_instanced_arrays` fallback yolunu koru, context restored sonrası hareket ve GPU matrisi doğru görünmeli. FPS ve VRAM ölçmediysen uydurma sonuç yazma.
- Eğer 7 batch kısıtında animasyonun teknik olarak imkânsız olduğunu düşünürsen modeli silmek yerine ayrı kıyas ve gerekçe sun; esas render sistemini değiştirme.

## D. GÖRÜNEBİLİR TEST — DEMO ORDUYU DEĞİŞTİRMEDEN
- Kullanıcının 3D harekete bakabilmesi için geliştirici test panelinin içinde **tek küçük 'Yürüyüş Önizlemesi' aç/kapat kontrolü** koyabilirsin. **Üst araç çubuğuna yeni düğme ekleme**, dar ekranların üst menüsünü ve gerçek tıklamaları yeniden bozma.
- Bu test kontrolü yalnız **kopya bir görsel snapshot** üzerinde, seçilmiş birkaç piyadeyi belirli hedeflere geçici interpolasyonla götürüp geri döndürebilir. Orijinal `createTestBattleData()` ve `SectorManager` nesneleri hiçbir zaman mutasyona uğramayacak.
- Kullanıcı test önizlemesini kapatınca, sektör değiştirince, boş veriye geçince veya yeniden başlatınca bütün demo görsel hareketleri temizle; normal 12 grup aynı pozisyonda kalmalı. Savaş simülasyonu varmış gibi 'AI hareket ediyor' diye yazma.
- Test paneli içinde hangi hareketin **sahte snapshot gösterimi**, hangisinin gerçek savaş entegre modülü olmadığını belirt. Arayüzde yazı kalabalığı artırma.

## E. TEST / G3D-03A KABUL
1. Önceki **11/11 G3D-02C-R1** testlerinin hepsini kaldırmadan gerçekten çalıştır; yeni testlerini ayrı ekle.
2. İki eşit snapshot → **0 görsel yeniden yaratım**, 0 yeni hareket başlangıcı; aynı viewId pozisyon değişince smooth yaklaşım; örnek 0→10m yürüme hedefinde monoton/finite konum ve sonunda 10.0m hedef.
3. Poz hareketinde yürüyüş başladığı/durduğu, sol/sağ adımların farklı olduğu, silahın yerinden kopmadığı, asker başına parça/model kimliği değişmediği kontrolleri.
4. Sektör 0→1→2→0: 300→62→50→300, boş veri 0 ve hiddenAlive, tüm görünür aktif silah ve piyade / süvari sayıları doğrulansın. Eski sektörden ghost asker kalmasın.
5. Context lost→manual reinit / mock restore, shader link, `gl.getError`, GPU buffer/RAF kaynakları korunsun.
6. 1440×900 ve 390×844 dahil gerçek mouse/touch ile üst menü, sektörler, test paneli, yeni test kontrolü tıklanabilir. Uygulama görüntüsüyle birlikte 3D askerlerin yürüyüşünü hareket halinde gerçekten kontrol et; görsel testini yapamadıysan 'NOT VERIFIED'.
7. Özgün piyade/at/süvari/model fonksiyon kodları önceki R1 ile kıyaslanacak; yalnız *zorunlu görsel hareket* içermeyen kaynaklar değiştirilmemeli.
8. Tek indirilebilir bağımsız offline HTML, gerçek `file://` test edilmediyse ayrı 'DOĞRULANMADI'; ölçülmeyen GPU FPS raporlanamaz.

## Kod teslim ve GitHub yetki sınırı
Gemini yalnız HTML adayını üretir. **ChatGPT tüm orijinal yedekleri, sürüm QA karşılaştırmasını, BEST seçimini ve son ana oyun entegrasyonunu yönetir**. `main`, `archive/**`, `GEMINI.md`, checkpoint, BEST ve koruma scriptlerine dokunma.

**Sadece `FallOfCavalry_G3D03A_PIYADE_HAREKET_YURUYUS.html` adlı tek indirilebilir HTML ver; 3–5 cümlede gerçek değişiklikleri ve test sonuçlarını söyle; sonra DUR.** Combat AI, pathfinding, gerçek savaş sistemi, at animasyonları, ordu emirleri, 3D şehir veya G3D-03B'ye geçme.
