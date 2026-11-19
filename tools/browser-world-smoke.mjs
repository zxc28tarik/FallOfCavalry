// Real browser check of the COMPLETE existing game world, not a new pilot world.
// Requires Playwright and Chromium, installed in the GitHub Actions browser job.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const getArg = (key, fallback) => {
  const idx = process.argv.indexOf(key);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
};
const url = getArg('--url', 'http://127.0.0.1:4173');
const out = resolve(getArg('--report', 'output/browser-smoke/report.json'));
const imageDir = resolve('output/browser-smoke/screenshots');
const seed = Number(getArg('--seed', '1337'));
const report = {
  version: 'browser-world-smoke-v1', scope: 'entire existing procedural world, not a data pilot',
  seed, url, stages: [], pageErrors: [], consoleErrors: [], firstPartyFailures: [], map: null, status: 'RUNNING',
};

const stage = (name, details = {}) => {
  report.stages.push({ name, ...details });
  console.log('[browser-world-smoke] ' + name + ' ' + JSON.stringify(details));
};

async function main() {
  mkdirSync(dirname(out), { recursive: true });
  mkdirSync(imageDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    const expectedOrigin = new URL(url).origin;
    page.on('pageerror', err => report.pageErrors.push(String(err)));
    page.on('console', msg => {
      if (msg.type() === 'error') report.consoleErrors.push(msg.text());
    });
    page.on('response', response => {
      if (response.status() >= 400 && new URL(response.url()).origin === expectedOrigin &&
          !response.url().endsWith('/favicon.ico')) {
        report.firstPartyFailures.push({ url: response.url(), status: response.status() });
      }
    });
    page.on('requestfailed', request => {
      if (new URL(request.url()).origin === expectedOrigin &&
          !request.url().endsWith('/favicon.ico')) {
        report.firstPartyFailures.push({ url: request.url(), error: request.failure()?.errorText || 'request failed' });
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => Boolean(window.game?.initialized), null, { timeout: 30000 });
    const cards = page.locator('#factionGrid .faction-card');
    await cards.first().waitFor({ state: 'visible', timeout: 30000 });
    const factions = await cards.count();
    stage('menu-loaded', { factions });
    await page.screenshot({ path: imageDir + '/01-start-screen.png', fullPage: true });

    await page.locator('#seedInput').fill(String(seed));
    await cards.first().click();
    if (!(await page.locator('#btnStart').isEnabled())) throw new Error('Start button disabled after faction selection');
    await page.locator('#btnStart').click();
    stage('start-button-clicked');

    await page.waitForFunction(() => {
      const g = window.game;
      const world = g?.worldManager?.state?.mapData || g?.state?.mapData;
      return Boolean(g?.started && world?.terrain?.length && world?.width && world?.height);
    }, null, { timeout: 120000 });

    report.map = await page.evaluate(() => {
      const g = window.game, map = g?.worldManager?.state?.mapData || g?.state?.mapData;
      const canvas = document.getElementById('gameCanvas');
      return {
        started: Boolean(g?.started), mode: g?.state?.mode ?? null,
        width: map?.width ?? 0, height: map?.height ?? 0, terrainLength: map?.terrain?.length ?? 0,
        settlements: map?.settlements?.length ?? 0, roads: map?.roads?.length ?? 0,
        worldNpcCount: g?.state?.worldCharacters?.characters?.length ?? 0,
        rivers: map?.rivers?.length ?? 0, crossings: map?.crossings?.length ?? 0,
        canvasWidth: canvas?.width ?? 0, canvasHeight: canvas?.height ?? 0,
        startModalHidden: document.getElementById('startModal')?.classList.contains('hidden') ?? false,
        bootErrorVisible: !(document.getElementById('bootNotice')?.classList.contains('hidden') ?? true),
      };
    });
    stage('full-runtime-world', report.map);
    await page.waitForTimeout(350);
    await page.screenshot({ path: imageDir + '/02-runtime-world.png', fullPage: true });
    if (report.map.width * report.map.height !== report.map.terrainLength) throw new Error('World layer dimensions mismatch');
    if (!report.map.settlements) throw new Error('World has no settlements');
    if (report.map.worldNpcCount !== report.map.settlements * 2) throw new Error('World NPCs not generated for every settlement');
    if (!report.map.canvasWidth || !report.map.canvasHeight) throw new Error('Canvas has zero dimensions');
    if (report.map.bootErrorVisible) throw new Error('Boot error banner visible');
    // CI runs in a disposable browser context: saving is safe and does not touch user files.
    const roundtrip = await page.evaluate(() => {
      const g = window.game;
      const capture = () => {
        const m = g.worldManager?.state?.mapData || g.state?.mapData;
        return {
          day: g.state?.day ?? null,
          gold: g.playerParty?.gold ?? null,
          x: g.playerParty?.x ?? null,
          y: g.playerParty?.y ?? null,
          factionId: g.playerParty?.factionId ?? null,
          worldWidth: m?.width ?? 0,
          worldHeight: m?.height ?? 0,
          settlements: m?.settlements?.length ?? 0,
          worldNpcCount: g.state?.worldCharacters?.characters?.length ?? 0,
          firstWorldNpcId: g.state?.worldCharacters?.characters?.[0]?.id ?? null,
          firstWorldNpcName: g.state?.worldCharacters?.characters?.[0]?.name ?? null,
          mode: g.state?.mode ?? null,
        };
      };
      const before = capture();
      const payload = g.saveManager?.buildSavePayload?.();
      const payloadLength = JSON.stringify(payload)?.length ?? null;
      const npcSaveLength = JSON.stringify(payload?.game?.worldCharacters)?.length ?? null;
      const saveOk = g.saveManager?.quickSave?.() === true;
      const slotExists = g.saveManager?.saveSystem?.hasSlot?.('manual1') === true;
      const loadOk = saveOk ? g.saveManager?.quickLoad?.() === true : false;
      return { saveOk, slotExists, loadOk, payloadLength, npcSaveLength, before, after: capture() };
    });
    report.saveRoundtrip = roundtrip;
    stage('save-roundtrip', {
      saveOk: roundtrip.saveOk, slotExists: roundtrip.slotExists, loadOk: roundtrip.loadOk,
      payloadLength: roundtrip.payloadLength, npcSaveLength: roundtrip.npcSaveLength,
    });
    if (!roundtrip.saveOk || !roundtrip.slotExists || !roundtrip.loadOk) {
      throw new Error('Quick save/load failed in disposable browser context');
    }
    for (const key of ['day', 'gold', 'factionId', 'worldWidth', 'worldHeight', 'settlements',
      'worldNpcCount', 'firstWorldNpcId', 'firstWorldNpcName']) {
      if (roundtrip.before[key] !== roundtrip.after[key]) {
        throw new Error('Save round-trip mismatch at ' + key);
      }
    }
    await page.screenshot({ path: imageDir + '/03-after-save-load.png', fullPage: true });

    // V1.18: real browser world, real quest template and route registry:
    // a pending security objective can provision a bounded source-linked
    // procedural bandit. The test is disposable and leaves no test quest.
    const routeThreat = await page.evaluate(() => {
      const g = window.game;
      const manager = g?.worldManager?.simManager?.worldPartyManager;
      const routes = g?.economyManager?.ensureTradeRoutes?.() || [];
      const generatedRoads = g?.state?.map?.roads || [];
      const roadRoutes = routes.filter(r => r?.roadBacked === true);
      const topologyExact = roadRoutes.length > 0 && roadRoutes.length <= generatedRoads.length
        && roadRoutes.every(route => generatedRoads.some(road =>
          (String(road.from) === String(route.fromCityId)
            && String(road.to) === String(route.toCityId))
          && Array.isArray(road.path) && road.path.length >= 2));
      // Establish ordinary world AI first so test cleanup removes ONLY
      // quest-created threats, never the world's baseline parties.
      manager?.ensureWorldParties?.();
      const occupied = new Set((g?.worldManager?.worldAi?.parties || [])
        .filter((p) => p.kind === 'bandit' && p.alive !== false)
        .map((p) => p.routeId).filter(Boolean));
      const target = roadRoutes.find((r, i) => i > 0 && r?.fromCityId != null
        && r?.toCityId != null && r?.id && !occupied.has(r.id));
      if (!manager || !target || !g?.questGenerator || !g?.questManager) {
        return { ready: false, routeCount: routes.length };
      }
      const quest = g.questGenerator.generateFromTemplate('secure_trade_route', {
        targetCityId: target.fromCityId,
        targetRouteId: target.id, issuerFactionId: 'ottoman',
      });
      if (!quest) return { ready: false, routeCount: routes.length, generatorFailed: true };
      quest.status = 'active';
      const beforeIds = new Set(g.worldManager.worldAi.parties.map(p => p.id));
      const accepted = g.questManager.addQuest(quest);
      manager.ensureWorldParties();
      const found = g.worldManager.enemyParties.find(p => p.worldPartyKind === 'bandit'
        && p.routeId === target.id);
      const saved = g.saveManager.quickSave() === true;
      const loaded = saved && g.saveManager.quickLoad() === true;
      manager.ensureWorldParties();
      const restored = g.worldManager.enemyParties.find(p => p.worldPartyKind === 'bandit'
        && p.routeId === target.id);
      const samePartyId = Boolean(found && restored && found.id === restored.id);
      const persistedWorldParty = g.saveManager.buildSavePayload().game.worldAi.parties
        .some(p => p.id === found?.id && p.routeId === target.id);
      const questStillActive = g.questManager.activeQuests.some(q => q.id === quest.id);
      const newIds = g.worldManager.worldAi.parties
        .filter(p => !beforeIds.has(p.id)).map(p => p.id);
      // Clean up this browser-only scenario; never leak a synthetic test quest.
      g.questManager.activeQuests = g.questManager.activeQuests.filter(q => q.id !== quest.id);
      g.worldManager.worldAi.parties = g.worldManager.worldAi.parties
        .filter(p => !newIds.includes(p.id));
      manager.syncVisiblePartiesToWorld();
      const cleaned = g.saveManager.quickSave() === true;
      return {
        ready: true, routeCount: routes.length, roadRouteCount: roadRoutes.length,
        generatedRoadCount: generatedRoads.length, topologyExact,
        targetIsRealRoad: target?.roadBacked === true, accepted, saved, loaded,
        linkedBeforeLoad: found?.routeId === target.id,
        linkedAfterLoad: restored?.routeId === target.id,
        samePartyId, persistedWorldParty,
        questStillActive, cleaned, newParties: newIds.length,
      };
    });
    report.routeThreat = routeThreat;
    stage('canonical-route-threat-save-resume', routeThreat);
    if (!routeThreat.ready || routeThreat.routeCount < 1
      || routeThreat.roadRouteCount < 1 || !routeThreat.topologyExact
      || !routeThreat.targetIsRealRoad || !routeThreat.accepted
      || !routeThreat.saved || !routeThreat.loaded || !routeThreat.linkedBeforeLoad
      || !routeThreat.linkedAfterLoad || !routeThreat.samePartyId
      || !routeThreat.persistedWorldParty || !routeThreat.questStillActive
      || !routeThreat.cleaned) {
      throw new Error('Active real-route threat creation or source-linked save/resume failed');
    }

    // NPC production must be a deterministic, explicit promotion path, NOT
    // automatic city population, player creation or unit recruitment.
    const productionRoundtrip = await page.evaluate(() => {
      const g = window.game;
      const city = g?.state?.map?.settlements?.find((entry) =>
        ['village', 'town', 'city', 'fort'].includes(entry?.type));
      if (!city || !g?.gameFlowManager?.previewWorldCharacterCandidates) {
        return { ready: false, reason: 'No production source / campaign API' };
      }
      const source = {
        type: city.type, id: city.id, settlementId: city.id,
        // Culture is an explicit source fact, not automatically copied from owner.
        cultureId: 'generic',
      };
      const before = g.state.worldCharacters.characters.length;
      const rosterBefore = g.playerParty?.roster?.length || 0;
      const generated = g.gameFlowManager.previewWorldCharacterCandidates(source, { count: 2 });
      const previewDidNotRegister = g.state.worldCharacters.characters.length === before;
      const availableSources = g.gameFlowManager.listWorldCharacterProductionSources().length;
      let forgedFacilityBlocked = false;
      try {
        g.gameFlowManager.previewWorldCharacterCandidates({
          type: 'inn', id: 'phantom-inn', settlementId: city.id,
        }, {
          count: 1, registeredSources: [
            { type: 'inn', id: 'phantom-inn', settlementId: city.id },
          ],
        });
      } catch {
        forgedFacilityBlocked = true;
      }
      const wrongCampaign = { ...generated, worldSeed: g.state.seed + 1 };
      const wrongCampaignBlocked = g.gameFlowManager.retainWorldCharacter(
        wrongCampaign, generated.candidates[0].id,
      ) === false;
      const sourceContractSafe =
        generated.sourceContract?.possibleImportanceClasses?.[0] === 'D'
        && generated.sourceContract?.isUnavailableForRecruitment === true;
      const chosenId = generated.candidates[0].id;
      const chosen = g.gameFlowManager.retainWorldCharacter(generated, chosenId);
      const registeredAsD = chosen?.kind === 'named' && chosen?.importance === 'D';
      const invalidDirectA = g.gameFlowManager.advanceWorldCharacterImportance(chosenId, 'A', {
        reason: 'Direct jump forbidden',
      }) === false;
      const advancedToC = g.gameFlowManager.advanceWorldCharacterImportance(chosenId, 'C', {
        reason: 'Verified test campaign event',
      }) === true;
      const nextReputation = chosen.reputation === 60 ? 61 : 60;
      const stateEventOk = g.gameFlowManager.changeWorldCharacterMetric(chosenId, 'reputation',
        nextReputation, { reason: 'Explicit browser campaign event' }) === true;
      const mutableStateBeforeSave = g.gameFlowManager.getWorldNamedCharacterState(chosenId);
      const independentCharacterState = mutableStateBeforeSave?.currentReputation === nextReputation
        && mutableStateBeforeSave?.characterId === chosenId
        && mutableStateBeforeSave?.history?.at(-1)?.type === 'state-changed'
        && mutableStateBeforeSave?.history?.at(-1)?.metric === 'reputation'
        && mutableStateBeforeSave?.history?.at(-1)?.from !== nextReputation
        && mutableStateBeforeSave?.history?.at(-1)?.to === nextReputation;
      const duplicate = g.gameFlowManager.retainWorldCharacter(generated, chosenId);
      const after = g.state.worldCharacters.characters.length;
      const membershipOk = g.gameFlowManager.addWorldCharacterBranchMembership(chosenId, 'trade_network', {
        reason: 'Browser accepted trade affiliation',
      }) === true;
      const assignmentOk = g.gameFlowManager.startWorldCharacterAssignment(chosenId, {
        branch: 'city_administration',
        assignmentRole: 'city_ledger_runner',
        assignmentLocation: { kind: 'settlement', settlementId: city.id },
        reason: 'Explicit administrative task',
      }) === true;
      const socialProfileBeforeSave = g.gameFlowManager.getWorldCharacterSocialProfile(chosenId);
      const noInventedSocialTies = socialProfileBeforeSave?.houseMemberships?.length === 0
        && socialProfileBeforeSave.cliqueMemberships.length === 0
        && socialProfileBeforeSave.headedHouses.length === 0
        && g.gameFlowManager.linkWorldCharacterToHouse(chosenId, 'house:nonexistent', {
          reason: 'Must not create fictional house',
        }) === false
        && g.gameFlowManager.linkWorldCharacterToClique(chosenId, 'clique:nonexistent', {
          reason: 'Must not create fictional clique',
        }) === false;
      const profileBeforeSave = g.gameFlowManager.getWorldCharacterOrganizationProfile(chosenId);
      const independentMembership = profileBeforeSave?.memberships?.length === 1
        && profileBeforeSave.memberships[0].branch === 'trade_network'
        && profileBeforeSave.currentAssignment?.branch === 'city_administration'
        && profileBeforeSave.identity?.roleProfile === chosen.role;
      const noInventedAuthored = g.state.worldCharacters.characters.every(
        (person) => !person.id.startsWith('npc:authored-'),
      ) && g.gameFlowManager.getWorldCharacterDefinition(chosenId) === null
        && g.state.characterDefinitionDiagnostics?.length === 0;
      const noInventedQuestBindings = g.gameFlowManager.getWorldCharacterQuestRecords(chosenId)?.length === 0
        && g.state.characterQuestBindings?.entries?.length === 0;
      const savePayload = g.saveManager.buildSavePayload();
      const noQuestBindingSaveLeak = savePayload.game?.characterQuestBindings?.entries?.length === 0;
      const saveRecord = savePayload.game?.worldCharacters;
      const saveOk = g.saveManager.quickSave() === true;
      const loadOk = saveOk && g.saveManager.quickLoad() === true;
      const restored = g.state.worldCharacters.characters.find((person) => person.id === chosenId);
      const noInventedQuestBindingsAfterLoad =
        g.gameFlowManager.getWorldCharacterQuestRecords(chosenId)?.length === 0
        && g.state.characterQuestBindings?.entries?.length === 0;
      const noInventedAuthoredAfterLoad = g.state.worldCharacters.characters.every(
        (person) => !person.id.startsWith('npc:authored-'),
      ) && g.gameFlowManager.getWorldCharacterDefinition(chosenId) === null
        && savePayload.game?.characterDefinitionAuthority === undefined;
      const mutableStateAfterSave = g.gameFlowManager.getWorldNamedCharacterState(chosenId);
      const stateRoundtripOk = mutableStateAfterSave?.currentReputation === nextReputation
        && mutableStateAfterSave?.history?.some((entry) =>
          entry.type === 'state-changed' && entry.metric === 'reputation'
          && entry.to === nextReputation && entry.reason === 'Explicit browser campaign event');
      const socialProfileAfterSave = g.gameFlowManager.getWorldCharacterSocialProfile(chosenId);
      const noInventedSocialTiesAfterLoad = socialProfileAfterSave?.houseMemberships?.length === 0
        && socialProfileAfterSave?.cliqueMemberships?.length === 0
        && savePayload.game?.characterSocial?.houses?.length === 0
        && savePayload.game?.characterSocial?.cliques?.length === 0
        && savePayload.game?.characterSocialPending?.houses?.length === 0
        && savePayload.game?.characterSocialPending?.cliques?.length === 0
        && g.state.characterSocialPending?.houses?.length === 0
        && g.state.characterSocialPending?.cliques?.length === 0;
      const organizationAfterSave = g.gameFlowManager.getWorldCharacterOrganizationProfile(chosenId);
      const organizationRoundtripOk = organizationAfterSave?.memberships?.length === 1
        && organizationAfterSave.memberships[0].branch === 'trade_network'
        && organizationAfterSave.currentAssignment?.branch === 'city_administration'
        && organizationAfterSave.currentAssignment?.assignmentRole === 'city_ledger_runner'
        && savePayload.game?.characterOrganization?.memberships?.length === 1
        && savePayload.game?.characterOrganization?.assignments?.length === 1;
      const nextOffer = g.gameFlowManager.previewWorldCharacterCandidates(source, { count: 2 });
      const savedCandidateExcluded = !nextOffer.candidates.some((person) => person.id === chosenId)
        && nextOffer.candidateSlots?.[0] === 2
        && nextOffer.candidateSlots?.[1] === 3;
      return {
        ready: true, savedCandidateExcluded, advancedToC, invalidDirectA,
        membershipOk, assignmentOk, independentMembership, organizationRoundtripOk,
        noInventedSocialTies, noInventedSocialTiesAfterLoad,
        noInventedAuthored, noInventedAuthoredAfterLoad,
        stateEventOk, independentCharacterState, stateRoundtripOk,
        noInventedQuestBindings, noQuestBindingSaveLeak, noInventedQuestBindingsAfterLoad,
        restoredClass: restored?.importance ?? null,
        restoredPromotionHistory: restored?.history?.some((entry) =>
          entry.type === 'importance' && entry.from === 'D' && entry.to === 'C') ?? false,
        nextOfferSlots: nextOffer.candidateSlots,
        sourceType: city.type, before, after, selectedId: chosenId,
        previewDidNotRegister, registerOk: registeredAsD,
        availableSources, forgedFacilityBlocked, wrongCampaignBlocked, sourceContractSafe,
        duplicateBlocked: duplicate === false,
        unitRosterUnchanged: (g.playerParty?.roster?.length || 0) === rosterBefore,
        deltaFormat: saveRecord?.format,
        additions: saveRecord?.additions?.length ?? 0,
        sourceProvenance: restored?.history?.[0]?.sourceType ?? null,
        saveOk, loadOk, restoredKind: restored?.kind ?? null,
      };
    });
    report.characterProduction = productionRoundtrip;
    stage('source-character-production-roundtrip', productionRoundtrip);
    if (!productionRoundtrip.ready || !productionRoundtrip.previewDidNotRegister ||
      !productionRoundtrip.savedCandidateExcluded || !productionRoundtrip.membershipOk ||
      !productionRoundtrip.assignmentOk || !productionRoundtrip.noInventedSocialTies ||
      !productionRoundtrip.noInventedSocialTiesAfterLoad ||
      !productionRoundtrip.noInventedAuthored ||
      !productionRoundtrip.noInventedAuthoredAfterLoad ||
      !productionRoundtrip.stateEventOk || !productionRoundtrip.independentCharacterState ||
      !productionRoundtrip.stateRoundtripOk ||
      !productionRoundtrip.noInventedQuestBindings ||
      !productionRoundtrip.noQuestBindingSaveLeak ||
      !productionRoundtrip.noInventedQuestBindingsAfterLoad ||
      !productionRoundtrip.independentMembership ||
      !productionRoundtrip.organizationRoundtripOk || !productionRoundtrip.invalidDirectA ||
      !productionRoundtrip.advancedToC || productionRoundtrip.restoredClass !== 'C' ||
      !productionRoundtrip.restoredPromotionHistory ||
      productionRoundtrip.availableSources < 1 || !productionRoundtrip.forgedFacilityBlocked ||
      !productionRoundtrip.wrongCampaignBlocked || !productionRoundtrip.sourceContractSafe ||
      !productionRoundtrip.registerOk || !productionRoundtrip.duplicateBlocked ||
      !productionRoundtrip.unitRosterUnchanged || productionRoundtrip.after !== productionRoundtrip.before + 1 ||
      productionRoundtrip.deltaFormat !== 'seeded-delta-v1' || productionRoundtrip.additions !== 1 ||
      productionRoundtrip.sourceProvenance !== productionRoundtrip.sourceType ||
      !productionRoundtrip.saveOk || !productionRoundtrip.loadOk ||
      productionRoundtrip.restoredKind !== 'named') {
      throw new Error('Source-based NPC production/retention failed browser save/load');
    }

    // The NPC sheet must work in the actual city UI, not only in unit tests.
    const npcCity = await page.evaluate(() => {
      const g = window.game;
      const first = g?.state?.worldCharacters?.characters?.[0];
      const settlement = g?.state?.map?.settlements?.find((entry) => String(entry.id) === first?.location?.settlementId);
      g?.cityUI?.show?.(settlement, { recruitPool: [], market: null, contracts: [] });
      return {
        cityId: settlement?.id ?? null,
        hasCityUI: Boolean(g?.cityUI),
        visibleRows: document.querySelectorAll('[data-action="open-npc"]').length,
      };
    });
    stage('npc-city-list', npcCity);
    if (npcCity.cityId == null || !npcCity.hasCityUI || npcCity.visibleRows < 1) {
      throw new Error('World NPCs are not visible in the actual city interface');
    }
    await page.locator('[data-action="open-npc"]').first().click();
    const npcProfile = await page.evaluate(() => {
      const g = window.game;
      const body = g?.cityUI?.getPanelBodyEl?.()?.textContent || '';
      return {
        view: g?.cityUI?.currentView?.type || null,
        selectedNpcId: g?.cityUI?.currentView?.npcId || null,
        hasStats: body.includes('Yetenekler') && body.includes('Komuta'),
        hasTraits: body.includes('Kişilik'),
        hasHistory: body.includes('Geçmiş') && body.includes('Oluşturuldu'),
        hasReturn: Boolean(g?.cityUI?.getPanelBodyEl?.()?.querySelector?.('[data-action="show-overview"]')),
      };
    });
    stage('npc-character-sheet', npcProfile);
    if (npcProfile.view !== 'npc' || !npcProfile.selectedNpcId ||
        !npcProfile.hasStats || !npcProfile.hasTraits || !npcProfile.hasHistory || !npcProfile.hasReturn) {
      throw new Error('NPC character details did not render correctly in the browser');
    }
    await page.screenshot({ path: imageDir + '/04-npc-character-sheet.png', fullPage: true });
    await page.locator('[data-action="show-overview"]').click();
    const backToCity = await page.evaluate(() => {
      const g = window.game;
      const ok = g?.cityUI?.currentView?.type === 'overview';
      g?.cityUI?.hide?.();
      return ok;
    });
    if (!backToCity) throw new Error('NPC character details did not navigate back to city');


    // V1.14: verified real quest + an existing named officer survives a full
    // browser quickSave/quickLoad; prior objective "victory" is never credited
    // on load without real gameplay confirmation.
    const questResume = await page.evaluate(() => {
      const g = window.game;
      const duty = g?.state?.characterOrganization?.assignments?.find((entry) =>
        entry.assignmentStatus === 'active');
      const route = g?.economyManager?.ensureTradeRoutes?.()?.[0];
      if (!duty || !route) return { ready: false };
      const quest = g.questGenerator.generateFromTemplate('secure_trade_route', {
        targetCityId: duty.assignmentLocation.settlementId,
        targetRouteId: route.id,
        issuerFactionId: 'ottoman',
      });
      if (!quest) return { ready: false, generatorFailed: true };
      quest.status = 'active';
      const added = g.questManager.addQuest(quest);
      const bound = g.gameFlowManager.assignWorldCharacterToQuest(
        quest.id, duty.characterId, { reason: 'Browser explicit mission assignment' },
      );
      quest.objectives[0].outcome = 'bandits_defeated';
      const gold = g.playerParty.gold;
      const snap = g.saveManager.buildSavePayload().game.questSnapshot;
      const safeSnapshot = snap?.active?.some((entry) => entry.id === quest.id)
        && !JSON.stringify(snap).includes('"rewards"')
        && !JSON.stringify(snap).includes('"worldEffects"');
      const saved = g.saveManager.quickSave() === true;
      const loaded = saved && g.saveManager.quickLoad() === true;
      const restored = g.questManager.activeQuests.find((entry) => entry.id === quest.id);
      const ledger = g.state.characterQuestBindings?.entries?.find((entry) =>
        entry.questId === quest.id);
      return {
        ready: true, added, bound, saved, loaded, safeSnapshot,
        activeRestored: restored?.status === 'active'
          && restored.templateId === 'secure_trade_route',
        actorRestored: restored?.assignedCharacterId === duty.characterId
          && ledger?.status === 'active',
        claimsAreInert: restored?.objectives?.[0]?.outcome === undefined
          && restored?.pendingObjectiveClaims?.[0]?.outcome === 'bandits_defeated',
        noRewardReplay: g.playerParty.gold === gold,
        restoreCount: g.state.questRestoreReport?.restored ?? null,
        restoredBindings: g.state.questRestoreReport?.restoredBindings ?? null,
      };
    });
    report.questResume = questResume;
    stage('canonical-quest-save-resume', questResume);
    if (!questResume.ready || !questResume.added || !questResume.bound
      || !questResume.saved || !questResume.loaded || !questResume.safeSnapshot
      || !questResume.activeRestored || !questResume.actorRestored
      || !questResume.claimsAreInert || !questResume.noRewardReplay
      || questResume.restoreCount < 1 || questResume.restoredBindings < 1) {
      throw new Error('Canonical quest + NamedCharacter save/resume regression');
    }

    // V1.20: REAL battle engine loop from actual WorldAI route-bound enemy.
    // Test supplies a super-strong disposable infantry unit for deterministic
    // victory; it does NOT call resolveBattle(), forge ledger evidence, or
    // set objective outcomes. The engine must resolve combat on its own.
    const questBattle = await page.evaluate(() => {
      const g = window.game;
      const manager = g?.worldManager?.simManager?.worldPartyManager;
      const sim = g?.worldManager?.simManager;
      const roadRoutes = (g?.economyManager?.ensureTradeRoutes?.() || [])
        .filter((row) => row?.roadBacked);
      if (g?.state?.mode !== 'map' || !manager || !sim || !roadRoutes.length) {
        return { ready: false, reason: 'not_in_map_or_without_road_routes' };
      }
      manager.ensureWorldParties();
      const activeRouteIds = new Set((g.questManager.activeQuests || [])
        .map(q => q.targetRouteId).filter(Boolean));
      const route = roadRoutes.find((r) => !activeRouteIds.has(r.id));
      if (!route) return { ready: false, reason: 'no_free_canonical_route' };
      const quest = g.questGenerator.generateFromTemplate('secure_trade_route', {
        targetCityId: route.fromCityId, targetRouteId: route.id,
        issuerFactionId: 'ottoman',
      });
      if (!quest) return { ready: false, reason: 'canonical_quest_not_generated' };
      quest.status = 'active';
      const added = g.questManager.addQuest(quest);
      if (!added) return { ready: false, reason: 'canonical_quest_not_accepted' };
      manager.ensureWorldParties();
      const source = g.worldManager.worldAi.parties.find(p =>
        p.kind === 'bandit' && p.alive !== false && p.routeId === route.id);
      if (!source) return { ready: false, reason: 'target_world_bandit_missing' };

      // Isolated test formation/position for deterministic combat; these are
      // never shipped as a spawn recipe, reward, or a named NPC.
      g.playerParty.x = 260;
      g.playerParty.y = 320;
      // Several fast disposable melee troops prevent a single soldier from
      // endlessly chasing ranged skirmishers across the battlefield.
      // Still no direct HP edit or forced victory; the real engine must
      // perform actual attacks, damage and result resolution.
      g.playerParty.roster = Array.from({ length: 6 }, (_, i) => ({
        id: `qa-infantry-v121-${i}`, name: `QA Infantry ${i + 1}`,
        class: 'infantry', hp: 4500, maxHp: 4500, atk: 3500, def: 500,
        speed: 1100, meleeRange: 240, isRanged: false,
        status: 'healthy', healProgress: 0,
      }));
      const encountered = sim.processWorldAiEncounters([{
        partyId: source.id, factionId: source.factionId,
        x: source.x, y: source.y,
      }]);
      const enemyId = g.state.encounter?.enemyId;
      const sourceMatched = Boolean(encountered && enemyId === `wai-${source.id}`
        && g.worldManager.enemyParties.some(p =>
          p.id === enemyId && p.routeId === route.id));
      if (!sourceMatched) return { ready: false, reason: 'encounter_lost_route_provenance' };
      const fight = g.encounterManager.resolveEncounter('fight') === true;
      if (!fight) return { ready: false, reason: 'fight_option_rejected' };
      const selected = g.battleManager.confirmRosterSelection() === true;
      if (!selected) return { ready: false, reason: 'real_roster_selection_rejected' };
      const deployed = g.battleManager.confirmBattleDeployment() === true;
      if (!deployed) return { ready: false, reason: 'real_deployment_rejected' };

      const battle = g.state.battle;
      const units = battle?.enemyUnits?.length || 0;
      const originalEnemyHp = (battle.enemyUnits || [])
        .reduce((sum, e) => sum + e.hp, 0);
      let ticks = 0;
      for (; ticks < 350 && g.state.battle?.phase === 'active'; ticks += 1) {
        g.battleManager.updateBattleSimulation(0.12);
      }
      const result = g.state.battle?.battleResult?.result;
      const enemyHp = (g.state.battle?.enemyUnits || [])
        .reduce((sum, e) => sum + Math.max(0, e.hp), 0);
      const event = g.state.questEventLedger?.observed?.find(e =>
        e.enemyId === enemyId && e.source === 'battle_result' && e.result === 'victory');
      return {
        ready: true, added, encountered, fight, selected, deployed,
        questId: quest.id, routeId: route.id, enemyId,
        enemyUnits: units, ticks, originalEnemyHp, finalEnemyHp: enemyHp,
        genuineCombatDamage: enemyHp < originalEnemyHp,
        result, resultPanel: g.state.battle?.phase === 'result',
        ledgerSource: event?.source ?? null,
        ledgerRoute: event?.routeId ?? null,
        completedEarly: g.questManager.completedQuests.some(q => q.id === quest.id),
        objectiveBeforeExit: quest.objectives?.[0]?.outcome ?? null,
      };
    });
    report.questBattle = questBattle;
    stage('real-engine-quest-battle', questBattle);
    if (!questBattle.ready || !questBattle.added || !questBattle.encountered
      || !questBattle.fight || !questBattle.selected || !questBattle.deployed
      || questBattle.enemyUnits < 1 || !questBattle.genuineCombatDamage
      || questBattle.result !== 'victory' || !questBattle.resultPanel
      || questBattle.ledgerSource !== 'battle_result'
      || questBattle.ledgerRoute !== questBattle.routeId
      || questBattle.completedEarly || questBattle.objectiveBeforeExit !== null) {
      throw new Error('Real battle engine failed to produce verifiable route quest victory');
    }

    // The game's real Enter-key handler exits the battle result. That is the
    // moment the live event becomes quest objective proof and opens the overlay.
    await page.keyboard.press('Enter');
    const questOffer = await page.evaluate((id) => {
      const g = window.game;
      const quest = g.questManager.activeQuests.find(q => q.id === id);
      const overlay = document.getElementById('questCompletionOverlay');
      const buttons = [...(overlay?.querySelectorAll('button.quest-path') || [])];
      return {
        mode: g.state.mode,
        objective: quest?.objectives?.find(o => o.id === 'resolve_bandit_threat')?.outcome,
        pathAvailable: Boolean(buttons.find(b =>
          b.textContent.includes('Haydutları savaşta yendim') && !b.disabled)),
        overlayVisible: Boolean(overlay && !overlay.classList.contains('hidden')),
        goldBeforeChoice: g.playerParty.gold,
        countCompletedBeforeChoice: g.questManager.completedQuests
          .filter(q => q.id === id).length,
        pendingCount: g.state.questEventLedger?.pending?.length || 0,
      };
    }, questBattle.questId);
    report.questOffer = questOffer;
    stage('quest-completion-offer-after-enter', questOffer);
    if (questOffer.mode !== 'map' || questOffer.objective !== 'bandits_defeated'
      || !questOffer.pathAvailable || !questOffer.overlayVisible
      || questOffer.countCompletedBeforeChoice !== 0) {
      throw new Error('Real victory did not open canonical quest completion choice');
    }

    // V1.21: the first save is made AFTER a real battle source was witnessed
    // but BEFORE the player clicked the reward button. Same-process memory
    // proof may restore the unlocked objective, but the save alone cannot.
    const sessionContinue = await page.evaluate(({ id, goldBeforeChoice }) => {
      const g = window.game;
      const saved = g.saveManager.quickSave() === true;
      const loaded = saved && g.saveManager.quickLoad() === true;
      const quest = g.questManager.activeQuests.find(q => q.id === id);
      const root = document.getElementById('questCompletionOverlay');
      const button = [...(root?.querySelectorAll('button') || [])].find(b =>
        b.textContent.includes('Haydutları savaşta yendim') && !b.disabled);
      const summary = {
        saved, loaded, active: quest?.status === 'active',
        objective: quest?.objectives?.[0]?.outcome ?? null,
        liveSessionVerified: g.state.questRestoreReport?.sessionVerified ?? 0,
        savedHistoryCredited: g.state.questRestoreReport?.creditedEvents ?? -1,
        noEarlyReward: g.playerParty.gold === goldBeforeChoice,
        pathOffered: Boolean(button && root && !root.classList.contains('hidden')),
      };
      g.questRecoveryPanel?.hide?.(); // Keep auxiliary review off the gameplay button.
      return summary;
    }, { id: questBattle.questId, goldBeforeChoice: questOffer.goldBeforeChoice });
    report.sessionContinue = sessionContinue;
    stage('same-session-verified-quest-progress-save-resume', sessionContinue);
    if (!sessionContinue.saved || !sessionContinue.loaded || !sessionContinue.active
      || sessionContinue.objective !== 'bandits_defeated'
      || sessionContinue.liveSessionVerified !== 1 || sessionContinue.savedHistoryCredited !== 0
      || !sessionContinue.noEarlyReward || !sessionContinue.pathOffered) {
      throw new Error('Same-process witnessed quest objective failed to revalidate safely');
    }

    // Actual DOM click; do not call completeQuest() to perform completion.
    await page.locator('#questCompletionOverlay button.quest-path:not([disabled])')
      .filter({ hasText: 'Haydutları savaşta yendim' }).click();
    const questCompleted = await page.evaluate(({ id, goldBeforeChoice }) => {
      const g = window.game;
      const completed = g.questManager.completedQuests.filter(q => q.id === id);
      const active = g.questManager.activeQuests.some(q => q.id === id);
      const overlay = document.getElementById('questCompletionOverlay');
      const afterClickGold = g.playerParty.gold;
      const secondCompletionRejected = g.questManager.completeQuest(id, 'defeat_bandits') !== true;
      const noDoubleReward = g.playerParty.gold === afterClickGold;
      const saved = g.saveManager.quickSave() === true;
      const loaded = saved && g.saveManager.quickLoad() === true;
      const loadedCompleted = g.questManager.completedQuests.filter(q => q.id === id);
      return {
        completedCount: completed.length,
        completedPath: completed[0]?.completedPath,
        active, overlayHidden: overlay?.classList.contains('hidden') === true,
        exactGoldReward: afterClickGold - goldBeforeChoice === 300,
        secondCompletionRejected, noDoubleReward,
        saved, loaded, completedArchive: loadedCompleted.length === 1
          && loadedCompleted[0].archived === true,
        goldAfterLoadUnchanged: g.playerParty.gold === afterClickGold,
        questNotReactivated: !g.questManager.activeQuests.some(q => q.id === id),
      };
    }, { id: questBattle.questId, goldBeforeChoice: questOffer.goldBeforeChoice });
    report.questCompleted = questCompleted;
    stage('quest-completion-button-and-save', questCompleted);
    if (questCompleted.completedCount !== 1
      || questCompleted.completedPath !== 'defeat_bandits'
      || questCompleted.active || !questCompleted.overlayHidden
      || !questCompleted.exactGoldReward || !questCompleted.secondCompletionRejected
      || !questCompleted.noDoubleReward || !questCompleted.saved
      || !questCompleted.loaded || !questCompleted.completedArchive
      || !questCompleted.goldAfterLoadUnchanged || !questCompleted.questNotReactivated) {
      throw new Error('Canonical quest button failed or replayed completion/reward on save');
    }

    // A stale completion prompt must not silently vanish or grant rewards.
    // Simulate an old UI payload for an already-completed genuine quest; the
    // canonical manager must reject a duplicate, and the UI must stay open.
    const staleOffer = await page.evaluate((id) => {
      const g = window.game;
      const shown = g.questCompletionOverlay.show({
        questId: id, title: 'Already completed quest',
        paths: [{ id: 'defeat_bandits', label: 'Haydutları savaşta yendim', available: true }],
      });
      return { shown, gold: g.playerParty.gold };
    }, questBattle.questId);
    await page.locator('#questCompletionOverlay button.quest-path:not([disabled])')
      .filter({ hasText: 'Haydutları savaşta yendim' }).click();
    const rejectedStale = await page.evaluate(({ id, gold }) => {
      const g = window.game;
      const root = document.getElementById('questCompletionOverlay');
      const button = root?.querySelector('button.quest-path');
      const check = {
        goldUnchanged: g.playerParty.gold === gold,
        completedExactlyOnce: g.questManager.completedQuests
          .filter(q => q.id === id).length === 1,
        overlayRemainsOpen: !root?.classList.contains('hidden'),
        staleButtonDisabled: button?.disabled === true,
      };
      g.questCompletionOverlay.hide();
      return check;
    }, { id: questBattle.questId, gold: staleOffer.gold });
    report.rejectedStale = rejectedStale;
    stage('rejected-stale-quest-button', rejectedStale);
    if (!staleOffer.shown || !rejectedStale.goldUnchanged
      || !rejectedStale.completedExactlyOnce || !rejectedStale.overlayRemainsOpen
      || !rejectedStale.staleButtonDisabled) {
      throw new Error('Stale quest completion UI misleadingly dismissed or paid twice');
    }

    // V1.21: a legacy list-order trade-route quest is kept unchanged on load
    // and displayed as UNVERIFIED. A human-style DOM click opts in to a
    // replacement route connected to the same original settlement.
    const oldRouteReview = await page.evaluate(() => {
      const g = window.game;
      const registered = g.economyManager.ensureTradeRoutes();
      const roadRoutes = registered.filter(r => r.roadBacked === true);
      const legacyRoutes = registered.filter(r => r.roadBacked === false);
      const old = legacyRoutes.find(r => roadRoutes.some(road =>
        String(road.fromCityId) === String(r.fromCityId)
        || String(road.toCityId) === String(r.fromCityId)));
      if (!old) return { ready: false, reason: 'no_eligible_legacy_route' };
      const quest = g.questGenerator.generateFromTemplate('secure_trade_route', {
        targetCityId: old.fromCityId, targetRouteId: old.id,
        issuerFactionId: 'ottoman',
      });
      if (!quest) return { ready: false, reason: 'cannot_generate_legacy_quest' };
      quest.status = 'active';
      if (!g.questManager.addQuest(quest)) return { ready: false, reason: 'cannot_add_legacy_quest' };
      // Saved outcomes are merely user-editable claims, not gameplay evidence.
      quest.objectives[0].outcome = 'bandits_defeated';
      const goldBefore = g.playerParty.gold;
      const saved = g.saveManager.quickSave() === true;
      const loaded = saved && g.saveManager.quickLoad() === true;
      const current = g.questManager.activeQuests.find(q => q.id === quest.id);
      const panel = document.getElementById('questRecoveryPanel');
      const button = [...(panel?.querySelectorAll('.quest-reissue-route') || [])]
        .find(b => b.dataset.questId === quest.id);
      return {
        ready: true, questId: quest.id, oldRoute: old.id,
        goldBefore, saved, loaded,
        legacyUnchanged: current?.targetRouteId === old.id,
        claimStillPending: current?.objectives?.[0]?.outcome === undefined
          && current?.pendingObjectiveClaims?.[0]?.outcome === 'bandits_defeated',
        noReward: g.playerParty.gold === goldBefore,
        proposalVisible: Boolean(button && panel.style.display === 'block'),
        offeredRoute: button?.textContent ?? null,
      };
    });
    report.oldRouteReview = oldRouteReview;
    stage('legacy-route-claim-recovery-review', oldRouteReview);
    if (!oldRouteReview.ready || !oldRouteReview.saved || !oldRouteReview.loaded
      || !oldRouteReview.legacyUnchanged || !oldRouteReview.claimStillPending
      || !oldRouteReview.noReward || !oldRouteReview.proposalVisible) {
      throw new Error('Legacy route failed fail-closed review before explicit consent');
    }

    await page.locator('#questRecoveryPanel button.quest-reissue-route')
      .filter({ hasText: 'Yeni yol hedefini onayla' }).first().click();
    const oldRouteReissued = await page.evaluate(({ questId, oldRoute, goldBefore }) => {
      const g = window.game;
      const quest = g.questManager.activeQuests.find(q => q.id === questId);
      const old = g.economyManager.ensureTradeRoutes()
        .find(r => r.id === oldRoute);
      const candidate = g.economyManager.ensureTradeRoutes()
        .find(r => r.id === quest?.targetRouteId);
      const progressNotFabricated = quest?.objectives?.[0]?.outcome == null
        && quest?.pendingObjectiveClaims?.[0]?.outcome === 'bandits_defeated';
      const noReward = g.playerParty.gold === goldBefore;
      const saved = g.saveManager.quickSave() === true;
      const loaded = saved && g.saveManager.quickLoad() === true;
      const restored = g.questManager.activeQuests.find(q => q.id === questId);
      return {
        sameQuestId: quest?.id === questId,
        currentDay: g.state.day, resetDay: quest?.createdAt,
        oldStillLegacy: old?.roadBacked === false,
        realRoute: candidate?.roadBacked === true,
        routeChanged: quest?.targetRouteId !== oldRoute,
        progressNotFabricated, noReward, saved, loaded,
        reissuedSurvivedLoad: restored?.targetRouteId === quest?.targetRouteId
          && restored?.objectives?.[0]?.outcome === undefined,
        noRewardAfterLoad: g.playerParty.gold === goldBefore,
      };
    }, {
      questId: oldRouteReview.questId,
      oldRoute: oldRouteReview.oldRoute,
      goldBefore: oldRouteReview.goldBefore,
    });
    report.oldRouteReissued = oldRouteReissued;
    stage('legacy-route-explicit-consent-no-reward', oldRouteReissued);
    if (!oldRouteReissued.sameQuestId || !oldRouteReissued.oldStillLegacy
      || !oldRouteReissued.realRoute || !oldRouteReissued.routeChanged
      || oldRouteReissued.resetDay !== oldRouteReissued.currentDay
      || !oldRouteReissued.progressNotFabricated || !oldRouteReissued.noReward
      || !oldRouteReissued.saved || !oldRouteReissued.loaded
      || !oldRouteReissued.reissuedSurvivedLoad || !oldRouteReissued.noRewardAfterLoad) {
      throw new Error('Explicit legacy route replacement lost identity or manufactured a reward');
    }

    // V1.22 — the actual WorldPartyManager moves a canonical caravan along
    // the generated road. The player must escort it (proximity and time);
    // the browser does not directly set caravan arrival or quest outcomes.
    const caravanEscort = await page.evaluate(() => {
      const g = window.game;
      const routes = g.economyManager.ensureTradeRoutes()
        .filter(r => r.roadBacked === true);
      const roads = g.state.map.roads || [];
      const small = routes.map(r => {
        const road = roads.find(d => String(d.from) === String(r.fromCityId)
          && String(d.to) === String(r.toCityId));
        const points = road?.path || [];
        const length = points.slice(1).reduce((sum, point, i) =>
          sum + Math.hypot(point.x - points[i].x, point.y - points[i].y), 0);
        return { route: r, segments: points.length, length };
      }).filter(r => r.segments >= 2 && Number.isFinite(r.length) && r.length > 0)
        // Do not mistake a two-point road spanning the entire continent for
        // a short test route. Choose actual physical length, not node count.
        .sort((a, b) => a.length - b.length);
      const chosen = small[0]?.route;
      if (!chosen) return { ready: false, reason: 'no_short_registered_road' };
      const quest = g.questGenerator.generateFromTemplate('escort_first_caravan', {
        targetRouteId: chosen.id, issuerFactionId: 'ottoman',
      });
      if (!quest) return { ready: false, reason: 'real_escort_template_not_generated' };
      quest.status = 'active';
      const accepted = g.questManager.addQuest(quest);
      const manager = g.worldManager.simManager.worldPartyManager;
      manager.ensureWorldParties();
      const party = g.worldManager.worldAi.parties.find(p =>
        p.escortQuestId === quest.id && p.routeId === chosen.id);
      if (!party || !accepted) return { ready: false, reason: 'real_escort_party_missing' };
      const original = { x: party.x, y: party.y };
      // A real player who is far away cannot cause the convoy to move.
      const originalPlayer = { x: g.playerParty.x, y: g.playerParty.y };
      g.playerParty.x = 100000;
      g.playerParty.y = 100000;
      manager.updateWorldParties(0.15);
      const waitsForPlayer = party.x === original.x && party.y === original.y
        && party.escortStarted === false;
      g.playerParty.x = original.x;
      g.playerParty.y = original.y;
      // Test-only faster convoy to make E2E bounded. The real AI update
      // performs ALL movement/arrival checks, never forced victory.
      party.speed = 18;
      let ticks = 0;
      for (; ticks < 700 && quest.objectives[0].outcome == null; ticks += 1) {
        g.playerParty.x = party.x;
        g.playerParty.y = party.y;
        manager.updateWorldParties(0.15);
      }
      const event = g.state.questEventLedger.observed.find(e =>
        e.source === 'caravan_arrival' && e.questId === quest.id
        && e.routeId === chosen.id && e.result === 'caravan_arrived');
      const root = document.getElementById('questCompletionOverlay');
      const button = [...(root?.querySelectorAll('.quest-path') || [])].find(b =>
        b.textContent.includes('Kervan güvenli ulaştı') && !b.disabled);
      return {
        ready: true, accepted, waitsForPlayer,
        routeId: chosen.id, questId: quest.id,
        caravanId: party.id, ticks, visited: party.escortVisitedPoints,
        totalWaypoints: party.path?.length,
        roadLengthTiles: small[0]?.length,
        escortStarted: party.escortStarted,
        failed: party.escortFailed, alive: party.alive,
        x: party.x, y: party.y, targetX: party.targetX, targetY: party.targetY,
        separationSeconds: party.escortSeparationSeconds,
        questStatus: quest.status,
        realArrival: party.escortArrived === true,
        objective: quest.objectives[0].outcome,
        ledgerSource: event?.source, ledgerRoute: event?.routeId,
        noEarlyReward: g.questManager.completedQuests
          .every(q => q.id !== quest.id),
        buttonVisible: Boolean(button && root && !root.classList.contains('hidden')),
        goldBeforeClick: g.playerParty.gold,
        originalPlayer,
      };
    });
    report.caravanEscort = caravanEscort;
    stage('real-road-live-caravan-escort', caravanEscort);
    if (!caravanEscort.ready || !caravanEscort.accepted
      || !caravanEscort.waitsForPlayer || !caravanEscort.realArrival
      || caravanEscort.visited < 2 || caravanEscort.objective !== 'caravan_arrived'
      || caravanEscort.ledgerSource !== 'caravan_arrival'
      || caravanEscort.ledgerRoute !== caravanEscort.routeId
      || !caravanEscort.noEarlyReward || !caravanEscort.buttonVisible) {
      throw new Error('Real route caravan did not produce witnessed arrival objective');
    }
    await page.locator('#questCompletionOverlay button.quest-path:not([disabled])')
      .filter({ hasText: 'Kervan güvenli ulaştı' }).click();
    const caravanPayout = await page.evaluate(({ id, gold }) => {
      const g = window.game;
      const complete = g.questManager.completedQuests.filter(q => q.id === id);
      const reward = g.playerParty.gold - gold;
      const replayRejected = g.questManager.completeQuest(id, 'caravan_delivered') !== true;
      const afterReplay = g.playerParty.gold;
      const saved = g.saveManager.quickSave() === true;
      const loaded = saved && g.saveManager.quickLoad() === true;
      const afterLoad = g.questManager.completedQuests.filter(q => q.id === id);
      return {
        completeExactlyOnce: complete.length === 1,
        completedPath: complete[0]?.completedPath,
        reward, replayRejected, saved, loaded,
        moneyUnchanged: g.playerParty.gold === afterReplay,
        archivedExactlyOnce: afterLoad.length === 1 && afterLoad[0].archived === true,
        activeNotRecreated: !g.questManager.activeQuests.some(q => q.id === id),
        savedEscortsInert: !g.saveManager.buildSavePayload().game.worldAi.parties
          .some(p => String(p.id).startsWith('quest-escort-')),
      };
    }, { id: caravanEscort.questId, gold: caravanEscort.goldBeforeClick });
    report.caravanPayout = caravanPayout;
    stage('verified-caravan-250-gold-no-replay', caravanPayout);
    if (!caravanPayout.completeExactlyOnce || caravanPayout.completedPath !== 'caravan_delivered'
      || caravanPayout.reward !== 250 || !caravanPayout.replayRejected
      || !caravanPayout.saved || !caravanPayout.loaded || !caravanPayout.moneyUnchanged
      || !caravanPayout.archivedExactlyOnce || !caravanPayout.activeNotRecreated
      || !caravanPayout.savedEscortsInert) {
      throw new Error('Verified escort payout double-credited or failed save archive');
    }

    // V1.22: unsupported OLD escort routes are not silently reissued,
    // completed or penalized. The player explicitly retires them using
    // a real browser DOM button; route damage and gold must not change.
    const oldEscort = await page.evaluate(() => {
      const g = window.game;
      const route = g.economyManager.ensureTradeRoutes()
        .find(row => row.roadBacked === false);
      if (!route) return { ready: false, reason: 'legacy_route_absent' };
      const quest = g.questGenerator.generateFromTemplate('escort_first_caravan', {
        targetRouteId: route.id, issuerFactionId: 'ottoman',
      });
      if (!quest) return { ready: false, reason: 'escort_template_missing' };
      quest.status = 'active';
      if (!g.questManager.addQuest(quest)) return { ready: false, reason: 'quest_not_accepted' };
      const gold = g.playerParty.gold;
      const damage = Number(route.damage ?? 0);
      const saved = g.saveManager.quickSave() === true;
      const loaded = saved && g.saveManager.quickLoad() === true;
      const panel = document.getElementById('questRecoveryPanel');
      const action = [...(panel?.querySelectorAll('.quest-retire-legacy') || [])]
        .find(b => b.dataset.questId === quest.id);
      const loadedQuest = g.questManager.activeQuests.find(q => q.id === quest.id);
      return {
        ready: true, questId: quest.id, routeId: route.id,
        gold, damage, saved, loaded,
        routeNotChanged: loadedQuest?.targetRouteId === route.id,
        noCredit: loadedQuest?.objectives?.[0]?.outcome === undefined,
        optInButton: Boolean(action),
      };
    });
    report.oldEscort = oldEscort;
    stage('unsupported-legacy-escort-retirement-offer', oldEscort);
    if (!oldEscort.ready || !oldEscort.saved || !oldEscort.loaded
      || !oldEscort.routeNotChanged || !oldEscort.noCredit
      || !oldEscort.optInButton) {
      throw new Error('Unsupported legacy escort did not offer honest player retirement');
    }
    await page.locator('#questRecoveryPanel button.quest-retire-legacy')
      .filter({ hasText: 'Eski görevi cezasız bırak' }).first().click();
    const retired = await page.evaluate(({ questId, routeId, gold, damage }) => {
      const g = window.game;
      const route = g.economyManager.ensureTradeRoutes().find(r => r.id === routeId);
      const status = g.questManager.failedQuests.find(q => q.id === questId);
      const checks = {
        inactive: !g.questManager.activeQuests.some(q => q.id === questId),
        failedArchive: status?.failReason === 'legacy_route_retired'
          && status?.status === 'failed',
        notRewarded: !g.questManager.completedQuests.some(q => q.id === questId),
        moneyUnchanged: g.playerParty.gold === gold,
        routeNotDamaged: Number(route?.damage ?? 0) === damage,
      };
      const saved = g.saveManager.quickSave() === true;
      const loaded = saved && g.saveManager.quickLoad() === true;
      const afterLoad = g.questManager.failedQuests.find(q => q.id === questId);
      return { ...checks, saved, loaded,
        archiveSurvives: afterLoad?.archived === true
          && afterLoad?.failReason === 'legacy_route_retired',
        noRewardAfterLoad: g.playerParty.gold === gold,
      };
    }, oldEscort);
    report.oldEscortRetired = retired;
    stage('unsupported-legacy-escort-no-penalty-retirement', retired);
    if (!retired.inactive || !retired.failedArchive || !retired.notRewarded
      || !retired.moneyUnchanged || !retired.routeNotDamaged
      || !retired.saved || !retired.loaded
      || !retired.archiveSurvives || !retired.noRewardAfterLoad) {
      throw new Error('Unsupported legacy quest opt-in retirement applied hidden penalties');
    }

    if (report.pageErrors.length) throw new Error('Uncaught page errors: ' + report.pageErrors.join('; '));
    if (report.firstPartyFailures.length) throw new Error('First-party requests failed');
    report.status = 'PASS_BOOT_WORLD_SAVELOAD';
    stage('completed', { status: report.status, consoleErrorCount: report.consoleErrors.length });
  } catch (error) {
    report.status = 'FAIL';
    report.pageErrors.push(String(error));
    console.error('[browser-world-smoke] ' + String(error));
    process.exitCode = 1;
  } finally {
    writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    await browser.close();
  }
}

main().catch(err => {
  report.status = 'FAIL';
  report.pageErrors.push(String(err));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.error(err);
  process.exitCode = 1;
});
