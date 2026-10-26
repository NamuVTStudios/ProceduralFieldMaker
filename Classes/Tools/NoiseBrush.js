/**
 * NoiseBrush.js
 * Herramienta de escultura dinámica y texturizado de roca mediante inyección de ruido.
 * La presión del cursor (Pointer Events) modula la amplitud del ruido fractal.
 * Hereda de la clase base Tools.
 */
import { Tools } from '../Base/Tools.js';
import { NoiseGenerator } from '../Map/Generators/NoiseGenerator.js';

export class NoiseBrush extends Tools {
  /**
   * @param {object} appManager Instancia global del AppManager
   */
  constructor(appManager) {
    super(appManager);

    this.name = 'NoiseBrush';
    this.radius = 4;
    this.frequency = 0.15;
    this.baseAmplitude = 1.0;
    this.resistanceThreshold = 0.2; // Umbral de corte para inyectar masa
    this.selectedMaterialId = 3;    // ID del material a inyectar (ej. Roca)

    this.defaultPressureFallback = 0.5;
    this.isDrawing = false;
  }

  /**
   * Se dispara al presionar el cursor sobre el lienzo.
   * @param {PointerEvent} event
   * @param {object} worldCoords Coordenadas transformadas del mundo {x, y, z}
   */
  onPointerDown(event, worldCoords) {
    this.isDrawing = true;
    this.applyBrush(event, worldCoords);
  }

  /**
   * Se dispara al mover el cursor con el botón apretado.
   * @param {PointerEvent} event
   * @param {object} worldCoords Coordenadas transformadas del mundo {x, y, z}
   */
  onPointerMove(event, worldCoords) {
    if (!this.isDrawing) return;
    this.applyBrush(event, worldCoords);
  }

  /**
   * Se dispara al soltar el clic o levantar el lápiz.
   */
  onPointerUp() {
    this.isDrawing = false;
  }

  /**
   * Aplica la inyección de ruido según el modo activo (2D o 3D).
   * @param {PointerEvent} event
   * @param {object} coords {x, y, z}
   */
  applyBrush(event, coords) {
    const mapData = this.appManager.mapData;
    if (!mapData) return;

    // Modulación por presión de Pointer Events (TDD sección 6.3)
    const pressure = (event && event.pressure > 0)
      ? event.pressure
      : this.defaultPressureFallback;

    const modulatedAmplitude = this.baseAmplitude * pressure;

    if (this.appManager.mode === '2d') {
      this._apply2D(mapData, Math.floor(coords.x), Math.floor(coords.y), modulatedAmplitude);
    } else {
      this._apply3D(mapData, Math.floor(coords.x), Math.floor(coords.y), Math.floor(coords.z ?? 0), modulatedAmplitude);
    }
  }

  /**
   * Inyección de ruido en modo 2D (corte estratigráfico).
   * @private
   */
  _apply2D(mapData, centerX, centerY, amplitude) {
    const noise = new NoiseGenerator(mapData.seedHash);
    const r = Math.ceil(this.radius);

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // Comprobar si está dentro del radio circular del pincel
        if (dx * dx + dy * dy > this.radius * this.radius) continue;

        const targetX = centerX + dx;
        const targetY = centerY + dy;

        // Fuera de límites
        if (targetX < 0 || targetX >= mapData.width || targetY < 0 || targetY >= mapData.height) {
          continue;
        }

        // Evaluar ruido fractal en la coordenada
        const noiseVal = noise.fbm2D(targetX * this.frequency, targetY * this.frequency, 3) * amplitude;

        if (noiseVal > this.resistanceThreshold) {
          setCell2D(mapData, targetX, targetY, this.selectedMaterialId);
        }
      }
    }
  }

  /**
   * Inyección de ruido volumétrico en modo 3D.
   * @private
   */
  _apply3D(mapData, centerX, centerY, centerZ, amplitude) {
    const noise = new NoiseGenerator(mapData.seedHash);
    const r = Math.ceil(this.radius);

    // Chunks afectados para marcarlos como sucios y reconstruirlos
    const dirtyChunks = new Set();
    const chunkSize = mapData.chunkSize || 16;

    for (let dz = -r; dz <= r; dz++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          // Comprobar radio esférico
          if (dx * dx + dy * dy + dz * dz > this.radius * this.radius) continue;

          const targetX = centerX + dx;
          const targetY = centerY + dy;
          const targetZ = centerZ + dz;

          if (
            targetX < 0 || targetX >= mapData.sizeX ||
            targetY < 0 || targetY >= mapData.sizeY ||
            targetZ < 0 || targetZ >= mapData.sizeZ
          ) {
            continue;
          }

          const noiseVal = noise.perlin3D(
            targetX * this.frequency,
            targetY * this.frequency,
            targetZ * this.frequency
          ) * amplitude;

          if (noiseVal > this.resistanceThreshold) {
            setVoxel3D(mapData, targetX, targetY, targetZ, this.selectedMaterialId);

            // Registrar chunk afectado para remallar
            const cx = Math.floor(targetX / chunkSize);
            const cy = Math.floor(targetY / chunkSize);
            const cz = Math.floor(targetZ / chunkSize);
            dirtyChunks.add(`${cx},${cy},${cz}`);
          }
        }
      }
    }

    // Si el renderer 3D está activo, reconstruir solo los chunks modificados
    const renderer3D = this.appManager.objects.find(obj => obj.rebuildChunk);
    if (renderer3D) {
      for (const key of dirtyChunks) {
        const [cx, cy, cz] = key.split(',').map(Number);
        renderer3D.rebuildChunk(mapData, cx, cy, cz);
      }
    }
  }
}