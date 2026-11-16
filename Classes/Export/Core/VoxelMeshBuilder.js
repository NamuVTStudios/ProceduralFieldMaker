
/**
 * VoxelMeshBuilder.js
 * Construye geometría 3D optimizada a partir de un mapa de voxels.
 *
 * Solo genera las caras que están expuestas al aire.
 * Agrupa la geometría por material para facilitar las exportaciones.
 */
class VoxelMeshBuilder {

    /**
     * Construye las mallas de todos los materiales del mapa.
     */
    static build(mapData) {
        if (!mapData || !mapData.voxels) {
            throw new TypeError("Los datos del mapa 3D no son válidos.");
        }

        const { sizeX, sizeY, sizeZ, voxels, materials } = mapData;

        const meshes = new Map();

        for (let y = 0; y < sizeY; y++) {
            for (let z = 0; z < sizeZ; z++) {
                for (let x = 0; x < sizeX; x++) {

                    const index = (y * sizeZ + z) * sizeX + x;
                    const materialId = voxels[index];

                    // El material 0 representa aire.
                    if (materialId === 0) continue;

                    this._addVoxelFaces(
                        meshes,
                        mapData,
                        x, y, z,
                        materialId
                    );
                }
            }
        }

        return {
            sizeX,
            sizeY,
            sizeZ,
            meshes: Array.from(meshes.values())
        };
    }

    /**
     * Comprueba si una posición contiene aire.
     * Las posiciones fuera del mapa también se consideran aire.
     */
    
/**
 * Comprueba si una posición contiene aire.
 * Las posiciones fuera del mapa también se consideran aire.
 */
static _isExposed(mapData, x, y, z) {
    const { sizeX, sizeY, sizeZ, voxels } = mapData;

    if (
        x < 0 || x >= sizeX ||
        y < 0 || y >= sizeY ||
        z < 0 || z >= sizeZ
    ) {
        return true;
    }

    const index = (y * sizeZ + z) * sizeX + x;
    const neighborMaterialId = voxels[index];

    return neighborMaterialId === 0;
}


    /**
     * Agrega las caras expuestas de un voxel.
     */
    static _addVoxelFaces(meshes, mapData, x, y, z, materialId) {

        const directions = [
            {
                neighbor: [1, 0, 0],
                normal: [1, 0, 0],
                vertices: [
                    [1, 0, 0], [1, 1, 0],
                    [1, 1, 1], [1, 0, 1]
                ]
            },
            {
                neighbor: [-1, 0, 0],
                normal: [-1, 0, 0],
                vertices: [
                    [0, 0, 1], [0, 1, 1],
                    [0, 1, 0], [0, 0, 0]
                ]
            },
            {
                neighbor: [0, 1, 0],
                normal: [0, 1, 0],
                vertices: [
                    [0, 1, 1], [1, 1, 1],
                    [1, 1, 0], [0, 1, 0]
                ]
            },
            {
                neighbor: [0, -1, 0],
                normal: [0, -1, 0],
                vertices: [
                    [0, 0, 0], [1, 0, 0],
                    [1, 0, 1], [0, 0, 1]
                ]
            },
            {
                neighbor: [0, 0, 1],
                normal: [0, 0, 1],
                vertices: [
                    [1, 0, 1], [1, 1, 1],
                    [0, 1, 1], [0, 0, 1]
                ]
            },
            {
                neighbor: [0, 0, -1],
                normal: [0, 0, -1],
                vertices: [
                    [0, 0, 0], [0, 1, 0],
                    [1, 1, 0], [1, 0, 0]
                ]
            }
        ];

        for (const direction of directions) {

            const [dx, dy, dz] = direction.neighbor;

            const isExposed = this._isExposed(
            mapData,
            x + dx,
            y + dy,
            z + dz,
            materialId
            );

            if (!isExposed) continue;

            this._addFace(
                meshes,
                materialId,
                direction,
                x, y, z
            );
        }
    }

    /**
     * Agrega una cara a la malla correspondiente a su material.
     */
    static _addFace(meshes, materialId, direction, x, y, z) {

        if (!meshes.has(materialId)) {
            meshes.set(materialId, {
                materialId,
                positions: [],
                normals: [],
                indices: []
            });
        }

        const mesh = meshes.get(materialId);
        const baseIndex = mesh.positions.length / 3;

        for (const vertex of direction.vertices) {
            mesh.positions.push(
                x + vertex[0],
                y + vertex[1],
                z + vertex[2]
            );

            mesh.normals.push(...direction.normal);
        }

        mesh.indices.push(
            baseIndex,
            baseIndex + 1,
            baseIndex + 2,
            baseIndex,
            baseIndex + 2,
            baseIndex + 3
        );
    }
}
