/**
 * BezierPath3D.js
 * Generador y rasterizador de curvas Bézier cúbicas en espacio tridimensional.
 * Refactorizado en subtareas de un máximo de 3 subtareas por método.
 */
class BezierPath3D {
  constructor(controlPoints = []) {
    this.points = controlPoints.length === 4 ? controlPoints : [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 15, z: 5 },
      { x: 20, y: 15, z: 25 },
      { x: 30, y: 0, z: 30 }
    ];
  }

  getPoint(t) {
    const u = 1 - t;
    const poly = this._calculatePolynomialTerms(t, u);
    return this._computeBezierCoordinate(poly);
  }

  _calculatePolynomialTerms(t, u) {
    return {
      uuu: u * u * u,
      uu3t: 3 * u * u * t,
      u3tt: 3 * u * t * t,
      ttt: t * t * t
    };
  }

  _computeBezierCoordinate(p) {
    const pts = this.points;
    return {
      x: p.uuu * pts[0].x + p.uu3t * pts[1].x + p.u3tt * pts[2].x + p.ttt * pts[3].x,
      y: p.uuu * pts[0].y + p.uu3t * pts[1].y + p.u3tt * pts[2].y + p.ttt * pts[3].y,
      z: p.uuu * pts[0].z + p.uu3t * pts[1].z + p.u3tt * pts[2].z + p.ttt * pts[3].z
    };
  }

  estimateLength(samples = 20) {
    const context = { length: 0, prev: this.getPoint(0) };
    this._loopLengthEstimation(samples, context);
    return context.length;
  }

  _loopLengthEstimation(samples, context) {
    for (let i = 1; i <= samples; i++) {
      this._accumulateSegmentLength(i, samples, context);
    }
  }

  _accumulateSegmentLength(i, samples, context) {
    const curr = this.getPoint(i / samples);
    const dx = curr.x - context.prev.x;
    const dy = curr.y - context.prev.y;
    const dz = curr.z - context.prev.z;
    context.length += Math.sqrt(dx * dx + dy * dy + dz * dz);
    context.prev = curr;
  }

  rasterizeExtrusion(mapData3D, radius, materialId = 0, renderer3D = null) {
    const steps = this._calculateExtrusionSteps();
    const dirtyChunks = new Set();
    this._loopExtrusionSteps(steps, radius, materialId, mapData3D, dirtyChunks);
    this._rebuildSelectiveChunks(mapData3D, dirtyChunks, renderer3D);
  }

  _calculateExtrusionSteps() {
    const length = this.estimateLength();
    return Math.max(10, Math.ceil(length * 2));
  }

  _loopExtrusionSteps(steps, radius, materialId, mapData3D, dirtyChunks) {
    const rInt = Math.ceil(radius);
    const rSq = radius * radius;
    for (let i = 0; i <= steps; i++) {
      this._processExtrusionStep(i, steps, rInt, rSq, materialId, mapData3D, dirtyChunks);
    }
  }

  _processExtrusionStep(i, steps, rInt, rSq, materialId, mapData3D, dirtyChunks) {
    const center = this.getPoint(i / steps);
    const bounds = this._calculateStepBounds(center, rInt, mapData3D);
    this._rasterizeStepVolume(center, bounds, rSq, materialId, mapData3D, dirtyChunks);
  }

  _calculateStepBounds(center, rInt, mapData3D) {
    const cx = Math.round(center.x);
    const cy = Math.round(center.y);
    const cz = Math.round(center.z);
    return {
      minX: Math.max(0, cx - rInt), maxX: Math.min(mapData3D.sizeX - 1, cx + rInt),
      minY: Math.max(0, cy - rInt), maxY: Math.min(mapData3D.sizeY - 1, cy + rInt),
      minZ: Math.max(0, cz - rInt), maxZ: Math.min(mapData3D.sizeZ - 1, cz + rInt)
    };
  }

  _rasterizeStepVolume(center, bounds, rSq, materialId, mapData3D, dirtyChunks) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
      this._rasterizeStepPlane(center, bounds, z, rSq, materialId, mapData3D, dirtyChunks);
    }
  }

  _rasterizeStepPlane(center, bounds, z, rSq, materialId, mapData3D, dirtyChunks) {
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      this._rasterizeStepRow(center, bounds, y, z, rSq, materialId, mapData3D, dirtyChunks);
    }
  }

  _rasterizeStepRow(center, bounds, y, z, rSq, materialId, mapData3D, dirtyChunks) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      this._evaluateStepVoxel(center, x, y, z, rSq, materialId, mapData3D, dirtyChunks);
    }
  }

  _evaluateStepVoxel(center, x, y, z, rSq, materialId, mapData3D, dirtyChunks) {
    const dx = x - center.x;
    const dy = y - center.y;
    const dz = z - center.z;
    if (dx * dx + dy * dy + dz * dz > rSq) return;
    setVoxel3D(mapData3D, x, y, z, materialId);
    this._markChunkAsDirty(x, y, z, mapData3D.chunkSize || 16, dirtyChunks);
  }

  _markChunkAsDirty(x, y, z, size, dirtyChunks) {
    const chX = Math.floor(x / size);
    const chY = Math.floor(y / size);
    const chZ = Math.floor(z / size);
    dirtyChunks.add(`${chX},${chY},${chZ}`);
  }

  _rebuildSelectiveChunks(mapData3D, dirtyChunks, renderer3D) {
    if (!renderer3D || typeof renderer3D.rebuildChunk !== 'function') return;
    for (const key of dirtyChunks) {
      const [chX, chY, chZ] = key.split(',').map(Number);
      renderer3D.rebuildChunk(mapData3D, chX, chY, chZ);
    }
  }
}