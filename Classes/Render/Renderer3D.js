/**
 * Renderer3D.js
 * Renderizador 3D basado en Three.js con meshing de vóxels por Chunks y Face-Culling.
 * Hereda de AppObject y responde al ciclo de vida del AppManager.
 */
class Renderer3D extends AppObject {
  constructor(appManager) {
    super(appManager);

    // Componentes principales de Three.js
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Contenedor de mallas de chunks activos (clave: "cx,cy,cz", valor: THREE.Mesh)
    this.chunks = new Map();

    // Material compartido con soporte para colores por vértice
    this.voxelMaterial = null;

    // Manejo de redimensionado de ventana
    this._onResize = this._onResize.bind(this);
  }

  /**
   * Inicialización del entorno Three.js.
   */
  async onInit() {
    // 1. Crear Escena
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // 2. Crear Cámara en perspectiva
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(30, 40, 50);
    this.camera.lookAt(0, 0, 0);

    // 3. Crear Renderizador WebGL
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(this.renderer.domElement);

    // 4. Iluminación básica para apreciar el volumen 3D
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 80, 40);
    this.scene.add(dirLight);

    // 5. Material con colores por vértice (permite pintar cada material sin múltiples texturas)
    this.voxelMaterial = new THREE.MeshLambertMaterial({
      vertexColors: true,
    });

    window.addEventListener('resize', this._onResize);

    // 6. Si ya hay un mapa cargado en el AppManager, construir sus mallas
    if (this.appManager.mapData) {
      this.buildAllChunks(this.appManager.mapData);
    }
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
   */
  buildChunk(mapData3D, cx, cy, cz) {
    const chunkSize = mapData3D.chunkSize || 16;
    const startX = cx * chunkSize;
    const startY = cy * chunkSize;
    const startZ = cz * chunkSize;

    const endX = Math.min(startX + chunkSize, mapData3D.sizeX);
    const endY = Math.min(startY + chunkSize, mapData3D.sizeY);
    const endZ = Math.min(startZ + chunkSize, mapData3D.sizeZ);

    // Búfers temporales de geometría
    const positions = [];
    const normals = [];
    const colors = [];

    // Mapa de colores de materiales
    const colorMap = new Map();
    for (const mat of mapData3D.materials) {
      colorMap.set(mat.id, new THREE.Color(mat.color));
    }

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

          const blockColor = colorMap.get(materialId) || new THREE.Color(0xffffff);

          // FACE-CULLING: Revisamos los 6 vecinos de este bloque
          for (const face of faces) {
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];

            const neighbor = getVoxel3D(mapData3D, nx, ny, nz);

            // Si el vecino es aire (0), esta cara es visible hacia el exterior
            if (neighbor === 0) {
              const [v0, v1, v2, v3] = face.v;

              // Generamos 2 triángulos por cara (v0, v1, v2) y (v0, v2, v3)
              const faceVerts = [
                v0, v1, v2,
                v0, v2, v3
              ];

              for (const vert of faceVerts) {
                positions.push(x + vert[0], y + vert[1], z + vert[2]);
                normals.push(...face.norm);
                colors.push(blockColor.r, blockColor.g, blockColor.b);
              }
            }
          }
        }
      }
    }

    // Si el chunk está completamente vacío de caras visibles, terminar
    if (positions.length === 0) return;

    // Crear BufferGeometry y asignarle los búfers
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const mesh = new THREE.Mesh(geometry, this.voxelMaterial);
    const chunkKey = `${cx},${cy},${cz}`;

    this.scene.add(mesh);
    this.chunks.set(chunkKey, mesh);
  }

  /**
   * Limpia las mallas de todos los chunks existentes.
   */
  clearAllChunks() {
    for (const [, mesh] of this.chunks) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.chunks.clear();
  }

  _onResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Ciclo por fotograma (render loop).
   */
  onUpdate(dt) {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onDestroy() {
    window.removeEventListener('resize', this._onResize);
    this.clearAllChunks();
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
    }
  }
}