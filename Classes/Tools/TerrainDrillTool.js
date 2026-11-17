/** Perfora un túnel desde el inicio hasta el final de un arrastre. */
class TerrainDrillTool extends Tools {
  constructor(appManager) {
    super(appManager);
    this.name = 'TerrainDrillTool';
    this.label = 'Taladro';
    this.radius = 1.8;
    this.energy = 14;
    this.falloff = 0.25;
    this.startPoint = null;
    this.endPoint = null;
  }

  onPointerDown(event, coordinates) {
    if (!coordinates) return;
    this._beginDrilling(coordinates);
  }

  _beginDrilling(point) {
    this.startPoint = this._normalizePoint(point);
    this.endPoint = this.startPoint;
  }

  onPointerMove(event, coordinates) {
    if (!this.startPoint || !coordinates) return;
    this.endPoint = this._normalizePoint(coordinates);
  }

  onPointerUp() {
    if (!this.startPoint || !this.endPoint) return this._resetDrill();
    this._applyDrill();
    this._resetDrill();
  }

  _applyDrill() {
    this.appManager.drillTerrain(this.startPoint, this.endPoint, this._getDrillOptions());
  }

  _normalizePoint(point) {
    return { x: Math.floor(point.x), y: Math.floor(point.y), z: Math.floor(point.z ?? 0) };
  }

  _getDrillOptions() {
    return { radius: this.radius, energy: this.energy, falloff: this.falloff };
  }

  _resetDrill() {
    this.startPoint = null;
    this.endPoint = null;
  }
}
