// Statische Spieldaten: Materialien, Rezepte, Gebiete, Klassen, Wesenszüge, Gebäude.
// Zeiten sind in Spielminuten angegeben (bei Tempo 1× = echte Minuten).

export const MATERIALS = {
  eisen:     { name: 'Eisen',     icon: '⛓️', basic: true, price: 4 },
  holz:      { name: 'Holz',      icon: '🪵', basic: true, price: 2 },
  stoff:     { name: 'Stoff',     icon: '🧵', basic: true, price: 3 },
  kraeuter:  { name: 'Kräuter',   icon: '🌿', basic: true, price: 2 },
  wolfsfell:     { name: 'Wolfsfell',     icon: '🐺', value: 10 },
  spinnenseide:  { name: 'Spinnenseide',  icon: '🕸️', value: 22 },
  mondkristall:  { name: 'Mondkristall',  icon: '💎', value: 38 },
  trollknochen:  { name: 'Trollknochen',  icon: '🦴', value: 60 },
  drachenschuppe:{ name: 'Drachenschuppe',icon: '🐉', value: 120 },
};

export const CLASSES = {
  krieger:    { name: 'Krieger',    icon: '⚔️' },
  waldlaeufer:{ name: 'Waldläuferin', nameM: 'Waldläufer', icon: '🏹' },
  magier:     { name: 'Magierin', nameM: 'Magier', icon: '🔮' },
};

export function className(cls, female) {
  const c = CLASSES[cls];
  if (cls === 'krieger') return female ? 'Kriegerin' : 'Krieger';
  return female ? c.name : c.nameM;
}

// Kampfkraft pro Stufe
export const WEAPON_POWER = [0, 5, 12, 24, 45];
export const ARMOR_POWER  = [0, 4, 10, 20, 38];

// Rezepte: id → { name, cls, slot, tier, mats, time }
export const RECIPES = {
  // Krieger
  kurzschwert:   { name: 'Kurzschwert',      cls: 'krieger', slot: 'weapon', tier: 1, mats: { eisen: 3, holz: 1 }, time: 10 },
  langschwert:   { name: 'Langschwert',      cls: 'krieger', slot: 'weapon', tier: 2, mats: { eisen: 5, wolfsfell: 2 }, time: 40 },
  mondklinge:    { name: 'Mondklinge',       cls: 'krieger', slot: 'weapon', tier: 3, mats: { eisen: 6, mondkristall: 2 }, time: 90 },
  trollspalter:  { name: 'Trollspalter',     cls: 'krieger', slot: 'weapon', tier: 4, mats: { eisen: 8, trollknochen: 3 }, time: 180 },
  gambeson:      { name: 'Gambeson',         cls: 'krieger', slot: 'armor', tier: 1, mats: { stoff: 3, eisen: 1 }, time: 15 },
  kettenhemd:    { name: 'Kettenhemd',       cls: 'krieger', slot: 'armor', tier: 2, mats: { eisen: 6, wolfsfell: 1 }, time: 45 },
  mondstahlpanzer:{ name: 'Mondstahlpanzer', cls: 'krieger', slot: 'armor', tier: 3, mats: { eisen: 8, mondkristall: 2 }, time: 100 },
  drachenpanzer: { name: 'Drachenschuppenpanzer', cls: 'krieger', slot: 'armor', tier: 4, mats: { eisen: 6, drachenschuppe: 3 }, time: 180 },
  // Waldläufer
  jagdbogen:     { name: 'Jagdbogen',        cls: 'waldlaeufer', slot: 'weapon', tier: 1, mats: { holz: 4, stoff: 1 }, time: 10 },
  langbogen:     { name: 'Langbogen',        cls: 'waldlaeufer', slot: 'weapon', tier: 2, mats: { holz: 5, wolfsfell: 1 }, time: 35 },
  seidenbogen:   { name: 'Seidensehnenbogen',cls: 'waldlaeufer', slot: 'weapon', tier: 3, mats: { holz: 6, spinnenseide: 2, mondkristall: 1 }, time: 90 },
  knochenbogen:  { name: 'Trollknochenbogen',cls: 'waldlaeufer', slot: 'weapon', tier: 4, mats: { trollknochen: 2, spinnenseide: 2 }, time: 170 },
  jagdkleidung:  { name: 'Jagdkleidung',     cls: 'waldlaeufer', slot: 'armor', tier: 1, mats: { stoff: 3 }, time: 12 },
  fellmantel:    { name: 'Fellmantel',       cls: 'waldlaeufer', slot: 'armor', tier: 2, mats: { stoff: 2, wolfsfell: 2 }, time: 40 },
  seidenwams:    { name: 'Seidenwams',       cls: 'waldlaeufer', slot: 'armor', tier: 3, mats: { stoff: 2, spinnenseide: 3 }, time: 90 },
  drachenhaut:   { name: 'Drachenhautmantel',cls: 'waldlaeufer', slot: 'armor', tier: 4, mats: { spinnenseide: 2, drachenschuppe: 2 }, time: 170 },
  // Magier
  eichenstab:    { name: 'Eichenstab',       cls: 'magier', slot: 'weapon', tier: 1, mats: { holz: 3, kraeuter: 1 }, time: 10 },
  wolfszahnstab: { name: 'Wolfszahnstab',    cls: 'magier', slot: 'weapon', tier: 2, mats: { holz: 4, wolfsfell: 1, kraeuter: 2 }, time: 35 },
  mondstab:      { name: 'Mondstab',         cls: 'magier', slot: 'weapon', tier: 3, mats: { holz: 4, mondkristall: 2 }, time: 90 },
  knochenzepter: { name: 'Knochenzepter',    cls: 'magier', slot: 'weapon', tier: 4, mats: { trollknochen: 2, mondkristall: 2 }, time: 170 },
  leinenrobe:    { name: 'Leinenrobe',       cls: 'magier', slot: 'armor', tier: 1, mats: { stoff: 3 }, time: 12 },
  pelzrobe:      { name: 'Pelzrobe',         cls: 'magier', slot: 'armor', tier: 2, mats: { stoff: 3, wolfsfell: 1 }, time: 35 },
  seidenrobe:    { name: 'Seidenrobe',       cls: 'magier', slot: 'armor', tier: 3, mats: { stoff: 2, spinnenseide: 3 }, time: 90 },
  drachenrobe:   { name: 'Drachenrobe',      cls: 'magier', slot: 'armor', tier: 4, mats: { spinnenseide: 2, drachenschuppe: 2 }, time: 170 },
  // Verbrauchsgüter
  heiltrank:     { name: 'Heiltrank',        cls: null, slot: 'potion', tier: 1, mats: { kraeuter: 2 }, time: 15 },
};

