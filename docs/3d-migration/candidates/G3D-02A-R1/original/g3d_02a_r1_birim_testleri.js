import test from 'node:test';
import assert from 'node:assert/strict';
import {
    Battle3DRenderer,
    DEFAULT_SECTOR_BOUNDS,
    deriveSectorViewBounds
} from '../../js/battle3d/Battle3DRenderer.js';
import { RTSCamera3D } from '../../js/battle3d/RTSCamera3D.js';

/**
 * Helper to recursively freeze an object tree so tests prove read-only access.
 */
function deepFreeze(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    Object.freeze(obj);
    Object.keys(obj).forEach((key) => deepFreeze(obj[key]));
    return obj;
}

/**
 * Helper to create a minimal headless mount & WebGLRenderer mock for Node CI tests.
 */
function createHeadlessMountAndFactory() {
    const domElement = {
        parentNode: null,
        addEventListener() {},
        removeEventListener() {}
    };

    const mount = {
        clientWidth: 1024,
        clientHeight: 768,
        innerHTML: '',
        children: [],
        appendChild(el) {
            el.parentNode = mount;
            mount.children.push(el);
        },
        removeChild(el) {
            el.parentNode = null;
            mount.children = mount.children.filter((c) => c !== el);
        }
    };

    let renderCount = 0;
    let disposeCount = 0;

    const rendererFactory = () => ({
        domElement,
        shadowMap: { enabled: false, type: null },
        setSize() {},
        setPixelRatio() {},
        render() {
            renderCount++;
        },
        dispose() {
            disposeCount++;
        },
        forceContextLoss() {}
    });

    return {
        mount,
        rendererFactory,
        getStats: () => ({ renderCount, disposeCount })
    };
}

test('deriveSectorViewBounds handles null, undefined, and empty soldiers safely', () => {
    const nullResult = deriveSectorViewBounds(null);
    assert.equal(nullResult.isEmpty, true);
    assert.equal(nullResult.sectorId, 'BOS_SEKTOR');
    assert.deepEqual(nullResult.bounds, DEFAULT_SECTOR_BOUNDS);
    assert.deepEqual(nullResult.cameraTarget, { x: 0, z: 0 });
    assert.equal(nullResult.uniqueGroupCount, 0);

    const emptySnapshot = {
        sectorId: 'SEC_EMPTY_01',
        soldiers: [],
        limits: { player: 150, enemy: 150 },
        visible: { player: 0, enemy: 0 },
        hiddenAlive: { player: 0, enemy: 0 },
        dataAuthority: 'existing_battle_simulation'
    };
    const emptyResult = deriveSectorViewBounds(emptySnapshot);
    assert.equal(emptyResult.isEmpty, true);
    assert.equal(emptyResult.sectorId, 'SEC_EMPTY_01');
    assert.deepEqual(emptyResult.bounds, DEFAULT_SECTOR_BOUNDS);
    assert.equal(emptyResult.uniqueGroupCount, 0);
});

test('deriveSectorViewBounds derives bounds, centroid target, and unique groupId count from G3D-01 snapshot without mutating source', () => {
    const rawSnapshot = deepFreeze({
        sectorId: 'SECTOR_ALPHA',
        soldiers: [
            {
                viewId: 'v1',
                sectorId: 'SECTOR_ALPHA',
                side: 'player',
                groupId: 'grp_p1',
                soldierId: 's1',
                unitClass: 'pikeman',
                combatRole: 'melee',
                bodyType: 'human',
                mountType: 'foot',
                activeWeapon: 'pike',
                weaponLoadout: ['pike'],
                armorLoadout: ['cuirass'],
                state: 'idle',
                hp: 100,
                position: { x: -20, y: 0, z: -10 }
            },
            {
                viewId: 'v2',
                sectorId: 'SECTOR_ALPHA',
                side: 'player',
                groupId: 'grp_p1',
                soldierId: 's2',
                unitClass: 'pikeman',
                combatRole: 'melee',
                bodyType: 'human',
                mountType: 'foot',
                activeWeapon: 'pike',
                weaponLoadout: ['pike'],
                armorLoadout: ['cuirass'],
                state: 'idle',
                hp: 100,
                position: { x: -10, y: 0, z: -10 }
            },
            {
                viewId: 'v3',
                sectorId: 'SECTOR_ALPHA',
                side: 'enemy',
                groupId: 'grp_e1',
                soldierId: 's3',
                unitClass: 'cuirassier',
                combatRole: 'cavalry',
                bodyType: 'mounted',
                mountType: 'horse',
                activeWeapon: 'sword',
                weaponLoadout: ['sword'],
                armorLoadout: ['plate'],
                state: 'idle',
                hp: 140,
                position: { x: 30, y: 0, z: 20 }
            }
        ],
        limits: { player: 150, enemy: 150 },
        visible: { player: 2, enemy: 1 },
        hiddenAlive: { player: 0, enemy: 0 },
        dataAuthority: 'existing_battle_simulation'
    });

    const derived = deriveSectorViewBounds(rawSnapshot);
    assert.equal(derived.isEmpty, false);
    assert.equal(derived.sectorId, 'SECTOR_ALPHA');
    assert.equal(derived.uniqueGroupCount, 2);
    assert.equal(derived.playerCount, 2);
    assert.equal(derived.enemyCount, 1);

    // Centroid of (-20, -10), (-10, -10), (30, 20) is (0, 0)
    assert.equal(derived.cameraTarget.x, 0);
    assert.equal(derived.cameraTarget.z, 0);

    // Bounds must encompass all soldiers plus padding
    assert.ok(derived.bounds.minX <= -20);
    assert.ok(derived.bounds.maxX >= 30);
    assert.ok(derived.bounds.minZ <= -10);
    assert.ok(derived.bounds.maxZ >= 20);
});

