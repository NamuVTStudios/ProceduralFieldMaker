/**
 * MapData3D.js
 * Estructura de datos plana (no clase) para el modo 3D — se pasa directo
 * a Web Workers como Transferable Object. Reutiliza `AIR_MATERIAL_ID`
 * definida en MapData2D.js: este archivo DEBE cargarse después de ese
 * en index.html.
 */

/**
 * Crea una estructura MapData3D vacía (llena de aire).
 * @param {{sizeX:number, sizeY:number, sizeZ:number, chunkSize?:number, seed:string, materials:object[]}} config
 */
function createMapData3D(config) {
  return {
    sizeX: config.sizeX,
    sizeY: config.sizeY,
    sizeZ: config.sizeZ,
    chunkSize: config.chunkSize ?? 16,
    voxels: new Uint8Array(config.sizeX * config.sizeY * config.sizeZ).fill(AIR_MATERIAL_ID),
    materials: config.materials,
    seed: config.seed,
    seedHash: hashSeedToInt(config.seed), // ver utils.js
  };
}

/** Índice plano de un voxel 3D (orden X, luego Z, luego Y — Y más externo). */
function getVoxelIndex3D(mapData3D, x, y, z) {
  return (y * mapData3D.sizeZ + z) * mapData3D.sizeX + x;
}

function getVoxel3D(mapData3D, x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= mapData3D.sizeX || y >= mapData3D.sizeY || z >= mapData3D.sizeZ) {
    return AIR_MATERIAL_ID;
  }
  return mapData3D.voxels[getVoxelIndex3D(mapData3D, x, y, z)];
}

function setVoxel3D(mapData3D, x, y, z, materialId) {
  if (x < 0 || y < 0 || z < 0 || x >= mapData3D.sizeX || y >= mapData3D.sizeY || z >= mapData3D.sizeZ) return;
  mapData3D.voxels[getVoxelIndex3D(mapData3D, x, y, z)] = materialId;
}

/**
 * Extruye un heightmap (ver noiseGenerator.js) a un MapData3D ya creado,
 * rellenando de sólido todo lo que esté por debajo de la altura de columna.
 * @param {object} mapData3D
 * @param {Uint16Array} heightmap - tamaño sizeX * sizeZ
 * @param {number} solidMaterialId
 */
function applyHeightmapToMapData3D(mapData3D, heightmap, solidMaterialId) {
  for (let z = 0; z < mapData3D.sizeZ; z++) {
    for (let x = 0; x < mapData3D.sizeX; x++) {
      const columnHeight = heightmap[z * mapData3D.sizeX + x];
      for (let y = 0; y < Math.min(columnHeight, mapData3D.sizeY); y++) {
        setVoxel3D(mapData3D, x, y, z, solidMaterialId);
      }
    }
  }
}
