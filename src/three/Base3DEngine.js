import * as THREE from "three";
import { ArcballControls } from "three/examples/jsm/controls/ArcballControls.js";

/**
 * Default world-space camera position used when the viewer is first initialised.
 */
const DEFAULT_CAMERA_POSITION = [
  1496.96865501004,
  3213.1316867226697,
  -232.08816356744805,
];

/**
 * Shared Three.js engine foundation for the interactive anatomy tools.
 * It sets up the scene, camera, renderer, controls, resize handling,
 * and common camera framing and zoom behaviour used by higher-level viewer engines.
 */
export class Base3DEngine {
  /**
   * Creates a new base 3D engine bound to a host DOM element.
   *
   * @param {Object} params Construction parameters.
   * @param {HTMLElement} params.host DOM element that will contain the renderer canvas.
   */
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

  /**
   * Initialises the common Three.js scene, camera, lighting, renderer,
   * controls, and resize observation shared by all tool engines.
   */
  initCore() {
    this.scene = new THREE.Scene();

    // Measure the host so the initial camera aspect ratio and renderer size are correct.
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

    // Arcball controls provide rotate, pan, and zoom interactions around a target point.
    this.controls = new ArcballControls(
      this.camera,
      this.renderer.domElement,
      this.scene
    );
    this.controls.setGizmosVisible(false);

    this.host.style.touchAction = "none";

    // Keep the renderer and camera projection synced to the host container size.
    this._resizeObserver = new ResizeObserver(() => this.resizeToHost());
    this._resizeObserver.observe(this.host);
  }

  /**
   * Returns framing information for the whole model.
   * Subclasses can override this to supply a more precise global target.
   *
   * @returns {{ point: THREE.Vector3, distance: number }} Global frame target information.
   */
  getGlobalFrameInfo() {
    return {
      point: new THREE.Vector3(0, 0, 0),
      distance: this.camera ? this.camera.position.length() : 3500,
    };
  }

  /**
   * Returns the focus target used when applying named camera presets.
   * Subclasses can override this to frame a selected structure instead of the full model.
   *
   * @returns {{ point: THREE.Vector3, distance?: number }} Preset focus information.
   */
  getPresetFocusInfo() {
    return this.getGlobalFrameInfo();
  }

  /**
   * Returns the focus target used for zoom actions.
   * Subclasses can override this to zoom toward a selected structure.
   *
   * @returns {{ point: THREE.Vector3 }} Zoom focus information.
   */
  getZoomFocusInfo() {
    if (this.controls?.target) {
      return {
        point: this.controls.target.clone(),
      };
    }

    return {
      point: new THREE.Vector3(0, 0, 0),
    };
  }

  /**
   * Applies one of the preset camera orientations.
   *
   * Behaviour:
   * - "All" always returns to a global whole-body style view.
   * - The other preset views (Anterior, Posterior, Left lateral, Right lateral)
   *   should preserve the current zoom distance.
   * - If a selected element exists, the preset pivots around that element.
   * - Otherwise, it falls back to the global model centre.
   *
   * The preset remembers:
   * the current zoom amount
   * the currently selected element (if there is one)
   */
  setViewPreset(preset) {
    if (!this.controls || !this.camera) return;

    // "All" should remain a global full-body reset-style view.
    if (preset === "All") {
      const globalInfo = this.getGlobalFrameInfo();
      const pivot = globalInfo.point.clone();
      const currentDistance = globalInfo.distance ?? this.camera.position.length();

      this.controls.reset();
      this.camera.position
        .copy(this.defaultViewDirection)
        .multiplyScalar(currentDistance);

      this.camera.up.set(0, 0, 1);
      this.hasFocusPoint = false;
      this.focusPoint.set(0, 0, 0);
      this.setControlsTarget(pivot);
      this.controls.update();
      return;
    }

    // For the directional presets, use selected-element focus if available.
    const focusInfo = this.getPresetFocusInfo();
    const pivot = focusInfo.point.clone();
    const currentDistance =
      focusInfo.distance ?? this.camera.position.distanceTo(pivot);

    // Reset controls first so the preset starts from a clean orbit state,
    // while still preserving the desired distance and pivot.
    this.controls.reset();

    if (preset === "Anterior") {
      this.camera.position.set(pivot.x, pivot.y + currentDistance, pivot.z);
    } else if (preset === "Posterior") {
      this.camera.position.set(pivot.x, pivot.y - currentDistance, pivot.z);
    } else if (preset === "Left lateral") {
      this.camera.position.set(pivot.x - currentDistance, pivot.y, pivot.z);
    } else if (preset === "Right lateral") {
      this.camera.position.set(pivot.x + currentDistance, pivot.y, pivot.z);
    } else {
      return;
    }

    this.camera.up.set(0, 0, 1);
    this.setControlsTarget(pivot);
    this.controls.update();
  }
  /**
   * Zooms the camera in toward the current zoom focus target.
   */
  zoomIn() {
    const focusInfo = this.getZoomFocusInfo();
    if (focusInfo?.point) {
      this.setControlsTarget(focusInfo.point);
    }

    this.dollyToFocus(0.85);
  }

  /**
   * Zooms the camera out away from the current zoom focus target.
   */
  zoomOut() {
    const focusInfo = this.getZoomFocusInfo();
    if (focusInfo?.point) {
      this.setControlsTarget(focusInfo.point);
    }

    this.dollyToFocus(1.18);
  }

  /**
   * Moves the camera toward or away from the current focus target by scaling the camera offset vector.
   *
   * @param {number} scale Scale factor applied to the camera-to-focus offset.
   */
  dollyToFocus(scale) {
    if (!this.camera) return;

    const focus = this.getZoomFocusInfo().point;
    const v = new THREE.Vector3().subVectors(this.camera.position, focus);
    v.multiplyScalar(scale);

    this.camera.position.copy(focus).add(v);
    this.controls?.update();
  }

  /**
   * Returns the current focus point used for framing and control targeting.
   *
   * @returns {THREE.Vector3} Current focus point.
   */
  getFocusPoint() {
    if (this.hasFocusPoint) return this.focusPoint;
    if (this.controls?.target) return this.controls.target;
    return this.focusPoint;
  }

  /**
   * Updates the Arcball control target using whichever target APIs are available.
   *
   * @param {THREE.Vector3} point New target point.
   */
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

  /**
   * Starts or continues the render loop, invoking optional pre/post render hooks.
   */
  animate() {
    this._raf = requestAnimationFrame(() => this.animate());

    // Allow subclasses to update scene state immediately before rendering each frame.
    if (typeof this.beforeRender === "function") {
      this.beforeRender();
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    // Allow subclasses to react after the frame has been rendered.
    if (typeof this.afterRender === "function") {
      this.afterRender();
    }
  }

  /**
   * Resizes the renderer and camera projection to match the current host element size.
   */
  resizeToHost() {
    const { width, height } = this.getHostSize();
    if (!this.camera || !this.renderer) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Measures the host element and returns a non-zero render size.
   *
   * @returns {{ width: number, height: number }} Current host dimensions.
   */
  getHostSize() {
    const r = this.host.getBoundingClientRect();
    return {
      width: Math.max(1, r.width),
      height: Math.max(1, r.height),
    };
  }

  /**
   * Cleans up renderer resources, observers, controls, and scene-owned geometry/materials.
   */
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