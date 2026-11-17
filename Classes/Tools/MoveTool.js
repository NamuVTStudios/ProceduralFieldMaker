/** Mueve el contenido de una o varias capas seleccionadas mediante arrastre. */
class MoveTool extends Tools {
  constructor(appManager) {
    super(appManager);
    this.name = 'MoveTool';
    this.label = 'Mover';
    this.isMoving = false;
    this.lastPosition = null;
  }

  onPointerDown(event, coordinates) {
    if (!coordinates) return;
    this.isMoving = true;
    this.lastPosition = this._normalizePosition(coordinates);
  }

  onPointerMove(event, coordinates) {
    if (!this.isMoving || !coordinates) return;
    this._moveFromPointer(coordinates);
  }

  _moveFromPointer(coordinates) {
    const next = this._normalizePosition(coordinates);
    const delta = this._getPositionDelta(next);
    if (!this._hasOffset(delta)) return this._rememberPosition(next);
    this.getMapLayerManager()?.translateSelectedLayers(delta);
    this._rememberPosition(next);
  }

  _getPositionDelta(next) {
    return {
      x: next.x - this.lastPosition.x,
      y: next.y - this.lastPosition.y,
      z: next.z - this.lastPosition.z,
    };
  }

  _hasOffset(delta) {
    return Boolean(delta.x || delta.y || delta.z);
  }

  _rememberPosition(position) {
    this.lastPosition = position;
  }

  _normalizePosition(point) {
    return { x: Math.round(point.x), y: Math.round(point.y), z: Math.round(point.z ?? 0) };
  }

  onPointerUp() {
    this.isMoving = false;
    this.lastPosition = null;
  }
}
