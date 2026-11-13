import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const pages = [
  'index', 'lifecycle', 'problem-framing', 'data-preparation', 'probability',
  'decision-trees', 'linear-models', 'validation', 'similarity-clustering',
  'evaluation', 'text-mining', 'associations-ensembles', 'neural-anomaly',
  'optimization', 'pii-phi', 'python-engineering', 'delivery', 'teamwork',
  'applied-projects', 'glossary', 'coverage', 'source-notes',
];

test('the downloadable notebook covers all textbook parts with cleared outputs', () => {
  const notebook = JSON.parse(read('MLStudy.ipynb'));
  assert.equal(notebook.nbformat, 4);
  assert.equal(notebook.metadata.kernelspec.language, 'python');
  const markdown = notebook.cells.filter(cell => cell.cell_type === 'markdown')
    .map(cell => cell.source.join('')).join('\n');
  for (let part = 1; part <= pages.length; part++) {
    assert.match(markdown, new RegExp(`Part\\s+0?${part}\\b`, 'i'));
  }
  for (const [index, cell] of notebook.cells.entries()) {
    assert.ok(cell.id, `cell ${index} needs a stable ID`);
    if (cell.cell_type !== 'code') continue;
    assert.equal(cell.execution_count, null);
    assert.deepEqual(cell.outputs, []);
    assert.ok(cell.source.join('').trim(), `empty code cell ${index}`);
    assert.equal(notebook.cells[index - 1]?.cell_type, 'markdown',
      `code cell ${index} needs an explanatory preface`);
  }
});

test('learning sections have local imports and numbered explanatory steps', () => {
  const notebook = JSON.parse(read('MLStudy.ipynb'));
  const firstPart = notebook.cells.findIndex(cell => cell.id === 'part-01');
  assert.ok(firstPart > 0);
  const setup = notebook.cells.slice(0, firstPart)
    .filter(cell => cell.cell_type === 'code' && cell.id !== 'install-dependencies')
    .map(cell => cell.source.join('')).join('\n');
  assert.doesNotMatch(setup, /^\s*from (?:sklearn|scipy|matplotlib)\b/m,
    'teaching imports belong in their sections, not a shared import wall');

  const sections = new Map();
  let part;
  for (const cell of notebook.cells.slice(firstPart)) {
    if (/^part-\d{2}$/.test(cell.id)) {
      part = cell.id;
      sections.set(part, []);
    }
    if (cell.cell_type !== 'code') continue;
    sections.get(part).push(cell.source.join(''));
    assert.match(cell.source.join(''), /^\s*#\s*\d+[\s,.—:–-]/m,
      `${cell.id} needs numbered teaching comments`);
    const executableLines = cell.source.join('').split('\n')
      .filter(line => line.trim() && !line.trimStart().startsWith('#'));
    assert.ok(executableLines.length <= 45,
      `${cell.id} should be split into shorter guided steps`);
  }
  assert.equal(sections.size, 22);
  for (const [id, code] of sections) {
    assert.match(code[0], /^\s*(?:from \S+ import |import \S+)/m,
      `${id} should introduce its imports in its first code cell`);
  }
  for (const [id, module] of [
    ['part-06', 'sklearn.tree'], ['part-07', 'sklearn.linear_model'],
    ['part-09', 'sklearn.cluster'], ['part-11', 'sklearn.feature_extraction.text'],
    ['part-12', 'sklearn.ensemble'], ['part-13', 'sklearn.neural_network'],
    ['part-14', 'scipy.optimize'],
  ]) {
    assert.ok(sections.get(id).join('\n').includes(`from ${module} import `),
      `${id} needs its own ${module} import`);
  }
});

test('every section links its numbered exercise to a notebook download', () => {
  for (const [index, page] of pages.entries()) {
    const html = read(`${page}.html`);
    const exercise = html.match(/<aside class="callout notebook-exercise"[\s\S]*?<\/aside>/)?.[0];
    assert.ok(exercise, `missing exercise in ${page}`);
    assert.ok(exercise.includes(`Part ${String(index + 1).padStart(2, '0')}`));
    assert.match(exercise, /href="MLStudy\.ipynb" download/);
    assert.ok(html.indexOf(exercise) < html.indexOf('<div class="pager">'));
    assert.doesNotMatch(html, /<(?:iframe|object|embed)[^>]*MLStudy\.ipynb/i);
    assert.doesNotMatch(html, /(?:pyodide|jupyterlite|thebe|type=["']text\/python)/i);
  }
});

test('all companion download links resolve to nonempty local files', () => {
  const html = read('index.html');
  const links = [...html.matchAll(/href="([^"]+)" download/g)].map(match => match[1]);
  assert.doesNotMatch(html, /requirements-notebook\.txt/);
  assert.doesNotMatch(read('MLStudy.ipynb'), /requirements-notebook\.txt/);
  const notebook = JSON.parse(read('MLStudy.ipynb'));
  const install = notebook.cells.find(cell => cell.id === 'install-dependencies');
  assert.equal(install?.cell_type, 'code');
  assert.match(install.source.join(''), /^%pip install /);
  for (const name of ['numpy', 'pandas', 'scipy', 'scikit-learn', 'matplotlib',
    'ipywidgets', 'ipykernel', 'jupyterlab', 'joblib']) {
    assert.ok(install.source.join('').includes(`${name}>=`), `missing package ${name}`);
  }
  assert.equal(existsSync(resolve(root, 'requirements-notebook.txt')), false);
  for (const expected of ['MLStudy.ipynb',
    'datasets/study-customers.csv', 'datasets/study-sensors.csv']) {
    assert.ok(links.includes(expected), `missing download ${expected}`);
    assert.ok(existsSync(resolve(root, expected)), `missing file ${expected}`);
    assert.ok(read(expected).trim().length > 0);
  }
  for (const csv of links.filter(link => link.endsWith('.csv'))) {
    const lines = read(csv).trim().split(/\r?\n/);
    assert.ok(lines.length > 10, `${csv} needs sample rows`);
    assert.ok(lines[0].includes(','), `${csv} needs named columns`);
  }
});
