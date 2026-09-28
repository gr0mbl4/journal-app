(function(){
'use strict';

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = u => { try { const x = new URL(String(u || '').trim()); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (_) { return ''; } };
const pad = n => String(n).padStart(2, '0');
const ds = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const pd = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); };
const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ds(d); };
const daysBetween = (a, b) => Math.round((pd(b) - pd(a)) / 86400000);
const dow = s => pd(s).getDay();
const today = () => ds(new Date());
const mondayOf = s => addDays(s, -((dow(s) + 6) % 7));
const DOW_S = ['вс','пн','вт','ср','чт','пт','сб'];
const DOW_F = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const MON_G = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MON_N = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MON_S = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const dm = s => pad(pd(s).getDate()) + '.' + pad(pd(s).getMonth() + 1);
const short = s => DOW_S[dow(s)] + ' ' + dm(s);
const cap1 = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const longDate = s => DOW_F[dow(s)] + ', ' + pd(s).getDate() + ' ' + MON_G[pd(s).getMonth()];
const dayName = s => { const t = today(); if (s === t) return 'Сегодня'; if (s === addDays(t, 1)) return 'Завтра'; if (s === addDays(t, -1)) return 'Вчера'; return cap1(DOW_F[dow(s)]); };
const monthKey = s => s.slice(0, 7);
const monthShift = (mk, n) => { const p = mk.split('-').map(Number); const d = new Date(p[0], p[1] - 1 + n, 1, 12); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const plural = (n, a, b, c) => { n = Math.abs(n); const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b; return c; };
const dur = m => { m = Number(m) || 0; if (m < 60) return m + ' мин'; const h = m / 60; return String(Math.round(h * 100) / 100).replace('.', ',') + ' ч'; };
const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const fmt = n => nf.format(Math.round((Number(n) || 0) * 100) / 100);
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
const clone = o => JSON.parse(JSON.stringify(o));
const hhmm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
const numOrNull = v => { v = String(v == null ? '' : v).replace(',', '.').trim(); if (!v) return null; const n = Number(v); return isFinite(n) ? n : null; };
const HORIZON = 20;
const LET = 'АБВГДЕ';
const DOTS = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/></svg>';
const LS = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  del(k) { try { localStorage.removeItem(k); } catch (_) {} }
};

