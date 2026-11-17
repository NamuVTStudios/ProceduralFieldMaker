

/**
 * ProceduralMapGenerator.js
 * Coordina la generación procedural de mapas 2D.
 */
class ProceduralMapGenerator {

    /**
     * Genera un mapa según la perspectiva seleccionada.
     */
    static generate2D(mapData, options = {}) {
        if (!mapData || !mapData.cells) {
            throw new TypeError("MapData2D inválido.");
        }

        const palette = this._createMaterialPalette(mapData, options);
        options = this._attachGenerationPalette(options, palette);
        mapData.generation = this._createGenerationMetadata(options, palette, '2d', mapData.seed);
        const view = options.view ?? "side";
        const noise = new NoiseGenerator(mapData.seed);

        if (view === "top") {
            this._generateTopDown(mapData, noise, options);
        } else if (view === "side") {
            this._generateSide(mapData, noise, options);
        } else {
            throw new Error(`Perspectiva desconocida: ${view}`);
        }

        return mapData;
    }

    static _createMaterialPalette(mapData, options) {
        const selectedIds = this._getSelectedMaterialIds(mapData, options);
        this._validateMaterialSelection(options, selectedIds);
        return this._buildMaterialPalette(selectedIds);
    }

    static _getSelectedMaterialIds(mapData, options) {
        const availableIds = (mapData.materials || []).map(material => material.id);
        if (!Array.isArray(options.materialIds)) return availableIds;
        const requestedIds = new Set(options.materialIds.map(Number));
        return availableIds.filter(id => requestedIds.has(id));
    }

    static _validateMaterialSelection(options, selectedIds) {
        if (Array.isArray(options.materialIds) && selectedIds.length === 0) {
            throw new Error('Seleccioná al menos un material para generar el terreno.');
        }
    }

    static _buildMaterialPalette(ids) {
        const terrainIds = ids.filter(id => id !== 4);
        const roleIds = terrainIds.length ? terrainIds : ids;
        return {
            selectedIds: ids.slice(),
            sand: this._resolvePaletteRole(roleIds, 1, 0),
            earth: this._resolvePaletteRole(roleIds, 2, Math.floor((roleIds.length - 1) / 2)),
            rock: this._resolvePaletteRole(roleIds, 3, roleIds.length - 1),
            water: ids.includes(4) ? 4 : null,
        };
    }

    static _resolvePaletteRole(ids, preferredId, fallbackIndex) {
        if (ids.includes(preferredId)) return preferredId;
        return ids[Math.max(0, Math.min(ids.length - 1, fallbackIndex))] ?? 1;
    }

    static _attachGenerationPalette(options, palette) {
        return { ...options, materialPalette: palette };
    }

    static _createGenerationMetadata(options, palette, mode, seed) {
        return {
            seed,
            mode,
            view: mode === '2d' ? options.view || 'side' : 'volume',
            materialIds: palette.selectedIds.slice(),
            voronoi: Boolean(options.voronoi),
            voronoiCellSize: this._getVoronoiCellSize(options),
            voronoiBlend: this._getVoronoiBlend(options),
            waterLevelRatio: this._getWaterLevelRatio(options, mode),
            caves: options.caves !== false,
        };
    }

    static _getWaterLevelRatio(options, _mode) {
        const defaultValue = 0.65;
        const value = Number(options.waterLevelRatio ?? defaultValue);
        return Math.max(0.05, Math.min(0.95, Number.isFinite(value) ? value : defaultValue));
    }

    /**
     * Genera un mapa visto desde arriba.
     */
    static _generateTopDown(mapData, noise, options = {}) {
        const frequency = options.frequency ?? 0.035;
        const voronoi = this._createOptionalVoronoi(mapData, options);
        const voronoiBlend = this._getVoronoiBlend(options);
        const cellSize = this._getVoronoiCellSize(options);
        this._generateTopDownRows(mapData, noise, frequency, voronoi, voronoiBlend, cellSize, options.materialPalette);
    }

    static _generateTopDownRows(mapData, noise, frequency, voronoi, voronoiBlend, cellSize, palette) {
        for (let y = 0; y < mapData.height; y++) {
            this._generateTopDownRow(mapData, noise, y, frequency, voronoi, voronoiBlend, cellSize, palette);
        }
    }

