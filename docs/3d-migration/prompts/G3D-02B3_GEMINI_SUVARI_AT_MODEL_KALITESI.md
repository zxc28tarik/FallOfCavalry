# GEMINI — G3D-02B3: SÜVARİ / AT 3D MODEL KALİTESİ VE DOĞRU EL SİLAHI

## GÖREV: TEK SINIRLI AŞAMA
Fall of Cavalry için **kullanıcının sana vereceği `fall_of_cavalry_g3d_02b2_piyade_3d_model_kalitesi.html` dosyasını** doğrudan geliştir. G3D-02B2'nin 3D zeminini, piyadelerini ve sistemlerini baştan kurma. **Yalnızca at ve atlı askerin 3D görsel kalitesini, ekipman doğruluğunu ve duruşunu iyileştir.**

**ÇIKTI TAM OLARAK BİR İNDİRİLEBİLİR HTML:** `FallOfCavalry_G3D02B3_SUVARI_AT_MODELLERI.html`. Dosya offline, `file://` ile çift tıklayarak açılmalı; JS/CSS/mesh/texture/asset aynı HTML'de olmalı. ZIP, JS, CSS, model, resim veya test dosyasını ayrı indirtme.

## İLK ÖNCE KORUMA
- Önceki B2 adayı birebir GitHub'da saklı: `archive/gemini-g3d02b2-original-20261124`, commit `d356d051badbb7a7605f10adbd59c98e10fd3b36`. Kontrol raporu: `docs/3d-migration/checkpoints/G3D-02B2-INCOMING-20261124.md`.
- B2'deki **mızraklı piyade (44 parça), tüfekçi (43), kılıç-kalkanlı piyade (41)** şablonlarını, yeni `frustum`/`dome` geometrilerini, materyal tonlarını ve eski modelleri **aynen koru**. Atlı görünümü geliştirebilmek için piyadelerin detaylarını kesme.
- **150 dost + 150 düşman** görünür limit, merkez 300 kayıt, batı 62, doğu 50, gizli canlı 18+12, sektör geçişi, viewId/havuzlama, boş veri, 7 instanced soldier batch, arazi/ışık/sis, kamera WASD/Q-E/pan/zoom/orbit, sektör paneli, tests, dispose/re-init ve WebGL fallback korunacak. Özellikle iki geri kazanılmış grup: `grp_p_musketeers_right` = 40 ve `grp_e_arquebusiers_south` = 38.
- `createTestBattleData()`, `SoldierInstance`, `SectorManager`, `projectActiveSector3D()` ve demo birliklerin ID/sayı/pozisyon/activeWeapon/zırh verilerine dokunma. Yeni demo ordu yazma.

## A. ATLARIN MODEL KALİTESİ
`createSoldierPartTemplates()` içindeki `buildCavalry(side, withLance)` yapısını iyileştir. Mevcut atlı şablonları yok etmeden veya başka biçimle değiştirmeden anatomi ve siluet kalitesini artır:
- Daha doğru at gövdesi/sağrısı/göğsü, belirgin boyun-baş-burun, iki kulak, yele/kuyruk, dört ayrı bacak, diz/bilek/toynak bağlantıları.
- Bacakları rastgele veya kopuk yerleştirme; statik hareketsiz at pozu zemine dört toynakla otursun. Ön-arka bacak ayrımı ve atın ileri baktığı yön açık olsun.
- Ölçek, eyere oturan insanla orantılı olsun. Eyer, eyer örtüsü, kayış, üzengi ve dizginler okunabilir ama düşük poligonlu olsun.
- Ağır savaş atı ve hafif binekleri `mountType` üzerinden *görsel* olarak ölçülü ayırabilirsin; at veri türü veya yeni mekanik icat etme. Örnekler: `warhorse`, `courser`, `rouncey`, `destrier`, `charger`, `steppe_horse`.
- Tarihi 1650 Avrupa/Osmanlı bağlamına yakın, pratik savaş atı estetiği; fantastik, neon veya devasa abartılı zırh yok.

## B. SÜVARİ VE BİNİCİ
- Binicinin bele/eyere oturuşunu, iki bacak ve üzengiyi, gövde-omuz-kol oranlarını iyileştir. Atla binici birbirinden kopuk, havada asılı veya birbirine gömülü görünmesin.
- Miğfer/kask, cuirass, ceket, deri kayış, silah kemeri/dizgin tutuşu gibi **gerçek veriyle uyumlu** basit dönem detayları ekle; bütün süvarileri aynı ağır zırhlı şövalye yapma.
- Görsel siluet uzaktan atlı olarak tanınmalı, yakın zoomda binicinin ekipmanı anlaşılmalı.
- Mevcut `cavalry_lancer` ve `cavalry_sabre` şablonları korunmalı; gereksiz mikro parçayla 300 asker performansını bozma.

