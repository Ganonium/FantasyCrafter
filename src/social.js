// Das Eigenleben der Helden über den Einzelnen hinaus: Freundschaften, Rivalitäten und persönliche Ziele.

import { AREAS, RECIPES } from './data.js';
import { T, THOUGHTS, fmt } from './text.js';
import { log, say, changeMood, heroPower, successChance, evaluateAreas, priceOf } from './sim.js';
import { bio, bump } from './life.js';

export const FRIEND = 40;
export const RIVAL = -40;

// ---------- Beziehungen (symmetrisch, −100 … +100) ----------

const relKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function relation(s, a, b) {
  return s.relations[relKey(a.id, b.id)] ?? 0;
}

export function friendsOf(s, h) {
  return s.heroes.filter((o) => o !== h && relation(s, h, o) >= FRIEND);
}

export function rivalsOf(s, h) {
  return s.heroes.filter((o) => o !== h && relation(s, h, o) <= RIVAL);
}

export function changeRelation(s, r, a, b, d) {
  const k = relKey(a.id, b.id);
  const old = s.relations[k] ?? 0;
  const v = Math.max(-100, Math.min(100, old + d));
  s.relations[k] = v;
  if (old < FRIEND && v >= FRIEND) {
    log(s, 'social', fmt(say(s, r, 'friendship', T.friendship), a, { o: `**${b.name}**` }), a.id, { other: b.id, kind: 'friend' });
    bio(s, a, '💛', `Wurde Freund von ${b.name}.`);
    bio(s, b, '💛', `Wurde Freund von ${a.name}.`);
    bump(a, 'friendships'); bump(b, 'friendships');
  } else if (old > RIVAL && v <= RIVAL) {
    log(s, 'social', fmt(say(s, r, 'rivalry', T.rivalry), a, { o: `**${b.name}**` }), a.id, { other: b.id, kind: 'rival' });
    bio(s, a, '⚔️', `Wurde Rivale von ${b.name}.`);
    bio(s, b, '⚔️', `Wurde Rivale von ${a.name}.`);
  } else if (old >= FRIEND && v < FRIEND - 10) {
    bio(s, a, '💔', `Die Freundschaft mit ${b.name} ist abgekühlt.`);
    bio(s, b, '💔', `Die Freundschaft mit ${a.name} ist abgekühlt.`);
  }
}

// Tavernengeplauder: Ton hängt von der bisherigen Beziehung und den Wesenszügen ab
export function banter(s, r, a, b) {
  let friendly = 0.56 + relation(s, a, b) / 160;
  for (const h of [a, b]) {
    if (h.traits.includes('gesellig')) friendly += 0.12;
    if (h.traits.includes('ruhmsuechtig')) friendly -= 0.1;
    if (h.mood < 30) friendly -= 0.15;
  }
  // Wer in derselben Klasse um dieselbe Ausrüstung buhlt, reibt sich eher
  if (a.cls === b.cls) friendly -= 0.08;
  if (r.chance(Math.max(0.1, Math.min(0.92, friendly)))) {
    log(s, 'banter', fmt(say(s, r, 'banterFriendly', T.banterFriendly), a, { o: `**${b.name}**` }), a.id);
    changeMood(a, 3); changeMood(b, 3);
    changeRelation(s, r, a, b, r.int(9, 15));
  } else {
    log(s, 'banter', fmt(say(s, r, 'banterRival', T.banterRival), a, { o: `**${b.name}**` }), a.id);
    changeMood(a, -1); changeMood(b, -1);
    changeRelation(s, r, a, b, -r.int(8, 13));
  }
}

// ---------- Gemeinsame Ausflüge ----------

// Zwei Freunde zusammen sind stärker als jeder allein
export function partyPower(a, b) {
  const pa = heroPower(a), pb = heroPower(b);
  return Math.max(pa, pb) + 0.6 * Math.min(pa, pb);
}

// Sucht einen bereiten Freund und das beste gemeinsame Ziel. Ergebnis: { friend, eval } oder null
export function findParty(s, r, h, soloBest) {
  const candidates = friendsOf(s, h).filter((f) => f.state === 'idle' && !f.partyWith);
  if (!candidates.length) return null;
  const f = r.pick(candidates);
  const power = partyPower(h, f);
  const mine = evaluateAreas(s, h, { power });
  const theirs = evaluateAreas(s, f, { power });
  let best = null;
  for (let i = 0; i < mine.length; i++) {
    if (mine[i].block || theirs[i].block) continue;
    const value = mine[i].value + theirs[i].value * 0.5;
    if (!best || value > best.value) best = { ...mine[i], value };
  }
  if (!best) return null;
  // Lohnt sich der gemeinsame Ausflug? Vor allem, wenn er ein Gebiet erschließt, das allein zu gefährlich wäre.
  // Sonst ziehen Freunde nur ab und zu „einfach so“ zusammen los – das bleibt dann still im Hintergrund.
  const soloDanger = soloBest ? AREAS[soloBest.id].danger : AREAS.kornfelder.danger;
  const bold = AREAS[best.id].danger > soloDanger;
  if (!bold && !r.chance(0.2)) return null;
  return { friend: f, eval: best, bold };
}

// ---------- Persönliche Ziele ----------

const GOAL_WEIGHTS = { gear: 40, area: 32, bounty: 14 };

