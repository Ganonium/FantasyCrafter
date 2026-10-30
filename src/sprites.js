// Helden als Vektorgrafik (Bilderbuch-Stil). Rüstung und Waffe hängen direkt von der gekauften Ausrüstung ab.
// Eigenes Koordinatensystem: Füße bei (0,0), Blick nach +x, Körper ca. 100 Einheiten hoch (Hüte ragen darüber).

import { RECIPES } from './data.js';

const SKIN = ['#f3cfae', '#dca77f', '#ad714c', '#734a33'];
const HAIR = ['#2e2018', '#6e4123', '#c48a3c', '#ead27e', '#a8402a', '#d4d4d4'];
const LINE = '#2a1c14';
const BOOT = '#4a3324';

const BASE = {
  krieger:     { torso: '#a33a32', arm: '#8c2f29', legs: '#5a4634' },
  waldlaeufer: { torso: '#4f7a3e', arm: '#426a33', legs: '#6a5338' },
  magier:      { torso: '#3e5c9e', arm: '#344f8a', legs: '#3e5c9e' },
};

// Rüstungsfarben je Klasse und Stufe
const ARMOR = {
  krieger: [
    null,
    { torso: '#cdb88f', arm: '#bca87e', accent: '#9e8862', quilt: true },
    { torso: '#9aa4ae', arm: '#8a949e', accent: '#6c757e', helm: '#8e98a2', mail: true },
    { torso: '#c4dcf0', arm: '#aecbe2', accent: '#ffffff', helm: '#b4d0e8', plume: '#3f72d6', pads: '#d6e6f4', plate: true },
    { torso: '#8e2424', arm: '#741c1c', accent: '#e6b84a', helm: '#741c1c', horns: '#efe6cc', pads: '#a83030', scales: '#c8473a' },
  ],
  waldlaeufer: [
    null,
    { torso: '#80603c', arm: '#715232', accent: '#5e4428', hood: '#715232' },
    { torso: '#4f7a3e', arm: '#8e7e68', accent: '#e2d4bc', hood: '#8e7e68', fur: '#e2d4bc' },
    { torso: '#ecedf4', arm: '#d0d4e2', accent: '#4f7a3e', hood: '#356a2e', sheen: true },
    { torso: '#6e2028', arm: '#2e5428', accent: '#e6b84a', hood: '#2e5428', scales: '#a3343a' },
  ],
  magier: [
    null,
    { torso: '#ddd0b2', arm: '#cdc0a0', accent: '#a8987a', hat: '#7e5e3a' },
    { torso: '#6e4290', arm: '#5e387e', accent: '#e2d4bc', hat: '#6e4290', fur: '#e2d4bc' },
    { torso: '#f0f2fa', arm: '#dadeee', accent: '#4c6fd6', hat: '#f0f2fa', band: '#4c6fd6', sheen: true },
    { torso: '#7e1622', arm: '#68111c', accent: '#e6b84a', hat: '#7e1622', band: '#e6b84a', star: true },
  ],
};

function tierOf(id) {
  return id ? RECIPES[id].tier : 0;
}

// ---------- Zeichenhilfen ----------

