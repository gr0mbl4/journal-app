// Сохранение на вложенном экране → возврат на предыдущий, а не закрытие всей шторки.
const { chromium } = require('playwright');
const { makeStore, install } = require('./mock');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const store = makeStore(process.env.DATA); await install(ctx, store, {});
  await ctx.addInitScript(() => { localStorage.setItem('bj-cred', JSON.stringify({ token: 't', owner: 'gr0mbl4', repo: 'journal-data' })); });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/'); await pg.waitForTimeout(3000);
  const title = () => pg.evaluate(() => !document.getElementById('sheet') ? '(нет страницы: ' + location.href + ')' : document.getElementById('sheet').hidden ? '(закрыто)' : ((document.querySelector('#sheet-body .sh-title') || {}).textContent || '').trim());
  const res = [];
  await pg.locator('[data-action="menu"]').first().click(); await pg.waitForTimeout(300);
  await pg.locator('#sheet .menu-grid [data-action="dates"]').click(); await pg.waitForTimeout(400);
  const sv = pg.locator('#sheet [data-action="dates-save"]'); 
  if (await sv.count()) { await sv.click(); await pg.waitForTimeout(1500); res.push(`Меню → Важные даты → Сохранить → «${await title()}» (ждём «Меню»)`); }
  await pg.goBack(); await pg.waitForTimeout(300); res.push(`«Назад» → ${await title()}`);
  await pg.goBack(); await pg.waitForTimeout(300); res.push(`ещё «Назад» → ${await title()}, адрес ${pg.url()}`);
  console.log(res.join('\n') + '\nошибки JS: ' + (errs.join(' | ') || 'нет'));
  await b.close();
})();
