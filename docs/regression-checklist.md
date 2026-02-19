# Regression Checklist (Manual)

## Map
- Start new game, verify map renders and HUD values update.
- Toggle pause/resume with `Esc` from map.
- Verify no stutter while idle on map for 60+ seconds.

## Camera
- Pan and zoom map; ensure player/enemy markers stay aligned.
- Toggle follow mode and verify camera recenters correctly.

## Party Move
- Select party and issue move command; destination line appears.
- Cancel destination with `X`/Backspace; unit stops.

## Encounter
- Contact enemy and ensure encounter screen appears.
- Press `C` to continue and verify pushback/cooldown separation.
- Press `F` to enter roster prep.

## Roster Prep
- In roster prep, select/deselect units and confirm deployment works.
- Try selecting wounded/disabled units and verify restrictions/warnings.

## Battle
- Let battle resolve naturally and verify aftermath opens.
- Use manual retreat key and verify safe return path.

## Recruit (5.3)
- Enter city (`C`) and open Recruit (`R`).
- Verify recruit rows show quality, available count, hire cost, wage/day.
- Hire one unit with `Enter` and verify gold decreases + roster increases.
- Hire max with `Shift+Enter` and verify bounded by gold/count.
- Attempt hire without enough gold and verify HUD message appears.
- Advance day by day and verify recruit pool refreshes every 3 days.

## Accounting (6.1)
- Wait for day tick and verify accounting panel appears.
- Verify income/expense/net lines and resulting gold/morale values.
- If gold is negative at day end, verify morale decreases.
- Close accounting with `Enter`/`Space`/`Esc` and return to gameplay.

## Save / Load (10.1)
- On map press `F5` and verify Save/Load panel opens.
- Use `S` on manual1, refresh page, then load manual1 and verify day/gold/roster restore.
- Save autosave/manual slots and verify selected row updates.
- Use `E` to export JSON to textarea and `I` to import+load.
- Load malformed JSON and verify graceful failure (no crash).
- Load a save from risky mode and verify safe fallback to map.

## Autosave (10.2)
- Stay on map 60s and verify autosave occurs (non-spam message).
- Close accounting and verify autosave trigger occurs.
- Complete recruit hire and verify autosave trigger occurs.
- Complete aftermath return to map and verify autosave trigger occurs.
- Re-enter menu/restart flow and verify no duplicate autosave timer behavior.
