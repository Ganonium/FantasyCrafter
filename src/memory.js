// Erinnerungen: Helden merken sich, was sie erlebt haben und wie du mit ihnen umgegangen bist.
// Daraus entsteht ihr Verhältnis zu dir (h.trust, −100 … 100) – und das hat Folgen:
// Wer dir vertraut, bringt dir etwas mit und kommt öfter an den Tresen; wer enttäuscht ist, kauft lieber woanders.

import { AREAS } from './data.js';

const LIMIT = 16;
const DAY = 1440;

const area = (m) => AREAS[m.area];

// trust: Wirkung auf das Verhältnis zu dir · line: Zeile auf der Heldenkarte · thought: woran der Held manchmal denkt
export const MEMORIES = {
  hurt: {
    icon: '🤕', trust: 0,
    line: (m) => `Wurde ${area(m).in} schwer verletzt. Geht dorthin vorerst nicht mehr ohne Heiltrank.`,
    thought: (m) => `Seit der Sache ${area(m).in} geh ich da nicht mehr ohne Heiltrank hin.`,
  },
  saved: {
    icon: '🧪', trust: 5, you: true,
    line: (m) => `Dein Heiltrank rettete ${m.f ? 'ihr' : 'ihm'} ${area(m).in} das Leben.`,
    thought: (m) => `Ohne deinen Heiltrank wäre ich ${area(m).in} geblieben.`,
  },
  firstWin: {
    icon: '🏆', trust: 3, you: true,
    line: (m) => `Erster Sieg ${area(m).in} – mit ${m.item} aus deinem Laden.`,
    thought: (m) => `${m.item} hat mir ${area(m).in} gute Dienste geleistet.`,
  },
  gearBroke: {
    icon: '💥', trust: 0,
    line: (m) => `${m.item} zerbrach ${area(m).in}.`,
    thought: (m) => `Schade um ${m.item}. So eins find ich nicht wieder.`,
  },
  goodAdvice: {
    icon: '✋', trust: 12, you: true,
    line: (m) => `Dein Zuspruch führte zum Sieg ${area(m).in}.`,
    thought: () => 'Auf deinen Rat kann man sich verlassen.',
  },
  badAdvice: {
    icon: '✋', trust: -22, you: true,
    line: (m) => `Dein Rat führte ${area(m).in} ins Unglück. Das sitzt tief.`,
    thought: () => 'Auf deinen Rat hör ich so schnell nicht wieder.',
  },
  loan: {
    icon: '💰', trust: 8, you: true,
    line: (m) => `Du hast ${m.f ? 'ihr' : 'ihm'} Gold vorgestreckt, als es knapp war.`,
    thought: () => 'Du hast mir vertraut, als ich blank war. Das vergess ich nicht.',
  },
  loanRefused: {
    icon: '💰', trust: -10, you: true,
    line: () => 'Du hast einen Vorschuss verweigert.',
    thought: () => 'Geschäft ist Geschäft, hast du gesagt. Na dann.',
  },
  gift: {
    icon: '🎁', trust: 18, you: true,
    line: (m) => `Du hast ${m.f ? 'ihr' : 'ihm'} ${m.item} geschenkt.`,
    thought: (m) => `${m.item}, einfach so geschenkt … Dir bin ich was schuldig.`,
  },
  favored: {
    icon: '🤝', trust: 8, you: true,
    line: (m) => `Du hast ${m.f ? 'ihr' : 'ihm'} ${m.item} gegeben – und nicht ${m.other}.`,
    thought: (m) => `Du hast ${m.item} mir gegeben. ${m.other} guckt immer noch sauer.`,
  },
  passedOver: {
    icon: '😒', trust: -16, you: true,
    line: (m) => `Du hast ${m.item} lieber ${m.other} gegeben.`,
    thought: (m) => `${m.item} hätte mir zugestanden, nicht ${m.other}.`,
  },
  apology: {
    icon: '🍺', trust: 20, you: true,
    line: () => 'Du hast dich für deinen schlechten Rat entschuldigt.',
    thought: () => 'Jeder irrt sich mal. Du hast es wenigstens zugegeben.',
  },
  brushedOff: {
    icon: '😠', trust: -12, you: true,
    line: () => 'Du hast die Schuld von dir gewiesen.',
    thought: () => '„Deine Entscheidung“, hast du gesagt. Schöner Freund.',
  },
  listened: {
    icon: '👂', trust: 4, you: true,
    line: (m) => `Du hast dir die Geschichte ${area(m).aus} angehört.`,
    thought: () => 'Bei dir kann man wenigstens mal erzählen.',
  },
  cautioned: {
    icon: '👂', trust: 2, you: true,
    line: () => 'Du hast zur Vorsicht gemahnt.',
    thought: () => 'Vielleicht hast du recht. Ich pass besser auf.',
  },
  ignored: {
    icon: '🙄', trust: -4, you: true,
    line: () => 'Du hattest keine Zeit, als es darauf ankam.',
    thought: () => 'Du hast ja nie Zeit.',
  },
  rescued: {
    icon: '🕯️', trust: 18, you: true,
    line: (m) => `War ${area(m).in} verschollen – du hast suchen lassen, ${m.other} fand ${m.f ? 'sie' : 'ihn'}.`,
    thought: () => 'Ihr habt mich nicht aufgegeben. Das vergess ich euch nie.',
  },
  abandoned: {
    icon: '🕯️', trust: -20, you: true,
    line: (m) => `War ${area(m).in} verschollen. Niemand kam.`,
    thought: () => 'Ich lag da draußen und hab gewartet. Auf niemanden, wie sich zeigte.',
  },
  avenged: {
    icon: '🔥', trust: 12, you: true,
    line: (m) => `Nahm Rache ${area(m).in} – von dir ausgerüstet.`,
    thought: () => 'Die Rechnung ist beglichen. Dank dir.',
  },
  greatDeed: {
    icon: '👑', trust: 0,
    line: (m) => `Stand gegen ${m.foe} – und siegte.`,
    thought: (m) => `Der Kampf gegen ${m.foe.split(',')[0]} … Ich träum immer noch davon.`,
  },
  thanked: {
    icon: '💛', trust: 3, you: true,
    line: () => 'Kam vorbei, um sich bei dir zu bedanken.',
    thought: () => 'Im Goldenen Amboss ist man gut aufgehoben.',
  },
};

