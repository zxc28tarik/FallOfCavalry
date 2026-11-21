# Fall of Cavalry WEB — V1.44 Gerçek dünya parti doğma coğrafyası

**21 Kasım 2026 · O00-06 açık · yalnız WEB · PR #68 taslak**. Unity, `main`, mevcut savaş/kervan/karakter/save sistemleri değişmez.

## Başlangıç ve kanıt

V1.42/V1.43'te `WorldAI` ilk kurulumun uzak partilerini, `DESPAWN_DISTANCE=40` **karo** (harita dünyasının `tileSize` birimiyle) nedeniyle ilk güncellemede temizlediği görüldü. Önce sırasıyla temel 10 ve ek görünür 9 partinin sürekli tekrar oluşturulması düzeltildi; son [Chromium #44849605577](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44849605577) ve [Web validation #44849605026](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44849605026) PASS. Fakat 32 örnek kare sonunda **0 parti** bulunması, oynanabilir dünya haritasının beklenen devriye/kervan/sivil yaşamını göstermemesine yol açabilir.

Bu aşamada **partiyi sırf oyuncunun yakınına yapay şekilde taşımak**, yol ve ticaret kaynağını kaybettirmek, haydutları rastgele şehre yeniden bağlamak veya `DESPAWN_DISTANCE`'ı sınırsız yapmak yasaktır. Önce gerçek oyuncu başlangıcı ve doğan NPC mesafeleri kanıtlanmalı.

## V1.44 ilk gözlem

- `tools/browser-world-geography-core.mjs`: mevcut haritada oyuncu ile gerçek yerleşimler / gerçek partiler arasındaki dünya piksel/karo mesafesini toplar. Kaynak doğruluğu yokken `UNAVAILABLE`, 0 parti varken gerçek 0 kayıt verir; `routeId`, `homeCityId`, tür/faction alanlarını değiştirmez.
- `tests/unit/world-party-geography.test.js`: gerçek uzaklık ölçeği, despawn sınırı, boş coğrafya ve mevcut route metadata için 4 birim testi.
- `tools/browser-world-geography-profile.mjs`: gerçek **üretim oyunu** başlangıç menüsünden seed1337 ile başlatılır. `WorldPartyManager.ensureWorldParties` geçici wrapper'ı, yeni dünyadaki **ilk 19 partilik orijinal dalgayı daha ilk oyun karesinde silinmeden önce** fotoğraflar. Sonra 32 doğal `requestAnimationFrame` güncellemesinin sonuçları karşılaştırılır. Oyunun AI/kamera/clock/render/quest fonksiyonları durdurulmaz veya yeniden ayarlanmaz.
- İlk dalgada aynı 881 şehirli ve 304 yollu sahnede oyuncunun konumu, faction, dünyadaki en yakın şehir, **40 ve 20 karo yarıçapındaki gerçek şehir sayısı**, NPC türüne göre mesafe ve gerçek kaynak kimliği / rota bağlantısı kaydedilir. Parti mevcut değilse gösterilmez.
- Rapor `output/browser-smoke/world-geography.json` olarak mevcut GitHub browser artifact'ına girer. **Gözlemi amaçlayan bu ilk aşamada üretim oyun kodu değişmez**. Önce V1.43, tüm full-world görev/battle/save-load kabul, V1.40–V1.42 testleri korunarak çalıştırılır.

## Sonraki karar kapısı

1. Gerçek ölçümde **oyuncuya 40 karo içinde şehir varsa**, mevcut NPC quota ve kaynak/ticaret bağlarını koruyacak biçimde *mevcut gerçek yakın şehirler içinden* doğma algoritmasını değerlendirmek. Rotalı bandit yalnız gerçek yolunda olabilir; sahte/yeniden etiketlenen route kaydı kesinlikle yasak.
2. **Yakında hiç şehir yoksa**, doğma algoritmasını rastgele oyuncu konumuna taşımak yerine oyuncu başlangıç bölgesinin gerçekten keşfedilmesi gereken ıssız arazi olup olmadığı ile gerçek şehir/karavan erişilebilirliği denetlenecek. Oyuncu spawn/faction kararını otomatik değiştirmekten kaçınılacak.
3. Düzeltme yapılırsa yeni id/kota, orijinal şehir bağlılığı, karşılaşmalar, rota, eskort cargo, save/load, harita bütünlüğü ve canlı Chromium regressions yeniden geçmeden PASS denmeyecek.

**Durum:** V1.44 coğrafya profili ve test sistemi eklendi; gerçek CI sonucu bekleniyor. PR DRAFT/unmerged, `main` / Unity değişmedi.
