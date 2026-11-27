/**
 * WEB V1.37 — real full-world Chromium performance probes for the existing
 * optional player audit UI. Results are observational CI artifacts only.
 * No thresholds on FPS/heap: shared headless runners have variable clocks.
 */
const metricNames = ['JSHeapUsedSize', 'JSHeapTotalSize', 'TaskDuration',
  'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration',
  'Nodes', 'Documents'];
const finiteNumber = value => Number.isFinite(value) ? value : null;
const round = value => finiteNumber(value) === null ? null
  : Math.round(value * 1000) / 1000;

export async function profileMarketReportInChromium(page, {
  frameSamples = 48,
} = {}) {
  const session = await page.context().newCDPSession(page);
  const metrics = async () => {
    const snapshot = await session.send('Performance.getMetrics');
    const values = Object.fromEntries(snapshot.metrics
      .filter(row => metricNames.includes(row.name))
      .map(row => [row.name, finiteNumber(row.value)]));
    return values;
  };
  const frames = async () => page.evaluate(async samples => {
    const marks = await new Promise(resolve => {
      const points = [];
      const onFrame = timestamp => {
        points.push(timestamp);
        if (points.length <= samples) requestAnimationFrame(onFrame);
        else resolve(points);
      };
      requestAnimationFrame(onFrame);
    });
    const elapsed = marks.slice(1).map((t,i) => t - marks[i])
      .filter(value => Number.isFinite(value) && value > 0)
      .sort((a,b) => a - b);
    const pct = q => elapsed.length
      ? elapsed[Math.floor((elapsed.length - 1) * q)] : null;
    const total = elapsed.reduce((sum,x) => sum + x, 0);
    const mean = elapsed.length ? total / elapsed.length : null;
    return {
      frames: elapsed.length,
      meanFrameMs: mean,
      p50FrameMs: pct(0.50), p95FrameMs: pct(0.95),
      estimatedRafFps: mean ? 1000 / mean : null,
      over33ms: elapsed.filter(n => n > 33).length,
      over50ms: elapsed.filter(n => n > 50).length,
      // Chromium may not implement this obsolete non-standard API.
      browserReportedHeapBytes: performance.memory?.usedJSHeapSize ?? null,
    };
  }, frameSamples);
  await session.send('Performance.enable');
  try {
    const before = await metrics();
    const baseline = await frames();
    const operations = await page.evaluate(() => {
      const game = window.game;
      const panel = game?.cargoMarketReportPanel;
      if (!game?.started || !panel?.root
        || game.state.mode !== 'map' || panel.root.style.display !== 'none')
        return { ready: false, reason: 'panel not closed on world map' };
      const button = document.getElementById('cargoMarketReportToggle');
      const select = (id,value,event = 'change') => {
        const element = document.getElementById(id);
        element.value = value;
        element.dispatchEvent(new Event(event,{bubbles:true}));
      };
      const timed = callback => {
        const start = performance.now();
        callback();
        return performance.now() - start;
      };
      const snapshot = () => JSON.stringify({
        gold:game.playerParty.gold,
        items:game.playerParty.inventory?.items,
        // World gameplay state, not the UI's derived audit snapshot.
        day:game.state.day,
        markets:game.state.markets,
        stocks:game.state.map.settlements.map(s => s.marketStock),
      });
      const stateBefore = snapshot();
      const openMs = timed(() => button.click());
      const movementTabMs = timed(() =>
        select('cargoMarketReportSection','movements'));
      const fullStockMs = timed(() =>
        select('cargoMarketReportSection','stock'));
      select('cargoMarketReportType','missing_market');
      select('cargoMarketReportPageSize','10');
      let keypressMs = 0;
      for(let i=0;i<24;i++) {
        keypressMs += timed(() => select('cargoMarketReportSearch',
          i % 2 ? '' : 'wa','input'));
      }
      select('cargoMarketReportSearch','','input');
      const next = document.getElementById('cargoMarketReportNext');
      const prev = document.getElementById('cargoMarketReportPrev');
      let pageMs = 0;
      for(let i=0;i<20;i++) {
        pageMs += timed(() => {
          next.click();prev.click();
        });
      }
      const snapshotMatched = panel.lastReport?.stockAudit?.scanned === true
        && panel.lastReport.stockAudit.settlementCount === 881;
      const currentPage = panel.page;
      const counts = panel.lastReport.stockAudit.counts;
      // CSV's actual click path is already acceptance-tested separately.
      // Measure the real action, but the generated file is disposable.
      const exportMs = timed(() =>
        document.getElementById('cargoMarketReportCsv').click());
      const stateUnchanged = stateBefore === snapshot();
      return {
        ready:true, openMs, movementTabMs, fullStockMs,
        keypressTotalMs:keypressMs, keypressCount:24,
        pageTotalMs:pageMs,pageRoundTrips:20,exportMs,
        snapshotMatched, currentPage, missingMarket:counts.missing_market || 0,
        stateUnchanged, panelOpen:panel.root.style.display === 'block',
        mode:game.state.mode,
      };
    });
    const afterOperations = await metrics();
    const panelOpen = await frames();
    const afterFrames = await metrics();
    const closed = await page.evaluate(() => {
      const panel = window.game.cargoMarketReportPanel;
      document.getElementById('cargoMarketReportClose').click();
      return panel.root.style.display === 'none';
    });
    const afterClosed = await frames();
    const delta = key => finiteNumber(afterOperations[key])
      !== null && finiteNumber(before[key]) !== null
      ? round(afterOperations[key] - before[key]) : null;
    const result = {
      scope: 'actual 881-city Chromium map plus optional report UI',
      profileOnly:true,
      supportedMetrics:metricNames.filter(key => before[key] !== undefined),
      operations: Object.fromEntries(Object.entries(operations)
        .map(([key,val]) => [key, typeof val === 'number'
          ? round(val) : val])),
      raf: { baseline, withPanel:panelOpen, afterClose:afterClosed },
      cdp: {
        before,afterOperations,afterFrames,
        taskDurationDeltaSeconds:delta('TaskDuration'),
        scriptDurationDeltaSeconds:delta('ScriptDuration'),
        heapDeltaBytes:delta('JSHeapUsedSize'),
        // Heap/cpu deltas include ordinary world-loop work and are not
        // isolated per-panel cost or a gameplay benchmark.
      },
      closed,
    };
    if (!operations.ready || !operations.snapshotMatched
      || !operations.stateUnchanged || !operations.panelOpen
      || !closed || baseline.frames !== frameSamples
      || panelOpen.frames !== frameSamples
      || afterClosed.frames !== frameSamples)
      throw new Error('V1.37 incomplete market report performance probe');
    return result;
  } finally {
    await session.detach();
  }
}
