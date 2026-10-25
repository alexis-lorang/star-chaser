import { PLACES, DEFAULT_PLACE, MODELS, SKIES, PLANETS, meteobluePage } from './config.js?v=5';
import {
  fetchForecast, cachedForecast, computeHours, hourScore, nightScore, scoreClass, clearSky, qClass, seeingQ, jetQ,
} from './seeing.js?v=5';
import { observer, upcomingNights, skyAt, planetsTonight, geomagLat } from './astro.js?v=5';
import {
  fetchAurora, fetchSolarWind, fetchOvation, thresholds, kpChance, kpLabel, chanceClass, gScale,
} from './aurora.js?v=5';
import { evaluateAll, activeTonight, yearSpans, SHOWERS, meteorClass } from './meteors.js?v=5';
import { solarEclipses, lunarEclipses, planetEvents, moonEvents, fetchTLEs, satellitePasses, compass } from './events.js?v=5';
import { icon, moonGlyph } from './icons.js?v=5';
import { nightScene, auroraScene, meteorScene, eventScene } from './scene.js?v=5';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const H1 = 3600e3, DAY = 86400e3;
const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtWd = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
const fmtWdLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });
const fmtDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDM = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const fmtDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const fmtMonthShort = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const fmtMonthLong = new Intl.DateTimeFormat('fr-FR', { month: 'long' });
const hm = (t) => (t == null ? '–' : fmtTime.format(new Date(t)));
const hh = (t) => `${new Date(t).getHours()} h`;
const num1 = (x) => (x == null ? '–' : x.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const num = (x, d = 1) => (x == null || Number.isNaN(x) ? '–' : x.toLocaleString('fr-FR', { maximumFractionDigits: d }));
const int = (x) => (x == null || Number.isNaN(x) ? '–' : `${Math.round(x)}`);
const mag = (m) => (m == null ? '–' : (m < 0 ? `−${num(Math.abs(m))}` : num(m)));
const pct = (x) => `${Math.round(x * 100)} %`;

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

const TABS = ['seeing', 'aurora', 'meteors', 'events'];
const state = {
  tab: 'seeing',
  place: (() => { try { return JSON.parse(store.get('sc-place', 'null')) || DEFAULT_PLACE; } catch { return DEFAULT_PLACE; } })(),
  model: store.get('sc-model', 'consensus'),
  sky: store.get('sc-sky', 'rural'),
  themePref: store.get('sc-theme', 'auto'),
  evFilter: 'all',
  showMinor: store.get('sc-minor', '0') === '1',
  fc: null, hours: null, nights: null, night: 0, loading: false, error: null,
  au: null, auError: null, sw: null, swError: null, ov: null, ovError: null,
  meteors: null, events: null, passes: null, passError: null,
  rendered: {},
};
if (!MODELS[state.model]) state.model = 'consensus';
if (!SKIES[state.sky]) state.sky = 'rural';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const prefersLight = matchMedia('(prefers-color-scheme: light)');
const THEMES = { auto: 'Automatique', light: 'Clair', dark: 'Sombre' };
if (!THEMES[state.themePref]) state.themePref = 'auto';
const currentTheme = () => (state.themePref === 'auto' ? (prefersLight.matches ? 'light' : 'dark') : state.themePref);

function applyTheme() {
  const t = currentTheme();
  if (document.documentElement.dataset.theme === t) return;
  document.documentElement.dataset.theme = t;
  $('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#eef2ff' : '#0b0f24');
  if (state.ov) drawMap();
}
prefersLight.addEventListener('change', () => { if (state.themePref === 'auto') applyTheme(); });
const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

// ---------- Petits composants ----------

// Jauge en demi-cercle : quatre segments aux seuils de l'indice (20, 40, 65), curseur sur la valeur.
const GAUGE_SEGS = [['low', 0, 20], ['maybe', 20, 40], ['good', 40, 65], ['top', 65, 100]];
function gauge(score, size = '', unit = 'sur 100') {
  const pt = (v) => {
    const a = ((180 - v * 1.8) * Math.PI) / 180;
    return [70 + 56 * Math.cos(a), 70 - 56 * Math.sin(a)].map((x) => x.toFixed(2));
  };
  const arcs = GAUGE_SEGS.map(([k, a0, a1], i) => {
    const [x0, y0] = pt(a0 + (i ? 1 : 0)), [x1, y1] = pt(a1 - (i < 3 ? 1 : 0));
    return `<path d="M${x0} ${y0} A56 56 0 0 1 ${x1} ${y1}" class="g-seg g-${k}"${i === 0 || i === 3 ? ' stroke-linecap="round"' : ''}/>`;
  }).join('');
  return `<div class="gauge ${size}${score == null ? ' na' : ''}" role="img" aria-label="Indice ${score ?? 'indisponible'} sur 100">
    <svg viewBox="0 0 140 84" aria-hidden="true">${arcs}<g class="g-knob-g" style="--r:${((score ?? 0) * 1.8).toFixed(1)}deg"><circle class="g-knob" cx="14" cy="70" r="9"/></g></svg>
    <b data-count="${score ?? ''}" aria-hidden="true">${score ?? '–'}</b>${size ? '' : `<small aria-hidden="true">${unit}</small>`}
  </div>`;
}

const scaleLegend = (items, label) => `<div class="scale" role="img" aria-label="${label}" style="--n:${items.length}">
    <div class="scale-bar" aria-hidden="true">${items.map(([cls, , col]) => `<i class="${cls ?? ''}"${col ? ` style="background:${col}"` : ''}></i>`).join('')}</div>
    <div class="scale-lbl" aria-hidden="true">${items.map(([, l]) => `<span>${l}</span>`).join('')}</div>
  </div>`;

function spinner(cls = '') {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 * Math.PI) / 180;
    const [x1, y1, x2, y2] = [12 + Math.sin(a) * 5, 12 - Math.cos(a) * 5, 12 + Math.sin(a) * 9.5, 12 - Math.cos(a) * 9.5];
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" style="--o:${(1 - i * 0.11).toFixed(2)}"/>`;
  }).join('');
  return `<svg class="spinner ${cls}" viewBox="0 0 24 24" aria-hidden="true">${rays}</svg>`;
}

const cardHead = (ic, title, extra = '') => `<div class="card-head">${icon(ic)}<span>${title}</span>${extra}</div>`;
const helpBtn = (action, label) => `<button class="help-btn" data-action="${action}" aria-label="${label}"><span aria-hidden="true">?</span></button>`;
const sectionHead = (title, sub = '') => `<div class="section-head"><h2>${title}</h2>${sub ? `<span class="section-sub">${sub}</span>` : ''}</div>`;

function errorCard(msg, action = 'refresh') {
  return `<div class="card error-card">
    ${icon('alert')}
    <b>Données indisponibles</b>
    <p>${msg}</p>
    <button class="pill-btn tap" data-action="${action}">${icon('refresh')}Réessayer</button>
  </div>`;
}
const skeleton = () => `<div class="card hero skel"><div class="hero-scene shimmer"></div><div class="hero-info"><i class="sk w40"></i><i class="sk w60"></i></div></div>
  <div class="card skel mid shimmer"></div><div class="card skel tall shimmer"></div>`;

// Délai en mots : « aujourd'hui », « demain », « dans 12 jours », « dans 4 mois ».
function countdown(t) {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(t); b.setHours(0, 0, 0, 0);
  const d = Math.round((b - a) / DAY);
  if (d <= 0) return t < Date.now() ? 'en cours' : 'aujourd’hui';
  if (d === 1) return 'demain';
  if (d < 60) return `dans ${d} jours`;
  if (d < 730) return `dans ${Math.round(d / 30.4)} mois`;
  return `dans ${Math.round(d / 365.25)} ans`;
}

// ---------- Nuits ----------

const todayNoon = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime(); };
const nightOffset = (n) => Math.round((n.noon - todayNoon()) / DAY);
function nightLabel(n) {
  const k = nightOffset(n);
  if (k < 0) return 'Cette nuit';
  if (k === 0) return 'Ce soir';
  if (k === 1) return 'Demain soir';
  return `${cap(fmtWdLong.format(new Date(n.noon)))} soir`;
}
function nightShort(n) {
  const k = nightOffset(n);
  if (k < 0) return 'Nuit';
  if (k === 0) return 'Auj.';
  if (k === 1) return 'Dem.';
  return cap(fmtWd.format(new Date(n.noon)));
}
// « nuit du 25 au 26 octobre », « nuit du 31 octobre au 1er novembre »
function nightSpan(n) {
  const a = new Date(n.noon), b = new Date(n.noon + DAY);
  const d = (x) => (x.getDate() === 1 ? '1er' : x.getDate());
  const m = (x) => fmtMonthLong.format(x);
  return a.getMonth() === b.getMonth() ? `nuit du ${d(a)} au ${d(b)} ${m(b)}` : `nuit du ${d(a)} ${m(a)} au ${d(b)} ${m(b)}`;
}

function computeNights() {
  const obs = observer(state.place);
  const byT = new Map((state.hours ?? []).map((h) => [h.t, h]));
  state.nights = upcomingNights(obs, 7).map((n) => {
    const t0 = Math.floor((n.sunset ?? n.start) / H1) * H1;
    const t1 = Math.ceil((n.sunrise ?? n.end) / H1) * H1;
    const hours = [];
    for (let t = t0; t <= t1; t += H1) {
      const h = byT.get(t) ?? { t, n: 0 };
      const sky = skyAt(new Date(t), obs);
      hours.push({ ...h, t, sky, score: h.n ? hourScore(h, sky) : null });
    }
    return { ...n, hours, best: nightScore(hours) };
  });
  if (state.night >= state.nights.length) state.night = 0;
}

// ---------- Onglet Seeing ----------

function renderSeeing(enter = false) {
  const body = $('#seeing-body');
  if (!state.nights?.some((n) => n.best)) {
    body.innerHTML = state.error ? errorCard(state.error) : skeleton();
    return;
  }
  const nights = state.nights;
  const top = nights.reduce((m, n, k) => (n.best && (!m || n.best.score > m.n.best.score) ? { n, k } : m), null);
  const c = scoreClass(top.n.best.score);
  const win = top.n.best.hours;
  const avg = (key) => win.reduce((s, h) => s + (h[key] ?? 0), 0) / win.length;
  const mid = win[Math.floor(win.length / 2)];
  const hero = `<button class="card hero tap ${c.key}" data-night="${top.k}" data-scroll="night">
      <div class="hero-scene">${nightScene({ cls: c.key, clouds: { low: avg('low'), mid: avg('mid'), high: avg('high') }, moon: mid.sky.moon, label: `Ciel prévu ${nightLabel(top.n).toLowerCase()}` })}
        <span class="hero-badge glass">${icon('star')}Meilleure nuit</span></div>
      <div class="hero-info">
        <div class="hero-row">
          <div class="hero-text">
            <h2 class="hero-site">${nightLabel(top.n)}</h2>
            <p class="hero-meta">${icon('clock')}${hh(top.n.best.from)} – ${hh(top.n.best.to)} · Lune ${pct(top.n.moon.illum)}</p>
            <span class="chip ${c.key}">${c.label}</span>
          </div>
          ${gauge(top.n.best.score)}
        </div>
      </div>
      <div class="hero-foot">${icon('telescope')}<span class="hero-note">${cap(windowSummary(win))}</span>${icon('chevron', 'hero-chev')}</div>
    </button>`;

  const picker = nights.map((n, k) => {
    const s = n.best?.score;
    const cc = scoreClass(s);
    return `<button class="seg tap ${cc.key}" role="tab" data-night="${k}" aria-selected="${k === state.night}"
        style="--v:${Math.max(0.05, (s ?? 0) / 100).toFixed(2)};--j:${k}" aria-label="${nightLabel(n)} : ${s ?? 'pas de données'}">
      <span>${nightShort(n)}</span><b>${s ?? '–'}</b></button>`;
  }).join('');

  body.innerHTML = `
    ${hero}
    <section class="section" id="night-section">
      <div class="section-head"><h2>Nuits</h2><span class="section-sub">${nights.length} prochaines ${helpBtn('help-seeing', 'Comment lire les prévisions')}</span></div>
      <div class="segmented" role="tablist" aria-label="Nuit" style="--n:${nights.length}">
        <span class="seg-thumb" style="--k:${state.night}"></span>${picker}
      </div>
      ${scaleLegend(['low', 'maybe', 'good', 'top'].map((k) => [k, scoreClass({ top: 65, good: 40, maybe: 20, low: 0 }[k]).label]),
        'Légende de l’indice d’observation, du plus faible au plus fort')}
    </section>
    <div id="s-night" class="stack"></div>
    <footer class="foot">
      Modèles ICON, ECMWF et GFS, aérosols CAMS via <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> ·
      éphémérides <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener">Astronomy Engine</a>
    </footer>`;
  renderNight(enter);
  if (enter) animateIn(body, true, [...body.children].filter((el) => el.id !== 's-night').concat([...$('#s-night').children]));
}

