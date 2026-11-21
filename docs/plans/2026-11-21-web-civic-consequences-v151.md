# WEB V1.51 — Şehir Meclisi Kararları ve Ertesi Gün Sonuçları

Tarih: 2026-11-21. Taslak PR #68, web dalı. Unity ve main kapsam dışında.

## İçerik
V1.50 şehir kararlarının ertesi gün somut görev sonuçları vardır. Bir şehrin `civicDecision.day` değeri bir önceki gün değilse bu görev **üretilmez**; her şehir için o gün yalnızca tek politikaya özgü teklif oluşur.

- **Mahalle Nöbeti** → Devriye Güzergâhı Raporu. Oyuncu kaynak şehir dışındaki gerçek bir şehri ziyaret eder, sonra ilk şehre dönüp rapor verir; sonuç +3 güvenlik.
- **İmarete Erzak** → İmaret Dağıtım Nöbeti. Oyuncu kaynağı olan gerçek şehirde 6 birim buğday satar; sonuç +4 güvenlik.
- **Olağanüstü Vergi** → Vergi İtiraznamesi. Oyuncu gerçek komşu şehirden dilekçe toplar ve geri döner; sonuç +5 güvenlik.

Görevler kabul edilmeden şehir ziyareti ve teslimat işlemi ödül sağlamaz. Aşama sırası, gerçek şehir kimlikleri ve kısmi teslimat, oyuncunun mevcut `contracts` kayıt dizisinde kalır. Önceki altı kontrat teklifi korunur, yalnız gerçekten uygun tarihte yedinci teklif eklenir. Tekrar ödül almak mümkün değildir.

Meclis görevlerinin sonuç güvenliği yalnız doğru kaynak şehir üzerine uygulanır ve `civicDirty` işaretlenerek mevcut seyrek şehir kayıt defteri üzerinden kalıcı olur. Oyuncunun tek-seferlik sayısal kararlarıyla aynı değildir: gerçek gezi veya pazar olayı gerekir.

## Test kapıları
- Farklı politika türleri ve ertesi gün koşulu
- Yanlış şehirde ilerlememe ve aşama sırasının korunması
- Doğru ürün/şehir satış şartı
- JSON kayıt sonrası göreve kaldığı yerden devam
- Tek defalık görev ödülü
- Web validation ve Chromium PASS

Testler sonuçlanmadan V1.51 tamamlandı olarak işaretlenmez.
