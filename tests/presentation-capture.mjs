// Direct fixtures: visual review only, without replaying the game for every image.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.IKUSEI_TEST_URL ?? 'http://127.0.0.1:5186/IKUSEI/';
const out = process.env.IKUSEI_CAPTURE_DIR ?? '../presentation-captures';
mkdirSync(out, { recursive:true });
const browser = await chromium.launch();
const errors = [];
try {
  for (const view of (process.env.IKUSEI_VIEWS ?? 'title,desk,letter,growth,dignity,choice,result,archive,gallery,portrait').split(',')) {
    const page = await browser.newPage({viewport:view === 'portrait' ? {width:390,height:844} : {width:Number(process.env.IKUSEI_WIDTH ?? 1200),height:Number(process.env.IKUSEI_HEIGHT ?? 500)}, reducedMotion:'reduce'});
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + 'tests/fixtures/presentation.html?view=' + view);
    if (!['title','portrait'].includes(view)) await page.getByRole('button',{name:'続きから',exact:true}).click();
    if (view === 'letter') await page.locator('[data-job="debug-training"] button').click();
    if (view === 'growth') await page.getByRole('button',{name:'交渉の成長について',exact:true}).click();
    if (view === 'settings') await page.getByRole('button',{name:'設定',exact:true}).click();
    if (view === 'dignity') await page.getByRole('button',{name:'貞操のランクと回復について'}).click();
    if (['gallery','archive'].includes(view)) await page.getByRole('button',{name:'回想',exact:true}).click();
    if (view === 'archive') await page.getByRole('button',{name:'選択の回想',exact:true}).click();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(i => i.complete));
    await page.screenshot({path:`${out}/${view}.png`, animations:'disabled'});
    console.log(view);
    await page.close();
  }
  if (errors.length) throw new Error([...new Set(errors)].join('\n'));
} finally { await browser.close(); }
