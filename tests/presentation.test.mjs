// Only the navigation changed by this UI pass. No repeated full-game button tour.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.IKUSEI_TEST_URL ?? 'http://127.0.0.1:5186/IKUSEI/';
const browser = await chromium.launch();
const page = await browser.newPage({viewport:{width:844,height:390}});
const key = 'ikusei-prototype-save-v16';
const saved = () => page.evaluate(k => localStorage.getItem(k), key);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(base + 'tests/fixtures/presentation.html?view=archive');
  await page.getByRole('button',{name:'続きから',exact:true}).click();
  const before = await saved();
  const rank = page.getByRole('button',{name:'貞操のランクと回復について'});
  const target = await rank.boundingBox();
  assert(target.height >= 44);
  await rank.click();
  const dignity = page.getByRole('dialog',{name:'三つの尊厳'});
  await page.evaluate(() => document.fonts.ready);
  assert((await dignity.innerText()).includes('81〜100'));
  assert(await dignity.locator('.dialog-body').evaluate(e => e.scrollHeight <= e.clientHeight + 1));
  await dignity.getByRole('button',{name:'閉じる',exact:true}).click();
  await page.getByRole('button',{name:'回想',exact:true}).click();
  await page.getByRole('button',{name:'次のページ'}).click();
  assert.equal((await page.locator('.r-pagination > span').innerText()).trim(),'2 / 15');
  await page.getByRole('button',{name:'選択の回想',exact:true}).click();
  await page.locator('.adv-archive-list button').click();
  // The one recorded route contains multiple scene IDs; finish each of its scenes.
  for (let scene = 0; scene < 4 && await page.locator('.scenario-stage').count(); scene++) {
    await page.waitForSelector('.scenario-stage[data-ready=true]');
    await page.getByRole('button',{name:'シナリオメニュー',exact:true}).click();
    await page.getByRole('button',{name:'この場面をとばす',exact:true}).click();
  }
  await page.getByRole('dialog',{name:'選択の回想',exact:true}).waitFor();
  await page.getByRole('dialog',{name:'選択の回想',exact:true}).getByRole('button',{name:'閉じる'}).click();
  assert.equal((await page.locator('.r-pagination > span').innerText()).trim(),'2 / 15');
  assert.equal(await saved(), before, 'detail and replay leave the main save untouched');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('.screen-guide').count(), 0);
  assert.equal(await saved(), before);
  await page.setViewportSize({width:844,height:390});
  assert.equal(await page.locator('.screen-guide').count(), 0);
  assert.equal(await saved(), before);
  assert.deepEqual(errors, []);
  console.log('PASS: dignity detail; archive replay and page restoration; orientation preserves save; 44px rank target.');
} finally { await browser.close(); }
