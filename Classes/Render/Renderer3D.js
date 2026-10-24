/**
 * Renderer3D.js
 * Renderizador Babylon.js con meshing de vóxels por chunks y Face-Culling.
 * El ciclo de render lo controla AppManager para mantener un único loop.
 */
const RENDERER_3D_CHUNK_FACES = [
  { dir: [1, 0, 0], norm: [1, 0, 0], vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { dir: [-1, 0, 0], norm: [-1, 0, 0], vertices: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { dir: [0, 1, 0], norm: [0, 1, 0], vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { dir: [0, -1, 0], norm: [0, -1, 0], vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]] },
  { dir: [0, 0, 1], norm: [0, 0, 1], vertices: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { dir: [0, 0, -1], norm: [0, 0, -1], vertices: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

class Renderer3D extends AppObject {
  constructor(appManager) {
    super(appManager);
    this.canvas = null;
    this.engine = null;
    this.scene = null;
    this.camera = null;
    this.chunks = new Map();
    this.voxelMaterial = null;
    this.boundsMeshes = [];
  }

  onInit() {
    this._initializeRenderingEnvironment();
    this._initializeSceneResources();
    this._loadCurrentMap();
  }

  _initializeRenderingEnvironment() {
    this._createCanvas();
    this._createEngine();
    this._createScene();
  }

  _createCanvas() {
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, {
      width: '100vw',
      height: '100dvh',
      display: 'block',
      touchAction: 'none',
    });
    document.body.appendChild(this.canvas);
  }

  _createEngine() {
    this.engine = new BABYLON.Engine(this.canvas, true);
    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  }

  _createScene() {
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.useRightHandedSystem = true;
    this.scene.clearColor = new BABYLON.Color4(0x1a / 255, 0x1a / 255, 0x1a / 255, 1);
  }

  _initializeSceneResources() {
    this._createCamera();
    this._createLighting();
    this._createVoxelMaterial();
  }

  _createCamera() {
    this.camera = new BABYLON.ArcRotateCamera(
      'camera3D', 0, 0, 1, BABYLON.Vector3.Zero(), this.scene
    );
    this.camera.setPosition(new BABYLON.Vector3(30, 40, 50));
    this.camera.setTarget(BABYLON.Vector3.Zero());
    this.camera.fov = 60 * Math.PI / 180;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 1000;
    this.camera.lowerRadiusLimit = 2;
    this.camera.wheelPrecision = 5;
    this.camera.attachControl(true);
  }

  _createLighting() {
    this._createAmbientLight();
    this._createDirectionalLight();
  }

  _createAmbientLight() {
    const light = new BABYLON.HemisphericLight('ambientLight', new BABYLON.Vector3(0, 1, 0), this.scene);
    light.intensity = 0.6;
    light.groundColor = light.diffuse.clone();
  }

  _createDirectionalLight() {
    const direction = new BABYLON.Vector3(-50, -80, -40).normalize();
    const light = new BABYLON.DirectionalLight('dirLight', direction, this.scene);
    light.intensity = 0.8;
  }

  _createVoxelMaterial() {
    this.voxelMaterial = new BABYLON.StandardMaterial('voxelMaterial', this.scene);
    this.voxelMaterial.specularColor = BABYLON.Color3.Black();
  }

  _loadCurrentMap() {
    if (!this.appManager.mapData) return;
    this.loadMap(this.appManager.mapData);
  }

  /** Muestra los límites, encuadra la cámara y construye los chunks del mapa. */
  loadMap(mapData3D) {
    this._buildWorkspaceBounds(mapData3D);
    this._frameCamera(mapData3D);
    this.buildAllChunks(mapData3D);
  }

  _buildWorkspaceBounds(mapData3D) {
    this._disposeBounds();
    this.boundsMeshes = [
      this._createWorkspaceBox(mapData3D),
      this._createWorkspaceGrid(mapData3D),
    ];
    this._markBoundsNonPickable();
  }

  _createWorkspaceBox(mapData3D) {
    const { sizeX: x, sizeY: y, sizeZ: z } = mapData3D;
    const vector = (px, py, pz) => new BABYLON.Vector3(px, py, pz);
    const edges = [
      [vector(0, 0, 0), vector(x, 0, 0)],
      [vector(x, 0, 0), vector(x, 0, z)],
      [vector(x, 0, z), vector(0, 0, z)],
      [vector(0, 0, z), vector(0, 0, 0)],
      [vector(0, y, 0), vector(x, y, 0)],
      [vector(x, y, 0), vector(x, y, z)],
      [vector(x, y, z), vector(0, y, z)],
      [vector(0, y, z), vector(0, y, 0)],
      [vector(0, 0, 0), vector(0, y, 0)],
      [vector(x, 0, 0), vector(x, y, 0)],
      [vector(x, 0, z), vector(x, y, z)],
      [vector(0, 0, z), vector(0, y, z)],
    ];
    const box = BABYLON.MeshBuilder.CreateLineSystem('workspaceBox', { lines: edges }, this.scene);
    box.color = new BABYLON.Color3(0.6, 0.6, 0.6);
    return box;
  }

  _createWorkspaceGrid(mapData3D) {
    const lines = this._createWorkspaceGridLines(mapData3D);
    return this._createWorkspaceGridMesh(lines);
  }

  _createWorkspaceGridLines(mapData3D) {
    const step = mapData3D.chunkSize || 16;
    const lines = [];
    this._appendGridLinesAlongX(lines, mapData3D, step);
    this._appendGridLinesAlongZ(lines, mapData3D, step);
    return lines;
  }

  _createWorkspaceGridMesh(lines) {
    const grid = BABYLON.MeshBuilder.CreateLineSystem('workspaceGrid', { lines }, this.scene);
    grid.color = new BABYLON.Color3(0.32, 0.32, 0.32);
    return grid;
  }

  _appendGridLinesAlongX(lines, mapData3D, step) {
    const vector = (x, y, z) => new BABYLON.Vector3(x, y, z);
    for (let x = 0; x <= mapData3D.sizeX; x += step) {
      lines.push([vector(x, 0, 0), vector(x, 0, mapData3D.sizeZ)]);
    }
  }

  _appendGridLinesAlongZ(lines, mapData3D, step) {
    const vector = (x, y, z) => new BABYLON.Vector3(x, y, z);
    for (let z = 0; z <= mapData3D.sizeZ; z += step) {
      lines.push([vector(0, 0, z), vector(mapData3D.sizeX, 0, z)]);
    }
  }

  _markBoundsNonPickable() {
    for (const mesh of this.boundsMeshes) mesh.isPickable = false;
  }

  _disposeBounds() {
    for (const mesh of this.boundsMeshes) mesh.dispose();
    this.boundsMeshes = [];
  }

  _frameCamera(mapData3D) {
    const frame = this._getCameraFrame(mapData3D);
    this._positionCameraForFrame(frame);
    this.camera.upperRadiusLimit = frame.size * 5;
  }

  _getCameraFrame(mapData3D) {
    return {
      center: this._getMapCenter(mapData3D),
      size: Math.max(mapData3D.sizeX, mapData3D.sizeY, mapData3D.sizeZ),
    };
  }

  _positionCameraForFrame({ center, size }) {
    this.camera.setPosition(new BABYLON.Vector3(
      center.x + size * 0.9, center.y + size * 0.8, center.z + size * 1.1
    ));
    this.camera.setTarget(new BABYLON.Vector3(center.x, center.y, center.z));
  }

  _getMapCenter(mapData3D) {
    return {
      x: mapData3D.sizeX / 2,
      y: mapData3D.sizeY / 2,
      z: mapData3D.sizeZ / 2,
    };
  }

  buildAllChunks(mapData3D) {
    this.clearAllChunks();
    const dimensions = this._getChunkDimensions(mapData3D);
    this._buildChunksAlongZ(mapData3D, dimensions);
  }

  _getChunkDimensions(mapData3D) {
    const chunkSize = mapData3D.chunkSize || 16;
    return {
      chunkSize,
      x: Math.ceil(mapData3D.sizeX / chunkSize),
      y: Math.ceil(mapData3D.sizeY / chunkSize),
      z: Math.ceil(mapData3D.sizeZ / chunkSize),
    };
  }

  _buildChunksAlongZ(mapData3D, dimensions) {
    for (let cz = 0; cz < dimensions.z; cz++) {
      this._buildChunksAlongY(mapData3D, dimensions, cz);
    }
  }

  _buildChunksAlongY(mapData3D, dimensions, cz) {
    for (let cy = 0; cy < dimensions.y; cy++) {
      this._buildChunksAlongX(mapData3D, dimensions, cy, cz);
    }
  }

  _buildChunksAlongX(mapData3D, dimensions, cy, cz) {
    for (let cx = 0; cx < dimensions.x; cx++) {
      this.buildChunk(mapData3D, cx, cy, cz);
    }
  }

  /** Construye o reemplaza la geometría de un chunk específico. */
  buildChunk(mapData3D, cx, cy, cz) {
    const chunk = this._prepareChunk(mapData3D, cx, cy, cz);
    this._populateChunk(mapData3D, chunk);
    this._renderChunk(chunk);
  }

  _prepareChunk(mapData3D, cx, cy, cz) {
    const key = this._getChunkKey(cx, cy, cz);
    this._disposeChunk(key);
    return this._createChunkContext(mapData3D, cx, cy, cz, key);
  }

  _getChunkKey(cx, cy, cz) {
    return `${cx},${cy},${cz}`;
  }

  _createChunkContext(mapData3D, cx, cy, cz, key) {
    const bounds = this._getChunkBounds(mapData3D, cx, cy, cz);
    return {
      key,
      ...bounds,
      ...this._createGeometryBuffers(),
      colorMap: this._createMaterialColorMap(mapData3D.materials),
      faces: RENDERER_3D_CHUNK_FACES,
    };
  }

  _getChunkBounds(mapData3D, cx, cy, cz) {
    const chunkSize = mapData3D.chunkSize || 16;
    const startX = cx * chunkSize;
    const startY = cy * chunkSize;
    const startZ = cz * chunkSize;
    return {
      startX,
      startY,
      startZ,
      endX: Math.min(startX + chunkSize, mapData3D.sizeX),
      endY: Math.min(startY + chunkSize, mapData3D.sizeY),
      endZ: Math.min(startZ + chunkSize, mapData3D.sizeZ),
    };
  }

  _createGeometryBuffers() {
    return { positions: [], normals: [], colors: [], indices: [] };
  }

  _createMaterialColorMap(materials) {
    const colorMap = new Map();
    for (const material of materials) {
      colorMap.set(material.id, BABYLON.Color3.FromHexString(material.color));
    }
    return colorMap;
  }

  _populateChunk(mapData3D, chunk) {
    for (let y = chunk.startY; y < chunk.endY; y++) {
      this._populateChunkLayer(mapData3D, chunk, y);
    }
  }

  _populateChunkLayer(mapData3D, chunk, y) {
    for (let z = chunk.startZ; z < chunk.endZ; z++) {
      this._populateChunkRow(mapData3D, chunk, y, z);
    }
  }

  _populateChunkRow(mapData3D, chunk, y, z) {
    for (let x = chunk.startX; x < chunk.endX; x++) {
      this._populateVoxel(mapData3D, chunk, x, y, z);
    }
  }

  _populateVoxel(mapData3D, chunk, x, y, z) {
    const materialId = getVoxel3D(mapData3D, x, y, z);
    if (materialId === AIR_MATERIAL_ID) return;
    this._appendVoxelFaces(mapData3D, chunk, x, y, z, this._getVoxelColor(chunk, materialId));
  }

  _getVoxelColor(chunk, materialId) {
    return chunk.colorMap.get(materialId) || new BABYLON.Color3(1, 1, 1);
  }

  _appendVoxelFaces(mapData3D, chunk, x, y, z, blockColor) {
    for (const face of chunk.faces) {
      this._appendVisibleFace(mapData3D, chunk, face, x, y, z, blockColor);
    }
  }

  _appendVisibleFace(mapData3D, chunk, face, x, y, z, blockColor) {
    if (!this._isFaceVisible(mapData3D, face, x, y, z)) return;
    this._appendFaceGeometry(chunk, face, x, y, z, blockColor);
  }

  _isFaceVisible(mapData3D, face, x, y, z) {
    const neighbor = getVoxel3D(
      mapData3D,
      x + face.dir[0],
      y + face.dir[1],
      z + face.dir[2]
    );
    return neighbor === AIR_MATERIAL_ID;
  }

  _appendFaceGeometry(chunk, face, x, y, z, blockColor) {
    const baseVertex = chunk.positions.length / 3;
    this._appendFaceVertices(chunk, face, x, y, z, blockColor);
    this._appendFaceIndices(chunk, baseVertex);
  }

  _appendFaceIndices(chunk, baseVertex) {
    chunk.indices.push(baseVertex, baseVertex + 1, baseVertex + 2, baseVertex, baseVertex + 2, baseVertex + 3);
  }

  _appendFaceVertices(chunk, face, x, y, z, color) {
    for (const vertex of face.vertices) {
      chunk.positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);
      chunk.normals.push(face.norm[0], face.norm[1], face.norm[2]);
      chunk.colors.push(color.r, color.g, color.b, 1);
    }
  }

  _renderChunk(chunk) {
    if (chunk.positions.length === 0) return;
    const mesh = this._createChunkMesh(chunk);
    this._registerChunkMesh(chunk.key, mesh);
  }

  _registerChunkMesh(chunkKey, mesh) {
    mesh.material = this.voxelMaterial;
    mesh.isPickable = false;
    this.chunks.set(chunkKey, mesh);
  }

  _createChunkMesh(chunk) {
    const mesh = new BABYLON.Mesh(`chunk_${chunk.key}`, this.scene);
    this._applyChunkGeometry(mesh, chunk);
    return mesh;
  }

  _applyChunkGeometry(mesh, chunk) {
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = chunk.positions;
    vertexData.normals = chunk.normals;
    vertexData.colors = chunk.colors;
    vertexData.indices = chunk.indices;
    vertexData.applyToMesh(mesh);
  }

  _disposeChunk(chunkKey) {
    const mesh = this.chunks.get(chunkKey);
    if (!mesh) return;
    mesh.dispose();
    this.chunks.delete(chunkKey);
  }

  clearAllChunks() {
    for (const mesh of this.chunks.values()) mesh.dispose();
    this.chunks.clear();
  }

  onResize() {
    if (this.engine) this.engine.resize();
  }

  onUpdate() {
    if (this.scene && this.scene.activeCamera) this.scene.render();
  }

  onDestroy() {
    this._disposeWorld();
    this._disposeRuntime();
    this._resetReferences();
  }

  _disposeWorld() {
    this._disposeBounds();
    this.clearAllChunks();
  }

  _disposeRuntime() {
    this._disposeBabylonCore();
    this._removeCanvas();
  }

  _disposeBabylonCore() {
    if (this.voxelMaterial) this.voxelMaterial.dispose();
    if (this.scene) this.scene.dispose();
    if (this.engine) this.engine.dispose();
  }

  _removeCanvas() {
    if (this.canvas) this.canvas.remove();
  }

  _resetReferences() {
    this.chunks = new Map();
    this.voxelMaterial = null;
    this.scene = null;
    this.engine = null;
    this.canvas = null;
    this.camera = null;
  }
}
