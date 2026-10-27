// Événements plus rares : éclipses, passages de stations spatiales, planètes (oppositions, élongations,
// conjonctions, transits), Lune (super lunes, lunes bleues, occultations).
import { A, observer, altAz, constellation, sunAlt } from './astro.js?v=22';
import { PLANETS, SATELLITES } from './config.js?v=22';

const DAY = 86400e3;
const H1 = 3600e3;
const ms = (x) => (x == null ? null : x.date ? x.date.getTime() : x instanceof Date ? x.getTime() : x);
const AU_KM = 149597870.7;

// Régions de la bande de centralité des prochaines éclipses de Soleil (catalogue NASA, F. Espenak).
const CENTRAL = {
  '2027-02-06': 'Chili, Argentine, Atlantique, Afrique de l’Ouest',
  '2027-08-02': 'Espagne du Sud, Maroc, Algérie, Tunisie, Libye, Égypte, Arabie',
  '2028-01-26': 'Équateur, Pérou, Brésil, Atlantique, Portugal, Espagne',
  '2028-07-22': 'Australie, Nouvelle-Zélande',
  '2030-06-01': 'Algérie, Tunisie, Grèce, Turquie, Russie, Chine, Japon',
  '2030-11-25': 'Namibie, Botswana, Afrique du Sud, Australie',
  '2031-05-21': 'Angola, Zambie, Tanzanie, Inde, Sri Lanka, Indonésie',
  '2031-11-14': 'Pacifique, Panama',
  '2032-05-09': 'Atlantique Sud',
  '2033-03-30': 'Alaska, extrême est de la Russie',
  '2034-03-20': 'Afrique centrale, Égypte, Arabie, Iran, Pakistan, Inde, Chine',
  '2034-09-12': 'Chili, Argentine, Bolivie, Brésil',
  '2035-03-09': 'Nouvelle-Zélande, Pacifique',
  '2035-09-02': 'Chine, Corée, Japon',
};
const isoDay = (t) => new Date(t).toISOString().slice(0, 10);

const SOLAR_KIND = { total: 'totale', annular: 'annulaire', partial: 'partielle', hybrid: 'hybride' };
const LUNAR_KIND = { total: 'totale', partial: 'partielle', penumbral: 'pénombrale' };

// ---------- Éclipses ----------

export function solarEclipses(place, years = 10, from = Date.now()) {
  const obs = observer(place);
  const out = [];
  let e = A.SearchGlobalSolarEclipse(new Date(from - DAY));
  while (ms(e.peak) < from + years * 365.25 * DAY) {
    const peak = ms(e.peak);
    let local = null;
    try {
      const l = A.SearchLocalSolarEclipse(new Date(peak - 2 * DAY), obs);
      if (Math.abs(ms(l.peak.time) - peak) < 1.5 * DAY) local = l;
    } catch { /* pas d'éclipse locale */ }
    const begin = local?.partial_begin, end = local?.partial_end;
    const seen = local && Math.max(local.peak.altitude, begin?.altitude ?? -90, end?.altitude ?? -90) > 0;
    const ev = {
      type: 'eclipse', sub: 'solar', t: seen ? ms(local.peak.time) : peak, kind: e.kind,
      title: `Éclipse ${SOLAR_KIND[e.kind] ?? ''} de Soleil`,
      central: CENTRAL[isoDay(peak)] ?? null,
      local: seen ? {
        kind: local.kind, obscuration: local.obscuration,
        begin: ms(begin?.time), peak: ms(local.peak.time), end: ms(end?.time),
        altBegin: begin?.altitude, altPeak: local.peak.altitude, altEnd: end?.altitude,
      } : null,
      visible: !!seen,
    };
    ev.detail = ev.local
      ? `${ev.local.kind === 'partial' ? 'Partielle' : cap(SOLAR_KIND[ev.local.kind])} ici : ${Math.round(ev.local.obscuration * 100)} % du Soleil caché`
      : 'Pas visible d’ici';
    out.push(ev);
    e = A.NextGlobalSolarEclipse(e.peak);
  }
  return out;
}

