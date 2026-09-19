/**
 * PhysicsEngine3D.js
 *
 * Wrapper de Cannon.js como AppObject (sección 3.1 y 6.2 del TDD). Misma
 * responsabilidad que PhysicsEngine2D.js pero en volumen: recibe islas de
 * voxels desconectadas y las convierte en cuerpos rígidos de Cannon.js.
 */

// Cannon.js trabaja bien en metros reales; 1 voxel = 1 metro por defecto.
const METERS_PER_VOXEL = 1;

// Timestep fijo recomendado para Cannon.js (60Hz), independiente del dt
// variable de render.
const FIXED_TIMESTEP = 1 / 60;
const MAX_SUBSTEPS_PER_FRAME = 5; // evita la "espiral de la muerte" si el framerate cae mucho

class PhysicsEngine3D extends AppObject {
  constructor(appManager) {
    super(appManager);
    this.world = null;
    this.accumulator = 0;
    this.debrisBodies = []; // { body } — cuerpos de escombro activos
  }

  // -----------------------------------------------------------------
  // Ciclo de vida (AppObject)
  // -----------------------------------------------------------------

  onInit() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0); // gravedad estándar, eje Y hacia arriba
    this.world.broadphase = new CANNON.SAPBroadphase(this.world); // más eficiente que el broadphase por defecto con muchos cuerpos
    this.world.allowSleep = true; // cuerpos quietos se "duermen" solos
    this.world.solver.iterations = 10;
  }

  onDestroy() {
    this.debrisBodies = [];
    this.world = null;
  }

  /**
   * Igual que en PhysicsEngine2D: acumula dt variable y avanza la
   * simulación en pasos fijos, para que el comportamiento no dependa del
   * framerate del navegador.
   */
  onUpdate(dt) {
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_TIMESTEP && steps < MAX_SUBSTEPS_PER_FRAME) {
      this.world.step(FIXED_TIMESTEP);
      this.accumulator -= FIXED_TIMESTEP;
      steps++;
    }
    this._removeSettledBodies();
  }

  // -----------------------------------------------------------------
  // Escombros — contrato usado por TerrainModificationEngine.js
  // -----------------------------------------------------------------

  /**
   * Tierra/Roca: un solo cuerpo rígido compuesto por una caja (CANNON.Box)
   * por voxel de la isla, todas atadas al mismo CANNON.Body — evita crear
   * un cuerpo por voxel individual (saturaría el motor de físicas).
   * @param {Array<{x:number, y:number, z:number}>} cells - voxels de la isla
   * @param {object} material - MaterialDef de la isla
   */
  spawnRigidBodyDebris(cells, material) {
    const centroid = this._computeCentroid(cells);
    const mass = cells.length * (material.hardness || 1); // más celdas/dureza = más masa

    const body = new CANNON.Body({ mass });
    body.position.set(centroid.x * METERS_PER_VOXEL, centroid.y * METERS_PER_VOXEL, centroid.z * METERS_PER_VOXEL);

    const halfExtent = (METERS_PER_VOXEL / 2) * 0.98; // margen para evitar solapamiento numérico entre voxels contiguos
    const boxShape = new CANNON.Box(new CANNON.Vec3(halfExtent, halfExtent, halfExtent));

    // Una fixture (shape) por voxel, cada una con su offset relativo al centroide del cuerpo.
    for (const cell of cells) {
      const offset = new CANNON.Vec3(
        (cell.x - centroid.x) * METERS_PER_VOXEL,
        (cell.y - centroid.y) * METERS_PER_VOXEL,
        (cell.z - centroid.z) * METERS_PER_VOXEL
      );
      body.addShape(boxShape, offset);
    }

    body.material = new CANNON.Material({ friction: 0.4, restitution: 0.1 });
    this.world.addBody(body);
    this.debrisBodies.push({ body });
    return body;
  }

  /**
   * Arena/Agua (hardness === 0): cada voxel se vuelve su propio cuerpo
   * pequeño e independiente, para el efecto de "caída libre en partículas"
   * que pide el GDD.
   * @param {Array<{x:number, y:number, z:number}>} cells
   * @param {object} material
   */
  spawnParticleDebris(cells, material) {
    const particleHalfExtent = (METERS_PER_VOXEL / 2) * 0.8; // partícula más chica que un voxel completo
    const particleShape = new CANNON.Box(new CANNON.Vec3(particleHalfExtent, particleHalfExtent, particleHalfExtent));

    for (const cell of cells) {
      const body = new CANNON.Body({ mass: 0.5 });
      body.position.set(cell.x * METERS_PER_VOXEL, cell.y * METERS_PER_VOXEL, cell.z * METERS_PER_VOXEL);
      body.addShape(particleShape);
      body.material = new CANNON.Material({ friction: 0.6, restitution: 0 }); // la arena no rebota

      this.world.addBody(body);
      this.debrisBodies.push({ body });
    }
  }

  // -----------------------------------------------------------------
  // Consulta para el Renderer3D (posición/rotación actual de cada escombro)
  // -----------------------------------------------------------------

  /**
   * Devuelve la transformación actual de todos los cuerpos de escombro
   * activos, para que Renderer3D mueva/rote la malla correspondiente en
   * Three.js siguiendo la simulación (sección 6.2, punto 4 del TDD).
   * @returns {Array<{body: object, position: object, quaternion: object}>}
   */
  getDebrisTransforms() {
    return this.debrisBodies.map(({ body }) => ({
      body,
      position: body.position, // CANNON.Vec3 — Renderer3D lo copia directo a mesh.position
      quaternion: body.quaternion, // CANNON.Quaternion — Renderer3D lo copia directo a mesh.quaternion
    }));
  }

  // -----------------------------------------------------------------
  // Helpers internos
  // -----------------------------------------------------------------

  _computeCentroid(cells) {
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const cell of cells) { sumX += cell.x; sumY += cell.y; sumZ += cell.z; }
    const count = cells.length;
    return { x: sumX / count, y: sumY / count, z: sumZ / count };
  }

  /**
   * Saca de la simulación activa los cuerpos que ya se "durmieron"
   * (velocidad ~0 por varios frames). Evita acumular cuerpos dinámicos
   * indefinidamente en mapas donde el usuario destruye mucho terreno
   * (riesgo mencionado en la sección 11 del TDD).
   */
  _removeSettledBodies() {
    this.debrisBodies = this.debrisBodies.filter(({ body }) => {
      if (body.sleepState === CANNON.Body.SLEEPING) {
        this.world.removeBody(body);
        return false; // se saca de la lista activa
      }
      return true;
    });
  }
}
