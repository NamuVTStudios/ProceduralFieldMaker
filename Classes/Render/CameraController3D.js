/**
 * CameraController3D.js
 * Controlador de cámara 3D estilo Blender para Babylon.js.
 * Modos intercambiables: Órbita (inspección) y Vuelo Libre (WASD/Flythrough).
 */
import { AppObject } from '../Base/AppObject.js';

export class CameraController3D extends AppObject {
  /**
   * @param {object} appManager
   * @param {BABYLON.Scene} scene
   * @param {HTMLCanvasElement} canvasElement
   */
  constructor(appManager, scene, canvasElement) {
    super(appManager);
    this.scene = scene;
    this.canvas = canvasElement;

    this.mode = 'orbit'; // 'orbit' | 'flythrough'

    this.orbitCamera = null;
    this.flyCamera = null;

    this._onKeyDown = this._onKeyDown.bind(this);
  }

  onInit() {
    if (!this.scene || !this.canvas) return;

    // 1. Cámara de Órbita (ArcRotateCamera)
    this.orbitCamera = new BABYLON.ArcRotateCamera(
      'orbitCam',
      Math.PI / 4,
      Math.PI / 3,
      80,
      new BABYLON.Vector3(32, 16, 32),
      this.scene
    );
    this.orbitCamera.wheelPrecision = 15;
    this.orbitCamera.lowerRadiusLimit = 5;

    // 2. Cámara de Vuelo Libre (UniversalCamera con WASD)
    this.flyCamera = new BABYLON.UniversalCamera(
      'flyCam',
      new BABYLON.Vector3(32, 20, -10),
      this.scene
    );
    this.flyCamera.speed = 1.0;
    this.flyCamera.keysUp = [87];    // W
    this.flyCamera.keysDown = [83];  // S
    this.flyCamera.keysLeft = [65];  // A
    this.flyCamera.keysRight = [68]; // D

    // Activar modo inicial
    this._applyMode();

    window.addEventListener('keydown', this._onKeyDown);
  }

  _applyMode() {
    if (this.mode === 'orbit') {
      this.flyCamera.detachControl();
      this.scene.activeCamera = this.orbitCamera;
      this.orbitCamera.attachControl(this.canvas, true);
    } else {
      this.orbitCamera.detachControl();
      // Copiar posición y orientación aproximada al entrar a vuelo libre
      this.flyCamera.position.copyFrom(this.orbitCamera.position);
      this.flyCamera.setTarget(this.orbitCamera.target);
      this.scene.activeCamera = this.flyCamera;
      this.flyCamera.attachControl(this.canvas, true);
    }
  }

  toggleMode() {
    this.mode = this.mode === 'orbit' ? 'flythrough' : 'orbit';
    this._applyMode();
  }

  _onKeyDown(e) {
    // Alternar modo con tecla Tab (especificación del TDD 3.3)
    if (e.key === 'Tab') {
      e.preventDefault();
      this.toggleMode();
    }
  }

  onDestroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    if (this.orbitCamera) {
      this.orbitCamera.dispose();
      this.orbitCamera = null;
    }
    if (this.flyCamera) {
      this.flyCamera.dispose();
      this.flyCamera = null;
    }
  }
}