// Find where brace depth gets stuck at 2 between lines 858-2313
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(process.cwd(), 'js/main.js'), 'utf8');
const lines = src.split('\n');

let braceDepth = 0, parenDepth = 0;
let inString = null, inBlock = false;

// First get to line 858 by processing up to there
for (let lineIdx = 0; lineIdx < 858; lineIdx++) {
  const line = lines[lineIdx];
  let inLineComment = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i], c2 = line[i+1];
    if (inBlock) { if (c==='*'&&c2==='/'){inBlock=false;i++;} continue; }
    if (inLineComment) break;
    if (inString) {
      const BS = String.fromCharCode(92);
      if (c===BS){i++;continue;}
      if (c===inString) inString=null;
      continue;
    }
    if (c==='`'||c==='"'||c==="'"){inString=c;continue;}
    if (c==='/'&&c2==='/'){inLineComment=true;break;}
    if (c==='/'&&c2==='*'){inBlock=true;i++;continue;}
    if (c==='{') braceDepth++;
    if (c==='}') braceDepth--;
    if (c==='(') parenDepth++;
    if (c===')') parenDepth--;
  }
}

console.log('Depth at line 858 (after our fix): braceDepth=' + braceDepth);

// Now process lines 858-2313 and track where depth goes to 2 and stays
let lastDepth2Line = -1;
for (let lineIdx = 858; lineIdx < 2313; lineIdx++) {
  const prevDepth = braceDepth;
  const line = lines[lineIdx];
  let inLineComment = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i], c2 = line[i+1];
    if (inBlock) { if (c==='*'&&c2==='/'){inBlock=false;i++;} continue; }
    if (inLineComment) break;
    if (inString) {
      const BS = String.fromCharCode(92);
      if (c===BS){i++;continue;}
      if (c===inString) inString=null;
      continue;
    }
    if (c==='`'||c==='"'||c==="'"){inString=c;continue;}
    if (c==='/'&&c2==='/'){inLineComment=true;break;}
    if (c==='/'&&c2==='*'){inBlock=true;i++;continue;}
    if (c==='{') braceDepth++;
    if (c==='}') braceDepth--;
    if (c==='(') parenDepth++;
    if (c===')') parenDepth--;
  }
  // Track when we go from 1 -> 2 (entering a method) and 2 -> 1 (exiting a method)
  // We want to find a method that opens (1->2) but never returns to 1
  if (prevDepth === 1 && braceDepth === 2) {
    lastDepth2Line = lineIdx + 1;
  }
  if (prevDepth === 2 && braceDepth === 1) {
    lastDepth2Line = -1; // closed properly
  }
}

console.log('Final braceDepth: ' + braceDepth);
if (lastDepth2Line >= 0) {
  console.log('UNCLOSED method/block opened at line: ' + lastDepth2Line);
  // Show context around that line
  console.log('Context:');
  for (let i = lastDepth2Line - 3; i <= lastDepth2Line + 3; i++) {
    console.log('  ' + (i+1) + ': ' + lines[i]);
  }
}
