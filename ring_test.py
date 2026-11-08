#!/usr/bin/env python3
"""Ringtest je Rechner. Nur Standardbibliothek. Schreibt result_<label>.json."""
import sys, os, json, math, hashlib, struct, platform, subprocess, time

def run(cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=30, shell=isinstance(cmd, str)).stdout.strip()
    except Exception:
        return ''

def cpu_info():
    s = platform.system(); model = ''; extra = ''
    if s == 'Linux':
        txt = open('/proc/cpuinfo').read() if os.path.exists('/proc/cpuinfo') else ''
        for line in txt.splitlines():
            if line.lower().startswith(('model name', 'hardware', 'cpu model')):
                model = line.split(':', 1)[1].strip(); break
        extra = run(['lscpu'])
        if not model:
            for line in extra.splitlines():
                if line.startswith('Model name'):
                    model = line.split(':', 1)[1].strip(); break
        if not model:
            parts = [l.split(':', 1)[1].strip() for l in txt.splitlines() if l.startswith(('CPU implementer', 'CPU part'))][:2]
            model = 'ARM ' + ' / '.join(parts)
    elif s == 'Darwin':
        model = run(['sysctl', '-n', 'machdep.cpu.brand_string'])
        extra = run(['sysctl', 'hw.model', 'hw.ncpu', 'hw.optional.arm64'])
    elif s == 'Windows':
        model = run(['powershell', '-NoProfile', '-Command', '(Get-CimInstance Win32_Processor | Select-Object -First 1).Name'])
        extra = os.environ.get('PROCESSOR_IDENTIFIER', '')
    if not model:
        model = platform.processor() or platform.machine()
    return model, extra

def h(b): return hashlib.sha256(b).hexdigest()
def pack(v): return struct.pack('<%dd' % len(v), *v)
def bits(x): return struct.unpack('<Q', struct.pack('<d', x))[0]

# ---------- T1/T3/T4: Diffusion auf dem Ring ----------
def start_vec(N): return [((7 * i) % 13) / 13.0 for i in range(N)]
def diffuse(N, eps, steps, record=False):
    x = start_vec(N); hist = [x[:]]
    for _ in range(steps):
        x = [x[i] + eps * (x[(i + 1) % N] + x[i - 1] - 2 * x[i]) for i in range(N)]
        if record: hist.append(x[:])
    return x, hist
def mode_amp(x, k):
    N = len(x); c = sum(x[i] * math.cos(2 * math.pi * k * i / N) for i in range(N)); s = sum(x[i] * math.sin(2 * math.pi * k * i / N) for i in range(N))
    return math.hypot(c, s)

def t1():
    N, eps, S = 36, 0.25, 400
    x, hist = diffuse(N, eps, S, True)
    allh = h(b''.join(pack(v) for v in hist)); fin = h(pack(x))
    r = 1 - eps * (2 - 2 * math.cos(2 * math.pi / N))
    meas = (mode_amp(x, 1) / mode_amp(hist[0], 1)) ** (1.0 / S)
    return dict(hash_alle_schritte=allh, hash_endzustand=fin, summe_abweichung=abs(sum(x) - sum(hist[0])), abfall_soll=r, abfall_gemessen=meas, abfall_abw_rel=abs(meas - r) / r)

def t3():
    N, eps, S = 36, 0.496, 200
    x, _ = diffuse(N, eps, S)
    x0 = start_vec(N)
    lam1 = 2 - 2 * math.cos(2 * math.pi / N); r1 = 1 - eps * lam1; rN = 1 - eps * 4
    a1 = (mode_amp(x, 1) / mode_amp(x0, 1)) ** (1.0 / S)
    alt = lambda v: abs(sum(v[i] * (-1) ** i for i in range(N)))
    aN = (alt(x) / alt(x0)) ** (1.0 / S)
    return dict(abfall_langsam_soll=r1, abfall_langsam_gemessen=a1, abfall_nyquist_soll=abs(rN), abfall_nyquist_gemessen=aN,
                abw_rel=max(abs(a1 - r1) / r1, abs(aN - abs(rN)) / abs(rN)))

def t4(N):
    lam = [2 - 2 * math.cos(2 * math.pi * k / N) for k in range(1, N)]
    eps, S = 0.25, 200
    x, _ = diffuse(N, eps, S); x0 = start_vec(N)
    r = 1 - eps * lam[0]; meas = (mode_amp(x, 1) / mode_amp(x0, 1)) ** (1.0 / S)
    return dict(N=N, summe_lambda=sum(lam) + 0.0, summe_lambda_soll=2.0 * N, produkt_lambda=math.exp(sum(math.log(v) for v in lam)), produkt_soll=float(N * N),
                summe_kehrwert=sum(1 / v for v in lam), summe_kehrwert_soll=(N * N - 1) / 12.0, abfall_soll=r, abfall_gemessen=meas,
                abw_rel=max(abs(sum(lam) - 2.0 * N) / (2.0 * N), abs(math.exp(sum(math.log(v) for v in lam)) - N * N) / (N * N), abs(sum(1 / v for v in lam) - (N * N - 1) / 12.0) / ((N * N - 1) / 12.0), abs(meas - r) / r))

