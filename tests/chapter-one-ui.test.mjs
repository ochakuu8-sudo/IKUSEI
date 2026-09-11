import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const base=process.env.IKUSEI_TEST_URL??"http://127.0.0.1:5174/";
const capture=process.env.IKUSEI_CAPTURE_DIR??"../chapter-ui-captures";
mkdirSync(capture,{recursive:true});
const browser=await chromium.launch(),errors=[],measurements=[];
const context=await browser.newContext({viewport:{width:1280,height:720}});
const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
const key="ikusei-prototype-save-v16";
const button=(name,p=page)=>p.getByRole("button",{name,exact:true});
const saved=(p=page)=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
await context.addInitScript(()=>localStorage.setItem("ikusei-prototype-ui-v14",JSON.stringify({speed:0,motion:false,volume:0,textSize:28})));
async function skipText(p=page){
  await p.locator(".scenario-stage[data-ready=true]").waitFor();
  await button("シナリオメニュー",p).click();await button("この場面をとばす",p).click();
}
async function readToResult(p=page){
  for(let i=0;i<12;i++){
    await p.waitForFunction(key=>{const a=JSON.parse(localStorage.getItem(key))?.activeSession;return a&&(a.phase==='result'||a.scenario.nodes[a.nodeId].kind==='text');},key);
    const s=await saved(p),a=s?.activeSession;
    if(a?.phase==="result")return;
    assert(a,"active scenario expected");assert.equal(a.scenario.nodes[a.nodeId].kind,"text");
    await skipText(p);
    await p.waitForFunction(({key,id})=>{const a=JSON.parse(localStorage.getItem(key)).activeSession;return a.nodeId!==id||a.phase==="result";},{key,id:a.nodeId});
  }
  throw Error("story did not finish");
}
async function captureSizes(name,selector){
  for(const size of [{width:1280,height:720},{width:844,height:390}]){
    await page.setViewportSize(size);await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fit'))-Math.min(innerWidth/1200,innerHeight/500))<0.001);
    await page.locator(selector).waitFor();
    const dims=await page.locator(selector).evaluate(e=>{
      const box=e.getBoundingClientRect(),scale=box.width/e.offsetWidth;
      return {width:e.clientWidth,height:e.clientHeight,scroll:e.scrollWidth,box:{x:box.x,y:box.y,width:box.width,height:box.height},buttons:[...e.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {text:b.textContent,width:r.width,height:r.height,font:parseFloat(getComputedStyle(b).fontSize)*scale};})};
    });
    assert.equal(dims.width,1200);assert.equal(dims.height,500);
    // Title artwork deliberately extends beyond the clipped canvas; controls must stay inside it.
    if(name!=="title")assert.equal(dims.scroll,1200);
    assert(dims.box.x>=-1&&dims.box.y>=-1&&dims.box.x+dims.box.width<=size.width+1&&dims.box.y+dims.box.height<=size.height+1);
    if(name==="completion")for(const b of dims.buttons){assert(b.height>=44,b.text);assert(b.font>=16,b.text);}
    measurements.push({name,...size,...dims});await page.screenshot({path:`${capture}/${name}-${size.width}.png`});
  }
  await page.setViewportSize({width:1280,height:720});
  await page.waitForFunction(()=>Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fit'))-Math.min(innerWidth/1200,innerHeight/500))<0.001);
}
try{
  await page.goto(base);await captureSizes("title",".r-game");
  await button("はじめから").click();await page.locator(".scenario-stage").waitFor();
  assert.equal((await saved()).day,1);await readToResult();await button("依頼の手紙へ").click();
  await page.waitForFunction(key=>!JSON.parse(localStorage.getItem(key)).activeSession,key);
  await page.locator('[data-job="ch1-ledger"]').waitFor();
  assert.equal(await page.locator('[data-job^="debug-"]').count(),0);
  assert.equal(await page.locator('[data-growth]').count(),4);assert.equal(await page.locator('[data-axis]').count(),3);
  await captureSizes("desk",".r-game");
  await page.locator('[data-job="ch1-ledger"] button').click();
  assert((await page.locator('.a-letter-growth').innerText()).includes("交渉・胆力"));
  await button("この依頼を受ける").click();await skipText();
  await page.locator('[data-choice="negotiation"]').waitFor();await captureSizes("choices",".adv-stage");
  const atChoice=await saved();await page.reload();await button("続きから").click();
  await page.locator('[data-choice="negotiation"]').click();await readToResult();
  const earned=await saved();assert.equal(earned.growthXP.negotiation,1);assert.equal(earned.day,2);
  assert.equal(earned.money,atChoice.money+95);await page.reload();await button("続きから").click();
  await button("翌日へ").click();assert.equal((await saved()).money,earned.money);
  // Seed only the start of the last day. Actions, repayment and ending run through the UI.
  await page.evaluate(async key=>{
    const {freshDaily}=await import('/src/daily.ts');const s=freshDaily("last-day-ui");
    s.day=14;s.stamina=10;s.money=1290;s.storyFlags={"ch1.intro.done":true,"ch1.promise.done":true,"ch1.promise.vernet":true};
    localStorage.setItem(key,JSON.stringify(s));
  },key);
  await page.reload();await button("続きから").click();
  await button("今日は受けない").click();await button("今日は休む").click();await button("返済へ").click();
  await button("この内容で納める").click();await button("結末へ").click();
  await page.locator(".scenario-stage").waitFor();await readToResult();await button("体験版の記録へ").click();
  await page.locator('.demo-completion').waitFor();await page.waitForFunction(key=>!JSON.parse(localStorage.getItem(key)).activeSession,key);const complete=await saved();
  assert.equal(complete.chapter,2);assert.equal(complete.ended,false);assert.equal(complete.money,240);assert.equal(complete.debt,10800);
  assert.equal(complete.chapterResults.length,1);assert.equal(await page.locator('[data-job]').count(),0);
  await captureSizes("completion",".demo-completion");
  const [download]=await Promise.all([page.waitForEvent('download'),button('記録を書き出す').click()]);
  const file=`${capture}/export-test.json`;await download.saveAs(file);
  await page.reload();await button("続きから").click();await page.locator('.demo-completion').waitFor();
  assert.deepEqual(await saved(),complete);
  await button('回想').click();const beforeReplay=await saved();
  await page.locator('.adv-archive-list button').last().click();await skipText();
  await page.getByRole('dialog',{name:'選択の回想',exact:true}).waitFor();assert.deepEqual(await saved(),beforeReplay);
  const second=await browser.newContext({viewport:{width:1280,height:720}}),imported=await second.newPage();
  imported.on('pageerror',e=>errors.push(e.message));await imported.goto(base);
  await button('設定',imported).click();await button('データ',imported).click();
  await imported.locator('input[type=file]').setInputFiles(file);await button('この記録を読み込む',imported).click();
  await button('続きから',imported).click();await imported.locator('.demo-completion').waitFor();
  assert.deepEqual(await saved(imported),complete);
  await button('設定',imported).click();await button('データ',imported).click();
  await imported.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
  await imported.getByRole('dialog',{name:'お知らせ',exact:true}).waitFor();assert.deepEqual(await saved(imported),complete);
  await second.close();
  assert.deepEqual(errors,[]);writeFileSync(`${capture}/measurements.json`,JSON.stringify(measurements,null,2));
  console.log('PASS chapter-one UI: intro, new catalog, maximum text, mid-choice reload, final-day settlement, saved ending, replay, export/import, invalid import, 1200x500');
}catch(e){await page.screenshot({path:`${capture}/failure.png`});console.error((await page.locator('body').innerText()).slice(-2200),errors);throw e;}
finally{await browser.close();}
