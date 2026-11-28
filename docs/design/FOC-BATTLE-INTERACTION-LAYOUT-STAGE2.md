# Fall of Cavalry — Aşama 2: kullanım ve yerleşim tasarımı
28 Kasım 2026. Kullanıcı toplama aşamasını şimdilik yeterli kabul etti. Ana envanter 247 kayıt; A–J araştırma başlıkları FOC-BATTLE-FUTURE-MECHANICS-NOTES.md dosyasında ayrı tutulur. Bu taslak 247 kaydın tamamını kullanım alanlarına bağlar. Henüz KISS elemesi, son görsel tasarım, tuş ataması veya oyun kodu yok. Her alan aday bir etkileşim yüzeyidir; 14 ayrı kalıcı HUD paneli anlamına gelmez. Açık mekanik kararları uygulama kapısı olarak korunur.

## İlerleme — 2.1
[2.1 Karşılaşma ve konuşlanma taslağı](FOC-BATTLE-STAGE2-01-DEPLOYMENT.md) kaydedildi: P+D 30/30 kayıt, iki aday ekran, sektör/komutan/yerleştirme/yedek/başlatma akışları, hata ve iptal senaryoları. Yerleşim öneridir, kesin kullanıcı onayı veya uygulama değildir. Sektör ve komuta mekaniklerinin açık kuralları korunur. Sırada 2.2. Ana envanter 247, KISS elemesi yok.

## Değiştirilemeyecek kullanıcı kararları
- Asker modelleri şimdilik tamam; yeni model işi yok.
- Asker grubuna sol tık seçim. Sağ tık seçili grup için yalnız Emirler ve Dizilişler ana menüsü. Ateş emirleri ilgili grupta Emirler altında. Genel strateji, grup menüsünden ayrı.
- Kalıcı dost/düşman toplam asker sayıları ve birlik üstü simgeleri yok. Önceki büyük alt konsol reddedildi. Yeni taslak bunları geri getirmez.
- Görsel yön: koyu ince kenarlıklı iki sütunlu bağlamsal menü, krem metin, sade semboller. Beğenilen örnek nihai ekran onayı değildir.
- Her bilgi gerçek simülasyondan gelir; olmayan mekanik için sahte değer veya sahte başarı yok.
- Sadelik elemesi üçüncü aşamada; bu tur tekrarları silme veya yeni mekanik kararı verme yok.

## Aşama 2 tasarım sözleşmesi
Her kayıt için birincil erişim bağlamı belirlenir. Bir bilgi birden fazla yüzeyde gerekebilir; aşağıdaki eşleme birincil kullanım alanıdır, nihai tek ekran kararı değildir. Ö/A işaretli kayıtlar mekanik onayına bağlıdır. Arka plan kuralları oyuncuya ayrı düğme değildir; görülebilir sonucu gerektiğinde mevcut bilgi yüzeyine bağlanır. Mevcut kayıtların gerekçesi ve kullanım açıklaması ana envanterde aynen durur.

## 14 aday kullanım alanı
| Kod | Alan | İlk erişim önerisi | Ekrandaki konum / süre |
|---|---|---|---|
| P | Karşılaşma | Kampanyadan savaş girişinde | Ayrı geçici hazırlık ekranı; neden, amaç, bilinen durum |
| D | Konuşlanma | Savaş başlamadan | Savaş alanı + geçici hazırlık araçları; yerleşim sınırı zemin üzerinde |
| W | Savaş alanı | Doğrudan asker ve zemin etkileşimi | Ana görüntü; seçim zeminde geçici |
| C | Emirler | Seçili grupta sağ tık > Emirler | İmleç yakınında bağlamsal menü; uygun komutlar |
| F | Dizilişler | Seçili grupta sağ tık > Dizilişler | Aynı menünün ikinci dalı; şekil, yön, uygunluk |
| T | Hedefleme | Hedef isteyen emir seçildikten sonra | Zeminde geçici önizleme, imleç ve tek kısa talimat |
| I | İnceleme | Seçilen grup veya arazi hakkında bilgi isteği | Geçici bilgi yüzeyi; açma şekli ve konumu öneri, nihai değil |
| M | Harita | Harita inceleme isteği | Üstten/taktik görünüm veya küçük harita adayı; kalıcılığı açık |
| S | Sektör ve üst komuta | Ordu/sektör yönetimi gerektiğinde | Ayrı geçici genel komuta görünümü; grup menüsüne girmez |
| N | Olay ve bildirim | Önemli gerçek olay | Geçici kısa bildirim, gerektiğinde geçmiş ve kaynağa git |
| X | Kontrol / ayarlar | Duraklatma veya ayar isteği | Geçici kontrol menüsü; kalıcı hız/zaman göstergesi onaylı değil |
| H | Yardım | İlk kullanım veya istek | Kısa bağlamsal açıklama ve güncel tuşlar |
| R | Savaş sonucu | Gerçek savaş bitişi | Ayrı sonuç ekranı; kampanyaya tutarlı aktarım |
| B | Arka plan kuralı | Simülasyon ve etkileşim denetimi | Ayrı HUD yok; ilgili durum ve hata gerçek olduğunda gösterilir |

