
/**
 * ExportRegistry.js
 * Registra y coordina los diferentes exportadores.
 */
class ExportRegistry {

    /**
     * Registra un exportador para un formato determinado.
     */
    static register(format, exporterClass) {
        if (!format || !exporterClass) {
            throw new TypeError("Formato o exportador inválido.");
        }

        if (!this.exporters) {
            this.exporters = {};
        }

        this.exporters[format.toLowerCase()] = exporterClass;
    }

    /**
     * Obtiene el exportador correspondiente a un formato.
     */
    static getExporter(format) {
        const exporter = this.exporters?.[format.toLowerCase()];

        if (!exporter) {
            throw new Error(
                `No existe un exportador registrado para: ${format}`
            );
        }

        return exporter;
    }

    /**
     * Descarga un mapa utilizando el formato solicitado.
     */
    static download(format, mapData, filename) {
        const exporter = this.getExporter(format);

        if (typeof exporter.download !== "function") {
            throw new Error(
                `El exportador ${format} no tiene implementado download().`
            );
        }

        return exporter.download(mapData, filename);
    }

    /**
     * Devuelve los formatos disponibles.
     */
    static getAvailableFormats() {
        return Object.keys(this.exporters ?? {});
    }
}

// Registramos el exportador JSON.
ExportRegistry.register("json", JSONExporter);
ExportRegistry.register("png", PNGExporter);
ExportRegistry.register("glb", GLBExporter);
ExportRegistry.register("unity", UnityExporter);
ExportRegistry.register("godot", GodotExporter);