export function lunarEclipses(place, years = 10, from = Date.now()) {
  const obs = observer(place);
  const out = [];
  let e = A.SearchLunarEclipse(new Date(from - DAY));
  while (ms(e.peak) < from + years * 365.25 * DAY) {
    const peak = ms(e.peak);
    const span = (e.kind === 'penumbral' ? e.sd_penum : e.sd_partial) * 60e3;
    const moonAt = (x) => altAz(A.Body.Moon, new Date(x), obs).alt;
    const sunAt = (x) => sunAlt(new Date(x), obs);
    // Visible si la Lune est levée (et le Soleil couché) à un moment de la phase principale.
    let seen = false, best = null;
    for (let x = peak - span; x <= peak + span; x += 10 * 60e3) {
      const ok = moonAt(x) > 0 && sunAt(x) < -3;
      if (ok) { seen = true; if (!best || Math.abs(x - peak) < Math.abs(best - peak)) best = x; }
    }
    const ev = {
      type: 'eclipse', sub: 'lunar', t: peak, kind: e.kind,
      title: `Éclipse ${LUNAR_KIND[e.kind]} de Lune`,
      obscuration: e.obscuration,
      phases: {
        penum: [peak - e.sd_penum * 60e3, peak + e.sd_penum * 60e3],
        partial: e.sd_partial ? [peak - e.sd_partial * 60e3, peak + e.sd_partial * 60e3] : null,
        total: e.sd_total ? [peak - e.sd_total * 60e3, peak + e.sd_total * 60e3] : null,
      },
      moonAltPeak: moonAt(peak),
      visible: seen && e.kind !== 'penumbral' ? true : seen ? 'faint' : false,
    };
    ev.detail = !seen ? 'Lune sous l’horizon ici'
      : e.kind === 'penumbral' ? 'Visible ici, léger assombrissement à peine perceptible'
        : moonAt(peak) > 0 ? `Visible ici, Lune à ${Math.round(moonAt(peak))}° au maximum`
          : 'Visible en partie ici (Lune basse)';
    out.push(ev);
    e = A.NextLunarEclipse(e.peak);
  }
  return out;
}

// ---------- Planètes ----------

const PL = Object.fromEntries(PLANETS.map((p) => [p.body, p]));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Hauteur d'un astre au crépuscule (Soleil à −6°) du soir ou du matin le plus proche.
function twilightAlt(body, t, obs, evening) {
  const sun = A.SearchAltitude(A.Body.Sun, obs, evening ? -1 : +1, new Date(t - (evening ? 0 : 12 * H1)), 1, -6);
  if (!sun) return null;
  return altAz(body, sun.date, obs).alt;
}

