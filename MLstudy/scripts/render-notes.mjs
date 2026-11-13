import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, basename } from 'node:path';
import { Marked } from 'marked';
import katex from 'katex';

const root = fileURLToPath(new URL('../', import.meta.url));
const markdown = await readFile(join(root, 'assets/course-notes.md'), 'utf8');
const pagePath = join(root, 'source-notes.html');
const page = await readFile(pagePath, 'utf8');
let equationCount = 0;

function renderMath(token) {
  equationCount++;
  return katex.renderToString(token.text, {
    displayMode: token.type === 'displayMath',
    throwOnError: true,
    strict: 'error',
    trust: false,
    output: 'htmlAndMathml',
  });
}

const parser = new Marked({
  extensions: [
    {
      name: 'displayMath',
      level: 'block',
      start: source => source.indexOf('$$'),
      tokenizer(source) {
        const match = /^\$\$[ \t]*\n([\s\S]+?)\n\$\$[ \t]*(?:\n|$)/.exec(source);
        if (match) return { type: 'displayMath', raw: match[0], text: match[1] };
      },
      renderer: renderMath,
    },
    {
      name: 'inlineMath',
      level: 'inline',
      start: source => source.search(/\$(?![\s$])/),
      tokenizer(source) {
        const match = /^\$(?![\s$])([^\n$]*?[^\s$])\$(?!\d)/.exec(source);
        if (match) return { type: 'inlineMath', raw: match[0], text: match[1] };
      },
      renderer: renderMath,
    },
  ],
  walkTokens(token) {
    if (token.type === 'image') {
      const filename = basename(decodeURIComponent(token.href));
      token.href = `assets/notes-images/${encodeURIComponent(filename)}`;
      token.text = `Original notes figure: ${filename}`;
    }
  },
  renderer: {
    image({ href, text }) {
      return `<img class="note-image" src="${href}" alt="${text}" loading="lazy">`;
    },
  },
});

const rendered = parser.parse(markdown);
const start = '<h2 id="original">Complete source text and images</h2>';
const end = '<div class="pager">';
const contentStart = page.indexOf(start);
const contentEnd = page.indexOf(end, contentStart);
if (contentStart < 0 || contentEnd < 0) throw new Error('Source notes template markers are missing');
let updated = page.slice(0, contentStart + start.length)
  + `\n<div class="notes-content">\n${rendered}</div>\n`
  + page.slice(contentEnd);
if (!updated.includes('href="assets/katex/katex.min.css"')) {
  updated = updated.replace('<link rel="stylesheet" href="assets/theme.css">', '<link rel="stylesheet" href="assets/theme.css"><link rel="stylesheet" href="assets/katex/katex.min.css">');
}
updated = updated
  .replace('Their original Markdown/math notation is retained in the text blocks; study the corrected explanations in the main chapters.', 'Formatting and equations are rendered for readability; the original Markdown remains available to download. Study the corrected explanations in the main chapters.')
  .replace('The original mathematical markup is visible rather than dependent on an online renderer.', 'Equations and formatting work offline without an external rendering service.');

const katexPackage = join(root, 'node_modules/katex');
const destination = join(root, 'assets/katex');
await mkdir(join(destination, 'fonts'), { recursive: true });
await copyFile(join(katexPackage, 'dist/katex.min.css'), join(destination, 'katex.min.css'));
await copyFile(join(katexPackage, 'LICENSE'), join(destination, 'LICENSE'));
for (const font of await readdir(join(katexPackage, 'dist/fonts'))) {
  await copyFile(join(katexPackage, 'dist/fonts', font), join(destination, 'fonts', font));
}
await writeFile(pagePath, updated);
console.log(`Rendered original notes with ${equationCount} equations. Original Markdown is unchanged.`);
