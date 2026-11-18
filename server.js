// Mesa de RPG – servidor (Node.js + WebSocket). Regras de teste: Ordem Paranormal II (playtest).
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const { presets, STD } = require('./chars');

const PORT = process.env.PORT || 3000;
const GM_PASSWORD = process.env.GM_PASSWORD || 'mestre';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'state.json');
const COLS = 22, ROWS = 14, VER = 3;
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
let state = { ver: VER, tokens: presets().map(t => ({ ...t, s: cleanS(t.s) })), map: null, log: [] };
try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (d.ver === VER) state = d; } catch (e) {}
const norm = () => { state.tokens.forEach(t => { if (t.cb === undefined) t.cb = true; if (t.pc === undefined) t.pc = /^t[1-7]$/.test(t.id); });
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
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  const root = path.join(__dirname, 'public'), f = path.join(root, path.normalize(p));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});
const wss = new WebSocketServer({ server, maxPayload: 4 * 1024 * 1024 });
const light = ({ s, img, ...r }) => r;
const pub = () => ({ t: 'state', tokens: state.tokens.map(light) });
const sheetB = t => bcast({ t: 'sheet', id: t.id, s: t.s });
const send = (ws, m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
const bcast = (m, except) => { const s = JSON.stringify(m); wss.clients.forEach(c => { if (c !== except && c.me && c.readyState === 1) c.send(s); }); };
const online = () => [...wss.clients].filter(c => c.me).map(c => c.me.name + (c.me.gm ? ' (mestre)' : ''));
const sendPresence = () => bcast({ t: 'who', list: online() });
const canEdit = (ws, t) => t && (ws.me.gm || (t.o && t.o === ws.me.name));

wss.on('connection', ws => {
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'join') {
      const name = String(m.name || '').trim().slice(0, 20) || 'Jogador';
      const gm = !!m.pw && m.pw === GM_PASSWORD;
      if (m.pw && !gm) return send(ws, { t: 'error', msg: 'Senha de mestre incorreta.' });
      ws.me = { name, gm };
      send(ws, { t: 'init', me: ws.me, tokens: state.tokens, map: state.map, log: state.log, combat: state.combat });
      return sendPresence();
    }
    if (!ws.me) return;
    const gm = ws.me.gm, t = state.tokens.find(k => k.id === m.id);
    const getLog = () => state.log.find(x => x.id === m.rid);
    switch (m.t) {
      case 'move': if (!canEdit(ws, t)) return;
        t.x = clamp(m.x, 0, COLS - 1); t.y = clamp(m.y, 0, ROWS - 1); bcast(pub(), ws); save(); break;
      case 'patch': { if (!canEdit(ws, t) || !m.f) return; const f = m.f;
        if ('n' in f) t.n = str(f.n, 24); if ('sub' in f) t.sub = str(f.sub, 40);
        if ('c' in f && /^#[0-9a-f]{6}$/i.test(f.c)) t.c = f.c;
        if ('max' in f) t.max = Math.max(1, clamp(f.max, 1, 999)); if ('hp' in f) t.hp = clamp(f.hp, 0, 999);
        t.hp = Math.min(t.hp, t.max); bcast(pub());
        if ('s' in f) { t.s = cleanS(f.s); sheetB(t); } save(); break; }
      case 'add': if (!gm) return;
        state.tokens.push({ id: 't' + Date.now().toString(36) + rd(99), n: 'Novo', sub: '', x: 1, y: 1, hp: 10, max: 10, c: '#c79a2b', o: '', cb: true, pc: false, s: blank() });
        if (state.tokens.length > 60) state.tokens.shift();
        bcast({ t: 'full', tokens: state.tokens }); save(); break;
      case 'reset': if (!gm) return; state.tokens = presets().map(x => ({ ...x, s: cleanS(x.s) })); state.log = []; state.combat = null; norm();
        bcast({ t: 'full', tokens: state.tokens }); save(); break;
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
        else if (op === 'cb' && t) { t.cb = !!m.v; bcast(pub()); }
        else if (op === 'pc' && t) { t.pc = !!m.v; bcast(pub()); }
        else return;
        bcast({ t: 'combat', c: state.combat }); save(); break; }
      case 'del': if (!gm || !t) return; state.tokens = state.tokens.filter(k => k !== t); delete state.combat.pick[t.id]; delete state.combat.done[t.id]; bcast(pub()); bcast({ t: 'combat', c: state.combat }); save(); break;
      case 'owner': if (!gm || !t) return; t.o = str(m.o, 20); bcast(pub()); save(); break;
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