/* ---------- GitHub storage ---------- */
const GH = {
  cred: null, sha: {}, q: {},
  async req(method, path, body) {
    const headers = { 'Authorization': 'Bearer ' + this.cred.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (body) headers['Content-Type'] = 'application/json';
    try { return await fetch('https://api.github.com' + path, { method, headers, cache: 'no-store', body: body ? JSON.stringify(body) : undefined }); }
    catch (_) { const e = new Error('offline'); e.code = 'offline'; throw e; }
  },
  fail(r) { const e = new Error('http ' + r.status); e.code = r.status === 401 ? 'auth' : r.status === 403 ? 'forbidden' : r.status === 404 ? 'notfound' : (r.status === 409 || r.status === 422) ? 'conflict' : 'http'; e.status = r.status; return e; },
  url(path) { return `/repos/${encodeURIComponent(this.cred.owner)}/${encodeURIComponent(this.cred.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`; },
  async getJSON(path) {
    const r = await this.req('GET', this.url(path));
    if (r.status === 404) { delete this.sha[path]; return null; }
    if (!r.ok) throw this.fail(r);
    const j = await r.json();
    this.sha[path] = j.sha;
    return JSON.parse(b64dec(j.content || ''));
  },
  async putRaw(path, b64, message, sha) {
    const body = { message, content: b64 };
    if (sha) body.sha = sha;
    const r = await this.req('PUT', this.url(path), body);
    if (!r.ok) throw this.fail(r);
    const j = await r.json();
    this.sha[path] = j.content && j.content.sha;
  },
  async list(path) {
    const r = await this.req('GET', this.url(path));
    if (r.status === 404) return [];
    if (!r.ok) throw this.fail(r);
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  },
  async blob(path) {
    let r;
    try { r = await fetch('https://api.github.com' + this.url(path), { headers: { 'Authorization': 'Bearer ' + this.cred.token, 'Accept': 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28' } }); }
    catch (_) { const e = new Error('offline'); e.code = 'offline'; throw e; }
    if (!r.ok) throw this.fail(r);
    return URL.createObjectURL(await r.blob());
  },
  base() { return `/repos/${encodeURIComponent(this.cred.owner)}/${encodeURIComponent(this.cred.repo)}`; },
  async info() {
    const r = await this.req('GET', this.base());
    if (!r.ok) throw this.fail(r);
    const j = await r.json();
    this.branch = j.default_branch || 'main';
    return j;
  },
  // Несколько файлов одной фиксацией: blobs → tree → commit → ref (без force; при гонке — заново от свежей головы).
  async commitFiles(files, message, progress) {
    const base = this.base();
    if (!this.branch) await this.info();
    const shas = [];
    for (let i = 0; i < files.length; i++) {
      if (progress) progress(i + 1, files.length);
      const r = await this.req('POST', base + '/git/blobs', { content: files[i].b64, encoding: 'base64' });
      if (!r.ok) throw this.fail(r);
      shas.push((await r.json()).sha);
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      let r = await this.req('GET', base + '/git/ref/heads/' + encodeURIComponent(this.branch));
      if (!r.ok) throw this.fail(r);
      const head = (await r.json()).object.sha;
      r = await this.req('GET', base + '/git/commits/' + head);
      if (!r.ok) throw this.fail(r);
      const baseTree = (await r.json()).tree.sha;
      r = await this.req('POST', base + '/git/trees', { base_tree: baseTree, tree: files.map((f, i) => ({ path: f.path, mode: '100644', type: 'blob', sha: shas[i] })) });
      if (!r.ok) throw this.fail(r);
      const tree = (await r.json()).sha;
      r = await this.req('POST', base + '/git/commits', { message, tree, parents: [head] });
      if (!r.ok) throw this.fail(r);
      const commit = (await r.json()).sha;
      r = await this.req('PATCH', base + '/git/refs/heads/' + encodeURIComponent(this.branch), { sha: commit, force: false });
      if (r.ok) { files.forEach(f => { delete this.sha[f.path]; }); return commit; }
      if (r.status !== 422 && r.status !== 409) throw this.fail(r);
    }
    const e = new Error('conflict'); e.code = 'conflict'; throw e;
  },
  mutate(path, fn, message, empty) {
    const run = (this.q[path] || Promise.resolve()).then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const cur = (await this.getJSON(path)) || clone(empty || {});
        const next = fn(cur);
        if (next === undefined) return cur;
        try { await this.putRaw(path, b64enc(JSON.stringify(next, null, 2) + '\n'), message, this.sha[path]); return next; }
        catch (e) { if (e.code === 'conflict' && attempt < 2) continue; throw e; }
      }
    });
    this.q[path] = run.catch(() => {});
    return run;
  }
};
function b64enc(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64dec(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/* ---------- state ---------- */
const S = {
  ready: false, loading: false, lastLoad: 0,
  config: null, learned: {}, lessons: [], studyDays: {}, sportMoves: {}, sportExtra: [], events: [], recipes: [], meals: { days: {} }, requests: [],
  ideas: [], sleep: { days: {} }, curriculum: { blocks: [] }, notes: null, notesErr: null, notesLoading: false, noteCache: {},
  openCur: new Set(), touchedCur: new Set(), showAllDone: false,
  money: {}, workouts: {}, fresh: new Set(), reviews: [], rev: null, portfolio: null, notesDays: LS.get('bj-notes-days'), duties: {}, absences: [], studyLog: [], body: { weight: {} }, inbox: [], period: null, periodP: null, calMonth: monthKey(today()), foodDate: today(), img: {},
  shift: {}, cur: null, sportList: [], studyCache: null, lastToday: today(), slotsSig: '', pending: 0
};

const CATS_DEFAULT = ['Продукты','Кафе и доставка','Транспорт','Жильё и связь','Быт и гигиена','Спорт','Здоровье','Одежда','Техника и подписки','Учёба','Развлечения','Подарки','Другое'];
const KW = [
  ['Маркетплейсы', ['ozon','озон','wildberries','вайлдберриз','яндекс маркет','yandex market','market.yandex','aliexpress','алиэкспресс','мегамаркет','megamarket','lamoda','ламода']],
  ['Учёба', ['книг','курс','учеб','экзамен','ваучер','сертификац','лекци']],
  ['Транспорт', ['такси','бензин','топлив','заправк','азс','метро','автобус','проезд','электричк','поезд','ржд','парковк','мойк','шиномонт','каршер','uber','bolt','taxi','yandex go','yandex.go','яндекс go','troika','тройка','mosgortrans','azs','lukoil','лукойл','gazpromneft','газпромнефть','rosneft','роснефть','tatneft','авиа','самолет','маршрутк','трамва','троллейб','моторн']],
  ['Спорт', ['абонемент','бассейн','протеин','креатин','гейнер','спортпит','bcaa','гантел','гиря','гири','кроссов','перчат','бинты','скакалк','тренер','тренаж','спортзал','фитнес']],
  ['Здоровье', ['аптек','лекарств','витамин','врач','стомат','анализ','таблет','мазь','клиник','омега','магний','пластыр','apteka','rigla','ригла','asna','zdravcity','eapteka','gorzdrav','горздрав']],
  ['Техника и подписки', ['подписк','claude','chatgpt','vpn','впн','хостинг','домен','сервер','ноутбук','наушник','флешк','кабел','зарядк','мышк','клавиатур','ssd','роутер','steam','яндекс плюс','yandex plus','кинопоиск','kinopoisk','okko','apple.com','itunes','icloud']],
  ['Кафе и доставка', ['кафе','кофе','капучин','латте','ресторан','шаурм','шаверм','бургер','пицц','суши','ролл','доставк','обед','ужин','завтрак','столов','макдон','kfc','вкусно и точка','бизнес-ланч','чаевые','coffee','cafe','kafe','kofe','burger','rostic','vkusno','dodo','pizza','shaurm','shawarm','stolovaya','yandex eda','яндекс еда','delivery']],
  ['Жильё и связь', ['аренд','квартир','коммунал','жкх','электроэнерг','интернет','связь','мобильн','сотов','тариф','ипотек','билайн','мегафон','мтс','теле2','beeline','megafon','mts ','tele2']],
  ['Быт и гигиена', ['шампун','мыло','гель д','зубн','паст','порош','моющ','туалетн','салфет','бытов','посуд','губк','дезодор','бритв','станк','пакет','батарейк','fix price','fixprice','фикс прайс']],
  ['Одежда', ['одежд','футбол','штан','джинс','куртк','обув','носк','трус','шапк','худи','свитер','кофт','рубаш','ботин','шорт']],
  ['Развлечения', ['кино','игр','концерт','театр','музей','кальян','боулинг','бильярд','бар ']],
  ['Подарки', ['подар','цвет']],
  ['Продукты', ['продукт','хлеб','батон','молок','кефир','сыр','творог','йогурт','сметан','яйц','мясо','куриц','курин','филе','фарш','рыб','колбас','сосис','овощ','фрукт','яблок','банан','картош','картоф','помидор','огур','морков','круп','рис','греч','овсян','макарон','масло','сахар','соль','мука','вода','сок','чай','конфет','печен','шоколад','пиво','лаваш','магнит','пятероч','перекрест','ашан','лента','дикси','вкусвилл','самокат','pyaterochk','magnit','dixy','diksi','krasnoe','красное','lenta','vkusvill','perekrest','bristol','бристоль','chizhik','чижик','verny','верный','spar','samokat','biedronka','lidl','zabka','żabka','auchan','carrefour','kaufland']]
];
function cats() { return S.config && Array.isArray(S.config.categories) && S.config.categories.length ? S.config.categories : CATS_DEFAULT; }
function otherCat() { const c = cats(); return c.includes('Другое') ? 'Другое' : c[c.length - 1]; }
function curSym() { return (S.config && S.config.currency) || '₽'; }
const kindOf = x => x.kind || 'spend';
const KIND_NAMES = { spend: 'Трата', income: 'Доход', transfer: 'Перевод', cash: 'Наличные' };
function catsFor(kind) {
  const m = (S.config && S.config.money) || {};
  if (kind === 'income') return m.incomeCategories || ['Зарплата', 'Поступления', 'Кэшбэк', 'Другое'];
  if (kind === 'transfer') return m.transferCategories || ['Переводы', 'Свои счета'];
  if (kind === 'cash') return ['Наличные'];
  return cats();
}
function categorize(name) {
  const n = norm(name) + ' ', list = cats(), learned = S.learned || {};
  const key = norm(name);
  if (learned[key] && list.includes(learned[key])) return { cat: learned[key], known: true };
  for (const [c, words] of KW) { if (!list.includes(c)) continue; if (words.some(w => n.includes(w))) return { cat: c, known: true }; }
  return { cat: otherCat(), known: false };
}
function catOptions(list, sel) { return list.map(c => `<option value="${esc(c)}"${c === sel ? ' selected' : ''}>${esc(c)}</option>`).join(''); }
function banks() { return ((S.config || {}).money || {}).banks || {}; }
function bankName(code) { return code ? (banks()[code] || code) : ''; }
function accounts() { return ((S.config || {}).money || {}).accounts || []; }
const ACCT_TYPE = { card: 'Карта', savings: 'Накопления', debt: 'Долг' };
function availableNow() {
  const cards = accounts().filter(a => a.type === 'card');
  const known = cards.filter(a => a.balance != null && a.balance !== '');
  const sum = known.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const since = Math.max(0, ...known.map(a => Number(a.ts) || 0));
  let delta = 0, n = 0;
  if (since) for (const mk of Object.keys(S.money)) for (const x of ((S.money[mk] || {}).items || [])) {
    if (String(x.src || '').startsWith('bank:') || !(Number(x.ts) > since)) continue;
    const k = kindOf(x), a = Number(x.amount) || 0;
    if (k === 'spend' || k === 'cash') { delta -= a; n++; }
    else if (k === 'income') { delta += a; n++; }
    else if (k === 'transfer' && x.cat !== 'Свои счета') { delta += x.dir === 'in' ? a : -a; n++; }
  }
  return { cards, known, sum, delta, n, missing: cards.filter(a => a.balance == null || a.balance === '') };
}
function accountsHtml() {
  const list = accounts(), cur = curSym(), av = availableNow();
  const full = av.cards.length && !av.missing.length;
  const top = av.cards.length ? `<button type="button" class="acct" style="width:100%;margin-top:12px" data-action="acct-cards"><span class="k">Доступно на картах · без накоплений</span><span class="v">${full ? fmt(av.sum + av.delta) + ' ' + esc(cur) : 'нажми и впиши остатки'}</span><span class="d">${av.known.map(a => `${esc(bankName(a.bank) || a.name)} ${fmt(a.balance)}${a.asOf ? ' (' + dm(a.asOf) + ')' : ''}`).join(' · ')}${av.missing.length ? (av.known.length ? ' · ' : '') + 'нет остатка: ' + av.missing.map(a => esc(bankName(a.bank) || a.name)).join(', ') : ''}${full && av.n ? ` · с учётом ${av.n} ${plural(av.n, 'записи', 'записей', 'записей')} после обновления (${av.delta < 0 ? '−' : '+'}${fmt(Math.abs(av.delta))})` : ''}</span></button>` : '';
  const rest = list.filter(a => a.type !== 'card');
  return top + `<div class="accts">${rest.map(a => `<button type="button" class="acct ${a.type === 'debt' ? 'debt' : ''}" data-action="acct" data-id="${esc(a.id)}"><span class="k">${ACCT_TYPE[a.type] || 'Счёт'}${a.bank ? ' · ' + esc(bankName(a.bank)) : ''}</span><span class="v">${a.balance == null || a.balance === '' ? 'уточнить' : fmt(a.balance) + ' ' + esc(cur)}</span><span class="d">${esc(a.name)}${a.asOf ? ' · на ' + dm(a.asOf) : ''}</span></button>`).join('')}</div>
    <div class="acct-links"><button type="button" class="link-btn" data-action="acct-new">+ Карта, накопление или долг</button><button type="button" class="link-btn" data-action="auto-setup">⚡ Автозапись трат из SMS</button></div>`;
}
function openCards() {
  const av = availableNow(), cur = curSym();
  S.cur = { type: 'cards' };
  openSheet(`<h2 class="sh-title">Остатки на картах</h2>
    
    ${av.cards.map(a => `<label class="fld" for="cb-${esc(a.id)}">${esc(a.name)}${a.asOf ? ` <span class="m">· было на ${dm(a.asOf)}: ${fmt(a.balance)} ${esc(cur)}</span>` : ''}</label><div class="two"><input id="cb-${esc(a.id)}" data-card="${esc(a.id)}" inputmode="decimal" value="${a.balance != null ? esc(a.balance) : ''}" placeholder="0" aria-label="Остаток"><input data-l4="${esc(a.id)}" inputmode="numeric" maxlength="14" value="${esc(a.last4 || '')}" placeholder="4 цифры" aria-label="Последние 4 цифры карты"></div>`).join('')}
    
    
    <div class="sh-acts"><button type="button" class="btn money block" data-action="cards-save">Сохранить</button><button type="button" class="btn block" data-action="acct-new">+ Другая карта</button></div>`);
}
async function cardsSave() {
  const vals = {};
  document.querySelectorAll('[data-card]').forEach(el => { const v = numOrNull(el.value); if (v != null) vals[el.dataset.card] = Math.round(v * 100) / 100; });
  const l4s = {};
  document.querySelectorAll('[data-l4]').forEach(el => { const v = String(el.value || '').split(/[,\s]+/).filter(x => /^\d{4}$/.test(x)).join(','); l4s[el.dataset.l4] = v; });
  if (!Object.keys(vals).length && !Object.values(l4s).some(Boolean)) { toast('Впиши хотя бы один остаток'); return; }
  const now = Date.now(), t = today();
  const ok = await writeConfig(cfg => { ((cfg.money || {}).accounts || []).forEach(a => {
    if (a.id in vals) { a.balance = vals[a.id]; a.asOf = t; a.ts = now; }
    if (a.id in l4s) { if (l4s[a.id]) a.last4 = l4s[a.id]; else delete a.last4; }
  }); }, 'Деньги: остатки на картах');
  if (ok) { closeSheet(); toast('Остатки обновлены'); }
}
function openAccount(id) {
  const a = id ? accounts().find(x => x.id === id) : { id: null, type: 'card', name: '', bank: '', balance: '' };
  if (!a) return;
  S.cur = { type: 'acct', a };
  const bk = banks();
  openSheet(`<h2 class="sh-title">${id ? esc(a.name) : 'Новая карта, накопление или долг'}</h2>
    ${id && a.asOf ? `<p class="sh-meta">Остаток на ${short(a.asOf)}</p>` : ''}
    <label class="fld" for="ac-name">Название</label><input id="ac-name" value="${esc(a.name)}" placeholder="Например: на машину">
    <div class="two"><div><label class="fld" for="ac-type">Что это</label><select id="ac-type">${Object.keys(ACCT_TYPE).map(k => `<option value="${k}"${a.type === k ? ' selected' : ''}>${ACCT_TYPE[k]}</option>`).join('')}</select></div>
    <div><label class="fld" for="ac-bank">Банк</label><select id="ac-bank"><option value="">—</option>${Object.keys(bk).map(k => `<option value="${esc(k)}"${a.bank === k ? ' selected' : ''}>${esc(bk[k])}</option>`).join('')}</select></div></div>
    <label class="fld" for="ac-bal">Сейчас, ${esc(curSym())}</label><input id="ac-bal" inputmode="decimal" value="${a.balance != null ? esc(a.balance) : ''}">
    <label class="fld" for="ac-l4">Последние 4 цифры карты <span class="m">— чтобы узнавать её SMS</span></label><input id="ac-l4" inputmode="numeric" maxlength="14" value="${esc(a.last4 || '')}" placeholder="1234">
    
    <div class="sh-acts"><button type="button" class="btn money block" data-action="acct-save">Сохранить</button>${id ? '<button type="button" class="btn danger block" data-action="acct-del">Удалить</button>' : ''}</div>`);
}
async function accountSave() {
  const c = S.cur; if (!c || c.type !== 'acct') return;
  const name = $('#ac-name').value.trim(), bal = numOrNull($('#ac-bal').value);
  if (!name || bal == null) { toast('Нужны название и сумма'); return; }
  const rec = { id: c.a.id || ('a' + rid().slice(0, 8)), type: $('#ac-type').value, name, balance: Math.round(bal * 100) / 100, asOf: today(), ts: Date.now() };
  const bank = $('#ac-bank').value; if (bank) rec.bank = bank;
  const l4 = ($('#ac-l4') ? $('#ac-l4').value : '').split(/[,\s]+/).filter(v => /^\d{4}$/.test(v)).join(',');
  if (l4) rec.last4 = l4;
  const ok = await writeConfig(cfg => { cfg.money = cfg.money || {}; const l = cfg.money.accounts = cfg.money.accounts || []; const k = l.findIndex(x => x.id === rec.id); if (k >= 0) l[k] = rec; else l.push(rec); }, `Деньги: ${name} = ${rec.balance}`);
  if (ok) { closeSheet(); toast('Сохранено'); }
}

/* ---------- parsing "хлеб 45, такси 320" ---------- */
function parseSpend(text) {
  const items = [], bad = [];
  const src = String(text || '').replace(/(\d)\s(?=\d{3}(?!\d))/g, '$1');
  const chunks = src.split(/\n|;|,(?=\s*[^\d\s])/).map(s => s.trim()).filter(Boolean);
  for (const ch of chunks) {
    const re = /([^\d]*?)(\d+(?:[.,]\d{1,2})?)(?:\s*(к|k|тыс\.?)(?![a-zа-яё]))?(?:\s*(?:руб(?:лей|ля|ль)?\.?|р\.?|₽|zł|zl|pln|eur|€|usd|\$)(?![a-zа-яё]))?/gi;
    let m, last = 0, found = 0;
    while ((m = re.exec(ch)) !== null) {
      const name = m[1].replace(/^[\s,.;:–—\-+=*]+|[\s,.;:–—\-+=*]+$/g, '').replace(/\s+(за|на|—)$/i, '').replace(/\s{2,}/g, ' ').trim();
      let amount = parseFloat(m[2].replace(',', '.'));
      if (m[3]) amount *= 1000;
      last = re.lastIndex;
      if (!(amount > 0)) continue;
      items.push({ name: cap1(name) || 'Без названия', amount: Math.round(amount * 100) / 100 });
      found++;
    }
    const rest = ch.slice(last).replace(/^[\s,.;:–—\-]+|[\s,.;:–—\-]+$/g, '');
    if (/[a-zа-яё]/i.test(rest)) {
      // «перевод 600 за алкоголь» — хвост после суммы это продолжение названия, а не новая покупка
      if (found) { const it = items[items.length - 1]; it.name = (it.name === 'Без названия' ? cap1(rest.replace(/^(на|за)\s+/i, '')) : it.name + ' ' + rest).replace(/\s{2,}/g, ' '); }
      else bad.push(rest);
    }
  }
  return { items, bad };
}

/* ---------- автозапись: Команда iOS → issue «В журнал» → записи ----------
   Команда на телефоне создаёт в journal-data issue с заголовком «В журнал» и текстом SMS (или тем, что продиктовал).
   Отдельный ключ Команды умеет только Issues — к файлам журнала доступа у него нет. Журнал при открытии
   разбирает такие issue в записи, обновляет остаток карты и закрывает issue. Непонятое — в inbox/quick.json для Claude. */
const QUICK_TITLE = 'В журнал';
const MERCH = [
  [/pyaterochk|пят[её]роч/i, 'Пятёрочка'], [/magnit|магнит/i, 'Магнит'], [/dixy|diksi|дикси/i, 'Дикси'], [/krasnoe|красное\s*(&|и)\s*белое/i, 'Красное & Белое'],
  [/\blenta\b|лента/i, 'Лента'], [/vkusvill|вкусвилл/i, 'ВкусВилл'], [/perekrest|перекр[её]ст/i, 'Перекрёсток'], [/auchan|ашан/i, 'Ашан'],
  [/chizhik|чижик/i, 'Чижик'], [/samokat|самокат/i, 'Самокат'], [/ozon|озон/i, 'Ozon'], [/wildberries|вайлдберр/i, 'Wildberries'],
  [/yandex[\s.*_-]*(go|taxi)|яндекс[\s.]*(go|такси)/i, 'Яндекс Go'], [/yandex[\s.*_-]*eda|яндекс[\s.]*еда/i, 'Яндекс Еда'],
  [/beeline|билайн/i, 'Билайн'], [/megafon|мегафон/i, 'МегаФон'], [/rostic|kfc/i, 'Rostic’s'], [/vkusno|вкусно\s*[-—]?\s*и\s*точка/i, 'Вкусно — и точка'],
  [/burger\s*king|бургер\s*кинг/i, 'Бургер Кинг'], [/dodo|додо/i, 'Додо Пицца'], [/bristol|бристоль/i, 'Бристоль'], [/fix\s*price|фикс\s*прайс/i, 'Fix Price']
];
const SUM_N = '(\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+|\\d+)(?:[.,](\\d{1,2}))?';
const CUR_T = '(?:₽|руб\\.?|р\\.?|rub|rur)(?![a-zа-яё])';
const MONEY_RE = new RegExp(SUM_N + '\\s?' + CUR_T, 'i');
const BAL_RE = new RegExp('(баланс|доступно|остаток|balans|dostupno|ostatok)\\s*:?\\s*(-?)\\s*' + SUM_N + '(?:\\s?' + CUR_T + ')?', 'i');
const CARD_RE = /(?:карт[аыу]|karta|card|сч[её]т[а-я]*|schet|mir|visa|ecmc|mc|maestro|мир)?[\s:-]*[*•]+\s?\d{4}|(?:mir|visa|ecmc|maestro|сч[её]т|сч|schet|мир)[\s-]?\d{4}(?!\d)/gi;
const toNum = (a, b) => parseFloat(String(a).replace(/[   ]/g, '') + (b ? '.' + b : ''));
const OPW = ['по номеру телефона','по номеру','номеру','номер','телефона','покупка','оплата услуг','оплата','списание','перевод по сбп','перевод по номеру телефона','перевод через сбп','перевод','зачисление','пополнение','поступление','выдача наличных','снятие наличных','снятие','выдача','возврат','входящий','исходящий','успешно','карта','karta','card','счет','счёт','schet','pokupka','oplata','spisanie','perevod','zachislenie','popolnenie','получатель','отправитель','от','для','по','сбп','sbp','rub','rur','руб','р','на','в'];
const OPW_RE = new RegExp('(^|[^а-яёa-z])(' + OPW.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![а-яёa-z])', 'gi');
function smsClean(t) {
  return String(t || '').replace(/[<>]/g, ' ').replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/[  ]/g, ' ').replace(/\r/g, '').trim().slice(0, 600);
}
// телефоны — до последних 4 цифр, номер карты целиком — до ••последних 4
function maskRaw(t) {
  return String(t || '').replace(/(?:\+7|(?:^|[^\d])8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)/g, m => (/^[^\d+]/.test(m) ? m[0] : '') + '…' + m.replace(/\D/g, '').slice(-4))
    .replace(/(^|[^\d])\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?(\d{4})(?!\d)/g, '$1••$2');
}
function merchantName(x) {
  let t = String(x || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  for (const [re, n] of MERCH) if (re.test(t)) return n;
  t = t.replace(/(^|\s)(g\.?\s?)?(moskva|moscow|msk|spb|sankt-peterburg|rus|ru|russia|москва|г\.)(?=\s|$)/gi, ' ').replace(/\d{3,}/g, ' ')
    .replace(/[*_#|;]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s.,:\-–—]+|[\s.,:\-–—]+$/g, '').trim();
  if (!t || !/[a-zа-яё]{2}/i.test(t)) return '';
  if (!/[а-яё]/i.test(t) && t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|[\s&.\-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  return t.slice(0, 60);
}
function cleanWho(x) {
  return String(x || '').replace(OPW_RE, '$1 ').replace(/([^А-ЯЁA-Z])\./g, '$1 ').replace(/^\./, ' ').replace(/[,;:!]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}
function cardBank(text) {
  const t = text.toLowerCase();
  if (/т-?банк|t-?bank|тинькофф|tinkoff/.test(t)) return 'tbank';
  if (/втб|vtb/.test(t)) return 'vtb';
  if (/сбер|sber/.test(t)) return 'sber';
  const l4 = (text.match(/(?:[*•]\s?|(?:mir|visa|ecmc|maestro|сч[её]т|сч|мир)[\s-]?)(\d{4})(?!\d)/i) || [])[1];
  if (l4) { const a = accounts().find(x => x.last4 && String(x.last4).split(/[,\s]+/).includes(l4)); if (a) return a.bank || ''; }
  return '';
}
// Остаток по SMS меняем только у карты, чьи последние 4 цифры есть в тексте: название банка в SMS может написать кто угодно,
// а «Доступно» по кредитке — это лимит, а не деньги на дебетовой карте.
function cardAcct(text) {
  const l4 = (text.match(/(?:[*•]\s?|(?:mir|visa|ecmc|maestro|сч[её]т|сч|мир)[\s-]?)(\d{4})(?!\d)/i) || [])[1];
  return l4 ? accounts().find(x => x.type === 'card' && x.last4 && String(x.last4).split(/[,\s]+/).includes(l4)) || null : null;
}
function looksLikeBankSms(t) {
  return BAL_RE.test(t) || /[*•]\s?\d{4}(?!\d)|(?:mir|visa|ecmc|сч[её]т)[\s-]?\d{4}(?!\d)/i.test(t)
    || (MONEY_RE.test(t) && /покупк|оплат|списан|зачислен|пополнен|перевод|снятие|выдача|pokupk|oplat|spisan|perevod/i.test(t));
}
// Разбор SMS банка. null — не понял; {ignore} — код или отказ, записывать нечего.
function ignoreReason(t) {
  const low = t.toLowerCase().replace(/ё/g, 'е');
  if (/никому|не сообщайте|не говорите|не передавайте|код подтвержд|код для|код:|одноразов|пароль|password|code:|parol/.test(low)) return 'code';
  if (/отказ|отклонен|недостаточно средств|declined|otkaz|не выполнен/.test(low)) return 'declined';
  return '';
}
function parseBankSms(text, ts) {
  const t = maskRaw(smsClean(text)), low = t.toLowerCase().replace(/ё/g, 'е');
  const ig = ignoreReason(t); if (ig) return { ignore: ig };
  let bal = null, rest = t;
  const bm = BAL_RE.exec(t);
  if (bm) { bal = (bm[2] === '-' ? -1 : 1) * toNum(bm[3], bm[4]); rest = t.slice(0, bm.index) + ' | ' + t.slice(bm.index + bm[0].length); }
  const clean = rest.replace(CARD_RE, ' ').replace(/(^|[^\d])\d{1,2}:\d{2}(?::\d{2})?(?!\d)/g, '$1 ').replace(/(^|[^\d])\d{1,2}\.\d{1,2}\.\d{2,4}(?!\d)/g, '$1 ');
  const am = MONEY_RE.exec(clean);
  if (!am) return null;
  const amount = Math.round(toNum(am[1], am[2]) * 100) / 100;
  if (!(amount > 0)) return null;
  let kind;
  if (/выдача|снятие|наличн|vydacha|snyatie|nalichn|банкомат/.test(low)) kind = 'cash';
  else if (/зачислен|пополнен|поступлен|зарплат|возврат|кэшбэк|кешбэк|cashback|входящ|перевод от|zachislen|popolnen|vozvrat|postuplen/.test(low)) kind = 'income';
  else if (/покупк|оплат|pokupk|oplat/.test(low)) kind = 'spend';
  else if (/перевод|perevod|сбп|sbp/.test(low)) kind = 'transfer';
  else if (/списан|spisan|платеж/.test(low)) kind = 'spend';
  else if (bal != null) kind = 'spend';
  else return null;
  const after = clean.slice(am.index + am[0].length).split('|')[0], before = clean.slice(0, am.index);
  const person = s => (s.match(/[А-ЯЁ][а-яё]+(?:\s[А-ЯЁ][а-яё]+)?\s[А-ЯЁ]\./) || [])[0];
  const whoRaw = cleanWho(after) || cleanWho(before);
  const phone = (t.match(/…\d{4}/) || [])[0];
  const who = person(after) || person(before) || merchantName(whoRaw) || (phone ? 'номер ' + phone : '');
  const date = ds(new Date(ts)), time = hhmm(new Date(ts));
  const bank = cardBank(t);
  const r = { date, time, amount, kind, src: 'auto:sms', raw: maskRaw(t).slice(0, 300), ts };
  if (bank) r.acc = bank;
  if (kind === 'transfer' && /ozon|озон/i.test(t) && !/перевод от/i.test(low)) { r.kind = 'spend'; r.name = 'Покупки на Ozon'; }
  else if (kind === 'spend') r.name = who || (/списан|spisan/.test(low) ? 'Списание' : /оплат|oplat/.test(low) ? 'Оплата' : 'Покупка');
  else if (kind === 'cash') { r.name = 'Снятие наличных'; r.cat = 'Наличные'; }
  else if (kind === 'income') {
    const ic = catsFor('income');
    if (/зарплат/.test(low)) { r.name = 'Зарплата'; r.cat = ic.includes('Зарплата') ? 'Зарплата' : ic[0]; }
    else if (/кэшбэк|кешбэк|cashback/.test(low)) { r.name = 'Кэшбэк'; r.cat = ic.includes('Кэшбэк') ? 'Кэшбэк' : ic[0]; }
    else { r.name = (/возврат|vozvrat/.test(low) ? 'Возврат' : 'Поступление') + (who ? ': ' + who : ''); r.cat = ic.includes('Поступления') ? 'Поступления' : ic[0]; }
  } else {
    const tc = catsFor('transfer');
    r.dir = 'out'; r.name = 'Перевод' + (who ? ': ' + who : ''); r.auto = true;
    r.cat = /между своими|себе|своих сч/.test(low) && tc.includes('Свои счета') ? 'Свои счета' : person(t) && tc.includes('Переводы людям') ? 'Переводы людям' : tc.includes('Не разобрано') ? 'Не разобрано' : tc[0];
  }
  if (r.kind === 'spend') { const c = categorize(r.name); r.cat = c.cat; if (!c.known) r.auto = true; }
  const ac = cardAcct(t);
  return { recs: [r], bal: bal != null && ac ? { id: ac.id, bank: ac.bank, value: Math.round(bal * 100) / 100, date, ts } : null };
}
// То, что Олег продиктовал или написал сам: «такси 320, кофе 150», «вчера потратил 300 на такси», «получил 5000».
function parseQuickText(text, ts) {
  let t = smsClean(text), date = ds(new Date(ts));
  const B = '(^|\\s)', E = '(?=\\s|$|[,.!])';
  if (new RegExp(B + 'позавчера' + E, 'i').test(t)) { date = addDays(date, -2); t = t.replace(new RegExp(B + 'позавчера' + E, 'ig'), ' '); }
  else if (new RegExp(B + 'вчера' + E, 'i').test(t)) { date = addDays(date, -1); t = t.replace(new RegExp(B + 'вчера' + E, 'ig'), ' '); }
  t = t.trim();
  let kind = 'spend';
  const vm = t.match(/^(потратил[аи]?|купил[аи]?|заплатил[аи]?|оплатил[аи]?|получил[аи]?|пришл[оаи]|перев[её]л[аи]?|скинул[аи]?|отправил[аи]?|снял[аи]?)(?=\s|$)\s*/i);
  if (vm) { const v = vm[1].toLowerCase(); kind = /^(получ|пришл)/.test(v) ? 'income' : /^(перев|скину|отправ)/.test(v) ? 'transfer' : /^снял/.test(v) ? 'cash' : 'spend'; t = t.slice(vm[0].length); }
  else if (/^(зарплата|аванс|кэшбэк|кешбэк)(?=\s|$|\d)/i.test(t)) kind = 'income';
  const res = parseSpend(t);
  const recs = res.items.map(x => {
    let name = cap1(String(x.name).replace(/^(на|за)\s+/i, '').trim()) || 'Без названия';
    const r = { date, time: hhmm(new Date(ts)), name, amount: x.amount, kind, src: 'auto:manual', raw: maskRaw(smsClean(text)).slice(0, 300), ts };
    if (kind === 'spend' || (kind === 'transfer' && /ozon|озон/i.test(name))) { r.kind = 'spend'; const c = categorize(name); r.cat = c.cat; if (!c.known) r.auto = true; }
    else if (kind === 'income') { const ic = catsFor('income'); r.cat = /зарплат|аванс/i.test(name) && ic.includes('Зарплата') ? 'Зарплата' : /кэшб|кешб/i.test(name) && ic.includes('Кэшбэк') ? 'Кэшбэк' : ic.includes('Поступления') ? 'Поступления' : ic[0]; }
    else if (kind === 'transfer') { const tc = catsFor('transfer'); r.dir = 'out'; r.cat = tc.includes('Переводы людям') ? 'Переводы людям' : tc[0]; }
    else r.cat = 'Наличные';
    return r;
  });
  return { recs, bad: res.bad };
}
function parseQuick(text, ts) {
  const t = smsClean(text);
  if (!t) return { recs: [] };
  const ig = ignoreReason(t); if (ig) return { ignore: ig, recs: [] };
  if (looksLikeBankSms(t)) return parseBankSms(t, ts) || { recs: [], bal: null };  // похоже на SMS банка, но не понял — отложить для Claude
  const m = parseQuickText(t, ts);
  return { recs: m.recs, bal: null };
}
// SMS о покупке, которую Олег уже записал руками: не дублируем, а дополняем его запись банком и текстом SMS.
function mergeSmsInto(items, r) {
  if (r.src !== 'auto:sms' || !['spend', 'cash'].includes(r.kind)) return false;
  let best = null, gap = 3 * 3600e3;
  for (const x of items) {
    if (x.qf || kindOf(x) !== r.kind || x.date !== r.date || Math.abs((Number(x.amount) || 0) - r.amount) > 0.009) continue;
    if (x.src && !String(x.src).startsWith('auto:manual')) continue;
    const g = Math.abs((Number(x.ts) || 0) - r.ts);
    if (g <= gap) { gap = g; best = x; }
  }
  if (!best) return false;
  best.qf = r.qf; if (r.acc && !best.acc) best.acc = r.acc; if (!best.raw) best.raw = r.raw; if (!best.time) best.time = r.time;
  return true;
}
const PHONE_RX = '(?:\\+7|8)[\\s(-]*\\d{3}[\\s)-]*\\d{3}[\\s-]?\\d{2}[\\s-]?(\\d{2})';
function copyRow(label, text, show) {
  return `<div class="cp-row"><div class="cp-k">${esc(label)}</div><code class="cp-v">${esc(show || text)}</code><button type="button" class="btn sm" data-action="copy" data-text="${esc(text)}">Копировать</button></div>`;
}
function openAutoSetup() {
  const o = GH.cred ? GH.cred.owner : 'gr0mbl4', r = GH.cred ? GH.cred.repo : 'journal-data';
  const url = `https://api.github.com/repos/${o}/${r}/issues`;
  const st = S.quickErr === 403 || S.quickErr === 404
    ? `<div class="callout">Ключ этого телефона пока не видит «issues», поэтому журнал не может забрать записи. GitHub → Settings → Developer settings → Fine-grained tokens → <b>journal-phone</b> → Edit → Permissions → <b>Issues: Read and write</b> → Update.</div>`
    : ``;
  S.cur = { type: 'auto' };
  openSheet(`<h2 class="sh-title">Автозапись трат</h2>${st}
    <h3 class="sec">1. Отдельный ключ для Команды</h3>
    <ol class="ing"><li>github.com → Settings → Developer settings → Fine-grained tokens → Generate new token.</li>
    <li>Имя <span class="mono">journal-shortcut</span>, срок 90 дней, Only select repositories → <b>${esc(r)}</b>.</li>
    <li>Permissions → <b>Issues: Read and write</b>. Больше ничего не включай — к файлам журнала у этого ключа доступа не будет.</li></ol>
    <h3 class="sec">2. Команда «В журнал»</h3>
    <ol class="ing">
      <li>Команды → + → назови «В журнал». Нажми ⓘ внизу → включи «Показывать в меню „Поделиться“». Вверху появится блок «Получать … из …»: тип — <b>Текст</b>, «Если нет входных данных» — <b>Запросить</b>.</li>
      <li>«Если»: <b>Входные данные команды</b> · содержит · <b>икому</b> → внутрь «Остановить эту команду». Так коды из SMS («никому не говорите») не уйдут никуда.</li>
      <li>«Заменить текст» в Входных данных команды, включи «Регулярное выражение»: найти ${copyRow('', PHONE_RX, 'телефон')} заменить на ${copyRow('', '…$1', '…$1')}</li>
      <li>«Получить содержимое URL»: ${copyRow('URL', url)} Метод <b>POST</b>. Заголовки: ${copyRow('Authorization', 'Bearer ', 'Bearer ␣ + ключ из шага 1')}${copyRow('Accept', 'application/vnd.github+json')} Текст запроса — <b>JSON</b>: ${copyRow('title', QUICK_TITLE)} и <b>body</b> — переменная «Измененный текст».</li>
      <li>Для проверки запусти команду и напиши «тест 1» — потом открой журнал.</li>
    </ol>
    <h3 class="sec">3. Автоматически из SMS банка</h3>
    <ol class="ing"><li>Команды → Автоматизация → + → <b>Сообщение</b> → «Сообщение содержит»: <b>Доступно</b> (так пишет Т-Банк; для ВТБ и Сбера — вторая автоматизация со словом <b>Баланс</b>). Обязательно укажи и «Отправитель» — контакт банка (сохрани номер, с которого приходят SMS, в Контакты). Без этого журнал примет SMS от кого угодно.</li>
    <li>«Запускать сразу» → Далее → «Новая пустая автоматизация» → действие «Запустить команду» → «В журнал», входные данные — <b>Входные данные команды</b>.</li>
    <li>SMS об операциях включаются в приложении банка и обычно платные — push-уведомления Команды читать не умеют.</li></ol>
    <h3 class="sec">4. Руками — двойным касанием по задней крышке</h3>
    <p class="note">Настройки → Универсальный доступ → Касание → Коснуться сзади → Двойное касание → «В журнал». Скажи или напиши «шоколадка 42», «вчера такси 320», «получил 5000».</p>
    <h3 class="sec">Проверить, как журнал поймёт текст</h3>
    <textarea id="aq-text" rows="3" placeholder="Вставь сюда SMS банка"></textarea>
    <div class="sh-acts"><button type="button" class="btn block" data-action="auto-test">Проверить</button></div>
    <div id="aq-out"></div>
    <p class="note">Команду никому не пересылай — в ней ключ.</p>`);
}
function autoTest() {
  const t = ($('#aq-text').value || '').trim(), out = $('#aq-out');
  if (!t) { out.innerHTML = ''; return; }
  const r = parseQuick(t, Date.now());
  if (r.ignore) { out.innerHTML = `<p class="note">${r.ignore === 'code' ? 'Это код подтверждения — журнал его пропустит и ничего не запишет.' : 'Это отказ по операции — записывать нечего.'}</p>`; return; }
  if (!r.recs || !r.recs.length) { out.innerHTML = '<p class="err">Не понял. Такой текст журнал отложит для Claude.</p>'; return; }
  out.innerHTML = `<div class="kv">${r.recs.map(x => `<span>${esc(x.name)}<br><small class="m">${esc(KIND_NAMES[x.kind] || '')} · ${esc(x.cat || '')}${x.acc ? ' · ' + esc(bankName(x.acc)) : ' · банк не определён'}</small></span><span class="v">${fmt(x.amount)}</span>`).join('')}${r.bal ? `<span>Остаток ${esc(bankName(r.bal.bank))}</span><span class="v">${fmt(r.bal.value)}</span>` : ''}</div>`
    + (!r.bal && looksLikeBankSms(t) ? '<p class="note">Остаток не обновится — впиши 4 последние цифры карты в «Доступно на картах».</p>' : '');
}
async function processQuick() {
  if (S.quickBusy || !GH.cred) return;
  S.quickBusy = true;
  try {
    const r = await GH.req('GET', GH.base() + '/issues?state=open&per_page=50&sort=created&direction=asc');
    if (!r.ok) { S.quickErr = r.status; return; }
    S.quickErr = null;
    const owner = String(GH.cred.owner || '').toLowerCase();
    const list = (await r.json()).filter(x => !x.pull_request && String(x.title || '').trim() === QUICK_TITLE && x.user && String(x.user.login || '').toLowerCase() === owner);
    if (!list.length) return;
    const recs = [], bals = {}, keep = [], close = [];
    for (const it of list) {
      const ts = Date.parse(it.created_at) || Date.now();
      const out = parseQuick(it.body || '', ts);
      close.push(it.number);
      if (out.ignore) continue;
      if (!out.recs || !out.recs.length) { keep.push({ n: it.number, ts, date: ds(new Date(ts)), text: maskRaw(smsClean(it.body)).slice(0, 600) }); continue; }
      out.recs.forEach((x, i) => { x.qf = 'issue:' + it.number + (i ? '/' + i : ''); x.id = rid(); recs.push(x); });
      if (out.bal && (!bals[out.bal.id] || bals[out.bal.id].ts < out.bal.ts)) bals[out.bal.id] = out.bal;
    }
    const byMonth = {};
    recs.forEach(x => { (byMonth[monthKey(x.date)] = byMonth[monthKey(x.date)] || []).push(x); });
    let added = 0, merged = 0, sum = 0;
    for (const mk of Object.keys(byMonth)) {
      let a = 0, m = 0, sm = 0;
      const next = await write('money/' + mk + '.json', d => {
        d.items = Array.isArray(d.items) ? d.items : []; a = 0; m = 0; sm = 0;
        for (const x of byMonth[mk]) {
          if (d.items.some(y => y.qf === x.qf)) continue;
          if (mergeSmsInto(d.items, x)) { m++; continue; }
          d.items.push(x); a++; if (x.kind === 'spend' || x.kind === 'cash') sm += x.amount;
        }
        return d;
      }, `Автозапись: ${byMonth[mk].length} ${plural(byMonth[mk].length, 'запись', 'записи', 'записей')}`, { items: [] });
      if (!next) return;
      S.money[mk] = next; added += a; merged += m; sum += sm;
    }
    const upd = Object.values(bals).filter(b => { const a = accounts().find(x => x.id === b.id && x.type === 'card'); return a && !(Number(a.ts) > b.ts); });
    if (upd.length) await writeConfig(cfg => { ((cfg.money || {}).accounts || []).forEach(a => { const b = upd.find(v => v.id === a.id); if (a.type === 'card' && b && !(Number(a.ts) > b.ts)) { a.balance = b.value; a.asOf = b.date; a.ts = b.ts + 1; } }); }, 'Автозапись: остаток по SMS');
    let kept = true;
    if (keep.length) kept = !!(await write('inbox/quick.json', d => { d.items = Array.isArray(d.items) ? d.items : []; keep.forEach(k => { if (!d.items.some(x => x.n === k.n)) d.items.push(k); }); return d; }, `Автозапись: не разобрал ${keep.length}`, { items: [] }));
    // закрываем только то, что сохранено; текст из issue стираем — он уже лежит в записи (с замаскированными номерами)
    for (const n of close) {
      if (!kept && keep.some(k => k.n === n)) continue;
      try { await GH.req('PATCH', GH.base() + '/issues/' + n, { state: 'closed', state_reason: 'completed', body: '' }); } catch (_) {}
    }
    cacheNow(); render();
    const bits = [];
    if (added) bits.push(`+${added} ${plural(added, 'запись', 'записи', 'записей')}${sum ? ' · ' + fmt(sum) + ' ' + curSym() : ''}`);
    if (merged) bits.push(`${merged} уже было — дополнил`);
    if (upd.length) bits.push('остаток обновлён');
    if (keep.length) bits.push(`${keep.length} не понял — разберёт Claude`);
    if (bits.length) toast('Автозапись: ' + bits.join(', '));
  } catch (e) { console.warn(e); }
  finally { S.quickBusy = false; }
}

/* ---------- money periods ---------- */
function pStartDay() { const p = Number(((S.config || {}).money || {}).periodStart || 1); return p >= 1 && p <= 28 ? p : 1; }
function periodOf(d) { const P = pStartDay(), x = pd(d); let m = x.getMonth(); if (x.getDate() < P) m -= 1; return ds(new Date(x.getFullYear(), m, P, 12)); }
function periodShift(start, n) { const x = pd(start); return ds(new Date(x.getFullYear(), x.getMonth() + n, x.getDate(), 12)); }
function periodEnd(start) { return addDays(periodShift(start, 1), -1); }
function periodLabel(start) {
  const x = pd(start);
  if (pStartDay() === 1) return MON_N[x.getMonth()] + ' ' + x.getFullYear();
  const e = pd(periodEnd(start));
  return `${x.getDate()} ${MON_S[x.getMonth()]} – ${e.getDate()} ${MON_S[e.getMonth()]}`;
}
function periodMonths(start) { const a = monthKey(start), b = monthKey(periodEnd(start)); return a === b ? [a] : [a, b]; }
function periodItems(start) {
  const end = periodEnd(start);
  let out = [];
  for (const mk of periodMonths(start)) { const d = S.money[mk]; if (d && Array.isArray(d.items)) out = out.concat(d.items.filter(x => x.date >= start && x.date <= end)); }
  return out;
}
function ensurePeriod() {
  const P = pStartDay();
  if (!S.period || S.periodP !== P) { S.period = periodOf(today()); S.periodP = P; }
}

/* ---------- loading ---------- */
function setSync(text, isErr) { const el = $('#sync'); el.textContent = text || ''; el.classList.toggle('err', !!isErr); }
function syncLabel() { return S.lastLoad ? 'обновлено в ' + hhmm(new Date(S.lastLoad)) : ''; }
function errText(e) {
  const c = e && e.code;
  if (c === 'offline') return 'Нет связи. Показаны сохранённые данные.';
  if (c === 'auth') return 'Ключ не подошёл или истёк. Подключись заново.';
  if (c === 'forbidden') return 'Нет прав на запись. Проверь права ключа: Contents — Read and write.';
  if (c === 'notfound') return 'Репозиторий не найден. Проверь имя и доступ ключа.';
  if (c === 'conflict') return 'Данные только что изменились. Обнови и повтори.';
  return 'GitHub не ответил. Попробуй ещё раз.';
}
function applyData(d) {
  if ('config' in d) S.config = d.config || null;
  if (d.lessons) S.lessons = Array.isArray(d.lessons.lessons) ? d.lessons.lessons : [];
  if (d.plan) { S.studyDays = d.plan.studyDays || {}; S.sportMoves = d.plan.sportMoves || {}; S.sportExtra = Array.isArray(d.plan.sportExtra) ? d.plan.sportExtra : []; S.duties = d.plan.duties || {}; S.absences = Array.isArray(d.plan.absences) ? d.plan.absences : []; S.studyLog = Array.isArray(d.plan.studyLog) ? d.plan.studyLog : []; }
  if (d.body) S.body = d.body && d.body.weight ? d.body : { weight: {} };
  if (d.ideas) S.ideas = Array.isArray(d.ideas.ideas) ? d.ideas.ideas : [];
  if (d.sleep) S.sleep = d.sleep && d.sleep.days ? d.sleep : { days: {} };
  if (d.curriculum) S.curriculum = d.curriculum && Array.isArray(d.curriculum.blocks) ? d.curriculum : { blocks: [] };
  if (d.learned) S.learned = d.learned.map || {};
  if (d.events) S.events = Array.isArray(d.events.events) ? d.events.events : [];
  if (d.recipes) S.recipes = Array.isArray(d.recipes.recipes) ? d.recipes.recipes : [];
  if (d.meals) S.meals = d.meals && d.meals.days ? d.meals : { days: {} };
  if (d.requests) S.requests = Array.isArray(d.requests.requests) ? d.requests.requests : [];
  if (d.reviews) S.reviews = Array.isArray(d.reviews.reviews) ? d.reviews.reviews : [];
  if (d.portfolio) S.portfolio = d.portfolio;
  if (d.money) S.money = Object.assign({}, S.money, d.money);
  if (d.workouts) S.workouts = Object.assign({}, S.workouts, d.workouts);
  if (Array.isArray(d.inbox)) S.inbox = d.inbox;
}
function cacheNow() {
  LS.set('bj-cache', { config: S.config, lessons: { lessons: S.lessons }, plan: { studyDays: S.studyDays, sportMoves: S.sportMoves, sportExtra: S.sportExtra, duties: S.duties, absences: S.absences, studyLog: S.studyLog }, body: S.body, learned: { map: S.learned }, events: { events: S.events }, recipes: { recipes: S.recipes }, meals: S.meals, requests: { requests: S.requests }, ideas: { ideas: S.ideas }, reviews: { reviews: S.reviews }, portfolio: S.portfolio, sleep: S.sleep, curriculum: S.curriculum, money: S.money, workouts: S.workouts, inbox: S.inbox, ts: S.lastLoad });
}
async function fetchMonths(prefix, keys, empty) {
  const res = await Promise.all(keys.map(k => GH.getJSON(prefix + k + '.json')));
  const out = {};
  keys.forEach((k, i) => { out[k] = res[i] || clone(empty); });
  return out;
}
async function loadAll(quiet) {
  if (S.loading || !GH.cred) return;
  S.loading = true; $('#btn-refresh').classList.add('busy');
  if (!quiet) setSync('обновляю…');
  try {
    GH.info().then(j => { if (j && j.private === false) { toast('Внимание: репозиторий с данными стал открытым! Сделай его приватным.'); setSync('Репозиторий с данными открытый — сделай приватным', true); } }).catch(() => {});
    const [config, lessons, plan, learned, events, inbox, recipes, meals, requests, ideas, sleep, curriculum, reviews, portfolio, body] = await Promise.all([
      GH.getJSON('config.json'), GH.getJSON('lessons.json'), GH.getJSON('plan.json'), GH.getJSON('learned.json'), GH.getJSON('events.json'), Promise.all([GH.list('inbox/photos'), GH.list('inbox/receipts')]).then(([a, b]) => a.concat(b)),
      GH.getJSON('recipes.json'), GH.getJSON('meals.json'), GH.getJSON('requests.json'), GH.getJSON('ideas.json'), GH.getJSON('sleep.json'), GH.getJSON('curriculum.json'), GH.getJSON('reviews.json'), GH.getJSON('portfolio.json'), GH.getJSON('body.json')
    ]);
    applyData({ config, lessons: lessons || { lessons: [] }, plan: plan || {}, learned: learned || {}, events: events || { events: [] }, recipes: recipes || { recipes: [] }, meals: meals || { days: {} }, requests: requests || { requests: [] }, ideas: ideas || { ideas: [] }, sleep: sleep || { days: {} }, curriculum: curriculum || { blocks: [] }, reviews: reviews || { reviews: [] }, portfolio: portfolio || { projects: [], artifacts: [] }, body: body || { weight: {} }, inbox: inbox.filter(f => f.type === 'file' && !/^\./.test(f.name)).map(f => f.name) });
    ensurePeriod();
    const mks = Array.from(new Set(periodMonths(S.period).concat([monthKey(today())])));
    const wks = [monthKey(today()), monthShift(monthKey(today()), -1)];
    const [money, workouts] = await Promise.all([fetchMonths('money/', mks, { items: [] }), fetchMonths('workouts/', wks, { logs: {} })]);
    S.fresh = new Set(mks.map(k => 'money/' + k).concat(wks.map(k => 'workouts/' + k)));
    applyData({ money, workouts });
    S.ready = true; S.lastLoad = Date.now();
    cacheNow();
    setSync(syncLabel());
    if (!$('#tab-lessons').hidden) { S.notes = S.notes || null; loadNotes(true); }
    processQuick();
    checkNotesPushed();
    loadNotesDays();
    setTimeout(announceAchievements, 300);
  } catch (e) {
    console.warn(e);
    if (e.code === 'auth') showSetup('Ключ не подошёл или истёк. Вставь новый.');
    setSync(errText(e), true);
  } finally {
    S.loading = false; $('#btn-refresh').classList.remove('busy');
    render();
  }
}
// месяц считается свежим, только если в этой загрузке его уже скачали — иначе показывали бы старый кэш
async function ensureMoney(keys) {
  const miss = keys.filter(k => !S.fresh.has('money/' + k));
  if (!miss.length) return;
  try { applyData({ money: await fetchMonths('money/', miss, { items: [] }) }); miss.forEach(k => S.fresh.add('money/' + k)); }
  catch (e) { setSync(errText(e), true); miss.forEach(k => { if (!S.money[k]) S.money[k] = { items: [] }; }); }
}
async function ensureWorkouts(keys) {
  const miss = keys.filter(k => !S.fresh.has('workouts/' + k));
  if (!miss.length) return;
  try { applyData({ workouts: await fetchMonths('workouts/', miss, { logs: {} }) }); miss.forEach(k => S.fresh.add('workouts/' + k)); }
  catch (e) { miss.forEach(k => { if (!S.workouts[k]) S.workouts[k] = { logs: {} }; }); }
}

/* ---------- writes ---------- */
async function write(path, fn, msg, empty) {
  S.pending++; setSync('сохраняю…');
  try {
    const next = await GH.mutate(path, fn, msg, empty);
    S.pending--;
    setSync(S.pending ? 'сохраняю…' : 'сохранено в ' + hhmm(new Date()));
    return next || true;
  } catch (e) {
    S.pending--;
    console.warn(e);
    if (e.code === 'auth') showSetup('Ключ не подошёл или истёк. Вставь новый.');
    setSync(errText(e), true);
    toast('Не сохранилось. ' + errText(e));
    return null;
  }
}
async function writePlan(fn, msg) {
  const next = await write('plan.json', p => { p.studyDays = p.studyDays || {}; p.sportMoves = p.sportMoves || {}; p.sportExtra = Array.isArray(p.sportExtra) ? p.sportExtra : []; fn(p); return p; }, msg, { studyDays: {}, sportMoves: {}, sportExtra: [] });
  if (next) { S.studyDays = next.studyDays; S.sportMoves = next.sportMoves; S.sportExtra = next.sportExtra || []; S.duties = next.duties || {}; S.absences = next.absences || []; S.studyLog = next.studyLog || []; cacheNow(); render(); }
  return !!next;
}
async function writeIdeas(fn, msg) {
  const next = await write('ideas.json', d => { d.ideas = Array.isArray(d.ideas) ? d.ideas : []; fn(d.ideas); return d; }, msg, { ideas: [] });
  if (next) { S.ideas = next.ideas; cacheNow(); render(); }
  return !!next;
}
async function writeSleep(fn, msg) {
  const next = await write('sleep.json', d => { d.days = d.days || {}; fn(d.days); return d; }, msg, { days: {} });
  if (next) { S.sleep = next; cacheNow(); render(); }
  return !!next;
}
async function writeLessons(fn, msg) {
  const next = await write('lessons.json', d => { d.lessons = Array.isArray(d.lessons) ? d.lessons : []; fn(d.lessons); return d; }, msg, { lessons: [] });
  if (next) { S.lessons = next.lessons; cacheNow(); render(); }
  return !!next;
}
async function writeConfig(fn, msg) {
  const next = await write('config.json', c => { fn(c); return c; }, msg, {});
  if (next) { S.config = next; cacheNow(); render(); }
  return !!next;
}
async function writeEvents(fn, msg) {
  const next = await write('events.json', d => { d.events = Array.isArray(d.events) ? d.events : []; fn(d.events); return d; }, msg, { events: [] });
  if (next) { S.events = next.events; cacheNow(); render(); }
  return !!next;
}
async function writeRecipes(fn, msg) {
  const next = await write('recipes.json', d => { d.recipes = Array.isArray(d.recipes) ? d.recipes : []; fn(d.recipes); return d; }, msg, { recipes: [] });
  if (next) { S.recipes = next.recipes; cacheNow(); render(); }
  return !!next;
}
async function writeMeals(fn, msg) {
  const next = await write('meals.json', d => { d.days = d.days || {}; fn(d.days); return d; }, msg, { days: {} });
  if (next) { S.meals = next; cacheNow(); render(); }
  return !!next;
}
async function writeRequests(fn, msg) {
  const next = await write('requests.json', d => { d.requests = Array.isArray(d.requests) ? d.requests : []; fn(d.requests); return d; }, msg, { requests: [] });
  if (next) { S.requests = next.requests; cacheNow(); render(); }
  return !!next;
}
async function writeMonth(mk, fn, msg) {
  const next = await write('money/' + mk + '.json', d => { d.items = fn(Array.isArray(d.items) ? d.items : []); return d; }, msg, { items: [] });
  if (next) { S.money[mk] = next; S.fresh.add('money/' + mk); cacheNow(); renderMoney(); }
  return !!next;
}
async function writeLearned(name, cat) {
  const next = await write('learned.json', d => { d.map = d.map || {}; d.map[norm(name)] = cat; return d; }, 'Категории: запомнил «' + name + '»', { map: {} });
  if (next) { S.learned = next.map; cacheNow(); }
}
function setMove(p, id, patch) {
  const cur = Object.assign({}, p.sportMoves[id] || {}, patch);
  Object.keys(cur).forEach(k => {
    const v = cur[k];
    if (v === undefined || v === null || v === '' || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) || (Array.isArray(v) && !v.length)) delete cur[k];
  });
  if (Object.keys(cur).length) p.sportMoves[id] = cur; else delete p.sportMoves[id];
}

/* ---------- study planning ---------- */
const ord = l => { const o = Number(l.order != null ? l.order : l.n); return isNaN(o) ? 0 : o; };
function pendingSorted() { return S.lessons.filter(l => !l.done).sort((a, b) => ord(a) - ord(b) || (a.n || 0) - (b.n || 0)); }
function maxN() { return Math.max(10, ...S.lessons.map(l => Number(l.n) || 0)); }
function nextOrder() { return Math.max(0, ...S.lessons.map(ord)) + 1; }
function lessonTitle(L) { return 'Урок ' + L.n + (L.title ? ' · ' + L.title : ''); }
function studyCap(d, days) {
  days = days || S.studyDays;
  const st = S.config.study || {};
  const base = Number((st.slots || {})[String(dow(d))] || 0);
  const o = days[d];
  if (o && o.blocked) return { cap: 0, blocked: true, base };
  if (o && o.extra) return { cap: Number(o.extra), extra: true, base };
  return { cap: base, base };
}
function slotLabel(d, c) {
  if (c.extra) return dur(c.cap);
  const l = ((S.config.study || {}).labels || {})[String(dow(d))];
  return l || dur(c.cap);
}
function excused(d) { return !!(dutyOn(d) || absenceOn(d) || ((S.studyDays || {})[d] || {}).auto === 'duty'); }
function activity(d) { return S.lessons.some(l => l.done === d || (Array.isArray(l.progressDates) && l.progressDates.includes(d))); }
function buildStudy(days, endDate) {
  days = days || S.studyDays;
  const st = S.config.study || {};
  const t = today();
  let d = st.start && st.start > t ? st.start : t;
  const pending = pendingSorted().map(l => ({ key: l.id, doc: l, n: l.n, title: l.title || '', need: l.need ? Number(l.need) : null, rem: (Number(l.need) || 0) - (Number(l.progress) || 0), parts: 0 }));
  let nextN = maxN() + 1;
  const byDate = {}, first = {}, entries = [];
  let end = addDays(t, HORIZON);
  if (endDate && endDate > end) end = endDate;
  for (; d <= end; d = addDays(d, 1)) {
    const c = studyCap(d, days);
    if (c.blocked) { if (c.base > 0) (byDate[d] = byDate[d] || []).push({ blocked: true, date: d, cap: c.base }); continue; }
    if (c.cap <= 0) continue;
    if (!pending.length) { pending.push({ key: 'ph' + nextN, placeholder: true, n: nextN, title: '', need: null, rem: 0, parts: 0 }); nextN++; }
    const L = pending[0];
    L.parts++;
    const e = { date: d, L, cap: c.cap, part: L.parts, extra: !!c.extra, last: false };
    if (L.need == null) { e.last = true; pending.shift(); }
    else { L.rem -= c.cap; if (L.rem <= 0) { e.last = true; pending.shift(); } }
    entries.push(e);
    (byDate[d] = byDate[d] || []).push(e);
    if (!first[L.key]) first[L.key] = d;
  }
  const tot = {};
  entries.forEach(e => { tot[e.L.key] = (tot[e.L.key] || 0) + 1; });
  entries.forEach(e => { e.total = tot[e.L.key]; });
  return { byDate, first, entries };
}
function studyTails(n) {
  const t = today(), st = (S.config.study || {}).start || t;
  const out = [];
  let d = addDays(t, -n); if (d < st) d = st;
  for (; d < t; d = addDays(d, 1)) { const c = studyCap(d); if (c.blocked || c.cap <= 0) continue; if (activity(d)) continue; out.push(d); }
  return out;
}

/* ---------- sport planning ---------- */
function buildSport(fromD, toD) {
  const cfg = S.config.sport || {};
  const t = today();
  const from = fromD || addDays(t, -35), to = toD || addDays(t, HORIZON + 8);
  const list = [];
  if (!cfg.start || !Array.isArray(cfg.template)) return list;
  for (let w = mondayOf(from < cfg.start ? cfg.start : from); w <= to; w = addDays(w, 7)) {
    for (const tp of cfg.template) {
      const orig = addDays(w, (Number(tp.dow) + 6) % 7);
      if (orig < cfg.start) continue;
      const s = (cfg.sessions || {})[tp.key];
      if (!s) continue;
      const id = orig + '_' + tp.key;
      const ov = S.sportMoves[id] || {};
      const inst = { id, key: tp.key, orig, eff: ov.movedTo || orig, state: ov.state || null, note: ov.note || '', kind: s.kind, title: s.title || tp.key, sub: s.sub || '', ov };
      if (ov.as && cfg.sessions[ov.as]) { inst.title = cfg.sessions[ov.as].title; inst.sub = 'вместо: ' + (s.title || tp.key); inst.replaced = true; }
      else if (Array.isArray(ov.custom) && ov.custom.length) { inst.title = 'Своя тренировка'; inst.sub = ov.custom.join(' · '); inst.replaced = true; }
      list.push(inst);
    }
  }
  for (const x of S.sportExtra || []) {
    const ov = S.sportMoves[x.id] || {};
    const eff = ov.movedTo || x.date;
    if ((x.date < from || x.date > to) && (eff < from || eff > to)) continue;
    const s = (cfg.sessions || {})[x.key];
    const inst = { id: x.id, key: x.key, orig: x.date, eff, state: ov.state || null, note: ov.note || '', kind: s ? s.kind : 'other', title: s ? (s.title || x.key) : 'Своя тренировка', sub: s ? (s.sub || '') : '', ov, extra: true };
    if (ov.as && cfg.sessions[ov.as]) { inst.title = cfg.sessions[ov.as].title; inst.sub = 'вместо: ' + inst.title; inst.replaced = true; }
    else if (Array.isArray(ov.custom) && ov.custom.length) { inst.title = 'Своя тренировка'; inst.sub = ov.custom.join(' · '); inst.replaced = !!s; }
    inst.sub = (inst.sub ? inst.sub + ' · ' : '') + 'добавлена';
    list.push(inst);
  }
  return list;
}
function findInst(id) {
  let i = S.sportList.find(x => x.id === id);
  if (!i && /^\d{4}-\d{2}-\d{2}_/.test(id || '')) { const o = id.slice(0, 10); i = buildSport(addDays(o, -7), addDays(o, 7)).find(x => x.id === id); if (i) S.sportList.push(i); }
  return i || null;
}
function itemsToBlocks(items) { return (items || []).map(t => ({ ex: [{ name: String(t), log: 'check' }] })); }
function sessionFor(i) {
  const ses = (S.config.sport || {}).sessions || {};
  const ov = i.ov || {};
  let key = i.key, title = ses[i.key] ? ses[i.key].title : i.key, blocks, replaced = null;
  if (Array.isArray(ov.custom) && ov.custom.length) {
    blocks = ov.custom.map(n => ({ sets: 3, ex: [{ name: n, log: 'wr' }] }));
    title = 'Своя тренировка'; replaced = 'custom';
  } else {
    if (ov.as && ses[ov.as]) { key = ov.as; title = ses[ov.as].title; replaced = 'as'; }
    const s = ses[key] || {};
    blocks = clone(s.blocks || itemsToBlocks(s.items));
  }
  const swap = ov.swap || {};
  blocks.forEach((b, bi) => (b.ex || []).forEach((x, ei) => { const k = bi + '.' + ei; if (swap[k]) { x.orig = x.name; x.name = swap[k]; x.swapped = true; } }));
  return { key, title, blocks, replaced, note: (ses[key] || {}).note || '' };
}
function planMove(inst, target) {
  const list = S.sportList, t = today();
  const occ = (d, excl, virt) => list.filter(i => i.eff === d && i.state !== 'skipped' && !excl.includes(i.id)).concat(virt.filter(v => v.eff === d));
  const weekEnd = i => addDays(mondayOf(i.orig), 6);
  const find = (i, from, excl, virt) => {
    for (let d = from, k = 0; k < 14; d = addDays(d, 1), k++) {
      if (i.kind !== 'strength' && d > weekEnd(i)) return null;
      if (dutyOn(d)) continue;
      const o = occ(d, excl, virt);
      if (!o.length) return { date: d };
      if (i.kind === 'strength' && o.every(x => x.kind !== 'strength')) return { date: d, bump: o.find(x => x.id) || null };
    }
    return null;
  };
  let res;
  if (target) {
    const o = occ(target, [inst.id], []);
    res = { date: target };
    if (inst.kind === 'strength') { const c = o.find(x => x.kind !== 'strength'); if (c) res.bump = c; }
  } else {
    let from = addDays(inst.eff, 1); if (from < t) from = t;
    res = find(inst, from, [inst.id], []);
    if (!res) return null;
  }
  if (res.bump) {
    const b = res.bump;
    let from = addDays(b.eff, 1); if (from < t) from = t;
    if (from <= res.date) from = addDays(res.date, 1);
    const bt = find(b, from, [inst.id, b.id], [{ eff: res.date, kind: inst.kind }]);
    res.bumpTo = bt ? bt.date : null;
  }
  return res;
}

/* ---------- workout logs ---------- */
function logFor(i) { const w = S.workouts[monthKey(i.eff)]; return (w && w.logs && w.logs[i.id]) || null; }
function prevSets(key, name, before) {
  let best = null;
  for (const mk of Object.keys(S.workouts)) {
    const logs = (S.workouts[mk] || {}).logs || {};
    for (const id of Object.keys(logs)) {
      const L = logs[id];
      if (!L || L.key !== key || !(L.date < before)) continue;
      for (const b of L.blocks || []) for (const x of b.ex || []) {
        if (x.name === name && Array.isArray(x.sets) && x.sets.some(s => s && (s.w != null || s.r != null))) {
          if (!best || L.date > best.date) best = { date: L.date, sets: x.sets };
        }
      }
    }
  }
  return best;
}
const exSets = (x, b) => Number(x.sets || b.sets || 3);
function workoutForm(i, ses) {
  const log = logFor(i), draft = LS.get('bj-draft-' + i.id);
  const src = (draft && draft.blocks) || (log && log.blocks) || null;
  const val = (bi, ei) => (src && src[bi] && src[bi].ex && src[bi].ex[ei]) || null;
  let prevDate = null;
  const html = ses.blocks.map((b, bi) => {
    const ex = b.ex || [];
    const multi = ex.length > 1;
    const head = b.type ? `<div class="blk-h">${esc(b.type)}${b.sets ? ` · ${esc(b.sets)} ${plural(b.sets, 'круг', 'круга', 'кругов')}` : ''}</div>` : '';
    const names = ex.map((x, ei) => `<div class="exl"><span class="let">${multi ? LET[ei] : ''}</span><span class="rb"><span class="ex-name">${esc(x.name)}${x.swapped ? ' <span class="chip warn">замена</span>' : ''}</span>${x.hint ? `<span class="ex-hint">${esc(x.hint)}</span>` : ''}${x.swapped && x.orig ? `<span class="ex-hint">по программе: ${esc(x.orig)}</span>` : ''}${exSets(x, b) !== Number(b.sets || 3) && (x.log === 'wr' || x.log === 'r') ? `<span class="ex-hint">${exSets(x, b)} ${plural(exSets(x, b), 'подход', 'подхода', 'подходов')}</span>` : ''}</span>${ses.replaced === 'custom' ? '<span></span>' : `<button type="button" class="icon-btn sm" data-action="ex-swap" data-b="${bi}" data-e="${ei}" aria-label="Заменить упражнение">⇄</button>`}</div>
      <div class="swap-form" id="swf-${bi}-${ei}" hidden><input id="swi-${bi}-${ei}" placeholder="Чем заменить" value="${esc(x.swapped ? x.name : '')}"><div class="two"><button type="button" class="btn sm" data-action="ex-swap-once" data-b="${bi}" data-e="${ei}">Только в этот раз</button><button type="button" class="btn sm" data-action="ex-swap-perm" data-b="${bi}" data-e="${ei}">В программе навсегда</button></div>${x.swapped ? `<button type="button" class="btn sm" data-action="ex-unswap" data-b="${bi}" data-e="${ei}">Вернуть по программе</button>` : ''}</div>`).join('');
    let body = '';
    const wr = ex.map((x, ei) => ({ x, ei })).filter(o => o.x.log === 'wr' || o.x.log === 'r');
    if (wr.length) {
      const rounds = Math.max(...wr.map(o => exSets(o.x, b)));
      for (let r = 1; r <= rounds; r++) {
        const inR = wr.filter(o => r <= exSets(o.x, b));
        if (!inR.length) continue;
        body += '<div class="round">' + inR.map(o => {
          const v = val(bi, o.ei), s = (v && v.sets && v.sets[r - 1]) || {};
          const p = prevSets(ses.key, o.x.name, i.eff);
          if (p && (!prevDate || p.date > prevDate)) prevDate = p.date;
          const ps = (p && p.sets[r - 1]) || {};
          const lab = r + (multi ? LET[o.ei] : '');
          const rIn = `<input id="lg-${bi}-${o.ei}-${r}-r" inputmode="numeric" value="${esc(s.r != null ? s.r : '')}" placeholder="${esc(ps.r != null ? ps.r : 'повт')}" aria-label="${esc(o.x.name)}, подход ${r}, повторы">`;
          if (o.x.log === 'r') return `<div class="set r"><span class="sl">${lab}</span>${rIn}<span class="u">повт</span></div>`;
          return `<div class="set"><span class="sl">${lab}</span><input id="lg-${bi}-${o.ei}-${r}-w" inputmode="decimal" value="${esc(s.w != null ? s.w : '')}" placeholder="${esc(ps.w != null ? ps.w : 'кг')}" aria-label="${esc(o.x.name)}, подход ${r}, вес"><span class="u">кг ×</span>${rIn}<span class="u">повт</span></div>`;
        }).join('') + '</div>';
      }
    }
    ex.forEach((x, ei) => {
      const v = val(bi, ei);
      if (x.log === 'check') body += `<label class="chk"><input type="checkbox" id="lg-${bi}-${ei}-c"${v && v.done ? ' checked' : ''}> ${multi ? LET[ei] + ': ' : ''}сделано</label>`;
      else if (x.log === 'note') body += `<input class="note-in" id="lg-${bi}-${ei}-n" value="${esc((v && v.note) || '')}" placeholder="${esc(x.ph || 'заметка')}" aria-label="${esc(x.name)}">`;
    });
    return `<div class="blk">${head}${names}${body ? `<div class="sets">${body}</div>` : ''}</div>`;
  }).join('');
  const info = [];
  if (prevDate) info.push(`Серые цифры — прошлый раз, ${short(prevDate)}.`);
  if (draft) info.push('Есть несохранённые подходы — они подставлены.');
  else if (log) info.push('Подходы сохранены ' + (log.ts ? hhmm(new Date(log.ts)) + ', ' : '') + short(log.date) + '.');
  return html + (info.length ? `<p class="note">${info.join(' ')}</p>` : '');
}
function collectLog(ses) {
  let any = false;
  const blocks = ses.blocks.map((b, bi) => ({ type: b.type || '', ex: (b.ex || []).map((x, ei) => {
    const o = { name: x.name, log: x.log || 'check' };
    if (o.log === 'wr' || o.log === 'r') {
      const sets = [];
      for (let r = 1; r <= exSets(x, b); r++) {
        const we = document.getElementById(`lg-${bi}-${ei}-${r}-w`), re = document.getElementById(`lg-${bi}-${ei}-${r}-r`);
        const w = we ? numOrNull(we.value) : null, rr = re ? numOrNull(re.value) : null;
        if (w == null && rr == null) sets.push(null);
        else { any = true; const s = {}; if (w != null) s.w = w; if (rr != null) s.r = rr; sets.push(s); }
      }
      while (sets.length && sets[sets.length - 1] == null) sets.pop();
      o.sets = sets;
    } else if (o.log === 'check') {
      const c = document.getElementById(`lg-${bi}-${ei}-c`); o.done = !!(c && c.checked); if (o.done) any = true;
    } else if (o.log === 'note') {
      const n = document.getElementById(`lg-${bi}-${ei}-n`); o.note = n ? n.value.trim() : ''; if (o.note) any = true;
    }
    return o;
  }) }));
  return { blocks, any };
}
async function saveLog(i, ses, blocks) {
  const mk = monthKey(i.eff);
  const next = await write('workouts/' + mk + '.json', d => { d.logs = d.logs || {}; d.logs[i.id] = { date: i.eff, key: ses.key, title: ses.title, blocks, ts: Date.now() }; return d; }, `Тренировка ${i.eff}: ${ses.title}`, { logs: {} });
  if (next) { S.workouts[mk] = next; LS.del('bj-draft-' + i.id); cacheNow(); }
  return !!next;
}

/* ---------- stats ---------- */
function calcStats(sport) {
  const t = today(), from = addDays(t, -27);
  const due = sport.filter(i => i.eff >= from && (i.eff < t || (i.eff === t && (i.state === 'done' || i.state === 'other'))));
  const done = due.filter(i => i.state === 'done' || i.state === 'other').length;
  const les = S.lessons.filter(l => l.done && l.done >= from && l.done <= t).length;
  let skips = 0;
  const st = (S.config.study || {}).start || t;
  for (let d = from > st ? from : st; d < t; d = addDays(d, 1)) {
    const c = studyCap(d);
    if (excused(d) && !activity(d)) continue;
    if (c.blocked) { if (c.base > 0) skips++; continue; }
    if (c.cap <= 0) continue;
    if (!activity(d)) skips++;
  }
  return { done, due: due.length, les, skips };
}

/* ---------- render ---------- */
function isReady() { return S.ready && S.config && S.config.study && S.config.sport; }
function bannerHtml() {
  if (!S.ready) return '<p class="loading"><span class="spin" aria-hidden="true"></span>Загружаю журнал…</p>';
  return '<div class="callout">Журнал ещё не настроен: в репозитории нет расписания (config.json). Попроси Claude заполнить его.</div>';
}
function render() {
  const t = today();
  $('#today-label').textContent = DOW_S[dow(t)] + ', ' + pd(t).getDate() + ' ' + MON_G[pd(t).getMonth()];
  renderPlan(); renderCal(); renderLessons(); renderFood(); renderMoney();
  renderClaudeBtn();
  renderDayChip();
  renderTimerChip();
}
const REP_EVERY1 = { day: 'каждый день', week: 'каждую неделю', month: 'каждый месяц', year: 'каждый год' };
const REP_FORMS = { day: ['день', 'дня', 'дней'], week: ['неделю', 'недели', 'недель'], month: ['месяц', 'месяца', 'месяцев'], year: ['год', 'года', 'лет'] };
function repeatLabel(rep) {
  if (!rep || !REP_FORMS[rep.unit]) return '';
  const n = Math.max(1, Number(rep.n) || 1);
  return n === 1 ? REP_EVERY1[rep.unit] : `раз в ${n} ${plural(n, ...REP_FORMS[rep.unit])}`;
}
function stepDate(base, unit, k) {
  if (unit === 'day') return addDays(base, k);
  if (unit === 'week') return addDays(base, 7 * k);
  const x = pd(base), months = unit === 'year' ? 12 * k : k;
  const y = x.getFullYear(), m = x.getMonth() + months;
  const last = new Date(y, m + 1, 0).getDate();
  return ds(new Date(y, m, Math.min(x.getDate(), last), 12));
}
function occurrences(ev, from, to) {
  if (!ev.date) return [];
  if (!ev.repeat || !REP_FORMS[ev.repeat.unit]) return ev.date >= from && ev.date <= to ? [ev.date] : [];
  const n = Math.max(1, Number(ev.repeat.n) || 1), out = [];
  for (let k = 0, d = ev.date; d <= to && k < 3000; k++, d = stepDate(ev.date, ev.repeat.unit, n * k)) {
    if (ev.until && d > ev.until) break;
    if (d >= from) out.push(d);
  }
  return out;
}
function nextOccurrence(ev, from) { const o = occurrences(ev, from, addDays(from, 3700)); return o[0] || null; }
function eventsOn(d) {
  const out = [];
  for (const e of S.events) if (occurrences(e, d, d).length) out.push({ ev: e, date: d, done: Array.isArray(e.done) && e.done.includes(d) });
  return out.sort((a, b) => (a.ev.time || '') < (b.ev.time || '') ? -1 : (a.ev.time || '') > (b.ev.time || '') ? 1 : 0);
}
function rowEvent(o) {
  const ev = o.ev, rep = repeatLabel(ev.repeat);
  return `<button type="button" class="row slim${o.done ? ' is-done' : ''}" data-action="event" data-id="${esc(ev.id)}" data-date="${o.date}"><span class="tag event">Событие</span><span class="rb"><span class="t ev-t">${esc(ev.title)}</span>${rep ? `<span class="m">↻ ${esc(rep)}</span>` : ''}</span><span class="s">${o.done ? '<span class="chip good">✓</span> ' : ''}${ev.time ? esc(ev.time) : 'весь день'}</span></button>`;
}
function rowStudy(e) {
  const L = e.L;
  const meta = [slotLabel(e.date, { cap: e.cap, extra: e.extra })];
  if (e.total > 1) meta.push('часть ' + e.part + ' из ' + e.total);
  if (e.extra) meta.push('доп. окно');
  if (L.placeholder) meta.push('тема не задана');
  const was = S.shift[L.key] && e.part === 1 && S.shift[L.key] !== e.date ? `<span class="chip warn">было ${short(S.shift[L.key])}</span>` : '';
  return `<button type="button" class="row" data-action="study" data-date="${e.date}" data-key="${esc(L.key)}" data-part="${e.part}"><span class="tag study">Учёба</span><span class="rb"><span class="t">${esc(lessonTitle(L))}</span><span class="m">${esc(meta.join(' · '))}</span></span><span class="s">${was}</span></button>`;
}
function rowBlocked(e) {
  return `<button type="button" class="row ghost" data-action="day" data-date="${e.date}"><span class="tag study dim">Учёба</span><span class="rb"><span class="t strike">Окно снято</span><span class="m">${esc(dur(e.cap))} · уроки ушли дальше</span></span><span class="s">вернуть</span></button>`;
}
function rowSport(i) {
  let chip = '', cls = '', meta = i.sub;
  if (i.state === 'done') { chip = '<span class="chip good">✓ сделано</span>'; cls = ' is-done'; }
  else if (i.state === 'other') { chip = '<span class="chip good">✓ другое</span>'; cls = ' is-done'; meta = i.note || 'сделал другое'; }
  else if (i.state === 'skipped') { chip = '<span class="chip">пропуск</span>'; cls = ' is-skipped'; }
  else if (i.eff !== i.orig) chip = `<span class="chip warn">с ${short(i.orig)}</span>`;
  else if (i.replaced) chip = '<span class="chip warn">замена</span>';
  return `<button type="button" class="row${cls}" data-action="sport" data-id="${esc(i.id)}"><span class="tag sport">Спорт</span><span class="rb"><span class="t">${esc(i.title)}</span><span class="m">${esc(meta)}</span></span><span class="s">${chip}</span></button>`;
}
function rowGhost(i) {
  return `<button type="button" class="row ghost" data-action="sport" data-id="${esc(i.id)}"><span class="tag sport dim">Спорт</span><span class="rb"><span class="t">${esc(i.title)}</span><span class="m">${i.state === 'skipped' ? 'перенесено и пропущено' : 'перенесено'}</span></span><span class="s"><span class="chip warn">→ ${short(i.eff)}</span></span></button>`;
}
function dayRows(d, study, sport) {
  const rows = scheduleRows(d);
  const evs = eventsOn(d);
  evs.filter(e => !e.ev.time).forEach(e => rows.push(rowEvent(e)));
  evs.filter(e => e.ev.time).forEach(e => rows.push(rowEvent(e)));
  for (const e of (study.byDate[d] || [])) rows.push(e.blocked ? rowBlocked(e) : rowStudy(e));
  for (const i of sport) if (i.eff === d) rows.push(rowSport(i));
  for (const i of sport) if (i.orig === d && i.eff !== d) rows.push(rowGhost(i));
  regularRows(d).forEach(r => rows.push(r));
  plannedRows(d).forEach(r => rows.push(r));
  return rows;
}
/* ---------- sleep ---------- */
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
function toMin(hm) { const m = /^(\d{1,2}):(\d{2})$/.exec(hm || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
function sleepMin(s) { if (!s) return null; const a = toMin(s.bed), b = toMin(s.wake); if (a == null || b == null) return null; return (b - a + 1440) % 1440 || null; }
function hm(min) { const h = Math.floor(min / 60), m = min % 60; return h + ' ч' + (m ? ' ' + m + ' мин' : ''); }
function sleepAvg(days) {
  const t = today(); let sum = 0, n = 0;
  for (let k = 0; k < days; k++) { const v = sleepMin((S.sleep.days || {})[addDays(t, -k)]); if (v) { sum += v; n++; } }
  return n ? { avg: Math.round(sum / n), n } : null;
}
function renderSleep() {
  const box = $('#plan-sleep');
  if (!S.ready) { box.innerHTML = ''; return; }
  const t = today(), s = (S.sleep.days || {})[t], m = sleepMin(s), a = sleepAvg(7);
  box.innerHTML = `<button type="button" class="sleep-card" data-action="sleep" data-date="${t}"><span class="sleep-ic">${MOON}</span><span class="rb"><span class="t">${m ? `Сон: ${esc(s.bed)} → ${esc(s.wake)} · ${hm(m)}` : 'Как спал этой ночью?'}</span><span class="m">${a ? `в среднем за неделю ${hm(a.avg)} (${a.n} ${plural(a.n, 'ночь', 'ночи', 'ночей')})` : 'Отметь, во сколько лёг и встал'}</span></span><span class="s">${m ? 'изменить' : 'отметить'}</span></button>`;
}
function openSleep(d) {
  const s = (S.sleep.days || {})[d] || {};
  S.cur = { type: 'sleep', d };
  openSheet(`<h2 class="sh-title">Сон · ночь на ${esc(longDate(d))}</h2>
    <div class="two"><div><label class="fld" for="sl-bed">Лёг</label><input type="time" id="sl-bed" value="${esc(s.bed || '')}"></div><div><label class="fld" for="sl-wake">Встал</label><input type="time" id="sl-wake" value="${esc(s.wake || '')}"></div></div>
    <label class="fld" for="sl-note">Заметка (необязательно)</label><input id="sl-note" value="${esc(s.note || '')}" placeholder="Например: просыпался, наряд">
    <p class="note" id="sl-dur"></p>
    <div class="sh-acts"><button type="button" class="btn study block" data-action="sleep-save">Сохранить</button>${s.bed ? '<button type="button" class="btn danger block" data-action="sleep-del">Удалить</button>' : ''}</div>`);
  sleepDurNote();
}
function sleepDurNote() {
  const el = $('#sl-dur'); if (!el) return;
  const m = sleepMin({ bed: $('#sl-bed').value, wake: $('#sl-wake').value });
  el.textContent = m ? 'Получается ' + hm(m) + '.' : 'Дата — день, когда проснулся.';
}

/* ---------- праздники РФ (производственный календарь; 2027 — Постановление Правительства от 17.09.2026 № 1187) ---------- */
const HOLI = {
  '2026-11-04': 'День народного единства', '2026-12-31': 'Выходной',
  '2027-01-01': 'Новый год', '2027-01-02': 'Новогодние каникулы', '2027-01-03': 'Новогодние каникулы', '2027-01-04': 'Новогодние каникулы', '2027-01-05': 'Новогодние каникулы', '2027-01-06': 'Новогодние каникулы', '2027-01-07': 'Рождество', '2027-01-08': 'Новогодние каникулы',
  '2027-02-22': 'Выходной', '2027-02-23': 'День защитника Отечества', '2027-03-08': '8 Марта',
  '2027-05-01': 'Праздник Весны и Труда', '2027-05-03': 'Выходной', '2027-05-09': 'День Победы', '2027-05-10': 'Выходной',
  '2027-06-12': 'День России', '2027-06-14': 'Выходной', '2027-11-04': 'День народного единства', '2027-11-05': 'Выходной', '2027-12-31': 'Выходной'
};
const WORK_SAT = { '2027-02-20': true };
function holiday(d) { return HOLI[d] || null; }
function isWorkday(d) { if (WORK_SAT[d]) return true; const w = dow(d); return w >= 1 && w <= 5 && !HOLI[d]; }

/* ---------- наряды, отпуск, больничный ---------- */
function dutyOn(d) { return (S.duties || {})[d] || null; }
function afterDuty(d) { return !!dutyOn(addDays(d, -1)); }
// подготовка: накануне наряда с пн–пт (день перед ним), для наряда в сб или вс — пятница
function dutyPrep(d) {
  const n1 = addDays(d, 1), n2 = addDays(d, 2);
  if (dutyOn(n1)) { const w = dow(n1); if (w >= 1 && w <= 5) return n1; if (dow(d) === 5) return n1; }
  if (dow(d) === 5 && dutyOn(n2) && dow(n2) === 0) return n2;
  return null;
}
function absenceOn(d) { return (S.absences || []).find(a => d >= a.from && d <= a.to) || null; }
const ABS = { vacation: 'Отпуск', sick: 'Болею' };
function scheduleRows(d) {
  const rows = [], h = holiday(d), a = absenceOn(d), du = dutyOn(d), pr = dutyPrep(d);
  if (h) rows.push(`<div class="row slim"><span class="tag hol">Праздник</span><span class="rb"><span class="t">${esc(h)}</span></span></div>`);
  if (a) rows.push(`<button type="button" class="row slim" data-action="absence" data-id="${esc(a.id)}"><span class="tag abs">${ABS[a.type] || 'Отпуск'}</span><span class="rb"><span class="t">${dm(a.from)} – ${dm(a.to)}</span>${a.note ? `<span class="m">${esc(a.note)}</span>` : ''}</span></button>`);
  if (du) rows.push(`<button type="button" class="row slim" data-action="day" data-date="${d}"><span class="tag duty">Наряд</span><span class="rb"><span class="t">08:30 → 09:00 ${dm(addDays(d, 1))}</span><span class="m">${isWorkday(d) ? 'Обед в столовой, ужин взять с собой' : 'Столовая закрыта — еду с собой'}</span></span></button>`);
  if (pr) rows.push(`<div class="row slim"><span class="tag duty soft">Подготовка</span><span class="rb"><span class="t">После обеда свободно</span><span class="m">Наряд ${short(pr)}${isWorkday(d) ? ' · пообедать в столовой и уйти' : ''}</span></span></div>`);
  if (afterDuty(d)) rows.push(`<div class="row slim"><span class="tag duty soft">После наряда</span><span class="rb"><span class="t">Свободен с 09:00</span></span></div>`);
  return rows;
}
async function setDuty(d, on) {
  const ok = await writePlan(p => {
    p.duties = p.duties || {};
    if (!on) {
      const rec = p.duties[d] || {}; delete p.duties[d];
      if (rec.study && p.studyDays[d] && p.studyDays[d].auto === 'duty') delete p.studyDays[d];
      Object.entries(rec.prev || {}).forEach(([id, prev]) => { const m = p.sportMoves[id]; if (m && m.auto === 'duty') { if (prev) p.sportMoves[id] = prev; else delete p.sportMoves[id]; } });
      return;
    }
    const rec = { prev: {} };
    const c = studyCap(d, p.studyDays);
    if (c.base > 0 && !p.studyDays[d]) { p.studyDays[d] = { blocked: true, reason: 'Наряд', auto: 'duty' }; rec.study = true; }
    S.duties = Object.assign({}, p.duties, { [d]: rec });
    S.sportList = buildSport();
    const keep = id => { if (!(id in rec.prev)) rec.prev[id] = p.sportMoves[id] ? clone(p.sportMoves[id]) : null; };
    for (const i of S.sportList.filter(x => x.eff === d && !x.state)) {
      const res = planMove(i);
      keep(i.id);
      if (!res) { setMove(p, i.id, { state: 'skipped', reason: 'Наряд — в эту неделю не влезает', auto: 'duty' }); continue; }
      setMove(p, i.id, { movedTo: res.date, reason: 'Наряд', auto: 'duty' });
      if (res.bump) { keep(res.bump.id); setMove(p, res.bump.id, res.bumpTo ? { movedTo: res.bumpTo, reason: 'Наряд', auto: 'duty' } : { state: 'skipped', reason: 'Наряд — кардио не влезло в неделю', auto: 'duty' }); }
    }
    p.duties[d] = rec;
  }, on ? `Наряд ${d}` : `Наряд ${d} снят`);
  if (ok) { closeSheet(); toast(on ? 'Наряд добавлен — план подстроен' : 'Наряд снят'); }
}
function openAbsence(id, d) {
  const a = id ? (S.absences || []).find(x => x.id === id) : { id: null, type: 'vacation', from: d || today(), to: d || today(), note: '' };
  if (!a) return;
  S.cur = { type: 'absence', a };
  openSheet(`<h2 class="sh-title">${id ? ABS[a.type] : 'Отпуск или больничный'}</h2>
    <div class="seg" role="group">${Object.keys(ABS).map(k => `<button type="button" data-action="abs-type" data-type="${k}" aria-pressed="${a.type === k}">${ABS[k]}</button>`).join('')}</div>
    <div class="two"><div><label class="fld" for="ab-from">С</label><input type="date" id="ab-from" value="${esc(a.from)}"></div><div><label class="fld" for="ab-to">По</label><input type="date" id="ab-to" value="${esc(a.to)}"></div></div>
    <label class="fld" for="ab-note">Заметка</label><input id="ab-note" value="${esc(a.note || '')}">
    <div class="sh-acts"><button type="button" class="btn block primary" data-action="abs-save">Сохранить</button>${id ? '<button type="button" class="btn danger block" data-action="abs-del">Удалить</button>' : ''}</div>`);
}
async function absenceSave(del) {
  const c = S.cur; if (!c || c.type !== 'absence') return;
  if (del) { if (await writePlan(p => { p.absences = (p.absences || []).filter(x => x.id !== c.a.id); }, 'Отпуск/больничный удалён')) { closeSheet(); toast('Удалено'); } return; }
  const from = $('#ab-from').value, to = $('#ab-to').value;
  if (!from || !to || to < from) { toast('Проверь даты'); return; }
  const rec = { id: c.a.id || 'a' + rid().slice(0, 6), type: c.a.type, from, to };
  const note = $('#ab-note').value.trim(); if (note) rec.note = note;
  if (await writePlan(p => { const l = p.absences = p.absences || []; const k = l.findIndex(x => x.id === rec.id); if (k >= 0) l[k] = rec; else l.push(rec); }, `${ABS[rec.type]} ${from}–${to}`)) { closeSheet(); toast('Сохранено'); }
}

/* ---------- столовая: наличные на обеды до зарплаты ---------- */
function canteenMeals(from, to) {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (absenceOn(d)) continue;
    if (dutyOn(d)) { if (isWorkday(d)) n += 2; continue; }
    if (afterDuty(d)) continue;
    if (isWorkday(d)) n++;
  }
  return n;
}
function canteenInfo() {
  const cfg = moneyCfg().canteen; if (!cfg || !cfg.price) return null;
  const t = today(), start = periodOf(t), end = periodEnd(start);
  const meals = canteenMeals(t, end);
  const cash = sumAmt(periodItems(start).filter(x => kindOf(x) === 'cash'));
  const cashReg = regulars().filter(r => r.cash).reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const eaten = canteenMeals(start, addDays(t, -1));
  const left = Math.max(0, cash - Math.min(cash, cashReg) - eaten * cfg.price);
  return { price: cfg.price, meals, need: meals * cfg.price, cashLeft: left, end };
}

/* ---------- учёба: реальные часы (RSS) против плана (VSZ) ---------- */
function studyLog() { return S.studyLog || []; }
function lessonActual(n) { return studyLog().filter(x => String(x.n) === String(n)).reduce((a, x) => a + (Number(x.min) || 0), 0); }
function studyMinutes(from, to) { return studyLog().filter(x => x.date >= from && x.date <= to).reduce((a, x) => a + (Number(x.min) || 0), 0); }
function plannedMinutes(from, to) {
  const t = today(), st = (S.config.study || {}).start || from; let m = 0;
  for (let d = from > st ? from : st; d <= to && d <= t; d = addDays(d, 1)) { const c = studyCap(d); if (!c.blocked) m += c.cap; }
  return m;
}
const hmShort = min => { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return h ? h + ' ч' + (m ? ' ' + m : '') : m + ' мин'; };
function timerState() { return LS.get('bj-timer'); }
function renderTimerChip() {
  const el = $('#timer-chip'); if (!el) return;
  const tm = timerState();
  if (!tm) { el.hidden = true; return; }
  el.hidden = false;
  const s = Math.floor((Date.now() - tm.start) / 1000);
  el.textContent = `⏱ ${Math.floor(s / 3600) ? Math.floor(s / 3600) + ':' : ''}${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}
setInterval(renderTimerChip, 1000);
function timerStart(n) { LS.set('bj-timer', { start: Date.now(), n: n || null }); renderTimerChip(); closeSheet(); toast('Время пошло'); }
function openTimerStop() {
  const tm = timerState(); if (!tm) return;
  const min = Math.max(1, Math.round((Date.now() - tm.start) / 60000));
  S.cur = { type: 'timer', min, n: tm.n };
  openSheet(`<h2 class="sh-title">⏱ ${hmShort(min)}</h2>${tm.n ? `<p class="sh-meta">Урок ${esc(tm.n)}</p>` : ''}
    <div class="sh-acts"><button type="button" class="btn study block" data-action="timer-save" data-done="1">Сохранить и отметить урок</button><button type="button" class="btn block" data-action="timer-save">Только сохранить время</button><button type="button" class="btn danger block" data-action="timer-cancel">Сбросить</button></div>`);
}
async function logStudy(min, n, date, src) {
  return writePlan(p => { const l = p.studyLog = p.studyLog || []; l.push({ date: date || today(), n: n || null, min: Math.round(min), src: src || 'timer' }); }, `Учёба: ${Math.round(min)} мин по факту`);
}
function openActual(n, date, planned) {
  S.cur = { type: 'actual', n, date };
  openSheet(`<h2 class="sh-title">Сколько по факту?</h2><p class="sh-meta">Урок ${esc(n)} · план ${hmShort(planned || 60)}</p>
    <div class="chips-row">${[30, 45, 60, 75, 90, 120, 150].map(m => `<button type="button" class="btn" data-action="actual-set" data-min="${m}">${hmShort(m)}</button>`).join('')}</div>
    <div class="sh-acts"><button type="button" class="btn block" data-action="close">Пропустить</button></div>`);
}

/* ---------- вес тела ---------- */
function weights() { return (S.body && S.body.weight) || {}; }
function lastWeight(before) { const k = Object.keys(weights()).filter(d => !before || d <= before).sort(); return k.length ? { date: k[k.length - 1], kg: weights()[k[k.length - 1]] } : null; }
function openWeight(d) {
  d = d || today();
  const cur = weights()[d], lw = lastWeight();
  S.cur = { type: 'weight', d };
  openSheet(`<h2 class="sh-title">Вес тела · ${esc(dm(d))}</h2>${lw && lw.date !== d ? `<p class="sh-meta">Прошлый раз ${String(lw.kg).replace('.', ',')} кг · ${dm(lw.date)}</p>` : ''}
    <input id="bw-kg" inputmode="decimal" value="${cur != null ? String(cur).replace('.', ',') : ''}" placeholder="например, 78,4" aria-label="Вес, кг">
    <div class="sh-acts"><button type="button" class="btn sport block" data-action="weight-save">Сохранить</button>${cur != null ? '<button type="button" class="btn danger block" data-action="weight-del">Удалить</button>' : ''}</div>`);
}
async function weightSave(del) {
  const c = S.cur; if (!c || c.type !== 'weight') return;
  const kg = numOrNull($('#bw-kg') && $('#bw-kg').value);
  if (!del && !(kg > 30 && kg < 250)) { toast('Впиши вес в кг'); return; }
  const next = await write('body.json', b => { b.weight = b.weight || {}; if (del) delete b.weight[c.d]; else b.weight[c.d] = Math.round(kg * 10) / 10; return b; }, del ? 'Вес тела удалён' : `Вес тела ${kg} кг`, { weight: {} });
  if (next) { S.body = next; cacheNow(); closeSheet(); render(); toast('Сохранено'); }
}

/* ---------- будущие покупки ---------- */
function plannedBuys() { return moneyCfg().planned || []; }
function plannedRows(d) { return plannedBuys().filter(x => x.date === d && !x.done).map(x => `<button type="button" class="row slim" data-action="buy" data-id="${esc(x.id)}"><span class="tag pay">Покупка</span><span class="rb"><span class="t">${esc(x.name)}</span>${x.note ? `<span class="m">${esc(x.note)}</span>` : ''}</span><span class="s">${x.amount ? fmt(x.amount) + ' ' + esc(curSym()) : ''}</span></button>`); }
function openBuy(id) {
  const x = id ? plannedBuys().find(y => y.id === id) : { id: null, name: '', amount: '', date: '', note: '' };
  if (!x) return;
  S.cur = { type: 'buy', x };
  openSheet(`<h2 class="sh-title">${id ? esc(x.name) : 'Будущая покупка'}</h2>
    <label class="fld" for="by-name">Что</label><input id="by-name" value="${esc(x.name)}">
    <div class="two"><div><label class="fld" for="by-amount">Сумма</label><input id="by-amount" inputmode="decimal" value="${esc(x.amount || '')}"></div><div><label class="fld" for="by-date">Когда</label><input type="date" id="by-date" value="${esc(x.date || '')}"></div></div>
    <label class="fld" for="by-note">Заметка</label><input id="by-note" value="${esc(x.note || '')}">
    <div class="sh-acts"><button type="button" class="btn money block" data-action="buy-save">Сохранить</button>${id ? `<button type="button" class="btn block" data-action="buy-done">${x.done ? 'Вернуть в планы' : 'Купил ✓'}</button><button type="button" class="btn danger block" data-action="buy-del">Удалить</button>` : ''}</div>`);
}
async function buySave(mode) {
  const c = S.cur; if (!c || c.type !== 'buy') return;
  let ok;
  if (mode === 'del') ok = await writeConfig(cfg => { cfg.money.planned = (cfg.money.planned || []).filter(y => y.id !== c.x.id); }, `Покупки: удалено «${c.x.name}»`);
  else if (mode === 'done') ok = await writeConfig(cfg => { const y = (cfg.money.planned || []).find(z => z.id === c.x.id); if (y) { if (y.done) delete y.done; else y.done = today(); } }, `Покупки: «${c.x.name}»`);
  else {
    const name = $('#by-name').value.trim(), amount = numOrNull($('#by-amount').value), date = $('#by-date').value, note = $('#by-note').value.trim();
    if (!name) { toast('Напиши, что купить'); return; }
    const rec = Object.assign({}, c.x, { id: c.x.id || 'b' + rid().slice(0, 6), name });
    if (amount > 0) rec.amount = Math.round(amount); else delete rec.amount;
    if (date) rec.date = date; else delete rec.date;
    if (note) rec.note = note; else delete rec.note;
    ok = await writeConfig(cfg => { cfg.money = cfg.money || {}; const l = cfg.money.planned = cfg.money.planned || []; const k = l.findIndex(y => y.id === rec.id); if (k >= 0) l[k] = rec; else l.push(rec); }, `Покупки: «${name}»`);
  }
  if (ok) { closeSheet(); toast('Сохранено'); }
}
function plannedHtml() {
  const l = plannedBuys().filter(x => !x.done).sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  const total = l.reduce((a, x) => a + (Number(x.amount) || 0), 0);
  return `<details class="regs"${l.length ? ' open' : ''}><summary><span class="rs-t">Будущие покупки</span><span class="sec-note">${l.length ? fmt(total) + ' ' + esc(curSym()) : 'пусто'}</span></summary><div class="stack">${l.map(x => `<button type="button" class="reg" data-action="buy" data-id="${esc(x.id)}"><span class="rn">${esc(x.name)}</span><span class="ra">${x.amount ? fmt(x.amount) + ' ' + esc(curSym()) : '—'}</span><span class="rw">${x.date ? dm(x.date) + (x.date >= today() ? ' · через ' + daysBetween(today(), x.date) + ' ' + plural(daysBetween(today(), x.date), 'день', 'дня', 'дней') : '') : 'без даты'}${x.note ? ' · ' + esc(x.note) : ''}</span></button>`).join('')}</div><button type="button" class="link-btn" data-action="buy-new">+ Покупка</button></details>`;
}
/* ---------- план денег: бюджет «на жизнь», регулярные платежи, цели ---------- */
function moneyCfg() { return (S.config && S.config.money) || {}; }
function moneyPlan() { return moneyCfg().plan || null; }
function regulars() { return moneyCfg().regular || []; }
function goals() { return moneyCfg().goals || []; }
function acctById(id) { return accounts().find(a => a.id === id) || null; }
function regularOf(x) {
  const k = kindOf(x); if (k !== 'spend' && k !== 'transfer') return null;
  const n = norm((x.name || '') + ' ' + (x.raw || ''));
  const c = regulars().filter(r => !r.cash && (r.match && r.match.length ? r.match : [r.name]).some(w => w && n.includes(norm(w))));
  if (c.length < 2) return c[0] || null;
  const amt = Number(x.amount) || 0;
  return c.slice().sort((a, b) => Math.abs((Number(a.amount) || 0) - amt) - Math.abs((Number(b.amount) || 0) - amt))[0];
}
function isLiving(x) { const p = moneyPlan() || {}; if (kindOf(x) === 'cash') return true; return kindOf(x) === 'spend' && !(p.fixedCats || []).includes(x.cat) && !regularOf(x); }
const sumAmt = list => list.reduce((a, x) => a + (Number(x.amount) || 0), 0);
function regularTotal() { return regulars().reduce((a, r) => a + (Number(r.amount) || 0), 0); }
function budgetNow() {
  const p = moneyPlan(); if (!p || !p.living) return null;
  const t = today(), start = periodOf(t), end = periodEnd(start);
  if (!periodMonths(start).every(mk => S.money[mk])) return null;
  const items = periodItems(start).filter(isLiving);
  const cashReg = regulars().filter(r => r.cash).reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const spent = sumAmt(items) - Math.min(cashReg, sumAmt(items.filter(x => kindOf(x) === 'cash'))), spentToday = sumAmt(items.filter(x => x.date === t && kindOf(x) !== 'cash'));
  const daysLeft = daysBetween(t, end) + 1;
  const todayCap = (p.living - (spent - spentToday)) / daysLeft;
  return { living: p.living, spent, left: p.living - spent, daysLeft, perDay: (p.living - spent) / daysLeft, todayCap, spentToday, start, end };
}
function renderDayChip() {
  const el = $('#day-chip'); if (!el) return;
  const b = S.ready ? budgetNow() : null;
  if (!b) { el.hidden = true; return; }
  el.hidden = false;
  const over = b.left < 0;
  el.classList.toggle('over', over);
  el.textContent = over ? `перерасход ${fmt(Math.round(-b.left))} ₽` : `${fmt(Math.max(0, Math.floor(b.perDay)))} ₽/день`;
  el.setAttribute('aria-label', over ? `Бюджет на жизнь превышен на ${fmt(Math.round(-b.left))} рублей` : `Можно тратить ${fmt(Math.floor(b.perDay))} рублей в день до ${dm(b.end)}`);
}
function nextDue(r, from) {
  if (!r.day) return null;
  const f = pd(from || today());
  for (let k = 0; k < 2; k++) {
    const y = f.getFullYear(), m = f.getMonth() + k;
    const last = new Date(y, m + 1, 0).getDate();
    const d = ds(new Date(y, m, Math.min(Number(r.day), last), 12));
    if (d >= (from || today())) return d;
  }
  return null;
}
function regularPaid(r) {
  const start = periodOf(today());
  if (r.cash) return periodItems(start).some(x => kindOf(x) === 'cash');
  return periodItems(start).some(x => regularOf(x) === r);
}
function freePerMonth() { const p = moneyPlan() || {}; return (Number(p.salary) || 0) - regularTotal() - (Number(p.living) || 0); }
// Помесячная прикидка: свободные деньги (+ ожидаемые разовые) идут сначала на кредитку, потом на долг Сбера, остальное — на цель накопления.
function simulatePlan() {
  const free = freePerMonth(); if (!(free > 0)) return null;
  const debts = goals().filter(g => g.type === 'debt').map(g => ({ g, a: acctById(g.acc) })).filter(o => o.a).map(o => ({ id: o.g.id, bal: Math.max(0, Number(o.a.balance) || 0), done: null }));
  const save = goals().filter(g => g.type === 'save').map(g => ({ g, a: acctById(g.acc) })).filter(o => o.a)[0];
  let car = save ? Number(save.a.balance) || 0 : 0, carDone = null;
  const exp = moneyCfg().expected || [];
  let pay = periodShift(periodOf(today()), 1);
  debts.forEach(d => { if (d.bal <= 0) d.done = today(); });
  for (let k = 0; k < 60; k++, pay = periodShift(pay, 1)) {
    const prev = periodShift(pay, -1);
    let cash = free + exp.filter(e => e.date && e.date > prev && e.date <= pay && e.date >= today()).reduce((a, e) => a + (Number(e.amount) || 0), 0)
      - plannedBuys().filter(x => !x.done && x.amount && (x.date ? x.date > prev && x.date <= pay && x.date >= today() : k === 0)).reduce((a, x) => a + Number(x.amount), 0);
    for (const d of debts) { if (d.bal <= 0) continue; const x = Math.min(d.bal, cash); d.bal -= x; cash -= x; if (d.bal <= 0.5 && !d.done) d.done = pay; }
    car += cash;
    if (save && save.g.target && !carDone && car >= save.g.target) carDone = pay;
    if (debts.every(d => d.done) && (!save || !save.g.target || carDone)) break;
  }
  return { free, debts, carDone, save };
}
const MON_P = ['январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре'];
const monthName = d => MON_P[pd(d).getMonth()] + (pd(d).getFullYear() !== pd(today()).getFullYear() ? ' ' + pd(d).getFullYear() : '');
function monthsUntil(d) { return Math.max(1, Math.round(daysBetween(today(), d) / 30.4)); }
function goalHtml(g, sim) {
  const a = acctById(g.acc); if (!a) return '';
  const cur = Number(a.balance) || 0, stale = a.asOf && daysBetween(a.asOf, today()) > (g.type === 'debt' ? 5 : 20);
  let pct = null, lines = [];
  if (g.type === 'debt') {
    if (g.start) { pct = Math.max(0, Math.min(100, (g.start - cur) / g.start * 100)); lines.push(`погашено ${fmt(g.start - cur)} из ${fmt(g.start)}`); }
    if (cur <= 0) lines.push(stale ? 'был закрыт' : 'закрыто ✓');
    else {
      const sd = sim && sim.debts.find(d => d.id === g.id);
      if (sd && sd.done) lines.push(`по плану закроется в ${monthName(sd.done)}`);
      if (g.by) lines.push(`чтобы к ${dm(g.by)} — по ${fmt(Math.ceil(cur / monthsUntil(g.by)))} ₽/мес`);
    }
  } else {
    if (g.target) {
      pct = Math.max(0, Math.min(100, cur / g.target * 100));
      lines.push(`${fmt(cur)} из ${fmt(g.target)}`);
      if (sim && sim.carDone) lines.push(`после долгов — к ${monthName(sim.carDone)}`);
      if (g.by && cur < g.target) lines.push(`чтобы к ${dm(g.by)} — по ${fmt(Math.ceil((g.target - cur) / monthsUntil(g.by)))} ₽/мес`);
    } else lines.push('нажми и задай сумму цели и срок');
  }
  return `<button type="button" class="goal ${g.type}" data-action="goal" data-id="${esc(g.id)}"><span class="gt"><b>${esc(g.name)}</b><span class="gv">${g.type === 'debt' && cur > 0 ? '−' : ''}${fmt(cur)} ${esc(curSym())}</span></span>${pct != null ? `<span class="bar"><i style="width:${pct.toFixed(1)}%"></i></span>` : ''}<span class="gm">${esc(lines.join(' · '))}${stale ? ` · остаток на ${dm(a.asOf)} — обнови` : ''}</span></button>`;
}
function moneyPlanHtml() {
  if (!S.ready || !S.config) return '';
  const p = moneyPlan(), b = budgetNow(), sim = simulatePlan(), cur = esc(curSym());
  let h = '';
  if (p && b) {
    const pct = Math.max(0, Math.min(100, b.spent / b.living * 100));
    h += `<button type="button" class="budget ${b.left < 0 ? 'over' : ''}" data-action="budget"><span class="gt"><b>На жизнь до ${dm(b.end)}</b><span class="gv">${b.left < 0 ? 'перерасход ' + fmt(Math.round(-b.left)) : fmt(Math.max(0, Math.floor(b.perDay))) + ' ₽/день'}</span></span><span class="bar"><i style="width:${pct.toFixed(1)}%"></i></span><span class="gm">потрачено ${fmt(Math.round(b.spent))} из ${fmt(b.living)} · осталось ${fmt(Math.round(b.left))} ${cur} на ${b.daysLeft} ${plural(b.daysLeft, 'день', 'дня', 'дней')}</span>${(() => { const cn = canteenInfo(); return cn ? `<span class="gm">🍲 столовая до ${dm(cn.end)}: ${cn.meals} ${plural(cn.meals, 'обед', 'обеда', 'обедов')} ≈ ${fmt(cn.need)} ${cur} наличными${cn.cashLeft ? ` · на руках ~${fmt(cn.cashLeft)}` : ''}</span>` : ''; })()}</button>`;
  }
  const gl = goals();
  if (gl.length) {
    h += `<div class="sec-row"><h2 class="sec">Цели</h2>${sim ? `<span class="sec-note">свободно ~${fmt(Math.round(sim.free))} ${cur}/мес</span>` : ''}</div><div class="stack">${gl.map(g => goalHtml(g, sim)).join('')}</div>`;
  }
  const rg = regulars();
  if (rg.length) {
    const t = today();
    const rows = rg.slice().sort((a, c) => (nextDue(a) || '9') < (nextDue(c) || '9') ? -1 : 1).map(r => {
      const nd = nextDue(r), paid = regularPaid(r);
      const when = paid ? 'оплачено ✓' : nd ? (nd === t ? 'сегодня' : daysBetween(t, nd) === 1 ? 'завтра' : `${dm(nd)} · через ${daysBetween(t, nd)} ${plural(daysBetween(t, nd), 'день', 'дня', 'дней')}`) : 'дата не задана';
      return `<button type="button" class="reg" data-action="reg" data-id="${esc(r.id)}"><span class="rn">${esc(r.name)}</span><span class="ra">${fmt(r.amount)} ${cur}</span><span class="rw${paid ? ' ok' : ''}">${r.day ? esc(r.day) + '-го · ' : ''}${esc(when)}</span></button>`;
    }).join('');
    h += plannedHtml();
    h += `<details class="regs"${LS.get('bj-regs-open') ? ' open' : ''}><summary><span class="rs-t">Регулярные платежи</span><span class="sec-note">${fmt(regularTotal())} ${cur}/мес · ${fmt(regularTotal() * 12)} в год</span></summary><div class="stack">${rows}</div><button type="button" class="link-btn" data-action="reg-new">+ Платёж</button></details>`;
  }
  return h;
}
function openBudget() {
  const p = moneyPlan() || {}, b = budgetNow(), cur = esc(curSym());
  S.cur = { type: 'budget' };
  const reg = regularTotal(), free = freePerMonth();
  openSheet(`<h2 class="sh-title">Бюджет на жизнь</h2>
    ${b ? `<div class="big-num">${b.left < 0 ? '−' + fmt(Math.round(-b.left)) : fmt(Math.max(0, Math.floor(b.perDay)))}<small>${b.left < 0 ? ' ₽ перерасход' : ' ₽ в день до ' + dm(b.end)}</small></div>
    <div class="kv"><span>Бюджет на период</span><span class="v">${fmt(b.living)}</span><span>Потрачено</span><span class="v">${fmt(Math.round(b.spent))}</span><span>Осталось</span><span class="v">${fmt(Math.round(b.left))}</span><span>Дней до ${dm(b.end)}</span><span class="v">${b.daysLeft}</span><span>Сегодня потрачено</span><span class="v">${fmt(Math.round(b.spentToday))} из ${fmt(Math.max(0, Math.floor(b.todayCap)))}</span>${(() => { const cn = canteenInfo(); return cn ? `<span>Столовая до ${dm(cn.end)}</span><span class="v">${cn.meals} × ${fmt(cn.price)} ≈ ${fmt(cn.need)}</span><span>Наличных на руках, примерно</span><span class="v">${fmt(cn.cashLeft)}</span>` : ''; })()}</div>` : ''}
    
    <div class="two"><div><label class="fld" for="bg-living">На жизнь в месяц, ${cur}</label><input id="bg-living" inputmode="numeric" value="${esc(p.living || '')}"></div><div><label class="fld" for="bg-salary">Зарплата в месяц, ${cur}</label><input id="bg-salary" inputmode="numeric" value="${esc(p.salary || '')}"></div></div>
    <div class="kv"><span>Зарплата</span><span class="v">${fmt(p.salary || 0)}</span><span>Регулярные платежи</span><span class="v">−${fmt(reg)}</span><span>На жизнь</span><span class="v">−${fmt(p.living || 0)}</span><span class="sum">Свободно на долги и цели</span><span class="v sum${free >= 0 ? ' pos' : ''}">${free >= 0 ? '' : '−'}${fmt(Math.abs(free))}</span></div>
    <div class="sh-acts"><button type="button" class="btn money block" data-action="budget-save">Сохранить</button></div>`);
}
async function budgetSave() {
  const living = numOrNull($('#bg-living').value), salary = numOrNull($('#bg-salary').value);
  if (!(living > 0)) { toast('Впиши сумму на жизнь'); return; }
  const ok = await writeConfig(c => { c.money = c.money || {}; c.money.plan = Object.assign({ fixedCats: ['Жильё и связь'] }, c.money.plan || {}, { living: Math.round(living) }, salary > 0 ? { salary: Math.round(salary) } : {}); }, `Деньги: бюджет на жизнь ${Math.round(living)}`);
  if (ok) { closeSheet(); toast('Бюджет сохранён'); }
}
function openRegular(id) {
  const r = id ? regulars().find(x => x.id === id) : { id: null, name: '', amount: '', day: '', cat: otherCat() };
  if (!r) return;
  S.cur = { type: 'reg', r };
  openSheet(`<h2 class="sh-title">${id ? esc(r.name) : 'Новый регулярный платёж'}</h2>
    <label class="fld" for="rg-name">Название</label><input id="rg-name" value="${esc(r.name)}" placeholder="Например: Яндекс Плюс">
    <div class="two"><div><label class="fld" for="rg-amount">Сумма, ${esc(curSym())}</label><input id="rg-amount" inputmode="decimal" value="${esc(r.amount)}"></div><div><label class="fld" for="rg-day">Число месяца</label><input id="rg-day" inputmode="numeric" value="${esc(r.day || '')}" placeholder="—"></div></div>
    <label class="fld" for="rg-cat">Категория</label><select id="rg-cat">${catOptions(cats(), r.cat)}</select>
    
    <div class="sh-acts"><button type="button" class="btn money block" data-action="reg-save">Сохранить</button>${id ? '<button type="button" class="btn danger block" data-action="reg-del">Удалить</button>' : ''}</div>`);
}
async function regularSave(del) {
  const c = S.cur; if (!c || c.type !== 'reg') return;
  if (del) { if (await writeConfig(cfg => { cfg.money.regular = (cfg.money.regular || []).filter(x => x.id !== c.r.id); }, `Деньги: удалён платёж ${c.r.name}`)) { closeSheet(); toast('Удалено'); } return; }
  const name = $('#rg-name').value.trim(), amount = numOrNull($('#rg-amount').value), day = numOrNull($('#rg-day').value);
  if (!name || !(amount > 0)) { toast('Нужны название и сумма'); return; }
  const rec = Object.assign({}, c.r, { id: c.r.id || 'r' + rid().slice(0, 6), name, amount: Math.round(amount * 100) / 100, cat: $('#rg-cat').value });
  if (day >= 1 && day <= 31) rec.day = Math.round(day); else delete rec.day;
  if (!rec.match || !rec.match.length || (c.r.name && c.r.name !== name && rec.match.length === 1 && norm(rec.match[0]) === norm(c.r.name))) rec.match = [norm(name)];
  const ok = await writeConfig(cfg => { cfg.money = cfg.money || {}; const l = cfg.money.regular = cfg.money.regular || []; const k = l.findIndex(x => x.id === rec.id); if (k >= 0) l[k] = rec; else l.push(rec); }, `Деньги: платёж ${name}`);
  if (ok) { closeSheet(); toast('Сохранено'); }
}
function openGoal(id) {
  const g = goals().find(x => x.id === id); if (!g) return;
  const a = acctById(g.acc);
  S.cur = { type: 'goal', g };
  openSheet(`<h2 class="sh-title">${esc(g.name)}</h2>
    ${a ? `<p class="sh-meta">${g.type === 'debt' ? 'Остаток долга' : 'Сейчас на счёте'}: ${fmt(a.balance || 0)} ${esc(curSym())}${a.asOf ? ' на ' + dm(a.asOf) : ''}</p>` : ''}
    <label class="fld" for="gl-name">Название</label><input id="gl-name" value="${esc(g.name)}">
    ${g.type === 'save' ? `<label class="fld" for="gl-target">Сколько нужно, ${esc(curSym())}</label><input id="gl-target" inputmode="numeric" value="${esc(g.target || '')}" placeholder="например, 600000">` : `<label class="fld" for="gl-start">Долг в начале, ${esc(curSym())}</label><input id="gl-start" inputmode="numeric" value="${esc(g.start || '')}" placeholder="для полоски прогресса">`}
    <label class="fld" for="gl-by">К какой дате</label><input type="date" id="gl-by" value="${esc(g.by || '')}">
    <label class="fld" for="gl-bal">${g.type === 'debt' ? 'Остаток долга сейчас' : 'Сейчас на счёте'}, ${esc(curSym())}</label><input id="gl-bal" inputmode="decimal" value="${a ? esc(a.balance ?? '') : ''}">
    
    <div class="sh-acts"><button type="button" class="btn money block" data-action="goal-save">Сохранить</button></div>`);
}
async function goalSave() {
  const c = S.cur; if (!c || c.type !== 'goal') return;
  const name = $('#gl-name').value.trim() || c.g.name, by = $('#gl-by').value || null;
  const target = $('#gl-target') ? numOrNull($('#gl-target').value) : null, start = $('#gl-start') ? numOrNull($('#gl-start').value) : null, bal = numOrNull($('#gl-bal').value);
  const ok = await writeConfig(cfg => {
    const g = (cfg.money.goals || []).find(x => x.id === c.g.id); if (!g) return;
    g.name = name; if (by) g.by = by; else delete g.by;
    if ($('#gl-target')) { if (target > 0) g.target = Math.round(target); else delete g.target; }
    if ($('#gl-start')) { if (start > 0) g.start = Math.round(start); else delete g.start; }
    const a = (cfg.money.accounts || []).find(x => x.id === g.acc);
    if (a && bal != null && Number(a.balance) !== bal) { a.balance = Math.round(bal * 100) / 100; a.asOf = today(); a.ts = Date.now(); }
  }, `Деньги: цель «${name}»`);
  if (ok) { closeSheet(); toast('Сохранено'); }
}
function regularRows(d) {
  const t = today(); if (d < t) return [];
  return regulars().filter(r => nextDue(r, d) === d && !(d <= periodEnd(periodOf(t)) && regularPaid(r))).map(r => `<button type="button" class="row slim" data-action="reg" data-id="${esc(r.id)}"><span class="tag pay">Платёж</span><span class="rb"><span class="t">${esc(r.name)}</span></span><span class="s">${fmt(r.amount)} ${esc(curSym())}</span></button>`);
}
/* ---------- простые графики (одна серия, без легенды) ---------- */
const compact = v => Math.abs(v) >= 1000 ? (Math.round(v / 100) / 10).toString().replace('.', ',') + 'к' : String(Math.round(v));
function barChart(data, o) {
  o = o || {}; const W = 320, H = 150, pb = 22, pt = 18, n = data.length; if (n < 2) return '';
  const max = Math.max(...data.map(d => d.v), 1), gap = 14, bw = Math.min(46, (W - (n - 1) * gap) / n), x0 = (W - (n * bw + (n - 1) * gap)) / 2;
  const bars = data.map((d, i) => { const h = Math.max(2, (H - pb - pt) * d.v / max), x = x0 + i * (bw + gap), y = H - pb - h; return `<g><title>${esc(d.title || d.label + ': ' + fmt(d.v))}</title><path d="M${x},${H - pb} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + bw - 4} Q${x + bw},${y} ${x + bw},${y + 4} V${H - pb} Z" class="ch-bar${d.hi ? ' hi' : ''}"/><text x="${x + bw / 2}" y="${y - 5}" class="ch-v" text-anchor="middle">${esc(o.fmt ? o.fmt(d.v) : compact(d.v))}</text><text x="${x + bw / 2}" y="${H - 6}" class="ch-l" text-anchor="middle">${esc(d.label)}</text></g>`; }).join('');
  return `<figure class="chart ${o.cls || ''}"><figcaption>${esc(o.title || '')}</figcaption><svg viewBox="0 -2 ${W} ${H + 2}" role="img" aria-label="${esc(o.title || '')}"><line x1="0" x2="${W}" y1="${H - pb}" y2="${H - pb}" class="ch-axis"/>${bars}</svg></figure>`;
}
function lineChart(data, o) {
  o = o || {}; const W = 320, H = 130, pl = 6, pr = 6, pt = 16, pb = 20, n = data.length; if (n < 2) return '';
  const ys = data.map(d => d.v), lo = o.min != null ? Math.min(o.min, ...ys) : Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const X = i => pl + (W - pl - pr) * i / (n - 1), Y = v => pt + (H - pt - pb) * (1 - (v - lo) / span);
  const pts = data.map((d, i) => `${X(i).toFixed(1)},${Y(d.v).toFixed(1)}`).join(' ');
  const last = data[n - 1], imax = ys.indexOf(hi);
  const lab = (i, above) => `<text x="${Math.min(W - 18, Math.max(18, X(i)))}" y="${Y(data[i].v) + (above ? -7 : 14)}" class="ch-v" text-anchor="middle">${esc(o.fmt ? o.fmt(data[i].v) : compact(data[i].v))}</text>`;
  return `<figure class="chart ${o.cls || ''}"><figcaption>${esc(o.title || '')}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || '')}"><line x1="0" x2="${W}" y1="${H - pb}" y2="${H - pb}" class="ch-axis"/><polyline points="${pts}" class="ch-line"/>${data.map((d, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(d.v).toFixed(1)}" r="4" class="ch-dot"><title>${esc(d.label + ': ' + (o.fmt ? o.fmt(d.v) : fmt(d.v)))}</title></circle>`).join('')}${lab(n - 1, true)}${imax !== n - 1 ? lab(imax, true) : ''}<text x="${pl}" y="${H - 5}" class="ch-l">${esc(data[0].label)}</text><text x="${W - pr}" y="${H - 5}" class="ch-l" text-anchor="end">${esc(last.label)}</text></svg></figure>`;
}
function spendChartHtml() {
  const since = moneyCfg().since; if (!since) return '';
  const cur = periodOf(today()); const list = [];
  for (let p = periodOf(since), k = 0; p <= cur && k < 24; p = periodShift(p, 1), k++) list.push(p);
  const shown = list.slice(-6);
  const mks = Array.from(new Set(shown.flatMap(periodMonths)));
  if (!mks.every(mk => S.fresh.has('money/' + mk))) { if (!S.chartLoading) { S.chartLoading = true; ensureMoney(mks).then(() => { S.chartLoading = false; renderMoney(); }); } return ''; }
  const data = shown.map(p => { const it = periodItems(p); return { label: MON_S[pd(p).getMonth()] + (p === cur ? '*' : ''), v: sumAmt(it.filter(x => kindOf(x) === 'spend')), hi: p === S.period, title: periodLabel(p) + ': ' + fmt(sumAmt(it.filter(x => kindOf(x) === 'spend'))) + ' ₽' }; });
  return barChart(data, { title: 'Траты по месяцам бюджета' + (shown.includes(cur) ? ' · * — идёт сейчас' : ''), cls: 'money' });
}
/* ---------- портфолио NetDevOps: опыт, звания, ачивки ---------- */
const RANKS = ['Новобранец', 'Курсант', 'Рядовой терминала', 'Ефрейтор скриптов', 'Младший сержант Linux', 'Сержант Git', 'Старшина сетей', 'Прапорщик Python', 'Лейтенант контейнеров', 'Старший лейтенант CI/CD', 'Капитан Ansible', 'Майор Kubernetes', 'Подполковник наблюдаемости', 'Полковник инфраструктуры', 'Генерал NetDevOps'];
const lvlXp = n => 150 * n * (n - 1);
const XP = { lesson: 100, lesson90: 150, part: 40, artifact: 50, project: 250, block: 500, notes: 20 };
function curBlocks() { return (S.curriculum && S.curriculum.blocks) || []; }
function blockLessons(b) { return (b.topics || []).flatMap(t => t.lessons || []); }
function blockSize(b) { return (b.topics || []).reduce((a, t) => a + (t.lessons || []).length + (t.items || []).length, 0); }
function lessonDoneN(n) { const l = S.lessons.find(x => Number(x.n) === Number(n)); return !!(l && l.done); }
function blockClosed(b) { const ls = blockLessons(b); return ls.length > 0 && !(b.topics || []).some(t => (t.items || []).length) && ls.every(lessonDoneN); }
function pfStats() {
  const pf = S.portfolio || {}, projects = pf.projects || [], arts = pf.artifacts || [];
  const done = S.lessons.filter(l => l.done);
  const parts = S.lessons.filter(l => !l.done && (l.progressDates || []).length).reduce((a, l) => a + l.progressDates.length, 0);
  const pDone = projects.filter(p => p.status === 'done'), keyDone = pDone.filter(p => p.key);
  const blocks = curBlocks(), closed = blocks.filter(blockClosed);
  const total = blocks.reduce((a, b) => a + blockSize(b), 0) || 1;
  const topicsDone = blocks.reduce((a, b) => a + blockLessons(b).filter(lessonDoneN).length, 0);
  const notes = S.notesDays ? S.notesDays.length : 0;
  const xp = done.reduce((a, l) => a + (Number(l.need) >= 90 ? XP.lesson90 : XP.lesson), 0) + parts * XP.part + arts.length * XP.artifact + pDone.length * XP.project + closed.length * XP.block + notes * XP.notes;
  let lvl = 1; while (lvl < RANKS.length && xp >= lvlXp(lvl + 1)) lvl++;
  const from = lvlXp(lvl), to = lvl < RANKS.length ? lvlXp(lvl + 1) : xp;
  return { xp, lvl, rank: RANKS[lvl - 1], next: RANKS[lvl] || null, from, to, pctLvl: to > from ? (xp - from) / (to - from) * 100 : 100,
    lessons: done.length, parts, arts, projects, pDone: pDone.length, keyDone: keyDone.length, blocks, closed, total, topicsDone, pctPath: topicsDone / total * 100, notes, streak: studyStreakWeeks() };
}
// недели подряд (последние завершённые), где все учебные окна были использованы
function studyStreakWeeks() {
  if (!S.config || !S.config.study) return 0;
  const st = S.config.study.start; if (!st) return 0;
  let w = addDays(mondayOf(today()), -7), n = 0;
  while (w >= mondayOf(st)) {
    let win = 0, miss = 0;
    for (let k = 0; k < 7; k++) { const d = addDays(w, k); if (d < st || (excused(d) && !activity(d))) continue; const c = studyCap(d); if (c.blocked) { if (c.base > 0) { win++; miss++; } continue; } if (c.cap <= 0) continue; win++; if (!activity(d)) miss++; }
    if (!win || miss) break;
    n++; w = addDays(w, -7);
  }
  return n;
}
function achievements(c) {
  const proj = id => (c.projects.find(p => p.id === id) || {}).status === 'done';
  const list = [
    { id: 'l1', ic: '🎯', t: 'Первый шаг', d: 'Пройти первый урок', ok: c.lessons >= 1 },
    { id: 'lab', ic: '🖥️', t: 'Свой стенд', d: 'Поднять лабораторную виртуалку', ok: proj('linux1-1') },
    { id: 'script', ic: '📜', t: 'Первый скрипт', d: 'Написать первый bash-скрипт', ok: lessonDoneN(7) },
    { id: 'l10', ic: '🔟', t: 'Десятка', d: 'Пройти 10 уроков', ok: c.lessons >= 10 },
    { id: 'gitvault', ic: '🗂️', t: 'Конспект под git', d: 'Хранилище Obsidian в приватном репозитории', ok: proj('git-1') },
    { id: 'cron', ic: '⏰', t: 'Работает без меня', d: 'Первый скрипт по расписанию (cron)', ok: lessonDoneN(11) },
    { id: 'monitor', ic: '📡', t: 'Не стыдно выложить', d: 'Собрать monitor.sh — финал блока Bash', ok: lessonDoneN(12) },
    { id: 'n5', ic: '📝', t: 'Конспектёр', d: '5 дней с отправленными заметками', ok: c.notes >= 5 },
    { id: 'n30', ic: '📚', t: 'Летописец', d: '30 дней с отправленными заметками', ok: c.notes >= 30 },
    { id: 'wk1', ic: '🔥', t: 'Неделя без пропусков', d: 'Все учебные окна недели использованы', ok: c.streak >= 1 },
    { id: 'wk4', ic: '💪', t: 'Месяц без пропусков', d: '4 недели подряд без пропусков', ok: c.streak >= 4 },
    { id: 'l25', ic: '🥉', t: 'Четверть сотни', d: 'Пройти 25 уроков', ok: c.lessons >= 25 },
    { id: 'p1', ic: '🛠️', t: 'Строитель', d: 'Первый проект из плана', ok: c.pDone >= 1 },
    { id: 'p5', ic: '🏗️', t: 'Прораб', d: '5 проектов из плана', ok: c.pDone >= 5 },
    { id: 'key1', ic: '⭐', t: 'Сквозной проект', d: 'Закрыть первый сквозной проект', ok: c.keyDone >= 1 },
    { id: 'path25', ic: '🗺️', t: 'Четверть пути', d: '25% тем NetDevOps', ok: c.pctPath >= 25 },
    { id: 'l50', ic: '🥈', t: 'Полтинник', d: 'Пройти 50 уроков', ok: c.lessons >= 50 },
    { id: 'path50', ic: '🧭', t: 'Экватор', d: 'Половина пути NetDevOps', ok: c.pctPath >= 50 },
    { id: 'p15', ic: '🏛️', t: 'Портфолио', d: '15 проектов из плана', ok: c.pDone >= 15 },
    { id: 'path100', ic: '🥇', t: 'Весь путь', d: 'Все темы плана NetDevOps', ok: c.pctPath >= 99.9 }
  ];
  c.blocks.forEach(b => list.push({ id: 'b-' + b.id, ic: '🏅', t: b.title, d: 'Закрыть блок «' + b.title + '»', ok: blockClosed(b), block: true }));
  return list;
}
function pfCardHtml() {
  if (!S.ready || !S.curriculum || !curBlocks().length) return '';
  const c = pfStats(), ach = achievements(c), got = ach.filter(a => a.ok).length;
  const fresh = newAchievements(ach).length;
  return `<button type="button" class="pf-card" data-action="pf-open"><span class="pf-top"><span class="pf-lvl">${c.lvl}</span><span class="pf-rt"><b>${esc(c.rank)}</b><small>${fmt(c.xp)} XP${c.next ? ' · до «' + esc(c.next) + '» ' + fmt(c.to - c.xp) : ''}</small></span>${fresh ? `<span class="pf-new">+${fresh} 🏆</span>` : ''}</span><span class="bar pf-bar"><i style="width:${c.pctLvl.toFixed(1)}%"></i></span><span class="pf-sub">Путь NetDevOps ${c.topicsDone} из ~${c.total} тем · проекты ${c.pDone} из ${c.projects.length} · ачивки ${got} из ${ach.length}</span></button>`;
}
function newAchievements(ach) { const seen = new Set(LS.get('bj-ach') || []); return ach.filter(a => a.ok && !seen.has(a.id)); }
const PF_ST = { done: 'сделано', doing: 'в работе', todo: 'впереди' };
function openPortfolio(tab) {
  tab = tab || (S.cur && S.cur.type === 'pf' && S.cur.tab) || 'prog';
  S.cur = { type: 'pf', tab };
  const c = pfStats(), ach = achievements(c), fresh = new Set(newAchievements(ach).map(a => a.id));
  const seg = `<div class="seg4 seg-4" role="group" aria-label="Раздел">${[['prog', 'Прогресс'], ['ach', 'Ачивки'], ['proj', 'Проекты'], ['done', 'Сделано']].map(([k, l]) => `<button type="button" data-action="pf-tab" data-tab="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (tab === 'prog') {
    body = `<div class="pf-hero"><span class="pf-lvl big">${c.lvl}</span><span><b>${esc(c.rank)}</b><br><small>${fmt(c.xp)} XP${c.next ? ` · следующее звание «${esc(c.next)}» через ${fmt(c.to - c.xp)} XP` : ''}</small></span></div><span class="bar pf-bar"><i style="width:${c.pctLvl.toFixed(1)}%"></i></span>
      <div class="kv"><span>Уроки · ${c.lessons}</span><span class="v">+${fmt(S.lessons.filter(l => l.done).reduce((a, l) => a + (Number(l.need) >= 90 ? XP.lesson90 : XP.lesson), 0))}</span>${c.parts ? `<span>Части уроков · ${c.parts}</span><span class="v">+${fmt(c.parts * XP.part)}</span>` : ''}<span>Сделанные вещи · ${c.arts.length}</span><span class="v">+${fmt(c.arts.length * XP.artifact)}</span><span>Проекты · ${c.pDone}</span><span class="v">+${fmt(c.pDone * XP.project)}</span><span>Закрытые блоки · ${c.closed.length}</span><span class="v">+${fmt(c.closed.length * XP.block)}</span><span>Дни с конспектом · ${c.notes}</span><span class="v">+${fmt(c.notes * XP.notes)}</span></div>
      
      <h3 class="sec">Путь NetDevOps · ${Math.round(c.pctPath)}%</h3><div class="pf-blocks">${c.blocks.map(b => { const n = blockSize(b), d = blockLessons(b).filter(lessonDoneN).length; return `<div class="pf-b${blockClosed(b) ? ' ok' : ''}"><span class="bn">${esc(b.title)}</span><span class="bc">${blockClosed(b) ? '✓' : d + '/' + n}</span><span class="bar"><i style="width:${(n ? d / n * 100 : 0).toFixed(1)}%"></i></span></div>`; }).join('')}</div>`;
  } else if (tab === 'ach') {
    const got = ach.filter(a => a.ok).length;
    body = `<p class="sh-meta">Открыто ${got} из ${ach.length}</p><div class="ach-grid">${ach.map(a => `<div class="ach${a.ok ? ' ok' : ''}${fresh.has(a.id) ? ' fresh' : ''}"><span class="ai">${a.ok ? a.ic : '🔒'}</span><span class="at">${esc(a.t)}</span><span class="ad">${esc(a.d)}</span></div>`).join('')}</div>`;
  } else if (tab === 'proj') {
    body = `<p class="sh-meta">⭐ — сквозной проект</p>` + c.blocks.map(b => { const ps = c.projects.filter(p => p.block === b.id); if (!ps.length) return ''; return `<h3 class="sec">${esc(b.title)} · ${ps.filter(p => p.status === 'done').length}/${ps.length}</h3><div class="stack">${ps.map(p => `<div class="pf-p ${p.status}"><span class="pn">${p.key ? '⭐ ' : ''}${esc(p.title)}</span><span class="chip${p.status === 'done' ? ' good' : p.status === 'doing' ? ' warn' : ''}">${PF_ST[p.status] || p.status}${p.date && p.status === 'done' ? ' ' + dm(p.date) : ''}</span>${p.note ? `<span class="pm">${esc(p.note)}</span>` : ''}</div>`).join('')}</div>`; }).join('');
  } else {
    const arts = c.arts.slice().sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
    const les = S.lessons.filter(l => l.done).sort((a, b) => b.done < a.done ? -1 : 1);
    body = `<h3 class="sec">Сделанные вещи</h3>${arts.length ? `<div class="stack">${arts.map(a => `<div class="pf-p done"><span class="pn">${esc(a.title)}</span><span class="chip good">${a.date ? dm(a.date) : '✓'}</span>${a.desc ? `<span class="pm">${esc(a.desc)}</span>` : ''}</div>`).join('')}</div>` : '<p class="note">Пока пусто — появятся после уроков.</p>'}
      <h3 class="sec">Навыки по урокам</h3><div class="stack">${les.map(l => `<div class="pf-p done"><span class="pn">Урок ${esc(l.n)} · ${esc(l.title || '')}</span><span class="chip good">${dm(l.done)}</span>${l.outcome ? `<span class="pm">${esc(l.outcome)}</span>` : ''}</div>`).join('')}</div>
      `;
  }
  openSheet(`<h2 class="sh-title">Портфолио NetDevOps</h2>${seg}${body}`, true);
  if (tab === 'ach' || fresh.size) { LS.set('bj-ach', ach.filter(a => a.ok).map(a => a.id)); renderLessons(); }
}
function announceAchievements() {
  if (!S.ready || !S.curriculum || !curBlocks().length) return;
  const c = pfStats(), ach = achievements(c), fresh = newAchievements(ach);
  const lv = LS.get('bj-lvl');
  if (lv != null && c.lvl > lv) toast(`🎖 Новое звание: ${c.rank}! Уровень ${c.lvl}`);
  else if (fresh.length && LS.get('bj-ach')) toast(fresh.length === 1 ? `🏆 Ачивка: ${fresh[0].t}` : `🏆 Новые ачивки: ${fresh.length} — загляни в портфолио`);
  LS.set('bj-lvl', c.lvl);
}
async function loadNotesDays() {
  const src = notesRepoSep(); if (!src) { S.notesDays = null; return; }
  const st = (S.config.study || {}).start || '2026-01-01';
  try {
    const r = await GH.req('GET', `/repos/${encodeURIComponent(src.owner)}/${encodeURIComponent(src.repo)}/commits?per_page=100&since=${encodeURIComponent(new Date(pd(st).setHours(0, 0, 0, 0)).toISOString())}`);
    if (!r.ok) return;
    const j = await r.json();
    S.notesDays = Array.from(new Set((j || []).filter(x => !/noreply@anthropic\.com/i.test(((x.commit || {}).author || {}).email || '')).map(x => ds(new Date(((x.commit || {}).author || {}).date || ((x.commit || {}).committer || {}).date)))));
    LS.set('bj-notes-days', S.notesDays);
    renderLessons(); announceAchievements();
  } catch (_) {}
}
/* ---------- итоги: неделя (пн–вс) / месяц (бюджетный, с periodStart) / год ----------
   Цифры журнал считает сам из своих данных; разбор словами пишет Claude в reviews.json. */
const REV_T = { week: 'Неделя', month: 'Месяц', year: 'Год' };
const REV_G = { week: 'недели', month: 'месяца', year: 'года' };
function revRange(type, anchor) {
  if (type === 'week') { const f = mondayOf(anchor); return { from: f, to: addDays(f, 6) }; }
  if (type === 'month') { const f = periodOf(anchor); return { from: f, to: periodEnd(f) }; }
  const y = anchor.slice(0, 4); return { from: y + '-01-01', to: y + '-12-31' };
}
function revShift(type, from, n) {
  if (type === 'week') return addDays(from, 7 * n);
  if (type === 'month') return periodShift(from, n);
  return (Number(from.slice(0, 4)) + n) + '-01-01';
}
function revLabel(type, r) {
  if (type === 'week') return `${pd(r.from).getDate()} ${MON_S[pd(r.from).getMonth()]} – ${pd(r.to).getDate()} ${MON_S[pd(r.to).getMonth()]}`;
  if (type === 'month') return periodLabel(r.from);
  return r.from.slice(0, 4) + ' год';
}
function monthsIn(from, to) { const out = []; for (let m = monthKey(from); m <= monthKey(to); m = monthShift(m, 1)) out.push(m); return out; }
function bedMin(s) { const v = toMin(s && s.bed); return v == null ? null : (v < 12 * 60 ? v + 1440 : v); }
function periodSummary(from, to) {
  const t = today(), end = to < t ? to : addDays(t, -1);
  const since = S.config && S.config.money && S.config.money.since || '0000';
  const R = { from, to, started: from <= t, over: to < t };
  // спорт
  const sp = buildSport(from, to).filter(i => i.eff >= from && i.eff <= to);
  const due = sp.filter(i => i.eff < t || i.state);
  const st = x => due.filter(i => i.state === x).length;
  R.sport = { due: due.length, done: st('done'), other: st('other'), skipped: st('skipped'), open: due.filter(i => !i.state).length, moved: sp.filter(i => i.eff !== i.orig).length, extra: sp.filter(i => i.extra).length,
    others: due.filter(i => i.state === 'other' && i.note).map(i => `${dm(i.eff)}: ${i.note}`),
    reasons: sp.filter(i => i.ov && i.ov.reason).map(i => `${dm(i.orig)} ${i.title}: ${i.ov.reason}`) };
  let logs = 0;
  for (const mk of monthsIn(from, to)) for (const lg of Object.values(((S.workouts[mk] || {}).logs) || {})) if (lg.date >= from && lg.date <= to) logs++;
  R.sport.logs = logs;
  const spStart = (S.config.sport || {}).start, stStart = (S.config.study || {}).start;
  R.sport.before = !!(spStart && to < spStart); R.sport.start = spStart;
  // учёба
  const ss = (S.config.study || {}).start || from;
  let win = 0, skips = 0; const sreasons = [];
  for (let d = from > ss ? from : ss; d <= end; d = addDays(d, 1)) {
    const c = studyCap(d);
    if (excused(d) && !activity(d)) { const o = S.studyDays[d] || {}; if (o.reason || dutyOn(d)) sreasons.push(`${dm(d)}: ${o.reason || 'наряд'}`); continue; }
    if (c.blocked) { if (c.base > 0) { win++; skips++; const o = S.studyDays[d] || {}; if (o.reason) sreasons.push(`${dm(d)}: ${o.reason}`); } continue; }
    if (c.cap <= 0) continue;
    win++; if (!activity(d)) skips++;
  }
  R.study = { vsz: plannedMinutes(from, to), rss: studyMinutes(from, to), before: !!(stStart && to < stStart), start: stStart, win, skips, lessons: S.lessons.filter(l => l.done && l.done >= from && l.done <= to).sort((a, b) => a.done < b.done ? -1 : 1), parts: S.lessons.filter(l => (l.progressDates || []).some(d => d >= from && d <= to) && !(l.done >= from && l.done <= to)).length, reasons: sreasons };
  const ws = Object.keys(weights()).filter(d => d >= from && d <= to).sort();
  R.weight = ws.length ? { last: weights()[ws[ws.length - 1]], first: weights()[ws[0]], pts: ws.map(d => ({ label: dm(d), v: weights()[d] })) } : null;
  // сон
  const nights = Object.keys(S.sleep.days || {}).filter(d => d >= from && d <= to).map(d => S.sleep.days[d]);
  const durs = nights.map(sleepMin).filter(Boolean), beds = nights.map(bedMin).filter(v => v != null);
  R.sleep = { n: durs.length, avg: durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null, bed: beds.length ? Math.round(beds.reduce((a, b) => a + b, 0) / beds.length) % 1440 : null, short: durs.filter(v => v < 7 * 60).length };
  // деньги
  let items = [];
  for (const mk of monthsIn(from, to)) items = items.concat((((S.money[mk] || {}).items) || []).filter(x => x.date >= from && x.date <= to));
  const sum = f => items.filter(f).reduce((a, x) => a + (Number(x.amount) || 0), 0);
  const cats = {}; items.filter(x => kindOf(x) === 'spend').forEach(x => { const c = x.cat || otherCat(); cats[c] = (cats[c] || 0) + (Number(x.amount) || 0); });
  let tr = 0; items.filter(x => kindOf(x) === 'transfer' && x.cat !== 'Свои счета').forEach(x => { tr += (x.dir === 'in' ? 1 : -1) * (Number(x.amount) || 0); });
  const spend = sum(x => kindOf(x) === 'spend'), income = sum(x => kindOf(x) === 'income'), cash = sum(x => kindOf(x) === 'cash');
  const big = items.filter(x => kindOf(x) === 'spend').sort((a, b) => b.amount - a.amount)[0];
  R.money = { tracked: to >= since, spend, income, cash, net: income - spend - cash + tr, cats: Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 5), big, n: items.length, unclear: items.filter(x => x.cat === 'Не разобрано').length };
  return R;
}
function revStatsHtml(R) {
  if (!R.started) return '<p class="note">Этот период ещё не начался.</p>';
  const cur = esc(curSym()), sp = R.sport, st = R.study, sl = R.sleep, m = R.money;
  const hmm = v => pad(Math.floor(v / 60) % 24) + ':' + pad(v % 60);
  let h = '<div class="rev-grid">';
  h += `<div class="rev-c"><div class="k">Спорт</div><div class="v">${sp.due ? `${sp.done + sp.other} из ${sp.due}` : '—'}</div><div class="m">${[sp.other ? `другое: ${sp.other}` : '', sp.skipped ? `пропуск: ${sp.skipped}` : '', sp.open ? `не отмечено: ${sp.open}` : '', sp.moved ? `переносов: ${sp.moved}` : '', sp.extra ? `сверх плана: ${sp.extra}` : ''].filter(Boolean).join(' · ') || (sp.due ? 'всё по плану' : sp.before ? 'план в журнале с ' + dm(sp.start) : 'тренировок не было')}${R.weight ? `<br>вес ${String(R.weight.last).replace('.', ',')} кг${R.weight.pts.length > 1 ? ` (${R.weight.last - R.weight.first >= 0 ? '+' : '−'}${String(Math.abs(Math.round((R.weight.last - R.weight.first) * 10) / 10)).replace('.', ',')})` : ''}` : ''}</div></div>`;
  h += `<div class="rev-c"><div class="k">Учёба</div><div class="v">${st.lessons.length} ${plural(st.lessons.length, 'урок', 'урока', 'уроков')}</div><div class="m">${st.win ? `окон: ${st.win} · пропусков: ${st.skips}` : st.before ? 'план окон с ' + dm(st.start) : 'окон не было'}${st.parts ? ` · частей: ${st.parts}` : ''}${st.rss || st.vsz ? `<br><span class="mono">VSZ ${hmShort(st.vsz)} · RSS ${hmShort(st.rss)}</span>` : ''}</div></div>`;
  h += `<div class="rev-c"><div class="k">Сон</div><div class="v">${sl.avg ? hm(sl.avg) : '—'}</div><div class="m">${sl.n ? `${sl.n} ${plural(sl.n, 'ночь', 'ночи', 'ночей')} · ложился ~${hmm(sl.bed)}${sl.short ? ` · меньше 7 ч: ${sl.short}` : ''}` : 'сон не отмечен'}</div></div>`;
  h += `<div class="rev-c"><div class="k">Деньги</div><div class="v">${m.tracked ? fmt(m.spend) + ' ' + cur : '—'}</div><div class="m">${m.tracked ? `потрачено · доход ${fmt(m.income)} · итог ${m.net >= 0 ? '+' : '−'}${fmt(Math.abs(m.net))}` : 'учёт с ' + dm(((S.config.money || {}).since) || R.from)}</div></div>`;
  h += '</div>';
  const more = [];
  if (st.lessons.length) more.push(`<b>Пройдено:</b> ${st.lessons.map(l => `урок ${esc(l.n)}${l.title ? ' ' + esc(l.title) : ''}`).join(', ')}`);
  if (sp.others.length) more.push(`<b>Вместо тренировки:</b> ${sp.others.map(esc).join('; ')}`);
  if (sp.reasons.length || st.reasons.length) more.push(`<b>Причины переносов и пропусков:</b> ${sp.reasons.concat(st.reasons).map(esc).join('; ')}`);
  if (m.tracked && m.cats.length) more.push(`<b>Траты:</b> ${m.cats.map(([c, v]) => `${esc(c)} ${fmt(v)}`).join(' · ')}${m.big ? ` · самая крупная — ${esc(m.big.name)} ${fmt(m.big.amount)} ${cur}` : ''}${m.unclear ? ` · не разобрано переводов: ${m.unclear}` : ''}`);
  if (more.length) h += `<div class="rev-more">${more.map(x => `<p>${x}</p>`).join('')}</div>`;
  const nights = Object.keys(S.sleep.days || {}).filter(d => d >= R.from && d <= R.to).sort().map(d => ({ label: dm(d), v: (sleepMin(S.sleep.days[d]) || 0) / 60 })).filter(x => x.v > 0);
  if (R.weight && R.weight.pts.length >= 2) h += lineChart(R.weight.pts, { title: 'Вес тела, кг', fmt: v => String(v).replace('.', ','), cls: 'sport' });
  if (nights.length >= 2) h += lineChart(nights.slice(-31), { title: 'Сон, часов', fmt: v => String(Math.round(v * 10) / 10).replace('.', ','), cls: 'study' });
  const ex = {};
  for (const mk of monthsIn(R.from, R.to)) for (const lg of Object.values(((S.workouts[mk] || {}).logs) || {})) {
    if (!(lg.date >= R.from && lg.date <= R.to)) continue;
    for (const bl of lg.blocks || []) for (const e of bl.ex || []) {
      if (e.log !== 'wr' && e.log !== 'r') continue;
      const sets = (e.sets || []).filter(Boolean); if (!sets.length) continue;
      const best = e.log === 'wr' ? Math.max(...sets.map(x => Number(x.w) || 0)) : Math.max(...sets.map(x => Number(x.r) || 0));
      if (!(best > 0)) continue;
      (ex[e.name] = ex[e.name] || { unit: e.log === 'wr' ? 'кг' : 'повт.', pts: [] }).pts.push({ d: lg.date, v: best });
    }
  }
  Object.entries(ex).filter(([, o]) => o.pts.length >= 2).sort((a, b) => b[1].pts.length - a[1].pts.length).slice(0, 3)
    .forEach(([name, o]) => { h += lineChart(o.pts.sort((a, b) => a.d < b.d ? -1 : 1).map(x => ({ label: dm(x.d), v: x.v })), { title: `${name}, лучший подход (${o.unit})`, cls: 'sport' }); });
  return h;
}
function reviewFor(type, from) { return S.reviews.find(r => r.type === type && r.from === from) || null; }
function latestReview() { return S.reviews.slice().sort((a, b) => (b.to || '') < (a.to || '') ? -1 : (b.to || '') > (a.to || '') ? 1 : (b.created || '') < (a.created || '') ? -1 : 1)[0] || null; }
async function openReview(type, from) {
  type = type || (S.rev && S.rev.type) || 'week';
  const r = from ? { from, to: revRange(type, from).to } : revRange(type, today());
  S.rev = { type, from: r.from };
  S.cur = { type: 'rev' };
  const cv = reviewFor(type, r.from);
  const seg = `<div class="seg" role="group" aria-label="Период">${Object.keys(REV_T).map(k => `<button type="button" data-action="rev-type" data-type="${k}" aria-pressed="${k === type}">${REV_T[k]}</button>`).join('')}</div>`;
  const nav = `<div class="cal-bar rev-nav"><button type="button" class="btn sm" data-action="rev-prev" aria-label="Раньше">‹</button><b>${esc(revLabel(type, r))}</b><button type="button" class="btn sm" data-action="rev-next" aria-label="Позже"${r.from > today() ? ' disabled' : ''}>›</button></div>`;
  const draw = loading => openSheet(`<h2 class="sh-title">Итоги</h2>${seg}${nav}
    ${cv ? `<div class="rev-claude"><div class="rev-h"><span class="cf-dot" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2.5c.5 4.6 2.4 6.5 7 7-4.6.5-6.5 2.4-7 7-.5-4.6-2.4-6.5-7-7 4.6-.5 6.5-2.4 7-7z" fill="currentColor"/></svg></span>Разбор Claude</div><div class="md">${renderMd(cv.text || '')}</div>${cv.focus ? `<div class="rev-focus"><b>Фокус на ${esc(REV_G[type] === 'года' ? 'следующий год' : REV_G[type] === 'месяца' ? 'следующий месяц' : 'следующую неделю')}:</b> ${esc(cv.focus)}</div>` : ''}</div>` : (r.to < today() ? `<p class="note">Разбора Claude пока нет.</p>` : `<p class="note">Период ещё идёт.</p>`)}
    <h3 class="sec">Цифры</h3>${loading ? '<p class="loading"><span class="spin" aria-hidden="true"></span>Считаю…</p>' : revStatsHtml(periodSummary(r.from, r.to))}`, true);
  draw(true);
  if (cv) { const seen = new Set(LS.get('bj-seen-rev') || []); if (!seen.has(cv.id)) { seen.add(cv.id); LS.set('bj-seen-rev', Array.from(seen)); renderPlan(); } }
  await Promise.all([ensureMoney(monthsIn(r.from, r.to)), ensureWorkouts(monthsIn(r.from, r.to))]);
  if (S.cur && S.cur.type === 'rev' && S.rev.from === r.from && S.rev.type === type) draw(false);
}
function reviewCardHtml() {
  const r = latestReview();
  const seen = new Set(LS.get('bj-seen-rev') || []);
  if (r && !seen.has(r.id) && daysBetween(r.to, today()) <= 10) {
    const first = String(r.text || '').replace(/[#*_>`]/g, '').split('\n').map(x => x.trim()).filter(Boolean)[0] || '';
    return `<button type="button" class="rev-card" data-action="rev-open" data-type="${esc(r.type)}" data-from="${esc(r.from)}"><span class="cf-dot" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2.5c.5 4.6 2.4 6.5 7 7-4.6.5-6.5 2.4-7 7-.5-4.6-2.4-6.5-7-7 4.6-.5 6.5-2.4 7-7z" fill="currentColor"/></svg></span><span class="rb"><span class="t">Разбор ${esc(REV_G[r.type] || '')} · ${esc(revLabel(r.type, r))}</span><span class="m">${esc(r.focus ? 'Фокус: ' + r.focus : first).slice(0, 140)}</span></span><span class="s">читать</span></button>`;
  }
  return '';
}
/* ---------- напоминание: отправить заметки Obsidian после урока ---------- */
function notesRepoSep() { const src = notesSrc(); return src.repo && GH.cred && src.repo !== GH.cred.repo ? src : null; }
async function checkNotesPushed() {
  const src = notesRepoSep(); if (!src) { S.notesPush = null; return; }
  const t = today(), since = new Date(pd(t).setHours(0, 0, 0, 0)).toISOString();
  try {
    const r = await GH.req('GET', `/repos/${encodeURIComponent(src.owner)}/${encodeURIComponent(src.repo)}/commits?since=${encodeURIComponent(since)}&per_page=20`);
    S.notesPush = r.ok ? { date: t, pushed: ((await r.json()) || []).some(x => !/noreply@anthropic\.com/i.test(((x.commit || {}).author || {}).email || '')) } : null;
  } catch (_) { S.notesPush = null; }
  if (S.ready) renderPlan();
}
function notesReminderHtml() {
  const t = today(), np = S.notesPush;
  if (!np || np.date !== t || np.pushed || LS.get('bj-notes-skip') === t) return '';
  const late = new Date().getHours() >= 21 && studyCap(t).cap > 0;
  if (!activity(t) && !late) return '';
  const L = S.lessons.find(l => l.done === t || (l.progressDates || []).includes(t));
  return `<div class="callout notes-rem"><b>📝 Отправь заметки с урока</b><br>GitHub Desktop → поле <b>Summary</b> слева внизу (например «${L ? 'Урок ' + esc(L.n) + (L.title ? ' ' + esc(L.title) : '') : 'Урок'}») → <b>Commit to main</b> → вверху <b>Push origin</b>. Если там <b>Pull origin</b> — сначала её.<div class="acts" style="margin-top:10px"><button type="button" class="btn sm study" data-action="notes-check">Отправил — проверить</button><button type="button" class="btn sm" data-action="notes-skip">Сегодня без заметок</button></div></div>`;
}
function renderPlan() {
  const bn = $('#plan-banner'), st = $('#plan-stats'), tl = $('#plan-tails'), dy = $('#plan-days');
  renderSleep();
  if (!isReady()) { bn.innerHTML = bannerHtml(); st.innerHTML = tl.innerHTML = dy.innerHTML = ''; return; }
  bn.innerHTML = notesReminderHtml() + reviewCardHtml();
  const study = buildStudy(); S.studyCache = study;
  const sport = buildSport(); S.sportList = sport;
  const t = today();
  const s = calcStats(sport);
  st.innerHTML = `<div class="stats"><div class="stat"><div class="k">Спорт · 4 недели</div><div class="v">${s.due ? `${s.done} из ${s.due}` : '— <small>пока нечего считать</small>'}</div></div><div class="stat"><div class="k">Учёба · 4 недели</div><div class="v">${s.les} ${plural(s.les, 'урок', 'урока', 'уроков')} <small>· ${s.skips} ${plural(s.skips, 'пропуск', 'пропуска', 'пропусков')}</small></div></div></div><div class="rev-links"><span>Итоги:</span><button type="button" class="link-btn" data-action="rev-open" data-type="week">неделя</button><button type="button" class="link-btn" data-action="rev-open" data-type="month">месяц</button><button type="button" class="link-btn" data-action="rev-open" data-type="year">год</button></div>`;
  const spT = sport.filter(i => !i.state && i.eff < t && i.eff >= addDays(t, -14));
  const stT = studyTails(7);
  if (spT.length || stT.length) {
    const items = stT.map(d => ({ d, type: 'st' })).concat(spT.map(i => ({ d: i.eff, type: 'sp', i }))).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
    tl.innerHTML = `<h2 class="sec">Не отмечено</h2><div class="stack">${items.map(it => it.type === 'st'
      ? `<div class="tail"><div class="tail-t"><span class="tag study">Учёба</span><span>Окно ${esc(slotLabel(it.d, studyCap(it.d)))}</span><span class="dd">${short(it.d)}</span></div><div class="acts"><button type="button" class="btn sm study" data-action="st-tail-done" data-date="${it.d}">Был урок</button><button type="button" class="btn sm" data-action="st-tail-skip" data-date="${it.d}">Пропустил</button></div></div>`
      : `<div class="tail"><div class="tail-t"><span class="tag sport">Спорт</span><span>${esc(it.i.title)}</span><span class="dd">${short(it.d)}</span></div><div class="acts"><button type="button" class="btn sm sport" data-action="sp-done" data-id="${esc(it.i.id)}">Сделал</button><button type="button" class="btn sm" data-action="sport" data-id="${esc(it.i.id)}">Подробнее</button><button type="button" class="btn sm" data-action="sp-skip" data-id="${esc(it.i.id)}">Пропустил</button></div></div>`).join('')}</div>`;
  } else tl.innerHTML = '';
  let h = '';
  for (let k = 0; k <= HORIZON; k++) {
    const d = addDays(t, k);
    const rows = dayRows(d, study, sport);
    if (k > 0 && dow(d) === 1) h += `<div class="week-sep"><span>Неделя ${dm(d)} – ${dm(addDays(d, 6))}</span></div>`;
    const dd = k <= 1 ? short(d) : dm(d);
    h += `<section class="day${k === 0 ? ' is-today' : ''}${holiday(d) ? ' hol' : ''}"><div class="day-h"><span class="dn">${dayName(d)}</span><span class="dd">${dd}</span><button type="button" class="more" data-action="day" data-date="${d}" aria-label="День ${short(d)}">${DOTS}</button></div>${rows.length ? `<div class="stack">${rows.join('')}</div>` : '<p class="empty-day">Свободный день</p>'}</section>`;
  }
  dy.innerHTML = '<div class="sec-row"><h2 class="sec">Ближайшие три недели</h2><button type="button" class="btn sm" data-action="ev-new">+ Событие</button></div>' + h;
}

/* ---------- calendar ---------- */
function sportMark(d, list) {
  const on = list.filter(i => i.eff === d), away = list.filter(i => i.orig === d && i.eff !== d);
  if (on.some(i => i.state === 'done' || i.state === 'other')) return '<span class="mk sport" title="Тренировка сделана">✓</span>';
  if (on.some(i => i.state === 'skipped')) return '<span class="mk sport x" title="Тренировка пропущена">✕</span>';
  if (on.length) return d < today() ? '<span class="mk sport plan" title="Не отмечено">?</span>' : '<span class="mk sport plan" title="Тренировка по плану"></span>';
  if (away.length) return '<span class="mk sport plan" title="Тренировка перенесена">→</span>';
  return '';
}
function studyMark(d, plan) {
  if (activity(d)) return '<span class="mk study" title="Урок пройден">✓</span>';
  const c = studyCap(d), st = (S.config.study || {}).start || '';
  if (c.blocked && c.base > 0) return '<span class="mk study x" title="Учёба пропущена">✕</span>';
  if (d < today()) return c.cap > 0 && d >= st ? '<span class="mk study plan" title="Не отмечено">?</span>' : '';
  if ((plan.byDate[d] || []).some(e => !e.blocked)) return '<span class="mk study plan" title="Урок по плану"></span>';
  return '';
}
function renderCal() {
  const body = $('#cal-body');
  const p = S.calMonth.split('-').map(Number);
  $('#cal-label').textContent = MON_N[p[1] - 1] + ' ' + p[0];
  if (!isReady()) { body.innerHTML = bannerHtml(); return; }
  const first = S.calMonth + '-01';
  const gridStart = mondayOf(first);
  const last = ds(new Date(p[0], p[1], 0, 12));
  const gridEnd = addDays(mondayOf(last), 6);
  const sport = buildSport(addDays(gridStart, -7), addDays(gridEnd, 7));
  const plan = gridEnd >= today() ? buildStudy(null, gridEnd) : { byDate: {} };
  const t = today();
  let cells = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(x => `<div class="cal-dow">${x}</div>`).join('');
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    const evs = eventsOn(d).length;
    const marks = sportMark(d, sport) + studyMark(d, plan) + (evs ? '<span class="mk ev" title="Событие"></span>'.repeat(Math.min(evs, 2)) : '');
    const ab = absenceOn(d);
    cells += `<button type="button" class="cal-cell${monthKey(d) !== S.calMonth ? ' out' : ''}${d === t ? ' today' : ''}${holiday(d) ? ' hol' : ''}${ab ? ' abs-' + ab.type : ''}" data-action="day" data-date="${d}" aria-label="${esc(longDate(d))}${holiday(d) ? ', ' + esc(holiday(d)) : ''}"><span class="cal-num">${pd(d).getDate()}</span>${dutyOn(d) ? '<span class="cal-duty">Н</span>' : ''}<span class="marks">${marks}</span></button>`;
  }
  body.innerHTML = `<div class="cal-grid">${cells}</div>
    <div class="legend"><span><span class="mk sport">✓</span>сделано</span><span><span class="mk sport plan">→</span>перенесено</span><span><span class="mk sport x">✕</span>пропуск</span><span><span class="mk sport plan"></span>по плану</span><span><span class="mk study">✓</span>учёба</span><span><span class="mk ev"></span>событие</span><span><span class="lg-hol">7</span>праздник</span><span><span class="cal-duty">Н</span>наряд</span></div>
    <p class="note">? — день прошёл, отметки нет</p>`;
}

function renderLessons() {
  const nx = $('#lessons-next'), sl = $('#lessons-slots'), dn = $('#lessons-done'), bn = $('#lessons-banner');
  if (!isReady()) { bn.innerHTML = bannerHtml(); nx.innerHTML = sl.innerHTML = dn.innerHTML = ''; S.slotsSig = ''; return; }
  bn.innerHTML = '';
  const pfc = $('#pf-card'); if (pfc) pfc.innerHTML = pfCardHtml();
  const study = S.studyCache || buildStudy();
  const pend = pendingSorted();
  nx.innerHTML = pend.length
    ? pend.map(l => {
        const f = study.first[l.id];
        const meta = [Number(l.need) === 90 ? '1,5 ч' : Number(l.need) === 60 ? '1 ч' : 'одно окно'];
        if (l.progress) meta.push('сделано ' + dur(l.progress));
        if (Array.isArray(l.goals) && l.goals.length) meta.push(l.goals.length + ' ' + plural(l.goals.length, 'вопрос', 'вопроса', 'вопросов'));
        return `<button type="button" class="row" data-action="lesson" data-id="${esc(l.id)}"><span class="ln">${esc(l.n)}</span><span class="rb"><span class="t">${esc(l.title || 'Тема не задана')}</span><span class="m">${esc(meta.join(' · '))}</span></span><span class="s">${f ? short(f) : 'позже'}</span></button>`;
      }).join('') + '<p class="note">Дальше — уроки без темы.</p>'
    : '<p class="note">Очередь пуста.</p>';
  const slots = (S.config.study || {}).slots || {};
  const sig = JSON.stringify(slots);
  if (sig !== S.slotsSig) {
    S.slotsSig = sig;
    const order = [1, 2, 3, 4, 5, 6, 0];
    sl.innerHTML = `<div class="slots">${order.map(k => {
      const cur = Number(slots[k] || 0);
      const vals = [0, 30, 45, 60, 90, 120]; if (!vals.includes(cur)) vals.push(cur);
      return `<div class="slot"><label for="slot-${k}">${DOW_S[k]}</label><select id="slot-${k}" data-slot="${k}">${vals.sort((a, b) => a - b).map(v => `<option value="${v}"${v === cur ? ' selected' : ''}>${v || '—'}</option>`).join('')}</select></div>`;
    }).join('')}</div>`;
  }
  const done = S.lessons.filter(l => l.done).sort((a, b) => a.done < b.done ? 1 : a.done > b.done ? -1 : (b.n || 0) - (a.n || 0)).slice(0, 40);
  dn.innerHTML = done.length
    ? done.slice(0, S.showAllDone ? 40 : 4).map(l => `<button type="button" class="row is-done" data-action="lesson" data-id="${esc(l.id)}"><span class="ln">${esc(l.n)}</span><span class="rb"><span class="t">${esc(l.title || 'Урок ' + l.n)}</span>${lessonActual(l.n) ? `<span class="m">факт ${hmShort(lessonActual(l.n))} · план ${hmShort(l.need || 60)}</span>` : ''}</span><span class="s">${short(l.done)}</span></button>`).join('')
      + (done.length > 4 ? `<button type="button" class="link-btn" data-action="done-toggle">${S.showAllDone ? 'Свернуть' : `Показать все (${done.length})`}</button>` : '')
    : '<p class="note">Пока пусто.</p>';
  $('#study-ideas').innerHTML = ideasListHtml('study', 3);
  renderCurriculum(study);
  renderNotes();
}

/* ---------- curriculum ---------- */
function renderCurriculum(study) {
  const box = $('#curriculum');
  const blocks = (S.curriculum && S.curriculum.blocks) || [];
  if (!blocks.length) { box.innerHTML = '<p class="note">Пока пусто.</p>'; return; }
  const byN = {}; S.lessons.forEach(l => { byN[Number(l.n)] = l; });
  const firstPending = pendingSorted()[0];
  let nowFound = false;
  box.innerHTML = blocks.map(b => {
    let total = 0, done = 0, hasNext = false;
    const topics = (b.topics || []).map(tp => {
      const ls = (tp.lessons || []).map(n => byN[n]).filter(Boolean);
      const items = tp.items || [];
      total += ls.length + items.length;
      const dn = ls.filter(l => l.done).length; done += dn;
      const next = firstPending && ls.some(l => l.id === firstPending.id);
      if (next) hasNext = true;
      const li = ls.map(l => {
        const cls = l.done ? 'done' : (firstPending && l.id === firstPending.id ? 'next' : '');
        const when = l.done ? short(l.done) : (study.first[l.id] ? '→ ' + short(study.first[l.id]) : '');
        return `<button type="button" class="cur-li ${cls}" data-action="lesson" data-id="${esc(l.id)}"><span class="mk2">${l.done ? '✓' : esc(l.n)}</span><span class="ct">${esc(l.title || 'Урок ' + l.n)}</span><span class="cd">${esc(when)}</span></button>`;
      }).concat(items.map(x => `<div class="cur-li"><span class="mk2">·</span><span class="ct">${esc(x)}</span><span class="cd"></span></div>`)).join('');
      const cnt = ls.length ? `${dn}/${ls.length}` : 'план';
      const key = b.id + '/' + tp.title;
      const open = S.openCur.has(key) || (next && !S.touchedCur.has(key));
      return `<details class="cur-topic" data-key="${esc(key)}"${open ? ' open' : ''}><summary><span>${esc(tp.title)}</span><span class="cd mono">${cnt}</span></summary><div class="cur-list">${li}</div></details>`;
    }).join('');
    const isNow = hasNext && !nowFound; if (isNow) nowFound = true;
    const pct = total ? Math.round(done / total * 100) : 0;
    const open = S.openCur.has(b.id) || (isNow && !S.touchedCur.has(b.id));
    const state = done && done === total ? 'пройден' : isNow ? 'сейчас' : done ? `${done} из ${total}` : 'впереди';
    return `<details class="cur-block${isNow ? ' is-now' : ''}" data-key="${esc(b.id)}"${open ? ' open' : ''}><summary><span class="t">${esc(b.title)}</span><span class="chip${isNow ? ' warn' : done && done === total ? ' good' : ''}">${state}</span>${b.note ? `<span class="m" style="grid-column:1/-1">${esc(b.note)}</span>` : ''}<span class="cur-prog"><i style="width:${pct}%"></i></span></summary><div class="cur-body">${topics}</div></details>`;
  }).join('') + '';
}
document.addEventListener('toggle', ev => {
  const el = ev.target;
  if (!el.matches || !el.matches('details[data-key]')) return;
  const k = el.dataset.key;
  S.touchedCur.add(k);
  if (el.open) S.openCur.add(k); else S.openCur.delete(k);
}, true);

/* ---------- Obsidian notes ---------- */
function notesSrc() {
  const n = (S.config && S.config.notes) || {};
  const repo = n.repo || (GH.cred && GH.cred.repo) || '';
  const path = n.path != null ? n.path : (GH.cred && repo === GH.cred.repo ? 'notes' : '');
  return { owner: (GH.cred && GH.cred.owner) || '', repo, path: String(path).replace(/^\/+|\/+$/g, '') };
}
function repoUrl(src, p) { return `/repos/${encodeURIComponent(src.owner)}/${encodeURIComponent(src.repo)}/contents/${p.split('/').map(encodeURIComponent).join('/')}`; }
async function loadNotes(force) {
  if (!GH.cred || S.notesLoading) return;
  if (S.notes && !force) return;
  const src = notesSrc();
  S.notesLoading = true; S.notesErr = null; renderNotes();
  try {
    const r = await GH.req('GET', `/repos/${encodeURIComponent(src.owner)}/${encodeURIComponent(src.repo)}/git/trees/HEAD?recursive=1`);
    if (r.status === 404 || r.status === 409) { S.notes = { files: [] }; S.notesErr = r.status === 404 ? 'repo' : null; }
    else if (!r.ok) throw GH.fail(r);
    else {
      const j = await r.json();
      const pre = src.path ? src.path + '/' : '';
      const files = (j.tree || []).filter(x => x.type === 'blob' && /\.md$/i.test(x.path) && x.path.startsWith(pre) && !/(^|\/)\.(obsidian|trash|git)\//.test(x.path)).map(x => x.path);
      S.notes = { files, pre, src: src.repo + '/' + src.path };
      LS.set('bj-notes', S.notes);
    }
  } catch (e) { S.notesErr = e.code || 'http'; const c = LS.get('bj-notes'); if (c && !S.notes) S.notes = c; }
  S.notesLoading = false; renderNotes();
}
function renderNotes() {
  const box = $('#notes'); if (!box) return;
  const src = notesSrc();
  if (S.notesLoading && !S.notes) { box.innerHTML = '<p class="loading"><span class="spin" aria-hidden="true"></span>Загружаю заметки…</p>'; return; }
  if (S.notesErr === 'repo' || S.notesErr === 'notfound' || S.notesErr === 'forbidden') { box.innerHTML = `<div class="callout">Не вижу репозиторий <b>${esc(src.repo)}</b>. Проверь, что ключ на телефоне выдан и на него (Contents — Read).</div>`; return; }
  if (!S.notes) { box.innerHTML = '<p class="note">Открою, когда зайдёшь во вкладку.</p>'; return; }
  const files = S.notes.files || [];
  if (!files.length) { box.innerHTML = `<p class="note">Заметок пока нет в <span class="mono">${esc(src.repo)}${src.path ? '/' + esc(src.path) : ''}</span>. Нажми «Настроить» — там написано, как их туда положить.</p>`; return; }
  const tree = {};
  for (const f of files) {
    const parts = f.slice((S.notes.pre || '').length).split('/');
    let node = tree;
    parts.slice(0, -1).forEach(p => { node[p] = node[p] || {}; node = node[p]; });
    (node.__files = node.__files || []).push(f);
  }
  const coll = new Intl.Collator('ru', { numeric: true });
  const draw = (node, path) => Object.keys(node).filter(k => k !== '__files').sort(coll.compare).map(k => {
    const key = 'nt:' + path + '/' + k;
    return `<details class="nt-dir" data-key="${esc(key)}"${S.openCur.has(key) ? ' open' : ''}><summary>${esc(k)}</summary>${draw(node[k], path + '/' + k)}</details>`;
  }).join('') + (node.__files || []).sort(coll.compare).map(f => `<button type="button" class="nt-file" data-action="note" data-path="${esc(f)}">${esc(f.split('/').pop().replace(/\.md$/i, ''))}</button>`).join('');
  box.innerHTML = draw(tree, '') + `<p class="note">${files.length} ${plural(files.length, 'заметка', 'заметки', 'заметок')}${S.notesErr ? ' · показаны сохранённые, обновить не удалось' : ''} · <button type="button" class="link-btn" data-action="notes-reload">обновить</button></p>`;
}
function inlineMd(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = esc(s);
  s = s.replace(/!\[\[([^\]]+)\]\]/g, (_, t) => `<span class="chip">вложение: ${t}</span>`);
  s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, a) => `<button type="button" class="wl" data-action="note-link" data-name="${t.trim().replace(/#/g, '&#35;')}">${(a || t).trim().replace(/#/g, '&#35;')}</button>`);
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, a) => `<span class="chip">картинка${a ? ': ' + a : ''}</span>`);
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/__([^_]+)__/g, '<b>$1</b>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>');
  s = s.replace(/(^|\s)#([\wа-яё\-\/]+)/gi, '$1<span class="tag-h">#$2</span>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`);
}
function renderMd(text) {
  const lines = String(text || '').replace(/\r/g, '').replace(/^---\n[\s\S]*?\n---\n?/, '').split('\n');
  let out = '', i = 0, para = [];
  const flush = () => { if (para.length) { out += '<p>' + para.map(inlineMd).join('<br>') + '</p>'; para = []; } };
  while (i < lines.length) {
    const l = lines[i];
    let m;
    if ((m = /^\s*(```|~~~)(.*)$/.exec(l))) {
      flush(); const fence = m[1], buf = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) buf.push(lines[i++]);
      i++; out += `<pre><code>${esc(buf.join('\n'))}</code></pre>`; continue;
    }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { flush(); const n = Math.min(4, m[1].length); out += `<h${n}>${inlineMd(m[2])}</h${n}>`; i++; continue; }
    if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(l)) { flush(); out += '<hr>'; i++; continue; }
    if (/^\s*>/.test(l)) { flush(); const buf = []; while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, '')); out += `<blockquote>${renderMd(buf.join('\n'))}</blockquote>`; continue; }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush(); const row = s => s.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = row(l); i += 2; const body = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) body.push(row(lines[i++]));
      out += `<table><thead><tr>${head.map(c => `<th>${inlineMd(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${inlineMd(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`; continue;
    }
    if ((m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(l))) {
      flush(); const ordered = /\d/.test(m[2]); const items = [];
      while (i < lines.length && (m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]))) {
        const ind = m[1].replace(/\t/g, '    ').length;
        let txt = m[3].replace(/^\[ \]\s*/, '☐ ').replace(/^\[x\]\s*/i, '☑ ');
        items.push(`<li${ind >= 2 ? ' style="margin-left:' + Math.min(3, Math.floor(ind / 2)) * 14 + 'px"' : ''}>${inlineMd(txt)}</li>`); i++;
      }
      out += ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`; continue;
    }
    if (!l.trim()) { flush(); i++; continue; }
    para.push(l); i++;
  }
  flush();
  return out;
}
async function openNote(path) {
  const src = notesSrc();
  const name = path.split('/').pop().replace(/\.md$/i, '');
  const folder = path.slice((S.notes && S.notes.pre || '').length).split('/').slice(0, -1).join(' / ');
  S.cur = { type: 'note', path };
  const show = txt => openSheet(`<p class="sh-meta">${esc(folder || 'Заметки')}</p><h2 class="sh-title">${esc(name)}</h2><div class="md">${txt == null ? '<p class="loading"><span class="spin" aria-hidden="true"></span>Открываю…</p>' : renderMd(txt)}</div>`);
  if (S.noteCache[path] != null) { show(S.noteCache[path]); return; }
  show(null);
  try {
    const r = await GH.req('GET', repoUrl(src, path));
    if (!r.ok) throw GH.fail(r);
    const j = await r.json();
    S.noteCache[path] = b64dec(j.content || '');
    if (S.cur && S.cur.type === 'note' && S.cur.path === path) show(S.noteCache[path]);
  } catch (e) { if (S.cur && S.cur.path === path) openSheet(`<h2 class="sh-title">${esc(name)}</h2><p class="err">Не открылась: ${esc(errText(e))}</p>`); }
}
function openNotesSetup() {
  const src = notesSrc();
  S.cur = { type: 'notes-setup' };
  openSheet(`<h2 class="sh-title">Заметки Obsidian на телефоне</h2>
    
    <ol class="ing">
      <li>GitHub Desktop → войди как gr0mbl4 → File → Add local repository → выбери папку хранилища Obsidian → «create a repository» → Create repository.</li>
      <li>Repository → Repository settings → Ignored files: впиши <span class="mono">.obsidian/</span> и <span class="mono">.trash/</span> (настройки и корзину отправлять не нужно).</li>
      <li>Publish repository → имя <span class="mono">obsidian</span> → галочка <b>Keep this code private</b> → Publish.</li>
      <li>GitHub → Settings → Developer settings → Fine-grained tokens → <span class="mono">journal-phone</span> → Edit → Repository access → добавь <span class="mono">obsidian</span>. Права у ключа одни на все его репозитории.</li>
      <li>Чтобы заметки видел Claude: github.com/settings/installations → Claude → Configure → добавь <span class="mono">obsidian</span>.</li>
      <li>Ниже впиши <span class="mono">obsidian</span>, папку оставь пустой → Сохранить. После урока в GitHub Desktop: Commit to main → Push origin.</li>
    </ol>
    <label class="fld" for="nt-repo">Репозиторий с заметками</label><input id="nt-repo" autocapitalize="off" spellcheck="false" value="${esc(src.repo)}" placeholder="obsidian">
    <label class="fld" for="nt-path">Папка внутри (если заметки не в корне)</label><input id="nt-path" autocapitalize="off" spellcheck="false" value="${esc(src.path)}" placeholder="пусто — весь репозиторий">
    <div class="sh-acts"><button type="button" class="btn study block" data-action="notes-save">Сохранить</button></div>`);
}

function renderMoney() {
  ensurePeriod();
  $('#m-label').textContent = periodLabel(S.period);
  $('#m-next').disabled = periodShift(S.period, 1) > today();
  const curSel = $('#m-cur');
  if (document.activeElement !== curSel) curSel.value = curSym();
  const perSel = $('#m-period');
  if (document.activeElement !== perSel) {
    const P = pStartDay();
    const opts = [1, 5, 10, 15, 20, 21, 25]; if (!opts.includes(P)) opts.push(P);
    perSel.innerHTML = opts.sort((a, b) => a - b).map(v => `<option value="${v}"${v === P ? ' selected' : ''}>${v === 1 ? 'с 1-го числа' : `с ${v}-го`}</option>`).join('');
  }
  const sm = $('#money-summary'), ls = $('#money-list'), ib = $('#money-inbox');
  $('#money-accounts').innerHTML = S.ready && S.config ? accountsHtml() : '';
  const mp = $('#money-plan'); if (mp) mp.innerHTML = moneyPlanHtml();
  renderDayChip();
  ib.innerHTML = S.inbox.length ? `<div class="inbox">Фото ждут разбора: <b>${S.inbox.length}</b>. Разберу, когда позовёшь.</div>` : '';
  const loaded = periodMonths(S.period).every(mk => S.money[mk]);
  if (!loaded) { sm.innerHTML = S.ready ? '<p class="loading"><span class="spin" aria-hidden="true"></span>Загружаю…</p>' : bannerHtml(); ls.innerHTML = ''; return; }
  const items = periodItems(S.period);
  const cur = curSym();
  const sum = f => items.filter(f).reduce((a, x) => a + (Number(x.amount) || 0), 0);
  const internal = x => kindOf(x) === 'transfer' && x.cat === 'Свои счета';
  const spend = sum(x => kindOf(x) === 'spend'), income = sum(x => kindOf(x) === 'income');
  const cash = sum(x => kindOf(x) === 'cash');
  const trCats = {};
  items.filter(x => kindOf(x) === 'transfer' && !internal(x)).forEach(x => { const c = x.cat || 'Переводы'; trCats[c] = (trCats[c] || 0) + (x.dir === 'in' ? 1 : -1) * (Number(x.amount) || 0); });
  const trSum = Object.values(trCats).reduce((a, v) => a + v, 0);
  const bal = income - spend - cash + trSum;
  const trLabel = (c, v) => c === 'Накопления' ? (v < 0 ? 'Отложено в накопления' : 'Взял из накоплений') : c === 'Долги' ? (v < 0 ? 'Погашение долгов' : 'Взял в долг') : c;
  const t = today(), pEnd = periodEnd(S.period);
  const days = t >= S.period && t <= pEnd ? daysBetween(S.period, t) + 1 : daysBetween(S.period, pEnd) + 1;
  const byCat = {};
  items.filter(x => kindOf(x) === 'spend').forEach(x => { const c = x.cat || otherCat(); byCat[c] = (byCat[c] || 0) + (Number(x.amount) || 0); });
  const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = rows.length ? rows[0][1] : 1;
  const byTr = {};
  items.filter(x => kindOf(x) === 'transfer' && x.dir !== 'in' && !internal(x)).forEach(x => { byTr[x.name] = (byTr[x.name] || 0) + (Number(x.amount) || 0); });
  const trRows = Object.entries(byTr).sort((a, b) => b[1] - a[1]).slice(0, 6);
  let html = `<div class="total-block"><div class="total-k">Потрачено</div><div class="total">${fmt(spend)}<span class="cur">${esc(cur)}</span></div><div class="total-sub">${spend ? `в среднем ${fmt(spend / Math.max(1, days))} ${esc(cur)} в день` : 'трат пока нет'}</div></div>`;
  if (income || cash || Object.keys(trCats).length) {
    const sig = v => (v >= 0 ? '+' : '−') + fmt(Math.abs(v));
    html += `<div class="kv"><span>Доход</span><span class="v pos">+${fmt(income)}</span>`
      + `<span>Траты</span><span class="v">−${fmt(spend)}</span>`
      + (cash ? `<span>Наличные</span><span class="v">−${fmt(cash)}</span>` : '')
      + Object.entries(trCats).sort((a, b) => a[1] - b[1]).map(([c, v]) => `<span>${esc(trLabel(c, v))}</span><span class="v">${sig(v)}</span>`).join('')
      + `<span class="sum">Итог периода</span><span class="v sum${bal >= 0 ? ' pos' : ''}">${sig(bal)}</span></div>`
      + (trCats['Не разобрано'] ? '' : '')
      + '';
  }
  if (rows.length && spend > 0) html += `<h2 class="sec">Траты по категориям</h2><div class="cats">${rows.map(([c, v]) => `<div class="cat"><span class="cn">${esc(c)}</span><span class="ca">${fmt(v)}<span class="pc">${Math.round(v / spend * 100)}%</span></span><span class="bar"><i style="width:${Math.max(2, v / max * 100).toFixed(1)}%"></i></span></div>`).join('')}</div>`;
  html += spendChartHtml();
  if (trRows.length) html += `<h2 class="sec">Куда ушли переводы</h2><div class="kv">${trRows.map(([n, v]) => `<span>${esc(n)}</span><span class="v">${fmt(v)}</span>`).join('')}</div>`;
  sm.innerHTML = html;
  if (!items.length) { ls.innerHTML = '<p class="note">В этом периоде записей нет.</p>'; return; }
  const groups = {};
  items.forEach(x => { (groups[x.date] = groups[x.date] || []).push(x); });
  const dates = Object.keys(groups).sort().reverse();
  ls.innerHTML = '<h2 class="sec">Записи</h2>' + dates.map(d => {
    const g = groups[d].slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const daySpend = g.filter(x => kindOf(x) === 'spend').reduce((a, x) => a + (Number(x.amount) || 0), 0);
    return `<div class="mday"><div class="mday-h"><span>${short(d)}</span><span>${daySpend ? fmt(daySpend) + ' ' + esc(cur) : ''}</span></div>${g.map(x => {
      const k = kindOf(x);
      const amt = k === 'income' ? `<span class="ma in">+${fmt(x.amount)}</span>` : k === 'transfer' ? `<span class="ma tr">${x.dir === 'in' ? '← ' : '→ '}${fmt(x.amount)}</span>` : k === 'cash' ? `<span class="ma tr">нал. ${fmt(x.amount)}</span>` : `<span class="ma">${fmt(x.amount)}</span>`;
      const bank = bankName(x.acc);
      const sub = (k === 'spend' ? (x.cat || otherCat()) : internal(x) ? 'Между своими счетами' : KIND_NAMES[k] + (x.cat && x.cat !== KIND_NAMES[k] ? ' · ' + x.cat : '')) + (bank ? ' · ' + bank : '') + (x.src === 'auto:sms' ? ' · из SMS' : '') + (x.auto ? ' · уточнит Claude' : '') + (x.group ? ' · ' + x.group : '');
      return `<button type="button" class="mrow" data-action="mrow" data-id="${esc(x.id)}"><span class="mn">${esc(x.name)}</span><span class="mc">${esc(sub)}</span>${amt}</button>`;
    }).join('')}</div>`;
  }).join('');
}

/* ---------- for Claude: requests and ideas ---------- */
// Непрочитанные ответы: ключ — id + длина ответа, так новый или изменённый ответ снова подсвечивается.
function answerKeys() {
  return S.requests.filter(r => r.answer).map(r => 'q:' + r.id + ':' + String(r.answer).length)
    .concat(S.ideas.filter(x => x.answer).map(x => 'i:' + x.id + ':' + String(x.answer).length));
}
function unseenAnswers() { const seen = new Set(LS.get('bj-seen-ans') || []); return answerKeys().filter(k => !seen.has(k)).length; }
function markAnswersSeen() { LS.set('bj-seen-ans', answerKeys()); renderClaudeBtn(); }
function renderClaudeBtn() {
  const b = $('#claude-fab'), c = $('#req-count'); if (!b || !c) return;
  const n = unseenAnswers();
  c.textContent = n; c.hidden = !n;
  b.classList.toggle('has-new', n > 0);
  b.setAttribute('aria-label', 'Claude: запросы, идеи и ответы' + (n ? ` — новых ответов: ${n}` : ''));
  const sm = b.querySelector('small'); if (sm) sm.textContent = n ? (n === 1 ? 'есть ответ' : 'есть ответы') : 'запросы и идеи';
}
const byNewest = (a, b) => (b.ts || 0) - (a.ts || 0) || ((b.date || '') < (a.date || '') ? -1 : (b.date || '') > (a.date || '') ? 1 : 0);
const IDEA_AREA = { sport: 'спорт', study: 'учёба' };
function ideasListHtml(area, limit) {
  const list = S.ideas.filter(x => x.area === area).sort(byNewest);
  if (!list.length) return limit ? `<p class="note">Пока пусто.</p>` : '<p class="note">Пока пусто.</p>';
  const rows = list.slice(0, limit || 50).map(x => {
    const files = (x.media || []).length;
    const meta = [x.date ? short(x.date) : '', x.frames ? 'видео: ' + x.frames + ' ' + plural(x.frames, 'кадр', 'кадра', 'кадров') : files ? files + ' ' + plural(files, 'файл', 'файла', 'файлов') : '', x.failed ? 'не дошло файлов: ' + x.failed : '', x.link ? 'ссылка' : '', x.status === 'seen' ? 'разобрано' : 'ждёт'].filter(Boolean).join(' · ');
    return `<div class="req-item"><div>${esc(x.title || x.text || x.link || 'Без описания')}</div>${x.title && x.text ? `<div class="m">${esc(x.text)}</div>` : ''}${x.answer ? `<div class="ans">${esc(x.answer)}</div>` : ''}<div class="req-meta"><span>${esc(meta)}</span>${limit ? '' : `<button type="button" class="btn sm" data-action="idea-del" data-id="${esc(x.id)}">Удалить</button>`}</div></div>`;
  }).join('');
  return `<div class="stack">${rows}</div>` + (limit && list.length > limit ? `<button type="button" class="link-btn" data-action="ideas" data-area="${area}">Все идеи (${list.length})</button>` : '');
}
function openRequests(tab, keepScroll) {
  tab = tab || (S.cur && S.cur.type === 'req' ? S.cur.tab : 'req') || 'req';
  const editId = S.cur && S.cur.type === 'req' ? S.cur.editId : null;
  S.cur = { type: 'req', tab, editId };
  const seg = `<div class="seg4" role="group" aria-label="Раздел">${[['req', 'Запросы'], ['sport', 'Идеи: спорт'], ['study', 'Идеи: учёба']].map(([k, l]) => `<button type="button" data-action="req-tab" data-tab="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div>`;
  let body;
  if (tab === 'req') {
    const open = S.requests.filter(r => r.status !== 'done').sort(byNewest);
    const done = S.requests.filter(r => r.status === 'done').sort((a, b) => (b.doneAt || '') < (a.doneAt || '') ? -1 : (b.doneAt || '') > (a.doneAt || '') ? 1 : byNewest(a, b)).slice(0, 15);
    body = `
    <label class="fld" for="rq-text">Новый запрос</label><textarea id="rq-text" rows="3" placeholder="Например: добавь в программу подтягивания"></textarea>
    <div class="sh-acts"><button type="button" class="btn primary block" data-action="rq-add">Записать</button></div>
    ${open.length ? `<h3 class="sec">Ждут: ${open.length}</h3><div class="stack">${open.map(r => r.id === editId
      ? `<div class="req-item"><textarea id="rq-edit" rows="4">${esc(r.text)}</textarea><div class="req-meta"><button type="button" class="btn sm" data-action="rq-edit-cancel">Отмена</button><button type="button" class="btn sm study" data-action="rq-edit-save" data-id="${esc(r.id)}">Сохранить</button></div></div>`
      : `<div class="req-item"><div>${esc(r.text)}</div>${r.answer ? `<div class="ans">Claude: ${esc(r.answer)}</div>` : ''}<div class="req-meta"><span>${r.date ? short(r.date) : ''}${r.status === 'waiting' ? ' · ждёт тебя' : ''}</span><button type="button" class="btn sm" data-action="rq-edit" data-id="${esc(r.id)}">Изменить</button><button type="button" class="btn sm" data-action="rq-del" data-id="${esc(r.id)}">Удалить</button></div></div>`).join('')}</div>` : '<p class="note">Новых запросов нет.</p>'}
    ${done.length ? `<h3 class="sec">Сделано</h3><div class="stack">${done.map(r => `<div class="req-item"><div>${esc(r.text)}</div>${r.answer ? `<div class="ans">${esc(r.answer)}</div>` : ''}<div class="req-meta"><span>${r.doneAt ? 'сделано ' + short(r.doneAt) : 'сделано'}</span></div></div>`).join('')}</div>` : ''}`;
  } else {
    body = `
    <label class="fld" for="id-text">Что это и зачем (коротко)</label><textarea id="id-text" rows="2" placeholder="${tab === 'sport' ? 'Например: жим Свенда вместо обратной бабочки?' : 'Например: видео про сети в Docker'}"></textarea>
    <label class="fld" for="id-link">Ссылка</label><input id="id-link" type="url" inputmode="url" placeholder="https://…">
    <label class="btn block file-btn" style="margin-top:10px"><span id="id-files-label">Добавить фото или видео</span><input type="file" id="id-files" accept="image/*,video/*" multiple aria-label="Фото или видео"></label>
    <p class="note">Видео режется на кадры. Звук не слышу — важное допиши текстом.</p>
    <div class="sh-acts"><button type="button" class="btn primary block" data-action="idea-save" data-area="${tab}">Сохранить идею</button></div>
    <h3 class="sec">Все идеи · ${IDEA_AREA[tab]}</h3>${ideasListHtml(tab, 0)}`;
  }
  openSheet(`<h2 class="sh-title sh-claude"><span class="cf-dot" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2.5c.5 4.6 2.4 6.5 7 7-4.6.5-6.5 2.4-7 7-.5-4.6-2.4-6.5-7-7 4.6-.5 6.5-2.4 7-7z" fill="currentColor"/></svg></span>Связь с Claude</h2>${seg}${body}`, keepScroll);
  markAnswersSeen();
}
function seekTo(v, t) {
  return new Promise(res => {
    let to = 0;
    const h = () => { clearTimeout(to); v.removeEventListener('seeked', h); res(); };
    to = setTimeout(h, 5000);
    v.addEventListener('seeked', h);
    try { v.currentTime = t; } catch (_) { h(); }
  });
}
function blankFrame(ctx, w, h) {
  try { const d = ctx.getImageData(0, 0, w, h).data; let s = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 499) { s += d[i] + d[i + 1] + d[i + 2]; n++; } return n > 0 && s / n < 8; } catch (_) { return false; }
}
// Кадры из видео прямо на телефоне: Claude всё равно смотрит видео по кадрам, а оригинал бывает на сотни мегабайт и с геометкой.
function videoFrames(file, max) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file), v = document.createElement('video'), out = [];
    let done = false, kill = 0;
    const finish = () => { if (done) return; done = true; clearTimeout(kill); try { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); } catch (_) {} URL.revokeObjectURL(url); resolve(out); };
    kill = setTimeout(finish, 150000);
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    v.addEventListener('error', finish);
    v.addEventListener('loadedmetadata', async () => {
      try {
        try { await v.play(); v.pause(); } catch (_) {}
        const d = v.duration, W = v.videoWidth, H = v.videoHeight;
        if (!isFinite(d) || d <= 0 || !W || !H) return finish();
        const n = Math.max(1, Math.min(max, Math.ceil(d / 2)));
        const sc = Math.min(1, 1080 / Math.max(W, H));
        const c = document.createElement('canvas'); c.width = Math.round(W * sc); c.height = Math.round(H * sc);
        const ctx = c.getContext('2d');
        for (let i = 0; i < n && !done; i++) {
          setSync(`кадры из видео: ${i + 1} из ${n}…`);
          await seekTo(v, Math.min(d - 0.05, d / n * (i + 0.5)));
          ctx.drawImage(v, 0, 0, c.width, c.height);
          if (blankFrame(ctx, c.width, c.height)) continue;
          const u = c.toDataURL('image/jpeg', 0.75);
          out.push({ t: Math.round(d / n * (i + 0.5) * 10) / 10, b64: u.slice(u.indexOf(',') + 1) });
        }
      } catch (_) {}
      finish();
    }, { once: true });
    document.body.appendChild(v);
    v.src = url; v.load();
  });
}
const isVideo = f => /^video\//.test(f.type || '') || /\.(mov|mp4|m4v|3gp)$/i.test(f.name || '');
// Все файлы уходят одной фиксацией (Git Data API). failed — номера файлов, которые не получилось подготовить или отправить.
async function uploadFiles(files, prefix, label) {
  const out = { media: [], photos: [], frames: 0, failed: [] };
  const batch = [];
  for (let k = 0; k < files.length; k++) {
    const f = files[k];
    setSync(`готовлю файл ${k + 1} из ${files.length}…`);
    try {
      if (isVideo(f)) {
        const fr = await videoFrames(f, 24);
        if (!fr.length) { out.failed.push(k + 1); continue; }
        fr.forEach((x, i) => batch.push({ path: `${prefix}_${k + 1}_f${pad(i + 1)}.jpg`, b64: x.b64, photo: true }));
        out.frames += fr.length;
      } else {
        batch.push({ path: `${prefix}_${k + 1}.jpg`, b64: await resizeImage(f), photo: true, k: k + 1 });
      }
    } catch (_) { out.failed.push(k + 1); }
  }
  if (!batch.length) return out;
  try {
    await GH.commitFiles(batch, `${label}: ${batch.length} ${plural(batch.length, 'файл', 'файла', 'файлов')}`, (i, n) => setSync(`отправляю ${i} из ${n}…`));
    batch.forEach(b => { out.media.push(b.path); if (b.photo) out.photos.push(b.path); });
  } catch (e) {
    console.warn(e);
    // запасной путь — по одному файлу через Contents API
    for (const b of batch) {
      try { await GH.putRaw(b.path, b.b64, `${label}: ${b.path.split('/').pop()}`); out.media.push(b.path); if (b.photo) out.photos.push(b.path); }
      catch (e2) { setSync(errText(e2), true); if (b.k && !out.failed.includes(b.k)) out.failed.push(b.k); }
    }
  }
  setSync(syncLabel());
  return out;
}
function uploadReport(up, total) {
  const bits = [];
  if (up.frames) bits.push(`из видео — ${up.frames} ${plural(up.frames, 'кадр', 'кадра', 'кадров')}`);
  if (up.failed.length) bits.push(`не загрузилось: ${up.failed.length === total ? 'ни одного файла' : '№ ' + up.failed.join(', ')}`);
  return bits.join(' · ');
}
async function ideaSave(btn, area) {
  const text = ($('#id-text').value || '').trim(), link = ($('#id-link').value || '').trim();
  const files = Array.from(($('#id-files') && $('#id-files').files) || []);
  if (!text && !link && !files.length) { toast('Добавь описание, ссылку или файл'); return; }
  busy(btn, true);
  const id = 'i' + rid().slice(0, 10);
  const up = files.length ? await uploadFiles(files, `inbox/ideas/${id}`, 'Идея') : { media: [], photos: [], frames: 0, failed: [] };
  if (files.length && !up.media.length) {
    busy(btn, false);
    toast('Файлы не загрузились — идея не сохранена. Проверь связь и нажми ещё раз; видео дольше пары минут лучше обрезать.');
    return;
  }
  const rec = { id, area, date: today(), ts: Date.now(), status: 'new' };
  if (text) rec.text = text; if (link) rec.link = link; if (up.media.length) rec.media = up.media;
  if (up.frames) rec.frames = up.frames;
  if (up.failed.length) rec.failed = up.failed.length;
  const ok = await writeIdeas(list => { list.push(rec); }, `Идея (${IDEA_AREA[area]}): ${(text || link || 'файлы').slice(0, 50)}`);
  busy(btn, false);
  const rep = uploadReport(up, files.length);
  if (ok) { toast('Идея сохранена' + (rep ? ' · ' + rep : '') + '. Посмотрю, когда позовёшь.'); openRequests(area); }
}

