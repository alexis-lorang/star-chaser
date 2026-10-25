// Prévisions Open-Meteo + seeing (turbulence par couches), transparence et indice d'observation.
import { MODELS } from './config.js?v=11';

const LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150, 100];
const SURFACE = ['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'cloud_cover', 'temperature_2m',
  'relative_humidity_2m', 'dew_point_2m', 'wind_speed_10m', 'wind_gusts_10m', 'precipitation'];
const ALL_MODELS = MODELS.consensus.ids;
const CACHE_KEY = 'sc-forecast-v1';
const CACHE_TTL = 30 * 60 * 1000;

function hourlyVars() {
  const v = [...SURFACE];
  for (const p of LEVELS) {
    v.push(`temperature_${p}hPa`, `relative_humidity_${p}hPa`, `wind_speed_${p}hPa`, `wind_direction_${p}hPa`, `geopotential_height_${p}hPa`);
  }
  return v;
}

const placeKey = (p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;

export function cachedForecast(place, { stale = false } = {}) {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (c?.key === placeKey(place) && (stale || Date.now() - c.at < CACHE_TTL)) return c;
  } catch { /* cache indisponible */ }
  return null;
}

export async function fetchForecast(place, { force = false } = {}) {
  if (!force) {
    const c = cachedForecast(place);
    if (c) return c;
  }
  let models, aod;
  try {
    // Une requête par modèle (plus robuste qu'une requête unique), aérosols à part (service Air Quality).
    [models, aod] = await Promise.all([
      Promise.all(ALL_MODELS.map((m) => fetchModel(place, m).catch((e) => ({ error: e.message })))),
      fetchAerosols(place).catch(() => null),
    ]);
  } catch (e) {
    const old = cachedForecast(place, { stale: true });
    if (old) return { ...old, stale: true };
    throw e;
  }
  const ok = models.filter((m) => !m.error);
  if (!ok.length) {
    const old = cachedForecast(place, { stale: true });
    if (old) return { ...old, stale: true };
    throw new Error(models[0].error);
  }
  const data = { at: Date.now(), key: placeKey(place), raw: {}, aod };
  ALL_MODELS.forEach((m, i) => { if (!models[i].error) data.raw[m] = models[i]; });
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* quota */ }
  return data;
}

async function getJSON(url, attempt = 1) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 40000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.reason);
    return json;
  } catch (e) {
    if (e.name === 'AbortError') e = new Error('délai dépassé');
    // Nouvel essai après une pause croissante (le service est parfois surchargé quelques secondes).
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1500 * 2 ** (attempt - 1)));
      return getJSON(url, attempt + 1);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchModel(place, model) {
  const params = new URLSearchParams({
    latitude: place.lat, longitude: place.lon,
    hourly: hourlyVars().join(','), models: model,
    forecast_days: '8', timeformat: 'unixtime', timezone: 'GMT', wind_speed_unit: 'ms',
  });
  try {
    const j = await getJSON(`https://api.open-meteo.com/v1/forecast?${params}`);
    return { elevation: j.elevation, hourly: j.hourly };
  } catch (e) {
    throw new Error(`Open-Meteo (${model}) : ${e.message}`);
  }
}

async function fetchAerosols(place) {
  const params = new URLSearchParams({
    latitude: place.lat, longitude: place.lon, hourly: 'aerosol_optical_depth,dust',
    forecast_days: '5', timeformat: 'unixtime', timezone: 'GMT',
  });
  const j = await getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
  return { time: j.hourly.time, aod: j.hourly.aerosol_optical_depth, dust: j.hourly.dust };
}

// ---------- Seeing ----------

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const LAMBDA = 5e-7; // 500 nm
const K2 = (2 * Math.PI / LAMBDA) ** 2;
const RAD2ARCSEC = 206265;

