# Fall of Cavalry — 2.3 Emirler, dizilişler ve hedefleme
28 Kasım 2026. Aşama 2 kullanım/yerleşim taslağı; kaynak ana eşleme 2fbcaf82376e5e83f160ae0f5fdddcc78b5dba89. Kullanıcı kararları: sol tık grup, sağ tık yalnız Emirler/Dizilişler; sürekli dost/düşman toplam sayaçları, birlik üstü simgeler ve büyük emir konsolu yok. Asker modelleri değişmez. Bu belge KISS elemesi, uygulama veya kesin görsel/tuş onayı değildir.

## Yerleşim ve kullanım
Ana menü yalnız Emirler / Dizilişler. Sol tık grup seçer, sağ tık açar. Alt dallar (hareket, saldırı, savunma, ateş, davranış, süvari, özel ekipman, komuta vb.) aday organizasyon; bunlar kalıcı buton veya üçüncü ana dal değildir. Diziliş dalı biçimler, yön/genişlik ve ortak düzen adaylarına erişim sağlar. Aktif silah ve yetkiye uygun seçenekler gösterilir; uygun değilse açıklama erişilebilir. Karma seçimde ortak komut bütün uygun gruplara; tür özel emri için önce ilgili türü açıkça seç; kısmi uygulama sessizce yapılmaz. Her biçim yanında küçük şema ve amacını açıklayan metin, mevcut olan işaretli.
```
[3D alan / seçili grup]   [Emirler    >] [Hareket > ...]
                         [Dizilişler >] [Saldırı > ...]
                                        [Savunma / uygun özel emirler]
```
Bir emir seçildiğinde menü kapanır. Hedef gerekmiyorsa doğrula ve uygula; gerekiyorsa zemin/düşman/dost/alan/yön hedefleme moduna gir, kısa talimat, gerçek hayalet yerleşim, geçerli/geçersiz işaret, sol tık onay, Esc iptal. Devriye iki nokta, cephe/hat sürükleme ile önizlenir. Yanlış hedef önceki kabul edilmiş emri bozmaz. Hedefin ölümü veya ulaşılmazlığı gerçek yürütme durumuna döner. Savaştan çıkma gibi kalıcı eylemlerde sonuç onayı. Menü ekran kenarında ters yöne açılır. Emir kuyruğu ayrı geçici inceleme, tek adım silinebilir; Shift gibi tuşlar aday.
## Mekanik sözleşme
Hareket, hedef, ateş politikası, diziliş, komuta ve sıra ayrı state. Tek slot motoru; hareket dizilişi korur, engelde gerçek bozulma ve yeniden oluşma. Rota ile doğrultu ayrılır, olmayan görüş/menzil/bonus gösterilmez. Grup kimliği ve yaşayan yetkili üyeler doğrulanır. Hedefe varış yalnız gerçekleşince bildirilir. Eski hold_fire hareket kesme, sabit retreat/regroup, farklı slot hesapları ve en yakın düşmana saldırma sorunları uygulama kapısıdır. Yeni duruşlar, yorgunluk, mühimmat, özel ekipman ve grup ayırma koşullu.
## Test planı
Seçimsiz, tek/çoklu/karma grup, uygunsuz silah, iptal, hedef ölümü, engel, harita sınırı, sıraya ekle/tek adım sil, ateş keserken hareket, aynı dizilişle ilerleme, farklı at/piyade aralığı, ekran kenarı ve menü tık sızıntısı. Bunlar tasarım doğrulama senaryoları; çalıştırılmadı.

## Her kayıt için birincil erişim, eylem ve sonuç

