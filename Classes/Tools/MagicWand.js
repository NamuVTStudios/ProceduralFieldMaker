import { Tools } from '../Base/Tools.js';

export class MagicWand extends Tools {
  constructor(appManager) {
    super(appManager);

    this.name = 'MagicWand';
    this.replacementMaterialId = 0; // 0 = aire (vaciar/ahuecar), o el ID del material a reemplazar
    this.maxFillLimit = 250000;     // Límite de seguridad para evitar bloqueos
  }

  /**
   * Se ejecuta cuando el usuario hace clic sobre el lienzo.
   * @param {PointerEvent} event
   * @param {object} worldCoords Coordenadas de impacto {x, y, z}
   */
  onPointerDown(event, worldCoords) {
    const mapData = this.appManager.mapData;
    if (!mapData) return;

    const startX = Math.floor(worldCoords.x);
    const startY = Math.floor(worldCoords.y);
    const startZ = Math.floor(worldCoords.z ?? 0);

    if (this.appManager.mode === '2d') {
      this._floodFill2D(mapData, startX, startY, this.replacementMaterialId);
    } else {
      this._floodFill3D(mapData, startX, startY, startZ, this.replacementMaterialId);
    }
  }

  onPointerMove() {}
  onPointerUp() {}

  /**
   * Algoritmo Flood-Fill BFS para 2D (4-conectividad).
   * @private
   */
  _floodFill2D(mapData, startX, startY, newMaterial) {
    if (startX < 0 || startX >= mapData.width || startY < 0 || startY >= mapData.height) return;

    const startIndex = startY * mapData.width + startX;
    const targetMaterial = mapData.cells[startIndex];

    // Si la celda cliqueada ya tiene el material destino, no hace falta procesar
    if (targetMaterial === newMaterial) return;

    const width = mapData.width;
    const height = mapData.height;
    const totalCells = width * height;

    // Buffer plano de visitados para consulta en tiempo constante O(1)
    const visited = new Uint8Array(totalCells);

    // Colas indexadas para evitar recursión y Stack Overflow
    const queueX = new Int32Array(totalCells);
    const queueY = new Int32Array(totalCells);
    let head = 0;
    let tail = 0;

    queueX[tail] = startX;
    queueY[tail] = startY;
    tail++;
    visited[startIndex] = 1;

    let processedCount = 0;

    // Vecinos: Este, Oeste, Sur, Norte
    const dx = [1, -1, 0, 0];
    const dy = [0, 0, 1, -1];

    while (head < tail && processedCount < this.maxFillLimit) {
      const cx = queueX[head];
      const cy = queueY[head];
      head++;
      processedCount++;

      // Asignar el nuevo material usando la función de MapData2D
      setCell2D(mapData, cx, cy, newMaterial);

      for (let i = 0; i < 4; i++) {
        const nx = cx + dx[i];
        const ny = cy + dy[i];

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIdx = ny * width + nx;

          if (visited[neighborIdx] === 0 && mapData.cells[neighborIdx] === targetMaterial) {
            visited[neighborIdx] = 1;
            queueX[tail] = nx;
            queueY[tail] = ny;
            tail++;
          }
        }
      }
    }

    // Notificar al renderer 2D si corresponde
    const renderer2D = this.appManager.objects.find(obj => obj.renderAll || obj.worldContainer);
    if (renderer2D && typeof renderer2D.renderAll === 'function') {
      renderer2D.renderAll(mapData);
    }
  }

  /**
   * Algoritmo Flood-Fill BFS para 3D (6-conectividad de caras ortogonales).
   * @private
   */
  _floodFill3D(mapData, startX, startY, startZ, newMaterial) {
    const { sizeX, sizeY, sizeZ } = mapData;
    if (
      startX < 0 || startX >= sizeX ||
      startY < 0 || startY >= sizeY ||
      startZ < 0 || startZ >= sizeZ
    ) {
      return;
    }

    const startIndex = startX + sizeX * (startY + sizeY * startZ);
    const targetMaterial = mapData.voxels[startIndex];

    if (targetMaterial === newMaterial) return;

    const totalVoxels = sizeX * sizeY * sizeZ;
    const visited = new Uint8Array(totalVoxels);

    const maxQueue = Math.min(totalVoxels, this.maxFillLimit);
    const queueX = new Int32Array(maxQueue);
    const queueY = new Int32Array(maxQueue);
    const queueZ = new Int32Array(maxQueue);
    let head = 0;
    let tail = 0;

    queueX[tail] = startX;
    queueY[tail] = startY;
    queueZ[tail] = startZ;
    tail++;
    visited[startIndex] = 1;

    const chunkSize = mapData.chunkSize || 16;
    const dirtyChunks = new Set();
    let processedCount = 0;

    // 6 vecinos colindantes (+X, -X, +Y, -Y, +Z, -Z)
    const dx = [1, -1, 0, 0, 0, 0];
    const dy = [0, 0, 1, -1, 0, 0];
    const dz = [0, 0, 0, 0, 1, -1];

    while (head < tail && processedCount < this.maxFillLimit) {
      const cx = queueX[head];
      const cy = queueY[head];
      const cz = queueZ[head];
      head++;
      processedCount++;

      setVoxel3D(mapData, cx, cy, cz, newMaterial);

      const chunkKey = `${Math.floor(cx / chunkSize)},${Math.floor(cy / chunkSize)},${Math.floor(cz / chunkSize)}`;
      dirtyChunks.add(chunkKey);

      for (let i = 0; i < 6; i++) {
        const nx = cx + dx[i];
        const ny = cy + dy[i];
        const nz = cz + dz[i];

        if (
          nx >= 0 && nx < sizeX &&
          ny >= 0 && ny < sizeY &&
          nz >= 0 && nz < sizeZ
        ) {
          const neighborIdx = nx + sizeX * (ny + sizeY * nz);

          if (visited[neighborIdx] === 0 && mapData.voxels[neighborIdx] === targetMaterial) {
            visited[neighborIdx] = 1;
            if (tail < maxQueue) {
              queueX[tail] = nx;
              queueY[tail] = ny;
              queueZ[tail] = nz;
              tail++;
            }
          }
        }
      }
    }

    // Remallar los chunks de 16x16x16 afectados en Babylon.js
    const renderer3D = this.appManager.objects.find(obj => typeof obj.rebuildChunk === 'function');
    if (renderer3D) {
      for (const key of dirtyChunks) {
        const [cx, cy, cz] = key.split(',').map(Number);
        renderer3D.rebuildChunk(mapData, cx, cy, cz);
      }
    }
  }
}