function shape(ctx, fill, lw = 3) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = LINE;
  ctx.stroke();
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function capsule(ctx, x1, y1, x2, y2, w, fill) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = LINE;
  ctx.lineWidth = w + 6;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = w;
  ctx.stroke();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function glow(ctx, x, y, r, rgb, time, speed = 400) {
  const a = 0.45 + 0.2 * Math.sin(time / speed);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/**
 * Zeichnet einen Helden. x/y = Fußpunkt im Kontext, size = Körperhöhe in Kontext-Einheiten.
 * opts: { flip, walk (Phase in Radiant), moving, time (ms), injured, size }
 */
export function drawHero(ctx, hero, x, y, opts = {}) {
  const { flip = false, walk = 0, moving = false, time = 0, injured = false, size = 24 } = opts;
  const u = size / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -u : u, u);
  ctx.lineJoin = 'round';

  const look = hero.look;
  const skin = SKIN[look.skin];
  const hair = HAIR[look.hair];
  const base = BASE[hero.cls];
  const at = tierOf(hero.armor);
  const wt = tierOf(hero.weapon);
  const ar = ARMOR[hero.cls][at];
  const torso = ar?.torso ?? base.torso;
  const arm = ar?.arm ?? base.arm;
  const swing = moving ? Math.sin(walk) * 0.45 : 0;
  const bob = moving ? -Math.abs(Math.sin(walk)) * 3 : 0;

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ellipse(ctx, 0, 0, 24, 5); ctx.fill();

  ctx.translate(0, bob);

  // Bogen hängt hinter dem Körper, wenn er nicht benutzt wird – hier immer in der Hand, also später
  // Hinteres Bein / Robe
  const isRobe = hero.cls === 'magier';
  if (!isRobe) {
    leg(ctx, -5, -30, -swing, base.legs);
  }
  // Hinterer Arm
  capsule(ctx, -9, -54, -12 - swing * 10, -34, 9, shade(arm, -18));
  if (hero.cls === 'waldlaeufer') { // Köcher auf dem Rücken
    rr(ctx, -22, -66, 10, 30, 4); shape(ctx, '#6e4a2c', 2.5);
    ctx.strokeStyle = '#d8c8a8'; ctx.lineWidth = 2;
    for (const dx of [-19, -16]) { ctx.beginPath(); ctx.moveTo(dx, -66); ctx.lineTo(dx - 2, -74); ctx.stroke(); }
  }
  if (!isRobe) leg(ctx, 5, -30, swing, base.legs);

  // Robe oder Oberkörper
  if (isRobe) {
    ctx.beginPath();
    ctx.moveTo(-14, -60);
    ctx.quadraticCurveTo(-24, -20, -24, -3);
    ctx.quadraticCurveTo(0, 2, 24, -3);
    ctx.quadraticCurveTo(24, -20, 14, -60);
    ctx.closePath();
    shape(ctx, torso);
    if (ar?.accent) {
      ctx.beginPath(); ctx.moveTo(-23, -6); ctx.quadraticCurveTo(0, -1, 23, -6);
      ctx.strokeStyle = ar.accent; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, -58); ctx.lineTo(6, -2);
      ctx.strokeStyle = ar.accent; ctx.lineWidth = 5; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(4, -58); ctx.lineTo(6, -2);
      ctx.strokeStyle = shade(torso, -25); ctx.lineWidth = 4; ctx.stroke();
    }
    // Füße
    ellipse(ctx, -8 + swing * 6, -2, 7, 4); shape(ctx, BOOT, 2.5);
    ellipse(ctx, 10 - swing * 6, -2, 7, 4); shape(ctx, BOOT, 2.5);
  } else {
    rr(ctx, -15, -61, 30, 35, 10);
    shape(ctx, torso);
    torsoDetails(ctx, hero.cls, at, ar, torso);
    // Gürtel
    rr(ctx, -15.5, -35, 31, 6, 2);
    shape(ctx, at === 4 ? '#c8962e' : '#4a3424', 2);
    rr(ctx, 4, -36, 7, 8, 2); shape(ctx, '#d8b04a', 1.5);
  }
  if (ar?.fur) {
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) ctx.arc(-15 + i * 5, -59, 4, Math.PI, 0);
    ctx.fillStyle = ar.fur; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.stroke();
  }
  if (ar?.pads) {
    ellipse(ctx, -12, -58, 9, 6, -0.3); shape(ctx, ar.pads, 2.5);
    ellipse(ctx, 12, -58, 9, 6, 0.3); shape(ctx, ar.pads, 2.5);
  }

  // Kapuze hinter dem Kopf
  if (hero.cls === 'waldlaeufer' && ar?.hood) {
    ctx.beginPath();
    ctx.moveTo(-20, -60);
    ctx.quadraticCurveTo(-30, -84, -14, -102);
    ctx.quadraticCurveTo(8, -110, 22, -92);
    ctx.lineTo(14, -60);
    ctx.closePath();
    shape(ctx, shade(ar.hood, -15));
  }

  // Kopf
  head(ctx, skin, hair, look, hero, ar);

  // Waffe + vorderer Arm
  const reach = hero.cls === 'waldlaeufer' && wt > 0 ? 21 : 24;
  const hand = { x: reach + swing * 6, y: -37 };
  if (hero.cls === 'waldlaeufer' && wt > 0) bow(ctx, wt, hand, time);
  if (hero.cls === 'magier' && wt > 0) staff(ctx, wt, hand, time);
  if (hero.cls === 'krieger' || wt === 0) melee(ctx, wt, hand, time);
  capsule(ctx, 9, -54, hand.x, hand.y, 9, arm);
  ellipse(ctx, hand.x, hand.y, 5, 5); shape(ctx, skin, 2.5);
  if (injured) {
    // Verband am Arm
    ctx.strokeStyle = '#f6f2ea'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(10, -48); ctx.lineTo(13, -42); ctx.stroke();
  }

  ctx.restore();
}

