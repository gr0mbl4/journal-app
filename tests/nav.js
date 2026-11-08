// Точечные проверки навигации: вкладки, шторки, «Назад» телефона, свои разделы, метка токенов. DATA — каталог данных.
const { chromium } = require('playwright');
const { makeStore, install } = require('./mock');
const BASE = 'http://127.0.0.1:8765/', DATA = process.env.DATA, OWNER = process.env.OWNER || 'gr0mbl4';
const fails = [], oks = [];
const ok = (c, m) => (c ? oks : fails).push(m);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', hasTouch: true });
  const store = makeStore(DATA); const writes = await install(ctx, store, { owner: OWNER });
  await ctx.addInitScript(([o]) => { localStorage.setItem('bj-cred', JSON.stringify({ token: 't', owner: o, repo: 'journal-data' })); window.open = () => null; }, [OWNER]);
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(BASE); await pg.waitForTimeout(3000);
  const st = () => pg.evaluate(() => ({ sheet: !document.getElementById('sheet').hidden, title: ((document.querySelector('#sheet-body .sh-title') || {}).textContent || '').trim(), tab: document.body.dataset.tab, h: history.length, hs: history.state && history.state.bj }));
  const tab = async t => { await pg.locator(`#tabs [data-tab="${t}"]`).first().click(); await pg.waitForTimeout(300); };
  // 1. вкладки
  for (const t of ['lessons', 'sport', 'food', 'money', 'plan']) { await tab(t); const s = await st(); ok(s.tab === t, `вкладка ${t} открывается (сейчас ${s.tab})`); }
  // 2. «Назад» с вкладки → «План»
  await tab('food'); await pg.goBack(); await pg.waitForTimeout(400);
  let s = await st(); ok(s.tab === 'plan' && pg.url().startsWith(BASE), `«Назад» с «Еды» → «План» (сейчас ${s.tab}, ${pg.url()})`);
  // 3. Меню → пункт → «Назад» телефона → Меню → «Назад» → закрыто, остаёмся в журнале
  await pg.locator('[data-action="menu"]').first().click(); await pg.waitForTimeout(400);
  s = await st(); ok(s.sheet && /Меню/.test(s.title), 'Меню открывается');
  const mi = pg.locator('#sheet .menu-grid [data-action="dates"], #sheet .menu-grid [data-action="shop"]').first();
  if (await mi.count()) {
    await mi.click(); await pg.waitForTimeout(400); const inner = (await st()).title;
    await pg.goBack(); await pg.waitForTimeout(400); s = await st();
    ok(s.sheet && /Меню/.test(s.title), `«Назад» телефона из «${inner}» → Меню (сейчас ${s.sheet ? s.title : 'закрыто'})`);
  }
  await pg.goBack(); await pg.waitForTimeout(400); s = await st();
  ok(!s.sheet && pg.url().startsWith(BASE), `«Назад» из Меню закрывает шторку, журнал не закрывается (${s.sheet ? s.title : 'закрыто'})`);
  // 4. Крестик закрывает, и потом «Назад» не делает лишний холостой шаг
  await pg.locator('[data-action="menu"]').first().click(); await pg.waitForTimeout(300);
  await pg.locator('#sheet .sheet-x').first().click(); await pg.waitForTimeout(500);
  s = await st(); ok(!s.sheet, 'крестик закрывает Меню');
  ok(s.hs !== 'sheet', `после крестика в истории не висит запись шторки (${s.hs})`);
  // 5. чат Claude открывается и закрывается «Назад»
  const fab = pg.locator('#claude-fab'); if (await fab.count()) {
    await fab.click(); await pg.waitForTimeout(500); s = await st(); ok(s.sheet, 'кнопка Claude открывает чат');
    await pg.goBack(); await pg.waitForTimeout(400); s = await st(); ok(!s.sheet, '«Назад» закрывает чат');
  }
  // 6. свои разделы + метка токенов
  const chip = pg.locator('.pg-chip').first();
  if (process.env.PAGES) {
    ok(await chip.count() > 0, 'кнопка своего раздела на «Плане»');
    if (await chip.count()) {
      await chip.click(); await pg.waitForTimeout(300); s = await st(); ok(s.sheet && s.title === 'Вода', `раздел открывается (${s.title})`);
      await pg.locator('#sheet [data-action="pg-count"][data-d="1"]').first().click(); await pg.waitForTimeout(600);
      await pg.locator('#sheet [data-action="pg-check"]').first().click(); await pg.waitForTimeout(600);
      const txt = await pg.locator('#sheet .pg-cnt b').first().textContent();
      ok(/^1/.test(txt.trim()), `счётчик +1 (${txt})`);
      ok(await pg.locator('#sheet .pg-ck.on').count() === 1, 'галочка ставится');
      await pg.waitForTimeout(1500);
      const pj = JSON.parse((store['pages.json'] || '{}').toString());
      const stt = pj.pages && pj.pages[0].state; ok(stt && Object.values(stt)[0] && Object.values(stt)[0].glasses === 1, 'отметка сохранилась в pages.json ' + JSON.stringify(stt));
      await pg.goBack(); await pg.waitForTimeout(300);
    }
  }
  const tk = await pg.locator('#cu-today').first();
  if (await tk.count()) ok(true, 'метка «Claude сегодня»: ' + (await tk.textContent()).replace(/\s+/g, ' ').trim());
  else ok(!process.env.TOKENS, 'метка «Claude сегодня» есть');
  ok(!errs.length, 'ошибок JS нет' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
  console.log('OK:\n  ' + oks.join('\n  ') + '\nПРОВАЛ:\n  ' + (fails.join('\n  ') || '—'));
  await b.close();
})();
