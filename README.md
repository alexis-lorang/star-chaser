# Star Chaser · prévisions astronomiques

Application web statique (HTML/JS, sans build), même design que Cloud Chaser (mers de nuages) en couleurs de nuit.
Quatre onglets : **Seeing**, **Aurora**, **Meteors**, **Autres**. Lieu par défaut : Donon (réglable).

## Lancer

Double-cliquer sur **`Lancer le dashboard.command`** (serveur local sur le port 8775, puis ouverture du navigateur).
La première fois, macOS peut demander une confirmation : clic droit → Ouvrir.

Ou à la main :

```bash
python3 -m http.server 8775
```

Puis ouvrir http://localhost:8775. Un serveur est nécessaire : les modules ES ne se chargent pas en `file://`.

En ligne (GitHub Pages, branche `main`) : https://alexis-lorang.github.io/star-chaser/
Sur iPhone : Safari → Partager → « Sur l’écran d’accueil ». L’icône iOS est déclarée en URL absolue
(`apple-touch-icon-180x180.png` et sa variante precomposed), comme pour Cloud Chaser.

## Onglets

- **Seeing** (inspiré de l’« astronomical seeing » de meteoblue) : meilleure nuit des 7 prochaines, choix de la nuit,
  frise de la nuit (crépuscules civil / nautique / astronomique, présence et phase de la Lune), grille heure par heure
  (indice d’observation, nuages bas / moyens / hauts du bleu nuit au blanc, seeing en secondes d’arc, indices 1 et 2,
  jet stream, couche instable, transparence, température, humidité, risque de rosée, vent, hauteur de la Lune, planètes
  levées), puis les planètes de la nuit (plage visible, hauteur max., magnitude, constellation).
- **Aurora** : chance d’aurore sur les 3 prochaines nuits (Kp prévu × nuages × Lune), graphique Kp observé / prévu
  avec les seuils du lieu, vent solaire en direct (vitesse, densité, Bz, Bt), ovale auroral OVATION sur une carte,
  tendance à 27 jours, seuils Kp pour le lieu (latitude géomagnétique).
- **Meteors** : prochaine pluie (ou celle en cours), essaims actifs cette nuit, ruban de l’année, liste mois par mois
  avec la Lune et le taux attendu ici ; détail d’un essaim : courbe du radiant, de la Lune et du taux sur la nuit.
- **Autres** : éclipses de Soleil et de Lune (10 ans, circonstances locales), passages visibles de l’ISS et de
  Tiangong (10 jours), oppositions, plus grandes élongations de Mercure et Vénus, conjonctions de planètes, transits,
  super lunes, lunes bleues, rapprochements et occultations de planètes par la Lune (2 ans). Filtres par type.

Réglages : apparence, modèle météo (consensus ICON + ECMWF + GFS, ou un seul), qualité du ciel (magnitude limite).

## Calculs

**Seeing** (`js/seeing.js`, `seeingHour`) : niveaux de pression Open-Meteo de 1000 à 100 hPa. Turbulence optique
intégrée couche par couche (modèle de Coulman–Dewan : Cn² = 2,8 · M² · L0^(4/3), M dépend de P/T² et de dθ/dz, L0 du
cisaillement du vent, tropopause détectée), seeing = 0,98 λ / r0. Les niveaux étant espacés de 0,5 à 2,5 km, le
résultat est recalibré (loi de puissance + terme de jet stream) puis combiné à une couche au sol dépendant du vent.
Indice 2 : jet stream, couches instables (dθ/dz > 0,5 K/100 m) et nombre de Richardson. Transparence : épaisseur
optique des aérosols (CAMS, 5 jours) et humidité. Heuristique à confronter au terrain.

**Indice d’observation** (`hourScore`, `nightScore`) : ciel dégagé (dominant), seeing, transparence, Lune, obscurité ;
la nuit retient le meilleur créneau de deux heures en nuit noire ou nautique.

**Aurores** (`js/aurora.js`) : bord de l’ovale ≈ 66,5° − 2,05 · Kp de latitude géomagnétique ; visible à l’œil nu
~3,5° plus au sud, en photo ~5,5° plus au sud. Pour le Donon (49,3° géomagnétique) : Kp 6 en photo, 7 à l’œil nu.

**Étoiles filantes** (`js/meteors.js`) : liste de travail de l’IMO ; maximum recalculé chaque année depuis la longitude
solaire (J2000) ; taux visible = ZHR × sin(hauteur du radiant) × r^(mag. limite − 6,5), la magnitude limite baissant
avec la Lune et le crépuscule ; profil d’activité ZHR × 10^(−b·|Δλ|).

**Événements** (`js/events.js`) : éphémérides Astronomy Engine ; passages des stations par SGP4 (satellite.js) sur
les orbites CelesTrak (cache 12 h) : station éclairée par le Soleil, observateur dans la nuit, plus de 10° de haut.

## Sources

Open-Meteo (prévisions, aérosols, recherche de lieux) · NOAA SWPC (Kp, vent solaire, OVATION, 27 jours) ·
IMO (essaims) · CelesTrak (orbites) · Astronomy Engine, satellite.js, d3-geo, world-atlas (jsDelivr).

## Fichiers

- `js/config.js` : lieux proposés, modèles, qualités de ciel, planètes, constellations, satellites
- `js/astro.js` : Soleil, Lune, planètes, nuits et crépuscules, longitude solaire, latitude géomagnétique
- `js/seeing.js` : prévisions Open-Meteo (cache 30 min), seeing, transparence, indices
- `js/aurora.js` : données NOAA (cache 15 min), seuils du lieu
- `js/meteors.js` : essaims, maximum, taux visibles
- `js/events.js` : éclipses, planètes, Lune, passages de satellites
- `js/scene.js` : illustrations (nuit, aurore, étoiles filantes, événements)
- `js/app.js` : interface (onglets, grilles, graphiques, carte, feuilles, réglages)
- `icon.svg` : source de l’icône ; `apple-touch-icon.png` (180 px) et `icon-192.png` en sont rendus avec QuickLook
  (`qlmanage -t -s 1024 icon.svg`, puis `magick … -resize`).
