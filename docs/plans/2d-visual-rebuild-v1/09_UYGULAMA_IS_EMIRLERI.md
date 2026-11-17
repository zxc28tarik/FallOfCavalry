# FOC WEB — İLK UYGULAMA İŞ EMİRLERİ VE GÜNLÜK ÇALIŞMA PROTOKOLÜ

Bu iş emirleri planın G00/G01/G02/G03 kapılarını kapatmak için tasarlandı. Her emirde **kod hedefi, ürün ve PASS ölçütü** belirtilmiş; hiçbiri kendi kendine başlanmış sayılmaz. İş numaraları `03_DETAYLI_GOREV_AGACI.md` içindeki ID ile eşleşir.

## Ön hazırlık — G00: web deposunu ve planı koru

### İş emri #01 — Web görsel projesi için tek plan kaynağı
- **Girdi:** Repo `https://github.com/zxc28tarik/FallOfCavalry`, `main` referans `f377c72`; önceki 72 görevlik master plan.
- **Görev:** `docs/development/visual-rebuild/` altında karar defteri, master plan, görev JSON ve README öner; var olan belgelerin üzerine yazma. Ayrı `codex/web-visual-v2-g00-plan` çalışma dalı kullan.
- **Yasak:** `FallOfCavalry-Unity` repo, gameplay model/SaveManager değişikliği, asker atlası PR.
- **Test:** Dosya formatı ve bağımlılıklar validator PASS; diff yalnız docs/data; review.
- **Kapatma:** Kullanıcının GitHub'a yazma onayı + branch/PR adresi + plan revision.

### İş emri #02 — Görsel hasar envanteri ve aktif çizim zinciri
- **Dosyalar:** `RenderManager.js`, `projection.js`, `terrain-chunk-cache.js`, `main-ground-texture.js`, `nature-layer.js`, `path-layer.js`, `city-services.js`, `city-scene-defs.js`, `sprite-loader.js`.
- **Görev:** Gerçek runtime import/call tree; legacy ve kullanılmayan assetlerin listesi; object type → draw module → owner data eşleştirmesi.
- **Test:** En az 3 dünya/şehir/battle screenshot, gerçek commit ve seed metadata.
- **Kapatma:** Her visual family `ACTIVE / LEGACY / PLACEHOLDER / UNSURE` ve kanıtla listeli.

### İş emri #03 — UI/camera ve şehir eşleştirme doğrulaması
- **Dosyalar:** `js/data/city-scene-defs.js`, `js/ui/city-services.js`, `css/styles.css`.
- **Görev:** `x,y,w,h` yüzdelik area box'ın, stage background crop ve responsive skalasında nasıl davrandığını dokümante et.
- **Test:** 3 viewport, 4 doluluk, 8 etkin alan; tıklanan hotspot doğru `areaId` dönmeli.
- **Kapatma:** Dökümlü `contentRect` offset/scaling tablosu; yeni bina `placement` alanı önerisi.

### İş emri #04 — Görsel performans baz çizgisi
- **Dosyalar:** `RenderManager`, `terrain-chunk-cache`, `WorldMapAssetLoader`, mevcut `progress.md` benchmark notları.
- **Görev:** Gerçek dev ortamda aynı seed ve ekranlarda zoom 0.5/1/2 benchmark; FPS, frame p95, cache, heap, PNG decode/network sayısı.
- **Test:** Sonuçlar cihaz/Chrome sürümü, commit ve artRev ile kaydedilir.
- **Kapatma:** Baseline kıyas tablosu oluşur; hedef FPS kullanıcı kararı için somutlaşır.

## G02: Sanat standardı — doğrudan 2D, asker hariç

### İş emri #05 — Ortak sanat kimliği kartı
- **Girdi:** Osmanlı V2 planı, faction art bible ve 1648 dünya görsel hedefi.
- **Görev:** Bir ana 2D sanat kartı; ışık, çatı/taş/ahşap, renkler, kompozisyon, okunabilirlik, ortalama siluet ölçek bandı.
- **Teslim:** PDF gerekmeyen Markdown + küçük örnek PNG'ler (kullanıcı üretir); `STYLE_CARD_REV`.
- **Kapatma:** Kullanıcı onayı; yeni görseller doğru kart olmadan üretilemez.

### İş emri #06 — Üç teknik ekran perspektif kartı
- **World:** 64×32 tile, pivot ve screen-bottom draw order.
- **City:** base+overlay+area hotspot, normalized positions + contentRect.
- **Battle:** asker placeholder, zemin/efekt ve seçim okunabilirliği.
- **Kapatma:** Bir doku bir nesne ve bir bina için gerçek mock screenshot uyuşması.

