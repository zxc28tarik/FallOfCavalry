# WEB V1.61 — Şehir Meclisinde Gerçek Mesleki Çıkarlar

Tarih: 2026-11-22. Yalnız taslak PR #68 web dalında; Unity ve main korunur.

## Oynanabilir içerik

Önemli ve hayatta olan gerçek şehir sakinlerinin meclis kararlarına tepkileri artık yalnız sabit meslek tablosu değil; **kentin mevcut iktisadi ve güvenlik koşulları** ile V1.59'daki gerçek uzlaşma mirası üzerinden hesaplanır.

- Şehir güvenliği 40 altındaysa komutanlar nöbet kararına ilaveten +2 memnuniyet, olağanüstü vergiye ilaveten −2 memnuniyet tepkisi verir.
- Gerçek buğday stoku 10 altındaysa zanaatkârlar imaret kararına ilaveten +2; olağanüstü vergiye ilaveten −2 tepki verir.
- Buğday fiyat çarpanı 1.14 üstündeyse tüccarlar imaret kararına ilaveten +1; olağanüstü vergiye ilaveten −2 tepki verir.
- İki önemli kişinin gerçek uzlaşma mirası hâlâ etkinse, imaret kararında tüccar +1, nöbet kararında idareci +1; vergi kararında tüccar ve zanaatkâr ek −1 tepki verir.

Birden fazla koşul aynı anda geçerliyse katkılar toplanır. Aynı ismin aynı meslekten olması oyuncuyla kurulan hayalî örgütü veya hukuki bir klik üyeliğini göstermez. Generated kişiler etkilenmez. Her kararın etkileri mevcut 0–100 memnuniyet metriğine ve var olan `worldCharacters.history` kayıtlarına yazılır; salt okunur önizleme oynanış sonucuyla eşleşir.

Günlük bir karar sınırı, 14 günlük uzlaşma mirası koşulları, ekonomik indirimler ve fiyat primleri korunur. Meclis kararı güvenliği değiştirmeden önceki şehir koşulları bu kararın karakter tepkilerini belirler; bu sayede oyuncunun gördüğü önizleme ve gerçek etki farklılaşmaz.

## Doğrulama

Vitest: birkaç şehir baskısının birikmesi, güvenlik/erzak/fiyat koşulları, etkin uzlaşma, named/generated sınırı, önizlemenin mutasyon yapmaması, gerçek karar sonrası eşit etki, save normalization ve eski meslek kurallarıyla geriye uyumluluk.

Son HEAD üzerinde genel Web validation ve gerçek Chromium smoke PASS görülmeden tamamlandı yazılmaz.
