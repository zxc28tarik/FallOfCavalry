# Fall of Cavalry WEB V1.73 — Gerçek zanaat kaynağı ve karakter provenansı

**23 Kasım 2026** · `codex/web-world-npc-roster-20261118` · PR #68 (taslak), yalnız web prototipi.

## İncelenen tasarım otoritesi

`FOC-Karar-Defteri-Guncel.md` (09.07.2026):
- Şehir V2 **Üretim / Zanaat** gerçek alanını ve on zanaat türünü tanımlar; **Gıda / İkmal** altındaki fırın ve değirmeni bu alanla karıştırmaz.
- Karakter bulma kaynakları arasında işletme, maden, han, kervansaray ve üretim yerleri vardır; pazar doğrudan adam toplama kaynağı değildir.
- Tüccar hizbi ticari ağıdır; **malın sahibi hizip değil, karakterdir**.
- Atölye işçisi ücret oranı, işletme sahipliği mirası, kira, gelir dağıtımı veya belirli karakterin otomatik atama yetkisi **burada kesinleştirilmemiştir**.

Dolayısıyla tek bir zanaat binasına NPC yakınlığını ücretli çalışanlık veya mülkiyet diye sunmak kesin oyun tasarımını ihlal eder.

## Gerçek uygulama

### A. Kaynak-bina/kişi ilişkisi

`js/systems/city-workshop-contacts.js` → `getCityWorkshopContacts(city, roster)`:

1. `discoverCharacterProductionSources([city])` çağırarak başka bir bina kataloğu veya rastgele meslek üretmek yerine **mevcut, kayıtlı imalat kaynağı** listesini kullanır.
2. Her üretim kaynağının `cityId + parcelId + buildingId` fiziksel kimliğini mevcut City V2 gerçek parsellerine bağlar.
3. Eşleştirmeyi yalnız **hâlâ o şehirde yaşayan, hayattaki `NamedCharacter`** için yapar. Kişinin mevcut/karakter listesindeki kimliği, kaynak temelli `npc:source-production~cityId~sourceId:N` ile ve orijinal `history.created.sourceType/sourceId` kaydıyla aynı anda eşleşmelidir.
4. Silinen bina, kilitli parsel, ölmüş kişi, başka şehre taşınan kişi, oynanmamış transiyent karakter veya kendisine imalathane geçmişi yazılmış fakat ID'si o kaynaktan gelmeyen kişi bağlanmaz.
5. Yalnız `{sourceId,parcelId,buildingId,contacts:[{characterId,name,role,importance}]}` kopya verisini döndürür; karakterleri, şehirleri, pazarları veya kayıtları değiştirmez. Üretim artışı/gelir/tayin otomatik oluşmaz.

### B. Gerçek üretimde kilitli parsel denetimi

`js/systems/city-market-cycle.js` içindeki kurulu atölye sayacı City V2 `parcel.state === 'locked'` durumunu artık üretim sayısından çıkarır. Fiziksel olarak kilitli zanaat kaynakları, karakter kaynak keşfindeki mevcut kuralla eşleşir. Fırın ve değirmen dâhil hiçbir tarif bu parsellerden ürün çıkaramaz.

### C. Şehir UI

Şehir İaşesi altında `Zanaat Kaynağından Tanınan Karakterler` açılır bölümünde her mevcut endüstri binasının parsel bilgisi ve kaynak üzerinden **gerçekten kalıcılaştırılmış** NPC bağlantıları görülür. Tıklanınca var olan `open-npc` üzerinden karakterin gerçek profili açılır. Sıfır bağlantı varsa bunun işçi kıtlığı, kapanan fabrika veya üretim engeli olduğu söylenmez.

Üretim kaynağı tanımı sadece **INDUSTRY** kategorisine aittir; `mill/bakery` gıda üretimi yapmaya devam eder fakat bunlar üretim alanı NPC kaynağı sayılmaz. Yeni NPC üretilmez, işe alınmaz veya yüklü şehirlerin tamamında pahalı tarama yapılmaz.

## Bilinçli uygulanmayan kararlar

- Bir kaynaktan gelen karakter = işletme sahibi veya o binada **şu an çalışıyor** kararı **yok**.
- Esnaf loncası/karakter malları ve pazar stokları ortak mülkiyet halinde birleştirilmedi.
- İşçi maaş hesabı, atölyenin finansal sorumlusu, işveren hazinesi veya gelir dağıtımı açılmadı.
- Karakter/şehir kayıt formatı değiştirilmedi; yeni sistem kaydedilmez, girişte mevcut gerçek kayıttan tekrar türetilir.
- Her karakter otomatik kurumsal rol veya yetki almaz. Mevcut `character-organization` manuel görevlendirmesini yan yoldan atlamaz.

## Doğrulama

`tests/unit/city-workshop-contacts-v173.test.js` 8 vaka: kayıtlı üretim karakterine fiziksel bağlantı; sıradan/meslek benzerliği sahteciliği; kaynak geçmişi ve ID uyuşmazlığı; ölüm/yer değiştirme; kilitli/silinmiş atölyelerde üretim ve kaynak engeli; gıda/pazarın üretim kişisi üretmemesi; `cityId=0` ve `parcelId=0`; raporun para/mülkiyet/görev oluşturmayışı.

Son SHA için Web validation + tek-HTML tarayıcı dosya testi + Chromium tam dünya smoke birlikte PASS olmadan V1.73 tamamlandı denmez. PR taslak kalır; `main` birleştirmesi yok.

## Gerçek işletme sahipliği için eksik otorite

Sonraki bir uygulamada açıkça kayıt edilebilir `WorkshopOwnership` veya eşdeğer **karakter bazlı ve bina/parsel bazlı** sahiplik sözleşmesi, maaş alacaklısı, ödeme kaynağı, işletme kasası ve tasarruf/ölüm/miras kuralları ayrıca kararlaştırılmalı. Bu V1.73 bağlantısı bir sahiplik tablosu değildir.
