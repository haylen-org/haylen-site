// Resize the existing frame so project state survives device changes.
export class PreviewViewport {
  constructor() {
    this.container = document.querySelector('#preview');
    this.screen = document.querySelector('#preview-screen');
    this.label = document.querySelector('#viewport-size');
    this.buttons = document.querySelectorAll('[data-device]');
    this.presets = { phone: [390, 844], tablet: [768, 1024], desktop: [1280, 800] };
    this.device = 'fit';
    this.rotated = false;
    this.rotateButton = document.querySelector('#rotate-preview');
    this.rotateButton.addEventListener('click', () => {
      this.rotated = !this.rotated;
      this.rotateButton.setAttribute('aria-pressed', String(this.rotated));
      this.render();
    });
    for (const button of this.buttons) {
      button.addEventListener('click', () => {
        this.device = button.dataset.device;
        this.rotated = false;
        this.rotateButton.setAttribute('aria-pressed', 'false');
        for (const item of this.buttons) item.setAttribute('aria-pressed', String(item === button));
        this.render();
      });
    }
    this.observer = new ResizeObserver(() => {
      if (this.pending) return;
      this.pending = requestAnimationFrame(() => {
        this.pending = undefined;
        this.render();
      });
    });
    this.observer.observe(this.container);
    this.render();
  }

  render() {
    const availableWidth = this.container.clientWidth;
    const availableHeight = this.container.clientHeight;
    if (availableWidth < 1 || availableHeight < 1) return;
    let [width, height] = this.presets[this.device] ?? [availableWidth, availableHeight];
    if (this.rotated) [width, height] = [height, width];
    const scale = Math.min(1, availableWidth / width, availableHeight / height);
    this.screen.style.width = `${width}px`;
    this.screen.style.height = `${height}px`;
    this.screen.style.transform = `translate(-50%, -50%) scale(${scale})`;
    this.label.textContent = `${width} × ${height}`;
    this.label.title = `${Math.round(scale * 100)}% display scale. Viewport sizes do not emulate device hardware.`;
  }
}
