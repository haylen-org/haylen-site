// Offline assets and saved project files have separate lifetimes.
export class OfflineCache {
  constructor({ beforeUpdate, notify }) {
    this.beforeUpdate = beforeUpdate;
    this.notify = notify;
    this.label = document.querySelector('#offline-status');
    this.button = document.querySelector('#update-ide');
    this.button.addEventListener('click', () => this.update());
  }

  async start() {
    if (!('serviceWorker' in navigator)) {
      this.label.textContent = 'Internet connection needed';
      return;
    }
    try {
      this.registration = await navigator.serviceWorker.register('./sw.js', {
        scope: './',
        updateViaCache: 'none',
      });
      const watch = () => {
        this.registration.installing?.addEventListener('statechange', (event) => {
          if (event.target.state === 'activated') this.report();
          if (event.target.state === 'installed') this.showUpdate();
          if (event.target.state === 'redundant')
            this.label.textContent = 'Reload online to enable offline use';
        });
      };
      watch();
      this.registration.addEventListener('updatefound', watch);
      await navigator.serviceWorker.ready;
      this.report();
      this.showUpdate();
    } catch {
      this.label.textContent = 'Internet connection needed';
    }
  }

  report() {
    const worker = this.registration.active;
    if (!worker) return;
    const channel = new MessageChannel();
    channel.port1.onmessage = ({ data }) => {
      this.label.textContent = data.ready ? 'Available offline' : 'Reload online to enable offline use';
      channel.port1.close();
      this.showUpdate();
    };
    worker.postMessage({ type: 'status' }, [channel.port2]);
  }

  showUpdate() {
    if (!this.registration.waiting) return;
    this.button.hidden = false;
    this.label.textContent = 'Update available in Help';
  }

  async update() {
    const worker = this.registration.waiting;
    if (!worker || this.button.disabled) return;
    this.button.disabled = true;
    try {
      if (!(await this.beforeUpdate())) {
        this.button.disabled = false;
        return;
      }
      // Activation is requested by this button, never while a project is running on its own.
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      worker.postMessage({ type: 'activate-update' });
      this.button.textContent = 'Updating…';
    } catch (error) {
      this.notify(error.message);
      this.button.disabled = false;
    }
  }
}
