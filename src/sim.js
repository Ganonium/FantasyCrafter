// Spielsimulation – reine Logik ohne DOM. Zeit `t` in Spielminuten seit Spielbeginn.
// Alles läuft in 1-Minuten-Schritten, damit Offline-Nachberechnung und Live-Spiel identisch sind.

import {
  MATERIALS, RECIPES, AREAS, TRAITS, TRAIT_CONFLICTS, BUILDINGS,
  WEAPON_POWER, ARMOR_POWER, NAMES_M, NAMES_F, EPITHETS, fairPrice, className,
} from './data.js';
import { makeRng } from './rng.js';
import { T, THOUGHTS, fmt } from './text.js';
import { EVENTS, EVENT_BY_ID } from './events.js';
import { GOALS, PROJECTS } from './goals.js';
import {
  banter, changeRelation, friendsOf, rivalsOf, findParty, checkHeroGoal, goalAreaBonus, goalDrive, goalThought,
} from './social.js';
import { bio, bump, life, checkGrowth, growTrait, traitThreshold, traitDrive, moodBaseline } from './life.js';
import { processRequests, offerLastItem } from './requests.js';
import { villagers, villagerMods, hasRole, leaveBitter, ROLES } from './farewell.js';
import { sagaIntercept, sagaAfterTrip, questArea, processSagas } from './sagas.js';
import { processThreat } from './threat.js';
import { remember, scarredIn, freshScar, memoryThought, trustOf, changeTrust, fadeTrust } from './memory.js';

export const SAVE_VERSION = 3;
const LOG_LIMIT = 500;
const NIGHT_START = 22 * 60;
const NIGHT_END = 6 * 60;
const EVENT_WAIT = 6 * 60; // so lange wartet ein Ereignis auf deine Entscheidung
const OFFER_WAIT = 8 * 60; // so lange liegt ein Bestellangebot aus

// ---------- Neues Spiel / Migration ----------

export function newGame(seed = Date.now(), clockMinute = 8 * 60) {
  const s = {
    version: SAVE_VERSION,
    rng: seed | 0,
    t: 0,
    clock0: clockMinute,
    gold: 120,
    mats: Object.fromEntries(Object.keys(MATERIALS).map((m) => [m, 0])),
    buildings: { schmiede: 1, laden: 1, taverne: 1 },
    slots: [null],
    queue: [],
    shelf: [],
    prices: {},
    bounties: [],
    heroes: [],
    nextId: 1,
    nextArrival: 60,
    nextBanter: 120,
    reputation: 0,
    log: [],
    stats: { sold: 0, earned: 0, adventures: 0, successes: 0, crafted: 0 },
  };
  s.mats.eisen = 12; s.mats.holz = 10; s.mats.stoff = 8; s.mats.kraeuter = 6;
  addV2Fields(s);
  const r = makeRng(s);
  for (const cls of ['krieger', 'waldlaeufer', 'magier']) addHero(s, r, { cls, silent: true });
  log(s, 'info', 'Willkommen in **Eichenfurt**! Dein Laden hat geöffnet. Drei Helden sitzen schon in der Taverne und warten auf Ausrüstung.');
  return s;
}

function addV2Fields(s) {
  s.effects ??= [];
  s.event ??= null;
  s.nextEvent ??= s.t + 150;
  s.recentEvents ??= [];
  s.orders ??= [];
  s.nextOrder ??= s.t + 90;
  s.goalIndex ??= 0;
  s.projects ??= {};
  s.recent ??= {};
  s.stats.delivered ??= {};
  s.stats.areaWins ??= {};
  s.stats.ordersDone ??= 0;
  s.stats.bountiesPosted ??= 0;
  s.clockOffset ??= 0;
  s.guestDue ??= null;
  s.relations ??= {};
  // Besucher am Tresen: früher eine einzelne Bitte, jetzt eine kleine Warteschlange
  s.legacy ??= [];
  s.saga ??= null;
  s.nextSagaAt ??= Math.max(s.t, 2 * 1440);
  s.threat ??= null;
  s.deeds ??= [];
  s.chapter ??= 0;
  s.requests ??= s.request ? [s.request] : [];
  delete s.request;
  s.nextRequest ??= s.t + 240;
}

// Version 3: Lagerhaus, Reparaturen, Regenüberzüge und passive Heldenwünsche (Gold, Stufe) sind gestrichen
function migrateV3(s) {
  if (s.buildings.lager !== undefined) {
    const refund = [0, 0, 200, 900][s.buildings.lager] ?? 0;
    delete s.buildings.lager;
    if (refund) {
      s.gold += refund;
      log(s, 'build', `📦 Das Lagerhaus wird nicht mehr gebraucht – was du verpasst, wird jetzt immer bis zu 24 Std. nachgeholt. Du bekommst ${refund} 🪙 für den Ausbau zurück.`);
    }
  }
  delete s.stats.repairs;
  s.queue = s.queue.filter((id) => RECIPES[id]);
  s.slots = s.slots.map((j) => (j && RECIPES[j.recipe] ? j : null));
  s.shelf = s.shelf.filter((it) => RECIPES[it.recipe]);
  if (s.event && !EVENT_BY_ID[s.event.id]) s.event = null;
  for (const h of s.heroes) {
    if (h.goal && (h.goal.type === 'gold' || h.goal.type === 'level')) { h.goal = null; h.nextGoalAt = s.t; }
  }
}

export function migrate(s) {
  addV2Fields(s);
  if ((s.version ?? 1) < 3) migrateV3(s);
  for (const h of s.heroes) if (!h.bio) rebuildBio(s, h);
  s.version = SAVE_VERSION;
  return s;
}

// Helden aus Spielständen vor dem Heldenbuch: Lebensgeschichte aus der Chronik rekonstruieren
const BIO_FROM_LOG = {
  arrive: ['👋', false], buy: ['🛒', true], level: ['⭐', false], fail: ['🤕', false], escape: ['🧪', true],
  broken: ['💥', false], social: ['👥', false], herogoal: ['🌟', false], deliver: ['📦', true], party: ['🤝', false],
};

function rebuildBio(s, h) {
  h.bio = [{ t: h.arrivedAt ?? 0, c: s.clock0 + s.clockOffset + (h.arrivedAt ?? 0), icon: '👋',
    text: `Kam als ${className(h.cls, h.female)} nach Eichenfurt – lange bevor das Heldenbuch begonnen wurde.`, you: false }];
  for (const e of s.log) {
    const map = BIO_FROM_LOG[e.kind];
    const mentioned = e.hero === h.id || e.data?.other === h.id;
    if (!map || !mentioned || e.kind === 'arrive' || (e.kind === 'buy' && e.text.includes('Heiltrank'))) continue;
    const text = e.text.replace(/\*\*/g, '').replace(/\s*\(\+?[^)]*🪙[^)]*\)\s*$/, '');
    h.bio.push({ t: e.t, c: e.c ?? s.clock0 + e.t, icon: map[0], text, you: map[1] });
  }
}

// ---------- Hilfsfunktionen ----------

export function clockOf(s, t = s.t) {
  const total = s.clock0 + s.clockOffset + t;
  return { day: Math.floor(total / 1440) + 1, minute: ((total % 1440) + 1440) % 1440 };
}

export function logClock(s, e) {
  if (e.c === undefined) return clockOf(s, e.t);
  return { day: Math.floor(e.c / 1440) + 1, minute: ((e.c % 1440) + 1440) % 1440 };
}

// Zeit vergeht ohne Simulation (Abwesenheit über die Obergrenze OFFLINE_CAP hinaus)
export function skipTime(s, minutes) {
  s.clockOffset += minutes;
}

// Bei Tempo 1× soll die Spieluhr der echten Uhr entsprechen: kleine Abweichungen ausgleichen
export function syncClock(s, realMinute) {
  let delta = (realMinute - clockOf(s).minute) % 1440;
  if (delta > 720) delta -= 1440;
  if (delta <= -720) delta += 1440;
  s.clockOffset += delta;
}

export function isNight(s, t = s.t) {
  const m = clockOf(s, t).minute;
  return m >= NIGHT_START || m < NIGHT_END;
}

export function building(s, id) {
  return BUILDINGS[id].levels[s.buildings[id] - 1];
}

