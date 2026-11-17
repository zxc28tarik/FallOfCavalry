# FOC WEB — İLERLEME AĞACI VE İŞ KARTLARI (V1)

**Toplam iş paketi:** 72. Bunların 3 tanesi çizim/sanat için donduruldu.

**Durum:** Bu kartlar yapılmış işler değil, ileride kapanacak denetlenebilir görevlerdir.**

| Kısaltma | Anlamı |
|---|---|
| P0 | Oyunu/ilerlemeyi bloke eden risk |
| P1 | Temel oynanış/entegrasyon |
| P2 | Derinlik/tutarlılık/kalite |
| S / M / L | Göreli karmaşıklık; gün/saat taahhüdü değil |

## Kilit ve sıralama

```text
G-001 → T-001 → T-002 → T-003 → F-001 → F-002 → F-003
                     ↘ S-001 → F-005 → ... → S-005
F-002 → W-001 → W-002 → W-003 → W-004 → D-001
F-005 → E-001 → E-002 → E-003/E-004/E-005 → C-002/C-004/Q-003
F-003 → B-001 → B-002 → B-003 → B-004 → B-005/B-006 → B-007 → B-008 (ONAY)
Q-002 → Q-003 + Q-004 → Q-005 → Q-006 → Q-007
ART → DONDURULDU
```

## Faz 00

| ID | İş | Ön koşul | Öncelik | Karmaşıklık | Bitiş/kanıt ölçütü |
|---|---|---|---|---|---|
| G-001 | Web/Unity repo sınırı ve main HEAD kaydedilsin | — | P0 | S | Kapsam raporunda tek repo ve commit SHA doğrulansın |
| G-002 | Work-package, bug, karar, test şablonlarını üret | G-001 | P0 | S | Her ID kaynak, ön koşul ve kabul ölçütü taşısın |
| G-003 | Açık PR #28–30 ile merged #31–33 diff eşleştir | G-001 | P2 | M | Yinelenen kod ve farklılık matrisi, kapatma önerisi |
| G-004 | Unity temalı dalları provenance tablosuna koy | G-001 | P2 | S | Web main'e aktarılamayacak dallar ayrılmış olsun |
| G-005 | Tüm modüller için KEEP/REPAIR/INTEGRATE/REPLACE/DEFER | G-002 | P2 | M | Dosya bazında gerekçe ve test bağlantısı kaydedilsin |

## Faz 01

| ID | İş | Ön koşul | Öncelik | Karmaşıklık | Bitiş/kanıt ölçütü |
|---|---|---|---|---|---|
| T-001 | main'den temiz bağımsız çalışma kopyası ve npm ci | G-001 | P0 | S | Kurulum adımları ve bağımlılık hataları yazılsın |
| T-002 | npm run validate ile lint unit ve build raporu | T-001 | P0 | S | Exit code, test sayısı, warnings ve log kanıtı |
| T-003 | Start ve map tarayıcı smoke testi | T-002 | P0 | M | Başlangıç ekranı ve dünya haritası hatasız, console/network logu |
| T-004 | Web odaklı GitHub Actions CI kurulması | T-002 | P1 | M | PR ve main için lint, unit, battle test, build kırılınca kırmızı |
| T-005 | Deterministic fixture ve test seedleri | T-003 | P1 | M | Aynı seed ile aynı kritik state hash ve tekrarlanabilir log |
| T-006 | Kaynak asset 404, yükleme, fallback, uyarı denetimi | T-003 | P2 | M | Asset fallback bilerek ayrılmış, fatal request yok |
| T-007 | Build bundle, debug erişimi, devtools ve üretim konsolu audit | T-002 | P2 | S | Ana bundle ve üretim warning listesi sayısal rapor |
| T-008 | Issue risk reprodüksiyonu ve H-ID kanıt güncelleme | T-003 | P2 | M | Her risk kanıtlı bug/bug-değil/ölçülemedi sınıflı |

## Faz 02

