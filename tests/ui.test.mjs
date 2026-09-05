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
  await page.evaluate(s=>{ localStorage.clear(); if(s) localStorage.setItem('ikusei-prototype-save-v8',JSON.stringify(s)); },s);
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
      if(e.closest('.jobgrid,.joblist')) continue;
      if(r.top<-1||r.left<-1||r.bottom>innerHeight+1||r.right>innerWidth+1) result.push('button out: '+e.textContent.trim());
    }
    const sheet=document.querySelector('.support-sheet');
    if(sheet) {
      const r=sheet.getBoundingClientRect();
      for(const e of sheet.querySelectorAll('p,dd,button')) {
        const b=e.getBoundingClientRect(); if(b.width&&b.height&&b.bottom>r.bottom+1) result.push('sheet overflow: '+e.textContent.trim());
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
  await page.getByRole('button',{name:'仕事を受ける'}).click(); await check(page,'jobs',size);
  await page.getByRole('button',{name:'支援と約束',exact:true}).click(); await check(page,'support-offer',size);
  await page.getByRole('button',{name:'条件に同意して受け取る'}).click(); await check(page,'support-confirm',size);
  await page.getByRole('button',{name:'確定する',exact:true}).click(); await check(page,'support-scene',size);
  await finishScene(page); await check(page,'support-result',size);
  await page.getByRole('button',{name:'続ける',exact:true}).click();
  await page.getByRole('button',{name:/約束帳/}).click(); await check(page,'support-active',size);
  // Real reload must retain a single obligation and cannot pay the advance again.
  await page.reload();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ikusei-prototype-save-v8')));
  assert.equal(saved.money,280); assert.equal(saved.obligations.length,1);
  saved.stock.tisane=2; await seed(page,saved);
  await page.locator('.promise-ticker').click(); await page.getByRole('button',{name:/約束帳/}).click();
  await page.getByRole('button',{name:'この方法で納品',exact:true}).click(); await page.getByRole('button',{name:'確定する',exact:true}).click();
  await finishScene(page); await check(page,'fulfillment-result',size);
  await page.getByRole('button',{name:'続ける',exact:true}).click();
  const fulfilled=await page.evaluate(()=>JSON.parse(localStorage.getItem('ikusei-prototype-save-v8')));
  assert.equal(fulfilled.obligations[0].status,'fulfilled'); assert.equal(fulfilled.money,460);
  await page.getByRole('button',{name:'次の書類'}).click(); await page.getByRole('button',{name:'次の書類'}).click();
  await check(page,'support-unlocked',size);
  let flex=structuredClone(fulfilled); flex=performAction(flex,{type:'accept',offer:'flexible-reservation'}).state;
  flex.stock.sleeper=1; await seed(page,flex); await page.locator('.promise-ticker').click(); await page.getByRole('button',{name:/約束帳/}).click();
  await check(page,'support-choices',size);
  await seed(page,initialState); await page.getByRole('button',{name:'仕事を受ける'}).click();
  await page.locator('button.jobcard2').filter({hasText:'学院の読書会に招かれる'}).click(); await check(page,'contract',size);
  await page.getByRole('button',{name:'この依頼を受ける'}).click(); await check(page,'scene',size);
  await finishScene(page); await check(page,'result',size);
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
