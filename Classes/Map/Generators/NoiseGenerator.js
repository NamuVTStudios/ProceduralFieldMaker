/**
 * @fileoverview NoiseGenerator.js
 * Generador matemático de ruido coherente (Perlin/Simplex y FBM) 2D/3D con determinismo por semilla.
 * Cumple con las especificaciones del TDD (Secciones 4 y 5).
 */

/**
 * Convierte un string alfanumérico a un entero sin signo de 32 bits de forma determinista.
 * (Especificación exacta de la sección 5 del TDD).
 * @param {string} seedString
 * @returns {number}
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
 * @param {number} a Seed entero
 * @returns {() => number} Función que retorna números flotantes en [0, 1)
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
  /**
   * @param {string|number} seed Puede ser la cadena visual (ej: "MONTANA-7X2") o el hash directo.
   */
  constructor(seed = "DEFAULT_SEED") {
    this.seedString = typeof seed === "string" ? seed : String(seed);
    this.seedHash = typeof seed === "number" ? (seed >>> 0) : hashSeedToInt(this.seedString);

    // Inicializar tabla de permutaciones para el ruido
    this.perm = new Uint8Array(512);
    this.grad3 = [
      [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];

    this._initPermutations();
  }

  /**
   * Genera y baraja la tabla de permutación de 256 valores a partir de la semilla.
   * @private
   */
  _initPermutations() {
    const rng = createSeededRandom(this.seedHash);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Barajado Fisher-Yates determinista
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = p[i];
      p[i] = p[j];
      p[j] = temp;
    }

    // Duplicar para evitar desbordamiento modular (wrapping)
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  /**
   * Función de interpolación suave (Smoothstep de quinto grado / Quintic Hermite).
   * @private
   */
  _fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /**
   * Interpolación lineal.
   * @private
   */
  _lerp(t, a, b) {
    return a + t * (b - a);
  }

  /**
   * Producto punto de gradiente para Perlin 2D/3D.
   * @private
   */
  _grad(hash, x, y, z = 0) {
    const g = this.grad3[hash % 12];
    return g[0] * x + g[1] * y + g[2] * z;
  }

  /**
   * Evalúa ruido Perlin clásico determinista en 2D.
   * @param {number} x
   * @param {number} y
   * @returns {number} Valor en rango aproximado [-1, 1]
   */
  perlin2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this._fade(xf);
    const v = this._fade(yf);

    const aa = this.perm[this.perm[X] + Y];
    const ab = this.perm[this.perm[X] + Y + 1];
    const ba = this.perm[this.perm[X + 1] + Y];
    const bb = this.perm[this.perm[X + 1] + Y + 1];

    const x1 = this._lerp(u, this._grad(aa, xf, yf), this._grad(ba, xf - 1, yf));
    const x2 = this._lerp(u, this._grad(ab, xf, yf - 1), this._grad(bb, xf - 1, yf - 1));

    return this._lerp(v, x1, x2);
  }

  /**
   * Evalúa ruido Perlin clásico determinista en 3D (para cavidades y vóxels).
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {number} Valor en rango aproximado [-1, 1]
   */
  perlin3D(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = this._fade(xf);
    const v = this._fade(yf);
    const w = this._fade(zf);

    const A = this.perm[X] + Y;
    const AA = this.perm[A] + Z;
    const AB = this.perm[A + 1] + Z;
    const B = this.perm[X + 1] + Y;
    const BA = this.perm[B] + Z;
    const BB = this.perm[B + 1] + Z;

    return this._lerp(w,
      this._lerp(v,
        this._lerp(u, this._grad(this.perm[AA], xf, yf, zf), this._grad(this.perm[BA], xf - 1, yf, zf)),
        this._lerp(u, this._grad(this.perm[AB], xf, yf - 1, zf), this._grad(this.perm[BB], xf - 1, yf - 1, zf))
      ),
      this._lerp(v,
        this._lerp(u, this._grad(this.perm[AA + 1], xf, yf, zf - 1), this._grad(this.perm[BA + 1], xf - 1, yf, zf - 1)),
        this._lerp(u, this._grad(this.perm[AB + 1], xf, yf - 1, zf - 1), this._grad(this.perm[BB + 1], xf - 1, yf - 1, zf - 1))
      )
    );
  }

  /**
   * Ruido Fractal (FBM - Fractional Brownian Motion) 2D.
   * Ideal para heightmaps y perfiles topográficos con rugosidad continua.
   * @param {number} x
   * @param {number} y
   * @param {number} octaves Número de capas de ruido (típicamente 3 a 6)
   * @param {number} persistence Factor de decaimiento de amplitud (típico 0.5)
   * @param {number} lacunarity Multiplicador de frecuencia (típico 2.0)
   * @returns {number} Valor normalizado aprox. en [-1, 1]
   */
  fbm2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
    let total = 0;
    let frequency = 1.0;
    let amplitude = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.perlin2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /**
   * Ruido Fractal 3D para cuevas orgánicas y cavidades.
   */
  fbm3D(x, y, z, octaves = 3, persistence = 0.5, lacunarity = 2.0) {
    let total = 0;
    let frequency = 1.0;
    let amplitude = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.perlin3D(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }
}