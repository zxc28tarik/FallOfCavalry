// Syntax checker: find brace/paren imbalance in main.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(process.cwd(), 'js/main.js'), 'utf8');
const lines = src.split('\n');

let braceDepth = 0, parenDepth = 0;
let inString = null, inBlock = false;

for (let lineIdx = 0; lineIdx < Math.min(lines.length, 2313); lineIdx++) {
  const line = lines[lineIdx];
  let inLineComment = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const c2 = line[i + 1];

    if (inBlock) {
      if (c === '*' && c2 === '/') { inBlock = false; i++; }
      continue;
    }
    if (inLineComment) break;
    if (inString) {
      const BS = String.fromCharCode(92); // backslash
      if (c === BS) { i++; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '`' || c === '"' || c === "'") { inString = c; continue; }
    if (c === '/' && c2 === '/') { inLineComment = true; break; }
    if (c === '/' && c2 === '*') { inBlock = true; i++; continue; }
    if (c === '{') braceDepth++;
    if (c === '}') braceDepth--;
    if (c === '(') parenDepth++;
    if (c === ')') parenDepth--;
  }

  if (braceDepth < 0 || parenDepth < 0) {
    console.log('NEGATIVE depth at line ' + (lineIdx + 1) + ': brace=' + braceDepth + ' paren=' + parenDepth);
    console.log('  ' + line.trimEnd());
    braceDepth = Math.max(0, braceDepth);
    parenDepth = Math.max(0, parenDepth);
  }
}

console.log('At line 2314 => braceDepth=' + braceDepth + ' parenDepth=' + parenDepth + ' inString=' + inString + ' inBlock=' + inBlock);
if (braceDepth === 1) console.log('OK: depth=1 means we are inside class body (expected)');
else console.log('WARNING: unexpected braceDepth=' + braceDepth + ' (expected 1 for class body)');
