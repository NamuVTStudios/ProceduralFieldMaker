/**
 * TerrainModificationEngine.js
 *
 * Submotor central de edición de terreno (sección 6 del TDD). Muta
 * directamente los buffers de MapData2D/MapData3D (Uint8Array) y devuelve
 * la región afectada (bounding box) para que el renderer redibuje solo lo
 * modificado. No hay físicas: lo que se esculpe o destruye queda como está.
 *
 * No es un AppObject: no tiene ciclo onUpdate propio, reacciona a
 * llamadas puntuales de las Tools (Brush, Eraser, CloneStamp, NoiseBrush).
 * Vive como this.destructionEngine dentro de AppManager (composición).
 *
 * Depende de globales cargados antes por <script>: AIR_MATERIAL_ID,
 * getCell2D/setCell2D (MapData2D.js), getVoxel3D/setVoxel3D (MapData3D.js)
 * y NoiseGenerator (NoiseGenerator.js).
 */

class TerrainModificationEngine {
  constructor(appManager) {
    this.appManager = appManager;
  }

  // ---------------------------------------------------------------------
  // Helpers de material
  // ---------------------------------------------------------------------

  _getMaterial(mapData, materialId) {
    return mapData.materials.find(m => m.id === materialId) ?? null;
  }

  _isMapData3D(mapData) {
    return 'sizeX' in mapData;
  }

  /** NoiseGenerator con la seed del mapa, cacheado para no recrear la tabla de permutaciones en cada trazo. */
  _getNoise(mapData) {
    if (!this._noise || this._noiseSeed !== mapData.seed) {
      this._noise = new NoiseGenerator(mapData.seed);
      this._noiseSeed = mapData.seed;
    }
    return this._noise;
  }

  _getMaterialAt(mapData, x, y, z) {
    const materialId = this._isMapData3D(mapData)
      ? getVoxel3D(mapData, x, y, z)
      : getCell2D(mapData, x, y);
    return this._getMaterial(mapData, materialId);
  }

  _setMaterialAt(mapData, x, y, z, materialId) {
    if (this._isMapData3D(mapData)) setVoxel3D(mapData, x, y, z, materialId);
    else setCell2D(mapData, x, y, materialId);
  }

  // ---------------------------------------------------------------------
  // 6.1 — Sustracción (Goma de Borrar)
  // ---------------------------------------------------------------------

  /**
   * Destruye material dentro de un radio, respetando la dureza (hardness) de cada celda/voxel frente a la energía de impacto aplicada.
   * @param {object} mapData - MapData2D o MapData3D
   * @param {{x:number, y:number, z?:number}} center
   * @param {number} radius
   * @param {number} impactEnergy - energía del impacto (ver sección 6.1 del TDD:
   *   modo "Detonación" usa un valor alto, modo "Continuo" un valor bajo por tick)
   * @returns {{affectedRegion: object, anyDestroyed: boolean}}
   */
  applyEraser(mapData, center, radius, impactEnergy) {
    const region = this._computeBoundingBox(mapData, center, radius);
    let anyDestroyed = false;

    this._forEachCellInRadius(mapData, center, radius, (x, y, z) => {
      const material = this._getMaterialAt(mapData, x, y, z);
      if (!material || !material.destructible) return;
      if (impactEnergy < material.hardness) return; // resiste el impacto (ej. Roca)

      this._setMaterialAt(mapData, x, y, z, AIR_MATERIAL_ID);
      anyDestroyed = true;
    });
    return { affectedRegion: region, anyDestroyed };
  }

  // ---------------------------------------------------------------------
  // 6.1 — Adición (Pincel de Escultura)
  // ---------------------------------------------------------------------

  /**
   * Deposita material sobre celdas/voxels vacíos dentro de un radio.
   * No sobrescribe material existente (solo rellena aire).
   * @param {object} mapData
   * @param {{x:number, y:number, z?:number}} center
   * @param {number} radius
   * @param {number} materialId
   * @returns {{affectedRegion: object}}
   */
  applyBrush(mapData, center, radius, materialId) {
    const region = this._computeBoundingBox(mapData, center, radius);

    this._forEachCellInRadius(mapData, center, radius, (x, y, z) => {
      const currentId = this._isMapData3D(mapData) ? getVoxel3D(mapData, x, y, z) : getCell2D(mapData, x, y);
      if (currentId !== AIR_MATERIAL_ID) return; // no pisa material existente
      this._setMaterialAt(mapData, x, y, z, materialId);
    });

    // El material depositado queda estático donde se dibujó (sin gravedad ni chequeos de soporte).
    return { affectedRegion: region };
  }

  // ---------------------------------------------------------------------
  // 6.3 — NoiseBrush: adición modulada por ruido + presión del lápiz
  // ---------------------------------------------------------------------