// Profil vertical d'une heure : niveaux au-dessus du sol, du bas vers le haut.
function profile(h, i, ground) {
  const lv = [];
  for (const p of LEVELS) {
    const z = h[`geopotential_height_${p}hPa`]?.[i];
    const T = h[`temperature_${p}hPa`]?.[i];
    const ws = h[`wind_speed_${p}hPa`]?.[i];
    const wd = h[`wind_direction_${p}hPa`]?.[i];
    if (z == null || T == null || ws == null || wd == null || z < ground + 30) continue;
    const r = (wd * Math.PI) / 180;
    const Tk = T + 273.15;
    lv.push({ p, z, T: Tk, th: Tk * (1000 / p) ** 0.286, u: -ws * Math.sin(r), v: -ws * Math.cos(r), ws, rh: h[`relative_humidity_${p}hPa`]?.[i] });
  }
  return lv.sort((a, b) => a.z - b.z);
}

// Seeing (secondes d'arc) → indice 1 (mauvais) à 5 (excellent), continu.
const IDX = [[0.5, 5], [0.8, 4.5], [1.0, 4], [1.4, 3], [2.0, 2], [3.0, 1]];
export function seeingIndex(eps) {
  if (eps == null) return null;
  if (eps <= IDX[0][0]) return 5;
  for (let k = 1; k < IDX.length; k++) {
    if (eps <= IDX[k][0]) {
      const [a, ia] = IDX[k - 1], [b, ib] = IDX[k];
      return ia + ((eps - a) / (b - a)) * (ib - ia);
    }
  }
  return 1;
}

/**
 * Turbulence optique intégrée sur le profil (modèle de Coulman–Dewan) :
 *   Cn² = 2,8 · M² · L0^(4/3),  M = 79·10⁻⁶ · P/T² · dθ/dz,
 *   L0^(4/3) = 0,1^(4/3) · 10^(1,64 + 42·S) en troposphère, 10^(0,506 + 50·S) en stratosphère (S : cisaillement du vent).
 * Seeing = 0,98 λ / r0, avec r0 = (0,423 k² ∫Cn² dz)^(−3/5). Les niveaux de pression sont espacés de 0,5 à 2,5 km :
 * le résultat est recalibré (puissance) puis combiné à une couche au sol qui dépend du vent.
 * Indice 2 : jet stream, couches instables (dθ/dz > 0,5 K/100 m) et nombre de Richardson.
 */
