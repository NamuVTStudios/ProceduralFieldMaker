class WindowsManager {
    constructor(appManager) {
        this.appManager = appManager;
        this.windows = [];
    }

    /** Registra una ventana (queda cerrada hasta que se la abra con open). */
    register(windowObj) {
        windowObj.active = false;
        this.windows.push(windowObj);
        this.appManager.register(windowObj); // Window también es AppObject
    }

    open(windowObj) {
        if (!this.windows.includes(windowObj)) this.register(windowObj);
        windowObj.active = true;
    }

    close(windowObj) {
        windowObj.active = false;
    }
}
