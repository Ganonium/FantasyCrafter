// Balancing-Test ohne Browser: Ein einfacher „Bot-Spieler“ schaut 5× am Tag rein und trifft Entscheidungen.
// Aufruf: node tools/simulate.mjs [tage] [seed] [--log]

import { newGame, advance, queueCraft, buyMaterial, postBounty, upgrade, canUpgrade, upgradeCost, building,
  heroPower, clockOf, resolveEvent, acceptOrder, buildProject, afterAction } from '../src/sim.js';
import { RECIPES, MATERIALS, AREAS } from '../src/data.js';
import { EVENT_BY_ID } from '../src/events.js';
import { PROJECTS } from '../src/goals.js';

const days = Number(process.argv[2] ?? 14);
const seed = Number(process.argv[3] ?? 42);
const showLog = process.argv.includes('--log');
const saveOut = process.argv.find((a) => a.startsWith('--save='))?.slice(7);

const s = newGame(seed);
const VISITS = [7 * 60, 10 * 60, 13 * 60, 17 * 60, 21 * 60]; // Uhrzeiten der Besuche

function botVisit() {
  // Ereignis: zufällige bezahlbare Option
  if (s.event) {
    const n = EVENT_BY_ID[s.event.id].options.length;
    for (let tries = 0; tries < 5 && s.event; tries++) resolveEvent(s, Math.floor(Math.random() * n));
    if (s.event) resolveEvent(s, n - 1);
  }
  // Bestellungen annehmen und einplanen
  for (const o of s.orders) {
    if (o.state === 'offered') acceptOrder(s, o.id);
    for (const l of o.lines) {
      const planned = s.queue.filter((q) => q === l.recipe).length + s.slots.filter((j) => j?.recipe === l.recipe).length;
      for (let i = planned; i < l.qty - l.filled; i++) {
        for (const [m, n] of Object.entries(RECIPES[l.recipe].mats)) if (MATERIALS[m].basic && s.mats[m] < n) buyMaterial(s, m, n - s.mats[m]);
        queueCraft(s, l.recipe);
      }
    }
  }
  for (const id of Object.keys(PROJECTS)) if (s.gold > PROJECTS[id].cost + 300) buildProject(s, id);
  for (const id of ['schmiede', 'laden', 'taverne', 'lager']) if (canUpgrade(s, id) && s.gold > 150) upgrade(s, id);
  const next = upgradeCost(s, 'schmiede');
  for (const [m, n] of Object.entries(next ?? {})) {
    if (m !== 'gold' && s.mats[m] < n && !s.bounties.some((b) => b.mat === m) && s.gold > 150) {
      postBounty(s, m, Math.round(MATERIALS[m].value * 1.2), n - s.mats[m]);
    }
  }

  const maxTier = building(s, 'schmiede').tier;
  // Was fehlt den Helden? Pro Held das nächstbessere Teil herstellen
  for (const h of s.heroes) {
    for (const slot of ['weapon', 'armor']) {
      const cur = h[slot] ? RECIPES[h[slot]].tier : 0;
      if (cur >= maxTier) continue;
      const want = Object.entries(RECIPES).find(([, r]) => r.cls === h.cls && r.slot === slot && r.tier === cur + 1);
      if (!want) continue;
      const [id, rc] = want;
      if (s.shelf.some((x) => x.recipe === id) || s.queue.includes(id)) continue;
      for (const [m, n] of Object.entries(rc.mats)) {
        const miss = n - s.mats[m];
        if (miss > 0 && MATERIALS[m].basic) buyMaterial(s, m, miss);
        else if (miss > 0 && !s.bounties.some((b) => b.mat === m) && s.gold > 100) {
          postBounty(s, m, Math.round(MATERIALS[m].value * 1.2), Math.min(6, miss + 2));
        }
      }
      queueCraft(s, id);
    }
  }
  const potions = s.shelf.filter((x) => x.recipe === 'heiltrank').length + s.queue.filter((x) => x === 'heiltrank').length;
  if (potions < 3) { buyMaterial(s, 'kraeuter', 4); queueCraft(s, 'heiltrank'); queueCraft(s, 'heiltrank'); }
  afterAction(s);
}

let logIdx = 0;
for (let d = 0; d < days; d++) {
  for (const v of VISITS) {
    const target = d * 1440 + v - s.clock0;
    if (target > s.t) advance(s, target - s.t);
    botVisit();
    if (showLog) {
      for (; logIdx < s.log.length; logIdx++) {
        const e = s.log[logIdx]; const c = clockOf(s, e.t);
        console.log(`T${c.day} ${String(Math.floor(c.minute / 60)).padStart(2, '0')}:${String(c.minute % 60).padStart(2, '0')}  ${e.text.replace(/\*\*/g, '')}`);
      }
    } else logIdx = s.log.length;
  }
  const hs = s.heroes.map((h) => `${h.name.split(' ')[0]}:L${h.level}/P${heroPower(h)}/${h.gold}g`).join(' ');
  console.log(`Tag ${d + 1}: Gold ${s.gold}, Rep ${s.reputation}, Gebäude ${Object.values(s.buildings).join('')}, ` +
    `Kopfgelder ${s.bounties.length}, Regal ${s.shelf.length} | ${hs}`);
}
console.log('Stats', s.stats);
console.log('Ziel-Index', s.goalIndex, 'Projekte', Object.keys(s.projects).join(','));
const rare = Object.keys(AREAS).map((a) => AREAS[a].mat).filter(Boolean).map((m) => `${m}:${s.mats[m]}`).join(' ');
console.log('Seltene Materialien', rare);

if (saveOut) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(saveOut, JSON.stringify({ state: s, speed: 1, savedAt: Date.now() - 3 * 3600 * 1000 }));
}
