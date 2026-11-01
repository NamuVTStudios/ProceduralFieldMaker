class NoiseBrushSettings extends ToolSettingsWindow {
  constructor(appManager, tool) {
    super(appManager, tool, 'Configuración del pincel de ruido', [
      { property: 'radius', label: 'Radio', type: 'range', min: 1, max: 20, step: 1 },
      { property: 'frequency', label: 'Frecuencia', type: 'range', min: 0.01, max: 1, step: 0.01 },
      { property: 'baseAmplitude', label: 'Amplitud', type: 'range', min: 0.1, max: 4, step: 0.1 },
      { property: 'resistanceThreshold', label: 'Umbral de resistencia', type: 'range', min: -1, max: 1, step: 0.05 },
    ]);
  }
}
