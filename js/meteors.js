// Pluies d'étoiles filantes : liste de travail de l'IMO (International Meteor Organization),
// maximum calculé chaque année à partir de la longitude solaire (J2000), taux visible selon le radiant et la Lune.
import { A, observer, altAz, radecAlt, sunAlt, nightOf, localNoon, sunLongitudeTime, sunLongitudeJ2000, constellation, phaseName } from './astro.js?v=21';

/*
 * code, nom, début et fin d'activité [mois, jour], longitude solaire du maximum (λ☉ J2000), ZHR,
 * radiant au maximum (α, δ en degrés), vitesse (km/s), indice de population r,
 * pentes d'activité b (avant, après : ZHR × 10^(−b·|Δλ|)), corps parent.
 */
export const SHOWERS = [
  { code: 'QUA', name: 'Quadrantides', start: [12, 28], end: [1, 12], lambda: 283.15, zhr: 80, ra: 230, dec: 49, v: 41, r: 2.1, b: [2.2, 2.2], parent: 'astéroïde 2003 EH1', major: true,
    note: 'Pic très bref, quelques heures seulement : il faut tomber au bon moment. Radiant haut en fin de nuit.' },
  { code: 'LYR', name: 'Lyrides', start: [4, 14], end: [4, 30], lambda: 32.32, zhr: 18, ra: 271, dec: 34, v: 49, r: 2.1, b: [0.6, 0.6], parent: 'comète C/1861 G1 Thatcher', major: true,
    note: 'Essaim modeste mais très ancien (observé depuis 2 700 ans), sursauts possibles. Meilleur en fin de nuit.' },
  { code: 'ETA', name: 'η-Aquarides', start: [4, 19], end: [5, 28], lambda: 45.5, zhr: 50, ra: 338, dec: -1, v: 66, r: 2.4, b: [0.075, 0.075], parent: 'comète 1P/Halley', major: true,
    note: 'Poussières de la comète de Halley. Sous nos latitudes, le radiant reste bas : quelques météores juste avant l’aube.' },
  { code: 'ELY', name: 'η-Lyrides', start: [5, 3], end: [5, 14], lambda: 50.0, zhr: 3, ra: 287, dec: 44, v: 43, r: 3.0, b: [0.15, 0.15], parent: 'comète C/1983 H1 IRAS–Araki–Alcock' },
  { code: 'JBO', name: 'Bootides de juin', start: [6, 22], end: [7, 2], lambda: 92.6, zhr: 2, ra: 224, dec: 48, v: 18, r: 2.2, b: [1, 1], parent: 'comète 7P/Pons–Winnecke', variable: true,
    note: 'Presque inactives d’ordinaire, sursauts imprévisibles (1998 : 100 par heure).' },
  { code: 'CAP', name: 'α-Capricornides', start: [7, 3], end: [8, 15], lambda: 127, zhr: 5, ra: 307, dec: -10, v: 23, r: 2.5, b: [0.08, 0.08], parent: 'comète 169P/NEAT', fireballs: true,
    note: 'Peu nombreuses mais réputées pour leurs bolides, lents et brillants.' },
  { code: 'SDA', name: 'δ-Aquarides du Sud', start: [7, 12], end: [8, 23], lambda: 127, zhr: 25, ra: 340, dec: -16, v: 41, r: 2.5, b: [0.09, 0.09], parent: 'comète 96P/Machholz (probable)', major: true,
    note: 'Radiant bas dans le Verseau : meilleur vers 2 h – 3 h, loin des lumières au sud.' },
  { code: 'PER', name: 'Perséides', start: [7, 17], end: [8, 24], lambda: 140.0, zhr: 100, ra: 48, dec: 58, v: 59, r: 2.2, b: [0.2, 0.4], parent: 'comète 109P/Swift–Tuttle', major: true,
    note: 'Les « larmes de saint Laurent », l’essaim le plus populaire par les nuits d’été. Météores rapides, souvent avec traînée.' },
  { code: 'KCG', name: 'κ-Cygnides', start: [8, 3], end: [8, 25], lambda: 145, zhr: 3, ra: 286, dec: 59, v: 23, r: 3.0, b: [0.1, 0.1], parent: 'astéroïde 2008 ED69 (probable)' },
  { code: 'AUR', name: 'Aurigides', start: [8, 28], end: [9, 5], lambda: 158.6, zhr: 6, ra: 91, dec: 39, v: 66, r: 2.5, b: [0.5, 0.5], parent: 'comète C/1911 N1 Kiess',
    note: 'Bref et modeste, sursauts possibles. Radiant haut en fin de nuit.' },
  { code: 'SPE', name: 'ε-Perséides de septembre', start: [9, 5], end: [9, 21], lambda: 167.2, zhr: 5, ra: 48, dec: 40, v: 64, r: 3.0, b: [0.4, 0.4], parent: 'inconnu' },
  { code: 'DRA', name: 'Draconides', start: [10, 6], end: [10, 10], lambda: 195.4, zhr: 5, ra: 262, dec: 54, v: 20, r: 2.6, b: [1.5, 1.5], parent: 'comète 21P/Giacobini–Zinner', variable: true, major: true,
    note: 'Visibles dès la tombée de la nuit, radiant haut le soir. D’ordinaire faibles, sursauts possibles (2011, 2018).' },
  { code: 'STA', name: 'Taurides du Sud', start: [9, 10], end: [11, 20], lambda: 197, zhr: 5, ra: 32, dec: 9, v: 27, r: 2.3, b: [0.03, 0.03], parent: 'comète 2P/Encke', fireballs: true,
    note: 'Taux faible mais longue activité et bolides fréquents, surtout fin octobre – début novembre.' },
  { code: 'ORI', name: 'Orionides', start: [10, 2], end: [11, 7], lambda: 208, zhr: 20, ra: 95, dec: 16, v: 66, r: 2.5, b: [0.12, 0.12], parent: 'comète 1P/Halley', major: true,
    note: 'Poussières de la comète de Halley, très rapides. Radiant haut en seconde partie de nuit.' },
  { code: 'LMI', name: 'Léo-Minorides', start: [10, 19], end: [10, 27], lambda: 209, zhr: 2, ra: 162, dec: 37, v: 62, r: 3.0, b: [0.4, 0.4], parent: 'comète C/1739 K1 Zanotti' },
  { code: 'NTA', name: 'Taurides du Nord', start: [10, 20], end: [12, 10], lambda: 230, zhr: 5, ra: 58, dec: 22, v: 29, r: 2.3, b: [0.03, 0.03], parent: 'comète 2P/Encke', fireballs: true,
    note: 'Taux faible mais bolides fréquents, radiant haut vers minuit.' },
  { code: 'LEO', name: 'Léonides', start: [11, 6], end: [11, 30], lambda: 235.27, zhr: 15, ra: 152, dec: 22, v: 71, r: 2.5, b: [0.4, 0.4], parent: 'comète 55P/Tempel–Tuttle', major: true,
    note: 'Tempêtes célèbres (1833, 1966, 1999–2002), taux modeste ces années-ci. Les plus rapides de toutes.' },
  { code: 'AMO', name: 'α-Monocérotides', start: [11, 15], end: [11, 25], lambda: 239.32, zhr: 5, ra: 117, dec: 1, v: 65, r: 2.4, b: [3, 3], parent: 'comète inconnue', variable: true,
    note: 'Sursauts très brefs tous les quelques dizaines d’années (1995, 2019).' },
  { code: 'NOO', name: 'Orionides de novembre', start: [11, 13], end: [12, 6], lambda: 248, zhr: 3, ra: 91, dec: 16, v: 44, r: 3.0, b: [0.1, 0.1], parent: 'inconnu' },
  { code: 'MON', name: 'Monocérotides', start: [11, 27], end: [12, 20], lambda: 257, zhr: 2, ra: 100, dec: 8, v: 41, r: 3.0, b: [0.2, 0.2], parent: 'comète C/1917 F1 Mellish' },
  { code: 'HYD', name: 'σ-Hydrides', start: [12, 3], end: [12, 20], lambda: 265.5, zhr: 7, ra: 125, dec: 0, v: 58, r: 3.0, b: [0.2, 0.2], parent: 'inconnu' },
  { code: 'GEM', name: 'Géminides', start: [12, 4], end: [12, 20], lambda: 262.2, zhr: 150, ra: 112, dec: 33, v: 35, r: 2.6, b: [0.39, 0.81], parent: 'astéroïde 3200 Phaéton', major: true,
    note: 'L’essaim le plus riche de l’année, visible dès le soir. Météores assez lents et souvent brillants.' },
  { code: 'COM', name: 'Comae Bérénicides', start: [12, 12], end: [12, 23], lambda: 268, zhr: 3, ra: 175, dec: 18, v: 65, r: 3.0, b: [0.3, 0.3], parent: 'inconnu' },
  { code: 'DLM', name: 'Léo-Minorides de décembre', start: [12, 5], end: [2, 4], lambda: 268, zhr: 5, ra: 161, dec: 30, v: 64, r: 3.0, b: [0.05, 0.05], parent: 'inconnu' },
  { code: 'URS', name: 'Ursides', start: [12, 17], end: [12, 26], lambda: 270.7, zhr: 10, ra: 217, dec: 76, v: 33, r: 3.0, b: [0.9, 0.9], parent: 'comète 8P/Tuttle', major: true,
    note: 'Essaim discret juste avant Noël. Radiant près de la Petite Ourse, au-dessus de l’horizon toute la nuit.' },
];

