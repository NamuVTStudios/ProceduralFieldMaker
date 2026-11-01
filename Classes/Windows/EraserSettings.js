class EraserSettings extends ToolSettingsWindow {
  constructor(appManager, tool) {
    super(appManager, tool, 'Configuración de la goma', [
      { property: 'radius', label: 'Radio', type: 'range', min: 1, max: 24, step: 1 },
      { property: 'impactEnergy', label: 'Energía de impacto', type: 'range', min: 1, max: 10, step: 1 },
    ]);
  }
}