/* ---------- sheet + toast ---------- */
function openSheet(html, keepScroll) {
  const sh = $('#sheet');
  const panel = sh.querySelector('.sheet-panel');
  const top = panel.scrollTop;
  $('#sheet-body').innerHTML = html;
  const wasHidden = sh.hidden;
  sh.hidden = false;
  document.body.classList.add('locked');
  panel.scrollTop = keepScroll && !wasHidden ? top : 0;
  if (wasHidden && panel.style) { panel.style.transform = ''; panel.classList.remove('drag', 'snap'); }
  if (wasHidden) setTimeout(() => { try { panel.focus({ preventScroll: true }); } catch (_) { panel.focus(); } }, 20);
}
function closeSheet() {
  S.cur = null; $('#sheet').hidden = true; document.body.classList.remove('locked');
  const p = document.querySelector('.sheet-panel'); if (p && p.style) { p.style.transform = ''; p.classList.remove('drag', 'snap'); }
}
(function sheetSwipe() {
  const panel = document.querySelector('.sheet-panel');
  if (!panel || !panel.addEventListener) return;
  let y0 = 0, x0 = 0, dy = 0, mode = null, fromTop = false;
  panel.addEventListener('touchstart', e => {
    const t = e.touches[0]; y0 = t.clientY; x0 = t.clientX; dy = 0; mode = null;
    fromTop = !!(e.target.closest && e.target.closest('#sheet-top'));
    if (e.target.closest && e.target.closest('input,textarea,select,.rc-photos,.md pre,.md table')) mode = 'skip';
  }, { passive: true });
  panel.addEventListener('touchmove', e => {
    if (mode === 'skip' || mode === 'scroll') return;
    const t = e.touches[0], ddy = t.clientY - y0, ddx = t.clientX - x0;
    if (!mode) {
      if (Math.abs(ddy) < 6 && Math.abs(ddx) < 6) return;
      if (ddy > 0 && Math.abs(ddy) > Math.abs(ddx) && (fromTop || panel.scrollTop <= 0)) { mode = 'drag'; panel.classList.add('drag'); panel.classList.remove('snap'); }
      else { mode = 'scroll'; return; }
    }
    dy = Math.max(0, ddy);
    panel.style.transform = `translateY(${dy}px)`;
    e.preventDefault();
  }, { passive: false });
  const end = () => {
    if (mode !== 'drag') { mode = null; return; }
    panel.classList.remove('drag'); panel.classList.add('snap');
    if (dy > 110) { panel.style.transform = 'translateY(100%)'; setTimeout(closeSheet, 180); }
    else panel.style.transform = '';
    mode = null;
  };
  panel.addEventListener('touchend', end);
  panel.addEventListener('touchcancel', end);
})();
let toastT;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, String(msg).length > 70 ? 6500 : 3400); }
function busy(btn, on) { if (btn) btn.disabled = on; }

