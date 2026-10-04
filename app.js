(function(){
'use strict';

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = u => { try { const x = new URL(String(u || '').trim()); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (_) { return ''; } };
const pad = n => String(n).padStart(2, '0');
const sleepMs = ms => new Promise(r => setTimeout(r, ms));
// приложение свёрнуто — ждём, пока его снова откроют (но не дольше 10 минут)
const waitVisible = () => document.hidden ? new Promise(r => { const t = setTimeout(done, 600000); function done() { clearTimeout(t); document.removeEventListener('visibilitychange', on); r(); } function on() { if (!document.hidden) done(); } document.addEventListener('visibilitychange', on); }) : Promise.resolve();
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
const LET = 'АБВГДЕЖЗИК';
const DOTS = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/></svg>';
const LS = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  del(k) { try { localStorage.removeItem(k); } catch (_) {} }
};

const demo = () => !!LS.get('bj-demo');
// Полоса загрузки файлов: подготовка (кадры, сжатие) — до 40%, отправка — 40–98% по байтам, с оценкой времени.
const PROG = {
  start(title) { this.t0 = Date.now(); this.title = title; this.last = 0; clearTimeout(this.hT); this.set(0, ''); },
  step(stage, frac, detail) { frac = Math.max(0, Math.min(1, frac || 0)); this.set(stage === 'prep' ? frac * 40 : stage === 'up' ? 40 + frac * 58 : 99, detail); },
  set(pct, detail) {
    const el = document.getElementById('up-prog'); if (!el) return;
    pct = Math.max(this.last || 0, Math.min(100, pct)); this.last = pct;
    const sec = (Date.now() - (this.t0 || Date.now())) / 1000;
    let eta = '';
    if (pct > 3 && pct < 99 && sec > 2) { const left = Math.round(sec * (100 - pct) / pct); eta = left < 60 ? `≈ ${Math.max(1, left)} с` : `≈ ${Math.ceil(left / 60)} мин`; }
    if (typeof outTick === 'function') outTick(pct, detail, eta);
    el.hidden = false; el.classList.toggle('mini', !!this.mini);
    el.innerHTML = `<div class="upp-row"><b>${esc(this.title || 'Отправляю')}</b><span>${Math.round(pct)}%${eta ? ' · ' + eta : ''}</span></div><div class="upp-bar"><i style="width:${pct.toFixed(1)}%"></i></div>${detail ? `<div class="upp-d">${esc(detail)}</div>` : ''}`;
  },
  done(ok, note) {
    this.set(100, note || (ok ? 'готово' : 'не всё отправилось'));
    clearTimeout(this.hT);
    this.hT = setTimeout(() => { const el = document.getElementById('up-prog'); if (el) el.hidden = true; this.last = 0; }, ok ? 1200 : 4000);
  }
};
const demoBad = t => demo() && /кредит|долг|займ|ипотек/i.test(String(t || ''));
/* ---------- GitHub storage ---------- */
const GH = {
  cred: null, sha: {}, q: {}, docs: LS.get('bj-docs') || {},
  async req(method, path, body, extra) {
    const headers = Object.assign({ 'Authorization': 'Bearer ' + this.cred.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, extra || {});
    if (body) headers['Content-Type'] = 'application/json';
    try { return await fetch('https://api.github.com' + path, { method, headers, cache: 'no-store', body: body ? JSON.stringify(body) : undefined }); }
    catch (_) { const e = new Error('offline'); e.code = 'offline'; throw e; }
  },
  fail(r) { const e = new Error('http ' + r.status); e.code = r.status === 401 ? 'auth' : r.status === 403 ? 'forbidden' : r.status === 404 ? 'notfound' : (r.status === 409 || r.status === 422) ? 'conflict' : 'http'; e.status = r.status; return e; },
  url(path) { return `/repos/${encodeURIComponent(this.cred.owner)}/${encodeURIComponent(this.cred.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`; },
  // Условный запрос: если файл не менялся, GitHub отвечает 304 без тела — быстрее и не тратит лимит.
  async getJSON(path) {
    const m = this.docs[path];
    const r = await this.req('GET', this.url(path), null, m && m.etag && m.text != null ? { 'If-None-Match': m.etag } : null);
    if (r.status === 304 && m && m.text != null) { this.sha[path] = m.sha; return JSON.parse(m.text); }
    if (r.status === 404) { delete this.sha[path]; if (!m || m.text != null) this.changed = (this.changed || 0) + 1; this.docs[path] = { etag: '', sha: null, text: null }; saveDocs(); return null; }
    if (!r.ok) throw this.fail(r);
    const j = await r.json();
    this.sha[path] = j.sha;
    const text = b64dec(j.content || '');
    if (!m || m.text !== text) this.changed = (this.changed || 0) + 1;
    this.docs[path] = { etag: r.headers.get('ETag') || '', sha: j.sha, text };
    saveDocs();
    return JSON.parse(text);
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
  async blob(path, type) {
    let r;
    try { r = await fetch('https://api.github.com' + this.url(path), { headers: { 'Authorization': 'Bearer ' + this.cred.token, 'Accept': 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28' } }); }
    catch (_) { const e = new Error('offline'); e.code = 'offline'; throw e; }
    if (!r.ok) throw this.fail(r);
    const b = await r.blob();
    return URL.createObjectURL(type ? new Blob([b], { type }) : b);
  },
  base() { return `/repos/${encodeURIComponent(this.cred.owner)}/${encodeURIComponent(this.cred.repo)}`; },
  baseOf(repo) { return `/repos/${encodeURIComponent(this.cred.owner)}/${encodeURIComponent(repo)}`; },
  async branchOf(repo) {
    this.branches = this.branches || {};
    if (this.branches[repo]) return this.branches[repo];
    const r = await this.req('GET', this.baseOf(repo)); if (!r.ok) throw this.fail(r);
    return (this.branches[repo] = (await r.json()).default_branch || 'main');
  },
  async rawIn(repo, path) {
    let r;
    try { r = await fetch('https://api.github.com' + this.baseOf(repo) + '/contents/' + path.split('/').map(encodeURIComponent).join('/'), { headers: { 'Authorization': 'Bearer ' + this.cred.token, 'Accept': 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28' } }); }
    catch (_) { const e = new Error('offline'); e.code = 'offline'; throw e; }
    if (!r.ok) throw this.fail(r);
    return await r.blob();
  },
  async putIn(repo, path, b64, message) {
    const r = await this.req('PUT', this.baseOf(repo) + '/contents/' + path.split('/').map(encodeURIComponent).join('/'), { message, content: b64 });
    if (!r.ok) throw this.fail(r);
  },
  async info() {
    const r = await this.req('GET', this.base());
    if (!r.ok) throw this.fail(r);
    const j = await r.json();
    this.branch = j.default_branch || 'main';
    return j;
  },
  // Несколько файлов одной фиксацией: blobs → tree → commit → ref (без force; при гонке — заново от свежей головы).
  // отправка с прогрессом по байтам (fetch этого не умеет)
  xhr(method, path, body, onUp) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open(method, 'https://api.github.com' + path);
      x.setRequestHeader('Authorization', 'Bearer ' + this.cred.token);
      x.setRequestHeader('Accept', 'application/vnd.github+json');
      x.setRequestHeader('X-GitHub-Api-Version', '2022-11-28');
      x.setRequestHeader('Content-Type', 'application/json');
      if (onUp && x.upload) x.upload.onprogress = e => { if (e.lengthComputable) onUp(e.loaded, e.total); };
      x.onload = () => res({ ok: x.status >= 200 && x.status < 300, status: x.status, json: async () => JSON.parse(x.responseText || '{}') });
      x.onerror = () => { const e = new Error('offline'); e.code = 'offline'; rej(e); };
      x.send(JSON.stringify(body));
    });
  },
  async commitFiles(files, message, progress, repo) {
    const base = repo ? this.baseOf(repo) : this.base();
    if (!repo && !this.branch) await this.info();
    const branch = repo ? await this.branchOf(repo) : this.branch;
    const shas = [], tot = files.reduce((a, f) => a + f.b64.length, 0) || 1;
    let doneB = 0;
    for (let i = 0; i < files.length; i++) {
      if (progress) progress(i + 1, files.length, doneB, tot);
      const len = files[i].b64.length;
      // связь на телефоне рвётся (лифт, свернул приложение) — файл пробуем ещё раз, а не начинаем всё заново
      let r = null;
      for (let att = 0; att < 4; att++) {
        if (att) { await waitVisible(); await sleepMs(1500 * att); }
        try {
          r = progress
            ? await this.xhr('POST', base + '/git/blobs', { content: files[i].b64, encoding: 'base64' }, (l, t) => progress(i + 1, files.length, doneB + len * Math.min(1, l / Math.max(1, t)), tot))
            : await this.req('POST', base + '/git/blobs', { content: files[i].b64, encoding: 'base64' });
          if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429)) break;
        } catch (e) { r = null; if (att === 3) throw e; }
      }
      doneB += len;
      if (!r || !r.ok) throw r ? this.fail(r) : Object.assign(new Error('offline'), { code: 'offline' });
      shas.push((await r.json()).sha);
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      let r = await this.req('GET', base + '/git/ref/heads/' + encodeURIComponent(branch));
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
      r = await this.req('PATCH', base + '/git/refs/heads/' + encodeURIComponent(branch), { sha: commit, force: false });
      if (r.ok) { if (!repo) files.forEach(f => { delete this.sha[f.path]; }); return commit; }
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
        try { await this.putRaw(path, b64enc(JSON.stringify(next, null, 2) + '\n'), message, this.sha[path]); this.docs[path] = { etag: '', sha: this.sha[path], text: JSON.stringify(next) }; saveDocs(); return next; }
        catch (e) { if (e.code === 'conflict' && attempt < 2) continue; throw e; }
      }
    });
    this.q[path] = run.catch(() => {});
    return run;
  }
};
let docsT = null;
function saveDocs() { clearTimeout(docsT); docsT = setTimeout(() => LS.set('bj-docs', GH.docs), 400); }
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
  ideas: [], sleep: { days: {} }, curriculum: { blocks: [] }, ex: { cats: [], items: [], complexes: [] }, exCat: 'all', exQ: '', media: {}, notes: null, notesErr: null, notesLoading: false, noteCache: {},
  openCur: new Set(), touchedCur: new Set(), showAllDone: false,
  english: { cards: {}, sessions: [] }, benefits: { items: {} }, books: { books: [], progress: {}, listen: {} }, shop: LS.get('bj-shop') || { items: [] },
  money: {}, workouts: {}, fresh: new Set(), dirty: new Set(), tab: 'plan', open: new Set(), reviews: [], rev: null, portfolio: null, notesDays: LS.get('bj-notes-days'), duties: {}, absences: [], studyLog: [], body: { weight: {} }, quarters: {}, inbox: [], period: null, periodP: null, calMonth: monthKey(today()), foodDate: today(), img: {},
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
  const rest = list.filter(a => a.type !== 'card' && !(demo() && a.type === 'debt'));
  const hero = av.cards.length ? `<button type="button" class="m-hero" data-action="acct-cards"><span class="h-k">Доступно на картах</span><span class="h-v">${full ? fmt(Math.round(av.sum + av.delta)) + `<small>${esc(cur)}</small>` : '—'}</span><span class="h-s">${full ? esc(av.known.map(a => bankName(a.bank) || a.name).join(' + ')) + (av.n ? ` · с учётом ${av.n} ${plural(av.n, 'записи', 'записей', 'записей')}` : '') : 'нажми и впиши остатки'}</span></button>` : '';
  const chips = `<div class="acc-chips">${rest.map(a => `<button type="button" class="acc-chip ${a.type}${a.type === 'debt' && !(Number(a.balance) > 0) ? ' zero' : ''}" data-action="acct" data-id="${esc(a.id)}"><span>${esc(a.name)}</span><b>${a.balance == null || a.balance === '' ? '?' : (a.type === 'debt' && Number(a.balance) > 0 ? '−' : '') + fmt(Math.round(a.balance))}</b></button>`).join('')}<button type="button" class="acc-chip add" data-action="acct-new" aria-label="${demo() ? 'Добавить карту или накопление' : 'Добавить карту, накопление или долг'}">+</button></div>`;
  return hero + chips;
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
// Числа, которые не суммы: «180 г», «0,5 л», «4 пачки», «по 180», «2 пива» (рядом с настоящей суммой) — остаются в названии.
// Прячем их цифры (полноширинные цифры не попадают в \d), после разбора возвращаем обычные.
const FW0 = 0xFF10;
const fwHide = s => s.replace(/\d/g, d => String.fromCharCode(FW0 + Number(d)));
const fwShow = s => String(s).replace(/[\uFF10-\uFF19]/g, c => String(c.charCodeAt(0) - FW0));
const UNIT_RE = /(\d+(?:[.,]\d+)?)(\s*(?:кг|гр|грамм[а-яё]*|г|мл|литр[а-яё]*|л|шт[а-яё.]*|штук[а-яё]*|пач[а-яё]*|бут[а-яё]*|бан[а-яё]*|упак[а-яё]*|уп|пак[а-яё]*)(?![а-яёa-z]))/gi;
const PO_RE = /((?:^|[^а-яёa-z])по\s+)(\d+(?:[.,]\d+)?)(?!\s*(?:к|k|тыс\.?)?\s*(?:руб|р\.|₽|р(?![а-яё])))/gi;
const COUNT_RE = /(^|[^\d.,])([1-9])(\s+(?!руб|р\.|р(?![а-яё])|к(?![а-яё])|тыс)[а-яё]{2,})/gi;
function spendProtect(t) {
  let s = t.replace(UNIT_RE, (m, n, u) => fwHide(n) + u).replace(PO_RE, (m, a, n) => a + fwHide(n));
  // «2 пива», «4 пачки» — счёт штук, если в тексте есть и настоящая сумма (≥ 10)
  if (/\d{2,}/.test(t)) s = s.replace(COUNT_RE, (m, a, n, w) => a + fwHide(n) + w);
  return s;
}
function parseSpend(text) {
  const r = parseSpendRaw(spendProtect(String(text || '')));
  r.items.forEach(x => { x.name = fwShow(x.name); });
  r.bad = r.bad.map(fwShow);
  return r;
}
function parseSpendRaw(text) {
  const items = [], bad = [];
  const src = String(text || '').replace(/(\d)\s(?=\d{3}(?!\d))/g, '$1');
  const chunks = src.split(/\n|;|,(?=\s*[^\d\uFF10-\uFF19\s])/).map(s => s.trim()).filter(Boolean);
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
const IDEA_TITLE = 'Идея'; // issue из «Поделиться» → GitHub Actions в journal-data делает из него идею и качает видео
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
    <h3 class="sec" id="share-setup">5. Видео из Instagram — через «Поделиться»</h3>
    <ol class="ing">
      <li>Нужен ключ из п. 1 (<span class="mono">journal-shortcut</span>, только Issues). Нет ключа — сделай: ${copyRow('Ссылка', 'https://github.com/settings/personal-access-tokens/new', 'github.com → новый ключ')}</li>
      <li>Команды → <b>+</b> вверху справа. Нажми на название вверху → «Переименовать» → <b>Claude</b>.</li>
      <li>Внизу ⓘ → включи «Показывать в меню „Поделиться“» → Готово. Вверху появится «Получать … из Поделиться»: нажми на первое синее слово → оставь <b>URL</b> и <b>Текст</b>.</li>
      <li>Поиск действий внизу → <b>Получить содержимое URL</b>. Нажми синее «URL» и вставь: ${copyRow('URL', url)}</li>
      <li>Нажми стрелку › у действия: Метод — <b>POST</b>. Заголовки → «Добавить новый заголовок»: ${copyRow('Authorization', 'Bearer ', 'Bearer ␣ + ключ')}${copyRow('Accept', 'application/vnd.github+json')}</li>
      <li>«Текст запроса» — <b>JSON</b> → «Добавить новое поле» → Текст: ${copyRow('title', IDEA_TITLE)} Ещё поле → Текст: ключ <b>body</b>, значение — нажми и выбери переменную <b>Входные данные команды</b>.</li>
      <li>Пользоваться: в Instagram у рилса — самолётик → «Поделиться в…» / «Ещё» → <b>Claude</b>. Через 1–2 минуты кадры, подпись и речь будут в «Связи с Claude».</li>
    </ol>
    <p class="note">Ключ в Команде — только на Issues: к файлам журнала у неё доступа нет. Команду никому не пересылай.</p>
    ${(() => { const c = (S.config || {}).claude || {}; if (!c.fireUrl) return ''; return `<h3 class="sec" id="claude-now-setup">6. «Разобрать сейчас» — позвать Claude без расписания</h3>
    <ol class="ing">
      <li>В Safari: ${copyRow('Ссылка', 'https://claude.ai/code/routines', 'claude.ai/code/routines')} → «${esc(c.routine || 'Журнал: входящие')}» → ⋯ → <b>Edit</b> → <b>Add another trigger</b> → <b>API</b> → Save → <b>Generate token</b>. Скопируй токен — он показывается один раз.</li>
      <li>Команды → <b>+</b> → назови ${copyRow('Имя', c.shortcut || 'Claude разбор')}</li>
      <li>Действие «Получить содержимое URL»: ${copyRow('URL', c.fireUrl)} Метод <b>POST</b>. Заголовки: ${copyRow('Authorization', 'Bearer ', 'Bearer ␣ + токен из п. 1')}${copyRow('anthropic-beta', 'experimental-cc-routine-2026-04-01')}${copyRow('anthropic-version', '2023-06-01')} Тело запроса — <b>JSON</b>, поле Текст: ${copyRow('text', 'Запуск с телефона')}</li>
      <li>Готово. Кнопка «⚡ Разобрать сейчас» в «Связи с Claude» запускает эту Команду; через 2–5 минут ответы появятся в чате.</li>
    </ol>
    <p class="note">Токен умеет только запускать эту задачу — больше ничего. Если утечёт: там же Regenerate. Запуск по кнопке тратит лимит подписки так же, как обычный разговор.</p>`; })()}
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
  for (const mk of periodMonths(start)) { const d = S.money[mk]; if (d && Array.isArray(d.items)) out = out.concat(d.items.filter(x => x.date >= start && x.date <= end && !demoBad((x.cat || '') + ' ' + x.name))); }
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
  if (d.plan) { S.studyDays = d.plan.studyDays || {}; S.sportMoves = d.plan.sportMoves || {}; S.sportExtra = Array.isArray(d.plan.sportExtra) ? d.plan.sportExtra : []; S.duties = d.plan.duties || {}; S.absences = Array.isArray(d.plan.absences) ? d.plan.absences : []; S.studyLog = Array.isArray(d.plan.studyLog) ? d.plan.studyLog : []; S.dayOrder = d.plan.dayOrder || {}; }
  if (d.body) S.body = d.body && d.body.weight ? d.body : { weight: {} };
  if (d.quarters) S.quarters = d.quarters;
  if (d.english) S.english = d.english;
  if (d.benefits) S.benefits = d.benefits;
  if (d.shop && !S.shopBusy) { S.shop = d.shop; LS.set('bj-shop', S.shop); }
  if (d.books) S.books = d.books;
  if (d.exercises) S.ex = d.exercises && Array.isArray(d.exercises.items) ? d.exercises : { cats: [], items: [], complexes: [] };
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
  LS.set('bj-cache', { config: S.config, lessons: { lessons: S.lessons }, plan: { studyDays: S.studyDays, sportMoves: S.sportMoves, sportExtra: S.sportExtra, duties: S.duties, absences: S.absences, studyLog: S.studyLog, dayOrder: S.dayOrder }, body: S.body, quarters: S.quarters, english: S.english, benefits: S.benefits, shop: S.shop, books: S.books, exercises: S.ex, learned: { map: S.learned }, events: { events: S.events }, recipes: { recipes: S.recipes }, meals: S.meals, requests: { requests: S.requests }, ideas: { ideas: S.ideas }, reviews: { reviews: S.reviews }, portfolio: S.portfolio, sleep: S.sleep, curriculum: S.curriculum, money: S.money, workouts: S.workouts, inbox: S.inbox, ts: S.lastLoad });
}
async function fetchMonths(prefix, keys, empty) {
  const res = await Promise.all(keys.map(k => readDoc(prefix + k + '.json')));
  const out = {};
  keys.forEach((k, i) => { out[k] = res[i] || clone(empty); });
  return out;
}
async function loadAll(quiet) {
  if (S.loading || !GH.cred) return;
  S.loading = true; $('#btn-refresh').classList.add('busy');
  if (!quiet) setSync('обновляю…');
  S.skipRender = false;
  try {
    if (queueCount()) await flushQueue();
    GH.changed = 0;
    GH.info().then(j => { if (j && j.private === false) { toast('Внимание: репозиторий с данными стал открытым! Сделай его приватным.'); setSync('Репозиторий с данными открытый — сделай приватным', true); } }).catch(() => {});
    const [config, lessons, plan, learned, events, inbox, recipes, meals, requests, ideas, sleep, curriculum, reviews, portfolio, body, qgoals, english, benefits, shop, booksDoc, exDoc] = await Promise.all([
      readDoc('config.json'), readDoc('lessons.json'), readDoc('plan.json'), readDoc('learned.json'), readDoc('events.json'), Promise.all([GH.list('inbox/photos'), GH.list('inbox/receipts')]).then(([a, b]) => a.concat(b)),
      readDoc('recipes.json'), readDoc('meals.json'), readDoc('requests.json'), readDoc('ideas.json'), readDoc('sleep.json'), readDoc('curriculum.json'), readDoc('reviews.json'), readDoc('portfolio.json'), readDoc('body.json'), readDoc('goals.json'), readDoc('english.json'), readDoc('benefits.json'), readDoc('shop.json'), readDoc('books.json'), readDoc('exercises.json')
    ]);
    const inboxNames = inbox.filter(f => f.type === 'file' && !/^\./.test(f.name)).map(f => f.name);
    const quietSame = S.ready && !GH.changed && !queueCount() && inboxNames.join('|') === (S.inbox || []).join('|');
    if (!quietSame) applyData({ config, lessons: lessons || { lessons: [] }, plan: plan || {}, learned: learned || {}, events: events || { events: [] }, recipes: recipes || { recipes: [] }, meals: meals || { days: {} }, requests: requests || { requests: [] }, ideas: ideas || { ideas: [] }, sleep: sleep || { days: {} }, curriculum: curriculum || { blocks: [] }, reviews: reviews || { reviews: [] }, portfolio: portfolio || { projects: [], artifacts: [] }, body: body || { weight: {} }, quarters: (qgoals && qgoals.quarters) || {}, english: english || { cards: {}, sessions: [] }, benefits: benefits || { items: {} }, shop: shop || { items: [] }, books: booksDoc || { books: [], progress: {}, listen: {} }, exercises: exDoc || { cats: [], items: [], complexes: [] }, inbox: inbox.filter(f => f.type === 'file' && !/^\./.test(f.name)).map(f => f.name) });
    ensurePeriod();
    const mks = Array.from(new Set(periodMonths(S.period).concat([monthKey(today())])));
    const wks = [monthKey(today()), monthShift(monthKey(today()), -1)];
    const [money, workouts] = await Promise.all([fetchMonths('money/', mks, { items: [] }), fetchMonths('workouts/', wks, { logs: {} })]);
    S.fresh = new Set(mks.map(k => 'money/' + k).concat(wks.map(k => 'workouts/' + k)));
    if (!quietSame || GH.changed) applyData({ money, workouts });
    S.skipRender = quietSame && !GH.changed;
    S.ready = true; S.lastLoad = Date.now();
    cacheNow();
    setSync(queueNote() || syncLabel());
    if (!$('#tab-lessons').hidden) { S.notes = S.notes || null; loadNotes(true); }
    processQuick();
    checkNotesPushed();
    loadNotesDays();
    setTimeout(announceAchievements, 300);
  } catch (e) {
    if (e.code !== 'offline') console.warn(e);
    if (e.code === 'auth') showSetup('Ключ не подошёл или истёк. Вставь новый.');
    setSync(e.code === 'offline' && queueCount() ? queueNote() : errText(e), e.code !== 'offline');
  } finally {
    S.loading = false; $('#btn-refresh').classList.remove('busy');
    if (!S.skipRender) render(); else { renderClaudeBtn(); renderDayChip(); }
    S.skipRender = false;
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

/* ---------- офлайн: очередь записей и слияние ---------- */
// Без сети запись применяется к сохранённой копии файла и ждёт в очереди.
// При появлении сети изменения накладываются на свежую версию с GitHub (трёхстороннее слияние: база → моё → их).
const OQ = { get() { return LS.get('bj-queue') || {}; }, set(q) { if (Object.keys(q).length) LS.set('bj-queue', q); else LS.del('bj-queue'); } };
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keyOf = x => isObj(x) && x.id != null ? 'id:' + x.id : 'j:' + JSON.stringify(x);
function merge3(base, local, remote) {
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;
  if (isObj(base) && isObj(local) && isObj(remote)) {
    const out = {};
    for (const k of new Set(Object.keys(remote).concat(Object.keys(local), Object.keys(base)))) {
      const v = merge3(base[k], local[k], remote[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (Array.isArray(local) && Array.isArray(remote)) {
    const b = Array.isArray(base) ? base : [];
    const bm = new Map(b.map(x => [keyOf(x), x])), lm = new Map(local.map(x => [keyOf(x), x])), rk = new Set(remote.map(keyOf));
    const out = [];
    for (const x of remote) {
      const k = keyOf(x);
      if (bm.has(k) && !lm.has(k)) { if (!same(bm.get(k), x)) out.push(x); continue; }
      out.push(lm.has(k) && bm.has(k) ? merge3(bm.get(k), lm.get(k), x) : lm.has(k) ? lm.get(k) : x);
    }
    for (const x of local) { const k = keyOf(x); if (!rk.has(k) && !bm.has(k)) out.push(x); }
    return out;
  }
  return local;
}
function queueCount() { const q = OQ.get(); return Object.values(q).reduce((a, e) => a + (e.n || 1), 0); }
function queueNote() { const n = queueCount(); return n ? `${S.offline ? 'без сети · ' : ''}${n} ${plural(n, 'изменение ждёт', 'изменения ждут', 'изменений ждут')} отправки` : ''; }
function kickFlush(ms) { clearTimeout(S.flushT); S.flushT = setTimeout(runFlush, ms == null ? 250 : ms); }
async function runFlush() {
  if (S.flushing) { S.flushAgain = true; return; }
  const ok = await flushQueue();
  if (ok && (S.flushAgain || queueCount())) { S.flushAgain = false; return kickFlush(50); }
  S.flushAgain = false;
  if (!queueCount()) setSync('сохранено в ' + hhmm(new Date()));
  else setSync(queueNote(), !S.offline);
}
function writeLocal(path, fn, msg, empty) {
  const q = OQ.get(), m = GH.docs[path];
  if (!q[path] && !m) return null;
  const baseText = q[path] ? q[path].base : (m.text != null ? m.text : JSON.stringify(empty || {}));
  const cur = JSON.parse(q[path] ? q[path].local : baseText);
  const next = fn(cur);
  if (next === undefined) return cur;
  q[path] = { base: baseText, local: JSON.stringify(next), msg: q[path] ? q[path].msg : msg, n: ((q[path] || {}).n || 0) + 1, empty: empty || {} };
  OQ.set(q);
  return next;
}
async function flushQueue() {
  const q = OQ.get(), paths = Object.keys(q);
  if (!paths.length || S.flushing || !GH.cred) return true;
  S.flushing = true; let ok = true;
  for (const p of paths) {
    const e = q[p];
    try {
      const base = JSON.parse(e.base), local = JSON.parse(e.local);
      await GH.mutate(p, remote => merge3(base, local, remote), (e.msg || 'Запись') + (e.n > 1 ? ` (+${e.n - 1})` : '') + (e.off ? ' (без сети)' : ''), e.empty);
      if (S.offline) { S.offline = false; }
      const q2 = OQ.get();
      if (q2[p] && q2[p].local === e.local) delete q2[p]; else if (q2[p]) { q2[p].base = e.local; q2[p].n = Math.max(1, (q2[p].n || 1) - (e.n || 1)); }
      OQ.set(q2);
    } catch (err) {
      ok = false;
      if (err.code === 'offline') {
        if (!S.offline) toast('Нет сети — сохранил на телефоне, отправлю при связи');
        S.offline = true;
        const q3 = OQ.get(); Object.values(q3).forEach(x => { x.off = true; }); OQ.set(q3);
        break;
      }
      console.warn(err);
      if (err.code === 'auth') { showSetup('Ключ не подошёл или истёк. Вставь новый.'); break; }
      if (!S.flushErrShown) { S.flushErrShown = true; toast('Не отправилось: ' + errText(err) + ' Повторю позже.'); setTimeout(() => { S.flushErrShown = false; }, 60000); }
    }
  }
  S.flushing = false;
  return ok;
}
// Чтение для экрана: свежая версия с GitHub плюс свои ещё не отправленные изменения.
async function readDoc(path) {
  const remote = await GH.getJSON(path), e = OQ.get()[path];
  if (!e) return remote;
  return merge3(JSON.parse(e.base), JSON.parse(e.local), remote == null ? clone(e.empty || {}) : remote);
}

/* ---------- writes ---------- */
// Запись сразу применяется к копии файла на телефоне (экран обновляется без ожидания),
// а на GitHub уходит в фоне — с тем же слиянием, что и офлайн-очередь.
async function write(path, fn, msg, empty) {
  if (GH.docs[path] || OQ.get()[path]) {
    const nx = writeLocal(path, fn, msg, empty);
    if (nx) { setSync(S.offline ? queueNote() : 'сохраняю…'); kickFlush(); return nx; }
  }
  S.pending++; setSync('сохраняю…');
  try {
    const next = await GH.mutate(path, fn, msg, empty);
    S.pending--;
    setSync(S.pending ? 'сохраняю…' : 'сохранено в ' + hhmm(new Date()));
    if (!S.pending && queueCount()) flushQueue().then(() => setSync(queueNote() || syncLabel()));
    return next || true;
  } catch (e) {
    S.pending--;
    if (e.code === 'offline') {
      const nx = writeLocal(path, fn, msg, empty);
      if (nx) { setSync(queueNote()); toast('Нет сети — сохранил на телефоне, отправлю при связи'); return nx; }
    }
    console.warn(e);
    if (e.code === 'auth') showSetup('Ключ не подошёл или истёк. Вставь новый.');
    setSync(errText(e), true);
    toast('Не сохранилось. ' + errText(e));
    return null;
  }
}
async function writePlan(fn, msg) {
  const next = await write('plan.json', p => { p.studyDays = p.studyDays || {}; p.sportMoves = p.sportMoves || {}; p.sportExtra = Array.isArray(p.sportExtra) ? p.sportExtra : []; fn(p); return p; }, msg, { studyDays: {}, sportMoves: {}, sportExtra: [] });
  if (next) { S.studyDays = next.studyDays; S.sportMoves = next.sportMoves; S.sportExtra = next.sportExtra || []; S.duties = next.duties || {}; S.absences = next.absences || []; S.studyLog = next.studyLog || []; S.dayOrder = next.dayOrder || {}; cacheNow(); render(); }
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
function stampMeal(day, meal) { day.t = day.t && typeof day.t === 'object' ? day.t : {}; day.t[meal] = hhmm(new Date()); }
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
// Окна учёбы меняются, а прошлое — нет: study.slotHistory = [{until: "ГГГГ-ММ-ДД", slots}] — какие окна были по эту дату включительно.
function slotsOn(d) {
  const st = S.config.study || {}, h = Array.isArray(st.slotHistory) ? st.slotHistory.slice().sort((a, b) => a.until < b.until ? -1 : 1) : [];
  const old = h.find(x => d <= x.until);
  return old ? old.slots : st.slots;
}
function studyCap(d, days) {
  days = days || S.studyDays;
  const st = S.config.study || {};
  const base = Number((slotsOn(d) || {})[String(dow(d))] || 0);
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
function studyUsedToday(cap) {
  const t = today(); let used = 0;
  for (const l of S.lessons) {
    if (l.done === t) used += Number(l.need) || cap;
    else if (Array.isArray(l.progressDates) && l.progressDates.includes(t)) used += cap;
  }
  return used;
}
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
    // сегодняшнее окно уже занято уроком, который отмечен сегодня, — следующий урок не ставим поверх
    const cap = d === t ? c.cap - studyUsedToday(c.cap) : c.cap;
    if (cap <= 0) continue;
    if (!pending.length) { pending.push({ key: 'ph' + nextN, placeholder: true, n: nextN, title: '', need: null, rem: 0, parts: 0 }); nextN++; }
    const L = pending[0];
    L.parts++;
    const e = { date: d, L, cap, part: L.parts, extra: !!c.extra, last: false };
    if (L.need == null) { e.last = true; pending.shift(); }
    else { L.rem -= cap; if (L.rem <= 0) { e.last = true; pending.shift(); } }
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
// template: {dow, key, alt?: [ключ А, ключ Б]} — варианты по очереди, неделя старта программы = первый
function altKey(tp, w, cfg) {
  if (!Array.isArray(tp.alt) || tp.alt.length < 2) return tp.key;
  const n = tp.alt.length, wi = Math.round(daysBetween(mondayOf(cfg.start), w) / 7);
  return tp.alt[((wi % n) + n) % n];
}
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
      const key = altKey(tp, w, cfg);
      const s = (cfg.sessions || {})[key];
      if (!s) continue;
      const id = orig + '_' + key;
      const ov = S.sportMoves[id] || {};
      const inst = { id, key, orig, eff: ov.movedTo || orig, state: ov.state || null, note: ov.note || '', kind: s.kind, title: s.title || key, sub: s.sub || '', ov };
      if (ov.as && cfg.sessions[ov.as]) { inst.title = cfg.sessions[ov.as].title; inst.sub = 'вместо: ' + (s.title || key); inst.replaced = true; }
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
// «Чистые» дни (config.restDays, номера дней JS: 6 = суббота): без учёбы и спорта, автопереносы туда не ставятся.
// Перенести вручную на конкретную дату по-прежнему можно.
function restDay(d) { const r = (S.config || {}).restDays; return Array.isArray(r) && r.map(Number).includes(dow(d)); }
function planMove(inst, target) {
  const list = S.sportList, t = today();
  const occ = (d, excl, virt) => list.filter(i => i.eff === d && i.state !== 'skipped' && !excl.includes(i.id)).concat(virt.filter(v => v.eff === d));
  const weekEnd = i => addDays(mondayOf(i.orig), 6);
  const find = (i, from, excl, virt) => {
    for (let d = from, k = 0; k < 14; d = addDays(d, 1), k++) {
      if (i.kind !== 'strength' && d > weekEnd(i)) return null;
      if (dutyOn(d) || restDay(d)) continue;
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
      if (!L || !(L.date < before)) continue;
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
const nowT = () => { const d = new Date(); return hhmm(d) + ':' + pad(d.getSeconds()); };
// шаг веса по истории упражнения: самая маленькая разница между весами, от 1 до 5 кг (по умолчанию 2,5; гантели — 2)
function wStep(name) {
  const ws = new Set();
  for (const mk of Object.keys(S.workouts)) for (const L of Object.values((S.workouts[mk] || {}).logs || {})) for (const b of (L && L.blocks) || []) for (const x of b.ex || []) {
    if (x.name !== name || !Array.isArray(x.sets)) continue;
    x.sets.forEach(s => { if (s && s.w > 0) ws.add(Number(s.w)); (s && s.drops || []).forEach(d => { if (d && d.w > 0) ws.add(Number(d.w)); }); });
  }
  const v = Array.from(ws).sort((a, b) => a - b); let m = Infinity;
  for (let k = 1; k < v.length; k++) m = Math.min(m, Math.round((v[k] - v[k - 1]) * 100) / 100);
  // гантели у Олега идут через 2 кг (20, 22, 24…)
  if (/гантел/i.test(name)) return 2;
  return isFinite(m) && m > 0 ? Math.max(1, Math.min(5, m)) : 2.5;
}
function wkSrc(i) {
  const log = logFor(i), draft = LS.get('bj-draft-' + i.id);
  return { log, draft, src: (draft && draft.blocks) || (log && log.blocks) || null };
}
const exKey = (bi, ei) => bi + '-' + ei;
function exRows(c, x, b, bi, ei, v) {
  return Math.max(exSets(x, b), (v && Array.isArray(v.sets) ? v.sets.length : 0), (c.rows || {})[exKey(bi, ei)] || 0);
}
function stepper(id, val, ph, mode, label, k, f) {
  return `<span class="stp"><button type="button" class="sb" data-action="stp" data-k="${k}" data-f="${f}" data-d="-1" aria-label="${esc(label)}: меньше">−</button><input id="${id}" inputmode="${mode}" value="${esc(val)}" placeholder="${esc(ph)}" aria-label="${esc(label)}"><button type="button" class="sb" data-action="stp" data-k="${k}" data-f="${f}" data-d="1" aria-label="${esc(label)}: больше">+</button></span>`;
}
// порядок упражнений в тренировке: по программе или как Олег перетащил (черновик — в браузере, после сохранения — order в логе)
function wkOrder(i, ses) {
  const n = ses.blocks.length, ok = a => Array.isArray(a) && a.length === n && new Set(a).size === n && a.every(x => Number.isInteger(x) && x >= 0 && x < n);
  const ls = LS.get('bj-wkord-' + i.id), log = logFor(i);
  if (ok(ls)) return ls.slice();
  if (log && ok(log.order)) return log.order.slice();
  return ses.blocks.map((_, k) => k);
}
// подсказка у тренажёра: с чего начинал в прошлый раз (первый подход) и как шли остальные
function prevHint(x, before) {
  if (x.log !== 'wr' && x.log !== 'r') return '';
  const p = prevSets(null, x.name, before); if (!p) return '';
  const n = v => String(v).replace('.', ',');
  const one = s => s.w != null ? n(s.w) + (s.r != null ? ' × ' + s.r : ' кг') : (s.r != null ? s.r + ' повт' : '');
  const list = p.sets.filter(s => s && (s.w != null || s.r != null));
  if (!list.length) return '';
  const first = list[0], rest = list.slice(1).map(one);
  return `<span class="ex-prev">Прошлый раз, ${esc(dm(p.date))}: начал с <b>${esc(x.log === 'wr' && first.w != null ? n(first.w) + ' кг' : one(first))}</b>${x.log === 'wr' && first.w != null && first.r != null ? ' × ' + first.r : ''}${rest.length ? ' · дальше ' + esc(rest.join(', ')) : ''}</span>`;
}
function workoutForm(i, ses) {
  const c = S.cur && S.cur.type === 'sport' && S.cur.id === i.id ? S.cur : { rows: {}, times: {} };
  c.rows = c.rows || {}; c.times = c.times || {};
  const { log, draft, src } = wkSrc(i);
  const val = (bi, ei) => (src && src[bi] && src[bi].ex && src[bi].ex[ei]) || null;
  // время подходов из сохранённого
  if (src) src.forEach((b, bi) => (b.ex || []).forEach((x, ei) => (x.sets || []).forEach((s, r) => { const k = bi + '-' + ei + '-' + (r + 1); if (s && s.t && !c.times[k]) c.times[k] = s.t; })));
  let prevDate = null;
  const anyOpen = ses.blocks.some((b, bi) => S.open.has('wk-' + i.id + '-' + bi));
  let firstOpen = -1;
  const ord = wkOrder(i, ses), moved = ord.some((x, k) => x !== k);
  const html = ord.map((bi, pos) => {
    const b = ses.blocks[bi];
    const ex = b.ex || [];
    const wrAll = ex.map((x, ei) => ({ x, ei, n: 0 })).filter(o => o.x.log === 'wr' || o.x.log === 'r');
    wrAll.forEach(o => { o.n = exRows(c, o.x, b, bi, o.ei, val(bi, o.ei)); });
    // в суперсете первым идёт упражнение, где подходов больше
    const order = ex.map((x, ei) => ({ x, ei, n: (wrAll.find(o => o.ei === ei) || {}).n || 0, ps: (x.log === 'wr' || x.log === 'r') ? exSets(x, b) : 0 })).sort((a, z) => z.ps - a.ps || a.ei - z.ei);
    const multi = ex.length > 1;
    const letter = new Map(order.map((o, k) => [o.ei, multi ? LET[k] : '']));
    const names = order.map(({ x, ei }) => `<div class="exl"><span class="let">${letter.get(ei)}</span><span class="rb"><span class="ex-name">${esc(x.name)}${x.swapped ? ' <span class="chip warn">замена</span>' : ''}</span>${x.hint ? `<span class="ex-hint">${esc(x.hint)}</span>` : ''}${prevHint(x, i.eff)}${x.swapped && x.orig ? `<span class="ex-hint">по программе: ${esc(x.orig)}</span>` : ''}${(x.log === 'wr' || x.log === 'r') ? `<span class="ex-hint">${(wrAll.find(o => o.ei === ei) || {}).n} ${plural((wrAll.find(o => o.ei === ei) || {}).n, 'подход', 'подхода', 'подходов')}</span>` : ''}</span><span class="ex-acts">${exFind(x.name) ? `<button type="button" class="icon-btn sm ex-tech" data-action="ex-open" data-id="${esc(exFind(x.name).id)}" data-from="sport:${esc(i.id)}" aria-label="Техника: ${esc(x.name)}">${ico('play')}</button>` : ''}${ses.replaced === 'custom' ? '' : `<button type="button" class="icon-btn sm" data-action="ex-swap" data-b="${bi}" data-e="${ei}" aria-label="Заменить упражнение">⇄</button>`}</span></div>
      <div class="swap-form" id="swf-${bi}-${ei}" hidden><input id="swi-${bi}-${ei}" list="ex-dl" placeholder="Чем заменить (подсказки — из базы)" value="${esc(x.swapped ? x.name : '')}"><div class="two"><button type="button" class="btn sm" data-action="ex-swap-once" data-b="${bi}" data-e="${ei}">Только в этот раз</button><button type="button" class="btn sm" data-action="ex-swap-perm" data-b="${bi}" data-e="${ei}">В программе навсегда</button></div>${x.swapped ? `<button type="button" class="btn sm" data-action="ex-unswap" data-b="${bi}" data-e="${ei}">Вернуть по программе</button>` : ''}</div>`).join('');
    let body = '', filled = 0, total = 0;
    const wr = order.filter(o => o.x.log === 'wr' || o.x.log === 'r');
    if (wr.length) {
      const rounds = Math.max(...wr.map(o => o.n));
      for (let r = 1; r <= rounds; r++) {
        const inR = wr.filter(o => r <= o.n);
        body += '<div class="round">' + inR.map(o => {
          const v = val(bi, o.ei), s = (v && v.sets && v.sets[r - 1]) || {};
          const p = prevSets(ses.key, o.x.name, i.eff);
          if (p && (!prevDate || p.date > prevDate)) prevDate = p.date;
          const ps = (p && p.sets[r - 1]) || {};
          const k = bi + '-' + o.ei + '-' + r, lab = r + letter.get(o.ei), nm = o.x.name + ', подход ' + r;
          total++; if (s.w != null || s.r != null) filled++;
          const rIn = stepper(`lg-${k}-r`, s.r != null ? s.r : '', ps.r != null ? ps.r : 'повт', 'numeric', nm + ', повторы', k, 'r');
          let row;
          if (o.x.log === 'r') row = `<div class="set r" data-k="${k}"><span class="sl">${lab}</span>${rIn}<span class="u">повт</span></div>`;
          else row = `<div class="set" data-k="${k}"><span class="sl">${lab}</span>${stepper(`lg-${k}-w`, s.w != null ? s.w : '', ps.w != null ? ps.w : 'кг', 'decimal', nm + ', вес', k, 'w')}<span class="u">×</span>${rIn}<button type="button" class="sb drop" data-action="drop-add" data-k="${k}" aria-label="Добавить дроп-сет" title="Дроп-сет">↓<small>дроп</small></button></div>`;
          const drops = Array.isArray(s.drops) ? s.drops : [];
          const pd = Array.isArray(ps.drops) ? ps.drops : [];
          row += drops.map((dr, j) => { const kd = k + '-d' + j, pj = pd[j] || {}; return `<div class="set drop-row" data-k="${kd}"><span class="sl">↳</span>${stepper(`lg-${kd}-w`, dr && dr.w != null ? dr.w : '', pj.w != null ? pj.w : 'кг', 'decimal', nm + ', дроп, вес', kd, 'w')}<span class="u">×</span>${stepper(`lg-${kd}-r`, dr && dr.r != null ? dr.r : '', pj.r != null ? pj.r : 'повт', 'numeric', nm + ', дроп, повторы', kd, 'r')}<button type="button" class="sb" data-action="drop-del" data-k="${kd}" aria-label="Убрать дроп-сет">×</button></div>`; }).join('');
          return row;
        }).join('') + '</div>';
      }
      body += `<div class="set-add">${wr.map(o => `<button type="button" class="link-btn" data-action="set-add" data-bi="${bi}" data-ei="${o.ei}">+ подход${multi ? ' ' + letter.get(o.ei) : ''}</button>`).join('')}</div>`;
    }
    ex.forEach((x, ei) => {
      const v = val(bi, ei);
      if (x.log === 'check') { total++; if (v && v.done) filled++; body += `<label class="chk"><input type="checkbox" id="lg-${bi}-${ei}-c"${v && v.done ? ' checked' : ''}> ${multi ? letter.get(ei) + ': ' : ''}сделано</label>`; }
      else if (x.log === 'note') { total++; if (v && v.note) filled++; body += `<input class="note-in" id="lg-${bi}-${ei}-n" value="${esc((v && v.note) || '')}" placeholder="${esc(x.ph || 'заметка')}" aria-label="${esc(x.name)}">`; }
    });
    if (!wr.length) return `<div class="blk" data-bi="${bi}" data-sort-item>${b.type ? `<div class="blk-h">${esc(b.type)}</div>` : ''}${names}${body ? `<div class="sets">${body}</div>` : ''}</div>`;
    if (firstOpen < 0 && filled < total) firstOpen = bi;
    const key = 'wk-' + i.id + '-' + bi;
    const open = anyOpen ? S.open.has(key) : firstOpen === bi;
    if (!anyOpen && open) S.open.add(key);
    const title = (b.type || 'Упражнение') + (b.type ? ' ' + (ord.slice(0, pos + 1).filter(z => ses.blocks[z].type === b.type).length) : '');
    const shortNames = order.filter(o => o.x.log === 'wr' || o.x.log === 'r').map(o => o.x.name.split(/[ ,(]/)[0]).join(' · ');
    return `<details class="blk blk-f${filled >= total ? ' full' : ''}" data-bi="${bi}" data-k="${key}" data-sort-item${open ? ' open' : ''}><summary data-sort-handle><span class="bf-t">${esc(title)}</span><span class="bf-n">${esc(shortNames)}</span><span class="bf-c" data-c="${bi}">${filled}/${total}</span></summary>${names}<div class="sets">${body}</div></details>`;
  }).join('');
  const info = [];
  if (prevDate) info.push(`Серые цифры — прошлый раз, ${short(prevDate)}. «+» с пустого поля подставляет прошлое.`);
  if (moved) info.push('Порядок упражнений изменён.');
  info.push('Переставить упражнение — удерживай заголовок и тяни.');
  if (draft) info.push('Есть несохранённые подходы — они подставлены.');
  else if (log) info.push('Подходы сохранены ' + (log.ts ? hhmm(new Date(log.ts)) + ', ' : '') + short(log.date) + '.');
  const dl = exItems().length ? `<datalist id="ex-dl">${exItems().map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>` : '';
  return `<div class="wk-prog" id="wk-prog"></div><div class="wk-list" data-sort="wk">${html}</div>` + dl + (info.length ? `<p class="note">${info.join(' ')}</p>` : '');
}
function wkProgress() {
  const box = document.getElementById('wk'); if (!box) return;
  let done = 0, total = 0;
  box.querySelectorAll('.blk').forEach(bl => {
    let bd = 0, bt = 0;
    bl.querySelectorAll('.set:not(.drop-row)').forEach(row => { bt++; if (Array.from(row.querySelectorAll('input')).some(x => x.value.trim())) bd++; });
    bl.querySelectorAll('input[type=checkbox]').forEach(x => { bt++; if (x.checked) bd++; });
    bl.querySelectorAll('.note-in').forEach(x => { bt++; if (x.value.trim()) bd++; });
    const cEl = bl.querySelector('.bf-c'); if (cEl) cEl.textContent = bd + '/' + bt;
    bl.classList.toggle('full', bt > 0 && bd >= bt);
    done += bd; total += bt;
  });
  const p = document.getElementById('wk-prog'); if (!p) return;
  const pct = total ? Math.round(done / total * 100) : 0;
  p.innerHTML = `<span class="wp-bar"><i style="width:${pct}%"></i></span><span class="wp-t">${done} из ${total}</span>`;
}
function collectLog(ses) {
  let any = false;
  const c = S.cur && S.cur.type === 'sport' ? S.cur : { times: {} };
  const num = id => { const el = document.getElementById(id); return el ? numOrNull(el.value) : null; };
  const blocks = ses.blocks.map((b, bi) => ({ type: b.type || '', ex: (b.ex || []).map((x, ei) => {
    const o = { name: x.name, log: x.log || 'check' };
    if (o.log === 'wr' || o.log === 'r') {
      const sets = [];
      for (let r = 1; document.getElementById(`lg-${bi}-${ei}-${r}-r`); r++) {
        const k = `${bi}-${ei}-${r}`;
        const w = num(`lg-${k}-w`), rr = num(`lg-${k}-r`);
        const drops = [];
        for (let j = 0; document.getElementById(`lg-${k}-d${j}-r`); j++) {
          const dw = num(`lg-${k}-d${j}-w`), dr = num(`lg-${k}-d${j}-r`);
          const d = {}; if (dw != null) d.w = dw; if (dr != null) d.r = dr; drops.push(d);
        }
        const keepDrops = drops.length && drops.some(d => d.w != null || d.r != null) ? drops : (drops.length ? drops : null);
        if (w == null && rr == null && !keepDrops) sets.push(null);
        else {
          const s = {}; if (w != null) s.w = w; if (rr != null) s.r = rr;
          if (keepDrops) s.drops = keepDrops;
          if (w != null || rr != null) { any = true; s.t = (c.times || {})[k] || undefined; if (!s.t) delete s.t; }
          sets.push(s);
        }
      }
      while (sets.length && sets[sets.length - 1] == null) sets.pop();
      o.sets = sets;
    } else if (o.log === 'check') {
      const el = document.getElementById(`lg-${bi}-${ei}-c`); o.done = !!(el && el.checked); if (o.done) any = true;
    } else if (o.log === 'note') {
      const el = document.getElementById(`lg-${bi}-${ei}-n`); o.note = el ? el.value.trim() : ''; if (o.note) any = true;
    }
    return o;
  }) }));
  return { blocks, any };
}
function saveDraftNow() {
  const c = S.cur; if (!c || c.type !== 'sport') return;
  clearTimeout(draftT);
  const lg = collectLog(c.ses);
  // на сохранение драфта: пустые дропы оставляем, чтобы строка не пропала
  LS.set('bj-draft-' + c.id, { blocks: lg.blocks });
}
function markSetTime(k) {
  const c = S.cur; if (!c || c.type !== 'sport') return;
  const m = /^(\d+-\d+-\d+)/.exec(k || ''); if (!m) return;
  c.times = c.times || {};
  if (!c.times[m[1]]) c.times[m[1]] = nowT();
}
function rerenderWk() {
  const c = S.cur; if (!c || c.type !== 'sport') return;
  const i = findInst(c.id); if (!i) return;
  const box = document.getElementById('wk'); if (!box) return;
  box.innerHTML = workoutForm(i, c.ses);
  wkProgress();
}
function stepBase(k, f) {
  const el = document.getElementById(`lg-${k}-${f}`); if (!el) return null;
  const m = /^(\d+)-(\d+)-(\d+)(?:-d(\d+))?$/.exec(k); if (!m) return null;
  const [, bi, ei, r, dj] = m;
  if (dj != null) {
    const main = numOrNull((document.getElementById(`lg-${bi}-${ei}-${r}-${f}`) || {}).value);
    if (f === 'w' && main != null) { const st = wStepFor(bi, ei); return Math.max(0, Math.round((main - Math.max(st, Math.round(main * 0.2 / st) * st)) * 100) / 100); }
    return numOrNull(el.placeholder);
  }
  const ph = numOrNull(el.placeholder);
  const prevRow = Number(r) > 1 ? numOrNull((document.getElementById(`lg-${bi}-${ei}-${Number(r) - 1}-${f}`) || {}).value) : null;
  if (f === 'w') return prevRow != null ? prevRow : ph;
  return ph != null ? ph : prevRow;
}
function wStepFor(bi, ei) {
  const c = S.cur; if (!c || !c.ses) return 2.5;
  const x = ((c.ses.blocks[bi] || {}).ex || [])[ei]; if (!x) return 2.5;
  c.steps = c.steps || {};
  if (c.steps[x.name] == null) c.steps[x.name] = wStep(x.name);
  return c.steps[x.name];
}
function stepSet(k, f, d) {
  const el = document.getElementById(`lg-${k}-${f}`); if (!el) return;
  let v = numOrNull(el.value);
  if (v == null) {
    const base = stepBase(k, f);
    v = base != null ? base : (f === 'w' ? 0 : 0) + (d > 0 ? (f === 'w' ? wStepFor(...k.split('-').slice(0, 2)) : 1) : 0);
  } else {
    const [bi, ei] = k.split('-');
    const st = f === 'r' ? 1 : wStepFor(bi, ei);
    v = Math.max(0, Math.round((v + d * st) * 100) / 100);
  }
  el.value = String(v);
  markSetTime(k);
  clearTimeout(draftT); draftT = setTimeout(saveDraftNow, 300);
  wkProgress();
}

function cleanBlocks(blocks) {
  return blocks.map(b => Object.assign({}, b, { ex: b.ex.map(x => {
    if (!Array.isArray(x.sets)) return x;
    const sets = x.sets.map(st => {
      if (!st) return null;
      const o = Object.assign({}, st);
      if (Array.isArray(o.drops)) { o.drops = o.drops.filter(d => d && (d.w != null || d.r != null)); if (!o.drops.length) delete o.drops; }
      return o.w != null || o.r != null || o.drops ? o : null;
    });
    while (sets.length && sets[sets.length - 1] == null) sets.pop();
    return Object.assign({}, x, { sets });
  }) }));
}
function wkPhotosHtml(i) {
  const L = logFor(i), ph = (L && Array.isArray(L.photos)) ? L.photos : [];
  return `<div class="wk-photos">${ph.map(p => `<img data-gh="${esc(p)}" alt="Фото к тренировке">`).join('')}<label class="btn sm file-btn wk-ph-btn">${ico('cam')}${ph.length ? 'Ещё фото' : 'Фото (результат с дорожки и т. п.)'}<input type="file" id="wk-photo" accept="image/*" multiple aria-label="Фото к тренировке"></label></div>`;
}
async function wkPhotoUpload(files) {
  const c = S.cur; if (!c || c.type !== 'sport' || !files.length) return;
  const i = findInst(c.id); if (!i) return;
  const up = await uploadFiles(files, `workouts/img/${i.id}_${Date.now().toString(36).slice(-5)}`, 'Фото тренировки');
  if (!up.photos.length) { toast('Фото не загрузилось. Проверь связь и попробуй ещё раз.'); return; }
  const mk = monthKey(i.eff), ses = c.ses;
  const next = await write('workouts/' + mk + '.json', d => { d.logs = d.logs || {}; const L = d.logs[i.id] = d.logs[i.id] || { date: i.eff, key: ses.key, title: ses.title, blocks: [], ts: Date.now() }; L.photos = (Array.isArray(L.photos) ? L.photos : []).concat(up.photos); return d; }, `Тренировка ${i.eff}: фото (${up.photos.length})`, { logs: {} });
  if (next) { S.workouts[mk] = next; cacheNow(); toast('Фото добавлено к тренировке'); openSport(c.id, true); }
}
async function saveLog(i, ses, blocks) {
  blocks = cleanBlocks(blocks);
  const mk = monthKey(i.eff);
  const ord = wkOrder(i, ses), order = ord.some((x, k) => x !== k) ? ord : null;
  const next = await write('workouts/' + mk + '.json', d => { d.logs = d.logs || {}; const prev = d.logs[i.id] || {}; d.logs[i.id] = { date: i.eff, key: ses.key, title: ses.title, blocks, ts: Date.now() }; if (order) d.logs[i.id].order = order; if (Array.isArray(prev.photos) && prev.photos.length) d.logs[i.id].photos = prev.photos; return d; }, `Тренировка ${i.eff}: ${ses.title}`, { logs: {} });
  if (next) { S.workouts[mk] = next; LS.del('bj-draft-' + i.id); LS.del('bj-wkord-' + i.id); cacheNow(); }
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
// Рисуем только открытую вкладку, остальные — при переходе на них.
const RENDER = { plan: () => renderPlan(), cal: () => renderCal(), lessons: () => renderLessons(), sport: () => renderSportTab(), food: () => renderFood(), money: () => renderMoney() };
function renderTab(t) { S.dirty.delete(t); (RENDER[t] || RENDER.plan)(); }
function render() {
  const t = today();
  $('#today-label').textContent = DOW_S[dow(t)] + ', ' + pd(t).getDate() + ' ' + MON_G[pd(t).getMonth()];
  const cur = S.tab || 'plan';
  if (cur !== 'plan' && isReady()) { S.studyCache = buildStudy(); S.sportList = buildSport(); }
  Object.keys(RENDER).forEach(k => S.dirty.add(k));
  renderTab(cur);
  renderClaudeBtn();
  if (S.cur && S.cur.type === 'req') refreshFeed();
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
  if (d <= today()) S.lessons.filter(l => l.done === d).forEach(l => rows.push(`<button type="button" class="row is-done" data-action="lesson" data-id="${esc(l.id)}"><span class="tag study">Учёба</span><span class="rb"><span class="t">${esc(lessonTitle(l))}</span><span class="m">пройден${lessonActual(l.n) ? ' · ' + hmShort(lessonActual(l.n)) + ' по факту' : ''}</span></span><span class="s"><span class="chip good">✓</span></span></button>`));
  for (const e of (study.byDate[d] || [])) rows.push(e.blocked ? rowBlocked(e) : rowStudy(e));
  for (const i of sport) if (i.eff === d) rows.push(rowSport(i));
  for (const i of sport) if (i.orig === d && i.eff !== d) rows.push(rowGhost(i));
  regularRows(d).forEach(r => rows.push(r));
  plannedRows(d).forEach(r => rows.push(r));
  dateRows(d).concat(graceRows(d)).forEach(r => rows.push(r));
  if (restDay(d) && !rows.some(r => /data-action="(study|sport)"/.test(r))) rows.unshift(`<div class="row slim rest-day"><span class="tag rest">Отдых</span><span class="rb"><span class="t">Чистый день</span><span class="m">без учёбы и спорта — обнулиться</span></span></div>`);
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
function renderSleep() { const box = $('#plan-sleep'); if (box) box.innerHTML = ''; }
// Будни и выходные спит по-разному: подставляем его обычное время отдельно для каждого (медиана последних ночей того же типа).
function sleepKind(d) { const w = pd(d).getDay(); return w === 0 || w === 6 || holiday(d) ? 'we' : 'wd'; }
const SLEEP_DEF = { wd: { bed: '23:30', wake: '07:30' }, we: { bed: '00:30', wake: '09:00' } };
function sleepTypical(kind, before) {
  const days = S.sleep.days || {};
  const ks = Object.keys(days).filter(d => (!before || d < before) && sleepKind(d) === kind).sort().slice(-21);
  const med = a => { a = a.slice().sort((x, y) => x - y); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; };
  const r5 = v => ((Math.round(v / 5) * 5) % 1440 + 1440) % 1440;
  const clock = v => pad(Math.floor(v / 60)) + ':' + pad(v % 60);
  // время отбоя считаем от полудня, чтобы 23:50 и 00:10 не давали в среднем полдень
  const beds = ks.map(d => toMin(days[d].bed)).filter(v => v != null).map(v => (v + 720) % 1440);
  const wakes = ks.map(d => toMin(days[d].wake)).filter(v => v != null);
  const def = SLEEP_DEF[kind];
  if (ks.length < 3) return { bed: def.bed, wake: def.wake, n: ks.length, stat: false };
  return { bed: clock(r5(med(beds) - 720)), wake: clock(r5(med(wakes))), n: ks.length, stat: true };
}
function slStepper(f, label, val) {
  // крупные цифры всегда в 24-часовом виде; поверх — прозрачное системное поле: тап открывает колесо выбора времени
  return `<div class="sl-row"><span class="sl-lab">${label}</span><button type="button" class="sl-b" data-sl="${f}" data-d="-5" aria-label="${label}: на 5 минут раньше">−</button><label class="sl-val"><span id="sl-${f}-v" aria-hidden="true">${esc(val || '—')}</span><input type="time" id="sl-${f}" step="300" value="${esc(val)}" aria-label="${label}"></label><button type="button" class="sl-b" data-sl="${f}" data-d="5" aria-label="${label}: на 5 минут позже">+</button></div>`;
}
// После полуночи и до 5 утра новая ночь ещё не закончилась — сон по умолчанию пишется за вчера (день пробуждения).
function sleepTarget() { const t = today(); return new Date().getHours() < 5 && !(S.sleep.days || {})[t] ? addDays(t, -1) : t; }
function openSleep(d) {
  const s = (S.sleep.days || {})[d] || {};
  const kind = sleepKind(d), ty = sleepTypical(kind, s.bed ? null : d);
  S.cur = { type: 'sleep', d };
  const kindL = kind === 'we' ? 'в выходные' : 'в будни';
  const hint = ty.stat ? `Обычно ${kindL}: ${ty.bed} → ${ty.wake} (из ${ty.n} ${plural(ty.n, 'ночи', 'ночей', 'ночей')})${s.bed ? '' : ' — уже подставил'}.` : `${kindL[0].toUpperCase() + kindL.slice(1)} пока подставляю ${ty.bed} → ${ty.wake}; с трёх отмеченных ночей начну брать твоё обычное время.`;
  openSheet(`<h2 class="sh-title">Сон · ночь на ${esc(longDate(d))}</h2>
    <div class="sl-pick">${slStepper('bed', 'Лёг', s.bed || ty.bed)}${slStepper('wake', 'Встал', s.wake || ty.wake)}</div>
    <p class="note" id="sl-dur"></p>
    <label class="fld" for="sl-note">Заметка (необязательно)</label><input id="sl-note" value="${esc(s.note || '')}" placeholder="Например: просыпался, наряд">
    <p class="note">${esc(hint)} Кнопки — по 5 минут, если держать — быстрее.</p>
    <div class="sh-acts"><button type="button" class="btn study block" data-action="sleep-save">Сохранить</button>${s.bed ? '<button type="button" class="btn danger block" data-action="sleep-del">Удалить</button>' : ''}</div>`);
  sleepDurNote();
}
function slStep(f, d) {
  const el = $('#sl-' + f); if (!el) return;
  let v = toMin(el.value); if (v == null) v = toMin(SLEEP_DEF.wd[f]) || 0;
  v = ((Math.round(v / 5) * 5 + d) % 1440 + 1440) % 1440;
  el.value = pad(Math.floor(v / 60)) + ':' + pad(v % 60);
  sleepDurNote();
}
// Нажал — шаг 5 минут; держишь — повторяет, через пару секунд шагает по 15.
let slHold = 0, slHoldT0 = 0;
document.addEventListener('pointerdown', ev => {
  const b = ev.target.closest && ev.target.closest('[data-sl]'); if (!b) return;
  ev.preventDefault();
  const f = b.dataset.sl, d = Number(b.dataset.d);
  slStep(f, d); clearTimeout(slHold); slHoldT0 = Date.now();
  const rep = () => { const t = Date.now() - slHoldT0; if (t > 8000) return; slStep(f, t > 2200 ? d * 3 : d); slHold = setTimeout(rep, 140); };
  slHold = setTimeout(rep, 450);
});
['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, () => clearTimeout(slHold)));
document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-sl]'); if (b && ev.detail === 0) slStep(b.dataset.sl, Number(b.dataset.d)); });
function sleepDurNote() {
  ['bed', 'wake'].forEach(f => { const i = $('#sl-' + f), v = $('#sl-' + f + '-v'); if (i && v) v.textContent = i.value || '—'; });
  const el = $('#sl-dur'); if (!el) return;
  const m = sleepMin({ bed: $('#sl-bed').value, wake: $('#sl-wake').value });
  if (!m) { el.textContent = 'Дата — день, когда проснулся.'; return; }
  const band = sleepBand(), tag = m < band.lo ? ' — меньше твоей нормы' : m > band.hi + 15 ? ' — больше нормы, может быть вялость' : ' — в норме';
  el.textContent = 'Получается ' + hm(m) + tag + '.';
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
  const s = Math.floor(timerElapsed(tm) / 1000);
  const txt = `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ':' : ''}${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  el.textContent = (tm.paused ? '⏸ ' : '⏱ ') + txt;
  const ft = document.getElementById('fc-time'); if (ft) ft.textContent = txt;
  if (!tm.paused && !document.hidden && !timerIv) timerIv = setInterval(timerTick, 1000);
}
let timerIv = null;
function timerTick() {
  const tm = timerState();
  if (!tm || tm.paused || document.hidden) { clearInterval(timerIv); timerIv = null; }
  renderTimerChip();
}
function timerStart(n, focus) { if (!timerState()) LS.set('bj-timer', { start: Date.now(), n: n || null, pausedMs: 0 }); renderTimerChip(); closeSheet(); if (focus) openFocus(); else toast('Время пошло'); }
function openTimerStop() {
  const tm = timerState(); if (!tm) return;
  const min = Math.max(1, Math.round(timerElapsed(tm) / 60000));
  S.cur = { type: 'timer', min, n: tm.n };
  openSheet(`<h2 class="sh-title">⏱ ${hmShort(min)}</h2>${tm.n ? `<p class="sh-meta">Урок ${esc(tm.n)}</p>` : ''}
    <div class="sh-acts"><button type="button" class="btn study block" data-action="timer-save" data-done="1">Сохранить и отметить урок</button><button type="button" class="btn block" data-action="timer-save">Только сохранить время</button><button type="button" class="btn danger block" data-action="timer-cancel">Сбросить</button></div>`);
}
async function logStudy(min, n, date, src) {
  return writePlan(p => { const l = p.studyLog = p.studyLog || []; l.push({ date: date || today(), n: n || null, min: Math.round(min), src: src || 'timer', at: hhmm(new Date()) }); }, `Учёба: ${Math.round(min)} мин по факту`);
}
// «Как зашёл урок» — оценка 1–5: интерес к теме, а не усталость (учёба вечером, уставать нормально). Claude смотрит это в разборах.
const FEEL = [[1, 'Мимо'], [2, 'Слабо'], [3, 'Норм'], [4, 'Хорошо'], [5, 'Огонь']];
const FEEL_OLD = { up: 5, ok: 3, down: 1 };
function feelVal(v) { return FEEL_OLD[v] || Number(v) || 0; }
function feelRowHtml(n) {
  const l = S.lessons.find(x => String(x.n) === String(n)), cur = feelVal(l && l.feel);
  return `<p class="fld">Как зашёл урок, 1–5? <span class="m">(интерес к теме, не усталость)</span></p><div class="feel-row">${FEEL.map(([v, t]) => `<button type="button" class="btn feel${cur === v ? ' on' : ''}" data-action="lesson-feel" data-n="${esc(n)}" data-v="${v}"><b>${v}</b><small>${t}</small></button>`).join('')}</div>`;
}
async function setFeel(n, v) {
  const l = S.lessons.find(x => String(x.n) === String(n)); v = Number(v); if (!l || !(v >= 1 && v <= 5)) return false;
  return writeLessons(list => { const x = list.find(y => y.id === l.id); if (x) x.feel = v; }, `Учёба: урок ${l.n} — ${v}/5`);
}
function openFeel(n) {
  S.cur = { type: 'feel', n };
  openSheet(`<h2 class="sh-title">Урок ${esc(n)} пройден</h2>${feelRowHtml(n)}<div class="sh-acts"><button type="button" class="btn block" data-action="close">Пропустить</button></div>`);
}
function openActual(n, date, planned) {
  S.cur = { type: 'actual', n, date };
  openSheet(`<h2 class="sh-title">Сколько по факту?</h2><p class="sh-meta">Урок ${esc(n)} · план ${hmShort(planned || 60)}</p>${feelRowHtml(n)}<p class="fld">Сколько ушло времени</p>
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
  return `<details class="regs" data-k="planned"${openAttr('planned')}><summary><span class="rs-t">Будущие покупки</span><span class="sec-note">${l.length ? fmt(total) + ' ' + esc(curSym()) : 'пусто'}</span></summary><div class="stack">${giftsBetween(today(), addDays(today(), 60)).map(o => `<button type="button" class="reg" data-action="dates"><span class="rn">🎁 ${esc(o.x.title)}</span><span class="ra">${fmt(o.x.gift)} ${esc(curSym())}</span><span class="rw">${dm(o.d)} · через ${daysBetween(today(), o.d)} ${plural(daysBetween(today(), o.d), 'день', 'дня', 'дней')}</span></button>`).join('')}${l.map(x => `<button type="button" class="reg" data-action="buy" data-id="${esc(x.id)}"><span class="rn">${esc(x.name)}</span><span class="ra">${x.amount ? fmt(x.amount) + ' ' + esc(curSym()) : '—'}</span><span class="rw">${x.date ? dm(x.date) + (x.date >= today() ? ' · через ' + daysBetween(today(), x.date) + ' ' + plural(daysBetween(today(), x.date), 'день', 'дня', 'дней') : '') : 'без даты'}${x.note ? ' · ' + esc(x.note) : ''}</span></button>`).join('')}</div><div class="acct-links"><button type="button" class="link-btn" data-action="buy-new">+ Покупка</button><button type="button" class="link-btn" data-action="dates">🎁 Важные даты</button></div></details>`;
}
/* ---------- серия: дни подряд, когда запланированное сделано ---------- */
function dayPlanned(d, sport) { const c = S.config && S.config.study ? studyCap(d) : { cap: 0 }; return (c.cap > 0 && !c.blocked) || sport.some(i => i.eff === d); }
function dayDone(d, sport) { return activity(d) || sport.some(i => i.eff === d && (i.state === 'done' || i.state === 'other')); }
function streakInfo() {
  if (!isReady()) return null;
  const t = today(), st = [(S.config.study || {}).start, (S.config.sport || {}).start].filter(Boolean).sort()[0] || t;
  const sport = buildSport(addDays(t, -120) < st ? st : addDays(t, -120), t);
  let cur = 0, best = 0, run = 0, broken = false, todayDone = false;
  for (let d = st; d <= t; d = addDays(d, 1)) {
    const done = dayDone(d, sport), planned = dayPlanned(d, sport);
    if (done) { run++; if (d === t) todayDone = true; }
    else if (planned && d < t && !excused(d)) run = 0;
    best = Math.max(best, run);
  }
  cur = run;
  return { cur, best, todayDone };
}
function streakChip() {
  const s = streakInfo(); if (!s) return '';
  return `<span class="streak${s.cur ? '' : ' off'}" title="Дни подряд, когда запланированное сделано">🔥 ${s.cur}${s.best > s.cur ? `<small> · рекорд ${s.best}</small>` : ''}</span>`;
}

/* ---------- цели на квартал ---------- */
function qKey(d) { const x = pd(d); return x.getFullYear() + '-Q' + (Math.floor(x.getMonth() / 3) + 1); }
function qRange(k) { const [y, q] = k.split('-Q').map(Number); const m = (q - 1) * 3; return { from: ds(new Date(y, m, 1, 12)), to: ds(new Date(y, m + 3, 0, 12)) }; }
function qNext(k) { const [y, q] = k.split('-Q').map(Number); return q === 4 ? (y + 1) + '-Q1' : y + '-Q' + (q + 1); }
function qShown() { const k = qKey(today()), r = qRange(k); return daysBetween(today(), r.to) < 7 ? qNext(k) : k; }
const QT = { lessons: 'Уроки', workouts: 'Тренировки по плану', hours: 'Часы учёбы (RSS)', debt: 'Закрыть долг', save: 'Накопить', manual: 'Своя цель' };
function qProgress(g, k) {
  const r = qRange(k), t = today();
  if (g.type === 'lessons') return { cur: S.lessons.filter(l => l.done && l.done >= r.from && l.done <= r.to).length, target: Number(g.target) || 1 };
  if (g.type === 'workouts') return { cur: buildSport(r.from, r.to < t ? r.to : t).filter(i => i.eff >= r.from && i.eff <= r.to && (i.state === 'done' || i.state === 'other')).length, target: Number(g.target) || 1 };
  if (g.type === 'hours') return { cur: Math.round(studyMinutes(r.from, r.to) / 6) / 10, target: Number(g.target) || 1 };
  const a = g.acc && acctById(g.acc);
  if (g.type === 'debt' && a) { const start = Number(g.start) || Number(a.balance) || 1; return { cur: Math.max(0, start - (Number(a.balance) || 0)), target: start, money: true }; }
  if (g.type === 'save' && a) return { cur: Number(a.balance) || 0, target: Number(g.target) || 1, money: true };
  return { cur: Number(g.current) || 0, target: Number(g.target) || 1 };
}
function openQuarter() {
  const k = qShown(), list = clone(((S.quarters || {})[k]) || []);
  while (list.length < 3) list.push({ id: 'q' + rid().slice(0, 6), type: 'manual', title: '', target: '' });
  S.cur = { type: 'quarter', k, list };
  const accs = accounts().filter(a => a.type !== 'card');
  openSheet(`<h2 class="sh-title">Цели на ${k.split('-Q')[1]}-й квартал ${k.slice(0, 4)}</h2>
    ${list.map((g, i) => `<div class="q-edit"><div class="two"><div><label class="fld" for="qt-${i}">Цель ${i + 1}</label><input id="qt-${i}" value="${esc(g.title || '')}" placeholder="${esc(QT[g.type] || '')}"></div><div><label class="fld" for="qy-${i}">Что считать</label><select id="qy-${i}">${Object.keys(QT).map(t => `<option value="${t}"${g.type === t ? ' selected' : ''}>${QT[t]}</option>`).join('')}</select></div></div>
      <div class="two"><div><label class="fld" for="qn-${i}">Цель (число)</label><input id="qn-${i}" inputmode="decimal" value="${esc(g.target || '')}"></div><div><label class="fld" for="qa-${i}">Счёт / сейчас</label>${g.type === 'manual' ? `<input id="qc-${i}" inputmode="decimal" value="${esc(g.current || '')}" placeholder="сейчас">` : `<select id="qa-${i}"><option value="">—</option>${accs.map(a => `<option value="${esc(a.id)}"${g.acc === a.id ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select>`}</div></div></div>`).join('')}
    <div class="sh-acts"><button type="button" class="btn primary block" data-action="q-save">Сохранить</button></div>`);
}
async function quarterSave() {
  const c = S.cur; if (!c || c.type !== 'quarter') return;
  const list = c.list.map((g, i) => {
    const o = { id: g.id, type: $('#qy-' + i).value, title: $('#qt-' + i).value.trim() };
    const n = numOrNull($('#qn-' + i).value); if (n != null) o.target = n;
    const ae = document.getElementById('qa-' + i), ce = document.getElementById('qc-' + i);
    if (ae && ae.value) { o.acc = ae.value; const a = acctById(o.acc); if (o.type === 'debt') o.start = g.acc === o.acc && g.start ? g.start : Number(a && a.balance) || 0; }
    if (ce) { const v = numOrNull(ce.value); if (v != null) o.current = v; }
    return o;
  }).filter(o => o.title || o.target != null || o.acc);
  const next = await write('goals.json', d => { d.quarters = d.quarters || {}; d.quarters[c.k] = list; return d; }, `Цели на квартал ${c.k}`, { quarters: {} });
  if (next) { S.quarters = next.quarters; cacheNow(); closeSheet(); render(); toast('Цели сохранены'); }
}

/* ---------- важные даты и подарки ---------- */
function importantDates() { return (S.config && S.config.dates) || []; }
function nextOcc(md, from) { const y = Number(from.slice(0, 4)); for (const yy of [y, y + 1]) { const d = yy + '-' + md; if (d >= from) return d; } return null; }
function dateRows(d) {
  const rows = [];
  for (const x of importantDates()) {
    const occ = nextOcc(x.md, d);
    if (occ === d) rows.push(`<button type="button" class="row slim" data-action="dates"><span class="tag gift">🎁 Дата</span><span class="rb"><span class="t">${esc(x.title)}</span></span>${x.gift ? `<span class="s">${fmt(x.gift)} ${esc(curSym())}</span>` : ''}</button>`);
    else if (occ === addDays(d, 7)) rows.push(`<button type="button" class="row slim" data-action="dates"><span class="tag gift">Через неделю</span><span class="rb"><span class="t">${esc(x.title)} · ${dm(occ)}</span><span class="m">${x.gift ? 'подарок ~' + fmt(x.gift) + ' ' + esc(curSym()) : 'подарок: впиши бюджет'}</span></span></button>`);
  }
  return rows;
}
function giftsBetween(from, to) { return importantDates().map(x => ({ x, d: nextOcc(x.md, from) })).filter(o => o.d && o.d <= to && o.x.gift); }
function openDates() {
  const list = clone(importantDates()); list.push({ id: null, title: '', md: '', gift: '' });
  S.cur = { type: 'dates', list };
  openSheet(`<h2 class="sh-title">Важные даты</h2>${list.map((x, i) => `<div class="q-edit"><label class="fld" for="dt-${i}">${x.id ? '' : 'Новая дата'}</label><input id="dt-${i}" value="${esc(x.title)}" placeholder="Например: ДР брата"><div class="two"><div><label class="fld" for="dd-${i}">Дата</label><input id="dd-${i}" value="${x.md ? x.md.split('-').reverse().join('.') : ''}" placeholder="дд.мм" inputmode="numeric"></div><div><label class="fld" for="dg-${i}">Подарок, ${esc(curSym())}</label><input id="dg-${i}" inputmode="numeric" value="${esc(x.gift || '')}"></div></div></div>`).join('')}
    <div class="sh-acts"><button type="button" class="btn money block" data-action="dates-save">Сохранить</button></div>`);
}
async function datesSave() {
  const c = S.cur; if (!c || c.type !== 'dates') return;
  const list = [];
  c.list.forEach((x, i) => {
    const title = $('#dt-' + i).value.trim(), m = /^(\d{1,2})[.\-/](\d{1,2})$/.exec($('#dd-' + i).value.trim());
    if (!title || !m) return;
    const o = { id: x.id || 'd' + rid().slice(0, 6), title, md: pad(Number(m[2])) + '-' + pad(Number(m[1])) };
    const g = numOrNull($('#dg-' + i).value); if (g > 0) o.gift = Math.round(g);
    list.push(o);
  });
  if (await writeConfig(cfg => { cfg.dates = list; }, 'Важные даты')) { closeSheet(); toast('Сохранено'); }
}

/* ---------- кредитки: льготный период и страховка ---------- */
function graceRows(d) {
  return accounts().filter(a => a.type === 'debt' && a.graceUntil && (Number(a.balance) || 0) > 0).filter(a => d === a.graceUntil || d === addDays(a.graceUntil, -7)).map(a => `<button type="button" class="row slim" data-action="goal" data-id="${esc((goals().find(g => g.acc === a.id) || {}).id || '')}"><span class="tag pay">${d === a.graceUntil ? 'Сегодня' : 'Через неделю'}</span><span class="rb"><span class="t">${esc(a.name)}: погасить без процентов</span><span class="m">до ${dm(a.graceUntil)} · ${fmt(a.balance)} ${esc(curSym())}</span></span></button>`);
}
function graceChip(a) {
  if (!a || !a.graceUntil || !((Number(a.balance) || 0) > 0)) return '';
  const n = daysBetween(today(), a.graceUntil);
  return `<span class="chip${n <= 7 ? ' bad' : ''}">${n < 0 ? 'льготный период закончился ' + dm(a.graceUntil) : 'без % до ' + dm(a.graceUntil) + ' · ' + n + ' ' + plural(n, 'день', 'дня', 'дней')}</span>`;
}

/* ---------- список покупок из меню ---------- */
function parseIng(s) {
  const m = /^(.+?)\s*[—–-]\s*([\d.,]+)\s*([^\d\s].*)?$/.exec(String(s).trim());
  if (!m) return { name: cap1(String(s).split(/[—–-]/)[0].trim()), qty: null, unit: '' };
  return { name: cap1(m[1].trim()), qty: parseFloat(m[2].replace(',', '.')), unit: (m[3] || '').trim() };
}
function shopList(days) {
  const t = today(), counts = {}, plain = {};
  for (let k = 0; k < days; k++) {
    const d = addDays(t, k), day = (S.meals.days || {})[d] || {};
    for (const meal of Object.keys(day)) if (Array.isArray(day[meal])) for (const id of day[meal]) {
      const r = recipeById(id); if (!r) continue;
      if (meal === 'lunch' && isWorkday(d) && !absenceOn(d)) continue; // обед — в столовой
      const parts = isCombo(r) ? comboParts(r) : [r];
      for (const p of parts) { if (!p) continue; if (Array.isArray(p.ingredients) && p.ingredients.length) counts[p.id] = (counts[p.id] || 0) + 1; else plain[p.title] = (plain[p.title] || 0) + 1; }
    }
  }
  const agg = {};
  for (const id of Object.keys(counts)) {
    const r = recipeById(id), batches = Math.ceil(counts[id] / (Number(r.portions) || 1));
    for (const s of r.ingredients) {
      const g = parseIng(s), key = norm(g.name) + '|' + g.unit;
      const o = agg[key] = agg[key] || { name: g.name, unit: g.unit, qty: 0, loose: g.qty == null, from: new Set() };
      if (g.qty != null) o.qty += g.qty * batches; o.from.add(r.title);
    }
  }
  const items = Object.values(agg).map(o => ({ key: norm(o.name + ' ' + o.unit), label: o.name, amount: o.loose || !o.qty ? (o.unit || '') : (Math.round(o.qty * 10) / 10).toString().replace('.', ',') + ' ' + o.unit, from: Array.from(o.from).join(', ') }));
  Object.keys(plain).forEach(n => items.push({ key: norm(n), label: n, amount: plain[n] > 1 ? '× ' + plain[n] : '', from: '' }));
  (LS.get('bj-shop-extra') || []).forEach(n => items.push({ key: 'x:' + norm(n), label: n, amount: '', from: '', extra: true }));
  return items.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}
function openShop(days) {
  days = days || (S.cur && S.cur.type === 'shop' && S.cur.days) || 7;
  S.cur = { type: 'shop', days };
  const items = shopList(days), got = new Set(LS.get('bj-shop-got') || []);
  const todo = items.filter(x => !got.has(x.key)), done = items.filter(x => got.has(x.key));
  const row = x => `<button type="button" class="shop-i${got.has(x.key) ? ' got' : ''}" data-action="shop-tick" data-key="${esc(x.key)}"><span class="cb">${got.has(x.key) ? '✓' : ''}</span><span class="sn">${esc(x.label)}${x.from ? `<small>${esc(x.from)}</small>` : ''}</span><span class="sa">${esc(x.amount)}</span></button>`;
  openSheet(`<h2 class="sh-title">🛒 Список покупок</h2>
    <div class="seg" role="group">${[[3, '3 дня'], [7, 'Неделя']].map(([v, l]) => `<button type="button" data-action="shop-days" data-days="${v}" aria-pressed="${v === days}">${l}</button>`).join('')}</div>
    ${items.length ? `<div class="stack shop">${todo.map(row).join('')}${done.map(row).join('')}</div>` : '<p class="note">Выбери блюда на ближайшие дни — список соберётся сам.</p>'}
    <div class="form-row" style="margin-top:12px"><input id="shop-add" placeholder="Добавить своё"><button type="button" class="btn" data-action="shop-add">+</button></div>
    ${done.length ? '<div class="sh-acts"><button type="button" class="btn block" data-action="shop-clear">Убрать купленное</button></div>' : ''}`, true);
}

/* ---------- поиск по заметкам ---------- */
async function notesIndex() {
  if (!S.notes || !S.notes.shas) return null;
  const idx = LS.get('bj-nidx') || {}, src = notesSrc(), need = Object.entries(S.notes.shas).filter(([, sha]) => idx[sha] == null);
  for (let i = 0; i < need.length; i += 6) {
    await Promise.all(need.slice(i, i + 6).map(async ([, sha]) => {
      try { const r = await GH.req('GET', `/repos/${encodeURIComponent(src.owner)}/${encodeURIComponent(src.repo)}/git/blobs/${sha}`); if (r.ok) idx[sha] = b64dec((await r.json()).content || ''); } catch (_) {}
    }));
    const box = $('#notes-res'); if (box) box.innerHTML = `<p class="loading"><span class="spin" aria-hidden="true"></span>Читаю заметки: ${Math.min(i + 6, need.length)} из ${need.length}</p>`;
  }
  const keep = {}; Object.values(S.notes.shas).forEach(sha => { if (idx[sha] != null) keep[sha] = idx[sha]; });
  LS.set('bj-nidx', keep);
  return keep;
}
let notesQT = 0;
function notesSearch(q) {
  clearTimeout(notesQT);
  notesQT = setTimeout(async () => {
    const box = $('#notes-res'); if (!box) return;
    q = norm(q); if (q.length < 2) { box.innerHTML = ''; return; }
    const idx = await notesIndex(); if (!idx) { box.innerHTML = ''; return; }
    const res = [];
    for (const [path, sha] of Object.entries(S.notes.shas)) {
      const name = path.split('/').pop().replace(/\.md$/i, ''), flat = (idx[sha] || '').replace(/\s+/g, ' '), low = flat.toLowerCase().replace(/ё/g, 'е');
      const inName = norm(name).includes(q), at = low.indexOf(q);
      if (!inName && at < 0) continue;
      let snip = '';
      if (at >= 0) { const sp = flat.lastIndexOf(' ', Math.max(0, at - 30)); const s0 = sp > 0 ? sp + 1 : 0; snip = (s0 ? '…' : '') + flat.slice(s0, s0 + 120); }
      res.push({ path, name, snip, score: inName ? 0 : 1 });
    }
    res.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, 'ru'));
    const hl = s => { const e = esc(s), i = norm(e).indexOf(q); return i < 0 ? e : e.slice(0, i) + '<mark>' + e.slice(i, i + q.length) + '</mark>' + e.slice(i + q.length); };
    box.innerHTML = res.length ? `<div class="stack">${res.slice(0, 30).map(r => `<button type="button" class="nt-hit" data-action="note" data-path="${esc(r.path)}"><b>${hl(r.name)}</b>${r.snip ? `<small>${hl(r.snip)}</small>` : ''}</button>`).join('')}</div>` : '<p class="note">Ничего не нашлось.</p>';
  }, 250);
}

/* ---------- режим фокуса ---------- */
function timerElapsed(tm) { tm = tm || timerState(); if (!tm) return 0; return Math.max(0, (tm.paused || Date.now()) - tm.start - (tm.pausedMs || 0)); }
function openFocus() {
  const tm = timerState(); if (!tm) return;
  const L = tm.n ? S.lessons.find(l => String(l.n) === String(tm.n)) : null;
  const el = $('#focus');
  el.innerHTML = `<div class="fc-in"><div class="fc-top"><span class="tag study">Фокус</span><button type="button" class="sheet-x" data-action="focus-hide" aria-label="Свернуть">—</button></div>
    <div class="fc-title">${L ? esc(lessonTitle(L)) : 'Учёба'}</div><div class="fc-time" id="fc-time"></div>
    ${L && Array.isArray(L.goals) && L.goals.length ? `<ol class="fc-goals">${L.goals.map(g => `<li>${esc(g)}</li>`).join('')}</ol>` : ''}
    <div class="fc-acts"><button type="button" class="btn block" data-action="focus-pause">${tm.paused ? '▶ Продолжить' : '⏸ Пауза'}</button><button type="button" class="btn study block" data-action="timer-stop-real">■ Закончить</button></div></div>`;
  el.hidden = false; document.body.classList.add('locked');
  renderTimerChip();
}
function hideFocus() { const el = $('#focus'); if (el) { el.hidden = true; document.body.classList.remove('locked'); } }
/* ---------- план денег: бюджет «на жизнь», регулярные платежи, цели ---------- */
function moneyCfg() { return (S.config && S.config.money) || {}; }
function moneyPlan() { return moneyCfg().plan || null; }
function regulars() { return moneyCfg().regular || []; }
function goals() { return (moneyCfg().goals || []).filter(g => !(demo() && (g.type === 'debt' || demoBad(g.name)))); }
function acctById(id) { return accounts().find(a => a.id === id) || null; }
let regCache = { cfg: null, list: [] };
const regItem = new WeakMap();
function regMatchers() {
  const rg = regulars();
  if (regCache.cfg !== rg) regCache = { cfg: rg, list: rg.filter(r => !r.cash).map(r => ({ r, words: (r.match && r.match.length ? r.match : [r.name]).filter(Boolean).map(norm) })) };
  return regCache.list;
}
function regularOf(x) {
  const k = kindOf(x); if (k !== 'spend' && k !== 'transfer') return null;
  const ms = regMatchers(), hit = regItem.get(x);
  if (hit && hit.cfg === regCache.cfg) return hit.res;
  const n = norm((x.name || '') + ' ' + (x.raw || ''));
  const c = ms.filter(m => m.words.some(w => n.includes(w))).map(m => m.r);
  let res = c[0] || null;
  if (c.length > 1) { const amt = Number(x.amount) || 0; res = c.slice().sort((a, b) => Math.abs((Number(a.amount) || 0) - amt) - Math.abs((Number(b.amount) || 0) - amt))[0]; }
  regItem.set(x, { cfg: regCache.cfg, res });
  return res;
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
      - plannedBuys().filter(x => !x.done && x.amount && (x.date ? x.date > prev && x.date <= pay && x.date >= today() : k === 0)).reduce((a, x) => a + Number(x.amount), 0)
      - giftsBetween(prev > today() ? addDays(prev, 1) : today(), pay).reduce((a, o) => a + Number(o.x.gift), 0);
    for (const d of debts) { const a = acctById((goals().find(g => g.id === d.id) || {}).acc); if (d.bal > 0 && a && a.insurance) d.bal += Number(a.insurance); }
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
    } else lines.push('задай сумму цели и срок');
  }
  if (a.insurance && cur > 0) lines.push(`страховка ${fmt(a.insurance)} ₽/мес`);
  if (stale) lines.push(`остаток на ${dm(a.asOf)} — обнови`);
  const gc = g.type === 'debt' ? graceChip(a) : '';
  const urgent = a.graceUntil && daysBetween(today(), a.graceUntil) <= 10 && cur > 0;
  return `<details class="goal ${g.type}" data-k="goal-${esc(g.id)}"${openAttr('goal-' + g.id)}><summary><span class="gt"><b>${esc(g.name)}</b><span class="gv">${g.type === 'debt' && cur > 0 ? '−' : ''}${fmt(cur)}</span></span>${pct != null ? `<span class="bar"><i style="width:${pct.toFixed(1)}%"></i></span>` : ''}${urgent ? gc : ''}</summary><div class="gd"><span class="gm">${esc(lines.join(' · '))}</span>${urgent ? '' : gc}<button type="button" class="btn sm" data-action="goal" data-id="${esc(g.id)}">Изменить</button></div></details>`;
}
function budgetHtml() {
  if (!S.ready || !S.config) return '';
  const p = moneyPlan(), b = budgetNow(), cur = esc(curSym());
  if (!p || !b) return '';
  const pct = Math.max(0, Math.min(100, b.spent / b.living * 100)), cn = canteenInfo();
  return `<details class="budget${b.left < 0 ? ' over' : ''}" data-k="budget"${openAttr('budget')}><summary><span class="gt"><b>На жизнь до ${dm(b.end)}</b><span class="gv">${b.left < 0 ? '−' + fmt(Math.round(-b.left)) : fmt(Math.max(0, Math.floor(b.perDay))) + '<small> ₽/день</small>'}</span></span><span class="bar"><i style="width:${pct.toFixed(1)}%"></i></span></summary><div class="gd"><span class="gm">потрачено ${fmt(Math.round(b.spent))} из ${fmt(b.living)} · осталось ${fmt(Math.round(b.left))} ${cur} на ${b.daysLeft} ${plural(b.daysLeft, 'день', 'дня', 'дней')}</span>${cn ? `<span class="gm">столовая до ${dm(cn.end)}: ${cn.meals} ${plural(cn.meals, 'обед', 'обеда', 'обедов')} ≈ ${fmt(cn.need)} ${cur} наличными${cn.cashLeft ? ` · на руках ~${fmt(cn.cashLeft)}` : ''}</span>` : ''}<button type="button" class="btn sm" data-action="budget">Настроить</button></div></details>`;
}
/* ---------- до зарплаты: хватит ли денег при нынешнем темпе ---------- */
const median = a => { const b = a.slice().sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : 0; };
const bigLim = () => Math.max(2000, ((moneyPlan() || {}).living || 30000) * 0.07);
// Обычный темп «на жизнь» по карте (без наличных и без крупных разовых покупок) за последние ~2 недели.
function livingPace() {
  const t = today(), start = periodOf(t), from = daysBetween(start, t) >= 7 ? (addDays(t, -14) < start ? start : addDays(t, -14)) : addDays(t, -14);
  const to = addDays(t, -1), days = daysBetween(from, to) + 1;
  const mks = Array.from(new Set([monthKey(from), monthKey(to)]));
  if (days < 5 || !mks.every(mk => S.money[mk])) return null;
  const list = mks.flatMap(mk => (S.money[mk].items || [])).filter(x => x.date >= from && x.date <= to && kindOf(x) === 'spend' && isLiving(x));
  const big = purchases(list).filter(q => q.amount >= bigLim());
  const bigSum = sumAmt(big);
  return { perDay: Math.max(0, (sumAmt(list) - bigSum) / days), days, big: big.length, bigSum };
}
function paydayForecast() {
  const av = availableNow(), b = budgetNow();
  if (!b || !av.cards.length || av.missing.length) return null;
  const t = today(), end = b.end, days = b.daysLeft, have = av.sum + av.delta;
  const regs = regulars().filter(r => !r.cash && !regularPaid(r)).map(r => ({ r, d: nextDue(r) })).filter(o => o.d && o.d <= end);
  const buys = plannedBuys().filter(x => !x.done && Number(x.amount) > 0 && x.date && x.date >= t && x.date <= end);
  const cn = canteenInfo(), cashNeed = cn ? Math.max(0, cn.need - cn.cashLeft) : 0;
  const pace = livingPace(), perDay = pace ? pace.perDay : b.living / (daysBetween(b.start, end) + 1);
  const regSum = regs.reduce((a, o) => a + (Number(o.r.amount) || 0), 0), buySum = sumAmt(buys);
  const free = have - regSum - buySum - cashNeed;
  const stale = av.known.some(a => a.asOf && daysBetween(a.asOf, t) > 5);
  return { have, regs, regSum, buys, buySum, cashNeed, cn, pace, perDay, days, end, payday: addDays(end, 1), free, projected: free - perDay * days, safe: free / days, stale };
}
function forecastHtml() {
  if (!S.ready || !S.config) return '';
  const f = paydayForecast(); if (!f) return '';
  const bad = f.projected < 0, cur = esc(curSym());
  const head = bad ? `не хватит ~${fmt(Math.round(-f.projected / 100) * 100)} ${cur}` : `хватит, останется ~${fmt(Math.round(f.projected / 100) * 100)} ${cur}`;
  const sub = f.free <= 0 ? 'денег на картах уже меньше, чем нужно на платежи до зарплаты'
    : bad ? `чтобы дотянуть без кредитки — не больше ${fmt(Math.floor(f.safe / 10) * 10)} ${cur}/день (сейчас ~${fmt(Math.round(f.perDay / 10) * 10)})`
    : `при темпе ~${fmt(Math.round(f.perDay / 10) * 10)} ${cur}/день`;
  return `<button type="button" class="budget fc${bad ? ' over' : ''}" data-action="fc"><span class="gt"><b>До зарплаты ${f.days} ${plural(f.days, 'день', 'дня', 'дней')}</b><span class="gv">${esc(head)}</span></span><span class="gm">${esc(sub)}${f.stale ? ' · остатки на картах давно не обновлялись' : ''}</span></button>`;
}
function openForecast() {
  const f = paydayForecast(); if (!f) return;
  const cur = esc(curSym()), sig = v => (v < 0 ? '−' : '') + fmt(Math.abs(Math.round(v)));
  S.cur = { type: 'fc' };
  openSheet(`<h2 class="sh-title">До зарплаты ${dm(f.payday)}</h2>
    <div class="big-num">${f.projected < 0 ? '−' + fmt(Math.round(-f.projected)) : fmt(Math.round(f.projected))}<small> ${cur} ${f.projected < 0 ? 'не хватит' : 'останется'}</small></div>
    <div class="kv"><span>Сейчас на картах</span><span class="v">${fmt(Math.round(f.have))}</span>
    ${f.regs.map(o => `<span>${esc(o.r.name)} · ${dm(o.d)}</span><span class="v">−${fmt(o.r.amount)}</span>`).join('')}
    ${f.buys.map(x => `<span>${esc(x.name)} · ${dm(x.date)}</span><span class="v">−${fmt(x.amount)}</span>`).join('')}
    ${f.cashNeed ? `<span>Наличные на столовую (${f.cn.meals} ${plural(f.cn.meals, 'обед', 'обеда', 'обедов')})</span><span class="v">−${fmt(Math.round(f.cashNeed))}</span>` : ''}
    <span>Обычные траты: ${f.days} ${plural(f.days, 'день', 'дня', 'дней')} × ~${fmt(Math.round(f.perDay))}</span><span class="v">−${fmt(Math.round(f.perDay * f.days))}</span>
    <span class="sum">К зарплате</span><span class="v sum${f.projected >= 0 ? ' pos' : ''}">${sig(f.projected)}</span></div>
    <p class="note">${f.free > 0 ? `Чтобы дотянуть до ${dm(f.payday)} без кредитки, тратить на жизнь по карте не больше <b>${fmt(Math.floor(f.safe))} ${cur} в день</b>.` : 'Денег на картах не хватает даже на платежи до зарплаты: что-то из них придётся перенести или закрыть из накоплений, а не кредиткой.'}
    ${f.pace ? ` Темп посчитан по последним ${f.pace.days} ${plural(f.pace.days, 'дню', 'дням', 'дням')}${f.pace.big ? `, без ${f.pace.big} ${plural(f.pace.big, 'крупной покупки', 'крупных покупок', 'крупных покупок')} на ${fmt(Math.round(f.pace.bigSum))} ${cur}` : ''}.` : ' Темп пока взят из бюджета на жизнь: данных за последние дни мало.'}
    ${f.stale ? ' Остатки на картах давно не обновлялись — прогноз точнее, если вписать их заново.' : ''}</p>
    <div class="sh-acts"><button type="button" class="btn block" data-action="acct-cards">Обновить остатки на картах</button></div>`);
}

/* ---------- лимиты по категориям (бюджетный месяц, только траты «на жизнь») ---------- */
function limits() { const L = moneyCfg().limits || {}; const o = {}; Object.keys(L).forEach(c => { if (Number(L[c]) > 0) o[c] = Number(L[c]); }); return o; }
function livingByCat(start) {
  const out = {};
  periodItems(start).filter(x => kindOf(x) === 'spend' && isLiving(x)).forEach(x => { const c = x.cat || otherCat(); out[c] = (out[c] || 0) + (Number(x.amount) || 0); });
  return out;
}
function limitsNow() {
  const L = limits(); if (!Object.keys(L).length) return null;
  const t = today(), start = periodOf(t), end = periodEnd(start);
  if (!periodMonths(start).every(mk => S.money[mk])) return null;
  const by = livingByCat(start), len = daysBetween(start, end) + 1, k = daysBetween(start, t) + 1;
  const rows = Object.entries(L).map(([c, lim]) => {
    const v = by[c] || 0, pace = lim * k / len;
    return { c, lim, v, st: v > lim ? 'over' : v > lim * 0.4 && v > pace * 1.15 ? 'fast' : 'ok' };
  }).sort((a, b) => b.v / b.lim - a.v / a.lim);
  const loose = Object.entries(by).filter(([c]) => !(c in L)).sort((a, b) => b[1] - a[1]);
  return { rows, loose, k, len, end };
}
function limitsHtml() {
  if (!S.ready || !S.config || !moneyPlan()) return '';
  const ln = limitsNow(), cur = esc(curSym());
  if (!ln) return Object.keys(limits()).length ? '' : `<button type="button" class="anom lim-ask" data-action="lim"><span class="an-ic">${ico('warn')}</span><span class="an-t">Задай лимиты по категориям — увидишь, где уходят деньги</span><span class="an-go">›</span></button>`;
  const over = ln.rows.filter(r => r.st === 'over').length, fast = ln.rows.filter(r => r.st === 'fast').length;
  const note = over || fast ? [over ? `${over} ${plural(over, 'превышен', 'превышено', 'превышено')}` : '', fast ? `${fast} быстрее плана` : ''].filter(Boolean).join(' · ') : 'всё в пределах';
  const row = r => `<button type="button" class="reg lim ${r.st}" data-action="lim"><span class="rn">${esc(r.c)}</span><span class="ra">${fmt(Math.round(r.v))} <small>из ${fmt(r.lim)}</small></span><span class="bar"><i style="width:${Math.max(2, Math.min(100, r.v / r.lim * 100)).toFixed(1)}%"></i></span><span class="rw">${r.st === 'over' ? `перерасход ${fmt(Math.round(r.v - r.lim))} ${cur}` : `осталось ${fmt(Math.round(r.lim - r.v))} ${cur}` + (r.st === 'fast' ? ' · тратится быстрее, чем идёт месяц' : '')}</span></button>`;
  return `<details class="regs lims${over ? ' bad' : ''}" data-k="lims"${openAttr('lims')}><summary><span class="rs-t">Лимиты по категориям</span><span class="sec-note">${esc(note)}</span></summary><div class="stack">${ln.rows.map(row).join('')}</div>${ln.loose.length ? `<p class="note">Без лимита: ${esc(ln.loose.map(([c, v]) => c + ' ' + fmt(Math.round(v))).join(', '))} ${cur}</p>` : ''}<button type="button" class="link-btn" data-action="lim">Изменить лимиты</button></details>`;
}
function fullPeriodsBefore(start, n) {
  const since = moneyCfg().since, out = [];
  for (let p = periodShift(start, -1), k = 0; k < n; p = periodShift(p, -1), k++) {
    if (since && p < periodOf(since)) break;
    if (!periodMonths(p).every(mk => S.money[mk])) break;
    out.push(p);
  }
  return out;
}
// Подсказка: средние траты по категориям за прошлые месяцы, ужатые до бюджета «на жизнь» минус обычные наличные.
// Крупные разовые покупки в подсказку не идут: лимит — про обычные траты, а не про разовый телефон.
function livingByCatUsual(start, to) {
  const list = periodItems(start).filter(x => kindOf(x) === 'spend' && isLiving(x) && (!to || x.date <= to)), out = {};
  purchases(list).filter(q => q.amount < bigLim()).forEach(q => { out[q.cat] = (out[q.cat] || 0) + q.amount; });
  return out;
}
function suggestLimits() {
  const p = moneyPlan() || {}, t = today(), cur = periodOf(t), ps = fullPeriodsBefore(cur, 3);
  const k = daysBetween(cur, t), len = daysBetween(cur, periodEnd(cur)) + 1;
  const src = ps.map(q => ({ by: livingByCatUsual(q), w: 1, cash: sumAmt(periodItems(q).filter(x => kindOf(x) === 'cash')) }));
  if (k >= 7) src.push({ by: Object.fromEntries(Object.entries(livingByCatUsual(cur, addDays(t, -1))).map(([c, v]) => [c, v * len / k])), w: 1, cash: null });
  if (!src.length) return null;
  const avg = {};
  src.forEach(o => Object.entries(o.by).forEach(([c, v]) => { avg[c] = (avg[c] || 0) + v / src.length; }));
  const cs = src.filter(o => o.cash != null), cashAvg = cs.length ? cs.reduce((a, o) => a + o.cash, 0) / cs.length : 0;
  const target = Math.max(0, (Number(p.living) || 0) - cashAvg), total = Object.values(avg).reduce((a, v) => a + v, 0);
  const sc = total > target && total > 0 ? target / total : 1, out = {};
  Object.entries(avg).forEach(([c, v]) => { const x = Math.floor(v * sc / 100) * 100; if (x >= 300) out[c] = x; });
  return { limits: out, cashAvg: Math.round(cashAvg), target: Math.round(target), total: Math.round(total), periods: src.length };
}
async function openLimits() {
  const start = periodOf(today()), since = moneyCfg().since;
  const need = Array.from(new Set([1, 2, 3].flatMap(k => periodMonths(periodShift(start, -k))))).filter(mk => !since || mk >= monthKey(since));
  try { await ensureMoney(need); } catch (_) {}
  const L = limits(), sug = suggestLimits(), p = moneyPlan() || {}, cur = esc(curSym());
  const list = cats().filter(c => !(p.fixedCats || []).includes(c));
  S.cur = { type: 'limits', sug };
  openSheet(`<h2 class="sh-title">Лимиты на месяц</h2>
    <p class="sh-meta">Сколько можно потратить по категории за бюджетный месяц (с ${pStartDay()}-го). Аренда, связь и регулярные платежи сюда не входят. Пусто — без лимита.</p>
    ${sug ? `<button type="button" class="btn block" data-action="lim-suggest">Подставить по прошлым тратам</button><p class="note">Обычные траты на жизнь по карте (без крупных разовых покупок) — ~${fmt(sug.total)} ${cur} в месяц. Бюджет ${fmt(p.living || 0)} минус наличные ~${fmt(sug.cashAvg)} — на лимиты остаётся ${fmt(sug.target)} ${cur}${sug.total > sug.target ? ', поэтому подсказка урезана пропорционально' : ''}.</p>` : ''}
    <div class="lim-form">${list.map((c, i) => `<label class="lim-in" for="lm-${i}"><span>${esc(c)}</span><input id="lm-${i}" data-lim="${esc(c)}" inputmode="numeric" value="${esc(L[c] || '')}" placeholder="—"></label>`).join('')}</div>
    <p class="note" id="lim-sum"></p>
    <div class="sh-acts"><button type="button" class="btn money block" data-action="lim-save">Сохранить</button></div>`);
  limSum();
}
function limSum() {
  const el = document.getElementById('lim-sum'); if (!el) return;
  const p = moneyPlan() || {}, sug = S.cur && S.cur.sug, cur = curSym();
  let s = 0; document.querySelectorAll('[data-lim]').forEach(i => { s += numOrNull(i.value) || 0; });
  const room = (Number(p.living) || 0) - (sug ? sug.cashAvg : 0);
  el.textContent = `Сумма лимитов: ${fmt(Math.round(s))} ${cur}` + (p.living ? ` из ${fmt(Math.round(room))} ${cur} (бюджет на жизнь${sug ? ' минус наличные' : ''})` + (s > room ? ' — больше бюджета' : '') : '');
  el.classList.toggle('err', !!p.living && s > room);
}
document.addEventListener('input', e => { if (e.target && e.target.dataset && 'lim' in e.target.dataset) limSum(); });
function limSuggestFill() { const sug = S.cur && S.cur.sug; if (!sug) return; document.querySelectorAll('[data-lim]').forEach(i => { i.value = sug.limits[i.dataset.lim] || ''; }); limSum(); }
async function limitsSave() {
  const L = {}; document.querySelectorAll('[data-lim]').forEach(i => { const v = numOrNull(i.value); if (v > 0) L[i.dataset.lim] = Math.round(v); });
  const ok = await writeConfig(c => { c.money = c.money || {}; if (Object.keys(L).length) c.money.limits = L; else delete c.money.limits; }, `Деньги: лимиты по категориям (${Object.keys(L).length})`);
  if (ok) { closeSheet(); toast(Object.keys(L).length ? 'Лимиты сохранены' : 'Лимиты убраны'); }
}

/* ---------- похожее на регулярные платежи: повторы с той же суммой примерно в тот же день ---------- */
const recKey = x => norm(x.name).replace(/[0-9№#*•.,:;!?()«»"'\/\\+\-–—]+/g, ' ').replace(/\s+/g, ' ').trim();
function recurringGuess() {
  const since = moneyCfg().since || '0000', no = new Set(moneyCfg().notRegular || []);
  const list = Object.values(S.money).flatMap(m => (m && m.items) || []).filter(x => x.date >= since
    && (kindOf(x) === 'spend' || (kindOf(x) === 'transfer' && x.dir !== 'in' && !['Свои счета', 'Накопления', 'Долги'].includes(x.cat)))
    && !x.group && !regularOf(x));
  const by = {};
  list.forEach(x => { const k = recKey(x); if (k.length >= 3) (by[k] = by[k] || []).push(x); });
  const out = [];
  for (const [k, xs] of Object.entries(by)) {
    if (no.has(k) || xs.length < 2) continue;
    const per = {}; xs.forEach(x => { const p = periodOf(x.date); per[p] = (per[p] || 0) + 1; });
    const ps = Object.keys(per);
    if (ps.length < 2 || Object.values(per).some(n => n > 2)) continue;
    const amts = xs.map(x => Number(x.amount) || 0), med = median(amts);
    if (!(med >= 50) || amts.some(a => Math.abs(a - med) > Math.max(50, med * 0.15))) continue;
    const days = xs.map(x => pd(x.date).getDate()), dmed = Math.round(median(days));
    if (days.some(d => Math.min(Math.abs(d - dmed), 31 - Math.abs(d - dmed)) > 6)) continue;
    const last = xs.slice().sort((a, b) => a.date < b.date ? 1 : -1)[0];
    out.push({ k, name: last.name, amount: Math.round(med), day: dmed, cat: last.cat || otherCat(), n: xs.length, last: last.date });
  }
  return out.sort((a, b) => b.amount - a.amount).slice(0, 8);
}
function recurringHtml() {
  if (!S.ready || !S.config) return '';
  const l = S.recur = recurringGuess(); if (!l.length) return '';
  return `<button type="button" class="anom" data-action="rec"><span class="an-ic">${ico('warn')}</span><span class="an-t">${l.length} ${plural(l.length, 'платёж похож', 'платежа похожи', 'платежей похожи')} на подписку</span><span class="an-go">›</span></button>`;
}
function openRecurring() {
  const l = recurringGuess(), cur = esc(curSym());
  S.cur = { type: 'rec' };
  openSheet(`<h2 class="sh-title">Похоже на регулярные платежи</h2><p class="sh-meta">Одна и та же сумма примерно в один и тот же день в разные месяцы. Если это подписка — добавь в регулярные: она перестанет съедать бюджет на жизнь и появится в прогнозе. Если ненужная — самое время отменить.</p>
    <div class="stack" style="margin-top:12px">${l.length ? l.map(o => `<div class="an-row"><b>${esc(o.name)} — ~${fmt(o.amount)} ${cur}</b><span>около ${o.day}-го · ${o.n} ${plural(o.n, 'раз', 'раза', 'раз')}, последний ${esc(short(o.last))} · ${esc(o.cat)}</span><span class="acct-links"><button type="button" class="link-btn" data-action="rec-add" data-k="${esc(o.k)}">В регулярные</button><button type="button" class="link-btn" data-action="rec-no" data-k="${esc(o.k)}">Не регулярный</button></span></div>`).join('') : '<p class="note">Ничего похожего не нашёл.</p>'}</div>`);
}
async function recurringNo(k) {
  const ok = await writeConfig(c => { c.money = c.money || {}; const l = c.money.notRegular = c.money.notRegular || []; if (!l.includes(k)) l.push(k); }, 'Деньги: не регулярный платёж');
  if (ok) { const l = recurringGuess(); if (l.length) openRecurring(); else { closeSheet(); toast('Готово'); } }
}
function moneyPlanHtml() { return forecastHtml() + budgetHtml() + limitsHtml() + anomHtml(S.ready ? (S.anom = anomalies()) : []) + recurringHtml(); }
function goalsBlockHtml() {
  if (!S.ready || !S.config) return '';
  const sim = simulatePlan(), cur = esc(curSym());
  let h = '';
  const gl = goals();
  if (gl.length) h += `<div class="sec-row"><h2 class="sec">Цели</h2>${sim ? `<span class="sec-note">свободно ~${fmt(Math.round(sim.free))} ${cur}/мес</span>` : ''}</div><div class="stack">${gl.map(g => goalHtml(g, sim)).join('')}</div>`;
  const rg = regulars();
  h += plannedHtml();
  if (rg.length) {
    const t = today();
    const rows = rg.slice().sort((a, c) => (nextDue(a) || '9') < (nextDue(c) || '9') ? -1 : 1).map(r => {
      const nd = nextDue(r), paid = regularPaid(r);
      const when = paid ? 'оплачено ✓' : nd ? (nd === t ? 'сегодня' : daysBetween(t, nd) === 1 ? 'завтра' : `${dm(nd)} · через ${daysBetween(t, nd)} ${plural(daysBetween(t, nd), 'день', 'дня', 'дней')}`) : 'дата не задана';
      return `<button type="button" class="reg" data-action="reg" data-id="${esc(r.id)}"><span class="rn">${esc(r.name)}</span><span class="ra">${fmt(r.amount)} ${cur}</span><span class="rw${paid ? ' ok' : ''}">${r.day ? esc(r.day) + '-го · ' : ''}${esc(when)}</span></button>`;
    }).join('');
    const soon = rg.filter(r => { const nd = nextDue(r); return nd && !regularPaid(r) && daysBetween(t, nd) <= 3; }).length;
    h += `<details class="regs" data-k="regs"${openAttr('regs')}><summary><span class="rs-t">Регулярные платежи</span><span class="sec-note">${fmt(regularTotal())} ${cur}/мес${soon ? ` · ${soon} скоро` : ''}</span></summary><div class="stack">${rows}</div><button type="button" class="link-btn" data-action="reg-new">+ Платёж</button></details>`;
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
    <div class="kv"><span>Зарплата</span><span class="v">${fmt(p.salary || 0)}</span><span>Регулярные платежи</span><span class="v">−${fmt(reg)}</span><span>На жизнь</span><span class="v">−${fmt(p.living || 0)}</span><span class="sum">${demo() ? 'Свободно на цели' : 'Свободно на долги и цели'}</span><span class="v sum${free >= 0 ? ' pos' : ''}">${free >= 0 ? '' : '−'}${fmt(Math.abs(free))}</span></div>
    <div class="sh-acts"><button type="button" class="btn money block" data-action="budget-save">Сохранить</button></div>`);
}
async function budgetSave() {
  const living = numOrNull($('#bg-living').value), salary = numOrNull($('#bg-salary').value);
  if (!(living > 0)) { toast('Впиши сумму на жизнь'); return; }
  const ok = await writeConfig(c => { c.money = c.money || {}; c.money.plan = Object.assign({ fixedCats: ['Жильё и связь'] }, c.money.plan || {}, { living: Math.round(living) }, salary > 0 ? { salary: Math.round(salary) } : {}); }, `Деньги: бюджет на жизнь ${Math.round(living)}`);
  if (ok) { closeSheet(); toast('Бюджет сохранён'); }
}
function openRegular(id, preset) {
  const r = id ? regulars().find(x => x.id === id) : Object.assign({ id: null, name: '', amount: '', day: '', cat: otherCat() }, preset || {});
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
    ${g.type === 'debt' ? `<div class="two"><div><label class="fld" for="gl-grace">Без процентов до</label><input type="date" id="gl-grace" value="${esc((a && a.graceUntil) || '')}"></div><div><label class="fld" for="gl-ins">Страховка, ₽/мес</label><input id="gl-ins" inputmode="decimal" value="${esc((a && a.insurance) || '')}"></div></div>` : ''}
    
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
    if (a && $('#gl-grace')) { const gv = $('#gl-grace').value; if (gv) a.graceUntil = gv; else delete a.graceUntil; const iv = numOrNull($('#gl-ins').value); if (iv > 0) a.insurance = Math.round(iv * 100) / 100; else delete a.insurance; }
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
  const c = pfStats(), ach = achievements(c);
  const fresh = newAchievements(ach).length;
  return `<button type="button" class="pf-card" data-action="pf-open"><span class="pf-top"><span class="pf-lvl">${c.lvl}</span>${fresh ? `<span class="pf-new">+${fresh} 🏆</span>` : ''}</span><span class="pf-rt"><b>${esc(c.rank)}</b><small>${fmt(c.xp)} XP${c.next ? ' · ещё ' + fmt(c.to - c.xp) : ''}</small></span><span class="bar pf-bar"><i style="width:${c.pctLvl.toFixed(1)}%"></i></span></button>`;
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
  void fresh;
  // сообщаем об ачивке один раз: запоминаем, о каких уже сказали
  const lv = LS.get('bj-lvl'), told = LS.get('bj-ach-told'), toldSet = new Set(told || []);
  const news = ach.filter(a => a.ok && !toldSet.has(a.id));
  if (lv != null && c.lvl > lv) toast(`🎖 Новое звание: ${c.rank}! Уровень ${c.lvl}`);
  else if (told && news.length) toast(news.length === 1 ? `🏆 Ачивка: ${news[0].t}` : `🏆 Новые ачивки: ${news.length} — загляни в портфолио`);
  LS.set('bj-ach-told', ach.filter(a => a.ok).map(a => a.id));
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
    if (S.tab === 'lessons') renderLessons(); else S.dirty.add('lessons');
    announceAchievements();
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
  const cv = demo() ? null : reviewFor(type, r.from);
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
  if (demo()) return '';
  const r = latestReview();
  const seen = new Set(LS.get('bj-seen-rev') || []);
  if (r && !seen.has(r.id) && daysBetween(r.to, today()) <= 10) {
    const first = String(r.text || '').replace(/[#*_>`]/g, '').split('\n').map(x => x.trim()).filter(Boolean)[0] || '';
    void first;
    return `<button type="button" class="pill-card rev" data-action="rev-open" data-type="${esc(r.type)}" data-from="${esc(r.from)}"><span class="cf-dot" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2.5c.5 4.6 2.4 6.5 7 7-4.6.5-6.5 2.4-7 7-.5-4.6-2.4-6.5-7-7 4.6-.5 6.5-2.4 7-7z" fill="currentColor"/></svg></span><span class="pc-t">Разбор ${esc(REV_G[r.type] || '')}</span><span class="pc-s">${esc(revLabel(r.type, r))}</span><span class="pc-go">›</span></button>`;
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
  return `<div class="callout notes-rem"><b>Отправь заметки с урока</b><div class="acts" style="margin-top:8px"><button type="button" class="btn sm study" data-action="notes-check">Отправил</button><button type="button" class="btn sm" data-action="notes-skip">Сегодня без заметок</button></div><details class="how"><summary>как</summary>GitHub Desktop → <b>Summary</b> слева внизу («${L ? 'Урок ' + esc(L.n) + (L.title ? ' ' + esc(L.title) : '') : 'Урок'}») → <b>Commit to main</b> → вверху <b>Push origin</b>. Если там <b>Pull origin</b> — сначала её.</details></div>`;
}
function renderPlan() {
  const bn = $('#plan-banner'), st = $('#plan-stats'), tl = $('#plan-tails'), dy = $('#plan-days');
  renderSleep();
  if (!isReady()) { bn.innerHTML = bannerHtml(); st.innerHTML = tl.innerHTML = dy.innerHTML = ''; return; }
  const banners = notesReminderHtml() + reviewCardHtml(); bn.innerHTML = '';
  const study = buildStudy(); S.studyCache = study;
  const sport = buildSport(); S.sportList = sport;
  const t = today();
  st.innerHTML = statsRowHtml(sport);
  const spT = sport.filter(i => !i.state && i.eff < t && i.eff >= addDays(t, -14));
  const stT = studyTails(7);
  if (spT.length || stT.length) {
    const items = stT.map(d => ({ d, type: 'st' })).concat(spT.map(i => ({ d: i.eff, type: 'sp', i }))).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
    tl.innerHTML = `<div class="sec-row tails-h"><h2 class="sec">Не отмечено</h2><span class="sec-note">${items.length}</span></div><div class="stack">${items.map(it => it.type === 'st'
      ? `<div class="tail"><span class="tag study">Учёба</span><span class="tl-t">Окно ${esc(slotLabel(it.d, studyCap(it.d)))}<small>${short(it.d)}</small></span><span class="tl-a"><button type="button" class="ib ok" data-action="st-tail-done" data-date="${it.d}" aria-label="Был урок">✓</button><button type="button" class="ib no" data-action="st-tail-skip" data-date="${it.d}" aria-label="Пропустил">✕</button></span></div>`
      : `<div class="tail"><span class="tag sport">Спорт</span><button type="button" class="tl-t" data-action="sport" data-id="${esc(it.i.id)}">${esc(it.i.title)}<small>${short(it.d)}</small></button><span class="tl-a"><button type="button" class="ib ok" data-action="sp-done" data-id="${esc(it.i.id)}" aria-label="Сделал">✓</button><button type="button" class="ib no" data-action="sp-skip" data-id="${esc(it.i.id)}" aria-label="Пропустил">✕</button></span></div>`).join('')}</div>`;
  } else tl.innerHTML = '';
  const dayHtml = (d, k) => {
    const rows = dayRows(d, study, sport);
    const dd = k <= 1 ? short(d) : dm(d);
    return `<section class="day${k === 0 ? ' is-today' : ''}${holiday(d) ? ' hol' : ''}"><div class="day-h"><span class="dn">${dayName(d)}</span><span class="dd">${dd}</span><button type="button" class="more" data-action="day" data-date="${d}" aria-label="День ${short(d)}">${DOTS}</button></div>${rows.length ? `<div class="stack">${rows.join('')}</div>` : '<p class="empty-day">Свободный день</p>'}</section>`;
  };
  let rest = '';
  for (let k = 2; k <= HORIZON; k++) {
    const d = addDays(t, k);
    if (dow(d) === 1) rest += `<div class="week-sep"><span>Неделя ${dm(d)} – ${dm(addDays(d, 6))}</span></div>`;
    rest += dayHtml(d, k);
  }
  const end = addDays(t, HORIZON);
  // главное — дела на сегодня; всё остальное ниже и свёрнуто
  st.innerHTML += todayCardHtml(t, study, sport, true);
  dy.innerHTML = banners + todayCardHtml(addDays(t, 1), study, sport, false)
    + `<div class="sec-row plan-acts"><span class="acts">${shopBtnHtml()}<button type="button" class="btn sm" data-action="ev-new">+ Событие</button></span></div>`
    + `<details class="fold days-more" data-k="plan-more"${openAttr('plan-more')}><summary><span>Дальше</span><span class="sec-note">до ${dm(end)} · ${HORIZON - 1} ${plural(HORIZON - 1, 'день', 'дня', 'дней')}</span></summary>${rest}</details>`
    + `<details class="fold" data-k="plan-q"${openAttr('plan-q')}><summary><span>Цели квартала</span></summary>${quarterHtml()}</details>`;
}


/* ---------- главный экран: короткие показатели в ряд + дела на день крупно ---------- */
function statsRowHtml(sport) {
  const t = today(), s = (S.sleep.days || {})[t], m = sleepMin(s);
  const r = readiness(t), st = streakInfo() || { cur: 0 }, w = weekProgress(sport);
  const it = [
    ['sleep', 'moon', m ? hmClock(m) : '—', 'сон', `data-date="${sleepTarget()}"`, 'c-sleep'],
    ['ready', 'bolt', String(r.score), 'готовность', '', 'lvl-' + r.level],
    ['streak', 'flame', String(st.cur), 'дней подряд', '', st.cur ? 'c-streak' : 'off'],
    ['rev-open', 'target', w.done + '/' + w.plan, 'дела недели', 'data-type="week"', 'c-week'],
  ];
  return `<div class="mini-stats">${it.map(([a, i, v, lab, ex, cls]) => `<button type="button" class="ms ${cls}" data-action="${a}" ${ex} aria-label="${esc(lab)}: ${esc(v)}">${ico(i)}<b>${esc(v)}</b></button>`).join('')}</div>`;
}
// дела дня: учёба, спорт, события-дела; крупно, по одному пункту, нажатие раскрывает подробности
function todayItems(d, study, sport) {
  const out = [];
  let si = 0; const sk = () => 'study' + (si++);
  S.lessons.filter(l => l.done === d).forEach(l => out.push({ k: 'study', ok: sk(), key: 'ld-' + l.id, title: 'Урок ' + l.n, sub: l.title || '', done: true, open: `data-action="lesson" data-id="${esc(l.id)}"`, more: lessonMore(l) }));
  (study.byDate[d] || []).filter(e => !e.blocked).forEach(e => out.push({ k: 'study', ok: sk(), key: 'st-' + e.L.key + '-' + e.part, title: e.L.placeholder ? 'Учёба' : 'Урок ' + e.L.n, sub: [e.L.title, slotLabel(e.date, { cap: e.cap, extra: e.extra }), e.total > 1 ? 'часть ' + e.part + ' из ' + e.total : ''].filter(Boolean).join(' · '), done: false,
    open: `data-action="study" data-date="${e.date}" data-key="${esc(e.L.key)}" data-part="${e.part}"`, openLabel: 'Открыть урок', more: e.L.doc ? lessonMore(e.L.doc) : '' }));
  sport.filter(i => i.eff === d).forEach(i => out.push({ k: 'sport', ok: 'sp-' + i.id, key: 'sp-' + i.id, title: sportShort(i), sub: i.state === 'other' ? (i.note || 'сделал другое') : i.sub, done: i.state === 'done' || i.state === 'other', skipped: i.state === 'skipped',
    open: `data-action="sport" data-id="${esc(i.id)}"`, openLabel: 'Открыть тренировку', chk: i.state ? '' : `data-action="sp-done" data-id="${esc(i.id)}"`, more: sportMore(i) }));
  eventsOn(d).forEach(o => out.push({ k: 'ev', ok: 'ev-' + o.ev.id, key: 'ev-' + o.ev.id, title: o.ev.title, sub: [o.ev.time || '', repeatLabel(o.ev.repeat) ? '↻ ' + repeatLabel(o.ev.repeat) : ''].filter(Boolean).join(' · '), done: o.done,
    open: `data-action="event" data-id="${esc(o.ev.id)}" data-date="${d}"`, openLabel: 'Изменить', chk: `data-action="td-ev" data-id="${esc(o.ev.id)}" data-date="${d}"` }));
  out.forEach((x, n) => { x.n = n; });
  // свой порядок дня (перетащил удержанием): идёт как день, сделанное остаётся на месте; новое — в конец
  const ord = (S.dayOrder || {})[d];
  if (Array.isArray(ord) && ord.length) {
    const pos = new Map(ord.map((k, j) => [k, j])), at = x => pos.has(x.ok) ? pos.get(x.ok) : 1000 + x.n;
    return out.sort((a, b) => at(a) - at(b));
  }
  const rank = x => x.done || x.skipped ? 1 : 0;
  return out.sort((a, b) => rank(a) - rank(b) || a.n - b.n);
}
async function saveDayOrder(d, keys) {
  const lim = addDays(today(), -14);
  S.dayOrder = Object.assign({}, S.dayOrder, { [d]: keys });
  return writePlan(p => {
    const o = p.dayOrder = p.dayOrder || {};
    o[d] = keys;
    Object.keys(o).forEach(k => { if (k < lim) delete o[k]; });
  }, `Дела ${d}: свой порядок`);
}
function sportShort(i) { return i.kind === 'cardio' ? 'Спорт · кардио' : 'Спорт · ' + String(i.title || '').replace(/^Силовая\s*·\s*/i, '').replace(/\s*\(.*\)$/, ''); }
function lessonMore(l) {
  const g = Array.isArray(l.goals) ? l.goals.slice(0, 3) : [];
  return (l.outcome ? `<p>${esc(l.outcome)}</p>` : '') + (g.length ? `<ul>${g.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
}
function sportMore(i) {
  try {
    const ses = sessionFor(i);
    const names = [];
    (ses.blocks || []).forEach(b => (b.ex || []).forEach(x => { if (!/^бассейн$/i.test(x.name)) names.push(x.name); }));
    return names.length ? `<ul>${names.slice(0, 8).map(n => `<li>${esc(n)}</li>`).join('')}${names.length > 8 ? `<li>и ещё ${names.length - 8}</li>` : ''}</ul>` : '';
  } catch (_) { return ''; }
}
function todayCardHtml(d, study, sport, big) {
  const items = todayItems(d, study, sport);
  const done = items.filter(x => x.done).length;
  const extra = scheduleRows(d).concat(regularRows(d), plannedRows(d), dateRows(d), graceRows(d));
  const rest = restDay(d) && !items.some(x => x.k !== 'ev');
  const key = 'td-' + d;
  const head = `<div class="td-h"><span class="td-d">${big ? 'Сегодня' : 'Завтра'}<small>${esc(longDate(d))}${restDay(d) ? ' · чистый день' : ''}</small></span>${items.length ? `<span class="td-n">${done} из ${items.length}</span>` : ''}<button type="button" class="more" data-action="day" data-date="${d}" aria-label="День ${short(d)}">${DOTS}</button></div>`;
  const bar = items.length && big ? `<div class="td-bar"><i style="width:${(done / items.length * 100).toFixed(0)}%"></i></div>` : '';
  const list = items.map(x => {
    const id = key + '-' + x.key, open = S.open.has(id);
    const chk = x.done ? '<span class="td-c on">✓</span>' : x.skipped ? '<span class="td-c x">–</span>' : x.chk ? `<button type="button" class="td-c" ${x.chk} aria-label="Отметить: ${esc(x.title)}"></button>` : `<button type="button" class="td-c" ${x.open} aria-label="${esc(x.title)}"></button>`;
    return `<div class="td-i k-${x.k}${x.done ? ' done' : ''}${x.skipped ? ' skipped' : ''}${open ? ' open' : ''}" data-sort-item data-ok="${esc(x.ok)}">${chk}<button type="button" class="td-m" data-action="td-x" data-k="${esc(id)}" aria-expanded="${open}"><span class="td-t">${esc(x.title)}</span>${x.sub ? `<span class="td-s">${esc(x.sub)}</span>` : ''}</button>
      <div class="td-more"${open ? '' : ' hidden'}>${x.more || ''}<button type="button" class="btn sm${x.k === 'sport' ? ' sport' : x.k === 'study' ? ' study' : ''}" ${x.open}>${esc(x.openLabel || 'Открыть')}</button></div></div>`;
  }).join('');
  const empty = !items.length ? `<p class="td-empty">${rest ? 'Чистый день — без учёбы и спорта. Обнулиться.' : 'Дел нет.'}</p>` : '';
  const add = big ? `<form class="td-add" data-date="${d}" autocomplete="off"><input class="td-add-in" placeholder="+ дело на сегодня" enterkeyhint="done" autocapitalize="sentences" aria-label="Новое дело на сегодня"></form>` : '';
  return `<section class="td${big ? ' big' : ''}">${head}${bar}<div class="td-list" data-sort="td" data-date="${d}">${list}</div>${empty}${add}${extra.length ? `<div class="stack td-extra">${extra.join('')}</div>` : ''}</section>`;
}
async function tdEventToggle(id, d) {
  const e = S.events.find(x => x.id === id); if (!e) return;
  const was = Array.isArray(e.done) && e.done.includes(d);
  await writeEvents(list => { const x = list.find(y => y.id === id); if (!x) return; const set = new Set(x.done || []); if (set.has(d)) set.delete(d); else set.add(d); x.done = Array.from(set).sort(); if (!x.done.length) delete x.done; }, `Дела: «${e.title}» ${d} — ${was ? 'снята отметка' : 'сделано'}`);
}
async function tdAdd(d, title) {
  title = String(title || '').trim(); if (!title) return;
  const ok = await writeEvents(list => { list.push({ id: rid(), date: d, title }); }, `Дела на ${d}: ${title.slice(0, 50)}`);
  if (ok) toast('Добавил: ' + title);
}

/* ---------- перестановка удержанием ---------- */
// Зажал пункт ~0,35 с → он поднимается, тянешь вверх-вниз, отпускаешь — новый порядок.
// Список — [data-sort], пункты — его прямые дети [data-sort-item]; если у пункта есть [data-sort-handle], тянуть только за него.
const DRAG = { st: null, lift: false, tm: 0, until: 0 };
function dragFind(t) {
  if (!t || !t.closest || t.closest('input, textarea, select, .sb, .td-c, .icon-btn, .btn, a, .swap-form')) return null;
  const item = t.closest('[data-sort-item]'); if (!item) return null;
  const list = item.parentElement; if (!list || !list.hasAttribute('data-sort')) return null;
  if (item.querySelector('[data-sort-handle]') && !t.closest('[data-sort-handle]')) return null;
  return { item, list };
}
function dragDown(t, x, y) {
  dragReset();
  const f = dragFind(t); if (!f) return;
  DRAG.st = Object.assign(f, { x, y });
  DRAG.tm = setTimeout(dragLift, 350);
}
function dragLift() {
  const s = DRAG.st; if (!s || !s.item.isConnected) { dragReset(); return; }
  const g0 = s.item.getBoundingClientRect();
  s.sc = s.list.closest('.sheet-panel') || document.scrollingElement || document.documentElement;
  s.sc.classList.add('no-anchor');
  s.list.classList.add('sorting');
  dragKeep(s.sc, s.item, g0.top);
  s.items = Array.from(s.list.children).filter(el => el.hasAttribute('data-sort-item'));
  if (s.items.length < 2) { dragReset(); return; }
  s.from = s.to = s.items.indexOf(s.item);
  s.rects = s.items.map(el => { const r = el.getBoundingClientRect(); return { top: r.top, h: r.height }; });
  s.grab = Math.max(8, Math.min(s.y - g0.top, s.rects[s.from].h - 8));
  const r0 = s.rects[0], r1 = s.rects[1];
  s.step = s.rects[s.from].h + Math.max(0, r1.top - (r0.top + r0.h));
  DRAG.lift = true;
  s.item.classList.add('lifted');
  try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {}
  dragMove(s.y);
}
function dragMove(y) {
  const s = DRAG.st; if (!s || !DRAG.lift) return;
  const me = s.rects[s.from], top = y - s.grab, mid = top + me.h / 2;
  let k = 0;
  s.rects.forEach((r, j) => { if (j !== s.from && r.top + r.h / 2 < mid) k++; });
  s.to = k;
  s.items.forEach((el, j) => {
    if (j === s.from) { el.style.transform = `translateY(${top - me.top}px) scale(1.02)`; return; }
    const sh = s.from < k && j > s.from && j <= k ? -s.step : k < s.from && j >= k && j < s.from ? s.step : 0;
    el.style.transform = sh ? `translateY(${sh}px)` : '';
  });
}
// свернул/развернул содержимое списка — прокрутить так, чтобы пункт остался под пальцем
function dragKeep(sc, el, top0) {
  const d = el.getBoundingClientRect().top - top0;
  if (sc && d) sc.scrollTop += d;
}
function dragEnd() {
  const s = DRAG.st, lifted = DRAG.lift;
  if (lifted && s) {
    DRAG.until = Date.now() + 450;
    const items = s.items.slice(); const [m] = items.splice(s.from, 1); items.splice(s.to, 0, m);
    if (s.to !== s.from) items.forEach(el => s.list.appendChild(el));
    const done = s.to !== s.from ? items : null, list = s.list, el = s.item, sc = s.sc;
    items.forEach(x => { x.style.transform = ''; });
    const t0 = el.getBoundingClientRect().top;
    dragReset();
    dragKeep(sc, el, t0);
    if (sc) sc.classList.add('no-anchor');
    if (done) dragDone(list, done);
    return;
  }
  dragReset();
}
function dragReset() {
  clearTimeout(DRAG.tm);
  const s = DRAG.st;
  if (s) { (s.items || []).forEach(el => { el.style.transform = ''; el.classList.remove('lifted'); }); s.list.classList.remove('sorting'); if (s.sc && !DRAG.lift) s.sc.classList.remove('no-anchor'); }
  DRAG.st = null; DRAG.lift = false;
}
function dragDone(list, items) {
  const kind = list.dataset.sort;
  setTimeout(() => document.querySelectorAll('.no-anchor').forEach(x => x.classList.remove('no-anchor')), 600);
  if (kind === 'td') saveDayOrder(list.dataset.date, items.map(el => el.dataset.ok));
  else if (kind === 'wk') {
    const c = S.cur; if (!c || c.type !== 'sport') return;
    clearTimeout(draftT); const lg = collectLog(c.ses); if (lg.any) LS.set('bj-draft-' + c.id, { blocks: lg.blocks });
    LS.set('bj-wkord-' + c.id, items.map(el => Number(el.dataset.bi)));
    rerenderWk();
  }
}
document.addEventListener('touchstart', e => { if (e.touches.length !== 1) { dragReset(); return; } const t = e.touches[0]; dragDown(e.target, t.clientX, t.clientY); }, { passive: true });
document.addEventListener('touchmove', e => {
  const s = DRAG.st; if (!s) return;
  const t = e.touches[0];
  if (!DRAG.lift) { if (Math.abs(t.clientY - s.y) > 10 || Math.abs(t.clientX - s.x) > 10) dragReset(); return; }
  e.preventDefault(); dragMove(t.clientY);
}, { passive: false });
document.addEventListener('touchend', dragEnd);
document.addEventListener('touchcancel', dragReset);
document.addEventListener('mousedown', e => { if (e.button === 0 && !e.sourceCapabilities?.firesTouchEvents) dragDown(e.target, e.clientX, e.clientY); });
document.addEventListener('mousemove', e => {
  const s = DRAG.st; if (!s) return;
  if (!DRAG.lift) { if (Math.abs(e.clientY - s.y) > 10 || Math.abs(e.clientX - s.x) > 10) dragReset(); return; }
  e.preventDefault(); dragMove(e.clientY);
});
document.addEventListener('mouseup', () => { if (DRAG.st) dragEnd(); });
document.addEventListener('contextmenu', e => { if (DRAG.st) e.preventDefault(); });
// после перетаскивания не нажимать то, над чем отпустил палец
document.addEventListener('click', e => { if (Date.now() < DRAG.until) { e.preventDefault(); e.stopPropagation(); } }, true);

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
    <details class="fold legend-f" data-k="cal-legend"${openAttr('cal-legend')}><summary><span>Обозначения</span></summary><div class="legend"><span><span class="mk sport">✓</span>сделано</span><span><span class="mk sport plan">→</span>перенесено</span><span><span class="mk sport x">✕</span>пропуск</span><span><span class="mk sport plan"></span>по плану</span><span><span class="mk study">✓</span>учёба</span><span><span class="mk ev"></span>событие</span><span><span class="lg-hol">7</span>праздник</span><span><span class="cal-duty">Н</span>наряд</span><span><span class="mk sport plan">?</span>нет отметки</span></div></details>`;
}

function lessonRow(l, study) {
  const f = study.first[l.id];
  const meta = [Number(l.need) === 90 ? '1,5 ч' : Number(l.need) === 60 ? '1 ч' : 'одно окно'];
  if (l.progress) meta.push('сделано ' + dur(l.progress));
  if (Array.isArray(l.goals) && l.goals.length) meta.push(l.goals.length + ' ' + plural(l.goals.length, 'вопрос', 'вопроса', 'вопросов'));
  return `<button type="button" class="row" data-action="lesson" data-id="${esc(l.id)}"><span class="ln">${esc(l.n)}</span><span class="rb"><span class="t">${esc(l.title || 'Тема не задана')}</span><span class="m">${esc(meta.join(' · '))}</span></span><span class="s">${f ? short(f) : 'позже'}</span></button>`;
}
function renderLessons() {
  const nx = $('#lessons-next'), sl = $('#lessons-slots'), dn = $('#lessons-done'), bn = $('#lessons-banner');
  if (!isReady()) { bn.innerHTML = bannerHtml(); nx.innerHTML = sl.innerHTML = dn.innerHTML = ''; S.slotsSig = ''; return; }
  bn.innerHTML = '';
  const pfc = $('#pf-card'); if (pfc) pfc.innerHTML = pfCardHtml();
  const enc = $('#en-card'); if (enc) enc.innerHTML = enCardHtml();
  const bkc = $('#bk-card'); if (bkc) bkc.innerHTML = bookCardHtml();
  const study = S.studyCache || buildStudy();
  const pend = pendingSorted();
  const hero = $('#lesson-hero');
  if (hero) {
    const L = pend[0], f = L ? study.first[L.id] : null, tm = timerState();
    hero.innerHTML = L ? `<div class="l-hero"><span class="lh-k">${tm ? 'Идёт урок' : 'Следующий урок' + (f ? ' · ' + (f === today() ? 'сегодня' : short(f)) : '')}</span><span class="lh-t"><b>${esc(L.n)}</b>${esc(L.title || 'Тема не задана')}</span><span class="lh-m">${esc([Number(L.need) === 90 ? '1,5 ч' : '1 ч', Array.isArray(L.goals) && L.goals.length ? L.goals.length + ' ' + plural(L.goals.length, 'вопрос', 'вопроса', 'вопросов') : '', L.progress ? 'сделано ' + dur(L.progress) : ''].filter(Boolean).join(' · '))}</span><span class="acts"><button type="button" class="btn study" data-action="focus-start" data-n="${esc(L.n)}">${ico('play')}${tm ? 'Вернуться' : 'Начать'}</button><button type="button" class="btn" data-action="lesson" data-id="${esc(L.id)}">Вопросы</button></span></div>` : '';
  }
  const rest = pend.slice(1);
  nx.innerHTML = rest.length
    ? rest.slice(0, 3).map(l => lessonRow(l, study)).join('')
      + (rest.length > 3 ? `<details class="fold" data-k="l-queue"${openAttr('l-queue')}><summary><span>Вся очередь</span><span class="sec-note">ещё ${rest.length - 3}</span></summary><div class="stack">${rest.slice(3).map(l => lessonRow(l, study)).join('')}</div></details>` : '')
    : '<p class="note">Дальше — уроки без темы.</p>';
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
      const blobs = (j.tree || []).filter(x => x.type === 'blob' && /\.md$/i.test(x.path) && x.path.startsWith(pre) && !/(^|\/)\.(obsidian|trash|git)\//.test(x.path));
      const files = blobs.map(x => x.path), shas = {}; blobs.forEach(x => { shas[x.path] = x.sha; });
      S.notes = { files, pre, shas, src: src.repo + '/' + src.path };
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
  const mg = $('#money-goals'); if (mg) mg.innerHTML = goalsBlockHtml();
  renderDayChip();
  ib.innerHTML = S.inbox.length ? `<div class="inbox">Фото ждут разбора: <b>${S.inbox.length}</b></div>` : '';
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
  let html = `<div class="total-block"><div class="total-k">Потрачено</div><div class="total">${fmt(Math.round(spend))}<span class="cur">${esc(cur)}</span></div><div class="total-sub">${spend ? `в среднем ${fmt(Math.round(spend / Math.max(1, days)))} ${esc(cur)} в день` : 'трат пока нет'}</div></div>`;
  if (income || cash || Object.keys(trCats).length) {
    const sig = v => (v >= 0 ? '+' : '−') + fmt(Math.abs(v));
    html += `<details class="fold" data-k="m-kv"${openAttr('m-kv')}><summary><span>Доход и переводы</span><span class="sec-note${bal >= 0 ? ' pos' : ''}">итог ${sig(Math.round(bal))}</span></summary><div class="kv"><span>Доход</span><span class="v pos">+${fmt(income)}</span>`
      + `<span>Траты</span><span class="v">−${fmt(spend)}</span>`
      + (cash ? `<span>Наличные</span><span class="v">−${fmt(cash)}</span>` : '')
      + Object.entries(trCats).sort((a, b) => a[1] - b[1]).map(([c, v]) => `<span>${esc(trLabel(c, v))}</span><span class="v">${sig(v)}</span>`).join('')
      + `<span class="sum">Итог периода</span><span class="v sum${bal >= 0 ? ' pos' : ''}">${sig(bal)}</span></div></details>`
      + (trCats['Не разобрано'] ? '' : '')
      + '';
  }
  const catRow = ([c, v]) => `<div class="cat"><span class="cn">${esc(c)}</span><span class="ca">${fmt(Math.round(v))}<span class="pc">${Math.round(v / spend * 100)}%</span></span><span class="bar"><i style="width:${Math.max(2, v / max * 100).toFixed(1)}%"></i></span></div>`;
  if (rows.length && spend > 0) html += `<h2 class="sec">Траты по категориям</h2><div class="cats">${rows.slice(0, 5).map(catRow).join('')}</div>${rows.length > 5 ? `<details class="fold" data-k="m-cats"${openAttr('m-cats')}><summary><span>Остальные категории</span><span class="sec-note">${rows.length - 5}</span></summary><div class="cats">${rows.slice(5).map(catRow).join('')}</div></details>` : ''}`;
  html += spendChartHtml();
  if (trRows.length) html += `<details class="fold" data-k="m-tr"${openAttr('m-tr')}><summary><span>Куда ушли переводы</span><span class="sec-note">${trRows.length}</span></summary><div class="kv">${trRows.map(([n, v]) => `<span>${esc(n)}</span><span class="v">${fmt(v)}</span>`).join('')}</div></details>`;
  sm.innerHTML = html;
  if (!items.length) { ls.innerHTML = '<p class="note">В этом периоде записей нет.</p>'; return; }
  const groups = {};
  items.forEach(x => { (groups[x.date] = groups[x.date] || []).push(x); });
  const dates = Object.keys(groups).sort().reverse();
  const dayBlock = d => {
    const g = groups[d].slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const daySpend = g.filter(x => kindOf(x) === 'spend').reduce((a, x) => a + (Number(x.amount) || 0), 0);
    const rowOf = x => {
      const k = kindOf(x);
      const amt = k === 'income' ? `<span class="ma in">+${fmt(x.amount)}</span>` : k === 'transfer' ? `<span class="ma tr">${x.dir === 'in' ? '← ' : '→ '}${fmt(x.amount)}</span>` : k === 'cash' ? `<span class="ma tr">нал. ${fmt(x.amount)}</span>` : `<span class="ma">${fmt(x.amount)}</span>`;
      const bank = bankName(x.acc);
      const sub = (k === 'spend' ? (x.cat || otherCat()) : internal(x) ? 'Между своими счетами' : KIND_NAMES[k] + (x.cat && x.cat !== KIND_NAMES[k] ? ' · ' + x.cat : '')) + (bank ? ' · ' + bank : '') + (x.src === 'auto:sms' ? ' · из SMS' : '') + (x.auto ? ' · уточнит Claude' : '') + (x.group ? ' · ' + x.group : '');
      return `<button type="button" class="mrow" data-action="mrow" data-id="${esc(x.id)}"><span class="mn">${esc(x.name)}</span><span class="mc">${esc(sub)}</span>${amt}</button>`;
    };
    const seen = new Set(); let body = '';
    for (const x of g) {
      if (x.group) {
        if (seen.has(x.group)) continue;
        seen.add(x.group);
        const gi = g.filter(y => y.group === x.group);
        if (gi.length > 1) {
          const key = 'rc-' + d + '-' + x.group, bank = bankName(x.acc);
          body += `<details class="rcpt" data-k="${esc(key)}"${openAttr(key)}><summary class="mrow"><span class="mn">${esc(x.group)}</span><span class="mc">чек · ${gi.length} ${plural(gi.length, 'позиция', 'позиции', 'позиций')}${bank ? ' · ' + esc(bank) : ''}</span><span class="ma">${fmt(Math.round(sumAmt(gi) * 100) / 100)}</span></summary><div class="rc-items">${gi.map(rowOf).join('')}</div></details>`;
          continue;
        }
      }
      body += rowOf(x);
    }
    return `<div class="mday"><div class="mday-h"><span>${short(d)}</span><span>${daySpend ? fmt(daySpend) + ' ' + esc(cur) : ''}</span></div>${body}</div>`;
  };
  ls.innerHTML = '<h2 class="sec">Записи</h2>' + dates.slice(0, 3).map(dayBlock).join('')
    + (dates.length > 3 ? `<details class="fold" data-k="m-all"${openAttr('m-all')}><summary><span>Ранее</span><span class="sec-note">${dates.length - 3} ${plural(dates.length - 3, 'день', 'дня', 'дней')}</span></summary>${dates.slice(3).map(dayBlock).join('')}</details>` : '');
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
const IDEA_AREA = { sport: 'спорт', study: 'учёба', food: 'еда', general: 'общее' };
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
function videoFrames(file, max, onFrame) {
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
        const ctx = c.getContext('2d', { willReadFrequently: true });
        for (let i = 0; i < n && !done; i++) {
          setSync(`кадры из видео: ${i + 1} из ${n}…`);
          if (onFrame) onFrame(i, n);
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
  const batch = [], N = files.length, vids = files.filter(isVideo).length;
  PROG.start(vids ? (N > 1 ? `Отправляю ${N} ${plural(N, 'файл', 'файла', 'файлов')}` : 'Отправляю видео') : (N > 1 ? `Отправляю ${N} фото` : 'Отправляю фото'));
  for (let k = 0; k < files.length; k++) {
    const f = files[k];
    setSync(`готовлю файл ${k + 1} из ${files.length}…`);
    PROG.step('prep', k / N, isVideo(f) ? `видео ${N > 1 ? (k + 1) + ' из ' + N + ' ' : ''}— нарезаю кадры` : `фото ${k + 1} из ${N} — сжимаю`);
    try {
      if (isVideo(f)) {
        const fr = await videoFrames(f, 24, (i, n) => PROG.step('prep', (k + (i + 1) / n) / N, `видео ${N > 1 ? (k + 1) + ' из ' + N + ' ' : ''}— кадр ${i + 1} из ${n}`));
        if (!fr.length) { out.failed.push(k + 1); continue; }
        fr.forEach((x, i) => batch.push({ path: `${prefix}_${k + 1}_f${pad(i + 1)}.jpg`, b64: x.b64, photo: true }));
        out.frames += fr.length;
      } else {
        batch.push({ path: `${prefix}_${k + 1}.jpg`, b64: await resizeImage(f), photo: true, k: k + 1 });
      }
    } catch (_) { out.failed.push(k + 1); }
  }
  if (!batch.length) { PROG.done(false, 'файлы не прочитались'); return out; }
  try {
    await GH.commitFiles(batch, `${label}: ${batch.length} ${plural(batch.length, 'файл', 'файла', 'файлов')}`, (i, n, bd, bt) => { setSync(`отправляю ${i} из ${n}…`); PROG.step('up', bd / bt, `отправляю ${i} из ${n}`); });
    batch.forEach(b => { out.media.push(b.path); if (b.photo) out.photos.push(b.path); });
  } catch (e) {
    console.warn(e);
    // запасной путь — по одному файлу через Contents API
    for (const b of batch) {
      try { await GH.putRaw(b.path, b.b64, `${label}: ${b.path.split('/').pop()}`); out.media.push(b.path); if (b.photo) out.photos.push(b.path); }
      catch (e2) { setSync(errText(e2), true); if (b.k && !out.failed.includes(b.k)) out.failed.push(b.k); }
    }
  }
  PROG.done(!out.failed.length && out.media.length === batch.length);
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
function openSheet(html, keepScroll, mode) {
  const sh = $('#sheet');
  const panel = sh.querySelector('.sheet-panel');
  const top = panel.scrollTop;
  panel.classList.toggle('chat-mode', mode === 'chat');
  $('#sheet-body').innerHTML = html;
  const wasHidden = sh.hidden;
  sh.hidden = false;
  document.body.classList.add('locked');
  panel.scrollTop = keepScroll && !wasHidden ? top : 0;
  if (wasHidden && panel.style) { panel.style.transform = ''; panel.classList.remove('drag', 'snap'); }
  if (wasHidden) setTimeout(() => { try { panel.focus({ preventScroll: true }); } catch (_) { panel.focus(); } }, 20);
  vvFit();
}
function closeSheet() {
  S.cur = null; $('#sheet').hidden = true; document.body.classList.remove('locked');
  const p = document.querySelector('.sheet-panel'); if (p && p.style) { p.style.transform = ''; p.classList.remove('drag', 'snap', 'chat-mode'); }
  clearTimeout(chatPollT); chatPollT = 0;
  if (REC.mr) recStop(false);
  vvFit();
}
// чат: шторка подстраивается под экранную клавиатуру (iOS сдвигает только видимую область)
function vvFit() {
  const sh = $('#sheet'), vv = window.visualViewport; if (!sh) return;
  const on = vv && !sh.hidden && !!document.querySelector('.sheet-panel.chat-mode');
  sh.style.top = on ? vv.offsetTop + 'px' : '';
  sh.style.height = on ? vv.height + 'px' : '';
  sh.style.bottom = on ? 'auto' : '';
}
if (window.visualViewport) { window.visualViewport.addEventListener('resize', vvFit); window.visualViewport.addEventListener('scroll', vvFit); }
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
    if (DRAG.lift) { mode = 'skip'; return; }
    if (DRAG.st && Math.abs(ddy) < 10 && Math.abs(ddx) < 10) return;
    if (!mode) {
      if (Math.abs(ddy) < 6 && Math.abs(ddx) < 6) return;
      if (ddy > 0 && Math.abs(ddy) > Math.abs(ddx) && (fromTop || (panel.scrollTop <= 0 && !panel.classList.contains('chat-mode')))) { mode = 'drag'; panel.classList.add('drag'); panel.classList.remove('snap'); }
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
      ${d === today() ? `<div class="two"><button type="button" class="btn" data-action="focus-start" data-n="${esc(L.n)}">🎯 Фокус</button>${!timerState() ? `<button type="button" class="btn" data-action="timer-start" data-n="${esc(L.n)}">▶ Засечь время</button>` : ''}</div>` : ''}
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
  if (ok) { closeSheet(); toast(`Урок ${l.n} отмечен на ${short(d)} · +${XP.lesson} XP` + (d === today() && notesRepoSep() ? '. Не забудь заметки: GitHub Desktop → Commit → Push' : '')); if (d === today()) checkNotesPushed(); if (!S.skipActual) openActual(l.n, d, l.need || 60); else openFeel(l.n); S.skipActual = false; }
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
  if (ok) { closeSheet(); toast((L.need != null && !e.last ? `Часть урока ${L.n} отмечена · +${XP.part} XP` : `Урок ${L.n} пройден · +${Number(L.need) >= 90 ? XP.lesson90 : XP.lesson} XP`) + (when === today() && notesRepoSep() ? '. Не забудь заметки: GitHub Desktop → Commit → Push' : '')); if (when === today()) checkNotesPushed(); if (L.need == null || e.last) { if (!S.skipActual) openActual(L.n, when, L.need || e.cap); else openFeel(L.n); } S.skipActual = false; }
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
  if (restDay(d) && !rows.some(r => /data-action="(study|sport)"/.test(r))) rows.unshift(`<div class="row slim rest-day"><span class="tag rest">Отдых</span><span class="rb"><span class="t">Чистый день</span><span class="m">без учёбы и спорта — обнулиться</span></span></div>`);
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
  S.cur = { type: 'sport', id, auto, ses, rows: {}, times: {} };
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
    ${wkPhotosHtml(i)}
    ${ses.note ? `<p class="note">${esc(ses.note)}</p>` : ''}
    ${main}${moveBox}${replaceBox}`, keepScroll);
  wkProgress();
  hydrateImages($('#sheet-body'));
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
const QTY_W = '(?:одн[оаи]|один|две|два|три|четыре|пять|пара|пару|немного|\\d+\\s*(?:шт\\.?|штук[иа]?)?)';
function splitNames(text) {
  const parts = String(text || '').split(/[,;\n+]|\.(?:\s+|$)|\s+и\s+|\s+с\s+собой/i).map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) p.split(new RegExp('\\s+(?=' + QTY_W + '\\s+[а-яёa-z])', 'i')).forEach(x => {
    const t = x.replace(new RegExp('^' + QTY_W + '\\s+', 'i'), '').trim().replace(/\s{2,}/g, ' ');
    if (t) out.push(cap1(t));
  });
  return out;
}
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
  if (ok) ok = await writeMeals(days => { const day = days[d] = days[d] || {}; const arr = day[meal] = Array.isArray(day[meal]) ? day[meal] : []; ids.forEach(id => arr.push(id)); stampMeal(day, meal); }, `Еда ${d}: ${MEAL_NAME[meal]} — ${names.join(', ').slice(0, 60)}`);
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
  S.cur = { type: 'meal', meal, sel: [] };
  openSheet(`<h2 class="sh-title">${MEAL_NAME[meal]} · ${esc(dayName(S.foodDate).toLowerCase())}, ${dm(S.foodDate)}</h2>
    <label class="fld" for="mp-name">Просто название — без рецепта</label>
    <div class="form-row"><input id="mp-name" placeholder="Например: борщ, котлета с пюре, компот" autocomplete="off"><button type="button" class="btn study" data-action="meal-quick" data-meal="${meal}">Добавить</button></div>
    
    <div class="sh-acts two"><button type="button" class="btn" data-action="combo-new" data-meal="${meal}">+ Составное</button><button type="button" class="btn" data-action="rc-new" data-meal="${meal}">+ Рецепт</button></div>
    <p class="note">Отметь всё, что ел, и нажми «Добавить».</p>
    ${fit.length ? `<h3 class="sec">Для: ${MEAL_GEN[meal]}</h3><div class="stack">${fit.map(r => dishCard(r, 'meal-sel', ` data-meal="${meal}"`)).join('')}</div>` : ''}
    ${rest.length ? `<h3 class="sec">${fit.length ? 'Остальные' : 'Все блюда'}</h3><div class="stack">${rest.map(r => dishCard(r, 'meal-sel', ` data-meal="${meal}"`)).join('')}</div>` : ''}
    <div class="mp-bar" id="mp-bar" hidden><button type="button" class="btn study block" data-action="meal-add-sel" data-meal="${meal}">Добавить</button></div>`);
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
  if (ok && c.meal && !c.id) ok = await writeMeals(days => { const d = S.foodDate, day = days[d] = days[d] || {}; (day[c.meal] = Array.isArray(day[c.meal]) ? day[c.meal] : []).push(id); stampMeal(day, c.meal); }, `Еда ${S.foodDate}: ${MEAL_NAME[c.meal]} — ${title}`);
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
  if (ok) ok = await writeMeals(days => { const day = days[d] = days[d] || {}; (day[meal] = Array.isArray(day[meal]) ? day[meal] : []).push(id); stampMeal(day, meal); }, `Еда ${d}: ${MEAL_NAME[meal]} — фото`);
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
  PROG.start(list.length > 1 ? `Отправляю ${list.length} фото` : 'Отправляю фото');
  let ok = 0; const failed = [];
  for (let k = 0; k < list.length; k++) {
    setSync(list.length > 1 ? `загружаю фото ${k + 1} из ${list.length}…` : 'загружаю фото…');
    PROG.step('up', k / list.length, list.length > 1 ? `фото ${k + 1} из ${list.length}` : '');
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
  PROG.done(!failed.length);
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
      <button type="button" class="btn block" data-action="demo-toggle">${demo() ? '🎬 Демо-режим включён — выключить' : '🎬 Демо-режим (скрыть долги и кредиты)'}</button>
      ${c ? '<button type="button" class="btn danger block" data-action="logout">Отключить это устройство</button>' : ''}
    </div>
    <p class="note">«Отключить» удаляет ключ и сохранённые данные только с этого устройства. Сам ключ отзывается на GitHub: Settings → Developer settings → Personal access tokens.</p>`);
}


/* ---------- спорт: неделя, комплексы, база упражнений ----------
   exercises.json собирает Claude из присланных видео: упражнения по категориям, техника, дозировка,
   клип (кусок исходного ролика, режет GitHub Actions) или анимация из кадров. */
const exNorm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"'().,:;!?—–-]+/g, ' ').replace(/\s+/g, ' ').trim();
function exItems() { return (S.ex && Array.isArray(S.ex.items)) ? S.ex.items : []; }
function exById(id) { return exItems().find(x => x.id === id) || null; }
function exCx() { return (S.ex && Array.isArray(S.ex.complexes)) ? S.ex.complexes : []; }
function exCatName(id) { const c = ((S.ex || {}).cats || []).find(x => x.id === id); return c ? c.title : ''; }
function exFind(name) {
  const n = exNorm(name); if (!n) return null;
  return exItems().find(x => exNorm(x.name) === n || (x.aka || []).some(a => exNorm(a) === n)) || null;
}
// где упражнение стоит в программе: «Кардио · пн»
function exInProgram(it) {
  const cfg = (S.config || {}).sport || {}, ses = cfg.sessions || {}, out = [];
  const names = [it.name].concat(it.aka || []).map(exNorm);
  for (const [key, s] of Object.entries(ses)) {
    if (!(s.blocks || []).some(b => (b.ex || []).some(x => names.includes(exNorm(x.name))))) continue;
    const days = (cfg.template || []).filter(t => t.key === key || (t.alt || []).includes(key)).map(t => DOW_S[Number(t.dow)]);
    out.push((s.title || key) + (days.length ? ' · ' + days.join(', ') : ''));
  }
  return out;
}
function cxInProgram(c) {
  const cfg = (S.config || {}).sport || {};
  if (!c.program || !(cfg.sessions || {})[c.program]) return '';
  const days = (cfg.template || []).filter(t => t.key === c.program).map(t => DOW_S[Number(t.dow)]);
  return 'в программе' + (days.length ? ': ' + days.join(', ') : '');
}
// видео из приватного репозитория: Cache Storage, чтобы второй раз открывалось сразу и без сети
async function mediaUrl(path) {
  if (S.media[path]) return S.media[path];
  const key = 'https://media.local/' + path;
  let blob = null;
  try { const c = await caches.open('bj-media'); const hit = await c.match(key); if (hit) blob = await hit.blob(); } catch (_) {}
  if (!blob) {
    blob = await GH.rawIn(GH.cred.repo, path);
    try { const c = await caches.open('bj-media'); await c.put(key, new Response(blob, { headers: { 'Content-Type': /\.mp4$/.test(path) ? 'video/mp4' : 'image/jpeg' } })); } catch (_) {}
  }
  return (S.media[path] = URL.createObjectURL(blob));
}
function exCard(it) {
  const prog = exInProgram(it).length;
  return `<button type="button" class="ex-card" data-action="ex-open" data-id="${esc(it.id)}"><span class="ph">${it.poster ? `<img data-gh="${esc(it.poster)}" alt="" loading="lazy">` : ''}${it.clip ? `<span class="pl">${ico('play')}</span>` : ''}${prog ? '<span class="in-prog">в программе</span>' : ''}</span><span class="t">${esc(it.name)}</span><span class="m">${esc([exCatName(it.cat), it.dose].filter(Boolean).join(' · '))}</span></button>`;
}
function cxCard(c) {
  const first = exById((c.items[0] || {}).ex) || {}, pr = cxInProgram(c);
  const meta = [c.items.length + ' ' + plural(c.items.length, 'упражнение', 'упражнения', 'упражнений'), c.rounds ? c.rounds + ' ' + plural(c.rounds, 'круг', 'круга', 'кругов') : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="cx-card" data-action="cx-open" data-id="${esc(c.id)}"><span class="ph">${first.poster ? `<img data-gh="${esc(first.poster)}" alt="" loading="lazy">` : ''}</span><span class="cx-b"><span class="t">${esc(c.title)}</span><span class="m">${esc(meta)}</span>${pr ? `<span class="in-prog">${esc(pr)}</span>` : ''}</span></button>`;
}
function exFiltered() {
  const q = exNorm(S.exQ), cat = S.exCat || 'all';
  return exItems().filter(x => (cat === 'all' || x.cat === cat || (cat === 'prog' && exInProgram(x).length)) &&
    (!q || exNorm([x.name, (x.aka || []).join(' '), exCatName(x.cat), x.eq, (x.how || []).join(' ')].join(' ')).includes(q)));
}
function renderExGrid() {
  const g = $('#ex-grid'); if (!g) return;
  const l = exFiltered();
  g.innerHTML = l.length ? l.map(exCard).join('') : `<p class="note">${exItems().length ? 'Ничего не нашлось.' : 'База пока пустая — шли ролики через «Поделиться» → Claude, разберу и разложу по категориям.'}</p>`;
  hydrateImages(g);
}
function renderSportTab() {
  const box = $('#tab-sport'); if (!box) return;
  if (!S.ready) { box.innerHTML = bannerHtml(); return; }
  const t = today(), from = mondayOf(t), to = addDays(from, 6);
  const week = buildSport(addDays(from, -7), addDays(to, 7)).filter(i => i.eff >= from && i.eff <= to).sort((a, b) => a.eff < b.eff ? -1 : a.eff > b.eff ? 1 : 0);
  const done = week.filter(i => i.state === 'done' || i.state === 'other').length, planned = week.filter(i => i.state !== 'skipped').length;
  const rows = week.map(i => {
    let chip = '';
    if (i.state === 'done') chip = '<span class="chip good">✓</span>';
    else if (i.state === 'other') chip = '<span class="chip good">✓ другое</span>';
    else if (i.state === 'skipped') chip = '<span class="chip">пропуск</span>';
    else if (i.eff === t) chip = '<span class="chip warn">сегодня</span>';
    else if (i.eff !== i.orig) chip = `<span class="chip warn">с ${short(i.orig)}</span>`;
    return `<button type="button" class="row${i.state === 'done' || i.state === 'other' ? ' is-done' : i.state === 'skipped' ? ' is-skipped' : ''}" data-action="sport" data-id="${esc(i.id)}"><span class="tag sport">${DOW_S[pd(i.eff).getDay()]} ${pd(i.eff).getDate()}</span><span class="rb"><span class="t">${esc(i.title)}</span><span class="m">${esc(i.state === 'other' ? (i.note || 'сделал другое') : i.sub)}</span></span><span class="s">${chip}</span></button>`;
  }).join('');
  const cats = ((S.ex || {}).cats || []).filter(c => exItems().some(x => x.cat === c.id));
  const chips = [['all', 'Все', exItems().length], ['prog', 'В программе', exItems().filter(x => exInProgram(x).length).length]].concat(cats.map(c => [c.id, c.title, exItems().filter(x => x.cat === c.id).length]));
  box.innerHTML = `<div class="sec-row"><h2 class="sec">Неделя</h2><span class="sec-n">${done} из ${planned}</span></div>
    <div class="stack">${rows || '<p class="note">На этой неделе тренировок нет.</p>'}</div>
    ${exCx().length ? `<h2 class="sec">Комплексы</h2><div class="cx-row">${exCx().map(cxCard).join('')}</div>` : ''}
    <div class="sec-row"><h2 class="sec">Упражнения</h2><span class="sec-n">${exItems().length}</span></div>
    <input id="ex-q" type="search" class="notes-q" placeholder="Поиск: рывок, резина, кор…" value="${esc(S.exQ || '')}" autocomplete="off" autocapitalize="off">
    <div class="chips ex-cats" role="group" aria-label="Категория">${chips.map(([k, l, n]) => `<button type="button" class="chip-btn" data-action="ex-cat" data-cat="${k}" aria-pressed="${k === (S.exCat || 'all')}">${esc(l)} <small>${n}</small></button>`).join('')}</div>
    <div id="ex-grid" class="ex-grid"></div>
    <p class="note">Новые упражнения: в Instagram «Поделиться» → Claude, добавь слово «в базу» или «в ударку» — разберу, разложу по категориям и вырежу кусок ролика с техникой.</p>
    <p class="note"><button type="button" class="link-btn" data-action="ideas" data-area="sport">+ Идея по спорту для Claude</button></p>`;
  renderExGrid();
  hydrateImages(box);
}
function exMediaHtml(it) {
  if (!it.poster && !it.clip) return '';
  return `<div class="ex-media">${it.poster ? `<img data-gh="${esc(it.poster)}" alt="" class="ex-poster">` : ''}${it.clip ? `<video id="ex-vid" muted loop playsinline autoplay preload="auto"></video><span class="ex-load" id="ex-load">загружаю видео…</span>` : ''}</div>`;
}
async function exLoadVideo(it) {
  if (!it.clip) return;
  try {
    const url = await mediaUrl(it.clip);
    const v = $('#ex-vid'); if (!v || !S.cur || S.cur.exId !== it.id) return;
    v.src = url; v.muted = true;
    v.addEventListener('playing', () => { v.classList.add('on'); const l = $('#ex-load'); if (l) l.remove(); }, { once: true });
    v.addEventListener('error', () => { const l = $('#ex-load'); if (l) l.textContent = 'видео не открылось — смотри кадр'; }, { once: true });
    try { await v.play(); } catch (_) {}
  } catch (_) { const l = $('#ex-load'); if (l) l.textContent = 'видео не загрузилось'; }
}
function backBtnHtml() {
  const b = S.exBack; if (!b) return '';
  const label = b.type === 'sport' ? 'К тренировке' : b.type === 'cx' ? 'К комплексу' : 'Назад';
  return `<button type="button" class="link-btn ex-back" data-action="ex-back">← ${label}</button>`;
}
function openExercise(id, back) {
  const it = exById(id); if (!it) return;
  if (back !== undefined) S.exBack = back;
  S.cur = { type: 'ex', exId: it.id };
  const prog = exInProgram(it), cxs = exCx().filter(c => c.items.some(x => x.ex === it.id));
  const src = (it.src || []).filter((s, k, a) => a.findIndex(z => (z.author || '') === (s.author || '') && (z.link || '') === (s.link || '')) === k);
  const linkless = it.clipKind === 'frames' && !(it.src || []).some(s => s.link);
  openSheet(`${backBtnHtml()}${exMediaHtml(it)}
    <h2 class="sh-title ex-title">${esc(it.name)}</h2>
    <div class="chips ex-tags"><span class="chip">${esc(exCatName(it.cat))}</span>${it.eq ? `<span class="chip">${esc(it.eq)}</span>` : ''}${prog.map(p => `<span class="chip good">${esc(p)}</span>`).join('')}</div>
    ${it.dose ? `<div class="ex-dose"><span>Сколько</span><b>${esc(it.dose)}</b></div>` : ''}
    ${(it.how || []).length ? `<h3 class="sec">Техника</h3><ol class="ing">${it.how.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    ${(it.tips || []).length ? `<h3 class="sec">Важно</h3><ul class="ing">${it.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${cxs.length ? `<h3 class="sec">В комплексах</h3><div class="stack">${cxs.map(c => `<button type="button" class="row cx-in" data-action="cx-open" data-id="${esc(c.id)}"><span class="rb"><span class="t">${esc(c.title)}</span><span class="m">${esc((c.items.find(x => x.ex === it.id) || {}).dose || '')}</span></span><span class="s">›</span></button>`).join('')}</div>` : ''}
    ${src.length ? `<p class="note ex-src">Из роликов: ${src.map(s => s.link ? `<a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.author || 'видео')}</a>` : esc(s.author || 'видео')).join(', ')}${linkless ? '. Здесь анимация из кадров — пришли этот ролик через «Поделиться», будет настоящее видео.' : ''}</p>` : ''}`);
  hydrateImages($('#sheet-body'));
  exLoadVideo(it);
}
function openComplex(id, back) {
  const c = exCx().find(x => x.id === id); if (!c) return;
  if (back !== undefined) S.exBack = back;
  S.cur = { type: 'cx', cxId: c.id };
  const pr = cxInProgram(c);
  openSheet(`${backBtnHtml()}<h2 class="sh-title">${esc(c.title)}</h2>
    <div class="chips ex-tags">${c.rounds ? `<span class="chip">${c.rounds} ${plural(c.rounds, 'круг', 'круга', 'кругов')}</span>` : ''}${c.rest ? `<span class="chip">отдых ${esc(c.rest)}</span>` : ''}${pr ? `<span class="chip good">${esc(pr)}</span>` : ''}</div>
    ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
    <div class="stack cx-list">${c.items.map((x, k) => { const it = exById(x.ex) || { name: x.ex }; return `<button type="button" class="row cx-ex" data-action="ex-open" data-id="${esc(x.ex)}" data-from="cx:${esc(c.id)}"><span class="cx-n">${k + 1}</span><span class="thumb">${it.poster ? `<img data-gh="${esc(it.poster)}" alt="">` : ''}</span><span class="rb"><span class="t">${esc(it.name)}</span><span class="m">${esc(x.dose || it.dose || '')}</span></span><span class="s">›</span></button>`; }).join('')}</div>
    ${c.src && c.src.author ? `<p class="note">Источник: ${esc(c.src.author)}</p>` : ''}`);
  hydrateImages($('#sheet-body'));
}
function exBack() {
  const b = S.exBack; S.exBack = null;
  if (!b) { closeSheet(); return; }
  if (b.type === 'sport') openSport(b.id, true);
  else if (b.type === 'cx') openComplex(b.id, null);
  else closeSheet();
}

/* ---------- events wiring ---------- */
const TABS = ['plan', 'cal', 'lessons', 'sport', 'food', 'money'];
function setTab(t) {
  if (!TABS.includes(t)) t = 'plan';
  S.tab = t;
  document.body.dataset.tab = t;
  if (S.dirty.has(t)) renderTab(t);
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
  if (a === 'day' && S.swipedAt && Date.now() - S.swipedAt < 400) return;
  switch (a) {
    case 'tab': setTab(b.dataset.tab); break;
    case 'td-x': {
      const k = b.dataset.k, box = b.closest('.td-i'), more = box && box.querySelector('.td-more');
      if (!more) break;
      const on = more.hidden; more.hidden = !on; box.classList.toggle('open', on); b.setAttribute('aria-expanded', String(on));
      if (on) S.open.add(k); else S.open.delete(k);
      break;
    }
    case 'td-ev': { busy(b, true); await tdEventToggle(id, d); busy(b, false); break; }
    case 'ex-cat': S.exCat = b.dataset.cat; document.querySelectorAll('[data-action="ex-cat"]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.cat === S.exCat))); renderExGrid(); break;
    case 'ex-open': {
      const from = b.dataset.from || '';
      let back = null;
      if (from.startsWith('cx:')) back = { type: 'cx', id: from.slice(3) };
      else if (from.startsWith('sport:')) { if (S.cur && S.cur.type === 'sport') saveDraftNow(); back = { type: 'sport', id: from.slice(6) }; }
      openExercise(id, back); break;
    }
    case 'cx-open': openComplex(id, null); break;
    case 'ex-back': exBack(); break;
    case 'stp': stepSet(b.dataset.k, b.dataset.f, Number(b.dataset.d)); break;
    case 'set-add': {
      const c = S.cur; if (!c || c.type !== 'sport') return;
      const bi = Number(b.dataset.bi), ei = Number(b.dataset.ei), bl = c.ses.blocks[bi], x = bl.ex[ei];
      saveDraftNow();
      const d = LS.get('bj-draft-' + c.id), v = d && d.blocks[bi] && d.blocks[bi].ex[ei];
      c.rows[exKey(bi, ei)] = exRows(c, x, bl, bi, ei, v) + 1;
      rerenderWk(); break;
    }
    case 'drop-add': case 'drop-del': {
      const c = S.cur; if (!c || c.type !== 'sport') return;
      const m = /^(\d+)-(\d+)-(\d+)(?:-d(\d+))?$/.exec(b.dataset.k || ''); if (!m) return;
      const bi = Number(m[1]), ei = Number(m[2]), r = Number(m[3]);
      let base = null;
      if (a === 'drop-add') { const mw = numOrNull((document.getElementById(`lg-${bi}-${ei}-${r}-w`) || {}).value), st = wStepFor(bi, ei); if (mw != null) base = Math.max(0, Math.round((mw - Math.max(st, Math.round(mw * 0.2 / st) * st)) * 100) / 100); }
      saveDraftNow();
      const d = LS.get('bj-draft-' + c.id); if (!d) return;
      const x = d.blocks[bi].ex[ei]; x.sets = x.sets || [];
      while (x.sets.length < r) x.sets.push(null);
      const st = x.sets[r - 1] = x.sets[r - 1] || {};
      st.drops = Array.isArray(st.drops) ? st.drops : [];
      if (a === 'drop-add') st.drops.push(base != null ? { w: base } : {});
      else { st.drops.splice(Number(m[4]), 1); if (!st.drops.length) delete st.drops; }
      c.rows[exKey(bi, ei)] = Math.max(c.rows[exKey(bi, ei)] || 0, x.sets.length);
      LS.set('bj-draft-' + c.id, d);
      rerenderWk(); break;
    }
    case 'shop-tog': shopToggle(id); break;
    case 'books': openBooks(); break;
    case 'bk-check': busy(b, true); await booksRepoCheck(); busy(b, false); if (S.booksRepo === 'ok') toast('Репозиторий для книг на месте'); openBooks(); break;
    case 'bk-open': openBook(id); break;
    case 'bk-resume': unlockAudio(); bkResume(id); break;
    case 'bk-ch': { unlockAudio(); const k = Number(b.dataset.k), p = bkPos(id); bkPlay(id, k, k === p.ch ? p.pos : 0); openPlayer(); break; }
    case 'bk-player': openPlayer(); break;
    case 'bk-toggle': { const au = AU(); if (!S.play || !au) return; if (S.play.loading) return; if (au.paused) au.play().catch(() => {}); else au.pause(); break; }
    case 'bk-back': { const au = AU(); if (au && S.play) au.currentTime = Math.max(0, au.currentTime - 15); break; }
    case 'bk-fwd': { const au = AU(); if (au && S.play) au.currentTime = Math.min(au.duration || 1e9, au.currentTime + 30); break; }
    case 'bk-prev': bkStep(-1); break;
    case 'bk-next': bkStep(1); break;
    case 'bk-speed': { const v = Number(b.dataset.v) || 1; LS.set('bj-bk-speed', v); const au = AU(); if (au) au.playbackRate = v; renderPlayer(); break; }
    case 'bk-stop': { const au = AU(); if (au) au.pause(); bkSave(false); if (S.play && S.play.url) URL.revokeObjectURL(S.play.url); S.play = null; renderMini(); break; }
    case 'shop-clean': shopClean(); break;
    case 'shop-menu': shopFromMenu(); break;
    case 'msg-area': if (S.cur && S.cur.type === 'req') { const was = S.cur.area; S.cur.area = b.dataset.area; if ((was === 'books') !== (S.cur.area === 'books')) { S.cur.draft = ($('#msg-text') || {}).value || ''; openRequests('new', true); } else document.querySelectorAll('[data-action="msg-area"]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.area === S.cur.area))); } break;
    case 'msg-send': await sendMsg(b); break;
    case 'menu': openMenu(); break;
    case 'ready': openReadiness(); break;
    case 'streak': openStreak(); break;
    case 'anom': openAnomalies(); break;
    case 'fc': openForecast(); break;
    case 'lim': await openLimits(); break;
    case 'lim-suggest': limSuggestFill(); break;
    case 'lim-save': busy(b, true); await limitsSave(); busy(b, false); break;
    case 'rec': openRecurring(); break;
    case 'rec-add': { const o = (S.recur || recurringGuess()).find(x => x.k === b.dataset.k); if (o) openRegular(null, { name: o.name, amount: o.amount, day: o.day, cat: cats().includes(o.cat) ? o.cat : otherCat(), match: [o.k] }); break; }
    case 'rec-no': busy(b, true); await recurringNo(b.dataset.k); busy(b, false); break;
    case 'en-open': openEnglish(); break;
    case 'en-start': enStart(); break;
    case 'en-ans': enAnswer(Number(b.dataset.k)); break;
    case 'en-next': if (S.cur && S.cur.type === 'en') { S.cur.i++; enShow(); } break;
    case 'ben-open': openBenefits(); break;
    case 'ben-st': busy(b, true); await benSet(id, b.dataset.st); busy(b, false); break;
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
    case 'ideas': S.cur = null; openRequests('new', false, b.dataset.area || 'sport'); break;
    case 'req-tab': openRequests(b.dataset.tab); break;
    case 'cl-tap': {
      if (!(S.cur && S.cur.type === 'req') || (ev.target.closest && ev.target.closest('a'))) break;
      S.cur.sel = S.cur.sel === id ? null : id; refreshFeed();
      const row = b.closest('.cl-row'); if (S.cur.sel && row) { const ch = $('#cl-chat'), el = document.getElementById(row.id); if (ch && el && el.getBoundingClientRect().bottom > ch.getBoundingClientRect().bottom) el.scrollIntoView({ block: 'end', behavior: 'smooth' }); }
      break;
    }
    case 'cl-goto': {
      const el = document.getElementById(b.dataset.to); if (!el) { toast('Это сообщение выше — нажми «Показать раньше»'); break; }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      break;
    }
    case 'cl-reply': {
      if (!(S.cur && S.cur.type === 'req')) break;
      S.cur.re = id; S.cur.reMe = !!b.dataset.me; S.cur.sel = null;
      clCtxRefresh(); refreshFeed();
      const t = $('#msg-text'); if (t) try { t.focus({ preventScroll: true }); } catch (_) { t.focus(); }
      break;
    }
    case 'cl-pick': {
      const x = clItems().find(y => y.id === id), k = Number(b.dataset.k), t = x && x.choices[k]; if (!t) break;
      busy(b, true);
      await writeRequests(list => { list.push({ id: 'q' + rid().slice(0, 10), text: t, date: today(), ts: Date.now(), status: 'new', re: id, pick: k }); }, 'Ответ Claude: ' + t.slice(0, 50));
      busy(b, false); clScrollEnd(); break;
    }
    case 'cl-copy': {
      const a2 = id.startsWith('a:'), x = clItems().find(y => y.id === (a2 ? id.slice(2) : id)); if (!x) break;
      try { await navigator.clipboard.writeText(a2 ? x.answer : (x.text || x.transcript || '')); toast('Скопировано'); } catch (_) { toast('Не получилось скопировать'); }
      if (S.cur) { S.cur.sel = null; refreshFeed(); } break;
    }
    case 'cl-reply-x': if (S.cur && S.cur.type === 'req') { S.cur.re = null; S.cur.reMe = false; clCtxRefresh(); } break;
    case 'cl-files-x': { const f = $('#msg-files'); if (f) f.value = ''; clCtxRefresh(); clBarState(); break; }
    case 'cl-area-x': if (S.cur && S.cur.type === 'req') { S.cur.area = ''; clCtxRefresh(); } break;
    case 'cl-more': {
      if (!(S.cur && S.cur.type === 'req')) break;
      const ch = $('#cl-chat'), fromEnd = ch ? ch.scrollHeight - ch.scrollTop : 0;
      S.cur.limit = (S.cur.limit || 60) + 60; refreshFeed();
      if (ch) ch.scrollTop = ch.scrollHeight - fromEnd; break;
    }
    case 'cl-rec': recStart(); break;
    case 'cl-rec-x': recStop(false); break;
    case 'cl-rec-send': recStop(true); break;
    case 'cl-play': voicePlay(b.dataset.path, b); break;
    case 'cl-strip': if (S.cur && S.cur.type === 'req') { S.cur.strip = S.cur.strip === id ? null : id; refreshFeed(); } break;
    case 'out-retry': { const j = OUT.jobs.find(x => x.id === b.dataset.id); if (j) { j.st = 'wait'; j.err = ''; refreshFeed(); outRun(); } break; }
    case 'out-drop': { OUT.jobs = OUT.jobs.filter(x => x.id !== b.dataset.id); refreshFeed(); break; }
    case 'idea-save': await ideaSave(b, b.dataset.area); break;
    case 'idea-del': {
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Точно?'; return; }
      busy(b, true);
      if (await writeIdeas(list => { const k = list.findIndex(x => x.id === id); if (k >= 0) list.splice(k, 1); }, 'Идея удалена')) refreshFeed();
      busy(b, false); break;
    }
    case 'rq-edit': if (S.cur && S.cur.type === 'req') { S.cur.editId = id; S.cur.sel = null; refreshFeed(); const t = $('#rq-edit'); if (t && t.focus) t.focus(); } break;
    case 'rq-edit-cancel': if (S.cur && S.cur.type === 'req') { S.cur.editId = null; refreshFeed(); } break;
    case 'rq-edit-save': {
      const text = (($('#rq-edit') && $('#rq-edit').value) || '').trim();
      if (!text) { toast('Запрос пустой — лучше удали его'); return; }
      busy(b, true);
      if (await writeRequests(list => { const r = list.find(x => x.id === id); if (r) { r.text = text; r.edited = today(); } }, 'Запрос для Claude изменён')) { if (S.cur && S.cur.type === 'req') S.cur.editId = null; toast('Сохранено'); refreshFeed(); }
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
    case 'demo-toggle': if (demo()) LS.del('bj-demo'); else LS.set('bj-demo', 1); closeSheet(); render(); toast(demo() ? 'Демо-режим: долги и кредиты скрыты' : 'Демо-режим выключен'); break;
    case 'q-edit': openQuarter(); break;
    case 'q-save': busy(b, true); await quarterSave(); busy(b, false); break;
    case 'dates': openDates(); break;
    case 'dates-save': busy(b, true); await datesSave(); busy(b, false); break;
    case 'shop': openShopChat(); break;
    case 'shop-days': openShop(Number(b.dataset.days)); break;
    case 'shop-tick': { const got = new Set(LS.get('bj-shop-got') || []), k = b.dataset.key; if (got.has(k)) got.delete(k); else got.add(k); LS.set('bj-shop-got', Array.from(got)); openShop(); break; }
    case 'shop-add': { const v = ($('#shop-add').value || '').trim(); if (v) { LS.set('bj-shop-extra', (LS.get('bj-shop-extra') || []).concat([v])); openShop(); } break; }
    case 'shop-clear': { const got = new Set(LS.get('bj-shop-got') || []); LS.set('bj-shop-extra', (LS.get('bj-shop-extra') || []).filter(n => !got.has('x:' + norm(n)))); LS.set('bj-shop-got', []); openShop(); break; }
    case 'focus-start': timerStart(b.dataset.n, true); break;
    case 'focus-hide': hideFocus(); break;
    case 'focus-pause': { const tm = timerState(); if (!tm) break; if (tm.paused) { tm.pausedMs = (tm.pausedMs || 0) + (Date.now() - tm.paused); delete tm.paused; } else tm.paused = Date.now(); LS.set('bj-timer', tm); openFocus(); break; }
    case 'timer-stop-real': hideFocus(); openTimerStop(); break;
    case 'duty-on': busy(b, true); await setDuty(d, true); busy(b, false); break;
    case 'duty-off': busy(b, true); await setDuty(d, false); busy(b, false); break;
    case 'abs-new': openAbsence(null, d); break;
    case 'absence': openAbsence(b.dataset.id); break;
    case 'abs-type': if (S.cur && S.cur.type === 'absence') { S.cur.a = Object.assign({}, S.cur.a, { type: b.dataset.type, from: $('#ab-from').value || S.cur.a.from, to: $('#ab-to').value || S.cur.a.to, note: $('#ab-note').value }); openAbsence(S.cur.a.id, null); if (!S.cur.a.id) { $('#ab-from').value = S.cur.a.from; } } break;
    case 'abs-save': busy(b, true); await absenceSave(false); busy(b, false); break;
    case 'abs-del': busy(b, true); await absenceSave(true); busy(b, false); break;
    case 'timer-start': timerStart(b.dataset.n); break;
    case 'timer-stop': openFocus(); break;
    case 'timer-cancel': LS.del('bj-timer'); renderTimerChip(); hideFocus(); closeSheet(); break;
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
    case 'lesson-feel': {
      busy(b, true); const ok = await setFeel(b.dataset.n, b.dataset.v); busy(b, false);
      if (ok) { document.querySelectorAll('[data-action="lesson-feel"]').forEach(x => x.classList.toggle('on', x === b)); if (S.cur && S.cur.type === 'feel') { closeSheet(); toast('Записал: ' + b.dataset.v + '/5'); } }
      break;
    }
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
    case 'cal-prev': calShift(-1); break;
    case 'cal-next': calShift(1); break;
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
      if (await writePlan(p => setMove(p, id, { as: k === i.key ? undefined : k, custom: undefined, swap: undefined }), `Спорт: ${id} заменена на ${k}`)) { LS.del('bj-draft-' + id); LS.del('bj-wkord-' + id); toast('Тренировка заменена'); const ni = findInst(id); if (ni) openSport(id); }
      busy(b, false); break;
    }
    case 'sp-custom': {
      const lines = (($('#sp-custom') && $('#sp-custom').value) || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (!lines.length) { toast('Впиши упражнения, каждое с новой строки'); return; }
      busy(b, true);
      if (await writePlan(p => setMove(p, id, { custom: lines, as: undefined, swap: undefined }), `Спорт: ${id} — своя тренировка`)) { LS.del('bj-draft-' + id); LS.del('bj-wkord-' + id); toast('Тренировка заменена'); openSport(id); }
      busy(b, false); break;
    }
    case 'sp-as-clear': busy(b, true); if (await writePlan(p => setMove(p, id, { as: undefined, custom: undefined, swap: undefined }), `Спорт: ${id} — по программе`)) { LS.del('bj-draft-' + id); LS.del('bj-wkord-' + id); toast('Вернул тренировку по программе'); openSport(id); } busy(b, false); break;
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
    case 'req': S.cur = null; openRequests('new'); break;
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
      if (await writeRequests(list => { const k = list.findIndex(r => r.id === id); if (k >= 0) list.splice(k, 1); }, 'Запрос для Claude удалён')) refreshFeed();
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
    case 'meal-sel': {
      const c = S.cur; if (!c || c.type !== 'meal') return;
      const k = c.sel.indexOf(id); if (k >= 0) c.sel.splice(k, 1); else c.sel.push(id);
      document.querySelectorAll(`.dish[data-action="meal-sel"][data-id="${CSS.escape(id)}"]`).forEach(x => x.classList.toggle('sel', k < 0));
      const bar = $('#mp-bar'); if (bar) { bar.hidden = !c.sel.length; const bt = bar.querySelector('button'); if (bt) bt.textContent = `Добавить ${c.sel.length > 1 ? c.sel.length + ' ' + plural(c.sel.length, 'блюдо', 'блюда', 'блюд') : c.sel.length ? '«' + ((recipeById(c.sel[0]) || {}).title || '') + '»' : ''}`; }
      break;
    }
    case 'meal-add-sel': {
      const c = S.cur; if (!c || c.type !== 'meal' || !c.sel.length) return;
      const meal = b.dataset.meal, ids = c.sel.slice(), names = ids.map(x => (recipeById(x) || {}).title).filter(Boolean);
      busy(b, true);
      if (await writeMeals(days => { const day = days[S.foodDate] = days[S.foodDate] || {}; const arr = day[meal] = Array.isArray(day[meal]) ? day[meal] : []; ids.forEach(x => arr.push(x)); stampMeal(day, meal); }, `Еда ${S.foodDate}: ${MEAL_NAME[meal]} — ${names.join(', ').slice(0, 60)}`)) { closeSheet(); toast(`${MEAL_NAME[meal]}: ${names.join(', ')}`.slice(0, 90)); }
      busy(b, false); break;
    }
    case 'meal-add': {
      const meal = b.dataset.meal, r = recipeById(id); if (!r) return;
      busy(b, true);
      if (await writeMeals(days => { const day = days[S.foodDate] = days[S.foodDate] || {}; (day[meal] = Array.isArray(day[meal]) ? day[meal] : []).push(id); stampMeal(day, meal); }, `Еда ${S.foodDate}: ${MEAL_NAME[meal]} — ${r.title}`)) { closeSheet(); toast(`${MEAL_NAME[meal]}: ${r.title}`); }
      busy(b, false); break;
    }
    case 'meal-remove': {
      const meal = b.dataset.meal, idx = Number(b.dataset.idx);
      busy(b, true);
      await writeMeals(days => { const day = days[S.foodDate]; if (day && Array.isArray(day[meal])) { day[meal].splice(idx, 1); if (!day[meal].length) { delete day[meal]; if (day.t) delete day.t[meal]; if (day.t && !Object.keys(day.t).length) delete day.t; } if (!Object.keys(day).length) delete days[S.foodDate]; } }, `Еда ${S.foodDate}: убрано из «${MEAL_NAME[meal]}»`);
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
function calShift(d) {
  S.calMonth = monthShift(S.calMonth, d); renderCal();
  const g = document.querySelector('#cal-body .cal-grid');
  if (g && g.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) g.animate([{ transform: `translateX(${d * 28}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 180, easing: 'ease-out' });
}
(function calSwipe() {
  const el = document.getElementById('tab-cal'); if (!el) return;
  let x0 = 0, y0 = 0, t0 = 0;
  el.addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); }, { passive: true });
  el.addEventListener('touchend', e => {
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - t0 < 800) { S.swipedAt = Date.now(); calShift(dx < 0 ? 1 : -1); }
  }, { passive: true });
})();
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
document.addEventListener('submit', ev => {
  if (ev.target && ev.target.classList && ev.target.classList.contains('td-add')) {
    ev.preventDefault(); const inp = ev.target.querySelector('input'); const v = inp ? inp.value : ''; if (inp) inp.value = '';
    tdAdd(ev.target.dataset.date, v); return;
  }
  if (ev.target && ev.target.id === 'shop-form') { ev.preventDefault(); const inp = $('#shop-in'); if (inp && inp.value.trim()) { shopAdd(inp.value); inp.value = ''; } if (inp) inp.focus(); }
});
let draftT;
$('#notes-q').addEventListener('input', ev => notesSearch(ev.target.value));
document.addEventListener('input', ev => {
  if (ev.target && ev.target.id === 'ex-q') { S.exQ = ev.target.value; renderExGrid(); }
  if (ev.target && ev.target.id === 'msg-text') { clGrow(); if (S.cur && S.cur.type === 'req') S.cur.draft = ev.target.value; }
});
$('#sheet').addEventListener('input', ev => {
  const c = S.cur;
  if (ev.target.id === 'ev-n') repNote();
  if (ev.target.id === 'sl-bed' || ev.target.id === 'sl-wake') sleepDurNote();
  if (c && c.type === 'sport' && ev.target.id && ev.target.id.startsWith('lg-')) {
    const m = /^lg-(\d+-\d+-\d+)/.exec(ev.target.id);
    if (m && ev.target.value.trim()) markSetTime(m[1]);
    clearTimeout(draftT);
    draftT = setTimeout(saveDraftNow, 400);
    wkProgress();
  }
});
document.addEventListener('change', async ev => {
  const el = ev.target;
  if (el.id && el.id.startsWith('lg-') && el.type === 'checkbox') {
    const c = S.cur; if (c && c.type === 'sport') { saveDraftNow(); wkProgress(); }
    return;
  }
  if (el.matches && el.matches('[data-slot]')) {
    const k = el.dataset.slot, v = Number(el.value);
    if (await writeConfig(c => {
      c.study = c.study || {}; c.study.slots = c.study.slots || {};
      // старые окна остаются в силе для прошлых дней
      const y = addDays(today(), -1), h = Array.isArray(c.study.slotHistory) ? c.study.slotHistory : [];
      if (!h.some(x => x.until >= y)) { h.push({ until: y, slots: Object.assign({}, c.study.slots) }); c.study.slotHistory = h; }
      c.study.slots[k] = v; if (c.study.labels) delete c.study.labels[k];
    }, `Учёба: окно ${DOW_S[Number(k)]} = ${v} мин`)) { S.shift = {}; toast(`${DOW_S[Number(k)]}: ${v ? dur(v) : 'без учёбы'}`); }
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
  } else if (el.id === 'wk-photo') {
    const files = Array.from(el.files || []); el.value = '';
    if (files.length) wkPhotoUpload(files);
  } else if (el.id === 'msg-files') {
    clCtxRefresh(); clBarState();
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

/* ---------- v2: иконки, раскрытие, плитки ---------- */
const ICP = {
  menu: '<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>',
  bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.7 1.2 2.6 2.5 3 .4-3-.4-5.4 0-8z"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.3 2.3 4.7-4.8"/>',
  bars: '<path d="M5 20V11M12 20V4M19 20v-7"/>',
  star: '<path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  shield: '<path d="M12 3 20 6v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 10a5 5 0 0 1 7 0L13 13"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M4 13h16M12 9c-2-4-6-4-6-1.5S10 9 12 9zm0 0c2-4 6-4 6-1.5S14 9 12 9z"/>',
  sms: '<path d="M4 5h16v11H9l-5 4z"/><path d="m13 7-3 4h4l-3 4"/>',
  film: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  clip: '<path d="M20 11.5 12.2 19.3a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
  send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  warn: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>'
};
const ico = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICP[n] || ''}</svg>`;
const openAttr = k => S.open.has(k) ? ' open' : '';
document.addEventListener('toggle', e => { const el = e.target; if (el && el.dataset && el.dataset.k) { if (el.open) S.open.add(el.dataset.k); else S.open.delete(el.dataset.k); } }, true);
function ring(pct, size, cls) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, pct || 0));
  return `<svg class="ring ${cls || ''}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="rg-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="rg-fg" stroke-dasharray="${(c * v / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}
const hmClock = m => Math.floor(m / 60) + ':' + pad(m % 60);

/* ---------- индекс готовности: сон + нагрузка + наряды ---------- */
// личная норма сна: config.sleepNorm = {from: "7:15", to: "8:15"}
function sleepBand() { const n = (S.config && S.config.sleepNorm) || {}; const lo = toMin(n.from) || 435, hi = toMin(n.to) || 495; return { lo: Math.max(300, lo), hi: Math.max(lo, hi) }; }
function readiness(d) {
  d = d || today();
  const days = S.sleep.days || {}, reasons = [];
  const ab = absenceOn(d);
  if (ab && ab.type === 'sick') return { score: 15, level: 'low', label: 'Отдых', reasons: ['больничный — тренировки и тяжёлые темы подождут'] };
  const last = sleepMin(days[d]);
  const prev = [1, 2].map(k => sleepMin(days[addDays(d, -k)])).filter(Boolean);
  let sleepScore = 60;
  const band = sleepBand();
  if (last) {
    const cap = x => Math.min(x, band.lo);
    const avg = (cap(last) * 2 + prev.reduce((a, b) => a + cap(b), 0)) / (2 + prev.length);
    sleepScore = Math.max(0, Math.min(100, (avg - 300) / (band.lo - 300) * 100));
    reasons.push(`сон ${hmClock(last)}${prev.length ? `, до этого ${prev.map(hmClock).join(' и ')}` : ''} (твоя норма ${hmClock(band.lo)}–${hmClock(band.hi)})`);
    if (last > band.hi + 15) { sleepScore -= Math.min(35, Math.round((last - band.hi) / 60 * 20)); reasons.push('спал дольше нормы — по твоим наблюдениям после такого весь день вялый'); }
    if (/просып/i.test(days[d].note || '')) { sleepScore -= 10; reasons.push('сон с пробуждениями'); }
    const bm = bedMin(days[d]);
    if (bm != null && bm > 25 * 60) { sleepScore -= 10; reasons.push(`лёг в ${days[d].bed} — поздно`); }
  } else reasons.push('сон этой ночи не отмечен');
  const week = sleepAvg(7);
  if (week && week.n >= 4 && week.avg < 390) { sleepScore -= 10; reasons.push(`за неделю недосып: в среднем ${hmClock(week.avg)}`); }
  let load = 100;
  const sport = buildSport(addDays(d, -3), d).filter(i => i.state === 'done' || i.state === 'other');
  const on = k => sport.filter(i => i.eff === addDays(d, -k));
  if (on(1).some(i => i.kind === 'strength')) { load -= 35; reasons.push('вчера силовая'); }
  else if (on(1).length) { load -= 15; reasons.push('вчера кардио'); }
  if (on(2).some(i => i.kind === 'strength')) { load -= 15; reasons.push('позавчера силовая'); }
  let score = sleepScore * 0.6 + load * 0.4;
  if (dutyOn(addDays(d, -1))) { score -= 25; reasons.push('после наряда'); }
  if (dutyOn(d)) { score -= 10; reasons.push('сегодня наряд'); }
  score = Math.round(Math.max(0, Math.min(100, score)));
  const level = score >= 75 ? 'good' : score >= 55 ? 'mid' : 'low';
  return { score, level, label: { good: 'Можно тяжёлую', mid: 'Обычный день', low: 'Лёгкий день' }[level], reasons };
}
function openReadiness() {
  const r = readiness(), t = today();
  const sp = (S.sportList || []).filter(i => i.eff === t && !i.state);
  const hasStr = sp.some(i => i.kind === 'strength'), hasCardio = sp.some(i => i.kind === 'cardio'), study = studyCap(t);
  const tips = [];
  if (r.level === 'low') {
    if (hasStr) tips.push('Силовая сегодня — лёгкая версия: на подход меньше, веса −10%. Или перенеси на завтра.');
    if (hasCardio) tips.push('Кардио — спокойный темп 20–30 минут.');
    if (study.cap > 0 && !study.blocked) tips.push('Учёба — повторение и заметки вместо новой тяжёлой темы.');
    tips.push('Лечь до 23:30.');
  } else if (r.level === 'mid') tips.push(hasStr ? 'Силовая по плану, без рекордов.' : 'Всё по плану.');
  else tips.push(hasStr ? 'Хороший день, чтобы прибавить вес или повторы.' : 'Хороший день для сложной темы или тяжёлой тренировки.');
  openSheet(`<div class="rd-hero lvl-${r.level}">${ring(r.score, 112, 'rd')}<div class="rd-n"><b>${r.score}</b><span>${esc(r.label)}</span></div></div>
    <h2 class="sh-title">Готовность на сегодня</h2>
    <ul class="rd-list">${r.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="rd-tip lvl-${r.level}">${tips.map(x => `<p>${esc(x)}</p>`).join('')}</div>
    <p class="note">Считается из сна за 2–3 ночи, тренировок за 2 дня и нарядов. Это подсказка, а не приговор.</p>
    <div class="sh-acts"><button type="button" class="btn block" data-action="sleep" data-date="${sleepTarget()}">Отметить сон</button></div>`);
}
function weekProgress(sport) {
  const t = today(), from = mondayOf(t), to = addDays(from, 6);
  let plan = 0, done = 0;
  for (const i of sport) if (i.eff >= from && i.eff <= to && i.state !== 'skipped') { plan++; if (i.state === 'done' || i.state === 'other') done++; }
  const st = (S.config.study || {}).start || from;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (d < st) continue;
    const c = studyCap(d);
    if (activity(d)) { plan++; done++; } else if (c.cap > 0 && !c.blocked) plan++;
  }
  return { plan, done };
}
function tilesHtml(sport) {
  const t = today(), s = (S.sleep.days || {})[t], m = sleepMin(s), a = sleepAvg(7);
  const r = readiness(t), st = streakInfo() || { cur: 0, best: 0 }, w = weekProgress(sport);
  const wp = w.plan ? w.done / w.plan * 100 : 0;
  return `<div class="tiles">
    <button type="button" class="tile t-sleep" data-action="sleep" data-date="${sleepTarget()}"><span class="ti">${ico('moon')}</span><span class="tv">${m ? hmClock(m) : '—'}</span><span class="tk">${m ? 'сон' + (a && a.n > 1 ? ' · ср ' + hmClock(a.avg) : '') : 'отметь сон'}</span></button>
    <button type="button" class="tile t-ready lvl-${r.level}" data-action="ready"><span class="ti">${ico('bolt')}</span><span class="tv">${r.score}</span><span class="tk">${{ good: 'в форме', mid: 'обычный день', low: 'полегче' }[r.level]}</span></button>
    <button type="button" class="tile t-streak${st.cur ? '' : ' off'}" data-action="streak"><span class="ti">${ico('flame')}</span><span class="tv">${st.cur}</span><span class="tk">${plural(st.cur, 'день', 'дня', 'дней')} подряд</span></button>
    <button type="button" class="tile t-week" data-action="rev-open" data-type="week"><span class="ti tr">${ring(wp, 34, 'wk')}</span><span class="tv">${w.done}<small>/${w.plan}</small></span><span class="tk">дела недели</span></button>
  </div>`;
}
function openStreak() {
  const s = streakInfo() || { cur: 0, best: 0, todayDone: false };
  openSheet(`<div class="rd-hero lvl-streak"><span class="big-ic">${ico('flame')}</span><div class="rd-n"><b>${s.cur}</b><span>${plural(s.cur, 'день', 'дня', 'дней')} подряд</span></div></div>
    <h2 class="sh-title">Серия</h2>
    <p class="sh-meta">Рекорд — ${s.best} ${plural(s.best, 'день', 'дня', 'дней')}.${s.todayDone ? ' Сегодня уже засчитан.' : ' Сегодня ещё не засчитан.'}</p>
    <p class="note">День засчитывается за урок или тренировку. Пустые дни, наряд, отпуск и больничный серию не рвут — рвёт только пропуск запланированного.</p>`);
}

/* ---------- цели квартала: кольца ---------- */
function qShort(g) {
  if (g.type === 'lessons') return 'Уроки';
  if (g.type === 'workouts') return 'Тренировки';
  if (g.type === 'hours') return 'Часы';
  const t = String(g.title || QT[g.type] || '').replace(/^(закрыть|накопить|пройти)\s+/i, '');
  return cap1(t.length > 16 ? t.slice(0, 15) + '…' : t);
}
function quarterHtml() {
  if (!isReady()) return '';
  const k = qShown(), list = (((S.quarters || {})[k]) || []).filter(g => !(demo() && (g.type === 'debt' || demoBad(g.title)))), r = qRange(k);
  const left = daysBetween(today(), r.to) + 1, q = k.split('-Q')[1];
  if (!list.length) return `<button type="button" class="q-card empty" data-action="q-edit">+ Три цели на ${q}-й квартал</button>`;
  const cols = ['c1', 'c2', 'c3'];
  return `<button type="button" class="q-rings" data-action="q-edit"><span class="qr-h"><b>${q}-й квартал</b><span>${today() < r.from ? 'с ' + dm(r.from) : 'ещё ' + left + ' ' + plural(left, 'день', 'дня', 'дней')}</span></span><span class="qr-row">${list.slice(0, 3).map((g, i) => {
    const p = qProgress(g, k), pct = p.cur / p.target * 100;
    const val = p.money ? Math.round(pct) + '%' : String(p.cur).replace('.', ',') + '/' + String(p.target).replace('.', ',');
    return `<span class="qr"><span class="qr-ring">${ring(pct, 58, cols[i])}<span class="qr-v">${esc(val)}</span></span><span class="qr-t">${esc(qShort(g))}</span></span>`;
  }).join('')}</span></button>`;
}

/* ---------- меню ---------- */
function enStats() {
  const cards = ((S.english || {}).cards) || {}, t = today();
  const seen = WORDS.filter(w => cards[w[0]]);
  return { total: WORDS.length, learned: seen.filter(w => cards[w[0]].b >= 4).length, due: seen.filter(w => cards[w[0]].due <= t).length, fresh: WORDS.length - seen.length };
}
function openMenu() {
  const e = enStats(), bs = benStats(), rd = S.ready && isReady() ? readiness() : null;
  const items = [
    ['rev-open', 'bars', 'Итоги', 'неделя · месяц · год', 'c-blue', 'data-type="week"'],
    ['pf-open', 'star', 'Портфолио', S.ready && curBlocks().length ? 'ур. ' + pfStats().lvl : '', 'c-violet'],
    ['books', 'headphones', 'Книги', (() => { const l = books(); return l.length ? l.length + ' ' + plural(l.length, 'книга', 'книги', 'книг') : 'аудио по главам'; })(), 'c-amber'],
    ['en-open', 'chat', 'English', e.due ? e.due + ' к повторению' : e.learned + ' из ' + e.total, 'c-indigo'],
    ['ready', 'bolt', 'Готовность', rd ? rd.score + ' · ' + rd.label.toLowerCase() : '', 'c-green'],
    ['q-edit', 'target', 'Цели квартала', '', 'c-orange'],
    ['ben-open', 'shield', 'Льготы', bs.done + ' из ' + bs.total + ' оформлено', 'c-teal'],
    ['weight', 'scale', 'Вес', (() => { const w = lastWeight(); return w ? String(w.kg).replace('.', ',') + ' кг' : ''; })(), 'c-pink'],
    ['dates', 'gift', 'Важные даты', '', 'c-rose'],
    ['shop', 'cart', 'Покупки', (() => { const n = shopItems().filter(x => !x.done).length; return n ? n + ' в списке' : 'список'; })(), 'c-orange'],
    ['auto-setup', 'sms', 'Автозапись', 'SMS банка', 'c-gray'],
    ['demo-toggle', 'film', demo() ? 'Демо: вкл' : 'Демо-режим', demo() ? 'нажми, чтобы выключить' : 'скрыть долги', demo() ? 'c-red' : 'c-gray'],
    ['settings', 'gear', 'GitHub', S.lastLoad ? 'обновлено ' + hhmm(new Date(S.lastLoad)) : 'подключение', 'c-gray']
  ];
  openSheet(`<h2 class="sh-title">Меню</h2><div class="menu-grid">${items.map(([a, i, t, sub, c, extra]) => `<button type="button" class="mi ${c}" data-action="${a}" ${extra || ''}><span class="mi-ic">${ico(i)}</span><span class="mi-t">${esc(t)}</span>${sub ? `<span class="mi-s">${esc(sub)}</span>` : ''}</button>`).join('')}</div>`);
}

/* ---------- аномалии в тратах ---------- */
function purchases(list) {
  const out = [], by = {};
  for (const x of list) {
    const c = x.cat || otherCat(), a = Number(x.amount) || 0;
    if (x.group) {
      const k = x.date + '|' + x.group;
      if (!by[k]) { by[k] = { id: x.id, name: x.group, date: x.date, cat: c, amount: 0, cats: {} }; out.push(by[k]); }
      by[k].amount += a; by[k].cats[c] = (by[k].cats[c] || 0) + a;
    } else out.push({ id: x.id, name: x.name, date: x.date, cat: c, amount: a });
  }
  out.forEach(p => { if (p.cats) p.cat = Object.entries(p.cats).sort((a, b) => b[1] - a[1])[0][0]; });
  return out;
}
function anomalies() {
  const t = today(), start = periodOf(t), prevStart = periodShift(start, -1);
  if (!periodMonths(start).every(mk => S.money[mk])) return [];
  const since = moneyCfg().since || '0000';
  const living = x => kindOf(x) === 'spend' && isLiving(x);
  const havePrev = prevStart >= periodOf(since) && periodMonths(prevStart).every(mk => S.money[mk]);
  if (!havePrev) return [];
  const cur = periodItems(start).filter(living), prev = periodItems(prevStart).filter(living);
  if (!prev.length) return [];
  const k = daysBetween(start, t) + 1, prevLen = daysBetween(prevStart, addDays(start, -1)) + 1;
  const sameEnd = addDays(prevStart, k - 1);
  const byCat = list => list.reduce((m, x) => { const c = x.cat || otherCat(); m[c] = (m[c] || 0) + (Number(x.amount) || 0); return m; }, {});
  const bc = byCat(cur), bp = byCat(prev), bw = byCat(prev.filter(x => x.date <= sameEnd));
  const out = [];
  for (const [c, v] of Object.entries(bc)) {
    const pf = bp[c] || 0, exp = Math.max(pf * k / prevLen, bw[c] || 0);
    if (v >= 2000 && v > exp * 1.6 + 1000) out.push({ kind: 'pace', cat: c, v, pf, exp, sev: v / Math.max(1, exp) });
  }
  const lim = Math.max(2000, ((moneyPlan() || {}).living || 30000) * 0.07);
  const pmax = {};
  purchases(prev).forEach(p => { pmax[p.cat] = Math.max(pmax[p.cat] || 0, p.amount); });
  purchases(cur).filter(p => p.amount >= lim).sort((a, b) => b.amount - a.amount).forEach(p => {
    const m = pmax[p.cat] || 0;
    if (p.amount > m * 1.2) out.push({ kind: 'big', x: p, prevMax: m, sev: p.amount });
  });
  const bigs = out.filter(o => o.kind === 'big');
  return out.filter(o => !(o.kind === 'pace' && bigs.some(b => b.x.cat === o.cat && b.x.amount >= o.v * 0.5)))
    .sort((a, b) => a.kind === b.kind ? b.sev - a.sev : a.kind === 'pace' ? -1 : 1).slice(0, 5);
}
function anomHtml(list) {
  if (!list || !list.length) return '';
  return `<button type="button" class="anom" data-action="anom"><span class="an-ic">${ico('warn')}</span><span class="an-t">${list.length} ${plural(list.length, 'заметное отклонение', 'заметных отклонения', 'заметных отклонений')} в тратах</span><span class="an-go">›</span></button>`;
}
function openAnomalies() {
  const list = anomalies(), cur = esc(curSym()), t = today(), k = daysBetween(periodOf(t), t) + 1;
  openSheet(`<h2 class="sh-title">Отклонения в тратах</h2><p class="sh-meta">Период ${esc(periodLabel(periodOf(t)))}, день ${k}. Сравнение с прошлым периодом, без аренды и регулярных платежей.</p>
    <div class="stack" style="margin-top:12px">${list.length ? list.map(o => o.kind === 'pace'
      ? `<div class="an-row"><b>${esc(o.cat)}</b><span>${fmt(Math.round(o.v))} ${cur} за ${k} ${plural(k, 'день', 'дня', 'дней')}${!o.pf ? ' — в прошлом периоде таких трат не было' : o.v > o.pf ? ' — уже больше, чем за весь прошлый период' : ` — в ${String(Math.round(o.sev * 10) / 10).replace('.', ',')} раза больше обычного к этому дню`}</span>${o.pf ? `<small>прошлый период: ${fmt(Math.round(o.pf))} ${cur} за месяц, к ${k}-му дню ~${fmt(Math.round(o.exp))}</small>` : ''}</div>`
      : `<button type="button" class="an-row" data-action="mrow" data-id="${esc(o.x.id)}"><b>${esc(o.x.name)} — ${fmt(Math.round(o.x.amount))} ${cur}</b><span>${esc(short(o.x.date))} · ${esc(o.x.cat)}</span><small>${o.prevMax ? `крупнее любой покупки в этой категории за прошлый период (там максимум ${fmt(Math.round(o.prevMax))} ${cur})` : 'в прошлом периоде таких покупок не было'}</small></button>`).join('') : '<p class="note">Всё в пределах обычного.</p>'}</div>
    <p class="note">Если трата была запланирована — просто прими к сведению. Если нет — это первое место, где можно сэкономить до зарплаты.</p>`);
}

/* ---------- English для IT: карточки по Лейтнеру, тест из 10 вопросов ---------- */
// [английский, русский, тема]
const WORDS = [
  ['file system', 'файловая система', 'linux'], ['permission', 'право доступа', 'linux'], ['ownership', 'владелец файла (права владения)', 'linux'], ['directory', 'каталог', 'linux'],
  ['path', 'путь (к файлу)', 'linux'], ['process', 'процесс', 'linux'], ['daemon', 'фоновая служба', 'linux'], ['kernel', 'ядро', 'linux'], ['shell', 'оболочка (командная)', 'linux'],
  ['mount', 'монтировать', 'linux'], ['package', 'пакет', 'linux'], ['dependency', 'зависимость', 'linux'], ['log', 'журнал (лог)', 'linux'], ['environment variable', 'переменная окружения', 'linux'],
  ['root privileges', 'права суперпользователя', 'linux'], ['symbolic link', 'символическая ссылка', 'linux'], ['pipe', 'конвейер (|)', 'linux'], ['redirect', 'перенаправить (вывод)', 'linux'],
  ['exit code', 'код возврата', 'linux'], ['boot', 'загрузка системы', 'linux'], ['swap', 'подкачка', 'linux'], ['disk usage', 'занятое место на диске', 'linux'], ['scheduled job', 'задание по расписанию', 'linux'],
  ['router', 'маршрутизатор', 'net'], ['switch', 'коммутатор', 'net'], ['gateway', 'шлюз', 'net'], ['subnet mask', 'маска подсети', 'net'], ['routing table', 'таблица маршрутизации', 'net'],
  ['latency', 'задержка', 'net'], ['bandwidth', 'пропускная способность', 'net'], ['throughput', 'фактическая скорость передачи', 'net'], ['packet loss', 'потеря пакетов', 'net'],
  ['handshake', 'рукопожатие (установка соединения)', 'net'], ['port forwarding', 'проброс портов', 'net'], ['firewall', 'межсетевой экран', 'net'], ['access list', 'список доступа (ACL)', 'net'],
  ['trunk port', 'магистральный порт', 'net'], ['broadcast', 'широковещательная рассылка', 'net'], ['hop', 'переход (узел на пути)', 'net'], ['name resolution', 'разрешение имён', 'net'],
  ['lease', 'аренда адреса (DHCP)', 'net'], ['uplink', 'восходящий канал', 'net'], ['redundancy', 'резервирование', 'net'], ['failover', 'переключение на резерв', 'net'], ['outage', 'отказ (авария связи)', 'net'],
  ['loopback', 'петлевой интерфейс', 'net'], ['encapsulation', 'инкапсуляция', 'net'], ['tunnel', 'туннель', 'net'], ['peer', 'сосед (узел-партнёр)', 'net'], ['static route', 'статический маршрут', 'net'],
  ['default route', 'маршрут по умолчанию', 'net'], ['link aggregation', 'агрегирование каналов', 'net'], ['jitter', 'дрожание задержки', 'net'],
  ['repository', 'репозиторий', 'git'], ['commit', 'фиксация изменений (коммит)', 'git'], ['branch', 'ветка', 'git'], ['merge', 'слияние', 'git'], ['merge conflict', 'конфликт слияния', 'git'],
  ['pull request', 'запрос на слияние', 'git'], ['staging area', 'область подготовки (индекс)', 'git'], ['revert', 'отменить обратным коммитом', 'git'], ['rebase', 'перебазировать', 'git'],
  ['tag', 'метка (тег)', 'git'], ['fork', 'своя копия чужого репозитория', 'git'], ['clone', 'склонировать', 'git'], ['upstream', 'исходный (вышестоящий) репозиторий', 'git'], ['diff', 'разница между версиями', 'git'], ['stash', 'отложить изменения', 'git'],
  ['deployment', 'развёртывание', 'ops'], ['pipeline', 'конвейер CI/CD', 'ops'], ['build', 'сборка', 'ops'], ['artifact', 'результат сборки (артефакт)', 'ops'], ['rollback', 'откат', 'ops'],
  ['container', 'контейнер', 'ops'], ['image', 'образ', 'ops'], ['orchestration', 'оркестрация', 'ops'], ['provisioning', 'подготовка ресурсов', 'ops'], ['configuration drift', 'расхождение конфигурации', 'ops'],
  ['idempotent', 'идемпотентный (повтор даёт тот же результат)', 'ops'], ['inventory', 'список хостов (инвентарь)', 'ops'], ['playbook', 'сценарий Ansible', 'ops'], ['template', 'шаблон', 'ops'],
  ['secret', 'секрет (пароль, ключ)', 'ops'], ['monitoring', 'мониторинг', 'ops'], ['alert', 'оповещение', 'ops'], ['metrics', 'метрики', 'ops'], ['uptime', 'время безотказной работы', 'ops'],
  ['health check', 'проверка работоспособности', 'ops'], ['load balancer', 'балансировщик нагрузки', 'ops'], ['scaling', 'масштабирование', 'ops'], ['staging environment', 'тестовая среда (предпрод)', 'ops'],
  ['production', 'боевая среда (прод)', 'ops'], ['incident', 'инцидент', 'ops'], ['root cause', 'первопричина', 'ops'], ['postmortem', 'разбор инцидента', 'ops'], ['runbook', 'инструкция по действиям', 'ops'],
  ['downtime', 'время простоя', 'ops'], ['release', 'выпуск (релиз)', 'ops'],
  ['variable', 'переменная', 'code'], ['loop', 'цикл', 'code'], ['function', 'функция', 'code'], ['argument', 'аргумент', 'code'], ['return value', 'возвращаемое значение', 'code'],
  ['exception', 'исключение', 'code'], ['library', 'библиотека', 'code'], ['module', 'модуль', 'code'], ['string', 'строка', 'code'], ['integer', 'целое число', 'code'], ['dictionary', 'словарь', 'code'],
  ['parse', 'разобрать (текст, вывод)', 'code'], ['script', 'скрипт', 'code'], ['endpoint', 'точка доступа API', 'code'], ['request', 'запрос', 'code'], ['response', 'ответ', 'code'],
  ['timeout', 'время ожидания (тайм-аут)', 'code'], ['retry', 'повторная попытка', 'code'], ['regular expression', 'регулярное выражение', 'code'], ['virtual environment', 'виртуальное окружение', 'code'],
  ['debug', 'отлаживать', 'code'], ['deprecated', 'устаревший, не рекомендуется', 'code'],
  ['troubleshoot', 'искать и устранять неисправность', 'work'], ['workaround', 'обходное решение', 'work'], ['up and running', 'запущено и работает', 'work'], ['out of the box', 'сразу, без настройки', 'work'],
  ['backward compatible', 'обратно совместимый', 'work'], ['bottleneck', 'узкое место', 'work'], ['edge case', 'редкий крайний случай', 'work'], ['overhead', 'накладные расходы', 'work'],
  ['requirement', 'требование', 'work'], ['sanity check', 'быстрая проверка на здравый смысл', 'work'], ['heads-up', 'заблаговременное предупреждение', 'work'], ['hands-on', 'практический', 'work'],
  ['best practice', 'лучшая практика', 'work'], ['single point of failure', 'единая точка отказа', 'work'], ['maintenance window', 'окно обслуживания', 'work'], ['hardening', 'усиление защиты', 'work'],
  ['least privilege', 'принцип минимальных прав', 'work'], ['on-call', 'дежурство', 'work']
];
const EN_TOPIC = { linux: 'Linux', net: 'Сети', git: 'Git', ops: 'DevOps', code: 'Код', work: 'Рабочие фразы' };
const EN_GAP = [0, 1, 3, 7, 16, 35];
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function enQuiz(n) {
  const cards = ((S.english || {}).cards) || {}, t = today();
  const due = shuffle(WORDS.filter(w => cards[w[0]] && cards[w[0]].due <= t)).sort((a, b) => cards[a[0]].b - cards[b[0]].b);
  const fresh = shuffle(WORDS.filter(w => !cards[w[0]]));
  let pick = due.slice(0, n);
  pick = pick.concat(fresh.slice(0, Math.max(0, n - pick.length)));
  if (pick.length < n) pick = pick.concat(shuffle(WORDS.filter(w => !pick.includes(w))).sort((a, b) => ((cards[a[0]] || {}).b || 0) - ((cards[b[0]] || {}).b || 0)).slice(0, n - pick.length));
  return shuffle(pick).map(w => {
    const box = (cards[w[0]] || {}).b || 0;
    const dir = box >= 2 && Math.random() < 0.5 ? 'ru' : 'en';
    const pool = WORDS.filter(x => x !== w && x[2] === w[2]), wrong = shuffle(pool.length >= 3 ? pool : WORDS.filter(x => x !== w)).slice(0, 3);
    const opts = shuffle([w].concat(wrong)).map(x => dir === 'en' ? x[1] : x[0]);
    return { w, dir, q: dir === 'en' ? w[0] : w[1], opts, right: dir === 'en' ? w[1] : w[0] };
  });
}
function enCardHtml() {
  if (!S.ready) return '';
  const e = enStats();
  return `<button type="button" class="en-card" data-action="en-open"><span class="en-ic">${ico('chat')}</span><span class="rb"><span class="t">English для IT</span><span class="m">${e.due ? e.due + ' к повторению · ' : ''}выучено ${e.learned} из ${e.total}</span></span><span class="en-go">Тест</span></button>`;
}
function openEnglish() {
  const e = enStats(), cards = ((S.english || {}).cards) || {}, sess = ((S.english || {}).sessions) || [];
  const byT = Object.keys(EN_TOPIC).map(k => { const l = WORDS.filter(w => w[2] === k); return { k, n: l.length, ok: l.filter(w => (cards[w[0]] || {}).b >= 4).length }; });
  const last = sess[sess.length - 1];
  openSheet(`<h2 class="sh-title">English для IT</h2>
    <p class="sh-meta">${e.total} слов из Linux, сетей, Git и DevOps. Верный ответ отодвигает слово на 1 → 3 → 7 → 16 → 35 дней, ошибка возвращает к началу.</p>
    <div class="en-top">${ring(e.learned / e.total * 100, 76, 'en')}<div><b>${e.learned}</b> выучено<br><span class="sec-note">${e.due} к повторению · ${e.fresh} новых</span>${last ? `<br><span class="sec-note">последний тест ${esc(dm(last.date))}: ${last.ok} из ${last.n}</span>` : ''}</div></div>
    <div class="en-topics">${byT.map(x => `<span class="chip">${esc(EN_TOPIC[x.k])} ${x.ok}/${x.n}</span>`).join('')}</div>
    <div class="sh-acts"><button type="button" class="btn study block" data-action="en-start">Тест · 10 вопросов</button></div>`);
}
function enStart() { S.cur = { type: 'en', qs: enQuiz(10), i: 0, res: [] }; enShow(); }
function enShow() {
  const c = S.cur; if (!c || c.type !== 'en') return;
  if (c.i >= c.qs.length) return enFinish();
  const q = c.qs[c.i], ans = c.res[c.i];
  openSheet(`<div class="en-prog"><span style="width:${(c.i / c.qs.length * 100).toFixed(0)}%"></span></div>
    <p class="sh-meta">${c.i + 1} из ${c.qs.length} · ${esc(EN_TOPIC[q.w[2]])} · ${q.dir === 'en' ? 'перевод на русский' : 'как по-английски'}</p>
    <h2 class="en-q">${esc(q.q)}</h2>
    <div class="en-opts">${q.opts.map((o, k) => {
      const cls = ans == null ? '' : o === q.right ? ' ok' : k === ans ? ' bad' : ' dim';
      return `<button type="button" class="en-o${cls}" data-action="en-ans" data-k="${k}"${ans != null ? ' disabled' : ''}>${esc(o)}</button>`;
    }).join('')}</div>
    ${ans != null ? `<div class="sh-acts"><button type="button" class="btn study block" data-action="en-next">${c.i + 1 < c.qs.length ? 'Дальше' : 'Итог'}</button></div>` : ''}`, true);
}
function enAnswer(k) { const c = S.cur; if (!c || c.type !== 'en' || c.res[c.i] != null) return; c.res[c.i] = k; enShow(); }
async function enFinish() {
  const c = S.cur, t = today();
  const res = c.qs.map((q, i) => ({ w: q.w[0], ok: q.opts[c.res[i]] === q.right, q }));
  const ok = res.filter(r => r.ok).length;
  const bad = res.filter(r => !r.ok);
  openSheet(`<div class="rd-hero lvl-${ok >= 8 ? 'good' : ok >= 5 ? 'mid' : 'low'}">${ring(ok * 10, 112, 'rd')}<div class="rd-n"><b>${ok}/10</b><span>${ok >= 8 ? 'Отлично' : ok >= 5 ? 'Неплохо' : 'Повторим'}</span></div></div>
    ${bad.length ? `<h2 class="sh-title">Ошибки</h2><div class="stack">${bad.map(r => `<div class="en-miss"><b>${esc(r.q.w[0])}</b><span>${esc(r.q.w[1])}</span></div>`).join('')}</div>` : '<p class="sh-meta">Без ошибок.</p>'}
    <p class="note" id="en-save-st">Сохраняю прогресс…</p>
    <div class="sh-acts"><button type="button" class="btn study block" data-action="en-start">Ещё 10</button><button type="button" class="btn block" data-action="close">Закрыть</button></div>`);
  const next = await write('english.json', d => {
    d.cards = d.cards || {}; d.sessions = Array.isArray(d.sessions) ? d.sessions : [];
    for (const r of res) {
      const cur = d.cards[r.w] || { b: 0 };
      const b = r.ok ? Math.min(5, (cur.b || 0) + 1) : 1;
      d.cards[r.w] = { b, due: addDays(t, r.ok ? EN_GAP[b] : 1), ok: (cur.ok || 0) + (r.ok ? 1 : 0), bad: (cur.bad || 0) + (r.ok ? 0 : 1) };
    }
    d.sessions.push({ date: t, n: res.length, ok });
    if (d.sessions.length > 200) d.sessions = d.sessions.slice(-200);
    return d;
  }, `English: тест ${ok}/10`, { cards: {}, sessions: [] });
  if (next) { S.english = next; cacheNow(); }
  const st = document.getElementById('en-save-st'); if (st) st.textContent = next ? 'Прогресс сохранён.' : 'Прогресс не сохранился — проверь связь.';
  if (S.tab === 'lessons') renderLessons();
}

/* ---------- льготы и вычеты военнослужащего ---------- */
const BENEFITS = [
  { id: 'rent', t: 'Компенсация за наём жилья', v: 'каждый месяц · без НДФЛ', d: 'Если служебное жильё не дали и снимаешь квартиру — часть аренды возвращают в пределах нормы по региону.', s: ['Рапорт о признании нуждающимся в служебном жилье (жилищная комиссия части → Росжилкомплекс).', 'Договор найма с собственником и выписка ЕГРН на квартиру.', 'Рапорт на выплату компенсации, дальше — ежемесячно.'] },
  { id: 'nis', t: 'НИС — накопления на жильё', v: '≈411 тыс. ₽ в год (2026)', d: 'Взносы идут на именной счёт с включения в реестр участников. Через 3 года участия — целевой заём на ипотеку.', s: ['Проверь уведомление о включении в реестр НИС (кадры/строевая).', 'Через 3 года — рапорт на целевой жилищный заём.', 'Уволишься раньше срока без льготных оснований — накопления придётся вернуть.'] },
  { id: 'fizo', t: 'Надбавка за физподготовку', v: '15–70% оклада', d: 'Зависит от квалификационного уровня на проверке физподготовленности; подтверждается каждый год.', s: ['Узнай нормативы своей категории и дату сдачи.', 'Подтяни слабые упражнения в программе журнала — это прямые деньги.'] },
  { id: 'class', t: 'Классная квалификация', v: '5–30% оклада', d: '3-й класс — 5%, 2-й — 10%, 1-й — 20%, мастер — 30%. Для связиста — сдача на класс по специальности.', s: ['Спроси у начальника, когда ближайшая сдача на 3-й класс и какой нужен стаж в должности.'] },
  { id: 'matpom', t: 'Материальная помощь', v: '1 оклад содержания в год', d: 'Раз в год, не меньше одного оклада денежного содержания (по должности + по званию).', s: ['Рапорт командиру — обычно к отпуску.', 'Если в этом году ещё не получал — успей до конца года.'] },
  { id: 'ndfl', t: 'Вычет: учёба, лечение, спорт', v: 'до 19 500 ₽ в год', d: '13% от расходов, лимит 150 000 ₽ в год: курсы с лицензией, лечение, фитнес-клуб из перечня Минспорта.', s: ['Сохраняй договоры и чеки — фото в журнале подойдут.', 'Декларация 3-НДФЛ в личном кабинете ФНС или на Госуслугах — можно за 3 прошлых года.'] },
  { id: 'gto', t: 'Вычет за знак ГТО', v: '2 340 ₽ в год', d: 'Стандартный вычет 18 000 ₽ в год, если есть действующий знак ГТО и пройдена диспансеризация в этом году.', s: ['Сдай ГТО своей ступени и пройди диспансеризацию.', 'Заявление в финчасть — или вычет через декларацию.'] }
];
const BEN_ST = { todo: 'не начато', doing: 'в процессе', done: 'оформлено', na: 'не подходит' };
function benState(id) { return ((((S.benefits || {}).items) || {})[id]) || {}; }
function benStats() { const l = BENEFITS.filter(b => benState(b.id).st !== 'na'); return { total: l.length, done: l.filter(b => benState(b.id).st === 'done').length }; }
function openBenefits() {
  openSheet(`<h2 class="sh-title">Льготы и вычеты</h2><p class="sh-meta">Суммы и порядок уточняй в финчасти — правила меняются.</p>
    <div class="stack" style="margin-top:12px">${BENEFITS.map(b => { const st = benState(b.id).st || 'todo'; return `<details class="ben st-${st}" data-k="ben-${b.id}"${openAttr('ben-' + b.id)}><summary><span class="ben-h"><b>${esc(b.t)}</b><span class="ben-v">${esc(b.v)}</span></span><span class="chip ben-st">${BEN_ST[st]}</span></summary><div class="ben-d"><p>${esc(b.d)}</p><ol>${b.s.map(x => `<li>${esc(x)}</li>`).join('')}</ol><div class="seg4 seg-4 ben-seg">${['todo', 'doing', 'done', 'na'].map(k => `<button type="button" data-action="ben-st" data-id="${b.id}" data-st="${k}" aria-pressed="${st === k}">${BEN_ST[k]}</button>`).join('')}</div></div></details>`; }).join('')}</div>`, true);
}
async function benSet(id, st) {
  const next = await write('benefits.json', d => { d.items = d.items || {}; d.items[id] = Object.assign({}, d.items[id], { st, at: today() }); return d; }, `Льготы: ${BENEFITS.find(b => b.id === id).t} — ${BEN_ST[st]}`, { items: {} });
  if (next) { S.benefits = next; cacheNow(); openBenefits(); }
}

/* ---------- покупки: список как чат, сразу на телефоне, отправка в фоне ---------- */
function shopItems() { return (S.shop && Array.isArray(S.shop.items)) ? S.shop.items : []; }
function shopBtnHtml() {
  const n = shopItems().filter(x => !x.done).length;
  return `<button type="button" class="btn sm shop-chip" id="shop-chip" data-action="shop">${ico('cart')}<span>Покупки</span>${n ? `<b>${n}</b>` : ''}</button>`;
}
function shopMsg(x) {
  const t = x.ts ? hhmm(new Date(x.ts)) : '';
  return `<button type="button" class="msg${x.done ? ' done' : ''}" data-action="shop-tog" data-id="${esc(x.id)}"><span class="m-cb">${x.done ? '✓' : ''}</span><span class="m-t">${esc(x.text)}</span><span class="m-time">${t}</span></button>`;
}
function shopChatHtml() {
  const l = shopItems();
  return l.length ? l.map(shopMsg).join('') : '<p class="note chat-empty">Пиши, что купить. Можно через запятую: «молоко, яйца 10, курица».</p>';
}
function shopActsHtml() {
  const l = shopItems();
  return `${l.some(x => x.done) ? '<button type="button" class="link-btn" data-action="shop-clean">Убрать купленное</button>' : ''}<button type="button" class="link-btn" data-action="shop-menu">+ из меню на неделю</button>`;
}
function openShopChat() {
  S.cur = { type: 'shopc' };
  openSheet(`<h2 class="sh-title">Покупки</h2>
    <div class="chat" id="shop-chat">${shopChatHtml()}</div>
    <div class="chat-acts" id="shop-acts">${shopActsHtml()}</div>
    <form class="chat-in" id="shop-form" autocomplete="off"><input id="shop-in" placeholder="Что купить" enterkeyhint="send" autocapitalize="sentences"><button type="submit" class="send" aria-label="Добавить">${ico('play')}</button></form>`);
  const ch = document.getElementById('shop-chat'); if (ch) ch.scrollTop = ch.scrollHeight;
  const inp = document.getElementById('shop-in'); if (inp) try { inp.focus({ preventScroll: true }); } catch (_) { inp.focus(); }
}
function renderShopUI() {
  const chip = document.getElementById('shop-chip');
  if (chip) chip.outerHTML = shopBtnHtml();
  if (S.cur && S.cur.type === 'shopc') {
    const ch = document.getElementById('shop-chat'), ac = document.getElementById('shop-acts');
    if (ch) { const atEnd = ch.scrollHeight - ch.scrollTop - ch.clientHeight < 40; ch.innerHTML = shopChatHtml(); if (atEnd) ch.scrollTop = ch.scrollHeight; }
    if (ac) ac.innerHTML = shopActsHtml();
  }
}
function shopOp(apply, msg) {
  S.shop = S.shop && Array.isArray(S.shop.items) ? S.shop : { items: [] };
  apply(S.shop.items);
  LS.set('bj-shop', S.shop);
  renderShopUI();
  S.shopBusy = (S.shopBusy || 0) + 1;
  write('shop.json', d => { d.items = Array.isArray(d.items) ? d.items : []; apply(d.items); return d; }, msg, { items: [] })
    .then(next => { S.shopBusy--; if (next && next.items && !S.shopBusy) { S.shop = next; LS.set('bj-shop', S.shop); renderShopUI(); } })
    .catch(() => { S.shopBusy--; });
}
function shopAdd(text) {
  const parts = String(text || '').split(/[,;\n]+/).map(s => cap1(s.trim())).filter(Boolean);
  if (!parts.length) return;
  const now = Date.now();
  const items = parts.map((t, k) => ({ id: 's' + rid().slice(0, 9), text: t, ts: now + k }));
  shopOp(list => { items.forEach(it => { if (!list.some(y => y.id === it.id)) list.push(Object.assign({}, it)); }); }, 'Покупки: + ' + parts.join(', ').slice(0, 60));
}
function shopToggle(id) {
  const x = shopItems().find(y => y.id === id); if (!x) return;
  const done = !x.done, at = Date.now();
  shopOp(list => { const y = list.find(z => z.id === id); if (y) { if (done) { y.done = true; y.doneAt = at; } else { delete y.done; delete y.doneAt; } } }, `Покупки: ${done ? 'куплено' : 'снова нужно'} — ${x.text.slice(0, 40)}`);
}
function shopClean() {
  const ids = new Set(shopItems().filter(x => x.done).map(x => x.id)); if (!ids.size) return;
  shopOp(list => { for (let k = list.length - 1; k >= 0; k--) if (ids.has(list[k].id)) list.splice(k, 1); }, `Покупки: убрано купленное (${ids.size})`);
}
function shopFromMenu() {
  const have = new Set(shopItems().filter(x => !x.done).map(x => norm(x.text)));
  const add = shopList(7).map(x => x.label + (x.amount ? ' ' + x.amount : '')).filter(t => !have.has(norm(t)));
  if (!add.length) { toast(shopList(7).length ? 'Всё из меню уже в списке' : 'В меню на неделю пока нет блюд с ингредиентами'); return; }
  shopAdd(add.join('\n'));
  toast(`Добавил из меню: ${add.length}`);
}

/* ---------- связь с Claude: чат как в Telegram ----------
   Справа — мои сообщения: текст → requests.json, файлы и ссылки на видео → ideas.json.
   Слева — ответы Claude (answer) с цитатой сообщения, на которое он отвечает; время ответа — answerTs.
   Если Claude спрашивает (status "waiting" или choices) — под ответом кнопки; нажатие или «Ответить»
   пишет новый запрос с re = id сообщения (reMe — если дополняю своё же сообщение). */
const MSG_AREA = [['general', 'Общее'], ['sport', 'Спорт'], ['study', 'Учёба'], ['food', 'Еда'], ['books', 'Книги']];
const AREA_WORDS = [
  ['books', /(^|[^а-яё])(книг|аудиокниг)/i],
  ['food', /(^|[^а-яё])(рецепт|блюд|готовк|приготов|завтрак|обед|ужин|перекус|протеин|ккал|калори)/i],
  ['sport', /(^|[^а-яё])(трен|упражн|зал([^а-яё]|$)|бег([^а-яё]|$)|присед|жим|гир[яиюе]|скакал|кардио|пресс|кор([^а-яё]|$)|мышц|отжим|подтяг|растяж|бокс|удар|плаван|бассейн|спорт|комплекс)/i],
  ['study', /(^|[^а-яё])(урок|уч[её]б|курс|сет[ьи]([^а-яё]|$)|linux|линукс|python|питон|ansible|docker|git|cisco|vlan|ospf|bgp|netdevops|программир|скрипт|английск)/i]
];
const AREA_SHORT = { sport: 'спорт', study: 'учёба', food: 'еда', books: 'книги', general: '' };
function guessArea(text) { const t = String(text || ''); const m = AREA_WORDS.find(([, re]) => re.test(t)); return m ? m[0] : 'general'; }
const tsDay = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const clSnip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); n = n || 90; return s.length > n ? s.slice(0, n - 1) + '…' : s; };
function clFmt(s) {
  return esc(String(s || '').trim()).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,!?»)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
}
function clItems() {
  const ts = x => x.ts || Date.parse((x.date || today()) + 'T12:00:00') || 0;
  const rq = S.requests.filter(r => !demoBad(r.text + ' ' + (r.answer || ''))).map(r => ({ kind: 'rq', id: r.id, src: r, text: r.text || '', area: r.area || 'general', ts: ts(r), date: r.date, status: r.status || 'new',
    answer: r.answer, answerTs: r.answerTs, choices: Array.isArray(r.choices) ? r.choices : [], re: r.re, reMe: r.reMe, edited: r.edited, media: [], audio: [], via: r.via }));
  const id = S.ideas.map(x => ({ kind: 'idea', id: x.id, src: x, text: x.text || x.title || '', area: x.area || 'general', ts: ts(x), date: x.date, status: x.status === 'seen' ? 'done' : (x.status || 'new'),
    answer: x.answer, answerTs: x.answerTs, choices: Array.isArray(x.choices) ? x.choices : [], re: x.re, reMe: x.reMe, link: x.link, media: x.media || [], frames: x.frames, audio: x.audio || [], names: x.names || [],
    fetching: linkPending(x), fetchErr: x.status !== 'seen' ? x.fetchErr : null, source: x.source, caption: x.caption, failed: x.failed, via: x.via,
    voice: x.voice, dur: x.dur, transcript: x.voice ? x.transcript : null, voiceErr: x.voiceErr }));
  return rq.concat(id);
}
function clSnippet(x) {
  if (x.voice) return '🎙 ' + (x.transcript ? x.transcript : 'Голосовое ' + mmss(x.dur || 0));
  if (x.text) return x.text;
  if (x.frames) return 'Видео';
  if (x.media && x.media.length) return x.media.length > 1 ? 'Фото · ' + x.media.length : 'Фото';
  if (x.audio && x.audio.length) return 'Аудио · ' + x.audio.length;
  if (x.link) return x.link;
  return 'Сообщение';
}
function clDay(d) {
  const t = today();
  if (d === t) return 'Сегодня';
  if (d === addDays(t, -1)) return 'Вчера';
  const x = pd(d);
  return x.getDate() + ' ' + MON_G[x.getMonth()] + (d.slice(0, 4) !== t.slice(0, 4) ? ' ' + d.slice(0, 4) : '');
}
const clImgTag = (p, cls) => `<img${cls ? ` class="${cls}"` : ''} data-ghl="${esc(p)}"${S.imgUrl && S.imgUrl[p] ? ` src="${S.imgUrl[p]}"` : ''} alt="">`;
function clMediaHtml(x) {
  const imgs = (x.media || []).filter(p => /\.(jpe?g|png|webp|gif|heic)$/i.test(p));
  let h = '';
  if (imgs.length) {
    const strip = S.cur && S.cur.strip === x.id;
    if (x.frames) h += `<button type="button" class="cl-media" data-action="cl-strip" data-id="${esc(x.id)}" aria-label="Кадры видео">${clImgTag(imgs[Math.min(imgs.length - 1, 1)])}<span class="cl-badge">▶ видео · ${x.frames} ${plural(x.frames, 'кадр', 'кадра', 'кадров')}</span></button>`;
    else if (imgs.length === 1) h += `<button type="button" class="cl-media photo" data-action="cl-strip" data-id="${esc(x.id)}" aria-label="Фото">${clImgTag(imgs[0])}</button>`;
    else h += `<button type="button" class="cl-grid" data-action="cl-strip" data-id="${esc(x.id)}" aria-label="Фото">${imgs.slice(0, 4).map((p, k) => k === 3 && imgs.length > 4 ? `<span class="cl-more-ph">${clImgTag(p)}<b>+${imgs.length - 3}</b></span>` : clImgTag(p)).join('')}</button>`;
    if (strip) h += `<div class="cl-strip">${imgs.map(p => clImgTag(p)).join('')}</div>`;
  }
  if (x.audio && x.audio.length) h += `<div class="cl-up">${ico('headphones')} ${x.audio.length} ${plural(x.audio.length, 'файл', 'файла', 'файлов')}${x.names && x.names.length ? ': ' + esc(clSnip(x.names.join(', '), 60)) : ''}</div>`;
  if (x.failed) h += `<div class="cl-up">не дошло файлов: ${x.failed}</div>`;
  return h;
}
function clLinkHtml(x) {
  let host = 'ссылка'; try { host = new URL(x.link).hostname.replace(/^www\./, ''); } catch (_) {}
  const st = x.fetching ? 'скачиваю видео…' : x.fetchErr ? 'не скачалось: ' + x.fetchErr : '';
  return `<a class="cl-link" href="${esc(x.link)}" target="_blank" rel="noopener"><b>${esc(x.source ? '@' + String(x.source).replace(/^@/, '') : host)}</b>${x.caption ? `<span>${esc(clSnip(x.caption, 140))}</span>` : `<span>${esc(clSnip(x.link, 60))}</span>`}${st ? `<i>${esc(st)}</i>` : ''}</a>`;
}
function clMeHtml(x, byId) {
  const c = S.cur || {}, sel = c.sel === x.id;
  if (c.editId === x.id && x.kind === 'rq') return `<div class="cl-row me" id="cl-m-${esc(x.id)}"><div class="cl-edit"><textarea id="rq-edit" rows="3">${esc(x.text)}</textarea><div class="cl-acts"><button type="button" class="btn sm" data-action="rq-edit-cancel">Отмена</button><button type="button" class="btn sm study" data-action="rq-edit-save" data-id="${esc(x.id)}">Сохранить</button></div></div></div>`;
  const p = x.re && byId.get(x.re);
  const q = p ? (x.reMe ? `<span class="cl-q" data-action="cl-goto" data-to="cl-m-${esc(p.id)}"><b>Ты</b><span>${esc(clSnip(clSnippet(p)))}</span></span>`
    : `<span class="cl-q" data-action="cl-goto" data-to="cl-a-${esc(p.id)}"><b>Claude</b><span>${esc(clSnip(p.answer || clSnippet(p)))}</span></span>`) : '';
  const tick = x.fetching || voicePending(x) ? '<i class="cl-tk">⏳</i>' : x.answer ? '<i class="cl-tk read">✓✓</i>' : '<i class="cl-tk">✓</i>';
  const tag = x.area && AREA_SHORT[x.area] ? `<span class="cl-tag">#${esc(AREA_SHORT[x.area])}</span>` : '';
  const empty = !x.text && !(x.media || []).length && !x.link && !(x.audio || []).length && !x.voice;
  const via = x.via === 'alice' ? '<span class="cl-via">🎙 через Алису</span>' : '';
  const body = q + via + (x.voice ? clVoiceHtml(x) : '') + clMediaHtml(x) + (x.link ? clLinkHtml(x) : '') + (x.text || empty ? `<div class="cl-t">${x.text ? clFmt(x.text) : '…'}</div>` : '');
  const canDel = !x.answer && x.status === 'new';
  const acts = sel ? `<div class="cl-acts"><button type="button" class="btn sm" data-action="cl-reply" data-id="${esc(x.id)}" data-me="1">Дополнить</button>${x.text || x.transcript ? `<button type="button" class="btn sm" data-action="cl-copy" data-id="${esc(x.id)}">Копировать</button>` : ''}${x.kind === 'rq' && canDel ? `<button type="button" class="btn sm" data-action="rq-edit" data-id="${esc(x.id)}">Изменить</button><button type="button" class="btn sm" data-action="rq-del" data-id="${esc(x.id)}">Удалить</button>` : ''}${x.kind === 'idea' && canDel ? `<button type="button" class="btn sm" data-action="idea-del" data-id="${esc(x.id)}">Удалить</button>` : ''}</div>` : '';
  return `<div class="cl-row me${sel ? ' sel' : ''}" id="cl-m-${esc(x.id)}"><div class="cl-b me" role="button" tabindex="0" data-action="cl-tap" data-id="${esc(x.id)}">${body}<span class="cl-meta">${tag}${x.edited ? 'изм. ' : ''}${hhmm(new Date(x.ts))}${tick}</span></div>${acts}</div>`;
}
function clAsked(x, replies) {
  const asked = x.status === 'waiting' || x.choices.length > 0;
  return asked && !(replies.get(x.id) || []).some(r => !r.reMe);
}
function clClHtml(x, replies) {
  const c = S.cur || {}, sel = c.sel === 'a:' + x.id, open = clAsked(x, replies);
  const q = `<span class="cl-q" data-action="cl-goto" data-to="cl-m-${esc(x.id)}"><b>Ты</b><span>${esc(clSnip(clSnippet(x)))}</span></span>`;
  const kb = open ? `<div class="cl-kb">${x.choices.map((t, k) => `<button type="button" class="cl-k" data-action="cl-pick" data-id="${esc(x.id)}" data-k="${k}">${esc(t)}</button>`).join('')}<button type="button" class="cl-k alt" data-action="cl-reply" data-id="${esc(x.id)}">${x.choices.length ? '✎ Другое' : '✎ Ответить'}</button></div>` : '';
  const acts = sel ? `<div class="cl-acts"><button type="button" class="btn sm" data-action="cl-reply" data-id="${esc(x.id)}">Ответить</button><button type="button" class="btn sm" data-action="cl-copy" data-id="a:${esc(x.id)}">Копировать</button></div>` : '';
  const time = x.answerTs ? hhmm(new Date(x.answerTs)) : '';
  return `<div class="cl-row cl${sel ? ' sel' : ''}" id="cl-a-${esc(x.id)}"><div class="cl-b cl" role="button" tabindex="0" data-action="cl-tap" data-id="a:${esc(x.id)}">${q}<div class="cl-t">${clFmt(x.answer)}</div><span class="cl-meta">${open ? '<span class="cl-wait">ждёт твоего ответа</span>' : ''}${time}</span></div>${kb}${acts}</div>`;
}
function clOutHtml(j) {
  const err = j.st === 'err', n = j.files.length + j.audio.length;
  const what = j.voice ? `${ico('mic')} голосовое ${mmss(j.voice.dur)}` : `${ico('clip')} ${n} ${plural(n, 'файл', 'файла', 'файлов')}`;
  return `<div class="cl-row me"><div class="cl-b me out${err ? ' err' : ''}" data-out="${esc(j.id)}">${j.text ? `<div class="cl-t">${clFmt(j.text)}</div>` : ''}<div class="cl-up">${what} · <span data-od>${esc(outLabel(j))}</span></div>${err ? '' : `<div class="upp-bar"><i data-ob style="width:${(j.pct || 0).toFixed(1)}%"></i></div>`}<span class="cl-meta">${hhmm(new Date(j.ts))}<i class="cl-tk">${err ? '!' : '🕓'}</i></span></div>${err ? `<div class="cl-acts"><button type="button" class="btn sm" data-action="out-drop" data-id="${esc(j.id)}">Убрать</button><button type="button" class="btn sm study" data-action="out-retry" data-id="${esc(j.id)}">Повторить</button></div>` : ''}</div>`;
}
function clChatHtml() {
  const items = clItems(), byId = new Map(items.map(x => [x.id, x])), replies = new Map();
  items.forEach(x => { if (x.re) { if (!replies.has(x.re)) replies.set(x.re, []); replies.get(x.re).push(x); } });
  const ev = [];
  items.forEach(x => { ev.push({ t: x.ts, w: 0, x }); if (x.answer) ev.push({ t: x.answerTs || x.ts + 1, w: 1, x }); });
  OUT.jobs.forEach(j => ev.push({ t: j.ts, w: 2, j }));
  ev.sort((a, z) => a.t - z.t || a.w - z.w);
  const lim = (S.cur && S.cur.limit) || 60, shown = ev.slice(-lim);
  let html = ev.length > shown.length ? `<button type="button" class="cl-older" data-action="cl-more">Показать раньше · ${ev.length - shown.length}</button>` : '';
  if (!ev.length) html += '<p class="cl-empty">Пиши сюда задачи, вопросы и идеи, прикрепляй фото, видео и ссылки на ролики — отвечу здесь же.</p>';
  let day = '';
  shown.forEach(e => {
    const d = e.j ? today() : tsDay(e.w ? (e.x.answerTs || e.x.ts) : e.x.ts);
    if (d !== day) { day = d; html += `<div class="cl-day"><span>${esc(clDay(d))}</span></div>`; }
    html += e.j ? clOutHtml(e.j) : e.w ? clClHtml(e.x, replies) : clMeHtml(e.x, byId);
  });
  return html;
}
function clCtxHtml() {
  const c = S.cur && S.cur.type === 'req' ? S.cur : {}, out = [];
  if (c.re) {
    const x = clItems().find(y => y.id === c.re);
    if (x) out.push(`<div class="cl-ctx-i"><span class="cl-q"><b>${c.reMe ? 'Дополняю своё' : 'Ответ Claude'}</b><span>${esc(clSnip(c.reMe ? clSnippet(x) : (x.answer || clSnippet(x))))}</span></span><button type="button" class="cl-x" data-action="cl-reply-x" aria-label="Не отвечать на это">×</button></div>`);
  }
  const f = $('#msg-files'), n = f && f.files ? f.files.length : 0;
  if (n) out.push(`<div class="cl-ctx-i">${ico('clip')}<span class="cl-fn">${n} ${plural(n, 'файл', 'файла', 'файлов')}: ${esc(clSnip(Array.from(f.files).map(z => z.name).join(', '), 60))}</span><button type="button" class="cl-x" data-action="cl-files-x" aria-label="Убрать файлы">×</button></div>`);
  if (c.area && AREA_SHORT[c.area]) out.push(`<div class="cl-ctx-i"><span class="cl-fn">Тема: #${esc(AREA_SHORT[c.area])}</span><button type="button" class="cl-x" data-action="cl-area-x" aria-label="Без темы">×</button></div>`);
  return out.join('');
}
function clCtxRefresh() { const el = $('#cl-ctx'); if (el) el.innerHTML = clCtxHtml(); }
function clScrollEnd() { const ch = $('#cl-chat'); if (ch) ch.scrollTop = ch.scrollHeight; }
let clObs = null;
async function clImg(img) {
  const p = img.dataset.ghl; if (!p || img.getAttribute('src')) return;
  try { S.img[p] = S.img[p] || GH.blob(p); const u = await S.img[p]; S.imgUrl = S.imgUrl || {}; S.imgUrl[p] = u; img.src = u; }
  catch (_) { delete S.img[p]; img.classList.add('bad'); }
}
function clLazy() {
  const root = $('#cl-chat'); if (!root || !GH.cred) return;
  const imgs = root.querySelectorAll('img[data-ghl]:not([src])');
  if (!('IntersectionObserver' in window)) { imgs.forEach(clImg); return; }
  if (!clObs || clObs.root !== root) { if (clObs) clObs.disconnect(); clObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { clObs.unobserve(e.target); clImg(e.target); } }), { root, rootMargin: '400px 0px' }); }
  imgs.forEach(i => clObs.observe(i));
}
function openRequests(tab, keepScroll, area) {
  const prev = S.cur && S.cur.type === 'req' ? S.cur : {};
  if (['sport', 'study', 'food', 'books'].includes(tab)) area = tab;
  S.cur = { type: 'req', area: area || prev.area || '', limit: prev.limit || 60, sel: null, editId: null, re: prev.re || null, reMe: prev.reMe || false, strip: null, draft: prev.draft || '' };
  const sub = ((S.config || {}).claude || {}).hours || 'отвечает в течение часа, с 9 до 24';
  openSheet(`<div class="cl-head"><span class="cf-dot" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2.5c.5 4.6 2.4 6.5 7 7-4.6.5-6.5 2.4-7 7-.5-4.6-2.4-6.5-7-7 4.6-.5 6.5-2.4 7-7z" fill="currentColor"/></svg></span><span class="cl-hn"><b>Claude</b><small>${esc(sub)}</small></span></div>
    <div class="cl-chat" id="cl-chat" aria-live="polite">${clChatHtml()}</div>
    <div class="cl-in"><div id="cl-ctx">${clCtxHtml()}</div>
      <div class="cl-bar"><label class="cl-att file-btn" aria-label="Прикрепить фото, видео или аудио">${ico('clip')}<input type="file" id="msg-files" accept="image/*,video/*,audio/*,.mp3,.m4a,.m4b" multiple></label><textarea id="msg-text" rows="1" placeholder="Сообщение" aria-label="Сообщение для Claude" autocapitalize="sentences">${esc(S.cur.draft)}</textarea><button type="button" class="cl-send" data-action="msg-send" aria-label="Отправить">${ico('send')}</button><button type="button" class="cl-mic" data-action="cl-rec" aria-label="Записать голосовое">${ico('mic')}</button></div>
      <div class="cl-recbar"><button type="button" class="cl-x" data-action="cl-rec-x" aria-label="Удалить запись">${ico('trash')}</button><span class="cl-rec-dot" aria-hidden="true"></span><span id="cl-rec-t">0:00</span><span class="cl-rec-h">Идёт запись</span><button type="button" class="cl-send" data-action="cl-rec-send" aria-label="Отправить голосовое">${ico('send')}</button></div>
    </div>`, false, 'chat');
  clScrollEnd(); clLazy(); clGrow(); clBarState();
  markAnswersSeen();
  chatPoll();
}
function clGrow() { const t = $('#msg-text'); if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, 140) + 'px'; clBarState(); }
// пустое поле — микрофон, есть текст или файлы — стрелка «отправить» (как в Telegram)
function clBarState() {
  const bar = document.querySelector('.cl-bar'), t = $('#msg-text'), f = $('#msg-files'); if (!bar) return;
  bar.classList.toggle('has-text', !!((t && t.value.trim()) || (f && f.files && f.files.length)));
  const inp = document.querySelector('.cl-in'); if (inp) inp.classList.toggle('rec', !!REC.mr);
}

/* ---------- голосовые в чате ----------
   Микрофон включается только по кнопке и выключается сразу после записи (дорожка останавливается) — ничего не слушает в фоне.
   Запись → inbox/voice/<id>.m4a (iPhone) или .webm → GitHub Actions расшифровывает (whisper) → transcript в идее. */
const REC = { mr: null, stream: null, chunks: [], t0: 0, tm: 0, mime: '', max: 300 };
const recOk = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
async function recStart() {
  if (REC.mr || REC.starting) return;
  if (!recOk()) { toast('Здесь запись голоса не работает — надиктуй текст микрофоном на клавиатуре'); return; }
  REC.starting = true;
  try { REC.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { REC.starting = false; toast(e && e.name === 'NotAllowedError' ? 'Нет доступа к микрофону — разреши его журналу в настройках' : 'Микрофон не включился'); return; }
  REC.starting = false;
  if (!(S.cur && S.cur.type === 'req')) { REC.stream.getTracks().forEach(t => t.stop()); REC.stream = null; return; }
  const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  REC.mime = (MediaRecorder.isTypeSupported ? types.find(t => MediaRecorder.isTypeSupported(t)) : '') || '';
  REC.chunks = [];
  try { REC.mr = new MediaRecorder(REC.stream, REC.mime ? { mimeType: REC.mime, audioBitsPerSecond: 48000 } : {}); }
  catch (_) { REC.mr = new MediaRecorder(REC.stream); }
  REC.mr.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
  REC.mr.start(1000);
  REC.t0 = Date.now();
  REC.tm = setInterval(recTick, 250);
  recTick(); clBarState();
}
function recTick() { const sec = (Date.now() - REC.t0) / 1000, el = $('#cl-rec-t'); if (el) el.textContent = mmss(sec); if (sec >= REC.max) recStop(true); }
function recStop(send) {
  const mr = REC.mr; if (!mr) return;
  clearInterval(REC.tm);
  const dur = Math.round((Date.now() - REC.t0) / 100) / 10;
  let fired = false;
  const done = () => {
    if (fired) return; fired = true;
    try { REC.stream.getTracks().forEach(t => t.stop()); } catch (_) {}  // микрофон выключен
    const type = (mr.mimeType || REC.mime || 'audio/mp4').split(';')[0];
    const blob = new Blob(REC.chunks, { type });
    REC.mr = null; REC.stream = null; REC.chunks = [];
    clBarState();
    if (!send) return;
    if (dur < 1 || blob.size < 800) { toast('Слишком коротко — говори хотя бы секунду'); return; }
    voiceSend(blob, type, dur);
  };
  mr.onstop = done;
  try { if (mr.state !== 'inactive') mr.stop(); else done(); } catch (_) { done(); }
  setTimeout(done, 1500);
}
function voiceSend(blob, type, dur) {
  const c = S.cur && S.cur.type === 'req' ? S.cur : null;
  const ext = /mp4|m4a|aac/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : 'webm';
  const job = { id: 'i' + rid().slice(0, 10), area: c && c.area && AREA_SHORT[c.area] ? c.area : 'general', text: '', link: '', files: [], audio: [], voice: { blob, ext, type, dur }, st: 'wait', pct: 0, ts: Date.now(), re: (c && c.re) || null, reMe: !!(c && c.reMe) };
  OUT.jobs.push(job);
  if (c) { c.re = null; c.reMe = false; }
  clCtxRefresh(); refreshFeed(); clScrollEnd();
  outRun();
}
document.addEventListener('visibilitychange', () => { if (document.hidden && REC.mr) { recStop(false); toast('Запись остановлена: журнал свернули'); } });
const voicePending = x => !!(x && x.voice && !x.transcript && !x.voiceErr && Date.now() - (x.ts || 0) < 30 * 60000);
const voiceType = p => /\.webm$/i.test(p) ? 'audio/webm' : /\.ogg$/i.test(p) ? 'audio/ogg' : 'audio/mp4';
const VOICE = { a: null, path: '' };
function clVoiceHtml(x) {
  const on = VOICE.path === x.voice && VOICE.a && !VOICE.a.paused;
  const tr = x.transcript ? `<div class="cl-tr">${clFmt(x.transcript)}</div>` : x.voiceErr ? `<div class="cl-tr err">${esc(x.voiceErr)}</div>` : '<div class="cl-tr wait">расшифровываю…</div>';
  return `<div class="cl-voice"><button type="button" class="cl-play" data-action="cl-play" data-path="${esc(x.voice)}" aria-label="${on ? 'Пауза' : 'Послушать'}">${on ? '❚❚' : '▶'}</button><span class="cl-vbar"><i data-vp="${esc(x.voice)}"></i></span><span class="cl-vd">${mmss(x.dur || 0)}</span></div>${tr}`;
}
async function voicePlay(path, btn) {
  if (!VOICE.a) {
    VOICE.a = new Audio();
    ['play', 'pause', 'ended', 'timeupdate'].forEach(e => VOICE.a.addEventListener(e, voiceUi));
  }
  if (VOICE.path === path && !VOICE.a.paused) { VOICE.a.pause(); return; }
  if (VOICE.path !== path) {
    S.voiceUrl = S.voiceUrl || {};
    if (!S.voiceUrl[path]) {
      busy(btn, true);
      try { S.voiceUrl[path] = await GH.blob(path, voiceType(path)); }
      catch (_) { busy(btn, false); toast('Голосовое не загрузилось'); return; }
      busy(btn, false);
    }
    VOICE.a.src = S.voiceUrl[path]; VOICE.path = path;
  }
  try { await VOICE.a.play(); } catch (_) { toast('Не получилось воспроизвести'); }
}
function voiceUi() {
  const a = VOICE.a; if (!a) return;
  document.querySelectorAll('[data-action="cl-play"]').forEach(b => { const on = b.dataset.path === VOICE.path && !a.paused; b.textContent = on ? '❚❚' : '▶'; });
  document.querySelectorAll('[data-vp]').forEach(el => { el.style.width = el.dataset.vp === VOICE.path && a.duration && isFinite(a.duration) ? (a.currentTime / a.duration * 100).toFixed(1) + '%' : '0'; });
}
async function sendMsg(btn) {
  const c = S.cur && S.cur.type === 'req' ? S.cur : {};
  const ta = $('#msg-text');
  let text = ((ta && ta.value) || '').trim(), link = '';
  // ссылку на видео достаём из текста — её скачает GitHub (см. .github/workflows в journal-data)
  const m = /https?:\/\/\S+/i.exec(text);
  if (m && isVideoLink(m[0])) { link = m[0].replace(/[),.!?»]+$/, ''); text = text.replace(m[0], ' ').replace(/[ \t]+/g, ' ').trim(); }
  const files = Array.from(($('#msg-files') && $('#msg-files').files) || []);
  if (!text && !link && !files.length) { if (ta) ta.focus(); return; }
  const re = c.re || null, reMe = !!c.reMe;
  if (!link && !files.length) {
    const rec = { id: 'q' + rid().slice(0, 10), text, date: today(), ts: Date.now(), status: 'new' };
    if (re) { rec.re = re; if (reMe) rec.reMe = true; }
    if (c.area && AREA_SHORT[c.area]) rec.area = c.area;
    msgClear();
    const ok = await writeRequests(list => { list.push(rec); }, 'Запрос для Claude: ' + text.slice(0, 50));
    if (!ok && ta && !ta.value) { ta.value = text; clGrow(); }
    return;
  }
  const audio = files.filter(isAudio), other = files.filter(f => !isAudio(f));
  if (audio.length) {
    const big = audio.find(f => f.size > AUDIO_MAX);
    if (big) { toast(`«${big.name}» больше 45 МБ. Скачай книгу по главам или раздели файл.`); return; }
    if (S.booksRepo !== 'ok') { busy(btn, true); const okR = await booksRepoCheck(); busy(btn, false); if (!okR) { toast('Сначала нужен репозиторий для книг — открываю инструкцию'); openBooks(); return; } }
  }
  const area = audio.length ? 'books' : (c.area && AREA_SHORT[c.area] ? c.area : guessArea(text));
  const job = { id: 'i' + rid().slice(0, 10), area, text, link, files: other, audio, st: 'wait', pct: 0, ts: Date.now(), re, reMe };
  if (!files.length) {
    msgClear();
    const ok = await writeIdeas(list => { list.push(outRec(job)); }, `Идея (${IDEA_AREA[job.area] || job.area}): ${(text || link).slice(0, 50)}`);
    if (ok) chatPoll(); else if (ta && !ta.value) { ta.value = (text + ' ' + link).trim(); clGrow(); }
    return;
  }
  // файлы — в фоне: поле сразу свободно, можно писать дальше
  OUT.jobs.push(job);
  msgClear();
  outRun();
}
// очистить поле ввода, не перерисовывая окно
function msgClear() {
  const c = S.cur && S.cur.type === 'req' ? S.cur : null;
  if (c) { c.draft = ''; c.re = null; c.reMe = false; c.sel = null; }
  const t = $('#msg-text'), f = $('#msg-files');
  if (t) { t.value = ''; clGrow(); } if (f) f.value = '';
  clCtxRefresh(); refreshFeed(); clScrollEnd();
}
function outRec(j, up, au) {
  const rec = { id: j.id, area: j.area, date: today(), ts: j.ts || Date.now(), status: 'new' };
  if (j.text) rec.text = j.text; if (j.link) rec.link = j.link;
  if (j.re) { rec.re = j.re; if (j.reMe) rec.reMe = true; }
  if (up && up.media.length) rec.media = up.media;
  if (au && au.media.length) { rec.audio = au.media; rec.names = au.names; rec.repo = booksRepo(); }
  if (up && up.frames) rec.frames = up.frames;
  const failed = ((up && up.failed.length) || 0) + ((au && au.failed.length) || 0);
  if (failed) rec.failed = failed;
  return rec;
}

/* ---------- фоновые отправки ----------
   Файлы идут по очереди, по одной отправке за раз; прогресс — в ленте чата и тонкой полоской сверху.
   Пока журнал открыт (на любой вкладке), загрузка идёт; если свернуть — продолжит, когда вернёшься. */
const OUT = { jobs: [], busy: false, cur: null };
const outName = j => j.voice ? 'голосовое ' + mmss(j.voice.dur) : j.text || j.link || (j.files.length + j.audio.length > 1 ? (j.files.length + j.audio.length) + ' ' + plural(j.files.length + j.audio.length, 'файл', 'файла', 'файлов') : ((j.files[0] || j.audio[0] || {}).name || 'файл'));
function outLabel(j) {
  if (j.st === 'err') return 'не отправилось' + (j.err ? ' · ' + j.err : '');
  if (j.st === 'wait') return 'в очереди';
  return (j.detail ? j.detail + ' · ' : '') + Math.round(j.pct || 0) + '%' + (j.eta ? ' · ' + j.eta : '');
}
// прогресс текущей отправки (зовётся из PROG.set)
function outTick(pct, detail, eta) {
  const j = OUT.cur; if (!j) return;
  j.pct = pct; j.detail = detail || ''; j.eta = eta || '';
  const el = document.querySelector(`[data-out="${j.id}"]`); if (!el) return;
  const b = el.querySelector('[data-ob]'), d = el.querySelector('[data-od]');
  if (b) b.style.width = pct.toFixed(1) + '%';
  if (d) d.textContent = outLabel(j);
}
async function outRun() {
  if (OUT.busy) return; OUT.busy = true;
  try {
    for (let j; (j = OUT.jobs.find(x => x.st === 'wait'));) {
      j.st = 'up'; j.pct = 0; j.err = ''; OUT.cur = j; refreshFeed();
      let ok = false;
      try { ok = await outSend(j); } catch (e) { j.err = errText(e); }
      OUT.cur = null;
      if (ok) {
        OUT.jobs = OUT.jobs.filter(x => x !== j);
        toast('Отправил: ' + outName(j).slice(0, 40) + (j.rep ? ' · ' + j.rep : ''));
      } else { j.st = 'err'; toast('Не отправилось: ' + outName(j).slice(0, 40) + ' — в чате кнопка «Повторить»'); }
      refreshFeed();
    }
  } finally { OUT.busy = false; PROG.mini = false; }
}
async function outSend(j) {
  PROG.mini = true;
  if (j.voice) {
    const path = `inbox/voice/${j.id}.${j.voice.ext}`;
    PROG.start('Голосовое');
    try {
      const b64 = await fileToBase64(j.voice.blob);
      await GH.commitFiles([{ path, b64 }], 'Голосовое: ' + mmss(j.voice.dur), (i, n, bd, bt) => PROG.step('up', bt ? bd / bt : 0, 'отправляю'));
    } catch (e) { PROG.done(false, 'не отправилось'); j.err = errText(e); return false; }
    PROG.done(true);
    S.voiceUrl = S.voiceUrl || {}; S.voiceUrl[path] = URL.createObjectURL(j.voice.blob);  // своё можно слушать сразу
    const rec = outRec(j); rec.voice = path; rec.dur = j.voice.dur;
    return !!(await writeIdeas(list => { const i = list.findIndex(x => x.id === j.id); if (i >= 0) list[i] = rec; else list.push(rec); }, `Идея (голос): ${mmss(j.voice.dur)}`));
  }
  const up = j.files.length ? await uploadFiles(j.files, `inbox/ideas/${j.id}`, 'Идея') : { media: [], photos: [], frames: 0, failed: [] };
  const au = j.audio.length ? await uploadAudio(j.audio, j.id) : { media: [], names: [], failed: [] };
  if (!up.media.length && !au.media.length) { j.err = up.failed.length ? 'файлы не прочитались или нет связи' : 'нет связи'; return false; }
  const rec = outRec(j, up, au);
  const ok = await writeIdeas(list => { const i = list.findIndex(x => x.id === j.id); if (i >= 0) list[i] = rec; else list.push(rec); }, `Идея (${IDEA_AREA[j.area] || j.area}): ${(j.text || j.link || 'файлы').slice(0, 50)}`);
  j.rep = uploadReport(up, j.files.length);
  return !!ok;
}
// обновить ленту в открытом чате, не трогая поле ввода и выбранные файлы
function refreshFeed() {
  const ch = $('#cl-chat'); if (!ch || !(S.cur && S.cur.type === 'req')) return;
  const atEnd = ch.scrollHeight - ch.scrollTop - ch.clientHeight < 80, top = ch.scrollTop;
  ch.innerHTML = clChatHtml();
  ch.scrollTop = atEnd ? ch.scrollHeight : top;
  clLazy();
  if (unseenAnswers()) markAnswersSeen();
  if (!chatPollT) chatPoll();
}
// ссылки на видео (Instagram, TikTok, YouTube, VK) скачивает GitHub; ответы Claude приходят раз в час —
// пока чат открыт, тихо проверяем (раз в 20 с, пока качается видео, иначе раз в минуту, если есть сообщения без ответа)
const isVideoLink = u => /^https?:\/\/([a-z0-9-]+\.)*(instagram\.com|instagr\.am|tiktok\.com|youtube\.com|youtu\.be|vk\.com|vkvideo\.ru|rutube\.ru|x\.com|twitter\.com|pinterest\.[a-z.]+|pin\.it)\//i.test(u || '');
const linkPending = x => x.link && isVideoLink(x.link) && x.status !== 'seen' && !(x.media && x.media.length) && !x.fetchErr && Date.now() - (x.ts || 0) < 30 * 60000;
let chatPollT = 0;
function chatPoll() {
  clearTimeout(chatPollT); chatPollT = 0;
  if (!(S.cur && S.cur.type === 'req')) return;
  const fast = S.ideas.some(x => linkPending(x) || voicePending(x));
  if (!fast && !clItems().some(x => !x.answer && x.status !== 'done')) return;
  chatPollT = setTimeout(async () => {
    chatPollT = 0;
    if (!(S.cur && S.cur.type === 'req') || document.hidden) return;
    if (!S.pending && !queueCount()) {
      try {
        const [q, i] = await Promise.all([readDoc('requests.json'), readDoc('ideas.json')]);
        let ch = false;
        if (q && Array.isArray(q.requests) && JSON.stringify(q.requests) !== JSON.stringify(S.requests)) { S.requests = q.requests; ch = true; }
        if (i && Array.isArray(i.ideas) && JSON.stringify(i.ideas) !== JSON.stringify(S.ideas)) { S.ideas = i.ideas; ch = true; }
        if (ch) { cacheNow(); refreshFeed(); renderClaudeBtn(); }
      } catch (_) {}
    }
    chatPoll();
  }, fast ? 20000 : 60000);
}
const linkPoll = chatPoll;

/* ---------- книги: аудио по главам, плеер с памятью позиции ----------
   Аудио лежит в отдельном приватном репозитории (config.books.repo, по умолчанию journal-books),
   чтобы journal-data оставался лёгким. Список книг и прогресс — journal-data/books.json. */
const AUDIO_RE = /\.(mp3|m4a|m4b|aac|ogg|opus|wav|flac)$/i;
const isAudio = f => /^audio\//.test(f.type || '') || AUDIO_RE.test(f.name || '');
const AUDIO_MAX = 45 * 1024 * 1024;
function booksRepo() { return ((S.config || {}).books || {}).repo || 'journal-books'; }
function books() { return ((S.books || {}).books || []).filter(b => Array.isArray(b.chapters) && b.chapters.length); }
function bookById(id) { return books().find(b => b.id === id) || null; }
function bkLocal() { return LS.get('bj-bk-pos') || {}; }
function bkPos(id) {
  const loc = bkLocal()[id], rem = (((S.books || {}).progress) || {})[id];
  if (loc && (!rem || (loc.ts || 0) >= Date.parse(rem.at || 0))) return loc;
  return rem ? { ch: rem.ch || 0, pos: rem.pos || 0, done: rem.done || [], ts: Date.parse(rem.at || 0) || 0 } : { ch: 0, pos: 0, done: [] };
}
const mmss = sec => { sec = Math.max(0, Math.floor(sec || 0)); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return (h ? h + ':' + pad(m) : m) + ':' + pad(s); };
function bookPct(b) {
  const p = bkPos(b.id), tot = b.chapters.reduce((a, c) => a + (Number(c.dur) || 0), 0) || 1;
  let heard = 0; b.chapters.forEach((c, k) => { if ((p.done || []).includes(k) || k < p.ch) heard += Number(c.dur) || 0; else if (k === p.ch) heard += Math.min(Number(c.dur) || 0, p.pos || 0); });
  return Math.max(0, Math.min(100, heard / tot * 100));
}
const bookInit = t => String(t || '?').replace(/[«»"]/g, '').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
function bookCardHtml() {
  const l = books(); if (!l.length) return '';
  const cur = l.slice().sort((a, b) => (bkPos(b.id).ts || 0) - (bkPos(a.id).ts || 0))[0], p = bkPos(cur.id), ch = cur.chapters[p.ch] || cur.chapters[0];
  return `<div class="bk-card"><button type="button" class="bk-main" data-action="bk-open" data-id="${esc(cur.id)}"><span class="bk-cov">${esc(bookInit(cur.title))}</span><span class="rb"><span class="t">${esc(cur.title)}</span><span class="m">${esc(ch.title || 'Глава ' + (p.ch + 1))}${p.pos ? ' · ' + mmss(p.pos) : ''}</span><span class="bar"><i style="width:${bookPct(cur).toFixed(1)}%"></i></span></span></button><button type="button" class="bk-play" data-action="bk-resume" data-id="${esc(cur.id)}" aria-label="Слушать">${ico('play')}</button></div>`;
}
async function booksRepoCheck() {
  if (!GH.cred) return false;
  try {
    const r = await GH.req('GET', GH.baseOf(booksRepo()));
    if (!r.ok) { S.booksRepo = 'none'; return false; }
    const j = await r.json();
    if (j.private === false) { S.booksRepo = 'public'; return false; }
    const c = await GH.req('GET', GH.baseOf(booksRepo()) + '/commits?per_page=1');
    if (c.status === 409) await GH.putIn(booksRepo(), 'README.md', b64enc('Аудиокниги для «Бортового журнала». Раскладывает Claude.\n'), 'Книги: начало');
    S.booksRepo = 'ok'; return true;
  } catch (_) { S.booksRepo = 'err'; return false; }
}
function booksSetupHtml() {
  const st = S.booksRepo;
  if (st === 'ok' || !st) return '';
  const name = esc(booksRepo());
  return `<div class="callout"><b>${st === 'public' ? 'Репозиторий для книг открытый — сделай его приватным.' : 'Нужен приватный репозиторий для книг'}</b>
    <ol class="setup-steps"><li>GitHub → <b>New repository</b> → имя <span class="mono">${name}</span> → <b>Private</b> → галочка <b>Add a README</b> → Create.</li><li>Settings → Developer settings → Fine-grained tokens → ключ журнала → <b>Repository access</b> → добавь <span class="mono">${name}</span> → Save.</li><li>Вернись сюда и нажми «Проверить».</li></ol>
    <button type="button" class="btn sm study" data-action="bk-check">Проверить</button></div>`;
}
async function openBooks() {
  S.cur = { type: 'books' };
  const l = books();
  const render = () => {
    const rows = l.map(b => { const p = bkPos(b.id), pct = bookPct(b); return `<button type="button" class="bk-row" data-action="bk-open" data-id="${esc(b.id)}"><span class="bk-cov">${esc(bookInit(b.title))}</span><span class="rb"><span class="t">${esc(b.title)}</span><span class="m">${esc([b.author, b.chapters.length + ' ' + plural(b.chapters.length, 'глава', 'главы', 'глав'), pct >= 99 ? 'прослушана' : pct > 0 ? 'глава ' + (p.ch + 1) : ''].filter(Boolean).join(' · '))}</span><span class="bar"><i style="width:${pct.toFixed(1)}%"></i></span></span></button>`; }).join('');
    const min = Object.values(((S.books || {}).listen) || {}).reduce((a, v) => a + (Number(v) || 0), 0);
    openSheet(`<h2 class="sh-title">Книги</h2>${min ? `<p class="sh-meta">Прослушано всего ${hmShort(min)}</p>` : ''}
      ${booksSetupHtml()}
      ${l.length ? `<div class="stack" style="margin-top:12px">${rows}</div>` : '<p class="note">Пока пусто.</p>'}
      <details class="fold" data-k="bk-how"${l.length ? openAttr('bk-how') : ' open'}><summary><span>Как добавить книгу</span></summary><ol class="setup-steps"><li>Кнопка Claude → тема <b>Книги</b> → 📎 → выбери MP3 (главы по отдельности или одним файлом, до 45 МБ каждый).</li><li>В тексте — название и автор, если в именах файлов их нет.</li><li>Когда позовёшь меня, разложу по главам, и книга появится здесь.</li></ol></details>`, true);
  };
  render();
  if (!S.booksRepo) { await booksRepoCheck(); if (S.cur && S.cur.type === 'books') render(); }
}
function openBook(id) {
  const b = bookById(id); if (!b) return;
  S.cur = { type: 'book', id };
  const p = bkPos(id), done = new Set(p.done || []);
  const ch = b.chapters[p.ch] || b.chapters[0];
  openSheet(`<div class="bk-hero"><span class="bk-cov big">${esc(bookInit(b.title))}</span><div><h2 class="sh-title">${esc(b.title)}</h2>${b.author ? `<p class="sh-meta">${esc(b.author)}</p>` : ''}<span class="bar"><i style="width:${bookPct(b).toFixed(1)}%"></i></span></div></div>
    <div class="sh-acts"><button type="button" class="btn study block" data-action="bk-resume" data-id="${esc(id)}">${ico('play')}${p.pos || p.ch ? `Продолжить: ${esc(ch.title || 'глава ' + (p.ch + 1))} · ${mmss(p.pos)}` : 'Слушать'}</button></div>
    ${b.note ? `<p class="note">${esc(b.note)}</p>` : ''}
    <div class="stack bk-chs" style="margin-top:12px">${b.chapters.map((c, k) => `<button type="button" class="bk-ch${k === p.ch ? ' cur' : ''}${done.has(k) ? ' done' : ''}" data-action="bk-ch" data-id="${esc(id)}" data-k="${k}"><span class="bk-n">${done.has(k) ? '✓' : k + 1}</span><span class="t">${esc(c.title || 'Глава ' + (k + 1))}</span><span class="s">${c.dur ? mmss(c.dur) : ''}</span></button>`).join('')}</div>`);
}

/* плеер */
const AU = () => document.getElementById('bk-audio');
function silentWav() {
  // 0,05 с тишины — чтобы iPhone «разрешил» звук прямо в нажатии, пока глава качается
  const n = 400, buf = new ArrayBuffer(44 + n), v = new DataView(buf), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function unlockAudio() {
  const a = AU(); if (!a || S.audioUnlocked) return;
  try { a.src = silentWav(); const p = a.play(); if (p && p.catch) p.catch(() => {}); S.audioUnlocked = true; } catch (_) {}
}
const AKEY = (repo, file) => 'https://journal.local/audio/' + encodeURIComponent(repo) + '/' + file.split('/').map(encodeURIComponent).join('/');
async function audioBlob(repo, file) {
  let cache = null;
  try { cache = await caches.open('bj-audio'); const hit = await cache.match(AKEY(repo, file)); if (hit) return await hit.blob(); } catch (_) {}
  const blob = await GH.rawIn(repo, file);
  if (cache) {
    try {
      await cache.put(AKEY(repo, file), new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/mpeg' } }));
      const keys = await cache.keys();
      for (const k of keys.slice(0, Math.max(0, keys.length - 8))) await cache.delete(k);
    } catch (_) {}
  }
  return blob;
}
async function bkPlay(id, k, pos) {
  const b = bookById(id); if (!b) return;
  const c = b.chapters[k]; if (!c) return;
  const a = AU(); if (!a) return;
  unlockAudio();
  S.play = { id, k, loading: true };
  renderMini(); renderPlayer();
  try {
    const blob = await audioBlob(b.repo || booksRepo(), c.file);
    if (!S.play || S.play.id !== id || S.play.k !== k) return;
    if (S.play.url) URL.revokeObjectURL(S.play.url);
    const url = URL.createObjectURL(blob);
    S.play = { id, k, url, loading: false };
    a.src = url;
    a.playbackRate = Number(LS.get('bj-bk-speed')) || 1;
    const start = pos || 0;
    const go = () => { if (start) { try { a.currentTime = start; } catch (_) {} } a.play().catch(() => { toast('Нажми ▶, чтобы начать'); }); };
    if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
    mediaMeta(b, c);
    S.bkNextLoaded = false;
  } catch (e) {
    S.play = null; renderMini();
    toast(e && e.code === 'offline' ? 'Нет сети, а глава ещё не скачана' : 'Глава не загрузилась. Проверь доступ к репозиторию книг.');
  }
  renderMini(); renderPlayer();
}
function mediaMeta(b, c) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: c.title || b.title, artist: b.author || '', album: b.title });
    const a = AU();
    const on = (n, f) => { try { navigator.mediaSession.setActionHandler(n, f); } catch (_) {} };
    on('play', () => a.play()); on('pause', () => a.pause());
    on('seekbackward', () => { a.currentTime = Math.max(0, a.currentTime - 15); });
    on('seekforward', () => { a.currentTime = Math.min(a.duration || 1e9, a.currentTime + 30); });
    on('previoustrack', () => bkStep(-1)); on('nexttrack', () => bkStep(1));
  } catch (_) {}
}
function bkStep(d) { const p = S.play; if (!p) return; const b = bookById(p.id); if (!b) return; const k = p.k + d; if (k < 0 || k >= b.chapters.length) return; bkSave(true); bkPlay(p.id, k, 0); }
function bkResume(id) { const p = bkPos(id); bkPlay(id, p.ch || 0, p.pos || 0); openPlayer(); }
// позиция: в телефоне — каждые 5 с, в журнал — на паузе, в конце главы и при сворачивании
function bkTick(force) {
  const p = S.play, a = AU(); if (!p || p.loading || !a || !a.src) return;
  const now = Date.now();
  if (!force && now - (S.bkLastLoc || 0) < 5000) return;
  if (S.bkPlayedFrom) S.bkListen = (S.bkListen || 0) + (now - S.bkPlayedFrom) / 1000;
  S.bkPlayedFrom = a.paused ? 0 : now;
  S.bkLastLoc = now;
  const all = bkLocal(), cur = all[p.id] || bkPos(p.id);
  all[p.id] = { ch: p.k, pos: Math.floor(a.currentTime || 0), done: cur.done || [], ts: now };
  LS.set('bj-bk-pos', all);
  S.bkDirty = true;
}
function bkSave(chapterDone) {
  const p = S.play; if (!p) return;
  bkTick(true);
  const all = bkLocal(), cur = all[p.id]; if (!cur) return;
  if (chapterDone && !cur.done.includes(p.k)) { cur.done.push(p.k); cur.done.sort((x, y) => x - y); LS.set('bj-bk-pos', all); }
  if (!S.bkDirty && !chapterDone) return;
  S.bkDirty = false;
  const min = Math.round((S.bkListen || 0) / 60 * 10) / 10; S.bkListen = 0;
  const t = today(), id = p.id, rec = { ch: cur.ch, pos: cur.pos, done: cur.done.slice(), at: new Date(cur.ts).toISOString() };
  write('books.json', d => {
    d.books = Array.isArray(d.books) ? d.books : []; d.progress = d.progress || {}; d.listen = d.listen || {};
    d.progress[id] = rec;
    if (min > 0) d.listen[t] = Math.round(((Number(d.listen[t]) || 0) + min) * 10) / 10;
    return d;
  }, `Книги: ${(bookById(id) || {}).title || id} — глава ${rec.ch + 1}, ${mmss(rec.pos)}`, { books: [], progress: {}, listen: {} })
    .then(next => { if (next && next.books) { S.books = next; cacheNow(); } });
  const bkc = document.getElementById('bk-card'); if (bkc && S.tab === 'lessons') bkc.innerHTML = bookCardHtml();
}
function renderMini() {
  const el = document.getElementById('bk-mini'); if (!el) return;
  const p = S.play, b = p && bookById(p.id);
  if (!p || !b) { el.hidden = true; document.body.classList.remove('has-mini'); return; }
  const a = AU(), c = b.chapters[p.k] || {};
  el.hidden = false; document.body.classList.add('has-mini');
  el.innerHTML = `<button type="button" class="mini-pp" data-action="bk-toggle" aria-label="${a && !a.paused ? 'Пауза' : 'Играть'}">${p.loading ? '<span class="spin" aria-hidden="true"></span>' : a && !a.paused ? '❚❚' : ico('play')}</button><button type="button" class="mini-t" data-action="bk-player"><b>${esc(c.title || 'Глава ' + (p.k + 1))}</b><small>${esc(b.title)}</small></button><button type="button" class="mini-x" data-action="bk-stop" aria-label="Закрыть плеер">×</button>`;
}
const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
function playerHtml() {
  const p = S.play, b = p && bookById(p.id); if (!b) return '<p class="note">Ничего не играет.</p>';
  const a = AU(), c = b.chapters[p.k] || {}, dur = (a && isFinite(a.duration) && a.duration) || c.dur || 0, t = (a && a.currentTime) || 0, sp = Number(LS.get('bj-bk-speed')) || 1;
  return `<div class="bk-hero"><span class="bk-cov big">${esc(bookInit(b.title))}</span><div><h2 class="sh-title">${esc(c.title || 'Глава ' + (p.k + 1))}</h2><p class="sh-meta">${esc(b.title)}${b.author ? ' · ' + esc(b.author) : ''} · ${p.k + 1} из ${b.chapters.length}</p></div></div>
    <input type="range" id="bk-seek" class="bk-seek" min="0" max="${Math.max(1, Math.floor(dur))}" step="1" value="${Math.floor(t)}" aria-label="Позиция"${p.loading ? ' disabled' : ''}>
    <div class="bk-times"><span id="bk-t">${mmss(t)}</span><span id="bk-left">−${mmss(Math.max(0, dur - t))}</span></div>
    <div class="bk-ctl"><button type="button" class="bk-b" data-action="bk-prev" aria-label="Предыдущая глава"${p.k ? '' : ' disabled'}>⏮</button><button type="button" class="bk-b" data-action="bk-back" aria-label="Назад 15 секунд">−15</button><button type="button" class="bk-b main" data-action="bk-toggle" aria-label="Играть или пауза">${p.loading ? '<span class="spin" aria-hidden="true"></span>' : a && !a.paused ? '❚❚' : ico('play')}</button><button type="button" class="bk-b" data-action="bk-fwd" aria-label="Вперёд 30 секунд">+30</button><button type="button" class="bk-b" data-action="bk-next" aria-label="Следующая глава"${p.k + 1 < b.chapters.length ? '' : ' disabled'}>⏭</button></div>
    <div class="chips bk-speed">${SPEEDS.map(v => `<button type="button" class="chip-btn" data-action="bk-speed" data-v="${v}" aria-pressed="${v === sp}">${String(v).replace('.', ',')}×</button>`).join('')}</div>
    <button type="button" class="link-btn" data-action="bk-open" data-id="${esc(b.id)}">Все главы</button>`;
}
function openPlayer() { S.cur = { type: 'player' }; openSheet(playerHtml()); }
function renderPlayer() { if (S.cur && S.cur.type === 'player' && !$('#sheet').hidden) openSheet(playerHtml(), true); }
function playerTime() {
  if (!(S.cur && S.cur.type === 'player')) return;
  const a = AU(), sk = document.getElementById('bk-seek'); if (!a || !sk) return;
  if (document.activeElement !== sk) { if (isFinite(a.duration)) sk.max = Math.floor(a.duration); sk.value = Math.floor(a.currentTime || 0); }
  const t = document.getElementById('bk-t'), l = document.getElementById('bk-left');
  if (t) t.textContent = mmss(a.currentTime); if (l && isFinite(a.duration)) l.textContent = '−' + mmss(a.duration - a.currentTime);
}
async function bkPreloadNext() {
  const p = S.play, a = AU(); if (!p || S.bkNextLoaded || !a || !isFinite(a.duration) || a.currentTime < a.duration * 0.8) return;
  S.bkNextLoaded = true;
  const b = bookById(p.id), c = b && b.chapters[p.k + 1]; if (!c) return;
  try { await audioBlob(b.repo || booksRepo(), c.file); } catch (_) { S.bkNextLoaded = false; }
}
(function audioWire() {
  const a = AU(); if (!a) return;
  let lastUi = 0;
  a.addEventListener('timeupdate', () => { bkTick(false); bkPreloadNext(); const n = Date.now(); if (n - lastUi > 900) { lastUi = n; playerTime(); } });
  a.addEventListener('play', () => { if (S.play && !S.play.loading) { S.bkPlayedFrom = Date.now(); renderMini(); renderPlayer(); } });
  a.addEventListener('pause', () => { if (S.play && !S.play.loading) { bkSave(false); renderMini(); renderPlayer(); } });
  a.addEventListener('ended', () => { const p = S.play; if (!p || p.loading) return; bkSave(true); const b = bookById(p.id); if (b && p.k + 1 < b.chapters.length) bkPlay(p.id, p.k + 1, 0); else { toast('Книга дослушана'); renderMini(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.play) bkSave(false); });
  document.addEventListener('input', ev => { if (ev.target && ev.target.id === 'bk-seek') { const t = document.getElementById('bk-t'); if (t) t.textContent = mmss(Number(ev.target.value)); } });
  document.addEventListener('change', ev => { if (ev.target && ev.target.id === 'bk-seek') { try { a.currentTime = Number(ev.target.value); } catch (_) {} bkTick(true); } });
})();
async function uploadAudio(files, id) {
  const repo = booksRepo(), out = { media: [], names: [], failed: [] }, N = files.length;
  const totB = files.reduce((a, f) => a + (f.size || 0), 0) || 1; let doneB = 0;
  PROG.start(N > 1 ? `Отправляю книгу: ${N} ${plural(N, 'файл', 'файла', 'файлов')}` : 'Отправляю аудио');
  for (let k = 0; k < files.length; k++) {
    const f = files[k], ext = ((f.name || '').match(AUDIO_RE) || ['.mp3'])[0].toLowerCase();
    const path = `inbox/${id}_${pad(k + 1)}${ext}`;
    try {
      setSync(`книга: файл ${k + 1} из ${files.length} — читаю…`);
      PROG.step('prep', 0.3 + 0.7 * doneB / totB, `файл ${k + 1} из ${N} — читаю`);
      const b64 = await fileToBase64(f);
      await GH.commitFiles([{ path, b64 }], `Книги: ${f.name || path}`.slice(0, 120), (i, n, bd, bt) => { setSync(`книга: отправляю файл ${k + 1} из ${files.length}…`); PROG.step('up', (doneB + (f.size || 0) * bd / bt) / totB, `файл ${k + 1} из ${N} · ${Math.round((f.size || 0) * bd / bt / 1048576)} из ${Math.round((f.size || 0) / 1048576)} МБ`); }, repo);
      doneB += f.size || 0;
      out.media.push(path); out.names.push(f.name || '');
    } catch (e) { console.warn(e); out.failed.push(k + 1); doneB += f.size || 0; if (e.code === 'offline') break; }
  }
  PROG.done(!out.failed.length);
  setSync(syncLabel());
  return out;
}

/* ---------- boot ---------- */
function boot() {
  setTab('plan');
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
  if (document.hidden) return;
  renderTimerChip();
  if (GH.cred && Date.now() - S.lastLoad > 120000) loadAll(true);
});
window.addEventListener('online', () => { if (GH.cred) { S.offline = false; if (queueCount()) runFlush(); loadAll(true); } });
window.addEventListener('offline', () => setSync(queueNote() || 'нет сети · показаны сохранённые данные'));
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
// Новая версия журнала: сверяем app.js?v=… из свежего index.html с текущим и предлагаем перезайти.
const APP_VER = ((document.querySelector('script[src*="app.js"]') || {}).src || '').replace(/^.*[?&]v=([^&]+).*$/, '$1');
let verSeen = 0, verNew = '';
async function checkVersion() {
  if (!APP_VER || verNew || Date.now() - verSeen < 60000) return;
  verSeen = Date.now();
  try {
    const res = await fetch('index.html?vcheck=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const html = await res.text(), m = html.match(/app\.js\?v=([^"'&]+)/);
    if (!m || m[1] === APP_VER) return;
    verNew = m[1];
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = 'Новая версия журнала · Обновить';
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(10px + env(safe-area-inset-top,0px));z-index:70;background:var(--ink);color:var(--on-ink);border:0;border-radius:999px;padding:11px 18px;font:inherit;font-size:14px;font-weight:600;white-space:nowrap;box-shadow:var(--shadow);max-width:calc(100% - 32px)';
    el.addEventListener('click', async () => {
      el.textContent = 'Обновляю…'; el.disabled = true;
      try {
        // кладём свежую страницу в кэш оболочки, чтобы перезагрузка сразу открыла новую версию, а не со второго раза
        if (window.caches) for (const k of await caches.keys()) if (k.startsWith('bj-shell-')) await (await caches.open(k)).put(new Request('index.html'), new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if (reg) await Promise.race([reg.update(), new Promise(r => setTimeout(r, 3000))]);
      } catch (e) {}
      location.reload();
    });
    document.body.appendChild(el);
  } catch (e) {}
}
setTimeout(checkVersion, 1500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
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