## Önerilen kullanım senaryoları
### 2A — Karşılaşma ve konuşlanma
Kampanya karşılaşması > neden/amaç ve bilinen düşman > araziye bak > grupları sektörlere yerleştir > komutan/yedek ataması > konum, yön ve diziliş önizlemesi > geçersiz yerleşim varsa gerekçe > gerçek hazır kontrolü > savaşı başlat. Atanmamış asker kaybolmaz. Sektör sayısı ve yetki sınırı eski kesin kararlarla ayrıca doğrulanır. Konuşlanma bilgisi savaş sırasında kalıcı sayaç değildir.
### 2B — Birlik seçimi ve hareket
Dost askere sol tık > yaşayan grup seçilir, zeminde sınır > sağ tık > Emirler > İlerle > bağlamsal menü kapanır ve hedefleme açılır > geçerli zemin ve varış dizilişi önizlenir > sol tık onayı > motorun kabulü > gerçek hedef/durum > geçici çizgi sonra kaybolur. Esc hedefi iptal eder; önceki emir verilmeden değişmez. Boş alanda sağ tık davranışı kullanıcıyla netleştirilmeden doğrudan hareket atanmaz. Düşman seçimi emir alıcı değildir.
### 2C — Saldırı ve birliğe özel emirler
Seçili grup > Emirler > Saldır > düşman grubunu hedefle > menzil/uygunluk gerekçesi > motor hedefi doğrular. Menzil dışı ama ulaşılabilir hedef ile geçersiz hedef ayrılır. Ateş politikası hareketi kesmez. Mızrak, tüfek ve atlı emirleri gerçek donanıma göre. Hedef ölür, kaybolur veya engellenirse simülasyon kuralına göre durum verilir. Bilinmeyen düşman verisi açılmaz.
### 2D — Diziliş
Grup > sağ tık > Dizilişler > küçük şekil ve açıklama > seçim > hedef/yön/yerleşim gerekiyorsa önizleme > onay. Hat, kol, kama, seyrek, avcı, çember ve yeni adaylar kayıtta kalır. Mevcut düzen ile planlanan düzen ayrı; motor tek slot kaynağı kullanır. Yeterli alan yoksa gerekçe ve geçerli seçenek; askerler ışınlanmaz. Kilitli çoklu grup düzeni, grup içi dizilişten ayrıdır.
### 2E — Bilgi ve olay
Oyuncu grup/mevzi bilgisi istediğinde gerçek durum, sebep ve varsa sonuç açılır. Kritik olayda kısa bildirim, isteğe bağlı geçmiş ve konuma git. Moral, yorgunluk, mühimmat, görüş, ikmal gibi değerler gerçek mekanik tamamlanmadan gösterilmez. Birlik üstüne sürekli simge/etiket konmaz.
### 2F — Genel komuta
Sektör/genel komuta görünümü > aktif ve pasif bölgeler, son rapor zamanı ve bilinen durum > sektör seçimi, komutan görevleri, yedek/strateji adayları > onaylı komuta yetkisine göre emir gönder > gecikme/ulaşma durumu > manuel müdahale. Diğer sektörler gerçeğe uygun simüle edilir; rapor canlı istihbaratmış gibi gösterilmez. Hazır strateji birden fazla gruba emir üretir, grup menüsüne üçüncü ana kategori eklemez.
### 2G — Kontrol, yardım ve sonuç
Duraklatma/ayar isteği > gerçek simülasyon durumunu değiştirir. Taktik duraklatma ve hız değişimi açık mekanik karardır. Savaş biterse gerçek hedef ve tüm sektörler değerlendirilir > sonuç nedeni, kayıp, esir, komutan, ganimet ve kampanya etkisi > onaylı dönüş. Sonuç yalnız bir kez uygulanır.

## Yerleşim varsayımları ve çakışma kuralları
- Menü açıkken tıklamalar savaş alanına sızmaz; hedefleme, seçim, kamera sürükleme ve arayüz odağı ayrı durumlar.
- Menü ekran kenarına göre yön değiştirebilir; emir ve diziliş dalları aynı anda zorunlu açılmaz.
- Kamera, sektör, grup seçimi ve emir iptali farklı eylemler; Esc'nin öncelik sırası hedefleme > açık menü > seçim olarak önerilir, gerçek tuş ataması sonra.
- Kalıcı mini harita, alt bilgi şeridi, duraklat düğmesi, zaman ve bildirim konumu henüz kararlaştırılmadı. İlk örneklerde gösterilebilir, kabul sayılmaz.
- Ana oyunda yok olan özellikler için koşullu aday olarak yer ayrılır; sahte işlev uygulanmaz. Asker modeli ve savaş mekanikleri bu tasarım turunda değişmez.
- KISS aşamasına taşınacak karar: hangi bilgi ve eylem birleşebilir, ne sürekli/bağlamsal, ne yalnız yardımda, ne elenebilir. Bu belgede elenen kayıt yok.

## Envanterin eksiksiz birincil yerleşim eşlemesi
Kaynak: FOC-BATTLE-FUNCTION-INVENTORY.md, blob f928122032b624dbc3c945c03df206891f32dd31. 247 farklı ID'nin her biri bir kez eşlenir. Aşağıdaki kısa kullanım metni doğrudan envanterin son sütunundan alınmıştır; yeni işlev veya karar olarak yorumlanmaz.

### P — Karşılaşma (10)
| ID | İşlev | Kaynak kullanım / geri bildirim |
|---|---|---|
| 01.01 | Savaşın nedeni ve tarafları — K/Ö | Savaş öncesi amaç, taraf, yer ve bilinen tehdit; yanlış karşılaşma olmasın. |
| 01.02 | Savaş hedefi ve bitiş koşulu — Ö/A | Hedefi inceler; yok etme, bozgun, savunma vb. yalnız gerçek savaş kuralına göre açıklanır. |
| 01.03 | Kendi ordusunun mevcudu ve bileşimi — K/M | Grup türleri, adet, hazır/yaralı/yedek ayrımı; savaş sırasında kalıcı toplam sayaç yok. |
| 01.04 | Bilinen düşman gücü — Ö/A | Keşif/rapora göre kesin, tahmini veya bilinmiyor; rakip gizli bilgi açığa çıkmaz. |
| 01.06 | Başlangıçtaki silah ve erzak durumu — K/A | Grup ekipmanı, mühimmat/erzak varsa başlangıç durumunu görür; kalıcı loadout yeniden atılmaz. |
| 01.07 | Çatışmaya girme veya vazgeçme — Ö/A | Başlat veya mevcut encounter kuralları izin veriyorsa çekil; gerçek sonucu önce bilir. |
| 09.07 | Kuşatma ve özel savaş hedefleri — Ö/A | Yalnız onaylı kuşatma/topçu/kapı/sur mekanikleri varsa ilgili etkileşim; şu an kapsam varsayımı değil. |
| 21.06 | Zafer/beraberlik koşullarını inceleme | Mevcut senaryo hangi koşulda biter; yapay hedef veya zaman sınırı icat etme. |
| 21.07 | Hedefin kalan süresi | Yalnız zaman sınırlı görev varsa kalan süre ve şartı. |
| 23.12 | Özel savaş türüne özel bilgi yüzeyi | Kuşatma gibi onaylı farklı savaş türlerinde yalnız ilgili mekanikler; yeni savaş türü kabulü değil. |

