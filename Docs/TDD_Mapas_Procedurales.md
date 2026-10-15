# Documento de Diseño Técnico (TDD)
## App Web de Generación de Mapas Procedurales 2D/3D con Terreno Destructible

**Versión:** 1.1 | **Tipo:** Herramienta para desarrolladores | **Alcance:** Paralelo 2D y 3D

---

## 1. Resumen Técnico

La aplicación es un editor web interactivo que permite:
- Generar mapas procedimentales sólidos y estratificados en 2D (grilla densa) y 3D (volumétrico basado en vóxels/heightmaps).
- Editar y destruir terreno en tiempo real mediante adición y sustracción geométrica local, con resistencia distinta según el material.
- Componer el mapa en capas, aplicar filtros y modelar con primitivas, booleanas y extrusión por curvas.
- Exportar los entornos generados a formatos optimizados compatibles con motores externos (Unity, Godot, Unreal o soluciones propietarias).

El diseño prioriza el rendimiento estricto en el navegador, el determinismo matemático por semilla (seed), la extensibilidad modular y una arquitectura limpia donde el núcleo lógico comparte los datos sin depender directamente del pipeline gráfico.

**Aclaración de alcance (2D):** el terreno es sólido y destructible tipo *Worms*. El autómata celular se usa únicamente como algoritmo de *generación* (crear cuevas y formas orgánicas al inicio), no como simulación continua por frame.

**Fuera de alcance:** el proyecto **no incluye motor de físicas**. No hay gravedad sobre el terreno, colapso de islas flotantes, escombros ni cuerpos rígidos, ni simulación de fluidos. Lo que se esculpe o se destruye permanece exactamente donde quedó hasta la próxima edición del usuario.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Renderizado 2D | **Pixi.js (WebGL)** | Dibujo por sprites y texturas dinámicas de alto rendimiento. Optimizado mediante regiones sucias (dirty regions). |
| Renderizado 3D | **Babylon.js** | Distribución UMD/global oficial y mantenida (Three.js discontinuó su build global desde r161). Incluye exportación GLTF/GLB nativa y controles de cámara sin depender de módulos ES, lo que encaja con la arquitectura de `<script>` globales del proyecto. |
| Cómputo pesado | **Web Workers** | Aislamiento de generación, flood-fill, filtros, CSG y extrusión fuera del hilo de render. |
| Generación Procedural | **Módulos propios de ruido** | Implementaciones independientes de ruido Perlin, Simplex y Worley para modelado topológico y de cavidades. |
| Arquitectura | **AppManager + AppObject** | Patrón estructural propietario. El manager central orquesta el ciclo de vida unificado de todos los componentes. |
| Exportación | **Plugins desacoplados** | Arquitectura limpia basada en contratos (Exporter) para añadir nuevos formatos sin alterar el núcleo. |
| Lenguaje | **JavaScript (ES2022+)** | Tipado simulado por documentación JSDoc para garantizar legibilidad y autocompletado, sin build de tipado. |
| Carga de scripts | **`<script>` globales, sin bundler ni módulos ES** | Todas las clases y librerías cuelgan de `window`; el orden de carga en `index.html` define las dependencias. |

---

## 3. Arquitectura General

### 3.1 AppManager y AppObject

Toda la aplicación se organiza alrededor de estas dos piezas centrales:

- **`AppManager`**: orquestador único del software. Gobierna el ciclo de vida global (init, update, destroy), administra el registro de entidades activas, conmuta el estado de visualización (2D/3D), retiene los datos mutables del mapa (`MapData`) y expone los submotores transversales (generador, motor de modificación de terreno, registro de exportación).
- **`AppObject`**: clase base. Cualquier entidad interactiva o lógica hereda de esta estructura, exponiendo ganchos unificados de actualización (`onInit`, `onUpdate`, `onDestroy`).