/* ---------- study actions ---------- */
function lessonInfo(doc) {
  if (!doc) return '<p class="note">Вопросов пока нет.</p>';
  let h = '';
  if (doc.outcome) h += `<div class="outcome"><b>Чему научишься</b>${esc(doc.outcome)}</div>`;
  if (Array.isArray(doc.goals) && doc.goals.length) h += `<ul class="goals">${doc.goals.map(g => `<li>${esc(g)}</li>`).join('')}</ul>`;
  else h += '<p class="note">Вопросов пока нет.</p>';
  return h;
}
function openStudy(d, key, part) {
  const pick = st => st.entries.find(x => x.date === d && x.L.key === key && x.part === part);
  let e = pick(S.studyCache || buildStudy());
  if (!e) e = pick(buildStudy(null, d));
  if (!e) return;
  S.cur = { type: 'study', e };
  const L = e.L, multi = e.total > 1;
  const doneLabel = (L.need == null || e.last) ? 'Сделал урок' : 'Сделал часть ' + e.part;
  openSheet(`<div class="sh-eyebrow"><span class="tag study">Учёба</span></div>
    <h2 class="sh-title">${esc(lessonTitle(L))}</h2>
    <p class="sh-meta">${esc(cap1(longDate(d)))} · ${esc(slotLabel(d, { cap: e.cap, extra: e.extra }))}${multi ? ` · часть ${e.part} из ${e.total}` : ''}</p>
    ${lessonInfo(L.doc)}
    ${multi ? `` : ''}
    <div class="sh-acts">
      <button type="button" class="btn study block" data-action="study-done">${doneLabel}</button>
      ${d === today() && !timerState() ? `<button type="button" class="btn block" data-action="timer-start" data-n="${esc(L.n)}">▶ Засечь время</button>` : ''}
      ${L.placeholder ? `<button type="button" class="btn block" data-action="lesson-ph" data-n="${L.n}">Задать тему</button>` : `<button type="button" class="btn block" data-action="lesson" data-id="${esc(L.key)}">Изменить урок</button>`}
    </div>
    <details class="more-box"><summary>Не получится в этот день</summary>
      <label class="fld" for="st-reason" style="margin-top:0">Причина (я потом посмотрю)</label><textarea id="st-reason" rows="2" placeholder="Например: наряд, устал после смены"></textarea>
      <div class="sh-acts"><button type="button" class="btn block" data-action="study-block" data-date="${d}">Снять окно — урок уйдёт дальше</button></div>
    </details>`);
}
function reasonVal(id) { const el = document.getElementById(id); return el ? (el.value || '').trim() : ''; }
function openAddStudy(d) {
  const t = today(), pend = pendingSorted().slice(0, 6), c = S.config.study ? studyCap(d) : { cap: 0 };
  S.cur = { type: 'add-study', d };
  let h = `<h2 class="sh-title">Учёба · ${esc(longDate(d))}</h2>`;
  if (d <= t) {
    h += `<p class="sh-meta">Отметь, какой урок был в этот день.</p><div class="stack" style="margin-top:10px">${pend.map(l => `<button type="button" class="row slim" data-action="study-on" data-id="${esc(l.id)}" data-date="${d}"><span class="ln">${esc(l.n)}</span><span class="rb"><span class="t">${esc(l.title || 'Тема не задана')}</span></span><span class="s">✓</span></button>`).join('') || '<p class="note">Очередь пуста.</p>'}</div>`;
  }
  if (d >= t) {
    if (c.blocked) h += `<div class="sh-acts"><button type="button" class="btn study block" data-action="unblock" data-date="${d}">Вернуть окно (${dur(c.base)})</button></div>`;
    else if (c.cap > 0) h += `<p class="note">В этот день уже есть окно для учёбы (${esc(slotLabel(d, c))}). Урок стоит в плане.</p>`;
    else h += `<div class="sh-acts two"><button type="button" class="btn study" data-action="day-extra" data-date="${d}" data-min="60">+ окно 1 ч</button><button type="button" class="btn study" data-action="day-extra" data-date="${d}" data-min="90">+ окно 1,5 ч</button></div>`;
  }
  openSheet(h);
}
function openAddSport(d) {
  const ses = (S.config.sport || {}).sessions || {};
  S.cur = { type: 'add-sport', d };
  openSheet(`<h2 class="sh-title">Тренировка · ${esc(longDate(d))}</h2>
    
    <div class="sess-list" style="margin-top:12px">${Object.keys(ses).map(k => `<button type="button" class="btn block" data-action="add-sport-key" data-key="${esc(k)}" data-date="${d}">${esc(ses[k].title)}${ses[k].sub ? ` <span class="btn-sub">· ${esc(ses[k].sub)}</span>` : ''}</button>`).join('')}</div>
    <label class="fld" for="as-custom">Или своя — каждое упражнение с новой строки</label><textarea id="as-custom" rows="3" placeholder="Бег 5 км&#10;Подтягивания&#10;Планка"></textarea>
    <div class="sh-acts"><button type="button" class="btn sport block" data-action="add-sport-custom" data-date="${d}">Добавить свою</button></div>`);
}
async function addSport(d, key, custom) {
  const id = d + '_x' + rid().slice(0, 6);
  const ok = await writePlan(p => {
    p.sportExtra.push({ id, date: d, key: custom ? 'custom' : key });
    if (custom) setMove(p, id, { custom });
  }, `Спорт: добавлена тренировка ${d}`);
  if (ok) { toast('Тренировка добавлена'); openSport(id); }
}
async function studyOn(id, d) {
  const l = S.lessons.find(x => x.id === id); if (!l) return;
  let ok = await writeLessons(list => { const x = list.find(y => y.id === id); if (x) x.done = d; }, `Учёба: урок ${l.n} пройден ${d}`);
  if (ok && S.studyDays[d] && S.studyDays[d].blocked) ok = await writePlan(p => { delete p.studyDays[d]; }, `Учёба: окно ${d} восстановлено — урок был`);
  if (ok) { closeSheet(); toast(`Урок ${l.n} отмечен на ${short(d)} · +${XP.lesson} XP` + (d === today() && notesRepoSep() ? '. Не забудь заметки: GitHub Desktop → Commit → Push' : '')); if (d === today()) checkNotesPushed(); if (!S.skipActual) openActual(l.n, d, l.need || 60); S.skipActual = false; }
}
function createUpToIn(list, n, extra) {
  const nums = list.map(l => Number(l.n) || 0);
  const start = Math.max(10, ...nums) + 1;
  const base = Math.max(0, ...list.map(ord)) + 1;
  for (let k = start; k < n; k++) list.push({ id: 'l' + k, n: k, title: '', order: base + (k - start) });
  const existing = list.find(l => Number(l.n) === n);
  if (existing) Object.assign(existing, extra);
  else list.push(Object.assign({ id: 'l' + n, n, title: '', order: base + Math.max(0, n - start) }, extra));
}
async function studyDone(e, when) {
  const L = e.L;
  let ok;
  if (L.placeholder) ok = await writeLessons(list => createUpToIn(list, L.n, { done: when }), `Учёба: урок ${L.n} пройден ${when}`);
  else if (L.need != null && !e.last) ok = await writeLessons(list => { const x = list.find(l => l.id === L.key); if (x) { x.progress = (Number(x.progress) || 0) + e.cap; x.progressDates = (x.progressDates || []).concat([when]); } }, `Учёба: часть урока ${L.n} ${when}`);
  else ok = await writeLessons(list => { const x = list.find(l => l.id === L.key); if (x) x.done = when; }, `Учёба: урок ${L.n} пройден ${when}`);
  if (ok) { closeSheet(); toast((L.need != null && !e.last ? `Часть урока ${L.n} отмечена · +${XP.part} XP` : `Урок ${L.n} пройден · +${Number(L.need) >= 90 ? XP.lesson90 : XP.lesson} XP`) + (when === today() && notesRepoSep() ? '. Не забудь заметки: GitHub Desktop → Commit → Push' : '')); if (when === today()) checkNotesPushed(); if (!S.skipActual && (L.need == null || e.last)) openActual(L.n, when, L.need || e.cap); S.skipActual = false; }
}
async function blockFlow(d, reason) {
  const before = buildStudy();
  const after = buildStudy(Object.assign({}, S.studyDays, { [d]: { blocked: true } }));
  const byKey = {};
  before.entries.forEach(e => { byKey[e.L.key] = e.L; });
  const changes = Object.keys(before.first).filter(k => after.first[k] && after.first[k] !== before.first[k]).map(k => ({ L: byKey[k], from: before.first[k], to: after.first[k] })).sort((a, b) => a.from < b.from ? -1 : 1);
  const ok = await writePlan(p => { p.studyDays[d] = reason ? { blocked: true, reason } : { blocked: true }; }, `Учёба: окно ${d} снято${reason ? ' — ' + reason.slice(0, 40) : ''}`);
  if (!ok) return;
  changes.forEach(c => { if (!S.shift[c.L.key]) S.shift[c.L.key] = c.from; });
  render();
  openSheet(`<h2 class="sh-title">Окно на ${short(d)} снято</h2>
    ${changes.length ? `<p class="sh-meta">Уроки сдвинулись:</p><ul class="shift-list">${changes.slice(0, 6).map(c => `<li><b>Урок ${esc(c.L.n)}</b><span class="mono">${short(c.from)} → ${short(c.to)}</span></li>`).join('')}</ul>${changes.length > 6 ? `<p class="note">и ещё ${changes.length - 6}</p>` : ''}` : '<p class="sh-meta">В ближайшие три недели план не изменился.</p>'}
    <div class="sh-acts"><button type="button" class="btn primary block" data-action="close">Готово</button><button type="button" class="btn block" data-action="unblock" data-date="${d}">Отменить</button></div>`);
}
function openDay(d) {
  const t = today();
  const study = buildStudy(null, d);
  const sport = buildSport(addDays(d, -14), addDays(d, 14));
  const rows = scheduleRows(d);
  eventsOn(d).forEach(e => rows.push(rowEvent(e)));
  if (d >= t) for (const e of (study.byDate[d] || [])) rows.push(e.blocked ? rowBlocked(e) : rowStudy(e));
  else S.lessons.filter(l => l.done === d || (l.progressDates || []).includes(d)).forEach(l => rows.push(`<div class="row slim is-done"><span class="tag study">Учёба</span><span class="rb"><span class="t">Урок ${esc(l.n)}${l.title ? ' · ' + esc(l.title) : ''}</span><span class="m">${l.done === d ? 'пройден' : 'часть урока'}</span></span><span class="s">✓</span></div>`));
  for (const i of sport) if (i.eff === d) rows.push(rowSport(i));
  for (const i of sport) if (i.orig === d && i.eff !== d) rows.push(rowGhost(i));
  S.sportList = Array.from(new Map(S.sportList.concat(sport).map(i => [i.id, i])).values());
  let studyBox = '';
  if (S.config.study) {
    const c = studyCap(d), blk = S.studyDays[d] || {};
    if (c.blocked) studyBox = `<div class="callout">Учёба в этот день снята${blk.reason ? ': ' + esc(blk.reason) : ''}.</div><div class="sh-acts">${d <= t ? `<button type="button" class="btn study block" data-action="add-study" data-date="${d}">Урок всё-таки был</button>` : ''}<button type="button" class="btn block" data-action="unblock" data-date="${d}">Вернуть окно (${dur(c.base)})</button></div>`;
    else if (d >= t && c.extra) studyBox = `<div class="sh-acts"><button type="button" class="btn block" data-action="day-unextra" data-date="${d}">Убрать доп. окно для учёбы</button></div>`;
    else if (d >= t && c.cap > 0) studyBox = `<details class="more-box"><summary>Не получится учиться</summary><label class="fld" for="dy-reason" style="margin-top:0">Причина (я потом посмотрю)</label><textarea id="dy-reason" rows="2" placeholder="Например: наряд"></textarea><div class="sh-acts"><button type="button" class="btn block" data-action="study-block" data-date="${d}">Снять окно — урок уйдёт дальше</button></div></details>`;
  }
  const sl = (S.sleep.days || {})[d], slm = sleepMin(sl);
  openSheet(`<h2 class="sh-title">${esc(cap1(longDate(d)))}</h2>
    ${slm ? `<p class="sh-meta">Сон: ${esc(sl.bed)} → ${esc(sl.wake)} · ${hm(slm)}</p>` : ''}
    ${rows.length ? `<div class="stack" style="margin-top:12px">${rows.join('')}</div>` : '<p class="sh-meta">Ничего не запланировано.</p>'}
    <div class="sh-acts"><div class="two"><button type="button" class="btn study" data-action="add-study" data-date="${d}">+ Учёба</button><button type="button" class="btn sport" data-action="add-sport" data-date="${d}">+ Спорт</button></div>
    <div class="two"><button type="button" class="btn" data-action="ev-new" data-date="${d}">+ Событие</button><button type="button" class="btn" data-action="sleep" data-date="${d}">${slm ? 'Сон' : '+ Сон'}</button></div>
    <div class="two"><button type="button" class="btn" data-action="${dutyOn(d) ? 'duty-off' : 'duty-on'}" data-date="${d}">${dutyOn(d) ? 'Снять наряд' : '🪖 Наряд'}</button><button type="button" class="btn" data-action="abs-new" data-date="${d}">🏖 Отпуск / болею</button></div>
    <button type="button" class="btn block" data-action="weight" data-date="${d}">⚖️ Вес тела${weights()[d] != null ? ' · ' + String(weights()[d]).replace('.', ',') + ' кг' : ''}</button></div>
    ${studyBox}`);
}

