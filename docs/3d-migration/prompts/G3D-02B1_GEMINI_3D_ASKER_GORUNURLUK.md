# GEMINI — G3D-02B1: TEK HTML'DE GERÇEK 3D ASKER GÖRÜNÜRLÜĞÜ

## GÖREV — YALNIZCA 1 KONU
Fall of Cavalry G3D-02A-R2'nin **mevcut tek HTML dosyasını** temel alıp **aktif sektördeki askerleri ilk kez gerçekten 3D çiz**. Başka sistemlere atlama. Sadece plan anlatma: çalışan kodla bitir. Çıktı **tam olarak 1 indirilebilir, internetsiz `file://` ile açılan HTML** olacak, başka dosya/ZIP/JS/CSS verme.

Girdi: kullanıcının sağlayacağı **`fall_of_cavalry_g3d_02a_r2_tek_dosya_3d_sava_altyap_s.html`**. Yeni dosyanın adı: **`FallOfCavalry_G3D02B1_3D_ASKERLER.html`**.

## YÜKSEK ÖNCELİKLİ KORUMA / CHATGPT HAFIZA
- Kayıt, yedek, en iyi sürüm, regresyon denetimi **yalnız ChatGPT** tarafından yapılır. Sen yeni kodu tek HTML olarak teslim edersin. `main`, `archive/**`, `GEMINI.md`, `docs/3d-migration/checkpoints/**` ve en iyi parça kayıtlarını DEĞİŞTİRME. İstersen GitHub'ı yalnız okumak için kullan.
- R2 orijinali ChatGPT tarafından birebir arşivlendi: `archive/gemini-g3d02a-r2-original-20261123` @ `64ac2d6acff550262b1771aee8ddf1d0c2b55cc1`, içerik SHA256 `d0cc1edf93b973f5b1b334f2e074b0d6bd68a5da110239277445722cdf7fc03a`.
- Önceki ilk HTML ve R1 kaynakları da korunuyor. R2'nin kamera, arazi, ışık, renk, sis, sektör düğmeleri, test paneli, zoom/orbit/pan, WebGL hata/boş veri/dispose/reinit özelliklerini KESİNLİKLE silme veya basitleştirme.
- **QA UYARISI:** R2'deki `FOC_THREE`, gerçek Three.js değil; R2'nin `SoldierInstance`, `UnitGroup`, `SectorManager`, `createTestBattleData` ve `projectActiveSector3D` kodları orijinal GitHub FOC koduyla birebir eşdeğer değil. Bu gerileme kayıtlıdır, **bunu 'gerçek FOC motoruna bağladım' diye iddia ETME**. Bu görevde veri sistemlerini bir kez daha sıfırdan yazma veya onları genişletme. Mevcut R2'nin salt-okunur `snapshot.soldiers` listesini çizim için tüket. Canlı kampanya entegrasyonu ileride ayrı görevdir.
- Gerçek proje kodu karşılaştırma referansı: `js/battle3d/ActiveSector3DViewModel.js` ve `js/battle/sector/SectorManager.js` (çalışma dalı `codex/web-3d-protected-battle-20261123`). Gerçek kaynakların tek otorite olduğu hedefi unutma; R2'nin prototip verisini genişletip yeni savaş kuralları icat etme.

## 1. 3D ASKER ÇİZİMİ
1. Mevcut 3D sahneye **aktif sektör snapshot'ındaki her görünür asker için** bir 3D insan/at temsili yerleştir. Üstteki asker sayaçları artık boş zemin yerine, sahnede gerçekten görünen geometrilerle tutarlı olacak.
2. Basit ama insan silueti okunabilir 3D parçalar kullan: baş, gövde, kol, bacak; pozlar ve zemine ayak teması. Süvarilerde basit ama ayırt edilebilir bir at + binici. Şimdilik LOW-POLY yer tutucu, kötü 2D ikon veya tepeden bakıldığında tek nokta **olmasın**.
3. Mevcut snapshot alanlarını kullan: `viewId`, `side`, `groupId`, `unitClass`, `combatRole`, `mountType`, `activeWeapon`, `position`. Dost ve düşman taraflar ayrı tonlardan anlaşılmalı; göz yoran neon yok. Mızraklı, tüfekli ve kılıçlı askerlerde ilk aşamada basit ilgili silah geometrisi oluştur. Ekipman uydurma, snapshot'ta olan sınıf/türe göre temsil et.
4. Askerin dünyadaki konumu **`soldier.position.x/y/z`** olacak; rastgele spawn, yeni formation offset veya yeniden askere dağıtım hesaplama. 3D çizim **salt okunur**; data mutation YASAK.
5. Sektör 0/1/2 örnek sekmelerinden geçince **yalnız aktif sektörün** askerleri görünecek. Önceki sektörde kalan asker mesh'i taşınmayacak. Sabit 3 sekmenin sadece mevcut demo UI'sı olduğunu kabul et; nihai FOC dinamik sektör sayısını değiştirme/yeniden tanımlama.