export function planetEvents(place, years = 2, from = Date.now()) {
  const obs = observer(place);
  const until = from + years * 365.25 * DAY;
  const out = [];

  // Oppositions des planètes extérieures : planète la plus proche et la plus brillante, visible toute la nuit.
  for (const b of ['Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']) {
    let t = ms(A.SearchRelativeLongitude(A.Body[b], 0, new Date(from)));
    while (t < until) {
      const eq = A.Equator(A.Body[b], new Date(t), obs, true, true);
      const mag = A.Illumination(A.Body[b], new Date(t)).mag;
      const maxAlt = 90 - Math.abs(place.lat - eq.dec);
      out.push({
        type: 'planet', sub: 'opposition', t, body: b,
        title: `Opposition ${/^[AEIOUÉ]/.test(PL[b].name) ? 'd’' : 'de '}${PL[b].name}`,
        detail: `Visible toute la nuit · mag. ${fmtMag(mag)} · ${constellation(eq.ra, eq.dec)} · ${Math.round(maxAlt)}° au plus haut`,
        mag, maxAlt, visible: maxAlt > 10, color: PL[b].color,
      });
      t = ms(A.SearchRelativeLongitude(A.Body[b], 0, new Date(t + 30 * DAY)));
    }
  }

  // Plus grandes élongations de Mercure et Vénus.
  for (const b of ['Mercury', 'Venus']) {
    let e = A.SearchMaxElongation(A.Body[b], new Date(from));
    while (ms(e.time) < until) {
      const t = ms(e.time);
      const evening = e.visibility === 'evening';
      const h = twilightAlt(A.Body[b], t, obs, evening);
      const fav = h != null && h > (b === 'Mercury' ? 10 : 15);
      out.push({
        type: 'planet', sub: 'elongation', t, body: b,
        title: `${PL[b].name} au plus loin du Soleil`,
        detail: `${evening ? 'Le soir, à l’ouest' : 'Le matin, à l’est'} · ${Math.round(e.elongation)}° du Soleil${h != null ? ` · ${Math.round(h)}° de haut au crépuscule` : ''}`,
        elongation: e.elongation, evening, twilightAlt: h, visible: fav ? true : 'faint', fav, color: PL[b].color,
      });
      e = A.SearchMaxElongation(A.Body[b], new Date(t + 10 * DAY));
    }
  }

  // Conjonctions entre planètes brillantes : écart minimal sous 2°, loin du Soleil.
  const bright = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  const vec = (b, t) => A.GeoVector(A.Body[b], new Date(t), true);
  for (let i = 0; i < bright.length; i++) {
    for (let j = i + 1; j < bright.length; j++) {
      const sep = (t) => A.AngleBetween(vec(bright[i], t), vec(bright[j], t));
      let prev = sep(from), cur = sep(from + DAY);
      for (let t = from + DAY; t < until; t += DAY) {
        const next = sep(t + DAY);
        if (cur <= prev && cur <= next && cur < 2) {
          const tm = refineMin(sep, t - DAY, t + DAY);
          const s = sep(tm);
          const elong = A.AngleFromSun(A.Body[bright[i]], new Date(tm));
          if (elong > 12) {
            const evening = A.Elongation(A.Body[bright[i]], new Date(tm)).visibility === 'evening';
            const [a, b] = [PL[bright[i]], PL[bright[j]]];
            out.push({
              type: 'planet', sub: 'conjunction', t: tm, bodies: [bright[i], bright[j]],
              title: `Conjonction ${a.name} – ${b.name}`,
              detail: `${fmtSep(s)} d’écart · ${evening ? 'le soir' : 'le matin'} · à ${Math.round(elong)}° du Soleil`,
              sep: s, visible: s < 1 ? true : 'faint', evening, color: a.color,
            });
          }
        }
        prev = cur; cur = next;
      }
    }
  }

  // Transits de Mercure et Vénus devant le Soleil (rares) : sur 15 ans.
  for (const b of ['Mercury', 'Venus']) {
    const tr = A.SearchTransit(A.Body[b], new Date(from));
    if (ms(tr.peak) < from + 15 * 365.25 * DAY) {
      const t = ms(tr.peak);
      const sAlt = sunAlt(new Date(t), obs);
      out.push({
        type: 'planet', sub: 'transit', t, body: b,
        title: `Transit de ${PL[b].name} devant le Soleil`,
        detail: `${sAlt > 0 ? `Visible ici (Soleil à ${Math.round(sAlt)}°)` : 'Soleil couché ici au maximum'} · filtre solaire indispensable`,
        start: ms(tr.start), finish: ms(tr.finish), visible: sAlt > 0, color: PL[b].color,
      });
    }
  }
  return out;
}

function refineMin(f, a, b) {
  // Section dorée sur [a, b] (fonction unimodale).
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a), d = a + g * (b - a);
  for (let k = 0; k < 30; k++) {
    if (f(c) < f(d)) b = d; else a = c;
    c = b - g * (b - a); d = a + g * (b - a);
  }
  return (a + b) / 2;
}

const fmtMag = (m) => (m < 0 ? `−${Math.abs(m).toFixed(1)}` : m.toFixed(1)).replace('.', ',');
const fmtSep = (deg) => (deg < 1 ? `${Math.round(deg * 60)}′` : `${deg.toFixed(1).replace('.', ',')}°`);

// ---------- Lune ----------

