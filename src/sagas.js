// Mehrtägige Geschichten: Fäden, die sich über Stunden und Tage ziehen und an ein, zwei Stellen
// deine Entscheidung brauchen. Es läuft immer nur eine Geschichte zugleich (s.saga).
// Die Entscheidungen kommen als Besucher an den Tresen (Besuchsart „saga“, siehe requests.js).
//
// Ablauf einer Geschichte: start → steps[step] (Besucher mit text/options) → Auflösung über Zeit oder Rückkehr.

import { AREAS, MATERIALS } from './data.js';
import { fmt } from './text.js';
import { log, changeMood, successChance, heroPower, isNight } from './sim.js';
import { relation, changeRelation, friendsOf } from './social.js';
import { bio, bump } from './life.js';
import { remember, recall, trustOf, changeTrust } from './memory.js';
import { addVisitor } from './requests.js';

const H = 60;
const first = (h) => h.name.split(' ')[0];
const hero = (s, id) => s.heroes.find((h) => h.id === id);
const present = (s) => s.heroes.filter((h) => h.state !== 'away');

function endSaga(s, r) {
  s.saga = null;
  s.nextSagaAt = s.t + r.int(36 * H, 72 * H);
}

function canStart(s) {
  return !s.saga && s.t >= (s.nextSagaAt ?? 0) && s.heroes.length >= 3;
}

// Nächstschwereres Gebiet (für Schatzkarten)
function harderArea(areaId) {
  const ids = Object.keys(AREAS);
  return ids[ids.indexOf(areaId) + 1] ?? null;
}

