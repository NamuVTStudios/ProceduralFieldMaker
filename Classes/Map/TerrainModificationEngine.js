/**
 * TerrainModificationEngine.js
 * Submotor de edición y deformación procedural de terreno.
 * Refactorizado bajo la regla estricta de un máximo de 3 subtareas por método.
 */
class TerrainModificationEngine {
  constructor(appManager) {
    this.appManager = appManager;
  }

  _getMaterial(mapData, materialId) {
    const material = mapData.materials.find(m => m.id === materialId);
    return material ?? null;
  }

  _isMapData3D(mapData) {
    return 'sizeX' in mapData;
  }

  _getNoise(mapData) {
    this._ensureNoiseSynchronized(mapData);
    return this._noise;
  }

  _ensureNoiseSynchronized(mapData) {
    if (this._needsNewNoise(mapData)) {
      this._createNoiseForMap(mapData);
    }
  }

  _needsNewNoise(mapData) {
    return !this._noise || this._noiseSeed !== mapData.seed;
  }

  _createNoiseForMap(mapData) {
    this._noise = new NoiseGenerator(mapData.seed);
    this._noiseSeed = mapData.seed;
  }

  _getMaterialAt(mapData, x, y, z) {
    const materialId = this._getMaterialIdAt(mapData, x, y, z);
    return this._getMaterial(mapData, materialId);
  }

  _getMaterialIdAt(mapData, x, y, z) {
    if (this._isMapData3D(mapData)) return getVoxel3D(mapData, x, y, z);
    return getCell2D(mapData, x, y);
  }

  _setMaterialAt(mapData, x, y, z, materialId) {
    this._writeMaterialData(mapData, x, y, z, materialId);
  }

  _writeMaterialData(mapData, x, y, z, materialId) {
    if (this._isMapData3D(mapData)) {
      setVoxel3D(mapData, x, y, z, materialId);
    } else {
      setCell2D(mapData, x, y, materialId);
    }
  }

  /** Destruye celdas/voxels que no resistan la energía de impacto. */
  applyEraser(mapData, center, radius, impactEnergy) {
    const affectedRegion = this._computeBoundingBox(mapData, center, radius);
    const execution = { anyDestroyed: false };
    
    this._forEachCellInRadius(mapData, center, radius, (x, y, z) => {
      this._executeErasePipeline(mapData, x, y, z, impactEnergy, execution);
    });

    return { affectedRegion, anyDestroyed: execution.anyDestroyed };
  }

  _executeErasePipeline(mapData, x, y, z, energy, execution) {
    if (this._eraseMaterialAt(mapData, x, y, z, energy)) {
      execution.anyDestroyed = true;
    }
  }

  _eraseMaterialAt(mapData, x, y, z, impactEnergy) {
    const material = this._getMaterialAt(mapData, x, y, z);
    if (!this._canEraseMaterial(material, impactEnergy)) return false;
    this._setMaterialAt(mapData, x, y, z, AIR_MATERIAL_ID);
    return true;
  }

  _canEraseMaterial(material, impactEnergy) {
    if (!material || !material.destructible) return false;
    return impactEnergy >= material.hardness;
  }

  /** Deposita material únicamente sobre celdas/voxels vacíos. */
  applyBrush(mapData, center, radius, materialId) {
    const affectedRegion = this._computeBoundingBox(mapData, center, radius);
    this._forEachCellInRadius(mapData, center, radius, (x, y, z) => {
      this._fillEmptyCell(mapData, x, y, z, materialId);
    });
    return { affectedRegion };
  }

  _fillEmptyCell(mapData, x, y, z, materialId) {
    if (this._getMaterialIdAt(mapData, x, y, z) !== AIR_MATERIAL_ID) return;
    this._setMaterialAt(mapData, x, y, z, materialId);
  }

  /** Deposita material en las celdas vacías según ruido y presión del lápiz. */
  applyNoiseBrush(mapData, center, radius, materialId, noiseOptions) {
    const operation = this._createNoiseBrushOperation(mapData, center, radius, noiseOptions);
    this._forEachCellInRadius(mapData, center, radius, (x, y, z) => {
      this._applyNoiseBrushCell(mapData, x, y, z, materialId, operation.context);
    });
    return { affectedRegion: operation.affectedRegion };
  }

  _createNoiseBrushOperation(mapData, center, radius, noiseOptions) {
    return {
      context: this._createNoiseBrushContext(mapData, noiseOptions),
      affectedRegion: this._computeBoundingBox(mapData, center, radius),
    };
  }

