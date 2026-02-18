import assert from 'node:assert/strict';

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const originalPerformance = globalThis.performance;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
const originalLocalStorage = globalThis.localStorage;
const originalAudio = globalThis.Audio;
const originalAudioContext = globalThis.AudioContext;
const originalWebkitAudioContext = globalThis.webkitAudioContext;
const originalSetTimeout = globalThis.setTimeout;

const importCanvasRenderer = () => import(`../rendering/canvas-renderer.js?smoke=${Date.now()}-${Math.random()}`);
const importInputManager = () => import(`./input.js?smoke=${Date.now()}-${Math.random()}`);
const importHUDManager = () => import(`../ui/hud.js?smoke=${Date.now()}-${Math.random()}`);
const importSaveSystem = () => import(`../systems/save-system.js?smoke=${Date.now()}-${Math.random()}`);
const importSpriteGenerator = () => import(`../rendering/sprite-generator.js?smoke=${Date.now()}-${Math.random()}`);
const importAudioSystem = () => import(`../systems/audio-system.js?smoke=${Date.now()}-${Math.random()}`);
const importMainGame = () => import(`../main.js?smoke=${Date.now()}-${Math.random()}`);

const createCountingTarget = () => ({
  listeners: new Map(),
  addCounts: {},
  removeCounts: {},
  addEventListener(event, handler) {
    this.addCounts[event] = (this.addCounts[event] ?? 0) + 1;
    this.listeners.set(event, handler);
  },
  removeEventListener(event, handler) {
    this.removeCounts[event] = (this.removeCounts[event] ?? 0) + 1;
    if (this.listeners.get(event) === handler) {
      this.listeners.delete(event);
    }
  },
});

const createSaveState = () => ({
  mode: 'map',
  seed: 1337,
  day: 1,
  timeSec: 0,
  player: {
    x: 1,
    y: 2,
    tx: 1,
    ty: 2,
    gold: 100,
    army: 20,
    renown: 5,
    inventory: [],
  },
  map: {
    settlements: [],
  },
  aiParties: [],
  selectedFaction: null,
  settings: {},
  keybinds: { map: {} },
});

// Node-like import safety checks (no document/window)
globalThis.document = undefined;
globalThis.window = undefined;
globalThis.localStorage = undefined;

const [{ getEl, safeClass, createElement }, constantsModule, { default: CanvasRenderer }, { default: InputManager }, { default: HUDManager }, { default: SaveSystem }, { default: SpriteGenerator }, { default: AudioSystem }, mainModule] = await Promise.all([
  import('../utils.js'),
  import('../constants.js'),
  importCanvasRenderer(),
  importInputManager(),
  importHUDManager(),
  importSaveSystem(),
  importSpriteGenerator(),
  importAudioSystem(),
  importMainGame(),
]);

assert.ok(constantsModule.GAME, 'constants import should work without browser globals');
assert.equal(getEl('any-id'), null, 'getEl() should return null when document is unavailable');
assert.equal(createElement('div'), null, 'createElement() should return null when document is unavailable');
assert.doesNotThrow(() => safeClass(null, 'add', 'hidden'), 'safeClass() should no-op on null elements');
assert.doesNotThrow(() => safeClass({ classList: {} }, 'add', 'hidden'), 'safeClass() should no-op when class action is unavailable');
assert.equal(typeof CanvasRenderer, 'function', 'canvas renderer import should work without browser globals');
assert.equal(typeof HUDManager, 'function', 'HUD manager import should work without browser globals');
assert.equal(typeof SaveSystem, 'function', 'save system import should work without browser globals');
assert.equal(typeof SpriteGenerator, 'function', 'sprite generator import should work without browser globals');
assert.equal(typeof AudioSystem, 'function', 'audio system import should work without browser globals');
assert.equal(typeof mainModule.default, 'function', 'main game class import should work without browser globals');
assert.equal(typeof mainModule.bootstrapFallOfCavalry, 'function', 'main bootstrap import should work without browser globals');

assert.doesNotThrow(() => {
  const inputManager = new InputManager(null);
  inputManager.setupListeners();
  inputManager.destroy();
}, 'InputManager should not throw when window/document/canvas are unavailable');

