/**
 * AppObject.js
 * Componente base estructural y contractual del ciclo de vida de la aplicación.
 * Refactorizado bajo la regla estricta de un máximo de 3 subtareas por método.
 */
class AppObject {
  /**
   * @param {object} appManager Referencia única al orquestador central.
   */
  constructor(appManager) {
    this.appManager = appManager;
    this.active = true;
  }
  
  /** Ganchos virtuales del ciclo de vida de la infraestructura */
  onInit() {}
  
  onUpdate(dt) {}
  
  onDestroy() {}

  // ---------------------------------------------------------------------
  // Métodos Generales de Control de Estado Estructural
  // ---------------------------------------------------------------------

  /** Modifica de forma segura la bandera de activación lúdica. */
  setActiveState(isActive) {
    this.active = isActive;
  }

  /** Invoca una auto-destrucción y des-registro seguro desde el gestor central. */
  selfDestroy() {
    this._triggerDestructionLifecycle();
    this._unregisterFromAppManager();
  }

  /** @private */
  _triggerDestructionLifecycle() {
    this.onDestroy();
  }

  /** @private */
  _unregisterFromAppManager() {
    this.appManager.unregister(this);
  }

  // ---------------------------------------------------------------------
  // Métodos Generales de Atajos de Consulta de Datos (MapData)
  // ---------------------------------------------------------------------

  /** Retorna el búfer de datos lógicos asignado al proyecto activo. */
  getMapData() {
    return this.appManager.mapData;
  }

  /** Determina de forma atómica si el entorno del buffer opera bajo topología 3D. */
  isProjectMode3D() {
    return this.appManager.mode === '3d';
  }

  /** Retorna el identificador del modo dimensional activo ('2d' o '3d'). */
  getProjectMode() {
    return this.appManager.mode;
  }

  // ---------------------------------------------------------------------
  // Métodos Generales de Acceso al Ecosistema de Sub-motores
  // ---------------------------------------------------------------------

  /** Retorna la referencia activa al motor de deformación y escultura litológica. */
  getModificationEngine() {
    return this.appManager.destructionEngine;
  }

  /** Retorna la instancia del motor gráfico (Renderer2D o Renderer3D) en ejecución. */
  getActiveRenderer() {
    return this.appManager.renderer;
  }

  /** Retorna el gestor de herramientas procedurales centralizado. */
  getToolsManager() {
    return this.appManager.toolsManager;
  }

  /** Retorna el gestor de ventanas de la interfaz gráfica. */
  getWindowsManager() {
    return this.appManager.windowsManager;
  }
}