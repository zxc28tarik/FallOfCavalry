# Fall of Cavalry WEB — V1.39: Chromium Scheduler / Canvas2D / Compositor Profiling

**Date:** 2026-11-20. **Scope:** WEB only; O00-06 in progress. **Branch:** `codex/web-world-npc-roster-20261118`, draft PR #68, no merge to `main`.  

## Why

V1.38 verified 56 rAF frames with mean interval **193.629 ms**, while inclusive JS `updateMap` **6.943 ms** and `renderMap` **4.173 ms** (≈11.122 ms combined). The remaining **182.507 ms is UNATTRIBUTED**, not proven GPU time. Headless SwiftShader does not represent a player's Windows graphics card.

## V1.39 implementation

- New `tools/browser-world-frame-trace.mjs`, invoked from the real `tools/browser-world-smoke.mjs` **after all quest, economy, battle, save/load and V1.38 acceptance stages**.
- Samples **32 genuine rAF callbacks**, including **31 intervals**. Captures rAF timestamp interval, callback arrival latency and PerformanceObserver long tasks when supported.
- Wraps real Canvas2D prototype calls (`drawImage`, `fillRect`, `clearRect`, `putImageData`, `fill`, `stroke`, `fillText`, `strokeText`) in transparent `try/finally`, with original descriptors restored after sampling; reports per-operation counts and inclusive call time. This **adds instrumentation overhead**, so the sample must **not** be advertised as uninstrumented player FPS.
- Reads Chrome DevTools Protocol **Performance.getMetrics** before and after the 32-frame window: cumulative `TaskDuration`, `ScriptDuration`, `LayoutDuration`, `RecalcStyleDuration`, frames/layout counters and heap. Counter durations converted from seconds to ms. **Task vs Script/Layout are inclusive and cannot be summed.**
- Requests Chrome **Tracing.start/Tracing.end** with frame, renderer scheduler, paint, compositor, raster and GPU categories. Trace event groups are **best-effort**; absent GPU/compositor event types remain **unavailable** rather than fabricated `0 ms`. Native trace events overlap in time across CPU/GPU threads; **summing categories is invalid**. Trace bytes capped at 32 MiB, then discarded rather than consuming CI memory indefinitely.
- Keeps diagnostic JSON in the standard CI browser report under `chromeFrameProfile`; no new production game code or assets, no drawing passes disabled, no world AI bypassed, no visual detail reduction.
- New `tests/unit/world-frame-trace.test.js`: CDP time-unit conversion, missing metrics as null, event-type classification and unobserved compositor/GPU handling.

## Acceptance gate and known limits

The browser smoke gate requires an active real map, all 32 rAF callbacks, 31 valid rAF intervals and a finite Chrome `TaskDuration` counter delta. Trace availability **is not a hard gate** because software runners expose different graphics internals. No minimum FPS is imposed. Existing complete-world functional tests remain mandatory.

**Unresolved:** identifying exactly which scheduler, raster or compositor phase creates the unexplained gap requires examining **actual browser trace evidence**. Even if the measured interval remains ~200 ms, it must not be blamed on any single subsystem without evidence. Real Chrome/Windows hardware run still needed before making player-FPS claims.

**Evidence links:** use PR #68 Actions on the exact head SHA; do not mark PASS until both Web validation and Web Chromium browser smoke complete successfully.

**Decision:** preserve original HOMM-like map art, terrain detail, 881 settlements, world AI and all game semantics. Optimize only a measured bottleneck in a subsequent reviewed change.


## Real CI evidence — PASS on code+documentation head `6ace25471f4edcdf3ca89e4435a5d47555294653`

- [Web validation #44736504963](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44736504963): PASS; **804/804** unit, **1,216/1,216** complete suite plus **1 pre-existing skip**, build/lint PASS; world audit: **881 settlements, 304 roads, 3 rivers, 4 crossings, 0 errors, 1 existing warning**.
- [Real Chromium #44736504993](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44736504993): PASS; existing missions, caravan/economy/market and save-load checks all passed; **0 console errors**. Both V1.38 and new V1.39 measured real map frames.
- Uninstrumented-with-respect-to-Canvas-methods V1.38 window (56 rAF): **147.875 ms** mean rAF interval; `updateMap` **5.425 ms/frame**; `renderMap` **2.793 ms/frame**; reported unprofiled gap **139.657 ms/frame**. These numbers are from the same new Chromium job, not the earlier 193.629-ms V1.38 run.
- V1.39 *instrumented* 32-frame window: **31** rAF intervals, **144.081 ms** average and 150.1 ms p95, callback arrival latency **15.309 ms mean**, one 78-ms long task observed.
- Canvas2D: **97,920 `fill` calls** (43.5 ms inclusive across 32 frames); **512 `drawImage`** (2.5 ms inclusive) and **32 `fillRect`** (0.3 ms). Not the full CPU/raster cost of displaying Canvas images.
- CDP in the 4.758-second sampling window: cumulative `TaskDuration` **403 ms** (includes script); `ScriptDuration` **356 ms**; 0 reported layout/style time. Browser traces **15,400** events, **7,283** complete duration events and available graphics categories.
- Particularly important native trace names: **32** `SkiaOutputSurfaceImplOnGpu::SwapBuffers` events with **4,679.145 ms aggregate inclusive duration**, `Graphics.Pipeline` **4,726.281 ms**, `Scheduler::RunTask` **4,743.553 ms**. Their inclusive durations overlap; **do not add them** or call them proof of actual GPU compute utilization. Because the trace `SwapBuffers` aggregate almost spans the 4.758s window, graphics presentation/synchronization and the software rendering pipeline are **the leading investigation hypothesis in this headless CI environment**.

### Conclusion and next controlled experiment

The measured map update and Canvas draw calls do not explain the headless rAF interval. The native trace exposes a likely long wait at `SwapBuffers` / graphics-pipeline presentation, but **we have not proven actual player FPS bottleneck or a GPU raster bottleneck**.

**V1.40 candidate:** compare identical full-world scenes in separated Chromium runs with at least two documented backend modes (existing SwiftShader and another supported headless mode). Report real `SwapBuffers`, rAF, CDP task/script, Canvas2D call counts and success/unsupported modes. Then, if Windows real GPU profiling is available, test there. **Never change artwork, city/road counts, AI cadence, gameplay rules, or quality just to raise a CI FPS figure.** Any performance optimization must be supported by representative hardware evidence and regression tests.

**Status:** V1.39 code + real CI acceptance PASS; O00-06 remains underway; PR #68 remains DRAFT and unmerged.
