// Mesa de RPG – servidor (Node.js + WebSocket). Regras de teste: Ordem Paranormal II (playtest).
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const { presets, STD, CREATURES } = require('./chars');

const PORT = process.env.PORT || 3000;
const GM_PASSWORD = process.env.GM_PASSWORD || 'mestre';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'state.json'), DOCS_DIR = path.join(DATA_DIR, 'docs');
const COLS = 22, ROWS = 14, N = COLS * ROWS, VER = 4;
const ATTR = { Acrobacia:0, Animais:2, Aptidão:1, Atletismo:0, Bruxaria:1, Crime:0, Disciplina:2, Enganação:2, Furtividade:0, Inspecionar:1, Intimidar:2, Intuição:2, Luta:0, Medicina:1, Ofício:1, Percepção:1, Persuasão:2, Pontaria:0, Sobrevivência:1, Vigor:0 };
const STEPS = [4,6,8,10,12], FACES = [4,6,8,10,12,20], CL = ['executor','vigilante','analista'];
const base = n => String(n).replace(/\s*\(.*\)\s*/, '').trim();
const attrOf = n => ATTR[base(n)] ?? 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.trunc(Number(v)) || 0));
const face = v => FACES.includes(Number(v)) ? Number(v) : 6;
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const lst = (a, n, f) => (Array.isArray(a) ? a : []).slice(0, n).map(x => f(x && typeof x === 'object' ? x : {}));
const blank = () => cleanS({ sk: STD.map(n => ({ n, d: 4 })) });
function cleanS(s) {
  if (!s || typeof s !== 'object') s = {};
  const o = { cl: CL.includes(s.cl) ? s.cl : 'executor', or: str(s.or, 40), lv: clamp(s.lv, 1, 20), ag: clamp(s.ag, 0, 999), ds: str(s.ds, 300),
    at: [0,1,2].map(i => face(s.at && s.at[i])), up: [0,1,2].map(i => clamp(s.up && s.up[i], 0, 2)),
    sk: lst(s.sk, 40, x => ({ n: str(x.n, 40) || 'Perícia', d: face(x.d) })),
    pd: [clamp(s.pd && s.pd[0], 0, 999), clamp(s.pd && s.pd[1], 0, 999)], im: clamp(s.im, 0, 5), an: clamp(s.an, 0, 4), ar: clamp(s.ar, 0, 9),
    ab: lst(s.ab, 14, x => ({ n: str(x.n, 40), t: str(x.t, 1200) })),
    eq: lst(s.eq, 14, x => ({ n: str(x.n, 50), k: ['c','d','i'].includes(x.k) ? x.k : 'i', dm: str(x.dm, 16), t: str(x.t, 400) })),
    rl: lst(s.rl, 14, x => ({ n: str(x.n, 20), p: clamp(x.p, 0, 3), l: str(x.l, 24), t: str(x.t, 200) })),
    bio: str(s.bio, 3000) };
  o.pd[0] = Math.min(o.pd[0], o.pd[1]); return o;
}
let state = { ver: VER, tokens: presets().map(t => ({ ...t, s: cleanS(t.s) })), map: null, log: [], open: true };
try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (d.ver === VER) state = d; } catch (e) {}
const norm = () => { state.tokens.forEach(t => { if (t.cb === undefined) t.cb = true; if (t.pc === undefined) t.pc = /^t[1-8]$/.test(t.id); });
  state.docs = state.docs || [];
  // migração (mesas já em andamento): adiciona personagens novos e completa a ficha do Cormac sem apagar nada
  const PR = presets(); PR.forEach(p => { if (!state.tokens.find(t => t.id === p.id)) state.tokens.push({ ...p, s: cleanS(p.s) }); });
  const cm = state.tokens.find(t => t.id === 't1'), cp = PR.find(p => p.id === 't1');
  if (cm && cm.s && cp && !cm.s.rl.length) { const c = cleanS(cp.s); cm.s.rl = c.rl; cm.s.ag = cm.s.ag || c.ag; cm.s.ds = cm.s.ds || c.ds; }
  state.tokens.forEach(t => { if (t.id === 't1' && t.s && !t.s.ag) t.s.ag = 22; });
  state.tokens.forEach(t => { const pp = PR.find(p => p.id === t.id); if (pp && t.s && !t.s.bio) t.s.bio = cleanS(pp.s).bio; });
  state.fog = state.fog || { on: false, seen: '0'.repeat(N), walls: '0'.repeat(N) }; if (state.open === undefined) state.open = true;
  state.combat = state.combat || { on: false, round: 1, phase: 0, mode: 'perfil', pick: {}, done: {} }; };
