const N = 36;
const HINTS = ['weur','enam','apac','sam','eeur','wnam','oc','afr','me'];
const LIVE_CAP = 100;
const STR_CAP = 60;
function mulberry32(a) {
  let s = a >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function omegas(seed, B) {
  const r = mulberry32(seed); const u = []; let m = 0;
  for (let i = 0; i < N; i++) { const v = Math.floor(r() * 13) - 6; u.push(v); m += v; }
  m /= N; return u.map(v => B * (v - m));
}
function legacyOm(B) { let m = 0; for (let j = 0; j < N; j++) m += (7 * j) % 13; m /= N; const o = []; for (let i = 0; i < N; i++) o.push(B * (((7 * i) % 13) - m)); return o; }
function cfg(run, seed, Q, B, legacy) {
  if (typeof run === 'string' && /^(live|tst)-\d{8}-\d{1,2}$/.test(run)) {
    const c = { kind: 'phase', steps: 40, K: 4, DT: 0.05, B: (B === undefined || B === null) ? 0.02 : B, Q: (Q === undefined || Q === null) ? 1 : Q, om: null };
    if (legacy) c.om = legacyOm(c.B);
    else if (seed !== undefined && seed !== null) c.om = omegas(seed, c.B);
    return c;
  }
  if (typeof run === 'string' && /^str-\d{8}-\d{1,2}$/.test(run)) { const c = { kind: 'lin', steps: 40, eps: EPS }; if (seed !== undefined && seed !== null) c.init = linInit(seed); return c; }
  return null;
}
function predict(Q, B) { return { inRange: Q >= 0 && ((B <= 0.02 && Q <= 8) || (B <= 0.1 && Q <= 6) || (B <= 0.3 && Q <= 2)), w: Q }; }
function hintOf(i) { return HINTS[(i + 1) % HINTS.length]; }
function stub(env, run, i) { return env.RING.get(env.RING.idFromName(run + '-' + i), { locationHint: hintOf(i) }); }
function x0(i, c) { if (c.kind === 'lin') return c.init ? c.init[i] : 0; return 2 * Math.PI * c.Q * i / N; }
function nextX(i, x, R, L, c) { if (c.kind === 'lin') return x + c.eps * (R + L - 2 * x); return x + c.DT * (c.om[i] + c.K * (Math.sin(R - x) + Math.sin(L - x))); }
async function fingerprint() {
  const a = new Float64Array(14000); let k = 0;
  for (let i = 1; i <= 2000; i++) { const x = i * 0.00137 + 0.3; a[k++] = Math.sin(x); a[k++] = Math.cos(x); a[k++] = Math.exp(x / 50); a[k++] = Math.log(x); a[k++] = Math.pow(x, 1.37); a[k++] = Math.atan2(x, 1.1); a[k++] = Math.tan(x / 9); }
  const d = await crypto.subtle.digest('SHA-256', a.buffer);
  return Array.from(new Uint8Array(d)).map(b => ('0' + b.toString(16)).slice(-2)).join('');
}
export class RingNode {
  constructor(state, env) { this.state = state; this.env = env; }
  async load(run, id) {
    let s = this.s || await this.state.storage.get('s');
    if (!s) {
      const c = cfg(run);
      s = { run, id, step: 0, hist: [x0(id, c)], gotL: {}, gotR: {}, sent: -1, target: 0, colo: null, fp: null, reqs: 0, mismatch: 0, seed: null, Q: null, B: null, t0: null, t1: null };
    }
    this.s = s; return s;
  }
  advance(s) {
    if (s.seed === null || s.seed === undefined) return;
    const c = cfg(s.run, s.seed, s.Q, s.B); let n = 0;
    while (s.step < s.target && s.gotL[s.step] !== undefined && s.gotR[s.step] !== undefined && n < 40) {
      s.hist.push(nextX(s.id, s.hist[s.step], s.gotR[s.step], s.gotL[s.step], c)); s.step++; n++;
    }
    if (s.step >= s.target && s.target > 0 && !s.t1) s.t1 = Date.now();
  }
  async fetch(req) {
    const u = new URL(req.url); const run = u.searchParams.get('run'); const id = parseInt(u.searchParams.get('id'), 10);
    if (u.pathname === '/gstat') return Response.json({ used: (await this.state.storage.get('g')) || 0 });
    if (u.pathname === '/scan') return Response.json(scanShare(id));
    if (u.pathname === '/gate') {
      const cap = u.searchParams.get('cap') ? parseInt(u.searchParams.get('cap'), 10) : LIVE_CAP;
      let g = (await this.state.storage.get('g')) || 0;
      if (g >= cap) return Response.json({ ok: false, used: g });
      g++; await this.state.storage.put('g', g); return Response.json({ ok: true, used: g, index: g });
    }
    const s = await this.load(run, id); s.reqs++;
    if (u.pathname === '/start') {
      const t = parseInt(u.searchParams.get('steps'), 10); const seed = parseInt(u.searchParams.get('seed'), 10);
      if (s.seed === null || s.seed === undefined) {
        s.seed = seed >>> 0; s.t0 = parseInt(u.searchParams.get('t0'), 10);
        s.Q = parseInt(u.searchParams.get('q'), 10); s.B = parseFloat(u.searchParams.get('b'));
        if (s.step === 0) s.hist = [x0(s.id, cfg(s.run, s.seed, s.Q, s.B))];
      }
      if (t > s.target) s.target = t;
      this.advance(s);
      await this.state.storage.put('s', s); await this.state.storage.setAlarm(Date.now()); return Response.json({ ok: true });
    }
    if (u.pathname === '/deliver') {
      const b = await req.json(); const g = b.side === 'L' ? s.gotL : s.gotR;
      for (const [st, v] of b.items) { if (g[st] === undefined) g[st] = v; else if (g[st] !== v) s.mismatch++; }
      this.advance(s); await this.state.storage.put('s', s);
      if (s.seed !== null && s.sent < s.step) await this.state.storage.setAlarm(Date.now());
      return Response.json({ ok: true });
    }
    if (u.pathname === '/info') { await this.state.storage.put('s', s); return Response.json({ id: s.id, step: s.step, target: s.target, colo: s.colo, fp: s.fp, hint: hintOf(s.id), reqs: s.reqs, mismatch: s.mismatch, seed: s.seed, Q: s.Q, B: s.B, t0: s.t0, t1: s.t1, err: s.err || null, sent: s.sent, hist: s.hist }); }
    return Response.json({ error: 'unknown' }, { status: 404 });
  }
  async alarm() {
    let s = this.s || await this.state.storage.get('s'); if (!s) return; this.s = s; if (s.seed === null && s.step === 0 && s.hist.length === 1 && s.target === 0) return; s.reqs++;
    const run = s.run, id = s.id, L = (id + N - 1) % N, R = (id + 1) % N;
    if (!s.colo) {
      try { const t = await (await fetch('https://www.cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(3000) })).text(); const m = t.match(/colo=(\w+)/); s.colo = m ? m[1] : 'unknown'; } catch (e) { s.colo = 'unknown'; }
      s.fp = await fingerprint();
    }
    try {
      const upto = s.step; const items = []; for (let k = s.sent + 1; k <= upto; k++) items.push([k, s.hist[k]]);
      if (items.length) {
        await Promise.all([
          stub(this.env, run, L).fetch('https://n/deliver?run=' + run + '&id=' + L, { method: 'POST', body: JSON.stringify({ side: 'R', items }) }),
          stub(this.env, run, R).fetch('https://n/deliver?run=' + run + '&id=' + R, { method: 'POST', body: JSON.stringify({ side: 'L', items }) })]);
        s.sent = upto;
      }
    } catch (e) { s.err = String(e && e.stack || e).slice(0, 400); await this.state.storage.put('s', s); await this.state.storage.setAlarm(Date.now() + 1500); return; }
    this.advance(s); await this.state.storage.put('s', s);
    if (s.sent < s.step) await this.state.storage.setAlarm(Date.now());
  }
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
const CSS = ':root{--p:#0f5257;--j:#2bb08a;--t:#e8f4f3}*{box-sizing:border-box}body{background:#fff;color:#111;font-family:Georgia,serif;max-width:880px;margin:0 auto;padding:18px 16px 40px;line-height:1.5;font-size:16px}' +
  'h1{font-size:27px;margin:.3em 0;color:var(--p)}h2{font-size:19px;margin-top:26px;color:var(--p);border-top:2px solid var(--j);padding-top:10px}p.sub{color:var(--p)}' +
  'table{border-collapse:collapse;width:100%;margin:10px 0;font-size:14px}th,td{border:1px solid #7fb0b0;padding:5px 8px;text-align:left;vertical-align:top}th{background:#d9eeee;color:var(--p)}tr:nth-child(even) td{background:#f4fafa}' +
  '.ok{font-weight:bold;color:#157a4f}.mono{font-family:Menlo,Consolas,monospace;font-size:12px;word-break:break-all}a{color:var(--p)}' +
  '.btn{display:inline-block;background:var(--p);color:#fff;border:2px solid var(--p);border-radius:6px;padding:10px 18px;margin:6px 0;text-decoration:none;font-weight:bold}.btn:hover{background:var(--j);border-color:var(--j)}' +
  '.live{display:inline-block;background:#fff;border:2px solid var(--j);color:var(--p);border-radius:20px;padding:3px 14px;font-weight:bold;font-size:14px;letter-spacing:.05em}.live i{display:inline-block;width:11px;height:11px;border-radius:50%;background:var(--j);margin-right:8px;animation:pl 1s infinite}' +
  '.done{border-color:#157a4f;color:#157a4f}.done i{background:#157a4f;animation:none}@keyframes pl{0%{opacity:1;transform:scale(1)}50%{opacity:.25;transform:scale(1.35)}100%{opacity:1;transform:scale(1)}}' +
  '.bar{background:#e8f4f3;border:1px solid #7fb0b0;height:14px;border-radius:7px;overflow:hidden}.bar b{display:block;height:100%;background:var(--j)}.big{font-size:34px;font-weight:bold;color:var(--p)}' +
  '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 14px;font-size:12px}.grid div{border-bottom:1px solid #d9eeee;padding:2px 0}pre{background:#f4fafa;border:1px solid #7fb0b0;padding:10px;overflow:auto;font-size:12px}details{margin:10px 0}summary{cursor:pointer;color:var(--p);font-weight:bold}' +
  '@media(max-width:600px){.grid{grid-template-columns:repeat(2,1fr)}}';
function html(title, body, refresh) {
  return '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + (refresh ? '<meta http-equiv="refresh" content="' + refresh + '">' : '') + '<title>' + esc(title) + '</title><style>' + CSS + '</style></head><body>' + body + '</body></html>';
}
function reply(h, cache) { return new Response(h, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache || 'no-store' } }); }
function wrap(x) { let y = (x + Math.PI) % (2 * Math.PI); if (y < 0) y += 2 * Math.PI; return y - Math.PI; }
function reference(c) {
  const H = []; for (let i = 0; i < N; i++) H.push([x0(i, c)]);
  for (let t = 0; t < c.steps; t++) for (let i = 0; i < N; i++) H[i].push(nextX(i, H[i][t], H[(i + 1) % N][t], H[(i + N - 1) % N][t], c));
  return H;
}
async function sha(text) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return Array.from(new Uint8Array(d)).map(b => ('0' + b.toString(16)).slice(-2)).join(''); }
async function nodes(env, run) {
  return Promise.all(Array.from({ length: N }, (_, i) => i).map(async i => (await stub(env, run, i).fetch('https://n/info?run=' + run + '&id=' + i)).json()));
}
function tfmt(ms) {
  if (!ms || !isFinite(ms)) return '–';
  const d = new Date(ms);
  const z = d.toISOString().slice(11, 19) + ' UTC';
  let b = ''; try { b = d.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour12: false }) + ' MEZ'; } catch (e) { }
  return d.toISOString().slice(0, 10) + ', ' + b + ' (' + z + ')';
}
async function evaluate(env, run) {
  const ns = await nodes(env, run);
  const seed = ns[0].seed; const legacy = (seed === null || seed === undefined) && ns[0].step > 0;
  const started = (seed !== null && seed !== undefined) || legacy;
  const out = { run, started, legacy, nodes: ns, seed, steps: 40 };
  if (!started) return out;
  const Q = legacy ? 1 : ns[0].Q, B = legacy ? 0.02 : ns[0].B;
  const c = cfg(run, seed, Q, B, legacy); out.c = c; out.Q = Q; out.B = B; out.pred = predict(Q, B);
  out.seedsOK = legacy ? true : ns.every(n => n.seed === seed);
  out.minStep = Math.min(...ns.map(n => n.step));
  out.t0 = legacy ? null : Math.min(...ns.map(n => n.t0 || Infinity));
  out.done = ns.every(n => n.step >= c.steps);
  if (out.done) {
    out.t1 = legacy ? null : Math.max(...ns.map(n => n.t1 || 0));
    const th = ns.map(n => n.hist[c.steps]); let w = 0; for (let i = 0; i < N; i++) w += wrap(th[(i + 1) % N] - th[i]);
    out.winding = w / (2 * Math.PI);
    const H = reference(c); let md = 0; for (let i = 0; i < N; i++) for (let t = 0; t <= c.steps; t++) md = Math.max(md, Math.abs(ns[i].hist[t] - H[i][t]));
    out.maxdev = md;
    let m0 = 0, m1 = 0; for (let i = 0; i < N; i++) { m0 += ns[i].hist[0]; m1 += ns[i].hist[c.steps]; }
    out.meanshift = (m1 - m0) / N;
    let mx = 0; for (let t = 0; t <= c.steps; t++) for (let i = 0; i < N; i++) mx = Math.max(mx, Math.abs(wrap(ns[(i + 1) % N].hist[t] - ns[i].hist[t])));
    out.maxdiff = mx;
    out.colos = Array.from(new Set(ns.map(n => n.colo))).sort();
    out.mismatch = ns.reduce((a, n) => a + n.mismatch, 0);
    out.sha = await sha(JSON.stringify(ns.map(n => [n.id, n.colo, n.fp, n.hist])));
    out.omsum = c.om.reduce((a, b) => a + b, 0);
  }
  return out;
}
const EPS = 0.05;
function linInit(seed) { const r = mulberry32((seed ^ 0x9E3779B9) >>> 0); return Array.from({ length: N }, () => 2 * r() - 1); }
function gcd(a, b) { while (b) { const t = a % b; a = b; b = t; } return a; }
function scanN(n) {
  const U = []; for (let x = 1; x < n; x++) if (gcd(x, n) === 1) U.push(x);
  const D = U.length / 2; let single = 1, inter = U.slice();
  for (let d = 3; d < n; d++) if (n % d === 0) {
    const H = U.filter(x => x % d === 1 || x % d === d - 1);
    single = Math.max(single, Math.round(2 * D / H.length));
    inter = inter.filter(x => x % d === 1 || x % d === d - 1);
  }
  const comp = Math.round(2 * D / inter.length);
  const cat = D === 1 ? 'rational' : single === D ? 'copy' : comp === D ? 'coupling' : 'origin';
  let m = n; for (const p of [2, 3]) while (m % p === 0) m /= p;
  let isInt = true; for (let k = 0; k < n; k++) { const l = 2 - 2 * Math.cos(2 * Math.PI * k / n); if (Math.abs(l - Math.round(l)) > 1e-9) { isInt = false; break; } }
  const s = Math.round(Math.sqrt(n)); const t = Math.round((Math.sqrt(8 * n + 1) - 1) / 2);
  return { n, D, single, comp, cat, f23: m === 1, isInt, sqtri: s * s === n && t * (t + 1) / 2 === n };
}
function scanShare(id) { const out = []; for (let n = 3; n <= 360; n++) if (n % N === id) out.push(scanN(n)); return out; }
const STRBOX = '<h2>Struktur-Lauf: warum genau 36</h2><p>Dieser Lauf rechnet die Struktur der 36 auf denselben 36 Servern: er misst das Spektrum der 36 aus dem verteilten Ablauf und lässt jedes Rechenzentrum einen Teil aller Ringgrößen von 3 bis 360 untersuchen. Am Ende steht Schritt für Schritt, welche Ringgröße die Kopplung der Ereignisse 2 und 3 ist.</p><form action="/struktur" method="get"><p><button class="btn" type="submit">Struktur-Lauf starten</button></p></form>';

