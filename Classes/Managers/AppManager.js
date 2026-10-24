// Tamaño por defecto del lienzo de trabajo según la dimensión elegida en el menú
const DEFAULT_PROJECT_SETTINGS = {
    '2d': { width: 128, height: 80, cellSize: 8 },
    '3d': { sizeX: 64, sizeY: 32, sizeZ: 64, chunkSize: 16 },
};

class AppManager {
    constructor() {
        this._initializeProjectState();
        this._initializeManagers();
        this.ui = null; // la crea App una vez registradas las tools
    }

    _initializeProjectState() {
        this.objects = [];
        this.mode = null;
        this.mapData = null;
        this.container = null;
        this.paused = false;
        this.isMobileLayout = false;
        this.renderer = null;
    }

    _initializeManagers() {
        this.destructionEngine = new TerrainModificationEngine(this);
        this.toolsManager = new ToolsManager(this);
        this.windowsManager = new WindowsManager(this);
    }

    setContainer(container) {
        this.container = container;
    }

    setPaused(paused) {
        this.paused = paused;
    }

    register(appObject) {
        this.objects.push(appObject);
        appObject.onInit();
        return appObject;
    }

    unregister(appObject) {
        appObject.onDestroy();
        this.objects = this.objects.filter(o => o !== appObject);
    }

    update(dt) {
        for (const obj of this.objects) {
            this.verifyObjects(obj, dt);
        }
    }

    verifyObjects(obj, dt) {
        if (obj.active) obj.onUpdate(dt);
    }

    /** Avisa al renderer activo que cambió el tamaño de la ventana (si lo necesita). */
    onResize() {
        this.renderer?.onResize?.(window.innerWidth, window.innerHeight);
    }

    /** Llamado por UI cuando cambia el layout mobile/desktop. */
    emitLayoutChange(isMobile) {
        this.isMobileLayout = isMobile;
    }

    hasProject() {
        return this.mapData !== null;
    }

    /**
     * Crea un lienzo de trabajo nuevo en la dimensión elegida ('2d' o '3d'):
     * genera el MapData vacío y arranca el renderer correspondiente.
     */
    newProject(mode) {
        this._assertSupportedMode(mode);
        this._replaceProject(mode);
    }

    _assertSupportedMode(mode) {
        if (!DEFAULT_PROJECT_SETTINGS[mode]) throw new Error(`Modo desconocido: ${mode}`);
    }

    _replaceProject(mode) {
        this.closeProject();
        this.mapData = this._createProjectMapData(mode);
        this.setMode(mode);
    }

    _createProjectMapData(mode) {
        const settings = DEFAULT_PROJECT_SETTINGS[mode];
        const config = this._createProjectConfig(settings);
        return this._createMapData(mode, config);
    }

    _createProjectConfig(settings) {
        return { ...settings, seed: createRandomSeed(), materials: createDefaultMaterials() };
    }

    _createMapData(mode, config) {
        return mode === '2d' ? createMapData2D(config) : createMapData3D(config);
    }

    /** Cierra el lienzo actual: destruye el renderer y descarta el MapData. */
    closeProject() {
        if (this.renderer) this.unregister(this.renderer);
        this.renderer = null;
        this.mapData = null;
        this.mode = null;
    }

    setMode(mode) {
        this.mode = mode;
        this._replaceRenderer(mode);
    }

    _replaceRenderer(mode) {
        if (this.renderer) this.unregister(this.renderer);
        this.renderer = this._createRenderer(mode);
    }

    _createRenderer(mode) {
        const renderer = mode === '2d' ? new Renderer2D(this) : new Renderer3D(this);
        return this.register(renderer);
    }
}
