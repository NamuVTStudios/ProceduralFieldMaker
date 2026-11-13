
/**
 * PNGExporter.js
 * Exporta mapas 2D como imágenes PNG.
 */
class PNGExporter {

    /**
     * Convierte los datos del mapa en una imagen PNG.
     */
    static export2D(mapData, filename = "procedural-map.png") {
        if (!mapData || !mapData.cells) {
            throw new TypeError("Los datos del mapa 2D no son válidos.");
        }

        const canvas = document.createElement("canvas");
        canvas.width = mapData.width;
        canvas.height = mapData.height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error("No se pudo crear el contexto del canvas.");
        }

        const imageData = ctx.createImageData(
            mapData.width,
            mapData.height
        );

        for (let i = 0; i < mapData.cells.length; i++) {
            const materialId = mapData.cells[i];
            const color = this._getMaterialColor(
                mapData.materials,
                materialId
            );

            const pixelIndex = i * 4;

            if (color) {
            imageData.data[pixelIndex] = color.r;
            imageData.data[pixelIndex + 1] = color.g;
            imageData.data[pixelIndex + 2] = color.b;
            imageData.data[pixelIndex + 3] = 255;
        } else {
            // Los espacios de aire serán transparentes.
            imageData.data[pixelIndex + 3] = 0;
        }
        }

        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob(blob => {
            if (!blob) {
                throw new Error("No se pudo generar la imagen PNG.");
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = filename;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
        }, "image/png");
    }

/**
 * Genera un heightmap PNG a partir de un mapa 3D.
 */
    static exportHeightmap3D(mapData, filename = "procedural-heightmap.png") {
        if (!mapData || !mapData.voxels) {
            throw new TypeError("Los datos del mapa 3D no son válidos.");
        }

        const { sizeX, sizeY, sizeZ, voxels } = mapData;

        const canvas = document.createElement("canvas");
        canvas.width = sizeX;
        canvas.height = sizeZ;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error("No se pudo crear el contexto del canvas.");
        }

        const imageData = ctx.createImageData(sizeX, sizeZ);

        for (let z = 0; z < sizeZ; z++) {
            for (let x = 0; x < sizeX; x++) {

                let highestY = 0;

                // Buscamos el bloque sólido más alto de la columna.
                for (let y = sizeY - 1; y >= 0; y--) {
                    const index = (y * sizeZ + z) * sizeX + x;
                    const materialId = voxels[index];

                    // 0 = aire, 4 = agua.
                    if (materialId !== 0 && materialId !== 4) {
                        highestY = y;
                        break;
                    }
                }

                // Convertimos la altura en un valor entre 0 y 255.
                const gray = sizeY > 1
                    ? Math.round((highestY / (sizeY - 1)) * 255)
                    : 0;

                const pixelIndex = (z * sizeX + x) * 4;

                imageData.data[pixelIndex] = gray;
                imageData.data[pixelIndex + 1] = gray;
                imageData.data[pixelIndex + 2] = gray;
                imageData.data[pixelIndex + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob(blob => {
            if (!blob) {
                throw new Error("No se pudo generar el heightmap.");
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = filename;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
        }, "image/png");
    }

    /**
     * Obtiene el color RGB correspondiente a un material.
     */
    
/**
 * Obtiene el color RGB correspondiente a un material.
 */
    static _getMaterialColor(materials, materialId) {

        // El identificador 0 representa aire.
        if (materialId === 0) {
            return null;
        }

        // Los IDs comienzan en 1, pero el arreglo comienza en 0.
        const material = materials?.[materialId - 1];

        if (!material) {
            return { r: 255, g: 0, b: 255 };
        }

        const hex = material.color || "#ff00ff";
        const normalizedHex = hex.replace("#", "");

        return {
            r: parseInt(normalizedHex.substring(0, 2), 16),
            g: parseInt(normalizedHex.substring(2, 4), 16),
            b: parseInt(normalizedHex.substring(4, 6), 16)
        };
    }


    /**
     * Descarga el mapa en el formato PNG.
     */
    static download(mapData, filename = null) {

    if (mapData?.voxels) {
        return this.exportHeightmap3D(
            mapData,
            filename || "procedural-heightmap.png"
        );
    }

    return this.export2D(
        mapData,
        filename || "procedural-map.png"
    );
}
}