assert.doesNotThrow(() => {
  const hudManager = new HUDManager(null);
  hudManager.setupListeners();
  hudManager.update();
  hudManager.destroy();
}, 'HUDManager should not throw when window/document/state are unavailable');

assert.doesNotThrow(() => {
  const saveSystem = new SaveSystem();
  saveSystem.hasSave();
  saveSystem.hasAutosave();
  saveSystem.deleteSave();
  saveSystem.deleteAutosave();
  saveSystem.export();
  saveSystem.load();
  saveSystem.save(createSaveState());
}, 'SaveSystem should not throw when localStorage is unavailable');

assert.doesNotThrow(() => {
  const spriteGenerator = new SpriteGenerator();
  assert.equal(typeof spriteGenerator.getUnitSprite, 'function');
}, 'SpriteGenerator should import/construct without browser globals');

assert.doesNotThrow(() => {
  const audioSystem = new AudioSystem();
  assert.equal(typeof audioSystem.init, 'function');
}, 'AudioSystem should import/construct without browser audio globals');

const createRendererState = () => ({ mode: 'start', debug: { fps: 0 } });
assert.doesNotThrow(() => {
  const renderer = new CanvasRenderer(null, createRendererState());
  renderer.render();
  renderer.resize(undefined, 100);
}, 'CanvasRenderer should no-op when canvas is unavailable');

const nullContextCanvas = { getContext: () => null };
assert.doesNotThrow(() => {
  const renderer = new CanvasRenderer(nullContextCanvas, createRendererState());
  renderer.render();
}, 'CanvasRenderer should no-op when getContext returns null');


const createMainTestEnvironment = () => {
  const makeClassList = () => {
    const classes = new Set(['hidden']);
    return {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      has(name) { return classes.has(name); },
    };
  };

  const createButton = () => {
    const listeners = new Map();
    return {
      disabled: false,
      classList: makeClassList(),
      addCounts: {},
      addEventListener(event, handler) {
        this.addCounts[event] = (this.addCounts[event] ?? 0) + 1;
        listeners.set(event, handler);
      },
      removeEventListener(event, handler) {
        if (listeners.get(event) === handler) listeners.delete(event);
      },
      click() {
        listeners.get('click')?.({ preventDefault() {} });
      },
    };
  };

  const createRange = () => {
    const listeners = new Map();
    return {
      value: '100',
      addCounts: {},
      addEventListener(event, handler) {
        this.addCounts[event] = (this.addCounts[event] ?? 0) + 1;
        listeners.set(event, handler);
      },
      removeEventListener(event, handler) {
        if (listeners.get(event) === handler) listeners.delete(event);
      },
      input(value) {
        this.value = String(value);
        listeners.get('input')?.({ target: this });
      },
    };
  };

  const listenerTarget = {
    listeners: new Map(),
    addCounts: {},
    removeCounts: {},
    addEventListener(event, handler) {
      this.addCounts[event] = (this.addCounts[event] ?? 0) + 1;
      this.listeners.set(event, handler);
    },
    removeEventListener(event) {
      this.removeCounts[event] = (this.removeCounts[event] ?? 0) + 1;
      this.listeners.delete(event);
    },
    dispatch(eventName, payload = {}) {
      this.listeners.get(eventName)?.(payload);
    },
  };

  const canvas = {
    width: 100,
    height: 100,
    addEventListener() {},
    removeEventListener() {},
    getContext() {
      return {
        fillStyle: '#000',
        font: '',
        textAlign: 'left',
        fillRect() {},
        fillText() {},
      };
    },
  };

  const pauseOverlay = { classList: makeClassList() };
  const pauseOverlayTitle = { textContent: '' };
  const pauseOverlayHint = { textContent: '' };
  const menuOverlay = { classList: makeClassList() };
  menuOverlay.classList.remove('hidden');
  const menuSettingsPanel = { classList: makeClassList() };
  const menuBtnStart = createButton();
  const menuBtnContinue = createButton();
  const menuBtnSettings = createButton();
  const menuBtnCloseSettings = createButton();
  const menuMasterVolume = createRange();
  const btnQuitToMenu = createButton();

  const documentForGame = {
    ...listenerTarget,
    body: { innerHTML: '' },
    getElementById(id) {
      if (id === 'gameCanvas') return canvas;
      if (id === 'pauseOverlay') return pauseOverlay;
      if (id === 'pauseOverlayTitle') return pauseOverlayTitle;
      if (id === 'pauseOverlayHint') return pauseOverlayHint;
      if (id === 'mainMenuOverlay' || id === 'menuOverlay') return menuOverlay;
      if (id === 'menuBtnStart') return menuBtnStart;
      if (id === 'menuBtnContinue') return menuBtnContinue;
      if (id === 'menuBtnSettings') return menuBtnSettings;
      if (id === 'menuBtnCloseSettings') return menuBtnCloseSettings;
      if (id === 'mainMenuSettingsPanel') return menuSettingsPanel;
      if (id === 'menuMasterVolume') return menuMasterVolume;
      if (id === 'btnQuitToMenu') return btnQuitToMenu;
      return null;
    },
    createElement() {
      return { classList: { add() {}, remove() {} }, setAttribute() {} };
    },
  };

  const windowForGame = {
    ...listenerTarget,
    innerWidth: 800,
    innerHeight: 600,
  };

  return {
    documentForGame,
    windowForGame,
    pauseOverlayTitle,
    pauseOverlayHint,
    menuOverlay,
    menuBtnStart,
    menuBtnContinue,
    menuBtnSettings,
    menuBtnCloseSettings,
    menuMasterVolume,
    menuSettingsPanel,
    btnQuitToMenu,
  };
};

