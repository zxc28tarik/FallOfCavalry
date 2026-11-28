# Fall of Cavalry — 2.2 Genel savaş görünümü, seçim ve kamera
28 Kasım 2026. Aşama 2 yerleşim taslağı. Kaynak: FOC-BATTLE-INTERACTION-LAYOUT-STAGE2.md (61356694a523b0583e4118e3c3213d60206be1d9) W alanındaki 15 kayıt. 2.1 P+D 30 kayıt önceden eşlendi; bu belgeyle 45/247 birincil kayıt ayrıntılandırıldı. I/M/N/B/H alanlarından çapraz bağlantılar henüz o alanların tamamlandığı anlamına gelmez. KISS elemesi ve kod uygulaması yok.

## Sabit kullanıcı kararları
Sol tık asker grubu; sağ tık Emirler ve Dizilişler. Birliklerin üzerinde sürekli simge, isim etiketi veya durum çubuğu; kalıcı dost/düşman toplam asker sayaçları; büyük sürekli alt emir konsolu yok. Asker modelleri değiştirilmez. Seçim zeminde belirginleşir. Hedef/yön geçici. Koyu, ince kenarlı, krem yazılı bağlamsal menü görsel yön olarak korunur. Strateji ayrı üst komuta bağlamında. Yeni kontrol önerileri kesin tuş ataması değildir.

## Savaş ekranının durumları
- Normal: 3D alan, hiçbir grup seçili değil. Mini harita, ayar, savaş kontrolü, bildirim giriş noktaları 2.4–2.6 tasarımında; bu belgede kalıcı yerleşim onaylanmaz.
- Tek grup: yaşayan ve yönetilebilir grubun gerçek zemin sınırı; ilgili bilgiye erişim adayı. Sürekli üst simge yok.
- Çoklu grup: her seçili grup ayrı zemin sınırı; grupları kapsayan büyük sahte seçili bölge yok. Ortak komut ile tür özel komutların uygunluk ayrımı 2.3; karışık bilgi 2.4.
- Bağlamsal menü: yalnız Emirler ve Dizilişler iki dalı, imleç yakınında; ekran kenarında yön değiştirir. Seçim kaybolmaz.
- Hedefleme: menü kapanır, seçili grup korunur, kısa talimat ve geçici zemin önizlemesi. 2.3 ayrıntılandırır.
- İnceleme: bilgi istendiğinde geçici yüzey; düşman incelemesi dost seçimi veya saldırı hedefi değildir. Gizli düşman bilgisi yok.
- Sektör geçişi: kamera ve görünür seçim temiz şekilde değişir; diğer sektördeki grupların verilmiş emirleri değişmez. Kayıtlı kontrol grubu kimlikleri saklanır, pasif sektör seçimi gizli komut üretmez. 2.5 ayrıntılandırır.

## Aday yerleşim
Merkez ve ana yüzey bütün 3D savaş alanıdır. Seçim işareti gerçek grupların zemindeki sınırına oturur; herhangi bir birliği örten kalıcı etiket yok. Sağ tık menüsü sabit alt panel yerine tıklanan gruba/imlece yakın. Seçim yokken komut menüsü açılmaz. Boş zemin sağ tık ile hareket verme önerisi önceki kullanıcı kararına aykırı; otomatik hareket yok, boş zemin sağ tık davranışı açık tasarım kararı. Bilgi yüzeyi, mini harita, savaş kontrolleri ve olay bildirimleri ilgili sonraki aşamada yerleştirilir. Bunları bu turda silme veya kalıcı ekleme yok.

## Seçim etkileşim sözleşmesi (öneri)
| Eylem | Sonuç |
|---|---|
| Yaşayan, yönetilebilir dost askere sol tık | Önceki seçim yerine o askerin gerçek GroupId'si. |
| Shift + dost gruba tık | Grubu mevcut seçime ekle; seçiliyse çıkar. Tuş aday. |
| Boş zeminden sol sürükle | Ekran kutusuna giren, görünür ve yönetilebilir grupları seç; sürükleme eşiği tıkla karışmaz. Shift ile ekleme aday. |
| Boş zemine normal sol tık | Hedefleme/menü/inceleme yoksa seçimi kaldır. |
| Düşmana sol tık | Yalnız izinli inceleme bağlamı; dost seçimi içine katılmaz, otomatik saldırı yok. |
| Sağ tık | Seçili gruba ilişkin Emirler/Dizilişler. Hedefleme modunda sağ tık iptali aday; başka gruba sağ tıkta sessiz seçim değişikliği yok. |
| Esc | Önce hedefleme, sonra açılır menü/inceleme, sonra seçim. Bir Esc bir katman; mevcut kabul edilmiş emir iptal edilmez. |
| Ctrl+1–9 / 1–9 | Kontrol grubunu kaydet/çağır aday. Aynı aktif sektör ve yetkili canlı gruplar çağrılır; diğer sektördekilere geçiş ayrı eylem. |
| Tümünü seç | Sadece aktif sektörün erişilebilir grupları; gizli yedek/pasif sektör yok. |
| Aynı tür seç / önceki-sonraki grup | Yalnız uygun gruplar; deterministik sıra; karma grupta tür kararı açık. |