function windowSummary(hours) {
  const clear = hours.reduce((s, h) => s + (clearSky(h) ?? 0), 0) / hours.length;
  const see = hours.reduce((s, h) => s + (h.seeing ?? 0), 0) / hours.length;
  const tr = hours.reduce((s, h) => s + (h.transp ?? 0), 0) / hours.length;
  const sky = clear > 0.85 ? 'ciel dégagé' : clear > 0.6 ? 'quelques nuages' : clear > 0.35 ? 'ciel nuageux' : 'ciel couvert';
  const trw = tr >= 4.2 ? 'transparence excellente' : tr >= 3.4 ? 'bonne transparence' : tr >= 2.5 ? 'transparence moyenne' : 'ciel laiteux';
  return `${sky}, seeing ${num(see)}″, ${trw}`;
}

function renderNight(enter = false) {
  const n = state.nights[state.night];
  const box = $('#s-night');
  box.innerHTML = `${timelineCard(n)}${gridCard(n)}${planetsCard(n)}
    <div class="card about">
      ${cardHead('pin', state.place.name)}
      <p class="sheet-p">${num(state.place.lat, 3)}° N, ${num(state.place.lon, 3)}° E · ${int(state.place.alt)} m. ${state.place.note ?? ''}</p>
      <a class="pill-btn tap" href="${meteobluePage(state.place)}" target="_blank" rel="noopener">Seeing meteoblue ${icon('external')}</a>
    </div>`;
  if (!enter) {
    replay([...box.children], 'swap');
    countUp(box);
  }
  // La grille démarre à l'heure en cours pour la nuit en cours.
  const sc = $('.sg-scroll', box);
  const cols = $$('.sg-col', box);
  const k = cols.findIndex((c) => c.classList.contains('nowcol'));
  if (sc && k > 0) sc.scrollLeft = (k - 1) * cols[0].offsetWidth;
}

// Couleurs du crépuscule (barre de la nuit et pastille sous chaque heure).
function darkColor(sunAlt) {
  if (sunAlt > 0) return '#7f8fd6';
  if (sunAlt > -6) return '#5864ad';
  if (sunAlt > -12) return '#3a4488';
  if (sunAlt > -18) return '#252e66';
  return '#111738';
}

function timelineCard(n) {
  const a = n.start, b = n.end, span = b - a;
  const x = (t) => (((Math.max(a, Math.min(b, t)) - a) / span) * 100).toFixed(2);
  const segs = [];
  const bands = [[a, n.civil[0], 0], [n.civil[0], n.naut[0], -6], [n.naut[0], n.astro[0], -12], [n.astro[0], n.astro[1], -18],
    [n.astro[1], n.naut[1], -12], [n.naut[1], n.civil[1], -6], [n.civil[1], b, 0]];
  for (const [s, e, alt] of bands) if (s != null && e != null && e > s) segs.push(`<i style="left:${x(s)}%;width:${(x(e) - x(s)).toFixed(2)}%;background:${darkColor(alt - 1)}"></i>`);
  // Été : pas de nuit astronomique (bande nautique au milieu).
  if (!n.astro[0] && n.naut[0] && n.naut[1]) segs.push(`<i style="left:${x(n.naut[0])}%;width:${(x(n.naut[1]) - x(n.naut[0])).toFixed(2)}%;background:${darkColor(-13)}"></i>`);
  const moon = n.moon.up.map(([s, e]) => `<i style="left:${x(s)}%;width:${(x(e) - x(s)).toFixed(2)}%;--o:${(0.35 + 0.65 * n.moon.illum).toFixed(2)}"></i>`).join('');
  const ticks = [];
  for (let t = Math.ceil(a / (2 * H1)) * 2 * H1; t < b; t += 2 * H1) {
    const p = Number(x(t));
    if (p > 4 && p < 96) ticks.push(`<span style="left:${p}%">${hh(t)}</span>`);
  }
  const now = Date.now();
  const nowMark = now > a && now < b ? `<i class="tl-now" style="left:${x(now)}%"></i>` : '';
  const dark = n.astro[0] && n.astro[1];
  const moonless = n.moonless.length ? n.moonless.map(([s, e]) => `${hm(s)} → ${hm(e)}`).join(', ') : 'aucune';
  const key = (ic, b2, small) => `<div class="tl-key">${ic}<div><b>${b2}</b><small>${small}</small></div></div>`;
  return `<div class="card">
    ${cardHead('moon', cap(nightSpan(n)))}
    <div class="tl" role="img" aria-label="Crépuscules et présence de la Lune">
      <div class="tl-bar">${segs.join('')}</div>
      <div class="tl-moon">${moon}</div>
      <div class="tl-ticks">${ticks.join('')}</div>
      ${nowMark}
    </div>
    <div class="tl-keys">
      ${key(icon('sunset'), hm(n.sunset), 'Coucher du Soleil')}
      ${key(icon('sunrise'), hm(n.sunrise), 'Lever du Soleil')}
      ${key(icon('star'), dark ? `${hm(n.astro[0])} → ${hm(n.astro[1])}` : 'Pas de nuit noire', dark ? 'Nuit noire, Soleil sous −18°' : 'Crépuscule toute la nuit')}
      ${key(icon('eye'), moonless, 'Nuit noire sans Lune')}
      ${key(moonGlyph(n.moon.phase, '', 22), `${n.moon.name}`, `Lune éclairée à ${pct(n.moon.illum)}`)}
      ${key(icon('w-moon'), `${n.moon.rise ? `↑ ${hm(n.moon.rise)}` : ''}${n.moon.rise && n.moon.set ? '  ' : ''}${n.moon.set ? `↓ ${hm(n.moon.set)}` : ''}` || 'Levée toute la nuit', 'Lever et coucher de la Lune')}
    </div>
  </div>`;
}

// Couverture nuageuse : bleu nuit (dégagé) → blanc (couvert), comme meteoblue.
function cloudColor(cc) {
  const a = [24, 34, 79], b = [238, 241, 251];
  const k = Math.max(0, Math.min(1, cc / 100)) ** 0.9;
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
}

const GRID_ROWS = [
  { k: 'head' },
  { k: 'score', label: 'Indice' },
  { grp: 'Nuages' },
  { k: 'low', label: 'Bas' },
  { k: 'mid', label: 'Moyens' },
  { k: 'high', label: 'Hauts' },
  { grp: 'Seeing' },
  { k: 'seeing', label: 'Seeing', sub: '″' },
  { k: 'idx1', label: 'Indice 1' },
  { k: 'idx2', label: 'Indice 2' },
  { k: 'jet', label: 'Jet stream', sub: 'm/s' },
  { k: 'bad', label: 'Couches', sub: 'km' },
  { grp: 'Atmosphère' },
  { k: 'transp', label: 'Transparence' },
  { k: 'temp', label: 'Temp.', sub: '°C' },
  { k: 'rh', label: 'Humidité', sub: '%' },
  { k: 'dew', label: 'Rosée', sub: 'écart' },
  { k: 'wind', label: 'Vent', sub: 'km/h' },
  { grp: 'Ciel' },
  { k: 'moon', label: 'Lune', sub: 'haut.' },
  { k: 'planets', label: 'Planètes' },
];

function gridCell(row, h) {
  const none = '<div class="sg-c plain"><span>–</span></div>';
  const has = h.n > 0;
  switch (row.k) {
    case 'score': {
      if (h.score == null) return has && h.sky.sun.alt > -6 ? '<div class="sg-c plain"><span>☼</span></div>' : none;
      return `<div class="sg-c ${scoreClass(h.score).key}"><span>${h.score}</span></div>`;
    }
    case 'low': case 'mid': case 'high': {
      if (!has || h[row.k] == null) return none;
      const v = h[row.k];
      return `<div class="sg-c cl" style="--cl:${cloudColor(v)};--cl-on:${v > 55 ? '#18224f' : 'rgba(255,255,255,.85)'}"><span>${Math.round(v)}</span></div>`;
    }
    case 'seeing': return has && h.seeing != null ? `<div class="sg-c ${seeingQ(h.seeing)}"><span>${num1(h.seeing)}</span></div>` : none;
    case 'idx1': case 'idx2': return has && h[row.k] != null ? `<div class="sg-c ${qClass(h[row.k])}"><span>${Math.round(h[row.k])}</span></div>` : none;
    case 'jet': return has && h.jet != null ? `<div class="sg-c ${jetQ(h.jet)}"><span>${Math.round(h.jet)}</span></div>` : none;
    case 'bad': {
      if (!has || !h.bad) return none;
      const km = (z) => (z < 9950 ? num(z / 1000) : int(z / 1000));
      return `<div class="sg-c two plain"><span>${km(h.bad.bot)}–${km(h.bad.top)}<em>${num(h.bad.grad, 2)}</em></span></div>`;
    }
    case 'transp': return has && h.transp != null ? `<div class="sg-c ${qClass(h.transp)}"><span>${Math.round(h.transp)}</span></div>` : none;
    case 'temp': return has && h.temp != null ? `<div class="sg-c plain"><span>${int(h.temp)}°</span></div>` : none;
    case 'rh': return has && h.rh != null ? `<div class="sg-c plain"><span>${int(h.rh)}</span></div>` : none;
    case 'dew': {
      if (!has || h.temp == null || h.td == null) return none;
      const d = h.temp - h.td;
      return d < 2 ? `<div class="sg-c q1" title="Risque de rosée"><span>${num(d)}°</span></div>` : `<div class="sg-c plain"><span>${num(d, 0)}°</span></div>`;
    }
    case 'wind': {
      if (!has || h.wind == null) return none;
      return h.wind > 25 ? `<div class="sg-c q2"><span>${int(h.wind)}</span></div>` : `<div class="sg-c plain"><span>${int(h.wind)}</span></div>`;
    }
    case 'moon': {
      const m = h.sky.moon;
      if (m.alt <= 0) return none;
      return `<div class="sg-c plain"><span class="sg-moon" style="opacity:${(0.5 + 0.5 * m.illum).toFixed(2)}">${Math.round(m.alt)}°</span></div>`;
    }
    case 'planets': {
      const up = h.sky.planets.filter((p) => p.alt > 10 && ['Venus', 'Mars', 'Jupiter', 'Saturn', 'Mercury'].includes(p.body));
      return up.length ? `<div class="sg-c"><span class="sg-planets">${up.map((p) => `<i style="--pc:${p.color}">${p.letter}</i>`).join('')}</span></div>` : none;
    }
    default: return none;
  }
}

function gridCard(n) {
  const now = Date.now();
  const labels = GRID_ROWS.map((r) => {
    if (r.k === 'head') return '<div class="sg-l sg-head"></div>';
    if (r.grp) return `<div class="sg-l sg-grp">${r.grp}</div>`;
    return `<div class="sg-l"><span>${r.label}${r.sub ? `<br><small>${r.sub}</small>` : ''}</span></div>`;
  }).join('');
  let nowSet = false;
  const cols = n.hours.map((h) => {
    const d = new Date(h.t);
    const isNow = !nowSet && h.t + H1 > now && h.t <= now + H1;
    if (isNow) nowSet = true;
    const head = `<div class="sg-c sg-head"><div class="sg-hour">${d.getHours() === 0 ? `<span class="sg-day">${fmtWd.format(d)}</span>` : ''}<b>${d.getHours()} h</b><i style="--dk:${darkColor(h.sky.sun.alt)}"></i></div></div>`;
    const cells = GRID_ROWS.slice(1).map((r) => (r.grp ? '<div class="sg-c sg-grp"></div>' : gridCell(r, h))).join('');
    return `<div class="sg-col${d.getHours() === 0 ? ' midnight' : ''}${h.t + H1 < now ? ' past' : ''}${isNow ? ' nowcol' : ''}" role="group" aria-label="${hh(h.t)}">${head}${cells}</div>`;
  }).join('');
  const qItems = [['q1', 'Mauvais'], ['q2', ''], ['q3', 'Moyen'], ['q4', ''], ['q5', 'Excellent']];
  return `<div class="card grid-card">
    ${cardHead('layers', 'Heure par heure', `<span class="head-extra">${MODELS[state.model].label}</span>`)}
    <div class="sg">
      <div class="sg-labels">${labels}</div>
      <div class="sg-scroll"><div class="sg-cols">${cols}</div></div>
    </div>
    <div class="sg-legend">
      <div><div class="cl-scale">${[0, 25, 50, 75, 100].map((v) => `<i style="--cl:${cloudColor(v)}"></i>`).join('')}</div>
        <div class="cl-lbl"><span>Nuages : 0 %</span><span>100 %</span></div></div>
      ${scaleLegend(qItems.map(([k, l]) => [k, l]), 'Seeing, indices, jet stream et transparence : de mauvais à excellent')}
      <div class="sg-keys">${PLANETS.slice(0, 5).map((p) => `<span><b style="color:${p.color}">${p.letter}</b>${p.name}</span>`).join('')}</div>
    </div>
  </div>`;
}

