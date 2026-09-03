/**
 * utils.js
 * Funciones sueltas de propósito general, sin relación con ninguna clase en particular. Nombres verbo + descriptivos para evitar colisión con globals de Pixi/Three/Box2D/Cannon.
 */

/**
 * Instancia una clase y le aplica los datos de una plantilla como propiedades.
 * @param {object} templateData
 * @param {Function} TargetClass
 * @param {object} appManager
 */
function createObjectFromTemplate(templateData, TargetClass, appManager) {
    const instance = new TargetClass(appManager);
    Object.assign(instance, templateData);
    return instance;
}

/** Carga un archivo JSON de plantilla vía fetch. */
async function loadJSONTemplate(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`No se pudo cargar la plantilla: ${path}`);
    return response.json();
}

/** Clampea un valor entre un mínimo y un máximo. */
function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/** Dispara la descarga de un Blob en el navegador (usado por los exportadores). */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * meshing.js
 * Convierte un chunk de voxels en datos de geometría planos (no depende de Three.js: Renderer3D arma el BufferGeometry a partir de esto). Usa "face culling" — solo generar las caras contra aire — como base sólida. El greedy meshing (fusionar caras coplanares para reducir triángulos) es una optimización posterior sobre esta misma función, no reemplaza su lógica de detección de caras visibles.
 */

const FACE_DEFS = [
    { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], normal: [1, 0, 0] },
    { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], normal: [-1, 0, 0] },
    { dir: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], normal: [0, 1, 0] },
    { dir: [0, -1, 0], corners: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], normal: [0, -1, 0] },
    { dir: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], normal: [0, 0, 1] },
    { dir: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], normal: [0, 0, -1] },
];

/**
 * Genera la malla de un chunk de voxels usando face-culling.
 * @param {Uint8Array} voxels - tamaño size^3, orden (y*size+z)*size+x
 * @param {number} size - lado del chunk (ej. 16)
 * @param {object[]} materials - catálogo de materiales (para el color por cara)
 * @returns {{positions: Float32Array, normals: Float32Array, colors: Float32Array, indices: Uint32Array}}
 */
function generateChunkMeshData(voxels, size, materials) {
    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];

    const getVoxel = (x, y, z) => {
        if (x < 0 || y < 0 || z < 0 || x >= size || y >= size || z >= size) return 0;
        return voxels[(y * size + z) * size + x];
    };
    const colorOf = (materialId) => {
        const mat = materials.find(m => m.id === materialId);
        return mat ? hexColorToRgb(mat.color) : [1, 1, 1];
    };

    for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
                const materialId = getVoxel(x, y, z);
                if (materialId === 0) continue; // aire, no dibuja nada

                for (const face of FACE_DEFS) {
                    const [nx, ny, nz] = face.dir;
                    if (getVoxel(x + nx, y + ny, z + nz) !== 0) continue; // cara oculta, se saltea

                    const startIndex = positions.length / 3;
                    const [r, g, b] = colorOf(materialId);

                    for (const [cx, cy, cz] of face.corners) {
                        positions.push(x + cx, y + cy, z + cz);
                        normals.push(...face.normal);
                        colors.push(r, g, b);
                    }
                    indices.push(startIndex, startIndex + 1, startIndex + 2, startIndex, startIndex + 2, startIndex + 3);
                }
            }
        }
    }

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        colors: new Float32Array(colors),
        indices: new Uint32Array(indices),
    };
}

