// Illustrations nocturnes : ciel étoilé, Lune en phase, nuages, aurores, étoiles filantes, relief des Vosges.
let uid = 0;

// Générateur pseudo-aléatoire déterministe (mêmes étoiles à chaque affichage).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ciel selon la qualité de la nuit : bleu nuit profond quand c'est bon, gris bleuté quand c'est couvert.
const SKIES = {
  top: ['#050821', '#111a4a', '#2c3274'],
  good: ['#070a24', '#151d4c', '#323773'],
  maybe: ['#0d1230', '#212852', '#3d4270'],
  low: ['#171b33', '#2a2f4b', '#434865'],
  na: ['#171b33', '#2a2f4b', '#434865'],
};

const f1 = (x) => x.toFixed(1);

function stars(W, H, n, maxY, seed, twinkle = true) {
  const r = rng(seed);
  let g = '';
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() ** 1.3 * maxY;
    const size = r() < 0.08 ? 1.5 : r() < 0.4 ? 1 : 0.65;
    const o = (0.45 + r() * 0.55).toFixed(2);
    const tw = twinkle && r() < 0.35;
    g += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${size}" fill="#fff" opacity="${o}"${tw ? ` class="sc-tw" style="--d:${(-r() * 3).toFixed(2)}s"` : ''}/>`;
  }
  return g;
}

// Relief : crête lointaine et colline proche (Vosges arrondies), avec une lunette sur un trépied.
function ridges(W, H, scope = true) {
  const hy = H * 0.74;
  let g = `<path d="M0 ${H} L0 ${f1(hy)} C${f1(W * 0.12)} ${f1(hy - H * 0.1)} ${f1(W * 0.22)} ${f1(hy - H * 0.04)} ${f1(W * 0.32)} ${f1(hy - H * 0.11)}
    S${f1(W * 0.52)} ${f1(hy - H * 0.02)} ${f1(W * 0.62)} ${f1(hy - H * 0.08)} S${f1(W * 0.86)} ${f1(hy - H * 0.13)} ${W} ${f1(hy - H * 0.05)} L${W} ${H} Z" fill="#141a40"/>`;
  const ny = H * 0.86;
  g += `<path d="M0 ${H} L0 ${f1(ny)} C${f1(W * 0.2)} ${f1(ny - H * 0.03)} ${f1(W * 0.45)} ${f1(ny + H * 0.02)} ${f1(W * 0.62)} ${f1(ny - H * 0.04)}
    S${f1(W * 0.85)} ${f1(ny - H * 0.1)} ${W} ${f1(ny - H * 0.06)} L${W} ${H} Z" fill="#090d26"/>`;
  if (scope) {
    // Lunette sur trépied, posée sur la colline à droite.
    const x = W * 0.8, y = ny - H * 0.085, k = H / 160;
    g += `<g fill="none" stroke="#090d26" stroke-width="${f1(1.6 * k)}" stroke-linecap="round">
      <path d="M${f1(x)} ${f1(y)} l${f1(-5 * k)} ${f1(13 * k)} M${f1(x)} ${f1(y)} l${f1(5 * k)} ${f1(13 * k)} M${f1(x)} ${f1(y)} v${f1(13 * k)}"/></g>
      <path d="M${f1(x - 9 * k)} ${f1(y + 1 * k)} l${f1(17 * k)} ${f1(-10 * k)} l${f1(2.2 * k)} ${f1(3.6 * k)} l${f1(-17 * k)} ${f1(10 * k)} Z" fill="#090d26"/>`;
  }
  return g;
}