export const SAGAS = {
  // ---------- Verschollen: Ein Held kehrt nicht zurück ----------
  verschollen: {
    icon: '🕯️', title: 'Verschollen',
    steps: {
      alarm: {
        text: (s, g) => {
          const m = hero(s, g.missing), v = hero(s, g.visitor);
          const friend = relation(s, m, v) >= 40;
          return fmt(`{n} steht blass an deinem Tresen: „{o} ist nicht ${AREAS[g.area].aus} zurückgekommen. Seit Stunden kein Zeichen. ` +
            `${friend ? 'Ich lass meinen Freund da draußen nicht im Stich' : 'So lässt man niemanden zurück'} – aber allein und ohne Ausrüstung für die Suche …“`, v, { o: `**${m.name}**` });
        },
        options: (s, g) => {
          const m = hero(s, g.missing), v = hero(s, g.visitor);
          const p = Math.round(Math.min(0.95, successChance(v, g.area, s) + 0.25) * 100);
          return [
            {
              label: `${first(v)} auf die Suche schicken`, cost: { gold: 60 },
              desc: `Du zahlst Fackeln, Seile und Proviant. ${first(v)} bricht sofort auf (Chance etwa ${p} %).`,
              apply: (s2, r) => {
                g.step = 'search'; g.searcher = v.id; g.paid = true;
                v.state = 'away'; v.area = g.area; v.departedAt = s2.t;
                v.until = s2.t + r.int(3 * H, 5 * H);
                v.quest = { saga: 'verschollen', search: true };
                v.thought = `Halt durch, ${first(m)}. Ich komme.`; v.thoughtIcon = null;
                bio(s2, v, '🕯️', `Zog los, um ${m.name} zu suchen.`);
                return fmt(`{n} schultert das Seil und verschwindet im Laufschritt ${AREAS[g.area].zu}.`, v);
              },
            },
            {
              label: 'Kopfgeld für Hinweise aushängen', cost: { gold: 150 },
              desc: 'Jäger und Köhler der Gegend halten die Augen offen. Sicherer, dauert aber länger.',
              apply: (s2, r) => {
                g.step = 'hunters'; g.paid = true; g.resolveAt = s2.t + r.int(6 * H, 9 * H);
                return 'Du nagelst den Zettel ans Auftragsbrett. Noch am selben Abend ziehen zwei Köhler mit Laternen los.';
              },
            },
            {
              label: 'Abwarten', desc: `Vielleicht schafft ${first(m)} es allein zurück.`,
              apply: (s2, r) => {
                g.step = 'waiting'; g.resolveAt = s2.t + r.int(10 * H, 16 * H);
                changeMood(v, -6);
                return fmt('{n} sieht dich lange an und geht ohne ein Wort.', v);
              },
            },
          ];
        },
      },
    },
    // Rückkehr des Vermissten. how: 'rescued' (von g.searcher gefunden) | 'hunters' | 'alone'
    comeHome(s, r, g, how) {
      const m = hero(s, g.missing);
      if (!m) return endSaga(s, r);
      const a = AREAS[g.area];
      m.missing = null;
      m.adventures++; s.stats.adventures++;
      m.area = null; m.bountyTrip = false; m.partyWith = null;
      m.state = 'injured';
      m.wound = how === 'alone' ? 'heavy' : 'light';
      m.until = s.t + (how === 'alone' ? r.int(300, 480) : r.int(90, 150));
      m.thought = how === 'alone' ? 'Ich dachte, es kommt jemand …' : 'Ich hab die Laternen gesehen und geweint vor Glück.'; m.thoughtIcon = null;
      remember(s, m, 'hurt', { area: g.area });
      if (how === 'rescued') {
        const v = hero(s, g.searcher);
        remember(s, m, 'rescued', { area: g.area, other: v ? first(v) : 'ein Freund' });
        bio(s, m, '🕯️', `War ${a.in} verschollen – ${v ? v.name : 'ein Suchtrupp'} fand ${m.female ? 'sie' : 'ihn'}, weil du die Suche bezahlt hast.`, true);
        if (v) {
          changeRelation(s, r, m, v, 40);
          changeMood(v, 12); changeTrust(v, 8);
          bio(s, v, '🕯️', `Fand ${m.name} ${a.in} und brachte ${m.female ? 'sie' : 'ihn'} heim.`, true);
        }
        s.reputation += 6;
        log(s, 'saga', fmt(`🕯️ Im Morgengrauen zwei Gestalten am Tor: {o} stützt {n}. Verschrammt, erschöpft – aber am Leben. Das halbe Dorf läuft zusammen.`, m, { o: `**${v?.name ?? 'Der Suchtrupp'}**` }), m.id, { good: true });
      } else if (how === 'hunters') {
        remember(s, m, 'rescued', { area: g.area, other: 'die Köhler' });
        bio(s, m, '🕯️', `War ${a.in} verschollen – dein Kopfgeld brachte ${m.female ? 'sie' : 'ihn'} heim.`, true);
        s.reputation += 4;
        log(s, 'saga', fmt(`🕯️ Zwei Köhler bringen {n} auf einer Trage ins Dorf. „Lag in einer Felsspalte. Hat immer nur nach Eichenfurt gefragt.“`, m), m.id, { good: true });
      } else {
        remember(s, m, 'abandoned', { area: g.area });
        changeMood(m, -15); bump(m, 'bitterness');
        for (const f of friendsOf(s, m)) { changeMood(f, -6); changeTrust(f, -6); }
        bio(s, m, '🕯️', `War ${a.in} verschollen und schleppte sich allein zurück. Niemand hatte gesucht.`, true);
        log(s, 'saga', fmt(`🕯️ Mitten in der Nacht klopft es am Tor: {n}, mehr tot als lebendig. „Niemand ist gekommen“, ist alles, was {er} sagt.`, m), m.id, { bad: true });
      }
      endSaga(s, r);
    },
    tick(s, r, g) {
      const m = hero(s, g.missing);
      if (!m) return endSaga(s, r);
      if (g.step === 'alarm' && !g.asked) {
        // Jemand im Dorf schlägt Alarm – am liebsten ein Freund
        const here = present(s).filter((h) => h.state === 'idle' && h.id !== m.id);
        if (!here.length || isNight(s)) { if (s.t - g.since > 20 * H) SAGAS.verschollen.comeHome(s, r, g, 'alone'); return; }
        const v = here.sort((a, b) => relation(s, m, b) - relation(s, m, a))[0];
        g.visitor = v.id; g.asked = true;
        addVisitor(s, 'saga', { hero: v.id, saga: 'verschollen', step: 'alarm' }, 8 * H);
        log(s, 'request', fmt(`🕯️ {n} kommt beunruhigt zu dir: {o} ist überfällig.`, v, { o: `**${m.name}**` }), v.id, { pending: true });
      }
      // Der Bote ist nicht mehr da (abgereist o. Ä.), ohne dass du geantwortet hast: Es bleibt beim Warten
      if (g.step === 'alarm' && g.asked && !s.requests.some((q) => q.type === 'saga' && q.data.saga === 'verschollen')) {
        g.step = 'waiting'; g.resolveAt = s.t + r.int(6 * H, 10 * H);
      }
      if ((g.step === 'hunters' || g.step === 'waiting') && s.t >= g.resolveAt) {
        SAGAS.verschollen.comeHome(s, r, g, g.step === 'hunters' ? 'hunters' : 'alone');
      }
    },
  },

  // ---------- Rache: Eine offene Rechnung ----------
  rache: {
    icon: '🔥', title: 'Eine offene Rechnung',
    steps: {
      oath: {
        text: (s, g) => fmt(`{n} knallt die Faust auf deinen Tresen: „${AREAS[g.area].foe} haben mich fast umgebracht. Ich träum jede Nacht davon. ` +
          `Ich geh zurück ${AREAS[g.area].zu} – und diesmal komm ich nicht mit leeren Händen wieder. Bist du dabei?“`, hero(s, g.hero)),
        options: (s, g) => {
          const h = hero(s, g.hero);
          const p = Math.round(successChance(h, g.area, s) * 100);
          return [
            {
              label: '„Hol sie dir.“ – Proviant und ein Heiltrank aufs Haus', cost: { gold: 40 },
              desc: `${first(h)} zieht gestärkt los (Chance etwa ${p} %). Ein Sieg tilgt die alte Wunde – eine Niederlage geht auch auf deine Kappe.`,
              apply: (s2) => {
                g.step = 'hunt'; g.backed = true;
                h.potions += 1; changeMood(h, 8);
                h.quest = { saga: 'rache', area: g.area, until: s2.t + 24 * H };
                bio(s2, h, '🔥', `Schwor Rache ${AREAS[g.area].in} – du hast ${h.female ? 'sie' : 'ihn'} dafür ausgerüstet.`, true);
                return fmt('{n} steckt den Heiltrank ein und grinst zum ersten Mal seit Tagen. „Morgen früh.“', h);
              },
            },
            {
              label: '„Rache ist ein schlechter Ratgeber.“', desc: `${first(h)} lässt es vielleicht sein. Die Wunde bleibt.`,
              apply: (s2, r) => {
                const eager = h.traits.some((t) => ['mutig', 'ruhmsuechtig', 'uebermuetig'].includes(t));
                if (eager) {
                  g.step = 'hunt'; g.backed = false;
                  h.quest = { saga: 'rache', area: g.area, until: s2.t + 24 * H };
                  changeMood(h, -3);
                  return fmt('„Dann eben ohne dich.“ {n} dreht sich um. Aufhalten lässt {er} sich nicht.', h);
                }
                remember(s2, h, 'cautioned'); changeMood(h, 2);
                endSaga(s2, r);
                return fmt('{n} starrt lange in den Krug. „Vielleicht hast du recht.“ Die Faust öffnet sich.', h);
              },
            },
            {
              label: 'Schulterzucken', desc: `${first(h)} zieht auf eigene Faust los.`,
              apply: (s2) => {
                g.step = 'hunt'; g.backed = false;
                h.quest = { saga: 'rache', area: g.area, until: s2.t + 24 * H };
                return fmt('{n} wartet nicht auf deinen Segen.', h);
              },
            },
          ];
        },
      },
    },
    // Rückkehr vom Rachefeldzug
    tripDone(s, r, g, h, success) {
      const a = AREAS[g.area];
      h.quest = null;
      if (success) {
        h.mem = (h.mem ?? []).filter((m) => !(m.type === 'hurt' && m.area === g.area)); // die Narbe ist getilgt
        changeMood(h, 18); bump(h, 'joy'); bump(h, 'winStreak');
        if (g.backed) remember(s, h, 'avenged', { area: g.area });
        s.reputation += 5;
        bio(s, h, '🔥', `Nahm Rache ${a.in}. Die alte Wunde ist vergessen.`, g.backed);
        log(s, 'saga', fmt(`🔥 {n} kommt ${a.aus} zurück und wirft eine Trophäe auf den Tavernentisch. „Das war für letztes Mal.“ Die Rechnung ist beglichen.`, h), h.id, { good: true });
      } else {
        changeMood(h, -8); bump(h, 'heavyDefeats');
        if (g.backed) { remember(s, h, 'badAdvice', { area: g.area }); bump(h, 'badAdvice'); }
        bio(s, h, '🔥', `Suchte Rache ${a.in} – und scheiterte erneut.`, g.backed);
        log(s, 'saga', fmt(`🔥 Die Rache ist missglückt: {n} kehrt ${a.aus} geschlagen zurück.${g.backed ? ' Der Blick, der dich trifft, ist finster.' : ''}`, h), h.id, { bad: true });
      }
      endSaga(s, r);
    },
    tick(s, r, g) {
      const h = hero(s, g.hero);
      if (!h) return endSaga(s, r);
      // Der Schwur verfliegt, wenn der Held nicht loszieht
      if (g.step === 'hunt' && h.state !== 'away' && (!h.quest || h.quest.until <= s.t)) { h.quest = null; endSaga(s, r); }
    },
  },

  // ---------- Die Karte: Ein Fund mit Folgen ----------
  karte: {
    icon: '🗺️', title: 'Eine alte Karte',
    steps: {
      find: {
        text: (s, g) => fmt(`{n} breitet ein fleckiges Pergament auf deinem Tresen aus: „Hab ich ${AREAS[g.from].in} gefunden. Siehst du das Kreuz? ` +
          `Das ist ${AREAS[g.area].in}. Gefährlicher als alles, wo ich bisher war. Was meinst du – wag ich’s?“`, hero(s, g.hero)),
        options: (s, g) => {
          const h = hero(s, g.hero);
          const p = Math.round(successChance(h, g.area, s) * 100);
          const friend = friendsOf(s, h).find((f) => f.state !== 'away');
          const price = 60 + AREAS[g.area].danger * 3;
          const opts = [
            {
              label: '„Such den Schatz!“', desc: `${first(h)} bricht bald ${AREAS[g.area].zu} auf (Chance etwa ${p} %). Vom Schatz fällt vielleicht etwas für dich ab.`,
              apply: (s2) => {
                g.step = 'hunt'; g.backed = true;
                h.quest = { saga: 'karte', area: g.area, until: s2.t + 30 * H };
                changeMood(h, 6);
                bio(s2, h, '🗺️', `Fand eine Schatzkarte – du hast ${h.female ? 'ihr' : 'ihm'} zur Suche ${AREAS[g.area].in} geraten.`, true);
                return fmt('{n} rollt die Karte ein wie eine Reliquie. „Wenn das stimmt, geb ich einen aus. Zwei!“', h);
              },
            },
            {
              label: `Die Karte abkaufen`, cost: { gold: price },
              desc: `Du hängst sie ans Auftragsbrett: 12 Std. lang bringt ${AREAS[g.area].name} allen das Dreifache an Gold. ${first(h)} bleibt in Sicherheit.`,
              apply: (s2, r) => {
                h.gold += price; changeMood(h, 3);
                s2.effects.push({ label: `Schatzkarte: ${AREAS[g.area].name}`, icon: '🗺️', until: s2.t + 12 * H, mods: [{ key: 'gold', v: 3, area: g.area }], tag: null });
                endSaga(s2, r);
                return fmt('{n} zählt die Münzen und wirkt fast erleichtert. Die Karte hängt keine Stunde, da stehen schon drei davor.', h);
              },
            },
          ];
          if (friend) opts.splice(1, 0, {
            label: `„Nimm ${first(friend)} mit.“`, desc: `Zu zweit ist es sicherer – sobald beide Zeit haben. Der Schatz wird geteilt.`,
            apply: (s2) => {
              g.step = 'hunt'; g.backed = true; g.partner = friend.id;
              h.quest = { saga: 'karte', area: g.area, until: s2.t + 30 * H };
              friend.quest = { saga: 'karte', area: g.area, until: s2.t + 30 * H, follower: true };
              changeMood(h, 6); changeMood(friend, 4);
              bio(s2, h, '🗺️', `Fand eine Schatzkarte – auf deinen Rat hin zog ${h.female ? 'sie' : 'er'} mit ${friend.name} los.`, true);
              return fmt('{n} winkt {o} heran. Die beiden stecken die Köpfe über der Karte zusammen.', h, { o: `**${friend.name}**` });
            },
          });
          opts.push({
            label: '„Lass die Finger davon.“', desc: 'Die Karte verschwindet in einer Schublade.',
            apply: (s2, r) => { endSaga(s2, r); return fmt('{n} faltet das Pergament zusammen. „Schade drum.“', h); },
          });
          return opts;
        },
      },
    },
    tripDone(s, r, g, h, success) {
      const a = AREAS[g.area];
      const partner = g.partner ? hero(s, g.partner) : null;
      h.quest = null;
      if (partner) partner.quest = null;
      if (success) {
        const loot = Math.round(a.danger * r.int(8, 14));
        h.gold += partner ? Math.round(loot / 2) : loot;
        if (partner) partner.gold += Math.round(loot / 2);
        changeMood(h, 15); bump(h, 'joy');
        remember(s, h, 'goodAdvice', { area: g.area });
        let share = '';
        if (a.mat && trustOf(h) >= 15) { s.mats[a.mat] += 2; share = ` Für dich: 2× ${MATERIALS[a.mat].name} ${MATERIALS[a.mat].icon}. „Ohne dich hätt ich mich nie getraut.“`; }
        s.reputation += 6;
        bio(s, h, '🗺️', `Hob den Schatz ${a.in} (${loot} Gold).`, true);
        log(s, 'saga', fmt(`🗺️ Die Karte war echt! {n} kehrt ${a.aus} mit einer Kiste voller Münzen zurück (${loot} 🪙).${share}`, h), h.id, { good: true });
      } else {
        remember(s, h, 'badAdvice', { area: g.area }); bump(h, 'badAdvice');
        bio(s, h, '🗺️', `Suchte den Schatz ${a.in} und fand nur Ärger.`, true);
        log(s, 'saga', fmt(`🗺️ Kein Schatz, dafür ${a.foe}: {n} kommt ${a.aus} zurück und wirft dir die zerknüllte Karte vor die Füße.`, h), h.id, { bad: true });
      }
      endSaga(s, r);
    },
    tick(s, r, g) {
      const h = hero(s, g.hero);
      if (!h) return endSaga(s, r);
      if (g.step === 'hunt' && h.state !== 'away' && (!h.quest || h.quest.until <= s.t)) {
        h.quest = null;
        const p = g.partner ? hero(s, g.partner) : null;
        if (p) p.quest = null;
        endSaga(s, r);
      }
    },
  },
};

