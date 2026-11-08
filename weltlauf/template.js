const N = 36;
const HINTS = ['weur','enam','apac','sam','eeur','wnam','oc','afr','me'];
const RUNS = __RUNS__;
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
      const c = RUNS[run];
      s = { run, id, step: 0, hist: [x0(id, c)], gotL: {}, gotR: {}, sent: -1, target: 0, colo: null, fp: null, reqs: 0, mismatch: 0, crashed: 0, recovery: null };
    }
    this.s = s; return s;
  }
  advance(s) {
    const c = RUNS[s.run]; const cap = 40; let n = 0;
    while (s.step < s.target && s.gotL[s.step] !== undefined && s.gotR[s.step] !== undefined && n < cap) {
      s.hist.push(nextX(s.id, s.hist[s.step], s.gotR[s.step], s.gotL[s.step], c)); s.step++; n++;
    }
  }
  async fetch(req) {
    const u = new URL(req.url); const run = u.searchParams.get('run'); const id = parseInt(u.searchParams.get('id'), 10);
    if (u.pathname === '/reset') { await this.state.storage.deleteAlarm(); await this.state.storage.deleteAll(); this.s = null; return Response.json({ ok: true }); }
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
    const c = RUNS[s.run]; const run = s.run, id = s.id, L = (id + N - 1) % N, R = (id + 1) % N;
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

const SEAL = __SEAL__;
const CITY = {AMS:'Amsterdam, Niederlande',ARN:'Stockholm, Schweden',ATL:'Atlanta, USA',BNE:'Brisbane, Australien',CDG:'Paris, Frankreich',DEN:'Denver, USA',DFW:'Dallas, USA',EWR:'Newark, USA',FRA:'Frankfurt am Main, Deutschland',HKG:'Hongkong, China (Sonderverwaltungszone)',IAD:'Ashburn bei Washington, USA',ICN:'Seoul, Südkorea',KIX:'Osaka, Japan',LAX:'Los Angeles, USA',LHR:'London, Vereinigtes Königreich',MAD:'Madrid, Spanien',MEL:'Melbourne, Australien',MIA:'Miami, USA',MXP:'Mailand, Italien',NRT:'Tokio, Japan',ORD:'Chicago, USA',OTP:'Bukarest, Rumänien',PRG:'Prag, Tschechien',SEA:'Seattle, USA',SIN:'Singapur',SJC:'San José, Kalifornien, USA',SYD:'Sydney, Australien',WAW:'Warschau, Polen',GRU:'São Paulo, Brasilien',JNB:'Johannesburg, Südafrika',BOM:'Mumbai, Indien',DEL:'Neu-Delhi, Indien',DXB:'Dubai, Vereinigte Arabische Emirate',YYZ:'Toronto, Kanada',ZRH:'Zürich, Schweiz',VIE:'Wien, Österreich',DUB:'Dublin, Irland',BRU:'Brüssel, Belgien',CPH:'Kopenhagen, Dänemark',HEL:'Helsinki, Finnland',OSL:'Oslo, Norwegen',LIS:'Lissabon, Portugal',ATH:'Athen, Griechenland',IST:'Istanbul, Türkei',TPE:'Taipeh, Taiwan',MNL:'Manila, Philippinen',AKL:'Auckland, Neuseeland',PER:'Perth, Australien',SCL:'Santiago, Chile',EZE:'Buenos Aires, Argentinien',BOG:'Bogotá, Kolumbien',MEX:'Mexiko-Stadt, Mexiko',YVR:'Vancouver, Kanada',SLC:'Salt Lake City, USA',MSP:'Minneapolis, USA',PHX:'Phoenix, USA',LAS:'Las Vegas, USA',CLT:'Charlotte, USA',BOS:'Boston, USA',PDX:'Portland, USA',IAH:'Houston, USA',KUL:'Kuala Lumpur, Malaysia',BKK:'Bangkok, Thailand',CGK:'Jakarta, Indonesien',MAA:'Chennai, Indien',BLR:'Bengaluru, Indien',HYD:'Hyderabad, Indien',FUK:'Fukuoka, Japan',GIG:'Rio de Janeiro, Brasilien',CPT:'Kapstadt, Südafrika',DOH:'Doha, Katar',TLV:'Tel Aviv, Israel',BUD:'Budapest, Ungarn',SOF:'Sofia, Bulgarien',BEG:'Belgrad, Serbien',ZAG:'Zagreb, Kroatien',MRS:'Marseille, Frankreich',LYS:'Lyon, Frankreich',BCN:'Barcelona, Spanien',FCO:'Rom, Italien',MUC:'München, Deutschland',DUS:'Düsseldorf, Deutschland',HAM:'Hamburg, Deutschland',TXL:'Berlin, Deutschland',BER:'Berlin, Deutschland',EDI:'Edinburgh, Vereinigtes Königreich',MAN:'Manchester, Vereinigtes Königreich'};
const ORDER = Object.keys(RUNS);
import PAGE_SRC from './page.txt';
const CSS = '@page{size:A4;margin:16mm}body{background:#fff;color:#000;font-family:Georgia,"Times New Roman",serif;max-width:900px;margin:0 auto;padding:16px;line-height:1.4;font-size:15px}h1{font-size:24px;margin:.2em 0}h2{font-family:Helvetica,Arial,sans-serif;color:#2F6EB5;font-weight:400;font-size:20px;margin-top:26px;break-after:avoid}.sub{font-style:italic}.meta,.small{font-size:12px}table{border-collapse:collapse;width:100%;margin:8px 0;font-size:12.5px;break-inside:avoid}th,td{border:1px solid #000;padding:3px 7px;text-align:left;vertical-align:top}th{background:#E3EDF9}.ok{color:#1E8E3E;font-weight:bold}.bad{color:#C0392B;font-weight:bold}.mono{font-family:Menlo,monospace;word-break:break-all;font-size:11px}ul.cols{columns:2;margin:6px 0}li{break-inside:avoid}h3{font-family:Helvetica,Arial,sans-serif;font-size:15px;margin:14px 0 4px;break-after:avoid}table.long{break-inside:auto;font-size:11px}table.long tr{break-inside:avoid}thead{display:table-header-group}.m{font-size:11.5px}textarea{width:100%;font-family:Menlo,monospace;font-size:10px;border:1px solid #000}button{font-size:14px;padding:6px 10px}.pb{break-before:page}@media print{.noprint{display:none}textarea{display:none}}';
const CFG = { RUNS, ORDER, SEAL, CITY };
const PAGE = '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ringtest Cloudflare</title><style>' + CSS + '</style></head><body><div id="root"><p>...</p></div><script>(' + PAGE_SRC + ')(' + JSON.stringify(CFG) + ');</script></body></html>';

export default {
  async fetch(request, env) {
    const u = new URL(request.url); const run = u.searchParams.get('run');
    const ids = Array.from({ length: N }, (_, i) => i);
    const all = (path, list) => Promise.all((list || ids).map(i => stub(env, run, i).fetch('https://n' + path + (path.indexOf('?') < 0 ? '?' : '&') + 'run=' + run + '&id=' + i)));
    try {
      if (RUNS[run] === undefined && u.pathname !== '/') return Response.json({ error: 'run' }, { status: 400 });
      if (u.pathname === '/start') { const steps = u.searchParams.get('steps') || String(RUNS[run].steps); await all('/start?steps=' + steps); return Response.json({ started: true, run, steps: +steps }); }
      if (u.pathname === '/prog') { const ps = await Promise.all((await all('/prog', [0, 12, 17, 24, 35])).map(r => r.json())); return Response.json({ target: Math.min(...ps.map(p => p.target)), minStep: Math.min(...ps.map(p => p.step)) }); }
      if (u.pathname === '/data') { const nodes = await Promise.all((await all('/info')).map(r => r.json())); return Response.json({ run, nodes }, { headers: { 'cache-control': 'no-store' } }); }
      if (u.pathname === '/reset' && u.searchParams.get('confirm') === 'ja') { await all('/reset'); return Response.json({ reset: true, run }); }
    } catch (e) { return Response.json({ error: String(e) }, { status: 503 }); }
    return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
};
