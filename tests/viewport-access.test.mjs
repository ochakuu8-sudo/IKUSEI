import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.goto((process.env.IKUSEI_TEST_URL ?? 'http://127.0.0.1:5186/IKUSEI/') + 'tests/fixtures/presentation.html?view=choice');
  await page.getByRole('button',{name:'続きから',exact:true}).click();
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('ikusei-prototype-save-v16')));
  const before = await save();
  for (const viewport of [{width:800,height:304},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.locator('.screen-guide').count(), 0);
    assert.deepEqual(await save(), before);
  }
  await page.locator('[data-choice="normal"]').click();
  await page.waitForSelector('.scenario-stage');
  assert.equal((await save()).activeSession.choices.length, before.activeSession.choices.length + 1);
  console.log('PASS: portrait play, small landscape without overlay, resize preserves save.');
} finally { await browser.close(); }
