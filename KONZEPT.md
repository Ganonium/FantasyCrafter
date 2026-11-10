# FantasyCrafter – Konzept

## Kernidee

Du führst den Ausrüstungsladen **„Zum Goldenen Amboss“** im Dorf **Eichenfurt**. Helden wohnen in der Taverne, kaufen
bei dir ein und ziehen auf Abenteuer. **Du schickst niemanden los.** Die Helden haben ein Eigenleben und entscheiden
selbst, ob und wohin sie gehen. Das hängt von ihrer Stärke und Ausrüstung ab, aber auch von Laune, Tagesform und
schlicht davon, ob sie „Bock“ haben.

Du beeinflusst sie nur indirekt:

- **Was du herstellst und in welcher Reihenfolge** (bessere Ausrüstung → mehr Mut → gefährlichere Gebiete)
- **Welche Kopfgelder du am Auftragsbrett aushängst** (Belohnung pro Stück für seltene Materialien)
- **Wie du das Dorf ausbaust** (Schmiede, Laden, Taverne)

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
  nachsimuliert, höchstens 24 Stunden.

## Helden mit Eigenleben

| Eigenschaft | Wirkung |
|---|---|
| **Klasse** (Krieger, Waldläufer, Magier) | kauft nur passende Waffen und Rüstungen; Waldläufer bringen mehr Beute mit, Krieger heilen schneller |
| **Stufe + Ausrüstung → Kraft** | bestimmt die Erfolgschance pro Gebiet |
| **Zwei Wesenszüge** | Mutig, Vorsichtig, Gierig, Faul, Eifrig, Ruhmsüchtig, Geizig, Spendabel, Gesellig |
| **Lieblingsgebiet / verhasstes Gebiet** | „Spinnenhöhle? Nicht für alles Gold der Welt. Ich hasse Spinnen.“ |
| **Laune** | steigt bei Erfolgen, Käufen, erfüllten Wünschen und mit Freunden in der Taverne, sinkt bei Verletzungen und Streit; wer lange schlecht gelaunt ist, verlässt das Dorf im Groll |
| **Wunsch** | ein persönliches Ziel: ein bestimmtes Ausrüstungsteil, ein Gebiet bezwingen oder ein Kopfgeld kassieren |
| **Beziehungen** | Freunde (💛) und Rivalen (⚔️) entstehen im Tavernengeplauder und auf gemeinsamen Ausflügen |
| **Tagesform** | jeden Tag neu ausgewürfelt; manche Tage hat einfach niemand Lust |
| **Gold** | eigenes Geld; davon kaufen die Helden bei dir und bezahlen die Taverne |

**Entscheidung** (alle 15–40 Spielminuten, wenn ausgeruht und nicht nachts):

1. Gibt es im Regal ein Upgrade, das sich der Held leisten kann? Dann wird gekauft. Geizige wollen danach noch einen Notgroschen übrig haben.
2. Jedes Gebiet wird bewertet: Erfolgschance × (Gold + Kopfgeld × Gier) × Vorlieben. Ein Gebiet kommt nur in Frage,
   wenn die Chance über der persönlichen Mutschwelle liegt und es nicht verhasst ist.
3. „Habe ich Bock?“: Tagesform × Laune × Fleiß, beeinflusst vom eigenen Geldbeutel und von lockenden Kopfgeldern.
4. Bleibt ein Kopfgeld liegen, **sagt der Held dir, warum**. Das erscheint in der Chronik und als Gedanke.

## Wirtschaft

- **Grundstoffe** (Eisen, Holz, Stoff, Kräuter) kauft die Werkstatt beim Herstellen automatisch beim Händler; der Preis steht am Knopf. Vorräte, z. B. von der Karawane, werden zuerst verbraucht.
- **Seltene Materialien** (Wolfsfell, Spinnenseide, Mondkristall, Trollknochen, Drachenschuppe) gibt es nur über
  Kopfgelder. Das Gold wird beim Aushängen hinterlegt und bei Lieferung an den Helden ausgezahlt.
- **Ausrüstung** in 4 Stufen je Klasse und Slot (Waffe, Rüstung); die Stufen schaltet der Schmiede-Ausbau frei.
- **Heiltränke** sind Verbrauchsgut: Bei einer Niederlage machen sie aus einer schweren Verletzung eine leichte
  (kurze Erholung, kein Goldverlust, keine zerbrochene Ausrüstung, keine Narbe) und machen Helden mutiger.
- **Feste Preise**: Der Laden verkauft immer zum fairen Preis. Dein Einfluss liegt darin, *was* du wann herstellst.
- **Ladenhüter** kann man für 50 % an den Händler verkaufen.

