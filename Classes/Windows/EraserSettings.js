class EraserSettings extends ToolSettingsWindow {
  constructor(appManager, tool) {
    super(appManager, tool, 'Configuración de excavación', [
      { property: 'radius', label: 'Radio de excavación', type: 'range', min: 1, max: 24, step: 1 },
      { property: 'impactEnergy', label: 'Potencia del pico (dureza máxima)', type: 'range', min: 1, max: 10, step: 1 },
    ]);
  }
}
