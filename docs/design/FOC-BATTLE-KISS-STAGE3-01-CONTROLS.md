# Fall of Cavalry — KISS 3.1: hazırlık, savaş alanı, emirler ve dizilişler
28 Kasım 2026. Kaynak aşama 2 ana eşleme blob a75237a4d41bbf9891f1b8efba8d84611d3b46f0. Bu belge sadeleştirme önerisidir; kullanıcı onayı, kod uygulaması veya mekanik silme değildir. Ana envanter 247 ID ile değişmeden korunur. Kullanıcının kesin kararları: sol tık grup, sağ tık yalnız Emirler/Dizilişler; sürekli dost/düşman toplam asker sayacı, birlik üstü simge ve büyük alt emir konsolu yok; asker modelleri değiştirilmez. E kategorisi gelecek incelemeye bırakır, daha önceki kesin mekanik kararını iptal etmez.
## Karar anahtarı
K = doğrudan erişim; B = başka kontrolle birleştir; C = bağlamsal/isteğe bağlı; O = otomatik; E = mekanik/işlev gereksinimi netleşene kadar ertele. Tek karar birincil sunum kararıdır; birleştirme simülasyon davranışlarını tek davranışa zorlamaz.
## Aday sade kullanım
- Hazırlık: karşılaşma bilgisi ve tek konuşlanma yüzeyi. Sektör seç, grubu ata ve yerleştir, komutan ve yedek, başlat. Ayrıntılar ve doğrulama aynı bağlamda.
- Savaş alanı: doğrudan seçim, kamera ve geçici zemin işaretleri. Menü seçilen grup için imleç yakınında. Seçim yoksa emir yok. Boş sağ tık otomatik hareket değildir.
- Emirler: ilk görünüm İlerle / Saldır / Konumu koru / Geri çekil / Toplan. Saldırarak ilerle, tempo, takip/ateş gibi bağımsız seçenekler uygun emrin veya ilgili grubun bağlamsal ayarı. Ek özellik için sonsuz alt menü zinciri yok; gerektiğinde bir genişletme bölümü. Uygun silah/rol özel emirleri gerçek mekanik varsa aynı Emirler dalında; ayrı Strateji veya Ateş ana dalı yok. Konumu koru ve Dur birleşimi davranış eşitliği testine bağlı, gerekirse ikisi ayrı tutulur.
- Dizilişler: Hat, Kol, Kama, Seyrek, Avcı, Çember; uygun olmayan şekil gerekçesi; yön/cephe boyutu aynı zemin önizlemesinde. Ortak grup düzeni yalnız çoklu seçimde. Yeni biçimler gerçek farkı kanıtlanırsa.
- Hedefleme: tek akış. Emir seç -> gerekli hedefi seç -> önizle -> onay/iptal. İptal kabul edilmiş emri değiştirmez. Rota ve doğrultu ayrı. Uygunluk/hatayı otomatik anlat; kalıcı hedef çizgisi yok.
- Kısayollar hızlandırıcıdır, zorunlu öğrenme engeli değil; ilk kullanım fareyle tamamlanabilir. Son tuş atamaları ayrı test edilir.
## ID bazında kararlar

### P
| ID | İşlev | Karar | Sade kullanım ve gerekçe |
|---|---|---|---|
| 01.01 | Savaşın nedeni ve tarafları — K/Ö | Koru | Karşılaşma başlığı; savaşın nedeni ve tarafları tek cümle. |
| 01.02 | Savaş hedefi ve bitiş koşulu — Ö/A | Birleştir | Amaç; kazanma/bitiş koşullarını aynı açıklamada ver. |
| 01.03 | Kendi ordusunun mevcudu ve bileşimi — K/M | Bağlamsal | Kendi ordu ayrıntısı; hazırlıkta istenirse bak, savaş sayacı değil. |
| 01.04 | Bilinen düşman gücü — Ö/A | Bağlamsal | Düşman raporu; yalnız bilinen/tahmini veri, kaynak zamanı. |
| 01.06 | Başlangıçtaki silah ve erzak durumu — K/A | Bağlamsal | Ordu ayrıntısı; donanım/erzak yalnız varsa, ayrı panel yok. |
| 01.07 | Çatışmaya girme veya vazgeçme — Ö/A | Koru | Hazırlığa geç ve koşullu geri çekil; kalıcı sonuç açık. |
| 09.07 | Kuşatma ve özel savaş hedefleri — Ö/A | Ertele | Özel savaş türü; kapsamı onaylanmadan yeni arayüz yok. |
| 21.06 | Zafer/beraberlik koşullarını inceleme | Birleştir | Amaç; zafer/beraberlik şartı 01.02 ile tek metin. |
| 21.07 | Hedefin kalan süresi | Bağlamsal | Amaç ayrıntısı; yalnız süreli görevde kalan zaman. |
| 23.12 | Özel savaş türüne özel bilgi yüzeyi | Ertele | Özel tür araçları; gerçek mekanik kararı bekler. |

