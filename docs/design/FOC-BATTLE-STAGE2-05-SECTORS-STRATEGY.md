# Fall of Cavalry — 2.5 Sektör yönetimi ve genel strateji
28 Kasım 2026. Aşama 2 kullanım/yerleşim taslağı; kaynak ana eşleme 2fbcaf82376e5e83f160ae0f5fdddcc78b5dba89. Kullanıcı kararları: sol tık grup, sağ tık yalnız Emirler/Dizilişler; sürekli dost/düşman toplam sayaçları, birlik üstü simgeler ve büyük emir konsolu yok. Asker modelleri değişmez. Bu belge KISS elemesi, uygulama veya kesin görsel/tuş onayı değildir.

## Aday yüzey
Genel komuta ayrı geçici görünüm; grup sağ tık menüsüne strateji eklenmez. Erişim için küçük kontrol veya kısayol adayı; kesin konum/tuş sonra. Üstte sektör seçimi, ortada göreli konumlar ve son bilinen durum, yanda seçilen sektörün komutanı/görevi/rapor zamanı ve yedek/ikmal/strateji seçenekleri. Bu bir genel bakış, bütün sektörlerin canlı 3D görüntüsü değil.
```
[Sektör genel görünümü]  [Son rapor / zaman]
[Sol] [Merkez] [Sağ]    [Komutan / görev]
[Seçili sektör]         [Yedek / takviye / strateji]
[Git] [Emir gönder]     [Kapat / savaşa dön]
```
Sektöre gitmek ile sektöre emir vermek farklı işlemler. Aktif/pasif simülasyon ortak zaman ve kalıcı grup kimliği ile çalışır; eski emirler geçişte kaybolmaz. Haberci sistemi onaylı kurala bağlı, iletildi/yolda/ulaştı/başarısız durumları gerçek. Raporun yaşı ve belirsizliği görünür; rakibin saklı gücü açılmaz. Taktik yedek ile render kapasitesinin bekleyen askeri ayrı. Gerçek takviye, eksilen saflar ve sektör transferi için uygun kaynak, hedef, yol ve süre; ışınlama yok. İkmal koşullu.
## Strateji akışı
Serbest yönetim / dengeli ilerleme / savunma / kanattan saldırı adayları. Plan seç > etkilenecek gruplar ve gerçek görev/hedefleri önizle > uygunluk kontrolü > açık onay. Eksik tür/yetki/rota varsa gerekçe, otomatik uydurma yok. Manuel emir ilgili grupta otomasyonu geçersiz kılar; diğer gruplar devam. Planın tümünü iptal ayrı eylem, iptal sonrasında gerçek görev ve güvenli davranış. Komuta devri gerçek karakter yetkisine bağlı. Plan bonusu vaat edilmez.
## Test planı
Aktif/pasif sektör geçişi, rapor gecikmesi, komutan kaybı, yetkisiz emir, yedek ayrımı, aynı grubu iki kere transfer, eksik plan bileşeni, manuel emir/plan çakışması, duraklama ve bitiş tutarlılığı. Nihai sektör limiti, gecikme ve yetki kuralları açık; test yapılmadı.

## Her kayıt için birincil erişim, eylem ve sonuç

