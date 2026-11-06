// Persönliche Bitten: Ein Held kommt an deinen Tresen und will etwas von dir.
// Deine Antwort hat Folgen – oft erst Stunden später, sichtbar in Chronik und Heldenbuch.
//
// find(s, r)                  → data oder null (Wer bittet worum? Nur wenn die Situation passt)
// text(s, d)                  → Beschreibung
// options(s, d)[]             → { label, desc, cost: { gold }, apply(s, r, d) → Ergebnistext }
// Die letzte Option ist die Vorgabe, wenn du nicht rechtzeitig antwortest.

import { AREAS, RECIPES } from './data.js';
import { fmt } from './text.js';
import { log, changeMood, evaluateAreas, priceOf, canAfford, buyItem, clockOf, isNight } from './sim.js';
import { relation, changeRelation } from './social.js';
import { bio } from './life.js';
import { makeRng } from './rng.js';

const H = 60;
const WAIT = 5 * H;
const hero = (s, id) => s.heroes.find((h) => h.id === id);
const inVillage = (h) => h && h.state !== 'away';
const first = (h) => h.name.split(' ')[0];
const pct = (p) => `${Math.round(p * 100)} %`;

export const REQUESTS = {
  // „Soll ich mich trauen?“ – du kannst ermutigen oder abraten
  courage: {
    icon: '🗣️', title: 'Ein Rat unter vier Augen',
    find(s, r) {
      const options = [];
      for (const h of s.heroes) {
        if (h.state !== 'idle' || (h.advice && h.advice.until > s.t)) continue;
        for (const e of evaluateAreas(s, h)) {
          if (e.block !== 'danger' || e.p < 0.25 || e.p >= e.threshold) continue;
          const weight = h.goal?.type === 'area' && h.goal.area === e.id ? 3 : 1;
          for (let i = 0; i < weight; i++) options.push({ hero: h.id, area: e.id, p: e.p });
        }
      }
      return options.length ? r.pick(options) : null;
    },
    text: (s, d) => {
      const h = hero(s, d.hero);
      const a = AREAS[d.area];
      const dream = h.goal?.type === 'area' && h.goal.area === d.area ? ' Das ist doch mein Traum!' : '';
      return fmt(`{n} kommt an deinen Tresen: „Ich überlege, mich ${a.zu} zu wagen.${dream} Aber ich weiß nicht … Was meinst du?“`, h) +
        ` Die Chancen stehen bei etwa ${pct(d.p)}.`;
    },
    options: (s, d) => {
      const h = hero(s, d.hero);
      const a = AREAS[d.area];
      return [
        {
          label: 'Ermutigen', desc: `${first(h)} zieht wahrscheinlich bald ${a.zu}. Gelingt es, wächst ${h.female ? 'ihr' : 'sein'} Mut – scheitert es, gibt ${h.female ? 'sie' : 'er'} dir die Schuld.`,
          apply: (s2, r) => {
            h.advice = { type: 'encouraged', area: d.area, until: s2.t + 12 * H };
            changeMood(h, 5);
            bio(s2, h, '✋', `Du hast ${h.female ? 'ihr' : 'ihm'} Mut gemacht, sich ${a.zu} zu wagen.`, true);
            return fmt(`Du klopfst {n} auf die Schulter: „Du schaffst das!“ {Er} strafft die Schultern.`, h);
          },
        },
        {
          label: 'Abraten', desc: `${first(h)} meidet ${a.name} für einen Tag. Sicherer – aber Abenteuerlustige sind enttäuscht.`,
          apply: (s2) => {
            h.advice = { type: 'discouraged', area: d.area, until: s2.t + 24 * H };
            const eager = h.traits.some((t) => ['mutig', 'ruhmsuechtig', 'uebermuetig'].includes(t));
            changeMood(h, eager ? -6 : 2);
            bio(s2, h, '✋', `Du hast ${h.female ? 'ihr' : 'ihm'} abgeraten, ${a.zu} zu gehen.`, true);
            return fmt(eager ? '„Pff. Na gut.“ {n} wirkt enttäuscht, hört aber auf dich.' : '{n} nickt erleichtert. „Ja, vielleicht ist es noch zu früh.“', h);
          },
        },
        {
          label: 'Keine Zeit', desc: 'Du hast gerade anderes zu tun.',
          apply: () => { changeMood(h, -2); return fmt('{n} wartet vergeblich auf eine Antwort und trollt sich.', h); },
        },
      ];
    },
  },

  // Vorschuss für ein Ausrüstungsteil aus deinem Regal
  loan: {
    icon: '💰', title: 'Bitte um einen Vorschuss',
    find(s, r) {
      const options = [];
      for (const h of s.heroes) {
        if (!inVillage(h) || h.debt) continue;
        for (const it of s.shelf) {
          const rc = RECIPES[it.recipe];
          if (rc.cls !== h.cls || rc.tier <= (h[rc.slot] ? RECIPES[h[rc.slot]].tier : 0)) continue;
          const price = priceOf(s, it.recipe);
          if (canAfford(h, price) || h.gold < price * 0.4) continue;
          const need = Math.ceil(price * (h.traits.includes('geizig') ? 1.3 : 1) - h.gold);
          options.push({ hero: h.id, recipe: it.recipe, amount: Math.ceil(need / 5) * 5 });
        }
      }
      return options.length ? r.pick(options) : null;
    },
    text: (s, d) => fmt(`{n} schaut sehnsüchtig auf **${RECIPES[d.recipe].name}** in deinem Regal: „Mir fehlen noch ${d.amount} Gold. ` +
      'Kannst du mir das vorstrecken? Ich zahl\'s zurück, versprochen!“', hero(s, d.hero)),
    options: (s, d) => {
      const h = hero(s, d.hero);
      return [
        {
          label: `${d.amount} Gold vorstrecken`, cost: { gold: d.amount },
          desc: `${first(h)} kauft sofort. Zurückgezahlt wird, sobald ${h.female ? 'sie' : 'er'} genug hat – hoffentlich innerhalb von zwei Tagen.`,
          apply: (s2, r) => {
            h.gold += d.amount;
            h.debt = { amount: d.amount, due: s2.t + 48 * H };
            bio(s2, h, '✋', `Bekam von dir ${d.amount} Gold Vorschuss für ${RECIPES[d.recipe].name}.`, true);
            buyItem(s2, r, h, d.recipe);
            return fmt(`Du schiebst {n} ${d.amount} Gold über den Tresen. {Er} strahlt.`, h);
          },
        },
        {
          label: 'Ablehnen', desc: 'Geschäft ist Geschäft.',
          apply: (s2) => {
            changeMood(h, -4);
            bio(s2, h, '✋', 'Du hast ' + (h.female ? 'ihr' : 'ihm') + ' einen Vorschuss verweigert.', true);
            return fmt('„Dann spar ich halt weiter“, murmelt {n}.', h);
          },
        },
      ];
    },
  },

  // Zwei Rivalen geraten im Laden aneinander
  quarrel: {
    icon: '💢', title: 'Streit im Laden',
    find(s, r) {
      const pairs = [];
      const here = s.heroes.filter(inVillage);
      for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) {
        if (relation(s, here[i], here[j]) <= -25) pairs.push({ hero: here[i].id, other: here[j].id });
      }
      return pairs.length ? r.pick(pairs) : null;
    },
    text: (s, d) => fmt('{n} und {o} geraten in deinem Laden aneinander. Erst fallen böse Worte, gleich fliegen die Fäuste!',
      hero(s, d.hero), { o: `**${hero(s, d.other).name}**` }),
    options: (s, d) => {
      const a = hero(s, d.hero), b = hero(s, d.other);
      return [
        {
          label: 'Schlichten – eine Runde ausgeben', cost: { gold: 20 },
          desc: 'Die beiden kommen sich näher. Vielleicht wird ja doch noch was.',
          apply: (s2, r) => {
            changeRelation(s2, r, a, b, 30);
            changeMood(a, 3); changeMood(b, 3);
            bio(s2, a, '✋', `Du hast den Streit mit ${b.name} geschlichtet.`, true);
            bio(s2, b, '✋', `Du hast den Streit mit ${a.name} geschlichtet.`, true);
            return fmt('Bei einem Krug Met reichen sich {n} und {o} widerwillig die Hand.', a, { o: `**${b.name}**` });
          },
        },
        {
          label: 'Anheizen: „Wer ist der Bessere?“', desc: '12 Std. Wettstreit: Beide gehen mehr Risiko ein, um den anderen zu übertrumpfen.',
          apply: (s2, r) => {
            changeRelation(s2, r, a, b, -15);
            for (const h of [a, b]) h.challengeUntil = s2.t + 12 * H;
            bio(s2, a, '✋', `Du hast den Wettstreit mit ${b.name} angeheizt.`, true);
            bio(s2, b, '✋', `Du hast den Wettstreit mit ${a.name} angeheizt.`, true);
            return fmt('„Das klären wir draußen – im Finsterwald!“ {n} und {o} wollen sich gegenseitig übertrumpfen.', a, { o: `**${b.name}**` });
          },
        },
        {
          label: 'Raushalten', desc: 'Die beiden kühlen sich schon wieder ab. Oder auch nicht.',
          apply: (s2, r) => { changeRelation(s2, r, a, b, -8); return fmt('Der Streit zwischen {n} und {o} endet mit einem umgeworfenen Regal.', a, { o: `**${b.name}**` }); },
        },
      ];
    },
  },

  // Ein junger Held will bei einem Veteranen in die Lehre
  mentor: {
    icon: '🎓', title: 'Eine Lehre vermitteln',
    find(s, r) {
      const pairs = [];
      const here = s.heroes.filter(inVillage);
      for (const young of here) {
        if (young.mentor || young.level > 4) continue;
        for (const vet of here) {
          if (vet === young || vet.level < young.level + 4 || s.heroes.some((x) => x.mentor === vet.id)) continue;
          if (relation(s, young, vet) < -10) continue;
          pairs.push({ hero: young.id, other: vet.id });
        }
      }
      return pairs.length ? r.pick(pairs) : null;
    },
    text: (s, d) => {
      const y = hero(s, d.hero), v = hero(s, d.other);
      return fmt(`{n} (Stufe ${y.level}) bewundert {o} (Stufe ${v.level}) und würde gern in die Lehre gehen. ` +
        `${first(v)} wäre bereit – für ein kleines Lehrgeld.`, y, { o: `**${v.name}**` });
    },
    options: (s, d) => {
      const y = hero(s, d.hero), v = hero(s, d.other);
      return [
        {
          label: 'Lehre vermitteln', cost: { gold: 40 },
          desc: `${first(y)} lernt schneller, solange ${first(v)} im Dorf ist – und übernimmt vielleicht etwas von ${v.female ? 'ihrem' : 'seinem'} Wesen.`,
          apply: (s2, r) => {
            y.mentor = v.id;
            changeRelation(s2, r, y, v, 25);
            changeMood(y, 8);
            bio(s2, y, '✋', `Ging durch deine Vermittlung bei ${v.name} in die Lehre.`, true);
            bio(s2, v, '✋', `Nahm durch deine Vermittlung ${y.name} als Lehrling auf.`, true);
            return fmt('{n} geht bei {o} in die Lehre. Ab morgen früh wird geübt.', y, { o: `**${v.name}**` });
          },
        },
        {
          label: 'Ablehnen', desc: 'Jeder muss seinen eigenen Weg finden.',
          apply: () => { changeMood(y, -3); return fmt('{n} zieht enttäuscht von dannen.', y); },
        },
      ];
    },
  },
};

