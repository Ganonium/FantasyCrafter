// Dorfszene auf Canvas: Gebäude, Tageszeit und die Helden, die gerade im Dorf sind.

import { drawHero } from './sprites.js';
import { RECIPES } from './data.js';
import { clockOf, isNight } from './sim.js';

export const W = 200;
export const H = 112;
const EXIT = { x: 214, y: 100 };
const TAVERN_DOOR = { x: 166, y: 84 };

const TIER_COLORS = ['#999', '#b0b6bc', '#dfe4ea', '#9fd8ff', '#e0b040'];

export class VillageScene {
  constructor(canvas, onHeroTap) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.actors = new Map();
    this.first = true;
    this.smoke = [];
    this.selected = null;
    this.scale = 2;
    this.seed = 1;
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      const hit = [...this.actors.values()]
        .filter((a) => !a.hidden && x >= a.x - 7 && x <= a.x + 7 && y >= a.y - 24 && y <= a.y + 1)
        .sort((a, b) => b.y - a.y)[0];
      if (hit) onHeroTap(hit.id);
    });
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth || W * 2;
    this.scale = Math.max(1, Math.round((cssW * dpr) / W));
    this.canvas.width = W * this.scale;
    this.canvas.height = H * this.scale;
  }

  rand() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  randomSpot(hero) {
    if (hero.state === 'rest') return { x: 140 + this.rand() * 52, y: 86 + this.rand() * 18 };
    const spots = [
      { x: 34, y: 86 }, { x: 94, y: 86 }, { x: 131, y: 88 }, { x: 166, y: 86 },
    ];
    if (this.rand() < 0.45) {
      const s = spots[Math.floor(this.rand() * spots.length)];
      return { x: s.x + (this.rand() - 0.5) * 10, y: s.y + this.rand() * 4 };
    }
    return { x: 12 + this.rand() * 180, y: 86 + this.rand() * 22 };
  }

  sync(state) {
    const night = isNight(state);
    for (const h of state.heroes) {
      const inVillage = h.state !== 'away';
      let a = this.actors.get(h.id);
      if (inVillage && (!a || a.leaving)) {
        if (!a || a.leaving) {
          const start = this.first ? this.randomSpot(h) : { ...EXIT };
          a = { id: h.id, x: start.x, y: start.y, tx: start.x, ty: start.y, wait: this.rand() * 2, flip: true, frame: 0, ft: 0 };
          if (this.first && night) { a.hidden = true; a.x = TAVERN_DOOR.x; a.y = TAVERN_DOOR.y; }
          this.actors.set(h.id, a);
        }
      }
      if (a) a.hero = h;
      if (a && !inVillage && !a.leaving) {
        a.leaving = true; a.hidden = false; a.tx = EXIT.x; a.ty = EXIT.y; a.wait = 0;
      }
      if (a && inVillage) {
        a.injured = h.state === 'injured';
        a.night = night;
      }
    }
    for (const [id, a] of this.actors) if (!state.heroes.some((h) => h.id === id)) { a.leaving = true; a.tx = EXIT.x; a.ty = EXIT.y; }
    this.first = false;
  }

  update(dt) {
    for (const [id, a] of this.actors) {
      const speed = a.injured ? 6 : 14;
      if (a.night && !a.leaving) { a.tx = TAVERN_DOOR.x; a.ty = TAVERN_DOOR.y; a.wait = 0; }
      if (!a.night && a.hidden) { a.hidden = false; a.wait = 1 + this.rand() * 3; }
      if (a.wait > 0) { a.wait -= dt; a.frame = 0; continue; }
      const dx = a.tx - a.x, dy = a.ty - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.8) {
        if (a.leaving) { this.actors.delete(id); continue; }
        if (a.night) { a.hidden = true; continue; }
        a.wait = 2 + this.rand() * 6;
        const s = this.randomSpot(a.hero);
        a.tx = s.x; a.ty = s.y;
        continue;
      }
      const step = Math.min(dist, speed * dt);
      a.x += (dx / dist) * step;
      a.y += (dy / dist) * step;
      if (Math.abs(dx) > 0.5) a.flip = dx < 0;
      a.ft += dt;
      if (a.ft > 0.18) { a.ft = 0; a.frame = 1 - a.frame; }
    }
    // Rauch
    for (const p of this.smoke) { p.y -= dt * 6; p.x += dt * 2; p.life -= dt; }
    this.smoke = this.smoke.filter((p) => p.life > 0);
  }

  render(state, time) {
    const ctx = this.ctx;
    const S = this.scale;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const { minute } = clockOf(state);
    const light = daylight(minute);

    // Himmel
    const sky = mix(mix('#141a33', '#e89a6a', Math.min(1, light * 2)), '#8ec8f0', Math.max(0, light * 2 - 1));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 64);
    if (light < 0.4) {
      ctx.fillStyle = `rgba(255,255,230,${(0.4 - light) * 2})`;
      for (let i = 0; i < 40; i++) ctx.fillRect((i * 53) % W, (i * 29) % 44, 1, 1);
    }
    // Sonne / Mond
    const sunT = (minute - 360) / 960; // 6:00 bis 22:00
    if (sunT >= 0 && sunT <= 1) {
      ctx.fillStyle = '#fff2a8';
      const sx = 10 + sunT * 180, sy = 40 - Math.sin(sunT * Math.PI) * 32;
      ctx.fillRect(sx - 3, sy - 3, 6, 6); ctx.fillRect(sx - 4, sy - 2, 8, 4); ctx.fillRect(sx - 2, sy - 4, 4, 8);
    } else {
      const mt = ((minute - 1320 + 1440) % 1440) / 480;
      ctx.fillStyle = '#e8ecf8';
      const mx = 10 + mt * 180, my = 40 - Math.sin(mt * Math.PI) * 30;
      ctx.fillRect(mx - 3, my - 2, 6, 4); ctx.fillRect(mx - 2, my - 3, 4, 6);
      ctx.fillStyle = '#c4cadc'; ctx.fillRect(mx - 1, my - 1, 1, 1); ctx.fillRect(mx + 1, my + 1, 1, 1);
    }

    // Berge mit Drachenhorst
    ctx.fillStyle = mix('#3a4058', '#6a7898', light);
    mountain(ctx, 0, 64, 70, 26); mountain(ctx, 50, 64, 60, 18); mountain(ctx, 120, 64, 50, 22);
    ctx.fillStyle = mix('#2a2c3c', '#4a4a5e', light);
    mountain(ctx, 150, 64, 56, 38);
    ctx.fillStyle = 'rgba(255,90,40,0.7)';
    ctx.fillRect(177, 27, 2, 1);
    ctx.fillStyle = 'rgba(80,80,90,0.5)';
    const t = time / 1000;
    for (let i = 0; i < 4; i++) ctx.fillRect(178 + Math.sin(t + i) * 2 + i, 24 - i * 3, 2, 2);

    // Wiese, Weg
    ctx.fillStyle = mix('#2c4a2a', '#5e9a48', light);
    ctx.fillRect(0, 64, W, H - 64);
    ctx.fillStyle = mix('#243e22', '#4e8a3c', light);
    for (let i = 0; i < 60; i++) ctx.fillRect((i * 37) % W, 66 + ((i * 17) % 44), 1, 1);
    ctx.fillStyle = mix('#5a4a3a', '#b89a6a', light);
    ctx.fillRect(0, 92, W, 12);
    ctx.fillRect(26, 80, 16, 12); ctx.fillRect(88, 80, 14, 12); ctx.fillRect(158, 80, 16, 12);
    ctx.fillStyle = mix('#4a3e30', '#a88a5a', light);
    for (let i = 0; i < 30; i++) ctx.fillRect((i * 23) % W, 93 + ((i * 7) % 10), 2, 1);

    this.drawSmithy(ctx, state, time, light);
    this.drawShop(ctx, state, light);
    this.drawBoard(ctx, state, light);
    this.drawTavern(ctx, state, light);

    // Rauch über der Esse
    const crafting = state.slots.some((s) => s && !s.blocked);
    if (crafting && this.rand() < 0.15) this.smoke.push({ x: 47, y: 40, life: 3 });
    for (const p of this.smoke) {
      ctx.fillStyle = `rgba(200,200,200,${p.life / 6})`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 2);
    }

    // Helden nach Tiefe sortiert
    const actors = [...this.actors.values()].filter((a) => !a.hidden && a.hero).sort((a, b) => a.y - b.y);
    for (const a of actors) {
      drawHero(ctx, a.hero, a.x, a.y, { flip: a.flip, frame: a.frame, time, injured: a.injured });
      const emo = a.injured ? '🩹' : a.hero.state === 'rest' ? '🍺' : null;
      if (emo && !a.leaving) {
        ctx.font = '6px sans-serif';
        ctx.fillText(emo, a.x + 3, a.y - 22);
      }
      if (this.selected === a.id) {
        ctx.fillStyle = '#ffe066';
        ctx.fillRect(Math.round(a.x) - 1, Math.round(a.y) - 27, 3, 2);
        ctx.fillRect(Math.round(a.x), Math.round(a.y) - 25, 1, 1);
      }
    }

    // Nacht-Abdunklung, danach leuchtende Fenster
    if (light < 0.9) {
      ctx.fillStyle = `rgba(10,14,40,${(0.9 - light) * 0.6})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,200,90,0.9)';
      for (const [x, y, w, h] of this.windows) ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,200,90,0.12)';
      for (const [x, y, w, h] of this.windows) ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    }
    if (crafting) {
      const f = 0.6 + 0.4 * Math.sin(time / 120) * Math.sin(time / 47);
      ctx.fillStyle = `rgba(255,140,40,${0.6 + f * 0.3})`;
      ctx.fillRect(16, 68, 8, 8);
      ctx.fillStyle = `rgba(255,220,120,${0.5 + f * 0.4})`;
      ctx.fillRect(18, 72, 4, 4);
    }
  }

  drawSmithy(ctx, s, time, light) {
    const lvl = s.buildings.schmiede;
    const wall = mix('#3e3a38', '#8a8078', light);
    const stone = mix('#34302e', '#6e665e', light);
    // Wände
    ctx.fillStyle = wall; ctx.fillRect(6, 56, 46, 24);
    ctx.fillStyle = stone;
    for (let y = 58; y < 80; y += 4) for (let x = 6 + ((y / 4) % 2) * 3; x < 50; x += 7) ctx.fillRect(x, y, 5, 1);
    // Dach
    ctx.fillStyle = mix('#22242c', '#454a5a', light);
    for (let i = 0; i < 10; i++) ctx.fillRect(3 + i * 2, 55 - i * 1.6, 52 - i * 4, 2);
    // Schornstein
    ctx.fillStyle = mix('#3a2e2a', '#7a5e52', light);
    ctx.fillRect(44, 40, 6, 16);
    if (lvl >= 3) ctx.fillRect(10, 44, 5, 10);
    // Esse (Öffnung)
    ctx.fillStyle = '#1a1210';
    ctx.fillRect(14, 66, 12, 14); ctx.fillRect(15, 65, 10, 1);
    // Tür
    ctx.fillStyle = mix('#3a2818', '#6b4a2a', light);
    ctx.fillRect(32, 66, 9, 14);
    // Amboss
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(44, 82, 10, 3); ctx.fillRect(47, 85, 4, 3); ctx.fillRect(45, 88, 8, 1);
    if (lvl >= 2) { ctx.fillStyle = '#c0a040'; ctx.fillRect(30, 60, 13, 4); ctx.fillStyle = '#3a2818'; ctx.fillRect(35, 61, 3, 2); }
    if (lvl >= 4) { ctx.fillStyle = '#e0b040'; ctx.fillRect(6, 56, 46, 1); }
    this.windows = [[34, 70, 5, 4]];
  }

  drawShop(ctx, s, light) {
    const lvl = s.buildings.laden;
    const x0 = 62, w = 60;
    ctx.fillStyle = mix('#6a5e48', '#dccba4', light); ctx.fillRect(x0, 54, w, 26);
    ctx.fillStyle = mix('#3a2818', '#6b4a2a', light);
    ctx.fillRect(x0, 54, w, 2); ctx.fillRect(x0, 66, w, 1); ctx.fillRect(x0, 54, 2, 26); ctx.fillRect(x0 + w - 2, 54, 2, 26);
    ctx.fillRect(x0 + 20, 54, 1, 26);
    // Dach
    ctx.fillStyle = mix('#4a1e18', '#a8402e', light);
    for (let i = 0; i < 10; i++) ctx.fillRect(x0 - 3 + i * 2.4, 53 - i * 1.7, w + 6 - i * 4.8, 2);
    if (lvl >= 2) { ctx.fillStyle = mix('#3a2818', '#6b4a2a', light); ctx.fillRect(x0 + 24, 40, 12, 8); ctx.fillStyle = '#ffd890'; ctx.fillRect(x0 + 27, 42, 6, 4); }
    // Tür
    ctx.fillStyle = mix('#2a1a10', '#5a3a1e', light); ctx.fillRect(x0 + 27, 66, 10, 14);
    ctx.fillStyle = '#c0a040'; ctx.fillRect(x0 + 35, 73, 1, 1);
    // Schaufenster mit Waren
    ctx.fillStyle = mix('#1e2a34', '#3a5468', light); ctx.fillRect(x0 + 4, 68, 20, 10);
    ctx.fillRect(x0 + 41, 68, 16, 10);
    const items = s.shelf.slice(0, 12);
    items.forEach((it, i) => {
      const rc = RECIPES[it.recipe];
      const wx = i < 6 ? x0 + 5 + i * 3 : x0 + 42 + (i - 6) * 2.6;
      ctx.fillStyle = rc.slot === 'potion' ? '#d04060' : TIER_COLORS[rc.tier];
      ctx.fillRect(Math.round(wx), rc.slot === 'weapon' ? 69 : 73, 2, rc.slot === 'weapon' ? 8 : 4);
    });
    // Markise
    for (let i = 0; i < 11; i++) { ctx.fillStyle = i % 2 ? '#f0e8d8' : '#b83a3a'; ctx.fillRect(x0 + 3 + i * 2, 65, 2, 3); }
    // Schild
    ctx.fillStyle = mix('#3a2818', '#6b4a2a', light); ctx.fillRect(x0 + 24, 57, 16, 7);
    ctx.fillStyle = '#e0b040'; ctx.fillRect(x0 + 30, 59, 4, 3); ctx.fillRect(x0 + 31, 58, 2, 5);
    // Lager-Kisten
    ctx.fillStyle = mix('#4a3418', '#9a7038', light);
    for (let i = 0; i < s.buildings.lager; i++) { ctx.fillRect(x0 + w + 1, 74 - i * 6, 6, 6); }
    ctx.fillStyle = mix('#3a2410', '#6a4a20', light);
    for (let i = 0; i < s.buildings.lager; i++) { ctx.fillRect(x0 + w + 1, 76 - i * 6, 6, 1); }
    this.windows.push([x0 + 4, 68, 20, 10], [x0 + 41, 68, 16, 10]);
  }

  drawBoard(ctx, s, light) {
    const x = 126;
    ctx.fillStyle = mix('#3a2818', '#6b4a2a', light);
    ctx.fillRect(x, 70, 1, 14); ctx.fillRect(x + 10, 70, 1, 14);
    ctx.fillStyle = mix('#4a3a20', '#9a7a48', light);
    ctx.fillRect(x - 1, 68, 13, 10);
    s.bounties.slice(0, 6).forEach((b, i) => {
      ctx.fillStyle = mix('#8a8678', '#f4efe0', light);
      ctx.fillRect(x + 1 + (i % 3) * 4, 69 + Math.floor(i / 3) * 4, 3, 3);
      ctx.fillStyle = '#b03030';
      ctx.fillRect(x + 2 + (i % 3) * 4, 69 + Math.floor(i / 3) * 4, 1, 1);
    });
  }

  drawTavern(ctx, s, light) {
    const lvl = s.buildings.taverne;
    const x0 = 138, w = 58;
    ctx.fillStyle = mix('#5a4a32', '#c8a878', light); ctx.fillRect(x0, 48, w, 32);
    ctx.fillStyle = mix('#3a2818', '#6b4a2a', light);
    ctx.fillRect(x0, 48, w, 2); ctx.fillRect(x0, 63, w, 2); ctx.fillRect(x0, 48, 2, 32); ctx.fillRect(x0 + w - 2, 48, 2, 32);
    ctx.fillRect(x0 + 18, 48, 1, 32); ctx.fillRect(x0 + 40, 48, 1, 32);
    // Dach
    ctx.fillStyle = mix('#2e1a12', '#6e3e2a', light);
    for (let i = 0; i < 12; i++) ctx.fillRect(x0 - 3 + i * 2.2, 47 - i * 1.6, w + 6 - i * 4.4, 2);
    if (lvl >= 2) { ctx.fillStyle = mix('#5a4a32', '#c8a878', light); ctx.fillRect(x0 + w - 4, 60, 8, 20); }
    if (lvl >= 3) { ctx.fillStyle = mix('#2e1a12', '#6e3e2a', light); ctx.fillRect(x0 + 6, 26, 8, 8); }
    // Tür
    ctx.fillStyle = mix('#2a1a10', '#5a3a1e', light); ctx.fillRect(x0 + 24, 67, 10, 13);
    // Fenster
    ctx.fillStyle = mix('#1e2a34', '#3a5468', light);
    const wins = [[x0 + 5, 52, 8, 7], [x0 + 24, 52, 10, 7], [x0 + 45, 52, 8, 7], [x0 + 5, 69, 8, 7], [x0 + 45, 69, 8, 7]];
    for (const [a, b, c, d] of wins) ctx.fillRect(a, b, c, d);
    // Schild mit Krug
    ctx.fillStyle = mix('#3a2818', '#6b4a2a', light); ctx.fillRect(x0 + 35, 64, 1, 4); ctx.fillRect(x0 + 34, 67, 8, 7);
    ctx.fillStyle = '#e0b040'; ctx.fillRect(x0 + 36, 69, 3, 4); ctx.fillRect(x0 + 39, 70, 1, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + 36, 68, 3, 1);
    // Bank
    ctx.fillStyle = mix('#3a2818', '#7a5634', light); ctx.fillRect(x0 + 6, 84, 14, 2); ctx.fillRect(x0 + 7, 86, 1, 2); ctx.fillRect(x0 + 18, 86, 1, 2);
    this.windows.push(...wins);
  }
}

function mountain(ctx, x, base, w, h) {
  for (let i = 0; i < h; i++) {
    const half = (w / 2) * (i / h);
    ctx.fillRect(Math.round(x + w / 2 - half), base - h + i, Math.max(1, Math.round(half * 2)), 1);
  }
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