/* ---------- lesson edit ---------- */
function needSeg(need) {
  const opts = [['', 'Одно окно'], ['60', '1 ч'], ['90', '1,5 ч']];
  const cur = need == null ? '' : String(need);
  return `<div class="seg" role="group" aria-label="Длина урока">${opts.map(([v, l]) => `<button type="button" data-action="le-need" data-need="${v}" aria-pressed="${v === cur}">${l}</button>`).join('')}</div>`;
}
function openLesson(id) {
  const l = S.lessons.find(x => x.id === id);
  if (!l) return;
  S.cur = { type: 'lesson', l, need: l.need ? Number(l.need) : null, ph: false };
  const pend = !l.done;
  openSheet(`<h2 class="sh-title">Урок ${esc(l.n)}${l.title ? ' · ' + esc(l.title) : ''}</h2>${l.done ? `<p class="sh-meta">Пройден ${short(l.done)}</p>` : ''}
    ${lessonInfo(l)}
    <label class="fld" for="le-title">Тема</label><input id="le-title" value="${esc(l.title || '')}" placeholder="Например: Docker — сети">
    ${pend ? `<span class="fld">Длина урока</span>${needSeg(S.cur.need)}` : ''}
    <div class="sh-acts">
      <button type="button" class="btn study block" data-action="le-save">Сохранить</button>
      ${pend ? '<div class="two"><button type="button" class="btn" data-action="le-up">Раньше</button><button type="button" class="btn" data-action="le-down">Позже</button></div>' : '<button type="button" class="btn block" data-action="le-undone">Вернуть в очередь</button>'}
      <button type="button" class="btn danger block" data-action="le-del">Удалить урок</button>
    </div>`);
}
function openLessonPh(n) {
  S.cur = { type: 'lesson', l: null, n, need: null, ph: true };
  openSheet(`<h2 class="sh-title">Урок ${n}</h2>
    <label class="fld" for="le-title">Тема</label><input id="le-title" placeholder="Например: Docker — сети">
    <span class="fld">Длина урока</span>${needSeg(null)}
    <div class="sh-acts"><button type="button" class="btn study block" data-action="le-save">Сохранить</button></div>`);
}
async function lessonSave() {
  const c = S.cur; if (!c || c.type !== 'lesson') return;
  const title = ($('#le-title').value || '').trim();
  let ok;
  if (c.ph) ok = await writeLessons(list => { const extra = { title }; if (c.need) extra.need = c.need; createUpToIn(list, c.n, extra); }, `Учёба: тема урока ${c.n}`);
  else ok = await writeLessons(list => { const x = list.find(l => l.id === c.l.id); if (!x) return; x.title = title; if (!x.done) { if (c.need) x.need = c.need; else delete x.need; } }, `Учёба: урок ${c.l.n} изменён`);
  if (ok) { closeSheet(); toast('Сохранено'); }
}
async function lessonMove(dir) {
  const l = S.cur && S.cur.l; if (!l) return;
  const p = pendingSorted();
  const k = p.findIndex(x => x.id === l.id), j = k + dir;
  if (k < 0 || j < 0 || j >= p.length) { toast(dir < 0 ? 'Урок уже первый' : 'Урок уже последний'); return; }
  const aId = p[k].id, bId = p[j].id;
  const ok = await writeLessons(list => {
    const a = list.find(x => x.id === aId), b = list.find(x => x.id === bId);
    if (!a || !b) return;
    let oa = ord(a), ob = ord(b);
    if (oa === ob) ob = oa + dir;
    a.order = ob; b.order = oa;
  }, `Учёба: порядок уроков ${p[k].n} и ${p[j].n}`);
  if (ok) { closeSheet(); toast('Порядок изменён'); }
}

