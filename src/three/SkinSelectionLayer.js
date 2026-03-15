import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

export class SkinSelectionLayer {
  constructor({
    scene,
    camera,
    controls,
    host,
    offset,
    anatomyShell,
    onRowsChange,
    onFocusChange,
    hasFocusPoint,
  }) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.host = host;
    this.offset = offset;
    this.anatomyShell = anatomyShell;
    this.onRowsChange = onRowsChange;
    this.onFocusChange = onFocusChange;
    this.hasFocusPoint = hasFocusPoint;


    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();

    this.selectable = anatomyShell?.selectable ?? [];
    this.INTERSECTED = null;
    this.SELECTED = null;

    this.rows = [];
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

    this._drag = false;
    this._needsHoverUpdate = false;
    this._isPointerDown = false;
    this._downClient = { x: 0, y: 0 };
    this._dragThresholdPx = 4;

    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  async init() {
    const { width, height } = this._getHostSize();

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.inset = "0";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    this.host.appendChild(this.labelRenderer.domElement);

    this.tooltip = this._addSimpleLabel("0", new THREE.Vector3(0, 0, 0), "tt");
    this.tooltip.visible = false;

    await this._loadData();

    this.setEnabled(false);
    this._applyLabels();
  }

  async _loadData() {
    const [lymphs, dataElements, patientCounts] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/lymphs_positions.json`).then((r) => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/data_elements.json`).then((r) => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/element_patient_counts.json`).then((r) => r.json()),
    ]);

    this.data_elements = dataElements ?? {};
    this.patient_counts = patientCounts ?? {};

    this._sharedSphereGeometry = new THREE.SphereGeometry(18, 32, 32);

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

  setEnabled(enabled) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;

    if (enabled) {
      this.host.addEventListener("pointermove", this._onPointerMove);
      this.host.addEventListener("pointerdown", this._onPointerDown);
      this.host.addEventListener("pointerup", this._onPointerUp);
      this.host.addEventListener("pointercancel", this._onPointerUp);
    } else {
      this.host.removeEventListener("pointermove", this._onPointerMove);
      this.host.removeEventListener("pointerdown", this._onPointerDown);
      this.host.removeEventListener("pointerup", this._onPointerUp);
      this.host.removeEventListener("pointercancel", this._onPointerUp);

      if (this.INTERSECTED?.material?.emissive) {
        this.INTERSECTED.material.emissive.setHex(0x000000);
      }
      this.INTERSECTED = null;
      this._needsHoverUpdate = false;
      this._drag = false;
      this._isPointerDown = false;
    }

    this._setObjectsVisibleForMode();
    this._applyLabels();
  }

  setShowFlags(flags) {
    this.showFlags = { ...this.showFlags, ...flags };
    this._applyLabels();
  }

  beforeRender() {
    if (!this.enabled) return;

    if (this._needsHoverUpdate) {
      this._updateHover();
      this._needsHoverUpdate = false;
    }
  }

  renderLabels() {
    if (!this.labelRenderer || !this.scene || !this.camera) return;
    this.labelRenderer.render(this.scene, this.camera);
  }

  resize() {
    if (!this.labelRenderer) return;
    const { width, height } = this._getHostSize();
    this.labelRenderer.setSize(width, height);
  }

  reset() {
    if (this.SELECTED?.material?.color) {
      this.SELECTED.material.color.set("#E5B27F");
      this.SELECTED.material.opacity = 0.5;
    }
    this.SELECTED = null;

    if (this.INTERSECTED?.material?.emissive) {
      this.INTERSECTED.material.emissive.setHex(0x000000);
    }
    this.INTERSECTED = null;

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
    this._applyLabels();
  }

  dispose() {
    this.setEnabled(false);

    if (this.labelRenderer?.domElement?.parentNode) {
      this.labelRenderer.domElement.parentNode.removeChild(this.labelRenderer.domElement);
    }

    if (this.tooltip) {
      this.scene?.remove(this.tooltip);
    }

    for (const item of Object.values(this.lymph_lookup)) {
      if (item.sphere) this.scene?.remove(item.sphere);
      if (item.label) this.scene?.remove(item.label);

      if (item.sphere?.material) {
        item.sphere.material.dispose?.();
      }
    }

    this._sharedSphereGeometry?.dispose?.();
    this._sharedSphereGeometry = null;

    this.labelRenderer = null;
    this.tooltip = null;
    this.lymph_lookup = {};
    this.rows = [];
    this.SELECTED = null;
    this.INTERSECTED = null;
  }

  _setObjectsVisibleForMode() {
    const visible = this.enabled;

    if (this.tooltip) {
      this.tooltip.visible =
        visible &&
        Boolean(this.SELECTED) &&
        Boolean(this.showFlags.showPatientCounts);
    }

    for (const item of Object.values(this.lymph_lookup)) {
      const selectedVisible = visible && this.rows.some((r) => r.code && item.codeSpan?.textContent === r.code);
      item.sphere.visible = selectedVisible;
      item.label.visible = selectedVisible && (this.showFlags.showNodecodes || this.showFlags.showDrainage);
    }
  }

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

  _addSimpleLabel(text, position, additionalClass = "") {
    const div = document.createElement("div");
    div.className = `label ${additionalClass}`.trim();
    div.textContent = text;

    const label = new CSS2DObject(div);
    label.position.copy(position);
    this.scene.add(label);
    return label;
  }

  _applyLabels() {
    const { showNodecodes, showDrainage, showPatientCounts } = this.showFlags;

    if (this.tooltip) {
      this.tooltip.visible =
        this.enabled &&
        Boolean(this.SELECTED) &&
        Boolean(showPatientCounts);
    }

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

    if (this._isPointerDown && !this._drag) {
      const dx = e.clientX - this._downClient.x;
      const dy = e.clientY - this._downClient.y;
      if (Math.hypot(dx, dy) >= this._dragThresholdPx) {
        this._drag = true;
      }
    }
  }

  _onPointerDown(e) {
    if (!this.enabled) return;

    this._isPointerDown = true;
    this._drag = false;
    this._downClient.x = e.clientX;
    this._downClient.y = e.clientY;

    this.host.setPointerCapture?.(e.pointerId);
  }

  _onPointerUp(e) {
    if (!this.enabled) return;

    this.host.releasePointerCapture?.(e.pointerId);

    const wasDrag = this._drag;
    this._isPointerDown = false;
    this._drag = false;

    if (wasDrag) return;
    if (!this._isClientPointInsideHost(e.clientX, e.clientY)) return;

    this._updatePointerFromEvent(e);

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.selectable, true);
    if (hits.length === 0) return;

    const clickedObject = hits[0].object;
    const selectionChanged = this.SELECTED !== clickedObject;

    if (this.SELECTED?.material?.color) {
      this.SELECTED.material.color.set("#E5B27F");
      this.SELECTED.material.opacity = 0.5;
    }

    this.SELECTED = clickedObject;

    if (this.SELECTED?.material?.color) {
      this.SELECTED.material.color.setHex(0xff0000);
      this.SELECTED.material.opacity = 0.5;
    }

    const centre = this.anatomyShell?.getCenterPoint?.(this.SELECTED);

    // Match old behaviour:
    // only update focus if selection changed or no focus exists yet
    if (centre && (selectionChanged || !this.hasFocusPoint?.())) {
      this.onFocusChange?.(centre);
    }

    for (const v of Object.values(this.lymph_lookup)) {
      v.sphere.visible = false;
      v.label.visible = false;
    }

    const name = this.SELECTED.name;
    const rows =
      this.data_elements?.[name] ||
      this.data_elements?.[name?.replace?.(/_/g, " ")] ||
      [];

    this.rows = rows;
    this.onRowsChange?.(rows);

    const elementKey = name.replace("element_", "");
    const count = this.patient_counts?.[elementKey] ?? 0;

    if (this.tooltip && centre) {
      this.tooltip.element.textContent = String(count);
      this.tooltip.visible = Boolean(this.showFlags.showPatientCounts);
      this.tooltip.position.copy(centre);
    }

    for (const r of rows) {
      const item = this.lymph_lookup[r.code];
      if (!item) continue;

      item.sphere.visible = true;
      item.label.visible = true;

      item.codeSpan.textContent = r.code;
      item.pctSpan.textContent = `${String(r.percentage).trim()}%`;

      const pct = parseFloat(r.percentage) / 50;
      item.sphere.scale
        .setScalar(Number.isFinite(pct) ? pct : 0.5)
        .clampScalar(0.5, 1);
    }

    this._applyLabels();
  }

  _setControlsTarget(point) {
    if (!this.controls || !point) return;

    if (this.controls.target?.copy) {
      this.controls.target.copy(point);
    }

    if (typeof this.controls.setTarget === "function") {
      this.controls.setTarget(point.x, point.y, point.z);
    }

    if (typeof this.controls.setCenter === "function") {
      this.controls.setCenter(point);
    }

    this.controls.update?.();
  }

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

        if (this.INTERSECTED?.material?.emissive) {
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

  _getHostSize() {
    const r = this.host.getBoundingClientRect();
    return {
      width: Math.max(1, r.width),
      height: Math.max(1, r.height),
    };
  }
}