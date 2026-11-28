# Fall of Cavalry — KISS 3.2: bilgi, harita, üst komuta, kontroller ve sonuç
28 Kasım 2026. Kaynak aşama 2 ana eşleme blob a75237a4d41bbf9891f1b8efba8d84611d3b46f0. 3.1'deki 118 kaydı tamamlayan 129 kayıt. Kullanıcı kararları: sol tık gerçek grup, sağ tık yalnız Emirler/Dizilişler; kalıcı dost/düşman toplam sayacı, birlik üstü simge ve sürekli büyük emir konsolu yok. Yeni sadeleştirme önerileri henüz onaylı uygulama değildir. E kategorisi geçmiş kesin mekanik kararlarını iptal etmez; işlevin sunumu/uygulaması ertelenir.
## Aday sade görünüm
Ana savaş sahnesinde sürekli büyük panel, asker sayacı, birlik üstü simge veya zorunlu alt kart şeridi yok. Küçük, açık metinli Harita ve Komuta girişleri ile duraklatma/ayar erişimi aday; bilgi erişimi seçili grup/zemin bağlamında. Mini harita açılır ve geniş taktik görünümüne dönüşür, sürekli görünmesi zorunlu değil. Bilgi, harita ve komuta aynı anda ekranı kaplamaz; açılır yüzeylerin kapanışı önceki seçimi/emri korur. Harita ve genel komuta farklı ihtiyaçları karşılar; tek girişte sekme kullanılması kullanıcı testi sonrası düşünülebilir.
- Bilgi: grup, emir, diziliş ve gerçekten gerekli anlık durum. Ayrıntı isteğinde aynı yüzey genişler. Seçimsiz/düşman/karma grupta gerçek veri ve yetki. Arazi incelemesi aynı bilgi mantığı, ayrı HUD değil. Birlik listesi aranabilir isteğe bağlı yüzey; kalıcı kartlar yok.
- Harita: tek kontrol ile aç/kapat/genişlet. Kamera konumu otomatik, tıklama odaklar; saldırı emri değildir. Katmanlar istek üzerine, gerçek görüş/menzil ve keşif şartı. 
- Komuta: sektör geçişi, son rapor, komutan/görev ve gerçek yedekler. Strateji tek plan akışında seç/önizle/onay; manueller ilgili grupta öncelik. Sektöre gitmek ve emir göndermek ayrı. Gerçek komuta/rapor/gecikme mekanikleri geliştirme kapısı.
- Olay: kısa önemli bildirim ve geçmiş; tekrar birleştirilir. Bilgi, şekil ve ses aynı gerçek olaya bağlı. Uygun konuma gitmek isteğe bağlı; kamera kendiliğinden atlamaz.
- Kontrol: duraklatma ve ayarlar tek erişim; savaş hızı/taktik duraklatma ayrı mekanik doğrulama bekler. Kontrol kısayolları yeniden atanabilir; kesin tuşlar daha sonra. Yardım kısa ve isteğe bağlı.
- Sonuç: tek ekran, gerçek sonuç/sebep, kayıp ve kalan özet, sektör/birlik/karakter/ganimet ayrıntıları koşullu. Kampanyaya dön tek veri işlemi. 
## ID bazında kararlar
Koru, Birleştir, Bağlamsal, Otomatik ve Ertele birincil sunum kararları; ayrı düğme sayısı değil.

