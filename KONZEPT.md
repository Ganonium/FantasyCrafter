# FantasyCrafter – Konzept

## Kernidee

Du führst den Ausrüstungsladen **„Zum Goldenen Amboss“** im Dorf **Eichenfurt**. Helden wohnen in der Taverne, kaufen
bei dir ein und ziehen auf Abenteuer. **Du schickst niemanden los.** Die Helden haben ein Eigenleben und entscheiden
selbst, ob und wohin sie gehen. Das hängt von ihrer Stärke und Ausrüstung ab, aber auch von Laune, Tagesform und
schlicht davon, ob sie „Bock“ haben.

Du beeinflusst sie nur indirekt:

- **Was du herstellst und zu welchem Preis** (bessere Ausrüstung → mehr Mut → gefährlichere Gebiete)
- **Welche Kopfgelder du am Auftragsbrett aushängst** (Belohnung pro Stück für seltene Materialien)
- **Wie du das Dorf ausbaust** (Schmiede, Laden, Taverne, Lagerhaus)

```
Ausrüstung ─► Helden trauen sich mehr zu ─► seltene Materialien + Gold ─► bessere Ausrüstung …
     ▲                                                                          │
     └──────────── Helden kaufen bei dir ◄── Helden verdienen Gold ◄────────────┘
```

Daraus entsteht die Spannung: Ohne Drachenschuppen gibt es keine Drachenrüstung. Und solange sich niemand an den
Drachen traut, gibt es keine Drachenschuppen. Genauso fehlt die Spinnenseide, wenn alle Spinnen hassen.

## Spielrhythmus

- **Ziel: etwa 5× am Tag kurz reinschauen.** Beim Öffnen liest man, was passiert ist (Chronik bzw. „Während du fort
  warst …“), trifft ein paar Entscheidungen und schaut später nach, was daraus geworden ist.
- Abenteuer dauern 30 Min. bis 4 Std., Herstellen 10 Min. bis 3 Std. (bei Tempo 1×). Nachts (22–6 Uhr) bricht niemand auf.
- **Testtempo:** 1×, 10×, 60×, 300× in den Einstellungen oder per URL `?speed=60`. `DEFAULT_SPEED` in `src/main.js` ist 1.
- **Offline-Fortschritt:** Das Spiel speichert, bis wann es gerechnet hat. Beim Öffnen wird die verpasste Zeit
  nachsimuliert (begrenzt durch das Lagerhaus: 10/16/24 Std.).

## Helden mit Eigenleben

| Eigenschaft | Wirkung |
|---|---|
| **Klasse** (Krieger, Waldläufer, Magier) | kauft nur passende Waffen und Rüstungen; Waldläufer bringen mehr Beute mit, Krieger heilen schneller |
| **Stufe + Ausrüstung → Kraft** | bestimmt die Erfolgschance pro Gebiet |
| **Zwei Wesenszüge** | Mutig, Vorsichtig, Gierig, Faul, Eifrig, Ruhmsüchtig, Geizig, Spendabel, Gesellig |
| **Lieblingsgebiet / verhasstes Gebiet** | „Spinnenhöhle? Nicht für alles Gold der Welt. Ich hasse Spinnen.“ |
| **Laune** | steigt bei Erfolgen, guten Käufen und in geselliger Runde, sinkt bei Verletzungen und Wucherpreisen; wer lange schlecht gelaunt ist, verlässt das Dorf |
| **Tagesform** | jeden Tag neu ausgewürfelt; manche Tage hat einfach niemand Lust |
| **Gold** | eigenes Geld; davon kaufen die Helden bei dir, bezahlen Reparaturen und die Taverne |

**Entscheidung** (alle 15–40 Spielminuten, wenn ausgeruht und nicht nachts):

1. Gibt es im Regal ein bezahlbares Upgrade zu einem akzeptablen Preis? Dann wird gekauft.
2. Jedes Gebiet wird bewertet: Erfolgschance × (Gold + Kopfgeld × Gier) × Vorlieben. Ein Gebiet kommt nur in Frage,
   wenn die Chance über der persönlichen Mutschwelle liegt und es nicht verhasst ist.
