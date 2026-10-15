/**
 * CameraController2D.js
 * Controlador de cámara 2D estilo Photoshop para Pixi.js.
 * Paneo con botón secundario/central y zoom enfocado a la posición del cursor.
 */
import { AppObject } from '../Base/AppObject.js';

export class CameraController2D extends AppObject {
  /**
   * @param {object} appManager
   * @param {PIXI.Container} worldContainer Contenedor del mundo de Renderer2D
   * @param {HTMLCanvasElement} canvasElement
   */
  constructor(appManager, worldContainer, canvasElement) {
    super(appManager);
    this.worldContainer = worldContainer;
    this.canvas = canvasElement;

    this.zoomLevel = 1.0;
    this.minZoom = 0.1;
    this.maxZoom = 10.0;

    this.isPanning = false;
    this.lastPanX = 0;
    this.lastPanY = 0;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
  }

  onInit() {
    if (!this.canvas) return;

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });

    // Evitar el menú contextual del navegador al panear con click derecho
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  screenToWorld(screenX, screenY) {
    if (!this.worldContainer) return { x: screenX, y: screenY };
    return {
      x: (screenX - this.worldContainer.position.x) / this.zoomLevel,
      y: (screenY - this.worldContainer.position.y) / this.zoomLevel
    };
  }

  _onPointerDown(e) {
    // Paneo con botón secundario (2) o central/rueda (1)
    if (e.button === 1 || e.button === 2) {
      this.isPanning = true;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
    }
  }

  _onPointerMove(e) {
    if (!this.isPanning || !this.worldContainer) return;

    const dx = e.clientX - this.lastPanX;
    const dy = e.clientY - this.lastPanY;

    this.worldContainer.position.x += dx;
    this.worldContainer.position.y += dy;

    this.lastPanX = e.clientX;
    this.lastPanY = e.clientY;
  }

  _onPointerUp(e) {
    if (e.button === 1 || e.button === 2) {
      this.isPanning = false;
    }
  }

  _onWheel(e) {
    e.preventDefault();
    if (!this.worldContainer) return;

    const rect = this.canvas.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    // Zoom focalizado al cursor (especificación del TDD 3.3)
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * zoomFactor));

    const worldBefore = this.screenToWorld(cursorX, cursorY);
    this.zoomLevel = newZoom;
    this.worldContainer.scale.set(this.zoomLevel);

    const worldAfter = this.screenToWorld(cursorX, cursorY);

    this.worldContainer.position.x += (worldAfter.x - worldBefore.x) * this.zoomLevel;
    this.worldContainer.position.y += (worldAfter.y - worldBefore.y) * this.zoomLevel;
  }

  onDestroy() {
    if (!this.canvas) return;
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
  }
}