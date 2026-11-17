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
        this.mapLayerManager = new MapLayerManager(this);
    }

    setContainer(container) {
        this.container = container;
    }

    setPaused(paused) {
        this.paused = paused;
    }

    register(appObject) {
        this._assertObjectCanRegister(appObject);
        return this._registerIfNeeded(appObject);
    }

    _registerIfNeeded(appObject) {
        if (this._isAlreadyRegistered(appObject)) return appObject;
        this._addRegisteredObject(appObject);
        this._initializeRegisteredObject(appObject);
        return appObject;
    }

    _isAlreadyRegistered(appObject) {
        return this.objects.includes(appObject);
    }

    _assertObjectCanRegister(appObject) {
        if (!appObject || typeof appObject.onInit !== 'function' || typeof appObject.onDestroy !== 'function') {
            throw new TypeError('AppManager solo registra objetos con contrato de ciclo de vida.');
        }
        if (appObject.destroyed) throw new Error('No se puede registrar un AppObject destruido.');
    }

    _addRegisteredObject(appObject) {
        this.objects.push(appObject);
    }

    _initializeRegisteredObject(appObject) {
        appObject.onInit();
    }

    unregister(appObject) {
        if (!this._isRegistered(appObject)) return false;
        this._removeRegisteredObject(appObject);
        this._destroyRegisteredObject(appObject);
        return true;
    }

    _isRegistered(appObject) {
        return this.objects.includes(appObject);
    }

    _removeRegisteredObject(appObject) {
        this.objects = this.objects.filter(object => object !== appObject);
    }

    _destroyRegisteredObject(appObject) {
        if (typeof appObject._destroyFromManager === 'function') {
            appObject._destroyFromManager();
            return;
        }
        appObject.onDestroy();
    }

    update(dt) {
        for (const obj of this.objects) {
            this.verifyObjects(obj, dt);
        }
    }

    verifyObjects(obj, dt) {
        if (typeof obj.isActive === 'function' && !obj.isActive()) return;
        if (!obj.active) return;
        obj.onUpdate(dt);
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
 * Exporta el proyecto actual al formato solicitado.
 */
exportProject(format, filename = null) {
    if (!this.hasProject()) {
        throw new Error("No hay ningún proyecto abierto para exportar.");
    }

    const exportMapData = this.mapLayerManager.getExportMapData();

    if (!exportMapData) {
        throw new Error("No se pudieron obtener los datos del mapa.");
    }

    const exporter = ExportRegistry.getExporter(format);

    if (typeof exporter.download !== "function") {
        throw new Error(`El exportador ${format} no permite descargas.`);
    }

    const defaultFilename = `procedural-map.${format.toLowerCase()}`;

    return exporter.download(
        exportMapData,
        filename || defaultFilename
    );
    }

    /** Importa un proyecto JSON nativo de Procedural Field Maker. */
    importProjectData(payload) {
        const importedMap = this._createImportedMapData(payload);
        this.closeProject();
        this.mapData = importedMap;
        this._finishNewProject(payload.mode);
        return importedMap;
    }

    _createImportedMapData(payload) {
        this._validateImportHeader(payload);
        const materials = this._normalizeImportedMaterials(payload.materials);
        const seed = String(payload.seed || 'imported-map');
        const seedHash = Number.isInteger(payload.seedHash) ? payload.seedHash : hashSeedToInt(seed);
        if (payload.mode === '2d') return this._createImported2DData(payload, materials, seed, seedHash);
        return this._createImported3DData(payload, materials, seed, seedHash);
    }

    _validateImportHeader(payload) {
        if (!payload || payload.format !== 'ProceduralFieldMaker') throw new TypeError('El archivo no es un mapa de Procedural Field Maker.');
        if (payload.version !== 1) throw new Error(`Versión de mapa no compatible: ${payload.version ?? 'desconocida'}.`);
        if (!['2d', '3d'].includes(payload.mode)) throw new Error('El archivo no indica un modo 2D o 3D válido.');
    }

    _normalizeImportedMaterials(rawMaterials) {
        const source = Array.isArray(rawMaterials) ? rawMaterials : createDefaultMaterials();
        const materials = source
            .filter(item => Number.isInteger(Number(item?.id)) && Number(item.id) > 0 && Number(item.id) <= 255)
            .map(item => ({
                id: Number(item.id),
                name: String(item.name || `Material ${item.id}`),
                color: /^#[0-9a-fA-F]{6}$/.test(item.color || '') || /^#[0-9a-fA-F]{3}$/.test(item.color || '') ? item.color : '#ffffff',
                hardness: Math.max(0, Number(item.hardness ?? 1) || 0),
                destructible: item.destructible !== false,
                textureId: item.textureId ?? null,
            }));
        const unique = new Map(materials.map(item => [item.id, item]));
        if (unique.size === 0) return createDefaultMaterials();
        return Array.from(unique.values());
    }

    _createImported2DData(payload, materials, seed, seedHash) {
        const dimensions = payload.dimensions || {};
        const width = this._validateImportDimension(dimensions.width, 'ancho');
        const height = this._validateImportDimension(dimensions.height, 'alto');
        this._validateImportBufferSize(width * height);
        const cells = this._createImportedBuffer(payload.cells, width * height, materials);
        return {
            width,
            height,
            cellSize: Math.max(1, Number(dimensions.cellSize || payload.cellSize || 8)),
            cells,
            materials,
            seed,
            seedHash,
            generation: payload.generation || null,
        };
    }

    _createImported3DData(payload, materials, seed, seedHash) {
        const dimensions = payload.dimensions || {};
        const sizeX = this._validateImportDimension(dimensions.sizeX, 'X');
        const sizeY = this._validateImportDimension(dimensions.sizeY, 'Y');
        const sizeZ = this._validateImportDimension(dimensions.sizeZ, 'Z');
        const total = sizeX * sizeY * sizeZ;
        this._validateImportBufferSize(total);
        const voxels = this._createImportedBuffer(payload.voxels, total, materials);
        return {
            sizeX,
            sizeY,
            sizeZ,
            chunkSize: Math.max(4, Number(dimensions.chunkSize || 16)),
            voxels,
            materials,
            seed,
            seedHash,
            generation: payload.generation || null,
        };
    }

    _validateImportDimension(value, label) {
        const dimension = Number(value);
        if (!Number.isInteger(dimension) || dimension < 1) throw new Error(`La dimensión ${label} no es válida.`);
        return dimension;
    }

    _validateImportBufferSize(total) {
        if (!Number.isSafeInteger(total) || total > 4194304) throw new Error('El mapa supera el límite de importación de 4.194.304 celdas o vóxeles.');
    }

    _createImportedBuffer(rawBuffer, expectedLength, materials) {
        if (!Array.isArray(rawBuffer) || rawBuffer.length !== expectedLength) throw new Error('El contenido del mapa no coincide con sus dimensiones.');
        const validIds = new Set(materials.map(item => item.id));
        const buffer = Uint8Array.from(rawBuffer, value => this._validateImportedMaterialId(value, validIds));
        return buffer;
    }

    _validateImportedMaterialId(value, validIds) {
        const materialId = Number(value);
        if (!Number.isInteger(materialId) || materialId < 0 || materialId > 255) throw new Error('El mapa contiene un ID de material inválido.');
        if (materialId !== 0 && !validIds.has(materialId)) throw new Error(`El mapa utiliza un material desconocido: ${materialId}.`);
        return materialId;
    }

    /**
     * Crea un lienzo de trabajo nuevo en la dimensión elegida ('2d' o '3d'):
     * genera el MapData vacío y arranca el renderer correspondiente.
     */
    
    newProject(mode, options = {}) {
        this._assertSupportedMode(mode);
        this._replaceProject(mode, options);
    }


    _assertSupportedMode(mode) {
        if (!DEFAULT_PROJECT_SETTINGS[mode]) throw new Error(`Modo desconocido: ${mode}`);
    }

    

    _replaceProject(mode, options = {}) {
        this.closeProject();

        this.mapData = this._createProjectMapData(mode, options);

        if (mode === '2d') {
            ProceduralMapGenerator.generate2D(this.mapData, options);
        } else {
            ProceduralMapGenerator.generate3D(this.mapData, options);
        }
        this._finishNewProject(mode);
    }



    _finishNewProject(mode) {
        this.mapLayerManager.initializeProject(this.mapData);
        this.setMode(mode);
    }

    _createProjectMapData(mode, options = {}) {
        const settings = DEFAULT_PROJECT_SETTINGS[mode];
        const config = this._createProjectConfig(settings, options);
        return this._createMapData(mode, config);
    }

    _createProjectConfig(settings, options = {}) {
        const seed = options.seed === undefined ? createRandomSeed() : String(options.seed);
        return { ...settings, seed, materials: createDefaultMaterials() };
    }

    _createMapData(mode, config) {
        return mode === '2d' ? createMapData2D(config) : createMapData3D(config);
    }

    /** Cierra el lienzo actual: destruye el renderer y descarta el MapData. */
    closeProject() {
        if (this.renderer) this.unregister(this.renderer);
        this.renderer = null;
        this.mapLayerManager.clearProject();
        this.mapData = null;
        this.mode = null;
    }

    applyFilter(filterName, options = {}) {
        return this.mapLayerManager.applyFilter(filterName, options);
    }

    undo() {
        return this.mapLayerManager.undo();
    }

    redo() {
        return this.mapLayerManager.redo();
    }

    resizeCanvas(dimensions) {
        return this.mapLayerManager.resizeCanvas(dimensions);
    }

    /** API para sistemas de juego: explosiones que excavan volumen del terreno. */
    explodeTerrain(center, options = {}) {
        return this.mapLayerManager.explodeTerrain(center, options);
    }

    /** API para impactos de proyectiles o cuerpos rígidos. */
    applyProjectileImpact(center, options = {}) {
        return this.mapLayerManager.applyProjectileImpact(center, options);
    }

    /** API para taladros, rayos o túneles que atraviesan el terreno. */
    drillTerrain(start, end, options = {}) {
        return this.mapLayerManager.drillTerrain(start, end, options);
    }

    damageTerrain(center, options = {}) {
        return this.mapLayerManager.damageTerrain(center, options);
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