### C alanı
| ID | İşlev | Envanter kullanım açıklaması | Önerilen erişim ve davranış |
|---|---|---|---|
| 04.01 | İlerle — M/E | Grup > sağ tık > Emirler > İlerle > zemin hedefi; hedef geçerli ve diziliş korunur. | Hareket > İlerle; zemin hedefi ve varış düzeni; onayla. |
| 04.02 | Saldır/Odaklan — K/E | Düşman grubunu belirtir; menzilli/temas davranışı uygun silaha göre; hedef ölürse yeniden karar veya tamamlandı. Focus eski kararı ayrı davranış gerektiriyorsa korunur. | Saldırı > Saldır/Odaklan; düşman grubu seç; erişilebilirlik kontrolü. |
| 04.03 | Konumu koru — K/M/E | Mevcut/istenen konumu tutar; uzaklaşmaz, izin verilen silahla savunur. | Savunma > Konumu koru; mevcut veya belirtilen mevzi, takip sınırı. |
| 04.04 | Saldırarak ilerle — M/E | Zemin hedefi; engel/çatışma sonrasında yoluna devam eder. | Hareket > Saldırarak ilerle; zemin hedefi, çatışmadan sonra devam. |
| 04.05 | Geri çekil — K/M/E | Güvenli yön veya hedef; düşmana doğru sabit koordinat hatası olmaz; takip/bozgun riski gerçek. | Hareket > Geri çekil; güvenli yön/konum, gerçek çıkış ile karışmaz. |
| 04.06 | Toplan — M/E | Erişilebilir toplanma noktası; başka grup içine ışınlanmaz. | Hareket > Toplan; gerçek erişilebilir grup merkezi veya seçilen nokta. |
| 04.07 | Taciz et, uzaktan vur — K/E | Hedef/alan belirtir; menzile yaklaş, mesafeyi koru ve gerektiğinde uzaklaş; silah koşulu. | Saldırı > Taciz et; uygun silah, düşman/alan seç. |
| 04.08 | Dur/emri iptal et — Ö | Yalnız seçilen grubun aktif hareket/hedefi kesilir; önceki pasif savunma politikası korunur. | Hareket > Dur; aktif hareket/hedef iptal, diğer politika korunur. |
| 04.09 | Takip veya destek — Ö/A | Dost grubu belirtir; uzaklık sınırı ve hedef kaybı davranışı; gerekiyorsa ayrı emir değil mevcut emir kombinasyonu. | Destek > Takip/destek; dost grup hedefi, ayrılma şartı. |
| 05.01 | Mesafeden tut — K/E | Uygun silahı seçer, yaklaşan düşmandan kaçınır; silahsız gruba sunulmaz. | Menzilli > Mesafeden tut; uygun silah ve mesafe. |
| 05.02 | Yakın savaşa hazırlan — K/E | Kılıç/pala/yatağan, mızrak vb. gerçek loadout'a göre seçilir. | Silah > Yakın savaşa hazırlan; uygun mevcut ekipmanı seç. |
| 05.03 | Serbest ateş — K/M/E | Ateş politikası; hareket emrini ezmez. Mühimmat ve silah uygunsa. | Ateş > Serbest ateş; bağımsız politika, hareket sürer. |
| 05.04 | Ateşi kes — M/E | Yalnız ateş politikası değişir, yürüyüş kesilmez; yakın savunma kuralı ayrıca belirlenir. | Ateş > Ateşi kes; ateş politikası değişir, hareket sürer. |
| 05.05 | Toplu ateş — Ö/A | Hazır silah oranı/gerçek atış; şimdilik mekanik önerisi. | Ateş > Toplu ateş; hazır silah ve gerçek salvo koşulu. |
| 05.06 | At-geri çekil — K/E | Ateş et, yaklaşan düşmandan geri çekil; yol/menzil/uygun silah koşulu. | Menzilli > At-geri çekil; hedef, mesafe ve silah uygunluğu. |
| 05.07 | Süvari karşıtı mızrak — K/M/E | Mızrak/pike donanımı ve durma koşulu; hazır değilse neden. | Savunma > Mızrak hazırla; uygun silah ve duruş. |
| 05.08 | Süvari hücumu — M/E/Ö | Uygun atlı, hedef ve yaklaşma mesafesi; gerçek hız/hazır olma, karşı mızrak riski. | Süvari > Hücum; hedef ve yaklaşma uygunluğu, gerçek hazırlık. |
| 05.09 | Hücumdan ayrıl, yeniden toplan — Ö | Güvenli çıkış hedefi; mevcut geri çekil/toplan ile birleştirilebilir. | Süvari > Ayrıl/toplan; güvenli konum, hücumdan çık. |
| 05.10 | Özel ekipman kullanımı — K/A | Özel ekipman gerçekten varsa hedef/menzil, kullanım ve kalan kaynak; olmayan topçu/özel mekanik gösterilmez. | Özel > Ekipman; gerçek arketipe bağlı seçenek ve hedef. |
| 07.07 | Emir sırası — Ö/A | İsteğe bağlı kuyruk ve değiştirme; aynı hedefte çakışan emir yok. | Emirler > Emir sırası; mevcut sıra incele, yeni adım ekle/onayla. |
| 14.01 | Yürü/koş | Hız ve yorgunluk tercihi; at için uygun tempo. | Hareket > Tempo; yürü/koş mevcut emre ek politika. |
| 14.02 | Düzenli yaklaş / doğrudan hücum | Düzeni koruyarak yaklaşma ile hızlı teması ayır. | Saldırı > Yaklaşma biçimi; düzenli yaklaş/hücum, gerçek hareket. |
| 14.03 | Takibi kes | Kaçan düşmanı kovalamayıp mevziyi koru. | Davranış > Takibi kes; takip sınırı ve mevziyi koru. |
| 14.04 | Sınırlı karşılık | Yakın tehdide kısa mesafede karşılık ver ve dön. | Davranış > Sınırlı karşılık; gerçek yakın tepki ve geri dönüş. |
| 14.05 | Agresif takip | Uygun düşmanı daha geniş alanda takip et. | Davranış > Agresif takip; gerçek yetki ve mesafe sınırı. |
| 14.06 | Kontrollü geri adım | Cepheyi düşmana dönük tutup çatışırken geri hareket et. | Hareket > Kontrollü geri adım; yönü koru, hedef mesafe. |
| 14.07 | İleri baskı | Temastaki hattı ileri taşımayı dene. | Hareket > İleri baskı; temas koşulu, gerçek hat hareketi. |
| 14.08 | Menzilli tehdide karşı korun | Uygun donanımla korunma; tüfek mermisine karşı hayali kalkan garantisi yok. | Savunma > Korun; donanım uygunluğu, sahte koruma yok. |
| 14.09 | Dengeli davranış | Özel saldırı/savunma duruşundan normal davranışa dön. | Davranış > Dengeli; özel davranıştan varsayılana dön. |
| 14.10 | Devriye | İki nokta arasında iptal edilebilir görev. | Hareket > Devriye; iki geçerli nokta seç, sıra ve iptal. |
| 14.11 | Alanı koru | Belirlenen bölgeyi savun; dost takipten farklı. | Savunma > Alanı koru; alan merkezini ve izinli sınırı seç. |
| 14.12 | Bölgeye ateş | Yalnız uygun silah ve gerçek alan atış mekanizması varsa. | Ateş > Bölgeye ateş; uygun silah ve alan hedefi. |
| 14.13 | Birliği savaştan çıkar | Taktik geri çekilmeden ayrı, kalıcı çıkış ve kampanya sonucu. | Çekilme > Savaştan çıkar; çıkış ve sonuç onayı. |
| 14.14 | At in/bin | Yalnız uygun arketip ve gerçek at yönetimi varsa. | Süvari > At in/bin; yalnız gerçek at yönetimi varsa. |
| 16.04 | Emir kuyruğunu incele/tek adımı sil | Yalnız yanlış sıradaki emri düzelt. | Emir sırası görünümü; tek adımı seç/sil, diğerleri korunur. |
| 17.02 | Birlik komutanına görev devret | Hedef ver ve ayrıntıyı komutana bırak; manuel emir öncelikli. | Komuta > Görev devret; yetki/komutan ve görev, manuel öncelik. |
| 17.03 | Keşif görevi | Belirli alanı araştır ve raporla. | Keşif > Alanı araştır; hedef alan, rapor kaynağı. |

