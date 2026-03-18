import * as THREE from "three";
import { Base3DEngine } from "./Base3DEngine";
import { AnatomyShellLayer } from "./AnatomyShellLayer";
import { SkinSelectionLayer } from "./SkinSelectionLayer";
import { HeatmapLayer } from "./HeatmapLayer";

export class SharedBodyEngine extends Base3DEngine {
  constructor({
    host,
    initialTool = "skin",
    onSkinRowsChange,
    onHeatmapMetaReady,
  }) {
    super({ host });

    this.activeTool = initialTool;
    this.onSkinRowsChange = onSkinRowsChange;
    this.onHeatmapMetaReady = onHeatmapMetaReady;

    this.anatomyShell = null;
    this.skinLayer = null;
    this.heatmapLayer = null;

    this._skinInitialised = false;
    this._heatmapInitialised = false;

    this._skinInitPromise = null;
    this._heatmapInitPromise = null;

    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();

    this._isPointerDown = false;
    this._drag = false;
    this._downClient = { x: 0, y: 0 };
    this._dragThresholdPx = 4;

    this._onPointerDownShared = this._onPointerDownShared.bind(this);
    this._onPointerMoveShared = this._onPointerMoveShared.bind(this);
    this._onPointerUpShared = this._onPointerUpShared.bind(this);
  }

  async init() {
    this.initCore();

    //  Always load shared shell first
    this.anatomyShell = new AnatomyShellLayer({
      scene: this.scene,
      offset: this.offset,
    });
    await this.anatomyShell.init();

    const global = this.getGlobalFrameInfo();
    this.setControlsTarget(global.point);
    this.controls?.update();

    this.host.addEventListener("pointerdown", this._onPointerDownShared);
    this.host.addEventListener("pointermove", this._onPointerMoveShared);
    this.host.addEventListener("pointerup", this._onPointerUpShared);
    this.host.addEventListener("pointercancel", this._onPointerUpShared);

    if (this.activeTool === "skin") {
      await this._ensureSkinLayer();
      this.setActiveTool("skin");

      this._ensureHeatmapLayer().catch((err) => {
        console.error("Background heatmap layer init failed:", err);
      });
    } else {
      await this._ensureHeatmapLayer();
      this.setActiveTool("heatmap");

      this._ensureSkinLayer().catch((err) => {
        console.error("Background skin layer init failed:", err);
      });
    }

    this.animate();
  }

  async _ensureSkinLayer() {
    if (this._skinInitialised) return this.skinLayer;
    if (this._skinInitPromise) return this._skinInitPromise;

    this._skinInitPromise = (async () => {
      this.skinLayer = new SkinSelectionLayer({
        scene: this.scene,
        camera: this.camera,
        controls: this.controls,
        host: this.host,
        offset: this.offset,
        anatomyShell: this.anatomyShell,
        onRowsChange: this.onSkinRowsChange,
        onFocusChange: (point) => {
          if (point) {
            this.hasFocusPoint = true;
            this.focusPoint.copy(point);
            this.setControlsTarget(point);
            this.controls?.update();
          } else {
            const global = this.getGlobalFrameInfo();
            this.hasFocusPoint = false;
            this.focusPoint.set(0, 0, 0);
            this.setControlsTarget(global.point);
            this.controls?.update();
          }
        },
      });

      await this.skinLayer.init();
      this.skinLayer.setEnabled(false);

      this._skinInitialised = true;
      return this.skinLayer;
    })();

    return this._skinInitPromise;
  }

  async _ensureHeatmapLayer() {
    if (this._heatmapInitialised) return this.heatmapLayer;
    if (this._heatmapInitPromise) return this._heatmapInitPromise;

    this._heatmapInitPromise = (async () => {
      this.heatmapLayer = new HeatmapLayer({
        scene: this.scene,
        offset: this.offset,
      });

      await this.heatmapLayer.init();
      this.heatmapLayer.setEnabled(false);

      const meta = this.heatmapLayer.getMeta();
      this.onHeatmapMetaReady?.(meta);

      this.heatmapLayer.setSelection({
        region: meta.defaultRegion,
        pointDisplayMode: "normalised",
      });

      this._heatmapInitialised = true;
      return this.heatmapLayer;
    })();

    return this._heatmapInitPromise;
  }

  getGlobalFrameInfo() {
    if (!this.anatomyShell?.root) {
      return {
        point: new THREE.Vector3(0, 0, 0),
        radius: 1500,
      };
    }

    const box = new THREE.Box3().setFromObject(this.anatomyShell.root);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);

