import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class HeatmapLayer {
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

  async init() {
    await this._loadHeatmapColours();
    await this._loadDiscretePoints();
    await this._loadHeatmapMesh();

    this.setEnabled(false);
    this._applyHeatmap();
    this._applyDiscretePoints();
  }

  getMeta() {
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

  setEnabled(enabled) {
    this.enabled = enabled;

    if (this.heatmapRoot) {
      this.heatmapRoot.visible = enabled;
    }

    this._applyDiscretePoints();
  }

  setSelection(next) {
    this.selection = { ...this.selection, ...next };
    this._applyHeatmap();
    this._applyDiscretePoints();
  }

  reset() {
    this._clearDiscreteOverlay(true);
    this._applyHeatmap();
    this._applyDiscretePoints();
  }

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

  async _loadHeatmapColours() {
    const raw = await fetch(
      `${import.meta.env.BASE_URL}data/heat_maps_verts_colors.json`
    ).then((r) => r.json());

    const parseColor = (c) => {
      const r = (c >> 16) & 255;
      const g = (c >> 8) & 255;
      const b = c & 255;
      return [r / 255, g / 255, b / 255];
    };

    this.heatmapAttrs = {};

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

  async _loadDiscretePoints() {
    this.discretePoints = await fetch(
      `${import.meta.env.BASE_URL}data/discrete_points_normalized.json`
    ).then((r) => r.json());
  }

  async _loadHeatmapMesh() {
    const loader = new GLTFLoader();

    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        `${import.meta.env.BASE_URL}data/human_mesh.glb`,
        resolve,
        undefined,
        reject
      );
    });

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

    this.discreteGroup = new THREE.Group();
    this.heatmapRoot.add(this.discreteGroup);
  }

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

  _applyDiscretePoints() {
    if (!this.discretePoints || !this.discreteGroup) return;

    this._clearDiscreteOverlay(true);

    if (!this.enabled) return;
    if (this.selection.pointDisplayMode === "none") return;

    let key;
    if (this.selection.pointDisplayMode === "sites") {
      key = `${this.selection.region} Frequency`;
    } else {
      key = this.selection.region;
    }

    const data = this.discretePoints[key];
    if (!data?.positions?.length) return;

    const count = data.positions.length;

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