import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

/**
 * Manages the interactive skin-selection overlays that sit on top of the shared shell.
 * It loads lymph node metadata, renders CSS2D labels and spheres, tracks hover state,
 * and synchronises sidebar table rows with the currently selected shell element.
 */
export class SkinSelectionLayer {
  /**
   * Creates a new skin-selection layer.
   *
   * @param {Object} params Construction parameters.
   * @param {THREE.Scene} params.scene Scene that the layer should attach to.
   * @param {THREE.Camera} params.camera Active camera used for raycasting and label rendering.
   * @param {HTMLElement} params.host Host DOM element for pointer tracking and label overlay mounting.
   * @param {THREE.Vector3} params.offset Positional offset applied to loaded lymph node positions.
   * @param {Object} params.anatomyShell Shared anatomy shell layer used for selection state.
   * @param {(rows: any[]) => void} [params.onRowsChange] Callback fired when selected drainage rows change.
   */
  constructor({
    scene,
    camera,
    host,
    offset,
    anatomyShell,
    onRowsChange,
  }) {
    this.scene = scene;
    this.camera = camera;
    this.host = host;
    this.offset = offset;
    this.anatomyShell = anatomyShell;
    this.onRowsChange = onRowsChange;

    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();

    this.selectable = anatomyShell?.selectable ?? [];
    this.INTERSECTED = null;

    this.rows = [];
    this._lastSelectionMesh = null;
    this.enabled = false;

    this.showFlags = {
      showNodecodes: true,
      showDrainage: true,
      showPatientCounts: true,
    };

    this.tooltip = null;
    this.labelRenderer = null;

    this.data_elements = {};
    this.patient_counts = {};
    this.lymph_lookup = {};

    this._sharedSphereGeometry = null;
    this._needsHoverUpdate = false;

    this._onPointerMove = this._onPointerMove.bind(this);
  }

  /**
   * Initialises the CSS2D label renderer, tooltip, and lymphatic metadata.
   *
   * @returns {Promise<void>} Resolves once the layer is ready for use.
   */
  async init() {
    // Match the label renderer size to the current host so HTML labels overlay correctly.
    const { width, height } = this._getHostSize();

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.inset = "0";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    this.host.appendChild(this.labelRenderer.domElement);

    // Create a reusable patient-count tooltip that is repositioned per selection.
    this.tooltip = this._addSimpleLabel("0", new THREE.Vector3(0, 0, 0), "tt");
    this.tooltip.visible = false;

    await this._loadData();

    this.setEnabled(false);
    this._applyLabels();
  }