function phi(n) { let c = 0; for (let k = 1; k <= n; k++) if (gcd(k, n) === 1) c++; return c; }
function J2(d) { let r = d * d; let m = d; for (let p = 2; p <= m; p++) if (m % p === 0) { r = r * (p * p - 1) / (p * p); while (m % p === 0) m /= p; } return Math.round(r); }
function chainTerms() { let a0 = 2, a1 = 6; const out = {}; for (let n = 2; n <= 12; n++) { const a2 = 6 * a1 - a0; a0 = a1; a1 = a2; if (n % 2 === 0 && n >= 4) out[n] = (a1 - 2) / 32; } return out; }
async function evaluateLin(env, run) {
  const ns = await nodes(env, run);
  const seed = ns[0].seed; const started = seed !== null && seed !== undefined;
  const out = { run, started, nodes: ns, seed, steps: 40 };
  if (!started) return out;
  const c = cfg(run, seed); out.c = c;
  out.minStep = Math.min(...ns.map(n => n.step)); out.t0 = Math.min(...ns.map(n => n.t0 || Infinity));
  out.done = ns.every(n => n.step >= c.steps); out.seedsOK = ns.every(n => n.seed === seed);
  if (!out.done) return out;
  out.t1 = Math.max(...ns.map(n => n.t1 || 0));
  const T = c.steps;
  const H = reference(c); let md = 0; for (let i = 0; i < N; i++) for (let t = 0; t <= T; t++) md = Math.max(md, Math.abs(ns[i].hist[t] - H[i][t]));
  out.maxdev = md;
  const dft = (t, k) => { let re = 0, im = 0; for (let i = 0; i < N; i++) { const a = -2 * Math.PI * ((k * i) % N) / N; re += ns[i].hist[t] * Math.cos(a); im += ns[i].hist[t] * Math.sin(a); } return [re, im]; };
  const modes = []; let maxModeDev = 0;
  for (let k = 0; k < N; k++) {
    const A = dft(0, k), Bz = dft(T, k); const den = A[0] * A[0] + A[1] * A[1];
    const ratio = (Bz[0] * A[0] + Bz[1] * A[1]) / den;
    const lamP = 2 - 2 * Math.cos(2 * Math.PI * k / N); const predR = Math.pow(1 - c.eps * lamP, T);
    const lamM = ratio > 0 ? (1 - Math.pow(ratio, 1 / T)) / c.eps : NaN;
    maxModeDev = Math.max(maxModeDev, Math.abs(ratio - predR));
    modes.push({ k, d: N / gcd(k, N), ratio, predR, lamM, lamP });
  }
  out.modes = modes; out.maxModeDev = maxModeDev;
  const layers = {};
  for (const m of modes) { if (m.k === 0) continue; const L = layers[m.d] || (layers[m.d] = { d: m.d, n: 0, tr: 0 }); L.n++; L.tr += 1 / m.lamM; }
  out.layers = Object.values(layers).sort((a, b) => a.d - b.d).map(L => ({ d: L.d, n: L.n, deg: L.d === 2 ? 1 : phi(L.d) / 2, tr: L.tr, pred: J2(L.d) / 12 }));
  out.trTotal = out.layers.reduce((a, L) => a + L.tr, 0); out.trPred = (N * N - 1) / 12;
  out.maxLayerDev = Math.max(...out.layers.map(L => Math.abs(L.tr - L.pred)));
  const shares = await Promise.all(Array.from({ length: N }, (_, i) => stub(env, run, i).fetch('https://n/scan?run=' + run + '&id=' + i).then(r => r.json())));
  out.scan = [].concat(...shares).sort((a, b) => a.n - b.n);
  out.colos = Array.from(new Set(ns.map(n => n.colo))).sort(); out.mismatch = ns.reduce((a, n) => a + n.mismatch, 0);
  out.chain = chainTerms();
  out.sha = await sha(JSON.stringify([ns.map(n => [n.id, n.colo, n.fp, n.hist]), out.scan]));
  return out;
}
const CATN = { rational: 'rational', copy: 'Wiederholung', coupling: 'Kopplung', origin: 'Ursprung' };
const PYS = 'import math\nfrom math import gcd\ndef scan(n):\n    U=[x for x in range(1,n) if gcd(x,n)==1]; D=len(U)//2\n    inter=U[:]; single=1\n    for d in range(3,n):\n        if n%d==0:\n            H=[x for x in U if x%d in (1,d-1)]\n            single=max(single,len(U)//len(H))\n            inter=[x for x in inter if x%d in (1,d-1)]\n    comp=len(U)//len(inter)\n    return D,("rational" if D==1 else "copy" if single==D else "coupling" if comp==D else "origin")\nfor n in range(3,361):\n    D,c=scan(n)\n    if D==6: print(n,c)\nprint([n for n in range(3,361) if scan(n)[1]=="coupling"][:10])';
function strPage(e) {
  const run = e.run; let b = HEAD + '<h2>Struktur-Lauf ' + esc(run) + '</h2>';
  if (!e.started) return b + '<p>Dieser Lauf wurde noch nicht gestartet. <a href="/">Zur Startseite</a>.</p>';
  const now = Date.now();
  if (!e.done) {
    const pct = Math.round(100 * e.minStep / e.steps);
    return b + '<p><span class="live"><i></i>LÄUFT LIVE</span></p><p class="big">Schritt ' + e.minStep + ' von ' + e.steps + '</p><div class="bar"><b style="width:' + pct + '%"></b></div>' +
      '<p>Jeder Knoten gleicht in jedem Schritt seinen Wert mit dem linken und dem rechten Nachbarn aus. Aus dem Abklingen der 36 Schwingungsformen wird danach das Spektrum der 36 gelesen. Die Seite lädt sich alle 2 Sekunden neu. <a href="/zeigen?run=' + esc(run) + '">Zur Live-Ansicht mit Weltkarte</a>.</p>';
  }
  const dur = ((e.t1 - e.t0) / 1000).toFixed(1);
  const f = (v, d) => v.toFixed(d);
  const lay = e.layers.map(L => '<tr><td>' + L.d + '</td><td>' + L.n + '</td><td>' + L.deg + '</td><td class="mono" style="white-space:nowrap">' + f(L.tr, 9) + '</td><td class="mono" style="white-space:nowrap">' + f(L.pred, 9) + '</td><td class="mono">' + Math.abs(L.tr - L.pred).toExponential(1) + '</td></tr>').join('');
  const S = e.scan; const d6 = S.filter(x => x.D === 6);
  const cnt = { rational: 0, copy: 0, coupling: 0, origin: 0 }; S.forEach(x => cnt[x.cat]++);
  const coup = S.filter(x => x.cat === 'coupling'); const firstDiv6 = coup.find(x => x.D % 6 === 0);
  const ch = e.chain;
  b += '<p><span class="live done"><i></i>LAUF ABGESCHLOSSEN</span></p>' +
    '<table><tr><th>Größe</th><th>Wert</th></tr><tr><td>Gestartet / beendet (Serverzeit)</td><td>' + tfmt(e.t0) + ' · Dauer ' + dur + ' s</td></tr>' +
    '<tr><td>Startvektor aus Kennzahl</td><td class="mono">' + e.seed + (e.seedsOK ? ' · bei allen 36 Knoten gleich' : ' · ABWEICHUNG') + '</td></tr>' +
    '<tr><td>Knoten · Schritte · Ausgleichsstärke</td><td>36 · ' + e.steps + ' · ' + e.c.eps + '</td></tr>' +
    '<tr><td>größte Abweichung jedes Knotens von der lokalen Referenzrechnung (Vorhersage: 0)</td><td class="' + (e.maxdev < 1e-12 ? 'ok' : 'mono') + '">' + e.maxdev.toExponential(2) + (e.maxdev < 1e-12 ? ' · bestanden' : '') + '</td></tr>' +
    '<tr><td>Widersprüche zwischen empfangenen Kopien eines Wertes</td><td class="ok">' + e.mismatch + ' · bestanden</td></tr>' +
    '<tr><td>Rechenzentren</td><td class="mono">' + e.colos.length + ': ' + esc(e.colos.join(', ')) + '</td></tr>' +
    '<tr><td>SHA-256 aller Werte und aller Prüfergebnisse</td><td class="mono">' + e.sha + '</td></tr></table>' +
    '<h2>Messung 1: das Spektrum der 36, gelesen aus dem Lauf</h2>' +
    '<p>Jeder Knoten ersetzt in jedem Schritt seinen Wert x durch x + 0,05·(links + rechts − 2x). Dabei klingt jede der 36 Schwingungsformen des Rings mit ihrem eigenen Faktor ab. Aus den Werten der 36 Knoten vor dem ersten und nach dem 40. Schritt wird für jede Schwingungsform k der Faktor g(k)^40 gelesen und daraus ihr Eigenwert λ(k). Die 36 Schwingungsformen ordnen sich nach dem Teiler d von 36, zu dem sie gehören, in Schichten: d = 1, 2, 3, 4, 6, 9, 12, 18, 36. In der Schicht d liegen φ(d) Schwingungsformen (φ = Anzahl der zu d teilerfremden Zahlen unter d). Die Eigenwerte einer Schicht sind Zahlen eines Körpers vom Grad φ(d)/2.</p>' +
    '<table><tr><th>Schicht d</th><th>Schwingungsformen</th><th>Körpergrad</th><th>Summe 1/λ gemessen</th><th>Summe 1/λ vorhergesagt J₂(d)/12</th><th>Abweichung</th></tr>' + lay +
    '<tr><td colspan="3"><b>alle Schichten</b></td><td class="mono">' + f(e.trTotal, 9) + '</td><td class="mono">' + f(e.trPred, 9) + ' = 1295/12</td><td class="' + (Math.abs(e.trTotal - e.trPred) < 1e-8 ? 'ok' : 'mono') + '">' + Math.abs(e.trTotal - e.trPred).toExponential(1) + (Math.abs(e.trTotal - e.trPred) < 1e-8 ? ' · bestanden' : '') + '</td></tr></table>' +
    '<p>größte Abweichung des gemessenen Abklingfaktors g(k)^40 vom vorhergesagten, über alle 36 Schwingungsformen: <b class="' + (e.maxModeDev < 1e-9 ? 'ok' : 'mono') + '">' + e.maxModeDev.toExponential(2) + (e.maxModeDev < 1e-9 ? ' · bestanden' : '') + '</b>. Die Schicht d = 36 trägt allein 72 von 107,92, also zwei Drittel der ganzen Summe. In ihr liegen 12 der 36 Schwingungsformen, ihre Eigenwerte erzeugen den Körper vom Grad 6.</p>' +
    '<h2>Messung 2: alle Ringgrößen von 3 bis 360, geprüft von den 36 Servern</h2>' +
    '<p>Jeder der 36 Server hat die Ringgrößen n mit n ≡ Knotennummer (mod 36) untersucht, zusammen sind das alle ' + S.length + ' Größen von 3 bis 360. Für jede Größe n wurde berechnet: der Grad D = φ(n)/2 des Körpers aller Eigenwerte, und wie dieser Körper aus den Schichten der echten Teiler von n entsteht. Daraus ergibt sich genau eine von vier Arten.</p>' +
    '<table><tr><th>Art</th><th>Bedeutung</th><th>Anzahl der Ringgrößen 3 bis 360</th></tr>' +
    '<tr><td>rational</td><td>alle Eigenwerte sind ganze oder rationale Zahlen</td><td>' + cnt.rational + '</td></tr>' +
    '<tr><td>Wiederholung</td><td>eine einzige kleinere Schicht erzeugt schon den ganzen Körper: oben kommt nichts Neues dazu</td><td>' + cnt.copy + '</td></tr>' +
    '<tr><td>Kopplung</td><td>keine einzelne kleinere Schicht erzeugt den ganzen Körper, alle kleineren Schichten zusammen aber schon: der Körper entsteht nur durch das Zusammenwirken der Schichten</td><td>' + cnt.coupling + '</td></tr>' +
    '<tr><td>Ursprung</td><td>auch alle kleineren Schichten zusammen erzeugen den Körper nicht: oben entstehen neue Zahlen</td><td>' + cnt.origin + '</td></tr></table>' +
    '<h2>Warum nur die 36</h2>' +
    '<p><b>Schritt 1.</b> In den Schichten der 36 liegen zwei Körper: in der Schicht 12 der Körper vom Grad 2 (er enthält √3), in der Schicht 9 ein Körper vom Grad 3. Ihre Kopplung ist der Körper vom Grad 6 = 2·3, und das ist genau der Körper der obersten Schicht 36.</p>' +
    '<p><b>Schritt 2.</b> Ein Ring der Größe n hat einen Körper vom Grad 6 genau dann, wenn φ(n) = 12. Die Server haben diese Größen gefunden:</p>' +
    '<table><tr><th>Ringgröße n</th><th>Art</th><th>Warum</th></tr>' + d6.map(x => '<tr><td>' + x.n + '</td><td' + (x.cat === 'coupling' ? ' class="ok"' : '') + '>' + CATN[x.cat] + '</td><td>' + (x.cat === 'origin' ? 'Körper vom Grad 6 entsteht neu, aus den kleineren Schichten nicht erreichbar' : x.cat === 'copy' ? 'eine einzelne kleinere Schicht erzeugt denselben Körper schon allein' : 'keine einzelne kleinere Schicht erzeugt ihn, alle zusammen schon') + '</td></tr>').join('') + '</table>' +
    '<p>Unter den ' + d6.length + ' Ringgrößen mit Körpergrad 6 gibt es genau <b>' + d6.filter(x => x.cat === 'coupling').length + '</b> Kopplung: die <b>' + (d6.filter(x => x.cat === 'coupling').map(x => x.n).join(', ')) + '</b>.</p>' +
    '<p><b>Schritt 3.</b> Reine Kopplungen gibt es unter den Ringgrößen bis 360 auch bei anderen Graden, die kleinsten sind: ' + coup.slice(0, 8).map(x => x.n + ' (Grad ' + x.D + ')').join(', ') + '. Die kleinste Kopplung, deren Grad durch 2 und durch 3 teilbar ist, ist die <b>' + (firstDiv6 ? firstDiv6.n : '–') + '</b> (Grad ' + (firstDiv6 ? firstDiv6.D : '–') + ').</p>' +
    '<p><b>Schritt 4.</b> Die Kette aus n Gliedern hat die Kennzahl (a(n) − 2)/32 mit a(0) = 2, a(1) = 6, a(n) = 6·a(n−1) − a(n−2). Für n = 4, 6, 8, 10, 12 kommen heraus: ' + [4, 6, 8, 10, 12].map(n => ch[n]).join(', ') + '. Das sind die Zahlen, die zugleich Quadrat und Dreieckszahl sind (1, 36, 1225, 41616, …). Unter den Ringgrößen von 3 bis 360 ist ' + (S.filter(x => x.sqtri).map(x => x.n).join(', ') === '36' ? 'die 36 die einzige' : 'abweichend: ' + S.filter(x => x.sqtri).map(x => x.n).join(', ')) + '.</p>' +
    '<h2>Was für jeden Ring gilt und was nur die 36 festlegt</h2>' +
    '<table><tr><th>Gilt für jede Ringgröße n</th><th>Legt die 36 fest</th></tr><tr><td>Die Eigenwerte eines geschlossenen Rings sind 2 − 2·cos(2πk/n). Die Summe der Kehrwerte aller von Null verschiedenen Eigenwerte ist (n² − 1)/12; bei n = 36 sind das 1295/12 (gemessen in Messung 1). Die Windung einer Phasenverteilung bleibt bei kleiner Störung erhalten (Lauf auf der Startseite).</td><td>Die Zerlegung in Schichten nach den Teilern von 36, die Körper dieser Schichten (Grad 2 in Schicht 12, Grad 3 in Schicht 9), ihre Kopplung zu Grad 6, und dass diese Kopplung unter allen Ringgrößen mit Grad 6 nur bei der 36 auftritt (Messung 2). Die Messung 1 zeigt, dass der Lauf auf den 36 Servern genau diese Schichten mit genau diesen Summen liefert.</td></tr></table>' +
    '<p>Dieser Lauf behauptet nicht, dass die Eigenwerte oder die Summe (n² − 1)/12 neu sind. Er zeigt, welche Ringgröße die Kopplung der Grade 2 und 3 ist und dass es unter den Ringgrößen mit Grad 6 nur eine gibt.</p>' +
    '<details><summary>Messung 2 nachrechnen (Python)</summary><pre>' + esc(PYS) + '</pre></details>' +
    '<p>Rohwerte: <a href="/data?run=' + esc(run) + '">/data?run=' + esc(run) + '</a>. Serverzeit beim Aufruf: ' + tfmt(now) + '</p>';
  return b;
}

