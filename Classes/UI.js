/**
 * UI.js
 * Toda la interfaz de la app se crea acá, desde JavaScript (el HTML solo carga los scripts):
 *  - Menú inicial para elegir la dimensión del lienzo (2D o 3D).
 *  - Barra de herramientas (#controles) con un botón por Tool registrada y el botón "Menú".
 * Los estilos están en styles.css.
 */
class UI {
    constructor(appManager) {
        this.appManager = appManager;
        this._isMobile = this._detectMobile();
        this.toolButtons = new Map(); // tool -> botón

        this._buildRoot();
        this._buildMenu();
        this._buildToolbar();
        this.showMenu();

        window.addEventListener('resize', () => this._onResize());
    }

    // ---------------------------------------------------------------------
    // Construcción de la interfaz
    // ---------------------------------------------------------------------

    /** Crea un elemento con clase y texto opcionales. */
    _el(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }

    /** Contenedor raíz: queda por encima de los canvas y no bloquea el input fuera de los controles. */
    _buildRoot() {
        this.root = this._el('div', 'ui-root');
        document.body.appendChild(this.root);
    }

    _buildMenu() {
        this.menu = this._el('div', 'ui-menu');
        const card = this._el('div', 'ui-menu-card');
        card.appendChild(this._el('h1', 'ui-menu-title', 'Procedural Field Maker'));
        card.appendChild(this._el('p', 'ui-menu-subtitle', 'Elegí la dimensión del lienzo de trabajo'));

        const options = this._el('div', 'ui-menu-options');
        options.appendChild(this._buildModeButton('2d', '2D', 'Corte transversal'));
        options.appendChild(this._buildModeButton('3d', '3D', 'Espacio volumétrico'));
        card.appendChild(options);

        this.menu.appendChild(card);
        this.root.appendChild(this.menu);
    }

    _buildModeButton(mode, title, description) {
        const btn = this._el('button', 'ui-mode-button');
        btn.appendChild(this._el('span', 'ui-mode-title', title));
        btn.appendChild(this._el('span', 'ui-mode-desc', description));
        btn.addEventListener('click', () => this._startProject(mode));
        return btn;
    }

    _buildToolbar() {
        this.toolbar = this._el('div');
        this.toolbar.id = 'controles';
        this.root.appendChild(this.toolbar);
        this.refreshToolButtons();
    }

    /** (Re)arma los botones de la barra a partir de las tools registradas en el ToolsManager. */
    refreshToolButtons() {
        this.toolbar.replaceChildren();
        this.toolButtons.clear();

        const toolsManager = this.appManager.toolsManager;
        for (const tool of toolsManager.tools) {
            const btn = this._el('button', '', tool.label ?? tool.constructor.name);
            btn.addEventListener('click', () => {
                toolsManager.setActive(tool);
                this._highlightActive(tool);
            });
            this.toolButtons.set(tool, btn);
            this.toolbar.appendChild(btn);
        }

        const menuBtn = this._el('button', 'ui-menu-button', 'Menú');
        menuBtn.addEventListener('click', () => this._onMenuButton());
        this.toolbar.appendChild(menuBtn);

        this._highlightActive(toolsManager.activeTool);
    }

    _highlightActive(activeTool) {
        for (const [tool, btn] of this.toolButtons) {
            btn.classList.toggle('active', tool === activeTool);
        }
    }

    // ---------------------------------------------------------------------
    // Flujo menú <-> lienzo de trabajo
    // ---------------------------------------------------------------------

    showMenu() {
        this.menu.classList.remove('ui-hidden');
        this.toolbar.classList.add('ui-hidden');
    }

    showWorkspace() {
        this.menu.classList.add('ui-hidden');
        this.toolbar.classList.remove('ui-hidden');
    }

    /** Se eligió 2D o 3D en el menú: crea el lienzo de trabajo y muestra las herramientas. */
    _startProject(mode) {
        this.appManager.newProject(mode);
        this.showWorkspace();
    }

    _onMenuButton() {
        if (!window.confirm('¿Volver al menú? Se pierde el lienzo actual.')) return;
        this.appManager.closeProject();
        this.showMenu();
    }

    // ---------------------------------------------------------------------
    // Layout responsive
    // ---------------------------------------------------------------------

    _detectMobile() {
        return window.matchMedia('(max-width: 600px)').matches || 'ontouchstart' in window;
    }

    _onResize() {
        const wasMobile = this._isMobile;
        this._isMobile = this._detectMobile();
        if (wasMobile !== this._isMobile) {
            // el layout mobile/desktop cambió (ej. rotaron el celular, o es un tablet en el borde)
            this.appManager.emitLayoutChange?.(this._isMobile);
        }
    }
}
