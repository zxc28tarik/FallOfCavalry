# Sehir Gameplay Mekanikleri - Detayli Tasarim Belgesi

Bu belge, sehir sisteminin oyun ici mekaniklerini, alanlarin organik baglantilarini,
oyuncu aksiyonlarini ve etki tablolarini icerir.

Yapilarin listesi ve teknik veri modeli icin `02-master-building-catalog.md` dosyasina bakin.
Gorsel kurallar icin `03-faction-art-bible.md` dosyasina bakin.

---

## Genel Felsefe

Sehir sistemi yalnizca gorsel bir sehir resmi olarak dusunulmez.
Her alanin oyun icinde ayri gorevi, oyuncuya sundugu secenekler, sehir gelisimine etkisi
ve diger alanlarla organik baglantisi vardir.

Bir sehirde ticaretin gelismesi nufus cekebilir. Nufus arttikca gida, altyapi ve saglik
ihtiyaci buyur. Uretim alani gelisirse bina yukseltmeleri ve askeri donanim kolaylasir.
Medrese gelisirse daha kaliteli memurlar atanabilir. Kadilik guclenirse asayis artar ve
bu da tuccar ile nufus ceker. Defterhane gelisirse sehir raporlari ve oneriler daha kaliteli
hale gelir. Reisulkuttab Dairesi gelisirse diplomasi secenekleri ve basari sansi artar.

---

## 1. Ic Kale / Yonetim Cekirdegi

### Alan Gorevi

Ic Kale / Yonetim Cekirdegi, sehrin idari merkezidir. Saray, kadilik, medrese, defterhane,
reisulkuttab dairesi ve Bostancilar karargahi gibi yonetim yapilari bu alanda bulunur.

Bu alanin gorevi dogrudan basit bir savunma, yonetim gucu veya prestij bonusu vermek degildir.
Ic Kale daha cok sehir idaresi, adalet, memur kalitesi, kayit sistemi, raporlama, diplomasi,
sehir huzuru ve merkezi duzenle baglantili calisir.

Ic kale surlari ve kapisi gorsel olarak guclu olabilir; ancak oyun sistemi icinde dogrudan
sehir savunmasini artiran ana unsur olarak kullanilmaz. Sehir savunmasi daha cok askeri alan,
garnizon, birlik kalitesi, savas hazirligi ve savunma mekanikleri uzerinden degerlendirilir.

### Ic Kale Yapilari

| Yapi | Ana gorevi | Oyun ici etkisi |
|------|-----------|-----------------|
| Ic kale surlari / kapisi | Yonetim cekirdegini gorsel olarak sinirlar | Dogrudan savunma bonusu vermez |
| Saray | Ust yonetim merkezi | Dogrudan yonetim gucu veya prestij artirmaz; sehir kararlarinin merkezi olarak kullanilir |
| Kadilik / Mahkeme | Adalet, asayis ve duzen | Gelistikce asayis, halk guveni ve sehir duzeni artar |
| Medrese | Egitimli memur yetistirme | Kadilik, defterhane ve diger makamlara atanan memurlarin seviyesini yukseltir |
| Defterhane-i Amire | Kayit, vergi, rapor ve sehir analizi | Gelistikce rapor kalitesi ve oneriler artar |
| Reisulkuttab Dairesi | Dis yazisma ve diplomasi | Gelistikce diplomasi secenekleri ve basari sansi artar |
| Bostancilar Karargahi | Sehir huzuru, saray muhafazasi ve kacakcilikla mucadele | Huzuru artirir, muhafiz birlikleri acar, kacakciligi azaltarak vergi kaybini dusurur |

---

### Kadilik / Mahkeme

Kadilik ve mahkeme gelistikce sehirde adalet duzeni guclenir. Bu gelisim dogrudan halkin
guvenini ve sehir ici duzeni etkiler.

Kadilik guclu olan bir sehirde insanlar kendini daha guvende hisseder. Tuccarlar da mal
guvenligi, borc anlasmazliklari ve sehir duzeni konusunda daha az risk gorur.

**Kadilik etkileri:**

| Etki | Aciklama |
|------|----------|
| Asayis artisi | Suc, kavga, duzensizlik ve huzursuzluk azalir |
| Halk guveni | Insanlar sehirde yasamayi daha guvenli gorur |
| Sehir duzeni | Ticaret, uretim ve vergi sistemi daha istikrarli isler |
| Nufus cekimi | Guvenli sehir daha fazla goc alir |
| Tuccar cekimi | Duzenli ve adaletli sehir daha fazla tuccar ceker |

**Ornek:**
Bir sehirde pazar buyuk olabilir; ancak kadilik zayifsa tuccarlar sehirde guven sorunu
yasayabilir. Kadilik gelismis bir sehirde ise ticaret daha guvenli yurur.

