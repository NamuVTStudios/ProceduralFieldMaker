/**
 * Tools.js
 * Clase padre global para las herramientas de escultura, adición y destrucción.
 * Refactorizado bajo la regla estricta de un máximo de 3 subtareas por método.
 */
class Tools extends AppObject {
    /**
     * @param {object} appManager Referencia única al orquestador central.
     */
    constructor(appManager) {
        super(appManager);
        this.label = "Generic Tool";
        this._initializeGizmoTransform();
    }

    /** Inicializa los buffers numéricos para los Gizmos 3D (TDD 3.1). */
    _initializeGizmoTransform() {
        this.gizmoPosition = { x: 0, y: 0, z: 0 };
        this.gizmoRotation = { x: 0, y: 0, z: 0 };
        this.gizmoScale = { x: 1, y: 1, z: 1 };
    }

    // ---------------------------------------------------------------------
    // Ciclo de Vida y Ganchos de Activación de Herramientas
    // ---------------------------------------------------------------------

    /** Disparado por el ToolsManager al activar la herramienta en la UI. */
    onActivate() {
        console.log(`Herramienta activada: ${this.label}`);
    }

    /** Disparado por el ToolsManager al conmutar a otra herramienta. */
    onDeactivate() {
        console.log(`Herramienta desactivada: ${this.label}`);
    }

    /**
     * Contrato de ejecución base sobre el buffer de terreno.
     * Debe ser sobrescrito por cada subclase de herramienta específica.
     */
    applyTool(targetX, targetY, targetZ = 0) {
        // Implementación abstracta para ser delegada a Brush, Eraser, etc.
    }

    // ---------------------------------------------------------------------
    // Sub-módulo: Funciones de Control y Transformación de Gizmos 3D
    // ---------------------------------------------------------------------

    /**
     * Actualiza la posición tridimensional del Gizmo de la herramienta (TDD 3.1).
     */
    updateGizmoPosition(x, y, z) {
        this.gizmoPosition.x = x;
        this.gizmoPosition.y = y;
        this.gizmoPosition.z = z;
    }

    /**
     * Actualiza la rotación angular del Gizmo (TDD 3.1).
     */
    updateGizmoRotation(rx, ry, rz) {
        this.gizmoRotation.x = rx;
        this.gizmoRotation.y = ry;
        this.gizmoRotation.z = rz;
    }

    /**
     * Actualiza la escala del Gizmo para primitivas paramétricas.
     */
    updateGizmoScale(sx, sy, sz) {
        this.gizmoScale.x = sx;
        this.gizmoScale.y = sy;
        this.gizmoScale.z = sz;
    }

    // ---------------------------------------------------------------------
    // Utilidades Transversales de Entrada de Puntero (Pointer Events)
    // ---------------------------------------------------------------------

    /**
     * Resuelve los datos de presión del lápiz táctil o ratón (TDD 6.3).
     * @param {PointerEvent} event
     * @returns {number} Valor normalizado entre 0.0 y 1.0
     */
    resolveInputPressure(event) {
        const rawPressure = event.pressure;
        return this._evaluatePressureFallback(rawPressure);
    }

    /** @private */
    _evaluatePressureFallback(pressure) {
        const hasNoPressure = pressure === 0 || pressure === 0.5;
        return hasNoPressure ? 0.5 : pressure;
    }
}