function moonDisk(x, y, r, phase, illum, id) {
  const ph = ((phase % 360) + 360) % 360;
  const k = Math.cos((ph * Math.PI) / 180);
  const rx = Math.abs(k) * r;
  const waxing = ph < 180;
  const sweep = (k > 0) !== waxing ? 1 : 0;
  const lit = `M${f1(x)} ${f1(y - r)} A${r} ${r} 0 0 ${waxing ? 1 : 0} ${f1(x)} ${f1(y + r)} A${f1(rx)} ${r} 0 0 ${sweep} ${f1(x)} ${f1(y - r)} Z`;
  return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 5)}" fill="url(#${id}g)" opacity="${(0.25 + 0.75 * illum).toFixed(2)}"/>
    <circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="#2b3160"/>
    ${illum > 0.02 ? `<path d="${lit}" fill="#f6edc6"/>` : ''}`;
}

const skyDefs = (id, sky, extra = '') => `<defs>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${sky[0]}"/><stop offset=".6" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/>
    </linearGradient>
    <radialGradient id="${id}g"><stop offset="0" stop-color="#fff6d8" stop-opacity=".55"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient>
    <filter id="${id}b" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="${id}c" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter>
    ${extra}
  </defs>`;

/**
 * Nuit au-dessus du relief.
 * @param o { cls, clouds: {low, mid, high} en %, moon: {alt, az, phase, illum} ou null, W, H, label }
 */
export function nightScene({ cls = 'na', clouds = null, moon = null, W = 360, H = 160, seed = 7, label = '' } = {}) {
  const id = `sc${++uid}`;
  const sky = SKIES[cls] ?? SKIES.na;
  const c = clouds ?? { low: 30, mid: 30, high: 30 };
  const clear = (1 - c.low / 100) * (1 - c.mid / 100) * (1 - 0.7 * c.high / 100);
  const moonUp = moon && moon.alt > 0;
  const moonGlare = moonUp ? moon.illum : 0;
  let g = `<svg viewBox="0 0 ${W} ${H}" class="scene" role="img" aria-label="${label}">${skyDefs(id, sky)}
    <rect width="${W}" height="${H}" fill="url(#${id}s)"/>`;

  // Voie lactée : bande diffuse quand le ciel est clair et sans Lune.
  if (clear > 0.55 && moonGlare < 0.35) {
    g += `<ellipse cx="${f1(W * 0.42)}" cy="${f1(H * 0.42)}" rx="${f1(W * 0.62)}" ry="${f1(H * 0.13)}" fill="#c8d2ff"
      opacity="${(0.12 * clear).toFixed(3)}" filter="url(#${id}b)" transform="rotate(-24 ${f1(W * 0.42)} ${f1(H * 0.42)})"/>`;
  }
  g += stars(W, H, Math.round(110 * clear ** 0.8 * (1 - 0.5 * moonGlare)) + 6, H * 0.72, seed);

  if (moonUp) {
    const u = Math.max(0, Math.min(1, (moon.az - 90) / 180));
    const x = W * (0.12 + 0.76 * u);
    const y = H * 0.7 - (Math.min(moon.alt, 70) / 70) * H * 0.55;
    g += moonDisk(x, y, 9 * (H / 160), moon.phase, moon.illum, id);
  }

  // Nuages hauts (voiles), moyens (bancs), bas (mer de nuages au ras des crêtes).
  if (c.high > 8) {
    const o = Math.min(0.55, c.high / 160);
    g += `<g class="sc-drift slow" fill="#c9d2ff" opacity="${o.toFixed(2)}" filter="url(#${id}c)">
      <rect x="${f1(W * 0.05)}" y="${f1(H * 0.14)}" width="${f1(W * 0.36)}" height="${f1(H * 0.045)}" rx="${f1(H * 0.02)}"/>
      <rect x="${f1(W * 0.22)}" y="${f1(H * 0.22)}" width="${f1(W * 0.26)}" height="${f1(H * 0.035)}" rx="${f1(H * 0.02)}"/>
      <rect x="${f1(W * 0.56)}" y="${f1(H * 0.1)}" width="${f1(W * 0.38)}" height="${f1(H * 0.05)}" rx="${f1(H * 0.025)}"/>
      ${c.high > 60 ? `<rect x="${f1(-W * 0.05)}" y="${f1(H * 0.03)}" width="${f1(W * 1.1)}" height="${f1(H * 0.3)}" rx="${f1(H * 0.1)}" opacity=".5"/>` : ''}
    </g>`;
  }
  if (c.mid > 8) {
    const o = Math.min(0.92, c.mid / 100 + 0.1);
    const r = rng(seed + 3);
    let puffs = '';
    const n = Math.round(3 + c.mid / 18);
    for (let i = 0; i < n; i++) {
      const x = r() * W * 1.1 - W * 0.05, y = H * (0.3 + r() * 0.22);
      puffs += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(W * (0.08 + r() * 0.1))}" ry="${f1(H * (0.04 + r() * 0.04))}"/>`;
    }
    g += `<g class="sc-drift" fill="#535b8c" opacity="${o.toFixed(2)}" filter="url(#${id}c)">${puffs}</g>`;
  }
  g += ridges(W, H);
  if (c.low > 8) {
    const o = Math.min(0.95, c.low / 100 + 0.15);
    const y = H * (0.7 - (c.low / 100) * 0.12);
    g += `<g class="sc-fade" opacity="${o.toFixed(2)}" filter="url(#${id}c)" fill="#3c4372">
      <path class="sc-drift" d="M${-W * 0.1} ${H} V${f1(y)} q${f1(W * 0.1)} ${f1(-H * 0.06)} ${f1(W * 0.2)} 0 t${f1(W * 0.2)} 0 t${f1(W * 0.2)} 0 t${f1(W * 0.2)} 0 t${f1(W * 0.2)} 0 t${f1(W * 0.2)} 0 V${H} Z"/>
    </g>`;
  }
  return `${g}</svg>`;
}