---

### Medrese

Medrese, sehirde gorev yapan memurlarin kalitesini yukselten egitim merkezidir.
Medrese dogrudan para veya prestij veren basit bir yapi olarak calismaz.
Asil etkisi, sehirdeki idari makamlarin daha verimli calismasini saglamaktir.

**Medrese gelistikce:**

| Medrese gelisimi | Etki |
|------------------|------|
| Temel medrese | Dusuk ve orta seviye memur yetistirir |
| Gelismis medrese | Daha kaliteli kadi, katip ve defter gorevlileri saglar |
| Yuksek seviye medrese | Idari makamlarin verimini ciddi sekilde artirir |
| Ust duzey medrese | Buyuk sehirlerde guclu burokratik kadro olusturur |

**Baglantili oldugu alanlar:**

| Baglanti | Aciklama |
|----------|----------|
| Kadilik | Daha kaliteli kadilar sayesinde asayis ve halk guveni artar |
| Defterhane | Daha iyi katipler sayesinde rapor kalitesi ve kayit duzeni gelisir |
| Reisulkuttab | Daha nitelikli diplomatik gorevliler sayesinde dis iliski basarisi artar |
| Sehir yonetimi | Kararlarin uygulanmasi daha verimli hale gelir |

---

### Defterhane-i Amire

Defterhane, sehrin kayit, vergi, nufus, uretim, ticaret ve idari raporlama merkezidir.
Gelistikce oyuncunun sehir hakkinda aldigi bilgi kalitesi artar.

Bu yapi yalnizca vergi takibi yapan pasif bir bina degildir. Sehirde neyin eksik oldugunu,
hangi alanin geri kaldigini, hangi yatirimin daha mantikli olacagini ve hangi sorunun
buyumeden cozulmesi gerektigini oyuncuya daha net gosteren bir rapor sistemi gibi calisir.

**Defterhane gelistikce:**

| Gelisim etkisi | Aciklama |
|----------------|----------|
| Rapor kalitesi artar | Sehir hakkinda daha dogru ve detayli bilgi verilir |
| Oneri sayisi artar | Oyuncuya daha fazla gelistirme tavsiyesi sunulur |
| Sorun tespiti gelisir | Gida, vergi, huzur, uretim, ticaret veya altyapi sorunlari daha erken fark edilir |
| Vergi kayitlari netlesir | Kacak, kayip veya verimsiz gelir alanlari daha iyi anlasilir |
| Sehir planlama kolaylasir | Hangi alanin once gelistirilmesi gerektigi daha net gorulur |

**Ornek:**
- Dusuk seviyeli Defterhane: "Sehir geliri dusuk."
- Gelismis Defterhane: "Sehir gelirinin dusmesinin ana nedeni pazar zayifligi degil, hanlar
  bolgesinden gelen mallarin gumrukte yeterince kaydedilememesi ve kacakciligin artmasidir.
  Bostanci sayisi yetersiz kaldigi icin vergi kaybi yukselmistir."

---

### Reisulkuttab Dairesi

Dis ulkelerle yazisma, diplomatik temas, antlasma hazirligi ve dis iliskiler sistemini
temsil eder.

**Gelistikce:**

| Gelisim etkisi | Aciklama |
|----------------|----------|
| Diplomasi secenekleri artar | Daha fazla dis iliski karari acilir |
| Basari sansi yukselir | Antlasma, ticaret anlasmasi veya ittifak girisimlerinde basari ihtimali artar |
| Diplomatik bilgi kalitesi artar | Diger devletlerin niyeti, gucu veya iliskileri daha iyi analiz edilir |
| Yazisma hizi artar | Diplomatik surecler daha verimli ilerler |
| Dis ticaret baglantisi guclenir | Ticaret ve hanlar/kervan alaniyla bag kurabilir |

**Acilabilecek diplomasi secenekleri:**

| Secenek | Aciklama |
|---------|----------|
| Ticaret anlasmasi | Iki ulke arasinda mal akisini ve ticaret gelirini artirir |
| Gecis izni | Ordu veya kervanlarin baska topraklardan gecmesini kolaylastirir |
| Saldimazlik anlasmasi | Sinir guvenligini ve diplomatik dengeyi korur |
| Ittifak gorusmesi | Ortak dusmana karsi diplomatik veya askeri is birligi saglar |
| Elci gonderme | Iliski gelistirme veya bilgi toplama amaciyla kullanilir |
| Esir takasi | Savas sonrasi diplomatik cozum secenegi sunar |
| Harac / vergi pazarligi | Guclu devletlerin zayif devletler uzerinde baski kurmasini saglar |

---

### Bostancilar Karargahi

Sehir huzurunu, saray cevresi guvenligini ve kacakcilikla mucadeleyi temsil eder.

