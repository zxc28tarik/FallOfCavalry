    - output/web-game/camera-pan-aoe3/shot-0.png- 2026-04-20: Removed the temporary city runtime tint path from js/managers/RenderManager.js (_getCityRenderCanvas and extra alpha multipliers) after user rejected the map color shift.
- 2026-04-20: Rebuilt ssets/settlements/generated/city.png as a dry lower-right restore composite (nalysis/city-restored-dry-composite-test.png) and synced city-final-display.png / city-latest-single.png to the same master.
- 2026-04-20: First dry composite leaked a rectangular alpha box on the map. Fixed by rebinding the final composite to the clean alpha channel from `analysis/city-hybrid-pre8.png`, then re-captured `output/web-game/map-ottoman-settlement-generated.png`.