/** "#rrggbb" -> [r, g, b] en [0,1], para usar como vertex color. */
function hexColorToRgb(hex) {
    const value = parseInt(hex.replace('#', ''), 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/**
 * mapDataFactory.js
 * MapData2D y MapData3D son estructuras de datos planas (no clases): esto permite pasarlas directo a Web Workers como Transferable Objects y serializarlas sin lógica extra. Estas funciones las crean y acceden.
 */

const AIR_MATERIAL_ID = 0;

/**
 * Crea una definición de material con valores por defecto.
 * @param {Partial<{id:number,name:string,destructible:boolean,hardness:number,color:string,textureId:string}>} data
 */
function createMaterial(data) {
    return {
        id: data.id,
        name: data.name ?? `material_${data.id}`,
        destructible: data.destructible ?? true,
        hardness: data.hardness ?? 1,
        color: data.color ?? '#ffffff',
        textureId: data.textureId ?? null,
    };
}

/**
 * Crea una estructura MapData2D vacía (llena de aire).
 * @param {{width:number, height:number, cellSize?:number, seed:number, materials:object[]}} config
 */
function createMapData2D(config) {
    return {
        width: config.width,
        height: config.height,
        cellSize: config.cellSize ?? 16,
        cells: new Uint8Array(config.width * config.height).fill(AIR_MATERIAL_ID),
        materials: config.materials,
        seed: config.seed,
    };
}

/**
 * Crea una estructura MapData3D vacía (llena de aire).
 * @param {{sizeX:number, sizeY:number, sizeZ:number, chunkSize?:number, seed:number, materials:object[]}} config
 */
function createMapData3D(config) {
    return {
        sizeX: config.sizeX,
        sizeY: config.sizeY,
        sizeZ: config.sizeZ,
        chunkSize: config.chunkSize ?? 16,
        voxels: new Uint8Array(config.sizeX * config.sizeY * config.sizeZ).fill(AIR_MATERIAL_ID),
        materials: config.materials,
        seed: config.seed,
    };
}

/** Índice plano de una celda 2D. */
function getCellIndex2D(mapData2D, x, y) {
    return y * mapData2D.width + x;
}

function getCell2D(mapData2D, x, y) {
    if (x < 0 || y < 0 || x >= mapData2D.width || y >= mapData2D.height) return AIR_MATERIAL_ID;
    return mapData2D.cells[getCellIndex2D(mapData2D, x, y)];
}

function setCell2D(mapData2D, x, y, materialId) {
    if (x < 0 || y < 0 || x >= mapData2D.width || y >= mapData2D.height) return;
    mapData2D.cells[getCellIndex2D(mapData2D, x, y)] = materialId;
}

/** Índice plano de un voxel 3D (orden X, luego Z, luego Y — Y más externo). */
function getVoxelIndex3D(mapData3D, x, y, z) {
    return (y * mapData3D.sizeZ + z) * mapData3D.sizeX + x;
}

function getVoxel3D(mapData3D, x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= mapData3D.sizeX || y >= mapData3D.sizeY || z >= mapData3D.sizeZ) {
        return AIR_MATERIAL_ID;
    }
    return mapData3D.voxels[getVoxelIndex3D(mapData3D, x, y, z)];
}

function setVoxel3D(mapData3D, x, y, z, materialId) {
    if (x < 0 || y < 0 || z < 0 || x >= mapData3D.sizeX || y >= mapData3D.sizeY || z >= mapData3D.sizeZ) return;
    mapData3D.voxels[getVoxelIndex3D(mapData3D, x, y, z)] = materialId;
}

/**
 * Extruye un heightmap (ver noiseGenerator.js) a un MapData3D ya creado,
 * rellenando de sólido todo lo que esté por debajo de la altura de columna.
 * @param {object} mapData3D
 * @param {Uint16Array} heightmap - tamaño sizeX * sizeZ
 * @param {number} solidMaterialId
 */
function applyHeightmapToMapData3D(mapData3D, heightmap, solidMaterialId) {
    for (let z = 0; z < mapData3D.sizeZ; z++) {
        for (let x = 0; x < mapData3D.sizeX; x++) {
            const columnHeight = heightmap[z * mapData3D.sizeX + x];
            for (let y = 0; y < Math.min(columnHeight, mapData3D.sizeY); y++) {
                setVoxel3D(mapData3D, x, y, z, solidMaterialId);
            }
        }
    }
}

/**
 * destructionFunctions.js
 * La destrucción es una mutación directa sobre MapData2D/MapData3D.
 * Estas funciones devuelven qué se modificó (dirty regions / chunks afectados) para que Renderer2D/Renderer3D sepan qué redibujar/remallar sin tener que recorrer todo el mapa.
 */

/**
 * Destruye (pone en aire) todas las celdas dentro de un radio circular.
 * Respeta `destructible` del material de cada celda.
 * @param {object} mapData2D
 * @param {number} centerX
 * @param {number} centerY
 * @param {number} radius
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}} región modificada (dirty rect)
 */
function destroyCircle2D(mapData2D, centerX, centerY, radius) {
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(mapData2D.width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(mapData2D.height - 1, Math.ceil(centerY + radius));
    const radiusSq = radius * radius;

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const dx = x - centerX, dy = y - centerY;
            if (dx * dx + dy * dy > radiusSq) continue;

            const materialId = getCell2D(mapData2D, x, y);
            const material = mapData2D.materials.find(m => m.id === materialId);
            if (material && !material.destructible) continue;

            setCell2D(mapData2D, x, y, AIR_MATERIAL_ID);
        }
    }
    return { minX, minY, maxX, maxY };
}

