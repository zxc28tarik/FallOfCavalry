import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const html=resolve('release/FallOfCavalry_V1_66_Guncel_TekDosya.html');
const url=pathToFileURL(html).href;
const browser=await chromium.launch({channel:'chrome',headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>Boolean(window.game?.initialized),null,{timeout:60000});
  const cards=page.locator('#factionGrid .faction-card');
  await cards.first().waitFor({state:'visible',timeout:30000});
  console.log('[single-file-smoke] menu faction cards:',await cards.count());
  await page.locator('#seedInput').fill('1337');
  await cards.first().click();
  await page.locator('#btnStart').click();
  await page.waitForFunction(()=>Boolean(window.game?.started
    &&(window.game?.worldManager?.state?.mapData||window.game?.state?.mapData)?.terrain?.length),
    null,{timeout:120000});
  console.log('[single-file-smoke] actual world started from file://');
  if(errors.length)throw new Error('Browser runtime errors: '+errors.slice(0,5).join('; '));
}finally{await browser.close();}