| ID | İş | Ön koşul | Öncelik | Karmaşıklık | Bitiş/kanıt ölçütü |
|---|---|---|---|---|---|
| F-001 | Start new game continue map girişleri | T-003 | P0 | M | Tüm giriş kapıları doğru sahnede ve state'te biter |
| F-002 | map city encounter ve overlay geri dönüşleri | F-001 | P0 | M | Kaçak mode veya overlay yok, Escape dönüşleri doğru |
| F-003 | Canvas deploy battle aftermath dönüş smoke | F-002 | P0 | L | Zafer yenilgi çekilme sonrası campaign state geçerli |
| F-004 | Asker alım ve harcama günlük sayacı | F-001 | P1 | M | Para ve roster doğru; negatif alt limit ve pool cooldown |
| F-005 | Save load golden campaign roundtrip | F-003 | P1 | L | Altın gün roster şehir ve savaş sonucu yükleme sonrası aynı |
| F-006 | Durdurma devam ve uzun oturum mod invariant | F-003 | P1 | M | Pause/day tick yanlış çift yürümüyor |
| S-001 | Current SaveManager alan/sürüm/atomiklik analizi | T-003 | P0 | M | Authoritative State envanteri ve kayıp alan listesi |
| U-001 | Mevcut HUD hotkey modal/control doğruluğu | F-002 | P2 | M | Çakışan kısayol ve takılı overlay yok |

## Faz 03

| ID | İş | Ön koşul | Öncelik | Karmaşıklık | Bitiş/kanıt ölçütü |
|---|---|---|---|---|---|
| W-001 | 1648 owner terrain binary ve 19 faction verisi doğrulama | T-005,F-002 | P1 | M | Her owner ID manifestte, harita sınırları geçerli |
| W-002 | Yerleşim ve rota koordinat/çarpışma denetimi | W-001 | P1 | M | Party yürünebilir alan ve yol kararında geçersiz koordinat yok |
| W-003 | WorldParty spawn/despawn/encounter lifecycle | W-002 | P1 | L | Aynı party iki kez ödül veya savaş üretmez |
| E-001 | 34 mal ID alias ve legacy migration denetimi | F-005 | P1 | M | Eski grain/tools ID ile kayıtta mal kaybı yok |
| E-002 | Alış satış fiyat stok para işlem tutarlılığı | E-001 | P1 | L | İşlem iki kez yapılmaz; stok/para negatif veya NaN olmaz |
| E-003 | Kervan gerçek taşıma yük boşaltma risk P&L | E-002,W-003 | P1 | L | Kaynak bir şehirden çıkar diğerine girer, eşzamanlı çoğalmaz |
| E-004 | Günlük asker maaşı/erzak/kamp muhasebe bağlantısı | E-002,F-004 | P1 | L | Tek day tick'te bir kez tüketim, kaynak sınırı korunur |
| E-005 | Şehir üretim tüketim mal stok döngüsü | E-002 | P2 | L | Girdisiz çıktı üretimi ve çift tüketim yok |
| C-001 | Alan doluluğu, sabit iç kale, bina/servis state tutarlılığı | F-002,E-001 | P1 | M | Deterministic CityState + save roundtrip |
| C-002 | Kethüda altyapı rule ve maliyet/yeterlilik modeli | C-001,E-002 | P1 | L | Kurma işleminde maliyet alınır; bakım ve fayda idempotent |
| C-003 | Kethüda mevcut panellerle işlevsel UI | C-002 | P2 | M | Yeni grafik olmadan bütçe/kurulum/sonuç görülebilir |
| C-004 | Kadılık-Medrese-Defterhane etki zinciri | C-001 | P2 | L | Asayiş memur kalitesi rapor seviyesi beklendiği gibi değişir |
| C-005 | Reisülküttab Bostancılar etkileri | C-004,W-004 | P2 | L | Diplomasi başarı/güvenlik/kayıp etkileri kaynakla test |
| Q-001 | Encounter option/cooldown/effect standardizasyonu | F-002,W-003 | P1 | M | Tek seçim tek sonuç, pusu ve trade dönüşü doğru |
| Q-002 | Gerçek dünya eventlerinden quest objective ilerletme | Q-001,T-005 | P1 | L | Görev sadece doğru ID ve doğru olayla ilerler |
| Q-003 | Complete reward world effects ve idempotency | Q-002,E-002 | P1 | M | Görev tekrar ödül vermez ve kaynak bilançosu korur |
| Q-004 | Quest süre aşımı ve day tick bağlantısı | Q-002,F-006 | P1 | M | Süre dolunca bir kez başarısız olur, oyun yeniden açınca doğru |
| Q-005 | Aktif/biten/başarısız quest save schema ve migrate | Q-003,Q-004,F-005 | P1 | L | Save/load roundtrip'te görevler kopyalanmaz ve kaybolmaz |
| S-002 | Legacy fixture ve bozuk JSON/load recovery | S-001,F-005 | P1 | L | Eski save bozulmaz; malformed input çökertmez |

