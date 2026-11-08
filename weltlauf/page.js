function pageMain(C) {
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
