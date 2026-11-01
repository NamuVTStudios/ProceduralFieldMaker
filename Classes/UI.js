/**
 * UI.js
 * Interfaz principal: barra espaciosa, selector de materiales,
 * ayuda de navegación y panel de capas.
 */
class UI {
    constructor(appManager) {
        this.appManager = appManager;
        this._isMobile = this._detectMobile();
        this.toolButtons = new Map();
        this.selectedMaterialId = 2;
        this.filterMode = 'destructive';
        this.layerPanelVisible = true;
        this.isLayerOpacityTransactionOpen = false;
        this._buildInitialView();
        this._bindResizeEvents();
    }

    _buildInitialView() {
        this._buildWorkspaceSurface();
        this._buildMainInterface();
        this._buildFloatingPanels();
        this._mountSettingsWindows();
    }

    _buildWorkspaceSurface() {
        this._buildRoot();
        this._buildViewports();
    }

    _buildMainInterface() {
        this._buildMenu();
        this._buildToolbar();
    }

    _buildFloatingPanels() {
        this._buildLayerPanel();
        this._buildNavigationGuide();
    }

    _bindResizeEvents() {
        window.addEventListener('resize', () => this._onResize());
        this._bindLayerOpacityTransactionEvents();
    }

    _bindLayerOpacityTransactionEvents() {
        window.addEventListener('pointerup', () => this._endLayerOpacityTransaction());
        window.addEventListener('pointercancel', () => this._cancelLayerOpacityTransaction());
        window.addEventListener('blur', () => this._endLayerOpacityTransaction());
    }

