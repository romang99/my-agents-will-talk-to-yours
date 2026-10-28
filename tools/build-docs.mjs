#!/usr/bin/env node
// build-docs.mjs — render docs/*.md to PDF.
//
// Markdown is the source of truth; PDFs are disposable build output. The route is
// pandoc (Markdown -> self-contained HTML) then headless Chrome (HTML -> PDF),
// which needs no LaTeX and gives the documents the prototype's own typography.
//
//   node tools/build-docs.mjs            # all documents
//   node tools/build-docs.mjs GUIDE      # only those whose filename matches

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(root, 'docs');
const outDir = path.join(docsDir, 'pdf');

/** Documents to build, in reading order. */
const DOCUMENTS = [
  'ONBOARDING.md',
  'STATUS.md',
  'DECISIONS.md',
  'GLOSSARY.md',
  'PROTOTYPE_GUIDE.md',
  'WORKING_WITH_RUNS.md',
  'TECHNICAL_SPECIFICATION.md',
  'RESEARCH_PROTOCOL.md',
  'DATA_ETHICS.md',
  'TECHNICAL_APPENDIX.md',
  'PUBLISHING_CHECKLIST.md',
];

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

/** Print stylesheet — the prototype's chart-room palette, on paper. */
const CSS = `
  @page { size: A4; margin: 20mm 18mm; }
  html { font-size: 10.5pt; }
  body {
    font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
    color: #171B2E; line-height: 1.55; max-width: none; margin: 0;
  }
  h1, h2, h3, h4 {
    font-family: "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #2A3157; line-height: 1.25; margin: 1.6em 0 0.5em;
  }
  h1 { font-size: 1.45rem; border-bottom: 1px solid #C9D0E0; padding-bottom: 0.25em;
       margin-top: 2.1em; page-break-after: avoid; }
  h2 { font-size: 1.15rem; page-break-after: avoid; }
  h3 { font-size: 1rem; page-break-after: avoid; }
  header#title-block-header {
    border-bottom: 2px solid #2A3157; margin-bottom: 2.5em; padding-bottom: 1.2em;
  }
  header#title-block-header h1.title {
    border: 0; font-size: 1.9rem; margin: 0 0 0.2em; page-break-before: avoid;
  }
  header#title-block-header p.subtitle { font-size: 1.05rem; color: #4A5378; margin: 0 0 0.9em; font-style: italic; }
  header#title-block-header p.author, header#title-block-header p.date {
    font-family: "Avenir Next", Helvetica, Arial, sans-serif;
    font-size: 0.82rem; color: #5A6180; margin: 0.1em 0;
  }
  a { color: #3E4C8A; text-decoration: none; }
  code, pre { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 0.85em; }
  code { background: #ECEFF5; padding: 0.1em 0.32em; border-radius: 3px; }
  pre { background: #ECEFF5; padding: 0.8em 1em; border-radius: 6px;
        border-left: 3px solid #5E6FD0; overflow-x: auto; page-break-inside: avoid; }
  pre code { background: none; padding: 0; }
  blockquote {
    margin: 1.2em 0; padding: 0.6em 1.1em; background: #F4F1E4;
    border-left: 3px solid #A87F26; color: #3A3520;
  }
  blockquote p { margin: 0.35em 0; }
  table {
    border-collapse: collapse; width: 100%; margin: 1.1em 0;
    font-size: 0.88rem; page-break-inside: avoid;
  }
  th, td { border: 1px solid #C9D0E0; padding: 0.42em 0.6em; text-align: left; vertical-align: top; }
  th { background: #E4E8F2; font-family: "Avenir Next", Helvetica, Arial, sans-serif;
       font-size: 0.82rem; letter-spacing: 0.02em; }
  tr:nth-child(even) td { background: #F7F8FB; }
  ul, ol { padding-left: 1.4em; }
  li { margin: 0.28em 0; }
  hr { border: 0; border-top: 1px solid #C9D0E0; margin: 2em 0; }
`;

