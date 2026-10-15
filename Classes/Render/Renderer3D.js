/**
 * Renderer3D.js
 * Renderizador 3D basado en Babylon.js con meshing de vóxels por Chunks y Face-Culling.
 * Hereda de AppObject y responde al ciclo de vida del AppManager.
 */
class Renderer3D extends AppObject {
  constructor(appManager) {
    super(appManager);

    // Componentes principales de Babylon.js
    this.engine = null;
    this.scene = null;
    this.camera = null;
    this.canvas = null;

    // Mapa de mallas activas por Chunk (clave: "cx,cy,cz", valor: BABYLON.Mesh)
    this.chunks = new Map();

    // Material compartido con soporte para colores por vértice
    this.voxelMaterial = null;

    this._onResize = this._onResize.bind(this);
  }

  /**
   * Inicialización del entorno Babylon.js.
   */
  async onInit() {
    // 1. Crear el elemento Canvas en el DOM
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'renderCanvas3D';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.touchAction = 'none';
    document.body.appendChild(this.canvas);

    // 2. Inicializar Engine y Escena
    this.engine = new BABYLON.Engine(this.canvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1.0);

    // 3. Cámara en perspectiva básica (configurada hacia el centro del espacio)
    this.camera = new BABYLON.FreeCamera(
      'defaultCam',
      new BABYLON.Vector3(30, 40, -50),
      this.scene
    );
    this.camera.setTarget(new BABYLON.Vector3(16, 10, 16));

    // 4. Iluminación hemisférica y direccional
    const hemiLight = new BABYLON.HemisphericLight(
      'hemiLight',
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    hemiLight.intensity = 0.6;

    const dirLight = new BABYLON.DirectionalLight(
      'dirLight',
      new BABYLON.Vector3(-1, -2, -1),
      this.scene
    );
    dirLight.position = new BABYLON.Vector3(50, 80, 50);
    dirLight.intensity = 0.7;

    // 5. Material estándar con colores por vértice activados
    this.voxelMaterial = new BABYLON.StandardMaterial('voxelMat', this.scene);
    this.voxelMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

    window.addEventListener('resize', this._onResize);

    // 6. Construir geometría si ya existe un mapa instanciado
    if (this.appManager.mapData) {
      this.buildAllChunks(this.appManager.mapData);
    }
  }

  /**
   * Recorre el mapa volumétrico y genera las mallas para cada Chunk.
   * @param {object} mapData3D
   */
  buildAllChunks(mapData3D) {
    this.clearAllChunks();

    const chunkSize = mapData3D.chunkSize || 16;
    const chunksX = Math.ceil(mapData3D.sizeX / chunkSize);
    const chunksY = Math.ceil(mapData3D.sizeY / chunkSize);
    const chunksZ = Math.ceil(mapData3D.sizeZ / chunkSize);

    for (let cz = 0; cz < chunksZ; cz++) {
      for (let cy = 0; cy < chunksY; cy++) {
        for (let cx = 0; cx < chunksX; cx++) {
          this.buildChunk(mapData3D, cx, cy, cz);
        }
      }
    }
  }

  /**
   * Construye un chunk individual aplicando Face-Culling y asignando colores por vértice.
   */
  buildChunk(mapData3D, cx, cy, cz) {
    const chunkSize = mapData3D.chunkSize || 16;
    const startX = cx * chunkSize;
    const startY = cy * chunkSize;
    const startZ = cz * chunkSize;

    const endX = Math.min(startX + chunkSize, mapData3D.sizeX);
    const endY = Math.min(startY + chunkSize, mapData3D.sizeY);
    const endZ = Math.min(startZ + chunkSize, mapData3D.sizeZ);

    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];

    // Mapeo rápido de colores por material (r, g, b, a normalizados 0 a 1)
    const colorMap = new Map();
    for (const mat of mapData3D.materials) {
      const hex = mat.color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      colorMap.set(mat.id, [r, g, b, 1.0]);
    }

    // Configuración de las 6 caras con normales y vértices locales
    const faces = [
      // Derecha (+X)
      { dir: [1, 0, 0], norm: [1, 0, 0], v: [[1,0,0], [1,1,0], [1,1,1], [1,0,1]] },
      // Izquierda (-X)
      { dir: [-1, 0, 0], norm: [-1, 0, 0], v: [[0,0,1], [0,1,1], [0,1,0], [0,0,0]] },
      // Arriba (+Y)
      { dir: [0, 1, 0], norm: [0, 1, 0], v: [[0,1,0], [0,1,1], [1,1,1], [1,1,0]] },
      // Abajo (-Y)
      { dir: [0, -1, 0], norm: [0, -1, 0], v: [[0,0,1], [0,0,0], [1,0,0], [1,0,1]] },
      // Frente (+Z)
      { dir: [0, 0, 1], norm: [0, 0, 1], v: [[1,0,1], [1,1,1], [0,1,1], [0,0,1]] },
      // Fondo (-Z)
      { dir: [0, 0, -1], norm: [0, 0, -1], v: [[0,0,0], [0,1,0], [1,1,0], [1,0,0]] }
    ];

    let vertIndexTracker = 0;

    for (let y = startY; y < endY; y++) {
      for (let z = startZ; z < endZ; z++) {
        for (let x = startX; x < endX; x++) {
          const materialId = getVoxel3D(mapData3D, x, y, z);
          if (materialId === 0) continue; // Aire

          const col = colorMap.get(materialId) || [1.0, 1.0, 1.0, 1.0];

          // Face-Culling: evaluar vecinos
          for (const face of faces) {
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];

            const neighbor = getVoxel3D(mapData3D, nx, ny, nz);

            // Si el vecino es aire (0), generamos la cara poligonal
            if (neighbor === 0) {
              for (let i = 0; i < 4; i++) {
                const vert = face.v[i];
                positions.push(x + vert[0], y + vert[1], z + vert[2]);
                normals.push(...face.norm);
                colors.push(...col);
              }

              // Triangulación de la cara (0, 1, 2) y (0, 2, 3)
              indices.push(
                vertIndexTracker,
                vertIndexTracker + 1,
                vertIndexTracker + 2,
                vertIndexTracker,
                vertIndexTracker + 2,
                vertIndexTracker + 3
              );
              vertIndexTracker += 4;
            }
          }
        }
      }
    }

