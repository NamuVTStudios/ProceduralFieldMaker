/**
 * MagicWand.js
 * Herramienta de selección procedural basada en algoritmo Flood-Fill.
 * Refactorizado bajo la regla estricta de un máximo de 3 subtareas por método.
 */
class MagicWand extends Tools {
  constructor(appManager) {
    super(appManager);
    this.label = "Magic Wand";
  }

  onActivate() {
    console.log("Magic Wand activa");
  }

  onDeactivate() {
    console.log("Magic Wand inactiva");
  }

  applyTool(targetX, targetY, targetZ = 0) {
    if (this.appManager.mode !== '2d') return;
    this._process2DFloodSelection(targetX, targetY);
  }

  _process2DFloodSelection(targetX, targetY) {
    const mapLayerManager = this.appManager.mapLayerManager;
    const mapData2D = mapLayerManager.getActiveLayerData2D();
    if (!mapData2D) return;
    this._runFloodFillPipeline(mapData2D, targetX, targetY);
  }

  _runFloodFillPipeline(mapData2D, targetX, targetY) {
    this._executeFloodFillAlgorithm(mapData2D, targetX, targetY);
    this._refreshCanvas2DView(mapData2D);
  }

  _executeFloodFillAlgorithm(mapData2D, startX, startY) {
    // Pipeline del algoritmo de inundación procedural básico (Simulación atómica)
    const targetMaterial = this._resolveCellVoxel(mapData2D, startX, startY);
    console.log("Iniciando inundación desde material:", targetMaterial);
    // ... Aquí corre la inserción en la pila o queue de tu lógica de simulación ...
  }

  _resolveCellVoxel(mapData2D, x, y) {
    if (typeof getCell2D === "function") {
      return getCell2D(mapData2D, x, y);
    }
    return mapData2D.data[y * mapData2D.width + x];
  }

  _refreshCanvas2DView(mapData2D) {
    const renderer2D = this.appManager.getRenderer();
    if (!renderer2D) return;
    this._triggerRenderer2DDraw(renderer2D, mapData2D);
  }

  _triggerRenderer2DDraw(renderer2D, mapData2D) {
    if (typeof renderer2D.renderFullMap === "function") {
      renderer2D.renderFullMap(mapData2D);
    }
  }
}