### I
| ID | İşlev | Karar | Sade kullanım ve gerekçe |
|---|---|---|---|
| 03.08 | Birlik türüne göre bulma/seçme — Ö | Birleştir | Grup bulma ve liste filtresi; tek isteğe bağlı liste. |
| 03.09 | Düşmanı inceleme ve yanlış seçimi engelleme — Ö/E | Bağlamsal | Düşman inceleme; yalnız izinli bilgi, emir seçimi değil. |
| 07.06 | Emir durumu — Ö/E | Bağlamsal | Seçili grup bilgisi; gerçek emir ve durum, isteğe bağlı. |
| 08.01 | Grup kimliği ve mevcut savaşçılar — K/M/E | Bağlamsal | Seçili grup bilgisi; kimlik ve mevcut asker sayısı, kalıcı sayaç yok. |
| 08.02 | Sağlık ve kayıp durumu — K/M | Bağlamsal | Durum ayrıntısı; gerçek kayıp ve sağlık, isteğe bağlı. |
| 08.03 | Moral — K/E | Bağlamsal | Durum ayrıntısı; moral yalnız mevcut gerçek mekanik ve sebep. |
| 08.04 | Sarsılma, kaçma, bozgun — K/E/A | Bağlamsal | Kritik olay ve durum ayrıntısı; bozgunun gerçek nedeni, otomatik emir yok. |
| 08.05 | Silah ve aktif ekipman — K/E | Bağlamsal | Donanım ayrıntısı; aktif gerçek silah ve yük. |
| 08.06 | Menzil ve görüş hattı — M/E | Birleştir | Silah bilgisi ve geçici menzil/görüş katmanı; tek kaynak. |
| 08.07 | Mühimmat ve doldurma — K/A/E | Bağlamsal | Donanım ayrıntısı; yalnız gerçek mühimmat ve doldurma. |
| 08.08 | Zırh ve karşılaşma uyumu — K/M/E | Bağlamsal | Donanım ayrıntısı; zırh ve karşılaşma uyumu, gerçek değerler. |
| 08.09 | Hız, yorgunluk ve hücum hazırlığı — M/Ö/A | Bağlamsal | Durum ayrıntısı; hız/yorgunluk/hücum koşullu. |
| 08.10 | Sıkışma, diziliş bozulması ve yeniden oluşma — M/E | Bağlamsal | Durum ayrıntısı; düzen bozulması ve gerçek engel. |
| 09.01 | Yükseklik — M/E | Birleştir | Tek arazi incelemesi; gerçek yükseklik etkisi. |
| 09.02 | Yol, açık alan, engebe — M/E | Birleştir | Tek arazi incelemesi; yol ve hareket. |
| 09.03 | Orman ve görüş — Ö/A | Birleştir | Tek arazi incelemesi; orman/görüş, mekanik varsa. |
| 11.03 | Seçili grup açıklaması — Ö/E | Birleştir | Seçili grup bilgisi; rol/emir/diziliş özeti. |
| 13.03 | Karma seçimde türler arası geçiş | Bağlamsal | Karma seçim tür filtresi; yalnız ilgili komut ve bilgi. |
| 13.05 | Emirsiz birlikleri bul | Birleştir | Grup listesi; emirsiz filtresi, savunma boşta değil. |
| 16.05 | Yorgunluk nedeni ve dinlenme | Birleştir | Durum ayrıntısı; yorgunluk sebebi ve dinlenme 08.09 ile. |
| 16.06 | Etkinlik değişimi nedenleri | Birleştir | Durum ayrıntısı; etkinlik değişimi ve gerçek neden. |
| 16.07 | Ateş edememe nedeni | Otomatik | Ateş edememe nedeni; gerçek engel/menzil/politika gerektiğinde otomatik. |
| 16.09 | Birlik karşılaştırması | Ertele | Ayrı karşılaştırma ekranı; temel bilgi yetersiz kalırsa değerlendir. |
| 16.11 | Saha engeli ve korunma bilgisi | Birleştir | Tek arazi incelemesi; gerçek korunma. |
| 17.05 | Komuta taşıyıcısının durumu | Bağlamsal | Komuta ayrıntısı; taşıyıcı ve kayıp yalnız mevcutsa. |
| 19.01 | Birlik ayrıntı incelemesi | Birleştir | Tek seçili grup bilgisi; özet ve açılabilir ayrıntı. |
| 19.02 | Komutan adı, rütbesi ve portresi | Bağlamsal | Komuta ayrıntısı; mevcut karakter adı/rütbe, portre zorunlu değil. |
| 19.03 | Birliğin üst organizasyonu | Birleştir | Komuta ayrıntısı; sektör ve üst organizasyon. |
| 19.04 | Birlik deneyimi ve kıdemi | Bağlamsal | Deneyim ayrıntısı; gerçek kalıcı deneyim varsa. |
| 19.05 | Verilen ve alınan kayıplar | Bağlamsal | Performans ayrıntısı; grup bazında gerçek kayıp. |
| 19.06 | Moral değişiminin yönü | Birleştir | Moral ayrıntısı; değişim eğilimi 08.03 ile. |
| 19.07 | Doldurma ilerlemesi ve hazır silahlar | Birleştir | Mühimmat/doldurma bilgisi; 08.07 ile aynı kaynak. |
| 19.08 | Mevcut arazi koruması | Birleştir | Arazi incelemesi ve grup durumu; gerçek korunma. |
| 19.09 | Saldırı ve savunma özellikleri | Birleştir | Donanım/özellik ayrıntısı; saldırı/savunma. |
| 19.10 | Temel özellik ve anlık etkinlik ayrımı | Birleştir | Özellik ayrıntısı; temel ve anlık değer aynı yerde ayrılır. |
| 19.11 | Birlik kartı/listesi alternatif erişimi | Bağlamsal | Tek isteğe bağlı grup listesi; seç ve odaklan. |
| 19.12 | Birliklerin kategori ve sektör filtreleri | Birleştir | Grup listesi; tür, sektör, komutan filtreleri aynı yerde. |
| 19.13 | Birlik durum metni | Birleştir | Seçili grup bilgisi; emir ve mevcut davranış 07.06 ile. |
| 19.14 | Çoklu seçimin ortak ve farklı özellikleri | Otomatik | Karma seçimde ortak/farklı veri otomatik ayrılır. |
| 20.07 | Komutan etki alanı | Bağlamsal | Komutan etki alanı; gerçek hesap varsa geçici katman. |
| 21.11 | Mevzi hakkında bağlamsal açıklama | Birleştir | Tek arazi incelemesi; fare/istek ile gerçek mevzi açıklaması. |
| 22.09 | Bilgi kaynağı ve güven düzeyi | Otomatik | Rapor kaynağı ve güncellik gereken veride otomatik. |

