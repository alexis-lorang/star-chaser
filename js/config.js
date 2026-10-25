// Lieux d'observation proposés, modèles météo, noms français.
// Coordonnées : OpenStreetMap (Nominatim). Altitudes : OSM / IGN.

export const PLACES = [
  { id: 'donon', name: 'Donon', lat: 48.5126, lon: 7.1645, alt: 1009, note: 'Sommet dégagé, horizon à 360°.' },
  { id: 'champ-du-feu', name: 'Champ du Feu', lat: 48.3930, lon: 7.2698, alt: 1099, note: 'Haut plateau, ciel parmi les plus noirs du massif.' },
  { id: 'mutzig', name: 'Rocher de Mutzig', lat: 48.5494, lon: 7.2398, alt: 1009 },
  { id: 'dabo', name: 'Rocher de Dabo', lat: 48.6490, lon: 7.2456, alt: 664 },
  { id: 'valsberg', name: 'Col du Valsberg', lat: 48.6511, lon: 7.2943, alt: 650 },
  { id: 'hautbarr', name: 'Château du Haut-Barr', lat: 48.7247, lon: 7.3383, alt: 460 },
];
export const DEFAULT_PLACE = PLACES[0];

// Modèles Open-Meteo avec niveaux de pression jusqu'à 100 hPa (≈ 16 km) : nécessaires au calcul du seeing.
export const MODELS = {
  consensus: { label: 'Consensus', sub: 'Moyenne ICON, ECMWF et GFS', ids: ['icon_seamless', 'ecmwf_ifs025', 'gfs_seamless'] },
  icon_seamless: { label: 'ICON', sub: 'Service météo allemand (DWD)', ids: ['icon_seamless'] },
  ecmwf_ifs025: { label: 'ECMWF', sub: 'Centre européen (IFS)', ids: ['ecmwf_ifs025'] },
  gfs_seamless: { label: 'GFS', sub: 'Service météo américain (NOAA)', ids: ['gfs_seamless'] },
};

// Qualité du ciel (magnitude limite à l'œil nu) : sert au taux d'étoiles filantes visibles.
export const SKIES = {
  dark: { label: 'Ciel noir', sub: 'Montagne loin des villes · mag. 6,5', lm: 6.5 },
  rural: { label: 'Campagne', sub: 'Voie lactée bien visible · mag. 6,0', lm: 6.0 },
  suburb: { label: 'Périurbain', sub: 'Voie lactée à peine visible · mag. 5,2', lm: 5.2 },
  city: { label: 'Ville', sub: 'Quelques étoiles · mag. 4,5', lm: 4.5 },
};

// Planètes : nom, couleur.
export const PLANETS = [
  { body: 'Mercury', name: 'Mercure', color: '#c9b9a6' },
  { body: 'Venus', name: 'Vénus', color: '#ffe9b0' },
  { body: 'Mars', name: 'Mars', color: '#ff8a65' },
  { body: 'Jupiter', name: 'Jupiter', color: '#f2cf9b' },
  { body: 'Saturn', name: 'Saturne', color: '#e9d58a' },
  { body: 'Uranus', name: 'Uranus', color: '#9fe3e8' },
  { body: 'Neptune', name: 'Neptune', color: '#7d9dff' },
];

// Constellations : symbole IAU → nom français.
export const CONSTELLATIONS = {
  And: 'Andromède', Ant: 'Machine pneumatique', Aps: 'Oiseau de paradis', Aql: 'Aigle', Aqr: 'Verseau', Ara: 'Autel',
  Ari: 'Bélier', Aur: 'Cocher', Boo: 'Bouvier', CMa: 'Grand Chien', CMi: 'Petit Chien', CVn: 'Chiens de chasse',
  Cae: 'Burin', Cam: 'Girafe', Cap: 'Capricorne', Car: 'Carène', Cas: 'Cassiopée', Cen: 'Centaure', Cep: 'Céphée',
  Cet: 'Baleine', Cha: 'Caméléon', Cir: 'Compas', Cnc: 'Cancer', Col: 'Colombe', Com: 'Chevelure de Bérénice',
  CrA: 'Couronne australe', CrB: 'Couronne boréale', Crt: 'Coupe', Cru: 'Croix du Sud', Crv: 'Corbeau', Cyg: 'Cygne',
  Del: 'Dauphin', Dor: 'Dorade', Dra: 'Dragon', Equ: 'Petit Cheval', Eri: 'Éridan', For: 'Fourneau', Gem: 'Gémeaux',
  Gru: 'Grue', Her: 'Hercule', Hor: 'Horloge', Hya: 'Hydre', Hyi: 'Hydre mâle', Ind: 'Indien', LMi: 'Petit Lion',
  Lac: 'Lézard', Leo: 'Lion', Lep: 'Lièvre', Lib: 'Balance', Lup: 'Loup', Lyn: 'Lynx', Lyr: 'Lyre', Men: 'Table',
  Mic: 'Microscope', Mon: 'Licorne', Mus: 'Mouche', Nor: 'Règle', Oct: 'Octant', Oph: 'Ophiuchus', Ori: 'Orion',
  Pav: 'Paon', Peg: 'Pégase', Per: 'Persée', Phe: 'Phénix', Pic: 'Peintre', PsA: 'Poisson austral', Psc: 'Poissons',
  Pup: 'Poupe', Pyx: 'Boussole', Ret: 'Réticule', Scl: 'Sculpteur', Sco: 'Scorpion', Sct: 'Écu de Sobieski',
  Ser: 'Serpent', Sex: 'Sextant', Sge: 'Flèche', Sgr: 'Sagittaire', Tau: 'Taureau', Tel: 'Télescope',
  TrA: 'Triangle austral', Tri: 'Triangle', Tuc: 'Toucan', UMa: 'Grande Ourse', UMi: 'Petite Ourse', Vel: 'Voiles',
  Vir: 'Vierge', Vol: 'Poisson volant', Vul: 'Petit Renard',
};

// Satellites suivis (passages visibles) : numéro NORAD.
export const SATELLITES = [
  { id: 25544, name: 'ISS', long: 'Station spatiale internationale', mag: -1.8 },
  { id: 48274, name: 'Tiangong', long: 'Station spatiale chinoise', mag: -0.8 },
];
