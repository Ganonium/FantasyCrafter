// Kommen und Gehen: Helden bleiben nicht ewig. Wer genug erlebt hat, nimmt Abschied –
// wird sesshaft (Dorfbewohner mit einer Aufgabe), zieht in die Welt hinaus oder geht im Groll.
// Was bleibt, steht in der Dorfchronik (s.legacy): die Geschichte jedes Helden, der einmal hier war.

import { AREAS, MATERIALS, RECIPES, className } from './data.js';
import { fmt } from './text.js';
import { log, changeMood, heroPower } from './sim.js';
import { friendsOf } from './social.js';
import { bio, bump } from './life.js';
import { trustOf, trustLabel } from './memory.js';

const DAY = 1440;
const LEGACY_LIMIT = 40;
const first = (h) => h.name.split(' ')[0];

// Aufgaben der Sesshaften: je Klasse eine, mit kleinem dauerhaftem Bonus (wirkt über effectVal wie ein Dorfprojekt)
export const ROLES = {
  krieger: {
    id: 'ausbilder', name: (f) => (f ? 'Ausbilderin' : 'Ausbilder'), icon: '🛡️',
    desc: 'Helden lernen 10 % schneller, Neuankömmlinge kommen erfahrener an.',
    mods: [{ key: 'xp', v: 1.1 }],
    order: 'Die Neuen brauchen etwas Anständiges in die Hand. Übungsholz hatten wir lange genug.',
  },
  waldlaeufer: {
    id: 'kundschafter', name: (f) => (f ? 'Kundschafterin' : 'Kundschafter'), icon: '🧭',
    desc: 'Kennt jeden Pfad: alle Gebiete sind 4 % weniger gefährlich.',
    mods: [{ key: 'danger', v: 0.96 }],
    order: 'Ich führe eine Jagdgesellschaft durchs Revier. Die Herrschaften sind schlecht ausgerüstet.',
  },
  magier: {
    id: 'heiler', name: (f) => (f ? 'Kräuterkundige' : 'Kräuterkundiger'), icon: '🌿',
    desc: 'Verletzungen heilen 10 % schneller, Heiltränke brauen sich 15 % schneller.',
    mods: [{ key: 'injury', v: 0.9 }, { key: 'potionTime', v: 0.85 }],
    order: 'Meine Schüler sollen lernen, womit man arbeitet, bevor sie es selbst versuchen.',
  },
};
const ROLE_STACK = 3; // mehr als drei mit derselben Aufgabe bringen nichts zusätzlich

export function villagers(s) {
  return (s.legacy ?? []).filter((l) => l.fate === 'settled');
}

// Boni der Dorfbewohner, im selben Format wie Effekte und Dorfprojekte
export function villagerMods(s) {
  const count = {};
  const mods = [];
  for (const v of villagers(s)) {
    count[v.cls] = (count[v.cls] ?? 0) + 1;
    if (count[v.cls] <= ROLE_STACK) mods.push(...ROLES[v.cls].mods);
  }
  return mods;
}

export function hasRole(s, cls) {
  return villagers(s).some((v) => v.cls === cls);
}

export function daysHere(s, h) {
  return (s.t - (h.arrivedAt ?? 0)) / DAY;
}

// Was ein Häuschen in Eichenfurt kostet
export function housePrice(h) {
  return 300 + h.level * 80;
}

// Ist der Held reif für den Abschied – und in welcher Stimmung?
// 'content' = hat hier sein Glück gefunden · 'restless' = es gibt nichts mehr zu beweisen · 'bitter' = hat genug von allem
export function farewellMood(s, h) {
  if ((h.farewellAfter ?? 0) > s.t) return null;
  const days = daysHere(s, h);
  const has = (t) => h.traits.includes(t);
  if (has('verbittert') && days >= 4 && trustOf(h) < 10) return 'bitter';
  const maxed = h.weapon && h.armor && RECIPES[h.weapon].tier === 4 && RECIPES[h.armor].tier === 4;
  if (days >= 14 && h.level >= 10 && (maxed || (h.areaWins?.drachenhorst ?? 0) >= 3)) return 'restless';
  if (days >= 10 && h.level >= 8 && has('zufrieden')) return 'content';
  return null;
}

// Würde der Held von sich aus bleiben wollen?
export function wantsToSettle(h) {
  if (h.traits.includes('ruhmsuechtig') || h.traits.includes('eifrig')) return false;
  return h.traits.includes('gesellig') || h.traits.includes('zufrieden') || h.traits.includes('faul');
}

// Abschiedsgeschenk: Wer dir vertraut, lässt etwas da
function partingGift(s, h) {
  const trust = trustOf(h);
  if (trust >= 50) {
    const won = Object.keys(AREAS).filter((a) => AREAS[a].mat && (h.areaWins?.[a] ?? 0) > 0);
    const area = won.at(-1);
    if (area) {
      const mat = AREAS[area].mat;
      s.mats[mat] += 3;
      return `3× ${MATERIALS[mat].name} ${MATERIALS[mat].icon}`;
    }
  }
  if (trust >= 20) {
    const gold = 60 + h.level * 15;
    s.gold += gold;
    return `${gold} 🪙`;
  }
  return null;
}

// Die wichtigsten Seiten des Heldenbuchs für die Dorfchronik
function keepsake(h) {
  const all = h.bio ?? [];
  const key = all.filter((e, i) => i === 0 || e.you || ['🏆', '🌱', '🎓', '💛', '⚔️', '🌟'].includes(e.icon));
  return key.length > 14 ? [key[0], ...key.slice(-13)] : key;
}

