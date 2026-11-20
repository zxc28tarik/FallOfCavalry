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
