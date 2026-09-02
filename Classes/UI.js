class UI {
    constructor(appManager) {
        this.appManager = appManager;
        this.container = document.getElementById('controles');
        this._isMobile = this._detectMobile();
        this._buildToolButtons();
        window.addEventListener('resize', () => this._onResize());
    }

    _detectMobile() {
        return window.matchMedia('(max-width: 600px)').matches || 'ontouchstart' in window;
    }

    _buildToolButtons() {
        const tools = this.appManager.toolsManager.tools;
        for (const tool of tools) {
            const btn = document.createElement('button');
            btn.textContent = tool.label ?? tool.constructor.name;
            btn.addEventListener('click', () => {
                this.appManager.toolsManager.setActive(tool);
                this._highlightActive(btn);
            });
            this.container.appendChild(btn);
        }
    }

    _highlightActive(activeBtn) {
        [...this.container.children].forEach(b => b.classList.toggle('active', b === activeBtn));
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