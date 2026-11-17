#!/usr/bin/env node
/**
 * Prevent temporary build outputs from re-entering the repository history.
 * Runtime dependencies: Node.js + git only. An unpacked source archive
 * without .git can run other validation steps normally.
 */
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
if (!existsSync(resolve(root, '.git'))) {
  console.log('[repo-hygiene] SKIP: source archive without Git metadata.');
  process.exit(0);
}

const gitFiles = execFileSync('git', ['ls-files', '-z'], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).split('\0').filter(Boolean);

const disallowed = [
  /^output\//i,
  /^tmp\//i,
  /^screenshots\//i,
  /^\.vite\//i,
  /(^|\/)__pycache__\//i,
  /\.pyc$/i,
  /\.pyo$/i,
];
const violations = gitFiles.filter(file => disallowed.some(rule => rule.test(file)));
if (violations.length) {
  console.error('[repo-hygiene] FAIL: generated files are tracked by Git:\n' + violations.join('\n'));
  process.exit(1);
}
console.log('[repo-hygiene] PASS: no tracked temporary outputs or caches.');
