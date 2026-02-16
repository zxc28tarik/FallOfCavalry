import assert from 'node:assert/strict';

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const originalPerformance = globalThis.performance;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

// Node-like import safety checks (no document/window)
globalThis.document = undefined;
globalThis.window = undefined;

const [{ getEl, safeClass, createElement }, constantsModule] = await Promise.all([
  import('../utils.js'),
  import('../constants.js'),
]);

assert.ok(constantsModule.GAME, 'constants import should work without browser globals');
assert.equal(getEl('any-id'), null, 'getEl() should return null when document is unavailable');
assert.equal(createElement('div'), null, 'createElement() should return null when document is unavailable');
assert.doesNotThrow(() => safeClass(null, 'add', 'hidden'), 'safeClass() should no-op on null elements');
assert.doesNotThrow(() => safeClass({ classList: {} }, 'add', 'hidden'), 'safeClass() should no-op when class action is unavailable');

const noopTarget = {
  _listeners: [],
  addEventListener(event, handler) {
    this._listeners.push({ event, handler });
  },
  removeEventListener(event, handler) {
    this._listeners = this._listeners.filter((l) => l.event !== event || l.handler !== handler);
  },
};

const elementFactory = () => ({
  classList: {
    add() {},
    remove() {},
  },
  setAttribute() {},
});

globalThis.document = {
  ...noopTarget,
  getElementById() {
    return null;
  },
  createElement() {
    return elementFactory();
  },
};
globalThis.window = { ...noopTarget };

const originalWarn = console.warn;
let missingIdWarnCount = 0;
console.warn = (msg) => {
  if (msg === '[DOM] Missing element id: missingDomId') {
    missingIdWarnCount += 1;
  }
};

getEl('missingDomId');
getEl('missingDomId');
assert.equal(missingIdWarnCount, 1, 'warn-once should emit at most once per missing DOM id key');
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
  ...noopTarget,
  getBoundingClientRect() {
    return { left: 0, top: 0 };
  },
};

const [{ default: GameLoop }, { default: InputManager }] = await Promise.all([
  import('./game-loop.js'),
  import('./input.js'),
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
const listenerCountAfterFirstSetup = inputManager.handlers.size;
inputManager.setupListeners();
assert.equal(
  inputManager.handlers.size,
  listenerCountAfterFirstSetup,
  'setupListeners() should be idempotent and not register duplicate listeners',
);

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

globalThis.document = originalDocument;
globalThis.window = originalWindow;
globalThis.performance = originalPerformance;
globalThis.requestAnimationFrame = originalRequestAnimationFrame;
globalThis.cancelAnimationFrame = originalCancelAnimationFrame;

console.log('runtime guards smoke tests passed');