    return {
      point: sphere.center.clone(),
      radius: sphere.radius,
    };
  }

  getPresetFocusInfo() {
    const selected = this.anatomyShell?.getSelectedFocusInfo?.();
    if (selected) return selected;

    return this.getGlobalFrameInfo();
  }

  getZoomFocusInfo() {
    const selected = this.anatomyShell?.getSelectedFocusInfo?.();
    if (selected) return selected;

    return this.getGlobalFrameInfo();
  }

  _updatePointerFromEvent(e) {
    const rect = this.host.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    this.pointer.x = x * 2 - 1;
    this.pointer.y = -(y * 2 - 1);
  }

  _isClientPointInsideHost(clientX, clientY) {
    const rect = this.host.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  _onPointerDownShared(e) {
    this._isPointerDown = true;
    this._drag = false;
    this._downClient.x = e.clientX;
    this._downClient.y = e.clientY;
  }

  _onPointerMoveShared(e) {
    if (!this._isPointerDown || this._drag) return;

    const dx = e.clientX - this._downClient.x;
    const dy = e.clientY - this._downClient.y;

    if (Math.hypot(dx, dy) >= this._dragThresholdPx) {
      this._drag = true;
    }
  }

  _onPointerUpShared(e) {
    const wasDrag = this._drag;
    this._isPointerDown = false;
    this._drag = false;

    if (wasDrag) return;
    if (!this._isClientPointInsideHost(e.clientX, e.clientY)) return;
    if (!this.anatomyShell?.selectable?.length) return;

    this._updatePointerFromEvent(e);

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.anatomyShell.selectable, true);
    if (hits.length === 0) return;

    const clickedObject = hits[0].object;
    this.anatomyShell?.selectMesh?.(clickedObject);

    const info = this.anatomyShell?.getSelectedFocusInfo?.();
    if (info?.point) {
      this.hasFocusPoint = true;
      this.focusPoint.copy(info.point);
      this.setControlsTarget(info.point);
      this.controls?.update();
    }
  }

  setActiveTool(tool) {
    this.activeTool = tool;
    this.anatomyShell?.setMode(tool);

    if (tool === "skin") {
      this.skinLayer?.setEnabled(true);
      this.heatmapLayer?.setEnabled(false);

      if (!this.anatomyShell?.hasSelection?.()) {
        const global = this.getGlobalFrameInfo();
        this.hasFocusPoint = false;
        this.focusPoint.set(0, 0, 0);
        this.setControlsTarget(global.point);
        this.controls?.update();
      }

      if (!this._skinInitialised) {
        this._ensureSkinLayer()
          .then(() => {
            if (this.activeTool === "skin") {
              this.anatomyShell?.setMode("skin");
              this.skinLayer?.setEnabled(true);
              this.heatmapLayer?.setEnabled(false);

              if (!this.anatomyShell?.hasSelection?.()) {
                const global = this.getGlobalFrameInfo();
                this.hasFocusPoint = false;
                this.focusPoint.set(0, 0, 0);
                this.setControlsTarget(global.point);
                this.controls?.update();
              }
            }
          })
          .catch((err) => console.error("Skin layer init failed:", err));
      }
    } else {
      if (!this.anatomyShell?.hasSelection?.()) {
        const global = this.getGlobalFrameInfo();
        this.hasFocusPoint = false;
        this.focusPoint.set(0, 0, 0);
        this.setControlsTarget(global.point);
        this.controls?.update();
      }

      this.skinLayer?.setEnabled(false);
      this.heatmapLayer?.setEnabled(true);

      if (!this._heatmapInitialised) {
        this._ensureHeatmapLayer()
          .then(() => {
            if (this.activeTool === "heatmap") {
              if (!this.anatomyShell?.hasSelection?.()) {
                const global = this.getGlobalFrameInfo();
                this.hasFocusPoint = false;
                this.focusPoint.set(0, 0, 0);
                this.setControlsTarget(global.point);
                this.controls?.update();
              }
              this.anatomyShell?.setMode("heatmap");
              this.skinLayer?.setEnabled(false);
              this.heatmapLayer?.setEnabled(true);
            }
          })
          .catch((err) => console.error("Heatmap layer init failed:", err));
      }
    }
  }

  setSkinFlags(flags) {
    if (this._skinInitialised) {
      this.skinLayer?.setShowFlags(flags);
    }
  }

  setHeatmapSelection(selection) {
    if (this._heatmapInitialised) {
      this.heatmapLayer?.setSelection(selection);
    }
  }

  beforeRender() {
    this.skinLayer?.beforeRender?.();
  }

  afterRender() {
    this.skinLayer?.renderLabels?.();
  }

  resizeToHost() {
    super.resizeToHost();
    this.skinLayer?.resize?.();
  }

  resetAll() {
    const global = this.getGlobalFrameInfo();

    this.controls?.reset();
    this.camera.up.set(0, 0, 1);

    this.anatomyShell?.clearSelection?.();

    this.hasFocusPoint = false;
    this.focusPoint.set(0, 0, 0);

    this.setControlsTarget(global.point);
    this.controls?.update();

    this.skinLayer?.reset?.();
    this.heatmapLayer?.reset?.();

    if (this.activeTool === "skin") {
      this.anatomyShell?.setMode("skin");
      this.skinLayer?.setEnabled(true);
      this.heatmapLayer?.setEnabled(false);
    } else {
      this.anatomyShell?.setMode("heatmap");
      this.skinLayer?.setEnabled(false);
      this.heatmapLayer?.setEnabled(true);
    }
  }

  dispose() {
    this.host?.removeEventListener("pointerdown", this._onPointerDownShared);
    this.host?.removeEventListener("pointermove", this._onPointerMoveShared);
    this.host?.removeEventListener("pointerup", this._onPointerUpShared);
    this.host?.removeEventListener("pointercancel", this._onPointerUpShared);

    this.skinLayer?.dispose?.();
    this.heatmapLayer?.dispose?.();
    this.anatomyShell?.dispose?.();

    this.skinLayer = null;
    this.heatmapLayer = null;
    this.anatomyShell = null;

    this._skinInitialised = false;
    this._heatmapInitialised = false;
    this._skinInitPromise = null;
    this._heatmapInitPromise = null;

    super.dispose();
  }
}