```js
class AppObject {
  constructor(appManager) {
    this.appManager = appManager;
    this.active = true;
  }
  onInit() {}
  onUpdate(dt) {}
  onDestroy() {}
}

class AppManager {
  constructor() {
    this.objects = [];
    this.mode = '2d'; // '2d' | '3d'
    this.mapData = null;
    this.generator = null;
    this.destructionEngine = null; // TerrainModificationEngine
    this.exportRegistry = null;
  }

  register(appObject) {
    this.objects.push(appObject);
    appObject.onInit();
    return appObject;
  }

  unregister(appObject) {
    appObject.onDestroy();
    this.objects = this.objects.filter(o => o !== appObject);
  }

  update(dt) {
    for (const obj of this.objects) {
      if (obj.active) obj.onUpdate(dt);
    }
  }
}
```

**Principio clave:** los sistemas gráficos (`Renderer2D` y `Renderer3D`) actúan como simples `AppObject` intercambiables. El núcleo computacional muta la información numérica pura; las vistas web simplemente reaccionan a los cambios.

**Nota sobre `Tools` y `Windows`:** ambas clases base heredan de `AppObject` (comparten el mismo ciclo de vida). `ToolsManager` y `WindowsManager` **no** heredan de `AppManager`: se componen dentro de él (cada uno recibe una referencia al `AppManager` por constructor), evitando múltiples instancias con forma de orquestador central.

**Gizmos 3D:** son métodos de la clase base `Tools` (no una clase aparte), disponibles para cualquier herramienta que necesite manipulación gizmo (traslación/rotación/escala) antes de aplicarse al buffer.

### 3.2 Diagrama de capas

```
┌─────────────────────────────────────────────────────────┐
│                        UI Layer                          │
│   (Panel de parámetros, seed, herramientas, selector     │
│    2D/3D, capas, botón de exportación)                   │
└───────────────────────┬───────────────────────────────────┘
                         │ (llamadas al AppManager)
┌───────────────────────▼───────────────────────────────────┐
│                       AppManager                            │
│  - Registro y ciclo de vida de AppObject                    │
│  - Modo activo (2D / 3D)                                    │
│  - MapData, Generator, TerrainModificationEngine,            │
│    MapLayerManager, ExportRegistry                           │
└───────┬───────────────────────────────────┬────────────────┘
        │  Renderer2D + CameraController2D    │  Renderer3D + CameraController3D
┌───────▼────────────┐           ┌──────────▼───────────┐
│   Renderer 2D        │           │   Renderer 3D          │
│   (Pixi.js)          │           │   (Babylon.js)         │
└───────────────────────┘           └────────────────────────┘
```

### 3.3 Sistemas de Cámara (CameraController2D / CameraController3D)

Ambos son `AppObject` registrados por `Renderer2D`/`Renderer3D` según el modo activo.

**CameraController2D (estilo Photoshop):**
- Paneo: arrastre con botón secundario o central del mouse, traduce el delta de movimiento a un offset de cámara sobre el `PIXI.Container` del mundo.
- Zoom: rueda del mouse, focalizado hacia la posición del cursor (no hacia el centro de pantalla). Se recalcula el offset de cámara para que el punto bajo el cursor permanezca fijo tras aplicar el nuevo nivel de zoom.

```js
class CameraController2D extends AppObject {
  onZoom(delta, cursorX, cursorY) {
    const zoomFactor = delta > 0 ? 0.9 : 1.1;
    const worldPosBeforeZoom = this.screenToWorld(cursorX, cursorY);
    this.zoomLevel *= zoomFactor;
    const worldPosAfterZoom = this.screenToWorld(cursorX, cursorY);
    this.offsetX += (worldPosBeforeZoom.x - worldPosAfterZoom.x);
    this.offsetY += (worldPosBeforeZoom.y - worldPosAfterZoom.y);
  }
}
```

**CameraController3D (estilo Blender):** dos modos intercambiables:
- **Órbita/Inspección:** rotación alrededor de un punto de pivote (el centro del mapa o el último punto clickeado), similar al middle-mouse-orbit de Blender. Usa coordenadas esféricas (radio, azimut, elevación) alrededor del pivote.
- **Vuelo Libre:** desplazamiento con WASD (adelante/atrás/strafe) y orientación con el movimiento del mouse (look-around), sin punto de pivote fijo, para recorrer el interior de cuevas.

