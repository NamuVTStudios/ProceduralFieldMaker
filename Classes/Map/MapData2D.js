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
 * Catálogo de materiales por defecto (TDD 4.3 y 6.1): dureza Arena 1, Tierra 3, Roca 6; Agua 0.
 * Compartido entre 2D y 3D, se usa al crear un lienzo nuevo.
 */
function createDefaultMaterials() {
  return [
    createMaterial({ id: 1, name: 'Arena', hardness: 1, color: '#e0c068' }),
    createMaterial({ id: 2, name: 'Tierra', hardness: 3, color: '#8b5a2b' }),
    createMaterial({ id: 3, name: 'Roca', hardness: 6, color: '#7f8c8d' }),
    createMaterial({ id: 4, name: 'Agua', hardness: 0, color: '#3a7bd5', textureId: 'water_tex' }),
  ];
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
    seedHash: hashSeedToInt(config.seed), // definida en NoiseGenerator.js
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