Kutu seçimi ve tek tık aynı grup çözümleyicisini kullanır. Seçim asker sayısı veya render slotuna bağlı değildir. Gerçek GroupId otoriter; ölen asker veya yedekle değişen görsel slot seçimi başka gruba aktarmaz. Grup tamamen yok oldu/çekildi/yetki kaybedildi ise seçimden çıkar; kalan grup seçimi korunur. Yeni grup oluşumu/ayrılması ayrı mekanik kararına bağlı. Taktik yedek, oyuncuya görünür olmayan pasif sektör veya rakip, seçime yanlışlıkla katılmaz.

## Kamera sözleşmesi
Kamera hareketi, hızlandırma, yakınlaşma, döndürme, gruba odaklanma ve varsayılan yöne dönme ayrı işlevler. Aday girişler WASD, tekerlek, orta fare sürükleme veya Q/E, Shift hızlandırma; nihai tuşlar 2.6 ve KISS aşamasında. Yakınlaşma, açı, dünya sınırı ve kamera arazi kesişimi güvenli aralıklarda. Kamera hızı oyun zamanı değildir. Sürükleme sırasında kutu seçimi/komut hedefi başlamaz. Menü veya klavye odağı varsa ilgili girişler savaş alanına geçmez. Grup odaklama gerçek yaşayan grup merkezine gider; grup dağılmışsa gerçek geometriden merkez hesaplanır. Kamera geri dönüşü ve konum geçmişi M alanı ile çapraz bağlantı; sektör geçişi ayrı. Engel arkasındaki seçili dostu geçici siluetle göstermek yalnız görsel kamera engeli için; savaş keşfi ve görüş kuralları değişmez.

## Arayüz ve simülasyon ayrımı
Tek otoriter seçim kümesi: GroupId + aktif sektör + yetki/yaşam kontrolü. Render seçimi, seçim önizlemesi, menü ve gerçek komut aynı kümeden okunur. UI metni doğrulamadan başarıya dönmez. Açık menüdeki fare olayları alttaki 3D alana sızmaz. Modlar: normal, kutu seçimi, kamera sürükleme, menü, hedefleme, inceleme. Aynı anda çakışan modlar çalışmaz. Mevcut kabul edilmiş emirler kamera/menü/selection değişiklikleri ile bozulmaz. Kaydedilmiş kontrol grubu ve mevcut seçim farklı veri alanları.