## Freundschaften und Rivalitäten

- Im **Tavernengeplauder** entscheidet der Ton: Freundliche Runden (Lieder, Karten, Narben vergleichen) bringen Helden
  einander näher, gereizte (Armdrücken, Streit um den Kaminplatz) treiben sie auseinander. Gesellige Helden sind
  freundlicher, Ruhmsüchtige und Helden derselben Klasse reiben sich eher.
- Ab einem gewissen Punkt werden zwei Helden **Freunde** 💛 oder **Rivalen** ⚔️, mit Eintrag in der Chronik.
- **Freunde** ziehen gemeinsam los. Zusammen sind sie stärker (Kraft des Stärkeren + 60 % des anderen) und trauen sich
  in Gebiete, die einzeln zu gefährlich wären. Sie teilen denselben Ausgang, sind gern zusammen in der Taverne und
  sorgen sich, wenn der andere verletzt heimkommt. Geht ein Freund fort, trauert der andere.
- **Rivalen** stacheln sich an: Ist der Rivale stärker, geht man mehr Risiko ein. Kauft er bessere Ausrüstung oder
  steigt auf, ärgert man sich.

## Persönliche Wünsche

Jeder Held hat (mit Pausen dazwischen) einen Wunsch, passend zu seinem Wesen: der Ruhmsüchtige will die Trollbrücke
bezwingen, der Vorsichtige wünscht sich eine bestimmte Rüstung. Der Wunsch lenkt seine
Entscheidungen (z. B. lockt das Wunsch-Gebiet). Erfüllt er sich, ist der Held überglücklich (🌟 in der Chronik).
In Werkstatt und Laden steht 🌟 an Helden, die sich genau dieses Teil wünschen – so kannst du gezielt Träume erfüllen.

## Besucher am Tresen

Tagsüber kommt etwa alle 1,5–3 Stunden ein Held zu dir an den Tresen (🙋 im Banner, ❗-Blase über dem Helden in der
Dorfszene – Antippen öffnet das Gespräch). Besucher kommen von 6 bis 22 Uhr. Bis zu drei warten gleichzeitig, jeder 12 Stunden; danach gilt die
letzte Antwort. So gibt es bei jedem kurzen Blick ins Spiel ein, zwei kleine Entscheidungen. Nach der Antwort siehst du
sofort, was passiert ist. Deine Antwort hat Folgen, oft erst später sichtbar:

| Bitte | Antworten und Folgen |
|---|---|
| 🗣️ Ein Rat unter vier Augen („Soll ich mich an die Trollbrücke wagen?“) | **Ermutigen**: Er traut sich (fast) alles zu. Siegt er, wächst sein Mut (aus Vorsicht wird Mut), scheitert er, gibt er dir die Schuld (zweimal → verbittert). **Abraten**: Er meidet das Gebiet einen Tag; Abenteuerlustige sind enttäuscht. |
| 💰 Vorschuss für ein Teil aus deinem Regal | **Vorstrecken**: Er kauft sofort und zahlt zurück, sobald er kann – oder bleibt es schuldig. **Ablehnen**: Enttäuschung. |
| 💢 Streit zweier Rivalen im Laden | **Schlichten** (eine Runde ausgeben): Sie kommen sich näher. **Anheizen**: 12 Std. Wettstreit, beide gehen mehr Risiko ein. **Raushalten**. |
| 🎓 Eine Lehre vermitteln (Junger Held ↔ Veteran) | **Vermitteln** (Lehrgeld): Der Lehrling lernt 60 % schneller und übernimmt beim Auslernen vielleicht einen Wesenszug des Lehrmeisters. |
| 📣 Frisch vom Abenteuer (erster Sieg oder knapper Ausgang) | **„Erzähl mehr!“**: bestärkt, wagt 8 Std. mehr. **Zur Vorsicht mahnen**: kauft einen Heiltrank. |
| 💛 Ein Dankeschön (dein Heiltrank, dein Rat, deine Ware) | **Annehmen** oder **eine Runde aufs Haus** (gute Laune im ganzen Dorf). |
| ⚖️ Das letzte Stück (will ein Held das letzte Exemplar kaufen und ein zweiter hätte es auch gern, wartet der Kauf auf dich) | **Einem geben**: Der eine dankt es dir, der andere merkt es sich. **Münze werfen**: gerecht. |
| 😠 Ein Wörtchen mit dir (dein Rat ging schief, du hast jemanden übergangen oder abblitzen lassen) | **Entschuldigen und Heiler bezahlen**, **„Deine Entscheidung“** (Abgehärtete respektieren das) oder **Schweigen**. |
| 🎁 Sehnsüchtige Blicke (Ausrüstung zerbrochen, kein Gold für Ersatz) | **Schenken**, **halber Preis** oder **nichts sagen**. |
| 🧪 Nicht ohne Heiltrank (will zurück an den Ort der Niederlage, ist aber blank) | **Schenken**, **anschreiben** oder **ablehnen**. |

