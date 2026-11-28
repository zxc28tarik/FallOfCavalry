# Fall of Cavalry — Savaş işlevleri ana envanteri
Tarih: 28 Kasım 2026. Aşama: 1 — Oluşturma / ihtiyaç keşfi. Kullanıcı kararı: Önce savaşta gerekli bütün işlevleri, nedenlerini ve kullanımını belirle; sonra konum ve tasarım; en son KISS ile birleştir, sadeleştir ve gereksizleri çıkar. Bu belge HUD yerleşimi veya uygulama onayı değildir.

## Kaynak ve sınırlar
- FOC-Karar-Defteri-Guncel.md, özellikle §2, 20, 23–25, 28–29: önceki tasarım kararları ve açık sorular.
- foc.zip içindeki eski web projesi: js/battle/config/tacticalOrders.js, js/battle/sector/SectorManager.js, js/battle/unit/UnitGroup.js, js/battle/ui/DeployScreen.js ve js/systems/battle-morale.js, battle-counters.js, battle-rewards.js. Bu kod eski uygulama kanıtıdır; güncel HTML'ye otomatik aktarılmış sayılmaz.
- FallOfCavalry_Guncel.html: kullanıcıya teslim edilen omuz geri alma sürümü; RTSBattleEngine, RTSFormationManager, giriş/çizim ve HUD kodu. Kaynak incelemesi yapıldı, bu tur yeni oynanış testi yapılmadı.
- FOC-BATTLE-HUD-KISS-PLAN.md ve FOC-KEEP-IT-SUPER-SIMPLE.md: yeni kullanıcı kararları. Asker modelleri şimdilik tamam, değiştirilmeyecek. Sol tıkla grup seçimi, sağ tıkla Emirler/Dizilişler; kalıcı dost/düşman toplam asker sayacı ve birlik üstü simgeler reddedildi. Bu işlev envanteri onları geri getirmez. Sayı verisinin savaş hazırlığı/sonucu veya isteğe bağlı bilgi için tutulması kalıcı sayaç değildir.
- Kapsam savaş öncesi hazırlık, aktif ve pasif sektörlerin savaşı, sonuç ve kampanyaya dönüş. Dünya haritasının genel ekonomi/diplomasi HUD'u bu paketin dışında. Kuşatma/özel savaş tipi ancak kapsamı onaylanırsa koşullu.

## Durum anahtarı ve kullanım sözleşmesi
K: Önceki karar defterinde kesin tasarım kararı; güncel kodda hazır olduğu anlamına gelmez.
M: Güncel HTML'de ilgili altyapı var; tam mekanik doğrulaması değildir.
E: Güncel HTML'de eksik/çakışan davranış veya yalnız kısmi karşılık.
Ö: Yeni öneri; kullanıcı tarafından ayrıntısı henüz onaylanmadı.
A: Açık mekanik/kural, doğrulama veya kapsam kararı gerekir.
Her satır bağımsız işlev adayıdır. Her işlevin amacı, oyuncu eylemi ve algılanabilir sonucu yazılır. Kalıcı bir UI elemanı anlamına gelmez. Otomatik mekaniklerde oyuncu doğrudan komut vermek zorunda değildir; gerektiğinde sebep ve sonuç öğrenilebilir. Gerçekten mevcut olmayan bir durum gösterilmez.

## 01 — Karşılaşma ve savaş hazırlığı (8)
| ID | İşlev / durum | Neden gerekli | Oyuncu kullanımı ve geri bildirim |
|---|---|---|---|
| 01.01 | Savaşın nedeni ve tarafları — K/Ö | Hangi karşılaşmaya neden girildiği | Savaş öncesi amaç, taraf, yer ve bilinen tehdit; yanlış karşılaşma olmasın. |
| 01.02 | Savaş hedefi ve bitiş koşulu — Ö/A | Ne yaparsa kazanacağını bilsin | Hedefi inceler; yok etme, bozgun, savunma vb. yalnız gerçek savaş kuralına göre açıklanır. |
| 01.03 | Kendi ordusunun mevcudu ve bileşimi — K/M | Hazırlıkta doğru güç dağılımı | Grup türleri, adet, hazır/yaralı/yedek ayrımı; savaş sırasında kalıcı toplam sayaç yok. |
| 01.04 | Bilinen düşman gücü — Ö/A | Kör karar verme ve haksız tam bilgi önlensin | Keşif/rapora göre kesin, tahmini veya bilinmiyor; rakip gizli bilgi açığa çıkmaz. |
| 01.05 | Araziyi keşfetme — Ö | Konuşlanma avantajını değerlendirmek | Kamerayla alanı inceler; gerçek geçit, engel, zemin, yükseklik etkisini öğrenir. |
| 01.06 | Başlangıçtaki silah ve erzak durumu — K/A | Kullanılamayacak emirleri önceden anlamak | Grup ekipmanı, mühimmat/erzak varsa başlangıç durumunu görür; kalıcı loadout yeniden atılmaz. |
| 01.07 | Çatışmaya girme veya vazgeçme — Ö/A | Geri dönülemez eylemi yanlışlıkla başlatmamak | Başlat veya mevcut encounter kuralları izin veriyorsa çekil; gerçek sonucu önce bilir. |
| 01.08 | Hazır olma ve geçiş — K/M/E | Deploy ayrı oyun aşamasıdır | Eksik atamaları kontrol eder, savaşı başlatır; yerleşim ve kimlikler simülasyona aktarılır. |