const DAY = 86400e3;
const at = (y, [m, d]) => new Date(y, m - 1, d).getTime();

// Activité d'une saison (maximum de l'année en cours ou suivante) : dates de début, maximum, fin.
function season(s, from) {
  const peak = sunLongitudeTime(s.lambda, new Date(from));
  const y = new Date(peak).getFullYear();
  let start = at(y, s.start), end = at(y, s.end) + DAY;
  if (start > peak) start = at(y - 1, s.start);
  if (end < peak) end = at(y + 1, s.end) + DAY;
  return { peak, start, end };
}

// ZHR à un instant, selon l'écart en longitude solaire au maximum.
export function zhrAt(s, date) {
  let d = sunLongitudeJ2000(new Date(date)) - s.lambda;
  d = ((d + 540) % 360) - 180;
  return s.zhr * 10 ** (-(d < 0 ? s.b[0] : s.b[1]) * Math.abs(d));
}

/**
 * Taux horaire visible : ZHR × sin(hauteur du radiant) × r^(mag. limite − 6,5).
 * La magnitude limite baisse avec la Lune (éclat et hauteur) et le crépuscule.
 */
export function visibleRate(s, date, obs, lm0) {
  const d = new Date(date);
  const sun = sunAlt(d, obs);
  if (sun > -12) return { hr: 0, rad: null, sun };
  const rad = radecAlt(s.ra, s.dec, d, obs).alt;
  if (rad <= 0) return { hr: 0, rad, sun };
  const m = altAz(A.Body.Moon, d, obs);
  const illum = A.Illumination(A.Body.Moon, d).phase_fraction;
  let lm = lm0;
  if (m.alt > -2) lm -= 2.2 * illum ** 1.2 * Math.min(1, Math.max(0, Math.sin((m.alt * Math.PI) / 180) * 1.5 + 0.2));
  if (sun > -18) lm -= ((sun + 18) / 6) * 1.5;
  const hr = zhrAt(s, d) * Math.sin((rad * Math.PI) / 180) * s.r ** (lm - 6.5);
  return { hr, rad, sun, moonAlt: m.alt, illum, lm };
}

