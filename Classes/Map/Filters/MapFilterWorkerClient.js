/** Cliente de Web Worker para filtros; el fallback síncrono vive en MapLayerManager. */
class MapFilterWorkerClient {
  constructor(workerUrl = 'Workers/MapFilterWorker.js') {
    this.workerUrl = workerUrl;
    this.worker = null;
    this.pending = new Map();
    this.sequence = 0;
  }

  apply(filterName, source, mapData, options = {}) {
    const worker = this._getWorker();
    const id = ++this.sequence;
    const payload = this._createPayload(id, filterName, source, mapData, options);
    return this._enqueueJob(worker, id, payload);
  }

  _getWorker() {
    if (typeof Worker !== 'function') throw new Error('Web Workers no están disponibles.');
    if (this.worker) return this.worker;
    this.worker = new Worker(this.workerUrl);
    this.worker.onmessage = event => this._handleMessage(event.data);
    this.worker.onerror = event => this._handleWorkerError(event);
    this.worker.onmessageerror = event => this._handleWorkerMessageError(event);
    return this.worker;
  }

  _createPayload(id, filterName, source, mapData, options) {
    return {
      id,
      filterName,
      buffer: source.slice().buffer,
      dimensions: this._getDimensions(mapData),
      materials: mapData.materials || [],
      options,
    };
  }

  _getDimensions(mapData) {
    if (mapData.sizeX) return { sizeX: mapData.sizeX, sizeY: mapData.sizeY, sizeZ: mapData.sizeZ };
    return { width: mapData.width, height: mapData.height };
  }

  _enqueueJob(worker, id, payload) {
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        worker.postMessage(payload, [payload.buffer]);
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  _handleMessage(message) {
    const job = this.pending.get(message.id);
    if (!job) return;
    this.pending.delete(message.id);
    if (message.error) return job.reject(new Error(message.error));
    job.resolve(new Uint8Array(message.buffer));
  }

  _handleWorkerError(event) {
    this._rejectPendingJobs(new Error(event.message || 'Falló la ejecución del filtro en Web Worker.'));
    this._terminateWorker();
  }

  _handleWorkerMessageError() {
    this._rejectPendingJobs(new Error('No se pudo leer la respuesta del filtro en Web Worker.'));
    this._terminateWorker();
  }

  _rejectPendingJobs(error) {
    for (const job of this.pending.values()) job.reject(error);
    this.pending.clear();
  }

  _terminateWorker() {
    this.worker?.terminate();
    this.worker = null;
  }

  cancelAll() {
    this._terminateWorker();
    this._rejectPendingJobs(new Error('Los trabajos de filtrado fueron cancelados.'));
  }
}
