/**
 * CellularAutomata.js
 * Generador de cavernas y cavidades orgánicas basado en autómatas celulares.
 * Completamente atomizado en sub-métodos secuenciales de un máximo de 3 tareas.
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

class CellularAutomata {
  static generateCaveMask2D(width, height, seedHash, options = {}) {
    const config = this._parseOptions(options);
    let grid = this._initializeGridNoise(width, height, seedHash, config.fillRatio);
    return this._runSimulationCycles(grid, width, height, config);
  }

  static _parseOptions(opts) {
    return {
      fillRatio: opts.fillRatio ?? 0.45,
      iterations: opts.iterations ?? 4,
      birthLimit: opts.birthLimit ?? 4,
      deathLimit: opts.deathLimit ?? 3
    };
  }

  static _initializeGridNoise(width, height, seedHash, fillRatio) {
    const rng = createSeededRandom(seedHash);
    const grid = new Uint8Array(width * height);
    this._loopNoiseRows(grid, width, height, fillRatio, rng);
    return grid;
  }

  static _loopNoiseRows(grid, width, height, fillRatio, rng) {
    for (let y = 0; y < height; y++) {
      this._loopNoiseCells(grid, y, width, height, fillRatio, rng);
    }
  }

  static _loopNoiseCells(grid, y, width, height, fillRatio, rng) {
    for (let x = 0; x < width; x++) {
      grid[y * width + x] = this._evaluateNoiseCell(x, y, width, height, fillRatio, rng);
    }
  }

  static _evaluateNoiseCell(x, y, width, height, fillRatio, rng) {
    if (x === 0 || x === width - 1 || y === 0 || y === height - 1) return 1;
    return rng() < fillRatio ? 1 : 0;
  }

  static _runSimulationCycles(grid, width, height, config) {
    let currentGrid = grid;
    for (let i = 0; i < config.iterations; i++) {
      currentGrid = this._executeCycleStep(currentGrid, width, height, config);
    }
    return currentGrid;
  }

  static _executeCycleStep(grid, width, height, config) {
    const nextGrid = new Uint8Array(width * height);
    this._loopSimulationRows(grid, nextGrid, width, height, config);
    return nextGrid;
  }

  static _loopSimulationRows(grid, nextGrid, width, height, config) {
    for (let y = 0; y < height; y++) {
      this._loopSimulationCells(grid, nextGrid, y, width, height, config);
    }
  }

  static _loopSimulationCells(grid, nextGrid, y, width, height, config) {
    for (let x = 0; x < width; x++) {
      nextGrid[y * width + x] = this._processCellRules(grid, x, y, width, height, config);
    }
  }

  static _processCellRules(grid, x, y, width, height, config) {
    if (x === 0 || x === width - 1 || y === 0 || y === height - 1) return 1;
    const neighbors = this._countAliveNeighbors(grid, width, height, x, y);
    return this._applyCellularState(grid[y * width + x], neighbors, config);
  }

  static _applyCellularState(currentState, neighbors, config) {
    if (currentState === 1) {
      return neighbors >= config.deathLimit ? 1 : 0;
    }
    return neighbors > config.birthLimit ? 1 : 0;
  }

  static _countAliveNeighbors(grid, width, height, cellX, cellY) {
    let count = 0;
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      count += this._countRowNeighbors(grid, width, height, cellX, cellY, offsetY);
    }
    return count;
  }

  static _countRowNeighbors(grid, width, height, cellX, cellY, offsetY) {
    let rowCount = 0;
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      rowCount += this._evaluateNeighbor(grid, width, height, cellX + offsetX, cellY + offsetY, offsetX, offsetY);
    }
    return rowCount;
  }

  static _evaluateNeighbor(grid, width, height, nx, ny, offsetX, offsetY) {
    if (offsetX === 0 && offsetY === 0) return 0;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return 1;
    return grid[ny * width + nx] === 1 ? 1 : 0;
  }

  static carveCavesInMapData2D(mapData2D, options = {}) {
    const mask = this.generateCaveMask2D(mapData2D.width, mapData2D.height, mapData2D.seedHash, options);
    const caveStartDepth = Math.floor(mapData2D.height * 0.25);
    this._carveVolumeRows(mapData2D, mask, caveStartDepth);
  }

  static _carveVolumeRows(mapData2D, mask, caveStartDepth) {
    for (let y = caveStartDepth; y < mapData2D.height; y++) {
      this._carveVolumeCells(mapData2D, mask, y);
    }
  }

  static _carveVolumeCells(mapData2D, mask, y) {
    for (let x = 0; x < mapData2D.width; x++) {
      this._applyCaveCarving(mapData2D, mask, x, y);
    }
  }

  static _applyCaveCarving(mapData2D, mask, x, y) {
    const isSolidCaveWall = mask[y * mapData2D.width + x];
    if (isSolidCaveWall !== 0) return;
    this._writeAirVoxel(mapData2D, x, y);
  }

  static _writeAirVoxel(mapData2D, x, y) {
    if (typeof setCell2D === "function") {
      setCell2D(mapData2D, x, y, 0);
    } else if (mapData2D.data) {
      mapData2D.data[y * mapData2D.width + x] = 0;
    }
  }
}