```js
class CameraController3D extends AppObject {
  constructor(appManager) {
    super(appManager);
    this.mode = 'orbit'; // 'orbit' | 'flythrough'
  }
  onUpdate(dt) {
    if (this.mode === 'orbit') this._updateOrbit(dt);
    else this._updateFlythrough(dt);
  }
}
```

Un atajo de teclado o botón de UI alterna entre ambos modos (a definir en Fase 3 con la clase `UI`).

---

## 4. Estructura de Datos del Mapa (MapData)

Los datos lógicos se procesan como buffers planos de memoria directa para permitir transferencias ultrarrápidas a los hilos de los Web Workers (evitando la penalización por copia profunda).

### 4.1 Modo 2D (Matriz de Terreno Sólido)

```js
/**
 * @typedef {Object} MapData2D
 * @property {string} seed - Cadena alfanumérica visible al usuario (ej. "MONTANA-7X2")
 * @property {number} seedHash - Entero derivado de `seed` vía hash determinístico (uso interno de los generadores de ruido)
 * @property {number} width
 * @property {number} height
 * @property {number} cellSize
 * @property {Uint8Array} cells - 1 byte por celda = identificador de material (0 = Aire/Vacío)
 * @property {MaterialDef[]} materials - Catálogo estático de propiedades estructurales
 */
```

### 4.2 Modo 3D (Volumetría de Vóxels)

```js
/**
 * @typedef {Object} MapData3D
 * @property {string} seed - Cadena alfanumérica visible al usuario (ej. "MONTANA-7X2")
 * @property {number} seedHash - Entero derivado de `seed` vía hash determinístico
 * @property {number} sizeX
 * @property {number} sizeY
 * @property {number} sizeZ
 * @property {Uint8Array} voxels - Array unidimensional plano (X + sizeX * (Y + sizeY * Z))
 * @property {number} chunkSize - Dimensiones cúbicas de subdivisión (ej. 16x16x16)
 * @property {MaterialDef[]} materials
 */
```

### 4.3 Definición Estructural de Materiales

```js
/**
 * @typedef {Object} MaterialDef
 * @property {number} id
 * @property {string} name
 * @property {boolean} destructible
 * @property {number} hardness - Resistencia ante impactos/borrado
 * @property {string} color - Valor RGB directo utilizado en texturizado por color de vértices
 * @property {string} [textureId]
 */
```

El Agua es un `MaterialDef` más, sin estructura especial en `MapData`. Se distingue de los sólidos por su propio perfil de propiedades:

```js
{ id: 4, name: 'Agua', destructible: true, hardness: 0, color: '#3a7bd5', textureId: 'water_tex' }
```

**Nota de diseño:** al no haber simulación de físicas ni de fluidos, el Agua se comporta como un material estático más: no se derrama ni busca su nivel. Con `hardness: 0`, es el material más fácil de remover.

---

## 5. Generación Procedural y Determinismo

El usuario siempre ve/edita el seed como string; internamente, `seedHash = hashSeedToInt(seed)` es lo que se le pasa a `NoiseGenerator`/`createSeededRandom`. Mismo string → mismo hash → mismo mapa, siempre.

```js
// utils.js — hash determinístico string -> entero de 32 bits
function hashSeedToInt(seedString) {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (Math.imul(31, hash) + seedString.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}
```

1. **Pipeline determinista:** Semilla (Seed) → Evaluación de ruido coherente → Asignación por cotas geológicas / umbrales de cavidad → Escritura binaria en `MapData`.
2. **Ejecución en Web Workers:** las dimensiones masivas se procesan de forma asíncrona. Al concluir, el `ArrayBuffer` del terreno se transfiere instantáneamente al hilo visual principal empleando referencias Transferable.

---

## 6. Motor de Modificación de Terreno

