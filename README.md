# FantasyCrafter

Ein kleines Idle-Spiel für den Browser (Handy zuerst): Du führst den Ausrüstungsladen im Dorf Eichenfurt.
Die Helden sind eigenwillig. Sie kaufen bei dir ein, entscheiden aber selbst, ob sie sich an Spinnen, Trolle oder
den Drachen wagen. Details stehen in [KONZEPT.md](KONZEPT.md).

## Spielen

- Online über GitHub Pages (Repository → Settings → Pages → „Deploy from a branch“, `main`, Ordner `/ (root)`).
- Lokal: einen beliebigen statischen Server im Ordner starten, z. B. `python3 -m http.server`, dann
  <http://localhost:8000> öffnen. Über `file://` funktioniert es wegen der ES-Module nicht.
- Testtempo: `?speed=60` an die URL hängen oder in den Einstellungen (⚙️) umstellen.

## Entwicklung

- Kein Build-Schritt: `index.html`, `css/`, `src/`.
- `src/sim.js` enthält die komplette Spiellogik (ohne DOM), `src/data.js` die Spieldaten, `src/text.js` die Erzähltexte.
- Balancing-Test ohne Browser: `node tools/simulate.mjs 14 42` (Tage, Seed, optional `--log`).
