# PRD — Service Night Audit

**Projet** : PMS AMH Hospitality — Architecture microservices
**Service** : `service-night-audit`
**Port** : `4007`
**Responsable** : Maroua
**Version** : 1.0 — Juillet 2026

---

## 1. Présentation du service

### 1.1 Objectif

Le `service-night-audit` est responsable de la **clôture comptable quotidienne** de l'hôtel. Chaque soir, il vérifie que les comptes de la journée sont équilibrés, fige définitivement les données de la journée écoulée, fait basculer le système sur le jour suivant, et génère automatiquement les rapports financiers et opérationnels.

### 1.2 En clair

> C'est le "bouton de fin de journée" du PMS. Une fois pressé, on ne peut plus rien changer sur la journée qui vient de se terminer, et l'hôtel reçoit tous ses rapports (chiffre d'affaires, encaissements, arrivées/départs) prêts pour le lendemain.

### 1.3 Pourquoi ce service est critique

C'est le service le plus sensible du PMS : il gère de l'argent et des données comptables **irréversibles**. Une erreur ici peut fausser toute la comptabilité de l'hôtel. La fiabilité prime sur la rapidité de développement.

---

## 2. Périmètre du service

### 2.1 Ce que ce service fait

- Collecter les données financières et opérationnelles de la journée en cours auprès des autres services.
- Vérifier l'équilibre comptable (débit = crédit).
- Clôturer la journée de façon irréversible.
- Faire avancer la date système à J+1.
- Générer et stocker les rapports (PDF) financiers et opérationnels.
- Exposer l'historique des clôtures passées (lecture seule).

### 2.2 Ce que ce service ne fait PAS

- Il ne crée pas de réservations, ni de factures → ce sont `service-reservations` et `service-frontoffice`.
- Il ne calcule pas les tarifs/taxes → c'est `service-tarification`.
- Il ne modifie jamais l'état des chambres directement → c'est `service-housekeeping` (il peut au mieux lui envoyer un signal).
- Il n'authentifie pas les utilisateurs → c'est `service-auth` (il vérifie juste le token reçu).

---

## 3. Utilisateurs concernés

| Rôle                    | Utilisation                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| **Réceptionniste**      | Peut consulter le statut du jour, mais ne déclenche généralement pas la clôture.            |
| **Manager / Comptable** | Déclenche la clôture, consulte et télécharge les rapports.                                  |
| **Administrateur**      | Consulte l'historique complet, peut forcer une clôture en cas d'écart (avec justification). |

---

## 4. Fonctionnalités détaillées

### 4.1 Vérification du balancement des comptes

Avant toute clôture, le service doit :

1. Récupérer le total des facturations (débits) de la journée via `service-frontoffice`.
2. Récupérer le total des encaissements + débiteurs (crédits) de la journée.
3. Comparer les deux totaux.
4. Si un écart existe → bloquer la clôture et renvoyer une alerte détaillée (montant de l'écart, source probable).
5. Si les comptes sont équilibrés → autoriser la clôture.

> **En clair** : le système fait toujours "argent qui doit rentrer = argent qui est réellement rentré". S'il manque un centime, il prévient au lieu de clôturer en silence.

### 4.2 Clôture de la journée (irréversibilité)

- Une fois validée, la journée J passe en statut `cloturee`.
- Plus aucune modification n'est possible sur les données de cette journée (ni ici, ni dans les autres services théoriquement — à coordonner avec l'équipe).
- La date système du PMS avance automatiquement à J+1.

### 4.3 Rapports financiers générés automatiquement

| Rapport                                   | Contenu                                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **CA détaillé de la journée**             | Ventilation par poste : hébergement, restauration/bar, extras, taxes de séjour — avec distinction HT / TVA / TTC. |
| **Encaissements du jour (Main courante)** | Total par mode de règlement : Espèces, CB, Chèques, Virements.                                                    |
| **Débiteurs**                             | Montants basculés en attente de paiement (factures agences/sociétés).                                             |

### 4.4 Rapports opérationnels générés automatiquement

| Rapport                     | Contenu                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| **Départs attendus**        | Chambres à libérer aujourd'hui + solde restant dû par client.                               |
| **Arrivées prévues**        | Réservations attendues, type de chambre, heure estimée, garantie reçue, demandes spéciales. |
| **Prévisions d'occupation** | Nombre de Pax prévu, T.O. et ADR attendus pour la journée suivante.                         |

### 4.5 Consultation de l'historique

- Endpoint de lecture permettant de consulter une clôture passée par date.
- Les rapports PDF générés doivent rester accessibles (téléchargeables) après clôture.

---

## 5. Règles métier importantes

| Règle                          | Description                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Irréversibilité**            | Une journée clôturée ne peut jamais être rouverte ou modifiée.                                                                       |
| **Équilibre obligatoire**      | Aucune clôture ne peut être validée si débit ≠ crédit, sauf validation manuelle explicite d'un administrateur avec motif enregistré. |
| **Une seule clôture par jour** | Impossible de clôturer deux fois la même `businessDate`.                                                                             |
| **Traçabilité totale**         | Chaque clôture garde une trace de qui l'a déclenchée et quand.                                                                       |
| **Génération automatique**     | Les rapports sont générés au moment de la clôture, jamais recalculés après coup (photo figée de la journée).                         |

---

## 6. Architecture technique

### 6.1 Stack

- **Framework** : Express.js
- **Base de données** : PostgreSQL _(recommandé — voir section 6.3)_
- **ORM** : Drizzle
- **Génération de PDF** : `pdfkit`
- **Planification automatique** (optionnel) : `node-cron`
- **Communication inter-services** : appels REST via `axios`
- **Authentification** : vérification de JWT émis par `service-auth`

### 6.2 Structure du projet

```
service-night-audit/
├── src/
│   ├── config/          # connexion base de données
│   ├── controllers/      # reçoit les requêtes HTTP
│   ├── services/         # logique métier (balancement, clôture)
│   ├── routes/           # définition des endpoints
│   ├── models/           # modèles de données
│   ├── clients/           # appels HTTP vers les autres microservices
│   ├── middlewares/       # vérification JWT, gestion d'erreurs
│   ├── utils/             # génération de PDF, helpers
│   └── app.js
├── tests/
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

### 6.3 Choix de base de données

Ce service traite des données **comptables et transactionnelles** (débit/crédit, sommes exactes). Une base **relationnelle (PostgreSQL)** est recommandée plutôt que NoSQL, car :

- Les intégrités transactionnelles (ACID) sont critiques pour l'argent.
- Le schéma des données est fixe et structuré (une clôture a toujours les mêmes champs).
- Les agrégations (`SUM`, `GROUP BY` par catégorie/mode de paiement) sont naturelles en SQL.

_(Chaque service du PMS étant indépendant — "database per service" — ce choix ne concerne que `service-night-audit` et n'impose rien aux autres services de l'équipe.)_

---

## 7. Modèle de données

### 7.1 Table `daily_closures`

| Champ           | Type          | Description                          |
| --------------- | ------------- | ------------------------------------ |
| `id`            | UUID          | Identifiant unique                   |
| `business_date` | DATE (unique) | Journée concernée                    |
| `status`        | STRING        | `en_cours` / `cloturee`              |
| `closed_by`     | STRING        | Utilisateur ayant validé la clôture  |
| `closed_at`     | TIMESTAMP     | Date/heure de la clôture             |
| `total_debit`   | DECIMAL       | Total des facturations               |
| `total_credit`  | DECIMAL       | Total des encaissements + débiteurs  |
| `ecart`         | DECIMAL       | Différence détectée (0 si équilibré) |

### 7.2 Table `revenue_breakdown`

| Champ         | Type      | Description                                               |
| ------------- | --------- | --------------------------------------------------------- |
| `id`          | UUID      | Identifiant                                               |
| `closure_id`  | UUID (FK) | Référence à la clôture                                    |
| `category`    | STRING    | `hebergement` / `restauration` / `extras` / `taxe_sejour` |
| `montant_ht`  | DECIMAL   | Montant hors taxes                                        |
| `tva`         | DECIMAL   | Montant de TVA                                            |
| `montant_ttc` | DECIMAL   | Montant toutes taxes comprises                            |

### 7.3 Table `payment_summary`

| Champ        | Type      | Description                       |
| ------------ | --------- | --------------------------------- |
| `id`         | UUID      | Identifiant                       |
| `closure_id` | UUID (FK) | Référence à la clôture            |
| `mode`       | STRING    | `ESP` / `CB` / `CHQ` / `Virement` |
| `montant`    | DECIMAL   | Total encaissé pour ce mode       |

### 7.4 Table `debtors_summary`

| Champ        | Type      | Description                     |
| ------------ | --------- | ------------------------------- |
| `id`         | UUID      | Identifiant                     |
| `closure_id` | UUID (FK) | Référence à la clôture          |
| `agency_id`  | STRING    | Identifiant de l'agence/société |
| `montant_du` | DECIMAL   | Montant restant à recevoir      |

### 7.5 Table `generated_reports`

| Champ          | Type      | Description                                                |
| -------------- | --------- | ---------------------------------------------------------- |
| `id`           | UUID      | Identifiant                                                |
| `closure_id`   | UUID (FK) | Référence à la clôture                                     |
| `type_rapport` | STRING    | Ex : `ca_detaille`, `main_courante`, `departs_attendus`... |
| `file_path`    | STRING    | Chemin/URL du PDF généré                                   |
| `generated_at` | TIMESTAMP | Date de génération                                         |

---

## 8. Endpoints API

| Méthode | Route                                                    | Description                                                              |
| ------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET`   | `/api/night-audit/status`                                | Vérifie que le service tourne, retourne le statut de la journée en cours |
| `POST`  | `/api/night-audit/check-balance`                         | Vérifie le balancement débit/crédit sans clôturer                        |
| `POST`  | `/api/night-audit/close`                                 | Déclenche la clôture officielle de la journée                            |
| `GET`   | `/api/night-audit/history`                               | Liste des clôtures passées                                               |
| `GET`   | `/api/night-audit/history/:date`                         | Détail d'une clôture précise                                             |
| `GET`   | `/api/night-audit/reports/:closureId`                    | Liste des rapports générés pour une clôture                              |
| `GET`   | `/api/night-audit/reports/:closureId/download/:reportId` | Télécharger un rapport PDF                                               |

### Exemple — `POST /api/night-audit/close`

**Requête** :

```json
{
  "businessDate": "2026-07-11",
  "closedBy": "manager_omar"
}
```

**Réponse (succès)** :

```json
{
  "status": "cloturee",
  "businessDate": "2026-07-11",
  "totalDebit": 45200.0,
  "totalCredit": 45200.0,
  "ecart": 0,
  "reportsGenerated": 5
}
```

**Réponse (écart détecté)** :

```json
{
  "status": "erreur_balancement",
  "totalDebit": 45200.0,
  "totalCredit": 44950.0,
  "ecart": 250.0,
  "message": "La clôture a été bloquée : écart détecté entre débits et crédits."
}
```

---

## 9. Communication avec les autres services

| Service appelé         | Donnée récupérée                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `service-frontoffice`  | Factures, encaissements et modes de paiement de la journée                                           |
| `service-reservations` | Arrivées et départs prévus, statuts des réservations                                                 |
| `service-tarification` | Détail des taxes (TS/TPT) et TVA appliquées                                                          |
| `service-housekeeping` | _(optionnel)_ notification de fin de journée pour synchroniser les statuts de chambres               |
| `service-auth`         | Vérification du token JWT de l'utilisateur qui déclenche la clôture                                  |
| service-analytics      | (Aucun appel sortant) — Analytics consomme les données de night-audit via GET /history, à la demande |

> Ces appels se font en HTTP via `axios`, avec les URLs définies dans le `.env` de chaque environnement.

---

## 10. Sécurité

- Toutes les routes (sauf `/health`) sont protégées par un middleware qui vérifie le JWT.
- Seuls les rôles `manager` et `admin` peuvent déclencher `/close`.
- Toute tentative de clôture est journalisée (qui, quand, résultat).
- Aucune route ne permet de modifier une clôture déjà validée.

---

## 11. Critères d'acceptation (Definition of Done)

- [ ] Le service démarre et répond sur `/health`.
- [ ] Le calcul de balancement est correct et testé avec des cas déséquilibrés.
- [ ] Une clôture ne peut pas être déclenchée deux fois pour la même date.
- [ ] Les 5 rapports sont bien générés en PDF et téléchargeables.
- [ ] Une tentative de modification sur une journée clôturée est rejetée.
- [ ] Les endpoints sont protégés par JWT et testés avec un token invalide.

---

## 12. Risques et points d'attention

| Risque                                                                   | Mitigation                                                                   |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Un autre service (front office) est indisponible au moment de la clôture | Prévoir un timeout + message d'erreur clair plutôt qu'un crash               |
| Écart comptable non expliqué                                             | Le rapport d'écart doit indiquer les sources possibles, pas juste le montant |
| Clôture lancée deux fois en même temps (double-clic)                     | Verrou (lock) sur la `business_date` pendant le traitement                   |
| Génération de PDF longue                                                 | Génération asynchrone si nécessaire, avec statut `en_cours` visible          |

---

## 13. Prochaines étapes suggérées

1. Mettre en place la connexion PostgreSQL + modèles Sequelize.
2. Développer `check-balance` en premier (c'est la brique la plus critique).
3. Simuler les appels aux autres services avec des données mockées, en attendant que les repos des coéquipiers soient prêts.
4. Développer la génération des PDF une fois la logique de calcul stable.
5. Écrire des tests sur les cas d'écart (débit ≠ crédit).