La manipulación del entorno se modela como una mutación local directa sobre los arrays binarios de `MapData` (`Uint8Array`), garantizando que no exista desincronización entre la lógica de datos y la representación gráfica. El submotor encargado se denomina `TerrainModificationEngine`.

Tras cada mutación, el motor devuelve la región afectada (dirty rect en 2D, conjunto de chunks en 3D) para que el renderer redibuje o remalle únicamente lo modificado.

### 6.1 Operaciones sobre la Matriz de Datos (Pincel y Varita Mágica)

- **Sustracción (Goma de Borrar):** calcula todas las coordenadas (celdas en 2D / vóxels en 3D) dentro del radio circular o esférico del cursor y sobrescribe sus valores con `AIR_MATERIAL_ID` (Aire/Vacío).

- **Resistencia por Dureza (`hardness`):** cada material define cuánta "energía de impacto" resiste antes de destruirse. La Goma de Borrar aplica una energía de impacto fija por trazo/tick; una celda solo se destruye si esa energía supera su `hardness`.

```js
// TerrainModificationEngine.js
function tryDestroyCell(mapData, index, impactEnergy) {
  const materialId = mapData.cells[index] ?? mapData.voxels[index];
  const material = mapData.materials.find(m => m.id === materialId);
  if (!material || !material.destructible) return false;
  if (impactEnergy < material.hardness) return false; // Roca resiste impactos débiles
  setCellOrVoxel(mapData, index, AIR_MATERIAL_ID);
  return true;
}
```

Valores de referencia sugeridos: Arena `hardness: 1`, Tierra `hardness: 3`, Roca `hardness: 6` (la Roca requiere el doble de energía que la Tierra). El modo "Detonación" aplica una energía alta que perfora todo en un golpe; el modo "Continuo" aplica una energía baja por tick, por lo que la Roca tarda visiblemente más en perforarse.

- **Adición (Pincel de Escultura):** valida las coordenadas seleccionadas en el buffer y, si su valor actual es 0, sobrescribe la celda con el byte correspondiente al ID del material seleccionado (Tierra, Roca, Arena). El material depositado queda estático donde se dibujó, incluso si no está conectado al terreno existente.

- **Operaciones Masivas (Varita Mágica):** al activar la Purga o la Transmutación, se dispara un algoritmo de inundación asíncrono (Flood-Fill) desde el punto de origen del clic. Para evitar congelar el hilo principal de renderizado (UI), esta búsqueda de celdas conexas del mismo material se delega a un Web Worker. El Worker devuelve la lista de índices modificados y el `AppManager` actualiza el buffer de una sola pasada.
  - **Purga Masiva:** sobrescribe con aire todas las celdas de la región seleccionada.
  - **Transmutación Litológica:** reemplaza el `materialId` de todas las celdas de la región seleccionada por el de otro material (ej. Roca → Agua o Arena).

### 6.2 Operaciones Estilo Photoshop en MapData (Composición por Máscaras de Bits)

Para el Layer Manager, el buffer `cells`/`voxels` de `MapData2D`/`MapData3D` pasa a ser una composición lineal de múltiples buffers virtuales antes de renderizarse en Pixi.js o Babylon.js:

```
FinalBuffer[i] = Layer1[i] ⊕ Layer2[i]
```

Donde `⊕` representa una operación lógica o matemática parametrizada por el tipo de mezcla seleccionado.

- **Filtro GaussianBlur en Web Workers:** para evitar ralentizar el hilo de la interfaz de usuario, el suavizado del mapa se calcula convolucionando una matriz de vecindad de núcleo 3×3 o 5×5. Las regiones afectadas se marcan como dirty regions en 2D o se fuerza el re-mallado del chunk afectado en 3D.

- **Filtro Threshold (Binarización):** convierte la matriz de materiales a solo dos estados posibles a partir de un valor de corte, sin escala de grises intermedia.

```js
// Pseudo-lógica en ThresholdFilter.js
function applyThreshold(mapData2D, thresholdValue, solidMaterialId) {
  for (let i = 0; i < mapData2D.cells.length; i++) {
    const materialWeight = getMaterialWeight(mapData2D.cells[i]); // ej. hardness o densidad
    mapData2D.cells[i] = materialWeight >= thresholdValue ? solidMaterialId : AIR_MATERIAL_ID;
  }
}
```

