/** Clase base para paneles de configuración administrados por WindowsManager. */
class Windows extends AppObject {
  constructor(appManager) {
    super(appManager);
    this.title = 'Generic Window';
    this.domElement = null;
    this.isOpen = false;
  }

  open() {
    if (this.destroyed) return false;
    this.isOpen = true;
    this._updateDOMVisibility();
    return true;
  }

  close() {
    this.isOpen = false;
    this._updateDOMVisibility();
    return true;
  }

  isActive() {
    return super.isActive() && this.isOpen;
  }

  _updateDOMVisibility() {
    if (!this.domElement) return;
    this.domElement.classList.toggle('ui-hidden', !this.isOpen);
  }

  mount(parentElement) {
    if (this.domElement) return this.domElement;
    const container = this._createWindowContainer();
    this._buildWindowHeader(container);
    this._attachToParent(container, parentElement);
    return container;
  }

  _createWindowContainer() {
    const div = document.createElement('section');
    div.className = 'ui-window ui-hidden';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-label', this.title);
    this.domElement = div;
    return div;
  }

  _buildWindowHeader(container) {
    const header = document.createElement('header');
    header.className = 'ui-window-header';
    this._appendHeaderTitle(header);
    this._appendCloseButton(header);
    container.appendChild(header);
  }

  _appendHeaderTitle(header) {
    const title = document.createElement('span');
    title.textContent = this.title;
    header.appendChild(title);
  }

  _appendCloseButton(header) {
    const button = document.createElement('button');
    button.className = 'ui-window-close';
    button.type = 'button';
    button.textContent = '×';
    button.setAttribute('aria-label', 'Cerrar ventana');
    button.addEventListener('click', () => this.appManager.windowsManager.close(this));
    header.appendChild(button);
  }

  _attachToParent(container, parentElement) {
    (parentElement || document.body).appendChild(container);
    this._renderContent(container);
  }

  _renderContent() {}

  onDestroy() {
    this.close();
    this.domElement?.remove();
    this.domElement = null;
  }
}
