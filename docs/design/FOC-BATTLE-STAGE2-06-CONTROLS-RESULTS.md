# Fall of Cavalry — 2.6 Savaş kontrolleri, yardım, ayarlar ve sonuç
28 Kasım 2026. Aşama 2 kullanım/yerleşim taslağı; kaynak ana eşleme 2fbcaf82376e5e83f160ae0f5fdddcc78b5dba89. Kullanıcı kararları: sol tık grup, sağ tık yalnız Emirler/Dizilişler; sürekli dost/düşman toplam sayaçları, birlik üstü simgeler ve büyük emir konsolu yok. Asker modelleri değişmez. Bu belge KISS elemesi, uygulama veya kesin görsel/tuş onayı değildir.

## Kontrol yerleşimi
Savaş kontrolü giriş adayı üst sağ; duraklatma/ayar görünümü geçici. Duraklatma simülasyonu gerçekten durdurmalı, hız ayarı ancak tüm sektör ve haberci zamanı uyumluysa. Taktik duraklatma koşullu: bekleyen emirleri göster, devamda gerçek uygulama; normal duraklama sırasında emir verilip verilemeyeceği açık. Ayrılma onayı gerçek kampanya sonucu, test reseti ayrı. Ayarlar içinde kamera, tuşlar, görüntü/ölçek, ses, bildirim, görünüm katmanları, erişilebilirlik, yardım. HUD gizleme ve sinematik moddan her zaman çıkış var. Kalıcı zaman/hız simgesi henüz onaylı değil.
## Yardım ve giriş
İlk kullanım kısa seç > sağ tık > emir/diziliş > hedef > iptal akışı. İsteğe bağlı tekrar; yardım ve gerçek kısayol her uygun bağlamdan erişilebilir. Fare bekleme tek erişim yolu olmaz. Aday: WASD, tekerlek, Q/E, Shift seçim/hızlandırma, Ctrl+1–9 ve 1–9, Ctrl+A, Esc. Kesin tuş ataması değil; çakışma tablosu ve yeniden atama/sıfırlama uygulama öncesi. Esc öncelik hedefleme > menü/inceleme > seçim; mevcut emir iptal edilmez. UI odağı zemine sızmaz, ekran dışı menü yok, şekil/metin/renk birlikte.
## Savaş sonu
```
[Gerçek sonuç ve nedeni]
[Sektörler] [Kayıplar] [Karakterler] [Ganimet]
[Özet / ayrıntı / birlik raporu / hedef raporu]
[Esir kararları yalnız izinli]     [Kampanyaya dön]
```
Sonuç yalnız gerçek tüm sektör ve savaş hedefi değerlendirmesinden sonra. Özet ilk, ayrıntı isteğe bağlı; kayıp kategorileri gerçek veriden, asker kimliği/donanımı korunur. Esir/ganimet/nam/deneyim kararları mevcut kurallara bağlı, olmayan değer yok. Sonuç commit işlemi benzersiz savaş kimliği ile bir kez uygulanır; çift tık/tekrar yükleme ödülü çoğaltmaz. Kampanya dönüşünden önce veri doğrulama, hata olursa sonucu kaybetmeden tekrar deneme; gerçek kayıt sistemi şart.
## Test planı
Duraklama/hız/pasif sektör uyumu, menü tık sızıntısı, yeniden atanmış tuş, yardım kapatma, renk ve ölçek, HUD geri açma, ayrılma iptali, tüm sektör sonucu, eksik veri, esir/ganimet işlemi, çift tık ve dönüş hatası. Testler tasarım senaryosu, çalıştırılmadı.

## Her kayıt için birincil erişim, eylem ve sonuç