/**
 * Destruye (pone en aire) todos los voxels dentro de un radio esférico.
 * @param {object} mapData3D
 * @param {number} centerX
 * @param {number} centerY
 * @param {number} centerZ
 * @param {number} radius
 * @returns {Set<string>} claves "cx,cy,cz" de los chunks afectados (para remallar)
 */
function destroySphere3D(mapData3D, centerX, centerY, centerZ, radius) {
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(mapData3D.sizeX - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(mapData3D.sizeY - 1, Math.ceil(centerY + radius));
    const minZ = Math.max(0, Math.floor(centerZ - radius));
    const maxZ = Math.min(mapData3D.sizeZ - 1, Math.ceil(centerZ + radius));
    const radiusSq = radius * radius;
    const affectedChunks = new Set();
    const chunkSize = mapData3D.chunkSize;

    for (let z = minZ; z <= maxZ; z++) {
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const dx = x - centerX, dy = y - centerY, dz = z - centerZ;
                if (dx * dx + dy * dy + dz * dz > radiusSq) continue;

                const materialId = getVoxel3D(mapData3D, x, y, z);
                const material = mapData3D.materials.find(m => m.id === materialId);
                if (material && !material.destructible) continue;

                setVoxel3D(mapData3D, x, y, z, AIR_MATERIAL_ID);
                affectedChunks.add(`${Math.floor(x / chunkSize)},${Math.floor(y / chunkSize)},${Math.floor(z / chunkSize)}`);
            }
        }
    }
    return affectedChunks;
}


/**
 * noiseGenerator.js
 * Funciones puras de generación de ruido. No dependen de ninguna clase ni de estado externo: mismo seed + mismos parámetros => mismo resultado.
 */

/**
 * Crea un generador de números pseudoaleatorios determinístico (mulberry32).
 * @param {number} seed
 * @returns {() => number} función que devuelve un float en [0, 1)
 */
