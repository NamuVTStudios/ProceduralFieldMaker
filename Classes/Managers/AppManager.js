// Tamaño por defecto del lienzo de trabajo según la dimensión elegida en el menú
const DEFAULT_PROJECT_SETTINGS = {
    '2d': { width: 128, height: 80, cellSize: 8 },
    '3d': { sizeX: 64, sizeY: 32, sizeZ: 64, chunkSize: 16 },
};

class AppManager {
    constructor() {
        this.objects = [];
        this.mode = null;       // '2d' | '3d' | null (null = todavía no hay lienzo, se ve el menú)
        this.mapData = null;
        this.container = null;
        this.paused = false;
        this.isMobileLayout = false;
        this.renderer = null;   // Renderer2D or Renderer3D
        this.destructionEngine = new TerrainModificationEngine(this);
        this.toolsManager = new ToolsManager(this);
        this.windowsManager = new WindowsManager(this);
        this.ui = null;         // la crea App una vez registradas las tools
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
        const settings = DEFAULT_PROJECT_SETTINGS[mode];
        if (!settings) throw new Error(`Modo desconocido: ${mode}`);

        this.closeProject();

        const config = { ...settings, seed: createRandomSeed(), materials: createDefaultMaterials() };
        this.mapData = mode === '2d' ? createMapData2D(config) : createMapData3D(config);
        this.setMode(mode);
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
        if (this.renderer) this.unregister(this.renderer);

        this.renderer = mode === '2d'
            ? this.register(new Renderer2D(this))   // usa PIXI internamente
            : this.register(new Renderer3D(this));  // usa BABYLON internamente
    }
}
