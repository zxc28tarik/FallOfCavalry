# Fall of Cavalry WEB — Character System v2 V1.27: Kaynak Şehir Stoklu Kervan Yükü / Canlı Haydut Ganimeti

**Tarih:** 19 Kasım 2026 · **Repo:** `zxc28tarik/FallOfCavalry` (WEB) · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) — DRAFT / UNMERGED. **Üst O00-06:** UYGULAMADA. **V1.27:** gerçek stok bağlantısının ilk uygulanabilir dilimi **QA PASS**; tüm ticaret-ekonomi sistemi tamamlandı anlamına gelmez.

## Neden?
V1.26'nın `escortCargo=100` sayacı yalnız yüzdelik durumdu; eşyanın kaynağını, türünü, düşen stok miktarını veya haydudun elde ettiği somut malları temsil etmiyordu. V1.27, mevcut `EconomyManager.ensureSettlementMarketState` ve `settlement.marketStock` veri modeline **yeni sahte mal türleri üretmeden** bağlanan ilk adımı uygular.

## Kod değişiklikleri

1. **`js/systems/quest-escort-cargo.js`:** Yalnız `validEscortQuest` ile doğrulanmış gerçek `roadBacked` rota, canlı `spawnQuestEscortCaravan` kimliği, aynı görev/başlangıç/hedef şehir eşleşmesi ve katalogdaki gerçek item ID'leri üzerinden kaynak şehirden en fazla **24 adet** mal, ilk en fazla üç geçerli `marketStock` satırından ayrılır. Stok kalemi negatif/NaN veya katalog dışıysa alınmaz. İlgili `settlement.marketStock.qty` **gerçekten azalır**. Stock yoksa tür uydurulmaz; eski yüzde HUD/görev hâlâ işler.
2. **`WorldPartyManager.ensureActiveQuestCaravans`:** `EconomyManager.ensureSettlementMarketState` gerçek harita başlangıç yerleşimi için çağrılır; orijinal oyun market stoğundan rezervasyon yapılır. Bu aşama `worldAi.parties` içine gerçek kervan ve V1.26'nın üç ayrı koruma aktörünü ekler.
3. **Gerçek baskın/kayıp:** `runEscortNpcSkirmish` hâlâ V1.26'nın doğrulanmış haydut/rota/mesafe kontrolünü kullanır. Yüzdelik kargo azaldığında, **kümülatif oranla uyumlu tamsayı kadar** eşya güvenilir `WeakMap` kervan manifestinden düşülür; aynı JS oturumundaki gerçek kaynak haydutun `WeakMap` loot'una geçirilir. Aynı hasar ikinci kez eşya üretmez. Sahte `BattleManager` zaferi, altın veya görev ödülü üretilmez.
4. **Varışta kaynaklı teslim:** `recordVerifiedCaravanArrivalEvent` başarılı olduğunda ve `QuestManager` henüz objective'i kredilemeden önce, kalan gerçek mallar `route.to.marketStock` içine eklenir. Tek seferlik aktarım; görev tamamlanması yine oyuncunun özgün `Kervan güvenli ulaştı` butonu ve mevcut QuestManager yolundadır.
5. **Save/Load uyumu:** Kervan ve guard worldAI partileri ile process-only loot kanıtı hâlâ authoritative save'de bulunmaz. `outstandingEscortCargoForSave` yalnız gerçekten canlı ve yolda olan kervanın **kalan** yükünü **kaynak şehrin kaydedilen marketStock snapshot'ına** geri ekler. Runtime stoğu değişmez. Yeniden yüklenen aktif görev gerçek şehirden yeniden kervan kurduğunda aynı transit yükü iki kere eksiltmez. `settlementsMarkets` için ID=0 da kaydedilir.
6. **HUD:** `QuestEscortHud` katalogdaki gerçek mal adını ve kalan adetleri güvenli `textContent` ile gösterir; kaynak mal bulunmazsa sahte liste üretmez.

## Kısıtlar / doğru temsil

