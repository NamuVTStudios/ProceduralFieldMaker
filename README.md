# ProceduralFieldMaker

Web app to create 2D and 3D procedural maps with destructible terrain — a devs-focused editor/tool that exports the generated maps to external engines (Unity, Godot) and design formats (PNG, OBJ, JSON).

---

## 1. Folder Structure

Structure based on the current project layout, extended with the subsystems defined in the TDD (map generation, rendering, export) that don't exist as folders yet.

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
│   │   │   └── GodotExporter.js
│   │   │   ├── JSONExporter.js
│   │   │   ├── PNGExporter.js
│   │   │   ├── UnityExporter.js
│   │   └── ExportRegistry.js
│   ├── Managers/
│   │   ├── AppManager.js
│   │   ├── MapLayerManager.js
│   │   ├── ToolsManager.js
│   │   └── WindowsManager.js
│   ├── Map/                    # (new) MapData, generation, destruction
│   │   ├── Curves/
│   │   │   └── BezierPath3D.js
│   │   ├── Filters/
│   │   │   ├── GaussianBlurFilter.js
│   │   │   └── ThresholdFilter.js
│   │   ├── Generators/
│   │   │   ├── NoiseGenerator.js
│   │   │   ├── VoronoiGenerator.js
│   │   │   └── CellularAutomata.js
│   │   ├── Modeling/
│   │   │   ├── BooleanProcessor.js
│   │   │   └── PrimitiveGenerator.js
│   │   ├── Geometry/
│   │   │   ├── MarchingSquares2D.js
│   │   │   ├── PolylineSimplifier2D.js
│   │   │   └── TerrainMeshBuilder2D.js
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
│   ├── babylon.js
│   └── pixi.js
├── utils.js
├── index.html
├── styles.css
└── README.md
```

**Notes on the current structure:**
- `Map/`, `Render/` and `Export/` hold the systems defined in the TDD (generation and modification, rendering, exporters).
- The project has **no physics engine** (no Box2D / Cannon.js): see "Fuera de alcance" in the TDD.

---

## 2. Editing Controls

- **2D navigation:** draw with the left mouse button; pan with the middle or right button while dragging; zoom with the mouse wheel.
- **3D navigation:** edit with the left mouse button; orbit with the right button while dragging; pan with the middle button while dragging; zoom with the mouse wheel. Use the camera button or `Tab` to switch between orbit and fly cameras.
- **Materials:** choose a material from the top toolbar selector or click one of its color swatches. The selection is applied to the active tool when that tool supports a material target.
- **Layers:** use the right-side Layers panel to add/select/rename/delete/reorder layers, toggle visibility, and adjust opacity or blend mode. Select multiple layers with the row checkboxes, Ctrl/Cmd-click to add/remove a layer, or Shift-click to select a range. Use the `Mover` tool and drag on the canvas to translate the content of every selected layer (including its filter masks); this moves pixels/voxels, not the camera. `Todas` selects every layer and `Una` returns to the active layer only.
- **Hybrid 2D terrain:** the cell grid remains authoritative. Marching Squares extracts per-material contours and radial/Ramer-Douglas-Peucker simplification prepares compact boundary data. The production fill mesh is generated from exact horizontal material runs merged vertically into rectangles; each rectangle is split into two triangles. Because every rectangle contains one material only, the rendered triangles cannot bridge air gaps, craters, holes or another material. Maps above 262,144 cells or with more than 60,000 mesh rectangles use the direct grid renderer for responsiveness. Experimental Delaunay/alpha, Earcut and quadtree code is not loaded into the production renderer because it is unnecessary for a canonical grid and previously permitted oversized triangles at complex boundaries. 3D remains voxel/chunk based; Marching Cubes is not included.
- **Moving layers:** non-empty pixels/voxels moved outside the visible canvas are retained as sparse overflow and can be moved back; Undo/Redo includes off-canvas content.
- **Destructible terrain:** `Excavar` is a continuous manual brush. `Explosión` creates a crater at the clicked location; its settings control radius, energy and falloff. `Taladro` creates a tunnel between pointer-down and pointer-up positions by dragging. These tools use material hardness/destructibility and support Undo/Redo. Game systems can call `app.appManager.explodeTerrain(center, options)`, `applyProjectileImpact(center, options)`, or `drillTerrain(start, end, options)`.
- **Brand assets:** `Assets/ProceduralFieldMaker.svg` / `.png` are the square app icon; `Assets/ProceduralFieldMaker_Logo.svg` / `.png` are the horizontal wordmark.
- **Tool settings:** select a tool in the top toolbar; its settings window opens on the left.

---

## 3. File Naming

**Rule: one class per file, filename in PascalCase matching the class name exactly.**

This is the one concrete fix needed — the current files mix conventions (`appobject.js`, `toolsmanager.js` in lowercase vs. `magicWand.js`, `magicWandSettings.js` in camelCase). Standardizing removes the ambiguity of "how do I name the next file."

| NO | Recommended |
|---|---|
| `appobject.js` | `AppObject.js` |
| `tools.js` | `Tools.js` |
| `windows.js` | `Windows.js` |
| `appmanager.js` | `AppManager.js` |
| `toolsmanager.js` | `ToolsManager.js` |
| `windowsmanager.js` | `WindowsManager.js` |
| `brush.js` | `Brush.js` |
| `eraser.js` | `Eraser.js` |
| `magicWand.js` | `MagicWand.js` |
| `brushsettings.js` | `BrushSettings.js` |
| `erasersettings.js` | `EraserSettings.js` |
| `magicWandSettings.js` | `MagicWandSettings.js` |
| `app.js` | `App.js` |
| `ui.js` | `UI.js` |

**Exceptions (not classes, so not PascalCase):**
- `utils.js` — stays lowercase; it's a bag of standalone functions, not a class.
- `index.html`, `styles.css`, `README.md` — follow their own ecosystem conventions (lowercase for HTML/CSS entry files, uppercase for README by convention).
- Library files under `Libraries/` (`pixi.js`, `babylon.js`) — keep whatever casing the library itself ships with; don't rename third-party files.

**Reminder:** since this project loads everything via global `<script>` tags (no bundler), renaming files means updating the corresponding `src` paths in `index.html` too.

---

## 4. Code Naming Conventions

### 3.1 Classes
**PascalCase.** Already consistent in the project (`AppManager`, `ToolsManager`, `Brush`, `MagicWand`, `BrushSettings`) — keep it.

### 3.2 Methods & variables
**camelCase.**
```js
class Brush extends AppObject {
  onUpdate(deltaTime) {
    const brushRadius = this.getRadius();
  }
}
```

### 3.3 Private / internal methods
Prefix with an underscore. There's no true "private" in plain JS classes without `#`, so the underscore is a convention signaling "internal use, don't call from outside."
```js
class App {
  _setupCanvas() { }
  _bindGlobalEvents() { }
}
```
(`#truePrivateField` syntax is also valid JS and gives real privacy, but underscore-prefix is simpler to read across a team and is fine for this project's scale.)

### 3.4 Constants
**UPPER_SNAKE_CASE**, only for values that never change at runtime.
```js
const MAX_MAP_SIZE = 4096;
const DEFAULT_MODE = '2d';
const CHUNK_SIZE = 16;
```

### 3.5 Booleans
Prefix with `is`, `has`, or `can` so the name reads as a yes/no question.
```js
let isMobile = false;
let hasLayers = true;
let canExport = false;
```

### 3.6 Event handlers & lifecycle methods
- Lifecycle hooks inherited from `AppObject`: `onInit`, `onUpdate`, `onDestroy`.
- Handlers reacting to browser/DOM events: prefix `on` + event name — `onResize`, `onPointerDown`.
- Methods that broadcast a change to the rest of the app: prefix `emit` — `emitLayoutChange`, `emitToolChanged`.

### 3.7 Utility functions (`utils.js`)
**camelCase, verb-first, descriptive** — avoid short generic names that could collide with something from Pixi/Babylon (both loaded as globals).
```js
function createObjectFromTemplate(templateData, TargetClass, appManager) { }
function clampValue(value, min, max) { }
function loadJSONTemplate(path) { }
```
Avoid: `create()`, `clamp()`, `load()`, `init()` — too generic for a global-scope project with multiple third-party libraries.

### 3.8 Acronyms
Treat acronyms as a single word in PascalCase/camelCase: `UI` (not `Ui`), `getUrl` (not `getURL`) — pick one rule and apply it everywhere. Given the project already has a class named `UI`, the convention here is: **acronyms stay fully uppercase when they're a whole word/class name** (`UI`), and follow normal camelCase when they're part of a longer identifier (`mapUiState`, not `mapUIState`).

### 3.9 Manager/Tool/Window subclasses
Suffix pattern already established — keep it for anything new:
- Managers: `<Domain>Manager` (`ToolsManager`, `WindowsManager`, future `ExportManager`).
- Tool windows: `<ToolName>Settings` (`BrushSettings`, `EraserSettings`).
- Exporters: `<Target>Exporter` (`JSONExporter`, `UnityExporter`, `GodotExporter`).

---

## 5. Quick Reference

| Element | Convention | Example |
|---|---|---|
| Class file | PascalCase, matches class name | `MagicWand.js` |
| Class name | PascalCase | `MagicWand` |
| Method / variable | camelCase | `getActiveTool()` |
| Internal method | camelCase + `_` prefix | `_bindGlobalEvents()` |
| Constant | UPPER_SNAKE_CASE | `MAX_MAP_SIZE` |
| Boolean | `is`/`has`/`can` + camelCase | `isMobile` |
| Event handler | `on` + camelCase | `onResize()` |
| Broadcast method | `emit` + camelCase | `emitLayoutChange()` |
| Utility function | verb + descriptive camelCase | `createObjectFromTemplate()` |
| Manager class | `<Domain>Manager` | `WindowsManager` |
| Settings window class | `<Tool>Settings` | `EraserSettings` |
| Exporter class | `<Target>Exporter` | `GodotExporter` |
| Non-class file | lowercase | `utils.js`, `index.html` |


### Historial de edición

- Deshacer: `Ctrl+Z` (o `Cmd+Z` en macOS).
- Rehacer: `Ctrl+Y` o `Ctrl+Shift+Z` (también `Cmd` en macOS).
- También están disponibles los botones Deshacer/Rehacer en la barra de acciones.
- El historial es compartido por los modos 2D y 3D y se reinicia al crear/cerrar un proyecto.
- Cada trazo se guarda como una acción; cancelar un Pointer Event restaura el snapshot previo en vez de confirmar un trazo parcial.
- Las operaciones asíncronas de filtros y Varita Mágica mantienen su transacción hasta que finalizan.

### Empaquetado de versiones

Ejecutar `./package-release.sh [ruta/salida.zip]` desde el proyecto. El script excluye `Assets/CURRENT LOGO.png` de todos los ZIP de distribución.


## 6. Generación, terreno destructible e iluminación 3D

- `newProject(mode, { seed, ...generationOptions })` permite fijar una semilla para reproducir el mismo mapa. Si no se especifica, se genera una semilla nueva.
- La generación 2D utiliza Perlin/FBM para vista superior o lateral y autómatas celulares para cavernas laterales.
- La generación 3D utiliza un heightmap Perlin/FBM, materiales por profundidad y cavernas evaluadas con FBM 3D.
- Voronoi determinista opcional aplica regiones/biomas en la vista 2D superior, lateral y la superficie 3D; se configura con `voronoi`, `voronoiCellSize` y `voronoiBlend`. La UI inicial permite fijar semilla y estos parámetros; Voronoi permanece desactivado por defecto.
- La Goma destruye el material visible superior de la pila de capas, respetando `destructible` y `hardness`, tanto en 2D como en 3D. En 3D se remallan únicamente los chunks afectados y sus vecinos de frontera.
- Babylon.js configura una luz hemisférica y una luz direccional; las mallas activan `useVertexColors` y sus materiales reciben iluminación de escena.

## 7. Estado verificado de exportación

- JSON: serializa mapas 2D y 3D, incluyendo dimensiones, materiales y semilla.
- PNG: exporta mapas 2D rasterizados y heightmaps a partir de mapas 3D.
- GLB: el exportador 3D construye las mallas con `VoxelMeshBuilder` y llama a Babylon.js `GLTF2Export`; se verificó la construcción de la escena y el despacho de descarga con un serializador simulado, pero no la generación binaria GLB de extremo a extremo en un navegador real.
- Unity/Godot: los exportadores actuales producen geometría OBJ y materiales MTL para importación manual. No generan todavía un proyecto Unity (`.unitypackage`/escena) ni un proyecto Godot (`.tscn`/recursos).
- La API `AppManager.exportProject()` se expone mediante el panel **Exportar** de la barra de trabajo. En 2D ofrece JSON/PNG; en 3D ofrece JSON/PNG heightmap/GLB/Unity OBJ+MTL/Godot OBJ+MTL.



## 8. Generation controls and workspace exporting

- The creation menu lets the user select the material palette before generating a map. `Terreno básico` selects Sand, Earth and Rock; `Todos` selects all default materials; individual checkboxes support custom palettes. Selecting no materials blocks project creation with a visible validation message.
- An empty seed field requests a new random seed for each project. Reusing the same seed and generation options reproduces the same terrain. The chosen seed and generation options are stored in `mapData.generation` and included in JSON export.
- The water-level slider is interpreted as a percentage measured upward from the base of the terrain. It affects 2D side-view water and the 3D water table; it only produces water when the Water material is selected. Top-down 2D continues to distribute water through its procedural noise thresholds.
- Voronoi cell size and influence remain configurable. The selected material IDs are treated as an allow-list: the generator does not emit unselected material IDs. The water ID is excluded from terrain-role fallback so it cannot be accidentally used as rock.
- The workspace Export panel is opened with the `Exportar` toolbar action. It exposes JSON and PNG for 2D; JSON, PNG heightmap, GLB, and OBJ+MTL variants labelled Unity/Godot for 3D. GLB availability depends on Babylon.js serializers. Unity/Godot entries are interchange meshes, not native project packages.
- PNG export returns a Promise and reports canvas encoding failures to the UI instead of throwing inside an asynchronous `toBlob` callback.
- Terrain is excavated with the `Excavar` tool. Dragging removes the visible upper material according to each material's `destructible` and `hardness` properties. The excavation brush interpolates between pointer samples to reduce gaps; each stroke is one Undo action.


## Runtime terrain destruction and canvas resizing

Terrain destruction is available to gameplay code through `app.appManager` after a project is open. These methods operate on the topmost visible material layer, respect each material's `destructible` flag and `hardness`, reveal the material below, remesh affected 3D chunks, and create one Undo/Redo history action per call.

```js
// Radial explosion: sphere in 3D, circle in 2D.
app.appManager.explodeTerrain({ x: 32, y: 12, z: 32 }, {
  radius: 7,
  energy: 14,
  falloff: 0.6,
});

// Projectile or rigid-body contact.
app.appManager.applyProjectileImpact({ x: 28, y: 10, z: 30 }, {
  radius: 2.5,
  energy: 9,
});

// Drill, beam, or tunnel along a segment.
app.appManager.drillTerrain(
  { x: 4, y: 10, z: 18 },
  { x: 52, y: 10, z: 18 },
  { radius: 1.5, energy: 12 },
);
```

These calls are intended to be triggered by a game's projectile, explosion, or collision callbacks. They provide voxel/cell terrain removal; a separate physics system is required for falling debris, rigid-body chunks, or dynamic object simulation. The manual **Excavar** tool remains available in the editor.

The workspace **Tamaño** panel resizes the current map while preserving the overlapping region of every paint layer and filter mask. 2D dimensions are measured in cells; 3D dimensions are measured in voxels. The resize operation is included in Undo/Redo. Limits: 2D 16-4096 per axis and 4,194,304 cells; 3D 8-512 per axis and 4,194,304 voxels.

## 9. Hybrid 2D terrain geometry and off-canvas layer preservation

- `MapData2D.cells` remains the authoritative editable grid. `TerrainMeshBuilder2D` derives a render mesh from it after edits; it does not replace the grid or become a second editable source of truth.
- `MarchingSquares2D` reconstructs per-material contours. `PolylineSimplifier2D` applies radial-distance filtering followed by iterative Ramer-Douglas-Peucker simplification, following the approach documented by Simplify.js.
- `DelaunayAlphaShape2D` builds a Bowyer-Watson Delaunay triangulation, selects triangles by circumradius (`alpha`), extracts alpha boundaries, and derives Voronoi dual edges from adjacent triangle circumcenters. The procedural generator also retains its deterministic Voronoi noise generator for terrain regions.
- `EarcutTriangulator2D` is an internal ear-clipping fallback for simple contours; it is not a bundled copy of Mapbox Earcut. Components with holes are triangulated by validated Delaunay/alpha when possible.
- `TerrainQuadtree2D` recursively subdivides mixed material regions and supplies adaptive sample points. Each Delaunay/alpha or Earcut candidate triangle is checked against the cells it covers; safe triangles are retained individually and uncovered solid cells are patched with exact grid triangles. Oversized/conflicting meshes fall back to the grid renderer rather than drawing incorrect holes or material overlaps.
- The hybrid mesh renderer is 2D. 3D terrain remains voxel-grid based and is remeshed by Babylon.js chunks; Marching Cubes/3D alpha shapes are not part of this implementation.
- Moving a layer beyond the visible canvas stores its off-canvas non-air cells/voxels and non-transparent mask values in sparse `overflowContent`. These values move with the layer, can be moved back into view, survive resize, and are included in Undo/Redo snapshots and history memory accounting.

The design references supplied for this implementation are Simplify.js (radial distance + Douglas-Peucker), Mapbox Earcut (polygon triangulation with holes), the Delaunator Delaunay/Voronoi dual guide, and the quadtree-based destructible-terrain demo. The project uses its own focused implementations/adaptations rather than vendoring those codebases.


### Hybrid-mesh validation snapshot

On the fixed 128×96 test seeds, the hybrid renderer produced 4,320 triangles for a top-down map without Voronoi (versus 24,576 triangles for two triangles per solid cell), 8,637 with Voronoi, and 7,998/7,822 for the tested side-view variants. These are measured test cases, not guarantees for arbitrary maps. Coverage checks found no missing or conflicting cell centers.

### Industry references and current scope

- **Noita** is a reference for material-aware, persistent terrain changes. The current PFM grid stores material IDs but does not yet simulate falling sand, fluid/gas dynamics, reactions or rigid-body debris.
- **Worms** is a reference for lasting craters and tunnels. The design keeps edits persistent and rebuilds the affected 2D derived mesh rather than replacing the world with temporary impact visuals.
- **Astroneer** is a reference for clearly separated terrain-tool modes (excavate, raise, flatten). PFM currently exposes Excavar, Explosión and Taladro; raise/fill and flatten remain future tools.
- **A Game About Digging A Hole** is a reference for a focused digging/discovery loop; resource inventory, equipment upgrades and progression are not implemented in PFM.