### D
| ID | İşlev | Karar | Sade kullanım ve gerekçe |
|---|---|---|---|
| 01.05 | Araziyi keşfetme — Ö | Birleştir | Normal kamera ve harita; hazırlık için ikinci kamera sistemi yok. |
| 01.08 | Hazır olma ve geçiş — K/M/E | Koru | Savaşı başlat; son doğrulama otomatik, hata varsa açık neden. |
| 02.01 | Sektör sayısı — K/A | Koru | Sektör düzeni; önerilen sayı ve değiştirme, gerçek sınır kararı gerekli. |
| 02.02 | Sektöre grup atama — K/E | Koru | Grup seç ve sektöre ata; ayrı aktarım sihirbazı yok. |
| 02.03 | Başlangıç mevzisi — K/Ö | Koru | Grup seç ve zemine yerleştir; gerçek başlangıç alanı. |
| 02.04 | Başlangıç yönü ve dizilişi — K/Ö | Birleştir | Aynı diziliş ve hedef önizlemesi; hazırlıkta savaş emri yürütülmez. |
| 02.05 | Yedek atama — K/M/E | Koru | Yedek ata/çıkar; taktik ve render yedeği ayrı. |
| 02.06 | Ordu komutanı — K/E | Birleştir | Komuta ataması; kapsam Ordu/Sektör olarak aynı araç. |
| 02.07 | Sektör komutanı — K/E | Birleştir | Komuta ataması; seçilen sektör bağlamı. |
| 02.08 | Birlik lideri, keşif/rapor ve moral taşıyıcı — K/A | Ertele | Özel rol atamaları; gerçek rol ve yetki kararı bekler. |
| 02.09 | Konuşlanmayı değiştirme/geri alma — Ö | Birleştir | Düzenleme; geri alma ve toplu değişiklik onayı ortak. |
| 17.06 | Birlikleri rol bazında dağıt | Birleştir | Grup filtresi/dağıtım; gerçek tür ve donanım, kimlik korunur. |
| 17.07 | Konuşlanmayı sıfırla | Birleştir | Düzenleme; sıfırla 02.09 altında, onaylı. |
| 17.08 | Hazır grup yerleşimi şablonu | Ertele | Şablonlar; temel hazırlık doğrulandıktan sonra değerlendir. |
| 23.01 | Konuşlanma alanı sınırı | Otomatik | Geçerli konuşlanma alanı zemin üzerinde otomatik görünür. |
| 23.02 | Atanmamış birlik ve rol kontrolü | Otomatik | Başlat öncesi kontrol; hatalı gruba yönlendir. |
| 23.03 | Donanıma göre birlik dağıtım filtresi | Birleştir | Grup filtresi; 17.06 ile aynı liste. |
| 23.04 | Dağıtım oranı ve mevcut kapasite | Bağlamsal | Hazırlık dağılım ayrıntısı; yalnız ordu/atama bilgisinde. |
| 23.05 | Komutan atamasının uygunluk gerekçesi | Otomatik | Komutan uygunluğunu otomatik denetle; sebebi gerektiğinde göster. |
| 23.06 | Hazırlık ekipmanı yerleştirme | Ertele | Savunma ekipmanı; onaylı özel mekanik yoksa ekleme. |