function leg(ctx, hx, hy, angle, color) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(angle);
  rr(ctx, -5, -2, 10, 26, 4); shape(ctx, color, 2.5);
  rr(ctx, -6, 20, 15, 9, 4); shape(ctx, BOOT, 2.5);
  ctx.restore();
}

function torsoDetails(ctx, cls, tier, ar, torso) {
  ctx.save();
  rr(ctx, -15, -61, 30, 35, 10);
  ctx.clip();
  if (!ar) {
    // einfacher Kittel mit Kragen
    ctx.strokeStyle = shade(torso, -30); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-4, -61); ctx.lineTo(2, -52); ctx.lineTo(8, -61); ctx.stroke();
  }
  if (ar?.quilt) {
    ctx.strokeStyle = ar.accent; ctx.lineWidth = 2;
    for (let yy = -54; yy < -30; yy += 7) { ctx.beginPath(); ctx.moveTo(-15, yy); ctx.lineTo(15, yy); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, -61); ctx.lineTo(0, -30); ctx.stroke();
  }
  if (ar?.mail) {
    ctx.strokeStyle = ar.accent; ctx.lineWidth = 1.5;
    for (let yy = -58; yy < -28; yy += 4) for (let xx = -16 + ((yy / 4) % 2) * 2; xx < 16; xx += 4) {
      ctx.beginPath(); ctx.arc(xx, yy, 2, 0, Math.PI); ctx.stroke();
    }
  }
  if (ar?.plate) {
    const g = ctx.createLinearGradient(-15, 0, 15, 0);
    g.addColorStop(0, shade(torso, -30)); g.addColorStop(0.45, '#ffffff'); g.addColorStop(1, shade(torso, -40));
    ctx.fillStyle = g; ctx.globalAlpha = 0.55; ctx.fillRect(-15, -61, 30, 35); ctx.globalAlpha = 1;
    ctx.strokeStyle = shade(torso, -50); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-15, -46); ctx.quadraticCurveTo(0, -40, 15, -46); ctx.stroke();
  }
  if (ar?.scales) {
    ctx.strokeStyle = ar.scales; ctx.lineWidth = 2;
    for (let yy = -56; yy < -30; yy += 5) for (let xx = -14 + ((yy / 5) % 2) * 3; xx < 16; xx += 6) {
      ctx.beginPath(); ctx.arc(xx, yy, 3, 0, Math.PI); ctx.stroke();
    }
    ctx.strokeStyle = ar.accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-15, -59); ctx.lineTo(15, -59); ctx.stroke();
  }
  if (ar?.sheen) {
    ctx.strokeStyle = ar.accent; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(2, -61); ctx.lineTo(2, -28); ctx.stroke();
  }
  if (cls === 'waldlaeufer' && tier === 1) {
    ctx.strokeStyle = ar.accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-12, -61); ctx.lineTo(12, -30); ctx.stroke();
  }
  ctx.restore();
  rr(ctx, -15, -61, 30, 35, 10);
  ctx.strokeStyle = LINE; ctx.lineWidth = 3; ctx.stroke();
}