- Bu dilim **`settlement.marketStock`** modelini kullanır. Kod tabanındaki ayrı `state.markets[].stocks` mikroekonomi modeliyle çift yönlü tam konsolidasyon henüz yapılmadı; ikisini tek otorite gibi göstermeyin.
- Kervan hâlâ asker/eşya kapasitesinden ayrı **yüzdelik 100 kargo durumu** da taşır. Tür bazlı kargo, yüzde düşüşüyle tamsayıya yuvarlanan yeni küçük kayıt katmanıdır; kapsamlı ticaret muhasebesi değildir.
- Bandit loot yalnız **process-local kanıttır**: kayıt dosyasına authoritative olarak taşınmaz ve oyuncuya dağıtılan ganimet/şehir pazarı satışı değildir. Bandit gerçekten öldürülürse bu geçici loot aktarılmaz; daha sonra ekonomik transfer ve ganimet hukuku tasarlanmalıdır.
- Devam eden refakat soğuk reload sonrasında yeniden başlangıçtan üretildiği için **kervanın tam HP/guard/rota/kargo mücadele geçmişi** sürdürülmez; save snapshot'ı stok çift sayımı önlemek içindir, sahte başarı kanıtı değildir.
- Başarısız görev sırasında kalan kervan yükü kaynak şehre otomatik dönmez (ticari kayıp); ticarî sigorta, kurtarılabilir ganimet ve saldırganın kaynaklı satış rotası uygulanmadı.
- Testler yol kaynağı, sahte/klon kayıt reddi, stok eksiltme, saldırgana transfer, varışta stok ekleme ve snapshot iadesi için yazıldı. **Gerçek elle oynanan uzun açık dünya dinamik ekonomi testi ayrı kabul kapısıdır.**
- `O00-06` (AI, diplomasi, fraksiyon, şehir sahipliği yaşam döngüsü) hâlâ **UYGULAMADA**. Görsel sanat kapıları G00–G14 ayrıdır; asker G14 öncesi üretilmez.

## Kod / test kanıtları

- Modül: [`js/systems/quest-escort-cargo.js`](../../js/systems/quest-escort-cargo.js)
- İlişkili: `js/managers/WorldPartyManager.js`, `js/systems/quest-escort-npc-guards.js`, `js/managers/SaveManager.js`, `js/ui/QuestEscortHud.js`
- Yeni test: `tests/unit/quest-escort-cargo.test.js` (**6 vaka**) ve `tests/unit/quest-caravan-escort.test.js` (source-market/save entegrasyonu: **1 vaka**).
- **Doğrulanan kaynak commit:** `47cc048d6173b1e4926c574cfd1e9f6c3dd54b59`.
- [Web validation #44549644813](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44549644813) **PASS:** 726/726 unit, 1.138/1.138 full + 1 skipped; lint, build ve dünya denetimi PASS. Dünya: 881 yerleşim, 304 yol, 3 nehir, 4 geçiş, 0 hata / 1 eski uyarı.
- [Gerçek Chromium #44549644782](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44549644782) **PASS:** World start, görev/kervan, gerçek muhafız savunması, gerçek yağma başarısızlığı, 250 altın ödülü tek sefer, Save/Load; konsol hatası 0. Bunlar mevcut browser akışlarının regresyon doğrulamasıdır. Ayrı tam user-driven typed market transfer tarayıcı testi **henüz yapılmadı**.
- **7 yeni test:** 6 cargo unit + 1 genişletilmiş manager/save testi. Manager testi gerçek yol varışında hedef `marketStock` miktarının kaynak stok kadar arttığını ve transit save snapshot'ında yalnız gerçek ürünlerin iade edildiğini ayrıca doğrular.
- **Açık sınırlama:** Genel O00-06 ve tam çift-pazar konsolidasyonu sürüyor; bu QA sonucu tüm ekonominin bittiği anlamına gelmez.

## Sonraki V1.27+ / V1.28

- İki ayrı pazar stok modelini tek sahiplik ve fiyat-maliyet muhasebesinde uzlaştır; herhangi bir fark/çift sayım kararı için önce audit.
- Kaçırılan malın gerçek bandit envanterinde yetkili save/recovery provenance ve oyuncuya gerçek ganimet transferi için güvenli koşullar.
- Hasara ve asker sınıflarına bağlı koruma; doğal uzun mesafe NPC kervan savaş dengesi ölçümü; gerçek browser ekranından teslim sonrası **kaynak-destination market** testi.
- Karakter/komutan AI yaşam döngüsü ve bağımsız Organization UI kapsamı ayrı kalır.