Aplica sobre todo el buffer activo (o la selección de Varita Mágica, si hay una activa). Corre en Web Worker como el Blur y marca dirty regions/re-mallado igual que cualquier mutación masiva.

### 6.3 Modificadores de Vóxeles de Blender (Dynamic Topology & Noise Injection)

**Clase NoiseBrush:** la presión reportada por Pointer Events (`event.pressure`, 0 a 1) modula la **amplitud del ruido** inyectado, no el radio del trazo. Un lápiz táctil con soporte de presión es el input recomendado para esta herramienta (mouse/touch sin presión usan un valor fijo de amplitud por defecto).

```js
// Pseudo-lógica en NoiseBrush.js
function onPointerMove(event) {
  const pressure = event.pressure > 0 ? event.pressure : DEFAULT_PRESSURE_FALLBACK; // ej. 0.5
  const modulatedAmplitude = baseAmplitude * pressure;
  const noiseVal = NoiseGenerator.evaluate(x * freq, y * freq, z * freq) * modulatedAmplitude;
  if (noiseVal > umbralResistencia) {
    cells[index] = materialSelected;
  }
}
```

### 6.4 Rasterización de Primitivas Vectoriales a Vóxels Binarios

Dado que `MapData3D` almacena los datos en un buffer plano unidimensional de tipo `Uint8Array`, las herramientas de modelado deben trabajar mediante Rasterización por Funciones de Distancia Signada (SDF - Signed Distance Fields). Esto evita la costosa computación poligonal tradicional y permite una inyección asíncrona a través de los Web Workers:

```js
// Ejemplo matemático de SDF para una esfera en 3D — PrimitiveGenerator.js
function sdfEsfera(x, y, z, cx, cy, cz, radio) {
  let dx = x - cx, dy = y - cy, dz = z - cz;
  return Math.sqrt(dx*dx + dy*dy + dz*dz) - radio;
}
// Si sdfEsfera <= 0, la coordenada está DENTRO de la figura y se inyecta en el Uint8Array
```

### 6.5 Operaciones Booleanas CSG (Constructive Solid Geometry)

Las operaciones booleanas de modelado estructural se resuelven mediante lógica booleana a nivel de bits directamente en los buffers de memoria, antes de forzar el re-mallado de los chunks:

```js
// Lógica interna de BooleanProcessor.js ejecutada en Web Worker
for (let i = 0; i < localBoundingBox.length; i++) {
  let index = localBoundingBox[i];
  let esPrimitiva = primitivaBuffer[index] > 0;

  if (operacion === 'DIFFERENCE' && esPrimitiva) {
    cells[index] = 0; // Se vuelve Aire/Vacío (excavación geométrica)
  } else if (operacion === 'UNION' && esPrimitiva) {
    cells[index] = primitivaMaterialId; // Absorción de masa
  }
}
```

La operación `INTERSECT` conserva únicamente las celdas donde el mapa y la primitiva coinciden.

### 6.6 Extrusión por Curvas

La herramienta **Curve Extrude** (única herramienta de extrusión del proyecto) calcula una secuencia de matrices de transformación (Posición, Rotación, Escala) a lo largo de la curva generada en `BezierPath3D.js`. A medida que avanza el cálculo en el sub-hilo, se marcan todos los bloques colindantes como regiones modificadas, y al finalizar se aplican al buffer de una sola pasada. La extrusión puede vaciar o rellenar el terreno a su paso.

### 6.7 Tampón de Clonación Procedural (Clone Stamp, 2D)

Funciona como el Clone Stamp de Photoshop: el usuario marca un punto de origen (Alt+click) y luego pinta en otra zona, copiando el contenido de la región de origen desplazada según el offset entre origen y destino. Se clona el `materialId` byte a byte del `MapData2D.cells`, no una textura renderizada.

