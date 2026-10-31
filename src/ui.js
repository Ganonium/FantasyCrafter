// Oberfläche: Tabs, Dialoge und Aktionen. Alles wird aus dem Spielstand neu gerendert.

import {
  MATERIALS, RECIPES, AREAS, TRAITS, BUILDINGS, PRICE_LEVELS, CLASSES, fairPrice, className,
} from './data.js';
import {
  clockOf, building, heroPower, successChance, evaluateAreas, priceOf, xpNeeded, canCraft, queueCraft,
  cancelQueued, buyMaterial, sellFromShelf, postBounty, cancelBounty, upgradeCost, canUpgrade, upgrade,
  activeEffects, resolveEvent, eventCost, canPay, acceptOrder, declineOrder, fillOrderFromShelf, currentGoal,
  buildProject, prioritizeQueued, craftTime, matPrice, areaDanger, afterAction,
} from './sim.js';
import { EVENT_BY_ID } from './events.js';
import { GOALS, PROJECTS } from './goals.js';
import { renderPortrait } from './sprites.js';

const KIND_ICON = {
  depart: '🚶', success: '✅', fail: '🤕', escape: '🧪', story: '📖', buy: '🛒', deliver: '📦', refuse: '💬',
  arrive: '👋', leave: '🚪', level: '⭐', banter: '🍺', craft: '🔨', bounty: '📋', build: '🏗️', info: '📜',
  event: '📯', order: '🧾', goal: '🎯',
};

const TABS = [
  { id: 'chronik', icon: '📜', name: 'Chronik' },
  { id: 'werkstatt', icon: '🔨', name: 'Werkstatt' },
  { id: 'laden', icon: '🏪', name: 'Laden' },
  { id: 'auftraege', icon: '📋', name: 'Aufträge' },
  { id: 'helden', icon: '🛡️', name: 'Helden' },
  { id: 'dorf', icon: '🏰', name: 'Dorf' },
];

