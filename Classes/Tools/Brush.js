/** Pincel: deposita material en celdas/vóxeles vacíos. */
class Brush extends Tools {
  constructor(appManager) {
    super(appManager);
    this.name = 'Brush';
    this.label = 'Brush';
    this.radius = 4;
    this.selectedMaterialId = 2;
  }

  onPointerDown(event, coordinates) {
    this.isDrawing = true;
    this._applyAt(coordinates);
  }

  onPointerMove(event, coordinates) {
    if (!this.isDrawing) return;
    this._applyAt(coordinates);
  }

  onPointerUp() {
    this.isDrawing = false;
  }

  _applyAt(coordinates) {
    if (!this.prepareMaterialLayer(this.selectedMaterialId)) return;
    const context = this._createBrushContext(coordinates);
    if (!context) return;
    this._applyBrushContext(context);
  }

  _createBrushContext(coordinates) {
    const mapData = this.getEditableMapData();
    if (!mapData || !coordinates) return null;
    return { mapData, center: this._normalizeCenter(coordinates) };
  }

  _applyBrushContext(context) {
    const result = this.appManager.destructionEngine.applyBrush(
      context.mapData, context.center, this.radius, this.selectedMaterialId,
    );
    if (result.affectedRegion) this.commitToolChanges();
  }

  _normalizeCenter(coordinates) {
    return {
      x: Math.floor(coordinates.x),
      y: Math.floor(coordinates.y),
      z: Math.floor(coordinates.z ?? 0),
    };
  }
}
