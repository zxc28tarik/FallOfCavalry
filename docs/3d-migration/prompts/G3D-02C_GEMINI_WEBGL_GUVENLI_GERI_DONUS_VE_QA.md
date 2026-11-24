# GEMINI — G3D-02C: WebGL Hata Dayanıklılığı, Güvenli Geri Dönüş ve Test Kapıları

## BAŞLANGIÇ VE BİR TEK GÖREV
Sana verilen **`fall_of_cavalry_g3d_02b3_r1_s_vari_g_r_n_rl_k_testi_d_zeltmesi.html`** dosyasını temel al. Sıfırdan sahne/oyun yazma. **G3D-02C** yalnız WebGL başlatma doğrulaması, hata durumunda güvenli kontrol, sahne yaşam döngüsü ve bunların otomatik testlerine odaklanır. Önceki B3-R1 **5/5** test PASS; gerçek Chromium WebGL/Shader link/saha geçişleri PASS. Bunları bozmadan kalite güvenliğini artır.

**KULLANICIYA TAM OLARAK 1 İNDİRİLEBİLİR HTML:** `FallOfCavalry_G3D02C_WEBGL_GUVENLI_GERI_DONUS.html`. JavaScript, CSS, test kodu aynı HTML içerisinde. İnternet/CDN, harici JS/CSS, ZIP, model veya ek dosya indirtme. Tarayıcıda `file://` çift tıklamayla kullanılabilir olmalı; eğer kendi test ortamında `file://` yasaksa bunu açıkça yaz, yalan PASS verme.

## KORUNAN KALİTE VE KESİN SINIRLAR
- Önceki B3-R1 kullanıcı dosyası kaynak. Birebir orijinal GitHub'da `archive/gemini-g3d02b3-r1-original-20261124`, commit `3a969f3086c47febe0b6281913ebbc4c5e80e616`. SHA-256 `43ce438ff73adbc14439d7e45fc4d035012943646641b29854acae7720330815`.
- **B2 piyade geometrileri** mızraklı 44 / tüfekli 43 / kılıç-kalkanlı 41 parça aynen korunacak. **B3 at/binici ve dört süvari silahı** (lance/sabre/carbine/pistol) aynı kalacak: 200 görsel kombinasyon, farklı mountType ve armorLoadout; asla görünümü sadeleştirme.
- 12 grup ve özgün ordular (40 dost musketeer `grp_p_musketeers_right`, 38 düşman arquebusier `grp_e_arquebusiers_south`); `activeWeapon`, `mountType`, `viewId`, dizilim, koordinatlar, yüzler, renkler değişmesin.
- Merkez **300 (150/150) visible, 18/12 hiddenAlive**, süvaride **18 lance/14 sabre**; batı **62, 28 carbine/34 pistol**; doğu **50, 24 carbine/26 sabre**. Boş snapshot **0 asker/0 batch**.
- Sahne **7 soldier instanced batch**, önceki gerçek Chromium testinde **11 toplam sahne draw call** (ölçülmüş referans, her donanım için sabit değil). `RTSCamera3D`, zemin, sis, ışık, sekmeler, 3D modeller, HUD, fare/klavye kamera, sektör butonları, normal çalışma yolu korunacak.
- **`FOC_THREE` özel bir WebGL renderer'dır, gerçek Three.js değil; gerçek Fall of Cavalry battle runtime'ına bağlı değil.** Bu aşamada renderer'ı Three.js ile değiştirme, gerçek savaş motoru, 2D fallback motoru, animasyon/AI/hasar, dünya/şehir, yeni panel sistemi veya yeni modeller yazma.

## A. BAŞLATMAYI SAĞLAMLAŞTIR
1. `WebGLRenderer._initShaders()` içinde yalnız `compileShader` kontrolü yetmez: üç GL programının **`LINK_STATUS`** değerini de doğrula. Başarısızsa anlamlı hata üret; hatalı shader/program kaynaklarını temizle, bozuk sahneyi 'AKTİF' gösterme.
2. WebGL bağlamı alınamaması, instancing uzantısı bulunmaması, shader link hatası, canvas boyut 0, context-lost durumları için güvenli hata/temizleme yollarını açıkça tanımla. GPU erişimi yoksa **çökmeyen, bilgilendirici fallback ekranı** göster.
3. `ANGLE_instanced_arrays` olmaması halinde mevcut çizim fallback yolunu ve verilerin korunmasını gözet; bunun tek tek draw call'ı artıracağı konusunda telemetri/test net olsun. 300 asker için '7 GPU draw call' gibi yanlış genellemeler yapma.
4. `webglcontextlost` / `webglcontextrestored` olaylarını güvenle işle: default'u önle, animasyon döngüsünü durdur, geçersiz GPU referanslarını yeniden kullanma, kaynakları temizleyerek kullanıcı tarafından yeniden başlatılabilir duruma gel. Otomatik sonsuz restart veya arka arkaya context açma yok. Gerçek restore yolunu test edemiyorsan bunu doğrulanmadı diye açıkça yaz.