# ---------- T2: Phasenlauf (festgelegte Vorhersage) ----------
def wind(t):
    N = len(t); tot = 0.0; d = []
    for i in range(N):
        v = t[(i + 1) % N] - t[i]; v = (v + math.pi) % (2 * math.pi) - math.pi; d.append(v); tot += v
    return tot / (2 * math.pi), d

def t2(ref_final):
    N, K, dt, b, S = 36, 4.0, 0.05, 0.02, 400
    base = [(7 * i) % 13 for i in range(N)]; mb = sum(base) / N; om = [b * (v - mb) for v in base]
    th = [2 * math.pi * 1 * i / N for i in range(N)]
    m0 = sum(th) / N; wmax = 0.0; prev = th
    for s in range(S + 1):
        w, d = wind(th); wmax = max(wmax, abs(w - 1))
        if s == S: break
        prev = th
        th = [th[i] + dt * (om[i] + K * (math.sin(th[(i + 1) % N] - th[i]) + math.sin(th[i - 1] - th[i]))) for i in range(N)]
    w, d = wind(th)
    dev = max(abs(th[i] - ref_final[i]) for i in range(N))
    vel = [(th[i] - prev[i]) / dt for i in range(N)]
    return dict(windung_max_abw=wmax, knoten_max_abw_zur_referenz=dev, nachbardifferenz_min=min(d), nachbardifferenz_max=max(d),
                mittelwert_drift=abs(sum(th) / N - m0), geschwindigkeitsstreuung=max(vel) - min(vel), hash_endzustand=h(pack(th)))

# ---------- T5: Rechenbibliothek-Fingerabdruck ----------
def t5():
    out = []
    for i in range(1, 2001):
        x = i * 0.00137 + 0.3
        out += [math.sin(x), math.cos(x), math.exp(x / 50), math.log(x), math.pow(x, 1.37), math.atan2(x, 1.1), math.tan(x / 9)]
    return dict(fingerabdruck=h(pack(out)), anzahl=len(out))

def main():
    label = sys.argv[1]
    here = os.path.dirname(os.path.abspath(__file__))
    ref = json.load(open(os.path.join(here, 'referenz_phase.json')))['final']
    model, extra = cpu_info()
    t0 = time.time()
    T = {'T1_ring36_exakt': t1(), 'T2_phasenlauf': t2(ref), 'T3_eps0496': t3(), 'T4_N30': t4(30), 'T4_N70': t4(70), 'T5_bibliothek': t5()}
    pred = json.load(open(os.path.join(here, 'referenz_phase.json')))
    ok = {}
    t = T['T1_ring36_exakt']
    ok['T1'] = (t['hash_alle_schritte'] == pred['t1_hash_alle_schritte'] and t['hash_endzustand'] == pred['t1_hash_endzustand'] and t['summe_abweichung'] < 1e-12 and t['abfall_abw_rel'] < 1e-9)
    t = T['T2_phasenlauf']
    ok['T2'] = (t['windung_max_abw'] < 1e-9 and t['knoten_max_abw_zur_referenz'] < 1e-11 and 0.13 <= t['nachbardifferenz_min'] and t['nachbardifferenz_max'] <= 0.21 and t['mittelwert_drift'] < 1e-12)
    ok['T3'] = T['T3_eps0496']['abw_rel'] < 1e-9
    ok['T4_N30'] = T['T4_N30']['abw_rel'] < 1e-9
    ok['T4_N70'] = T['T4_N70']['abw_rel'] < 1e-9
    res = dict(label=label, os=platform.system(), os_version=platform.platform(), architektur=platform.machine(), cpu_modell=model, cpu_details=extra,
               python=platform.python_version(), rechenzeit_s=round(time.time() - t0, 2), tests=T, bestanden=ok, alle_bestanden=all(ok.values()),
               runner_name=os.environ.get('RUNNER_NAME', ''), runner_os=os.environ.get('RUNNER_OS', ''), runner_arch=os.environ.get('RUNNER_ARCH', ''),
               commit=os.environ.get('GITHUB_SHA', ''), lauf_id=os.environ.get('GITHUB_RUN_ID', ''))
    os.makedirs('ergebnisse_roh', exist_ok=True)
    json.dump(res, open('ergebnisse_roh/result_%s.json' % label, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(label, model, 'ALLE BESTANDEN' if res['alle_bestanden'] else 'ABWEICHUNG', ok)

if __name__ == '__main__':
    main()
