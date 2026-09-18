/**
 * MapData2D.js
 * Estructura de datos plana (no clase) para el modo 2D — se pasa directo
 * a Web Workers como Transferable Object. También define `createMaterial`
 * y `AIR_MATERIAL_ID`, compartidos con MapData3D.js (por eso este archivo
 * debe cargarse ANTES que MapData3D.js en index.html).
 */

const AIR_MATERIAL_ID = 0;

/**
 * Crea una definición de material con valores por defecto.
 * Compartido entre MapData2D y MapData3D (ver sección 4.3 del TDD).
 * @param {Partial<{id:number,name:string,destructible:boolean,hardness:number,color:string,textureId:string}>} data
 */
function createMaterial(data) {
  return {
    id: data.id,
    name: data.name ?? `material_${data.id}`,
    destructible: data.destructible ?? true,
    hardness: data.hardness ?? 1,
    color: data.color ?? '#ffffff',
    textureId: data.textureId ?? null,
  };
}

/**
 * Crea una estructura MapData2D vacía (llena de aire).
 * @param {{width:number, height:number, cellSize?:number, seed:string, materials:object[]}} config
 */
function createMapData2D(config) {
  return {
    width: config.width,
    height: config.height,
    cellSize: config.cellSize ?? 16,
    cells: new Uint8Array(config.width * config.height).fill(AIR_MATERIAL_ID),
    materials: config.materials,
    seed: config.seed,
    seedHash: hashSeedToInt(config.seed), // ver utils.js
  };
}

/** Índice plano de una celda 2D. */
function getCellIndex2D(mapData2D, x, y) {
  return y * mapData2D.width + x;
}

function getCell2D(mapData2D, x, y) {
  if (x < 0 || y < 0 || x >= mapData2D.width || y >= mapData2D.height) return AIR_MATERIAL_ID;
  return mapData2D.cells[getCellIndex2D(mapData2D, x, y)];
}

function setCell2D(mapData2D, x, y, materialId) {
  if (x < 0 || y < 0 || x >= mapData2D.width || y >= mapData2D.height) return;
  mapData2D.cells[getCellIndex2D(mapData2D, x, y)] = materialId;
}