## 02 — Konuşlanma, sektör ve komuta ataması (9)
| ID | İşlev / durum | Neden | Kullanım ve sonuç |
|---|---|---|---|
| 02.01 | Sektör sayısı — K/A | Büyük orduları yönetmek | Asker/300 önerisi ve izinli aralık; sayıyı değiştirir, dağılımı görür. Eski kod 12 üst sınırı kullanır; nihai kural değildir. |
| 02.02 | Sektöre grup atama — K/E | Birliklerin nerede savaşacağını belirlemek | Grup seçip sektör belirtir; tekrar atama çakışmaz, tüm gruplar muhafaza edilir. |
| 02.03 | Başlangıç mevzisi — K/Ö | Savaş planının coğrafi temeli | Sol uç/iç/merkez, merkez, sağ iç/merkez/uç, arka hat/yedek; gerçek yerleşim alanı ve sınırı. |
| 02.04 | Başlangıç yönü ve dizilişi — K/Ö | Düşmana dönük ve hazır başlamak | Grubun yerini/yönünü/dizilişini belirler; geçersiz çakışma uyarısı. |
| 02.05 | Yedek atama — K/M/E | İhtiyaç anında kuvvet saklama | Otomatik görsel kapasite yedeği ile taktik yedeği ayır; oyuncu hangi grubun beklediğini bilir. |
| 02.06 | Ordu komutanı — K/E | Genel komuta ve organizasyon | Uygun karakter atanır; yetki, deneyim, yokluk gerekçesi. |
| 02.07 | Sektör komutanı — K/E | Oyuncu bakmadığında yönetim | Atanmış komutan ve verilen görev; boşluk/ulaşılamaz kişi uyarısı. |
| 02.08 | Birlik lideri, keşif/rapor ve moral taşıyıcı — K/A | Komuta ve rapor kaynağı | İlgili rollere uygun kişiyi seçer; gerçek mekanik ve yetki açık. |
| 02.09 | Konuşlanmayı değiştirme/geri alma — Ö | Yanlış yerleştirmeyi savaş başlamadan düzeltmek | Önceki atamaya dönme, otomatik öneri, geçerli yerleşim kontrolü; oyuncu onayı olmadan tüm düzen değişmez. |

## 03 — Kamera, harita ve grup seçimi (9)
| ID | İşlev / durum | Neden | Kullanım ve sonuç |
|---|---|---|---|
| 03.01 | Kamera hareketi — M | Alanı incelemek | Fare/klavye ile kaydırma, tutarlı yönler. |
| 03.02 | Yakınlaştırma ve döndürme — M | Yakın gözlem ve geniş bakış | Kamera ayarı ve sınırları; emir seçimiyle çakışmaz. |
| 03.03 | Gruba odaklanma — M/Ö | Kaybolan birliği hızlı bulmak | Seçili grup veya kayıtlı gruba odaklanır. |
| 03.04 | Tek grup seçme — K/E | Kontrolün temel birimi grup olmalı | Askerine sol tıkla yaşayan grubun tamamını seç; sınır/işaret yalnız seçiliyken. |
| 03.05 | Birden fazla grup seçme — Ö/E | Koordineli hareket | Ekle/çıkar veya kutu seçimi; grup kimliği korunur, tek tek asker yanlışlıkla ayrılmaz. |
| 03.06 | Seçimi temizleme — Ö/M | Yanlış emri engellemek | Boş zemin/Esc gibi açık yöntem; hedefleme iptali ile seçim iptali ayrılır. |
| 03.07 | Kontrol grupları — M/E | Sık kullanılan gruplara dönüş | 1–9 atama/çağırma; sektör değişiminde yaşayan grup kimlikleri geçerli. |
| 03.08 | Birlik türüne göre bulma/seçme — Ö | Tüfekli, süvari, piyade aramayı azaltmak | İsteğe bağlı kısayol; karma gruplarda gerçek kabiliyet üzerinden seçer. |
| 03.09 | Düşmanı inceleme ve yanlış seçimi engelleme — Ö/E | Düşmana kendi emri verilmesin | Yalnız izinli bilgi; yaşayan dost seçimi ve düşman hedeflemesi farklı eylemdir. |

## 04 — Temel emirler (9)
| ID | İşlev / durum | Neden | Kullanım ve sonuç |
|---|---|---|---|
| 04.01 | İlerle — M/E | Konum değiştirmek | Grup > sağ tık > Emirler > İlerle > zemin hedefi; hedef geçerli ve diziliş korunur. |
| 04.02 | Saldır/Odaklan — K/E | Belirli rakibi önceliklendirmek | Düşman grubunu belirtir; menzilli/temas davranışı uygun silaha göre; hedef ölürse yeniden karar veya tamamlandı. Focus eski kararı ayrı davranış gerektiriyorsa korunur. |
| 04.03 | Konumu koru — K/M/E | Mevziyi savunmak | Mevcut/istenen konumu tutar; uzaklaşmaz, izin verilen silahla savunur. |
| 04.04 | Saldırarak ilerle — M/E | Hedefe giderken tehdide karşılık vermek | Zemin hedefi; engel/çatışma sonrasında yoluna devam eder. |
| 04.05 | Geri çekil — K/M/E | Birliği savaştan kurtarmak | Güvenli yön veya hedef; düşmana doğru sabit koordinat hatası olmaz; takip/bozgun riski gerçek. |
| 04.06 | Toplan — M/E | Dağılmış grubu yeniden düzenlemek | Erişilebilir toplanma noktası; başka grup içine ışınlanmaz. |
| 04.07 | Taciz et, uzaktan vur — K/E | Hafif ve menzilli grupların rolü | Hedef/alan belirtir; menzile yaklaş, mesafeyi koru ve gerektiğinde uzaklaş; silah koşulu. |
| 04.08 | Dur/emri iptal et — Ö | Yanlış emri durdurmak | Yalnız seçilen grubun aktif hareket/hedefi kesilir; önceki pasif savunma politikası korunur. |
| 04.09 | Takip veya destek — Ö/A | Bir grubu koruyarak hareket etmek | Dost grubu belirtir; uzaklık sınırı ve hedef kaybı davranışı; gerekiyorsa ayrı emir değil mevcut emir kombinasyonu. |

