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

## 2. File Naming

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

## 3. Code Naming Conventions

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

## 4. Quick Reference

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
