// Die große Bedrohung: das Finale eines Kapitels. Ein Ungeheuer kündigt sich an, das Dorf hat zwei Tage Zeit,
// sich zu rüsten – und dann stellen sich die Helden gemeinsam. Hier hat auch dein angespartes Gold ein Ziel.
// Nach einem Sieg beginnt ein neues Kapitel; irgendwann regt sich die nächste Gefahr.
//
// s.threat  = { id, name, strength, deadline, prep: { id: true }, attempt, announcedAt, wavered }
// s.deeds   = [{ id, name, icon, day, outcome, leader, fighters, attempts }]  („Große Taten“ in der Dorfchronik)
// s.chapter = Zahl der bezwungenen Bedrohungen

import { fmt } from './text.js';
import { log, changeMood, heroPower, isNight, xpNeeded } from './sim.js';
import { bio, bump } from './life.js';
import { remember, changeTrust } from './memory.js';
import { villagers } from './farewell.js';
import { addVisitor } from './requests.js';

const H = 60;
const DAY = 1440;
const WARNING = 2 * DAY; // so lange hat das Dorf Zeit, sich zu rüsten
const first = (h) => h.name.split(' ')[0];
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// Reihenfolge der Bedrohungen; danach beginnt die Liste mit stärkeren Nachfahren von vorn
export const THREATS = [
  {
    id: 'vharzul', name: 'Vharzul, der Aschenfürst', short: 'Vharzul', acc: 'Vharzul, den Aschenfürsten', dat: 'Vharzul, dem Aschenfürsten', icon: '🐲',
    title: (f) => (f ? 'Drachentöterin' : 'Drachentöter'),
    omen: 'Der Drachenhorst speit Feuer in den Nachthimmel. Vharzul, der Aschenfürst, ist erwacht – zu oft hat man ihn in seinem Hort gestört. ' +
      'In zwei Tagen wird er über Eichenfurt kommen.',
    win: 'Mit einem Schrei, der die Fensterscheiben zerspringen lässt, stürzt Vharzul in die Wiesen vor dem Dorf. Stille. Dann Jubel.',
  },
  {
    id: 'frostwurm', name: 'der Frostwurm vom Nordpass', short: 'der Frostwurm', acc: 'den Frostwurm vom Nordpass', dat: 'dem Frostwurm vom Nordpass', icon: '🐍',
    title: (f) => (f ? 'Wurmbezwingerin' : 'Wurmbezwinger'),
    omen: 'Mitten im Jahr liegt Reif auf den Feldern. Händler vom Nordpass berichten von einem Wurm aus Eis, der sich talwärts frisst. ' +
      'In zwei Tagen erreicht er Eichenfurt.',
    win: 'Der Frostwurm zerbirst wie ein gefrorener See im Frühling. Tauwasser läuft durch die Gassen, und die Sonne kommt heraus.',
  },
  {
    id: 'trollkoenig', name: 'Grumbar, König der Brückentrolle', short: 'Grumbar', acc: 'Grumbar, den König der Brückentrolle', dat: 'Grumbar, dem König der Brückentrolle', icon: '👹',
    title: (f) => (f ? 'Königsbezwingerin' : 'Königsbezwinger'),
    omen: 'Trommeln von der Trollbrücke, Tag und Nacht. Grumbar, König der Brückentrolle, hat seine Sippe gesammelt und fordert Wegzoll: das ganze Dorf. ' +
      'In zwei Tagen steht er am Tor.',
    win: 'Grumbar fällt wie ein Baum. Seine Sippe sieht es, lässt die Keulen fallen und rennt bis hinter die Berge.',
  },
  {
    id: 'spinnenmutter', name: 'die Mutter der tausend Spinnen', short: 'die Spinnenmutter', acc: 'die Mutter der tausend Spinnen', dat: 'der Mutter der tausend Spinnen', icon: '🕷️',
    title: (f) => (f ? 'Netzzerreißerin' : 'Netzzerreißer'),
    omen: 'Über Nacht sind die Bäume am Waldrand in weiße Schleier gehüllt. Aus der Spinnenhöhle kriecht etwas Großes ans Licht. ' +
      'In zwei Tagen hat es das Dorf eingesponnen.',
    win: 'Die Spinnenmutter zieht die Beine an und regt sich nicht mehr. Die Netze über dem Dorf zerfallen im Wind zu Staub.',
  },
];