### M
| ID | İşlev | Karar | Sade kullanım ve gerekçe |
|---|---|---|---|
| 09.04 | Nehir, köprü, geçit — Ö/A | Birleştir | Tek harita/zemin incelemesi; gerçek geçit ve nehir. |
| 11.01 | Mini harita/alan yönelimi — M/Ö | Koru | Harita erişimi; küçük harita isteğe bağlı, kalıcı olması gerekmez. |
| 13.08 | Taktik genel görünüm | Birleştir | Aynı haritanın geniş taktik görünümü, ayrı ekran zinciri yok. |
| 13.09 | Kamera noktası kaydet | Ertele | Kamera konumu kaydetme; sektör ve grup odak yeterliliği test edilir. |
| 16.02 | Görüş hattını konumdan ölç | Bağlamsal | Görüş sorgusu; gerçek hesap varsa geçici katman. |
| 16.10 | Son bilinen düşman konumu | Bağlamsal | Haritada son bilinen konum; tarih/belirsizlik, gerçek keşif şart. |
| 18.04 | Mini haritayı aç/kapat ve ölçekle | Birleştir | Harita aç/kapat ve ölçek aynı kontrol. |
| 21.01 | Kamera görüş alanı ve yönü | Otomatik | Haritada kamera konumu/yönü otomatik. |
| 21.02 | Harita ölçeği ve yakınlaştırma | Birleştir | Harita yakınlaşma/ölçek ortak kontrol. |
| 21.03 | Taktik haritaya geçiş ve geri dönüş | Birleştir | Aynı harita genişlet/kapat; eski kamera korunur. |
| 21.04 | Haritada arazi türlerini ayırt etme | Bağlamsal | Arazi görünümü; gerçek coğrafya katmanı, istek üzerine. |
| 21.05 | Hedef noktası durumları | Bağlamsal | Haritada hedef durumu; yalnız gerçek görev varsa. |
| 21.08 | Hedef konumuna odaklanma | Birleştir | Harita hedefi/konumu tıklayarak odaklan. |
| 21.12 | Görüş dışı ve bilinmeyen alan ayrımı | Otomatik | Keşif sınırları otomatik; bilinmeyen alan gizli bilgiye dönüşmez. |

