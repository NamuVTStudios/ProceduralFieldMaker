/** Capas 2D/3D, composición con buffers intermedios y ejecución de filtros. */
class MapLayerManager {
  constructor(appManager) {
    this.appManager = appManager;
    this.mapData = null;
    this.layers = [];
    this.activeLayer = null;
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
  }

  clearProject() {
    this.filterWorker?.cancelAll();
    this.layers = [];
    this.activeLayer = null;
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

  getActiveLayer() {
    return this.activeLayer;
  }

  ensureMaterialLayer(materialId) {
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
    this.compose();
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
    if (!this._canCreateLayer()) return null;
    return this._createAndActivateLayer(name);
  }

  _createAndActivateLayer(name) {
    const layer = this._createLayerDefinition(name);
    this._addAndActivateLayer(layer);
    this.compose();
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
    this._syncWorkingBuffer();
  }

  removeLayer(layerId) {
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
  }

  _restoreActiveLayer(removedLayer) {
    if (this.activeLayer !== removedLayer) return this._syncWorkingBuffer();
    this.activeLayer = this._findLayer(removedLayer.sourceLayerId) || this.layers[0];
    this._syncWorkingBuffer();
  }

  setActiveLayer(layerId) {
    const layer = this._findLayer(layerId);
    if (!layer) return false;
    this.activeLayer = layer;
    this._syncWorkingBuffer();
    return true;
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
    this._syncWorkingBuffer();
  }

  _getVisibleFallback(hiddenLayer) {
    return this.layers.find(layer => layer !== hiddenLayer && layer.visible) || this.layers[0] || null;
  }

  _updateLayerSetting(layerId, property, value) {
    const layer = this._findLayer(layerId);
    if (!layer) return false;
    layer[property] = value;
    this.compose();
    return true;
  }

  reorderLayer(layerId, targetIndex) {
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

  commitChanges({ render = true } = {}) {
    if (!this.mapData || !this.activeLayer) return false;
    this._markActiveLayerChanged();
    this.compose({ render });
    return true;
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
    const layer = this._findLayer(layerId);
    const mask = layer?.masks?.find(item => item.id === maskId);
    if (!mask) return false;
    mask.enabled = Boolean(enabled);
    this.compose();
    this._notifyLayerPanelChanged();
    return true;
  }

  removeLayerMask(layerId, maskId) {
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

  async _runFilter(filterName, options, mode) {
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
    this.commitChanges();
    return true;
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