```js
// Pseudo-lógica en TerrainModificationEngine.js
function applyCloneStamp(mapData2D, sourceX, sourceY, targetX, targetY, radius) {
  const offsetX = targetX - sourceX;
  const offsetY = targetY - sourceY;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const srcMaterial = getCell2D(mapData2D, sourceX + dx, sourceY + dy);
      setCell2D(mapData2D, targetX + dx, targetY + dy, srcMaterial);
    }
  }
}
```

- Exclusivo de modo 2D.
- El offset origen→destino se recalcula si el usuario vuelve a fijar un nuevo punto de origen (comportamiento estándar de Photoshop).

### 6.8 Sistema de Capas (MapLayerManager)

`MapLayerManager` administra hasta **20 capas máximo por proyecto**, tanto en modo 2D como 3D. Cada capa es un buffer independiente y completo del mismo tamaño que el mapa activo:

```js
/**
 * @typedef {Object} MapLayer
 * @property {string} id
 * @property {string} name
 * @property {Uint8Array} buffer - mismo tamaño que cells (2D) o voxels (3D) del proyecto activo
 * @property {'multiply'|'add'|'subtract'|'normal'} blendMode
 * @property {boolean} visible
 * @property {number} opacity - 0 a 1, para mezclas ponderadas
 */
```

`MapLayerManager` mantiene un array de hasta 20 `MapLayer` y es responsable de:
- Crear/eliminar/reordenar capas (límite duro de 20; rechaza la creación de una 21ª).
- Recalcular el `FinalBuffer` (fórmula de 6.2) cuando cualquier capa cambia.
- Determinar sobre qué capa está pintando activamente cada `Tool` (el usuario selecciona la capa activa en la UI; las herramientas escriben sobre `layer.buffer`, no directamente sobre un buffer único).

El `Renderer2D`/`Renderer3D` siempre consume el `FinalBuffer` compuesto, nunca las capas individuales por separado.

### 6.9 Historial de Operaciones (recomendado, fuera del primer prototipo)

Por tratarse de un editor destructivo, las modificaciones de terreno deberían poder representarse como comandos reversibles (`CommandHistory → execute(command) → undo() / redo()`). La implementación puede quedar fuera del primer prototipo, pero la arquitectura no debe impedirla: las operaciones de `TerrainModificationEngine` deben devolver la región afectada y poder registrar el estado previo de esa región.

---

## 7. Sistema de Exportación

El `ExportManager` unifica las rutinas de empaquetado bajo una firma única. Los exportadores actúan como módulos desacoplados encargados de mapear las matrices a estructuras externas.

| Formato | Uso Destino | Contenido del Payload | Modo |
|---|---|---|---|
| JSON Propio | Editor / Debug | Volcado completo binario y paramétrico del editor para futuras cargas, con metadatos de semilla. | 2D/3D |
| PNG | Motores / Alturas | Imagen rasterizada donde los canales RGBA codifican los materiales o la elevación (heightmap en escala de grises). | 2D/3D |
| GLB | Motores Generales | Malla optimizada consolidada post-remallado con colores por vértice embebidos. Sustituye al formato OBJ por optimización de tamaño; Babylon.js lo genera vía su exportador GLTF2Export. | 3D |
| Unity Pack | Motor Unity | Archivo contenedor: GLB (3D) o PNG (2D) + JSON con convención de ejes Y-up. | 2D/3D |
| Godot Pack | Motor Godot | Estructuras adaptadas a nodos TileMap o mallas con inversión de escala nativa y orientación de ejes. | 2D/3D |

---

## 8. Rendimiento y Escalabilidad

- **Chunking en 3D:** obligatorio desde el día uno para evitar remallar mapas completos en cada edición.
- **Dirty rectangles en 2D:** solo redibujar regiones modificadas.
- **Web Workers:** generación, flood-fill, filtros, CSG y extrusión fuera del hilo principal.
- **Transferable objects / SharedArrayBuffer:** para mover datos de voxel/celdas entre worker y UI sin serialización costosa.
- **Límites de tamaño de mapa:** definir un tamaño máximo recomendado por modo (ej. 2D hasta 4096x4096 celdas, 3D hasta N chunks) para mantener framerate interactivo; estos límites deben ser configurables, no hardcodeados.
- **LOD (Level of Detail) en 3D:** opcional en fases posteriores, para mapas grandes vistos de lejos.