## 05 — Silaha ve birim rolüne bağlı emirler (10)
| ID | İşlev / durum | Neden | Kullanım ve sonuç |
|---|---|---|---|
| 05.01 | Mesafeden tut — K/E | Menzilli avantajı korumak | Uygun silahı seçer, yaklaşan düşmandan kaçınır; silahsız gruba sunulmaz. |
| 05.02 | Yakın savaşa hazırlan — K/E | Yan silahı doğru anda kullanmak | Kılıç/pala/yatağan, mızrak vb. gerçek loadout'a göre seçilir. |
| 05.03 | Serbest ateş — K/M/E | Menzile giren tehdide otomatik tepki | Ateş politikası; hareket emrini ezmez. Mühimmat ve silah uygunsa. |
| 05.04 | Ateşi kes — M/E | Mühimmat saklamak/ateşi ertelemek | Yalnız ateş politikası değişir, yürüyüş kesilmez; yakın savunma kuralı ayrıca belirlenir. |
| 05.05 | Toplu ateş — Ö/A | Tüfekli grubun ortak atış zamanlaması | Hazır silah oranı/gerçek atış; şimdilik mekanik önerisi. |
| 05.06 | At-geri çekil — K/E | Atlı menzilli/hafif grupların hareketli savaşı | Ateş et, yaklaşan düşmandan geri çekil; yol/menzil/uygun silah koşulu. |
| 05.07 | Süvari karşıtı mızrak — K/M/E | Hücuma karşı uygun mevzi | Mızrak/pike donanımı ve durma koşulu; hazır değilse neden. |
| 05.08 | Süvari hücumu — M/E/Ö | Hızla yapılan hücumu normal temastan ayırmak | Uygun atlı, hedef ve yaklaşma mesafesi; gerçek hız/hazır olma, karşı mızrak riski. |
| 05.09 | Hücumdan ayrıl, yeniden toplan — Ö | Süvarinin düşman içinde sıkışmaması | Güvenli çıkış hedefi; mevcut geri çekil/toplan ile birleştirilebilir. |
| 05.10 | Özel ekipman kullanımı — K/A | Humbaracı gibi farklı yüklerin anlamı | Özel ekipman gerçekten varsa hedef/menzil, kullanım ve kalan kaynak; olmayan topçu/özel mekanik gösterilmez. |

## 06 — Diziliş ve grup manevrası (10)
| ID | İşlev / durum | Neden | Kullanım ve sonuç |
|---|---|---|---|
| 06.01 | Hat — K/M/E | Geniş cephe, savunma | İki sıra veya uygun sıra sayısı; eski kararda savunma bonusu, değer/test açık. |
| 06.02 | Kol — K/M/E | İntikal ve dar geçiş | Dar, derin grup; eski kararda hız bonusu, değer/test açık. |
| 06.03 | Kama — K/M/E | İleri yönlü yoğun hücum | Dolu üçgen; eski kararda ön saldırı bonusu, değer/test açık. |
| 06.04 | Gevşek/Seyrek — K/M/E | Askerler arasında mesafe | Düzenli geniş aralıklı sıralar; işlev ve savaş etkisi doğrulanır. |
| 06.05 | Dağınık/Avcı — K/M/E | Menzilli tehdide karşı yayılma | Düzenli seyrekten farklı geometri; eski kararda menzilli hasar ve müttefik ölüm şoku azaltma. |
| 06.06 | Çember — K/M/E | Çevreden tehdit | Dışa bakan askerler; boşluk/uygunluk ve etkinlik sınırı. |
| 06.07 | Grubun yüzünü çevirme — Ö/E | Arka/kanat saldırısına maruz kalmamak | Hedef yönü belirtir; askerlerin yeni konumu/yönü. |
| 06.08 | Cephe genişliği ve aralık — Ö/A | Farklı grup büyüklüklerine uyum | Otomatik güvenli aralık varsayılan; gerekiyorsa genişlik seçimi. Piyade ve at farklı. |
| 06.09 | Dizilişi hareket boyunca koruma — E | Seçilen diziliş dekor olmasın | Aynı slot hesabı hareket ve yeniden dizilmede kullanılır; engelde bozulma ve yeniden oluşma. |
| 06.10 | Karma grup/çoklu grup düzeni — K/Ö/E | Farklı hız ve ekipman | Grup bütünlüğü, farklı sınıf yerleşimleri, çarpışmayan hedefler; grup birleştirme/ayırma ayrı açık karar. |

## 07 — Emir akışı ve hedefleme (9)
| ID | İşlev / durum | Neden | Kullanım ve sonuç |
|---|---|---|---|
| 07.01 | Sağ tık bağlamsal kontrol — kullanıcı kararı/E | Grup üzerinden doğrudan yönetim | Seçili grup > Emirler veya Dizilişler; ateş alt emir, strateji ayrı. |
| 07.02 | Zemin hedefi ve rota — Ö/M/E | Nerede duracağını bilmek | Hedef işaretle; geçilebilir konum, planlanan rota ve son yön gerçek hesapla tutarlı. |
| 07.03 | Düşman hedefi — Ö/E | En yakın rakip yerine seçilen rakip | Yaşayan hedefin kimliği; hareket eden hedef takip politikası. |
| 07.04 | Hedef önizleme ve geçerlilik — Ö | Yanlış emir öncesi sonucu görmek | Mevzi/diziliş/yön önizlemesi; alan dışı, engel, uygun olmayan emir gerekçesi. |
| 07.05 | İptal ve yanlış komutu düzeltme — Ö | Hedefleme tuzağından çıkmak | Hedefleme modundan çık, verilmiş emri yenisiyle değiştir; geçmiş savaş sonucunu geri sarma yok. |
| 07.06 | Emir durumu — Ö/E | Verilen ile gerçekleşen ayrı | Hazırlanıyor, iletildi, ilerliyor, çatışıyor, engellendi, ulaştı, tamamlandı/iptal; gerekçeli. |
| 07.07 | Emir sırası — Ö/A | Ardışık hareketler | İsteğe bağlı kuyruk ve değiştirme; aynı hedefte çakışan emir yok. |
| 07.08 | Komut çakışması önceliği — E/Ö | Ateşi kes ve hareket birbirini ezmesin | Hareket/hedef, silah politikası, diziliş ve plan ayrı veri; manuel emir ile otomasyon önceliği. |
| 07.09 | Kısayol ve geri bildirim — M/Ö | Hızlı ama güvenilir yönetim | Fare, klavye ve izinli harita etkileşimi aynı komut yoluna gider; ses/görsel yalnız gerçek kabulde. |

