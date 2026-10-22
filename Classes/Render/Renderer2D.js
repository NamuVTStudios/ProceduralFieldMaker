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
    // 1. Inicializar la app de Pixi.js ocupando la ventana o el contenedor principal
    this.pixiApp = new PIXI.Application();

    await this.pixiApp.init({
      resizeTo: window,
      backgroundColor: 0x1a1a1a, // Fondo oscuro estilo editor
      antialias: false,          // Pixeles nítidos
    });

    // Si el lienzo se cerró mientras Pixi se inicializaba, limpiar y salir
    if (this._destroyed) {
      this.pixiApp.destroy(true, { children: true });
      this.pixiApp = null;
      return;
    }
    this._ready = true;

    // Agregar el canvas generado por Pixi al DOM (al body del documento)
    document.body.appendChild(this.pixiApp.canvas);

    // 2. Crear el contenedor del mundo
    this.worldContainer = new PIXI.Container();
    this.pixiApp.stage.addChild(this.worldContainer);

    // 3. Marco del lienzo (se dibuja debajo del terreno) y objeto gráfico para las celdas sólidas
    this.frameGraphics = new PIXI.Graphics();
    this.worldContainer.addChild(this.frameGraphics);
    this.terrainGraphics = new PIXI.Graphics();
    this.worldContainer.addChild(this.terrainGraphics);

    // 4. Si el AppManager ya tiene un mapa 2D cargado, dibujarlo y encuadrarlo en pantalla
    if (this.appManager.mapData) {
      this._drawCanvasFrame(this.appManager.mapData);
      this.renderFullMap(this.appManager.mapData);
      this._fitWorld();
    }
  }

  /** Dibuja el fondo y el borde del área de trabajo. */
  _drawCanvasFrame(mapData2D) {
    const cellSize = mapData2D.cellSize || 16;
    const width = mapData2D.width * cellSize;
    const height = mapData2D.height * cellSize;

    this.frameGraphics.clear();
    this.frameGraphics.rect(0, 0, width, height).fill(0x242424);
    this.frameGraphics.rect(0, 0, width, height).stroke({ width: 2, color: 0x5a5a5a, alignment: 1 });
  }

  /**
   * Escala (solo para achicar) y centra el lienzo en la ventana, así se ve completo en PC y celular.
   * Provisorio: cuando exista CameraController2D (paneo/zoom), él toma el control de esta transformación.
   */
  _fitWorld() {
    const mapData2D = this.appManager.mapData;
    if (!mapData2D || !this.worldContainer) return;

    const cellSize = mapData2D.cellSize || 16;
    const width = mapData2D.width * cellSize;
    const height = mapData2D.height * cellSize;
    const margin = 80;

    const scale = Math.min(1, (window.innerWidth - margin) / width, (window.innerHeight - margin) / height);
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

    this.terrainGraphics.clear();

    const cellSize = mapData2D.cellSize || 16;

    // Mapa rápido de materiales por ID para no buscarlos en cada celda
    const materialColorMap = new Map();
    for (const mat of mapData2D.materials) {
      // Convierte string hex '#2ecc71' a entero 0x2ecc71 para Pixi
      const hexNum = parseInt(mat.color.replace('#', ''), 16);
      materialColorMap.set(mat.id, hexNum);
    }

    // Recorremos todo el mapa celda por celda
    for (let y = 0; y < mapData2D.height; y++) {
      for (let x = 0; x < mapData2D.width; x++) {
        // Leemos el byte de esta celda usando la función de tu compañero
        const materialId = getCell2D(mapData2D, x, y);

        // Si es aire (0), no dibujamos nada
        if (materialId === 0) continue;

        const color = materialColorMap.get(materialId) || 0xffffff;

        // Dibujamos el cuadradito
        this.terrainGraphics.rect(
          x * cellSize,
          y * cellSize,
          cellSize,
          cellSize
        );
        this.terrainGraphics.fill(color);
      }
    }
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