// Vorbereitungen: Hier fließt dein Gold hin. cost wird je Kapitel teurer.
export const PREPS = {
  schmiede: { name: 'Klingen schärfen, Rüstungen flicken', icon: '🔥', cost: 800, power: 0.15, desc: 'Alle Kämpfer +15 % Stärke.' },
  traenke: { name: 'Heiltränke für alle Kämpfer', icon: '🧪', cost: 1200, power: 0.05, desc: 'Verletzungen im Kampf fallen leichter aus.' },
  palisade: { name: 'Palisaden und Löscheimer', icon: '🛡️', cost: 2000, power: 0, desc: 'Geht es schief, nimmt das Dorf nur halb so viel Schaden.' },
  ballista: { name: 'Eine Ballista auf dem Dorfplatz', icon: '🏹', cost: 3500, power: 0.35, desc: '+35 % Stärke. Der Bolzen ist so lang wie ein Mann.' },
};

export function threatDef(s, t = s.threat) {
  return t ? THREATS.find((x) => x.id === t.id) : null;
}

export function prepCost(s, id) {
  return Math.round((PREPS[id].cost * Math.pow(1.5, s.chapter ?? 0)) / 50) * 50;
}

export function buyPrep(s, id) {
  const t = s.threat;
  if (!t || t.prep[id] || s.gold < prepCost(s, id)) return false;
  s.gold -= prepCost(s, id);
  t.prep[id] = true;
  log(s, 'threat', `${PREPS[id].icon} Du lässt vorbereiten: **${PREPS[id].name}**.`);
  return true;
}

// Wer würde kämpfen, wenn es jetzt losginge? expected: auch wer noch unterwegs ist und rechtzeitig zurück sein dürfte
export function fighters(s, expected = false) {
  return s.heroes.filter((h) => (h.state !== 'away' || (expected && !h.missing && h.until < (s.threat?.deadline ?? 0)))
    && !(h.state === 'injured' && h.wound !== 'light') && h.threatRole !== 'guard');
}

export function guards(s) {
  return s.heroes.filter((h) => h.state !== 'away' && h.threatRole === 'guard');
}

// Stärke des Dorfes: Kraft der Kämpfer, Vorbereitungen, Rückhalt durch Dorfbewohner, Kampfmoral
export function villageStrength(s, expected = false) {
  const t = s.threat;
  const fs = fighters(s, expected);
  if (!fs.length) return 0;
  const power = fs.reduce((sum, h) => sum + heroPower(h), 0);
  const prep = Object.keys(t?.prep ?? {}).reduce((sum, id) => sum + PREPS[id].power, 0);
  const morale = 0.9 + (fs.reduce((sum, h) => sum + h.mood, 0) / fs.length) / 500; // 0,9 … 1,1
  const backing = 1 + Math.min(6, villagers(s).length) * 0.03;
  return Math.round(power * (1 + prep) * morale * backing);
}

// Einschätzung für die Anzeige
export function threatOdds(s) {
  const ratio = villageStrength(s, true) / s.threat.strength;
  if (ratio >= 1.3) return { ratio, text: 'Das Dorf ist gut gerüstet', cls: 'ok' };
  if (ratio >= 1.0) return { ratio, text: 'Es wird ein harter Kampf', cls: '' };
  if (ratio >= 0.75) return { ratio, text: 'Es sieht nicht gut aus', cls: 'bad' };
  return { ratio, text: 'Ohne mehr Hilfe ist das Dorf verloren', cls: 'bad' };
}

