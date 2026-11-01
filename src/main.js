// Einstieg: Laden/Speichern, Offline-Nachberechnung, Spielschleife.

import { newGame, advance, building, skipTime, syncClock } from './sim.js';
import { loadGame, saveGame, clearSave, exportCode, importCode } from './save.js';
import { VillageScene } from './scene.js';
import { UI } from './ui.js';

// Für die „echte“ Version 1; zum Testen in den Einstellungen oder per ?speed=60 erhöhen.
const DEFAULT_SPEED = 1;
const OFFLINE_REPORT_MIN = 10; // ab so vielen Spielminuten Abwesenheit gibt es einen Bericht

const params = new URLSearchParams(location.search);
const urlSpeed = Number(params.get('speed'));

function realClockMinute() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

const game = {
  state: null,
  speed: DEFAULT_SPEED,
  setSpeed(v) {
    this.speed = v;
    this.acc = 0;
    if (v === 1) syncClock(this.state, realClockMinute());
    this.save();
  },
  save() { saveGame(this.state, this.speed, this.simAt); },
  exportCode() { return exportCode(this.state, this.speed); },
  importCode(code) {
    const data = importCode(code);
    this.state = data.state;
    this.speed = data.speed ?? DEFAULT_SPEED;
    scene.actors.clear(); scene.first = true;
    this.save();
  },
  reset() {
    clearSave();
    this.state = newGame(Date.now(), realClockMinute());
    scene.actors.clear(); scene.first = true;
    this.save();
  },
  selectHero(id) { scene.selected = id; },
  onModalClose() { scene.selected = null; },
  acc: 0,
  simAt: Date.now(), // Echtzeit, bis zu der simuliert wurde
};

const saved = loadGame();
let pendingOffline = 0;
if (saved) {
  game.state = saved.state;
  game.speed = saved.speed ?? DEFAULT_SPEED;
  pendingOffline = Date.now() - saved.savedAt;
} else {
  game.state = newGame(Date.now(), realClockMinute());
}
if (urlSpeed > 0) game.speed = urlSpeed;

const scene = new VillageScene(document.getElementById('scene'), (id) => ui.showHero(id));
const ui = new UI(game);
document.getElementById('settings').addEventListener('click', () => ui.showSettings());
document.getElementById('speed').addEventListener('click', () => ui.showSettings());

// Verpasste Zeit nachrechnen (begrenzt durch das Lagerhaus) und Bericht zeigen
function catchUp(realMs) {
  const s = game.state;
  const exact = (realMs / 60000) * game.speed + game.acc;
  const wanted = Math.floor(exact);
  game.acc = exact - wanted; // angefangene Minuten nicht verlieren
  const cap = building(s, 'lager').offline;
  const minutes = Math.min(wanted, cap);
  game.simAt = Date.now();
  if (minutes <= 0) return;
  const before = { t: s.t, gold: s.gold, sold: s.stats.sold, adventures: s.stats.adventures, successes: s.stats.successes };
  advance(s, minutes);
  // Was über das Lagerhaus-Limit hinausgeht, vergeht ohne Simulation – die Uhr läuft trotzdem weiter
  if (wanted > cap) skipTime(s, wanted - cap);
  if (game.speed === 1) syncClock(s, realClockMinute());
  scene.sync(s);
  if (minutes >= OFFLINE_REPORT_MIN) ui.showReport(before, minutes, { capped: wanted > cap });
  game.save();
}

catchUp(pendingOffline);
if (game.speed === 1) syncClock(game.state, realClockMinute());
scene.sync(game.state);
ui.render();

// Spielzeit richtet sich nur nach der echten Uhr (Date.now). performance.now() bleibt auf manchen
// Geräten stehen, solange sie schlafen – eine fortgesetzte Seite würde sonst die Nacht verschlucken.
function tick() {
  const nowMs = Date.now();
  const realDt = nowMs - game.simAt;
  if (realDt > 5000) {
    // Seite war pausiert oder im Hintergrund: wie Offline-Zeit behandeln
    catchUp(realDt);
  } else {
    game.simAt = nowMs;
    if (realDt <= 0) return;
    game.acc += (realDt / 60000) * game.speed;
    const steps = Math.floor(game.acc);
    if (steps > 0) {
      game.acc -= steps;
      advance(game.state, Math.min(steps, 600));
    }
  }
}

let lastFrame = performance.now();
let lastUi = 0;
function frame(now) {
  const animDt = Math.max(0, Math.min(now - lastFrame, 100));
  lastFrame = now;
  tick();
  scene.sync(game.state);
  scene.update(animDt / 1000);
  scene.render(game.state, now);
  if (now - lastUi > 1000) { lastUi = now; ui.render(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Beim Zurückkehren sofort nachrechnen, nicht erst beim nächsten Bild
function resume() {
  if (document.hidden) return;
  tick();
  ui.render();
}
document.addEventListener('visibilitychange', resume);
window.addEventListener('pageshow', resume);
window.addEventListener('focus', resume);

setInterval(() => game.save(), 10000);
document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });
window.addEventListener('pagehide', () => game.save());

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
