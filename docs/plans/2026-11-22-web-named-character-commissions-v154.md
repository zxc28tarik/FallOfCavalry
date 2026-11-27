# WEB V1.54 — Önemli karakterlerin gerçek dünya görevleri

Tarih: 2026-11-22
Çalışma dalı: codex/web-world-npc-roster-20261118 / taslak PR #68.

## Oynanabilir içerik

V1.53'te oyuncunun altın vererek desteklediği gerçek named karakter, ertesi gün (ve yalnız ertesi gün) kent hanında kendi adına ek bir **kişisel görev** sunar. Teklifin kimliği kişi ID'sine ve gününe bağlıdır; dünya haritasında olmayan yer veya hayali NPC kullanılmaz.

- **Tüccar, idareci, bilgin:** Gerçek başka bir şehre yazışma teslim edilir, ardından başlangıç şehrine dönülür. Sıralı iki şehir girişi zorunludur.
- **Zanaatkâr, komutan, yolcu:** Gerçek hedef şehir pazarına 6 buğday satılır. Gerçek ticaret olayı dışında ilerleme yoktur.
- Görev kazanımı mevcut oyuncu `contracts` sistemindedir. Tamamlanmış görevin ödülü ve özgün kişinin +4 memnuniyet etkisi yalnız ödül talebinde uygulanır; diğer kişiler, oyuncunun görev günlüğü veya birlikleri otomatik değişmez.
- Oyun gününde desteklenmeyen, başka şehirde bulunan, hayatta olmayan, sıradan generated veya bir önceki gün desteklenmemiş kişilerin görevleri oluşturulmaz.
- Kabul ve tamamlanma mevcut QuickSave / AutoSave ile korunur. Görev ön izlemesi görev tamamlanmış gibi sonuç işletmez.
- Eski mevcut 6+1 şehir teklifi ve önceki meclis görevleri korunur; uygun olduğunda kişisel görev ayrıca çıkar.

## Teknik sınırlar
Kişisel görevler gerçek karakter ID, meslek ve şehir ilişkisini taşır. NPC'nin kimliği, görev veren adı, askerî rütbesi veya organizasyon görevi çıkarımla değiştirilmez. Yeni bir quest kaydı veya ikinci karakter otoritesi oluşturulmaz.

## Kabul testleri
- Önceki gün desteklenmiş gerçek named kişi dışında görev üretilmemesi
- Her meslek grubunda doğru içerik ve geçerli hedef şehir
- Ziyaret sırası; yanlış şehir ve yanlış malın ilerleme sağlamaması
- Kayıttan yüklenen görevin önceki ilerlemeyle devamı
- Ödülün yalnız bir kez verilmesi, kişinin gerçek memnuniyet geçmişinin değişmesi
- Web validation, build ve Chromium sonuçları son committe PASS olana kadar tamamlandı yazılmaz.

## Gelecek paket
Önemli karakterler arası anlaşmazlıklar, şehir içi çıkar grupları ve siyasi sonuçlar; kararların oyuncuya birden fazla çözüm yolu sunması.