**Etkileri:**

| Etki | Aciklama |
|------|----------|
| Sehir huzuru artar | Halkin guvenlik algisi yukselir |
| Kacakcilik azalir | Pazar, han ve gumruk cevresindeki kayit disi mal akisi duser |
| Vergi kaybi azalir | Kacakcilik engellendigi icin gercek gelir daha iyi toplanir |
| Muhafiz birlikleri acilir | Ozel sehir muhafizlari veya saray muhafizlari uretilebilir |
| Maliyet artar | Bostanci sayisi arttikca maas ve bakim gideri yukselir |

**Sayiya bagli etki:**

| Bostanci sayisi | Etki |
|-----------------|------|
| Az | Kucuk huzur artisi, sinirli kacakcilik kontrolu |
| Orta | Pazar ve han cevresinde belirgin guvenlik etkisi |
| Yuksek | Kacakcilik ciddi azalir, vergi kaybi duser, sehir huzuru yukselir |
| Cok yuksek | Guclu guvenlik saglar ama maliyeti agirlaslir |

**Denge:**
Bostancilar guclu ama pahali olmalidir. Buyuk sehirlerde cok faydali olabilirler;
fakat kucuk ve fakir sehirlerde fazla Bostanci beslemek zarar ettirebilir.

---

## 2. Ticaret Alani

### Alan Gorevi

Ticaret alani, sehir ici para akisini, pazar duzenini, esnaf faaliyetlerini,
degerli mal alisverisini ve halkin temel ticaret ihtiyacini temsil eder.

Bu alan gelistikce yalnizca para geliri artmaz. Sehir memnuniyeti, nufus cekimi,
tuccar cekimi, bina yukseltme kolayligi, askeri gelistirme imkani ve bazi uretim
yapilarinin acilmasi da ticaret alaniyla baglantili hale gelir.

### Oyuncunun Yapabilecekleri

| Secenek | Aciklama |
|---------|----------|
| Pazar buyutme | Temel sehir ticaretini artirir |
| Bedesten kurma | Degerli mallarin ticaretini acar |
| Lonca Konagi gelistirme | Esnaf ve uretim duzenini guclendirir |
| Gumruk Dairesi kurma | Mal giris-cikisindan gelir saglar |
| Ticaret vergisi ayarlama | Gelir ile tuccar memnuniyeti arasinda denge kurulur |
| Tuccar cekme | Gelismis ticaret alani daha fazla tuccar getirir |
| Mal cesitliligini artirma | Farkli mallar sehirde bulunabilir hale gelir |
| Bina gelistirmelerini kolaylastirma | Gerekli mal ve usta erisimi arttigi icin yukseltmeler kolaylasir |
| Askeri gelistirmeleri destekleme | Silah, zirh, deri, kumas ve metal gibi mallar asker gelistirmelerine katki saglar |

### Etkileri

| Etki | Aciklama |
|------|----------|
| Para geliri | Pazar, bedesten ve gumruk uzerinden gelir artar |
| Sehir memnuniyeti | Mal bollugu ve duzenli pazar halki memnun eder |
| Nufus cekimi | Is ve ticaret firsati olan sehir daha fazla insan ceker |
| Tuccar cekimi | Guvenli ve karli sehir daha fazla tuccar toplar |
| Bina yukseltme kolayligi | Insaat ve gelistirme icin gereken mallara erisim artar |
| Asker gelistirme kolayligi | Silah, zirh, deri ve kumas gibi askeri girdiler daha rahat bulunur |
| Uretim yapisi acma sarti | Bazi gelismis uretim binalari icin guclu ticaret alani gerekir |

**Ornek:**
Gelismis demirci icin yalnizca uretim alani yetmeyebilir. Sehirde yeterli ticaret
baglantisi yoksa kaliteli metal, komur, arac-gerec veya usta erisimi sinirli kalir.
Bu yuzden ticaret alani gelismis olmayan sehirlerde bazi uretim yapilari acilamaz
veya dusuk seviyede kalir.

---

## 3. Hanlar / Kervan Alani

### Alan Gorevi

Hanlar ve kervan alani, sehirler arasi ticaretin, yol baglantilarinin, disaridan gelen
tuccarlarin ve uzak mal akisinin merkezidir.

Ticaret alani sehir icindeki alisverisi temsil ederken, Hanlar / Kervan alani dis
baglantiyi temsil eder.

### Oyuncunun Yapabilecekleri

