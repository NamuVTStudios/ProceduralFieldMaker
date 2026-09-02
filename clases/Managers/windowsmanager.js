class WindowsManager {
    constructor(appManager) {
        this.appManager = appManager;
        this.windows = [];
    }

    open(windowObj) {
        this.windows.push(windowObj);
        this.appManager.register(windowObj); // Window también es AppObject
    }
}