// data: optionale Zusatzinfos für die Zusammenfassung im Bericht
export function log(s, kind, text, heroId = null, data = null) {
  // c = Uhrzeit beim Eintrag (bleibt gleich, auch wenn die Uhr später nachgestellt wird)
  const e = { t: s.t, c: s.clock0 + s.clockOffset + s.t, kind, text, hero: heroId };
  if (data) e.data = data;
  s.log.push(e);
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

// Zufälliger Text, der die letzten Varianten derselben Sorte meidet
export function say(s, r, key, arr) {
  if (arr.length === 1) return arr[0];
  const recent = (s.recent[key] ??= []);
  const avoid = recent.slice(-Math.min(arr.length - 1, 5));
  const options = arr.map((_, i) => i).filter((i) => !avoid.includes(i));
  const idx = r.pick(options);
  recent.push(idx);
  if (recent.length > 8) recent.shift();
  return arr[idx];
}

let dragonSlain = false; // wird in advance() aus dem Spielstand gesetzt
function areaVars(areaId, extra = {}) {
  const a = areaId === 'drachenhorst' && dragonSlain ? { ...AREAS[areaId], foe: 'die verwaiste Drachenbrut' } : AREAS[areaId];
  const In = a.in.charAt(0).toUpperCase() + a.in.slice(1);
  return { A: a.name, zu: a.zu, in: a.in, In, aus: a.aus, F: a.foe, M: a.mat ? MATERIALS[a.mat].name : 'Gold', ...extra };
}

// ---------- Effekte (Ereignisse + Dorfprojekte) ----------

const ADDITIVE = new Set(['courage', 'moodHour']);

export function effectVal(s, key, { area = null, mat = null } = {}) {
  const add = ADDITIVE.has(key);
  let v = add ? 0 : 1;
  const apply = (m) => {
    if (m.key !== key || (m.area && m.area !== area) || (m.mat && m.mat !== mat)) return;
    v = add ? v + m.v : v * m.v;
  };
  for (const e of s.effects) if (e.until > s.t) e.mods.forEach(apply);
  for (const id of Object.keys(s.projects)) PROJECTS[id].mods.forEach(apply);
  villagerMods(s).forEach(apply);
  return v;
}

export function activeEffects(s) {
  return s.effects.filter((e) => e.until > s.t);
}

function addEffect(s, { label, icon, dur, mods, tag = null }) {
  s.effects.push({ label, icon, until: s.t + dur, mods, tag });
}

// ---------- Helden ----------

export function heroPower(h) {
  const w = h.weapon ? RECIPES[h.weapon].tier : 0;
  const a = h.armor ? RECIPES[h.armor].tier : 0;
  return 3 + h.level * 2 + WEAPON_POWER[w] + ARMOR_POWER[a];
}

export function areaDanger(s, areaId) {
  return AREAS[areaId].danger * (s ? effectVal(s, 'danger', { area: areaId }) : 1);
}

// Kraft eines Helden, wenn er dieses Teil statt seines aktuellen trüge
export function powerWith(h, recipeId) {
  const slot = RECIPES[recipeId].slot;
  return heroPower({ ...h, [slot]: recipeId });
}

export function gearPower(recipeId) {
  const rc = RECIPES[recipeId];
  if (rc.slot === 'weapon') return WEAPON_POWER[rc.tier];
  if (rc.slot === 'armor') return ARMOR_POWER[rc.tier];
  return 0;
}

// Erwartete Stunden bis zum nächsten Neuankömmling (nur tagsüber, solange Zimmer frei sind)
export function arrivalChance(s) {
  return Math.min(0.6, (0.06 + s.reputation * 0.004) * effectVal(s, 'arrival'));
}

export function successChance(h, areaId, s = null, power = heroPower(h)) {
  const ratio = power / areaDanger(s, areaId);
  const p = 1 / (1 + Math.exp(-(ratio - 1) * 4));
  return Math.min(0.97, Math.max(0.02, p));
}

// Feste Preise: Der Laden verkauft immer zum fairen Preis
export function priceOf(s, recipeId) {
  return fairPrice(recipeId);
}

// Geizige kaufen erst, wenn danach noch Gold übrig bleibt
export function canAfford(h, price) {
  return h.gold >= price * (h.traits.includes('geizig') ? 1.3 : 1);
}

export function matPrice(s, mat) {
  return Math.max(1, Math.round(MATERIALS[mat].price * effectVal(s, 'matPrice', { mat })));
}

export function xpNeeded(level) {
  return Math.round(30 * Math.pow(level, 1.8));
}

function addHero(s, r, { cls, silent = false, level = 1 } = {}) {
  const female = r.chance(0.5);
  const used = new Set(s.heroes.map((h) => h.name.split(' ')[0]));
  const pool = (female ? NAMES_F : NAMES_M).filter((n) => !used.has(n));
  const first = r.pick(pool.length ? pool : female ? NAMES_F : NAMES_M);
  const usedEpithets = new Set(s.heroes.map((h) => h.name.split(' ').slice(1).join(' ')));
  const epithets = EPITHETS.filter((e) => !usedEpithets.has(e));
  const name = r.chance(0.35) && epithets.length ? `${first} ${r.pick(epithets)}` : first;
  cls ??= r.pick(['krieger', 'waldlaeufer', 'magier']);

  const traitIds = Object.keys(TRAITS).filter((t) => !TRAITS[t].acquired);
  const t1 = r.pick(traitIds);
  let t2;
  do { t2 = r.pick(traitIds); } while (t2 === t1 || TRAIT_CONFLICTS.some(([a, b]) => (a === t1 && b === t2) || (a === t2 && b === t1)));

  const areaIds = Object.keys(AREAS);
  const fav = r.pick(areaIds);
  let hated = r.pick(areaIds.slice(1));
  if (hated === fav) hated = null;
  if (r.chance(0.3)) hated = null;

  const h = {
    id: s.nextId++, name, female, cls, level, xp: 0,
    weapon: null, armor: null, potions: 0,
    gold: r.int(15, 40) + level * 15,
    mood: r.int(55, 75),
    traits: [t1, t2], fav, hated,
    state: 'idle', until: 0, area: null, departedAt: 0, bountyTrip: false,
    nextThink: s.t + r.int(5, 30),
    thought: 'Mal sehen, was der Laden so hat.',
    form: r.range(0.7, 1.25), formDay: clockOf(s).day,
    lowMoodSince: null, refusalKey: null,
    adventures: 0, successes: 0, arrivedAt: s.t,
    look: {
      skin: r.int(0, 3), hair: r.int(0, 5), hairStyle: r.int(0, 2), beard: !female && r.chance(0.4),
    },
  };
  // höherstufige Neuankömmlinge bringen eigene, einfache Ausrüstung mit
  if (level >= 3) {
    const own = Object.entries(RECIPES).filter(([, rc]) => rc.cls === cls && rc.tier === 1);
    for (const [id, rc] of own) if (r.chance(0.6)) h[rc.slot] = id;
  }
  s.heroes.push(h);
  bio(s, h, '👋', `Kam als ${className(cls, female)} (Stufe ${level}) nach Eichenfurt.`);
  if (!silent) log(s, 'arrive', fmt(say(s, r, 'arrive', T.arrive), h), h.id);
  return h;
}

function has(h, trait) {
  return h.traits.includes(trait);
}

// icon: kleines Symbol für die Gedankenblase in der Dorfszene (null = keine Blase)
function setThought(h, text, icon = null) {
  h.thought = text;
  h.thoughtIcon = icon;
}

export function changeMood(h, d) {
  h.mood = Math.max(0, Math.min(100, h.mood + d));
}

// Bewertung aller Gebiete aus Sicht eines Helden
// power: abweichende Kraft, z. B. für einen gemeinsamen Ausflug mit einem Freund
export function evaluateAreas(s, h, { power = heroPower(h) } = {}) {
  const res = [];
  const rivalAhead = rivalsOf(s, h).some((o) => heroPower(o) > heroPower(h));
  for (const [id, a] of Object.entries(AREAS)) {
    const p = successChance(h, id, s, power);
    const avgGold = ((a.gold[0] + a.gold[1]) / 2) * effectVal(s, 'gold', { area: id });
    let bountyPer = 0;
    let bountyLeft = 0;
    if (a.mat) {
      for (const b of s.bounties) if (b.mat === a.mat) { bountyLeft += b.qty - b.delivered; bountyPer = Math.max(bountyPer, b.reward); }
    }
    const expectedPieces = Math.min(bountyLeft, h.cls === 'waldlaeufer' ? 2.5 : 2);
    const bountyValue = bountyPer * expectedPieces;
    const greed = has(h, 'gierig') ? 2 : 1;

    let threshold = 0.62;
    if (has(h, 'mutig')) threshold = 0.42;
    if (has(h, 'vorsichtig')) threshold = 0.8;
    if (has(h, 'ruhmsuechtig')) threshold = Math.min(threshold, 0.46);
    if (h.potions > 0) threshold -= 0.07;
    if (h.mood > 75) threshold -= 0.05;
    if (h.mood < 30) threshold += 0.08;
    // Frische Wunden: Wo man gerade erst schwer verletzt wurde, ist man zögerlicher
    if (freshScar(s, h, id) && !has(h, 'abgehaertet') && !has(h, 'uebermuetig')) threshold += 0.1;
    if (bountyValue > avgGold * 1.5) threshold -= has(h, 'gierig') ? 0.15 : 0.07;
    // Geldnot: Wer pleite ist, muss irgendwann losziehen – sonst bliebe er für immer in der Taverne sitzen
    if (h.gold < 40) threshold -= 0.12;
    // Ein stärkerer Rivale stachelt an; Turnierruhm macht mutig; persönliche Ziele locken
    if (rivalAhead) threshold -= 0.06;
    if ((h.challengeUntil ?? 0) > s.t) threshold -= 0.12;
    if ((h.boldUntil ?? 0) > s.t) threshold -= 0.08;
    threshold -= effectVal(s, 'courage');
    const goal = goalAreaBonus(h, id);
    threshold += goal.threshold;
    threshold = traitThreshold(h, Math.max(0.2, Math.min(0.9, threshold)));
    // Dein Rat: Ermutigt traut sich der Held (fast) alles zu, abgeraten meidet er das Gebiet
    const advice = h.advice && h.advice.until > s.t && h.advice.area === id ? h.advice.type : null;
    if (advice === 'encouraged') threshold = Math.min(threshold, Math.max(0.15, p - 0.01));
    const quest = questArea(s, h, id);
    if (quest) threshold = Math.min(threshold, Math.max(0.1, p - 0.01));

    let value = p * (avgGold + bountyValue * greed) * goal.value;
    if (advice === 'encouraged') value *= 3;
    if (quest) value *= 5;
    if (h.fav === id) value *= 1.4;
    if (has(h, 'ruhmsuechtig')) value *= 1 + a.danger / 50;
    // Unterforderung: Wer viel zu stark ist, hat wenig Lust auf Kleinkram
    const overpowered = heroPower(h) / a.danger;
    if (overpowered > 4 && bountyValue === 0) value *= 0.5;

    let block = null;
    if (h.hated === id) block = 'hated';
    else if (advice === 'discouraged') block = 'advice';
    else if (p < threshold) block = 'danger';
    // Die Narbe: dorthin nur noch mit Heiltrank (am Gürtel oder aus deinem Regal)
    else if (!quest && needsPotionFor(s, h, id)) block = 'scar';
    res.push({ id, p, value, threshold, bountyValue, block });
  }
  return res;
}

function needsPotionFor(s, h, areaId) {
  if (h.potions > 0 || has(h, 'uebermuetig') || !scarredIn(s, h, areaId)) return false;
  return !(s.shelf.some((it) => it.recipe === 'heiltrank') && h.gold >= priceOf(s, 'heiltrank'));
}

function sellToHero(s, h, recipe, price, idx) {
  h.gold -= price;
  s.gold += price;
  s.stats.sold += 1;
  s.stats.earned += price;
  s.shelf.splice(idx, 1);
}

function tryShopping(s, r, h) {
  // Wer dir etwas nachträgt, kauft nur widerwillig bei dir
  if (trustOf(h) <= -30 && r.chance(0.4)) {
    if (s.shelf.some((it) => RECIPES[it.recipe].cls === h.cls)) setThought(h, r.pick(THOUGHTS.grudge), '😒');
    return false;
  }
  let bought = false;
  for (const slot of ['weapon', 'armor']) {
    const curTier = h[slot] ? RECIPES[h[slot]].tier : 0;
    const candidates = s.shelf
      .map((it, idx) => ({ ...it, idx, rc: RECIPES[it.recipe] }))
      .filter((it) => it.rc.cls === h.cls && it.rc.slot === slot && it.rc.tier > curTier)
      .sort((a, b) => b.rc.tier - a.rc.tier);
    if (!candidates.length) continue;

    let refusal = null;
    for (const it of candidates) {
      const price = priceOf(s, it.recipe);
      if (!canAfford(h, price)) { refusal ??= fmt(THOUGHTS.wantItem[0], h, { x: it.rc.name, p: price }); continue; }

      if (offerLastItem(s, r, h, it.recipe)) { setThought(h, fmt('{x} – das letzte Stück! Und ausgerechnet jetzt …', h, { x: it.rc.name }), '🛒'); break; }
      purchase(s, r, h, it.recipe, it.idx);
      bought = true;
      refusal = null;
      break;
    }
    if (refusal) setThought(h, refusal, '🛒');
  }
  if (bought) checkHeroGoal(s, r, h);
  return bought;
}

function purchase(s, r, h, recipe, idx) {
  const rc = RECIPES[recipe];
  const price = priceOf(s, recipe);
  sellToHero(s, h, recipe, price, idx);
  s.reputation += rc.tier;
  h[rc.slot] = recipe;
  changeMood(h, 6);
  log(s, 'buy', fmt(say(s, r, 'buy.' + rc.slot, T.buy[rc.slot]), h, { x: `**${rc.name}**` }) + ` (+${price} 🪙)`, h.id);
  bio(s, h, '🛒', `Kaufte ${rc.name} bei dir.`, true);
  setThought(h, `${rc.name}! Das muss ich gleich ausprobieren.`, '✨');
  // Gute Ware schafft Vertrauen – aber nur bis zu einem gewissen Grad
  if (trustOf(h) < 20) changeTrust(h, 1);
  // Der Rivale sieht das gar nicht gern
  for (const o of rivalsOf(s, h)) setThought(o, fmt(r.pick(THOUGHTS.rivalAhead), o, { o: h.name }), '💢');
}

// Für Besucher am Tresen: ein Teil aus dem Regal geht an den Helden – geschenkt (price 0) oder zum Sonderpreis
export function giveItem(s, h, recipe, price = 0) {
  const idx = s.shelf.findIndex((it) => it.recipe === recipe);
  if (idx < 0 || h.gold < price) return false;
  const rc = RECIPES[recipe];
  s.shelf.splice(idx, 1);
  h.gold -= price;
  s.gold += price;
  if (price > 0) { s.stats.sold += 1; s.stats.earned += price; }
  if (rc.slot === 'potion') h.potions += 1;
  else h[rc.slot] = recipe;
  return true;
}

// Für Bitten (Vorschuss): genau dieses Teil kaufen, falls es noch im Regal liegt
export function buyItem(s, r, h, recipe) {
  const idx = s.shelf.findIndex((it) => it.recipe === recipe);
  if (idx < 0 || h.gold < priceOf(s, recipe)) return false;
  purchase(s, r, h, recipe, idx);
  checkHeroGoal(s, r, h);
  return true;
}

function buyPotion(s, r, h, force = false) {
  // Übermütige glauben, keinen Heiltrank zu brauchen
  if (h.potions > 0 || has(h, 'uebermuetig')) return;
  const idx = s.shelf.findIndex((it) => it.recipe === 'heiltrank');
  if (idx < 0) return;
  const price = priceOf(s, 'heiltrank');
  // Vorsichtige und Spendable greifen sofort zu, alle anderen nur mit Rücklage
  const reserve = force || has(h, 'spendabel') || has(h, 'vorsichtig') ? 1 : has(h, 'geizig') ? 2 : 1.5;
  if (h.gold < price * reserve) return;
  sellToHero(s, h, 'heiltrank', price, idx);
  h.potions += 1;
  log(s, 'buy', fmt(say(s, r, 'buyPotion', T.buyPotion), h) + ` (+${price} 🪙)`, h.id);
}

function think(s, r, h) {
  h.nextThink = s.t + r.int(15, 40);
  const { day } = clockOf(s);
  if (h.formDay !== day) { h.formDay = day; h.form = r.range(0.6, 1.3); }
  checkHeroGoal(s, r, h);

  if (isNight(s)) {
    setThought(h, r.pick(THOUGHTS.night));
    return;
  }

  tryShopping(s, r, h);

  if (effectVal(s, 'depart') === 0) {
    const e = activeEffects(s).find((x) => x.mods.some((m) => m.key === 'depart'));
    setThought(h, fmt(r.pick(THOUGHTS.staying), h, { x: e?.label ?? 'Fest' }), '🎉');
    return;
  }

  const evals = evaluateAreas(s, h);
  const feasible = evals.filter((e) => !e.block).sort((a, b) => b.value - a.value);
  const topBounty = evals.filter((e) => e.bountyValue > 0).sort((a, b) => b.bountyValue - a.bountyValue)[0];
  const best = feasible[0];

  // Lust: Tagesform, Laune, Wesenszüge, Geldbeutel
  let drive = h.form * (0.5 + h.mood / 200);
  if (has(h, 'eifrig')) drive *= 1.35;
  if (has(h, 'faul')) drive *= 0.6;
  let goChance = drive * 0.65;
  if (h.gold < 30) goChance += 0.2;
  if (h.gold > 400 + h.level * 60) goChance -= 0.2;
  if (best && best.bountyValue > 0) goChance += 0.15 * (has(h, 'gierig') ? 2 : 1);
  if (best && effectVal(s, 'gold', { area: best.id }) > 1.5) goChance += 0.2;
  goChance += goalDrive(s, h) + traitDrive(h);
  if ((h.challengeUntil ?? 0) > s.t) goChance += 0.15;
  if (best && h.advice?.type === 'encouraged' && h.advice.area === best.id) goChance += 0.3;
  if (best && questArea(s, h, best.id)) goChance += 0.5;
  goChance = Math.max(0.05, Math.min(0.95, goChance));

  // Mit einem Freund trauen sich Helden mehr zu – und haben öfter Lust
  const party = findParty(s, r, h, best);
  if (party && r.chance(Math.min(0.95, goChance + 0.15))) {
    departParty(s, r, h, party.friend, party.eval, party.bold);
    return;
  }

  const go = best && r.chance(goChance);

  // Begründung, warum das wichtigste Kopfgeld liegen bleibt
  if (topBounty && (!go || best.id !== topBounty.id)) {
    let reason = null;
    const v = areaVars(topBounty.id);
    if (topBounty.block === 'scar') {
      reason = fmt(r.pick(THOUGHTS.scar), h, v);
    } else if (topBounty.block === 'hated') {
      reason = topBounty.id === 'spinnenhoehle' ? THOUGHTS.hatedSpider[0] : fmt(r.pick(THOUGHTS.hated), h, v);
    } else if (topBounty.block === 'danger') {
      reason = !h.weapon && !h.armor ? fmt(THOUGHTS.tooDangerousNoGear[0], h, v) : fmt(r.pick(THOUGHTS.tooDangerous), h, v);
    }
    if (reason) {
      const key = `${topBounty.id}:${topBounty.block}:${day}`;
      if (h.refusalKey !== key) {
        h.refusalKey = key;
        const intro = say(s, r, 'refuseIntro', T.refuseIntro);
        log(s, 'refuse', `${fmt(intro, h)} „${reason}“`, h.id);
      }
      if (!go) { setThought(h, reason, topBounty.block === 'hated' ? '😖' : topBounty.block === 'scar' ? '🧪' : '😨'); return; }
    }
  }

  if (!best) {
    const scar = evals.find((e) => e.block === 'scar');
    if (scar) setThought(h, fmt(r.pick(THOUGHTS.scar), h, areaVars(scar.id)), '🧪');
    else setThought(h, fmt(r.pick(THOUGHTS.tooDangerous), h, areaVars('kornfelder')), '😨');
    return;
  }
  if (!go) {
    const memory = r.chance(0.3) ? memoryThought(h, r) : null;
    if (memory) setThought(h, memory, '💭');
    else if (h.gold > 400 + h.level * 60) setThought(h, THOUGHTS.rich[0], '💰');
    else if (h.mood < 30) setThought(h, r.pick(THOUGHTS.moody), '😠');
    else if (h.goal && r.chance(0.45)) setThought(h, goalThought(s, r, h), '🌟');
    else setThought(h, r.pick(THOUGHTS.lazy), '🍺');
    return;
  }
  departSolo(s, r, h, best);
}

function sendAway(s, r, h, ev, until) {
  if (scarredIn(s, h, ev.id)) buyPotion(s, r, h, true);
  else if (AREAS[ev.id].danger >= 9) buyPotion(s, r, h);
  h.state = 'away';
  h.area = ev.id;
  h.departedAt = s.t;
  h.until = until;
  h.bountyTrip = ev.bountyValue > 0;
  h.chance = ev.p;
  // Folgt der Held deinem Zuspruch? Dann wird das Ergebnis dir zugeschrieben
  h.advisedTrip = h.advice?.type === 'encouraged' && h.advice.area === ev.id && h.advice.until > s.t;
  if (h.advisedTrip) h.advice = null;
}

function tripDuration(s, r, areaId) {
  return Math.round(AREAS[areaId].time * r.range(0.85, 1.2) * effectVal(s, 'duration'));
}

// bold: Das Gebiet wäre allein zu gefährlich – das ist eine Geschichte wert
function departParty(s, r, h, f, ev, bold) {
  const until = s.t + tripDuration(s, r, ev.id);
  sendAway(s, r, h, ev, until);
  sendAway(s, r, f, { ...ev, bountyValue: ev.bountyValue }, until);
  h.partyWith = f.id;
  f.partyWith = h.id;
  h.partyBold = f.partyBold = bold || h.bountyTrip;
  const v = areaVars(ev.id);
  if (h.partyBold) {
    log(s, 'party', fmt(say(s, r, 'partyDepart', T.partyDepart), h, { ...v, o: `**${f.name}**` }), h.id, { other: f.id });
    bio(s, h, '🤝', `Wagte sich gemeinsam mit ${f.name} ${AREAS[ev.id].zu}.`);
    bio(s, f, '🤝', `Wagte sich gemeinsam mit ${h.name} ${AREAS[ev.id].zu}.`);
  }
  setThought(h, fmt('Zusammen mit {o} {zu}!', h, { ...v, o: f.name }));
  setThought(f, fmt('Zusammen mit {o} {zu}!', f, { ...v, o: h.name }));
}

function departSolo(s, r, h, best) {
  sendAway(s, r, h, best, s.t + tripDuration(s, r, best.id));
  // Aufbruch
  const v = areaVars(best.id);
  // In die Chronik kommt ein Aufbruch nur, wenn er einem deiner Kopfgelder gilt
  if (h.bountyTrip) {
    const tpl = best.p < 0.5 ? say(s, r, 'departBrave', T.departBrave) : say(s, r, 'departBounty', T.departBounty);
    log(s, 'depart', fmt(tpl, h, v), h.id);
  }
  setThought(h, fmt(r.pick(h.bountyTrip ? THOUGHTS.goingBounty : THOUGHTS.going), h, v));
}

function deliverBounty(s, r, h, mat, count) {
  let delivered = 0;
  let paid = 0;
  // höchstes Kopfgeld zuerst bedienen
  const list = s.bounties.filter((b) => b.mat === mat).sort((a, b) => b.reward - a.reward);
  for (const b of list) {
    while (count > 0 && b.delivered < b.qty) {
      b.delivered++; count--; delivered++;
      paid += b.reward;
      s.mats[mat] += 1;
    }
  }
  s.bounties = s.bounties.filter((b) => b.delivered < b.qty);
  if (delivered > 0) {
    h.gold += paid;
    h.bountiesDone = (h.bountiesDone ?? 0) + 1;
    h.bountyMats ??= [];
    if (!h.bountyMats.includes(mat)) {
      h.bountyMats.push(mat);
      bio(s, h, '📦', `Kassierte zum ersten Mal dein Kopfgeld auf ${MATERIALS[mat].name}.`, true);
    }
    s.reputation += 2 * delivered;
    s.stats.delivered[mat] = (s.stats.delivered[mat] ?? 0) + delivered;
    changeMood(h, 5);
    log(s, 'deliver', fmt(say(s, r, 'deliver', T.deliver), h, { x: `**${delivered}× ${MATERIALS[mat].name}** ${MATERIALS[mat].icon}` }) + ` (${paid} 🪙 Kopfgeld)`, h.id);
  }
}

// Gemeinsamer Ausflug zweier Freunde: ein gemeinsamer Ausgang, eine gemeinsame Geschichte
function returnParty(s, r, a, b) {
  const roll = r();
  const success = roll < a.chance;
  const v = areaVars(a.area);
  const kind = success ? 'success' : 'fail';
  const tpl = success ? say(s, r, 'partySuccess', T.partySuccess) : say(s, r, 'partyFail', T.partyFail);
  // Ein gewöhnlicher gemeinsamer Erfolg bleibt still – wie bei Einzelnen
  if (a.partyBold || !success) log(s, kind, fmt(tpl, a, { ...v, o: `**${b.name}**` }), a.id, { other: b.id, party: true, injured: !success });
  a.partyBold = b.partyBold = false;
  returnHome(s, r, a, { roll, quiet: true });
  returnHome(s, r, b, { roll, quiet: true });
  changeRelation(s, r, a, b, success ? r.int(6, 12) : r.int(2, 6));
}

// opts.roll: vorgegebener Würfelwurf (gemeinsame Ausflüge), opts.quiet: keine eigenen Rückkehr-Texte
function returnHome(s, r, h, opts = {}) {
  const a = AREAS[h.area];
  const v = areaVars(h.area);
  h.adventures++;
  s.stats.adventures++;
  h.partyWith = null;

  const roll = opts.roll ?? r();
  const success = roll < h.chance;
  // Die Chronik erzählt nur, was dich betrifft: Kopfgeld-Ausflüge und Niederlagen.
  // Ein gewöhnlicher, erfolgreicher Ausflug läuft still im Hintergrund.
  const notable = !opts.quiet && (h.bountyTrip || !success);

  // eine kleine Geschichte von unterwegs
  const tales = h.area === 'drachenhorst' && dragonSlain ? 'drachenhorstDanach' : h.area;
  if (notable && r.chance(0.6)) log(s, 'story', fmt(say(s, r, 'story.' + tales, T.story[tales]), h, v), h.id);
  let gold = 0;
  let xp = 0;
  let pieces = 0;
  if (success) {
    gold = Math.round(r.int(a.gold[0], a.gold[1]) * effectVal(s, 'gold', { area: h.area }));
    xp = a.danger * 3 + 5;
    pieces = a.mat ? r.int(1, 3) + (h.cls === 'waldlaeufer' && r.chance(0.5) ? 1 : 0) : 0;
    h.successes++;
    s.stats.successes++;
    s.stats.areaWins[h.area] = (s.stats.areaWins[h.area] ?? 0) + 1;
    h.areaWins = h.areaWins ?? {};
    h.areaWins[h.area] = (h.areaWins[h.area] ?? 0) + 1;
    if (h.areaWins[h.area] === 1) {
      bio(s, h, '🏆', `Erster Sieg ${a.in}.`);
      const gear = h.weapon ?? h.armor;
      if (gear) remember(s, h, 'firstWin', { area: h.area, item: RECIPES[gear].name });
      h.tale = { area: h.area, t: s.t, kind: 'first' };
    } else if (roll > h.chance - 0.1 && a.danger >= 9) h.tale = { area: h.area, t: s.t, kind: 'close' };
    // Wer dir vertraut, denkt unterwegs an dich
    if (a.mat && trustOf(h) >= 50 && r.chance(0.05)) {
      s.mats[a.mat] += 1;
      log(s, 'gift', fmt('🎁 {n} hat dir {aus} etwas mitgebracht: {M}. „Für dich. Einfach so.“', h, v), h.id, { mat: a.mat });
      bio(s, h, '🎁', `Brachte dir ${a.aus} ${MATERIALS[a.mat].name} mit.`, true);
    }
    // Nur Siege, bei denen wirklich etwas auf dem Spiel stand, steigen zu Kopf
    if (h.chance < 0.85) bump(h, 'winStreak');
    // Siege lassen alte Niederlagen verblassen
    life(h).heavyDefeats = Math.max(0, (life(h).heavyDefeats ?? 0) - 0.5);
    s.reputation += 1;
    changeMood(h, 4 + (h.fav === h.area ? 3 : 0));
    const tpl = roll > h.chance - 0.1 ? say(s, r, 'successClose', T.successClose) : say(s, r, 'success', T.success);
    if (notable) log(s, 'success', fmt(tpl, h, v) + ` (+${gold} 🪙)`, h.id);
    // manchmal ein kleiner Nachsatz passend zum Wesen
    const trait = h.traits.find((t) => T.traitFlavor[t]);
    if (notable && trait && r.chance(0.25)) log(s, 'story', fmt(say(s, r, 'trait.' + trait, T.traitFlavor[trait]), h, v), h.id);
    h.state = 'rest';
    h.until = s.t + Math.round((25 + a.time * 0.3) * effectVal(s, 'rest'));
  } else if (h.potions > 0) {
    h.potions--;
    gold = Math.round(r.int(a.gold[0], a.gold[1]) * 0.3);
    xp = a.danger;
    pieces = a.mat && r.chance(0.4) ? 1 : 0;
    changeMood(h, -4);
    life(h).winStreak = 0;
    bio(s, h, '🧪', `Dein Heiltrank rettete ${h.female ? 'ihr' : 'ihm'} ${a.in} das Leben.`, true);
    remember(s, h, 'saved', { area: h.area });
    if (!opts.quiet) log(s, 'escape', fmt(say(s, r, 'escape', T.escape), h, v), h.id);
    // Der Heiltrank verhindert das Schlimmste – ein paar Schrammen und Prellungen bleiben
    h.state = 'injured';
    h.wound = 'light';
    h.until = s.t + Math.round((60 + a.time * 0.5) * effectVal(s, 'injury') * (has(h, 'abgehaertet') ? 0.6 : 1));
  } else {
    xp = Math.round(a.danger * 0.8);
    const lost = Math.round(h.gold * 0.15);
    h.gold -= lost;
    // Abgehärtete stecken Niederlagen besser weg
    changeMood(h, has(h, 'abgehaertet') ? -7 : -14);
    life(h).winStreak = 0;
    bump(h, 'heavyDefeats');
    bump(h, 'injuries');
    bio(s, h, '🤕', `Kam schwer verletzt ${a.aus} zurück.`);
    remember(s, h, 'hurt', { area: h.area });
    if (!opts.quiet) log(s, 'fail', fmt(say(s, r, 'fail', T.fail), h, v) + (lost ? ` (${lost} 🪙 verloren)` : ''), h.id, { injured: true });
    // Freunde machen sich Sorgen
    for (const f of friendsOf(s, h)) { changeMood(f, -4); setThought(f, fmt(THOUGHTS.friendHurt[0], f, { o: h.name }), '💛'); }
    // Schwere Niederlage (ohne Heiltrank): höchstens ein Ausrüstungsteil kann zerbrechen
    const gear = ['weapon', 'armor'].filter((slot) => h[slot]);
    if (gear.length && r.chance(0.15)) {
      const slot = r.pick(gear);
      const name = RECIPES[h[slot]].name;
      h[slot] = null;
      changeMood(h, -6);
      log(s, 'broken', fmt(say(s, r, 'gearBroken', T.gearBroken), h, { ...v, x: `**${name}**` }), h.id, { item: name });
      bio(s, h, '💥', `${name} zerbrach ${a.in}.`);
      remember(s, h, 'gearBroke', { area: h.area, item: name, slot });
    }
    h.state = 'injured';
    h.wound = 'heavy';
    const base = (r.int(180, 360) + a.danger * 2) * effectVal(s, 'injury') * (has(h, 'abgehaertet') ? 0.6 : 1);
    h.until = s.t + Math.round(h.cls === 'krieger' ? base * 0.7 : base);
  }
  // Folgen deines Rats: Der Held hat sich auf deinen Zuspruch hin hierher gewagt
  if (h.advisedTrip) {
    h.advisedTrip = false;
    const ihm = h.female ? 'ihr' : 'ihm';
    if (success) {
      bump(h, 'goodAdvice'); bump(h, 'joy');
      remember(s, h, 'goodAdvice', { area: h.area });
      changeMood(h, 8);
      log(s, 'advice', fmt(`🗣️ Weil du {ihm} Mut gemacht hast, wagte sich {n} {zu} – und siegte! „Danke für deinen Rat!“`, h, v), h.id, { good: true });
      bio(s, h, '✋', `Wagte sich auf deinen Rat hin ${a.zu} – und siegte.`, true);
    } else if (h.state !== 'injured') {
      log(s, 'advice', fmt(`🗣️ Auf deinen Rat hin zog {n} {zu}. Es ging schief – nur ein Heiltrank rettete {ihn}.`, h, v), h.id);
      bio(s, h, '✋', `Wagte sich auf deinen Rat hin ${a.zu} und musste fliehen.`, true);
    } else {
      bump(h, 'badAdvice');
      remember(s, h, 'badAdvice', { area: h.area });
      log(s, 'advice', fmt(`🗣️ Auf deinen Rat hin zog {n} {zu} – und kam verwundet zurück. „Das hast du ja toll eingefädelt.“`, h, v), h.id, { bad: true });
      bio(s, h, '✋', `Wagte sich auf deinen Rat hin ${a.zu} und kam schwer verletzt zurück. Das nimmt ${ihm} dir übel.`, true);
    }
  }
  h.gold += gold;
  // Lehrlinge lernen schneller, solange ihr Lehrmeister da ist
  const mentor = h.mentor ? s.heroes.find((x) => x.id === h.mentor) : null;
  h.xp += Math.round(xp * (mentor ? 1.6 : 1) * effectVal(s, 'xp'));
  while (h.xp >= xpNeeded(h.level)) {
    h.xp -= xpNeeded(h.level);
    h.level++;
    log(s, 'level', fmt(say(s, r, 'levelUp', T.levelUp), h, { x: h.level }), h.id, { level: h.level });
    bio(s, h, '⭐', `Erreichte Stufe ${h.level}.`);
    for (const o of rivalsOf(s, h)) { changeMood(o, -3); setThought(o, fmt(r.pick(THOUGHTS.rivalAhead), o, { o: h.name }), '💢'); }
  }
  if (pieces > 0) {
    if (h.bountyTrip || s.bounties.some((b) => b.mat === a.mat)) deliverBounty(s, r, h, a.mat, pieces);
    // ungewollte Beute verkaufen Helden an den Hausierer
    else h.gold += pieces * Math.round(MATERIALS[a.mat].value * 0.3);
  }
  // Taverne kostet
  const tavern = Math.min(h.gold, 4 + h.level * 2);
  h.gold -= tavern;
  const tripArea = h.area;
  h.area = null;
  h.bountyTrip = false;
  setThought(h, h.state === 'injured' ? r.pick(THOUGHTS.injured) : r.pick(THOUGHTS.resting));
  sagaAfterTrip(s, r, h, tripArea, success);
  if (mentor && h.level >= mentor.level - 1) graduate(s, r, h, mentor);
  repayDebt(s, h);
  checkHeroGoal(s, r, h);
  checkGrowth(s, r, h);
}

// Ein Lehrling hat ausgelernt – und nimmt vielleicht etwas vom Wesen des Lehrmeisters mit
function graduate(s, r, h, mentor) {
  h.mentor = null;
  changeMood(h, 10); changeMood(mentor, 10);
  log(s, 'growth', fmt('🎓 {n} hat bei {o} ausgelernt. Der Lehrmeister ist sichtlich stolz.', h, { o: `**${mentor.name}**` }), h.id, { graduated: mentor.id });
  bio(s, h, '🎓', `Hat bei ${mentor.name} ausgelernt.`, true);
  bio(s, mentor, '🎓', `${h.name} hat bei ${mentor.female ? 'ihr' : 'ihm'} ausgelernt.`, true);
  const inherit = mentor.traits.filter((t) => !TRAITS[t].acquired && !h.traits.includes(t) &&
    !TRAIT_CONFLICTS.some(([a, b]) => (a === t && h.traits.includes(b)) || (b === t && h.traits.includes(a))));
  if (inherit.length && r.chance(0.6)) growTrait(s, r, h, r.pick(inherit), `ganz wie ${mentor.female ? 'die Lehrmeisterin' : 'der Lehrmeister'} ${mentor.name}`, true);
}

function repayDebt(s, h) {
  if (!h.debt || h.gold < h.debt.amount + 10) return;
  const late = s.t > h.debt.due;
  h.gold -= h.debt.amount;
  s.gold += h.debt.amount;
  log(s, 'loan', fmt(late ? '💰 Spät, aber doch: {n} zahlt dir die {x} Gold Vorschuss zurück.' : '💰 {n} zahlt dir die {x} Gold Vorschuss zurück – mit einem dankbaren Nicken.', h, { x: h.debt.amount }), h.id);
  bio(s, h, '💰', `Zahlte dir ${h.debt.amount} Gold Vorschuss zurück.`, true);
  bump(h, 'joy');
  h.debt = null;
}

// Fällige Schulden, die nicht bezahlt werden können
function checkDebts(s, r) {
  for (const h of s.heroes) {
    if (!h.debt || s.t < h.debt.due + 24 * 60) continue;
    if (h.gold >= h.debt.amount) { repayDebt(s, h); continue; }
    log(s, 'loan', fmt('💰 {n} kann dir die {x} Gold Vorschuss nicht zurückzahlen und schämt sich. Die Schuld ist verloren.', h, { x: h.debt.amount }), h.id);
    bio(s, h, '💰', `Blieb dir ${h.debt.amount} Gold schuldig.`, true);
    changeMood(h, -6);
    h.debt = null;
  }
}

// ---------- Werkstatt ----------

// Fehlende Grundstoffe werden beim Herstellen automatisch beim Händler gekauft.
// Seltene Materialien müssen dagegen auf Lager sein.
export function craftCost(s, recipeId) {
  let gold = 0;
  for (const [m, n] of Object.entries(RECIPES[recipeId].mats)) {
    const missing = Math.max(0, n - s.mats[m]);
    if (missing && MATERIALS[m].basic) gold += missing * matPrice(s, m);
  }
  return gold;
}

export function missingRare(s, recipeId) {
  return Object.entries(RECIPES[recipeId].mats).filter(([m, n]) => !MATERIALS[m].basic && s.mats[m] < n).map(([m]) => m);
}

export function canCraft(s, recipeId) {
  const rc = RECIPES[recipeId];
  if (rc.tier > building(s, 'schmiede').tier) return false;
  return missingRare(s, recipeId).length === 0 && s.gold >= craftCost(s, recipeId);
}

export function queueCraft(s, recipeId) {
  if (!canCraft(s, recipeId) || s.queue.length >= 10) return false;
  for (const [m, n] of Object.entries(RECIPES[recipeId].mats)) {
    const missing = Math.max(0, n - s.mats[m]);
    if (missing) buyMaterial(s, m, missing);
  }
  for (const [m, n] of Object.entries(RECIPES[recipeId].mats)) s.mats[m] -= n;
  s.queue.push(recipeId);
  fillSlots(s);
  return true;
}

export function cancelQueued(s, index) {
  const id = s.queue[index];
  if (!id) return;
  for (const [m, n] of Object.entries(RECIPES[id].mats)) s.mats[m] += n;
  s.queue.splice(index, 1);
}

// Reihenfolge ändern: Eintrag eine Position nach vorn
export function prioritizeQueued(s, index) {
  if (index <= 0 || index >= s.queue.length) return;
  [s.queue[index - 1], s.queue[index]] = [s.queue[index], s.queue[index - 1]];
}

export function craftTime(s, recipeId) {
  const rc = RECIPES[recipeId];
  let time = rc.time / (building(s, 'schmiede').speed * effectVal(s, 'forge'));
  if (rc.slot === 'potion') time *= effectVal(s, 'potionTime');
  return Math.max(1, Math.round(time));
}

function fillSlots(s) {
  for (let i = 0; i < s.slots.length; i++) {
    if (!s.slots[i] && s.queue.length) {
      const id = s.queue.shift();
      s.slots[i] = { recipe: id, start: s.t, end: s.t + craftTime(s, id) };
    }
  }
}

function processCrafting(s) {
  const cap = building(s, 'laden').shelf;
  for (let i = 0; i < s.slots.length; i++) {
    const job = s.slots[i];
    if (!job || job.end > s.t) continue;
    if (routeToOrder(s, job.recipe)) {
      s.stats.crafted++;
      s.slots[i] = null;
      continue;
    }
    if (s.shelf.length >= cap) {
      if (!job.blocked) { job.blocked = true; log(s, 'craft', fmt(T.shelfFull[0], null, { x: `**${RECIPES[job.recipe].name}**` })); }
      continue;
    }
    s.shelf.push({ recipe: job.recipe });
    s.stats.crafted++;
    s.slots[i] = null;
  }
  fillSlots(s);
}

export function buyMaterial(s, mat, n) {
  const m = MATERIALS[mat];
  const cost = matPrice(s, mat) * n;
  if (!m.basic || s.gold < cost) return false;
  s.gold -= cost;
  s.mats[mat] += n;
  return true;
}

export function sellFromShelf(s, index) {
  const it = s.shelf[index];
  if (!it) return;
  s.gold += Math.floor(fairPrice(it.recipe) * 0.5);
  s.shelf.splice(index, 1);
}

// Alle Regalplätze, deren Rezept passt, auf einmal an den Händler verkaufen; liefert den Erlös
export function sellAllFromShelf(s, pred) {
  let gold = 0;
  s.shelf = s.shelf.filter((it) => {
    if (!pred(it.recipe)) return true;
    gold += Math.floor(fairPrice(it.recipe) * 0.5);
    return false;
  });
  s.gold += gold;
  return gold;
}

// ---------- Kopfgelder ----------

export function postBounty(s, mat, reward, qty) {
  const cost = reward * qty;
  if (s.gold < cost || reward < 1 || qty < 1) return false;
  s.gold -= cost;
  s.bounties.push({ id: s.nextId++, mat, reward, qty, delivered: 0, posted: s.t });
  s.stats.bountiesPosted++;
  log(s, 'bounty', `Du hängst ein Kopfgeld aus: **${qty}× ${MATERIALS[mat].name}** ${MATERIALS[mat].icon} für je ${reward} 🪙.`);
  return true;
}

export function cancelBounty(s, id) {
  const b = s.bounties.find((x) => x.id === id);
  if (!b) return;
  s.gold += b.reward * (b.qty - b.delivered);
  s.bounties = s.bounties.filter((x) => x.id !== id);
}

// ---------- Bestellungen ----------

const CLIENTS = [
  { name: 'Hauptmann Brandt von der Stadtwache', icon: '💂', prefer: 'krieger',
    intro: 'Meine Männer brauchen anständige Ausrüstung. Und zwar pünktlich.' },
  { name: 'Fürstin Ysmene von Rabenstein', icon: '👑', prefer: null,
    intro: 'Mein Gefolge reist in Kürze. Ich zahle gut – für Verspätung habe ich kein Verständnis.' },
  { name: 'Bruder Anselm vom Kloster', icon: '⛪', prefer: 'potion',
    intro: 'Die Kranken im Hospiz warten auf Heiltränke. Gott vergelt\'s – und das Kloster auch.' },
  { name: 'Jagdmeisterin Wilma', icon: '🦌', prefer: 'waldlaeufer',
    intro: 'Die große Jagd steht bevor. Meine Treiber brauchen Ausrüstung.' },
  { name: 'Magister Quirin von der Akademie', icon: '📚', prefer: 'magier',
    intro: 'Für die neuen Studenten – sie fackeln sonst wieder die Bibliothek ab.' },
  { name: 'Die Kaufmannsgilde', icon: '💰', prefer: null,
    intro: 'Eine Lieferung für unsere Karawanenwachen. Die Gilde zahlt mit Aufschlag.' },
];

function generateOrder(s, r) {
  // Manchmal bestellt jemand aus dem Dorf: ein sesshaft gewordener Held
  const locals = villagers(s);
  const local = locals.length && r.chance(0.35) ? r.pick(locals) : null;
  const client = local
    ? { name: `${local.name}, ${ROLES[local.cls].name(local.female)}`, icon: '🏡', prefer: local.cls === 'magier' && r.chance(0.5) ? 'potion' : local.cls, intro: ROLES[local.cls].order }
    : r.pick(CLIENTS);
  const maxTier = building(s, 'schmiede').tier;
  let pool = Object.keys(RECIPES).filter((id) => RECIPES[id].tier <= maxTier);
  if (client.prefer === 'potion') pool = ['heiltrank'];
  else if (client.prefer) pool = pool.filter((id) => RECIPES[id].cls === client.prefer || id === 'heiltrank');
  // eher die aktuell höchste und die einfachste Stufe
  const lines = [];
  const n = pool.length > 2 && r.chance(0.45) ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const options = pool.filter((id) => !lines.some((l) => l.recipe === id));
    const weighted = options.flatMap((id) => (RECIPES[id].tier === maxTier ? [id, id] : [id]));
    const recipe = r.pick(weighted);
    const rc = RECIPES[recipe];
    const qty = rc.slot === 'potion' ? r.int(3, 6) : rc.tier === 1 ? r.int(2, 4) : r.int(1, 3);
    lines.push({ recipe, qty, filled: 0 });
  }
  const value = lines.reduce((sum, l) => sum + fairPrice(l.recipe) * l.qty, 0);
  const work = lines.reduce((sum, l) => sum + RECIPES[l.recipe].time * l.qty, 0) / s.slots.length;
  const tier = Math.max(...lines.map((l) => RECIPES[l.recipe].tier));
  return {
    id: s.nextId++, client: client.name, icon: client.icon, intro: client.intro,
    lines,
    reward: Math.round((value * r.range(1.15, 1.35)) / 5) * 5,
    rep: 2 + tier,
    duration: Math.round(Math.max(10 * 60, work * 2 + 8 * 60) / 60) * 60,
    state: 'offered', offerUntil: s.t + OFFER_WAIT, deadline: null,
  };
}

