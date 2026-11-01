/**
 * NoiseBrush.js
 * Herramienta de escultura dinámica mediante ruido fractal 2D y Perlin 3D.
 * La presión de Pointer Events modula la amplitud. Todos los recorridos son planos.
 */
const NOISE_BRUSH_DEFAULTS = {
  radius: 4,
  frequency: 0.15,
  baseAmplitude: 1,
  resistanceThreshold: 0.2,
  selectedMaterialId: 3,
  defaultPressureFallback: 0.5,
};

class NoiseBrush extends Tools {
  constructor(appManager) {
    super(appManager);
    this.name = 'NoiseBrush';
    this.label = 'Noise Brush';
    Object.assign(this, NOISE_BRUSH_DEFAULTS);
    this.isDrawing = false;
  }

  onPointerDown(event, worldCoords) {
    this.isDrawing = true;
    this.applyBrush(event, worldCoords);
  }

  onPointerMove(event, worldCoords) {
    if (!this.isDrawing) return;
    this.applyBrush(event, worldCoords);
  }

  onPointerUp() {
    this.isDrawing = false;
  }

  applyBrush(event, coords) {
    if (!this.prepareMaterialLayer(this.selectedMaterialId)) return;
    const context = this._createBrushContext(event, coords);
    if (!context) return;
    this._processBrushContext(context);
  }

  _createBrushContext(event, coords) {
    const mapData = this.getEditableMapData();
    if (!mapData || !coords) return null;
    const amplitude = this.baseAmplitude * this._resolvePressure(event);
    return { mapData, center: this._normalizeCoordinates(coords), amplitude };
  }

  _processBrushContext(context) {
    const dirtyContext = this._applyByProjectMode(context.mapData, context.center, context.amplitude);
    this.commitToolChanges(false);
    this._refreshAfterNoise(dirtyContext);
  }

  _resolvePressure(event) {
    return this.resolveInputPressure(event);
  }

  _normalizeCoordinates(coords) {
    return {
      x: Math.floor(coords.x),
      y: Math.floor(coords.y),
      z: Math.floor(coords.z ?? 0),
    };
  }

  _applyByProjectMode(mapData, center, amplitude) {
    if (this.appManager.mode === '2d') {
      this._apply2D(mapData, center.x, center.y, amplitude);
      return null;
    }
    return this._apply3D(mapData, center.x, center.y, center.z, amplitude);
  }

  _apply2D(mapData, centerX, centerY, amplitude) {
    const context = this._create2DContext(mapData, centerX, centerY, amplitude);
    this._scan2DRows(context);
  }

  _create2DContext(mapData, centerX, centerY, amplitude) {
    return {
      mapData, centerX, centerY, amplitude,
      radius: Math.ceil(this.radius),
      noise: new NoiseGenerator(mapData.seedHash),
    };
  }

  _scan2DRows(context) {
    for (let dy = -context.radius; dy <= context.radius; dy++) {
      this._scan2DRow(context, dy);
    }
  }

  _scan2DRow(context, dy) {
    for (let dx = -context.radius; dx <= context.radius; dx++) {
      this._process2DOffset(context, dx, dy);
    }
  }

  _process2DOffset(context, dx, dy) {
    if (!this._isInside2DBrush(dx, dy)) return;
    const targetX = context.centerX + dx;
    const targetY = context.centerY + dy;
    if (!this._isInside2DMap(context.mapData, targetX, targetY)) return;
    this._inject2DMaterial(context, targetX, targetY);
  }

  _isInside2DBrush(dx, dy) {
    return dx * dx + dy * dy <= this.radius * this.radius;
  }

  _isInside2DMap(mapData, x, y) {
    return x >= 0 && x < mapData.width && y >= 0 && y < mapData.height;
  }

  _inject2DMaterial(context, x, y) {
    const noiseValue = context.noise.fbm2D(x * this.frequency, y * this.frequency, 3) * context.amplitude;
    if (noiseValue <= this.resistanceThreshold) return;
    setCell2D(context.mapData, x, y, this.selectedMaterialId);
  }