// Profil d'une nuit (pas de 15 min) et taux maximal.
export function nightProfile(s, night, obs, lm0) {
  const pts = [];
  for (let x = night.start; x <= night.end; x += 15 * 60e3) {
    const v = visibleRate(s, x, obs, lm0);
    const moon = altAz(A.Body.Moon, new Date(x), obs).alt;
    pts.push({ t: x, ...v, rad: v.rad ?? radecAlt(s.ra, s.dec, new Date(x), obs).alt, moonAlt: moon });
  }
  const best = pts.reduce((m, p) => (p.hr > (m?.hr ?? -1) ? p : m), null);
  return { pts, best };
}

// 120 météores/h → 100, 20/h → 58, 5/h → 30, 1/h → 10.
export const rateScore = (hr) => Math.round(Math.max(0, Math.min(100, (100 * Math.log10(1 + hr / 2)) / Math.log10(61))));

export function meteorClass(s) {
  if (s == null) return { key: 'na', label: 'Pas de données' };
  if (s >= 65) return { key: 'top', label: 'Excellente' };
  if (s >= 40) return { key: 'good', label: 'Bonne' };
  if (s >= 20) return { key: 'maybe', label: 'Moyenne' };
  return { key: 'low', label: 'Faible' };
}

// Une saison d'un essaim pour un lieu : meilleure nuit autour du maximum, conditions (Lune, radiant).
export function evaluate(s, place, lm0, from = Date.now()) {
  const obs = observer(place);
  const radMax = 90 - Math.abs(place.lat - s.dec);
  // Départ 75 jours avant : une activité longue (Taurides) peut avoir son maximum passé et durer encore.
  let sea = season(s, from - 75 * DAY);
  if (sea.end < from) sea = season(s, sea.peak + 30 * DAY);
  // Nuits candidates : celle du maximum et ses voisines (pic en journée, Lune gênante...).
  const peakDay = new Date(sea.peak);
  const base = Math.round((new Date(peakDay).setHours(12, 0, 0, 0) - new Date().setHours(12, 0, 0, 0)) / DAY);
  const offset = peakDay.getHours() < 12 ? -1 : 0;
  const nights = [-1, 0, 1].map((k) => nightOf(localNoon(base + offset + k), obs));
  const evals = nights.map((n) => ({ night: n, ...nightProfile(s, n, obs, lm0) }));
  const best = evals.reduce((m, e) => ((e.best?.hr ?? 0) > (m.best?.hr ?? 0) ? e : m), evals[1]);
  const mid = new Date((best.night.start + best.night.end) / 2);
  const eq = { ra: s.ra / 15, dec: s.dec };
  return {
    s, ...sea, radMax, visible: radMax > 10,
    night: best.night, pts: best.pts, best: best.best,
    hr: best.best?.hr ?? 0, score: rateScore(best.best?.hr ?? 0),
    moon: { illum: A.Illumination(A.Body.Moon, mid).phase_fraction, phase: A.MoonPhase(mid), name: phaseName(A.MoonPhase(mid)) },
    con: constellation(eq.ra, eq.dec),
    active: sea.start <= from && from <= sea.end,
  };
}