function planetsCard(n) {
  n.planets ??= planetsTonight(n, observer(state.place));
  const list = [...n.planets].sort((a, b) => (b.visible - a.visible) || (a.mag - b.mag));
  const rows = list.map((p) => `<div class="planet${p.visible ? '' : ' off'}">
      <span class="planet-dot" style="--pc:${p.color}"></span>
      <div class="planet-txt"><b>${p.name}</b><small>${p.visible ? `${hm(p.from)} → ${hm(p.to)} · ${p.con}` : 'Pas visible cette nuit'}</small></div>
      <div class="planet-r">${p.visible ? `<b>${Math.round(p.best.alt)}°</b>mag. ${mag(p.mag)}` : ''}</div>
    </div>`).join('');
  return `<div class="card">${cardHead('planet', 'Planètes cette nuit', '<span class="head-extra">hauteur max.</span>')}<div class="planets">${rows}</div></div>`;
}

function selectNight(k, scroll = false) {
  if (!state.nights?.[k]) return;
  if (k !== state.night) {
    const box = $('#s-night');
    box?.style.setProperty('--dx', `${k > state.night ? 28 : -28}px`);
    clearTimeout(selectNight.t);
    selectNight.t = setTimeout(() => box?.style.removeProperty('--dx'), 700);
    state.night = k;
    $$('#seeing .segmented .seg').forEach((b) => b.setAttribute('aria-selected', String(Number(b.dataset.night) === k)));
    $('#seeing .seg-thumb')?.style.setProperty('--k', k);
    renderNight();
  }
  if (scroll) $('#night-section')?.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
}

const SEEING_HELP = `<div class="help-body">
  <p><b>Indice d’observation</b> (0 à 100) : chance d’une bonne nuit au télescope, sur le meilleur créneau de deux heures
    en nuit noire. Il combine surtout le ciel dégagé, puis le seeing, la transparence et la gêne de la Lune.</p>
  <p><b>Nuages</b> bas, moyens et hauts, du bleu nuit (dégagé) au blanc (couvert), comme sur meteoblue.</p>
  <p><b>Seeing</b> (secondes d’arc) : agitation de l’image due à la turbulence. Sous 1″ c’est excellent, au-delà de 2″ les
    détails planétaires se brouillent. Il est estimé en intégrant la turbulence des couches d’air, du sol à 16 km,
    à partir des gradients de température et du cisaillement du vent (modèle de Coulman–Dewan).</p>
  <p><b>Indices 1 et 2</b> (1 mauvais → 5 excellent) : deux estimations indépendantes. L’indice 1 vient du seeing
    calculé ; l’indice 2 du jet stream, des couches instables et du nombre de Richardson (turbulence dynamique).</p>
  <p><b>Jet stream</b> : vent vers 9 à 12 km. Au-delà de 20 m/s, le seeing se dégrade nettement.</p>
  <p><b>Couches</b> : altitude de la couche instable la plus turbulente (gradient de température potentielle au-dessus de 0,5 K/100 m).</p>
  <p><b>Transparence</b> : aérosols (épaisseur optique CAMS) et humidité. <b>Rosée</b> : écart température – point de rosée ;
    sous 2 °C, l’optique risque de s’embuer.</p>
  <p><b>Planètes</b> : au-dessus de 10° de hauteur à cette heure (Me Mercure, V Vénus, Ma Mars, J Jupiter, S Saturne).</p>
</div>`;

// ---------- Onglet Aurora ----------

const KP_COLORS = (kp) => (kp >= 8 ? 'var(--aurora-r)' : kp >= 7 ? '#ff9f5a' : kp >= 6 ? '#f0c766' : kp >= 5 ? 'var(--aurora-g)'
  : kp >= 4 ? 'var(--kp4)' : kp >= 3 ? 'var(--kp3)' : 'var(--kp0)');

function auroraNights() {
  const au = state.au;
  const thr = thresholds(geomagLat(state.place.lat, state.place.lon));
  const nights = state.nights ?? upcomingNights(observer(state.place), 3).map((n) => ({ ...n, hours: [] }));
  return nights.slice(0, 3).map((n) => {
    const a = n.naut[0] ?? n.start, b = n.naut[1] ?? n.end;
    const bins = au.kp.filter((r) => r.t + 3 * H1 > a && r.t < b);
    if (!bins.length) return null;
    const maxKp = Math.max(...bins.map((r) => r.kp));
    const dark = n.hours.filter((h) => h.sky.sun.alt < -12 && h.n);
    const clear = dark.length ? dark.reduce((s, h) => s + clearSky(h), 0) / dark.length : null;
    const geo = kpChance(maxKp, thr);
    const moonF = 1 - 0.25 * n.moon.illum;
    const score = Math.round(100 * geo * (clear == null ? 1 : clear ** 0.8) * moonF);
    return { n, maxKp, clear, geo, score };
  }).filter(Boolean);
}

function renderAurora(enter = false) {
  const body = $('#aurora-body');
  if (!state.au) {
    body.innerHTML = state.auError ? errorCard(state.auError, 'refresh-aurora') : skeleton();
    return;
  }
  const mlat = geomagLat(state.place.lat, state.place.lon);
  const thr = thresholds(mlat);
  const an = auroraNights();
  const top = an.reduce((m, x) => (!m || x.score > m.score ? x : m), null);
  const c = chanceClass(top?.score ?? 0);
  const live = state.au.now && state.au.now.kp >= thr.photo - 0.4;
  const cloudTxt = (x) => (x.clear == null ? 'météo pas encore chargée'
    : x.clear > 0.8 ? 'ciel dégagé prévu' : x.clear > 0.5 ? 'quelques nuages prévus' : x.clear > 0.25 ? 'ciel nuageux prévu' : 'ciel couvert prévu');
  const hero = top ? `<div class="card hero ${c.key}">
      <div class="hero-scene">${auroraScene({ chance: top.geo * (top.clear ?? 1), label: 'Ciel au nord' })}
        <span class="hero-badge glass${live ? ' live' : ''}">${live ? '<i class="dot"></i>Kp élevé en ce moment' : `${icon('star')}3 prochaines nuits`}</span></div>
      <div class="hero-info">
        <div class="hero-row">
          <div class="hero-text">
            <h2 class="hero-site">${nightLabel(top.n)}</h2>
            <p class="hero-meta">${icon('activity')}Kp prévu ${kpLabel(top.maxKp)} · il faut ${kpLabel(Math.ceil(thr.photo))} ici</p>
            <span class="chip ${c.key}">${c.label}</span>
          </div>
          ${gauge(top.score)}
        </div>
      </div>
      <div class="hero-foot">${icon('cloud')}<span class="hero-note">${an.map((x) => `${nightShort(x.n)} Kp ${kpLabel(x.maxKp)}`).join(' · ')} — ${cloudTxt(top)}</span></div>
    </div>` : '';

  body.innerHTML = `
    ${hero}
    <div class="card">
      ${cardHead('activity', 'Activité géomagnétique', helpBtn('help-kp', 'Comprendre l’indice Kp'))}
      <p class="card-sub">Indice Kp par tranches de 3 h, observé puis prévu${state.au.now ? ` · maintenant ${kpLabel(state.au.now.kp)}` : ''}</p>
      ${kpChart(thr)}
    </div>
    <div class="card" id="sw-card">${solarWindCard()}</div>
    <div class="card" id="map-card">
      ${cardHead('globe', 'Ovale auroral')}
      <p class="card-sub" id="map-sub">${state.ov ? ovSub() : 'Prévision NOAA OVATION pour la prochaine heure'}</p>
      <div class="map-wrap"><canvas id="ov-map" aria-label="Carte de la probabilité d’aurore"></canvas><div class="map-msg">${state.ovError ? 'Carte indisponible' : spinner('inline')}</div></div>
      <div class="map-keys"><div class="map-ramp"></div><div class="map-lbl"><span>Faible</span><span>Probabilité d’aurore</span><span>Forte</span></div></div>
    </div>
    ${outlookCard(thr)}
    ${thresholdCard(mlat, thr)}
    <footer class="foot">Données <a href="https://www.swpc.noaa.gov" target="_blank" rel="noopener">NOAA Space Weather Prediction Center</a> ·
      prévision à 27 jours : récurrence de la rotation solaire</footer>`;
  animateIn(body, enter);
  if (state.ov) drawMap();
  else if (!state.ovError) loadOvation();
  if (!state.sw && !state.swError) loadSolarWind();
}

function kpChart(thr) {
  const rows = state.au.kp;
  const now = Date.now();
  const t0 = Math.floor((now - 24 * H1) / (3 * H1)) * 3 * H1;
  const bins = rows.filter((r) => r.t >= t0);
  if (!bins.length) return '<p class="muted">Pas de prévision.</p>';
  const t1 = bins.at(-1).t + 3 * H1;
  const W = 320, x0 = 22, x1 = W - 4, top = 22, bottom = 150, H = 170;
  const xt = (t) => x0 + ((t - t0) / (t1 - t0)) * (x1 - x0);
  const y = (kp) => bottom - (kp / 9) * (bottom - top);
  const obs = observer(state.place);
  let g = `<svg class="kp" viewBox="0 0 ${W} ${H}" role="img" aria-label="Indice Kp observé et prévu sur 3 jours">
    <rect x="${x0}" y="${top}" width="${x1 - x0}" height="${bottom - top}" rx="8" class="kp-bg"/>`;
  // Nuit au lieu (Soleil sous −12°), par pas de 30 min.
  for (let t = t0; t < t1; t += 30 * 60e3) {
    if (skyAt(new Date(t + 15 * 60e3), obs).sun.alt < -12) g += `<rect x="${xt(t).toFixed(1)}" y="${top}" width="${(xt(t + 30 * 60e3) - xt(t) + 0.3).toFixed(1)}" height="${bottom - top}" class="kp-night"/>`;
  }
  for (const k of [3, 6, 9]) g += `<line x1="${x0}" x2="${x1}" y1="${y(k)}" y2="${y(k)}" class="kp-grid"/><text x="${x0 - 5}" y="${y(k) + 3.5}" class="kp-lbl end">${k}</text>`;
  // Jours.
  for (let d = new Date(t0); d.getTime() < t1; d.setDate(d.getDate() + 1)) {
    const m = new Date(d); m.setHours(0, 0, 0, 0);
    if (m.getTime() > t0) g += `<line x1="${xt(m.getTime()).toFixed(1)}" x2="${xt(m.getTime()).toFixed(1)}" y1="${top}" y2="${bottom + 4}" class="kp-axis"/>`;
    const noon = m.getTime() + 12 * H1;
    if (noon > t0 && noon < t1) g += `<text x="${xt(noon).toFixed(1)}" y="${top - 8}" class="kp-day">${m.getTime() + 12 * H1 - todayNoon() === 0 ? 'Auj.' : cap(fmtWd.format(m))} ${m.getDate()}</text>`;
  }
  bins.forEach((r, j) => {
    const a = xt(r.t) + 1.2, b = xt(r.t + 3 * H1) - 1.2;
    const pred = r.kind !== 'observed';
    g += `<rect class="kp-bar${pred ? ' pred' : ''}" style="--j:${j}" x="${a.toFixed(1)}" y="${y(Math.max(0.15, r.kp)).toFixed(1)}" width="${(b - a).toFixed(1)}"
      height="${(bottom - y(Math.max(0.15, r.kp))).toFixed(1)}" rx="2" fill="${KP_COLORS(r.kp)}"><title>${fmtDay.format(new Date(r.t))} ${hh(r.t)} : Kp ${kpLabel(r.kp)}</title></rect>`;
    if (r.kp >= 4) g += `<text x="${((a + b) / 2).toFixed(1)}" y="${(y(r.kp) - 3).toFixed(1)}" class="kp-v">${kpLabel(r.kp)}</text>`;
  });
  for (const [k, cls, lbl] of [[thr.photo, 'photo', 'photo'], [thr.eye, 'eye', 'œil nu']]) {
    if (k > 9) continue;
    g += `<line x1="${x0}" x2="${x1}" y1="${y(k).toFixed(1)}" y2="${y(k).toFixed(1)}" class="kp-line ${cls}"/>
      <text x="${x1 - 4}" y="${(y(k) - 4).toFixed(1)}" class="kp-line-lbl ${cls}" text-anchor="end">${lbl}</text>`;
  }
  const nx = xt(now);
  g += `<line x1="${nx.toFixed(1)}" x2="${nx.toFixed(1)}" y1="${top}" y2="${bottom}" class="kp-now"/>`;
  for (let t = Math.ceil(t0 / H1) * H1; t <= t1; t += H1) {
    const hr = new Date(t).getHours();
    if (hr % 12 || xt(t) < x0 + 8 || xt(t) > x1 - 8) continue;
    g += `<text x="${xt(t).toFixed(1)}" y="${H - 4}" class="kp-lbl mid">${hr} h</text>`;
  }
  g += '</svg>';
  return `${g}<div class="kp-keys"><span><i class="k-obs"></i>Observé</span><span><i class="k-pred"></i>Prévu</span>
    <span><i class="k-photo"></i>Seuil photo</span><span><i class="k-eye"></i>Seuil œil nu</span></div>`;
}

