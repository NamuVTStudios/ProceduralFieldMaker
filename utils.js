/**
 * utils.js
 * Funciones sueltas de propósito general, sin relación con ninguna clase en particular.
 * Refactorizado en subtareas planas de un máximo de 3 subtareas por método.
 */

/**
 * Instancia una clase y le aplica los datos de una plantilla como propiedades.
 * @param {object} templateData
 * @param {Function} TargetClass
 * @param {object} appManager
 */
function createObjectFromTemplate(templateData, TargetClass, appManager) {
    const instance = new TargetClass(appManager);
    this._hydrateTemplateInstance(instance, templateData);
    return instance;
}

function _hydrateTemplateInstance(instance, data) {
    Object.assign(instance, data);
}

/** Carga un archivo JSON de plantilla vía fetch. */
async function loadJSONTemplate(path) {
    const response = await fetch(path);
    this._validateFetchResponse(response, path);
    return response.json();
}

function _validateFetchResponse(response, path) {
    if (!response.ok) {
        throw new Error(`No se pudo cargar la plantilla: ${path}`);
    }
}

/** Clampea un valor entre un mínimo y un máximo. */
function clampValue(value, min, max) {
    const maxBounded = Math.min(max, value);
    return Math.max(min, maxBounded);
}

/** Dispara la descarga de un Blob en el navegador (usado por los exportadores). */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    triggerBlobDownload(url, filename);
    URL.revokeObjectURL(url);
}

function triggerBlobDownload(url, filename) {
    const link = document.createElement('a');
    this._configureDownloadLink(link, url, filename);
    link.click();
}

function _configureDownloadLink(link, url, filename) {
    link.href = url;
    link.download = filename;
}

/** Seed alfanumérica aleatoria (ej. "PFM-7X2K9Q"); es la que ve y podrá editar el usuario. */
function createRandomSeed() {
  const payload = Math.random().toString(36);
  return this._formatSeedPayload(payload);
}

function _formatSeedPayload(payload) {
  const slice = payload.slice(2, 8);
  return 'PFM-' + slice.toUpperCase();
}
