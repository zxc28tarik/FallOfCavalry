# FOC 3D — KAYIP ÖNLEME / GEMINI GELİŞTİRME ANAYASASI

**Kullanıcının 23.11.2026 tarihli bağlayıcı talimatı:** Gemini'nin yeni geliştirmede önceki iyi parçaları silmesi, sadeleştirmesi veya eski seviyeye düşürmesi kabul edilmez. **Her geliştirme ayrı ve geri alınabilir kaydedilir.** Her modülün **kabul edilen en gelişmiş sürümü** korunur ve yeni sürümler onunla karşılaştırılır. Kaybolan parçalar tespit edilip geri getirilmeden geliştirme kabul edilmez.

## Kalıcı kaynak ve sınırlar

- Ürün: **Fall of Cavalry**. Kullanıcı **dünya, şehir, deploy, asker, savaş ve aftermath'ın tamamını 3D** hedefliyor.
- Web 3D prototipi: Three.js veya uygun WebGL çizimi; mevcut **Phaser/JS oyun mantığı** korunur. **Nihai PC/Steam hedefi Unity/C#** geçmiş tasarım kararında mevcut; web geçişi bu ayrı hedefi kendiliğinden iptal etmez.
- Kullanıcının örneği: sohbet eki `3d_age_of_empires_rts_sava_oyunu.html` — Three.js ile HTML'de oynanabilir 3D RTS mümkün olduğunu gösteren **teknik referans**. O örneğin kendi ordularını, sahte AOE sınıflarını veya ekonomisini FOC'ye taşımayın.
- **Başlangıç commit'i:** `5641184f3cf745bfbc37c86740a261c97edb3662` (WEB V1.75).
- **Değişmez geri dönüş dalı:** `archive/3d-v175-koruma-20261123`.
- **3D çalışma dalı:** `codex/web-3d-protected-battle-20261123`. `main`, mevcut taslak PR #68 veya Unity reposu onaysız değiştirilmez.
- Sektörlü savaş: tek görünür aktif sektör; diğerleri hafif veri simülasyonu; **sabit 9 sektör YOK**. Hâlihazırda `SectorRenderer.VISUAL_LIMIT_PER_SIDE=150`, dolayısıyla **150+150=300 görünür 3D asker hedefi**.
- `SoldierInstance` veri, `UnitGroup` birlik, `VisualSoldier` sunumdur. Askerin kalıcı yükü savaşa girerken yeniden üretilmez. Modüler görünür ekipmanda yapay sabit parça sınırı YOK.
- Dünya haritası büyüktür; bölgesel yükleme, kamera tabanlı ayrıntı, uzakta veri simülasyonu. Bütün dünyayı tek 3D mesh/nesne yığınına dönüştürme YASAK.
- Yeni 3D kod **önce ayrı, isteğe bağlı katman** olarak kurulur. 2D çalışan yol çalışır kalır, geçiş kapalıyken birebir korunur.

## GÜNCEL ÜST KURAL — KAYITLARI **GEMINI DEĞİL CHATGPT** YAPAR

Kullanıcı açıkça: **“kayıtları sen yapacaksın hiçbir zaman geminiye güven olmaz”** diye belirtti. Bu nedenle iş bölümü kesin:

- **GEMINI:** Sadece görevde izin verilen üretim kodunu yazar, gerekirse kendi *aday* dalına commit eder, değişikliklerini teslim eder. Gemini'nin raporu, testi çalıştırdım iddiası, backup/registry/checkpoint dosyası **güvenilir kabul edilmez**.
- **CHATGPT KOORDİNATÖRÜ (tek yetkili):** Her Gemini **alt tesliminden hemen sonra** SHA'yı yakalar, bağımsız geri dönüş referansı ve önceki BEST'i kaydeder, dosya/işlev/asset/davranış karşılaştırmasını yapar, kayıpları önceki BEST'ten geri getirir, test/oyun/browser sonuçlarını doğrular ve **yalnız kendisi** BEST kararı verip registry/checkpoint dosyasını günceller.
- Gemini'nin değiştirmesi **YASAK** olan yollar: `GEMINI.md`, `docs/3d-migration/00_KORUMA_SISTEMI.md`, `docs/3d-migration/01_EN_IYI_PARCA_KAYITLARI.md`, `docs/3d-migration/checkpoints/**`, `scripts/check-3d-core-protection.mjs` ve `archive/**`. Kod commit'i kayıt/backup yerine geçmez.
- Kullanıcıya sunulacak her sürümün geçmiş parçaları ChatGPT tarafından **ayrı ayrı doğrulanmış** olmalı. Şüpheli/görsel doğrulaması eksik sürüm yalnız CANDIDATE'tir.
- Gemini sonraki göreve **ChatGPT kabul kontrolü tamamlanmadan** geçmeyecek. Başka bir oturumda bu kontrol kendiliğinden/arka planda çalışmış sayılmaz.

## HER GEMINI TESLİMİNİN CHATGPT DENETİMLİ ZORUNLU DÖNGÜSÜ (atlama yok)