function spark(rows, key, zero = false) {
  const pts = rows.filter((r) => r[key] != null);
  if (pts.length < 2) return '';
  const W = 140, H = 30;
  const t0 = pts[0].t, t1 = pts.at(-1).t;
  let lo = Math.min(...pts.map((p) => p[key])), hi = Math.max(...pts.map((p) => p[key]));
  if (zero) { lo = Math.min(lo, -1); hi = Math.max(hi, 1); }
  if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
  const x = (t) => ((t - t0) / (t1 - t0 || 1)) * W;
  const y = (v) => H - 2 - ((v - lo) / (hi - lo)) * (H - 4);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
  return `<svg class="sw-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    ${zero ? `<line class="zero" x1="0" x2="${W}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>` : ''}
    <path class="area" d="${d} L${W} ${H} L0 ${H} Z"/><path d="${d}"/></svg>`;
}

function solarWindCard() {
  const head = cardHead('wave', 'Vent solaire', '<span class="head-extra">en direct · 6 h</span>');
  if (!state.sw) return `${head}${state.swError ? `<p class="sw-note">Données temps réel indisponibles (${state.swError}).</p>` : `<p class="sw-note">${spinner('inline')}Chargement…</p>`}`;
  const { m, w } = state.sw;
  const last = (rows, k) => { const r = rows.filter((x) => x[k] != null); return r.length ? r.slice(-2).reduce((s, x) => s + x[k], 0) / Math.min(2, r.length) : null; };
  const sp = last(w, 'speed'), de = last(w, 'density'), bz = last(m, 'bz'), bt = last(m, 'bt');
  const st = (v, lv) => lv.find(([lim]) => v >= lim) ?? lv.at(-1);
  const spS = sp == null ? null : st(sp, [[700, 'top', 'Très rapide'], [500, 'good', 'Rapide'], [400, 'maybe', 'Modéré'], [0, 'low', 'Calme']]);
  const deS = de == null ? null : st(de, [[20, 'top', 'Très dense'], [10, 'good', 'Dense'], [4, 'maybe', 'Normal'], [0, 'low', 'Faible']]);
  const bzS = bz == null ? null : bz <= -10 ? [0, 'top', 'Très favorable'] : bz <= -5 ? [0, 'good', 'Favorable'] : bz < 0 ? [0, 'maybe', 'Neutre'] : [0, 'low', 'Défavorable'];
  const btS = bt == null ? null : st(bt, [[20, 'top', 'Très fort'], [10, 'good', 'Fort'], [5, 'maybe', 'Modéré'], [0, 'low', 'Faible']]);
  const tile = (ic, label, v, unit, s, rows, key, color, zero) => `<div class="sw-tile" style="--st:${color}">
      <small>${icon(ic)}${label}</small><b>${v}<i> ${unit}</i></b>${s ? `<em class="${s[1]}">${s[2]}</em>` : ''}${spark(rows, key, zero)}</div>`;
  const note = bz != null && sp != null ? (bz <= -5 && sp >= 450 ? 'Champ magnétique orienté au sud et vent rapide : conditions propices à une montée du Kp dans l’heure.'
    : bz <= -5 ? 'Champ magnétique orienté au sud : l’énergie du vent solaire entre dans la magnétosphère.'
      : 'Bz au nord ou neutre : la magnétosphère reste plutôt fermée au vent solaire.') : '';
  return `${head}<div class="sw">
      ${tile('gauge', 'Vitesse', int(sp), 'km/s', spS, w, 'speed', '#5fb8f0')}
      ${tile('dots', 'Densité', num(de), 'p/cm³', deS, w, 'density', '#b08cff')}
      ${tile('magnet', 'Bz', bz == null ? '–' : (bz < 0 ? `−${num(-bz)}` : num(bz)), 'nT', bzS, m, 'bz', '#5df2a6', true)}
      ${tile('magnet', 'Bt', num(bt), 'nT', btS, m, 'bt', '#f0c766')}
    </div>${note ? `<p class="sw-note">${note}</p>` : ''}`;
}

async function loadSolarWind() {
  try {
    state.sw = await fetchSolarWind();
    state.swError = null;
  } catch (e) {
    state.swError = e.message;
  }
  const card = $('#sw-card');
  if (card) { card.innerHTML = solarWindCard(); replay([card], 'swap'); }
}

const ovSub = () => `Prévision NOAA OVATION pour ${hm(state.ov.fc)}`;
let geoLib = null;
async function loadOvation() {
  try {
    geoLib ??= Promise.all([
      import('https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/+esm'),
      import('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm'),
      fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json').then((r) => r.json()),
    ]).then(([d3, topo, land]) => ({ d3, land: topo.feature(land, land.objects.land) }));
    const [ov] = await Promise.all([fetchOvation(), geoLib]);
    state.ov = ov;
    state.ovError = null;
  } catch (e) {
    console.error(e);
    state.ovError = e.message;
    geoLib = null;
  }
  const sub = $('#map-sub');
  if (sub && state.ov) sub.textContent = ovSub();
  drawMap();
}

const cssVar = (k) => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
async function drawMap() {
  const cv = $('#ov-map');
  if (!cv) return;
  const msg = cv.parentNode.querySelector('.map-msg');
  if (!state.ov) { if (msg && state.ovError) msg.textContent = 'Carte indisponible'; return; }
  const { d3, land } = await geoLib;
  const box = cv.getBoundingClientRect();
  if (!box.width) return;
  const k = devicePixelRatio || 2;
  cv.width = Math.round(box.width * k);
  cv.height = Math.round(box.height * k);
  const ctx = cv.getContext('2d');
  ctx.scale(k, k);
  const W = box.width, H = box.height;
  const p = state.place;
  const center = [p.lon, Math.max(50, Math.min(72, p.lat + 16))];
  const proj = d3.geoOrthographic().rotate([-center[0], -center[1]]).scale(W * 0.82).translate([W / 2, H / 2]).clipAngle(90);
  const path = d3.geoPath(proj, ctx);
  ctx.clearRect(0, 0, W, H);
  ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = cssVar('--ocean'); ctx.fill();
  ctx.beginPath(); path(d3.geoGraticule10()); ctx.strokeStyle = cssVar('--ch-grid'); ctx.lineWidth = 0.6; ctx.stroke();
  ctx.beginPath(); path(land); ctx.fillStyle = cssVar('--land'); ctx.fill(); ctx.strokeStyle = cssVar('--land-edge'); ctx.lineWidth = 0.7; ctx.stroke();
  // Probabilité d'aurore : disques semi-transparents d'environ 1,4° (grille de 1°).
  const ramp = [[0, [93, 242, 166]], [30, [93, 242, 166]], [50, [232, 240, 106]], [70, [255, 173, 92]], [90, [255, 92, 122]]];
  const color = (v) => {
    for (let i = 1; i < ramp.length; i++) {
      if (v <= ramp[i][0]) {
        const [a, ca] = ramp[i - 1], [b, cb] = ramp[i];
        const u = (v - a) / (b - a);
        return ca.map((c, j) => Math.round(c + (cb[j] - c) * u));
      }
    }
    return ramp.at(-1)[1];
  };
  const r = Math.max(1.6, (proj.scale() * Math.PI) / 180 * 0.75);
  const ctr = [center[0], center[1]];
  for (const [lon0, lat, v] of state.ov.pts) {
    const lon = lon0 > 180 ? lon0 - 360 : lon0;
    if (lat < 0 || v < 4 || d3.geoDistance([lon, lat], ctr) > Math.PI / 2 - 0.02) continue;
    const xy = proj([lon, lat]);
    if (!xy) continue;
    const [cr, cg, cb] = color(v);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(0.8, 0.05 + v / 70).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(xy[0], xy[1], r, 0, 2 * Math.PI); ctx.fill();
  }
  // Lieu d'observation.
  const me = proj([p.lon, p.lat]);
  if (me) {
    ctx.beginPath(); ctx.arc(me[0], me[1], 9, 0, 2 * Math.PI); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();
    ctx.beginPath(); ctx.arc(me[0], me[1], 4.5, 0, 2 * Math.PI); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = cssVar('--indigo'); ctx.stroke();
    ctx.font = '600 12px Inter, sans-serif'; ctx.fillStyle = cssVar('--text'); ctx.textAlign = 'center';
    ctx.fillText(p.name, me[0], me[1] + 22);
  }
  msg?.remove();
}

function outlookCard(thr) {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const ol = state.au.outlook.filter((d) => d.t >= Date.UTC(t0.getFullYear(), t0.getMonth(), t0.getDate()));
  if (!ol.length) return '';
  const first = new Date(ol[0].t);
  const lead = (first.getUTCDay() + 6) % 7; // lundi en premier
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cls = (kp) => (kp >= 5 ? 'top' : kp >= 4 ? 'good' : kp >= 3 ? 'maybe' : 'low');
  const cells = Array.from({ length: lead }, () => '<span class="ol-d empty"></span>').join('')
    + ol.map((d) => {
      const dt = new Date(d.t);
      const isToday = dt.getUTCFullYear() === today.getFullYear() && dt.getUTCMonth() === today.getMonth() && dt.getUTCDate() === today.getDate();
      return `<span class="ol-d ${cls(d.kp)}${isToday ? ' today' : ''}${d.kp >= Math.round(thr.photo) - 1 ? ' hit' : ''}" title="Kp max ${d.kp}">
        <small>${dt.getUTCDate()} ${dt.getUTCDate() === 1 || d === ol[0] ? fmtMonthShort.format(dt) : ''}</small><b>${d.kp}</b></span>`;
    }).join('');
  return `<div class="card">
    ${cardHead('calendar', 'Tendance sur 27 jours')}
    <p class="card-sub">Kp maximal attendu par jour. Le Soleil tourne sur lui-même en 27 jours : les zones actives reviennent face à la Terre.</p>
    <div class="outlook">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="ol-wd">${d}</span>`).join('')}${cells}</div>
  </div>`;
}

function thresholdCard(mlat, thr) {
  const kpTxt = (k) => (k >= 9 ? '9' : kpLabel(Math.ceil(k * 3) / 3));
  const g = (k) => { const s = gScale(Math.ceil(k)); return s ? `tempête G${s}` : 'activité modérée'; };
  const row = (k, cls, b, s) => `<div class="thr-row"><span class="thr-kp ${cls}">${kpTxt(k)}</span><div><b>${b}</b><small>${s}</small></div></div>`;
  return `<div class="card">
    ${cardHead('pin', 'Seuils pour ce lieu')}
    <p class="card-sub">Latitude géomagnétique ${num(mlat)}° : il faut au moins une ${g(thr.photo)} (Kp ${kpTxt(thr.photo)}).</p>
    <div class="thr">
      ${row(thr.photo, 'good', 'Photo, bas au nord', 'Lueur verte et rouge sur un capteur, pose de quelques secondes, horizon nord dégagé.')}
      ${row(thr.eye, 'top', 'À l’œil nu', 'Arc ou lueur pâle bas sur l’horizon nord, loin des lumières.')}
      ${row(thr.overhead, 'top', 'Haut dans le ciel', 'Rideaux et rayons jusqu’au zénith, comme en mai 2024.')}
    </div>
  </div>`;
}

