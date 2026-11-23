import * as TestBattleDataModule from '../battle/data/testBattleData.js';
import * as SectorManagerModule from '../managers/SectorManager.js';
import { projectActiveSector3D } from './ActiveSector3DViewModel.js';
import { Battle3DRenderer } from './Battle3DRenderer.js';

const createTestBattleData = TestBattleDataModule.createTestBattleData || TestBattleDataModule.default;
const SectorManager = SectorManagerModule.SectorManager || SectorManagerModule.default;

/**
 * Builds a real SectorManager instance populated via createTestBattleData()
 * or an empty SectorManager for edge-case verification, without touching
 * campaign saves or live 2D battle state.
 *
 * @param {'test'|'empty'} mode
 * @returns {Object|null}
 */
function buildPreviewSectorManager(mode) {
    if (mode === 'empty') {
        if (typeof SectorManager === 'function') {
            return new SectorManager();
        }
        return null;
    }

    if (typeof createTestBattleData !== 'function' || typeof SectorManager !== 'function') {
        throw new Error('Proje modülleri (createTestBattleData / SectorManager) yüklenemedi.');
    }

    const testBattleData = createTestBattleData();
    const sectorManager = new SectorManager(testBattleData);

    // Support both constructor-initialized and explicit loader APIs in SectorManager
    if (typeof sectorManager.getActiveSector === 'function' && !sectorManager.getActiveSector()) {
        if (typeof sectorManager.loadBattleData === 'function') {
            sectorManager.loadBattleData(testBattleData);
        } else if (typeof sectorManager.setBattleData === 'function') {
            sectorManager.setBattleData(testBattleData);
        } else if (typeof sectorManager.init === 'function') {
            sectorManager.init(testBattleData);
        }
    }

    return sectorManager;
}

class Battle3DPreviewController {
    constructor() {
        this.renderer = null;
        this.currentMode = 'test';

        this.dom = {
            mount: document.getElementById('battle3dMount'),
            fallbackScreen: document.getElementById('fallbackScreen'),
            fallbackIcon: document.getElementById('fallbackIcon'),
            fallbackTitle: document.getElementById('fallbackTitle'),
            fallbackMessage: document.getElementById('fallbackMessage'),
            btnModeTest: document.getElementById('btnModeTest'),
            btnModeEmpty: document.getElementById('btnModeEmpty'),
            btnModeNoWebGL: document.getElementById('btnModeNoWebGL'),
            btnDispose: document.getElementById('btnDispose'),
            btnReinit: document.getElementById('btnReinit'),
            btnRotLeft: document.getElementById('btnRotLeft'),
            btnRotRight: document.getElementById('btnRotRight'),
            btnZoomIn: document.getElementById('btnZoomIn'),
            btnZoomOut: document.getElementById('btnZoomOut'),
            btnFocus: document.getElementById('btnFocus'),
            dataSourceBadge: document.getElementById('dataSourceBadge'),
            vmSectorId: document.getElementById('vmSectorId'),
            vmSectorBounds: document.getElementById('vmSectorBounds'),
            vmGroupCount: document.getElementById('vmGroupCount'),
            vmSoldierCount: document.getElementById('vmSoldierCount'),
            vmLimits: document.getElementById('vmLimits'),
            lifecycleStatus: document.getElementById('lifecycleStatus'),
            cameraTelemetry: document.getElementById('cameraTelemetry')
        };
    }

    init() {
        this._bindUIEvents();
        this.startScene();
    }

    _bindUIEvents() {
        this.dom.btnModeTest?.addEventListener('click', () => this.applyDataMode('test'));
        this.dom.btnModeEmpty?.addEventListener('click', () => this.applyDataMode('empty'));
        this.dom.btnModeNoWebGL?.addEventListener('click', () => this.simulateNoWebGL());
        this.dom.btnDispose?.addEventListener('click', () => this.disposeScene());
        this.dom.btnReinit?.addEventListener('click', () => this.startScene());

        this.dom.btnRotLeft?.addEventListener('click', () => this.renderer?.rotateBy(-0.35));
        this.dom.btnRotRight?.addEventListener('click', () => this.renderer?.rotateBy(0.35));
        this.dom.btnZoomIn?.addEventListener('click', () => this.renderer?.zoomBy(-6));
        this.dom.btnZoomOut?.addEventListener('click', () => this.renderer?.zoomBy(6));
        this.dom.btnFocus?.addEventListener('click', () => this.renderer?.focusOnSectorCenter());
    }

    _getSnapshotForCurrentMode() {
        const sectorManager = buildPreviewSectorManager(this.currentMode);
        return projectActiveSector3D(sectorManager);
    }

