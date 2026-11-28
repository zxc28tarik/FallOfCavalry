# Fall of Cavalry — 2.4 Bilgi göstergeleri, harita ve görsel yardımcılar
28 Kasım 2026. Aşama 2 kullanım/yerleşim taslağı; kaynak ana eşleme 2fbcaf82376e5e83f160ae0f5fdddcc78b5dba89. Kullanıcı kararları: sol tık grup, sağ tık yalnız Emirler/Dizilişler; sürekli dost/düşman toplam sayaçları, birlik üstü simgeler ve büyük emir konsolu yok. Asker modelleri değişmez. Bu belge KISS elemesi, uygulama veya kesin görsel/tuş onayı değildir.

## Aday yüzeyler
Ana savaş ekranı 3D. İsteğe bağlı inceleme erişimi: seçili grup için küçük özet, ayrıntı isteğinde genişleyen geçici bilgi yüzeyi; sağ tık ana kategorilerine yeni dal eklenmez. Bilgiye erişim için ayrı küçük kontrol/kısayol adayı, nihai tuş yok. Sol veya sağ kenarda açılır bilgi alanı aday; tek grup/karma seçim/düşman/zemin farklı veri türleri. Grup listesi ayrı isteğe bağlı arama, filtre ve odaklama; sürekli kart şeridi yok. Bilgi seçimi ile komut seçimi farklıdır. Düşman raporu tarih ve kaynak taşır.
```
[Geçici grup/zemin bilgisi]    [3D savaş alanı]    [Olay bildirimi]
[Özet -> ayrıntı]              [Seçim / hedef]    [Geçmişe erişim]
[Mini harita adayı]            [Geçici katmanlar]
```
Mini harita aday konum alt sol; aç/kapat/ölçek ve taktik genel görünüm erişimi. Taktik görünüm geçici, kamera dönüşü korunur. Gerçek kamera yönü, geçit, hedef ve bilinen düşman bilgisi; bilinmeyen alanı açığa çıkarmaz. Geçici emir, menzil, görüş ve komuta etki alanı katmanları yalnız istek/uygun bağlamda. Kalıcı olup olmayacağı KISS aşamasında; reddedilen kalıcı asker sayacı/üst simge geri gelmez.
## Olaylar
Kısa bildirim için üst/sağ kenar aday; ses, metin ve gerektiğinde geçici zemin vurgusu. Kritik olay ile sıradan bilgi ayrılır, tekrarlar gruplanır, geçmiş isteğe bağlı açılır, satırdan gerçek konuma/izinli sektöre git. Bozgun, komutan kaybı, takviye, emir hatası yalnız gerçek olayda. Zaman aşımı ve bildirim yoğunluğu ileride test edilecek, kritik bilgi geçmişte kalır.
## Veri ve doğrulama
Her bilgi gerçek simülasyon/rapor kaynağı, güncellik ve yetki ile bağlanır. Moral/mühimmat/yorgunluk/ikmal vb. yoksa sahte bilgi yok. Karma değerler karışık olarak; eski rapor canlı bilgi değil. Test: seçimsiz, ölen grup, farklı türler, bilinmeyen düşman, görüntü engeli, rapor gecikmesi, tekrar olay, renk dışı işaret, harita zoom/geri dönüş, yanlış katman ve kapatma. Testler henüz yürütülmedi.

## Her kayıt için birincil erişim, eylem ve sonuç