## Faz 04

| ID | İş | Ön koşul | Öncelik | Karmaşıklık | Bitiş/kanıt ölçütü |
|---|---|---|---|---|---|
| W-004 | Savaş/barış ve şehir ele geçirme ile owner consistency | W-003,F-005 | P1 | L | Warstate ve city owner save/load sonrası korunur |
| W-005 | 3M hücre zoom/pan ve bellek profil ölçümü | T-005,W-002 | P2 | M | Hedef makine/cihaz kaydı, fps, bellek, anlık takılma |
| W-006 | AI devriye/kervan/haydut uzun kampanya simülasyonu | W-003 | P2 | L | Çökmeyen yüzlerce gün, state invariant ve performans logu |
| E-006 | Kıtlık savaş vergi fiyat ve ledger denge senaryoları | E-003,E-004,E-005 | P2 | L | Fiyatlar kontrollü sınırda; beklenen nedenler UI'dan izlenir |
| C-006 | Nüfus zenginlik sağlık asayiş cross-effects | C-002,C-004,E-005 | P2 | L | Pozitif/negatif etki tabloları ve clamp invariantları |
| C-007 | Üretim binaları açılma koşulları ve stok etkisi | C-006,E-005 | P2 | L | Ön koşul yoksa açılmaz; mal tüketimi/üretimi tutarlı |
| Q-006 | Quest completion overlay ve journal/doğruluk | Q-005 | P2 | M | UI state ve görev state aynı; ödül seçimi tek kez |
| Q-007 | Eski contract board ile çift görev ayrımını denetle | Q-006 | P2 | M | Tek event iki mükafat doğurmuyor; mevcut kontratlar çalışır |
| D-001 | Faction relation-war peace trade-price etki zinciri | W-004,E-002 | P1 | L | Her aksiyon gerekçeli state diff ve maliyet üretir |
| D-002 | Diplomatik aksiyon ve kurum rule uyuşumu | D-001,C-005 | P2 | M | Diplomasi UI ve Rule sonuçları tutarlı |
| D-003 | Faction AI aynı kaynak ve dünyayı kullanır | W-006,D-001 | P2 | L | AI stok/para/erişilemeyen bilgi hilesi yapmaz |
| D-004 | Uzun kampanya ekonomi savaş ve AI karar dengesi | D-003,E-006 | P2 | L | Seedli uzun sim sonuç raporu + inflection senaryoları |
| S-003 | Quest ekonomi dünya/savaş persisted state consistency | S-002,Q-005,E-004 | P1 | L | Tüm kritik state değerleri reload eşit |
| U-002 | Sistem etkileri UI sayısal görünümü | C-004,Q-006 | P2 | M | UI ve authoritative state her testte aynı |

## Faz 05

