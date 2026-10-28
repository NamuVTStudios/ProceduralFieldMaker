/**
 * CameraController3D.js
 * Controlador de cámara 3D estilo Blender para Babylon.js.
 * Modos intercambiables: Órbita (inspección) y Vuelo Libre (WASD/Flythrough).
 * Refactorizado bajo la regla estricta de un máximo de 3 subtareas por método.
 */
class CameraController3D extends AppObject {
  /**
   * @param {object} appManager
   * @param {BABYLON.Scene} scene
   * @param {HTMLCanvasElement} canvasElement
   */
  constructor(appManager, scene, canvasElement) {
    super(appManager);
    this.scene = scene;
    this.canvas = canvasElement;
    this.mode = 'orbit';

    this.orbitCamera = null;
    this.flyCamera = null;
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  onInit() {
    if (!this.scene || !this.canvas) return;
    this._instantiateCameras();
    this._applyMode();
    window.addEventListener('keydown', this._onKeyDown);
  }

  _instantiateCameras() {
    this._createOrbitCamera();
    this._createFlythroughCamera();
  }

  _createOrbitCamera() {
    const targetVector = new BABYLON.Vector3(32, 16, 32);
    this.orbitCamera = new BABYLON.ArcRotateCamera('orbitCam', Math.PI / 4, Math.PI / 3, 80, targetVector, this.scene);
    this.orbitCamera.wheelPrecision = 15;
    this.orbitCamera.lowerRadiusLimit = 5;
  }

  _createFlythroughCamera() {
    const posVector = new BABYLON.Vector3(32, 20, -10);
    this.flyCamera = new BABYLON.UniversalCamera('flyCam', posVector, this.scene);
    this.flyCamera.speed = 1.0;
    this._setupFlyCameraKeys();
  }

  _setupFlyCameraKeys() {
    this._setVerticalFlyKeys();
    this._setHorizontalFlyKeys();
  }

  _setVerticalFlyKeys() {
    this.flyCamera.keysUp =; // Tecla W
    this.flyCamera.keysDown =; // Tecla S
  }

  _setHorizontalFlyKeys() {
    this.flyCamera.keysLeft =; // Tecla A
    this.flyCamera.keysRight =; // Tecla D
  }

  _applyMode() {
    if (this.mode === 'orbit') {
      this._activateOrbitCam();
    } else {
      this._activateFlythroughCam();
    }
  }

  _activateOrbitCam() {
    this.flyCamera.detachControl();
    this.scene.activeCamera = this.orbitCamera;
    this.orbitCamera.attachControl(this.canvas, true);
  }

  _activateFlythroughCam() {
    this.orbitCamera.detachControl();
    this._synchronizeFlyCamTransforms();
    this.scene.activeCamera = this.flyCamera;
    this.flyCamera.attachControl(this.canvas, true);
  }

  _synchronizeFlyCamTransforms() {
    this.flyCamera.position.copyFrom(this.orbitCamera.position);
    this.flyCamera.setTarget(this.orbitCamera.target);
  }

  toggleMode() {
    this.mode = this.mode === 'orbit' ? 'flythrough' : 'orbit';
    this._applyMode();
  }

  _onKeyDown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      this.toggleMode();
    }
  }

  onDestroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    this._disposeCameras();
  }

  _disposeCameras() {
    this._disposeOrbitCamera();
    this._disposeFlyCamera();
  }

  _disposeOrbitCamera() {
    if (!this.orbitCamera) return;
    this.orbitCamera.dispose();
    this.orbitCamera = null;
  }

  _disposeFlyCamera() {
    if (!this.flyCamera) return;
    this.flyCamera.dispose();
    this.flyCamera = null;
  }
}