### D — Hazırlık / konuşlanma (20)
| ID | İşlev | Kaynak kullanım / geri bildirim |
|---|---|---|
| 01.05 | Araziyi keşfetme — Ö | Kamerayla alanı inceler; gerçek geçit, engel, zemin, yükseklik etkisini öğrenir. |
| 01.08 | Hazır olma ve geçiş — K/M/E | Eksik atamaları kontrol eder, savaşı başlatır; yerleşim ve kimlikler simülasyona aktarılır. |
| 02.01 | Sektör sayısı — K/A | Asker/300 önerisi ve izinli aralık; sayıyı değiştirir, dağılımı görür. Eski kod 12 üst sınırı kullanır; nihai kural değildir. |
| 02.02 | Sektöre grup atama — K/E | Grup seçip sektör belirtir; tekrar atama çakışmaz, tüm gruplar muhafaza edilir. |
| 02.03 | Başlangıç mevzisi — K/Ö | Sol uç/iç/merkez, merkez, sağ iç/merkez/uç, arka hat/yedek; gerçek yerleşim alanı ve sınırı. |
| 02.04 | Başlangıç yönü ve dizilişi — K/Ö | Grubun yerini/yönünü/dizilişini belirler; geçersiz çakışma uyarısı. |
| 02.05 | Yedek atama — K/M/E | Otomatik görsel kapasite yedeği ile taktik yedeği ayır; oyuncu hangi grubun beklediğini bilir. |
| 02.06 | Ordu komutanı — K/E | Uygun karakter atanır; yetki, deneyim, yokluk gerekçesi. |
| 02.07 | Sektör komutanı — K/E | Atanmış komutan ve verilen görev; boşluk/ulaşılamaz kişi uyarısı. |
| 02.08 | Birlik lideri, keşif/rapor ve moral taşıyıcı — K/A | İlgili rollere uygun kişiyi seçer; gerçek mekanik ve yetki açık. |
| 02.09 | Konuşlanmayı değiştirme/geri alma — Ö | Önceki atamaya dönme, otomatik öneri, geçerli yerleşim kontrolü; oyuncu onayı olmadan tüm düzen değişmez. |
| 17.06 | Birlikleri rol bazında dağıt | Tür/donanım ve komuta sınırına göre hazırlıkta dağıt. |
| 17.07 | Konuşlanmayı sıfırla | Savaş öncesi ilk geçerli düzene dön. |
| 17.08 | Hazır grup yerleşimi şablonu | Geçerlilik kontrolüyle yeniden kullanılabilir yerleşim. |
| 23.01 | Konuşlanma alanı sınırı | Başlangıçta yerleştirilebilen alanı açıkça tanıma. |
| 23.02 | Atanmamış birlik ve rol kontrolü | Hazırlıkta unutulan grupları ve geçersiz atamaları bulma. |
| 23.03 | Donanıma göre birlik dağıtım filtresi | Kalkan, mızrak, menzilli ve ağır donanım gibi gerçek sınıfları kullanma. |
| 23.04 | Dağıtım oranı ve mevcut kapasite | Birliklerin nereye ne kadar ayrıldığını görme; savaş içi kalıcı toplam sayaç yok. |
| 23.05 | Komutan atamasının uygunluk gerekçesi | Yetki ve komutan özellikleriyle atamanın neden geçerli olduğunu açıklama. |
| 23.06 | Hazırlık ekipmanı yerleştirme | Yalnız desteklenen savunma ekipmanı varsa yer ve kullanım. |

### W — Savaş alanı (15)
| ID | İşlev | Kaynak kullanım / geri bildirim |
|---|---|---|
| 03.01 | Kamera hareketi — M | Fare/klavye ile kaydırma, tutarlı yönler. |
| 03.02 | Yakınlaştırma ve döndürme — M | Kamera ayarı ve sınırları; emir seçimiyle çakışmaz. |
| 03.03 | Gruba odaklanma — M/Ö | Seçili grup veya kayıtlı gruba odaklanır. |
| 03.04 | Tek grup seçme — K/E | Askerine sol tıkla yaşayan grubun tamamını seç; sınır/işaret yalnız seçiliyken. |
| 03.05 | Birden fazla grup seçme — Ö/E | Ekle/çıkar veya kutu seçimi; grup kimliği korunur, tek tek asker yanlışlıkla ayrılmaz. |
| 03.06 | Seçimi temizleme — Ö/M | Boş zemin/Esc gibi açık yöntem; hedefleme iptali ile seçim iptali ayrılır. |
| 03.07 | Kontrol grupları — M/E | 1–9 atama/çağırma; sektör değişiminde yaşayan grup kimlikleri geçerli. |
| 07.01 | Sağ tık bağlamsal kontrol — kullanıcı kararı/E | Seçili grup > Emirler veya Dizilişler; ateş alt emir, strateji ayrı. |
| 13.01 | Tüm orduyu seç | Aktif sektörde yönetilebilir grupları birlikte seç; diğer sektörleri yanlışlıkla dahil etme. |
| 13.02 | Önceki/sonraki grup | Yaşayan dost grupları sırayla bul. |
| 13.04 | Görünür aynı tür grupları seç | Kamera alanındaki aynı türleri seç; tüm ordu seçimiyle karışmasın. |
| 13.06 | Hızlı kamera kaydırma | Uzak bölgeye hızlı git. |
| 13.07 | Kamera yönünü sıfırla | Alışılmış bakışa dön. |
| 20.01 | Seçili grubun zemin sınırı | Yalnız seçimde grubun alanını göster; sürekli birlik üstü simge yok. |
| 20.08 | Engel arkasında seçili birliği görme | Geçici siluet yardımı; görüş kurallarını ihlal etmez. |