export function moonEvents(place, years = 2, from = Date.now()) {
  const obs = observer(place);
  const until = from + years * 365.25 * DAY;
  const out = [];
  // Pleines lunes : super lunes (distance < 360 000 km) et lunes bleues (deuxième pleine lune du mois).
  let q = A.SearchMoonQuarter(new Date(from));
  const fulls = [];
  while (ms(q.time) < until) {
    if (q.quarter === 2) fulls.push(ms(q.time));
    q = A.NextMoonQuarter(q);
  }
  fulls.forEach((t, k) => {
    const dist = A.GeoMoon(new Date(t)).Length() * AU_KM;
    const d = new Date(t), p = fulls[k - 1] ? new Date(fulls[k - 1]) : null;
    if (dist < 360000) {
      out.push({ type: 'moon', sub: 'super', t, title: 'Super Lune', dist,
        detail: `Pleine Lune au plus près de la Terre · ${Math.round(dist).toLocaleString('fr-FR')} km`, visible: true });
    }
    if (p && p.getMonth() === d.getMonth() && p.getFullYear() === d.getFullYear()) {
      out.push({ type: 'moon', sub: 'blue', t, title: 'Lune bleue', detail: 'Deuxième pleine Lune du mois', visible: true });
    }
  });

  // Rapprochements serrés et occultations de planètes par la Lune, vus d'ici, de nuit.
  for (const p of PLANETS.filter((x) => ['Venus', 'Mars', 'Jupiter', 'Saturn', 'Mercury'].includes(x.body))) {
    const body = A.Body[p.body];
    const geoSep = (t) => A.AngleBetween(A.GeoVector(A.Body.Moon, new Date(t), true), A.GeoVector(body, new Date(t), true));
    for (let t = from; t < until; t += 6 * H1) {
      // La Lune gagne au moins ~11° par jour sur une planète : on saute les jours où elle est loin.
      const g = geoSep(t);
      if (g > 4) { if (g > 20) t += ((g - 15) / 14) * DAY; continue; }
      // Écart vu d'ici, minute par minute autour du minimum.
      const topo = (x) => {
        const d = new Date(x);
        const m = A.Equator(A.Body.Moon, d, obs, true, true), b = A.Equator(body, d, obs, true, true);
        return A.AngleBetween(m.vec, b.vec);
      };
      const tm = refineMin(topo, t - 6 * H1, t + 18 * H1);
      const s = topo(tm);
      const moonAlt = altAz(A.Body.Moon, new Date(tm), obs).alt;
      const sAlt = sunAlt(new Date(tm), obs);
      const r = 0.26; // rayon apparent de la Lune (°)
      if (s < 1.5 && moonAlt > 5 && sAlt < -6 && !out.some((e) => e.body === p.body && Math.abs(e.t - tm) < 2 * DAY)) {
        const occ = s < r;
        out.push({
          type: 'moon', sub: occ ? 'occultation' : 'close', t: tm, body: p.body,
          title: occ ? `Occultation de ${p.name} par la Lune` : `La Lune frôle ${p.name}`,
          detail: occ ? `${p.name} disparaît derrière la Lune · Lune à ${Math.round(moonAlt)}°`
            : `${fmtSep(s)} d’écart · Lune à ${Math.round(moonAlt)}° de haut`,
          sep: s, visible: true, color: p.color,
        });
      }
      t += 2 * DAY;
    }
  }
  return out;
}

// ---------- Stations spatiales ----------

const TLE_KEY = 'sc-tle-v1';
const TLE_TTL = 12 * H1;

