// One changed journey, without repeating the full-game button tour.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=process.env.IKUSEI_TEST_URL??'http://127.0.0.1:5186/IKUSEI/';
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:720}});
const key='ikusei-prototype-save-v16',errors=[];
page.on('pageerror',e=>errors.push(e.message));
const saved=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const ready=()=>page.waitForSelector('.scenario-stage[data-ready=true]');
async function skip(){await ready();await page.getByRole('button',{name:'シナリオメニュー',exact:true}).click();await page.getByRole('button',{name:'この場面をとばす',exact:true}).click();}
try{
  await page.goto(base+'tests/fixtures/presentation.html?view=desk');
  await page.getByRole('button',{name:'続きから',exact:true}).click();
  const initial=await saved();
  assert.equal(await page.locator('.a-axis').count(),3);assert.equal(await page.locator('.a-growth-item').count(),4);
  const envelope=page.locator('[data-job="debug-challenge"] .a-envelope');
  await envelope.click();await page.waitForFunction(()=>!document.querySelector('[data-paper-motion]'));
  assert.equal(await page.locator('.a-open-letter .a-condition').count(),0);
  await page.getByRole('button',{name:'手紙一覧へ',exact:true}).click();await page.waitForSelector('.a-open-letter',{state:'hidden'});
  assert(await envelope.evaluate(e=>e===document.activeElement));assert.deepEqual(await saved(),initial);
  await envelope.click();await page.waitForFunction(()=>!document.querySelector('[data-paper-motion]'));
  await page.getByRole('button',{name:'この依頼を受ける',exact:true}).click();await ready();
  assert.equal((await saved()).day,initial.day);assert.equal((await saved()).money,initial.money);
  const background=await page.locator('.scenario-background').getAttribute('src');
  await skip();await page.waitForSelector('[data-choice="negotiation"]');
  assert.equal(await page.locator('.adv-stage .a-hud,.adv-stage .a-status-ribbon,.adv-stage .adv-context').count(),0);
  assert.equal(await page.locator('.adv-background').getAttribute('src'),background);
  assert.equal(await page.locator('[data-choice="negotiation"]').getAttribute('aria-disabled'),'true');
  await page.locator('[data-choice="negotiation"]').click({force:true});assert.equal((await saved()).activeSession.choices.length,0);
  assert((await page.locator('.a-choice-explanation').innerText()).includes('現在 0'));
  const beforeChoice=await saved();await page.locator('[data-choice="knowledge"]').click();await ready();
  assert.equal((await saved()).activeSession.choices.length,1);assert.equal(await page.locator('.scenario-background').getAttribute('src'),background);
  await skip();await page.getByRole('button',{name:'翌日へ',exact:true}).waitFor();
  const result=await saved();assert.equal(result.money,beforeChoice.money+80+30);assert.equal(result.day,initial.day+1);
  await page.goto(base);await page.getByRole('button',{name:'続きから',exact:true}).click();await page.getByRole('button',{name:'翌日へ',exact:true}).waitFor();assert.equal((await saved()).money,result.money);
  await page.getByRole('button',{name:'翌日へ',exact:true}).click();assert.equal((await saved()).activeSession,undefined);
  assert.deepEqual(errors,[]);
  console.log('PASS: envelope open/close and focus, seven values, accept -> narrative -> gated choice -> narrative -> result, reload without duplicate payment.');
}finally{await browser.close()}