/* ---------- sport ---------- */
async function openSport(id, keepScroll) {
  const i = findInst(id); if (!i) return;
  await ensureWorkouts([monthKey(i.eff), monthShift(monthKey(i.eff), -1)]);
  const ses = sessionFor(i);
  const auto = i.state ? null : planMove(i);
  S.cur = { type: 'sport', id, auto, ses };
  const t = today();
  const sessions = (S.config.sport || {}).sessions || {};
  let status = '';
  const why = i.ov && i.ov.reason ? `<br><span class="m">Причина: ${esc(i.ov.reason)}</span>` : '';
  if (i.state === 'done') status = '<div class="callout ok">Отмечено: сделано.</div>';
  else if (i.state === 'other') status = `<div class="callout ok">Отмечено: сделал другое${i.note ? ' — ' + esc(i.note) : ''}.${why}</div>`;
  else if (i.state === 'skipped') status = `<div class="callout">Тренировка пропущена.${why}</div>`;
  else if (i.ov && i.ov.reason && i.eff !== i.orig) status = `<div class="callout">Перенесена с ${short(i.orig)}.${why}</div>`;
  let main;
  if (i.state === 'skipped') main = `<div class="sh-acts"><button type="button" class="btn sport block" data-action="sp-restore" data-id="${esc(i.id)}">Всё-таки была — отметить сделанной</button><button type="button" class="btn block" data-action="sp-clear" data-id="${esc(i.id)}">Вернуть в план</button></div>`;
  else if (i.state) main = `<div class="sh-acts"><button type="button" class="btn sport block" data-action="sp-save-log" data-id="${esc(i.id)}">Сохранить подходы</button><button type="button" class="btn block" data-action="sp-clear" data-id="${esc(i.id)}">Снять отметку</button></div>`;
  else main = `<div class="sh-acts"><button type="button" class="btn sport block" data-action="sp-done" data-id="${esc(i.id)}">Сделал</button><button type="button" class="btn block" data-action="sp-save-log" data-id="${esc(i.id)}">Сохранить подходы, отмечу позже</button></div>`;
  let moveBox = '';
  if (!i.state) {
    let mv;
    if (auto) {
      let sub = '';
      if (auto.bump) sub = auto.bumpTo ? `<span class="btn-sub">${esc(auto.bump.title)} ${short(auto.bump.eff)} уйдёт на ${short(auto.bumpTo)}</span>` : `<span class="btn-sub">${esc(auto.bump.title)} ${short(auto.bump.eff)} выпадет: на неделе нет свободного дня</span>`;
      mv = `<button type="button" class="btn block stacked" data-action="sp-move-auto" data-id="${esc(i.id)}"><span>Перенести на ${short(auto.date)}</span>${sub}</button>`;
    } else mv = '<p class="note">До конца недели свободного дня нет. Такое кардио лучше пропустить.</p>';
    moveBox = `<details class="more-box"><summary>Перенести или пропустить</summary><div class="sh-acts" style="margin-top:0">
      <div><label class="fld" for="sp-reason" style="margin-top:0">Причина (я потом посмотрю и оценю)</label><textarea id="sp-reason" rows="2" placeholder="Например: наряд, зачёт, болит плечо">${esc((i.ov && i.ov.reason) || '')}</textarea></div>
      ${mv}
      <div class="date-move"><label class="fld" for="sp-date">На другую дату</label><div class="form-row"><input type="date" id="sp-date" min="${t}" value="${auto ? auto.date : addDays(t, 1)}"><button type="button" class="btn" data-action="sp-move-date" data-id="${esc(i.id)}">Перенести</button></div></div>
      <button type="button" class="btn block" data-action="sp-skip" data-id="${esc(i.id)}">Пропустить</button>
      ${i.eff !== i.orig ? `<button type="button" class="btn block" data-action="sp-unmove" data-id="${esc(i.id)}">Вернуть на ${short(i.orig)}</button>` : ''}
    </div></details>
    <details class="more-box"><summary>Сделал другое</summary><div class="other-box"><label class="fld" for="sp-note" style="margin-top:0">Что сделал вместо программы</label><textarea id="sp-note" rows="2" placeholder="Например: бег 5 км, бокс 40 мин"></textarea><div class="sh-acts"><button type="button" class="btn block" data-action="sp-other" data-id="${esc(i.id)}">Отметить: сделал другое</button></div></div></details>`;
  }
  const others = Object.keys(sessions).filter(k => k !== ses.key);
  const replaceBox = `<details class="more-box"><summary>Заменить всю тренировку</summary><div class="sh-acts" style="margin-top:0">
    <div class="sess-list">${others.map(k => `<button type="button" class="btn block" data-action="sp-as" data-id="${esc(i.id)}" data-as="${esc(k)}">${esc(sessions[k].title)}${sessions[k].sub ? ` <span class="btn-sub">· ${esc(sessions[k].sub)}</span>` : ''}</button>`).join('')}</div>
    <label class="fld" for="sp-custom">Или своя — каждое упражнение с новой строки</label><textarea id="sp-custom" rows="3" placeholder="Подтягивания&#10;Отжимания на брусьях&#10;Планка">${esc(ses.replaced === 'custom' ? (i.ov.custom || []).join('\n') : '')}</textarea>
    <button type="button" class="btn block" data-action="sp-custom" data-id="${esc(i.id)}">Заменить на свою</button>
    ${ses.replaced ? `<button type="button" class="btn block" data-action="sp-as-clear" data-id="${esc(i.id)}">Вернуть тренировку по программе</button>` : ''}
  </div></details>
  ${i.extra ? `<details class="more-box"><summary>Удалить добавленную тренировку</summary><div class="sh-acts" style="margin-top:0"><button type="button" class="btn danger block" data-action="sp-extra-del" data-id="${esc(i.id)}">Удалить</button></div></details>` : ''}
  <p class="note"><button type="button" class="link-btn" data-action="ideas" data-area="sport">+ Идея по спорту для Claude</button></p>`;
  openSheet(`<div class="sh-eyebrow"><span class="tag sport">Спорт</span></div>
    <h2 class="sh-title">${esc(ses.title)}</h2>
    <p class="sh-meta">${esc(cap1(longDate(i.eff)))}${i.eff !== i.orig ? ` · перенесено с ${short(i.orig)}` : ''}${ses.replaced === 'as' ? ` · вместо: ${esc((sessions[i.key] || {}).title || i.key)}` : ''}${ses.replaced === 'custom' ? ` · вместо: ${esc((sessions[i.key] || {}).title || i.key)}` : ''}</p>
    ${status}
    <div id="wk">${workoutForm(i, ses)}</div>
    ${ses.note ? `<p class="note">${esc(ses.note)}</p>` : ''}
    ${main}${moveBox}${replaceBox}`, keepScroll);
}
async function commitMove(i, res, reason) {
  if (!res) return;
  let msg = `${i.title} → ${short(res.date)}`;
  const ok = await writePlan(p => {
    setMove(p, i.id, { movedTo: res.date === i.orig ? undefined : res.date, reason: reason || undefined });
    if (res.bump) {
      const b = res.bump;
      if (res.bumpTo) setMove(p, b.id, { movedTo: res.bumpTo === b.orig ? undefined : res.bumpTo });
      else setMove(p, b.id, { state: 'skipped' });
    }
  }, `Спорт: ${i.id} → ${res.date}`);
  if (!ok) return;
  if (res.bump) msg += res.bumpTo ? `, ${res.bump.title.toLowerCase()} → ${short(res.bumpTo)}` : `, ${res.bump.title.toLowerCase()} выпало`;
  closeSheet(); toast(msg);
}
async function setSportState(id, state, note, reason) {
  const i = findInst(id); if (!i) return false;
  const label = { done: 'сделано', other: 'другое', skipped: 'пропуск' }[state] || 'снята отметка';
  const patch = { state: state || undefined, note: state === 'other' ? note : undefined, at: state ? today() : undefined };
  if (reason !== undefined) patch.reason = reason || undefined;
  else if (state === 'done' || !state) patch.reason = undefined;
  const ok = await writePlan(p => setMove(p, id, patch), `Спорт: ${id} — ${label}${reason ? ' (' + reason.slice(0, 40) + ')' : ''}`);
  if (ok) { closeSheet(); toast(state === 'done' ? 'Отмечено' : state === 'other' ? 'Записал, что сделал другое' : state === 'skipped' ? 'Пропуск записан' : 'Вернул в план'); }
  return ok;
}
function sheetSport(id) { return S.cur && S.cur.type === 'sport' && S.cur.id === id ? S.cur : null; }