### C — Emirler (37)
| ID | İşlev | Kaynak kullanım / geri bildirim |
|---|---|---|
| 04.01 | İlerle — M/E | Grup > sağ tık > Emirler > İlerle > zemin hedefi; hedef geçerli ve diziliş korunur. |
| 04.02 | Saldır/Odaklan — K/E | Düşman grubunu belirtir; menzilli/temas davranışı uygun silaha göre; hedef ölürse yeniden karar veya tamamlandı. Focus eski kararı ayrı davranış gerektiriyorsa korunur. |
| 04.03 | Konumu koru — K/M/E | Mevcut/istenen konumu tutar; uzaklaşmaz, izin verilen silahla savunur. |
| 04.04 | Saldırarak ilerle — M/E | Zemin hedefi; engel/çatışma sonrasında yoluna devam eder. |
| 04.05 | Geri çekil — K/M/E | Güvenli yön veya hedef; düşmana doğru sabit koordinat hatası olmaz; takip/bozgun riski gerçek. |
| 04.06 | Toplan — M/E | Erişilebilir toplanma noktası; başka grup içine ışınlanmaz. |
| 04.07 | Taciz et, uzaktan vur — K/E | Hedef/alan belirtir; menzile yaklaş, mesafeyi koru ve gerektiğinde uzaklaş; silah koşulu. |
| 04.08 | Dur/emri iptal et — Ö | Yalnız seçilen grubun aktif hareket/hedefi kesilir; önceki pasif savunma politikası korunur. |
| 04.09 | Takip veya destek — Ö/A | Dost grubu belirtir; uzaklık sınırı ve hedef kaybı davranışı; gerekiyorsa ayrı emir değil mevcut emir kombinasyonu. |
| 05.01 | Mesafeden tut — K/E | Uygun silahı seçer, yaklaşan düşmandan kaçınır; silahsız gruba sunulmaz. |
| 05.02 | Yakın savaşa hazırlan — K/E | Kılıç/pala/yatağan, mızrak vb. gerçek loadout'a göre seçilir. |
| 05.03 | Serbest ateş — K/M/E | Ateş politikası; hareket emrini ezmez. Mühimmat ve silah uygunsa. |
| 05.04 | Ateşi kes — M/E | Yalnız ateş politikası değişir, yürüyüş kesilmez; yakın savunma kuralı ayrıca belirlenir. |
| 05.05 | Toplu ateş — Ö/A | Hazır silah oranı/gerçek atış; şimdilik mekanik önerisi. |
| 05.06 | At-geri çekil — K/E | Ateş et, yaklaşan düşmandan geri çekil; yol/menzil/uygun silah koşulu. |
| 05.07 | Süvari karşıtı mızrak — K/M/E | Mızrak/pike donanımı ve durma koşulu; hazır değilse neden. |
| 05.08 | Süvari hücumu — M/E/Ö | Uygun atlı, hedef ve yaklaşma mesafesi; gerçek hız/hazır olma, karşı mızrak riski. |
| 05.09 | Hücumdan ayrıl, yeniden toplan — Ö | Güvenli çıkış hedefi; mevcut geri çekil/toplan ile birleştirilebilir. |
| 05.10 | Özel ekipman kullanımı — K/A | Özel ekipman gerçekten varsa hedef/menzil, kullanım ve kalan kaynak; olmayan topçu/özel mekanik gösterilmez. |
| 07.07 | Emir sırası — Ö/A | İsteğe bağlı kuyruk ve değiştirme; aynı hedefte çakışan emir yok. |
| 14.01 | Yürü/koş | Hız ve yorgunluk tercihi; at için uygun tempo. |
| 14.02 | Düzenli yaklaş / doğrudan hücum | Düzeni koruyarak yaklaşma ile hızlı teması ayır. |
| 14.03 | Takibi kes | Kaçan düşmanı kovalamayıp mevziyi koru. |
| 14.04 | Sınırlı karşılık | Yakın tehdide kısa mesafede karşılık ver ve dön. |
| 14.05 | Agresif takip | Uygun düşmanı daha geniş alanda takip et. |
| 14.06 | Kontrollü geri adım | Cepheyi düşmana dönük tutup çatışırken geri hareket et. |
| 14.07 | İleri baskı | Temastaki hattı ileri taşımayı dene. |
| 14.08 | Menzilli tehdide karşı korun | Uygun donanımla korunma; tüfek mermisine karşı hayali kalkan garantisi yok. |
| 14.09 | Dengeli davranış | Özel saldırı/savunma duruşundan normal davranışa dön. |
| 14.10 | Devriye | İki nokta arasında iptal edilebilir görev. |
| 14.11 | Alanı koru | Belirlenen bölgeyi savun; dost takipten farklı. |
| 14.12 | Bölgeye ateş | Yalnız uygun silah ve gerçek alan atış mekanizması varsa. |
| 14.13 | Birliği savaştan çıkar | Taktik geri çekilmeden ayrı, kalıcı çıkış ve kampanya sonucu. |
| 14.14 | At in/bin | Yalnız uygun arketip ve gerçek at yönetimi varsa. |
| 16.04 | Emir kuyruğunu incele/tek adımı sil | Yalnız yanlış sıradaki emri düzelt. |
| 17.02 | Birlik komutanına görev devret | Hedef ver ve ayrıntıyı komutana bırak; manuel emir öncelikli. |
| 17.03 | Keşif görevi | Belirli alanı araştır ve raporla. |

### F — Dizilişler (17)
| ID | İşlev | Kaynak kullanım / geri bildirim |
|---|---|---|
| 06.01 | Hat — K/M/E | İki sıra veya uygun sıra sayısı; eski kararda savunma bonusu, değer/test açık. |
| 06.02 | Kol — K/M/E | Dar, derin grup; eski kararda hız bonusu, değer/test açık. |
| 06.03 | Kama — K/M/E | Dolu üçgen; eski kararda ön saldırı bonusu, değer/test açık. |
| 06.04 | Gevşek/Seyrek — K/M/E | Düzenli geniş aralıklı sıralar; işlev ve savaş etkisi doğrulanır. |
| 06.05 | Dağınık/Avcı — K/M/E | Düzenli seyrekten farklı geometri; eski kararda menzilli hasar ve müttefik ölüm şoku azaltma. |
| 06.06 | Çember — K/M/E | Dışa bakan askerler; boşluk/uygunluk ve etkinlik sınırı. |
| 06.07 | Grubun yüzünü çevirme — Ö/E | Hedef yönü belirtir; askerlerin yeni konumu/yönü. |
| 06.08 | Cephe genişliği ve aralık — Ö/A | Otomatik güvenli aralık varsayılan; gerekiyorsa genişlik seçimi. Piyade ve at farklı. |
| 06.10 | Karma grup/çoklu grup düzeni — K/Ö/E | Grup bütünlüğü, farklı sınıf yerleşimleri, çarpışmayan hedefler; grup birleştirme/ayırma ayrı açık karar. |
| 15.01 | Çoklu grup dizilişini kilitle | Grupların birbirine göre yerlerini koru; kendi iç dizilişlerinden ayrı. |
| 15.02 | Geçici komuta grubu oluştur/çöz | Ortak emir ver; kalıcı asker kimliği değişmez. |
| 15.04 | Saf sayısını ayarla | Geniş/sığ veya dar/derin düzen; güvenli aralık sınırı. |
| 15.05 | Kısa ileri/geri adım | Mevzide küçük düzeltme. |
| 15.06 | Küçük açılı dönüş | Yüz çevirmenin hassas çeşidi. |
| 15.07 | Kare diziliş | Çemberden farklı dört yüzlü savunma; uygunluk ve tarihsel bağlam incelenir. |
| 15.08 | Kalkan duvarı | Uygun kalkanlı birlik sıklaşır; tüm türlere sunulmaz. |
| 15.09 | Avcı alt grubu ayır/geri birleştir | Keşif veya taciz için geçici grup; kimlik ve donanım korunur. |