/** Ciel au nord avec rideaux d'aurore (intensité 0–1). */
export function auroraScene({ chance = 0, W = 360, H = 160, seed = 11, label = '' } = {}) {
  const id = `sc${++uid}`;
  const sky = ['#040820', '#0c1640', '#1b2a5c'];
  const k = Math.max(0, Math.min(1, chance));
  let g = `<svg viewBox="0 0 ${W} ${H}" class="scene" role="img" aria-label="${label}">${skyDefs(id, sky, `
    <linearGradient id="${id}a" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#5df2a6" stop-opacity=".0"/><stop offset=".12" stop-color="#5df2a6" stop-opacity=".9"/>
      <stop offset=".55" stop-color="#5df2a6" stop-opacity=".35"/><stop offset=".8" stop-color="#ff7b9c" stop-opacity=".3"/>
      <stop offset="1" stop-color="#b98cff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id}h" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#5df2a6" stop-opacity=".45"/><stop offset="1" stop-color="#5df2a6" stop-opacity="0"/></linearGradient>`)}
    <rect width="${W}" height="${H}" fill="url(#${id}s)"/>`;
  g += stars(W, H, 90, H * 0.72, seed);
  // Lueur verte à l'horizon, même faible : là où l'aurore apparaîtrait.
  g += `<rect x="0" y="${f1(H * 0.45)}" width="${W}" height="${f1(H * 0.32)}" fill="url(#${id}h)" opacity="${(0.12 + 0.6 * k).toFixed(2)}"/>`;
  if (k > 0.05) {
    const r = rng(seed + 5);
    const n = 3 + Math.round(k * 3);
    let curt = '';
    for (let i = 0; i < n; i++) {
      const x0 = W * (i / n) - W * 0.1 + r() * W * 0.1, w = W * (0.3 + r() * 0.2);
      const base = H * (0.72 - r() * 0.06), top = H * (0.62 - k * (0.35 + r() * 0.2));
      const wob = H * 0.05;
      curt += `<path class="sc-aurora" style="--d:${(-r() * 6).toFixed(1)}s" fill="url(#${id}a)" opacity="${(0.35 + 0.6 * k).toFixed(2)}"
        d="M${f1(x0)} ${f1(base)} C${f1(x0 + w * 0.3)} ${f1(base - wob)} ${f1(x0 + w * 0.6)} ${f1(base + wob)} ${f1(x0 + w)} ${f1(base - wob * 0.5)}
          L${f1(x0 + w * 1.04)} ${f1(top + wob)} C${f1(x0 + w * 0.6)} ${f1(top - wob)} ${f1(x0 + w * 0.35)} ${f1(top + wob)} ${f1(x0 + w * 0.02)} ${f1(top)} Z"/>`;
    }
    g += `<g filter="url(#${id}c)">${curt}</g>`;
  }
  g += ridges(W, H, false);
  g += `<text x="${f1(W * 0.5)}" y="${f1(H - 8)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-weight="700" fill="rgba(255,255,255,.55)" letter-spacing="1">NORD</text>`;
  return `${g}</svg>`;
}

/** Étoiles filantes jaillissant du radiant ; Lune éventuelle (éclat 0–1). */
export function meteorScene({ quality = 0.5, illum = 0, W = 360, H = 160, seed = 23, label = '' } = {}) {
  const id = `sc${++uid}`;
  const sky = SKIES[quality >= 0.65 ? 'top' : quality >= 0.4 ? 'good' : quality >= 0.2 ? 'maybe' : 'low'];
  let g = `<svg viewBox="0 0 ${W} ${H}" class="scene" role="img" aria-label="${label}">${skyDefs(id, sky, `
    <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>`)}
    <rect width="${W}" height="${H}" fill="url(#${id}s)"/>`;
  g += stars(W, H, Math.round(100 * (1 - 0.5 * illum)), H * 0.72, seed);
  if (illum > 0.15) g += moonDisk(W * 0.12, H * 0.2, 9 * (H / 160), 180 - (1 - illum) * 150, illum, id);
  const rx = W * 0.66, ry = H * 0.2;
  const r = rng(seed + 9);
  const n = 3 + Math.round(quality * 5);
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * (0.55 + r() * 0.9)) * (r() < 0.5 ? 1 : -1) + Math.PI / 2;
    const d0 = 14 + r() * 30, len = 30 + r() * 46;
    const x0 = rx + Math.cos(a) * d0, y0 = ry + Math.abs(Math.sin(a)) * d0;
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.abs(Math.sin(a)) * len;
    if (y1 > H * 0.7) continue;
    g += `<line x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}" stroke="#fff" stroke-width="1.6" stroke-linecap="round"
      class="sc-meteor" style="--len:${f1(len)};--d:${(i * 0.9 + r() * 0.6).toFixed(2)}s"/>`;
  }
  g += `<circle cx="${f1(rx)}" cy="${f1(ry)}" r="3" fill="none" stroke="rgba(255,255,255,.35)" stroke-dasharray="2 2"/>`;
  g += ridges(W, H);
  return `${g}</svg>`;
}