## 08 — Birlik durumu ve savaş hesabı (10)
| ID | İşlev / durum | Neden | Kullanım ve sonuç |
|---|---|---|---|
| 08.01 | Grup kimliği ve mevcut savaşçılar — K/M/E | Ne seçildiğini anlamak | İsteğe bağlı tür, yaşayan/aktif/yedek ve kayıp ayrımı; karma grup doğru adlandırılır. Kalıcı sayaç/simge yok. |
| 08.02 | Sağlık ve kayıp durumu — K/M | Grubun savaşabilirliği | Yaralı/ölü ayrımı varsa doğru göster; prototip hp/ölüm ile sınırlı. |
| 08.03 | Moral — K/E | Askerin emre niye uymadığını anlamak | Hasar, müttefik ölümü, sayı baskısı, arkadan/kanattan saldırı, süvari hücumu, komutan, açlık/erzak, geri çekilme/bozgun. Sebep gerçek olaydan alınır. |
| 08.04 | Sarsılma, kaçma, bozgun — K/E/A | Düzenin kontrol kaybı | Durum ve nedeni; oyuncunun hangi emirleri verebildiği ve toparlanma koşulu. Eşikler açık. |
| 08.05 | Silah ve aktif ekipman — K/E | Emirlerin donanıma bağlı olması | Kalıcı loadout ve aktif silah değişimini öğrenir; gerçek silah yoksa komut yok. |
| 08.06 | Menzil ve görüş hattı — M/E | Niye ateş etmediğini anlamak | Hedef menzilde/engel arkasında mı; yalnız gerçek hesap. |
| 08.07 | Mühimmat ve doldurma — K/A/E | Ateş kesmenin anlamı | Kalan kaynak ve dolduruyor/ateşe hazır durumları; tüketim ve doldurma sistemi tamamlanmadan sayı uydurulmaz. |
| 08.08 | Zırh ve karşılaşma uyumu — K/M/E | Mızrak-süvari vb. farklı roller | Uygun olmayan çatışmanın nedenini öğrenir; kesin hasar/koruma değerleri ayrı denge kararı. |
| 08.09 | Hız, yorgunluk ve hücum hazırlığı — M/Ö/A | Birliğin yetişememesi veya hücum edememesi | Hız/yorgunluk varsa gerçek state; yorgunluk ve ağırlık etkileri açık, HUD için icat edilmez. |
| 08.10 | Sıkışma, diziliş bozulması ve yeniden oluşma — M/E | Hedef gerçekleşmiyor gibi görünmesin | Engel/çatışma sebebi ve varsa çözüm; öldürülen askerlerin yerleri gerçek grup içi düzenle güncellenir. |

## 09 — Arazi ve savaş alanı (7)
| ID | İşlev / durum | Neden | Kullanım ve sonuç |
|---|---|---|---|
| 09.01 | Yükseklik — M/E | Mevzi tercihi | Gerçek sahne yüksekliği ve savaş hesabı eşleşir; sentetik koordinat bonusu oyuncuya gerçek topoğrafya diye gösterilmez. |
| 09.02 | Yol, açık alan, engebe — M/E | Hız ve hareket | Geçilebilirlik ve gerçek hız etkisi; oyuncu uygun rotayı seçer. |
| 09.03 | Orman ve görüş — Ö/A | Gizlenme/ateş hattı varsa | Görüş ve gizlilik kuralı varsa açıklanır; yoksa dekor. |
| 09.04 | Nehir, köprü, geçit — Ö/A | Doğal engeller | Kullanılabilir geçişi ve sınırları seçer; harita destekliyorsa. |
| 09.05 | Harita sınırı ve güvenli çıkış — Ö/E | Geri çekilmeyi anlamlı kılmak | Geçerli çıkış, kaçış/terk sonuçları; sahne dışına rastgele hedef yok. |
| 09.06 | Birlikler arası fiziksel engel — M/E | Çakışma ve yığılmayı önlemek | Dost birimler için geçiş/boşluk; hedef gerçek rota ile uyumlu. |
| 09.07 | Kuşatma ve özel savaş hedefleri — Ö/A | Harita türleri farklı olabilir | Yalnız onaylı kuşatma/topçu/kapı/sur mekanikleri varsa ilgili etkileşim; şu an kapsam varsayımı değil. |