    applyDataMode(mode) {
        this.currentMode = mode;
        this.dom.btnModeTest?.classList.toggle('active', mode === 'test');
        this.dom.btnModeEmpty?.classList.toggle('active', mode === 'empty');

        try {
            const snapshot = this._getSnapshotForCurrentMode();
            if (this.renderer && this.renderer.isInitialized) {
                const derived = this.renderer.sync(snapshot, { snapCamera: true });
                this._updateHUD(derived);
            }
        } catch (err) {
            this._showFallback('⚠️', 'Veri Projeksiyon Hatası', err.message);
        }
    }

    startScene() {
        this._hideFallback();

        if (this.renderer) {
            this.renderer.dispose();
        }

        let initialSnapshot = null;
        try {
            initialSnapshot = this._getSnapshotForCurrentMode();
        } catch (err) {
            this._setLifecycleStatus('VERİ HATASI', 'status-warn');
            this._showFallback('⚠️', 'Sektör Verisi Okunamadı', err.message);
            return;
        }

        this.renderer = new Battle3DRenderer({
            onCameraUpdate: ({ targetX, targetZ, distance }) => {
                if (this.dom.cameraTelemetry) {
                    this.dom.cameraTelemetry.textContent = `${targetX.toFixed(1)}, ${targetZ.toFixed(1)} | D:${distance.toFixed(0)}`;
                }
            },
            onError: (errMsg) => {
                this._setLifecycleStatus('WEBGL DEVRE DIŞI', 'status-warn');
                this._showFallback('⚠️', 'WebGL Desteklenmiyor veya Başlatılamadı', errMsg);
            }
        });

        const ok = this.renderer.init(this.dom.mount, initialSnapshot);
        if (ok) {
            this._updateHUD(this.renderer.derivedSummary);
            this._setLifecycleStatus('AKTİF (WebGL)', 'status-ok');
        }
    }

    disposeScene() {
        if (this.renderer) {
            this.renderer.dispose();
        }
        this._setLifecycleStatus('KAPATILDI (Disposed)', 'status-danger');
        this._showFallback(
            '🛡️',
            '3D Sahne Güvenle Kapatıldı (Dispose)',
            'WebGL bağlamı, geometriler, dokular, olay dinleyicileri ve animasyon döngüsü temizlendi.'
        );
    }

    simulateNoWebGL() {
        if (this.renderer) {
            this.renderer.dispose();
        }
        this._setLifecycleStatus('FALLBACK MODU', 'status-warn');
        this._showFallback(
            '⚠️',
            'WebGL Desteklenmiyor (Güvenli Geri Dönüş)',
            'Tarayıcı WebGL context oluşturamadığında sistem 2D oyuna zarar vermeden güvenli uyarı ekranına geçer.'
        );
    }

    _updateHUD(derived) {
        if (!derived) return;
        if (this.dom.vmSectorId) this.dom.vmSectorId.textContent = derived.sectorId;
        if (this.dom.vmSectorBounds) {
            this.dom.vmSectorBounds.textContent = `${derived.bounds.minX}..${derived.bounds.maxX}m`;
        }
        if (this.dom.vmGroupCount) this.dom.vmGroupCount.textContent = String(derived.uniqueGroupCount);
        if (this.dom.vmSoldierCount) {
            this.dom.vmSoldierCount.textContent = `${derived.playerCount} / ${derived.enemyCount}`;
        }
        if (this.dom.vmLimits) {
            this.dom.vmLimits.textContent = `${derived.limits.player}/${derived.limits.enemy} (Gizli: ${derived.hiddenAlive.player}/${derived.hiddenAlive.enemy})`;
        }

        if (this.dom.dataSourceBadge) {
            if (derived.isEmpty) {
                this.dom.dataSourceBadge.textContent = 'BOŞ VERİ (GÜVENLİ)';
                this.dom.dataSourceBadge.className = 'badge badge-muted';
            } else {
                this.dom.dataSourceBadge.textContent = 'GERÇEK PROJEKSİYON';
                this.dom.dataSourceBadge.className = 'badge badge-info';
            }
        }
    }

    _setLifecycleStatus(text, className) {
        if (!this.dom.lifecycleStatus) return;
        this.dom.lifecycleStatus.textContent = text;
        this.dom.lifecycleStatus.className = `status-val ${className}`;
    }

    _showFallback(icon, title, message) {
        if (!this.dom.fallbackScreen) return;
        this.dom.fallbackIcon.textContent = icon;
        this.dom.fallbackTitle.textContent = title;
        this.dom.fallbackMessage.textContent = message;
        this.dom.fallbackScreen.classList.remove('hidden');
    }

    _hideFallback() {
        this.dom.fallbackScreen?.classList.add('hidden');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const controller = new Battle3DPreviewController();
    controller.init();
    window.__focBattle3DPreview = controller;
});