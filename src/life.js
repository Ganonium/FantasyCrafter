// Lebensgeschichte der Helden: das Heldenbuch (h.bio) und der Wesenswandel durch Erlebnisse.

import { TRAITS, TRAIT_CONFLICTS } from './data.js';
import { fmt } from './text.js';
import { log } from './sim.js';

const BIO_LIMIT = 120;

// Ein Eintrag im Heldenbuch. you = du hattest deine Hand im Spiel (deine Ware, dein Rat, deine Entscheidung)
export function bio(s, h, icon, text, you = false) {
  h.bio ??= [];
  h.bio.push({ t: s.t, c: s.clock0 + s.clockOffset + s.t, icon, text, you });
  // Der erste Eintrag (Ankunft) bleibt immer stehen
  if (h.bio.length > BIO_LIMIT) h.bio.splice(1, h.bio.length - BIO_LIMIT);
}

// Zähler für Erlebnisse, aus denen der Wesenswandel entsteht
export function life(h) {
  h.life ??= {};
  return h.life;
}

export function bump(h, key, n = 1) {
  const c = life(h);
  c[key] = (c[key] ?? 0) + n;
}

const GROWTH_TEXT = {
  vorsichtig: [
    'Nach so vielen Niederlagen ist aus {n} ein vorsichtiger Mensch geworden.',
    '{n} hat Lehrgeld bezahlt. Von jetzt an wägt {er} jedes Risiko genau ab.',
  ],
  mutig: [
    '{n} hat Mut gefasst – {er} ist nicht mehr {derselbe} wie früher.',
    'Ein neues Feuer brennt in {n}. Die alte Zögerlichkeit ist verflogen.',
  ],
  abgehaertet: [
    '{n} hat so viel eingesteckt, dass {ihn} kaum noch etwas umhaut.',
    'Narbe um Narbe ist {n} hart geworden wie altes Leder.',
  ],
  uebermuetig: [
    'Sieg auf Sieg ist {n} zu Kopf gestiegen. {Er} hält sich für unbesiegbar.',
    '{n} lacht über jede Gefahr. Übermut tut selten gut …',
  ],
  verbittert: [
    'Zu viele Enttäuschungen: {n} ist verbittert geworden.',
    'Etwas in {n} ist zerbrochen. {Er} lacht kaum noch.',
  ],
  zufrieden: [
    '{n} hat sich Träume erfüllt und wirkt rundum zufrieden.',
    'Ein Lächeln liegt jetzt oft auf dem Gesicht von {n}. {Er} ist angekommen.',
  ],
  gesellig: [
    'Durch die neuen Freunde ist {n} richtig aufgetaut.',
    '{n} ist jetzt der Mittelpunkt jeder Runde in der Taverne.',
  ],
};

const traitName = (t) => TRAITS[t].name;

// Fügt einen Wesenszug hinzu; widersprechende fallen weg, höchstens drei bleiben
export function growTrait(s, r, h, trait, reason, you = false) {
  if (h.traits.includes(trait)) return false;
  const conflicts = TRAIT_CONFLICTS.filter(([a, b]) => a === trait || b === trait).map(([a, b]) => (a === trait ? b : a));
  const lost = h.traits.filter((t) => conflicts.includes(t));
  let traits = h.traits.filter((t) => !conflicts.includes(t));
  if (traits.length >= 3) lost.push(traits.shift());
  traits.push(trait);
  h.traits = traits;
  h.grown = [...(h.grown ?? []).filter((t) => traits.includes(t)), trait];
  const tpl = r.pick(GROWTH_TEXT[trait]);
  log(s, 'growth', `🌱 ${fmt(tpl, h, { derselbe: h.female ? 'dieselbe' : 'derselbe' })}`, h.id, { trait, lost });
  const was = lost.length ? ` statt ${lost.map((t) => traitName(t).toLowerCase()).join(' und ')}` : '';
  bio(s, h, '🌱', `Wurde ${traitName(trait).toLowerCase()}${was} – ${reason}.`, you);
  return true;
}

