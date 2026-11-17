/** Aplica una explosión destructible en el punto seleccionado del terreno. */
class TerrainBlastTool extends Tools {
  constructor(appManager) {
    super(appManager);
    this.name = 'TerrainBlastTool';
    this.label = 'Explosión';
    this.radius = 6;
    this.energy = 12;
    this.falloff = 0.6;
  }

  onPointerDown(event, coordinates) {
    if (!coordinates) return;
    this._explodeAt(coordinates);
  }

  _explodeAt(point) {
    const center = this._normalizeCenter(point);
    this.appManager.explodeTerrain(center, this._getExplosionOptions());
  }

  _normalizeCenter(point) {
    return { x: Math.floor(point.x), y: Math.floor(point.y), z: Math.floor(point.z ?? 0) };
  }

  _getExplosionOptions() {
    return { radius: this.radius, energy: this.energy, falloff: this.falloff };
  }

  onPointerMove() {}
  onPointerUp() {}
}