### F alanı
| ID | İşlev | Envanter kullanım açıklaması | Önerilen erişim ve davranış |
|---|---|---|---|
| 06.01 | Hat — K/M/E | İki sıra veya uygun sıra sayısı; eski kararda savunma bonusu, değer/test açık. | Biçim > Hat; küçük şekil, önizleme, geçerli alan. |
| 06.02 | Kol — K/M/E | Dar, derin grup; eski kararda hız bonusu, değer/test açık. | Biçim > Kol; dar yerleşim önizlemesi. |
| 06.03 | Kama — K/M/E | Dolu üçgen; eski kararda ön saldırı bonusu, değer/test açık. | Biçim > Kama; uygun arketip ve gerçek slotlar. |
| 06.04 | Gevşek/Seyrek — K/M/E | Düzenli geniş aralıklı sıralar; işlev ve savaş etkisi doğrulanır. | Biçim > Seyrek; güvenli asker aralığı. |
| 06.05 | Dağınık/Avcı — K/M/E | Düzenli seyrekten farklı geometri; eski kararda menzilli hasar ve müttefik ölüm şoku azaltma. | Biçim > Avcı; seyrekten farklı gerçek yerleşim. |
| 06.06 | Çember — K/M/E | Dışa bakan askerler; boşluk/uygunluk ve etkinlik sınırı. | Biçim > Çember; dışa dönük slotlar ve alan kontrolü. |
| 06.07 | Grubun yüzünü çevirme — Ö/E | Hedef yönü belirtir; askerlerin yeni konumu/yönü. | Yön > Çevir; zeminde yön seç, onay. |
| 06.08 | Cephe genişliği ve aralık — Ö/A | Otomatik güvenli aralık varsayılan; gerekiyorsa genişlik seçimi. Piyade ve at farklı. | Boyut > Cephe/aralık; genişliği önizle, güvenli sınır. |
| 06.10 | Karma grup/çoklu grup düzeni — K/Ö/E | Grup bütünlüğü, farklı sınıf yerleşimleri, çarpışmayan hedefler; grup birleştirme/ayırma ayrı açık karar. | Karma düzen > Tür bazlı alt düzen; gerçek grup ayrımı, kimlik korunur. |
| 15.01 | Çoklu grup dizilişini kilitle | Grupların birbirine göre yerlerini koru; kendi iç dizilişlerinden ayrı. | Ortak düzen > Kilitle/aç; seçili grupların göreli yerini koru. |
| 15.02 | Geçici komuta grubu oluştur/çöz | Ortak emir ver; kalıcı asker kimliği değişmez. | Organizasyon > Geçici grup kur/çöz; gerçek GroupId değişmez. |
| 15.04 | Saf sayısını ayarla | Geniş/sığ veya dar/derin düzen; güvenli aralık sınırı. | Boyut > Saf sayısı; önizleme, geçerli genişlik/derinlik. |
| 15.05 | Kısa ileri/geri adım | Mevzide küçük düzeltme. | Manevra > Kısa adım; yön ve mesafe önizlemesi. |
| 15.06 | Küçük açılı dönüş | Yüz çevirmenin hassas çeşidi. | Yön > Küçük dönüş; gerçek açı ve çakışma kontrolü. |
| 15.07 | Kare diziliş | Çemberden farklı dört yüzlü savunma; uygunluk ve tarihsel bağlam incelenir. | Biçim > Kare; uygunluk, çemberden farklı slotlar. |
| 15.08 | Kalkan duvarı | Uygun kalkanlı birlik sıklaşır; tüm türlere sunulmaz. | Biçim > Kalkan duvarı; uygun kalkanlı askerler. |
| 15.09 | Avcı alt grubu ayır/geri birleştir | Keşif veya taciz için geçici grup; kimlik ve donanım korunur. | Organizasyon > Avcı ayır/birleştir; onaylı kimlik ve yetki sistemi. |

