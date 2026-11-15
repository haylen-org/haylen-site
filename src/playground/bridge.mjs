// Authenticate once, then use a private MessagePort so cross-frame focus
// transitions cannot interfere with source checks on later commands.
export class PlayerBridge {
  constructor(onEvent) {
    this.onEvent = onEvent;
    window.addEventListener('message', (event) => this.connect(event));
  }
  start(bytes, container) {
    this.destroy();
    this.session = crypto.randomUUID();
    this.bytes = bytes;
    this.frame = document.createElement('iframe');
    this.frame.title = 'Haylen project preview';
    this.frame.id = 'runtime-frame';
    this.frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    this.frame.allow = 'autoplay; fullscreen';
    this.frame.src = `./runtime#${this.session}`;
    container.append(this.frame);
    return this.frame;
  }
  connect({ source, origin, data }) {
    if (
      !this.frame ||
      source !== this.frame.contentWindow ||
      origin !== location.origin ||
      data?.haylenPlayground !== this.session ||
      data.type !== 'ready' ||
      !this.bytes
    )
      return;
    const channel = new MessageChannel();
    const session = this.session;
    this.port = channel.port1;
    this.port.onmessage = ({ data: message }) => {
      if (session === this.session) this.onEvent(message);
    };
    this.frame.contentWindow.postMessage(
      { haylenPlayground: this.session, type: 'boot', detail: { bytes: this.bytes } },
      location.origin,
      [channel.port2],
    );
    this.bytes = undefined;
  }
  post(type, detail = {}) {
    this.port?.postMessage({ type, detail });
  }
  destroy() {
    this.port?.close();
    this.port = undefined;
    this.frame?.remove();
    this.frame = undefined;
    this.bytes = undefined;
    this.session = undefined;
  }
}
