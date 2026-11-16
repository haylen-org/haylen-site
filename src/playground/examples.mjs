import { Project } from './project.mjs';

// Every example is an ordinary project. Loading one never merges its files.
export class ExampleProjects {
  async catalog() {
    if (!this.manifest) {
      const response = await fetch('./examples.json');
      if (!response.ok) throw new Error('The examples could not load. Check your connection and try again.');
      this.manifest = await response.json();
    }
    return this.manifest;
  }

  async load(id) {
    const catalog = await this.catalog();
    const example = catalog.projects.find((project) => project.id === (id ?? catalog.default));
    if (!example)
      throw new Error('This example could not be found. Reload the page and choose an example again.');
    const files = await Promise.all(
      example.files.map(async (path) => {
        const response = await fetch(`./${example.directory}/${path}`);
        if (!response.ok)
          throw new Error(`Could not load the file ${path}. Check your connection and try again.`);
        return [path, new Uint8Array(await response.arrayBuffer())];
      }),
    );
    return new Project(files);
  }
}
