# FallOfCavalry Web — Planlar, Kararlar ve İlerleme Kayıtları

**Kapsam:** Yalnız `zxc28tarik/FallOfCavalry` web oyunu. `FallOfCavalry-Unity` ayrı projedir.

## Ana belge setleri
- [19 Kasım 2026 — WEB Character System v2 V1.27 gerçek şehir stoklu kervan yükü ve canlı haydut ganimeti](2026-11-19-web-escort-source-cargo-economy-v1.md): kaynak marketStock rezervasyonu, baskında gerçek mal aktarımı, varışta teslim, save snapshot iadesi; kanıt/test ve açık çift stok modeli sınırları
- [19 Kasım 2026 — WEB Character System v2 V1.26 bağımsız kervan muhafızları ve dünya haritası yağması](2026-11-19-web-autonomous-escort-guards-cargo-v1.md): canlı 3 muhafız, konvoy HP/yük, haydut NPC savaş zaferi ve tek başarısızlık cezası, 5 yeni test
- [19 Kasım 2026 — WEB Character System v2 V1.25 gerçek yol noktalarıyla 30+ kare refakat](2026-11-19-web-real-road-escort-follow-v1.md): normal hız ve gerçek player simülasyonunda 30,83 tile, güvenli waypoint, 6 yeni test ve eksik global yol ağı sınırları
- [19 Kasım 2026 — WEB Character System v2 V1.24 dinamik kervan takibi ve gerçek muhafız savaş sonuçları](2026-11-19-web-escort-follow-guard-battle-v1.md): normal hareket motoru, gerçek zafer/yenilgi→konvoy sonucu, 250 altın tek ödül ve 6 yeni test
- [19 Kasım 2026 — WEB Character System v2 V1.23 refakat HUD, gerçek yol haydut tehdidi ve kayıp kervan araştırması](2026-11-19-web-escort-hud-missing-caravan-recon-v1.md): RAM-only route_recon, gerçek DOM görev ödülü, 7 test ve uzun yol sınırları
- [19 Kasım 2026 — WEB Character System v2 V1.22 gerçek yol kervan refakati ve eski görev bırakma](2026-11-19-web-real-caravan-escort-v1.md): gerçek caravan_arrival ledger, oyuncu yakınlığı, 250 altın tek ödül, Save/Load ve 8 yeni unit test
- [19 Kasım 2026 — WEB Character System v2 V1.21 güvenli aynı-oturum görev devamı ve eski rota onayı](2026-11-19-web-quest-session-legacy-recovery-v1.md): RAM-only verified quest progress, pending claim incelemesi, gerçek yola opt-in migration ve 16 yeni test
- [19 Kasım 2026 — WEB Character System v2 V1.20 canlı savaş→görev tamamlama](2026-11-19-web-real-battle-quest-completion-v1.md): gerçek savaş tikleri, Enter→quest overlay DOM tıklaması, 300 altın tek ödeme, Save/Load replay koruması ve hedef şehir ID=0 düzeltmesi
- [19 Kasım 2026 — WEB Character System v2 V1.19 kanonik dünya yolu–ticaret görevi eşleştirmesi](2026-11-19-web-real-road-quest-topology-v1.md): 304 gerçek yol, eski uyumluluk satırları, tile→world devriye geometrisi, 7 test ve gerçek Chromium QA
- [19 Kasım 2026 — WEB Character System v2 V1.18 gerçek dünya AI ticaret yolu tehditleri](2026-11-19-web-world-ai-quest-route-threats-v1.md): kaynaklı parti/rota doğrulaması, sınırlı resmî görev haydudu, save/restore, gerçek Chromium ve 11 yeni birim testi
- [19 Kasım 2026 — WEB Character System v2 V1.17 gerçek görev hedefi/olay eşleştirme](2026-11-19-web-quest-target-provenance-v1.md): haberci yakalama, kaynaklı rota ve komutan zaferi, save pending kapısı, yeni 8 test ve CI
- [19 Kasım 2026 — WEB Character System v2 V1.16 güvenli görev olay günlüğü](2026-11-19-web-quest-event-ledger-v1.md): gerçek savaş sonuçlarının sınırlı kaydı, save'de inert pending arşiv, güvenlik testleri ve açık hedef/provenance eşleştirme sınırı
- [19 Kasım 2026 — WEB Character System v2 V1.15 şehir NPC gerçek görev atama UI](2026-11-19-web-character-quest-assignment-ui-v1.md): mevcut görev ve aktif organizasyon görevi kontrolü, iki aşamalı kullanıcı onayı, neden/geçmiş görünümü, 5 yeni test ve Chromium QA
- [19 Kasım 2026 — WEB Character System v2 V1.14 kanonik görev snapshot / restore](2026-11-19-web-character-quest-save-restore-v1.md): resmî şablondan yeniden kurma, doğrulanmış görev+Named atama geri yükleme, inert objective claims, QA ve sonraki UI/ledger sınırları
- [18 Kasım 2026 — WEB Character System v2 V1.13 gerçek görev–önemli karakter ataması](2026-11-18-web-character-quest-assignment-v1.md): aktif NamedCharacter/organizasyon görevi bağlantısı, sonuç/failure kaydı, güvenli suspended save, QA ve UI/quest restore açık işleri
- [18 Kasım 2026 — WEB Character System v2 V1.12 şehir NPC durumu + görev tamamlanma köprüsü](2026-11-18-web-character-quest-event-bridge-v1.md): ilk UI NamedCharacterState tüketicisi, gerçek quest receipt kapısı, güvenilir boş ödül kataloğu, 10 yeni test ve QA
- [18 Kasım 2026 — WEB Character System v2 V1.11 NamedCharacterState/CharacterDefinition sözleşme ayrımı](2026-11-18-web-named-character-state-separation-v1.md): gerekçeli stat değişimi, değişmez kişi kimliği, eski packed/delta save uyumu, QA ve açık fiziksel refaktör
- [18 Kasım 2026 — WEB Character System v2 V1.10 CharacterDefinition/kalıcı önemli kişi çekirdeği](2026-11-18-web-character-definition-authority-v1.md): authored A/B/C karakter kimliği, güvenilir kaynak, seeded delta save, sahte kimlik engeli ve QA
- [18 Kasım 2026 — WEB Character System v2 V1.9 tarihsel kaynak/kişi kimliği ön doğrulaması](2026-11-18-web-character-social-source-identity-v1.md): kaynak atfı, birebir NamedCharacter ID/ad kontrolü, atomik katalog kapısı, QA ve eksik içerik sınırı
- [18 Kasım 2026 — WEB Character System v2 V1.8 sosyal kaynak otoritesi](2026-11-18-web-character-social-authority-v1.md): doğrulanmış katalog, eski kayıtları etkinleştirmeme, karantina, güvenli geri yükleme ve test sınırları
- [18 Kasım 2026 — WEB Character System v2 aile/hizip bağlayıcı V1.7](2026-11-18-web-character-social-house-clique-v1.md): gerçek HouseState/CliqueState kaynak kapıları, ayrı üyelik bağları, geçerli ID/save testi, yapay aile üretmeme kuralı
- [18 Kasım 2026 — WEB karakter organizasyonu/üyelik/görev ayrımı V1](2026-11-18-web-character-organization-membership-and-assignment-v1.md): Character System v2 için altı kesin dal, görev ilişkisi, eski save uyumu ve yetki sınırları
- [18 Kasım 2026 — WEB Character System v2 boşluk analizi ve önem sınıfı geçişleri](2026-11-18-web-character-system-v2-gap-and-importance.md): karar defteri v2 ile kod eşleşmesi, açık komutlu A/B/C/D terfileri, save/QA kapıları
- [18 Kasım 2026 — WEB Karakter Üretim Motoru V1](2026-11-18-web-karakter-uretim-motoru-v1.md): Character System v2 kaynakları → rol şablonu → tekrarlanabilir geçici aday → kalıcı Named(D) → küçük delta save; uygulama planı ve karar sınırları
- [18 Kasım 2026 — Web dünya NPC / karakter üretimi V1](2026-11-18-web-dunya-npc-karakter-sistemi-v1.md): oyuncu değil, Unity değil; seedli NPC, şehir görünümü, kayıt, karakter yükseltme ve testler
- [18 Kasım 2026 — BİRLEŞİK WEB MASTER PLAN V2](web-rebuild-v2/README.md): yeni dünya verisi + özgün 2D, 18 iş hattı/131 icra paketi, eski 215+72 planla çapraz izleme
- [18 Kasım 2026 — Eski dünya verileri ve görsellerin kullanıcı onaylı silinmesi](2026-11-18-requested-legacy-world-art-deletion.md): aktif olsa bile silme kararı, kapsam ve geçici procedural boot
- [17 Kasım 2026 — Derin kod, asset ve kullanım denetimi V2](2026-11-17-web-derin-kod-asset-denetimi-v2.md): aktif/ertelenen kaynaklar, 2 yayın yolu, görev bağlantıları, smoke ve harita veri riski
- [17 Kasım 2026 — Güncel CI lint temizliği ve bağımlılık risk kaydı](2026-11-17-web-current-ci-lint-and-dependencies.md): yedi lint uyarısı + npm audit risk kapısı
- [17 Kasım 2026 — Kapalı dimetrik overview kodu temizliği](2026-11-17-web-dead-overview-removal.md): sabit kapalı 2D render yolu ve SHA eşleştirmeli test kanıtı
- [17 Kasım 2026 — Web GitHub otomatik test kapısı](2026-11-17-web-ci-test-gate.md): CI yapılandırması ve PASS kabul şartı
- [17 Kasım 2026 — ESLint ve kullanılmayan kod temizliği](2026-11-17-web-source-lint-cleanup.md): 6 eski uyarı giderildi; referans test protokolü
- [17 Kasım 2026 — Eski görseller ve kullanılmayan kod temizliği](2026-11-17-web-unused-code-assets-cleanup.md): 77 dosyalık kontrollü silme ve korunan aktif bağımlılıklar
- [17 Kasım 2026 — Web branch temizleme envanteri (CSV)](2026-11-17-web-branch-cleanup-candidates.csv): her dalın tam SHA'sı, PR ilişkisi ve korunma/silme kararı
- [17 Kasım 2026 — Web deposu temizlik denetimi ve değişiklik kaydı](2026-11-17-web-repository-cleanup.md): takip edilen geçici dosyalar, arşiv ve geri alma planı
- [17 Kasım 2026 — Unity dalları / yanlış repo denetimi](2026-11-17-unity-branch-repo-denetimi.md): web deposundaki çift Impl-0–8 dalları ve ayrı Unity deposunun en ileri S4 çizgisi
- [17 Kasım 2026 — GitHub mevcut durum / hasar raporu](2026-11-17-web-github-durum-raporu.md)
- [Web bağımsız geliştirme master planı V1](web-development-v1/README.md): 72 iş paketi; hasar tespiti, entegrasyon ve geliştirme ağacı
- [2D görsel sistemini sıfırdan kurma master planı V1](2d-visual-rebuild-v1/README.md): 15 faz, 200 iş + 15 kalite kapısı; asker görselleri son faz