### T — Hedefleme ve geçici zemin katmanı (19)
| ID | İşlev | Kaynak kullanım / geri bildirim |
|---|---|---|
| 07.02 | Zemin hedefi ve rota — Ö/M/E | Hedef işaretle; geçilebilir konum, planlanan rota ve son yön gerçek hesapla tutarlı. |
| 07.03 | Düşman hedefi — Ö/E | Yaşayan hedefin kimliği; hareket eden hedef takip politikası. |
| 07.04 | Hedef önizleme ve geçerlilik — Ö | Mevzi/diziliş/yön önizlemesi; alan dışı, engel, uygun olmayan emir gerekçesi. |
| 07.05 | İptal ve yanlış komutu düzeltme — Ö | Hedefleme modundan çık, verilmiş emri yenisiyle değiştir; geçmiş savaş sonucunu geri sarma yok. |
| 09.05 | Harita sınırı ve güvenli çıkış — Ö/E | Geçerli çıkış, kaçış/terk sonuçları; sahne dışına rastgele hedef yok. |
| 15.03 | Fareyle cephe çiz | Hedefleme sırasında yön ve genişliği sürükleyerek belirle; sağ tık menüsü kararı korunur. |
| 15.12 | Savunma hattı çiz | Birden çok gruba ortak hat tanımla; gerçek arazi ve yerleşim kontrolü. |
| 16.01 | Mevcut emirleri geçici göster | Hedef ve rotaları ihtiyaçta gör; sürekli çizgi yok. |
| 16.03 | Etkili ateş alanı | Silaha ve yönüne göre menzil yayı; isabet garantisi yok. |
| 16.12 | Tahmini varış | Rota, hız ve gecikmeye bağlı belirsiz tahmin. |
| 18.06 | Geçersiz komut nedeni/alternatif | Gerçek sebep ve varsa çözüm; sessiz başarısızlık yok. |
| 20.02 | Hedefin geçici zemin sınırı | Saldırı hedefini yanlış gruptan ayır; yalnız hedefleme bağlamında. |
| 20.03 | Varışta oluşacak dizilişin hayalet önizlemesi | Hedef konum, cephe yönü ve slotları emirden önce göster. |
| 20.04 | Hareket yolu ile doğrudan hedef çizgisi ayrımı | Gerçek rota varsa rota; yoksa yalnız hedef doğrultusu, geçilebilir rota iddiası yok. |
| 20.05 | Yön ve cephe oku | Varışta hangi tarafa bakacağını belirt. |
| 20.06 | Ateş yayı ve menzil katmanı | İhtiyaç halinde menzil/yön göstergesi; gerçek silah hesabına bağlı. |
| 20.12 | Hedefleme sırasında fare işaretçisi değişimi | Hareket, saldırı, uygun olmayan hedef ve iptali ayırt et. |
| 20.13 | Akıllı hedef bilgisi | Hedefin uygunluğu, menzil, engel ve silah uyumu; kesin kazanma garantisi veya gizli istatistik yok. |
| 22.10 | İzin verilmeyen eylemin koşulları | Moral, donanım, menzil veya yetki nedeniyle kullanılamayan seçenek için açıklama. |