  _createNoiseBrushContext(mapData, noiseOptions) {
    const pressure = noiseOptions.pressure > 0 ? noiseOptions.pressure : 0.5;
    return {
      frequency: noiseOptions.frequency,
      modulatedAmplitude: noiseOptions.baseAmplitude * pressure,
      resistanceThreshold: noiseOptions.resistanceThreshold,
      noise: noiseOptions.noise ?? this._getNoise(mapData),
      is3D: this._isMapData3D(mapData),
    };
  }

  _applyNoiseBrushCell(mapData, x, y, z, materialId, context) {
    if (this._getMaterialIdAt(mapData, x, y, z) !== AIR_MATERIAL_ID) return;
    if (!this._isNoiseBrushCellSelected(x, y, z, context)) return;
    this._setMaterialAt(mapData, x, y, z, materialId);
  }

  _isNoiseBrushCellSelected(x, y, z, context) {
    const sample = this._sampleNoiseAt(x, y, z, context);
    const noiseValue = sample * context.modulatedAmplitude;
    return noiseValue > context.resistanceThreshold;
  }

  _sampleNoiseAt(x, y, z, context) {
    const sX = x * context.frequency;
    const sY = y * context.frequency;
    return this._evaluateDimensionNoise(sX, sY, z, context);
  }

  _evaluateDimensionNoise(sX, sY, z, context) {
    if (context.is3D) {
      return context.noise.perlin3D(sX, sY, z * context.frequency);
    }
    return context.noise.perlin2D(sX, sY);
  }

  /** Clona una región 2D del origen al destino. */
  applyCloneStamp(mapData2D, source, target, radius) {
    this._assertCloneStampSupports2D(mapData2D);
    this._copyCloneStampArea(mapData2D, source, target, radius);
    return { affectedRegion: this._computeBoundingBox(mapData2D, target, radius) };
  }

  _assertCloneStampSupports2D(mapData) {
    if (this._isMapData3D(mapData)) {
      throw new Error('applyCloneStamp solo está soportado en modo 2D.');
    }
  }

  _copyCloneStampArea(mapData2D, source, target, radius) {
    const snapshot = this._captureCloneStampArea(mapData2D, source, radius);
    this._applyCloneStampSnapshot(mapData2D, target, radius, snapshot);
  }

  _captureCloneStampArea(mapData2D, source, radius) {
    const diameter = radius * 2 + 1;
    const snapshot = new Uint8Array(diameter * diameter);
    for (let dy = -radius; dy <= radius; dy++) {
      this._captureCloneStampRow(mapData2D, source, radius, dy, snapshot, diameter);
    }
    return snapshot;
  }

  _captureCloneStampRow(mapData2D, source, radius, dy, snapshot, diameter) {
    for (let dx = -radius; dx <= radius; dx++) {
      this._captureCloneStampCell(mapData2D, source, radius, dx, dy, snapshot, diameter);
    }
  }

  _captureCloneStampCell(mapData2D, source, radius, dx, dy, snapshot, diameter) {
    if (dx * dx + dy * dy > radius * radius) return;
    const index = (dy + radius) * diameter + dx + radius;
    snapshot[index] = getCell2D(mapData2D, source.x + dx, source.y + dy);
  }

  _applyCloneStampSnapshot(mapData2D, target, radius, snapshot) {
    const diameter = radius * 2 + 1;
    for (let dy = -radius; dy <= radius; dy++) {
      this._applyCloneStampRow(mapData2D, target, radius, dy, snapshot, diameter);
    }
  }

  _applyCloneStampRow(mapData2D, target, radius, dy, snapshot, diameter) {
    for (let dx = -radius; dx <= radius; dx++) {
      this._applyCloneStampCell(mapData2D, target, radius, dx, dy, snapshot, diameter);
    }
  }

  _applyCloneStampCell(mapData2D, target, radius, dx, dy, snapshot, diameter) {
    if (dx * dx + dy * dy > radius * radius) return;
    const index = (dy + radius) * diameter + dx + radius;
    setCell2D(mapData2D, target.x + dx, target.y + dy, snapshot[index]);
  }

  /** Calcula la bounding box del área de edición, recortada a los límites del mapa. */
  _computeBoundingBox(mapData, center, radius, margin = 4) {
    const bounds = this._getMapBounds(mapData);
    return {
      minX: Math.max(0, Math.floor(center.x - radius - margin)),
      maxX: Math.min(bounds.maxX, Math.ceil(center.x + radius + margin)),
      minY: Math.max(0, Math.floor(center.y - radius - margin)),
      maxY: Math.min(bounds.maxY, Math.ceil(center.y + radius + margin)),
      minZ: bounds.is3D ? Math.max(0, Math.floor((center.z ?? 0) - radius - margin)) : 0,
      maxZ: bounds.is3D ? Math.min(bounds.maxZ, Math.ceil((center.z ?? 0) + radius + margin)) : 0,
    };
  }