export function acceptOrder(s, id) {
  const o = s.orders.find((x) => x.id === id && x.state === 'offered');
  if (!o) return false;
  o.state = 'active';
  o.deadline = s.t + o.duration;
  fillOrderFromShelf(s, id);
  return true;
}

export function declineOrder(s, id) {
  const o = s.orders.find((x) => x.id === id && x.state === 'offered');
  if (!o) return;
  s.orders = s.orders.filter((x) => x !== o);
}

function orderNeeds(o, recipe) {
  return o.state === 'active' && o.lines.some((l) => l.recipe === recipe && l.filled < l.qty);
}

function routeToOrder(s, recipe) {
  const o = s.orders.filter((x) => orderNeeds(x, recipe)).sort((a, b) => a.deadline - b.deadline)[0];
  if (!o) return false;
  o.lines.find((l) => l.recipe === recipe && l.filled < l.qty).filled++;
  checkOrderComplete(s, o);
  return true;
}

export function fillOrderFromShelf(s, id) {
  const o = s.orders.find((x) => x.id === id);
  if (!o) return 0;
  let moved = 0;
  for (let i = s.shelf.length - 1; i >= 0; i--) {
    if (orderNeeds(o, s.shelf[i].recipe)) {
      o.lines.find((l) => l.recipe === s.shelf[i].recipe && l.filled < l.qty).filled++;
      s.shelf.splice(i, 1);
      moved++;
    }
  }
  checkOrderComplete(s, o);
  return moved;
}