const KP_HELP = `<div class="help-body">
  <p><b>Kp</b> (0 à 9) mesure l’agitation du champ magnétique terrestre sur 3 h. Plus il est élevé, plus l’ovale
    auroral s’étend vers le sud.</p>
  <p>Échelle NOAA des tempêtes : Kp 5 = G1 (mineure), 6 = G2, 7 = G3 (forte), 8 = G4 (sévère), 9 = G5 (extrême).</p>
  <p>Seuils du lieu : bord de l’ovale au zénith vers 66,5° − 2 × Kp de latitude géomagnétique ; une aurore se voit
    encore bas sur l’horizon ~3,5° plus au sud, et se photographie ~5,5° plus au sud.</p>
  <p>La <b>chance</b> combine le Kp maximal prévu pendant la nuit, la couverture nuageuse prévue et la Lune.
    Les prévisions de Kp au-delà de 24 h sont incertaines : une éjection de masse coronale peut arriver plus tôt ou plus fort.</p>
  <p><b>Vent solaire</b> : un Bz négatif (orienté au sud) durable, avec un vent rapide et dense, annonce souvent une
    hausse du Kp dans les 30 à 60 minutes.</p>
</div>`;

// ---------- Onglet Meteors ----------

function computeMeteors() {
  state.meteors = evaluateAll(state.place, SKIES[state.sky].lm);
}

// Météo de la meilleure nuit d'un essaim si elle est dans les prévisions.
function nightWeather(night) {
  const n = state.nights?.find((x) => Math.abs(x.noon - night.noon) < 6 * H1);
  return n?.best ? n : null;
}

function renderMeteors(enter = false) {
  const body = $('#meteors-body');
  if (!state.meteors) { body.innerHTML = skeleton(); return; }
  const list = state.meteors;
  const now = Date.now();
  const majors = list.filter((e) => e.s.major);
  const active = majors.filter((e) => e.active && e.night.end > now - 6 * H1).sort((a, b) => b.score - a.score)[0];
  const next = active ?? majors.find((e) => e.night.end > now) ?? list[0];
  const c = meteorClass(next.score);
  const w = nightWeather(next.night);
  const hero = `<button class="card hero tap ${c.key}" data-shower="${next.s.code}">
      <div class="hero-scene">${meteorScene({ quality: next.score / 100, illum: next.moon.illum, label: next.s.name })}
        <span class="hero-badge glass">${icon('star')}${next.active ? 'En cours' : 'Prochaine pluie'}</span></div>
      <div class="hero-info">
        <div class="hero-row">
          <div class="hero-text">
            <h2 class="hero-site">${next.s.name}</h2>
            <p class="hero-meta">${icon('calendar')}${cap(nightSpan(next.night))}</p>
            <span class="chip ${c.key}">${c.label}</span>
          </div>
          ${gauge(next.score)}
        </div>
      </div>
      <div class="hero-foot">${moonGlyph(next.moon.phase, 'hero-moon', 20)}<span class="hero-note">Lune ${pct(next.moon.illum)} · jusqu’à ${int(next.hr)} météores/h vers ${hh(next.best?.t ?? next.peak)}${w ? ` · météo ${scoreClass(w.best.score).label.toLowerCase()}` : ''}</span>${icon('chevron', 'hero-chev')}</div>
    </button>`;

  // Cette nuit : essaims actifs.
  const night = state.nights?.[0] ?? null;
  const tn = night ? activeTonight(night, state.place, SKIES[state.sky].lm).filter((x) => x.hr >= 0.5 || x.s.major) : [];
  const tonight = `<div class="card">
      ${cardHead('meteor', nightLabel(night ?? { noon: todayNoon() }), '<span class="head-extra">taux visible max.</span>')}
      ${tn.length ? `<div class="tonight">${tn.slice(0, 5).map((x) => `<button class="tn-row tap" data-shower="${x.s.code}">
          <div><b>${x.s.name}</b><small>ZHR ${num(x.zhr, 0)} · radiant ${x.t ? `au mieux vers ${hh(x.t)}` : 'sous l’horizon'}</small></div>
          <div class="tn-rate"><b>${x.hr < 1 ? '< 1' : int(x.hr)}</b><small> /h</small></div></button>`).join('')}</div>`
        : '<p class="sheet-p">Aucun essaim notable : comptez 5 à 10 météores sporadiques par heure, un peu plus en fin de nuit.</p>'}
    </div>`;

  // Calendrier : ruban de l'année et liste mois par mois.
  const shown = list.filter((e) => state.showMinor || e.s.major || e.s.fireballs);
  let month = '';
  const items = shown.map((e) => {
    const m = fmtMonth.format(new Date(e.peak));
    const head = m !== month ? `<p class="month-lbl">${m}</p>` : '';
    month = m;
    const cc = meteorClass(e.score);
    const d = new Date(e.night.noon);
    return `${head}<button class="card shower tap${e.s.major ? '' : ' minor'}${e.active ? ' active' : ''}" data-shower="${e.s.code}">
        <span class="sh-date"><b>${d.getDate()}</b><small>${fmtMonthShort.format(d).replace('.', '')}</small></span>
        <span class="sh-txt"><b>${e.s.name}</b><small>${moonGlyph(e.moon.phase, '', 13)}Lune ${pct(e.moon.illum)} · ZHR ${e.s.variable ? 'variable' : e.s.zhr} · ${int(e.hr)}/h ici</small></span>
        <span class="sh-r"><span class="chip sm ${cc.key}">${cc.label}</span>${icon('chevron')}</span>
      </button>`;
  }).join('');

  body.innerHTML = `
    ${hero}
    ${tonight}
    <section class="section">
      <div class="section-head"><h2>Calendrier</h2><span class="section-sub">${new Date().getFullYear()} ${helpBtn('help-meteors', 'Comment sont calculés les taux')}</span></div>
      <div class="card">${ribbon()}</div>
      <div class="showers">${items}</div>
      <label class="toggle-row"><span>Afficher les essaims mineurs</span><input type="checkbox" class="switch" id="opt-minor" ${state.showMinor ? 'checked' : ''}></label>
    </section>
    <footer class="foot">Essaims : liste de travail de l’<a href="https://www.imo.net" target="_blank" rel="noopener">International Meteor Organization</a> ·
      maximum recalculé chaque année depuis la longitude solaire</footer>`;
  animateIn(body, enter);
  $('#opt-minor').onchange = (e) => { state.showMinor = e.target.checked; store.set('sc-minor', state.showMinor ? '1' : '0'); renderMeteors(); };
}

function ribbon() {
  const y = new Date().getFullYear();
  const majors = SHOWERS.filter((s) => s.major && 90 - Math.abs(state.place.lat - s.dec) > 10);
  const W = 320, x0 = 78, x1 = W - 4, rowH = 17, top = 18;
  const H = top + majors.length * rowH + 4;
  const t0 = new Date(y, 0, 1).getTime(), t1 = new Date(y + 1, 0, 1).getTime();
  const xt = (t) => x0 + ((t - t0) / (t1 - t0)) * (x1 - x0);
  let g = `<svg class="ribbon" viewBox="0 0 ${W} ${H}" role="img" aria-label="Activité des principaux essaims en ${y}">`;
  for (let m = 0; m < 12; m++) {
    const a = new Date(y, m, 1).getTime(), b = new Date(y, m + 1, 1).getTime();
    g += `<line x1="${xt(a).toFixed(1)}" x2="${xt(a).toFixed(1)}" y1="${top - 4}" y2="${H}" class="rb-grid"/>
      <text x="${xt((a + b) / 2).toFixed(1)}" y="${top - 7}" class="rb-month">${'JFMAMJJASOND'[m]}</text>`;
  }
  const byCode = new Map((state.meteors ?? []).map((e) => [e.s.code, e]));
  majors.forEach((s, j) => {
    const yy = top + j * rowH;
    const { peak, spans } = yearSpans(s, y);
    const e = byCode.get(s.code);
    const cls = e && new Date(e.peak).getFullYear() === y ? meteorClass(e.score).key : 'maybe';
    g += `<text x="0" y="${yy + 11.5}" class="rb-name">${s.name}</text>`;
    const hgt = Math.max(4, Math.min(10, 3 + Math.log10(s.zhr) * 3.3));
    for (const [a, b] of spans) {
      g += `<rect class="rb-bar ${cls}" style="--j:${j}" x="${xt(a).toFixed(1)}" y="${(yy + 8 - hgt / 2).toFixed(1)}" width="${Math.max(2, xt(b) - xt(a)).toFixed(1)}" height="${hgt.toFixed(1)}" rx="${(hgt / 2).toFixed(1)}"/>`;
    }
    g += `<circle class="rb-peak ${cls}" cx="${xt(peak).toFixed(1)}" cy="${yy + 8}" r="3.2"/>`;
  });
  const nx = xt(Date.now());
  g += `<line x1="${nx.toFixed(1)}" x2="${nx.toFixed(1)}" y1="${top - 2}" y2="${H}" class="rb-now"/>`;
  return `${g}</svg>`;
}

function openShower(code) {
  const e = state.meteors?.find((x) => x.s.code === code);
  if (!e) return;
  const s = e.s;
  const c = meteorClass(e.score);
  const w = nightWeather(e.night);
  const speed = s.v >= 60 ? 'très rapides' : s.v >= 40 ? 'rapides' : s.v >= 25 ? 'assez lents' : 'lents';
  const fact = (label, val, wide = false) => `<div class="fact${wide ? ' wide' : ''}"><small>${label}</small><b>${val}</b></div>`;
  openSheet(s.name, `
    <div class="sheet-hero">
      <div class="hs-txt"><b>${cap(nightSpan(e.night))}</b><small>Maximum ${fmtDay.format(new Date(e.peak))} vers ${hm(e.peak)}</small>
        <span class="chip ${c.key}" style="margin-top:10px">${c.label}</span></div>
      ${gauge(e.score, 'sm')}
    </div>
    <div class="sheet-sec"><h3>Au fil de la nuit</h3><div class="sheet-card">${nightChart(e)}</div></div>
    <div class="sheet-sec"><div class="facts">
      ${fact('Taux attendu ici', `jusqu’à ${int(e.hr)} /h vers ${hh(e.best?.t ?? e.peak)}`, true)}
      ${fact('ZHR au maximum', s.variable ? `${s.zhr} (variable)` : s.zhr)}
      ${fact('Activité', `${fmtDM.format(new Date(e.start))} → ${fmtDM.format(new Date(e.end - DAY))}`)}
      ${fact('Radiant', `${e.con} · ${Math.round(e.radMax)}° max.`)}
      ${fact('Vitesse', `${s.v} km/s, ${speed}`)}
      ${fact('Lune', `${e.moon.name}, ${pct(e.moon.illum)}`)}
      ${fact('Corps parent', s.parent)}
      ${w ? fact('Météo prévue', `${scoreClass(w.best.score).label} (${w.best.score}/100)`, true) : ''}
    </div></div>
    ${s.note ? `<div class="sheet-sec"><p class="sheet-p">${s.note}</p></div>` : ''}
    <div class="sheet-sec"><p class="sheet-p muted">ZHR : nombre de météores par heure qu’un observateur verrait sous un ciel parfait,
      radiant au zénith. Le taux « ici » tient compte de la hauteur du radiant, de la Lune et de la qualité du ciel (${SKIES[state.sky].label.toLowerCase()}).</p></div>`, 'shower-sheet');
}

