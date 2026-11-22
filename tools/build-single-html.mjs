#!/usr/bin/env node
/**
 * Package the current Vite entry into an actual self-contained HTML file.
 * Refuse to claim standalone success if Vite left extra JS or CSS chunks.
 */
import {readFileSync,writeFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import {join,resolve,basename} from 'node:path';
const root=process.cwd();
const dist=resolve(root,'dist-single');
const index=join(dist,'index.html');
let html=readFileSync(index,'utf8');
let scriptCount=0,styleCount=0;
const inline=(relative,kind)=>{
  const disk=resolve(dist,relative.replace(/^\.\//,'').replace(/^\//,''));
  if(!disk.startsWith(dist+'/'))throw new Error('Invalid dist asset '+relative);
  const data=readFileSync(disk,'utf8');
  if(kind==='script'){
    scriptCount++;
    return '<script type="module">\n'+data.replace(/<\/script/gi,'<\\/script')+'\n</script>';
  }
  styleCount++;
  return '<style>\n'+data.replace(/<\/style/gi,'<\\/style')+'\n</style>';
};
html=html.replace(/<script\s+type="module"[^>]*\ssrc="([^"]+)"[^>]*><\/script>/g,
  (_match,src)=>inline(src,'script'));
html=html.replace(/<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*\/?\s*>/g,
  (_match,href)=>inline(href,'style'));
html=html.replace(/<link\s+rel="modulepreload"[^>]*>/g,'');
if(scriptCount!==1)throw new Error('Expected one fully inlined JS entry; got '+scriptCount);
if(styleCount===0)throw new Error('Expected compiled CSS to be inlined');
const other=[];
const traverse=(folder)=>{for(const name of readdirSync(folder)){
  const path=join(folder,name);
  if(statSync(path).isDirectory())traverse(path);
  else if(path!==index && !/\.(?:js|css)$/.test(name))other.push(path.slice(dist.length+1));
}};
traverse(dist);
if(other.length)throw new Error('Non-inline Vite assets: '+other.join(', '));
// All imports were collapsed by inlineDynamicImports, including lazy battle
// code. Any external Google-font stylesheet has optional local font fallback.
const output=resolve(root,'release','FallOfCavalry_V1_66_Guncel_TekDosya.html');
mkdirSync(resolve(root,'release'),{recursive:true});
writeFileSync(output,html,'utf8');
console.log('[single-file] SUCCESS: '+basename(output));
console.log('[single-file] JS: '+scriptCount+' CSS: '+styleCount+
  ' HTML size: '+(Buffer.byteLength(html)/1048576).toFixed(2)+' MiB');
