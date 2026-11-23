import * as THREE from 'three';
import { RTSCamera3D } from './RTSCamera3D.js';

export const DEFAULT_SECTOR_BOUNDS = Object.freeze({
    minX: -55,
    maxX: 55,
    minZ: -55,
    maxZ: 55
});

/**
 * Pure, read-only derivation of 3D camera bounds, focus target, and unit telemetry
 * from the real G3D-01 ActiveSector3DViewModel snapshot schema:
 * {
 *   sectorId, soldiers: [{ side, groupId, position: { x, y, z }, ... }],
 *   limits, visible, hiddenAlive, dataAuthority
 * }
 * Never mutates the input snapshot or expects non-existent fields like snapshot.bounds.
 *
 * @param {Object|null|undefined} snapshot
 * @returns {{
 *   isEmpty: boolean,
 *   sectorId: string,
 *   bounds: {minX:number, maxX:number, minZ:number, maxZ:number},
 *   cameraTarget: {x:number, z:number},
 *   uniqueGroupCount: number,
 *   playerCount: number,
 *   enemyCount: number,
 *   totalVisible: number,
 *   hiddenAlive: {player:number, enemy:number},
 *   limits: {player:number, enemy:number},
 *   dataAuthority: string
 * }}
 */
export function deriveSectorViewBounds(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return {
            isEmpty: true,
            sectorId: 'BOS_SEKTOR',
            bounds: { ...DEFAULT_SECTOR_BOUNDS },
            cameraTarget: { x: 0, z: 0 },
            uniqueGroupCount: 0,
            playerCount: 0,
            enemyCount: 0,
            totalVisible: 0,
            hiddenAlive: { player: 0, enemy: 0 },
            limits: { player: 150, enemy: 150 },
            dataAuthority: 'none'
        };
    }

    const soldiers = Array.isArray(snapshot.soldiers) ? snapshot.soldiers : [];
    const uniqueGroups = new Set();

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let sumX = 0;
    let sumZ = 0;
    let validPosCount = 0;
    let countedPlayer = 0;
    let countedEnemy = 0;

    for (let i = 0; i < soldiers.length; i++) {
        const s = soldiers[i];
        if (!s || typeof s !== 'object') continue;

        if (s.groupId !== null && s.groupId !== undefined && s.groupId !== '') {
            uniqueGroups.add(s.groupId);
        }

        if (s.side === 'player') {
            countedPlayer++;
        } else if (s.side === 'enemy') {
            countedEnemy++;
        }

        const pos = s.position;
        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.z)) {
            if (pos.x < minX) minX = pos.x;
            if (pos.x > maxX) maxX = pos.x;
            if (pos.z < minZ) minZ = pos.z;
            if (pos.z > maxZ) maxZ = pos.z;
            sumX += pos.x;
            sumZ += pos.z;
            validPosCount++;
        }
    }

    const playerCount = snapshot.visible && Number.isFinite(snapshot.visible.player)
        ? snapshot.visible.player
        : countedPlayer;
    const enemyCount = snapshot.visible && Number.isFinite(snapshot.visible.enemy)
        ? snapshot.visible.enemy
        : countedEnemy;

    const isEmpty = validPosCount === 0 && (playerCount + enemyCount) === 0;

    let bounds = { ...DEFAULT_SECTOR_BOUNDS };
    let cameraTarget = { x: 0, z: 0 };

    if (validPosCount > 0) {
        const centerX = sumX / validPosCount;
        const centerZ = sumZ / validPosCount;
        const padding = 24;
        const minHalfSpan = 45;

        const rawHalfX = Math.max(minHalfSpan, ((maxX - minX) * 0.5) + padding);
        const rawHalfZ = Math.max(minHalfSpan, ((maxZ - minZ) * 0.5) + padding);

        bounds = {
            minX: Math.round((centerX - rawHalfX) * 10) / 10,
            maxX: Math.round((centerX + rawHalfX) * 10) / 10,
            minZ: Math.round((centerZ - rawHalfZ) * 10) / 10,
            maxZ: Math.round((centerZ + rawHalfZ) * 10) / 10
        };
        cameraTarget = { x: centerX, z: centerZ };
    }

    return {
        isEmpty,
        sectorId: snapshot.sectorId ? String(snapshot.sectorId) : 'BOS_SEKTOR',
        bounds,
        cameraTarget,
        uniqueGroupCount: uniqueGroups.size,
        playerCount,
        enemyCount,
        totalVisible: playerCount + enemyCount,
        hiddenAlive: {
            player: snapshot.hiddenAlive && Number.isFinite(snapshot.hiddenAlive.player) ? snapshot.hiddenAlive.player : 0,
            enemy: snapshot.hiddenAlive && Number.isFinite(snapshot.hiddenAlive.enemy) ? snapshot.hiddenAlive.enemy : 0
        },
        limits: {
            player: snapshot.limits && Number.isFinite(snapshot.limits.player) ? snapshot.limits.player : 150,
            enemy: snapshot.limits && Number.isFinite(snapshot.limits.enemy) ? snapshot.limits.enemy : 150
        },
        dataAuthority: typeof snapshot.dataAuthority === 'string' ? snapshot.dataAuthority : 'existing_battle_simulation'
    };
}

