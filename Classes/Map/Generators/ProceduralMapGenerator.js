

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

        const view = options.view ?? "side";
        const noise = new NoiseGenerator(mapData.seed);

        if (view === "top") {
            this._generateTopDown(mapData, noise);
        } else if (view === "side") {
            this._generateSide(mapData, noise, options);
        } else {
            throw new Error(`Perspectiva desconocida: ${view}`);
        }

        return mapData;
    }

    /**
     * Genera un mapa visto desde arriba.
     */
    static _generateTopDown(mapData, noise) {
        const frequency = 0.035;

        for (let y = 0; y < mapData.height; y++) {
            for (let x = 0; x < mapData.width; x++) {
                const value = noise.fbm2D(
                    x * frequency,
                    y * frequency
                );

                const normalized = this._normalizeNoise(value);
                const materialId = this._getTopDownMaterial(normalized);

                setCell2D(mapData, x, y, materialId);
            }
        }
    }

    /**
     * Selecciona un material según el ruido.
     */
    static _getTopDownMaterial(value) {
        if (value < 0.30) return 4; // Agua
        if (value < 0.42) return 1; // Arena
        if (value < 0.78) return 2; // Tierra

        return 3; // Roca
    }

    /**
     * Genera un terreno visto lateralmente.
     */
    static _generateSide(mapData, noise, options) {
        const frequency = options.frequency ?? 0.035;
        const surfaceYs = new Int32Array(mapData.width);

        for (let x = 0; x < mapData.width; x++) {
            const value = noise.fbm2D(x * frequency, 0.25);

            const surfaceY = this._getSurfaceY(
                value,
                mapData.height
            );

            surfaceYs[x] = surfaceY;

            this._fillTerrainColumn(
                mapData,
                x,
                surfaceY
            );
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
    static _fillTerrainColumn(mapData, x, surfaceY) {
        for (let y = surfaceY; y < mapData.height; y++) {
            const depth = y - surfaceY;
            let materialId = 3;

            if (depth < 2) {
                materialId = 1; // Arena
            } else if (depth < mapData.height * 0.15) {
                materialId = 2; // Tierra
            }

            setCell2D(mapData, x, y, materialId);
        }
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

                // Distribuimos los materiales según la profundidad.
        this._apply3DMaterials(mapData, heightmap, options);

            // Generamos cavernas dentro del terreno.
            if (options.caves !== false) {
                this._carve3DCaves(
                    mapData,
                    noise,
                    heightmap,
                    options.caveOptions ?? {}
                );
            }

            return mapData;
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
        const waterLevel = Math.max(
            0,
            Math.min(
                mapData.sizeY,
                Math.floor(
                    mapData.sizeY * (options.waterLevelRatio ?? 0.35)
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
                    waterLevel
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
        waterLevel
    ) {
        const surfaceY = columnHeight - 1;
        const isLowland = columnHeight <= waterLevel + 2;

        for (let y = 0; y < columnHeight; y++) {
            const depth = surfaceY - y;

            let materialId = 3; // Roca

            if (depth < 4) {
                materialId = 2; // Tierra
            }

            if (depth === 0 && isLowland) {
                materialId = 1; // Arena
            }

            setVoxel3D(mapData, x, y, z, materialId);
        }

        // Rellenamos con agua las zonas por debajo del nivel del agua.
        for (let y = columnHeight; y < waterLevel; y++) {
            setVoxel3D(mapData, x, y, z, 4);
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

