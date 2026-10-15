/**
 * CellularAutomata.js
 * Generador de cavernas y cavidades orgánicas basado en autómatas celulares.
 * Utiliza determinismo por semilla a través de Mulberry32.
 */

/**
 * PRNG determinista auxiliar para el autómata.
 * @param {number} seed
 */
function createSeededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class CellularAutomata {
  /**
   * Genera una máscara binaria 2D de cavernas y túneles orgánicos.
   * Devuelve un Uint8Array donde 1 = Sólido y 0 = Cavidad/Aire.
   * 
   * @param {number} width Ancho de la grilla
   * @param {number} height Alto de la grilla
   * @param {number} seedHash Hash determinista de la semilla
   * @param {object} [options]
   * @param {number} [options.fillRatio=0.45] Porcentaje inicial de roca (0 a 1)
   * @param {number} [options.iterations=4] Pasos de suavizado
   * @param {number} [options.birthLimit=4] Límite de vecinas para nacer
   * @param {number} [options.deathLimit=3] Límite de vecinas para morir
   * @returns {Uint8Array}
   */
  static generateCaveMask2D(width, height, seedHash, options = {}) {
    const fillRatio = options.fillRatio ?? 0.45;
    const iterations = options.iterations ?? 4;
    const birthLimit = options.birthLimit ?? 4;
    const deathLimit = options.deathLimit ?? 3;

    const rng = createSeededRandom(seedHash);
    let grid = new Uint8Array(width * height);

    // 1. Inicialización determinista con ruido aleatorio
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Los bordes exteriores siempre quedan sólidos para cerrar el mapa
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          grid[y * width + x] = 1;
        } else {
          grid[y * width + x] = rng() < fillRatio ? 1 : 0;
        }
      }
    }

    // 2. Pasadas de simulación celular
    for (let i = 0; i < iterations; i++) {
      const nextGrid = new Uint8Array(width * height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
            nextGrid[y * width + x] = 1;
            continue;
          }

          const neighbors = this._countAliveNeighbors(grid, width, height, x, y);

          if (grid[y * width + x] === 1) {
            // Regla de supervivencia: si tiene pocos vecinos, se erosiona
            nextGrid[y * width + x] = neighbors >= deathLimit ? 1 : 0;
          } else {
            // Regla de nacimiento: si está rodeado de roca, se solidifica
            nextGrid[y * width + x] = neighbors > birthLimit ? 1 : 0;
          }
        }
      }

      grid = nextGrid;
    }

    return grid;
  }

  /**
   * Cuenta las celdas vecinas sólidas (en una vecindad de Moore de 3x3).
   * @private
   */
  static _countAliveNeighbors(grid, width, height, cellX, cellY) {
    let count = 0;
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        if (offsetX === 0 && offsetY === 0) continue;

        const nx = cellX + offsetX;
        const ny = cellY + offsetY;

        // Fuera del límite cuenta como sólido para crear fronteras cerradas
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          count++;
        } else if (grid[ny * width + nx] === 1) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Excava cavernas sobre un MapData2D existente.
   * Si la máscara del autómata dice que hay un hueco (0), convierte la celda a aire.
   * @param {object} mapData2D
   * @param {object} [options]
   */
  static carveCavesInMapData2D(mapData2D, options = {}) {
    const mask = this.generateCaveMask2D(
      mapData2D.width,
      mapData2D.height,
      mapData2D.seedHash,
      options
    );

    // Solo excavamos por debajo de la superficie (por ejemplo, a partir del 30% superior)
    const caveStartDepth = Math.floor(mapData2D.height * 0.25);

    for (let y = caveStartDepth; y < mapData2D.height; y++) {
      for (let x = 0; x < mapData2D.width; x++) {
        const isSolidCaveWall = mask[y * mapData2D.width + x];
        // Si el autómata dice 0, ahuecamos la celda como aire (0)
        if (isSolidCaveWall === 0) {
          setCell2D(mapData2D, x, y, 0);
        }
      }
    }
  }
}