/**
 * Battle3DRenderer (G3D-02A-R1)
 * Modular Three.js battlefield foundation for Fall of Cavalry:
 * - Natural 1650 open-field terrain with procedural albedo & bump maps
 * - Measured 1650 daylight, soft shadows, and atmospheric distance fog
 * - High-angled damped RTSCamera3D clamped to derived sector bounds
 * - Strict read-only sync(snapshot) connected to ActiveSector3DViewModel
 * - Idempotent dispose() with complete GPU resource & listener cleanup
 */
export class Battle3DRenderer {
    /**
     * @param {Object} [options]
     * @param {Function|null} [options.onCameraUpdate=null]
     * @param {Function|null} [options.onError=null]
     * @param {Function|null} [options.rendererFactory=null] Optional DI factory for headless unit tests
     */
    constructor(options = {}) {
        this.onCameraUpdate = typeof options.onCameraUpdate === 'function' ? options.onCameraUpdate : null;
        this.onError = typeof options.onError === 'function' ? options.onError : null;
        this.rendererFactory = typeof options.rendererFactory === 'function' ? options.rendererFactory : null;

        this.mount = null;
        this.isInitialized = false;
        this.isDisposed = false;
        this.rafId = null;
        this.lastTimestamp = 0;

        this.scene = null;
        this.cameraController = null;
        this.renderer = null;
        this.resizeObserver = null;
        this.sectorFrameGroup = null;
        this.derivedSummary = deriveSectorViewBounds(null);

        this.disposables = {
            geometries: [],
            materials: [],
            textures: []
        };

        this.input = {
            keys: {},
            isPanning: false,
            isOrbiting: false,
            lastX: 0,
            lastY: 0,
            touchLastX: 0,
            touchLastY: 0,
            pinchDist: 0
        };

        this._boundAnimate = this._animate.bind(this);
        this._boundResize = this.resize.bind(this);
        this._boundKeyDown = this._onKeyDown.bind(this);
        this._boundKeyUp = this._onKeyUp.bind(this);
        this._boundMouseDown = this._onMouseDown.bind(this);
        this._boundMouseMove = this._onMouseMove.bind(this);
        this._boundMouseUp = this._onMouseUp.bind(this);
        this._boundWheel = this._onWheel.bind(this);
        this._boundTouchStart = this._onTouchStart.bind(this);
        this._boundTouchMove = this._onTouchMove.bind(this);
        this._boundTouchEnd = this._onTouchEnd.bind(this);
    }

    /**
     * Safely checks whether WebGL is available in the current browser environment.
     * @returns {boolean}
     */
    static isWebGLAvailable() {
        try {
            if (typeof document === 'undefined') return false;
            const testCanvas = document.createElement('canvas');
            return Boolean(
                typeof window !== 'undefined' &&
                window.WebGLRenderingContext &&
                (testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl'))
            );
        } catch (err) {
            return false;
        }
    }

    /**
     * Initializes the Three.js scene, terrain, lighting, camera, and input bindings.
     * @param {HTMLElement} mountElement
     * @param {Object|null} [initialSnapshot=null]
     * @returns {boolean}
     */
    init(mountElement, initialSnapshot = null) {
        if (this.isInitialized) return true;

        if (!mountElement) {
            this._reportError('3D sahne bağlama öğesi (mount) bulunamadı.');
            return false;
        }

        if (!this.rendererFactory && !Battle3DRenderer.isWebGLAvailable()) {
            this._reportError('Tarayıcı veya cihaz WebGL desteği sağlamıyor.');
            return false;
        }

        try {
            this.mount = mountElement;
            this.isDisposed = false;

            const width = Math.max(1, this.mount.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800));
            const height = Math.max(1, this.mount.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 600));

            // 1. Scene & 1650 Atmospheric Depth Fog
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x9fb4c7);
            this.scene.fog = new THREE.FogExp2(0xa7bac9, 0.0052);

