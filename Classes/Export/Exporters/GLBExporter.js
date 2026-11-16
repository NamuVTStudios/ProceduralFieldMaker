
/**
 * GLBExporter.js
 * Exporta mapas 3D al formato GLB utilizando Babylon.js.
 */
class GLBExporter {

    /**
     * Construye y descarga el modelo GLB.
     */
    static async download(mapData, filename = "procedural-map.glb") {

        if (!mapData || !mapData.voxels) {
            throw new TypeError("Los datos del mapa 3D no son válidos.");
        }

        if (
            typeof BABYLON === "undefined" ||
            !BABYLON.GLTF2Export ||
            !BABYLON.GLTF2Export.GLBAsync
        ) {
            throw new Error("El exportador GLB de Babylon.js no está disponible.");
        }

        const geometry = VoxelMeshBuilder.build(mapData);

        if (geometry.meshes.length === 0) {
            throw new Error("El mapa no contiene geometría para exportar.");
        }

        const engine = new BABYLON.NullEngine();
        const scene = new BABYLON.Scene(engine);

        try {
            for (const meshData of geometry.meshes) {

                const materialInfo = mapData.materials.find(
                    material => material.id === meshData.materialId
                );

                if (!materialInfo) {
                    throw new Error(
                        `No se encontró el material ${meshData.materialId}.`
                    );
                }

                this._createMesh(
                    scene,
                    meshData,
                    materialInfo
                );
            }

            const glb = await BABYLON.GLTF2Export.GLBAsync(
                scene,
                filename
            );

            glb.downloadFiles();

        } finally {
            scene.dispose();
            engine.dispose();
        }
    }

    /**
     * Crea una malla Babylon.js a partir de la geometría de voxels.
     */
    static _createMesh(scene, meshData, materialInfo) {

        const mesh = new BABYLON.Mesh(
            `Material_${materialInfo.name}`,
            scene
        );

        const vertexData = new BABYLON.VertexData();

        vertexData.positions = meshData.positions;
        vertexData.normals = meshData.normals;
        vertexData.indices = meshData.indices;

        vertexData.applyToMesh(mesh);

        const material = new BABYLON.PBRMaterial(
            `Material_${materialInfo.name}`,
            scene
        );

        material.albedoColor = BABYLON.Color3.FromHexString(
            materialInfo.color
        );

        material.metallic = 0;
        material.roughness = 1;

        // Conserva ambas caras de la geometría.
        material.backFaceCulling = false;

        mesh.material = material;
        mesh.isPickable = false;
    }
    
}