function head(ctx, skin, hair, look, hero, ar) {
  const cx = 3, cy = -80, r = 20;
  // lange Haare hinten
  if (look.hairStyle === 1 && !(hero.cls === 'krieger' && ar?.helm)) {
    ctx.beginPath();
    ctx.moveTo(-14, -92); ctx.quadraticCurveTo(-26, -70, -18, -54); ctx.lineTo(-4, -58); ctx.lineTo(-2, -90); ctx.closePath();
    shape(ctx, hair, 2.5);
  }
  if (look.hairStyle === 2 && !(hero.cls === 'krieger' && ar?.helm)) {
    ellipse(ctx, -19, -76, 6, 9, 0.4); shape(ctx, hair, 2.5);
  }
  // Ohr + Kopf
  ellipse(ctx, cx - 14, cy + 2, 4, 5); shape(ctx, skin, 2.5);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); shape(ctx, skin);
  // Wangen
  ctx.fillStyle = 'rgba(220,90,80,0.25)';
  ellipse(ctx, cx + 13, cy + 7, 4, 2.5); ctx.fill();
  // Augen
  ctx.fillStyle = LINE;
  ellipse(ctx, cx + 5, cy + 1, 2.2, 3); ctx.fill();
  ellipse(ctx, cx + 14, cy + 1, 2.2, 3); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ellipse(ctx, cx + 5.6, cy, 0.8, 0.8); ctx.fill();
  ellipse(ctx, cx + 14.6, cy, 0.8, 0.8); ctx.fill();
  // Mund
  ctx.strokeStyle = LINE; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx + 10, cy + 9, 3.5, 0.2, Math.PI - 0.6); ctx.stroke();
  // Bart
  if (look.beard) {
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + 4);
    ctx.quadraticCurveTo(cx - 6, cy + 26, cx + 8, cy + 24);
    ctx.quadraticCurveTo(cx + 20, cy + 18, cx + 19, cy + 6);
    ctx.quadraticCurveTo(cx + 10, cy + 13, cx + 2, cy + 10);
    ctx.closePath();
    shape(ctx, hair, 2.5);
  }
  // Haar oben
  const hidden = (hero.cls === 'krieger' && ar?.helm) || (hero.cls === 'waldlaeufer' && ar?.hood);
  if (!hidden) {
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy + 2);
    ctx.quadraticCurveTo(cx - 22, cy - 24, cx + 2, cy - 22);
    ctx.quadraticCurveTo(cx + 22, cy - 22, cx + 21, cy - 4);
    ctx.quadraticCurveTo(cx + 12, cy - 10, cx + 6, cy - 6);
    ctx.quadraticCurveTo(cx + 2, cy - 12, cx - 6, cy - 8);
    ctx.quadraticCurveTo(cx - 12, cy - 6, cx - 13, cy + 4);
    ctx.closePath();
    shape(ctx, hair, 2.5);
  }

  // Kopfbedeckungen
  if (hero.cls === 'krieger' && ar?.helm) {
    if (ar.plume) {
      ctx.beginPath(); ctx.moveTo(cx - 2, cy - 22);
      ctx.quadraticCurveTo(cx - 20, cy - 44, cx - 30, cy - 20);
      ctx.quadraticCurveTo(cx - 18, cy - 30, cx - 6, cy - 14); ctx.closePath();
      shape(ctx, ar.plume, 2.5);
    }
    if (ar.horns) {
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(cx + s * 14, cy - 12);
        ctx.quadraticCurveTo(cx + s * 30, cy - 18, cx + s * 26, cy - 36);
        ctx.quadraticCurveTo(cx + s * 22, cy - 22, cx + s * 8, cy - 18); ctx.closePath();
        shape(ctx, ar.horns, 2.5);
      }
    }
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy + 6);
    ctx.lineTo(cx - 22, cy - 4);
    ctx.arc(cx, cy - 4, 22, Math.PI, 0);
    ctx.lineTo(cx + 22, cy - 2);
    ctx.lineTo(cx + 10, cy - 2);
    ctx.lineTo(cx + 10, cy + 2);
    ctx.lineTo(cx - 8, cy + 2);
    ctx.lineTo(cx - 8, cy + 12);
    ctx.closePath();
    shape(ctx, ar.helm);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ellipse(ctx, cx - 4, cy - 16, 8, 4, -0.3); ctx.fill();
    rr(ctx, cx + 8, cy - 4, 5, 14, 2); shape(ctx, ar.helm, 2); // Nasenschutz
    if (ar.accent === '#e6b84a') { ctx.strokeStyle = ar.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy - 4, 18, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  }
  if (hero.cls === 'waldlaeufer' && ar?.hood) {
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy + 10);
    ctx.quadraticCurveTo(cx - 26, cy - 26, cx + 2, cy - 26);
    ctx.quadraticCurveTo(cx + 24, cy - 24, cx + 22, cy - 2);
    ctx.quadraticCurveTo(cx + 10, cy - 14, cx - 4, cy - 10);
    ctx.quadraticCurveTo(cx - 12, cy - 4, cx - 12, cy + 12);
    ctx.closePath();
    shape(ctx, ar.hood);
    if (ar.fur) { ctx.strokeStyle = ar.fur; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx + 20, cy - 4); ctx.quadraticCurveTo(cx + 8, cy - 14, cx - 4, cy - 10); ctx.stroke(); }
  }
  if (hero.cls === 'magier' && ar?.hat) {
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 14);
    ctx.quadraticCurveTo(cx - 6, cy - 40, cx - 18, cy - 64);
    ctx.quadraticCurveTo(cx + 6, cy - 48, cx + 22, cy - 14);
    ctx.closePath();
    shape(ctx, ar.hat);
    if (ar.band) {
      ctx.beginPath(); ctx.moveTo(cx - 16, cy - 20); ctx.lineTo(cx + 19, cy - 20); ctx.lineTo(cx + 21, cy - 14); ctx.lineTo(cx - 18, cy - 14); ctx.closePath();
      shape(ctx, ar.band, 2);
    }
    if (ar.star) star(ctx, cx + 1, cy - 34, 5, '#ffe27a');
    ellipse(ctx, cx + 2, cy - 14, 30, 6); shape(ctx, ar.hat);
  }
  if (hero.state === 'injured') {
    ctx.strokeStyle = '#f6f2ea'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy, 19, Math.PI * 1.08, Math.PI * 1.75); ctx.stroke();
  }
}

