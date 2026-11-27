# Fall of Cavalry WEB — Character System v2 uyum denetimi ve önem sınıfı geçiş altyapısı

**Tarih:** 18.11.2026 · **Proje:** sadece WEB `zxc28tarik/FallOfCavalry` · **Durum:** PR #68 üzerinde teknik alt iş, tam Character System v2 bitmiş değil · **Kaynak otoritesi:** kullanıcı dosyası `FOC-Karar-Defteri-Guncel.md` §7, §8 ve §9.

## A. Kural / uygulama eşleşmesi

| Karar defteri gereksinimi | WEB durum (bu PR sonrasında) | Sınır / eksik |
| --- | --- | --- |
| `RegisteredPerson`, geçici `GeneratedPerson`, kalıcı `NamedCharacter` | **Kısmi**: `world-characters.js` ve `character-production.js`; geçici teklif → Named(D), aynı ID | Tüm dünya nüfusu gerçek kişi bazında modellenmez; eski baseline 2/yerleşim fixture |
| `A/B/C/D`, D→C, C→B nadir, B→A, C→A çok nadir, D→A yasak | **Teknik geçiş katmanı bu işte** | Nadirlik yüzdesi, terfiye sebep olan oyun olayları belirlenmedi |
| İlişki -100..+100, tam grafik değil | **Kısmi**: explicit sparse `relations`, delta-save | Olaylarla açılan ilişki sınırları, insan ağındaki aktör dinamikleri yok |
| 0..100 statlar; sadakat/memnuniyet/itibar/nüfuz ayrı | **Kısmi**: 9 başlangıç statı ve dört ayrı dinamik değer | 11 stat kavramının tam `BaseLoyalty`/`BaseReputation` ayrımı, stat ağırlıkları, gelişim kuralları açık |
| Oyuncu dalları: Party, Household, ArmyNetwork, CityAdministration, TradeNetwork, DiplomacyNetwork | **O00-06 kapsamında henüz bağlanmadı** | Rol, organizasyon üyeliği ve anlık atama ayrımı için `CharacterRoleAssignmentState` gerekli |
| Aile `HouseState`, hizip `CliqueState`, din/mezhep kimliği | **Henüz tam WEB v2 ilişkisi yok** | Ayrı otoriteler; sahibinden otomatik inanç/soy/hizip türetilmez |
| 14 adam alma kaynak türü | **Kısmi, doğrulanan**: 14 tip şeması; gerçek yerleşim+inşa edilmiş han/atölye adapterı | Diğer owning sistemlerin event/maden/liman vb kaynak adaptörleri henüz bağlanmadı |
| Save’de yalnız önemli/kalıcı kişi; kimlik sürekliliği | **Bu dilimde mevcut**: `seeded-delta-v1` + `additions` | A/B/C aktörlerin dünya nüfusuna başlangıç yerleşimi ve tarihsel veri seti ayrı |
| Sebepsiz ihanet, gizli sabotaj veya otomatik ölüm yok | **Bu işin dışında, etkinleştirilmedi** | Olay tabanlı sebep ve ölüm sıralaması ayrı mekanik ve denge işi |

Karar defterindeki eski “JS tarafı yok; Unity'de sıfırdan kurulacak” ibaresi **tarihsel plan statüsüdür**. Kullanıcının güncel talebi WEB'deki sistemi güçlendirmektir; Unity dosyaları bu işte değiştirilmez.

## B. Bu adım — importance advancement sözleşmesi

`js/systems/character-importance.js` bilinçli olarak ayrı, deterministic, *emir tabanlı* alt katmandır.

- Kaynak kararındaki yollar: **D→C** standart, **C→B** nadir, **B→A** standart açık geçiş, **C→A** çok nadir; **D→A kesin yasak**. İzin verilmeyen atlama/geri düşme/döngü yok.
- Her emir için kayıtlı `NamedCharacter`, hayatta olma, geçerli kampanya günü, en az üç karakterlik temiz `reason`, aynı veya ileri tarih ve gerekli `reviewTier` zorunludur.
- `reviewTier` bir **komutun istisna sınıflandırmasıdır**; kullanıcı onayı veya olayın gerçekleştiğinin kriptografik kanıtı değildir. `rare` ve `very-rare` otomatik verilemez; kaynak gameplay olayı/atama izinleri daha sonra ayrıca tasarlanır.
- Sınıf geçişi tek başına istatistikleri, aile/hizip/din bağlantılarını, kişisel gücü, makamı, konumu, oyuncu asker listesini, ticaret atamasını veya ilişkileri değiştirmez. Yalnız `importance` ve `history` değişir.
- Geçmiş `importance` olayı `day/from/to/reviewTier/reason` ile korunur; var olan `packed-v1` kişi satır uzunluğu (17) ve `seeded-delta-v1` kayıt sürümü değişmez. Tarihçede yeni tipin `[day, "importance", from, to, reviewTier, reason]` tuple'ı yer alır. Eski kayıtlar okunmaya devam eder.
- `GameFlowManager.advanceWorldCharacterImportance` sadece **gelecekte yetkilendirilecek** açık oyun olayı/quest/atama tarafından çağrılacak erişim köprüsüdür. Otomatik rastgele terfi veya karakter arama kurallarına dokunulmaz.

## C. Kabul ve kalan işler

1. A/B/C/D doğrulanır; açıkça izinli yollar geçer, D→A ve uygunsuz tarihler/sahte gerekçeler reddedilir.
2. ID, statlar, konum, trait, sadakat, ilişkiler aynen kalır. Named(D) üreten eski motor etkilenmez.
3. Source-produced Named(D) → C işlemi save `additions` ve seeded-delta restore sonrası geri gelir.
4. Standart başlangıç karakterinin Named(D) → C → B → A değişikliği `overrides` ile korunur.
5. Gerçek Chromium: D→A engeli, D→C açık emir, quick save/load, geçmiş ve yeni aday üretiminin sürmesi.
6. **V1.5 teknik alt iş QA-PASS**: kod SHA `1181c47bd91ee747b59e722dfba1f32d9cfba6ad` üzerinde [Web validation #44287036763](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44287036763) **552/552 unit, 964/965 full (1 skipped), lint, build, world audit (0 error, 1 mevcut uyarı)**. [Chromium #44287036725](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44287036725) **PASS**: D olarak kaydetme, D→A engeli, D→C, quick save/load sonrası C ve `history.importance` korunması, yeni aday slotları [2,3], 0 konsol hatası. Doküman commitleri HEAD'i ileri taşıyacağı için bu SHA kodun kesin test kanıtıdır. PR draft kalacak, main'e kullanıcı GO'su olmadan birleştirilmeyecek.
7. Sonraki mühendislik: `CharacterDefinition/NamedCharacterState/CharacterRoleAssignmentState` biçimlerinin sürümlü ayrışması; rol, organizasyon üyeliği, atama ve neden-sonuç olaylarının kontrol edilen entegrasyonu.

**Bu belge kaynak kararları değiştirmez; eksikleri açık tutan teknik uygulama/kabul kaydıdır.**
