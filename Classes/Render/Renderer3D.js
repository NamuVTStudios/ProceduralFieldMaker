/**
 * Renderer3D.js
 * Renderizador 3D basado en Babylon.js con meshing de vóxels por Chunks y Face-Culling.
 * Hereda de AppObject y responde al ciclo de vida del AppManager.
 *
 * Notas de la migración desde Three.js:
 * - La escena usa sistema de coordenadas DERECHO (scene.useRightHandedSystem = true),
 *   igual que Three.js y glTF/GLB. Así el meshing (orden antihorario de vértices) y
 *   el futuro GLBExporter no necesitan invertir nada.
 * - El loop de render lo maneja el AppManager (scene.render() en onUpdate), no
 *   engine.runRenderLoop, para tener un único loop en toda la app.
 * - El redimensionado lo dispara AppManager.onResize() -> this.onResize().
 */
class Renderer3D extends AppObject {
  constructor(appManager) {
    super(appManager);

    // Componentes principales de Babylon.js
    this.canvas = null;
    this.engine = null;
    this.scene = null;
    this.camera = null;

    // Contenedor de mallas de chunks activos (clave: "cx,cy,cz", valor: BABYLON.Mesh)
    this.chunks = new Map();

    // Material compartido con soporte para colores por vértice
    this.voxelMaterial = null;

    // Líneas que marcan los límites del lienzo (caja + grilla en la base)
    this.boundsMeshes = [];
  }

