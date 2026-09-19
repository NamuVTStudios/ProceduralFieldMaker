/**
 * PhysicsEngine2D.js
 *
 * Wrapper de Box2D como AppObject (sección 3.1 y 6.2 del TDD). Traduce las
 * islas desconectadas que le entrega TerrainModificationEngine.js en
 * cuerpos rígidos de Box2D, y corre la simulación con un timestep FIJO
 * (independiente del dt variable del render), como exige cualquier motor
 * de físicas para ser estable.
 *
 * API de Box2D asumida: variante "Box2DWeb" (Box2D.Dynamics.b2World,
 * Box2D.Collision.Shapes.b2PolygonShape, etc.). Si tu box2D.js expone otra
 * API, ajustar solo los alias de la sección "Alias de Box2D" — el resto
 * de la clase no depende de la forma exacta de esos nombres.
 */

// --- Alias de Box2D (ajustar acá si tu build expone otra ruta) ---
const B2_Vec2 = Box2D.Common.Math.b2Vec2;
const B2_BodyDef = Box2D.Dynamics.b2BodyDef;
const B2_Body = Box2D.Dynamics.b2Body;
const B2_FixtureDef = Box2D.Dynamics.b2FixtureDef;
const B2_World = Box2D.Dynamics.b2World;
const B2_PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;

// Box2D trabaja mejor con objetos de 0.1 a 10 unidades — convertimos
// celdas del MapData a "metros" de Box2D con esta escala.
const METERS_PER_CELL = 1;

// Timestep fijo recomendado para Box2D (60Hz). No confundir con el dt
// variable que le llega a onUpdate desde el AppManager.
const FIXED_TIMESTEP = 1 / 60;
const MAX_SUBSTEPS_PER_FRAME = 5; // evita la "espiral de la muerte" si el framerate cae mucho

class PhysicsEngine2D extends AppObject {
  constructor(appManager) {
    super(appManager);
    this.world = null;
    this.accumulator = 0; // tiempo acumulado pendiente de simular
    this.debrisBodies = []; // { body, createdAt } — cuerpos de escombro activos
  }

  // -----------------------------------------------------------------
  // Ciclo de vida (AppObject)
  // -----------------------------------------------------------------

  onInit() {
    // Gravedad hacia abajo en unidades de Box2D (Y positivo = hacia abajo,
    // convención típica de Box2DWeb con coordenadas de pantalla).
    const gravity = new B2_Vec2(0, 9.8);
    const allowSleep = true; // los cuerpos quietos se "duermen" solos (ahorra CPU)
    this.world = new B2_World(gravity, allowSleep);
  }

  onDestroy() {
    this.debrisBodies = [];
    this.world = null;
  }