| ID | İş | Ön koşul | Öncelik | Karmaşıklık | Bitiş/kanıt ölçütü |
|---|---|---|---|---|---|
| B-001 | Eski Canvas golden senaryo kütüphanesi | F-003,T-005 | P0 | L | Hasar formasyon moral ammo çekilme sonuç sabitlenir |
| B-002 | Canvas/Phaser ortak battle input ve outcome sözleşmesi | B-001 | P1 | L | Her alan ownership ve result mapping testleri |
| B-003 | Phaser flag ve runtime start/end error handling | B-002 | P1 | M | Toggle açık/kapalı akışlar çalışır; event listener sızıntısı yok |
| B-004 | Deploy sektör komuta pasif sektör simülasyon parity | B-003 | P1 | L | Sektör geçişi canlı asker sayısını değiştirmez |
| B-005 | Modüler SoldierContainerPool ana SectorRenderer entegrasyonu | B-004 | P1 | L | F10 ile battle aynı resolver; pool leak/double release yok |
| B-006 | Casualty ammo morale loot ve faction result tek commit | B-004,B-002,E-004 | P1 | L | Battle sonucu kampanyaya bir kez yazılır; save roundtrip |
| B-007 | 300 görünür asker ve katman benchmark | B-005,B-006 | P1 | L | FPS/cpu/gc/memory karşılaştırma; donanıma göre sınırlar |
| B-008 | Canvas → Phaser üretim geçişi için kullanıcı kapısı | B-007,B-006,D-004 | P0 | S | Parity raporu + risk + onay; onay olmadan toggle değişmez |
| S-004 | Mid-battle/save edge-case ve aftermath crash recovery | S-003,B-006 | P1 | L | Kısmi sonuç çift uygulanmaz; safe recovery |

## Faz 06

| ID | İş | Ön koşul | Öncelik | Karmaşıklık | Bitiş/kanıt ölçütü |
|---|---|---|---|---|---|
| S-005 | Schema version migrator ve yükleme diagnostik | S-004 | P2 | L | V1/V2 fixture uyumu, migration log ve rollback |
| U-003 | Dev UI, dil, erişilebilirlik, input hata düzeltme | B-007,S-005 | P2 | M | Ekran akışı ve küçük ekran klavye testi |
| R-001 | Temiz environment release build/export | T-004,S-005 | P1 | M | Kilitli Node/npm ve dist doğrulaması |
| R-002 | Chrome Edge Firefox ve düşük donanım smoke | R-001,W-005,B-007 | P1 | L | Tam senaryo ve bellek ölçümü kaydı |
| R-003 | Telif lisans provenance manifesti | R-001 | P1 | L | Her dağıtılan assetin lisansı ve kökeni belgeli |
| R-004 | Release candidate regression ve rollback | R-002,R-003,D-004 | P1 | M | Kritik bug=0; rollback prova ve final release notu |

## Faz ART

| ID | İş | Ön koşul | Öncelik | Karmaşıklık | Bitiş/kanıt ölçütü |
|---|---|---|---|---|---|
| A-001 | Yeni İstanbul/diğer şehir base ve overlays | — | P3 | L | Kullanıcı sanat fazını açmadan başlamaz |
| A-002 | Tarihsel asker 4/8 yön atlasları | — | P3 | L | Kullanıcı sanat fazını açmadan başlamaz |
| A-003 | Harita biyomu, çevre sprite ve polish | — | P3 | L | Kullanıcı sanat fazını açmadan başlamaz |

## Etiket ve kanıt kuralı

- `AÇIK → DEVAM_EDİYOR → TEST_BEKLİYOR → TAMAMLANDI` ancak gerçek test/PR kanıtıyla ilerler.
- Bir hata tekrar üretilemiyorsa `NOT_REPRODUCED` yazılır, otomatik `FIXED` olmaz.
- Bir paket bağımlısı tamamlanmadıysa `BLOKLU` kabul edilir.
- Kabul sonucunun yanına test komutu, pass/fail/skip, commit ve gözlem eklenecek.
- Her aşamada en az bir campaign smoke ve geçerli save fixture korunur.
- Tablodaki öncelikler mühendislik önerisidir; kullanıcı büyük sistem değişimlerine ayrı onay verir.