## 2. POOL / KİMLİK / PERFORMANS
- Görsel kimliği **`sectorId:side:groupId:soldierId`** veya snapshot'ın mevcut `viewId`'si ile güvenceye al. Aynı asker güncellendiğinde **aynı visual objesi** güncellensin; her frame yeniden geometry/buffer/mesh yaratma.
- **Görsel tavanı aktif sektörde 150 oyuncu + 150 düşman (300)**, tüm sektörlerdeki 300'ü bir araya çizme; görünmeyenler `hiddenAlive` olarak veride kalır.
- Tek seferlik geometry/material paylaşımı, pooled mesh veya instancing kullan; WebGL çizim çağrılarını gereksiz katlama. 300 asker için ayrı 300 ışık/gölge haritası, her kare O(n²) mesafe arama YASAK. Eğer bu renderer'da instancing uygulanamazsa sınırı dürüstçe bildir, FPS uydurma.
- Sektör değişiminde önceki görselleri gereksiz WebGL kaynağı sızdırmadan boşalt; sahne `dispose()` ve `re-init` ile hatasız çalışsın.
- Placeholder'lar tarihle uyumlu siluet olsun, fakat kaynakta olmayan hatalı gerçekçi ekipman modeli üretildiğini iddia etme.

## 3. BU PROMPTTA YAPMA
- Askerleri savaştırma, ileri yürütme, hedef seçme, saldırı/hasar/ölüm/fizik/AI yazma.
- Mevcut R2 araziyi, kamera hareketlerini, sektör panelini ya da testleri yeni 'daha basit' sahneyle değiştirme.
- FOC'deki gerçek asker/savaş/veri kaynağını taklit eden yeni bağımsız sınıflar oluşturma.
- Şehir, dünya, ekonomi, diplomasi, deploy, aftermath, UI redesign yapma.
- G3D-03, G3D-04 veya daha ileri aşamalara kendiliğinden geçme.

## 4. TEST / KABULÜ CHATGPT YAPACAK
Kendi geliştirici testlerinde en az şunları dene ve raporla:
1. Merkez sektöründe snapshot `visible.player===150`, `visible.enemy===150` ise ekranda 300 **gerçek 3D asker görseli** bulunmalı (yalnız HUD sayısı yetmez).
2. Diğer iki sektörün asker sayıları farklı olmalı; geçişte kayıp veya birikme olmamalı.
3. Aynı snapshot iki defa sync edildiğinde görsel referanslar/geometry yeniden üretilmemeli.
4. Boş snapshot -> 0 asker ve eski mesh'ler temizlenmiş.
5. `dispose()`, tekrar başlatma, WebGL uyarısı, kamera pan/orbit/zoom, tüm üst-alt butonlar korunmuş.
6. Offline, harici `<script src>`/CSS/asset/ES module/import olmadan `file://` açılması.
7. 300 askerle mümkünse gerçek tarayıcıda FPS/çizim çağrısı ölçümü (ölçülemediyse ÖLÇÜLMEDİ).

Testleri çalıştırman, ChatGPT'nin bağımsız kabulü yerine geçmez. **Başarısızlığı gizleme; çıkıştan önce gerçek kapsamı açıkça bildir.** Şu anki gömülü testler gerçek FOC veri uyumunu kanıtlamaz; bunu özellikle belirt.

## TESLİM — TEK DOSYA
Bana sadece **`FallOfCavalry_G3D02B1_3D_ASKERLER.html`** dosyasını indirilebilir şekilde ver. CSS ve JS aynı HTML içinde, gerçek tarayıcıda doğrudan açılır. Ayrı JS/CSS dosyaları, ZIP veya çoklu indir butonu verme.

Yanında en fazla kısa bir metinle şunları bildir: kaç 3D asker görünür, kamera/zemin/sector/empty/dispose kayıpları var mı, neyi test ettin, ne hâlâ eksik.

**YALNIZ G3D-02B1 İŞİNİ TAMAMLA VE DUR.**
