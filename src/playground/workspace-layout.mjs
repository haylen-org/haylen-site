// Panel state is independent of the open project and its input bindings.
export class WorkspaceLayout {
  constructor(onChange) {
    this.onChange = onChange;
    this.root = document.querySelector('.pg-workspace');
    this.state = { files: true, code: true, preview: true, console: true, pane: 'code' };
    this.compact = matchMedia('(max-width: 1100px)');
    this.phone = matchMedia('(max-width: 600px)');

    for (const name of ['files', 'code', 'preview', 'console']) {
      document.querySelector(`#toggle-${name}`).addEventListener('click', () => this.toggle(name));
      document.querySelector(`#hide-${name}`)?.addEventListener('click', () => this.hide(name));
    }

    document.querySelector('#show-files').addEventListener('click', () => this.show('files'));
    this.compact.addEventListener('change', () => this.render());
    this.phone.addEventListener('change', () => this.render());
    this.render();
  }

  restore(state) {
    if (!state) return;
    for (const name of ['files', 'code', 'preview', 'console']) {
      if (typeof state[name] === 'boolean') this.state[name] = state[name];
    }
    if (['files', 'code', 'preview'].includes(state.pane)) this.state.pane = state.pane;
    if (!this.state.code && !this.state.preview) this.state.code = true;
    this.render();
  }

  show(name) {
    this.state[name] = true;
    if (name === 'console') {
      this.state.preview = true;
      this.state.pane = 'preview';
    } else if (name !== 'files' || this.phone.matches) {
      this.state.pane = name;
    }
    this.render();
    this.onChange();
  }

  hide(name) {
    this.state[name] = false;
    if (name === 'files' && this.state.pane === 'files') this.state.pane = 'code';
    if (name === 'code') {
      this.state.preview = true;
      this.state.pane = 'preview';
    }
    if (name === 'preview') {
      this.state.code = true;
      this.state.pane = 'code';
    }
    this.render();
    this.onChange();
    document.querySelector(`#toggle-${name}`).focus();
  }

  toggle(name) {
    const visible = this.visible(name);
    if (visible) this.hide(name);
    else this.show(name);
  }

  visible(name) {
    if (name === 'console') return this.state.console && this.visible('preview');
    if (this.phone.matches) return this.state.pane === name;
    if (this.compact.matches && name !== 'files') {
      const pane = this.state.pane === 'files' ? 'code' : this.state.pane;
      return pane === name;
    }
    return this.state[name];
  }

  render() {
    const effectivePane = !this.phone.matches && this.state.pane === 'files' ? 'code' : this.state.pane;
    this.root.dataset.pane = effectivePane;

    for (const name of ['files', 'code', 'preview', 'console']) {
      const visible = name === 'console' ? this.state.console : this.visible(name);
      this.root.dataset[name] = visible ? 'open' : 'closed';
      document.querySelector(`#toggle-${name}`).setAttribute('aria-expanded', String(this.visible(name)));
    }
  }
}