    static _generateTopDownRow(mapData, noise, y, frequency, voronoi, voronoiBlend, cellSize, palette) {
        for (let x = 0; x < mapData.width; x++) {
            this._generateTopDownCell(mapData, noise, x, y, frequency, voronoi, voronoiBlend, cellSize, palette);
        }
    }

    static _generateTopDownCell(mapData, noise, x, y, frequency, voronoi, voronoiBlend, cellSize, palette) {
        const noiseValue = this._normalizeNoise(noise.fbm2D(x * frequency, y * frequency));
        const cellValue = this._sampleVoronoi(voronoi, x, y, cellSize);
        const blended = voronoi ? noiseValue * (1 - voronoiBlend) + cellValue * voronoiBlend : noiseValue;
        setCell2D(mapData, x, y, this._getTopDownMaterial(blended, palette));
    }

    static _createOptionalVoronoi(mapData, options = {}) {
        if (!this._isVoronoiEnabled(options)) return null;
        return new VoronoiGenerator(mapData.seed);
    }

    static _isVoronoiEnabled(options) {
        if (typeof options.voronoi === 'boolean') return options.voronoi;
        return Number(options.voronoiBlend) > 0;
    }

    static _getVoronoiBlend(options) {
        if (options.voronoi === false) return 0;
        const defaultBlend = options.voronoi === true ? 0.35 : 0;
        const value = Number(options.voronoiBlend ?? defaultBlend);
        return Math.max(0, Math.min(1, Number.isFinite(value) ? value : defaultBlend));
    }

    static _getVoronoiCellSize(options) {
        const value = Number(options.voronoiCellSize);
        return Number.isFinite(value) ? Math.max(2, value) : 16;
    }

    static _sampleVoronoi(generator, x, z, cellSize) {
        if (!generator) return 0.5;
        return generator.getValue2D(x, z, cellSize);
    }

    static _getVoronoiSurfaceValue(generator, x, z, cellSize, blend) {
        const regionValue = this._sampleVoronoi(generator, x, z, cellSize);
        return 0.5 * (1 - blend) + regionValue * blend;
    }

    static _getSurfaceMaterial(isLowland, regionValue, palette) {
        if (isLowland || regionValue < 0.49) return palette.sand;
        if (regionValue > 0.56) return palette.rock;
        return palette.earth;
    }

    /**
     * Selecciona un material según el ruido.
     */
    static _getTopDownMaterial(value, palette) {
        if (value < 0.30 && palette.water !== null) return palette.water;
        if (value < 0.42) return palette.sand;
        if (value < 0.78) return palette.earth;
        return palette.rock;
    }

    /**
     * Genera un terreno visto lateralmente.
     */
    static _generateSide(mapData, noise, options) {
        const frequency = options.frequency ?? 0.035;
        const surfaceYs = new Int32Array(mapData.width);
        const voronoi = this._createOptionalVoronoi(mapData, options);
        const blend = this._getVoronoiBlend(options);
        const cellSize = this._getVoronoiCellSize(options);
        const waterLine = Math.floor(mapData.height * (1 - this._getWaterLevelRatio(options, '2d')));

        for (let x = 0; x < mapData.width; x++) {
            const value = noise.fbm2D(x * frequency, 0.25);
            const surfaceY = this._getSurfaceY(value, mapData.height);
            const region = this._getVoronoiSurfaceValue(voronoi, x, 0, cellSize, blend);

            surfaceYs[x] = surfaceY;
            this._fillTerrainColumn(mapData, x, surfaceY, region, Boolean(voronoi), options.materialPalette, waterLine);
        }

        if (options.caves !== false) {
            this._carveSideCaves(
                mapData,
                surfaceYs,
                options.caveOptions ?? {}
            );
        }
    }

    /**
     * Calcula la altura de la superficie.
     */
    static _getSurfaceY(noiseValue, mapHeight) {
        const normalized = this._normalizeNoise(noiseValue);
        const heightRatio = 0.20 + normalized * 0.25;

        return Math.floor(mapHeight * heightRatio);
    }

