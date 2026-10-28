# Presence Family Card (FR)

Une seule carte Home Assistant pour toute la famille : présence (avec la durée), position, batterie (avec recharge) et Wi-Fi de chaque personne. Style verre, thème clair/sombre automatique, optimisée pour iPhone, iPad et kiosque en mode portrait.

- Avatar avec **photo** (ou initiales) et bague de couleur : vert à la maison, bleu absent ou en zone.
- Statut avec la durée : « À la maison · depuis 2 h », « Absent · depuis 40 min », ou le nom de la zone.
- Batterie avec icône selon le niveau, orange et rouge selon vos seuils, et « en charge ».
- Wi-Fi (nom du réseau) ou « Hors Wi-Fi ».
- **Éditeur visuel** : ajoutez, supprimez et réordonnez les personnes sans écrire de YAML.
- Un appui sur n'importe quel élément ouvre la fiche de l'entité.

## Installation via HACS (dépôt personnalisé)

1. HACS → ⋮ (en haut à droite) → **Dépôts personnalisés**.
2. Collez l'URL de ce dépôt, choisissez la catégorie **Tableau de bord** (Dashboard), puis **Ajouter**.
3. Recherchez « Presence Family Card (FR) » et cliquez sur **Télécharger**.
4. Rechargez le navigateur (Ctrl+Maj+R).

## Utilisation

**Éditeur visuel** : ajoutez une carte → recherchez « Presence Family Card » → **+ Ajouter une personne** et choisissez les entités.

**YAML** :

```yaml
type: custom:presence-family-card
title: Famille
people:
  - name: Prénom 1
    tracker: device_tracker.telephone_1
    battery: sensor.telephone_1_battery_level
    battery_state: sensor.telephone_1_battery_state   # facultatif, pour « en charge »
    wifi: sensor.telephone_1_ssid
    location: sensor.telephone_1_geocoded_location
    picture: /local/prenom1.jpg                       # facultatif
  - name: Prénom 2
    tracker: person.prenom_2
    battery: sensor.telephone_2_battery_level
    wifi: sensor.telephone_2_wifi_connection
    location: sensor.telephone_2_geocoded_location
```

Seul `tracker` est obligatoire pour chaque personne. Les autres entités sont facultatives : un bloc sans entité n'est simplement pas affiché.

### Photos

Placez les images dans `/config/www/` (par exemple `prenom1.jpg`) et indiquez `picture: /local/prenom1.jpg`. Sans `picture`, la carte utilise l'image de l'entité (`entity_picture`, fréquente avec une entité `person`), puis les initiales.

## Options

| Option | Défaut | Description |
|---|---|---|
| `title` | `Famille` | Titre (vide = aucun en-tête) |
| `theme` | `auto` | `auto` suit le thème clair/sombre de Home Assistant, ou `light` / `dark` |
| `columns` | `0` | Nombre de colonnes (0 = automatique selon la largeur) |
| `show_location` / `show_battery` / `show_wifi` | `true` | Affiche ou masque chaque bloc |
| `battery_warn` / `battery_alert` | `30` / `15` | Seuils orange et rouge de la batterie (%) |
| `people` | | Liste des personnes (voir ci-dessous) |

Options de chaque personne :

| Option | Obligatoire | Description |
|---|---|---|
| `name` | non | Prénom affiché |
| `tracker` | **oui** | `device_tracker` ou `person` |
| `battery` | non | Capteur du niveau de batterie |
| `battery_state` | non | Capteur d'état de la batterie (détecte « en charge ») |
| `wifi` | non | Capteur du nom du réseau Wi-Fi |
| `location` | non | Capteur de position géocodée |
| `picture` | non | Photo (ex. `/local/prenom1.jpg`) |

## Apparence : nuance de couleur

Dans l'éditeur visuel, à côté du thème :

| Option | Valeurs |
|---|---|
| `nuance` | `theme` (par défaut), `braise`, `ocean`, `lagon`, `foret`, `lavande`, `framboise`, `ambre`, `ardoise`, `perso` |
| `nuance_perso` | Couleur au choix (sélecteur de couleur), utilisée avec `nuance: perso` |
| `intensite` | De `0` (neutre) à `2` (très coloré), `1` par défaut |

La nuance teinte le dégradé de fond (et la couleur d'accent quand la carte en a une). Les couleurs d'état (vert, orange, rouge…) ne changent pas.

**Une seule nuance pour toutes les cartes Johan854** : laisse `nuance: theme` et ajoute à ton thème Home Assistant :

```yaml
carte-nuance: "#2f8fd8"
```

Sans cette ligne, `nuance: theme` garde les couleurs d'origine de la carte.

## Historique des versions

- **1.2.0** : nuance de couleur au choix (8 nuances, couleur personnalisée, intensité, ou nuance commune via `carte-nuance` dans le thème).
- **1.1.0** : éditeur visuel (ajout, suppression et ordre des personnes).
- **1.0.0** : version initiale.

## Licence

MIT.