function checkOrderComplete(s, o) {
  if (o.state !== 'active' || o.lines.some((l) => l.filled < l.qty)) return;
  s.gold += o.reward;
  s.stats.earned += o.reward;
  s.stats.ordersDone++;
  s.reputation += o.rep;
  s.orders = s.orders.filter((x) => x !== o);
  log(s, 'order', `${o.icon} Die Bestellung für **${o.client}** ist vollständig und wird abgeholt. (+${o.reward} 🪙, Ruf +${o.rep})`, null, { done: true });
}

function processOrders(s, r) {
  for (const o of [...s.orders]) {
    if (o.state === 'offered' && s.t >= o.offerUntil) {
      s.orders = s.orders.filter((x) => x !== o);
      log(s, 'order', `${o.icon} **${o.client}** hat nicht länger auf deine Antwort gewartet.`);
    } else if (o.state === 'active' && s.t >= o.deadline) {
      s.orders = s.orders.filter((x) => x !== o);
      const cap = building(s, 'laden').shelf;
      for (const l of o.lines) for (let i = 0; i < l.filled; i++) if (s.shelf.length < cap) s.shelf.push({ recipe: l.recipe });
      s.reputation = Math.max(0, s.reputation - o.rep);
      log(s, 'order', `${o.icon} Die Frist ist abgelaufen! **${o.client}** ist verärgert. (Ruf −${o.rep}, Fertiges kommt ins Regal)`, null, { failed: true });
    }
  }
  if (s.t >= s.nextOrder && !isNight(s)) {
    s.nextOrder = s.t + r.int(5 * 60, 10 * 60);
    if (s.orders.length < 2) {
      const o = generateOrder(s, r);
      s.orders.push(o);
      log(s, 'order', `${o.icon} **${o.client}** fragt eine Bestellung an: ${o.lines.map((l) => `${l.qty}× ${RECIPES[l.recipe].name}`).join(', ')} für ${o.reward} 🪙.`);
    }
  }
}

