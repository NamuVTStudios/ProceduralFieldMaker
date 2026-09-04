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