const RARE = Object.keys(MATERIALS).filter((m) => !MATERIALS[m].basic);
const AREA_OF_MAT = Object.fromEntries(Object.entries(AREAS).filter(([, a]) => a.mat).map(([id, a]) => [a.mat, id]));

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function rich(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

export function fmtClock(minute) {
  const h = Math.floor(minute / 60), m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function fmtDuration(min) {
  min = Math.max(0, Math.round(min));
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
}

function matList(s, mats, checkStock = true) {
  return Object.entries(mats).map(([m, n]) => {
    const ok = !checkStock || s.mats[m] >= n;
    return `<span class="mat ${ok ? '' : 'missing'}">${MATERIALS[m].icon}${n}</span>`;
  }).join(' ');
}

function moodIcon(m) {
  return m >= 75 ? '😄' : m >= 50 ? '🙂' : m >= 30 ? '😐' : m >= 15 ? '😠' : '🤬';
}

function heroState(s, h) {
  if (h.state === 'away') return `unterwegs: ${AREAS[h.area].icon} ${AREAS[h.area].name} · zurück ca. ${fmtClock(clockOf(s, h.until).minute)}`;
  if (h.state === 'rest') return `ruht sich aus (bis ${fmtClock(clockOf(s, h.until).minute)})`;
  if (h.state === 'injured') return `verletzt 🩹 (bis ${fmtClock(clockOf(s, h.until).minute)})`;
  return 'in der Taverne';
}

function gearName(id) {
  return id ? `${RECIPES[id].name} <span class="tier">${'★'.repeat(RECIPES[id].tier)}</span>` : '<span class="dim">–</span>';
}

export class UI {
  constructor(game) {
    this.game = game; // { state, speed, setSpeed(), save(), newGame(), importData() }
    this.tab = 'chronik';
    this.bounty = { mat: 'wolfsfell', reward: 12, qty: 3 };
    this.recipeFilter = 'krieger';
    this.modal = null;
    this.$ = (sel) => document.querySelector(sel);
    this.buildNav();
    document.body.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('pointerdown', () => { this.pointerDown = true; });
    for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, () => setTimeout(() => { this.pointerDown = false; }, 0));
  }

  get s() { return this.game.state; }

  buildNav() {
    this.$('#nav').innerHTML = TABS.map((t) =>
      `<button data-act="tab" data-id="${t.id}" class="${t.id === this.tab ? 'active' : ''}"><span>${t.icon}</span>${t.name}</button>`).join('');
  }

  render() {
    const s = this.s;
    const c = clockOf(s);
    this.$('#gold').textContent = Math.floor(s.gold).toLocaleString('de-DE');
    this.$('#clock').textContent = `Tag ${c.day} · ${fmtClock(c.minute)}`;
    this.$('#speed').textContent = `${this.game.speed}×`;
    this.$('#speed').classList.toggle('fast', this.game.speed > 1);
    // Während des Antippens nicht neu rendern, sonst geht der Klick ins Leere
    if (this.pointerDown) return;
    const banner = this.bannerHtml(s);
    if (banner !== this.lastBanner) { this.lastBanner = banner; this.$('#banner').innerHTML = banner; }
    const html = this['tab_' + this.tab](s);
    if (html !== this.lastHtml) {
      this.lastHtml = html;
      this.$('#panel').innerHTML = html;
      if (this.tab === 'helden') this.paintMinis();
    }
    if (this.modal?.refresh) this.modal.refresh();
  }

  // ---------- Tabs ----------

  tab_chronik(s) {
    const entries = s.log.slice(-150).reverse();
    let day = null;
    let html = '';
    for (const e of entries) {
      const c = clockOf(s, e.t);
      if (c.day !== day) { day = c.day; html += `<h3 class="day">Tag ${day}</h3>`; }
      html += `<div class="entry k-${e.kind}" ${e.hero ? `data-act="hero" data-id="${e.hero}"` : ''}>
        <span class="time">${fmtClock(c.minute)}</span><span class="ico">${KIND_ICON[e.kind] ?? '•'}</span>
        <span class="txt">${rich(e.text)}</span></div>`;
    }
    return `${this.goalCard(s)}<section>${html || '<p class="dim">Noch ist nichts passiert.</p>'}</section>`;
  }

  bannerHtml(s) {
    let html = '';
    if (s.event) {
      const def = EVENT_BY_ID[s.event.id];
      html += `<button class="event-btn" data-act="event">${def.icon} <b>${def.title}</b><span>Entscheiden ›</span></button>`;
    }
    const offered = s.orders.filter((o) => o.state === 'offered').length;
    if (offered) html += `<button class="event-btn order" data-act="tab" data-id="auftraege">🧾 <b>${offered === 1 ? 'Neue Bestellanfrage' : `${offered} Bestellanfragen`}</b><span>Ansehen ›</span></button>`;
    const eff = activeEffects(s);
    if (eff.length) {
      html += `<div class="effects">${eff.map((e) => `<span class="effect" title="${esc(e.label)}">${e.icon} ${esc(e.label)} · ${fmtDuration(e.until - s.t)}</span>`).join('')}</div>`;
    }
    return html;
  }

  goalCard(s) {
    const g = currentGoal(s);
    if (!g) return `<div class="card goal"><div class="row"><b>🎯 Alle Ziele erreicht!</b></div><div class="small dim">Neue Ziele folgen in einer späteren Version.</div></div>`;
    const reward = Object.entries(g.reward).map(([k, n]) => (k === 'gold' ? `${n} 🪙` : `${n}× ${MATERIALS[k].icon}`)).join(', ');
    return `<div class="card goal"><div class="row"><b>🎯 ${g.text}</b><span class="small">${g.cur.toLocaleString('de-DE')}/${g.max.toLocaleString('de-DE')}</span></div>
      <div class="bar"><div style="width:${(g.cur / g.max) * 100}%"></div></div>
      <div class="small dim">Ziel ${s.goalIndex + 1} von ${GOALS.length} · Belohnung: ${reward}</div></div>`;
  }

  tab_werkstatt(s) {
    const smith = building(s, 'schmiede');
    const slots = s.slots.map((j, i) => {
      if (!j) return `<div class="slot empty">Werkplatz ${i + 1}: frei</div>`;
      const total = j.end - j.start;
      const pct = Math.min(100, ((s.t - j.start) / total) * 100);
      return `<div class="slot"><div class="row"><b>${RECIPES[j.recipe].name}${this.orderMark(s, j.recipe)}</b>
        <span class="dim">${j.blocked ? '⚠️ Regal voll!' : 'noch ' + fmtDuration(j.end - s.t)}</span></div>
        <div class="bar"><div style="width:${pct}%"></div></div></div>`;
    }).join('');
    const queue = s.queue.length
      ? `<div class="queue">${s.queue.map((q, i) => `<div class="qitem"><span>${i + 1}. ${RECIPES[q].name}${this.orderMark(s, q)}</span>
          <span>${i > 0 ? `<button class="chip" data-act="prio" data-i="${i}" title="nach vorn">⬆</button>` : ''}
          <button class="chip" data-act="unqueue" data-i="${i}" title="entfernen">✕</button></span></div>`).join('')}</div>`
      : '<p class="dim small">Warteschlange leer.</p>';

    const filters = [['krieger', '⚔️'], ['waldlaeufer', '🏹'], ['magier', '🔮'], ['trank', '🧪']];
    const tabs = `<div class="seg">${filters.map(([id, ic]) =>
      `<button data-act="rfilter" data-id="${id}" class="${this.recipeFilter === id ? 'active' : ''}">${ic} ${id === 'trank' ? 'Tränke' : CLASSES[id].nameM ?? CLASSES[id].name}</button>`).join('')}</div>`;

    const recipes = Object.entries(RECIPES).filter(([, r]) => (this.recipeFilter === 'trank' ? r.slot === 'potion' : r.cls === this.recipeFilter));
    const list = recipes.map(([id, r]) => {
      const locked = r.tier > smith.tier;
      const ok = canCraft(s, id) && s.queue.length < 10;
      return `<div class="recipe ${locked ? 'locked' : ''}">
        <div class="rtop"><b>${r.name}</b> <span class="tier">${'★'.repeat(r.tier)}</span>
          <span class="dim small">${r.slot === 'weapon' ? 'Waffe' : r.slot === 'armor' ? 'Rüstung' : 'Trank'} · ${fmtDuration(craftTime(s, id))} · ~${fairPrice(id)} 🪙</span></div>
        <div class="rbot"><span>${matList(s, r.mats)}</span>
          ${locked ? `<span class="dim small">🔒 Schmiede St. ${r.tier}</span>`
            : `<button data-act="craft" data-id="${id}" ${ok ? '' : 'disabled'}>Herstellen</button>`}</div>
        ${locked ? '' : this.interestHtml(s, id) + this.stockHtml(s, id)}</div>`;
    }).join('');

    const mats = Object.entries(MATERIALS).map(([id, m]) => `<div class="matrow">
      <span>${m.icon} ${m.name}</span><b>${s.mats[id]}</b>
      ${m.basic ? `<span class="buy"><button data-act="buymat" data-id="${id}" data-n="1" ${s.gold < matPrice(s, id) ? 'disabled' : ''}>+1</button>
        <button data-act="buymat" data-id="${id}" data-n="5" ${s.gold < matPrice(s, id) * 5 ? 'disabled' : ''}>+5</button>
        <span class="small ${matPrice(s, id) > m.price ? 'bad' : matPrice(s, id) < m.price ? 'ok' : 'dim'}">${matPrice(s, id)} 🪙</span></span>`
        : `<span class="dim small">nur über Kopfgeld</span>`}</div>`).join('');

    return `<section><h2>Werkplätze</h2>${slots}<h3>Warteschlange</h3>${queue}</section>
      <section><h2>Rezepte</h2>${tabs}${list}</section>
      <section><h2>Material <span class="dim small">· Händler</span></h2>${mats}</section>`;
  }

  tab_laden(s) {
    const cap = building(s, 'laden').shelf;
    const groups = {};
    for (const it of s.shelf) groups[it.recipe] = (groups[it.recipe] ?? 0) + 1;
    const ids = new Set([...Object.keys(groups), ...s.queue, ...s.slots.filter(Boolean).map((j) => j.recipe)]);
    const rows = [...ids].map((id) => {
      const r = RECIPES[id];
      const lvl = s.prices[id] ?? 1;
      const n = groups[id] ?? 0;
      const fair = fairPrice(id);
      const btns = PRICE_LEVELS.map((p, i) => `<button data-act="price" data-id="${id}" data-l="${i}" class="${i === lvl ? 'active' : ''}">
        ${p.name}<small>${Math.round(fair * p.mult)}</small></button>`).join('');
      const interest = this.interestHtml(s, id);
      return `<div class="card"><div class="row"><b>${r.name}</b> <span class="tier">${'★'.repeat(r.tier)}</span>
        <span>${n ? `${n}× im Regal` : '<span class="dim">in Arbeit</span>'}</span></div>
        <div class="seg prices">${btns}</div>${interest}
        ${n ? `<button class="link" data-act="sell" data-id="${id}">1 Stück an Händler verkaufen (${Math.floor(fair * 0.5)} 🪙)</button>` : ''}</div>`;
    }).join('');
    return `<section><h2>Regal <span class="dim small">${s.shelf.length}/${cap}</span></h2>
      <p class="small dim">Helden kaufen selbst, wenn ihnen Ware und Preis passen. Geizige Helden zahlen höchstens „Fair“,
      spendable auch mal Wucher – und Wucher drückt die Laune.</p>
      ${rows || '<p class="dim">Das Regal ist leer. Ab in die Werkstatt!</p>'}</section>
      <section><h2>Einnahmen</h2><div class="small">Verkauft: ${s.stats.sold} Waren · Reparaturen: ${s.stats.repairs ?? 0} 🪙 · gesamt ${s.stats.earned} 🪙</div></section>`;
  }

  tab_auftraege(s) {
    const active = s.bounties.map((b) => {
      const m = MATERIALS[b.mat];
      return `<div class="card"><div class="row"><b>${m.icon} ${m.name}</b><span>${b.reward} 🪙/Stück</span></div>
        <div class="bar"><div style="width:${(b.delivered / b.qty) * 100}%"></div></div>
        <div class="row small"><span>${b.delivered}/${b.qty} geliefert · ${AREAS[AREA_OF_MAT[b.mat]].icon} ${AREAS[AREA_OF_MAT[b.mat]].name}</span>
        <button class="link" data-act="unbounty" data-id="${b.id}">zurückziehen</button></div></div>`;
    }).join('');

    const f = this.bounty;
    const area = AREA_OF_MAT[f.mat];
    const a = AREAS[area];
    const cost = f.reward * f.qty;
    const matBtns = RARE.map((m) => `<button data-act="bmat" data-id="${m}" class="${f.mat === m ? 'active' : ''}">${MATERIALS[m].icon}<small>${MATERIALS[m].name}</small></button>`).join('');
    const opinions = s.heroes.map((h) => {
      const ev = evaluateAreas(s, h).find((e) => e.id === area);
      const p = Math.round(successChance(h, area, s) * 100);
      let verdict;
      if (ev.block === 'hated') verdict = '<span class="bad">hasst das Gebiet</span>';
      else if (ev.block === 'danger') verdict = `<span class="bad">zu gefährlich</span>`;
      else verdict = '<span class="ok">würde gehen</span>';
      return `<div class="row small"><span>${esc(h.name)}</span><span>${p}% · ${verdict}</span></div>`;
    }).join('');
    return `${this.ordersHtml(s)}<section><h2>Kopfgelder</h2>${active || '<p class="dim">Keine Kopfgelder ausgehängt.</p>'}</section>
      <section><h2>Neues Kopfgeld</h2>
        <div class="seg mats">${matBtns}</div>
        <p class="small">${a.icon} <b>${a.name}</b> · Gefahr ${Math.round(areaDanger(s, area))} · Dauer ca. ${fmtDuration(a.time)} · Marktwert ~${MATERIALS[f.mat].value} 🪙</p>
        <div class="row"><span>Belohnung pro Stück</span><span class="step">
          <button data-act="bstep" data-k="reward" data-d="-5">−5</button><button data-act="bstep" data-k="reward" data-d="-1">−</button>
          <b>${f.reward} 🪙</b>
          <button data-act="bstep" data-k="reward" data-d="1">+</button><button data-act="bstep" data-k="reward" data-d="5">+5</button></span></div>
        <div class="row"><span>Anzahl</span><span class="step">
          <button data-act="bstep" data-k="qty" data-d="-1">−</button><b>${f.qty}</b><button data-act="bstep" data-k="qty" data-d="1">+</button></span></div>
        <div class="row"><span class="small dim">Wird sofort hinterlegt und bei Lieferung ausgezahlt.</span>
          <button data-act="post" ${s.gold < cost ? 'disabled' : ''}>Aushängen (${cost} 🪙)</button></div>
      </section>
      <section><h2>Was die Helden davon halten</h2>${opinions}
        <p class="small dim">Ob sie wirklich gehen, entscheiden sie selbst – nach Laune, Tagesform, Gier und Mut.</p></section>`;
  }

  // Welche Helden hätten gern dieses Rezept? (Laden und Werkstatt)
  interestHtml(s, id) {
    const r = RECIPES[id];
    const price = priceOf(s, id);
    if (r.slot === 'potion') {
      const without = s.heroes.filter((h) => h.potions === 0);
      return without.length
        ? `<div class="small interest">Ohne Heiltrank: ${without.map((h) => `<span class="${h.gold >= price * 1.5 ? 'ok' : 'dim'}">${esc(h.name.split(' ')[0])}</span>`).join(', ')}</div>`
        : '<div class="small dim interest">Alle Helden haben einen Heiltrank dabei.</div>';
    }
    const fans = s.heroes.filter((h) => h.cls === r.cls && (h[r.slot] ? RECIPES[h[r.slot]].tier : 0) < r.tier);
    return fans.length
      ? `<div class="small interest">Interesse: ${fans.map((h) => `<span class="${h.gold >= price ? 'ok' : 'dim'}">${esc(h.name.split(' ')[0])} (${Math.floor(h.gold)} 🪙)</span>`).join(', ')}</div>`
      : '<div class="small dim interest">Gerade braucht das niemand.</div>';
  }

  stockHtml(s, id) {
    const shelf = s.shelf.filter((x) => x.recipe === id).length;
    const work = s.queue.filter((x) => x === id).length + s.slots.filter((j) => j?.recipe === id).length;
    const parts = [];
    if (shelf) parts.push(`${shelf} im Regal`);
    if (work) parts.push(`${work} in Arbeit`);
    return parts.length ? `<div class="small dim">📦 ${parts.join(' · ')}</div>` : '';
  }

  orderMark(s, recipe) {
    return s.orders.some((o) => o.state === 'active' && o.lines.some((l) => l.recipe === recipe && l.filled < l.qty)) ? ' <span title="für eine Bestellung">🧾</span>' : '';
  }

  ordersHtml(s) {
    const cards = s.orders.map((o) => {
      const lines = o.lines.map((l) => {
        const onShelf = s.shelf.filter((x) => x.recipe === l.recipe).length;
        return `<div class="row small"><span>${l.filled >= l.qty ? '✅' : '▫️'} ${l.qty}× ${RECIPES[l.recipe].name} <span class="tier">${'★'.repeat(RECIPES[l.recipe].tier)}</span></span>
          <span>${o.state === 'active' ? `${l.filled}/${l.qty}` : ''}${onShelf && l.filled < l.qty ? ` <span class="dim">(${onShelf} im Regal)</span>` : ''}</span></div>`;
      }).join('');
      const head = `<div class="row"><b>${o.icon} ${esc(o.client)}</b><span class="gold-txt">${o.reward} 🪙</span></div>`;
      if (o.state === 'offered') {
        return `<div class="card order offered">${head}<div class="small quote">„${esc(o.intro)}“</div>${lines}
          <div class="small dim">Frist nach Annahme: ${fmtDuration(o.duration)} · Ruf +${o.rep} (bei Verspätung −${o.rep}) · Angebot gilt noch ${fmtDuration(o.offerUntil - s.t)}</div>
          <div class="row"><button class="link" data-act="decline" data-id="${o.id}">Ablehnen</button><button data-act="accept" data-id="${o.id}">Annehmen</button></div></div>`;
      }
      const left = o.deadline - s.t;
      const canFill = o.lines.some((l) => l.filled < l.qty && s.shelf.some((x) => x.recipe === l.recipe));
      return `<div class="card order">${head}${lines}
        <div class="row small"><span class="${left < 180 ? 'bad' : 'dim'}">⏳ noch ${fmtDuration(left)} (bis Tag ${clockOf(s, o.deadline).day}, ${fmtClock(clockOf(s, o.deadline).minute)})</span>
        ${canFill ? `<button data-act="fill" data-id="${o.id}">Aus dem Regal nehmen</button>` : ''}</div></div>`;
    }).join('');
    return `<section><h2>Bestellungen</h2>
      ${cards || '<p class="dim small">Gerade keine Bestellungen. Auftraggeber melden sich ab und zu.</p>'}
      <p class="small dim">Fertige Ware für angenommene Bestellungen kommt nicht ins Regal, sondern wird direkt zurückgelegt.
      Die Reihenfolge in der Warteschlange entscheidet, was zuerst fertig ist.</p></section>`;
  }

  tab_helden(s) {
    const cap = building(s, 'taverne').heroes;
    const cards = s.heroes.map((h) => `<div class="hero card" data-act="hero" data-id="${h.id}">
      <canvas class="mini" width="54" height="81" data-portrait="${h.id}"></canvas>
      <div class="hinfo"><div class="row"><b>${esc(h.name)}</b><span>${moodIcon(h.mood)} ${Math.floor(h.gold)} 🪙</span></div>
        <div class="small">${className(h.cls, h.female)} · Stufe ${h.level} · Kraft ${heroPower(h)}</div>
        <div class="small dim">${heroState(s, h)}</div>
        <div class="thought">„${esc(h.thought)}“</div></div></div>`).join('');
    return `<section><h2>Helden <span class="dim small">${s.heroes.length}/${cap}</span></h2>${cards}</section>`;
  }

  paintMinis() {
    for (const c of document.querySelectorAll('canvas[data-portrait]')) {
      const h = this.s.heroes.find((x) => x.id === Number(c.dataset.portrait));
      if (h) renderPortrait(c, h, performance.now());
    }
  }

  tab_dorf(s) {
    const bs = Object.entries(BUILDINGS).map(([id, b]) => {
      const lvl = s.buildings[id];
      const cost = upgradeCost(s, id);
      const next = b.levels[lvl];
      const costStr = cost ? Object.entries(cost).map(([k, n]) => k === 'gold' ? `${n} 🪙` : `${MATERIALS[k].icon}${n}`).join(' ') : '';
      return `<div class="card"><div class="row"><b>${b.icon} ${b.name}</b><span>Stufe ${lvl}/${b.levels.length}</span></div>
        <div class="small">${b.levels[lvl - 1].desc}</div>
        ${next ? `<div class="row small"><span class="dim">Nächste: ${next.desc}</span>
          <button data-act="upgrade" data-id="${id}" ${canUpgrade(s, id) ? '' : 'disabled'}>${costStr}</button></div>` : '<div class="small ok">Voll ausgebaut</div>'}</div>`;
    }).join('');
    const areas = Object.entries(AREAS).map(([id, a]) => {
      const best = s.heroes.length ? Math.max(...s.heroes.map((h) => successChance(h, id, s))) : 0;
      return `<div class="row small"><span>${a.icon} ${a.name}</span><span class="dim">Gefahr ${Math.round(areaDanger(s, id))} · ${a.mat ? MATERIALS[a.mat].icon : '🪙'}</span>
        <span>beste Chance ${Math.round(best * 100)}%</span></div>`;
    }).join('');
    const projects = Object.entries(PROJECTS).map(([id, p]) => {
      const done = s.projects[id] !== undefined;
      return `<div class="card project ${done ? 'done' : ''}"><div class="row"><b>${p.icon} ${p.name}</b>
        ${done ? '<span class="ok small">errichtet</span>' : `<button data-act="project" data-id="${id}" ${s.gold < p.cost ? 'disabled' : ''}>${p.cost.toLocaleString('de-DE')} 🪙</button>`}</div>
        <div class="small ${done ? 'dim' : ''}">${p.desc}</div></div>`;
    }).join('');
    return `${this.goalCard(s)}<section><h2>Gebäude</h2>${bs}</section>
      <section><h2>Dorfprojekte</h2><p class="small dim">Einmalige Investitionen mit dauerhaftem Nutzen.</p>${projects}</section>
      <section><h2>Umgebung</h2>${areas}</section>
      <section><h2>Ruf</h2><p class="small">Ruf des Dorfes: <b>${s.reputation}</b>. Je besser dein Ruf, desto öfter und desto erfahrenere Helden kommen.</p></section>`;
  }

  // ---------- Dialoge ----------

  openModal(html, opts = {}) {
    this.$('#modal-body').innerHTML = html;
    this.$('#modal').hidden = false;
    this.modal = opts;
  }

  closeModal() {
    this.$('#modal').hidden = true;
    this.modal = null;
    this.game.onModalClose?.();
  }

  showHero(id) {
    const s = this.s;
    const h = s.heroes.find((x) => x.id === id);
    if (!h) return;
    this.game.selectHero?.(id);
    const body = () => {
      const evals = evaluateAreas(s, h);
      const areas = evals.map((e) => {
        const a = AREAS[e.id];
        const why = e.block === 'hated' ? '<span class="bad">hasst es</span>' : e.block === 'danger' ? '<span class="bad">zu gefährlich</span>' : '<span class="ok">traut sich</span>';
        return `<div class="row small"><span>${a.icon} ${a.name}${h.fav === e.id ? ' ❤️' : ''}</span><span>${Math.round(e.p * 100)}% · ${why}</span></div>`;
      }).join('');
      const recent = s.log.filter((e) => e.hero === h.id).slice(-6).reverse()
        .map((e) => `<div class="entry small"><span class="time">${fmtClock(clockOf(s, e.t).minute)}</span><span class="txt">${rich(e.text)}</span></div>`).join('');
      return `<div class="herohead"><canvas id="portrait" width="144" height="216"></canvas>
        <div><h2>${esc(h.name)}</h2>
          <div>${CLASSES[h.cls].icon} ${className(h.cls, h.female)} · Stufe ${h.level}</div>
          <div class="bar xp"><div style="width:${(h.xp / xpNeeded(h.level)) * 100}%"></div></div>
          <div class="small">Kraft <b>${heroPower(h)}</b> · ${Math.floor(h.gold)} 🪙 · Laune ${moodIcon(h.mood)} ${h.mood}</div>
          <div class="small dim">${heroState(s, h)}</div>
          <div class="small">Abenteuer: ${h.successes}/${h.adventures} erfolgreich</div></div></div>
        <div class="thought big">„${esc(h.thought)}“</div>
        <h3>Ausrüstung</h3>
        <div class="row small"><span>Waffe</span><span>${gearName(h.weapon)}</span></div>
        <div class="row small"><span>Rüstung</span><span>${gearName(h.armor)}</span></div>
        <div class="row small"><span>Heiltränke</span><span>${h.potions}</span></div>
        <h3>Wesen</h3>
        ${h.traits.map((t) => `<div class="small"><b>${TRAITS[t].name}</b> – ${TRAITS[t].desc}</div>`).join('')}
        <div class="small">Liebt: ${AREAS[h.fav].icon} ${AREAS[h.fav].name}${h.hated ? ` · Hasst: ${AREAS[h.hated].icon} ${AREAS[h.hated].name}` : ''}</div>
        <h3>Einschätzung der Gebiete</h3>${areas}
        <h3>Zuletzt</h3>${recent || '<p class="dim small">–</p>'}`;
    };
    const paint = () => { const c = document.getElementById('portrait'); if (c) renderPortrait(c, h, performance.now()); };
    this.modalHtml = body();
    this.openModal(this.modalHtml);
    paint();
    this.modal = {
      refresh: () => {
        if (!s.heroes.includes(h)) return this.closeModal();
        const html = body();
        if (html !== this.modalHtml) {
          this.modalHtml = html;
          const scroll = this.$('#modal-body').scrollTop;
          this.$('#modal-body').innerHTML = html;
          this.$('#modal-body').scrollTop = scroll;
        }
        paint();
      },
    };
  }

  showReport(before, minutes, info) {
    const s = this.s;
    const entries = s.log.filter((e) => e.t > before.t).reverse();
    const sold = s.stats.sold - before.sold;
    const goldDiff = Math.floor(s.gold - before.gold);
    const adv = s.stats.adventures - before.adventures;
    const succ = s.stats.successes - before.successes;
    const list = entries.slice(0, 80).map((e) => `<div class="entry k-${e.kind}"><span class="time">${fmtClock(clockOf(s, e.t).minute)}</span>
      <span class="ico">${KIND_ICON[e.kind] ?? '•'}</span><span class="txt">${rich(e.text)}</span></div>`).join('');
    this.openModal(`<h2>Während du fort warst …</h2>
      <p class="small dim">${fmtDuration(minutes)} Spielzeit vergangen${info.capped ? ` (begrenzt durch das Lagerhaus)` : ''}.</p>
      <div class="stats"><div><b>${goldDiff >= 0 ? '+' : ''}${goldDiff}</b>🪙 Gold</div><div><b>${sold}</b>verkauft</div>
      <div><b>${succ}/${adv}</b>Abenteuer</div></div>
      ${s.event ? `<button class="event-btn" data-act="event">${EVENT_BY_ID[s.event.id].icon} <b>${EVENT_BY_ID[s.event.id].title}</b><span>Entscheidung nötig ›</span></button>` : ''}
      ${s.orders.some((o) => o.state === 'offered') ? `<button class="event-btn order" data-act="tab" data-id="auftraege">🧾 <b>Bestellanfrage wartet</b><span>Ansehen ›</span></button>` : ''}
      ${list || '<p class="dim">Ruhige Zeiten in Eichenfurt.</p>'}
      ${entries.length > 80 ? `<p class="small dim">… und ${entries.length - 80} weitere Einträge in der Chronik.</p>` : ''}
      <button class="wide" data-act="close">Weiter</button>`);
  }

  showEvent() {
    const s = this.s;
    const ev = s.event;
    if (!ev) return this.closeModal();
    const def = EVENT_BY_ID[ev.id];
    const val = (x) => (typeof x === 'function' ? x(ev.data, s) : x);
    const opts = def.options.map((o, i) => {
      const cost = eventCost(s, ev, o);
      const parts = [];
      if (cost.gold) parts.push(`${cost.gold} 🪙`);
      for (const [m, n] of Object.entries(cost.mats ?? {})) parts.push(`${n}× ${MATERIALS[m].icon}`);
      if (cost.potion) parts.push(`${cost.potion}× Heiltrank aus dem Regal`);
      const ok = canPay(s, cost);
      return `<button class="option" data-act="choose" data-i="${i}" ${ok ? '' : 'disabled'}>
        <b>${esc(val(o.label))}</b>${parts.length ? `<span class="cost">${parts.join(' · ')}</span>` : ''}
        ${o.desc ? `<small>${esc(val(o.desc))}</small>` : ''}</button>`;
    }).join('');
    const fallback = val(def.options[def.options.length - 1].label);
    this.openModal(`<h2>${def.icon} ${def.title}</h2>
      <p>${rich(def.text(ev.data))}</p>
      <div class="options">${opts}</div>
      <p class="small dim">Entscheide bis ${fmtClock(clockOf(s, ev.expires).minute)} Uhr (noch ${fmtDuration(ev.expires - s.t)}), sonst: „${esc(fallback)}“.</p>
      <button class="wide link" data-act="close">Später entscheiden</button>`);
  }

  showSettings() {
    const speeds = [1, 10, 60, 300];
    this.openModal(`<h2>Einstellungen</h2>
      <h3>Spieltempo</h3>
      <div class="seg">${speeds.map((v) => `<button data-act="speed" data-v="${v}" class="${this.game.speed === v ? 'active' : ''}">${v}×</button>`).join('')}</div>
      <p class="small dim">1× ist das echte Tempo (Abenteuer dauern 30 Min. bis 4 Std.). Höhere Stufen sind zum Testen da.
      Auch per URL: <code>?speed=60</code></p>
      <h3>Spielstand</h3>
      <p class="small dim">Der Spielstand liegt nur in diesem Browser. Mit dem Code kannst du ihn sichern oder auf ein anderes Gerät mitnehmen.</p>
      <div class="row"><button data-act="export">Code anzeigen</button><button data-act="import">Code laden</button></div>
      <textarea id="savecode" rows="4" placeholder="Spielstand-Code"></textarea>
      <h3>Neu beginnen</h3>
      <button class="danger" data-act="reset">Spielstand löschen &amp; neu starten</button>
      <button class="wide" data-act="close">Schließen</button>`);
  }

  toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  // ---------- Aktionen ----------

  onClick(e) {
    if (e.target.id === 'modal') return this.closeModal();
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const s = this.s;
    const id = el.dataset.id;
    switch (el.dataset.act) {
      case 'tab': this.tab = id; this.buildNav(); this.$('#panel').scrollTop = 0; if (this.modal) this.closeModal(); break;
      case 'settings': return this.showSettings();
      case 'close': return this.closeModal();
      case 'hero': return this.showHero(Number(id));
      case 'rfilter': this.recipeFilter = id; break;
      case 'craft': if (!queueCraft(s, id)) this.toast('Nicht genug Material oder Warteschlange voll.'); break;
      case 'unqueue': cancelQueued(s, Number(el.dataset.i)); break;
      case 'prio': prioritizeQueued(s, Number(el.dataset.i)); break;
      case 'event': return this.showEvent();
      case 'choose':
        if (resolveEvent(s, Number(el.dataset.i))) { this.closeModal(); this.toast('Entschieden!'); }
        break;
      case 'accept': if (acceptOrder(s, Number(id))) this.toast('Bestellung angenommen.'); break;
      case 'decline': declineOrder(s, Number(id)); break;
      case 'fill': fillOrderFromShelf(s, Number(id)); break;
      case 'project': if (buildProject(s, id)) this.toast(`${PROJECTS[id].name} errichtet!`); break;
      case 'buymat': buyMaterial(s, id, Number(el.dataset.n)); break;
      case 'price': s.prices[id] = Number(el.dataset.l); break;
      case 'sell': {
        const idx = s.shelf.findIndex((x) => x.recipe === id);
        if (idx >= 0) sellFromShelf(s, idx);
        break;
      }
      case 'bmat': this.bounty.mat = id; this.bounty.reward = Math.round(MATERIALS[id].value * 1.2); break;
      case 'bstep': {
        const k = el.dataset.k;
        this.bounty[k] = Math.max(1, Math.min(k === 'qty' ? 20 : 999, this.bounty[k] + Number(el.dataset.d)));
        break;
      }
      case 'post':
        if (postBounty(s, this.bounty.mat, this.bounty.reward, this.bounty.qty)) this.toast('Kopfgeld ausgehängt!');
        break;
      case 'unbounty': cancelBounty(s, Number(id)); break;
      case 'upgrade': upgrade(s, id); break;
      case 'speed': this.game.setSpeed(Number(el.dataset.v)); this.showSettings(); break;
      case 'export': this.$('#savecode').value = this.game.exportCode(); this.$('#savecode').select(); break;
      case 'import':
        try { this.game.importCode(this.$('#savecode').value); this.closeModal(); this.toast('Spielstand geladen.'); }
        catch (err) { this.toast('Ungültiger Code.'); }
        break;
      case 'reset':
        if (confirm('Wirklich alles löschen und neu anfangen?')) { this.game.reset(); this.closeModal(); }
        break;
      default: return;
    }
    afterAction(s);
    this.game.save();
    this.pointerDown = false;
    this.render();
  }
}
