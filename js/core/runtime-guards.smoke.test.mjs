import assert from 'node:assert/strict';

const rafCallbacks = new Map();
let rafIdSeq = 0;
let rafScheduleCount = 0;

globalThis.performance = { now: () => 0 };
globalThis.requestAnimationFrame = (cb) => {
  rafScheduleCount += 1;
  rafIdSeq += 1;
  rafCallbacks.set(rafIdSeq, cb);
  return rafIdSeq;
};
globalThis.cancelAnimationFrame = (id) => {
  rafCallbacks.delete(id);
};

const noopTarget = {
  _listeners: [],
  addEventListener(event, handler) {
    this._listeners.push({ event, handler });
  },
  removeEventListener(event, handler) {
    this._listeners = this._listeners.filter((l) => l.event !== event || l.handler !== handler);
  },
};

globalThis.document = { ...noopTarget };
globalThis.window = { ...noopTarget };

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

const state = {
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
};

const input = {
  updateWorldCoords() {},
  update() {},
};

const loop = new GameLoop(state, input, null);
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
inputManager.destroy();

console.log('runtime guards smoke tests passed');
