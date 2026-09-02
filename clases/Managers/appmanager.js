class AppManager {
    static instance = null;
    constructor(parameters) {
        if (!AppManager.instance) {
            AppManager.instance = this;
        }
        return AppManager.instance;
    }
}