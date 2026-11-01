class MagicWandSettings extends ToolSettingsWindow {
  constructor(appManager, tool) {
    super(appManager, tool, 'Configuración de la varita mágica', [
      { property: 'replacementMaterialId', label: 'Material de reemplazo', type: 'select', options: [
        { value: 0, label: 'Aire / Purga' }, { value: 1, label: 'Arena' }, { value: 2, label: 'Tierra' },
        { value: 3, label: 'Roca' }, { value: 4, label: 'Agua' },
      ] },
      { property: 'maxFillLimit', label: 'Límite de celdas', type: 'number', min: 100, max: 1000000, step: 100 },
    ]);
  }
}
