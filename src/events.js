// Dorf-Ereignisse mit Entscheidungen. Jede Wahl verändert das Dorf meist für einige Stunden (Effekte).
// Die letzte Option ist die Vorgabe, falls du nicht rechtzeitig entscheidest.
//
// setup(s, r, api)      → data (wird im Spielstand gespeichert) – darf schon Effekte setzen
// text(d)               → Beschreibung
// options[].cost(s, d)  → { gold, mats: {}, potion } (optional)
// options[].apply(s, r, api, d) → Ergebnistext für die Chronik

import { MATERIALS, AREAS } from './data.js';

const H = 60;
const mat = (m) => `${MATERIALS[m].icon} ${MATERIALS[m].name}`;
const RARE_BY_TIER = ['wolfsfell', 'spinnenseide', 'mondkristall', 'trollknochen', 'drachenschuppe'];

export const EVENTS = [
  {
    id: 'karawane', icon: '🐪', title: 'Händlerkarawane', weight: 3,
    setup(s, r) {
      const m = r.pick(RARE_BY_TIER.slice(0, Math.min(5, s.buildings.schmiede + 1)));
      const qty = r.int(2, 4);
      return { m, qty, price: Math.round(MATERIALS[m].value * 1.6 * qty) };
    },
    text: (d) => `Eine Karawane aus dem Süden rastet vor dem Tor. Der Händler bietet **${d.qty}× ${mat(d.m)}** an – für ${d.price} 🪙. ` +
      'Außerdem hätte er Grundstoffe im Großeinkauf.',
    options: [
      {
        label: (d) => `${d.qty}× ${MATERIALS[d.m].name} kaufen`, cost: (s, d) => ({ gold: d.price }),
        apply: (s, r, api, d) => { s.mats[d.m] += d.qty; return `Du kaufst der Karawane **${d.qty}× ${mat(d.m)}** ab.`; },
      },
      {
        label: 'Großeinkauf: 15 Eisen, 10 Holz, 10 Stoff', cost: () => ({ gold: 90 }),
        apply: (s) => { s.mats.eisen += 15; s.mats.holz += 10; s.mats.stoff += 10; return 'Du füllst dein Lager mit Grundstoffen von der Karawane.'; },
      },
      { label: 'Weiterziehen lassen', apply: () => 'Die Karawane zieht weiter nach Norden.' },
    ],
  },
  {
    id: 'wolfsplage', icon: '🐺', title: 'Wolfsplage', weight: 2,
    text: () => 'Wölfe reißen nachts Schafe am Waldrand. Die Bauern bitten dich um Hilfe.',
    options: [
      {
        label: 'Prämie ausloben', desc: 'Finsterwald bringt 8 Std. lang 2,5× Gold. Ruf +3.', cost: () => ({ gold: 60 }),
        apply: (s, r, api) => {
          api.addEffect({ label: 'Wolfsprämie', icon: '🐺', dur: 8 * H, mods: [{ key: 'gold', v: 2.5, area: 'finsterwald' }] });
          s.reputation += 3;
          return 'Du lobst eine Prämie auf Wölfe aus. Die Helden schärfen ihre Klingen.';
        },
      },
      {
        label: 'Die Bauern vertrösten', desc: 'Finsterwald 8 Std. lang gefährlicher. Ruf −2.',
        apply: (s, r, api) => {
          api.addEffect({ label: 'Wolfsplage', icon: '🐺', dur: 8 * H, mods: [{ key: 'danger', v: 1.4, area: 'finsterwald' }] });
          s.reputation = Math.max(0, s.reputation - 2);
          return 'Die Bauern ziehen enttäuscht ab. Im Finsterwald werden die Wölfe dreister.';
        },
      },
    ],
  },
  {
    id: 'turnier', icon: '🏆', title: 'Turnier auf der Dorfwiese', weight: 2,
    cond: (s) => s.heroes.length >= 3,
    text: () => 'Ein fahrender Ritter ruft zum Turnier. Die Helden wollen sich das auf keinen Fall entgehen lassen – ' +
      'heute zieht so bald niemand los.',
    options: [
      {
        label: 'Preisgeld stiften', desc: '4 Std. Turnier, danach 12 Std. spendable Helden (+1 Preisstufe). Ruf +6.',
        cost: () => ({ gold: 100 }),
        apply: (s, r, api) => {
          api.addEffect({ label: 'Turnier', icon: '🏆', dur: 4 * H, mods: [{ key: 'depart', v: 0 }, { key: 'moodHour', v: 3 }] });
          api.addEffect({ label: 'Turnierruhm', icon: '✨', dur: 16 * H, mods: [{ key: 'priceTol', v: 1 }] });
          s.reputation += 6;
          return 'Dein Preisgeld macht das Turnier zum Ereignis des Jahres. Die Helden sind in Kauflaune.';
        },
      },
      {
        label: 'Nur zuschauen', desc: '3 Std. Turnier, niemand zieht los.',
        apply: (s, r, api) => {
          api.addEffect({ label: 'Turnier', icon: '🏆', dur: 3 * H, mods: [{ key: 'depart', v: 0 }] });
          return 'Das Turnier ist klein, aber die Helden haben ihren Spaß.';
        },
      },
    ],
  },
  {
    id: 'regen', icon: '🌧️', title: 'Dauerregen', weight: 2,
    setup(s, r, api) {
      api.addEffect({ label: 'Dauerregen', icon: '🌧️', dur: 10 * H, mods: [{ key: 'duration', v: 1.35 }, { key: 'moodHour', v: -1 }] });
      return {};
    },
    text: () => 'Seit Stunden schüttet es. Abenteuer dauern länger, die Laune sinkt. Mit etwas Stoff könntest du Regenmäntel nähen.',
    options: [
      {
        label: 'Regenmäntel nähen', desc: 'Verbraucht 6 Stoff, die Helden zahlen gut dafür. Ruf +2.',
        cost: () => ({ mats: { stoff: 6 } }),
        apply: (s, r, api) => {
          s.gold += 110; s.stats.earned += 110; s.reputation += 2;
          api.moodAll(4);
          return 'Deine Regenmäntel gehen weg wie warme Semmeln (+110 🪙).';
        },
      },
      { label: 'Abwarten', apply: () => 'Du wartest, bis der Regen nachlässt.' },
    ],
  },
  {
    id: 'eisenmangel', icon: '⛓️', title: 'Eisenmangel', weight: 2,
    setup(s, r, api) {
      api.addEffect({ label: 'Eisenmangel', icon: '⛓️', dur: 16 * H, mods: [{ key: 'matPrice', v: 3, mat: 'eisen' }] });
      return {};
    },
    text: () => 'Im Nachbartal ist eine Mine eingestürzt. Ab sofort kostet Eisen beim Händler das Dreifache – ' +
      'ein letzter Wagen zum alten Preis steht noch da.',
    options: [
      {
        label: '20 Eisen vom letzten Wagen', desc: 'Zum alten Preis.', cost: () => ({ gold: 80 }),
        apply: (s) => { s.mats.eisen += 20; return 'Du sicherst dir den letzten Wagen Eisen.'; },
      },
      { label: 'Abwarten', apply: () => 'Du hoffst, dass die Mine bald wieder öffnet.' },
    ],
  },
  {
    id: 'meisterschmied', icon: '⚒️', title: 'Wandernder Meisterschmied', weight: 2,
    text: () => 'Ein grauhaariger Zwerg bietet an, ein paar Stunden in deiner Schmiede mitzuarbeiten.',
    options: [
      {
        label: 'Anheuern', desc: '8 Std. lang wird 60 % schneller geschmiedet.', cost: () => ({ gold: 120 }),
        apply: (s, r, api) => {
          api.addEffect({ label: 'Meisterschmied', icon: '⚒️', dur: 8 * H, mods: [{ key: 'forge', v: 1.6 }] });
          return 'Der Zwerg krempelt die Ärmel hoch. Die Esse glüht wie nie.';
        },
      },
      { label: 'Ablehnen', apply: () => 'Der Zwerg zuckt mit den Schultern und zieht weiter.' },
    ],
  },
  {
    id: 'erntefest', icon: '🌾', title: 'Erntefest', weight: 2,
    text: () => 'Die Dorfbewohner wollen das Erntefest feiern und fragen, ob du etwas beisteuerst.',
    options: [
      {
        label: 'Großes Fest ausrichten', desc: 'Alle Helden Laune +20, aber 4 Std. zieht niemand los. Ruf +5.',
        cost: () => ({ gold: 80 }),
        apply: (s, r, api) => {
          api.moodAll(20);
          api.addEffect({ label: 'Erntefest', icon: '🎉', dur: 4 * H, mods: [{ key: 'depart', v: 0 }] });
          s.reputation += 5;
          return 'Ein rauschendes Fest! Die Helden tanzen bis in die Nacht.';
        },
      },
      {
        label: 'Ein Fass spendieren', desc: 'Alle Helden Laune +8.', cost: () => ({ gold: 20 }),
        apply: (s, r, api) => { api.moodAll(8); return 'Dein Fass Met wird mit Jubel begrüßt.'; },
      },
      {
        label: 'Nicht mitfeiern', desc: 'Laune −3.',
        apply: (s, r, api) => { api.moodAll(-3); return 'Das Fest fällt mager aus. Man tuschelt über den geizigen Ladenbesitzer.'; },
      },
    ],
  },
  {
    id: 'schatz', icon: '🗺️', title: 'Schatzgerücht', weight: 2,
    setup(s, r) {
      const options = Object.keys(AREAS).filter((a) => a !== 'kornfelder' && AREAS[a].danger <= 15 + s.buildings.schmiede * 15);
      return { area: r.pick(options.length ? options : ['finsterwald']) };
    },
    text: (d) => `Ein Betrunkener schwört, ${AREAS[d.area].in} liege ein vergessener Schatz. Er verkauft auch eine „echte“ Karte.`,
    options: [
      {
        label: 'Die Karte kaufen', desc: (d) => `10 Std.: ${AREAS[d.area].name} 3,5× Gold und 20 % weniger gefährlich.`,
        cost: () => ({ gold: 60 }),
        apply: (s, r, api, d) => {
          api.addEffect({ label: `Schatzkarte: ${AREAS[d.area].name}`, icon: '🗺️', dur: 10 * H,
            mods: [{ key: 'gold', v: 3.5, area: d.area }, { key: 'danger', v: 0.8, area: d.area }] });
          return `Du hängst die Karte ans Auftragsbrett. Alle reden nur noch von ${AREAS[d.area].name}.`;
        },
      },
      {
        label: 'Gerücht verbreiten', desc: (d) => `10 Std.: ${AREAS[d.area].name} 2× Gold.`,
        apply: (s, r, api, d) => {
          api.addEffect({ label: `Schatzgerücht: ${AREAS[d.area].name}`, icon: '🗺️', dur: 10 * H, mods: [{ key: 'gold', v: 2, area: d.area }] });
          return 'Das Gerücht macht in der Taverne die Runde.';
        },
      },
    ],
  },
  {
    id: 'fremder', icon: '🤕', title: 'Verletzter Fremder', weight: 2,
    text: () => 'Am Wegesrand liegt ein verwundeter Abenteurer. Mit Hilfe könnte er wieder auf die Beine kommen.',
    options: [
      {
        label: 'Einen Heiltrank geben', desc: 'Nimmt einen Heiltrank aus dem Regal. Er bleibt vielleicht.',
        cost: () => ({ potion: 1 }),
        apply: (s, r, api) => {
          const h = api.addHero(Math.max(2, Math.floor(Math.sqrt(s.reputation) / 2)));
          if (h) return `Der Fremde heißt **${h.name}** und bleibt aus Dankbarkeit in Eichenfurt.`;
          s.gold += 80;
          return 'Der Fremde bedankt sich mit einem Beutel Gold (+80 🪙) und zieht weiter – die Taverne ist voll.';
        },
      },
      {
        label: 'Zum Heiler bringen', desc: 'Halbe Chance, dass er bleibt.', cost: () => ({ gold: 40 }),
        apply: (s, r, api) => {
          if (r.chance(0.5)) {
            const h = api.addHero(Math.max(1, Math.floor(Math.sqrt(s.reputation) / 3)));
            if (h) return `Der Fremde – **${h.name}** – erholt sich und bleibt.`;
          }
          s.reputation += 2;
          return 'Der Fremde erholt sich, bedankt sich und zieht weiter. Ruf +2.';
        },
      },
      {
        label: 'Weitergehen', desc: 'Ruf −2.',
        apply: (s) => { s.reputation = Math.max(0, s.reputation - 2); return 'Du gehst weiter. Jemand hat es gesehen.'; },
      },
    ],
  },
  {
    id: 'goblins', icon: '👺', title: 'Goblin-Überfall droht', weight: 2,
    cond: (s) => !s.projects.wachturm && s.shelf.length > 0,
    text: () => 'Späher melden: Eine Goblinbande will heute Nacht dein Lager plündern!',
    options: [
      {
        label: 'Helden als Wachen bezahlen', desc: (d, s) => `15 🪙 je Held im Dorf. Sie bleiben 6 Std. hier. Ruf +4.`,
        cost: (s) => ({ gold: 15 * Math.max(1, s.heroes.filter((h) => h.state !== 'away').length) }),
        apply: (s, r, api) => {
          const here = s.heroes.filter((h) => h.state !== 'away');
          for (const h of here) { h.gold += 15; h.mood = Math.min(100, h.mood + 4); }
          api.addEffect({ label: 'Wache halten', icon: '🛡️', dur: 6 * H, mods: [{ key: 'depart', v: 0 }] });
          s.reputation += 4;
          return `${here.length} Helden stehen Wache. Die Goblins sehen das und verschwinden im Wald.`;
        },
      },
      {
        label: 'Stadtwache anfordern', cost: () => ({ gold: 90 }),
        apply: () => 'Die Stadtwache patrouilliert die ganze Nacht. Kein Goblin lässt sich blicken.',
      },
      {
        label: 'Riskieren', desc: 'Vielleicht kommen sie ja nicht …',
        apply: (s, r) => {
          if (r.chance(0.4)) return 'Die Goblins kamen nicht. Glück gehabt.';
          const n = Math.min(s.shelf.length, r.int(1, 3));
          const stolen = [];
          for (let i = 0; i < n; i++) stolen.push(s.shelf.splice(r.int(0, s.shelf.length - 1), 1)[0]);
          const gold = Math.round(s.gold * 0.1);
          s.gold -= gold;
          return `Goblins! Sie stehlen ${n} Waren aus dem Regal und ${gold} 🪙 aus der Kasse.`;
        },
      },
    ],
  },
  {
    id: 'kraeuterfrau', icon: '🧙‍♀️', title: 'Die Kräuterfrau', weight: 2,
    text: () => 'Die alte Kräuterfrau aus dem Moor kommt mit einem Korb voller Kräuter vorbei – und einem Rezept.',
    options: [
      {
        label: '15 Kräuter kaufen', cost: () => ({ gold: 15 }),
        apply: (s) => { s.mats.kraeuter += 15; return 'Du kaufst der Kräuterfrau den ganzen Korb ab.'; },
      },
      {
        label: 'Ihr Rezept lernen', desc: '24 Std. lang brauen sich Heiltränke doppelt so schnell.', cost: () => ({ gold: 50 }),
        apply: (s, r, api) => {
          api.addEffect({ label: 'Kräuterrezept', icon: '🧪', dur: 24 * H, mods: [{ key: 'potionTime', v: 0.5 }] });
          return 'Die Kräuterfrau verrät dir ihren Trick mit dem Mondwasser.';
        },
      },
      { label: 'Freundlich ablehnen', apply: () => 'Die Kräuterfrau humpelt zurück ins Moor.' },
    ],
  },
  {
    id: 'barde', icon: '🎶', title: 'Ein Barde in der Taverne', weight: 2,
    text: () => 'Ein Barde singt von den Taten der Helden aus Eichenfurt. Für ein paar Münzen würde er bleiben.',
    options: [
      {
        label: 'Bezahlen, damit er bleibt', desc: '12 Std.: Laune steigt, doppelt so viele Neuankömmlinge.', cost: () => ({ gold: 50 }),
        apply: (s, r, api) => {
          api.addEffect({ label: 'Barde', icon: '🎶', dur: 12 * H, mods: [{ key: 'moodHour', v: 2 }, { key: 'arrival', v: 2 }] });
          return 'Der Barde bleibt. Seine Lieder sprechen sich herum.';
        },
      },
      { label: 'Weiterziehen lassen', apply: () => 'Der Barde zieht mit seiner Laute weiter.' },
    ],
  },
  {
    id: 'konkurrenz', icon: '🛒', title: 'Konkurrenz am Markt', weight: 1,
    cond: (s) => s.stats.sold >= 5,
    setup(s, r, api) {
      api.addEffect({ label: 'Konkurrenz', icon: '🛒', dur: 12 * H, mods: [{ key: 'priceTol', v: -1 }], tag: 'konkurrenz' });
      return {};
    },
    text: () => 'Ein fahrender Waffenhändler baut am Markt seinen Stand auf. Die Helden vergleichen jetzt Preise – ' +
      'teure Ware bleibt liegen.',
    options: [
      {
        label: 'Ihn zum Weiterziehen bewegen', desc: 'Beendet die Konkurrenz sofort.', cost: () => ({ gold: 70 }),
        apply: (s, r, api) => { api.removeEffect('konkurrenz'); return 'Ein Beutel Gold, und der Händler hat es plötzlich eilig.'; },
      },
      { label: 'Konkurrenz belebt das Geschäft', desc: '12 Std. lang sind die Helden wählerischer.', apply: () => 'Du lässt ihn gewähren und senkst vielleicht ein paar Preise.' },
    ],
  },
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
