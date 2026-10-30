// Spielsimulation – reine Logik ohne DOM. Zeit `t` in Spielminuten seit Spielbeginn.
// Alles läuft in 1-Minuten-Schritten, damit Offline-Nachberechnung und Live-Spiel identisch sind.

import {
  MATERIALS, RECIPES, AREAS, TRAITS, TRAIT_CONFLICTS, BUILDINGS, PRICE_LEVELS,
  WEAPON_POWER, ARMOR_POWER, NAMES_M, NAMES_F, EPITHETS, fairPrice, className,
} from './data.js';
import { makeRng } from './rng.js';
import { T, THOUGHTS, fmt } from './text.js';

export const SAVE_VERSION = 1;
const LOG_LIMIT = 400;
const NIGHT_START = 22 * 60;
const NIGHT_END = 6 * 60;

// ---------- Neues Spiel ----------

export function newGame(seed = Date.now(), clockMinute = 8 * 60) {
  const s = {
    version: SAVE_VERSION,
    rng: seed | 0,
    t: 0,
    clock0: clockMinute,
    gold: 120,
    mats: Object.fromEntries(Object.keys(MATERIALS).map((m) => [m, 0])),
    buildings: { schmiede: 1, laden: 1, taverne: 1, lager: 1 },
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
    stats: { sold: 0, earned: 0, repairs: 0, adventures: 0, successes: 0, crafted: 0 },
  };
  s.mats.eisen = 12; s.mats.holz = 10; s.mats.stoff = 8; s.mats.kraeuter = 6;
  const r = makeRng(s);
  const classes = ['krieger', 'waldlaeufer', 'magier'];
  for (const cls of classes) addHero(s, r, { cls, silent: true });
  log(s, 'info', 'Willkommen in **Eichenfurt**! Dein Laden hat geöffnet. Drei Helden sitzen schon in der Taverne und warten auf Ausrüstung.');
  return s;
}

// ---------- Hilfsfunktionen ----------

export function clockOf(s, t = s.t) {
  const total = s.clock0 + t;
  return { day: Math.floor(total / 1440) + 1, minute: ((total % 1440) + 1440) % 1440 };
}

export function isNight(s, t = s.t) {
  const m = clockOf(s, t).minute;
  return m >= NIGHT_START || m < NIGHT_END;
}

export function building(s, id) {
  return BUILDINGS[id].levels[s.buildings[id] - 1];
}