1. **Önce oku:** `00_KORUMA_SISTEMI.md`, `01_EN_IYI_PARCA_KAYITLARI.md`, ilgili G3D görev dosyası, çalışan kod ve tüm ilgili testler. Baseline commit ve mevcut dal HEAD SHA'sını raporla.
2. **Bir hedef = bir ayrı geliştirme:** Her görev için `G3D-XX` kimliği, izinli dosya listesi, gereksinimler ve net yasak değişiklikler yaz; ilgili alana **ayrı dal** aç. Bir görevde dünya/şehir/savaş/ekonomi karıştırma.
3. **İlk işi değişiklik yapmadan yap:** CHATGPT korunan yöntemlerin en iyi kodunu, testlerini, mevcut oyun akışını ve UI davranışını `01_EN_IYI_PARCA_KAYITLARI.md` içinde SHA ile tespit eder; Gemini yalnız okur. Bir dosyanın son sürümü her zaman o özelliğin en iyisi olmayabilir.
4. **Değiştirirken ekle:** Öncelik yeni `js/battle3d/`, `js/world3d/`, `js/city3d/` gibi ayrı dizinlerde kod. Gerçek sistem sahiplerini (BattleAdapter, SectorManager, SoldierInstance, economy, quest, saves) kopyalayıp ikinci bir gerçeklik üretme.
5. **Her mantıklı artışı ayrı commit:** Gemini kod adayını ayrı commit'te teslim eder; **ChatGPT** her teslimin SHA'sını ve bağımsız yedeğini alır, değişen dosyaları ve kazanımları kendi kayıtlarına geçirir. Toplu tek commit ile birden çok kabul edilmiş parçayı kaybetme.
6. **CHATGPT önce-sonra karşılaştırır:** `git diff --name-status`, `git diff --stat`, `git diff`; silinen fonksiyon, kaybolan davranış, eskiye dönen geometri, asker kimliği/yükü, sektör/ordular, UI ve testleri tek tek kontrol et. Deletion veya gerileme varsa **en iyi sürümden SADECE o parçayı geri getir**, başka yeni parçaları silme.
7. **CHATGPT test kanıtını doğrular:** En az `npm run validate`, `npm test`, `npm run audit:world`; gerçek Chromium/WebGL 3D giriş-görünürlük, sektör geçişi ve 2D fallback testi. FPS'i ölçmediysen değer uydurma. Her başarısız testi kaydet, geçmeden tamamlandı deme.
8. **CHATGPT kabul öncesi özet:** görev, base SHA, candidate SHA, hangi önceki en iyi parçaları koruduğu, test çıktısı, performans sınırları, açık eksikler. **Kullanıcı istemeden main'e merge veya önceki dalı silme.**
9. **YALNIZ CHATGPT registry günceller:** Yalnız gerçekten kanıtlanıp kabul edilmiş özelliklerin `best_commit` işaretini taşı; başarısız/aday kodu 'en iyi' yapma. Her aşama için `checkpoints/G3D-XX.md` oluştur.
10. **ChatGPT'nin hazırladığı sonraki Gemini promptu** her seferinde güncel registry'deki en iyi parçaları ve SHAları listelemek zorunda. Sadece son Gemini cevabını kopyalayıp 'güncel' varsayma.

### Kurtarma ve koruma kuralları

- `git reset --hard`, `git push --force`, dosya-toplu değiştirme, test silme, referans dalını değiştirme ve eski sahne yerine yalnız demo sahnesi koyma **yasak**.
- İstenmeyen silme tespitinde **önce blokla**; en iyi referans commit'teki kod parçasını yalnız hedef dosyaya cherry-pick/restore ile geri al ve tekrar test et.
- `BEST` ve `CANDIDATE` ayrı tutulur. Başarısız 3D prototip eski düzgün çalışan oyunun yerine geçmez.
- Değişikliğin işe yarayıp yaramadığı belirsizse özelliğin durumu `ADAY — DOĞRULANMADI`; kabul edilmiş sürüm eski SHA olarak kalır.

## Yapılandırılmış aşamalar

- `G3D-00` : Koruma dalları, önceki en iyi parça kayıtları, Gemini görev protokolü.
- `G3D-01` : Sadece mevcut aktif sektör verisinden salt-okunur 3D asker pozisyonu / kimlik adaptörü.
- `G3D-02` : Seçilebilir gerçek 3D savaş renderer'ı (mevcut 2D yol korunur).
- `G3D-03` : Asker/at/ekipman modüler 3D mesh ve animasyon, görsel havuz/instancing.
- `G3D-04` : Gerçek formasyon, emir, isabet/ölüm görselleri ve seçim/kamera HUD; savaş kuralları yeniden yazılmaz.
- `G3D-05` : Sektör değişimi, yalnız aktif sektör çizimi ve pasif diğer sektörler; FPS/GC ve uzun testler.
- `G3D-06` : Dünya haritası 3D: chunk/LOD/streaming, gerçek şehir/304 yol/terrain kaynakları.
- `G3D-07` : Şehir V2 3D: gerçek parseller ve yapılar; pazar/atölye/karakter sistemi aynen korunur.
- `G3D-08` : Deploy/Aftermath/Encounter 3D uyarlaması, uçtan uca gameplay QA.

**Bu belge yalnız talimat değil; asıl koruma ChatGPT'nin doğruladığı Git geçmişi, bağımsız geri dönüş dalları, testler ve en iyi bileşenlerin SHA kayıtlarıdır.** Gemini erişimi olmayan bir ortamda görev kendiliğinden çalıştırılmış sayılmaz.
