const N = 36;
const HINTS = ['weur','enam','apac','sam','eeur','wnam','oc','afr','me'];
const LIVE_CAP = 5;
function cfg(run) {
  if (typeof run === 'string' && /^live-\d{8}-[1-5]$/.test(run)) return { kind: 'phase', steps: 40, K: 4, DT: 0.05, B: 0.02, Q: 1, title: 'Live-Lauf ' + run };
  return null;
}
function hintOf(i) { return HINTS[(i + 1) % HINTS.length]; }
function stub(env, run, i) { return env.RING.get(env.RING.idFromName(run + '-' + i), { locationHint: hintOf(i) }); }
function omega(i, c) { let m = 0; for (let j = 0; j < N; j++) m += (7 * j) % 13; m /= N; return c.B * (((7 * i) % 13) - m); }
function x0(i, c) { return c.kind === 'phase' ? 2 * Math.PI * c.Q * i / N : ((7 * i) % 13) / 13; }
function nextX(i, x, R, L, c) {
  if (c.kind === 'phase') return x + c.DT * (omega(i, c) + c.K * (Math.sin(R - x) + Math.sin(L - x)));
  return x + c.eps * (R + L - 2 * x);
}
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
      s = { run, id, step: 0, hist: [x0(id, c)], gotL: {}, gotR: {}, sent: -1, target: 0, colo: null, fp: null, reqs: 0, mismatch: 0, crashed: 0, recovery: null };
    }
    this.s = s; return s;
  }
  advance(s) {
    const c = cfg(s.run); const cap = 40; let n = 0;
    while (s.step < s.target && s.gotL[s.step] !== undefined && s.gotR[s.step] !== undefined && n < cap) {
      s.hist.push(nextX(s.id, s.hist[s.step], s.gotR[s.step], s.gotL[s.step], c)); s.step++; n++;
    }
  }
  async fetch(req) {
    const u = new URL(req.url); const run = u.searchParams.get('run'); const id = parseInt(u.searchParams.get('id'), 10);
    if (u.pathname === '/reset') { await this.state.storage.deleteAlarm(); await this.state.storage.deleteAll(); this.s = null; return Response.json({ ok: true }); }
    if (u.pathname === '/gate') {
      let g = (await this.state.storage.get('g')) || 0;
      if (g >= LIVE_CAP) return Response.json({ ok: false, used: g });
      g++; await this.state.storage.put('g', g); return Response.json({ ok: true, used: g, index: g });
    }
    const s = await this.load(run, id); s.reqs++;
    if (u.pathname === '/start') {
      const t = parseInt(u.searchParams.get('steps'), 10); if (t > s.target) s.target = t;
      await this.state.storage.put('s', s); await this.state.storage.setAlarm(Date.now()); return Response.json({ ok: true });
    }
    if (u.pathname === '/deliver') {
      const b = await req.json(); const g = b.side === 'L' ? s.gotL : s.gotR;
      for (const [st, v] of b.items) { if (g[st] === undefined) g[st] = v; else if (g[st] !== v) s.mismatch++; }
      this.advance(s); await this.state.storage.put('s', s);
      if (s.sent < s.step) await this.state.storage.setAlarm(Date.now());
      return Response.json({ ok: true });
    }
    if (u.pathname === '/prog') { await this.state.storage.put('s', s); return Response.json({ step: s.step, target: s.target }); }
    if (u.pathname === '/hist') return Response.json({ hist: s.hist, gotL: s.gotL, gotR: s.gotR });
    if (u.pathname === '/info') { await this.state.storage.put('s', s); return Response.json({ id: s.id, step: s.step, target: s.target, colo: s.colo, fp: s.fp, hint: hintOf(s.id), reqs: s.reqs, mismatch: s.mismatch, crashed: s.crashed, recovery: s.recovery, err: s.err || null, gl: Object.keys(s.gotL).length, gr: Object.keys(s.gotR).length, sent: s.sent, hist: s.hist }); }
    return Response.json({ error: 'unknown' }, { status: 404 });
  }
  async alarm() {
    let s = this.s || await this.state.storage.get('s'); if (!s) return; this.s = s; s.reqs++;
    const c = cfg(s.run); const run = s.run, id = s.id, L = (id + N - 1) % N, R = (id + 1) % N;
    if (!s.colo) {
      try { const t = await (await fetch('https://www.cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(3000) })).text(); const m = t.match(/colo=(\w+)/); s.colo = m ? m[1] : 'unknown'; } catch (e) { s.colo = 'unknown'; }
      s.fp = await fingerprint();
    }
    if (c.crashNode === id && !s.crashed && s.step >= c.crashStep) {
      const keep = { run, id, colo: s.colo, fp: s.fp, reqs: s.reqs, target: s.target, crashed: 1 };
      await this.state.storage.deleteAll();
      s = { run, id, step: 0, hist: [], gotL: {}, gotR: {}, sent: -1, target: keep.target, colo: keep.colo, fp: keep.fp, reqs: keep.reqs, mismatch: 0, crashed: 1, recovery: null };
      this.s = s;
      const a = await (await stub(this.env, run, L).fetch('https://n/hist?run=' + run + '&id=' + L)).json();
      const b = await (await stub(this.env, run, R).fetch('https://n/hist?run=' + run + '&id=' + R)).json();
      const rec = []; let agree = true, k = 0;
      while (a.gotR[k] !== undefined && b.gotL[k] !== undefined) { if (a.gotR[k] !== b.gotL[k]) agree = false; rec.push(a.gotR[k]); k++; }
      const n = rec.length; s.hist = rec; s.step = n - 1;
      for (let j = 0; j < a.hist.length; j++) s.gotL[j] = a.hist[j];
      for (let j = 0; j < b.hist.length; j++) s.gotR[j] = b.hist[j];
      s.sent = n - 1; s.recovery = { recovered_values: n, copies_agree: agree && n >= c.crashStep, from_left: L, from_right: R };
      this.advance(s);
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
const CSS = 'body{background:#f2e9d8;color:#000;font-family:Georgia,serif;max-width:860px;margin:0 auto;padding:18px;line-height:1.5;font-size:16px}h1{font-size:26px;margin:.3em 0}h2{font-size:19px;margin-top:26px}table{border-collapse:collapse;width:100%;margin:10px 0;font-size:14px}th,td{border:1px solid #000;padding:4px 8px;text-align:left}.ok{font-weight:bold}.mono{font-family:Menlo,monospace;font-size:12px;word-break:break-all}a{color:#000}.btn{display:inline-block;border:2px solid #000;padding:8px 14px;margin:6px 0;text-decoration:none;font-weight:bold}';
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
async function evaluate(env, run) {
  const c = cfg(run); const ns = await nodes(env, run);
  const out = { run, steps: c.steps, minStep: Math.min(...ns.map(n => n.step)), nodes: ns };
  out.done = ns.every(n => n.step >= c.steps);
  if (out.done) {
    const th = ns.map(n => n.hist[c.steps]); let w = 0; for (let i = 0; i < N; i++) w += wrap(th[(i + 1) % N] - th[i]);
    out.winding = w / (2 * Math.PI);
    const H = reference(c); let md = 0; for (let i = 0; i < N; i++) for (let t = 0; t <= c.steps; t++) md = Math.max(md, Math.abs(ns[i].hist[t] - H[i][t]));
    out.maxdev = md;
    let m0 = 0, m1 = 0; for (let i = 0; i < N; i++) { m0 += ns[i].hist[0]; m1 += ns[i].hist[c.steps]; }
    out.meanshift = (m1 - m0) / N;
    out.colos = Array.from(new Set(ns.map(n => n.colo))).sort();
    out.mismatch = ns.reduce((a, n) => a + n.mismatch, 0);
    out.sha = await sha(JSON.stringify(ns.map(n => [n.id, n.colo, n.fp, n.hist])));
  }
  return out;
}
const TITLE = 'Was der Raum weiß, bevor er sich bewegt';
const HEAD = '<h1>' + TITLE + '</h1><p><i>What space knows before it moves.</i></p><p><i>36 Knoten auf Servern in aller Welt. Jeder Knoten kennt nur seinen linken und seinen rechten Nachbarn. Es gibt keine Zentrale und keine gemeinsame Uhr.</i></p>';
export default {
  async fetch(request, env) {
    const u = new URL(request.url); const run = u.searchParams.get('run');
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    try {
      if (u.pathname === '/live') {
        const g = await (await stub(env, 'gate-' + today, 0).fetch('https://n/gate?run=gate-' + today + '&id=0')).json();
        if (!g.ok) return reply(html(TITLE, HEAD + '<p>Die fünf Live-Läufe dieses Tages sind gestartet. Sie stehen auf der <a href="/">Startseite</a> zur Prüfung bereit. Ab 01:00 Uhr deutscher Zeit gibt es fünf neue.</p>'));
        const name = 'live-' + today + '-' + g.index;
        await Promise.all(Array.from({ length: N }, (_, i) => stub(env, name, i).fetch('https://n/start?run=' + name + '&id=' + i + '&steps=' + cfg(name).steps)));
        return Response.redirect(new URL('/pruefung?run=' + name, request.url).toString(), 302);
      }
      if (u.pathname === '/data' || u.pathname === '/pruefung') {
        if (!cfg(run)) return Response.json({ error: 'run' }, { status: 400 });
        const key = new Request(request.url); const cache = caches.default; const hit = await cache.match(key);
        if (hit) return hit;
        let resp;
        if (u.pathname === '/data') resp = Response.json({ run, nodes: await nodes(env, run) }, { headers: { 'cache-control': 'public, max-age=15' } });
        else {
          const e = await evaluate(env, run); let b = HEAD + '<h2>Lauf ' + esc(run) + '</h2>';
          if (!e.done) b += '<p>Der Lauf läuft. Kleinster Schritt über alle 36 Knoten: <b>' + e.minStep + ' von ' + e.steps + '</b>. Diese Seite lädt sich alle 5 Sekunden neu.</p>';
          else b += '<table><tr><th>Größe</th><th>Wert</th></tr>' +
            '<tr><td>Knoten</td><td>36, geschlossen: Knoten i kennt i−1 und i+1 (mod 36)</td></tr>' +
            '<tr><td>Schritte</td><td>' + e.steps + ' (alle 36 Knoten)</td></tr>' +
            '<tr><td>Windung aus den letzten Phasen (Vorhersage: 1)</td><td class="ok">' + e.winding.toFixed(9) + '</td></tr>' +
            '<tr><td>größte Abweichung jedes Knotens von der lokalen Referenzrechnung, über alle Schritte</td><td class="mono">' + e.maxdev.toExponential(2) + '</td></tr>' +
            '<tr><td>Verschiebung des Mittelwerts aller Phasen</td><td class="mono">' + e.meanshift.toExponential(2) + '</td></tr>' +
            '<tr><td>Widersprüche zwischen empfangenen Kopien eines Wertes</td><td class="ok">' + e.mismatch + '</td></tr>' +
            '<tr><td>Rechenzentren (Kennung)</td><td class="mono">' + e.colos.length + ': ' + esc(e.colos.join(', ')) + '</td></tr>' +
            '<tr><td>SHA-256 aller Werte aller Knoten</td><td class="mono">' + e.sha + '</td></tr></table>' +
            '<p>Rohwerte als JSON: <a href="/data?run=' + esc(run) + '">/data?run=' + esc(run) + '</a>. Phase jedes Knotens im letzten Schritt:</p><p class="mono">' + e.nodes.map(n => n.hist[e.steps].toFixed(6)).join(' · ') + '</p>';
          resp = reply(html(TITLE + ' · ' + run, b, e.done ? 0 : 5), 'public, max-age=5');
        }
        await cache.put(key, resp.clone()); return resp;
      }
    } catch (e) { return Response.json({ error: String(e) }, { status: 503 }); }
    let rows = ''; for (let k = 1; k <= LIVE_CAP; k++) rows += '<li><a href="/pruefung?run=live-' + today + '-' + k + '">live-' + today + '-' + k + '</a></li>';
    return reply(html(TITLE, HEAD + '<p><a class="btn" href="/live">Neuen Live-Lauf starten</a></p><p>Ein Lauf besteht aus 36 Knoten und 40 Schritten und dauert etwa eine Minute. Du landest direkt auf der Prüfseite.</p><h2>Heutige Läufe (UTC-Datum ' + today + ')</h2><ul>' + rows + '</ul><h2>Der Lauf vom 9. November 2026</h2><p>Sechs Läufe auf 31 Rechenzentren, mit Vorhersage und Prüfsummen: <a href="https://github.com/Zeta109/ring-chip-test/tree/main/weltlauf/ergebnis">github.com/Zeta109/ring-chip-test</a>.</p>'));
  }
};