export function evaluateAll(place, lm0, from = Date.now()) {
  return SHOWERS.map((s) => evaluate(s, place, lm0, from)).filter((e) => e.visible).sort((a, b) => a.peak - b.peak);
}

// Intervalles d'activité d'un essaim dans une année civile (deux morceaux si l'activité chevauche le Nouvel An).
export function yearSpans(s, y) {
  const peak = sunLongitudeTime(s.lambda, new Date(y, 0, 1));
  const st = at(y, s.start), en = at(y, s.end) + DAY;
  const spans = st <= en ? [[st, en]] : [[at(y, [1, 1]), en], [st, at(y + 1, [1, 1])]];
  return { peak, spans };
}

// Essaims actifs cette nuit : taux maximal et heure.
export function activeTonight(night, place, lm0) {
  const obs = observer(place);
  const mid = (night.start + night.end) / 2;
  return SHOWERS.map((s) => {
    const y = new Date(mid).getFullYear();
    const spans = [y - 1, y, y + 1].flatMap((yy) => {
      const st = at(yy, s.start), en = at(yy, s.end) + DAY;
      return st <= en ? [[st, en]] : [[st, at(yy + 1, s.end) + DAY]];
    });
    if (!spans.some(([a, b]) => mid >= a && mid <= b)) return null;
    if (90 - Math.abs(place.lat - s.dec) < 10) return null;
    const p = nightProfile(s, night, obs, lm0);
    return { s, hr: p.best?.hr ?? 0, t: p.best?.t, zhr: zhrAt(s, mid) };
  }).filter(Boolean).sort((a, b) => b.hr - a.hr);
}