norm();
let seq = state.log.reduce((m, r) => Math.max(m, r.id || 0), 0);
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(() => {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(state)); } catch (e) { console.error('save', e.message); } }, 800); }

// ---- rolagem (regras do livro) ----
const rd = n => 1 + Math.floor(Math.random() * n);
const stepDie = (f, st) => { if (f === 20) return 20; return STEPS[Math.max(0, Math.min(4, STEPS.indexOf(f) + st))]; };
const modOf = dm => { const m = /RA\s*([+\-−])\s*(\d+)/i.exec(dm || ''); return m ? (m[1] === '+' ? 1 : -1) * +m[2] : 0; };
function evalDice(dice, dt, pav) {
  const v0 = dice.map(d => pav && d.v < pav ? 0 : d.v);                      // dado de pavor anula menores
  const kept = v0.map((_, i) => i).sort((a, b) => v0[b] - v0[a]).slice(0, 3); // soma no máximo 3
  const vals = kept.map(i => v0[i]), total = vals.reduce((a, b) => a + b, 0);
  const crit = vals.every(v => v <= 1) ? 'f' : vals.some((v, x) => v >= 6 && vals.indexOf(v) !== x) ? 's' : null;
  return { total, crit, ok: crit === 's' ? true : crit === 'f' ? false : total >= dt, ra: Math.max(...vals), rb: Math.min(...vals), top2: (vals[0] || 0) + (vals[1] || 0) };
}
function finalize(r) {
  const { top2, ...e } = evalDice(r.dice, r.dt, r.pav); Object.assign(r, e);
  r.dm = r.w !== null && r.ok ? (r.crit === 's' ? top2 : r.ra) + r.wm : null; return r;
}
function rollTest(t, i, p) {
  const s = t.s; let w = null;
  if (p.w >= 0 && s.eq[p.w] && s.eq[p.w].k !== 'i') { w = s.eq[p.w]; const j = s.sk.findIndex(x => base(x.n) === (w.k === 'c' ? 'Luta' : 'Pontaria')); if (j >= 0) i = j; }
  const sk = s.sk[i], ai = attrOf(sk.n);
  const dice = [{ f: stepDie(sk.d, p.step) }, { f: stepDie(s.at[ai], s.up[ai]) }];
  if (p.bonus === 'i4' && s.im >= 1) { s.im--; dice.push({ f: 4 }); }
  else if (p.bonus === 'l6') dice.push({ f: 6 });
  else if (p.bonus === 'p8' && s.pd[0] >= 3) { s.pd[0] -= 3; dice.push({ f: 8 }); }
  dice.forEach(d => d.v = rd(d.f));
  const r = { id: ++seq, tid: t.id, n: t.n, p: w ? w.n + ' · ' + sk.n : sk.n, dice, pav: p.pav ? rd(6) : 0, dt: p.dt, w: w ? w.n : null, wm: w ? modOf(w.dm) : 0 };
  finalize(r);
  if (!r.ok && s.cl === 'executor' && s.im < 5) s.im++;                       // falha preenche o ímpeto
  return r;
}

