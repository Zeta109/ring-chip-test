# ring-chip-test
## Weltlauf auf Cloudflare (9.11.2026)
Ordner `weltlauf/`: Code (`worker.js`, `page.txt`), Vorhersage (`PREDICTION_WELTLAUF.txt`, vorab eingetragen) und `ergebnis/` mit Rohdaten und PDF-Bericht der Seite selbst.
Ergebnis: 47 von 47 Prüfungen bestanden, 6 Läufe, 31 Rechenzentren, 52 600 Anfragen.
Nachprüfen: Rohdaten JSON laden, je Knoten `hist` (Schritt 0 bis Ende) nehmen, jeden Schritt mit der Regel nachrechnen und die Prüfwerte aus `weltlauf/seal.json` vergleichen. Eigener Lauf: `worker.js` und `page.txt` als Cloudflare-Worker mit Durable Object `RingNode` einspielen und die Seite öffnen.
