# GDD "Procedural Field Maker"

**Tipo de producto:** Herramienta Interactiva de Autoría / Web Sandbox
**Plataforma:** Aplicación Web (SPA - Navegador), usable en PC y celular/tableta
**Enfoque:** Generación Procedural y Terreno Destructible

---

## Visión General del Proyecto (High Concept)

El propósito fundamental de Procedural Field Maker consiste en salvar la brecha técnica entre los generadores topográficos meramente estáticos y las herramientas de escultura de terreno interactivas. El sistema provee un laboratorio de autoría donde el usuario puede instanciar relieves orgánicos a partir de formulaciones matemáticas y manipularlos de forma no destructiva o destructiva mediante un conjunto de herramientas de interacción directa.

El proyecto **no incluye simulación de físicas**: el terreno no cae, no colapsa ni genera escombros. Lo que el usuario esculpe o destruye queda exactamente donde lo dejó.

## Flujo de Ejecución y Bucle del Usuario (User Loop)

El ciclo operativo de la herramienta se articula en tres etapas claramente diferenciadas:

- **Configuración Inicial e Instanciación:** el usuario define la dimensionalidad de trabajo (2D o 3D) y calibra los parámetros de variabilidad topológica antes de inicializar el lienzo.
- **Escultura, Interacción y Deformación:** el usuario navega el espacio generado, inspecciona la distribución de cavidades y altera activamente la topología con pinceles de adición, sustracción destructiva o selección zonal.
- **Congelamiento, Serialización y Exportación:** en cualquier punto de la sesión, la conformación topológica resultante puede guardarse y serializarse en formatos estructurados estándar para su importación directa en motores de videojuegos o programas de modelado.

---

## Sistema de Generación Procedural y Parametrización

El mundo no proviene de activos prerrenderizados ni de modelos estáticos, sino de una computación matemática determinista dividida en dos modalidades.

### Dimensiones Operativas

**Modo 2D (Corte Transversal / Estratigráfico):** representa una sección de corte vertical (ejes X, Y). Está optimizado para dinámicas de plataformas, exploración lateral y minería de cavernas con lectura directa de capas geológicas.

**Modo 3D (Espacio Volumétrico):** extiende la geometría a un volumen euclidiano continuo (ejes X, Y, Z), permitiendo la escultura de cráteres esféricos tridimensionales, mesetas y sistemas de túneles transitables desde cualquier ángulo.

### Parámetros de Generación Ajustables

- **Semilla Determinista (Seed):** cadena alfanumérica que fija el estado inicial del generador pseudoaleatorio, garantizando la reproducibilidad exacta de cualquier mapa en diferentes sesiones o estaciones de trabajo.
- **Frecuencia y Amplitud del Relieve:** control continuo que regula la rugosidad topográfica superficial (desde llanuras suaves hasta formaciones montañosas abruptas).
- **Densidad y Umbral de Cavernas:** modificador volumétrico que determina el volumen de oquedades y bifurcaciones subterráneas dentro del cuerpo del terreno.
- **Estratificación de Materiales:** gradiente configurable que distribuye los diferentes tipos de estratos en función de la cota de profundidad (cobertura vegetal, tierra intermedia, manto rocoso profundo y estrato base).

---

## Herramientas de Edición y Destrucción (Toolset)

Por tratarse de un editor destructivo, se recomienda incorporar un sistema de historial de operaciones. Las modificaciones de terreno deberían poder representarse como comandos reversibles:

`CommandHistory → execute(command) → undo() / redo()`

La implementación puede quedar fuera del primer prototipo, pero la arquitectura debe evitar impedirla posteriormente.

### Herramientas Base

| Herramienta | Función Principal | Comportamiento | Parámetros |
|---|---|---|---|
| **Pincel (Adición / Escultura)** | Depósito y creación de masa de terreno. | Incorpora material continuo siguiendo la trayectoria del cursor. Deposita discos de material en 2D o volúmenes esféricos en 3D sobre celdas vacías. El material depositado queda estático donde se dibujó. | Radio del trazo; selector de material (Tierra, Roca, Arena) |
| **Goma de Borrar (Sustracción / Destrucción)** | Excavación, apertura de cavidades y vaciado. | Sustrae la masa dentro de su radio de impacto, simulando perforaciones continuas o cráteres explosivos. Cada material resiste distinto: la Arena cede con facilidad, la Tierra se destruye con un radio de impacto normal y la Roca requiere el doble de impacto para perforarse. | Radio de acción; modo (Continuo / Detonación individual) |
| **Varita Mágica (Selección Conexa)** | Segmentación inteligente por continuidad estructural. | Calcula el cuerpo cerrado de un mismo material o cavidad contigua sin alterar regiones desconectadas adyacentes. | Tolerancia de continuidad; umbral de volumen |

### Operaciones Derivadas sobre Regiones Seleccionadas (Varita Mágica)

- **Purga Masiva:** vaciado instantáneo de una cámara o veta seleccionada, permitiendo despejar galerías completas de un solo comando.
- **Transmutación Litológica:** sustitución directa de un estrato seleccionado por otro material de propiedades distintas (ej. transmutar una masa de roca en depósitos de agua o arena).