function log(s, kind, text, heroId = null) {
  s.log.push({ t: s.t, kind, text, hero: heroId });
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

function areaVars(areaId, extra = {}) {
  const a = AREAS[areaId];
  const In = a.in.charAt(0).toUpperCase() + a.in.slice(1);
  return { A: a.name, zu: a.zu, in: a.in, In, aus: a.aus, F: a.foe, M: a.mat ? MATERIALS[a.mat].name : 'Gold', ...extra };
}

export function heroPower(h) {
  const w = h.weapon ? RECIPES[h.weapon].tier : 0;
  const a = h.armor ? RECIPES[h.armor].tier : 0;
  return 3 + h.level * 2 + WEAPON_POWER[w] + ARMOR_POWER[a];
}

export function successChance(h, areaId) {
  const ratio = heroPower(h) / AREAS[areaId].danger;
  const p = 1 / (1 + Math.exp(-(ratio - 1) * 4));
  return Math.min(0.97, Math.max(0.02, p));
}

export function priceOf(s, recipeId) {
  const lvl = s.prices[recipeId] ?? 1;
  return Math.max(1, Math.round(fairPrice(recipeId) * PRICE_LEVELS[lvl].mult));
}

export function xpNeeded(level) {
  return Math.round(30 * Math.pow(level, 1.8));
}

export function heroLabel(h) {
  return `${h.name} (${className(h.cls, h.female)}, St. ${h.level})`;
}

// ---------- Helden ----------

function addHero(s, r, { cls, silent = false, level = 1 } = {}) {
  const female = r.chance(0.5);
  const used = new Set(s.heroes.map((h) => h.name.split(' ')[0]));
  const pool = (female ? NAMES_F : NAMES_M).filter((n) => !used.has(n));
  const first = r.pick(pool.length ? pool : female ? NAMES_F : NAMES_M);
  const name = r.chance(0.35) ? `${first} ${r.pick(EPITHETS)}` : first;
  cls ??= r.pick(['krieger', 'waldlaeufer', 'magier']);

  const traitIds = Object.keys(TRAITS);
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
  if (!silent) log(s, 'arrive', fmt(r.pick(T.arrive), h), h.id);
  return h;
}

function has(h, trait) {
  return h.traits.includes(trait);
}

function setThought(h, text) {
  h.thought = text;
}

function changeMood(h, d) {
  h.mood = Math.max(0, Math.min(100, h.mood + d));
}

// Bewertung aller Gebiete aus Sicht eines Helden
export function evaluateAreas(s, h) {
  const res = [];
  for (const [id, a] of Object.entries(AREAS)) {
    const p = successChance(h, id);
    const avgGold = (a.gold[0] + a.gold[1]) / 2;
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
    if (bountyValue > avgGold * 1.5) threshold -= has(h, 'gierig') ? 0.15 : 0.07;
    threshold = Math.max(0.2, Math.min(0.9, threshold));

    let value = p * (avgGold + bountyValue * greed);
    if (h.fav === id) value *= 1.4;
    if (has(h, 'ruhmsuechtig')) value *= 1 + a.danger / 50;
    // Unterforderung: Wer viel zu stark ist, hat wenig Lust auf Kleinkram
    const overpowered = heroPower(h) / a.danger;
    if (overpowered > 4 && bountyValue === 0) value *= 0.5;

    let block = null;
    if (h.hated === id) block = 'hated';
    else if (p < threshold) block = 'danger';
    res.push({ id, p, value, threshold, bountyValue, block });
  }
  return res;
}

function tryShopping(s, r, h) {
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
      const lvl = s.prices[it.recipe] ?? 1;
      let maxLvl = 2;
      if (has(h, 'geizig')) maxLvl = 1;
      if (has(h, 'spendabel')) maxLvl = 3;
      if (h.gold > price * 4) maxLvl += 1;
      if (h.mood < 30) maxLvl -= 1;
      if (lvl > maxLvl) { refusal ??= fmt(r.pick(THOUGHTS.tooExpensive), h, { x: it.rc.name, p: price }); continue; }
      if (h.gold < price) { refusal ??= fmt(THOUGHTS.wantItem[0], h, { x: it.rc.name, p: price }); continue; }

      // Kauf
      h.gold -= price;
      s.gold += price;
      s.stats.sold += 1;
      s.stats.earned += price;
      s.reputation += it.rc.tier;
      h[slot] = it.recipe;
      s.shelf.splice(it.idx, 1);
      let tpl = r.pick(T.buy);
      if (lvl === 0) { tpl = T.buyCheap[0]; changeMood(h, 12); }
      else if (lvl === 3) { tpl = T.buyExpensive[0]; changeMood(h, -6); }
      else changeMood(h, 8);
      log(s, 'buy', fmt(tpl, h, { x: `**${it.rc.name}**` }) + ` (+${price} 🪙)`, h.id);
      setThought(h, `${it.rc.name}! Das muss ich gleich ausprobieren.`);
      bought = true;
      refusal = null;
      break;
    }
    if (refusal) setThought(h, refusal);
  }
  return bought;
}

