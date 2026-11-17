class TerrainBlastSettings extends ToolSettingsWindow {
  constructor(appManager, tool) {
    super(appManager, tool, 'Configuración de explosión', [
      { property: 'radius', label: 'Radio de explosión', type: 'range', min: 1, max: 32, step: 1 },
      { property: 'energy', label: 'Energía', type: 'range', min: 1, max: 100, step: 1 },
      { property: 'falloff', label: 'Caída de energía', type: 'range', min: 0, max: 1, step: 0.05 },
    ]);
  }
}
