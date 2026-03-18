import * as THREE from "three";
import { ArcballControls } from "three/examples/jsm/controls/ArcballControls.js";

const DEFAULT_CAMERA_POSITION = [
  1496.96865501004,
  3213.1316867226697,
  -232.08816356744805,
];

export class Base3DEngine {
  constructor({ host }) {
    this.host = host;

    this.offset = new THREE.Vector3(-270, -200, 900);

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.focusPoint = new THREE.Vector3(0, 0, 0);
    this.hasFocusPoint = false;

    this._raf = null;
    this._resizeObserver = null;
    this._disposed = false;

    this.defaultViewDirection = new THREE.Vector3(
      ...DEFAULT_CAMERA_POSITION
    ).normalize();
  }

  initCore() {
    this.scene = new THREE.Scene();

    const { width, height } = this.getHostSize();

    this.camera = new THREE.PerspectiveCamera(35, width / height, 1, 10000);
    this.camera.position.set(...DEFAULT_CAMERA_POSITION);
    this.camera.up.set(0, 0, 1);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 3);
    dirLight1.position.set(1, 1, 1);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 3);
    dirLight2.position.set(-1, -1, -1);
    this.scene.add(dirLight2);

    const ambientLight = new THREE.AmbientLight(0x404040, 10);
    this.scene.add(ambientLight);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = "block";
    this.host.appendChild(this.renderer.domElement);

    this.controls = new ArcballControls(
      this.camera,
      this.renderer.domElement,
      this.scene
    );
    this.controls.setGizmosVisible(false);

    this.host.style.touchAction = "none";

    this._resizeObserver = new ResizeObserver(() => this.resizeToHost());
    this._resizeObserver.observe(this.host);
  }

  _frameDistanceForRadius(radius, padding = 1.4, min = 220, max = 8000) {
    const safeRadius = Math.max(radius || 1, 1);
    const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = (safeRadius / Math.tan(fovRad / 2)) * padding;
    return THREE.MathUtils.clamp(dist, min, max);
  }

  getGlobalFrameInfo() {
    return {
      point: new THREE.Vector3(0, 0, 0),
      radius: null,
    };
  }

  getPresetFocusInfo() {
    return {
      point: this.getFocusPoint().clone(),
      radius: null,
    };
  }

  getZoomFocusInfo() {
    return {
      point: this.getFocusPoint().clone(),
      radius: null,
    };
  }

  setViewPreset(preset) {
    if (!this.controls || !this.camera) return;

    // All should use the global model framing, not selection framing
    if (preset === "All") {
      const globalInfo = this.getGlobalFrameInfo();

      const pivot = globalInfo.point.clone();
      const distance = globalInfo.radius
        ? this._frameDistanceForRadius(globalInfo.radius, 1.25, 700, 8000)
        : 3500;

      this.camera.position.copy(pivot).addScaledVector(this.defaultViewDirection, distance);
      this.camera.up.set(0, 0, 1);

      this.hasFocusPoint = false;
      this.focusPoint.set(0, 0, 0);

      this.setControlsTarget(pivot);
      this.controls.update();
      return;
    }

    const focus = this.getPresetFocusInfo();

    const pivot = focus.point.clone();

    let dir = null;
    if (preset === "Anterior") dir = new THREE.Vector3(0, 1, 0);
    else if (preset === "Posterior") dir = new THREE.Vector3(0, -1, 0);
    else if (preset === "Left lateral") dir = new THREE.Vector3(-1, 0, 0);
    else if (preset === "Right lateral") dir = new THREE.Vector3(1, 0, 0);
    else return;

    let distance;
    if (focus.radius && Number.isFinite(focus.radius)) {
      // Use local selected object framing if available,
      // otherwise global model framing info should be supplied by caller
      const padding = focus.radius < 150 ? 2.0 : 1.3;
      distance = this._frameDistanceForRadius(focus.radius, padding, 220, 8000);
    } else {
      distance = Math.max(this.camera.position.distanceTo(pivot), 220);
    }

    this.camera.position.copy(pivot).addScaledVector(dir, distance);
    this.camera.up.set(0, 0, 1);
    this.setControlsTarget(pivot);
    this.controls.update();
  }

  zoomIn() {
    const focusInfo = this.getZoomFocusInfo();
    if (focusInfo?.point) {
      this.hasFocusPoint = false;
      this.setControlsTarget(focusInfo.point);
    }

    this.dollyToFocus(0.85);
  }

  zoomOut() {
    const focusInfo = this.getZoomFocusInfo();
    if (focusInfo?.point) {
      this.hasFocusPoint = false;
      this.setControlsTarget(focusInfo.point);
    }

    this.dollyToFocus(1.18);
  }

  dollyToFocus(scale) {
    if (!this.camera) return;

    const focus = this.controls?.target ?? this.getFocusPoint();
    const v = new THREE.Vector3().subVectors(this.camera.position, focus);
    v.multiplyScalar(scale);

    this.camera.position.copy(focus).add(v);
    this.setControlsTarget(focus);
    this.controls?.update();
  }

  getFocusPoint() {
    if (this.hasFocusPoint) return this.focusPoint;
    if (this.controls?.target) return this.controls.target;
    return this.focusPoint;
  }

  setControlsTarget(point) {
    if (!this.controls) return;

    if (this.controls.target?.copy) {
      this.controls.target.copy(point);
    }

    if (typeof this.controls.setTarget === "function") {
      this.controls.setTarget(point.x, point.y, point.z);
    }

    if (typeof this.controls.setCenter === "function") {
      this.controls.setCenter(point);
    }
  }

  animate() {
    this._raf = requestAnimationFrame(() => this.animate());

    if (typeof this.beforeRender === "function") {
      this.beforeRender();
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    if (typeof this.afterRender === "function") {
      this.afterRender();
    }
  }

  resizeToHost() {
    const { width, height } = this.getHostSize();
    if (!this.camera || !this.renderer) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  getHostSize() {
    const r = this.host.getBoundingClientRect();
    return {
      width: Math.max(1, r.width),
      height: Math.max(1, r.height),
    };
  }

  dispose() {
    this._disposed = true;

    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }

    this._resizeObserver?.disconnect();
    this._resizeObserver = null;

    this.controls?.dispose();

    if (this.renderer?.domElement?.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }

    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) {
          obj.geometry.dispose?.();
        }

        if (obj.material) {
          const mats = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          mats.forEach((m) => m.dispose?.());
        }
      });
    }

    this.renderer?.dispose();

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
  }
}