function findChrome() {
  const found = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      `No Chrome-family browser found. Looked in:\n  ${CHROME_CANDIDATES.join('\n  ')}\n` +
        'The Markdown documents in docs/ are the source of truth and remain readable without PDFs.',
    );
  }
  return found;
}

function requirePandoc() {
  try {
    execFileSync('pandoc', ['--version'], { stdio: 'ignore' });
  } catch {
    throw new Error('pandoc is not installed. `brew install pandoc`, or read the Markdown in docs/.');
  }
}

/** A document's own `title:`, if it declares one in YAML frontmatter. */
function frontmatterTitle(mdPath) {
  const head = fs.readFileSync(mdPath, 'utf8').split(/\r?\n/);
  if (head[0]?.trim() !== '---') return null;
  for (let i = 1; i < head.length && head[i].trim() !== '---'; i += 1) {
    const m = /^title:\s*(.+)$/.exec(head[i]);
    if (m) return m[1].trim().replace(/^["'](.*)["']$/, '$1');
  }
  return null;
}

/** TECHNICAL_APPENDIX -> "Technical Appendix", for documents with no frontmatter. */
function titleFromFilename(mdPath) {
  return path
    .basename(mdPath, '.md')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Markdown -> self-contained HTML, titled from YAML frontmatter or the filename. */
function toHtml(mdPath, cssPath, htmlPath) {
  // `--metadata title=` OVERRIDES frontmatter rather than filling in for it, so
  // it may only be passed when the document declares no title of its own.
  const ownTitle = frontmatterTitle(mdPath);
  execFileSync('pandoc', [
    mdPath,
    '--standalone',
    '--embed-resources',
    '--from=gfm+yaml_metadata_block+tex_math_dollars',
    '--to=html5',
    '--mathml', // renders natively in Chrome; keeps the HTML self-contained
    `--css=${cssPath}`,
    ...(ownTitle ? [] : ['--metadata', `title=${titleFromFilename(mdPath)}`]),
    '--output', htmlPath,
  ]);
}

function toPdf(chrome, htmlPath, pdfPath) {
  execFileSync(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--no-pdf-header-footer',
      '--virtual-time-budget=4000',
      `--print-to-pdf=${pdfPath}`,
      `file://${htmlPath}`,
    ],
    { stdio: 'ignore' },
  );
  if (!fs.existsSync(pdfPath)) throw new Error(`Chrome produced no PDF for ${path.basename(htmlPath)}`);
}

function main() {
  requirePandoc();
  const chrome = findChrome();

  const filter = process.argv[2];
  const targets = DOCUMENTS.filter(
    (d) => (!filter || d.toLowerCase().includes(filter.toLowerCase())) && fs.existsSync(path.join(docsDir, d)),
  );
  if (!targets.length) throw new Error(`Nothing to build${filter ? ` matching "${filter}"` : ''}.`);

  fs.mkdirSync(outDir, { recursive: true });
  const cssPath = path.join(outDir, '.print.css');
  fs.writeFileSync(cssPath, CSS);

  for (const doc of targets) {
    const base = path.basename(doc, '.md');
    const htmlPath = path.join(outDir, `${base}.html`);
    const pdfPath = path.join(outDir, `${base}.pdf`);
    toHtml(path.join(docsDir, doc), cssPath, htmlPath);
    toPdf(chrome, htmlPath, pdfPath);
    fs.rmSync(htmlPath);
    const kb = Math.round(fs.statSync(pdfPath).size / 1024);
    console.log(`  ${base}.pdf  (${kb} KB)`);
  }
  fs.rmSync(cssPath);
  console.log(`\n${targets.length} document(s) -> docs/pdf/`);
}

try {
  main();
} catch (err) {
  console.error(`\nDocument build failed: ${err.message}\n`);
  process.exit(1);
}
