/**
 * MapData2D.js
 * Estructura de datos plana para el modo 2D.
 * Refactorizado en subtareas planas de un máximo de 3 subtareas por función.
 */

const AIR_MATERIAL_ID = 0;

/**
 * Crea una definición de material con valores por defecto.
 * @param {object} data
 */
function createMaterial(data) {
  const defaults = _getMaterialDefaults(data);
  return {
    id: data.id,
    name: data.name ?? defaults.name,
    destructible: data.destructible ?? true,
    hardness: data.hardness ?? 1,
    color: data.color ?? '#ffffff',
    textureId: data.textureId ?? null,
  };
}

function _getMaterialDefaults(data) {
  return {
    name: `material_${data.id}`
  };
}

/** Catálogo de materiales por defecto. */
function createDefaultMaterials() {
  return [
    createMaterial({ id: 1, name: 'Arena', hardness: 1, color: '#e0c068' }),
    createMaterial({ id: 2, name: 'Tierra', hardness: 3, color: '#8b5a2b' }),
    createMaterial({ id: 3, name: 'Roca', hardness: 6, color: '#7f8c8d' }),
    createMaterial({ id: 4, name: 'Agua', hardness: 0, color: '#3a7bd5', textureId: 'water_tex' }),
  ];
}

/** Crea una estructura MapData2D vacía (llena de aire). */
function createMapData2D(config) {
  const size = config.width * config.height;
  return {
    width: config.width,
    height: config.height,
    cellSize: config.cellSize ?? 16,
    cells: new Uint8Array(size).fill(AIR_MATERIAL_ID),
    materials: config.materials,
    seed: config.seed,
    seedHash: hashSeedToInt(config.seed),
  };
}

/** Índice plano de una celda 2D. */
function getCellIndex2D(mapData2D, x, y) {
  return y * mapData2D.width + x;
}

function getCell2D(mapData2D, x, y) {
  if (this._isOutOfBounds2D(mapData2D, x, y)) return AIR_MATERIAL_ID;
  const idx = getCellIndex2D(mapData2D, x, y);
  return mapData2D.cells[idx];
}

function setCell2D(mapData2D, x, y, materialId) {
  if (this._isOutOfBounds2D(mapData2D, x, y)) return;
  const idx = getCellIndex2D(mapData2D, x, y);
  mapData2D.cells[idx] = materialId;
}

function _isOutOfBounds2D(mapData2D, x, y) {
  return x < 0 || y < 0 || x >= mapData2D.width || y >= mapData2D.height;
}
