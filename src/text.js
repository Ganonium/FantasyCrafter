// Erzähltexte für die Chronik und die Gedanken der Helden.
// Platzhalter: {n} Name, {er}/{Er} Pronomen, {ihm}, {ihn}, {sein} (sein/ihr), {A} Gebiet ({zu}/{in}/{In}/{aus} mit Präposition),
// {F} Gegner (Akkusativ, nur nach „gegen“), {M} Material, {x} frei, {o} anderer Held
// Die Simulation wählt Varianten so, dass sich dieselbe Zeile nicht direkt wiederholt.

export function fmt(tpl, hero, vars = {}) {
  const f = hero?.female;
  const map = {
    n: hero ? `**${hero.name}**` : '',
    er: f ? 'sie' : 'er', Er: f ? 'Sie' : 'Er',
    ihm: f ? 'ihr' : 'ihm', ihn: f ? 'sie' : 'ihn', sein: f ? 'ihr' : 'sein', Sein: f ? 'Ihr' : 'Sein',
    ...vars,
  };
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in map ? map[k] : `{${k}}`));
}

export const T = {
  depart: [
    '{n} schnürt die Stiefel und zieht {zu}.',
    '{n} verlässt das Dorf Richtung {A}.',
    'Mit einem letzten Schluck Met zieht {n} los – Ziel: {A}.',
    '{n} winkt dem Wirt zu und macht sich auf den Weg – {zu}.',
    '{n} schultert das Bündel. „Bis heute Abend!“ – und weg ist {er}, {zu}.',
    '{n} prüft noch einmal die Ausrüstung und zieht {zu}.',
    'Der Hufschmied sieht {n} am Tor vorbeigehen – {zu}, wie es aussieht.',
    '{n} wirft eine Münze. Kopf. Also {zu}.',
  ],
  departMorning: [
    'Noch bevor der Hahn kräht, ist {n} schon unterwegs {zu}.',
    'Im Morgennebel zieht {n} {zu}.',
    '{n} schnappt sich ein Stück Brot vom Frühstückstisch und zieht {zu}.',
  ],
  departEvening: [
    'Trotz der späten Stunde zieht {n} noch {zu}.',
    'Im Abendrot macht sich {n} auf {zu}. „Nachts schlafen die Monster eh.“',
    'Die Laternen werden angezündet, als {n} {zu} aufbricht.',
  ],
  departBounty: [
    '{n} reißt einen Zettel vom Auftragsbrett und zieht {zu}. „{M}? Bring ich mit.“',
    'Das Kopfgeld auf {M} lässt {n} nicht los – {er} zieht {zu}.',
    '{n} zählt im Kopf schon das Kopfgeld und marschiert {zu}.',
    '„{M}, sagst du? Wie viel?“ {n} hört die Antwort und ist schon zur Tür hinaus – {zu}.',
    '{n} faltet den Kopfgeld-Zettel sorgfältig und steckt ihn ein. Ziel: {A}.',
  ],
  departBrave: [
    '{n} zieht {zu}. Die anderen in der Taverne werden still.',
    '„Wenn ich nicht zurückkomme, gehört mein Bierkrug dir“, sagt {n} und zieht {zu}.',
    '{n} küsst das Glücksamulett und zieht {zu}. Mutig – oder dumm.',
    'Der Wirt schüttelt den Kopf, als {n} {zu} aufbricht.',
  ],
  departTreasure: [
    '{n} hat vom Schatz gehört und ist schon unterwegs {zu}.',
    '„Ein Schatz? {In}? Ich bin dabei!“ – {n} zieht los.',
    '{n} rennt fast {zu}. Das Gerücht hat {ihn} gepackt.',
  ],
  success: [
    '{n} kehrt {aus} zurück. Der Kampf gegen {F} war ein Kinderspiel.',
    '{n} ist zurück {aus} – staubig, aber zufrieden.',
    'Erfolg {in}! {n} erzählt in der Taverne vom Kampf gegen {F} – mit jedem Schluck etwas heldenhafter.',
    '{n} kommt pfeifend {aus} zurück.',
    '{n} wirft einen prall gefüllten Beutel auf den Tavernentisch. Der Ausflug {zu} hat sich gelohnt.',
    'Ohne einen Kratzer kehrt {n} {aus} heim.',
    '{n} ist zurück und verlangt nach einem Bad. Und Met. Vor allem Met.',
    '„Die Gegend {in} ist jetzt etwas sicherer“, verkündet {n} beim Abendessen.',
  ],
  successClose: [
    '{n} hat es {in} gerade so geschafft. „Das war knapp.“',
    'Mit zerrissenem Umhang, aber siegreich kehrt {n} {aus} heim.',
    '{n} kommt zurück, mit einer neuen Narbe und einer guten Geschichte.',
    '{n} hat gewonnen, sieht aber aus, als hätte {er} verloren.',
  ],
  escape: [
    '{In} wurde es brenzlig. {n} trank einen Heiltrank und konnte sich zurückziehen.',
    'Gegen {F} hatte {n} keine Chance – der Heiltrank hat {ihm} wohl das Leben gerettet.',
    '{n} kehrt mit leerem Trankfläschchen zurück. „Ohne das Ding wär ich jetzt tot.“',
  ],
  fail: [
    'Der Kampf gegen {F} ging schief: {n} schleppt sich verwundet {aus} zurück.',
    'Schlechte Nachrichten: {n} wurde {in} übel zugerichtet und muss sich auskurieren.',
    '{n} humpelt ins Dorf. „Fragt nicht.“ ({A})',
    'Ein Bauer bringt {n} auf dem Heuwagen zurück ins Dorf. Ein Ausflug {zu}, der schiefging.',
    '{n} ist zurück, mit Verband und schlechter Laune. Gegen {F} war heute nichts zu holen.',
  ],
  // Unterwegs-Geschichten je Gebiet (werden bei Rückkehr eingeflochten)
  story: {
    kornfelder: [
      '{n} jagt eine Feldgoblin-Bande durch die Ähren.',
      'Eine Bäuerin schenkt {n} einen Laib Brot für die Hilfe gegen die Ratten.',
      '{n} findet eine Vogelscheuche, die verdächtig nach einem Goblin aussieht. Sie war ein Goblin.',
      'Ein wütender Hofhund hält {n} für einen Dieb. Es wird ein längeres Gespräch.',
      '{n} hilft beim Heuwenden und vergisst kurz, warum {er} eigentlich da ist.',
      'Ein Goblin bietet {n} einen gestohlenen Kürbis als Bestechung an.',
    ],
    finsterwald: [
      'Im Finsterwald heult ein Rudel. {n} hält die Waffe fester.',
      '{n} folgt Wolfsspuren bis zu einem alten Hügelgrab.',
      'Ein Irrlicht versucht {n} vom Pfad zu locken – vergeblich.',
      '{n} begegnet einem Köhler, der seltsame Geschichten über weiße Wölfe erzählt.',
      'Ein Ast knackt. {n} fährt herum – nur ein Reh. Diesmal.',
      '{n} findet einen verlassenen Jägerhochsitz mit Blick über den ganzen Wald.',
    ],
    spinnenhoehle: [
      '{n} schneidet sich durch Netze, so dick wie Seile.',
      'Etwas Großes krabbelt über die Decke der Spinnenhöhle. {n} schaut lieber nicht hin.',
      '{n} findet einen eingesponnenen Abenteurer – leider schon lange tot.',
      'In der Spinnenhöhle tropft es von der Decke. {n} hofft, dass es Wasser ist.',
      '{n} tritt auf ein Spinnenei. Es knackt. Irgendwo zischt etwas.',
      'Acht leuchtende Augen beobachten {n} aus der Dunkelheit.',
    ],
    mondmine: [
      'In der Mondsteinmine leuchten die Wände bläulich. {n} hört Kobolde kichern.',
      'Ein Steingolem versperrt {n} den Stollen.',
      '{n} entdeckt eine Ader voller schimmernder Kristalle.',
      'Eine Lore rollt von allein an {n} vorbei. In der Mine spukt es.',
      'Kobolde haben {n} die Stiefel zusammengebunden. Witzig.',
      '{n} folgt einem leisen Singen tiefer in die Mine – und kehrt schnell wieder um.',
    ],
    trollbruecke: [
      'Der Brückentroll verlangt Zoll. {n} zahlt mit Stahl.',
      '{n} versucht es mit einem Rätsel. Der Troll versteht die Frage nicht und greift an.',
      'Unter der Trollbrücke liegen Knochen. Viele Knochen.',
      'Zwei Trolle streiten, wer {n} fressen darf. {n} nutzt die Gelegenheit.',
      'Der Troll riecht {n}, bevor er {ihn} sieht. Umgekehrt genauso.',
      '{n} findet unter der Brücke den Helm eines Ritters, der vor hundert Jahren hier vorbeiwollte.',
    ],
    drachenhorst: [
      'Am Drachenhorst ist die Luft heiß wie in einer Esse. {n} schluckt trocken.',
      'Vharzul, der Aschenfürst, öffnet ein Auge. {n} hält den Atem an.',
      '{n} klettert über Berge aus geschmolzenem Gold.',
      'Asche regnet vom Himmel. {n} zieht sich das Tuch vors Gesicht.',
      'Ein Brüllen lässt den Berg erzittern. {n} betet zu Göttern, die {er} gar nicht kennt.',
      '{n} findet eine Schuppe, so groß wie ein Schild – noch warm.',
    ],
  },
  // Nachsätze passend zu Wesenszügen
  traitFlavor: {
    gierig: ['{n} zählt die Beute zweimal nach. Dann ein drittes Mal.', '{n} beißt auf jede Münze, ob sie echt ist.'],
    faul: ['{n} lässt sich in den nächstbesten Stuhl fallen. „Morgen mach ich nix.“', '{n} schläft am Tavernentisch ein, bevor das Bier kommt.'],
    eifrig: ['{n} poliert schon wieder die Waffe. „Wann geht\'s weiter?“', '{n} hat die Stiefel noch nicht ausgezogen und plant schon den nächsten Ausflug.'],
    ruhmsuechtig: ['{n} erzählt die Geschichte zum fünften Mal. Diesmal waren es zwölf Gegner.', '{n} fragt den Barden, ob er schon ein Lied über {ihn} geschrieben hat.'],
    gesellig: ['{n} gibt eine Runde aus. Die Taverne jubelt.', '{n} hat für jeden in der Taverne eine Geschichte.'],
    geizig: ['{n} versteckt das Gold unter der Matratze.', '{n} feilscht mit dem Wirt um den Preis eines Bieres.'],
    vorsichtig: ['{n} trägt die Erlebnisse sorgfältig ins Tagebuch ein. „Nächstes Mal mehr Heiltränke.“'],
    mutig: ['„War doch gar nicht so schlimm“, sagt {n}, während der Heiler die Wunden näht.'],
    spendabel: ['{n} wirft dem Bettler am Tor eine Goldmünze zu.'],
  },
  levelUp: [
    '{n} ist jetzt Stufe {x}. In der Taverne gibt {er} eine Runde aus.',
    '{n} wird erfahrener – Stufe {x}!',
    'Stufe {x}! {n} fühlt sich unbesiegbar. Fast.',
    '{n} hat dazugelernt und erreicht Stufe {x}.',
  ],
  buy: [
    '{n} kauft {x} und betrachtet das gute Stück stolz.',
    '{n} legt das Gold auf den Tresen und nimmt {x} mit.',
    '{n} probiert {x} an. Passt wie angegossen.',
    '{n} hat lange auf {x} gespart. Heute ist es so weit.',
    '{n} schwingt {x} probehalber durch den Laden. Fast wäre ein Regal umgefallen.',
    '„Das nehm ich!“ {n} zeigt auf {x}.',
  ],
  buyCheap: [
    '{n} kauft {x} und kann {sein} Glück kaum fassen. „Zu dem Preis? Gekauft!“',
    '{n} schlägt bei {x} sofort zu. „Ein Schnäppchen!“',
  ],
  buyExpensive: [
    '{n} zahlt zähneknirschend für {x}. „Halsabschneider.“',
    '{n} kauft {x}, murmelt aber etwas von „Raubrittern“.',
  ],
  buyPotion: ['{n} steckt einen Heiltrank ein.', '{n} kauft vorsichtshalber einen Heiltrank.', '{n} lässt sich einen Heiltrank einpacken. „Man weiß ja nie.“'],
  deliver: [
    '{n} liefert {x} am Auftragsbrett ab und kassiert das Kopfgeld.',
    '{n} legt {x} auf deinen Tresen. „Das Kopfgeld, bitte.“',
    '{n} kippt {x} aus dem Sack. „Wie bestellt.“',
    'Stolz präsentiert {n} {x} – und hält die Hand auf.',
  ],
  refuseIntro: [
    '{n} wirft einen Blick aufs Auftragsbrett:',
    '{n} liest das Kopfgeld und schüttelt den Kopf:',
    'In der Taverne fragt jemand {n} nach dem Kopfgeld. Die Antwort:',
    '{n} tippt auf den Zettel am Brett:',
  ],
  arrive: [
    '{n} kommt ins Dorf und mietet ein Zimmer in der Taverne.',
    'Ein neues Gesicht: {n} sucht hier nach Arbeit und Abenteuern.',
    '{n} trifft mit staubigem Mantel in Eichenfurt ein.',
    '{n} hat von deinem Laden gehört und will sich hier niederlassen.',
    'Mit einer Postkutsche kommt {n} in Eichenfurt an.',
  ],
  leave: [
    '{n} hat genug. „Dieses Dorf bringt mir kein Glück.“ {Er} zieht weiter.',
    '{n} packt die Sachen und verlässt Eichenfurt – schlecht gelaunt.',
    '{n} ist fort. Auf dem Kopfkissen liegt ein Zettel: „Nie wieder.“',
  ],
  banter: [
    '{n} und {o} streiten in der Taverne, wer den größeren Wolf erlegt hat.',
    '{n} fordert {o} zum Armdrücken heraus. Der Wirt nimmt Wetten an.',
    '{n} erzählt {o} eine Geschichte über den Drachen. {o} glaubt kein Wort.',
    '{n} und {o} singen ein Lied. Schief, aber laut.',
    '{n} leiht {o} ein paar Goldstücke. Ob {er} die wiedersieht?',
    '{n} und {o} vergleichen ihre Narben.',
    '{n} verliert beim Würfeln gegen {o} und behauptet, die Würfel seien gezinkt.',
    '{n} und {o} planen einen gemeinsamen Ausflug. Nach dem dritten Bier wird der Plan sehr ehrgeizig.',
    '{n} bringt {o} einen neuen Trick mit der Waffe bei.',
    '{n} schnarcht. {o} wirft einen Stiefel.',
    '{n} und {o} wetten, wer zuerst den Drachen besiegt.',
    '{n} schwärmt {o} von deinem Laden vor.',
  ],
  craftDone: ['In der Schmiede ist {x} fertig geworden.'],
  shelfFull: ['{x} ist fertig, aber das Regal ist voll!'],
};

