# GEMINI.md — Fall of Cavalry KALICI GELİŞTİRME KURALI

**HER OTURUMUN / HER PROMPTUN BAŞINDA UYGULA.** Bu dosya proje sahibinin **23 Kasım 2026** tarihli bağlayıcı talimatıdır.

> **GEMINI YALNIZCA KOD ÜRETİR. HER GELİŞTİRMENİN KAYDINI, KORUMA YEDEĞİNİ, EN İYİ PARÇA KIYASLAMASINI, GERİ KAZANIMINI, TEST DOĞRULAMASINI VE BEST SÜRÜMÜNE TERFİSİNİ YALNIZ CHATGPT KOORDİNATÖRÜ YAPAR. GEMINI RAPORLARINA GÜVENİLMEZ.**

ÖNCE OKU:
1. `docs/3d-migration/00_KORUMA_SISTEMI.md`
2. `docs/3d-migration/01_EN_IYI_PARCA_KAYITLARI.md`
3. İlgili `docs/3d-migration/GEMINI_GOREV_*.md` görev paketi.
4. İlgili mevcut oyun modülü + regresyon testleri.

**KORUMA DALINI ASLA DEĞİŞTİRME:** `archive/3d-v175-koruma-20261123` @ `5641184f3cf745bfbc37c86740a261c97edb3662`.

**Mevcut 3D çalışma dalı:** `codex/web-3d-protected-battle-20261123`; 3D savaş işleri ayrı G3D kodlarıyla ve bağımsız commit'lerle ilerler. `main`, eski PR #68 veya Unity projesi açık kullanıcı onayı olmadan değiştirilmez.

## Yetki ayrımı — kullanıcının kesin kararı

Gemini'nin görevi yalnızca kendisine verilen kapsamda kod üretmek, kendi aday dalına değişiklik ve teslim commit'i bırakmaktır. Commit yapmak **güvenli yedek almak anlamına gelmez.** Gemini hiçbir aşamada kendi teslimini 'en iyi' ilan edemez, eksilen özelliği koruduğunu iddia ederek kayıt oluşturamaz.

**YALNIZ CHATGPT:** Her küçük teslimi ayrı kaydeder, SHA ve bağımsız geri dönüş dalı oluşturur, eski ve yeni kodu/görseli/testi karşılaştırır, kayıpları eski en iyi parçalardan geri getirir, tam regresyon testlerini bizzat doğrular, `BEST` kararı verir ve bir sonraki Gemini istemine tam koruma listesini koyar.

**GEMINI DEĞİŞTİREMEZ:** `GEMINI.md`, `docs/3d-migration/00_KORUMA_SISTEMI.md`, `docs/3d-migration/01_EN_IYI_PARCA_KAYITLARI.md`, `docs/3d-migration/checkpoints/**`, `archive/**`, `scripts/check-3d-core-protection.mjs`. Bunlar ChatGPT kayıtlarıdır. Gemini yalnız aday dosya/öneri hazırlar; kabul kaydı yazamaz.

**KABUL KAPISI (YALNIZ CHATGPT):**
- Önceki kabul edilmiş BEST SHA ile yeni adayın **fonksiyon, görsel, simülasyon, UI, performans** farklarını karşılaştır.
- Silinen işlev/asset/animasyon/komut/test tespitinde otomatik olarak kabul etme; eski en iyi parçayı geri getir.
- Sektörlü savaş: **tek aktif 3D görünür sektör, diğerleri hafif simülasyon; 150+150 asker görsel tavanı**.
- `SoldierInstance` kalıcı loadout ve ID, `SectorManager` ve `BattleSimulation` gerçek savaş otoritesi. 3D yalnız sunum ve kontrol adaptörüdür.
- `npm run validate`, `npm test`, `npm run audit:world` ve gerçek Chromium/WebGL/fallback doğrulaması tamamlanmadan **BEST** ilan etme.
- Her artışta `docs/3d-migration/checkpoints/G3D-XX.md` dosyasına önceki BEST SHA, yeni aday commit SHA, test sonuçları, geri getirilen unsurlar, açık eksikler ve karar kaydet.
- Force-push, reset-hard, silme yoluyla basitleştirme, test silme, devasa toplu dosya değişiklikleri ve onaysız merge **yasak**.

**KULLANICI HEDEFİ:** Tüm Fall of Cavalry web görünümünü 3D yapmak (savaş, şehir, büyük dünya haritası, deploy ve aftermath); web prototipi, daha önce belirlenmiş PC/Unity hedefinin yerine otomatik olarak geçmez. Kullanıcının HTML Three.js RTS eki referanstır, gerçek FOC savaş mantığını veya tarihî karakterleri değiştirme.

Gemini'de otomatik dosya okuması çalışmıyorsa bile bu dosyayı sohbetin başına dahil et. Görevi yapmadan önce bir satırda **önceki BEST commit** ve **bu görevde dokunacağın dosyaları** belirt.
