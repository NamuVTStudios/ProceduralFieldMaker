/**
 * PrimitiveGenerator.js
 * Generador y rasterizador de primitivas volumétricas mediante funciones de distancia signada (SDF).
 * Refactorizado bajo la regla estricta de un máximo de 3 subtareas por método.
 */
class PrimitiveGenerator {
  static sdfSphere(x, y, z, cx, cy, cz, radius) {
    const dx = x - cx;
    const dy = y - cy;
    const dz = z - cz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - radius;
  }

  static sdfBox(x, y, z, cx, cy, cz, sizeX, sizeY, sizeZ) {
    const limits = this._calculateBoxLimits(x, y, z, cx, cy, cz, sizeX, sizeY, sizeZ);
    const outsideDist = Math.sqrt(Math.max(limits.dx, 0) ** 2 + Math.max(limits.dy, 0) ** 2 + Math.max(limits.dz, 0) ** 2);
    const insideDist = Math.min(Math.max(limits.dx, Math.max(limits.dy, limits.dz)), 0);
    return outsideDist + insideDist;
  }

  static _calculateBoxLimits(x, y, z, cx, cy, cz, sizeX, sizeY, sizeZ) {
    return {
      dx: Math.abs(x - cx) - sizeX / 2,
      dy: Math.abs(y - cy) - sizeY / 2,
      dz: Math.abs(z - cz) - sizeZ / 2
    };
  }

  static sdfCylinder(x, y, z, cx, cy, cz, radius, height) {
    const radial = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2) - radius;
    const distY = Math.abs(y - cy) - height / 2;
    const outsideDist = Math.sqrt(Math.max(radial, 0) ** 2 + Math.max(distY, 0) ** 2);
    const insideDist = Math.min(Math.max(radial, distY), 0);
    return outsideDist + insideDist;
  }

  static sdfTorus(x, y, z, cx, cy, cz, majorRadius, minorRadius) {
    const qx = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2) - majorRadius;
    const qy = y - cy;
    return Math.sqrt(qx * qx + qy * qy) - minorRadius;
  }

  static rasterizePrimitive(mapData3D, primitiveType, params, materialId, renderer3D = null) {
    const bounds = this._getPrimitiveBounds(primitiveType, params, mapData3D);
    const dirtyChunks = new Set();
    this._loopPrimitiveVolume(mapData3D, primitiveType, params, bounds, materialId, dirtyChunks);
    this._rebuildSelectiveChunks(mapData3D, dirtyChunks, renderer3D);
  }

  static _getPrimitiveBounds(type, p, mapData) {
    const rawBounds = this._calculateRawBounds(type, p);
    return {
      minX: Math.max(0, rawBounds.minX), maxX: Math.min(mapData.sizeX - 1, rawBounds.maxX),
      minY: Math.max(0, rawBounds.minY), maxY: Math.min(mapData.sizeY - 1, rawBounds.maxY),
      minZ: Math.max(0, rawBounds.minZ), maxZ: Math.min(mapData.sizeZ - 1, rawBounds.maxZ)
    };
  }

  static _calculateRawBounds(type, p) {
    if (type === 'sphere') {
      const r = Math.ceil(p.radius);
      return { minX: p.cx - r, maxX: p.cx + r, minY: p.cy - r, maxY: p.cy + r, minZ: p.cz - r, maxZ: p.cz + r };
    }
    if (type === 'box') {
      const hx = Math.ceil(p.sizeX / 2), hy = Math.ceil(p.sizeY / 2), hz = Math.ceil(p.sizeZ / 2);
      return { minX: p.cx - hx, maxX: p.cx + hx, minY: p.cy - hy, maxY: p.cy + hy, minZ: p.cz - hz, maxZ: p.cz + hz };
    }
    if (type === 'cylinder') {
      const r = Math.ceil(p.radius), hy = Math.ceil(p.height / 2);
      return { minX: p.cx - r, maxX: p.cx + r, minY: p.cy - hy, maxY: p.cy + hy, minZ: p.cz - r, maxZ: p.cz + r };
    }
    const rT = Math.ceil(p.majorRadius + p.minorRadius), rY = Math.ceil(p.minorRadius);
    return { minX: p.cx - rT, maxX: p.cx + rT, minY: p.cy - rY, maxY: p.cy + rY, minZ: p.cz - rT, maxZ: p.cz + rT };
  }

  static _loopPrimitiveVolume(mapData3D, type, params, b, materialId, dirtyChunks) {
    for (let z = b.minZ; z <= b.maxZ; z++) {
      this._loopPrimitivePlane(mapData3D, type, params, b, z, materialId, dirtyChunks);
    }
  }

  static _loopPrimitivePlane(mapData3D, type, params, b, z, materialId, dirtyChunks) {
    for (let y = b.minY; y <= b.maxY; y++) {
      this._loopPrimitiveRow(mapData3D, type, params, b, y, z, materialId, dirtyChunks);
    }
  }

  static _loopPrimitiveRow(mapData3D, type, params, b, y, z, materialId, dirtyChunks) {
    for (let x = b.minX; x <= b.maxX; x++) {
      this._evaluatePrimitiveVoxel(mapData3D, type, params, x, y, z, materialId, dirtyChunks);
    }
  }

  static _evaluatePrimitiveVoxel(mapData3D, type, params, x, y, z, materialId, dirtyChunks) {
    const dist = this._resolveSdfDistance(type, params, x, y, z);
    if (dist > 0) return;
    setVoxel3D(mapData3D, x, y, z, materialId);
    this._markChunkDirty(x, y, z, mapData3D.chunkSize || 16, dirtyChunks);
  }

  static _resolveSdfDistance(type, p, x, y, z) {
    if (type === 'sphere') return this.sdfSphere(x, y, z, p.cx, p.cy, p.cz, p.radius);
    if (type === 'box') return this.sdfBox(x, y, z, p.cx, p.cy, p.cz, p.sizeX, p.sizeY, p.sizeZ);
    if (type === 'cylinder') return this.sdfCylinder(x, y, z, p.cx, p.cy, p.cz, p.radius, p.height);
    return this.sdfTorus(x, y, z, p.cx, p.cy, p.cz, p.majorRadius, p.minorRadius);
  }

  static _markChunkDirty(x, y, z, size, dirtyChunks) {
    const chX = Math.floor(x / size);
    const chY = Math.floor(y / size);
    const chZ = Math.floor(z / size);
    dirtyChunks.add(`${chX},${chY},${chZ}`);
  }

  static _rebuildSelectiveChunks(mapData3D, dirtyChunks, renderer3D) {
    if (!renderer3D || typeof renderer3D.rebuildChunk !== 'function') return;
    for (const key of dirtyChunks) {
      const [chX, chY, chZ] = key.split(',').map(Number);
      renderer3D.rebuildChunk(mapData3D, chX, chY, chZ);
    }
  }
}