  _apply3D(mapData, centerX, centerY, centerZ, amplitude) {
    const context = this._create3DContext(mapData, centerX, centerY, centerZ, amplitude);
    this._scan3DDepth(context);
    return context;
  }

  _create3DContext(mapData, centerX, centerY, centerZ, amplitude) {
    return {
      mapData,
      centerX,
      centerY,
      centerZ,
      amplitude,
      radius: Math.ceil(this.radius),
      radiusSquared: this.radius * this.radius,
      noise: new NoiseGenerator(mapData.seedHash),
      chunkSize: mapData.chunkSize || 16,
      dirtyChunks: new Set(),
    };
  }

  _scan3DDepth(context) {
    for (let dz = -context.radius; dz <= context.radius; dz++) {
      this._scan3DPlane(context, dz);
    }
  }

  _scan3DPlane(context, dz) {
    for (let dy = -context.radius; dy <= context.radius; dy++) {
      this._scan3DRow(context, dy, dz);
    }
  }

  _scan3DRow(context, dy, dz) {
    for (let dx = -context.radius; dx <= context.radius; dx++) {
      this._process3DOffset(context, dx, dy, dz);
    }
  }

  _process3DOffset(context, dx, dy, dz) {
    if (!this._isInside3DBrush(dx, dy, dz, context.radiusSquared)) return;
    const target = this._get3DTarget(context, dx, dy, dz);
    if (!this._isInside3DMap(context.mapData, target)) return;
    this._inject3DMaterial(context, target);
  }

  _isInside3DBrush(dx, dy, dz, radiusSquared) {
    return dx * dx + dy * dy + dz * dz <= radiusSquared;
  }

  _get3DTarget(context, dx, dy, dz) {
    return { x: context.centerX + dx, y: context.centerY + dy, z: context.centerZ + dz };
  }

  _isInside3DMap(mapData, target) {
    return target.x >= 0 && target.x < mapData.sizeX &&
      target.y >= 0 && target.y < mapData.sizeY &&
      target.z >= 0 && target.z < mapData.sizeZ;
  }

  _inject3DMaterial(context, target) {
    const noiseValue = context.noise.perlin3D(
      target.x * this.frequency,
      target.y * this.frequency,
      target.z * this.frequency,
    ) * context.amplitude;
    if (noiseValue <= this.resistanceThreshold) return;
    setVoxel3D(context.mapData, target.x, target.y, target.z, this.selectedMaterialId);
    this._markDirtyChunk(context, target);
  }

  _markDirtyChunk(context, target) {
    const chunkX = Math.floor(target.x / context.chunkSize);
    const chunkY = Math.floor(target.y / context.chunkSize);
    const chunkZ = Math.floor(target.z / context.chunkSize);
    context.dirtyChunks.add(`${chunkX},${chunkY},${chunkZ}`);
  }

  _refreshAfterNoise(context) {
    if (this.appManager.mode === '2d') return this.requestFullRender();
    this._rebuildDirtyChunks(context);
  }

  _rebuildDirtyChunks(context) {
    if (!context) return;
    const renderer = this._get3DRenderer();
    if (!renderer || typeof renderer.rebuildChunk !== 'function') return;
    for (const key of context.dirtyChunks) {
      this._rebuildChunkFromKey(renderer, this.appManager.mapData, key);
    }
  }

  _get3DRenderer() {
    if (this.appManager.renderer) return this.appManager.renderer;
    return this.appManager.objects.find(object => typeof object.rebuildChunk === 'function') || null;
  }

  _rebuildChunkFromKey(renderer, mapData, key) {
    const [chunkX, chunkY, chunkZ] = key.split(',').map(Number);
    renderer.rebuildChunk(mapData, chunkX, chunkY, chunkZ);
  }
}