    /**
     * Rellena una columna con diferentes materiales.
     */
    static _fillTerrainColumn(mapData, x, surfaceY, regionValue = 0.5, useVoronoi = false, palette, waterLine) {
        const surfaceMaterial = useVoronoi
            ? this._getSurfaceMaterial(false, regionValue, palette)
            : palette.sand;
        this._fillTerrainDepth(mapData, x, surfaceY, surfaceMaterial, palette);
        this._fillSideWater(mapData, x, surfaceY, waterLine, palette);
    }

    static _fillSideWater(mapData, x, surfaceY, waterLine, palette) {
        if (palette.water === null || surfaceY <= waterLine) return;
        this._fillSideWaterColumn(mapData, x, surfaceY, waterLine, palette.water);
    }

    static _fillSideWaterColumn(mapData, x, surfaceY, waterLine, waterMaterialId) {
        for (let y = waterLine; y < surfaceY; y++) {
            setCell2D(mapData, x, y, waterMaterialId);
        }
    }

    static _fillTerrainDepth(mapData, x, surfaceY, surfaceMaterial, palette) {
        for (let y = surfaceY; y < mapData.height; y++) {
            const depth = y - surfaceY;
            const materialId = this._getDepthMaterial(depth, surfaceMaterial, mapData.height, palette);
            setCell2D(mapData, x, y, materialId);
        }
    }

    static _getDepthMaterial(depth, surfaceMaterial, mapHeight, palette) {
        if (depth < 2) return surfaceMaterial;
        if (depth < mapHeight * 0.15) return palette.earth;
        return palette.rock;
    }

    /**
     * Genera y aplica las cavernas.
     */
    static _carveSideCaves(mapData, surfaceYs, caveOptions) {
        const mask = CellularAutomata.generateCaveMask2D(
            mapData.width,
            mapData.height,
            mapData.seedHash,
            caveOptions
        );

        for (let y = 0; y < mapData.height; y++) {
            for (let x = 0; x < mapData.width; x++) {
                const index = y * mapData.width + x;
                const belowSurface = y > surfaceYs[x] + 6;

                if (belowSurface && mask[index] === 0) {
                    setCell2D(mapData, x, y, AIR_MATERIAL_ID);
                }
            }
        }
    }

    /**
     * Convierte el ruido a un rango entre 0 y 1.
     */
    static _normalizeNoise(value) {
        return Math.max(0, Math.min(1, (value + 1) / 2));
    }


    /**
     * Genera un terreno procedural tridimensional.
     */
    static generate3D(mapData, options = {}) {
        if (!mapData || !mapData.voxels) {
            throw new TypeError("MapData3D inválido.");
        }

        const palette = this._createMaterialPalette(mapData, options);
        options = this._attachGenerationPalette(options, palette);
        mapData.generation = this._createGenerationMetadata(options, palette, '3d', mapData.seed);
        const noise = new NoiseGenerator(mapData.seed);

        // Limpiamos el volumen antes de generar.
        mapData.voxels.fill(AIR_MATERIAL_ID);

        const heightmap = this._generate3DHeightmap(
            mapData,
            noise,
            options
        );

        // Convertimos el mapa de alturas en un volumen sólido.
        applyHeightmapToMapData3D(mapData, heightmap, 3);
        this._apply3DMaterials(mapData, heightmap, options);
        this._generateOptionalCaves(mapData, noise, heightmap, options);
        return mapData;
    }

    static _generateOptionalCaves(mapData, noise, heightmap, options) {
        if (options.caves === false) return;
        this._carve3DCaves(mapData, noise, heightmap, options.caveOptions ?? {});
    }

    /**
     * Calcula la altura de cada columna del terreno.
     */
    static _generate3DHeightmap(mapData, noise, options) {
        const frequency = options.frequency ?? 0.045;

        const minHeight = Math.max(
            1,
            Math.floor(mapData.sizeY * (options.minHeightRatio ?? 0.20))
        );

        const maxHeight = Math.min(
            mapData.sizeY,
            Math.floor(mapData.sizeY * (options.maxHeightRatio ?? 0.85))
        );

        const safeMaxHeight = Math.max(minHeight, maxHeight);

        const heightmap = new Uint16Array(
            mapData.sizeX * mapData.sizeZ
        );

        for (let z = 0; z < mapData.sizeZ; z++) {
            for (let x = 0; x < mapData.sizeX; x++) {
                const value = noise.fbm2D(
                    x * frequency,
                    z * frequency
                );

                const normalized = this._normalizeNoise(value);

                const height = minHeight +
                    normalized * (safeMaxHeight - minHeight);

                const index = z * mapData.sizeX + x;

                heightmap[index] = Math.max(
                    1,
                    Math.min(mapData.sizeY, Math.round(height))
                );
            }
        }

        return heightmap;
    }

