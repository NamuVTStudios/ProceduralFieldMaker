class AppObject {
  constructor(appManager) {
    this.appManager = appManager;
    this.active = true;
  }
  onInit() {}
  onUpdate(dt) {}
  onDestroy() {}
}