export function materialValue(id) {
  const m = MATERIALS[id];
  return m.basic ? m.price : m.value;
}

export function fairPrice(recipeId) {
  const r = RECIPES[recipeId];
  let cost = 0;
  for (const [m, n] of Object.entries(r.mats)) cost += materialValue(m) * n;
  if (r.slot === 'potion') return Math.round(cost * 3 + 6);
  return Math.round(cost * 2.5 + 15 * r.tier * r.tier);
}

export const PRICE_LEVELS = [
  { id: 'guenstig', name: 'Günstig', mult: 0.8 },
  { id: 'fair',     name: 'Fair',    mult: 1.0 },
  { id: 'teuer',    name: 'Teuer',   mult: 1.3 },
  { id: 'wucher',   name: 'Wucher',  mult: 1.7 },
];

// Gebiete: danger = benötigte Kampfkraft für 50 % Erfolg; time in Minuten
export const AREAS = {
  kornfelder:   { name: 'Kornfelder', zu: 'auf die Kornfelder', in: 'auf den Kornfeldern', aus: 'von den Kornfeldern',
    icon: '🌾', danger: 4,   time: 30,  gold: [6, 14],    mat: null,
    foe: 'Ratten und Feldgoblins' },
  finsterwald:  { name: 'Finsterwald', zu: 'in den Finsterwald', in: 'im Finsterwald', aus: 'aus dem Finsterwald',
    icon: '🌲', danger: 9,   time: 60,  gold: [12, 26],   mat: 'wolfsfell',
    foe: 'Wölfe' },
  spinnenhoehle:{ name: 'Spinnenhöhle', zu: 'in die Spinnenhöhle', in: 'in der Spinnenhöhle', aus: 'aus der Spinnenhöhle',
    icon: '🕷️', danger: 20,  time: 90,  gold: [24, 48],   mat: 'spinnenseide',
    foe: 'Riesenspinnen' },
  mondmine:     { name: 'Mondsteinmine', zu: 'in die Mondsteinmine', in: 'in der Mondsteinmine', aus: 'aus der Mondsteinmine',
    icon: '⛏️', danger: 36,  time: 120, gold: [40, 80],   mat: 'mondkristall',
    foe: 'Kobolde und Steingolems' },
  trollbruecke: { name: 'Trollbrücke', zu: 'zur Trollbrücke', in: 'an der Trollbrücke', aus: 'von der Trollbrücke',
    icon: '🌉', danger: 55,  time: 180, gold: [70, 130],  mat: 'trollknochen',
    foe: 'Brückentrolle' },
  drachenhorst: { name: 'Drachenhorst', zu: 'zum Drachenhorst', in: 'am Drachenhorst', aus: 'vom Drachenhorst',
    icon: '🐲', danger: 100, time: 240, gold: [180, 360], mat: 'drachenschuppe',
    foe: 'Vharzul, den Aschenfürsten' },
};

