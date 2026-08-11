/**
 * Script de réinitialisation des données de démo — Caisse MAYUNDO Party
 * -----------------------------------------------------------------------
 * Ce script est VOLONTAIREMENT séparé de l'application (pas de bouton dans
 * l'interface) pour éviter qu'un clic accidentel efface tout par erreur.
 * Tu l'exécutes toi-même, quand tu es prêt, depuis ton ordinateur.
 *
 * Il supprime tout l'historique de caisse (paiements, sorties, personnes,
 * journal d'audit, connexions, demandes de correction) pour repartir de
 * zéro après une démo — MAIS conserve TOUS les comptes utilisateurs (admin,
 * caissiers, membres, super admin...) et les paramètres de l'événement.
 *
 * Pour un reset qui supprime AUSSI les comptes (sauf super admin), utilise
 * plutôt "reinitialiser-tout-sauf-super-admin.cjs".
 *
 * ------------------------- INSTALLATION (une seule fois) -------------------------
 * 1. npm install firebase-admin
 * 2. Firebase Console → ⚙️ Paramètres du projet → Comptes de service
 *    → "Générer une nouvelle clé privée" → télécharge le fichier JSON
 * 3. Place ce fichier dans ce dossier "scripts/" et renomme-le
 *    "cle-service-compte.json"
 * 4. Ajoute "scripts/cle-service-compte.json" à ton fichier .gitignore
 *    (ne JAMAIS partager ce fichier, il donne un accès total au projet)
 *
 * ------------------------------- UTILISATION -------------------------------
 * node scripts/reinitialiser-donnees.cjs
 *
 * Le script demande une confirmation avant de supprimer quoi que ce soit.
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const readline = require("readline");
const serviceAccount = require("./cle-service-compte.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Collections effacées entièrement (repartir de zéro pour une nouvelle démo).
const COLLECTIONS_A_VIDER = [
  "paiements",
  "sorties",
  "personnes",
  "auditLog",
  "connexions",
  "demandesCorrection",
];

// Collections volontairement PAS touchées : "utilisateurs" (comptes) et
// "parametres" (nom/date/heure de l'événement).

async function viderCollection(nom) {
  const snap = await db.collection(nom).get();
  if (snap.empty) {
    console.log(`  - ${nom} : déjà vide.`);
    return;
  }
  const lots = [];
  let lot = db.batch();
  let compteur = 0;
  snap.docs.forEach((doc) => {
    lot.delete(doc.ref);
    compteur++;
    if (compteur % 400 === 0) {
      lots.push(lot);
      lot = db.batch();
    }
  });
  lots.push(lot);
  for (const l of lots) await l.commit();
  console.log(`  - ${nom} : ${snap.size} document(s) supprimé(s).`);
}

function demanderConfirmation(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (reponse) => {
    rl.close();
    resolve(reponse.trim().toLowerCase());
  }));
}

async function main() {
  console.log("⚠️  Ce script va supprimer TOUTES les données de caisse suivantes :");
  COLLECTIONS_A_VIDER.forEach((c) => console.log(`   - ${c}`));
  console.log("Les comptes utilisateurs et les paramètres de l'événement ne seront PAS touchés.\n");

  const reponse = await demanderConfirmation('Tape "OUI" en majuscules pour confirmer : ');
  if (reponse !== "oui") {
    console.log("Annulé — aucune donnée n'a été supprimée.");
    process.exit(0);
  }

  console.log("\nSuppression en cours...");
  for (const nom of COLLECTIONS_A_VIDER) {
    await viderCollection(nom);
  }
  console.log("\n✅ Terminé — la caisse est prête pour une nouvelle démo.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erreur :", err);
  process.exit(1);
});
