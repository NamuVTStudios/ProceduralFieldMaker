/** Extracts closed per-material contours from the authoritative 2D cell grid. */
class MarchingSquares2D {
  static extract(mapData, materialId) {
    const segments = [];
    this._collectRows(mapData, materialId, segments);
    return this._stitchSegments(segments);
  }

  static _collectRows(mapData, materialId, segments) {
    for (let y = -1; y < mapData.height; y++) this._collectRow(mapData, materialId, y, segments);
  }

  static _collectRow(mapData, materialId, y, segments) {
    for (let x = -1; x < mapData.width; x++) this._collectSquare(mapData, materialId, x, y, segments);
  }

  static _collectSquare(mapData, materialId, x, y, segments) {
    const pairs = this._edgePairs(this._getSquareMask(mapData, materialId, x, y));
    (pairs || []).forEach(pair => this._appendSegment(segments, x, y, pair));
  }

  static _getSquareMask(mapData, materialId, x, y) {
    return Number(this._isMaterial(mapData, x, y, materialId)) |
      (Number(this._isMaterial(mapData, x + 1, y, materialId)) << 1) |
      (Number(this._isMaterial(mapData, x + 1, y + 1, materialId)) << 2) |
      (Number(this._isMaterial(mapData, x, y + 1, materialId)) << 3);
  }

  static _isMaterial(mapData, x, y, materialId) {
    if (x < 0 || y < 0 || x >= mapData.width || y >= mapData.height) return false;
    return mapData.cells[y * mapData.width + x] === materialId;
  }

  static _edgePairs(mask) {
    const cases = {
      1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]],
      5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]],
      9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[3, 1]],
      13: [[0, 1]], 14: [[3, 0]],
    };
    return cases[mask] || null;
  }

  static _appendSegment(segments, x, y, pair) {
    segments.push({ a: this._edgePoint(x, y, pair[0]), b: this._edgePoint(x, y, pair[1]) });
  }

  static _edgePoint(x, y, edge) {
    const points = [
      { x: x + 1, y: y + 0.5 },
      { x: x + 1.5, y: y + 1 },
      { x: x + 1, y: y + 1.5 },
      { x: x + 0.5, y: y + 1 },
    ];
    return points[edge];
  }

  static _stitchSegments(segments) {
    const adjacency = this._buildAdjacency(segments);
    const used = new Uint8Array(segments.length);
    const contours = [];
    for (let index = 0; index < segments.length; index++) this._appendContourIfUnused(index, segments, adjacency, used, contours);
    return contours;
  }

  static _buildAdjacency(segments) {
    const adjacency = new Map();
    for (let index = 0; index < segments.length; index++) this._addAdjacentSegment(adjacency, segments[index], index);
    return adjacency;
  }

  static _addAdjacentSegment(adjacency, segment, index) {
    this._addEndpoint(adjacency, segment.a, index);
    this._addEndpoint(adjacency, segment.b, index);
  }

  static _addEndpoint(adjacency, point, index) {
    const key = this._pointKey(point);
    const values = adjacency.get(key) || [];
    values.push(index);
    adjacency.set(key, values);
  }

  static _appendContourIfUnused(index, segments, adjacency, used, contours) {
    if (used[index]) return;
    const contour = this._traceContour(index, segments, adjacency, used);
    if (contour.points.length >= 3 && contour.closed) contours.push(contour);
  }

  static _traceContour(index, segments, adjacency, used) {
    const first = segments[index];
    const points = [first.a, first.b];
    used[index] = 1;
    let current = first.b;
    let guard = segments.length + 2;
    let nextIndex = this._findNextSegment(current, adjacency, used);
    while (guard > 0 && nextIndex >= 0 && !this._samePoint(current, first.a)) {
      current = this._appendNextSegment(nextIndex, current, segments, used, points);
      guard -= 1;
      nextIndex = this._findNextSegment(current, adjacency, used);
    }
    return { points: this._removeClosingPoint(points), closed: this._samePoint(current, first.a) };
  }

  static _appendNextSegment(index, current, segments, used, points) {
    const nextPoint = this._otherEndpoint(segments[index], current);
    used[index] = 1;
    points.push(nextPoint);
    return nextPoint;
  }

  static _findNextSegment(point, adjacency, used) {
    const candidates = adjacency.get(this._pointKey(point)) || [];
    return candidates.find(index => !used[index]) ?? -1;
  }

  static _otherEndpoint(segment, point) {
    return this._samePoint(segment.a, point) ? segment.b : segment.a;
  }

  static _removeClosingPoint(points) {
    const result = points.slice();
    if (result.length > 1 && this._samePoint(result[0], result[result.length - 1])) result.pop();
    return result;
  }

  static _samePoint(first, second) {
    return Math.abs(first.x - second.x) < 0.001 && Math.abs(first.y - second.y) < 0.001;
  }

  static _pointKey(point) {
    return `${Math.round(point.x * 1000)}:${Math.round(point.y * 1000)}`;
  }
}
