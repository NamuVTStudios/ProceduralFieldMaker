class BrushSettings extends ToolSettingsWindow {
  constructor(appManager, tool) {
    super(appManager, tool, 'Configuración del pincel', [
      { property: 'radius', label: 'Radio', type: 'range', min: 1, max: 24, step: 1 },
    ]);
  }
}
