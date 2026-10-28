/**
 * Renderer2D.js
 * Sistema de renderizado 2D basado en Pixi.js.
 * Automatizado en micro-subtareas planas para evitar control de flujo anidado.
 */
class Renderer2D extends AppObject {
  constructor(appManager) {
    super(appManager);
    this.pixiApp = null;
    this.worldContainer = null;
    this.frameGraphics = null;
    this.terrainGraphics = null;
    this._ready = false;
    this._destroyed = false;
  }

  /**
   * Inicializa de manera secuencial los componentes del viewport.
   */
  async onInit() {
    const success = await this._initializePixiApp();
    if (!success) return;
    this._mountWorkspace();
    this._restoreMapView();
  }

  async _initializePixiApp() {
    this.pixiApp = new PIXI.Application();
    await this.pixiApp.init(this._createPixiConfiguration());
    return this._validateAppLifecycle();
  }

  _createPixiConfiguration() {
    return {
      resizeTo: document.getElementById("canvasContainer2D") || window,
      backgroundColor: 0x1a1a1a,
      antialias: false,
    };
  }

  _validateAppLifecycle() {
    if (!this._destroyed) return true;
    this._destroyInitializingApp();
    return false;
  }

  _destroyInitializingApp() {
    this.pixiApp.destroy(true, { children: true });
    this.pixiApp = null;
  }

  _mountWorkspace() {
    this._ready = true;
    this._attachCanvasToDOM();
    this._createWorldLayers();
  }

  _attachCanvasToDOM() {
    const container = document.getElementById("canvasContainer2D");
    const target = container || document.body;
    target.appendChild(this.pixiApp.canvas);
  }

  _createWorldLayers() {
    this._createWorldContainer();
    this._createFrameGraphics();
    this._createTerrainGraphics();
  }

  _createWorldContainer() {
    this.worldContainer = new PIXI.Container();
    this.pixiApp.stage.addChild(this.worldContainer);
  }

  _createFrameGraphics() {
    this.frameGraphics = new PIXI.Graphics();
    this.worldContainer.addChild(this.frameGraphics);
  }

  _createTerrainGraphics() {
    this.terrainGraphics = new PIXI.Graphics();
    this.worldContainer.addChild(this.terrainGraphics);
  }

  _restoreMapView() {
    const mapData = this.appManager.mapData;
    if (!mapData) return;
    this._drawRestoredMap(mapData);
  }

  _drawRestoredMap(mapData) {
    this._drawCanvasFrame(mapData);
    this.renderFullMap(mapData);
    this._fitWorld();
  }

  _drawCanvasFrame(mapData2D) {
    const dimensions = this._getCanvasDimensions(mapData2D);
    this._drawFrameGraphics(dimensions);
  }

  _getCanvasDimensions(mapData2D) {
    const cellSize = mapData2D.cellSize || 16;
    return {
      cellSize,
      width: mapData2D.width * cellSize,
      height: mapData2D.height * cellSize,
    };
  }

  _drawFrameGraphics({ width, height }) {
    this.frameGraphics.clear();
    this.frameGraphics.rect(0, 0, width, height).fill(0x242424);
    this.frameGraphics.rect(0, 0, width, height).stroke({ width: 2, color: 0x5a5a5a, alignment: 1 });
  }

  onResize() {
    this._fitWorld();
  }

  _fitWorld() {
    const context = this._getWorldFitContext();
    if (!context) return;
    this._applyWorldFit(context);
  }

  _getWorldFitContext() {
    const mapData2D = this.appManager.mapData;
    if (!mapData2D || !this.worldContainer) return null;
    return this._createWorldFitContext(mapData2D);
  }

  _createWorldFitContext(mapData2D) {
    const dimensions = this._getCanvasDimensions(mapData2D);
    return { ...dimensions, scale: this._calculateWorldScale(dimensions) };
  }

  _calculateWorldScale({ width, height }) {
    const margin = 80;
    return Math.min(1, (window.innerWidth - margin) / width, (window.innerHeight - margin) / height);
  }

  _applyWorldFit({ width, height, scale }) {
    this.worldContainer.scale.set(scale);
    this.worldContainer.position.set(
      (window.innerWidth - width * scale) / 2,
      (window.innerHeight - height * scale) / 2
    );
  }

  /**
   * Entrada de renderizado: Prepara datos y limpia el búfer gráfico.
   */
  renderFullMap(mapData2D) {
    if (!this.terrainGraphics || !mapData2D) return;
    this.terrainGraphics.clear();
    this._processMapRendering(mapData2D);
  }

  _processMapRendering(mapData2D) {
    const cellSize = mapData2D.cellSize || 16;
    const colorMap = this._createMaterialColorMap(mapData2D.materials);
    this._drawMapRows(mapData2D, cellSize, colorMap);
  }

  _createMaterialColorMap(materials) {
    const colorMap = new Map();
    for (const material of materials) {
      colorMap.set(material.id, parseInt(material.color.replace('#', ''), 16));
    }
    return colorMap;
  }

  /**
   * Itera filas eliminando bucles anidados directos en un único método.
   */
  _drawMapRows(mapData2D, cellSize, colorMap) {
    for (let y = 0; y < mapData2D.height; y++) {
      this._drawMapRow(mapData2D, y, cellSize, colorMap);
    }
  }

  _drawMapRow(mapData2D, y, cellSize, colorMap) {
    for (let x = 0; x < mapData2D.width; x++) {
      this._drawMapCell(mapData2D, x, y, cellSize, colorMap);
    }
  }

  _drawMapCell(mapData2D, x, y, cellSize, colorMap) {
    const materialId = this._resolveCellMaterial(mapData2D, x, y);
    if (materialId === 0) return;
    const color = colorMap.get(materialId) || 0xffffff;
    this._drawSolidCell(x, y, cellSize, color);
  }

  _resolveCellMaterial(mapData2D, x, y) {
    if (typeof getCell2D === "function") {
      return getCell2D(mapData2D, x, y);
    }
    return mapData2D.data[y * mapData2D.width + x];
  }

  _drawSolidCell(x, y, cellSize, color) {
    this.terrainGraphics.rect(x * cellSize, y * cellSize, cellSize, cellSize);
    this.terrainGraphics.fill(color);
  }

  onUpdate(dt) {
    if (this.appManager.paused) return;
  }

  onDestroy() {
    this._destroyed = true;
    this._clearWorkspaceResources();
  }

  _clearWorkspaceResources() {
    if (!this._ready || !this.pixiApp) return;
    this._removeCanvasFromDOM();
    this.pixiApp.destroy(true, { children: true });
    this.pixiApp = null;
  }

  _removeCanvasFromDOM() {
    if (!this.pixiApp.canvas || !this.pixiApp.canvas.parentNode) return;
    this.pixiApp.canvas.parentNode.removeChild(this.pixiApp.canvas);
  }
}