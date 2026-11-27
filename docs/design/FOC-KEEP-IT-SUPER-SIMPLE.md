# Fall of Cavalry — KEEP IT SUPER SIMPLE (KISS)

## Kullanıcı kararı — 27 Kasım 2026

> keep it super simple. HUD'lar, menüler, oyun kullanımları her şey oldukça basit olmalı. Oyuncu neyin ne olduğunu her zaman anlamalı, ilk gördüğünde anlamalı, sebebini anlamalı, ne işe yaradığını anlamalı.

Bu karar yalnızca savaş görsel prototipine değil, Fall of Cavalry'nin bütün oyun sistemlerine, stratejik haritaya, şehir yönetimine, diplomasiye, ekonomiye, savaşlara, ayarlara, HUD'lara, menülere ve kontrollerine uygulanır. Unity ve web uygulamalarında ortak tasarım ilkesi olarak ele alınır.

## Uygulama ölçütleri

- İlk bakışta işlev ve mevcut durum anlaşılır olmalı. Tanınmayan simgelerin açık metin etiketi veya erişilebilir kısa açıklaması olmalı.
- Oyuncu her işlemden önce ne yapacağını ve önemli sonuçlarını, işlemden sonra ne olduğunu ve nedenini anlayabilmeli. İşlem yapılamıyorsa nedeni ve mümkünse çözümü belirtilmeli.
- O anda gerekli bilgiler öncelikli; ayrıntılar isteğe bağlı açılmalı. Sadelik uğruna önemli uyarı ve karar bilgileri saklanmamalı.
- Gereksiz tıklamalar, tekrar eden menüler, teknik adlar, karmaşık kısaltmalar ve dekoratif kalabalık azaltılmalı.
- Renk, metin, simge ve kontrol anlamları bütün oyun boyunca tutarlı olmalı; kritik bilgiler yalnız renkle verilmemeli.
- Mekanik derinliği korunabilir; kullanım ve anlaşılabilirlik basit olmalı.

## Tasarım kabul kapısı

Her HUD, menü veya etkileşim değişikliğinde şu sorular sorulur: Oyuncu bunu ilk gördüğünde ne olduğunu, ne işe yaradığını, neden burada bulunduğunu, nasıl kullanacağını ve sonucu anlayabiliyor mu? Hayırsa tasarım sadeleştirilir. Teknik test başarıları tek başına kullanılabilirlik onayı değildir. Yeni oyuncu gözlemi ile doğrulama hedeflenir; yapılmamış kullanıcı testi yapılmış gibi gösterilmez.

Bu kayıt tasarım ilkesidir; mevcut oyun kodunda bir HUD revizyonu yapıldığı anlamına gelmez.
