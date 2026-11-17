/** Capas 2D/3D, composición con buffers intermedios y ejecución de filtros. */
class MapLayerManager {
  constructor(appManager) {
    this.appManager = appManager;
    this.history = new HistoryManager(this);
    this.mapData = null;
    this.layers = [];
    this.activeLayer = null;
    this.selectedLayerIds = new Set();
    this.lastSelectedLayerId = null;
    this.intermediateBuffers = [];
    this.finalBuffer = null;
    this.filterWorker = typeof Worker === 'function' && typeof MapFilterWorkerClient === 'function'
      ? new MapFilterWorkerClient()
      : null;
    this.maxLayers = 20;
    this._layerSequence = 0;
    this._workingMapData = null;
    this.filterQueue = Promise.resolve();
  }

  initializeProject(mapData) {
    this.clearProject();
    this._setProjectMapData(mapData);
    this._initializeBaseLayer();
  }

  _setProjectMapData(mapData) {
    this.mapData = mapData;
    this._allocateIntermediateBuffers(this._getMapBuffer(mapData).length);
  }

  _initializeBaseLayer() {
    const base = this._createBaseLayer();
    this._registerBaseLayer(base);
    this._createWorkingMapData();
  }

  _createBaseLayer() {
    const source = this._getMapBuffer(this.mapData);
    return this._createLayer('Base', source.slice());
  }

  _registerBaseLayer(layer) {
    this.layers.push(layer);
    this.activeLayer = layer;
    this._selectOnlyLayer(layer);
  }

  clearProject() {
    this.filterWorker?.cancelAll();
    this.history?.clear();
    this.layers = [];
    this.activeLayer = null;
    this.selectedLayerIds = new Set();
    this.lastSelectedLayerId = null;
    this.intermediateBuffers = [];
    this.finalBuffer = null;
    this.mapData = null;
    this._workingMapData = null;
  }

  _getMapBuffer(mapData) {
    return mapData.sizeX ? mapData.voxels : mapData.cells;
  }

  _createLayer(name, buffer) {
    this._layerSequence += 1;
    return {
      id: `layer-${this._layerSequence}`,
      name,
      buffer,
      blendMode: 'normal',
      visible: true,
      opacity: 1,
      revision: 0,
      kind: 'paint',
      materialId: null,
      sourceLayerId: null,
      filterName: null,
      filterOptions: null,
      masks: [],
      overflowContent: [],
      renderSnapshot: this.mapData?.sizeX ? buffer.slice() : null,
    };
  }

  _allocateIntermediateBuffers(length) {
    this.intermediateBuffers = [new Uint8Array(length), new Uint8Array(length)];
  }

  _createWorkingMapData() {
    this._workingMapData = { ...this.mapData };
    this._syncWorkingBuffer();
    this.compose({ render: false });
  }

  _syncWorkingBuffer() {
    if (!this._workingMapData || !this.activeLayer) return;
    this._setMapBuffer(this._workingMapData, this.activeLayer.buffer);
  }

  _setMapBuffer(mapData, buffer) {
    if (mapData.sizeX) mapData.voxels = buffer;
    else mapData.cells = buffer;
  }

  getEditableMapData() {
    if (!this.mapData || !this.activeLayer) return null;
    this._syncWorkingBuffer();
    return this._workingMapData;
  }
  getExportMapData() {
    if (!this.mapData) return null;

    this.compose({ render: false });

    const exportData = { ...this.mapData };

    if (this.mapData.sizeX) {
        exportData.voxels = this.finalBuffer.slice();
    } else {
        exportData.cells = this.finalBuffer.slice();
    }

    return exportData;
  }

  getActiveLayer() {
    return this.activeLayer;
  }

  ensureMaterialLayer(materialId) {
    return this._withHistoryAction('Cambiar capa de material', () => this._ensureMaterialLayer(materialId));
  }

  _ensureMaterialLayer(materialId) {
    if (!this._canSeparateMaterialLayers(materialId)) return null;
    if (this._activeLayerHasMaterial(materialId)) return this.activeLayer;
    if (this._canAssignMaterialToActiveLayer()) return this._assignMaterialToActiveLayer(materialId);
    return this._createMaterialLayer(materialId);
  }

  _canSeparateMaterialLayers(materialId) {
    return Boolean(this.mapData && Number.isInteger(materialId) && materialId > 0);
  }

  _activeLayerHasMaterial(materialId) {
    return this.activeLayer?.kind === 'paint' && this.activeLayer.materialId === materialId;
  }

  _canAssignMaterialToActiveLayer() {
    if (!this.activeLayer || this.activeLayer.kind !== 'paint') return false;
    if (this.activeLayer.materialId !== null) return false;
    return this.activeLayer.buffer.every(value => value === 0);
  }

  _assignMaterialToActiveLayer(materialId) {
    const layerName = this._getMaterialLayerName(materialId);
    this.activeLayer.materialId = materialId;
    this.activeLayer.name = layerName;
    this._notifyLayerPanelChanged();
    return this.activeLayer;
  }

  _createMaterialLayer(materialId) {
    if (!this._canCreateLayer()) return null;
    const layer = this._buildMaterialLayer(materialId);
    this._activateAndComposeLayer(layer);
    return layer;
  }

  _buildMaterialLayer(materialId) {
    const layer = this._createLayer(this._getMaterialLayerName(materialId), this._createEmptyLayerBuffer());
    layer.materialId = materialId;
    return layer;
  }

  _activateAndComposeLayer(layer) {
    this._addAndActivateLayer(layer);
    this.compose({ render: false });
    this._notifyLayerPanelChanged();
  }

  _getMaterialLayerName(materialId) {
    const material = (this.mapData.materials || []).find(item => item.id === materialId);
    const baseName = material?.name || `Material ${materialId}`;
    const matchingLayers = this.layers.filter(layer => layer.kind === 'paint' && layer.materialId === materialId);
    if (matchingLayers.length === 0) return baseName;
    return `${baseName} ${matchingLayers.length + 1}`;
  }

  _notifyLayerPanelChanged() {
    this.appManager.ui?.refreshLayerPanel?.();
  }

  renameLayer(layerId, name) {
    return this._withHistoryAction('Renombrar capa', () => this._renameLayer(layerId, name));
  }

  _renameLayer(layerId, name) {
    const layer = this._findLayer(layerId);
    const normalizedName = this._normalizeLayerName(name);
    if (!layer || !normalizedName) return false;
    layer.name = normalizedName;
    return true;
  }

  _normalizeLayerName(name) {
    return String(name ?? '').trim().slice(0, 64);
  }

  getLayers() {
    return this.layers.slice();
  }

  createLayer(name = '') {
    return this._withHistoryAction('Crear capa', () => this._createLayerWithName(name));
  }

  _createLayerWithName(name) {
    if (!this._canCreateLayer()) return null;
    return this._createAndActivateLayer(name);
  }

