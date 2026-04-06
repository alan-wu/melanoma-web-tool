import * as THREE from "three";
import { Base3DEngine } from "./Base3DEngine";
import { AnatomyShellLayer } from "./AnatomyShellLayer";
import { SkinSelectionLayer } from "./SkinSelectionLayer";
import { HeatmapLayer } from "./HeatmapLayer";

/**
 * Coordinates the shared anatomical viewer used by both tool sidebars.
 * It owns the shell, skin-selection, and heatmap layers, switches between
 * tool modes, and routes shared camera focus and pointer-selection behaviour.
 */
export class SharedBodyEngine extends Base3DEngine {
  /**
   * Creates a shared body engine instance.
   *
   * @param {Object} params Construction parameters.
   * @param {HTMLElement} params.host Host DOM element for the renderer.
   * @param {string} [params.initialTool="skin"] Initially active tool mode.
   * @param {(rows: any[]) => void} [params.onSkinRowsChange] Callback for updated skin-selection rows.
   * @param {(meta: any) => void} [params.onHeatmapMetaReady] Callback when heatmap metadata becomes available.
   */
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

    /**
     * Default element name to select on initial load for Tool 1 when no prior selection exists.
     * If not found, the engine falls back to the first selectable shell mesh.
     */
    this.defaultSkinElementName = "element_547"; 

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

