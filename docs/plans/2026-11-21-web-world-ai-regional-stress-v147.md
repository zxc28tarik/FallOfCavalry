# WEB V1.47a — Regional storage observability and multi-region identity regression

Date: 2026-11-21
Scope: O00-06, WEB only. PR #68 remains DRAFT/UNMERGED.
Baseline: V1.46 verified report commit `688bf85cdd9c`.

## Changes
- Added read-only `auditWorldAiRegionalStorage`. It reports active and dormant counts, distinct IDs, duplicate IDs, overlapping live/dormant IDs, invalid IDs, visit-stamp count, and UTF-8 JSON bytes of a well-defined regional snapshot subset.
- The diagnostic deliberately does **not** evict, advance, merge, age, spawn, or mutate any world party. It is not a memory-heap measure, complete SaveManager payload size or compressed save-file size.
- Added synthetic-but-source-registered five-city Vitest fixture spanning 240 tiles outbound plus 240 tiles returning. It verifies regional restoration of the exact live objects, IDs, cargo, and stable 10-ID aggregate. It is a deterministic state-transition regression **not** the promised >100-tile continuous player-motion Chromium gate.
- Added negative identity corruption diagnostics and UTF-8 byte accounting checks.

## Gate status
- V1.46: 875 unit and 1287 general PASS, one preexisting skip; Chromium PASS (prior baseline, not attributable to these changes).
- V1.47a: CI/Chromium must be checked against exact new commit; no claim of passing before completion.
- Required follow-up: inspect code's actual GameFlowManager movement input and browser smoke harness, construct a real sustained movement gate; capture real SaveManager JSON payload size, visited-region and dormant count curves, route/quest/economy invariants. Do not optimize from synthetic byte readings.
- No gameplay semantics change; no main/Unity edits.

## Acceptance for V1.47 completion
1. Full CI plus real Chromium PASS with zero console errors.
2. 100+ continuous in-game player travel tiles (no teleport/setPosition) in real browser.
3. Multiple-region scenario with dormant identity/cargo/quest state preserved over save/restart and return.
4. Quantified dormant growth, total save bytes, updateMap and AI cost vs number of visited regions.
5. Concrete policy for offscreen aging only after data, and no silent discard of parties.