## 10 — Çok sektörlü savaş, yedekler ve strateji (11)
| ID | İşlev / durum | Neden | Kullanım ve sonuç |
|---|---|---|---|
| 10.01 | Aktif sektör seçme/değiştirme — K/M/E | Aynı anda tek görünür savaş alanı | Sektöre geçer; mevcut seçimi ve emirleri kaybolmaz, geçiş süresi açık. |
| 10.02 | Diğer sektörlerin simülasyonu — K/E | Oyuncunun bakmadığı savaş sürmeli | Durum değişimleri özetlenir; eski/pasif simülasyon ile aktif simülasyon tutarlı. |
| 10.03 | Sektör raporu — K/Ö/E | Komuta kararına ihtiyaç | Son bilinen durum, rapor zamanı, kaynak ve belirsizlik; gizli kesin istatistik yok. |
| 10.04 | Haberci ve emir gecikmesi — K/A/E | Uzak sektöre anında kusursuz kontrol olmamalı | Emir gönderildi/yolda/ulaştı; gecikme formülü ve iptal kuralı açık. |
| 10.05 | Komutanın yetkisi ve görevleri — K/A/E | Sektörün özerkliği | Tut, ilerle, çekil gibi görev sınırı; oyuncu müdahale edince yetki devri açık. |
| 10.06 | Komutan kaybı — K/A/E | Lider ölüm/esaretinin sonucu | Kayıp haberi, halef veya komuta boşluğu, etkisi; keyfi ceza yok. |
| 10.07 | Yedeklerin otomatik tamamlaması — M/E | Görsel asker sınırı ile büyük ordular | Gerçek grup kimliği korunur; farklı gruptan asker yanlışlıkla ölenin yerini almaz. |
| 10.08 | Taktik yedekleri savaşa sokma — Ö/A | Oyuncunun sakladığı kuvveti kullanması | Yedek grubu, sektör/konum ve geliş süresi; otomatik kapasite yedeğiyle karıştırılmaz. |
| 10.09 | Sektörler arası kuvvet aktarımı — Ö/A | Kritik sektörü desteklemek | Gönderen ve alan sektör, yol/gecikme/tehlike; teleport yok, kapsam onayı. |
| 10.10 | Genel strateji — Ö/A | Birkaç grubu koordine etmek | Serbest yönetim, dengeli ilerleme, savunma, kanattan saldırı; gerçek rol, hedef ve emirleri önceden görür, onaylar. Grup sağ tık menüsüne eklenmez. |
| 10.11 | Stratejiden çıkma ve manuel müdahale — Ö/A | Otomasyon oyuncu kontrolünü ezmesin | Seçili grubun planı devralınır; diğer gruplar etkilenmez; bütün planı iptal etmek ayrı açık eylem. |

## 11 — Bilgi, savaş kontrolü, öğrenme ve erişilebilirlik (10)
| ID | İşlev / durum | Neden | Kullanım ve sonuç |
|---|---|---|---|
| 11.01 | Mini harita/alan yönelimi — M/Ö | Büyük savaşta konumu bulma | İsteğe bağlı alan görünümü; konum ve kamera ilişkisi; yanlış ölçek/konum düzeltilir. Kalıcı olup olmayacağı tasarım aşamasında. |
| 11.02 | Önemli olay bildirimi — Ö/E | Görülmeyen kritik olayları kaçırmamak | Bozgun, komutan kaybı, ulaşılamayan emir, sektör tehlikesi; tekrarlar gruplanır, olay kaynağına gidilebilir. |
| 11.03 | Seçili grup açıklaması — Ö/E | Ne işe yaradığını öğrenmek | İhtiyaçta grup türü, mevcut davranış, seçilen diziliş, desteklenen emir ve sebepler. Kalıcı birlik üstü simge yok. |
| 11.04 | Duraklat/devam — M/E | Düşünme ve ara verme | Gerçek simülasyon durumu; pasif sektörlerin ve zamanın da ne yaptığı belirli. Duraklatmada emir verme kuralı açık. |
| 11.05 | Savaş hızı — Ö/A | Uzun intikal veya hızlı çatışma | Ancak tüm sektörlerde zaman tutarlılığı sağlanırsa; hız değiştirme durumu anlaşılır. |
| 11.06 | Ayarlar ve kontrol yardımı — M/Ö | Kontrol, kamera, ses, görsel erişilebilirlik | Oyuncu ihtiyaç duyduğunda ayarlar/kısayollar; menü açılması savaş kontrolünü bozmaz. |
| 11.07 | İlk kullanım öğretimi — Ö | Oyuncu ilk gördüğünde anlasın | Kısa görev: grup seç, emir, hedef, diziliş, iptal; isteğe bağlı tekrar. |
| 11.08 | Ses, renk ve metin erişilebilirliği — Ö | Renk körlüğü, sessiz oyun, okunabilirlik | Önemli bilgi yalnız renk veya sesle verilmez; ölçek, kontrast, metin. |
| 11.09 | Savaştan ayrılma/yeniden başlatma — M/Ö/A | Gerçek kayıp ve test işlemi ayrımı | Kampanya geri çekilme sonucu ile test yeniden başlatma farklı; yanlışlıkla ilerleme kaybı yok. |
| 11.10 | Gerçek veri ve açıklama — E/Ö | Güvenilirlik | Kayıp, süre, durum, emir yalnız simülasyondan; hatalı/sahte durum gösterilmez. Oyuncu dost/düşman toplam sayacı istemiyor; veri arka planda tutulabilir. |

## 12 — Savaş sonu ve kampanya bağlantısı (9)
| ID | İşlev / durum | Neden | Kullanım ve sonuç |
|---|---|---|---|
| 12.01 | Zafer/yenilgi/çekilme ve sebep — K/M/E | Savaş niye bitti | Gerçek hedef ve bütün sektörler; mevcut <=10 eşik prototip kuralı nihai tasarım değil. |
| 12.02 | Sektörlere göre sonuç — K/E | Bir cephede yenilip diğerinde kazanma ihtimali | Özet ve ihtiyaçta ayrıntı; pasif ve aktif sonuçlar birlikte. |
| 12.03 | Kayıp, sağ kalan, yaralı — K/E | Ordunun sonraki gücünü bilmek | Ölüm/yaralı/esir/kaçan ayrımı; sayıların toplamı tutarlı. |
| 12.04 | Esirler ve kaderi — K/A/E | RPG/diplomasi bağı | Fidye/takas/serbest/hapis seçenekleri ilgili sistem izin verirse; zorla taraf değiştirme yok. |
| 12.05 | Karakter sonucu ve komuta boşluğu — K/E | Önemli kişiler kalıcıdır | Yaralanma/esaret/ölüm ve görev boşluğu, aile/hizip/diplomasi sonuçları. |
| 12.06 | Ganimet, altın ve mal — K/E | Savaşın ekonomik sonucu | Elde edilen kaynak ve gerçek envanter aktarımı; tekrar ödül alınamaz. |
| 12.07 | Nam, deneyim ve savaş skoru — K/E | İlerleme ve stratejik etkiler | Değişim, neden ve bağlantılı sistem; tecrübeli askerin karaktere dönüşmesi açık karar. |
| 12.08 | Savaş sonrası ordu durumu — K/Ö/E | Kalan grupla devam etmek | Kalıcı asker kimliği, loadout, yaralı ve yedekler; geri dönünce grup yapısı bozulmaz. |
| 12.09 | Kampanyaya dönüş ve kayıt — K/Ö/E | Savaş sonucunun gerçek dünyaya yansıması | Sonucu onayla/geri dön; kayıt tutarlılığı, tekrar işlem yok. |