## G03: Entegrasyon altyapısı

### İş emri #07 — Asset registry / metadata ve 2D validator
- **Görev:** JSON manifest şeması öner, ID'leri doğrula, dosya/yol/alpha/ölçü/köken/checksum/fallback kontrolü ekle.
- **Girdi:** `examples/asset-entry.example.json`, mevcut `assets/city-scenes/<faction>/manifests` şablonları.
- **Kapatma:** Bozuk PNG ve yanlış `buildingId` için FAIL; eksik opsiyonel asset için raporlu fallback.

### İş emri #08 — İlk uçtan uca dummy pilot
- **Görev:** Tek dünya prop PNG, tek ground tile ve tek şehir building overlay'i oluşturulmuş **geçici/test** olarak bağla.
- **Süreç:** Manifest→loader→screen coordinate→canvas/DOM draw→smoke→save reload.
- **Kapatma:** 3 farklı konumda tutarlı, 3 viewportta hizalı, kırık manifestte fallback var; feature flag kapatınca gameplay değişmiyor.

## Gerçek sanat üretimine geçiş: G04 ilk mini teslim

### İş emri #09 — Kullanıcıya zemin üretim brifi
- **Ön koşul:** G00-G03 kapıları PASS.
- **Kullanıcı teslimi:** 2D çim ana/alternatif, toprak, kayalık, su/kıyı için pilot görseller + aydınlatma/palet referansı.
- **Teknik entegrasyon:** Terrain mask atlasına adaptör, repeat/seam, LOD ve cache.
- **Kapatma:** Aynı seed, 3 konum, 4 zoom, 20x20 tekrar testi, performans karşılaştırması.

## Her çalışma oturumu döngüsü

1. Görev kaydını aç: sadece `READY` bağımlı işler arasından seçim yap.
2. `BASE_SHA` not et; ilgili branch aç.
3. Görevi kısa değişiklik tasarımı, dokunulacak dosyalar ve rollback planıyla başlat.
4. Gerekliyse kullanıcıdan **tek asset ailesi** için 2D PNG talep et; diğer kategorilere atlama.
5. Entegrasyon kodunu testlerle yaz; `assetId/areaId/buildingId` kesin kontrol.
6. `npm ci`, `npm run validate` ve ilgili smoke testlerini çalıştır; başarısız olanı raporla.
7. Önce/sonra screenshot ve üç viewport/zoom kıyasını yap; kullanıcı görseli onaylamadan final claim yok.
8. PR ve değişiklik özetini oluştur; plan JSON durum ve kanıt alanlarını güncelle.
9. PR birleşince `main` HEAD'i tekrar al; dependency düğümlerini aç, bir sonraki görev öner.

## Tek PR açıklaması şablonu

```md
## FOC WEB VISUAL-V2 — TASK <ID>
Amaç:
Önceki durum (commit, screenshot):
Görsel asset ID/revision:
Değişen kod/manifest/asset:
Oyun mekaniklerine dokunulmadı kontrolü:
Test komutları ve gerçek PASS/FAIL:
Üç ekran görüntüsü (before/after/other zoom):
FPS/frame p95/heap kıyası ve cihaz:
Telif/köken bilgisi:
Geri dönüş:
Kullanıcı görsel kabul durumu:
Açık riskler:
```

## Sözleşme hataları nasıl yönetilir?

- Geçersiz görsel → `ASSET_REJECTED`, kaynağı kullanıcı/üreticiye geri ver; başka asset ile gizlice değiştirip PASS deme.
- Asset loader çalışmıyor → `INTEGRATION_BLOCKED`, son çalışan renderer + fallback koru.
- Yanlış bina/şehir → `MAPPING_FAIL`, `areaId/buildingId` testini ekle.
- Gameplay regresyonu → PR durdur ve rollback; sadece görsel görev içinde save kuralı değiştirme.
- Stil anlaşmazlığı → kullanıcı görsel onayı bekle; başka AI ile sessizce sanat dili değiştirme.
- Performans regresyonu → önce profil ve LOD/atlas; gerekirse görsel çözünürlük/türünü yeniden üretim brifiyle değiştir.

## Görev ilerleme defterinin doğru kullanımı

`02_GOREV_TAKIP.xlsx` veya JSON'daki her görevde `status, owner, dependency, deliverable, acceptance, evidence, commit, user_approval, notes` var. **Bitmiş sayılması için en az PASS test, oyun içi screenshot ve PR kanıtı gerekir.** `KARAR` rollerinde kullanıcı GO'yu ayrıca kaydeder. G14 bütün önceki kalite kapıları geçilmeden otomatik başlatılmaz.