export const TRAITS = {
  mutig:       { name: 'Mutig',       desc: 'Traut sich auch bei mäßigen Chancen los.' },
  vorsichtig:  { name: 'Vorsichtig',  desc: 'Geht nur, wenn die Chancen sehr gut stehen.' },
  gierig:      { name: 'Gierig',      desc: 'Kopfgelder locken doppelt.' },
  faul:        { name: 'Faul',        desc: 'Bleibt gern länger in der Taverne.' },
  eifrig:      { name: 'Eifrig',      desc: 'Kann nicht stillsitzen.' },
  ruhmsuechtig:{ name: 'Ruhmsüchtig', desc: 'Sucht die Gefahr – je größer, desto besser.' },
  geizig:      { name: 'Geizig',      desc: 'Kauft nur zu günstigen oder fairen Preisen.' },
  spendabel:   { name: 'Spendabel',   desc: 'Zahlt auch mal Wucherpreise, wenn die Ware stimmt.' },
  gesellig:    { name: 'Gesellig',    desc: 'Mag die Taverne und andere Helden.' },
};

export const TRAIT_CONFLICTS = [
  ['mutig', 'vorsichtig'], ['faul', 'eifrig'], ['geizig', 'spendabel'], ['vorsichtig', 'ruhmsuechtig'],
];

export const BUILDINGS = {
  schmiede: {
    name: 'Schmiede', icon: '🔨',
    levels: [
      { desc: 'Stufe-1-Ausrüstung, 1 Werkplatz', slots: 1, tier: 1, speed: 1 },
      { desc: 'Stufe-2-Ausrüstung, 2 Werkplätze', slots: 2, tier: 2, speed: 1, cost: { gold: 250 } },
      { desc: 'Stufe-3-Ausrüstung, 2 Werkplätze, 20 % schneller', slots: 2, tier: 3, speed: 1.25, cost: { gold: 900, wolfsfell: 6 } },
      { desc: 'Stufe-4-Ausrüstung, 3 Werkplätze, 40 % schneller', slots: 3, tier: 4, speed: 1.4, cost: { gold: 2600, mondkristall: 5 } },
    ],
  },
  laden: {
    name: 'Laden', icon: '🏪',
    levels: [
      { desc: '6 Plätze im Regal', shelf: 6 },
      { desc: '10 Plätze im Regal', shelf: 10, cost: { gold: 150 } },
      { desc: '16 Plätze im Regal', shelf: 16, cost: { gold: 600 } },
    ],
  },
  taverne: {
    name: 'Taverne', icon: '🍺',
    levels: [
      { desc: 'Platz für 4 Helden', heroes: 4 },
      { desc: 'Platz für 6 Helden', heroes: 6, cost: { gold: 300 } },
      { desc: 'Platz für 8 Helden', heroes: 8, cost: { gold: 1200, spinnenseide: 4 } },
    ],
  },
  lager: {
    name: 'Lagerhaus', icon: '📦',
    levels: [
      { desc: 'Offline-Fortschritt bis 10 Std.', offline: 10 * 60 },
      { desc: 'Offline-Fortschritt bis 16 Std.', offline: 16 * 60, cost: { gold: 200 } },
      { desc: 'Offline-Fortschritt bis 24 Std.', offline: 24 * 60, cost: { gold: 700 } },
    ],
  },
};

export const NAMES_M = ['Brom', 'Aldric', 'Torvin', 'Kasimir', 'Jorek', 'Fenwick', 'Odo', 'Lasse', 'Gerwin', 'Hagen',
  'Rurik', 'Bastian', 'Edric', 'Wendel', 'Ulf', 'Merek', 'Tamo', 'Ivo'];
export const NAMES_F = ['Mira', 'Ysolde', 'Hilda', 'Rana', 'Elske', 'Gunda', 'Liv', 'Talia', 'Brenna', 'Senna',
  'Wiebke', 'Isolde', 'Nele', 'Frida', 'Asta', 'Runa', 'Maren', 'Kaja'];
export const EPITHETS = ['Eisenfaust', 'vom Moor', 'Sturmauge', 'Dreifinger', 'Bärentöter', 'Krähenfeder', 'vom Hügel',
  'Silberzunge', 'Aschenhaar', 'Rotschopf', 'aus Brackwasser', 'Flinkfuß', 'Weidenherz', 'vom Nordpass'];