## Güncel HTML'de öncelikli gerçek işlev eksikleri
- 2 diziliş motoru farklı kama/dağınık geometrisi üretiyor; hareket emri sabit grid kullanıyor.
- applyOrderToSelected / applyFormationToSelected önce metni değiştiriyor, sonra seçim doğruluyor.
- Seçim tekil asker kimlikleri üzerinden yürüyebiliyor; grup tabanlı otoriter emir şartı.
- Saldır emri belirli düşman grubu seçimini sağlamıyor; updateCombat en yakın hedefi buluyor. Bazı emir anahtarlarının adı var ancak davranış eksik.
- hold_fire hareketi kesiyor; retreat sabit x-14, regroup x=0. Bu gerçek güvenli yön/toplanma merkezi değildir.
- Aktif sektörde ilk 150 dışındakiler reserve; ölümde ilk bulunan yedek grubu fark etmeksizin devreye alınıyor. Taktik yedek ve görsel sınır ayrılmalı.
- updateCombat/checkBattleOutcome aktif sektör istatistikleriyle <=10 bitiş eşiği kullanıyor; bütün savaşın hedefleri ve sektör sonuçlarıyla uyumu gerekli.
- Aktif 3D savaş motorunda moral/mühimmat tüketimi ve komutan/haberci sistemi hazır kabul edilemez. Eski web kodunda moral ve taktik emir tanımları var.
- Arazi hızı ve yükseklik fonksiyonları koordinat formülleri içeriyor; gerçek sahne geometrisiyle tutarlılığı doğrulanmalı.
- Kalıcı asker sayaçları ve birlik üstü simgeleri tasarımda reddedildi; mevcut prototipten kaldırma aşaması daha sonra.

## Açık kararlar (yerleşim aşamasına taşınır)
1. Nihai sektör sayısı/sınırı, görünür asker kapasitesi, sektör geçiş zamanı ve pasif simülasyon ayrıntısı.
2. Emir gecikmesi/komuta menzili ve haberci; hangi emirler anında, hangileri rapora bağlı.
3. Birlik boyutu yaklaşık 30; grup ayrılabilir/birleşebilir mi, karma grubun emir uygunluğu.
4. Moral eşikleri/toparlanma/bozgun ve komutan kaybı etkisi; kesin silah ve formasyon katsayıları.
5. Mühimmat/doldurma, yorgunluk, görüş hattı ve arazi etkisinin kapsamı.
6. Hazır strateji yetkisi, taktik yedek ve sektör transferi; kuşatma/özel hedef kapsamı.
7. Duraklatma sırasında emir, hız seçenekleri, kampanya savaşı terk etmenin sonucu.
8. Oyuncunun ihtiyaç duyduğunda hangi gerçek bilgiyi görebileceği; düşman hakkında kesin/tahmini/bilinmeyen ayrımı.

## Bir sonraki aşamanın teslimi (henüz yapılmayacak)
Her envanter satırı: tetikleyici, bağlam, kullanıcı eylemi, giriş verisi, gerçek durum, sonuç, hata/iptal ve aday etkileşim yüzeyi ile eşleştirilir. Savaş öncesi, savaş sırasında, sektör değişiminde ve savaş sonrasında kullanım senaryoları oluşturulur. Daha sonra konum/etkileşim tasarımı ve görsel örnekler. Son aşamada KISS: tekrarları birleştir, kalıcı görünürlüğü en aza indir, gerekçesi olmayan işlevi çıkar; kullanıcının önceki açık retlerini koru. Bu aşamada hiçbir satır sırf HUD'da yer kaplar diye silinmez. Yeni mekanik veya kod uygulanmadı; tüm Ö/A maddeleri inceleme adaylarıdır.

## 28 Kasım 2026 — Diğer RTS oyunlarından ek adaylar

Her madde Ö/A: yeni öneri veya mevcut maddenin ayrıntısı. Kaynak oyun davranışı ile FOC uyarlaması ayrıdır. Tuşlar referans örneğidir, FOC için atanmış değildir. Önce işlev, sonra yerleşim, en son KISS. Sağ tık menüsü, kalıcı sayaç/simge retleri ve asker modellerini koruma kararları geçerlidir.