export function trustOf(h) {
  return h.trust ?? 0;
}

export function changeTrust(h, d) {
  h.trust = Math.max(-100, Math.min(100, trustOf(h) + d));
}

// Ohne neue Erlebnisse verblasst das Verhältnis: einmal am Tag einen Schritt Richtung „man kennt sich“.
// Guter Wille schwindet schneller als Groll.
export function fadeTrust(h) {
  const t = trustOf(h);
  if (t > 10) h.trust = t - (t > 60 ? 3 : 2);
  else if (t < -10) h.trust = t + 1;
}

// Eine Erinnerung anlegen. Gleichartige alte Erinnerungen (gleiches Gebiet/Teil) werden ersetzt.
export function remember(s, h, type, data = {}) {
  const def = MEMORIES[type];
  if (!def) return null;
  h.mem ??= [];
  const m = { type, t: s.t, f: h.female, ...data };
  h.mem = h.mem.filter((x) => !(x.type === type && x.area === m.area && x.item === m.item));
  h.mem.push(m);
  if (h.mem.length > LIMIT) h.mem.splice(0, h.mem.length - LIMIT);
  // Wiederholungen wirken schwächer: Der dritte gerettete Tag ist kein Wunder mehr
  const again = (h.memCount ??= {})[type] ?? 0;
  h.memCount[type] = again + 1;
  if (def.trust) changeTrust(h, def.trust > 0 ? Math.max(1, Math.round(def.trust / (1 + again * 0.5))) : def.trust);
  return m;
}

export function recall(h, type, pred = null) {
  return (h.mem ?? []).filter((m) => m.type === type && (!pred || pred(m))).at(-1) ?? null;
}

// Die Narbe: Wer in einem Gebiet schwer verletzt wurde, geht dort eine Woche lang nicht ohne Heiltrank hin
export function scarredIn(s, h, areaId) {
  return !!recall(h, 'hurt', (m) => m.area === areaId && s.t - m.t < 7 * DAY);
}

// Frische Wunden machen zusätzlich zögerlich (drei Tage lang)
export function freshScar(s, h, areaId) {
  return !!recall(h, 'hurt', (m) => m.area === areaId && s.t - m.t < 3 * DAY);
}

export function memoryThought(h, r) {
  const list = (h.mem ?? []).filter((m) => MEMORIES[m.type]?.thought);
  if (!list.length) return null;
  // jüngere Erinnerungen kommen öfter hoch
  const m = list[Math.min(list.length - 1, Math.floor(list.length * Math.sqrt(r())))];
  return MEMORIES[m.type].thought(m);
}

export function memoryLines(h, limit = 6) {
  return (h.mem ?? []).slice().reverse().slice(0, limit)
    .map((m) => ({ icon: MEMORIES[m.type].icon, text: MEMORIES[m.type].line(m), you: !!MEMORIES[m.type].you, t: m.t }));
}

const TRUST_LEVELS = [
  [70, '💛', 'vertraut dir blind'],
  [35, '🙂', 'schätzt dich'],
  [10, '👋', 'kennt dich als fairen Händler'],
  [-10, '·', 'kennt dich kaum'],
  [-30, '😒', 'ist enttäuscht von dir'],
  [-101, '😠', 'trägt dir etwas nach'],
];

export function trustLabel(h) {
  const t = trustOf(h);
  const [, icon, text] = TRUST_LEVELS.find(([min]) => t >= min);
  return { icon, text, value: t };
}
