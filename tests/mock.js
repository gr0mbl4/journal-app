// Мок GitHub API для журнала: файлы из каталога данных, запись — в память.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
function makeStore(dir) {
  const files = {};
  if (dir) (function walk(d, pre) {
    for (const n of fs.readdirSync(d)) {
      if (n === '.git' || n === 'node_modules') continue;
      const p = path.join(d, n), rel = pre ? pre + '/' + n : n;
      if (fs.statSync(p).isDirectory()) walk(p, rel);
      else if (/\.(json|md)$/.test(n) && fs.statSync(p).size < 3e6) files[rel] = fs.readFileSync(p);
    }
  })(dir, '');
  return files;
}
const sha = b => crypto.createHash('sha1').update(b).digest('hex');
async function install(context, store, opts = {}) {
  const owner = opts.owner || 'gr0mbl4', writes = [];
  await context.route('https://api.github.com/**', async route => {
    const req = route.request(), u = new URL(req.url()), m = req.method(), p = decodeURIComponent(u.pathname);
    const json = (code, body, h) => route.fulfill({ status: code, contentType: 'application/json', headers: Object.assign({ 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag' }, h || {}), body: JSON.stringify(body) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (p === '/user') return json(200, { login: owner });
    let mm = /^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/.exec(p);
    if (!mm) return json(404, { message: 'Not Found' });
    const rest = mm[3] || '';
    if (!rest) return json(200, { private: true, default_branch: 'main', permissions: { push: true }, full_name: mm[1] + '/' + mm[2] });
    if (rest.startsWith('/contents/') || rest === '/contents') {
      const fp = rest.replace(/^\/contents\/?/, '');
      if (m === 'GET') {
        if (store[fp]) {
          const raw = req.headers()['accept'] && req.headers()['accept'].includes('raw');
          if (raw) return route.fulfill({ status: 200, body: store[fp], headers: { 'access-control-allow-origin': '*' } });
          const s = sha(store[fp]), etag = '"' + s + '"';
          if (req.headers()['if-none-match'] === etag) return route.fulfill({ status: 304, headers: { 'access-control-allow-origin': '*', ETag: etag } });
          return json(200, { sha: s, content: store[fp].toString('base64'), encoding: 'base64', path: fp, name: fp.split('/').pop(), type: 'file' }, { ETag: etag });
        }
        const pre = fp ? fp + '/' : '';
        const kids = new Map();
        Object.keys(store).filter(k => k.startsWith(pre)).forEach(k => { const r = k.slice(pre.length), n = r.split('/')[0]; kids.set(n, r.includes('/') ? 'dir' : 'file'); });
        if (kids.size) return json(200, Array.from(kids, ([name, type]) => ({ name, type, path: pre + name, sha: sha(Buffer.from(pre + name)) })));
        return json(404, { message: 'Not Found' });
      }
      if (m === 'PUT') {
        const b = JSON.parse(req.postData() || '{}');
        if (store[fp] && b.sha && b.sha !== sha(store[fp])) return json(409, { message: 'conflict' });
        store[fp] = Buffer.from(b.content || '', 'base64'); writes.push({ path: fp, msg: b.message });
        return json(200, { content: { sha: sha(store[fp]), path: fp } });
      }
      if (m === 'DELETE') { delete store[fp]; writes.push({ path: fp, del: true }); return json(200, {}); }
    }
    if (rest === '/issues' || rest.startsWith('/issues?') || rest.startsWith('/issues')) return json(200, m === 'GET' ? [] : { number: 1 });
    if (rest.startsWith('/commits')) return json(200, []);
    if (rest.startsWith('/git/refs/heads/') || rest.startsWith('/git/ref/heads/')) {
      if (m === 'GET') return json(200, { object: { sha: 'head0' } });
      return json(200, { object: { sha: 'head1' } });
    }
    if (rest.startsWith('/git/commits/')) return json(200, { tree: { sha: 'tree0' } });
    if (rest === '/git/blobs') { const b = JSON.parse(req.postData() || '{}'); const s = sha(Buffer.from(b.content || '')); store.__blobs = store.__blobs || {}; store.__blobs[s] = b.content; return json(201, { sha: s }); }
    if (rest === '/git/trees') { const b = JSON.parse(req.postData() || '{}'); store.__tree = b.tree; return json(201, { sha: 'tree1' }); }
    if (rest === '/git/commits') return json(201, { sha: 'c1' });
    if (rest.startsWith('/git/trees/')) return json(200, { tree: Object.keys(store).filter(k => !k.startsWith('__')).map(k => ({ path: k, type: 'blob', sha: sha(store[k]) })) });
    if (rest.startsWith('/actions')) return json(200, { workflow_runs: [] });
    return json(404, { message: 'Not Found' });
  });
  return writes;
}
module.exports = { makeStore, install };
