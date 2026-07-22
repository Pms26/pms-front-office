# PRD — Service Tarification, Fiscalité & Extras

**Projet :** OASIS PMS — Module 4
**Statut :** Draft
**Auteur :** Hanan
**Dernière mise à jour :** 22 juillet 2026

---

## 1. Contexte & Objectif

Ce module pilote toute la logique de facturation du PMS : grille tarifaire par catégorie/saison, fiscalité locale marocaine (TS/TPT), régimes de pension, tarifs partenaires (agences/sociétés), catalogue d'extras (POS), et flexibilité des remises/packages.

L'architecture de données doit être suffisamment flexible pour isoler proprement les taxes de séjour du chiffre d'affaires hébergement, condition indispensable pour la fiabilité du Night Audit (Module 3) et des Analytics (Module 5).

## 2. Périmètre fonctionnel

### 2.1 Grille tarifaire principale (Catégories & Saisons)

- Matrice dynamique croisant **Catégories de chambres** (ex : Standard, Suite, Lodge) et **Saisons** (ex : Basse, Moyenne, Haute, Pics de fin d'année).
- Saisie manuelle ou import du tarif de base par chambre et par nuit.
- Le tarif de base est configuré **TTC** et doit obligatoirement inclure :
  - L'hébergement
  - Le petit-déjeuner (formule BB)
  - La TVA hôtelière :
    - **10 %** sur l'hébergement et la nourriture
    - **20 %** sur le reste (boissons, SPA, etc.)

### 2.2 Fiscalité locale (Taxe de Séjour & Taxe de Promotion Touristique)

- Calcul automatique natif des taxes locales marocaines : **TS** (Taxe de Séjour) et **TPT** (Taxe de Promotion Touristique).
- Calcul **par personne (Pax) et par nuit**.
- Montant cumulé dépendant de la **catégorie officielle de l'établissement**.
- Logique de facturation paramétrable au moment de la réservation — case à cocher avec deux options :
  1. **Payable à la réservation** : taxes intégrées et payées dans la facture globale.
  2. **Payable sur place** : taxes isolées automatiquement et basculées sur le compte "Extra/Extras de chambre", à régler obligatoirement au check-out.

### 2.3 Gestion des régimes (Pensions)

À la création/modification d'une réservation, sélection d'un régime parmi 3, avec application instantanée du supplément tarifaire défini dans la grille de saison :

| Code | Régime           | Contenu                                      |
| ---- | ---------------- | -------------------------------------------- |
| BB   | Bed & Breakfast  | Hébergement + petit-déjeuner (tarif de base) |
| DP   | Demi-Pension     | Tarif de base + 1 repas (déjeuner ou dîner)  |
| PC   | Pension Complète | Tarif de base + 2 repas (déjeuner + dîner)   |

### 2.4 Tarifs Agences & Partenaires (Corporate / Tour-Opérateurs)

- Création de fiches "Agences de voyages / Tour-Opérateurs / Sociétés" avec logique tarifaire dédiée.
- Association d'un contrat tarifaire spécifique par saison à chaque agence.
- Lorsqu'une réservation est rattachée à une agence, application automatique de la grille négociée (tarifs nets ou commissions déduites) **au lieu du** tarif public.

### 2.5 Grille des Extras & Points de Vente (POS)

Catalogue de prix centralisé pour tous les services annexes, permettant aux départements de pousser des consommations directement sur la note de chambre :

- **Restaurant** : tarifs de la carte (plats)
- **Boissons / Bar** : softs, alcools, cafés
- **SPA** : soins, massages, accès hammam
- **Activités** : excursions (Quad, Montgolfière, Désert, Golf, etc.)
- **Autre** : blanchisserie, transferts aéroport, etc.

### 2.6 Remises et Packages

**Réductions** — deux modes d'application sur le tarif public :

- En **pourcentage** (ex : -15 % sur le tarif de la nuit)
- En **valeur absolue / tarif spécifique** (ex : forcer le prix de la nuit à 1 200 DH au lieu de 1 500 DH)

**Tarifs Packagés** :

- Vendu au client sous un **prix global unique** (ex : "Package Romance" à 3 000 DH).
- En interne (back-office), le PMS doit **automatiquement ventiler** ce montant dans les bonnes tables de la base de données.
  - Exemple de ventilation : Hébergement 2 000 DH / SPA 600 DH / Dîner 400 DH.

## 3. Modèle de données (éléments connus)

| Entité            | Champs / relations attendus                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `Room_Category`   | catégories de chambres (Standard, Suite, Lodge…)                                                             |
| `Season`          | saisons (Basse, Moyenne, Haute, Pics)                                                                        |
| `Rate_Grid`       | tarif de base TTC par (catégorie × saison), inclut hébergement + BB + TVA                                    |
| `Tax_Config`      | paramètres TS/TPT par catégorie officielle d'établissement, mode de règlement (à la réservation / sur place) |
| `Meal_Plan`       | BB / DP / PC, supplément lié à la saison                                                                     |
| `Agency_Contract` | lien vers fiche Agence/Société (Module 4 CRM), grille négociée par saison                                    |
| `Extras_Catalog`  | catalogue POS (Restaurant, Bar, SPA, Activités, Autre)                                                       |
| `Discount`        | type (%, valeur absolue), valeur, portée                                                                     |
| `Package`         | prix global vendu, règles de ventilation interne par poste de recette                                        |

## 4. Règles métier critiques

- La TVA doit être ventilée par taux (10 % hébergement/nourriture, 20 % reste) — jamais un taux unique global.
- Les taxes de séjour (TS/TPT) doivent être **isolables** du CA hébergement pour ne pas fausser le calcul du CA HT/TTC dans le Night Audit.
- Un package vendu à prix global doit systématiquement produire une ventilation interne cohérente (la somme des postes ventilés = prix global vendu).
- Un tarif agence, une fois rattaché, **remplace** le tarif public — pas de cumul implicite avec une remise manuelle sans validation explicite.

## 5. Dépendances

- **Module 4 (Agences/Sociétés)** : fiches partenaires déjà créées, utilisées ici pour le rattachement tarifaire.
- **Module 3 (Night Audit)** : consomme la ventilation CA/TVA/taxes produite par ce module.
- **Module 5 (Analytics)** : consomme le CA par segment, qui dépend de la bonne isolation fiscale définie ici.

## 6. Hors périmètre (non précisé dans le cahier des charges)

- Gestion multi-devises.
- Tarification dynamique automatisée (yield management).
- Intégration directe avec un moteur de paiement externe (non détaillée ici).

## 7. Critères d'acceptation

- [ ] Un tarif de base saisi pour une catégorie/saison inclut bien hébergement + BB + TVA ventilée à 10 %/20 %.
- [ ] Le choix "Payable sur place" pour les taxes isole bien le montant sur le compte Extra du client, exigible au check-out.
- [ ] Le changement de régime (BB/DP/PC) recalcule instantanément le tarif affiché.
- [ ] Le rattachement d'une réservation à une agence applique la grille négociée, pas le tarif public.
- [ ] Une remise en % et une remise en valeur absolue produisent le résultat attendu sur le prix final.
- [ ] Un package vendu à prix global est ventilé automatiquement et la somme des lignes ventilées correspond au prix global.
