/** Cliente de Web Worker para el Flood Fill 2D/3D. */
class MagicWandWorkerClient {
  constructor(workerUrl = 'Workers/MagicWandWorker.js') {
    this.workerUrl = workerUrl;
    this.worker = null;
    this.pending = new Map();
    this.sequence = 0;
  }

  apply(source, mapData, point, newMaterial, maxFillLimit) {
    const worker = this._getWorker();
    const id = ++this.sequence;
    const payload = this._createPayload(id, source, mapData, point, newMaterial, maxFillLimit);
    return this._enqueue(worker, id, payload);
  }

  _getWorker() {
    if (typeof Worker !== 'function') throw new Error('Web Workers no están disponibles.');
    if (this.worker) return this.worker;
    this.worker = new Worker(this.workerUrl);
    this._bindWorkerEvents();
    return this.worker;
  }

  _bindWorkerEvents() {
    this.worker.onmessage = event => this._handleMessage(event.data);
    this.worker.onerror = event => this._handleWorkerError(event);
    this.worker.onmessageerror = () => this._handleWorkerError({ message: 'Respuesta de Flood Fill ilegible.' });
  }

  _createPayload(id, source, mapData, point, newMaterial, maxFillLimit) {
    return {
      id,
      mode: mapData.sizeX ? '3d' : '2d',
      buffer: source.slice().buffer,
      dimensions: this._getDimensions(mapData),
      point,
      newMaterial,
      maxFillLimit,
    };
  }

  _getDimensions(mapData) {
    if (mapData.sizeX) return { sizeX: mapData.sizeX, sizeY: mapData.sizeY, sizeZ: mapData.sizeZ, chunkSize: mapData.chunkSize || 16 };
    return { width: mapData.width, height: mapData.height };
  }

  _enqueue(worker, id, payload) {
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
    job.resolve({ buffer: new Uint8Array(message.buffer), dirtyChunks: message.dirtyChunks || [] });
  }

  _handleWorkerError(event) {
    const error = new Error(event.message || 'Falló el Flood Fill en Web Worker.');
    this._rejectPending(error);
    this._terminateWorker();
  }

  _rejectPending(error) {
    for (const job of this.pending.values()) job.reject(error);
    this.pending.clear();
  }

  _terminateWorker() {
    this.worker?.terminate();
    this.worker = null;
  }

  cancelAll() {
    this._terminateWorker();
    this._rejectPending(new Error('Los trabajos de Flood Fill fueron cancelados.'));
  }
}