### I alanı
| ID | İşlev | Envanter kullanım açıklaması | Önerilen erişim ve davranış |
|---|---|---|---|
| 03.08 | Birlik türüne göre bulma/seçme — Ö | İsteğe bağlı kısayol; karma gruplarda gerçek kabiliyet üzerinden seçer. | Grup arama listesi; tür filtresi ve seç/odaklan. |
| 03.09 | Düşmanı inceleme ve yanlış seçimi engelleme — Ö/E | Yalnız izinli bilgi; yaşayan dost seçimi ve düşman hedeflemesi farklı eylemdir. | Düşman incelemesi; izinli veri, emir seçimi değil. |
| 07.06 | Emir durumu — Ö/E | Hazırlanıyor, iletildi, ilerliyor, çatışıyor, engellendi, ulaştı, tamamlandı/iptal; gerekçeli. | Seçili grup özeti; gerçek emir ve yürütülme durumu. |
| 08.01 | Grup kimliği ve mevcut savaşçılar — K/M/E | İsteğe bağlı tür, yaşayan/aktif/yedek ve kayıp ayrımı; karma grup doğru adlandırılır. Kalıcı sayaç/simge yok. | Grup özeti; kimlik ve gerçek savaşabilir adet, kalıcı üst etiket yok. |
| 08.02 | Sağlık ve kayıp durumu — K/M | Yaralı/ölü ayrımı varsa doğru göster; prototip hp/ölüm ile sınırlı. | Durum ayrıntısı; gerçek kayıp/sağlık, yaralı ayrımı varsa. |
| 08.03 | Moral — K/E | Hasar, müttefik ölümü, sayı baskısı, arkadan/kanattan saldırı, süvari hücumu, komutan, açlık/erzak, geri çekilme/bozgun. Sebep gerçek olaydan alınır. | Durum > Moral; gerçek seviye ve neden, mekanik yoksa görünmez. |
| 08.04 | Sarsılma, kaçma, bozgun — K/E/A | Durum ve nedeni; oyuncunun hangi emirleri verebildiği ve toparlanma koşulu. Eşikler açık. | Durum > Bozgun; gerçek durum, sebep, mevcut yetki. |
| 08.05 | Silah ve aktif ekipman — K/E | Kalıcı loadout ve aktif silah değişimini öğrenir; gerçek silah yoksa komut yok. | Donanım > Aktif silah; gerçek arketip ve yük. |
| 08.06 | Menzil ve görüş hattı — M/E | Hedef menzilde/engel arkasında mı; yalnız gerçek hesap. | Donanım > Menzil/görüş; gerçek değer ve engel. |
| 08.07 | Mühimmat ve doldurma — K/A/E | Kalan kaynak ve dolduruyor/ateşe hazır durumları; tüketim ve doldurma sistemi tamamlanmadan sayı uydurulmaz. | Donanım > Mühimmat/doldurma; yalnız gerçek tüketim ve zaman. |
| 08.08 | Zırh ve karşılaşma uyumu — K/M/E | Uygun olmayan çatışmanın nedenini öğrenir; kesin hasar/koruma değerleri ayrı denge kararı. | Donanım > Koruma/uyum; gerçek zırh ve silah etkisi. |
| 08.09 | Hız, yorgunluk ve hücum hazırlığı — M/Ö/A | Hız/yorgunluk varsa gerçek state; yorgunluk ve ağırlık etkileri açık, HUD için icat edilmez. | Durum > Hız/yorgunluk/hücum; gerçek etkiler. |
| 08.10 | Sıkışma, diziliş bozulması ve yeniden oluşma — M/E | Engel/çatışma sebebi ve varsa çözüm; öldürülen askerlerin yerleri gerçek grup içi düzenle güncellenir. | Durum > Düzen; engel, sıkışma, yeniden oluşma nedeni. |
| 09.01 | Yükseklik — M/E | Gerçek sahne yüksekliği ve savaş hesabı eşleşir; sentetik koordinat bonusu oyuncuya gerçek topoğrafya diye gösterilmez. | Arazi inceleme; gerçek yükseklik ve etkisi. |
| 09.02 | Yol, açık alan, engebe — M/E | Geçilebilirlik ve gerçek hız etkisi; oyuncu uygun rotayı seçer. | Arazi inceleme; yol/engebe ve hareket etkisi. |
| 09.03 | Orman ve görüş — Ö/A | Görüş ve gizlilik kuralı varsa açıklanır; yoksa dekor. | Arazi inceleme; orman/görüş yalnız destekleniyorsa. |
| 11.03 | Seçili grup açıklaması — Ö/E | İhtiyaçta grup türü, mevcut davranış, seçilen diziliş, desteklenen emir ve sebepler. Kalıcı birlik üstü simge yok. | Grup özeti; rol, mevcut davranış, diziliş ve açıklama. |
| 13.03 | Karma seçimde türler arası geçiş | Seçimi kaybetmeden ilgili türün emirlerini kullan. | Karma seçim > Türler; yalnız ilgili türün bilgisi/uygun komutları. |
| 13.05 | Emirsiz birlikleri bul | Görevsiz grupları bul; kasıtlı savunma boşta sayılmaz. | Grup listesi > Emirsiz; savunma emri boşta sayılmaz. |
| 16.05 | Yorgunluk nedeni ve dinlenme | Koşu, donanım, savaş ve dinlenmenin gerçek etkileri. | Durum > Yorgunluk nedeni ve dinlenme koşulu. |
| 16.06 | Etkinlik değişimi nedenleri | Arazi, çevrelenme ve yorgunluğun gerçek etkisini açıkla. | Durum > Anlık etkinlik ve gerçek nedenleri. |
| 16.07 | Ateş edememe nedeni | Menzil, görüş, dost engeli, doldurma ve emir durumunu ayır. | Durum > Ateş edememe; engel, menzil, doldurma veya politika. |
| 16.09 | Birlik karşılaştırması | Rol, silah, koruma ve zayıflık; gizli düşman bilgisi yok. | Karşılaştırma isteği; izinli gerçek özellikler, bilinmeyen ayrımı. |
| 16.11 | Saha engeli ve korunma bilgisi | Duvar, hendek, orman gibi gerçek arazi etkisi. | Arazi inceleme > Koruma; gerçek engel ve etkisi. |
| 17.05 | Komuta taşıyıcısının durumu | Lider, sancak, davulcu varsa gerçek kayıp ve etkisi; model işi başlatılmaz. | Komuta ayrıntısı; lider/sancak/davulcu yalnız mevcutsa. |
| 19.01 | Birlik ayrıntı incelemesi | Seçilen grup hakkında temel bilgi ile ayrıntılı özellikleri ayrı inceleyebilme. | Grup ayrıntı görünümü; özet ve açılabilir ayrıntı. |
| 19.02 | Komutan adı, rütbesi ve portresi | Grubun kimin komutasında olduğunu ve komuta zincirini öğrenme. | Komuta > Ad/rütbe/portre; var olan karakter verisi. |
| 19.03 | Birliğin üst organizasyonu | Grubun hangi sektör ve üst komuta altında bulunduğunu öğrenme. | Komuta > Üst organizasyon ve sektör; gerçek bağlar. |
| 19.04 | Birlik deneyimi ve kıdemi | Kalıcı deneyim sistemi varsa birliğin tecrübesini ve etkisini anlama. | Deneyim > Kıdem; gerçek kalıcı deneyim varsa. |
| 19.05 | Verilen ve alınan kayıplar | Seçili grubun savaş performansını isteğe bağlı inceleme; gizli kesin düşman bilgisi yok. | Performans > Verilen/alınan kayıp; izinli gerçek veri. |
| 19.06 | Moral değişiminin yönü | Moral iyileşiyor mu kötüleşiyor mu, gerçek state geçmişinden öğrenme. | Moral > Değişim eğilimi; gerçek state geçmişi. |
| 19.07 | Doldurma ilerlemesi ve hazır silahlar | Birliğin bir sonraki atışa hazırlığını anlama; gerçek doldurma hesabı şart. | Silah > Doldurma ve hazır silahlar; simülasyon kaynağı. |
| 19.08 | Mevcut arazi koruması | Birliğin bulunduğu mevzide korunma etkisini inceleme. | Arazi > Mevcut korunma; gerçek mevzi hesabı. |
| 19.09 | Saldırı ve savunma özellikleri | Saldırı, zırh, kalkan, zırh karşıtı etki, hücum gibi gerçek özellikleri ayrı açıklama. | Özellikler > Saldırı/savunma; gerçek özellikler ve koşullar. |
| 19.10 | Temel özellik ve anlık etkinlik ayrımı | Kalıcı özellik ile yorgunluk, moral, arazi kaynaklı geçici değişimi ayırma. | Özellikler > Temel ve anlık değer ayrı. |
| 19.11 | Birlik kartı/listesi alternatif erişimi | Savaş alanında bulunması zor grubu isteğe bağlı listeden seçme; kalıcı kart şeridi kabul edilmiş değil. | İsteğe bağlı grup listesi; seç/odaklan, sürekli kart şeridi değil. |
| 19.12 | Birliklerin kategori ve sektör filtreleri | İsteğe bağlı listede birlik türü, komutan ve sektör bazında bulma. | Liste filtreleri; tür, sektör, komutan ve gerçek yetki. |
| 19.13 | Birlik durum metni | Bekliyor, ilerliyor, yakın savaşta, ateş ediyor, kaçıyor gibi gerçek durumları açıklama. | Grup özeti > Durum metni; gerçek simülasyon. |
| 19.14 | Çoklu seçimin ortak ve farklı özellikleri | Birden çok grupta farklı emir, donanım veya durum varsa yanlış ortalama yerine farkı gösterme. | Çoklu seçim özeti; ortak ve farklı durumlar ayrı. |
| 20.07 | Komutan etki alanı | Komuta veya moral etkisi gerçekten mevcutsa alanı isteğe bağlı inceleme. | Komuta ayrıntısı > Etki alanını geçici göster; gerçek hesap varsa. |
| 21.11 | Mevzi hakkında bağlamsal açıklama | Fareyle alanı inceleyince gerçek hareket, koruma ve görüş etkisini öğrenme. | Arazi inceleme > Mevzi kısa açıklaması, ayrıntıya erişim. |
| 22.09 | Bilgi kaynağı ve güven düzeyi | Doğrudan gözlem ile gecikmiş haberci raporunu ayırma. | Bilgi başlığı > kaynak, rapor zamanı, güven; tahmin kesinleşmez. |