## Erinnerungen und Verhältnis zu dir

Helden merken sich, was sie erlebt haben und wie du mit ihnen umgegangen bist (`src/memory.js`). Die Heldenkarte zeigt
unter „Verhältnis zu dir“, woran sie sich erinnern. Erinnerungen tauchen als Gedanken wieder auf und lösen Besuche aus.

- **Narbe**: Wer in einem Gebiet schwer verletzt wurde, geht dort eine Woche lang nur mit Heiltrank hin (kauft ihn
  vor dem Aufbruch bei dir) und ist drei Tage zögerlicher.
- **Vertrauen** (−100 … 100) verblasst ohne neue Erlebnisse täglich ein wenig, und Wiederholungen wirken schwächer. Es wächst durch gute Ware, gerettete Leben, guten Rat, Geschenke und Zuhören; es sinkt durch
  schlechten Rat, Abfuhren und Bevorzugung anderer.
- **Wer dir vertraut** (ab 50), bringt dir selten seltene Materialien mit. **Wer dir etwas nachträgt** (ab −30),
  kauft nur widerwillig bei dir und fragt dich nicht mehr um Rat.

## Kommen und Gehen

Helden bleiben nicht ewig (`src/farewell.js`). Wer genug erlebt hat, kommt mit dem Abschied an deinen Tresen (🎒):

- **Angekommen** (zufrieden, mindestens Stufe 8, mindestens 10 Tage im Dorf) oder **rastlos** (mindestens Stufe 10,
  14 Tage, voll ausgerüstet oder mehrfacher Drachensieger). Höchstens ein Abschied alle 40 Stunden, nie bei weniger
  als vier Helden.
- **„Bleib bei uns.“**: Der Held baut ein Häuschen (300 + 80 je Stufe Gold aus eigener Tasche; fehlt etwas, kannst du es
  dazulegen) und wird **Dorfbewohner**. Wen die Ferne ruft (ruhmsüchtig, eifrig), den hält nur echtes Vertrauen.
- **Abschiedsfest** (60 Gold): Der Held zieht in die Welt hinaus; gute Laune im Dorf, Ruf +12.
- **„Bleib noch ein paar Tage.“** (einmal, 3 Tage Aufschub) oder **„Folge deinem Herzen.“** (er entscheidet selbst).
- Wer dir vertraut, lässt beim Fortgehen etwas da (Gold, ab Vertrauen 50 seltene Materialien).
- **Verbitterte** (Vertrauen unter 10, mindestens 4 Tage) wollen im Groll gehen: Aussprache (50 Gold, die Verbitterung
  löst sich) oder gehen lassen.

**Dorfbewohner** haben eine Aufgabe mit dauerhaftem Nutzen (bis zu drei je Aufgabe zählen): Krieger werden Ausbilder
(Helden lernen 10 % schneller, Neuankömmlinge eine Stufe höher), Waldläufer Kundschafter (alle Gebiete 4 % weniger
gefährlich), Magier Kräuterkundige (Verletzungen heilen 10 %, Heiltränke brauen 15 % schneller). Sie stehen im
Hintergrund der Dorfszene, geben manchmal Bestellungen auf und sind im Tab „Dorf“ aufgeführt.

Die **Dorfchronik** (Tab „Dorf“) bewahrt jeden Helden, der einmal hier war: Stufe, Schicksal, Zeit im Dorf und die
wichtigsten Seiten seines Heldenbuchs. Ein freies Zimmer zieht bald einen neuen Helden an.

## Gedankenblasen

Über den Helden in der Dorfszene zeigt ein kleines Symbol, was sie gerade beschäftigt: 🛒 will etwas, das zu teuer ist,
😨 traut sich nicht, 🧪 braucht einen Heiltrank, 🌟 träumt vom Wunsch, 💭 erinnert sich, 💢 ärgert sich über den Rivalen,
💛 sorgt sich um einen Freund, 🍺 hat keine Lust, ❗ wartet an deinem Tresen.

## Wesenswandel

Wesenszüge sind nicht fest. Erlebnisse – und deine Entscheidungen – verändern sie (🌱 in Chronik und Heldenbuch):