export function loseTrait(s, h, trait, text) {
  if (!h.traits.includes(trait)) return false;
  h.traits = h.traits.filter((t) => t !== trait);
  h.grown = (h.grown ?? []).filter((t) => t !== trait);
  log(s, 'growth', `🌱 ${fmt(text, h)}`, h.id, { lostTrait: trait });
  bio(s, h, '🌱', `Ist nicht mehr ${traitName(trait).toLowerCase()}.`);
  return true;
}

// Nach jedem wichtigen Erlebnis: Hat sich der Charakter verändert?
export function checkGrowth(s, r, h) {
  const c = life(h);
  const has = (t) => h.traits.includes(t);

  if ((c.heavyDefeats ?? 0) >= 3 && !has('vorsichtig')) {
    growTrait(s, r, h, 'vorsichtig', 'nach drei schweren Niederlagen');
    c.heavyDefeats = 0;
  }
  if ((c.injuries ?? 0) >= 5 && !has('abgehaertet')) {
    growTrait(s, r, h, 'abgehaertet', 'nach unzähligen Verletzungen');
  }
  if ((c.winStreak ?? 0) >= 8 && !has('uebermuetig') && !has('vorsichtig')) {
    growTrait(s, r, h, 'uebermuetig', 'nach acht echten Siegen in Folge');
    c.winStreak = 0; c.heavyDefeats = 0;
  }
  // Dein Zuspruch kann Vorsicht in Mut verwandeln
  if ((c.goodAdvice ?? 0) >= (has('vorsichtig') ? 1 : 2) && !has('mutig')) {
    growTrait(s, r, h, 'mutig', 'weil dein Zuspruch sich ausgezahlt hat', true);
    c.goodAdvice = 0; c.heavyDefeats = 0;
  }
  if ((c.badAdvice ?? 0) + (c.bitterness ?? 0) >= 2 && !has('verbittert')) {
    growTrait(s, r, h, 'verbittert', (c.badAdvice ?? 0) >= 2 ? 'weil dein Rat ins Unglück führte' : 'nach zu vielen Enttäuschungen',
      (c.badAdvice ?? 0) > 0);
    c.badAdvice = 0; c.bitterness = 0; c.joy = 0;
  }
  if ((h.goalsDone ?? 0) >= 3 && s.t - (h.arrivedAt ?? 0) > 3 * 1440 && !has('zufrieden') && !has('verbittert')) {
    growTrait(s, r, h, 'zufrieden', 'nach drei erfüllten Träumen');
  }
  if ((c.friendships ?? 0) >= 2 && !has('gesellig') && !has('verbittert')) {
    growTrait(s, r, h, 'gesellig', 'dank echter Freundschaften');
  }
  // Verbitterung kann heilen: erfüllte Träume, gute Erfahrungen
  if (has('verbittert') && (c.joy ?? 0) >= 2) {
    loseTrait(s, h, 'verbittert', '{n} hat wieder Freude am Leben gefunden. Die Verbitterung ist verflogen.');
    c.joy = 0;
  }
  // Übermut hält selten lange
  if (has('uebermuetig') && (c.heavyDefeats ?? 0) >= 1) {
    loseTrait(s, h, 'uebermuetig', 'Die Niederlage hat gesessen: Der Übermut ist {n} vergangen.');
    c.winStreak = 0;
  }
}

// Wirkung der erworbenen Wesenszüge auf die Mutschwelle und die Lust loszuziehen
export function traitThreshold(h, threshold) {
  if (h.traits.includes('uebermuetig')) threshold = Math.min(threshold, 0.36);
  return threshold;
}

export function traitDrive(h) {
  let d = 0;
  if (h.traits.includes('zufrieden')) d -= 0.08;
  if (h.traits.includes('verbittert')) d -= 0.05;
  return d;
}

// Zu welchem Wert pendelt die Laune?
export function moodBaseline(h) {
  if (h.traits.includes('verbittert')) return [30, 45];
  if (h.traits.includes('zufrieden')) return [60, 80];
  return [50, 65];
}

