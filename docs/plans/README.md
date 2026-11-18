# FallOfCavalry Web — Planlar, Kararlar ve İlerleme Kayıtları

**Kapsam:** Yalnız `zxc28tarik/FallOfCavalry` web oyunu. `FallOfCavalry-Unity` ayrı projedir.

## Ana belge setleri
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

