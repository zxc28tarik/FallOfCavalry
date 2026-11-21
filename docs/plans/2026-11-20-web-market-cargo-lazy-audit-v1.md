# Fall of Cavalry WEB — V1.36: Gereksiz Dünya Taramalarının Kaldırılması ve Oturumluk Ganimet Günlüğünün Sıfırlanması

**Tarih:** 20 Kasım 2026.  
**Depo:** `zxc28tarik/FallOfCavalry`, **yalnız WEB**; masaüstü Unity ayrı projedir.  
**Dal / PR:** `codex/web-world-npc-roster-20261118`, [taslak PR #68](https://github.com/zxc28tarik/FallOfCavalry/pull/68); **main'e birleştirilmedi**.  
**Görev kapısı:** O00-06 genel iş **UYGULAMADA**; V1.36 alt dilimi doğrulanmıştır.

## Neden

V1.34–35'te 881 şehirli dünyada oyuncu için filtreli, sayfalı ve güvenli CSV'li bir **Mal Hareketleri** raporu oluşturuldu. Ancak panel her karakter girişinde, sayfa değiştirmede ve hatta yalnız haydut veya hareket sekmesinde olsa bile `auditCampaignMarketStocks` ile bütün şehirleri hesaplıyordu. Bu hem CPU/bellek maliyetiydi, hem de filtre sırasında rapora bakarak sık sık verilerin yeniden taranması demekti.

Diğer açık: `resetMarketMovementJournal` eski ticari işlem gözlem geçmişini yeni oyun ve kayıt yüklemede sıfırlarken V1.32'nin `cargoDispositionLedger` **eski oyuncu/haydut gözlem olayları** aynı bellekte tutuluyordu. Bunlar yeni save oturumunun raporunda görünmemeli, ancak oyuncunun meşru kaydedilmiş ganimeti de kesinlikle geri alınmamalıydı.

## Gerçek kod değişiklikleri

1. **`js/systems/market-cargo-report.js`**: `buildMarketCargoReport` artık seçmeli `section: 'stock' | 'movements' | 'escorts' | 'dispositions'` argümanıyla dört gerçek kategoriyi **yalnızca istendiğinde** üretir. `'movements'` veya `'dispositions'` için ne 881 şehrin stok defterine ne de canlı NPC koleksiyonuna bakılır; `'stock'` için escort WeakMap envanteri okunmaz. `computedSections` ve `stockAudit.scanned` meta alanları hangi hesaplamanın yapıldığını açıkça belirtir. **`section='all'` varsayılanı değişmedi**: eski `EconomyManager` ve önceden yazılmış read-only test araçları aynı tam raporu almaya devam eder. Eksik kategoriler **0 stok** veya eşit sayılar iddiası yerine `scanned=false` ile belirlenir.
2. **`EconomyManager.buildCargoMarketReport(settlementId,limit,section)`**: eski iki parametreli kullanım değişmedi; oyuncu paneli üçüncü kategoriyi yollayarak boş yere başka sistemleri gezdirmez.
3. **`js/ui/CargoMarketReportPanel.js`**: şehir veya kategori seçilince veya **Yenile** düğmesine basılınca yeni gerçek anlık snapshot hazırlanır. **Arama klavye girdileri, ürün, işlem türü, 10/20/50 sayfa boyutu ve sayfa ileri/geri** yalnız `renderCached()` ile aynı görüntüyü filtreler; ekonomi / şehir / kervan API'sini tekrar çağırmaz. **CSV indir** görünür filtrelerin aynı görüntüsünü aktarır, farkına varmadan yeni ekonomik gündeki veriyle birleştirme yapmaz. Veriler değişmiş olabileceği için kullanıcı Yenile'ye basabilir veya raporu yeniden açabilir.
4. **Geçersiz snapshot temizliği**: `CargoMarketReportPanel.invalidate()` eski raporu ve önbelleklenmiş şehir seçeneklerini siler ve paneli kapatır. Yeni oyun ve Save/Load'da eski rapor **yeniden kullanılmaz**. Menüye ve savaş ekranına geçişte panel gizlenir.
5. **`js/systems/quest-escort-cargo.js`**: yeni `resetCargoDispositionJournal()` sadece son 128 adet **süreç-yerel gözlemsel mal akıbeti fişini** temizler. Gerçek `liveCargo` ve `banditCargo` WeakMap kaynaklarının, kazanılmış oyuncu `inventory.items` verisinin, loot savaş fişinin veya şehir stoğunun yeniden yazılması yok.
6. **`GameFlowManager.startNewGame` ve `SaveManager.applySavePayload`**: mal hareketleri + haydut akıbeti geçmişi temizlenir; panel geçersizleştirilir. Dünya üzerindeki gerçek mal kaynakları ve eski-save otorite politikası değiştirilmedi.
7. **`tests/unit/market-cargo-lazy-audit.test.js`**: 5 yeni test. Hareket sekmesinde **bilerek hata fırlatan şehir iteratörü/pazar proxy'si/WorldAI parties getter'ının** hiç çağrılmaması; stock-only modda WorldAI çağrısı olmaması; eski `all` / yeni seçmeli sonuç eşitliği; loot-only raporun harita taramaması; gerçek kaynaklı 20 birim kervandan çalınan 5 birimin ölüm nedeniyle kayda geçtikten sonra günlüğün silinmesinin gerçek mal muhasebesini değiştirmemesi.
8. **`tools/browser-world-smoke.mjs`**: gerçek kullanıcı paneli `EconomyManager.buildCargoMarketReport` çağrı sayacına bağlanarak tarayıcıda test edildi. Gerçek 881 şehir haritasında paneli açmak sadece `movements`i hesapladı. Klavyede birden fazla ürün/metin araması, filtre ve sayfa boyu değişimi **0 ek rapor çağrısı** yaptı. Şehir ve stok sekmesi değişimi birer çağrı, gerçek Yenile ek bir çağrı yaptı; toplam istek dizisi tam `movements,movements,stock,stock` (**4** çağrı), gezinme **1→2→1** doğru ve ek tarama yok.
9. Gerçek NPC savaşında kanıtlı 4 `iron` oyuncu envanterine gerçek savaştan çıktıktan sonra **tek defa** geçti. `custody` geçmişi yüklemeden **önce** doğrulandı, gerçek `quickSave/quickLoad` sonrasında `dispositionJournalCleared=true` kontrol edildi; `durable=true`, `noDoubleClaim=true`, `goldUnchangedFromClaim=true`, `conservationGap=0`.

## GitHub kabul kanıtları

**Kod SHA:** `fa4cb98fa6a139010466652e3fc139fd45614664`.

- [Web validation #44723597301](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44723597301): **PASS**. 793/793 birim, 1205/1205 genel + 1 skipped; ESLint, build, repository hijyeni başarılı. Harita yapısı **881 yerleşim, 304 yol, 3 nehir, 4 geçiş, 0 hata**, önceki 1 uyarı korunuyor.
- [Gerçek Chromium #44723597334](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44723597334): **PASS**; gözlem `firstSnapshot=1`, `callsAfterInputs=1`, `callsBeforeRefresh=3`, `callsAfterRefresh=4`, `lazyMovement=true`, `stockSnapshot=true`, `unchangedFilters=true`, **0 konsol hatası**. `dispositionJournalCleared=true` ile gerçek 4 demir oyuncu envanterinde kaldı.
- Eski plan ve önceki seviye testleri korunuyor; bir ESLint `no-duplicate-imports` uyarısı bu sürümde düzeltilip **son kod SHA** başarılı doğrulandı. Başarısız ara CI'lar nihai sonuç olarak gösterilmez.

## Korunan sınırlar / sonraki iş

- Bu çalışma **raporun gereksiz çağrı sayısını azalttı**. Tek başına CPU profili, gerçek kare süresi, gigabayt cinsinden peak-memory veya çok büyük kronolojik ekonomik geçmiş ölçümü yapıldığı iddia edilmez. Açık stok sekmesi Yenile'ye basılınca geçerli iki pazar defteri aynı eski read-only yöntemle analiz edilir.
- `movements` son 160, `cargoDispositions` son 128 oturum olayını içerir; rapor **kalıcı ekonomik muhasebe defteri değildir**. Kayıt yüklemeden sonra eski haydutun mal sahipliğini güvenilir hale getirme işi hâlâ **yapılmamıştır**.
- `main`, Unity, resmî D00/D01 tarihsel coğrafya veya G00–G14 görselleri değiştirilmedi. Eski iki farklı pazar defteri otomatik birleştirilmedi. O00-06 **UYGULAMADA** tutulur.

**V1.37 güvenli adayı:** Gerçek dünya haritasında oyuncu paneli yoğun kullanılırken CPU zamanı ve bellek üst sınırı ölçen otomatik profil; açık panel / harita FPS profili kıyası; kullanıcı onayı olmadan gameplay/economy kuralları veya eski kayıt defteri otoritesini değiştirmeden temiz rapor darboğazlarını saptama.