| Secenek | Aciklama |
|---------|----------|
| Han kurma | Tuccarlarin ve yolcularin konaklamasini saglar |
| Han kapasitesini artirma | Daha fazla tuccar ve kervan kabul edilir |
| Tuccar Hani kurma | Zengin tuccarlari ve degerli mallari ceker |
| Kervansaray kurma | Uzun mesafe ticareti guclendirir |
| Kervan guvenligi artirma | Yoldaki ticaret kaybini azaltir |
| Depolama kapasitesi artirma | Disaridan gelen mallar sehirde tutulabilir |
| Uzak bolge mallarina erisme | Normalde bulunmayan ozel mallar acilir |
| Uretim binalarini acma | Bazi uretim yapilari dis mal akisina bagli hale gelir |

### Etkileri

| Etki | Aciklama |
|------|----------|
| Dis ticaret geliri | Uzak bolgelerden gelen ticaret para kazandirir |
| Nufus artisi | Ticaret yollari uzerinde gelisen sehir goc alir |
| Sehir memnuniyeti | Mal bollugu ve is imkani halki memnun eder |
| Tuccar cekimi | Han kapasitesi arttikca sehir daha fazla tuccar agirlar |
| Uretim destegi | Uzak hammaddeler uretim yapilarinin acilmasini saglar |
| Asker gelistirme destegi | Kaliteli metal, deri, kumas, at ve ozel mal akisi askeri gelisimi destekler |
| Bina yukseltme destegi | Tas, kereste, metal, kumas ve ozel mal erisimi yukseltmeleri kolaylastirir |

### Ticaret ve Kervan Baglantisi

| Durum | Sonuc |
|-------|-------|
| Pazar var ama han yok | Sehir ici ticaret vardir ama dis mal akisi zayiftir |
| Han var ama pazar zayif | Disaridan mal gelir ama sehir icinde yeterince satilamaz |
| Pazar + han gelismis | Hem ic ticaret hem dis ticaret guclu olur |
| Bedesten + Tuccar Hani gelismis | Degerli mal ticareti ve zengin tuccar hareketi artar |
| Gumruk + Kervansaray gelismis | Buyuk dis ticaret geliri ve vergi potansiyeli olusur |

---

## 4. Konut Alani

### Alan Gorevi

Konut alani, sehrin nufusunu ve sosyal sinif yapisini temsil eder.
Is gucu, vergi tabani, asker kaynagi, uretim calisanlari ve sehir memnuniyeti
bu alanla baglantilidir.

### Oyuncunun Yapabilecekleri

| Secenek | Aciklama |
|---------|----------|
| Nufus kapasitesini artirma | Daha fazla halk sehirde yasayabilir |
| Mahalleleri gelistirme | Fakir mahalleler daha duzenli hale getirilebilir |
| Sosyal sinif dengesini izleme | Fakir, orta ve zengin mahalle oranlari gorulebilir |
| Is gucu saglama | Uretim, insaat ve hizmetler icin halk kaynagi olusturulur |
| Vergi tabanini buyutme | Daha fazla nufus daha fazla vergi anlamina gelir |
| Halk memnuniyetini kontrol etme | Gida, saglik, altyapi ve vergi dengesi izlenir |
| Goc cekme | Guvenli, zengin ve duzenli sehirler daha fazla nufus ceker |

### Etkileri

| Etki | Aciklama |
|------|----------|
| Nufus artisi | Sehir daha fazla insan barindirir |
| Is gucu | Uretim ve insaat icin calisan saglar |
| Vergi tabani | Daha fazla halk daha genis vergi kaynagi olusturur |
| Asker kaynagi | Nufus arttikca asker toplama potansiyeli yukselir |
| Gida ihtiyaci | Nufus buyudukce gida tuketimi artar |
| Altyapi ihtiyaci | Su, yol, temizlik ve kanalizasyon ihtiyaci yukselir |
| Saglik ihtiyaci | Kalabalik sehirlerde hastalik riski artar |

**Ornek:**
Sadece fakir mahallelerden olusan bir sehir hizli nufus saglar ama dusuk gelirli ve
huzursuz olabilir. Zengin konak bolgesi olan sehirler ise daha yuksek gelir ve daha
fazla ticari hareketlilik olusturabilir.

---

## 5. Askeri Alan

### Alan Gorevi

Askeri alan, sehrin asker yetistirme, birlik donatma, garnizon barindirma ve savas
hazirligi merkezidir.

Bu alan sadece asker sayisini artiran bir yer degildir. Oyuncu burada yeni birlik
turleri acabilir, daha elit birliklere ulasabilir, birliklerin silahlarini gelistirebilir,
zirhlarini iyilestirebilir ve egitim seviyelerini artirabilir.

### Oyuncunun Yapabilecekleri

