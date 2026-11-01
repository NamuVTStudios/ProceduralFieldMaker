/** Historial de acciones con snapshots limitados en memoria para mapas 2D/3D. */
class HistoryManager {
  constructor(owner, options = {}) {
    this.owner = owner;
    this.maxEntries = options.maxEntries || 30;
    this.maxBytes = options.maxBytes || 64 * 1024 * 1024;
    this.undoStack = [];
    this.redoStack = [];
    this.activeTransaction = null;
    this.storedBytes = 0;
  }

  begin(label = 'Edición') {
    const created = this._createTransactionIfNeeded(label);
    this.activeTransaction.depth += 1;
    if (created) this._notifyChanged();
    return true;
  }

  _createTransactionIfNeeded(label) {
    if (this.activeTransaction) return false;
    this.activeTransaction = {
      label,
      before: this.owner.createHistorySnapshot(),
      depth: 0,
      cancelled: false,
    };
    return true;
  }

  end() {
    if (!this.activeTransaction) return false;
    this.activeTransaction.depth -= 1;
    if (this.activeTransaction.depth > 0) return false;
    return this._finishTransaction();
  }

  _finishTransaction() {
    const transaction = this.activeTransaction;
    this.activeTransaction = null;
    if (transaction.cancelled) return this._restoreCancelledTransaction(transaction);
    return this._commitCompletedTransaction(transaction);
  }

  _restoreCancelledTransaction(transaction) {
    this.owner.restoreHistorySnapshot(transaction.before);
    this._notifyChanged();
    return false;
  }

  _commitCompletedTransaction(transaction) {
    const after = this.owner.createHistorySnapshot();
    if (this.owner.areHistorySnapshotsEqual(transaction.before, after)) {
      this._notifyChanged();
      return false;
    }
    this._storeCompletedTransaction(transaction, after);
    this._notifyChanged();
    return true;
  }

  _storeCompletedTransaction(transaction, after) {
    this._clearRedoStack();
    this._storeAction(transaction.label, transaction.before, after);
  }

  cancel() {
    if (!this.activeTransaction) return false;
    this.activeTransaction.cancelled = true;
    return this.end();
  }

  run(label, callback) {
    this.begin(label);
    try {
      const result = callback();
      if (result && typeof result.then === 'function') {
        return result.then(
          value => { this.end(); return value; },
          error => { this.cancel(); throw error; },
        );
      }
      this.end();
      return result;
    } catch (error) {
      this.cancel();
      throw error;
    }
  }

  _storeAction(label, before, after) {
    const action = { label, before, after, bytes: this._estimateBytes(before) + this._estimateBytes(after) };
    this.undoStack.push(action);
    this.storedBytes += action.bytes;
    this._trimHistory();
  }

  _clearRedoStack() {
    for (const action of this.redoStack) this.storedBytes -= action.bytes;
    this.redoStack = [];
  }

  _trimHistory() {
    while (this._hasExceededHistoryLimits()) {
      const removed = this._removeOldestRetainedAction();
      if (!removed) break;
      this.storedBytes -= removed.bytes;
    }
  }

  _hasExceededHistoryLimits() {
    const retainedActions = this.undoStack.length + this.redoStack.length;
    return retainedActions > this.maxEntries || this.storedBytes > this.maxBytes;
  }

  _removeOldestRetainedAction() {
    if (this.undoStack.length) return this.undoStack.shift();
    return this.redoStack.pop() || null;
  }

  _estimateBytes(snapshot) {
    let bytes = 0;
    for (const layer of snapshot.layers) bytes += this._estimateLayerBytes(layer);
    return bytes;
  }

  _estimateLayerBytes(layer) {
    const layerBytes = layer.buffer?.byteLength || 0;
    return layerBytes + layer.masks.reduce((total, mask) => total + (mask.buffer?.byteLength || 0), 0);
  }

  undo() {
    if (this.activeTransaction || this.undoStack.length === 0) return false;
    const action = this.undoStack.pop();
    this._restoreAction(action, 'before');
    this.redoStack.push(action);
    this._notifyChanged();
    return true;
  }

  redo() {
    if (this.activeTransaction || this.redoStack.length === 0) return false;
    const action = this.redoStack.pop();
    this._restoreAction(action, 'after');
    this.undoStack.push(action);
    this._notifyChanged();
    return true;
  }

  _restoreAction(action, stateKey) {
    this.owner.restoreHistorySnapshot(action[stateKey]);
  }

  canUndo() {
    return this.undoStack.length > 0 && !this.activeTransaction;
  }

  canRedo() {
    return this.redoStack.length > 0 && !this.activeTransaction;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.activeTransaction = null;
    this.storedBytes = 0;
    this._notifyChanged();
  }

  _notifyChanged() {
    this.owner.notifyHistoryChanged();
  }
}