3. „Habe ich Bock?“: Tagesform × Laune × Fleiß, beeinflusst vom eigenen Geldbeutel und von lockenden Kopfgeldern.
4. Bleibt ein Kopfgeld liegen, **sagt der Held dir, warum**. Das erscheint in der Chronik und als Gedanke.

## Wirtschaft

- **Grundstoffe** (Eisen, Holz, Stoff, Kräuter) kann man jederzeit beim Händler kaufen.
- **Seltene Materialien** (Wolfsfell, Spinnenseide, Mondkristall, Trollknochen, Drachenschuppe) gibt es nur über
  Kopfgelder. Das Gold wird beim Aushängen hinterlegt und bei Lieferung an den Helden ausgezahlt.
- **Ausrüstung** in 4 Stufen je Klasse und Slot (Waffe, Rüstung); die Stufen schaltet der Schmiede-Ausbau frei.
- **Heiltränke** sind Verbrauchsgut: Sie retten bei einer Niederlage vor Verletzungen und machen Helden mutiger.
- **Reparaturen**: Nach jedem Abenteuer lassen Helden ihre Ausrüstung bei dir reparieren, was laufende Einnahmen bringt.
- **Preisstufen** pro Ware: Günstig / Fair / Teuer / Wucher.
- **Ladenhüter** kann man für 50 % an den Händler verkaufen.

## Ereignisse

Etwa alle 3–6 Spielstunden (tagsüber) passiert im Dorf etwas, und du musst dich entscheiden. Die Wahl verändert das
Dorf meist für mehrere Stunden. Ein Ereignis wartet 6 Stunden auf dich, danach gilt die letzte Option als Vorgabe.
Aktive Einflüsse stehen als Chips unter der Dorfszene.

| Ereignis | Entscheidung |
|---|---|
| 🐪 Händlerkarawane | seltene Materialien teuer kaufen, Grundstoffe im Großeinkauf oder nichts |
| 🐺 Wolfsplage | Prämie ausloben (Finsterwald bringt 8 Std. 2,5× Gold) oder vertrösten (Finsterwald gefährlicher) |
| 🏆 Turnier | Preisgeld stiften (danach spendable Helden) oder nur zuschauen; so oder so zieht ein paar Stunden niemand los |
| 🌧️ Dauerregen | Abenteuer dauern länger; aus Stoff Regenmäntel nähen und verkaufen |
| ⛓️ Eisenmangel | Eisen kostet 16 Std. das Dreifache; letzten Wagen zum alten Preis kaufen? |
| ⚒️ Meisterschmied | anheuern: 8 Std. lang 60 % schneller schmieden |
| 🌾 Erntefest | großes Fest (Laune hoch, aber niemand zieht los), Fass spendieren oder nichts |
| 🗺️ Schatzgerücht | Karte kaufen oder Gerücht verbreiten: ein Gebiet bringt 10 Std. viel mehr Gold |
| 🤕 Verletzter Fremder | Heiltrank geben, zum Heiler bringen (vielleicht bleibt er als Held) oder weitergehen |
| 👺 Goblin-Überfall | Helden als Wachen bezahlen, Stadtwache anfordern oder riskieren (Diebstahl) |
| 🧙‍♀️ Kräuterfrau | billige Kräuter oder ihr Rezept (Heiltränke doppelt so schnell) |
| 🎶 Barde | bezahlen, damit er bleibt: bessere Laune, mehr Neuankömmlinge |
| 🛒 Konkurrenz am Markt | Helden 12 Std. wählerischer bei Preisen; Händler wegschicken? |

## Bestellungen

