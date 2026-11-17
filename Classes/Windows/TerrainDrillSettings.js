class TerrainDrillSettings extends ToolSettingsWindow {
  constructor(appManager, tool) {
    super(appManager, tool, 'Configuración de taladro', [
      { property: 'radius', label: 'Radio del túnel', type: 'range', min: 1, max: 12, step: 0.5 },
      { property: 'energy', label: 'Energía de perforación', type: 'range', min: 1, max: 100, step: 1 },
      { property: 'falloff', label: 'Caída de energía', type: 'range', min: 0, max: 1, step: 0.05 },
    ]);
  }
}