## B. GERÇEK 2D FALLBACK İDDİASINI DÜZELT
Bu HTML sadece **bağımsız 3D geliştirici önizlemesidir**. Canlı Fall of Cavalry 2D savaş ekranı dosyada bulunmuyor.
- WebGL çalışmadığında '2D savaşa geçildi' veya '2D ekranı korundu' gibi **gerçekleşmemiş bir entegrasyon iddiasında bulunma**. '3D önizleme açılamadı; mevcut FOC oyununun 2D yedeği bu dosyaya gömülü değil' gibi dürüst ve faydalı bilgi ver.
- **2D savaş motorunu burada yazma veya taklit etme.** Gerçek 2D fallback entegrasyonu Aşama 2'de ChatGPT'nin yapacağı ayrı iştir.
- 'WebGL Yok Testi', 'Sahneyi Kapat', 'Yeniden Başlat', 'Boş Veri' düğmeleri birbirine karışmadan çalışmalı; fallback modundayken hatalı input event/raf sızıntısı olmamalı.
- Kullanıcı sahneyi yeniden başlatınca seçili test/boş durumunu açıkça koru veya bir tutarlı kurala göre yönet; bu davranış test ile doğrulansın.

## C. GERÇEK KAYNAK TEMİZLİĞİ / DURUM MAKİNESİ
- `init→dispose→init`, `init→simulatedNoWebGL→reinit`, `init→empty→reinit` akışları idempotent olsun. İkinci dispose hata yaratmamalı.
- `CanvasTexture`, `BufferGeometry`, `InstancedBatchGroup`, GL programları, olay dinleyicileri, animasyon döngüsü ve bağlam referansları yeniden açıldığında eskiden kalıp çakışmamalı. Cleanup sırasında sadece yaratılan nesnelerin sahipliğini doğru ayır; her şeyin her kare silinmesi yasak.
- Çizim sırasında başarısız GPU durumunu yutmak yerine güvenli fallback'e geç; konsola gereksiz log seli oluşturma.

## D. BAĞIMSIZ TEST VE KABUL
Mevcut **beş B3-R1 birim testini aynen koru**, testleri kolaylaştırma.
Yeni, ayrı ve anlamlı testler ekle:
1. Shader compile PASS ama LINK FAIL olduğunda init'in güvenle başarısız olması ve program temizliği (kontrollü mock GL kabul; gerçek GPU testi de ayrı).
2. WebGL `getContext()=null`: fallback görünür, JS exception zinciri yok.
3. Normal init→dispose→init ve double-dispose; event listener/RAF birikmesi yok.
4. WebGL Yok Testi → reinit, boş snapshot → 0 → geri normal test snapshot, doğru UI.
5. `ANGLE_instanced_arrays` kapalı bir test bağlamında fallback kod yolu ve net çizim çağrısı davranışı. Mock ile çalıştırdıysan 'mock', gerçek tarayıcıyla çalıştırdıysan 'GPU' diye ayrım yap.
6. Önceki aktif silah değerleri/300-62-50/süvari görünürlüğü **korunuyor**. Piyade/geometri şablon hash kıyaslaması veya eşdeğer güvenilir regresyon kontrolü.

**Önceki 5 test + yeni testler hepsi PASS olmadan teslimi tamamlanmış sayma.** Gerçek Chromium/WebGL mümkünse ekran görüntüsü, JS pageerror, shader LINK_STATUS, `gl.getError()`, sektör geçişleri, toplam draw call ve dispose/reinit'e bak. FPS ölçmediysen sayı yazma. `file://` test edemediysen 'not verified' de.

## TESLİM VE İŞ BÖLÜMÜ
- Gemini yalnız tek aday HTML üretir; ChatGPT yüklemeden sonra bağımsız inceler, bütün eski sürümleri korur, GitHub arşivini ve BEST kararını yönetir.
- `main`, `archive/**`, `GEMINI.md`, `docs/3d-migration/checkpoints/**`, BEST kayıtları değişmez.
- Kısa bir özetle hangi fonksiyonlara dokunduğunu, gerçekten yürüttüğün testlerin sonuçlarını ve kalan sınırlamaları belirt.
- **YALNIZ `FallOfCavalry_G3D02C_WEBGL_GUVENLI_GERI_DONUS.html` tek indirilebilir offline HTML teslim et ve DUR.** B4, G3D-03, gerçek 2D fallback entegrasyonu ve animasyonlara GEÇME.
