// Ziele (nacheinander freigeschaltet) und Dorfprojekte (dauerhafte Boni, auf die man mit Gold hinarbeitet).

import { RECIPES } from './data.js';

const maxHeroLevel = (s) => Math.max(0, ...s.heroes.map((h) => h.level));
const delivered = (s, m) => s.stats.delivered?.[m] ?? 0;

// check(s) → [aktuell, Ziel]
export const GOALS = [
  { text: 'Verkaufe 3 Ausrüstungsteile', check: (s) => [s.stats.sold, 3], reward: { gold: 40 } },
  { text: 'Hänge ein Kopfgeld aus', check: (s) => [s.stats.bountiesPosted ?? 0, 1], reward: { gold: 30 } },
  { text: 'Erfülle eine Bestellung', check: (s) => [s.stats.ordersDone ?? 0, 1], reward: { gold: 80 } },
  { text: 'Baue die Schmiede auf Stufe 2 aus', check: (s) => [s.buildings.schmiede, 2], reward: { gold: 100 } },
  { text: 'Errichte ein Dorfprojekt', check: (s) => [Object.keys(s.projects).length, 1], reward: { gold: 100 } },
  { text: 'Erreiche 100 Ruf', check: (s) => [s.reputation, 100], reward: { gold: 150 } },
  { text: 'Ein Held erreicht Stufe 5', check: (s) => [maxHeroLevel(s), 5], reward: { wolfsfell: 3 } },
  { text: 'Erfülle 3 Bestellungen', check: (s) => [s.stats.ordersDone ?? 0, 3], reward: { gold: 200 } },
  { text: 'Lass dir 5 Spinnenseide liefern', check: (s) => [delivered(s, 'spinnenseide'), 5], reward: { gold: 250 } },
  { text: 'Besitze 1.000 Gold', check: (s) => [Math.floor(s.gold), 1000], reward: { mondkristall: 2 } },
  { text: 'Baue die Schmiede auf Stufe 3 aus', check: (s) => [s.buildings.schmiede, 3], reward: { gold: 300 } },
  { text: 'Ein Held siegt an der Trollbrücke', check: (s) => [s.stats.areaWins?.trollbruecke ?? 0, 1], reward: { gold: 400 } },
  { text: 'Baue die Schmiede auf Stufe 4 aus', check: (s) => [s.buildings.schmiede, 4], reward: { gold: 500 } },
  { text: 'Lass dir eine Drachenschuppe liefern', check: (s) => [delivered(s, 'drachenschuppe'), 1], reward: { gold: 1000 } },
  {
    text: 'Ein Held trägt vollständige Stufe-4-Ausrüstung',
    check: (s) => [s.heroes.some((h) => h.weapon && h.armor && RECIPES[h.weapon].tier === 4 && RECIPES[h.armor].tier === 4) ? 1 : 0, 1],
    reward: { gold: 1500 },
  },
];

// mods wie bei Ereignis-Effekten: { key, v, area?, mat? }
export const PROJECTS = {
  brunnen: {
    name: 'Dorfbrunnen', icon: '⛲', cost: 250,
    desc: 'Frisches Wasser: Helden ruhen sich 25 % schneller aus.',
    mods: [{ key: 'rest', v: 0.75 }],
  },
  heiler: {
    name: 'Heilerhütte', icon: '🌿', cost: 450,
    desc: 'Verletzungen heilen 40 % schneller.',
    mods: [{ key: 'injury', v: 0.6 }],
  },
  markt: {
    name: 'Marktplatz', icon: '🧺', cost: 600,
    desc: 'Händler kommen öfter vorbei: Grundstoffe 20 % billiger.',
    mods: [{ key: 'matPrice', v: 0.8 }],
  },
  wachturm: {
    name: 'Wachturm', icon: '🗼', cost: 900,
    desc: 'Kornfelder und Finsterwald werden sicherer (−15 % Gefahr). Goblins trauen sich nicht mehr ins Dorf.',
    mods: [{ key: 'danger', v: 0.85, area: 'kornfelder' }, { key: 'danger', v: 0.85, area: 'finsterwald' }],
  },
  buehne: {
    name: 'Bardenbühne', icon: '🎻', cost: 1200,
    desc: 'Musik in der Taverne: bessere Laune und doppelt so viele Neuankömmlinge.',
    mods: [{ key: 'moodHour', v: 1 }, { key: 'arrival', v: 2 }],
  },
  denkmal: {
    name: 'Heldendenkmal', icon: '🗿', cost: 3000,
    desc: 'Helden fühlen sich unbesiegbar: −10 % Gefahr in allen Gebieten.',
    mods: [{ key: 'danger', v: 0.9 }],
  },
};