  /**
   * Loads node positions, drainage mappings, and patient-count metadata.
   *
   * @returns {Promise<void>} Resolves once all lookup data and visual helpers are prepared.
   */
  async _loadData() {
    // Load all selection-related datasets in parallel to minimise startup time.
    const [lymphs, dataElements, patientCounts] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/lymphs_positions.json`).then((r) => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/data_elements.json`).then((r) => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/element_patient_counts.json`).then((r) => r.json()),
    ]);

    this.data_elements = dataElements ?? {};
    this.patient_counts = patientCounts ?? {};
    // Reuse one sphere geometry for all node markers to reduce memory overhead.
    this._sharedSphereGeometry = new THREE.SphereGeometry(18, 32, 32);

    // Build lookup entries that combine the node position with its sphere and rich label objects.
    for (const l of lymphs) {
      const pos = new THREE.Vector3(
        l.position[0],
        l.position[1],
        l.position[2]
      ).add(this.offset);

      const sphere = this._makeSphere(pos);
      const labelParts = this._makeRichLabel(l.label, pos);

      this.lymph_lookup[l.label] = {
        nodePos: pos.clone(),
        sphere,
        label: labelParts.obj,
        labelDiv: labelParts.div,
        codeSpan: labelParts.codeSpan,
        pctSpan: labelParts.pctSpan,
      };
    }
  }

  /**
   * Enables or disables pointer hover handling and overlay visibility.
   *
   * @param {boolean} enabled Whether the skin-selection layer should be active.
   */
  setEnabled(enabled) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;

    // Only track hover interactions while the skin-selection workflow is active.
    if (enabled) {
      this.host.addEventListener("pointermove", this._onPointerMove);
      this._lastSelectionMesh = null;
    } else {
      this.host.removeEventListener("pointermove", this._onPointerMove);

      if (this.INTERSECTED?.material?.emissive) {
        this.INTERSECTED.material.emissive.setHex(0x000000);
      }
      this.INTERSECTED = null;
      this._needsHoverUpdate = false;
    }

    this._applyLabels();
  }

  /**
   * Updates which node labels and counts should be visible.
   *
   * @param {Object} flags Visibility flags for node codes, drainage percentages, and patient counts.
   */
  setShowFlags(flags) {
    this.showFlags = { ...this.showFlags, ...flags };
    this._applyLabels();
  }

  /**
   * Runs per-frame selection and hover updates before the shared viewer renders.
   */
  beforeRender() {
    if (!this.enabled) return;

    // Sync labels and sidebar rows whenever the shared shell selection changes.
    const selectedMesh = this.anatomyShell?.getSelectedMesh?.() ?? null;
    if (selectedMesh !== this._lastSelectionMesh) {
      this._syncFromSharedSelection();
    }

    if (this._needsHoverUpdate) {
      this._updateHover();
      this._needsHoverUpdate = false;
    }
  }

  /**
   * Renders the CSS2D label scene on top of the WebGL viewer.
   */
  renderLabels() {
    if (!this.labelRenderer || !this.scene || !this.camera) return;
    this.labelRenderer.render(this.scene, this.camera);
  }

  /**
   * Resizes the CSS2D renderer to match the current host element dimensions.
   */
  resize() {
    if (!this.labelRenderer) return;
    const { width, height } = this._getHostSize();
    this.labelRenderer.setSize(width, height);
  }

  /**
   * Clears hover state, selection-linked overlays, and sidebar rows.
   */
  reset() {
    if (this.INTERSECTED?.material?.emissive) {
      this.INTERSECTED.material.emissive.setHex(0x000000);
    }
    this.INTERSECTED = null;

    // Hide all node markers and labels until a new shell element is selected.
    for (const obj of Object.values(this.lymph_lookup)) {
      obj.sphere.visible = false;
      obj.label.visible = false;
    }

    if (this.tooltip) {
      this.tooltip.visible = false;
    }

    this.rows = [];
    this.onRowsChange?.([]);

    this.anatomyShell?.clearSelection?.();
    this._lastSelectionMesh = null;
    this._applyLabels();
  }

  /**
   * Disposes DOM-backed label resources and clears cached selection state.
   */
  dispose() {
    this.setEnabled(false);

    if (this.labelRenderer?.domElement?.parentNode) {
      this.labelRenderer.domElement.parentNode.removeChild(this.labelRenderer.domElement);
    }

    this.labelRenderer = null;
    this.tooltip = null;
    this.lymph_lookup = {};
    this.rows = [];
    this._lastSelectionMesh = null;
    this.INTERSECTED = null;
  }

  /**
   * Creates a hidden marker sphere for a lymph node position.
   *
   * @param {THREE.Vector3} pos World-space position for the marker.
   * @returns {THREE.Mesh} The created marker mesh.
   */
  _makeSphere(pos) {
    const mat = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      opacity: 1,
      transparent: false,
      shininess: 20,
    });

    const sphere = new THREE.Mesh(this._sharedSphereGeometry, mat);
    sphere.position.copy(pos);
    sphere.visible = false;
    this.scene.add(sphere);
    return sphere;
  }

  /**
   * Creates a two-part CSS2D label containing a node code and drainage percentage.
   *
   * @param {string} code Initial node code text.
   * @param {THREE.Vector3} pos Base world-space position for the label.
   * @returns {{ obj: CSS2DObject, div: HTMLDivElement, codeSpan: HTMLSpanElement, pctSpan: HTMLSpanElement }} Label parts.
   */
  _makeRichLabel(code, pos) {
    const div = document.createElement("div");
    div.className = "label lymph";

    const codeSpan = document.createElement("span");
    codeSpan.className = "code";
    codeSpan.textContent = code;

    const pctSpan = document.createElement("span");
    pctSpan.className = "pct";
    pctSpan.textContent = "";

    div.appendChild(codeSpan);
    div.appendChild(pctSpan);

    const obj = new CSS2DObject(div);
    obj.position.copy(pos).add(new THREE.Vector3(0, 0, 25));
    obj.visible = false;
    this.scene.add(obj);

    return { obj, div, codeSpan, pctSpan };
  }

  /**
   * Creates a simple single-text CSS2D label.
   *
   * @param {string} text Label text.
   * @param {THREE.Vector3} position World-space label position.
   * @param {string} [additionalClass=""] Optional CSS class suffix.
   * @returns {CSS2DObject} The created label object.
   */
  _addSimpleLabel(text, position, additionalClass = "") {
    const div = document.createElement("div");
    div.className = `label ${additionalClass}`.trim();
    div.textContent = text;

    const label = new CSS2DObject(div);
    label.position.copy(position);
    this.scene.add(label);
    return label;
  }

  /**
   * Applies the current visibility flags to the tooltip, node labels, and marker spheres.
   */
  _applyLabels() {
    const { showNodecodes, showDrainage, showPatientCounts } = this.showFlags;

    if (this.tooltip) {
      this.tooltip.visible =
        this.enabled &&
        Boolean(this.anatomyShell?.getSelectedMesh?.()) &&
        Boolean(showPatientCounts);
    }

    // Only update visual state for node entries tied to the current selection rows.
    for (const r of this.rows) {
      const item = this.lymph_lookup[r.code];
      if (!item) continue;

      item.labelDiv.classList.toggle("hide-code", !showNodecodes);
      item.labelDiv.classList.toggle("hide-pct", !showDrainage);

      item.label.visible =
        this.enabled &&
        (showNodecodes || showDrainage);

      item.sphere.visible = this.enabled;
    }
  }

  /**
   * Rebuilds rows, tooltip content, and visible node overlays from the shared shell selection.
   */
  _syncFromSharedSelection() {
    const selectedMesh = this.anatomyShell?.getSelectedMesh?.() ?? null;
    this._lastSelectionMesh = selectedMesh;

    for (const v of Object.values(this.lymph_lookup)) {
      v.sphere.visible = false;
      v.label.visible = false;
    }

    if (!selectedMesh) {
      this.rows = [];
      this.onRowsChange?.([]);

      if (this.tooltip) {
        this.tooltip.visible = false;
      }

      this._applyLabels();
      return;
    }

    const centre = this.anatomyShell?.getCenterPoint?.(selectedMesh);
    const name = selectedMesh?.name;
    // Support both underscored and space-separated element names when reading lookup data.
    const rows =
      this.data_elements?.[name] ||
      this.data_elements?.[name?.replace?.(/_/g, " ")] ||
      [];

    this.rows = rows;
    this.onRowsChange?.(rows);

    const elementKey = name?.replace?.("element_", "");
    const count = this.patient_counts?.[elementKey] ?? 0;

    if (this.tooltip && centre) {
      this.tooltip.element.textContent = String(count);
      this.tooltip.visible = Boolean(this.showFlags.showPatientCounts);
      this.tooltip.position.copy(centre);
    }

    // Show and scale each draining node marker according to its associated drainage percentage.
    for (const r of rows) {
      const item = this.lymph_lookup[r.code];
      if (!item) continue;

      item.sphere.visible = true;
      item.label.visible = true;

      item.codeSpan.textContent = r.code;
      item.pctSpan.textContent = `${String(r.percentage).trim()}%`;

      const pct = parseFloat(r.percentage) / 50;
      item.sphere.scale.setScalar(
        Number.isFinite(pct) ? pct : 0.5
      ).clampScalar(0.5, 1);
    }

    this._applyLabels();
  }

  /**
   * Tracks pointer movement and marks hover picking for the next render frame.
   *
   * @param {PointerEvent} e Pointer move event.
   */
  _onPointerMove(e) {
    if (!this.enabled) return;

    const rect = this.host.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const newX = x * 2 - 1;
    const newY = -(y * 2 - 1);

    if (
      Math.abs(this.pointer.x - newX) > 0.001 ||
      Math.abs(this.pointer.y - newY) > 0.001
    ) {
      this.pointer.x = newX;
      this.pointer.y = newY;
      this._needsHoverUpdate = true;
    }
  }

  /**
   * Performs hover raycasting and applies transient emissive highlighting.
   */
  _updateHover() {
    if (!this.enabled) return;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.selectable, true);

    if (hits.length > 0) {
      const obj = hits[0].object;

      if (this.INTERSECTED !== obj) {
        if (this.INTERSECTED?.material?.emissive) {
          this.INTERSECTED.material.emissive.setHex(0x000000);
        }

        this.INTERSECTED = obj;

        // Never apply hover highlighting to the mesh that is already selected.
        const selectedMesh = this.anatomyShell?.getSelectedMesh?.();
        if (this.INTERSECTED !== selectedMesh && this.INTERSECTED?.material?.emissive) {
          this.INTERSECTED.material.emissive.setHex(0xff0000);
        }
      }
    } else {
      if (this.INTERSECTED?.material?.emissive) {
        this.INTERSECTED.material.emissive.setHex(0x000000);
      }
      this.INTERSECTED = null;
    }
  }

  /**
   * Measures the host element and returns a non-zero overlay size.
   *
   * @returns {{ width: number, height: number }} Current host dimensions.
   */
  _getHostSize() {
    const r = this.host.getBoundingClientRect();
    return {
      width: Math.max(1, r.width),
      height: Math.max(1, r.height),
    };
  }
}