// ---- servidor ----
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  const root = path.join(__dirname, 'public'), f = path.join(root, path.normalize(p));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});
const wss = new WebSocketServer({ server, maxPayload: 4 * 1024 * 1024 });
const light = ({ s, img, ...r }) => r;
// Jogadores não recebem a ficha (nem os números de PV) de criaturas/NPCs; só o mestre e o dono do token.
const seesSheet = (ws, t) => ws.me.gm || t.pc || (t.o && t.o === ws.me.name);
const viewTok = (ws, t, full) => {
  let v = seesSheet(ws, t) ? t : { ...t, hp: Math.round(100 * t.hp / Math.max(1, t.max)), max: 100 };
  if (!seesSheet(ws, t)) v = { ...v, s: undefined };
  return full ? v : light(v);
};
const liveClients = f => wss.clients.forEach(c => { if (c.me && c.readyState === 1) f(c); });
const statB = except => liveClients(c => { if (c !== except) c.send(JSON.stringify({ t: 'state', tokens: state.tokens.map(t => viewTok(c, t, false)) })); });
const fullB = () => liveClients(c => c.send(JSON.stringify({ t: 'full', tokens: state.tokens.map(t => viewTok(c, t, true)) })));
const sheetB = t => liveClients(c => { if (seesSheet(c, t)) c.send(JSON.stringify({ t: 'sheet', id: t.id, s: t.s })); });
const send = (ws, m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
const bcast = (m, except) => { const s = JSON.stringify(m); wss.clients.forEach(c => { if (c !== except && c.me && c.readyState === 1) c.send(s); }); };
const online = () => [...wss.clients].filter(c => c.me).map(c => c.me.name + (c.me.gm ? ' (mestre)' : ''));
const sendPresence = () => bcast({ t: 'who', list: online() });
const canEdit = (ws, t) => t && (ws.me.gm || (t.o && t.o === ws.me.name) || (state.open && t.pc));
const fogB = () => bcast({ t: 'fog', f: state.fog });
const docOk = m => /^(application\/pdf|image\/(png|jpeg|webp|gif))$/.test(m);
const docsFor = ws => state.docs.filter(d => ws.me.gm || d.vis).map(d => ({ id: d.id, name: d.name, mime: d.mime, size: d.size, vis: d.vis, note: d.text !== undefined }));
const docsB = () => wss.clients.forEach(c => { if (c.me) send(c, { t: 'docs', list: docsFor(c) }); });
// ---- luz e visão (mesma lógica no cliente): linha de visão por Bresenham, paredes bloqueiam ----
function litCells(x, y, r, walls) {
  const out = [];
  for (let cy = Math.max(0, y - r); cy <= Math.min(ROWS - 1, y + r); cy++) for (let cx = Math.max(0, x - r); cx <= Math.min(COLS - 1, x + r); cx++) {
    const dx = cx - x, dy = cy - y; if (dx * dx + dy * dy > r * r + 0.5) continue;
    let x0 = x, y0 = y, blocked = false; const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, ax = Math.abs(dx), ay = Math.abs(dy); let err = ax - ay;
    while (!(x0 === cx && y0 === cy)) { const e2 = 2 * err; if (e2 > -ay) { err -= ay; x0 += sx; } if (e2 < ax) { err += ax; y0 += sy; }
      if (x0 === cx && y0 === cy) break; if (walls[y0 * COLS + x0] === '1') { blocked = true; break; } }
    if (!blocked) out.push(cy * COLS + cx);
  }
  return out;
}
function recalc() {
  const f = state.fog; if (!f.on) return; const sn = f.seen.split(''); let ch = false;
  for (const t of state.tokens) { if (!t.on) continue; const r = t.lr > 0 ? t.lr : (t.pc ? 1 : 0); if (!r) continue;
    for (const i of litCells(t.x, t.y, r, f.walls)) if (sn[i] === '0') { sn[i] = '1'; ch = true; } }
  if (ch) { f.seen = sn.join(''); fogB(); }
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'join') {
      const name = String(m.name || '').trim().slice(0, 20) || 'Jogador';
      const gm = !!m.pw && m.pw === GM_PASSWORD;
      if (m.pw && !gm) return send(ws, { t: 'error', msg: 'Senha de mestre incorreta.' });
      ws.me = { name, gm };
      send(ws, { t: 'init', me: ws.me, tokens: state.tokens.map(t => viewTok(ws, t, true)), map: state.map, log: state.log, combat: state.combat, fog: state.fog, open: state.open, docs: docsFor(ws), lib: CREATURES.map(c => ({ key: c.key, name: c.name, img: c.img, z: c.z, hp: c.hp })) });
      return sendPresence();
    }
    if (!ws.me) return;
    const gm = ws.me.gm, t = state.tokens.find(k => k.id === m.id);
    const getLog = () => state.log.find(x => x.id === m.rid);
    switch (m.t) {
      case 'move': if (!canEdit(ws, t)) return;
        t.x = clamp(m.x, 0, COLS - (t.z || 1)); t.y = clamp(m.y, 0, ROWS - (t.z || 1)); statB(ws); recalc(); save(); break;
      case 'patch': { if (!canEdit(ws, t) || !m.f) return; const f = m.f;
        if ('n' in f) t.n = str(f.n, 24); if ('sub' in f) t.sub = str(f.sub, 40);
        if ('c' in f && /^#[0-9a-f]{6}$/i.test(f.c)) t.c = f.c;
        if ('max' in f) t.max = Math.max(1, clamp(f.max, 1, 999)); if ('hp' in f) t.hp = clamp(f.hp, 0, 999);
        t.hp = Math.min(t.hp, t.max); statB();
        if ('s' in f) { t.s = cleanS(f.s); sheetB(t); } save(); break; }
      case 'add': if (!gm) return;
        state.tokens.push({ id: 't' + Date.now().toString(36) + rd(99), n: 'Novo', sub: '', x: 1, y: 1, hp: 10, max: 10, c: '#c79a2b', o: '', cb: true, pc: false, on: true, z: 1, lr: 0, s: blank() });
        if (state.tokens.length > 60) state.tokens.shift();
        fullB(); save(); break;
      case 'reset': if (!gm) return; state.tokens = presets().map(x => ({ ...x, s: cleanS(x.s) })); state.log = []; state.combat = null; norm(); recalc();
        fullB(); save(); break;
      case 'place': { if (!gm) return; const px = clamp(m.x, 0, COLS - 1), py = clamp(m.y, 0, ROWS - 1);
        if (m.kind === 'pc') { if (!t || !t.pc) return; t.on = true; t.x = Math.min(px, COLS - t.z); t.y = Math.min(py, ROWS - t.z); }
        else { const c = CREATURES.find(k => k.key === m.key); if (!c) return; const same = state.tokens.filter(k => k.cr === c.key).length;
          state.tokens.push({ id: 'c' + Date.now().toString(36) + rd(99), cr: c.key, n: c.name + (same ? ' ' + (same + 1) : ''), sub: '', x: Math.min(px, COLS - c.z), y: Math.min(py, ROWS - c.z),
            hp: c.hp, max: c.hp, c: '#555555', o: '', cb: true, pc: false, on: true, z: c.z, lr: 0, img: c.img, s: cleanS(c.s) }); }
        fullB(); recalc(); save(); break; }
      case 'unplace': { if (!gm || !t) return; if (t.pc) t.on = false; else state.tokens = state.tokens.filter(k => k !== t);
        delete state.combat.pick[t.id]; delete state.combat.done[t.id]; fullB(); bcast({ t: 'combat', c: state.combat }); save(); break; }
      case 'tok': { if (!canEdit(ws, t)) return; if ('z' in m) t.z = m.z === 2 ? 2 : 1; if (gm && 'lr' in m) t.lr = clamp(m.lr, 0, 12);
        t.x = Math.min(t.x, COLS - t.z); t.y = Math.min(t.y, ROWS - t.z); statB(); recalc(); save(); break; }
      case 'claim': { if (!t || !t.pc) return;
        if (m.v) { if (t.o && !gm && t.o !== ws.me.name) return; t.o = ws.me.name; } else { if (!(gm || t.o === ws.me.name)) return; t.o = ''; }
        statB(); save(); break; }
      case 'open': if (!gm) return; state.open = !!m.v; bcast({ t: 'cfg', open: state.open }); save(); break;
      case 'fogop': { if (!gm) return; const f = state.fog;
        if (m.op === 'on') f.on = !!m.v; else if (m.op === 'clear') f.seen = '0'.repeat(N); else if (m.op === 'all') f.seen = '1'.repeat(N); else if (m.op === 'clearwalls') f.walls = '0'.repeat(N);
        else if (m.op === 'paint') { const k = m.kind === 'wall' ? 'walls' : 'seen', a = f[k].split(''); for (const i of (Array.isArray(m.cells) ? m.cells : []).slice(0, 400)) a[clamp(i, 0, N - 1)] = m.v ? '1' : '0'; f[k] = a.join(''); }
        else return; fogB(); recalc(); save(); break; }
      case 'docup': { if (!gm) return;
        const mm = /^data:([\w.+\-\/]+);base64,([A-Za-z0-9+\/=]+)$/.exec(String(m.data || ''));
        if (!mm || !docOk(mm[1])) return send(ws, { t: 'notice', msg: 'Formato não suportado. Use PDF, PNG, JPG, WEBP ou GIF.' });
        const buf = Buffer.from(mm[2], 'base64'); if (buf.length > 2.5 * 1024 * 1024) return send(ws, { t: 'notice', msg: 'Arquivo grande demais (máximo 2,5 MB).' });
        const id = 'd' + Date.now().toString(36) + rd(99);
        try { fs.mkdirSync(DOCS_DIR, { recursive: true }); fs.writeFileSync(path.join(DOCS_DIR, id), buf); } catch (e) { return send(ws, { t: 'notice', msg: 'Não consegui salvar o arquivo no servidor.' }); }
        state.docs.push({ id, name: str(m.name, 80) || 'Documento', mime: mm[1], size: buf.length, vis: false }); docsB(); save(); break; }
      case 'docnote': { if (!gm) return; state.docs.push({ id: 'd' + Date.now().toString(36) + rd(99), name: str(m.name, 80) || 'Nota', mime: 'text/plain', size: 0, vis: false, text: str(m.text, 30000) }); docsB(); save(); break; }
      case 'docvis': { if (!gm) return; const d = state.docs.find(x => x.id === m.id); if (!d) return; d.vis = !!m.v; docsB(); save(); break; }
      case 'docdel': { if (!gm) return; const d = state.docs.find(x => x.id === m.id); if (!d) return; state.docs = state.docs.filter(x => x !== d); try { fs.unlinkSync(path.join(DOCS_DIR, d.id)); } catch (e) {} docsB(); save(); break; }
      case 'docget': { const d = state.docs.find(x => x.id === m.id); if (!d || !(gm || d.vis)) return;
        if (d.text !== undefined) return send(ws, { t: 'doc', id: d.id, name: d.name, mime: d.mime, text: d.text });
        try { const b = fs.readFileSync(path.join(DOCS_DIR, d.id)); send(ws, { t: 'doc', id: d.id, name: d.name, mime: d.mime, data: 'data:' + d.mime + ';base64,' + b.toString('base64') }); } catch (e) { send(ws, { t: 'notice', msg: 'Arquivo não encontrado no servidor (o disco pode ter sido apagado).' }); } break; }
      case 'docshow': { if (!gm) return; const d = state.docs.find(x => x.id === m.id); if (!d) return; d.vis = true; docsB(); bcast({ t: 'docshow', id: d.id }); save(); break; }
      case 'img': { if (!canEdit(ws, t)) return;
        t.img = (typeof m.data === 'string' && m.data.startsWith('data:image/') && m.data.length < 450000) ? m.data : null;
        bcast({ t: 'img', id: t.id, data: t.img }); save(); break; }
      case 'combat': { const c = state.combat, op = m.op;
        if (op === 'pick') { if (!canEdit(ws, t)) return; const v = clamp(m.ph, -2, 2); if (v === -2) delete c.pick[t.id]; else c.pick[t.id] = v; }
        else if (op === 'done') { if (!canEdit(ws, t)) return; c.done[t.id] = !c.done[t.id]; }
        else if (!gm) return;
        else if (op === 'start') { state.combat = { on: true, round: 1, phase: 0, mode: c.mode, pick: {}, done: {} }; }
        else if (op === 'stop') c.on = false;
        else if (op === 'next') { c.phase++; if (c.phase > 2) { c.phase = 0; c.round++; c.pick = {}; c.done = {}; } }
        else if (op === 'prev') { if (c.phase > 0) c.phase--; else if (c.round > 1) { c.round--; c.phase = 2; } }
        else if (op === 'mode') c.mode = m.v === 'livro' ? 'livro' : 'perfil';
        else if (op === 'cb' && t) { t.cb = !!m.v; statB(); }
        else if (op === 'pc' && t) { t.pc = !!m.v; fullB(); }
        else return;
        bcast({ t: 'combat', c: state.combat }); save(); break; }
      case 'del': if (!gm || !t) return; state.tokens = state.tokens.filter(k => k !== t); delete state.combat.pick[t.id]; delete state.combat.done[t.id]; statB(); bcast({ t: 'combat', c: state.combat }); save(); break;
      case 'clearcr': { if (!gm) return; const rm = state.tokens.filter(k => !k.pc); state.tokens = state.tokens.filter(k => k.pc);
        rm.forEach(k => { delete state.combat.pick[k.id]; delete state.combat.done[k.id]; }); fullB(); bcast({ t: 'combat', c: state.combat }); save(); break; }
      case 'owner': if (!gm || !t) return; t.o = str(m.o, 20); fullB(); save(); break;
      case 'map': if (!gm) return;
        state.map = (typeof m.data === 'string' && m.data.startsWith('data:image/') && m.data.length < 3e6) ? m.data : null;
        bcast({ t: 'map', data: state.map }); save(); break;
      case 'roll': { if (!canEdit(ws, t) || !t.s.sk.length) return;
        const r = rollTest(t, clamp(m.i, 0, t.s.sk.length - 1), { dt: clamp(m.dt, 1, 99) || 7, step: clamp(m.step, -2, 2), bonus: str(m.bonus, 4), pav: !!m.pav, w: m.w == null ? -1 : clamp(m.w, -1, 13) });
        r.by = ws.me.name; state.log.unshift(r); state.log.length = Math.min(state.log.length, 40);
        sheetB(t); bcast({ t: 'roll', r }); save(); break; }
      case 'adj': { const r = getLog(); if (!r || !canEdit(ws, t) || t.s.cl !== 'analista' || t.s.an < 1 || r.tid !== t.id) return;   // Análise: ±1 em um dado
        const d = r.dice[clamp(m.di, 0, r.dice.length - 1)], dir = m.dir > 0 ? 1 : -1;
        if (!d || d.v + dir < 1 || d.v + dir > d.f) return; d.v += dir; t.s.an--; finalize(r);
        sheetB(t); bcast({ t: 'roll', r, upd: 1 }); save(); break; }
      case 'reroll': { const r = getLog(); if (!r || !canEdit(ws, t) || t.s.cl !== 'vigilante' || t.s.pd[0] < 2) return;      // Prontidão: 2 PD
        const d = r.dice[clamp(m.di, 0, r.dice.length - 1)]; if (!d || d.v === 1) return;
        t.s.pd[0] -= 2; d.v = rd(d.f); finalize(r);
        sheetB(t); bcast({ t: 'roll', r, upd: 1 }); save(); break; }
    }
  });
  ws.on('close', sendPresence);
});
server.listen(PORT, () => console.log('Mesa de RPG em http://localhost:' + PORT + (process.env.GM_PASSWORD ? '' : '  (senha de mestre padrão: "mestre" – defina GM_PASSWORD!)')));