| Secenek | Aciklama |
|---------|----------|
| Kisla kurma | Temel asker barindirma ve egitim sistemi acilir |
| Garnizon kapasitesini artirma | Sehirde daha fazla asker tutulabilir |
| Yeni birlik turleri acma | Gelismis askeri yapilarla farkli birlikler cikarilabilir |
| Daha elit birlikler acma | Yuksek seviye askeri alan ozel birliklere erisim saglar |
| Silah gelistirme | Birliklerin saldiri gucu veya savas verimi artar |
| Zirh gelistirme | Birliklerin dayanikliligi artar |
| Egitim seviyesi artirma | Disiplin, moral ve savas etkinligi yukselir |
| Talim alani gelistirme | Egitim suresi kisalabilir veya egitim kalitesi artabilir |
| Cephanelik gelistirme | Silah, zirh ve muhimmat kapasitesi artar |
| Muhafiz birlikleri uretme | Bostancilar Karargahi ile baglantili ozel guvenlik birlikleri cikarilabilir |

### Askeri Gelisimin Bagli Oldugu Alanlar

| Askeri gelisim | Bagli oldugu alanlar |
|----------------|---------------------|
| Daha iyi silah | Demirci, ticaret, hanlar/kervan |
| Daha iyi zirh | Demirci, tabakhane, dokuma, ticaret |
| Daha iyi egitim | Kisla, talim alani, sehir huzuru |
| Elit birlik | Gelismis kisla, guclu ekonomi, ozel yapi sarti |
| Muhafiz birlikleri | Bostancilar Karargahi |
| Atli birlik destegi | Nalbant, hanlar/kervan, gida/ikmal |
| Uzun sureli garnizon | Gida/ikmal, ambar, sehir ekonomisi |

---

## 6. Saglik / Hamam / Eczane Alani

### Alan Gorevi

Bu alan, sehir halkinin saglik, temizlik ve kamusal bakim ihtiyaclarini temsil eder.
Nufus arttikca hastalik, temizlik, salgin riski ve halk memnuniyeti daha onemli hale gelir.

### Oyuncunun Yapabilecekleri

| Secenek | Aciklama |
|---------|----------|
| Saglik hizmeti gelistirme | Hastalik ve olum riski azaltilabilir |
| Darussifa kurma | Gelismis tedavi ve halk sagligi sistemi acilir |
| Hamam insa etme | Temizlik ve halk memnuniyeti artar |
| Eczane kurma | Kucuk saglik destegi ve ilac sistemi saglanir |
| Salgin riskini azaltma | Kalabalik sehirlerde hastalik etkisi dusurulir |
| Halk refahini artirma | Saglik ve temizlik hizmetleri memnuniyeti yukseltir |

### Etkileri

| Etki | Aciklama |
|------|----------|
| Hastalik riski azalir | Kalabalik sehirlerde salgin etkisi duser |
| Halk memnuniyeti artar | Temizlik ve bakim halki rahatlatir |
| Nufus buyumesi desteklenir | Saglikli sehir daha guvenli buyur |
| Kusatma dayanikliligi artabilir | Uzun krizlerde halk sagligi korunur |
| Altyapiyla guclenir | Su, drenaj ve kanalizasyon varsa etkisi artar |
| Sabunhane ile bag kurar | Sabun uretimi temizlik ve saglik sistemini destekler |

---

## 7. Uretim / Zanaat Alani

### Alan Gorevi

Uretim / Zanaat alani, sehirde kullanilan ve satilan mallarin uretildigi bolgedir.
Ancak uretim binalari yalnizca para kazandiran atolyeler gibi calismaz.
Her uretim yapisi sehir ici dinamikleri farkli sekilde etkiler.

### Uretim Yapilari ve Sehir Ici Etkileri

| Uretim yapisi | Urettigi / temsil ettigi sey | Sehir ici etkisi |
|---------------|------------------------------|------------------|
| Demirci | Metal alet, silah, zirh parcasi | Askeri gelistirme, bina insaati ve zanaat verimini destekler |
| Marangoz | Kereste isciligi, ahsap malzeme | Bina yukseltmeleri, konut gelistirme, askeri arac-gerec ve ticaret sandiklari saglar |
| Tabakhane | Deri isleme | Zirh, kosum takimi, ayakkabi, ticari deri urunu; temizlik ve koku sorunu yaratabilir |
| Dokuma Atolyesi | Kumas, tekstil | Halk memnuniyeti, ticaret mallari ve askeri kiyafet/techizat destegi saglar |
| Boyahane | Boyali kumas ve deri | Ticari mal degerini artirir; su ve temizlik altyapisi zayifsa kirlilik etkisi yaratabilir |
| Sabunhane | Sabun ve temizlik urunu | Saglik, hamam, halk memnuniyeti ve temizlik sistemini destekler |
| Kagit Imalathanesi | Kagit uretimi | Defterhane, medrese, burokrasi ve kulturel gelisimle baglantili ozel uretim saglar |
| Mumhane | Mum ve aydinlatma | Sehir hizmetleri, ibadet yapilari, medrese ve gece faaliyetleri icin destek saglar |
| Tas Ustasi / Insaat Atolyesi | Tas isciligi ve yapi malzemesi | Buyuk bina yukseltmeleri ve yol/altyapi gelisimlerini kolaylastirir |
| Nalbant | At nali, hayvan bakimi | Kervan, askeri atli birlik, ulasim ve ticaret yollarini destekler |