            // 2. High-Angled Damped RTS Camera
            this.cameraController = new RTSCamera3D({
                aspect: width / height,
                onUpdate: this.onCameraUpdate
            });

            // 3. WebGLRenderer (or injected headless test renderer)
            if (this.rendererFactory) {
                this.renderer = this.rendererFactory({ width, height });
            } else {
                this.renderer = new THREE.WebGLRenderer({
                    antialias: true,
                    powerPreference: 'high-performance'
                });
                this.renderer.setSize(width, height);
                this.renderer.setPixelRatio(Math.min((typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1, 2));
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                if ('outputColorSpace' in this.renderer && THREE.SRGBColorSpace) {
                    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
                } else if ('outputEncoding' in this.renderer && THREE.sRGBEncoding) {
                    this.renderer.outputEncoding = THREE.sRGBEncoding;
                }
            }

            if (this.renderer && this.renderer.domElement) {
                this.mount.innerHTML = '';
                this.mount.appendChild(this.renderer.domElement);
            }

            // 4. Lighting, Temporary 1650 Open Battlefield Terrain & Sector Boundary Frame
            this._setupLighting();
            this._buildTemporary1650Terrain();
            this._buildSectorBoundaryFrame();

            // 5. Sync initial ActiveSector3DViewModel snapshot
            this.sync(initialSnapshot, { snapCamera: true });

            // 6. Bind Lifecycle & Input Listeners
            this._bindEvents();

            this.isInitialized = true;
            this.lastTimestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (typeof requestAnimationFrame === 'function') {
                this.rafId = requestAnimationFrame(this._boundAnimate);
            }
            return true;
        } catch (err) {
            this.dispose();
            this._reportError(`WebGL sahnesi başlatılamadı: ${err.message}`);
            return false;
        }
    }

    /**
     * Reads an ActiveSector3DViewModel snapshot without mutating it, derives camera
     * boundaries and target from soldiers[].position, and updates the ground frame.
     *
     * @param {Object|null|undefined} snapshot
     * @param {{snapCamera?: boolean}} [options={}]
     * @returns {Object} Derived read-only view summary
     */
    sync(snapshot, options = {}) {
        const derived = deriveSectorViewBounds(snapshot);
        this.derivedSummary = derived;

        const width = Math.max(20, derived.bounds.maxX - derived.bounds.minX);
        const depth = Math.max(20, derived.bounds.maxZ - derived.bounds.minZ);
        const centerX = (derived.bounds.minX + derived.bounds.maxX) * 0.5;
        const centerZ = (derived.bounds.minZ + derived.bounds.maxZ) * 0.5;

        if (this.sectorFrameGroup) {
            this.sectorFrameGroup.position.set(centerX, 0, centerZ);
            this.sectorFrameGroup.scale.set(width, 1, depth);
        }

        if (this.cameraController) {
            this.cameraController.setBoundsAndTarget(
                derived.bounds,
                derived.cameraTarget,
                Boolean(options.snapCamera)
            );
        }

        return derived;
    }

    /**
     * Focuses camera smoothly back on the active sector's derived target.
     */
    focusOnSectorCenter() {
        if (this.cameraController) {
            this.cameraController.focusOnDefaultTarget();
        }
    }

    /**
     * Rotates camera yaw by delta radians.
     * @param {number} deltaYaw
     */
    rotateBy(deltaYaw) {
        if (this.cameraController) {
            this.cameraController.rotateBy(deltaYaw, 0);
        }
    }

    /**
     * Zooms camera distance by delta meters.
     * @param {number} deltaDistance
     */
    zoomBy(deltaDistance) {
        if (this.cameraController) {
            this.cameraController.zoomBy(deltaDistance);
        }
    }

    /**
     * Handles viewport or mount container resize cleanly.
     */
    resize() {
        if (!this.isInitialized || this.isDisposed || !this.renderer || !this.cameraController || !this.mount) {
            return;
        }
        const width = Math.max(1, this.mount.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800));
        const height = Math.max(1, this.mount.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 600));
        this.cameraController.resize(width, height);
        this.renderer.setSize(width, height);
    }

    _setupLighting() {
        const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x4b5335, 0.72);
        hemiLight.position.set(0, 60, 0);
        this.scene.add(hemiLight);

        const sunLight = new THREE.DirectionalLight(0xfff4dc, 1.15);
        sunLight.position.set(-42, 68, 36);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 190;
        const shadowExtent = 75;
        sunLight.shadow.camera.left = -shadowExtent;
        sunLight.shadow.camera.right = shadowExtent;
        sunLight.shadow.camera.top = shadowExtent;
        sunLight.shadow.camera.bottom = -shadowExtent;
        sunLight.shadow.bias = -0.0005;
        this.scene.add(sunLight);

        const skyFill = new THREE.DirectionalLight(0xbfdbfe, 0.28);
        skyFill.position.set(45, 30, -40);
        this.scene.add(skyFill);
    }

    _createBattlefieldTextures() {
        if (typeof document === 'undefined') {
            return { albedo: null, bump: null };
        }
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const bumpCanvas = document.createElement('canvas');
        bumpCanvas.width = size;
        bumpCanvas.height = size;
        const bCtx = bumpCanvas.getContext('2d');

        if (!ctx || !bCtx) {
            return { albedo: null, bump: null };
        }

        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, size, size);

        // Muted, natural 1650 meadow olive & earth palette
        const grad = ctx.createRadialGradient(size * 0.5, size * 0.5, 60, size * 0.5, size * 0.5, size * 0.72);
        grad.addColorStop(0, '#5a6b43');
        grad.addColorStop(0.6, '#4d5d39');
        grad.addColorStop(1, '#3e4c2e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        // Organic soil & grass variation patches
        for (let i = 0; i < 650; i++) {
            const x = ((i * 197) % size);
            const y = ((i * 353) % size);
            const r = 14 + (i % 38);
            ctx.fillStyle = i % 3 === 0
                ? 'rgba(116, 102, 72, 0.14)'
                : (i % 3 === 1 ? 'rgba(66, 82, 47, 0.18)' : 'rgba(118, 134, 84, 0.12)');
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Subtle trampled dirt track across the open field
        ctx.strokeStyle = 'rgba(112, 95, 68, 0.42)';
        ctx.lineWidth = 44;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(size * 0.08, size * 0.82);
        ctx.quadraticCurveTo(size * 0.5, size * 0.48, size * 0.92, size * 0.22);
        ctx.stroke();

        // Fine soil grain & short grass texture
        for (let i = 0; i < 4500; i++) {
            const x = (i * 73) % size;
            const y = (i * 139) % size;
            ctx.fillStyle = i % 2 === 0 ? 'rgba(42, 50, 32, 0.22)' : 'rgba(138, 150, 104, 0.16)';
            ctx.fillRect(x, y, 2, 3);
            bCtx.fillStyle = i % 2 === 0 ? '#747474' : '#8c8c8c';
            bCtx.fillRect(x, y, 2, 2);
        }

        const albedo = new THREE.CanvasTexture(canvas);
        if ('colorSpace' in albedo && THREE.SRGBColorSpace) {
            albedo.colorSpace = THREE.SRGBColorSpace;
        } else if ('encoding' in albedo && THREE.sRGBEncoding) {
            albedo.encoding = THREE.sRGBEncoding;
        }
        albedo.anisotropy = 8;

        const bump = new THREE.CanvasTexture(bumpCanvas);
        bump.anisotropy = 4;

        this.disposables.textures.push(albedo, bump);
        return { albedo, bump };
    }

    _buildTemporary1650Terrain() {
        const terrainSpan = 240;
        const geo = new THREE.PlaneGeometry(terrainSpan, terrainSpan, 64, 64);
        geo.rotateX(-Math.PI / 2);

        // Keep central battle zone completely flat & readable; gentle distant horizon hills only
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vz = pos.getZ(i);
            const dist = Math.hypot(vx, vz);
            if (dist > 68) {
                const t = Math.min(1, (dist - 68) / 48);
                const rolling = (Math.sin(vx * 0.07) * Math.cos(vz * 0.07) + 1) * 2.2 * t * t;
                pos.setY(i, rolling);
            }
        }
        geo.computeVertexNormals();

        const { albedo, bump } = this._createBattlefieldTextures();
        const matOptions = {
            roughness: 0.9,
            metalness: 0.02,
            color: albedo ? 0xffffff : 0x4d5d39
        };
        if (albedo) matOptions.map = albedo;
        if (bump) {
            matOptions.bumpMap = bump;
            matOptions.bumpScale = 0.18;
        }

        const mat = new THREE.MeshStandardMaterial(matOptions);
        this.disposables.geometries.push(geo);
        this.disposables.materials.push(mat);

        const groundMesh = new THREE.Mesh(geo, mat);
        groundMesh.receiveShadow = true;
        this.scene.add(groundMesh);

        // Subtle tactical spatial reference grid
        const gridHelper = new THREE.GridHelper(110, 22, 0x8c8574, 0x6b6859);
        gridHelper.position.y = 0.03;
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.15;
        this.scene.add(gridHelper);
        this.disposables.geometries.push(gridHelper.geometry);
        this.disposables.materials.push(gridHelper.material);
    }

    _buildSectorBoundaryFrame() {
        this.sectorFrameGroup = new THREE.Group();
        const lineMat = new THREE.LineBasicMaterial({
            color: 0xd6c38b,
            transparent: true,
            opacity: 0.58
        });
        const pts = [
            new THREE.Vector3(-0.5, 0.06, -0.5),
            new THREE.Vector3(0.5, 0.06, -0.5),
            new THREE.Vector3(0.5, 0.06, 0.5),
            new THREE.Vector3(-0.5, 0.06, 0.5),
            new THREE.Vector3(-0.5, 0.06, -0.5)
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const loop = new THREE.Line(geo, lineMat);
        this.sectorFrameGroup.add(loop);
        this.scene.add(this.sectorFrameGroup);

        this.disposables.geometries.push(geo);
        this.disposables.materials.push(lineMat);
    }

    _animate(now) {
        if (!this.isInitialized || this.isDisposed) return;
        this.rafId = requestAnimationFrame(this._boundAnimate);

        const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTimestamp) / 1000));
        this.lastTimestamp = now;

        this._updateKeyboardNavigation(dt);
        if (this.cameraController) {
            this.cameraController.syncTransform(dt);
        }

        if (this.renderer && this.scene && this.cameraController) {
            this.renderer.render(this.scene, this.cameraController.camera);
        }
    }

    _updateKeyboardNavigation(dt) {
        if (!this.cameraController) return;

        const panSpeed = (22 + this.cameraController.current.distance * 0.55) * dt;
        let forward = 0;
        let right = 0;

        if (this.input.keys['KeyW'] || this.input.keys['ArrowUp']) forward += panSpeed;
        if (this.input.keys['KeyS'] || this.input.keys['ArrowDown']) forward -= panSpeed;
        if (this.input.keys['KeyA'] || this.input.keys['ArrowLeft']) right -= panSpeed;
        if (this.input.keys['KeyD'] || this.input.keys['ArrowRight']) right += panSpeed;

        if (forward !== 0 || right !== 0) {
            this.cameraController.panRelative(forward, right);
        }

        if (this.input.keys['KeyQ']) {
            this.cameraController.rotateBy(-1.35 * dt, 0);
        }
        if (this.input.keys['KeyE']) {
            this.cameraController.rotateBy(1.35 * dt, 0);
        }
    }

    _isFocusInUIControl() {
        if (typeof document === 'undefined' || !document.activeElement) return false;
        const tag = document.activeElement.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON';
    }

    _bindEvents() {
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this._boundResize);
            window.addEventListener('keydown', this._boundKeyDown);
            window.addEventListener('keyup', this._boundKeyUp);
            window.addEventListener('mousemove', this._boundMouseMove);
            window.addEventListener('mouseup', this._boundMouseUp);
        }

        if (this.renderer && this.renderer.domElement && typeof this.renderer.domElement.addEventListener === 'function') {
            const dom = this.renderer.domElement;
            dom.addEventListener('mousedown', this._boundMouseDown);
            dom.addEventListener('wheel', this._boundWheel, { passive: false });
            dom.addEventListener('touchstart', this._boundTouchStart, { passive: true });
            dom.addEventListener('touchmove', this._boundTouchMove, { passive: false });
            dom.addEventListener('touchend', this._boundTouchEnd);
        }

        if (typeof ResizeObserver !== 'undefined' && this.mount) {
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(this.mount);
        }
    }

    _unbindEvents() {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this._boundResize);
            window.removeEventListener('keydown', this._boundKeyDown);
            window.removeEventListener('keyup', this._boundKeyUp);
            window.removeEventListener('mousemove', this._boundMouseMove);
            window.removeEventListener('mouseup', this._boundMouseUp);
        }

        if (this.renderer && this.renderer.domElement && typeof this.renderer.domElement.removeEventListener === 'function') {
            const dom = this.renderer.domElement;
            dom.removeEventListener('mousedown', this._boundMouseDown);
            dom.removeEventListener('wheel', this._boundWheel);
            dom.removeEventListener('touchstart', this._boundTouchStart);
            dom.removeEventListener('touchmove', this._boundTouchMove);
            dom.removeEventListener('touchend', this._boundTouchEnd);
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }

    _onKeyDown(e) {
        if (this._isFocusInUIControl()) return;
        this.input.keys[e.code] = true;
        if (e.code === 'Space') {
            e.preventDefault();
            this.focusOnSectorCenter();
        }
    }

    _onKeyUp(e) {
        this.input.keys[e.code] = false;
    }

    _onMouseDown(e) {
        if (typeof document !== 'undefined' && document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        if (e.button === 2 || (e.button === 0 && !e.shiftKey)) {
            this.input.isPanning = true;
            this.input.lastX = e.clientX;
            this.input.lastY = e.clientY;
        } else if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            this.input.isOrbiting = true;
            this.input.lastX = e.clientX;
            this.input.lastY = e.clientY;
        }
    }

    _onMouseMove(e) {
        if ((!this.input.isPanning && !this.input.isOrbiting) || !this.cameraController) return;
        const dx = e.clientX - this.input.lastX;
        const dy = e.clientY - this.input.lastY;
        this.input.lastX = e.clientX;
        this.input.lastY = e.clientY;

        if (this.input.isPanning) {
            this.cameraController.panByScreenDelta(dx, dy);
        } else if (this.input.isOrbiting) {
            this.cameraController.rotateBy(-dx * 0.0065, dy * 0.0045);
        }
    }

    _onMouseUp() {
        this.input.isPanning = false;
        this.input.isOrbiting = false;
    }

    _onWheel(e) {
        e.preventDefault();
        this.zoomBy(e.deltaY * 0.025);
    }

    _onTouchStart(e) {
        if (e.touches.length === 1) {
            this.input.touchLastX = e.touches[0].clientX;
            this.input.touchLastY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            this.input.pinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }

    _onTouchMove(e) {
        if (!this.cameraController) return;
        if (e.touches.length === 1) {
            const dx = e.touches[0].clientX - this.input.touchLastX;
            const dy = e.touches[0].clientY - this.input.touchLastY;
            this.input.touchLastX = e.touches[0].clientX;
            this.input.touchLastY = e.touches[0].clientY;
            this.cameraController.panByScreenDelta(dx, dy);
        } else if (e.touches.length === 2) {
            e.preventDefault();
            const newDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const delta = this.input.pinchDist - newDist;
            this.input.pinchDist = newDist;
            this.zoomBy(delta * 0.08);
        }
    }

    _onTouchEnd() {
        this.input.pinchDist = 0;
    }

    _reportError(message) {
        if (this.onError) {
            this.onError(message);
        }
    }

    /**
     * Idempotent cleanup: cancels animation frame, removes listeners, and disposes
     * all Three.js geometries, materials, textures, and WebGL context.
     */
    dispose() {
        if (this.isDisposed && !this.isInitialized) return;

        if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        this._unbindEvents();
        this.input.keys = {};
        this.input.isPanning = false;
        this.input.isOrbiting = false;

        this.disposables.geometries.forEach((g) => {
            if (g && typeof g.dispose === 'function') g.dispose();
        });
        this.disposables.materials.forEach((m) => {
            if (m && typeof m.dispose === 'function') m.dispose();
        });
        this.disposables.textures.forEach((t) => {
            if (t && typeof t.dispose === 'function') t.dispose();
        });
        this.disposables = { geometries: [], materials: [], textures: [] };

        if (this.renderer) {
            if (typeof this.renderer.dispose === 'function') {
                this.renderer.dispose();
            }
            if (typeof this.renderer.forceContextLoss === 'function') {
                try {
                    this.renderer.forceContextLoss();
                } catch (err) {
                    // Safe ignore if context was already released
                }
            }
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
            this.renderer = null;
        }

        this.scene = null;
        this.cameraController = null;
        this.sectorFrameGroup = null;
        this.mount = null;
        this.isInitialized = false;
        this.isDisposed = true;
    }
}