### M alanı
| ID | İşlev | Envanter kullanım açıklaması | Önerilen erişim ve davranış |
|---|---|---|---|
| 09.04 | Nehir, köprü, geçit — Ö/A | Kullanılabilir geçişi ve sınırları seçer; harita destekliyorsa. | Harita > Geçiş noktası; gerçek köprü, nehir, geçilebilirlik. |
| 11.01 | Mini harita/alan yönelimi — M/Ö | İsteğe bağlı alan görünümü; konum ve kamera ilişkisi; yanlış ölçek/konum düzeltilir. Kalıcı olup olmayacağı tasarım aşamasında. | Mini harita/alan görünümü giriş adayı; kamera konumu, kalıcılık açık. |
| 13.08 | Taktik genel görünüm | Aktif alanı üstten incele; yalnız izinli bilgi. | Harita > Taktik genel görünüm; geçici tam alan. |
| 13.09 | Kamera noktası kaydet | Sık denetlenen mevzilere dön. | Kamera noktaları > Kaydet/çağır; geçerli konum ve sektör. |
| 16.02 | Görüş hattını konumdan ölç | İşaretlenen mevzinin görülebilir alanı; gerçek görüş hesabı gerekli. | Harita > Görüş sorgusu; seçilen noktadan gerçek hesap, kapatınca kalkar. |
| 16.10 | Son bilinen düşman konumu | Eski raporu gerçek anlık konumdan ayır. | Harita > Son bilinen düşman; tarih ve belirsizlik, canlı konum değil. |
| 18.04 | Mini haritayı aç/kapat ve ölçekle | Gerektiğinde kullan; kalıcı görünüm kararı verilmedi. | Mini harita > Aç/kapat/ölçek; kesin tuş sonra. |
| 21.01 | Kamera görüş alanı ve yönü | Mini harita veya taktik görünümde kameranın nerede ve hangi yöne baktığını anlama. | Harita > Kamera yönü ve görüş alanı. |
| 21.02 | Harita ölçeği ve yakınlaştırma | Farklı büyüklükte sahalarda konumları inceleme. | Harita > Ölçek/zoom; sınırlar, ana kamera ile karışmaz. |
| 21.03 | Taktik haritaya geçiş ve geri dönüş | Üstten görünüm ile normal kamera arasında konumu kaybetmeden geçiş. | Taktik harita > Geri; önceki kamera ve seçim korunur. |
| 21.04 | Haritada arazi türlerini ayırt etme | Yol, orman, geçit, su ve yükseklik gibi gerçek harita verisini gösterme. | Harita katmanı > Arazi türleri; gerçek coğrafya. |
| 21.05 | Hedef noktası durumları | Savaş hedefi varsa elde tutuluyor, kaybedildi veya ele geçiriliyor durumunu görme. | Harita > Hedef durumu; yalnız tanımlı savaş hedefi. |
| 21.08 | Hedef konumuna odaklanma | Görev veya raporun yerini haritada bulma. | Harita hedefi > Odaklan; gerçek konuma kamera. |
| 21.12 | Görüş dışı ve bilinmeyen alan ayrımı | Keşif kuralları destekliyorsa bilinmeyen bilgiyi kesin bilgi gibi sunmama. | Harita > Görüş dışı/bilinmeyen alan; gerçek keşif kuralı. |