### I — Bağlamsal inceleme (42)
| ID | İşlev | Kaynak kullanım / geri bildirim |
|---|---|---|
| 03.08 | Birlik türüne göre bulma/seçme — Ö | İsteğe bağlı kısayol; karma gruplarda gerçek kabiliyet üzerinden seçer. |
| 03.09 | Düşmanı inceleme ve yanlış seçimi engelleme — Ö/E | Yalnız izinli bilgi; yaşayan dost seçimi ve düşman hedeflemesi farklı eylemdir. |
| 07.06 | Emir durumu — Ö/E | Hazırlanıyor, iletildi, ilerliyor, çatışıyor, engellendi, ulaştı, tamamlandı/iptal; gerekçeli. |
| 08.01 | Grup kimliği ve mevcut savaşçılar — K/M/E | İsteğe bağlı tür, yaşayan/aktif/yedek ve kayıp ayrımı; karma grup doğru adlandırılır. Kalıcı sayaç/simge yok. |
| 08.02 | Sağlık ve kayıp durumu — K/M | Yaralı/ölü ayrımı varsa doğru göster; prototip hp/ölüm ile sınırlı. |
| 08.03 | Moral — K/E | Hasar, müttefik ölümü, sayı baskısı, arkadan/kanattan saldırı, süvari hücumu, komutan, açlık/erzak, geri çekilme/bozgun. Sebep gerçek olaydan alınır. |
| 08.04 | Sarsılma, kaçma, bozgun — K/E/A | Durum ve nedeni; oyuncunun hangi emirleri verebildiği ve toparlanma koşulu. Eşikler açık. |
| 08.05 | Silah ve aktif ekipman — K/E | Kalıcı loadout ve aktif silah değişimini öğrenir; gerçek silah yoksa komut yok. |
| 08.06 | Menzil ve görüş hattı — M/E | Hedef menzilde/engel arkasında mı; yalnız gerçek hesap. |
| 08.07 | Mühimmat ve doldurma — K/A/E | Kalan kaynak ve dolduruyor/ateşe hazır durumları; tüketim ve doldurma sistemi tamamlanmadan sayı uydurulmaz. |
| 08.08 | Zırh ve karşılaşma uyumu — K/M/E | Uygun olmayan çatışmanın nedenini öğrenir; kesin hasar/koruma değerleri ayrı denge kararı. |
| 08.09 | Hız, yorgunluk ve hücum hazırlığı — M/Ö/A | Hız/yorgunluk varsa gerçek state; yorgunluk ve ağırlık etkileri açık, HUD için icat edilmez. |
| 08.10 | Sıkışma, diziliş bozulması ve yeniden oluşma — M/E | Engel/çatışma sebebi ve varsa çözüm; öldürülen askerlerin yerleri gerçek grup içi düzenle güncellenir. |
| 09.01 | Yükseklik — M/E | Gerçek sahne yüksekliği ve savaş hesabı eşleşir; sentetik koordinat bonusu oyuncuya gerçek topoğrafya diye gösterilmez. |
| 09.02 | Yol, açık alan, engebe — M/E | Geçilebilirlik ve gerçek hız etkisi; oyuncu uygun rotayı seçer. |
| 09.03 | Orman ve görüş — Ö/A | Görüş ve gizlilik kuralı varsa açıklanır; yoksa dekor. |
| 11.03 | Seçili grup açıklaması — Ö/E | İhtiyaçta grup türü, mevcut davranış, seçilen diziliş, desteklenen emir ve sebepler. Kalıcı birlik üstü simge yok. |
| 13.03 | Karma seçimde türler arası geçiş | Seçimi kaybetmeden ilgili türün emirlerini kullan. |
| 13.05 | Emirsiz birlikleri bul | Görevsiz grupları bul; kasıtlı savunma boşta sayılmaz. |
| 16.05 | Yorgunluk nedeni ve dinlenme | Koşu, donanım, savaş ve dinlenmenin gerçek etkileri. |
| 16.06 | Etkinlik değişimi nedenleri | Arazi, çevrelenme ve yorgunluğun gerçek etkisini açıkla. |
| 16.07 | Ateş edememe nedeni | Menzil, görüş, dost engeli, doldurma ve emir durumunu ayır. |
| 16.09 | Birlik karşılaştırması | Rol, silah, koruma ve zayıflık; gizli düşman bilgisi yok. |
| 16.11 | Saha engeli ve korunma bilgisi | Duvar, hendek, orman gibi gerçek arazi etkisi. |
| 17.05 | Komuta taşıyıcısının durumu | Lider, sancak, davulcu varsa gerçek kayıp ve etkisi; model işi başlatılmaz. |
| 19.01 | Birlik ayrıntı incelemesi | Seçilen grup hakkında temel bilgi ile ayrıntılı özellikleri ayrı inceleyebilme. |
| 19.02 | Komutan adı, rütbesi ve portresi | Grubun kimin komutasında olduğunu ve komuta zincirini öğrenme. |
| 19.03 | Birliğin üst organizasyonu | Grubun hangi sektör ve üst komuta altında bulunduğunu öğrenme. |
| 19.04 | Birlik deneyimi ve kıdemi | Kalıcı deneyim sistemi varsa birliğin tecrübesini ve etkisini anlama. |
| 19.05 | Verilen ve alınan kayıplar | Seçili grubun savaş performansını isteğe bağlı inceleme; gizli kesin düşman bilgisi yok. |
| 19.06 | Moral değişiminin yönü | Moral iyileşiyor mu kötüleşiyor mu, gerçek state geçmişinden öğrenme. |
| 19.07 | Doldurma ilerlemesi ve hazır silahlar | Birliğin bir sonraki atışa hazırlığını anlama; gerçek doldurma hesabı şart. |
| 19.08 | Mevcut arazi koruması | Birliğin bulunduğu mevzide korunma etkisini inceleme. |
| 19.09 | Saldırı ve savunma özellikleri | Saldırı, zırh, kalkan, zırh karşıtı etki, hücum gibi gerçek özellikleri ayrı açıklama. |
| 19.10 | Temel özellik ve anlık etkinlik ayrımı | Kalıcı özellik ile yorgunluk, moral, arazi kaynaklı geçici değişimi ayırma. |
| 19.11 | Birlik kartı/listesi alternatif erişimi | Savaş alanında bulunması zor grubu isteğe bağlı listeden seçme; kalıcı kart şeridi kabul edilmiş değil. |
| 19.12 | Birliklerin kategori ve sektör filtreleri | İsteğe bağlı listede birlik türü, komutan ve sektör bazında bulma. |
| 19.13 | Birlik durum metni | Bekliyor, ilerliyor, yakın savaşta, ateş ediyor, kaçıyor gibi gerçek durumları açıklama. |
| 19.14 | Çoklu seçimin ortak ve farklı özellikleri | Birden çok grupta farklı emir, donanım veya durum varsa yanlış ortalama yerine farkı gösterme. |
| 20.07 | Komutan etki alanı | Komuta veya moral etkisi gerçekten mevcutsa alanı isteğe bağlı inceleme. |
| 21.11 | Mevzi hakkında bağlamsal açıklama | Fareyle alanı inceleyince gerçek hareket, koruma ve görüş etkisini öğrenme. |
| 22.09 | Bilgi kaynağı ve güven düzeyi | Doğrudan gözlem ile gecikmiş haberci raporunu ayırma. |

### M — Harita / arazi inceleme (14)
| ID | İşlev | Kaynak kullanım / geri bildirim |
|---|---|---|
| 09.04 | Nehir, köprü, geçit — Ö/A | Kullanılabilir geçişi ve sınırları seçer; harita destekliyorsa. |
| 11.01 | Mini harita/alan yönelimi — M/Ö | İsteğe bağlı alan görünümü; konum ve kamera ilişkisi; yanlış ölçek/konum düzeltilir. Kalıcı olup olmayacağı tasarım aşamasında. |
| 13.08 | Taktik genel görünüm | Aktif alanı üstten incele; yalnız izinli bilgi. |
| 13.09 | Kamera noktası kaydet | Sık denetlenen mevzilere dön. |
| 16.02 | Görüş hattını konumdan ölç | İşaretlenen mevzinin görülebilir alanı; gerçek görüş hesabı gerekli. |
| 16.10 | Son bilinen düşman konumu | Eski raporu gerçek anlık konumdan ayır. |
| 18.04 | Mini haritayı aç/kapat ve ölçekle | Gerektiğinde kullan; kalıcı görünüm kararı verilmedi. |
| 21.01 | Kamera görüş alanı ve yönü | Mini harita veya taktik görünümde kameranın nerede ve hangi yöne baktığını anlama. |
| 21.02 | Harita ölçeği ve yakınlaştırma | Farklı büyüklükte sahalarda konumları inceleme. |
| 21.03 | Taktik haritaya geçiş ve geri dönüş | Üstten görünüm ile normal kamera arasında konumu kaybetmeden geçiş. |
| 21.04 | Haritada arazi türlerini ayırt etme | Yol, orman, geçit, su ve yükseklik gibi gerçek harita verisini gösterme. |
| 21.05 | Hedef noktası durumları | Savaş hedefi varsa elde tutuluyor, kaybedildi veya ele geçiriliyor durumunu görme. |
| 21.08 | Hedef konumuna odaklanma | Görev veya raporun yerini haritada bulma. |
| 21.12 | Görüş dışı ve bilinmeyen alan ayrımı | Keşif kuralları destekliyorsa bilinmeyen bilgiyi kesin bilgi gibi sunmama. |

