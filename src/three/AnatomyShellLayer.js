import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Manages the anatomical shell mesh layer used for skin selection and heatmap views.
 * It loads the GLB model, prepares selectable meshes and boundary lines,
 * and controls selection, visibility, and mode-specific rendering behaviour.
 */
export class AnatomyShellLayer {
  /**
   * Creates a new anatomy shell layer.
   *
   * @param {Object} params Construction parameters.
   * @param {THREE.Scene} params.scene Scene that the layer should attach to.
   * @param {THREE.Vector3} params.offset Positional offset applied to the loaded model root.
   */
  constructor({ scene, offset }) {
    this.scene = scene;
    this.offset = offset;

    this.root = null;
    this.lines = null;
    this.selectable = [];
    this._baseMeshOpacity = 0.5;

    this.selectedMesh = null;
    this.hoveredMesh = null;
    this.selectionVisualEnabled = true;
    this.currentMode = "skin";
  }

  /**
   * Loads the shell model, converts meshes into selectable surfaces,
   * and rebuilds the stored line geometry as a dedicated overlay.
   *
   * @returns {Promise<void>} Resolves once the model has been loaded and attached.
   */
  async init() {
    // Load the preprocessed shell scene that contains meshes plus stored boundary lines.
    const loader = new GLTFLoader();

    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        `${import.meta.env.BASE_URL}data/scene.glb`,
        resolve,
        undefined,
        reject
      );
    });

    const root = gltf.scene?.children?.[0] ?? gltf.scene;
    if (!root) {
      throw new Error("scene.glb loaded but no root was found");
    }

    let linesNode = null;

    // Separate surface meshes from the baked line layer and normalise their materials.
    for (const child of root.children ?? []) {
      child.geometry?.computeVertexNormals?.();

      if (child.name === "Lines") {
        linesNode = child;
        continue;
      }

      if (child.isMesh) {
        child.material = new THREE.MeshPhongMaterial({
          color: "#E5B27F",
          specular: "#33334C",
          opacity: this._baseMeshOpacity,
          transparent: true,
          shininess: 20,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: 5,
          polygonOffsetUnits: 5,
        });

        child.renderOrder = 1;
        this.selectable.push(child);
      }
    }

    // Recreate the line overlay with its own material so visibility can be tuned per mode.
    if (linesNode?.geometry) {
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 1,
        depthTest: true,
        depthWrite: false,
      });

      const lines = new THREE.LineSegments(linesNode.geometry, lineMat);
      lines.position.copy(linesNode.position);
      lines.rotation.copy(linesNode.rotation);
      lines.scale.copy(linesNode.scale);
      lines.renderOrder = 50;
      lines.frustumCulled = false;

      linesNode.visible = false;
      root.add(lines);
      this.lines = lines;
    }

    root.position.add(this.offset);
    this.scene.add(root);
    this.root = root;
  }

  /**
   * Applies rendering changes for the current tool mode.
   * Skin mode keeps the shell visible and shows selection highlighting,
   * while heatmap mode makes the shell nearly transparent and softens the line overlay.
   *
   * @param {string} mode Active tool mode.
   */
  setMode(mode) {
    this.currentMode = mode;
    const isSkinMode = mode === "skin";
    const isHeatmapMode = mode === "heatmap";

    // Only skin mode shows the red selected-surface highlight.
    this.selectionVisualEnabled = isSkinMode;

    for (const mesh of this.selectable) {
      mesh.visible = true;

      if (mesh.material) {
        mesh.material.transparent = true;
        mesh.material.opacity = isSkinMode ? this._baseMeshOpacity : 0.01;
        mesh.material.depthWrite = !isHeatmapMode;
      }

      if (mesh !== this.selectedMesh && mesh.material?.color) {
        mesh.material.color.set("#E5B27F");
      }

      if (mesh !== this.selectedMesh && mesh.material?.emissive) {
        mesh.material.emissive.setHex(0x000000);
      }

      mesh.renderOrder = isHeatmapMode ? 5 : 1;
    }

    if (this.selectedMesh?.material) {
      if (this.selectionVisualEnabled && this.selectedMesh.material.color) {
        this.selectedMesh.material.color.setHex(0xff0000);
      } else if (this.selectedMesh.material.color) {
        // Preserve the selected mesh state in heatmap mode without showing the red highlight.
        this.selectedMesh.material.color.set("#E5B27F");
      }

      this.selectedMesh.material.opacity = isSkinMode ? this._baseMeshOpacity : 0.01;

      if (this.selectedMesh.material.emissive) {
        this.selectedMesh.material.emissive.setHex(0x000000);
      }
    }

    if (this.lines) {
      this.lines.visible = true;
      if (this.lines.material) {
        this.lines.material.opacity = isHeatmapMode ? 0.7 : 1;
      }
    }
  }

  /**
   * Indicates whether a shell mesh is currently selected.
   *
   * @returns {boolean} True when a mesh is selected.
   */
  hasSelection() {
    return Boolean(this.selectedMesh);
  }

  /**
   * Returns the currently selected shell mesh.
   *
   * @returns {THREE.Mesh | null} The selected mesh, if any.
   */
  getSelectedMesh() {
    return this.selectedMesh;
  }

  /**
   * Updates the active mesh selection and refreshes the corresponding material styling.
   *
   * @param {THREE.Mesh | null | undefined} mesh Mesh to select.
   */
  selectMesh(mesh) {
    if (this.selectedMesh === mesh) return;

    const isSkinMode = this.currentMode === "skin";

    if (this.selectedMesh?.material?.color) {
      this.selectedMesh.material.color.set("#E5B27F");
      this.selectedMesh.material.opacity = isSkinMode ? this._baseMeshOpacity : 0.01;
    }
    if (this.selectedMesh?.material?.emissive) {
      this.selectedMesh.material.emissive.setHex(0x000000);
    }

    this.selectedMesh = mesh ?? null;

    if (this.selectedMesh?.material?.color) {
      if (this.selectionVisualEnabled) {
        this.selectedMesh.material.color.setHex(0xff0000);
      } else {
        this.selectedMesh.material.color.set("#E5B27F");
      }

      this.selectedMesh.material.opacity = isSkinMode ? this._baseMeshOpacity : 0.01;
    }
  }

  /**
   * Clears the current shell selection and restores the default material styling.
   */
  clearSelection() {
    const isSkinMode = this.currentMode === "skin";

    if (this.selectedMesh?.material?.color) {
      this.selectedMesh.material.color.set("#E5B27F");
      this.selectedMesh.material.opacity = isSkinMode ? this._baseMeshOpacity : 0.01;
    }

    if (this.selectedMesh?.material?.emissive) {
      this.selectedMesh.material.emissive.setHex(0x000000);
    }

    this.selectedMesh = null;
  }

  /**
   * Computes focus metadata for the selected mesh so the camera can frame it.
   *
   * @returns {{ point: THREE.Vector3, radius: number } | null} Focus target and approximate radius.
   */
  getSelectedFocusInfo() {
    if (!this.selectedMesh?.geometry) return null;

    const center = this.getCenterPoint(this.selectedMesh);
    if (!center) return null;

    this.selectedMesh.geometry.computeBoundingSphere();
    const localRadius = this.selectedMesh.geometry.boundingSphere?.radius ?? 60;

    // Convert the local bounding-sphere radius into world space for camera framing.
    const scale = this.selectedMesh.getWorldScale(new THREE.Vector3());
    const maxScale = Math.max(scale.x, scale.y, scale.z, 1);
    const worldRadius = localRadius * maxScale;

    return {
      point: center.clone(),
      radius: worldRadius,
    };
  }

  /**
   * Computes the world-space centre point of a mesh from its bounding box.
   *
   * @param {THREE.Mesh} mesh Mesh to measure.
   * @returns {THREE.Vector3} World-space centre of the mesh.
   */
  getCenterPoint(mesh) {
    const geometry = mesh.geometry;
    geometry.computeBoundingBox();

    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    mesh.localToWorld(center);

    return center;
  }

  /**
   * Shows or hides the entire shell layer root.
   *
   * @param {boolean} visible Whether the shell layer should be visible.
   */
  setVisible(visible) {
    if (this.root) {
      this.root.visible = visible;
    }
  }

  /**
   * Removes the shell layer from the scene and clears stored references.
   */
  dispose() {
    if (!this.root) return;

    this.scene?.remove(this.root);
    this.root = null;
    this.lines = null;
    this.selectable = [];
    this.selectedMesh = null;
    this.hoveredMesh = null;
  }
}