  _createAndActivateLayer(name) {
    const layer = this._createLayerDefinition(name);
    this._addAndActivateLayer(layer);
    this.compose({ render: false });
    return layer;
  }

  _createLayerDefinition(name) {
    const buffer = this._createEmptyLayerBuffer();
    const layerName = name || `Layer ${this.layers.length + 1}`;
    return this._createLayer(layerName, buffer);
  }

  _canCreateLayer() {
    return Boolean(this.mapData) && this.layers.length < this.maxLayers;
  }

  _createEmptyLayerBuffer() {
    const length = this.finalBuffer?.length || this._getMapBuffer(this.mapData).length;
    return new Uint8Array(length);
  }

  _addAndActivateLayer(layer) {
    this.layers.push(layer);
    this.activeLayer = layer;
    this._selectOnlyLayer(layer);
    this._syncWorkingBuffer();
  }

  removeLayer(layerId) {
    return this._withHistoryAction('Eliminar capa', () => this._removeLayerById(layerId));
  }

  _removeLayerById(layerId) {
    const layer = this._findLayer(layerId);
    if (!this._canRemoveLayer(layer)) return false;
    this._removeLayerAndCompose(layer);
    return true;
  }

  _canRemoveLayer(layer) {
    return Boolean(layer) && this.layers.length > 1;
  }

  _removeLayerAndCompose(layer) {
    this._removeLayerReference(layer);
    this._restoreActiveLayer(layer);
    this.compose();
  }

  _removeLayerReference(layer) {
    this.layers = this.layers.filter(item => item !== layer);
    this.selectedLayerIds.delete(layer.id);
  }

  _restoreActiveLayer(removedLayer) {
    if (this.activeLayer !== removedLayer) {
      this._ensureSelectionContainsActiveLayer();
      return this._syncWorkingBuffer();
    }
    this.activeLayer = this._findLayer(removedLayer.sourceLayerId) || this.layers[0];
    this._ensureSelectionContainsActiveLayer();
    this._syncWorkingBuffer();
  }

  setActiveLayer(layerId) {
    const layer = this._findLayer(layerId);
    if (!layer) return false;
    this.activeLayer = layer;
    this._selectOnlyLayer(layer);
    this._syncWorkingBuffer();
    this._notifyLayerPanelChanged();
    return true;
  }

  setLayerSelection(layerId, options = {}) {
    const layer = this._findLayer(layerId);
    if (!layer) return false;
    this._applyLayerSelection(layer, options);
    this._notifyLayerPanelChanged();
    return true;
  }

  _applyLayerSelection(layer, options) {
    if (options.range) return this._selectLayerRange(layer);
    if (options.toggle) return this._toggleLayerSelection(layer);
    this._selectOnlyLayer(layer);
    this.activeLayer = layer;
    this._syncWorkingBuffer();
  }

  _selectOnlyLayer(layer) {
    this.selectedLayerIds = new Set([layer.id]);
    this.lastSelectedLayerId = layer.id;
  }

  _toggleLayerSelection(layer) {
    if (this.selectedLayerIds.has(layer.id)) return this._removeLayerFromSelection(layer);
    this.selectedLayerIds.add(layer.id);
    this._setActiveLayerForSelection(layer);
  }

  _removeLayerFromSelection(layer) {
    if (this.selectedLayerIds.size <= 1) return;
    this.selectedLayerIds.delete(layer.id);
    this._setActiveLayerFromSelection();
  }

  _setActiveLayerForSelection(layer) {
    this.activeLayer = layer;
    this.lastSelectedLayerId = layer.id;
    this._syncWorkingBuffer();
  }

  _setActiveLayerFromSelection() {
    const selectedIds = Array.from(this.selectedLayerIds);
    const selected = this._findLayer(selectedIds[selectedIds.length - 1]);
    if (!selected) return;
    this.activeLayer = selected;
    this._syncWorkingBuffer();
  }

  _selectLayerRange(layer) {
    const anchorIndex = this.layers.findIndex(item => item.id === this.lastSelectedLayerId);
    const targetIndex = this.layers.indexOf(layer);
    if (anchorIndex < 0) return this._applyLayerSelection(layer, {});
    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    this.selectedLayerIds = new Set(this.layers.slice(start, end + 1).map(item => item.id));
    this.activeLayer = layer;
    this._syncWorkingBuffer();
  }

  _ensureSelectionContainsActiveLayer() {
    if (!this.activeLayer) return;
    if (this.selectedLayerIds.size > 0) return;
    this._selectOnlyLayer(this.activeLayer);
  }

  getSelectedLayers() {
    return this.layers.filter(layer => this.selectedLayerIds.has(layer.id));
  }

  selectAllLayers() {
    this.selectedLayerIds = new Set(this.layers.map(layer => layer.id));
    this._notifyLayerPanelChanged();
    return this.getSelectedLayers();
  }

  clearLayerSelection() {
    if (!this.activeLayer) return false;
    this._selectOnlyLayer(this.activeLayer);
    this._notifyLayerPanelChanged();
    return true;
  }

  translateSelectedLayers(delta) {
    return this._withHistoryAction('Mover capas', () => this._translateSelectedLayerBuffers(delta));
  }

  _translateSelectedLayerBuffers(delta) {
    const offset = this._normalizeLayerTranslation(delta);
    if (!offset) return false;
    const targets = this.getSelectedLayers();
    if (targets.length === 0) return false;
    for (const layer of targets) this._translateLayerContent(layer, offset);
    this.compose();
    this._notifyLayerPanelChanged();
    return true;
  }

  _normalizeLayerTranslation(delta) {
    if (!delta) return null;
    const offset = { x: Math.trunc(delta.x || 0), y: Math.trunc(delta.y || 0), z: Math.trunc(delta.z || 0) };
    return offset.x || offset.y || offset.z ? offset : null;
  }

  _translateLayerContent(layer, offset) {
    const moved = this._translateBufferWithOverflow(layer.buffer, layer.overflowContent, offset);
    layer.buffer = moved.buffer;
    layer.overflowContent = moved.overflow;
    this._translateLayerMasks(layer.masks, offset);
    layer.renderSnapshot = this.mapData.sizeX ? layer.buffer.slice() : null;
    layer.revision = (layer.revision || 0) + 1;
  }

  _translateLayerMasks(masks, offset) {
    for (const mask of masks || []) {
      const moved = this._translateBufferWithOverflow(mask.buffer, mask.overflowContent, offset);
      mask.buffer = moved.buffer;
      mask.overflowContent = moved.overflow;
    }
  }

  _translateBufferWithOverflow(source, overflowContent = [], offset) {
    const dimensions = this._getTranslationDimensions();
    const destination = new Uint8Array(source.length);
    const nextOverflow = [];
    this._translateVisibleEntries(source, destination, nextOverflow, offset, dimensions);
    this._translateOverflowEntries(overflowContent, destination, nextOverflow, offset, dimensions);
    return { buffer: destination, overflow: nextOverflow };
  }

