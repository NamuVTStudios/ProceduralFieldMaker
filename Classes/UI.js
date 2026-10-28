/**
 * UI.js
 * Construcción dinámica de la interfaz de usuario y viewports de Procedural Field Maker.
 * Refactorizado bajo la regla estricta de un máximo de 3 subtareas por método.
 */
class UI {
    constructor(appManager) {
        this.appManager = appManager;
        this._isMobile = this._detectMobile();
        this.toolButtons = new Map();
        this._buildInitialView();
        this._bindResizeEvents();
    }

    _buildInitialView() {
        this._buildRoot();
        this._buildViewports();
        this._buildMenuAndToolbar();
    }

    _buildMenuAndToolbar() {
        this._buildMenu();
        this._buildToolbar();
        this.showMenu();
    }

    _bindResizeEvents() {
        window.addEventListener('resize', () => this._onResize());
    }

    /** Crea un elemento con clase y texto opcionales. */
    _el(tag, className, text) {
        const el = document.createElement(tag);
        this._applyElementData(el, className, text);
        return el;
    }

    /** @private */
    _applyElementData(el, className, text) {
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
    }

    /** Contenedor raíz de la interfaz gráfica. */
    _buildRoot() {
        this.root = this._el('div', 'ui-root');
        document.body.appendChild(this.root);
    }

    /** 
     * Genera e inyecta los viewports requeridos por Pixi.js y Babylon.js (GDD 6.2 / TDD 3.2).
     */
    _buildViewports() {
        this._buildCanvasContainer2D();
        this._buildCanvas3D();
    }

    /** @private */
    _buildCanvasContainer2D() {
        this.canvasContainer2D = this._el('div', 'ui-viewport ui-hidden');
        this.canvasContainer2D.id = 'canvasContainer2D';
        document.body.appendChild(this.canvasContainer2D);
    }

    /** @private */
    _buildCanvas3D() {
        this.renderCanvas3D = this._el('canvas', 'ui-viewport ui-hidden');
        this.renderCanvas3D.id = 'renderCanvas';
        document.body.appendChild(this.renderCanvas3D);
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
        card.appendChild(this._el('h1', 'ui-menu-title', 'Procedural Field Maker'));
        card.appendChild(this._el('p', 'ui-menu-subtitle', 'Elegí la dimensión del lienzo de trabajo'));
    }

    _appendMenuOptions(card) {
        card.appendChild(this._createMenuOptions());
    }

    _createMenuOptions() {
        const options = this._el('div', 'ui-menu-options');
        options.appendChild(this._buildModeButton('2d', '2D', 'Corte transversal'));
        options.appendChild(this._buildModeButton('3d', '3D', 'Espacio volumétrico'));
        return options;
    }

    _buildModeButton(mode, title, description) {
        const btn = this._el('button', 'ui-mode-button');
        this._appendModeButtonLabels(btn, title, description);
        btn.addEventListener('click', () => this._startProject(mode));
        return btn;
    }

    _appendModeButtonLabels(button, title, description) {
        button.appendChild(this._el('span', 'ui-mode-title', title));
        button.appendChild(this._el('span', 'ui-mode-desc', description));
    }

    _buildToolbar() {
        this.toolbar = this._el('div');
        this.toolbar.id = 'controles';
        this._mountToolbar();
    }

    _mountToolbar() {
        this.root.appendChild(this.toolbar);
        this.refreshToolButtons();
    }

    /** Sincroniza los botones de la barra a partir de las herramientas del ToolsManager. */
    refreshToolButtons() {
        this._clearToolbarButtons();
        this._buildToolbarButtons();
        this._updateInitialHighlight();
    }

    /** @private */
    _updateInitialHighlight() {
        const activeTool = this.appManager.toolsManager.activeTool;
        this._highlightActive(activeTool);
    }

    _clearToolbarButtons() {
        this.toolbar.replaceChildren();
        this.toolButtons.clear();
    }

    _buildToolbarButtons() {
        this._appendRegisteredToolButtons();
        this._appendMenuButton();
    }

    _appendRegisteredToolButtons() {
        const toolsManager = this.appManager.toolsManager;
        this._iterateToolsRegistration(toolsManager.tools, toolsManager);
    }

    /** Itera de forma plana sin anidar control de flujo sobre los arreglos. */
    _iterateToolsRegistration(toolsArray, toolsManager) {
        for (let i = 0; i < toolsArray.length; i++) {
            this._appendToolButton(toolsArray[i], toolsManager);
        }
    }

    _appendToolButton(tool, toolsManager) {
        const btn = this._createToolButton(tool, toolsManager);
        this.toolButtons.set(tool, btn);
        this.toolbar.appendChild(btn);
    }

    _createToolButton(tool, toolsManager) {
        const labelText = tool.label ?? tool.constructor.name;
        const btn = this._el('button', '', labelText);
        btn.addEventListener('click', () => this._activateTool(tool, toolsManager));
        return btn;
    }

    _activateTool(tool, toolsManager) {
        toolsManager.setActive(tool);
        this._highlightActive(tool);
    }

    _appendMenuButton() {
        const menuBtn = this._el('button', 'ui-menu-button', 'Menú');
        menuBtn.addEventListener('click', () => this._onMenuButton());
        this.toolbar.appendChild(menuBtn);
    }

    _highlightActive(activeTool) {
        for (const [tool, btn] of this.toolButtons) {
            this._toggleButtonHighlight(btn, tool, activeTool);
        }
    }

    /** @private */
    _toggleButtonHighlight(btn, tool, activeTool) {
        btn.classList.toggle('active', tool === activeTool);
    }

    // ---------------------------------------------------------------------
    // Gestión e Intercambio de Viewports (2D / 3D / Menú)
    // ---------------------------------------------------------------------

    showMenu() {
        this._toggleMenuVisibility(true);
        this._toggleWorkspaceElementsVisibility(false);
    }

    showWorkspace() {
        this._toggleMenuVisibility(false);
        this._toggleWorkspaceElementsVisibility(true);
        this._syncActiveViewport();
    }

    /** @private */
    _toggleMenuVisibility(isVisible) {
        this.menu.classList.toggle('ui-hidden', !isVisible);
    }

    /** @private */
    _toggleWorkspaceElementsVisibility(isVisible) {
        this.toolbar.classList.toggle('ui-hidden', !isVisible);
    }

    /** 
     * Sincroniza de forma atómica la visibilidad de los lienzos según el modo (TDD 3.2).
     * @private
     */
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

    /** @private */
    _executeProjectTeardown() {
        this.appManager.closeProject();
        this.showMenu();
        this._hideAllViewports();
    }

    /** @private */
    _hideAllViewports() {
        this.canvasContainer2D.classList.add('ui-hidden');
        this.renderCanvas3D.classList.add('ui-hidden');
    }

    // ---------------------------------------------------------------------
    // Layout responsive
    // ---------------------------------------------------------------------

    _detectMobile() {
        const query = window.matchMedia('(max-width: 600px)').matches;
        return query || 'ontouchstart' in window;
    }

    _onResize() {
        const wasMobile = this._isMobile;
        this._isMobile = this._detectMobile();
        this._evaluateLayoutMutation(wasMobile);
    }

    /** @private */
    _evaluateLayoutMutation(wasMobile) {
        if (wasMobile === this._isMobile) return;
        if (typeof this.appManager.emitLayoutChange === "function") {
            this.appManager.emitLayoutChange(this._isMobile);
        }
    }
}