export function seeingHour(lv, wind10) {
  if (lv.length < 5) return null;
  let J = 0, strat = false, ri = 0;
  const layers = [];
  for (let k = 0; k + 1 < lv.length; k++) {
    const a = lv[k], b = lv[k + 1];
    const dz = b.z - a.z;
    if (dz <= 0) continue;
    const P = (a.p + b.p) / 2, T = (a.T + b.T) / 2;
    const dth = (b.th - a.th) / dz;
    const S = Math.hypot(b.u - a.u, b.v - a.v) / dz;
    const lapse = -(b.T - a.T) / dz;
    // Tropopause : gradient thermique < 2 K/km, ou couche très stable au-dessus de 8 km.
    if (!strat && a.z > 7000 && (lapse < 0.002 || (a.z > 8000 && dth > 0.01))) strat = true;
    const M = 79e-6 * (P / (T * T)) * Math.abs(dth);
    const Sx = Math.min(S, 0.03);
    const L43 = 0.1 ** (4 / 3) * 10 ** (strat ? 0.506 + 50 * Sx : 1.64 + 42 * Sx);
    const w = 2.8 * M * M * L43 * dz;
    J += w;
    if (!strat && dth * 100 > 0.5) layers.push({ bot: a.z, top: b.z, grad: dth * 100, w });
    const N2 = (9.81 / T) * dth;
    const Ri = N2 / Math.max(S * S, 1e-9);
    if (Ri < 1) ri += (1 - Math.max(0, Ri)) * S * 1000 * (dz / 1000);
  }
  const jet = Math.max(0, ...lv.filter((l) => l.p >= 150 && l.p <= 350).map((l) => l.ws));
  const epsFA = RAD2ARCSEC * 0.98 * LAMBDA * (0.423 * K2 * J) ** 0.6;
  // Recalibrage : niveaux trop espacés pour voir tout le cisaillement, d'où un terme de jet stream explicite.
  const fa = 0.607 * epsFA ** 1.515 * (1 + 0.5 * clamp((jet - 25) / 40, 0, 1));
  const w = wind10 ?? 3;
  const gl = 0.45 + 0.06 * Math.max(0, w - 3) ** 1.3 + (w < 1 ? 0.1 : 0);
  const eps = (fa ** (5 / 3) + gl ** (5 / 3)) ** 0.6;
  // Couche instable la plus marquante : couches contiguës regroupées, celle qui pèse le plus dans la turbulence.
  const groups = [];
  for (const l of layers) {
    const g = groups.at(-1);
    if (g && Math.abs(g.top - l.bot) < 1) { g.top = l.top; g.grad = Math.max(g.grad, l.grad); g.w += l.w; g.span += (l.top - l.bot) * (l.grad - 0.5); }
    else groups.push({ ...l, span: (l.top - l.bot) * (l.grad - 0.5) });
  }
  const bad = groups.reduce((m, g) => (!m || g.w > m.w ? g : m), null);
  const badPen = clamp(groups.reduce((s, g) => s + g.span, 0) / 1000 * 0.5, 0, 1.2);
  const idx2 = clamp(5 - clamp((jet - 12) / 12, 0, 2.5) - badPen - clamp(ri / 30, 0, 1) - clamp((w - 6) / 6, 0, 0.6), 1, 5);

  return {
    seeing: Math.round(eps * 100) / 100,
    idx1: seeingIndex(eps), idx2,
    jet: Math.round(jet),
    bad: bad ? { bot: bad.bot, top: bad.top, grad: Math.round(bad.grad * 100) / 100 } : null,
  };
}

// Transparence 1–5 : épaisseur optique des aérosols (CAMS), humidité au sol et vers 3 km.
export function transparency(aod, rh2, rh700) {
  let tr = aod == null ? 4 : 5 - 4 * clamp((aod - 0.04) / 0.36, 0, 1) ** 0.7;
  if (rh2 >= 90) tr -= 0.8; else if (rh2 >= 80) tr -= 0.4;
  if (rh700 >= 80) tr -= 0.4;
  return clamp(tr, 1, 5);
}

// ---------- Heures (modèle choisi ou consensus) ----------

