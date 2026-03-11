// Find the last line where braceDepth was exactly 1 between lines 858-2313
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

  // Show depth transitions in range 2030-2320
  if (lineIdx >= 2029 && lineIdx <= 2320) {
    if (braceDepth !== prevDepth) {
      console.log(`Line ${lineIdx+1}: depth ${prevDepth} -> ${braceDepth}  |  ${line.trim().substring(0,80)}`);
    }
  }
}

console.log('\nFinal depth: ' + braceDepth);
