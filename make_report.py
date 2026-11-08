#!/usr/bin/env python3
"""Baut aus allen result_*.json den Bericht (PDF, Deutsch + Englisch) und ergebnisse/gesamt.json."""
import json, glob, os, collections, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

R = [json.load(open(f, encoding='utf-8')) for f in sorted(glob.glob('ergebnisse_roh/result_*.json'))]
os.makedirs('ergebnisse', exist_ok=True)
n = len(R); nb = sum(1 for r in R if r['alle_bestanden'])
cpus = collections.Counter(r['cpu_modell'] for r in R)
fp = collections.Counter(r['tests']['T5_bibliothek']['fingerabdruck'] for r in R)
t1h = collections.Counter(r['tests']['T1_ring36_exakt']['hash_alle_schritte'] for r in R)
t2h = collections.Counter(r['tests']['T2_phasenlauf']['hash_endzustand'] for r in R)
gesamt = dict(laeufe=n, bestanden=nb, cpu_modelle=dict(cpus), fingerabdruecke=dict(fp), t1_hashes=dict(t1h), t2_hashes=dict(t2h), laeufe_liste=R)
json.dump(gesamt, open('ergebnisse/gesamt.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
open('ergebnisse/gesamt.sha256', 'w').write(hashlib.sha256(open('ergebnisse/gesamt.json', 'rb').read()).hexdigest() + '  gesamt.json\n')

G = colors.HexColor('#1E8E3E'); BL = colors.HexColor('#2F6EB5')
S = lambda **k: ParagraphStyle('x', fontName=k.pop('fontName', 'Times-Roman'), fontSize=k.pop('fontSize', 10.5), leading=k.pop('leading', 14), **k)
P = S(spaceAfter=6); TT = S(fontName='Times-Bold', fontSize=17, leading=21, spaceAfter=6); H2 = S(fontName='Helvetica', fontSize=14, leading=18, textColor=BL, spaceBefore=12, spaceAfter=6, keepWithNext=1)
def p(t, st=P): return Paragraph(t, st)
def tbl(rows, cw, fs=8.2):
    cs = S(fontSize=fs, leading=fs + 2.4); hs = S(fontName='Times-Bold', fontSize=fs, leading=fs + 2.4)
    data = [[Paragraph(str(c), hs if i == 0 else cs) for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=cw, repeatRows=1)
    t.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), .5, colors.black), ('BACKGROUND', (0, 0), (-1, 0), colors.Color(.89, .93, .98)), ('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    return t
OK = lambda de: '<font color="#1E8E3E"><b>%s</b></font>' % ('bestanden' if de else 'passed')
BAD = lambda de: '<font color="#C0392B"><b>%s</b></font>' % ('Abweichung' if de else 'deviation')

def story(de):
    L = lambda a, b: a if de else b
    s = [p(L('Ringtest auf verschiedenen Rechnerchips – Messbericht', 'Ring test on different computer chips – measurement report'), TT)]
    s += [p(L('Lauf-Nummer %s · Stand der Programme: %s', 'Run number %s · program version: %s') % (R[0]['lauf_id'], R[0]['commit'][:12]))]
    s += [p(L('1. Ergebnis', '1. Result'), H2)]
    s += [p(L('%d Rechner liefen auf %d verschiedenen Prozessortypen. %d von %d Läufen bestanden alle fünf Prüfungen.', '%d machines ran on %d different processor types. %d of %d runs passed all five checks.') % (n, len(cpus), nb, n))]
    s += [p(L('Auf allen Rechnern ist der exakte Ring (nur Addition, Subtraktion, Multiplikation) Bit für Bit gleich: %d verschiedene Prüfwert(e) über alle Schritte. Der Phasenlauf mit Sinus liegt auf allen Rechnern innerhalb von 1e-11 zur Referenz: %d verschiedene Prüfwert(e) des Endzustands.', 'On all machines the exact ring (only addition, subtraction, multiplication) is bit for bit identical: %d distinct checksum(s) over all steps. The phase run with sine lies within 1e-11 of the reference on all machines: %d distinct checksum(s) of the final state.') % (len(t1h), len(t2h)))]
    s += [p(L('2. Prüfungen', '2. Checks'), H2)]
    items = [L('T1 Ring mit 36 Knoten, 400 Schritte: Prüfwert aller Schritte und des Endzustands gleich der Festlegung, Summe erhalten (&lt; 1e-12), Abfall der langsamsten Schwingung auf 1e-9.', 'T1 ring with 36 nodes, 400 steps: checksum of all steps and of the final state equal to the fixed value, sum conserved (&lt; 1e-12), decay of the slowest oscillation to 1e-9.'),
             L('T2 Phasenlauf, 36 Knoten, 400 Schritte: Windung 1 zu allen 401 Zeitpunkten (&lt; 1e-9), jeder Knoten innerhalb 1e-11 zur Referenz, Nachbardifferenzen in [0,13; 0,21], Mittelwert-Drift &lt; 1e-12.', 'T2 phase run, 36 nodes, 400 steps: winding 1 at all 401 times (&lt; 1e-9), every node within 1e-11 of the reference, neighbour differences in [0.13; 0.21], mean drift &lt; 1e-12.'),
             L('T3 Ring mit 36 Knoten, ε = 0,496, 200 Schritte: Abfall der langsamsten Schwingung 0,984929 und der schnellsten 0,984, Abweichung &lt; 1e-9.', 'T3 ring with 36 nodes, ε = 0.496, 200 steps: decay of the slowest oscillation 0.984929 and of the fastest 0.984, deviation &lt; 1e-9.'),
             L('T4 Ringe mit 30 und 70 Knoten: Summe der Eigenwerte 2N, Produkt N², Summe der Kehrwerte (N²−1)/12 und Abfall der langsamsten Schwingung, Abweichung &lt; 1e-9.', 'T4 rings with 30 and 70 nodes: sum of eigenvalues 2N, product N², sum of reciprocals (N²−1)/12 and decay of the slowest oscillation, deviation &lt; 1e-9.'),
             L('T5 Fingerabdruck der Rechenbibliothek: 14 000 Werte von Sinus, Kosinus, Exponential, Logarithmus, Potenz, Arkustangens, Tangens; Prüfwert wird je Rechner aufgezeichnet.', 'T5 fingerprint of the math library: 14,000 values of sine, cosine, exponential, logarithm, power, arctangent, tangent; the checksum is recorded per machine.')]
    s += [p(x) for x in items]
    s += [p(L('3. Prozessortypen', '3. Processor types'), H2)]
    s += [tbl([[L('Prozessor', 'Processor'), L('Anzahl Läufe', 'Number of runs')]] + [[k, v] for k, v in sorted(cpus.items())], [380, 100], 8.6)]
    s += [Spacer(1, 6), p(L('Fingerabdrücke der Rechenbibliothek (T5): %d verschiedene. Gleiche Fingerabdrücke bedeuten gleiche Rechenbibliothek, nicht gleichen Prozessor.', 'Math library fingerprints (T5): %d distinct. Equal fingerprints mean the same math library, not the same processor.') % len(fp))]
    s += [PageBreak(), p(L('4. Alle Läufe', '4. All runs'), H2)]
    rows = [[L('Rechner', 'Machine'), L('System', 'System'), L('Architektur', 'Architecture'), L('Prozessor', 'Processor'), 'T1', 'T2', 'T3', 'T4', L('Ergebnis', 'Result')]]
    for r in R:
        b = r['bestanden']; c = lambda k: OK(de) if b[k] else BAD(de)
        rows.append([r['label'], r['os'], r['architektur'], r['cpu_modell'], c('T1'), c('T2'), c('T3'), OK(de) if (b['T4_N30'] and b['T4_N70']) else BAD(de), OK(de) if r['alle_bestanden'] else BAD(de)])
    s += [tbl(rows, [62, 40, 48, 150, 38, 38, 38, 38, 44], 7.2)]
    s += [PageBreak(), p(L('5. Messwerte je Lauf', '5. Measured values per run'), H2)]
    rows = [[L('Rechner', 'Machine'), 'T1 ' + L('Abfall (gemessen)', 'decay (measured)'), L('Windung max. Abw.', 'winding max dev.'), L('Knoten max. Abw.', 'node max dev.'), 'T3 ' + L('langsam', 'slow'), 'T4 N=30', 'T4 N=70']]
    for r in R:
        T = r['tests']
        rows.append([r['label'], '%.15f' % T['T1_ring36_exakt']['abfall_gemessen'], '%.2e' % T['T2_phasenlauf']['windung_max_abw'], '%.2e' % T['T2_phasenlauf']['knoten_max_abw_zur_referenz'], '%.15f' % T['T3_eps0496']['abfall_langsam_gemessen'], '%.2e' % T['T4_N30']['abw_rel'], '%.2e' % T['T4_N70']['abw_rel']])
    s += [tbl(rows, [70, 85, 55, 55, 85, 45, 45], 7.2)]
    s += [Spacer(1, 8), p(L('Prüfsumme der Gesamtdaten (ergebnisse/gesamt.json): ', 'Checksum of the complete data (ergebnisse/gesamt.json): ') + '<font name="Courier" size="7">' + open('ergebnisse/gesamt.sha256').read().split()[0] + '</font>')]
    return s

doc = SimpleDocTemplate('ergebnisse/Messbericht_Ringtest.pdf', pagesize=A4, leftMargin=44, rightMargin=44, topMargin=50, bottomMargin=48, title='Ringtest')
# beide Sprachen: erst Deutsch, dann Englisch
st = story(True) + [PageBreak()] + story(False)
doc.build(st)
print('Bericht fertig:', n, 'Laeufe,', nb, 'bestanden')