  /**
   * Variante de applyBrush donde la amplitud del ruido (modulada por la presión del lápiz táctil) decide si cada celda se rellena o no, generando bordes orgánicos en vez de un disco/esfera perfecto.
   * @param {object} mapData
   * @param {{x:number, y:number, z?:number}} center
   * @param {number} radius
   * @param {number} materialId
   * @param {{frequency:number, baseAmplitude:number, resistanceThreshold:number, pressure?:number, noise?:NoiseGenerator}} noiseOptions
   *   `noise` es opcional: si no viene, se usa un NoiseGenerator creado con la seed del mapa.
   */
  applyNoiseBrush(mapData, center, radius, materialId, noiseOptions) {
    const { frequency, baseAmplitude, resistanceThreshold } = noiseOptions;
    const pressure = noiseOptions.pressure > 0 ? noiseOptions.pressure : 0.5; // fallback sin lápiz de presión
    const modulatedAmplitude = baseAmplitude * pressure;
    const region = this._computeBoundingBox(mapData, center, radius);
    const noise = noiseOptions.noise ?? this._getNoise(mapData);
    const is3D = this._isMapData3D(mapData);

    this._forEachCellInRadius(mapData, center, radius, (x, y, z) => {
      const currentId = this._isMapData3D(mapData) ? getVoxel3D(mapData, x, y, z) : getCell2D(mapData, x, y);
      if (currentId !== AIR_MATERIAL_ID) return;

      const sample = is3D
        ? noise.perlin3D(x * frequency, y * frequency, z * frequency)
        : noise.perlin2D(x * frequency, y * frequency);
      const noiseVal = sample * modulatedAmplitude;
      if (noiseVal > resistanceThreshold) {
        this._setMaterialAt(mapData, x, y, z, materialId);
      }
    });

    return { affectedRegion: region };
  }

  // ---------------------------------------------------------------------
  // 6.7 — Tampón de Clonación Procedural (solo 2D)
  // ---------------------------------------------------------------------

  /**
   * Clona el contenido de una región de origen hacia un destino, desplazado por el offset entre ambos puntos. Solo modo 2D.
   * @param {object} mapData2D
   * @param {{x:number, y:number}} source
   * @param {{x:number, y:number}} target
   * @param {number} radius
   */
  applyCloneStamp(mapData2D, source, target, radius) {
    if (this._isMapData3D(mapData2D)) {
      throw new Error('applyCloneStamp solo está soportado en modo 2D.');
    }
    const offsetX = target.x - source.x;
    const offsetY = target.y - source.y;
    const radiusSq = radius * radius;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radiusSq) continue;
        const sourceMaterialId = getCell2D(mapData2D, source.x + dx, source.y + dy);
        setCell2D(mapData2D, target.x + dx, target.y + dy, sourceMaterialId);
      }
    }

    const region = this._computeBoundingBox(mapData2D, target, radius);
    return { affectedRegion: region };
  }

  /**
   * Bounding box de análisis: el radio de impacto más un margen fijo, para no escanear el mapa completo en cada operación.
   */
  _computeBoundingBox(mapData, center, radius, margin = 4) {
    const is3D = this._isMapData3D(mapData);
    const maxX = is3D ? mapData.sizeX - 1 : mapData.width - 1;
    const maxY = is3D ? mapData.sizeY - 1 : mapData.height - 1;
    const maxZ = is3D ? mapData.sizeZ - 1 : 0;

    return {
      minX: Math.max(0, Math.floor(center.x - radius - margin)),
      maxX: Math.min(maxX, Math.ceil(center.x + radius + margin)),
      minY: Math.max(0, Math.floor(center.y - radius - margin)),
      maxY: Math.min(maxY, Math.ceil(center.y + radius + margin)),
      minZ: is3D ? Math.max(0, Math.floor((center.z ?? 0) - radius - margin)) : 0,
      maxZ: is3D ? Math.min(maxZ, Math.ceil((center.z ?? 0) + radius + margin)) : 0,
    };
  }

  /** Itera todas las celdas/voxels dentro del radio esférico/circular de un centro. */
  _forEachCellInRadius(mapData, center, radius, callback) {
    const is3D = this._isMapData3D(mapData);
    const region = this._computeBoundingBox(mapData, center, radius, 0);
    const radiusSq = radius * radius;

    for (let z = region.minZ; z <= region.maxZ; z++) {
      for (let y = region.minY; y <= region.maxY; y++) {
        for (let x = region.minX; x <= region.maxX; x++) {
          const dx = x - center.x, dy = y - center.y, dz = is3D ? z - (center.z ?? 0) : 0;
          if (dx * dx + dy * dy + dz * dz > radiusSq) continue;
          callback(x, y, z);
        }
      }
    }
  }
}