/** Adaptador único de Pointer Events para herramientas 2D y 3D. */
class PointerInputController {
  constructor(canvas, toolsManager, coordinateResolver) {
    this.canvas = canvas;
    this.toolsManager = toolsManager;
    this.coordinateResolver = coordinateResolver;
    this.activePointerId = null;
    this.isAttached = false;
    this._bindHandlers();
  }

  _bindHandlers() {
    this._onPointerDown = event => this._handlePointerDown(event);
    this._onPointerMove = event => this._handlePointerMove(event);
    this._onPointerUp = event => this._handlePointerUp(event);
    this._onPointerCancel = event => this._handlePointerCancel(event);
  }

  attach() {
    if (!this.canvas || this.isAttached) return false;
    this._addEventListeners();
    this.isAttached = true;
    return true;
  }

  _addEventListeners() {
    this.canvas.addEventListener('pointerdown', this._onPointerDown, { passive: false });
    window.addEventListener('pointermove', this._onPointerMove, { passive: false });
    window.addEventListener('pointerup', this._onPointerUp, { passive: false });
    window.addEventListener('pointercancel', this._onPointerCancel, { passive: false });
  }

  _handlePointerDown(event) {
    if (event.button !== 0 || this.activePointerId !== null) return;
    this._startPointer(event);
  }

  _startPointer(event) {
    this.activePointerId = event.pointerId;
    this._beginHistoryTransaction();
    this._capturePointer(event);
    this._dispatch('onPointerDown', event);
  }

  _beginHistoryTransaction() {
    this._getHistoryManager()?.beginHistoryTransaction('Trazo');
  }

  _capturePointer(event) {
    event.preventDefault();
    if (typeof this.canvas.setPointerCapture !== 'function') return;
    this.canvas.setPointerCapture(event.pointerId);
  }

  _handlePointerMove(event) {
    if (!this._isActivePointer(event)) return;
    this._dispatch('onPointerMove', event);
  }

  _handlePointerUp(event) {
    if (!this._isActivePointer(event)) return;
    this._finishPointer(event);
  }

  _handlePointerCancel(event) {
    if (!this._isActivePointer(event)) return;
    this._cancelPointer(event);
  }

  _finishPointer(event) {
    try {
      this._dispatch('onPointerUp', event, null);
    } finally {
      this._endHistoryTransaction();
      this._releasePointer(event);
    }
  }

  _endHistoryTransaction() {
    this._getHistoryManager()?.endHistoryTransaction();
  }

  _cancelHistoryTransaction() {
    this._getHistoryManager()?.cancelHistoryTransaction();
  }

  _cancelPointer(event) {
    try {
      this._dispatch('onPointerUp', event, null);
    } finally {
      this._cancelHistoryTransaction();
      this._releasePointer(event);
    }
  }

  _getHistoryManager() {
    return this.toolsManager.appManager?.mapLayerManager || null;
  }

  _isActivePointer(event) {
    return this.activePointerId !== null && event.pointerId === this.activePointerId;
  }

  _dispatch(methodName, event, coordinates) {
    event?.preventDefault?.();
    const point = coordinates === null ? null : this.coordinateResolver(event);
    if (methodName !== 'onPointerUp' && !point) return;
    this.toolsManager.dispatchPointer(methodName, event, point);
  }

  _releasePointer(event) {
    this._releasePointerCapture(event.pointerId);
    this.activePointerId = null;
  }

  _releasePointerCapture(pointerId) {
    if (typeof this.canvas.releasePointerCapture !== 'function') return;
    if (this.canvas.hasPointerCapture?.(pointerId)) this.canvas.releasePointerCapture(pointerId);
  }

  detach() {
    if (!this.canvas || !this.isAttached) return;
    try {
      this._finishActiveStroke();
    } finally {
      this._removeEventListeners();
      this.isAttached = false;
    }
  }

  _finishActiveStroke() {
    if (this.activePointerId === null) return;
    const pointerId = this.activePointerId;
    try {
      this.toolsManager.dispatchPointer('onPointerUp', null, null);
    } finally {
      this._endHistoryTransaction();
      this._releasePointerCapture(pointerId);
      this.activePointerId = null;
    }
  }

  _removeEventListeners() {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerCancel);
  }
}