### X alanı
| ID | İşlev | Envanter kullanım açıklaması | Önerilen erişim ve davranış |
|---|---|---|---|
| 11.04 | Duraklat/devam — M/E | Gerçek simülasyon durumu; pasif sektörlerin ve zamanın da ne yaptığı belirli. Duraklatmada emir verme kuralı açık. | Savaş kontrolü > Duraklat/devam; gerçek tüm simülasyon durumu. |
| 11.05 | Savaş hızı — Ö/A | Ancak tüm sektörlerde zaman tutarlılığı sağlanırsa; hız değiştirme durumu anlaşılır. | Savaş kontrolü > Hız; yalnız onaylı hız sistemi ve sektör tutarlılığı. |
| 11.06 | Ayarlar ve kontrol yardımı — M/Ö | Oyuncu ihtiyaç duyduğunda ayarlar/kısayollar; menü açılması savaş kontrolünü bozmaz. | Ayarlar > Kontrol, görüntü, ses ve yardım erişimi. |
| 11.08 | Ses, renk ve metin erişilebilirliği — Ö | Önemli bilgi yalnız renk veya sesle verilmez; ölçek, kontrast, metin. | Ayarlar > Erişilebilirlik; metin, renk, ses seçenekleri. |
| 11.09 | Savaştan ayrılma/yeniden başlatma — M/Ö/A | Kampanya geri çekilme sonucu ile test yeniden başlatma farklı; yanlışlıkla ilerleme kaybı yok. | Duraklatma menüsü > Ayrıl; gerçek sonuç onayı, test reset ayrı. |
| 18.01 | Taktik duraklatmada emir hazırla | Tek oyuncuda zamanı durdurup emir planla; sektör/haberci zamanını tutarlı tut. | Duraklatma > Emir hazırla; zaman donukken, devam koşulu. |
| 18.02 | Tuşları yeniden ata | Çakışma uyarısı ve varsayılana dönme. | Ayarlar > Tuş atama; çakışma denetimi ve sıfırla. |
| 18.03 | Arayüzü geçici gizle | Savaşı incele; geri açma yolu korunur. | Görünüm > HUD gizle/göster; geri dönüş yolu. |
| 18.08 | Kamera giriş ayarları | Hassasiyet, ters yön ve kenar kaydırma; hedeflemeyle çakışmasın. | Ayarlar > Kamera; hassasiyet, yön, kenar kaydırma. |
| 20.09 | Bitki örtüsünü geçici gizleme | Kamera görüşünü açma; oyun içi keşif ve gizlilik hesabını değiştirmez. | Görünüm > Bitki geçici gizle; keşif değişmez. |
| 20.10 | Sinematik görünüm | HUD'u isteğe bağlı gizle, normal kullanıma dönüş kolay. | Görünüm > Sinematik; normal kontrole dön. |
| 20.11 | Geçici katman seçenekleri | Hareket, seçim, ateş yayı ve benzeri katmanları ayrı aç/kapat; reddedilen simgeleri geri getirmez. | Görünüm > Katmanlar; geçici görünürlük, retler korunur. |
| 22.05 | Bildirim ayarları | Ses, metin, önem ve tekrar tercihleri; kritik bilgiye erişim korunur. | Ayarlar > Bildirimler; tür/ses/önem tercihi, kritik erişim. |
| 22.11 | Duraklatılmış durum ve bekleyen emirler | Zamanın durduğunu ve hangi emirlerin devamda başlayacağını ayırt etme. | Duraklatma görünümü > Bekleyen emirler ve gerçek zaman durumu. |
| 22.12 | Zaman kontrolü durumunun anlaşılması | Duraklama/hız değişikliğinin gerçek simülasyonla tutarlılığı. | Savaş kontrolü > Gerçek hız/zaman durumu; kalıcılık açık. |
| 24.01 | Arayüz ölçeği ve metin okunabilirliği | Farklı ekran çözünürlüğü ve erişilebilirlik ihtiyacına uyum. | Ayarlar > Ölçek/metin; okunabilirlik ve güvenli alan. |
| 24.02 | Bağlamsal bilgiyi açma/kapatma | Gerektiğinde ayrıntı; kalıcı asker sayacı veya birlik simgesi geri gelmez. | Ayarlar > Bağlamsal ayrıntı; isteğe bağlı, kalıcı sayaç yok. |
| 24.07 | Kısayol çakışması ve değişiklik bildirimi | Gerçek tuş ataması ve açıklama tutarlı; eski tuş gösterilmez. | Tuş ayarları > Çakışma, değişiklik ve yeni atama açıklaması. |

### H alanı
| ID | İşlev | Envanter kullanım açıklaması | Önerilen erişim ve davranış |
|---|---|---|---|
| 07.09 | Kısayol ve geri bildirim — M/Ö | Fare, klavye ve izinli harita etkileşimi aynı komut yoluna gider; ses/görsel yalnız gerçek kabulde. | Yardım > Girişlerin gerçek güncel eşlemesi ve kabul/ret açıklaması. |
| 11.07 | İlk kullanım öğretimi — Ö | Kısa görev: grup seç, emir, hedef, diziliş, iptal; isteğe bağlı tekrar. | İlk kullanım > Seç, sağ tık, emir, hedef, iptal; isteğe bağlı tekrar. |
| 18.05 | Klavye ile menü gezinme | Yön, Enter ve Esc; fare zorunlu değil. | Menü odağı > Yön, Enter, Esc; aday klavye erişimi. |
| 18.07 | Bağlamsal yardım | İşlev, etki ve koşulu ihtiyaçta öğren. | Bağlamsal yardım > Amaç/etki/koşul; gerektiğinde aç. |
| 22.07 | İşlev açıklaması ve kısayol | Buton veya seçeneğin işlevini ve atanmış tuşunu ihtiyaçta öğrenme. | Seçenek açıklaması > İşlev ve gerçek atanmış tuş. |
| 22.08 | Danışman ve yardım seçenekleri | İlk kullanımda kısa yardım; isteğe bağlı kapatma. | Yardım > Danışman aç/kapat; zorunlu uzun öğretim yok. |
| 24.05 | Fare üzerinde bekleme ve açık açıklama alternatifi | İşlevi yalnız hover ile erişilebilir kılma; klavye desteği. | Açıklama > Fare bekleme ve klavye/istek alternatifi. |

