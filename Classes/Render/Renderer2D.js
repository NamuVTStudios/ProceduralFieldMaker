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

    // Objeto gráfico de Pixi donde se dibujan las celdas
    this.terrainGraphics = null;
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

    // Agregar el canvas generado por Pixi al DOM (al body del documento)
    document.body.appendChild(this.pixiApp.canvas);

    // 2. Crear el contenedor del mundo
    this.worldContainer = new PIXI.Container();
    this.pixiApp.stage.addChild(this.worldContainer);

    // 3. Crear el objeto gráfico para las celdas sólidas
    this.terrainGraphics = new PIXI.Graphics();
    this.worldContainer.addChild(this.terrainGraphics);

    // 4. Si el AppManager ya tiene un mapa 2D cargado, dibujarlo
    if (this.appManager.mapData) {
      this.renderFullMap(this.appManager.mapData);
    }
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
    if (this.pixiApp) {
      this.pixiApp.destroy(true, { children: true });
      this.pixiApp = null;
    }
  }
}