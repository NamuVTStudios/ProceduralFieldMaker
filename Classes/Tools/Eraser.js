/** Goma: destruye materiales según la dureza y la energía configurada. */
class Eraser extends Tools {
  constructor(appManager) {
    super(appManager);
    this.name = 'Eraser';
    this.label = 'Eraser';
    this.radius = 4;
    this.impactEnergy = 6;
  }

  onPointerDown(event, coordinates) {
    this.isDrawing = true;
    this._eraseAt(coordinates);
  }

  onPointerMove(event, coordinates) {
    if (!this.isDrawing) return;
    this._eraseAt(coordinates);
  }

  onPointerUp() {
    this.isDrawing = false;
  }

  _eraseAt(coordinates) {
    const mapData = this.getEditableMapData();
    if (!mapData || !coordinates) return;
    const center = this._normalizeCenter(coordinates);
    const result = this.appManager.destructionEngine.applyEraser(mapData, center, this.radius, this.impactEnergy);
    if (result.anyDestroyed) this.commitToolChanges();
  }

  _normalizeCenter(coordinates) {
    return {
      x: Math.floor(coordinates.x),
      y: Math.floor(coordinates.y),
      z: Math.floor(coordinates.z ?? 0),
    };
  }
}
