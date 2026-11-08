// Юра в первый раз: пустой репозиторий (только README) — журнал открывается, сообщение в чат уходит.
const { chromium } = require('playwright');
const { makeStore, install } = require('./mock');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const store = {}; const writes = await install(ctx, store, { owner: 'yura-test' });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' ')));
  await pg.goto('http://127.0.0.1:8765/'); await pg.waitForTimeout(1500);
  await pg.fill('#su-token', 'tok'); await pg.fill('#su-repo', 'journal-data'); await pg.click('#su-btn');
  await pg.waitForTimeout(3000);
  const setupHidden = await pg.evaluate(() => document.getElementById('setup').hidden);
  console.log('подключился:', setupHidden, '| ошибка:', await pg.evaluate(() => { const e = document.getElementById('su-err'); return e && !e.hidden ? e.textContent : ''; }));
  for (const t of ['plan', 'lessons', 'sport', 'food', 'money']) { await pg.locator(`#tabs [data-tab="${t}"]`).first().click(); await pg.waitForTimeout(300); }
  await pg.locator('#claude-fab').click(); await pg.waitForTimeout(600);
  const ta = pg.locator('#msg-text').first();
  await ta.fill('Привет'); 
  const send = pg.locator('#sheet [data-action="msg-send"]').first();
  console.log('кнопка отправки:', await send.count(), await send.getAttribute('data-action').catch(() => ''));
  if (await send.count()) await send.click(); else await ta.press('Enter');
  await pg.waitForTimeout(3000);
  console.log('записи:', writes.map(w => w.path + ' — ' + w.msg).join(' | ') || (store.__tree ? 'дерево: ' + store.__tree.map(x => x.path).join(',') : 'нет'));
  console.log('requests.json:', store['requests.json'] ? store['requests.json'].toString().slice(0, 200) : (store.__blobs ? 'в blobs' : 'нет'));
  console.log('ошибки JS:', errs.join(' | ') || 'нет');
  await b.close();
})();
