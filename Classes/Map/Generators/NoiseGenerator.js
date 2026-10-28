/**
 * NoiseGenerator.js
 * Generador matemático de ruido coherente (Perlin/Simplex y FBM) 2D/3D con determinismo por semilla.
 * Refactorizado bajo la regla estricta de un máximo de 3 subtareas por método.
 */

/**
 * Convierte un string alfanumérico a un entero sin signo de 32 bits de forma determinista.
 */
function hashSeedToInt(seedString) {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (Math.imul(31, hash) + seedString.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/**
 * Generador pseudoaleatorio determinista (Mulberry32).
 */
function createSeededRandom(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class NoiseGenerator {
  constructor(seed = "DEFAULT_SEED") {
    this._setSeed(seed);
    this._initializeNoiseTables();
  }

  _setSeed(seed) {
    this.seedString = typeof seed === "string" ? seed : String(seed);
    this.seedHash = typeof seed === "number" ? (seed >>> 0) : hashSeedToInt(this.seedString);
  }

  _initializeNoiseTables() {
    this.perm = new Uint8Array(512);
    this.grad3 = [, [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
, [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
, [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];
    this._initPermutations();
  }

  _initPermutations() {
    const permutation = this._createInitialPermutation();
    this._shufflePermutation(permutation);
    this._copyPermutationTable(permutation);
  }

  _createInitialPermutation() {
    const permutation = new Uint8Array(256);
    for (let i = 0; i < 256; i++) permutation[i] = i;
    return permutation;
  }

  _shufflePermutation(permutation) {
    const random = createSeededRandom(this.seedHash);
    for (let i = 255; i > 0; i--) {
      const swapIndex = Math.floor(random() * (i + 1));
      this._swapPermutationValues(permutation, i, swapIndex);
    }
  }

  _swapPermutationValues(permutation, firstIndex, secondIndex) {
    const value = permutation[firstIndex];
    permutation[firstIndex] = permutation[secondIndex];
    permutation[secondIndex] = value;
  }

  _copyPermutationTable(permutation) {
    for (let i = 0; i < 512; i++) {
      this.perm[i] = permutation[i & 255];
    }
  }

  _fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  _lerp(t, a, b) {
    return a + t * (b - a);
  }

  _grad(hash, x, y, z = 0) {
    const g = this.grad3[hash % 12];
    return g[0] * x + g[1] * y + g[2] * z;
  }

  perlin2D(x, y) {
    const coords = this._setupCoordinates2D(x, y);
    const hashes = this._fetchHashes2D(coords.X, coords.Y);
    return this._interpolatePerlin2D(coords, hashes);
  }

  _setupCoordinates2D(x, y) {
    return {
      X: Math.floor(x) & 255, Y: Math.floor(y) & 255,
      xf: x - Math.floor(x), yf: y - Math.floor(y)
    };
  }

  _fetchHashes2D(X, Y) {
    return {
      aa: this.perm[this.perm[X] + Y],
      ab: this.perm[this.perm[X] + Y + 1],
      ba: this.perm[this.perm[X + 1] + Y],
      bb: this.perm[this.perm[X + 1] + Y + 1]
    };
  }

  _interpolatePerlin2D(c, h) {
    const u = this._fade(c.xf);
    const v = this._fade(c.yf);
    const x1 = this._lerp(u, this._grad(h.aa, c.xf, c.yf), this._grad(h.ba, c.xf - 1, c.yf));
    const x2 = this._lerp(u, this._grad(h.ab, c.xf, c.yf - 1), this._grad(h.bb, c.xf - 1, c.yf - 1));
    return this._lerp(v, x1, x2);
  }

  perlin3D(x, y, z) {
    const coords = this._setupCoordinates3D(x, y, z);
    const indices = this._fetchHashes3D(coords.X, coords.Y, coords.Z);
    return this._interpolatePerlin3D(coords, indices);
  }

  _setupCoordinates3D(x, y, z) {
    return {
      X: Math.floor(x) & 255, Y: Math.floor(y) & 255, Z: Math.floor(z) & 255,
      xf: x - Math.floor(x), yf: y - Math.floor(y), zf: z - Math.floor(z)
    };
  }

  _fetchHashes3D(X, Y, Z) {
    const A = this.perm[X] + Y;
    const B = this.perm[X + 1] + Y;
    return {
      AA: this.perm[A] + Z, AB: this.perm[A + 1] + Z,
      BA: this.perm[B] + Z, BB: this.perm[B + 1] + Z
    };
  }

  _interpolatePerlin3D(c, i) {
    const u = this._fade(c.xf);
    const v = this._fade(c.yf);
    const w = this._fade(c.zf);
    const lowPlane = this._calcPlaneLerp(c, i.AA, i.BA, i.AB, i.BB, u, v, 0);
    const highPlane = this._calcPlaneLerp(c, i.AA + 1, i.BA + 1, i.AB + 1, i.BB + 1, u, v, -1);
    return this._lerp(w, lowPlane, highPlane);
  }

  _calcPlaneLerp(c, hAA, hBA, hAB, hBB, u, v, zOffset) {
    const x1 = this._lerp(u, this._grad(this.perm[hAA], c.xf, c.yf, c.zf + zOffset), this._grad(this.perm[hBA], c.xf - 1, c.yf, c.zf + zOffset));
    const x2 = this._lerp(u, this._grad(this.perm[hAB], c.xf, c.yf - 1, c.zf + zOffset), this._grad(this.perm[hBB], c.xf - 1, c.yf - 1, c.zf + zOffset));
    return this._lerp(v, x1, x2);
  }

  fbm2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
    const fbm = { total: 0, frequency: 1.0, amplitude: 1.0, maxValue: 0 };
    this._runFbm2DLoop(x, y, octaves, persistence, lacunarity, fbm);
    return fbm.total / fbm.maxValue;
  }

  _runFbm2DLoop(x, y, octaves, persistence, lacunarity, fbm) {
    for (let i = 0; i < octaves; i++) {
      this._processFbm2DOctave(x, y, fbm, lacunarity, persistence);
    }
  }

  _processFbm2DOctave(x, y, fbm, lacunarity, persistence) {
    fbm.total += this.perlin2D(x * fbm.frequency, y * fbm.frequency) * fbm.amplitude;
    fbm.maxValue += fbm.amplitude;
    fbm.amplitude *= persistence;
    fbm.frequency *= lacunarity;
  }

  fbm3D(x, y, z, octaves = 3, persistence = 0.5, lacunarity = 2.0) {
    const fbm = { total: 0, frequency: 1.0, amplitude: 1.0, maxValue: 0 };
    this._runFbm3DLoop(x, y, z, octaves, persistence, lacunarity, fbm);
    return fbm.total / fbm.maxValue;
  }

  _runFbm3DLoop(x, y, z, octaves, persistence, lacunarity, fbm) {
    for (let i = 0; i < octaves; i++) {
      this._processFbm3DOctave(x, y, z, fbm, lacunarity, persistence);
    }
  }

  _processFbm3DOctave(x, y, z, fbm, lacunarity, persistence) {
    fbm.total += this.perlin3D(x * fbm.frequency, y * fbm.frequency, z * fbm.frequency) * fbm.amplitude;
    fbm.maxValue += fbm.amplitude;
    fbm.amplitude *= persistence;
    fbm.frequency *= lacunarity;
  }
}