function nightChart(e) {
  const pts = e.pts;
  const n = e.night;
  const W = 320, x0 = 26, x1 = W - 4, top = 10, bottom = 128, H = 146;
  const xt = (t) => x0 + ((t - n.start) / (n.end - n.start)) * (x1 - x0);
  const y = (alt) => bottom - (Math.max(0, alt) / 90) * (bottom - top);
  const hrMax = Math.max(1, ...pts.map((p) => p.hr));
  let g = `<svg class="nc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hauteur du radiant, de la Lune et taux attendu pendant la nuit">
    <rect x="${x0}" y="${top}" width="${x1 - x0}" height="${bottom - top}" rx="8" class="nc-twi"/>`;
  if (n.naut[0] && n.naut[1]) g += `<rect x="${xt(n.naut[0]).toFixed(1)}" y="${top}" width="${(xt(n.naut[1]) - xt(n.naut[0])).toFixed(1)}" height="${bottom - top}" class="nc-night"/>`;
  for (const a of [30, 60]) g += `<line x1="${x0}" x2="${x1}" y1="${y(a)}" y2="${y(a)}" class="nc-grid"/><text x="${x0 - 5}" y="${y(a) + 3.5}" class="nc-lbl end">${a}°</text>`;
  // Taux visible (barres), radiant (courbe pleine), Lune (pointillés).
  pts.forEach((p) => {
    if (p.hr <= 0) return;
    const bh = (p.hr / hrMax) * (bottom - top) * 0.55;
    g += `<rect x="${(xt(p.t) - 2).toFixed(1)}" y="${(bottom - bh).toFixed(1)}" width="4" height="${bh.toFixed(1)}" rx="1.5" class="nc-rate" opacity=".55"/>`;
  });
  const line = (key) => pts.map((p, i) => `${i ? 'L' : 'M'}${xt(p.t).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
  g += `<path d="${line('rad')} L${xt(pts.at(-1).t).toFixed(1)} ${bottom} L${xt(pts[0].t).toFixed(1)} ${bottom} Z" class="nc-rad-area"/>
    <path d="${line('rad')}" class="nc-rad"/><path d="${line('moonAlt')}" class="nc-moon"/>`;
  const now = Date.now();
  if (now > n.start && now < n.end) g += `<line x1="${xt(now).toFixed(1)}" x2="${xt(now).toFixed(1)}" y1="${top}" y2="${bottom}" class="nc-now"/>`;
  for (let t = Math.ceil(n.start / (2 * H1)) * 2 * H1; t < n.end; t += 2 * H1) {
    g += `<text x="${xt(t).toFixed(1)}" y="${H - 3}" class="nc-lbl mid">${hh(t)}</text>`;
  }
  g += '</svg>';
  return `${g}<div class="nc-keys"><span><i class="k-rad"></i>Radiant</span><span><i class="k-moon"></i>Lune</span><span><i class="k-rate"></i>Météores/h (max. ${int(hrMax)})</span></div>`;
}

const METEOR_HELP = `<div class="help-body">
  <p>Le <b>maximum</b> de chaque essaim est recalculé pour l’année à partir de la longitude solaire publiée par l’IMO :
    la Terre traverse le nuage de poussières au même point de son orbite chaque année.</p>
  <p>Le <b>taux visible</b> part du ZHR (taux idéal, radiant au zénith, ciel parfait), corrigé par la hauteur du radiant,
    par l’activité autour du maximum, et par la magnitude limite du ciel : qualité du site (réglages), Lune et crépuscule.</p>
  <p>L’<b>indice</b> traduit ce taux sur 100 (échelle logarithmique) : 120 météores/h donnent 100, 20/h donnent 58, 5/h donnent 30.
    La météo de la nuit est indiquée quand elle est dans les prévisions (7 jours).</p>
</div>`;

// ---------- Onglet Autres ----------

const EV_FILTERS = { all: ['Tout', 'sparkles'], eclipse: ['Éclipses', 'eclipse'], sat: ['Stations', 'satellite'], planet: ['Planètes', 'planet'], moon: ['Lune', 'moon'] };
const EV_ICONS = {
  solar: 'eclipse', lunar: 'eclipse-moon', pass: 'satellite', opposition: 'planet', elongation: 'planet', conjunction: 'planet',
  transit: 'eclipse', super: 'moon', blue: 'moon', occultation: 'moon', close: 'moon',
};
const EV_KIND = {
  solar: 'Éclipse de Soleil', lunar: 'Éclipse de Lune', pass: 'Station spatiale', opposition: 'Opposition',
  elongation: 'Élongation', conjunction: 'Conjonction', transit: 'Transit', super: 'Pleine Lune', blue: 'Pleine Lune',
  occultation: 'Occultation', close: 'Rapprochement',
};

function computeEvents() {
  const p = state.place;
  const t0 = performance.now();
  state.events = [
    ...solarEclipses(p, 10), ...lunarEclipses(p, 10),
    ...planetEvents(p, 2), ...moonEvents(p, 2),
  ].sort((a, b) => a.t - b.t);
  console.info(`Événements calculés en ${Math.round(performance.now() - t0)} ms`);
}

async function loadPasses(force = false) {
  try {
    const tles = await fetchTLEs({ force });
    state.passes = await satellitePasses(state.place, tles, 10);
    state.passError = null;
  } catch (e) {
    console.error(e);
    state.passError = e.message;
  }
  if (state.tab === 'events' || state.rendered.events) renderEvents();
}

const passDetail = (p) => `${hm(p.t)} · ${compass(p.start.az)} → ${compass(p.finish.az)} · ${Math.round(p.max.el)}° de haut · mag. ${mag(p.mag)}`;

function renderEvents(enter = false) {
  const body = $('#events-body');
  if (!state.events) { body.innerHTML = skeleton(); return; }
  const now = Date.now();
  const all = [...state.events, ...(state.passes ?? [])].filter((e) => (e.end ?? e.t) > now - 3 * H1).sort((a, b) => a.t - b.t);
  // Grand rendez-vous : prochaine éclipse visible d'ici, sinon prochain événement remarquable.
  const big = all.find((e) => e.type === 'eclipse' && e.visible === true)
    ?? all.find((e) => (e.sub === 'opposition' || e.sub === 'occultation' || e.sub === 'transit') && e.visible === true) ?? all[0];
  const hero = big ? `<button class="card hero tap" data-ev="${evId(big)}">
      <div class="hero-scene">${eventScene(big, { label: big.title })}
        <span class="hero-badge glass">${icon('star')}Prochain grand rendez-vous</span></div>
      <div class="hero-info">
        <p class="eyebrow">${big.visible === true ? 'Visible d’ici' : big.visible === 'faint' ? 'Difficile d’ici' : 'Pas visible d’ici'}</p>
        <h2 class="hero-site" style="margin-top:4px">${big.title}</h2>
        <p class="hero-meta">${icon('calendar')}${cap(fmtDate.format(new Date(big.t)))}</p>
      </div>
      <div class="hero-foot">${icon('clock')}<span class="hero-note">${cap(countdown(big.t))} · ${big.detail}</span>${icon('chevron', 'hero-chev')}</div>
    </button>` : '';

  const f = state.evFilter;
  const shown = all.filter((e) => (f === 'all'
    ? (e.type === 'sat' ? e.t < now + 4 * DAY && e.max.el >= 30 && e.mag < -1.5 : e.visible !== false && e.t < now + 2.1 * 365 * DAY)
    : e.type === f));
  const chips = Object.entries(EV_FILTERS).map(([k, [label, ic]]) => {
    const n = k === 'all' ? null : all.filter((e) => e.type === k).length;
    return `<button class="fchip" data-filter="${k}" aria-pressed="${k === f}">${icon(ic)}${label}${n != null ? ` <i>${n}</i>` : ''}</button>`;
  }).join('');
  let month = '';
  const items = shown.map((e) => {
    const m = fmtMonth.format(new Date(e.t));
    const head = m !== month ? `<p class="month-lbl">${m}</p>` : '';
    month = m;
    const off = e.visible === false;
    return `${head}<button class="card ev tap t-${e.type}${off ? ' off' : ''}" data-ev="${evId(e)}">
        <span class="ev-ic">${icon(EV_ICONS[e.sub] ?? 'star')}</span>
        <span class="ev-txt"><small class="k">${EV_KIND[e.sub] ?? ''}</small><b>${e.title}</b><small class="d">${e.type === 'sat' ? passDetail(e) : e.detail}</small></span>
        <span class="ev-r">${fmtDM.format(new Date(e.t))}<span>${countdown(e.t)}</span></span>
      </button>`;
  }).join('');
  const satNote = f === 'sat' || f === 'all'
    ? (state.passError ? `<p class="footnote">Passages des stations indisponibles (${state.passError}).</p>`
      : !state.passes ? `<p class="footnote">${spinner('inline')}Calcul des passages de l’ISS…</p>` : '') : '';

  body.innerHTML = `
    ${hero}
    <section class="section">
      ${sectionHead('À venir')}
      <div class="chips" role="toolbar" aria-label="Filtrer">${chips}</div>
      ${satNote}
      <div class="evs">${items || '<p class="empty-note">Rien à signaler pour ce filtre.</p>'}</div>
    </section>
    <footer class="foot">Éphémérides <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener">Astronomy Engine</a> ·
      orbites <a href="https://celestrak.org" target="_blank" rel="noopener">CelesTrak</a></footer>`;
  if (enter) animateIn(body, true);
  state.rendered.events = true;
}

const evId = (e) => `${e.sub}-${Math.round(e.t / 60e3)}`;
const findEv = (id) => [...(state.events ?? []), ...(state.passes ?? [])].find((e) => evId(e) === id);

function setFilter(k) {
  if (k === state.evFilter) return;
  state.evFilter = k;
  renderEvents();
  replay([...$$('#events-body .evs > *')].slice(0, 12), 'swap');
}

function openEvent(id) {
  const e = findEv(id);
  if (!e) return;
  const fact = (label, val, wide = false) => `<div class="fact${wide ? ' wide' : ''}"><small>${label}</small><b>${val}</b></div>`;
  const when = (t) => `${fmtDay.format(new Date(t))} · ${hm(t)}`;
  let facts = '', extra = '', fig = '';
  if (e.type === 'eclipse' && e.sub === 'solar') {
    const l = e.local;
    fig = `<div class="sheet-card" style="padding:0;overflow:hidden">${eventScene(e, { H: 140, label: e.title })}</div>`;
    facts = `${fact('Type', cap(e.title.replace('Éclipse ', '').replace(' de Soleil', '')))}
      ${fact('Ici', l ? `${l.kind === 'partial' ? 'Partielle' : cap(l.kind === 'total' ? 'totale' : 'annulaire')} · ${pct(l.obscuration)}` : 'Pas visible')}
      ${l ? fact('Début', `${hm(l.begin)} · Soleil ${Math.round(l.altBegin)}°`) : ''}
      ${l ? fact('Maximum', `${hm(l.peak)} · Soleil ${Math.round(l.altPeak)}°`) : ''}
      ${l ? fact('Fin', `${hm(l.end)} · Soleil ${Math.round(l.altEnd)}°`) : ''}
      ${e.central ? fact(e.kind === 'annular' ? 'Anneau visible' : 'Totalité visible', e.central, true) : ''}`;
    extra = '<p class="sheet-p"><b>Sécurité :</b> ne jamais regarder le Soleil sans lunettes d’éclipse homologuées (ISO 12312-2), ni à travers un instrument sans filtre solaire adapté.</p>';
  } else if (e.type === 'eclipse') {
    const ph = e.phases;
    fig = `<div class="sheet-card" style="padding:0;overflow:hidden">${eventScene(e, { H: 140, label: e.title })}</div>`;
    facts = `${fact('Visibilité', e.detail, true)}
      ${fact('Pénombre', `${hm(ph.penum[0])} → ${hm(ph.penum[1])}`)}
      ${ph.partial ? fact('Partielle', `${hm(ph.partial[0])} → ${hm(ph.partial[1])}`) : ''}
      ${ph.total ? fact('Totalité', `${hm(ph.total[0])} → ${hm(ph.total[1])}`) : ''}
      ${fact('Maximum', when(e.t))}`;
    extra = '<p class="sheet-p">Aucune protection nécessaire : la Lune entre dans l’ombre de la Terre et prend souvent une teinte cuivrée pendant la totalité.</p>';
  } else if (e.type === 'sat') {
    fig = `<div class="sheet-card">${skyplot(e)}</div>`;
    facts = `${fact('Apparition', `${hm(e.start.t)} · ${compass(e.start.az)} · ${Math.round(e.start.el)}°`)}
      ${fact('Au plus haut', `${hm(e.max.t)} · ${compass(e.max.az)} · ${Math.round(e.max.el)}°`)}
      ${fact('Disparition', `${hm(e.finish.t)} · ${compass(e.finish.az)} · ${Math.round(e.finish.el)}°`)}
      ${fact('Éclat', `mag. ${mag(e.mag)}${e.bright ? ' · très brillant' : ''}`)}
      ${fact('Durée visible', `${Math.max(1, Math.round((e.finish.t - e.start.t) / 60e3))} min`)}
      ${fact('Date', fmtDay.format(new Date(e.t)))}`;
    extra = `<p class="sheet-p">${e.sat.long} : un point lumineux qui traverse le ciel sans clignoter.
      ${e.finish.lit ? '' : 'Elle s’éteint en entrant dans l’ombre de la Terre.'} Prévision à quelques secondes près ; elle se décale si l’orbite est corrigée.</p>`;
  } else if (e.type === 'planet') {
    fig = `<div class="sheet-card" style="padding:0;overflow:hidden">${eventScene(e, { H: 140, label: e.title })}</div>`;
    facts = `${fact('Date', when(e.t), true)}${fact('Détails', e.detail, true)}`;
    extra = {
      opposition: '<p class="sheet-p">La planète est à l’opposé du Soleil : au plus près de la Terre, au plus brillant, visible du coucher au lever du Soleil. Le meilleur moment de l’année pour l’observer au télescope.</p>',
      elongation: `<p class="sheet-p">${e.fav ? 'Configuration favorable : ' : 'Configuration peu favorable sous nos latitudes : '}la planète est au plus loin du Soleil dans le ciel, à chercher ${e.evening ? 'après le coucher du Soleil, bas à l’ouest' : 'avant le lever du Soleil, bas à l’est'}.</p>`,
      conjunction: '<p class="sheet-p">Les deux planètes paraissent très proches dans le ciel (elles restent en réalité à des centaines de millions de km l’une de l’autre). Belle cible aux jumelles.</p>',
      transit: '<p class="sheet-p">La planète passe devant le disque du Soleil : un petit point noir qui traverse le Soleil en quelques heures. Observation uniquement avec un filtre solaire.</p>',
    }[e.sub] ?? '';
  } else {
    facts = `${fact('Date', when(e.t), true)}${fact('Détails', e.detail, true)}`;
    extra = {
      super: '<p class="sheet-p">La pleine Lune coïncide avec le passage au plus près de la Terre : jusqu’à 14 % plus grande et 30 % plus lumineuse qu’à l’apogée.</p>',
      blue: '<p class="sheet-p">Deuxième pleine Lune d’un même mois civil, un phénomène qui revient tous les 2 à 3 ans. Elle n’a rien de bleu !</p>',
      occultation: '<p class="sheet-p">La Lune passe devant la planète, qui disparaît d’un coup derrière le bord lunaire puis réapparaît de l’autre côté. Spectaculaire aux jumelles ou au télescope.</p>',
      close: '<p class="sheet-p">La Lune passe tout près de la planète : joli tableau à l’œil nu ou aux jumelles.</p>',
    }[e.sub] ?? '';
  }
  openSheet(e.title, `
    <div class="sheet-hero"><div class="hs-txt"><b>${cap(fmtDate.format(new Date(e.t)))}</b><small>${cap(countdown(e.t))}</small></div></div>
    ${fig ? `<div class="sheet-sec">${fig}</div>` : ''}
    <div class="sheet-sec"><div class="facts">${facts}</div></div>
    ${extra ? `<div class="sheet-sec">${extra}</div>` : ''}`, 'event-sheet');
}

// Carte du ciel d'un passage : nord en haut, est à gauche (vue vers le zénith).
function skyplot(p) {
  const C = 110, R = 96;
  const xy = (az, el) => {
    const r = (R * (90 - Math.max(0, el))) / 90, a = (az * Math.PI) / 180;
    return [C - r * Math.sin(a), C - r * Math.cos(a)];
  };
  const seg = (pts) => pts.map((q, i) => { const [x, y] = xy(q.az, q.el); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' ');
  const lit = p.pts.filter((q) => q.lit && q.el > 0);
  const [mx, my] = xy(p.max.az, p.max.el);
  const [sx, sy] = xy(p.start.az, p.start.el);
  return `<svg class="skyplot" viewBox="0 0 220 230" role="img" aria-label="Trajectoire dans le ciel">
    <circle cx="${C}" cy="${C}" r="${R}" class="sp-horizon"/>
    <circle cx="${C}" cy="${C}" r="${(R * 2) / 3}" class="sp-ring"/><circle cx="${C}" cy="${C}" r="${R / 3}" class="sp-ring"/>
    <line x1="${C}" x2="${C}" y1="${C - R}" y2="${C + R}" class="sp-ring"/><line x1="${C - R}" x2="${C + R}" y1="${C}" y2="${C}" class="sp-ring"/>
    <text x="${C}" y="${C - R - 4}" class="sp-lbl">N</text><text x="${C}" y="${C + R + 13}" class="sp-lbl">S</text>
    <text x="${C - R - 8}" y="${C + 4}" class="sp-lbl">E</text><text x="${C + R + 8}" y="${C + 4}" class="sp-lbl">O</text>
    <path d="${seg(p.pts.filter((q) => q.el > 0))}" class="sp-path shadow"/>
    <path d="${seg(lit)}" class="sp-path"/>
    <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="4" class="sp-dot"/>
    <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="5" fill="#fff"/>
  </svg>`;
}

// ---------- Animations ----------

function animateIn(root, enter, els = [...root.children]) {
  replay(els, enter ? 'rise' : 'swap');
  countUp(root);
}

function replay(els, cls) {
  els.forEach((el, i) => {
    if (!el) return;
    el.style.setProperty('--i', Math.min(i, 8));
    el.classList.remove('rise', 'swap');
    void el.offsetWidth;
    el.classList.add(cls);
  });
}

function countUp(root) {
  $$('[data-count]', root).forEach((el) => {
    const to = Number(el.dataset.count);
    if (el.dataset.count === '' || Number.isNaN(to)) return;
    if (reduceMotion.matches || document.hidden) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 800;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = '0';
    requestAnimationFrame(step);
  });
}

// ---------- Navigation (onglets) ----------

function parseHash() {
  const m = location.hash.match(/^#\/(\w+)(?:\/(\d+))?/);
  return m && TABS.includes(m[1]) ? { tab: m[1], n: m[2] != null ? Number(m[2]) : null } : { tab: 'seeing', n: null };
}

function showTab(tab, { push = true } = {}) {
  const first = !state.rendered[tab];
  state.tab = tab;
  TABS.forEach((t, k) => {
    const page = $(`#${t}`);
    const on = t === tab;
    page.classList.toggle('on', on);
    page.inert = !on;
    const btn = $(`.tabbar [data-tab="${t}"]`);
    btn.setAttribute('aria-selected', String(on));
    if (on) $('.tab-thumb').style.setProperty('--k', k);
  });
  if (push) history.replaceState(null, '', `#/${tab}`);
  if (first) renderTab(tab, true);
  else if (tab === 'aurora' && state.sw && Date.now() - (state.sw.at ?? 0) > 5 * 60e3) loadSolarWind();
}