function createSeededRandom(seed) {
    let state = seed >>> 0;
    return function random() {
        state |= 0;
        state = (state + 0x6D2B79F5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Interpolación suave (smoothstep) para el ruido de valor.
 */
function smoothInterpolate(a, b, t) {
    const ft = t * t * (3 - 2 * t);
    return a * (1 - ft) + b * ft;
}

/**
 * Genera una grilla de "value noise" 2D en el rango [0, 1).
 * Base para heightmaps y mapas de densidad.
 * @param {number} width
 * @param {number} height
 * @param {number} seed
 * @param {{cellSize?: number}} [options]
 * @returns {Float32Array} tamaño width*height
 */
function generateValueNoise2D(width, height, seed, options = {}) {
    const cellSize = options.cellSize ?? 16;
    const random = createSeededRandom(seed);

    const gridW = Math.ceil(width / cellSize) + 2;
    const gridH = Math.ceil(height / cellSize) + 2;
    const gridValues = new Float32Array(gridW * gridH);
    for (let i = 0; i < gridValues.length; i++) gridValues[i] = random();

    const output = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const gx = x / cellSize;
            const gy = y / cellSize;
            const x0 = Math.floor(gx), y0 = Math.floor(gy);
            const tx = gx - x0, ty = gy - y0;

            const v00 = gridValues[y0 * gridW + x0];
            const v10 = gridValues[y0 * gridW + x0 + 1];
            const v01 = gridValues[(y0 + 1) * gridW + x0];
            const v11 = gridValues[(y0 + 1) * gridW + x0 + 1];

            const top = smoothInterpolate(v00, v10, tx);
            const bottom = smoothInterpolate(v01, v11, tx);
            output[y * width + x] = smoothInterpolate(top, bottom, ty);
        }
    }
    return output;
}

/**
 * Ruido fractal (fBm): suma varias octavas de value noise a distinta frecuencia/amplitud. Es lo que normalmente se usa para heightmaps de terreno con detalle a múltiples escalas.
 * @param {number} width
 * @param {number} height
 * @param {number} seed
 * @param {{octaves?: number, persistence?: number, baseCellSize?: number}} [options]
 * @returns {Float32Array} valores normalizados en [0, 1)
 */
function generateFractalNoise2D(width, height, seed, options = {}) {
    const octaves = options.octaves ?? 4;
    const persistence = options.persistence ?? 0.5;
    const baseCellSize = options.baseCellSize ?? 32;

    const result = new Float32Array(width * height);
    let amplitude = 1;
    let totalAmplitude = 0;
    let cellSize = baseCellSize;

    for (let o = 0; o < octaves; o++) {
        const layer = generateValueNoise2D(width, height, seed + o * 1013, { cellSize });
        for (let i = 0; i < result.length; i++) result[i] += layer[i] * amplitude;
        totalAmplitude += amplitude;
        amplitude *= persistence;
        cellSize = Math.max(2, Math.floor(cellSize / 2));
    }

    for (let i = 0; i < result.length; i++) result[i] /= totalAmplitude;
    return result;
}

/**
 * Genera un heightmap (una altura por columna X/Z) a partir de ruido fractal,
 * pensado para extruir a un MapData3D.
 * @param {number} sizeX
 * @param {number} sizeZ
 * @param {number} seed
 * @param {{maxHeight?: number, octaves?: number, persistence?: number, baseCellSize?: number}} [options]
 * @returns {Uint16Array} altura por columna (índice = z * sizeX + x)
 */
function generateHeightmap(sizeX, sizeZ, seed, options = {}) {
    const maxHeight = options.maxHeight ?? 32;
    const noise = generateFractalNoise2D(sizeX, sizeZ, seed, options);
    const heights = new Uint16Array(sizeX * sizeZ);
    for (let i = 0; i < noise.length; i++) {
        heights[i] = Math.floor(noise[i] * maxHeight);
    }
    return heights;
}


/**
 * cellularAutomata.js
 * Funciones puras para generar/suavizar cuevas estilo "Falling Sand" sobre una grilla 2D de materiales, usando la regla clásica de autómata celular (4-5 rule). No conocen MapData2D como estructura completa: reciben y devuelven arrays planos para poder testearse aisladas.
 */

/**
 * Inicializa una grilla binaria aleatoria (1 = sólido, 0 = vacío) según
 * una probabilidad de relleno inicial.
 * @param {number} width
 * @param {number} height
 * @param {number} seed
 * @param {number} [fillProbability=0.45]
 * @returns {Uint8Array}
 */
function generateRandomFillGrid(width, height, seed, fillProbability = 0.45) {
    const random = createSeededRandom(seed);
    const grid = new Uint8Array(width * height);
    for (let i = 0; i < grid.length; i++) {
        grid[i] = random() < fillProbability ? 1 : 0;
    }
    return grid;
}

/**
 * Cuenta vecinos sólidos (8-direcciones) de una celda, tratando los bordes del mapa como sólidos (evita que las cuevas se "escapen" por el borde).
 */
function countSolidNeighbors(grid, width, height, x, y) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
                count++; // borde tratado como sólido
            } else {
                count += grid[ny * width + nx];
            }
        }
    }
    return count;
}

/**
 * Ejecuta un único paso de suavizado de autómata celular sobre la grilla.
 * @param {Uint8Array} grid - grilla binaria de entrada
 * @param {number} width
 * @param {number} height
 * @param {{birthLimit?: number, deathLimit?: number}} [options]
 * @returns {Uint8Array} nueva grilla (no muta la de entrada)
 */
function stepCellularAutomata2D(grid, width, height, options = {}) {
    const birthLimit = options.birthLimit ?? 4;
    const deathLimit = options.deathLimit ?? 3;
    const output = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const solidNeighbors = countSolidNeighbors(grid, width, height, x, y);
            if (grid[idx] === 1) {
                output[idx] = solidNeighbors < deathLimit ? 0 : 1;
            } else {
                output[idx] = solidNeighbors > birthLimit ? 1 : 0;
            }
        }
    }
    return output;
}

/**
 * Corre el autómata celular N iteraciones seguidas, partiendo de una grilla
 * aleatoria. Resultado típico: cuevas orgánicas conectadas.
 * @param {number} width
 * @param {number} height
 * @param {number} seed
 * @param {{iterations?: number, fillProbability?: number, birthLimit?: number, deathLimit?: number}} [options]
 * @returns {Uint8Array} grilla binaria final (1 = sólido, 0 = vacío/cueva)
 */
function generateCaveGrid(width, height, seed, options = {}) {
    const iterations = options.iterations ?? 5;
    let grid = generateRandomFillGrid(width, height, seed, options.fillProbability);
    for (let i = 0; i < iterations; i++) {
        grid = stepCellularAutomata2D(grid, width, height, options);
    }
    return grid;
}


