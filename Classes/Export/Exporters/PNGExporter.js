
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
            this._writePixel(imageData.data, i, mapData.materials, mapData.cells[i]);
        }

        ctx.putImageData(imageData, 0, 0);

        return this._downloadCanvas(canvas, filename, "No se pudo generar la imagen PNG.");
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

        return this._downloadCanvas(canvas, filename, "No se pudo generar el heightmap.");
    }


    static _writePixel(data, pixelIndex, materials, materialId) {
        const offset = pixelIndex * 4;
        const color = this._getMaterialColor(materials, materialId);
        if (!color) {
            data[offset + 3] = 0;
            return;
        }
        data[offset] = color.r;
        data[offset + 1] = color.g;
        data[offset + 2] = color.b;
        data[offset + 3] = 255;
    }

    static _downloadCanvas(canvas, filename, errorMessage) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => this._completeCanvasDownload(blob, filename, errorMessage, resolve, reject), "image/png");
        });
    }

    static _completeCanvasDownload(blob, filename, errorMessage, resolve, reject) {
        if (!blob) {
            reject(new Error(errorMessage));
            return;
        }
        this._downloadBlob(blob, filename);
        resolve(true);
    }

    static _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
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

        const material = this._findMaterialById(materials, materialId);
        if (!material) return { r: 255, g: 0, b: 255 };
        return this._parseMaterialHex(material.color);
    }

    static _findMaterialById(materials, materialId) {
        return materials?.find(item => item.id === materialId) || null;
    }

    static _parseMaterialHex(color) {
        const normalized = String(color || '#ff00ff').replace(/^#/, '');
        const expanded = normalized.length === 3
            ? normalized.split('').map(value => value + value).join('')
            : normalized;
        if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return { r: 255, g: 0, b: 255 };
        return {
            r: parseInt(expanded.slice(0, 2), 16),
            g: parseInt(expanded.slice(2, 4), 16),
            b: parseInt(expanded.slice(4, 6), 16),
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
