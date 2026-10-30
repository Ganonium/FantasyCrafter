// Erzähltexte für die Chronik und die Gedanken der Helden.
// Platzhalter: {n} Name, {er}/{Er} Pronomen, {ihm}, {A} Gebiet ({zu}/{in}/{In}/{aus} mit Präposition), {F} Gegner (Akkusativ, nur nach „gegen“), {M} Material, {x} frei, {o} anderer Held

export function fmt(tpl, hero, vars = {}) {
  const f = hero?.female;
  const map = {
    n: hero ? `**${hero.name}**` : '',
    er: f ? 'sie' : 'er', Er: f ? 'Sie' : 'Er',
    ihm: f ? 'ihr' : 'ihm', ihn: f ? 'sie' : 'ihn',
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
  ],
  departBounty: [
    '{n} reißt einen Zettel vom Auftragsbrett und zieht {zu}. „{M}? Bring ich mit.“',
    'Das Kopfgeld auf {M} lässt {n} nicht los – {er} zieht {zu}.',
    '{n} zählt im Kopf schon das Kopfgeld und marschiert {zu}.',
  ],
  departBrave: [
    '{n} zieht {zu}. Die anderen in der Taverne werden still.',
    '„Wenn ich nicht zurückkomme, gehört mein Bierkrug dir“, sagt {n} und zieht {zu}.',
  ],
  success: [
    '{n} kehrt {aus} zurück. Der Kampf gegen {F} war ein Kinderspiel.',
    '{n} ist zurück {aus} – staubig, aber zufrieden.',
    'Erfolg {in}! {n} erzählt in der Taverne vom Kampf gegen {F} – mit jedem Schluck etwas heldenhafter.',
    '{n} kommt pfeifend {aus} zurück.',
  ],
  successClose: [
    '{n} hat es {in} gerade so geschafft. „Das war knapp.“',
    'Mit zerrissenem Umhang, aber siegreich kehrt {n} {aus} heim.',
  ],
  escape: [
    '{In} wurde es brenzlig. {n} trank einen Heiltrank und konnte sich zurückziehen.',
    'Gegen {F} hatte {n} keine Chance – der Heiltrank hat {ihm} wohl das Leben gerettet.',
  ],
  fail: [
    'Der Kampf gegen {F} ging schief: {n} schleppt sich verwundet {aus} zurück.',
    'Schlechte Nachrichten: {n} wurde {in} übel zugerichtet und muss sich auskurieren.',
    '{n} humpelt ins Dorf. „Fragt nicht.“ ({A})',
  ],
  // Unterwegs-Geschichten je Gebiet (werden bei Rückkehr zufällig eingeflochten)
  story: {
    kornfelder: [
      '{n} jagt eine Feldgoblin-Bande durch die Ähren.',
      'Eine Bäuerin schenkt {n} einen Laib Brot für die Hilfe gegen die Ratten.',
      '{n} findet eine Vogelscheuche, die verdächtig nach einem Goblin aussieht. Sie war ein Goblin.',
    ],
    finsterwald: [
      'Im Finsterwald heult ein Rudel. {n} hält die Waffe fester.',
      '{n} folgt Wolfsspuren bis zu einem alten Hügelgrab.',
      'Ein Irrlicht versucht {n} vom Pfad zu locken – vergeblich.',
    ],
    spinnenhoehle: [
      '{n} schneidet sich durch Netze, so dick wie Seile.',
      'Etwas Großes krabbelt über die Decke der Spinnenhöhle. {n} schaut lieber nicht hin.',
      '{n} findet einen eingesponnenen Abenteurer – leider schon lange tot.',
    ],
    mondmine: [
      'In der Mondsteinmine leuchten die Wände bläulich. {n} hört Kobolde kichern.',
      'Ein Steingolem versperrt {n} den Stollen.',
      '{n} entdeckt eine Ader voller schimmernder Kristalle.',
    ],
    trollbruecke: [
      'Der Brückentroll verlangt Zoll. {n} zahlt mit Stahl.',
      '{n} versucht es mit einem Rätsel. Der Troll versteht die Frage nicht und greift an.',
      'Unter der Trollbrücke liegen Knochen. Viele Knochen.',
    ],
    drachenhorst: [
      'Am Drachenhorst ist die Luft heiß wie in einer Esse. {n} schluckt trocken.',
      'Vharzul, der Aschenfürst, öffnet ein Auge. {n} hält den Atem an.',
      '{n} klettert über Berge aus geschmolzenem Gold.',
    ],
  },
  levelUp: [
    '{n} ist jetzt Stufe {x}. In der Taverne gibt {er} eine Runde aus.',
    '{n} wird erfahrener – Stufe {x}!',
  ],
  buy: [
    '{n} kauft {x} und betrachtet das gute Stück stolz.',
    '{n} legt das Gold auf den Tresen und nimmt {x} mit.',
    '{n} probiert {x} an. Passt wie angegossen.',
  ],
  buyCheap: ['{n} kauft {x} und kann sein Glück kaum fassen. „Zu dem Preis? Gekauft!“'],
  buyExpensive: ['{n} zahlt zähneknirschend für {x}. „Halsabschneider.“'],
  buyPotion: ['{n} steckt einen Heiltrank ein.', '{n} kauft vorsichtshalber einen Heiltrank.'],
  deliver: [
    '{n} liefert {x} am Auftragsbrett ab und kassiert das Kopfgeld.',
    '{n} legt {x} auf deinen Tresen. „Das Kopfgeld, bitte.“',
  ],
  arrive: [
    '{n} kommt ins Dorf und mietet ein Zimmer in der Taverne.',
    'Ein neues Gesicht: {n} sucht hier nach Arbeit und Abenteuern.',
    '{n} trifft mit staubigem Mantel in Eichenfurt ein.',
  ],
  leave: [
    '{n} hat genug. „Dieses Dorf bringt mir kein Glück.“ {Er} zieht weiter.',
    '{n} packt die Sachen und verlässt Eichenfurt – schlecht gelaunt.',
  ],
  banter: [
    '{n} und {o} streiten in der Taverne, wer den größeren Wolf erlegt hat.',
    '{n} fordert {o} zum Armdrücken heraus. Der Wirt nimmt Wetten an.',
    '{n} erzählt {o} eine Geschichte über den Drachen. {o} glaubt kein Wort.',
    '{n} und {o} singen ein Lied. Schief, aber laut.',
    '{n} leiht {o} ein paar Goldstücke. Ob {er} die wiedersieht?',
    '{n} und {o} vergleichen ihre Narben.',
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
  away: ['Unterwegs {in}.'],
  wantItem: ['{x} wäre was für mich – aber {p} Gold hab ich nicht.'],
  tooExpensive: ['{x} für {p} Gold? Wucher!', '{x} gefällt mir, aber nicht zu dem Preis.'],
  going: ['Los geht\'s – {zu}!', 'Ich zieh {zu}. Bis später!'],
  goingBounty: ['Das Kopfgeld auf {M} hol ich mir!'],
};
