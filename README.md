# Caisse — MAYUNDO Party

Application de suivi de caisse pour la fête **MAYUNDO FAMILY PARTY 2026**
(BAC3 Informatique de Gestion, Bukavu). React + Vite, Firebase Auth +
Firestore, EmailJS. Aucun serveur : tout tourne dans le navigateur et est
déployé sur Firebase Hosting.

## Démarrer

```bash
npm install
npm run dev
```

| Commande | Rôle |
| --- | --- |
| `npm run dev` | serveur de développement |
| `npm run build` | build de production dans `dist/` |
| `npm run preview` | prévisualise le build |
| `npm run lint` | ESLint |

## Déploiement

```bash
npm run build
firebase deploy --only hosting,firestore:rules
```

Les règles de sécurité vivent dans `firestore.rules` et sont déclarées dans
`firebase.json` : elles se déploient avec le projet, sans copier-coller dans la
console Firebase.

## Rôles

| Rôle | Espace | Droits |
| --- | --- | --- |
| `super_admin` | `/super-admin` | supervision globale, création d'admins, paramètres de l'événement, message groupé, journal d'audit, connexions |
| `admin` | `/admin` | création des comptes (caissier, président, CP, membre), traitement des demandes de correction, rapports |
| `caissier` | `/caissier` | encaissements, sorties de caisse, signalement de ses erreurs |
| `president`, `cp` | `/consultation` | lecture seule de la situation de caisse |
| `membre` | `/consultation` | lecture seule du statut des membres du comité |

## Tarifs

Définis dans `src/constants/typesFrais.js` :

- **Étudiant / invité — 20 $** : fête 10 $ + t-shirt 5 $ + défense 5 $
- **Membre du comité — 30 $** : frais de comité

Les paiements peuvent être encaissés en **tranches**, en dollars ou en francs
congolais (taux fixe : 1 $ = 2400 FC, `src/constants/devises.js`). Tous les
totaux sont calculés en équivalent dollars, et **toutes les tranches d'un même
frais s'additionnent**.

L'e-mail de confirmation ne part qu'une fois le total atteint (20 $ ou 30 $),
jamais à chaque tranche.

## Circuit de correction

Une opération enregistrée n'est **jamais** modifiable directement :

1. le caissier signale l'erreur sur l'opération concernée, en décrivant le
   problème — il ne propose aucun montant ;
2. l'admin voit la demande, **saisit lui-même le montant correct** et
   l'applique, ou refuse ;
3. le nouveau montant remplace l'ancien dans tous les totaux ; l'ancien reste
   conservé pour la traçabilité (champs `ancienMontant*` + journal d'audit) ;
4. le caissier est notifié du résultat dans son espace, et l'historique complet
   est visible côté caissier, admin et super admin.

Cette contrainte est appliquée **deux fois** : dans `caisseService.js` et dans
`firestore.rules`. Ne pas retirer l'une des deux — sans serveur, les règles
Firestore sont la seule barrière réellement opposable.

## Scripts d'administration

`scripts/` contient deux scripts Node de remise à zéro, qui utilisent le SDK
Admin et demandent une confirmation explicite avant toute suppression.

Ils nécessitent une clé de compte de service placée dans
`scripts/cle-service-compte.json`. **Ce fichier donne un accès total au projet
Firebase** : il est dans `.gitignore` et ne doit jamais être partagé, commité
ou joint à une archive du dossier.

---

Réalisé par **Lubunga Justin** — JENGA DIGITAL.