    _el(tag, className = '', text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    _buildRoot() {
        this.root = this._el('div', 'ui-root');
        document.body.appendChild(this.root);
    }

    _buildViewports() {
        this._buildCanvasContainer2D();
        this._buildCanvas3D();
    }

    _buildCanvasContainer2D() {
        this.canvasContainer2D = this._el('div', 'ui-viewport ui-hidden');
        this.canvasContainer2D.id = 'canvasContainer2D';
        document.body.appendChild(this.canvasContainer2D);
    }

    _buildCanvas3D() {
        this.renderCanvas3D = this._el('canvas', 'ui-viewport ui-hidden');
        this._configureCanvas3D(this.renderCanvas3D);
        document.body.appendChild(this.renderCanvas3D);
    }

    _configureCanvas3D(canvas) {
        canvas.id = 'renderCanvas';
        canvas.setAttribute('aria-label', 'Lienzo tridimensional');
        canvas.tabIndex = 0;
    }

    _buildMenu() {
        this.menu = this._el('div', 'ui-menu');
        this.menu.appendChild(this._buildMenuCard());
        this.root.appendChild(this.menu);
    }

    _buildMenuCard() {
        const card = this._el('div', 'ui-menu-card');
        this._appendMenuHeading(card);
        this._appendMenuOptions(card);
        return card;
    }

    _appendMenuHeading(card) {
        this._appendMenuLogo(card);
        this._appendMenuTitle(card);
    }

    _appendMenuLogo(card) {
        const logo = this._el('img', 'ui-menu-logo');
        logo.src = 'Assets/ProceduralFieldMaker.svg';
        logo.alt = 'Procedural Field Maker';
        card.appendChild(logo);
    }

    _appendMenuTitle(card) {
        card.appendChild(this._el('h1', 'ui-menu-title', 'Procedural Field Maker'));
        card.appendChild(this._el('p', 'ui-menu-subtitle', 'Elegí la dimensión del lienzo de trabajo'));
    }

    _appendMenuOptions(card) {
        const options = this._createModeOptions();
        card.appendChild(options);
    }

    _createModeOptions() {
        const options = this._el('div', 'ui-menu-options');
        options.appendChild(this._buildModeButton('2d', '2D', 'Corte transversal'));
        options.appendChild(this._buildModeButton('3d', '3D', 'Espacio volumétrico'));
        return options;
    }

    _buildModeButton(mode, title, description) {
        const button = this._el('button', 'ui-mode-button');
        button.type = 'button';
        this._appendModeButtonLabels(button, title, description);
        button.addEventListener('click', () => this._startProject(mode));
        return button;
    }

    _appendModeButtonLabels(button, title, description) {
        button.appendChild(this._el('span', 'ui-mode-title', title));
        button.appendChild(this._el('span', 'ui-mode-desc', description));
    }

    _buildToolbar() {
        this.toolbar = this._el('header', 'ui-toolbar ui-hidden');
        this.toolbar.id = 'controles';
        this._populateToolbar(this.toolbar);
        this.root.appendChild(this.toolbar);
    }

    _populateToolbar(container) {
        this._buildBrand(container);
        this._buildToolbarContent(container);
    }

    _buildBrand(container) {
        const brand = this._el('div', 'ui-brand');
        this._populateBrand(brand);
        container.appendChild(brand);
    }

    _populateBrand(brand) {
        brand.appendChild(this._createBrandLogo());
        brand.appendChild(this._createBrandCopy());
    }

    _createBrandLogo() {
        const logo = this._el('img', 'ui-brand-logo');
        logo.src = 'Assets/ProceduralFieldMaker.svg';
        logo.alt = '';
        return logo;
    }

    _createBrandCopy() {
        const identity = this._el('div', 'ui-brand-copy');
        identity.appendChild(this._el('strong', '', 'Procedural Field Maker'));
        identity.appendChild(this._el('span', '', 'Editor de terrenos'));
        return identity;
    }

    _buildToolbarContent(container) {
        this.toolbarContent = this._el('div', 'ui-toolbar-content');
        this._populateToolbarContent(this.toolbarContent);
        container.appendChild(this.toolbarContent);
    }

    _populateToolbarContent(content) {
        this._buildToolSection(content);
        this._buildMaterialSection(content);
        this._buildActionSection(content);
    }

    _buildToolSection(container) {
        const section = this._createToolbarSection('Herramientas', 'ui-tools-section');
        this._populateToolSection(section);
        container.appendChild(section);
    }

    _populateToolSection(section) {
        this.toolList = this._el('div', 'ui-tool-list');
        section.appendChild(this.toolList);
        this._populateToolButtons();
    }

    _createToolbarSection(title, className) {
        const section = this._el('section', `ui-toolbar-section ${className}`);
        section.appendChild(this._el('span', 'ui-toolbar-label', title));
        return section;
    }

    _populateToolButtons() {
        this._clearToolButtons();
        this._appendRegisteredTools();
        this._highlightActive(this.appManager.toolsManager.getActiveTool());
    }

    _clearToolButtons() {
        this.toolList.replaceChildren();
        this.toolButtons.clear();
    }

    _appendRegisteredTools() {
        const tools = this.appManager.toolsManager.getTools();
        for (const tool of tools) this._appendToolButton(tool);
    }

    _appendToolButton(tool) {
        const button = this._createToolButton(tool);
        this.toolButtons.set(tool, button);
        this.toolList.appendChild(button);
    }

    _createToolButton(tool) {
        const visual = this._getToolVisual(tool);
        const button = this._el('button', 'ui-tool-button');
        this._configureToolButton(button, visual);
        button.addEventListener('click', () => this._activateTool(tool));
        return button;
    }

    _configureToolButton(button, visual) {
        button.type = 'button';
        button.title = visual.title;
        button.setAttribute('aria-label', visual.title);
        button.appendChild(this._el('span', 'ui-tool-icon', visual.icon));
        button.appendChild(this._el('span', 'ui-tool-label', visual.label));
    }

    _getToolVisual(tool) {
        const visuals = {
            Brush: { icon: '✎', label: 'Pincel', title: 'Pincel: agrega material' },
            Eraser: { icon: '▱', label: 'Goma', title: 'Goma: elimina material' },
            NoiseBrush: { icon: '▦', label: 'Ruido', title: 'Pincel de ruido procedural' },
            MagicWand: { icon: '✧', label: 'Varita', title: 'Varita mágica: relleno conectado' },
            CloneStamp: { icon: '◉', label: 'Clonar', title: 'Tampón de clonación' },
        };
        return visuals[tool.name] || { icon: '◇', label: tool.label || tool.name, title: tool.name };
    }

    _activateTool(tool) {
        this._hideLayerPanelForMobile();
        this.appManager.toolsManager.setActive(tool);
        this._highlightActive(tool);
        this._syncMaterialSelectionWithTool();
    }

    _hideLayerPanelForMobile() {
        if (!this._isMobile) return;
        this.layerPanelVisible = false;
        this.layerPanel.classList.add('ui-hidden');
    }

    _highlightActive(activeTool) {
        for (const [tool, button] of this.toolButtons) {
            button.classList.toggle('active', tool === activeTool);
        }
    }

    _buildMaterialSection(container) {
        const section = this._createToolbarSection('Material activo', 'ui-material-section');
        this._populateMaterialSection(section);
        container.appendChild(section);
    }

    _populateMaterialSection(section) {
        const controls = this._el('div', 'ui-material-controls');
        controls.appendChild(this._createMaterialSelect());
        controls.appendChild(this._createMaterialSwatches());
        section.appendChild(controls);
        this.refreshMaterials();
    }

    _createMaterialSelect() {
        this.materialSelect = this._el('select', 'ui-material-select');
        this.materialSelect.setAttribute('aria-label', 'Seleccionar material');
        this.materialSelect.addEventListener('change', () => this._setSelectedMaterial(this.materialSelect.value));
        return this.materialSelect;
    }

    _createMaterialSwatches() {
        this.materialSwatches = this._el('div', 'ui-material-swatches');
        return this.materialSwatches;
    }

    refreshMaterials() {
        if (!this.materialSelect) return;
        const materials = this._getAvailableMaterials();
        this._populateMaterialOptions(materials);
        this._populateMaterialSwatches(materials);
        this._syncMaterialSelectValue();
    }

    _getAvailableMaterials() {
        const storedMaterials = this.appManager.mapData?.materials || [];
        const materials = storedMaterials.length ? storedMaterials : createDefaultMaterials();
        const air = { id: 0, name: 'Aire / vacío', color: 'transparent' };
        return [air, ...materials.filter(material => material.id !== 0)];
    }

    _populateMaterialOptions(materials) {
        this.materialSelect.replaceChildren();
        for (const material of materials) this._appendMaterialOption(material);
    }

    _appendMaterialOption(material) {
        const option = this._el('option', '', material.name);
        option.value = String(material.id);
        this.materialSelect.appendChild(option);
    }

    _populateMaterialSwatches(materials) {
        this.materialSwatches.replaceChildren();
        for (const material of materials) this._appendMaterialSwatch(material);
    }

    _appendMaterialSwatch(material) {
        const button = this._createMaterialSwatch(material);
        button.addEventListener('click', () => this._setSelectedMaterial(material.id));
        this.materialSwatches.appendChild(button);
    }

    _createMaterialSwatch(material) {
        const button = this._el('button', 'ui-material-swatch');
        button.type = 'button';
        button.style.setProperty('--swatch-color', material.color || '#ffffff');
        button.title = material.name;
        button.dataset.materialId = String(material.id);
        button.setAttribute('aria-label', `Seleccionar ${material.name}`);
        return button;
    }

    _setSelectedMaterial(rawId) {
        const materialId = Number(rawId);
        if (!Number.isInteger(materialId)) return;
        this.selectedMaterialId = materialId;
        this._applyMaterialToActiveTool(materialId);
        this._syncMaterialSelectValue();
    }

    _applyMaterialToActiveTool(materialId) {
        const tool = this.appManager.toolsManager.getActiveTool();
        if (!tool) return;
        if ('selectedMaterialId' in tool) tool.selectedMaterialId = materialId;
        if ('replacementMaterialId' in tool) tool.replacementMaterialId = materialId;
    }

    _syncMaterialSelectionWithTool() {
        const tool = this.appManager.toolsManager.getActiveTool();
        const materialId = tool?.selectedMaterialId ?? tool?.replacementMaterialId;
        if (Number.isInteger(materialId)) this.selectedMaterialId = materialId;
        this._syncMaterialSelectValue();
    }

    syncMaterialFromActiveTool() {
        this._syncMaterialSelectionWithTool();
    }

    _syncMaterialSelectValue() {
        this.materialSelect.value = String(this.selectedMaterialId);
        for (const swatch of this.materialSwatches.children) {
            swatch.classList.toggle('active', Number(swatch.dataset.materialId) === this.selectedMaterialId);
        }
    }

    _buildActionSection(container) {
        const section = this._createToolbarSection('Acciones y vista', 'ui-actions-section');
        this._populateActionSection(section);
        container.appendChild(section);
    }

    _populateActionSection(section) {
        this._appendHistoryControls(section);
        this._appendFilterActions(section);
        this._appendLayerActions(section);
        this._appendWorkspaceActions(section);
    }

    _appendHistoryControls(section) {
        const controls = this._el('div', 'ui-history-controls');
        this.undoButton = this._appendActionButton(controls, '↶ Deshacer', 'ui-action-button ui-history-button', () => this.appManager.undo());
        this.redoButton = this._appendActionButton(controls, '↷ Rehacer', 'ui-action-button ui-history-button', () => this.appManager.redo());
        section.appendChild(controls);
        this.refreshHistoryControls();
    }

    refreshHistoryControls() {
        if (!this.undoButton || !this.redoButton) return;
        const manager = this.appManager.mapLayerManager;
        this.undoButton.disabled = !manager?.canUndo?.();
        this.redoButton.disabled = !manager?.canRedo?.();
        this.undoButton.title = 'Deshacer (Ctrl+Z)';
        this.redoButton.title = 'Rehacer (Ctrl+Y o Ctrl+Shift+Z)';
    }

    _appendFilterActions(section) {
        this._appendFilterModeControl(section);
        this._appendActionButton(section, 'Filtro Blur', 'ui-action-button', () => this._applyFilter('gaussian-blur', { kernelSize: 3 }));
        this._appendActionButton(section, 'Umbral', 'ui-action-button', () => this._applyThresholdFilter());
    }

    _appendFilterModeControl(section) {
        section.appendChild(this._createFilterModeControl());
    }

    _createFilterModeControl() {
        const control = this._el('label', 'ui-filter-mode-control');
        control.appendChild(this._el('span', '', 'Modo de filtro'));
        this.filterModeSelect = this._createFilterModeSelect();
        control.appendChild(this.filterModeSelect);
        return control;
    }

    _createFilterModeSelect() {
        const select = this._el('select', 'ui-filter-mode-select');
        select.id = 'uiFilterMode';
        this._appendFilterModeOptions(select);
        select.value = this.filterMode;
        select.addEventListener('change', () => this._syncFilterMode());
        return select;
    }

    _appendFilterModeOptions(select) {
        this._appendFilterModeOption(select, 'destructive', 'Destructivo');
        this._appendFilterModeOption(select, 'non-destructive', 'No destructivo');
    }

    _appendFilterModeOption(select, value, label) {
        const option = this._el('option', '', label);
        option.value = value;
        select.appendChild(option);
    }

    _syncFilterMode() {
        this.filterMode = this.filterModeSelect.value;
    }

    _appendLayerActions(section) {
        this._appendActionButton(section, '+ Capa', 'ui-action-button ui-primary-action', () => this._createLayer());
        this._appendActionButton(section, 'Capas', 'ui-action-button', () => this.toggleLayerPanel());
    }

    _appendWorkspaceActions(section) {
        this.cameraModeButton = this._el('button', 'ui-action-button ui-camera-mode-button');
        this.cameraModeButton.type = 'button';
        this.cameraModeButton.addEventListener('click', () => this._toggleCameraMode());
        section.appendChild(this.cameraModeButton);
        this._appendActionButton(section, 'Menú', 'ui-action-button', () => this._onMenuButton());
    }

    _appendActionButton(parent, label, className, callback) {
        const button = this._el('button', className, label);
        button.type = 'button';
        button.addEventListener('click', callback);
        parent.appendChild(button);
        return button;
    }


    _applyThresholdFilter() {
        const options = this._getThresholdFilterOptions();
        return this._applyFilter('threshold', options);
    }

    _getThresholdFilterOptions() {
        const layer = this.appManager.mapLayerManager?.getActiveLayer();
        const materialId = Number(layer?.materialId);
        const material = (this.appManager.mapData?.materials || []).find(item => item.id === materialId);
        if (!material) return { threshold: 3, solidMaterialId: 3 };
        const threshold = Number(material.density ?? material.hardness ?? 1);
        return { threshold: Number.isFinite(threshold) ? threshold : 1, solidMaterialId: material.id };
    }

    _applyFilter(filterName, options) {
        if (!this.appManager.hasProject()) return Promise.resolve(false);
        return this._dispatchFilterRequest(filterName, options);
    }

    _dispatchFilterRequest(filterName, options) {
        const request = { ...options, mode: this._getFilterMode() };
        return this.appManager.applyFilter(filterName, request)
            .then(result => this._refreshAfterFilter(result))
            .catch(error => this._handleFilterError(error));
    }

    _getFilterMode() {
        return this.filterModeSelect?.value || this.filterMode;
    }

    _refreshAfterFilter(result) {
        if (result) this.refreshLayerPanel();
        return result;
    }

    _handleFilterError(error) {
        console.error('No se pudo aplicar el filtro:', error);
        return false;
    }

    _createLayer() {
        const manager = this.appManager.mapLayerManager;
        const layer = manager.createLayer();
        if (!layer) return;
        this.refreshLayerPanel();
    }

    _toggleCameraMode() {
        const controller = this.appManager.renderer?.cameraController;
        if (!controller || typeof controller.toggleMode !== 'function') return;
        controller.toggleMode();
    }

    refreshCameraModeUI() {
        this._refreshCameraModeButton();
        this._refreshNavigationGuide();
    }

    _refreshCameraModeButton() {
        const is3D = this.appManager.mode === '3d';
        this.cameraModeButton.classList.toggle('ui-hidden', !is3D);
        if (!is3D) return;
        const mode = this.appManager.renderer?.cameraController?.mode || 'orbit';
        this.cameraModeButton.textContent = mode === 'orbit' ? 'Cámara: Orbitar' : 'Cámara: Volar';
    }

    _buildLayerPanel() {
        this.layerPanel = this._el('aside', 'ui-layer-panel ui-hidden');
        this._populateLayerPanel(this.layerPanel);
        this.root.appendChild(this.layerPanel);
    }

    _populateLayerPanel(panel) {
        this._buildLayerPanelHeader(panel);
        this._buildLayerPanelList(panel);
        this._buildLayerPanelSettings(panel);
    }

    _buildLayerPanelList(panel) {
        this.layerList = this._el('div', 'ui-layer-list');
        panel.appendChild(this.layerList);
    }

    _buildLayerPanelHeader(container) {
        const header = this._el('div', 'ui-layer-panel-header');
        this._populateLayerPanelHeader(header);
        container.appendChild(header);
    }

    _populateLayerPanelHeader(header) {
        header.appendChild(this._el('strong', '', 'Capas'));
        this._appendLayerHeaderActions(header);
    }

    _appendLayerHeaderActions(header) {
        this._appendActionButton(header, '+ Nueva', 'ui-layer-add', () => this._createLayer());
        this._appendActionButton(header, '×', 'ui-layer-close', () => this.toggleLayerPanel(false));
    }

    _buildLayerPanelSettings(container) {
        const settings = this._el('div', 'ui-layer-settings');
        this._buildLayerOpacityControl(settings);
        this._buildLayerBlendControl(settings);
        container.appendChild(settings);
    }

    _buildLayerOpacityControl(container) {
        const field = this._el('label', 'ui-layer-field');
        field.appendChild(this._createOpacityHeader());
        field.appendChild(this._createOpacityInput());
        container.appendChild(field);
    }

    _createOpacityHeader() {
        const header = this._el('div', 'ui-layer-field-header');
        header.appendChild(this._el('span', '', 'Opacidad'));
        this.layerOpacityValue = this._el('span', '', '100%');
        header.appendChild(this.layerOpacityValue);
        return header;
    }

    _createOpacityInput() {
        this.layerOpacityInput = this._el('input');
        this.layerOpacityInput.type = 'range';
        this.layerOpacityInput.min = '0';
        this.layerOpacityInput.max = '100';
        this.layerOpacityInput.step = '1';
        this.layerOpacityInput.addEventListener('pointerdown', () => this._beginLayerOpacityTransaction());
        this.layerOpacityInput.addEventListener('input', () => this._updateActiveLayerOpacity());
        this.layerOpacityInput.addEventListener('change', () => this._endLayerOpacityTransaction());
        return this.layerOpacityInput;
    }

    _buildLayerBlendControl(container) {
        const field = this._el('label', 'ui-layer-field');
        this._populateBlendField(field);
        container.appendChild(field);
    }

    _populateBlendField(field) {
        field.appendChild(this._el('span', 'ui-layer-field-label', 'Modo de mezcla'));
        field.appendChild(this._createBlendSelect());
    }

    _createBlendSelect() {
        this.layerBlendSelect = this._el('select', 'ui-layer-select');
        this._populateBlendOptions();
        this.layerBlendSelect.addEventListener('change', () => this._updateActiveLayerBlendMode());
        return this.layerBlendSelect;
    }

    _populateBlendOptions() {
        this._appendBlendOption('normal', 'Normal');
        this._appendBlendOption('multiply', 'Multiplicar');
        this._appendBlendOption('add', 'Sumar');
        this._appendBlendOption('subtract', 'Restar');
    }

    _appendBlendOption(value, label) {
        const option = this._el('option', '', label);
        option.value = value;
        this.layerBlendSelect.appendChild(option);
    }

    refreshLayerPanel() {
        if (!this.layerList) return;
        this._populateLayerRows();
        this._syncLayerSettings();
    }

    _populateLayerRows() {
        this.layerList.replaceChildren();
        const layers = this.appManager.mapLayerManager.getLayers().slice().reverse();
        for (const layer of layers) this._appendLayerRow(layer);
    }

    _appendLayerRow(layer) {
        const row = this._el('div', 'ui-layer-row');
        this._configureLayerRow(row, layer);
        this.layerList.appendChild(row);
    }

    _configureLayerRow(row, layer) {
        row.classList.toggle('active', layer === this.appManager.mapLayerManager.getActiveLayer());
        row.classList.toggle('ui-layer-filter-row', layer.kind === 'filter');
        this._appendLayerRowControls(row, layer);
    }

    _appendLayerRowControls(row, layer) {
        this._appendLayerVisibilityButton(row, layer);
        this._appendLayerSelectButton(row, layer);
        this._appendLayerActionButtons(row, layer);
        this._appendLayerMaskControls(row, layer);
    }

    _appendLayerVisibilityButton(row, layer) {
        const button = this._createLayerVisibilityButton(layer);
        button.addEventListener('click', () => this._toggleLayerVisibility(layer));
        row.appendChild(button);
    }

    _createLayerVisibilityButton(layer) {
        const label = layer.visible ? 'Ocultar capa' : 'Mostrar capa';
        const button = this._el('button', 'ui-layer-icon-button', layer.visible ? '◉' : '○');
        button.type = 'button';
        button.title = label;
        button.setAttribute('aria-label', label);
        return button;
    }

    _appendLayerSelectButton(row, layer) {
        const button = this._el('button', 'ui-layer-name', layer.name);
        button.type = 'button';
        button.title = 'Seleccionar capa';
        button.addEventListener('click', () => this._selectLayer(layer));
        row.appendChild(button);
    }

    _appendLayerMaskControls(row, layer) {
        const masks = layer.masks || [];
        if (masks.length === 0) return;
        const maskGroup = this._el('div', 'ui-layer-mask-list');
        for (const mask of masks) this._appendLayerMaskRow(maskGroup, layer, mask);
        row.appendChild(maskGroup);
    }

    _appendLayerMaskRow(container, layer, mask) {
        const button = this._createLayerIconButton(mask.enabled ? '◈' : '◇', `${mask.name}: ${mask.enabled ? 'desactivar' : 'activar'}`);
        button.classList.add('ui-layer-mask-toggle');
        button.addEventListener('click', () => this._toggleLayerMask(layer, mask));
        container.appendChild(button);
        const remove = this._createLayerIconButton('×', `Eliminar ${mask.name}`);
        remove.addEventListener('click', () => this._removeLayerMask(layer, mask));
        container.appendChild(remove);
        const label = this._el('span', 'ui-layer-mask-name', mask.name);
        container.appendChild(label);
    }

    _toggleLayerMask(layer, mask) {
        this.appManager.mapLayerManager.setLayerMaskEnabled(layer.id, mask.id, !mask.enabled);
        this.refreshLayerPanel();
    }

    _removeLayerMask(layer, mask) {
        this.appManager.mapLayerManager.removeLayerMask(layer.id, mask.id);
        this.refreshLayerPanel();
    }

    _appendLayerActionButtons(row, layer) {
        this._appendLayerOrderButtons(row, layer);
        this._appendLayerManagementButtons(row, layer);
    }

    _appendLayerOrderButtons(row, layer) {
        this._appendLayerIconAction(row, '↑', 'Subir capa', () => this._moveLayer(layer, 1));
        this._appendLayerIconAction(row, '↓', 'Bajar capa', () => this._moveLayer(layer, -1));
    }

    _appendLayerManagementButtons(row, layer) {
        this._appendLayerIconAction(row, '✎', 'Renombrar capa', () => this._renameLayer(layer));
        this._appendLayerIconAction(row, '×', 'Eliminar capa', () => this._removeLayer(layer));
    }

    _appendLayerIconAction(row, label, title, callback) {
        const button = this._createLayerIconButton(label, title);
        button.addEventListener('click', callback);
        row.appendChild(button);
    }

    _createLayerIconButton(label, title) {
        const button = this._el('button', 'ui-layer-icon-button', label);
        button.type = 'button';
        button.title = title;
        button.setAttribute('aria-label', title);
        return button;
    }

    _selectLayer(layer) {
        this.appManager.mapLayerManager.setActiveLayer(layer.id);
        this.refreshLayerPanel();
    }

    _toggleLayerVisibility(layer) {
        this.appManager.mapLayerManager.setLayerVisibility(layer.id, !layer.visible);
        this.refreshLayerPanel();
    }

    _moveLayer(layer, offset) {
        const layers = this.appManager.mapLayerManager.getLayers();
        const sourceIndex = layers.findIndex(item => item.id === layer.id);
        const targetIndex = sourceIndex + offset;
        if (targetIndex < 0 || targetIndex >= layers.length) return;
        this.appManager.mapLayerManager.reorderLayer(layer.id, targetIndex);
        this.refreshLayerPanel();
    }

    _renameLayer(layer) {
        const name = window.prompt('Nombre de la capa:', layer.name);
        if (name === null) return;
        this.appManager.mapLayerManager.renameLayer(layer.id, name);
        this.refreshLayerPanel();
    }

    _removeLayer(layer) {
        const confirmed = window.confirm(`¿Eliminar la capa "${layer.name}"?`);
        if (!confirmed) return;
        const removed = this.appManager.mapLayerManager.removeLayer(layer.id);
        if (removed) this.refreshLayerPanel();
    }

    _syncLayerSettings() {
        const layer = this.appManager.mapLayerManager.getActiveLayer();
        this._setLayerControlsEnabled(Boolean(layer));
        if (!layer) return;
        this._syncSelectedLayerValues(layer);
    }

    _syncSelectedLayerValues(layer) {
        const opacity = Math.round(layer.opacity * 100);
        this.layerOpacityInput.value = String(opacity);
        this.layerOpacityValue.textContent = `${opacity}%`;
        this.layerBlendSelect.value = layer.blendMode;
    }

    _setLayerControlsEnabled(enabled) {
        this.layerOpacityInput.disabled = !enabled;
        this.layerBlendSelect.disabled = !enabled;
    }

    _beginLayerOpacityTransaction() {
        if (this.isLayerOpacityTransactionOpen) return;
        this.isLayerOpacityTransactionOpen = true;
        this.appManager.mapLayerManager.beginHistoryTransaction('Cambiar opacidad de capa');
    }

    _endLayerOpacityTransaction() {
        if (!this.isLayerOpacityTransactionOpen) return;
        this.isLayerOpacityTransactionOpen = false;
        this.appManager.mapLayerManager.endHistoryTransaction();
    }

    _cancelLayerOpacityTransaction() {
        if (!this.isLayerOpacityTransactionOpen) return;
        this.isLayerOpacityTransactionOpen = false;
        this.appManager.mapLayerManager.cancelHistoryTransaction();
    }

    _updateActiveLayerOpacity() {
        const layer = this.appManager.mapLayerManager.getActiveLayer();
        if (!layer) return;
        const value = Number(this.layerOpacityInput.value);
        this.appManager.mapLayerManager.setLayerOpacity(layer.id, value / 100);
        this.layerOpacityValue.textContent = `${value}%`;
    }

    _updateActiveLayerBlendMode() {
        const layer = this.appManager.mapLayerManager.getActiveLayer();
        if (!layer) return;
        this.appManager.mapLayerManager.setLayerBlendMode(layer.id, this.layerBlendSelect.value);
    }

    toggleLayerPanel(forceState) {
        this.layerPanelVisible = forceState ?? !this.layerPanelVisible;
        this.layerPanel.classList.toggle('ui-hidden', !this.layerPanelVisible);
        this._synchronizeMobilePanelVisibility();
        if (this.layerPanelVisible) this.refreshLayerPanel();
    }

    _synchronizeMobilePanelVisibility() {
        if (!this._isMobile) return;
        if (this.layerPanelVisible) this.appManager.windowsManager.closeAll();
        if (!this.layerPanelVisible) this.appManager.toolsManager.showActiveToolSettings();
    }

    _buildNavigationGuide() {
        this.navigationGuide = this._el('aside', 'ui-navigation-guide ui-hidden');
        this.navigationTitle = this._el('strong', '', 'Mover la vista');
        this.navigationInstructions = this._el('div', 'ui-navigation-lines');
        this.navigationGuide.appendChild(this.navigationTitle);
        this.navigationGuide.appendChild(this.navigationInstructions);
        this.root.appendChild(this.navigationGuide);
    }

    _refreshNavigationGuide() {
        this.navigationInstructions.replaceChildren();
        const instructions = this._getNavigationInstructions();
        for (const instruction of instructions) {
            this.navigationInstructions.appendChild(this._el('span', '', instruction));
        }
    }

    _getNavigationInstructions() {
        if (this.appManager.mode !== '3d') return this._get2DNavigationInstructions();
        if (this._isFlyCameraActive()) return this._getFlyCameraInstructions();
        return this._getOrbitCameraInstructions();
    }

    _get2DNavigationInstructions() {
        return ['Desplazar: botón central o derecho + arrastrar', 'Zoom: rueda del mouse', 'Dibujar: botón izquierdo'];
    }

    _getOrbitCameraInstructions() {
        return ['Orbitar: botón derecho + arrastrar', 'Desplazar: botón central + arrastrar', 'Zoom: rueda del mouse', 'Volar: botón de cámara o Tab'];
    }

    _getFlyCameraInstructions() {
        return ['Mirar: botón derecho + arrastrar', 'Mover: teclas W / A / S / D', 'Zoom: rueda del mouse', 'Volver a orbitar: botón de cámara o Tab'];
    }

    _isFlyCameraActive() {
        return this.appManager.renderer?.cameraController?.mode === 'flythrough';
    }

    _mountSettingsWindows() {
        this.appManager.windowsManager.mountAll(this.root);
    }

    refreshToolButtons() {
        this._populateToolButtons();
        this._syncMaterialSelectionWithTool();
    }

    showMenu() {
        this.appManager.windowsManager.closeAll();
        this._toggleWorkspaceElementsVisibility(false);
        this._toggleMenuVisibility(true);
    }

    showWorkspace() {
        this._hideLayerPanelForMobile();
        this._showWorkspaceSurface();
        this._refreshWorkspaceState();
        this.appManager.toolsManager.showActiveToolSettings();
    }

    _showWorkspaceSurface() {
        this._toggleMenuVisibility(false);
        this._toggleWorkspaceElementsVisibility(true);
        this._syncActiveViewport();
    }

    _refreshWorkspaceState() {
        this._refreshWorkspacePanels();
        this.refreshCameraModeUI();
    }

    _refreshWorkspacePanels() {
        this.refreshMaterials();
        this.refreshLayerPanel();
    }

    _toggleMenuVisibility(isVisible) {
        this.menu.classList.toggle('ui-hidden', !isVisible);
    }

    _toggleWorkspaceElementsVisibility(isVisible) {
        this.toolbar.classList.toggle('ui-hidden', !isVisible);
        this.navigationGuide.classList.toggle('ui-hidden', !isVisible);
        this.layerPanel.classList.toggle('ui-hidden', !isVisible || !this.layerPanelVisible);
    }

    _syncActiveViewport() {
        const mode = this.appManager.mode;
        this.canvasContainer2D.classList.toggle('ui-hidden', mode !== '2d');
        this.renderCanvas3D.classList.toggle('ui-hidden', mode !== '3d');
    }

    _startProject(mode) {
        this.appManager.newProject(mode);
        this.showWorkspace();
    }

    _onMenuButton() {
        const confirmed = window.confirm('¿Volver al menú? Se pierde el lienzo actual.');
        if (!confirmed) return;
        this._executeProjectTeardown();
    }

    _executeProjectTeardown() {
        this.appManager.closeProject();
        this.showMenu();
        this._hideAllViewports();
    }

    _hideAllViewports() {
        this.canvasContainer2D.classList.add('ui-hidden');
        this.renderCanvas3D.classList.add('ui-hidden');
    }

    _detectMobile() {
        const query = window.matchMedia('(max-width: 680px)').matches;
        return query || 'ontouchstart' in window;
    }

    _onResize() {
        const previousLayout = this._isMobile;
        this._isMobile = this._detectMobile();
        this._evaluateLayoutMutation(previousLayout);
    }

    _evaluateLayoutMutation(previousLayout) {
        if (previousLayout === this._isMobile) return;
        this.appManager.emitLayoutChange(this._isMobile);
    }
}
