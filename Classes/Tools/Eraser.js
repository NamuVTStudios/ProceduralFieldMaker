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
    if (!coordinates) return;
    this.isDrawing = true;
    this.lastErasePoint = this._normalizeCenter(coordinates);
    this._eraseAt(coordinates);
  }

  onPointerMove(event, coordinates) {
    if (!this.isDrawing || !coordinates) return;
    const nextPoint = this._normalizeCenter(coordinates);
    this._eraseBetweenPoints(this.lastErasePoint, nextPoint);
    this.lastErasePoint = nextPoint;
  }

  onPointerUp() {
    this.isDrawing = false;
    this.lastErasePoint = null;
  }

  _eraseBetweenPoints(start, end) {
    if (!start || !end) return this._eraseAt(end);
    const steps = this._getInterpolationSteps(start, end);
    for (let step = 1; step <= steps; step++) {
      this._eraseAt(this._interpolatePoint(start, end, step / steps));
    }
  }

  _getInterpolationSteps(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return Math.max(1, Math.ceil(distance / Math.max(1, this.radius * 0.45)));
  }

  _interpolatePoint(start, end, amount) {
    return {
      x: start.x + (end.x - start.x) * amount,
      y: start.y + (end.y - start.y) * amount,
      z: start.z + (end.z - start.z) * amount,
    };
  }

  _eraseAt(coordinates) {
    if (!this.appManager.mapData || !coordinates) return;
    const center = this._normalizeCenter(coordinates);
    const layerManager = this.getMapLayerManager();
    const result = layerManager?.eraseVisibleTerrain?.(center, this.radius, this.impactEnergy);
    if (result) return;
    const mapData = this.getEditableMapData();
    if (!mapData) return;
    const fallback = this.appManager.destructionEngine.applyEraser(mapData, center, this.radius, this.impactEnergy);
    if (fallback.anyDestroyed) this.commitToolChanges();
  }

  _normalizeCenter(coordinates) {
    return {
      x: Math.floor(coordinates.x),
      y: Math.floor(coordinates.y),
      z: Math.floor(coordinates.z ?? 0),
    };
  }
}
