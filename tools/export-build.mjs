#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const distDir = resolve(root, 'dist');
const copyDirs = ['css', 'js', 'assets'];
const copyFiles = ['index.html', 'favicon.ico', 'favicon.png', 'favicon.svg'];

function getBuiltAt() {
  return new Date().toISOString();
}

function getVersion(builtAt) {
  try {
    const hash = execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (hash) return hash;
  } catch {}
  const d = new Date(builtAt);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}`;
}

function ensureCleanDist() {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
}

function copyProjectFiles() {
  for (const file of copyFiles) {
    const src = resolve(root, file);
    if (!existsSync(src) || !statSync(src).isFile()) continue;
    cpSync(src, resolve(distDir, file));
  }

  for (const dir of copyDirs) {
    const src = resolve(root, dir);
    if (!existsSync(src) || !statSync(src).isDirectory()) continue;
    cpSync(src, resolve(distDir, dir), { recursive: true });
  }
}

function stampBuildInfo(version, builtAt) {
  const constantsPath = resolve(distDir, 'js/constants.js');
  if (!existsSync(constantsPath)) return;

  const source = readFileSync(constantsPath, 'utf8');
  const stamped = source
    .replace(/version:\s*'[^']*'/, `version: '${version}'`)
    .replace(/builtAt:\s*(null|'[^']*')/, `builtAt: '${builtAt}'`);

  writeFileSync(constantsPath, stamped, 'utf8');
}

function writeReleaseTxt(version, builtAt) {
  const lines = [
    'FallOfCavalry Release Export',
    `version=${version}`,
    `builtAt=${builtAt}`,
    '',
    'Run options:',
    '1) VS Code Live Server: dist/index.html üzerinde Open with Live Server.',
    '2) Python: cd dist && python -m http.server 8080',
  ];
  writeFileSync(resolve(distDir, 'RELEASE.txt'), `${lines.join('\n')}\n`, 'utf8');
}

function listDist() {
  return readdirSync(distDir, { withFileTypes: true })
    .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
    .sort();
}

const builtAt = getBuiltAt();
const version = getVersion(builtAt);

ensureCleanDist();
copyProjectFiles();
stampBuildInfo(version, builtAt);
writeReleaseTxt(version, builtAt);

console.log(`[export-build] OK version=${version} builtAt=${builtAt}`);
console.log(`[export-build] dist contents: ${listDist().join(', ')}`);