function buyPotion(s, r, h) {
  if (h.potions > 0) return;
  const idx = s.shelf.findIndex((it) => it.recipe === 'heiltrank');
  if (idx < 0) return;
  const price = priceOf(s, 'heiltrank');
  const lvl = s.prices.heiltrank ?? 1;
  const maxLvl = has(h, 'geizig') ? 1 : has(h, 'spendabel') || has(h, 'vorsichtig') ? 3 : 2;
  if (lvl > maxLvl || h.gold < price * 1.5) return;
  h.gold -= price;
  s.gold += price;
  s.stats.sold += 1;
  s.stats.earned += price;
  h.potions += 1;
  s.shelf.splice(idx, 1);
  log(s, 'buy', fmt(r.pick(T.buyPotion), h) + ` (+${price} 🪙)`, h.id);
}

function think(s, r, h) {
  h.nextThink = s.t + r.int(15, 40);
  const day = clockOf(s).day;
  if (h.formDay !== day) { h.formDay = day; h.form = r.range(0.6, 1.3); }

  if (isNight(s)) {
    setThought(h, r.pick(THOUGHTS.night));
    return;
  }

  tryShopping(s, r, h);

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
  goChance = Math.max(0.05, Math.min(0.95, goChance));

  const go = best && r.chance(goChance);

  // Begründung, warum das wichtigste Kopfgeld liegen bleibt
  if (topBounty && (!go || best.id !== topBounty.id)) {
    let reason = null;
    const v = areaVars(topBounty.id);
    if (topBounty.block === 'hated') {
      reason = topBounty.id === 'spinnenhoehle' ? THOUGHTS.hatedSpider[0] : fmt(r.pick(THOUGHTS.hated), h, v);
    } else if (topBounty.block === 'danger') {
      reason = !h.weapon && !h.armor ? fmt(THOUGHTS.tooDangerousNoGear[0], h, v) : fmt(r.pick(THOUGHTS.tooDangerous), h, v);
    }
    if (reason) {
      const key = `${topBounty.id}:${topBounty.block}:${day}`;
      if (h.refusalKey !== key) {
        h.refusalKey = key;
        log(s, 'refuse', `${fmt('{n}', h)} wirft einen Blick aufs Auftragsbrett: „${reason}“`, h.id);
      }
      if (!go) { setThought(h, reason); return; }
    }
  }

  if (!best) {
    setThought(h, fmt(r.pick(THOUGHTS.tooDangerous), h, areaVars('kornfelder')));
    return;
  }
  if (!go) {
    if (h.gold > 400 + h.level * 60) setThought(h, THOUGHTS.rich[0]);
    else if (h.mood < 30) setThought(h, r.pick(THOUGHTS.moody));
    else setThought(h, r.pick(THOUGHTS.lazy));
    return;
  }

  // Aufbruch
  const a = AREAS[best.id];
  if (a.danger >= 9) buyPotion(s, r, h);
  h.state = 'away';
  h.area = best.id;
  h.departedAt = s.t;
  h.until = s.t + Math.round(a.time * r.range(0.85, 1.2));
  h.bountyTrip = best.bountyValue > 0;
  h.chance = best.p;
  const v = areaVars(best.id);
  let tpl;
  if (best.p < 0.5) tpl = r.pick(T.departBrave);
  else if (h.bountyTrip) tpl = r.pick(T.departBounty);
  else tpl = r.pick(T.depart);
  log(s, 'depart', fmt(tpl, h, v), h.id);
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
    s.reputation += 2 * delivered;
    changeMood(h, 5);
    log(s, 'deliver', fmt(r.pick(T.deliver), h, { x: `**${delivered}× ${MATERIALS[mat].name}** ${MATERIALS[mat].icon}` }) + ` (${paid} 🪙 Kopfgeld)`, h.id);
  }
}

