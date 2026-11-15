// Notices are supplemental. Important failures also stay in their owning UI or console.
export class Notifications {
  constructor() {
    this.element = document.querySelector('#workspace-notice');
    this.message = document.querySelector('#notice-message');
    document.querySelector('#dismiss-notice').addEventListener('click', () => this.clear());
    for (const event of ['pointerenter', 'focusin']) {
      this.element.addEventListener(event, () => clearTimeout(this.timer));
    }
    for (const event of ['pointerleave', 'focusout']) {
      this.element.addEventListener(event, () => this.schedule());
    }
  }

  show(text) {
    this.clear();
    if (!text) return;

    const dialog = document.querySelector('#action-dialog[open]');
    if (dialog) {
      dialog.querySelector('#dialog-error').textContent = text;
      return;
    }

    this.element.hidden = false;
    this.previousFocus = document.activeElement;
    this.message.textContent = text;
    if (typeof this.element.showPopover === 'function') this.element.showPopover();
    this.schedule();
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.element.contains(document.activeElement)) this.clear();
    }, 8000);
  }

  clear() {
    clearTimeout(this.timer);
    const restoreFocus = this.element.contains(document.activeElement);
    if (typeof this.element.hidePopover === 'function') this.element.hidePopover();
    this.element.hidden = true;
    this.message.textContent = '';
    if (restoreFocus && this.previousFocus?.isConnected) this.previousFocus.focus();
  }
}
