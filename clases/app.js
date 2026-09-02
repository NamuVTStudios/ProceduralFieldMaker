class App {
    constructor() {
        this._checkLibraries();
        this.appManager = new AppManager();
        this._setupCanvas();
        this._registerDefaultTools();
        this._registerDefaultWindows();
        this._bindGlobalEvents();
        this.appManager.init(); // arranca en modo por defecto (ej. '2d')
        this._startLoop();
    }

    _setupCanvas() {
        this.container = document.body; // o un div específico
        this.appManager.setContainer(this.container);
    }

    _registerDefaultTools() {
        const tm = this.appManager.toolsManager;
        tm.register(new Brush(this.appManager));
        tm.register(new Eraser(this.appManager));
        tm.register(new MagicWand(this.appManager));
    }

    _registerDefaultWindows() {
        const wm = this.appManager.windowsManager;
        wm.register(new BrushSettings(this.appManager));
        wm.register(new EraserSettings(this.appManager));
        wm.register(new MagicWandSettings(this.appManager));
    }

    _bindGlobalEvents() {
        window.addEventListener('resize', () => this.appManager.onResize());
        document.addEventListener('visibilitychange', () => {
            this.appManager.setPaused(document.hidden);
        });
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
        const required = { PIXI: window.PIXI, THREE: window.THREE, Box2D: window.Box2D, CANNON: window.CANNON };
        const missing = Object.entries(required).filter(([, lib]) => !lib).map(([name]) => name);
        if (missing.length) {
            throw new Error(`Faltan librerías: ${missing.join(', ')} — revisá los <script> en el HTML`);
        }
    }
}