
/**
 * UnityExporter.js
 * Exporta mapas 3D como geometría OBJ y materiales MTL.
 */
class UnityExporter {

    static async download(mapData, filename = "procedural-map.obj") {
                // Corregimos la extensión recibida desde AppManager.
            filename = filename.replace(/\.unity$/i, ".obj");

            if (!filename.toLowerCase().endsWith(".obj")) {
                filename += ".obj";
            }

        if (!mapData || !mapData.voxels) {
            throw new TypeError("Los datos del mapa 3D no son válidos.");
        }

        const geometry = VoxelMeshBuilder.build(mapData);

        if (geometry.meshes.length === 0) {
            throw new Error("El mapa no contiene geometría para exportar.");
        }

        const mtlFilename = filename.replace(/\.obj$/i, ".mtl");

        const obj = this._buildOBJ(
            geometry,
            mapData,
            mtlFilename
        );

        const mtl = this._buildMTL(mapData);

        this._downloadFile(obj, filename, "text/plain");

        this._downloadFile(mtl, mtlFilename, "text/plain");
    }

    /**
     * Construye el contenido del archivo OBJ.
     */
     
static _buildOBJ(geometry, mapData, mtlFilename) {

    const output = [];
    let vertexOffset = 1;
    let normalOffset = 1;

    output.push("# Procedural Field Maker");
    output.push(`mtllib ${mtlFilename}`);
    output.push("");

    for (const mesh of geometry.meshes) {

        const material = mapData.materials.find(
            item => item.id === mesh.materialId
        );

        if (!material) continue;

        output.push(`o ${material.name}`);
        output.push(`usemtl ${material.name}`);

        for (let i = 0; i < mesh.positions.length; i += 3) {
            output.push(
                `v ${mesh.positions[i]} ${mesh.positions[i + 1]} ${mesh.positions[i + 2]}`
            );
        }

        for (let i = 0; i < mesh.normals.length; i += 3) {
            output.push(
                `vn ${mesh.normals[i]} ${mesh.normals[i + 1]} ${mesh.normals[i + 2]}`
            );
        }

        for (let i = 0; i < mesh.indices.length; i += 3) {

            const a = mesh.indices[i] + vertexOffset;
            const b = mesh.indices[i + 1] + vertexOffset;
            const c = mesh.indices[i + 2] + vertexOffset;

            const na = mesh.indices[i] + normalOffset;
            const nb = mesh.indices[i + 1] + normalOffset;
            const nc = mesh.indices[i + 2] + normalOffset;

            output.push(
                `f ${a}//${na} ${b}//${nb} ${c}//${nc}`
            );
        }

        vertexOffset += mesh.positions.length / 3;
        normalOffset += mesh.normals.length / 3;

        output.push("");
    }

    return output.join("\n");
}


    /**
     * Construye los materiales MTL.
     */
    static _buildMTL(mapData) {

        let output = [];

        output.push("# Procedural Field Maker Materials");

        for (const material of mapData.materials) {

            const hex = material.color.replace("#", "");

            const r = parseInt(hex.substring(0, 2), 16) / 255;
            const g = parseInt(hex.substring(2, 4), 16) / 255;
            const b = parseInt(hex.substring(4, 6), 16) / 255;

            output.push("");
            output.push(`newmtl ${material.name}`);
            output.push(`Ka ${r} ${g} ${b}`);
            output.push(`Kd ${r} ${g} ${b}`);
            output.push("Ks 0 0 0");
            output.push("d 1");
            output.push("illum 1");
        }

        return output.join("\n");
    }

    static _getBaseName(mapData) {
        return "procedural-map";
    }

    /**
     * Descarga un archivo de texto.
     */
   
    static _downloadFile(content, filename, mimeType) {

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Liberamos la URL después de que el navegador
        // haya tenido tiempo de iniciar la descarga.
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    }

}