// ---------- Ereignisse ----------

function eventApi(s, r) {
  return {
    addEffect: (e) => addEffect(s, e),
    removeEffect: (tag) => { s.effects = s.effects.filter((e) => e.tag !== tag); },
    moodAll: (d) => { for (const h of s.heroes) changeMood(h, d); },
    addHero: (level) => {
      if (s.heroes.length >= building(s, 'taverne').heroes) return null;
      const h = addHero(s, r, { level: Math.min(10, level), silent: true });
      bio(s, h, '✋', 'Lag verwundet am Wegesrand – du hast geholfen, und so blieb ' + (h.female ? 'sie' : 'er') + ' in Eichenfurt.', true);
      return h;
    },
  };
}

export function eventCost(s, ev, opt) {
  return opt.cost ? opt.cost(s, ev.data) : {};
}

export function canPay(s, cost) {
  if (cost.gold && s.gold < cost.gold) return false;
  if (cost.potion && s.shelf.filter((x) => x.recipe === 'heiltrank').length < cost.potion) return false;
  for (const [m, n] of Object.entries(cost.mats ?? {})) if (s.mats[m] < n) return false;
  return true;
}

function pay(s, cost) {
  if (cost.gold) s.gold -= cost.gold;
  for (const [m, n] of Object.entries(cost.mats ?? {})) s.mats[m] -= n;
  for (let i = 0; i < (cost.potion ?? 0); i++) s.shelf.splice(s.shelf.findIndex((x) => x.recipe === 'heiltrank'), 1);
}

