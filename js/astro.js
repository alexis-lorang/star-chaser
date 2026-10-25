// Calculs astronomiques (astronomy-engine) : Soleil, Lune, planètes, nuits, crépuscules.
import * as A from 'https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/esm/astronomy.js';
import { CONSTELLATIONS } from './config.js?v=11';

export { A };

const H1 = 3600e3;
export const observer = (p) => new A.Observer(p.lat, p.lon, p.alt ?? 0);
const t = (x) => (x == null ? null : x.date.getTime());

// Hauteur et azimut d'un astre (coordonnées de la date, réfraction normale).
export function altAz(body, date, obs) {
  const eq = A.Equator(body, date, obs, true, true);
  const h = A.Horizon(date, obs, eq.ra, eq.dec, 'normal');
  return { alt: h.altitude, az: h.azimuth, ra: eq.ra, dec: eq.dec };
}
// Point fixe du ciel (radiant d'un essaim) : ascension droite en degrés, déclinaison en degrés.
export function radecAlt(raDeg, decDeg, date, obs) {
  const h = A.Horizon(date, obs, raDeg / 15, decDeg, 'normal');
  return { alt: h.altitude, az: h.azimuth };
}
export const sunAlt = (date, obs) => altAz(A.Body.Sun, date, obs).alt;

export function moonAt(date, obs) {
  const p = altAz(A.Body.Moon, date, obs);
  return { ...p, phase: A.MoonPhase(date), illum: A.Illumination(A.Body.Moon, date).phase_fraction };
}

export function phaseName(ph) {
  if (ph < 8 || ph >= 352) return 'Nouvelle Lune';
  if (ph < 82) return 'Premier croissant';
  if (ph < 98) return 'Premier quartier';
  if (ph < 172) return 'Gibbeuse croissante';
  if (ph < 188) return 'Pleine Lune';
  if (ph < 262) return 'Gibbeuse décroissante';
  if (ph < 278) return 'Dernier quartier';
  return 'Dernier croissant';
}

export function constellation(raHours, decDeg) {
  const c = A.Constellation(raHours, decDeg);
  return CONSTELLATIONS[c.symbol] ?? c.name;
}

const search = (body, obs, dir, from, days) => t(A.SearchRiseSet(body, obs, dir, new Date(from), days));
const searchAlt = (obs, dir, from, days, alt) => t(A.SearchAltitude(A.Body.Sun, obs, dir, new Date(from), days, alt));

// Midi local du jour (heure du navigateur) décalé de n jours.
export function localNoon(n = 0, ref = new Date()) {
  const d = new Date(ref);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Nuit qui commence le soir du jour `noon` : coucher, crépuscules (civil −6°, nautique −12°, astronomique −18°),
 * lever, et passages de la Lune. Sans coucher du soleil (été polaire) : nuit absente ; sans lever : 18 h → 6 h.
 */
export function nightOf(noon, obs) {
  const n0 = noon.getTime();
  const set = search(A.Body.Sun, obs, -1, n0, 1);
  const rise = set ? search(A.Body.Sun, obs, +1, set, 1.2) : null;
  const start = set ?? n0 + 6 * H1;
  const end = rise ?? n0 + 18 * H1;
  const dusk = (alt) => { const x = searchAlt(obs, -1, start - 2 * H1, 1, alt); return x && x < end ? x : null; };
  const dawn = (alt) => { const x = searchAlt(obs, +1, start, 1.2, alt); return x && x <= end + 60e3 ? x : null; };
  const night = {
    noon: n0, start, end, sunset: set, sunrise: rise,
    civil: [dusk(-6), dawn(-6)], naut: [dusk(-12), dawn(-12)], astro: [dusk(-18), dawn(-18)],
  };
  // Lune pendant la nuit : phase au milieu de la nuit, lever / coucher les plus proches, intervalles levée.
  const m = moonAt(new Date((start + end) / 2), obs);
  night.moon = {
    phase: m.phase, illum: m.illum, name: phaseName(m.phase),
    rise: nextAfter(A.Body.Moon, obs, +1, start - 8 * H1, end),
    set: nextAfter(A.Body.Moon, obs, -1, start - 8 * H1, end),
    up: moonUpIntervals(obs, start, end),
  };
  // Nuit noire sans Lune (Soleil sous −18°, Lune couchée).
  const [a0, a1] = night.astro;
  night.dark = a0 && a1 ? a1 - a0 : 0;
  night.moonless = a0 && a1 ? subtract([a0, a1], night.moon.up) : [];
  return night;
}

// Premier lever/coucher après `from`, gardé seulement s'il tombe avant `until`.
function nextAfter(body, obs, dir, from, until) {
  const x = search(body, obs, dir, from, 2);
  return x && x <= until ? x : null;
}

// Intervalles où la Lune est levée entre a et b (échantillonnage par 10 min).
export function moonUpIntervals(obs, a, b) {
  const out = [];
  let cur = null;
  for (let x = a; x <= b; x += 10 * 60e3) {
    const up = altAz(A.Body.Moon, new Date(x), obs).alt > 0;
    if (up && cur == null) cur = x;
    if (!up && cur != null) { out.push([cur, x]); cur = null; }
  }
  if (cur != null) out.push([cur, b]);
  return out;
}

function subtract([a, b], cuts) {
  let parts = [[a, b]];
  for (const [c0, c1] of cuts) {
    parts = parts.flatMap(([x0, x1]) => {
      if (c1 <= x0 || c0 >= x1) return [[x0, x1]];
      const r = [];
      if (c0 > x0) r.push([x0, c0]);
      if (c1 < x1) r.push([c1, x1]);
      return r;
    });
  }
  return parts.filter(([x0, x1]) => x1 - x0 > 5 * 60e3);
}

// Nuits à venir : la première est celle en cours (avant le lever du soleil) ou celle de ce soir.
export function upcomingNights(obs, n = 7, now = Date.now()) {
  const out = [];
  let k = -1;
  const first = nightOf(localNoon(-1), obs);
  if (first.end > now) out.push(first);
  while (out.length < n) {
    k++;
    out.push(nightOf(localNoon(k), obs));
  }
  return out;
}

// Ciel à un instant : Soleil et Lune.
export function skyAt(date, obs) {
  return { sun: altAz(A.Body.Sun, date, obs), moon: moonAt(date, obs) };
}


// Longitude solaire (équinoxe J2000, comme l'IMO) → instant. Précession : ~1,397° par siècle.
export function sunLongitudeTime(lonJ2000, from) {
  const T = (from.getTime() - Date.UTC(2000, 0, 1, 12)) / (36525 * 86400e3);
  const target = (lonJ2000 + 1.39697 * T + 360) % 360;
  return t(A.SearchSunLongitude(target, new Date(from), 370));
}
export function sunLongitudeJ2000(date) {
  const T = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / (36525 * 86400e3);
  return (A.SunPosition(date).elon - 1.39697 * T + 360) % 360;
}

// Latitude géomagnétique (dipôle IGRF 2025, pôle nord géomagnétique 80,8° N, 72,7° O).
export function geomagLat(lat, lon) {
  const r = Math.PI / 180;
  const pl = 80.8 * r, pn = -72.7 * r;
  const s = Math.sin(lat * r) * Math.sin(pl) + Math.cos(lat * r) * Math.cos(pl) * Math.cos(lon * r - pn);
  return Math.asin(s) / r;
}