| Auslöser | Wandel |
|---|---|
| drei schwere Niederlagen ohne Heiltrank (Siege lassen sie verblassen) | wird **vorsichtig** |
| dein Zuspruch hat sich ausgezahlt (bei Vorsichtigen schon einmal) | wird **mutig** |
| fünf Verletzungen | wird **abgehärtet**: heilt schneller, Niederlagen drücken die Laune weniger |
| acht echte Siege in Folge | wird **übermütig**: unterschätzt Gefahren, kauft keine Heiltränke – bis zur ersten schweren Niederlage |
| dein Rat führte zweimal ins Unglück, oder Enttäuschungen (Freund verloren) | wird **verbittert**: schlechter gelaunt, streitlustiger – heilbar durch erfüllte Träume und gute Erfahrungen |
| drei erfüllte Träume (nach ein paar Tagen im Dorf) | wird **zufrieden**: kaum noch schlecht gelaunt, aber weniger Tatendrang |
| zwei echte Freundschaften | wird **gesellig** |
| Auslernen beim Lehrmeister | übernimmt vielleicht einen Wesenszug des Lehrmeisters |

Widersprüchliche Züge fallen weg; ein Held hat höchstens drei.

## Heldenbuch

Jeder Held hat eine Lebensgeschichte (📖 auf der Heldenkarte, neueste Kapitel zuerst, nach Tagen gegliedert):
Ankunft, Käufe bei dir, erste Siege je Gebiet, Stufen, schwere Verletzungen, Rettung durch deinen Heiltrank,
zerbrochene Ausrüstung, erste Kopfgelder, Freundschaften und Rivalitäten, gemeinsame Wagnisse, erfüllte Träume,
Wesenswandel, Lehre, Vorschüsse und deine Ratschläge. Alles, wobei du deine Hand im Spiel hattest, ist mit ✋
markiert – oben steht, wie viele Kapitel du mitgeschrieben hast.

## Bericht beim Öffnen

Oben steht „Das Wichtigste“: erfüllte Träume, neue Freundschaften und Rivalitäten, Aufstiege, Kopfgeld-Lieferungen,
erledigte oder verpasste Bestellungen, Wesenswandel, die Folgen deiner Ratschläge, zurückgezahlte Vorschüsse, zerbrochene Ausrüstung, Neuankömmlinge und Abreisen, wer gerade verletzt ist –
und Hinweise, wenn die Werkstatt stillsteht oder das Regal leer ist. Darunter folgt alles der Reihe nach.

## Ereignisse

Etwa alle 3–6 Spielstunden (tagsüber) passiert im Dorf etwas, und du musst dich entscheiden. Die Wahl verändert das
Dorf meist für mehrere Stunden. Ein Ereignis wartet 6 Stunden auf dich, danach gilt die letzte Option als Vorgabe.
Aktive Einflüsse stehen als Chips unter der Dorfszene.

| Ereignis | Entscheidung |
|---|---|
| 🐪 Händlerkarawane | seltene Materialien teuer kaufen, Grundstoffe im Großeinkauf oder nichts |
| 🐺 Wolfsplage | Prämie ausloben (Finsterwald bringt 8 Std. 2,5× Gold) oder vertrösten (Finsterwald gefährlicher) |
| 🏆 Turnier | Preisgeld stiften (danach Turnierruhm: Helden trauen sich mehr zu) oder nur zuschauen; so oder so zieht ein paar Stunden niemand los |
| 🌧️ Dauerregen | Abenteuer dauern länger, die Laune sinkt; heißen Met ausschenken (Laune +10) oder abwarten |
| ⛓️ Eisenmangel | Eisen kostet 16 Std. das Dreifache; letzten Wagen zum alten Preis kaufen? |
| ⚒️ Meisterschmied | anheuern: 8 Std. lang 60 % schneller schmieden |
| 🌾 Erntefest | großes Fest (Laune hoch, aber niemand zieht los), Fass spendieren oder nichts |
| 🗺️ Schatzgerücht | Karte kaufen oder Gerücht verbreiten: ein Gebiet bringt 10 Std. viel mehr Gold |
| 🤕 Verletzter Fremder | Heiltrank geben, zum Heiler bringen (vielleicht bleibt er als Held) oder weitergehen |
| 👺 Goblin-Überfall | Helden als Wachen bezahlen, Stadtwache anfordern oder riskieren (Diebstahl) |
| 🧙‍♀️ Kräuterfrau | billige Kräuter oder ihr Rezept (Heiltränke doppelt so schnell) |
| 🎶 Barde | bezahlen, damit er bleibt: bessere Laune, mehr Neuankömmlinge |

