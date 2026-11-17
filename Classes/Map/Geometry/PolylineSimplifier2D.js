/** Radial-distance prefilter followed by iterative Ramer-Douglas-Peucker. */
class PolylineSimplifier2D {
  static simplify(points, tolerance = 0.75, closed = false) {
    if (!Array.isArray(points) || points.length <= 2) return points || [];
    const input = closed ? [...points, points[0]] : points.slice();
    const radial = this._radialDistance(input, tolerance * tolerance);
    const simplified = this._douglasPeucker(radial, tolerance * tolerance);
    return this._normalizeResult(simplified, closed);
  }

  static _radialDistance(points, toleranceSquared) {
    const result = [points[0]];
    let previous = points[0];
    for (let index = 1; index < points.length; index++) previous = this._appendRadialPoint(result, points[index], previous, toleranceSquared);
    if (result[result.length - 1] !== points[points.length - 1]) result.push(points[points.length - 1]);
    return result;
  }

  static _appendRadialPoint(result, point, previous, toleranceSquared) {
    if (this._squaredDistance(point, previous) <= toleranceSquared) return previous;
    result.push(point);
    return point;
  }

  static _douglasPeucker(points, toleranceSquared) {
    if (points.length <= 2) return points.slice();
    const keep = new Uint8Array(points.length);
    const stack = [[0, points.length - 1]];
    keep[0] = 1;
    keep[points.length - 1] = 1;
    this._processSegments(points, toleranceSquared, keep, stack);
    return points.filter((point, index) => keep[index]);
  }

  static _processSegments(points, toleranceSquared, keep, stack) {
    while (stack.length) this._processSegment(points, toleranceSquared, keep, stack);
  }

  static _processSegment(points, toleranceSquared, keep, stack) {
    const segment = stack.pop();
    const candidate = this._findFarthestPoint(points, segment[0], segment[1]);
    this._appendSplitIfNeeded(candidate, segment, toleranceSquared, keep, stack);
  }

  static _appendSplitIfNeeded(candidate, segment, toleranceSquared, keep, stack) {
    if (candidate.distanceSquared <= toleranceSquared) return;
    keep[candidate.index] = 1;
    stack.push([segment[0], candidate.index], [candidate.index, segment[1]]);
  }

  static _findFarthestPoint(points, first, last) {
    const best = { index: -1, distanceSquared: 0 };
    for (let index = first + 1; index < last; index++) this._updateFarthestPoint(best, points, first, last, index);
    return best;
  }

  static _updateFarthestPoint(best, points, first, last, index) {
    const distance = this._segmentDistanceSquared(points[index], points[first], points[last]);
    if (distance <= best.distanceSquared) return;
    best.distanceSquared = distance;
    best.index = index;
  }

  static _segmentDistanceSquared(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const amount = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    return this._squaredDistance(point, { x: start.x + dx * amount, y: start.y + dy * amount });
  }

  static _squaredDistance(first, second) {
    const dx = first.x - second.x;
    const dy = first.y - second.y;
    return dx * dx + dy * dy;
  }

  static _normalizeResult(points, closed) {
    if (!closed || points.length < 2) return points;
    const result = points.slice();
    if (this._squaredDistance(result[0], result[result.length - 1]) < 0.0001) result.pop();
    return result.length >= 3 ? result : points;
  }
}