function announce(s, r, def, { returning = false, strength = null } = {}) {
  // Die Gefahr misst sich am Dorf: Sie ist immer eine echte Prüfung für die, die gerade da sind
  const total = s.heroes.reduce((sum, h) => sum + heroPower(h), 0);
  const scaled = Math.round(total * (1.25 + 0.1 * Math.min(4, s.chapter ?? 0)));
  const prev = s.threat;
  s.threat = {
    id: def.id, strength: strength ?? Math.max(120, scaled), deadline: s.t + WARNING, prep: prev?.prep ?? {},
    attempt: (prev?.attempt ?? 0) + 1, announcedAt: s.t, wavered: false, gathered: false,
  };
  for (const h of s.heroes) h.threatRole = null;
  log(s, 'threat', returning
    ? `${def.icon} **${cap(def.short)}** ist zurück – verwundet, aber wütender denn je. In zwei Tagen kommt es zur Entscheidung.`
    : `${def.icon} ${def.omen}`, null, { omen: true });
}

function finish(s, r) {
  s.threat = null;
  for (const h of s.heroes) h.threatRole = null;
}

function wound(s, r, h, heavy) {
  h.state = 'injured';
  h.wound = heavy ? 'heavy' : 'light';
  h.until = s.t + (heavy ? r.int(240, 420) : r.int(60, 150));
  h.thought = heavy ? 'Wir haben … es geschafft? Sagt mir, dass wir es geschafft haben.' : 'Nur ein Kratzer. Hast du gesehen, wie ich …?';
  h.thoughtIcon = null;
}

