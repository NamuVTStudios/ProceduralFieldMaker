class AppObject {
    static instance = null;
    constructor(parameters) {
        if (!AppObject.instance) {
            AppObject.instance = this;
        }
        return AppObject.instance;
    }
}