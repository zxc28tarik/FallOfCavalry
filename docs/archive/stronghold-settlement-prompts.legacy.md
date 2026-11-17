# FallOfCavalry - Stronghold-Benzeri Yerlesim Prompt Seti

Bu set sadece **sehir/kale sprite uretimi** icindir.  
**Zemin, cim, agac, kaya, yol cizme yok**: mevcut oyundaki basarili doga katmani korunacak.

## 1) Sabit Uretim Kurallari (Her Promptta Gecsin)

Use these constraints exactly:

- dimetric 2:1 medieval strategy-game sprite style
- hand-painted 2D look, not pixel-art, not 3D render look
- baked lighting from top-left (north-west), strong readable silhouettes
- transparent background (alpha), isolated structure only
- no ground plane, no grass, no trees, no rocks, no sky, no fog, no characters
- camera locked, no perspective drift, no fisheye
- clean edges for sprite extraction

## 2) Negatif Prompt (Her Prompta Ekleyin)

`photorealistic, cinematic camera, blurry, low detail, text, watermark, logo, UI, people, horses, weapons, trees, grass, terrain tile, mountain, river, road, shadows outside sprite silhouette, background scene, isometric 30 degree, top-down map`

## 3) Master Stil Prefix

`Stronghold Definitive Edition inspired medieval fortress visual language, dimetric 2:1 projection, dense masonry detail, warm stone palette, controlled saturation, crisp silhouette readability at small scale, baked highlights and shadows, transparent background`

## 4) Ana Promptlar

### A) Kale Ana Keep (Fort Core)

`[MASTER PREFIX], central fortified keep, multi-level stone citadel, battlements, machicolations, narrow slit windows, large gate arch, layered rooftops, banner poles, high readability from strategy camera, sprite sheet ready, transparent background, 1536x1536`

### B) Sur Duvar Seti (Wall Module Sheet)

`[MASTER PREFIX], modular castle wall kit on transparent background: straight wall, inner corner, outer corner, T-junction, cross-junction, end cap, damaged variant, same lighting direction and scale across all modules, clean spacing for atlas packing, 2048x2048`

### C) Gatehouse (Acik/Kapali)

`[MASTER PREFIX], fortified gatehouse with dual towers and heavy wooden gate, one open-state version and one closed-state version, drawbridge-compatible front opening, high contrast stone vs wood separation, transparent background, 1400x1400`

### D) Buyuk Sehir (Walled Imperial City Core)

`[MASTER PREFIX], dense walled medieval city core, compact urban blocks, layered roofs, central monumental civic complex, inner avenues, market courtyards, defensive perimeter integrated with city mass, no terrain around walls, transparent background, 2048x1536`

### E) Orta Sehir / Town

`[MASTER PREFIX], medium-size fortified town cluster, fewer blocks than imperial city, one main square, smaller central hall, compact wall ring with 2 towers, readable at reduced scale, transparent background, 1536x1280`

### F) Koy (Settlement Tier 1)

`[MASTER PREFIX], small rural palisaded settlement, 4-8 structures max, one watchtower, simple gate, low skyline profile, intentionally less dense than town/city, transparent background, 1280x1024`

## 5) Stil Varyant Promptlari (Opsiyonel)

### Ottoman-Esintili Sehir

`[MASTER PREFIX], imperial anatolian-medieval city variant, central dome complex with slim minarets, dense inner housing, warm plaster and stone mix, conservative ornament detail, transparent background`

### Central-European Kale

`[MASTER PREFIX], central european fortress variant, steep roofs, gothic tower accents, heavy buttressed masonry, colder stone tint, transparent background`

## 6) Uretim Sonrasi Teknik Not

- Export: `PNG RGBA`
- Sprite disinda tum alpha bos olmali.
- Ground contact shadow cok hafif olmali; disari tasan genis sahne golgesi olmamali.
- Bu setle uretilecek assetler yalnizca `city/town/fort/village` katmanina baglanmali.
- **Terrain/grass/tree sprite'larina dokunma**.
