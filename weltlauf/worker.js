const N = 36;
const HINTS = ['weur','enam','apac','sam','eeur','wnam','oc','afr','me'];
const RUNS = {"phase":{"kind":"phase","steps":400,"K":4,"DT":0.05,"B":0.02,"Q":1,"title":"Phasenlauf mit Sinus, K = 4, Windung 1, 36 Knoten, 400 Schritte"},"k2":{"kind":"phase","steps":40,"K":2,"DT":0.05,"B":0.02,"Q":1,"title":"Phasenlauf mit Sinus, K = 2, Windung 1, 36 Knoten, 40 Schritte"},"k8":{"kind":"phase","steps":40,"K":8,"DT":0.05,"B":0.02,"Q":1,"title":"Phasenlauf mit Sinus, K = 8, Windung 1, 36 Knoten, 40 Schritte"},"q3":{"kind":"phase","steps":40,"K":4,"DT":0.05,"B":0.02,"Q":3,"title":"Phasenlauf mit Sinus, K = 4, Windung 3, 36 Knoten, 40 Schritte"},"eps":{"kind":"diff","steps":40,"eps":0.496,"title":"Lauf nahe der Grenze, ε = 0,496, 36 Knoten, 40 Schritte"},"fault":{"kind":"diff","steps":40,"eps":0.25,"crashNode":17,"crashStep":20,"title":"Störlauf: Ausfall und Wiederherstellung von Knoten 17 bei Schritt 20, 36 Knoten, 40 Schritte"}};
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

const SEAL = {"phase":{"all":"d97c0f04f96a0f6ef7d24cac94ebf3ec05b384fe215468ff401d65ba6be5741c","final":"397e95fd3638f30b2ccadc38a70ba143a11e13980d99948caf47572d1a94f06b","ref_final":[-0.06810692607749856,0.11104701217787982,0.28429729168504403,0.48217726688971796,0.6690825468343718,0.8756185195563179,1.0661167500778317,1.271203349400843,1.4552224382971373,1.648766757463717,1.8162672433549345,1.9882337656721003,2.1292414756291373,2.2696795315429634,2.439924920624929,2.6045460897026764,2.794013315699749,2.972754301078644,3.1712954409527585,3.353987058376712,3.5513660803103235,3.7277840949345094,3.913741297230191,4.0736686724644855,4.237987484641537,4.371269704845083,4.503826931077831,4.665961623692074,4.822254200120684,5.003105395080674,5.172979006466305,5.362341740263029,5.5356040276090495,5.723256478863543,5.889731064077539,6.06549692502596],"band":[0.13,0.21],"ref_nb":[0.13255722623274835,0.20653597272194602],"ref_wind_dev":2.220446049250313e-16},"k2":{"all":"0ee317a7e6b2ef3f4fefc0f4299fe6fad486551797ea9f517d0b349d7b7d2066","final":"8142ed78dd012545428aecd59bffab47012bc2ff63cbffcaf44b1287f9bfaa2e","ref_final":[-0.04067276809108315,0.13594376275014308,0.29452721030687695,0.49548962516224754,0.6686386012695963,0.8774678183392722,1.0540628663109586,1.263309819503022,1.4373695881057358,1.6397978831895663,1.8001871151554536,1.9782500934251155,2.0999507223001004,2.2216515346968673,2.39971548026165,2.560108358581033,2.7625490399561152,2.9366462108794495,3.145995116494036,3.3228342269115356,3.5321831320827206,3.706280300159025,3.9087209650116246,4.069113756609024,4.247177284251795,4.368876277686043,4.490569665618442,4.6686061805750345,4.828908116550245,5.031072440115093,5.2044156745066195,5.411882754351356,5.584521852069019,5.7853098745735485,5.94383996472476,6.120442331250706],"band":[0.111,0.22],"ref_nb":[0.1216933879323987,0.2093489056145863],"ref_wind_dev":2.220446049250313e-16},"k8":{"all":"d23ba143b03034392bc3de2805b550e23d17e307c976aed2fad6807e967aeef9","final":"19662e0d9c68bbbd0f0aa6d369436ca5e2a7b9bdd5888ea3c98a77c24112a942","ref_final":[-0.020069858794962692,0.15481123110801856,0.32631358640829755,0.5097988787505275,0.6876289537207387,0.8752103555520586,1.0548988664577341,1.2420891927140894,1.419096587645925,1.6012456420796453,1.7707927423847152,1.9429658929475906,2.0999870581180806,2.257008806729608,2.4291808832282915,2.5987161051364738,2.780825053455597,2.9577356223765316,3.144728503458117,3.3240568791036798,3.5110288406476697,3.687890994118991,3.869909592366667,4.03928889388032,4.211202779973552,4.367812927273171,4.524197196942498,4.695412207172189,4.863563744942036,5.04373219783382,5.2180140303985185,5.401543260118197,5.576455895419416,5.7579453232379665,5.92821517857254,6.102508830164448],"band":[0.146,0.198],"ref_nb":[0.15638426966932695,0.18758140183131988],"ref_wind_dev":2.220446049250313e-16},"q3":{"all":"931d9095107f46b1c8bd0abe25bc0827ea2a2c4caa3bff1796daad4b56c6b612","final":"223d3518536fa4118f1a063b66f8ee9b808e11c0309361b6fcf924bbe4e96035","ref_final":[-0.03030191492244776,0.49282187774788727,1.007079902566835,1.5472649310578521,2.073326983567961,2.621010506090118,3.1506997755592336,3.6985350019739833,4.224800356733274,4.765028040845185,5.278797304810186,5.800347125026144,6.288743940819231,6.777143903604311,7.298705436915294,7.812501683543307,8.352785082093385,8.87915272610742,9.427161110765153,9.957104631983963,10.505112873425215,11.031479986880692,11.571761636749443,12.085552647227276,12.607099379643584,13.095461155167664,13.583764847280847,14.10509849634242,14.618406141086115,15.157691967776252,15.682191289639642,16.226854356980027,16.751303180213693,17.290666874178275,17.804548261337935,18.327527126110912],"band":[0.478,0.559],"ref_nb":[0.4883036921131829,0.5480083846577326],"ref_wind_dev":4.440892098500626e-16},"eps":{"all":"8b0a9a3141029ab6c20c0127c0cf0cd6b3c3bf25de5b86390d0f4afffd3d1d01","final":"a91f85df97fc7259af40911d974e4866fcf61ae50a705ab4b2142e1414b4f097"},"fault":{"all":"37824610b0f8c7ff86a5e9b5da8853c8c689f93ae102eea44e40132b0b3e5e25","final":"48799547bb68ca0f7bf83c79510676397bae820100acfe4d4f04605e2390e008"}};
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