### Sub-módulo: Herramientas Estilo "Photoshop" (Manipulación de Capas y Datos)

- **Gestor de Capas (Channel/Layer Manager):** permite aislar la computación del mapa en diferentes niveles apilables, hasta un máximo de **20 capas por proyecto** (ej: Capa Base de Terreno, Capa de Cuevas, Capa de Minerales). El diseñador puede mezclar capas usando operaciones de fusión (Multiply, Add, Subtract).
- **Tampón de Clonación (Clone Stamp, solo 2D):** funciona igual que en Photoshop. El usuario fija un punto de origen y luego pinta en otra zona, copiando el contenido de la región de origen con el mismo desplazamiento relativo.
- **Filtros de Suavizado y Contraste Topográfico:** herramientas globales de un solo clic para alterar la matriz de datos:
  - **Filtro Desenfocar (Blur/Gaussian):** suaviza los bordes abruptos del terreno esculpido a mano.
  - **Filtro Umbral (Threshold):** convierte gradientes suaves en acantilados escarpados de forma binaria, dejando únicamente dos estados (sólido y vacío), igual que el filtro de umbral de un editor de imágenes.

### Sub-módulo: Herramientas Estilo "Blender" (Escultura Dinámica y Modificadores)

- **Modificador de Arrugas / Ruido Integrado (Noise Brush):** brocha de escultura 2D o 3D que, en lugar de empujar el terreno de forma uniforme, aplica un ruido fractal dinámico sobre la superficie del trazo para texturizar rocas de forma orgánica. En móvil y tableta se recomienda un lápiz táctil con presión: la presión modula la amplitud del ruido.
- **Brocha de Licuado / Erosión Manual (Liquify & Erode):** permite simular el paso del tiempo bajo el cursor, licuando el terreno o erosionando la roca según su dureza física.
- **Instanciador de Primitivas Paramétricas (Mesh Primitives):** genera geometrías básicas (Cubos, Esferas, Cilindros, Toros) directamente en el espacio de trabajo. El usuario puede alterar el radio, altura, resolución y rotación mediante gizmos 3D dinámicos antes de estampar la figura de forma permanente en el mapa.
- **Extrusión Guiada por Curvas (Curve Extrude / Loft):** permite dibujar un camino lineal o curvo en el espacio (usando puntos de control Bézier) y extruir una forma poligonal (como un túnel circular o cuadrado) a lo largo de esa trayectoria. El sistema vacía o rellena el terreno automáticamente a su paso.
- **Operaciones Booleanas en Tiempo Real (Boolean Modifiers):** usan una geometría secundaria como herramienta de corte o unión.
  - **Unión (Union):** fusiona dos volúmenes de terreno con diferentes materiales.
  - **Diferencia (Difference):** usa un objeto geométrico como molde para excavar formas perfectas (ej: usar un cilindro inclinado para tallar un túnel de ventilación artificial).
  - **Intersección (Intersect):** conserva únicamente el terreno donde el volumen del mapa y la primitiva se cruzan.

---

## Reglas de Interacción de Materiales

El terreno es estático: no hay gravedad, colapso ni caída de material. Los materiales se diferencian únicamente por su resistencia a la destrucción.

- **Comportamiento del Pincel (Adición de Masa):** el usuario puede depositar material continuo (Tierra, Roca, Arena) sobre celdas vacías utilizando formas de discos en 2D o esferas en 3D. Si dibuja material flotando en el aire sin conexión al terreno existente, ese material permanece en su lugar.
- **Resistencia por Dureza:** los materiales reaccionan distinto ante la Goma de Borrar:
  - **Arena (dureza baja):** cede con el impacto mínimo.
  - **Tierra (dureza media):** se destruye con un radio de impacto normal.
  - **Roca (dureza alta):** requiere el doble de impacto que la Tierra para perforarse.
- **Agua:** es un material más, con dureza cero. Se comporta como un material estático: no se derrama ni busca su nivel.

---

## Navegación y Control de Entorno

**Modo 2D (estilo zoom de Photoshop):** paneo fluido mediante arrastre con botón secundario/central y zoom óptico focalizado hacia el cursor mediante la rueda del ratón.

**Modo 3D (estilo Blender):**
- **Modo Inspección / Órbita:** rotación angular y cabeceo centrados en un punto de pivote para evaluar relieves exteriores.
- **Modo Vuelo Libre (Fly-Through):** desplazamiento omnidireccional con teclas WASD y orientación con cursor para inspeccionar el interior de sistemas cavernarios.

---

## Exportación y Persistencia de Datos

El sistema garantiza la interoperabilidad de los mapas mediante descargas locales desde el navegador:

- **Datos Numéricos y Estructurados (Game Engines):** serialización en matrices JSON con metadatos de semilla, coordenadas e identificadores de celda para su reconstrucción nativa en Godot, Unity u otros entornos.
- **Formatos Gráficos / Mapas de Altura:** exportación de mapas de relieve en escala de grises (Heightmaps) o imágenes nítidas PNG del corte geológico 2D.
- **Mallas Tridimensionales:** generación y descarga de archivos de geometría estándar (GLB) con la volumetría esculpida para su uso en suites de renderizado y modelado 3D.