function returnHome(s, r, h) {
  const a = AREAS[h.area];
  const v = areaVars(h.area);
  h.adventures++;
  s.stats.adventures++;

  // eine kleine Geschichte von unterwegs
  if (r.chance(0.6)) log(s, 'story', fmt(r.pick(T.story[h.area]), h, v), h.id);

  const roll = r();
  const success = roll < h.chance;
  let gold = 0;
  let xp = 0;
  let pieces = 0;
  if (success) {
    gold = r.int(a.gold[0], a.gold[1]);
    xp = a.danger * 3 + 5;
    pieces = a.mat ? r.int(1, 3) + (h.cls === 'waldlaeufer' && r.chance(0.5) ? 1 : 0) : 0;
    h.successes++;
    s.stats.successes++;
    s.reputation += 1;
    changeMood(h, 8 + (h.fav === h.area ? 4 : 0));
    const tpl = roll > h.chance - 0.1 ? r.pick(T.successClose) : r.pick(T.success);
    log(s, 'success', fmt(tpl, h, v) + ` (+${gold} 🪙)`, h.id);
    h.state = 'rest';
    h.until = s.t + 25 + Math.round(a.time * 0.3);
  } else if (h.potions > 0) {
    h.potions--;
    gold = Math.round(r.int(a.gold[0], a.gold[1]) * 0.3);
    xp = a.danger;
    pieces = a.mat && r.chance(0.4) ? 1 : 0;
    changeMood(h, -4);
    log(s, 'escape', fmt(r.pick(T.escape), h, v), h.id);
    h.state = 'rest';
    h.until = s.t + 40 + Math.round(a.time * 0.3);
  } else {
    xp = Math.round(a.danger * 0.8);
    const lost = Math.round(h.gold * 0.15);
    h.gold -= lost;
    changeMood(h, -14);
    log(s, 'fail', fmt(r.pick(T.fail), h, v) + (lost ? ` (${lost} 🪙 verloren)` : ''), h.id);
    h.state = 'injured';
    const base = r.int(180, 360) + a.danger * 2;
    h.until = s.t + Math.round(h.cls === 'krieger' ? base * 0.7 : base);
  }
  h.gold += gold;
  h.xp += xp;
  while (h.xp >= xpNeeded(h.level)) {
    h.xp -= xpNeeded(h.level);
    h.level++;
    log(s, 'level', fmt(r.pick(T.levelUp), h, { x: h.level }), h.id);
  }
  if (pieces > 0) {
    if (h.bountyTrip || s.bounties.some((b) => b.mat === a.mat)) deliverBounty(s, r, h, a.mat, pieces);
    // ungewollte Beute verkaufen Helden an den Hausierer
    else h.gold += pieces * Math.round(MATERIALS[a.mat].value * 0.3);
  }
  // Verschleiß: Helden lassen ihre Ausrüstung in deiner Schmiede reparieren
  const gearTier = (h.weapon ? RECIPES[h.weapon].tier : 0) + (h.armor ? RECIPES[h.armor].tier : 0);
  const repair = Math.min(h.gold, Math.round(gearTier * (success ? 1 : 3) * (1 + a.danger / 60)));
  if (repair > 0) {
    h.gold -= repair;
    s.gold += repair;
    s.stats.earned += repair;
    s.stats.repairs = (s.stats.repairs ?? 0) + repair;
  }
  // Taverne kostet
  const tavern = Math.min(h.gold, 4 + h.level * 2);
  h.gold -= tavern;
  h.area = null;
  h.bountyTrip = false;
  setThought(h, h.state === 'injured' ? r.pick(THOUGHTS.injured) : r.pick(THOUGHTS.resting));
}

// ---------- Werkstatt ----------

export function canCraft(s, recipeId) {
  const rc = RECIPES[recipeId];
  if (rc.tier > building(s, 'schmiede').tier) return false;
  return Object.entries(rc.mats).every(([m, n]) => s.mats[m] >= n);
}