    /**
     * Distribuye los materiales y genera las zonas de agua.
     */
    static _apply3DMaterials(mapData, heightmap, options) {
        const palette = options.materialPalette;
        const voronoi = this._createOptionalVoronoi(mapData, options);
        const voronoiBlend = this._getVoronoiBlend(options);
        const voronoiCellSize = this._getVoronoiCellSize(options);
        const waterLevel = palette.water === null ? 0 : Math.max(
            0,
            Math.min(
                mapData.sizeY,
                Math.floor(
                    mapData.sizeY * this._getWaterLevelRatio(options, '3d')
                )
            )
        );

        for (let z = 0; z < mapData.sizeZ; z++) {
            for (let x = 0; x < mapData.sizeX; x++) {
                const index = z * mapData.sizeX + x;
                const columnHeight = heightmap[index];

                this._apply3DColumnMaterials(
                    mapData,
                    x,
                    z,
                    columnHeight,
                    waterLevel,
                    this._getVoronoiSurfaceValue(voronoi, x, z, voronoiCellSize, voronoiBlend),
                    palette
                );
            }
        }
    }

    /**
     * Asigna los materiales de una columna individual.
     */
    static _apply3DColumnMaterials(
        mapData,
        x,
        z,
        columnHeight,
        waterLevel,
        voronoiSurfaceValue = 0.5,
        palette
    ) {
        const surfaceY = columnHeight - 1;
        const isLowland = columnHeight <= waterLevel + 2;

        for (let y = 0; y < columnHeight; y++) {
            const depth = surfaceY - y;

            let materialId = palette.rock;

            if (depth < 4) {
                materialId = palette.earth;
            }

            if (depth === 0) {
                materialId = this._getSurfaceMaterial(isLowland, voronoiSurfaceValue, palette);
            }

            setVoxel3D(mapData, x, y, z, materialId);
        }

        // Rellenamos con agua las zonas por debajo del nivel del agua.
        for (let y = columnHeight; y < waterLevel; y++) {
            setVoxel3D(mapData, x, y, z, palette.water);
        }
    }

    /**
     * Genera cavernas tridimensionales dentro del terreno.
     */
    static _carve3DCaves(mapData, noise, heightmap, options = {}) {
        const frequency = options.frequency ?? 0.085;
        const threshold = options.threshold ?? 0.35;
        const roofThickness = options.roofThickness ?? 4;
        const boundary = options.boundary ?? 2;

        for (let z = boundary; z < mapData.sizeZ - boundary; z++) {
            for (let x = boundary; x < mapData.sizeX - boundary; x++) {
                const index = z * mapData.sizeX + x;
                const surfaceY = heightmap[index] - 1;

                const maxCaveY = surfaceY - roofThickness;

                for (let y = 2; y <= maxCaveY; y++) {
                    this._tryCarve3DVoxel(
                        mapData,
                        noise,
                        x,
                        y,
                        z,
                        frequency,
                        threshold
                    );
                }
            }
        }
    }

    /**
     * Comprueba si un vóxel debe convertirse en aire.
     */
    static _tryCarve3DVoxel(
        mapData,
        noise,
        x,
        y,
        z,
        frequency,
        threshold
    ) {
        const materialId = getVoxel3D(mapData, x, y, z);

        // No modificamos el aire ni el agua.
        if (materialId === AIR_MATERIAL_ID || materialId === 4) {
            return;
        }

        const caveNoise = noise.fbm3D(
            x * frequency,
            y * frequency,
            z * frequency,
            4,
            0.5,
            2.0
        );

        if (caveNoise > threshold) {
            setVoxel3D(mapData, x, y, z, AIR_MATERIAL_ID);
        }
    }


}