### S — Sektör ve üst komuta (15)
| ID | İşlev | Kaynak kullanım / geri bildirim |
|---|---|---|
| 10.01 | Aktif sektör seçme/değiştirme — K/M/E | Sektöre geçer; mevcut seçimi ve emirleri kaybolmaz, geçiş süresi açık. |
| 10.03 | Sektör raporu — K/Ö/E | Son bilinen durum, rapor zamanı, kaynak ve belirsizlik; gizli kesin istatistik yok. |
| 10.04 | Haberci ve emir gecikmesi — K/A/E | Emir gönderildi/yolda/ulaştı; gecikme formülü ve iptal kuralı açık. |
| 10.05 | Komutanın yetkisi ve görevleri — K/A/E | Tut, ilerle, çekil gibi görev sınırı; oyuncu müdahale edince yetki devri açık. |
| 10.07 | Yedeklerin otomatik tamamlaması — M/E | Gerçek grup kimliği korunur; farklı gruptan asker yanlışlıkla ölenin yerini almaz. |
| 10.08 | Taktik yedekleri savaşa sokma — Ö/A | Yedek grubu, sektör/konum ve geliş süresi; otomatik kapasite yedeğiyle karıştırılmaz. |
| 10.09 | Sektörler arası kuvvet aktarımı — Ö/A | Gönderen ve alan sektör, yol/gecikme/tehlike; teleport yok, kapsam onayı. |
| 10.10 | Genel strateji — Ö/A | Serbest yönetim, dengeli ilerleme, savunma, kanattan saldırı; gerçek rol, hedef ve emirleri önceden görür, onaylar. Grup sağ tık menüsüne eklenmez. |
| 10.11 | Stratejiden çıkma ve manuel müdahale — Ö/A | Seçili grubun planı devralınır; diğer gruplar etkilenmez; bütün planı iptal etmek ayrı açık eylem. |
| 15.10 | Eksilen safları tamamla | Uygun yedeklerle gerçek takviye; görsel kapasiteden ayrı. |
| 15.11 | Üst komuta grubu oluştur | Birden fazla grubu tek görev altında yönet; kalıcı askerleri karıştırma. |
| 17.01 | Yetkiye göre komuta devral | Yalnız atanmış birlikleri yönet. |
| 17.04 | Saha ikmalini koru/yenile | Yalnız gerçek ikmal sistemiyle; kaynak, erişim ve tüketim. |
| 21.09 | Takviye giriş alanı ve geliş durumu | Onaylı takviye sistemi varsa giriş bölgesi ve tahmini geliş; gizli rakip bilgisi yok. |
| 21.10 | Sektör haritası ve rapor güncelliği | Aktif/pasif sektörleri ve son rapor zamanını ayırt etme. |

### N — Olay ve bildirim (9)
| ID | İşlev | Kaynak kullanım / geri bildirim |
|---|---|---|
| 10.06 | Komutan kaybı — K/A/E | Kayıp haberi, halef veya komuta boşluğu, etkisi; keyfi ceza yok. |
| 11.02 | Önemli olay bildirimi — Ö/E | Bozgun, komutan kaybı, ulaşılamayan emir, sektör tehlikesi; tekrarlar gruplanır, olay kaynağına gidilebilir. |
| 13.10 | Son olaya odaklan | Bildirim kaynağına git; pasif sektör rapor zamanı korunur. |
| 16.08 | Kanat/arka tehdit uyarısı | Gerçek çevrelenme hesabı varsa. |
| 20.14 | Kritik durumun görsel vurgusu | Kaçış ve komuta kaybı gibi olayı geçici vurgula; sürekli sancak UI yok. |
| 22.01 | Savaş olayları geçmişi | Kaçırılan önemli olayları daha sonra inceleme. |
| 22.02 | Olayın kaynağına gitme | İlgili birlik, hedef veya sektöre odaklanma. |
| 22.03 | Bildirim türü ve önem derecesi | Kritik komuta kaybı ile sıradan hareket tamamlanmasını ayırma. |
| 22.06 | Emir kabulü ve başarısızlık sesi | Sesin gerçek komut kabulüne bağlı olması, metin/görsel alternatif. |

### X — Savaş kontrolü / ayarlar (18)
| ID | İşlev | Kaynak kullanım / geri bildirim |
|---|---|---|
| 11.04 | Duraklat/devam — M/E | Gerçek simülasyon durumu; pasif sektörlerin ve zamanın da ne yaptığı belirli. Duraklatmada emir verme kuralı açık. |
| 11.05 | Savaş hızı — Ö/A | Ancak tüm sektörlerde zaman tutarlılığı sağlanırsa; hız değiştirme durumu anlaşılır. |
| 11.06 | Ayarlar ve kontrol yardımı — M/Ö | Oyuncu ihtiyaç duyduğunda ayarlar/kısayollar; menü açılması savaş kontrolünü bozmaz. |
| 11.08 | Ses, renk ve metin erişilebilirliği — Ö | Önemli bilgi yalnız renk veya sesle verilmez; ölçek, kontrast, metin. |
| 11.09 | Savaştan ayrılma/yeniden başlatma — M/Ö/A | Kampanya geri çekilme sonucu ile test yeniden başlatma farklı; yanlışlıkla ilerleme kaybı yok. |
| 18.01 | Taktik duraklatmada emir hazırla | Tek oyuncuda zamanı durdurup emir planla; sektör/haberci zamanını tutarlı tut. |
| 18.02 | Tuşları yeniden ata | Çakışma uyarısı ve varsayılana dönme. |
| 18.03 | Arayüzü geçici gizle | Savaşı incele; geri açma yolu korunur. |
| 18.08 | Kamera giriş ayarları | Hassasiyet, ters yön ve kenar kaydırma; hedeflemeyle çakışmasın. |
| 20.09 | Bitki örtüsünü geçici gizleme | Kamera görüşünü açma; oyun içi keşif ve gizlilik hesabını değiştirmez. |
| 20.10 | Sinematik görünüm | HUD'u isteğe bağlı gizle, normal kullanıma dönüş kolay. |
| 20.11 | Geçici katman seçenekleri | Hareket, seçim, ateş yayı ve benzeri katmanları ayrı aç/kapat; reddedilen simgeleri geri getirmez. |
| 22.05 | Bildirim ayarları | Ses, metin, önem ve tekrar tercihleri; kritik bilgiye erişim korunur. |
| 22.11 | Duraklatılmış durum ve bekleyen emirler | Zamanın durduğunu ve hangi emirlerin devamda başlayacağını ayırt etme. |
| 22.12 | Zaman kontrolü durumunun anlaşılması | Duraklama/hız değişikliğinin gerçek simülasyonla tutarlılığı. |
| 24.01 | Arayüz ölçeği ve metin okunabilirliği | Farklı ekran çözünürlüğü ve erişilebilirlik ihtiyacına uyum. |
| 24.02 | Bağlamsal bilgiyi açma/kapatma | Gerektiğinde ayrıntı; kalıcı asker sayacı veya birlik simgesi geri gelmez. |
| 24.07 | Kısayol çakışması ve değişiklik bildirimi | Gerçek tuş ataması ve açıklama tutarlı; eski tuş gösterilmez. |