### 13 — Seçim ve kamera
| ID | Aday | Referans | FOC amacı ve kullanım mantığı |
|---|---|---|---|
| 13.01 | Tüm orduyu seç | Rome II Ctrl+A | Aktif sektörde yönetilebilir grupları birlikte seç; diğer sektörleri yanlışlıkla dahil etme. |
| 13.02 | Önceki/sonraki grup | Shogun 2 virgül/nokta | Yaşayan dost grupları sırayla bul. |
| 13.03 | Karma seçimde türler arası geçiş | AoE IV Tab | Seçimi kaybetmeden ilgili türün emirlerini kullan. |
| 13.04 | Görünür aynı tür grupları seç | AoE IV | Kamera alanındaki aynı türleri seç; tüm ordu seçimiyle karışmasın. |
| 13.05 | Emirsiz birlikleri bul | AoE IV | Görevsiz grupları bul; kasıtlı savunma boşta sayılmaz. |
| 13.06 | Hızlı kamera kaydırma | Rome II Shift+WASD | Uzak bölgeye hızlı git. |
| 13.07 | Kamera yönünü sıfırla | Shogun 2 | Alışılmış bakışa dön. |
| 13.08 | Taktik genel görünüm | Rome II | Aktif alanı üstten incele; yalnız izinli bilgi. |
| 13.09 | Kamera noktası kaydet | FOC önerisi | Sık denetlenen mevzilere dön. |
| 13.10 | Son olaya odaklan | FOC önerisi | Bildirim kaynağına git; pasif sektör rapor zamanı korunur. |

### 14 — Emir ve davranış
| ID | Aday | Referans | FOC amacı ve kullanım mantığı |
|---|---|---|---|
| 14.01 | Yürü/koş | Shogun 2 R, Manor Lords | Hız ve yorgunluk tercihi; at için uygun tempo. |
| 14.02 | Düzenli yaklaş / doğrudan hücum | Bannerlord | Düzeni koruyarak yaklaşma ile hızlı teması ayır. |
| 14.03 | Takibi kes | Shogun 2 guard | Kaçan düşmanı kovalamayıp mevziyi koru. |
| 14.04 | Sınırlı karşılık | Stronghold | Yakın tehdide kısa mesafede karşılık ver ve dön. |
| 14.05 | Agresif takip | Stronghold | Uygun düşmanı daha geniş alanda takip et. |
| 14.06 | Kontrollü geri adım | Manor Lords | Cepheyi düşmana dönük tutup çatışırken geri hareket et. |
| 14.07 | İleri baskı | Manor Lords | Temastaki hattı ileri taşımayı dene. |
| 14.08 | Menzilli tehdide karşı korun | Manor Lords | Uygun donanımla korunma; tüfek mermisine karşı hayali kalkan garantisi yok. |
| 14.09 | Dengeli davranış | Manor Lords | Özel saldırı/savunma duruşundan normal davranışa dön. |
| 14.10 | Devriye | Stronghold | İki nokta arasında iptal edilebilir görev. |
| 14.11 | Alanı koru | Stronghold uyarlaması | Belirlenen bölgeyi savun; dost takipten farklı. |
| 14.12 | Bölgeye ateş | FOC önerisi | Yalnız uygun silah ve gerçek alan atış mekanizması varsa. |
| 14.13 | Birliği savaştan çıkar | Shogun 2 withdraw | Taktik geri çekilmeden ayrı, kalıcı çıkış ve kampanya sonucu. |
| 14.14 | At in/bin | Ultimate General | Yalnız uygun arketip ve gerçek at yönetimi varsa. |

### 15 — Diziliş ve organizasyon
| ID | Aday | Referans | FOC amacı ve kullanım mantığı |
|---|---|---|---|
| 15.01 | Çoklu grup dizilişini kilitle | Rome II/Shogun 2 Ctrl+G | Grupların birbirine göre yerlerini koru; kendi iç dizilişlerinden ayrı. |
| 15.02 | Geçici komuta grubu oluştur/çöz | Shogun 2 G | Ortak emir ver; kalıcı asker kimliği değişmez. |
| 15.03 | Fareyle cephe çiz | Rome II | Hedefleme sırasında yön ve genişliği sürükleyerek belirle; sağ tık menüsü kararı korunur. |
| 15.04 | Saf sayısını ayarla | Shogun 2 | Geniş/sığ veya dar/derin düzen; güvenli aralık sınırı. |
| 15.05 | Kısa ileri/geri adım | Shogun 2 | Mevzide küçük düzeltme. |
| 15.06 | Küçük açılı dönüş | Shogun 2 | Yüz çevirmenin hassas çeşidi. |
| 15.07 | Kare diziliş | FOC dönem uyarlaması | Çemberden farklı dört yüzlü savunma; uygunluk ve tarihsel bağlam incelenir. |
| 15.08 | Kalkan duvarı | Bannerlord | Uygun kalkanlı birlik sıklaşır; tüm türlere sunulmaz. |
| 15.09 | Avcı alt grubu ayır/geri birleştir | Ultimate General | Keşif veya taciz için geçici grup; kimlik ve donanım korunur. |
| 15.10 | Eksilen safları tamamla | Cossacks 3 | Uygun yedeklerle gerçek takviye; görsel kapasiteden ayrı. |
| 15.11 | Üst komuta grubu oluştur | Ultimate General | Birden fazla grubu tek görev altında yönet; kalıcı askerleri karıştırma. |
| 15.12 | Savunma hattı çiz | Ultimate General | Birden çok gruba ortak hat tanımla; gerçek arazi ve yerleşim kontrolü. |

