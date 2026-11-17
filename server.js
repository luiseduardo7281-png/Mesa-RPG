// Mesa de RPG – servidor (Node.js + WebSocket). Regras de teste: Ordem Paranormal II (playtest).
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const GM_PASSWORD = process.env.GM_PASSWORD || 'mestre';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'state.json');
const COLS = 22, ROWS = 14;
const SKILLS = [['Acrobacia',0],['Animais',2],['Aptidão (Erudição)',1],['Aptidão (Guerra)',1],['Aptidão (Nobreza)',1],['Atletismo',0],['Bruxaria',1],['Crime',0],['Disciplina',2],['Enganação',2],['Furtividade',0],['Inspecionar',1],['Intimidar',2],['Intuição',2],['Luta',0],['Medicina',1],['Ofício',1],['Percepção',1],['Persuasão',2],['Pontaria',0],['Sobrevivência',1],['Vigor',0]];
const STEPS = [4, 6, 8, 10, 12], FACES = [4, 6, 8, 10, 12, 20];

const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.trunc(Number(v)) || 0));
const face = v => FACES.includes(Number(v)) ? Number(v) : 6;
const blank = () => ({ cl: '', lv: 1, at: [6,6,6], k: SKILLS.map(() => 4), pd: [10,10], im: 0, nt: '' });
function cleanS(s) {
  if (!s || typeof s !== 'object') return blank();
  return { cl: String(s.cl || '').slice(0, 60), lv: clamp(s.lv, 1, 20),
    at: [0,1,2].map(i => face(s.at && s.at[i])), k: SKILLS.map((_, i) => face(s.k && s.k[i])),
    pd: [clamp(s.pd && s.pd[0], 0, 999), clamp(s.pd && s.pd[1], 0, 999)], im: clamp(s.im, 0, 5), nt: String(s.nt || '').slice(0, 1500) };
}
const cormac = () => ({ cl: 'Executor · Aristocrata', lv: 3, at: [8,8,6],
  k: [4,4,6,6,6,6,4,4,8,4,6,6,4,4,8,4,6,6,6,4,4,8], pd: [15,15], im: 0,
  nt: 'Herança: riqueza +1.\nPlano Estratégico (1 ação + 3 PD): teste de Aptidão (Guerra) vs DT 7.\nEquipamento: espada forjada em castelo (RA +3), cota de malha (armadura 2, Furtividade −1 passo).' });

let state = { tokens: [{ id: 't1', n: 'Cormac', x: 4, y: 5, hp: 17, max: 17, c: '#b5483a', o: '', s: cormac() }], map: null, log: [] };
try { state = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {}
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(() => {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(state)); } catch (e) { console.error('save', e.message); } }, 800); }

// ---- rolagem (regras do livro) ----
const rd = n => 1 + Math.floor(Math.random() * n);
const stepDie = (f, st) => { if (f === 20) return 20; let i = STEPS.indexOf(f) + st; return STEPS[Math.max(0, Math.min(STEPS.length - 1, i))]; };
function rollTest(t, i, dt, step, extra) {
  const [nome, ai] = SKILLS[i];
  const faces = [stepDie(t.s.k[i], step), t.s.at[ai]];
  for (let e = 0; e < extra; e++) faces.push(6); // dado extra: d6 (ajuste conforme a habilidade)
  const dice = faces.slice(0, 4).map(f => ({ f, v: rd(f) }));
  const kept = [...dice].sort((a, b) => b.v - a.v).slice(0, 3);
  const vals = kept.map(d => d.v), total = vals.reduce((a, b) => a + b, 0);
  const crit = vals.some((v, x) => v >= 6 && vals.indexOf(v) !== x) ? 's' : vals.every(v => v === 1) ? 'f' : null;
  const ok = crit === 's' ? true : crit === 'f' ? false : total >= dt;
  return { n: t.n, p: nome, dice, total, dt, ok, crit, ra: Math.max(...vals), rb: Math.min(...vals) };
}

// ---- servidor ----
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(__dirname, 'public', path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!f.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});
const wss = new WebSocketServer({ server, maxPayload: 4 * 1024 * 1024 });
const pub = () => ({ t: 'state', tokens: state.tokens });
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
      const gm = m.pw !== undefined && m.pw !== '' && m.pw === GM_PASSWORD;
      if (m.pw && !gm) return send(ws, { t: 'error', msg: 'Senha de mestre incorreta.' });
      ws.me = { name, gm };
      send(ws, { t: 'init', me: ws.me, tokens: state.tokens, map: state.map, log: state.log });
      return sendPresence();
    }
    if (!ws.me) return;
    const gm = ws.me.gm, t = state.tokens.find(k => k.id === m.id);
    switch (m.t) {
      case 'move': if (!canEdit(ws, t)) return;
        t.x = clamp(m.x, 0, COLS - 1); t.y = clamp(m.y, 0, ROWS - 1); bcast(pub(), ws); save(); break;
      case 'patch': { if (!canEdit(ws, t) || !m.f) return; const f = m.f;
        if ('n' in f) t.n = String(f.n).slice(0, 24); if ('c' in f) t.c = /^#[0-9a-f]{6}$/i.test(f.c) ? f.c : t.c;
        if ('max' in f) t.max = Math.max(1, clamp(f.max, 1, 999)); if ('hp' in f) t.hp = clamp(f.hp, 0, 999);
        t.hp = Math.min(t.hp, t.max); if ('s' in f) t.s = cleanS(f.s);
        bcast(pub()); save(); break; }
      case 'add': if (!gm) return;
        state.tokens.push({ id: 't' + Date.now().toString(36) + rd(99), n: 'Novo', x: 1, y: 1, hp: 10, max: 10, c: '#c79a2b', o: '', s: blank() });
        if (state.tokens.length > 60) state.tokens.shift(); bcast(pub()); save(); break;
      case 'del': if (!gm || !t) return; state.tokens = state.tokens.filter(k => k !== t); bcast(pub()); save(); break;
      case 'owner': if (!gm || !t) return; t.o = String(m.o || '').slice(0, 20); bcast(pub()); save(); break;
      case 'map': if (!gm) return;
        state.map = (typeof m.data === 'string' && m.data.startsWith('data:image/') && m.data.length < 3e6) ? m.data : null;
        bcast({ t: 'map', data: state.map }); save(); break;
      case 'roll': { if (!canEdit(ws, t)) return; const i = clamp(m.i, 0, SKILLS.length - 1);
        const r = rollTest(t, i, clamp(m.dt, 1, 99) || 7, clamp(m.step, -2, 2), clamp(m.extra, 0, 2));
        r.by = ws.me.name;
        if (!r.ok && t.s.im < 5) { t.s.im++; bcast(pub()); }
        state.log.unshift(r); state.log.length = Math.min(state.log.length, 30);
        bcast({ t: 'roll', r }); save(); break; }
    }
  });
  ws.on('close', sendPresence);
});
server.listen(PORT, () => console.log('Mesa de RPG em http://localhost:' + PORT + (process.env.GM_PASSWORD ? '' : '  (senha de mestre padrão: "mestre" – defina GM_PASSWORD!)')));