/**
 * godotExporter.js
 * Igual que unityExporter.js pero con las convenciones de Godot: en 2D el eje Y de TileMap crece hacia abajo (a diferencia de Unity), y en 3D Godot 4 también es Y-up pero con su propia escala de unidad recomendada.
 */

/**
 * @param {object} mapData - MapData2D o MapData3D
 * @param {{meshData?: object, unitsPerCell?: number}} [options]
 * @returns {Promise<{name: string, blob: Blob}[]>}
 */
async function exportToGodot(mapData, options = {}) {
    const isMapData3D = 'sizeX' in mapData;
    const unitsPerCell = options.unitsPerCell ?? 1;

    const metadata = {
        engine: 'godot',
        axisConvention: isMapData3D ? 'Y-up' : 'Y-down (TileMap)',
        unitsPerCell,
        seed: mapData.seed,
        materials: mapData.materials,
    };
    const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });

    if (isMapData3D) {
        const meshBlob = await exportToOBJ(mapData, options);
        return [
            { name: 'terrain.obj', blob: meshBlob },
            { name: 'terrain.godot-meta.json', blob: metadataBlob },
        ];
    }
    const pngBlob = await exportToPNG(mapData, options);
    return [
        { name: 'terrain.png', blob: pngBlob },
        { name: 'terrain.godot-meta.json', blob: metadataBlob },
    ];
}

const godotExporterEntry = {
    id: 'godot',
    label: 'Godot',
    supports: ['2d', '3d'],
    export: exportToGodot,
};


/**
 * jsonExporter.js
 * Exporta MapData2D/MapData3D tal cual, en JSON. Formato pensado para reimportar en la propia app o para debugging/motores propios.
 */

/**
 * @param {object} mapData - MapData2D o MapData3D
 * @param {{pretty?: boolean}} [options]
 * @returns {Promise<Blob>}
 */
async function exportToJSON(mapData, options = {}) {
    const isMapData3D = 'sizeX' in mapData;
    const payload = {
        type: isMapData3D ? 'MapData3D' : 'MapData2D',
        seed: mapData.seed,
        materials: mapData.materials,
        ...(isMapData3D
            ? { sizeX: mapData.sizeX, sizeY: mapData.sizeY, sizeZ: mapData.sizeZ, chunkSize: mapData.chunkSize, voxels: Array.from(mapData.voxels) }
            : { width: mapData.width, height: mapData.height, cellSize: mapData.cellSize, cells: Array.from(mapData.cells) }),
    };
    const text = options.pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
    return new Blob([text], { type: 'application/json' });
}

/** Entrada para el ExportRegistry — ver export/ExportRegistry.js */
const jsonExporterEntry = {
    id: 'json',
    label: 'JSON',
    supports: ['2d', '3d'],
    export: exportToJSON,
};


/**
 * objExporter.js
 * Convierte datos de mesh (el formato que devuelve meshing.js) a texto Wavefront .obj. Espera recibir la mesh ya generada en options.meshData, porque el meshing es costoso y puede haberse hecho una sola vez por chunk durante la edición — no tiene sentido rehacerlo acá.
 */

/**
 * @param {object} mapData3D - solo se usa para metadata (seed, tamaño)
 * @param {{meshData: {positions: Float32Array, normals: Float32Array, indices: Uint32Array}}} options
 * @returns {Promise<Blob>}
 */
async function exportToOBJ(mapData3D, options = {}) {
    const { meshData } = options;
    if (!meshData) throw new Error('exportToOBJ requiere options.meshData (ver meshing.js)');

    const lines = [`# Exportado desde ProceduralFieldMaker — seed ${mapData3D.seed}`];

    const vertexCount = meshData.positions.length / 3;
    for (let i = 0; i < vertexCount; i++) {
        lines.push(`v ${meshData.positions[i * 3]} ${meshData.positions[i * 3 + 1]} ${meshData.positions[i * 3 + 2]}`);
    }
    for (let i = 0; i < vertexCount; i++) {
        lines.push(`vn ${meshData.normals[i * 3]} ${meshData.normals[i * 3 + 1]} ${meshData.normals[i * 3 + 2]}`);
    }
    for (let i = 0; i < meshData.indices.length; i += 3) {
        // OBJ es 1-indexado
        const a = meshData.indices[i] + 1;
        const b = meshData.indices[i + 1] + 1;
        const c = meshData.indices[i + 2] + 1;
        lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
    }

    return new Blob([lines.join('\n')], { type: 'text/plain' });
}

