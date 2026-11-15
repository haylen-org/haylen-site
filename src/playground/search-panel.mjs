import {
  SearchQuery,
  getSearchQuery,
  setSearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  selectMatches,
  replaceNext,
  replaceAll,
} from '@codemirror/search';
import { runScopeHandlers } from '@codemirror/view';

// CodeMirror owns matching and edits. This panel owns the IDE's accessible controls.
export class SearchPanel {
  constructor(view) {
    this.view = view;
    this.top = true;
    this.query = getSearchQuery(view.state);
    this.dom = document.createElement('search');
    this.dom.className = 'pg-search';
    this.dom.setAttribute('aria-label', 'Find and replace in this file');

    const findRow = this.row();
    this.searchField = this.field(findRow, 'Find', 'search');
    this.searchField.setAttribute('main-field', 'true');
    const navigation = this.actions(findRow);
    this.button(navigation, '↑', 'Previous match', findPrevious);
    this.button(navigation, '↓', 'Next match', findNext);
    this.button(navigation, 'All', 'Select all matches', selectMatches);
    this.button(navigation, '×', 'Close search', closeSearchPanel);

    if (!view.state.readOnly) {
      const replaceRow = this.row();
      this.replaceField = this.field(replaceRow, 'Replace', 'replace');
      const replacements = this.actions(replaceRow);
      replacements.classList.add('pg-search-replacements');
      this.button(replacements, 'Replace', 'Replace next match', replaceNext);
      this.button(replacements, 'All', 'Replace all matches', replaceAll);
    }

    const options = document.createElement('div');
    options.className = 'pg-search-options';
    this.caseField = this.checkbox(options, 'Match case', 'case');
    this.regexpField = this.checkbox(options, 'Regex', 'regexp');
    this.wordField = this.checkbox(options, 'Whole word', 'word');
    this.dom.append(options);
    this.setQuery(this.query);

    this.dom.addEventListener('input', () => this.commit());
    this.dom.addEventListener('change', () => this.commit());
    this.dom.addEventListener('keydown', (event) => {
      if (event.isComposing) return;
      if (runScopeHandlers(view, event, 'search-panel')) {
        event.preventDefault();
      } else if (event.key === 'Enter' && event.target === this.searchField) {
        event.preventDefault();
        (event.shiftKey ? findPrevious : findNext)(view);
      } else if (event.key === 'Enter' && event.target === this.replaceField) {
        event.preventDefault();
        replaceNext(view);
      }
    });
  }

  row() {
    const row = document.createElement('div');
    row.className = 'pg-search-row';
    this.dom.append(row);
    return row;
  }

  field(row, text, name) {
    const label = document.createElement('label');
    const caption = document.createElement('span');
    caption.textContent = text;
    const input = document.createElement('input');
    input.type = 'text';
    input.name = name;
    input.autocomplete = 'off';
    input.autocapitalize = 'none';
    input.setAttribute('autocorrect', 'off');
    input.spellcheck = false;
    label.append(caption, input);
    row.append(label);
    return input;
  }

  actions(row) {
    const group = document.createElement('div');
    group.className = 'pg-search-actions';
    row.append(group);
    return group;
  }

  button(group, text, label, command) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => command(this.view));
    group.append(button);
  }

  checkbox(group, text, name) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = name;
    label.append(input, document.createTextNode(text));
    group.append(label);
    return input;
  }

  commit() {
    const query = new SearchQuery({
      search: this.searchField.value,
      replace: this.replaceField?.value ?? '',
      caseSensitive: this.caseField.checked,
      regexp: this.regexpField.checked,
      wholeWord: this.wordField.checked,
    });
    this.searchField.setAttribute('aria-invalid', String(!query.valid && query.search.length > 0));
    if (query.eq(this.query)) return;
    this.query = query;
    this.view.dispatch({ effects: setSearchQuery.of(query) });
  }

  update(update) {
    const query = getSearchQuery(update.state);
    if (!query.eq(this.query)) this.setQuery(query);
  }

  setQuery(query) {
    this.query = query;
    this.searchField.value = query.search;
    this.searchField.setAttribute('aria-invalid', String(!query.valid && query.search.length > 0));
    if (this.replaceField) this.replaceField.value = query.replace;
    this.caseField.checked = query.caseSensitive;
    this.regexpField.checked = query.regexp;
    this.wordField.checked = query.wholeWord;
  }

  mount() {
    this.searchField.select();
  }
}