function star(ctx, x, y, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr2 = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  ctx.closePath();
  shape(ctx, color, 1.5);
}

function melee(ctx, tier, h, time) {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(0.5);
  if (tier === 0) { // Knüppel
    ctx.beginPath(); ctx.moveTo(-3, 6); ctx.lineTo(-5, -28); ctx.quadraticCurveTo(0, -36, 5, -28); ctx.lineTo(3, 6); ctx.closePath();
    shape(ctx, '#7a5634', 2.5);
  } else if (tier === 4) { // Trollspalter
    rr(ctx, -2.5, -62, 5, 74, 2); shape(ctx, '#efe6cc', 2.5);
    ctx.beginPath(); ctx.moveTo(2, -60); ctx.quadraticCurveTo(28, -66, 26, -38); ctx.quadraticCurveTo(18, -46, 2, -42); ctx.closePath();
    const g = ctx.createLinearGradient(2, -60, 26, -40); g.addColorStop(0, '#5a5a66'); g.addColorStop(1, '#a8acb8');
    shape(ctx, g, 2.5);
    ctx.strokeStyle = '#d04a30'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(25, -60); ctx.quadraticCurveTo(28, -50, 25, -40); ctx.stroke();
    glow(ctx, 22, -50, 16, '255,110,60', time);
  } else { // Schwerter
    const len = [0, 26, 40, 46][tier];
    const blade = ['', '#c4cad0', '#e6eaee', '#a8dcff'][tier];
    ctx.beginPath(); ctx.moveTo(-3.5, -6); ctx.lineTo(-3, -6 - len); ctx.lineTo(0, -12 - len); ctx.lineTo(3, -6 - len); ctx.lineTo(3.5, -6); ctx.closePath();
    const g = ctx.createLinearGradient(-4, 0, 4, 0); g.addColorStop(0, blade); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, shade(blade.startsWith('#') ? blade : '#cccccc', -40));
    shape(ctx, g, 2.5);
    rr(ctx, -9, -8, 18, 4, 2); shape(ctx, tier === 2 ? '#c09a48' : tier === 3 ? '#d4dbe6' : '#7a5a36', 2);
    rr(ctx, -2.5, -4, 5, 10, 2); shape(ctx, '#4a3424', 2);
    if (tier === 3) glow(ctx, 0, -6 - len / 2, 18, '150,215,255', time);
  }
  ctx.restore();
}

