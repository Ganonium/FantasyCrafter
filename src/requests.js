// Besucher am Tresen: Ein Held kommt zu dir – mit einer Bitte, einer Geschichte, Dank oder Ärger.
// Deine Antwort hat Folgen – oft erst Stunden später, sichtbar in Chronik, Heldenbuch und Erinnerungen.
// Bis zu drei Besucher warten gleichzeitig (s.requests), damit sich ein kurzer Blick ins Spiel lohnt.
//
// find(s, r)                  → data oder null (Wer kommt weshalb? Nur wenn die Situation passt)
// valid(s, d)                 → optional: Passt der Anlass noch (z. B. liegt das Teil noch im Regal)?
// text(s, d)                  → Beschreibung
// options(s, d)[]             → { label, desc, cost: { gold }, apply(s, r, d) → Ergebnistext }
// Die letzte Option ist die Vorgabe, wenn du nicht rechtzeitig antwortest.

import { AREAS, RECIPES } from './data.js';
import { fmt } from './text.js';
import { log, changeMood, evaluateAreas, priceOf, canAfford, buyItem, giveItem, clockOf, isNight } from './sim.js';
import { relation, changeRelation } from './social.js';
import { bio, bump } from './life.js';
import { remember, recall, trustOf, changeTrust } from './memory.js';
import { makeRng } from './rng.js';

