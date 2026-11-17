
/**
 * JSONExporter.js
 * Exporta mapas 2D y 3D al formato JSON.
 */
class JSONExporter {

    /**
     * Convierte los datos del mapa en un objeto exportable.
     */
    static serialize(mapData) {
        if (!mapData) {
            throw new TypeError("No hay datos de mapa para exportar.");
        }

        // Exportación de mapas 2D.
        if (mapData.cells) {
            return {
                format: "ProceduralFieldMaker",
                version: 1,
                mode: "2d",
                dimensions: {
                    width: mapData.width,
                    height: mapData.height,
                    cellSize: mapData.cellSize ?? 8,
                },
                seed: mapData.seed,
                seedHash: mapData.seedHash,
                generation: mapData.generation || null,
                materials: mapData.materials,
                cells: Array.from(mapData.cells)
            };
        }

        // Exportación de mapas 3D.
        if (mapData.voxels) {
            return {
                format: "ProceduralFieldMaker",
                version: 1,
                mode: "3d",
                dimensions: {
                    sizeX: mapData.sizeX,
                    sizeY: mapData.sizeY,
                    sizeZ: mapData.sizeZ,
                    chunkSize: mapData.chunkSize
                },
                seed: mapData.seed,
                seedHash: mapData.seedHash,
                generation: mapData.generation || null,
                materials: mapData.materials,
                voxels: Array.from(mapData.voxels)
            };
        }

        throw new TypeError("Tipo de mapa no compatible.");
    }

    /**
     * Descarga los datos del mapa como archivo JSON.
     */
    static download(mapData, filename = "procedural-map.json") {
        const exportData = this.serialize(mapData);

        const json = JSON.stringify(exportData, null, 2);

        const blob = new Blob(
            [json],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
