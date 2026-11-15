import { Project } from './project.mjs';

// Every example is an ordinary project. Loading one never merges its files.
export class ExampleProjects {
  async catalog() {
    if (!this.manifest) {
      const response = await fetch('./examples.json');
      if (!response.ok) throw new Error('The example list could not load.');
      this.manifest = await response.json();
    }
    return this.manifest;
  }

  async load(id) {
    const catalog = await this.catalog();
    const example = catalog.projects.find((project) => project.id === (id ?? catalog.default));
    if (!example) throw new Error('That example is unavailable.');
    const files = await Promise.all(
      example.files.map(async (path) => {
        const response = await fetch(`./${example.directory}/${path}`);
        if (!response.ok) throw new Error(`Could not load ${path}.`);
        return [path, new Uint8Array(await response.arrayBuffer())];
      }),
    );
    return new Project(files);
  }
}
