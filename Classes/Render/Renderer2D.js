/**
 * Renderer2D.js
 * Sistema de renderizado 2D basado en Pixi.js.
 * Hereda de AppObject y responde al ciclo de vida del AppManager.
 */
class Renderer2D extends AppObject {
  constructor(appManager) {
    super(appManager);

    // Instancia de la aplicación Pixi.js
    this.pixiApp = null;

    // Contenedor del mundo (acá se dibuja el mapa y la cámara lo mueve/zoomea)
    this.worldContainer = null;

    // Marco del lienzo (fondo + borde) para ver los límites del área de trabajo aunque esté vacía
    this.frameGraphics = null;

    // Objeto gráfico de Pixi donde se dibujan las celdas
    this.terrainGraphics = null;

    // Control de la carrera entre onInit (async) y onDestroy
    this._ready = false;
    this._destroyed = false;
  }

  /**
   * Se ejecuta al registrar e inicializar el renderizador.
   */
  async onInit() {
    if (!(await this._initializePixiApp())) return;
    this._mountWorkspace();
    this._restoreMapView();
  }

  async _initializePixiApp() {
    this.pixiApp = new PIXI.Application();
    await this.pixiApp.init(this._createPixiConfiguration());
    if (this._destroyed) {
      this._destroyInitializingApp();
      return false;
    }
    return true;
  }

  _createPixiConfiguration() {
    return {
      resizeTo: window,
      backgroundColor: 0x1a1a1a,
      antialias: false,
    };
  }

  _destroyInitializingApp() {
    if (!this.pixiApp) return;
    this.pixiApp.destroy(true, { children: true });
    this.pixiApp = null;
  }

  _mountWorkspace() {
    this._ready = true;
    document.body.appendChild(this.pixiApp.canvas);
    this._createWorldLayers();
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

  /** Dibuja el fondo y el borde del área de trabajo. */
  _drawCanvasFrame(mapData2D) {
    this._drawFrameGraphics(this._getCanvasDimensions(mapData2D));
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

  /**
   * Escala (solo para achicar) y centra el lienzo en la ventana, así se ve completo en PC y celular.
   * Provisorio: cuando exista CameraController2D (paneo/zoom), él toma el control de esta transformación.
   */
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

  /** Llamado por AppManager.onResize() cuando cambia el tamaño de la ventana. */
  onResize() {
    this._fitWorld();
  }

  /**
   * Dibuja todo el mapa 2D celda por celda.
   * @param {object} mapData2D - Estructura creada por createMapData2D
   */
  renderFullMap(mapData2D) {
    if (!this.terrainGraphics || !mapData2D) return;
    this._renderMapData(mapData2D);
  }

  _renderMapData(mapData2D) {
    const renderData = this._prepareMapRenderData(mapData2D);
    this.terrainGraphics.clear();
    this._drawMapRows(mapData2D, renderData.cellSize, renderData.materialColorMap);
  }

  _prepareMapRenderData(mapData2D) {
    return {
      cellSize: mapData2D.cellSize || 16,
      materialColorMap: this._createMaterialColorMap(mapData2D.materials),
    };
  }

  _createMaterialColorMap(materials) {
    const colorMap = new Map();
    for (const material of materials) {
      colorMap.set(material.id, parseInt(material.color.replace('#', ''), 16));
    }
    return colorMap;
  }

  _drawMapRows(mapData2D, cellSize, materialColorMap) {
    for (let y = 0; y < mapData2D.height; y++) {
      this._drawMapRow(mapData2D, y, cellSize, materialColorMap);
    }
  }

  _drawMapRow(mapData2D, y, cellSize, materialColorMap) {
    for (let x = 0; x < mapData2D.width; x++) {
      this._drawMapCell(mapData2D, x, y, cellSize, materialColorMap);
    }
  }

  _drawMapCell(mapData2D, x, y, cellSize, materialColorMap) {
    const materialId = getCell2D(mapData2D, x, y);
    if (materialId === 0) return;
    const color = materialColorMap.get(materialId) || 0xffffff;
    this._drawSolidCell(x, y, cellSize, color);
  }

  _drawSolidCell(x, y, cellSize, color) {
    this.terrainGraphics.rect(x * cellSize, y * cellSize, cellSize, cellSize);
    this.terrainGraphics.fill(color);
  }

  /**
   * Ciclo por fotograma (Tick).
   * @param {number} dt Delta time
   */
  onUpdate(dt) {
    // Acá se pueden animar partículas o efectos de agua más adelante
  }

  /**
   * Limpieza al desmontar el modo 2D.
   */
  onDestroy() {
    this._destroyed = true;
    // Si Pixi todavía se está inicializando, onInit se encarga de destruirlo al terminar
    if (this._ready && this.pixiApp) {
      this.pixiApp.destroy(true, { children: true });
      this.pixiApp = null;
    }
  }
}