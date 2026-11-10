// Dorfszene auf Canvas (Vektorgrafik): Gebäude, Tageszeit und die Helden, die gerade im Dorf sind.
// Logische Koordinaten 200 × 124, gerendert in voller Bildschirmauflösung.

import { drawHero, heroLook } from './sprites.js';
import { RECIPES } from './data.js';
import { clockOf, isNight, activeEffects } from './sim.js';
import { villagers } from './farewell.js';
import { legacyHero } from './ui.js';

export const W = 200;
export const H = 124;
// Helden stehen in zwei Reihen auf dem Dorfplatz vor den Häusern
const ROWS = [{ y: 119, size: 37 }, { y: 110, size: 33 }];
const LINE = '#2a1c14';
const LW = 0.45;

const TIER_COLORS = ['#999999', '#b8bec4', '#e4e8ec', '#9fd8ff', '#e6b84a'];

export class VillageScene {
  constructor(canvas, onHeroTap) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.actors = new Map();
    this.first = true;
    this.smoke = [];
    this.selected = null;
    this.seed = 1;
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      const hit = [...this.actors.values()]
        .filter((a) => a.alpha > 0.5 && Math.abs(x - a.x) <= a.size * 0.38 && y >= a.y - a.size * 1.3 && y <= a.y + 2)
        .sort((a, b) => b.y - a.y)[0];
      if (hit) return onHeroTap(hit.id);
      // dahinter: Dorfbewohner
      const v = (this.villagerSpots ?? []).find((p) => Math.abs(x - p.x) <= 5 && y >= p.y - 30 && y <= p.y + 2);
      if (v) onHeroTap(v.id, 'legacy');
    });
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth || W * 2;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round((cssW * dpr * H) / W);
  }

  rand() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  // Wer im Dorf ist, bekommt einen festen Platz (nach Ankunft sortiert); Kommen und Gehen wird überblendet.
  sync(state) {
    const present = state.heroes.filter((h) => h.state !== 'away');
    for (const h of present) {
      let a = this.actors.get(h.id);
      if (!a) {
        a = { id: h.id, alpha: this.first ? 1 : 0, x: null, y: 0, size: 0 };
        this.actors.set(h.id, a);
      }
      a.hero = h;
      a.leaving = false;
    }
    for (const a of this.actors.values()) if (!present.some((h) => h.id === a.id)) a.leaving = true;
    const staying = [...this.actors.values()].filter((a) => !a.leaving).sort((a, b) => a.id - b.id);
    const n = staying.length;
    staying.forEach((a, i) => {
      // abwechselnd vorne/hinten, gleichmäßig über die Breite verteilt
      const row = n > 3 ? ROWS[i % 2] : ROWS[0];
      a.tx = 16 + (168 * (i + 0.5)) / Math.max(n, 1);
      a.y = row.y; a.size = row.size;
      if (a.x === null) a.x = a.tx;
      a.flip = a.tx > 100;
    });
    this.night = isNight(state);
    this.first = false;
  }

  update(dt) {
    for (const [id, a] of this.actors) {
      a.alpha = Math.max(0, Math.min(1, a.alpha + (a.leaving ? -dt * 1.5 : dt * 1.5)));
      if (a.leaving && a.alpha <= 0) { this.actors.delete(id); continue; }
      if (a.x !== null && a.tx !== undefined) a.x += (a.tx - a.x) * Math.min(1, dt * 3);
    }
    for (const p of this.smoke) { p.y -= dt * 5; p.x += dt * 2.5; p.r += dt * 0.9; p.life -= dt; }
    this.smoke = this.smoke.filter((p) => p.life > 0);
  }

  render(state, time) {
    const ctx = this.ctx;
    const k = this.canvas.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const { minute } = clockOf(state);
    const light = daylight(minute);
    this.lights = [];
    this.windowsLit = [];

    this.drawSky(ctx, minute, light, time);
    this.drawLandscape(ctx, light, time);
    const fx = new Set(activeEffects(state).map((e) => e.icon));
    if (state.projects.wachturm !== undefined) this.drawTower(ctx, light, time);
    this.drawSmithy(ctx, state, light);
    this.drawShop(ctx, state, light);
    this.drawBoard(ctx, state, light);
    this.drawTavern(ctx, state, light);
    this.drawProps(ctx, state, light);
    this.drawProjects(ctx, state, light, time);
    if (fx.has('🏆') || fx.has('🎉')) this.drawBunting(ctx, light, time);
    if (fx.has('🎶') || state.projects.buehne !== undefined) this.drawNotes(ctx, time, fx.has('🎶'));

    // Rauch über der Esse
    const crafting = state.slots.some((s) => s && !s.blocked);
    if (crafting && this.rand() < 0.06) this.smoke.push({ x: 45.5, y: 33, r: 1.4, life: 4 });
    for (const p of this.smoke) {
      ctx.fillStyle = `rgba(${light > 0.5 ? '215,215,215' : '120,120,140'},${p.life / 8})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }

    // Nacht: Kulisse abdunkeln, dann Lichter
    const dark = light < 0.95 ? 0.95 - light : 0;
    if (dark > 0) {
      ctx.fillStyle = `rgba(12,16,46,${dark * 0.58})`;
      ctx.fillRect(0, 0, W, H);
      const strength = Math.min(1, dark * 1.6);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const l of this.lights) {
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        g.addColorStop(0, `rgba(255,190,90,${0.35 * strength})`);
        g.addColorStop(1, 'rgba(255,190,90,0)');
        ctx.fillStyle = g;
        ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      ctx.restore();
      for (const wdw of this.windowsLit) {
        ctx.fillStyle = `rgba(255,205,110,${0.85 * strength})`;
        ctx.beginPath(); ctx.roundRect(wdw[0], wdw[1], wdw[2], wdw[3], 0.6); ctx.fill();
      }
    }

    // Dorfbewohner (sesshaft gewordene Helden) gehen im Hintergrund ihrem Tagwerk nach; nachts sind sie zu Hause
    this.villagerSpots = [];
    if (!this.night) {
      const spots = [[40, 99], [88, 100], [150, 99], [172, 100]];
      villagers(state).slice(-spots.length).forEach((l, i) => {
        const [vx, vy] = spots[i];
        drawHero(ctx, legacyHero(l), vx, vy, { ...heroLook(legacyHero(l)), flip: vx > 100, time, size: 23 });
        this.villagerSpots.push({ id: l.id, x: vx, y: vy });
      });
    }

    // Vordergrund: die Helden, nach Tiefe sortiert. Sie bleiben auch nachts gut erkennbar.
    const actors = [...this.actors.values()].filter((a) => a.hero && a.x !== null).sort((a, b) => a.y - b.y);
    for (const a of actors) {
      const look = heroLook(a.hero, this.night);
      ctx.save();
      ctx.globalAlpha = a.alpha;
      drawHero(ctx, a.hero, a.x, a.y, { ...look, flip: a.flip, time, size: a.size });
      ctx.restore();
      const hat = a.hero.cls === 'magier' && a.hero.armor ? 0.28 : 0;
      const top = a.y - a.size * ((look.pose === 'sit' ? 1.05 : 1.25) + hat);
      // Gedankenblase: Wer am Tresen wartet, fällt auf; sonst zeigt ein Symbol, was den Helden beschäftigt
      const waiting = state.requests?.some((q) => q.data.hero === a.id);
      const icon = waiting ? '❗' : look.eyes === 'closed' || this.night ? null : a.hero.thoughtIcon;
      if (icon && a.alpha > 0.5 && !a.leaving) bubble(ctx, a.x + (a.flip ? -3 : 3), top - 1.5, icon, waiting, time + a.id * 700);
      if (look.eyes === 'closed' && a.alpha > 0.5) {
        const t = time / 900 + a.id;
        ctx.fillStyle = 'rgba(235,240,255,0.9)';
        ctx.textAlign = 'center';
        for (let i = 0; i < 3; i++) {
          const ph = (t + i / 3) % 1;
          ctx.globalAlpha = Math.sin(ph * Math.PI);
          ctx.font = `bold ${2.2 + ph * 2}px sans-serif`;
          ctx.fillText('z', a.x + (a.flip ? -4 : 4) + ph * 4 * (a.flip ? -1 : 1), top - ph * 6);
        }
        ctx.globalAlpha = 1;
      }
      if (this.selected === a.id) {
        const bob = Math.sin(time / 200) * 0.8;
        const y0 = top - 4 + bob;
        ctx.beginPath();
        ctx.moveTo(a.x - 2.4, y0 - 3); ctx.lineTo(a.x + 2.4, y0 - 3); ctx.lineTo(a.x, y0); ctx.closePath();
        ctx.fillStyle = '#ffd95a'; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 0.4; ctx.stroke();
      }
    }
    if (dark > 0) {
      ctx.fillStyle = `rgba(12,16,46,${dark * 0.22})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (fx.has('🌧️')) this.drawRain(ctx, time);
    if (crafting) {
      const f = 0.6 + 0.4 * Math.sin(time / 110) * Math.sin(time / 43);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(19, 74, 0, 19, 74, 14);
      g.addColorStop(0, `rgba(255,150,50,${0.55 + f * 0.25})`);
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.fillRect(5, 60, 28, 28);
      ctx.restore();
      ctx.fillStyle = `rgba(255,${170 + f * 50},90,0.95)`;
      ctx.beginPath(); ctx.ellipse(19, 77, 4.2, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------- Hintergrund ----------

  drawSky(ctx, minute, light, time) {
    const top = mix(mix('#0e1330', '#4a5aa0', Math.min(1, light * 2)), '#6fb2ea', Math.max(0, light * 2 - 1));
    const bottom = mix(mix('#262a52', '#f0a070', Math.min(1, light * 2)), '#cfe8f6', Math.max(0, light * 2 - 1));
    const g = ctx.createLinearGradient(0, 0, 0, 70);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 72);

    if (light < 0.45) {
      for (let i = 0; i < 45; i++) {
        const tw = 0.6 + 0.4 * Math.sin(time / 600 + i * 1.7);
        ctx.fillStyle = `rgba(255,255,235,${(0.45 - light) * 2 * tw})`;
        ctx.beginPath(); ctx.arc((i * 53.3) % W, (i * 29.7) % 46, 0.35 + (i % 3) * 0.15, 0, Math.PI * 2); ctx.fill();
      }
    }
    const sunT = (minute - 360) / 960; // 6:00 bis 22:00
    if (sunT >= 0 && sunT <= 1) {
      const sx = 12 + sunT * 176, sy = 46 - Math.sin(sunT * Math.PI) * 36;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14);
      sg.addColorStop(0, 'rgba(255,240,170,0.8)'); sg.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = sg; ctx.fillRect(sx - 14, sy - 14, 28, 28);
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath(); ctx.arc(sx, sy, 4.2, 0, Math.PI * 2); ctx.fill();
    } else {
      const mt = ((minute - 1320 + 1440) % 1440) / 480;
      const mx = 12 + mt * 176, my = 44 - Math.sin(mt * Math.PI) * 32;
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 12);
      mg.addColorStop(0, 'rgba(210,220,255,0.35)'); mg.addColorStop(1, 'rgba(210,220,255,0)');
      ctx.fillStyle = mg; ctx.fillRect(mx - 12, my - 12, 24, 24);
      ctx.fillStyle = '#eef0fa';
      ctx.beginPath(); ctx.arc(mx, my, 3.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(170,175,200,0.6)';
      ctx.beginPath(); ctx.arc(mx - 1.2, my - 0.8, 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(mx + 1.3, my + 1.2, 0.6, 0, Math.PI * 2); ctx.fill();
    }
    // Wolken
    const cloud = light > 0.3 ? `rgba(255,255,255,${0.35 + light * 0.4})` : 'rgba(120,130,170,0.25)';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 67 + time * 0.0012 * (1 + i * 0.3)) % 260) - 30;
      const y = 10 + ((i * 13) % 22);
      ctx.fillStyle = cloud;
      for (const [dx, dy, rx, ry] of [[0, 0, 9, 3], [6, -2, 6, 3.4], [-5, -1, 5, 2.6]]) {
        ctx.beginPath(); ctx.ellipse(x + dx, y + dy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  drawLandscape(ctx, light, time) {
    // ferne Berge mit Schneekappen
    const far = mix('#2c3254', '#8a9cc0', light);
    const snow = mix('#9aa2c0', '#f4f8ff', light);
    for (const [x, w, h] of [[-10, 70, 30], [40, 60, 22], [100, 60, 26]]) {
      peak(ctx, x, 66, w, h, far);
      ctx.save(); ctx.clip();
      ctx.fillStyle = snow; ctx.fillRect(x, 66 - h, w, h * 0.22);
      ctx.restore();
    }
    // Drachenhorst
    peak(ctx, 146, 66, 62, 44, mix('#1e1e30', '#5a5670', light));
    ctx.fillStyle = 'rgba(255,100,40,0.8)';
    ctx.beginPath(); ctx.ellipse(177, 22.6, 2.4, 0.8, 0, 0, Math.PI * 2); ctx.fill();
    const glowA = 0.25 + 0.1 * Math.sin(time / 700);
    const dg = ctx.createRadialGradient(177, 22, 0, 177, 22, 9);
    dg.addColorStop(0, `rgba(255,110,50,${glowA})`); dg.addColorStop(1, 'rgba(255,110,50,0)');
    ctx.fillStyle = dg; ctx.fillRect(168, 13, 18, 18);
    const t = time / 1000;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `rgba(90,90,100,${0.35 - i * 0.05})`;
      ctx.beginPath(); ctx.arc(177 + Math.sin(t + i) * 1.5 + i * 1.2, 20 - i * 3.2, 1 + i * 0.5, 0, Math.PI * 2); ctx.fill();
    }

    // Hügel
    ctx.fillStyle = mix('#203a2c', '#7fae5e', light);
    ctx.beginPath(); ctx.moveTo(0, 74);
    ctx.bezierCurveTo(30, 56, 70, 62, 100, 66); ctx.bezierCurveTo(130, 70, 160, 56, 200, 64);
    ctx.lineTo(200, 80); ctx.lineTo(0, 80); ctx.closePath(); ctx.fill();
    // Baumreihe
    const tree = mix('#16301f', '#4e8a46', light);
    const treeDark = mix('#10261a', '#3c7238', light);
    for (let i = 0; i < 26; i++) {
      const x = i * 8 + ((i * 7) % 5);
      const y = 66 + Math.sin(i * 1.3) * 3;
      ctx.fillStyle = i % 2 ? tree : treeDark;
      ctx.beginPath(); ctx.arc(x, y, 4 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }

    // Wiese
    const gg = ctx.createLinearGradient(0, 70, 0, H);
    gg.addColorStop(0, mix('#1e3a24', '#79b356', light)); gg.addColorStop(1, mix('#163020', '#5c9a44', light));
    ctx.fillStyle = gg;
    ctx.fillRect(0, 72, W, H - 72);
    // Grasbüschel
    ctx.strokeStyle = mix('#13281a', '#4c8838', light); ctx.lineWidth = 0.35;
    for (let i = 0; i < 40; i++) {
      const x = (i * 37.3) % W, y = 84 + ((i * 17.1) % 27);
      ctx.beginPath(); ctx.moveTo(x - 0.8, y); ctx.lineTo(x - 1.2, y - 1.6); ctx.moveTo(x, y); ctx.lineTo(x, y - 2); ctx.moveTo(x + 0.8, y); ctx.lineTo(x + 1.3, y - 1.5); ctx.stroke();
    }
    // Weg
    const road = mix('#4a3e34', '#d2b384', light);
    ctx.fillStyle = road;
    ctx.beginPath();
    ctx.moveTo(-5, 92); ctx.bezierCurveTo(60, 88, 140, 90, 205, 95);
    ctx.lineTo(205, 106); ctx.bezierCurveTo(140, 102, 60, 104, -5, 104); ctx.closePath(); ctx.fill();
    for (const [x, w] of [[29, 14], [88, 12], [160, 14]]) {
      ctx.beginPath(); ctx.moveTo(x, 80); ctx.lineTo(x + w, 80); ctx.lineTo(x + w + 3, 92); ctx.lineTo(x - 3, 92); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = mix('#3e342c', '#b8986a', light);
    for (let i = 0; i < 26; i++) {
      ctx.beginPath(); ctx.ellipse((i * 23.7) % W, 94 + ((i * 7.3) % 9), 0.9, 0.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Blumen in der Wiese
    const petals = ['#f4e06a', '#f08aa0', '#ffffff', '#b89af0'];
    for (let i = 0; i < 22; i++) {
      const x = (i * 47.9 + 5) % W, y = 82 + ((i * 11.3) % 9);
      ctx.fillStyle = mix('#5a5a70', petals[i % 4], 0.25 + light * 0.75);
      ctx.beginPath(); ctx.arc(x, y, 0.55, 0, Math.PI * 2); ctx.fill();
    }
    // Dorfplatz: Kopfsteinpflaster, auf dem die Helden stehen
    const paveTop = (x) => 103.5 + Math.sin(x / 31) * 1.2;
    ctx.beginPath(); ctx.moveTo(-5, paveTop(-5));
    for (let x = 0; x <= 205; x += 5) ctx.lineTo(x, paveTop(x));
    ctx.lineTo(205, H + 2); ctx.lineTo(-5, H + 2); ctx.closePath();
    const pg = ctx.createLinearGradient(0, 102, 0, H);
    pg.addColorStop(0, mix('#33302c', '#b9ad98', light)); pg.addColorStop(1, mix('#2a2824', '#a39782', light));
    ctx.fillStyle = pg; ctx.fill();
    ctx.strokeStyle = mix('#201e1c', '#857a68', light); ctx.lineWidth = 0.5; ctx.stroke();
    const cobA = mix('#3c3934', '#cbc0aa', light), cobB = mix('#2e2c28', '#a99d88', light);
    for (let row = 0; row < 7; row++) {
      const y = 105.2 + row * 2.9;
      const w = 5.2 + row * 0.35;
      for (let i = -1; i < W / w + 1; i++) {
        const x = i * w + (row % 2) * w * 0.5;
        if (y < paveTop(x + w / 2) + 0.6) continue;
        ctx.fillStyle = (i * 7 + row * 3) % 5 === 0 ? cobB : cobA;
        ctx.beginPath(); ctx.roundRect(x + 0.35, y, w - 0.7, 2.3, 0.9); ctx.fill();
      }
    }
  }

  // ---------- Dorfprojekte und Ereignisse ----------

  drawTower(ctx, light, time) {
    const stone = mix('#34322e', '#a8a094', light);
    box(ctx, 125.5, 44, 7, 38, stone, 0.5);
    ctx.fillStyle = mix('#28261f', '#8a8276', light);
    for (let y = 48; y < 80; y += 5) ctx.fillRect(126.5 + ((y / 5) % 2) * 2.5, y, 2.4, 1.4);
    box(ctx, 124.3, 40.5, 9.4, 4, stone, 0.5);
    for (const x of [124.3, 127.9, 131.5]) box(ctx, x, 38.2, 2.2, 2.5, stone, 0.4);
    ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.roundRect(128, 50, 2, 3.6, 1); ctx.fill();
    // Wimpel
    ctx.strokeStyle = LINE; ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(129, 38.2); ctx.lineTo(129, 31); ctx.stroke();
    const wave = Math.sin(time / 500) * 0.6;
    ctx.fillStyle = '#3f72d6'; ctx.beginPath(); ctx.moveTo(129, 31); ctx.lineTo(134.5, 32.2 + wave); ctx.lineTo(129, 34); ctx.closePath(); ctx.fill();
  }

  drawProjects(ctx, s, light, time) {
    const has = (id) => s.projects[id] !== undefined;
    const wood = mix('#3a2818', '#8a5e36', light);
    if (has('heiler')) { // Zelt der Heilerin am linken Rand
      ctx.beginPath(); ctx.moveTo(1, 103); ctx.lineTo(8, 91); ctx.lineTo(15, 103); ctx.closePath();
      ctx.fillStyle = mix('#3c4a3c', '#eef0e2', light); ctx.fill();
      ctx.strokeStyle = LINE; ctx.lineWidth = LW; ctx.stroke();
      ctx.fillStyle = mix('#1c2a1c', '#4a7a44', light);
      ctx.beginPath(); ctx.moveTo(6.2, 103); ctx.lineTo(8, 96); ctx.lineTo(9.8, 103); ctx.closePath(); ctx.fill();
      ctx.fillStyle = mix('#2a4a2a', '#5aa04a', light); // Kräuterbündel als Zeichen
      ctx.beginPath(); ctx.ellipse(8, 93.6, 1.1, 0.7, 0.5, 0, Math.PI * 2); ctx.fill();
    }
    if (has('markt')) { // Marktkarren
      const x = 52, y = 101;
      box(ctx, x, y - 5, 13, 3.4, wood, 0.4);
      ctx.fillStyle = mix('#1e1a16', '#4a3a2a', light);
      for (const wx of [x + 2.5, x + 10.5]) { ctx.beginPath(); ctx.arc(wx, y - 0.6, 1.7, 0, Math.PI * 2); ctx.fill(); }
      const goods = ['#d84a3c', '#e6b84a', '#6ab04a', '#d84a3c'];
      goods.forEach((c, i) => { ctx.fillStyle = mix('#444444', c, 0.3 + light * 0.7); ctx.beginPath(); ctx.arc(x + 2.2 + i * 2.9, y - 5.6, 1.2, 0, Math.PI * 2); ctx.fill(); });
      ctx.strokeStyle = wood; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(x + 0.5, y - 5); ctx.lineTo(x + 0.5, y - 12); ctx.moveTo(x + 12.5, y - 5); ctx.lineTo(x + 12.5, y - 12); ctx.stroke();
      for (let i = 0; i < 5; i++) { ctx.fillStyle = mix('#555555', i % 2 ? '#f6eedc' : '#3f8a6a', 0.3 + light * 0.7); ctx.fillRect(x - 0.6 + i * 2.84, y - 13.4, 2.84, 2.2); }
    }
    if (has('denkmal')) { // Heldendenkmal
      const x = 110;
      box(ctx, x - 3.2, 97, 6.4, 5, mix('#34322e', '#b4aca0', light), 0.4);
      ctx.fillStyle = mix('#3a3a40', '#c8c8d0', light); ctx.strokeStyle = LINE; ctx.lineWidth = 0.35;
      ctx.beginPath(); ctx.roundRect(x - 1.4, 90.5, 2.8, 6.5, 1); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, 89.2, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 1.6, 92); ctx.lineTo(x + 3.6, 85.5); ctx.lineWidth = 0.7; ctx.strokeStyle = mix('#5a5a60', '#e8e8f0', light); ctx.stroke();
    }
    if (has('brunnen')) { // Dorfbrunnen
      const x = 132;
      box(ctx, x - 5, 96, 10, 5.5, mix('#34322e', '#a8a094', light), 0.45);
      ctx.fillStyle = mix('#12202e', '#5a9ac8', light); ctx.beginPath(); ctx.ellipse(x, 96, 4.2, 1.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = wood; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(x - 4.2, 96); ctx.lineTo(x - 4.2, 88.5); ctx.moveTo(x + 4.2, 96); ctx.lineTo(x + 4.2, 88.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 6, 89); ctx.lineTo(x, 85.4); ctx.lineTo(x + 6, 89); ctx.closePath();
      ctx.fillStyle = mix('#461612', '#9c3c2c', light); ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 0.4; ctx.stroke();
      ctx.strokeStyle = mix('#444444', '#d8d0c0', light); ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(x, 89); ctx.lineTo(x, 93.5); ctx.stroke();
      ctx.fillStyle = wood; ctx.fillRect(x - 0.9, 93.2, 1.8, 1.7);
    }
    if (has('buehne')) { // Bardenbühne vor der Taverne
      box(ctx, 181, 99, 17, 3, wood, 0.4);
      ctx.strokeStyle = wood; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(182, 99); ctx.lineTo(182, 88); ctx.moveTo(197, 99); ctx.lineTo(197, 88); ctx.stroke();
      ctx.fillStyle = mix('#3a1a3a', '#8a4a9a', light);
      ctx.beginPath(); ctx.moveTo(181.5, 88); ctx.lineTo(197.5, 88); ctx.lineTo(197.5, 90.5); ctx.quadraticCurveTo(189.5, 93, 181.5, 90.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = LINE; ctx.lineWidth = 0.35; ctx.stroke();
    }
  }

  // Wimpelkette quer über den Platz – es wird gefeiert
  drawBunting(ctx, light, time) {
    const colors = ['#d84a3c', '#e6b84a', '#3f72d6', '#6ab04a', '#f6eedc'];
    const yAt = (x) => 52 + Math.sin((x / W) * Math.PI) * 6 + Math.sin(time / 800 + x / 20) * 0.4;
    ctx.strokeStyle = mix('#1e1a16', '#5a4a3a', light); ctx.lineWidth = 0.3;
    ctx.beginPath(); ctx.moveTo(0, yAt(0)); for (let x = 4; x <= W; x += 4) ctx.lineTo(x, yAt(x)); ctx.stroke();
    for (let i = 0; i < 28; i++) {
      const x = 4 + i * 7;
      ctx.fillStyle = mix('#444450', colors[i % 5], 0.35 + light * 0.65);
      ctx.beginPath(); ctx.moveTo(x - 1.6, yAt(x - 1.6)); ctx.lineTo(x + 1.6, yAt(x + 1.6)); ctx.lineTo(x, yAt(x) + 3.4); ctx.closePath(); ctx.fill();
    }
  }

  // Musik: Noten steigen auf (von der Bühne oder aus der Taverne)
  drawNotes(ctx, time, lively) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,250,230,0.9)'; ctx.textAlign = 'center';
    const n = lively ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const ph = ((time / 3200) + i / n) % 1;
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
      ctx.font = `${3 + (i % 2)}px sans-serif`;
      ctx.fillText(i % 2 ? '♪' : '♫', 172 + i * 6 + Math.sin(ph * 6 + i) * 2, 62 - ph * 16);
    }
    ctx.restore();
  }

  drawRain(ctx, time) {
    ctx.fillStyle = 'rgba(70,84,110,0.22)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(210,225,245,0.5)'; ctx.lineWidth = 0.3;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const x = (i * 53.7 + time * 0.02) % (W + 20) - 10;
      const y = (i * 37.3 + time * 0.11 * (1 + (i % 3) * 0.15)) % (H + 10) - 5;
      ctx.moveTo(x, y); ctx.lineTo(x - 1.2, y + 4.2);
    }
    ctx.stroke();
  }

  // ---------- Gebäude ----------

  drawSmithy(ctx, s, light) {
    const lvl = s.buildings.schmiede;
    // Schornstein
    box(ctx, 42, 32, 7, 20, mix('#3e2e2a', '#8a6a5c', light), 0.4);
    ctx.fillStyle = mix('#2e221e', '#6a4e44', light); ctx.fillRect(41.5, 31.5, 8, 2);
    if (lvl >= 3) box(ctx, 11, 38, 5, 12, mix('#3e2e2a', '#8a6a5c', light), 0.4);
    // Wand
    const wall = ctx.createLinearGradient(6, 0, 52, 0);
    wall.addColorStop(0, mix('#3a3634', '#9a9088', light)); wall.addColorStop(1, mix('#2e2a28', '#7e746c', light));
    box(ctx, 6, 54, 46, 26, wall, 0.6);
    ctx.fillStyle = mix('#2a2624', '#6e665e', light);
    for (let y = 57; y < 79; y += 4) for (let x = 7.5 + ((y - 57) / 4) % 2 * 3; x < 50; x += 6.5) {
      ctx.beginPath(); ctx.roundRect(x, y, 5, 2.6, 1); ctx.fill();
    }
    // Dach
    roof(ctx, 2, 55, 56, 18, mix('#20222c', '#4c5468', light), mix('#181a22', '#3a4052', light));
    if (lvl >= 4) { ctx.strokeStyle = '#e6b84a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(2.5, 55); ctx.lineTo(30, 37.5); ctx.lineTo(57.5, 55); ctx.stroke(); }
    // Esse
    ctx.fillStyle = '#1a1210';
    ctx.beginPath(); ctx.moveTo(12, 80); ctx.lineTo(12, 68); ctx.arc(19, 68, 7, Math.PI, 0); ctx.lineTo(26, 80); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = LW; ctx.stroke();
    // Tür
    door(ctx, 32, 64, 9, 16, mix('#3a2818', '#7a5232', light));
    // Fenster über der Tür
    win(ctx, this, 33.5, 57, 6, 4, light);
    if (lvl >= 2) sign(ctx, 44, 58, light, (c) => { // Hammer
      c.fillStyle = '#d8d8e0'; c.fillRect(-2, -1.5, 4, 1.6); c.fillStyle = '#8a6a44'; c.fillRect(-0.4, 0, 0.8, 2.4);
    });
  }

  drawShop(ctx, s, light) {
    const lvl = s.buildings.laden;
    const x0 = 62, w = 58;
    // Wand
    const wall = ctx.createLinearGradient(0, 52, 0, 80);
    wall.addColorStop(0, mix('#6a6050', '#f0e2c0', light)); wall.addColorStop(1, mix('#5a5040', '#dccaa2', light));
    box(ctx, x0, 52, w, 28, wall, 0.6);
    const beam = mix('#3a2818', '#7a5232', light);
    ctx.fillStyle = beam;
    for (const bx of [x0, x0 + 22, x0 + 36, x0 + w - 1.6]) ctx.fillRect(bx, 52, 1.6, 28);
    ctx.fillRect(x0, 63, w, 1.4);
    // Dach
    roof(ctx, x0 - 4, 53, w + 8, 19, mix('#5a1e18', '#c0503a', light), mix('#461612', '#9c3c2c', light), true);
    if (lvl >= 2) { // Gaube
      box(ctx, x0 + 24, 40, 11, 9, mix('#6a6050', '#f0e2c0', light), 0.4);
      ctx.fillStyle = mix('#461612', '#9c3c2c', light);
      ctx.beginPath(); ctx.moveTo(x0 + 22.5, 41); ctx.lineTo(x0 + 29.5, 35.5); ctx.lineTo(x0 + 36.5, 41); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = LINE; ctx.lineWidth = LW; ctx.stroke();
      win(ctx, this, x0 + 27, 42.5, 5, 4.5, light);
    }
    // Tür
    door(ctx, x0 + 24, 65, 10, 15, mix('#24422e', '#4e7a52', light));
    // Schaufenster
    const items = s.shelf.slice(0, 14);
    shopWindow(ctx, this, x0 + 3, 66, 18, 11, items.slice(0, 8), light);
    shopWindow(ctx, this, x0 + 38, 66, 16, 11, items.slice(8), light);
    // Markise
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#f6eedc' : '#c0443c';
      ctx.beginPath();
      ctx.moveTo(x0 + 2 + i * 3.3, 63.5); ctx.lineTo(x0 + 5.3 + i * 3.3, 63.5); ctx.lineTo(x0 + 5.6 + i * 3.3, 66.5);
      ctx.arc(x0 + 3.95 + i * 3.3, 66.5, 1.65, 0, Math.PI); ctx.closePath(); ctx.fill();
    }
    // Schild mit Münze
    sign(ctx, x0 + 46, 57, light, (c) => {
      c.fillStyle = '#e6b84a'; c.beginPath(); c.arc(0, 0.4, 1.6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#a07a2a'; c.lineWidth = 0.3; c.stroke();
    });
    // Kisten neben dem Laden (wachsen mit dem Ausbau)
    for (let i = 0; i < lvl; i++) {
      const bx = x0 + w + 0.5 + (i % 2) * 0.8, by = 74 - i * 5.4;
      box(ctx, bx, by, 6, 5.4, mix('#4a3418', '#a87a40', light), 0.4);
      ctx.strokeStyle = mix('#3a2410', '#7a5428', light); ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 6, by + 5.4); ctx.moveTo(bx + 6, by); ctx.lineTo(bx, by + 5.4); ctx.stroke();
    }
  }

  drawBoard(ctx, s, light) {
    const x = 125;
    const wood = mix('#3a2818', '#7a5232', light);
    box(ctx, x, 70, 1.4, 14, wood, 0.3);
    box(ctx, x + 10.6, 70, 1.4, 14, wood, 0.3);
    box(ctx, x - 1, 68, 14, 10, mix('#4a3a20', '#a8844e', light), 0.5);
    ctx.fillStyle = mix('#3a2818', '#6a4628', light);
    ctx.beginPath(); ctx.moveTo(x - 2.5, 68.5); ctx.lineTo(x + 6, 64.5); ctx.lineTo(x + 14.5, 68.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = LW; ctx.stroke();
    s.bounties.slice(0, 6).forEach((b, i) => {
      const nx = x + 0.5 + (i % 3) * 4, ny = 69.5 + Math.floor(i / 3) * 4;
      ctx.save(); ctx.translate(nx + 1.6, ny + 1.6); ctx.rotate(((i * 37) % 7 - 3) * 0.06);
      ctx.fillStyle = mix('#8a8678', '#fbf5e4', light); ctx.fillRect(-1.6, -1.6, 3.2, 3.4);
      ctx.fillStyle = '#b8302c'; ctx.beginPath(); ctx.arc(0, -1.2, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    // Laterne
    box(ctx, x + 14, 66, 0.8, 18, wood, 0.25);
    ctx.fillStyle = mix('#5a4a2a', '#f4d890', light);
    ctx.beginPath(); ctx.roundRect(x + 13, 64, 2.8, 3, 0.6); ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 0.3; ctx.stroke();
    this.lights.push({ x: x + 14.4, y: 65.5, r: 12 });
    this.windowsLit.push([x + 13.4, 64.5, 2, 2]);
  }

  drawTavern(ctx, s, light) {
    const lvl = s.buildings.taverne;
    const x0 = 138, w = 58;
    if (lvl >= 2) { // Anbau
      box(ctx, x0 + w - 3, 60, 10, 20, mix('#5a4a32', '#d8b886', light), 0.5);
      ctx.fillStyle = mix('#2e1a12', '#7a4430', light);
      ctx.beginPath(); ctx.moveTo(x0 + w - 4, 60.5); ctx.lineTo(x0 + w + 8, 55); ctx.lineTo(x0 + w + 8, 60.5); ctx.closePath(); ctx.fill();
      win(ctx, this, x0 + w + 1, 66, 4, 5, light);
    }
    const wall = ctx.createLinearGradient(0, 46, 0, 80);
    wall.addColorStop(0, mix('#5e4e36', '#e4c896', light)); wall.addColorStop(1, mix('#4e4030', '#c8a878', light));
    box(ctx, x0, 46, w, 34, wall, 0.6);
    const beam = mix('#3a2818', '#7a5232', light);
    ctx.fillStyle = beam;
    for (const bx of [x0, x0 + 18, x0 + 39, x0 + w - 1.6]) ctx.fillRect(bx, 46, 1.6, 34);
    ctx.fillRect(x0, 62, w, 1.6);
    ctx.strokeStyle = beam; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(x0 + 1, 47); ctx.lineTo(x0 + 17.5, 61.5); ctx.moveTo(x0 + w - 1, 47); ctx.lineTo(x0 + 40, 61.5); ctx.stroke();
    // Dach
    roof(ctx, x0 - 4, 47, w + 8, 22, mix('#2e1a12', '#80482e', light), mix('#24140e', '#683824', light), true);
    if (lvl >= 3) { // Fahne
      ctx.strokeStyle = LINE; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(x0 + 29, 25.5); ctx.lineTo(x0 + 29, 17); ctx.stroke();
      ctx.fillStyle = '#c0443c'; ctx.beginPath(); ctx.moveTo(x0 + 29, 17); ctx.lineTo(x0 + 35, 18.5); ctx.lineTo(x0 + 29, 20.5); ctx.closePath(); ctx.fill();
    }
    // Fenster
    for (const [a, b, c, d] of [[x0 + 4, 50, 9, 8], [x0 + 23, 50, 11, 8], [x0 + 44, 50, 9, 8], [x0 + 4, 67, 9, 8], [x0 + 44, 67, 9, 8]]) {
      win(ctx, this, a, b, c, d, light, true);
    }
    // Tür
    door(ctx, x0 + 23, 65, 11, 15, mix('#3a2412', '#7a4a26', light));
    // Schild mit Krug
    sign(ctx, x0 + 37, 66, light, (c) => {
      c.fillStyle = '#e6b84a'; c.beginPath(); c.roundRect(-1.4, -1.2, 2.4, 3, 0.4); c.fill();
      c.strokeStyle = '#e6b84a'; c.lineWidth = 0.5; c.beginPath(); c.arc(1.2, 0.3, 0.8, -1.2, 1.2); c.stroke();
      c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(-0.2, -1.3, 1.5, 0.6, 0, 0, Math.PI * 2); c.fill();
    });
    this.lights.push({ x: x0 + 28.5, y: 72, r: 16 });
  }

  drawProps(ctx, s, light) {
    // Amboss auf Baumstumpf
    ctx.fillStyle = mix('#3a2818', '#7a5232', light);
    ctx.beginPath(); ctx.roundRect(46, 84, 6, 4, 0.8); ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 0.4; ctx.stroke();
    ctx.fillStyle = mix('#22222a', '#4a4a56', light);
    ctx.beginPath();
    ctx.moveTo(43.5, 82); ctx.lineTo(54.5, 82); ctx.quadraticCurveTo(54, 84, 51.5, 84); ctx.lineTo(46.5, 84);
    ctx.quadraticCurveTo(44, 83.6, 43.5, 82); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(45, 82.2, 8, 0.5);
    // Fässer an der Taverne
    for (const [bx, by] of [[133.5, 80], [136.5, 82.5]]) {
      ctx.fillStyle = mix('#3e2a16', '#946234', light);
      ctx.beginPath(); ctx.ellipse(bx, by - 2.5, 2.4, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = LINE; ctx.lineWidth = 0.35; ctx.stroke();
      ctx.strokeStyle = mix('#1e1e22', '#5a5a62', light);
      ctx.beginPath(); ctx.moveTo(bx - 2.3, by - 3.6); ctx.lineTo(bx + 2.3, by - 3.6); ctx.moveTo(bx - 2.3, by - 1.4); ctx.lineTo(bx + 2.3, by - 1.4); ctx.stroke();
    }
    // Bank
    ctx.fillStyle = mix('#3a2818', '#8a5e36', light);
    ctx.fillRect(144, 83, 14, 1.4); ctx.fillRect(145, 84.4, 0.9, 2.2); ctx.fillRect(156, 84.4, 0.9, 2.2);
    // Büsche vorne
    for (const [bx, by, r] of [[1, 104, 5], [199, 104, 5.5]]) {
      ctx.fillStyle = mix('#163020', '#4e8a3c', light);
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.arc(bx + r * 0.8, by + 1, r * 0.7, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ---------- Zeichenhilfen ----------

function bubble(ctx, x, y, icon, urgent, time) {
  const bob = Math.sin(time / (urgent ? 260 : 900)) * (urgent ? 0.9 : 0.4);
  const r = urgent ? 4.6 : 4;
  const cy = y - r - 1.6 + bob;
  ctx.save();
  ctx.fillStyle = urgent ? '#ffd95a' : 'rgba(255,253,244,0.95)';
  ctx.strokeStyle = LINE; ctx.lineWidth = 0.45;
  // kleine Blasen als „Denk“-Spur, darüber die große
  for (const [dx, dy, rr] of [[-1.6, r + 2.2, 0.6], [-0.6, r + 0.9, 0.95]]) {
    ctx.beginPath(); ctx.arc(x + dx, cy + dy, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.font = `${urgent ? 5.4 : 4.6}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2a1c14';
  ctx.fillText(icon, x, cy + 0.4);
  ctx.restore();
}

function box(ctx, x, y, w, h, fill, lw = LW) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = LINE; ctx.lineWidth = lw;
  ctx.strokeRect(x, y, w, h);
}

function roof(ctx, x, base, w, h, color, dark, tiles = false) {
  ctx.beginPath();
  ctx.moveTo(x, base); ctx.lineTo(x + w / 2, base - h); ctx.lineTo(x + w, base); ctx.closePath();
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, color); g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.35;
  for (let yy = base - 2.5; yy > base - h; yy -= 2.6) {
    ctx.beginPath();
    if (tiles) for (let xx = x; xx < x + w; xx += 2.6) ctx.arc(xx + 1.3, yy, 1.3, 0, Math.PI);
    else { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(x, base); ctx.lineTo(x + w / 2, base - h); ctx.lineTo(x + w, base);
  ctx.strokeStyle = LINE; ctx.lineWidth = 0.7; ctx.stroke();
}

function door(ctx, x, y, w, h, color) {
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = LW; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.35;
  ctx.beginPath(); ctx.moveTo(x + w / 3, y + 2); ctx.lineTo(x + w / 3, y + h); ctx.moveTo(x + (2 * w) / 3, y + 2); ctx.lineTo(x + (2 * w) / 3, y + h); ctx.stroke();
  ctx.fillStyle = '#d8b04a'; ctx.beginPath(); ctx.arc(x + w - 1.6, y + h * 0.55, 0.55, 0, Math.PI * 2); ctx.fill();
}

function win(ctx, scene, x, y, w, h, light, shutters = false) {
  ctx.fillStyle = mix('#1e2a3c', '#5a7e98', light);
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 0.6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.moveTo(x + 0.6, y + h - 0.6); ctx.lineTo(x + w * 0.45, y + 0.6); ctx.lineTo(x + w * 0.6, y + 0.6); ctx.lineTo(x + 1.6, y + h - 0.6); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 0.6); ctx.stroke();
  ctx.lineWidth = 0.35;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  if (shutters) {
    ctx.fillStyle = mix('#2a3a24', '#5a7e46', light);
    ctx.fillRect(x - 2, y, 1.6, h); ctx.fillRect(x + w + 0.4, y, 1.6, h);
  }
  scene.windowsLit.push([x + 0.4, y + 0.4, w - 0.8, h - 0.8]);
  scene.lights.push({ x: x + w / 2, y: y + h / 2, r: Math.max(w, h) * 1.3 });
}

function shopWindow(ctx, scene, x, y, w, h, items, light) {
  ctx.fillStyle = mix('#1e2a3c', '#4e6e88', light);
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 0.6); ctx.fill();
  // Regalbrett
  ctx.fillStyle = mix('#3a2818', '#8a5e36', light);
  ctx.fillRect(x, y + h - 2, w, 1);
  items.forEach((it, i) => {
    const rc = RECIPES[it.recipe];
    const ix = x + 1.6 + i * ((w - 3) / Math.max(4, items.length));
    const color = rc.slot === 'potion' ? '#d84a6a' : TIER_COLORS[rc.tier];
    ctx.fillStyle = color;
    if (rc.slot === 'potion') { ctx.beginPath(); ctx.arc(ix + 0.8, y + h - 3.2, 1.1, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(ix + 0.5, y + h - 5, 0.6, 1.2); }
    else if (rc.slot === 'weapon') { ctx.fillRect(ix + 0.4, y + 1.5, 0.8, h - 3.5); ctx.fillStyle = '#8a6a44'; ctx.fillRect(ix - 0.2, y + h - 4.2, 2, 0.6); }
    else { ctx.beginPath(); ctx.roundRect(ix - 0.3, y + h - 7, 2.4, 5, 0.6); ctx.fill(); }
  });
  ctx.strokeStyle = LINE; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 0.6); ctx.stroke();
  scene.lights.push({ x: x + w / 2, y: y + h / 2, r: w });
  scene.windowsLit.push([x + 0.4, y + 0.4, w - 0.8, 2]);
}

function sign(ctx, x, y, light, icon) {
  ctx.strokeStyle = LINE; ctx.lineWidth = 0.35;
  ctx.beginPath(); ctx.moveTo(x - 2, y - 3); ctx.lineTo(x - 2, y - 1.6); ctx.moveTo(x + 2, y - 3); ctx.lineTo(x + 2, y - 1.6); ctx.stroke();
  ctx.fillStyle = mix('#3a2818', '#7a5232', light);
  ctx.beginPath(); ctx.roundRect(x - 3.6, y - 1.8, 7.2, 5, 1); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(x, y + 0.7); icon(ctx); ctx.restore();
}

function peak(ctx, x, base, w, h, color) {
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.quadraticCurveTo(x + w * 0.35, base - h * 0.7, x + w / 2, base - h);
  ctx.quadraticCurveTo(x + w * 0.65, base - h * 0.7, x + w, base);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

function daylight(minute) {
  // 0 = Nacht, 1 = voller Tag; Dämmerung 5–7 und 20–22 Uhr
  const h = minute / 60;
  if (h < 5 || h >= 22) return 0;
  if (h < 7) return (h - 5) / 2;
  if (h >= 20) return 1 - (h - 20) / 2;
  return 1;
}

function mix(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}
