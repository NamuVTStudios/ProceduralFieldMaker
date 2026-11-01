/**
 * Renderer3D.js
 * Renderizador Babylon.js con meshing de vóxels por chunks, face-culling y gizmos.
 * Los recorridos de volumen están divididos en métodos planos, sin controles anidados.
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
    this.engine = null;
    this.scene = null;
    this.cameraController = null;
    this.gizmoManager = null;
    this._pointerObserver = null;
    this._toolPointerDown = false;
    this.isInitialized = false;
    this.chunks = new Map();
    this.workspaceHelpers = [];
    this._resizeHandler = () => this._onResize();
  }

  onInit() {
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
    const canvas = document.getElementById('renderCanvas');
    if (!this._isCanvasReady(canvas)) return;
    this._activateBabylonViewport(canvas);
  }

  _isCanvasReady(canvas) {
    if (!canvas || !canvas.isConnected) return false;
    const bounds = canvas.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0;
  }

  _activateBabylonViewport(canvas) {
    this._prepareBabylonViewport(canvas);
    this._createWorkspaceHelpers();
    this._renderInitialMap();
  }

  _prepareBabylonViewport(canvas) {
    this._createEngineAndScene(canvas);
    this._configureSceneEnvironment();
    this._setupLoopAndController(canvas);
  }

  _renderInitialMap() {
    this.renderFullMap3D(this.getMapData());
  }

  _createEngineAndScene(canvas) {
    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
    });
    this.scene = new BABYLON.Scene(this.engine);
    this.engine.resize();
  }

  _configureSceneEnvironment() {
    this.scene.clearColor = new BABYLON.Color4(0.055, 0.071, 0.09, 1);
    this.scene.ambientColor = new BABYLON.Color3(0.7, 0.7, 0.7);
  }

  _createWorkspaceHelpers() {
    this._createGroundGrid();
    this._createVolumeOutline();
    this._createCoordinateAxes();
  }

  _createGroundGrid() {
    const mapData = this.getMapData();
    const lines = this._buildGroundGridLines(mapData.sizeX, mapData.sizeZ);
    this._createLineSystem('workspace_grid', lines, new BABYLON.Color3(0.22, 0.29, 0.38));
  }

  _createLineSystem(name, lines, color) {
    const mesh = BABYLON.MeshBuilder.CreateLineSystem(name, { lines }, this.scene);
    this._registerWorkspaceHelper(mesh, color);
  }

  _registerWorkspaceHelper(mesh, color) {
    mesh.color = color;
    mesh.isPickable = false;
    this.workspaceHelpers.push(mesh);
  }

  _buildGroundGridLines(sizeX, sizeZ) {
    return [
      ...this._buildGridLinesAlongX(sizeX, sizeZ),
      ...this._buildGridLinesAlongZ(sizeX, sizeZ),
    ];
  }

  _buildGridLinesAlongX(sizeX, sizeZ) {
    const lines = [];
    for (let x = 0; x <= sizeX; x++) {
      lines.push([
        new BABYLON.Vector3(x, -0.025, 0),
        new BABYLON.Vector3(x, -0.025, sizeZ),
      ]);
    }
    return lines;
  }

  _buildGridLinesAlongZ(sizeX, sizeZ) {
    const lines = [];
    for (let z = 0; z <= sizeZ; z++) {
      lines.push([
        new BABYLON.Vector3(0, -0.025, z),
        new BABYLON.Vector3(sizeX, -0.025, z),
      ]);
    }
    return lines;
  }

  _createVolumeOutline() {
    const mapData = this.getMapData();
    const lines = this._buildVolumeOutlineLines(mapData.sizeX, mapData.sizeY, mapData.sizeZ);
    this._createLineSystem('workspace_bounds', lines, new BABYLON.Color3(0.65, 0.72, 0.82));
  }

  _buildVolumeOutlineLines(sizeX, sizeY, sizeZ) {
    const corners = this._createVolumeCorners(sizeX, sizeY, sizeZ);
    return this._connectVolumeCorners(corners);
  }

  _createVolumeCorners(sizeX, sizeY, sizeZ) {
    const point = (x, y, z) => new BABYLON.Vector3(x, y, z);
    return {
      bottom: [point(0, 0, 0), point(sizeX, 0, 0), point(sizeX, 0, sizeZ), point(0, 0, sizeZ)],
      top: [point(0, sizeY, 0), point(sizeX, sizeY, 0), point(sizeX, sizeY, sizeZ), point(0, sizeY, sizeZ)],
    };
  }

  _connectVolumeCorners({ bottom, top }) {
    return [
      [bottom[0], bottom[1]], [bottom[1], bottom[2]],
      [bottom[2], bottom[3]], [bottom[3], bottom[0]],
      [top[0], top[1]], [top[1], top[2]],
      [top[2], top[3]], [top[3], top[0]],
      [bottom[0], top[0]], [bottom[1], top[1]],
      [bottom[2], top[2]], [bottom[3], top[3]],
    ];
  }

  _createCoordinateAxes() {
    this._createXAxis();
    this._createYAxis();
    this._createZAxis();
  }

  _createXAxis() {
    const mapData = this.getMapData();
    this._createAxis('axis_x', [0, 0, 0], [mapData.sizeX, 0, 0], new BABYLON.Color3(0.9, 0.3, 0.3));
  }

  _createYAxis() {
    const mapData = this.getMapData();
    this._createAxis('axis_y', [0, 0, 0], [0, mapData.sizeY, 0], new BABYLON.Color3(0.3, 0.85, 0.45));
  }

  _createZAxis() {
    const mapData = this.getMapData();
    this._createAxis('axis_z', [0, 0, 0], [0, 0, mapData.sizeZ], new BABYLON.Color3(0.3, 0.55, 0.95));
  }

  _createAxis(name, start, end, color) {
    const points = this._createAxisPoints(start, end);
    const axis = BABYLON.MeshBuilder.CreateLines(name, { points }, this.scene);
    this._registerWorkspaceHelper(axis, color);
  }

  _createAxisPoints(start, end) {
    return [
      new BABYLON.Vector3(start[0], start[1], start[2]),
      new BABYLON.Vector3(end[0], end[1], end[2]),
    ];
  }

  _setupLoopAndController(canvas) {
    this.cameraController = this._createCameraController(canvas);
    this._bindScenePointerEvents();
    this._startRenderLoop();
  }

  _createCameraController(canvas) {
    const controller = new CameraController3D(this.appManager, this.scene, canvas);
    controller.onInit();
    return controller;
  }

  _startRenderLoop() {
    this.engine.runRenderLoop(() => this._renderSceneFrame());
    this.isInitialized = true;
  }


  _bindScenePointerEvents() {
    if (!this.scene.onPointerObservable) return;
    this._pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
      this._handleScenePointerInfo(pointerInfo);
    });
  }

  _handleScenePointerInfo(pointerInfo) {
    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
      this._handleScenePointerDown(pointerInfo.event);
      return;
    }
    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
      this._handleScenePointerMove(pointerInfo.event);
      return;
    }
    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
      this._handleScenePointerUp(pointerInfo.event);
    }
  }

  _handleScenePointerDown(event) {
    if (event.button !== 0) return;
    const coordinates = this._resolvePickedVoxelCoordinates();
    if (!coordinates) return;
    this._toolPointerDown = true;
    this._dispatchActiveTool('onPointerDown', event, coordinates);
  }

  _handleScenePointerMove(event) {
    if (!this._toolPointerDown) return;
    const coordinates = this._resolvePickedVoxelCoordinates();
    if (!coordinates) return;
    this._dispatchActiveTool('onPointerMove', event, coordinates);
  }

  _handleScenePointerUp(event) {
    if (!this._toolPointerDown) return;
    this._toolPointerDown = false;
    this._dispatchActiveTool('onPointerUp', event, null);
  }

  _resolvePickedVoxelCoordinates() {
    const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
    if (!pick || !pick.hit || !pick.pickedPoint) return null;
    return this._convertPickToVoxelCoordinates(pick);
  }

  _convertPickToVoxelCoordinates(pick) {
    const point = pick.pickedPoint;
    const normal = typeof pick.getNormal === 'function' ? pick.getNormal(true) : null;
    const offset = 0.001;
    return {
      x: Math.floor(point.x - (normal?.x || 0) * offset),
      y: Math.floor(point.y - (normal?.y || 0) * offset),
      z: Math.floor(point.z - (normal?.z || 0) * offset),
    };
  }

  _dispatchActiveTool(methodName, event, coordinates) {
    const tool = this.appManager.toolsManager.activeTool;
    if (!tool || typeof tool[methodName] !== 'function') return;
    tool[methodName](event, coordinates);
  }

  _removeScenePointerEvents() {
    if (!this.scene || !this._pointerObserver) return;
    this.scene.onPointerObservable.remove(this._pointerObserver);
    this._pointerObserver = null;
    this._toolPointerDown = false;
  }

  _renderSceneFrame() {
    if (!this.scene || !this.active || this.appManager.paused) return;
    this.scene.render();
  }

  _updateCameraController(dt) {
    if (this.appManager.paused || !this.cameraController) return;
    if (typeof this.cameraController.update !== 'function') return;
    this.cameraController.update(dt);
  }

  renderFullMap3D(mapData3D) {
    if (!this.isInitialized || !mapData3D) return;
    this.clearAllChunks();
    this._iterateChunks(mapData3D);
  }

  renderFullMap(mapData3D) {
    this.renderFullMap3D(mapData3D);
  }

  _iterateChunks(mapData3D) {
    const size = mapData3D.chunkSize || 16;
    const limits = this._calculateChunkLimits(mapData3D, size);
    this._loopChunksZ(mapData3D, size, limits);
  }

  _calculateChunkLimits(mapData3D, size) {
    return {
      X: Math.ceil(mapData3D.sizeX / size),
      Y: Math.ceil(mapData3D.sizeY / size),
      Z: Math.ceil(mapData3D.sizeZ / size),
    };
  }

  _loopChunksZ(mapData3D, size, limits) {
    for (let cz = 0; cz < limits.Z; cz++) {
      this._loopChunksY(mapData3D, cz, size, limits);
    }
  }

  _loopChunksY(mapData3D, cz, size, limits) {
    for (let cy = 0; cy < limits.Y; cy++) {
      this._loopChunksX(mapData3D, cy, cz, size, limits);
    }
  }

  _loopChunksX(mapData3D, cy, cz, size, limits) {
    for (let cx = 0; cx < limits.X; cx++) {
      this.buildChunkMesh(mapData3D, cx, cy, cz, size);
    }
  }

  buildChunkMesh(mapData3D, chunkX, chunkY, chunkZ, chunkSize = mapData3D.chunkSize || 16) {
    const buffers = this._createGeometryBuffers();
    const bounds = this._calculateChunkBounds(chunkX, chunkY, chunkZ, chunkSize, mapData3D);
    this._processVoxelVolume(mapData3D, bounds, buffers);
    this._uploadChunkGeometry(buffers, chunkX, chunkY, chunkZ);
  }

  rebuildChunk(mapData3D, chunkX, chunkY, chunkZ) {
    if (!this.isInitialized || !mapData3D) return;
    this._disposeChunkByKey(this._getChunkKey(chunkX, chunkY, chunkZ));
    this.buildChunkMesh(mapData3D, chunkX, chunkY, chunkZ, mapData3D.chunkSize || 16);
  }

  _createGeometryBuffers() {
    return { positions: [], indices: [], normals: [], colors: [], vertexCount: 0 };
  }

  _calculateChunkBounds(cx, cy, cz, size, mapData) {
    return {
      minX: cx * size, maxX: Math.min(cx * size + size, mapData.sizeX),
      minY: cy * size, maxY: Math.min(cy * size + size, mapData.sizeY),
      minZ: cz * size, maxZ: Math.min(cz * size + size, mapData.sizeZ),
    };
  }

  _processVoxelVolume(mapData3D, bounds, buffers) {
    for (let z = bounds.minZ; z < bounds.maxZ; z++) {
      this._processVoxelPlaneY(mapData3D, z, bounds, buffers);
    }
  }

  _processVoxelPlaneY(mapData3D, z, bounds, buffers) {
    for (let y = bounds.minY; y < bounds.maxY; y++) {
      this._processVoxelRowX(mapData3D, y, z, bounds, buffers);
    }
  }

  _processVoxelRowX(mapData3D, y, z, bounds, buffers) {
    for (let x = bounds.minX; x < bounds.maxX; x++) {
      this._evaluateVoxelGeometry(mapData3D, x, y, z, buffers);
    }
  }

  _evaluateVoxelGeometry(mapData3D, x, y, z, buffers) {
    const type = getVoxel3D(mapData3D, x, y, z);
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
    if (nx < 0 || nx >= mapData3D.sizeX || ny < 0 || ny >= mapData3D.sizeY || nz < 0 || nz >= mapData3D.sizeZ) {
      return true;
    }
    return getVoxel3D(mapData3D, nx, ny, nz) === 0;
  }

  _buildFaceVertices(x, y, z, type, face, buffers) {
    const color = this._getMaterialColor(type);
    for (const vertex of face.vertices) {
      this._appendFaceVertex(x, y, z, vertex, face.norm, color, buffers);
    }
    this._buildFaceIndices(buffers);
  }

  _appendFaceVertex(x, y, z, vertex, normal, color, buffers) {
    buffers.positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);
    buffers.normals.push(normal[0], normal[1], normal[2]);
    buffers.colors.push(color.r, color.g, color.b, 1.0);
  }

  _buildFaceIndices(buffers) {
    buffers.indices.push(
      buffers.vertexCount, buffers.vertexCount + 1, buffers.vertexCount + 2,
      buffers.vertexCount, buffers.vertexCount + 2, buffers.vertexCount + 3,
    );
    buffers.vertexCount += 4;
  }

  _uploadChunkGeometry(buffers, cx, cy, cz) {
    if (buffers.positions.length === 0) return;
    const key = this._getChunkKey(cx, cy, cz);
    this._createChunkMesh(buffers, key);
  }

  _createChunkMesh(buffers, key) {
    const mesh = new BABYLON.Mesh(`chunk_${key}`, this.scene);
    this._applyVertexBuffers(mesh, buffers);
    this._applyChunkMaterial(mesh, key);
  }

  _getChunkKey(cx, cy, cz) {
    return `${cx}_${cy}_${cz}`;
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
    const material = new BABYLON.StandardMaterial(`mat_${key}`, this.scene);
    material.backFaceCulling = true;
    material.useVertexColors = true;
    material.disableLighting = true;
    mesh.material = material;
    this.chunks.set(key, mesh);
  }

  _getMaterialColor(type) {
    if (type === 1) return { r: 0.88, g: 0.75, b: 0.42 };
    if (type === 2) return { r: 0.55, g: 0.35, b: 0.17 };
    if (type === 3) return { r: 0.5, g: 0.55, b: 0.56 };
    if (type === 4) return { r: 0.22, g: 0.48, b: 0.84 };
    return { r: 1, g: 1, b: 1 };
  }

  clearAllChunks() {
    for (const [key, mesh] of this.chunks.entries()) {
      this._disposeMesh(mesh);
    }
    this.chunks.clear();
  }

  _disposeChunkByKey(key) {
    const mesh = this.chunks.get(key);
    if (!mesh) return;
    this._disposeMesh(mesh);
    this.chunks.delete(key);
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
    this._disposeRenderResources();
  }

  _disposeRenderResources() {
    this.clearAllChunks();
    this._disposeWorkspaceHelpers();
    this._clearGraphicsEngine();
  }

  _disposeWorkspaceHelpers() {
    for (const helper of this.workspaceHelpers) {
      helper.dispose();
    }
    this.workspaceHelpers = [];
  }

  _clearGraphicsEngine() {
    this._removeScenePointerEvents();
    this._disposeInteractiveResources();
    if (!this.engine) return;
    this._disposeEngine();
  }

  _disposeInteractiveResources() {
    this.disposeGizmo();
    this._disposeCameraController();
  }

  _disposeEngine() {
    this.engine.dispose();
    this.engine = null;
    this._resetEngineState();
  }

  _resetEngineState() {
    this.scene = null;
    this.isInitialized = false;
  }

  _disposeCameraController() {
    if (!this.cameraController) return;
    this.cameraController.onDestroy();
    this.cameraController = null;
  }

  // =========================================================================
  // SOPORTE DE GIZMOS 3D INTERACTIVOS (S1-33)
  // =========================================================================

  /** Inicializa o devuelve la instancia de GizmoManager solo cuando se necesita. */
  getGizmoManager() {
    if (this.gizmoManager) return this.gizmoManager;
    if (!this.scene || !BABYLON.GizmoManager) return null;
    return this._createGizmoManager();
  }

  _createGizmoManager() {
    this.gizmoManager = new BABYLON.GizmoManager(this.scene);
    this._configureGizmoManager(this.gizmoManager);
    return this.gizmoManager;
  }

  _configureGizmoManager(manager) {
    this._setGizmoMode(manager, 'position');
    manager.usePointerToAttachGizmos = false;
  }

  /** Acopla las herramientas de transformación a una malla de la escena. */
  attachGizmo(mesh, mode = 'position') {
    if (!mesh) return;
    const manager = this.getGizmoManager();
    if (!manager) return;
    this._attachMeshToGizmo(manager, mesh, mode);
  }

  _attachMeshToGizmo(manager, mesh, mode) {
    this._setGizmoMode(manager, mode);
    manager.attachToMesh(mesh);
  }

  _setGizmoMode(manager, mode) {
    manager.positionGizmoEnabled = mode === 'position';
    manager.rotationGizmoEnabled = mode === 'rotation';
    manager.scaleGizmoEnabled = mode === 'scale';
  }

  /** Oculta y retira los gizmos activos. */
  detachGizmo() {
    if (!this.gizmoManager) return;
    this.gizmoManager.attachToMesh(null);
  }

  /** Libera el GizmoManager antes de destruir la escena. */
  disposeGizmo() {
    if (!this.gizmoManager) return;
    this.gizmoManager.dispose();
    this.gizmoManager = null;
  }
}