  _getMapBounds(mapData) {
    const is3D = this._isMapData3D(mapData);
    return {
      is3D,
      maxX: (is3D ? mapData.sizeX : mapData.width) - 1,
      maxY: (is3D ? mapData.sizeY : mapData.height) - 1,
      maxZ: is3D ? mapData.sizeZ - 1 : 0,
    };
  }

  /** Itera las celdas/vóxeles alcanzados por un radio. */
  forEachCellInRadius(mapData, center, radius, callback) {
    this._forEachCellInRadius(mapData, center, radius, callback);
  }

  /** Itera una esfera/círculo y comunica la distancia normalizada al centro. */
  _forEachCellInRadius(mapData, center, radius, callback) {
    const region = this._computeBoundingBox(mapData, center, radius, 0);
    const context = { center, radius, radiusSq: radius * radius, is3D: this._isMapData3D(mapData), callback };
    this._loopRadiusPlanes(region, context);
  }

  /** Itera un volumen cilíndrico/cápsula alrededor de un segmento. */
  forEachCellInCapsule(mapData, start, end, radius, callback) {
    const bounds = this._computeSegmentBounds(mapData, start, end, radius);
    const context = { start, end, radius, radiusSq: radius * radius, is3D: this._isMapData3D(mapData), callback };
    this._loopRadiusPlanes(bounds, { center: start, radius, radiusSq: Infinity, is3D: context.is3D, callback: (x, y, z) => this._processCapsuleCell(x, y, z, context) });
  }

  _computeSegmentBounds(mapData, start, end, radius) {
    const bounds = this._getMapBounds(mapData);
    return {
      minX: Math.max(0, Math.floor(Math.min(start.x, end.x) - radius)),
      maxX: Math.min(bounds.maxX, Math.ceil(Math.max(start.x, end.x) + radius)),
      minY: Math.max(0, Math.floor(Math.min(start.y, end.y) - radius)),
      maxY: Math.min(bounds.maxY, Math.ceil(Math.max(start.y, end.y) + radius)),
      minZ: bounds.is3D ? Math.max(0, Math.floor(Math.min(start.z ?? 0, end.z ?? 0) - radius)) : 0,
      maxZ: bounds.is3D ? Math.min(bounds.maxZ, Math.ceil(Math.max(start.z ?? 0, end.z ?? 0) + radius)) : 0,
    };
  }

  _processCapsuleCell(x, y, z, context) {
    const ratio = this._getSegmentDistanceRatio(x, y, z, context);
    if (ratio > 1) return;
    context.callback(x, y, z, ratio);
  }

  _getSegmentDistanceRatio(x, y, z, context) {
    const closest = this._getClosestSegmentPoint(x, y, z, context.start, context.end, context.is3D);
    const dx = x - closest.x;
    const dy = y - closest.y;
    const dz = context.is3D ? z - closest.z : 0;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) / Math.max(context.radius, 0.0001);
  }

  _getClosestSegmentPoint(x, y, z, start, end, is3D) {
    const delta = { x: end.x - start.x, y: end.y - start.y, z: is3D ? (end.z ?? 0) - (start.z ?? 0) : 0 };
    const lengthSq = delta.x * delta.x + delta.y * delta.y + delta.z * delta.z;
    const projection = lengthSq === 0 ? 0 : ((x - start.x) * delta.x + (y - start.y) * delta.y + (is3D ? (z - (start.z ?? 0)) * delta.z : 0)) / lengthSq;
    const amount = Math.max(0, Math.min(1, projection));
    return { x: start.x + delta.x * amount, y: start.y + delta.y * amount, z: (start.z ?? 0) + delta.z * amount };
  }

  _loopRadiusPlanes(region, context) {
    for (let z = region.minZ; z <= region.maxZ; z++) {
      this._forEachRadiusPlane(region, z, context);
    }
  }

  _forEachRadiusPlane(region, z, context) {
    for (let y = region.minY; y <= region.maxY; y++) {
      this._forEachRadiusRow(region, y, z, context);
    }
  }

  _forEachRadiusRow(region, y, z, context) {
    for (let x = region.minX; x <= region.maxX; x++) {
      this._processRadiusCell(x, y, z, context);
    }
  }

  _processRadiusCell(x, y, z, context) {
    const distanceSquared = this._getDistanceSquared(x, y, z, context);
    if (distanceSquared > context.radiusSq) return;
    const distanceRatio = Math.sqrt(distanceSquared) / Math.max(context.radius, 0.0001);
    context.callback(x, y, z, distanceRatio);
  }

  _getDistanceSquared(x, y, z, context) {
    const dx = x - context.center.x;
    const dy = y - context.center.y;
    const dz = context.is3D ? z - (context.center.z ?? 0) : 0;
    return dx * dx + dy * dy + dz * dz;
  }
}
