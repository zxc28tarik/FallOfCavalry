// Check brace balance for entire file and report final depth
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(process.cwd(), 'js/main.js'), 'utf8');
const lines = src.split('\n');

let braceDepth = 0;
let inString = null, inBlock = false;

for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
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
  }
  if (braceDepth < 0) {
    console.log('NEGATIVE at line ' + (lineIdx+1) + ': ' + line.trim().substring(0,60));
    braceDepth = 0;
  }
}

console.log('Final depth: ' + braceDepth + ' (should be 0)');
if (braceDepth === 0) console.log('OK: file is balanced');
else console.log('ERROR: ' + braceDepth + ' unclosed braces remaining');