### 16 — Bilgi ve öngörü
| ID | Aday | Referans | FOC amacı ve kullanım mantığı |
|---|---|---|---|
| 16.01 | Mevcut emirleri geçici göster | Rome II Space/WARNO Shift | Hedef ve rotaları ihtiyaçta gör; sürekli çizgi yok. |
| 16.02 | Görüş hattını konumdan ölç | WARNO C | İşaretlenen mevzinin görülebilir alanı; gerçek görüş hesabı gerekli. |
| 16.03 | Etkili ateş alanı | Napoleon uyarlaması | Silaha ve yönüne göre menzil yayı; isabet garantisi yok. |
| 16.04 | Emir kuyruğunu incele/tek adımı sil | CoH3 uyarlaması | Yalnız yanlış sıradaki emri düzelt. |
| 16.05 | Yorgunluk nedeni ve dinlenme | Manor Lords | Koşu, donanım, savaş ve dinlenmenin gerçek etkileri. |
| 16.06 | Etkinlik değişimi nedenleri | Manor Lords | Arazi, çevrelenme ve yorgunluğun gerçek etkisini açıkla. |
| 16.07 | Ateş edememe nedeni | WARNO/FOC uyarlaması | Menzil, görüş, dost engeli, doldurma ve emir durumunu ayır. |
| 16.08 | Kanat/arka tehdit uyarısı | Manor Lords/Ultimate General uyarlaması | Gerçek çevrelenme hesabı varsa. |
| 16.09 | Birlik karşılaştırması | FOC önerisi | Rol, silah, koruma ve zayıflık; gizli düşman bilgisi yok. |
| 16.10 | Son bilinen düşman konumu | Ultimate General keşif uyarlaması | Eski raporu gerçek anlık konumdan ayır. |
| 16.11 | Saha engeli ve korunma bilgisi | Ultimate General | Duvar, hendek, orman gibi gerçek arazi etkisi. |
| 16.12 | Tahmini varış | FOC önerisi | Rota, hız ve gecikmeye bağlı belirsiz tahmin. |

### 17 — Komuta, ikmal ve hazırlık
| ID | Aday | Referans | FOC amacı ve kullanım mantığı |
|---|---|---|---|
| 17.01 | Yetkiye göre komuta devral | Bannerlord | Yalnız atanmış birlikleri yönet. |
| 17.02 | Birlik komutanına görev devret | Ultimate General/Bannerlord | Hedef ver ve ayrıntıyı komutana bırak; manuel emir öncelikli. |
| 17.03 | Keşif görevi | Ultimate General | Belirli alanı araştır ve raporla. |
| 17.04 | Saha ikmalini koru/yenile | Ultimate General | Yalnız gerçek ikmal sistemiyle; kaynak, erişim ve tüketim. |
| 17.05 | Komuta taşıyıcısının durumu | Cossacks 3/Bannerlord | Lider, sancak, davulcu varsa gerçek kayıp ve etkisi; model işi başlatılmaz. |
| 17.06 | Birlikleri rol bazında dağıt | Bannerlord Order of Battle | Tür/donanım ve komuta sınırına göre hazırlıkta dağıt. |
| 17.07 | Konuşlanmayı sıfırla | Bannerlord | Savaş öncesi ilk geçerli düzene dön. |
| 17.08 | Hazır grup yerleşimi şablonu | Total War/FOC uyarlaması | Geçerlilik kontrolüyle yeniden kullanılabilir yerleşim. |

### 18 — Kullanım ve hata önleme
| ID | Aday | Referans | FOC amacı ve kullanım mantığı |
|---|---|---|---|
| 18.01 | Taktik duraklatmada emir hazırla | CoH3 | Tek oyuncuda zamanı durdurup emir planla; sektör/haberci zamanını tutarlı tut. |
| 18.02 | Tuşları yeniden ata | AoE IV/Shogun 2 | Çakışma uyarısı ve varsayılana dönme. |
| 18.03 | Arayüzü geçici gizle | Shogun 2 K | Savaşı incele; geri açma yolu korunur. |
| 18.04 | Mini haritayı aç/kapat ve ölçekle | Shogun 2 O/J | Gerektiğinde kullan; kalıcı görünüm kararı verilmedi. |
| 18.05 | Klavye ile menü gezinme | FOC önerisi | Yön, Enter ve Esc; fare zorunlu değil. |
| 18.06 | Geçersiz komut nedeni/alternatif | FOC önerisi | Gerçek sebep ve varsa çözüm; sessiz başarısızlık yok. |
| 18.07 | Bağlamsal yardım | Shogun 2/FOC uyarlaması | İşlev, etki ve koşulu ihtiyaçta öğren. |
| 18.08 | Kamera giriş ayarları | FOC önerisi | Hassasiyet, ters yön ve kenar kaydırma; hedeflemeyle çakışmasın. |

## Araştırma kaynakları
- https://www.feralinteractive.com/en/manuals/shogun2tw/latest/steam/
- https://shogun2-encyclopedia.com/how_to_play/049_enc_manual_battle_conflict_controls.html
- https://academy.totalwar.com/rome2/
- https://manualzz.com/doc/26597478/sega-total-war-napoleon-video-game-user-manual
- https://www.taleworlds.com/en/News/536 ; https://www.taleworlds.com/en/News/547 ; https://www.taleworlds.com/en/News/493 ; https://www.taleworlds.com/en/News/611 (resmi arama özetleri; bazı sayfalar doğrudan açılmadı)
- https://wiki.hoodedhorse.com/Manor_Lords/Warfare
- https://store.steampowered.com/app/502520/Ultimate_General_Civil_War/
- https://www.ageofempires.com/news/aoeiv-shortcuts-revealed/ ; https://news.xbox.com/en-us/2021/10/22/age-of-empires-iv-hotkeys-revealed/
- https://manuals.plus/m/3f470b999397003a440768966b8b85ebf17ef25b9a4c4a0caa2dd2e39dbd80cf (Stronghold kılavuz kopyası)
- https://cossacks3.fandom.com/wiki/Formations ; https://steamcommunity.com/app/333420/discussions/0/350542145705166969/ (topluluk kaynakları, sayısal bonus alınmadı)
- https://news.xbox.com/en-us/2022/12/21/company-of-heroes-3-xbox-launch-console-version/
- https://store.steampowered.com/news/posts/?enddate=1676014771&feed=steam_community_announcements ; https://defkey.com/warno-shortcuts (ikincil tuş referansı)

Ek aday 64, toplam 175 kayıt (alt işlevler dahil, benzersiz mekanik sayısı değil). Dokümantasyon incelemesi; oyunlar bizzat oynanmadı. Modern savaş teknolojisi ve üs inşası kopyalanmadı. Kod, yerleşim ve tuş ataması değiştirilmedi.
