import * as THREE from 'three';

/**
 * RTSCamera3D
 * High-angled, damped 3D RTS camera controller for Fall of Cavalry (G3D-02A-R1).
 * Supports smooth panning, yaw orbit, pitch tilt, zoom clamping, and read-only
 * boundary clamping derived from ActiveSector3DViewModel soldier positions.
 */
export class RTSCamera3D {
    /**
     * @param {Object} options
     * @param {number} [options.aspect=1]
     * @param {Function|null} [options.onUpdate=null]
     */
    constructor(options = {}) {
        const aspect = Number.isFinite(options.aspect) && options.aspect > 0 ? options.aspect : 1;
        this.onUpdate = typeof options.onUpdate === 'function' ? options.onUpdate : null;

        this.camera = new THREE.PerspectiveCamera(42, aspect, 0.5, 340);

        this.bounds = {
            minX: -55,
            maxX: 55,
            minZ: -55,
            maxZ: 55
        };

        this.defaultTarget = { x: 0, z: 0 };

        this.limits = {
            minDistance: 16,
            maxDistance: 92,
            minPitch: 0.48,
            maxPitch: 1.24
        };

        this.current = {
            targetX: 0,
            targetZ: 0,
            distance: 46,
            yaw: 0.0,
            pitch: 0.88 // ~50 deg elevated tactical angle
        };

        this.desired = { ...this.current };
        this.syncTransform(1);
    }

    /**
     * Updates camera pan boundaries and optional focus target without mutating inputs.
     * @param {{minX:number, maxX:number, minZ:number, maxZ:number}} bounds
     * @param {{x:number, z:number}|null} [target=null]
     * @param {boolean} [snap=false]
     */
    setBoundsAndTarget(bounds, target = null, snap = false) {
        if (bounds) {
            this.bounds = {
                minX: Number.isFinite(bounds.minX) ? bounds.minX : -55,
                maxX: Number.isFinite(bounds.maxX) ? bounds.maxX : 55,
                minZ: Number.isFinite(bounds.minZ) ? bounds.minZ : -55,
                maxZ: Number.isFinite(bounds.maxZ) ? bounds.maxZ : 55
            };
        }

        if (target && Number.isFinite(target.x) && Number.isFinite(target.z)) {
            this.defaultTarget = {
                x: this._clamp(target.x, this.bounds.minX, this.bounds.maxX),
                z: this._clamp(target.z, this.bounds.minZ, this.bounds.maxZ)
            };
            this.desired.targetX = this.defaultTarget.x;
            this.desired.targetZ = this.defaultTarget.z;
        } else {
            this.desired.targetX = this._clamp(this.desired.targetX, this.bounds.minX, this.bounds.maxX);
            this.desired.targetZ = this._clamp(this.desired.targetZ, this.bounds.minZ, this.bounds.maxZ);
        }

        if (snap) {
            this.current.targetX = this.desired.targetX;
            this.current.targetZ = this.desired.targetZ;
            this.syncTransform(1);
        }
    }

    /**
     * Smoothly resets camera focus to the active sector's derived target center.
     */
    focusOnDefaultTarget() {
        this.desired.targetX = this._clamp(this.defaultTarget.x, this.bounds.minX, this.bounds.maxX);
        this.desired.targetZ = this._clamp(this.defaultTarget.z, this.bounds.minZ, this.bounds.maxZ);
        this.desired.distance = 46;
        this.desired.yaw = 0;
        this.desired.pitch = 0.88;
    }

    /**
     * Pans camera target in world XZ space relative to current camera yaw.
     * @param {number} forwardDelta
     * @param {number} rightDelta
     */
    panRelative(forwardDelta, rightDelta) {
        const forwardX = -Math.sin(this.current.yaw);
        const forwardZ = -Math.cos(this.current.yaw);
        const rightX = Math.cos(this.current.yaw);
        const rightZ = -Math.sin(this.current.yaw);

        this.desired.targetX += forwardX * forwardDelta + rightX * rightDelta;
        this.desired.targetZ += forwardZ * forwardDelta + rightZ * rightDelta;
        this._clampDesired();
    }

    /**
     * Pans camera target using screen-space pointer drag deltas.
     * @param {number} dx
     * @param {number} dy
     */
    panByScreenDelta(dx, dy) {
        const scale = this.current.distance * 0.0019;
        const cosY = Math.cos(this.current.yaw);
        const sinY = Math.sin(this.current.yaw);
        this.desired.targetX -= (dx * cosY + dy * sinY) * scale;
        this.desired.targetZ -= (-dx * sinY + dy * cosY) * scale;
        this._clampDesired();
    }

    /**
     * Rotates camera yaw and optionally adjusts tactical pitch angle.
     * @param {number} deltaYaw
     * @param {number} [deltaPitch=0]
     */
    rotateBy(deltaYaw, deltaPitch = 0) {
        this.desired.yaw += deltaYaw;
        this.desired.pitch += deltaPitch;
        this._clampDesired();
    }

    /**
     * Adjusts zoom distance within configured tactical limits.
     * @param {number} deltaDistance
     */
    zoomBy(deltaDistance) {
        this.desired.distance += deltaDistance;
        this._clampDesired();
    }

    /**
     * Updates camera aspect ratio on viewport resize.
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
        const safeW = Math.max(1, width);
        const safeH = Math.max(1, height);
        this.camera.aspect = safeW / safeH;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Applies exponential damping and updates Three.js camera position & lookAt.
     * @param {number} dt Delta time in seconds (pass >= 1 for immediate snap)
     */
    syncTransform(dt) {
        this._clampDesired();
        const smooth = dt >= 1 ? 1 : (1 - Math.exp(-10 * Math.max(0.001, dt)));

        this.current.targetX += (this.desired.targetX - this.current.targetX) * smooth;
        this.current.targetZ += (this.desired.targetZ - this.current.targetZ) * smooth;
        this.current.distance += (this.desired.distance - this.current.distance) * smooth;
        this.current.yaw += (this.desired.yaw - this.current.yaw) * smooth;
        this.current.pitch += (this.desired.pitch - this.current.pitch) * smooth;

        const horizDist = Math.cos(this.current.pitch) * this.current.distance;
        const vertDist = Math.sin(this.current.pitch) * this.current.distance;

        this.camera.position.set(
            this.current.targetX + Math.sin(this.current.yaw) * horizDist,
            vertDist,
            this.current.targetZ + Math.cos(this.current.yaw) * horizDist
        );
        this.camera.lookAt(this.current.targetX, 0, this.current.targetZ);

        if (this.onUpdate) {
            this.onUpdate({
                targetX: this.current.targetX,
                targetZ: this.current.targetZ,
                distance: this.current.distance,
                yaw: this.current.yaw,
                pitch: this.current.pitch
            });
        }
    }

    _clampDesired() {
        this.desired.targetX = this._clamp(this.desired.targetX, this.bounds.minX, this.bounds.maxX);
        this.desired.targetZ = this._clamp(this.desired.targetZ, this.bounds.minZ, this.bounds.maxZ);
        this.desired.distance = this._clamp(this.desired.distance, this.limits.minDistance, this.limits.maxDistance);
        this.desired.pitch = this._clamp(this.desired.pitch, this.limits.minPitch, this.limits.maxPitch);
    }

    _clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }
}