### H — Yardım / kısayol (7)
| ID | İşlev | Kaynak kullanım / geri bildirim |
|---|---|---|
| 07.09 | Kısayol ve geri bildirim — M/Ö | Fare, klavye ve izinli harita etkileşimi aynı komut yoluna gider; ses/görsel yalnız gerçek kabulde. |
| 11.07 | İlk kullanım öğretimi — Ö | Kısa görev: grup seç, emir, hedef, diziliş, iptal; isteğe bağlı tekrar. |
| 18.05 | Klavye ile menü gezinme | Yön, Enter ve Esc; fare zorunlu değil. |
| 18.07 | Bağlamsal yardım | İşlev, etki ve koşulu ihtiyaçta öğren. |
| 22.07 | İşlev açıklaması ve kısayol | Buton veya seçeneğin işlevini ve atanmış tuşunu ihtiyaçta öğrenme. |
| 22.08 | Danışman ve yardım seçenekleri | İlk kullanımda kısa yardım; isteğe bağlı kapatma. |
| 24.05 | Fare üzerinde bekleme ve açık açıklama alternatifi | İşlevi yalnız hover ile erişilebilir kılma; klavye desteği. |

### R — Savaş sonucu (14)
| ID | İşlev | Kaynak kullanım / geri bildirim |
|---|---|---|
| 12.01 | Zafer/yenilgi/çekilme ve sebep — K/M/E | Gerçek hedef ve bütün sektörler; mevcut <=10 eşik prototip kuralı nihai tasarım değil. |
| 12.02 | Sektörlere göre sonuç — K/E | Özet ve ihtiyaçta ayrıntı; pasif ve aktif sonuçlar birlikte. |
| 12.03 | Kayıp, sağ kalan, yaralı — K/E | Ölüm/yaralı/esir/kaçan ayrımı; sayıların toplamı tutarlı. |
| 12.04 | Esirler ve kaderi — K/A/E | Fidye/takas/serbest/hapis seçenekleri ilgili sistem izin verirse; zorla taraf değiştirme yok. |
| 12.05 | Karakter sonucu ve komuta boşluğu — K/E | Yaralanma/esaret/ölüm ve görev boşluğu, aile/hizip/diplomasi sonuçları. |
| 12.06 | Ganimet, altın ve mal — K/E | Elde edilen kaynak ve gerçek envanter aktarımı; tekrar ödül alınamaz. |
| 12.07 | Nam, deneyim ve savaş skoru — K/E | Değişim, neden ve bağlantılı sistem; tecrübeli askerin karaktere dönüşmesi açık karar. |
| 12.08 | Savaş sonrası ordu durumu — K/Ö/E | Kalıcı asker kimliği, loadout, yaralı ve yedekler; geri dönünce grup yapısı bozulmaz. |
| 12.09 | Kampanyaya dönüş ve kayıt — K/Ö/E | Sonucu onayla/geri dön; kayıt tutarlılığı, tekrar işlem yok. |
| 23.07 | Sonuç özeti ve ayrıntı ayrımı | İlk sonuçtan sonra isteğe bağlı ayrıntılı rapor. |
| 23.08 | Birlik bazında savaş raporu | Her grubun kaybı, katkısı ve sağ kalanları; gerçek kalıcı kimliklerle. |
| 23.09 | Savaş hedeflerinin sonuç dökümü | Hangi gerçek hedefler elde tutuldu veya kaybedildi. |
| 23.10 | Savaş başlangıç ve bitiş kaydı | Sonuçta savaş süresini öğrenme; kalıcı sayaç şart değil. |
| 23.11 | Kampanyaya geçiş öncesi sonuç doğrulama | Ganimet, yaralı, esir ve komuta sonuçları kesinleşmeden iki kez uygulanmaz. |

### B — Arka plan kuralı (10)
| ID | İşlev | Kaynak kullanım / geri bildirim |
|---|---|---|
| 06.09 | Dizilişi hareket boyunca koruma — E | Aynı slot hesabı hareket ve yeniden dizilmede kullanılır; engelde bozulma ve yeniden oluşma. |
| 07.08 | Komut çakışması önceliği — E/Ö | Hareket/hedef, silah politikası, diziliş ve plan ayrı veri; manuel emir ile otomasyon önceliği. |
| 09.06 | Birlikler arası fiziksel engel — M/E | Dost birimler için geçiş/boşluk; hedef gerçek rota ile uyumlu. |
| 10.02 | Diğer sektörlerin simülasyonu — K/E | Durum değişimleri özetlenir; eski/pasif simülasyon ile aktif simülasyon tutarlı. |
| 11.10 | Gerçek veri ve açıklama — E/Ö | Kayıp, süre, durum, emir yalnız simülasyondan; hatalı/sahte durum gösterilmez. Oyuncu dost/düşman toplam sayacı istemiyor; veri arka planda tutulabilir. |
| 22.04 | Tekrarlanan olayları birleştirme | Aynı olayın onlarca bildirim üretmesini önleme. |
| 24.03 | Seçim ve menü odağı | Açık menüdeki tık savaş alanına yanlış emir olarak gitmez. |
| 24.04 | Menünün ekran dışında kalmaması | Köşede açılan sağ tık menüsü her çözünürlükte erişilebilir. |
| 24.06 | Renk dışı durum işareti | Seçim, hedef ve geçersiz komutun yalnız renk ile aktarılmaması. |
| 24.08 | Geri dönüş ve menü kapatma davranışı | Esc/boş alan/menü kapatma kuralları tutarlı; hedefleme iptali ayrılır. |

## Tasarım doğrulama sırası
2.1 Karşılaşma ve hazırlık; 2.2 savaş alanı ve grup kontrolü; 2.3 emir/diziliş/hedefleme; 2.4 bilgi ve görsel katmanlar; 2.5 sektör/strateji; 2.6 kontrol/sonuç. Her alan için normal, seçimsiz, geçersiz, karışık ve iptal durumları tasarlanacak. Ardından görsel örnekler; kullanıcı tercihleri kaydedilecek. Üçüncü aşamada KISS değerlendirmesi, sonrasında uygulama ve gerçek test. Bu belge birinci yerleşim taslağıdır, görsel tasarım onayı değildir.