export function resolveEvent(s, index, auto = false) {
  const ev = s.event;
  if (!ev) return false;
  const def = EVENT_BY_ID[ev.id];
  const opt = def.options[index];
  const cost = eventCost(s, ev, opt);
  if (!canPay(s, cost)) return false;
  const r = makeRng(s);
  pay(s, cost);
  const result = opt.apply(s, r, eventApi(s, r), ev.data);
  s.event = null;
  s.nextEvent = s.t + r.int(3 * 60, 6 * 60);
  log(s, 'event', `${def.icon} ${auto ? 'Du hast nicht rechtzeitig entschieden. ' : ''}${result}`);
  return true;
}

function processEvents(s, r) {
  if (s.event) {
    if (s.t >= s.event.expires) {
      // Vorgabe: letzte Option, die bezahlbar ist
      const def = EVENT_BY_ID[s.event.id];
      for (let i = def.options.length - 1; i >= 0; i--) if (resolveEvent(s, i, true)) break;
    }
    return;
  }
  const { minute } = clockOf(s);
  if (s.t < s.nextEvent || minute < 7 * 60 || minute >= 20 * 60) return;
  const pool = EVENTS.filter((e) => !s.recentEvents.includes(e.id) && (!e.cond || e.cond(s)));
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = r() * total;
  const def = pool.find((e) => (roll -= e.weight) < 0) ?? pool[0];
  const data = def.setup ? def.setup(s, r, eventApi(s, r)) : {};
  s.event = { id: def.id, data, t: s.t, expires: s.t + EVENT_WAIT };
  s.recentEvents.push(def.id);
  if (s.recentEvents.length > 4) s.recentEvents.shift();
  log(s, 'event', `${def.icon} **${def.title}:** ${def.text(data)}`);
}