### R alanı
| ID | İşlev | Envanter kullanım açıklaması | Önerilen erişim ve davranış |
|---|---|---|---|
| 12.01 | Zafer/yenilgi/çekilme ve sebep — K/M/E | Gerçek hedef ve bütün sektörler; mevcut <=10 eşik prototip kuralı nihai tasarım değil. | Sonuç özeti > Gerçek zafer/yenilgi/çekilme ve sebep. |
| 12.02 | Sektörlere göre sonuç — K/E | Özet ve ihtiyaçta ayrıntı; pasif ve aktif sonuçlar birlikte. | Sektör ayrıntısı > Tüm aktif/pasif sonuçlar. |
| 12.03 | Kayıp, sağ kalan, yaralı — K/E | Ölüm/yaralı/esir/kaçan ayrımı; sayıların toplamı tutarlı. | Kayıp özeti > Sağ kalan, ölü, yaralı, esir, kaçan ayrımı varsa. |
| 12.04 | Esirler ve kaderi — K/A/E | Fidye/takas/serbest/hapis seçenekleri ilgili sistem izin verirse; zorla taraf değiştirme yok. | Esirler > İzinli kader seçenekleri; ayrı onay ve gerçek sonuç. |
| 12.05 | Karakter sonucu ve komuta boşluğu — K/E | Yaralanma/esaret/ölüm ve görev boşluğu, aile/hizip/diplomasi sonuçları. | Karakterler > Ölüm, yaralanma, esaret ve komuta boşluğu. |
| 12.06 | Ganimet, altın ve mal — K/E | Elde edilen kaynak ve gerçek envanter aktarımı; tekrar ödül alınamaz. | Ganimet > Gerçek kaynak ve envanter aktarımı. |
| 12.07 | Nam, deneyim ve savaş skoru — K/E | Değişim, neden ve bağlantılı sistem; tecrübeli askerin karaktere dönüşmesi açık karar. | İlerleme > Nam/deneyim/skor ve nedenleri. |
| 12.08 | Savaş sonrası ordu durumu — K/Ö/E | Kalıcı asker kimliği, loadout, yaralı ve yedekler; geri dönünce grup yapısı bozulmaz. | Ordu > Kalan gruplar ve gerçek kalıcı kimlik/donanım. |
| 12.09 | Kampanyaya dönüş ve kayıt — K/Ö/E | Sonucu onayla/geri dön; kayıt tutarlılığı, tekrar işlem yok. | Kampanyaya dön > Tek seferli sonuç işlemi ve kayıt. |
| 23.07 | Sonuç özeti ve ayrıntı ayrımı | İlk sonuçtan sonra isteğe bağlı ayrıntılı rapor. | Özet > Ayrıntı aç/kapat; aynı sonuç verisi. |
| 23.08 | Birlik bazında savaş raporu | Her grubun kaybı, katkısı ve sağ kalanları; gerçek kalıcı kimliklerle. | Birlik raporu > Grup bazlı gerçek katkı ve kayıp. |
| 23.09 | Savaş hedeflerinin sonuç dökümü | Hangi gerçek hedefler elde tutuldu veya kaybedildi. | Hedef raporu > Gerçek tamamlanan/kaybedilen hedefler. |
| 23.10 | Savaş başlangıç ve bitiş kaydı | Sonuçta savaş süresini öğrenme; kalıcı sayaç şart değil. | Sonuç > Gerçek savaş süresi ve başlangıç/bitiş bilgisi. |
| 23.11 | Kampanyaya geçiş öncesi sonuç doğrulama | Ganimet, yaralı, esir ve komuta sonuçları kesinleşmeden iki kez uygulanmaz. | Dönüş öncesi kontrol > Sonuç bütünlüğü ve tekrar işlem koruması. |

### B — İlgili arka plan kuralları
| ID | İşlev | Envanter kullanım açıklaması | Tasarım bağlantısı |
|---|---|---|---|
| 24.03 | Seçim ve menü odağı | Açık menüdeki tık savaş alanına yanlış emir olarak gitmez. | Giriş odağı; UI tıklarının zemine sızmasını engelle, 2.6. |
| 24.04 | Menünün ekran dışında kalmaması | Köşede açılan sağ tık menüsü her çözünürlükte erişilebilir. | Menü yerleşim sınırı; güvenli ekran alanı, 2.6. |
| 24.06 | Renk dışı durum işareti | Seçim, hedef ve geçersiz komutun yalnız renk ile aktarılmaması. | Renk dışı işaret; şekil/metin/kontrast, 2.6. |
| 24.08 | Geri dönüş ve menü kapatma davranışı | Esc/boş alan/menü kapatma kuralları tutarlı; hedefleme iptali ayrılır. | İptal/geri dönüş önceliği; bir katman, mevcut emir korunur, 2.6. |

## Kapsam sonucu
43/43 birincil kayıt ayrıntılandırıldı. Her açılır yüzeyde kapanış/iptal önceki kabul edilmiş durumu korur; gerçek durum, yetki ve veri yoksa koşullu aday uygulanmış gibi gösterilmez. Şemalar yerleşim taslağı, piksel düzeyi nihai görsel değil. Oyun kodu değişmedi; açık mekanik kararları, A–J notları ve 247 kayıt korunuyor. Üçüncü aşama KISS birleştirme/eleme ayrı.
