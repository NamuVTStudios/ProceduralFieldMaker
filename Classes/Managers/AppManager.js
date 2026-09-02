class AppManager {
    constructor() {
        this.objects = [];
        this.mode = '2d';
        this.mapData = null;
        this.toolsManager = new ToolsManager(this);
        this.windowsManager = new WindowsManager(this);
        this.appManager.ui = new UI(this)
        this.renderer = null;   // Renderer2D or Renderer3D
        this.physics = null;    // PhysicsEngine2D or PhysicsEngine3D
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
            if (obj.active) obj.onUpdate(dt);
        }
    }

    // Inside Renderer2D or Renderer3D, called from AppManager.onResize()
    onResize(width, height) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap en 2 para no matar el rendimiento en mobile
        this.pixiApp.renderer.resize(width, height);
        this.pixiApp.renderer.resolution = dpr;
        // equivalente en Three: renderer.setPixelRatio(dpr); renderer.setSize(width, height)
    }

    setMode(mode) {
        this.mode = mode;
        this.renderer?.onDestroy();
        this.physics?.onDestroy();

        this.renderer = mode === '2d'
            ? this.register(new Renderer2D(this))   // usa PIXI internamente
            : this.register(new Renderer3D(this));  // usa THREE internamente

        this.physics = mode === '2d'
            ? this.register(new PhysicsEngine2D(this)) // usa Box2D internamente
            : this.register(new PhysicsEngine3D(this)); // usa Cannon.js internamente
    }
}