/** Tampón de clonación 2D con origen fijado mediante Alt + clic. */
class CloneStamp extends Tools {
  constructor(appManager) {
    super(appManager);
    this.name = 'CloneStamp';
    this.label = 'Clone Stamp';
    this.radius = 4;
    this.source = null;
    this.isDrawing = false;
  }

  onPointerDown(event, coordinates) {
    if (!this.isProjectMode2D() || !coordinates) return;
    if (event?.altKey) return this._setSource(coordinates);
    this.isDrawing = Boolean(this.source);
    this._stampAt(coordinates);
  }

  onPointerMove(event, coordinates) {
    if (!this.isDrawing || !coordinates) return;
    this._stampAt(coordinates);
  }

  onPointerUp() {
    this.isDrawing = false;
  }

  _setSource(coordinates) {
    this.source = this._normalizePoint(coordinates);
  }

  _stampAt(coordinates) {
    if (!this.source || !coordinates) return;
    const mapData = this.getEditableMapData();
    if (!mapData || this.appManager.mode !== '2d') return;
    const target = this._normalizePoint(coordinates);
    this.appManager.destructionEngine.applyCloneStamp(mapData, this.source, target, this.radius);
    this.commitToolChanges();
  }

  _normalizePoint(coordinates) {
    return { x: Math.floor(coordinates.x), y: Math.floor(coordinates.y) };
  }

  onDeactivate() {
    super.onDeactivate();
    this.isDrawing = false;
  }
}
