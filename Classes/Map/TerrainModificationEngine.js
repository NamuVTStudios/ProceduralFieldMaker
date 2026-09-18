/**
 * TerrainModificationEngine.js

 * Submotor central de edición de terreno (sección 6 del TDD). Muta directamente los buffers de MapData2D/MapData3D (Uint8Array) y, tras cada operación, dispara el pipeline de conectividad para detectar fragmentos desconectados y entregárselos al motor de físicas.

 * No es un AppObject: no tiene ciclo onUpdate propio, reacciona a
 * llamadas puntuales de las Tools (Brush, Eraser, CloneStamp, NoiseBrush).
 * Vive como this.destructionEngine dentro de AppManager (composición).

 * Depende de funciones globales ya cargadas por <script> antes que este archivo: getCell2D/setCell2D/getVoxel3D/setVoxel3D (mapDataFactory.js), NoiseGenerator.evaluate (noiseGenerator.js).
 */

const AIR_MATERIAL_ID = 0;

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
   * @param {number} impactEnergy - energía del impacto (ver sección 8 del TDD:
   *   modo "Detonación" usa un valor alto, modo "Continuo" un valor bajo por tick)
   * @returns {{affectedRegion: object, anyDestroyed: boolean}}
   */
  applyEraser(mapData, center, radius, impactEnergy) {
    const is3D = this._isMapData3D(mapData);
    const region = this._computeBoundingBox(mapData, center, radius);
    let anyDestroyed = false;

    this._forEachCellInRadius(mapData, center, radius, (x, y, z) => {
      const material = this._getMaterialAt(mapData, x, y, z);
      if (!material || !material.destructible) return;
      if (impactEnergy < material.hardness) return; // resiste el impacto (ej. Roca)

      this._setMaterialAt(mapData, x, y, z, AIR_MATERIAL_ID);
      anyDestroyed = true;
    });

    if (anyDestroyed) {
      this.checkConnectivityAndCollapse(mapData, region);
    }
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

    // El material recién depositado puede quedar "flotando" (queda congelado hasta que un impacto adyacente dispare su chequeo, según la regla de gravedad estructural del GDD) — no se corre conectividad acá a propósito, solo en destrucción.
    return { affectedRegion: region };
  }

  // ---------------------------------------------------------------------
  // 6.4 — NoiseBrush: adición modulada por ruido + presión del lápiz
  // ---------------------------------------------------------------------

  /**
   * Variante de applyBrush donde la amplitud del ruido (modulada por la presión del lápiz táctil) decide si cada celda se rellena o no, generando bordes orgánicos en vez de un disco/esfera perfecto.
   * @param {object} mapData
   * @param {{x:number, y:number, z?:number}} center
   * @param {number} radius
   * @param {number} materialId
   * @param {{frequency:number, baseAmplitude:number, resistanceThreshold:number, pressure?:number}} noiseOptions
   */
  applyNoiseBrush(mapData, center, radius, materialId, noiseOptions) {
    const { frequency, baseAmplitude, resistanceThreshold } = noiseOptions;
    const pressure = noiseOptions.pressure > 0 ? noiseOptions.pressure : 0.5; // fallback sin lápiz de presión
    const modulatedAmplitude = baseAmplitude * pressure;
    const region = this._computeBoundingBox(mapData, center, radius);

    this._forEachCellInRadius(mapData, center, radius, (x, y, z) => {
      const currentId = this._isMapData3D(mapData) ? getVoxel3D(mapData, x, y, z) : getCell2D(mapData, x, y);
      if (currentId !== AIR_MATERIAL_ID) return;

      const noiseVal = NoiseGenerator.evaluate(x * frequency, y * frequency, (z ?? 0) * frequency) * modulatedAmplitude;
      if (noiseVal > resistanceThreshold) {
        this._setMaterialAt(mapData, x, y, z, materialId);
      }
    });

    return { affectedRegion: region };
  }

  // ---------------------------------------------------------------------
  // 6.8 — Tampón de Clonación Procedural (solo 2D)
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
    this.checkConnectivityAndCollapse(mapData2D, region);
    return { affectedRegion: region };
  }

  // ---------------------------------------------------------------------
  // 6.2 — Pipeline de Conectividad y Colapso
  // ---------------------------------------------------------------------

  /**
   * Punto de entrada del pipeline de gravedad estructural (sección 6.2). Analiza la bounding box afectada, busca grupos de celdas sólidas desconectadas de la base del mundo, y las entrega al motor de físicas correspondiente como cuerpos de escombro.
   * @param {object} mapData
   * @param {object} region - bounding box afectada (ver _computeBoundingBox)
   */
  checkConnectivityAndCollapse(mapData, region) {
    const islands = this._findDisconnectedIslands(mapData, region);
    for (const island of islands) {
      this._convertIslandToDebris(mapData, island);
    }
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

  /**
   * Flood-fill dentro de la bounding box: busca grupos de celdas sólidas que NO tengan camino continuo hacia la base inamovible del mundo (y=0, o el borde del mapa según la convención del proyecto).
   * @returns {Array<{cells: Array<{x:number,y:number,z:number}>, materialId: number}>}
   */
  _findDisconnectedIslands(mapData, region) {
    const is3D = this._isMapData3D(mapData);
    const visited = new Set();
    const islands = [];

    const keyOf = (x, y, z) => `${x},${y},${z}`;
    const isSolidAt = (x, y, z) => {
      const material = this._getMaterialAt(mapData, x, y, z);
      return !!material;
    };
    const isGroundedAt = (x, y, z) => (is3D ? y === 0 : y === (is3D ? 0 : 0)); // base inamovible = y=0

    for (let z = region.minZ; z <= region.maxZ; z++) {
      for (let y = region.minY; y <= region.maxY; y++) {
        for (let x = region.minX; x <= region.maxX; x++) {
          const key = keyOf(x, y, z);
          if (visited.has(key) || !isSolidAt(x, y, z)) continue;

          // BFS del grupo conectado completo (puede salir de la bounding box
          // para confirmar si está realmente anclado a la base).
          const groupCells = [];
          const queue = [{ x, y, z }];
          let isGrounded = false;
          let firstMaterialId = this._isMapData3D(mapData) ? getVoxel3D(mapData, x, y, z) : getCell2D(mapData, x, y);
          visited.add(key);

          while (queue.length > 0) {
            const cell = queue.pop();
            groupCells.push(cell);
            if (isGroundedAt(cell.x, cell.y, cell.z)) isGrounded = true;

            const neighbors = is3D
              ? [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]
              : [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0]];

            for (const [nx, ny, nz] of neighbors) {
              const cx = cell.x + nx, cy = cell.y + ny, cz = cell.z + nz;
              const nKey = keyOf(cx, cy, cz);
              if (visited.has(nKey) || !isSolidAt(cx, cy, cz)) continue;
              visited.add(nKey);
              queue.push({ x: cx, y: cy, z: cz });
            }
          }

          if (!isGrounded) {
            islands.push({ cells: groupCells, materialId: firstMaterialId });
          }
        }
      }
    }

    return islands;
  }

  /**
   * Borra la isla del MapData estático y la entrega al motor de físicas correspondiente como cuerpo de escombro (sección 6.2, punto 4).
   */
  _convertIslandToDebris(mapData, island) {
    const material = this._getMaterial(mapData, island.materialId);
    for (const cell of island.cells) {
      this._setMaterialAt(mapData, cell.x, cell.y, cell.z, AIR_MATERIAL_ID);
    }

    const physicsEngine = this.appManager.physicsEngine;
    if (!physicsEngine) return; // sin motor de físicas activo, la isla simplemente desaparece

    if (material && material.hardness === 0) {
      // Arena / Agua: se disuelve en partículas individuales.
      physicsEngine.spawnParticleDebris(island.cells, material);
    } else {
      // Tierra / Roca: cuerpo rígido único y denso.
      physicsEngine.spawnRigidBodyDebris(island.cells, material);
    }
  }
}