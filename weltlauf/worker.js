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
const PAGE_SRC = String.raw`function pageMain(C) {
  var N = 36, el = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function ex(x) { return Number(x).toExponential(2); }
  function fp(x, n) { return Number(x).toPrecision(n || 12); }
  function de(x) { return String(x).replace('.', ','); }
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function pack(rows) { var n = 0, a; for (a = 0; a < rows.length; a++) n += rows[a].length; var b = new ArrayBuffer(8 * n), dv = new DataView(b), k = 0, i; for (a = 0; a < rows.length; a++) for (i = 0; i < rows[a].length; i++) { dv.setFloat64(8 * k, rows[a][i], true); k++; } return b; }
  function sha(buf) { return crypto.subtle.digest('SHA-256', buf).then(hex); }
  function shaText(t) { return sha(new TextEncoder().encode(t)); }
  function status(m) { el('root').innerHTML = '<h1>Ringtest auf Cloudflare-Rechenzentren</h1><p>' + m + '</p>'; }
  function omega(i, c) { var m = 0, j; for (j = 0; j < N; j++) m += (7 * j) % 13; m /= N; return c.B * (((7 * i) % 13) - m); }
  function nextX(i, x, R, L, c) { return c.kind === 'phase' ? x + c.DT * (omega(i, c) + c.K * (Math.sin(R - x) + Math.sin(L - x))) : x + c.eps * (R + L - 2 * x); }
  function wrap(d) { var t = 2 * Math.PI; return d - t * Math.round(d / t); }
  function winding(v) { var s = 0, i; for (i = 0; i < N; i++) s += wrap(v[(i + 1) % N] - v[i]); return s / (2 * Math.PI); }
  function amp(v, k) { var c = 0, s = 0, i; for (i = 0; i < N; i++) { c += v[i] * Math.cos(2 * Math.PI * k * i / N); s += v[i] * Math.sin(2 * Math.PI * k * i / N); } return Math.hypot(c, s); }
  function ok(b) { return b ? '<span class="ok">bestanden</span>' : '<span class="bad">Abweichung</span>'; }
  function okt(b) { return b ? 'bestanden' : 'ABWEICHUNG'; }
  function city(c) { return C.CITY[c] || c; }
  function analyze(run, D) {
    var c = C.RUNS[run], SL = C.SEAL[run], nodes = D.nodes.slice().sort(function (a, b) { return a.id - b.id; });
    var H = nodes.map(function (n) { return n.hist; }), S = Math.min.apply(null, nodes.map(function (n) { return n.step; })), i, t;
    var R = { run: run, c: c, nodes: nodes, S: S, rows: [], full: S >= c.steps && nodes.every(function (n) { return n.hist.length === c.steps + 1; }) };
    var cmp = 0, bitDiff = 0, stepMax = 0, m0 = 0, md = 0, wMax = 0, sMax = 0;
    for (i = 0; i < N; i++) m0 += H[i][0]; m0 /= N;
    for (t = 0; t <= S; t++) {
      var v = [], mm = 0, rd = 0;
      for (i = 0; i < N; i++) { v.push(H[i][t]); mm += H[i][t]; }
      if (t > 0) for (i = 0; i < N; i++) { var e = nextX(i, H[i][t - 1], H[(i + 1) % N][t - 1], H[(i + N - 1) % N][t - 1], c); cmp++; var dd = Math.abs(e - H[i][t]); if (e !== H[i][t]) bitDiff++; rd = Math.max(rd, dd); }
      stepMax = Math.max(stepMax, rd); var dr = Math.abs(mm / N - m0); md = Math.max(md, dr);
      var row = { t: t, mean: dr, replay: rd };
      if (c.kind === 'phase') { var w = winding(v), dmn = 9, dmx = -9; for (i = 0; i < N; i++) { var d = wrap(v[(i + 1) % N] - v[i]); dmn = Math.min(dmn, d); dmx = Math.max(dmx, d); } row.w = w; row.dmin = dmn; row.dmax = dmx; wMax = Math.max(wMax, Math.abs(w - c.Q)); }
      else { row.vmin = Math.min.apply(null, v); row.vmax = Math.max.apply(null, v); }
      R.rows.push(row);
    }
    R.cmp = cmp; R.bitDiff = bitDiff; R.stepMax = stepMax; R.meanDrift = md; R.wMax = wMax;
    var fin = H.map(function (h) { return h[S]; }); R.fin = fin;
    R.reqs = nodes.reduce(function (a, n) { return a + n.reqs; }, 0); R.mismatch = nodes.reduce(function (a, n) { return a + n.mismatch; }, 0);
    R.colos = {}; nodes.forEach(function (n) { R.colos[n.colo] = 1; });
    var p = [];
    var rowsT = []; for (t = 0; t <= S; t++) { var rr = []; for (i = 0; i < N; i++) rr.push(H[i][t]); rowsT.push(rr); }
    if (c.kind === 'phase') {
      var th = H.map(function (h) { return h[0]; }), free = 0;
      for (t = 0; t < S; t++) { var nx = []; for (i = 0; i < N; i++) nx.push(nextX(i, th[i], th[(i + 1) % N], th[(i + N - 1) % N], c)); th = nx; for (i = 0; i < N; i++) free = Math.max(free, Math.abs(th[i] - H[i][t + 1])); }
      var refDev = 0, dmin = 9, dmax = -9;
      for (i = 0; i < N; i++) { refDev = Math.max(refDev, Math.abs(fin[i] - SL.ref_final[i])); var d2 = wrap(fin[(i + 1) % N] - fin[i]); dmin = Math.min(dmin, d2); dmax = Math.max(dmax, d2); }
      p.push(['Windung ' + c.Q + ' zu allen ' + (c.steps + 1) + ' Zeitpunkten (Abweichung &lt; 1e-9)', 'größte Abweichung ' + ex(wMax), wMax < 1e-9]);
      p.push(['Jeder Knoten bei Schritt ' + c.steps + ' innerhalb 1e-11 zur Referenz', ex(refDev), refDev <= 1e-11]);
      p.push(['Jeder Knoten innerhalb 1e-11 zum freien Nachlauf im Browser', ex(free), free <= 1e-11]);
      p.push(['Nachbardifferenzen bei Schritt ' + c.steps + ' im Band [' + de(SL.band[0]) + '; ' + de(SL.band[1]) + ']', fp(dmin, 6) + ' bis ' + fp(dmax, 6), dmin >= SL.band[0] && dmax <= SL.band[1]]);
      p.push(['Mittelwert der Phasen ändert sich um weniger als 1e-12', ex(md), md < 1e-12]);
      p.push(['Jeden Schritt aus den Serverwerten nachgerechnet, Abweichung höchstens 1e-11', cmp + ' Rechnungen, davon bit-gleich ' + (cmp - bitDiff) + ', größte Differenz ' + ex(stepMax), stepMax <= 1e-11]);
      p.push([c.steps + ' Schritte auf allen 36 Knoten', String(S), R.full]);
      p.push(['Kein Knoten meldete einen Widerspruch zwischen empfangenen Werten', String(R.mismatch), R.mismatch === 0]);
      return Promise.all([sha(pack(rowsT)), sha(pack([fin]))]).then(function (hh) { R.hashAll = hh[0]; R.hashFin = hh[1]; R.checks = p; R.note = 'Der Prüfwert des Endzustands lautet ' + hh[1] + '; er ist von der Rechenbibliothek abhängig (Sinus).'; return R; });
    }
    var x0 = H.map(function (h) { return h[0]; }), sum0 = x0.reduce(function (a, b) { return a + b; }, 0), sumS = fin.reduce(function (a, b) { return a + b; }, 0);
    p.push(['Jeden Schritt aus den Serverwerten bit-gleich nachgerechnet', cmp + ' Rechnungen, davon bit-gleich ' + (cmp - bitDiff), bitDiff === 0]);
    p.push(['Summe aller Werte erhalten (&lt; 1e-12)', ex(Math.abs(sumS - sum0)), Math.abs(sumS - sum0) < 1e-12]);
    p.push([c.steps + ' Schritte auf allen 36 Knoten', String(S), R.full]);
    p.push(['Kein Knoten meldete einen Widerspruch zwischen empfangenen Werten', String(R.mismatch), R.mismatch === 0]);
    if (run === 'eps') {
      var r1 = 1 - c.eps * (2 - 2 * Math.cos(2 * Math.PI / N)), rN = 1 - c.eps * 4, a1 = Math.pow(amp(fin, 1) / amp(x0, 1), 1 / S);
      var alt = function (w) { var s = 0; for (var j = 0; j < N; j++) s += w[j] * ((j % 2) ? -1 : 1); return Math.abs(s); }, aN = Math.pow(alt(fin) / alt(x0), 1 / S);
      p.push(['Abfall der langsamsten Schwingung je Schritt 0,984929 (Abweichung &lt; 1e-9)', fp(a1, 12) + ' (Soll ' + fp(r1, 12) + ')', Math.abs(a1 - r1) / r1 < 1e-9]);
      p.push(['Abfall der schnellsten Schwingung je Schritt 0,984 (Abweichung &lt; 1e-9)', fp(aN, 12) + ' (Soll ' + fp(Math.abs(rN), 12) + ')', Math.abs(aN - Math.abs(rN)) / Math.abs(rN) < 1e-9]);
    }
    return Promise.all([sha(pack(rowsT)), sha(pack([fin]))]).then(function (hh) {
      R.hashAll = hh[0]; R.hashFin = hh[1];
      p.push(['Prüfwert aller Schritte gleich der Vorhersage', R.hashAll, R.hashAll === SL.all]);
      p.push(['Prüfwert des Endzustands gleich der Vorhersage', R.hashFin, R.hashFin === SL.final]);
      if (run === 'fault') {
        var cn = nodes[c.crashNode], others = nodes.filter(function (n) { return n.id !== c.crashNode && n.crashed; }).length;
        p.push(['Knoten ' + c.crashNode + ' wurde bei Schritt ' + c.crashStep + ' gelöscht und stellte seinen Zustand aus beiden Nachbarn wieder her', cn.crashed ? ('wiederhergestellt: ' + (cn.recovery ? cn.recovery.recovered_values : 0) + ' Werte, beide Kopien gleich: ' + (cn.recovery && cn.recovery.copies_agree ? 'ja' : 'nein')) : 'kein Ausfall', cn.crashed === 1 && !!cn.recovery && cn.recovery.copies_agree && others === 0]);
      }
      R.checks = p; return R;
    });
  }
  function describe(c, run) {
    if (c.kind === 'phase') return 'Regel je Knoten und Schritt: θ ← θ + dt·(ω + K·(sin(θ_rechts − θ) + sin(θ_links − θ))) mit K = ' + c.K + ', dt = ' + c.DT + ', ω je Knoten = 0,02·((7·i mod 13) − Mittelwert). Start: gleichmäßige Verdrillung mit Windung q = ' + c.Q + ', θ_i(0) = 2π·q·i/36, kein Rauschen. ' + c.steps + ' Schritte.';
    return 'Regel je Knoten und Schritt: x ← x + ε·(rechts + links − 2x) mit ε = ' + de(c.eps) + '. Start: x_i(0) = ((7·i mod 13)/13). ' + c.steps + ' Schritte.' + (c.crashNode !== undefined ? ' Bei Schritt ' + c.crashStep + ' wird Knoten ' + c.crashNode + ' gelöscht (Zustand und Speicher leer) und holt seinen gesamten Verlauf aus den beiden Nachbarn zurück.' : '');
  }
  function render(Rs, Ds) {
    var all = []; Rs.forEach(function (R) { R.checks.forEach(function (c) { all.push(c[2]); }); });
    var okAll = all.every(function (x) { return x; }), nOk = all.filter(function (x) { return x; }).length;
    var colos = {}; Rs.forEach(function (R) { Object.keys(R.colos).forEach(function (k) { colos[k] = 1; }); });
    var ck = Object.keys(colos).sort(function (a, b) { return city(a).localeCompare(city(b), 'de'); });
    var reqs = Rs.reduce(function (a, R) { return a + R.reqs; }, 0), h = '';
    h += '<h1>Ringtest auf Cloudflare-Rechenzentren in aller Welt</h1><p class="sub">Jeder Knoten ist ein eigener Server und rechnet nur mit seinen zwei Nachbarn. Es gibt keinen Master und keine gemeinsame Uhr.</p>';
    h += '<p class="meta">Erstellt von dieser Seite am ' + new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) + ' (Berlin) aus den Messdaten der Server.</p>';
    h += '<h2>Ergebnis</h2><p><b>' + nOk + ' von ' + all.length + ' Prüfungen: ' + okt(okAll) + '.</b> Gerechnet wurde in ' + Rs.length + ' Läufen auf ' + ck.length + ' Rechenzentren, insgesamt ' + reqs + ' Anfragen an die Knoten.</p>';
    h += '<table><tr><th>Lauf</th><th>Prüfungen</th><th>Ergebnis</th></tr>';
    Rs.forEach(function (R, k) { var n = R.checks.filter(function (c) { return c[2]; }).length; h += '<tr><td>' + (k + 1) + '. ' + esc(R.c.title) + '</td><td>' + n + ' von ' + R.checks.length + '</td><td>' + ok(n === R.checks.length) + '</td></tr>'; });
    h += '</table>';
    h += '<h2>Ablauf, der in jedem Lauf gleich ist</h2><ol><li>Die Seite schickt den Startbefehl an die 36 Knoten. Danach steuert sie nichts mehr.</li><li>Jeder Knoten stellt fest, auf welchem Rechenzentrum er läuft, und berechnet den Fingerabdruck seiner Rechenbibliothek.</li><li>Jeder Knoten schickt seinen Anfangswert an seine zwei Nachbarn.</li><li>Sobald ein Knoten die Werte beider Nachbarn für den aktuellen Schritt hat, rechnet er den nächsten Wert und schickt ihn weiter. Es gibt keinen Takt: Jeder Knoten wartet nur auf seine Nachbarn.</li><li>Jeder Knoten speichert alle Werte, die er berechnet und empfangen hat. Widersprüche zwischen zwei Kopien desselben Wertes würden gezählt.</li><li>Wenn alle Knoten den letzten Schritt erreicht haben, holt diese Seite alle Verläufe ab, rechnet jeden Schritt im Browser nach und prüft gegen die vorher im Code festgelegten Vorhersagen.</li></ol>';
    Rs.forEach(function (R, k) {
      var c = R.c, n = k + 1;
      h += '<h2 class="pb">Lauf ' + n + ': ' + esc(c.title) + '</h2><p>' + esc(describe(c, R.run)) + '</p>';
      h += '<h3>Prüfungen</h3><table><tr><th>Prüfung</th><th>gemessen</th><th>Ergebnis</th></tr>';
      R.checks.forEach(function (x) { h += '<tr><td>' + x[0] + '</td><td class="m">' + x[1] + '</td><td>' + ok(x[2]) + '</td></tr>'; });
      h += '</table>';
      if (R.note) h += '<p class="small">' + esc(R.note) + '</p>';
      if (R.run === 'fault') { var cn = R.nodes[c.crashNode], rc = cn.recovery || {}; h += '<h3>Störfall im Einzelnen</h3><ul><li>Knoten ' + c.crashNode + ' löscht bei Schritt ' + c.crashStep + ' seinen gesamten Zustand und Speicher.</li><li>Er fragt seine Nachbarn, Knoten ' + rc.from_left + ' (links) und Knoten ' + rc.from_right + ' (rechts), nach den Werten, die sie von ihm empfangen haben.</li><li>Er bekommt ' + rc.recovered_values + ' Werte von jeder Seite (Schritt 0 bis ' + (rc.recovered_values - 1) + '). Beide Kopien sind ' + (rc.copies_agree ? 'Bit für Bit gleich' : 'NICHT gleich') + '.</li><li>Er übernimmt außerdem die Verläufe seiner beiden Nachbarn als empfangene Werte und rechnet weiter.</li><li>Alle anderen Knoten laufen ohne Unterbrechung weiter und warten, bis Knoten ' + c.crashNode + ' wieder Werte liefert.</li><li>Der Prüfwert aller Schritte aller 36 Knoten entspricht danach der Vorhersage für den Lauf ohne Ausfall.</li></ul>'; }
      h += '<h3>Anfangswerte, Zwischenstände und Endzustand aller Knoten</h3><table class="n"><tr><th>Knoten</th>'; var steps = [0, 1, 2, Math.floor(R.S / 4), Math.floor(R.S / 2), R.S]; steps.forEach(function (s) { h += '<th>Schritt ' + s + '</th>'; }); h += '</tr>';
      for (var i = 0; i < N; i++) { h += '<tr><td>' + i + '</td>'; steps.forEach(function (s) { h += '<td class="mono">' + R.nodes[i].hist[s].toPrecision(15) + '</td>'; }); h += '</tr>'; } h += '</table>';
      h += '<h3>Knoten: Rechenzentrum, Anfragen, Bibliothek</h3><table class="n"><tr><th>Knoten</th><th>Rechenzentrum</th><th>Anfragen</th><th>Widersprüche</th><th>Prüfwert Bibliothek</th></tr>';
      R.nodes.forEach(function (nd) { h += '<tr><td>' + nd.id + '</td><td>' + esc(city(nd.colo)) + '</td><td>' + nd.reqs + '</td><td>' + nd.mismatch + '</td><td class="mono">' + nd.fp.slice(0, 16) + '…</td></tr>'; }); h += '</table>';
      h += '<h3>Jeder Schritt im Einzelnen</h3><p class="small">Je Schritt: ' + (c.kind === 'phase' ? 'Windung, größte Abweichung des Mittelwerts aller Phasen, kleinste und größte Nachbardifferenz' : 'größte Abweichung der Summe, kleinster und größter Wert') + ' und die größte Abweichung zwischen den Serverwerten und der Nachrechnung im Browser.</p><table class="long"><thead><tr><th>Schritt</th>' + (c.kind === 'phase' ? '<th>Windung</th><th>Mittelwert-Abw.</th><th>Nachbardiff. min</th><th>Nachbardiff. max</th>' : '<th>Summen-Abw.</th><th>Wert min</th><th>Wert max</th>') + '<th>Nachrechnung</th></tr></thead><tbody>';
      R.rows.forEach(function (r) { h += '<tr><td>' + r.t + '</td>' + (c.kind === 'phase' ? '<td>' + r.w.toFixed(12) + '</td><td>' + ex(r.mean) + '</td><td>' + r.dmin.toFixed(6) + '</td><td>' + r.dmax.toFixed(6) + '</td>' : '<td>' + ex(r.mean) + '</td><td>' + r.vmin.toPrecision(10) + '</td><td>' + r.vmax.toPrecision(10) + '</td>') + '<td>' + ex(r.replay) + '</td></tr>'; });
      h += '</tbody></table>';
    });
    h += '<h2 class="pb">Rechenzentren</h2><p>Die ' + ck.length + ' Rechenzentren, auf denen Knoten liefen:</p><ul class="cols">'; ck.forEach(function (k) { h += '<li>' + esc(city(k)) + '</li>'; }); h += '</ul>';
    var fpAll = {}; Rs.forEach(function (R) { R.nodes.forEach(function (n) { fpAll[n.fp] = (fpAll[n.fp] || 0) + 1; }); });
    h += '<h2>Rechenbibliothek der Knoten</h2><p>Jeder Knoten rechnet 14 000 Werte von Sinus, Kosinus, Exponential, Logarithmus, Potenz, Arkustangens und Tangens und meldet den SHA-256-Prüfwert der Ergebnisse. Gleiche Prüfwerte bedeuten dieselbe Rechenbibliothek. Gefunden: ' + Object.keys(fpAll).length + ' verschiedene.</p><table><tr><th>Prüfwert (SHA-256)</th><th>Knoten</th></tr>';
    Object.keys(fpAll).forEach(function (k) { h += '<tr><td class="mono">' + k + '</td><td>' + fpAll[k] + '</td></tr>'; }); h += '</table>';
    var lines = ['Ringtest Cloudflare', new Date().toISOString(), 'Pruefungen ' + nOk + '/' + all.length + ' ' + okt(okAll), 'Rechenzentren ' + ck.length + ' ' + ck.join(','), 'Anfragen ' + reqs];
    Rs.forEach(function (R) { lines.push('Lauf ' + R.run + ' Schritte ' + R.S + ' Pruefungen ' + R.checks.filter(function (x) { return x[2]; }).length + '/' + R.checks.length + ' bitDiff ' + R.bitDiff + ' maxDiff ' + ex(R.stepMax) + ' hashAll ' + R.hashAll + ' hashFin ' + R.hashFin + ' Anfragen ' + R.reqs); R.checks.forEach(function (x) { lines.push('  ' + (x[2] ? 'OK ' : 'ABW ') + x[0].replace(/&lt;/g, '<') + ' | ' + x[1].replace(/<[^>]*>/g, '')); }); lines.push('  Endzustand ' + R.fin.map(function (x) { return x.toPrecision(17); }).join(' ')); lines.push('  Standorte ' + R.nodes.map(function (n) { return n.colo; }).join(',')); lines.push('  Fingerabdruecke ' + R.nodes.map(function (n) { return n.fp.slice(0, 8); }).join(',')); });
    lines.push('Fingerabdruecke gesamt ' + Object.keys(fpAll).length);
    var txt = lines.join('\n'), raw = JSON.stringify(Ds);
    return Promise.all([shaText(txt), shaText(raw)]).then(function (hs) {
      h += '<h2>Prüfsummen</h2><table><tr><th>Inhalt</th><th>SHA-256</th></tr><tr><td>Rohdaten aller Läufe (Datei zum Speichern)</td><td class="mono">' + hs[1] + '</td></tr><tr><td>Kurzfassung dieses Berichts</td><td class="mono">' + hs[0] + '</td></tr></table><textarea id="sum" rows="10">' + esc(txt) + '</textarea><p class="noprint"><button id="cp">Kurzfassung kopieren</button> <button id="dl">Rohdaten speichern</button> <button onclick="window.print()">Als PDF sichern / drucken</button></p>';
      el('root').innerHTML = h;
      el('cp').onclick = function () { var ta = el('sum'); ta.select(); try { navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); } };
      el('dl').onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' })); a.download = 'ringtest_rohdaten.json'; document.body.appendChild(a); a.click(); a.remove(); };
      window.__done = okt(okAll); window.__summary = txt;
    });
  }
  function loadAll() { return Promise.all(C.ORDER.map(function (r) { return fetch('/data?run=' + r).then(function (x) { return x.json(); }); })).then(function (Ds) { return Promise.all(C.ORDER.map(function (r, k) { return analyze(r, Ds[k]); })).then(function (Rs) { return render(Rs, Ds); }); }); }
  var started = {};
  function poll() {
    Promise.all(C.ORDER.map(function (r) { return getJSON('/prog?run=' + r); })).then(function (P) {
      var allDone = true, msg = [];
      P.forEach(function (f, k) { var r = C.ORDER[k]; if (f.target < C.RUNS[r].steps && !started[r]) { started[r] = 1; fetch('/start?run=' + r + '&steps=' + C.RUNS[r].steps); } if (f.minStep < C.RUNS[r].steps) allDone = false; msg.push(r + ': ' + f.minStep + ' / ' + C.RUNS[r].steps); });
      if (!allDone) { status('Lauf wird ausgeführt. Diese Seite aktualisiert sich selbst.<br>Fortschritt: ' + msg.join(' · ')); setTimeout(poll, 12000); return; }
      status('Alle Läufe fertig, Bericht wird erstellt …'); return loadAll();
    }).catch(function (e) { status('Fehler: ' + esc(String(e)) + ' (neuer Versuch in 30 s)'); setTimeout(poll, 30000); });
  }
  if (location.search.indexOf('bericht') >= 0) { status('Bericht wird aus den Daten erstellt …'); loadAll().catch(function (e) { status('Fehler: ' + esc(String(e))); }); } else poll();
}
`;
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