// ---------- Ziele & Projekte ----------

export function currentGoal(s) {
  const g = GOALS[s.goalIndex];
  if (!g) return null;
  const [cur, max] = g.check(s);
  return { ...g, cur: Math.min(cur, max), max };
}

function checkGoals(s) {
  const g = currentGoal(s);
  if (!g || g.cur < g.max) return;
  const parts = [];
  for (const [k, n] of Object.entries(g.reward)) {
    if (k === 'gold') { s.gold += n; parts.push(`${n} 🪙`); } else { s.mats[k] += n; parts.push(`${n}× ${MATERIALS[k].icon}`); }
  }
  s.goalIndex++;
  log(s, 'goal', `🎯 Ziel erreicht: **${g.text}**! Belohnung: ${parts.join(', ')}.`);
}

export function buildProject(s, id) {
  const p = PROJECTS[id];
  if (!p || s.projects[id] || s.gold < p.cost) return false;
  s.gold -= p.cost;
  s.projects[id] = s.t;
  s.reputation += Math.round(p.cost / 50);
  log(s, 'build', `${p.icon} **${p.name}** ist fertig! ${p.desc}`);
  return true;
}

// ---------- Gebäude ----------

export function upgradeCost(s, id) {
  return BUILDINGS[id].levels[s.buildings[id]]?.cost ?? null;
}

