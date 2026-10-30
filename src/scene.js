// Dorfszene auf Canvas (Vektorgrafik): Gebäude, Tageszeit und die Helden, die gerade im Dorf sind.
// Logische Koordinaten 200 × 112, gerendert in voller Bildschirmauflösung.

import { drawHero } from './sprites.js';
import { RECIPES } from './data.js';
import { clockOf, isNight } from './sim.js';

export const W = 200;
export const H = 112;
const EXIT = { x: 214, y: 100 };
const TAVERN_DOOR = { x: 166.5, y: 82 };
const HERO_SIZE = 21;
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
        .filter((a) => !a.hidden && x >= a.x - 8 && x <= a.x + 8 && y >= a.y - 30 && y <= a.y + 2)
        .sort((a, b) => b.y - a.y)[0];
      if (hit) onHeroTap(hit.id);
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

  randomSpot(hero) {
    if (hero.state === 'rest') return { x: 140 + this.rand() * 52, y: 86 + this.rand() * 18 };
    const spots = [
      { x: 30, y: 86 }, { x: 94, y: 86 }, { x: 131, y: 88 }, { x: 166, y: 86 },
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
        const start = this.first ? this.randomSpot(h) : { ...EXIT };
        a = { id: h.id, x: start.x, y: start.y, tx: start.x, ty: start.y, wait: this.rand() * 2, flip: true, phase: 0, moving: false };
        if (this.first && night) { a.hidden = true; a.x = TAVERN_DOOR.x; a.y = TAVERN_DOOR.y; }
        this.actors.set(h.id, a);
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
      a.moving = false;
      if (a.night && !a.leaving) { a.tx = TAVERN_DOOR.x; a.ty = TAVERN_DOOR.y; a.wait = 0; }
      if (!a.night && a.hidden) { a.hidden = false; a.wait = 1 + this.rand() * 3; }
      if (a.wait > 0) { a.wait -= dt; continue; }
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
      a.moving = true;
      a.phase += dt * (a.injured ? 6 : 11);
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
    this.drawSmithy(ctx, state, light);
    this.drawShop(ctx, state, light);
    this.drawBoard(ctx, state, light);
    this.drawTavern(ctx, state, light);
    this.drawProps(ctx, state, light);

    // Rauch über der Esse
    const crafting = state.slots.some((s) => s && !s.blocked);
    if (crafting && this.rand() < 0.06) this.smoke.push({ x: 45.5, y: 33, r: 1.4, life: 4 });
    for (const p of this.smoke) {
      ctx.fillStyle = `rgba(${light > 0.5 ? '215,215,215' : '120,120,140'},${p.life / 8})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }

    // Helden nach Tiefe sortiert
    const actors = [...this.actors.values()].filter((a) => !a.hidden && a.hero).sort((a, b) => a.y - b.y);
    for (const a of actors) {
      drawHero(ctx, a.hero, a.x, a.y, { flip: a.flip, walk: a.phase, moving: a.moving, time, injured: a.injured, size: HERO_SIZE });
      const emo = a.injured ? '🩹' : a.hero.state === 'rest' ? '🍺' : null;
      if (emo && !a.leaving) {
        ctx.font = '5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(emo, a.x + 6, a.y - 25);
      }
      if (this.selected === a.id) {
        const bob = Math.sin(time / 200) * 0.8;
        ctx.beginPath();
        ctx.moveTo(a.x - 2.2, a.y - 34 + bob); ctx.lineTo(a.x + 2.2, a.y - 34 + bob); ctx.lineTo(a.x, a.y - 31 + bob); ctx.closePath();
        ctx.fillStyle = '#ffd95a'; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 0.4; ctx.stroke();
      }
    }

    // Nacht: abdunkeln, dann Lichter
    if (light < 0.95) {
      ctx.fillStyle = `rgba(12,16,46,${(0.95 - light) * 0.58})`;
      ctx.fillRect(0, 0, W, H);
      const strength = Math.min(1, (0.95 - light) * 1.6);
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
    // Kisten (Lagerhaus)
    for (let i = 0; i < s.buildings.lager; i++) {
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
    for (const [bx, by, r] of [[3, 110, 6], [196, 109, 7], [60, 111, 4]]) {
      ctx.fillStyle = mix('#163020', '#4e8a3c', light);
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.arc(bx + r * 0.8, by + 1, r * 0.7, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ---------- Zeichenhilfen ----------

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
