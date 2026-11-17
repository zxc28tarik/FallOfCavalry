# FOC: Web deposundaki Unity dalları ile ayrı Unity deposunun kaynak-doğruluğu denetimi

**Tarih:** 2026-11-17  
**Yapılış şekli:** GitHub API üzerinden salt-okunur branch, commit, commit kıyaslama ve ağaç denetimi. Bu belge yalnızca bulguları kaydeder; çalışma kodu değişmez.  
**Web:** https://github.com/zxc28tarik/FallOfCavalry  
**Unity:** https://github.com/zxc28tarik/FallOfCavalry-Unity

## Sorun ve kısa karar

Kullanıcı, Unity geliştirmesinin bir kısmının yanlışlıkla eski web deposunda yapılıp orada kalmış olmasından endişeleniyor.

**Bulgular:**
1. 2026-11-17 kontrolünde web deposunda 63, Unity deposunda 28 branch bulundu.
2. `codex/impl-0-foundations`, `codex/impl-1-character-core`, `codex/impl-2-organization-house-clique`, `codex/impl-3-religion-sect`, `codex/impl-4-city-v2`, `codex/impl-5-trade-production-caravan`, `codex/impl-6-diplomacy-envoy-report`, `codex/impl-7-army-recruitment-logistics`, `codex/impl-8-soldier-equipment-weapon-armor` dalları **iki depoda aynı commit SHA'larına** sahiptir; sonuncusu `977dcc23c886a84abdf5f7a023e1741b7ce3dc42`.
3. Eski web deposundaki `impl-8` dalının ağaç yapısında `UnityProject/`, `Build/`, `Docs/`, `FallOfCavalry.sln` bulunur; 126 C# ve **0 JavaScript** dosyası vardır. Bu Unity dalıdır, web kodu değildir.
4. Eski web `main` ile eski web `impl-8` arasında GitHub compare **no common ancestor** cevabı verdi. Unity dalları web ana dalıyla birleştirilmemiş. Web `main` güncel ağacında `UnityProject/` veya `Build/` bulunmaz; **0 C#**, 229 JavaScript dosyası bulunur. Web `main` SHA: `b98f514a558425cbbf95d4f993c835bf19551917`.
5. Impl-9, 10, 11, 12, 13, 14A, 14B, 14C ve ayrıca 8.5, Y1-Y5A, S1-S4 dalları eski web deposunda **yoktur**, **ayrı Unity deposundadır**.
6. Unity `main` SHA: `d334175f6b39a9c385e4afc8a90cafce0a5b28cb` (2026-09-20). Unity `main`, Impl-8'i ve ek bir CI kayıt commit'ini içerir; diğer Unity geliştirme dallarının tamamını içermez.
7. Unity `codex/impl-14c-production-character-art` (2026-10-08 00:13 UTC), Unity Impl-8'in **42 commit ilerisindedir**.
8. Daha ilerideki Unity `codex/s4-character-details-ui` (2026-10-08 17:23 UTC), `codex/impl-14c-production-character-art` dalının **11 commit ilerisindedir**. Y1-Y5A, S1-S4 birbirini izleyen commit ataları şeklinde bağlıdır; S4, Y5A'nın 4 commit ilerisindedir. `main` ile karşılaştırma: **ahead 53, behind 1** (tek kalan `main` CI commit'inin birleştirilmesi hâlâ değerlendirilmelidir).
9. Unity'de `Docs/PLAYABLE_SCREEN_PROGRESSION_PLAN.md`, güncel oynanabilir ekran planı ve açık kabul kapılarını içerir. Branch'te kod bulunması **tam doğrulanmış yayın sürümü** anlamına gelmez. Belge, bir uzun kullanım testinde 882 saniye/152 kayıt-yükleme döngüsünden sonra bellek büyümesi nedeniyle FAIL raporlamaktadır; bunun son durumda giderildiği bu denetimde doğrulanmadı.

## Sonuç

**Unity geliştirmelerinin en ileri zinciri yanlış web deposunda kalmamıştır.** İlk Impl-0...8 commit'leri iki repoda kopya/ref olarak bulunur; daha yeni çalışma *Unity deposunda* ilerlemiştir. Kritik organizasyon sorunu, Unity'nin `main` dalının ilerideki zincire göre geride olmasıdır. **En ileri doğrulanan entegrasyon dalı `codex/s4-character-details-ui`**; ama `main`deki tek CI commit'inin entegrasyonuyla ve tüm testlerle güvenli birleştirme yapılmadan onu yayına hazır diye nitelememeliyiz.

## Önerilen güvenli işlemler — henüz uygulanmadı

- Unity için tek otorite: **`zxc28tarik/FallOfCavalry-Unity`**. Web için tek otorite: **`zxc28tarik/FallOfCavalry`**.
- Unity geliştirmesinde `codex/s4-character-details-ui` ilerleme dalı temel aday olsun; son branch olduğu için otomatik `main` sayılmasın. `main`in CI commit'i korunarak doğru merge/PR hazırlanmalı.
- Unity `main`e geçmeden önce branch diff'i, testler (Unity Editor, .NET, Windows uzun kullanım), save/scene etkileri ve açık teknik kabul kapıları değerlendirilmelidir.
- Web deposundaki çift kayıtlı Impl-0...8 dalları **şimdilik silinmesin**. Kullanıcı onayı ve arşiv/koruma kontrolünden sonra temizlenebilirler.
- Web `main`deki JavaScript/Phaser, şehir ve 2D görsel planları Unity ile birleştirilmemeli.
- Her değişikliğin commit/PR URL'si verilerek repo-scope doğrulanmalı; hiçbir kullanıcı kararı “onaylandı” diye varsayılmamalı.

## Denetimde kullanılan GitHub bağlantıları
- [Web branches](https://github.com/zxc28tarik/FallOfCavalry/branches)
- [Web duplicate Impl-8 branch](https://github.com/zxc28tarik/FallOfCavalry/tree/codex/impl-8-soldier-equipment-weapon-armor)
- [Unity branches](https://github.com/zxc28tarik/FallOfCavalry-Unity/branches)
- [Unity main](https://github.com/zxc28tarik/FallOfCavalry-Unity/tree/main)
- [Unity Impl-14C](https://github.com/zxc28tarik/FallOfCavalry-Unity/tree/codex/impl-14c-production-character-art)
- [Unity Y5A](https://github.com/zxc28tarik/FallOfCavalry-Unity/tree/codex/y5a-city-inspection-ui)
- [Unity S4 — latest validated lineage](https://github.com/zxc28tarik/FallOfCavalry-Unity/tree/codex/s4-character-details-ui)
- [Unity playable screen progression](https://github.com/zxc28tarik/FallOfCavalry-Unity/blob/codex/s4-character-details-ui/Docs/PLAYABLE_SCREEN_PROGRESSION_PLAN.md)