export function canUpgrade(s, id) {
  const cost = upgradeCost(s, id);
  if (!cost) return false;
  return Object.entries(cost).every(([k, n]) => (k === 'gold' ? s.gold : s.mats[k]) >= n);
}

export function upgrade(s, id) {
  if (!canUpgrade(s, id)) return false;
  for (const [k, n] of Object.entries(upgradeCost(s, id))) {
    if (k === 'gold') s.gold -= n; else s.mats[k] -= n;
  }
  s.buildings[id]++;
  if (id === 'schmiede') while (s.slots.length < building(s, 'schmiede').slots) s.slots.push(null);
  log(s, 'build', `${BUILDINGS[id].icon} **${BUILDINGS[id].name}** ausgebaut auf Stufe ${s.buildings[id]}.`);
  if (id === 'taverne') {
    s.guestDue = s.t + makeRng(s).int(60, 180);
    log(s, 'build', 'Es spricht sich herum: In der Taverne von Eichenfurt sind Zimmer frei.');
  }
  return true;
}

// ---------- Hauptschleife ----------

function stepMinute(s, r) {
  s.t++;
  processCrafting(s);

  for (const h of [...s.heroes]) {
    if (h.state === 'away' && s.t >= h.until) {
      if (sagaIntercept(s, r, h)) continue;
      const partner = h.partyWith ? s.heroes.find((x) => x.id === h.partyWith) : null;
      if (partner && partner.state === 'away' && partner.partyWith === h.id) returnParty(s, r, h, partner);
      else returnHome(s, r, h);
    }
    else if ((h.state === 'rest' || h.state === 'injured') && s.t >= h.until) {
      h.state = 'idle';
      h.nextThink = s.t + r.int(5, 20);
    } else if (h.state === 'idle' && s.t >= h.nextThink) think(s, r, h);

    // Laune pendelt langsam zur Mitte; gesellige Helden genießen die Taverne
    if (s.t % 60 === 0) {
      // Hochgefühl und Tiefs verfliegen: je weiter weg von der Mitte, desto schneller
      const [low, high] = moodBaseline(h);
      if (h.mood < low) changeMood(h, Math.ceil((low - h.mood) / 12));
      else if (h.mood > high) changeMood(h, -Math.ceil((h.mood - high) / 6));
      if (h.state !== 'away') {
        changeMood(h, effectVal(s, 'moodHour'));
        // Gesellige und Helden mit Freunden in der Taverne halten sich besser bei Laune
        const cozy = has(h, 'gesellig') || friendsOf(s, h).some((f) => f.state !== 'away');
        if (cozy && h.mood < high + 12) changeMood(h, 1);
      }
      // Vertrauen verblasst ohne neue Erlebnisse langsam (einmal am Tag)
      if (s.t % 1440 === 0) fadeTrust(h);
      if (h.mood < 15) {
        h.lowMoodSince ??= s.t;
        if (s.t - h.lowMoodSince > 24 * 60) {
          leaveBitter(s, r, h, 'left');
        }
      } else h.lowMoodSince = null;
    }
  }

  if (s.t >= s.nextArrival) {
    s.nextArrival = s.t + 60;
    const cap = building(s, 'taverne').heroes;
    // Nach einem Taverne-Ausbau kommt garantiert bald jemand; sonst entscheidet der Ruf
    const due = s.guestDue !== null && s.t >= s.guestDue;
    if (s.heroes.length < cap && !isNight(s) && (due || r.chance(arrivalChance(s)))) {
      s.guestDue = null;
      // Ein Ausbilder im Dorf zieht erfahrenere Leute an
      const lvl = Math.max(1, Math.min(8, 1 + Math.floor(Math.sqrt(s.reputation) / 3) + r.int(-1, 1))) + (hasRole(s, 'krieger') ? 1 : 0);
      addHero(s, r, { level: lvl });
    }
  }

  if (s.t >= s.nextBanter) {
    s.nextBanter = s.t + r.int(80, 200);
    const here = s.heroes.filter((h) => h.state !== 'away');
    if (here.length >= 2 && !isNight(s)) {
      const a = r.pick(here);
      // Man setzt sich gern zu Leuten, die man schon kennt – im Guten wie im Schlechten
      const others = here.filter((x) => x !== a);
      const known = others.filter((x) => Math.abs(s.relations[a.id < x.id ? `${a.id}-${x.id}` : `${x.id}-${a.id}`] ?? 0) >= 10);
      const b = known.length && r.chance(0.5) ? r.pick(known) : r.pick(others);
      banter(s, r, a, b);
    }
  }

  processOrders(s, r);
  processEvents(s, r);
  processRequests(s, r);
  processSagas(s, r);
  processThreat(s, r);
  if (s.t % 60 === 0) checkDebts(s, r);
  checkGoals(s);
  if (s.t % 60 === 0) s.effects = s.effects.filter((e) => e.until > s.t);
}

export function advance(s, minutes) {
  const r = makeRng(s);
  for (let i = 0; i < minutes; i++) {
    dragonSlain = s.deeds.some((d) => d.id === 'vharzul');
    stepMinute(s, r);
  }
}

// Nach Spieleraktionen: Ziele sofort prüfen
export function afterAction(s) {
  checkGoals(s);
}
