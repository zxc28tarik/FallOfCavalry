# Fall of Cavalry — WEB V1.75: Gerçek atölye nezaretçisi denetim raporu

**23 Kasım 2026** · Yalnız WEB · PR #68 / `codex/web-world-npc-roster-20261118` (taslak, `main` değil).

## Amaç

V1.74'te oyuncu aynı şehirde yaşayan ve boşta bulunan kayıtlı önemli karakteri gerçek sanayi parseline atayabiliyordu. V1.75'te bu görev, oyuncuya **mevcut gerçek üretim ve hammadde durumunu gösteren sınırlı denetim yetkisi** kazandırır. Nezaretçi mülk sahibi, işçi, lonca üyesi, maaş alacaklısı veya üretim büyüsü değildir.

## Sistem otoritesi ve entegrasyon

- `city-workshop-supervision.js`: önce var olan `listCityWorkshopStewards` doğrulamasını kullanır; geçerli `assignmentSource`, aynı şehirde yaşayan canlı NamedCharacter, oyuncu şehir yönetim yetkisi ve görevin başlama günü şarttır. Kimliksiz, sahte, kilitli, silinmiş, yabancı veya başka şehre taşınmış kayıt rapor üretemez.
- Kaynak binanın kimliği `getCityWorkshopContacts` içindeki **gerçek City V2 parselinden** alınır. Bir dükkânın yalnız karakter kökeni olması atama hakkı vermez.
- Denetim `getCityWorkshopOperatingReport` ve `planCityMarketProduction` üzerinden mevcut şehir pazarı stoklarını yalnızca **okur**. Raporun `plannedBatches`, `maxBatches` ve girdi bilgileri günlük üretimin zaten kullandığı planlayıcıdandır.
- `city-services.js` şehir iaşesi içindeki nezaretçi satırında kısa durum raporu, üretim engeli, mevcut hammadde ve günlük stok işleme durumunu gösterir. Ek bir kalabalık panel açılmaz.
- Aynı türden birden fazla gerçek tesis varsa planlanan partiler **şehirdeki aynı bina türünün toplamıdır**, atanan tek nezaretçinin veya tek parselin bireysel üretimi değildir.
- Bilinen ancak pazar reçetesi henüz tanımlanmayan Sabunhane vb. binalar için hesap uydurulmaz: **reçete tanımsız** durumu gösterilir.
- Pazar açılmamışsa üretim ve stok uydurulmaz; bugünün döngüsü işlendiyse tahmin sonraki çevrim için olarak etiketlenir.

## Ekonomi ve save etkisi

`getCityWorkshopStewardAudits` salt-okunurdur. `state.markets`, `cityState`, `characterOrganization`, `worldCharacters`, `party.gold`, market hareket günlüğü ve kayıt sürümü değişmez. Üretim planına müdahale etmez. Otomatik tedarik, ücret, mülkiyet, işletme kârı, karakter statı, maaş ve verimlilik bonusu yoktur. Varsayılan oyuncu başlangıcı, Unity, harita, asker ve battle kodları değişmez.

Bu *yetki* şimdilik **denetim ve oyuncuyu bilgilendirme** seviyesindedir; stok üzerinden satın alma, üretim emri, yönetim talimatı veya çalışan ataması ayrı tasarım/karar gerektirir.

## Test kapsamı

`tests/unit/city-workshop-supervision-v175.test.js`: atanmış/atanmamış kişi, gerçek üretim planına tam denk gelen tahmin, stok eksikliği ve depo tıkanması, tanımsız reçete, market yokluğu, yabancı şehir, ölü/taşınmış kişi veya yıkılmış bina, tamamlanmış görev, sahte assignmentSource, gelecekte başlayan görev, günlük işleme sınırı, yan etkisiz okuma ve oyuncu altını.

Önceki V1.72–V1.74 regresyonlarının korunması gereklidir. Bu paket henüz tüm testlerin geçtiği anlamına gelmez: güncel son SHA üstündeki CI ve tarayıcı kabul testleri ayrıca doğrulanmalıdır. Başarısız testleri skip/ignore ile gizleme.

**Durum:** V1.75 uygulaması PR #68 dalına eklendi; CI sonucu ayrıca kontrol edilecek. PR hâlâ **DRAFT / UNMERGED**; kullanıcı onayı olmadan main'e merge yapılmayacak.
