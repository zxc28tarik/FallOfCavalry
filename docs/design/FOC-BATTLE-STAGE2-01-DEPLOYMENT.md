# Fall of Cavalry — 2.1 Savaş öncesi hazırlık ve konuşlanma
28 Kasım 2026. Aşama 2 ilk yerleşim taslağı. Kaynak: FOC-BATTLE-INTERACTION-LAYOUT-STAGE2.md (23bf0fc647c12951d937ae6ee33a6a7519324320), P ve D alanlarının 30 kaydı. Diğer alanlardan başlangıç emirleri, üst komuta ve hedefleme ile çapraz bağlantı yapılır; 247 envanter sayısı değişmez. A–J notları ayrı kalır. Henüz KISS elemesi, görsel nihai onay, kod uygulaması yok.

## Korunan kararlar
- Ayrı deploy/savaş düzeni aşaması; sektör sayısı değişken, toplam tarafların yaklaşık 300 asker/sektör önerisi, 150+150 görünür asker hedefi. Bu kapasite gerçek ordu sınırı değildir. Eski sabit 8–10/9 sektör yaklaşımı bağlayıcı sayı olarak alınmaz. Nihai min/max ve eşitsiz taraf dağılımı açık. Yalnız aktif sektör tam 3D; diğerleri hafif simülasyon.
- Sektör, gerçek UnitGroup, komutan CharacterId ve yedek ilişkileri korunur; sabit asker arketiplerine ve görsellere dokunulmaz.
- Sol tık grup seçimi; sağ tık yalnız Emirler/Dizilişler. Konuşlanma sırasında yerleştirme, doğrudan hareket emri değildir; seçili grup ve ayrı yerleştirme modu ile yapılır. Kalıcı savaş içi toplam sayaç ve birlik üstü simge yok. Hazırlıkta gerçek dağılım adetleri gösterilebilir.
- Moral/yorgunluk/bozulum/kaçış gibi eski ertelenmiş mekanikler kesinleşmiş sayılmaz. Yeni mekaniklerin değerleri, komuta/rapor/gecikme, özel savaş türleri, savunma ekipmanı ve şablonlar koşullu.

## Yüzey 1 — Karşılaşma
Ortada karşılaşma nedeni, yer, taraflar, gerçek hedef; solda kendi kuvvet bileşimi, sağda bilinen düşman bilgisi (kesin/tahmini/bilinmiyor). Altta Hazırlığa geç ve yalnız izinli ise Geri çekil. Geri çekilmenin sonucu önce açıklanır. Harita/arazi bilgisine konuşlanmadan da erişilir. Savaş hedefi, süre sınırı ve özel tür bilgileri yalnız gerçek kurallar varsa. Kampanya bilgisinin kaynağı ve rapor zamanı korunur. Hazırlığa geç savaşın başlaması değildir.

## Yüzey 2 — Savaş düzeni (aday yerleşim)
Üst şerit: sektör sekmeleri, sektör sayısı düzenleme, seçili sektör adı. Sol: ordu grupları (atanmamış, seçili sektör, diğer sektör, taktik yedek filtreleri), tür/donanım filtresi, grup seçimi. Merkez: aktif sektör 3D görünümü; izinli konuşlanma zemini, seçili grup ve geçici hayalet düzen önizlemesi. Sağ: seçili sektör komutanı, uygun aday, başlangıç görevi/strateji ve yedek durumu; isteğe bağlı ayrıntı. Alt: son değişikliği geri al, sıfırla, şablon/otomatik öneri (koşullu); hazır kontrolü ve Savaşı başlat. Savaş başladığında hazırlık panelleri kapanır. Yerler taslak; bunların birleştirilmesi veya kaldırılması sonraki KISS değerlendirmesi.
```
[ Sektör - / + ] [ Sol ] [ Merkez ] [ Sağ ] [ Düzen ]
[ Grup listesi ] [ 3D savaş alanı / seçili sektör ] [ Komuta ]
[ Atanmamış    ] [ Geçerli yerleşim sınırı        ] [ Komutan ]
[ Atanmış      ] [ Grup ve hayalet diziliş       ] [ Görev   ]
[ Yedek        ] [ Kamera / arazi inceleme       ] [ Yedek   ]
[ Geri al / sıfırla ] [ Hazırlık kontrolü ] [ Savaşı başlat ]
```
Örnek sekmeler sabit üç sektör kuralı değildir.