export async function fetchTLEs({ force = false } = {}) {
  if (!force) {
    try {
      const c = JSON.parse(localStorage.getItem(TLE_KEY));
      if (c && Date.now() - c.at < TLE_TTL) return c.tles;
    } catch { /* cache indisponible */ }
  }
  const tles = {};
  await Promise.all(SATELLITES.map(async (s) => {
    const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${s.id}&FORMAT=TLE`);
    if (!res.ok) throw new Error(`CelesTrak HTTP ${res.status}`);
    const lines = (await res.text()).trim().split(/\r?\n/).map((l) => l.trim());
    if (lines.length >= 3) tles[s.id] = [lines[1], lines[2]];
  }));
  try { localStorage.setItem(TLE_KEY, JSON.stringify({ at: Date.now(), tles })); } catch { /* quota */ }
  return tles;
}

let satLib = null;
const loadSat = () => (satLib ??= import('https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/+esm'));

/**
 * Passages visibles : satellite éclairé par le Soleil, observateur dans la nuit (Soleil sous −6°),
 * hauteur maximale au-dessus de 10°. Pas de 20 s, sur `days` jours.
 */
export async function satellitePasses(place, tles, days = 10, from = Date.now()) {
  const sat = await loadSat();
  const obs = observer(place);
  const gd = { latitude: sat.degreesToRadians(place.lat), longitude: sat.degreesToRadians(place.lon), height: (place.alt ?? 0) / 1000 };
  const out = [];
  for (const s of SATELLITES) {
    const tle = tles[s.id];
    if (!tle) continue;
    const rec = sat.twoline2satrec(tle[0], tle[1]);
    let pass = null;
    const step = 20e3;
    // Direction du Soleil (repère équatorial, km), mise à jour toutes les 10 minutes.
    let sunVec = null, sunT = 0;
    for (let t = from; t < from + days * DAY; t += step) {
      const d = new Date(t);
      const pv = sat.propagate(rec, d);
      if (!pv.position) continue;
      const gmst = sat.gstime(d);
      const look = sat.ecfToLookAngles(gd, sat.eciToEcf(pv.position, gmst));
      const el = (look.elevation * 180) / Math.PI;
      if (el > 0) {
        if (t - sunT > 600e3) {
          const v = A.GeoVector(A.Body.Sun, d, false);
          sunVec = [v.x * AU_KM, v.y * AU_KM, v.z * AU_KM];
          sunT = t;
        }
        const lit = sunlit(pv.position, sunVec);
        const sAlt = sunAlt(d, obs);
        const az = (look.azimuth * 180) / Math.PI;
        const pt = { t, el, az, lit, dark: sAlt < -6, range: look.rangeSat };
        if (!pass) pass = { sat: s, pts: [] };
        pass.pts.push(pt);
      } else if (pass) {
        const p = summarize(pass);
        if (p) out.push(p);
        pass = null;
        t += 50 * 60e3; // prochain passage au plus tôt ~ une orbite plus tard
      }
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

function sunlit(r, s) {
  // Ombre cylindrique de la Terre : satellite derrière la Terre et à moins d'un rayon terrestre de l'axe.
  const sl = Math.hypot(...s);
  const u = s.map((x) => x / sl);
  const dot = r.x * u[0] + r.y * u[1] + r.z * u[2];
  if (dot > 0) return true;
  const px = r.x - dot * u[0], py = r.y - dot * u[1], pz = r.z - dot * u[2];
  return Math.hypot(px, py, pz) > 6371;
}

function summarize(pass) {
  const vis = pass.pts.filter((p) => p.lit && p.dark && p.el >= 5);
  if (!vis.length) return null;
  const max = vis.reduce((m, p) => (p.el > m.el ? p : m));
  if (max.el < 10) return null;
  // Magnitude : éclat standard à 1 000 km, corrigé de la distance et de la phase (sphère diffuse).
  const mag = (p) => pass.sat.mag + 5 * Math.log10(p.range / 1000) - 2.5 * Math.log10(phaseFactor(p));
  const m = Math.min(...vis.map(mag));
  return {
    type: 'sat', sub: 'pass', sat: pass.sat, t: vis[0].t, end: vis.at(-1).t, max,
    start: vis[0], finish: vis.at(-1), mag: m, pts: pass.pts,
    title: `Passage ${pass.sat.name === 'ISS' ? 'de l’ISS' : `de ${pass.sat.name}`}`,
    visible: true, bright: max.el >= 40 && m < -2.5,
  };
}

// Facteur de phase approché : éclairement moyen, plus faible quand le satellite est bas (lumière rasante).
function phaseFactor(p) {
  return 0.35 + 0.65 * Math.sin((Math.max(5, p.el) * Math.PI) / 180);
}

// Points cardinaux.
export function compass(az) {
  const names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  return names[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];
}