### S
| ID | İşlev | Karar | Sade kullanım ve gerekçe |
|---|---|---|---|
| 10.01 | Aktif sektör seçme/değiştirme — K/M/E | Koru | Genel komutada sektör seç/geç; erişim tek yerden. |
| 10.03 | Sektör raporu — K/Ö/E | Bağlamsal | Sektör ayrıntısı; son gerçek rapor ve yaşı. |
| 10.04 | Haberci ve emir gecikmesi — K/A/E | Bağlamsal | Sektöre emir gönder; gerçek haberci sistemi varsa iletim durumu. |
| 10.05 | Komutanın yetkisi ve görevleri — K/A/E | Birleştir | Sektör ayrıntısı; komutan ve görev tek bölüm. |
| 10.07 | Yedeklerin otomatik tamamlaması — M/E | Otomatik | Render kapasitesi yedeği arka planda; taktik yedek değil. |
| 10.08 | Taktik yedekleri savaşa sokma — Ö/A | Bağlamsal | Taktik yedek gönder; gerçek izin ve hedef varsa. |
| 10.09 | Sektörler arası kuvvet aktarımı — Ö/A | Ertele | Sektörler arası transfer; hareket/zaman/yetki mekanizması bekler. |
| 10.10 | Genel strateji — Ö/A | Bağlamsal | Genel plan seç; ayrı üst komuta, grup menüsüne eklenmez. |
| 10.11 | Stratejiden çıkma ve manuel müdahale — Ö/A | Birleştir | Aynı plan alanında devral/iptal; grup ve genel plan ayrımı. |
| 15.10 | Eksilen safları tamamla | Birleştir | Taktik yedek/gerçek uygun takviye; saf tamamlama aynı akış. |
| 15.11 | Üst komuta grubu oluştur | Ertele | Üst komuta grubu; gerçek organizasyon/kimlik yetkisi bekler. |
| 17.01 | Yetkiye göre komuta devral | Birleştir | Komuta ataması ve devralma aynı yetki bağlamı. |
| 17.04 | Saha ikmalini koru/yenile | Ertele | Saha ikmali; onaylı lojistik sistemi bekler. |
| 21.09 | Takviye giriş alanı ve geliş durumu | Bağlamsal | Takviye ayrıntısı; gerçek giriş ve geliş bilgisi. |
| 21.10 | Sektör haritası ve rapor güncelliği | Birleştir | Genel komuta görünümü; sektör haritası ve rapor yaşı birlikte. |

### N
| ID | İşlev | Karar | Sade kullanım ve gerekçe |
|---|---|---|---|
| 10.06 | Komutan kaybı — K/A/E | Bağlamsal | Kritik komuta kaybı; kısa olay ve gerçek sebep. |
| 11.02 | Önemli olay bildirimi — Ö/E | Birleştir | Tek olay sistemi; kritik ve önemli olaylar, gereksiz spam yok. |
| 13.10 | Son olaya odaklan | Birleştir | Olayı seç/odaklan; geçmişle aynı erişim. |
| 16.08 | Kanat/arka tehdit uyarısı | Bağlamsal | Gerçek kanat/arka tehdit; önemli ve oyuncu müdahalesine değer ise. |
| 20.14 | Kritik durumun görsel vurgusu | Otomatik | Kritik olayın geçici zemin vurgusu; kalıcı simge yok. |
| 22.01 | Savaş olayları geçmişi | Bağlamsal | Olay geçmişi; ihtiyaçta açılan tek liste. |
| 22.02 | Olayın kaynağına gitme | Birleştir | Olay satırı; ilgili konum/izinli sektör odaklama. |
| 22.03 | Bildirim türü ve önem derecesi | Otomatik | Olay önemini gerçek olay türünden otomatik belirle. |
| 22.06 | Emir kabulü ve başarısızlık sesi | Otomatik | Kabul/ret sesi ve görsel geri bildirim, gerçek kabul/ret. |