// Der große Kampf
function battle(s, r) {
  const t = s.threat;
  const def = threatDef(s);
  const fs = fighters(s);
  const gs = guards(s);
  const day = Math.floor((s.clock0 + s.clockOffset + s.t) / DAY) + 1;
  const score = fs.length ? (villageStrength(s) / t.strength) * r.range(0.88, 1.12) : 0;
  const outcome = score >= 1.25 ? 'triumph' : score >= 0.97 ? 'victory' : score >= 0.72 ? 'repelled' : 'defeat';
  const slain = outcome === 'triumph' || outcome === 'victory';
  const potions = !!t.prep.traenke;
  const leader = fs.slice().sort((a, b) => heroPower(b) - heroPower(a))[0] ?? null;

  // Die Kämpfer: Wunden, Ruhm, Erinnerungen
  const heavyShare = { triumph: 0, victory: 0.2, repelled: 0.35, defeat: 0.6 }[outcome];
  const lightShare = { triumph: 0.25, victory: 0.5, repelled: 0.5, defeat: 0.4 }[outcome];
  for (const h of fs) {
    const roll = r();
    const heavy = roll < heavyShare * (potions ? 0.3 : 1);
    if (heavy || roll < heavyShare + lightShare) wound(s, r, h, heavy);
    if (slain) {
      changeMood(h, 25); bump(h, 'joy'); changeTrust(h, 6);
      remember(s, h, 'greatDeed', { foe: def.acc });
      h.xp += Math.round(xpNeeded(h.level) * 0.5);
      bio(s, h, def.icon, `Stand gegen ${def.acc} – und siegte.`, Object.keys(t.prep).length > 0);
    } else {
      changeMood(h, outcome === 'defeat' ? -15 : -5);
      bio(s, h, def.icon, outcome === 'defeat' ? `Wurde von ${def.dat} geschlagen.` : `Trieb ${def.acc} in die Flucht.`);
    }
  }
  for (const h of gs) { changeMood(h, slain ? 10 : 0); bio(s, h, '🛡️', `Schützte das Dorf, als ${def.name} kam.`); }

  // Das Dorf
  const shield = (t.prep.palisade ? 0.5 : 1) * Math.max(0.4, 1 - gs.length * 0.15);
  let damage = '';
  if (outcome === 'repelled' || outcome === 'defeat') {
    const share = (outcome === 'defeat' ? 0.25 : 0.08) * shield;
    const gold = Math.round(s.gold * share);
    const lost = Math.min(s.shelf.length, Math.round(s.shelf.length * (outcome === 'defeat' ? 0.5 : 0.2) * shield));
    s.gold -= gold;
    for (let i = 0; i < lost; i++) s.shelf.splice(r.int(0, s.shelf.length - 1), 1);
    s.reputation = Math.max(0, s.reputation - (outcome === 'defeat' ? 30 : 8));
    damage = ` Schaden am Dorf: ${gold} 🪙${lost ? ` und ${lost} Waren aus deinem Regal` : ''}.`;
  }

  const names = fs.map((h) => `**${first(h)}**`).join(', ') || 'niemand';
  if (slain) {
    s.chapter = (s.chapter ?? 0) + 1;
    s.reputation += 60 + 20 * s.chapter;
    s.mats.drachenschuppe += 4;
    if (leader) {
      leader.title = def.title(leader.female);
      bio(s, leader, '👑', `Führte den Kampf gegen ${def.acc} an. Man nennt ${leader.female ? 'sie' : 'ihn'} seither ${leader.title}.`);
    }
    s.deeds.push({ id: def.id, name: def.name, icon: def.icon, day, outcome, leader: leader?.name ?? null, title: leader?.title ?? null,
      fighters: fs.map((h) => h.name), attempts: t.attempt, prep: Object.keys(t.prep) });
    log(s, 'threat', `${def.icon} ${def.win} ${outcome === 'triumph' ? 'Kaum jemand hat mehr als einen Kratzer.' : 'Der Sieg war teuer erkauft – viele sind verwundet.'} ` +
      `Es kämpften: ${names}.${leader ? ` **${leader.name}** heißt von nun an ${leader.title}.` : ''} (Ruf +${60 + 20 * s.chapter}, 4× 🐉)`, leader?.id ?? null, { outcome });
    s.nextThreatAt = s.t + r.int(12 * DAY, 16 * DAY);
    finish(s, r);
  } else {
    log(s, 'threat', outcome === 'repelled'
      ? `${def.icon} ${names} werfen sich ${def.dat} entgegen. Es reicht nicht für den Sieg – aber das Ungeheuer zieht sich blutend zurück.${damage} Es wird wiederkommen.`
      : `${def.icon} Eichenfurt brennt. ${fs.length ? `${names} konnten ${def.acc} nicht aufhalten.` : `Niemand stellte sich ${def.dat} entgegen.`}${damage} Das Ungeheuer zieht ab – fürs Erste.`,
      leader?.id ?? null, { outcome });
    // Es kehrt zurück: geschwächt, wenn es vertrieben wurde
    const strength = Math.round(t.strength * (outcome === 'repelled' ? 0.8 : 0.9));
    t.returnAt = s.t + r.int(3 * DAY, 4 * DAY);
    t.pendingStrength = strength;
    t.deadline = null;
    for (const h of s.heroes) h.threatRole = null;
  }
}