### T alanı
| ID | İşlev | Envanter kullanım açıklaması | Önerilen erişim ve davranış |
|---|---|---|---|
| 07.02 | Zemin hedefi ve rota — Ö/M/E | Hedef işaretle; geçilebilir konum, planlanan rota ve son yön gerçek hesapla tutarlı. | Zemin hedefi modu; tıklama onayı, gerçek rota varsa çiz, yoksa doğrultu. |
| 07.03 | Düşman hedefi — Ö/E | Yaşayan hedefin kimliği; hareket eden hedef takip politikası. | Düşman hedefi modu; gerçek yaşayan GroupId, izinli bilgi. |
| 07.04 | Hedef önizleme ve geçerlilik — Ö | Mevzi/diziliş/yön önizlemesi; alan dışı, engel, uygun olmayan emir gerekçesi. | İmleç ve hayalet yerleşim; uygun/geçersiz metin ve şekil. |
| 07.05 | İptal ve yanlış komutu düzeltme — Ö | Hedefleme modundan çık, verilmiş emri yenisiyle değiştir; geçmiş savaş sonucunu geri sarma yok. | Esc/iptal; kabul edilmemiş hedef gider, önceki emir korunur. |
| 09.05 | Harita sınırı ve güvenli çıkış — Ö/E | Geçerli çıkış, kaçış/terk sonuçları; sahne dışına rastgele hedef yok. | Geri çekilme hedefi; gerçek güvenli çıkış/harita sınırı. |
| 15.03 | Fareyle cephe çiz | Hedefleme sırasında yön ve genişliği sürükleyerek belirle; sağ tık menüsü kararı korunur. | Cephe çizme modu; sürükle, yön/genişlik önizle, bırakınca onay. |
| 15.12 | Savunma hattı çiz | Birden çok gruba ortak hat tanımla; gerçek arazi ve yerleşim kontrolü. | Savunma hattı modu; çizgi, grup slotları ve arazi doğrulaması. |
| 16.01 | Mevcut emirleri geçici göster | Hedef ve rotaları ihtiyaçta gör; sürekli çizgi yok. | İstek üzerine emir katmanı; seçili/izinli gruplar, bırakınca kapat. |
| 16.03 | Etkili ateş alanı | Silaha ve yönüne göre menzil yayı; isabet garantisi yok. | Ateş alanı isteği; gerçek silah/yön ve görüş kısıtları. |
| 16.12 | Tahmini varış | Rota, hız ve gecikmeye bağlı belirsiz tahmin. | Hedef önizlemesi; koşullu tahmini varış ve belirsizlik. |
| 18.06 | Geçersiz komut nedeni/alternatif | Gerçek sebep ve varsa çözüm; sessiz başarısızlık yok. | Geçersiz imleç yanında kısa neden, mümkün alternatif. |
| 20.02 | Hedefin geçici zemin sınırı | Saldırı hedefini yanlış gruptan ayır; yalnız hedefleme bağlamında. | Düşman hedefinin geçici zemin sınırı, hedefleme bitince kapanır. |
| 20.03 | Varışta oluşacak dizilişin hayalet önizlemesi | Hedef konum, cephe yönü ve slotları emirden önce göster. | Varış slotlarının hayalet görünümü, onay/iptalde kalkar. |
| 20.04 | Hareket yolu ile doğrudan hedef çizgisi ayrımı | Gerçek rota varsa rota; yoksa yalnız hedef doğrultusu, geçilebilir rota iddiası yok. | Hedef doğrultusu düz, gerçek hesaplı rota farklı çizim ve açıklama. |
| 20.05 | Yön ve cephe oku | Varışta hangi tarafa bakacağını belirt. | Varış yön oku; yön seçimi sırasında. |
| 20.06 | Ateş yayı ve menzil katmanı | İhtiyaç halinde menzil/yön göstergesi; gerçek silah hesabına bağlı. | Menzil/ateş yayı; istek veya hedefleme bağlamı, gerçek silah. |
| 20.12 | Hedefleme sırasında fare işaretçisi değişimi | Hareket, saldırı, uygun olmayan hedef ve iptali ayırt et. | İmleç şekli; hareket, saldırı, geçersiz ve iptal ayrımı. |
| 20.13 | Akıllı hedef bilgisi | Hedefin uygunluğu, menzil, engel ve silah uyumu; kesin kazanma garantisi veya gizli istatistik yok. | Hedef kısa açıklaması; menzil, engel, silah uyumu, kesin başarı yok. |
| 22.10 | İzin verilmeyen eylemin koşulları | Moral, donanım, menzil veya yetki nedeniyle kullanılamayan seçenek için açıklama. | Uygun olmayan komutun koşulu; menü/önizleme yanında gerçek neden. |

