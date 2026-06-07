#!/usr/bin/env node
/**
 * Scan source files for unresolved Git merge conflict blocks.
 * This is intended to run before lint/tests/build in `npm run validate`.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

const ROOT_FILES = [
  'CLAUDE.md',
  'eslint.config.mjs',
  'index.html',
  'package.json',
  'progress.md',
  'vitest.config.mjs',
];

const SCAN_DIRS = ['js', 'tests', 'scripts', 'css', 'docs'];
const SKIP_DIRS = new Set(['.git', '.vite', 'dist', 'node_modules', 'output', 'tmp']);
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.html', '.md']);

function* walkDir(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name))) {
      yield fullPath;
    }
  }
}

function displayPath(cwd, filePath) {
  return relative(cwd, filePath).split(sep).join('/');
}

function isStartMarker(line) {
  return line.trimStart().startsWith('<<<<<<<');
}

function isSeparatorMarker(line) {
  return line.trimStart().startsWith('=======');
}

function isEndMarker(line) {
  return line.trimStart().startsWith('>>>>>>>');
}

function checkFile(filePath) {
  const hits = [];
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  let inConflict = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    if (isStartMarker(line)) {
      inConflict = true;
      hits.push({ line: lineNumber, content: line.trim().slice(0, 100) });
      continue;
    }

    if (!inConflict) continue;

    if (isSeparatorMarker(line) || isEndMarker(line)) {
      hits.push({ line: lineNumber, content: line.trim().slice(0, 100) });
      if (isEndMarker(line)) inConflict = false;
    }
  }

  return hits;
}

const cwd = process.cwd();
const files = [];

for (const file of ROOT_FILES) {
  const fullPath = join(cwd, file);
  if (existsSync(fullPath)) files.push(fullPath);
}

for (const dir of SCAN_DIRS) {
  files.push(...walkDir(join(cwd, dir)));
}

const findings = [];
for (const filePath of files) {
  const hits = checkFile(filePath);
  if (hits.length > 0) {
    findings.push({ filePath: displayPath(cwd, filePath), hits });
  }
}

if (findings.length === 0) {
  console.log('No conflict markers found.');
  process.exit(0);
}

console.error(`Unresolved merge conflict markers found in ${findings.length} file(s):`);
console.error('');

for (const { filePath, hits } of findings) {
  console.error(filePath);
  for (const { line, content } of hits) {
    console.error(`  line ${line}: ${content}`);
  }
}

console.error('');
console.error('Resolve these markers before running lint, tests, or build.');
process.exit(1);