const TITLE = 'Was der Raum weiß, bevor er sich bewegt';
const HEAD = '<h1>' + TITLE + '</h1><p class="sub"><i>What space knows before it moves.</i></p><p><i>36 Knoten auf Servern in aller Welt. Jeder Knoten kennt nur seinen linken und seinen rechten Nachbarn. Es gibt keine Zentrale und keine gemeinsame Uhr.</i></p>';
function code(seed, Q, B) {
  return 'import math\nN,K,DT,T = 36,4,0.05,40\nQ,B = ' + Q + ',' + B + '\nseed = ' + seed + '\n' +
'def mulberry32(a):\n    s=[a & 0xFFFFFFFF]\n    def nxt():\n        s[0]=(s[0]+0x6D2B79F5)&0xFFFFFFFF; t=s[0]\n        t=((t^(t>>15))*(t|1))&0xFFFFFFFF\n        t^=(t+(((t^(t>>7))*(t|61))&0xFFFFFFFF))&0xFFFFFFFF\n        return ((t^(t>>14))&0xFFFFFFFF)/4294967296\n    return nxt\n' +
'r=mulberry32(seed); u=[math.floor(r()*13)-6 for _ in range(N)]; m=sum(u)/N\nom=[B*(v-m) for v in u]\nth=[2*math.pi*Q*i/N for i in range(N)]\n' +
'for t in range(T):\n    th=[th[i]+DT*(om[i]+K*(math.sin(th[(i+1)%N]-th[i])+math.sin(th[(i-1)%N]-th[i]))) for i in range(N)]\n' +
'w=lambda y:(y+math.pi)%(2*math.pi)-math.pi\nprint(sum(w(th[(i+1)%N]-th[i]) for i in range(N))/(2*math.pi))  # = Q\nprint(["%.6f"%v for v in th])';
}
function predText(e) {
  return e.pred.inRange ? 'Windung = Q = ' + e.Q : 'außerhalb des Erhaltungsbereichs (Q ≤ 8 bei B = 0,02 · Q ≤ 6 bei B = 0,1 · Q ≤ 2 bei B = 0,3): keine Vorhersage, der Wert wird so gemeldet, wie er herauskommt';
}
function paramRow(e) {
  return '<tr><td>Eingabe dieses Laufs</td><td class="mono">Startzustand mit Windung Q = ' + e.Q + ' · Breite der Eigenfrequenzen B = ' + e.B + '</td></tr>';
}
function runPage(e) {
  const run = e.run; let b = HEAD + '<h2>Lauf ' + esc(run) + '</h2>';
  if (!e.started) return b + '<p>Dieser Lauf wurde noch nicht gestartet. <a href="/">Zur Startseite</a>.</p>';
  const now = Date.now();
  if (!e.done) {
    const pct = Math.round(100 * e.minStep / e.steps);
    b += '<p><span class="live"><i></i>LÄUFT LIVE</span></p>' +
      '<p class="big">Schritt ' + e.minStep + ' von ' + e.steps + '</p><div class="bar"><b style="width:' + pct + '%"></b></div>' +
      '<table><tr><td>Gestartet</td><td>' + tfmt(e.t0) + '</td></tr><tr><td>Serverzeit jetzt</td><td>' + tfmt(now) + '</td></tr><tr><td>Laufzeit bisher</td><td>' + ((now - e.t0) / 1000).toFixed(1) + ' s</td></tr>' +
      '<tr><td>Eigenfrequenzen dieses Laufs (aus der Kennzahl gezogen)</td><td class="mono">Kennzahl ' + (e.legacy ? 'feste Reihe' : e.seed) + '</td></tr>' + paramRow(e) + '</table>' +
      '<p>Vorhersage für diese Eingabe, vor dem Ergebnis: <b>' + predText(e) + '</b>; Verschiebung des Mittelwerts 0; Abweichung jedes Knotens von der lokalen Referenzrechnung 0. Die Seite lädt sich alle 2 Sekunden neu. <a href="/zeigen?run=' + esc(run) + '">Zur Live-Ansicht mit Weltkarte</a>.</p>' +
      '<h2>Die 36 Knoten jetzt</h2><div class="grid">' + e.nodes.map(n => '<div>Knoten ' + n.id + ' · <span class="mono">' + esc(n.colo || '…') + '</span> · Schritt ' + n.step + '</div>').join('') + '</div>';
    return b;
  }
  const dur = e.legacy ? '' : ((e.t1 - e.t0) / 1000).toFixed(1);
  b += '<p><span class="live done"><i></i>LAUF ABGESCHLOSSEN</span></p>' +
    '<table><tr><th>Größe</th><th>Wert</th></tr>' +
    (e.legacy ? '' : '<tr><td>Gestartet (Serverzeit)</td><td>' + tfmt(e.t0) + '</td></tr><tr><td>Beendet (Serverzeit)</td><td>' + tfmt(e.t1) + ' · Dauer ' + dur + ' s</td></tr>') +
    '<tr><td>Eigenfrequenzen dieses Laufs</td><td class="mono">' + (e.legacy ? 'feste Reihe (Version vom Vormittag des 9. November)' : 'Kennzahl ' + e.seed) + ' · Summe ' + e.omsum.toExponential(1) + (e.seedsOK ? ' · bei allen 36 Knoten gleich' : ' · ABWEICHUNG') + '</td></tr>' + paramRow(e) +
    '<tr><td>Knoten</td><td>36, geschlossen: Knoten i kennt i−1 und i+1 (mod 36)</td></tr>' +
    '<tr><td>Schritte</td><td>' + e.steps + ' (alle 36 Knoten)</td></tr>' +
    '<tr><td>Windung aus den letzten Phasen (Vorhersage: ' + esc(predText(e)) + ')</td><td class="' + (e.pred.inRange ? 'ok' : 'mono') + '">' + e.winding.toFixed(9) + (e.pred.inRange && Math.abs(e.winding - e.Q) < 1e-6 ? ' · bestanden' : '') + '</td></tr>' +
    '<tr><td>größte Abweichung jedes Knotens von der lokalen Referenzrechnung, über alle Schritte (Vorhersage: 0)</td><td class="' + (e.maxdev < 1e-12 ? 'ok' : 'mono') + '">' + e.maxdev.toExponential(2) + (e.maxdev < 1e-12 ? ' · bestanden' : '') + '</td></tr>' +
    '<tr><td>Verschiebung des Mittelwerts aller Phasen (Vorhersage: 0)</td><td class="mono">' + e.meanshift.toExponential(2) + '</td></tr>' +
    '<tr><td>größte Phasendifferenz zweier Nachbarn im ganzen Lauf (Grenze π = 3.14159)</td><td class="mono">' + e.maxdiff.toFixed(5) + '</td></tr>' +
    '<tr><td>Widersprüche zwischen empfangenen Kopien eines Wertes</td><td class="ok">' + e.mismatch + ' · bestanden</td></tr>' +
    '<tr><td>Rechenzentren (Kennung)</td><td class="mono">' + e.colos.length + ': ' + esc(e.colos.join(', ')) + '</td></tr>' +
    '<tr><td>SHA-256 aller Werte aller Knoten</td><td class="mono">' + e.sha + '</td></tr></table>' +
    '<p>Rohwerte als JSON: <a href="/data?run=' + esc(run) + '">/data?run=' + esc(run) + '</a>. Phase jedes Knotens im letzten Schritt:</p><p class="mono">' + e.nodes.map(n => n.hist[e.steps].toFixed(6)).join(' · ') + '</p>' +
    '<p>Die Windung des Ergebnisses ist die Windung der Eingabe: sie ist erhalten, solange der Startzustand stabil ist und die Eigenfrequenzen klein gegen die rückstellende Kopplung sind (Q ≤ 8 bei B = 0,02 · Q ≤ 6 bei B = 0,1 · Q ≤ 2 bei B = 0,3; in 400 Zufallsläufen je Feld ohne Ausnahme). Außerhalb dieses Bereichs geht sie verloren, und die Seite meldet, was herauskommt.</p>' +
    (e.legacy ? '' : '<details><summary>Diesen Lauf nachrechnen (Python)</summary><pre>' + esc(code(e.seed, e.Q, e.B)) + '</pre></details>') +
    '<p>Serverzeit beim Aufruf dieser Seite: ' + tfmt(now) + '</p>';
  return b;
}
const CLIENT="<h1>Live-Ansicht</h1>\n<p class=\"sub\" id=\"hd\">Lauf RUNNAME</p>\n<p><span class=\"live\" id=\"badge\"><i></i>LÄUFT LIVE</span> <span id=\"clk\" class=\"mono\"></span></p>\n<p class=\"big\" id=\"stp\">Schritt 0 von 40</p><div class=\"bar\"><b id=\"pb\" style=\"width:0\"></b></div>\n<canvas id=\"map\" style=\"width:100%;border:1px solid #7fb0b0;margin-top:10px;background:#fff\"></canvas>\n<p class=\"mono\" id=\"cap\">Jeder Punkt ist einer der 36 Knoten an seinem Rechenzentrum. Jede Linie verbindet zwei Nachbarn im Ring. Eine Linie leuchtet auf, wenn der Knoten dahinter einen Schritt fertig gerechnet hat.</p>\n<canvas id=\"ring\" style=\"width:100%;max-width:520px;display:block;margin:10px auto;border:1px solid #7fb0b0;background:#fff\"></canvas>\n<p class=\"mono\">Ring: Farbe und Zeiger sind der Wert des Knotens im aktuellen Schritt (im Phasenlauf die Phase). Gleiche Farbe wie Nachbar heißt gleicher Wert.</p>\n<table id=\"tb\"></table>\n<div id=\"res\"></div>\n<p id=\"lk\"></p>\n<script>\nvar RUN=\"RUNNAME\",N=36,COAST=COASTDATA,CL=COLODATA;\nvar S=null,dead=false,t00=0,rec=[],replay=false,rstep=0;\nvar mc=document.getElementById('map'),rc=document.getElementById('ring');\nfunction size(){var w=mc.clientWidth;mc.width=w*2;mc.height=w;rc.width=rc.clientWidth*2;rc.height=rc.clientWidth*2}\nsize();window.onresize=function(){size();draw()};\nfunction px(lon,lat){return[(lon+180)/360*mc.width,(90-lat)/180*mc.height]}\nfunction pos(n,i){var c=CL[n.colo];if(!c)return null;var a=i*2.399,r=6+((i*7)%5);var p=px(c[1],c[0]);return[p[0]+Math.cos(a)*r*(mc.width/1000),p[1]+Math.sin(a)*r*(mc.width/1000)]}\nfunction col(x){if(RUN.indexOf('str')==0){var v=Math.max(0,Math.min(1,(x+1)/2));return'hsl('+(200-v*170)+',70%,'+(62-22*v)+'%)'}var h=((x%(2*Math.PI))+2*Math.PI)%(2*Math.PI)/(2*Math.PI)*360;return'hsl('+h+',70%,45%)'}\nvar rs=null;function ix(i){return Math.min(rs===null?S[i].step:rs,S[i].hist.length-1)}\nvar pulse=new Array(N).fill(0),last=new Array(N).fill(0);\nfunction draw(){\n var g=mc.getContext('2d');g.clearRect(0,0,mc.width,mc.height);\n g.strokeStyle='#0f5257';g.lineWidth=1.2;g.globalAlpha=.55;\n for(var k=0;k<COAST.length;k++){var s=COAST[k];g.beginPath();for(var j=0;j<s.length;j+=2){var p=px(s[j],s[j+1]);if(j==0)g.moveTo(p[0],p[1]);else g.lineTo(p[0],p[1])}g.stroke()}\n g.globalAlpha=1;if(!S)return;\n var P=[];for(var i=0;i<N;i++)P.push(pos(S[i],i));\n for(var i=0;i<N;i++){var a=P[i],b=P[(i+1)%N];if(!a||!b)continue;var w=Math.max(pulse[i],pulse[(i+1)%N]);\n  g.strokeStyle=w>0?'rgba(43,176,138,'+(.35+.65*w)+')':'rgba(15,82,87,.28)';g.lineWidth=w>0?2+2*w:1;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke()}\n for(var i=0;i<N;i++){var a=P[i];if(!a)continue;var x=S[i].hist[ix(i)];\n  g.fillStyle=col(x);g.beginPath();g.arc(a[0],a[1],5+3*pulse[i],0,7);g.fill();g.strokeStyle='#fff';g.lineWidth=1;g.stroke()}\n var r=rc.getContext('2d'),W=rc.width,R=W*.38,C=W/2;r.clearRect(0,0,W,W);\n r.strokeStyle='#0f5257';r.globalAlpha=.3;r.beginPath();r.arc(C,C,R,0,7);r.stroke();r.globalAlpha=1;\n for(var i=0;i<N;i++){var an=-Math.PI/2+2*Math.PI*i/N,cx=C+R*Math.cos(an),cy=C+R*Math.sin(an),x=S[i].hist[ix(i)];\n  r.fillStyle=col(x);r.beginPath();r.arc(cx,cy,W*.028+W*.01*pulse[i],0,7);r.fill();\n  r.strokeStyle='#111';r.lineWidth=2;r.beginPath();r.moveTo(cx,cy);r.lineTo(cx+W*.03*Math.cos(q(x)),cy+W*.03*Math.sin(q(x)));r.stroke();\n  r.fillStyle='#0f5257';r.font=(W*.028)+'px sans-serif';r.textAlign='center';r.fillText(i,C+(R+W*.075)*Math.cos(an),C+(R+W*.075)*Math.sin(an)+W*.01)}\n r.fillStyle='#0f5257';r.font=(W*.04)+'px sans-serif';r.textAlign='center';r.fillText('Schritt '+(rs===null?Math.min.apply(null,S.map(function(n){return n.step})):rs),C,C+W*.014)}\nfunction q(x){return RUN.indexOf('str')==0?x*Math.PI/2:x}\nfunction tick(){for(var i=0;i<N;i++)pulse[i]=Math.max(0,pulse[i]-.04);draw();requestAnimationFrame(tick)}\nfunction upd(d){\n var first=!S;S=d.nodes;for(var i=0;i<N;i++){if(S[i].step>last[i])pulse[i]=1;last[i]=S[i].step}\n var mn=Math.min.apply(null,S.map(function(n){return n.step})),T=S[0].target||40;\n document.getElementById('stp').textContent='Schritt '+mn+' von '+T;document.getElementById('pb').style.width=(100*mn/T)+'%';\n var cs={};S.forEach(function(n){if(n.colo)cs[n.colo]=1});var ks=Object.keys(cs).sort();\n document.getElementById('tb').innerHTML='<tr><td>Rechenzentren</td><td class=\"mono\">'+ks.length+': '+ks.join(', ')+'</td></tr><tr><td>Anfragen zwischen den Knoten</td><td>'+S.reduce(function(a,n){return a+n.reqs},0)+'</td></tr>'+(RUN.indexOf('str')==0?'<tr><td>Kennzahl des Startvektors</td><td class=\"mono\">'+S[0].seed+'</td></tr>':'<tr><td>Kennzahl der Eigenfrequenzen</td><td class=\"mono\">'+S[0].seed+'</td></tr><tr><td>Windung der Eingabe Q · Breite B</td><td>'+S[0].Q+' · '+S[0].B+'</td></tr>');\n if(mn>=T&&!dead){dead=true;res(0);var b=document.getElementById('badge');b.className='live done';b.innerHTML='<i></i>LAUF ABGESCHLOSSEN';document.getElementById('lk').innerHTML='<button class=\"btn\" onclick=\"rp()\">Ablauf noch einmal abspielen</button> <a class=\"btn\" href=\"/pruefung?run='+RUN+'\">Zur Prüfung dieses Laufs</a>'}\n}\nfunction res(n){fetch('/pruefung?run='+RUN+'&t='+Date.now()).then(function(r){return r.text()}).then(function(t){if(t.indexOf('ABGESCHLOSSEN')<0){if(n<8)setTimeout(function(){res(n+1)},1500);return}var d=new DOMParser().parseFromString(t,'text/html');var h=d.querySelector('h2'),o='',e=h?h.nextElementSibling:null,k=0;while(e){if(k>0&&e.tagName!='SCRIPT')o+=e.outerHTML;k++;e=e.nextElementSibling}document.getElementById('res').innerHTML='<h2>Ergebnis dieses Laufs</h2>'+o}).catch(function(){})}\nfunction rp(){rs=0;var t=setInterval(function(){rs++;for(var i=0;i<N;i++)pulse[i]=1;document.getElementById('stp').textContent='Wiedergabe: Schritt '+rs+' von '+(S[0].target||40);if(rs>=(S[0].target||40)){clearInterval(t);setTimeout(function(){rs=null;document.getElementById('stp').textContent='Schritt '+(S[0].target||40)+' von '+(S[0].target||40)},1500)}},300)}\nfunction poll(){if(dead)return;fetch('/zustand?run='+RUN+'&t='+Date.now()).then(function(r){return r.json()}).then(function(d){if(d.nodes)upd(d);setTimeout(poll,900)}).catch(function(){setTimeout(poll,2000)})}\nsetInterval(function(){document.getElementById('clk').textContent=new Date().toISOString().slice(11,19)+' UTC (Uhr deines Geräts)'},250);\npoll();tick();\n</script>\n";
const COAST=[[-180,69,-175.5,67.5,-174,66,-174.5,67,-173.5,67,-169.5,66,-173,65.5,-172,65,-173,64,-178.5,65.5,-178.5,66.5,-179.5,66,-180,65],[180,65,175,64.5,178,64.5,179.5,62.5,179,62.5,173.5,62,170.5,60,169.5,60.5,163.5,60,162,58,163.5,57.5,162.5,57.5,163.5,56,162,56,162,54.5,160,54,160,53,158.5,53,156.5,51,156,56.5,164,61,164,62.5,165.5,62.5,164.5,62.5,160,60.5,160.5,62,156.5,61.5,154,60,155,59,142.5,59,135,55,137,54.5,137,54,137.5,54.5,137.5,53.5,139.5,54.5,141.5,53.5,140.5,53,141.5,52,140,48.5,135,43.5,133,42.5,132,43.5,127.5,39.5,129.5,37,129.5,35.5,128.5,35,126.5,34.5,127,36,126,37,127,37.5,124.5,38,125.5,39.5,123.5,40,121,38.5,122,41,117.5,39,119,37,122.5,37.5,119,35,122,31.5,120,32,122,31,120,30,122,30,122,29,119.5,27,119.5,25.5,116.5,23,114.5,22.5,113.5,23,113.5,22,110.5,21.5,110.5,20,109.5,22,106.5,21,105.5,19,109,15,109,11.5,105,8.5,105,10,101,12.5,101,13.5,100,13.5,99,9.5,100.5,7,103,5.5,104.5,1.5,101.5,3,100,6.5,98.5,8,99,11.5,97.5,16.5,97,17.5,95.5,15.5,94,16,94,19.5,91.5,23,89,21.5,88,22,86.5,20,80.5,15.5,80,10.5,77.5,8,73.5,16,73,22.5,71,20.5,69,22.5,70.5,23,67.5,24,66.5,25.5,62,25,57.5,26,56.5,27,53.5,26.5,49,30.5,47.5,29.5,51,24.5,51.5,26,51.5,24.5,54,24,56.5,26.5,56.5,24.5,60,22,58,20,58,19,55,17,43.5,12.5,42.5,16.5,39,21,38.5,24,34.5,28,35,29.5,34,27.5,32.5,30.5,34.5,32,36,37,33,36,31,37,29.5,36,27.5,36.5,28.5,37,27.5,37,27.5,38,26,38.5,27,38.5,27,39.5,26,39.5,26.5,40.5,33.5,42,38.5,41,41.5,41.5,41.5,42.5,36.5,45,39.5,47.5,35,46.5,35,45.5,35,46,36.5,45.5,34,44.5,32.5,45.5,33.5,46,32,46.5,32,47,30,46.5,27.5,42.5,29,41,26,40,27,40.5,25,41,23.5,41,24,40,22.5,40.5,23.5,39,22.5,39,24,38,22.5,37.5,23,36.5,21.5,37,21.5,38,23,38,21,38.5,19.5,40.5,19.5,42,16,43.5,14.5,45.5,14,45,13.5,46,12,45.5,12.5,44,18.5,40,17,40.5,17,39,16,38,15.5,40,8.5,44.5,6,43,3,43,3,42,0.5,41,-0.5,39.5,0,38.5,-2,36.5,-5.5,36,-7,37.5,-9,37,-8.5,38.5,-9.5,39,-8.5,41,-9,43,-2,43.5,-1,45.5,-0.5,45,-2.5,47.5,-5,48.5,-1.5,48.5,-2,49.5,0.5,49.5,1.5,51,4.5,51.5,3.5,51.5,4.5,51.5,4,52,4.5,53,6,52.5,6,53.5,10,53.5,8.5,55,8.5,57,10.5,57.5,10,56.5,11,56.5,9.5,55,11,54,13,54.5,14.5,53.5,18,55,19.5,54,21,55,21.5,57.5,24.5,57,24.5,58.5,23.5,59,30.5,60,28.5,60.5,23,60,21.5,60.5,21,63,25.5,65,22.5,66,21,65.5,21.5,64.5,20.5,64,17.5,63,17,60.5,19,59.5,16,58.5,17,58.5,16.5,57,14,55.5,13,55.5,13,56.5,11,60,8,58,5.5,59,6.5,59.5,5,59.5,7,60.5,5.5,60,5,61,7.5,61,5,61,6,61.5,5,62,7,62,5,62,11,63.5,11.5,64,9.5,64,13,65.5,12,65,14,66.5,13,66,13.5,67,15.5,67,14.5,67.5,16,67.5,15,68,18,68.5,16.5,68.5,18,69.5,23.5,70,24.5,71,26,71,25,70,28,71,28,70.5,31,70.5,29,70,29.5,69.5,32,70,33.5,69.5,33,69,36,69,41,67.5,41,67,39,66,32,67,35,66,35,64.5,37.5,64,38,64.5,37,65,40.5,64.5,39.5,65.5,40.5,66,44,66,44,68.5,43.5,68.5,46.5,68,45,67.5,46,67,54,69,53,68,59,69,60,68.5,61,69,60,69.5,61,70,68.5,68,69.5,69,67,69.5,67.5,70.5,66.5,71,69.5,73,71.5,73,73,72.5,72,71.5,73,71,72.5,69,73.5,68.5,71.5,67,69,66.5,72,66,75,67.5,74.5,69,76.5,69,77,68,79,67.5,77.5,67.5,78,68,77.5,69,74,69,74.5,70.5,73,71.5,75,72,75,73,76,71,78.5,71,76,72,78.5,72.5,83.5,71.5,82,70.5,83,71,82.5,70,84,69.5,83,70.5,84,70.5,83.5,71.5,81,72.5,80.5,73.5,87,74,86,75,93.5,76,100,76,99,76.5,104,77.5,106.5,77.5,104,77,107.5,77,106.5,76.5,111,77,114,76,105.5,72.5,110,74,123,73,124.5,74,129,73,129.5,72.5,128.5,72.5,129.5,72,128.5,72,131,70.5,133,72,140,71.5,139.5,72,140,72.5,139,72.5,141,73,147,72.5,144,72,147,72.5,145.5,71.5,148.5,72.5,152.5,71,159,71,161,69,168,70,170.5,69,171,69,170.5,70,180,69],[32.5,31,32.5,29,37.5,21,37.5,19,39.5,15,43.5,12.5,42.5,11.5,44.5,10.5,51,12,51.5,10.5,48,4.5,41,-2,39,-4.5,39,-6,39.5,-10,40.5,-10.5,41,-15,40,-16.5,34.5,-19.5,35.5,-24,32.5,-26,32.5,-28.5,27,-33.5,19.5,-35,18.5,-34.5,18,-31.5,15.5,-27.5,14.5,-22.5,12,-18,11.5,-16,14,-11,12.5,-6,8.5,-0.5,10,0,9.5,0.5,9.5,4,8,5,6,4.5,4,6.5,-2,4.5,-4,5.5,-7.5,4.5,-9.5,5,-13,8,-13.5,10,-15.5,11.5,-15,12,-17,12.5,-16.5,13.5,-15.5,13.5,-16.5,13.5,-17.5,14.5,-16,17.5,-17,22,-14.5,26,-10,29.5,-9.5,32.5,-5.5,36,-2,35,1,36.5,9.5,37.5,11,37,10,34,19,30.5,21.5,33,29,31,32.5,31],[-80,9.5,-80,7.5,-81,7,-85.5,10,-87.5,13.5,-91.5,14,-94.5,16,-96.5,15.5,-103.5,18.5,-105.5,20,-106,23,-109.5,25.5,-109,26.5,-114,31.5,-115,32,-114.5,30,-109.5,23.5,-110,23,-112,24.5,-112,26,-115,27.5,-114,27.5,-114,28.5,-115.5,30,-117.5,33.5,-120.5,34.5,-124.5,40.5,-123.5,46,-124.5,48.5,-123,48,-123,47,-122.5,49,-125,50,-125,51,-128,51,-127,52.5,-128.5,52.5,-128,52.5,-129,53.5,-128,53.5,-130.5,54.5,-130,56,-130.5,55,-131,56,-132,55.5,-131.5,56,-133.5,57,-133,57.5,-133.5,58.5,-135,58.5,-135.5,59.5,-135,58,-137,59,-136,58.5,-136.5,58,-140,59.5,-139,60,-139.5,60,-144.5,60,-147.5,61.5,-148.5,61,-148,60.5,-148.5,60,-151.5,59,-151,60,-152,60,-151.5,60.5,-149,61,-149.5,61.5,-153,60.5,-154.5,59,-153,59,-158.5,56,-163.5,55,-157.5,57.5,-157,59,-162,58.5,-161.5,59,-162,60,-164,60,-164.5,60.5,-163.5,60.5,-166,61.5,-164.5,63,-161,63.5,-161.5,64.5,-161,64.5,-166,64.5,-167,65,-166,65.5,-168,65.5,-164.5,66.5,-161,66,-162.5,67,-160,66.5,-167,68.5,-156.5,71.5,-135.5,68.5,-136,69,-134.5,69.5,-129.5,70.5,-131,69.5,-128,70.5,-125.5,69.5,-124.5,70,-124.5,69.5,-122,70,-115,69,-114,68.5,-115,68,-110,68,-107,66.5,-108,68,-105.5,68.5,-109,68.5,-106,69,-102,67.5,-97.5,67.5,-98.5,68.5,-96,68.5,-96.5,67.5,-95.5,67,-95.5,68,-93.5,68.5,-94.5,69,-93.5,69.5,-96.5,70,-96,70.5,-96.5,71.5,-95,72,-91.5,70,-93,69.5,-90.5,69.5,-91.5,69.5,-90,68,-89.5,69,-88,69,-87.5,67,-84.5,68.5,-85.5,70,-82,69.5,-83.5,69.5,-81.5,69,-82.5,68.5,-81.5,67,-83.5,66.5,-85,67,-84,66,-87,66.5,-86,66,-87.5,65.5,-91,66,-87,65,-90.5,63.5,-94,64,-90.5,63,-93.5,62,-95,59,-93,58.5,-93,57,-91,57.5,-85,55,-82.5,55,-82.5,53,-80,51,-78.5,52,-80,54.5,-76.5,56.5,-77,58,-78.5,58.5,-77,60,-78,61,-77.5,61.5,-78,62.5,-73.5,62.5,-69.5,61,-69.5,60,-71,60,-69,59.5,-70.5,59,-68.5,59,-68.5,58,-66.5,59,-66,58.5,-64.5,60,-63.5,59,-64,59,-63,58.5,-63.5,58.5,-62.5,58.5,-63.5,58,-61.5,57,-62.5,57,-60.5,56,-60.5,55,-57.5,54.5,-61,53,-57.5,54,-57.5,53.5,-56,53.5,-56.5,52.5,-55.5,52,-60,50,-66.5,50.5,-70,48.5,-71,47,-68,48.5,-64.5,49,-64.5,48.5,-67,48,-64.5,47.5,-65.5,47,-64.5,46,-61,45.5,-65.5,43.5,-66,44.5,-63.5,45.5,-65,45.5,-64.5,46,-69,44.5,-71,42.5,-70,41.5,-73.5,41,-75,39,-75.5,39.5,-75,38.5,-76,37,-76,39.5,-76.5,39.5,-76.5,38,-77,38.5,-75.5,36,-76,36.5,-76.5,36,-75.5,35.5,-77,35.5,-76.5,35,-81,32.5,-81.5,31,-80,27,-80.5,25,-81.5,26,-83.5,30,-88,31,-90.5,30,-89,30,-89.5,29,-95,29.5,-98,27.5,-97,26,-98,22.5,-96,18.5,-91.5,18.5,-90.5,21,-87,21.5,-89,16,-83.5,15.5,-83.5,10.5,-82,9,-80,9.5],[-73.5,-53,-73,-52.5,-73.5,-53,-73.5,-52,-72.5,-52,-74,-51.5,-74,-51,-73.5,-50.5,-74.5,-50,-73.5,-49.5,-74.5,-48,-73,-48,-74.5,-47.5,-74,-47.5,-74,-47,-75.5,-46.5,-74.5,-46,-73.5,-46.5,-72.5,-44.5,-73.5,-44,-72.5,-41.5,-74,-41.5,-74,-41,-73,-39.5,-73.5,-37.5,-71.5,-33,-70.5,-18.5,-76,-14.5,-81.5,-4.5,-79.5,-2.5,-81,-2,-80,1,-79,1,-77,4,-78,8.5,-80,9.5,-78,9,-77,8,-75.5,11,-71.5,12.5,-71.5,9,-71,9.5,-71.5,11,-70,11.5,-70,12,-68,10.5,-62,10.5,-63,10.5,-59,8,-58.5,6.5,-54,6,-51.5,4.5,-50,1,-52.5,-1.5,-51,-1,-50.5,-2,-49.5,-1.5,-49.5,-2.5,-48,-0.5,-46,-1,-44.5,-2,-45,-3.5,-43.5,-2.5,-40,-3,-35.5,-5,-35,-7,-35.5,-9.5,-39,-13,-39,-17.5,-41,-22,-48.5,-25.5,-49,-28.5,-52,-32,-50.5,-30.5,-51.5,-30,-54,-34.5,-58,-34.5,-58.5,-33,-58.5,-34.5,-56.5,-36.5,-57.5,-38,-62.5,-39,-62.5,-41,-65,-40.5,-65,-42,-63.5,-42.5,-65,-42.5,-64.5,-43,-65.5,-45,-67.5,-46,-66,-48,-68,-50,-68.5,-50,-69.5,-51.5,-68.5,-52.5,-71,-52.5,-71.5,-54,-72.5,-53.5,-71.5,-52.5,-73.5,-53],[146.5,-39,145,-38,143.5,-39,140.5,-38,139.5,-36,138,-35.5,138,-34,137,-35.5,138,-32.5,136,-35,134,-32.5,131,-31.5,126,-32.5,123.5,-34,116,-35,115,-34,116,-32,113,-26,114,-26.5,113.5,-25.5,114,-26.5,113.5,-24.5,114,-22,114.5,-22.5,117,-20.5,121,-19.5,123,-16.5,123.5,-17.5,123.5,-16,125,-16.5,124.5,-15.5,126,-14,127.5,-14,128,-15.5,128.5,-15,129.5,-15,130.5,-12.5,133,-12,132,-11,136,-12.5,136.5,-12,135.5,-15,140.5,-17.5,142.5,-10.5,144,-14.5,145.5,-15,146.5,-19,149,-20,149.5,-22.5,150.5,-22.5,151,-23.5,153,-25.5,153.5,-28.5,150,-37.5,146.5,-39],[-44.5,60,-44.5,60.5,-46,60.5,-45,61,-48,61,-50.5,62.5,-49.5,63,-51,63,-50,63.5,-51.5,64,-50,64,-52,64,-50,65,-51,65,-52,64,-51.5,65,-52.5,65.5,-50.5,65.5,-53,65.5,-50.5,67,-53.5,66,-52,67,-54,67,-51.5,67.5,-54,67.5,-50.5,68,-54,67.5,-50.5,68,-53.5,68.5,-50.5,68.5,-51.5,68.5,-50,69,-51,69,-50,70,-54.5,70.5,-50.5,70.5,-52.5,71,-51.5,71.5,-53,71.5,-51.5,71.5,-53.5,72.5,-54,71.5,-55.5,71.5,-54.5,72,-55.5,72.5,-54.5,72.5,-56,74.5,-57.5,74,-56,74.5,-58.5,75.5,-68.5,76,-69.5,76.5,-68,76.5,-71.5,77,-66,77.5,-73,78.5,-66,79,-64,80,-67.5,80.5,-62,81,-62,82,-57,81.5,-60,82,-55,82.5,-55,81.5,-50.5,81.5,-51.5,82.5,-45.5,82,-43.5,82,-46.5,83,-41,82.5,-46,83,-44.5,83.5,-27,83.5,-37,82.5,-22,82.5,-34.5,82,-23,82,-22.5,81.5,-25,80.5,-20,81.5,-12,81.5,-21.5,80.5,-16,80.5,-20.5,80,-17.5,80,-22,78,-18.5,77,-22.5,76.5,-19.5,75.5,-22.5,75,-19,74.5,-22,74.5,-22.5,74,-20.5,73.5,-26,74,-24.5,73.5,-27.5,73,-22,71.5,-22.5,71.5,-21.5,70.5,-28.5,72,-25.5,71.5,-28.5,71,-29,70.5,-26.5,70.5,-28.5,70,-22,70,-29.5,68,-32.5,68.5,-32,68,-35,66.5,-37,65.5,-38,66.5,-38,65.5,-41,65,-40.5,64.5,-41.5,64.5,-40.5,63.5,-43,62.5,-42,62.5,-43,62.5,-42,62,-43.5,61.5,-42.5,61,-43.5,61,-43,60.5,-44.5,60],[150,-10,151,-10,150,-10.5,147.5,-10,145,-7.5,142,-8,143.5,-9,142.5,-9.5,139,-8.5,138,-5.5,134,-4,134,-3,133,-4,132,-3,134,-2,131,-1.5,132.5,-0.5,134,-1,135,-3.5,138,-1.5,144.5,-4,146,-5.5,147.5,-6,147,-7.5,150,-10],[115,-4,113,-3,112,-3.5,111.5,-3,110.5,-3,109,1,109.5,2,111,1.5,111.5,2.5,115.5,5,117,7,117.5,6,119.5,5.5,117,3.5,119,1,118,1,117.5,-1,115,-4],[45,-25.5,44,-25,43,-22.5,44.5,-20,44,-17.5,44.5,-16,47,-15.5,49.5,-12,50.5,-15.5,49.5,-15.5,47,-25,45,-25.5],[-66,62,-71.5,63,-71,63.5,-73.5,64.5,-78,64.5,-77.5,65.5,-73.5,65.5,-74.5,66,-72,66.5,-73,67,-72,67.5,-73.5,68.5,-76.5,68.5,-75.5,69,-77,70,-79,70.5,-79.5,70.5,-79,70,-86,70,-89.5,71,-85,71,-84.5,71.5,-86,72,-84,72,-85.5,73,-81.5,73.5,-80,72.5,-81,72,-80,72.5,-77.5,71.5,-79,72,-76.5,72.5,-75,72.5,-76,71.5,-74,72,-75,71,-73.5,72,-74,71,-71,71.5,-72.5,70.5,-70.5,71,-71.5,70,-68.5,70.5,-70.5,70,-68,70.5,-67,69.5,-70,69.5,-66.5,69,-69.5,69,-61.5,66.5,-63,66.5,-62,66,-63,66,-62.5,65.5,-63.5,66,-63.5,65,-65.5,65.5,-64.5,66.5,-68,66.5,-67,66,-68.5,66,-68,65.5,-64.5,64,-65,62.5,-69,64,-66,62],[104,-5.5,95,5.5,97.5,5.5,102.5,0,103.5,0.5,103.5,-0.5,106,-3,105.5,-6,104,-5.5],[136,33.5,135,34,135.5,34.5,132,34,131,34.5,133,35.5,136,35.5,137,37.5,137.5,37,139.5,38,140,40.5,141.5,41.5,142,39.5,141,38,141,35.5,139,34.5,136.5,35,136,33.5],[-113.5,69,-117.5,70,-111.5,70.5,-117.5,70.5,-115,71.5,-119,72,-114.5,73.5,-114.5,72.5,-110,73,-108,71.5,-107,72,-108,73,-107,73.5,-105.5,73,-104.5,71,-101,70,-103.5,69.5,-101.5,69,-103,69,-106.5,69.5,-110.5,68.5,-113.5,69],[0,51,-5.5,50,-2.5,52,-5.5,52,-4,52.5,-5,53,-4,53,-2.5,53.5,-3.5,54.5,-3,55,-5,55,-5,56,-6,55.5,-5,56.5,-6,56.5,-5,58.5,-3,58.5,-4.5,57.5,-2,57.5,-3.5,56.5,-2.5,56.5,-4,56,-1.5,55.5,0,53,1.5,52.5,0.5,51.5,1.5,51,0,51],[-77,83,-61,82.5,-69.5,81.5,-66.5,81.5,-70,81,-64.5,81.5,-72.5,80,-70.5,80,-71.5,79.5,-78,79.5,-74.5,79,-79,79,-75,78.5,-82,77.5,-78,77,-78.5,76.5,-87.5,76.5,-89.5,76.5,-86.5,77,-88,78,-84.5,77.5,-82.5,78,-85,77.5,-85.5,78,-84,78,-84.5,78.5,-87.5,78,-87,78.5,-81.5,79,-84.5,79,-83.5,79,-86.5,80.5,-80.5,79.5,-83,80.5,-78,80.5,-80,80.5,-76.5,81,-79,81,-77,81.5,-86,80.5,-82.5,81,-87.5,80.5,-89.5,81,-84.5,81.5,-92,81.5,-80.5,82,-82.5,82.5,-77,83],[119.5,-5,119,-3,120,0.5,121,1.5,124,1,125,1.5,124.5,0.5,120.5,0.5,120.5,-1.5,123.5,-1,121.5,-2,123,-4.5,121.5,-5,121,-2.5,120.5,-5.5,119.5,-5],[170,-46.5,166.5,-46,167,-45.5,170.5,-43,172.5,-40.5,173,-41.5,174.5,-41,173,-44,171.5,-43.5,172,-44,170,-46.5],[114,-8.5,105,-7,106,-6,109,-7,111,-6.5,114.5,-8,114,-8.5],[175,-41,175,-40,174,-39.5,175,-37,172.5,-34.5,174.5,-35,174.5,-37,175.5,-37,175.5,-36.5,176,-37.5,178.5,-37.5,176,-41,175,-41],[-55,47,-56,47,-54.5,47.5,-56,48,-59.5,48,-56,51.5,-57,49.5,-56,50,-55.5,49,-53.5,49.5,-54,48.5,-53,48.5,-54,48,-52.5,47.5,-53,46.5,-54,47,-54,48,-55,47],[-75,20,-77.5,20,-77,20.5,-82,22.5,-85,22,-81,23,-74.5,20.5,-74,20,-75,20],[124,13,122.5,14,122.5,13,120.5,14,121,14.5,119.5,16,120.5,18.5,122.5,18.5,121.5,14.5,123.5,14,124,13],[-17,64,-22.5,64,-21.5,64.5,-24,65,-21.5,65.5,-24.5,65.5,-22.5,66,-23,66.5,-21,65,-20.5,66,-14.5,66.5,-15,66,-13.5,65,-17,64],[125,6,123.5,8,122,7,123.5,8.5,123.5,8,125.5,9,125.5,10,126.5,7.5,126,6.5,125.5,7.5,125,6],[-8,52,-10.5,52,-8.5,52.5,-10,52.5,-9,53,-10,53.5,-10,54,-6,55,-5.5,54.5,-6.5,54,-6.5,52,-8,52],[143.5,42,140.5,42.5,141,42,140,41.5,140.5,43.5,141.5,43.5,141.5,45.5,143.5,44,145.5,44.5,146,43.5,143.5,42],[142,46,141.5,52.5,142.5,54.5,144.5,48.5,143,49,142.5,48,143.5,46.5,142.5,46.5,142,46],[-71,18,-74.5,18.5,-72.5,18.5,-73.5,20,-71,20,-68.5,18.5,-71,18],[-120.5,72,-123,71,-126,72,-124,74,-124.5,74.5,-121.5,74.5,-115.5,73.5,-120.5,72],[80.5,6,80,10,82,7,80.5,6],[146,-43.5,144.5,-40.5,148,-41,148,-43,146,-43.5],[-92,75,-93,76.5,-97,76.5,-95.5,77,-89.5,76.5,-91.5,76.5,-89,75.5,-81.5,76,-79.5,75,-92,75],[-66.5,-55,-72,-54.5,-69,-54.5,-70,-54,-69.5,-53.5,-70.5,-53.5,-69.5,-52.5,-65,-54.5,-66.5,-55],[58.5,74,54,73.5,56.5,74,55,74,57,74.5,56,75,69,76.5,58.5,74],[-81,63.5,-83,64,-85,63,-87,63.5,-86,64,-85.5,66,-80,64,-81,63.5],[-115.5,75,-117.5,75.5,-115,75.5,-117,75.5,-115,76,-116.5,76,-115,76.5,-109,75.5,-110.5,76.5,-108.5,77,-108,76,-105.5,75.5,-112.5,74.5,-114.5,74.5,-111,75.5,-115.5,75],[-94,79,-90.5,79,-96.5,80,-94.5,80,-96.5,80.5,-94,80.5,-95.5,81,-93.5,81.5,-85,79.5,-88,79,-89,78,-94,79],[15.5,77,14,77.5,17,78,13.5,78,17.5,78.5,13,78,11.5,78.5,12.5,79,11,80,16.5,79,15.5,80,16.5,80,21.5,79,19,78.5,17,76.5,15.5,77],[121,22,120,23.5,121.5,25.5,121,22],[151,-6,148.5,-5.5,151,-5.5,152,-4,152,-5.5,151,-6],[-85,71.5,-90,72,-89,73.5,-85,74,-86.5,72.5,-85,71.5],[-97,71.5,-99,71.5,-102.5,72.5,-100,73,-101.5,73.5,-101,74,-97,74,-98.5,73,-96.5,73,-97,71.5],[54,70.5,51.5,72,55,73.5,56.5,73,55,72,57.5,70.5,54,70.5],[-125.5,49,-128.5,51,-125.5,50.5,-123.5,48.5,-125.5,49],[124,-10.5,123.5,-9.5,125,-8.5,127.5,-8.5,124,-10.5],[15,36.5,12.5,38,15.5,38.5,15,36.5],[-95,72,-95.5,73.5,-94.5,73.5,-95.5,74,-90,74,-95,72],[138,75,137,75.5,139,76,145.5,75.5,138,75],[128,-0.5,128,2,127.5,1,128.5,1.5,128,1,129,0,128,0.5,128,-0.5],[128,-3,130.5,-3,131,-4,128,-3],[-100,75,-101,75.5,-99.5,75.5,-103,75.5,-98.5,76.5,-97.5,75.5,-100,75],[-117,77.5,-115.5,77.5,-117,76.5,-123,76,-117,77.5],[96,79,93,79.5,94.5,80,100,80,99.5,79,96,79],[27,80,23.5,79,17.5,80,27,80],[-99,69,-98,70,-95,69,-99,69],[118,9,119.5,11.5,119.5,10.5,118,9],[-99,78,-105.5,79,-101,79,-99,78],[100.5,78,99.5,78,102,79.5,105.5,78.5,100.5,78],[-80,73,-81,73.5,-80,73.5,-76,73,-80,73],[93.5,80,91.5,80.5,95,81.5,98,80.5,93.5,80],[-96.5,75,-94.5,75.5,-93.5,74.5,-96.5,75],[147,75,146.5,75.5,151,75,147,75],[-96,78,-98.5,78.5,-95,78.5,-96,78],[143,73,140,73.5,142,74,143,73],[24,77.5,21,77.5,21.5,78,21,78,24,77.5],[49.5,39.5,50.5,40.5,46.5,44.5,49.5,46.5,53,47,53.5,45.5,51.5,45.5,51.5,44.5,50,44.5,52.5,42.5,53,41,53.5,42,55,41,53,41,52.5,40.5,54,39,54,37,49,37.5,49.5,39.5],[-86,43,-87.5,42,-87.5,45,-88,44.5,-87,46,-84,46,-84.5,46.5,-92,47,-88,49,-85,48,-84.5,46.5,-81,46,-79.5,45,-81.5,45.5,-82,43,-83,44,-84,43.5,-83.5,45,-85,46,-86.5,44.5,-86,43],[32,-1,32.5,0.5,35,-0.5,33,-3,32,-2.5,32,-3,32,-1],[61.5,44.5,60,43.5,58.5,43.5,58,45,59.5,46.5,61.5,47,61,46,61.5,44.5],[29,-4,31,-9,29,-6,29,-4],[109.5,55.5,109,53.5,106,51.5,103.5,51.5,106.5,52.5,109.5,55.5],[-123.5,65,-121,66,-125,66.5,-120,67,-119,67,-120.5,66.5,-117.5,66.5,-121,65,-120.5,65.5,-123.5,65],[-115,61,-117.5,61.5,-114.5,62,-116,63,-113.5,62,-109,63,-115,61],[34,-9.5,35,-14.5,34,-12.5,34,-9.5],[-81.5,42.5,-79,43,-81.5,41.5,-83.5,41.5,-82.5,42.5,-83,42,-81.5,42.5],[-98.5,53,-99,53.5,-98,54.5,-96.5,50.5,-98.5,53],[-76,44.5,-77,43.5,-80,43.5,-76,44.5],[31,61.5,33,60.5,31,60,30,61,31,61.5],[74,46.5,79.5,46.5,75.5,46.5,74,45,73.5,46,74,46.5],[28,61,27.5,61.5,29,62,27.5,62.5,27,63.5,29,62.5,28,62.5,30,62.5,28,61],[-111.5,58.5,-109.5,59.5,-106,59.5,-111.5,58.5],[49,54.5,48.5,54.5,50,53.5,48.5,53.5,49,55.5,52,55.5,49,54.5],[-64.5,55,-63,54,-65,53.5,-66.5,54.5,-65,54,-65.5,54.5,-64,54,-64.5,55],[32,49.5,35.5,48.5,35.5,47.5,32.5,46.5,35,48,32,49.5],[103,74.5,100.5,74.5,101.5,74,99,74.5,100.5,74.5,100,75,106,75,103,74.5],[102,56,103.5,55.5,103.5,53,103,56,102,56,102,55,101,56,102,56],[44.5,48.5,46,51.5,47,52,44.5,48.5],[-54,-2,-55.5,-3.5,-55,-2.5,-55.5,-2,-63.5,-4.5,-63,-4,-66,-2.5,-70,-4.5,-72,-3,-73,-3.5,-72,-3,-70,-4.5,-66,-2.5,-63,-4,-60,-3.5,-61.5,-1.5,-66,0,-63.5,-0.5,-60,-3,-54,-2],[120,60.5,118,59.5,115,60.5,112.5,59,115,60.5,118.5,59.5,128.5,61.5,130,62.5,126.5,64.5,119,63.5,126.5,64,124.5,65,123,67.5,126,70.5,127.5,71,127.5,71.5,127.5,71,126,70.5,123,68,124.5,65.5,128.5,63.5,133,63.5,136,62.5,134.5,60.5,135.5,61,135.5,62.5,129.5,63.5,130,62.5,128.5,61.5,120,60.5],[24.5,0.5,22.5,2,19,1.5,16,-3,18,2.5,18,-0.5,20,2,22.5,2,24.5,0.5],[66,64,65,63,68.5,61,77.5,60.5,83,58.5,84.5,57,84,56.5,84,57.5,78.5,60.5,74.5,61,69,61,70,60,68,58,70,60.5,65,63,66,64,65,65,65.5,66,69,67,66,66,66,64],[-56,-27.5,-59,-27.5,-60.5,-33,-61,-32,-59,-27.5,-56,-27.5],[106,10,104.5,12.5,105,11.5,106,12.5,106,15,103.5,18.5,106,15,106,12.5,105,11.5,106.5,10.5,105.5,10.5,106,10],[130.5,47,136.5,49,137,49.5,136,50,140,52,139.5,53,140.5,53,139.5,53,141,51.5,130.5,47],[87.5,64,87.5,63.5,89,62.5,87,63.5,88,65.5,86,66.5,86,69.5,84,70,86,69.5,86.5,66.5,92,64.5,89,66,87.5,64],[119.5,32,116,29.5,116.5,29,114.5,30.5,116.5,30,119.5,32],[-67.5,6,-66.5,7.5,-62.5,8.5,-62.5,9.5,-61.5,8.5,-66.5,7.5,-67.5,6],[-71.5,46.5,-76,44.5,-74,45.5,-77.5,46,-74,45.5,-71.5,46.5],[-125,64.5,-128.5,65.5,-130.5,67,-134.5,68,-134,68.5,-133.5,67.5,-130.5,67.5,-129,65.5,-125,64.5],[-158,65,-160,62,-162,61.5,-164.5,63,-162,61.5,-160,62,-158,65],[57,65.5,56,66.5,52,65.5,52,67.5,54,68,52,67.5,52,65.5,56,66.5,57,65.5],[69.5,28.5,68,27,68.5,25.5,67.5,24,68.5,25.5,68,27,69.5,28.5],[6.5,8.5,9,8,7,8,6.5,5.5,6.5,8.5],[-13,15.5,-14.5,16.5,-16.5,16,-14.5,16.5,-13,15.5],[45,62,42,63,42,64.5,40.5,64.5,45,62],[161,68.5,154,67.5,158.5,69,161,68.5],[111.5,23.5,110,23.5,113,22.5,111.5,23.5],[105,73,102,72,103,71.5,99.5,71.5,105,73],[120.5,73,124,72,122.5,71,123.5,72,120.5,73],[-180,-78,-163.5,-78.5,-157,-77,-152,-77.5,-145.5,-75.5,-128,-74.5,-127,-73.5,-110.5,-74,-108.5,-75.5,-102,-75,-101,-74.5,-102.5,-74.5,-101.5,-74,-103,-73.5,-101.5,-73.5,-103.5,-73,-102.5,-72.5,-103.5,-72.5,-98.5,-71.5,-82,-74,-80.5,-73,-77.5,-73.5,-79.5,-73,-79,-72.5,-72,-73,-72.5,-72.5,-75.5,-72,-73.5,-71,-76.5,-71,-74,-70.5,-76,-70,-73.5,-70.5,-70.5,-69,-68.5,-70,-69,-69.5,-67,-69.5,-66.5,-68,-67.5,-67,-66.5,-67.5,-64,-65,-57.5,-63,-57,-63.5,-59,-64.5,-60.5,-64.5,-59.5,-65,-62,-65.5,-60,-67,-61.5,-69.5,-59.5,-72.5,-61.5,-75,-44,-78,-36,-78,-26.5,-76,-27.5,-75.5,-25,-75,-25.5,-74,-22,-74.5,-19,-72.5,0,-69.5,24.5,-70.5,33.5,-68.5,39,-70,40,-69,49,-67,51,-67,50.5,-66.5,54,-66,59,-67.5,69.5,-67.5,74.5,-70,86,-66.5,94.5,-66.5,96.5,-65,102.5,-66,103,-65,109,-67,113,-66,117.5,-67,126.5,-66,129,-67,130.5,-66,134.5,-66,144.5,-67,146,-66.5,145.5,-67.5,147.5,-68.5,154,-68.5,161,-70.5,170.5,-71.5,171,-72,169,-73.5,162.5,-75,166,-75.5,162.5,-75.5,163,-77,162.5,-77,164.5,-78,167,-78,166.5,-77,180,-78]];
const COLO={"AMS":[52.3,4.8],"ARN":[59.6,17.9],"ATL":[33.6,-84.4],"BNE":[-27.4,153.1],"CDG":[49.0,2.5],"DEN":[39.9,-104.7],"DFW":[32.9,-97.0],"EWR":[40.7,-74.2],"FRA":[50.0,8.6],"HKG":[22.3,113.9],"IAD":[38.9,-77.5],"ICN":[37.5,126.4],"KIX":[34.4,135.2],"LAX":[33.9,-118.4],"LHR":[51.5,-0.5],"LIS":[38.8,-9.1],"MAD":[40.5,-3.6],"MEL":[-37.7,144.8],"MIA":[25.8,-80.3],"MRS":[43.4,5.2],"MXP":[45.6,8.7],"NRT":[35.8,140.4],"ORD":[41.98,-87.9],"SEA":[47.4,-122.3],"SIN":[1.4,104.0],"SJC":[37.4,-121.9],"SYD":[-33.9,151.2],"VIE":[48.1,16.6],"WAW":[52.2,21.0],"BOM":[19.1,72.9],"DEL":[28.6,77.1],"MAA":[13.0,80.2],"BLR":[13.2,77.7],"GRU":[-23.4,-46.5],"GIG":[-22.8,-43.2],"EZE":[-34.8,-58.5],"SCL":[-33.4,-70.8],"BOG":[4.7,-74.1],"LIM":[-12.0,-77.1],"QRO":[20.6,-100.2],"MEX":[19.4,-99.1],"YYZ":[43.7,-79.6],"YUL":[45.5,-73.7],"YVR":[49.2,-123.2],"JNB":[-26.1,28.2],"CPT":[-34.0,18.6],"CAI":[30.1,31.4],"LOS":[6.6,3.3],"NBO":[-1.3,36.9],"DXB":[25.3,55.4],"DOH":[25.3,51.6],"TLV":[32.0,34.9],"IST":[41.3,28.8],"ATH":[37.9,23.9],"BCN":[41.3,2.1],"DUB":[53.4,-6.3],"CPH":[55.6,12.7],"OSL":[60.2,11.1],"HEL":[60.3,25.0],"MUC":[48.4,11.8],"ZRH":[47.5,8.6],"BRU":[50.9,4.5],"MAN":[53.4,-2.3],"PRG":[50.1,14.3],"BUD":[47.4,19.3],"OTP":[44.6,26.1],"SOF":[42.7,23.4],"KBP":[50.3,30.9],"LED":[59.8,30.3],"DME":[55.4,37.9],"PER":[-31.9,115.97],"AKL":[-37.0,174.8],"ADL":[-34.9,138.5],"BKK":[13.7,100.7],"KUL":[2.7,101.7],"CGK":[-6.1,106.7],"MNL":[14.5,121.0],"TPE":[25.1,121.2],"PEK":[40.1,116.6],"PVG":[31.1,121.8],"SZX":[22.6,113.8],"CAN":[23.4,113.3],"HND":[35.5,139.8],"FUK":[33.6,130.5],"IAH":[30.0,-95.3],"PHX":[33.4,-112.0],"SLC":[40.8,-111.98],"LAS":[36.1,-115.2],"PDX":[45.6,-122.6],"MSP":[44.9,-93.2],"DTW":[42.2,-83.4],"BOS":[42.4,-71.0],"CLT":[35.2,-80.9],"MCI":[39.3,-94.7],"STL":[38.7,-90.4],"TPA":[28.0,-82.5],"SAN":[32.7,-117.2],"SFO":[37.6,-122.4],"HNL":[21.3,-157.9],"ANC":[61.2,-150.0],"PTY":[9.1,-79.4],"SJU":[18.4,-66.0],"MLE":[4.2,73.5],"CMB":[7.2,79.9],"DAC":[23.8,90.4],"KHI":[24.9,67.2],"LHE":[31.5,74.4],"MCT":[23.6,58.3],"AMM":[31.7,36.0],"KWI":[29.2,48.0],"BAH":[26.3,50.6],"TUN":[36.85,10.2],"CMN":[33.4,-7.6],"ALG":[36.7,3.2],"ACC":[5.6,-0.2],"DAR":[-6.9,39.2],"LUX":[49.6,6.2],"DUS":[51.3,6.8],"HAM":[53.6,10.0],"TXL":[52.6,13.3],"BER":[52.4,13.5],"LYS":[45.7,5.1],"PMO":[38.2,13.1],"FCO":[41.8,12.25],"BEG":[44.8,20.3],"ZAG":[45.7,16.1],"RIX":[56.9,24.0],"TLL":[59.4,24.8],"VNO":[54.6,25.3],"KEF":[64.0,-22.6],"GVA":[46.2,6.1],"LCA":[34.9,33.6],"RUH":[24.96,46.7],"JED":[21.7,39.2],"AMD":[23.1,72.6],"HYD":[17.2,78.4],"CCU":[22.65,88.45],"KTM":[27.7,85.4],"HAN":[21.2,105.8],"SGN":[10.8,106.7],"RGN":[16.9,96.1],"OKA":[26.2,127.6],"CEB":[10.3,123.98],"CNX":[18.8,98.96],"NOU":[-22.3,166.5],"PPT":[-17.6,-149.6],"GUM":[13.5,144.8],"MRU":[-20.4,57.7],"RUN":[-20.9,55.5],"TNR":[-18.8,47.5],"LAD":[-8.9,13.2],"MPM":[-25.9,32.6],"LUN":[-15.3,28.5],"MBA":[-4.0,39.6],"KGL":[-2.0,30.1],"EBB":[0.04,32.4],"DJI":[11.5,43.2],"ASU":[-25.2,-57.5],"MVD":[-34.8,-56.0],"LPB":[-16.5,-68.2],"UIO":[-0.1,-78.5],"GYE":[-2.2,-79.9],"CCS":[10.6,-66.99],"CUR":[12.2,-69.0],"PBM":[5.5,-55.2],"FOR":[-3.8,-38.5],"POA":[-30.0,-51.2],"CWB":[-25.5,-49.2],"BSB":[-15.9,-47.9],"CNF":[-19.6,-43.97],"SSA":[-12.9,-38.3],"REC":[-8.1,-34.9],"CBR":[-35.3,149.2],"OMA":[41.3,-95.9],"BUF":[42.9,-78.7],"RIC":[37.5,-77.3],"PIT":[40.5,-80.2],"CMH":[40.0,-82.9],"IND":[39.7,-86.3],"BNA":[36.1,-86.7],"MEM":[35.0,-90.0],"MSY":[30.0,-90.3],"OKC":[35.4,-97.6],"ABQ":[35.0,-106.6],"TUL":[36.2,-95.9],"SMF":[38.7,-121.6],"BWI":[39.2,-76.7],"PHL":[39.9,-75.2],"JAX":[30.5,-81.7],"ORF":[36.9,-76.2],"YYC":[51.1,-114.0],"YEG":[53.3,-113.6],"YOW":[45.3,-75.7],"YWG":[49.9,-97.2],"GDL":[20.5,-103.3],"MTY":[25.8,-100.1],"SJO":[10.0,-84.2],"GUA":[14.6,-90.5],"KIN":[18.0,-76.8]};
function zeigenPage(run) { return reply(html(TITLE + ' · Live-Ansicht · ' + run, CLIENT.replace(/RUNNAME/g, run).replace('COASTDATA', JSON.stringify(COAST)).replace('COLODATA', JSON.stringify(COLO)))); }
export default {
  async fetch(request, env) {
    const u = new URL(request.url); const run = u.searchParams.get('run');
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    try {
      const testMode = !!env.TEST_KEY && u.pathname === '/testlive' && u.searchParams.get('k') === env.TEST_KEY;
      if (u.pathname === '/live' || testMode) {
        let name;
        if (testMode) name = 'tst-' + today + '-' + (Date.now() % 100);
        else {
          const g = await (await stub(env, 'gate-' + today, 0).fetch('https://n/gate?run=gate-' + today + '&id=0')).json();
          if (!g.ok) return reply(html(TITLE, HEAD + '<p>Die 100 Live-Läufe dieses Tages sind gestartet. Sie stehen auf der <a href="/">Startseite</a> zur Prüfung bereit. Ab 01:00 Uhr deutscher Zeit gibt es 100 neue.</p>'));
          name = 'live-' + today + '-' + g.index;
        }
        let q = parseInt(u.searchParams.get('q') || '1', 10); let b = parseFloat(u.searchParams.get('b') || '0.02');
        if (!(q >= 0 && q <= 17)) q = 1; if (![0.02, 0.1, 0.3, 1].includes(b)) b = 0.02;
        const seed = crypto.getRandomValues(new Uint32Array(1))[0]; const t0 = Date.now();
        await Promise.all(Array.from({ length: N }, (_, i) => i).map(i => stub(env, name, i).fetch('https://n/start?run=' + name + '&id=' + i + '&steps=40&seed=' + seed + '&t0=' + t0 + '&q=' + q + '&b=' + b)));
        return Response.redirect(new URL('/zeigen?run=' + name, request.url).toString(), 302);
      }
      const sTest = !!env.TEST_KEY && u.pathname === '/teststr' && u.searchParams.get('k') === env.TEST_KEY;
      if (u.pathname === '/struktur' || sTest) {
        let name;
        if (sTest) name = 'str-' + today + '-' + (10 + Date.now() % 90);
        else {
          const g = await (await stub(env, 'sgate-' + today, 0).fetch('https://n/gate?run=sgate-' + today + '&id=0&cap=' + STR_CAP)).json();
          if (!g.ok) return reply(html(TITLE, HEAD + '<p>Die 60 Struktur-Läufe dieses Tages sind gestartet. Sie stehen auf der <a href="/">Startseite</a> zur Ansicht bereit. Ab 01:00 Uhr deutscher Zeit gibt es 60 neue.</p>'));
          name = 'str-' + today + '-' + g.index;
        }
        const seed = crypto.getRandomValues(new Uint32Array(1))[0]; const t0 = Date.now();
        await Promise.all(Array.from({ length: N }, (_, i) => i).map(i => stub(env, name, i).fetch('https://n/start?run=' + name + '&id=' + i + '&steps=40&seed=' + seed + '&t0=' + t0 + '&q=0&b=0')));
        return Response.redirect(new URL('/zeigen?run=' + name, request.url).toString(), 302);
      }
      if (u.pathname === '/zeigen') { if (!cfg(run)) return Response.json({ error: 'run' }, { status: 400 }); return zeigenPage(run); }
      if (u.pathname === '/zustand') {
        if (!cfg(run)) return Response.json({ error: 'run' }, { status: 400 });
        const key = new Request(new URL('/zustand?run=' + run, request.url).toString()); const cache = caches.default; const hit = await cache.match(key); if (hit) return hit;
        const ns = await nodes(env, run);
        const resp = Response.json({ run, nodes: ns.map(n => ({ id: n.id, step: n.step, target: n.target, colo: n.colo, reqs: n.reqs, seed: n.seed, Q: n.Q, B: n.B, hist: n.hist.map(v => Math.round(v * 1e4) / 1e4) })) }, { headers: { 'cache-control': 'public, max-age=1' } });
        await cache.put(key, resp.clone()); return resp;
      }
      if (u.pathname === '/data' || u.pathname === '/pruefung') {
        if (!cfg(run)) return Response.json({ error: 'run' }, { status: 400 });
        const key = new Request(request.url); const cache = caches.default; const hit = await cache.match(key);
        if (hit) return hit;
        let resp;
        if (u.pathname === '/data') resp = Response.json({ run, nodes: await nodes(env, run) }, { headers: { 'cache-control': 'public, max-age=5' } });
        else {
          const lin = cfg(run).kind === 'lin'; const e = lin ? await evaluateLin(env, run) : await evaluate(env, run);
          resp = reply(html(TITLE + ' · ' + run, lin ? strPage(e) : runPage(e), e.started && !e.done ? 2 : 0), e.done ? 'public, max-age=120' : 'public, max-age=2');
        }
        await cache.put(key, resp.clone()); return resp;
      }
    } catch (e) { return Response.json({ error: String(e) }, { status: 503 }); }
    const gs = await (await stub(env, 'gate-' + today, 0).fetch('https://n/gstat?run=gate-' + today + '&id=0')).json();
    let rows = ''; for (let k = Math.max(1, gs.used - 9); k <= gs.used; k++) rows += '<li><a href="/pruefung?run=live-' + today + '-' + k + '">live-' + today + '-' + k + '</a> · gestartet</li>'; if (!gs.used) rows = '<li>Heute noch kein Lauf gestartet.</li>';
    const opt = (v, t, sel) => '<option value="' + v + '"' + (sel ? ' selected' : '') + '>' + t + '</option>';
    const form = '<form action="/live" method="get"><p><label>Windung des Startzustands Q: <select name="q">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(v => opt(v, v, v === 1)).join('') + opt(10, '10 · Gegenprobe', false) + opt(12, '12 · Gegenprobe', false) + '</select></label></p>' +
      '<p><label>Breite der Eigenfrequenzen B: <select name="b">' + opt('0.02', '0,02 · Standard', true) + opt('0.1', '0,1', false) + opt('0.3', '0,3', false) + opt('1', '1,0 · Gegenprobe', false) + '</select></label></p>' +
      '<p><button class="btn" type="submit">Neuen Live-Lauf starten</button></p></form>';
    return reply(html(TITLE, HEAD + '<h2>Live-Lauf starten</h2>' + form + STRBOX + '<p>Ein Lauf besteht aus 36 Knoten und 40 Schritten und dauert etwa eine Minute. Du landest direkt in der Live-Ansicht: Weltkarte mit den 36 Knoten an ihren Rechenzentren, Ring mit den Phasen, Schritt für Schritt; danach folgt die Prüfung. Jeder Lauf würfelt seine Eigenfrequenzen neu. Die Vorhersage richtet sich nach deiner Eingabe: das Ergebnis ist die Windung, die du eingibst, solange sie im Erhaltungsbereich liegt (Q ≤ 8 bei B = 0,02 · Q ≤ 6 bei B = 0,1 · Q ≤ 2 bei B = 0,3). Außerhalb davon, auch bei den Gegenproben (Q ≥ 10 oder B = 1), gibt es keine Vorhersage; die Seite meldet, was herauskommt, und dort geht die Windung in der Regel verloren.</p><h2>Heutige Läufe (UTC-Datum ' + today + ')</h2><ul>' + rows + '</ul><h2>Der Lauf vom 9. November 2026</h2><p>Sechs Läufe auf 31 Rechenzentren, mit Vorhersage und Prüfsummen: <a href="https://github.com/Zeta109/ring-chip-test/tree/main/weltlauf/ergebnis">github.com/Zeta109/ring-chip-test</a>.</p>'));
  }
};
