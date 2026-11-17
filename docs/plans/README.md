# FallOfCavalry Web — Planlar, Kararlar ve İlerleme Kayıtları

**Kapsam:** Yalnız `zxc28tarik/FallOfCavalry` web oyunu. `FallOfCavalry-Unity` ayrı projedir.

## Ana belge setleri
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