### W
| ID | İşlev | Karar | Sade kullanım ve gerekçe |
|---|---|---|---|
| 03.01 | Kamera hareketi — M | Koru | Kamera hareketi; fare/klavye aynı kontrol. |
| 03.02 | Yakınlaştırma ve döndürme — M | Koru | Kamera yakınlaşma ve dönüş; normal hareketin parçası. |
| 03.03 | Gruba odaklanma — M/Ö | Bağlamsal | Birliğe odaklan; grup seçili iken erişilir. |
| 03.04 | Tek grup seçme — K/E | Koru | Sol tık tüm gerçek grubu seçer. |
| 03.05 | Birden fazla grup seçme — Ö/E | Koru | Shift/tarama ile çoklu seçim; aynı grup kimliği. |
| 03.06 | Seçimi temizleme — Ö/M | Koru | Boş sol tık/Esc; mod önceliği ile iptal. |
| 03.07 | Kontrol grupları — M/E | Bağlamsal | Kontrol grubu kısayolları; isteyen kullanır, görünür çubuk yok. |
| 07.01 | Sağ tık bağlamsal kontrol — kullanıcı kararı/E | Koru | Sağ tık yalnız Emirler ve Dizilişler. |
| 13.01 | Tüm orduyu seç | Bağlamsal | Tümünü seç; aktif yetkili sektör, kısayol adayı. |
| 13.02 | Önceki/sonraki grup | Bağlamsal | Önceki/sonraki grup; isteğe bağlı klavye erişimi. |
| 13.04 | Görünür aynı tür grupları seç | Bağlamsal | Aynı türü seç; isteğe bağlı filtre veya kısayol. |
| 13.06 | Hızlı kamera kaydırma | Birleştir | Kamera hareketi; hızlandırıcı, ayrı düğme değil. |
| 13.07 | Kamera yönünü sıfırla | Bağlamsal | Kamera sıfırla; ayar/isteğe bağlı kısayol. |
| 20.01 | Seçili grubun zemin sınırı | Otomatik | Seçim sınırı yalnız seçildiğinde otomatik. |
| 20.08 | Engel arkasında seçili birliği görme | Bağlamsal | Seçili dostun engel silueti; yalnız kamera engeli, keşfi bozmaz. |

