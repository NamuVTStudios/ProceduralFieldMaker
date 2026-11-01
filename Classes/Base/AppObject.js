/**
 * AppObject.js
 * Clase base para objetos administrados por AppManager.
 * Proporciona ciclo de vida, acceso al contexto y utilidades compartidas.
 */
class AppObject {
  constructor(appManager) {
    if (!appManager) throw new Error('AppObject requiere una instancia de AppManager.');
    this.appManager = appManager;
    this.active = true;
    this.destroyed = false;
  }

  // ---------------------------------------------------------------------
  // Contrato de ciclo de vida
  // ---------------------------------------------------------------------

  onInit() {}

  onUpdate(dt) {}

  onDestroy() {}

  isActive() {
    return this.active && !this.destroyed;
  }

  setActiveState(isActive) {
    if (this.destroyed) return false;
    this.active = Boolean(isActive);
    return this.active;
  }

  activate() {
    return this.setActiveState(true);
  }

  deactivate() {
    return this.setActiveState(false);
  }

  toggleActiveState() {
    return this.setActiveState(!this.active);
  }

  /** Destrucción segura; AppManager centraliza onDestroy y el desregistro. */
  selfDestroy() {
    return this.unregisterSelf();
  }

  destroy() {
    return this.selfDestroy();
  }

  unregisterSelf() {
    if (this.destroyed) return false;
    return this.appManager.unregister(this);
  }

  /** @internal Invocado exclusivamente por AppManager.unregister(). */
  _destroyFromManager() {
    if (this.destroyed) return false;
    this.destroyed = true;
    this.active = false;
    this.onDestroy();
    return true;
  }

  // ---------------------------------------------------------------------
  // Acceso genérico al contexto de la aplicación
  // ---------------------------------------------------------------------

  getAppManager() {
    return this.appManager;
  }

  getMapData() {
    return this.appManager.mapData;
  }

  hasMapData() {
    return Boolean(this.getMapData());
  }

  getProjectMode() {
    return this.appManager.mode;
  }

  isProjectMode(mode) {
    return this.getProjectMode() === mode;
  }

  isProjectMode2D() {
    return this.isProjectMode('2d');
  }

  isProjectMode3D() {
    return this.isProjectMode('3d');
  }

  hasProject() {
    return this.appManager.hasProject();
  }

  // ---------------------------------------------------------------------
  // Acceso genérico a servicios y objetos registrados
  // ---------------------------------------------------------------------

  getModificationEngine() {
    return this.appManager.destructionEngine;
  }

  getActiveRenderer() {
    return this.appManager.renderer;
  }

  getToolsManager() {
    return this.appManager.toolsManager;
  }

  getWindowsManager() {
    return this.appManager.windowsManager;
  }

  getMapLayerManager() {
    return this.appManager.mapLayerManager;
  }

  getRegisteredObjects() {
    return this.appManager.objects.slice();
  }

  findAppObject(predicate) {
    if (typeof predicate !== 'function') return null;
    return this.appManager.objects.find(predicate) ?? null;
  }

  findAppObjects(predicate) {
    if (typeof predicate !== 'function') return [];
    return this.appManager.objects.filter(predicate);
  }

  registerAppObject(appObject) {
    return this.appManager.register(appObject);
  }

  unregisterAppObject(appObject) {
    return this.appManager.unregister(appObject);
  }

  // ---------------------------------------------------------------------
  // Notificaciones genéricas al renderer activo
  // ---------------------------------------------------------------------

  requestFullRender() {
    const context = this._getFullRenderContext();
    if (!context) return false;
    return this._invokeFullRender(context);
  }

  _getFullRenderContext() {
    const renderer = this.getActiveRenderer();
    const mapData = this.getMapData();
    if (!renderer || !mapData) return null;
    return { renderer, mapData };
  }

  _invokeFullRender({ renderer, mapData }) {
    const methodName = this._resolveFullRenderMethod(renderer);
    if (!methodName) return false;
    renderer[methodName](mapData);
    return true;
  }

  _resolveFullRenderMethod(renderer) {
    if (typeof renderer.renderFullMap === 'function') return 'renderFullMap';
    if (typeof renderer.renderFullMap3D === 'function') return 'renderFullMap3D';
    return null;
  }

  requestChunkRebuild(chunkX, chunkY, chunkZ) {
    const context = this._getChunkRenderContext();
    if (!context) return false;
    context.renderer.rebuildChunk(context.mapData, chunkX, chunkY, chunkZ);
    return true;
  }

  _getChunkRenderContext() {
    if (!this.isProjectMode3D()) return null;
    const renderer = this.getActiveRenderer();
    const mapData = this.getMapData();
    if (!renderer || !mapData || typeof renderer.rebuildChunk !== 'function') return null;
    return { renderer, mapData };
  }
}