  /**
   * Inicialización del entorno Babylon.js.
   */
  onInit() {
    // 1. Canvas + motor WebGL (la resolución se limita a DPR 2 para cuidar el rendimiento en móvil)
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100dvh';
    this.canvas.style.display = 'block';
    this.canvas.style.touchAction = 'none';
    document.body.appendChild(this.canvas);

    this.engine = new BABYLON.Engine(this.canvas, true);
    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));

    // 2. Escena (sistema derecho, fondo gris oscuro)
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.useRightHandedSystem = true;
    this.scene.clearColor = new BABYLON.Color4(0x1a / 255, 0x1a / 255, 0x1a / 255, 1);

    // 3. Cámara orbital en perspectiva (la navegación fina queda para CameraController3D)
    this.camera = new BABYLON.ArcRotateCamera('camera3D', 0, 0, 1, BABYLON.Vector3.Zero(), this.scene);
    this.camera.setPosition(new BABYLON.Vector3(30, 40, 50));
    this.camera.setTarget(BABYLON.Vector3.Zero());
    this.camera.fov = 60 * Math.PI / 180;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 1000;
    this.camera.lowerRadiusLimit = 2;
    this.camera.wheelPrecision = 5;
    this.camera.attachControl(true);

    // 4. Iluminación básica para apreciar el volumen 3D
    const ambientLight = new BABYLON.HemisphericLight('ambientLight', new BABYLON.Vector3(0, 1, 0), this.scene);
    ambientLight.intensity = 0.6;
    ambientLight.groundColor = ambientLight.diffuse.clone(); // mismo color arriba y abajo = luz ambiente uniforme

    const dirLight = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(-50, -80, -40).normalize(), this.scene);
    dirLight.intensity = 0.8;

    // 5. Material con colores por vértice (permite pintar cada material sin múltiples texturas)
    this.voxelMaterial = new BABYLON.StandardMaterial('voxelMaterial', this.scene);
    this.voxelMaterial.specularColor = BABYLON.Color3.Black(); // sin brillo especular, como un material Lambert

    // 6. Si ya hay un mapa cargado en el AppManager, mostrarlo
    if (this.appManager.mapData) {
      this.loadMap(this.appManager.mapData);
    }
  }

  /**
   * Muestra un mapa nuevo: dibuja los límites del lienzo (visibles aunque esté vacío),
   * encuadra la cámara y construye las mallas de los chunks.
   * @param {object} mapData3D Estructura creada con createMapData3D
   */
  loadMap(mapData3D) {
    this._buildWorkspaceBounds(mapData3D);
    this._frameCamera(mapData3D);
    this.buildAllChunks(mapData3D);
  }

  /** Caja con las 12 aristas del volumen + grilla en la base cada `chunkSize` vóxels. */
  _buildWorkspaceBounds(mapData3D) {
    this._disposeBounds();

    const X = mapData3D.sizeX, Y = mapData3D.sizeY, Z = mapData3D.sizeZ;
    const V = (x, y, z) => new BABYLON.Vector3(x, y, z);

    const edges = [
      // base
      [V(0, 0, 0), V(X, 0, 0)], [V(X, 0, 0), V(X, 0, Z)], [V(X, 0, Z), V(0, 0, Z)], [V(0, 0, Z), V(0, 0, 0)],
      // tapa
      [V(0, Y, 0), V(X, Y, 0)], [V(X, Y, 0), V(X, Y, Z)], [V(X, Y, Z), V(0, Y, Z)], [V(0, Y, Z), V(0, Y, 0)],
      // aristas verticales
      [V(0, 0, 0), V(0, Y, 0)], [V(X, 0, 0), V(X, Y, 0)], [V(X, 0, Z), V(X, Y, Z)], [V(0, 0, Z), V(0, Y, Z)],
    ];
    const box = BABYLON.MeshBuilder.CreateLineSystem('workspaceBox', { lines: edges }, this.scene);
    box.color = new BABYLON.Color3(0.6, 0.6, 0.6);

    const step = mapData3D.chunkSize || 16;
    const gridLines = [];
    for (let x = 0; x <= X; x += step) gridLines.push([V(x, 0, 0), V(x, 0, Z)]);
    for (let z = 0; z <= Z; z += step) gridLines.push([V(0, 0, z), V(X, 0, z)]);
    const grid = BABYLON.MeshBuilder.CreateLineSystem('workspaceGrid', { lines: gridLines }, this.scene);
    grid.color = new BABYLON.Color3(0.32, 0.32, 0.32);

    this.boundsMeshes = [box, grid];
    for (const mesh of this.boundsMeshes) mesh.isPickable = false;
  }

  _disposeBounds() {
    for (const mesh of this.boundsMeshes) mesh.dispose();
    this.boundsMeshes = [];
  }

  /** Apunta la cámara al centro del volumen, a una distancia que lo muestre completo. */
  _frameCamera(mapData3D) {
    const cx = mapData3D.sizeX / 2, cy = mapData3D.sizeY / 2, cz = mapData3D.sizeZ / 2;
    const size = Math.max(mapData3D.sizeX, mapData3D.sizeY, mapData3D.sizeZ);

    this.camera.setPosition(new BABYLON.Vector3(cx + size * 0.9, cy + size * 0.8, cz + size * 1.1));
    this.camera.setTarget(new BABYLON.Vector3(cx, cy, cz));
    this.camera.upperRadiusLimit = size * 5;
  }

  /**
   * Recorre el mapa y construye la geometría de cada Chunk.
   * @param {object} mapData3D Estructura creada con createMapData3D
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
   * Genera la malla 3D de un chunk específico aplicando Face-Culling.
   * Si el chunk ya tenía una malla, la reemplaza (sirve para remallar tras una edición).
   */
  buildChunk(mapData3D, cx, cy, cz) {
    const chunkKey = `${cx},${cy},${cz}`;
    this._disposeChunk(chunkKey);

    const chunkSize = mapData3D.chunkSize || 16;
    const startX = cx * chunkSize;
    const startY = cy * chunkSize;
    const startZ = cz * chunkSize;

    const endX = Math.min(startX + chunkSize, mapData3D.sizeX);
    const endY = Math.min(startY + chunkSize, mapData3D.sizeY);
    const endZ = Math.min(startZ + chunkSize, mapData3D.sizeZ);

    // Búfers temporales de geometría (indexada: 4 vértices + 6 índices por cara)
    const positions = [];
    const normals = [];
    const colors = []; // Babylon exige RGBA (4 valores por vértice)
    const indices = [];

    // Mapa de colores de materiales
    const colorMap = new Map();
    for (const mat of mapData3D.materials) {
      colorMap.set(mat.id, BABYLON.Color3.FromHexString(mat.color));
    }
    const white = new BABYLON.Color3(1, 1, 1);

    // Definición de las 6 caras de un cubo: [offsetVecino, normalVector, 4 vértices locales]
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

    // Recorrer los vóxels del chunk
    for (let y = startY; y < endY; y++) {
      for (let z = startZ; z < endZ; z++) {
        for (let x = startX; x < endX; x++) {
          const materialId = getVoxel3D(mapData3D, x, y, z);
          if (materialId === 0) continue; // Aire

          const blockColor = colorMap.get(materialId) || white;

          // FACE-CULLING: Revisamos los 6 vecinos de este bloque
          for (const face of faces) {
            const neighbor = getVoxel3D(mapData3D, x + face.dir[0], y + face.dir[1], z + face.dir[2]);

            // Si el vecino es aire (0), esta cara es visible hacia el exterior
            if (neighbor === 0) {
              const base = positions.length / 3;

              for (const vert of face.v) {
                positions.push(x + vert[0], y + vert[1], z + vert[2]);
                normals.push(face.norm[0], face.norm[1], face.norm[2]);
                colors.push(blockColor.r, blockColor.g, blockColor.b, 1);
              }
              // 2 triángulos por cara: (v0, v1, v2) y (v0, v2, v3)
              indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
          }
        }
      }
    }

    // Si el chunk está completamente vacío de caras visibles, no hay malla
    if (positions.length === 0) return;

    // Armar la malla a partir de los búfers
    const mesh = new BABYLON.Mesh(`chunk_${chunkKey}`, this.scene);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.indices = indices;
    vertexData.applyToMesh(mesh);

    mesh.material = this.voxelMaterial;
    mesh.isPickable = false; // las herramientas usan el MapData, no el picking de mallas
    this.chunks.set(chunkKey, mesh);
  }

  /** Elimina la malla de un chunk (si existe) sin tocar el material compartido. */
  _disposeChunk(chunkKey) {
    const mesh = this.chunks.get(chunkKey);
    if (!mesh) return;
    mesh.dispose();
    this.chunks.delete(chunkKey);
  }

  /**
   * Limpia las mallas de todos los chunks existentes.
   */
  clearAllChunks() {
    for (const [, mesh] of this.chunks) {
      mesh.dispose();
    }
    this.chunks.clear();
  }

  /** Llamado por AppManager.onResize() cuando cambia el tamaño de la ventana. */
  onResize() {
    if (this.engine) this.engine.resize();
  }

  /**
   * Ciclo por fotograma (render loop).
   */
  onUpdate(dt) {
    if (this.scene && this.scene.activeCamera) {
      this.scene.render();
    }
  }

  onDestroy() {
    this._disposeBounds();
    this.clearAllChunks();
    if (this.voxelMaterial) this.voxelMaterial.dispose();
    if (this.scene) this.scene.dispose();
    if (this.engine) this.engine.dispose();
    if (this.canvas) this.canvas.remove();
    this.chunks = new Map();
    this.voxelMaterial = this.scene = this.engine = this.canvas = this.camera = null;
  }
}
