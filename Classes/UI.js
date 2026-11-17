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
        this.generationMaterialInputs = new Map();
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
        this._buildExportPanel();
        this._buildCanvasSizePanel();
        this._buildNavigationGuide();
        this._buildWorkspaceDocks();
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
        const layout = this._el('div', 'ui-menu-layout');
        this._appendMenuPrimary(layout);
        layout.appendChild(this._buildGenerationOptions());
        card.appendChild(layout);
        return card;
    }

    _appendMenuPrimary(layout) {
        const primary = this._el('section', 'ui-menu-primary');
        const heading = this._el('header', 'ui-menu-heading');
        this._appendMenuHeading(heading);
        primary.appendChild(heading);
        primary.appendChild(this._createModeOptions());
        this.importMenuButton = this._appendActionButton(
            primary,
            'Abrir mapa guardado',
            'ui-action-button ui-menu-open-button',
            () => this.importInput.click(),
        );
        this.importMenuStatus = this._el('p', 'ui-import-menu-status');
        primary.appendChild(this.importMenuStatus);
        layout.appendChild(primary);
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

    _buildGenerationOptions() {
        const panel = this._el('section', 'ui-generation-options');
        this._initializeGenerationControls();
        this._appendGenerationControls(panel);
        return panel;
    }

    _initializeGenerationControls() {
        this.seedInput = this._createSeedInput();
        this.voronoiEnabled = this._createVoronoiToggle();
        this.voronoiCellSize = this._createVoronoiCellSizeInput();
        this.voronoiBlend = this._createVoronoiBlendInput();
        this.waterLevelInput = this._createWaterLevelInput();
    }

    _appendGenerationControls(panel) {
        panel.appendChild(this._el('strong', '', 'Generación procedural'));
        panel.appendChild(this.seedInput);
        panel.appendChild(this._createGenerationHelp());
        panel.appendChild(this.voronoiEnabled.parentElement);
        panel.appendChild(this._createLabeledControl('Tamaño de celdas Voronoi', this.voronoiCellSize));
        panel.appendChild(this._createLabeledControl('Influencia Voronoi', this.voronoiBlend));
        panel.appendChild(this._createWaterLevelControl());
        panel.appendChild(this._buildGenerationMaterialSelection());
        this.generationStatus = this._el('div', 'ui-generation-status');
        panel.appendChild(this.generationStatus);
    }

    _createGenerationHelp() {
        return this._el('p', 'ui-generation-help', 'Dejá la semilla vacía para crear un mundo aleatorio. La misma semilla y las mismas opciones reproducen el mismo terreno. El nivel de agua solo actúa si seleccionás Agua.');
    }

    _createWaterLevelInput() {
        const input = this._el('input', 'ui-generation-range');
        input.type = 'range';
        input.min = '0.05';
        input.max = '0.90';
        input.step = '0.01';
        input.value = '0.65';
        input.setAttribute('aria-label', 'Nivel del agua para vista lateral y 3D');
        return input;
    }

    _createWaterLevelControl() {
        const wrapper = this._el('label', 'ui-generation-control ui-water-level-control');
        this._appendWaterLevelHeading(wrapper);
        wrapper.appendChild(this._createWaterLevelRangeRow());
        return wrapper;
    }

    _appendWaterLevelHeading(wrapper) {
        wrapper.appendChild(this._el('span', '', 'Nivel del agua · lateral y 3D'));
    }

    _createWaterLevelRangeRow() {
        const row = this._el('div', 'ui-generation-range-row');
        this.waterLevelValue = this._el('output', 'ui-generation-value', '65%');
        row.appendChild(this.waterLevelInput);
        row.appendChild(this.waterLevelValue);
        this.waterLevelInput.addEventListener('input', () => this._updateWaterLevelValue());
        return row;
    }

    _updateWaterLevelValue() {
        this.waterLevelValue.textContent = `${Math.round(Number(this.waterLevelInput.value) * 100)}%`;
    }

    _buildGenerationMaterialSelection() {
        const group = this._el('fieldset', 'ui-generation-materials');
        group.appendChild(this._el('legend', '', 'Materiales del terreno'));
        this.generationMaterialInputs.clear();
        for (const material of createDefaultMaterials()) this._appendGenerationMaterial(group, material);
        this._appendGenerationMaterialPresets(group);
        return group;
    }

    _appendGenerationMaterial(group, material) {
        const label = this._el('label', 'ui-generation-material-option');
        const input = this._el('input');
        input.type = 'checkbox';
        input.checked = true;
        input.value = String(material.id);
        input.dataset.materialId = String(material.id);
        const swatch = this._el('span', 'ui-generation-material-swatch');
        swatch.style.setProperty('--swatch-color', material.color);
        label.appendChild(input);
        label.appendChild(swatch);
        label.appendChild(this._el('span', '', material.name));
        group.appendChild(label);
        this.generationMaterialInputs.set(material.id, input);
    }

    _appendGenerationMaterialPresets(group) {
        const controls = this._el('div', 'ui-generation-presets');
        this._appendMaterialPresetButton(controls, 'Terreno básico', [1, 2, 3]);
        this._appendMaterialPresetButton(controls, 'Todos', null);
        this._appendMaterialPresetButton(controls, 'Ninguno', []);
        group.appendChild(controls);
    }

    _appendMaterialPresetButton(container, label, materialIds) {
        const button = this._el('button', 'ui-generation-all-materials', label);
        button.type = 'button';
        button.addEventListener('click', () => this._applyGenerationMaterialPreset(materialIds));
        container.appendChild(button);
    }

    _applyGenerationMaterialPreset(materialIds) {
        if (materialIds === null) return this._setAllGenerationMaterials(true);
        for (const [id, input] of this.generationMaterialInputs) {
            input.checked = materialIds.includes(id);
        }
    }

    _setAllGenerationMaterials(enabled) {
        for (const input of this.generationMaterialInputs.values()) input.checked = enabled;
    }

    _getSelectedGenerationMaterialIds() {
        return Array.from(this.generationMaterialInputs.entries())
            .filter(([, input]) => input.checked)
            .map(([materialId]) => materialId);
    }

    _createSeedInput() {
        const input = this._el('input', 'ui-generation-input');
        input.type = 'text';
        input.placeholder = 'Semilla aleatoria (o escribí una semilla)';
        input.setAttribute('aria-label', 'Semilla procedural');
        return input;
    }

    _createVoronoiToggle() {
        const label = this._el('label', 'ui-generation-toggle');
        const input = this._el('input');
        input.type = 'checkbox';
        input.checked = false;
        input.setAttribute('aria-label', 'Activar regiones Voronoi');
        label.appendChild(input);
        label.appendChild(this._el('span', '', 'Activar regiones Voronoi'));
        return input;
    }

    _createVoronoiCellSizeInput() {
        const input = this._el('input', 'ui-generation-input');
        input.type = 'number';
        input.min = '2';
        input.max = '128';
        input.step = '1';
        input.value = '16';
        input.setAttribute('aria-label', 'Tamaño de celdas Voronoi');
        return input;
    }

    _createVoronoiBlendInput() {
        const input = this._el('input', 'ui-generation-range');
        input.type = 'range';
        input.min = '0';
        input.max = '1';
        input.step = '0.05';
        input.value = '0.35';
        input.setAttribute('aria-label', 'Influencia Voronoi');
        return input;
    }

    _createLabeledControl(labelText, control) {
        const wrapper = this._el('label', 'ui-generation-control');
        wrapper.appendChild(this._el('span', '', labelText));
        wrapper.appendChild(control);
        return wrapper;
    }

    _readGenerationOptions(view) {
        const seed = this.seedInput.value.trim();
        return {
            view,
            ...(seed ? { seed } : {}),
            materialIds: this._getSelectedGenerationMaterialIds(),
            voronoi: this.voronoiEnabled.checked,
            voronoiCellSize: Number(this.voronoiCellSize.value) || 16,
            voronoiBlend: Number(this.voronoiBlend.value),
            waterLevelRatio: Number(this.waterLevelInput.value),
        };
    }

    
    _createModeOptions() {
        const options = this._el('div', 'ui-menu-options');

        options.appendChild(
            this._buildModeButton(
                '2d',
                '2D',
                'Vista superior',
                'top'
            )
        );

        options.appendChild(
            this._buildModeButton(
                '2d',
                '2D',
                'Vista lateral',
                'side'
            )
        );

        options.appendChild(
            this._buildModeButton(
                '3d',
                '3D',
                'Espacio volumétrico'
            )
        );

        return options;
    }


   
    _buildModeButton(mode, title, description, view = null) {
        const button = this._el('button', 'ui-mode-button');
        button.type = 'button';

        this._appendModeButtonLabels(button, title, description);

        button.addEventListener('click', () => {
        this._startProject(mode, view);
    });

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
            Eraser: { icon: '⛏', label: 'Excavar', title: 'Excavar: destruye el material visible según su dureza' },
            NoiseBrush: { icon: '▦', label: 'Ruido', title: 'Pincel de ruido procedural' },
            MagicWand: { icon: '✧', label: 'Varita', title: 'Varita mágica: relleno conectado' },
            CloneStamp: { icon: '◉', label: 'Clonar', title: 'Tampón de clonación' },
            MoveTool: { icon: '✥', label: 'Mover', title: 'Mover el contenido de las capas seleccionadas; Ctrl/Cmd o Shift para seleccionar varias' },
            TerrainBlastTool: { icon: '✹', label: 'Explosión', title: 'Explosión: clic sobre el terreno para crear un cráter' },
            TerrainDrillTool: { icon: '⇢', label: 'Taladro', title: 'Taladro: arrastrá sobre el terreno para perforar un túnel' },
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

    _buildCanvasSizePanel() {
        this.canvasSizePanel = this._el('aside', 'ui-canvas-size-panel ui-hidden force-hidden');
        this._buildCanvasSizePanelHeader(this.canvasSizePanel);
        this._buildCanvasSizePanelControls(this.canvasSizePanel);
        this.root.appendChild(this.canvasSizePanel);
    }

    _buildWorkspaceDocks() {
        this._buildCanvasSizeDock();
        this._buildProjectActionsDock();
    }

    _buildCanvasSizeDock() {
        this.canvasSizeDock = this._el('div', 'ui-canvas-size-dock ui-hidden');
        this._appendActionButton(
            this.canvasSizeDock,
            '↔ Tamaño',
            'ui-action-button ui-dock-button ui-canvas-size-toggle',
            () => this.toggleCanvasSizePanel(),
        );
        this.root.appendChild(this.canvasSizeDock);
    }

    _buildProjectActionsDock() {
        this.projectActionsDock = this._el('div', 'ui-project-actions-dock ui-hidden');
        this.importInput = this._createProjectImportInput();
        this.importButton = this._appendActionButton(
            this.projectActionsDock,
            '↑ Importar',
            'ui-action-button ui-dock-button ui-import-toggle',
            () => this.importInput.click(),
        );
        this.importButton.title = 'Importar un mapa JSON exportado previamente desde Procedural Field Maker.';
        this.exportDockButton = this._appendActionButton(
            this.projectActionsDock,
            '↓ Exportar',
            'ui-action-button ui-dock-button ui-export-toggle',
            () => this.toggleExportPanel(),
        );
        this.importStatus = this._el('span', 'ui-import-status');
        this.projectActionsDock.appendChild(this.importStatus);
        this.root.appendChild(this.projectActionsDock);
        this.root.appendChild(this.importInput);
    }

    _createProjectImportInput() {
        const input = this._el('input', 'ui-project-import-input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.setAttribute('aria-label', 'Importar mapa de Procedural Field Maker');
        input.addEventListener('change', event => this._handleImportFileSelection(event));
        return input;
    }

    _handleImportFileSelection(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!/\.json$/i.test(file.name)) return this._setImportStatus('Seleccioná un archivo JSON de Procedural Field Maker.', true);
        this._setImportStatus('Leyendo mapa…');
        this._readAndImportProject(file);
    }

    _readAndImportProject(file) {
        file.text()
            .then(content => JSON.parse(content))
            .then(payload => this._completeProjectImport(payload, file))
            .catch(error => this._setImportStatus(error.message || 'No se pudo importar el mapa.', true));
    }

    _completeProjectImport(payload, file) {
        this.appManager.importProjectData(payload);
        this._closeTransientPanels();
        this.seedInput.value = payload.seed || '';
        this.showWorkspace();
        this._setImportStatus(`Importado: ${file.name}`);
    }

    _closeTransientPanels() {
        this.exportPanel.classList.add('force-hidden', 'ui-hidden');
        this.canvasSizePanel.classList.add('force-hidden', 'ui-hidden');
    }

    _setImportStatus(message, isError = false) {
        this.importStatus.textContent = message;
        this.importMenuStatus.textContent = message;
        this.importStatus.classList.toggle('is-error', isError);
        this.importMenuStatus.classList.toggle('is-error', isError);
    }

    _buildCanvasSizePanelHeader(panel) {
        const header = this._el('div', 'ui-export-panel-header');
        header.appendChild(this._el('strong', '', 'Tamaño del lienzo'));
        this._appendActionButton(header, '×', 'ui-layer-close', () => this.toggleCanvasSizePanel(false));
        panel.appendChild(header);
    }

    _buildCanvasSizePanelControls(panel) {
        this.canvasSizeFields = new Map();
        this.canvasSizeFieldsContainer = this._el('div', 'ui-canvas-size-fields');
        panel.appendChild(this.canvasSizeFieldsContainer);
        this.canvasSizeHelp = this._el('p', 'ui-export-hint', 'El cambio conserva la parte del terreno que entre en las nuevas dimensiones.');
        panel.appendChild(this.canvasSizeHelp);
        this.canvasSizeStatus = this._el('p', 'ui-export-status');
        panel.appendChild(this.canvasSizeStatus);
        this.canvasSizeApplyButton = this._appendActionButton(panel, 'Aplicar tamaño', 'ui-action-button ui-primary-action ui-export-download', () => this._applyCanvasSize());
    }

    toggleCanvasSizePanel(forceState) {
        const isVisible = forceState ?? this.canvasSizePanel.classList.contains('ui-hidden');
        this.canvasSizePanel.classList.toggle('force-hidden', !isVisible);
        this.canvasSizePanel.classList.toggle('ui-hidden', !isVisible);
        this.navigationGuide.classList.toggle('ui-hidden', isVisible || !this.appManager.hasProject());
        if (!isVisible) return;
        this.toggleExportPanel(false);
        this.toggleLayerPanel(false);
        this.refreshCanvasSizePanel();
    }

    refreshCanvasSizePanel() {
        if (!this.canvasSizeFieldsContainer || !this.appManager.mapData) return;
        this._rebuildCanvasSizeFields();
        this._updateCanvasSizeHelp();
    }

    _rebuildCanvasSizeFields() {
        this.canvasSizeFieldsContainer.replaceChildren();
        this.canvasSizeFields.clear();
        this._appendCurrentCanvasDimensions();
    }

    _appendCurrentCanvasDimensions() {
        const dimensions = this._getCurrentCanvasDimensions();
        for (const [key, value] of Object.entries(dimensions)) this._appendCanvasSizeField(key, value);
    }

    _updateCanvasSizeHelp() {
        this.canvasSizeHelp.textContent = this.appManager.mode === '3d'
            ? 'Dimensiones en vóxeles. Máximo total: 4.194.304. El contenido que entre en el nuevo volumen se conserva.'
            : 'Dimensiones en celdas. Máximo total: 4.194.304. El contenido fuera del nuevo lienzo se recorta.';
    }

    _getCurrentCanvasDimensions() {
        const mapData = this.appManager.mapData;
        if (this.appManager.mode === '3d') return { sizeX: mapData.sizeX, sizeY: mapData.sizeY, sizeZ: mapData.sizeZ };
        return { width: mapData.width, height: mapData.height };
    }

    _appendCanvasSizeField(key, value) {
        const input = this._el('input', 'ui-export-filename');
        input.type = 'number';
        input.min = this.appManager.mode === '3d' ? '8' : '16';
        input.max = this.appManager.mode === '3d' ? '512' : '4096';
        input.step = '1';
        input.value = String(value);
        input.dataset.dimension = key;
        input.setAttribute('aria-label', this._getCanvasDimensionLabel(key));
        this.canvasSizeFields.set(key, input);
        this.canvasSizeFieldsContainer.appendChild(this._createExportField(this._getCanvasDimensionLabel(key), input));
    }

    _getCanvasDimensionLabel(key) {
        const labels = { width: 'Ancho · celdas', height: 'Alto · celdas', sizeX: 'Ancho X · vóxeles', sizeY: 'Alto Y · vóxeles', sizeZ: 'Profundidad Z · vóxeles' };
        return labels[key] || key;
    }

    _applyCanvasSize() {
        this.canvasSizeApplyButton.disabled = true;
        this._runCanvasResize(this._readCanvasSizeInputs());
    }

    _runCanvasResize(dimensions) {
        try {
            const changed = this.appManager.resizeCanvas(dimensions);
            this._finishCanvasResize(changed, 'Tamaño del lienzo actualizado.');
        } catch (error) {
            this._finishCanvasResize(false, error.message || 'No se pudo cambiar el tamaño.', true);
        }
    }

    _readCanvasSizeInputs() {
        return Object.fromEntries(Array.from(this.canvasSizeFields.entries()).map(([key, input]) => [key, Number(input.value)]));
    }

    _finishCanvasResize(changed, message, isError = false) {
        this.canvasSizeApplyButton.disabled = false;
        this.canvasSizeStatus.textContent = changed ? message : (isError ? message : 'El tamaño no cambió.');
        this.canvasSizeStatus.classList.toggle('is-error', isError);
        if (changed) this.refreshCanvasSizePanel();
    }

    _buildExportPanel() {
        this.exportPanel = this._el('aside', 'ui-export-panel ui-hidden force-hidden');
        this._buildExportPanelHeader(this.exportPanel);
        this._buildExportPanelControls(this.exportPanel);
        this.root.appendChild(this.exportPanel);
    }

    _buildExportPanelHeader(panel) {
        const header = this._el('div', 'ui-export-panel-header');
        header.appendChild(this._el('strong', '', 'Exportar proyecto'));
        this._appendActionButton(header, '×', 'ui-layer-close', () => this.toggleExportPanel(false));
        panel.appendChild(header);
    }

    _buildExportPanelControls(panel) {
        this.exportFormatSelect = this._el('select', 'ui-export-select');
        this.exportFilenameInput = this._el('input', 'ui-export-filename');
        this.exportFilenameInput.type = 'text';
        this.exportFilenameInput.value = 'procedural-map';
        this.exportFilenameInput.setAttribute('aria-label', 'Nombre del archivo');
        panel.appendChild(this._createExportField('Formato', this.exportFormatSelect));
        panel.appendChild(this._createExportField('Nombre', this.exportFilenameInput));
        this.exportHint = this._el('p', 'ui-export-hint');
        panel.appendChild(this.exportHint);
        this.exportStatus = this._el('p', 'ui-export-status');
        panel.appendChild(this.exportStatus);
        this.exportButton = this._appendActionButton(panel, 'Descargar', 'ui-action-button ui-primary-action ui-export-download', () => this._exportCurrentProject());
        this.exportFormatSelect.addEventListener('change', () => this._refreshExportHint());
    }

    _createExportField(labelText, control) {
        const field = this._el('label', 'ui-export-field');
        field.appendChild(this._el('span', '', labelText));
        field.appendChild(control);
        return field;
    }

    _getExportDefinitions() {
        const common = [
            { value: 'json', label: 'JSON · Proyecto editable', extension: 'json' },
            { value: 'png', label: this.appManager.mode === '3d' ? 'PNG · Heightmap' : 'PNG · Imagen', extension: 'png' },
        ];
        if (this.appManager.mode !== '3d') return common;
        return [
            ...common,
            { value: 'glb', label: 'GLB · Modelo 3D', extension: 'glb' },
            { value: 'unity', label: 'Unity · OBJ + MTL', extension: 'obj' },
            { value: 'godot', label: 'Godot · OBJ + MTL', extension: 'obj' },
        ];
    }

    refreshExportFormats() {
        if (!this.exportFormatSelect) return;
        const definitions = this._getExportDefinitions();
        const previous = this.exportFormatSelect.value;
        this.exportFormatSelect.replaceChildren();
        for (const definition of definitions) this._appendExportFormatOption(definition);
        this.exportFormatSelect.value = definitions.some(item => item.value === previous)
            ? previous
            : definitions[0]?.value || '';
        this._refreshExportHint();
    }

    _appendExportFormatOption(definition) {
        const option = this._el('option', '', definition.label);
        option.value = definition.value;
        this.exportFormatSelect.appendChild(option);
    }

    _refreshExportHint() {
        const format = this.exportFormatSelect?.value;
        const hints = {
            json: 'Guarda dimensiones, semilla, materiales y datos de celdas o vóxeles.',
            png: this.appManager.mode === '3d' ? 'Exporta un heightmap de la superficie del mundo 3D.' : 'Exporta el mapa 2D como imagen PNG con transparencia en el aire.',
            glb: 'Exporta la geometría 3D con sus materiales en un único archivo GLB.',
            unity: 'Descarga una malla OBJ y un archivo MTL para importar en Unity. No es todavía un proyecto Unity nativo.',
            godot: 'Descarga una malla OBJ y un archivo MTL para importar en Godot. No es todavía una escena Godot nativa.',
        };
        if (this.exportHint) this.exportHint.textContent = hints[format] || '';
    }

    toggleExportPanel(forceState) {
        const isVisible = forceState ?? this.exportPanel.classList.contains('ui-hidden');
        this.exportPanel.classList.toggle('force-hidden', !isVisible);
        this.exportPanel.classList.toggle('ui-hidden', !isVisible);
        if (!isVisible) return;
        this.toggleCanvasSizePanel(false);
        this.toggleLayerPanel(false);
        this.refreshExportFormats();
    }

    _exportCurrentProject() {
        if (!this.appManager.hasProject()) return this._setExportStatus('No hay un proyecto abierto.', true);
        const format = this.exportFormatSelect.value;
        const filename = this._buildExportFilename(format);
        this._setExportButtonBusy(true);
        this._setExportStatus('Preparando la exportación…');
        this._runExportRequest(format, filename);
    }

    _buildExportFilename(format) {
        const definition = this._getExportDefinitions().find(item => item.value === format);
        const rawName = this.exportFilenameInput.value.trim() || 'procedural-map';
        const safeName = rawName.replace(/[\\/:*?"<>|]+/g, '-').replace(/\.+$/g, '');
        const baseName = safeName.replace(/\.[^.]+$/, '') || 'procedural-map';
        return `${baseName}.${definition?.extension || format}`;
    }

    _runExportRequest(format, filename) {
        try {
            const result = this.appManager.exportProject(format, filename);
            Promise.resolve(result).then(
                () => this._finishExportRequest('La descarga fue solicitada correctamente.', false),
                error => this._finishExportRequest(error.message || 'No se pudo exportar el proyecto.', true),
            );
        } catch (error) {
            this._finishExportRequest(error.message || 'No se pudo exportar el proyecto.', true);
        }
    }

    _finishExportRequest(message, isError) {
        this._setExportButtonBusy(false);
        this._setExportStatus(message, isError);
    }

    _setExportButtonBusy(isBusy) {
        this.exportButton.disabled = isBusy;
        this.exportButton.textContent = isBusy ? 'Exportando…' : 'Descargar';
    }

    _setExportStatus(message, isError = false) {
        if (!this.exportStatus) return;
        this.exportStatus.textContent = message;
        this.exportStatus.classList.toggle('is-error', isError);
    }

    _populateLayerPanel(panel) {
        this._buildLayerPanelHeader(panel);
        this._buildLayerPanelList(panel);
        this._buildLayerPanelSettings(panel);
    }

    _buildLayerPanelList(panel) {
        this.layerSelectionStatus = this._el('div', 'ui-layer-selection-status', 'Ctrl/Cmd: varias capas · Shift: seleccionar rango');
        this.layerList = this._el('div', 'ui-layer-list');
        panel.appendChild(this.layerSelectionStatus);
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
        this._appendActionButton(header, 'Todas', 'ui-layer-select-all', () => this._selectAllLayers());
        this._appendActionButton(header, 'Una', 'ui-layer-select-one', () => this._clearLayerSelection());
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
        this._syncLayerSelectionStatus();
    }

    _syncLayerSelectionStatus() {
        const count = this.appManager.mapLayerManager.getSelectedLayers().length;
        this.layerSelectionStatus.textContent = `${count} capa(s) seleccionada(s) · Mover actúa sobre todas` ;
    }

    _selectAllLayers() {
        this.appManager.mapLayerManager.selectAllLayers();
        this.refreshLayerPanel();
    }

    _clearLayerSelection() {
        this.appManager.mapLayerManager.clearLayerSelection();
        this.refreshLayerPanel();
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
        const manager = this.appManager.mapLayerManager;
        row.classList.toggle('active', layer === manager.getActiveLayer());
        row.classList.toggle('selected', manager.getSelectedLayers().includes(layer));
        row.classList.toggle('ui-layer-filter-row', layer.kind === 'filter');
        this._appendLayerRowControls(row, layer);
    }

    _appendLayerRowControls(row, layer) {
        this._appendLayerSelectionCheckbox(row, layer);
        this._appendLayerVisibilityButton(row, layer);
        this._appendLayerSelectButton(row, layer);
        this._appendLayerActionButtons(row, layer);
        this._appendLayerMaskControls(row, layer);
    }

    _appendLayerSelectionCheckbox(row, layer) {
        const input = this._el('input', 'ui-layer-selection-checkbox');
        input.type = 'checkbox';
        input.checked = this.appManager.mapLayerManager.getSelectedLayers().includes(layer);
        input.title = `Seleccionar ${layer.name} para mover`;
        input.setAttribute('aria-label', `Seleccionar capa ${layer.name}`);
        input.addEventListener('change', () => this._toggleLayerSelection(layer));
        row.appendChild(input);
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
        button.title = 'Seleccionar capa; Ctrl/Cmd agrega o quita; Shift selecciona un rango';
        button.addEventListener('click', event => this._selectLayerFromEvent(layer, event));
        row.appendChild(button);
    }

    _selectLayerFromEvent(layer, event) {
        const options = { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey };
        if (options.toggle || options.range) this.appManager.mapLayerManager.setLayerSelection(layer.id, options);
        else this.appManager.mapLayerManager.setActiveLayer(layer.id);
        this.refreshLayerPanel();
    }

    _toggleLayerSelection(layer) {
        this.appManager.mapLayerManager.setLayerSelection(layer.id, { toggle: true });
        this.refreshLayerPanel();
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
        return ['Desplazar vista: botón central o derecho + arrastrar', 'Zoom: rueda del mouse', 'Mover capas: seleccioná varias y usá Mover', 'Explosión: elegí Explosión y hacé clic', 'Taladro: elegí Taladro y arrastrá para abrir un túnel', 'Excavar: elegí Excavar y arrastrá'];
    }

    _getOrbitCameraInstructions() {
        return ['Orbitar: botón derecho + arrastrar', 'Desplazar: botón central + arrastrar', 'Zoom: rueda del mouse', 'Mover capas: seleccioná varias y usá Mover', 'Explosión: clic con Explosión', 'Taladro: arrastrá con Taladro', 'Excavar: arrastrá con Excavar', 'Volar: botón de cámara o Tab'];
    }

    _getFlyCameraInstructions() {
        return ['Mirar: botón derecho + arrastrar', 'Mover: teclas W / A / S / D', 'Explosión: clic con Explosión', 'Taladro: arrastrá con Taladro', 'Excavar: arrastrá con Excavar', 'Volver a orbitar: botón de cámara o Tab'];
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
        this._closeTransientPanels();
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
        this.refreshExportFormats();
    }

    _toggleMenuVisibility(isVisible) {
        this.menu.classList.toggle('ui-hidden', !isVisible);
    }

    _toggleWorkspaceElementsVisibility(isVisible) {
        this.toolbar.classList.toggle('ui-hidden', !isVisible);
        const sizePanelVisible = !this.canvasSizePanel.classList.contains('force-hidden');
        this.navigationGuide.classList.toggle('ui-hidden', !isVisible || sizePanelVisible);
        this.layerPanel.classList.toggle('ui-hidden', !isVisible || !this.layerPanelVisible);
        this.exportPanel.classList.toggle('ui-hidden', !isVisible || this.exportPanel.classList.contains('force-hidden'));
        this.canvasSizePanel.classList.toggle('ui-hidden', !isVisible || this.canvasSizePanel.classList.contains('force-hidden'));
        this.canvasSizeDock.classList.toggle('ui-hidden', !isVisible);
        this.projectActionsDock.classList.toggle('ui-hidden', !isVisible);
    }

    _syncActiveViewport() {
        const mode = this.appManager.mode;
        this.canvasContainer2D.classList.toggle('ui-hidden', mode !== '2d');
        this.renderCanvas3D.classList.toggle('ui-hidden', mode !== '3d');
    }

    
    _startProject(mode, view = null) {
        const options = this._readGenerationOptions(view);
        if (!this._validateGenerationOptions(options)) return;
        this.appManager.newProject(mode, options);
        this.showWorkspace();
    }

    _validateGenerationOptions(options) {
        if (options.materialIds.length > 0) {
            this.generationStatus.textContent = '';
            return true;
        }
        this.generationStatus.textContent = 'Seleccioná al menos un material para generar el terreno.';
        return false;
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
