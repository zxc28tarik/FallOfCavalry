# Fall of Cavalry WEB — 2D Görsel Yeniden Kurulum V1

**Hazırlanma:** 17 Kasım 2026. **Yalnızca plan tamamlandı; üretim ve GitHub değişikliği yapılmadı.**

## Kesin kararlar
- Kapsam yalnızca `zxc28tarik/FallOfCavalry` **web** deposudur; Unity masaüstü deposu ayrı kalır.
- Mevcut nihai görsel üretim hattı terk ediliyor: **tüm yeni görseller sıfırdan ve doğrudan 2D** hazırlanacak; **3D/3D→2D yok**.
- Eski görseller yalnızca geçici gameplay placeholder ve kıyas referansı olabilir; final asset olarak yeniden kullanılmaz.
- Dünya zemini, doğa, su/yol, harita objeleri, köyler, şehir içi, kale, diğer faction temaları, savaş alanı arka planı ve UI/VFX yenilenecek.
- **Asker görselleri kesinlikle son fazdır (G14).** G13 kabulü olmadan askere ait yeni sprite/animasyon çalışması açılmaz.
- Kullanıcı 2D görüntüleri üretir ve estetik onayı verir; teknik taraf dosya hazırlama, katalog/manifest, konumlandırma, optimizasyon, GitHub entegrasyonu ve regresyonları yönetir.
- Oyun state, 1648 harita verileri, economy, save ve savaş sonucu yalnız görünüm değiştirmek için bozulmaz.

## Dosyalar
1. `01_GORSEL_MASTER_PLAN.md` — yönetim yaklaşımı, 15 fazın detaylı hedefi, oyunla ilişki, ölçülebilir kapılar.
2. `02_GOREV_VERITABANI.json` — kanıt alanları içeren makine okunur **215 iş/kapı**.
3. `02_GOREV_TAKIP.csv` — aynı işlerin filtrelenebilir tablosu.
4. `02_GOREV_TAKIP.xlsx` — durum panosu, görevler, fazlar ve kararlar.
5. `03_DETAYLI_GOREV_AGACI.md` — her görev için çıktı, bağımlılık, kabul kriteri, sorumlu, durum.
6. `04_2D_ASSET_SOZLESMESI.md` — kesin 2D teslim ve kalite teknik şartları.
7. `05_ENTEGRASYON_MIMARISI.md` — oyun kodu, harita projeksiyonu, şehir manifesti, fallback ve versiyonlama.
8. `06_QA_TEST_KAPILARI.md` — hata, test, performans, görüntü karşılaştırma ve kabul yöntemi.
9. `07_GORSEL_KATALOG_VE_TESLIM_SIRASI.md` — çizilecek aileler, ilk parti ve tekrar kullanım stratejisi.
10. `08_HASAR_RISK_VE_KARAR_DEFTERI.md` — kaynak destekli gözlemler, açık riskler ve izin kapıları.
11. `09_UYGULAMA_IS_EMIRLERI.md` — başlama prosedürü, örnek iş emirleri, PR/checklist şablonları.
12. `10_KAYNAKLAR_VE_KOD_HARITASI.md` — kontrol edilen mevcut kod/veri belgeleri.
13. `examples/` — örnek metadata, şehir manifesti ve teslim formu (**öneri şemasıdır, doğrudan runtime JSON yerine kullanılmaz**).
14. `validate_plan.py` — görev kimliği, bağımlılık, döngü ve asker-son-kapısı doğrulaması.

## Sayılar ve doğru yorum
- **15 faz; 200 yapılabilir görev + 15 faz çıkış kapısı = 215 kayıt.**
- Tüm kayıtlar yeni plan olarak `PLANLANDI`, G14 kayıtları `EN_SON_BLOKLU`; **hiçbir görev tamamlandı olarak işaretlenmedi**.
- Karmaşıklık ve sayılar planlama etiketidir, süre veya garanti değildir.
- Önceki web master plandaki 72 görev ayrı oynanış/altyapı planıdır; bu paket onu silmez, görsel alt programı olarak eklenir.

## Gerçek başlangıç noktası
İlk iş G00/G01 ile GitHub `main` sürümü, aktif render modülleri, 2D dosyalar ve sahneler için kesin envanter/ekran baz çizgisi çıkarmaktır. Tüm harita ve şehir 2D görselleri bir anda üretilmez; her alt sistem pilot, entegrasyon ve kabul kapısını geçtikten sonra genişletilir.