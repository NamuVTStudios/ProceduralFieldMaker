/** Suavizado categórico gaussiano para buffers de materiales 2D y 3D. */
class GaussianBlurFilter {
  static apply(mapData, options = {}) {
    const source = mapData.sizeX ? mapData.voxels : mapData.cells;
    const result = this.applyBuffer(source, mapData, options);
    if (mapData.sizeX) mapData.voxels = result;
    else mapData.cells = result;
    return result;
  }

  static applyBuffer(source, mapData, options = {}) {
    const context = this._createContext(source, mapData, options);
    const output = new Uint8Array(source.length);
    context.output = output;
    if (context.is3D) this._process3DPlanes(context);
    else this._process2DRows(context);
    return output;
  }

  static _createContext(source, mapData, options) {
    const kernelSize = Number(options.kernelSize) === 5 ? 5 : 3;
    const radius = Math.floor(kernelSize / 2);
    return {
      source,
      output: null,
      width: mapData.width || mapData.sizeX,
      height: mapData.height || mapData.sizeY,
      depth: mapData.sizeZ || 1,
      is3D: Boolean(mapData.sizeX),
      radius,
      sigma: Math.max(0.5, Number(options.sigma) || (radius === 2 ? 1.4 : 0.85)),
      scores: new Float64Array(256),
      axisWeights: this._createAxisWeights(radius, Math.max(0.5, Number(options.sigma) || (radius === 2 ? 1.4 : 0.85))),
    };
  }

  static _createAxisWeights(radius, sigma) {
    const weights = new Float64Array(radius * 2 + 1);
    for (let offset = -radius; offset <= radius; offset++) {
      weights[offset + radius] = Math.exp(-(offset * offset) / (2 * sigma * sigma));
    }
    return weights;
  }

  static _process2DRows(context) {
    for (let y = 0; y < context.height; y++) this._process2DRow(context, y);
  }

  static _process2DRow(context, y) {
    for (let x = 0; x < context.width; x++) this._blur2DCell(context, x, y);
  }

  static _blur2DCell(context, x, y) {
    const scores = context.scores;
    scores.fill(0);
    this._accumulate2DRows(context, x, y, scores);
    const index = y * context.width + x;
    context.output[index] = this._selectMaterial(scores, context.source[index]);
  }

  static _accumulate2DRows(context, x, y, scores) {
    for (let offsetY = -context.radius; offsetY <= context.radius; offsetY++) {
      this._accumulate2DRow(context, x, y, offsetY, scores);
    }
  }

  static _accumulate2DRow(context, x, y, offsetY, scores) {
    const targetY = y + offsetY;
    if (targetY < 0 || targetY >= context.height) return;
    for (let offsetX = -context.radius; offsetX <= context.radius; offsetX++) {
      this._accumulate2DCell(context, x, targetY, offsetX, offsetY, scores);
    }
  }

  static _accumulate2DCell(context, x, targetY, offsetX, offsetY, scores) {
    const targetX = x + offsetX;
    if (targetX < 0 || targetX >= context.width) return;
    const index = targetY * context.width + targetX;
    const weight = this._getKernelWeight(offsetX, offsetY, 0, context);
    scores[context.source[index]] += weight;
  }

  static _process3DPlanes(context) {
    for (let z = 0; z < context.depth; z++) this._process3DPlane(context, z);
  }

  static _process3DPlane(context, z) {
    for (let y = 0; y < context.height; y++) this._process3DRow(context, y, z);
  }

  static _process3DRow(context, y, z) {
    for (let x = 0; x < context.width; x++) this._blur3DCell(context, x, y, z);
  }

  static _blur3DCell(context, x, y, z) {
    const scores = context.scores;
    scores.fill(0);
    this._accumulate3DPlanes(context, x, y, z, scores);
    const index = this._get3DIndex(context, x, y, z);
    context.output[index] = this._selectMaterial(scores, context.source[index]);
  }

  static _accumulate3DPlanes(context, x, y, z, scores) {
    for (let offsetZ = -context.radius; offsetZ <= context.radius; offsetZ++) {
      this._accumulate3DPlane(context, x, y, z, offsetZ, scores);
    }
  }

  static _accumulate3DPlane(context, x, y, z, offsetZ, scores) {
    const targetZ = z + offsetZ;
    if (targetZ < 0 || targetZ >= context.depth) return;
    for (let offsetY = -context.radius; offsetY <= context.radius; offsetY++) {
      this._accumulate3DRow(context, x, y, targetZ, offsetY, offsetZ, scores);
    }
  }

  static _accumulate3DRow(context, x, y, targetZ, offsetY, offsetZ, scores) {
    const targetY = y + offsetY;
    if (targetY < 0 || targetY >= context.height) return;
    for (let offsetX = -context.radius; offsetX <= context.radius; offsetX++) {
      this._accumulate3DCell(context, x, targetY, targetZ, offsetX, offsetY, offsetZ, scores);
    }
  }

  static _accumulate3DCell(context, x, targetY, targetZ, offsetX, offsetY, offsetZ, scores) {
    const targetX = x + offsetX;
    if (targetX < 0 || targetX >= context.width) return;
    const index = this._get3DIndex(context, targetX, targetY, targetZ);
    const weight = this._getKernelWeight(offsetX, offsetY, offsetZ, context);
    scores[context.source[index]] += weight;
  }

  static _get3DIndex(context, x, y, z) {
    return (y * context.depth + z) * context.width + x;
  }

  static _getKernelWeight(x, y, z, context) {
    const radius = context.radius;
    const weights = context.axisWeights;
    return weights[x + radius] * weights[y + radius] * weights[z + radius];
  }

  static _selectMaterial(scores, centerMaterial) {
    const selection = { material: centerMaterial, score: scores[centerMaterial] };
    for (let materialId = 0; materialId < scores.length; materialId++) {
      this._considerMaterial(scores, materialId, selection);
    }
    return selection.material;
  }

  static _considerMaterial(scores, materialId, selection) {
    if (scores[materialId] <= selection.score) return;
    selection.material = materialId;
    selection.score = scores[materialId];
  }
}