## Kalıcı kayıt kuralı
Yeni veya revize edilen `.md` planlar, karar defterleri, görev takip tabloları, teknik araştırmalar, kapsamlı hasar raporları ve diğer projeye özgü planlama dosyaları **aynı çalışma sırasında bu GitHub reposuna commit edilmelidir**. Yeni belgelerin bağlantısı bu dizine eklenir. Dosyalar yalnızca sohbet eki veya ZIP'te bırakılmaz. GitHub'a aktarım başarısızsa durum açıkça bildirilir.

**Referans:** Kök [`AGENTS.md`](../../AGENTS.md) ve [`CLAUDE.md`](../../CLAUDE.md).

## Öncelik ve belge statüsü
1. Kullanıcının en güncel açık onayı.
2. Projenin güncel master planı ve karar kaydı.
3. Tarihsel planlar, eskiden alınmış ekran görüntüleri ve eski kod yalnızca kanıt/referans.

Eski belgelerdeki “GitHub'a henüz aktarılmadı” türü ifadeler **o belgenin hazırlandığı tarihteki durumu** anlatır; güncel kayıt durumu için GitHub commit geçmişi esas alınır.

## Kontrol / durum takibi
- `web-development-v1`: planlama kaydı, 72 görev (bunlar tamamlandı olarak kabul edilmez).
- `2d-visual-rebuild-v1`: 215 görev/kapı, asker görselleri G14 son faz. CSV ve JSON takip dosyaları kaynak niteliğindedir.
- Görevlerin `DONE` durumu için commit + doğrulama kanıtı zorunludur.
- Excel pano ve arşiv ZIP dosyaları daha önce sohbet eki olarak verilmiştir; GitHub'da sürümlenen ana takip kaynakları CSV/JSON'dur. Bunlardan Excel dışa aktarılabilir.

