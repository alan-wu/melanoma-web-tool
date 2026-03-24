import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Manages the coloured heatmap mesh and optional discrete point overlays.
 * It loads per-region vertex colours, the human mesh, and the discrete
 * marker data used for melanoma sites and normalised point displays.
 */
export class HeatmapLayer {
  /**
   * Creates a new heatmap layer.
   *
   * @param {Object} params Construction parameters.
   * @param {THREE.Scene} params.scene Scene that the layer should attach to.
   * @param {THREE.Vector3} params.offset Positional offset applied to the loaded model root.
   */
  constructor({ scene, offset }) {
    this.scene = scene;
    this.offset = offset;

    this.selection = {
      region: "Right Axilla",
      pointDisplayMode: "normalised", // none or sites or normalised
    };

    this.enabled = false;

    this.heatmapAttrs = {};
    this.discretePoints = null;

    this.mesh = null;
    this.heatmapRoot = null;
    this.discreteGroup = null;
    this._discreteInstanced = null;
  }

  /**
   * Loads all heatmap resources and prepares the mesh plus overlay container.
   *
   * @returns {Promise<void>} Resolves once the layer is fully initialised.
   */
  async init() {
    await this._loadHeatmapColours();
    await this._loadDiscretePoints();
    await this._loadHeatmapMesh();

    this.setEnabled(false);
    this._applyHeatmap();
    this._applyDiscretePoints();
  }

  /**
   * Returns metadata describing the available heatmap regions and defaults.
   *
   * @returns {{ regions: string[], patientDataKeys: string[], defaultRegion: string }} Heatmap metadata.
   */
  getMeta() {
    // Sort region names so the UI receives a stable, alphabetical list.
    const regions = Object.keys(this.heatmapAttrs).sort((a, b) =>
      a.localeCompare(b)
    );

    const patientDataKeys = this.discretePoints
      ? Object.keys(this.discretePoints)
      : [];

    const defaultRegion = regions.includes("Right Axilla")
      ? "Right Axilla"
      : (regions[0] ?? "Right Axilla");

    return { regions, patientDataKeys, defaultRegion };
  }

  /**
   * Enables or disables the heatmap layer and its discrete overlays.
   *
   * @param {boolean} enabled Whether the heatmap visuals should be visible.
   */
  setEnabled(enabled) {
    this.enabled = enabled;

    if (this.heatmapRoot) {
      this.heatmapRoot.visible = enabled;
    }

    if (!enabled) {
      this._clearDiscreteOverlay(true);
      return;
    }

    this._applyDiscretePoints();
  }

  /**
   * Updates the active region and overlay display mode.
   *
   * @param {Object} next Partial selection update.
   */
  setSelection(next) {
    this.selection = { ...this.selection, ...next };
    this._applyHeatmap();

    if (this.enabled) {
      this._applyDiscretePoints();
    }
  }

  /**
   * Clears and reapplies the current heatmap and discrete overlay state.
   */
  reset() {
    this._clearDiscreteOverlay(true);
    this._applyHeatmap();

    if (this.enabled) {
      this._applyDiscretePoints();
    }
  }

  /**
   * Removes the heatmap layer from the scene and disposes overlay resources.
   */
  dispose() {
    this._clearDiscreteOverlay(true);

    if (this.heatmapRoot) {
      this.scene?.remove(this.heatmapRoot);
    }

    this.mesh = null;
    this.heatmapRoot = null;
    this.discreteGroup = null;
    this.heatmapAttrs = {};
    this.discretePoints = null;
  }

  /**
   * Loads the precomputed per-vertex colour attributes for each heatmap region.
   *
   * @returns {Promise<void>} Resolves once all colour attributes are prepared.
   */
  async _loadHeatmapColours() {
    // Read the exported vertex-colour map keyed by region name.
    const raw = await fetch(
      `${import.meta.env.BASE_URL}data/heat_maps_verts_colors.json`
    ).then((r) => r.json());

    // Convert packed integer colours into normalised RGB triples for Three.js attributes.
    const parseColor = (c) => {
      const r = (c >> 16) & 255;
      const g = (c >> 8) & 255;
      const b = c & 255;
      return [r / 255, g / 255, b / 255];
    };

    this.heatmapAttrs = {};

    // Build a reusable Float32BufferAttribute for every named region.
    for (const [key, arr] of Object.entries(raw)) {
      const colors = new Float32Array(arr.length * 3);

      for (let i = 0; i < arr.length; i++) {
        const [rr, gg, bb] = parseColor(arr[i]);
        const j = i * 3;
        colors[j] = rr;
        colors[j + 1] = gg;
        colors[j + 2] = bb;
      }

      this.heatmapAttrs[key] = new THREE.Float32BufferAttribute(colors, 3);
    }
  }

  /**
   * Loads the discrete point dataset used for normalised markers and melanoma sites.
   *
   * @returns {Promise<void>} Resolves once the point data has been loaded.
   */
  async _loadDiscretePoints() {
    this.discretePoints = await fetch(
      `${import.meta.env.BASE_URL}data/discrete_points_normalized.json`
    ).then((r) => r.json());
  }