  /**
   * Se llama una vez por frame desde AppManager.update(dt). No simula con
   * ese dt directamente: acumula tiempo y avanza la simulación en pasos
   * fijos de FIXED_TIMESTEP, para que el comportamiento físico no cambie
   * según el framerate del navegador.
   */
  onUpdate(dt) {
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_TIMESTEP && steps < MAX_SUBSTEPS_PER_FRAME) {
      this.world.Step(FIXED_TIMESTEP, 8, 3); // (timestep, velocityIterations, positionIterations)
      this.accumulator -= FIXED_TIMESTEP;
      steps++;
    }
    this.world.ClearForces();
    this._removeSettledBodies();
  }

  // -----------------------------------------------------------------
  // Escombros — contrato usado por TerrainModificationEngine.js
  // -----------------------------------------------------------------

  /**
   * Tierra/Roca: agrupa todas las celdas de la isla en UN solo cuerpo
   * rígido denso (compound body: una fixture-caja por celda, todas
   * atadas al mismo body), para no saturar Box2D con cuerpos individuales.
   * @param {Array<{x:number, y:number}>} cells - celdas de la isla (en espacio de MapData)
   * @param {object} material - MaterialDef de la isla
   */
  spawnRigidBodyDebris(cells, material) {
    const centroid = this._computeCentroid(cells);

    const bodyDef = new B2_BodyDef();
    bodyDef.type = B2_Body.b2_dynamicBody;
    bodyDef.position.Set(centroid.x * METERS_PER_CELL, centroid.y * METERS_PER_CELL);
    const body = this.world.CreateBody(bodyDef);

    // Una fixture por celda, posicionada en su offset relativo al centroide
    // (así el cuerpo entero tiene la forma real de la isla, no un rectángulo).
    for (const cell of cells) {
      const shape = new B2_PolygonShape();
      const halfSize = (METERS_PER_CELL / 2) * 0.98; // 0.98 evita solapamiento numérico entre celdas contiguas
      shape.SetAsOrientedBox(
        halfSize, halfSize,
        new B2_Vec2((cell.x - centroid.x) * METERS_PER_CELL, (cell.y - centroid.y) * METERS_PER_CELL),
        0
      );

      const fixtureDef = new B2_FixtureDef();
      fixtureDef.shape = shape;
      fixtureDef.density = material.hardness || 1; // más dureza = más masa por celda
      fixtureDef.friction = 0.4;
      fixtureDef.restitution = 0.1; // rebote leve al impactar contra el suelo
      body.CreateFixture(fixtureDef);
    }

    this.debrisBodies.push({ body, createdAt: performance.now() });
    return body;
  }

  /**
   * Arena/Agua (hardness === 0): en vez de un cuerpo único, cada celda se
   * vuelve su propia partícula dinámica pequeña, para lograr el efecto de
   * "disolverse y caer" que pide el GDD.
   * @param {Array<{x:number, y:number}>} cells
   * @param {object} material
   */
  spawnParticleDebris(cells, material) {
    for (const cell of cells) {
      const bodyDef = new B2_BodyDef();
      bodyDef.type = B2_Body.b2_dynamicBody;
      bodyDef.position.Set(cell.x * METERS_PER_CELL, cell.y * METERS_PER_CELL);
      const body = this.world.CreateBody(bodyDef);

      const shape = new B2_PolygonShape();
      shape.SetAsBox((METERS_PER_CELL / 2) * 0.8, (METERS_PER_CELL / 2) * 0.8); // partícula más chica que una celda completa

      const fixtureDef = new B2_FixtureDef();
      fixtureDef.shape = shape;
      fixtureDef.density = 0.5;
      fixtureDef.friction = 0.6;
      fixtureDef.restitution = 0; // la arena no rebota
      body.CreateFixture(fixtureDef);

      this.debrisBodies.push({ body, createdAt: performance.now() });
    }
  }

  // -----------------------------------------------------------------
  // Consulta para el Renderer2D (posición/rotación actual de cada escombro)
  // -----------------------------------------------------------------

  /**
   * Devuelve la transformación actual de todos los cuerpos de escombro
   * activos, para que Renderer2D dibuje su malla/sprite en la posición
   * que reporta Box2D en cada frame (ver sección 6.2, punto 4 del TDD).
   * @returns {Array<{body: object, x:number, y:number, angle:number}>}
   */
  getDebrisTransforms() {
    return this.debrisBodies.map(({ body }) => {
      const pos = body.GetPosition();
      return {
        body,
        x: pos.x / METERS_PER_CELL,
        y: pos.y / METERS_PER_CELL,
        angle: body.GetAngle(),
      };
    });
  }

  // -----------------------------------------------------------------
  // Helpers internos
  // -----------------------------------------------------------------

  _computeCentroid(cells) {
    let sumX = 0, sumY = 0;
    for (const cell of cells) { sumX += cell.x; sumY += cell.y; }
    return { x: sumX / cells.length, y: sumY / cells.length };
  }

  /**
   * Saca de la simulación activa los cuerpos que ya se "durmieron"
   * (Box2D los pone a dormir solo cuando su velocidad es ~0 por varios
   * frames). Esto es lo que evita acumular cuerpos dinámicos indefinidamente
   * (riesgo mencionado en la sección 11 del TDD).
   */
  _removeSettledBodies() {
    this.debrisBodies = this.debrisBodies.filter(({ body }) => {
      if (!body.IsAwake()) {
        this.world.DestroyBody(body);
        return false; // se saca de la lista activa
      }
      return true;
    });
  }
}
