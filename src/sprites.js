// Pixel-Helden, prozedural gezeichnet. Rüstung und Waffe hängen direkt von der gekauften Ausrüstung ab.
// Raster: 12 × 20 „Pixel“, Ursprung unten Mitte. Kopfbedeckungen/Waffen dürfen darüber hinausragen.

import { RECIPES } from './data.js';

const SKIN = ['#f1c9a5', '#d9a37a', '#a86b47', '#6e4630'];
const HAIR = ['#2b1d14', '#6b3e1f', '#c58b3a', '#e8d27a', '#a33b1f', '#cfcfcf'];
const BOOT = '#3a2a1e';

const BASE = {
  krieger:     { torso: '#9b2d2d', arm: '#7e2424', legs: '#4a3a2a' },
  waldlaeufer: { torso: '#3f6b35', arm: '#335a2b', legs: '#5a4630' },
  magier:      { torso: '#34508f', arm: '#2a4278', legs: '#34508f' },
};

// Rüstungsfarben je Klasse und Stufe: torso, arm, akzent, kopf (Helm/Kapuze/Hut)
const ARMOR = {
  krieger: [
    null,
    { torso: '#c9b48a', arm: '#b7a277', accent: '#a08a62' },
    { torso: '#8c96a0', arm: '#7d8790', accent: '#626b74', helm: '#7d8790', dither: true },
    { torso: '#b8d4ea', arm: '#9fbcd4', accent: '#e8f4ff', helm: '#a9c6de', plume: '#3d6fd0', pads: true },
    { torso: '#8a1f1f', arm: '#6e1818', accent: '#e0b040', helm: '#6e1818', horns: '#e8e0c8', pads: true, scales: '#c43a2a' },
  ],
  waldlaeufer: [
    null,
    { torso: '#7a5a36', arm: '#6b4d2e', accent: '#5a3f24', hood: '#6b4d2e' },
    { torso: '#3f6b35', arm: '#8a7a66', accent: '#d8c8b0', hood: '#8a7a66', collar: '#d8c8b0' },
    { torso: '#e6e6ee', arm: '#c8ccd8', accent: '#3f6b35', hood: '#2f5a2a' },
    { torso: '#6a1d24', arm: '#2a4a24', accent: '#e0b040', hood: '#2a4a24', scales: '#9c2e30' },
  ],
  magier: [
    null,
    { torso: '#d8ccb0', arm: '#c8bc9e', accent: '#a89a7a', hat: '#7a5a36' },
    { torso: '#6a3d8a', arm: '#5a3278', accent: '#d8c8b0', hat: '#6a3d8a', collar: '#d8c8b0' },
    { torso: '#eef0f8', arm: '#d8dcec', accent: '#4a6ad0', hat: '#eef0f8', band: '#4a6ad0' },
    { torso: '#7a1420', arm: '#640f1a', accent: '#e0b040', hat: '#7a1420', band: '#e0b040', star: true },
  ],
};

function tierOf(id) {
  return id ? RECIPES[id].tier : 0;
}

/**
 * Zeichnet einen Helden. x/y = Fußpunkt (unten Mitte) in Pixeleinheiten des Kontexts.
 * opts: { flip, frame (0/1 Gehen), time (ms, für Leuchten), injured, sitting }
 */
