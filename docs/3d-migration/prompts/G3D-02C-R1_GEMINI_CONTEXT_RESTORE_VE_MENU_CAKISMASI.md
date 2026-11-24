# GEMINI — G3D-02C-R1: CONTEXT RESTORE TEST HATASI + MENÜ ÇAKIŞMASI (TEK HTML)

## GÖREV: SADECE İKİ SOMUT HATA
Verilen **`fall_of_cavalry_g3d_02c_webgl_g_venli_geri_d_n_ve_sahne_kararl_l.html`** dosyasını AYNEN temel al. Sıfırdan oyun/sahne/renderer yazma. Bu turda **yalnızca**:
1) Başarısız `runBattle3DUnitTests()` test #11'in işaret ettiği WebGL context-loss / restore durum makinesi tutarsızlığını ve test akışını DÜZELT.
2) 1440×900 başta olmak üzere üst araç çubuğunun sol yan panel tarafından kapatılması ve `Birim Testleri` düğmesine normal fareyle tıklanamaması sorununu DÜZELT.

**Yeni mimari, oyun mekaniği, görsel kalite veya sonraki aşama YOK.** Tek kullanıcı teslimi `FallOfCavalry_G3D02C_R1_CONTEXT_VE_MENU_DUZELTILMIS.html`, internetsiz tek HTML, harici JS/CSS/asset/ZIP yok.

## BAĞIMSIZ CHATGPT BULGULARI (KESİN)
- Kaynak G3D-02C GitHub'da ham/birebir korundu: `archive/gemini-g3d02c-original-20261124` (commit `09ab0e239b77e4b49acdeda14687739e11b88b78`); rapor `docs/3d-migration/checkpoints/G3D-02C-INCOMING-20261124.md`.
- SHA256: `7632811045b5e15ee52b00561c65242f28aeae5b2699877bb4578abaf6ad1eb1`.
- Gerçek Chromium WebGL/SwiftShader: merkez **300 (150/150), hiddenAlive 18/12, 7 soldier batches, toplam 11 sahne draw call, 3/3 LINK_STATUS=true, glError=0**; batı 62, doğu 50; boş veri 0 batch; kullanıcı düğmesiyle context kaybından sonra yeniden başlatma çalışıyor.
- Gerçek Chromium birim testleri: **10/11 PASS**. **#11 FAIL** ve ekranda `Context geri geldiğinde kaynaklar ve döngü güvenli biçimde yenilenmeli` hatası.
- Test #11'in `createMockWebGLContext({noInstancing:true})` mock'u `ANGLE_instanced_arrays` vermediği gibi `WEBGL_lose_context` de vermiyor. `Battle3DRenderer.simulateContextLoss()` uzantı yokken yalnızca `this._onWebGLContextLost(...)` çağırıyor; `FOC_THREE.WebGLRenderer._contextLost` **false** kalıyor. Ardından test `renderer.renderer._handleContextRestored()` çağırıyor fakat içteki `if(... || !this._contextLost) return` ile erken çıkılıyor. Bu, **iki katmanın state tutarsızlığı / simülasyon protokolü sorunu**. Testi kapatmak, `assert` silmek, `true` dönmek veya sahte otomatik restore PASS yazmak kabul değil.
- 1440×900'de G3D-02C header `height=95px`; `.foc-sidebar top=82px`, test butonu `x256–365 / y68–96`. Sidebar test butonunun üzerine biniyor; Playwright normal pointer `click` yapamıyor. B3-R1 header 59px idi. Sadece JS `el.click()` ile çalıştırmak UI çözümü değildir.

## HATA #1 — GERÇEK YAŞAM DÖNGÜSÜ DÜZELTMESİ
- `FOC_THREE.WebGLRenderer` ile `Battle3DRenderer` context-lost state ve callback sırasını netleştir; simüle loss, gerçek `webglcontextlost`, gerçek `webglcontextrestored` ve manuel `dispose/reinit` tutarlı olsun.
- Testin kullandığı **mock / uzantısız** loss akışında WebGLRenderer ve Battle3DRenderer aynı kayıp durumunda bulunmalı; restore testi gerçek `onContextRestored` callback'ini, kaynak invalidation ve yeni RAF planlamasını fiilen doğrulasın. Mock kullanılacaksa `webglcontextlost/restored` olaylarını veya motor state geçişini düzgün simüle et; `WEBGL_lose_context` yokken gerçek GPU context kaybı yaşandığını iddia etme.
- Gerçek `WEBGL_lose_context` sunulduğunda browser olayları + `event.preventDefault()` + kaynak yeniden kurulumu korunsun. Restore etkinliğinin başarısızlığı güvenli fallback ekranıyla sonuçlansın, sonsuz tekrar açma olmasın.
- `_handleContextRestored`, `_handleContextLost`, `simulateContextLoss`, `forceContextLoss`, `_onWebGLContextLost`, `_onWebGLContextRestored` arasındaki ilişkiyi **minimum gerekli değişiklikle** düzelt. Test #11'in A kısmındaki non-instanced standart `drawElements` ve B kısmındaki kayıp/geri-dönüş kontrolleri korunmalı.
- **11 testin tümü gerçekten PASS**; testleri kolaylaştırma veya çıkarma. Ek denetim olarak restore sonrası `WebGLRenderer._contextLost===false`, `Battle3DRenderer.isContextLost===false`, `rafId!==null`, shader programları geçerli, kaynaklar yeniden oluşturulabilir olsun. Kapatma/double-dispose ve test 6–10 bozulmasın.

