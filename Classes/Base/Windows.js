/**
 * Windows.js
 * Clase padre global para la renderización de paneles de control en la UI.
 * Refactorizado bajo la regla estricta de un máximo de 3 subtareas por método.
 */
class Windows extends AppObject {
    /**
     * @param {object} appManager Referencia única al orquestador central.
     */
    constructor(appManager) {
        super(appManager);
        this.title = "Generic Window";
        this.domElement = null;
        this.active = false;
    }

    // ---------------------------------------------------------------------
    // Ciclo de Vida y Control de Visibilidad de Ventanas
    // ---------------------------------------------------------------------

    /** Abre la ventana y actualiza su visibilidad en el DOM. */
    open() {
        this.active = true;
        this._updateDOMVisibility();
    }

    /** Cierra la ventana y oculta su contenedor en el DOM. */
    close() {
        this.active = false;
        this._updateDOMVisibility();
    }

    /** @private */
    _updateDOMVisibility() {
        if (!this.domElement) return;
        this.domElement.classList.toggle('ui-hidden', !this.active);
    }

    // ---------------------------------------------------------------------
    // Sub-módulo: Construcción e Inyección de Plantillas de UI
    // ---------------------------------------------------------------------

    /**
     * Enlaza y monta de forma segura el contenedor principal de la ventana (TDD 3.1).
     * @param {HTMLElement} parentElement Nodo del DOM donde se inyectará la ventana.
     */
    mount(parentElement) {
        const windowDiv = this._createWindowContainer();
        this._buildWindowHeader(windowDiv);
        this._attachToParent(windowDiv, parentElement);
    }

    /** @private */
    _createWindowContainer() {
        const div = document.createElement('div');
        div.className = 'ui-window ui-hidden';
        this.domElement = div;
        return div;
    }

    /** @private */
    _buildWindowHeader(container) {
        const header = document.createElement('div');
        header.className = 'ui-window-header';
        header.textContent = this.title;
        container.appendChild(header);
    }

    /** @private */
    _attachToParent(container, parentElement) {
        const target = parentElement || document.body;
        target.appendChild(container);
        this._renderContent(container);
    }

    /**
     * Método abstracto para ser sobrescrito por los paneles específicos.
     * Aquí cada ventana inyectará sus propios sliders, inputs y botones.
     * @protected
     */
    _renderContent(container) {
        // Delegado a BrushSettings, EraserSettings, etc.
    }
}