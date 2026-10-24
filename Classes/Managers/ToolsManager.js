class ToolsManager {
    constructor(appManager) {
        this.appManager = appManager; // composición, no herencia
        this.tools = [];
        this.activeTool = null;
    }

    register(tool) {
        this.tools.push(tool);
        this.appManager.register(tool); // Tool sigue siendo un AppObject
        if (!this.activeTool) this.activeTool = tool; // la primera tool registrada queda activa
    }

    /** Define cuál herramienta está activa (la usa UI al hacer click en un botón). */
    setActive(tool) {
        this.activeTool = tool;
    }
}