test('RTSCamera3D enforces pan boundary clamping and zoom limits', () => {
    const cam = new RTSCamera3D({ aspect: 16 / 9 });
    cam.setBoundsAndTarget({ minX: -40, maxX: 40, minZ: -30, maxZ: 30 }, { x: 0, z: 0 }, true);

    // Attempt to pan far outside bounds
    cam.panRelative(500, 500);
    cam.syncTransform(1);
    assert.equal(cam.current.targetX, 40);
    assert.equal(cam.current.targetZ, -30);

    // Attempt to zoom below minDistance and above maxDistance
    cam.zoomBy(-500);
    cam.syncTransform(1);
    assert.equal(cam.current.distance, cam.limits.minDistance);

    cam.zoomBy(500);
    cam.syncTransform(1);
    assert.equal(cam.current.distance, cam.limits.maxDistance);
});

test('Battle3DRenderer lifecycle supports init, sync, resize, idempotent dispose, and re-init', () => {
    const { mount, rendererFactory, getStats } = createHeadlessMountAndFactory();
    const renderer = new Battle3DRenderer({ rendererFactory });

    const initialized = renderer.init(mount, null);
    assert.equal(initialized, true);
    assert.equal(renderer.isInitialized, true);
    assert.equal(mount.children.length, 1);

    const snapshot = deepFreeze({
        sectorId: 'SEC_LIFECYCLE',
        soldiers: [
            {
                viewId: 's1',
                sectorId: 'SEC_LIFECYCLE',
                side: 'player',
                groupId: 'g1',
                soldierId: 's1',
                position: { x: 10, y: 0, z: 15 }
            }
        ],
        limits: { player: 150, enemy: 150 },
        visible: { player: 1, enemy: 0 },
        hiddenAlive: { player: 0, enemy: 0 },
        dataAuthority: 'existing_battle_simulation'
    });

    const summary = renderer.sync(snapshot, { snapCamera: true });
    assert.equal(summary.sectorId, 'SEC_LIFECYCLE');
    assert.equal(renderer.cameraController.current.targetX, 10);
    assert.equal(renderer.cameraController.current.targetZ, 15);

    mount.clientWidth = 1280;
    mount.clientHeight = 720;
    renderer.resize();
    assert.ok(Math.abs(renderer.cameraController.camera.aspect - (1280 / 720)) < 1e-5);

    // Idempotent dispose
    renderer.dispose();
    renderer.dispose();
    assert.equal(renderer.isInitialized, false);
    assert.equal(renderer.isDisposed, true);
    assert.equal(mount.children.length, 0);
    assert.equal(getStats().disposeCount, 1);

    // Re-initialize after dispose
    const reinitialized = renderer.init(mount, snapshot);
    assert.equal(reinitialized, true);
    assert.equal(renderer.isInitialized, true);
    assert.equal(mount.children.length, 1);
    renderer.dispose();
});

test('Battle3DRenderer fails gracefully when WebGL is unavailable', () => {
    let reportedError = null;
    const renderer = new Battle3DRenderer({
        onError: (msg) => {
            reportedError = msg;
        }
    });

    const mount = { clientWidth: 800, clientHeight: 600, innerHTML: '', appendChild() {} };
    const result = renderer.init(mount, null);
    assert.equal(result, false);
    assert.equal(renderer.isInitialized, false);
    assert.ok(typeof reportedError === 'string' && reportedError.length > 0);
});