  /**
   * Initialises the shared viewer core, loads the always-present shell layer,
   * then ensures the active tool layer is ready before starting the render loop.
   *
   * @returns {Promise<void>} Resolves once the viewer is ready to render.
   */
  async init() {
    this.initCore();

    // Always load the shared shell first so both tools can reuse the same anatomy state.
    // The shell is always loaded because both tools depend on the same base anatomy mesh.
    this.anatomyShell = new AnatomyShellLayer({
      scene: this.scene,
      offset: this.offset,
    });
    await this.anatomyShell.init();

    const global = this.getGlobalFrameInfo();
    this.setControlsTarget(global.point);
    this.controls?.update();

    // Shared pointer listeners enable click-to-select behaviour across both tool modes.
    this.host.addEventListener("pointerdown", this._onPointerDownShared);
    this.host.addEventListener("pointermove", this._onPointerMoveShared);
    this.host.addEventListener("pointerup", this._onPointerUpShared);
    this.host.addEventListener("pointercancel", this._onPointerUpShared);

    if (this.activeTool === "skin") {
      await this._ensureSkinLayer();
      this._applyDefaultSkinSelection();
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

  /**
   * Lazily initialises the skin-selection layer once and reuses it thereafter.
   *
   * @returns {Promise<SkinSelectionLayer>} The ready skin-selection layer.
   */
  async _ensureSkinLayer() {
    if (this._skinInitialised) return this.skinLayer;
    if (this._skinInitPromise) return this._skinInitPromise;

    // Cache the initialisation promise so repeated calls do not create duplicate layers.
    this._skinInitPromise = (async () => {
      this.skinLayer = new SkinSelectionLayer({
        scene: this.scene,
        camera: this.camera,
        host: this.host,
        offset: this.offset,
        anatomyShell: this.anatomyShell,
        onRowsChange: this.onSkinRowsChange,
      });

      await this.skinLayer.init();
      this.skinLayer.setEnabled(false);

      this._skinInitialised = true;
      return this.skinLayer;
    })();

    return this._skinInitPromise;
  }

  /**
   * Lazily initialises the heatmap layer once and reuses it thereafter.
   *
   * @returns {Promise<HeatmapLayer>} The ready heatmap layer.
   */
  async _ensureHeatmapLayer() {
    if (this._heatmapInitialised) return this.heatmapLayer;
    if (this._heatmapInitPromise) return this._heatmapInitPromise;

    // Cache the initialisation promise so repeated calls do not create duplicate layers.
    this._heatmapInitPromise = (async () => {
      this.heatmapLayer = new HeatmapLayer({
        scene: this.scene,
        offset: this.offset,
      });

      await this.heatmapLayer.init();
      this.heatmapLayer.setEnabled(false);

      // Surface region metadata to the React layer once the heatmap assets have loaded.
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

  /**
   * Applies a default shell selection for Tool 1 on the first time load.
   *
   * If a shell selection already exists, it is preserved.
   * If defaultSkinElementName is set and a matching mesh exists, that mesh is selected.
   * Otherwise the first selectable shell mesh is used as a safe fallback.
   */
  _applyDefaultSkinSelection() {
    if (!this.anatomyShell?.selectable?.length) return;
    if (this.anatomyShell?.hasSelection?.()) return;

    const defaultMesh = this.defaultSkinElementName
      ? this.anatomyShell.selectable.find(
          (mesh) => mesh.name === this.defaultSkinElementName
        )
      : null;

    const meshToSelect = defaultMesh ?? this.anatomyShell.selectable[0] ?? null;
    if (!meshToSelect) return;

    this.anatomyShell.selectMesh(meshToSelect);

    const info = this.anatomyShell.getSelectedFocusInfo?.();
    if (info?.point) {
      this.hasFocusPoint = true;
      this.focusPoint.copy(info.point);
    }
  }

  /**
   * Computes framing information for the full shared anatomy model.
   *
   * @returns {{ point: THREE.Vector3, radius: number }} Global frame target information.
   */
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

  /**
   * Returns the focus information to use for preset view buttons
   * (Anterior, Posterior, Left lateral, Right lateral).
   *
   * Behaviour:
   * - If a skin element is currently selected, preset views should pivot
   *   around that selected element.
   * - The current zoom level should also be preserved, so we compute the
   *   current camera distance from that selected point.
   * - If nothing is selected, fall back to the global full-body framing.
   */
  getPresetFocusInfo() {
    const selected = this.anatomyShell?.getSelectedFocusInfo?.();

    if (selected?.point) {
      return {
        point: selected.point.clone(),
        distance: this.camera.position.distanceTo(selected.point),
      };
    }

    return this.getGlobalFrameInfo();
  }

  /**
   * Returns the preferred focus target for zoom actions.
   * Prefers the selected shell region when available, otherwise falls back to the current control target.
   *
   * @returns {{ point: THREE.Vector3, radius?: number }} Zoom focus information.
   */
  getZoomFocusInfo() {
    const selected = this.anatomyShell?.getSelectedFocusInfo?.();
    if (selected) return selected;

    if (this.controls?.target) {
      return {
        point: this.controls.target.clone(),
      };
    }

    return {
      point: this.getGlobalFrameInfo().point.clone(),
    };
  }

  /**
   * Converts a pointer event into normalised device coordinates for raycasting.
   *
   * @param {PointerEvent} e Pointer event from the host element.
   */
  _updatePointerFromEvent(e) {
    const rect = this.host.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    this.pointer.x = x * 2 - 1;
    this.pointer.y = -(y * 2 - 1);
  }

  /**
   * Checks whether a client-space point falls within the host element bounds.
   *
   * @param {number} clientX Client-space X coordinate.
   * @param {number} clientY Client-space Y coordinate.
   * @returns {boolean} True when the point lies inside the host bounds.
   */
  _isClientPointInsideHost(clientX, clientY) {
    const rect = this.host.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  /**
   * Starts shared click-versus-drag tracking for anatomy selection.
   *
   * @param {PointerEvent} e Pointer down event.
   */
  _onPointerDownShared(e) {
    this._isPointerDown = true;
    this._drag = false;
    this._downClient.x = e.clientX;
    this._downClient.y = e.clientY;
  }

  /**
   * Marks the interaction as a drag once the pointer has moved far enough.
   *
   * @param {PointerEvent} e Pointer move event.
   */
  _onPointerMoveShared(e) {
    if (!this._isPointerDown || this._drag) return;

    const dx = e.clientX - this._downClient.x;
    const dy = e.clientY - this._downClient.y;

    if (Math.hypot(dx, dy) >= this._dragThresholdPx) {
      this._drag = true;
    }
  }

  /**
   * Performs shared mesh picking when a pointer interaction ends without dragging.
   *
   * @param {PointerEvent} e Pointer up or cancel event.
   */
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

    // Reuse the shared shell selection for both tools so focus and highlighting stay consistent.
    const clickedObject = hits[0].object;
    this.anatomyShell?.selectMesh?.(clickedObject);

    const info = this.anatomyShell?.getSelectedFocusInfo?.();
    if (info?.point) {
      this.hasFocusPoint = true;
      this.focusPoint.copy(info.point);
    }
  }

  /**
   * Switches between skin-selection and heatmap modes.
   * It updates shell rendering, enables the correct layer, and ensures lazy-loaded layers are ready.
   *
   * @param {string} tool Tool mode to activate.
   */
  setActiveTool(tool) {
    this.activeTool = tool;
    this.anatomyShell?.setMode(tool);

    // Skin mode shows shell selection and table-driven drainage details.
    if (tool === "skin") {
      this.skinLayer?.setEnabled(true);
      this.heatmapLayer?.setEnabled(false);
      this._applyDefaultSkinSelection();

      if (!this._skinInitialised) {
        this._ensureSkinLayer()
          .then(() => {
            if (this.activeTool === "skin") {
              this.anatomyShell?.setMode("skin");
              this.skinLayer?.setEnabled(true);
              this.heatmapLayer?.setEnabled(false);
              this._applyDefaultSkinSelection();
            }
          })
          .catch((err) => console.error("Skin layer init failed:", err));
      }
      // Heatmap mode hides skin details and shows the selected region's colour overlay.
    } else {
      this.skinLayer?.setEnabled(false);
      this.heatmapLayer?.setEnabled(true);

      if (!this._heatmapInitialised) {
        this._ensureHeatmapLayer()
          .then(() => {
            if (this.activeTool === "heatmap") {
              this.anatomyShell?.setMode("heatmap");
              this.skinLayer?.setEnabled(false);
              this.heatmapLayer?.setEnabled(true);
            }
          })
          .catch((err) => console.error("Heatmap layer init failed:", err));
      }
    }
  }

  /**
   * Forwards skin-label visibility flags to the skin-selection layer when available.
   *
   * @param {Object} flags Skin overlay visibility flags.
   */
  setSkinFlags(flags) {
    if (this._skinInitialised) {
      this.skinLayer?.setShowFlags(flags);
    }
  }

  /**
   * Forwards region and overlay selection changes to the heatmap layer when available.
   *
   * @param {Object} selection Heatmap selection update.
   */
  setHeatmapSelection(selection) {
    if (this._heatmapInitialised) {
      this.heatmapLayer?.setSelection(selection);
    }
  }

  /**
   * Runs per-frame updates needed before rendering, delegating to the skin layer when present.
   */
  beforeRender() {
    this.skinLayer?.beforeRender?.();
  }

  /**
   * Runs post-render work such as label rendering for the skin-selection layer.
   */
  afterRender() {
    this.skinLayer?.renderLabels?.();
  }

  /**
   * Resizes the shared viewer and any layer-specific overlays to match the host size.
   */
  resizeToHost() {
    super.resizeToHost();
    this.skinLayer?.resize?.();
  }

  /**
   * Resets camera controls, shell selection, shared focus state, and both tool layers.
   */
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

  /**
   * Removes event listeners, disposes all managed layers, and then disposes base engine resources.
   */
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