### C
| ID | İşlev | Karar | Sade kullanım ve gerekçe |
|---|---|---|---|
| 04.01 | İlerle — M/E | Koru | İlerle; konum seç, mevcut diziliş korunur. |
| 04.02 | Saldır/Odaklan — K/E | Koru | Saldır; düşman grubu seç, normal saldırı. |
| 04.03 | Konumu koru — K/M/E | Koru | Konumu koru; mevzi ve takip davranışı. |
| 04.04 | Saldırarak ilerle — M/E | Birleştir | İlerle > çatışmaya gir seçeneği; temel hareketle aynı hedefleme. |
| 04.05 | Geri çekil — K/M/E | Koru | Geri çekil; güvenli konum seç, taktik çekilme. |
| 04.06 | Toplan — M/E | Koru | Toplan; mevcut merkez veya geçerli nokta. |
| 04.07 | Taciz et, uzaktan vur — K/E | Bağlamsal | Taciz; uygun menzilli/hafif rolün özel emri. |
| 04.08 | Dur/emri iptal et — Ö | Birleştir | Dur; hareket/hedefi kesen Konumu koru varsayılanıyla birleştir, pasif ateş politikası değişmez; bağımsız ihtiyaç test edilir. |
| 04.09 | Takip veya destek — Ö/A | Ertele | Dost takip/destek; gerçek takip mekanizması onayı bekler. |
| 05.01 | Mesafeden tut — K/E | Birleştir | Taciz/mesafe koruma; aynı menzilli davranış, gerçek fark varsa ayrılır. |
| 05.02 | Yakın savaşa hazırlan — K/E | Bağlamsal | Silah değiştir; yalnız uygun ikinci silah varsa. |
| 05.03 | Serbest ateş — K/M/E | Birleştir | Ateş izni açık; tek bağımsız aç/kapat kontrolü. |
| 05.04 | Ateşi kes — M/E | Birleştir | Ateş izni kapalı; hareketi durdurmaz. |
| 05.05 | Toplu ateş — Ö/A | Ertele | Toplu ateş; gerçek salvo/doldurma mekanizması bekler. |
| 05.06 | At-geri çekil — K/E | Bağlamsal | At ve geri çekil; yalnız uygun hareketli menzilli birliğe. |
| 05.07 | Süvari karşıtı mızrak — K/M/E | Bağlamsal | Mızrak hazırla; yalnız uygun donanım, gerçek duruş. |
| 05.08 | Süvari hücumu — M/E/Ö | Bağlamsal | Süvari hücumu; uygun atlı için, normal Saldır ile farkı korunur. |
| 05.09 | Hücumdan ayrıl, yeniden toplan — Ö | Birleştir | Geri çekil + Toplan; aynı çıkış davranışları, otomatik ardışık ancak onaylıysa. |
| 05.10 | Özel ekipman kullanımı — K/A | Ertele | Özel ekipman; mekanik ve arketip bazında sonra. |
| 07.07 | Emir sırası — Ö/A | Bağlamsal | Emir sırası; isteğe bağlı ileri kullanım, gerçek sıra sistemi şart. |
| 14.01 | Yürü/koş | Bağlamsal | Yürü/koş; hareket temposu tercihi, ayrı emir değil. |
| 14.02 | Düzenli yaklaş / doğrudan hücum | Birleştir | Saldır > yaklaşma biçimi; düzenli yaklaş/hücum ayrımı korunur. |
| 14.03 | Takibi kes | Birleştir | Konumu koru davranışı; takip sınırı. |
| 14.04 | Sınırlı karşılık | Birleştir | Konumu koru davranışı; kısa tepki ve geri dön. |
| 14.05 | Agresif takip | Birleştir | Konumu koru davranışı; agresif takip seçeneği yalnız gerçek ihtiyaçta; normal varsayılan saldırı değil. |
| 14.06 | Kontrollü geri adım | Bağlamsal | Kontrollü geri adım; cepheyi koruyan ayrı davranış, onaylı mekanik. |
| 14.07 | İleri baskı | Ertele | İleri baskı; hat teması fiziği doğrulanmadan ekleme. |
| 14.08 | Menzilli tehdide karşı korun | Bağlamsal | Korun; uygun donanım ve gerçek koruma davranışı. |
| 14.09 | Dengeli davranış | Birleştir | Davranış varsayılanı; özel duruşu sıfırla. |
| 14.10 | Devriye | Ertele | Devriye; iki noktalı görev ihtiyacı ve motoru sonra. |
| 14.11 | Alanı koru | Birleştir | Konumu koru; alan hedefi ve gerçek sınır, ayrı ana emir değil. |
| 14.12 | Bölgeye ateş | Ertele | Bölgeye ateş; gerçek alan atışı ve ekipman kararı bekler. |
| 14.13 | Birliği savaştan çıkar | Bağlamsal | Savaştan çıkar; taktik geri çekilmeden ayrı, sonuç onayı. |
| 14.14 | At in/bin | Ertele | Attan in/bin; gerçek at ve kimlik yönetimi bekler. |
| 16.04 | Emir kuyruğunu incele/tek adımı sil | Birleştir | Emir sırası; aynı sıra görünümünde tek adım sil. |
| 17.02 | Birlik komutanına görev devret | Ertele | Komutana görev devri; yetki ve otomasyon kuralı bekler. |
| 17.03 | Keşif görevi | Ertele | Keşif görevi; gerçek keşif/rapor sistemi bekler. |

### F
| ID | İşlev | Karar | Sade kullanım ve gerekçe |
|---|---|---|---|
| 06.01 | Hat — K/M/E | Koru | Hat; gerçek geometrisi ve kısa açıklaması. |
| 06.02 | Kol — K/M/E | Koru | Kol; gerçek geometrisi ve kısa açıklaması. |
| 06.03 | Kama — K/M/E | Koru | Kama; uygun grupta gerçek geometrisi. |
| 06.04 | Gevşek/Seyrek — K/M/E | Koru | Seyrek; gerçek düzenli aralık. |
| 06.05 | Dağınık/Avcı — K/M/E | Koru | Avcı; seyrekten farklı geometri doğrulanır. |
| 06.06 | Çember — K/M/E | Koru | Çember; uygun grupta çevre savunması. |
| 06.07 | Grubun yüzünü çevirme — Ö/E | Birleştir | Yerleşim önizlemesinde yön; ayrı sürekli düğme yok. |
| 06.08 | Cephe genişliği ve aralık — Ö/A | Birleştir | Yerleşim önizlemesinde cephe/aralık; güvenli varsayılan. |
| 06.10 | Karma grup/çoklu grup düzeni — K/Ö/E | Otomatik | Karma düzen için uygun slot/mesafe hesabı; gerçek grup kimliği korunur. |
| 15.01 | Çoklu grup dizilişini kilitle | Bağlamsal | Çoklu seçimde ortak düzeni kilitle; ayrı durum, grup içi biçim değil. |
| 15.02 | Geçici komuta grubu oluştur/çöz | Birleştir | Kontrol grubu/ortak düzen; geçici üyelik, askerler birleşmez. |
| 15.04 | Saf sayısını ayarla | Birleştir | Cephe genişliği/derinliği ayarı; 06.08 ile tek araç. |
| 15.05 | Kısa ileri/geri adım | Birleştir | İlerle hedefiyle küçük adım; ayrı kısayol şart değil. |
| 15.06 | Küçük açılı dönüş | Birleştir | Yön aracı ile küçük dönüş; ayrı kısayol şart değil. |
| 15.07 | Kare diziliş | Ertele | Kare; çemberle mekanik farkı ve tarihsel uygunluk kanıtlanana kadar. |
| 15.08 | Kalkan duvarı | Bağlamsal | Kalkan duvarı; yalnız uygun ekipman, gerçek mekanik. |
| 15.09 | Avcı alt grubu ayır/geri birleştir | Ertele | Avcı ayır/birleştir; kalıcı kimlik/organizasyon kararı bekler. |