### N alanı
| ID | İşlev | Envanter kullanım açıklaması | Önerilen erişim ve davranış |
|---|---|---|---|
| 10.06 | Komutan kaybı — K/A/E | Kayıp haberi, halef veya komuta boşluğu, etkisi; keyfi ceza yok. | Kritik olay bildirimi; komutan kaybı, sektör ve gerçek sebep. |
| 11.02 | Önemli olay bildirimi — Ö/E | Bozgun, komutan kaybı, ulaşılamayan emir, sektör tehlikesi; tekrarlar gruplanır, olay kaynağına gidilebilir. | Olay kısa bildirimi; gerçek olay tetikleyicisi. |
| 13.10 | Son olaya odaklan | Bildirim kaynağına git; pasif sektör rapor zamanı korunur. | Son olay > Odaklan; gerçek yer/rapor konumu. |
| 16.08 | Kanat/arka tehdit uyarısı | Gerçek çevrelenme hesabı varsa. | Tehdit bildirimi; gerçek kanat/arka temas hesabı. |
| 20.14 | Kritik durumun görsel vurgusu | Kaçış ve komuta kaybı gibi olayı geçici vurgula; sürekli sancak UI yok. | Geçici zemin vurgusu; yalnız kritik olay bağlamında, sürekli simge yok. |
| 22.01 | Savaş olayları geçmişi | Kaçırılan önemli olayları daha sonra inceleme. | Olay geçmişi; zaman, kaynak, önem ve ayrıntı. |
| 22.02 | Olayın kaynağına gitme | İlgili birlik, hedef veya sektöre odaklanma. | Olay satırı > Konuma git; izinli kamera/sektör geçişi. |
| 22.03 | Bildirim türü ve önem derecesi | Kritik komuta kaybı ile sıradan hareket tamamlanmasını ayırma. | Olay önem seviyesi; kritik/önemli/bilgi, tekrar birleştirilir. |
| 22.06 | Emir kabulü ve başarısızlık sesi | Sesin gerçek komut kabulüne bağlı olması, metin/görsel alternatif. | Emir kabul/ret sesi; gerçek doğrulama, görsel/metin karşılığı. |

### B — İlgili arka plan kuralları
| ID | İşlev | Envanter kullanım açıklaması | Tasarım bağlantısı |
|---|---|---|---|
| 11.10 | Gerçek veri ve açıklama — E/Ö | Kayıp, süre, durum, emir yalnız simülasyondan; hatalı/sahte durum gösterilmez. Oyuncu dost/düşman toplam sayacı istemiyor; veri arka planda tutulabilir. | Tek veri kaynağı; olmayan değer yok; tüm yüzeyler 2.4. |
| 22.04 | Tekrarlanan olayları birleştirme | Aynı olayın onlarca bildirim üretmesini önleme. | Olay birleştirme; aynı neden/grup/zaman penceresi, 2.4. |

## Kapsam sonucu
67/67 birincil kayıt ayrıntılandırıldı. Her açılır yüzeyde kapanış/iptal önceki kabul edilmiş durumu korur; gerçek durum, yetki ve veri yoksa koşullu aday uygulanmış gibi gösterilmez. Şemalar yerleşim taslağı, piksel düzeyi nihai görsel değil. Oyun kodu değişmedi; açık mekanik kararları, A–J notları ve 247 kayıt korunuyor. Üçüncü aşama KISS birleştirme/eleme ayrı.
