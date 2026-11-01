/** Administra el registro y la ventana de configuración visible. */
class WindowsManager {
  constructor(appManager) {
    this.appManager = appManager;
    this.windows = [];
    this.activeWindow = null;
    this.toolWindows = new Map();
    this.container = null;
  }

  register(windowObj, tool = null) {
    this._assertWindow(windowObj);
    return this._registerIfNeeded(windowObj, tool);
  }

  _registerIfNeeded(windowObj, tool) {
    if (this.windows.includes(windowObj)) return windowObj;
    this._registerWindow(windowObj);
    this._configureWindowBinding(windowObj, tool);
    return windowObj;
  }

  _assertWindow(windowObj) {
    if (!windowObj) throw new TypeError('WindowsManager requiere una ventana válida.');
  }

  _registerWindow(windowObj) {
    windowObj.close();
    this.windows.push(windowObj);
    this.appManager.register(windowObj);
  }

  _configureWindowBinding(windowObj, tool) {
    if (tool) this.bindToolWindow(tool, windowObj);
    if (this.container) windowObj.mount(this.container);
  }

  bindToolWindow(tool, windowObj) {
    if (!tool || !windowObj) return false;
    this.toolWindows.set(tool, windowObj);
    return true;
  }

  mountAll(container) {
    this.container = container;
    for (const windowObj of this.windows) windowObj.mount(container);
    return this.windows.length;
  }

  openForTool(tool) {
    const windowObj = this.toolWindows.get(tool);
    if (!windowObj) return this.closeAll();
    return this.open(windowObj);
  }

  open(windowObj) {
    if (!this.windows.includes(windowObj)) this.register(windowObj);
    this._activateWindow(windowObj);
    return true;
  }

  _activateWindow(windowObj) {
    this._closeOtherWindows(windowObj);
    this.activeWindow = windowObj;
    windowObj.open();
  }

  _closeOtherWindows(activeWindow) {
    const inactiveWindows = this.windows.filter(windowObj => windowObj !== activeWindow);
    for (const windowObj of inactiveWindows) windowObj.close();
  }

  close(windowObj) {
    if (!windowObj || !this.windows.includes(windowObj)) return false;
    windowObj.close();
    if (this.activeWindow === windowObj) this.activeWindow = null;
    return true;
  }

  closeAll() {
    for (const windowObj of this.windows) windowObj.close();
    this.activeWindow = null;
  }

  getActiveWindow() {
    return this.activeWindow;
  }

  getWindowForTool(tool) {
    return this.toolWindows.get(tool) ?? null;
  }

  isOpen(windowObj) {
    return this.activeWindow === windowObj;
  }

  toggle(windowObj) {
    if (this.isOpen(windowObj)) return this.close(windowObj);
    return this.open(windowObj);
  }
}