// ---------- Haken in die Simulation ----------

// Vor der Rückkehr eines Helden: true = die Geschichte übernimmt, keine normale Rückkehr
export function sagaIntercept(s, r, h) {
  if (h.missing) return true; // verschollen: kommt erst zurück, wenn die Geschichte es will
  const g = s.saga;
  if (h.quest?.search && g?.id === 'verschollen') {
    // Der Suchtrupp kehrt zurück
    const found = r.chance(Math.min(0.95, successChance(h, g.area, s) + 0.25));
    h.quest = null; h.area = null; h.partyWith = null;
    h.state = 'rest'; h.until = s.t + r.int(60, 120);
    h.adventures++; s.stats.adventures++;
    if (found) { h.successes++; s.stats.successes++; SAGAS.verschollen.comeHome(s, r, g, 'rescued'); }
    else {
      log(s, 'saga', fmt('🕯️ {n} kehrt allein und mit leeren Händen von der Suche zurück. Die Spur verlor sich im Dunkeln.', h), h.id);
      g.step = 'waiting'; g.resolveAt = s.t + r.int(4 * H, 8 * H);
    }
    return true;
  }
  if (h.quest?.search) h.quest = null; // Geschichte ist anderweitig zu Ende gegangen
  // Auslöser „Verschollen“: gefährliches Gebiet, allein unterwegs (ohne Heiltrank deutlich wahrscheinlicher)
  if (canStart(s) && !h.partyWith && !h.quest && AREAS[h.area].danger >= 20 && h.chance < 0.85 && r.chance((1 - h.chance) * (h.potions ? 0.08 : 0.4))) {
    h.missing = { since: s.t, area: h.area };
    h.until = s.t + 99999;
    s.saga = { id: 'verschollen', step: 'alarm', missing: h.id, area: h.area, since: s.t };
    log(s, 'saga', fmt(`🕯️ {n} ist nicht ${AREAS[h.area].aus} zurückgekehrt. In der Taverne bleibt ein Platz leer.`, h), h.id);
    return true;
  }
  return false;
}