### T
| ID | İşlev | Karar | Sade kullanım ve gerekçe |
|---|---|---|---|
| 07.02 | Zemin hedefi ve rota — Ö/M/E | Birleştir | Tek hedefleme modu; zemin hedefi/rota. |
| 07.03 | Düşman hedefi — Ö/E | Birleştir | Tek hedefleme modu; düşman hedefi ve yetki. |
| 07.04 | Hedef önizleme ve geçerlilik — Ö | Otomatik | Hedef önizlemesi ve geçerlilik otomatik. |
| 07.05 | İptal ve yanlış komutu düzeltme — Ö | Koru | Esc ile hedef iptali; eski emir korunur. |
| 09.05 | Harita sınırı ve güvenli çıkış — Ö/E | Otomatik | Harita sınırı/çıkış doğrulaması; hatada kısa neden. |
| 15.03 | Fareyle cephe çiz | Birleştir | Aynı hedef önizlemesinde sürükleyerek cephe/yön. |
| 15.12 | Savunma hattı çiz | Ertele | Çoklu savunma hattı; ortak grup planlama ve slot motoru doğrulanınca. |
| 16.01 | Mevcut emirleri geçici göster | Bağlamsal | Emirleri göster; isteğe bağlı geçici katman. |
| 16.03 | Etkili ateş alanı | Birleştir | Menzil katmanı; 20.06 ile aynı gerçek hesap. |
| 16.12 | Tahmini varış | Ertele | Varış tahmini; rota/hız hesabı doğrulanmadan sayı yok. |
| 18.06 | Geçersiz komut nedeni/alternatif | Otomatik | Geçersiz hedef nedeni ve alternatif otomatik. |
| 20.02 | Hedefin geçici zemin sınırı | Otomatik | Hedef geçici zemin sınırı. |
| 20.03 | Varışta oluşacak dizilişin hayalet önizlemesi | Otomatik | Varış dizilişi hayalet önizlemesi. |
| 20.04 | Hareket yolu ile doğrudan hedef çizgisi ayrımı | Otomatik | Rota/ doğrultu farkı otomatik doğru biçim. |
| 20.05 | Yön ve cephe oku | Otomatik | Yön oku yalnız yönlü hedeflemede. |
| 20.06 | Ateş yayı ve menzil katmanı | Bağlamsal | Menzil/ateş yayı; istek veya uygun hedefleme anında. |
| 20.12 | Hedefleme sırasında fare işaretçisi değişimi | Otomatik | İmleç biçimi bağlama göre otomatik. |
| 20.13 | Akıllı hedef bilgisi | Birleştir | Geçerlilik açıklaması; menzil/engel/silah uyumu tek açıklama. |
| 22.10 | İzin verilmeyen eylemin koşulları | Birleştir | Geçersiz neden; aynı hedef/komut açıklaması, başka pencere yok. |

## Denetim
118 ID, {"K":25,"B":36,"C":26,"O":13,"E":18}. KISS sonrası da bütün kayıtlar izlenebilir; gerçek mekanik ve giriş testleri çalıştırılmadı. Kesin kullanıcı retleri yeniden eklenmez. 3.2 bilgi, harita, sektör, kontrol, sonuç ve arka plan.