## HATA #2 — TIKLANAMAYAN ÜST MENÜ
- 1440×900 çözünürlükte üst bar iki sıraya çıktığında `.foc-sidebar` `top:82px` sabitliği butonları örtüyor. **Üst barın gerçek yüksekliği kadar güvenli dikey boşluk bırak** veya responsive yerleşim kullan.
- `Birim Testleri`, `WebGL Yok Testi`, `Context Kaybı Testi`, `Sahneyi Kapat` ile sektör seçimi, kamera kontrolleri normal mouse/touch pointer ile ulaşılabilir olmalı. Kapatma butonu fallback overlay altındaysa fallback ekranındaki yeniden açma butonu çalışmalı.
- 1366×768, 1440×900, 1680×960 ve 768px / 390px genişliklerde yatay taşma/yan panel toolbar örtmesi yapma. Gerekirse yan panel scroll etsin, test sonuç paneli görünür kalsın.
- **Test koşulu**: `Birim Testleri` butonunun görsel merkezinde `document.elementFromPoint` gerçekten o butonu/çocuğunu göstermeli ve standart Playwright `locator.click()` doğrudan başarılı olmalı. `force:true`, `evaluate(el=>el.click())` veya CSS `pointer-events:none` ile sahte geçiş olmaz. Diğer butonların erişilebilirliği de kontrol edilmeli.
- Renkleri, görsel sanat stilini, mevcut panel içeriğini veya modelleri yeniden tasarlama.

## BİREBİR KORUMA KAPILARI
- B2 piyadeler: **44/43/41 parça**; B3 at/biniş anatomisi, 200 süvari şablonu, dört doğru aktif silah görseli; tüm `createSoldierPartTemplates()`, `classifySoldierArchetype()`, `resolveCavalryVisualVariant()` işlevsel görünüm verisi, materyaller değişmemeli.
- G3D-02C orduları: 12 grup, 40 dost tüfekçi `grp_p_musketeers_right`, 38 düşman arkebüzcü `grp_e_arquebusiers_south`, 150+150 limit, hidden 18+12, sektör 0/1/2 = 300/62/50, stable `viewId`, `projectActiveSector3D()` değişmez.
- 7 soldier batch, önceki 11 toplam draw call referansı; shader LINK_STATUS kontrolleri, memory/resource cleanup, ANGLE alternatif yolu, kamera/zemin/ışık/sis, WASD/orbit, boş veri ve fallback açıklaması **korunmalı**. Gerçek 2D savaş motoru bu dosyada YOK — varmış gibi söyleme.
- Bu hâlâ **FOC_THREE özel WebGL preview**, gerçek Three.js veya gerçek Fall of Cavalry battle `SectorManager` modüllerine canlı bağlı değil. Bunları bu görevde değiştirme.

## GERÇEK TESLİM KALİTE KONTROLÜ
1. JS parser PASS, tek HTML, no CDN / imports.
2. Gömülü **11/11 gerçek PASS**; #11 A+B kontrolü ve iki katman context durumu tutarlı.
3. Normal tarayıcı fare tıklamalarıyla 1440×900 test paneli açılması; diğer butonlar ve 1366×768 / 390px mobil yerleşim.
4. Gerçek Chromium + WebGL mümkünse merkez/kanat/boş veri, context kaybı, güvenli manuel reinit, shader LINK_STATUS, glError, 7 soldier batch ölç. Özellikle `file://` test edilemiyorsa **DOĞRULANMADI** belirt. FPS ölçmediysen sayı verme.
5. Kısa diff özeti: hangi fonksiyonlar ve hangi CSS yerleşim kuralları değişti? Piyade/at/süvari/data kaynak kodu hash regresyonu eşleşiyor mu?

## TEK DOSYA / GITHUB KURALI
Kullanıcıya sadece **`FallOfCavalry_G3D02C_R1_CONTEXT_VE_MENU_DUZELTILMIS.html`** tek indirilebilir offline HTML sun. Ayrı ZIP/JS/CSS/model/rapor dosyası indirtme. `main`, `archive/**`, `GEMINI.md`, checkpoint ve BEST kayıtlarına dokunma; ChatGPT orijinali bağımsız arşivler, test eder, entegre eder.

**G3D-02C-R1'i tamamla ve DUR; G3D-03 / animasyon / gerçek savaş entegrasyonu / dünya / şehir aşamalarına GEÇME.**
