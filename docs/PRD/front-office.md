# PRD — Front Office

**Projet :** OASIS PMS — Module 1
**Statut :** Draft
**Auteur :** Hanan
**Dernière mise à jour :** 22 juillet 2026

---

## 1. Contexte & Objectif

Ce module gère les flux financiers et les statuts client en temps réel : procédure de check-in, gestion de la facturation (double folio), et procédure de check-out avec encaissement. C'est un module à forte exigence de traçabilité financière et de sécurité (irréversibilité de certaines actions).

## 2. Périmètre fonctionnel

### 2.1 Procédure de Check-in

**Avant le check-in (statut Réservation) :**

- Seule une **Facture Pro-forma** peut être éditée.

**Après le check-in (statut Client Présent — "in house") :**

- **Verrouillage** : la facture pro-forma devient indisponible, remplacée par un **Extrait de compte**.
- **Gestion double folio (facturation scindée)** — l'extrait de compte doit obligatoirement gérer deux folios distincts :
  - **Folio A (Client)** : extras ou nuitées à charge directe du client.
  - **Folio B (Prise en charge)** : montants à facturer à une agence de voyages, une société, ou un tiers.
- **Personnalisation de l'affichage d'un folio** : l'utilisateur peut sélectionner/cocher uniquement certaines prestations à faire apparaître sur l'extrait imprimé, à la demande du client.
- ⚠️ **Règle de sécurité financière** : même si l'affichage imprimé est masqué/personnalisé, le système doit conserver l'intégralité de la traçabilité en arrière-plan. **Le montant total final réel ne peut en aucun cas être modifié ou altéré.**

### 2.2 Procédure de Check-out

**Étapes obligatoires du workflow de départ :**

1. **Visualisation** : génération automatique de l'extrait de compte final (Folio A et/ou B).
2. **Encaissement** — sélection obligatoire du/des mode(s) de règlement :
   - CB (Carte Bancaire)
   - ESP (Espèces)
   - CHQ (Chèque)
   - Virement
   - Débiteur (facture envoyée en attente de paiement agence/société)
3. **Validation du check-out** : changement de statut de la chambre et du client.

⚠️ **Règle de sécurité stricte** : dès que le check-out est validé et enregistré, le système doit **bloquer définitivement** le dossier. Il est **strictement impossible** de réactiver le check-in pour ce même client sur ce séjour.

## 3. Modèle de données (éléments connus)

| Entité                                  | Champs / états attendus                                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `Booking`                               | statut (Réservation / In House / Check-out effectué)                                                           |
| `Invoice_Proforma`                      | éditable uniquement avant check-in                                                                             |
| `Account_Statement` (Extrait de compte) | remplace la facture pro-forma après check-in, verrouillé après check-out                                       |
| `Folio_A`                               | prestations à charge client direct                                                                             |
| `Folio_B`                               | prestations à charge tiers (agence/société)                                                                    |
| `Payment`                               | mode(s) de règlement (CB, ESP, CHQ, Virement, Débiteur), montant, folio associé                                |
| `Audit_Trail`                           | traçabilité intégrale de toutes les prestations, indépendante de l'affichage personnalisé de l'extrait imprimé |

## 4. Règles métier critiques

- Le passage **Réservation → In House** verrouille la facture pro-forma et fait apparaître les deux folios.
- La **personnalisation d'affichage** d'un folio (masquer certaines lignes à l'impression) **ne doit jamais** affecter le montant total réel stocké côté système — c'est une règle de sécurité financière non négociable.
- Le check-out **exige** la sélection d'au moins un mode de règlement avant validation.
- Le mode **Débiteur** bascule la facture en attente de paiement (agence/société), sans bloquer la validation du check-out.
- Une fois le check-out validé : **verrouillage définitif et irréversible** du dossier — aucune réactivation du check-in n'est permise, quel que soit le rôle utilisateur.

## 5. Dépendances

- **Module 2 (Housekeeping)** : le check-out déclenche le passage automatique de la chambre en statut "À nettoyer / Sale".
- **Module 4 (Tarification)** : les montants du folio proviennent de la grille tarifaire, des régimes, des extras et des remises/packages appliqués.
- **Module 5 (Réservations)** : le statut `status_checked_in` du cycle de vie de la réservation déclenche l'ouverture du folio ; `status_checked_out` déclenche la clôture de facture et le changement de statut de chambre.
- **Module 3 (Night Audit)** : consomme les encaissements et la ventilation par mode de règlement du jour.

## 6. Hors périmètre (non précisé dans le cahier des charges)

- Paiement en ligne / pré-autorisation carte à distance.
- Facturation électronique conforme à un format fiscal spécifique (non mentionnée).
- Gestion des group bookings / facturation groupée multi-chambres (non détaillée pour ce module).

## 7. Critères d'acceptation

- [ ] Avant check-in, seule la facture pro-forma est accessible en édition.
- [ ] Après check-in, la facture pro-forma n'est plus accessible ; l'extrait de compte (Folio A/B) est généré.
- [ ] Masquer une prestation sur l'extrait imprimé ne modifie pas le montant total réel tracé en base.
- [ ] Le check-out ne peut être validé sans sélection d'au moins un mode de règlement.
- [ ] Après validation du check-out, toute tentative de réactivation du check-in pour ce séjour est bloquée par le système, sans exception.
- [ ] Le check-out déclenche bien le changement de statut de la chambre côté Housekeeping.
