/**
 * CameraController2D.js
 * Controlador de cámara 2D estilo Photoshop para Pixi.js.
 * Paneo con botón secundario/central y zoom enfocado a la posición del cursor.
 * Refactorizado bajo la regla estricta de un máximo de 3 subtareas por método.
 */
class CameraController2D extends AppObject {
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

    this._bindContexts();
  }

  _bindContexts() {
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
  }

  onInit() {
    if (!this.canvas) return;
    this._addListeners();
  }

  _addListeners() {
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  screenToWorld(screenX, screenY) {
    if (!this.worldContainer) return { x: screenX, y: screenY };
    return this._calculateWorldPosition(screenX, screenY);
  }

  _calculateWorldPosition(sX, sY) {
    return {
      x: (sX - this.worldContainer.position.x) / this.zoomLevel,
      y: (sY - this.worldContainer.position.y) / this.zoomLevel
    };
  }

  _onPointerDown(e) {
    if (e.button === 1 || e.button === 2) {
      this._startPanning(e.clientX, e.clientY);
    }
  }

  _startPanning(clientX, clientY) {
    this.isPanning = true;
    this.lastPanX = clientX;
    this.lastPanY = clientY;
  }

  _onPointerMove(e) {
    if (!this.isPanning || !this.worldContainer) return;
    this._applyPanningDelta(e.clientX, e.clientY);
  }

  _applyPanningDelta(clientX, clientY) {
    const dx = clientX - this.lastPanX;
    const dy = clientY - this.lastPanY;
    this._shiftWorldPosition(dx, dy);
    this._updateLastPanCoordinates(clientX, clientY);
  }

  _shiftWorldPosition(dx, dy) {
    this.worldContainer.position.x += dx;
    this.worldContainer.position.y += dy;
  }

  _updateLastPanCoordinates(clientX, clientY) {
    this.lastPanX = clientX;
    this.lastPanY = clientY;
  }

  _onPointerUp(e) {
    if (e.button === 1 || e.button === 2) {
      this.isPanning = false;
    }
  }

  _onWheel(e) {
    e.preventDefault();
    if (!this.worldContainer) return;
    this._processZoomFocalized(e);
  }

  _processZoomFocalized(e) {
    const cursor = this._getCursorRelativeCoords(e.clientX, e.clientY);
    const worldBefore = this.screenToWorld(cursor.x, cursor.y);
    this._executeZoomScaling(e.deltaY);
    const worldAfter = this.screenToWorld(cursor.x, cursor.y);
    this._adjustWorldPositionFocalized(worldBefore, worldAfter);
  }

  _getCursorRelativeCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  _executeZoomScaling(deltaY) {
    const factor = deltaY > 0 ? 0.9 : 1.1;
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * factor));
    this.worldContainer.scale.set(this.zoomLevel);
  }

  _adjustWorldPositionFocalized(before, after) {
    this.worldContainer.position.x += (after.x - before.x) * this.zoomLevel;
    this.worldContainer.position.y += (after.y - before.y) * this.zoomLevel;
  }

  onDestroy() {
    if (!this.canvas) return;
    this._removeListeners();
  }

  _removeListeners() {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
  }
}