  _translateVisibleEntries(source, destination, overflow, offset, dimensions) {
    for (let index = 0; index < source.length; index++) {
      this._translateVisibleEntry(source, index, destination, overflow, offset, dimensions);
    }
  }

  _translateVisibleEntry(source, index, destination, overflow, offset, dimensions) {
    const value = source[index];
    if (value === 0) return;
    const point = this._decodeBufferIndex(index, dimensions);
    this._storeTranslatedEntry(destination, overflow, point, value, offset, dimensions);
  }

  _translateOverflowEntries(entries, destination, overflow, offset, dimensions) {
    for (const entry of entries || []) {
      const point = { x: entry[0], y: entry[1], z: entry[2] };
      this._storeTranslatedEntry(destination, overflow, point, entry[3], offset, dimensions);
    }
  }

  _storeTranslatedEntry(destination, overflow, point, value, offset, dimensions) {
    const target = { x: point.x + offset.x, y: point.y + offset.y, z: point.z + offset.z };
    if (value === 0) return;
    if (!this._isTranslationTargetInBounds(target, dimensions)) {
      overflow.push([target.x, target.y, target.z, value]);
      return;
    }
    destination[this._encodeBufferIndex(target, dimensions)] = value;
  }

  _getTranslatedBufferIndex(index, offset) {
    const dimensions = this._getTranslationDimensions();
    const point = this._decodeBufferIndex(index, dimensions);
    const target = { x: point.x + offset.x, y: point.y + offset.y, z: point.z + offset.z };
    if (!this._isTranslationTargetInBounds(target, dimensions)) return -1;
    return this._encodeBufferIndex(target, dimensions);
  }

  _getTranslationDimensions() {
    return this.mapData.sizeX
      ? { width: this.mapData.sizeX, height: this.mapData.sizeY, depth: this.mapData.sizeZ, is3D: true }
      : { width: this.mapData.width, height: this.mapData.height, depth: 1, is3D: false };
  }

  _decodeBufferIndex(index, dimensions) {
    if (!dimensions.is3D) return { x: index % dimensions.width, y: Math.floor(index / dimensions.width), z: 0 };
    const planeSize = dimensions.width * dimensions.depth;
    return { x: index % dimensions.width, y: Math.floor(index / planeSize), z: Math.floor(index / dimensions.width) % dimensions.depth };
  }

  _isTranslationTargetInBounds(point, dimensions) {
    return point.x >= 0 && point.x < dimensions.width && point.y >= 0 && point.y < dimensions.height && point.z >= 0 && point.z < dimensions.depth;
  }

  _encodeBufferIndex(point, dimensions) {
    if (!dimensions.is3D) return point.y * dimensions.width + point.x;
    return (point.y * dimensions.depth + point.z) * dimensions.width + point.x;
  }

  setLayerBlendMode(layerId, blendMode) {
    if (!this._isSupportedBlendMode(blendMode)) return false;
    return this._updateLayerSetting(layerId, 'blendMode', blendMode);
  }

  _isSupportedBlendMode(blendMode) {
    return ['normal', 'multiply', 'add', 'subtract'].includes(blendMode);
  }

  setLayerOpacity(layerId, opacity) {
    const normalized = this._normalizeOpacity(opacity);
    if (normalized === null) return false;
    return this._updateLayerSetting(layerId, 'opacity', normalized);
  }