### Olumlu ve Olumsuz Etkiler

| Yapi | Olumlu etki | Olasi olumsuz etki |
|------|-------------|-------------------|
| Tabakhane | Deri ve askeri ekipman saglar | Koku, kirlilik, halk memnuniyeti dususu |
| Boyahane | Ticari urun degerini artirir | Su kirliligi, drenaj ihtiyaci |
| Demirci | Silah ve alet uretir | Yakit ve hammadde ihtiyaci |
| Marangoz | Insaat ve uretim destegi verir | Kereste ihtiyaci |
| Sabunhane | Temizlik ve saglik destegi verir | Yag ve kul gibi hammadde ister |
| Kagit Imalathanesi | Burokrasi ve medreseyi destekler | Gelismis sehir ve mal akisi ister |
| Nalbant | Kervan ve atli birlikleri destekler | Hayvan, demir ve yem ihtiyaci olusturur |

### Uretim Alaninin Baglantilari

| Baglanti | Aciklama |
|----------|----------|
| Ticaret alani | Uretilen mallar pazarda, bedestende veya gumruk uzerinden deger kazanir |
| Hanlar / Kervan | Uzak hammaddeler ve yeni pazarlar saglar |
| Askeri alan | Silah, zirh, deri, kumas ve nalbant destegi verir |
| Konut alani | Is gucu saglar; uretim kirliligi halki etkileyebilir |
| Saglik / Hamam | Sabunhane ve temizlik uretimi saglik etkisini guclendirir |
| Altyapi | Drenaj, yol ve su sistemi uretimin zararlarini azaltir |
| Ic Kale | Defterhane ve medrese gibi yapilar kagit uretiminden faydalanir |

### Uretim Yapilarinin Acilma Sarti Ornekleri

| Uretim yapisi | Gerekli baglanti |
|---------------|-----------------|
| Demirci | Temel uretim alani yeterli olabilir; gelismis seviye icin ticaret baglantisi gerekir |
| Dokuma Atolyesi | Kumas ve iplik akisi icin ticaret veya kervan baglantisi ister |
| Boyahane | Boya maddeleri, kumas akisi ve su altyapisi ister |
| Sabunhane | Yag, kul, temizlik talebi ve pazar/lonca baglantisi ister |
| Kagit Imalathanesi | Medrese, defterhane, gelismis sehir ve ticaret baglantisi ister |
| Mumhane | Balmumu, yag ve sehir ici tuketim baglantisi ister |
| Nalbant | Hanlar, kervanlar ve askeri alanla guclu baglanti kurar |
| Tas Ustasi / Insaat Atolyesi | Buyuk bina yukseltmeleri icin ticaret ve mal akisi ister |

---

## 8. Gida / Ikmal Alani

### Alan Gorevi

Gida / Ikmal alani, sehrin beslenme, stok ve temel yasam destegini temsil eder.
Bu alan olmadan nufus buyumesi, asker barindirma ve uzun sureli sehir dayanikliligi zayiflar.

### Oyuncunun Yapabilecekleri

| Secenek | Aciklama |
|---------|----------|
| Gida uretimini artirma | Halkin temel yiyecek ihtiyaci karsilanir |
| Ambar kapasitesini buyutme | Kitlik veya kusatma icin stok tutulur |
| Degirmen kurma | Tahil isleme ve un uretimi saglanir |
| Firin gelistirme | Ekmek uretimi ve halk memnuniyeti artar |
| Kasaphane kurma | Et ikmali saglanir |
| Balikhane kurma | Suya yakin sehirlerde balik ikmali acilir |
| Ordu ikmalini destekleme | Garnizon ve sefer hazirligi icin yiyecek saglanir |

### Etkileri

| Etki | Aciklama |
|------|----------|
| Nufus destegi | Halkin beslenmesi saglanir |
| Kitlik direnci | Ambar kapasitesi sehir dayanikliligini artirir |
| Kusatma dayanikliligi | Uzun savaslarda sehir daha uzun sure dayanir |
| Garnizon besleme | Askeri alanin surdurulebilirligi saglanir |
| Halk memnuniyeti | Gida bollugu huzursuzlugu azaltir |
| Ticaret baglantisi | Fazla gida ticarete konu olabilir |

---

## 9. Meydan / Kultur Alani

### Alan Gorevi

