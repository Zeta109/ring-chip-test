# Live-Schaltung: „Was der Raum weiß, bevor er sich bewegt“ (What space knows before it moves)

36 Knoten auf Cloudflare-Servern, jeder kennt nur seinen linken und seinen rechten Nachbarn, keine Zentrale, keine gemeinsame Uhr.
Seite: https://md-v-ring-live.zeta1-09.workers.dev/  (Knopf „Neuen Live-Lauf starten“, fünf Läufe je Tag, 40 Schritte)
Prüfseite pro Lauf: /pruefung?run=live-JJJJMMTT-n (reiner HTML-Text, ohne JavaScript), Rohwerte: /data?run=live-JJJJMMTT-n
Die Prüfseite rechnet aus den letzten Phasen die Windung, vergleicht jeden Knoten und jeden Schritt mit einer lokalen Referenzrechnung
und gibt die SHA-256 aller Werte aus. Der Servercode des versiegelten Laufs vom 9.11.2026 (weltlauf/worker.js) bleibt unverändert.
