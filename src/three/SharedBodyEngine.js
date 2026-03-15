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
  }

  async init() {
    this.initCore();

    //  Always load shared shell first
    this.anatomyShell = new AnatomyShellLayer({
      scene: this.scene,
      offset: this.offset,
    });
    await this.anatomyShell.init();

    // Load only the active tool layer first
    if (this.activeTool === "skin") {
      await this._ensureSkinLayer();
      this.setActiveTool("skin");

      // 3. Background-load the other layer
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
      });

      this._heatmapInitialised = true;
      return this.heatmapLayer;
    })();

    return this._heatmapInitPromise;
  }

  setActiveTool(tool) {
    this.activeTool = tool;

    this.anatomyShell?.setMode(tool);

    if (tool === "skin") {
      this.skinLayer?.setEnabled(true);
      this.heatmapLayer?.setEnabled(false);

      // If user switched before background init finished, ensure it starts now
      if (!this._skinInitialised) {
        this._ensureSkinLayer()
          .then(() => {
            if (this.activeTool === "skin") {
              this.anatomyShell?.setMode("skin");
              this.skinLayer?.setEnabled(true);
              this.heatmapLayer?.setEnabled(false);
            }
          })
          .catch((err) => console.error("Skin layer init failed:", err));
      }
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
    this.controls?.reset();
    this.controls?.update();

    this.hasFocusPoint = false;
    this.focusPoint.set(0, 0, 0);
    this.setControlsTarget(this.focusPoint);

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