function pickGoalType(r, h) {
  const w = { ...GOAL_WEIGHTS };
  if (h.traits.includes('ruhmsuechtig') || h.traits.includes('mutig')) w.area += 40;
  if (h.traits.includes('gierig')) w.bounty += 40;
  if (h.traits.includes('geizig')) w.gear += 20;
  if (h.traits.includes('vorsichtig')) w.gear += 30;
  if (h.traits.includes('eifrig')) w.area += 20;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let roll = r() * total;
  return Object.keys(w).find((k) => (roll -= w[k]) < 0) ?? 'gear';
}

export function assignGoal(s, r, h) {
  const type = pickGoalType(r, h);
  if (type === 'gear') {
    const slots = ['weapon', 'armor'].filter((slot) => (h[slot] ? RECIPES[h[slot]].tier : 0) < 4);
    if (slots.length) {
      const slot = r.pick(slots);
      const tier = (h[slot] ? RECIPES[h[slot]].tier : 0) + 1;
      const recipe = Object.keys(RECIPES).find((id) => RECIPES[id].cls === h.cls && RECIPES[id].slot === slot && RECIPES[id].tier === tier);
      if (recipe) { h.goal = { type, recipe, since: s.t }; return; }
    }
  }
  if (type === 'area' || type === 'gear') {
    // das erste Gebiet, das sich der Held (noch) nicht zutraut
    const evals = evaluateAreas(s, h);
    const target = evals.find((e) => e.block === 'danger') ?? (h.successes ? null : evals[0]);
    if (target) { h.goal = { type: 'area', area: target.id, since: s.t }; return; }
  }
  // sonst (oder wenn Ausrüstung und Gebiete ausgereizt sind): ein Kopfgeld kassieren
  h.goal = { type: 'bounty', start: h.bountiesDone ?? 0, since: s.t };
}

// { text, cur, max, done }
export function goalProgress(s, h) {
  const g = h.goal;
  if (!g) return null;
  switch (g.type) {
    case 'gear': {
      const rc = RECIPES[g.recipe];
      const owned = h[rc.slot] ? RECIPES[h[rc.slot]].tier : 0;
      const price = priceOf(s, g.recipe);
      return { text: `${rc.name} besitzen`, short: rc.name, cur: Math.min(Math.floor(h.gold), price), max: price,
        done: owned >= rc.tier, unit: '🪙' };
    }
    case 'area': {
      const p = Math.round(successChance(h, g.area, s) * 100);
      return { text: `${AREAS[g.area].name} bezwingen`, short: AREAS[g.area].name, cur: p, max: 100,
        done: (h.areaWins?.[g.area] ?? 0) > (g.wins0 ?? 0), unit: '% Chance' };
    }
    case 'bounty':
      return { text: 'ein Kopfgeld kassieren', short: 'Kopfgeld', cur: (h.bountiesDone ?? 0) - g.start, max: 1,
        done: (h.bountiesDone ?? 0) > g.start, unit: '' };
    default:
      return null;
  }
}

export function goalThought(s, r, h) {
  const g = h.goal;
  if (!g) return null;
  const tpl = r.pick(THOUGHTS.goal[g.type]);
  if (g.type === 'gear') return fmt(tpl, h, { x: RECIPES[g.recipe].name });
  if (g.type === 'area') {
    const a = AREAS[g.area];
    return fmt(tpl, h, { A: a.name, zu: a.zu });
  }
  return fmt(tpl, h);
}

// Prüft das Ziel, belohnt bei Erfolg und plant das nächste
export function checkHeroGoal(s, r, h) {
  if (!h.goal) {
    if (s.t >= (h.nextGoalAt ?? 0)) {
      assignGoal(s, r, h);
      // gleich zu Beginn ein Ziel, das schon erfüllt ist? Dann lieber ein anderes
      if (goalProgress(s, h)?.done) assignGoal(s, r, h);
      if (h.goal?.type === 'area') h.goal.wins0 = h.areaWins?.[h.goal.area] ?? 0;
    }
    return;
  }
  const p = goalProgress(s, h);
  if (!p?.done) return;
  changeMood(h, 14);
  s.reputation += 3;
  h.goalsDone = (h.goalsDone ?? 0) + 1;
  log(s, 'herogoal', fmt(say(s, r, 'heroGoalDone', T.heroGoalDone), h, { x: p.text }), h.id);
  // Hat deine Ware den Traum erfüllt?
  bio(s, h, '🌟', `Traum erfüllt: ${p.text}.`, h.goal.type === 'gear');
  bump(h, 'joy');
  h.goal = null;
  h.nextGoalAt = s.t + r.int(8 * 60, 16 * 60);
}

// Wie stark beeinflusst das Ziel die Entscheidung für ein Gebiet?
export function goalAreaBonus(h, areaId) {
  if (h.goal?.type === 'area' && h.goal.area === areaId) return { value: 1.6, threshold: -0.05 };
  if (h.goal?.type === 'bounty') return { value: 1.15, threshold: 0 };
  return { value: 1, threshold: 0 };
}

// Ziele, für die man Gold braucht, machen fleißiger
export function goalDrive(s, h) {
  const g = h.goal;
  if (!g) return 0;
  if (g.type === 'gear' && h.gold < priceOf(s, g.recipe)) return 0.1;
  return 0;
}

export function wantsRecipe(h, recipeId) {
  return h.goal?.type === 'gear' && h.goal.recipe === recipeId;
}