Meydan / Kultur alani, sehrin sosyal yasamini, torenlerini, panayirlarini ve kamusal
kimligini temsil eder.

### Oyuncunun Yapabilecekleri

| Secenek | Aciklama |
|---------|----------|
| Halk etkinligi duzenleme | Sehir memnuniyeti gecici veya kalici artirilabilir |
| Panayir kurma | Ticaret ve halk hareketliligi artar |
| At Meydani gelistirme | Toren, gosteri ve sehir kimligi guclenir |
| Kamusal yapi insa etme | Sehrin kulturel degeri ve itibari artar |
| Sehir morali artirma | Savas, kitlik veya huzursuzluk sonrasi halk destegi guclendirebilir |
| Tuccar ve ziyaretci cekme | Panayir ve buyuk meydan sehir hareketliligini artirir |

### Etkileri

| Etki | Aciklama |
|------|----------|
| Halk memnuniyeti | Etkinlik ve kamusal yasam halki rahatlatir |
| Sehir kimligi | Sehir digerlerinden daha karakterli hale gelir |
| Ticaret destegi | Panayirlar gecici ticaret hareketliligi saglar |
| Nufus cekimi | Canli ve guvenli sehir daha fazla insan cekebilir |
| Sosyal denge | Kriz donemlerinde moral ve huzur destegi saglar |

---

## 10. Altyapi / Sehir Hizmetleri

### Alan Gorevi

Altyapi / Sehir Hizmetleri, sehirde dogrudan buyuk bina olarak gorunmeyen ancak sehir
gelisimini guclu sekilde etkileyen sistemdir. Bu sistem Sehir Kethudasi araciligiyla yonetilir.

### Oyuncunun Yapabilecekleri

| Secenek | Aciklama |
|---------|----------|
| Kuyu acma | Temel su ihtiyaci karsilanir |
| Cesme yaptirma | Halkin su erisimi ve memnuniyeti artar |
| Sarnic kurma | Su depolama kapasitesi yukselir |
| Su yolu / kanal yaptirma | Buyuk sehirlerde gelismis su sistemi kurulur |
| Ana yollari tas doseme | Ticaret, askeri hareket ve sehir duzeni iyilesir |
| Ara yollari duzenleme | Mahalle baglantilari guclenir |
| Kopru / gecit insa etme | Sehir ici veya cevresindeki gecisler kolaylasir |
| Drenaj hatti kurma | Camur, su birikmesi ve temizlik sorunlari azalir |
| Kanalizasyon / atik kanali kurma | Buyuk sehirlerde saglik ve temizlik seviyesi artar |

### Etkileri

| Etki | Aciklama |
|------|----------|
| Nufus buyumesi | Temiz su ve yol sistemi buyumeyi destekler |
| Saglik | Drenaj ve kanalizasyon hastalik riskini azaltir |
| Ticaret | Yol ve kopruler mal akisini hizlandirir |
| Uretim | Su, yol ve atik sistemi uretimin olumsuz etkilerini dengeler |
| Halk memnuniyeti | Temiz ve duzenli sehir daha huzurlu olur |
| Buyuk sehir surdurulebilirligi | Altyapi olmadan buyuk nufus sorun yaratir |

---

## Alanlarin Organik Baglanti Sistemi

Bir alan yalnizca tek bir sisteme bagli olmak zorunda degildir. Ayni alan birden fazla
sehir sistemiyle baglantili olabilir.

Bu sistemde her bina "tek bonus veren yapi" gibi calismaz. Bir yapi ticaret, nufus,
askeri gelisim, diplomasi, uretim, huzur veya altyapi gibi birden fazla sistemi ayni
anda etkileyebilir.

### Temel Organik Baglantilar

| Alan / Yapi | Baglantili oldugu sistemler |
|-------------|----------------------------|
| Kadilik | Asayis, halk guveni, tuccar cekimi, nufus cekimi, sehir huzuru |
| Medrese | Memur kalitesi, kadilik verimi, defterhane verimi, reisulkuttab verimi, kulturel gelisim |
| Defterhane | Rapor kalitesi, sehir onerileri, vergi takibi, kacakcilik tespiti, nufus kayitlari, uretim verimliligi |
| Reisulkuttab Dairesi | Diplomasi, dis ticaret, antlasmalar, elcilik, bilgi toplama, dis devletlerle basari sansi |
| Bostancilar | Huzur, kacakcilik onleme, vergi geliri, ozel muhafiz birlikleri, ticaret guvenligi |
| Ticaret Alani | Para geliri, sehir memnuniyeti, nufus cekimi, bina gelistirme, askeri mal erisimi |
| Hanlar / Kervan | Dis mal akisi, tuccar cekimi, uretim acilimi, diplomatik ticaret baglantilari |
| Konut Alani | Nufus, is gucu, vergi tabani, asker kaynagi, gida ve altyapi ihtiyaci |
| Askeri Alan | Yeni birlikler, elit birlikler, silah, zirh, egitim ve sehir savunma hazirligi |
| Uretim Alani | Asker gelistirme, bina yukseltme, ticaret mali, sehir ici ihtiyaclar |
| Gida / Ikmal | Halk beslenmesi, garnizon destegi, kitlik ve kusatma dayanikliligi |
| Saglik / Hamam | Hastalik azaltma, memnuniyet, temizlik ve nufus surdurulebilirligi |
| Altyapi | Saglik, nufus buyumesi, uretim verimi, ticaret akisi, sehir memnuniyeti |