## C. KRİTİK GÖRSEL BUG: HER ATLIDA KILIÇ OLMASIN
B2'nin `classifySoldierArchetype()` kodu atlıyı mızraklı değilse çoğunlukla `cavalry_sabre` gösteriyor. Örneğin aktif silahı `carbine`, `flintlock_carbine` ya da `wheellock_pistol` olan süvariyi kılıç sallıyormuş gibi göstermek **yanlış**.

Yalnızca *görsel arketip seçimini* `soldier.activeWeapon` ve `mountType` üzerinden iyileştir:
- `war_lance` / uygun lance → atlı mızrak, elde doğru tutuş.
- `cavalry_sabre` / `sabre` → süvari kılıcı.
- `carbine` / `flintlock_carbine` / `short_carbine` → kısa atlı tüfeği.
- `wheellock_pistol` → döneme uygun tabanca.
- Örnek gruplar: `grp_p_harquebusiers_west` **carbine**, `grp_p_dragoon_east` **flintlock_carbine**, `grp_e_reiters_west` **wheellock_pistol**, `grp_e_lancers_guard` **war_lance**, `grp_p_cuirassiers_reserve` **cavalry_sabre**.
- Bu değişiklik **yalnız görüntü temsili** olmalı; asker `activeWeapon`, loadout, sınıf, pozisyon, hasar veya kimliğini asla değiştirme. Yan silahtaki kılıcı aktif silah gibi gösterme.
- Yeni ekipman şablonu için mevcut `cavalry_* / infantry_*` kayıtlarını kaybetme. Görsel test gerekiyorsa sınıf testini demo gruplarını değiştirmeden yap.

## PERFORMANS KAPILARI
- Önceki 7 soldier batch'i mümkün olduğunca koru; yeni paylaşılmış geometri gerekiyorsa **en fazla 10 soldier batch** hedefle, gerekçeni açıkla. Detayları silip test geçirme.
- `SoldierVisualRegistry` mevcut `viewId` eşlemesi/sync korunacak; aynı snapshot tekrar geldiğinde yeni görsel oluşturulmamalı; her karede mesh veya GPU buffer yeniden yaratılmamalı.
- GPU instancing yolu ve ANGLE yokken fallback yolu korunmalı; 300 asker için her askere ayrı ışık/gölge veya O(n²) yakınlık hesabı yazma.
- Bütün model parçaları `soldier.position` çevresinde doğru local dönüşümle çizilmeli; kameralı ortamdaki facing/yanlış yön sorunları varsa yalnız görsel dönüşümü düzelt.

## TESTLER
1. G3D-02B2'deki **5 gömülü testi aynen koruyup** gerçekten çalıştır. Yeni testler ekleyebilirsin fakat eskileri silme veya kolaylaştırma.
2. 300 merkez / 62 batı / 50 doğu; 18+12 hiddenAlive; boş sektör 0; `viewId` tekrar oluşturulmaması.
3. Üç piyade şablonunun parça sayıları ve bütün görünür materyal/siluet özellikleri önceki B2'ye göre gerilemesin; yeni piyade geometri tipleri korunsun.
4. Örnek tüm süvari gruplarının `activeWeapon` → **gösterilen silah arketipi** eşleşmesini ayrı otomatik testle doğrula. Farklı at sınıfı görseli yalnız mountType'dan türetilsin.
5. Kamera, zoom, ses/arayüz eklemesi olmadan, fallback, dispose/re-init, offline tek HTML, sektör butonlarını kontrol et.
6. Gerçek Chromium/WebGL ile yakından ve RTS uzaktan görüntü, GPU draw call/FPS ölçümü mümkünse test et. Yapamadıysan **NOT VERIFIED** yaz. Test etmek, görsel QA'yı otomatik PASS yapmaz.
7. Kodun gerçek FOC savaş simülasyonuna bağlı olmadığını açıkça belirt. **FOC_THREE**, gerçek Three.js değildir; motor değiştirip sıfırdan demo yazma.

## GITHUB / DURMA KURALI
Gemini yalnız kod adayını üretir; `main`, `archive/**`, `GEMINI.md`, `docs/3d-migration/checkpoints/**`, BEST kayıtları, koruma scriptleri değişmez. Arşiv, kalite kıyaslama, BEST kararı ve oyunun son birleşimi **ChatGPT'ye aittir**.

**Sonuç: YALNIZ `FallOfCavalry_G3D02B3_SUVARI_AT_MODELLERI.html` indirilebilir dosyasını ver. 3–5 cümleyle gerçek değişiklikleri ve test sonuçlarını bildir. Yürüme/dörtnal animasyonu, savaş, AI, hasar, sektör lojikleri, dünya/şehir, UI yeniden tasarımı veya G3D-03'e GEÇME.**