---

## 9. Estructura de Carpetas

Estructura real del proyecto (`ProceduralFieldMaker/`), extendida con las carpetas necesarias para los sistemas definidos en este TDD que todavía no existen.

```
ProceduralFieldMaker/
├── Assets/                     # Textures, fonts, icons, static resources
├── Classes/
│   ├── Base/
│   │   ├── AppObject.js
│   │   ├── Tools.js
│   │   └── Windows.js
│   ├── Export/                 # (new) ExportRegistry + individual exporters
│   │   ├── Exporters/
│   │   │   ├── GLBExporter.js
│   │   │   ├── GodotExporter.js
│   │   │   ├── JSONExporter.js
│   │   │   ├── PNGExporter.js
│   │   │   └── UnityExporter.js
│   │   └── ExportRegistry.js
│   ├── Managers/
│   │   ├── AppManager.js
│   │   ├── MapLayerManager.js
│   │   ├── ToolsManager.js
│   │   └── WindowsManager.js
│   ├── Map/                    # (new) MapData, generation, modification
│   │   ├── Curves/
│   │   │   └── BezierPath3D.js
│   │   ├── Filters/
│   │   │   ├── GaussianBlurFilter.js
│   │   │   └── ThresholdFilter.js
│   │   ├── Generators/
│   │   │   ├── NoiseGenerator.js
│   │   │   └── CellularAutomata.js
│   │   ├── Modeling/
│   │   │   ├── BooleanProcessor.js
│   │   │   └── PrimitiveGenerator.js
│   │   ├── MapData2D.js
│   │   ├── MapData3D.js
│   │   └── TerrainModificationEngine.js
│   ├── Render/                 # (new) Renderer2D/Renderer3D as AppObject
│   │   ├── CameraController2D.js
│   │   ├── CameraController3D.js
│   │   ├── Renderer2D.js
│   │   └── Renderer3D.js
│   ├── Tools/
│   │   ├── Brush.js
│   │   ├── CloneStamp.js
│   │   ├── Eraser.js
│   │   ├── MagicWand.js
│   │   └── NoiseBrush.js
│   ├── Windows/
│   │   ├── BrushSettings.js
│   │   ├── CloneStampSettings.js
│   │   ├── EraserSettings.js
│   │   ├── MagicWandSettings.js
│   │   └── NoiseBrushSettings.js
│   ├── App.js
│   └── UI.js
├── Libraries/
│   ├── pixi.js
│   └── babylon.js
├── utils.js
├── index.html
├── styles.css
└── README.md
```

---

## 10. Plan de Implementación por Fases

**Fase 0 — Bootstrap del proyecto (completada):**
- Estructura de carpetas y archivos del proyecto, con naming conventions documentadas.
- Clases base: `AppObject`, `Tools`, `Windows`.
- Managers: `AppManager` como orquestador único, `ToolsManager` y `WindowsManager` compuestos dentro de él.
- Clase `App` como punto de arranque único.
- Esqueletos de `Tools` y `Windows`, sin lógica interna todavía.
- CSS responsive base para el canvas (full-viewport, `touch-action: none`, safe-area insets).
- `utils.js` con funciones sueltas de propósito general.

**Fase 1 — Core + Destrucción:**
- `MapData2D` y `MapData3D` (factory functions, accesores de celdas/voxels), con `seed` string + `seedHash`.
- Generación procedural: ruido, autómata celular para cuevas, heightmap para 3D, estratificación por profundidad.
- `Renderer2D` (Pixi.js) y `Renderer3D` (Babylon.js) como `AppObject`, con render estático del mapa generado.
- Meshing de voxels por chunk (face-culling) para poder ver el terreno 3D.
- `TerrainModificationEngine`: adición, sustracción con modelo de dureza (`hardness`/`impactEnergy`), dirty regions (2D) y remallado por chunk afectado (3D).