### X
| ID | İşlev | Karar | Sade kullanım ve gerekçe |
|---|---|---|---|
| 11.04 | Duraklat/devam — M/E | Koru | Duraklat/devam; tek açık kontrol, tüm sektörler tutarlı. |
| 11.05 | Savaş hızı — Ö/A | Ertele | Hız seçimi; ortak zaman ve mekanik doğrulanana kadar. |
| 11.06 | Ayarlar ve kontrol yardımı — M/Ö | Koru | Ayarlar/yardım erişimi; tek menü. |
| 11.08 | Ses, renk ve metin erişilebilirliği — Ö | Birleştir | Ayarlar içinde erişilebilirlik; ayrı oyun ekranı yok. |
| 11.09 | Savaştan ayrılma/yeniden başlatma — M/Ö/A | Bağlamsal | Ayrılma; duraklatma menüsünden gerçek sonuç onayı, test reset ayrı. |
| 18.01 | Taktik duraklatmada emir hazırla | Ertele | Taktik duraklatma emirleri; simülasyon ve kuyruk sözleşmesi bekler. |
| 18.02 | Tuşları yeniden ata | Birleştir | Ayarlar > Kontroller; yeniden atama ve sıfırla. |
| 18.03 | Arayüzü geçici gizle | Bağlamsal | Görünüm kontrolü; HUD gizle/göster, geri dönüş erişilebilir. |
| 18.08 | Kamera giriş ayarları | Birleştir | Ayarlar > Kamera; hassasiyet ve kenar kaydırma. |
| 20.09 | Bitki örtüsünü geçici gizleme | Ertele | Bitki gizleme; kamera/görüş ayrımı doğrulanana kadar. |
| 20.10 | Sinematik görünüm | Birleştir | HUD gizleme/sinematik görünüm; ortak görüntü kontrolü. |
| 20.11 | Geçici katman seçenekleri | Birleştir | Geçici katmanlar; ilgili harita/bilgi kontrolünde, ayrı ayar zinciri yok. |
| 22.05 | Bildirim ayarları | Birleştir | Ayarlar > Bildirimler; ses/önem, kritik geçmiş erişimi. |
| 22.11 | Duraklatılmış durum ve bekleyen emirler | Otomatik | Duraklama durumu gerçek zamanla otomatik; kuyruk yalnız destek varsa. |
| 22.12 | Zaman kontrolü durumunun anlaşılması | Otomatik | Gerçek zaman/hız durumu kontrolün içinde; kalıcı sayaç yok. |
| 24.01 | Arayüz ölçeği ve metin okunabilirliği | Birleştir | Ayarlar > Arayüz; ölçek ve metin. |
| 24.02 | Bağlamsal bilgiyi açma/kapatma | Birleştir | Ayarlar > Arayüz; bilgi ayrıntısı tercihi, reddedilen sayaçlar geri gelmez. |
| 24.07 | Kısayol çakışması ve değişiklik bildirimi | Otomatik | Tuş çakışmasını otomatik bildir; gerçek atama ve açıklama güncellenir. |

### H
| ID | İşlev | Karar | Sade kullanım ve gerekçe |
|---|---|---|---|
| 07.09 | Kısayol ve geri bildirim — M/Ö | Birleştir | Kontrol yardımı ve komut geri bildirimi; tek güncel kaynak. |
| 11.07 | İlk kullanım öğretimi — Ö | Bağlamsal | İlk kullanımda kısa seç/emir/hedef/iptal anlatımı, isteğe bağlı tekrar. |
| 18.05 | Klavye ile menü gezinme | Otomatik | Menü klavye odağı ve gezinme; gerçek erişilebilir giriş. |
| 18.07 | Bağlamsal yardım | Birleştir | Bağlamsal açıklama; aynı seçenek yanında kısa sebep. |
| 22.07 | İşlev açıklaması ve kısayol | Birleştir | Açıklama ve varsa gerçek kısayol aynı yerde. |
| 22.08 | Danışman ve yardım seçenekleri | Birleştir | Yardım tercihi; uzun zorunlu danışman ayrı değil. |
| 24.05 | Fare üzerinde bekleme ve açık açıklama alternatifi | Birleştir | Aynı açıklamaya fare veya klavye ile erişim. |

