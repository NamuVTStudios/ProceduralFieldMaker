/** Centraliza el registro, activación y despacho de herramientas. */
class ToolsManager {
  constructor(appManager) {
    this.appManager = appManager;
    this.tools = [];
    this.activeTool = null;
  }

  register(tool) {
    this._assertTool(tool);
    return this._registerIfNeeded(tool);
  }

  _registerIfNeeded(tool) {
    if (this.tools.includes(tool)) return tool;
    this._registerTool(tool);
    this._activateInitialTool(tool);
    return tool;
  }

  _assertTool(tool) {
    const isValid = tool && this._hasPointerContract(tool);
    if (!isValid) throw new TypeError('ToolsManager requiere una herramienta compatible con Pointer Events.');
  }

  _hasPointerContract(tool) {
    return ['onPointerDown', 'onPointerMove', 'onPointerUp'].every(method => typeof tool[method] === 'function');
  }

  _registerTool(tool) {
    this.tools.push(tool);
    this.appManager.register(tool);
  }

  _activateInitialTool(tool) {
    if (!this.activeTool) return this.setActive(tool, false);
    tool.deactivate();
  }

  setActive(tool, openSettings = true) {
    if (!this.tools.includes(tool)) return false;
    this._applyActiveToolChange(tool);
    this._notifyWindowsManager(tool, openSettings);
    return true;
  }

  _applyActiveToolChange(tool) {
    if (this.activeTool === tool) return;
    this._deactivateCurrentTool(tool);
    this.activeTool = tool;
    this._activateTool(tool);
  }

  _deactivateCurrentTool(nextTool) {
    const current = this.activeTool;
    if (!current || current === nextTool) return;
    current.deactivate();
    current.onDeactivate();
  }

  _activateTool(tool) {
    tool.activate();
    tool.onActivate();
  }

  _notifyWindowsManager(tool, openSettings) {
    const manager = this.appManager.windowsManager;
    if (!manager) return;
    if (!openSettings) return manager.closeAll();
    manager.openForTool(tool);
  }

  showActiveToolSettings() {
    if (!this.activeTool || !this.appManager.windowsManager) return false;
    return this.appManager.windowsManager.openForTool(this.activeTool);
  }

  setActiveByName(name, openSettings = true) {
    const tool = this.getTool(name);
    return tool ? this.setActive(tool, openSettings) : false;
  }

  dispatchPointer(methodName, event, coordinates) {
    if (!this._isPointerMethod(methodName)) return false;
    const tool = this._getDispatchableTool();
    if (!tool) return false;
    tool[methodName](event, coordinates);
    return true;
  }

  _getDispatchableTool() {
    if (!this.activeTool || !this.activeTool.isActive()) return null;
    return this.activeTool;
  }

  _isPointerMethod(methodName) {
    return ['onPointerDown', 'onPointerMove', 'onPointerUp'].includes(methodName);
  }

  getActiveTool() {
    return this.activeTool;
  }

  getTool(name) {
    return this.tools.find(tool => tool.name === name) ?? null;
  }

  getTools() {
    return this.tools.slice();
  }

  clear() {
    this.appManager.windowsManager?.closeAll();
    this.tools = [];
    this.activeTool = null;
  }
}
