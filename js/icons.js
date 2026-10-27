// Icônes SVG (tracé type Lucide, 24 × 24, trait 2).
const PATHS = {
  back: '<path d="m15 18-6-6 6-6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  sunrise: '<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
  sunset: '<path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
  thermo: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  wind: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
  drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  sky: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  scale: '<path d="M12 3v18"/><path d="M5 7h14"/><path d="m5 7-3 7a3.5 3.5 0 0 0 6 0Z"/><path d="m19 7-3 7a3.5 3.5 0 0 0 6 0Z"/>',
  star: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  'w-moon': '<path class="i-moon" d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  // Onglets
  telescope: '<path d="m3.5 13.2 12.8-6.6 1.9 3.7-12.8 6.6z"/><path d="m16.3 6.6 3.6-1.9 1.9 3.7-3.6 1.9"/><path d="M11 14.4 14 21"/><path d="M11 14.4 8 21"/><path d="m3.5 13.2-.9.5.9 1.8.9-.5"/>',
  aurora: '<path d="M3 21c3-1.5 6-6.5 9-6.5s6 5 9 6.5"/><path d="M5 18.5V9"/><path d="M9 15.5V4.5"/><path d="M15 15.5V6"/><path d="M19 18.5v-8"/>',
  meteor: '<path d="M3 3l8.5 8.5"/><path d="M7.5 3l6 6"/><path d="M3 7.5l6 6"/><path d="m16.5 12 1.3 2.7 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4Z"/>',
  sparkles: '<path d="M11 3.5 12.9 9l5.6 1.9-5.6 1.9L11 18.3l-1.9-5.5-5.6-1.9L9.1 9Z"/><path d="M19 15v5M16.5 17.5h5"/><path d="M5 2.5v3M3.5 4h3"/>',
  // Événements
  eclipse: '<circle cx="12" cy="12" r="5" fill="currentColor"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  'eclipse-moon': '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18 6 9 0 0 0 0-18Z" fill="currentColor"/>',
  satellite: '<path d="M13 7 9 3 5 7l4 4"/><path d="m17 11 4 4-4 4-4-4"/><path d="m8 12 4 4 6-6-4-4Z"/><path d="m16 8 3-3"/><path d="M9 21a6 6 0 0 0-6-6"/>',
  planet: '<circle cx="12" cy="12" r="5.5"/><path d="M6.6 14.2C3.6 16.3 2.1 18.2 2.7 19.1c1 1.6 6.6-.6 12.3-5s9.5-8.9 8.5-10.4c-.6-.9-2.6-.7-5.4.6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
  magnet: '<path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15"/><path d="m5 8 4 4"/><path d="m12 15 4 4"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  dots: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  'arrow-up': '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  'arrow-down': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/>',
  play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  wave: '<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity=".5"/><path d="M2 7c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity=".5"/>',
  'w-cloud': '<path class="i-cloud" d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
};

export const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;

// Phase de la Lune : disque sombre et partie éclairée (angle de phase 0 = nouvelle, 180 = pleine).
// La partie éclairée est à droite quand la Lune croît (hémisphère nord).
export function moonGlyph(phaseDeg, cls = '', size = 24) {
  const r = 10, c = 12;
  const ph = ((phaseDeg % 360) + 360) % 360;
  const k = Math.cos((ph * Math.PI) / 180); // 1 nouvelle, -1 pleine
  const rx = Math.abs(k) * r;
  const waxing = ph < 180;
  // Bord éclairé : demi-cercle du côté éclairé, puis terminateur (ellipse) pour revenir.
  const side = waxing ? 1 : 0;
  const sweep = (k > 0) !== waxing ? 1 : 0; // croissant : le terminateur bombe vers le côté éclairé
  const lit = `M${c} ${c - r} A${r} ${r} 0 0 ${side} ${c} ${c + r} A${rx.toFixed(2)} ${r} 0 0 ${sweep} ${c} ${c - r} Z`;
  return `<svg class="moon-g ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${c}" cy="${c}" r="${r}" fill="#3a4064" stroke="rgba(255,255,255,.25)" stroke-width="1"/>
    ${ph > 2 && ph < 358 ? `<path d="${lit}" fill="#f3e7b5"/>` : ''}
  </svg>`;
}