/** Illustration d'un événement : éclipse (Soleil ou Lune), passage de satellite, planète. */
export function eventScene(ev, { W = 360, H = 160, label = '' } = {}) {
  const id = `sc${++uid}`;
  const day = ev.type === 'eclipse' && ev.sub === 'solar';
  const sky = day ? ['#24305f', '#45508a', '#8a86b8'] : SKIES.top;
  let g = `<svg viewBox="0 0 ${W} ${H}" class="scene" role="img" aria-label="${label}">${skyDefs(id, sky, `
    <radialGradient id="${id}r"><stop offset="0" stop-color="#ffe7b0"/><stop offset=".7" stop-color="#ffb35c"/><stop offset="1" stop-color="#ff8a3d"/></radialGradient>
    <radialGradient id="${id}l"><stop offset="0" stop-color="#c8573c"/><stop offset="1" stop-color="#6e2a25"/></radialGradient>`)}
    <rect width="${W}" height="${H}" fill="url(#${id}s)"/>`;
  if (!day) g += stars(W, H, 90, H * 0.72, 31);
  const cx = W * 0.62, cy = H * 0.36, R = 26 * (H / 160);
  if (ev.type === 'eclipse' && ev.sub === 'solar') {
    const ob = ev.local?.obscuration ?? 0.5;
    const off = R * 2 * (1 - Math.min(1, ob ** 0.6));
    g += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R * 3)}" fill="url(#${id}g)"/>
      <circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R)}" fill="url(#${id}r)"/>
      <circle cx="${f1(cx + off * 0.8)}" cy="${f1(cy - off * 0.5)}" r="${f1(R * 1.02)}" fill="#1b2350"/>`;
  } else if (ev.type === 'eclipse') {
    g += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R * 2.6)}" fill="#c8573c" opacity=".12" filter="url(#${id}b)"/>
      <circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R)}" fill="${ev.kind === 'total' ? `url(#${id}l)` : '#e8dcc0'}"/>
      ${ev.kind !== 'total' ? `<circle cx="${f1(cx - R * 0.9)}" cy="${f1(cy + R * 0.2)}" r="${f1(R * 1.25)}" fill="#7a3428" opacity="${ev.kind === 'partial' ? '.85' : '.25'}"/>` : ''}`;
  } else if (ev.type === 'sat') {
    g += `<path d="M${f1(W * 0.05)} ${f1(H * 0.66)} Q${f1(W * 0.45)} ${f1(-H * 0.12)} ${f1(W * 0.95)} ${f1(H * 0.58)}" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.5" stroke-dasharray="1 5" stroke-linecap="round"/>
      <circle cx="${f1(W * 0.47)}" cy="${f1(H * 0.27)}" r="10" fill="url(#${id}g)"/><circle cx="${f1(W * 0.47)}" cy="${f1(H * 0.27)}" r="2.6" fill="#fff"/>`;
  } else {
    const col = ev.color ?? '#f2cf9b';
    g += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R * 2.4)}" fill="${col}" opacity=".1" filter="url(#${id}b)"/>
      <circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R * 0.7)}" fill="${col}"/>
      ${ev.body === 'Saturn' ? `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(R * 1.35)}" ry="${f1(R * 0.35)}" fill="none" stroke="${col}" stroke-width="2.5" transform="rotate(-18 ${f1(cx)} ${f1(cy)})"/>` : ''}
      ${ev.bodies ? `<circle cx="${f1(cx - R * 1.4)}" cy="${f1(cy + R * 0.5)}" r="${f1(R * 0.45)}" fill="#ffe9b0"/>` : ''}`;
  }
  g += ridges(W, H, !day);
  return `${g}</svg>`;
}
