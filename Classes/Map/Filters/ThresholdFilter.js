/** Binarización por dureza/densidad del material. */
class ThresholdFilter {
  static apply(mapData, options = {}) {
    const source = mapData.sizeX ? mapData.voxels : mapData.cells;
    const result = this.applyBuffer(source, mapData, options);
    if (mapData.sizeX) mapData.voxels = result;
    else mapData.cells = result;
    return result;
  }

  static applyBuffer(source, mapData, options = {}) {
    const weights = this._createMaterialWeights(mapData.materials || []);
    const threshold = this._resolveThreshold(options.threshold);
    const solidMaterialId = this._resolveSolidMaterial(options.solidMaterialId, mapData.materials || []);
    const result = new Uint8Array(source.length);
    this._mapThresholdBuffer(source, result, weights, threshold, solidMaterialId);
    return result;
  }

  static _createMaterialWeights(materials) {
    const weights = new Float32Array(256);
    for (const material of materials) {
      weights[material.id] = Number(material.density ?? material.hardness ?? 0);
    }
    return weights;
  }

  static _resolveThreshold(value) {
    const threshold = Number(value);
    return Number.isFinite(threshold) ? threshold : 3;
  }

  static _resolveSolidMaterial(value, materials) {
    const requested = Number(value);
    if (Number.isInteger(requested) && requested > 0 && requested <= 255) return requested;
    const strongest = materials.reduce((best, material) => {
      const weight = Number(material.density ?? material.hardness ?? 0);
      return weight > best.weight ? { id: material.id, weight } : best;
    }, { id: 1, weight: -Infinity });
    return strongest.id;
  }

  static _mapThresholdBuffer(source, result, weights, threshold, solidMaterialId) {
    for (let index = 0; index < source.length; index++) {
      result[index] = weights[source[index]] >= threshold ? solidMaterialId : 0;
    }
  }
}
