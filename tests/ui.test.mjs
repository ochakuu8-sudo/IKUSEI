import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { initialState } from '@game/game';
import { performAction } from '@game/engine';
const { chromium } = createRequire(resolve('package.json'))('playwright');
const browser = await chromium.launch();
const out=resolve('../ui-check'); mkdirSync(out,{recursive:true});
const failures=[], errors=[];
const url=process.env.IKUSEI_TEST_URL??'http://127.0.0.1:5173/IKUSEI/';
async function seed(page,s) {
  await page.evaluate(s=>{ localStorage.clear(); if(s) localStorage.setItem('ikusei-prototype-save-v9',JSON.stringify(s)); },s);
  await page.reload(); await page.locator('.screen').waitFor();
}
async function check(page,name,size,buttons=true) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))));
  const issues=await page.evaluate(({buttons})=>{
    const result=[];
    if(document.documentElement.scrollWidth>innerWidth+1 || document.documentElement.scrollHeight>innerHeight+1) result.push('page overflow');
    const selector=document.querySelector('[role="dialog"]')?'[role="dialog"] button': 'button';
    if(buttons) for(const e of document.querySelectorAll(selector)) {
      const r=e.getBoundingClientRect(); if(!r.width||!r.height||getComputedStyle(e).visibility==='hidden') continue;
      // Existing scrolling job lists intentionally page within a bounded list.
      if(e.closest('.jobgrid,.joblist,.medicine-scroll,.support-sheet')) continue;
      if(r.top<-1||r.left<-1||r.bottom>innerHeight+1||r.right>innerWidth+1) result.push('button out: '+e.textContent.trim());
    }
    const sheet=document.querySelector('.support-sheet');
    if(sheet) {
      const r=sheet.getBoundingClientRect();
      for(const e of sheet.querySelectorAll('p,dd,button')) {
        const b=e.getBoundingClientRect(); if(b.width&&b.height&&(b.left<r.left-1 || b.right>r.right+1)) result.push('sheet overflow: '+e.textContent.trim());
      }
    }
    return result;
  },{buttons});
  if(issues.length) failures.push({size,name,issues});
  await page.screenshot({path:resolve(out,`${size}-${name}.png`)});
}
async function finishScene(page) {
  for(let i=0;i<15 && await page.locator('.scene').count();i++) await page.getByRole('button',{name:'タップして次へ'}).click();
}
try {
for(const [width,height] of [[667,375],[800,360],[844,390],[932,430],[390,844],[1440,900]]) {
  const size=`${width}x${height}`,page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url); await seed(page,null);
  await check(page,'title',size);
  await page.getByRole('button',{name:'第1章をはじめから'}).click(); await check(page,'home',size);
  assert.ok(await page.locator('.home .figure').isVisible());

  await page.getByRole('button',{name:'薬の依頼書'}).click(); await check(page,'ordinary',size);
  assert.equal(await page.getByText('学院の文書を筆写する',{exact:true}).count(),0);
  await page.locator('.medicine-card').filter({hasText:'学院へ薬湯を届ける'}).click();
  assert.ok(await page.getByRole('button',{name:'出発内容を確認'}).isDisabled());
  await page.getByRole('button',{name:'戻る',exact:true}).click();
  let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ikusei-prototype-save-v9')));
  assert.equal(saved.day,1); assert.equal(saved.obligations.length,0);
  saved.day=2; await seed(page,saved);
  await page.getByRole('button',{name:'薬の依頼書'}).click(); await page.getByRole('button',{name:'特別依頼',exact:true}).click(); await check(page,'special-list',size);
  await page.locator('.medicine-card').filter({hasText:'特別依頼A：紹介の薬湯'}).click(); await check(page,'special-offer',size);
  await page.getByRole('button',{name:'条件に同意して受け取る'}).click(); await check(page,'special-confirm',size);
  await page.getByRole('button',{name:'確定する',exact:true}).click(); await finishScene(page); await check(page,'accept-result',size);
  await page.getByRole('button',{name:'続ける',exact:true}).click(); await check(page,'journal',size);
  await page.reload(); saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ikusei-prototype-save-v9')));
  assert.equal(saved.money,280); assert.equal(saved.day,2); assert.equal(saved.obligations.length,1);
  saved.stock.tisane=4; await seed(page,saved); await page.locator('.promise-ticker').click();
  assert.ok(await page.getByRole('button',{name:'この方法で納品',exact:true}).isDisabled());
  await check(page,'prepared-early',size);
  saved.day=8; await seed(page,saved);
  await page.getByRole('button',{name:'薬の依頼書'}).click();
  await page.locator('.medicine-card').filter({hasText:'学院へ薬湯を届ける'}).click();
  await page.getByRole('button',{name:/まとめ納品/}).click();
  await page.locator('button.medicine-card').filter({hasText:'特別依頼A：紹介の薬湯'}).click(); await check(page,'mixed-batch',size);
  await page.getByRole('button',{name:'出発内容を確認'}).click(); await check(page,'batch-confirm',size);
  await page.getByRole('button',{name:'1日使って納品する'}).click(); await check(page,'batch-result',size);
  await page.getByRole('button',{name:'続ける',exact:true}).click(); await page.reload();
  saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ikusei-prototype-save-v9')));
  assert.equal(saved.money,810); assert.equal(saved.day,9); assert.equal(saved.stock.tisane,0); assert.equal(saved.obligations[0].status,'fulfilled');
  await page.getByRole('button',{name:'出かける'}).click(); await check(page,'map-new-person',size);
  await page.locator('button.marker').filter({hasText:'学院'}).click(); await check(page,'people',size);
  assert.ok(await page.getByText('紹介された薬師',{exact:false}).count());
  await page.locator('.personal-request').filter({hasText:'筆'}).getByRole('button',{name:'頼まれごとを確認'}).click(); await check(page,'personal-contract',size);
  await page.getByRole('button',{name:'この依頼を受ける'}).click(); await finishScene(page); await check(page,'personal-result',size);
  let b=structuredClone(initialState); b.day=9; b=performAction(b,{type:'accept',offer:'special-b'}).state;
  b.chapter=2; b.day=1; b.stock.tisane=2; b=performAction(b,{type:'deliver',ordinary:[],promises:[{id:'special:special-b',option:'standard'}]}).state;
  await seed(page,b); await check(page,'special-event',size);
  await page.getByRole('button',{name:'特別イベントを進める'}).click(); await page.reload();
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('ikusei-prototype-save-v9')))).eventQueue.length,1);
  for(let i=0;i<3;i++) await page.getByRole('button',{name:'特別イベントを進める'}).click();
  const read=await page.evaluate(()=>JSON.parse(localStorage.getItem('ikusei-prototype-save-v9')));
  assert.equal(read.playedEvents.length,1); assert.equal(read.day,2); assert.equal(read.eventQueue.length,0);
  await page.getByRole('button',{name:'出かける'}).click(); await check(page,'map-new-place',size);
  await page.locator('button.marker').filter({hasText:'薬草園'}).click(); await check(page,'new-gather',size);
  await page.getByRole('button',{name:'摘んで帰る'}).click(); await check(page,'gather-result',size);
  await seed(page,initialState); await page.getByRole('button',{name:'出かける'}).click();
  assert.equal(await page.locator('button.marker').filter({hasText:'薬草園'}).count(),0);
  await page.locator('button.marker').filter({hasText:'商会'}).click();
  await page.getByRole('button',{name:'掛け仕入れを相談'}).click(); await check(page,'credit',size);
  const closing=performAction(structuredClone(initialState),{type:'accept',offer:'supply-credit'}).state;
  closing.day=14; closing.awaitingSettlement=true; closing.money=1100;
  await seed(page,closing); await check(page,'settlement',size);
  await page.getByRole('button',{name:/返済前に約束の支払い/}).click(); await check(page,'allocation',size);
  await page.getByRole('button',{name:'138Gを支払う'}).click(); await page.getByRole('button',{name:'確定する',exact:true}).click();
  await page.getByRole('button',{name:'続ける',exact:true}).click(); await check(page,'settlement-short',size);
  const ended=structuredClone(initialState); ended.chapter=6; ended.day=14; ended.ended=true;
  await seed(page,ended); await check(page,'ending',size);
  await page.close(); console.log('Checked',size);
}
} finally { await browser.close(); }
console.log(JSON.stringify({failures,errors},null,2));
assert.equal(errors.length,0,'browser exceptions');
assert.equal(failures.length,0,'layout violations');
console.log('UI flows and six viewport sizes passed');