function renderTab(tab, enter = false) {
  if (tab === 'seeing') renderSeeing(enter);
  if (tab === 'aurora') renderAurora(enter);
  if (tab === 'meteors') {
    if (!state.meteors) { renderMeteors(); defer(() => { computeMeteors(); renderMeteors(true); }); return; }
    renderMeteors(enter);
  }
  if (tab === 'events') {
    if (!state.events) {
      renderEvents();
      defer(() => { computeEvents(); renderEvents(true); if (!state.passes) loadPasses(); });
      return;
    }
    renderEvents(enter);
  }
  state.rendered[tab] = true;
}
// Calcul lourd juste après l'affichage du squelette (minuterie : requestAnimationFrame attend que la page soit visible).
const defer = (fn) => setTimeout(fn, 40);

// Délégation des clics.
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action], [data-tab], [data-night], [data-shower], [data-ev], [data-filter], [data-place], [data-model], [data-theme-pref], [data-sky], [data-geo]');
  if (!t) return;
  if (t.dataset.tab && t.closest('.tabbar')) return showTab(t.dataset.tab);
  if (t.dataset.place) return setPlace(t.dataset.place);
  if (t.dataset.geo != null) return locateMe();
  if (t.dataset.model) return setModel(t.dataset.model);
  if (t.dataset.themePref) return setThemePref(t.dataset.themePref);
  if (t.dataset.sky) return setSky(t.dataset.sky);
  if (t.dataset.filter) return setFilter(t.dataset.filter);
  if (t.dataset.shower) return openShower(t.dataset.shower);
  if (t.dataset.ev) return openEvent(t.dataset.ev);
  if (t.dataset.night) return selectNight(Number(t.dataset.night), t.dataset.scroll === 'night');
  switch (t.dataset.action) {
    case 'settings': return openSettings();
    case 'place': return openPlaces();
    case 'help-seeing': return openSheet('Lire les prévisions', SEEING_HELP);
    case 'help-kp': return openSheet('L’indice Kp', KP_HELP);
    case 'help-meteors': return openSheet('Taux d’étoiles filantes', METEOR_HELP);
    case 'close-sheet': return closeSheet();
    case 'refresh': closeSheet(); return load(true);
    case 'refresh-aurora': return loadAurora(true);
    case 'refresh-in-sheet': load(true); return updateRefreshRow();
    default:
  }
});

// Grand titre élastique et tirer pour actualiser.
for (const page of $$('.page')) {
  const sc = $('.scroller', page);
  const ptr = $('.ptr', page);
  ptr.innerHTML = spinner();
  let armed = false;
  sc.addEventListener('scroll', () => {
    const y = sc.scrollTop;
    const lt = $('.large-title', page);
    if (lt) lt.style.transform = y < 0 ? `scale(${1 + Math.min(0.08, -y / 900)})` : '';
    const pull = Math.max(0, -y);
    if (state.loading || pull === 0) { ptr.style.opacity = 0; ptr.classList.remove('armed'); armed = false; return; }
    const k = Math.min(1, pull / 90);
    ptr.style.opacity = Math.min(1, pull / 30);
    ptr.style.transform = `translateY(${(pull / 2).toFixed(1)}px)`;
    $$('line', ptr).forEach((l, i) => l.classList.toggle('on', i < Math.ceil(k * 8)));
    armed = k >= 1;
    ptr.classList.toggle('armed', armed);
  }, { passive: true });
  sc.addEventListener('touchend', () => { if (armed && !state.loading) { armed = false; load(true); } }, { passive: true });
}

// ---------- Feuille modale ----------

const sheet = $('#sheet');

function openSheet(title, html, cls = '') {
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = html;
  sheet.className = `sheet ${cls}`;
  if (!sheet.open) sheet.showModal();
  $('.sheet-panel', sheet).scrollTop = 0;
  countUp($('#sheet-body'));
}

function closeSheet() {
  if (!sheet.open || sheet.classList.contains('closing')) return;
  if (reduceMotion.matches) { sheet.close(); return; }
  sheet.classList.add('closing');
  setTimeout(() => sheet.close(), 260);
}
sheet.addEventListener('close', () => { sheet.classList.remove('closing'); $('#sheet-body').innerHTML = ''; });
sheet.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

