/**
 * Renderer3D.js
 * Renderizador Babylon.js con meshing de vóxels por chunks y Face-Culling.
 * Refactorizado en subtareas planas de un máximo de 3 subtareas por método.
 **/
const RENDERER_3D_CHUNK_FACES = [
  { dir:, norm:, vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { dir: [-1, 0, 0], norm: [-1, 0, 0], vertices: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { dir:, norm:, vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { dir: [0, -1, 0], norm: [0, -1, 0], vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]] },
  { dir:, norm:, vertices: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { dir: [0, 0, -1], norm: [0, 0, -1], vertices: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

class Renderer3D extends AppObject {
  constructor(appManager) {
    super(appManager);
    this.engine = null;
    this.scene = null;
    this.cameraController = null;
    this.isInitialized = false;
    this.chunks = new Map();
    this._resizeHandler = () => this._onResize();
  }

  onInit() {
    console.log("Renderer3D registrado. Esperando Canvas...");
    window.addEventListener('resize', this._resizeHandler);
  }

  onUpdate(dt) {
    this._ensureBabylonInitialized();
    this._updateCameraController(dt);
  }

  _ensureBabylonInitialized() {
    if (this.isInitialized) return;
    this._initializeBabylon();
  }

  _initializeBabylon() {
    const canvas = document.getElementById("renderCanvas") || document.querySelector("canvas");
    if (!canvas) return;
    this._createEngineAndScene(canvas);
    this._setupLoopAndController(canvas);
  }

  _createEngineAndScene(canvas) {
    this.engine = new BABYLON.ThinEngine(canvas, true);
    this.scene = new BABYLON.Scene(this.engine);
  }

  _setupLoopAndController(canvas) {
    this.cameraController = new CameraController3D(this.appManager, this.scene);
    this.engine.runRenderLoop(() => this._renderSceneFrame());
    this.isInitialized = true;
  }

  _renderSceneFrame() {
    if (!this.scene || !this.active || this.appManager.paused) return;
    this.scene.render();
  }

  _updateCameraController(dt) {
    if (this.appManager.paused || !this.cameraController) return;
    if (typeof this.cameraController.update === "function") {
      this.cameraController.update(dt);
    }
  }

  renderFullMap3D(mapData3D) {
    if (!this.isInitialized || !mapData3D) return;
    this.clearAllChunks();
    this._iterateChunks(mapData3D);
  }

  _iterateChunks(mapData3D) {
    const size = mapData3D.chunkSize || 16;
    const limits = this._calculateChunkLimits(mapData3D, size);
    this._loopChunksZ(mapData3D, size, limits);
  }

  _calculateChunkLimits(mapData3D, size) {
    return {
      X: Math.ceil(mapData3D.width / size),
      Y: Math.ceil(mapData3D.height / size),
      Z: Math.ceil(mapData3D.thickness / size)
    };
  }

  _loopChunksZ(mapData3D, size, limits) {
    for (let cz = 0; cz < limits.Z; cz++) {
      this._loopChunksY(mapData3D, cz, size, limits);
    }
  }

  _loopChunksY(mapData3D, cz, size, limits) {
    for (let cy = 0; cy < limits.Y; cy++) {
      this._loopChunksX(mapData3D, cx, cy, cz, size, limits);
    }
  }

  _loopChunksX(mapData3D, cz, cy, size, limits) {
    for (let cx = 0; cx < limits.X; cx++) {
      this.buildChunkMesh(mapData3D, cx, cy, cz, size);
    }
  }

  buildChunkMesh(mapData3D, chunkX, chunkY, chunkZ, chunkSize) {
    const buffers = this._createGeometryBuffers();
    const bounds = this._calculateChunkBounds(chunkX, chunkY, chunkZ, chunkSize, mapData3D);
    this._processVoxelVolume(mapData3D, bounds, buffers);
    this._uploadChunkGeometry(buffers, chunkX, chunkY, chunkZ);
  }

  _createGeometryBuffers() {
    return { positions: [], indices: [], normals: [], colors: [], vertexCount: 0 };
  }

  _calculateChunkBounds(cx, cy, cz, size, mapData) {
    return {
      sX: cx * size, eX: Math.min(cx * size + size, mapData.width),
      sY: cy * size, eY: Math.min(cy * size + size, mapData.height),
      sZ: cz * size, eZ: Math.min(cz * size + size, mapData.thickness)
    };
  }

  _processVoxelVolume(mapData3D, bounds, buffers) {
    for (let z = bounds.sZ; z < bounds.eZ; z++) {
      this._processVoxelPlaneY(mapData3D, z, bounds, buffers);
    }
  }

  _processVoxelPlaneY(mapData3D, z, bounds, buffers) {
    for (let y = bounds.sY; y < bounds.eY; y++) {
      this._processVoxelRowX(mapData3D, x, y, z, bounds, buffers);
    }
  }

  _processVoxelRowX(mapData3D, y, z, bounds, buffers) {
    for (let x = bounds.sX; x < bounds.eX; x++) {
      this._evaluateVoxelGeometry(mapData3D, x, y, z, buffers);
    }
  }

  _evaluateVoxelGeometry(mapData3D, x, y, z, buffers) {
    const idx = (z * mapData3D.height * mapData3D.width) + (y * mapData3D.width) + x;
    const type = mapData3D.data[idx];
    if (type === 0) return;
    this._processVoxelFaces(mapData3D, x, y, z, type, buffers);
  }

  _processVoxelFaces(mapData3D, x, y, z, type, buffers) {
    for (const face of RENDERER_3D_CHUNK_FACES) {
      this._processSingleFace(mapData3D, x, y, z, type, face, buffers);
    }
  }

  _processSingleFace(mapData3D, x, y, z, type, face, buffers) {
    const visible = this._checkFaceVisibility(mapData3D, x + face.dir[0], y + face.dir[1], z + face.dir[2]);
    if (!visible) return;
    this._buildFaceVertices(x, y, z, type, face, buffers);
  }

  _checkFaceVisibility(mapData3D, nx, ny, nz) {
    if (nx < 0 || nx >= mapData3D.width || ny < 0 || ny >= mapData3D.height || nz < 0 || nz >= mapData3D.thickness) {
      return true;
    }
    const idx = (nz * mapData3D.height * mapData3D.width) + (ny * mapData3D.width) + nx;
    return mapData3D.data[idx] === 0;
  }

  _buildFaceVertices(x, y, z, type, face, buffers) {
    const color = this._getMaterialColor(type);
    for (const vertex of face.vertices) {
      buffers.positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);
      buffers.normals.push(face.norm[0], face.norm[1], face.norm[2]);
      buffers.colors.push(color.r, color.g, color.b, 1.0);
    }
    this._buildFaceIndices(buffers);
  }

  _buildFaceIndices(buffers) {
    buffers.indices.push(
      buffers.vertexCount, buffers.vertexCount + 1, buffers.vertexCount + 2,
      buffers.vertexCount, buffers.vertexCount + 2, buffers.vertexCount + 3
    );
    buffers.vertexCount += 4;
  }

  _uploadChunkGeometry(buffers, cx, cy, cz) {
    if (buffers.positions.length === 0) return;
    const key = `${cx}_${cy}_${cz}`;
    const mesh = new BABYLON.Mesh(`chunk_${key}`, this.scene);
    this._applyVertexBuffers(mesh, buffers);
    this._applyChunkMaterial(mesh, key);
  }

  _applyVertexBuffers(mesh, buffers) {
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = buffers.positions;
    vertexData.indices = buffers.indices;
    vertexData.normals = buffers.normals;
    vertexData.colors = buffers.colors;
    vertexData.applyToMesh(mesh);
  }

  _applyChunkMaterial(mesh, key) {
    const mat = new BABYLON.StandardMaterial(`mat_${key}`, this.scene);
    mat.backFaceCulling = true;
    mesh.material = mat;
    this.chunks.set(key, mesh);
  }

  _getMaterialColor(type) {
    if (type === 1) return { r: 0.38, g: 0.25, b: 0.13 };
    if (type === 2) return { r: 0.22, g: 0.55, b: 0.22 };
    if (type === 3) return { r: 0.7, g: 0.7, b: 0.7 };
    return { r: 1.0, g: 1.0, b: 1.0 };
  }

  clearAllChunks() {
    for (const [key, mesh] of this.chunks.entries()) {
      this._disposeMesh(mesh);
    }
    this.chunks.clear();
  }

  _disposeMesh(mesh) {
    if (!mesh) return;
    if (mesh.material) mesh.material.dispose();
    mesh.dispose();
  }

  _onResize() {
    if (this.engine) this.engine.resize();
  }

  onDestroy() {
    window.removeEventListener('resize', this._resizeHandler);
    this.active = false;
    this.clearAllChunks();
    this._clearGraphicsEngine();
  }

  _clearGraphicsEngine() {
    if (!this.engine) return;
    this.engine.dispose();
    this.engine = null;
    this.scene = null;
    this.cameraController = null;
    this.isInitialized = false;
  }
}