## İşlem akışları
1. Sektör sayısı: öneri > oyuncu artır/azalt > dağılım ve etki önizlemesi > onay. Silinen sektör grupları atanmamışa taşınır veya geçerli yeniden dağılım önizlemesiyle aktarılır; hiçbir grup/komutan silinmez. Sayı değişimi gerçek savaş kuralı doğrulanmadan sayısal bonus vermez.
2. Sektör ataması: grup seç > sektör seç > geçerli ise tek atama. Sektör sekmesine geçiş ile grup transferi farklı eylemdir. Transfer onayı, varış sektörü kapasite ve yetkisini kontrol eder. Takip edilen grup kimliği seçimde kalır.
3. Mevzi: seç > Yerleştir (hazırlığa özgü araç, sağ tık ana kategori değildir) > imleçte hayalet diziliş > zemin tıkla, yön/cephe önizle > onay. Geçersiz sınır, engel, çakışma ve yetersiz alan açık gerekçe; iptal eski konumu korur.
4. Diziliş: grup seç > sağ tık Dizilişler > biçim > konum/yön önizlemesi > geçerli planı kaydet. Savaş başlamadan önce düzen değişimi gerçek savaş yürüyüşü değildir.
5. Komutan: sektör veya genel ordu komutasını seç > uygun karakteri incele > ata > görev/başlangıç taktiği belirle. Yetki ve çift görev sınırları gerçek sistemden; komutan eksikliği yalnız mevcut kurallar engelliyorsa başlatmayı durdurur.
6. Yedek: grup seç > taktik yedeğe ayır veya çıkar. Render sınırından doğan bekleyen asker farklı veri; taktik yedek otomatik ölü doldurma değildir.
7. Başlangıç emri: grup sağ tık Emirler üzerinden geçerli başlangıç emrini kaydet, hedef gerekiyorsa önizle. Hazırlık sırasında savaş veya hareket başlatılmaz. Sektör komutanı görevleri genel komuta bağlamında kalır.
8. Geri alma: yalnız hazırlık değişikliklerini geri al; sıfırla/şablon/otomatik dağıtım toplu işlem önizlemesi ve onayla uygulanır.
9. Başlat: son doğrulama; atanmamış/çift atanmış grup, geçersiz konum, bulunmayan karakter/uygunsuz yetki, hatalı hedef ve kayıp kimlik kontrolü. Sorun varsa ilgili satır/konuma dön. Geçerli DeploymentPlan tek seferde Battle simülasyonuna aktarılır. Kampanya dönüşü ve sonuç kaydı ayrı aşamadır.