### S alanı
| ID | İşlev | Envanter kullanım açıklaması | Önerilen erişim ve davranış |
|---|---|---|---|
| 10.01 | Aktif sektör seçme/değiştirme — K/M/E | Sektöre geçer; mevcut seçimi ve emirleri kaybolmaz, geçiş süresi açık. | Sektör genel görünümü > sektörü seç; kamera geçer, emirler korunur. |
| 10.03 | Sektör raporu — K/Ö/E | Son bilinen durum, rapor zamanı, kaynak ve belirsizlik; gizli kesin istatistik yok. | Sektör ayrıntısı > Son rapor, kaynak ve yaş; anlık veri iddiası yok. |
| 10.04 | Haberci ve emir gecikmesi — K/A/E | Emir gönderildi/yolda/ulaştı; gecikme formülü ve iptal kuralı açık. | Sektör emri > Gönder; haberci/gecikme durumu, onaylı mekanik. |
| 10.05 | Komutanın yetkisi ve görevleri — K/A/E | Tut, ilerle, çekil gibi görev sınırı; oyuncu müdahale edince yetki devri açık. | Komuta > Komutan ve görev; yetki kontrolü. |
| 10.07 | Yedeklerin otomatik tamamlaması — M/E | Gerçek grup kimliği korunur; farklı gruptan asker yanlışlıkla ölenin yerini almaz. | Yedek durumu > Render kapasitesi; arka plan otomasyonu bilgisi, taktik yedek değil. |
| 10.08 | Taktik yedekleri savaşa sokma — Ö/A | Yedek grubu, sektör/konum ve geliş süresi; otomatik kapasite yedeğiyle karıştırılmaz. | Yedekler > Grubu seç, hedef sektör/konum, geliş onayı. |
| 10.09 | Sektörler arası kuvvet aktarımı — Ö/A | Gönderen ve alan sektör, yol/gecikme/tehlike; teleport yok, kapsam onayı. | Kuvvet aktarımı > Kaynak/hedef sektör, yol, süre ve geçerli yetki. |
| 10.10 | Genel strateji — Ö/A | Serbest yönetim, dengeli ilerleme, savunma, kanattan saldırı; gerçek rol, hedef ve emirleri önceden görür, onaylar. Grup sağ tık menüsüne eklenmez. | Genel strateji > Plan seç, grup görevlerini önizle, onay. |
| 10.11 | Stratejiden çıkma ve manuel müdahale — Ö/A | Seçili grubun planı devralınır; diğer gruplar etkilenmez; bütün planı iptal etmek ayrı açık eylem. | Genel strateji > Devral/iptal; yalnız ilgili grup veya bütün plan açıkça. |
| 15.10 | Eksilen safları tamamla | Uygun yedeklerle gerçek takviye; görsel kapasiteden ayrı. | Yedekler > Saf tamamla; uygun asker/kimlik, gerçek kaynak. |
| 15.11 | Üst komuta grubu oluştur | Birden fazla grubu tek görev altında yönet; kalıcı askerleri karıştırma. | Komuta > Geçici üst grup; görev, üyeler ve yetki. |
| 17.01 | Yetkiye göre komuta devral | Yalnız atanmış birlikleri yönet. | Komuta > Devral; yalnız gerçek yetki, gerekçe. |
| 17.04 | Saha ikmalini koru/yenile | Yalnız gerçek ikmal sistemiyle; kaynak, erişim ve tüketim. | İkmal > Kaynak ve görev; yalnız onaylı ikmal sistemi. |
| 21.09 | Takviye giriş alanı ve geliş durumu | Onaylı takviye sistemi varsa giriş bölgesi ve tahmini geliş; gizli rakip bilgisi yok. | Takviye > Giriş alanı, gerçek/tahmini geliş durumu. |
| 21.10 | Sektör haritası ve rapor güncelliği | Aktif/pasif sektörleri ve son rapor zamanını ayırt etme. | Sektör haritası > Son rapor ve aktif/pasif farkı. |

### B — İlgili arka plan kuralları
| ID | İşlev | Envanter kullanım açıklaması | Tasarım bağlantısı |
|---|---|---|---|
| 10.02 | Diğer sektörlerin simülasyonu — K/E | Durum değişimleri özetlenir; eski/pasif simülasyon ile aktif simülasyon tutarlı. | Pasif sektör simülasyonu; ortak zaman ve gerçek sonuç 2.5. |

## Kapsam sonucu
16/16 birincil kayıt ayrıntılandırıldı. Her açılır yüzeyde kapanış/iptal önceki kabul edilmiş durumu korur; gerçek durum, yetki ve veri yoksa koşullu aday uygulanmış gibi gösterilmez. Şemalar yerleşim taslağı, piksel düzeyi nihai görsel değil. Oyun kodu değişmedi; açık mekanik kararları, A–J notları ve 247 kayıt korunuyor. Üçüncü aşama KISS birleştirme/eleme ayrı.