{
  const { default: MainGame, bootstrapFallOfCavalry } = mainModule;
  const {
    documentForGame,
    windowForGame,
    pauseOverlayTitle,
    pauseOverlayHint,
    menuOverlay,
    menuBtnStart,
    menuBtnContinue,
    menuBtnSettings,
    menuBtnCloseSettings,
    menuSettingsPanel,
    btnQuitToMenu,
  } = createMainTestEnvironment();

  globalThis.document = documentForGame;
  globalThis.window = windowForGame;
  globalThis.setTimeout = () => 1;

  const game = new MainGame();
  const keydownAfterCtor = documentForGame.addCounts.keydown ?? 0;
  const resizeAfterCtor = windowForGame.addCounts.resize ?? 0;
  const startClickBindsAfterCtor = menuBtnStart.addCounts.click ?? 0;
  const continueClickBindsAfterCtor = menuBtnContinue.addCounts.click ?? 0;
  const settingsClickBindsAfterCtor = menuBtnSettings.addCounts.click ?? 0;
  const quitClickBindsAfterCtor = btnQuitToMenu.addCounts.click ?? 0;

  assert.equal(game.mode, 'menu', 'Main game should boot in menu mode');
  assert.equal(game.started, false, 'Main game loop should not be started in menu mode');
  assert.equal(menuBtnContinue.disabled, true, 'Continue should be disabled when no save exists');

  documentForGame.dispatch('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(game.mode, 'menu', 'Escape should not start or pause from menu');

  menuBtnSettings.click();
  assert.equal(menuSettingsPanel.classList.has('hidden'), false, 'Settings panel should open in menu');
  documentForGame.dispatch('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(menuSettingsPanel.classList.has('hidden'), true, 'Escape in menu should close settings panel');

  documentForGame.dispatch('keydown', { key: 'Enter', preventDefault() {} });
  assert.equal(game.mode, 'playing', 'Enter should start game from menu');
  assert.equal(game.started, true, 'Main game should be started after Enter');
  assert.equal(menuOverlay.classList.has('hidden'), true, 'Menu overlay should be hidden in playing mode');

  documentForGame.dispatch('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(game.mode, 'paused', 'Escape should pause while playing');
  assert.equal(game.isPaused(), true, 'Main game should enter paused state');
  assert.equal(pauseOverlayTitle.textContent, 'PAUSED', 'Main game pause should update overlay title');
  assert.equal(pauseOverlayHint.textContent, 'Press ESC to resume', 'Main game pause should update overlay hint');

  documentForGame.dispatch('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(game.mode, 'playing', 'Escape should resume while paused');

  btnQuitToMenu.click();
  assert.equal(game.mode, 'menu', 'Quit to menu should switch mode to menu');
  assert.equal(game.started, false, 'Quit to menu should stop game loop');
  assert.equal(menuOverlay.classList.has('hidden'), false, 'Menu overlay should be visible in menu mode');

  const saveData = {
    ...createSaveState(),
    version: constantsModule.SAVE.VERSION,
  };
  globalThis.localStorage = {
    getItem() { return JSON.stringify(saveData); },
    setItem() {},
    removeItem() {},
  };

  game.enterMenu();
  assert.equal(menuBtnContinue.disabled, false, 'Continue should be enabled when save exists');

  let loadCalls = 0;
  const originalLoad = game.saveSystem.load.bind(game.saveSystem);
  game.saveSystem.load = (...args) => {
    loadCalls += 1;
    return originalLoad(...args);
  };

  menuBtnContinue.click();
  assert.equal(loadCalls, 1, 'Continue click should call save load once');
  assert.equal(game.mode, 'playing', 'Continue should enter playing mode on successful load');

  const reinitResult = game.init();
  assert.equal(reinitResult, true, 'Main game init() should succeed when called repeatedly');
  assert.equal(documentForGame.addCounts.keydown ?? 0, keydownAfterCtor, 'Main game init() should not duplicate keydown binding');
  assert.equal(windowForGame.addCounts.resize ?? 0, resizeAfterCtor, 'Main game init() should not duplicate resize binding');
  assert.equal(menuBtnStart.addCounts.click ?? 0, startClickBindsAfterCtor, 'Start click handler should not duplicate');
  assert.equal(menuBtnContinue.addCounts.click ?? 0, continueClickBindsAfterCtor, 'Continue click handler should not duplicate');
  assert.equal(menuBtnSettings.addCounts.click ?? 0, settingsClickBindsAfterCtor, 'Settings click handler should not duplicate');
  assert.equal(btnQuitToMenu.addCounts.click ?? 0, quitClickBindsAfterCtor, 'Quit click handler should not duplicate');

  assert.doesNotThrow(() => game.destroy(), 'Main game destroy() should not throw');

  const reinitAfterDestroy = game.init();
  assert.equal(reinitAfterDestroy, true, 'Main game should allow init() after destroy');
  game.enterMenu();
  menuBtnStart.click();
  assert.equal((documentForGame.addCounts.keydown ?? 0) - keydownAfterCtor, 2, 'Main game destroy+init should rebind keydown listeners once per owned subsystem');
  assert.equal((windowForGame.addCounts.resize ?? 0) - resizeAfterCtor, 1, 'Main game destroy+init should rebind resize once');
  assert.equal((menuBtnStart.addCounts.click ?? 0) - startClickBindsAfterCtor, 1, 'Start click should rebind once after destroy+init');

  const boot1 = bootstrapFallOfCavalry();
  const boot2 = bootstrapFallOfCavalry();
  assert.ok(boot1, 'Main bootstrap should return game instance');
  assert.equal(boot1, boot2, 'Main bootstrap should be idempotent');
}

const elementFactory = () => ({
  classList: {
    add() {},
    remove() {},
  },
  setAttribute() {},
});

const documentTarget = {
  ...createCountingTarget(),
  getElementById() {
    return null;
  },
  createElement() {
    return elementFactory();
  },
};
const windowTarget = {
  ...createCountingTarget(),
};

globalThis.document = documentTarget;
globalThis.window = windowTarget;

const originalWarn = console.warn;
let missingIdWarnCount = 0;
let missingCanvasWarnCount = 0;
let missingHudStateWarnCount = 0;
let saveStorageUnavailableWarnCount = 0;
let saveStorageWriteWarnCount = 0;
let saveStorageReadWarnCount = 0;
let saveJsonParseWarnCount = 0;
let saveJsonStringifyWarnCount = 0;
let spriteMissingDocumentWarnCount = 0;
let spriteGetContextWarnCount = 0;
let spriteNullContextWarnCount = 0;
let audioMissingContextWarnCount = 0;
let audioMissingHtmlAudioWarnCount = 0;

console.warn = (msg) => {
  if (msg === '[DOM] Missing element id: missingDomId') {
    missingIdWarnCount += 1;
  }
  if (msg === '[CanvasRenderer] Canvas getContext unavailable') {
    missingCanvasWarnCount += 1;
  }
  if (msg === '[HUD] State emitter unavailable; HUD listeners skipped') {
    missingHudStateWarnCount += 1;
  }
  if (msg === '[SaveSystem] Storage unavailable') {
    saveStorageUnavailableWarnCount += 1;
  }
  if (msg === '[SaveSystem] Storage write failed') {
    saveStorageWriteWarnCount += 1;
  }
  if (msg === '[SaveSystem] Storage read failed') {
    saveStorageReadWarnCount += 1;
  }
  if (msg === '[SaveSystem] Save data parse failed') {
    saveJsonParseWarnCount += 1;
  }
  if (msg === '[SaveSystem] Save serialization failed') {
    saveJsonStringifyWarnCount += 1;
  }
  if (msg === '[SpriteGenerator] document.createElement unavailable') {
    spriteMissingDocumentWarnCount += 1;
  }
  if (msg === '[SpriteGenerator] Canvas getContext unavailable') {
    spriteGetContextWarnCount += 1;
  }
  if (msg === '[SpriteGenerator] Canvas 2D context unavailable') {
    spriteNullContextWarnCount += 1;
  }
  if (msg === '[AudioSystem] AudioContext unavailable') {
    audioMissingContextWarnCount += 1;
  }
  if (msg === '[AudioSystem] HTMLAudio unavailable') {
    audioMissingHtmlAudioWarnCount += 1;
  }
};

getEl('missingDomId');
getEl('missingDomId');
assert.equal(missingIdWarnCount, 1, 'warn-once should emit at most once per missing DOM id key');

const invalidCanvas = {};
const warnedRenderer = new CanvasRenderer(invalidCanvas, createRendererState());
warnedRenderer.getContext2D(invalidCanvas);
warnedRenderer.getContext2D(invalidCanvas);
assert.equal(missingCanvasWarnCount, 1, 'CanvasRenderer warning should emit at most once per warning key');

const warnedHudManager = new HUDManager({});
warnedHudManager.setupListeners();
warnedHudManager.setupListeners();
assert.equal(missingHudStateWarnCount, 1, 'HUDManager warning should emit at most once per warning key');

globalThis.localStorage = undefined;
const missingStorageSaveSystem = new SaveSystem();
missingStorageSaveSystem.load();
missingStorageSaveSystem.save(createSaveState());
missingStorageSaveSystem.load();
assert.equal(saveStorageUnavailableWarnCount, 1, 'SaveSystem should warn once when storage is missing');

globalThis.localStorage = {
  getItem() {
    const error = new Error('SecurityError');
    error.name = 'SecurityError';
    throw error;
  },
  setItem() {
    const error = new Error('QuotaExceededError');
    error.name = 'QuotaExceededError';
    throw error;
  },
  removeItem() {
    return undefined;
  },
};
const throwingStorageSaveSystem = new SaveSystem();
assert.doesNotThrow(() => throwingStorageSaveSystem.load(), 'SaveSystem load() should not throw when storage read throws');
assert.doesNotThrow(() => throwingStorageSaveSystem.load(), 'SaveSystem load() should continue to not throw on repeated read failures');
assert.doesNotThrow(() => throwingStorageSaveSystem.save(createSaveState()), 'SaveSystem save() should not throw when storage write throws');
assert.doesNotThrow(() => throwingStorageSaveSystem.save(createSaveState()), 'SaveSystem save() should continue to not throw on repeated write failures');
assert.equal(saveStorageReadWarnCount, 1, 'SaveSystem read warning should emit once per key');
assert.equal(saveStorageWriteWarnCount, 1, 'SaveSystem write warning should emit once per key');

globalThis.localStorage = {
  getItem() {
    return '{invalid-json';
  },
  setItem() {},
  removeItem() {},
};
const invalidJsonSaveSystem = new SaveSystem();
const invalidLoadResult1 = invalidJsonSaveSystem.load();
const invalidLoadResult2 = invalidJsonSaveSystem.load();
assert.equal(invalidLoadResult1.success, false, 'SaveSystem load() should fail safely on invalid JSON');
assert.equal(invalidLoadResult2.success, false, 'SaveSystem load() should repeatedly fail safely on invalid JSON');
assert.equal(saveJsonParseWarnCount, 1, 'SaveSystem invalid JSON warning should emit once');

globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {},
};
const circularSaveSystem = new SaveSystem();
const circularState = createSaveState();
circularState.settings.self = circularState.settings;
const circularSaveResult1 = circularSaveSystem.save(circularState);
const circularSaveResult2 = circularSaveSystem.save(circularState);
assert.equal(circularSaveResult1.success, false, 'SaveSystem save() should fail safely when stringify encounters circular data');
assert.equal(circularSaveResult2.success, false, 'SaveSystem save() should repeatedly fail safely on circular data');
assert.equal(saveJsonStringifyWarnCount, 1, 'SaveSystem stringify warning should emit once');

globalThis.document = undefined;
const missingDocumentSpriteGenerator = new SpriteGenerator();
assert.equal(missingDocumentSpriteGenerator.getUnitSprite('ottoman', 'archer', 'missing-doc-1'), null);
assert.equal(missingDocumentSpriteGenerator.getUnitSprite('ottoman', 'archer', 'missing-doc-2'), null);
assert.equal(spriteMissingDocumentWarnCount, 1, 'SpriteGenerator missing document warning should emit once');

globalThis.document = {
  createElement() {
    return {};
  },
};
const missingGetContextSpriteGenerator = new SpriteGenerator();
assert.equal(missingGetContextSpriteGenerator.getUnitSprite('ottoman', 'archer', 'no-getcontext-1'), null);
assert.equal(missingGetContextSpriteGenerator.getUnitSprite('ottoman', 'archer', 'no-getcontext-2'), null);
assert.equal(spriteGetContextWarnCount, 1, 'SpriteGenerator getContext warning should emit once');

globalThis.document = {
  createElement() {
    return {
      getContext() {
        return null;
      },
    };
  },
};
const nullContextSpriteGenerator = new SpriteGenerator();
assert.equal(nullContextSpriteGenerator.getUnitSprite('ottoman', 'archer', 'null-context-1'), null);
assert.equal(nullContextSpriteGenerator.getUnitSprite('ottoman', 'archer', 'null-context-2'), null);
assert.equal(spriteNullContextWarnCount, 1, 'SpriteGenerator null context warning should emit once');

globalThis.document = documentTarget;

globalThis.AudioContext = undefined;
globalThis.webkitAudioContext = undefined;
globalThis.Audio = undefined;

const missingAudioSystem = new AudioSystem();
assert.doesNotThrow(() => missingAudioSystem.init(), 'AudioSystem init() should not throw when AudioContext is missing');
const missingAudioPlay1 = await missingAudioSystem.play('sound.mp3');
const missingAudioPlay2 = await missingAudioSystem.play('sound.mp3');
assert.equal(missingAudioPlay1, false, 'AudioSystem play() should fail safely without Audio APIs');
assert.equal(missingAudioPlay2, false, 'AudioSystem play() should repeatedly fail safely without Audio APIs');
assert.equal(audioMissingContextWarnCount, 1, 'AudioSystem missing AudioContext warning should emit once');

class ContextOnlyStubAudioContext {
  constructor() {
    this.state = 'running';
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

globalThis.AudioContext = ContextOnlyStubAudioContext;
globalThis.webkitAudioContext = undefined;
globalThis.Audio = undefined;
const missingHtmlAudioSystem = new AudioSystem();
assert.equal(await missingHtmlAudioSystem.play('sound.mp3'), false);
assert.equal(await missingHtmlAudioSystem.play('sound.mp3'), false);
assert.equal(audioMissingHtmlAudioWarnCount, 1, 'AudioSystem missing HTMLAudio warning should emit once');

class StubAudio {
  constructor(src) {
    this.src = src;
    this.loop = false;
    this.volume = 1;
    this.playCalls = 0;
    this.pauseCalls = 0;
  }

  play() {
    this.playCalls += 1;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
  }
}

class StubAudioContext {
  constructor() {
    this.state = 'running';
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

globalThis.Audio = StubAudio;
globalThis.AudioContext = StubAudioContext;
globalThis.webkitAudioContext = undefined;

const stubAudioSystem = new AudioSystem({ music: 0.4, sfx: 0.6 });
assert.doesNotThrow(() => stubAudioSystem.init(), 'AudioSystem init() should not throw with stub AudioContext');
const stubPlayResult = await stubAudioSystem.play('sound.mp3', { type: 'sfx' });
assert.equal(stubPlayResult, true, 'AudioSystem play() should succeed with stub HTMLAudio');
assert.doesNotThrow(() => stubAudioSystem.setMusicVolume(2), 'AudioSystem setMusicVolume() should not throw on invalid range values');
assert.doesNotThrow(() => stubAudioSystem.setSfxVolume(-1), 'AudioSystem setSfxVolume() should not throw on invalid range values');
assert.doesNotThrow(() => stubAudioSystem.stopAll(), 'AudioSystem stopAll() should not throw');

const stateEventHandlers = new Map();
const stateOnCounts = {};
const stateOffCounts = {};
const hudState = {
  player: { gold: 1, army: 2, renown: 3 },
  day: 1,
  selectedFaction: { name: 'Ottoman' },
  on(event, handler) {
    stateOnCounts[event] = (stateOnCounts[event] ?? 0) + 1;
    stateEventHandlers.set(event, handler);
  },
  off(event, handler) {
    stateOffCounts[event] = (stateOffCounts[event] ?? 0) + 1;
    if (stateEventHandlers.get(event) === handler) {
      stateEventHandlers.delete(event);
    }
  },
};

const hudManager = new HUDManager(hudState);
assert.doesNotThrow(() => hudManager.update(), 'HUDManager update() should not throw with missing DOM elements');

const expectedHudEvents = [
  'player:gold:changed',
  'player:army:changed',
  'player:renown:changed',
  'day:advanced',
  'faction:selected',
  'mode:changed',
];
for (const event of expectedHudEvents) {
  assert.equal(stateOnCounts[event], 1, `HUD ${event} should bind once`);
}

hudManager.setupListeners();
for (const event of expectedHudEvents) {
  assert.equal(stateOnCounts[event], 1, `HUD ${event} should not rebind on repeated setup`);
}

hudManager.destroy();
for (const event of expectedHudEvents) {
  assert.equal(stateOffCounts[event], 1, `HUD ${event} should unbind once on destroy`);
}

hudManager.setupListeners();
for (const event of expectedHudEvents) {
  assert.equal(stateOnCounts[event], 2, `HUD ${event} should rebind once after destroy`);
}

console.warn = originalWarn;

const rafCallbacks = new Map();
let rafIdSeq = 0;
let rafScheduleCount = 0;

const defaultRequestAnimationFrame = (cb) => {
  rafScheduleCount += 1;
  rafIdSeq += 1;
  rafCallbacks.set(rafIdSeq, cb);
  return rafIdSeq;
};

const defaultCancelAnimationFrame = (id) => {
  rafCallbacks.delete(id);
};

globalThis.performance = { now: () => 0 };
globalThis.requestAnimationFrame = defaultRequestAnimationFrame;
globalThis.cancelAnimationFrame = defaultCancelAnimationFrame;

const canvas = {
  ...createCountingTarget(),
  getBoundingClientRect() {
    return { left: 0, top: 0 };
  },
};

const [{ default: GameLoop }] = await Promise.all([
  import('./game-loop.js'),
]);

const createState = () => ({
  paused: false,
  mode: 'start',
  timeSec: 0,
  dayTimer: 0,
  autosaveTimer: 0,
  camera: { x: 0, y: 0 },
  battlePaused: false,
  battleSpeed: 1,
  performance: { frameCount: 0, fps: 60 },
  debug: { fps: 60 },
  emit() {},
});

const input = {
  updateWorldCoords() {},
  update() {},
};

const loop = new GameLoop(createState(), input, null);
loop.start();
loop.start();
assert.equal(rafScheduleCount, 1, 'start() should schedule RAF chain exactly once while already running');

const inputManager = new InputManager(canvas);
const expectedCanvasEvents = ['mousemove', 'mousedown', 'mouseup', 'mouseenter', 'mouseleave', 'contextmenu', 'wheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel'];
const expectedDocumentEvents = ['keydown', 'keyup'];
const expectedWindowEvents = ['blur'];

for (const event of expectedCanvasEvents) {
  assert.equal(canvas.addCounts[event], 1, `canvas ${event} should bind once`);
}
for (const event of expectedDocumentEvents) {
  assert.equal(documentTarget.addCounts[event], 1, `document ${event} should bind once`);
}
for (const event of expectedWindowEvents) {
  assert.equal(windowTarget.addCounts[event], 1, `window ${event} should bind once`);
}

const listenerCountAfterFirstSetup = inputManager.handlers.size;
inputManager.setupListeners();
assert.equal(
  inputManager.handlers.size,
  listenerCountAfterFirstSetup,
  'setupListeners() should be idempotent and not register duplicate listeners',
);
for (const event of expectedCanvasEvents) {
  assert.equal(canvas.addCounts[event], 1, `canvas ${event} should not rebind on repeated setup`);
}

inputManager.destroy();
for (const event of expectedCanvasEvents) {
  assert.equal(canvas.removeCounts[event], 1, `canvas ${event} should unbind once on destroy`);
}
for (const event of expectedDocumentEvents) {
  assert.equal(documentTarget.removeCounts[event], 1, `document ${event} should unbind once on destroy`);
}
for (const event of expectedWindowEvents) {
  assert.equal(windowTarget.removeCounts[event], 1, `window ${event} should unbind once on destroy`);
}

inputManager.setupListeners();
for (const event of expectedCanvasEvents) {
  assert.equal(canvas.addCounts[event], 2, `canvas ${event} should rebind once after destroy`);
}
for (const event of expectedDocumentEvents) {
  assert.equal(documentTarget.addCounts[event], 2, `document ${event} should rebind once after destroy`);
}
for (const event of expectedWindowEvents) {
  assert.equal(windowTarget.addCounts[event], 2, `window ${event} should rebind once after destroy`);
}

assert.doesNotThrow(() => {
  const invalidCanvasInput = new InputManager({});
  invalidCanvasInput.setupListeners();
  invalidCanvasInput.destroy();
}, 'InputManager should not throw when canvas is invalid');

loop.stop();

let missingRafWarnCount = 0;
console.warn = (msg) => {
  if (msg === '[GameLoop] Cannot start: requestAnimationFrame unavailable') {
    missingRafWarnCount += 1;
  }
};

globalThis.requestAnimationFrame = undefined;
const noRafLoop = new GameLoop(createState(), input, null);
assert.doesNotThrow(() => noRafLoop.start(), 'start() should not throw when RAF is unavailable');
assert.equal(noRafLoop.running, false, 'start() should not mark loop as running when RAF is unavailable');
noRafLoop.start();
assert.equal(missingRafWarnCount, 1, 'missing RAF warning should be emitted once per instance');
console.warn = originalWarn;

globalThis.requestAnimationFrame = defaultRequestAnimationFrame;
const noCancelLoop = new GameLoop(createState(), input, null);
noCancelLoop.start();
globalThis.cancelAnimationFrame = undefined;
assert.doesNotThrow(() => noCancelLoop.stop(), 'stop() should not throw when cancelAnimationFrame is unavailable');
assert.equal(noCancelLoop.running, false, 'stop() should still set running=false without cancelAnimationFrame');

globalThis.cancelAnimationFrame = defaultCancelAnimationFrame;

globalThis.performance = undefined;
const fallbackLoop = new GameLoop(createState(), input, null);
assert.equal(typeof fallbackLoop.lastTime, 'number', 'GameLoop.now() should fallback to Date.now() when performance.now is unavailable');

inputManager.destroy();
hudManager.destroy();
warnedHudManager.destroy();

globalThis.document = originalDocument;
globalThis.window = originalWindow;
globalThis.performance = originalPerformance;
globalThis.requestAnimationFrame = originalRequestAnimationFrame;
globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
globalThis.localStorage = originalLocalStorage;
globalThis.Audio = originalAudio;
globalThis.AudioContext = originalAudioContext;
globalThis.webkitAudioContext = originalWebkitAudioContext;
globalThis.setTimeout = originalSetTimeout;

console.log('runtime guards smoke tests passed');
