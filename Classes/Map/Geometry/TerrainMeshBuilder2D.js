/**
 * Builds the production 2D terrain mesh from the canonical material grid.
 * Marching Squares supplies destructible boundaries; the rendered fill is
 * triangulated from exact material runs so triangles can never bridge air,
 * holes or a different material.
 */
class TerrainMeshBuilder2D {
  constructor(options = {}) {
    this.contourTolerance = options.contourTolerance ?? 0.35;
    this.maxMapCells = options.maxMapCells || 262144;
    this.maxMeshRectangles = options.maxMeshRectangles || 60000;
    this.lastBuild = null;
  }

  build(mapData) {
    if (!this._isValidMap(mapData)) return this._emptyResult();
    if (this._requiresGridRenderer(mapData)) return this._createFallbackResult();
    return this._buildExactHybridMesh(mapData);
  }

  _buildExactHybridMesh(mapData) {
    const result = this._createBuildResult();
    this._appendMaterialContours(mapData, result);
    this._appendGreedyMesh(mapData, result);
    this._clearMeshOnFallback(result);
    this.lastBuild = result;
    return result;
  }

  _isValidMap(mapData) {
    return Boolean(mapData?.cells && mapData.width > 0 && mapData.height > 0);
  }

  _requiresGridRenderer(mapData) {
    return mapData.width * mapData.height > this.maxMapCells;
  }

  _emptyResult() {
    return { triangles: [], rectangles: [], contours: [], alphaBoundaries: [], voronoiEdges: [], mode: 'hybrid' };
  }

  _createFallbackResult() {
    return { ...this._emptyResult(), mode: 'grid-fallback' };
  }

  _createBuildResult() {
    return { ...this._emptyResult(), strategy: 'marching-squares-greedy-triangulation' };
  }

  _appendMaterialContours(mapData, result) {
    const materials = (mapData.materials || []).filter(material => material.id !== 0);
    for (const material of materials) this._appendMaterialContour(mapData, material.id, result);
  }

  _appendMaterialContour(mapData, materialId, result) {
    const extracted = MarchingSquares2D.extract(mapData, materialId);
    const simplified = this._simplifyContours(extracted);
    for (const contour of simplified) result.contours.push({ materialId, points: contour.points });
  }

  _simplifyContours(contours) {
    return contours
      .map(contour => ({
        points: PolylineSimplifier2D.simplify(contour.points, this.contourTolerance, true),
        closed: contour.closed,
      }))
      .filter(contour => contour.closed && contour.points.length >= 3);
  }

  _appendGreedyMesh(mapData, result) {
    let activeRectangles = new Map();
    let y = 0;
    while (y < mapData.height && result.mode === 'hybrid') {
      activeRectangles = this._processMeshRow(mapData, y, activeRectangles, result);
      y += 1;
    }
    if (result.mode === 'hybrid') this._flushActiveRectangles(activeRectangles, result);
  }

  _processMeshRow(mapData, y, activeRectangles, result) {
    const rowRuns = this._getMaterialRuns(mapData, y);
    const nextRectangles = new Map();
    for (const run of rowRuns) this._continueOrStartRectangle(run, y, activeRectangles, nextRectangles);
    this._flushExpiredRectangles(activeRectangles, nextRectangles, result);
    return nextRectangles;
  }

  _getMaterialRuns(mapData, y) {
    const runs = [];
    let x = 0;
    while (x < mapData.width) x = this._appendNextMaterialRun(mapData, y, x, runs);
    return runs;
  }

  _appendNextMaterialRun(mapData, y, startX, runs) {
    const materialId = mapData.cells[y * mapData.width + startX];
    if (materialId === 0) return startX + 1;
    return this._appendRunUntilMaterialChanges(mapData, y, startX, materialId, runs);
  }

  _appendRunUntilMaterialChanges(mapData, y, startX, materialId, runs) {
    let endX = startX + 1;
    while (endX < mapData.width && mapData.cells[y * mapData.width + endX] === materialId) endX += 1;
    runs.push({ materialId, minX: startX, maxX: endX });
    return endX;
  }

  _continueOrStartRectangle(run, y, activeRectangles, nextRectangles) {
    const key = this._getRunKey(run);
    const rectangle = activeRectangles.get(key) || this._createRectangle(run, y);
    rectangle.maxY = y + 1;
    nextRectangles.set(key, rectangle);
  }

  _getRunKey(run) {
    return `${run.materialId}:${run.minX}:${run.maxX}`;
  }

  _createRectangle(run, y) {
    return { materialId: run.materialId, minX: run.minX, maxX: run.maxX, minY: y, maxY: y + 1 };
  }

  _flushExpiredRectangles(activeRectangles, nextRectangles, result) {
    for (const [key, rectangle] of activeRectangles.entries()) this._appendExpiredRectangle(key, rectangle, nextRectangles, result);
  }

  _appendExpiredRectangle(key, rectangle, nextRectangles, result) {
    if (nextRectangles.has(key)) return;
    this._appendRectangle(result, rectangle);
  }

  _flushActiveRectangles(activeRectangles, result) {
    for (const rectangle of activeRectangles.values()) this._appendRectangle(result, rectangle);
  }

  _appendRectangle(result, rectangle) {
    if (result.mode !== 'hybrid') return;
    if (result.rectangles.length >= this.maxMeshRectangles) return this._switchToGridFallback(result);
    result.rectangles.push(rectangle);
    this._appendRectangleTriangles(result, rectangle);
  }

  _switchToGridFallback(result) {
    result.mode = 'grid-fallback';
  }

  _clearMeshOnFallback(result) {
    if (result.mode !== 'grid-fallback') return;
    result.rectangles = [];
    result.triangles = [];
    result.contours = [];
  }

  _appendRectangleTriangles(result, rectangle) {
    const topLeft = { x: rectangle.minX, y: rectangle.minY };
    const topRight = { x: rectangle.maxX, y: rectangle.minY };
    const bottomRight = { x: rectangle.maxX, y: rectangle.maxY };
    const bottomLeft = { x: rectangle.minX, y: rectangle.maxY };
    this._appendTriangle(result, rectangle.materialId, [topLeft, topRight, bottomRight]);
    this._appendTriangle(result, rectangle.materialId, [topLeft, bottomRight, bottomLeft]);
  }

  _appendTriangle(result, materialId, points) {
    result.triangles.push({ materialId, points });
  }
}
