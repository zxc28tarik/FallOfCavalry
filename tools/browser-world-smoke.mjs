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
      const escortHud = document.getElementById('questEscortHud');
      const hudVisibleWhileWaiting = escortHud?.style.display === 'block'
        && document.getElementById('questEscortStatus')?.textContent
          .includes('Kervan başlangıçta seni bekliyor');
      document.getElementById('questEscortNavigate')?.click();
      const hudNavigationWorks = g.playerParty.hasDestination === true
        && g.playerParty.destX === party.x && g.playerParty.destY === party.y;
      g.playerParty.hasDestination = false;
      g.playerParty.destX = null;
      g.playerParty.destY = null;
      // V1.24: real DOM activation of dynamic escort following. The player's
      // coordinates are moved ONLY by WorldSimManager.updatePlayerParty,
      // not by the test, during the measured movement interval.
      const tile = Number(g.state.map.tileSize || 32);
      const roadNearOrigin = [
        { x: original.x - tile * 2, y: original.y },
        { x: original.x + tile * 2, y: original.y },
        { x: original.x, y: original.y - tile * 2 },
        { x: original.x, y: original.y + tile * 2 },
      ].find(c => c.x > 0 && c.y > 0
        && !g.worldManager.getMovementContextAt(c.x, c.y).blocked);
      let nativeMove = false;
      let followPressed = false;
      let manualOverride = false;
      if (roadNearOrigin) {
        g.playerParty.x = roadNearOrigin.x;
        g.playerParty.y = roadNearOrigin.y;
        const beforeMove = { x: g.playerParty.x, y: g.playerParty.y };
        document.getElementById('questEscortFollow')?.click();
        followPressed = g.questEscortHud.followId === party.id
          && document.getElementById('questEscortFollow')?.textContent === 'Takibi durdur';
        for (let i = 0; i < 35; i++) {
          g.worldManager.simManager.updatePlayerParty(0.15);
        }
        nativeMove = Math.hypot(g.playerParty.x - beforeMove.x,
          g.playerParty.y - beforeMove.y) > 1;
        // A manual new click-to-move destination takes priority.
        const overrideX = g.playerParty.x + tile * 4;
        const overrideY = g.playerParty.y + tile * 2;
        g.playerParty.destX = overrideX;
        g.playerParty.destY = overrideY;
        g.playerParty.hasDestination = true;
        g.questEscortHud.refreshFollowTarget();
        manualOverride = g.questEscortHud.followId == null
          && g.playerParty.destX === overrideX
          && g.playerParty.destY === overrideY;
      }
      g.playerParty.hasDestination = false;
      g.playerParty.destX = null;
      g.playerParty.destY = null;
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
        hudVisibleWhileWaiting, hudNavigationWorks,
        followPressed, nativeMove, manualOverride,
        hudHidesAfterArrival: document.getElementById('questEscortHud')?.style.display === 'none',
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
      || !caravanEscort.waitsForPlayer || !caravanEscort.hudVisibleWhileWaiting
      || !caravanEscort.hudNavigationWorks || !caravanEscort.hudHidesAfterArrival
      || !caravanEscort.followPressed || !caravanEscort.nativeMove
      || !caravanEscort.manualOverride
      || !caravanEscort.realArrival
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

    // V1.25: follow a LONGER genuine generated road at the normal convoy
    // speed, using the real player movement simulation for EVERY tick.
    // Only the test setup positions the player at the source town.
    const naturalLongEscort = await page.evaluate(() => {
      const g = window.game;
      const map = g.state.map;
      const tileSize = Number(map.tileSize || 32);
      const routes = g.economyManager.ensureTradeRoutes().filter(r => r.roadBacked);
      const busy = new Set(g.questManager.activeQuests.map(q => q.targetRouteId));
      const roads = map.roads || [];
      const passable = p => g.worldManager.getMovementContextAt(
        (p.x + 0.5) * tileSize, (p.y + 0.5) * tileSize,
      )?.blocked !== true;
      const candidates = routes.map(route => {
        const road = roads.find(x => String(x.from) === String(route.fromCityId)
          && String(x.to) === String(route.toCityId));
        const pts = road?.path || [];
        const length = pts.slice(1).reduce((n,p,i) =>
          n + Math.hypot(p.x - pts[i].x,p.y - pts[i].y),0);
        return {route,road,pts,length};
      }).filter(x => x.pts.length >= 31 && x.length >= 30 && x.length <= 65
        && !busy.has(x.route.id)
        && !g.worldManager.worldAi.parties.some(p => p.kind === 'bandit'
          && p.routeId === x.route.id && p.alive !== false)
        && x.pts.every(passable))
        .sort((a,b) => a.length-b.length);
      const target = candidates[0];
      if (!target) return {ready:false,reason:'no_walkable_long_generated_road',
        candidates:routes.length};
      const quest = g.questGenerator.generateFromTemplate('escort_first_caravan',{
        targetRouteId:target.route.id,issuerFactionId:'ottoman',
      });
      if (!quest) return {ready:false,reason:'no_long_escort_quest'};
      quest.status='active';
      if (!g.questManager.addQuest(quest)) return {ready:false,reason:'quest_not_added'};
      const pm = g.worldManager.simManager.worldPartyManager;
      pm.ensureWorldParties();
      const caravan = g.worldManager.worldAi.parties.find(p =>
        p.escortQuestId === quest.id && p.routeId === target.route.id);
      if (!caravan) return {ready:false,reason:'no_live_long_caravan'};
      // Initialization only: player joins the actual source settlement.
      g.playerParty.x=caravan.x;
      g.playerParty.y=caravan.y;
      g.playerParty.hasDestination=false;
      g.playerParty.destX=null;
      g.playerParty.destY=null;
      g.playerParty.moveState='idle';
      const speed = caravan.speed;
      const startX=g.playerParty.x, startY=g.playerParty.y;
      pm.processQuestEscortCaravans(0.05,{worldState:map,tradeRoutes:routes});
      const followButton = document.getElementById('questEscortFollow');
      followButton?.click();
      const optedIn = g.questEscortHud?.followId === caravan.id;
      let maxPlayerStep=0, totalPlayerMove=0, maxSeparation=0;
      let realBlocked=false, ticks=0;
      const dt=0.15;
      for (; ticks<620 && quest.objectives[0].outcome==null
          && quest.status==='active'; ticks++) {
        const x=g.playerParty.x,y=g.playerParty.y;
        g.worldManager.simManager.updatePlayerParty(dt);
        const move=Math.hypot(g.playerParty.x-x,g.playerParty.y-y);
        maxPlayerStep=Math.max(maxPlayerStep,move);
        totalPlayerMove+=move;
        if (g.playerParty.moveState==='blocked') realBlocked=true;
        pm.processQuestEscortCaravans(dt,{worldState:map,tradeRoutes:routes});
        maxSeparation=Math.max(maxSeparation,Math.hypot(
          g.playerParty.x-caravan.x,g.playerParty.y-caravan.y));
      }
      const distanceFromStart=Math.hypot(g.playerParty.x-startX,
        g.playerParty.y-startY);
      const confirmed = g.state.questEventLedger?.observed?.some(e =>
        e.source==='caravan_arrival' && e.questId===quest.id
          && e.routeId===target.route.id);
      const root=document.getElementById('questCompletionOverlay');
      const ready=[...(root?.querySelectorAll('.quest-path')||[])].some(b =>
        !b.disabled && b.textContent.includes('Kervan güvenli ulaştı'));
      return {ready:true,routeId:target.route.id,lengthTiles:target.length,
        points:target.pts.length,travelSpeed:speed,ticks,optedIn,
        distanceFromStart,totalPlayerMove,maxPlayerStep,maxSeparation,
        realBlocked,completion:quest.objectives[0].outcome,
        caravanArrived:caravan.escortArrived===true,credited:Boolean(confirmed),
        completionVisible:ready,followStillEnabled:g.questEscortHud?.followId===caravan.id,
        questId:quest.id,goldBeforeChoice:g.playerParty.gold};
    });
    report.naturalLongEscort = naturalLongEscort;
    stage('native-movement-long-road-convoy-follow',naturalLongEscort);
    if (!naturalLongEscort.ready || !naturalLongEscort.optedIn
      || naturalLongEscort.lengthTiles < 30 || naturalLongEscort.points < 31
      || naturalLongEscort.distanceFromStart < 100
      || naturalLongEscort.totalPlayerMove < 100
      || naturalLongEscort.maxPlayerStep > 90
      || naturalLongEscort.realBlocked || naturalLongEscort.maxSeparation > 180
      || !naturalLongEscort.caravanArrived
      || naturalLongEscort.completion !== 'caravan_arrived'
      || !naturalLongEscort.credited || !naturalLongEscort.completionVisible) {
      throw new Error('Native-speed long-road follow did not escort actual convoy to destination');
    }
    await page.locator('#questCompletionOverlay button.quest-path:not([disabled])')
      .filter({hasText:'Kervan güvenli ulaştı'}).click();
    const longEscortReward = await page.evaluate(({id,gold})=>{
      const g=window.game;
      const done=g.questManager.completedQuests.filter(q=>q.id===id);
      const once=g.playerParty.gold - gold === 250;
      const replay=g.questManager.completeQuest(id,'caravan_delivered') !== true;
      const saved=g.saveManager.quickSave()===true;
      const loaded=saved && g.saveManager.quickLoad()===true;
      return {once,replay,saved,loaded,archived:g.questManager.completedQuests
        .filter(q=>q.id===id && q.archived).length===1};
    },{id:naturalLongEscort.questId,gold:naturalLongEscort.goldBeforeChoice});
    report.longEscortReward=longEscortReward;
    stage('native-long-road-delivery-250g-once',longEscortReward);
    if(!longEscortReward.once || !longEscortReward.replay || !longEscortReward.saved
      || !longEscortReward.loaded || !longEscortReward.archived){
      throw new Error('Long-road delivery reward did not remain unique');
    }

    // V1.24 — genuine tactical victory over a factory-created bandit
    // threatening a real quest caravan. Do not call resolveBattle('victory')
    // or assign HP/outcomes; advance the full tactical engine.
    const guardedCombat = await page.evaluate(async () => {
      const g = window.game;
      const routes = g.economyManager.ensureTradeRoutes()
        .filter(r => r.roadBacked === true);
      const roads = g.state.map.roads || [];
      const candidates = routes.map(route => {
        const road = roads.find(r => String(r.from) === String(route.fromCityId)
          && String(r.to) === String(route.toCityId));
        const pts = road?.path || [];
        const length = pts.slice(1).reduce((n, p, i) =>
          n + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
        return { route, length };
      }).filter(x => x.length > 0 && x.length <= 4)
        .sort((a,b) => a.length - b.length);
      const target = candidates.find(x =>
        !g.questManager.activeQuests.some(q => q.targetRouteId === x.route.id)
        && !g.worldManager.worldAi.parties.some(p => p.alive !== false
          && p.kind === 'bandit' && p.routeId === x.route.id));
      if (!target) return { ready: false, reason: 'no_short_road_to_guard' };
      const quest = g.questGenerator.generateFromTemplate('escort_first_caravan', {
        targetRouteId: target.route.id, issuerFactionId: 'ottoman',
      });
      if (!quest) return { ready: false, reason: 'no_guard_quest' };
      quest.status = 'active';
      if (!g.questManager.addQuest(quest))
        return { ready: false, reason: 'guard_quest_not_accepted' };
      const manager = g.worldManager.simManager.worldPartyManager;
      manager.ensureWorldParties();
      const convoy = g.worldManager.worldAi.parties.find(p =>
        p.escortQuestId === quest.id && p.routeId === target.route.id);
      if (!convoy) return { ready: false, reason: 'guarded_caravan_not_spawned' };
      // Production bundle hashes module names, so no runtime import.
      // Ask the game's real security-quest AI source to create a bandit.
      // Remove the disposable test security contract afterward, before
      // combat; only the genuine runtime-born world party is retained.
      const security = g.questGenerator.generateFromTemplate('secure_trade_route', {
        targetCityId: target.route.fromCityId,
        targetRouteId: target.route.id, issuerFactionId: 'ottoman',
      });
      if (!security) return { ready: false, reason: 'security_template_missing' };
      security.status = 'active';
      if (!g.questManager.addQuest(security))
        return { ready: false, reason: 'security_source_not_accepted' };
      const existingIds = new Set(g.worldManager.worldAi.parties.map(p => p.id));
      manager.ensureActiveQuestRouteThreats({
        worldState: g.state.map, tradeRoutes: routes,
        cfg: manager.getWorldAiCfg(),
      });
      const bandit = g.worldManager.worldAi.parties.find(p =>
        !existingIds.has(p.id) && p.routeId === target.route.id
        && p.kind === 'bandit' && p.factionId === 'bandits');
      g.questManager.activeQuests = g.questManager.activeQuests
        .filter(q => q.id !== security.id);
      if (!bandit)
        return { ready: false, reason: 'real_factory_bandit_not_spawned' };
      bandit.x = convoy.x + Number(g.state.map.tileSize || 32);
      bandit.y = convoy.y;
      g.playerParty.x = convoy.x;
      g.playerParty.y = convoy.y;
      const status = manager.processQuestEscortCaravans(0.1, {
        worldState: g.state.map, tradeRoutes: routes,
      });
      const pausesAtThreat = convoy.escortStarted === true
        && convoy.escortElapsedSeconds === 0
        && convoy.escortVisitedPoints === 0;
      manager.syncVisiblePartiesToWorld();
      const encountered = g.worldManager.simManager.processWorldAiEncounters([{
        partyId: bandit.id, factionId: bandit.factionId,
        x: bandit.x, y: bandit.y,
      }]);
      const sourceEnemyId = g.state.encounter?.enemyId;
      const expectedEnemyId = `wai-${bandit.id}`;
      if (!encountered || sourceEnemyId !== expectedEnemyId)
        return { ready: false, reason: 'guard_enemy_source_not_encountered' };
      g.playerParty.roster = Array.from({ length: 6 }, (_, i) => ({
        id: `qa-guard-v124-${i}`, name: `QA Guard ${i+1}`,
        class: 'infantry', hp: 4500, maxHp: 4500,
        atk: 3500, def: 500, speed: 1100, meleeRange: 240,
        isRanged: false, status: 'healthy', healProgress: 0,
      }));
      const fight = g.encounterManager.resolveEncounter('fight') === true;
      const selected = fight && g.battleManager.confirmRosterSelection() === true;
      const deployed = selected && g.battleManager.confirmBattleDeployment() === true;
      const initialHp = (g.state.battle?.enemyUnits || [])
        .reduce((sum,e)=>sum + e.hp,0);
      let ticks = 0;
      for (; ticks < 350 && g.state.battle?.phase === 'active'; ticks++) {
        g.battleManager.updateBattleSimulation(0.12);
      }
      const currentHp = (g.state.battle?.enemyUnits || [])
        .reduce((sum,e)=>sum + Math.max(0,e.hp),0);
      return {
        ready: true, questId: quest.id, routeId: target.route.id,
        convoyId: convoy.id, banditId: bandit.id, expectedEnemyId,
        pausesAtThreat, fight, selected, deployed, ticks,
        enemyHpBefore: initialHp, enemyHpAfter: currentHp,
        genuineDamage: initialHp > currentHp,
        result: g.state.battle?.battleResult?.result,
        panelResult: g.state.battle?.phase === 'result',
      };
    });
    report.guardedCombat = guardedCombat;
    stage('real-engine-guarded-caravan-bandit-battle', guardedCombat);
    if (!guardedCombat.ready || !guardedCombat.pausesAtThreat
      || !guardedCombat.fight || !guardedCombat.selected || !guardedCombat.deployed
      || guardedCombat.enemyHpBefore <= 0 || !guardedCombat.genuineDamage
      || guardedCombat.result !== 'victory' || !guardedCombat.panelResult) {
      throw new Error('Guard battle did not run genuine tactical victory over nearby road bandit');
    }
    await page.keyboard.press('Enter');
    const defendedCaravan = await page.evaluate(({ questId, convoyId, banditId }) => {
      const g = window.game;
      const party = g.worldManager.worldAi.parties.find(p => p.id === convoyId);
      const quest = g.questManager.activeQuests.find(q => q.id === questId);
      const banditRemoved = !g.worldManager.worldAi.parties.some(p => p.id === banditId);
      const defendedOnce = party?.escortDefended === 1;
      const noAutomaticEscortReward = quest?.objectives?.[0]?.outcome == null
        && !g.questManager.completedQuests.some(q => q.id === questId);
      const pm = g.worldManager.simManager.worldPartyManager;
      const before = Number(party?.escortElapsedSeconds ?? 0);
      g.playerParty.x = party?.x ?? g.playerParty.x;
      g.playerParty.y = party?.y ?? g.playerParty.y;
      pm.updateWorldParties(0.1);
      const resumed = Number(party?.escortElapsedSeconds ?? 0) > before;
      const goldBeforeDelivery = g.playerParty.gold;
      let ticks = 0;
      for (; ticks < 250 && quest?.objectives?.[0]?.outcome == null; ticks++) {
        g.playerParty.x = party.x;
        g.playerParty.y = party.y;
        pm.updateWorldParties(0.15);
      }
      const overlay = document.getElementById('questCompletionOverlay');
      const button = [...(overlay?.querySelectorAll('button.quest-path') || [])]
        .find(b => !b.disabled && b.textContent.includes('Kervan güvenli ulaştı'));
      return {
        activeBeforeChoice: Boolean(quest),
        banditRemoved, defendedOnce, noAutomaticEscortReward, resumed,
        routeArrival: quest?.objectives?.[0]?.outcome === 'caravan_arrived',
        offerVisible: Boolean(button && overlay?.style.display !== 'none'
          && !overlay.classList.contains('hidden')),
        ticks, goldBeforeDelivery,
      };
    }, guardedCombat);
    report.defendedCaravan = defendedCaravan;
    stage('guard-victory-clears-threat-and-escort-resumes', defendedCaravan);
    if (!defendedCaravan.activeBeforeChoice || !defendedCaravan.banditRemoved
      || !defendedCaravan.defendedOnce || !defendedCaravan.noAutomaticEscortReward
      || !defendedCaravan.resumed || !defendedCaravan.routeArrival
      || !defendedCaravan.offerVisible) {
      throw new Error('Real guard victory failed to clear the same-route caravan threat');
    }
    await page.locator('#questCompletionOverlay button.quest-path:not([disabled])')
      .filter({ hasText: 'Kervan güvenli ulaştı' }).click();
    const guardedPayout = await page.evaluate(({ id, gold }) => {
      const g = window.game;
      const completed = g.questManager.completedQuests.find(q => q.id === id);
      const exact = g.playerParty.gold - gold === 250;
      const replayDenied = g.questManager.completeQuest(id, 'caravan_delivered') !== true;
      const saved = g.saveManager.quickSave() === true;
      const loaded = saved && g.saveManager.quickLoad() === true;
      return { path: completed?.completedPath, exact, replayDenied,
        saved, loaded, archiveOnce: g.questManager.completedQuests
          .filter(q => q.id === id && q.archived).length === 1 };
    }, { id: guardedCombat.questId, gold: defendedCaravan.goldBeforeDelivery });
    report.guardedPayout = guardedPayout;
    stage('guarded-escort-delivery-one-time-reward', guardedPayout);
    if (guardedPayout.path !== 'caravan_delivered' || !guardedPayout.exact
      || !guardedPayout.replayDenied || !guardedPayout.saved
      || !guardedPayout.loaded || !guardedPayout.archiveOnce) {
      throw new Error('Guarded escort completion did not preserve canonical single payout');
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

    // V1.23 — a true generated-bandit sighting/encounter must identify a
    // MISSING caravan on the EXACT registered road. This is independent from
    // bandit combat victories and imported ledger claims.
    const missingCaravanRecon = await page.evaluate(() => {
      const g = window.game;
      if (g.state.mode !== 'map') return { ready: false, reason: 'not_on_map' };
      const roadRoutes = g.economyManager.ensureTradeRoutes().filter(r => r.roadBacked);
      const busy = new Set(g.questManager.activeQuests.map(q => q.targetRouteId));
      const route = roadRoutes.find(r => !busy.has(r.id));
      if (!route) return { ready: false, reason: 'no_free_route' };
      const quest = g.questGenerator.generateFromTemplate('investigate_missing_caravan', {
        targetRouteId: route.id, issuerFactionId: 'ottoman',
      });
      if (!quest) return { ready: false, reason: 'missing_caravan_template_failed' };
      quest.status = 'active';
      const added = g.questManager.addQuest(quest);
      const pm = g.worldManager.simManager.worldPartyManager;
      const before = new Set(g.worldManager.worldAi.parties.map(p => p.id));
      pm.ensureWorldParties();
      const bandit = g.worldManager.worldAi.parties.find(p =>
        !before.has(p.id) && p.routeId === route.id && p.kind === 'bandit');
      if (!bandit) return { ready: false, reason: 'no_runtime_route_bandit' };
      g.playerParty.x = bandit.x;
      g.playerParty.y = bandit.y;
      const enemyId = `wai-${bandit.id}`;
      const encountered = g.worldManager.simManager.processWorldAiEncounters([{
        partyId: bandit.id, factionId: bandit.factionId,
        x: bandit.x, y: bandit.y,
      }]);
      const evidence = g.state.questEventLedger?.observed?.find(e =>
        e.source === 'route_recon' && e.questId === quest.id
        && e.routeId === route.id && e.enemyId === bandit.id);
      const objective = quest.objectives?.[0]?.outcome;
      const fled = g.encounterManager.resolveEncounter('flee') === true;
      const root = document.getElementById('questCompletionOverlay');
      const option = [...(root?.querySelectorAll('button.quest-path') || [])].find(b =>
        b.textContent.includes('Haydut grubunu tespit ettim') && !b.disabled);
      return {
        ready: true, added, enemyId, encountered, fled,
        sameEncounter: evidence?.enemyId === bandit.id
          && evidence?.result === 'bandits_located',
        source: evidence?.source, objective,
        mode: g.state.mode, questId: quest.id, routeId: route.id,
        overlayVisible: Boolean(option && !root?.classList.contains('hidden')),
        goldBeforeChoice: g.playerParty.gold,
        noAutoReward: !g.questManager.completedQuests.some(q => q.id === quest.id),
      };
    });
    report.missingCaravanRecon = missingCaravanRecon;
    stage('real-missing-caravan-route-bandit-recon', missingCaravanRecon);
    if (!missingCaravanRecon.ready || !missingCaravanRecon.added
      || !missingCaravanRecon.encountered || !missingCaravanRecon.fled
      || !missingCaravanRecon.sameEncounter || missingCaravanRecon.source !== 'route_recon'
      || missingCaravanRecon.objective !== 'bandits_located'
      || !missingCaravanRecon.noAutoReward || !missingCaravanRecon.overlayVisible
      || missingCaravanRecon.mode !== 'map') {
      throw new Error('Missing caravan investigation lacks real route-bandit encounter proof');
    }
    const reconSameSession = await page.evaluate(({ id, gold }) => {
      const g = window.game;
      const saved = g.saveManager.quickSave() === true;
      const loaded = saved && g.saveManager.quickLoad() === true;
      const q = g.questManager.activeQuests.find(q => q.id === id);
      const root = document.getElementById('questCompletionOverlay');
      const ready = [...(root?.querySelectorAll('button.quest-path') || [])].some(b =>
        !b.disabled && b.textContent.includes('Haydut grubunu tespit ettim'));
      return {
        saved, loaded, active: q?.status === 'active',
        outcome: q?.objectives?.[0]?.outcome,
        witnessedInSession: g.state.questRestoreReport?.sessionVerified >= 1,
        savedEventsNotCredited: g.state.questRestoreReport?.creditedEvents === 0,
        noAutomaticReward: g.playerParty.gold === gold,
        optionRestored: Boolean(ready && !root?.classList.contains('hidden')),
      };
    }, { id: missingCaravanRecon.questId, gold: missingCaravanRecon.goldBeforeChoice });
    report.reconSameSession = reconSameSession;
    stage('same-session-missing-caravan-recon-save-resume', reconSameSession);
    if (!reconSameSession.saved || !reconSameSession.loaded || !reconSameSession.active
      || reconSameSession.outcome !== 'bandits_located'
      || !reconSameSession.witnessedInSession || !reconSameSession.savedEventsNotCredited
      || !reconSameSession.noAutomaticReward || !reconSameSession.optionRestored) {
      throw new Error('Live missing-caravan observation did not survive same-session save safely');
    }
    await page.locator('#questCompletionOverlay button.quest-path:not([disabled])')
      .filter({ hasText: 'Haydut grubunu tespit ettim' }).click();
    const missingCaravanReward = await page.evaluate(({ id, gold }) => {
      const g = window.game;
      const done = g.questManager.completedQuests.filter(q => q.id === id);
      const reward = g.playerParty.gold - gold;
      const repeatRejected = g.questManager.completeQuest(id, 'bandits_identified') !== true;
      const saved = g.saveManager.quickSave() === true;
      const loaded = saved && g.saveManager.quickLoad() === true;
      return {
        completedOnce: done.length === 1,
        path: done[0]?.completedPath,
        reward, repeatRejected, saved, loaded,
        archivedOnce: g.questManager.completedQuests
          .filter(q => q.id === id && q.archived === true).length === 1,
        noReplay: g.playerParty.gold === gold + 100,
        noActiveReplay: !g.questManager.activeQuests.some(q => q.id === id),
        inertLedger: g.state.questEventLedger?.observed?.length === 0,
      };
    }, { id: missingCaravanRecon.questId, gold: missingCaravanRecon.goldBeforeChoice });
    report.missingCaravanReward = missingCaravanReward;
    stage('verified-missing-caravan-100-gold-no-replay', missingCaravanReward);
    if (!missingCaravanReward.completedOnce || missingCaravanReward.path !== 'bandits_identified'
      || missingCaravanReward.reward !== 100 || !missingCaravanReward.repeatRejected
      || !missingCaravanReward.saved || !missingCaravanReward.loaded
      || !missingCaravanReward.archivedOnce || !missingCaravanReward.noReplay
      || !missingCaravanReward.noActiveReplay || !missingCaravanReward.inertLedger) {
      throw new Error('Missing caravan reward archive or save replay validation failed');
    }

    // V1.26 — real WorldAI-only skirmish: independent visible guards
    // defend a genuine escort against a factory-spawned route bandit.
    // This does NOT invoke tactical BattleManager or set battle result/HP.
    const npcGuardSkirmish = await page.evaluate(() => {
      const g = window.game;
      const pm = g.worldManager.simManager.worldPartyManager;
      const routes = g.economyManager.ensureTradeRoutes().filter(r => r.roadBacked);
      const occupied = new Set(g.questManager.activeQuests.map(q => q.targetRouteId));
      const entry = routes.find(r => !occupied.has(r.id)
        && !g.worldManager.worldAi.parties.some(p => p.alive !== false
          && p.kind === 'bandit' && p.routeId === r.id));
      if (!entry) return { ready:false,reason:'no_escort_guard_route' };
      const quest = g.questGenerator.generateFromTemplate('escort_first_caravan', {
        targetRouteId:entry.id, issuerFactionId:'ottoman',
      });
      if(!quest)return {ready:false,reason:'no_escort_guard_template'};
      quest.status='active';
      if(!g.questManager.addQuest(quest))return {ready:false,reason:'guard_quest_not_added'};
      pm.ensureWorldParties();
      const convoy=g.worldManager.worldAi.parties.find(p=>
        p.kind==='caravan' && p.escortQuestId===quest.id && p.routeId===entry.id);
      if(!convoy)return {ready:false,reason:'guard_convoy_not_spawned'};
      const guards=g.worldManager.worldAi.parties.filter(p=>
        p.kind==='escort_guard' && p.escortGuardOf===convoy.id && p.alive!==false);
      if(guards.length!==3)return {ready:false,reason:'no_live_world_guards',guards:guards.length};
      const sec=g.questGenerator.generateFromTemplate('secure_trade_route',{
        targetRouteId:entry.id,targetCityId:entry.fromCityId,issuerFactionId:'ottoman',
      });
      if(!sec)return {ready:false,reason:'no_security_source'};
      sec.status='active';
      if(!g.questManager.addQuest(sec))return {ready:false,reason:'security_not_added'};
      const old=new Set(g.worldManager.worldAi.parties.map(p=>p.id));
      pm.ensureActiveQuestRouteThreats({
        worldState:g.state.map,tradeRoutes:routes,cfg:pm.getWorldAiCfg(),
      });
      const bandit=g.worldManager.worldAi.parties.find(p=>
        !old.has(p.id) && p.routeId===entry.id && p.kind==='bandit');
      g.questManager.activeQuests=g.questManager.activeQuests.filter(q=>q.id!==sec.id);
      if(!bandit)return {ready:false,reason:'source_bandit_not_spawned'};
      bandit.x=convoy.x+Number(g.state.map.tileSize||32);
      bandit.y=convoy.y;
      g.playerParty.x=convoy.x;
      g.playerParty.y=convoy.y;
      const goldBefore=g.playerParty.gold;
      let ticks=0;
      let damageWitnessed=false;
      for(;ticks<90 && bandit.alive!==false;ticks++){
        pm.processQuestEscortCaravans(0.2,{
          worldState:g.state.map,tradeRoutes:routes,
        });
        damageWitnessed ||= convoy.escortCargo<100 || guards.some(x=>x.hp<30);
      }
      const noEarlyReward = g.playerParty.gold===goldBefore
        && quest.objectives[0].outcome==null
        && !g.questManager.completedQuests.some(q=>q.id===quest.id);
      const banditDefeated=bandit.alive===false;
      const defendedOnce=convoy.escortDefended===1;
      const remainingGuards=guards.filter(x=>x.alive!==false && x.hp>0).length;
      const hud=document.getElementById('questEscortStatus')?.textContent||'';
      const hudHasStats=hud.includes('Muhafız:') && hud.includes('Yük:');
      // Now proceed using the genuine arrival system — no minted event.
      convoy.speed=18; // test-only fast arrival after the independent skirmish
      let deliveryTicks=0;
      for(;deliveryTicks<320 && quest.objectives[0].outcome==null;deliveryTicks++){
        g.playerParty.x=convoy.x;g.playerParty.y=convoy.y;
        pm.processQuestEscortCaravans(0.15,{
          worldState:g.state.map,tradeRoutes:routes,
        });
      }
      const root=document.getElementById('questCompletionOverlay');
      const visible=[...(root?.querySelectorAll('button.quest-path')||[])]
        .some(x=>!x.disabled && x.textContent.includes('Kervan güvenli ulaştı'));
      return {ready:true,routeId:entry.id,questId:quest.id,ticks,deliveryTicks,
        banditDefeated,defendedOnce,remainingGuards,
        damageWitnessed,cargo:convoy.escortCargo,hull:convoy.escortHull,
        hudHasStats,noEarlyReward,arrival:quest.objectives[0].outcome,
        offerVisible:visible,goldBeforeClick:g.playerParty.gold};
    });
    report.npcGuardSkirmish=npcGuardSkirmish;
    stage('live-world-ai-escort-guards-defend-convoy',npcGuardSkirmish);
    if(!npcGuardSkirmish.ready || !npcGuardSkirmish.banditDefeated
      || !npcGuardSkirmish.defendedOnce || !npcGuardSkirmish.damageWitnessed
      || npcGuardSkirmish.remainingGuards<1
      || npcGuardSkirmish.cargo>=100 || npcGuardSkirmish.cargo<=0
      || !npcGuardSkirmish.hudHasStats || !npcGuardSkirmish.noEarlyReward
      || npcGuardSkirmish.arrival!=='caravan_arrived'
      || !npcGuardSkirmish.offerVisible){
      throw new Error('Authentic NPC convoy guard win did not protect cargo and allow real delivery');
    }
    await page.locator('#questCompletionOverlay button.quest-path:not([disabled])')
      .filter({hasText:'Kervan güvenli ulaştı'}).click();
    const npcEscortReward=await page.evaluate(({id,gold})=>{
      const g=window.game;
      const completed=g.questManager.completedQuests.filter(q=>q.id===id);
      const once=g.playerParty.gold-gold===250;
      const replay=g.questManager.completeQuest(id,'caravan_delivered')!==true;
      const saved=g.saveManager.quickSave()===true;
      const payload=g.saveManager.buildSavePayload();
      const guardSaveAbsent=!payload.game.worldAi.parties.some(p=>
        String(p.id).startsWith('quest-escort-guard-') || p.escortQuestId);
      const loaded=saved && g.saveManager.quickLoad()===true;
      return {once,replay,saved,guardSaveAbsent,loaded,archive:
        completed.length===1 && g.questManager.completedQuests
          .filter(q=>q.id===id && q.archived).length===1};
    },{id:npcGuardSkirmish.questId,gold:npcGuardSkirmish.goldBeforeClick});
    report.npcEscortReward=npcEscortReward;
    stage('npc-guarded-cargo-delivery-250g-once',npcEscortReward);
    if(!npcEscortReward.once || !npcEscortReward.replay
      || !npcEscortReward.saved || !npcEscortReward.loaded
      || !npcEscortReward.archive || !npcEscortReward.guardSaveAbsent){
      throw new Error('NPC guarded caravan created duplicate or saved fake reward');
    }

    const npcRaidLoss=await page.evaluate(()=>{
      const g=window.game;
      const pm=g.worldManager.simManager.worldPartyManager;
      const routes=g.economyManager.ensureTradeRoutes().filter(r=>r.roadBacked);
      const occupied=new Set(g.questManager.activeQuests.map(q=>q.targetRouteId));
      const route=routes.find(r=>!occupied.has(r.id)
        && !g.worldManager.worldAi.parties.some(p=>p.alive!==false
          && p.kind==='bandit' && p.routeId===r.id));
      if(!route)return {ready:false,reason:'no_raid_loss_route'};
      const q=g.questGenerator.generateFromTemplate('escort_first_caravan',{
        targetRouteId:route.id,issuerFactionId:'ottoman',
      });
      if(!q)return {ready:false,reason:'no_raid_loss_template'};
      q.status='active';
      if(!g.questManager.addQuest(q))return {ready:false,reason:'raid_loss_quest_add'};
      pm.ensureWorldParties();
      const caravan=g.worldManager.worldAi.parties.find(p=>
        p.kind==='caravan' && p.escortQuestId===q.id);
      if(!caravan)return {ready:false,reason:'no_raid_loss_caravan'};
      const guards=g.worldManager.worldAi.parties.filter(p=>
        p.kind==='escort_guard' && p.escortGuardOf===caravan.id);
      const sec=g.questGenerator.generateFromTemplate('secure_trade_route',{
        targetRouteId:route.id,targetCityId:route.fromCityId,issuerFactionId:'ottoman',
      });
      if(!sec)return {ready:false,reason:'no_raid_bandit_source'};
      sec.status='active';
      if(!g.questManager.addQuest(sec))return {ready:false,reason:'raid_source_not_added'};
      const existing=new Set(g.worldManager.worldAi.parties.map(p=>p.id));
      pm.ensureActiveQuestRouteThreats({
        worldState:g.state.map,tradeRoutes:routes,cfg:pm.getWorldAiCfg(),
      });
      const bandit=g.worldManager.worldAi.parties.find(p=>
        !existing.has(p.id) && p.routeId===route.id && p.kind==='bandit');
      g.questManager.activeQuests=g.questManager.activeQuests.filter(q=>q.id!==sec.id);
      if(!bandit)return {ready:false,reason:'raid_loss_bandit_missing'};
      const routeDamage=Number(route.damage||0);
      const originalGold=g.playerParty.gold;
      // Deterministic QA weak-convoy fixture: the fight and damage are still
      // calculated by actual runEscortNpcSkirmish ticks, never set to 'failed'.
      guards.forEach(x=>{x.hp=0;x.alive=false;});
      caravan.escortCargo=24;
      caravan.escortHull=24;
      bandit.x=caravan.x+Number(g.state.map.tileSize||32);
      bandit.y=caravan.y;
      g.playerParty.x=caravan.x;g.playerParty.y=caravan.y;
      let ticks=0;
      for(;ticks<32 && q.status==='active';ticks++){
        pm.processQuestEscortCaravans(0.2,{
          worldState:g.state.map,tradeRoutes:routes,
        });
      }
      const failed=g.questManager.failedQuests.filter(x=>x.id===q.id);
      const penalty=Number(route.damage||0)-routeDamage;
      const alive=g.worldManager.worldAi.parties.some(x=>
        x.id===bandit.id && x.alive!==false);
      const noReward=g.playerParty.gold===originalGold
        && !g.questManager.completedQuests.some(x=>x.id===q.id);
      const saved=g.saveManager.quickSave()===true;
      const loaded=saved && g.saveManager.quickLoad()===true;
      const archived=g.questManager.failedQuests.filter(x=>
        x.id===q.id && x.failReason==='escort_cargo_raided' && x.archived).length===1;
      const exactAfter=Number(g.economyManager.ensureTradeRoutes()
        .find(x=>x.id===route.id)?.damage||0)-routeDamage===2;
      return {ready:true,ticks,failReason:failed[0]?.failReason,
        failedOnce:failed.length===1,penalty,alive,noReward,saved,loaded,
        archived,exactAfter,cargo:caravan.escortCargo,hull:caravan.escortHull};
    });
    report.npcRaidLoss=npcRaidLoss;
    stage('live-world-ai-cargo-raid-fails-escort-once',npcRaidLoss);
    if(!npcRaidLoss.ready || !npcRaidLoss.failedOnce
      || npcRaidLoss.failReason!=='escort_cargo_raided'
      || npcRaidLoss.penalty!==2 || !npcRaidLoss.alive
      || !npcRaidLoss.noReward || !npcRaidLoss.saved || !npcRaidLoss.loaded
      || !npcRaidLoss.archived || !npcRaidLoss.exactAfter){
      throw new Error('Autonomous NPC bandit raid did not produce genuine one-time loss');
    }

    // V1.24 — loss branch: a defenseless QA soldier is defeated by the
    // game's actual battle simulation. A real guard loss fails the original
    // escort objective, applies its canonical route-damage effect ONCE,
    // and must NOT magically delete the victorious world bandit.
    const guardDefeatCombat = await page.evaluate(() => {
      const g = window.game;
      // Earlier smoke scenarios leave living bandits in the real world.
      // Normal background play can start an ambient encounter between QA
      // stages. Exit it via the GAME'S actual flee option, not by forging
      // state.mode/encounter, before entering this independent guard fight.
      const ambientEnemyId = g.state.encounter?.enemyId ?? null;
      const escapedAmbient = g.state.mode === 'encounter' && ambientEnemyId
        ? g.encounterManager.resolveEncounter('flee') === true : false;
      if (g.state.mode !== 'map' || g.state.encounter) {
        return { ready: false, reason: 'cannot_exit_ambient_encounter',
          mode: g.state.mode, ambientEnemyId, escapedAmbient };
      }
      const routeRows = g.economyManager.ensureTradeRoutes().filter(r => r.roadBacked);
      const roads = g.state.map.roads || [];
      const eligible = routeRows.map(route => {
        const road = roads.find(r => String(r.from) === String(route.fromCityId)
          && String(r.to) === String(route.toCityId));
        const points = road?.path || [];
        const length = points.slice(1).reduce((n,p,i) =>
          n + Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
        return { route, length };
      }).filter(x => x.length > 0 && x.length <= 4)
        .sort((a,b) => a.length-b.length);
      const chosen = eligible.find(x =>
        !g.questManager.activeQuests.some(q => q.targetRouteId === x.route.id)
        && !g.worldManager.worldAi.parties.some(p => p.alive !== false
          && p.kind === 'bandit' && p.routeId === x.route.id));
      if (!chosen) return { ready: false, reason: 'no_loss_route' };
      const quest = g.questGenerator.generateFromTemplate('escort_first_caravan', {
        targetRouteId: chosen.route.id, issuerFactionId: 'ottoman',
      });
      if (!quest) return { ready: false, reason: 'loss_quest_generator' };
      quest.status = 'active';
      if (!g.questManager.addQuest(quest))
        return { ready: false, reason: 'loss_quest_add' };
      const manager = g.worldManager.simManager.worldPartyManager;
      manager.ensureWorldParties();
      const convoy = g.worldManager.worldAi.parties.find(p =>
        p.escortQuestId === quest.id && p.routeId === chosen.route.id);
      if (!convoy) return { ready: false, reason: 'loss_convoy_missing' };
      const security = g.questGenerator.generateFromTemplate('secure_trade_route', {
        targetRouteId: chosen.route.id,
        targetCityId: chosen.route.fromCityId,
        issuerFactionId: 'ottoman',
      });
      if (!security) return { ready: false, reason: 'loss_source_quest_missing' };
      security.status = 'active';
      if (!g.questManager.addQuest(security))
        return { ready: false, reason: 'loss_source_quest_not_added' };
      const before = new Set(g.worldManager.worldAi.parties.map(p => p.id));
      manager.ensureActiveQuestRouteThreats({
        worldState: g.state.map, tradeRoutes: routeRows, cfg: manager.getWorldAiCfg(),
      });
      const bandit = g.worldManager.worldAi.parties.find(p =>
        !before.has(p.id) && p.kind === 'bandit' && p.routeId === chosen.route.id);
      g.questManager.activeQuests = g.questManager.activeQuests
        .filter(q => q.id !== security.id);
      if (!bandit) return { ready: false, reason: 'loss_source_bandit_missing' };
      bandit.x = convoy.x + Number(g.state.map.tileSize || 32);
      bandit.y = convoy.y;
      g.playerParty.x = convoy.x; g.playerParty.y = convoy.y;
      manager.processQuestEscortCaravans(0.1, {
        worldState: g.state.map, tradeRoutes: routeRows,
      });
      const threatened = convoy.escortStarted === true
        && convoy.escortElapsedSeconds === 0;
      const damageBefore = Number(chosen.route.damage || 0);
      manager.syncVisiblePartiesToWorld();
      const encounter = g.worldManager.simManager.processWorldAiEncounters([{
        partyId: bandit.id, factionId: bandit.factionId,
        x: bandit.x, y: bandit.y,
      }]);
      if (!encounter) return {
        ready: false, reason: 'loss_encounter_not_entered',
        mode: g.state.mode,
        existingEncounter: g.state.encounter?.enemyId ?? null,
        mappedPartyId: g.worldManager.worldEncounterPartyByEnemyId?.[`wai-${bandit.id}`] ?? null,
        sourcePresent: g.worldManager.worldAi.parties.some(p => p.id === bandit.id),
        enemyProjection: g.worldManager.enemyParties.some(p => p.id === `wai-${bandit.id}`),
        activeOverlay: (g.state.modeManager?.overlayStack || []).map(p => p.name),
      };
      g.playerParty.roster = [{
        id: 'qa-weak-guard-v124', name: 'Weak QA Guard',
        class: 'infantry', hp: 1, maxHp: 1,
        atk: 1, def: 0, speed: 1, meleeRange: 1,
        isRanged: false, status: 'healthy', healProgress: 0,
      }];
      const fight = g.encounterManager.resolveEncounter('fight') === true;
      const selected = fight && g.battleManager.confirmRosterSelection() === true;
      const deployed = selected && g.battleManager.confirmBattleDeployment() === true;
      let ticks = 0;
      for (; ticks < 500 && g.state.battle?.phase === 'active'; ticks++) {
        g.battleManager.updateBattleSimulation(0.12);
      }
      return { ready: true, threatened, fight, selected, deployed, ticks,
        questId: quest.id, routeId: chosen.route.id, banditId: bandit.id,
        damageBefore, result: g.state.battle?.battleResult?.result,
        resultPanel: g.state.battle?.phase === 'result' };
    });
    report.guardDefeatCombat = guardDefeatCombat;
    stage('real-engine-escort-guard-defeat', guardDefeatCombat);
    if (!guardDefeatCombat.ready || !guardDefeatCombat.threatened
      || !guardDefeatCombat.fight || !guardDefeatCombat.selected
      || !guardDefeatCombat.deployed || guardDefeatCombat.result !== 'defeat'
      || !guardDefeatCombat.resultPanel) {
      throw new Error('Real escort guard defeat could not be verified using actual tactics');
    }
    await page.keyboard.press('Enter');
    const guardDefeatAftermath = await page.evaluate(({ id, routeId, banditId, damageBefore }) => {
      const g = window.game;
      const quest = g.questManager.failedQuests.filter(q => q.id === id);
      const route = g.economyManager.ensureTradeRoutes().find(r => r.id === routeId);
      const banditAlive = g.worldManager.worldAi.parties.some(p =>
        p.id === banditId && p.alive !== false);
      const noReward = !g.questManager.completedQuests.some(q => q.id === id);
      const archiveOnce = quest.length === 1
        && quest[0].failReason === 'escort_guard_defeated';
      const exactPenalty = Number(route?.damage ?? 0) - damageBefore === 2;
      const saved = g.saveManager.quickSave() === true;
      const loaded = saved && g.saveManager.quickLoad() === true;
      const afterLoad = g.questManager.failedQuests.filter(q => q.id === id);
      const samePenaltyAfterLoad = Number(g.economyManager.ensureTradeRoutes()
        .find(r => r.id === routeId)?.damage ?? 0) - damageBefore === 2;
      return { mode: g.state.mode, banditAlive, noReward, archiveOnce,
        exactPenalty, saved, loaded, samePenaltyAfterLoad,
        archiveAfterLoad: afterLoad.length === 1 && afterLoad[0].archived === true
          && afterLoad[0].failReason === 'escort_guard_defeated' };
    }, { id: guardDefeatCombat.questId, routeId: guardDefeatCombat.routeId,
      banditId: guardDefeatCombat.banditId,
      damageBefore: guardDefeatCombat.damageBefore });
    report.guardDefeatAftermath = guardDefeatAftermath;
    stage('escort-guard-defeat-keeps-bandit-single-route-penalty', guardDefeatAftermath);
    if (guardDefeatAftermath.mode !== 'map' || !guardDefeatAftermath.banditAlive
      || !guardDefeatAftermath.noReward || !guardDefeatAftermath.archiveOnce
      || !guardDefeatAftermath.exactPenalty || !guardDefeatAftermath.saved
      || !guardDefeatAftermath.loaded || !guardDefeatAftermath.samePenaltyAfterLoad
      || !guardDefeatAftermath.archiveAfterLoad) {
      throw new Error('Defeated guard incorrectly cleared bandits or replayed route penalties');
    }

    // V1.29: genuine city trade DOM actions + source-linked convoy stock
    // transit + destination deposition in this disposable Chromium game.
    // This is not a world-data pilot or a synthetic completion receipt.
    const stockTradeSetup = await page.evaluate(() => {
      const g = window.game;
      // The preceding save/load may leave a transient UI mode. The actual
      // enterCityServicesForSettlement transition below is the gate here.
      const routes = g.economyManager.ensureTradeRoutes().filter(x => x.roadBacked);
      const settlements = g.state.map.settlements || [];
      const byId = new Map(settlements.map(s => [String(s.id), s]));
      const busy = new Set(g.questManager.activeQuests.map(q => q.targetRouteId));
      const roads = g.state.map.roads || [];
      const candidates = routes.map(route => {
        const from = byId.get(String(route.fromCityId));
        const to = byId.get(String(route.toCityId));
        const road = roads.find(row =>
          String(row.from) === String(route.fromCityId)
          && String(row.to) === String(route.toCityId));
        const points = road?.path || [];
        const length = points.slice(1).reduce((sum,p,i) =>
          sum + Math.hypot(p.x-points[i].x,p.y-points[i].y), 0);
        return { route, from, to, points, length };
      }).filter(x => x.from && x.to && x.points.length >= 2
        && x.length > 0 && x.length <= 16
        && !busy.has(x.route.id)
        && !g.state.markets?.[String(x.from.id)]
        && !g.state.markets?.[String(x.to.id)]
        && !g.worldManager.worldAi.parties.some(p =>
          p.alive !== false && p.kind === 'bandit' && p.routeId === x.route.id))
        .sort((a,b) => a.length-b.length);
      // Browser QA only: give player sufficient gold to test buying an item;
      // the purchase and sale themselves use actual city UI callbacks.
      g.playerParty.gold = Math.max(2000, g.playerParty.gold);
      const rejectedSources = [];
      for (const chosen of candidates.slice(0, 120)) {
        const opened = g.economyManager.enterCityServicesForSettlement(chosen.from);
        if (!opened) continue;
        g.cityUI?.openService('trade');
        const root = document.getElementById('cityScenePanelBody');
        const buy = root?.querySelector('button[data-action="buy"][data-id="wheat"]');
        const sell = root?.querySelector('button[data-action="sell"][data-id="wheat"]');
        if (buy && sell && g.state.mode === 'city') {
          const market = g.state.markets[String(chosen.from.id)];
          const cityQty = chosen.from.marketStock?.find(x => x.id === 'wheat')?.qty;
          const sourceLinked = market?.stockBridge?.version === 1
            && cityQty === market?.stocks?.wheat;
          if (sourceLinked && cityQty > 0) return {
            ready: true, routeId: chosen.route.id,
            fromId: String(chosen.from.id), toId: String(chosen.to.id),
            cityQty, marketQty: market?.stocks?.wheat,
            sourceLinked, length: chosen.length,
            candidates: candidates.length,
          };
          if (rejectedSources.length < 3) rejectedSources.push({
            id: chosen.from.id,
            cityStock: Array.isArray(chosen.from.marketStock)
              ? chosen.from.marketStock.length : typeof chosen.from.marketStock,
            cityQty, marketQty: market?.stocks?.wheat,
            bridge: market?.stockBridge || null,
            managerSameState: g.economyManager.state === g.state,
            stateCitySame: g.economyManager.state?.city === chosen.from,
            marketBookSame: g.economyManager.state?.markets === g.state?.markets,
            managerStateCityId: g.economyManager.state?.city?.id,
          });
        }
        g.economyManager.exitCityServices();
      }
      return { ready: false, reason: 'no_open_linked_real_market_on_free_short_road',
        candidates: candidates.length, rejectedSources };
    });
    stage('market-stock-real-city-trade-setup', stockTradeSetup);
    if (!stockTradeSetup.ready || !stockTradeSetup.sourceLinked
      || stockTradeSetup.cityQty <= 0) {
      throw new Error('V1.29 no canonical short-road city with usable real market');
    }
    const realBuyClick = await page.evaluate(() => {
      // Live city panel re-renders every frame. A synchronous DOM click fires
      // the actual bound CityServicesUI handler without Playwright detachment.
      const button = document.querySelector(
        '#cityScenePanelBody button[data-action="buy"][data-id="wheat"]');
      if (!button || button.disabled) return false;
      button.click();
      return true;
    });
    if (!realBuyClick) throw new Error('Real city market buy button missing');
    const stockAfterBuy = await page.evaluate(({ fromId, before }) => {
      const g = window.game;
      const s = g.state.map.settlements.find(x => String(x.id) === fromId);
      const market = g.state.markets[fromId];
      return { cityQty: s.marketStock.find(x => x.id === 'wheat')?.qty,
        microQty: market?.stocks?.wheat,
        inventoryQty: g.playerParty.inventory?.items?.find(x => x.id === 'wheat')?.qty,
        expectedQty: before - 1 };
    }, { fromId: stockTradeSetup.fromId, before: stockTradeSetup.cityQty });
    stage('market-stock-real-dom-buy', stockAfterBuy);
    if (stockAfterBuy.cityQty !== stockAfterBuy.expectedQty
      || stockAfterBuy.microQty !== stockAfterBuy.expectedQty
      || stockAfterBuy.inventoryQty < 1)
      throw new Error('Real city UI purchase did not debit both linked ledgers');
    const realSellClick = await page.evaluate(() => {
      const button = document.querySelector(
        '#cityScenePanelBody button[data-action="sell"][data-id="wheat"]');
      if (!button || button.disabled) return false;
      button.click();
      return true;
    });
    if (!realSellClick) throw new Error('Real city market sell button missing');
    const stockAfterSell = await page.evaluate(({ fromId, before }) => {
      const g = window.game;
      const s = g.state.map.settlements.find(x => String(x.id) === fromId);
      return { cityQty: s.marketStock.find(x => x.id === 'wheat')?.qty,
        microQty: g.state.markets[fromId]?.stocks?.wheat,
        expectedQty: before };
    }, { fromId: stockTradeSetup.fromId, before: stockTradeSetup.cityQty });
    stage('market-stock-real-dom-sell', stockAfterSell);
    if (stockAfterSell.cityQty !== stockAfterSell.expectedQty
      || stockAfterSell.microQty !== stockAfterSell.expectedQty)
      throw new Error('Real city UI sale did not restore both linked ledgers');
    const stockRouteDelivery = await page.evaluate(({ routeId, fromId, toId }) => {
      const g = window.game;
      g.economyManager.exitCityServices();
      const worldState = g.state.map;
      const routes = g.economyManager.ensureTradeRoutes();
      const from = worldState.settlements.find(s => String(s.id) === fromId);
      const to = worldState.settlements.find(s => String(s.id) === toId);
      // Mirror the real city's first-service initialization: an old saved
      // empty [] must not be mistaken for a complete already-open market.
      g.economyManager.ensureSettlementMarketState(to);
      const market = g.economyManager.getOrCreateMarketForSettlement(to);
      const initialSource = Object.fromEntries(from.marketStock.map(x => [x.id,x.qty]));
      const initialTarget = { ...market.stocks };
      const quest = g.questGenerator.generateFromTemplate('escort_first_caravan', {
        targetRouteId: routeId, issuerFactionId: 'ottoman',
      });
      if (!quest) return { ready: false, reason: 'quest_template' };
      quest.status = 'active';
      if (!g.questManager.addQuest(quest)) return { ready: false, reason: 'quest_rejected' };
      const pm = g.worldManager.simManager.worldPartyManager;
      pm.ensureWorldParties();
      const caravan = g.worldManager.worldAi.parties.find(p =>
        p.kind === 'caravan' && p.escortQuestId === quest.id
          && p.routeId === routeId && p.alive !== false);
      if (!caravan) return { ready: false, reason: 'no_live_escort' };
      const reserved = Object.fromEntries(from.marketStock.map(row =>
        [row.id, (initialSource[row.id] || 0) - row.qty])
        .filter(([,qty]) => qty > 0));
      const total = Object.values(reserved).reduce((sum,n)=>sum+n,0);
      const beforeStartEqual = Object.entries(reserved).every(([id,qty]) =>
        qty > 0 && from.marketStock.find(row => row.id === id)?.qty === g.state.markets[fromId]?.stocks?.[id]);
      const snapshot = g.saveManager.buildSavePayload();
      const savedCity = snapshot.game.settlementsMarkets.find(x =>
        String(x.settlementId) === fromId)?.marketStock;
      const savedMicro = snapshot.game.markets[fromId]?.stocks;
      const snapshotEscrow = Object.entries(reserved).every(([id]) =>
        savedCity?.find(x => x.id === id)?.qty === initialSource[id]
          && savedMicro?.[id] === initialSource[id]);
      g.playerParty.hasDestination = false;
      g.playerParty.destX = null; g.playerParty.destY = null;
      g.playerParty.x = caravan.x; g.playerParty.y = caravan.y;
      caravan.speed = 18; // bounded QA only, same real NPC movement mechanics
      let ticks = 0;
      for (; ticks < 600 && quest.objectives[0].outcome == null
          && quest.status === 'active'; ticks++) {
        g.playerParty.x = caravan.x; g.playerParty.y = caravan.y;
        pm.processQuestEscortCaravans(0.15, { worldState, tradeRoutes: routes });
      }
      const delivered = quest.objectives[0].outcome === 'caravan_arrived'
        && caravan.escortArrived === true;
      const targetGoods = Object.entries(reserved).every(([id,qty]) =>
        to.marketStock?.find(row => row.id === id)?.qty === (initialTarget[id] || 0) + qty
          && g.state.markets[toId]?.stocks?.[id] === (initialTarget[id] || 0) + qty);
      const originGoods = Object.entries(reserved).every(([id,qty]) =>
        from.marketStock.find(row => row.id === id)?.qty === initialSource[id] - qty
          && g.state.markets[fromId]?.stocks?.[id] === initialSource[id] - qty);
      const sourceReport = g.economyManager.auditMarketStocks();
      const noConflictSource = !sourceReport.rows.some(row =>
        (row.settlementId === fromId || row.settlementId === toId)
          && row.status === 'conflict');
      return { ready: true, ticks, total, reserved, beforeStartEqual,
        snapshotEscrow, delivered, targetGoods, originGoods, noConflictSource,
        questId: quest.id, fromId, toId, routeId,
        canonicalSource: g.state.markets[fromId]?.stockBridge?.version === 1,
        canonicalDestination: g.state.markets[toId]?.stockBridge?.version === 1,
        completionButton: [...(document.querySelectorAll(
          '#questCompletionOverlay button.quest-path:not([disabled])'))]
          .some(b => b.textContent.includes('Kervan güvenli ulaştı')) };
    }, stockTradeSetup);
    report.stockRouteDelivery = stockRouteDelivery;
    stage('market-stock-live-source-to-destination-escort', stockRouteDelivery);
    if (!stockRouteDelivery.ready || !stockRouteDelivery.beforeStartEqual
      || !stockRouteDelivery.snapshotEscrow || stockRouteDelivery.total < 1
      || !stockRouteDelivery.delivered || !stockRouteDelivery.targetGoods
      || !stockRouteDelivery.originGoods || !stockRouteDelivery.noConflictSource
      || !stockRouteDelivery.canonicalSource
      || !stockRouteDelivery.canonicalDestination || !stockRouteDelivery.completionButton) {
      throw new Error('V1.29 real browser stock/escort source-destination validation failed');
    }
    await page.locator('#questCompletionOverlay button.quest-path:not([disabled])')
      .filter({ hasText: 'Kervan güvenli ulaştı' }).click();
    const stockAfterLoad = await page.evaluate(({ fromId, toId }) => {
      const g = window.game;
      const before = [fromId,toId].map(id => {
        const s = g.state.map.settlements.find(x => String(x.id) === id);
        return { id, wheat: s.marketStock.find(x => x.id === 'wheat')?.qty,
          market: g.state.markets[id]?.stocks?.wheat };
      });
      const saved = g.saveManager.quickSave() === true;
      const loaded = saved && g.saveManager.quickLoad() === true;
      const unchanged = before.every(row => {
        const s = g.state.map.settlements.find(x => String(x.id) === row.id);
        return row.wheat === s.marketStock?.find(x => x.id === 'wheat')?.qty
          && row.market === g.state.markets[row.id]?.stocks?.wheat;
      });
      return { saved, loaded, unchanged };
    }, stockTradeSetup);
    stage('market-stock-escort-save-load-roundtrip', stockAfterLoad);
    if (!stockAfterLoad.saved || !stockAfterLoad.loaded || !stockAfterLoad.unchanged)
      throw new Error('V1.29 stock market/convoy completed save load mismatch');

    // V1.30 — recover actual stolen, typed convoy goods from a REAL world
    // bandit only after winning the actual tactical battle. The page fixture
    // weakens the test-only convoy guards and boosts test soldiers, but NEVER
    // manufactures combat outcomes, inventory loot, or victory receipts.
    const sourcedLootBattle = await page.evaluate(() => {
      const g = window.game;
      if (g.state.mode === 'city') g.economyManager.exitCityServices();
      const m = g.worldManager.simManager.worldPartyManager;
      const routes = g.economyManager.ensureTradeRoutes().filter(r => r.roadBacked);
      const roads = g.state.map.roads || [];
      const occupied = new Set(g.questManager.activeQuests.map(q => q.targetRouteId));
      const candidates = routes.map(route => {
        const from = g.state.map.settlements.find(s =>
          String(s.id) === String(route.fromCityId));
        const road = roads.find(x => String(x.from) === String(route.fromCityId)
          && String(x.to) === String(route.toCityId));
        const pts = road?.path || [];
        const length = pts.slice(1).reduce((n,p,i) =>
          n + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
        return { route, from, length };
      }).filter(x => x.from && x.length > 0 && x.length <= 8
        && !occupied.has(x.route.id)
        && !g.worldManager.worldAi.parties.some(p =>
          p.alive !== false && p.kind === 'bandit'
            && p.routeId === x.route.id)).sort((a,b) => a.length - b.length);
      if (g.state.mode !== 'map') return {
        ready: false, reason: 'v130_not_on_map', mode: g.state.mode,
      };
      let chosen = null;
      for (const candidate of candidates) {
        g.economyManager.ensureSettlementMarketState(candidate.from);
        const units = (candidate.from.marketStock || []).filter(x =>
          Number.isSafeInteger(x.qty) && x.qty > 0)
          .slice(0,3).reduce((n,x) => n+x.qty,0);
        if (units >= 6) { chosen = candidate; break; }
      }
      if (!chosen) return { ready: false, reason: 'no_free_stocked_road',
        candidates: candidates.length };
      const beforeStock = Object.fromEntries(chosen.from.marketStock.map(x =>
        [x.id,x.qty]));
      const quest = g.questGenerator.generateFromTemplate('escort_first_caravan', {
        targetRouteId: chosen.route.id, issuerFactionId: 'ottoman',
      });
      if (!quest) return { ready: false, reason: 'v130_missing_escort_template' };
      quest.status='active';
      if (!g.questManager.addQuest(quest)) return {
        ready: false, reason:'v130_cannot_add_escort',
      };
      m.ensureWorldParties();
      const caravan = g.worldManager.worldAi.parties.find(p =>
        p.escortQuestId === quest.id && p.kind === 'caravan');
      if (!caravan) return { ready:false, reason:'v130_no_live_caravan' };
      const reserved = chosen.from.marketStock.map(x =>
        ({ id:x.id, qty:(beforeStock[x.id] || 0)-x.qty }))
        .filter(x => x.qty > 0);
      const total = reserved.reduce((n,x)=>n+x.qty,0);
      if (total < 6) return { ready:false, reason:'v130_no_reservable_goods',
        total, reserved };
      const guards = g.worldManager.worldAi.parties.filter(p =>
        p.escortGuardOf === caravan.id && p.kind === 'escort_guard');
      // Create a native road-bandit source through the existing route-threat
      // spawner, not through a forged save or synthetic world-party clone.
      const security=g.questGenerator.generateFromTemplate('secure_trade_route', {
        targetCityId:chosen.route.fromCityId,targetRouteId:chosen.route.id,
        issuerFactionId:'ottoman',
      });
      if(!security)return{ready:false,reason:'v130_no_security_template'};
      security.status='active';
      if(!g.questManager.addQuest(security))return{
        ready:false,reason:'v130_security_not_added',
      };
      const existingIds = new Set(g.worldManager.worldAi.parties.map(p=>p.id));
      m.ensureActiveQuestRouteThreats({
        worldState:g.state.map,tradeRoutes:routes,cfg:m.getWorldAiCfg(),
      });
      const bandit=g.worldManager.worldAi.parties.find(p=>
        !existingIds.has(p.id) && p.kind==='bandit'
        && p.routeId===chosen.route.id);
      g.questManager.activeQuests = g.questManager.activeQuests.filter(q =>
        q.id !== security.id);
      if(!bandit)return {ready:false,reason:'v130_no_source_bandit'};
      guards.forEach(p=>{p.hp=0;p.alive=false;});
      bandit.x=caravan.x+Number(g.state.map.tileSize||32);
      bandit.y=caravan.y;
      g.playerParty.x=caravan.x;g.playerParty.y=caravan.y;
      g.playerParty.hasDestination=false;
      g.playerParty.destX=null;g.playerParty.destY=null;
      // These are actual NPC attacks and stock-loss bookkeeping.
      let raidTicks=0;
      for(;raidTicks<22 && caravan.escortCargo>=100
        && quest.status==='active' && bandit.alive!==false;raidTicks++) {
        m.processQuestEscortCaravans(0.2,{worldState:g.state.map,tradeRoutes:routes});
      }
      const cargoPct=caravan.escortCargo;
      const stolenCount=Math.round(total*(100-cargoPct)/100);
      let remaining=stolenCount;
      const expected=[];
      for(const row of reserved){
        const n=Math.min(row.qty,remaining);
        if(n>0)expected.push({id:row.id,qty:n});
        remaining-=n;
      }
      const startGold=g.playerParty.gold;
      const noEarlyReward=g.playerParty.gold===startGold
        && !g.questManager.completedQuests.some(q=>q.id===quest.id);
      if(cargoPct>=100 || bandit.alive===false || stolenCount<1) return{
        ready:false, reason:'v130_real_raid_not_observed',
        raidTicks,cargoPct,stolenCount,banditAlive:bandit.alive,
      };
      g.playerParty.roster=Array.from({length:6},(_,i)=>({
        id:`qa-v130-recovery-${i}`,name:`QA Recovery ${i+1}`,
        class:'infantry',hp:4500,maxHp:4500,atk:3500,def:500,
        speed:1100,meleeRange:240,isRanged:false,
        status:'healthy',healProgress:0,
      }));
      m.syncVisiblePartiesToWorld();
      const encountered=g.worldManager.simManager.processWorldAiEncounters([{
        partyId:bandit.id,factionId:bandit.factionId,x:bandit.x,y:bandit.y,
      }]);
      const enemyId=g.state.encounter?.enemyId;
      const sourceMatched=enemyId===`wai-${bandit.id}`
        && g.worldManager.worldEncounterPartyByEnemyId?.[enemyId]===bandit.id;
      const fight=encountered && sourceMatched
        && g.encounterManager.resolveEncounter('fight')===true;
      const selected=fight && g.battleManager.confirmRosterSelection()===true;
      const deployed=selected && g.battleManager.confirmBattleDeployment()===true;
      let combatTicks=0;
      for(;combatTicks<360 && g.state.battle?.phase==='active';combatTicks++){
        g.battleManager.updateBattleSimulation(0.12);
      }
      const battleResult=g.state.battle?.battleResult?.result;
      const beforeExit=Object.fromEntries(
        (g.playerParty.inventory?.items||[]).map(x=>[x.id,x.qty]));
      return {ready:true,routeId:chosen.route.id,questId:quest.id,
        banditId:bandit.id,enemyId,raidTicks,cargoPct,total,
        stolenCount,expected,combatTicks,encountered,sourceMatched,
        fight,selected,deployed,battleResult,
        battlePanel:g.state.battle?.phase==='result',
        beforeExit,noEarlyReward,playerGoldBeforeExit:g.playerParty.gold,
      };
    });
    report.sourcedLootBattle=sourcedLootBattle;
    stage('source-bandit-real-cargo-raid-and-tactical-victory',sourcedLootBattle);
    if(!sourcedLootBattle.ready || !sourcedLootBattle.encountered
      || !sourcedLootBattle.sourceMatched || !sourcedLootBattle.fight
      || !sourcedLootBattle.selected || !sourcedLootBattle.deployed
      || sourcedLootBattle.stolenCount<1
      || sourcedLootBattle.battleResult!=='victory'
      || !sourcedLootBattle.battlePanel || !sourcedLootBattle.noEarlyReward) {
      throw new Error('V1.30 source bandit raid did not lead to real tactical victory');
    }
    await page.keyboard.press('Enter');
    const recoveredSourcedLoot=await page.evaluate(data=>{
      const g=window.game;
      const after=Object.fromEntries((g.playerParty.inventory?.items||[])
        .map(x=>[x.id,x.qty]));
      const delta=Object.fromEntries(Object.keys(after).map(id=>
        [id,after[id]-(data.beforeExit[id]||0)]).filter(([,qty])=>qty!==0));
      const expected=Object.fromEntries(data.expected.map(x=>[x.id,x.qty]));
      const exact=JSON.stringify(Object.entries(delta).sort())===
        JSON.stringify(Object.entries(expected).sort());
      const removed=!g.worldManager.worldAi.parties.some(p=>
        p.id===data.banditId);
      const retryRejected=g.battleManager.exitBattleResultToMap()===false;
      const afterRetry=JSON.stringify(g.playerParty.inventory?.items||[]);
      const payload=g.saveManager.buildSavePayload();
      const safeSave=!payload.game.worldAi.parties.some(p=>
        p.id===data.banditId && (p.loot||p.cargoManifest));
      const saved=g.saveManager.quickSave()===true;
      const loaded=saved && g.saveManager.quickLoad()===true;
      const afterLoad=Object.fromEntries((g.playerParty.inventory?.items||[])
        .map(x=>[x.id,x.qty]));
      const durable=JSON.stringify(Object.entries(afterLoad).sort())===
        JSON.stringify(Object.entries(after).sort());
      return {mode:g.state.mode,delta,expected,exact,removed,
        retryRejected,noDoubleClaim:afterRetry===
          JSON.stringify(payload.game.inventory?.items||[]) || retryRejected,
        safeSave,saved,loaded,durable,
        goldUnchangedFromClaim:g.playerParty.gold===data.playerGoldBeforeExit,
      };
    },sourcedLootBattle);
    report.recoveredSourcedLoot=recoveredSourcedLoot;
    stage('verified-one-time-raided-goods-player-inventory-save-load',
      recoveredSourcedLoot);
    if(!recoveredSourcedLoot.exact || !recoveredSourcedLoot.removed
      || !recoveredSourcedLoot.retryRejected || !recoveredSourcedLoot.safeSave
      || !recoveredSourcedLoot.saved || !recoveredSourcedLoot.loaded
      || !recoveredSourcedLoot.durable
      || !recoveredSourcedLoot.goldUnchangedFromClaim) {
      throw new Error('V1.30 raid source loot failed one-time durable player transfer');
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