## Bestellungen

Auftraggeber (Stadtwache, Fürstin, Kloster, Jagdmeisterin, Akademie, Kaufmannsgilde) fragen Bestellungen mit Frist an.
Du kannst sie annehmen oder ablehnen. Angenommene Bestellungen bekommen fertige Ware direkt aus der Werkstatt, sie landet
also nicht im Regal. Damit wird die **Reihenfolge in der Warteschlange** zur Entscheidung: zuerst die Bestellung oder
zuerst das Schwert, auf das ein Held wartet? Pünktliche Lieferung bringt Gold und Ruf, Verspätung kostet Ruf.
Einträge in der Warteschlange lassen sich nach vorne schieben.

## Ziele und Dorfprojekte

- **Ziele**: eine Kette von 19 Zielen (vom ersten Verkauf über den Helden in voller Drachenausrüstung bis zur gefüllten Dorfchronik) mit Belohnungen.
  Das aktuelle Ziel steht oben in der Chronik und im Dorf-Tab.
- **Dorfprojekte**: einmalige Gold-Investitionen mit dauerhaftem Bonus: Dorfbrunnen, Heilerhütte, Marktplatz,
  Wachturm, Bardenbühne, Heldendenkmal (250 bis 3.000 Gold).

## Chronik

Aufbrüche und erfolgreiche Rückkehren stehen nur in der Chronik, wenn ein Held für eines deiner Kopfgelder unterwegs
war. Gewöhnliche Ausflüge laufen still im Hintergrund; Niederlagen, Fluchten, Stufenaufstiege und zerbrochene Ausrüstung
werden immer erzählt.

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

- Dorfszene als gezeichnete Vektorgrafik (Canvas, Bilderbuch-Stil mit Konturen und Verläufen) mit Tag/Nacht. Die Helden, die gerade im Dorf sind, stehen groß im Vordergrund auf dem gepflasterten Dorfplatz (ohne Herumlaufen). Man sieht ihnen Ausrüstung, Heiltränke am Gürtel, Laune (Gesicht), Erschöpfung (sitzen mit Krug, müde Augen, Schmutz; nachts schlafend) und Verletzungen (Verbände, Armschlinge, Blutergüsse) an.
- **Die Helden tragen sichtbar, was du ihnen verkauft hast**: Rüstungsfarbe, Helm, Kapuze oder Hut und die Waffe
  ändern sich je Stufe. Antippen öffnet die Heldenkarte mit großem Porträt.
- Errichtete Dorfprojekte stehen sichtbar im Dorf (Brunnen, Zelt der Heilerin, Marktkarren, Wachturm, Bühne, Denkmal);
  Regen, Feste (Wimpelkette) und Musik sind in der Szene zu sehen.
- Verletzungen: leicht (Kopfverband, Schrammen) nach einer Niederlage mit Heiltrank, schwer (Schlinge, Verbände, blass) ohne.
- Rauch und Glut in der Esse, wenn gearbeitet wird; Waren im Schaufenster; Zettel am Auftragsbrett.

## Technik

- Reines HTML/CSS/JavaScript (ES-Module), kein Build-Schritt, läuft direkt auf GitHub Pages.
- `src/sim.js` ist reine Logik ohne DOM, mit deterministischem Zufall. Live-Spiel und Offline-Nachberechnung nutzen
  dieselben 1-Minuten-Schritte.
- Spielstand im `localStorage`, Export/Import als Text-Code. PWA (Manifest + Service Worker): auf den Home-Bildschirm
  legen, dann löscht iOS die Daten nicht nach 7 Tagen.
- `node tools/simulate.mjs [tage] [seed] [--log]` spielt mit einem einfachen Bot-Spieler durch (Balancing-Test).

## Ideen für später

- **Großes Ziel**: der Drache als einmaliges Finale, danach ein neues Kapitel (Dorfchronik bleibt)
- **Wohin mit dem Gold**: Der Spieler häuft im späten Spiel viel Gold an, für das es noch kein Ziel gibt
- **Weitere Quest-Arten**: Monsterjagd, Eskorte, Rettungsmission für einen verschollenen Helden
- **Mehr Beziehungen**: Liebe, Lehrer und Schüler, Gruppen aus mehr als zwei Helden
- **Mehr Ereignisse**: Drachenangriff aufs Dorf, Ketten-Ereignisse über mehrere Tage
- **Legendäre Gegenstände** mit Namen, Verzauberungen
- Mehr Werkstätten (Alchemist, Gerberei, Runenschnitzer) und Zwischenprodukte