Auftraggeber (Stadtwache, Fürstin, Kloster, Jagdmeisterin, Akademie, Kaufmannsgilde) fragen Bestellungen mit Frist an.
Du kannst sie annehmen oder ablehnen. Angenommene Bestellungen bekommen fertige Ware direkt aus der Werkstatt, sie landet
also nicht im Regal. Damit wird die **Reihenfolge in der Warteschlange** zur Entscheidung: zuerst die Bestellung oder
zuerst das Schwert, auf das ein Held wartet? Pünktliche Lieferung bringt Gold und Ruf, Verspätung kostet Ruf.
Einträge in der Warteschlange lassen sich nach vorne schieben.

## Ziele und Dorfprojekte

- **Ziele**: eine Kette von 15 Zielen (vom ersten Verkauf bis zum Helden in voller Drachenausrüstung) mit Belohnungen.
  Das aktuelle Ziel steht oben in der Chronik und im Dorf-Tab.
- **Dorfprojekte**: einmalige Gold-Investitionen mit dauerhaftem Bonus: Dorfbrunnen, Heilerhütte, Marktplatz,
  Wachturm, Bardenbühne, Heldendenkmal (250 bis 3.000 Gold).

## Chronik

Jede Situation hat mehrere Textvarianten. Die Simulation meidet die zuletzt benutzten, damit sich nichts direkt
wiederholt. Dazu kommen Varianten nach Tageszeit, Schatzjagd-Texte und Nachsätze passend zum Wesen der Helden
(der Gierige zählt die Münzen zweimal).

## Gebiete

| Gebiet | Gefahr | Beute |
|---|---|---|
| 🌾 Kornfelder | 4 | nur Gold |
| 🌲 Finsterwald | 9 | Wolfsfell |
| 🕷️ Spinnenhöhle | 20 | Spinnenseide |
| ⛏️ Mondsteinmine | 36 | Mondkristall |
| 🌉 Trollbrücke | 55 | Trollknochen |
| 🐲 Drachenhorst | 100 | Drachenschuppe (Vharzul, der Aschenfürst) |

## Darstellung

- Dorfszene als gezeichnete Vektorgrafik (Canvas, Bilderbuch-Stil mit Konturen und Verläufen) mit Tag/Nacht. Helden, die im Dorf sind, laufen herum; nachts sind sie in der Taverne.
- **Die Helden tragen sichtbar, was du ihnen verkauft hast**: Rüstungsfarbe, Helm, Kapuze oder Hut und die Waffe
  ändern sich je Stufe. Antippen öffnet die Heldenkarte mit großem Porträt.
- Rauch und Glut in der Esse, wenn gearbeitet wird; Waren im Schaufenster; Zettel am Auftragsbrett.

## Technik

- Reines HTML/CSS/JavaScript (ES-Module), kein Build-Schritt, läuft direkt auf GitHub Pages.
- `src/sim.js` ist reine Logik ohne DOM, mit deterministischem Zufall. Live-Spiel und Offline-Nachberechnung nutzen
  dieselben 1-Minuten-Schritte.
- Spielstand im `localStorage`, Export/Import als Text-Code. PWA (Manifest + Service Worker): auf den Home-Bildschirm
  legen, dann löscht iOS die Daten nicht nach 7 Tagen.
- `node tools/simulate.mjs [tage] [seed] [--log]` spielt mit einem einfachen Bot-Spieler durch (Balancing-Test).

## Ideen für später

- **Großes Ziel**: Drachensieg, Prestige (neues Dorf gründen, Bonus bleibt)
- **Weitere Quest-Arten**: Monsterjagd, Eskorte, Rettungsmission für einen verschollenen Helden
- **Beziehungen**: Freundschaften und Rivalitäten, Heldengruppen ziehen gemeinsam los
- **Mehr Ereignisse**: Drachenangriff aufs Dorf, Ketten-Ereignisse über mehrere Tage
- **Legendäre Gegenstände** mit Namen, Verzauberungen
- **Erinnerungen**: Helden merken sich, wer ihnen gute Ausrüstung verkauft hat und wo sie verletzt wurden
- Mehr Werkstätten (Alchemist, Gerberei, Runenschnitzer) und Zwischenprodukte
