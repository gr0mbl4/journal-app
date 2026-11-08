// Прокликать журнал: вкладки, все кнопки на экранах и в шторках, «назад». Собрать ошибки.
const { chromium } = require('playwright');
const { makeStore, install } = require('./mock');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const DATA = process.env.DATA || '';
const OWNER = process.env.OWNER || 'gr0mbl4';
const SKIP = /^(demo-toggle|settings-out|logout|reset|del|.*-del|.*delete.*|rm|.*-rm|trash|rec-start|mic|cam|file|photo|pick-photo|send|chat-send|pult-open|copy|tts.*|book-play|play)$/i;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', hasTouch: true });
  const store = makeStore(DATA);
  const writes = await install(ctx, store, { owner: OWNER });
  await ctx.addInitScript(([o]) => {
    localStorage.setItem('bj-cred', JSON.stringify({ token: 't', owner: o, repo: 'journal-data' }));
    window.open = () => null;
    window.alert = () => {}; window.confirm = () => true; window.prompt = () => null;
  }, [OWNER]);
  const pg = await ctx.newPage();
  const errs = [];
  let ctxName = 'load';
  pg.on('pageerror', e => errs.push(`[${ctxName}] pageerror: ${e.message}`));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errs.push(`[${ctxName}] console: ${m.text().slice(0, 200)}`); });
  await pg.goto(BASE);
  await pg.waitForTimeout(2500);
  const state = async () => pg.evaluate(() => ({ sheet: !document.querySelector('#sheet').hidden, title: (document.querySelector('#sheet-body .sh-title') || {}).textContent || '', tab: (document.querySelector('[data-tab].on, [data-tab].active, [data-tab][aria-current]') || {}).dataset ? (document.querySelector('[data-tab].on, [data-tab].active, [data-tab][aria-current]') || {}).dataset.tab : '' }));
  const report = [];
  const closeAll = async () => {
    for (let i = 0; i < 10; i++) {
      const open = await pg.evaluate(() => !document.querySelector('#sheet').hidden);
      if (!open) return;
      const xa = pg.locator('#sheet .sheet-xall:visible'), x = pg.locator('#sheet .sheet-x:visible');
      try { if (await xa.count()) await xa.first().click({ timeout: 1000 }); else if (await x.count()) await x.first().click({ timeout: 1000 }); else await pg.keyboard.press('Escape'); } catch (_) {}
      await pg.waitForTimeout(150);
    }
    errs.push(`[${ctxName}] шторка не закрывается крестиком`);
    await pg.evaluate(() => { document.querySelector('#sheet').hidden = true; document.body.classList.remove('locked'); });
  };
  // кнопки в видимой области (не в шторке / в шторке)
  const actions = async sel => pg.evaluate(sel => Array.from(document.querySelectorAll(sel + ' [data-action]')).filter(e => e.offsetParent !== null && !e.disabled).map((e, i) => ({ a: e.dataset.action, key: e.dataset.action + '|' + (e.dataset.id || e.dataset.tab || e.dataset.type || e.dataset.k || '') + '|' + (e.textContent || '').trim().slice(0, 30) })), sel);
  const tabs = ['plan', 'lessons', 'sport', 'food', 'money'];
  const seen = new Set();
  for (const t of tabs) {
    ctxName = 'tab:' + t;
    await closeAll();
    const tb = pg.locator(`#tabs [data-tab="${t}"]`).first();
    if (await tb.count()) { await tb.click(); await pg.waitForTimeout(400); }
    const vis = await pg.evaluate(t => { const el = document.querySelector('#tab-' + t); return el ? !el.hidden : null; }, t);
    if (vis === false) errs.push(`[tab:${t}] вкладка не открылась`);
    const list = await actions('#app');
    for (const it of list.slice(0, 80)) {
      if (SKIP.test(it.a) || seen.has(it.key)) continue;
      seen.add(it.key);
      ctxName = `${t} → ${it.key}`;
      await closeAll();
      const tb2 = pg.locator(`#tabs [data-tab="${t}"]`).first(); if (await tb2.count()) { await tb2.click(); await pg.waitForTimeout(150); }
      const el = pg.locator(`#app [data-action="${it.a}"]`).filter({ hasText: it.key.split('|')[2] || undefined }).first();
      if (!(await el.count())) continue;
      try { await el.click({ timeout: 1500 }); } catch (e) { continue; }
      await pg.waitForTimeout(300);
      const s = await state();
      report.push(`${t}: ${it.key} → ${s.sheet ? 'шторка «' + s.title.trim() + '»' : 'без шторки'}`);
      if (s.sheet) {
        // внутри шторки — один уровень кнопок, затем «назад»
        const inner = (await actions('#sheet')).filter(x => !SKIP.test(x.a) && !/^(close|back|sheet-x|sheet-xall)$/.test(x.a)).slice(0, 12);
        for (const x of inner) {
          if (seen.has('in:' + x.key)) continue; seen.add('in:' + x.key);
          ctxName = `${t} → ${it.key} → ${x.key}`;
          const before = await state();
          const e2 = pg.locator(`#sheet [data-action="${x.a}"]`).filter({ hasText: x.key.split('|')[2] || undefined }).first();
          if (!(await e2.count())) continue;
          try { await e2.click({ timeout: 1000 }); } catch (_) { continue; }
          await pg.waitForTimeout(250);
          const after = await state();
          if (after.sheet && before.sheet && after.title !== before.title) {
            // ушли глубже — «назад» должен вернуть
            const bx = pg.locator('#sheet .sheet-x'); if (await bx.count()) { await bx.click(); await pg.waitForTimeout(250); }
            const back = await state();
            if (back.title !== before.title) errs.push(`[${ctxName}] «←» вернул на «${back.title}» вместо «${before.title}»`);
          }
          if (!after.sheet) { // кнопка закрыла шторку — открыть заново
            try { await closeAll(); const tb3 = pg.locator(`#tabs [data-tab="${t}"]`).first(); if (await tb3.count()) await tb3.click(); await el.click({ timeout: 1000 }); await pg.waitForTimeout(200); } catch (_) { break; }
          }
        }
      }
    }
  }
  // меню и FAB
  ctxName = 'menu'; await closeAll();
  const mb = pg.locator('[data-action="menu"]').first();
  if (await mb.count()) {
    await mb.click(); await pg.waitForTimeout(400);
    const items = (await actions('#sheet .menu-grid')).filter(x => !SKIP.test(x.a));
    for (const it of items) {
      ctxName = 'menu → ' + it.key;
      await closeAll(); await pg.locator('[data-action="menu"]').first().click(); await pg.waitForTimeout(200);
      const el = pg.locator(`#sheet .menu-grid [data-action="${it.a}"]`).filter({ hasText: it.key.split('|')[2] || undefined }).first();
      try { await el.click({ timeout: 1500 }); } catch (_) { continue; }
      await pg.waitForTimeout(500);
      const s = await state();
      report.push(`menu: ${it.key} → ${s.sheet ? '«' + s.title.trim() + '»' : 'закрыто'}`);
      if (s.sheet && !/Меню/.test(s.title)) {
        const bx = pg.locator('#sheet .sheet-x'); if (await bx.count()) { await bx.click(); await pg.waitForTimeout(300); }
        const back = await state();
        if (!/Меню/.test(back.title)) errs.push(`[${ctxName}] «←» из «${s.title.trim()}» не вернул в Меню (сейчас: ${back.sheet ? back.title : 'закрыто'})`);
      }
    }
  }
  await closeAll();
  console.log(report.join('\n'));
  console.log('\nЗАПИСИ:', writes.length, writes.slice(0, 10).map(w => w.path + ' ' + (w.msg || '')).join('; '));
  console.log('\nОШИБКИ (' + errs.length + '):\n' + Array.from(new Set(errs)).join('\n'));
  await b.close();
})();