function bow(ctx, tier, h, time) {
  const wood = ['', '#8e5e2e', '#6e421e', '#e2e4ee', '#efe6cc'][tier];
  const half = tier >= 2 ? 40 : 32;
  const bend = tier >= 2 ? 16 : 13;
  ctx.save();
  ctx.translate(h.x + 3, h.y - 6);
  ctx.strokeStyle = tier >= 3 ? '#ffffff' : '#e6dcc0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -half); ctx.lineTo(0, half); ctx.stroke();
  ctx.lineCap = 'round';
  ctx.strokeStyle = LINE; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(0, -half); ctx.quadraticCurveTo(bend * 2, 0, 0, half); ctx.stroke();
  ctx.strokeStyle = wood; ctx.lineWidth = 4.5; ctx.stroke();
  if (tier === 4) { ctx.fillStyle = '#c8473a'; ellipse(ctx, 0, -half, 3.5, 3.5); ctx.fill(); ellipse(ctx, 0, half, 3.5, 3.5); ctx.fill(); }
  if (tier === 3) glow(ctx, bend, 0, 20, '220,230,255', time);
  ctx.restore();
}

function staff(ctx, tier, h, time) {
  const wood = ['', '#7e5a36', '#4e3626', '#c8d0de', '#efe6cc'][tier];
  ctx.save();
  ctx.translate(h.x + 1, 0);
  capsule(ctx, 0, -2, 0, -96, 4, wood);
  const top = -100;
  if (tier === 1) {
    ellipse(ctx, -5, top + 2, 6, 3.5, -0.6); shape(ctx, '#6ab04a', 2);
    ellipse(ctx, 5, top, 6, 3.5, 0.6); shape(ctx, '#6ab04a', 2);
  }
  if (tier === 2) {
    ctx.beginPath(); ctx.moveTo(-4, top + 6); ctx.quadraticCurveTo(-2, top - 12, 6, top - 14); ctx.quadraticCurveTo(2, top - 2, 4, top + 6); ctx.closePath();
    shape(ctx, '#f4f0e0', 2);
  }
  if (tier === 3) {
    ctx.beginPath(); ctx.moveTo(0, top - 14); ctx.lineTo(7, top); ctx.lineTo(0, top + 8); ctx.lineTo(-7, top); ctx.closePath();
    shape(ctx, '#86d4ff', 2);
    glow(ctx, 0, top - 2, 24, '120,200,255', time);
  }
  if (tier === 4) {
    ctx.beginPath(); ctx.arc(0, top - 2, 7, 0, Math.PI * 2); shape(ctx, '#c47cff', 2);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 4, top + 6); ctx.quadraticCurveTo(s * 14, top - 2, s * 9, top - 12); ctx.strokeStyle = '#efe6cc'; ctx.lineWidth = 3; ctx.stroke(); }
    glow(ctx, 0, top - 2, 26, '200,120,255', time);
  }
  ctx.restore();
}

// Großes Porträt für die Heldenkarten
export function renderPortrait(canvas, hero, time = 0) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  if (canvas.width !== Math.round(cssW * dpr)) { canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr); }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const size = canvas.height * 0.66;
  drawHero(ctx, hero, canvas.width * 0.4, canvas.height * 0.94, { time, injured: hero.state === 'injured', size });
}