// Nach einer normalen Rückkehr: Auflösung von Rache und Schatzsuche, Fund einer Karte
export function sagaAfterTrip(s, r, h, areaId, success) {
  const g = s.saga;
  if (g && h.quest && !h.quest.follower && h.quest.area === areaId && SAGAS[g.id].tripDone && g.hero === h.id) {
    SAGAS[g.id].tripDone(s, r, g, h, success);
    return;
  }
  if (success && canStart(s) && h.state !== 'injured' && AREAS[areaId].danger >= 9 && r.chance(0.12)) {
    const target = harderArea(areaId);
    if (target && successChance(h, target, s) >= 0.2 && (h.areaWins?.[target] ?? 0) === 0) {
      s.saga = { id: 'karte', step: 'find', hero: h.id, from: areaId, area: target, since: s.t };
      addVisitor(s, 'saga', { hero: h.id, saga: 'karte', step: 'find' }, 10 * H);
      log(s, 'request', fmt(`🗺️ {n} hat ${AREAS[areaId].in} etwas gefunden und will es dir zeigen.`, h), h.id, { pending: true });
    }
  }
}

// Zieht es den Helden wegen einer Geschichte in dieses Gebiet?
export function questArea(s, h, areaId) {
  return !!h.quest && !h.quest.search && h.quest.area === areaId && h.quest.until > s.t;
}

