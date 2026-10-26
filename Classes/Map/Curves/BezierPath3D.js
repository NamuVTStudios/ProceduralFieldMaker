/**
 * BezierPath3D.js
 * Generador y rasterizador de curvas Bézier cúbicas en espacio tridimensional.
 * Permite extrusión de túneles y conductos de vóxels optimizados para MapData3D.
 */

export class BezierPath3D {
  /**
   * @param {Array<{x: number, y: number, z: number}>} controlPoints Array con 4 puntos {x, y, z}
   */
  constructor(controlPoints = []) {
    // Requiere 4 puntos de control para Bézier cúbica (P0: inicio, P1/P2: manijas, P3: fin)
    this.points = controlPoints.length === 4 ? controlPoints : [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 15, z: 5 },
      { x: 20, y: 15, z: 25 },
      { x: 30, y: 0, z: 30 }
    ];
  }

  /**
   * Evalúa la posición (x, y, z) en la curva según el parámetro t en el rango [0, 1].
   * @param {number} t
   * @returns {{x: number, y: number, z: number}}
   */
  getPoint(t) {
    const p = this.points;
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    // Fórmula polinómica estándar de Bézier cúbica
    const x = uuu * p[0].x + 3 * uu * t * p[1].x + 3 * u * tt * p[2].x + ttt * p[3].x;
    const y = uuu * p[0].y + 3 * uu * t * p[1].y + 3 * u * tt * p[2].y + ttt * p[3].y;
    const z = uuu * p[0].z + 3 * uu * t * p[1].z + 3 * u * tt * p[2].z + ttt * p[3].z;

    return { x, y, z };
  }

  /**
   * Calcula la longitud estimada de la curva dividiéndola en segmentos rectilíneos.
   * @param {number} samples
   * @returns {number}
   */
  estimateLength(samples = 20) {
    let length = 0;
    let prev = this.getPoint(0);

    for (let i = 1; i <= samples; i++) {
      const curr = this.getPoint(i / samples);
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dz = curr.z - prev.z;
      length += Math.sqrt(dx * dx + dy * dy + dz * dz);
      prev = curr;
    }

    return length;
  }

  /**
   * Rasteriza la extrusión volumétrica a lo largo de la curva dentro de MapData3D.
   * Diseñado con acceso directo a buffers para compatibilidad con Web Workers.
   * @param {object} mapData3D Instancia de MapData3D
   * @param {number} radius Radio del túnel / tubo
   * @param {number} materialId ID de material (0 = aire para cavar, >0 para construir)
   * @param {object} [renderer3D] Instancia opcional para remallar chunks afectados
   */
  rasterizeExtrusion(mapData3D, radius, materialId = 0, renderer3D = null) {
    const { sizeX, sizeY, sizeZ } = mapData3D;
    const chunkSize = mapData3D.chunkSize || 16;
    const dirtyChunks = new Set();

    // Determinar cantidad de muestras según la longitud para no dejar espacios vacíos
    const length = this.estimateLength();
    const steps = Math.max(10, Math.ceil(length * 2)); // 2 muestras por unidad métrica
    const rInt = Math.ceil(radius);
    const rSq = radius * radius;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const center = this.getPoint(t);

      const cx = Math.round(center.x);
      const cy = Math.round(center.y);
      const cz = Math.round(center.z);

      // Bounding box local de la esfera en el punto actual de la curva
      const minX = Math.max(0, cx - rInt);
      const maxX = Math.min(sizeX - 1, cx + rInt);
      const minY = Math.max(0, cy - rInt);
      const maxY = Math.min(sizeY - 1, cy + rInt);
      const minZ = Math.max(0, cz - rInt);
      const maxZ = Math.min(sizeZ - 1, cz + rInt);

      for (let z = minZ; z <= maxZ; z++) {
        const dz = z - center.z;
        for (let y = minY; y <= maxY; y++) {
          const dy = y - center.y;
          for (let x = minX; x <= maxX; x++) {
            const dx = x - center.x;

            // Condición esférica a lo largo de la trayectoria
            if (dx * dx + dy * dy + dz * dz <= rSq) {
              setVoxel3D(mapData3D, x, y, z, materialId);

              // Marcar chunk como sucio
              const chX = Math.floor(x / chunkSize);
              const chY = Math.floor(y / chunkSize);
              const chZ = Math.floor(z / chunkSize);
              dirtyChunks.add(`${chX},${chY},${chZ}`);
            }
          }
        }
      }
    }

    // Remallado selectivo en Babylon.js
    if (renderer3D && typeof renderer3D.rebuildChunk === 'function') {
      for (const key of dirtyChunks) {
        const [chX, chY, chZ] = key.split(',').map(Number);
        renderer3D.rebuildChunk(mapData3D, chX, chY, chZ);
      }
    }
  }
}