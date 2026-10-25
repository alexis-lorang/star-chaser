// Météo de l'espace (NOAA SWPC) : indice Kp prévu, vent solaire en direct, ovale auroral, tendance 27 jours.
const SWPC = 'https://services.swpc.noaa.gov';
const CACHE_KEY = 'sc-aurora-v1';
const TTL = 15 * 60 * 1000;

async function getJSON(url, ms = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return url.endsWith('.txt') ? await res.text() : await res.json();
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'délai dépassé' : e.message);
  } finally {
    clearTimeout(timer);
  }
}

const utc = (s) => Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`);

// Kp sur 3 h (observé et prévu), échelle G du jour, Kp estimé à la minute, tendance 27 jours.
export async function fetchAurora({ force = false } = {}) {
  if (!force) {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (c && Date.now() - c.at < TTL) return c;
    } catch { /* cache indisponible */ }
  }
  const [kp, scales, kp1m, outlook] = await Promise.all([
    getJSON(`${SWPC}/products/noaa-planetary-k-index-forecast.json`),
    getJSON(`${SWPC}/products/noaa-scales.json`).catch(() => null),
    getJSON(`${SWPC}/json/planetary_k_index_1m.json`).catch(() => null),
    getJSON(`${SWPC}/text/27-day-outlook.txt`).catch(() => null),
  ]);
  const data = {
    at: Date.now(),
    kp: parseKp(kp),
    scales: scales ? Object.entries(scales).map(([k, v]) => ({ k: Number(k), date: v.DateStamp, g: Number(v.G?.Scale ?? 0) })) : [],
    now: kp1m?.length ? { t: utc(kp1m.at(-1).time_tag), kp: kp1m.at(-1).estimated_kp } : null,
    outlook: outlook ? parseOutlook(outlook) : [],
  };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* quota */ }
  return data;
}

// Ancien format (tableau de tableaux avec en-tête) ou nouveau (objets).
function parseKp(j) {
  const rows = Array.isArray(j[0]) ? j.slice(1).map((r) => ({ time_tag: r[0], kp: Number(r[1]), observed: r[2] })) : j;
  return rows.map((r) => ({ t: utc(r.time_tag), kp: Number(r.kp), kind: r.observed })).filter((r) => Number.isFinite(r.kp));
}

function parseOutlook(txt) {
  const M = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const out = [];
  for (const line of txt.split('\n')) {
    const m = line.match(/^(\d{4})\s+(\w{3})\s+(\d{1,2})\s+(\d+)\s+(\d+)\s+(\d+)/);
    if (m && M[m[2]] != null) out.push({ t: Date.UTC(+m[1], M[m[2]], +m[3]), flux: +m[4], ap: +m[5], kp: +m[6] });
  }
  return out;
}

// Vent solaire (satellite actif au point L1) : vitesse, densité, champ magnétique Bt et Bz, dernières heures.
export async function fetchSolarWind(hours = 6) {
  const [mag, wind] = await Promise.all([
    getJSON(`${SWPC}/json/rtsw/rtsw_mag_1m.json`, 45000),
    getJSON(`${SWPC}/json/rtsw/rtsw_wind_1m.json`, 45000),
  ]);
  const since = Date.now() - hours * 3600e3;
  const pick = (rows, keys) => rows
    .filter((r) => r.active && utc(r.time_tag) >= since)
    .map((r) => ({ t: utc(r.time_tag), ...Object.fromEntries(keys.map(([k, src]) => [k, r[src]])) }))
    .sort((a, b) => a.t - b.t);
  const m = pick(mag, [['bt', 'bt'], ['bz', 'bz_gsm']]);
  const w = pick(wind, [['speed', 'proton_speed'], ['density', 'proton_density']]);
  return { m: bin(m, ['bt', 'bz']), w: bin(w, ['speed', 'density']) };
}

// Moyennes par tranches de 10 minutes (lisse le bruit minute par minute).
function bin(rows, keys, step = 10 * 60e3) {
  const map = new Map();
  for (const r of rows) {
    const k = Math.floor(r.t / step) * step;
    const b = map.get(k) ?? { t: k + step / 2, n: {}, s: {} };
    for (const key of keys) {
      if (r[key] == null) continue;
      b.s[key] = (b.s[key] ?? 0) + r[key];
      b.n[key] = (b.n[key] ?? 0) + 1;
    }
    map.set(k, b);
  }
  return [...map.values()].sort((a, b) => a.t - b.t)
    .map((b) => ({ t: b.t, ...Object.fromEntries(keys.map((k) => [k, b.n[k] ? b.s[k] / b.n[k] : null])) }));
}

// Ovale auroral OVATION (prévision à ~30-90 min) : [longitude, latitude, probabilité %].
export async function fetchOvation() {
  const j = await getJSON(`${SWPC}/json/ovation_aurora_latest.json`, 45000);
  return { obs: utc(j['Observation Time']), fc: utc(j['Forecast Time']), pts: j.coordinates.filter((c) => c[2] >= 3) };
}

// ---------- Seuils pour un lieu ----------

/**
 * Bord de l'ovale (latitude géomagnétique au zénith) ≈ 66,5° − 2,05 · Kp.
 * Une aurore reste visible bas sur l'horizon nord à ~3,5° au sud de ce bord, et se photographie (pose longue)
 * jusqu'à ~5,5° plus au sud.
 */
export function thresholds(mlat) {
  const kpFor = (off) => Math.max(0, Math.min(9, (66.5 - off - mlat) / 2.05));
  return { photo: kpFor(5.5), eye: kpFor(3.5), overhead: kpFor(0) };
}

// Probabilité (0–1) d'aurore photographiable pour un Kp donné.
export function kpChance(kp, thr) {
  return Math.max(0, Math.min(1, (kp - (thr.photo - 1.5)) / 2.5));
}

export function gScale(kp) {
  if (kp >= 9) return 5;
  if (kp >= 8) return 4;
  if (kp >= 7) return 3;
  if (kp >= 6) return 2;
  if (kp >= 5) return 1;
  return 0;
}

// Arrondi au tiers à la façon NOAA (5-, 5o, 5+).
export function kpLabel(kp) {
  if (kp == null) return '–';
  const base = Math.round(kp * 3) / 3;
  const n = Math.floor(base + 1e-6), f = Math.round((base - n) * 3);
  return f === 0 ? `${n}` : f === 1 ? `${n}+` : `${n + 1}−`;
}

export function chanceClass(s) {
  if (s == null) return { key: 'na', label: 'Pas de données' };
  if (s >= 65) return { key: 'top', label: 'Très probable' };
  if (s >= 40) return { key: 'good', label: 'Probable' };
  if (s >= 20) return { key: 'maybe', label: 'Possible' };
  return { key: 'low', label: 'Peu probable' };
}