export function processSagas(s, r) {
  const g = s.saga;
  if (g) { SAGAS[g.id].tick(s, r, g); return; }
  // Auslöser „Rache“: eine frische schwere Niederlage, der Held ist wieder auf den Beinen
  if (s.t % 30 !== 0 || !canStart(s) || isNight(s)) return;
  const sore = s.heroes.filter((h) => h.state === 'idle' && !h.quest && recall(h, 'hurt', (m) => s.t - m.t < 3 * 1440 && !m.sworn)
    && !h.traits.includes('vorsichtig') && heroPower(h) > 0);
  if (!sore.length || !r.chance(0.25)) return;
  const h = r.pick(sore);
  const m = recall(h, 'hurt', (x) => s.t - x.t < 3 * 1440 && !x.sworn);
  if (successChance(h, m.area, s) < 0.3) return;
  m.sworn = true;
  s.saga = { id: 'rache', step: 'oath', hero: h.id, area: m.area, since: s.t };
  addVisitor(s, 'saga', { hero: h.id, saga: 'rache', step: 'oath' }, 10 * H);
  log(s, 'request', fmt('🔥 {n} kommt mit finsterer Miene an deinen Tresen.', h), h.id, { pending: true });
}

// Für die Besuchsart „saga“
export function sagaStep(s, d) {
  const g = s.saga;
  if (!g || g.id !== d.saga || g.step !== d.step) return null;
  return { def: SAGAS[g.id], step: SAGAS[g.id].steps[d.step], g };
}