### B — İlgili arka plan kuralları
| ID | İşlev | Envanter kullanım açıklaması | Tasarım bağlantısı |
|---|---|---|---|
| 06.09 | Dizilişi hareket boyunca koruma — E | Aynı slot hesabı hareket ve yeniden dizilmede kullanılır; engelde bozulma ve yeniden oluşma. | Diziliş motoru; hareket/çatışma sonrası tek slot hesabı; durum 2.3. |
| 07.08 | Komut çakışması önceliği — E/Ö | Hareket/hedef, silah politikası, diziliş ve plan ayrı veri; manuel emir ile otomasyon önceliği. | Emir sözleşmesi; hareket, ateş, diziliş, plan ayrı; öncelik 2.3. |
| 09.06 | Birlikler arası fiziksel engel — M/E | Dost birimler için geçiş/boşluk; hedef gerçek rota ile uyumlu. | Fizik/rota; çakışma ve engel, gerçek neden 2.3. |

## Kapsam sonucu
76/76 birincil kayıt ayrıntılandırıldı. Her açılır yüzeyde kapanış/iptal önceki kabul edilmiş durumu korur; gerçek durum, yetki ve veri yoksa koşullu aday uygulanmış gibi gösterilmez. Şemalar yerleşim taslağı, piksel düzeyi nihai görsel değil. Oyun kodu değişmedi; açık mekanik kararları, A–J notları ve 247 kayıt korunuyor. Üçüncü aşama KISS birleştirme/eleme ayrı.