  /**
   * Loads the base human mesh used to display the vertex-colour heatmaps.
   *
   * @returns {Promise<void>} Resolves once the mesh and overlay group are attached.
   */
  async _loadHeatmapMesh() {
    // Load the shared anatomical mesh that receives the per-vertex heatmap colours.
    const loader = new GLTFLoader();

    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        `${import.meta.env.BASE_URL}data/human_mesh.glb`,
        resolve,
        undefined,
        reject
      );
    });

    // Find the first mesh in the GLB scene and use it as the heatmap surface.
    let foundMesh = null;
    gltf.scene.traverse((obj) => {
      if (!foundMesh && obj.isMesh) {
        foundMesh = obj;
      }
    });

    if (!foundMesh) {
      throw new Error("No mesh found in human_mesh.glb");
    }

    foundMesh.geometry.computeVertexNormals();

    // Use a vertex-colour material so each selected region can swap in its own colour attribute.
    foundMesh.material = new THREE.MeshPhongMaterial({
      color: "#FFFFFF",
      specular: "#33334C",
      opacity: 1,
      transparent: false,
      shininess: 20,
      side: THREE.DoubleSide,
      vertexColors: true,
    });

    this.mesh = foundMesh;
    this.heatmapRoot = gltf.scene;
    this.heatmapRoot.position.add(this.offset);

    this.scene.add(this.heatmapRoot);

    // Keep discrete markers in a dedicated child group so they can be rebuilt independently.
    this.discreteGroup = new THREE.Group();
    this.heatmapRoot.add(this.discreteGroup);
  }

  /**
   * Applies the currently selected region's vertex colours to the heatmap mesh.
   */
  _applyHeatmap() {
    if (!this.mesh?.geometry) return;

    const region = this.selection.region;
    const attr = this.heatmapAttrs[region];

    if (!attr) return;

    this.mesh.geometry.setAttribute("color", attr);

    if (this.mesh.geometry.attributes.color) {
      this.mesh.geometry.attributes.color.needsUpdate = true;
    }
  }

  /**
   * Rebuilds the discrete point overlay for the active region and display mode.
   */
  _applyDiscretePoints() {
    if (!this.discretePoints || !this.discreteGroup) return;

    // Recreate the overlay from scratch so it always matches the latest selection.
    this._clearDiscreteOverlay(true);

    if (!this.enabled) return;
    if (this.selection.pointDisplayMode === "none") return;

    let key;
    // Melanoma site markers use a different data key naming convention than normalised points.
    if (this.selection.pointDisplayMode === "sites") {
      key = `${this.selection.region} Frequency`;
    } else {
      key = this.selection.region;
    }

    const data = this.discretePoints[key];
    if (!data?.positions?.length) return;

    const count = data.positions.length;

    // Use a shared sphere geometry and render all markers efficiently with instancing.
    const geom = new THREE.SphereGeometry(10, 16, 16);

    const vCount = geom.getAttribute("position").count;
    const baseColors = new Float32Array(vCount * 3);
    baseColors.fill(1);
    geom.setAttribute("color", new THREE.BufferAttribute(baseColors, 3));

    const mat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      specular: "#33334C",
      shininess: 20,
      vertexColors: true,
    });

    const instanced = new THREE.InstancedMesh(geom, mat, count);

    instanced.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(count * 3),
      3
    );
    instanced.geometry.setAttribute("instanceColor", instanced.instanceColor);

    // Reuse transform helpers while composing per-instance transforms and colours.
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(0.5, 0.5, 0.5);

    const arr = instanced.instanceColor.array;

    for (let i = 0; i < count; i++) {
      const pos = data.positions[i];
      p.set(pos[0], pos[1], pos[2]);

      m.compose(p, q, s);
      instanced.setMatrixAt(i, m);

      // Site markers are rendered as solid black points, while normalised markers use dataset colours.
      let c;
      if (this.selection.pointDisplayMode === "sites") {
        c = new THREE.Color(0, 0, 0);
      } else {
        const cv = data.colors?.[i];
        c =
          typeof cv === "number" && Number.isFinite(cv)
            ? new THREE.Color(cv)
            : new THREE.Color(0, 0, 0);
      }

      const j = i * 3;
      arr[j] = c.r;
      arr[j + 1] = c.g;
      arr[j + 2] = c.b;
    }

    instanced.instanceMatrix.needsUpdate = true;
    instanced.instanceColor.needsUpdate = true;
    instanced.frustumCulled = false;
    instanced.material.needsUpdate = true;

    this._discreteInstanced = instanced;
    this.discreteGroup.add(instanced);
  }

  /**
   * Removes the current discrete overlay mesh and optionally disposes its resources.
   *
   * @param {boolean} [dispose=false] Whether geometry and material should also be disposed.
   */
  _clearDiscreteOverlay(dispose = false) {
    if (!this._discreteInstanced) return;

    this.discreteGroup?.remove(this._discreteInstanced);

    if (dispose) {
      this._discreteInstanced.geometry?.dispose?.();
      this._discreteInstanced.material?.dispose?.();
    }

    this._discreteInstanced = null;
  }
}