## 15 kayıt: konum ve kullanım
| ID | İşlev | Erişim/yer | Tasarım davranışı |
|---|---|---|---|
| 03.01 | Kamera hareketi — M | 3D alan, kamera | WASD veya uygun fare hareketi aday; dünya sınırı, zemin ve UI odağı korunur. |
| 03.02 | Yakınlaştırma ve döndürme — M | 3D alan, kamera | Fare tekeri yakınlaşma, ayrı döndürme hareketi; menü açıkken kamera kontrolü çakışmaz. |
| 03.03 | Gruba odaklanma — M/Ö | Seçili/kayıtlı grup | Odaklan isteği ile grup merkezine güvenli kamera hareketi; seçim otomatik değiştirilmez. |
| 03.04 | Tek grup seçme — K/E | Asker modeli, zemin | Yaşayan dost askere sol tık; sahip olduğu GroupId'nin tamamı seçilir, bireysel asker değil. |
| 03.05 | Birden fazla grup seçme — Ö/E | 3D alan, seçim kutusu | Shift+tık ile ekleme/çıkarma, sürükle kutusu ile görülebilen yetkili grupları seçme aday; kısmi asker teması tüm grubu kapsar. |
| 03.06 | Seçimi temizleme — Ö/M | Boş zemin / iptal | Hedefleme veya menü yoksa boş zemine tık seçimi kaldırır. Esc önce hedefleme/menüyü kapatır. |
| 03.07 | Kontrol grupları — M/E | Kontrol grubu kısayolu | Ctrl+1–9 kaydet, 1–9 çağır aday; kalıcı GroupId kümesi, ölü/yetkisiz gruplar filtrelenir. |
| 07.01 | Sağ tık bağlamsal kontrol — kullanıcı kararı/E | İmleç yakınında bağlamsal menü | Seçili grup için yalnız Emirler ve Dizilişler; tık zemine sızmaz, komut kendiliğinden verilmez. |
| 13.01 | Tüm orduyu seç | Seçim kısayolu | Aktif sektörün yaşayan, yetkili gruplarını seç; pasif sektörler ve taktik yedekler otomatik dahil değil. |
| 13.02 | Önceki/sonraki grup | Grup gezinme kısayolu | Sabit sıralı yaşayan yetkili gruplar arasında geç; boş liste durumunda eylem yok. |
| 13.04 | Görünür aynı tür grupları seç | Asker/grup üzerinden seçim kısayolu | Aynı gerçek türde, görüş alanındaki yetkili grupları seç; karma grup türü için ayrı kural gerekir. |
| 13.06 | Hızlı kamera kaydırma | Kamera hareketi | Hızlandırıcı giriş ile harita içinde kaydır; gerçek savaş hızı değişmez. |
| 13.07 | Kamera yönünü sıfırla | Kamera kontrolü | Varsayılan savaş bakış yönüne dön; seçim, emir ve sektör değişmez. |
| 20.01 | Seçili grubun zemin sınırı | Seçilen grubun zemin izdüşümü | İnce sınır, kırık/dağılmış grupta gerçek ayak izi veya ayrı parçalar; grup dışındaki asker seçilmiş gibi gösterilmez. |
| 20.08 | Engel arkasında seçili birliği görme | Seçili grup geçici görünürlük yardımı | Kamera engeli arkasındaki görünmesine izinli dost grubun silueti; keşif/görüş kuralları değişmez. |

## İlgili alanlara geçiş (çapraz, çift sayılmaz)
03.08/03.09/13.03/13.05/19.11/19.12/19.14 bilgi ve grup listesi 2.4; 11.01/13.08/13.09 harita/kamera referansı 2.4; 13.10 bildirim kaynağı 2.4; 20.09 bitki görünürlüğü ve 24.03/24.08 giriş odağı ilgili kontrol/arka plan tasarımı; 07.01 menünün içeriği 2.3. Kontrol kısayolları 2.6. Bu kayıtlar W dışında tamamlanmış sayılmaz.

## Doğrulama senaryoları
1. Tek askere tık: bütün doğru grup, başka grup yok; ölü/sahipsiz render slotu yanlış seçim yapmaz.
2. Kutu iki grubun yalnız bir kısmını kesiyor: gerçek iki grup seçilir, tekil asker listesi değil. Shift ekle/çıkar çalışır.
3. Seçim yokken sağ tık; menü açıkken tık; hedefleme iptali: yanlış hareket/saldırı oluşmaz.
4. Grup kısmen kayıp/dağılmış; tamamen yok; sektörden ayrılmış veya yetki değişmiş: seçim ve zemin doğru güncellenir; kabul edilmiş emir sırf seçim değişti diye iptal olmaz.
5. Düşman, pasif sektör, taktik yedek, karma grup: yalnız uygun seçim/inceleme; gizli bilgi yok.
6. Kamera hareketi, hızlı hareket, döndürme, zoom, odak, yön sıfırla; harita sınırı ve menü/drag çakışması; kamera hızı simülasyon hızını değiştirmez.
7. Kontrol grubunu kaydet/çağır; gruptaki bazı üyeler yok; sektör değiştir/geri dön; pasif gruba yanlış emir yok.
8. Seçili birliğin kamera engeli arkasında geçici görünürlüğü; keşif bilgisi artmaz.
9. Normal görünümde reddedilen kalıcı sayaç, birlik üstü simge ve büyük konsol yok. Geçici menü ekran dışına taşmaz.

## Açık kararlar
Fare ile kamera döndürme, Shift seçim ve kısayol adayları; boş alanda sağ tık; karma tür seçiminin kapsamı; seçim sınırının kesin geometrisi, rengi ve kontrastı; engel silueti görünürlük sınırı; mini harita/bilgi/ayar kalıcılığı. Bunlar öneri, nihai onay değil. Kod ve gerçek test yapılmadı. 2.2 W 15/15 yerleşim taslağı tamam; sırada 2.3 emir/diziliş/hedefleme.