**Fase 2 — Ventanas y Herramientas:**
- Lógica funcional completa de las herramientas (`Brush`, `Eraser`, `MagicWand`, `NoiseBrush`, `CloneStamp`) sobre el `MapData`.
- Ventanas de configuración por herramienta.
- Input unificado con Pointer Events (mouse + touch), incluyendo presión de lápiz para `NoiseBrush`.
- `ToolsManager`/`WindowsManager` gestionando cuál tool está activa y qué ventana está abierta.
- `MapLayerManager` con buffers de mezcla intermedios (hasta 20 capas).
- Filtros (Blur/Threshold) en Web Workers.
- Funciones SDF para primitivas (Toro, Cubos, Esferas, Cilindros) en `PrimitiveGenerator.js`, y operaciones booleanas en `BooleanProcessor.js`.
- Gizmos 3D como métodos de la clase `Tools`, para traslación/rotación/escala de herramientas de modelado antes del aplicado binario.
- Curve Extrude con `BezierPath3D.js` y envío por objetos transferibles.
- Flood-fill de la Varita Mágica (Purga y Transmutación) en Web Worker.

**Fase 3 — UI y Exportación:**
- Clase `UI`: construcción dinámica de los botones de `#controles` a partir de las tools registradas, layout distinto para mobile/desktop.
- `ExportRegistry` + exportadores concretos: `JSONExporter`, `PNGExporter`, `GLBExporter`.
- `UnityExporter` y `GodotExporter`, componiendo los exportadores anteriores + JSON de metadata con las convenciones de cada motor (ejes, escala de unidades).

**Fase 4 — Pulido y rendimiento:**
- Cola de prioridad entre jobs de Web Workers (generación, flood-fill, filtros, CSG, extrusión).
- Transferable objects para mover `Uint8Array` entre worker y UI sin costo de serialización.
- Límites de tamaño de mapa configurables (2D y 3D) para mantener framerate interactivo.
- Lazy allocation de capas vacías en `MapLayerManager`.
- Mitigación de aliasing en primitivas SDF y curvas (smooth voxels o normal-smoothing en el meshing).
- LOD en 3D para mapas grandes vistos de lejos (si aplica).

---

## 11. Riesgos Técnicos a Validar

- **Marching cubes en tiempo real:** puede ser costoso; validar con prototipo antes de comprometerse como opción por defecto.
- **Sincronización 2D↔3D:** si se quiere ver un mismo mapa en ambos modos, hay que definir la regla de conversión heightmap↔voxel.
- **Tamaño de exportación GLB:** al ser binario y con colores por vértice nativos, ya resuelve el problema de peso que tendría OBJ; si más adelante los mapas 3D crecen mucho, evaluar compresión Draco.
- **Convenciones Unity vs Godot:** difieren en sistema de ejes, escala de unidades y orientación de UV; `UnityExporter` y `GodotExporter` deben normalizar esto explícitamente.
- **CSG a nivel de bits sobre un `Uint8Array`** sin resolución fraccionaria puede producir bordes "de bloque" (aliasing) en las primitivas SDF y las curvas; evaluar smooth voxels o normal-smoothing en el meshing.
- **Costo combinado de Web Workers:** generación, flood-fill, blur, CSG y extrusión por curvas compiten por Web Workers; falta definir una cola de prioridad entre esos jobs (Fase 4).
- **Layer Manager + rendimiento:** hasta 20 buffers `Uint8Array` completos multiplica el uso de memoria y el costo de recomponerlos en cada edición; evaluar lazy allocation para capas vacías.
- **Dependencia de Babylon.js:** el equipo del `Renderer3D` debe consumir los buffers planos (`positions`/`normals`/`colors`/`indices`) del meshing y construir la geometría con la API de Babylon; validar temprano que la reconstrucción de mallas por chunk mantiene framerate interactivo.