// ---------- Ablauf ----------

export function requestOptions(s) {
  const q = s.request;
  return q ? REQUESTS[q.type].options(s, q.data) : [];
}

export function requestValid(s) {
  const q = s.request;
  if (!q) return false;
  return [q.data.hero, q.data.other].filter(Boolean).every((id) => hero(s, id));
}

export function resolveRequest(s, index, auto = false, r = makeRng(s)) {
  const q = s.request;
  if (!q) return false;
  if (!requestValid(s)) { s.request = null; return false; }
  const opt = requestOptions(s)[index];
  if (!opt) return false;
  if (opt.cost?.gold && s.gold < opt.cost.gold) return false;
  if (opt.cost?.gold) s.gold -= opt.cost.gold;
  const text = opt.apply(s, r);
  s.request = null;
  s.nextRequest = s.t + r.int(4 * H, 8 * H);
  log(s, 'request', `${REQUESTS[q.type].icon} ${auto ? 'Du hast nicht geantwortet. ' : ''}${text}`, q.data.hero);
  return true;
}

export function processRequests(s, r) {
  if (s.request) {
    if (!requestValid(s)) { s.request = null; return; }
    if (s.t >= s.request.expires) resolveRequest(s, requestOptions(s).length - 1, true, r);
    return;
  }
  const { minute } = clockOf(s);
  if (s.t < s.nextRequest || isNight(s) || minute < 8 * 60 || minute >= 20 * 60) return;
  s.nextRequest = s.t + 60; // nichts Passendes? In einer Stunde wieder schauen
  const types = Object.keys(REQUESTS).filter((t) => t !== s.lastRequestType);
  for (const type of types.sort(() => r() - 0.5)) {
    const data = REQUESTS[type].find(s, r);
    if (!data) continue;
    s.request = { type, data, t: s.t, expires: s.t + WAIT };
    s.lastRequestType = type;
    const h = hero(s, data.hero);
    log(s, 'request', `${REQUESTS[type].icon} ${fmt('{n} kommt mit einer Bitte zu dir.', h)}`, h.id, { pending: true });
    return;
  }
}