export function drawHero(ctx, hero, x, y, opts = {}) {
  const { flip = false, frame = 0, time = 0, injured = false } = opts;
  const ox = Math.round(x) - 6;
  const oy = Math.round(y) - 20;
  const P = (px, py, w, h, c) => {
    ctx.fillStyle = c;
    const rx = flip ? 12 - px - w : px;
    ctx.fillRect(ox + rx, oy + py, w, h);
  };

  const look = hero.look;
  const skin = SKIN[look.skin];
  const hair = HAIR[look.hair];
  const base = BASE[hero.cls];
  const at = tierOf(hero.armor);
  const wt = tierOf(hero.weapon);
  const ar = ARMOR[hero.cls][at];
  const torso = ar?.torso ?? base.torso;
  const arm = ar?.arm ?? base.arm;

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(ox + 2, oy + 19, 8, 1);
  ctx.fillRect(ox + 3, oy + 20, 6, 1);

  // Waffe hinter dem Körper (Bogen) zuerst
  if (hero.cls === 'waldlaeufer' && wt > 0) drawBow(P, wt, time);

  // Beine
  const isRobe = hero.cls === 'magier';
  if (isRobe) {
    const robe = ar?.torso ?? base.torso;
    P(3, 14, 6, 5, robe);
    P(2, 17, 8, 2, robe);
    if (ar?.accent) P(2, 18, 8, 1, ar.accent);
    P(frame ? 3 : 4, 19, 2, 1, BOOT);
    P(frame ? 7 : 6, 19, 2, 1, BOOT);
  } else {
    const legs = base.legs;
    if (frame === 0) {
      P(4, 15, 2, 4, legs); P(6, 15, 2, 4, legs);
      P(4, 19, 2, 1, BOOT); P(6, 19, 2, 1, BOOT);
    } else {
      P(3, 15, 2, 4, legs); P(7, 15, 2, 4, legs);
      P(3, 19, 2, 1, BOOT); P(7, 19, 2, 1, BOOT);
    }
  }

  // Oberkörper
  P(3, 8, 6, 7, torso);
  if (ar?.dither) for (let i = 0; i < 6; i++) for (let j = 0; j < 7; j++) if ((i + j) % 2) P(3 + i, 8 + j, 1, 1, ar.accent);
  if (ar?.scales) for (let i = 0; i < 6; i += 2) for (let j = 0; j < 6; j += 2) P(3 + i + (j % 4 ? 1 : 0), 9 + j, 1, 1, ar.scales);
  if (hero.cls === 'krieger' && at === 1) { P(3, 10, 6, 1, ar.accent); P(3, 12, 6, 1, ar.accent); }
  if (hero.cls === 'krieger' && at === 3) { P(4, 9, 1, 4, ar.accent); }
  if (hero.cls === 'krieger' && at === 4) { P(3, 8, 6, 1, ar.accent); P(3, 14, 6, 1, ar.accent); }
  if (hero.cls === 'waldlaeufer' && at === 3) { P(5, 8, 2, 7, ar.accent); }
  if (hero.cls === 'waldlaeufer' && at === 4) { P(5, 9, 2, 1, ar.accent); }
  if (hero.cls === 'magier' && ar) P(5, 8, 2, 7, ar.accent);
  if (hero.cls === 'magier' && !ar) P(5, 9, 2, 6, '#2a4278');
  // Gürtel
  if (hero.cls !== 'magier') P(3, 13, 6, 1, at === 4 ? '#e0b040' : '#3a2a1e');
  if (ar?.collar) P(2, 8, 8, 1, ar.collar);

  // Arme + Hände
  P(2, 8, 1, 5, arm); P(9, 8, 1, 5, arm);
  P(2, 13, 1, 1, skin); P(9, 13, 1, 1, skin);
  if (ar?.pads) { P(1, 8, 2, 2, ar.accent === '#e8f4ff' ? '#d0e4f4' : ar.accent); P(9, 8, 2, 2, ar.accent === '#e8f4ff' ? '#d0e4f4' : ar.accent); }

  // Kopf
  P(3, 2, 6, 6, skin);
  P(5, 4, 1, 1, '#1a1410'); P(7, 4, 1, 1, '#1a1410'); // Augen (Blick nach rechts)
  P(6, 6, 2, 1, shade(skin));
  // Haare
  P(3, 1, 6, 2, hair);
  P(3, 3, 1, 1, hair);
  if (look.hairStyle === 1) { P(2, 2, 1, 6, hair); P(3, 3, 1, 4, hair); }
  if (look.hairStyle === 2) { P(2, 2, 1, 3, hair); P(1, 4, 1, 3, hair); }
  if (look.beard) { P(4, 6, 4, 2, hair); P(5, 8, 3, 1, hair); }

  // Kopfbedeckung
  if (hero.cls === 'krieger' && ar?.helm) {
    P(3, 0, 6, 3, ar.helm);
    P(2, 2, 1, 3, ar.helm);
    P(8, 2, 1, 2, ar.helm);
    P(6, 3, 1, 2, ar.helm); // Nasenschutz
    if (ar.plume) { P(4, -2, 3, 2, ar.plume); P(3, -1, 1, 1, ar.plume); }
    if (ar.horns) { P(1, -1, 1, 2, ar.horns); P(10, -1, 1, 2, ar.horns); P(2, 0, 1, 1, ar.horns); P(9, 0, 1, 1, ar.horns); }
  }
  if (hero.cls === 'waldlaeufer' && ar?.hood) {
    P(3, 0, 6, 2, ar.hood);
    P(2, 1, 1, 7, ar.hood);
    P(3, 2, 1, 1, ar.hood);
    P(2, 7, 2, 1, ar.hood);
    if (at === 2) P(2, 1, 7, 1, ar.collar);
  }
  if (hero.cls === 'magier' && ar?.hat) {
    P(1, 1, 10, 1, ar.hat);
    P(3, -1, 6, 2, ar.hat);
    P(4, -3, 4, 2, ar.hat);
    P(5, -5, 2, 2, ar.hat);
    P(6, -6, 2, 1, ar.hat);
    if (ar.band) P(3, 0, 6, 1, ar.band);
    if (ar.star) P(5, -2, 1, 1, '#ffe080');
  }

  if (injured) { P(3, 2, 6, 1, '#f4f0e8'); P(2, 2, 1, 2, '#f4f0e8'); P(8, 9, 1, 3, '#f4f0e8'); }

  // Waffe in der vorderen Hand
  if (hero.cls === 'krieger' || wt === 0) drawMelee(P, hero.cls, wt, time);
  if (hero.cls === 'magier' && wt > 0) drawStaff(P, wt, time);
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 30), g = Math.max(0, ((n >> 8) & 255) - 30), b = Math.max(0, (n & 255) - 30);
  return `rgb(${r},${g},${b})`;
}