export function computeHours(data, modelKey, place) {
  const models = MODELS[modelKey].ids.filter((m) => data.raw[m]);
  const use = models.length ? models : Object.keys(data.raw);
  const times = data.raw[use[0]].hourly.time;
  const aodAt = new Map((data.aod?.time ?? []).map((t, i) => [t, data.aod.aod[i]]));
  const per = use.map((m) => {
    const loc = data.raw[m];
    const h = loc.hourly;
    const ground = place.alt ?? loc.elevation ?? 0;
    return times.map((t) => {
      const i = h.time.indexOf(t);
      if (i < 0) return null;
      const g = (k) => h[k]?.[i];
      if (g('cloud_cover_low') == null) return null;
      const lv = profile(h, i, ground);
      const s = seeingHour(lv, g('wind_speed_10m'));
      const rh700 = g('relative_humidity_700hPa');
      return {
        low: g('cloud_cover_low'), mid: g('cloud_cover_mid'), high: g('cloud_cover_high'), total: g('cloud_cover'),
        temp: g('temperature_2m'), rh: g('relative_humidity_2m'), td: g('dew_point_2m'),
        wind: g('wind_speed_10m') == null ? null : g('wind_speed_10m') * 3.6,
        gust: g('wind_gusts_10m') == null ? null : g('wind_gusts_10m') * 3.6,
        precip: g('precipitation'), rh700, ...s,
      };
    });
  });

  const mean = (xs) => { const v = xs.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  return times.map((t, i) => {
    const rows = per.map((p) => p[i]).filter(Boolean);
    const at = t * 1000;
    if (!rows.length) return { t: at, n: 0 };
    const m = (k) => mean(rows.map((r) => r[k]));
    const bad = rows.map((r) => r.bad).filter(Boolean).sort((a, b) => b.grad - a.grad)[0] ?? null;
    const aod = aodAt.get(t) ?? null;
    const out = {
      t: at, n: rows.length,
      low: m('low'), mid: m('mid'), high: m('high'), total: m('total'),
      temp: m('temp'), rh: m('rh'), td: m('td'), wind: m('wind'), gust: m('gust'), precip: m('precip'),
      seeing: m('seeing'), idx1: m('idx1'), idx2: m('idx2'), jet: m('jet'), bad, aod,
      // Écart entre modèles sur la couverture totale (accord des modèles).
      spread: rows.length > 1 ? Math.max(...rows.map((r) => r.total ?? 0)) - Math.min(...rows.map((r) => r.total ?? 0)) : null,
    };
    out.transp = transparency(aod, out.rh, m('rh700'));
    return out;
  });
}

// ---------- Indice d'observation ----------

export const clearSky = (h) => (h.low == null ? null
  : (1 - h.low / 100) * (1 - h.mid / 100) * (1 - (0.7 * h.high) / 100));

/** Indice 0–100 d'une heure : ciel dégagé (dominant), seeing, transparence, Lune, obscurité. */
export function hourScore(h, sky) {
  const clear = clearSky(h);
  if (clear == null || h.idx1 == null) return null;
  let cf = clear ** 1.15;
  if (h.precip >= 0.1) cf *= 0.3;
  const see = (h.idx1 + h.idx2) / 2;
  const sf = 0.55 + (0.45 * (see - 1)) / 4;
  const tf = 0.7 + (0.3 * (h.transp - 1)) / 4;
  const m = sky.moon;
  const mf = m.alt > 0 ? 1 - 0.4 * m.illum * Math.min(1, Math.sin((m.alt * Math.PI) / 180) * 2 + 0.3) : 1;
  const s = sky.sun.alt;
  const df = s < -18 ? 1 : s < -12 ? 0.85 : s < -6 ? 0.5 : 0;
  return Math.round(100 * cf * sf * tf * mf * df);
}

/** Indice de la nuit : meilleur créneau de deux heures consécutives en nuit noire ou nautique. */
export function nightScore(hours) {
  const dark = hours.filter((h) => h.sky.sun.alt < -12);
  const scored = dark.filter((h) => h.score != null);
  if (!scored.length) return null;
  let best = null;
  for (let k = 0; k < dark.length; k++) {
    const a = dark[k], b = dark[k + 1];
    if (a.score == null) continue;
    const pair = b && b.score != null && b.t - a.t <= 3600e3 ? [a, b] : [a];
    const v = pair.reduce((s, x) => s + x.score, 0) / pair.length;
    if (!best || v > best.score) best = { score: Math.round(v), from: a.t, to: pair.at(-1).t + 3600e3, hours: pair };
  }
  const clearHours = dark.filter((h) => (clearSky(h) ?? 0) >= 0.7).length;
  return { ...best, clearHours, darkHours: dark.length, complete: scored.length === dark.length };
}

export function scoreClass(s) {
  if (s == null) return { key: 'na', label: 'Pas de données' };
  if (s >= 65) return { key: 'top', label: 'Excellente' };
  if (s >= 40) return { key: 'good', label: 'Bonne' };
  if (s >= 20) return { key: 'maybe', label: 'Moyenne' };
  return { key: 'low', label: 'Mauvaise' };
}
