import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class AnatomyShellLayer {
  constructor({ scene, offset }) {
    this.scene = scene;
    this.offset = offset;

    this.root = null;
    this.lines = null;
    this.selectable = [];
    this._baseMeshOpacity = 0.5;
  }

  async init() {
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
        });

        child.renderOrder = 1;
        this.selectable.push(child);
      }
    }

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

  setMode(mode) {
    const isSkinMode = mode === "skin";
    const isHeatmapMode = mode === "heatmap";

    for (const mesh of this.selectable) {
      mesh.visible = true;

      if (mesh.material?.color) {
        mesh.material.color.set("#E5B27F");
      }

      if (mesh.material) {
        mesh.material.transparent = true;
        mesh.material.opacity = isSkinMode ? 0.5 : 0.01;
        mesh.material.depthWrite = !isHeatmapMode;
      }

      if (mesh.material?.emissive) {
        mesh.material.emissive.setHex(0x000000);
      }

      mesh.renderOrder = isHeatmapMode ? 5 : 1;
    }

    if (this.lines) {
      this.lines.visible = true;
      if (this.lines.material) {
        this.lines.material.opacity = isHeatmapMode ? 0.7 : 1;
      }
    }
  }

  clearSelection() {
    for (const mesh of this.selectable) {
      if (mesh.material?.color) {
        mesh.material.color.set("#E5B27F");
      }

      if (mesh.material) {
        mesh.material.opacity = this._baseMeshOpacity;
      }

      if (mesh.material?.emissive) {
        mesh.material.emissive.setHex(0x000000);
      }
    }
  }

  getCenterPoint(mesh) {
    const geometry = mesh.geometry;
    geometry.computeBoundingBox();

    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    mesh.localToWorld(center);

    return center;
  }

  setVisible(visible) {
    if (this.root) {
      this.root.visible = visible;
    }
  }

  dispose() {
    this.root = null;
    this.lines = null;
    this.selectable = [];
  }
}