const H = 60;
const WAIT = 10 * H;
const MAX_WAITING = 3;
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
        if (h.state !== 'idle' || (h.advice && h.advice.until > s.t) || trustOf(h) <= -30) continue;
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
            remember(s2, h, 'loan');
            buyItem(s2, r, h, d.recipe);
            return fmt(`Du schiebst {n} ${d.amount} Gold über den Tresen. {Er} strahlt.`, h);
          },
        },
        {
          label: 'Ablehnen', desc: 'Geschäft ist Geschäft.',
          apply: (s2) => {
            changeMood(h, -4);
            bio(s2, h, '✋', 'Du hast ' + (h.female ? 'ihr' : 'ihm') + ' einen Vorschuss verweigert.', true);
            remember(s2, h, 'loanRefused');
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

  // Dank: Ein Held erinnert sich daran, was du für ihn getan hast
  thanks: {
    icon: '💛', title: 'Ein Dankeschön',
    find(s, r) {
      const options = [];
      for (const h of s.heroes) {
        if (!inVillage(h) || h.state === 'injured' || trustOf(h) < 5 || s.t - (h.lastThanks ?? -9999) < 36 * H) continue;
        for (const type of ['saved', 'goodAdvice', 'firstWin']) {
          const m = recall(h, type, (x) => !x.thanked);
          if (m) options.push({ hero: h.id, mem: type, area: m.area, item: m.item ?? null });
        }
      }
      return options.length ? r.pick(options) : null;
    },
    text: (s, d) => {
      const h = hero(s, d.hero), a = AREAS[d.area];
      const why = d.mem === 'saved' ? `„Dein Heiltrank hat mir ${a.in} das Leben gerettet. Ich wollte nur … danke sagen.“`
        : d.mem === 'goodAdvice' ? `„Ohne deinen Zuspruch hätte ich mich nie ${a.zu} getraut. Und jetzt schau mich an!“`
        : `„Mein erster Sieg ${a.in} – und ${d.item} hat gehalten, was du versprochen hast.“`;
      return fmt(`{n} legt etwas verlegen die Hände auf deinen Tresen: ${why}`, h);
    },
    options: (s, d) => {
      const h = hero(s, d.hero);
      const done = () => { const m = recall(h, d.mem, (x) => !x.thanked); if (m) m.thanked = true; h.lastThanks = s.t; };
      return [
        {
          label: '„Dafür bin ich da.“', desc: `${first(h)} geht mit einem guten Gefühl. Euer Verhältnis wächst.`,
          apply: (s2) => { done(); remember(s2, h, 'thanked'); changeMood(h, 4); return fmt('Du winkst ab. {n} strahlt trotzdem bis über beide Ohren.', h); },
        },
        {
          label: 'Darauf eine Runde aufs Haus', cost: { gold: 12 }, desc: 'Die ganze Taverne stößt mit an. Gute Laune für alle, die da sind.',
          apply: (s2) => {
            done(); remember(s2, h, 'thanked'); changeTrust(h, 6); changeMood(h, 8);
            for (const o of s2.heroes) if (o !== h && inVillage(o)) changeMood(o, 3);
            return fmt('„Auf {n}!“ Krüge krachen aneinander, und für einen Abend ist Eichenfurt der schönste Ort der Welt.', h);
          },
        },
        {
          label: 'Keine Zeit', desc: 'Du hast gerade anderes zu tun.',
          apply: () => { done(); changeMood(h, -1); return fmt('{n} wartet eine Weile, legt dann still eine Feldblume auf den Tresen und geht.', h); },
        },
      ];
    },
  },

  // Zwei wollen dasselbe letzte Stück
  lastItem: {
    icon: '⚖️', title: 'Das letzte Stück',
    find(s, r) {
      const options = [];
      const here = s.heroes.filter(inVillage);
      for (const it of s.shelf) {
        const rc = RECIPES[it.recipe];
        if (!rc.cls || s.shelf.filter((x) => x.recipe === it.recipe).length !== 1) continue;
        const price = priceOf(s, it.recipe);
        const want = here.filter((h) => h.cls === rc.cls && h.gold >= price && rc.tier > (h[rc.slot] ? RECIPES[h[rc.slot]].tier : 0));
        if (want.length >= 2) { const [a, b] = want.sort(() => r() - 0.5); options.push({ hero: a.id, other: b.id, recipe: it.recipe }); }
      }
      return options.length ? r.pick(options) : null;
    },
    valid: (s, d) => s.shelf.some((it) => it.recipe === d.recipe),
    text: (s, d) => fmt(`{n} und {o} greifen im selben Moment nach **${RECIPES[d.recipe].name}** – dem letzten Stück im Regal. ` +
      'Beide haben das Gold dabei. Beide schauen dich an.', hero(s, d.hero), { o: `**${hero(s, d.other).name}**` }),
    options: (s, d) => {
      const a = hero(s, d.hero), b = hero(s, d.other);
      const item = RECIPES[d.recipe].name;
      const give = (s2, r, w, l, fair) => {
        if (!buyItem(s2, r, w, d.recipe)) return 'Während ihr noch redet, ist das gute Stück schon weg.';
        if (fair) { changeMood(l, -2); changeRelation(s2, r, w, l, -6); return fmt(`Die Münze fällt für {n}. {o} zuckt die Schultern: „Pech gehabt.“`, w, { o: `**${l.name}**` }); }
        remember(s2, w, 'favored', { item, other: first(l) });
        remember(s2, l, 'passedOver', { item, other: first(w) });
        changeMood(l, -5); changeRelation(s2, r, w, l, -12);
        return fmt(`Du drückst {n} ${item} in die Hand. {o} sagt nichts – aber der Blick spricht Bände.`, w, { o: `**${l.name}**` });
      };
      return [
        { label: `${first(a)} bekommt es`, desc: `${first(a)} wird es dir danken – ${first(b)} wird es sich merken.`, apply: (s2, r) => give(s2, r, a, b, false) },
        { label: `${first(b)} bekommt es`, desc: `${first(b)} wird es dir danken – ${first(a)} wird es sich merken.`, apply: (s2, r) => give(s2, r, b, a, false) },
        { label: 'Münze werfen', desc: 'Gerecht – niemand nimmt es dir übel. Ein bisschen Neid bleibt trotzdem.',
          apply: (s2, r) => (r.chance(0.5) ? give(s2, r, a, b, true) : give(s2, r, b, a, true)) },
      ];
    },
  },

  // Dein Rat ging schief – jetzt steht der Held vor dir
  grudge: {
    icon: '😠', title: 'Ein Wörtchen mit dir',
    find(s, r) {
      const options = [];
      for (const h of s.heroes) {
        const m = inVillage(h) ? recall(h, 'badAdvice', (x) => !x.confronted) : null;
        if (m) options.push({ hero: h.id, area: m.area });
      }
      return options.length ? r.pick(options) : null;
    },
    text: (s, d) => {
      const h = hero(s, d.hero);
      return fmt(`{n} baut sich vor deinem Tresen auf${h.state === 'injured' ? ', den Arm noch in der Schlinge' : ''}: ` +
        `„‚Du schaffst das‘, hast du gesagt. Ich hab dir geglaubt. Und dann lag ich ${AREAS[d.area].in} im Dreck.“`, h);
    },
    options: (s, d) => {
      const h = hero(s, d.hero);
      const done = () => { const m = recall(h, 'badAdvice', (x) => !x.confronted); if (m) m.confronted = true; };
      const tough = h.traits.some((t) => ['mutig', 'abgehaertet', 'ruhmsuechtig'].includes(t));
      return [
        {
          label: 'Entschuldigen und den Heiler bezahlen', cost: { gold: 25 },
          desc: `Das renkt viel wieder ein${h.state === 'injured' ? ` – und ${first(h)} ist schneller wieder auf den Beinen` : ''}.`,
          apply: (s2) => {
            done(); remember(s2, h, 'apology'); changeMood(h, 8); bump(h, 'joy');
            if (h.state === 'injured') h.until = Math.max(s2.t + 30, h.until - 90);
            bio(s2, h, '✋', 'Du hast dich für deinen Rat entschuldigt und den Heiler bezahlt.', true);
            return fmt('„Das war mein Fehler“, sagst du. {n} schweigt lange. Dann: „Na gut. Aber das nächste Mal überleg dir’s zweimal.“', h);
          },
        },
        {
          label: '„Es war deine Entscheidung.“', desc: tough ? `${first(h)} ist hart im Nehmen – das könnte sogar Eindruck machen.` : 'Stimmt zwar. Aber ob das jetzt hilft?',
          apply: (s2) => {
            done();
            if (tough) { changeTrust(h, 6); return fmt('{n} starrt dich an – und lacht dann trocken. „Stimmt. War es.“', h); }
            remember(s2, h, 'brushedOff'); changeMood(h, -6); bump(h, 'bitterness');
            bio(s2, h, '✋', 'Du hast die Schuld für deinen Rat von dir gewiesen.', true);
            return fmt('{n} dreht sich wortlos um. Die Ladentür knallt.', h);
          },
        },
        {
          label: 'Schweigen', desc: 'Du polierst weiter an einer Klinge.',
          apply: () => { done(); changeMood(h, -3); changeTrust(h, -5); return fmt('{n} wartet auf eine Antwort, die nicht kommt.', h); },
        },
      ];
    },
  },

  // Nach einem Verlust: Der Held kann sich Ersatz nicht leisten
  gift: {
    icon: '🎁', title: 'Sehnsüchtige Blicke',
    find(s, r) {
      const options = [];
      for (const h of s.heroes) {
        const m = inVillage(h) ? recall(h, 'gearBroke', (x) => !x.offered) : null;
        if (!m || h.debt) continue;
        const cur = h[m.slot] ? RECIPES[h[m.slot]].tier : 0;
        const it = s.shelf.map((x) => x.recipe).filter((id) => RECIPES[id].cls === h.cls && RECIPES[id].slot === m.slot && RECIPES[id].tier > cur)
          .sort((x, y) => RECIPES[x].tier - RECIPES[y].tier)[0];
        if (it && h.gold < priceOf(s, it)) options.push({ hero: h.id, recipe: it, lost: m.item });
      }
      return options.length ? r.pick(options) : null;
    },
    valid: (s, d) => s.shelf.some((it) => it.recipe === d.recipe),
    text: (s, d) => fmt(`{n} steht lange vor **${RECIPES[d.recipe].name}** in deinem Regal. Seit ${d.lost} zerbrach, fehlt {ihm} etwas. ` +
      '{Er} zählt die Münzen einmal, zweimal – es reicht nicht.', hero(s, d.hero)),
    options: (s, d) => {
      const h = hero(s, d.hero);
      const rc = RECIPES[d.recipe];
      const price = priceOf(s, d.recipe);
      const half = Math.ceil(price / 2);
      const done = () => { const m = recall(h, 'gearBroke', (x) => !x.offered); if (m) m.offered = true; };
      const opts = [{
        label: 'Schenken', desc: `Du verzichtest auf ${price} Gold. ${first(h)} wird dir das nie vergessen.`,
        apply: (s2) => {
          done();
          if (!giveItem(s2, h, d.recipe)) return 'Das gute Stück ist inzwischen schon verkauft.';
          remember(s2, h, 'gift', { item: rc.name }); changeMood(h, 12); bump(h, 'joy');
          bio(s2, h, '🎁', `Bekam ${rc.name} von dir geschenkt.`, true);
          return fmt(`Du nimmst ${rc.name} aus dem Regal und drückst es {n} in die Hand. „Nimm. Bring es heil zurück.“ {Er} bringt kein Wort heraus.`, h);
        },
      }];
      if (h.gold >= half) opts.push({
        label: `Zum halben Preis (${half} Gold)`, desc: 'Eine Ausnahme unter Freunden.',
        apply: (s2) => {
          done();
          if (!giveItem(s2, h, d.recipe, half)) return 'Das gute Stück ist inzwischen schon verkauft.';
          changeTrust(h, 10); changeMood(h, 7);
          bio(s2, h, '✋', `Bekam ${rc.name} von dir zum halben Preis.`, true);
          return fmt('„Für dich mach ich eine Ausnahme.“ {n} schlägt ein, bevor du es dir anders überlegst.', h);
        },
      });
      opts.push({ label: 'Nichts sagen', desc: 'Geschäft ist Geschäft.', apply: () => { done(); return fmt('{n} steckt die Münzen wieder ein und geht.', h); } });
      return opts;
    },
  },

  // Frisch zurück und voller Geschichten
  story: {
    icon: '📣', title: 'Frisch vom Abenteuer',
    find(s, r) {
      const options = s.heroes.filter((h) => inVillage(h) && h.state !== 'injured' && h.tale && s.t - h.tale.t < 12 * H)
        .map((h) => ({ hero: h.id, area: h.tale.area, kind: h.tale.kind }));
      return options.length ? r.pick(options) : null;
    },
    text: (s, d) => {
      const h = hero(s, d.hero), a = AREAS[d.area];
      return fmt(d.kind === 'first'
        ? `{n} platzt in den Laden, noch ganz außer Atem: „Du glaubst nicht, was ${a.in} los war! ${a.foe} – und ich mittendrin. Und ich hab gewonnen!“`
        : `{n} lässt sich auf den Hocker vor deinem Tresen fallen: „Das war knapp ${a.in}. Um ein Haar …“ {Er} zeigt dir eine frische Schramme und grinst schief.`, h);
    },
    options: (s, d) => {
      const h = hero(s, d.hero);
      return [
        {
          label: '„Erzähl mehr!“', desc: `${first(h)} fühlt sich bestärkt und wagt in den nächsten Stunden mehr.`,
          apply: (s2) => {
            h.tale = null; remember(s2, h, 'listened', { area: d.area }); changeMood(h, 6);
            h.challengeUntil = Math.max(h.challengeUntil ?? 0, s2.t + 8 * H);
            return fmt('{n} erzählt mit Händen und Füßen. Am Ende steht der halbe Laden um euch herum.', h);
          },
        },
        {
          label: 'Zur Vorsicht mahnen', desc: `${first(h)} deckt sich mit einem Heiltrank ein, falls einer im Regal steht.`,
          apply: (s2) => {
            h.tale = null; remember(s2, h, 'cautioned');
            const eager = h.traits.some((t) => ['mutig', 'ruhmsuechtig', 'uebermuetig'].includes(t));
            changeMood(h, eager ? -2 : 3);
            const price = priceOf(s2, 'heiltrank');
            const got = h.potions === 0 && h.gold >= price && giveItem(s2, h, 'heiltrank', price);
            return fmt(got ? '„Hm. Hast ja recht.“ {n} legt Münzen auf den Tresen und steckt einen Heiltrank ein.'
              : eager ? '{n} verdreht die Augen. „Ja, ja.“' : '{n} nickt nachdenklich. „Ich pass auf mich auf.“', h);
          },
        },
        { label: 'Weiterarbeiten', desc: 'Du hast gerade anderes zu tun.', apply: () => { h.tale = null; changeMood(h, -1); return fmt('{n} erzählt die Geschichte eben in der Taverne.', h); } },
      ];
    },
  },

  // Zurück an den Ort der Niederlage – aber nicht ohne Heiltrank
  potionAsk: {
    icon: '🧪', title: 'Nicht ohne Heiltrank',
    find(s, r) {
      if (!s.shelf.some((it) => it.recipe === 'heiltrank')) return null;
      const price = priceOf(s, 'heiltrank');
      const options = [];
      for (const h of s.heroes) {
        if (h.state !== 'idle' || h.potions > 0 || h.gold >= price) continue;
        const m = recall(h, 'hurt', (x) => s.t - x.t < 7 * 24 * H);
        if (m) options.push({ hero: h.id, area: m.area });
      }
      return options.length ? r.pick(options) : null;
    },
    valid: (s) => s.shelf.some((it) => it.recipe === 'heiltrank'),
    text: (s, d) => fmt(`{n} dreht die leere Geldkatze um: „Ich will zurück ${AREAS[d.area].zu}. Aber nach dem letzten Mal nicht ohne Heiltrank – ` +
      'und ich bin blank. Hast du einen für mich?“', hero(s, d.hero)),
    options: (s, d) => {
      const h = hero(s, d.hero);
      const price = priceOf(s, 'heiltrank');
      const opts = [{
        label: 'Heiltrank schenken', desc: `Du verzichtest auf ${price} Gold.`,
        apply: (s2) => {
          if (!giveItem(s2, h, 'heiltrank')) return 'Der letzte Heiltrank ist inzwischen verkauft.';
          remember(s2, h, 'gift', { item: 'einen Heiltrank' }); changeMood(h, 6);
          bio(s2, h, '🎁', 'Bekam von dir einen Heiltrank geschenkt.', true);
          return fmt('Du schiebst {n} ein Fläschchen zu. „Komm heil wieder.“', h);
        },
      }];
      if (!h.debt) opts.push({
        label: 'Anschreiben', desc: `${first(h)} zahlt die ${price} Gold nach dem nächsten Abenteuer.`,
        apply: (s2) => {
          if (!giveItem(s2, h, 'heiltrank')) return 'Der letzte Heiltrank ist inzwischen verkauft.';
          h.debt = { amount: price, due: s2.t + 48 * H };
          remember(s2, h, 'loan'); changeMood(h, 3);
          return fmt('Du machst einen Strich auf der Schiefertafel. {n} nickt: „Kriegst du wieder.“', h);
        },
      });
      opts.push({ label: 'Leider nein', desc: 'Geschäft ist Geschäft.', apply: () => { changeMood(h, -2); changeTrust(h, -3); return fmt('{n} seufzt und bleibt vorerst im Dorf.', h); } });
      return opts;
    },
  },
};

// ---------- Ablauf ----------

export function requestFor(s, heroId) {
  return s.requests.find((q) => q.data.hero === heroId) ?? null;
}

export function requestOptions(s, q = s.requests[0]) {
  return q ? REQUESTS[q.type].options(s, q.data) : [];
}

export function requestValid(s, q) {
  if (!q || !REQUESTS[q.type]) return false;
  if (![q.data.hero, q.data.other].filter(Boolean).every((id) => hero(s, id))) return false;
  return REQUESTS[q.type].valid?.(s, q.data) ?? true;
}

// Antwortet einem Besucher. Gibt den Ergebnistext zurück (oder null, wenn es nicht ging).
export function resolveRequest(s, q, index, auto = false, r = makeRng(s)) {
  if (!q || !s.requests.includes(q)) return null;
  const drop = () => { s.requests = s.requests.filter((x) => x !== q); };
  if (!requestValid(s, q)) { drop(); return null; }
  const opt = requestOptions(s, q)[index];
  if (!opt) return null;
  if (opt.cost?.gold && s.gold < opt.cost.gold) return null;
  if (opt.cost?.gold) s.gold -= opt.cost.gold;
  const text = opt.apply(s, r);
  drop();
  // Wer vergeblich wartet, merkt sich das ein wenig
  if (auto) { const h = hero(s, q.data.hero); if (h) changeTrust(h, -2); }
  log(s, 'request', `${REQUESTS[q.type].icon} ${auto ? 'Du warst nicht da. ' : ''}${text}`, q.data.hero);
  return text;
}

export function processRequests(s, r) {
  for (const q of [...s.requests]) {
    if (!requestValid(s, q)) s.requests = s.requests.filter((x) => x !== q);
    else if (s.t >= q.expires) resolveRequest(s, q, requestOptions(s, q).length - 1, true, r);
  }
  const { minute } = clockOf(s);
  if (s.t < s.nextRequest || s.requests.length >= MAX_WAITING || isNight(s) || minute < 8 * 60 || minute >= 20 * 60) return;
  s.nextRequest = s.t + 60; // nichts Passendes? In einer Stunde wieder schauen
  const waiting = new Set(s.requests.flatMap((q) => [q.data.hero, q.data.other]).filter(Boolean));
  const taken = new Set(s.requests.map((q) => q.type));
  const types = Object.keys(REQUESTS).filter((t) => t !== s.lastRequestType && !taken.has(t));
  for (const type of types.sort(() => r() - 0.5)) {
    const data = REQUESTS[type].find(s, r);
    if (!data || waiting.has(data.hero) || waiting.has(data.other)) continue;
    s.requests.push({ type, data, t: s.t, expires: s.t + WAIT });
    s.lastRequestType = type;
    s.nextRequest = s.t + r.int(90, 3 * H);
    const h = hero(s, data.hero);
    log(s, 'request', `${REQUESTS[type].icon} ${fmt('{n} kommt zu dir an den Tresen.', h)}`, h.id, { pending: true });
    return;
  }
}