---

## Sehir Buyuklugu ve Gelisim Mantigi

Her sehir ayni yogunlukta gorunmez. Sehirlerin doluluk seviyesi, oyun icindeki onemine,
zenginligine, ticaret degerine, askeri konumuna ve nufusuna gore degisir.

### Kucuk Sehir

- Kucuk Ic Kale
- Pazar
- Fakir ve orta halli mahalle
- Demirci veya marangoz gibi 1-2 uretim yapisi
- Kucuk firin veya ambar
- Basit meydan
- Kuyu ve ara yol gibi temel altyapi

### Orta Sehir

- Ic Kale
- Cami, medrese ve kadilik
- Pazar
- Han
- Fakir ve orta mahalleler
- 2-4 uretim yapisi
- Firin, degirmen ve ambar
- Hamam veya kucuk saglik yapisi
- Cesme, tas yol ve drenaj gibi gelisen altyapi

### Buyuk Sehir

- Guclu Ic Kale
- Saray
- Cami, medrese, kadilik, defterhane ve reisulkuttab dairesi
- Pazar, bedesten, lonca ve gumruk
- Han veya tuccar hani
- Fakir, orta ve elit mahalleler
- Birden fazla uretim yapisi
- Darussifa, hamam ve eczane
- Buyuk meydan veya panayir alani
- Gelismis altyapi sistemi

### Baskent / Istanbul Tipi Sehir

- Buyuk Ic Kale ve guclu saray alani
- Cami, medrese, kadilik, defterhane ve reisulkuttab dairesi
- Bostancilar Karargahi
- Bedesten, pazar, lonca ve gumruk yapilari
- Han, tuccar hani veya kervansaray
- Fakir mahalle, orta mahalle ve elit konak bolgesi
- Demirci, marangoz, tabakhane ve sabunhane
- Ozel yapi olarak kagit imalathanesi
- Darussifa, buyuk hamam ve eczane
- At Meydani veya buyuk kamusal alan
- Gelismis su, yol, drenaj ve kanalizasyon altyapisi

---

## Sehir Gorsel Uretim Kurallari

Osmanli sehir varliklari ayni gorsel dilde uretilmelidir.

| Kural | Aciklama |
|-------|----------|
| Ayni perspektif | Tum binalar ayni kamera acisina uygun olmalidir |
| Ayni isik yonu | Golge ve parlaklik ayni yonden gelmelidir |
| Ayni renk dili | Tas, ahsap, kiremit ve toprak tonlari uyumlu olmalidir |
| Net siluet | Bina kucuk boyutta bile anlasilmalidir |
| Islev okurlugu | Oyuncu yapinin ne ise yaradigini ilk bakista anlayabilmelidir |
| Modern unsur yok | Elektrik diregi, betonarme, modern pencere veya cag disi obje kullanilmamalidir |
| Fazla gercekci degil | Foto-gercekci degil, oyun asseti gibi okunabilir olmalidir |
| Fazla cizgi film degil | Cartoon tarzina kacmamalidir |
| Moduler kullanim | Base scene ve overlay bina sistemiyle kullanilabilir olmalidir |

### Gorsel Ayrim Ornekleri

- Cami, kubbe ve minareyle hemen taninmalidir.
- Demirci, ocak ve metal isciligiyle ayirt edilmelidir.
- Tabakhane, deri askilari ve kirli uretim alaniyla taninmalidir.
- Bedesten, kalin tas govdesi ve ticari merkez hissiyle one cikmalidir.
- Fakir mahalle sikisik ve yipranmis gorunmelidir.
- Zengin konak bolgesi daha ferah, avlulu ve duzenli olmalidir.
- Hanlar genis avlulu, yuk ve tuccar hareketi olan yapilar gibi gorunmelidir.
- Bostancilar Karargahi temiz, disiplinli ve saraya bagli ozel guvenlik alani hissi vermelidir.
- Defterhane resmi, duzenli ve kayit merkezi gibi gorunmelidir.
- Reisulkuttab Dairesi kucuk ama itibarli bir diplomatik burokrasi yapisi gibi gorunmelidir.
