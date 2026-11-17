# FOC Web — GitHub otomatik test kapısı

**Tarih:** 2026-11-17. **Depo:** `zxc28tarik/FallOfCavalry`.  
**Gerekçe:** 2026-11-17 temizlik PR'larında kaynak dosyalar statik doğrulanmış olsa da web `main` için otomatik CI olmaması tam build/test sonucunun uzaktan doğrulanmasını engelliyordu.

## Eklenen workflow

`.github/workflows/web-validation.yml`
- `push` (`main`), `pull_request` (`main`), `workflow_dispatch` tetikleri.
- Node.js 22, GitHub Actions Ubuntu runner, kilit dosyasından `npm ci`.
- `npm run validate`: repository hygiene, conflict marker, ESLint, birim testleri ve Vite production build.
- `npm run test`: bütün Vitest testleri; `test:unit` dışında tutulan savaş ve manager testleri de dahil.
- PR başına varsayılan GitHub durumları üzerinden test kanıtı.

## Kabul kuralları

- Workflow'un varlığı **test PASS olduğu anlamına gelmez**. Başarılı bir run ve SHA eşleşmesi görülmeden sonuç PASS olarak kaydedilmez.
- Çalıştırılması için ayrıca Playwright kurulumu gerektiren `validate:smoke` bu workflow'da otomatik koşmaz. Tam tarayıcı/E2E doğrulaması ayrıca yapılmalıdır.
- GitHub branch protection/ruleset zorunlu denetimi bu workflow ile kendiliğinden etkinleşmez; bunu güvenli şekilde zorunlu kılmak ayrı repo ayarı gerektirir.
- Geçmişteki durum denetimi: [eski renderer/asset temizliği](2026-11-17-web-unused-code-assets-cleanup.md), [ESLint temizliği](2026-11-17-web-source-lint-cleanup.md).