function glow(P, cx, cy, color, time) {
  const a = 0.25 + 0.2 * Math.sin(time / 300);
  const c = color.replace('rgb(', 'rgba(').replace(')', `,${a.toFixed(2)})`);
  P(cx - 1, cy, 1, 1, c); P(cx + 1, cy, 1, 1, c); P(cx, cy - 1, 1, 1, c); P(cx, cy + 1, 1, 1, c);
}

function drawMelee(P, cls, tier, time) {
  if (tier === 0) { // Knüppel
    P(10, 9, 1, 5, '#6b4a2a'); P(10, 8, 2, 2, '#7a5634');
    return;
  }
  if (tier === 1) { P(10, 7, 1, 5, '#c0c6cc'); P(9, 12, 3, 1, '#7a5a36'); P(10, 13, 1, 1, '#4a3a2a'); }
  if (tier === 2) { P(10, 3, 1, 9, '#dfe4ea'); P(10, 3, 1, 1, '#ffffff'); P(9, 12, 3, 1, '#a08040'); P(10, 13, 1, 2, '#4a3a2a'); }
  if (tier === 3) {
    P(10, 2, 1, 10, '#9fd8ff'); P(11, 4, 1, 6, '#e0f6ff'); P(9, 12, 3, 1, '#c0c8d8'); P(10, 13, 1, 2, '#3a4a6a');
    glow(P, 11, 3, 'rgb(160,220,255)', time);
  }
  if (tier === 4) {
    P(10, 2, 1, 13, '#e8e0c8');
    P(11, 2, 2, 4, '#5a5a66'); P(12, 1, 1, 6, '#5a5a66'); P(13, 2, 1, 4, '#c43a2a');
    glow(P, 12, 0, 'rgb(255,120,60)', time);
  }
}

function drawBow(P, tier, time) {
  const wood = ['', '#8a5a2a', '#6b3f1a', '#d8d8e8', '#e8e0c8'][tier];
  const string = tier >= 3 ? '#ffffff' : '#d8d0b8';
  const top = tier >= 2 ? 3 : 5;
  const bottom = tier >= 2 ? 17 : 15;
  P(10, top + 2, 1, bottom - top - 3, string);
  P(11, top, 1, 2, wood); P(12, top + 2, 1, bottom - top - 4, wood); P(11, bottom - 2, 1, 2, wood);
  if (tier === 4) { P(11, top, 1, 1, '#c43a2a'); P(11, bottom - 1, 1, 1, '#c43a2a'); }
  if (tier === 3) glow(P, 12, 10, 'rgb(220,230,255)', time);
}

function drawStaff(P, tier, time) {
  const wood = ['', '#7a5634', '#4a3424', '#c0c8d8', '#e8e0c8'][tier];
  P(10, 2, 1, 17, wood);
  if (tier === 1) { P(9, 0, 3, 2, '#5aa040'); P(10, -1, 1, 1, '#7cc060'); }
  if (tier === 2) { P(10, -1, 1, 3, '#f0f0e0'); P(9, 1, 1, 1, '#f0f0e0'); }
  if (tier === 3) { P(9, -1, 3, 3, '#7fd0ff'); P(10, -2, 1, 1, '#c0ecff'); glow(P, 10, 0, 'rgb(127,208,255)', time); glow(P, 10, 0, 'rgb(127,208,255)', time + 600); }
  if (tier === 4) { P(9, -1, 3, 3, '#c070ff'); P(8, 0, 1, 1, '#e8e0c8'); P(12, 0, 1, 1, '#e8e0c8'); glow(P, 10, 0, 'rgb(192,112,255)', time); }
}

// Großes Porträt für die Heldendetails
export function renderPortrait(canvas, hero, time = 0) {
  const ctx = canvas.getContext('2d');
  const scale = Math.floor(canvas.width / 18);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawHero(ctx, hero, 9, 26, { time, injured: hero.state === 'injured' });
}
