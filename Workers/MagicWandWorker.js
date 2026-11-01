/** Flood Fill 2D/3D sin controles de flujo anidados. */
const FILL_NEIGHBORS_2D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const FILL_NEIGHBORS_3D = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

self.onmessage = event => {
  const payload = event.data;
  try {
    const result = executeFloodFill(payload);
    self.postMessage({ id: payload.id, buffer: result.buffer.buffer, dirtyChunks: result.dirtyChunks }, [result.buffer.buffer]);
  } catch (error) {
    self.postMessage({ id: payload.id, error: error.message });
  }
};

function executeFloodFill(payload) {
  const buffer = new Uint8Array(payload.buffer);
  const context = createFillContext(buffer, payload);
  if (payload.mode === '3d') return process3DFill(context);
  return process2DFill(context);
}

function createFillContext(buffer, payload) {
  const dimensions = payload.dimensions;
  const total = buffer.length;
  const requestedLimit = Math.floor(Number(payload.maxFillLimit));
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, requestedLimit) : 250000;
  const capacity = Math.min(total, limit);
  return {
    buffer,
    dimensions,
    point: payload.point,
    newMaterial: normalizeMaterial(payload.newMaterial),
    capacity,
    queue: new Int32Array(capacity),
    visited: new Uint8Array(total),
    head: 0,
    tail: 0,
    processed: 0,
    targetMaterial: 0,
    dirtyChunks: new Set(),
  };
}

function normalizeMaterial(value) {
  const material = Math.floor(Number(value));
  return Number.isFinite(material) ? Math.max(0, Math.min(255, material)) : 0;
}

function process2DFill(context) {
  const startIndex = get2DStartIndex(context);
  if (startIndex < 0) return createResult(context);
  if (context.buffer[startIndex] === context.newMaterial) return createResult(context);
  seedQueue(context, startIndex);
  run2DFillQueue(context);
  return createResult(context);
}

function get2DStartIndex(context) {
  const { width, height } = context.dimensions;
  const x = Math.floor(context.point.x);
  const y = Math.floor(context.point.y);
  if (x < 0 || x >= width || y < 0 || y >= height) return -1;
  return y * width + x;
}

function seedQueue(context, startIndex) {
  context.targetMaterial = context.buffer[startIndex];
  context.queue[0] = startIndex;
  context.visited[startIndex] = 1;
  context.tail = 1;
}

function run2DFillQueue(context) {
  while (hasPendingFill(context)) processNext2DFillCell(context);
}

function hasPendingFill(context) {
  return context.head < context.tail && context.processed < context.capacity;
}

function processNext2DFillCell(context) {
  const index = context.queue[context.head++];
  context.processed++;
  context.buffer[index] = context.newMaterial;
  enqueue2DNeighbors(context, index);
}

function enqueue2DNeighbors(context, index) {
  const { width } = context.dimensions;
  const x = index % width;
  const y = Math.floor(index / width);
  for (const [dx, dy] of FILL_NEIGHBORS_2D) enqueue2DNeighbor(context, x + dx, y + dy);
}

function enqueue2DNeighbor(context, x, y) {
  const index = get2DNeighborIndex(context, x, y);
  if (index < 0) return;
  context.visited[index] = 1;
  context.queue[context.tail++] = index;
}

function get2DNeighborIndex(context, x, y) {
  const { width, height } = context.dimensions;
  if (x < 0 || x >= width || y < 0 || y >= height) return -1;
  const index = y * width + x;
  if (context.visited[index] || context.buffer[index] !== context.targetMaterial) return -1;
  if (context.tail >= context.capacity) return -1;
  return index;
}

function process3DFill(context) {
  const startIndex = get3DStartIndex(context);
  if (startIndex < 0) return createResult(context);
  if (context.buffer[startIndex] === context.newMaterial) return createResult(context);
  seedQueue(context, startIndex);
  run3DFillQueue(context);
  return createResult(context);
}

function get3DStartIndex(context) {
  const { sizeX, sizeY, sizeZ } = context.dimensions;
  const x = Math.floor(context.point.x);
  const y = Math.floor(context.point.y);
  const z = Math.floor(context.point.z ?? 0);
  if (x < 0 || x >= sizeX || y < 0 || y >= sizeY || z < 0 || z >= sizeZ) return -1;
  return (y * sizeZ + z) * sizeX + x;
}

function run3DFillQueue(context) {
  while (hasPendingFill(context)) processNext3DFillCell(context);
}

function processNext3DFillCell(context) {
  const index = context.queue[context.head++];
  context.processed++;
  context.buffer[index] = context.newMaterial;
  markDirtyChunk(context, decode3DIndex(context.dimensions, index));
  enqueue3DNeighbors(context, index);
}

function decode3DIndex(dimensions, index) {
  const x = index % dimensions.sizeX;
  const planeIndex = Math.floor(index / dimensions.sizeX);
  const z = planeIndex % dimensions.sizeZ;
  const y = Math.floor(planeIndex / dimensions.sizeZ);
  return { x, y, z };
}

function enqueue3DNeighbors(context, index) {
  const point = decode3DIndex(context.dimensions, index);
  for (const [dx, dy, dz] of FILL_NEIGHBORS_3D) enqueue3DNeighbor(context, point.x + dx, point.y + dy, point.z + dz);
}

function enqueue3DNeighbor(context, x, y, z) {
  const index = get3DNeighborIndex(context, x, y, z);
  if (index < 0) return;
  context.visited[index] = 1;
  context.queue[context.tail++] = index;
}

function get3DNeighborIndex(context, x, y, z) {
  const { sizeX, sizeY, sizeZ } = context.dimensions;
  if (x < 0 || x >= sizeX || y < 0 || y >= sizeY || z < 0 || z >= sizeZ) return -1;
  const index = (y * sizeZ + z) * sizeX + x;
  if (context.visited[index] || context.buffer[index] !== context.targetMaterial) return -1;
  if (context.tail >= context.capacity) return -1;
  return index;
}

function markDirtyChunk(context, point) {
  const chunkSize = context.dimensions.chunkSize || 16;
  const chunkX = Math.floor(point.x / chunkSize);
  const chunkY = Math.floor(point.y / chunkSize);
  const chunkZ = Math.floor(point.z / chunkSize);
  context.dirtyChunks.add(`${chunkX},${chunkY},${chunkZ}`);
}

function createResult(context) {
  return { buffer: context.buffer, dirtyChunks: [...context.dirtyChunks] };
}
