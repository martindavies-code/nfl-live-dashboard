// Deterministic rendered regression checks. No feed calls or repository data updates.
// Optional MATCHUP_SCREENSHOTS points outside the repository for review images.
import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { writeFile, rm, mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'
const root = process.cwd()
const harnessHtml = path.join(root, '.matchup-check.html')
const harnessTsx = path.join(root, '.matchup-check.tsx')
const output = process.env.MATCHUP_SCREENSHOTS
const html = '<html><head></head><body style="margin:0;background:#030712"><div id="root"></div><script type="module" src="/.matchup-check.tsx"></script></body></html>'
const harness = `import React from 'react'; import {createRoot} from 'react-dom/client';
import {HeroMatchup} from './src/components/HeroMatchup';
import {GameCard} from './src/components/GameCard'; import './src/index.css';
const mode = new URLSearchParams(location.search).get('case') || 'pre';
const state = mode.startsWith('post') ? 'post' : mode.startsWith('live') ? 'in' : 'pre';
const known = mode.endsWith('known');
const score = state === 'pre' ? [0,0] : known ? [20,17] : [43,29];
const competitors = ['home','away'].map((homeAway,i)=>({ id:String(i+1), homeAway, score:String(score[i]), winner:state==='post' && i===0,
 team:{id:String(i+1),name:i?'Buccaneers':'Lions',displayName:i?'Tampa Bay Buccaneers':'Detroit Lions',abbreviation:i?'TB':'DET',color:i?'D50A0A':'0076B6',logo:'/missing-fixture-logo.png'},
 records:[{summary:i?'3-6':'7-2'}],linescores:state==='pre'?[]:[{value:7},{value:7},{value:3},{value:score[i]-17}]}));
const status = {period:state==='pre'?0:4,displayClock:state==='post'?'0:00':'0:45',type:{state,completed:state==='post',name:state==='in'?'STATUS_IN_PROGRESS':state==='post'?'STATUS_FINAL':'STATUS_SCHEDULED',detail:state==='in'?'4th 0:45':state==='post'?'Final':'Scheduled'}};
const odds = mode==='baseline'?[]:[{provider:{name:'DraftKings'},details:'DET -6',spread:-6,overUnder:45.5,...(mode==='spread'?{}:{moneyline:{home:{close:{odds:'-258'}},away:{close:{odds:'+212'}}}})}];
const situation = state==='in'?{possession:'1',yardLine:45,down:2,distance:5,downDistanceText:'2nd & 5',lastPlay:{text:'Fixture play',...(mode==='live-fpi'?{probability:{homeWinPercentage:.73,awayWinPercentage:.27}}:{})}}:undefined;
const event = {id:'fixture',name:'Tampa Bay Buccaneers at Detroit Lions',shortName:'TB @ DET',date:'2026-11-22T18:00:00Z',season:{year:2026,type:2},week:{number:11},status,competitions:[{id:'fixture',date:'2026-11-22T18:00:00Z',competitors,status,odds,situation,venue:{fullName:'Ford Field',indoor:true,address:{city:'Detroit'}},broadcasts:[{names:['FOX']}]}]};
createRoot(document.getElementById('root')!).render(<main className="max-w-[1500px] mx-auto p-3 text-white"><div className="mb-3 text-xs">Synthetic fixture: {mode}</div><section id="hero"><HeroMatchup event={event as any}/></section><section id="directory" className="mt-6 max-w-md flex flex-col"><GameCard event={event as any} globalExpandedTab="scorigami"/></section></main>);`
let browser, server
try {
 await writeFile(harnessHtml,html); await writeFile(harnessTsx,harness)
 server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174'],{stdio:'ignore'})
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5174/.matchup-check.html')).ok)break}catch{} await new Promise(r=>setTimeout(r,100))}
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
 if(output) await mkdir(output,{recursive:true})
 let checks=0
 for(const width of [1440,1024,393,360]) for(const mode of ['pre','spread','baseline','live-fpi','live-analytic','live-known','post-unseen','post-known']){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
  // Failed logo loads must not break layout or the fallback content.
  await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('http://127.0.0.1')?r.continue():r.abort())
  await page.setViewport({width,height:1100});await page.goto('http://127.0.0.1:5174/.matchup-check.html?case='+mode,{waitUntil:'domcontentloaded'})
  await page.waitForSelector('#hero button[aria-label="Expand Scorigami details"]')
  const collapsed=await page.$eval('#hero',e=>e.innerText)
  if(!mode.startsWith('post'))assert.ok(collapsed.includes('est.'),'estimate missing in collapsed state')
  await page.focus('#hero button[aria-label="Expand Scorigami details"]');await page.keyboard.press('Enter')
  const text=await page.$eval('main',e=>e.innerText)
  assert.equal(errors.length,0,errors.join('\n'))
  assert.ok(!/Scorigami Achieved|Scorigami in Progress|in NFL History|in NFL history|Novel Score|Milestone:|Never occurred/.test(text),mode+' stale claim')
  assert.ok(text.includes('verified through 24 Sep 2026'))
  assert.ok(!text.includes('#1,098'))
  const a11y=await page.$$eval('[aria-label^="Win probability:"]',es=>es.map(e=>e.getAttribute('aria-label')))
  if(!mode.startsWith('post')){
   const label=mode==='spread'?'DraftKings spread estimate':mode==='baseline'?'No odds yet':mode==='live-fpi'?'ESPN FPI live probability':mode.startsWith('live')?'Live analytic model':'DraftKings moneyline'
   assert.ok(a11y.length===2 && a11y.every(x=>x.includes(label)),mode+': '+a11y)
   assert.ok(text.includes('est.'))
   if(mode==='spread') assert.ok((await page.$$eval('[title]',es=>es.map(e=>e.title))).some(x=>x.includes('normal margin model') && x.includes('does not publish an odds timestamp')))
  }
  if(mode==='post-unseen')assert.ok(text.includes('not confirmed as a first-ever NFL score'))
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+' '+mode+' document overflow')
  const wrap=await page.$$eval('#hero .whitespace-nowrap',es=>es.filter(e=>/est\.|^\d+-\d+$/.test(e.textContent||'')).map(e=>({text:e.textContent,clipped:e.scrollWidth>e.clientWidth+1})))
  assert.ok(wrap.every(x=>!x.clipped),JSON.stringify(wrap))
  if(output && [1440,1024,393].includes(width) && ['pre','live-fpi','live-analytic','post-unseen','post-known','baseline'].includes(mode))await page.screenshot({path:path.join(output,mode+'-'+width+'.png'),fullPage:true})
  console.log('PASS',width,mode);checks++;await page.close()
 }
 console.log(checks+' rendered state/viewport checks passed')
}finally{
 await browser?.close();server?.kill();await rm(harnessHtml,{force:true});await rm(harnessTsx,{force:true})
}