// Gedanken (direkte Rede, ohne Namen)
export const THOUGHTS = {
  night: ['Zzz …', 'Nachts zieht doch niemand los.', 'Morgen früh vielleicht.'],
  tooDangerous: [
    '{A}? Mit dieser Ausrüstung? Da bräuchte ich schon Besseres.',
    'Das Kopfgeld auf {M} ist verlockend, aber {in} wär ich Futter.',
    '{A}? Ich häng an meinem Leben.',
    'Erst bessere Ausrüstung, dann reden wir über {A}.',
  ],
  tooDangerousNoGear: ['Mit einem Knüppel {zu}? Ganz sicher nicht.'],
  hated: [
    '{A}? Nicht für alles Gold der Welt.',
    'Keine zehn Pferde kriegen mich {zu}.',
  ],
  hatedSpider: ['Spinnenhöhle? Nicht für alles Gold der Welt. Ich hasse Spinnen.'],
  lazy: ['Heute nicht. Der Met ist zu gut.', 'Vielleicht später …', 'Ich ruh mich noch ein bisschen aus.',
    'Kein Bock heute.', 'Erst mal frühstücken.'],
  rich: ['Ich hab genug Gold für eine Weile.'],
  moody: ['Lass mich in Ruhe.', 'Was für ein Mistdorf.'],
  resting: ['Endlich ein Bett.', 'Noch ein Krug, dann geht\'s wieder.'],
  injured: ['Au. Alles tut weh.', 'Der Heiler sagt, noch ein paar Stunden.'],
  staying: ['{x}! Da bleib ich natürlich hier.', 'Heute nicht – {x}.'],
  away: ['Unterwegs {in}.'],
  wantItem: ['{x} wäre was für mich – aber {p} Gold hab ich nicht.'],
  tooExpensive: ['{x} für {p} Gold? Wucher!', '{x} gefällt mir, aber nicht zu dem Preis.'],
  going: ['Los geht\'s – {zu}!', 'Ich zieh {zu}. Bis später!'],
  goingBounty: ['Das Kopfgeld auf {M} hol ich mir!'],
};
