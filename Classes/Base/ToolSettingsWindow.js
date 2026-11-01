/** Ventana genérica de configuración basada en un esquema de propiedades. */
class ToolSettingsWindow extends Windows {
  constructor(appManager, tool, title, fields) {
    super(appManager);
    this.tool = tool;
    this.title = title;
    this.fields = fields;
  }

  _renderContent(container) {
    const content = document.createElement('div');
    content.className = 'ui-window-content';
    this._appendFields(content);
    container.appendChild(content);
  }

  _appendFields(container) {
    for (const field of this.fields) this._appendField(container, field);
  }

  _appendField(container, field) {
    const wrapper = document.createElement('label');
    wrapper.className = 'ui-setting-field';
    wrapper.appendChild(this._createFieldCaption(field));
    wrapper.appendChild(this._createFieldControl(field));
    container.appendChild(wrapper);
  }

  _createFieldCaption(field) {
    const caption = document.createElement('span');
    caption.className = 'ui-setting-caption';
    caption.textContent = field.label;
    return caption;
  }

  _createFieldControl(field) {
    if (field.type === 'select') return this._createSelectControl(field);
    return this._createInputControl(field);
  }

  _createInputControl(field) {
    const input = document.createElement('input');
    input.type = field.type || 'number';
    input.min = field.min;
    input.max = field.max;
    input.step = field.step ?? 1;
    input.value = this.tool[field.property];
    input.addEventListener('input', () => this._updateToolValue(field, input.value));
    return input;
  }

  _createSelectControl(field) {
    const select = document.createElement('select');
    this._appendSelectOptions(select, field.options);
    select.value = String(this.tool[field.property]);
    select.addEventListener('change', () => this._updateToolValue(field, select.value));
    return select;
  }

  _appendSelectOptions(select, options) {
    for (const option of options) {
      const element = document.createElement('option');
      element.value = String(option.value);
      element.textContent = option.label;
      select.appendChild(element);
    }
  }

  _updateToolValue(field, rawValue) {
    const value = field.type === 'select' ? Number(rawValue) : this._normalizeNumericValue(field, rawValue);
    if (!Number.isFinite(value)) return;
    this.tool[field.property] = value;
    this._synchronizeSharedMaterialControl(field.property);
  }

  _synchronizeSharedMaterialControl(property) {
    const materialProperties = ['selectedMaterialId', 'replacementMaterialId'];
    if (!materialProperties.includes(property)) return;
    this.appManager.ui?.syncMaterialFromActiveTool?.();
  }

  _normalizeNumericValue(field, rawValue) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return NaN;
    return Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, value));
  }
}
