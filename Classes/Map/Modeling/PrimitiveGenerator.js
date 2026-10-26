/**
 * PrimitiveGenerator.js
 * Generador y rasterizador de primitivas volumétricas mediante funciones de distancia signada (SDF).
 * Inyecta figuras geométricas básicas dentro del buffer plano Uint8Array de MapData3D.
 */

export class PrimitiveGenerator {
  /**
   * SDF de una Esfera.
   * @param {number} x @param {number} y @param {number} z Coordenadas del vóxel
   * @param {number} cx @param {number} cy @param {number} cz Centro de la esfera
   * @param {number} radius Radio
   * @returns {number} Distancia signada (<= 0 indica que está dentro)
   */
  static sdfSphere(x, y, z, cx, cy, cz, radius) {
    const dx = x - cx;
    const dy = y - cy;
    const dz = z - cz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - radius;
  }

  /**
   * SDF de un Cubo / Caja orientada a los ejes (Box).
   * @param {number} x @param {number} y @param {number} z
   * @param {number} cx @param {number} cy @param {number} cz
   * @param {number} sizeX @param {number} sizeY @param {number} sizeZ Dimensiones totales
   * @returns {number}
   */
  static sdfBox(x, y, z, cx, cy, cz, sizeX, sizeY, sizeZ) {
    const halfX = sizeX / 2;
    const halfY = sizeY / 2;
    const halfZ = sizeZ / 2;

    const dx = Math.abs(x - cx) - halfX;
    const dy = Math.abs(y - cy) - halfY;
    const dz = Math.abs(z - cz) - halfZ;

    // Distancia exterior euclidiana
    const outsideDist = Math.sqrt(
      Math.max(dx, 0) ** 2 +
      Math.max(dy, 0) ** 2 +
      Math.max(dz, 0) ** 2
    );

    // Distancia interior negativa
    const insideDist = Math.min(Math.max(dx, Math.max(dy, dz)), 0);

    return outsideDist + insideDist;
  }

  /**
   * SDF de un Cilindro vertical (alineado en el eje Y).
   * @param {number} x @param {number} y @param {number} z
   * @param {number} cx @param {number} cy @param {number} cz
   * @param {number} radius Radio del cilindro
   * @param {number} height Altura total
   * @returns {number}
   */
  static sdfCylinder(x, y, z, cx, cy, cz, radius, height) {
    const dx = x - cx;
    const dz = z - cz;
    const distRadial = Math.sqrt(dx * dx + dz * dz) - radius;
    const distY = Math.abs(y - cy) - height / 2;

    const outsideDist = Math.sqrt(
      Math.max(distRadial, 0) ** 2 +
      Math.max(distY, 0) ** 2
    );

    const insideDist = Math.min(Math.max(distRadial, distY), 0);
    return outsideDist + insideDist;
  }

  /**
   * SDF de un Toro (Dona en el plano XZ).
   * @param {number} x @param {number} y @param {number} z
   * @param {number} cx @param {number} cy @param {number} cz
   * @param {number} majorRadius Radio mayor (del centro al tubo)
   * @param {number} minorRadius Radio menor (grosor del tubo)
   * @returns {number}
   */
  static sdfTorus(x, y, z, cx, cy, cz, majorRadius, minorRadius) {
    const dx = x - cx;
    const dz = z - cz;
    // Distancia al anillo central
    const qx = Math.sqrt(dx * dx + dz * dz) - majorRadius;
    const qy = y - cy;

    return Math.sqrt(qx * qx + qy * qy) - minorRadius;
  }

  /**
   * Estampa una primitiva en el MapData3D evaluando el cuadro delimitador (Bounding Box).
   * @param {object} mapData3D
   * @param {string} primitiveType 'sphere' | 'box' | 'cylinder' | 'torus'
   * @param {object} params Parámetros geométricos y posición
   * @param {number} materialId ID del material a inyectar
   * @param {object} [renderer3D] Instancia opcional para forzar remallado
   */
  static rasterizePrimitive(mapData3D, primitiveType, params, materialId, renderer3D = null) {
    const { cx, cy, cz } = params;

    // Calcular la caja delimitadora (AABB) para no iterar el mapa entero
    let bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };

    switch (primitiveType) {
      case 'sphere': {
        const r = Math.ceil(params.radius);
        bounds = { minX: cx - r, maxX: cx + r, minY: cy - r, maxY: cy + r, minZ: cz - r, maxZ: cz + r };
        break;
      }
      case 'box': {
        const hx = Math.ceil(params.sizeX / 2);
        const hy = Math.ceil(params.sizeY / 2);
        const hz = Math.ceil(params.sizeZ / 2);
        bounds = { minX: cx - hx, maxX: cx + hx, minY: cy - hy, maxY: cy + hy, minZ: cz - hz, maxZ: cz + hz };
        break;
      }
      case 'cylinder': {
        const r = Math.ceil(params.radius);
        const hy = Math.ceil(params.height / 2);
        bounds = { minX: cx - r, maxX: cx + r, minY: cy - hy, maxY: cy + hy, minZ: cz - r, maxZ: cz + r };
        break;
      }
      case 'torus': {
        const rTotal = Math.ceil(params.majorRadius + params.minorRadius);
        const rY = Math.ceil(params.minorRadius);
        bounds = { minX: cx - rTotal, maxX: cx + rTotal, minY: cy - rY, maxY: cy + rY, minZ: cz - rTotal, maxZ: cz + rTotal };
        break;
      }
      default:
        throw new Error(`Tipo de primitiva no reconocido: ${primitiveType}`);
    }

    // Clampeo a los límites del mapa
    const minX = Math.max(0, bounds.minX);
    const maxX = Math.min(mapData3D.sizeX - 1, bounds.maxX);
    const minY = Math.max(0, bounds.minY);
    const maxY = Math.min(mapData3D.sizeY - 1, bounds.maxY);
    const minZ = Math.max(0, bounds.minZ);
    const maxZ = Math.min(mapData3D.sizeZ - 1, bounds.maxZ);

    const dirtyChunks = new Set();
    const chunkSize = mapData3D.chunkSize || 16;

    for (let z = minZ; z <= maxZ; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          let dist = 1;

          if (primitiveType === 'sphere') {
            dist = this.sdfSphere(x, y, z, cx, cy, cz, params.radius);
          } else if (primitiveType === 'box') {
            dist = this.sdfBox(x, y, z, cx, cy, cz, params.sizeX, params.sizeY, params.sizeZ);
          } else if (primitiveType === 'cylinder') {
            dist = this.sdfCylinder(x, y, z, cx, cy, cz, params.radius, params.height);
          } else if (primitiveType === 'torus') {
            dist = this.sdfTorus(x, y, z, cx, cy, cz, params.majorRadius, params.minorRadius);
          }

          // Si el vóxel está dentro o sobre la superficie de la primitiva
          if (dist <= 0) {
            setVoxel3D(mapData3D, x, y, z, materialId);

            const chunkKey = `${Math.floor(x / chunkSize)},${Math.floor(y / chunkSize)},${Math.floor(z / chunkSize)}`;
            dirtyChunks.add(chunkKey);
          }
        }
      }
    }

    // Reconstruir únicamente los chunks afectados en la vista 3D
    if (renderer3D && typeof renderer3D.rebuildChunk === 'function') {
      for (const key of dirtyChunks) {
        const [chunkX, chunkY, chunkZ] = key.split(',').map(Number);
        renderer3D.rebuildChunk(mapData3D, chunkX, chunkY, chunkZ);
      }
    }
  }
}