export function queueCraft(s, recipeId) {
  if (!canCraft(s, recipeId) || s.queue.length >= 10) return false;
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

function fillSlots(s) {
  const speed = building(s, 'schmiede').speed;
  for (let i = 0; i < s.slots.length; i++) {
    if (!s.slots[i] && s.queue.length) {
      const id = s.queue.shift();
      s.slots[i] = { recipe: id, start: s.t, end: s.t + Math.round(RECIPES[id].time / speed) };
    }
  }
}

function processCrafting(s) {
  const cap = building(s, 'laden').shelf;
  for (let i = 0; i < s.slots.length; i++) {
    const job = s.slots[i];
    if (!job || job.end > s.t) continue;
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
  if (!m.basic || s.gold < m.price * n) return false;
  s.gold -= m.price * n;
  s.mats[mat] += n;
  return true;
}

export function sellFromShelf(s, index) {
  const it = s.shelf[index];
  if (!it) return;
  s.gold += Math.floor(fairPrice(it.recipe) * 0.5);
  s.shelf.splice(index, 1);
}

// ---------- Kopfgelder ----------

export function postBounty(s, mat, reward, qty) {
  const cost = reward * qty;
  if (s.gold < cost || reward < 1 || qty < 1) return false;
  s.gold -= cost;
  s.bounties.push({ id: s.nextId++, mat, reward, qty, delivered: 0, posted: s.t });
  log(s, 'bounty', `Du hängst ein Kopfgeld aus: **${qty}× ${MATERIALS[mat].name}** ${MATERIALS[mat].icon} für je ${reward} 🪙.`);
  return true;
}

export function cancelBounty(s, id) {
  const b = s.bounties.find((x) => x.id === id);
  if (!b) return;
  s.gold += b.reward * (b.qty - b.delivered);
  s.bounties = s.bounties.filter((x) => x.id !== id);
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
  return true;
}

// ---------- Hauptschleife ----------

function stepMinute(s, r) {
  s.t++;
  processCrafting(s);

  for (const h of [...s.heroes]) {
    if (h.state === 'away' && s.t >= h.until) returnHome(s, r, h);
    else if ((h.state === 'rest' || h.state === 'injured') && s.t >= h.until) {
      h.state = 'idle';
      h.nextThink = s.t + r.int(5, 20);
    } else if (h.state === 'idle' && s.t >= h.nextThink) think(s, r, h);

    // Laune pendelt langsam zur Mitte; gesellige Helden genießen die Taverne
    if (s.t % 60 === 0) {
      if (h.mood < 50) changeMood(h, 1);
      else if (h.mood > 65) changeMood(h, -1);
      if (h.state !== 'away' && has(h, 'gesellig')) changeMood(h, 1);
      if (h.mood < 15) {
        h.lowMoodSince ??= s.t;
        if (s.t - h.lowMoodSince > 24 * 60) {
          log(s, 'leave', fmt(r.pick(T.leave), h), h.id);
          s.heroes = s.heroes.filter((x) => x !== h);
        }
      } else h.lowMoodSince = null;
    }
  }

  if (s.t >= s.nextArrival) {
    s.nextArrival = s.t + 60;
    const cap = building(s, 'taverne').heroes;
    const chance = Math.min(0.5, 0.06 + s.reputation * 0.004);
    if (s.heroes.length < cap && !isNight(s) && r.chance(chance)) {
      const lvl = Math.max(1, Math.min(8, 1 + Math.floor(Math.sqrt(s.reputation) / 3) + r.int(-1, 1)));
      addHero(s, r, { level: lvl });
    }
  }

  if (s.t >= s.nextBanter) {
    s.nextBanter = s.t + r.int(120, 300);
    const here = s.heroes.filter((h) => h.state !== 'away');
    if (here.length >= 2 && !isNight(s)) {
      const a = r.pick(here);
      const b = r.pick(here.filter((x) => x !== a));
      log(s, 'banter', fmt(r.pick(T.banter), a, { o: `**${b.name}**` }), a.id);
      changeMood(a, 3); changeMood(b, 3);
    }
  }
}

export function advance(s, minutes) {
  const r = makeRng(s);
  for (let i = 0; i < minutes; i++) stepMinute(s, r);
}