// Nimmt den Helden aus dem Spiel und schreibt ihn in die Dorfchronik.
// fate: 'settled' (bleibt als Dorfbewohner) | 'wandered' (zieht in die Welt) | 'bitter' (geht im Groll) | 'left' (hielt es nicht mehr aus)
export function retireHero(s, r, h, fate) {
  const role = fate === 'settled' ? ROLES[h.cls] : null;
  const friends = friendsOf(s, h);
  s.legacy ??= [];
  s.legacy.push({
    id: h.id, name: h.name, female: h.female, cls: h.cls, look: h.look, level: h.level,
    weapon: h.weapon, armor: h.armor, power: heroPower(h),
    fate, role: role?.id ?? null, t: s.t, c: s.clock0 + s.clockOffset + s.t,
    days: Math.max(1, Math.round(daysHere(s, h))), adventures: h.adventures, successes: h.successes,
    goalsDone: h.goalsDone ?? 0, trust: trustLabel(h).text, traits: [...h.traits],
    bio: keepsake(h),
  });
  if (s.legacy.length > LEGACY_LIMIT) {
    // Dorfbewohner bleiben immer stehen; die ältesten Fortgezogenen verblassen
    const idx = s.legacy.findIndex((l) => l.fate !== 'settled');
    s.legacy.splice(idx >= 0 ? idx : 0, 1);
  }
  s.heroes = s.heroes.filter((x) => x !== h);

  // Freunde: Wer bleibt, ist ja noch da. Wer geht, fehlt.
  for (const f of friends) {
    if (fate === 'settled') {
      changeMood(f, 4);
      bio(s, f, '🏡', `${h.name} ist in Eichenfurt sesshaft geworden.`);
    } else {
      changeMood(f, fate === 'wandered' ? -6 : -12);
      if (fate !== 'wandered') bump(f, 'bitterness');
      bio(s, f, '💔', `${h.female ? 'Die Freundin' : 'Der Freund'} ${h.name} hat Eichenfurt verlassen.`);
      if (fate !== 'wandered') log(s, 'social', fmt('{n} blickt lange die Straße hinunter, auf der {o} verschwunden ist.', f, { o: `**${h.name}**` }), f.id);
    }
  }
  for (const o of s.heroes) {
    if (o.mentor === h.id) {
      o.mentor = null;
      bio(s, o, '🎓', fate === 'settled' ? `${h.name} hat sich zur Ruhe gesetzt – die Lehre ist vorbei.` : `Verlor ${h.female ? 'die Lehrmeisterin' : 'den Lehrmeister'} ${h.name}.`);
    }
  }
  if (h.debt && fate !== 'settled') log(s, 'loan', `💰 Mit **${h.name}** verschwinden auch ${h.debt.amount} Gold Vorschuss.`, h.id);
  for (const k of Object.keys(s.relations)) if (k.split('-').map(Number).includes(h.id)) delete s.relations[k];
  s.lastFarewellAt = s.t;
  // Ein freies Zimmer spricht sich herum
  s.guestDue ??= s.t + r.int(90, 300);
  return role;
}

// Der Held wird sesshaft. payer: 'hero' zahlt selbst, sonst legt der Spieler den Rest dazu (schon abgebucht)
export function settle(s, r, h) {
  const price = housePrice(h);
  h.gold = Math.max(0, h.gold - price);
  const role = retireHero(s, r, h, 'settled');
  s.reputation += 8;
  log(s, 'farewell', fmt(`🏡 {n} hängt die Abenteuer an den Nagel und baut sich ein Häuschen in Eichenfurt. Ab heute ist {er} ${role.name(h.female)}. ${role.desc}`, h), null, { fate: 'settled', legacy: h.id });
  return role;
}

// Der Held zieht in die Welt hinaus. feast: mit Abschiedsfest
export function wander(s, r, h, { feast = false } = {}) {
  const gift = partingGift(s, h);
  retireHero(s, r, h, 'wandered');
  s.reputation += feast ? 12 : 5;
  if (feast) for (const o of s.heroes) if (o.state !== 'away') changeMood(o, 8);
  const dir = r.pick(['nach Norden', 'der Küste entgegen', 'über den Pass', 'den Fluss hinab']);
  log(s, 'farewell', fmt(`👋 {n} schnürt das Bündel und zieht ${dir} – neuen Abenteuern entgegen.${feast ? ' Das halbe Dorf steht am Tor und winkt.' : ''}` +
    (gift ? ` Zum Abschied lässt {er} dir etwas da: ${gift}.` : ''), h), null, { fate: 'wandered', legacy: h.id });
  return gift;
}

// Der Held geht im Groll
export function leaveBitter(s, r, h, fate = 'bitter') {
  retireHero(s, r, h, fate);
  s.reputation = Math.max(0, s.reputation - 3);
  log(s, 'farewell', fmt('🚪 {n} packt wortlos die Sachen und verlässt Eichenfurt. Zurück bleibt ein leeres Zimmer in der Taverne.', h), null, { fate, legacy: h.id });
}

export const FATE_LABEL = {
  settled: (l) => `${ROLES[l.cls].icon} ${ROLES[l.cls].name(l.female)} in Eichenfurt`,
  wandered: () => '👋 zog in die Welt hinaus',
  bitter: () => '🚪 ging im Groll',
  left: () => '🚪 hielt es hier nicht mehr aus',
};

export function legacyTitle(l) {
  return `${className(l.cls, l.female)}, Stufe ${l.level}`;
}
