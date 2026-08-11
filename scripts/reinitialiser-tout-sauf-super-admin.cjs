/**
 * Réinitialisation TOTALE — Caisse MAYUNDO Party
 * -----------------------------------------------------------------------
 * ⚠️ SCRIPT PLUS RADICAL que "reinitialiser-donnees.js" : celui-ci supprime
 * AUSSI tous les comptes (Authentication + Firestore) — admin, caissiers,
 * président, CP, membres du comité — pour ne garder QUE le(s) compte(s)
 * super admin. À utiliser seulement si tu veux vraiment tout recommencer,
 * y compris recréer tous les comptes ensuite.
 *
 * Ce qui est supprimé :
 *   - Tous les paiements, sorties, personnes, journal d'audit, connexions,
 *     demandes de correction (comme l'autre script)
 *   - Tous les comptes utilisateurs (Firestore ET Authentication) dont le
 *     rôle n'est PAS "super_admin"
 *
 * Ce qui est CONSERVÉ :
 *   - Le(s) compte(s) super admin (Authentication + Firestore)
 *   - Les paramètres de l'événement (nom, date, heure)
 *
 * ------------------------- INSTALLATION (une seule fois) -------------------------
 * Si tu as déjà utilisé "reinitialiser-donnees.js", tu as déjà fait ces
 * étapes — pas besoin de les refaire.
 * 1. npm install firebase-admin
 * 2. Firebase Console → ⚙️ Paramètres du projet → Comptes de service
 *    → "Générer une nouvelle clé privée" → télécharge le fichier JSON
 * 3. Place ce fichier dans ce dossier "scripts/" et renomme-le
 *    "cle-service-compte.json" (déjà dans .gitignore, ne jamais partager)
 *
 * ------------------------------- UTILISATION -------------------------------
 * node scripts/reinitialiser-tout-sauf-super-admin.js
 *
 * Le script te montre d'abord la liste des comptes qui vont être supprimés
 * et demande une confirmation explicite avant de toucher à quoi que ce soit.
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const readline = require("readline");
const serviceAccount = require("./cle-service-compte.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

const COLLECTIONS_DONNEES_A_VIDER = [
  "paiements",
  "sorties",
  "personnes",
  "auditLog",
  "connexions",
  "demandesCorrection",
];

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
  console.log("Recherche des comptes existants...\n");
  const snap = await db.collection("utilisateurs").get();

  const aGarder = [];
  const aSupprimer = [];
  snap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.role === "super_admin") {
      aGarder.push({ id: doc.id, ...data });
    } else {
      aSupprimer.push({ id: doc.id, ...data });
    }
  });

  console.log("✅ Comptes CONSERVÉS (super admin) :");
  if (aGarder.length === 0) {
    console.log("   ⚠️  ATTENTION : aucun compte super admin trouvé !");
  } else {
    aGarder.forEach((u) => console.log(`   - ${u.nom || "(sans nom)"} — ${u.email}`));
  }

  console.log("\n❌ Comptes qui seront SUPPRIMÉS (Authentication + Firestore) :");
  if (aSupprimer.length === 0) {
    console.log("   Aucun.");
  } else {
    aSupprimer.forEach((u) => console.log(`   - ${u.nom || "(sans nom)"} — ${u.email} (${u.role})`));
  }

  console.log("\nSeront aussi entièrement vidées : " + COLLECTIONS_DONNEES_A_VIDER.join(", "));
  console.log("Les paramètres de l'événement (nom/date/heure) seront conservés.\n");

  if (aGarder.length === 0) {
    const reponseSansSuperAdmin = await demanderConfirmation(
      "⚠️ Aucun super admin ne sera conservé — tu resterais sans accès admin. Continuer quand même ? (tape OUI) : "
    );
    if (reponseSansSuperAdmin !== "oui") {
      console.log("Annulé.");
      process.exit(0);
    }
  }

  const reponse = await demanderConfirmation('Tape "OUI" en majuscules pour confirmer la suppression : ');
  if (reponse !== "oui") {
    console.log("Annulé — rien n'a été supprimé.");
    process.exit(0);
  }

  console.log("\nSuppression des comptes...");
  for (const u of aSupprimer) {
    try {
      await auth.deleteUser(u.id);
    } catch (err) {
      console.log(`   ⚠️  Compte Authentication déjà absent pour ${u.email} (${err.message})`);
    }
    await db.collection("utilisateurs").doc(u.id).delete();
    console.log(`  - Supprimé : ${u.email}`);
  }

  console.log("\nSuppression des données de caisse...");
  for (const nom of COLLECTIONS_DONNEES_A_VIDER) {
    await viderCollection(nom);
  }

  console.log("\n✅ Terminé — il ne reste que le(s) compte(s) super admin. Tout le reste est à zéro.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erreur :", err);
  process.exit(1);
});