/* ---------- events ---------- */
function repNote() {
  const u = $('#ev-unit') && $('#ev-unit').value, n = $('#ev-n') && $('#ev-n').value, d = $('#ev-date') && $('#ev-date').value;
  const el = $('#ev-rep-note'); if (!el) return;
  if (!u) { el.textContent = 'Без времени — событие на весь день.'; return; }
  const rep = { unit: u, n: Math.max(1, Number(n) || 1) };
  const ev = { date: d || today(), repeat: rep };
  const nx = occurrences(ev, today(), addDays(today(), 3700)).slice(0, 3).map(short);
  el.textContent = cap1(repeatLabel(rep)) + (nx.length ? '. Ближайшие: ' + nx.join(', ') + '.' : '.');
}
function openEvent(id, date) {
  const ev = id ? S.events.find(e => e.id === id) : { id: null, date: date || today(), title: '', time: '' };
  if (!ev) return;
  const occ = id ? (date || ev.date) : null;
  const done = !!(occ && Array.isArray(ev.done) && ev.done.includes(occ));
  const rep = ev.repeat || null;
  S.cur = { type: 'event', ev, occ };
  const units = [['', 'не повторять'], ['day', 'дни'], ['week', 'недели'], ['month', 'месяцы'], ['year', 'годы']];
  openSheet(`<div class="sh-eyebrow"><span class="tag event">${rep ? 'Напоминание' : 'Событие'}</span></div>
    <h2 class="sh-title">${id ? esc(ev.title) : 'Новое событие или напоминание'}</h2>
    ${id ? `<p class="sh-meta">${esc(cap1(longDate(occ)))}${ev.time ? ', ' + esc(ev.time) : ''}${rep ? ' · ↻ ' + esc(repeatLabel(rep)) : ''}</p>
      <div class="sh-acts"><button type="button" class="btn ${done ? '' : 'primary '}block" data-action="ev-done" data-date="${esc(occ)}">${done ? 'Снять отметку «сделано»' : 'Сделано ✓'}</button></div>
      <details class="more-box"><summary>Изменить</summary>` : ''}
    <label class="fld" for="ev-title">Что</label><input id="ev-title" value="${esc(ev.title)}" placeholder="Например: смена фильтра, наряд, врач">
    <div class="two"><div><label class="fld" for="ev-date">${rep || !id ? 'Дата (первая)' : 'Дата'}</label><input type="date" id="ev-date" value="${esc(ev.date)}"></div><div><label class="fld" for="ev-time">Время</label><input type="time" id="ev-time" value="${esc(ev.time || '')}"></div></div>
    <label class="fld" for="ev-unit">Повторять</label>
    <div class="two"><select id="ev-unit">${units.map(([v, l]) => `<option value="${v}"${(rep ? rep.unit : '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select><input id="ev-n" type="number" inputmode="numeric" min="1" max="365" value="${esc(rep ? rep.n || 1 : 1)}" aria-label="Каждые сколько"></div>
    <p class="note" id="ev-rep-note"></p>
    <div class="sh-acts"><button type="button" class="btn ${id ? '' : 'primary '}block" data-action="ev-save">Сохранить</button>${id ? '<button type="button" class="btn danger block" data-action="ev-del">Удалить' + (rep ? ' все повторы' : '') + '</button>' : ''}</div>
    ${id ? '</details>' : ''}`);
  repNote();
}
async function eventSave() {
  const c = S.cur; if (!c || c.type !== 'event') return;
  const title = $('#ev-title').value.trim(), date = $('#ev-date').value, time = $('#ev-time').value;
  const unit = $('#ev-unit').value, n = Math.max(1, Math.min(365, Number($('#ev-n').value) || 1));
  if (!title) { toast('Напиши, что за событие'); $('#ev-title').focus(); return; }
  if (!date) { toast('Выбери дату'); return; }
  const id = c.ev.id;
  const ok = await writeEvents(list => {
    const old = list.find(e => e.id === id) || {};
    const rec = { id: id || rid(), date, title };
    if (time) rec.time = time;
    if (unit) rec.repeat = { unit, n };
    if (Array.isArray(old.done) && old.done.length) rec.done = old.done;
    const k = list.findIndex(e => e.id === id);
    if (id && k >= 0) list[k] = rec; else list.push(rec);
    list.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  }, `События: ${title} ${date}${unit ? ' (' + repeatLabel({ unit, n }) + ')' : ''}`);
  if (ok) { closeSheet(); toast(id ? 'Сохранено' : unit ? 'Напоминание добавлено' : 'Событие добавлено'); }
}

/* ---------- food ---------- */
const MEALS = [['breakfast', 'Завтрак'], ['lunch', 'Обед'], ['dinner', 'Ужин'], ['snack', 'Перекус']];
const MEAL_NAME = Object.fromEntries(MEALS);
const MEAL_GEN = { breakfast: 'завтрак', lunch: 'обед', dinner: 'ужин', snack: 'перекус' };
function recipeById(id) { return S.recipes.find(r => r.id === id) || null; }
const isSimple = r => !!r && (r.kind === 'simple' || r.simple === true);
const isCombo = r => !!r && r.kind === 'combo';
function comboParts(r) { return (isCombo(r) && Array.isArray(r.parts) ? r.parts : []).map(recipeById).filter(Boolean); }
function dishNums(r) {
  if (isCombo(r)) {
    const ps = comboParts(r); let kcal = 0, protein = 0, known = 0;
    ps.forEach(p => { if (p.kcal || p.protein) { known++; kcal += Number(p.kcal) || 0; protein += Number(p.protein) || 0; } });
    return known ? { kcal, protein, partial: known < ps.length } : null;
  }
  return r.kcal || r.protein ? { kcal: Number(r.kcal) || 0, protein: Number(r.protein) || 0 } : null;
}
function thumbHtml(r) {
  const src = isCombo(r) ? comboParts(r).find(p => Array.isArray(p.photos) && p.photos.length) : r;
  const p = src && Array.isArray(src.photos) && src.photos[0];
  const letter = isCombo(r) ? comboParts(r).map(x => (x.title || '?').trim().charAt(0).toUpperCase()).slice(0, 2).join('+') || '?' : ((r && r.title) || '?').trim().charAt(0).toUpperCase();
  return `<span class="thumb">${p ? `<img data-gh="${esc(p)}" alt="">` : esc(letter)}</span>`;
}
function recipeMeta(r) {
  const m = [];
  if (isCombo(r)) {
    m.push('из: ' + (comboParts(r).map(p => p.title.toLowerCase()).join(' + ') || '—'));
    const n = dishNums(r); if (n) m.push(`≈ ${Math.round(n.kcal)} ккал${n.partial ? ' (не всё)' : ''}`);
    return m.join(' · ');
  }
  if (r.time) m.push(r.time);
  if (r.kcal) m.push('≈ ' + r.kcal + ' ккал');
  if (r.protein) m.push('белок ' + r.protein + ' г');
  if (r.draft) m.push('ждёт разбора');
  if (isSimple(r) && !r.draft) m.push('без рецепта');
  if (!m.length && Array.isArray(r.meals) && r.meals.length) m.push(r.meals.map(k => MEAL_NAME[k] || k).join(', '));
  return m.join(' · ');
}
function splitNames(text) { return String(text || '').split(/[,;\n]/).map(s => s.trim().replace(/\s{2,}/g, ' ')).filter(Boolean); }
function ensureDishes(names, meal, fresh) {
  const ids = [];
  for (const n of names) {
    const ex = S.recipes.find(r => norm(r.title) === norm(n)) || fresh.find(r => norm(r.title) === norm(n));
    if (ex) { ids.push(ex.id); continue; }
    const rec = { id: 'd' + rid().slice(0, 10), title: cap1(n), kind: 'simple', meals: meal ? [meal] : [], added: today() };
    fresh.push(rec); ids.push(rec.id);
  }
  return ids;
}
async function quickDishes(meal, text) {
  const names = splitNames(text);
  if (!names.length) { toast('Впиши название блюда'); return false; }
  const d = S.foodDate, fresh = [];
  const ids = ensureDishes(names, meal, fresh);
  let ok = true;
  if (fresh.length) ok = await writeRecipes(list => { fresh.forEach(r => list.push(r)); }, `Еда: блюда ${fresh.map(r => r.title).join(', ').slice(0, 60)}`);
  if (ok) ok = await writeMeals(days => { const day = days[d] = days[d] || {}; const arr = day[meal] = Array.isArray(day[meal]) ? day[meal] : []; ids.forEach(id => arr.push(id)); }, `Еда ${d}: ${MEAL_NAME[meal]} — ${names.join(', ').slice(0, 60)}`);
  if (ok) { closeSheet(); toast(`${MEAL_NAME[meal]}: ${names.join(', ')}`); }
  return ok;
}
function hydrateImages(root) {
  if (!root || !GH.cred) return;
  root.querySelectorAll('img[data-gh]').forEach(async img => {
    if (img.getAttribute('src')) return;
    const p = img.dataset.gh;
    try { S.img[p] = S.img[p] || GH.blob(p); img.src = await S.img[p]; }
    catch (_) { delete S.img[p]; img.alt = 'фото не загрузилось'; }
  });
}
function dishCard(r, action, extra) {
  return `<button type="button" class="dish card-like" data-action="${action}" data-id="${esc(r.id)}"${extra || ''}>${thumbHtml(r)}<span class="rb"><span class="t">${esc(r.title)}</span><span class="m">${esc(recipeMeta(r))}</span></span></button>`;
}
function renderFood() {
  const d = S.foodDate;
  $('#food-label').textContent = dayName(d) + ', ' + dm(d);
  const box = $('#food-day'), list = $('#food-recipes');
  if (!S.ready) { box.innerHTML = bannerHtml(); list.innerHTML = ''; return; }
  const day = (S.meals.days || {})[d] || {};
  let kcal = 0, prot = 0, withNum = 0, total = 0;
  box.innerHTML = '<div class="meals">' + MEALS.map(([k, l]) => {
    const ids = Array.isArray(day[k]) ? day[k] : [];
    const rows = ids.map((id, idx) => {
      const r = recipeById(id);
      if (!r) return '';
      total++;
      const n = dishNums(r);
      if (n) { withNum++; kcal += n.kcal; prot += n.protein; }
      return `<div class="dish-row"><button type="button" class="dish" data-action="recipe" data-id="${esc(r.id)}">${thumbHtml(r)}<span class="rb"><span class="t">${esc(r.title)}</span><span class="m">${esc(recipeMeta(r))}</span></span></button><button type="button" class="icon-btn sm" data-action="meal-remove" data-meal="${k}" data-idx="${idx}" aria-label="Убрать из: ${l}">×</button></div>`;
    }).join('');
    return `<div class="meal"><div class="meal-h"><b>${l}</b><span class="acts"><label class="btn sm file-btn" aria-label="Сфотографировать еду: ${l}">Фото<input type="file" accept="image/*" data-food-photo="${k}"></label><button type="button" class="btn sm" data-action="meal-pick" data-meal="${k}">+ Добавить</button></span></div>${rows || '<p class="empty-day">Ничего не записано</p>'}</div>`;
  }).join('') + '</div>'
    + (withNum ? `<p class="note">По блюдам с оценкой (${withNum} из ${total}): ≈ ${Math.round(kcal)} ккал, белок ≈ ${Math.round(prot)} г. Примерно.</p>` : '');
  const all = S.recipes.slice().sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
  const combos = all.filter(isCombo), recipes = all.filter(r => !isCombo(r) && !isSimple(r)), simple = all.filter(isSimple);
  list.innerHTML = (combos.length ? `<h3 class="sec">Составные</h3><div class="stack">${combos.map(r => dishCard(r, 'recipe')).join('')}</div>` : '')
    + `<h3 class="sec">С рецептом</h3>` + (recipes.length ? `<div class="stack">${recipes.map(r => dishCard(r, 'recipe')).join('')}</div>` : '<p class="note">Рецептов пока нет.</p>')
    + (simple.length ? `<h3 class="sec">Без рецепта</h3><div class="stack">${simple.map(r => dishCard(r, 'recipe')).join('')}</div>` : '')
    + '';
  hydrateImages($('#tab-food'));
}
function openMealPick(meal) {
  const byNew = (a, b) => (b.added || '') < (a.added || '') ? -1 : (b.added || '') > (a.added || '') ? 1 : (a.title || '').localeCompare(b.title || '', 'ru');
  const fit = S.recipes.filter(r => Array.isArray(r.meals) && r.meals.includes(meal)).sort((a, b) => (isCombo(b) - isCombo(a)) || byNew(a, b));
  const rest = S.recipes.filter(r => !fit.includes(r)).sort(byNew);
  S.cur = { type: 'meal', meal };
  openSheet(`<h2 class="sh-title">${MEAL_NAME[meal]} · ${esc(dayName(S.foodDate).toLowerCase())}, ${dm(S.foodDate)}</h2>
    <label class="fld" for="mp-name">Просто название — без рецепта</label>
    <div class="form-row"><input id="mp-name" placeholder="Например: борщ, котлета с пюре, компот" autocomplete="off"><button type="button" class="btn study" data-action="meal-quick" data-meal="${meal}">Добавить</button></div>
    
    <div class="sh-acts two"><button type="button" class="btn" data-action="combo-new" data-meal="${meal}">+ Составное</button><button type="button" class="btn" data-action="rc-new" data-meal="${meal}">+ Рецепт</button></div>
    ${fit.length ? `<h3 class="sec">Для: ${MEAL_GEN[meal]}</h3><div class="stack">${fit.map(r => dishCard(r, 'meal-add', ` data-meal="${meal}"`)).join('')}</div>` : ''}
    ${rest.length ? `<h3 class="sec">${fit.length ? 'Остальные' : 'Все блюда'}</h3><div class="stack">${rest.map(r => dishCard(r, 'meal-add', ` data-meal="${meal}"`)).join('')}</div>` : ''}`);
  hydrateImages($('#sheet-body'));
}
function openCombo(id, meal) {
  const r = id ? recipeById(id) : null;
  const sel = new Set(r ? (r.parts || []) : []);
  const pool = S.recipes.filter(x => !isCombo(x)).sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
  S.cur = { type: 'combo', id: r ? r.id : null, meal: meal || null, parts: sel, meals: new Set(r ? (r.meals || []) : (meal ? [meal] : ['lunch', 'dinner'])) };
  openSheet(`<h2 class="sh-title">${r ? 'Изменить составное блюдо' : 'Составное блюдо'}</h2>
    
    <span class="fld">Из чего (нажми, чтобы выбрать)</span>
    <div class="chips" id="cb-parts">${pool.map(x => `<button type="button" class="chip-btn" data-action="combo-part" data-id="${esc(x.id)}" aria-pressed="${sel.has(x.id)}">${esc(x.title)}</button>`).join('') || '<span class="note">Пока нет ни одной части — впиши их ниже.</span>'}</div>
    <label class="fld" for="cb-new">Новые части — через запятую</label><input id="cb-new" placeholder="Например: гречка, курица" autocomplete="off">
    <label class="fld" for="cb-title">Название (необязательно)</label><input id="cb-title" value="${esc(r ? r.title : '')}" placeholder="Соберётся само: «Гречка с курицей»">
    <span class="fld">Когда подходит</span><div class="chips">${MEALS.map(([k, l]) => `<button type="button" class="chip-btn" data-action="combo-meal" data-meal="${k}" aria-pressed="${S.cur.meals.has(k)}">${l}</button>`).join('')}</div>
    <div class="sh-acts"><button type="button" class="btn primary block" data-action="combo-save">${r ? 'Сохранить' : meal ? 'Сохранить и добавить в «' + MEAL_NAME[meal] + '»' : 'Сохранить'}</button>${r ? '<button type="button" class="btn danger block" data-action="rc-del">Удалить составное блюдо</button>' : ''}</div>`);
}
function comboTitle(parts) {
  const t = parts.map(p => p.title);
  if (!t.length) return 'Составное блюдо';
  if (t.length === 1) return t[0];
  const low = t.slice(1).map(x => x.toLowerCase());
  const inst = w => w.replace(/а$/, 'ой').replace(/я$/, 'ей').replace(/ка$/, 'кой');
  return t.length === 2 ? `${t[0]} с ${inst(low[0])}` : `${t[0]} + ${low.join(' + ')}`;
}
async function comboSave(btn) {
  const c = S.cur; if (!c || c.type !== 'combo') return;
  const fresh = [];
  const newIds = ensureDishes(splitNames($('#cb-new').value), null, fresh);
  fresh.forEach(f => { f.meals = Array.from(c.meals); });
  const partIds = Array.from(new Set(Array.from(c.parts).concat(newIds)));
  if (partIds.length < 2) { toast('Выбери или впиши хотя бы две части'); return; }
  const parts = partIds.map(id => recipeById(id) || fresh.find(f => f.id === id)).filter(Boolean);
  const title = ($('#cb-title').value || '').trim() || comboTitle(parts);
  const id = c.id || 'c' + rid().slice(0, 10);
  busy(btn, true);
  let ok = await writeRecipes(list => {
    fresh.forEach(f => { if (!list.some(x => x.id === f.id)) list.push(f); });
    const k = list.findIndex(x => x.id === id);
    const rec = Object.assign(k >= 0 ? list[k] : { id, added: today() }, { title, kind: 'combo', parts: partIds, meals: Array.from(c.meals) });
    if (k < 0) list.push(rec);
  }, `Еда: составное блюдо «${title}»`);
  if (ok && c.meal && !c.id) ok = await writeMeals(days => { const d = S.foodDate, day = days[d] = days[d] || {}; (day[c.meal] = Array.isArray(day[c.meal]) ? day[c.meal] : []).push(id); }, `Еда ${S.foodDate}: ${MEAL_NAME[c.meal]} — ${title}`);
  busy(btn, false);
  if (ok) { closeSheet(); toast(c.meal && !c.id ? `${MEAL_NAME[c.meal]}: ${title}` : 'Сохранено'); }
}
function openRecipe(id) {
  const r = recipeById(id); if (!r) return;
  S.cur = { type: 'recipe', r };
  if (isCombo(r)) {
    const ps = comboParts(r), n = dishNums(r);
    openSheet(`<h2 class="sh-title">${esc(r.title)}</h2>
      <p class="sh-meta">Составное блюдо${Array.isArray(r.meals) && r.meals.length ? ' · ' + esc(r.meals.map(k => MEAL_NAME[k] || k).join(', ')) : ''}</p>
      ${n ? `<div class="macro"><span class="chip">≈ ${Math.round(n.kcal)} ккал</span><span class="chip">белок ${Math.round(n.protein)} г</span></div><p class="note">Сумма по частям${n.partial ? ', у некоторых частей оценки ещё нет' : ''}. Примерно.</p>` : ''}
      <h3 class="sec">Части — нажми, чтобы открыть рецепт</h3><div class="stack">${ps.map(p => dishCard(p, 'recipe')).join('') || '<p class="note">Частей нет.</p>'}</div>
      <h3 class="sec">Добавить на ${esc(dayName(S.foodDate).toLowerCase())}, ${dm(S.foodDate)}</h3>
      <div class="chips">${MEALS.map(([k, l]) => `<button type="button" class="chip-btn" data-action="meal-add" data-meal="${k}" data-id="${esc(r.id)}">${l}</button>`).join('')}</div>
      <div class="sh-acts"><button type="button" class="btn block" data-action="combo-edit" data-id="${esc(r.id)}">Изменить состав</button></div>`);
    hydrateImages($('#sheet-body'));
    return;
  }
  const photos = Array.isArray(r.photos) ? r.photos : [];
  const usedIn = S.recipes.filter(x => isCombo(x) && (x.parts || []).includes(r.id));
  const macro = [r.portions ? r.portions + ' ' + plural(Number(r.portions) || 0, 'порция', 'порции', 'порций') : '', r.time || '', r.kcal ? '≈ ' + r.kcal + ' ккал' : '', r.protein ? 'белок ' + r.protein + ' г' : '', r.fat ? 'жиры ' + r.fat + ' г' : '', r.carbs ? 'углеводы ' + r.carbs + ' г' : ''].filter(Boolean);
  openSheet(`<h2 class="sh-title">${esc(r.title)}</h2>
    ${Array.isArray(r.meals) && r.meals.length ? `<p class="sh-meta">${esc(r.meals.map(k => MEAL_NAME[k] || k).join(', '))}</p>` : ''}
    ${photos.length ? `<div class="rc-photos">${photos.map(p => `<img data-gh="${esc(p)}" alt="">`).join('')}</div>` : ''}
    ${macro.length ? `<div class="macro">${macro.map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div>${r.kcal || r.protein ? '<p class="note">КБЖУ — примерная оценка на порцию.</p>' : ''}` : ''}
    ${r.draft ? '<div class="callout">Ждёт разбора: ингредиенты и шаги заполню, когда позовёшь.</div>' : ''}
    ${isSimple(r) && !r.draft ? `<div class="callout">Без рецепта — только название.</div><div class="sh-acts"><button type="button" class="btn block" data-action="rc-attach" data-id="${esc(r.id)}">Добавить рецепт: фото, видео, текст</button></div>` : ''}
    ${usedIn.length ? `<p class="note">Входит в: ${esc(usedIn.map(x => x.title).join(', '))}.</p>` : ''}
    ${Array.isArray(r.ingredients) && r.ingredients.length ? `<h3 class="sec">Ингредиенты</h3><ul class="ing">${r.ingredients.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${Array.isArray(r.steps) && r.steps.length ? `<h3 class="sec">Как готовить</h3><ol class="ing">${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    ${r.note ? `<p class="note">${esc(r.note)}</p>` : ''}
    ${r.text && r.draft ? `<p class="note">Текст: ${esc(r.text)}</p>` : ''}
    ${safeUrl(r.link) ? `<p class="note"><a href="${esc(safeUrl(r.link))}" target="_blank" rel="noopener noreferrer">Открыть источник</a></p>` : ''}
    <h3 class="sec">Добавить на ${esc(dayName(S.foodDate).toLowerCase())}, ${dm(S.foodDate)}</h3>
    <div class="chips">${MEALS.map(([k, l]) => `<button type="button" class="chip-btn" data-action="meal-add" data-meal="${k}" data-id="${esc(r.id)}">${l}</button>`).join('')}</div>
    <div class="sh-acts"><button type="button" class="btn block" data-action="combo-with" data-id="${esc(r.id)}">Собрать блюдо с этим</button></div>
    <details class="more-box"><summary>Изменить или удалить</summary>
      <label class="fld" for="rc-title">Название</label><input id="rc-title" value="${esc(r.title)}">
      <span class="fld">Когда подходит</span><div class="chips">${MEALS.map(([k, l]) => `<button type="button" class="chip-btn" data-action="rc-meal" data-meal="${k}" aria-pressed="${Array.isArray(r.meals) && r.meals.includes(k)}">${l}</button>`).join('')}</div>
      <div class="sh-acts"><button type="button" class="btn primary block" data-action="rc-edit-save">Сохранить</button><button type="button" class="btn danger block" data-action="rc-del">Удалить</button></div>
    </details>`);
  hydrateImages($('#sheet-body'));
}
function openRecipeNew(meal, baseId) {
  const base = baseId ? recipeById(baseId) : null;
  S.cur = { type: 'recipe-new', baseId: base ? base.id : null, meals: new Set(base ? (base.meals || []) : (meal ? [meal] : [])) };
  openSheet(`<h2 class="sh-title">${base ? 'Рецепт для «' + esc(base.title) + '»' : 'Новый рецепт'}</h2>
    
    <label class="fld" for="rc-title">Название</label><input id="rc-title" value="${esc(base ? base.title : '')}" placeholder="Например: омлет с курицей">
    <span class="fld">Когда подходит</span><div class="chips">${MEALS.map(([k, l]) => `<button type="button" class="chip-btn" data-action="rc-meal" data-meal="${k}" aria-pressed="${S.cur.meals.has(k)}">${l}</button>`).join('')}</div>
    <label class="fld" for="rc-files">Скриншоты или видео</label>
    <label class="btn block file-btn" id="rc-files-btn"><span id="rc-files-label">Выбрать фото или видео</span><input type="file" id="rc-files" accept="image/*,video/*" multiple aria-label="Скриншоты или видео рецепта"></label>
    <p class="note">Голос за кадром не разберу — добавь скриншот описания.</p>
    <label class="fld" for="rc-link">Ссылка (необязательно)</label><input id="rc-link" type="url" inputmode="url" placeholder="https://…">
    <label class="fld" for="rc-text">Текст рецепта (если есть)</label><textarea id="rc-text" rows="3" placeholder="Можно вставить описание из поста или написать, как готовишь"></textarea>
    <div class="sh-acts"><button type="button" class="btn primary block" data-action="rc-save">Сохранить рецепт</button></div>`);
}
async function foodPhoto(meal, file) {
  const d = S.foodDate, id = 'r' + rid().slice(0, 10);
  setSync('загружаю фото…');
  const up = await uploadFiles([file], `inbox/recipes/${id}`, 'Фото еды');
  if (!up.photos.length) return;
  const rec = { id, title: 'Фото: ' + MEAL_GEN[meal] + ' ' + dm(d), meals: [meal], draft: true, from: 'photo', photos: up.photos, media: up.media, added: today(), eaten: d };
  let ok = await writeRecipes(list => { list.push(rec); }, `Фото еды: ${MEAL_NAME[meal]} ${d}`);
  if (ok) ok = await writeMeals(days => { const day = days[d] = days[d] || {}; (day[meal] = Array.isArray(day[meal]) ? day[meal] : []).push(id); }, `Еда ${d}: ${MEAL_NAME[meal]} — фото`);
  if (ok) toast('Фото сохранено. Разберу, что это, и добавлю в рецепты.');
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => { const s = String(fr.result); resolve(s.slice(s.indexOf(',') + 1)); }; fr.onerror = () => reject(fr.error); fr.readAsDataURL(file); });
}
async function recipeSave(btn) {
  const c = S.cur; if (!c || c.type !== 'recipe-new') return;
  const title = $('#rc-title').value.trim(), link = $('#rc-link').value.trim(), text = $('#rc-text').value.trim();
  const files = Array.from(($('#rc-files') && $('#rc-files').files) || []);
  if (!title && !files.length && !link && !text) { toast('Добавь хотя бы фото, видео, ссылку или текст'); return; }
  const id = c.baseId || 'r' + rid().slice(0, 10);
  busy(btn, true);
  const up = files.length ? await uploadFiles(files, `inbox/recipes/${id}_${Date.now().toString(36).slice(-4)}`, 'Рецепт') : { media: [], photos: [], frames: 0, failed: [] };
  if (files.length && !up.media.length && !link && !text) { busy(btn, false); toast('Файлы не загрузились — проверь связь и нажми ещё раз.'); return; }
  const ok = await writeRecipes(list => {
    const k = list.findIndex(x => x.id === id);
    const rec = k >= 0 ? list[k] : { id, added: today() };
    rec.title = title || rec.title || 'Новый рецепт';
    rec.meals = Array.from(c.meals);
    if (files.length || link || text) rec.draft = true;
    delete rec.kind; delete rec.simple;
    if (up.photos.length) rec.photos = (rec.photos || []).concat(up.photos);
    if (up.media.length) rec.media = (rec.media || []).concat(up.media);
    if (link) rec.link = link;
    if (text) rec.text = text;
    if (k < 0) list.push(rec);
  }, `Рецепт: ${title || 'новый'}`);
  busy(btn, false);
  const rep = files.length ? uploadReport(up, files.length) : '';
  if (ok) { closeSheet(); toast('Рецепт сохранён' + (rep ? ' · ' + rep : '') + '. Разберу, когда позовёшь — а выбрать его можно уже сейчас.'); }
}

/* ---------- money ---------- */
function findExpense(id) {
  for (const mk of Object.keys(S.money)) { const x = ((S.money[mk] || {}).items || []).find(v => v.id === id); if (x) return x; }
  return null;
}
function expenseCatBlock(kind, cat, dir) {
  return `<label class="fld" for="me-cat">Категория</label><select id="me-cat">${catOptions(catsFor(kind), cat)}</select>
    <div id="me-dir-row"${kind === 'transfer' ? '' : ' hidden'}><label class="fld" for="me-dir">Направление</label><select id="me-dir"><option value="out"${dir !== 'in' ? ' selected' : ''}>Отправил</option><option value="in"${dir === 'in' ? ' selected' : ''}>Получил</option></select></div>`;
}
function openExpense(id) {
  const x = findExpense(id); if (!x) return;
  S.cur = { type: 'exp', x };
  const k = kindOf(x);
  openSheet(`<h2 class="sh-title">Запись</h2>
    <label class="fld" for="me-name">Что</label><input id="me-name" value="${esc(x.name)}">
    <div class="two"><div><label class="fld" for="me-amount">Сумма, ${esc(curSym())}</label><input id="me-amount" inputmode="decimal" value="${esc(x.amount)}"></div><div><label class="fld" for="me-date">Дата</label><input type="date" id="me-date" value="${esc(x.date)}"></div></div>
    <label class="fld" for="me-kind">Тип</label><select id="me-kind">${Object.keys(KIND_NAMES).map(v => `<option value="${v}"${v === k ? ' selected' : ''}>${KIND_NAMES[v]}</option>`).join('')}</select>
    <div id="me-catbox">${expenseCatBlock(k, x.cat || catsFor(k)[0], x.dir)}</div>
    <label class="fld" for="me-acc">Банк</label><select id="me-acc"><option value="">—</option>${Object.keys(banks()).map(b => `<option value="${esc(b)}"${x.acc === b ? ' selected' : ''}>${esc(bankName(b))}</option>`).join('')}</select>
    ${x.raw ? `<p class="note">Из выписки: ${esc(x.raw)}${x.time ? ', ' + esc(x.time) : ''}</p>` : ''}
    ${x.group ? `<p class="note">Из чека: ${esc(x.group)}</p>` : ''}
    
    <div class="sh-acts"><button type="button" class="btn money block" data-action="me-save">Сохранить</button><button type="button" class="btn danger block" data-action="me-del">Удалить</button></div>`);
}
async function expenseSave() {
  const c = S.cur; if (!c || c.type !== 'exp') return;
  const old = c.x;
  const name = $('#me-name').value.trim(), amount = numOrNull($('#me-amount').value), date = $('#me-date').value || old.date;
  const kind = $('#me-kind').value, cat = $('#me-cat').value, dirEl = $('#me-dir');
  if (!name || !(amount > 0)) { toast('Нужны название и сумма больше нуля'); return; }
  const upd = Object.assign({}, old, { name, amount: Math.round(amount * 100) / 100, cat, date, kind });
  delete upd.auto;
  if (kind === 'transfer') upd.dir = dirEl ? dirEl.value : 'out'; else delete upd.dir;
  const accEl = $('#me-acc'); if (accEl) { if (accEl.value) upd.acc = accEl.value; else delete upd.acc; }
  let ok;
  if (monthKey(date) === monthKey(old.date)) ok = await writeMonth(monthKey(old.date), items => items.map(x => x.id === old.id ? upd : x), `Деньги: изменена запись «${name}»`);
  else {
    ok = await writeMonth(monthKey(old.date), items => items.filter(x => x.id !== old.id), `Деньги: запись «${name}» перенесена в ${monthKey(date)}`);
    if (ok) ok = await writeMonth(monthKey(date), items => items.concat([upd]), `Деньги: запись «${name}» перенесена из ${monthKey(old.date)}`);
  }
  if (!ok) return;
  closeSheet(); toast('Сохранено');
  if (kind === 'spend' && cat !== old.cat) writeLearned(name, cat);
}
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxSide = 2000;
      const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const dataUrl = cv.toDataURL('image/jpeg', 0.85);
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}
async function uploadReceipts(files) {
  const list = Array.from(files || []);
  if (!list.length) return;
  const date = $('#m-date').value || today();
  const now = new Date();
  const stamp = pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  const btn = $('#m-photo-btn');
  btn.classList.add('busy');
  toast(list.length > 1 ? `Загружаю ${list.length} фото. Не закрывай приложение, пока не закончится.` : 'Загружаю фото…');
  let ok = 0; const failed = [];
  for (let k = 0; k < list.length; k++) {
    setSync(list.length > 1 ? `загружаю фото ${k + 1} из ${list.length}…` : 'загружаю фото…');
    const name = `${date}_${stamp}_${k + 1}of${list.length}_${Math.random().toString(36).slice(2, 6)}.jpg`;
    let b64 = null, lastErr = null;
    try { b64 = await resizeImage(list[k]); }
    catch (_) { try { b64 = await fileToBase64(list[k]); } catch (e) { lastErr = e; } }
    if (b64) {
      for (let attempt = 0; attempt < 2 && b64; attempt++) {
        try { await GH.putRaw('inbox/photos/' + name, b64, `Фото: ${date} (${k + 1}/${list.length})`); S.inbox = S.inbox.concat([name]); ok++; lastErr = null; break; }
        catch (e) { lastErr = e; if (e.code === 'auth' || e.code === 'forbidden') break; await new Promise(r => setTimeout(r, 1200)); }
      }
    }
    if (lastErr || !b64) failed.push(k + 1);
  }
  btn.classList.remove('busy');
  cacheNow(); renderMoney();
  if (!failed.length) { setSync('сохранено в ' + hhmm(new Date())); toast(ok > 1 ? `Загружено фото: ${ok}. Разберу, когда позовёшь.` : 'Фото сохранено. Разберу, когда позовёшь.'); }
  else { setSync(`не загрузились фото № ${failed.join(', ')}`, true); toast(`Загружено ${ok} из ${list.length}. Не дошли № ${failed.join(', ')} — выбери их ещё раз.`); }
}

/* ---------- setup ---------- */
function showSetup(msg) {
  $('#setup').hidden = false; $('#app').hidden = true; $('#tabs').hidden = true; $('#claude-fab').hidden = true;
  const err = $('#su-err');
  if (msg) { err.textContent = msg; err.hidden = false; } else err.hidden = true;
}
function showApp() { $('#setup').hidden = true; $('#app').hidden = false; $('#tabs').hidden = false; $('#claude-fab').hidden = false; }
$('#setup-form').addEventListener('submit', async ev => {
  ev.preventDefault();
  const token = $('#su-token').value.trim();
  let repo = $('#su-repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
  const err = $('#su-err'), btn = $('#su-btn');
  const fail = m => { err.textContent = m; err.hidden = false; btn.disabled = false; btn.textContent = 'Подключить'; };
  if (!token) return fail('Вставь ключ доступа.');
  if (!repo) return fail('Укажи репозиторий с данными.');
  btn.disabled = true; btn.textContent = 'Проверяю…'; err.hidden = true;
  const tmp = { token, owner: '', repo: '' };
  GH.cred = tmp;
  try {
    let owner;
    if (repo.includes('/')) { [owner, repo] = repo.split('/'); }
    else {
      const u = await GH.req('GET', '/user');
      if (u.status === 401) return fail('Ключ не подошёл. Проверь, что скопировал его целиком.');
      if (!u.ok) return fail('GitHub не ответил. Попробуй ещё раз.');
      owner = (await u.json()).login;
    }
    tmp.owner = owner; tmp.repo = repo;
    const r = await GH.req('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    if (r.status === 401) return fail('Ключ не подошёл. Проверь, что скопировал его целиком.');
    if (r.status === 404 || r.status === 403) return fail(`Не вижу репозиторий ${owner}/${repo}. Проверь имя и что ключ выдан именно на него.`);
    if (!r.ok) return fail('GitHub не ответил. Попробуй ещё раз.');
    const info = await r.json();
    if (!info.private) return fail('Этот репозиторий открытый — данные увидят все. Сделай его приватным в настройках GitHub и попробуй снова.');
    if (info.permissions && info.permissions.push === false) return fail('У ключа нет права записи. Дай ему Contents — Read and write.');
    LS.set('bj-cred', tmp);
    $('#su-token').value = '';
    btn.disabled = false; btn.textContent = 'Подключить';
    showApp(); render(); loadAll();
  } catch (e) { fail(e.code === 'offline' ? 'Нет связи с GitHub.' : 'Не получилось подключиться. Попробуй ещё раз.'); }
});
function openSettings() {
  const c = GH.cred;
  openSheet(`<h2 class="sh-title">Подключение</h2>
    ${c ? `<p class="sh-meta">Данные: <span class="mono">${esc(c.owner)}/${esc(c.repo)}</span></p><p class="note">${esc(syncLabel() || 'ещё не загружено')}</p>` : '<p class="sh-meta">Не подключено.</p>'}
    <div class="sh-acts">
      <button type="button" class="btn block" data-action="refresh">Обновить данные</button>
      ${c ? '<button type="button" class="btn danger block" data-action="logout">Отключить это устройство</button>' : ''}
    </div>
    <p class="note">«Отключить» удаляет ключ и сохранённые данные только с этого устройства. Сам ключ отзывается на GitHub: Settings → Developer settings → Personal access tokens.</p>`);
}

/* ---------- events wiring ---------- */
const TABS = ['plan', 'cal', 'lessons', 'food', 'money'];
function setTab(t) {
  if (!TABS.includes(t)) t = 'plan';
  TABS.forEach(x => { $('#tab-' + x).hidden = x !== t; });
  document.querySelectorAll('.tab-btn').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  LS.set('bj-tab', t);
  window.scrollTo(0, 0);
  if (t === 'lessons' && S.ready) loadNotes();
}
async function shiftPeriod(delta) {
  const k = periodShift(S.period, delta);
  if (k > today()) return;
  S.period = k; renderMoney();
  await ensureMoney(periodMonths(k)); renderMoney();
}
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action, d = b.dataset.date, id = b.dataset.id;
  if (b.disabled) return;
  switch (a) {
    case 'tab': setTab(b.dataset.tab); break;
    case 'close': closeSheet(); break;
    case 'refresh': closeSheet(); loadAll(); break;
    case 'settings': openSettings(); break;
    case 'logout': try { Object.keys(localStorage).filter(k => k.startsWith('bj-')).forEach(k => localStorage.removeItem(k)); } catch (_) {} GH.cred = null; closeSheet(); location.reload(); break;
    case 'study': openStudy(d, b.dataset.key, Number(b.dataset.part)); break;
    case 'study-done': if (S.cur && S.cur.type === 'study') { busy(b, true); const e = S.cur.e; await studyDone(e, e.date < today() ? e.date : today()); busy(b, false); } break;
    case 'study-block': busy(b, true); await blockFlow(d, reasonVal('st-reason') || reasonVal('dy-reason')); busy(b, false); break;
    case 'add-study': openAddStudy(d); break;
    case 'add-sport': openAddSport(d); break;
    case 'add-sport-key': busy(b, true); await addSport(d, b.dataset.key); busy(b, false); break;
    case 'add-sport-custom': {
      const lines = (($('#as-custom') && $('#as-custom').value) || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (!lines.length) { toast('Впиши упражнения, каждое с новой строки'); return; }
      busy(b, true); await addSport(d, null, lines); busy(b, false); break;
    }
    case 'study-on': busy(b, true); await studyOn(id, d); busy(b, false); break;
    case 'sleep': openSleep(d || today()); break;
    case 'sleep-save': {
      const c = S.cur; if (!c || c.type !== 'sleep') return;
      const bed = $('#sl-bed').value, wake = $('#sl-wake').value, note = ($('#sl-note').value || '').trim();
      if (!bed || !wake) { toast('Укажи, во сколько лёг и встал'); return; }
      busy(b, true);
      if (await writeSleep(days => { const rec = { bed, wake }; if (note) rec.note = note; days[c.d] = rec; }, `Сон ${c.d}: ${bed}–${wake}`)) { closeSheet(); toast('Сон записан: ' + hm(sleepMin({ bed, wake }))); }
      busy(b, false); break;
    }
    case 'sleep-del': { const c = S.cur; if (!c || c.type !== 'sleep') return; busy(b, true); if (await writeSleep(days => { delete days[c.d]; }, `Сон ${c.d}: удалён`)) { closeSheet(); toast('Удалено'); } busy(b, false); break; }
    case 'sp-restore': busy(b, true); await setSportState(id, 'done'); busy(b, false); break;
    case 'sp-extra-del': {
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Нажми ещё раз, чтобы удалить'; return; }
      busy(b, true);
      if (await writePlan(p => { p.sportExtra = p.sportExtra.filter(x => x.id !== id); delete p.sportMoves[id]; }, `Спорт: удалена добавленная тренировка ${id}`)) { S.sportList = S.sportList.filter(x => x.id !== id); closeSheet(); toast('Тренировка удалена'); }
      busy(b, false); break;
    }
    case 'done-toggle': S.showAllDone = !S.showAllDone; renderLessons(); break;
    case 'ideas': openRequests(b.dataset.area || 'sport'); break;
    case 'req-tab': openRequests(b.dataset.tab); break;
    case 'idea-save': await ideaSave(b, b.dataset.area); break;
    case 'idea-del': {
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Точно?'; return; }
      busy(b, true);
      if (await writeIdeas(list => { const k = list.findIndex(x => x.id === id); if (k >= 0) list.splice(k, 1); }, 'Идея удалена')) openRequests(null, true);
      busy(b, false); break;
    }
    case 'rq-edit': if (S.cur && S.cur.type === 'req') { S.cur.editId = id; openRequests('req', true); const t = $('#rq-edit'); if (t && t.focus) t.focus(); } break;
    case 'rq-edit-cancel': if (S.cur && S.cur.type === 'req') { S.cur.editId = null; openRequests('req', true); } break;
    case 'rq-edit-save': {
      const text = (($('#rq-edit') && $('#rq-edit').value) || '').trim();
      if (!text) { toast('Запрос пустой — лучше удали его'); return; }
      busy(b, true);
      if (await writeRequests(list => { const r = list.find(x => x.id === id); if (r) { r.text = text; r.edited = today(); } }, 'Запрос для Claude изменён')) { S.cur.editId = null; toast('Сохранено'); openRequests('req', true); }
      busy(b, false); break;
    }
    case 'note': openNote(b.dataset.path); break;
    case 'note-link': {
      const name = norm(b.dataset.name || '').split('#')[0];
      const f = ((S.notes && S.notes.files) || []).find(p => norm(p.split('/').pop().replace(/\.md$/i, '')) === name);
      if (f) openNote(f); else toast('Такой заметки нет в репозитории');
      break;
    }
    case 'notes-setup': openNotesSetup(); break;
    case 'notes-reload': S.noteCache = {}; loadNotes(true); break;
    case 'notes-save': {
      const repo = ($('#nt-repo').value || '').trim().replace(/^.*github\.com\//, '').replace(/^[^/]+\//, '').replace(/\.git$/, ''), path = ($('#nt-path').value || '').trim().replace(/^\/+|\/+$/g, '');
      if (!repo) { toast('Впиши имя репозитория'); return; }
      busy(b, true);
      if (await writeConfig(c => { c.notes = { repo, path }; }, `Заметки: ${repo}${path ? '/' + path : ''}`)) { closeSheet(); S.notes = null; S.noteCache = {}; loadNotes(true); toast('Сохранено'); }
      busy(b, false); break;
    }
    case 'acct-cards': openCards(); break;
    case 'auto-setup': openAutoSetup(); break;
    case 'budget': openBudget(); break;
    case 'duty-on': busy(b, true); await setDuty(d, true); busy(b, false); break;
    case 'duty-off': busy(b, true); await setDuty(d, false); busy(b, false); break;
    case 'abs-new': openAbsence(null, d); break;
    case 'absence': openAbsence(b.dataset.id); break;
    case 'abs-type': if (S.cur && S.cur.type === 'absence') { S.cur.a = Object.assign({}, S.cur.a, { type: b.dataset.type, from: $('#ab-from').value || S.cur.a.from, to: $('#ab-to').value || S.cur.a.to, note: $('#ab-note').value }); openAbsence(S.cur.a.id, null); if (!S.cur.a.id) { $('#ab-from').value = S.cur.a.from; } } break;
    case 'abs-save': busy(b, true); await absenceSave(false); busy(b, false); break;
    case 'abs-del': busy(b, true); await absenceSave(true); busy(b, false); break;
    case 'timer-start': timerStart(b.dataset.n); break;
    case 'timer-stop': openTimerStop(); break;
    case 'timer-cancel': LS.del('bj-timer'); renderTimerChip(); closeSheet(); break;
    case 'timer-save': {
      const c = S.cur; if (!c || c.type !== 'timer') break;
      busy(b, true);
      const ok = await logStudy(c.min, c.n, today(), 'timer');
      busy(b, false);
      if (!ok) break;
      LS.del('bj-timer'); renderTimerChip();
      if (b.dataset.done) {
        const st = buildStudy(); const e = st.entries.find(x => x.date === today() && (!c.n || String(x.L.n) === String(c.n)));
        S.skipActual = true;
        if (e) await studyDone(e, today()); else { S.skipActual = false; openAddStudy(today()); }
      } else { closeSheet(); toast('Время сохранено: ' + hmShort(c.min)); }
      break;
    }
    case 'actual-set': { const c = S.cur; if (!c || c.type !== 'actual') break; busy(b, true); const ok = await logStudy(Number(b.dataset.min), c.n, c.date, 'manual'); busy(b, false); if (ok) { closeSheet(); toast('Записал: ' + hmShort(Number(b.dataset.min))); } break; }
    case 'weight': openWeight(d); break;
    case 'weight-save': busy(b, true); await weightSave(false); busy(b, false); break;
    case 'weight-del': busy(b, true); await weightSave(true); busy(b, false); break;
    case 'buy': openBuy(b.dataset.id); break;
    case 'buy-new': openBuy(null); break;
    case 'buy-save': busy(b, true); await buySave(); busy(b, false); break;
    case 'buy-done': busy(b, true); await buySave('done'); busy(b, false); break;
    case 'buy-del': busy(b, true); await buySave('del'); busy(b, false); break;
    case 'budget-save': busy(b, true); await budgetSave(); busy(b, false); break;
    case 'reg': openRegular(b.dataset.id); break;
    case 'reg-new': openRegular(null); break;
    case 'reg-save': busy(b, true); await regularSave(false); busy(b, false); break;
    case 'reg-del': busy(b, true); await regularSave(true); busy(b, false); break;
    case 'goal': openGoal(b.dataset.id); break;
    case 'goal-save': busy(b, true); await goalSave(); busy(b, false); break;
    case 'pf-open': openPortfolio('prog'); break;
    case 'pf-tab': openPortfolio(b.dataset.tab); break;
    case 'rev-open': openReview(b.dataset.type || 'week', b.dataset.from || null); break;
    case 'rev-type': openReview(b.dataset.type, null); break;
    case 'rev-prev': if (S.rev) openReview(S.rev.type, revShift(S.rev.type, S.rev.from, -1)); break;
    case 'rev-next': if (S.rev) openReview(S.rev.type, revShift(S.rev.type, S.rev.from, 1)); break;
    case 'notes-check': busy(b, true); await checkNotesPushed(); busy(b, false); toast(S.notesPush && S.notesPush.pushed ? 'Заметки за сегодня на месте ✓' : 'Пока не вижу отправленных заметок за сегодня'); break;
    case 'notes-skip': LS.set('bj-notes-skip', today()); renderPlan(); break;
    case 'auto-test': autoTest(); break;
    case 'copy': {
      const t = b.dataset.text || '';
      try { await navigator.clipboard.writeText(t); toast('Скопировано'); } catch (_) { toast('Не скопировалось — выдели текст и скопируй вручную'); }
      break;
    }
    case 'cards-save': busy(b, true); await cardsSave(); busy(b, false); break;
    case 'unblock': busy(b, true); if (await writePlan(p => { delete p.studyDays[d]; }, `Учёба: окно ${d} возвращено`)) { S.shift = {}; closeSheet(); toast('Окно вернул'); render(); } busy(b, false); break;
    case 'day': openDay(d); break;
    case 'day-extra': busy(b, true); if (await writePlan(p => { p.studyDays[d] = { extra: Number(b.dataset.min) }; }, `Учёба: доп. окно ${d}`)) { S.shift = {}; closeSheet(); toast('Окно добавлено, уроки подтянулись'); } busy(b, false); break;
    case 'day-unextra': busy(b, true); if (await writePlan(p => { delete p.studyDays[d]; }, `Учёба: доп. окно ${d} убрано`)) { closeSheet(); toast('Окно убрано'); } busy(b, false); break;
    case 'cal-prev': S.calMonth = monthShift(S.calMonth, -1); renderCal(); break;
    case 'cal-next': S.calMonth = monthShift(S.calMonth, 1); renderCal(); break;
    case 'ev-new': openEvent(null, d); break;
    case 'event': openEvent(id); break;
    case 'ev-save': busy(b, true); await eventSave(); busy(b, false); break;
    case 'ev-del': {
      const e = S.cur && S.cur.ev; if (!e || !e.id) return;
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Нажми ещё раз, чтобы удалить'; return; }
      busy(b, true); if (await writeEvents(list => { const k = list.findIndex(x => x.id === e.id); if (k >= 0) list.splice(k, 1); }, `События: удалено «${e.title}»`)) { closeSheet(); toast('Событие удалено'); } busy(b, false); break;
    }
    case 'sport': openSport(id); break;
    case 'sp-done': {
      busy(b, true);
      const c = sheetSport(id);
      if (c) { const lg = collectLog(c.ses); if (lg.any) { const i = findInst(id); if (i && !(await saveLog(i, c.ses, lg.blocks))) { busy(b, false); return; } } }
      await setSportState(id, 'done'); busy(b, false); break;
    }
    case 'sp-save-log': {
      const c = sheetSport(id), i = findInst(id); if (!c || !i) return;
      const lg = collectLog(c.ses);
      if (!lg.any) { toast('Пока нечего сохранять: впиши вес или повторы'); return; }
      busy(b, true); if (await saveLog(i, c.ses, lg.blocks)) { toast('Подходы сохранены'); openSport(id, true); } busy(b, false); break;
    }
    case 'sp-skip': busy(b, true); await setSportState(id, 'skipped', undefined, sheetSport(id) ? reasonVal('sp-reason') : undefined); busy(b, false); break;
    case 'sp-clear': busy(b, true); await setSportState(id, null); busy(b, false); break;
    case 'sp-other': {
      const note = (($('#sp-note') && $('#sp-note').value) || '').trim();
      if (!note) { toast('Напиши, что сделал вместо программы'); if ($('#sp-note')) $('#sp-note').focus(); return; }
      busy(b, true); await setSportState(id, 'other', note, reasonVal('sp-reason') || undefined); busy(b, false); break;
    }
    case 'sp-unmove': { const i = findInst(id); if (!i) return; busy(b, true); if (await writePlan(p => setMove(p, id, { movedTo: undefined }), `Спорт: ${id} возвращено`)) { closeSheet(); toast('Вернул на ' + short(i.orig)); } busy(b, false); break; }
    case 'sp-move-auto': { const i = findInst(id); if (i && S.cur && S.cur.auto) { busy(b, true); await commitMove(i, S.cur.auto, reasonVal('sp-reason')); busy(b, false); } break; }
    case 'sp-move-date': {
      const i = findInst(id); const v = $('#sp-date') && $('#sp-date').value;
      if (!i || !v) return;
      if (v < today()) { toast('Выбери сегодня или позже'); return; }
      if (v === i.eff) { closeSheet(); return; }
      busy(b, true); await commitMove(i, planMove(i, v), reasonVal('sp-reason')); busy(b, false); break;
    }
    case 'sp-as': {
      const i = findInst(id); if (!i) return;
      const k = b.dataset.as;
      busy(b, true);
      if (await writePlan(p => setMove(p, id, { as: k === i.key ? undefined : k, custom: undefined, swap: undefined }), `Спорт: ${id} заменена на ${k}`)) { LS.del('bj-draft-' + id); toast('Тренировка заменена'); const ni = findInst(id); if (ni) openSport(id); }
      busy(b, false); break;
    }
    case 'sp-custom': {
      const lines = (($('#sp-custom') && $('#sp-custom').value) || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (!lines.length) { toast('Впиши упражнения, каждое с новой строки'); return; }
      busy(b, true);
      if (await writePlan(p => setMove(p, id, { custom: lines, as: undefined, swap: undefined }), `Спорт: ${id} — своя тренировка`)) { LS.del('bj-draft-' + id); toast('Тренировка заменена'); openSport(id); }
      busy(b, false); break;
    }
    case 'sp-as-clear': busy(b, true); if (await writePlan(p => setMove(p, id, { as: undefined, custom: undefined, swap: undefined }), `Спорт: ${id} — по программе`)) { LS.del('bj-draft-' + id); toast('Вернул тренировку по программе'); openSport(id); } busy(b, false); break;
    case 'ex-swap': { const f = document.getElementById(`swf-${b.dataset.b}-${b.dataset.e}`); if (f) { f.hidden = !f.hidden; if (!f.hidden) { const inp = f.querySelector('input'); if (inp) inp.focus(); } } break; }
    case 'ex-swap-once': case 'ex-swap-perm': case 'ex-unswap': {
      const c = S.cur && S.cur.type === 'sport' ? S.cur : null; if (!c) return;
      const bi = Number(b.dataset.b), ei = Number(b.dataset.e), key = bi + '.' + ei;
      const inp = document.getElementById(`swi-${bi}-${ei}`);
      const name = inp ? inp.value.trim() : '';
      const i = findInst(c.id); if (!i) return;
      const lg = collectLog(c.ses); if (lg.any) LS.set('bj-draft-' + i.id, { blocks: lg.blocks });
      busy(b, true);
      let ok = false;
      if (a === 'ex-unswap') ok = await writePlan(p => { const sw = Object.assign({}, (p.sportMoves[i.id] || {}).swap || {}); delete sw[key]; setMove(p, i.id, { swap: sw }); }, `Спорт: ${i.id} — вернул упражнение`);
      else if (!name) { toast('Впиши, чем заменить'); busy(b, false); return; }
      else if (a === 'ex-swap-once') ok = await writePlan(p => { const sw = Object.assign({}, (p.sportMoves[i.id] || {}).swap || {}); sw[key] = name; setMove(p, i.id, { swap: sw }); }, `Спорт: ${i.id} — замена упражнения`);
      else {
        const sk = c.ses.key;
        ok = await writeConfig(cfg => { const s = cfg.sport.sessions[sk]; if (!s.blocks) s.blocks = itemsToBlocks(s.items); const x = s.blocks[bi] && s.blocks[bi].ex[ei]; if (x) x.name = name; }, `Программа ${sk}: ${name}`);
        if (ok && i.ov && i.ov.swap && i.ov.swap[key]) ok = await writePlan(p => { const sw = Object.assign({}, (p.sportMoves[i.id] || {}).swap || {}); delete sw[key]; setMove(p, i.id, { swap: sw }); }, `Спорт: ${i.id} — замена в программе`);
      }
      busy(b, false);
      if (ok) { toast(a === 'ex-swap-perm' ? 'Упражнение заменено в программе' : a === 'ex-unswap' ? 'Вернул упражнение' : 'Заменил на этот раз'); openSport(i.id, true); }
      break;
    }
    case 'st-tail-done': { const st = S.studyCache || buildStudy(); const e0 = st.entries[0]; if (e0) { busy(b, true); await studyDone(Object.assign({}, e0, { last: true }), d); busy(b, false); } break; }
    case 'st-tail-skip': busy(b, true); if (await writePlan(p => { p.studyDays[d] = { blocked: true }; }, `Учёба: пропуск ${d}`)) toast('Пропуск записан'); busy(b, false); break;
    case 'lesson': openLesson(id); break;
    case 'lesson-ph': openLessonPh(Number(b.dataset.n)); break;
    case 'le-need': if (S.cur) { S.cur.need = b.dataset.need === '' ? null : Number(b.dataset.need); document.querySelectorAll('[data-action="le-need"]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); } break;
    case 'le-save': busy(b, true); await lessonSave(); busy(b, false); break;
    case 'le-up': busy(b, true); await lessonMove(-1); busy(b, false); break;
    case 'le-down': busy(b, true); await lessonMove(1); busy(b, false); break;
    case 'le-undone': { const l = S.cur && S.cur.l; if (!l) return; busy(b, true); if (await writeLessons(list => { const x = list.find(y => y.id === l.id); if (x) { delete x.done; delete x.progress; delete x.progressDates; } }, `Учёба: урок ${l.n} снова в очереди`)) { closeSheet(); toast(`Урок ${l.n} снова в очереди`); } busy(b, false); break; }
    case 'le-del': {
      const l = S.cur && S.cur.l; if (!l) return;
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Нажми ещё раз, чтобы удалить'; return; }
      busy(b, true); if (await writeLessons(list => { const k = list.findIndex(y => y.id === l.id); if (k >= 0) list.splice(k, 1); }, `Учёба: урок ${l.n} удалён`)) { closeSheet(); toast(`Урок ${l.n} удалён`); } busy(b, false); break;
    }
    case 'req': S.cur = null; openRequests('req'); break;
    case 'rq-add': {
      const text = (($('#rq-text') && $('#rq-text').value) || '').trim();
      if (!text) { toast('Напиши, что сделать'); if ($('#rq-text')) $('#rq-text').focus(); return; }
      busy(b, true);
      if (await writeRequests(list => { list.push({ id: 'q' + rid().slice(0, 10), text, date: today(), ts: Date.now(), status: 'new' }); }, 'Запрос для Claude: ' + text.slice(0, 50))) { toast('Записал. Сделаю, когда откроешь меня на компьютере.'); openRequests(); }
      busy(b, false); break;
    }
    case 'rq-del': {
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Точно?'; return; }
      busy(b, true);
      if (await writeRequests(list => { const k = list.findIndex(r => r.id === id); if (k >= 0) list.splice(k, 1); }, 'Запрос для Claude удалён')) openRequests();
      busy(b, false); break;
    }
    case 'ev-done': {
      const c = S.cur; if (!c || c.type !== 'event' || !c.ev.id) return;
      const e = c.ev, occ = d || c.occ;
      const wasDone = Array.isArray(e.done) && e.done.includes(occ);
      busy(b, true);
      if (await writeEvents(list => { const x = list.find(y => y.id === e.id); if (!x) return; const set = new Set(x.done || []); if (set.has(occ)) set.delete(occ); else set.add(occ); x.done = Array.from(set).sort(); if (!x.done.length) delete x.done; }, `События: «${e.title}» ${occ} — ${wasDone ? 'снята отметка' : 'сделано'}`)) {
        closeSheet();
        const nx = e.repeat ? nextOccurrence(e, addDays(occ, 1)) : null;
        toast(wasDone ? 'Отметка снята' : nx ? `Отмечено. Следующий раз: ${short(nx)}` : 'Отмечено');
      }
      busy(b, false); break;
    }
    case 'food-prev': S.foodDate = addDays(S.foodDate, -1); renderFood(); break;
    case 'food-next': S.foodDate = addDays(S.foodDate, 1); renderFood(); break;
    case 'meal-pick': openMealPick(b.dataset.meal); break;
    case 'meal-quick': busy(b, true); await quickDishes(b.dataset.meal, $('#mp-name') && $('#mp-name').value); busy(b, false); break;
    case 'meal-add': {
      const meal = b.dataset.meal, r = recipeById(id); if (!r) return;
      busy(b, true);
      if (await writeMeals(days => { const day = days[S.foodDate] = days[S.foodDate] || {}; (day[meal] = Array.isArray(day[meal]) ? day[meal] : []).push(id); }, `Еда ${S.foodDate}: ${MEAL_NAME[meal]} — ${r.title}`)) { closeSheet(); toast(`${MEAL_NAME[meal]}: ${r.title}`); }
      busy(b, false); break;
    }
    case 'meal-remove': {
      const meal = b.dataset.meal, idx = Number(b.dataset.idx);
      busy(b, true);
      await writeMeals(days => { const day = days[S.foodDate]; if (day && Array.isArray(day[meal])) { day[meal].splice(idx, 1); if (!day[meal].length) delete day[meal]; if (!Object.keys(day).length) delete days[S.foodDate]; } }, `Еда ${S.foodDate}: убрано из «${MEAL_NAME[meal]}»`);
      busy(b, false); break;
    }
    case 'recipe': openRecipe(id); break;
    case 'rc-new': openRecipeNew(b.dataset.meal); break;
    case 'rc-meal': {
      const c = S.cur; if (!c) return;
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      if (c.type === 'recipe-new') { if (on) c.meals.add(b.dataset.meal); else c.meals.delete(b.dataset.meal); }
      break;
    }
    case 'rc-save': await recipeSave(b); break;
    case 'rc-edit-save': {
      const c = S.cur; if (!c || c.type !== 'recipe') return;
      const title = $('#rc-title').value.trim() || c.r.title;
      const meals = Array.from(document.querySelectorAll('[data-action="rc-meal"][aria-pressed="true"]')).map(x => x.dataset.meal);
      busy(b, true);
      if (await writeRecipes(list => { const x = list.find(r => r.id === c.r.id); if (x) { x.title = title; x.meals = meals; } }, `Рецепт: ${title}`)) { closeSheet(); toast('Сохранено'); }
      busy(b, false); break;
    }
    case 'rc-del': {
      const c = S.cur; if (!c || (c.type !== 'recipe' && c.type !== 'combo')) return;
      const rid0 = c.type === 'combo' ? c.id : c.r.id, r0 = recipeById(rid0); if (!r0) return;
      const usedIn = S.recipes.filter(x => isCombo(x) && (x.parts || []).includes(rid0));
      if (usedIn.length) { toast(`Нельзя удалить: входит в «${usedIn[0].title}». Сначала убери из составного.`); return; }
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Нажми ещё раз, чтобы удалить'; return; }
      busy(b, true);
      if (await writeRecipes(list => { const k = list.findIndex(r => r.id === rid0); if (k >= 0) list.splice(k, 1); }, `Еда: удалено «${r0.title}»`)) { closeSheet(); toast('Удалено'); }
      busy(b, false); break;
    }
    case 'rc-attach': openRecipeNew(null, id); break;
    case 'combo-new': openCombo(null, b.dataset.meal); break;
    case 'combo-edit': openCombo(id); break;
    case 'combo-with': { openCombo(null, null); if (S.cur && S.cur.type === 'combo') { S.cur.parts.add(id); const chip = document.querySelector(`#cb-parts [data-id="${id}"]`); if (chip) chip.setAttribute('aria-pressed', 'true'); } break; }
    case 'combo-part': { const c = S.cur; if (!c || c.type !== 'combo') return; const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); if (on) c.parts.add(id); else c.parts.delete(id); break; }
    case 'combo-meal': { const c = S.cur; if (!c || c.type !== 'combo') return; const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); if (on) c.meals.add(b.dataset.meal); else c.meals.delete(b.dataset.meal); break; }
    case 'combo-save': await comboSave(b); break;
    case 'acct': openAccount(id); break;
    case 'acct-new': openAccount(null); break;
    case 'acct-save': busy(b, true); await accountSave(); busy(b, false); break;
    case 'acct-del': {
      const c = S.cur; if (!c || c.type !== 'acct' || !c.a.id) return;
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Нажми ещё раз, чтобы удалить'; return; }
      busy(b, true);
      if (await writeConfig(cfg => { const l = ((cfg.money || {}).accounts) || []; const k = l.findIndex(x => x.id === c.a.id); if (k >= 0) l.splice(k, 1); }, `Деньги: удалено «${c.a.name}»`)) { closeSheet(); toast('Удалено'); }
      busy(b, false); break;
    }
    case 'm-prev': shiftPeriod(-1); break;
    case 'm-next': shiftPeriod(1); break;
    case 'mrow': openExpense(id); break;
    case 'me-save': busy(b, true); await expenseSave(); busy(b, false); break;
    case 'me-del': {
      const x = S.cur && S.cur.x; if (!x) return;
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Нажми ещё раз, чтобы удалить'; return; }
      busy(b, true); if (await writeMonth(monthKey(x.date), items => items.filter(y => y.id !== x.id), `Деньги: удалена запись «${x.name}»`)) { closeSheet(); toast('Запись удалена'); } busy(b, false); break;
    }
  }
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
let draftT;
$('#sheet').addEventListener('input', ev => {
  const c = S.cur;
  if (ev.target.id === 'ev-n') repNote();
  if (ev.target.id === 'sl-bed' || ev.target.id === 'sl-wake') sleepDurNote();
  if (c && c.type === 'sport' && ev.target.id && ev.target.id.startsWith('lg-')) {
    clearTimeout(draftT);
    draftT = setTimeout(() => { const lg = collectLog(c.ses); if (lg.any) LS.set('bj-draft-' + c.id, { blocks: lg.blocks }); }, 400);
  }
});
document.addEventListener('change', async ev => {
  const el = ev.target;
  if (el.id && el.id.startsWith('lg-') && el.type === 'checkbox') {
    const c = S.cur; if (c && c.type === 'sport') { const lg = collectLog(c.ses); LS.set('bj-draft-' + c.id, { blocks: lg.blocks }); }
    return;
  }
  if (el.matches && el.matches('[data-slot]')) {
    const k = el.dataset.slot, v = Number(el.value);
    if (await writeConfig(c => { c.study = c.study || {}; c.study.slots = c.study.slots || {}; c.study.slots[k] = v; if (c.study.labels) delete c.study.labels[k]; }, `Учёба: окно ${DOW_S[Number(k)]} = ${v} мин`)) { S.shift = {}; toast(`${DOW_S[Number(k)]}: ${v ? dur(v) : 'без учёбы'}`); }
  } else if (el.id === 'm-cur') {
    if (await writeConfig(c => { c.currency = el.value; }, 'Валюта: ' + el.value)) toast('Валюта: ' + el.value);
  } else if (el.id === 'm-period') {
    const v = Number(el.value);
    if (await writeConfig(c => { c.money = c.money || {}; c.money.periodStart = v; }, `Деньги: месяц бюджета с ${v}-го`)) { S.period = null; ensurePeriod(); await ensureMoney(periodMonths(S.period)); renderMoney(); toast(v === 1 ? 'Месяц бюджета — календарный' : `Месяц бюджета начинается ${v}-го`); }
  } else if (el.id === 'm-photo') {
    const files = el.files ? Array.from(el.files) : []; el.value = '';
    if (files.length) uploadReceipts(files);
  } else if (el.id === 'me-kind') {
    const box = $('#me-catbox'); const x = S.cur && S.cur.x;
    if (box) box.innerHTML = expenseCatBlock(el.value, x && kindOf(x) === el.value ? x.cat : catsFor(el.value)[0], x && x.dir);
  } else if (el.id === 'ev-unit' || el.id === 'ev-n' || el.id === 'ev-date') {
    repNote();
  } else if (el.id === 'rc-files' || el.id === 'id-files') {
    const n = el.files ? el.files.length : 0, lab = $(el.id === 'rc-files' ? '#rc-files-label' : '#id-files-label');
    if (lab) lab.textContent = n ? `Выбрано файлов: ${n}` : (el.id === 'rc-files' ? 'Выбрать фото или видео' : 'Добавить фото или видео');
  } else if (el.dataset && el.dataset.foodPhoto) {
    const f = el.files && el.files[0], meal = el.dataset.foodPhoto; el.value = '';
    if (f) foodPhoto(meal, f);
  } else if (el.id === 'sl-bed' || el.id === 'sl-wake') {
    sleepDurNote();
  }
});
$('#lesson-add').addEventListener('submit', async ev => {
  ev.preventDefault();
  const inp = $('#la-title'), title = inp.value.trim();
  if (!title) { inp.focus(); return; }
  let n = 0;
  const ok = await writeLessons(list => { n = Math.max(10, ...list.map(l => Number(l.n) || 0)) + 1; list.push({ id: 'l' + n, n, title, order: Math.max(0, ...list.map(ord)) + 1 }); }, 'Учёба: новый урок в очереди');
  if (ok) { inp.value = ''; toast(`Урок ${n} добавлен в очередь`); }
});
$('#money-add').addEventListener('submit', async ev => {
  ev.preventDefault();
  const ta = $('#m-text'), err = $('#m-err'), btn = $('#m-submit');
  const date = $('#m-date').value || today();
  const kind = $('#m-kind').value || 'spend';
  const res = parseSpend(ta.value);
  if (!res.items.length) {
    err.textContent = ta.value.trim() ? 'Не нашёл суммы. Пиши так: хлеб 45, такси 320.' : 'Напиши, что и за сколько.';
    err.hidden = false; return;
  }
  const now = Date.now();
  const recs = res.items.map((x, k) => {
    const r = { id: rid(), date, name: x.name, amount: x.amount, kind, ts: now + k };
    if (kind === 'spend') { const c = categorize(x.name); r.cat = c.cat; if (!c.known) r.auto = true; }
    else { r.cat = catsFor(kind)[0]; if (kind === 'transfer') r.dir = 'out'; }
    return r;
  });
  btn.disabled = true;
  const mk = monthKey(date);
  const ok = await writeMonth(mk, items => items.concat(recs), `Деньги: +${recs.length} (${date})`);
  btn.disabled = false;
  if (!ok) return;
  if (res.bad.length) { ta.value = res.bad.join(', '); err.textContent = 'Для этого не нашёл сумму. Допиши и добавь ещё раз.'; err.hidden = false; }
  else { ta.value = ''; err.hidden = true; }
  toast(`Записал: ${recs.length} · ${fmt(recs.reduce((a, x) => a + x.amount, 0))} ${curSym()}`);
  if (date < S.period || date > periodEnd(S.period)) { S.period = periodOf(date); await ensureMoney(periodMonths(S.period)); }
  renderMoney();
});

/* ---------- boot ---------- */
function boot() {
  setTab(LS.get('bj-tab') || 'plan');
  $('#m-date').value = today();
  const cred = LS.get('bj-cred');
  if (!cred || !cred.token) { showSetup(); render(); return; }
  GH.cred = cred;
  showApp();
  const cache = LS.get('bj-cache');
  if (cache && cache.config) {
    applyData(cache);
    S.ready = true; S.lastLoad = cache.ts || 0;
    setSync(S.lastLoad ? 'показаны данные на ' + hhmm(new Date(S.lastLoad)) : '');
  }
  render();
  loadAll(!!cache);
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && GH.cred && Date.now() - S.lastLoad > 60000) loadAll(true);
});
setInterval(() => {
  const t = today();
  if (t !== S.lastToday) {
    const md = $('#m-date');
    if (md.value === S.lastToday) md.value = t;
    S.lastToday = t;
    render();
  }
}, 60000);
boot();
})();
