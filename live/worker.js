const N = 36;
const HINTS = ['weur','enam','apac','sam','eeur','wnam','oc','afr','me'];
const LIVE_CAP = 5;
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
function cfg(run, seed) {
  if (typeof run === 'string' && /^(live|tst)-\d{8}-\d{1,2}$/.test(run)) {
    const c = { kind: 'phase', steps: 40, K: 4, DT: 0.05, B: 0.02, Q: 1, om: null };
    if (seed !== undefined && seed !== null) c.om = omegas(seed, c.B);
    return c;
  }
  return null;
}
function hintOf(i) { return HINTS[(i + 1) % HINTS.length]; }
function stub(env, run, i) { return env.RING.get(env.RING.idFromName(run + '-' + i), { locationHint: hintOf(i) }); }
function x0(i, c) { return 2 * Math.PI * c.Q * i / N; }
function nextX(i, x, R, L, c) { return x + c.DT * (c.om[i] + c.K * (Math.sin(R - x) + Math.sin(L - x))); }
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
      s = { run, id, step: 0, hist: [x0(id, c)], gotL: {}, gotR: {}, sent: -1, target: 0, colo: null, fp: null, reqs: 0, mismatch: 0, seed: null, t0: null, t1: null };
    }
    this.s = s; return s;
  }
  advance(s) {
    if (s.seed === null || s.seed === undefined) return;
    const c = cfg(s.run, s.seed); let n = 0;
    while (s.step < s.target && s.gotL[s.step] !== undefined && s.gotR[s.step] !== undefined && n < 40) {
      s.hist.push(nextX(s.id, s.hist[s.step], s.gotR[s.step], s.gotL[s.step], c)); s.step++; n++;
    }
    if (s.step >= s.target && s.target > 0 && !s.t1) s.t1 = Date.now();
  }
  async fetch(req) {
    const u = new URL(req.url); const run = u.searchParams.get('run'); const id = parseInt(u.searchParams.get('id'), 10);
    if (u.pathname === '/gstat') return Response.json({ used: (await this.state.storage.get('g')) || 0 });
    if (u.pathname === '/gate') {
      let g = (await this.state.storage.get('g')) || 0;
      if (g >= LIVE_CAP) return Response.json({ ok: false, used: g });
      g++; await this.state.storage.put('g', g); return Response.json({ ok: true, used: g, index: g });
    }
    const s = await this.load(run, id); s.reqs++;
    if (u.pathname === '/start') {
      const t = parseInt(u.searchParams.get('steps'), 10); const seed = parseInt(u.searchParams.get('seed'), 10);
      if (s.seed === null || s.seed === undefined) { s.seed = seed >>> 0; s.t0 = parseInt(u.searchParams.get('t0'), 10); }
      if (t > s.target) s.target = t;
      await this.state.storage.put('s', s); await this.state.storage.setAlarm(Date.now()); return Response.json({ ok: true });
    }
    if (u.pathname === '/deliver') {
      const b = await req.json(); const g = b.side === 'L' ? s.gotL : s.gotR;
      for (const [st, v] of b.items) { if (g[st] === undefined) g[st] = v; else if (g[st] !== v) s.mismatch++; }
      this.advance(s); await this.state.storage.put('s', s);
      if (s.sent < s.step) await this.state.storage.setAlarm(Date.now());
      return Response.json({ ok: true });
    }
    if (u.pathname === '/info') { await this.state.storage.put('s', s); return Response.json({ id: s.id, step: s.step, target: s.target, colo: s.colo, fp: s.fp, hint: hintOf(s.id), reqs: s.reqs, mismatch: s.mismatch, seed: s.seed, t0: s.t0, t1: s.t1, err: s.err || null, sent: s.sent, hist: s.hist }); }
    return Response.json({ error: 'unknown' }, { status: 404 });
  }
  async alarm() {
    let s = this.s || await this.state.storage.get('s'); if (!s) return; this.s = s; s.reqs++;
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
  if (!ms) return '–';
  const d = new Date(ms);
  const z = d.toISOString().slice(11, 19) + ' UTC';
  let b = ''; try { b = d.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour12: false }) + ' MEZ'; } catch (e) { }
  return d.toISOString().slice(0, 10) + ', ' + b + ' (' + z + ')';
}
async function evaluate(env, run) {
  const ns = await nodes(env, run);
  const seed = ns[0].seed; const started = seed !== null && seed !== undefined;
  const out = { run, started, nodes: ns, seed, steps: 40 };
  if (!started) return out;
  const c = cfg(run, seed); out.c = c;
  out.seedsOK = ns.every(n => n.seed === seed);
  out.minStep = Math.min(...ns.map(n => n.step));
  out.t0 = Math.min(...ns.map(n => n.t0 || Infinity));
  out.done = ns.every(n => n.step >= c.steps);
  if (out.done) {
    out.t1 = Math.max(...ns.map(n => n.t1 || 0));
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
const TITLE = 'Was der Raum weiß, bevor er sich bewegt';
const HEAD = '<h1>' + TITLE + '</h1><p class="sub"><i>What space knows before it moves.</i></p><p><i>36 Knoten auf Servern in aller Welt. Jeder Knoten kennt nur seinen linken und seinen rechten Nachbarn. Es gibt keine Zentrale und keine gemeinsame Uhr.</i></p>';
function code(seed) {
  return 'import math\nN,K,DT,B,T = 36,4,0.05,0.02,40\nseed = ' + seed + '\n' +
'def mulberry32(a):\n    s=[a & 0xFFFFFFFF]\n    def nxt():\n        s[0]=(s[0]+0x6D2B79F5)&0xFFFFFFFF; t=s[0]\n        t=((t^(t>>15))*(t|1))&0xFFFFFFFF\n        t^=(t+(((t^(t>>7))*(t|61))&0xFFFFFFFF))&0xFFFFFFFF\n        return ((t^(t>>14))&0xFFFFFFFF)/4294967296\n    return nxt\n' +
'r=mulberry32(seed); u=[math.floor(r()*13)-6 for _ in range(N)]; m=sum(u)/N\nom=[B*(v-m) for v in u]\nth=[2*math.pi*i/N for i in range(N)]\n' +
'for t in range(T):\n    th=[th[i]+DT*(om[i]+K*(math.sin(th[(i+1)%N]-th[i])+math.sin(th[(i-1)%N]-th[i]))) for i in range(N)]\n' +
'w=lambda y:(y+math.pi)%(2*math.pi)-math.pi\nprint(sum(w(th[(i+1)%N]-th[i]) for i in range(N))/(2*math.pi))  # 1.0\nprint(["%.6f"%v for v in th])';
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
      '<tr><td>Eigenfrequenzen dieses Laufs (aus der Kennzahl gezogen)</td><td class="mono">Kennzahl ' + e.seed + '</td></tr></table>' +
      '<p>Vorhersage für diesen Lauf, unabhängig von den Eigenfrequenzen: Windung 1, Verschiebung des Mittelwerts 0, Abweichung jedes Knotens von der lokalen Referenzrechnung 0. Die Seite lädt sich alle 2 Sekunden neu.</p>' +
      '<h2>Die 36 Knoten jetzt</h2><div class="grid">' + e.nodes.map(n => '<div>Knoten ' + n.id + ' · <span class="mono">' + esc(n.colo || '…') + '</span> · Schritt ' + n.step + '</div>').join('') + '</div>';
    return b;
  }
  const dur = ((e.t1 - e.t0) / 1000).toFixed(1);
  b += '<p><span class="live done"><i></i>LAUF ABGESCHLOSSEN</span></p>' +
    '<table><tr><th>Größe</th><th>Wert</th></tr>' +
    '<tr><td>Gestartet (Serverzeit)</td><td>' + tfmt(e.t0) + '</td></tr>' +
    '<tr><td>Beendet (Serverzeit)</td><td>' + tfmt(e.t1) + ' · Dauer ' + dur + ' s</td></tr>' +
    '<tr><td>Eigenfrequenzen dieses Laufs</td><td class="mono">Kennzahl ' + e.seed + ' · Summe ' + e.omsum.toExponential(1) + (e.seedsOK ? ' · bei allen 36 Knoten gleich' : ' · ABWEICHUNG') + '</td></tr>' +
    '<tr><td>Knoten</td><td>36, geschlossen: Knoten i kennt i−1 und i+1 (mod 36)</td></tr>' +
    '<tr><td>Schritte</td><td>' + e.steps + ' (alle 36 Knoten)</td></tr>' +
    '<tr><td>Windung aus den letzten Phasen (Vorhersage: 1)</td><td class="ok">' + e.winding.toFixed(9) + ' · bestanden</td></tr>' +
    '<tr><td>größte Abweichung jedes Knotens von der lokalen Referenzrechnung, über alle Schritte (Vorhersage: 0)</td><td class="mono">' + e.maxdev.toExponential(2) + '</td></tr>' +
    '<tr><td>Verschiebung des Mittelwerts aller Phasen (Vorhersage: 0)</td><td class="mono">' + e.meanshift.toExponential(2) + '</td></tr>' +
    '<tr><td>größte Phasendifferenz zweier Nachbarn im ganzen Lauf (Grenze π = 3.14159)</td><td class="mono">' + e.maxdiff.toFixed(5) + '</td></tr>' +
    '<tr><td>Widersprüche zwischen empfangenen Kopien eines Wertes</td><td class="ok">' + e.mismatch + ' · bestanden</td></tr>' +
    '<tr><td>Rechenzentren (Kennung)</td><td class="mono">' + e.colos.length + ': ' + esc(e.colos.join(', ')) + '</td></tr>' +
    '<tr><td>SHA-256 aller Werte aller Knoten</td><td class="mono">' + e.sha + '</td></tr></table>' +
    '<p>Rohwerte als JSON: <a href="/data?run=' + esc(run) + '">/data?run=' + esc(run) + '</a>. Phase jedes Knotens im letzten Schritt:</p><p class="mono">' + e.nodes.map(n => n.hist[e.steps].toFixed(6)).join(' · ') + '</p>' +
    '<p>Jeder Lauf zieht seine Eigenfrequenzen neu aus der Kennzahl, die beim Start des Laufs gewürfelt wird. Die Endphasen sind darum in jedem Lauf andere; Windung 1, Mittelwert und Abweichung 0 bleiben.</p>' +
    '<details><summary>Diesen Lauf nachrechnen (Python, zwölf Zeilen plus Zufallsfunktion)</summary><pre>' + esc(code(e.seed)) + '</pre></details>' +
    '<p>Serverzeit beim Aufruf dieser Seite: ' + tfmt(now) + '</p>';
  return b;
}
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
          if (!g.ok) return reply(html(TITLE, HEAD + '<p>Die fünf Live-Läufe dieses Tages sind gestartet. Sie stehen auf der <a href="/">Startseite</a> zur Prüfung bereit. Ab 01:00 Uhr deutscher Zeit gibt es fünf neue.</p>'));
          name = 'live-' + today + '-' + g.index;
        }
        const seed = crypto.getRandomValues(new Uint32Array(1))[0]; const t0 = Date.now();
        await Promise.all(Array.from({ length: N }, (_, i) => i).map(i => stub(env, name, i).fetch('https://n/start?run=' + name + '&id=' + i + '&steps=40&seed=' + seed + '&t0=' + t0)));
        return Response.redirect(new URL('/pruefung?run=' + name, request.url).toString(), 302);
      }
      if (u.pathname === '/data' || u.pathname === '/pruefung') {
        if (!cfg(run)) return Response.json({ error: 'run' }, { status: 400 });
        const key = new Request(request.url); const cache = caches.default; const hit = await cache.match(key);
        if (hit) return hit;
        let resp;
        if (u.pathname === '/data') resp = Response.json({ run, nodes: await nodes(env, run) }, { headers: { 'cache-control': 'public, max-age=5' } });
        else {
          const e = await evaluate(env, run);
          resp = reply(html(TITLE + ' · ' + run, runPage(e), e.started && !e.done ? 2 : 0), e.done ? 'public, max-age=120' : 'public, max-age=2');
        }
        await cache.put(key, resp.clone()); return resp;
      }
    } catch (e) { return Response.json({ error: String(e) }, { status: 503 }); }
    const gs = await (await stub(env, 'gate-' + today, 0).fetch('https://n/gstat?run=gate-' + today + '&id=0')).json();
    let rows = ''; for (let k = 1; k <= LIVE_CAP; k++) rows += '<li>' + (k <= gs.used ? '<a href="/pruefung?run=live-' + today + '-' + k + '">live-' + today + '-' + k + '</a> · gestartet' : 'live-' + today + '-' + k + ' · noch frei') + '</li>';
    return reply(html(TITLE, HEAD + '<p><a class="btn" href="/live">Neuen Live-Lauf starten</a></p><p>Ein Lauf besteht aus 36 Knoten und 40 Schritten und dauert etwa eine Minute. Du landest direkt auf der Prüfseite und siehst den Lauf, solange er rechnet. Jeder Lauf würfelt seine Eigenfrequenzen neu; die Vorhersage (Windung 1, Mittelwert unverändert, Abweichung 0) gilt für jeden davon.</p><h2>Heutige Läufe (UTC-Datum ' + today + ')</h2><ul>' + rows + '</ul><h2>Der Lauf vom 9. November 2026</h2><p>Sechs Läufe auf 31 Rechenzentren, mit Vorhersage und Prüfsummen: <a href="https://github.com/Zeta109/ring-chip-test/tree/main/weltlauf/ergebnis">github.com/Zeta109/ring-chip-test</a>.</p>'));
  }
};
