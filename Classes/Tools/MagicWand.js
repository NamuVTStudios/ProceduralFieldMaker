/**
 * MagicWand.js
 * Flood-fill 2D (4-conectividad) y 3D (6-conectividad) con límite de seguridad.
 * La cola usa índices planos y cada paso está separado en subtareas sin controles anidados.
 */
const MAGIC_WAND_NEIGHBORS_2D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MAGIC_WAND_NEIGHBORS_3D = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

class MagicWand extends Tools {
  constructor(appManager) {
    super(appManager);
    this.name = 'MagicWand';
    this.label = 'Magic Wand';
    this.replacementMaterialId = 0;
    this.maxFillLimit = 250000;
  }

  onPointerDown(event, worldCoords) {
    if (!worldCoords) return;
    this.applyTool(worldCoords.x, worldCoords.y, worldCoords.z ?? 0);
  }

  onPointerMove() {}

  onPointerUp() {}

  applyTool(targetX, targetY, targetZ = 0) {
    const mapData = this.appManager.mapData;
    if (!mapData) return;
    const point = this._normalizeTargetPoint(targetX, targetY, targetZ);
    this._applyFillByMode(mapData, point.x, point.y, point.z);
  }

  _normalizeTargetPoint(x, y, z) {
    return { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) };
  }

  _applyFillByMode(mapData, x, y, z) {
    if (this.appManager.mode === '2d') {
      this._floodFill2D(mapData, x, y, this.replacementMaterialId);
      return;
    }
    this._floodFill3D(mapData, x, y, z, this.replacementMaterialId);
  }

  _floodFill2D(mapData, startX, startY, newMaterial) {
    const context = this._create2DFillContext(mapData, startX, startY, newMaterial);
    if (!context) return;
    this._run2DFillQueue(context);
    this._refresh2DRenderer(mapData);
  }

  _isInside2DMap(mapData, x, y) {
    return x >= 0 && x < mapData.width && y >= 0 && y < mapData.height;
  }

  _create2DFillContext(mapData, startX, startY, newMaterial) {
    const start = this._get2DFillStart(mapData, startX, startY, newMaterial);
    if (!start) return null;
    const buffers = this._createFillBuffers(mapData.width * mapData.height, start.index);
    return { mapData, targetMaterial: start.material, newMaterial, ...buffers };
  }

  _get2DFillStart(mapData, x, y, newMaterial) {
    if (!this._isInside2DMap(mapData, x, y)) return null;
    const index = y * mapData.width + x;
    const material = mapData.cells[index];
    if (material === newMaterial) return null;
    return { index, material };
  }

  _createFillBuffers(totalCells, startIndex) {
    const capacity = Math.min(totalCells, this._getSafeFillLimit());
    const queue = new Int32Array(capacity);
    const visited = new Uint8Array(totalCells);
    this._seedFillQueue(queue, visited, startIndex);
    return { queue, visited, head: 0, tail: 1, processed: 0, capacity };
  }

  _getSafeFillLimit() {
    const limit = Math.floor(Number(this.maxFillLimit));
    if (!Number.isFinite(limit)) return 250000;
    return Math.max(1, limit);
  }

  _seedFillQueue(queue, visited, startIndex) {
    queue[0] = startIndex;
    visited[startIndex] = 1;
  }

  _run2DFillQueue(context) {
    while (context.head < context.tail && context.processed < context.capacity) {
      const index = context.queue[context.head++];
      context.processed++;
      this._process2DIndex(context, index);
    }
  }

  _process2DIndex(context, index) {
    const x = index % context.mapData.width;
    const y = Math.floor(index / context.mapData.width);
    setCell2D(context.mapData, x, y, context.newMaterial);
    this._enqueue2DNeighbors(context, x, y);
  }

  _enqueue2DNeighbors(context, x, y) {
    for (const [dx, dy] of MAGIC_WAND_NEIGHBORS_2D) {
      this._enqueue2DNeighbor(context, x + dx, y + dy);
    }
  }

  _enqueue2DNeighbor(context, x, y) {
    const index = this._getEnqueueable2DIndex(context, x, y);
    if (index < 0) return;
    this._appendFillQueueEntry(context, index);
  }

  _getEnqueueable2DIndex(context, x, y) {
    if (!this._isInside2DMap(context.mapData, x, y)) return -1;
    const index = y * context.mapData.width + x;
    if (context.visited[index] !== 0) return -1;
    if (context.mapData.cells[index] !== context.targetMaterial) return -1;
    if (context.tail >= context.capacity) return -1;
    return index;
  }

  _appendFillQueueEntry(context, index) {
    context.visited[index] = 1;
    context.queue[context.tail++] = index;
  }

  _refresh2DRenderer(mapData) {
    const renderer = this.appManager.renderer;
    if (!renderer || typeof renderer.renderFullMap !== 'function') return;
    renderer.renderFullMap(mapData);
  }

  _floodFill3D(mapData, startX, startY, startZ, newMaterial) {
    const context = this._create3DFillContext(mapData, startX, startY, startZ, newMaterial);
    if (!context) return;
    this._run3DFillQueue(context);
    this._rebuildDirtyChunks(context);
  }

  _isInside3DMap(mapData, x, y, z) {
    return x >= 0 && x < mapData.sizeX && y >= 0 && y < mapData.sizeY && z >= 0 && z < mapData.sizeZ;
  }

  _create3DFillContext(mapData, startX, startY, startZ, newMaterial) {
    const start = this._get3DFillStart(mapData, startX, startY, startZ, newMaterial);
    if (!start) return null;
    const totalVoxels = mapData.sizeX * mapData.sizeY * mapData.sizeZ;
    const buffers = this._createFillBuffers(totalVoxels, start.index);
    return this._assemble3DFillContext(mapData, start.material, newMaterial, buffers);
  }

  _get3DFillStart(mapData, x, y, z, newMaterial) {
    if (!this._isInside3DMap(mapData, x, y, z)) return null;
    const index = getVoxelIndex3D(mapData, x, y, z);
    const material = mapData.voxels[index];
    if (material === newMaterial) return null;
    return { index, material };
  }

  _assemble3DFillContext(mapData, targetMaterial, newMaterial, buffers) {
    return {
      mapData, targetMaterial, newMaterial, ...buffers,
      chunkSize: mapData.chunkSize || 16, dirtyChunks: new Set(),
    };
  }

  _run3DFillQueue(context) {
    while (context.head < context.tail && context.processed < context.capacity) {
      const index = context.queue[context.head++];
      context.processed++;
      this._process3DIndex(context, index);
    }
  }

  _process3DIndex(context, index) {
    const point = this._decode3DIndex(context.mapData, index);
    this._writeFilledVoxel(context, point);
    this._enqueue3DNeighbors(context, point);
  }

  _decode3DIndex(mapData, index) {
    const x = index % mapData.sizeX;
    const planeIndex = Math.floor(index / mapData.sizeX);
    const z = planeIndex % mapData.sizeZ;
    const y = Math.floor(planeIndex / mapData.sizeZ);
    return { x, y, z };
  }

  _writeFilledVoxel(context, point) {
    setVoxel3D(context.mapData, point.x, point.y, point.z, context.newMaterial);
    this._markDirtyChunk(context, point);
  }

  _markDirtyChunk(context, point) {
    const cx = Math.floor(point.x / context.chunkSize);
    const cy = Math.floor(point.y / context.chunkSize);
    const cz = Math.floor(point.z / context.chunkSize);
    context.dirtyChunks.add(`${cx},${cy},${cz}`);
  }

  _enqueue3DNeighbors(context, point) {
    for (const [dx, dy, dz] of MAGIC_WAND_NEIGHBORS_3D) {
      this._enqueue3DNeighbor(context, point.x + dx, point.y + dy, point.z + dz);
    }
  }

  _enqueue3DNeighbor(context, x, y, z) {
    const index = this._getEnqueueable3DIndex(context, x, y, z);
    if (index < 0) return;
    this._appendFillQueueEntry(context, index);
  }

  _getEnqueueable3DIndex(context, x, y, z) {
    if (!this._isInside3DMap(context.mapData, x, y, z)) return -1;
    const index = getVoxelIndex3D(context.mapData, x, y, z);
    if (context.visited[index] !== 0) return -1;
    if (context.mapData.voxels[index] !== context.targetMaterial) return -1;
    if (context.tail >= context.capacity) return -1;
    return index;
  }

  _rebuildDirtyChunks(context) {
    const renderer = this.appManager.renderer;
    if (!renderer || typeof renderer.rebuildChunk !== 'function') return;
    for (const key of context.dirtyChunks) {
      this._rebuildChunkFromKey(renderer, context.mapData, key);
    }
  }

  _rebuildChunkFromKey(renderer, mapData, key) {
    const [chunkX, chunkY, chunkZ] = key.split(',').map(Number);
    renderer.rebuildChunk(mapData, chunkX, chunkY, chunkZ);
  }
}