// Ein Held zögert: kämpfen oder das Dorf schützen?
export const WAVER = {
  icon: '😰', title: 'Kämpfen oder schützen?',
  text: (s, d) => {
    const h = s.heroes.find((x) => x.id === d.hero);
    const def = threatDef(s);
    return fmt(`{n} dreht den Helm in den Händen: „Alle reden nur noch von ${def.dat.split(',')[0]}. Ich bin kein Feigling. Aber irgendwer muss doch ` +
      'bei den Kindern und den Alten bleiben, wenn es losgeht. Wo willst du mich haben?“', h);
  },
  options: (s, d) => {
    const h = s.heroes.find((x) => x.id === d.hero);
    const brave = h.traits.includes('mutig') || h.traits.includes('ruhmsuechtig');
    const follows = brave || (h.trust ?? 0) >= 15;
    return [
      {
        label: '„An die Front. Wir brauchen jede Klinge.“', desc: follows ? `${first(h)} kämpft mit.` : `${first(h)} zweifelt – und kennt dich noch nicht gut genug, um dir blind zu folgen.`,
        apply: () => {
          if (!follows) { h.threatRole = 'guard'; changeMood(h, -3); return fmt('{n} senkt den Blick. „Ich … ich bleib bei den Leuten im Dorf.“', h); }
          h.threatRole = 'fight'; changeMood(h, 6);
          return fmt('{n} setzt den Helm auf. „Dann an die Front.“', h);
        },
      },
      {
        label: '„Schütz das Dorf.“', desc: `${first(h)} kämpft nicht mit, hält aber Schaden vom Dorf fern, falls es schiefgeht.`,
        apply: () => { h.threatRole = 'guard'; changeMood(h, 3); changeTrust(h, 3); return fmt('{n} nickt erleichtert. „Kein Funke kommt an die Strohdächer. Versprochen.“', h); },
      },
      {
        label: '„Das musst du selbst wissen.“', desc: `${first(h)} entscheidet nach eigenem Mut.`,
        apply: () => {
          h.threatRole = h.traits.includes('vorsichtig') || h.mood < 40 ? 'guard' : 'fight';
          return fmt(h.threatRole === 'fight' ? '{n} atmet tief durch. „Dann kämpfe ich.“' : '{n} entscheidet sich für die Wache im Dorf.', h);
        },
      },
    ];
  },
};

export function processThreat(s, r) {
  const t = s.threat;
  if (!t) {
    if (s.t % 60 !== 0 || isNight(s) || s.heroes.length < 3) return;
    // Erste Bedrohung: Der Drache erwacht, wenn sein Horst zu oft geplündert wurde. Später: nach einer Atempause.
    const first0 = (s.chapter ?? 0) === 0 && (s.stats.areaWins?.drachenhorst ?? 0) >= 3 && !s.deeds.length;
    const later = (s.chapter ?? 0) > 0 && s.t >= (s.nextThreatAt ?? Infinity);
    if (first0 || later) announce(s, r, THREATS[(s.chapter ?? 0) % THREATS.length]);
    return;
  }
  const def = threatDef(s);
  if (t.deadline === null) {
    // vertrieben – es kehrt zurück
    if (s.t >= t.returnAt && !isNight(s)) announce(s, r, def, { returning: true, strength: t.pendingStrength });
    return;
  }
  // Am zweiten Tag: Einer zögert
  if (!t.wavered && s.t >= t.announcedAt + 10 * H && !isNight(s)) {
    const here = s.heroes.filter((h) => h.state === 'idle' && !s.requests.some((q) => q.data.hero === h.id));
    if (here.length >= 2) {
      const h = here.sort((a, b) => heroPower(a) - heroPower(b))[0];
      t.wavered = true;
      addVisitor(s, 'threat', { hero: h.id }, Math.max(2 * H, t.deadline - s.t - H));
      log(s, 'request', fmt(`😰 {n} kommt mit einer Frage zum bevorstehenden Kampf zu dir.`, h), h.id, { pending: true });
    }
  }
  // Die letzten Stunden: Alle bleiben im Dorf und rüsten sich
  if (!t.gathered && s.t >= t.deadline - 8 * H) {
    t.gathered = true;
    s.effects.push({ label: `Alle rüsten sich gegen ${def.acc.split(',')[0]}`, icon: def.icon, until: t.deadline + 30, mods: [{ key: 'depart', v: 0 }], tag: 'threat' });
    log(s, 'threat', `${def.icon} Niemand zieht mehr los. Auf dem Dorfplatz werden Klingen geschliffen und Eimer gefüllt.`);
  }
  if (s.t >= t.deadline) battle(s, r);
}
