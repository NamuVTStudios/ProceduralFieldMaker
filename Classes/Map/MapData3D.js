/**
 * MapData3D.js
 * Estructura de datos plana para el modo 3D.
 * Refactorizado en subtareas planas de un máximo de 3 subtareas por función.
 */

/** Crea una estructura MapData3D vacía (llena de aire). */
function createMapData3D(config) {
  const size = config.sizeX * config.sizeY * config.sizeZ;
  return {
    sizeX: config.sizeX,
    sizeY: config.sizeY,
    sizeZ: config.sizeZ,
    chunkSize: config.chunkSize ?? 16,
    voxels: new Uint8Array(size).fill(AIR_MATERIAL_ID),
    materials: config.materials,
    seed: config.seed,
    seedHash: hashSeedToInt(config.seed),
  };
}

/** Índice plano de un voxel 3D. */
function getVoxelIndex3D(mapData3D, x, y, z) {
  return (y * mapData3D.sizeZ + z) * mapData3D.sizeX + x;
}

function getVoxel3D(mapData3D, x, y, z) {
  if (this._isOutOfBounds3D(mapData3D, x, y, z)) return AIR_MATERIAL_ID;
  const idx = getVoxelIndex3D(mapData3D, x, y, z);
  return mapData3D.voxels[idx];
}

function setVoxel3D(mapData3D, x, y, z, materialId) {
  if (this._isOutOfBounds3D(mapData3D, x, y, z)) return;
  const idx = getVoxelIndex3D(mapData3D, x, y, z);
  mapData3D.voxels[idx] = materialId;
}

function _isOutOfBounds3D(mapData3D, x, y, z) {
  return x < 0 || y < 0 || z < 0 || x >= mapData3D.sizeX || y >= mapData3D.sizeY || z >= mapData3D.sizeZ;
}

/** Extruye un heightmap a un MapData3D rellenando volumétricamente por debajo de la columna. */
function applyHeightmapToMapData3D(mapData3D, heightmap, solidMaterialId) {
  for (let z = 0; z < mapData3D.sizeZ; z++) {
    _applyHeightmapRow(mapData3D, heightmap, solidMaterialId, z);
  }
}

function _applyHeightmapRow(mapData3D, heightmap, solidMaterialId, z) {
  for (let x = 0; x < mapData3D.sizeX; x++) {
    const columnHeight = heightmap[z * mapData3D.sizeX + x];
    _fillHeightmapColumn(mapData3D, solidMaterialId, x, z, columnHeight);
  }
}

function _fillHeightmapColumn(mapData3D, solidMaterialId, x, z, columnHeight) {
  const cappedHeight = Math.min(columnHeight, mapData3D.sizeY);
  for (let y = 0; y < cappedHeight; y++) {
    setVoxel3D(mapData3D, x, y, z, solidMaterialId);
  }
}
