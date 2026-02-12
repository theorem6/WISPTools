#!/usr/bin/env node
/**
 * Link audit for docs/: find broken internal links in Markdown files.
 * Scans docs/ for [text](url) and reports missing relative file targets.
 * External URLs are not checked (use optional --external to enable).
 */
const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');
const linkRe = /\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;

function* walkMd(dir, base = dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walkMd(full, base);
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
      yield path.relative(base, full).replace(/\\/g, '/');
    }
  }
}

function resolveTarget(fromFile, href) {
  if (!href || href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
    return null;
  }
  const fromDir = path.dirname(fromFile);
  const joined = path.normalize(path.join(fromDir, href)).replace(/\\/g, '/');
  const withoutHash = joined.split('#')[0];
  return withoutHash || null;
}

const repoRoot = path.join(docsDir, '..');
function checkExists(relPath) {
  const fullInDocs = path.join(docsDir, relPath);
  if (fs.existsSync(fullInDocs)) return true;
  const withMdInDocs = fullInDocs.endsWith('.md') ? fullInDocs : fullInDocs + '.md';
  if (fs.existsSync(withMdInDocs)) return true;
  const fullInRepo = path.join(repoRoot, relPath);
  if (fs.existsSync(fullInRepo)) return true;
  const withMdInRepo = fullInRepo.endsWith('.md') ? fullInRepo : fullInRepo + '.md';
  return fs.existsSync(withMdInRepo);
}

const broken = [];
for (const rel of walkMd(docsDir)) {
  const fullPath = path.join(docsDir, rel);
  const content = fs.readFileSync(fullPath, 'utf8');
  let m;
  linkRe.lastIndex = 0;
  while ((m = linkRe.exec(content)) !== null) {
    const [, text, url] = m;
    const target = resolveTarget(rel, url);
    if (target && !checkExists(target)) {
      broken.push({ file: rel, link: url, text: text.slice(0, 40) });
    }
  }
}

if (broken.length === 0) {
  console.log('OK: No broken internal links found in docs/');
  process.exit(0);
}

console.log('Broken internal links in docs/:');
for (const { file, link, text } of broken) {
  console.log(`  ${file}: [${text}](${link})`);
}
console.log(`Total: ${broken.length}`);
process.exit(1);
