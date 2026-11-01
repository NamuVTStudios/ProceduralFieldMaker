class App {
    constructor() {
        this._checkLibraries();
        this._initializeApplication();
    }

    _initializeApplication() {
        this.appManager = new AppManager();
        this._initializeWorkspace();
        this._activateApplication();
    }

    _activateApplication() {
        this._initializeInterface();
        this._bindGlobalEvents();
        this._startLoop();
    }

    _initializeWorkspace() {
        this._setupCanvas();
        this._registerDefaultTools();
        this._registerDefaultWindows();
    }

    _initializeInterface() {
        this.appManager.ui = new UI(this.appManager);
    }

    _setupCanvas() {
        this.container = document.body; // or a specific div
        this.appManager.setContainer(this.container);
    }

    _registerDefaultTools() {
        const tm = this.appManager.toolsManager;
        tm.register(new Brush(this.appManager));
        tm.register(new Eraser(this.appManager));
        tm.register(new NoiseBrush(this.appManager));
        tm.register(new MagicWand(this.appManager));
        tm.register(new CloneStamp(this.appManager));
    }

    _registerDefaultWindows() {
        const wm = this.appManager.windowsManager;
        this._registerToolSettingsWindow(wm, 'Brush', BrushSettings);
        this._registerToolSettingsWindow(wm, 'Eraser', EraserSettings);
        this._registerToolSettingsWindow(wm, 'NoiseBrush', NoiseBrushSettings);
        this._registerToolSettingsWindow(wm, 'MagicWand', MagicWandSettings);
        this._registerToolSettingsWindow(wm, 'CloneStamp', CloneStampSettings);
    }

    _registerToolSettingsWindow(manager, toolName, WindowType) {
        const tool = this.appManager.toolsManager.getTool(toolName);
        if (!tool) return null;
        const settingsWindow = new WindowType(this.appManager, tool);
        return manager.register(settingsWindow, tool);
    }

    _bindGlobalEvents() {
        window.addEventListener('resize', () => this.appManager.onResize());
        document.addEventListener('visibilitychange', () => {
            this.appManager.setPaused(document.hidden);
        });
        document.addEventListener('keydown', event => this._handleHistoryShortcut(event));
    }

    _handleHistoryShortcut(event) {
        if (!this._isHistoryShortcut(event)) return;
        const key = event.key.toLowerCase();
        event.preventDefault();
        if (key === 'y' || (key === 'z' && event.shiftKey)) {
            this.appManager.redo();
            return;
        }
        this.appManager.undo();
    }

    _isHistoryShortcut(event) {
        if (!event.ctrlKey && !event.metaKey) return false;
        const key = event.key.toLowerCase();
        if (key !== 'z' && key !== 'y') return false;
        if (this._isEditableTarget(event.target)) return false;
        return key !== 'y' || !event.shiftKey;
    }

    _isEditableTarget(target) {
        const tagName = target?.tagName?.toLowerCase();
        return ['input', 'textarea', 'select'].includes(tagName) || Boolean(target?.isContentEditable);
    }

    _startLoop() {
        let last = performance.now();
        const tick = (now) => {
            const dt = (now - last) / 1000;
            last = now;
            if (!this.appManager.paused) this.appManager.update(dt);
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    _checkLibraries() {
        const required = { PIXI: window.PIXI, BABYLON: window.BABYLON };
        const missing = Object.entries(required).filter(([, lib]) => !lib).map(([name]) => name);
        if (missing.length) {
            throw new Error(`Faltan librerías: ${missing.join(', ')} — revisá los <script> en el HTML`);
        }
    }
}