  _normalizeOpacity(opacity) {
    const value = Number(opacity);
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.min(1, value));
  }

  setLayerVisibility(layerId, visible) {
    return this._withHistoryAction('Cambiar visibilidad de capa', () => this._setLayerVisibilityById(layerId, visible));
  }

  _setLayerVisibilityById(layerId, visible) {
    const layer = this._findLayer(layerId);
    if (!layer) return false;
    this._setLayerVisibility(layer, visible);
    this.compose();
    return true;
  }

  _setLayerVisibility(layer, visible) {
    layer.visible = Boolean(visible);
    this._restoreActiveLayerIfHidden(layer);
  }

  _restoreActiveLayerIfHidden(layer) {
    if (layer.visible || this.activeLayer !== layer) return;
    const sourceLayer = this._findLayer(layer.sourceLayerId);
    this.activeLayer = sourceLayer?.visible ? sourceLayer : this._getVisibleFallback(layer);
    this._selectOnlyLayer(this.activeLayer);
    this._syncWorkingBuffer();
  }

  _getVisibleFallback(hiddenLayer) {
    return this.layers.find(layer => layer !== hiddenLayer && layer.visible) || this.layers[0] || null;
  }

  _updateLayerSetting(layerId, property, value) {
    return this._withHistoryAction(`Cambiar ${property} de capa`, () => this._applyLayerSetting(layerId, property, value));
  }

  _applyLayerSetting(layerId, property, value) {
    const layer = this._findLayer(layerId);
    if (!layer) return false;
    layer[property] = value;
    this.compose();
    return true;
  }

  reorderLayer(layerId, targetIndex) {
    return this._withHistoryAction('Reordenar capas', () => this._reorderLayerById(layerId, targetIndex));
  }

  _reorderLayerById(layerId, targetIndex) {
    const sourceIndex = this.layers.findIndex(layer => layer.id === layerId);
    if (sourceIndex < 0) return false;
    this._reorderAndCompose(sourceIndex, targetIndex);
    return true;
  }

  _reorderAndCompose(sourceIndex, targetIndex) {
    this._moveLayer(sourceIndex, targetIndex);
    this.compose();
  }

  _moveLayer(sourceIndex, targetIndex) {
    const boundedIndex = Math.max(0, Math.min(this.layers.length - 1, Number(targetIndex) || 0));
    const [layer] = this.layers.splice(sourceIndex, 1);
    this.layers.splice(boundedIndex, 0, layer);
  }

  _findLayer(layerId) {
    return this.layers.find(layer => layer.id === layerId) ?? null;
  }

  beginHistoryTransaction(label) {
    return this.history.begin(label);
  }

  endHistoryTransaction() {
    return this.history.end();
  }

  cancelHistoryTransaction() {
    return this.history.cancel();
  }

  undo() {
    return this.history.undo();
  }

  redo() {
    return this.history.redo();
  }

  canUndo() {
    return this.history.canUndo();
  }

  canRedo() {
    return this.history.canRedo();
  }

  _withHistoryAction(label, callback) {
    return this.history.run(label, callback);
  }

  notifyHistoryChanged() {
    this.appManager.ui?.refreshHistoryControls?.();
  }

  createHistorySnapshot() {
    return {
      layerSequence: this._layerSequence,
      activeLayerId: this.activeLayer?.id || null,
      selectedLayerIds: Array.from(this.selectedLayerIds),
      dimensions: this._getDimensionSnapshot(),
      layers: this.layers.map(layer => this._cloneLayerForHistory(layer)),
    };
  }

  _cloneLayerForHistory(layer) {
    return {
      id: layer.id,
      name: layer.name,
      buffer: layer.buffer.slice(),
      overflowContent: (layer.overflowContent || []).map(entry => entry.slice()),
      blendMode: layer.blendMode,
      visible: layer.visible,
      opacity: layer.opacity,
      revision: layer.revision || 0,
      kind: layer.kind,
      materialId: layer.materialId,
      sourceLayerId: layer.sourceLayerId,
      filterName: layer.filterName,
      filterOptions: this._cloneHistoryValue(layer.filterOptions),
      masks: (layer.masks || []).map(mask => this._cloneMaskForHistory(mask)),
    };
  }

  _cloneMaskForHistory(mask) {
    return { ...mask, options: this._cloneHistoryValue(mask.options), buffer: mask.buffer.slice(), overflowContent: (mask.overflowContent || []).map(entry => entry.slice()) };
  }

  _cloneHistoryValue(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  areHistorySnapshotsEqual(first, second) {
    if (first.layerSequence !== second.layerSequence) return false;
    if (JSON.stringify(first.dimensions) !== JSON.stringify(second.dimensions)) return false;
    if (first.activeLayerId !== second.activeLayerId || first.layers.length !== second.layers.length) return false;
    if (JSON.stringify(first.selectedLayerIds || []) !== JSON.stringify(second.selectedLayerIds || [])) return false;
    return first.layers.every((layer, index) => this._areHistoryLayersEqual(layer, second.layers[index]));
  }

  _areHistoryLayersEqual(first, second) {
    if (!this._areLayerMetadataEqual(first, second)) return false;
    if (!this._areBuffersEqual(first.buffer, second.buffer)) return false;
    if (JSON.stringify(first.overflowContent || []) !== JSON.stringify(second.overflowContent || [])) return false;
    return this._areMasksEqual(first.masks, second.masks);
  }

  _areLayerMetadataEqual(first, second) {
    const keys = ['id', 'name', 'blendMode', 'visible', 'opacity', 'revision', 'kind', 'materialId', 'sourceLayerId', 'filterName'];
    return keys.every(key => first[key] === second[key]) &&
      JSON.stringify(first.filterOptions) === JSON.stringify(second.filterOptions);
  }

  _areMasksEqual(first, second) {
    if (first.length !== second.length) return false;
    return first.every((mask, index) => this._areMasksAtIndexEqual(mask, second[index]));
  }

  _areMasksAtIndexEqual(first, second) {
    if (first.id !== second.id || first.name !== second.name || first.type !== second.type || first.enabled !== second.enabled) return false;
    if (first.filterName !== second.filterName || JSON.stringify(first.options) !== JSON.stringify(second.options)) return false;
    return this._areBuffersEqual(first.buffer, second.buffer) && JSON.stringify(first.overflowContent || []) === JSON.stringify(second.overflowContent || []);
  }

  _areBuffersEqual(first, second) {
    if (first.length !== second.length) return false;
    return first.every((value, index) => value === second[index]);
  }

  resizeCanvas(dimensions) {
    return this._withHistoryAction('Cambiar tamaño del lienzo', () => this._resizeCanvas(dimensions));
  }

  _resizeCanvas(dimensions) {
    this._assertProjectCanResize();
    const plan = this._createResizePlan(dimensions);
    if (!plan.changed) return false;
    return this._applyResizePlan(plan);
  }

  _assertProjectCanResize() {
    if (!this.mapData || !this.layers.length) throw new Error('No hay un lienzo abierto.');
  }

  _createResizePlan(dimensions) {
    const next = this._validateCanvasDimensions(dimensions);
    const current = this._getDimensionSnapshot();
    return { current, next, changed: JSON.stringify(next) !== JSON.stringify(current) };
  }

  _applyResizePlan(plan) {
    this._resizeAllLayerBuffers(plan.current, plan.next);
    this._applyDimensionSnapshot(plan.next);
    this._rebuildBuffersAfterResize();
    return true;
  }

  _validateCanvasDimensions(dimensions) {
    if (!this.mapData.sizeX) return this._validate2DDimensions(dimensions);
    return this._validate3DDimensions(dimensions);
  }

  _validate2DDimensions(dimensions) {
    const width = Math.floor(Number(dimensions.width));
    const height = Math.floor(Number(dimensions.height));
    if (!Number.isFinite(width) || !Number.isFinite(height)) throw new TypeError('El ancho y el alto deben ser números válidos.');
    if (width < 16 || height < 16 || width > 4096 || height > 4096 || width * height > 4194304) {
      throw new RangeError('El lienzo 2D admite entre 16 y 4096 celdas por eje, con un máximo de 4.194.304 celdas.');
    }
    return { width, height };
  }

  _validate3DDimensions(dimensions) {
    const sizeX = Math.floor(Number(dimensions.sizeX));
    const sizeY = Math.floor(Number(dimensions.sizeY));
    const sizeZ = Math.floor(Number(dimensions.sizeZ));
    if (![sizeX, sizeY, sizeZ].every(Number.isFinite)) throw new TypeError('Los tres ejes deben ser números válidos.');
    return this._validate3DVolume(sizeX, sizeY, sizeZ);
  }

  _validate3DVolume(sizeX, sizeY, sizeZ) {
    const volume = sizeX * sizeY * sizeZ;
    if ([sizeX, sizeY, sizeZ].some(value => value < 8 || value > 512) || volume > 4194304) {
      throw new RangeError('El lienzo 3D admite entre 8 y 512 vóxeles por eje, con un volumen máximo de 4.194.304 vóxeles.');
    }
    return { sizeX, sizeY, sizeZ };
  }

  _getExpectedMapBufferLength() {
    if (this.mapData.sizeX) return this.mapData.sizeX * this.mapData.sizeY * this.mapData.sizeZ;
    return this.mapData.width * this.mapData.height;
  }

  _getDimensionSnapshot() {
    if (this.mapData.sizeX) return { sizeX: this.mapData.sizeX, sizeY: this.mapData.sizeY, sizeZ: this.mapData.sizeZ };
    return { width: this.mapData.width, height: this.mapData.height };
  }

  _restoreDimensionSnapshot(dimensions) {
    if (!dimensions) return;
    this._applyDimensionSnapshot(dimensions);
  }

  _applyDimensionSnapshot(dimensions) {
    Object.assign(this.mapData, dimensions);
  }

  _resizeAllLayerBuffers(current, next) {
    for (const layer of this.layers) this._resizeLayerBuffers(layer, current, next);
  }

  _resizeLayerBuffers(layer, current, next) {
    const resized = this._resizeBufferWithOverflow(layer.buffer, layer.overflowContent, current, next);
    layer.buffer = resized.buffer;
    layer.overflowContent = resized.overflow;
    layer.masks = this._resizeLayerMasks(layer.masks, current, next);
    this._refreshResizedLayerMetadata(layer);
  }

  _resizeLayerMasks(masks, current, next) {
    return (masks || []).map(mask => this._resizeMaskWithOverflow(mask, current, next));
  }

  _resizeMaskWithOverflow(mask, current, next) {
    const resized = this._resizeBufferWithOverflow(mask.buffer, mask.overflowContent, current, next);
    return { ...mask, buffer: resized.buffer, overflowContent: resized.overflow };
  }

  _resizeBufferWithOverflow(source, overflowContent = [], current, next) {
    const currentDimensions = this._describeDimensions(current);
    const nextDimensions = this._describeDimensions(next);
    const targetLength = this._getBufferLength(nextDimensions);
    const destination = new Uint8Array(targetLength);
    const nextOverflow = [];
    this._resizeVisibleEntries(source, destination, nextOverflow, currentDimensions, nextDimensions);
    this._resizeOverflowEntries(overflowContent, destination, nextOverflow, nextDimensions);
    return { buffer: destination, overflow: nextOverflow };
  }

  _describeDimensions(dimensions) {
    if (dimensions.width) return { width: dimensions.width, height: dimensions.height, depth: 1, is3D: false };
    return { width: dimensions.sizeX, height: dimensions.sizeY, depth: dimensions.sizeZ, is3D: true };
  }

  _getBufferLength(dimensions) {
    return dimensions.width * dimensions.height * dimensions.depth;
  }

  _resizeVisibleEntries(source, destination, overflow, current, next) {
    for (let index = 0; index < source.length; index++) {
      this._resizeVisibleEntry(source, index, destination, overflow, current, next);
    }
  }

  _resizeVisibleEntry(source, index, destination, overflow, current, next) {
    const value = source[index];
    if (value === 0) return;
    const point = this._decodeBufferIndex(index, current);
    this._storeResizedEntry(destination, overflow, point, value, next);
  }

  _resizeOverflowEntries(entries, destination, overflow, dimensions) {
    for (const entry of entries || []) {
      const point = { x: entry[0], y: entry[1], z: entry[2] };
      this._storeResizedEntry(destination, overflow, point, entry[3], dimensions);
    }
  }

  _storeResizedEntry(destination, overflow, point, value, dimensions) {
    if (!this._isTranslationTargetInBounds(point, dimensions)) {
      overflow.push([point.x, point.y, point.z, value]);
      return;
    }
    destination[this._encodeBufferIndex(point, dimensions)] = value;
  }

  _refreshResizedLayerMetadata(layer) {
    layer.renderSnapshot = this.mapData.sizeX ? layer.buffer.slice() : null;
    layer.revision = (layer.revision || 0) + 1;
  }

  _resizeBuffer(source, current, next) {
    return current.width
      ? this._resize2DBuffer(source, current, next)
      : this._resize3DBuffer(source, current, next);
  }

  _resize2DBuffer(source, current, next) {
    const target = new Uint8Array(next.width * next.height);
    const rows = Math.min(current.height, next.height);
    const columns = Math.min(current.width, next.width);
    this._copy2DRows(source, target, current.width, next.width, rows, columns);
    return target;
  }

  _copy2DRows(source, target, sourceWidth, targetWidth, rows, columns) {
    for (let y = 0; y < rows; y++) {
      target.set(source.subarray(y * sourceWidth, y * sourceWidth + columns), y * targetWidth);
    }
  }

  _resize3DBuffer(source, current, next) {
    const target = new Uint8Array(next.sizeX * next.sizeY * next.sizeZ);
    const rows = Math.min(current.sizeY, next.sizeY);
    const depths = Math.min(current.sizeZ, next.sizeZ);
    const columns = Math.min(current.sizeX, next.sizeX);
    this._copy3DRows(source, target, current, next, rows, depths, columns);
    return target;
  }

  _copy3DRows(source, target, current, next, rows, depths, columns) {
    for (let y = 0; y < rows; y++) this._copy3DDepthSlices(source, target, current, next, y, depths, columns);
  }

  _copy3DDepthSlices(source, target, current, next, y, depths, columns) {
    for (let z = 0; z < depths; z++) {
      const sourceStart = (y * current.sizeZ + z) * current.sizeX;
      const targetStart = (y * next.sizeZ + z) * next.sizeX;
      target.set(source.subarray(sourceStart, sourceStart + columns), targetStart);
    }
  }

  _rebuildBuffersAfterResize() {
    this._resetWorkingBufferForCurrentDimensions();
    this.compose({ render: false });
    this._notifyResizeComplete();
  }

  _notifyResizeComplete() {
    this._notifyCanvasDimensionsChanged();
    this._notifyLayerPanelChanged();
  }

  _resetWorkingBufferForCurrentDimensions() {
    const length = this.activeLayer?.buffer.length || this._getExpectedMapBufferLength();
    this._allocateIntermediateBuffers(length);
    this._workingMapData = { ...this.mapData };
    this._syncWorkingBuffer();
  }

  _notifyCanvasDimensionsChanged() {
    const renderer = this.appManager.renderer;
    if (typeof renderer?.onMapDimensionsChanged === 'function') renderer.onMapDimensionsChanged();
    else this._renderComposedMap();
    this.appManager.ui?.refreshCanvasSizePanel?.();
  }

  restoreHistorySnapshot(snapshot) {
    this._restoreDimensionSnapshot(snapshot.dimensions);
    this._restoreSnapshotLayers(snapshot.layers);
    this._restoreSnapshotMetadata(snapshot);
    this._restoreSnapshotActiveLayer(snapshot.activeLayerId);
    this._restoreSnapshotSelection(snapshot.selectedLayerIds || [snapshot.activeLayerId]);
    this._refreshRestoredProject();
  }

  _restoreSnapshotLayers(layers) {
    this.layers = layers.map(layer => this._restoreLayerFromHistory(layer));
  }

  _restoreSnapshotMetadata(snapshot) {
    this._layerSequence = snapshot.layerSequence;
  }

  _restoreSnapshotActiveLayer(layerId) {
    this.activeLayer = this.layers.find(layer => layer.id === layerId) || this.layers[0] || null;
  }

  _restoreSnapshotSelection(layerIds) {
    const validIds = layerIds.filter(id => this._findLayer(id));
    this.selectedLayerIds = new Set(validIds);
    this._ensureSelectionContainsActiveLayer();
  }

  _refreshRestoredProject() {
    this._resetWorkingBufferForCurrentDimensions();
    this.compose({ render: false });
    this._notifyResizeComplete();
  }

  _restoreLayerFromHistory(snapshot) {
    const layer = { ...snapshot, buffer: snapshot.buffer.slice(), overflowContent: (snapshot.overflowContent || []).map(entry => entry.slice()) };
    layer.masks = snapshot.masks.map(mask => this._cloneMaskForHistory(mask));
    layer.renderSnapshot = this.mapData?.sizeX ? layer.buffer.slice() : null;
    return layer;
  }

  /** Excavación manual uniforme: conserva la herramienta Excavar. */
  eraseVisibleTerrain(center, radius, impactEnergy) {
    return this._withHistoryAction('Excavar terreno', () => this._damageTerrainInRadius(center, radius, impactEnergy, 0));
  }

  /** API de juego: explosión radial con reducción de energía por distancia. */
  explodeTerrain(center, options = {}) {
    const radius = this._normalizeDamageRadius(options.radius, 5);
    const energy = this._normalizeDamageEnergy(options.energy, 8);
    const falloff = this._normalizeDamageFalloff(options.falloff, 0.55);
    return this._withHistoryAction('Explosión de terreno', () => this._damageTerrainInRadius(center, radius, energy, falloff));
  }

  /** API de juego: impacto puntual de proyectil o cuerpo rígido. */
  applyProjectileImpact(center, options = {}) {
    const radius = this._normalizeDamageRadius(options.radius, 2.5);
    const energy = this._normalizeDamageEnergy(options.energy, 7);
    const falloff = this._normalizeDamageFalloff(options.falloff, 0.7);
    return this._withHistoryAction('Impacto sobre terreno', () => this._damageTerrainInRadius(center, radius, energy, falloff));
  }

  /** API de juego: perfora una cápsula entre dos puntos (taladro, rayo o túnel). */
  drillTerrain(start, end, options = {}) {
    const radius = this._normalizeDamageRadius(options.radius, 1.5);
    const energy = this._normalizeDamageEnergy(options.energy, 10);
    const falloff = this._normalizeDamageFalloff(options.falloff, 0.25);
    return this._withHistoryAction('Perforación de terreno', () => this._damageTerrainAlongSegment(start, end, radius, energy, falloff));
  }

  damageTerrain(center, options = {}) {
    return this.explodeTerrain(center, options);
  }

  _normalizeDamageRadius(value, fallback) {
    const radius = Number(value);
    return Number.isFinite(radius) ? Math.max(0.5, Math.min(128, radius)) : fallback;
  }

  _normalizeDamageEnergy(value, fallback) {
    const energy = Number(value);
    return Number.isFinite(energy) ? Math.max(0, Math.min(1000, energy)) : fallback;
  }

  _normalizeDamageFalloff(value, fallback) {
    const falloff = Number(value);
    return Number.isFinite(falloff) ? Math.max(0, Math.min(1, falloff)) : fallback;
  }

  _damageTerrainInRadius(center, radius, energy, falloff) {
    if (!this._canDamageTerrain()) return { changedCount: 0 };
    const context = this._createTerrainEraseContext(energy, falloff);
    this._iterateDamageRadius(context, center, radius);
    return this._finalizeTerrainDamage(context);
  }

  _iterateDamageRadius(context, center, radius) {
    this.appManager.destructionEngine.forEachCellInRadius(
      this.mapData, center, radius,
      (x, y, z, ratio) => this._eraseTopVisibleLayerAt(context, x, y, z, ratio)
    );
  }

  _damageTerrainAlongSegment(start, end, radius, energy, falloff) {
    if (!this._canDamageTerrain()) return { changedCount: 0 };
    const context = this._createTerrainEraseContext(energy, falloff);
    this._iterateDamageSegment(context, start, end, radius);
    return this._finalizeTerrainDamage(context);
  }

  _iterateDamageSegment(context, start, end, radius) {
    this.appManager.destructionEngine.forEachCellInCapsule(
      this.mapData, start, end, radius,
      (x, y, z, ratio) => this._eraseTopVisibleLayerAt(context, x, y, z, ratio)
    );
  }

  _canDamageTerrain() {
    return Boolean(this.mapData && this.layers.length);
  }

  _createTerrainEraseContext(impactEnergy, falloff = 0) {
    return {
      impactEnergy,
      falloff,
      changedCount: 0,
      touchedLayers: new Set(),
      dirtyChunks: new Set(),
      is3D: Boolean(this.mapData.sizeX),
    };
  }

  _eraseTopVisibleLayerAt(context, x, y, z, distanceRatio = 0) {
    const target = this._resolveDamageTarget(context, x, y, z, distanceRatio);
    if (!target) return;
    this._applyDamageTarget(target, context);
  }

  _resolveDamageTarget(context, x, y, z, distanceRatio) {
    const bufferIndex = this._getBufferIndex(x, y, z, context.is3D);
    const target = this._findTopVisibleMaterialLayer(bufferIndex);
    if (!target) return null;
    if (!this._canDamageTargetAtDistance(target, context, distanceRatio)) return null;
    return { ...target, bufferIndex };
  }

  _canDamageTargetAtDistance(target, context, distanceRatio) {
    const energy = this._getEnergyAtDistance(context, distanceRatio);
    return this._canEraseVisibleMaterial(target.materialId, energy);
  }

  _applyDamageTarget(target, context) {
    this._clearLayerMaterialAt(target.layer, target.bufferIndex);
    this._recordTerrainErase(target.layer, target.bufferIndex, context);
  }

  _getEnergyAtDistance(context, distanceRatio) {
    const attenuation = 1 - context.falloff * Math.min(1, distanceRatio);
    return context.impactEnergy * attenuation;
  }

  _finalizeTerrainDamage(context) {
    this._finalizeTerrainErase(context);
    return { changedCount: context.changedCount, dirtyChunks: new Set(context.dirtyChunks) };
  }

  _getBufferIndex(x, y, z, is3D) {
    if (is3D) return getVoxelIndex3D(this.mapData, x, y, z);
    return getCellIndex2D(this.mapData, x, y);
  }

  _findTopVisibleMaterialLayer(bufferIndex) {
    const reversedLayers = this.layers.slice().reverse();
    return reversedLayers
      .map(layer => this._getVisibleLayerMaterial(layer, bufferIndex))
      .find(Boolean) || null;
  }

  _getVisibleLayerMaterial(layer, bufferIndex) {
    if (!layer.visible || layer.opacity <= 0) return null;
    if (layer.blendMode === 'normal' && layer.opacity < 0.5) return null;
    const materialId = this._getEffectiveLayerBuffer(layer)[bufferIndex];
    if (materialId === AIR_MATERIAL_ID) return null;
    return { layer, materialId };
  }

  _canEraseVisibleMaterial(materialId, impactEnergy) {
    const material = (this.mapData.materials || []).find(item => item.id === materialId);
    if (!material || !material.destructible) return false;
    return impactEnergy >= Number(material.hardness ?? 1);
  }

  _clearLayerMaterialAt(layer, bufferIndex) {
    layer.buffer[bufferIndex] = AIR_MATERIAL_ID;
    this._clearFilterMaskVoxel(layer, bufferIndex);
  }

  _clearFilterMaskVoxel(layer, bufferIndex) {
    for (const mask of layer.masks || []) mask.buffer[bufferIndex] = AIR_MATERIAL_ID;
  }

  _recordTerrainErase(layer, bufferIndex, context) {
    layer.revision = (layer.revision || 0) + 1;
    context.touchedLayers.add(layer);
    context.changedCount += 1;
    this._collectEraseDirtyChunks(bufferIndex, context);
  }

  _collectEraseDirtyChunks(bufferIndex, context) {
    if (!context.is3D) return;
    this._addChangedVoxelChunks(
      bufferIndex,
      context.dirtyChunks,
      this.mapData.sizeX,
      this.mapData.sizeZ,
      this.mapData.chunkSize || 16
    );
  }

  _finalizeTerrainErase(context) {
    if (context.changedCount === 0) return;
    this._refreshErasedLayerSnapshots(context.touchedLayers);
    this.compose({ render: false });
    this._renderCommittedChanges(context.is3D ? context.dirtyChunks : null);
    this._notifyLayerPanelChanged();
  }

  _refreshErasedLayerSnapshots(layers) {
    for (const layer of layers) layer.renderSnapshot = layer.buffer.slice();
  }

  commitChanges({ render = true } = {}) {
    if (!this.mapData || !this.activeLayer) return false;
    const dirtyChunks = this._collectDirtyChunkKeys(this.activeLayer);
    this._markActiveLayerChanged();
    this.compose({ render: false });
    if (render) this._renderCommittedChanges(dirtyChunks);
    return true;
  }

  _collectDirtyChunkKeys(layer) {
    if (!this.mapData.sizeX) return null;
    const dirtyChunks = new Set();
    const previous = layer.renderSnapshot || new Uint8Array(layer.buffer.length);
    const sizeX = this.mapData.sizeX;
    const sizeZ = this.mapData.sizeZ;
    const chunkSize = this.mapData.chunkSize || 16;
    for (let index = 0; index < layer.buffer.length; index++) {
      this._collectChangedVoxel(index, layer, previous, dirtyChunks, sizeX, sizeZ, chunkSize);
    }
    layer.renderSnapshot = layer.buffer.slice();
    return dirtyChunks;
  }

  _collectChangedVoxel(index, layer, previous, dirtyChunks, sizeX, sizeZ, chunkSize) {
    if (previous[index] === layer.buffer[index]) return;
    this._addChangedVoxelChunks(index, dirtyChunks, sizeX, sizeZ, chunkSize);
  }

  _addChangedVoxelChunks(index, dirtyChunks, sizeX, sizeZ, chunkSize) {
    const x = index % sizeX;
    const z = Math.floor(index / sizeX) % sizeZ;
    const y = Math.floor(index / (sizeX * sizeZ));
    const cx = Math.floor(x / chunkSize);
    const cy = Math.floor(y / chunkSize);
    const cz = Math.floor(z / chunkSize);
    this._addVoxelChunkAndNeighbors(dirtyChunks, { x, y, z, cx, cy, cz, sizeX, sizeY: this.mapData.sizeY, sizeZ, chunkSize });
  }

  _addVoxelChunkAndNeighbors(target, voxel) {
    const { x, y, z, cx, cy, cz, sizeX, sizeY, sizeZ, chunkSize } = voxel;
    const maxChunks = {
      x: Math.ceil(sizeX / chunkSize),
      y: Math.ceil(sizeY / chunkSize),
      z: Math.ceil(sizeZ / chunkSize),
    };
    this._addChunkKey(target, cx, cy, cz, maxChunks);
    if (x % chunkSize === 0) this._addChunkKey(target, cx - 1, cy, cz, maxChunks);
    if (x % chunkSize === chunkSize - 1) this._addChunkKey(target, cx + 1, cy, cz, maxChunks);
    if (y % chunkSize === 0) this._addChunkKey(target, cx, cy - 1, cz, maxChunks);
    if (y % chunkSize === chunkSize - 1) this._addChunkKey(target, cx, cy + 1, cz, maxChunks);
    if (z % chunkSize === 0) this._addChunkKey(target, cx, cy, cz - 1, maxChunks);
    if (z % chunkSize === chunkSize - 1) this._addChunkKey(target, cx, cy, cz + 1, maxChunks);
  }

  _addChunkKey(target, cx, cy, cz, limits) {
    if (cx < 0 || cy < 0 || cz < 0) return;
    if (cx >= limits.x || cy >= limits.y || cz >= limits.z) return;
    target.add(`${cx}_${cy}_${cz}`);
  }

  _renderCommittedChanges(dirtyChunks) {
    if (!this.mapData.sizeX || !dirtyChunks) return this._renderComposedMap();
    const renderer = this.appManager.renderer;
    if (typeof renderer?.renderDirtyChunks === 'function') {
      renderer.renderDirtyChunks(this.mapData, dirtyChunks);
      return;
    }
    this._renderComposedMap();
  }

  _markActiveLayerChanged() {
    this.activeLayer.revision = (this.activeLayer.revision || 0) + 1;
  }

  compose({ render = true } = {}) {
    if (!this.mapData || this.layers.length === 0) return false;
    const result = this._buildComposition();
    this._publishComposition(result, render);
    return true;
  }

  _buildComposition() {
    return this._composeVisibleLayers(this._getVisibleLayers());
  }

  _publishComposition(buffer, render) {
    this._publishFinalBuffer(buffer);
    if (render) this._renderComposedMap();
  }

  _getVisibleLayers() {
    const visibleLayers = this.layers.filter(layer => layer.visible && layer.opacity > 0);
    const replacedSourceIds = this._getReplacedSourceIds(visibleLayers);
    return visibleLayers.filter(layer => !replacedSourceIds.has(layer.id));
  }

  _getReplacedSourceIds(visibleLayers) {
    const sourceIds = new Set();
    for (const layer of visibleLayers) this._collectReplacedSourceId(layer, sourceIds);
    return sourceIds;
  }

  _collectReplacedSourceId(layer, sourceIds) {
    if (layer.kind !== 'filter' || layer.opacity < 0.5) return;
    if (layer.sourceLayerId) sourceIds.add(layer.sourceLayerId);
  }

  _publishFinalBuffer(buffer) {
    this.finalBuffer = buffer;
    this._setMapBuffer(this.mapData, buffer);
    this._syncWorkingBuffer();
  }

  _composeVisibleLayers(layers) {
    const first = layers[0];
    const initial = this.intermediateBuffers[0];
    if (!first) return this._clearBuffer(initial);
    this._copyLayerToBuffer(first, initial);
    return this._blendRemainingLayers(layers, initial, 1);
  }

  _copyLayerToBuffer(layer, destination) {
    const mask = this._getEnabledFilterMask(layer);
    destination.set(mask ? mask.buffer : layer.buffer);
  }

  _clearBuffer(buffer) {
    buffer.fill(0);
    return buffer;
  }

  _blendRemainingLayers(layers, source, layerIndex) {
    let currentBuffer = source;
    for (let index = layerIndex; index < layers.length; index++) {
      const destination = this._getAlternateBuffer(currentBuffer);
      this._blendLayerInto(currentBuffer, layers[index], destination);
      currentBuffer = destination;
    }
    return currentBuffer;
  }

  _getAlternateBuffer(source) {
    return source === this.intermediateBuffers[0] ? this.intermediateBuffers[1] : this.intermediateBuffers[0];
  }

  _blendLayerInto(baseBuffer, layer, destination) {
    for (let index = 0; index < baseBuffer.length; index++) {
      const sourceId = this._getLayerPixel(layer, index);
      destination[index] = this._blendMaterial(baseBuffer[index], sourceId, layer);
    }
  }

  _getEffectiveLayerBuffer(layer) {
    const mask = this._getEnabledFilterMask(layer);
    return mask ? mask.buffer : layer.buffer;
  }

  _getLayerPixel(layer, index) {
    const mask = this._getEnabledFilterMask(layer);
    if (!mask) return layer.buffer[index];
    return mask.buffer[index];
  }

  _getEnabledFilterMask(layer) {
    const masks = (layer.masks || []).filter(mask => mask.enabled && mask.type === 'filter');
    return masks[masks.length - 1] || null;
  }

  setLayerMaskEnabled(layerId, maskId, enabled) {
    return this._withHistoryAction('Cambiar máscara', () => this._setLayerMaskEnabled(layerId, maskId, enabled));
  }

  _setLayerMaskEnabled(layerId, maskId, enabled) {
    const layer = this._findLayer(layerId);
    const mask = layer?.masks?.find(item => item.id === maskId);
    if (!mask) return false;
    mask.enabled = Boolean(enabled);
    this.compose();
    this._notifyLayerPanelChanged();
    return true;
  }

  removeLayerMask(layerId, maskId) {
    return this._withHistoryAction('Eliminar máscara', () => this._removeLayerMask(layerId, maskId));
  }

  _removeLayerMask(layerId, maskId) {
    const layer = this._findLayer(layerId);
    if (!layer?.masks) return false;
    const remaining = layer.masks.filter(mask => mask.id !== maskId);
    if (remaining.length === layer.masks.length) return false;
    layer.masks = remaining;
    this.compose();
    this._notifyLayerPanelChanged();
    return true;
  }

  _blendMaterial(baseId, sourceId, layer) {
    if (sourceId === 0) return baseId;
    if (layer.blendMode === 'add') return this._blendAdd(baseId, sourceId, layer.opacity);
    if (layer.blendMode === 'subtract') return this._blendSubtract(baseId, sourceId, layer.opacity);
    if (layer.blendMode === 'multiply') return this._blendMultiply(baseId, sourceId, layer.opacity);
    return layer.opacity < 0.5 ? baseId : sourceId;
  }

  _blendAdd(baseId, sourceId, opacity) {
    return Math.min(255, Math.round(baseId + sourceId * opacity));
  }

  _blendSubtract(baseId, sourceId, opacity) {
    return Math.max(0, Math.round(baseId - sourceId * opacity));
  }

  _blendMultiply(baseId, sourceId, opacity) {
    const maximum = this._getMaximumMaterialId();
    const factor = 1 - opacity + (sourceId / maximum) * opacity;
    return Math.max(0, Math.min(255, Math.round(baseId * factor)));
  }

  _getMaximumMaterialId() {
    const ids = (this.mapData.materials || []).map(material => material.id);
    return Math.max(1, ...ids);
  }

  _renderComposedMap() {
    const renderer = this.appManager.renderer;
    if (!renderer) return;
    if (typeof renderer.renderFullMap === 'function') renderer.renderFullMap(this.mapData);
    else renderer.renderFullMap3D?.(this.mapData);
  }

  applyFilter(filterName, options = {}) {
    const request = this._normalizeFilterRequest(options);
    const operation = this.filterQueue.then(() => this._runFilter(filterName, request.options, request.mode));
    this.filterQueue = operation.catch(() => false);
    return operation;
  }

  _normalizeFilterRequest(options) {
    const { mode, ...filterOptions } = options;
    return {
      mode: mode === 'non-destructive' ? 'non-destructive' : 'destructive',
      options: filterOptions,
    };
  }

  _runFilter(filterName, options, mode) {
    return this._withHistoryAction(`Aplicar filtro ${filterName}`, () => this._runFilterOperation(filterName, options, mode));
  }

  async _runFilterOperation(filterName, options, mode) {
    const context = this._createFilterContext();
    if (!context) return false;
    const result = await this._executeFilter(filterName, context.source, context.mapData, options);
    return this._commitFilterResult(context, result, filterName, options, mode);
  }

  _createFilterContext() {
    if (!this.activeLayer || !this.mapData) return null;
    return {
      layer: this.activeLayer,
      mapData: this.mapData,
      revision: this.activeLayer.revision || 0,
      source: this._getEffectiveLayerBuffer(this.activeLayer).slice(),
    };
  }

  _commitFilterResult(context, result, filterName, options, mode) {
    if (!this._isFilterContextCurrent(context)) return false;
    if (mode === 'non-destructive') return this._commitNonDestructiveFilter(context, result, filterName, options);
    return this._commitDestructiveFilter(context, result);
  }

  _commitDestructiveFilter(context, result) {
    context.layer.buffer.set(result);
    this._removeBakedFilterMasks(context.layer);
    this.commitChanges();
    this._notifyLayerPanelChanged();
    return true;
  }

  _removeBakedFilterMasks(layer) {
    layer.masks = (layer.masks || []).filter(mask => mask.type !== 'filter');
  }

  _commitNonDestructiveFilter(context, result, filterName, options) {
    const mask = this._createFilterMask(result, filterName, options);
    context.layer.masks = [...(context.layer.masks || []), mask];
    context.layer.revision = (context.layer.revision || 0) + 1;
    this.compose();
    this._notifyLayerPanelChanged();
    return true;
  }

  _createFilterMask(result, filterName, options) {
    return {
      id: `mask-${++this._layerSequence}`,
      name: `${this._getFilterLabel(filterName)} · Máscara`,
      type: 'filter',
      enabled: true,
      filterName,
      options: { ...options },
      buffer: result.slice(),
      overflowContent: [],
    };
  }

  _getFilterLabel(filterName) {
    const labels = { 'gaussian-blur': 'Desenfoque gaussiano', threshold: 'Umbral' };
    return labels[filterName] || filterName;
  }

  _isFilterContextCurrent(context) {
    if (this.mapData !== context.mapData || !this.layers.includes(context.layer)) return false;
    if (this.activeLayer !== context.layer) return false;
    return (context.layer.revision || 0) === context.revision;
  }

  async _executeFilter(filterName, source, mapData, options) {
    if (!this.filterWorker) return this._applyFilterLocally(filterName, source, mapData, options);
    return this._executeFilterInWorker(filterName, source, mapData, options);
  }

  async _executeFilterInWorker(filterName, source, mapData, options) {
    try {
      return await this.filterWorker.apply(filterName, source, mapData, options);
    } catch (error) {
      console.warn('Filter Worker fallback:', error);
      return this._applyFilterLocally(filterName, source, mapData, options);
    }
  }

  _applyFilterLocally(filterName, source, mapData, options) {
    if (filterName === 'gaussian-blur') return GaussianBlurFilter.applyBuffer(source, mapData, options);
    if (filterName === 'threshold') return ThresholdFilter.applyBuffer(source, mapData, options);
    throw new Error(`Filtro desconocido: ${filterName}`);
  }
}