// Glisser vers le bas pour fermer.
{
  const panel = $('.sheet-panel', sheet);
  let y0 = null, dy = 0;
  panel.addEventListener('touchstart', (e) => {
    if (!e.target.closest('.sheet-grab, .sheet-head')) return;
    y0 = e.touches[0].clientY; dy = 0;
    panel.style.transition = 'none';
  }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    panel.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  panel.addEventListener('touchend', () => {
    if (y0 == null) return;
    y0 = null;
    panel.style.transition = '';
    panel.style.transform = '';
    if (dy > 110) closeSheet();
  });
}

const tile = (ic, color) => `<span class="tile-ic" style="--tile:${color}">${icon(ic)}</span>`;
const MODEL_ICONS = { consensus: ['scale', '#3f51c8'], icon_seamless: ['w-cloud', '#4c8fd6'], ecmwf_ifs025: ['globe', '#2f9d8f'], gfs_seamless: ['wind', '#9b6ad6'] };
const SKY_ICONS = { dark: ['star', '#1f2a6b'], rural: ['mountain', '#3a7f6a'], suburb: ['sunset', '#b0723a'], city: ['sky', '#b04a5a'] };

function themePreview(k) {
  const part = (t) => `<span class="tp-screen ${t}"><i class="tp-title"></i><i class="tp-card"></i><i class="tp-card short"></i></span>`;
  return `<span class="tp-phone${k === 'auto' ? ' auto' : ''}">${k === 'auto' ? part('light') + part('dark') : part(k)}</span>`;
}

function refreshDetail() {
  if (state.loading) return `${spinner('inline')}En cours`;
  return state.fc ? hm(state.fc.at) : '–';
}
function updateRefreshRow() {
  const el = $('#sheet .refresh-detail');
  if (el) el.innerHTML = refreshDetail();
}

function openSettings() {
  openSheet('Réglages', `
    <p class="group-label">Apparence</p>
    <div class="group themes" role="radiogroup" aria-label="Apparence">
      ${Object.keys(THEMES).map((k) => `
        <button class="theme-opt" role="radio" data-theme-pref="${k}" aria-checked="${k === state.themePref}">
          ${themePreview(k)}<span class="theme-name">${THEMES[k]}</span><span class="radio" aria-hidden="true">${icon('check')}</span>
        </button>`).join('')}
    </div>

    <p class="group-label">Modèle météo</p>
    <div class="group" role="radiogroup" aria-label="Modèle météo">${Object.entries(MODELS).map(([k, m]) => `
      <button class="row tap" role="radio" data-model="${k}" aria-checked="${k === state.model}">
        ${tile(...MODEL_ICONS[k])}<span class="row-text"><b>${m.label}</b><small>${m.sub}</small></span>${icon('check', 'row-check')}
      </button>`).join('')}
    </div>
    <p class="group-foot">Nuages, seeing et transparence. Le consensus fait la moyenne des trois modèles, heure par heure.</p>

    <p class="group-label">Qualité du ciel</p>
    <div class="group" role="radiogroup" aria-label="Qualité du ciel">${Object.entries(SKIES).map(([k, s]) => `
      <button class="row tap" role="radio" data-sky="${k}" aria-checked="${k === state.sky}">
        ${tile(...SKY_ICONS[k])}<span class="row-text"><b>${s.label}</b><small>${s.sub}</small></span>${icon('check', 'row-check')}
      </button>`).join('')}
    </div>
    <p class="group-foot">Sert à estimer le nombre d’étoiles filantes visibles.</p>

    <p class="group-label">Données</p>
    <div class="group">
      <button class="row tap" data-action="refresh-in-sheet">
        ${tile('refresh', '#3a8f6a')}<span class="row-text"><b>Actualiser les prévisions</b></span>
        <span class="row-detail refresh-detail">${refreshDetail()}</span>
      </button>
    </div>

    <p class="group-label">À propos</p>
    <div class="group">
      <details class="row-details">
        <summary class="row">${tile('telescope', '#3f51c8')}<span class="row-text"><b>Seeing et indice d’observation</b></span>${icon('chevron', 'row-chev')}</summary>
        <div class="details-body">${SEEING_HELP.replace(/help-body/, '')}</div>
      </details>
      <details class="row-details">
        <summary class="row">${tile('aurora', '#2f9d6f')}<span class="row-text"><b>Aurores boréales</b></span>${icon('chevron', 'row-chev')}</summary>
        <div class="details-body">${KP_HELP.replace(/help-body/, '')}</div>
      </details>
      <details class="row-details">
        <summary class="row">${tile('meteor', '#b0723a')}<span class="row-text"><b>Étoiles filantes</b></span>${icon('chevron', 'row-chev')}</summary>
        <div class="details-body">${METEOR_HELP.replace(/help-body/, '')}</div>
      </details>
    </div>
    <p class="credits">Météo <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> ·
      météo de l’espace <a href="https://www.swpc.noaa.gov" target="_blank" rel="noopener">NOAA SWPC</a> ·
      essaims <a href="https://www.imo.net" target="_blank" rel="noopener">IMO</a> ·
      orbites <a href="https://celestrak.org" target="_blank" rel="noopener">CelesTrak</a> ·
      éphémérides <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener">Astronomy Engine</a></p>`, 'settings');
}

function setThemePref(k) {
  if (k === state.themePref || !THEMES[k]) return;
  state.themePref = k;
  store.set('sc-theme', k);
  $$('#sheet [data-theme-pref]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themePref === k)));
  applyTheme();
}

function setModel(k) {
  if (k === state.model || !MODELS[k]) return;
  state.model = k;
  store.set('sc-model', k);
  $$('#sheet [data-model]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.model === k)));
  if (!state.fc) return;
  compute();
  rerenderAll();
}

function setSky(k) {
  if (k === state.sky || !SKIES[k]) return;
  state.sky = k;
  store.set('sc-sky', k);
  $$('#sheet [data-sky]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.sky === k)));
  state.meteors = null;
  if (state.rendered.meteors || state.tab === 'meteors') { computeMeteors(); renderMeteors(); }
}

// ---------- Lieu d'observation ----------

function openPlaces() {
  const isCur = (p) => Math.abs(p.lat - state.place.lat) < 1e-4 && Math.abs(p.lon - state.place.lon) < 1e-4;
  const custom = !PLACES.some(isCur);
  openSheet('Lieu d’observation', `
    <label class="search">${icon('search')}<input type="search" id="place-q" placeholder="Rechercher une ville, un sommet…" autocomplete="off" enterkeyhint="search"></label>
    <div class="search-results group" id="place-results"></div>
    <p class="group-label">Position</p>
    <div class="group">
      <button class="row tap" data-geo>
        ${tile('locate', '#3f51c8')}<span class="row-text"><b>Ma position</b><small id="geo-msg">Utiliser la localisation de l’appareil</small></span>
      </button>
      ${custom ? `<button class="row" role="radio" aria-checked="true">${tile('pin', '#7f5ad6')}<span class="row-text"><b>${state.place.name}</b>
        <small>${num(state.place.lat, 3)}°, ${num(state.place.lon, 3)}° · ${int(state.place.alt)} m</small></span>${icon('check', 'row-check')}</button>` : ''}
    </div>
    <p class="group-label">Sites des Vosges</p>
    <div class="group" role="radiogroup" aria-label="Sites">${PLACES.map((p) => `
      <button class="row tap" role="radio" data-place="${p.id}" aria-checked="${isCur(p)}">
        ${tile('mountain', '#2f6f9d')}<span class="row-text"><b>${p.name}</b><small>${p.alt} m${p.note ? ` · ${p.note}` : ''}</small></span>${icon('check', 'row-check')}
      </button>`).join('')}
    </div>
    <p class="group-foot">Les heures sont celles de cet appareil.</p>`, 'places');
  const q = $('#place-q');
  let timer = null;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => searchPlace(q.value.trim()), 350);
  });
}

let searchResults = [];
async function searchPlace(q) {
  const box = $('#place-results');
  if (!box) return;
  if (q.length < 2) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="row"><span class="row-text"><small>${spinner('inline')}Recherche…</small></span></div>`;
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: q, count: '6', language: 'fr', format: 'json' })}`);
    const j = await res.json();
    searchResults = (j.results ?? []).map((r) => ({
      id: `geo-${r.id}`, name: r.name, lat: r.latitude, lon: r.longitude, alt: r.elevation ?? null,
      note: [r.admin1, r.country].filter(Boolean).join(', '),
    }));
    box.innerHTML = searchResults.length ? searchResults.map((p) => `
      <button class="row tap" data-place="${p.id}">${tile('pin', '#7f5ad6')}<span class="row-text"><b>${p.name}</b><small>${p.note}${p.alt != null ? ` · ${Math.round(p.alt)} m` : ''}</small></span></button>`).join('')
      : '<div class="row"><span class="row-text"><small>Aucun résultat</small></span></div>';
  } catch {
    box.innerHTML = '<div class="row"><span class="row-text"><small>Recherche indisponible</small></span></div>';
  }
}

function locateMe() {
  const msg = $('#geo-msg');
  if (!navigator.geolocation) { if (msg) msg.textContent = 'Localisation non disponible'; return; }
  if (msg) msg.innerHTML = `${spinner('inline')}Localisation…`;
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude: lat, longitude: lon, altitude } = pos.coords;
    applyPlace({ id: 'gps', name: 'Ma position', lat, lon, alt: altitude ?? null });
  }, (err) => {
    if (msg) msg.textContent = err.code === 1 ? 'Localisation refusée' : 'Position introuvable';
  }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
}

function setPlace(id) {
  const p = PLACES.find((x) => x.id === id) ?? searchResults.find((x) => x.id === id);
  if (p) applyPlace(p);
}

function applyPlace(p) {
  state.place = { ...p };
  store.set('sc-place', JSON.stringify(state.place));
  closeSheet();
  state.fc = state.hours = state.nights = null;
  state.meteors = state.events = state.passes = null;
  state.sw = state.swError = null;
  state.night = 0;
  state.rendered = {};
  updateStatuses();
  showTab(state.tab, { push: false });
  load();
}

// ---------- Chargement ----------

function compute() {
  state.hours = computeHours(state.fc, state.model, state.place);
  computeNights();
}

function rerenderAll() {
  renderSeeing(false);
  if (state.rendered.aurora) renderAurora(false);
  if (state.rendered.meteors) renderMeteors(false);
}

async function load(force = false) {
  if (state.loading) return;
  state.loading = true;
  state.error = null;
  // Dernières prévisions connues tout de suite, puis actualisation.
  if (!state.fc) {
    const old = cachedForecast(state.place, { stale: true });
    if (old) { state.fc = old; compute(); renderSeeing(!state.rendered.seeing || state.tab === 'seeing'); state.rendered.seeing = true; }
  }
  updateStatuses(true);
  const auP = loadAurora(force);
  try {
    const shown = state.fc?.at;
    const fc = await fetchForecast(state.place, { force });
    if (state.place.alt == null) {
      state.place.alt = Object.values(fc.raw)[0]?.elevation ?? 0;
      store.set('sc-place', JSON.stringify(state.place));
    }
    const fresh = fc.at !== shown;
    state.fc = fc;
    if (fresh || !state.nights) {
      compute();
      renderSeeing(true);
      state.rendered.seeing = true;
      if (state.rendered.aurora) renderAurora(false);
      if (state.rendered.meteors) renderMeteors(false);
    }
  } catch (e) {
    console.error(e);
    state.error = e.message;
    if (!state.nights) renderSeeing();
  } finally {
    state.loading = false;
    updateStatuses();
    updateRefreshRow();
  }
  await auP;
  if (force && state.rendered.events) { state.events = null; renderTab('events'); }
}

async function loadAurora(force = false) {
  try {
    state.au = await fetchAurora({ force });
    state.auError = null;
    if (force) { state.sw = null; state.swError = null; state.ov = null; state.ovError = null; }
  } catch (e) {
    console.error(e);
    state.auError = `NOAA : ${e.message}`;
  }
  if (state.rendered.aurora || state.tab === 'aurora') { renderAurora(state.tab === 'aurora' && !state.rendered.aurora); state.rendered.aurora = true; }
  updateStatuses();
}

// Sous-titres : lieu, puis heure des données (ou chargement en cours).
function updateStatuses(busy = false) {
  const p = state.place.name;
  const set = (tab, text, b = false) => {
    const el = $(`#${tab} .status`);
    if (!el) return;
    el.classList.toggle('busy', b);
    el.innerHTML = b ? `${spinner('inline')}<span>${text}</span>` : `<span>${text}</span>`;
  };
  set('seeing', busy ? `${p} · actualisation…` : state.fc ? `${p} · prévisions de ${hm(state.fc.at)}${state.fc.stale ? ' (anciennes)' : ''}` : p, busy);
  set('aurora', state.au ? `${p} · NOAA ${hm(state.au.at)}` : p, busy && !state.au);
  set('meteors', `${p} · ${SKIES[state.sky].label.toLowerCase()}`);
  set('events', p);
}

// Revenir dans l'application : recharge si les prévisions ont plus de 30 min.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.fc && Date.now() - state.fc.at > 30 * 60e3) load();
});

$$('[data-ic]').forEach((b) => { b.insertAdjacentHTML('afterbegin', icon(b.dataset.ic)); });
$('.sheet-close').innerHTML = icon('x');

// Hauteur réelle de l'écran : en application installée, iOS donne parfois une fenêtre plus courte que l'écran.
function fitScreen() {
  const portrait = innerHeight >= innerWidth;
  const h = standalone && portrait ? Math.max(innerHeight, screen.height) : innerHeight;
  document.documentElement.style.setProperty('--app-h', `${h}px`);
}
fitScreen();
addEventListener('resize', () => { fitScreen(); if (state.tab === 'aurora' && state.ov) { clearTimeout(fitScreen.t); fitScreen.t = setTimeout(drawMap, 200); } });

document.documentElement.classList.add('no-anim');
applyTheme();
const start = parseHash();
if (start.n != null) state.night = start.n;
showTab(start.tab, { push: false });
requestAnimationFrame(() => document.documentElement.classList.remove('no-anim'));
updateStatuses();
load();
window.addEventListener('hashchange', () => { const r = parseHash(); if (r.tab !== state.tab) showTab(r.tab, { push: false }); });