    if (positions.length === 0) return;

    // Crear la malla del Chunk mediante VertexData en Babylon.js
    const chunkMesh = new BABYLON.Mesh(`chunk_${cx}_${cy}_${cz}`, this.scene);
    const vertexData = new BABYLON.VertexData();

    vertexData.positions = positions;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.indices = indices;

    vertexData.applyToMesh(chunkMesh);
    chunkMesh.material = this.voxelMaterial;

    const chunkKey = `${cx},${cy},${cz}`;
    this.chunks.set(chunkKey, chunkMesh);
  }

  /**
   * Permite reconstruir un único Chunk tras una modificación o destrucción local.
   */
  rebuildChunk(mapData3D, cx, cy, cz) {
    const chunkKey = `${cx},${cy},${cz}`;
    const existingMesh = this.chunks.get(chunkKey);
    if (existingMesh) {
      existingMesh.dispose();
      this.chunks.delete(chunkKey);
    }
    this.buildChunk(mapData3D, cx, cy, cz);
  }

  clearAllChunks() {
    for (const [, mesh] of this.chunks) {
      mesh.dispose();
    }
    this.chunks.clear();
  }

  _onResize() {
    if (this.engine) {
      this.engine.resize();
    }
  }

  /**
   * Bucle de ejecución por cuadro.
   */
  onUpdate(dt) {
    if (this.scene) {
      this.scene.render();
    }
  }

  onDestroy() {
    window.removeEventListener('resize', this._onResize);
    this.clearAllChunks();
    if (this.scene) {
      this.scene.dispose();
      this.scene = null;
    }
    if (this.engine) {
      this.engine.dispose();
      this.engine = null;
    }
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
  }
}