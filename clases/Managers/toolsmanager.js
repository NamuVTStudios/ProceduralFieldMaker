class ToolsManager {
    constructor(appManager) {
        this.appManager = appManager; // composición, no herencia
        this.tools = [];
    }

    register(tool) {
        this.tools.push(tool);
        this.appManager.register(tool); // Tool sigue siendo un AppObject
    }

    getActiveTool() { /* ... */ }
}