## 30 kayıt: birincil konum ve kullanım
| ID | İşlev | Yerleşim | Etkileşim/sonuç |
|---|---|---|---|
| 01.01 | Savaşın nedeni ve tarafları — K/Ö | Karşılaşma / başlık ve kısa açıklama | Taraflar, yer, karşılaşma nedeni; kampanyadan gerçek veri. |
| 01.02 | Savaş hedefi ve bitiş koşulu — Ö/A | Karşılaşma / amaç | Gerçek zafer ve bitiş koşulunu oku; yoksa uydurulmaz. |
| 01.03 | Kendi ordusunun mevcudu ve bileşimi — K/M | Karşılaşma / kendi ordu özeti | Hazır, yaralı ve yedek ayrımını incele; savaş içi kalıcı sayaç yok. |
| 01.04 | Bilinen düşman gücü — Ö/A | Karşılaşma / düşman hakkında bilinenler | Keşif ve rapor bilgisi; kesin/tahmini/bilinmiyor. |
| 01.06 | Başlangıçtaki silah ve erzak durumu — K/A | Karşılaşma / hazırlık durumu | Mevcut donanım ve varsa erzak/mühimmat; sabit arketip değiştirilmez. |
| 01.07 | Çatışmaya girme veya vazgeçme — Ö/A | Karşılaşma / alt eylemler | Hazırlığa geç; çekilme yalnız kampanya izin verirse sonuç açıklanarak. |
| 09.07 | Kuşatma ve özel savaş hedefleri — Ö/A | Karşılaşma / koşullu görev açıklaması | Onaylı özel savaş türüne göre hedefler, şimdilik yeni savaş türü eklenmez. |
| 21.06 | Zafer/beraberlik koşullarını inceleme | Karşılaşma / amaç ayrıntısı | Zafer, beraberlik ve yenilgi kuralı aynı gerçek kaynaktan. |
| 21.07 | Hedefin kalan süresi | Karşılaşma / koşullu zaman bilgisi | Yalnız gerçek zaman sınırlı görev varsa. |
| 23.12 | Özel savaş türüne özel bilgi yüzeyi | Karşılaşma / koşullu özel hazırlık | Yalnız desteklenen özel savaş türünün araçları. |
| 01.05 | Araziyi keşfetme — Ö | Konuşlanma / merkez 3D alan | Kamera ile arazi incele; harita veya gerçek mevzi bilgisi iste. |
| 01.08 | Hazır olma ve geçiş — K/M/E | Konuşlanma / alt sağ başlat | Hazır kontrolü, sorunlu gruba git; geçerli planla tek başlatma. |
| 02.01 | Sektör sayısı — K/A | Konuşlanma / üst sektör düzeni | Önerilen sayıyı değiştir; dağılımı ve geçersiz planı önizle; onaysız silme yok. |
| 02.02 | Sektöre grup atama — K/E | Konuşlanma / sol grup listesi ve sektör seçimi | Grup seç, hedef sektörü seç; bir grup tek sektör, önceki atama atomik değişir. |
| 02.03 | Başlangıç mevzisi — K/Ö | Konuşlanma / 3D zemin | Geçerli başlangıç alanına grup yerleştir, önizle ve onayla. |
| 02.04 | Başlangıç yönü ve dizilişi — K/Ö | Konuşlanma / grup sağ tık ve zemin | Dizilişler dalı, yön/konum önizlemesi; gerçek slot ve sınır denetimi. |
| 02.05 | Yedek atama — K/M/E | Konuşlanma / yedek bölmesi | Taktik yedeği seç/çıkar; render kapasitesi yedeği ayrı sistem. |
| 02.06 | Ordu komutanı — K/E | Konuşlanma / komuta bölmesi | Gerçek CharacterId, uygunluk, yetki ve görev durumu. |
| 02.07 | Sektör komutanı — K/E | Konuşlanma / seçili sektör komutası | Sektöre uygun komutan ata; çift görev kuralı gerçek yetkiye göre. |
| 02.08 | Birlik lideri, keşif/rapor ve moral taşıyıcı — K/A | Konuşlanma / rol ayrıntısı | Gerçekte desteklenen yardımcı/keşif/rapor rolleri; yoksa koşullu aday. |
| 02.09 | Konuşlanmayı değiştirme/geri alma — Ö | Konuşlanma / düzenleme araçları | Son hazırlık işlemini geri al, otomatik öneriyi önizle; savaşı geri sarma yok. |
| 17.06 | Birlikleri rol bazında dağıt | Konuşlanma / grup listesi filtreleri | Gerçek tür/donanımla dağıtım; kalıcı asker kimliği korunur. |
| 17.07 | Konuşlanmayı sıfırla | Konuşlanma / düzenleme araçları | İlk geçerli hazırlık planına dön; toplu değişim öncesi onay. |
| 17.08 | Hazır grup yerleşimi şablonu | Konuşlanma / şablon araçları | Yerleşim şablonu önizle; mevcut grup sayısı ve gerçek alanla yeniden doğrula. |
| 23.01 | Konuşlanma alanı sınırı | Konuşlanma / 3D zemin sınırı | İzinli alan çizgisi, geçersiz konum işareti; savaşa geçince hazırlık sınırı kapanır. |
| 23.02 | Atanmamış birlik ve rol kontrolü | Konuşlanma / kontrol özeti | Atanmamış grup/rol ve gerçek hatalar; seçip ilgili alana dön. |
| 23.03 | Donanıma göre birlik dağıtım filtresi | Konuşlanma / grup listesi filtreleri | Sabit arketip ve gerçek donanım etiketleri; yeni ekipman üretme yok. |
| 23.04 | Dağıtım oranı ve mevcut kapasite | Konuşlanma / sektör dağılımı | Gerçek atanmış ve yedek adetleri; hazırlığa özel bilgi, savaş HUD'u değil. |
| 23.05 | Komutan atamasının uygunluk gerekçesi | Konuşlanma / komutan aday listesi | Uygunluk nedeni ve geçersiz atamanın açıklaması. |
| 23.06 | Hazırlık ekipmanı yerleştirme | Konuşlanma / koşullu zemin aracı | Gerçek desteklenen savunma ekipmanı varsa yerleştir; yoksa kapalı aday. |

## Doğrulama senaryoları
- Tek sektör küçük ordu; birden fazla sektör; eşitsiz taraflar; sektör sayısını düşürme; grup ve komutanı başka sektöre taşıma; yedeğe ayır/geri al; geçersiz zemin ve çakışan diziliş; seçimsiz işlem; Esc ile iptal; yanlış toplu planı geri al; eksik bilgi; komutan yetki hatası; başlat düğmesine çift tık; aktif savaşta hazırlık HUD'unun kapanması. Her durumda grup kimliği ve asker toplamı korunmalı, gerçek olmayan değer gösterilmemeli.
- Uygulama kapıları: sektör limitleri, kapasite/rezerv ilişkisi, komutan yetki/rol kuralları, başlangıç emri sözleşmesi ve gerçek yerleşim sınırı. Bunlar mevcut tasarım adaylarının sahte işlev olarak kullanılmasını engeller.

## Sonuç
30/30 P+D kaydı eşlendi; ilk taslak tamam, kullanıcı görsel/etkileşim tercihi henüz alınmadı. 2.2 genel savaş görünümü ve grup seçimi sırada. A–J araştırma notları ve 247 ana kayıt aynen korunur.
