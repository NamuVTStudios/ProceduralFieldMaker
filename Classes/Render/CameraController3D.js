/**
 * CameraController3D.js
 * Controlador de cámara 3D: órbita y vuelo libre.
 * Los cambios de modo y la configuración de teclas están separados en subtareas.
 */
class CameraController3D extends AppObject {
  constructor(appManager, scene, canvasElement) {
    super(appManager);
    this.scene = scene;
    this.canvas = canvasElement;
    this.mode = 'orbit';
    this.orbitCamera = null;
    this.flyCamera = null;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onContextMenu = event => event.preventDefault();
  }

  onInit() {
    if (!this.scene || !this.canvas) return;
    this._instantiateCameras();
    this._applyMode();
    this._bindBrowserControls();
  }

  _bindBrowserControls() {
    window.addEventListener('keydown', this._onKeyDown);
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  _instantiateCameras() {
    this._createOrbitCamera();
    this._createFlythroughCamera();
  }

  _createOrbitCamera() {
    const config = this._getOrbitCameraConfig();
    this.orbitCamera = new BABYLON.ArcRotateCamera('orbitCam', Math.PI / 4, Math.PI / 3, config.radius, config.target, this.scene);
    this._configureOrbitCamera();
  }

  _getOrbitCameraConfig() {
    const dimensions = this._getMapDimensions();
    return {
      target: this._createMapCenter(dimensions),
      radius: this._calculateInitialRadius(dimensions),
    };
  }

  _getMapDimensions() {
    const mapData = this.getMapData();
    return {
      x: mapData?.sizeX || 64,
      y: mapData?.sizeY || 32,
      z: mapData?.sizeZ || 64,
    };
  }

  _createMapCenter(dimensions) {
    return new BABYLON.Vector3(dimensions.x / 2, dimensions.y / 2, dimensions.z / 2);
  }

  _calculateInitialRadius(dimensions) {
    return Math.max(dimensions.x, dimensions.y, dimensions.z) * 1.65;
  }

  _configureOrbitCamera() {
    this.orbitCamera.wheelPrecision = 15;
    this.orbitCamera.lowerRadiusLimit = 5;
    this._configureOrbitPointerButtons();
    this.orbitCamera.minZ = 0.1;
    this.orbitCamera.maxZ = 10000;
  }

  _configureOrbitPointerButtons() {
    const pointerInput = this.orbitCamera.inputs?.attached?.pointers;
    if (!pointerInput) return;
    pointerInput.buttons = [1, 2];
    this._configureOrbitPointerInteractions();
  }

  _configureOrbitPointerInteractions() {
    const inputMap = this.orbitCamera.movement?.input;
    if (!inputMap?.setInteraction) return;
    inputMap.setInteraction('pointer', { button: 2 }, 'rotate');
    inputMap.setInteraction('pointer', { button: 1 }, 'pan');
  }

  _createFlythroughCamera() {
    const position = this._getFlythroughStartPosition();
    this.flyCamera = new BABYLON.UniversalCamera('flyCam', position, this.scene);
    this._configureFlythroughCamera();
  }

  _getFlythroughStartPosition() {
    const dimensions = this._getMapDimensions();
    return new BABYLON.Vector3(dimensions.x / 2, dimensions.y / 2, -10);
  }

  _configureFlythroughCamera() {
    this.flyCamera.speed = 1;
    this._setupFlyCameraKeys();
    this._configureFlyPointerButtons();
  }

  _configureFlyPointerButtons() {
    const mouseInput = this.flyCamera.inputs?.attached?.mouse;
    if (!mouseInput) return;
    mouseInput.buttons = [1, 2];
  }

  _setupFlyCameraKeys() {
    this.flyCamera.keysUp = [87];
    this.flyCamera.keysDown = [83];
    this.flyCamera.keysLeft = [65];
    this.flyCamera.keysRight = [68];
  }

  _applyMode() {
    if (this.mode === 'orbit') {
      this._activateOrbitCam();
      return;
    }
    this._activateFlythroughCam();
  }

  _activateOrbitCam() {
    this.flyCamera.detachControl();
    this.scene.activeCamera = this.orbitCamera;
    this.orbitCamera.attachControl(this.canvas, false);
    this._configureOrbitPointerButtons();
  }

  _activateFlythroughCam() {
    this.orbitCamera.detachControl();
    this._synchronizeFlyCamTransforms();
    this.scene.activeCamera = this.flyCamera;
    this.flyCamera.attachControl(this.canvas, false);
    this._configureFlyPointerButtons();
  }

  _synchronizeFlyCamTransforms() {
    this.flyCamera.position.copyFrom(this.orbitCamera.position);
    this.flyCamera.setTarget(this.orbitCamera.target);
  }

  toggleMode() {
    this.mode = this.mode === 'orbit' ? 'flythrough' : 'orbit';
    this._applyMode();
    this.appManager.ui?.refreshCameraModeUI?.();
  }

  _onKeyDown(event) {
    if (event.key !== 'Tab') return;
    if (this._isInteractiveTarget(event.target)) return;
    event.preventDefault();
    this.toggleMode();
  }

  _isInteractiveTarget(target) {
    return Boolean(target?.closest?.('button, input, select, textarea, a, [contenteditable="true"]'));
  }

  onDestroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    this.canvas?.removeEventListener('contextmenu', this._onContextMenu);
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
