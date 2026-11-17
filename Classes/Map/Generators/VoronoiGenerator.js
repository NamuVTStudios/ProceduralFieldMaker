/** Ruido celular Voronoi determinista para regiones/biomas 2D sobre XZ. */
class VoronoiGenerator {
  constructor(seed = 'DEFAULT_SEED') {
    this.seedHash = hashSeedToInt(String(seed));
  }

  getValue2D(x, z, cellSize = 16) {
    const size = this._normalizeCellSize(cellSize);
    const nearest = this._findNearestFeature(x, z, size);
    return this._hashCellValue(nearest.cellX, nearest.cellZ);
  }

  _normalizeCellSize(cellSize) {
    const value = Number(cellSize);
    return Number.isFinite(value) ? Math.max(2, value) : 16;
  }

  _findNearestFeature(x, z, cellSize) {
    const cellX = Math.floor(x / cellSize);
    const cellZ = Math.floor(z / cellSize);
    const result = { distance: Infinity, cellX, cellZ };
    this._searchFeatureRows(x, z, cellSize, cellX, cellZ, result);
    return result;
  }

  _searchFeatureRows(x, z, cellSize, cellX, cellZ, result) {
    for (let offsetZ = -1; offsetZ <= 1; offsetZ++) {
      this._searchFeatureColumns(x, z, cellSize, cellX, cellZ, offsetZ, result);
    }
  }

  _searchFeatureColumns(x, z, cellSize, cellX, cellZ, offsetZ, result) {
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      this._considerFeaturePoint(x, z, cellSize, cellX + offsetX, cellZ + offsetZ, result);
    }
  }

  _considerFeaturePoint(x, z, cellSize, cellX, cellZ, result) {
    const point = this._createFeaturePoint(cellX, cellZ, cellSize);
    const distance = this._getSquaredDistance(x, z, point.x, point.z);
    if (distance >= result.distance) return;
    result.distance = distance;
    result.cellX = cellX;
    result.cellZ = cellZ;
  }

  _createFeaturePoint(cellX, cellZ, cellSize) {
    const base = this._hashCoordinates(cellX, cellZ, 0);
    const next = this._hashCoordinates(cellX, cellZ, 1);
    return {
      x: (cellX + 0.15 + base / 0xFFFFFFFF * 0.7) * cellSize,
      z: (cellZ + 0.15 + next / 0xFFFFFFFF * 0.7) * cellSize,
    };
  }

  _hashCoordinates(cellX, cellZ, salt) {
    let value = this.seedHash ^ Math.imul(cellX, 374761393) ^ Math.imul(cellZ, 668265263) ^ Math.imul(salt + 1, 1442695041);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return (value ^ (value >>> 16)) >>> 0;
  }

  _hashCellValue(cellX, cellZ) {
    return this._hashCoordinates(cellX, cellZ, 2) / 0xFFFFFFFF;
  }

  _getSquaredDistance(x1, z1, x2, z2) {
    const dx = x1 - x2;
    const dz = z1 - z2;
    return dx * dx + dz * dz;
  }
}