### R
| ID | İşlev | Karar | Sade kullanım ve gerekçe |
|---|---|---|---|
| 12.01 | Zafer/yenilgi/çekilme ve sebep — K/M/E | Koru | Sonuç başlığı ve gerçek sebep; tüm sektörlerin değerlendirmesi. |
| 12.02 | Sektörlere göre sonuç — K/E | Bağlamsal | Aynı sonuç ekranında sektör ayrıntısı. |
| 12.03 | Kayıp, sağ kalan, yaralı — K/E | Koru | Sonuç özetinde kayıp ve kalan; gerçek kategoriler. |
| 12.04 | Esirler ve kaderi — K/A/E | Bağlamsal | Esirler; mevcut mekanik ve izinli karar varsa. |
| 12.05 | Karakter sonucu ve komuta boşluğu — K/E | Bağlamsal | Karakter sonucu; gerçek kayıp/yaralanma/esaret varsa. |
| 12.06 | Ganimet, altın ve mal — K/E | Bağlamsal | Ganimet; gerçek envanter aktarımı varsa. |
| 12.07 | Nam, deneyim ve savaş skoru — K/E | Bağlamsal | İlerleme ayrıntısı; gerçek deneyim/nam/skor. |
| 12.08 | Savaş sonrası ordu durumu — K/Ö/E | Birleştir | Kayıp ve kalan ordu bilgisi; kalıcı grup kimliği. |
| 12.09 | Kampanyaya dönüş ve kayıt — K/Ö/E | Koru | Kampanyaya dön; kayıt tek seferde uygulanır. |
| 23.07 | Sonuç özeti ve ayrıntı ayrımı | Birleştir | Sonuç özetinden aynı ekranda ayrıntıyı aç/kapat. |
| 23.08 | Birlik bazında savaş raporu | Bağlamsal | Birlik bazında rapor; isteğe bağlı ayrıntı. |
| 23.09 | Savaş hedeflerinin sonuç dökümü | Birleştir | Sonuç nedeni ve hedef ayrıntısı aynı yerde. |
| 23.10 | Savaş başlangıç ve bitiş kaydı | Bağlamsal | Savaş süresi yalnız sonuç ayrıntısı; kalıcı zaman sayacı şart değil. |
| 23.11 | Kampanyaya geçiş öncesi sonuç doğrulama | Otomatik | Kampanya dönüşü veri doğrulama ve tekrar işlem önleme. |

### B
| ID | İşlev | Karar | Sade kullanım ve gerekçe |
|---|---|---|---|
| 06.09 | Dizilişi hareket boyunca koruma — E | Otomatik | Tek diziliş motoru; hareket boyunca koru, ayrı düğme yok. |
| 07.08 | Komut çakışması önceliği — E/Ö | Otomatik | Emir, ateş, diziliş ve plan önceliğini gerçek state ile çöz. |
| 09.06 | Birlikler arası fiziksel engel — M/E | Otomatik | Fiziksel engel/rota ve gerçek neden; oyuncuya ayrı bakım görevi yok. |
| 10.02 | Diğer sektörlerin simülasyonu — K/E | Otomatik | Pasif sektör ortak zaman ve emirlerle gerçek simülasyon. |
| 11.10 | Gerçek veri ve açıklama — E/Ö | Otomatik | UI tek gerçek veri kaynağından; uydurma değer yok. |
| 22.04 | Tekrarlanan olayları birleştirme | Otomatik | Aynı olayları birleştir ve önemle sırala. |
| 24.03 | Seçim ve menü odağı | Otomatik | Menü/inceleme tıklamalarını zeminden ayır. |
| 24.04 | Menünün ekran dışında kalmaması | Otomatik | Açılır menüyü güvenli ekran alanına sığdır. |
| 24.06 | Renk dışı durum işareti | Otomatik | Renk dışında şekil/metin/kontrast da kullan. |
| 24.08 | Geri dönüş ve menü kapatma davranışı | Otomatik | İptal/geri bir katman; kabul edilmiş emir değişmez. |

## Denetim
129 ID, {"K":7,"B":50,"C":40,"O":24,"E":8}. Yeni öneriler, kesin görsel konum, mekanik ve tuş kararları onay/test bekler. Gerçek oynanış testi ve kod değişikliği yapılmadı. A–J ayrı notları ve ana envanter korunur.