const objExporterEntry = {
    id: 'obj',
    label: 'OBJ',
    supports: ['3d'],
    export: exportToOBJ,
};


/**
 * pngExporter.js
 * Exporta el mapa como imagen: cada píxel codifica el material (2D) o, en 3D, se aplana primero a un heightmap y se exporta ese heightmap.
 */

/**
 * Aplana un MapData3D a un heightmap (altura de la primera celda de aire desde arriba en cada columna X/Z), útil para exportar como PNG estilo Unity Terrain / Godot HeightMapShape3D.
 * @param {object} mapData3D
 * @returns {Uint16Array} tamaño sizeX * sizeZ
 */
function computeHeightmapFromVoxels(mapData3D) {
    const heights = new Uint16Array(mapData3D.sizeX * mapData3D.sizeZ);
    for (let z = 0; z < mapData3D.sizeZ; z++) {
        for (let x = 0; x < mapData3D.sizeX; x++) {
            let height = 0;
            for (let y = mapData3D.sizeY - 1; y >= 0; y--) {
                if (getVoxel3D(mapData3D, x, y, z) !== 0) { height = y + 1; break; }
            }
            heights[z * mapData3D.sizeX + x] = height;
        }
    }
    return heights;
}

/**
 * @param {object} mapData - MapData2D o MapData3D
 * @param {{mode?: 'material'|'heightmap'}} [options]
 * @returns {Promise<Blob>}
 */
async function exportToPNG(mapData, options = {}) {
    const isMapData3D = 'sizeX' in mapData;
    const width = isMapData3D ? mapData.sizeX : mapData.width;
    const height = isMapData3D ? mapData.sizeZ : mapData.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);

    if (isMapData3D) {
        const heights = computeHeightmapFromVoxels(mapData);
        const maxHeight = mapData.sizeY || 1;
        for (let i = 0; i < heights.length; i++) {
            const gray = Math.floor((heights[i] / maxHeight) * 255);
            imageData.data[i * 4] = gray;
            imageData.data[i * 4 + 1] = gray;
            imageData.data[i * 4 + 2] = gray;
            imageData.data[i * 4 + 3] = 255;
        }
    } else {
        for (let i = 0; i < mapData.cells.length; i++) {
            const material = mapData.materials.find(m => m.id === mapData.cells[i]);
            const [r, g, b] = material ? hexColorToRgb(material.color) : [0, 0, 0];
            imageData.data[i * 4] = Math.floor(r * 255);
            imageData.data[i * 4 + 1] = Math.floor(g * 255);
            imageData.data[i * 4 + 2] = Math.floor(b * 255);
            imageData.data[i * 4 + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

const pngExporterEntry = {
    id: 'png',
    label: 'PNG',
    supports: ['2d', '3d'],
    export: exportToPNG,
};


/**
 * unityExporter.js
 * No reimplementa meshing ni rasterizado: compone pngExporter/objExporter/jsonExporter y les agrega un JSON de metadata con las convenciones de Unity (Y-up, 1 unidad = 1 metro).
 */

/**
 * @param {object} mapData - MapData2D o MapData3D
 * @param {{meshData?: object, unitsPerCell?: number}} [options]
 * @returns {Promise<{name: string, blob: Blob}[]>} archivos a incluir en el export (ej. zip)
 */

async function exportToUnity(mapData, options = {}) {
    const isMapData3D = 'sizeX' in mapData;
    const unitsPerCell = options.unitsPerCell ?? 1;

    const metadata = {
        engine: 'unity',
        axisConvention: 'Y-up',
        unitsPerCell,
        seed: mapData.seed,
        materials: mapData.materials,
    };
    const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });

    if (isMapData3D) {
        const meshBlob = await exportToOBJ(mapData, options);
        return [
            { name: 'terrain.obj', blob: meshBlob },
            { name: 'terrain.unity-meta.json', blob: metadataBlob },
        ];
    }
    const pngBlob = await exportToPNG(mapData, options);
    return [
        { name: 'terrain.png', blob: pngBlob },
        { name: 'terrain.unity-meta.json', blob: metadataBlob },
    ];
}

const unityExporterEntry = {
    id: 'unity',
    label: 'Unity',
    supports: ['2d', '3d'],
    export: exportToUnity,
};
